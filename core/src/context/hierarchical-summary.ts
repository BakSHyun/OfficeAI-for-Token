/** G18 2단계: 유닛→run 계층 압축 (순수 함수, LLM 호출 없음) */

export const UNIT_COMPRESS_THRESHOLD_CHARS = 600;
export const UNIT_COMPRESSED_MAX_CHARS = 420;
export const RUN_SUMMARY_MAX_CHARS = 1_200;
export const STORED_SUMMARY_MAX_CHARS = 1_500;

export type CompressionMethod = "verbatim" | "rule" | "llm";

export type CompressedUnit = {
  unitId: string;
  title: string;
  originalChars: number;
  text: string;
  method: CompressionMethod;
};

export function normalizedLength(text: string) {
  return text.replace(/\s+/g, " ").trim().length;
}

export function needsUnitCompression(text: string) {
  return normalizedLength(text) > UNIT_COMPRESS_THRESHOLD_CHARS;
}

export function ruleCompressText(text: string, maxChars: number) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  const head = Math.floor(maxChars * 0.62);
  const tail = Math.max(40, maxChars - head - 24);
  const omitted = normalized.length - head - tail;
  return `${normalized.slice(0, head)} …(중략 ${omitted}자)… ${normalized.slice(-tail)}`;
}

export function buildUnitCompressPrompt(input: {
  command: string;
  unitTitle: string;
  deliverable: string;
}) {
  return {
    system:
      "너는 업무 산출물 압축기다. 원문의 사실·결론·수치·다음 액션만 남기고 400자 이내 한국어로 요약한다. 추측이나 새 내용을 추가하지 마라.",
    user: `원래 명령: ${input.command}\n유닛: ${input.unitTitle}\n\n산출물:\n${input.deliverable.slice(0, 12_000)}`,
  };
}

export function buildRunSummaryPrompt(input: {
  command: string;
  reportSummary: string;
  units: CompressedUnit[];
}) {
  const unitBlocks = input.units
    .map(
      (unit) =>
        `- [${unit.title}] (${unit.method}, ${unit.originalChars}자→${unit.text.length}자)\n${unit.text}`,
    )
    .join("\n\n");
  return {
    system:
      "너는 업무 기록 요약기다. 다음 업무 run을 의사결정자가 1분 안에 읽을 수 있는 한국어 요약(3~5문장)으로 압축한다. 새로운 사실을 만들지 마라.",
    user: `명령: ${input.command}\n오케스트레이터 요약: ${input.reportSummary}\n\n유닛 산출물:\n${unitBlocks}`,
  };
}

export function normalizeLlmSummaryText(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:\w+)?\s*([\s\S]*?)```/);
  const body = (fenced?.[1] ?? trimmed).trim();
  return body.replace(/^요약:\s*/i, "").trim();
}

export function formatStoredSummary(runSummary: string, units: CompressedUnit[]) {
  const lines = [`요약: ${runSummary.trim()}`];
  for (const unit of units) {
    lines.push(`[${unit.title}] ${unit.text}`);
  }
  return lines.join("\n").slice(0, STORED_SUMMARY_MAX_CHARS);
}

export const PROJECT_SUMMARY_MAX_CHARS = 1_500;
export const PROJECT_ROLLUP_THRESHOLD_CHARS = 1_800;
export const PROJECT_RUNS_WINDOW = 8;

export type ProjectRunSnippet = {
  runId: string;
  command: string;
  summary: string;
  finishedAt: string;
};

export type StoredProjectSummary = {
  project: string;
  summary: string;
  updatedAt: string;
  runCount: number;
  summaryMethod?: "rule" | "llm";
  lastRunIds: string[];
};

export function pickPrimaryProject(projectHints: string[]) {
  return projectHints[0]?.trim() || undefined;
}

export function extractRunHeadline(summary: string) {
  const firstLine = summary.split(/\r?\n/).find((line) => line.trim()) ?? "";
  return firstLine.replace(/^요약:\s*/i, "").trim();
}

export function buildProjectSummaryPrompt(input: {
  project: string;
  runs: ProjectRunSnippet[];
}) {
  const runBlocks = input.runs
    .map(
      (run) =>
        `- (${run.finishedAt.slice(0, 10)}) 명령: ${run.command}\n${run.summary}`,
    )
    .join("\n\n");
  return {
    system:
      "너는 프로젝트 장기 기록 요약기다. 여러 업무 run을 하나의 프로젝트 맥락(5~7문장)으로 압축한다. 반복·세부는 줄이고 진행 상황·결정·미해결 과제만 남긴다. 새 사실을 만들지 마라.",
    user: `프로젝트: ${input.project}\n\n최근 run 기록:\n${runBlocks}`,
  };
}

export function formatProjectContextBlock(project: string, summary: string) {
  const body = summary.trim();
  if (!body) return "";
  return `[프로젝트 맥락 — ${project}]\n${body}`;
}

export function buildRuleProjectSummary(
  project: string,
  runs: ProjectRunSnippet[],
) {
  const lines = [`프로젝트: ${project}`];
  for (const run of runs.slice(-5)) {
    const headline = extractRunHeadline(run.summary) || run.command;
    lines.push(
      `- (${run.finishedAt.slice(0, 10)}) ${run.command}: ${headline}`,
    );
  }
  return lines.join("\n").slice(0, PROJECT_SUMMARY_MAX_CHARS);
}

export function combinedRunSummaryChars(runs: ProjectRunSnippet[]) {
  return runs.reduce((total, run) => total + normalizedLength(run.summary), 0);
}

export function needsProjectRollup(runs: ProjectRunSnippet[]) {
  return (
    runs.length >= 2 ||
    combinedRunSummaryChars(runs) > PROJECT_ROLLUP_THRESHOLD_CHARS
  );
}

export function compressUnitVerbatim(
  unitId: string,
  title: string,
  deliverable: string,
): CompressedUnit {
  const text = deliverable.replace(/\s+/g, " ").trim();
  return {
    unitId,
    title,
    originalChars: text.length,
    text:
      text.length > UNIT_COMPRESSED_MAX_CHARS
        ? ruleCompressText(text, UNIT_COMPRESSED_MAX_CHARS)
        : text,
    method: needsUnitCompression(deliverable) ? "rule" : "verbatim",
  };
}
