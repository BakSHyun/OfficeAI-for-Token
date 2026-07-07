import { useEffect, useState } from "react";
import { Globe, KeyRound, Save, Terminal } from "lucide-react";
import { ConnectionStatusSection } from "./ConnectionStatusSection";
import { ModelTierSection } from "./ModelTierSection";
import type { ProviderConfig, SettingsPayload } from "../state/bridge-types";
import {
  defaultBudgetPreferences,
  saveBudgetPreferencesLocal,
} from "../state/budget-preferences";

const demoTiers: ProviderConfig["tiers"] = {
  local: {
    provider: "mock",
    model: "mock",
    inputCostPerMillion: 0,
    outputCostPerMillion: 0,
  },
  economy: {
    provider: "mock",
    model: "mock",
    inputCostPerMillion: 0,
    outputCostPerMillion: 0,
  },
  standard: {
    provider: "mock",
    model: "mock",
    inputCostPerMillion: 0,
    outputCostPerMillion: 0,
  },
  premium: {
    provider: "mock",
    model: "mock",
    inputCostPerMillion: 0,
    outputCostPerMillion: 0,
  },
};

export function ModelRoutingView() {
  const bridge = window.officeai;
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [tiers, setTiers] = useState<ProviderConfig["tiers"]>(demoTiers);
  const [concurrency, setConcurrency] = useState(4);
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [lmstudioUrl, setLmstudioUrl] = useState("http://localhost:1234/v1");
  const [cursorCommand, setCursorCommand] = useState("cursor");
  const [cursorPrefix, setCursorPrefix] = useState("agent");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!bridge) return;
    void bridge.getSettings().then((payload) => {
      setSettings(payload);
      setTiers(payload.providers.tiers);
      setConcurrency(payload.providers.concurrency);
      setLmstudioUrl(
        payload.providers.baseUrls?.lmstudio ?? "http://localhost:1234/v1",
      );
      setCursorCommand(payload.providers.cursorAgentCli?.command ?? "");
      setCursorPrefix(
        payload.providers.cursorAgentCli?.commandPrefixArgs?.join(" ") ?? "",
      );
    });
  }, [bridge]);

  async function handleSave() {
    if (!bridge) return;
    setSaving(true);
    try {
      const apiKeys: Record<string, string> = {};
      if (openaiKey.trim()) apiKeys.openai = openaiKey.trim();
      if (anthropicKey.trim()) apiKeys.anthropic = anthropicKey.trim();
      const trimmedLmUrl = lmstudioUrl.trim();
      const prefixArgs = cursorPrefix.trim().split(/\s+/).filter(Boolean);
      const trimmedCommand = cursorCommand.trim();
      await bridge.saveSettings({
        providers: {
          tiers,
          concurrency,
          ...(trimmedLmUrl
            ? { baseUrls: { lmstudio: trimmedLmUrl } }
            : {}),
          ...(trimmedCommand || prefixArgs.length > 0
            ? {
                cursorAgentCli: {
                  command: trimmedCommand || undefined,
                  commandPrefixArgs: prefixArgs,
                },
              }
            : { cursorAgentCli: {} }),
        },
        budget: settings?.budget ?? defaultBudgetPreferences,
        ...(Object.keys(apiKeys).length > 0 ? { apiKeys } : {}),
      });
      if (settings?.budget) saveBudgetPreferencesLocal(settings.budget);
      setOpenaiKey("");
      setAnthropicKey("");
      const refreshed = await bridge.getSettings();
      setSettings(refreshed);
      setTiers(refreshed.providers.tiers);
      setSavedAt(new Date().toLocaleTimeString("ko-KR"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="view-panel">
      <header className="view-heading">
        <h1>모델 라우팅</h1>
        <span>
          티어별 Provider·모델을 지정합니다. 연결 상태 확인 후 저장하세요.
        </span>
      </header>

      <ConnectionStatusSection
        apiKeyPresence={settings?.apiKeyPresence ?? { openai: false, anthropic: false }}
        providers={
          settings?.providers ?? { concurrency: 4, tiers: demoTiers }
        }
      />

      <ModelTierSection
        concurrency={concurrency}
        onConcurrencyChange={setConcurrency}
        onTiersChange={setTiers}
        readOnly={!bridge}
        tiers={tiers}
      />

      <div className="settings-section">
        <h2>
          <Globe size={13} /> LM Studio 연결
        </h2>
        <p className="settings-note">
          LM Studio에서 Local Server를 켠 뒤, 표시된 주소를 입력하세요. 포트를
          바꿨다면 여기만 수정하면 됩니다.
        </p>
        {bridge ? (
          <label className="settings-inline settings-url">
            서버 URL
            <input
              onChange={(event) => setLmstudioUrl(event.target.value)}
              placeholder="http://localhost:1234/v1"
              type="url"
              value={lmstudioUrl}
            />
          </label>
        ) : (
          <p className="settings-note">
            Electron 앱에서 URL을 저장할 수 있습니다.
          </p>
        )}
      </div>

      <div className="settings-section">
        <h2>
          <Terminal size={13} /> Cursor Agent CLI
        </h2>
        <p className="settings-note">
          Windows에서는 <code>%LOCALAPPDATA%\cursor-agent\agent.cmd</code>를
          자동 탐색합니다. <strong>cursor</strong> 에디터 명령은 Agent CLI가
          아닙니다. 비우면 자동, 설치:{" "}
          <code>irm &apos;https://cursor.com/install?win32=true&apos; | iex</code>
        </p>
        {bridge ? (
          <div className="settings-fields-row">
            <label className="settings-inline">
              실행 명령
              <input
                onChange={(event) => setCursorCommand(event.target.value)}
                placeholder="비우면 자동 탐색"
                value={cursorCommand}
              />
            </label>
            <label className="settings-inline">
              접두 인자
              <input
                onChange={(event) => setCursorPrefix(event.target.value)}
                placeholder="보통 비움"
                value={cursorPrefix}
              />
            </label>
          </div>
        ) : null}
      </div>

      <div className="settings-section">
        <h2>
          <KeyRound size={13} /> API 키
        </h2>
        <p className="settings-note">
          OpenAI·Anthropic만 키가 필요합니다. LM Studio는 위 URL과 티어 표의
          provider <strong>lmstudio</strong>만 맞추면 됩니다.
        </p>
        {bridge && settings ? (
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
        ) : (
          <p className="settings-note">
            Electron 앱(<code>npm run app:dev</code>)에서 키를 저장할 수
            있습니다.
          </p>
        )}
      </div>

      {bridge ? (
        <div className="settings-footer">
          <button
            disabled={saving}
            onClick={() => void handleSave()}
            type="button"
          >
            <Save size={14} /> {saving ? "저장 중…" : "저장"}
          </button>
          {savedAt ? <small>{savedAt} 저장됨 — 엔진 재시작 완료</small> : null}
        </div>
      ) : null}
    </section>
  );
}
