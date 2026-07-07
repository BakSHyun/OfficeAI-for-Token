export const BUDGET_PREFS_KEY = "officeai.budget";

export type BudgetPreferences = {
  globalDailyTokens: number;
  krwPerUsd: number;
};

export const defaultBudgetPreferences: BudgetPreferences = {
  globalDailyTokens: 2_000_000,
  krwPerUsd: 1400,
};

export function loadBudgetPreferencesSync(): BudgetPreferences {
  try {
    const raw = localStorage.getItem(BUDGET_PREFS_KEY);
    if (!raw) return defaultBudgetPreferences;
    const parsed = JSON.parse(raw) as Partial<BudgetPreferences>;
    return {
      globalDailyTokens:
        Number(parsed.globalDailyTokens) ||
        defaultBudgetPreferences.globalDailyTokens,
      krwPerUsd: Number(parsed.krwPerUsd) || defaultBudgetPreferences.krwPerUsd,
    };
  } catch {
    return defaultBudgetPreferences;
  }
}

export function saveBudgetPreferencesLocal(prefs: BudgetPreferences) {
  localStorage.setItem(BUDGET_PREFS_KEY, JSON.stringify(prefs));
}
