import type { ModelTier } from "../contracts";
import { degradeTier } from "../orchestration/dispatcher";
import type { LLMProvider, LLMRequest, LLMResponse, TierBinding } from "./contracts";

const DEFAULT_RETRY_DELAYS_MS = [1_000, 4_000] as const;

export class LLMAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMAuthError";
  }
}

export function classifyProviderError(error: unknown): {
  retryable: boolean;
  auth: boolean;
  message: string;
} {
  if (error instanceof LLMAuthError) {
    return { retryable: false, auth: true, message: error.message };
  }

  const message = error instanceof Error ? error.message : String(error);
  const statusMatch = message.match(/\b(4\d{2}|5\d{2})\b/);
  const status = statusMatch ? Number(statusMatch[1]) : undefined;

  if (status === 401 || status === 403) {
    return { retryable: false, auth: true, message };
  }
  if (status === 429 || (status !== undefined && status >= 500)) {
    return { retryable: true, auth: false, message };
  }
  if (status !== undefined && status >= 400 && status < 500) {
    return { retryable: false, auth: false, message };
  }
  if (
    error instanceof TypeError ||
    /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|network|timeout|fetch failed/i.test(
      message,
    )
  ) {
    return { retryable: true, auth: false, message };
  }
  return { retryable: false, auth: false, message };
}

function defaultSleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export type RawTierResolver = (tier: ModelTier) => {
  provider: LLMProvider;
  binding: TierBinding;
};

export type RetryProviderOptions = {
  tier: ModelTier;
  inner: LLMProvider;
  resolveRawTier: RawTierResolver;
  delays?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
};

export function createRetryProvider(options: RetryProviderOptions): LLMProvider {
  const {
    tier,
    inner,
    resolveRawTier,
    delays = DEFAULT_RETRY_DELAYS_MS,
    sleep = defaultSleep,
  } = options;

  async function completeWithRetries(
    provider: LLMProvider,
    activeTier: ModelTier,
    request: LLMRequest,
  ): Promise<LLMResponse> {
    let lastError: unknown;
    const maxAttempts = delays.length + 1;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        return await provider.complete({ ...request, tier: activeTier });
      } catch (error) {
        lastError = error;
        const classified = classifyProviderError(error);
        if (classified.auth) {
          throw new LLMAuthError(classified.message);
        }
        if (!classified.retryable || attempt >= delays.length) {
          break;
        }
        await sleep(delays[attempt] ?? delays[delays.length - 1] ?? 0);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(String(lastError));
  }

  return {
    id: inner.id,
    async complete(request) {
      try {
        return await completeWithRetries(inner, tier, request);
      } catch (error) {
        if (error instanceof LLMAuthError) throw error;

        const lower = degradeTier(tier);
        if (!lower) throw error;

        const fallback = resolveRawTier(lower);
        return completeWithRetries(fallback.provider, lower, request);
      }
    },
  };
}
