import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RunEvent } from "../src/orchestration/contracts";
import { createMemoryLedger } from "../src/telemetry/ledger";

describe("ledger", () => {
  it("markInterruptedRuns는 running run을 failed로 정리하고 이벤트를 남긴다", () => {
    const ledger = createMemoryLedger();
    const at = "2026-07-07T00:00:00.000Z";
    const started: RunEvent = {
      type: "run:started",
      runId: "run-1",
      command: "테스트 명령",
      at,
    };

    ledger.attach({
      subscribe(listener) {
        listener(started);
        return () => {};
      },
    });

    assert.equal(ledger.recentRuns(5)[0]?.status, "running");

    const marked = ledger.markInterruptedRuns("앱 종료로 중단");
    assert.equal(marked, 1);

    const row = ledger.recentRuns(5)[0];
    assert.equal(row?.status, "failed");
    assert.equal(row?.summary, "앱 종료로 중단");

    const events = ledger.runEvents("run-1");
    const failed = events.find((event) => event.type === "run:failed");
    assert.ok(failed);
    assert.equal(failed?.type === "run:failed" ? failed.error : "", "앱 종료로 중단");
  });
});
