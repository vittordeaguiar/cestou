import "server-only";

export type IntegrationErrorCode =
  | "configuration_error"
  | "authentication_error"
  | "rate_limit_error"
  | "timeout_error"
  | "provider_error"
  | "invalid_response_error";

export type IntegrationProvider = "firecrawl" | "deepseek";

type IntegrationErrorOptions = {
  code: IntegrationErrorCode;
  provider: IntegrationProvider;
  message: string;
  retryable?: boolean;
  retryAfterMs?: number;
  cause?: unknown;
};

export class IntegrationError extends Error {
  readonly code: IntegrationErrorCode;
  readonly provider: IntegrationProvider;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;

  constructor(options: IntegrationErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "IntegrationError";
    this.code = options.code;
    this.provider = options.provider;
    this.retryable = options.retryable ?? false;
    this.retryAfterMs = options.retryAfterMs;
  }
}
