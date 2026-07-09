import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildRunSummaryPrompt,
  buildUnitCompressPrompt,
  buildRuleProjectSummary,
  compressUnitVerbatim,
  formatStoredSummary,
  needsProjectRollup,
  needsUnitCompression,
  normalizeLlmSummaryText,
  ruleCompressText,
  UNIT_COMPRESS_THRESHOLD_CHARS,
  type CompressedUnit,
} from "../src/context/hierarchical-summary";

describe("hierarchical-summary (G18 2단계)", () => {
  it("needsUnitCompression는 임계값을 넘으면 true", () => {
    assert.equal(needsUnitCompression("a".repeat(100)), false);
    assert.equal(
      needsUnitCompression("a".repeat(UNIT_COMPRESS_THRESHOLD_CHARS + 1)),
      true,
    );
  });

  it("ruleCompressText는 긴 텍스트를 head/tail로 자른다", () => {
    const text = "가".repeat(900);
    const compressed = ruleCompressText(text, 200);
    assert.ok(compressed.includes("중략"));
    assert.ok(compressed.length <= 220);
  });

  it("compressUnitVerbatim는 짧은 산출물은 그대로 둔다", () => {
    const unit = compressUnitVerbatim("u1", "보고서", "짧은 본문");
    assert.equal(unit.method, "verbatim");
    assert.equal(unit.text, "짧은 본문");
  });

  it("buildUnitCompressPrompt는 유닛 제목과 산출물을 포함한다", () => {
    const prompt = buildUnitCompressPrompt({
      command: "주간 보고",
      unitTitle: "초안",
      deliverable: "본문",
    });
    assert.match(prompt.user, /주간 보고/);
    assert.match(prompt.user, /초안/);
    assert.match(prompt.user, /본문/);
  });

  it("buildRunSummaryPrompt는 압축된 유닛 블록을 나열한다", () => {
    const units: CompressedUnit[] = [
      {
        unitId: "u1",
        title: "보고서",
        originalChars: 800,
        text: "압축 본문",
        method: "llm",
      },
    ];
    const prompt = buildRunSummaryPrompt({
      command: "주간 보고",
      reportSummary: "완료",
      units,
    });
    assert.match(prompt.user, /보고서/);
    assert.match(prompt.user, /압축 본문/);
  });

  it("normalizeLlmSummaryText는 코드펜스와 요약 접두사를 제거한다", () => {
    assert.equal(
      normalizeLlmSummaryText("```\n핵심 결론\n```"),
      "핵심 결론",
    );
    assert.equal(normalizeLlmSummaryText("요약: 한 줄"), "한 줄");
  });

  it("formatStoredSummary는 run 요약과 유닛 줄을 합친다", () => {
    const text = formatStoredSummary("run 요약", [
      {
        unitId: "u1",
        title: "보고서",
        originalChars: 100,
        text: "유닛 요약",
        method: "llm",
      },
    ]);
    assert.match(text, /^요약: run 요약/);
    assert.match(text, /\[보고서\] 유닛 요약/);
  });

  it("buildRuleProjectSummary는 최근 run 헤드라인을 나열한다", () => {
    const text = buildRuleProjectSummary("OfficeAI", [
      {
        runId: "r1",
        command: "주간 보고",
        summary: "요약: 보고 완료",
        finishedAt: "2026-07-08T00:00:00.000Z",
      },
    ]);
    assert.match(text, /프로젝트: OfficeAI/);
    assert.match(text, /보고 완료/);
  });

  it("needsProjectRollup은 run이 2건 이상이면 true", () => {
    const runs = [
      {
        runId: "r1",
        command: "a",
        summary: "요약: 1",
        finishedAt: "2026-07-08",
      },
      {
        runId: "r2",
        command: "b",
        summary: "요약: 2",
        finishedAt: "2026-07-09",
      },
    ];
    assert.equal(needsProjectRollup(runs), true);
  });
});
