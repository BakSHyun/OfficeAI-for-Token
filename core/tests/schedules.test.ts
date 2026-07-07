import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findDueSchedules,
  markSchedulesRan,
  normalizeScheduledTask,
  runKeyForDate,
} from "../../electron/schedules";

describe("schedules", () => {
  it("findDueSchedules는 요일·시각이 맞고 아직 실행 안 된 업무만 고른다", () => {
    const now = new Date(2026, 6, 7, 9, 30);
    const tasks = [
      normalizeScheduledTask({
        id: "a",
        command: "브리핑",
        weekdays: [now.getDay()],
        hour: 9,
        minute: 30,
      }),
      normalizeScheduledTask({
        id: "b",
        command: "이미 실행",
        weekdays: [now.getDay()],
        hour: 9,
        minute: 30,
        lastRunKey: runKeyForDate(now),
      }),
    ];
    const due = findDueSchedules(tasks, now);
    assert.equal(due.length, 1);
    assert.equal(due[0]?.id, "a");
  });

  it("markSchedulesRan은 같은 분에 재실행되지 않게 lastRunKey를 남긴다", () => {
    const now = new Date(2026, 6, 7, 10, 5);
    const task = normalizeScheduledTask({
      id: "a",
      command: "점검",
      weekdays: [now.getDay()],
      hour: 10,
      minute: 5,
    });
    const marked = markSchedulesRan([task], ["a"], now);
    assert.equal(marked[0]?.lastRunKey, runKeyForDate(now));
    assert.equal(findDueSchedules(marked, now).length, 0);
  });
});
