import type {
  ActivateLicenseResult,
  LicenseStatus,
} from "./bridge-types";
import {
  LICENSE_PREFIX,
  TRIAL_API_RUN_LIMIT,
  buildLicenseStatus,
  type LicenseState,
} from "../../shared/license-core";

const DEMO_LICENSE_STATE_KEY = "officeai.license-state";

function readDemoState(): LicenseState {
  try {
    const raw = localStorage.getItem(DEMO_LICENSE_STATE_KEY);
    if (!raw) return { apiRunsUsed: 0 };
    const parsed = JSON.parse(raw) as LicenseState;
    return {
      key: typeof parsed.key === "string" ? parsed.key : undefined,
      apiRunsUsed: Number(parsed.apiRunsUsed) || 0,
    };
  } catch {
    return { apiRunsUsed: 0 };
  }
}

function writeDemoState(state: LicenseState) {
  localStorage.setItem(DEMO_LICENSE_STATE_KEY, JSON.stringify(state));
}

export function getDemoLicenseStatus(): LicenseStatus {
  const state = readDemoState();
  const licensed = Boolean(state.key?.startsWith(`${LICENSE_PREFIX}.`));
  return buildLicenseStatus(
    state,
    licensed,
    licensed ? { v: 1, email: "데모 모드", edition: "standard" } : undefined,
  );
}

export function activateDemoLicense(key: string): ActivateLicenseResult {
  const trimmed = key.trim();
  if (!trimmed.startsWith(`${LICENSE_PREFIX}.`)) {
    return { ok: false, error: "라이선스 키 형식이 올바르지 않습니다." };
  }
  const state = { ...readDemoState(), key: trimmed };
  writeDemoState(state);
  return {
    ok: true,
    status: buildLicenseStatus(state, true, {
      v: 1,
      email: "데모 모드 (Electron에서 전체 검증)",
      edition: "standard",
    }),
  };
}

export { TRIAL_API_RUN_LIMIT };
