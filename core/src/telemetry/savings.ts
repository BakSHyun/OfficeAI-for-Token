import type { TierBinding } from "../providers/contracts";

export type UsageCostRow = {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

export type SavingsSummary = {
  actualCostUsd: number;
  premiumEquivalentCostUsd: number;
  savedUsd: number;
  savedPercent: number;
};

export function premiumCostForTokens(
  inputTokens: number,
  outputTokens: number,
  premium: TierBinding,
): number {
  return (
    (inputTokens / 1_000_000) * premium.inputCostPerMillion +
    (outputTokens / 1_000_000) * premium.outputCostPerMillion
  );
}

export function computeSavingsSummary(
  rows: UsageCostRow[],
  premium: TierBinding,
): SavingsSummary {
  let actualCostUsd = 0;
  let premiumEquivalentCostUsd = 0;
  for (const row of rows) {
    actualCostUsd += row.costUsd;
    premiumEquivalentCostUsd += premiumCostForTokens(
      row.inputTokens,
      row.outputTokens,
      premium,
    );
  }
  const savedUsd = Math.max(0, premiumEquivalentCostUsd - actualCostUsd);
  const savedPercent =
    premiumEquivalentCostUsd > 0
      ? Math.round((savedUsd / premiumEquivalentCostUsd) * 100)
      : 0;
  return {
    actualCostUsd,
    premiumEquivalentCostUsd,
    savedUsd,
    savedPercent,
  };
}
