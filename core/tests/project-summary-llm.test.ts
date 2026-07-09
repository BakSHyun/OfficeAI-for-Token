import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ProviderConfig } from "../src/providers/contracts";
import { createProviderRegistry } from "../src/providers/registry";
import { buildHierarchicalProjectSummary } from "../../electron/project-summary-llm";

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

describe("project-summary-llm (G18 2단계 3)", () => {
  it("run 2건 이상이면 economy LLM으로 프로젝트 요약을 만든다", async () => {
    const registry = createProviderRegistry(mockConfig);
    const result = await buildHierarchicalProjectSummary(
      "OfficeAI",
      [
        {
          runId: "r1",
          command: "기획",
          summary: "요약: 기획 완료",
          finishedAt: "2026-07-07",
        },
        {
          runId: "r2",
          command: "개발",
          summary: "요약: 개발 착수",
          finishedAt: "2026-07-08",
        },
      ],
      registry,
    );
    assert.equal(result.method, "llm");
    assert.ok(result.summary.length > 10);
  });

  it("run 1건이면 규칙 요약으로 run 본문을 그대로 쓴다", async () => {
    const registry = createProviderRegistry(mockConfig);
    const result = await buildHierarchicalProjectSummary(
      "OfficeAI",
      [
        {
          runId: "r1",
          command: "기획",
          summary: "요약: 기획 완료",
          finishedAt: "2026-07-07",
        },
      ],
      registry,
    );
    assert.equal(result.method, "rule");
    assert.equal(result.summary, "요약: 기획 완료");
  });
});
