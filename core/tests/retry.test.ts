import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ModelTier } from "../src/contracts";
import { degradeTier } from "../src/orchestration/dispatcher";
import type { LLMProvider, LLMRequest, LLMResponse } from "../src/providers/contracts";
import {
  LLMAuthError,
  classifyProviderError,
  createRetryProvider,
} from "../src/providers/retry";

function createFlakyProvider(
  failUntil: number,
  errorFactory: () => Error,
): LLMProvider {
  let attempts = 0;
  return {
    id: "flaky",
    async complete(request: LLMRequest): Promise<LLMResponse> {
      attempts += 1;
      if (attempts <= failUntil) {
        throw errorFactory();
      }
      return {
        text: `ok:${request.tier}`,
        usage: { inputTokens: 10, outputTokens: 5 },
        model: request.model,
        provider: "flaky",
      };
    },
  };
}

describe("retry provider", () => {
  it("classifyProviderError는 429/5xx/네트워크를 재시도 대상으로 본다", () => {
    assert.equal(classifyProviderError(new Error("OpenAI API 429: rate limit")).retryable, true);
    assert.equal(classifyProviderError(new Error("OpenAI API 503: unavailable")).retryable, true);
    assert.equal(classifyProviderError(new TypeError("fetch failed")).retryable, true);
    assert.equal(classifyProviderError(new Error("OpenAI API 401: bad key")).auth, true);
    assert.equal(classifyProviderError(new Error("OpenAI API 401: bad key")).retryable, false);
  });

  it("2회 실패 후 3번째 호출에서 성공한다", async () => {
    const inner = createFlakyProvider(2, () => new Error("OpenAI API 503: unavailable"));
    const provider = createRetryProvider({
      tier: "standard",
      inner,
      resolveRawTier: (tier) => ({ provider: inner, binding: mockBinding(tier) }),
      delays: [0, 0],
      sleep: async () => {},
    });

    const response = await provider.complete(sampleRequest("standard"));
    assert.equal(response.text, "ok:standard");
  });

  it("재시도 소진 후 한 단계 하위 티어로 1회 폴백한다", async () => {
    const premium = createFlakyProvider(
      Number.POSITIVE_INFINITY,
      () => new Error("OpenAI API 503: unavailable"),
    );
    const economy: LLMProvider = {
      id: "economy",
      async complete(request) {
        return {
          text: `fallback:${request.tier}`,
          usage: { inputTokens: 1, outputTokens: 1 },
          model: request.model,
          provider: "economy",
        };
      },
    };

    const provider = createRetryProvider({
      tier: "standard",
      inner: premium,
      resolveRawTier: (tier) => ({
        provider: tier === "economy" ? economy : premium,
        binding: mockBinding(tier),
      }),
      delays: [0, 0],
      sleep: async () => {},
    });

    const response = await provider.complete(sampleRequest("standard"));
    assert.equal(response.text, "fallback:economy");
    assert.equal(degradeTier("standard"), "economy");
  });

  it("401 인증 오류는 재시도 없이 LLMAuthError로 전달한다", async () => {
    const inner: LLMProvider = {
      id: "auth-fail",
      async complete() {
        throw new Error("OpenAI API 401: invalid_api_key");
      },
    };
    const provider = createRetryProvider({
      tier: "standard",
      inner,
      resolveRawTier: (tier) => ({ provider: inner, binding: mockBinding(tier) }),
      delays: [0, 0],
      sleep: async () => {},
    });

    await assert.rejects(
      () => provider.complete(sampleRequest("standard")),
      (error: unknown) => error instanceof LLMAuthError,
    );
  });
});

function sampleRequest(tier: ModelTier): LLMRequest {
  return {
    tier,
    model: `mock-${tier}`,
    messages: [{ role: "user", content: "테스트" }],
    maxOutputTokens: 100,
  };
}

function mockBinding(tier: ModelTier) {
  return {
    provider: "mock",
    model: `mock-${tier}`,
    inputCostPerMillion: 0,
    outputCostPerMillion: 0,
  };
}
