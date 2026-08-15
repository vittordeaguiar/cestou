import "server-only";

import {
  deepSeekClient,
  type StructuredJsonRequest,
  type StructuredJsonResponse,
} from "@/lib/integrations/deepseek";
import {
  sourceCollector,
  type SourceCollectionResult,
  type SourceCollectorPort,
} from "@/lib/pricing/source-collector";
import type { ItemCategory } from "@/types";

const MAX_EVIDENCE_CHARS_PER_SOURCE = 2_500;

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

type DeepSeekPort = {
  requestStructuredJson<T>(request: StructuredJsonRequest<T>): Promise<StructuredJsonResponse<T>>;
};

type PriceEstimatorDependencies = {
  sourceCollector: SourceCollectorPort;
  deepSeek: DeepSeekPort;
};

type ExtractedPrice = {
  found: boolean;
  unitPrice: number | null;
  sourceUrl: string | null;
};

type ItemEstimate =
  { kind: "found"; subtotal: number } | { kind: "not_found" } | { kind: "failed" };

type FoundSourceCollectionResult = Extract<SourceCollectionResult, { status: "found" }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFoundSourceResult(
  result: SourceCollectionResult,
): result is FoundSourceCollectionResult {
  return result.status === "found";
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatEvidence(results: readonly FoundSourceCollectionResult[]) {
  return results.map((result, index) => ({
    index: index + 1,
    sourceId: result.sourceId,
    url: result.sourceUrl,
    locationStatus: result.locationStatus,
    content: result.content.slice(0, MAX_EVIDENCE_CHARS_PER_SOURCE),
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

function buildExtractionRequest(
  item: PendingPriceItem,
  sourceResults: readonly FoundSourceCollectionResult[],
) {
  const evidence = formatEvidence(sourceResults);
  const allowedUrls = new Set(evidence.map((result) => result.url));

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
          const collection = await dependencies.sourceCollector.collect({
            name: item.name,
            category: item.category,
          });
          const foundSources = collection.filter(isFoundSourceResult);

          if (foundSources.length === 0) {
            return collection.length > 0 && collection.every((result) => result.status === "failed")
              ? { kind: "failed" }
              : { kind: "not_found" };
          }

          const extraction = await dependencies.deepSeek.requestStructuredJson(
            buildExtractionRequest(item, foundSources),
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
  sourceCollector,
  deepSeek: deepSeekClient,
});
