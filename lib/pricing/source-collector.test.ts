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
    const collector = createPriceSourceCollector({ firecrawl: { scrape } });

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
    const collector = createPriceSourceCollector({ firecrawl: { scrape } });

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
    const collector = createPriceSourceCollector({ firecrawl: { scrape } });

    const results = await collector.collect(MARKET_ITEM);

    expect(maxActive).toBeLessThanOrEqual(2);
    expect(results.map((result) => result.sourceId)).toEqual([
      "angeloni",
      "super-muffato",
      "zona-sul",
    ]);
  });

  it("compartilha o limite global quando coletas de itens diferentes começam juntas", async () => {
    let active = 0;
    let maxActive = 0;
    const scrape = vi.fn(async (url: string) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return scrapeResponse(url);
    });
    const collector = createPriceSourceCollector({ firecrawl: { scrape } });

    const results = await Promise.all([
      collector.collect({ name: "arroz", category: "mercado" }),
      collector.collect({ name: "feijão", category: "mercado" }),
    ]);

    expect(maxActive).toBe(2);
    expect(scrape).toHaveBeenCalledTimes(6);
    expect(
      results.every((itemResults) => itemResults.every(({ status }) => status === "found")),
    ).toBe(true);
    expect(results.map((itemResults) => itemResults.map(({ sourceId }) => sourceId))).toEqual([
      ["angeloni", "super-muffato", "zona-sul"],
      ["angeloni", "super-muffato", "zona-sul"],
    ]);
  });

  it("classifica conteúdo vazio como não encontrado sem chamar outro provedor", async () => {
    const scrape = vi.fn(async (url: string) => scrapeResponse(url, "\n \r\n"));
    const collector = createPriceSourceCollector({ firecrawl: { scrape } });

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
    const collector = createPriceSourceCollector({ firecrawl: { scrape } });

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
    const collector = createPriceSourceCollector({ firecrawl: { scrape } });

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
    const collector = createPriceSourceCollector({ firecrawl: { scrape } });

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
    const collector = createPriceSourceCollector({ firecrawl: { scrape } });

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
      firstResult: () => Promise.reject(new Error("segredo do provedor")),
    },
    {
      label: "URL inválida",
      firstResult: () => Promise.resolve(scrapeResponse("https://example.com/dipirona")),
    },
  ])("libera o permit depois de $label e executa a coleta seguinte", async ({ firstResult }) => {
    const scrape = vi
      .fn()
      .mockImplementationOnce(firstResult)
      .mockResolvedValueOnce(scrapeResponse("https://www.drogariavenancio.com.br/dipirona"));
    const collector = createPriceSourceCollector({
      firecrawl: { scrape },
      maxConcurrentScrapes: 1,
    });

    const firstCollection = collector.collect({ name: "dipirona", category: "farmacia" });
    const secondCollection = collector.collect({ name: "dipirona", category: "farmacia" });

    await expect(firstCollection).resolves.toMatchObject([{ status: "failed" }]);
    await expect(secondCollection).resolves.toMatchObject([{ status: "found" }]);
    expect(scrape).toHaveBeenCalledTimes(2);
  });

  it("classifica falhas inesperadas como erro técnico seguro", async () => {
    const scrape = vi.fn().mockRejectedValue(new Error("segredo do provedor"));
    const collector = createPriceSourceCollector({ firecrawl: { scrape } });

    const results = await collector.collect({ name: "dipirona", category: "farmacia" });

    expect(results[0]).toMatchObject({
      status: "failed",
      errorCode: "provider_error",
      retryable: false,
    });
    expect(JSON.stringify(results)).not.toContain("segredo do provedor");
  });
});
