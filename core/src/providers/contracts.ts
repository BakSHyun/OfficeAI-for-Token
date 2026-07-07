import type { ModelTier } from "../contracts";

export type LLMMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LLMRequest = {
  tier: ModelTier;
  model: string;
  messages: LLMMessage[];
  maxOutputTokens: number;
  temperature?: number;
  /** JSON 응답을 기대하는 경우 스키마 힌트. 프롬프트/response_format 양쪽에 활용 */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
};

export type LLMResponse = {
  text: string;
  usage: { inputTokens: number; outputTokens: number };
  model: string;
  provider: string;
};

export interface LLMProvider {
  readonly id: string;
  complete(request: LLMRequest): Promise<LLMResponse>;
}

export type TierBinding = {
  provider: string;
  model: string;
  inputCostPerMillion: number;
  outputCostPerMillion: number;
};

export type ProviderConfig = {
  /** DAG 스케줄러의 최대 동시 LLM 호출 수 */
  concurrency: number;
  tiers: Record<ModelTier, TierBinding>;
  /** provider id -> api key 참조. "env:NAME" 또는 리터럴 */
  apiKeys?: Record<string, string>;
  /** OpenAI 호환 엔드포인트 오버라이드 (로컬 모델 등) */
  baseUrls?: Record<string, string>;
};
