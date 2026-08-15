import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { IntegrationError } from "@/lib/integrations/errors";
import {
  createPriceSourceCollector,
  normalizePriceSourceMarkdown,
  type SourceCollectionItem,
} from "@/lib/pricing/source-collector";

const MARKET_ITEM: SourceCollectionItem = {
  name: "café & leite/zero? #1",
  category: "mercado",
};

function scrapeResponse(url: string, markdown = "Produto\nR$ 10,00") {
  return {
    url,
    markdown,
    metadata: { title: "Produto", statusCode: 200 },
  };
}

function searchResponse(
  results: Array<{
    url: string;
    title?: string;
    description?: string;
    markdown?: string;
  }>,
) {
  return { results };
}

describe("normalizePriceSourceMarkdown", () => {
  it("normaliza espaços, quebras, vazios e duplicatas consecutivas", () => {
    expect(
      normalizePriceSourceMarkdown(
        "\r\n  Café   & leite  \r\n\r\nCafé & leite\n  R$   10,00\nR$ 10,00\n",
      ),
    ).toBe("Café & leite\nR$ 10,00");
  });

  it("limita o conteúdo normalizado sem remover o contexto inicial", () => {
    const markdown = `Produto\n${"x".repeat(3_000)}`;

    const normalized = normalizePriceSourceMarkdown(markdown);

    expect(normalized).toHaveLength(2_500);
    expect(normalized.startsWith("Produto\n")).toBe(true);
  });
});

