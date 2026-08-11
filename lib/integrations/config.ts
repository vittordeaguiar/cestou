import "server-only";

import { IntegrationError } from "@/lib/integrations/errors";

type ServerEnvironment = Record<string, string | undefined>;

export type FirecrawlConfig = {
  apiKey: string;
};

export const DEEPSEEK_MODELS = ["deepseek-v4-flash", "deepseek-v4-pro"] as const;
export type DeepSeekModel = (typeof DEEPSEEK_MODELS)[number];

export type DeepSeekConfig = {
  apiKey: string;
  model: DeepSeekModel;
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

function isDeepSeekModel(value: string): value is DeepSeekModel {
  return DEEPSEEK_MODELS.some((model) => model === value);
}

export function getDeepSeekConfig(environment: ServerEnvironment = process.env): DeepSeekConfig {
  const apiKey = environment.DEEPSEEK_API_KEY?.trim();

  if (!apiKey) {
    throw new IntegrationError({
      code: "configuration_error",
      provider: "deepseek",
      message: "A integração com o DeepSeek não está configurada.",
    });
  }

  const configuredModel = environment.DEEPSEEK_MODEL?.trim();
  const model = configuredModel || "deepseek-v4-flash";
  if (!isDeepSeekModel(model)) {
    throw new IntegrationError({
      code: "configuration_error",
      provider: "deepseek",
      message: "O modelo configurado para o DeepSeek não é suportado.",
    });
  }

  return { apiKey, model };
}
