import "server-only";

import { IntegrationError } from "@/lib/integrations/errors";

type ServerEnvironment = Record<string, string | undefined>;

export type FirecrawlConfig = {
  apiKey: string;
};

export function getFirecrawlConfig(environment: ServerEnvironment = process.env): FirecrawlConfig {
  const apiKey = environment.FIRECRAWL_API_KEY?.trim();

  if (!apiKey) {
    throw new IntegrationError({
      code: "configuration_error",
      provider: "firecrawl",
      message: "A integração com o Firecrawl não está configurada.",
    });
  }

  return { apiKey };
}
