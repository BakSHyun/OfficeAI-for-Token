import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createCharacterMachine,
  defaultLayout,
} from "../../src/office3d/character-machine";
import type { NodeDescriptor } from "../src/orchestration/contracts";

const executorNode: NodeDescriptor = {
  id: "plan:abc",
  kind: "executor",
  role: "planner",
  title: "기획냥",
  tier: "standard",
  workUnitId: "plan",
};

function now() {
  return new Date().toISOString();
}

test("캐릭터는 출근(entering) 후 책상에 도착하면 working이 된다", () => {
  const machine = createCharacterMachine();
  machine.applyEvent({
    type: "node:spawned",
    runId: "r1",
    node: executorNode,
    at: now(),
  });
  let [character] = machine.characters();
  assert.equal(character.state, "entering");

  // 충분히 tick을 돌리면 책상 도착
  for (let index = 0; index < 100; index += 1) machine.tick(200);
  [character] = machine.characters();
  assert.equal(character.state, "working");
  assert.deepEqual(character.position, character.desk);
});

test("node:done 후 축하 -> 커피 -> 퇴근 -> gone 순서로 전이한다", () => {
  const machine = createCharacterMachine();
  machine.applyEvent({
    type: "node:spawned",
    runId: "r1",
    node: executorNode,
    at: now(),
  });
  for (let index = 0; index < 100; index += 1) machine.tick(200);

  machine.applyEvent({
    type: "node:done",
    runId: "r1",
    nodeId: executorNode.id,
    summary: "완료",
    usage: { inputTokens: 100, outputTokens: 50, costUsd: 0.001 },
    at: now(),
  });
  let [character] = machine.characters();
  assert.equal(character.state, "celebrating");

  // 축하 시간 경과 -> 커피로 이동
  machine.tick(2_300);
  [character] = machine.characters();
  assert.equal(character.state, "walking-to-coffee");

  // 커피머신 도착할 때까지만 진행
  const tickUntil = (state: string, maxTicks: number) => {
    for (let index = 0; index < maxTicks; index += 1) {
      if (machine.characters()[0].state === state) return true;
      machine.tick(200);
    }
    return machine.characters()[0].state === state;
  };
  assert.ok(tickUntil("coffee", 60), "커피 상태에 도달해야 한다");

  // 커피 시간 경과 -> 퇴근 -> 퇴장
  assert.ok(tickUntil("gone", 200), "퇴근 후 gone 상태가 되어야 한다");

  machine.prune();
  assert.equal(machine.characters().length, 0);
});

test("approval:requested 시 오케스트레이터가 사용자 책상으로 이동해 대기한다", () => {
  const machine = createCharacterMachine();
  machine.applyEvent({
    type: "node:spawned",
    runId: "r1",
    node: {
      id: "orchestrator:r1",
      kind: "orchestrator",
      role: "coordinator",
      title: "총괄냥",
      tier: "local",
    },
    at: now(),
  });
  machine.applyEvent({
    type: "approval:requested",
    runId: "r1",
    request: {
      id: "req1",
      runId: "r1",
      kind: "plan-confirm",
      reason: "계획 승인 필요",
      payload: {},
      requestedAt: now(),
    },
    at: now(),
  });
  let [character] = machine.characters();
  assert.equal(character.state, "walking-to-owner");

  for (let index = 0; index < 100; index += 1) machine.tick(200);
  [character] = machine.characters();
  assert.equal(character.state, "waiting-approval");
  assert.ok(
    Math.abs(character.position.x - defaultLayout.ownerDesk.x) < 0.01,
  );

  machine.applyEvent({
    type: "approval:resolved",
    runId: "r1",
    requestId: "req1",
    approved: true,
    at: now(),
  });
  [character] = machine.characters();
  assert.equal(character.state, "working");
});

test("책상은 캐릭터마다 겹치지 않게 배정된다", () => {
  const machine = createCharacterMachine();
  for (let index = 0; index < 5; index += 1) {
    machine.applyEvent({
      type: "node:spawned",
      runId: "r1",
      node: { ...executorNode, id: `unit${index}:x` },
      at: now(),
    });
  }
  const desks = machine
    .characters()
    .map((character) => `${character.desk.x},${character.desk.z}`);
  assert.equal(new Set(desks).size, desks.length);
});
