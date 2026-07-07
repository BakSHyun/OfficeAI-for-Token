import assert from "node:assert/strict";
import { test } from "node:test";
import { createProviderRegistry } from "../src/providers/registry";
import type { ProviderConfig } from "../src/providers/contracts";

function configWithLocalProvider(provider: string): ProviderConfig {
  return {
    concurrency: 4,
    tiers: {
      local: {
        provider,
        model: "local-model",
        inputCostPerMillion: 0,
        outputCostPerMillion: 0,
      },
      economy: {
        provider: "mock",
        model: "mock-economy",
        inputCostPerMillion: 0,
        outputCostPerMillion: 0,
      },
      standard: {
        provider: "mock",
        model: "mock-standard",
        inputCostPerMillion: 0,
        outputCostPerMillion: 0,
      },
      premium: {
        provider: "mock",
        model: "mock-premium",
        inputCostPerMillion: 0,
        outputCostPerMillion: 0,
      },
    },
    baseUrls: { lmstudio: "http://localhost:1234/v1" },
  };
}

test("lmstudio provider는 API 키 없이도 인스턴스화된다", () => {
  const registry = createProviderRegistry(configWithLocalProvider("lmstudio"));
  const resolved = registry.resolveTier("local");
  assert.ok(resolved.provider);
  assert.equal(resolved.binding.model, "local-model");
});

test("lmstudio 기본 baseUrl이 없어도 로컬 주소로 동작한다", () => {
  const config = configWithLocalProvider("lmstudio");
  delete config.baseUrls;
  const registry = createProviderRegistry(config);
  assert.doesNotThrow(() => registry.resolveTier("local"));
});
