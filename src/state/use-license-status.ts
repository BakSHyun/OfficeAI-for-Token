import { useEffect, useState } from "react";
import type { LicenseStatus } from "./bridge-types";
import { getDemoLicenseStatus } from "./license-client";

/** 라이선스 상태를 Electron 브리지 또는 데모 저장소에서 읽는다. */
export function useLicenseStatus(): LicenseStatus | null {
  const [status, setStatus] = useState<LicenseStatus | null>(null);

  useEffect(() => {
    const bridge = window.officeai;
    if (!bridge) {
      setStatus(getDemoLicenseStatus());
      return;
    }
    void bridge.getLicenseStatus().then(setStatus);
    return bridge.onLicenseStatusChanged(setStatus);
  }, []);

  return status;
}

export function licenseModeLabel(status: LicenseStatus | null): string {
  if (!status) return "OfficeAI";
  if (status.mode === "licensed") return "정식 라이선스";
  return `체험 · API ${status.trialApiRunsRemaining}회 남음`;
}
