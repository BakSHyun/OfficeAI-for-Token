import type { LLMProvider, LLMRequest, LLMResponse } from "./contracts";

type OpenAIOptions = {
  apiKey: string;
  baseUrl?: string;
  /** 텔레메트리 라벨. OpenAI 호환 로컬 서버(LM Studio 등) 구분용 */
  id?: string;
};

export function createOpenAIProvider(options: OpenAIOptions): LLMProvider {
  const baseUrl = (options.baseUrl ?? "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  );
  const id = options.id ?? "openai";

  return {
    id,
    async complete(request: LLMRequest): Promise<LLMResponse> {
      const body: Record<string, unknown> = {
        model: request.model,
        messages: request.messages,
        max_completion_tokens: request.maxOutputTokens,
      };
      if (request.temperature !== undefined) {
        body.temperature = request.temperature;
      }
      if (request.jsonSchema) {
        body.response_format = {
          type: "json_schema",
          json_schema: {
            name: request.jsonSchema.name,
            schema: request.jsonSchema.schema,
            strict: false,
          },
        };
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(
          `OpenAI API ${response.status}: ${detail.slice(0, 500)}`,
        );
      }
      const payload = (await response.json()) as {
        choices: Array<{ message: { content: string | null } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
        model?: string;
      };
      return {
        text: payload.choices[0]?.message?.content ?? "",
        usage: {
          inputTokens: payload.usage?.prompt_tokens ?? 0,
          outputTokens: payload.usage?.completion_tokens ?? 0,
        },
        model: payload.model ?? request.model,
        provider: id,
      };
    },
  };
}
