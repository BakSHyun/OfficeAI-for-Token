import assert from "node:assert/strict";
import test from "node:test";
import type { WorkEvent } from "../src/contracts";
import { buildContextPack } from "../src/context/context-pack";

const events: WorkEvent[] = [
  {
    id: "1",
    kind: "git-commit",
    project: "gtsn-backend",
    occurredAt: "2026-07-05T00:00:00.000Z",
    title: "결제 쿠폰 집계 수정",
    summary: "결제 내역의 쿠폰 집계를 수정했다.",
    sourceRef: "gtsn-backend:git:abc",
    sourceHash: "hash-1",
    confidence: 0.96,
    sensitivity: "internal",
    tags: ["payment", "backend"],
  },
  {
    id: "2",
    kind: "cursor-plan",
    project: "cursor-plans",
    occurredAt: "2026-06-29T00:00:00.000Z",
    title: "결제 대사 연동 계획",
    summary: "KCP 거래와 내부 결제 내역을 비교한다.",
    sourceRef: "cursor-plans:kcp.plan.md",
    sourceHash: "hash-2",
    confidence: 0.92,
    sensitivity: "internal",
    tags: ["payment", "planning"],
  },
  {
    id: "3",
    kind: "markdown",
    project: "obsidian",
    occurredAt: "2024-01-01T00:00:00.000Z",
    title: "여행 메모",
    summary: "업무와 관계없는 개인 메모",
    sourceRef: "obsidian:travel.md",
    sourceHash: "hash-3",
    confidence: 0.8,
    sensitivity: "internal",
    tags: [],
  },
];

test("selects relevant context under a hard token budget", () => {
  const pack = buildContextPack(
    "gtsn backend 결제 계획",
    events,
    100,
    new Date("2026-07-06T00:00:00.000Z"),
  );

  assert.ok(pack.estimatedTokens <= 100);
  assert.equal(pack.items[0]?.event.id, "1");
  assert.ok(pack.items.some((item) => item.event.id === "2"));
  assert.ok(pack.citations.every((citation) => citation.sourceHash));
});
