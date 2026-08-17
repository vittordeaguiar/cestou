import "server-only";

import {
  deepSeekClient,
  type StructuredJsonRequest,
  type StructuredJsonResponse,
} from "@/lib/integrations/deepseek";
import { IntegrationError } from "@/lib/integrations/errors";
import {
  sourceCollector,
  type SourceCollectionResult,
  type SourceCollectorPort,
  type SourceSearchResult,
} from "@/lib/pricing/source-collector";
import type { ItemCategory } from "@/types";

const MAX_EVIDENCE_CHARS_PER_SOURCE = 2_500;
const EXTRACTION_SYSTEM_PROMPT =
  "Responda somente com um objeto JSON válido. Extraia preço exclusivamente das evidências fornecidas; nunca estime, complete ou invente valores.";
const EXTRACTION_INSTRUCTION = [
  "Retorne exatamente os campos item, found, unitPrice e sourceUrl, sem markdown ou texto adicional.",
  "Repita em item o nome solicitado.",
  "Use found=true somente quando houver um preço atual, positivo e inequivocamente associado ao item e à apresentação solicitada.",
  "Converta o preço para número em reais, usando ponto decimal e sem o símbolo R$.",
  "Quando houver promoção claramente vigente e aplicável ao item, use o preço promocional atual e ignore o preço antigo.",
  "Rejeite preços conflitantes, variantes ou apresentações ambíguas, promoções condicionais não confirmadas e itens indisponíveis.",
  "Se não houver preço inequívoco, retorne found=false, unitPrice=null e sourceUrl=null.",
  "Quando found=true, use exatamente uma sourceUrl presente nas evidências.",
].join(" ");
const EXTRACTION_REPAIR_INSTRUCTION = `${EXTRACTION_INSTRUCTION} A resposta anterior era inválida. Corrija o formato e retorne somente o objeto JSON exato, sem adicionar campos.`;
const EXTRACTION_FIELDS = new Set(["item", "found", "unitPrice", "sourceUrl"]);

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
  item: string;
  found: boolean;
  unitPrice: number | null;
  sourceUrl: string | null;
};

type ItemEstimate =
  { kind: "found"; subtotal: number } | { kind: "not_found" } | { kind: "failed" };

type SourceEvidenceResult = SourceCollectionResult | SourceSearchResult;
type FoundSourceCollectionResult = Extract<SourceCollectionResult, { status: "found" }>;
type FoundSourceSearchResult = Extract<SourceSearchResult, { status: "found" }>;
type FoundSourceResult = FoundSourceCollectionResult | FoundSourceSearchResult;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFoundSourceCollectionResult(
  result: SourceCollectionResult,
): result is FoundSourceCollectionResult {
  return result.status === "found";
}

function isFoundSourceSearchResult(result: SourceSearchResult): result is FoundSourceSearchResult {
  return result.status === "found";
}

function isFailedSourceResult(result: SourceEvidenceResult) {
  return result.status === "failed";
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeItemName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

function formatEvidence(results: readonly FoundSourceResult[]) {
  return results.map((result, index) => ({
    index: index + 1,
    sourceId: result.sourceId,
    url: result.sourceUrl,
    locationStatus: result.locationStatus,
    content: result.content.slice(0, MAX_EVIDENCE_CHARS_PER_SOURCE),
  }));
}

function decodeExtractedPrice(
  value: unknown,
  requestedItem: string,
  allowedUrls: ReadonlySet<string>,
): ExtractedPrice {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== EXTRACTION_FIELDS.size ||
    Object.keys(value).some((key) => !EXTRACTION_FIELDS.has(key)) ||
    typeof value.item !== "string" ||
    normalizeItemName(value.item) !== normalizeItemName(requestedItem)
  ) {
    throw new TypeError("Resposta de preço inválida.");
  }

  if (typeof value.found !== "boolean") {
    throw new TypeError("Resposta de preço inválida.");
  }

  if (!value.found) {
    if (value.unitPrice !== null || value.sourceUrl !== null) {
      throw new TypeError("Resposta de preço inválida.");
    }
    return { item: requestedItem, found: false, unitPrice: null, sourceUrl: null };
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
    item: requestedItem,
    found: true,
    unitPrice: value.unitPrice,
    sourceUrl: value.sourceUrl,
  };
}

function buildExtractionRequest(
  item: PendingPriceItem,
  sourceResults: readonly FoundSourceResult[],
  mode: "initial" | "repair" = "initial",
) {
  const evidence = formatEvidence(sourceResults);
  const allowedUrls = new Set(evidence.map((result) => result.url));
  const instruction = mode === "repair" ? EXTRACTION_REPAIR_INSTRUCTION : EXTRACTION_INSTRUCTION;

  return {
    messages: [
      {
        role: "system" as const,
        content: EXTRACTION_SYSTEM_PROMPT,
      },
      {
        role: "user" as const,
        content: JSON.stringify({
          instruction,
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
    decode: (value: unknown) => decodeExtractedPrice(value, item.name, allowedUrls),
  } satisfies StructuredJsonRequest<ExtractedPrice>;
}

async function requestPriceExtraction(
  deepSeek: DeepSeekPort,
  item: PendingPriceItem,
  sourceResults: readonly FoundSourceResult[],
) {
  try {
    return await deepSeek.requestStructuredJson(buildExtractionRequest(item, sourceResults));
  } catch (error) {
    if (
      !(error instanceof IntegrationError) ||
      error.provider !== "deepseek" ||
      error.code !== "invalid_response_error"
    ) {
      throw error;
    }

    return deepSeek.requestStructuredJson(buildExtractionRequest(item, sourceResults, "repair"));
  }
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
          let allSources: SourceEvidenceResult[] = collection;
          let foundSources: FoundSourceResult[] = collection.filter(isFoundSourceCollectionResult);

          if (foundSources.length === 0) {
            const genericSearchResults = await dependencies.sourceCollector.search({
              name: item.name,
              category: item.category,
            });
            allSources = [...collection, ...genericSearchResults];
            foundSources = genericSearchResults.filter(isFoundSourceSearchResult);
          }

          if (foundSources.length === 0) {
            return allSources.length > 0 && allSources.every(isFailedSourceResult)
              ? { kind: "failed" }
              : { kind: "not_found" };
          }

          const extraction = await requestPriceExtraction(
            dependencies.deepSeek,
            item,
            foundSources,
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
