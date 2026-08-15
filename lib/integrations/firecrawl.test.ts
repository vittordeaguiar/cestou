import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { IntegrationError } from "@/lib/integrations/errors";
import { createFirecrawlClient } from "@/lib/integrations/firecrawl";

const API_KEY = "fc-test-secret";

function jsonResponse(data: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), { status, headers });
}

function expectIntegrationError(error: unknown, code: IntegrationError["code"]) {
  expect(error).toBeInstanceOf(IntegrationError);
  expect(error).toMatchObject({ code, provider: "firecrawl" });
}

describe("FirecrawlClient", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("normaliza respostas válidas de busca e scraping", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            web: [
              {
                url: "https://example.com/arroz",
                title: "Arroz",
                description: "Oferta",
                markdown: "# Arroz\nR$ 10,00",
              },
            ],
          },
          id: "search-id",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            markdown: "# Arroz\nR$ 10,00",
            metadata: {
              title: "Arroz",
              description: "Oferta",
              sourceURL: "https://example.com/arroz",
              statusCode: 200,
            },
          },
          id: "scrape-id",
        }),
      );
    const client = createFirecrawlClient({
      environment: { FIRECRAWL_API_KEY: API_KEY },
      fetcher,
    });

    await expect(
      client.search({
        query: "arroz",
        includeDomains: ["example.com"],
        includeContent: true,
      }),
    ).resolves.toEqual({
      requestId: "search-id",
      results: [
        {
          url: "https://example.com/arroz",
          title: "Arroz",
          description: "Oferta",
          markdown: "# Arroz\nR$ 10,00",
        },
      ],
    });
    await expect(client.scrape("https://example.com/arroz")).resolves.toEqual({
      requestId: "scrape-id",
      url: "https://example.com/arroz",
      markdown: "# Arroz\nR$ 10,00",
      metadata: {
        title: "Arroz",
        description: "Oferta",
        statusCode: 200,
      },
    });

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "https://api.firecrawl.dev/v2/search",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${API_KEY}` }),
      }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "https://api.firecrawl.dev/v2/scrape",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${API_KEY}` }),
      }),
    );
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({
      url: "https://example.com/arroz",
      formats: ["markdown"],
      onlyMainContent: true,
      timeout: 30_000,
    });
  });

  it("mapeia falhas HTTP do endpoint de scraping", async () => {
    const client = createFirecrawlClient({
      environment: { FIRECRAWL_API_KEY: API_KEY },
      fetcher: vi.fn().mockResolvedValue(jsonResponse({}, 503)),
    });

    await expect(client.scrape("https://example.com/arroz")).rejects.toMatchObject({
      code: "provider_error",
      provider: "firecrawl",
      retryable: true,
    });
  });

  it("falha de forma segura quando a credencial está ausente", async () => {
    const client = createFirecrawlClient({ environment: {}, fetcher: vi.fn() });

    await expect(client.search({ query: "arroz" })).rejects.toSatisfy((error: unknown) => {
      expectIntegrationError(error, "configuration_error");
      return true;
    });
  });

  it.each([401, 403])("mapeia HTTP %s como erro de autenticação", async (status) => {
    const client = createFirecrawlClient({
      environment: { FIRECRAWL_API_KEY: API_KEY },
      fetcher: vi.fn().mockResolvedValue(jsonResponse({}, status)),
    });

    await expect(client.search({ query: "arroz" })).rejects.toSatisfy((error: unknown) => {
      expectIntegrationError(error, "authentication_error");
      return true;
    });
  });

  it("mapeia rate limit e preserva Retry-After sem expor o corpo", async () => {
    const client = createFirecrawlClient({
      environment: { FIRECRAWL_API_KEY: API_KEY },
      fetcher: vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ error: `limit for ${API_KEY}` }, 429, { "Retry-After": "2" }),
        ),
    });

    try {
      await client.search({ query: "arroz" });
      expect.unreachable("a chamada deveria falhar");
    } catch (error) {
      expectIntegrationError(error, "rate_limit_error");
      expect(error).toMatchObject({ retryAfterMs: 2_000, retryable: true });
      expect(String(error)).not.toContain(API_KEY);
    }
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
    const client = createFirecrawlClient({
      environment: { FIRECRAWL_API_KEY: API_KEY },
      fetcher,
      requestTimeoutMs: 10,
    });
    const request = client.search({ query: "arroz" });
    const assertion = expect(request).rejects.toSatisfy((error: unknown) => {
      expectIntegrationError(error, "timeout_error");
      return true;
    });

    await vi.advanceTimersByTimeAsync(10);
    await assertion;
  });

  it("mapeia HTTP 408 e falhas 5xx", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 408))
      .mockResolvedValueOnce(jsonResponse({}, 503));
    const client = createFirecrawlClient({
      environment: { FIRECRAWL_API_KEY: API_KEY },
      fetcher,
    });

    await expect(client.search({ query: "arroz" })).rejects.toMatchObject({
      code: "timeout_error",
    });
    await expect(client.search({ query: "arroz" })).rejects.toMatchObject({
      code: "provider_error",
      retryable: true,
    });
  });

  it("rejeita resposta 2xx inesperada sem incluir conteúdo sensível", async () => {
    const client = createFirecrawlClient({
      environment: { FIRECRAWL_API_KEY: API_KEY },
      fetcher: vi
        .fn()
        .mockResolvedValue(jsonResponse({ success: true, data: { secret: API_KEY } })),
    });

    try {
      await client.search({ query: "arroz" });
      expect.unreachable("a chamada deveria falhar");
    } catch (error) {
      expectIntegrationError(error, "invalid_response_error");
      expect(String(error)).not.toContain(API_KEY);
    }
  });
});
