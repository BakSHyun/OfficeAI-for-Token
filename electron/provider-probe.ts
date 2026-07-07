/**
 * 설정 화면용 provider 연결 실측. 코어 오케스트레이터 밖에서 동작한다.
 */
import { runProcess } from "../core/src/process/process-runner";
import { resolveCursorAgentCommand, isCursorEditorCliVersion } from "../core/src/providers/cursor-agent-cli";
import type { ProviderConfig } from "../core/src/providers/contracts";

export type ProviderProbeInput = {
  providers: ProviderConfig;
  apiKeyPresence: Record<string, boolean>;
  apiKeys?: Record<string, string>;
};

export type ProviderProbeResult = {
  provider: string;
  ok: boolean;
  detail: string;
};

const PROBE_TIMEOUT_MS = 8_000;

async function probeHttp(
  url: string,
  headers?: Record<string, string>,
): Promise<{ ok: boolean; detail: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    if (response.ok) {
      return { ok: true, detail: "응답 정상" };
    }
    return { ok: false, detail: `HTTP ${response.status}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("abort")) {
      return { ok: false, detail: "응답 시간 초과" };
    }
    return { ok: false, detail: "서버에 연결할 수 없음" };
  } finally {
    clearTimeout(timer);
  }
}

async function probeCli(
  command: string,
  args: string[],
  cwd: string,
): Promise<{ ok: boolean; detail: string }> {
  const result = await runProcess({
    command,
    args,
    cwd,
    timeoutMs: PROBE_TIMEOUT_MS,
    maxOutputBytes: 2_000,
  });
  if (result.timedOut) {
    return { ok: false, detail: "실행 시간 초과" };
  }
  if (result.exitCode === 0) {
    const version =
      result.stdout.split(/\r?\n/).find(Boolean)?.trim() ||
      result.stderr.split(/\r?\n/).find(Boolean)?.trim();
    return { ok: true, detail: version ? version.slice(0, 80) : "CLI 응답 확인" };
  }
  const errLine =
    result.stderr.split(/\r?\n/).find(Boolean)?.trim() ||
    result.stdout.split(/\r?\n/).find(Boolean)?.trim();
  if (errLine?.toLowerCase().includes("login")) {
    return { ok: false, detail: "로그인 필요 — 터미널에서 login 실행" };
  }
  return {
    ok: false,
    detail: errLine?.slice(0, 80) || `종료 코드 ${result.exitCode ?? 1}`,
  };
}

export async function probeProvider(
  provider: string,
  input: ProviderProbeInput,
  cwd: string,
): Promise<ProviderProbeResult> {
  const { providers, apiKeyPresence, apiKeys } = input;

  switch (provider) {
    case "mock":
      return { provider, ok: true, detail: "키 없이 동작" };
    case "openai": {
      if (!apiKeyPresence.openai && !apiKeys?.openai) {
        return { provider, ok: false, detail: "API 키 필요" };
      }
      const base = (providers.baseUrls?.openai ?? "https://api.openai.com/v1").replace(
        /\/$/,
        "",
      );
      const key = apiKeys?.openai ?? process.env.OPENAI_API_KEY ?? "";
      const result = await probeHttp(`${base}/models`, {
        Authorization: `Bearer ${key}`,
      });
      return { provider, ...result };
    }
    case "anthropic": {
      if (!apiKeyPresence.anthropic && !apiKeys?.anthropic) {
        return { provider, ok: false, detail: "API 키 필요" };
      }
      return { provider, ok: true, detail: "API 키 저장됨 (실행 시 검증)" };
    }
    case "lmstudio": {
      const base = (
        providers.baseUrls?.lmstudio ?? "http://localhost:1234/v1"
      ).replace(/\/$/, "");
      const result = await probeHttp(`${base}/models`);
      return {
        provider,
        ok: result.ok,
        detail: result.ok
          ? `서버 연결됨 (${base})`
          : `LM Studio 서버 꺼짐 — Developer 탭에서 Start Server (${base})`,
      };
    }
    case "cursor-agent-cli": {
      const { command, prefixArgs } = resolveCursorAgentCommand(
        providers.cursorAgentCli,
      );
      const result = await probeCli(command, [...prefixArgs, "--version"], cwd);
      if (
        result.ok &&
        result.detail &&
        isCursorEditorCliVersion(result.detail)
      ) {
        return {
          provider,
          ok: false,
          detail:
            "Cursor 에디터로 잘못 연결됨 — agent CLI 설치 필요 (irm 'https://cursor.com/install?win32=true' | iex)",
        };
      }
      return { provider, ...result };
    }
    case "codex-cli": {
      const command = providers.codexCli?.command ?? "codex";
      const result = await probeCli(command, ["--version"], cwd);
      return { provider, ...result };
    }
    default:
      return { provider, ok: false, detail: "알 수 없는 provider" };
  }
}

export async function probeUsedProviders(
  input: ProviderProbeInput,
  cwd: string,
): Promise<ProviderProbeResult[]> {
  const used = Array.from(
    new Set(Object.values(input.providers.tiers).map((binding) => binding.provider)),
  );
  const results: ProviderProbeResult[] = [];
  for (const provider of used) {
    results.push(await probeProvider(provider, input, cwd));
  }
  return results;
}
