import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createPriceEstimator, type PendingPriceItem } from "@/lib/pricing/estimate";
import type { SourceCollectionResult } from "@/lib/pricing/source-collector";

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
          found: true,
          unitPrice: 10,
          sourceUrl: "https://super.angeloni.com.br/arroz",
        },
      })
      .mockResolvedValueOnce({
        data: {
          found: true,
          unitPrice: 8.5,
          sourceUrl: "https://www.drogariavenancio.com.br/dipirona",
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
      sourceCollector: { collect },
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

  it("não encaminha ao DeepSeek uma coleta sem fontes encontradas", async () => {
    const collect = vi
      .fn()
      .mockResolvedValue([
        failedSource("angeloni", "https://super.angeloni.com.br/arroz"),
        notFoundSource("super-muffato", "https://www.supermuffato.com.br/arroz"),
      ]);
    const requestStructuredJson = vi.fn();
    const estimate = createPriceEstimator({
      sourceCollector: { collect },
      deepSeek: { requestStructuredJson },
    });

    await expect(estimate([ITEMS[0]!])).resolves.toMatchObject({
      status: "partial",
      totalAmount: 0,
      itemsNotFound: ["Arroz"],
      failedCount: 0,
    });
    expect(requestStructuredJson).not.toHaveBeenCalled();
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
      data: {
        found: true,
        unitPrice: 10,
        sourceUrl: returnedUrl,
      },
    });
    const estimate = createPriceEstimator({
      sourceCollector: { collect },
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
      data: {
        found: true,
        unitPrice: 10,
        sourceUrl: "https://super.angeloni.com.br/arroz",
      },
    });
    const estimate = createPriceEstimator({
      sourceCollector: { collect },
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
      sourceCollector: { collect },
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
        found: true,
        unitPrice: -1,
        sourceUrl: "https://example.com/inventado",
      }),
      model: "deepseek-v4-flash",
    }));
    const estimate = createPriceEstimator({
      sourceCollector: { collect },
      deepSeek: { requestStructuredJson },
    });

    await expect(estimate([ITEMS[0]!])).rejects.toThrow(
      "Não foi possível consultar preços para nenhum item.",
    );
  });
});
