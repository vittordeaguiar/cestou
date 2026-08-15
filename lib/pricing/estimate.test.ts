import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { IntegrationError } from "@/lib/integrations/errors";
import { createPriceEstimator, type PendingPriceItem } from "@/lib/pricing/estimate";
import type { SourceCollectionResult, SourceSearchResult } from "@/lib/pricing/source-collector";

const ITEMS: PendingPriceItem[] = [
  {
    id: "item-1",
    name: "Arroz",
    quantity: 2,
    unit: "kg",
    category: "mercado",
  },
  {
    id: "item-2",
    name: "Dipirona",
    quantity: 1,
    unit: null,
    category: "farmacia",
  },
];

function foundSource(
  sourceId: string,
  sourceUrl: string,
  content = "Produto R$ 10,00",
  searchUrl = sourceUrl,
) {
  return {
    status: "found" as const,
    sourceId,
    searchUrl,
    sourceUrl,
    content,
    locationStatus: "unresolved" as const,
  } satisfies SourceCollectionResult;
}

function notFoundSource(sourceId: string, searchUrl: string) {
  return {
    status: "not_found" as const,
    sourceId,
    searchUrl,
    locationStatus: "unresolved" as const,
  } satisfies SourceCollectionResult;
}

function failedSource(sourceId: string, searchUrl: string) {
  return {
    status: "failed" as const,
    sourceId,
    searchUrl,
    errorCode: "timeout_error" as const,
    retryable: true,
    locationStatus: "unresolved" as const,
  } satisfies SourceCollectionResult;
}

function foundSearchSource(sourceUrl: string, content = "Arroz\nR$ 10,00") {
  return {
    status: "found" as const,
    sourceId: "firecrawl-search" as const,
    searchQuery: "Arroz preço",
    sourceUrl,
    content,
    locationStatus: "unresolved" as const,
  } satisfies SourceSearchResult;
}

function foundPrice(item: string, unitPrice: number, sourceUrl: string) {
  return { item, found: true, unitPrice, sourceUrl };
}

function notFoundPrice(item: string) {
  return { item, found: false, unitPrice: null, sourceUrl: null };
}

