import "server-only";

import {
  deepSeekClient,
  type StructuredJsonRequest,
  type StructuredJsonResponse,
} from "@/lib/integrations/deepseek";
import {
  firecrawlClient,
  type FirecrawlSearchInput,
  type FirecrawlSearchResponse,
} from "@/lib/integrations/firecrawl";
import { getEnabledPriceSources } from "@/lib/pricing/sources";
import type { ItemCategory } from "@/types";

const SEARCH_RESULTS_PER_ITEM = 4;
const MAX_EVIDENCE_CHARS_PER_RESULT = 2_500;

export type PendingPriceItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string | null;
  category: ItemCategory | null;
};

export type PriceEstimateResult = {
  status: "complete" | "partial";
  totalAmount: number;
  itemsNotFound: string[];
  processedCount: number;
  failedCount: number;
};

type FirecrawlPort = {
  search(input: FirecrawlSearchInput): Promise<FirecrawlSearchResponse>;
};

type DeepSeekPort = {
  requestStructuredJson<T>(request: StructuredJsonRequest<T>): Promise<StructuredJsonResponse<T>>;
};

type PriceEstimatorDependencies = {
  firecrawl: FirecrawlPort;
  deepSeek: DeepSeekPort;
};

type ExtractedPrice = {
  found: boolean;
  unitPrice: number | null;
  sourceUrl: string | null;
};

type ItemEstimate =
  { kind: "found"; subtotal: number } | { kind: "not_found" } | { kind: "failed" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sourceDomainsFor(category: ItemCategory | null) {
  const sourceCategory = category === "mercado" || category === "farmacia" ? category : undefined;
  return getEnabledPriceSources(sourceCategory).map((source) => source.domain);
}

function filterAllowedResults(
  response: FirecrawlSearchResponse,
  allowedDomains: readonly string[],
) {
  const domains = new Set(allowedDomains);
  return {
    ...response,
    results: response.results.filter((result) => {
      try {
        const url = new URL(result.url);
        return (url.protocol === "https:" || url.protocol === "http:") && domains.has(url.hostname);
      } catch {
        return false;
      }
    }),
  };
}

function formatEvidence(response: FirecrawlSearchResponse) {
  return response.results.map((result, index) => ({
    index: index + 1,
    url: result.url,
    title: result.title?.slice(0, 300) ?? null,
    description: result.description?.slice(0, 500) ?? null,
    content: result.markdown?.slice(0, MAX_EVIDENCE_CHARS_PER_RESULT) ?? null,
  }));
}

function decodeExtractedPrice(value: unknown, allowedUrls: ReadonlySet<string>): ExtractedPrice {
  if (!isRecord(value)) {
    throw new TypeError("Resposta de preço inválida.");
  }

  if (typeof value.found !== "boolean") {
    throw new TypeError("Resposta de preço inválida.");
  }

  if (!value.found) {
    if (value.unitPrice !== null || value.sourceUrl !== null) {
      throw new TypeError("Resposta de preço inválida.");
    }
    return { found: false, unitPrice: null, sourceUrl: null };
  }

  if (
    typeof value.unitPrice !== "number" ||
    !Number.isFinite(value.unitPrice) ||
    value.unitPrice <= 0 ||
    typeof value.sourceUrl !== "string" ||
    !allowedUrls.has(value.sourceUrl)
  ) {
    throw new TypeError("Resposta de preço inválida.");
  }

  return {
    found: true,
    unitPrice: value.unitPrice,
    sourceUrl: value.sourceUrl,
  };
}

function buildExtractionRequest(item: PendingPriceItem, response: FirecrawlSearchResponse) {
  const evidence = formatEvidence(response);
  const allowedUrls = new Set(response.results.map((result) => result.url));

  return {
    messages: [
      {
        role: "system" as const,
        content:
          "Responda somente em JSON. Extraia um preço unitário apenas das evidências fornecidas; nunca estime ou invente valores.",
      },
      {
        role: "user" as const,
        content: JSON.stringify({
          instruction:
            "Retorne {found:boolean,unitPrice:number|null,sourceUrl:string|null}. Use exatamente uma sourceUrl fornecida. Se não houver preço inequívoco, retorne found=false e campos nulos.",
          item: {
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
          },
          evidence,
        }),
      },
    ],
    maxTokens: 256,
    decode: (value: unknown) => decodeExtractedPrice(value, allowedUrls),
  } satisfies StructuredJsonRequest<ExtractedPrice>;
}

export function createPriceEstimator(dependencies: PriceEstimatorDependencies) {
  return async function estimate(items: readonly PendingPriceItem[]): Promise<PriceEstimateResult> {
    const itemResults = await Promise.all(
      items.map(async (item): Promise<ItemEstimate> => {
        try {
          const allowedDomains = sourceDomainsFor(item.category);
          const rawSearchResponse = await dependencies.firecrawl.search({
            query: item.name,
            limit: SEARCH_RESULTS_PER_ITEM,
            includeDomains: allowedDomains,
            includeContent: true,
          });
          const searchResponse = filterAllowedResults(rawSearchResponse, allowedDomains);

          if (searchResponse.results.length === 0) {
            return { kind: "not_found" };
          }

          const extraction = await dependencies.deepSeek.requestStructuredJson(
            buildExtractionRequest(item, searchResponse),
          );

          if (!extraction.data.found || extraction.data.unitPrice === null) {
            return { kind: "not_found" };
          }

          return {
            kind: "found",
            subtotal: roundCurrency(extraction.data.unitPrice * item.quantity),
          };
        } catch {
          return { kind: "failed" };
        }
      }),
    );

    const failedCount = itemResults.filter((result) => result.kind === "failed").length;
    if (items.length > 0 && failedCount === items.length) {
      throw new Error("Não foi possível consultar preços para nenhum item.");
    }

    const itemsNotFound = items
      .filter((_item, index) => itemResults[index]?.kind !== "found")
      .map((item) => item.name);
    const totalAmount = roundCurrency(
      itemResults.reduce(
        (total, result) => total + (result.kind === "found" ? result.subtotal : 0),
        0,
      ),
    );

    return {
      status: itemsNotFound.length > 0 ? "partial" : "complete",
      totalAmount,
      itemsNotFound,
      processedCount: items.length - failedCount,
      failedCount,
    };
  };
}

export const estimatePendingItems = createPriceEstimator({
  firecrawl: firecrawlClient,
  deepSeek: deepSeekClient,
});
