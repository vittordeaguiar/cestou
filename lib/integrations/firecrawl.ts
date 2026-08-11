import "server-only";

import { getFirecrawlConfig } from "@/lib/integrations/config";
import { IntegrationError } from "@/lib/integrations/errors";

const FIRECRAWL_API_BASE_URL = "https://api.firecrawl.dev/v2";
const FIRECRAWL_PROVIDER_TIMEOUT_MS = 30_000;
const FIRECRAWL_REQUEST_TIMEOUT_MS = 35_000;

type ServerEnvironment = Record<string, string | undefined>;
type HttpFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type FirecrawlSearchInput = {
  query: string;
  limit?: number;
  includeDomains?: readonly string[];
  includeContent?: boolean;
};

export type FirecrawlSearchResult = {
  url: string;
  title?: string;
  description?: string;
  markdown?: string;
};

export type FirecrawlSearchResponse = {
  requestId?: string;
  results: FirecrawlSearchResult[];
};

export type FirecrawlScrapeResponse = {
  requestId?: string;
  url: string;
  markdown: string;
  metadata: {
    title?: string;
    description?: string;
    statusCode?: number;
  };
};

type CreateFirecrawlClientOptions = {
  environment?: ServerEnvironment;
  fetcher?: HttpFetcher;
  requestTimeoutMs?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function parseRetryAfter(value: string | null) {
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1_000 : undefined;
}

function providerError(response: Response) {
  if (response.status === 401 || response.status === 403) {
    return new IntegrationError({
      code: "authentication_error",
      provider: "firecrawl",
      message: "O Firecrawl recusou a credencial configurada.",
    });
  }

  if (response.status === 429) {
    return new IntegrationError({
      code: "rate_limit_error",
      provider: "firecrawl",
      message: "O limite de requisições do Firecrawl foi atingido.",
      retryable: true,
      retryAfterMs: parseRetryAfter(response.headers.get("Retry-After")),
    });
  }

  if (response.status === 408) {
    return new IntegrationError({
      code: "timeout_error",
      provider: "firecrawl",
      message: "O Firecrawl excedeu o tempo limite da requisição.",
      retryable: true,
    });
  }

  return new IntegrationError({
    code: "provider_error",
    provider: "firecrawl",
    message: "O Firecrawl não conseguiu processar a requisição.",
    retryable: response.status >= 500,
  });
}

function invalidResponse(cause?: unknown) {
  return new IntegrationError({
    code: "invalid_response_error",
    provider: "firecrawl",
    message: "O Firecrawl retornou uma resposta inesperada.",
    cause,
  });
}

function normalizeSearchResponse(payload: unknown): FirecrawlSearchResponse {
  if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)) {
    throw invalidResponse();
  }

  const web = payload.data.web;
  if (!Array.isArray(web)) throw invalidResponse();

  const results = web.map((item) => {
    if (!isRecord(item) || typeof item.url !== "string") throw invalidResponse();
    return {
      url: item.url,
      title: optionalString(item.title),
      description: optionalString(item.description),
      markdown: optionalString(item.markdown),
    };
  });

  return { requestId: optionalString(payload.id), results };
}

function normalizeScrapeResponse(payload: unknown, requestedUrl: string): FirecrawlScrapeResponse {
  if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)) {
    throw invalidResponse();
  }

  if (typeof payload.data.markdown !== "string") throw invalidResponse();
  const metadata = isRecord(payload.data.metadata) ? payload.data.metadata : {};

  return {
    requestId: optionalString(payload.id),
    url: optionalString(metadata.sourceURL) ?? requestedUrl,
    markdown: payload.data.markdown,
    metadata: {
      title: optionalString(metadata.title),
      description: optionalString(metadata.description),
      statusCode: typeof metadata.statusCode === "number" ? metadata.statusCode : undefined,
    },
  };
}

function assertPublicUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch (cause) {
    throw new TypeError("A URL de scraping é inválida.", { cause });
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new TypeError("A URL de scraping deve usar HTTP ou HTTPS.");
  }

  return url.toString();
}

export function createFirecrawlClient(options: CreateFirecrawlClientOptions = {}) {
  const fetcher = options.fetcher ?? fetch;
  const requestTimeoutMs = options.requestTimeoutMs ?? FIRECRAWL_REQUEST_TIMEOUT_MS;

  async function post(endpoint: string, body: unknown) {
    const { apiKey } = getFirecrawlConfig(options.environment);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

    let response: Response;
    try {
      response = await fetcher(`${FIRECRAWL_API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (cause) {
      if (controller.signal.aborted) {
        throw new IntegrationError({
          code: "timeout_error",
          provider: "firecrawl",
          message: "O Firecrawl excedeu o tempo limite da requisição.",
          retryable: true,
          cause,
        });
      }

      throw new IntegrationError({
        code: "provider_error",
        provider: "firecrawl",
        message: "Não foi possível conectar ao Firecrawl.",
        retryable: true,
        cause,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) throw providerError(response);

    try {
      return await response.json();
    } catch (cause) {
      throw invalidResponse(cause);
    }
  }

  return {
    async search(input: FirecrawlSearchInput) {
      const query = input.query.trim();
      if (!query) throw new TypeError("A busca do Firecrawl não pode ser vazia.");

      const limit = input.limit ?? 5;
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        throw new TypeError("O limite da busca deve estar entre 1 e 100.");
      }

      const payload = await post("/search", {
        query,
        limit,
        sources: ["web"],
        includeDomains: input.includeDomains,
        country: "BR",
        timeout: FIRECRAWL_PROVIDER_TIMEOUT_MS,
        scrapeOptions: input.includeContent
          ? { formats: [{ type: "markdown" }], onlyMainContent: true }
          : undefined,
      });
      return normalizeSearchResponse(payload);
    },

    async scrape(value: string) {
      const url = assertPublicUrl(value);
      const payload = await post("/scrape", {
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        timeout: FIRECRAWL_PROVIDER_TIMEOUT_MS,
      });
      return normalizeScrapeResponse(payload, url);
    },
  };
}

export const firecrawlClient = createFirecrawlClient();
