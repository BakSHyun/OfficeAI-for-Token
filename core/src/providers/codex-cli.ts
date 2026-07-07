import { estimateTokens } from "../context/token-estimator";
import { parseCodexModelField } from "../../../shared/provider-model-catalog";
import { runProcess } from "../process/process-runner";
import type { LLMProvider, LLMRequest, LLMResponse } from "./contracts";

/**
 * 로컬 Codex CLI를 일반 텍스트 완성 provider로 래핑.
 * API 키 없이 기존 Codex 구독/설정을 그대로 사용할 수 있게 한다.
 */
export function createCodexCliProvider(options?: {
  cwd?: string;
  timeoutMs?: number;
}): LLMProvider {
  return {
    id: "codex-cli",
    async complete(request: LLMRequest): Promise<LLMResponse> {
      const prompt = request.messages
        .map((message) => {
          const label =
            message.role === "system"
              ? "[지침]"
              : message.role === "assistant"
                ? "[이전 응답]"
                : "[요청]";
          return `${label}\n${message.content}`;
        })
        .join("\n\n");

      const args = ["exec", "--ephemeral", "--json", "-s", "read-only"];
      const { modelId, effort } = parseCodexModelField(request.model);
      if (modelId && modelId !== "default") {
        args.push("-m", modelId);
      }
      if (effort && effort !== "medium") {
        args.push("-c", `model_reasoning_effort=${effort}`);
      }
      args.push("-");

      const result = await runProcess({
        command: "codex",
        args,
        cwd: options?.cwd ?? process.cwd(),
        timeoutMs: options?.timeoutMs ?? 10 * 60 * 1_000,
        stdin: prompt,
        maxOutputBytes: 400_000,
      });
      if (result.timedOut) {
        throw new Error("Codex CLI 호출이 시간 초과되었습니다.");
      }
      if (result.exitCode !== 0) {
        throw new Error(
          `Codex CLI 종료 코드 ${result.exitCode}: ${result.stderr.slice(0, 500)}`,
        );
      }

      const parsed = extractCodexOutput(result.stdout);
      return {
        text: parsed.text,
        usage: {
          inputTokens: parsed.inputTokens ?? estimateTokens(prompt),
          outputTokens: parsed.outputTokens ?? estimateTokens(parsed.text),
        },
        model: modelId || request.model,
        provider: "codex-cli",
      };
    },
  };
}

function extractCodexOutput(stdout: string): {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
} {
  let text = "";
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;

  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      continue;
    }

    const item = event.item as Record<string, unknown> | undefined;
    if (item?.type === "agent_message" && typeof item.text === "string") {
      text = item.text;
    }
    const message = event.msg as Record<string, unknown> | undefined;
    if (message?.type === "agent_message" && typeof message.message === "string") {
      text = message.message;
    }

    const usage =
      (event.usage as Record<string, unknown> | undefined) ??
      ((message?.info as Record<string, unknown> | undefined)
        ?.total_token_usage as Record<string, unknown> | undefined);
    if (usage) {
      if (typeof usage.input_tokens === "number") {
        inputTokens = usage.input_tokens;
      }
      if (typeof usage.output_tokens === "number") {
        outputTokens = usage.output_tokens;
      }
    }
  }

  if (!text) text = stdout.trim();
  return { text, inputTokens, outputTokens };
}
