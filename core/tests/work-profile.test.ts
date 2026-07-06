import assert from "node:assert/strict";
import test from "node:test";
import type { WorkEvent } from "../src/contracts";
import { deriveWorkProfile } from "../src/memory/work-profile";

const base: Omit<WorkEvent, "id" | "project" | "occurredAt" | "tags"> = {
  kind: "git-commit",
  title: "work",
  summary: "work",
  sourceRef: "source",
  sourceHash: "hash",
  confidence: 1,
  sensitivity: "internal",
};

test("weights recent work more than stale volume", () => {
  const events: WorkEvent[] = [
    {
      ...base,
      id: "1",
      project: "current",
      occurredAt: "2026-07-05T00:00:00.000Z",
      tags: ["payment"],
    },
    ...Array.from({ length: 4 }, (_, index) => ({
      ...base,
      id: `old-${index}`,
      project: "old",
      occurredAt: "2025-01-01T00:00:00.000Z",
      tags: ["legacy"],
    })),
  ];

  const profile = deriveWorkProfile(
    events,
    new Date("2026-07-06T00:00:00.000Z"),
  );
  assert.equal(profile.topProjects[0]?.name, "current");
  assert.equal(profile.topThemes[0]?.name, "payment");
  assert.equal(profile.currentFocus[0]?.name, "current");
});
