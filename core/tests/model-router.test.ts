import assert from "node:assert/strict";
import test from "node:test";
import type { TaskEnvelope } from "../src/contracts";
import {
  exampleModelRegistry,
  routeModel,
} from "../src/routing/model-router";

function task(
  overrides: Partial<TaskEnvelope> = {},
): TaskEnvelope {
  return {
    id: "task",
    objective: "문서를 분류한다.",
    category: "research",
    projectHints: [],
    risk: "low",
    complexity: 0.1,
    expectedInputTokens: 2_000,
    expectedOutputTokens: 300,
    requiresTools: false,
    deterministicCheckAvailable: true,
    privacy: "cloud-allowed",
    attempt: 0,
    ...overrides,
  };
}

test("uses local capacity for cheap verifiable work", () => {
  const decision = routeModel(task(), exampleModelRegistry);
  assert.equal(decision.selected.tier, "local");
});

test("raises the capability floor for risky complex work", () => {
  const decision = routeModel(
    task({
      category: "mixed",
      risk: "high",
      complexity: 0.95,
      expectedInputTokens: 40_000,
      expectedOutputTokens: 5_000,
      requiresTools: true,
      deterministicCheckAvailable: false,
    }),
    exampleModelRegistry,
  );

  assert.equal(decision.selected.tier, "premium");
});

test("keeps local-only tasks on local models", () => {
  const decision = routeModel(
    task({ privacy: "local-only" }),
    exampleModelRegistry,
  );

  assert.equal(decision.selected.local, true);
  assert.ok(decision.rejected.every(({ model }) => !model.local));
});
