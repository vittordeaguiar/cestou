import { describe, expect, it } from "vitest";

import {
  PRICE_SOURCES,
  buildPriceSourceSearchUrl,
  getEnabledPriceSources,
  type PriceSourceCategory,
} from "@/lib/pricing/sources";

describe("PRICE_SOURCES", () => {
  it("mantém IDs únicos e categorias suportadas", () => {
    const ids = PRICE_SOURCES.map((source) => source.id);
    const categories = new Set<PriceSourceCategory>(["mercado", "farmacia"]);

    expect(new Set(ids).size).toBe(ids.length);
    for (const source of PRICE_SOURCES) {
      expect(categories.has(source.category)).toBe(true);
    }
  });

  it("usa URLs HTTPS válidas cujo host corresponde ao domínio declarado", () => {
    for (const source of PRICE_SOURCES) {
      const url = new URL(source.search.baseUrl);
      expect(url.protocol).toBe("https:");
      expect(url.hostname).toBe(source.domain);
    }
  });

  it("mantém configuração mínima completa nas fontes habilitadas", () => {
    const enabled = getEnabledPriceSources();

    expect(enabled).toHaveLength(4);
    for (const source of enabled) {
      expect(source.maturity).toBe("approved");
      expect(source.priority).toBeGreaterThan(0);
      expect(source.location.required).toBe(true);
      expect(source.location.notes.length).toBeGreaterThan(0);
      expect(source.limitations.length).toBeGreaterThan(0);
    }
  });

  it("filtra fontes habilitadas por categoria sem incluir experimentais", () => {
    expect(getEnabledPriceSources("mercado").map((source) => source.id)).toEqual([
      "angeloni",
      "super-muffato",
      "zona-sul",
    ]);
    expect(getEnabledPriceSources("farmacia").map((source) => source.id)).toEqual([
      "drogaria-venancio",
    ]);
  });

  it("constrói busca por path codificando caracteres especiais em um segmento", () => {
    const source = PRICE_SOURCES.find(({ id }) => id === "angeloni");
    expect(source).toBeDefined();
    if (!source) return;

    const url = buildPriceSourceSearchUrl(source, "  café & leite/zero? #1  ");

    expect(url.origin).toBe("https://super.angeloni.com.br");
    expect(url.pathname).toBe("/caf%C3%A9%20%26%20leite%2Fzero%3F%20%231");
    expect(url.search).toBe("");
  });

  it("constrói busca por query sem permitir injeção de parâmetros", () => {
    const source = PRICE_SOURCES.find(({ id }) => id === "drogasil");
    expect(source).toBeDefined();
    if (!source) return;

    const url = buildPriceSourceSearchUrl(source, "dipirona & page=99#fim");

    expect(url.origin).toBe("https://www.drogasil.com.br");
    expect(url.pathname).toBe("/search");
    expect(url.searchParams.get("w")).toBe("dipirona & page=99#fim");
    expect(url.searchParams.has("page")).toBe(false);
    expect(url.hash).toBe("");
  });

  it("rejeita nomes vazios", () => {
    expect(() => buildPriceSourceSearchUrl(PRICE_SOURCES[0], "   ")).toThrow(
      "O item da busca não pode ser vazio.",
    );
  });
});
