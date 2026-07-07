import { useEffect, useState } from "react";
import { Volume2 } from "lucide-react";
import {
  loadSceneSfxEnabled,
  saveSceneSfxEnabled,
} from "../state/scene-preferences";

export function SceneOfficeSection() {
  const [sfxEnabled, setSfxEnabled] = useState(loadSceneSfxEnabled);

  useEffect(() => {
    saveSceneSfxEnabled(sfxEnabled);
  }, [sfxEnabled]);

  return (
    <div className="settings-section">
      <h2>
        <Volume2 size={13} /> 3D 오피스
      </h2>
      <p className="settings-note">
        CC0 고양이 모델과 완료/실패 효과음입니다. 사운드는 기본 꺼짐입니다.
      </p>
      <label className="settings-check">
        <input
          checked={sfxEnabled}
          onChange={(event) => setSfxEnabled(event.target.checked)}
          type="checkbox"
        />
        업무 완료/실패 사운드 재생
      </label>
    </div>
  );
}
