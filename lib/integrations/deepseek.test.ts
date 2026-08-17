import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { IntegrationError } from "@/lib/integrations/errors";
import { createDeepSeekClient } from "@/lib/integrations/deepseek";

const API_KEY = "ds-test-secret";
const ENVIRONMENT = { DEEPSEEK_API_KEY: API_KEY };
const MESSAGES = [
  { role: "system" as const, content: "Responda somente com JSON válido." },
  { role: "user" as const, content: "Extraia o valor informado." },
];

function jsonResponse(data: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), { status, headers });
}

function completion(content: string | null, finishReason = "stop") {
  return {
    id: "completion-id",
    model: "deepseek-v4-flash",
    choices: [
      {
        finish_reason: finishReason,
        message: { role: "assistant", content },
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
    },
  };
}

function decodeAmount(value: unknown) {
  if (
    typeof value !== "object" ||
    value === null ||
    !("amount" in value) ||
    typeof value.amount !== "number"
  ) {
    throw new TypeError("amount inválido");
  }
  return { amount: value.amount };
}

function expectIntegrationError(error: unknown, code: IntegrationError["code"]) {
  expect(error).toBeInstanceOf(IntegrationError);
  expect(error).toMatchObject({ code, provider: "deepseek" });
}

describe("DeepSeekClient", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("solicita e valida uma resposta JSON estruturada", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(completion('{"amount": 10}')));
    const client = createDeepSeekClient({ environment: ENVIRONMENT, fetcher });

    await expect(
      client.requestStructuredJson({ messages: MESSAGES, decode: decodeAmount }),
    ).resolves.toEqual({
      data: { amount: 10 },
      model: "deepseek-v4-flash",
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.deepseek.com/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${API_KEY}` }),
        body: expect.stringContaining('"response_format":{"type":"json_object"}'),
      }),
    );
    expect(fetcher.mock.calls[0]?.[1]?.body).toContain('"thinking":{"type":"disabled"}');
  });

  it("limita chamadas simultâneas e preserva a ordem FIFO", async () => {
    const started: string[] = [];
    const pending: Array<{
      id: string;
      resolve: (response: Response) => void;
    }> = [];
    let activeCount = 0;
    let maxActiveCount = 0;
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        messages: Array<{ content: string }>;
      };
      const id = body.messages[1]?.content ?? "";
      started.push(id);
      activeCount += 1;
      maxActiveCount = Math.max(maxActiveCount, activeCount);

      return new Promise<Response>((resolve) => {
        pending.push({ id, resolve });
      }).finally(() => {
        activeCount -= 1;
      });
    });
    const client = createDeepSeekClient({ environment: ENVIRONMENT, fetcher });
    const requestFor = (id: string) =>
      client.requestStructuredJson({
        messages: [
          { role: "system" as const, content: "Responda somente com JSON válido." },
          { role: "user" as const, content: `JSON ${id}` },
        ],
        decode: decodeAmount,
      });
    const requests = ["a", "b", "c", "d"].map(requestFor);
    const resolveRequest = (id: string) => {
      const index = pending.findIndex((request) => request.id === id);
      expect(index).toBeGreaterThanOrEqual(0);
      pending.splice(index, 1)[0]?.resolve(jsonResponse(completion('{"amount": 10}')));
    };

    await vi.waitFor(() => expect(started).toEqual(["JSON a", "JSON b"]));
    expect(maxActiveCount).toBe(2);

    resolveRequest("JSON a");
    await vi.waitFor(() => expect(started).toEqual(["JSON a", "JSON b", "JSON c"]));
    resolveRequest("JSON b");
    await vi.waitFor(() => expect(started).toEqual(["JSON a", "JSON b", "JSON c", "JSON d"]));
    resolveRequest("JSON c");
    resolveRequest("JSON d");

    await expect(Promise.all(requests)).resolves.toHaveLength(4);
    expect(maxActiveCount).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("libera o permit depois de uma falha e executa a chamada seguinte", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("falha de rede"))
      .mockResolvedValueOnce(jsonResponse(completion('{"amount": 10}')));
    const client = createDeepSeekClient({
      environment: ENVIRONMENT,
      fetcher,
      maxConcurrentRequests: 1,
    });
    const firstRequest = client.requestStructuredJson({ messages: MESSAGES, decode: decodeAmount });
    const secondRequest = client.requestStructuredJson({
      messages: MESSAGES,
      decode: decodeAmount,
    });

    await expect(firstRequest).rejects.toMatchObject({
      code: "provider_error",
      retryable: true,
    });
    await expect(secondRequest).resolves.toMatchObject({ data: { amount: 10 } });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("começa o timeout somente depois de adquirir o permit", async () => {
    vi.useFakeTimers();
    let callCount = 0;
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      callCount += 1;
      if (callCount === 1) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        });
      }
      return Promise.resolve(jsonResponse(completion('{"amount": 10}')));
    });
    const client = createDeepSeekClient({
      environment: ENVIRONMENT,
      fetcher,
      maxConcurrentRequests: 1,
      requestTimeoutMs: 10,
    });
    const firstRequest = client.requestStructuredJson({ messages: MESSAGES, decode: decodeAmount });
    const secondRequest = client.requestStructuredJson({
      messages: MESSAGES,
      decode: decodeAmount,
    });
    const firstAssertion = expect(firstRequest).rejects.toMatchObject({ code: "timeout_error" });
    const secondAssertion = expect(secondRequest).resolves.toMatchObject({
      data: { amount: 10 },
    });

    await vi.advanceTimersByTimeAsync(10);
    await firstAssertion;
    await secondAssertion;
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("usa o modelo configurado sem validar a chave no carregamento do módulo", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(completion('{"amount": 10}')));
    const client = createDeepSeekClient({
      environment: {
        DEEPSEEK_API_KEY: API_KEY,
        DEEPSEEK_MODEL: "deepseek-v4-pro",
      },
      fetcher,
    });

    await client.requestStructuredJson({ messages: MESSAGES, decode: decodeAmount });
    expect(fetcher.mock.calls[0]?.[1]?.body).toContain('"model":"deepseek-v4-pro"');
  });

  it("falha de forma segura quando a credencial está ausente", async () => {
    const client = createDeepSeekClient({ environment: {}, fetcher: vi.fn() });

    await expect(
      client.requestStructuredJson({ messages: MESSAGES, decode: decodeAmount }),
    ).rejects.toSatisfy((error: unknown) => {
      expectIntegrationError(error, "configuration_error");
      return true;
    });
  });

  it.each([401, 403])("mapeia HTTP %s como erro de autenticação", async (status) => {
    const client = createDeepSeekClient({
      environment: ENVIRONMENT,
      fetcher: vi.fn().mockResolvedValue(jsonResponse({}, status)),
    });

    await expect(
      client.requestStructuredJson({ messages: MESSAGES, decode: decodeAmount }),
    ).rejects.toMatchObject({ code: "authentication_error" });
  });

  it("mapeia rate limit e Retry-After", async () => {
    const client = createDeepSeekClient({
      environment: ENVIRONMENT,
      fetcher: vi.fn().mockResolvedValue(jsonResponse({}, 429, { "Retry-After": "3" })),
    });

    await expect(
      client.requestStructuredJson({ messages: MESSAGES, decode: decodeAmount }),
    ).rejects.toMatchObject({
      code: "rate_limit_error",
      retryable: true,
      retryAfterMs: 3_000,
    });
  });

  it("aborta a requisição no timeout configurado", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    });
    const client = createDeepSeekClient({
      environment: ENVIRONMENT,
      fetcher,
      requestTimeoutMs: 10,
    });
    const request = client.requestStructuredJson({
      messages: MESSAGES,
      decode: decodeAmount,
    });
    const assertion = expect(request).rejects.toMatchObject({
      code: "timeout_error",
      retryable: true,
    });

    await vi.advanceTimersByTimeAsync(10);
    await assertion;
  });

  it("mapeia HTTP 408 e falhas 5xx", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 408))
      .mockResolvedValueOnce(jsonResponse({}, 503));
    const client = createDeepSeekClient({ environment: ENVIRONMENT, fetcher });

    await expect(
      client.requestStructuredJson({ messages: MESSAGES, decode: decodeAmount }),
    ).rejects.toMatchObject({ code: "timeout_error" });
    await expect(
      client.requestStructuredJson({ messages: MESSAGES, decode: decodeAmount }),
    ).rejects.toMatchObject({ code: "provider_error", retryable: true });
  });

  it.each([
    ["conteúdo vazio", completion(null)],
    ["JSON inválido", completion("não é json")],
    ["resposta truncada", completion('{"amount":', "length")],
    ["shape inesperado", { choices: [], secret: API_KEY }],
  ])("rejeita %s como resposta inválida", async (_name, payload) => {
    const client = createDeepSeekClient({
      environment: ENVIRONMENT,
      fetcher: vi.fn().mockResolvedValue(jsonResponse(payload)),
    });

    try {
      await client.requestStructuredJson({
        messages: MESSAGES,
        decode: decodeAmount,
      });
      expect.unreachable("a chamada deveria falhar");
    } catch (error) {
      expectIntegrationError(error, "invalid_response_error");
      expect(String(error)).not.toContain(API_KEY);
    }
  });

  it("não aceita silenciosamente JSON fora do contrato esperado", async () => {
    const client = createDeepSeekClient({
      environment: ENVIRONMENT,
      fetcher: vi.fn().mockResolvedValue(jsonResponse(completion('{"value": 10}'))),
    });

    await expect(
      client.requestStructuredJson({ messages: MESSAGES, decode: decodeAmount }),
    ).rejects.toMatchObject({ code: "invalid_response_error" });
  });
});
