import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolve } from "node:path";
import {
  resolveWritePath,
  summarizeCommandOutput,
} from "../../electron/action-runner";

describe("action-runner", () => {
  const base = resolve("/tmp/officeai-actions");

  it("resolveWritePath는 베이스 폴더 안 경로만 허용한다", () => {
    const target = resolveWritePath(base, "docs/plan.md");
    assert.ok(target?.startsWith(base));
    assert.equal(resolveWritePath(base, "../escape.md"), undefined);
    assert.equal(resolveWritePath(base, "/etc/passwd"), undefined);
    assert.equal(resolveWritePath(base, "a/../../b.md"), undefined);
  });

  it("resolveWritePath는 백슬래시 경로를 정규화한다", () => {
    const target = resolveWritePath(base, "docs\\plan.md");
    assert.ok(target?.startsWith(base));
  });

  it("summarizeCommandOutput은 긴 출력을 꼬리부터 자른다", () => {
    const long = "x".repeat(1000);
    const summary = summarizeCommandOutput(long, "", 100);
    assert.equal(summary.length, 101);
    assert.ok(summary.startsWith("…"));
    assert.equal(summarizeCommandOutput("", ""), "(출력 없음)");
  });
});
