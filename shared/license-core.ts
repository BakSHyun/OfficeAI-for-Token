import type { DispatchPlan } from "../core/src/orchestration/contracts";
import type { ProviderConfig } from "../core/src/providers/contracts";

export const LICENSE_PREFIX = "OAIV1";
export const TRIAL_API_RUN_LIMIT = 10;

const PAID_TIERS = new Set(["economy", "standard", "premium"]);

export type LicensePayload = {
  v: 1;
  email?: string;
  expiresAt?: string;
  edition?: "standard" | "pro";
  employees?: string[];
};

export type LicenseState = {
  /** @deprecated 단일 키 — keys로 마이그레이션 */
  key?: string;
  keys?: string[];
  apiRunsUsed: number;
};

export function normalizeLicenseKeys(state: Partial<LicenseState>): string[] {
  const keys = new Set<string>();
  for (const key of state.keys ?? []) {
    const trimmed = key.trim();
    if (trimmed) keys.add(trimmed);
  }
  if (state.key?.trim()) keys.add(state.key.trim());
  return [...keys];
}

export type LicenseStatus = {
  mode: "trial" | "licensed";
  email?: string;
  expiresAt?: string;
  edition?: string;
  trialApiRunsUsed: number;
  trialApiRunsLimit: number;
  trialApiRunsRemaining: number;
};

export function planUsesPaidApi(
  plan: DispatchPlan,
  providers: ProviderConfig,
): boolean {
  return plan.units.some((unit) => {
    if (!PAID_TIERS.has(unit.tier)) return false;
    return providers.tiers[unit.tier].provider !== "mock";
  });
}

export function buildLicenseStatus(
  state: LicenseState,
  licensed: boolean,
  payload?: LicensePayload,
): LicenseStatus {
  const used = Math.max(0, state.apiRunsUsed);
  const remaining = Math.max(0, TRIAL_API_RUN_LIMIT - used);

  if (licensed && payload) {
    return {
      mode: "licensed",
      email: payload.email,
      expiresAt: payload.expiresAt,
      edition: payload.edition,
      trialApiRunsUsed: used,
      trialApiRunsLimit: TRIAL_API_RUN_LIMIT,
      trialApiRunsRemaining: remaining,
    };
  }

  return {
    mode: "trial",
    trialApiRunsUsed: used,
    trialApiRunsLimit: TRIAL_API_RUN_LIMIT,
    trialApiRunsRemaining: remaining,
  };
}
