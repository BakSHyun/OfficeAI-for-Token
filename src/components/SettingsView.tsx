import { useEffect, useState } from "react";
import { KeyRound, Save, SlidersHorizontal } from "lucide-react";
import type {
  ProviderConfig,
  SettingsPayload,
} from "../state/bridge-types";

const tierOrder = ["local", "economy", "standard", "premium"] as const;
const providerOptions = ["openai", "anthropic", "codex-cli", "mock"];

export function SettingsView() {
  const bridge = window.officeai;
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [tiers, setTiers] = useState<ProviderConfig["tiers"] | null>(null);
  const [concurrency, setConcurrency] = useState(4);
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!bridge) return;
    void bridge.getSettings().then((payload) => {
      setSettings(payload);
      setTiers(payload.providers.tiers);
      setConcurrency(payload.providers.concurrency);
    });
  }, [bridge]);

  if (!bridge) {
    return (
      <section className="view-panel decision-empty">
        <SlidersHorizontal size={34} strokeWidth={1.4} />
        <h1>데모 모드</h1>
        <p>
          브라우저 미리보기에서는 설정을 변경할 수 없습니다. Electron 앱(
          <code>npm run app:dev</code>)에서 API 키와 모델 티어를 설정하세요.
        </p>
      </section>
    );
  }

  if (!settings || !tiers) {
    return (
      <section className="view-panel decision-empty">
        <h1>설정 불러오는 중…</h1>
      </section>
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const apiKeys: Record<string, string> = {};
      if (openaiKey.trim()) apiKeys.openai = openaiKey.trim();
      if (anthropicKey.trim()) apiKeys.anthropic = anthropicKey.trim();
      await bridge!.saveSettings({
        providers: { tiers: tiers!, concurrency },
        ...(Object.keys(apiKeys).length > 0 ? { apiKeys } : {}),
      });
      setOpenaiKey("");
      setAnthropicKey("");
      const refreshed = await bridge!.getSettings();
      setSettings(refreshed);
      setSavedAt(new Date().toLocaleTimeString("ko-KR"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="view-panel">
      <header className="view-heading">
        <h1>설정</h1>
        <span>티어별 모델과 API 키. 키는 OS 키체인에 암호화 저장됩니다.</span>
      </header>

      <div className="settings-section">
        <h2>모델 티어</h2>
        <table className="settings-table">
          <thead>
            <tr>
              <th>티어</th>
              <th>Provider</th>
              <th>모델</th>
              <th>입력 $/1M</th>
              <th>출력 $/1M</th>
            </tr>
          </thead>
          <tbody>
            {tierOrder.map((tier) => {
              const binding = tiers[tier];
              const update = (
                patch: Partial<(typeof tiers)[typeof tier]>,
              ) =>
                setTiers({ ...tiers, [tier]: { ...binding, ...patch } });
              return (
                <tr key={tier}>
                  <td>
                    <span className={`tier-badge tier-${tier}`}>{tier}</span>
                  </td>
                  <td>
                    <select
                      onChange={(event) =>
                        update({ provider: event.target.value })
                      }
                      value={binding.provider}
                    >
                      {providerOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      onChange={(event) => update({ model: event.target.value })}
                      value={binding.model}
                    />
                  </td>
                  <td>
                    <input
                      inputMode="decimal"
                      onChange={(event) =>
                        update({
                          inputCostPerMillion: Number(event.target.value) || 0,
                        })
                      }
                      value={binding.inputCostPerMillion}
                    />
                  </td>
                  <td>
                    <input
                      inputMode="decimal"
                      onChange={(event) =>
                        update({
                          outputCostPerMillion: Number(event.target.value) || 0,
                        })
                      }
                      value={binding.outputCostPerMillion}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="settings-section">
        <h2>
          <KeyRound size={13} /> API 키
        </h2>
        <div className="settings-keys">
          <label>
            OpenAI
            <input
              onChange={(event) => setOpenaiKey(event.target.value)}
              placeholder={
                settings.apiKeyPresence.openai ? "저장됨 ••••••••" : "sk-..."
              }
              type="password"
              value={openaiKey}
            />
          </label>
          <label>
            Anthropic
            <input
              onChange={(event) => setAnthropicKey(event.target.value)}
              placeholder={
                settings.apiKeyPresence.anthropic
                  ? "저장됨 ••••••••"
                  : "sk-ant-..."
              }
              type="password"
              value={anthropicKey}
            />
          </label>
        </div>
      </div>

      <div className="settings-section">
        <h2>동시 실행</h2>
        <label className="settings-inline">
          최대 동시 LLM 호출 수
          <input
            max={12}
            min={1}
            onChange={(event) =>
              setConcurrency(
                Math.max(1, Math.min(12, Number(event.target.value) || 1)),
              )
            }
            type="number"
            value={concurrency}
          />
        </label>
      </div>

      <div className="settings-footer">
        <button disabled={saving} onClick={() => void handleSave()} type="button">
          <Save size={14} /> {saving ? "저장 중…" : "저장"}
        </button>
        {savedAt ? <small>{savedAt} 저장됨 — 엔진 재시작 완료</small> : null}
      </div>
    </section>
  );
}
