import assert from "node:assert/strict";
import test from "node:test";
import type { WorkProfile } from "../src/memory/work-profile";
import { createTaskEnvelope } from "../src/intake/task-intake";

const profile: WorkProfile = {
  generatedAt: "2026-07-06T00:00:00.000Z",
  eventCount: 100,
  currentFocus: [
    {
      name: "current-project",
      score: 12,
      eventCount: 20,
      lastSeen: "2026-07-06T00:00:00.000Z",
    },
  ],
  topProjects: [
    {
      name: "gtsn-backend",
      score: 10,
      eventCount: 80,
      lastSeen: "2026-07-06T00:00:00.000Z",
    },
  ],
  topThemes: [],
  recentWork: [],
};

test("infers active project when command omits it", () => {
  const task = createTaskEnvelope(
    "최근 결제 구현을 분석하고 테스트를 추가해줘",
    profile,
  );
  assert.equal(task.category, "development");
  assert.deepEqual(task.projectHints, ["current-project"]);
  assert.equal(task.risk, "medium");
});

test("forces local-only handling when a secret shape appears", () => {
  const task = createTaskEnvelope(
    "이 token=abcdefghijklmnopqrstuvwxyz 값을 분류해줘",
    profile,
  );
  assert.equal(task.privacy, "local-only");
  assert.doesNotMatch(task.objective, /abcdefghijklmnopqrstuvwxyz/);
});

test("treats a payment planning request as read-only but payment execution as high risk", () => {
  const planning = createTaskEnvelope(
    "KCP 결제 이력을 파악하고 다음 개발 계획을 작성해줘",
    profile,
  );
  const execution = createTaskEnvelope(
    "운영에서 결제 취소를 실행해줘",
    profile,
  );

  assert.equal(planning.risk, "low");
  assert.equal(execution.risk, "high");
});
