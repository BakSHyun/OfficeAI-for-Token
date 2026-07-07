import { existsSync } from "node:fs";
import { join } from "node:path";
import { estimateTokens } from "../context/token-estimator";
import { runProcess } from "../process/process-runner";
import type { LLMProvider, LLMRequest, LLMResponse } from "./contracts";

export type CursorAgentCliProviderOptions = {
  /** 실행 파일. 비우면 OS별 기본 경로를 탐색 */
  command?: string;
  /** command 앞 서브커맨드 (일반적으로 비움) */
  commandPrefixArgs?: string[];
  cwd?: string;
  timeoutMs?: number;
};

/** Cursor 에디터 `cursor --version` 응답(예: 3.8.23) — Agent CLI가 아님 */
export function isCursorEditorCliVersion(version: string): boolean {
  const first = version.trim().split(/\s+/)[0] ?? "";
  return /^\d+\.\d+\.\d+$/.test(first);
}

export function resolveWindowsAgentInstall(): string | undefined {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return undefined;
  const agentCmd = join(localAppData, "cursor-agent", "agent.cmd");
  return existsSync(agentCmd) ? agentCmd : undefined;
}

function isCursorEditorMisconfig(options?: CursorAgentCliProviderOptions) {
  const command = options?.command?.trim().toLowerCase();
  const prefix = options?.commandPrefixArgs ?? [];
  return (
    command === "cursor" &&
    (prefix.length === 0 || prefix[0]?.toLowerCase() === "agent")
  );
}

export function resolveCursorAgentCommand(
  options?: CursorAgentCliProviderOptions,
): { command: string; prefixArgs: string[] } {
  const fromEnv = process.env.OFFICEAI_CURSOR_AGENT_COMMAND?.trim();
  if (fromEnv) {
    const parts = fromEnv.split(/\s+/).filter(Boolean);
    return { command: parts[0] ?? "agent", prefixArgs: parts.slice(1) };
  }

  const configuredCommand = options?.command?.trim();
  if (configuredCommand && !isCursorEditorMisconfig(options)) {
    return {
      command: configuredCommand,
      prefixArgs: options?.commandPrefixArgs ?? [],
    };
  }

  if (process.platform === "win32") {
    const installed = resolveWindowsAgentInstall();
    if (installed) {
      return { command: installed, prefixArgs: [] };
    }
  }

  return { command: "agent", prefixArgs: [] };
}

function isCursorAgentMissing(stderr: string) {
  return (
    stderr.includes("not recognized") ||
    stderr.includes("ENOENT") ||
    stderr.includes("not found") ||
    stderr.includes("내부 또는 외부 명령") ||
    stderr.includes("배치 파일이 아닙니다") ||
    stderr.includes("은(는) 내부 또는 외부 명령")
  );
}

export function buildCursorAgentPrompt(request: LLMRequest): string {
  const sections = request.messages.map((message) => {
    const label =
      message.role === "system"
        ? "[지침]"
        : message.role === "assistant"
          ? "[이전 응답]"
          : "[요청]";
    return `${label}\n${message.content}`;
  });

  if (request.jsonSchema) {
    sections.push(
      `[출력 형식]\n반드시 아래 JSON 스키마만 만족하는 JSON 객체 하나만 출력하세요. 마크다운 코드블록은 쓰지 마세요.\n${JSON.stringify(request.jsonSchema.schema)}`,
    );
  }

  return sections.join("\n\n");
}

export function buildCursorAgentArgs(request: LLMRequest): string[] {
  const args: string[] = [];
  if (request.jsonSchema) {
    args.push("--mode", "ask");
  }
  if (request.model && request.model !== "default") {
    args.push("--model", request.model);
  }
  args.push("--print", "--output-format", "json", "--force");
  return args;
}

