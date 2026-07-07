import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeSavingsSummary } from "../../core/src/telemetry/savings";

const premium = {
  provider: "mock",
  model: "mock-premium",
  inputCostPerMillion: 15,
  outputCostPerMillion: 75,
};

describe("savings", () => {
  it("전부 premium이었다면 비용 대비 실제 비용으로 절약률을 계산한다", () => {
    const summary = computeSavingsSummary(
      [
        {
          inputTokens: 1000,
          outputTokens: 500,
          costUsd: 0.002,
        },
      ],
      premium,
    );
    assert.equal(summary.premiumEquivalentCostUsd, 0.0525);
    assert.equal(summary.actualCostUsd, 0.002);
    assert.ok(summary.savedPercent > 0);
    assert.equal(summary.savedUsd, summary.premiumEquivalentCostUsd - 0.002);
  });

  it("사용량이 없으면 절약률은 0이다", () => {
    const summary = computeSavingsSummary([], premium);
    assert.equal(summary.savedPercent, 0);
    assert.equal(summary.savedUsd, 0);
  });
});
