import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildRunSummaryText,
  enrichCommandWithContext,
  extractCurrentCommand,
  formatContextPrefix,
  type StoredRunSummary,
} from "../../electron/run-summaries";
import type { StoredProjectSummary } from "../src/context/hierarchical-summary";
import type { RunReport } from "../src/orchestration/contracts";

const sampleReport: RunReport = {
  runId: "run-1",
  command: "주간 보고 작성",
  status: "completed",
  summary: "주간 보고 초안을 완료했습니다.",
  deliverables: [
    {
      unitId: "u1",
      title: "보고서",
      deliverable: "A".repeat(400),
    },
  ],
  verdicts: [],
  totalUsage: {
    inputTokens: 100,
    outputTokens: 200,
    costUsd: 0.01,
  },
  startedAt: "2026-07-07T00:00:00.000Z",
  finishedAt: "2026-07-07T00:05:00.000Z",
};

describe("run-summaries (G18 1단계)", () => {
  it("buildRunSummaryText는 요약과 산출물 스니펫을 만든다", () => {
    const text = buildRunSummaryText(sampleReport);
    assert.match(text, /주간 보고 초안/);
    assert.match(text, /\[보고서\]/);
    assert.ok(text.length <= 1500);
  });

  it("formatContextPrefix는 최근 업무 블록을 만든다", () => {
    const summaries: StoredRunSummary[] = [
      {
        runId: "run-1",
        command: "테스트",
        summary: "요약 본문",
        finishedAt: "2026-07-07T00:00:00.000Z",
      },
    ];
    const prefix = formatContextPrefix(summaries);
    assert.match(prefix, /최근 업무 맥락/);
    assert.match(prefix, /테스트/);
  });

  it("enrichCommandWithContext는 맥락이 없으면 원문을 그대로 둔다", () => {
    assert.equal(enrichCommandWithContext("새 지시", []), "새 지시");
  });

  it("enrichCommandWithContext는 맥락을 현재 지시 앞에 붙인다", () => {
    const enriched = enrichCommandWithContext("새 지시", [
      {
        runId: "r",
        command: "이전",
        summary: "이전 요약",
        finishedAt: "2026-07-07",
      },
    ]);
    assert.match(enriched, /\[현재 지시\]/);
    assert.match(enriched, /새 지시/);
    assert.match(enriched, /이전 요약/);
  });

  it("extractCurrentCommand는 맥락 블록 뒤 사용자 지시만 추출한다", () => {
    const enriched = enrichCommandWithContext("실제 지시", [
      {
        runId: "r",
        command: "이전",
        summary: "이전 요약",
        finishedAt: "2026-07-07",
      },
    ]);
    assert.equal(extractCurrentCommand(enriched), "실제 지시");
  });

  it("enrichCommandWithContext는 프로젝트 맥락을 최근 업무보다 앞에 둔다", () => {
    const projectSummary: StoredProjectSummary = {
      project: "OfficeAI",
      summary: "프로젝트 진행 요약",
      updatedAt: "2026-07-08",
      runCount: 2,
      lastRunIds: ["r1"],
    };
    const enriched = enrichCommandWithContext("새 지시", [], projectSummary);
    assert.match(enriched, /\[프로젝트 맥락 — OfficeAI\]/);
    assert.match(enriched, /프로젝트 진행 요약/);
    assert.match(enriched, /\[현재 지시\]/);
  });
});
