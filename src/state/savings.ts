import type { SavingsSummary } from "./bridge-types";
import type { UsageCostRow } from "./engine-store";

const demoPremiumRates = {
  inputCostPerMillion: 15,
  outputCostPerMillion: 75,
};

function premiumCostForTokens(
  inputTokens: number,
  outputTokens: number,
): number {
  return (
    (inputTokens / 1_000_000) * demoPremiumRates.inputCostPerMillion +
    (outputTokens / 1_000_000) * demoPremiumRates.outputCostPerMillion
  );
}

export function computeDemoSavings(rows: UsageCostRow[]): SavingsSummary {
  let actualCostUsd = 0;
  let premiumEquivalentCostUsd = 0;
  for (const row of rows) {
    actualCostUsd += row.costUsd;
    premiumEquivalentCostUsd += premiumCostForTokens(
      row.inputTokens,
      row.outputTokens,
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

export function formatSavingsMessage(summary: SavingsSummary) {
  if (summary.premiumEquivalentCostUsd <= 0) return null;
  return `전부 premium이었다면 ${summary.premiumEquivalentCostUsd.toFixed(4)} USD였지만 스마트 배정으로 ${summary.actualCostUsd.toFixed(4)} USD — ${summary.savedPercent}% 절약`;
}
