import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterSuggestions,
  mergeHistory,
} from "../../src/state/command-history";

describe("command history", () => {
  it("mergeHistory는 중복을 제거하고 최신 항목을 앞에 둔다", () => {
    const next = mergeHistory(["b", "a"], "c", 20);
    assert.deepEqual(next, ["c", "b", "a"]);
    assert.deepEqual(mergeHistory(next, "b"), ["b", "c", "a"]);
  });

  it("filterSuggestions는 입력과 부분 일치하는 최근 명령만 반환한다", () => {
    const history = [
      "이번 주 업무 브리핑",
      "경쟁사 조사 보고서",
      "로그인 화면 개선안",
    ];
    assert.deepEqual(filterSuggestions(history, "보고"), [
      "경쟁사 조사 보고서",
    ]);
    assert.deepEqual(filterSuggestions(history, ""), history);
  });
});