describe("createPriceSourceCollector", () => {
  it("seleciona fontes habilitadas, monta URLs codificadas e preserva a prioridade", async () => {
    const scrape = vi.fn(async (url: string) => scrapeResponse(url));
    const collector = createPriceSourceCollector({
      firecrawl: { scrape, search: vi.fn().mockResolvedValue(searchResponse([])) },
    });

    const results = await collector.collect(MARKET_ITEM);

    expect(scrape).toHaveBeenCalledTimes(3);
    expect(scrape.mock.calls.map(([url]) => url)).toEqual([
      "https://super.angeloni.com.br/caf%C3%A9%20%26%20leite%2Fzero%3F%20%231",
      "https://www.supermuffato.com.br/caf%C3%A9%20%26%20leite%2Fzero%3F%20%231",
      "https://www.zonasul.com.br/caf%C3%A9%20%26%20leite%2Fzero%3F%20%231",
    ]);
    expect(results.map((result) => result.sourceId)).toEqual([
      "angeloni",
      "super-muffato",
      "zona-sul",
    ]);
    expect(results[0]).toMatchObject({
      status: "found",
      sourceUrl: "https://super.angeloni.com.br/caf%C3%A9%20%26%20leite%2Fzero%3F%20%231",
      locationStatus: "unresolved",
      content: "Produto\nR$ 10,00",
    });
  });

  it("não inclui fontes desabilitadas e usa todas as habilitadas sem categoria", async () => {
    const scrape = vi.fn(async (url: string) => scrapeResponse(url));
    const collector = createPriceSourceCollector({
      firecrawl: { scrape, search: vi.fn().mockResolvedValue(searchResponse([])) },
    });

    await collector.collect({ name: "dipirona", category: "farmacia" });
    expect(scrape).toHaveBeenCalledTimes(1);
    expect(scrape).toHaveBeenCalledWith("https://www.drogariavenancio.com.br/dipirona");

    scrape.mockClear();
    await collector.collect({ name: "arroz", category: null });
    expect(scrape).toHaveBeenCalledTimes(4);
    expect(scrape.mock.calls.map(([url]) => url)).not.toEqual(
      expect.arrayContaining([
        "https://www.drogasil.com.br/search?w=arroz",
        "https://www.araujo.com.br/busca?q=arroz",
      ]),
    );

    scrape.mockClear();
    await collector.collect({ name: "arroz", category: "outro" });
    expect(scrape).toHaveBeenCalledTimes(4);
  });

  it("limita a duas raspagens concorrentes e devolve resultados na ordem de prioridade", async () => {
    let active = 0;
    let maxActive = 0;
    const scrape = vi.fn(async (url: string) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return scrapeResponse(url);
    });
    const collector = createPriceSourceCollector({
      firecrawl: { scrape, search: vi.fn().mockResolvedValue(searchResponse([])) },
    });

    const results = await collector.collect(MARKET_ITEM);

    expect(maxActive).toBeLessThanOrEqual(2);
    expect(results.map((result) => result.sourceId)).toEqual([
      "angeloni",
      "super-muffato",
      "zona-sul",
    ]);
  });

  it("compartilha o limite global e executa as raspagens em FIFO entre coletas simultâneas", async () => {
    const startedUrls: string[] = [];
    const pendingScrapes: Array<{
      resolve: (response: ReturnType<typeof scrapeResponse>) => void;
      url: string;
    }> = [];
    const scrape = vi.fn((url: string): Promise<ReturnType<typeof scrapeResponse>> => {
      startedUrls.push(url);
      return new Promise((resolve) => {
        pendingScrapes.push({ resolve, url });
      });
    });
    const collector = createPriceSourceCollector({
      firecrawl: { scrape, search: vi.fn().mockResolvedValue(searchResponse([])) },
      maxConcurrentScrapes: 1,
    });
    const expectedUrls = [
      "https://super.angeloni.com.br/arroz",
      "https://super.angeloni.com.br/feijao",
      "https://www.supermuffato.com.br/arroz",
      "https://www.supermuffato.com.br/feijao",
      "https://www.zonasul.com.br/arroz",
      "https://www.zonasul.com.br/feijao",
    ];

    const firstCollection = collector.collect({ name: "arroz", category: "mercado" });
    const secondCollection = collector.collect({ name: "feijao", category: "mercado" });

    for (const [index, expectedUrl] of expectedUrls.entries()) {
      await vi.waitFor(() => expect(pendingScrapes).toHaveLength(1));
      const pendingScrape = pendingScrapes.shift()!;
      expect(pendingScrape.url).toBe(expectedUrl);
      pendingScrape.resolve(scrapeResponse(expectedUrl));

      if (index < expectedUrls.length - 1) {
        await vi.waitFor(() => expect(startedUrls).toHaveLength(index + 2));
      }
    }

    const results = await Promise.all([firstCollection, secondCollection]);

    expect(startedUrls).toEqual(expectedUrls);
    expect(scrape).toHaveBeenCalledTimes(6);
    expect(results.map((itemResults) => itemResults.map(({ sourceId }) => sourceId))).toEqual([
      ["angeloni", "super-muffato", "zona-sul"],
      ["angeloni", "super-muffato", "zona-sul"],
    ]);
  });

  it("usa a busca genérica com query, conteúdo e evidência normalizada", async () => {
    const scrape = vi.fn(async (url: string) => scrapeResponse(url));
    const search = vi.fn().mockResolvedValue(
      searchResponse([
        {
          url: "https://catalogo.example/arroz",
          markdown: "Arroz\nR$ 12,90",
        },
      ]),
    );
    const collector = createPriceSourceCollector({ firecrawl: { scrape, search } });

    await expect(collector.search({ name: "Arroz", category: "mercado" })).resolves.toEqual([
      {
        status: "found",
        sourceId: "firecrawl-search",
        searchQuery: "Arroz preço",
        sourceUrl: "https://catalogo.example/arroz",
        content: "Arroz\nR$ 12,90",
        locationStatus: "unresolved",
      },
    ]);
    expect(search).toHaveBeenCalledWith({
      query: "Arroz preço",
      limit: 5,
      includeContent: true,
    });
  });

  it("descarta resultados irrelevantes, sem preço, inseguros e duplicados", async () => {
    const scrape = vi.fn(async (url: string) => scrapeResponse(url));
    const search = vi.fn().mockResolvedValue(
      searchResponse([
        {
          url: "https://catalogo.example/arroz",
          title: "Arroz",
          markdown: "Arroz\nR$ 12,90",
        },
        {
          url: "https://catalogo.example/arroz",
          title: "Arroz duplicado",
          markdown: "Arroz\nR$ 12,90",
        },
        {
          url: "https://catalogo.example/feijao",
          title: "Feijão",
          markdown: "Feijão\nR$ 9,90",
        },
        {
          url: "https://catalogo.example/arroz-promocao",
          title: "Feijão",
          markdown: "Feijão\nR$ 9,90",
        },
        {
          url: "https://catalogo.example/arroz-sem-preco",
          title: "Arroz",
          markdown: "Arroz em promoção",
        },
        {
          url: "ftp://catalogo.example/arroz",
          title: "Arroz",
          markdown: "Arroz\nR$ 12,90",
        },
      ]),
    );
    const collector = createPriceSourceCollector({ firecrawl: { scrape, search } });

    const results = await collector.search({ name: "arroz", category: "mercado" });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      status: "found",
      sourceUrl: "https://catalogo.example/arroz",
    });
  });

  it("classifica a busca sem resultados válidos como não encontrada", async () => {
    const scrape = vi.fn(async (url: string) => scrapeResponse(url));
    const search = vi.fn().mockResolvedValue(
      searchResponse([
        {
          url: "https://catalogo.example/feijao",
          title: "Feijão",
          markdown: "Feijão\nR$ 9,90",
        },
      ]),
    );
    const collector = createPriceSourceCollector({ firecrawl: { scrape, search } });

    await expect(collector.search({ name: "arroz", category: "mercado" })).resolves.toEqual([
      {
        status: "not_found",
        sourceId: "firecrawl-search",
        searchQuery: "arroz preço",
        locationStatus: "unresolved",
      },
    ]);
  });

  it("preserva falha tipada da busca sem expor detalhes internos", async () => {
    const scrape = vi.fn(async (url: string) => scrapeResponse(url));
    const search = vi.fn().mockRejectedValue(
      new IntegrationError({
        code: "rate_limit_error",
        provider: "firecrawl",
        message: "limite para segredo-interno",
        retryable: true,
      }),
    );
    const collector = createPriceSourceCollector({ firecrawl: { scrape, search } });

    const results = await collector.search({ name: "arroz", category: "mercado" });

    expect(results[0]).toMatchObject({
      status: "failed",
      sourceId: "firecrawl-search",
      errorCode: "rate_limit_error",
      retryable: true,
    });
    expect(JSON.stringify(results)).not.toContain("segredo-interno");
  });

  it("compartilha o limite FIFO entre scrape e busca genérica", async () => {
    let active = 0;
    let maxActive = 0;
    const track = async <T>(task: () => Promise<T>) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      try {
        return await task();
      } finally {
        active -= 1;
      }
    };
    const scrape = vi.fn((url: string) =>
      track(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return scrapeResponse(url);
      }),
    );
    const search = vi.fn(() =>
      track(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return searchResponse([]);
      }),
    );
    const collector = createPriceSourceCollector({
      firecrawl: { scrape, search },
      maxConcurrentScrapes: 1,
    });

    await Promise.all([
      collector.collect({ name: "dipirona", category: "farmacia" }),
      collector.search({ name: "arroz", category: "mercado" }),
    ]);

    expect(maxActive).toBe(1);
  });

  it("classifica conteúdo vazio como não encontrado sem chamar outro provedor", async () => {
    const scrape = vi.fn(async (url: string) => scrapeResponse(url, "\n \r\n"));
    const collector = createPriceSourceCollector({
      firecrawl: { scrape, search: vi.fn().mockResolvedValue(searchResponse([])) },
    });

    const results = await collector.collect({ name: "dipirona", category: "farmacia" });

    expect(results).toEqual([
      {
        status: "not_found",
        sourceId: "drogaria-venancio",
        searchUrl: "https://www.drogariavenancio.com.br/dipirona",
        locationStatus: "unresolved",
      },
    ]);
  });

  it("rejeita URL retornada fora do domínio da fonte", async () => {
    const scrape = vi.fn(async () => scrapeResponse("https://example.com/dipirona"));
    const collector = createPriceSourceCollector({
      firecrawl: { scrape, search: vi.fn().mockResolvedValue(searchResponse([])) },
    });

    const results = await collector.collect({ name: "dipirona", category: "farmacia" });

    expect(results[0]).toMatchObject({
      status: "failed",
      errorCode: "invalid_response_error",
      retryable: false,
    });
  });

  it("preserva a URL retornada quando ela é válida no domínio da fonte", async () => {
    const returnedUrl = "https://super.angeloni.com.br/produtos/arroz";
    const scrape = vi.fn(async (url: string) =>
      scrapeResponse(url === "https://super.angeloni.com.br/arroz" ? returnedUrl : url),
    );
    const collector = createPriceSourceCollector({
      firecrawl: { scrape, search: vi.fn().mockResolvedValue(searchResponse([])) },
    });

    const results = await collector.collect({ name: "arroz", category: "mercado" });

    expect(results[0]).toMatchObject({
      status: "found",
      searchUrl: "https://super.angeloni.com.br/arroz",
      sourceUrl: returnedUrl,
    });
  });

  it.each([
    "ftp://super.angeloni.com.br/arroz",
    "https://user:password@super.angeloni.com.br/arroz",
    "https://sub.super.angeloni.com.br/arroz",
  ])("rejeita URL retornada insegura: %s", async (returnedUrl) => {
    const scrape = vi.fn(async () => scrapeResponse(returnedUrl));
    const collector = createPriceSourceCollector({
      firecrawl: { scrape, search: vi.fn().mockResolvedValue(searchResponse([])) },
    });

    const results = await collector.collect({ name: "arroz", category: "mercado" });

    expect(results[0]).toMatchObject({
      status: "failed",
      errorCode: "invalid_response_error",
      retryable: false,
    });
  });

  it("preserva erros tipados e continua quando uma fonte falha", async () => {
    const scrape = vi
      .fn()
      .mockRejectedValueOnce(
        new IntegrationError({
          code: "rate_limit_error",
          provider: "firecrawl",
          message: "limite atingido",
          retryable: true,
          retryAfterMs: 1_000,
        }),
      )
      .mockResolvedValueOnce(scrapeResponse("https://www.supermuffato.com.br/arroz"))
      .mockResolvedValueOnce(scrapeResponse("https://www.zonasul.com.br/arroz"));
    const collector = createPriceSourceCollector({
      firecrawl: { scrape, search: vi.fn().mockResolvedValue(searchResponse([])) },
    });

    const results = await collector.collect({ name: "arroz", category: "mercado" });

    expect(results[0]).toMatchObject({
      status: "failed",
      sourceId: "angeloni",
      errorCode: "rate_limit_error",
      retryable: true,
    });
    expect(results.slice(1).every((result) => result.status === "found")).toBe(true);
  });

  it.each([
    {
      label: "falha tipada",
      firstStatus: "failed",
      firstResult: () =>
        Promise.reject(
          new IntegrationError({
            code: "timeout_error",
            provider: "firecrawl",
            message: "tempo esgotado",
            retryable: true,
          }),
        ),
    },
    {
      label: "erro inesperado",
      firstStatus: "failed",
      firstResult: () => Promise.reject(new Error("segredo do provedor")),
    },
    {
      label: "URL inválida",
      firstStatus: "failed",
      firstResult: () => Promise.resolve(scrapeResponse("https://example.com/dipirona")),
    },
    {
      label: "conteúdo vazio",
      firstStatus: "not_found",
      firstResult: () =>
        Promise.resolve(scrapeResponse("https://www.drogariavenancio.com.br/dipirona", "\n \r\n")),
    },
  ])(
    "libera o permit depois de $label e executa a coleta seguinte",
    async ({ firstResult, firstStatus }) => {
      const scrape = vi
        .fn()
        .mockImplementationOnce(firstResult)
        .mockResolvedValueOnce(scrapeResponse("https://www.drogariavenancio.com.br/dipirona"));
      const collector = createPriceSourceCollector({
        firecrawl: { scrape, search: vi.fn().mockResolvedValue(searchResponse([])) },
        maxConcurrentScrapes: 1,
      });

      const firstCollection = collector.collect({ name: "dipirona", category: "farmacia" });
      const secondCollection = collector.collect({ name: "dipirona", category: "farmacia" });

      await expect(firstCollection).resolves.toMatchObject([{ status: firstStatus }]);
      await expect(secondCollection).resolves.toMatchObject([{ status: "found" }]);
      expect(scrape).toHaveBeenCalledTimes(2);
    },
  );

  it("classifica falhas inesperadas como erro técnico seguro", async () => {
    const scrape = vi.fn().mockRejectedValue(new Error("segredo do provedor"));
    const collector = createPriceSourceCollector({
      firecrawl: { scrape, search: vi.fn().mockResolvedValue(searchResponse([])) },
    });

    const results = await collector.collect({ name: "dipirona", category: "farmacia" });

    expect(results[0]).toMatchObject({
      status: "failed",
      errorCode: "provider_error",
      retryable: false,
    });
    expect(JSON.stringify(results)).not.toContain("segredo do provedor");
  });
});
