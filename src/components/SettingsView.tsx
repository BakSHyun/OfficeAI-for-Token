import { useEffect, useState } from "react";
import { Download, KeyRound, Save } from "lucide-react";
import { ConnectionGuide } from "./ConnectionGuide";
import { MemoryConnectionSection } from "./MemoryConnectionSection";
import { LicenseSection } from "./LicenseSection";
import { PrivacySection } from "./PrivacySection";
import { SceneOfficeSection } from "./SceneOfficeSection";
import { ConnectionStatusSection } from "./ConnectionStatusSection";
import { ModelTierSection } from "./ModelTierSection";
import type {
  ProviderConfig,
  SettingsPayload,
} from "../state/bridge-types";
import {
  defaultBudgetPreferences,
  loadBudgetPreferencesSync,
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

export function SettingsView() {
  const bridge = window.officeai;
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [tiers, setTiers] = useState<ProviderConfig["tiers"] | null>(null);
  const [concurrency, setConcurrency] = useState(4);
  const [globalDailyTokens, setGlobalDailyTokens] = useState(
    defaultBudgetPreferences.globalDailyTokens,
  );
  const [krwPerUsd, setKrwPerUsd] = useState(defaultBudgetPreferences.krwPerUsd);
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);

  useEffect(() => {
    if (!bridge) {
      const local = loadBudgetPreferencesSync();
      setGlobalDailyTokens(local.globalDailyTokens);
      setKrwPerUsd(local.krwPerUsd);
      return;
    }
    void bridge.getSettings().then((payload) => {
      setSettings(payload);
      setTiers(payload.providers.tiers);
      setConcurrency(payload.providers.concurrency);
      setGlobalDailyTokens(payload.budget.globalDailyTokens);
      setKrwPerUsd(payload.budget.krwPerUsd);
      saveBudgetPreferencesLocal(payload.budget);
    });
  }, [bridge]);

  if (!bridge) {
    return (
      <section className="view-panel">
        <header className="view-heading">
          <h1>설정 · AI 연결 가이드</h1>
          <span>
            브라우저 데모 모드입니다. 아래 가이드대로 Electron 앱(
            <code>npm run app:dev</code>)에서 연결하세요.
          </span>
        </header>
        <ConnectionStatusSection
          apiKeyPresence={{ openai: false, anthropic: false }}
          providers={{ concurrency: 4, tiers: demoTiers }}
        />
        <ModelTierSection
          concurrency={4}
          onConcurrencyChange={() => undefined}
          onTiersChange={() => undefined}
          readOnly
          tiers={demoTiers}
        />
        <details className="settings-collapsible">
          <summary>AI 연결 가이드 (LM Studio · Cursor · Codex 등)</summary>
          <ConnectionGuide canSaveKeys={false} />
        </details>
        <MemoryConnectionSection />
        <LicenseSection />
        <SceneOfficeSection />
        <div className="settings-section">
          <h2>예산</h2>
          <p className="settings-note">
            브라우저 데모에서는 localStorage에만 저장됩니다.
          </p>
          <div className="settings-fields-row">
            <label className="settings-inline">
              일일 토큰 한도
              <input
                min={1000}
                onChange={(event) =>
                  setGlobalDailyTokens(
                    Math.max(1000, Number(event.target.value) || 1000),
                  )
                }
                type="number"
                value={globalDailyTokens}
              />
            </label>
            <label className="settings-inline">
              환율 (₩/USD)
              <input
                min={1}
                onChange={(event) =>
                  setKrwPerUsd(Math.max(1, Number(event.target.value) || 1400))
                }
                type="number"
                value={krwPerUsd}
              />
            </label>
          </div>
        </div>
        <div className="settings-footer">
          <button
            onClick={() => {
              saveBudgetPreferencesLocal({ globalDailyTokens, krwPerUsd });
              setSavedAt(new Date().toLocaleTimeString("ko-KR"));
            }}
            type="button"
          >
            <Save size={14} /> 예산 저장
          </button>
          {savedAt ? <small>{savedAt} 저장됨</small> : null}
        </div>
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
        budget: { globalDailyTokens, krwPerUsd },
        ...(Object.keys(apiKeys).length > 0 ? { apiKeys } : {}),
      });
      saveBudgetPreferencesLocal({ globalDailyTokens, krwPerUsd });
      setOpenaiKey("");
      setAnthropicKey("");
      const refreshed = await bridge!.getSettings();
      setSettings(refreshed);
      setSavedAt(new Date().toLocaleTimeString("ko-KR"));
    } finally {
      setSaving(false);
    }
  }

  async function handleExportDiagnostic() {
    setExporting(true);
    setExportNote(null);
    try {
      const result = await bridge!.exportDiagnostic();
      if (result.saved && result.path) {
        setExportNote(`저장됨: ${result.path}`);
      } else {
        setExportNote("보내기가 취소되었습니다.");
      }
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="view-panel">
      <header className="view-heading">
        <h1>설정</h1>
        <span>티어별 모델과 API 키. 키는 OS 키체인에 암호화 저장됩니다.</span>
      </header>

      <ConnectionStatusSection
        apiKeyPresence={settings.apiKeyPresence}
        providers={settings.providers}
      />

      <ModelTierSection
        concurrency={concurrency}
        onConcurrencyChange={setConcurrency}
        onTiersChange={setTiers}
        tiers={tiers}
      />

      <div className="settings-section">
        <h2>
          <KeyRound size={13} /> API 키
        </h2>
        <p className="settings-note">
          OpenAI·Anthropic 키를 각각 저장할 수 있습니다(둘 다 등록 가능). Cursor
          Agent·Codex·LM Studio는 API 키가 필요 없습니다 — 위 모델 티어 표에서
          Provider만 변경하세요.
        </p>
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

      <details className="settings-collapsible">
        <summary>AI 연결 가이드 (LM Studio · Cursor · Codex 등)</summary>
        <ConnectionGuide canSaveKeys />
      </details>

      <MemoryConnectionSection />

      <LicenseSection />

      <SceneOfficeSection />

      <PrivacySection />

      <div className="settings-section">
        <h2>예산</h2>
        <div className="settings-fields-row">
          <label className="settings-inline">
            일일 토큰 한도
            <input
              min={1000}
              onChange={(event) =>
                setGlobalDailyTokens(
                  Math.max(1000, Number(event.target.value) || 1000),
                )
              }
              type="number"
              value={globalDailyTokens}
            />
          </label>
          <label className="settings-inline">
            환율 (₩/USD)
            <input
              min={1}
              onChange={(event) =>
                setKrwPerUsd(Math.max(1, Number(event.target.value) || 1400))
              }
              type="number"
              value={krwPerUsd}
            />
          </label>
        </div>
      </div>

      <div className="settings-footer">
        <button disabled={saving} onClick={() => void handleSave()} type="button">
          <Save size={14} /> {saving ? "저장 중…" : "저장"}
        </button>
        <button
          className="ghost"
          disabled={exporting}
          onClick={() => void handleExportDiagnostic()}
          type="button"
        >
          <Download size={14} /> {exporting ? "보내는 중…" : "진단 파일보내기"}
        </button>
        {savedAt ? <small>{savedAt} 저장됨 — 엔진 재시작 완료</small> : null}
        {exportNote ? <small>{exportNote}</small> : null}
      </div>
    </section>
  );
}
