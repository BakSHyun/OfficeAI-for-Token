import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ModelTier } from "../contracts";
import { createAnthropicProvider } from "./anthropic";
import { createCodexCliProvider } from "./codex-cli";
import { createMockProvider } from "./mock";
import { createOpenAIProvider } from "./openai";
import type {
  LLMProvider,
  ProviderConfig,
  TierBinding,
} from "./contracts";

export type ProviderRegistry = {
  config: ProviderConfig;
  resolveTier(tier: ModelTier): { provider: LLMProvider; binding: TierBinding };
  costUsd(
    tier: ModelTier,
    usage: { inputTokens: number; outputTokens: number },
  ): number;
};

const defaultConfig: ProviderConfig = {
  concurrency: 4,
  tiers: {
    local: {
      provider: "mock",
      model: "mock-local",
      inputCostPerMillion: 0,
      outputCostPerMillion: 0,
    },
    economy: {
      provider: "mock",
      model: "mock-economy",
      inputCostPerMillion: 0.25,
      outputCostPerMillion: 2,
    },
    standard: {
      provider: "mock",
      model: "mock-standard",
      inputCostPerMillion: 3,
      outputCostPerMillion: 15,
    },
    premium: {
      provider: "mock",
      model: "mock-premium",
      inputCostPerMillion: 15,
      outputCostPerMillion: 75,
    },
  },
};

function resolveApiKey(reference: string | undefined): string | undefined {
  if (!reference) return undefined;
  if (reference.startsWith("env:")) {
    return process.env[reference.slice(4)] || undefined;
  }
  return reference;
}

export async function loadProviderConfig(
  configDirectory = join(process.cwd(), "config"),
): Promise<ProviderConfig> {
  const localPath = join(configDirectory, "providers.local.json");
  const examplePath = join(configDirectory, "providers.example.json");
  const path = existsSync(localPath)
    ? localPath
    : existsSync(examplePath)
      ? examplePath
      : null;
  if (!path) return defaultConfig;
  const parsed = JSON.parse(await readFile(path, "utf8")) as ProviderConfig;
  return {
    ...defaultConfig,
    ...parsed,
    tiers: { ...defaultConfig.tiers, ...parsed.tiers },
  };
}

export function createProviderRegistry(
  config: ProviderConfig,
): ProviderRegistry {
  const cache = new Map<string, LLMProvider>();

  function instantiate(providerId: string): LLMProvider {
    const cached = cache.get(providerId);
    if (cached) return cached;

    const apiKey = resolveApiKey(config.apiKeys?.[providerId]);
    const baseUrl = config.baseUrls?.[providerId];
    let provider: LLMProvider;
    switch (providerId) {
      case "openai":
        if (!apiKey) {
          throw new Error(
            "OpenAI API 키가 없습니다. config/providers.local.json 의 apiKeys.openai 또는 환경변수를 설정하세요.",
          );
        }
        provider = createOpenAIProvider({ apiKey, baseUrl });
        break;
      case "anthropic":
        if (!apiKey) {
          throw new Error(
            "Anthropic API 키가 없습니다. config/providers.local.json 의 apiKeys.anthropic 또는 환경변수를 설정하세요.",
          );
        }
        provider = createAnthropicProvider({ apiKey, baseUrl });
        break;
      case "codex-cli":
        provider = createCodexCliProvider();
        break;
      case "mock":
        provider = createMockProvider();
        break;
      default:
        throw new Error(`알 수 없는 provider: ${providerId}`);
    }
    cache.set(providerId, provider);
    return provider;
  }

  return {
    config,
    resolveTier(tier: ModelTier) {
      const binding = config.tiers[tier];
      if (!binding) throw new Error(`티어 ${tier} 바인딩이 없습니다.`);
      return { provider: instantiate(binding.provider), binding };
    },
    costUsd(tier, usage) {
      const binding = config.tiers[tier];
      if (!binding) return 0;
      return (
        (usage.inputTokens / 1_000_000) * binding.inputCostPerMillion +
        (usage.outputTokens / 1_000_000) * binding.outputCostPerMillion
      );
    },
  };
}
