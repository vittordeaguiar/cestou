import "server-only";

import {
  firecrawlClient,
  type FirecrawlScrapeResponse,
  type FirecrawlSearchInput,
  type FirecrawlSearchResponse,
} from "@/lib/integrations/firecrawl";
import { IntegrationError, type IntegrationErrorCode } from "@/lib/integrations/errors";
import {
  buildPriceSourceSearchUrl,
  getEnabledPriceSources,
  type PriceSource,
} from "@/lib/pricing/sources";
import type { ItemCategory } from "@/types";

const DEFAULT_MAX_CONCURRENT_SCRAPES = 2;
const GENERIC_SEARCH_SOURCE_ID = "firecrawl-search";
const GENERIC_SEARCH_LIMIT = 5;
const BRAZILIAN_PRICE_PATTERN = /R\$\s*(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{2})?(?!\d)/i;
export const MAX_NORMALIZED_SOURCE_CONTENT_CHARS = 2_500;

export type SourceCollectionItem = {
  name: string;
  category: ItemCategory | null;
};

export type SourceLocationStatus = "resolved" | "unresolved";

export type SourceCollectionResult =
  | {
      status: "found";
      sourceId: string;
      searchUrl: string;
      sourceUrl: string;
      content: string;
      locationStatus: SourceLocationStatus;
    }
  | {
      status: "not_found";
      sourceId: string;
      searchUrl: string;
      locationStatus: SourceLocationStatus;
    }
  | {
      status: "failed";
      sourceId: string;
      searchUrl: string;
      errorCode: IntegrationErrorCode;
      retryable: boolean;
      locationStatus: SourceLocationStatus;
    };

export type FirecrawlScrapePort = {
  scrape(url: string): Promise<FirecrawlScrapeResponse>;
};

export type FirecrawlSearchPort = {
  search(input: FirecrawlSearchInput): Promise<FirecrawlSearchResponse>;
};

export type SourceSearchResult =
  | {
      status: "found";
      sourceId: typeof GENERIC_SEARCH_SOURCE_ID;
      searchQuery: string;
      sourceUrl: string;
      content: string;
      locationStatus: "unresolved";
    }
  | {
      status: "not_found";
      sourceId: typeof GENERIC_SEARCH_SOURCE_ID;
      searchQuery: string;
      locationStatus: "unresolved";
    }
  | {
      status: "failed";
      sourceId: typeof GENERIC_SEARCH_SOURCE_ID;
      searchQuery: string;
      errorCode: IntegrationErrorCode;
      retryable: boolean;
      locationStatus: "unresolved";
    };

export type SourceCollectorPort = {
  collect(item: SourceCollectionItem): Promise<SourceCollectionResult[]>;
  search(item: SourceCollectionItem): Promise<SourceSearchResult[]>;
};

type SourceCollectorOptions = {
  firecrawl: FirecrawlScrapePort & FirecrawlSearchPort;
  maxConcurrentScrapes?: number;
};

type PendingTask = {
  task: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

function sourceCategoryFor(category: ItemCategory | null) {
  return category === "mercado" || category === "farmacia" ? category : undefined;
}

function sortSourcesByPriority(sources: readonly PriceSource[]) {
  return [...sources].sort(
    (left, right) => left.priority - right.priority || left.id.localeCompare(right.id),
  );
}

function normalizeLine(line: string) {
  return line.replace(/[ \t]+/g, " ").trim();
}

function normalizeForMatching(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function itemTerms(value: string) {
  return (
    normalizeForMatching(value)
      .match(/[\p{L}\p{N}]+/gu)
      ?.filter((term) => term.length > 1) ?? []
  );
}

function hasRelevantItemTerm(itemName: string, value: string) {
  const terms = itemTerms(itemName);
  const valueTerms = new Set(normalizeForMatching(value).match(/[\p{L}\p{N}]+/gu) ?? []);
  return terms.length > 0 && terms.some((term) => valueTerms.has(term));
}

function validateSearchResultUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }

  if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) {
    return undefined;
  }

  return url.toString();
}

function normalizeSearchResultContent(result: FirecrawlSearchResponse["results"][number]) {
  return normalizePriceSourceMarkdown(
    [result.title, result.description, result.markdown].filter(Boolean).join("\n"),
  );
}

export function normalizePriceSourceMarkdown(
  markdown: string,
  maxChars = MAX_NORMALIZED_SOURCE_CONTENT_CHARS,
) {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n").map(normalizeLine).filter(Boolean);
  const compactLines: string[] = [];

  for (const line of lines) {
    if (compactLines.at(-1) !== line) compactLines.push(line);
  }

  return compactLines.join("\n").slice(0, maxChars);
}

function invalidReturnedUrl(message: string) {
  return new IntegrationError({
    code: "invalid_response_error",
    provider: "firecrawl",
    message,
  });
}

function validateReturnedUrl(source: PriceSource, value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch (cause) {
    throw new IntegrationError({
      code: "invalid_response_error",
      provider: "firecrawl",
      message: "O Firecrawl retornou uma URL inválida.",
      cause,
    });
  }

  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.hostname !== source.domain ||
    url.username ||
    url.password
  ) {
    throw invalidReturnedUrl("O Firecrawl retornou uma URL fora do domínio configurado.");
  }

  return url.toString();
}

