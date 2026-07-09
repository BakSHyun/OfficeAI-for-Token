import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RunReport } from "../src/orchestration/contracts";
import type { ProviderConfig } from "../src/providers/contracts";
import { createProviderRegistry } from "../src/providers/registry";
import { buildHierarchicalRunSummary } from "../../electron/run-summary-llm";

const mockConfig: ProviderConfig = {
  concurrency: 2,
  tiers: {
    local: {
      provider: "mock",
      model: "mock-local",
      inputCostPerMillion: 0,
      outputCostPerMillion: 0,
    },
    economy: {
      provider: "mock",
      model: "mock-economy",
      inputCostPerMillion: 0.25,
      outputCostPerMillion: 2,
    },
    standard: {
      provider: "mock",
      model: "mock-standard",
      inputCostPerMillion: 3,
      outputCostPerMillion: 15,
    },
    premium: {
      provider: "mock",
      model: "mock-premium",
      inputCostPerMillion: 15,
      outputCostPerMillion: 75,
    },
  },
};

function completedReport(deliverable: string): RunReport {
  return {
    runId: "run-llm-1",
    command: "주간 보고 작성",
    status: "completed",
    summary: "주간 보고 초안을 완료했습니다.",
    deliverables: [
      {
        unitId: "u1",
        title: "보고서",
        deliverable,
      },
    ],
    verdicts: [],
    totalUsage: {
      inputTokens: 100,
      outputTokens: 200,
      costUsd: 0.01,
    },
    startedAt: "2026-07-08T00:00:00.000Z",
    finishedAt: "2026-07-08T00:05:00.000Z",
  };
}

describe("run-summary-llm (G18 2단계)", () => {
  it("완료 run은 economy LLM으로 계층 요약을 만든다", async () => {
    const registry = createProviderRegistry(mockConfig);
    const longBody = "핵심 내용. ".repeat(120);
    const result = await buildHierarchicalRunSummary(
      completedReport(longBody),
      registry,
    );
    assert.equal(result.method, "llm");
    assert.match(result.text, /^요약:/);
    assert.match(result.text, /\[보고서\]/);
    assert.ok(result.text.length > 40);
  });

  it("실패 run은 규칙 요약으로 폴백한다", async () => {
    const registry = createProviderRegistry(mockConfig);
    const report = completedReport("짧음");
    report.status = "failed";
    const result = await buildHierarchicalRunSummary(report, registry);
    assert.equal(result.method, "rule");
    assert.match(result.text, /주간 보고 초안/);
  });
});
