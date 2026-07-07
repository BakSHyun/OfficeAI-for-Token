import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import type { ActivateLicenseResult, LicenseStatus } from "../state/bridge-types";
import {
  activateDemoLicense,
  getDemoLicenseStatus,
} from "../state/license-client";

export function LicenseSection() {
  const bridge = window.officeai;
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [licenseKey, setLicenseKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!bridge) {
      setStatus(getDemoLicenseStatus());
      return;
    }
    void bridge.getLicenseStatus().then(setStatus);
    return bridge.onLicenseStatusChanged(setStatus);
  }, [bridge]);

  async function handleActivate() {
    const trimmed = licenseKey.trim();
    if (!trimmed) return;
    setBusy(true);
    setNote(null);
    try {
      let result: ActivateLicenseResult;
      if (!bridge) {
        result = activateDemoLicense(trimmed);
      } else {
        result = await bridge.activateLicense(trimmed);
      }
      if (!result.ok) {
        setNote(result.error ?? "라이선스 활성화에 실패했습니다.");
        return;
      }
      if (result.status) setStatus(result.status);
      setLicenseKey("");
      setNote("라이선스가 활성화되었습니다.");
    } finally {
      setBusy(false);
    }
  }

  if (!status) {
    return (
      <div className="settings-section">
        <h2>
          <KeyRound size={13} /> 라이선스
        </h2>
        <p className="settings-note">불러오는 중…</p>
      </div>
    );
  }

  return (
    <div className="settings-section">
      <h2>
        <KeyRound size={13} /> 라이선스
      </h2>
      {status.mode === "licensed" ? (
        <p className="settings-note">
          정식 라이선스 · {status.email ?? "등록됨"}
          {status.expiresAt ? ` · 만료 ${status.expiresAt}` : ""}
          {status.edition ? ` · ${status.edition}` : ""}
        </p>
      ) : (
        <p className="settings-note">
          체험 모드입니다. mock 티어는 무제한이며, OpenAI/Anthropic 등 유료 API
          티어는 {status.trialApiRunsLimit}회까지 실행할 수 있습니다. (남은{" "}
          {status.trialApiRunsRemaining}회)
        </p>
      )}
      <label className="settings-field">
        앱 라이선스 키 (API 키와 다릅니다)
        <input
          onChange={(event) => setLicenseKey(event.target.value)}
          placeholder="OAIV1...."
          value={licenseKey}
        />
      </label>
      <div className="settings-footer settings-footer-inline">
        <button disabled={busy} onClick={() => void handleActivate()} type="button">
          {busy ? "확인 중…" : "활성화"}
        </button>
        {note ? <small>{note}</small> : null}
      </div>
    </div>
  );
}