function errorDetails(error: unknown) {
  if (error instanceof IntegrationError) {
    return { errorCode: error.code, retryable: error.retryable };
  }

  return { errorCode: "provider_error" as const, retryable: false };
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  maxConcurrent: number,
  mapper: (value: T) => Promise<R>,
) {
  const results: R[] = new Array(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index]!);
    }
  }

  const workerCount = Math.min(maxConcurrent, values.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function createFifoLimiter(maxConcurrent: number) {
  let activeCount = 0;
  const pendingTasks: PendingTask[] = [];

  function drain() {
    while (activeCount < maxConcurrent && pendingTasks.length > 0) {
      const pendingTask = pendingTasks.shift()!;
      activeCount += 1;

      void pendingTask
        .task()
        .then(pendingTask.resolve, pendingTask.reject)
        .finally(() => {
          activeCount -= 1;
          drain();
        });
    }
  }

  return function run<T>(task: () => Promise<T>) {
    return new Promise<T>((resolve, reject) => {
      pendingTasks.push({
        task: async () => task(),
        resolve: (value) => resolve(value as T),
        reject,
      });
      drain();
    });
  };
}

export function createPriceSourceCollector({
  firecrawl,
  maxConcurrentScrapes = DEFAULT_MAX_CONCURRENT_SCRAPES,
}: SourceCollectorOptions): SourceCollectorPort {
  if (!Number.isInteger(maxConcurrentScrapes) || maxConcurrentScrapes < 1) {
    throw new TypeError("A concorrência do coletor deve ser um inteiro positivo.");
  }

  const runWithFirecrawlPermit = createFifoLimiter(maxConcurrentScrapes);

  return {
    async collect(item) {
      if (!item.name.trim()) {
        throw new TypeError("O item da coleta não pode ser vazio.");
      }

      const sources = sortSourcesByPriority(
        getEnabledPriceSources(sourceCategoryFor(item.category)),
      );
      return mapWithConcurrency(sources, maxConcurrentScrapes, async (source) => {
        const searchUrl = buildPriceSourceSearchUrl(source, item.name).toString();
        const locationStatus: SourceLocationStatus = source.location.required
          ? "unresolved"
          : "resolved";

        try {
          return await runWithFirecrawlPermit(async () => {
            const response = await firecrawl.scrape(searchUrl);
            const sourceUrl = validateReturnedUrl(source, response.url);
            const content = normalizePriceSourceMarkdown(response.markdown);

            if (!content) {
              return {
                status: "not_found" as const,
                sourceId: source.id,
                searchUrl,
                locationStatus,
              };
            }

            return {
              status: "found" as const,
              sourceId: source.id,
              searchUrl,
              sourceUrl,
              content,
              locationStatus,
            };
          });
        } catch (error) {
          const { errorCode, retryable } = errorDetails(error);
          return {
            status: "failed" as const,
            sourceId: source.id,
            searchUrl,
            errorCode,
            retryable,
            locationStatus,
          };
        }
      });
    },

    async search(item) {
      const itemName = item.name.trim();
      if (!itemName) {
        throw new TypeError("O item da busca não pode ser vazio.");
      }

      const searchQuery = `${itemName} preço`;
      const locationStatus = "unresolved" as const;

      try {
        const response = await runWithFirecrawlPermit(() =>
          firecrawl.search({
            query: searchQuery,
            limit: GENERIC_SEARCH_LIMIT,
            includeContent: true,
          }),
        );
        const seenUrls = new Set<string>();
        const results: SourceSearchResult[] = response.results.flatMap((result) => {
          const sourceUrl = validateSearchResultUrl(result.url);
          if (!sourceUrl || seenUrls.has(sourceUrl)) return [];

          const content = normalizeSearchResultContent(result);
          const matchingText = [result.title, result.description, content]
            .filter(Boolean)
            .join("\n");
          if (!content || !hasRelevantItemTerm(itemName, matchingText)) return [];
          if (!BRAZILIAN_PRICE_PATTERN.test(content)) return [];

          seenUrls.add(sourceUrl);
          return [
            {
              status: "found" as const,
              sourceId: GENERIC_SEARCH_SOURCE_ID,
              searchQuery,
              sourceUrl,
              content,
              locationStatus,
            } satisfies SourceSearchResult,
          ];
        });

        return results.length > 0
          ? results
          : [
              {
                status: "not_found" as const,
                sourceId: GENERIC_SEARCH_SOURCE_ID,
                searchQuery,
                locationStatus,
              },
            ];
      } catch (error) {
        const { errorCode, retryable } = errorDetails(error);
        return [
          {
            status: "failed" as const,
            sourceId: GENERIC_SEARCH_SOURCE_ID,
            searchQuery,
            errorCode,
            retryable,
            locationStatus,
          },
        ];
      }
    },
  };
}

export const sourceCollector = createPriceSourceCollector({ firecrawl: firecrawlClient });
