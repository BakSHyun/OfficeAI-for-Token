/**
 * run 완료 시 요약을 저장하고, 다음 명령에 최근 맥락을 첨부한다 (G18 1단계).
 * LLM 호출 없이 규칙 기반으로 요약해 토큰을 쓰지 않는다.
 */
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { RunReport } from "../core/src/orchestration/contracts";

const SUMMARIES_FILE = "run-summaries.jsonl";
const DEFAULT_LIMIT = 3;
const MAX_SUMMARY_CHARS = 1_500;
const MAX_DELIVERABLE_SNIPPET = 280;

export type StoredRunSummary = {
  runId: string;
  command: string;
  summary: string;
  finishedAt: string;
};

export function summariesPath(userDataPath: string) {
  return join(userDataPath, SUMMARIES_FILE);
}

export function buildRunSummaryText(report: RunReport): string {
  const lines = [`요약: ${report.summary.trim()}`];
  for (const item of report.deliverables.slice(0, 4)) {
    const body = item.deliverable.replace(/\s+/g, " ").trim();
    const snippet =
      body.length > MAX_DELIVERABLE_SNIPPET
        ? `${body.slice(0, MAX_DELIVERABLE_SNIPPET)}…`
        : body;
    lines.push(`[${item.title}] ${snippet}`);
  }
  return lines.join("\n").slice(0, MAX_SUMMARY_CHARS);
}

export async function appendRunSummary(
  userDataPath: string,
  report: RunReport,
): Promise<void> {
  const entry: StoredRunSummary = {
    runId: report.runId,
    command: report.command,
    summary: buildRunSummaryText(report),
    finishedAt: report.finishedAt ?? new Date().toISOString(),
  };
  await mkdir(userDataPath, { recursive: true });
  await appendFile(
    summariesPath(userDataPath),
    `${JSON.stringify(entry)}\n`,
    "utf8",
  );
}

export async function loadRecentSummaries(
  userDataPath: string,
  limit = DEFAULT_LIMIT,
): Promise<StoredRunSummary[]> {
  const path = summariesPath(userDataPath);
  if (!existsSync(path)) return [];
  const lines = (await readFile(path, "utf8")).split(/\r?\n/).filter(Boolean);
  const parsed: StoredRunSummary[] = [];
  for (const line of lines.slice(-limit * 2)) {
    try {
      parsed.push(JSON.parse(line) as StoredRunSummary);
    } catch {
      // 손상된 줄 무시
    }
  }
  return parsed.slice(-limit);
}

export function formatContextPrefix(summaries: StoredRunSummary[]): string {
  if (summaries.length === 0) return "";
  const blocks = summaries.map(
    (item, index) =>
      `### 최근 업무 ${index + 1} (${item.finishedAt.slice(0, 10)})\n명령: ${item.command}\n${item.summary}`,
  );
  return `[최근 업무 맥락 — 참고용]\n${blocks.join("\n\n")}`;
}

export function enrichCommandWithContext(
  command: string,
  summaries: StoredRunSummary[],
): string {
  const prefix = formatContextPrefix(summaries);
  if (!prefix) return command;
  return `${prefix}\n\n[현재 지시]\n${command}`;
}