export function extractCursorAgentOutput(stdout: string): {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
} {
  let text = "";
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;

  const consumeRecord = (record: Record<string, unknown>) => {
    const candidate = pickText(record);
    if (candidate) text = candidate;

    const usage = pickUsage(record);
    if (usage.inputTokens !== undefined) inputTokens = usage.inputTokens;
    if (usage.outputTokens !== undefined) outputTokens = usage.outputTokens;
  };

  const trimmed = stdout.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === "object") {
            consumeRecord(item as Record<string, unknown>);
          }
        }
      } else if (parsed && typeof parsed === "object") {
        consumeRecord(parsed as Record<string, unknown>);
      }
    } catch {
      // NDJSON/stream fallback below
    }
  }

  for (const line of stdout.split(/\r?\n/)) {
    const lineTrimmed = line.trim();
    if (!lineTrimmed.startsWith("{")) continue;
    try {
      consumeRecord(JSON.parse(lineTrimmed) as Record<string, unknown>);
    } catch {
      continue;
    }
  }

  if (!text) text = trimmed;
  return { text, inputTokens, outputTokens };
}

function pickText(record: Record<string, unknown>): string | undefined {
  const direct =
    record.result ??
    record.text ??
    record.message ??
    record.content ??
    record.response;
  if (typeof direct === "string" && direct.trim()) return direct;

  const nested = record.data;
  if (nested && typeof nested === "object") {
    return pickText(nested as Record<string, unknown>);
  }
  return undefined;
}

function pickUsage(record: Record<string, unknown>): {
  inputTokens?: number;
  outputTokens?: number;
} {
  const usage =
    (record.usage as Record<string, unknown> | undefined) ??
    (record.token_usage as Record<string, unknown> | undefined);
  if (!usage) return {};

  const input =
    usage.input_tokens ??
    usage.prompt_tokens ??
    usage.inputTokens ??
    usage.promptTokens;
  const output =
    usage.output_tokens ??
    usage.completion_tokens ??
    usage.outputTokens ??
    usage.completionTokens;

  return {
    inputTokens: typeof input === "number" ? input : undefined,
    outputTokens: typeof output === "number" ? output : undefined,
  };
}

/**
 * Cursor Agent CLI(`agent.cmd` / `agent`)를 LLM provider로 래핑.
 * `cursor agent`는 Cursor 에디터이므로 사용하지 않는다.
 */
export function createCursorAgentCliProvider(
  options?: CursorAgentCliProviderOptions,
): LLMProvider {
  const invocation = resolveCursorAgentCommand(options);

  return {
    id: "cursor-agent-cli",
    async complete(request: LLMRequest): Promise<LLMResponse> {
      const prompt = buildCursorAgentPrompt(request);
      const args = [
        ...invocation.prefixArgs,
        prompt,
        ...buildCursorAgentArgs(request),
      ];

      const result = await runProcess({
        command: invocation.command,
        args,
        cwd: options?.cwd ?? process.cwd(),
        timeoutMs: options?.timeoutMs ?? 10 * 60 * 1_000,
        maxOutputBytes: 400_000,
      });
      if (result.timedOut) {
        throw new Error("Cursor Agent CLI 호출이 시간 초과되었습니다.");
      }
      if (result.exitCode !== 0) {
        const hint = isCursorAgentMissing(result.stderr)
          ? " PowerShell에서 `irm 'https://cursor.com/install?win32=true' | iex` 로 Agent CLI를 설치한 뒤 모델 라우팅에서 경로를 확인하세요."
          : "";
        throw new Error(
          `Cursor Agent CLI 종료 코드 ${result.exitCode}: ${result.stderr.slice(0, 500)}${hint}`,
        );
      }

      const parsed = extractCursorAgentOutput(result.stdout);
      if (!parsed.text.trim()) {
        throw new Error(
          "Cursor Agent CLI가 빈 응답을 반환했습니다. 모델 라우팅 → Cursor Agent CLI 실행 명령이 Cursor 에디터(cursor)가 아닌 agent CLI인지 확인하세요.",
        );
      }

      return {
        text: parsed.text,
        usage: {
          inputTokens: parsed.inputTokens ?? estimateTokens(prompt),
          outputTokens: parsed.outputTokens ?? estimateTokens(parsed.text),
        },
        model: request.model,
        provider: "cursor-agent-cli",
      };
    },
  };
}
