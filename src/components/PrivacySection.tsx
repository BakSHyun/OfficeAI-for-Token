import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import type { PrivacySettings } from "../state/bridge-types";

export function PrivacySection() {
  const bridge = window.officeai;
  const [settings, setSettings] = useState<PrivacySettings>({ crashReporting: false });
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!bridge) return;
    void bridge.getPrivacySettings().then(setSettings);
  }, [bridge]);

  async function handleSave() {
    if (!bridge) return;
    await bridge.savePrivacySettings(settings);
    setSavedAt(new Date().toLocaleTimeString("ko-KR"));
  }

  if (!bridge) {
    return (
      <div className="settings-section">
        <h2>
          <ShieldAlert size={13} /> 개인정보
        </h2>
        <p className="settings-note">
          크래시 리포트 설정은 Electron 앱에서만 사용할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="settings-section">
      <h2>
        <ShieldAlert size={13} /> 개인정보
      </h2>
      <p className="settings-note">
        크래시 리포트는 opt-in이며 기본 꺼짐입니다. 빌드 시 Sentry DSN이
        설정된 경우에만 전송됩니다.
      </p>
      <label className="settings-check">
        <input
          checked={settings.crashReporting}
          onChange={(event) =>
            setSettings({ crashReporting: event.target.checked })
          }
          type="checkbox"
        />
        익명 크래시 리포트 보내기
      </label>
      <div className="settings-footer settings-footer-inline">
        <button onClick={() => void handleSave()} type="button">
          저장
        </button>
        {savedAt ? <small>{savedAt} 저장됨</small> : null}
      </div>
    </div>
  );
}
