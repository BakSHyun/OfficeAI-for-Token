/**
 * 산출물에서 감지된 액션 제안을 실제로 수행하는 실행 레이어.
 * 코어 오케스트레이터 밖에서 동작하며, 모든 실행은 renderer의 명시 요청
 * + (run-command는) main의 네이티브 확인 대화상자를 거친다.
 */
import { exec } from "node:child_process";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import {
  isSafeRelativePath,
  normalizeRelativePath,
} from "../shared/action-blocks";
import type { ExecuteActionResult } from "./ipc-contract";

const WORKSPACE_FILE = "action-workspace.json";
const LOG_FILE = "action-log.jsonl";
const COMMAND_TIMEOUT_MS = 120_000;
const OUTPUT_LIMIT = 400;

export function resolveWritePath(
  baseDir: string,
  rawPath: string,
): string | undefined {
  const normalized = normalizeRelativePath(rawPath);
  if (!isSafeRelativePath(normalized)) return undefined;
  const target = resolve(baseDir, normalized);
  // 심볼릭 문자 없이도 resolve 결과가 밖을 가리키는 경우까지 이중 차단
  const rel = relative(resolve(baseDir), target);
  if (rel.startsWith("..") || isAbsolute(rel)) return undefined;
  return target;
}

export function summarizeCommandOutput(
  stdout: string,
  stderr: string,
  limit = OUTPUT_LIMIT,
): string {
  const merged = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
  if (!merged) return "(출력 없음)";
  return merged.length <= limit ? merged : `…${merged.slice(-limit)}`;
}

export async function loadActionWorkspace(
  userDataPath: string,
): Promise<string | undefined> {
  try {
    const raw = await readFile(join(userDataPath, WORKSPACE_FILE), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as { folderPath?: unknown }).folderPath === "string"
    ) {
      return (parsed as { folderPath: string }).folderPath;
    }
  } catch {
    // 미설정 상태로 취급
  }
  return undefined;
}

export async function saveActionWorkspace(
  userDataPath: string,
  folderPath: string,
): Promise<void> {
  await writeFile(
    join(userDataPath, WORKSPACE_FILE),
    `${JSON.stringify({ folderPath }, null, 2)}\n`,
    "utf8",
  );
}

export async function appendActionLog(
  userDataPath: string,
  entry: Record<string, unknown>,
): Promise<void> {
  const line = JSON.stringify({ at: new Date().toISOString(), ...entry });
  await appendFile(join(userDataPath, LOG_FILE), `${line}\n`, "utf8");
}

export async function executeWriteFile(
  baseDir: string,
  rawPath: string,
  content: string,
): Promise<ExecuteActionResult> {
  const target = resolveWritePath(baseDir, rawPath);
  if (!target) {
    return { ok: false, error: "허용되지 않는 경로입니다" };
  }
  try {
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content.endsWith("\n") ? content : `${content}\n`, "utf8");
    return { ok: true, detail: target };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "파일 저장 실패",
    };
  }
}

export function executeRunCommand(
  baseDir: string,
  command: string,
): Promise<ExecuteActionResult> {
  return new Promise((settle) => {
    exec(
      command,
      {
        cwd: baseDir,
        timeout: COMMAND_TIMEOUT_MS,
        maxBuffer: 4 * 1024 * 1024,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        const detail = summarizeCommandOutput(stdout, stderr);
        if (error) {
          settle({
            ok: false,
            detail,
            error: error.message.includes("ETIMEDOUT")
              ? "실행 시간 초과 (120초)"
              : `종료 코드 ${error.code ?? 1}`,
          });
          return;
        }
        settle({ ok: true, detail });
      },
    );
  });
}