describe("createPriceEstimator", () => {
  it("orquestra coleta e estruturação por item e calcula o total preliminar", async () => {
    const collect = vi
      .fn()
      .mockResolvedValueOnce([
        foundSource("angeloni", "https://super.angeloni.com.br/arroz", "Arroz R$ 10,00"),
      ])
      .mockResolvedValueOnce([
        foundSource(
          "drogaria-venancio",
          "https://www.drogariavenancio.com.br/dipirona",
          "Dipirona R$ 8,50",
        ),
      ]);
    const requestStructuredJson = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          ...foundPrice("Arroz", 10, "https://super.angeloni.com.br/arroz"),
        },
      })
      .mockResolvedValueOnce({
        data: {
          ...foundPrice("Dipirona", 8.5, "https://www.drogariavenancio.com.br/dipirona"),
        },
      });
    const search = vi.fn();
    const sourceCollector = { collect, search };
    const estimate = createPriceEstimator({
      sourceCollector,
      deepSeek: { requestStructuredJson },
    });

    await expect(estimate(ITEMS)).resolves.toEqual({
      status: "complete",
      totalAmount: 28.5,
      itemsNotFound: [],
      processedCount: 2,
      failedCount: 0,
    });

    expect(collect).toHaveBeenNthCalledWith(1, { name: "Arroz", category: "mercado" });
    expect(collect).toHaveBeenNthCalledWith(2, { name: "Dipirona", category: "farmacia" });
    expect(requestStructuredJson).toHaveBeenCalledTimes(2);
    expect(search).not.toHaveBeenCalled();
    expect(requestStructuredJson.mock.calls[0]?.[0].messages[0]?.content).toContain("nunca estime");
    expect(
      JSON.parse(String(requestStructuredJson.mock.calls[0]?.[0].messages[1]?.content)).instruction,
    ).toEqual(
      expect.stringContaining("Retorne exatamente os campos item, found, unitPrice e sourceUrl"),
    );
    expect(
      JSON.parse(String(requestStructuredJson.mock.calls[0]?.[0].messages[1]?.content)),
    ).toEqual(
      expect.objectContaining({
        evidence: [
          expect.objectContaining({
            sourceId: "angeloni",
            url: "https://super.angeloni.com.br/arroz",
            content: "Arroz R$ 10,00",
            locationStatus: "unresolved",
          }),
        ],
      }),
    );
  });

  it("marca item sem evidência como não encontrado sem chamar o DeepSeek", async () => {
    const collect = vi
      .fn()
      .mockResolvedValue([
        notFoundSource("angeloni", "https://super.angeloni.com.br/arroz"),
        notFoundSource("super-muffato", "https://www.supermuffato.com.br/arroz"),
      ]);
    const requestStructuredJson = vi.fn();
    const estimate = createPriceEstimator({
      sourceCollector: { collect, search: vi.fn().mockResolvedValue([]) },
      deepSeek: { requestStructuredJson },
    });

    await expect(estimate([ITEMS[0]!])).resolves.toEqual({
      status: "partial",
      totalAmount: 0,
      itemsNotFound: ["Arroz"],
      processedCount: 1,
      failedCount: 0,
    });
    expect(requestStructuredJson).not.toHaveBeenCalled();
  });

  it("usa a busca genérica somente depois de não encontrar evidência específica", async () => {
    const collect = vi
      .fn()
      .mockResolvedValue([
        notFoundSource("angeloni", "https://super.angeloni.com.br/arroz"),
        notFoundSource("super-muffato", "https://www.supermuffato.com.br/arroz"),
      ]);
    const search = vi
      .fn()
      .mockResolvedValue([foundSearchSource("https://catalogo.example/arroz", "Arroz\nR$ 11,50")]);
    const requestStructuredJson = vi.fn().mockResolvedValue({
      data: foundPrice("Arroz", 11.5, "https://catalogo.example/arroz"),
    });
    const estimate = createPriceEstimator({
      sourceCollector: { collect, search },
      deepSeek: { requestStructuredJson },
    });

    await expect(estimate([ITEMS[0]!])).resolves.toEqual({
      status: "complete",
      totalAmount: 23,
      itemsNotFound: [],
      processedCount: 1,
      failedCount: 0,
    });
    expect(search).toHaveBeenCalledWith({ name: "Arroz", category: "mercado" });
    expect(
      JSON.parse(String(requestStructuredJson.mock.calls[0]?.[0].messages[1]?.content)),
    ).toEqual(
      expect.objectContaining({
        evidence: [
          expect.objectContaining({
            sourceId: "firecrawl-search",
            url: "https://catalogo.example/arroz",
            content: "Arroz\nR$ 11,50",
          }),
        ],
      }),
    );
  });

  it("não usa a busca genérica quando a evidência específica não gera preço", async () => {
    const collect = vi
      .fn()
      .mockResolvedValue([
        foundSource("angeloni", "https://super.angeloni.com.br/arroz", "Arroz sem preço"),
      ]);
    const search = vi
      .fn()
      .mockResolvedValue([foundSearchSource("https://catalogo.example/arroz", "Arroz\nR$ 11,50")]);
    const requestStructuredJson = vi.fn().mockResolvedValue({
      data: notFoundPrice("Arroz"),
    });
    const estimate = createPriceEstimator({
      sourceCollector: { collect, search },
      deepSeek: { requestStructuredJson },
    });

    await expect(estimate([ITEMS[0]!])).resolves.toMatchObject({
      status: "partial",
      itemsNotFound: ["Arroz"],
    });
    expect(search).not.toHaveBeenCalled();
  });

  it("não encaminha ao DeepSeek uma coleta sem fontes encontradas", async () => {
    const collect = vi
      .fn()
      .mockResolvedValue([
        failedSource("angeloni", "https://super.angeloni.com.br/arroz"),
        notFoundSource("super-muffato", "https://www.supermuffato.com.br/arroz"),
      ]);
    const search = vi.fn().mockResolvedValue([]);
    const requestStructuredJson = vi.fn();
    const estimate = createPriceEstimator({
      sourceCollector: { collect, search },
      deepSeek: { requestStructuredJson },
    });

    await expect(estimate([ITEMS[0]!])).resolves.toMatchObject({
      status: "partial",
      totalAmount: 0,
      itemsNotFound: ["Arroz"],
      failedCount: 0,
    });
    expect(requestStructuredJson).not.toHaveBeenCalled();
    expect(search).toHaveBeenCalledWith({ name: "Arroz", category: "mercado" });
  });

  it("envia somente evidências encontradas em uma coleta parcialmente bem-sucedida", async () => {
    const returnedUrl = "https://super.angeloni.com.br/produtos/arroz";
    const collect = vi
      .fn()
      .mockResolvedValue([
        foundSource(
          "angeloni",
          returnedUrl,
          "Arroz R$ 10,00",
          "https://super.angeloni.com.br/arroz",
        ),
        notFoundSource("super-muffato", "https://www.supermuffato.com.br/arroz"),
        failedSource("zona-sul", "https://www.zonasul.com.br/arroz"),
      ]);
    const requestStructuredJson = vi.fn().mockResolvedValue({
      data: foundPrice("Arroz", 10, returnedUrl),
    });
    const estimate = createPriceEstimator({
      sourceCollector: { collect, search: vi.fn().mockResolvedValue([]) },
      deepSeek: { requestStructuredJson },
    });

    await expect(estimate([ITEMS[0]!])).resolves.toEqual({
      status: "complete",
      totalAmount: 20,
      itemsNotFound: [],
      processedCount: 1,
      failedCount: 0,
    });

    const request = requestStructuredJson.mock.calls[0]?.[0];
    expect(JSON.parse(String(request?.messages[1]?.content)).evidence).toEqual([
      {
        index: 1,
        sourceId: "angeloni",
        url: returnedUrl,
        locationStatus: "unresolved",
        content: "Arroz R$ 10,00",
      },
    ]);
  });

  it("mantém evidências úteis quando somente um item falha tecnicamente", async () => {
    const collect = vi
      .fn()
      .mockResolvedValueOnce([
        foundSource("angeloni", "https://super.angeloni.com.br/arroz", "Arroz R$ 10,00"),
      ])
      .mockResolvedValueOnce([
        failedSource("drogaria-venancio", "https://www.drogariavenancio.com.br/dipirona"),
      ]);
    const requestStructuredJson = vi.fn().mockResolvedValue({
      data: foundPrice("Arroz", 10, "https://super.angeloni.com.br/arroz"),
    });
    const estimate = createPriceEstimator({
      sourceCollector: { collect, search: vi.fn().mockResolvedValue([]) },
      deepSeek: { requestStructuredJson },
    });

    await expect(estimate(ITEMS)).resolves.toEqual({
      status: "partial",
      totalAmount: 20,
      itemsNotFound: ["Dipirona"],
      processedCount: 1,
      failedCount: 1,
    });
  });

  it("falha sem produzir estimativa quando todas as fontes falham para todos os itens", async () => {
    const collect = vi
      .fn()
      .mockImplementation((item: PendingPriceItem) => [
        failedSource("source", `https://example.com/${item.name.toLowerCase()}`),
      ]);
    const estimate = createPriceEstimator({
      sourceCollector: { collect, search: vi.fn().mockResolvedValue([]) },
      deepSeek: { requestStructuredJson: vi.fn() },
    });

    await expect(estimate(ITEMS)).rejects.toThrow(
      "Não foi possível consultar preços para nenhum item.",
    );
  });

  it("rejeita preço ou fonte fora da evidência retornada", async () => {
    const collect = vi
      .fn()
      .mockResolvedValue([
        foundSource("angeloni", "https://super.angeloni.com.br/arroz", "Arroz R$ 10,00"),
      ]);
    const requestStructuredJson = vi.fn(async ({ decode }) => ({
      data: decode({
        item: "Arroz",
        found: true,
        unitPrice: -1,
        sourceUrl: "https://example.com/inventado",
      }),
      model: "deepseek-v4-flash",
    }));
    const estimate = createPriceEstimator({
      sourceCollector: { collect, search: vi.fn().mockResolvedValue([]) },
      deepSeek: { requestStructuredJson },
    });

    await expect(estimate([ITEMS[0]!])).rejects.toThrow(
      "Não foi possível consultar preços para nenhum item.",
    );
  });

  it("rejeita item retornado que não corresponde ao item solicitado", async () => {
    const collect = vi
      .fn()
      .mockResolvedValue([
        foundSource("angeloni", "https://super.angeloni.com.br/arroz", "Arroz R$ 10,00"),
      ]);
    const requestStructuredJson = vi.fn(async ({ decode }) => ({
      data: decode({
        item: "Feijão",
        found: true,
        unitPrice: 10,
        sourceUrl: "https://super.angeloni.com.br/arroz",
      }),
      model: "deepseek-v4-flash",
    }));
    const estimate = createPriceEstimator({
      sourceCollector: { collect, search: vi.fn().mockResolvedValue([]) },
      deepSeek: { requestStructuredJson },
    });

    await expect(estimate([ITEMS[0]!])).rejects.toThrow(
      "Não foi possível consultar preços para nenhum item.",
    );
  });

  it.each([
    [
      "preço não positivo",
      {
        item: "Arroz",
        found: true,
        unitPrice: 0,
        sourceUrl: "https://super.angeloni.com.br/arroz",
      },
    ],
    [
      "fonte não fornecida",
      { item: "Arroz", found: true, unitPrice: 10, sourceUrl: "https://example.com/inventado" },
    ],
    [
      "campo extra",
      {
        item: "Arroz",
        found: true,
        unitPrice: 10,
        sourceUrl: "https://super.angeloni.com.br/arroz",
        reason: "não",
      },
    ],
  ])("rejeita %s no contrato final", async (_caseName, response) => {
    const collect = vi
      .fn()
      .mockResolvedValue([
        foundSource("angeloni", "https://super.angeloni.com.br/arroz", "Arroz R$ 10,00"),
      ]);
    const requestStructuredJson = vi.fn(async ({ decode }) => ({
      data: decode(response),
      model: "deepseek-v4-flash",
    }));
    const estimate = createPriceEstimator({
      sourceCollector: { collect, search: vi.fn().mockResolvedValue([]) },
      deepSeek: { requestStructuredJson },
    });

    await expect(estimate([ITEMS[0]!])).rejects.toThrow(
      "Não foi possível consultar preços para nenhum item.",
    );
  });

  it("aceita found=false somente com o item solicitado e campos nulos", async () => {
    const collect = vi
      .fn()
      .mockResolvedValue([
        foundSource("angeloni", "https://super.angeloni.com.br/arroz", "Arroz indisponível"),
      ]);
    const requestStructuredJson = vi.fn(async ({ decode }) => ({
      data: decode(notFoundPrice("arroz")),
      model: "deepseek-v4-flash",
    }));
    const estimate = createPriceEstimator({
      sourceCollector: { collect, search: vi.fn().mockResolvedValue([]) },
      deepSeek: { requestStructuredJson },
    });

    await expect(estimate([ITEMS[0]!])).resolves.toMatchObject({
      status: "partial",
      itemsNotFound: ["Arroz"],
    });
    expect(requestStructuredJson).toHaveBeenCalledTimes(1);
  });

  it("descreve no prompt as regras de promoção, ambiguidade e indisponibilidade", async () => {
    const collect = vi
      .fn()
      .mockResolvedValue([
        foundSource("angeloni", "https://super.angeloni.com.br/arroz", "Arroz R$ 10,00"),
      ]);
    const requestStructuredJson = vi.fn().mockResolvedValue({
      data: foundPrice("Arroz", 9.5, "https://super.angeloni.com.br/arroz"),
    });
    const estimate = createPriceEstimator({
      sourceCollector: { collect, search: vi.fn().mockResolvedValue([]) },
      deepSeek: { requestStructuredJson },
    });

    await estimate([ITEMS[0]!]);

    const instruction = JSON.parse(
      String(requestStructuredJson.mock.calls[0]?.[0].messages[1]?.content),
    ).instruction as string;
    expect(instruction).toContain("promoção claramente vigente");
    expect(instruction).toContain("preços conflitantes");
    expect(instruction).toContain("itens indisponíveis");
  });

  it("faz uma única recuperação quando o DeepSeek retorna resposta inválida", async () => {
    const collect = vi
      .fn()
      .mockResolvedValue([
        foundSource("angeloni", "https://super.angeloni.com.br/arroz", "Arroz R$ 10,00"),
      ]);
    const invalidResponse = new IntegrationError({
      code: "invalid_response_error",
      provider: "deepseek",
      message: "resposta inválida",
      cause: "conteúdo interno",
    });
    const requestStructuredJson = vi
      .fn()
      .mockRejectedValueOnce(invalidResponse)
      .mockResolvedValueOnce({
        data: foundPrice("Arroz", 10, "https://super.angeloni.com.br/arroz"),
      });
    const estimate = createPriceEstimator({
      sourceCollector: { collect, search: vi.fn().mockResolvedValue([]) },
      deepSeek: { requestStructuredJson },
    });

    await expect(estimate([ITEMS[0]!])).resolves.toMatchObject({
      status: "complete",
      totalAmount: 20,
    });
    expect(requestStructuredJson).toHaveBeenCalledTimes(2);

    const firstPayload = JSON.parse(
      String(requestStructuredJson.mock.calls[0]?.[0].messages[1]?.content),
    );
    const secondPayload = JSON.parse(
      String(requestStructuredJson.mock.calls[1]?.[0].messages[1]?.content),
    );
    expect(secondPayload.evidence).toEqual(firstPayload.evidence);
    expect(secondPayload.instruction).toContain("A resposta anterior era inválida");
  });

  it("encerra com falha segura sem tentar uma terceira chamada", async () => {
    const collect = vi
      .fn()
      .mockResolvedValue([
        foundSource("angeloni", "https://super.angeloni.com.br/arroz", "Arroz R$ 10,00"),
      ]);
    const invalidResponse = new IntegrationError({
      code: "invalid_response_error",
      provider: "deepseek",
      message: "resposta inválida",
    });
    const requestStructuredJson = vi.fn().mockRejectedValue(invalidResponse);
    const estimate = createPriceEstimator({
      sourceCollector: { collect, search: vi.fn().mockResolvedValue([]) },
      deepSeek: { requestStructuredJson },
    });

    await expect(estimate([ITEMS[0]!])).rejects.toThrow(
      "Não foi possível consultar preços para nenhum item.",
    );
    expect(requestStructuredJson).toHaveBeenCalledTimes(2);
  });

  it("não repete falhas de transporte do DeepSeek", async () => {
    const collect = vi
      .fn()
      .mockResolvedValue([
        foundSource("angeloni", "https://super.angeloni.com.br/arroz", "Arroz R$ 10,00"),
      ]);
    const providerError = new IntegrationError({
      code: "provider_error",
      provider: "deepseek",
      message: "falha interna segura",
      cause: "segredo interno",
    });
    const requestStructuredJson = vi.fn().mockRejectedValue(providerError);
    const estimate = createPriceEstimator({
      sourceCollector: { collect, search: vi.fn().mockResolvedValue([]) },
      deepSeek: { requestStructuredJson },
    });

    await expect(estimate([ITEMS[0]!])).rejects.toThrow(
      "Não foi possível consultar preços para nenhum item.",
    );
    expect(requestStructuredJson).toHaveBeenCalledTimes(1);
    await expect(estimate([ITEMS[0]!])).rejects.not.toThrow("segredo interno");
  });
});
