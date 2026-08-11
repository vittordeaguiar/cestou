export type PriceSourceCategory = "mercado" | "farmacia";
export type PriceSourceMaturity = "approved" | "experimental";
export type PriceSourceLocationKind = "cep" | "store" | "regional";

type PathSearch = {
  kind: "path";
  baseUrl: string;
};

type QuerySearch = {
  kind: "query";
  baseUrl: string;
  pathname: string;
  queryParameter: string;
};

export type PriceSource = {
  id: string;
  name: string;
  domain: string;
  category: PriceSourceCategory;
  enabled: boolean;
  maturity: PriceSourceMaturity;
  priority: number;
  search: PathSearch | QuerySearch;
  location: {
    required: boolean;
    kind: PriceSourceLocationKind;
    notes: string;
  };
  requiresJavaScript: boolean;
  limitations: readonly string[];
};

export const PRICE_SOURCES = [
  {
    id: "angeloni",
    name: "Angeloni",
    domain: "super.angeloni.com.br",
    category: "mercado",
    enabled: true,
    maturity: "approved",
    priority: 10,
    search: { kind: "path", baseUrl: "https://super.angeloni.com.br/" },
    location: {
      required: true,
      kind: "store",
      notes: "Preço e disponibilidade dependem da loja ou região selecionada.",
    },
    requiresJavaScript: true,
    limitations: [
      "Catálogo regional.",
      "Ofertas podem depender do Clube Angeloni ou da forma de pagamento.",
    ],
  },
  {
    id: "super-muffato",
    name: "Super Muffato",
    domain: "www.supermuffato.com.br",
    category: "mercado",
    enabled: true,
    maturity: "approved",
    priority: 20,
    search: { kind: "path", baseUrl: "https://www.supermuffato.com.br/" },
    location: {
      required: true,
      kind: "store",
      notes: "A loja escolhida define o catálogo, o preço e a área de entrega.",
    },
    requiresJavaScript: true,
    limitations: [
      "Entrega limitada à área atendida pela loja.",
      "Itens de peso variável podem ter o preço final ajustado.",
    ],
  },
  {
    id: "zona-sul",
    name: "Zona Sul",
    domain: "www.zonasul.com.br",
    category: "mercado",
    enabled: true,
    maturity: "approved",
    priority: 30,
    search: { kind: "path", baseUrl: "https://www.zonasul.com.br/" },
    location: {
      required: true,
      kind: "cep",
      notes: "Preço, estoque e entrega são específicos da região atendida no Rio de Janeiro.",
    },
    requiresJavaScript: true,
    limitations: [
      "Cobertura geográfica regional.",
      "Preços do site e aplicativo podem divergir das lojas físicas.",
    ],
  },
  {
    id: "drogaria-venancio",
    name: "Drogaria Venancio",
    domain: "www.drogariavenancio.com.br",
    category: "farmacia",
    enabled: true,
    maturity: "approved",
    priority: 10,
    search: {
      kind: "path",
      baseUrl: "https://www.drogariavenancio.com.br/",
    },
    location: {
      required: true,
      kind: "cep",
      notes: "Estoque, entrega e algumas ofertas dependem do CEP.",
    },
    requiresJavaScript: true,
    limitations: ["Atuação regional.", "Descontos promocionais podem exigir quantidade mínima."],
  },
  {
    id: "drogasil",
    name: "Drogasil",
    domain: "www.drogasil.com.br",
    category: "farmacia",
    enabled: false,
    maturity: "experimental",
    priority: 20,
    search: {
      kind: "query",
      baseUrl: "https://www.drogasil.com.br/",
      pathname: "/search",
      queryParameter: "w",
    },
    location: {
      required: true,
      kind: "cep",
      notes: "Preços, benefícios e disponibilidade dependem da localização.",
    },
    requiresJavaScript: true,
    limitations: [
      "O teste exploratório exibiu produtos, mas não preços no conteúdo principal extraído.",
      "Requer validação real com renderização do Firecrawl antes de habilitar.",
    ],
  },
  {
    id: "araujo",
    name: "Drogaria Araujo",
    domain: "www.araujo.com.br",
    category: "farmacia",
    enabled: false,
    maturity: "experimental",
    priority: 30,
    search: {
      kind: "query",
      baseUrl: "https://www.araujo.com.br/",
      pathname: "/busca",
      queryParameter: "q",
    },
    location: {
      required: true,
      kind: "cep",
      notes: "Entrega, disponibilidade e ofertas podem variar por CEP.",
    },
    requiresJavaScript: true,
    limitations: [
      "O catálogo indexado contém preços, mas a requisição exploratória direta retornou HTTP 403.",
      "Robots.txt não pôde ser confirmado; não habilitar sem revisão manual.",
    ],
  },
] as const satisfies readonly PriceSource[];

export function buildPriceSourceSearchUrl(source: PriceSource, itemName: string) {
  const query = itemName.trim();
  if (!query) throw new TypeError("O item da busca não pode ser vazio.");

  if (source.search.kind === "query") {
    const url = new URL(source.search.pathname, source.search.baseUrl);
    url.searchParams.set(source.search.queryParameter, query);
    return url;
  }

  const url = new URL(source.search.baseUrl);
  const basePath = url.pathname.replace(/\/+$/, "");
  url.pathname = `${basePath}/${encodeURIComponent(query)}`;
  return url;
}

export function getEnabledPriceSources(category?: PriceSourceCategory) {
  return PRICE_SOURCES.filter(
    (source) => source.enabled && (!category || source.category === category),
  );
}
