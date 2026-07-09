/**
 * run 완료 시 요약을 저장하고, 다음 명령에 최근 맥락을 첨부한다 (G18).
 * 1단계: 규칙 기반 폴백. 2단계: economy LLM 계층 압축(유닛→run→프로젝트).
 */
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { RunReport } from "../core/src/orchestration/contracts";
import type { ProviderRegistry } from "../core/src/providers/registry";
import type { WorkProfile } from "../core/src/memory/work-profile";
import { inferProjectHints } from "../core/src/intake/task-intake";
import { buildHierarchicalRunSummary } from "./run-summary-llm";

import {
  formatProjectContextBlock,
  pickPrimaryProject,
  STORED_SUMMARY_MAX_CHARS,
  type StoredProjectSummary,
} from "../core/src/context/hierarchical-summary";

const SUMMARIES_FILE = "run-summaries.jsonl";
const DEFAULT_LIMIT = 3;
const MAX_DELIVERABLE_SNIPPET = 280;

export type SummaryMethod = "rule" | "llm";

export type StoredRunSummary = {
  runId: string;
  command: string;
  summary: string;
  finishedAt: string;
  project?: string;
  summaryMethod?: SummaryMethod;
};

export function extractCurrentCommand(command: string) {
  const marker = "[현재 지시]";
  const index = command.lastIndexOf(marker);
  if (index >= 0) {
    return command.slice(index + marker.length).trim();
  }
  return command.trim();
}

export function inferProjectForSummary(command: string, profile?: WorkProfile) {
  return pickPrimaryProject(inferProjectHints(command, profile));
}

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
  return lines.join("\n").slice(0, STORED_SUMMARY_MAX_CHARS);
}

export async function appendRunSummary(
  userDataPath: string,
  report: RunReport,
  registry?: ProviderRegistry,
  profile?: WorkProfile,
): Promise<StoredRunSummary> {
  const command = extractCurrentCommand(report.command);
  let summary = buildRunSummaryText(report);
  let summaryMethod: SummaryMethod = "rule";
  if (registry && report.status === "completed") {
    const result = await buildHierarchicalRunSummary(report, registry);
    summary = result.text;
    summaryMethod = result.method;
  }
  const entry: StoredRunSummary = {
    runId: report.runId,
    command,
    summary,
    finishedAt: report.finishedAt ?? new Date().toISOString(),
    project: inferProjectForSummary(command, profile),
    summaryMethod,
  };
  await mkdir(userDataPath, { recursive: true });
  await appendFile(
    summariesPath(userDataPath),
    `${JSON.stringify(entry)}\n`,
    "utf8",
  );
  return entry;
}

export async function loadAllRunSummaries(
  userDataPath: string,
): Promise<StoredRunSummary[]> {
  const path = summariesPath(userDataPath);
  if (!existsSync(path)) return [];
  const lines = (await readFile(path, "utf8")).split(/\r?\n/).filter(Boolean);
  const parsed: StoredRunSummary[] = [];
  for (const line of lines) {
    try {
      parsed.push(JSON.parse(line) as StoredRunSummary);
    } catch {
      // 손상된 줄 무시
    }
  }
  return parsed;
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
  projectSummary?: StoredProjectSummary,
): string {
  const blocks: string[] = [];
  if (projectSummary) {
    const projectBlock = formatProjectContextBlock(
      projectSummary.project,
      projectSummary.summary,
    );
    if (projectBlock) blocks.push(projectBlock);
  }
  const recentBlock = formatContextPrefix(summaries);
  if (recentBlock) blocks.push(recentBlock);
  if (blocks.length === 0) return command;
  return `${blocks.join("\n\n")}\n\n[현재 지시]\n${command}`;
}
