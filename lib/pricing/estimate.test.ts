import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { IntegrationError } from "@/lib/integrations/errors";
import { createPriceEstimator, type PendingPriceItem } from "@/lib/pricing/estimate";

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

describe("createPriceEstimator", () => {
  it("orquestra busca e estruturação por item e calcula o total preliminar", async () => {
    const search = vi
      .fn()
      .mockResolvedValueOnce({
        results: [
          {
            url: "https://super.angeloni.com.br/arroz",
            title: "Arroz",
            markdown: "Arroz R$ 10,00",
          },
        ],
      })
      .mockResolvedValueOnce({
        results: [
          {
            url: "https://www.drogariavenancio.com.br/dipirona",
            title: "Dipirona",
            markdown: "Dipirona R$ 8,50",
          },
        ],
      });
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
    const estimate = createPriceEstimator({
      firecrawl: { search },
      deepSeek: { requestStructuredJson },
    });

    await expect(estimate(ITEMS)).resolves.toEqual({
      status: "complete",
      totalAmount: 28.5,
      itemsNotFound: [],
      processedCount: 2,
      failedCount: 0,
    });

    expect(search).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        query: "Arroz",
        includeDomains: ["super.angeloni.com.br", "www.supermuffato.com.br", "www.zonasul.com.br"],
        includeContent: true,
      }),
    );
    expect(search).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        query: "Dipirona",
        includeDomains: ["www.drogariavenancio.com.br"],
      }),
    );
    expect(requestStructuredJson).toHaveBeenCalledTimes(2);
  });

  it("marca item sem resultado como não encontrado sem chamar o DeepSeek", async () => {
    const search = vi.fn().mockResolvedValue({ results: [] });
    const requestStructuredJson = vi.fn();
    const estimate = createPriceEstimator({
      firecrawl: { search },
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

  it("descarta resultados fora dos domínios aprovados antes da extração", async () => {
    const search = vi.fn().mockResolvedValue({
      results: [
        {
          url: "https://example.com/arroz",
          markdown: "Arroz R$ 1,00",
        },
      ],
    });
    const requestStructuredJson = vi.fn();
    const estimate = createPriceEstimator({
      firecrawl: { search },
      deepSeek: { requestStructuredJson },
    });

    await expect(estimate([ITEMS[0]!])).resolves.toMatchObject({
      status: "partial",
      totalAmount: 0,
      itemsNotFound: ["Arroz"],
    });
    expect(requestStructuredJson).not.toHaveBeenCalled();
  });

  it("mantém resultados úteis quando somente um item falha no provedor", async () => {
    const search = vi
      .fn()
      .mockResolvedValueOnce({
        results: [
          {
            url: "https://super.angeloni.com.br/arroz",
            markdown: "Arroz R$ 10,00",
          },
        ],
      })
      .mockRejectedValueOnce(
        new IntegrationError({
          code: "provider_error",
          provider: "firecrawl",
          message: "Falha segura",
          retryable: true,
        }),
      );
    const requestStructuredJson = vi.fn().mockResolvedValue({
      data: {
        found: true,
        unitPrice: 10,
        sourceUrl: "https://super.angeloni.com.br/arroz",
      },
    });
    const estimate = createPriceEstimator({
      firecrawl: { search },
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

  it("falha sem produzir estimativa quando todos os provedores falham", async () => {
    const search = vi.fn().mockRejectedValue(
      new IntegrationError({
        code: "timeout_error",
        provider: "firecrawl",
        message: "Timeout seguro",
        retryable: true,
      }),
    );
    const estimate = createPriceEstimator({
      firecrawl: { search },
      deepSeek: { requestStructuredJson: vi.fn() },
    });

    await expect(estimate(ITEMS)).rejects.toThrow(
      "Não foi possível consultar preços para nenhum item.",
    );
  });

  it("rejeita preço ou fonte fora da evidência retornada", async () => {
    const search = vi.fn().mockResolvedValue({
      results: [
        {
          url: "https://super.angeloni.com.br/arroz",
          markdown: "Arroz R$ 10,00",
        },
      ],
    });
    const requestStructuredJson = vi.fn(async ({ decode }) => ({
      data: decode({
        found: true,
        unitPrice: -1,
        sourceUrl: "https://example.com/inventado",
      }),
      model: "deepseek-v4-flash",
    }));
    const estimate = createPriceEstimator({
      firecrawl: { search },
      deepSeek: { requestStructuredJson },
    });

    await expect(estimate([ITEMS[0]!])).rejects.toThrow(
      "Não foi possível consultar preços para nenhum item.",
    );
  });
});
