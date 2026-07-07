import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatCost, formatCostShort } from "../../src/state/format-cost";

describe("formatCost", () => {
  it("USD와 KRW를 함께 표시한다", () => {
    const text = formatCost(0.0123, { globalDailyTokens: 2_000_000, krwPerUsd: 1400 });
    assert.match(text, /^\$0\.0123 \(₩17\)$/);
  });

  it("formatCostShort는 원화만 간단히 표시한다", () => {
    assert.equal(
      formatCostShort(0.01, { globalDailyTokens: 2_000_000, krwPerUsd: 1400 }),
      "₩14",
    );
    assert.equal(formatCostShort(0), "₩0");
  });
});
