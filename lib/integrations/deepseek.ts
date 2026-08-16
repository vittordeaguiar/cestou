import "server-only";

import { getDeepSeekConfig } from "@/lib/integrations/config";
import { IntegrationError } from "@/lib/integrations/errors";
import { createFifoLimiter } from "@/lib/integrations/fifo-limiter";

const DEEPSEEK_CHAT_COMPLETIONS_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_TOKENS = 2_048;
const DEFAULT_MAX_CONCURRENT_REQUESTS = 2;

type ServerEnvironment = Record<string, string | undefined>;
type HttpFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type DeepSeekMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type StructuredJsonRequest<T> = {
  messages: readonly DeepSeekMessage[];
  decode: (value: unknown) => T;
  maxTokens?: number;
};

export type StructuredJsonResponse<T> = {
  data: T;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
};

type CreateDeepSeekClientOptions = {
  environment?: ServerEnvironment;
  fetcher?: HttpFetcher;
  requestTimeoutMs?: number;
  maxConcurrentRequests?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
      provider: "deepseek",
      message: "O DeepSeek recusou a credencial configurada.",
    });
  }

  if (response.status === 429) {
    return new IntegrationError({
      code: "rate_limit_error",
      provider: "deepseek",
      message: "O limite de requisições do DeepSeek foi atingido.",
      retryable: true,
      retryAfterMs: parseRetryAfter(response.headers.get("Retry-After")),
    });
  }

  if (response.status === 408) {
    return new IntegrationError({
      code: "timeout_error",
      provider: "deepseek",
      message: "O DeepSeek excedeu o tempo limite da requisição.",
      retryable: true,
    });
  }

  return new IntegrationError({
    code: "provider_error",
    provider: "deepseek",
    message: "O DeepSeek não conseguiu processar a requisição.",
    retryable: response.status >= 500,
  });
}

function invalidResponse(cause?: unknown) {
  return new IntegrationError({
    code: "invalid_response_error",
    provider: "deepseek",
    message: "O DeepSeek retornou uma resposta estruturada inválida.",
    cause,
  });
}

function normalizeUsage(value: unknown) {
  if (!isRecord(value)) return undefined;
  const inputTokens = value.prompt_tokens;
  const outputTokens = value.completion_tokens;
  const totalTokens = value.total_tokens;

  if (
    typeof inputTokens !== "number" ||
    typeof outputTokens !== "number" ||
    typeof totalTokens !== "number"
  ) {
    return undefined;
  }

  return { inputTokens, outputTokens, totalTokens };
}

function readCompletion(payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) {
    throw invalidResponse();
  }

  const choice = payload.choices[0];
  if (
    !isRecord(choice) ||
    choice.finish_reason !== "stop" ||
    !isRecord(choice.message) ||
    typeof choice.message.content !== "string" ||
    !choice.message.content.trim()
  ) {
    throw invalidResponse();
  }

  return {
    content: choice.message.content,
    model: typeof payload.model === "string" ? payload.model : "unknown",
    usage: normalizeUsage(payload.usage),
  };
}

function assertRequest<T>(request: StructuredJsonRequest<T>) {
  if (request.messages.length === 0) {
    throw new TypeError("A solicitação ao DeepSeek precisa conter mensagens.");
  }

  if (!request.messages.some((message) => /json/i.test(message.content))) {
    throw new TypeError("A solicitação estruturada deve instruir o DeepSeek a responder em JSON.");
  }

  const maxTokens = request.maxTokens ?? DEFAULT_MAX_TOKENS;
  if (!Number.isInteger(maxTokens) || maxTokens < 1) {
    throw new TypeError("maxTokens deve ser um inteiro positivo.");
  }

  return maxTokens;
}

export function createDeepSeekClient(options: CreateDeepSeekClientOptions = {}) {
  const fetcher = options.fetcher ?? fetch;
  const requestTimeoutMs = options.requestTimeoutMs ?? DEEPSEEK_REQUEST_TIMEOUT_MS;
  const maxConcurrentRequests = options.maxConcurrentRequests ?? DEFAULT_MAX_CONCURRENT_REQUESTS;
  if (!Number.isInteger(maxConcurrentRequests) || maxConcurrentRequests < 1) {
    throw new TypeError("A concorrência do DeepSeek deve ser um inteiro positivo.");
  }
  const runWithDeepSeekPermit = createFifoLimiter(maxConcurrentRequests);

  return {
    async requestStructuredJson<T>(
      request: StructuredJsonRequest<T>,
    ): Promise<StructuredJsonResponse<T>> {
      const maxTokens = assertRequest(request);
      return runWithDeepSeekPermit(async () => {
        const { apiKey, model } = getDeepSeekConfig(options.environment);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

        let response: Response;
        try {
          response = await fetcher(DEEPSEEK_CHAT_COMPLETIONS_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              messages: request.messages,
              thinking: { type: "disabled" },
              response_format: { type: "json_object" },
              max_tokens: maxTokens,
              stream: false,
            }),
            signal: controller.signal,
          });
        } catch (cause) {
          if (controller.signal.aborted) {
            throw new IntegrationError({
              code: "timeout_error",
              provider: "deepseek",
              message: "O DeepSeek excedeu o tempo limite da requisição.",
              retryable: true,
              cause,
            });
          }

          throw new IntegrationError({
            code: "provider_error",
            provider: "deepseek",
            message: "Não foi possível conectar ao DeepSeek.",
            retryable: true,
            cause,
          });
        } finally {
          clearTimeout(timeout);
        }

        if (!response.ok) throw providerError(response);

        let payload: unknown;
        try {
          payload = await response.json();
        } catch (cause) {
          throw invalidResponse(cause);
        }

        const completion = readCompletion(payload);
        let parsed: unknown;
        try {
          parsed = JSON.parse(completion.content);
        } catch (cause) {
          throw invalidResponse(cause);
        }

        let data: T;
        try {
          data = request.decode(parsed);
        } catch (cause) {
          throw invalidResponse(cause);
        }

        return {
          data,
          model: completion.model,
          usage: completion.usage,
        };
      });
    },
  };
}

export const deepSeekClient = createDeepSeekClient();
