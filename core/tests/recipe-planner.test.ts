import assert from "node:assert/strict";
import test from "node:test";
import type { TaskEnvelope } from "../src/contracts";
import { planWork } from "../src/planning/recipe-planner";

const base: TaskEnvelope = {
  id: "task",
  objective: "목록을 정리한다",
  category: "research",
  projectHints: ["gtsn-backend"],
  risk: "low",
  complexity: 0.2,
  expectedInputTokens: 1_000,
  expectedOutputTokens: 500,
  requiresTools: false,
  deterministicCheckAvailable: true,
  privacy: "cloud-allowed",
  attempt: 0,
};

test("does not create a multi-agent chain for a simple task", () => {
  const plan = planWork(base);
  assert.equal(plan.strategy, "single-worker");
  assert.deepEqual(
    plan.workUnits.map(({ id }) => id),
    ["execute", "report"],
  );
});

test("separates execution and verification for risky work", () => {
  const plan = planWork({
    ...base,
    objective: "운영 배포까지 진행한다",
    category: "development",
    risk: "high",
    complexity: 0.8,
  });
  assert.equal(plan.strategy, "role-separated");
  assert.equal(
    plan.workUnits.find(({ id }) => id === "verify")?.role,
    "skeptic",
  );
  assert.ok(plan.approvalReasons.length > 0);
});

test("does not duplicate planner calls for a read-only planning task", () => {
  const plan = planWork({
    ...base,
    category: "mixed",
    complexity: 0.5,
    projectHints: ["gtsn-backend", "gtsn-admin"],
  });

  assert.equal(plan.strategy, "role-separated");
  assert.equal(plan.workUnits.some(({ id }) => id === "plan"), false);
  assert.deepEqual(
    plan.workUnits.map(({ id }) => id),
    ["context", "execute", "verify", "report"],
  );
});
