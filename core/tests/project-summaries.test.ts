import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { WorkProfile } from "../src/memory/work-profile";
import {
  collectProjectRuns,
  inferProjectForCommand,
} from "../../electron/project-summaries";
import type { StoredRunSummary } from "../../electron/run-summaries";

const profile: WorkProfile = {
  generatedAt: "2026-07-08T00:00:00.000Z",
  eventCount: 1,
  currentFocus: [
    {
      name: "OfficeAI",
      score: 0.9,
      eventCount: 1,
      lastSeen: "2026-07-08",
    },
  ],
  topProjects: [],
  topThemes: [],
  recentWork: [],
};

describe("project-summaries (G18 2단계 3)", () => {
  it("inferProjectForCommand는 work-profile에서 프로젝트를 추론한다", () => {
    assert.equal(
      inferProjectForCommand("OfficeAI 주간 보고 작성", profile),
      "OfficeAI",
    );
  });

  it("collectProjectRuns는 같은 프로젝트 run만 모은다", () => {
    const runs: StoredRunSummary[] = [
      {
        runId: "r1",
        command: "a",
        summary: "s1",
        finishedAt: "2026-07-07",
        project: "OfficeAI",
      },
      {
        runId: "r2",
        command: "b",
        summary: "s2",
        finishedAt: "2026-07-08",
        project: "Other",
      },
      {
        runId: "r3",
        command: "c",
        summary: "s3",
        finishedAt: "2026-07-09",
        project: "OfficeAI",
      },
    ];
    const collected = collectProjectRuns(runs, "OfficeAI");
    assert.deepEqual(collected.map((run) => run.runId), ["r1", "r3"]);
  });
});
