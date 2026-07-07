import {
  defaultBudgetPreferences,
  loadBudgetPreferencesSync,
  type BudgetPreferences,
} from "./budget-preferences";

export function formatCost(usd: number, prefs?: BudgetPreferences) {
  const { krwPerUsd } = prefs ?? loadBudgetPreferencesSync();
  const krw = usd * krwPerUsd;
  return `$${usd.toFixed(4)} (₩${Math.round(krw).toLocaleString("ko-KR")})`;
}

export function formatCostShort(usd: number, prefs?: BudgetPreferences) {
  const { krwPerUsd } = prefs ?? loadBudgetPreferencesSync();
  const krw = usd * krwPerUsd;
  if (usd === 0) return "₩0";
  return `₩${Math.round(krw).toLocaleString("ko-KR")}`;
}

export { defaultBudgetPreferences };
