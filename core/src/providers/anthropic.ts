import type { LLMProvider, LLMRequest, LLMResponse } from "./contracts";

type AnthropicOptions = {
  apiKey: string;
  baseUrl?: string;
};

export function createAnthropicProvider(
  options: AnthropicOptions,
): LLMProvider {
  const baseUrl = (options.baseUrl ?? "https://api.anthropic.com").replace(
    /\/$/,
    "",
  );

  return {
    id: "anthropic",
    async complete(request: LLMRequest): Promise<LLMResponse> {
      const system = request.messages
        .filter((message) => message.role === "system")
        .map((message) => message.content)
        .join("\n\n");
      const conversation = request.messages.filter(
        (message) => message.role !== "system",
      );
      const messages =
        conversation.length > 0
          ? conversation
          : [{ role: "user" as const, content: "진행해주세요." }];

      const body: Record<string, unknown> = {
        model: request.model,
        max_tokens: request.maxOutputTokens,
        messages,
      };
      if (system) body.system = system;
      if (request.temperature !== undefined) {
        body.temperature = request.temperature;
      }

      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": options.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(
          `Anthropic API ${response.status}: ${detail.slice(0, 500)}`,
        );
      }
      const payload = (await response.json()) as {
        content: Array<{ type: string; text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
        model?: string;
      };
      return {
        text: payload.content
          .filter((block) => block.type === "text")
          .map((block) => block.text ?? "")
          .join(""),
        usage: {
          inputTokens: payload.usage?.input_tokens ?? 0,
          outputTokens: payload.usage?.output_tokens ?? 0,
        },
        model: payload.model ?? request.model,
        provider: "anthropic",
      };
    },
  };
}
