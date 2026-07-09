import { useEffect, useState } from "react";
import { Globe, KeyRound, Layers, Rocket, Sparkles, Terminal } from "lucide-react";
import { ConnectionGuide } from "./ConnectionGuide";
import { ModelTierSection } from "./ModelTierSection";
import { loadStarred } from "../state/command-history";
import { ONBOARDING_KEY } from "../state/onboarding";
import type { ProviderConfig } from "../state/bridge-types";

type OnboardingModalProps = {
  onFinish: (firstCommand?: string) => void;
};

const exampleCommands = [
  "이번 주 업무를 파악하고 다음 주 계획을 세워줘",
  "신규 기능 아이디어를 기획서로 정리해줘",
  "경쟁사 3곳을 조사하고 비교 보고서를 만들어줘",
];

const fallbackTiers: ProviderConfig["tiers"] = {
  local: { provider: "mock", model: "mock", inputCostPerMillion: 0, outputCostPerMillion: 0 },
  economy: { provider: "mock", model: "mock", inputCostPerMillion: 0, outputCostPerMillion: 0 },
  standard: { provider: "mock", model: "mock", inputCostPerMillion: 0, outputCostPerMillion: 0 },
  premium: { provider: "mock", model: "mock", inputCostPerMillion: 0, outputCostPerMillion: 0 },
};

const tierGuide = [
  { tier: "local", desc: "가벼운·로컬 처리 — LM Studio·Codex·Cursor (API 키 불필요)" },
  { tier: "economy", desc: "리서치·보조 — OpenAI GPT mini 또는 로컬 모델" },
  { tier: "standard", desc: "기획·개발 — Claude Sonnet 등" },
  { tier: "premium", desc: "고난도·최종 검토 — Claude Opus 등" },
] as const;

export function OnboardingModal({ onFinish }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [tiers, setTiers] = useState<ProviderConfig["tiers"]>(fallbackTiers);
  const [concurrency, setConcurrency] = useState(4);
  const [lmstudioUrl, setLmstudioUrl] = useState("http://localhost:1234/v1");
  const [cursorCommand, setCursorCommand] = useState("");
  const [cursorPrefix, setCursorPrefix] = useState("");
  const bridge = window.officeai;
  const starredCommands = loadStarred();
  const quickCommands =
    starredCommands.length > 0 ? starredCommands : exampleCommands;

  useEffect(() => {
    if (!bridge) return;
    void bridge.getSettings().then((payload) => {
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

  const usesLmstudio = Object.values(tiers).some(
    (binding) => binding.provider === "lmstudio",
  );
  const usesCursorCli = Object.values(tiers).some(
    (binding) => binding.provider === "cursor-agent-cli",
  );

  function finish(firstCommand?: string) {
    localStorage.setItem(ONBOARDING_KEY, "1");
    onFinish(firstCommand);
  }

  async function saveKeysAndNext() {
    if (bridge && (openaiKey.trim() || anthropicKey.trim())) {
      setSaving(true);
      try {
        const apiKeys: Record<string, string> = {};
        if (openaiKey.trim()) apiKeys.openai = openaiKey.trim();
        if (anthropicKey.trim()) apiKeys.anthropic = anthropicKey.trim();
        await bridge.saveSettings({ apiKeys });
      } finally {
        setSaving(false);
      }
    }
    setStep(2);
  }

  async function saveTiersAndNext() {
    if (bridge) {
      setSaving(true);
      try {
        const trimmedLmUrl = lmstudioUrl.trim();
        const prefixArgs = cursorPrefix.trim().split(/\s+/).filter(Boolean);
        const trimmedCommand = cursorCommand.trim();
        await bridge.saveSettings({
          providers: {
            tiers,
            concurrency,
            ...(trimmedLmUrl ? { baseUrls: { lmstudio: trimmedLmUrl } } : {}),
            ...(trimmedCommand || prefixArgs.length > 0
              ? {
                  cursorAgentCli: {
                    command: trimmedCommand || undefined,
                    commandPrefixArgs: prefixArgs,
                  },
                }
              : {}),
          },
        });
      } finally {
        setSaving(false);
      }
    }
    setStep(3);
  }

  return (
    <div className="onboarding-backdrop">
      <div
        className={
          step === 2 ? "onboarding-modal onboarding-modal--wide" : "onboarding-modal"
        }
      >
        {step === 0 ? (
          <>
            <Sparkles size={30} />
            <h1>OfficeAI에 오신 걸 환영합니다</h1>
            <p>
              한 문장으로 지시하면 노드 AI 직원들이 업무를 나눠서 동시에
              처리합니다. 각 작업엔 딱 필요한 수준의 AI만 투입되어 토큰이
              절약되고, 임원·유저·CFO·CTO 시각의 검토를 거친 결과만
              보고됩니다. 당신은 <strong>지시와 결정</strong>만 하면 됩니다.
            </p>
            <div className="onboarding-actions">
              <button onClick={() => setStep(1)} type="button">
                시작하기
              </button>
              <button
                className="ghost"
                onClick={() => finish()}
                type="button"
              >
                건너뛰기
              </button>
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <KeyRound size={30} />
            <h1>AI 연결</h1>
            <p>
              API 키를 입력하면 실제 모델이 일합니다. 키는 이 컴퓨터의 OS
              키체인에 암호화되어 저장되며 외부로 전송되지 않습니다. 로컬 AI(LM
              Studio·Codex·Cursor)는 키 없이 다음 단계에서 연결합니다.
            </p>
            <ConnectionGuide canSaveKeys={Boolean(bridge)} variant="compact" />
            {bridge ? (
              <div className="onboarding-keys">
                <label>
                  OpenAI API 키 (선택)
                  <input
                    onChange={(event) => setOpenaiKey(event.target.value)}
                    placeholder="sk-..."
                    type="password"
                    value={openaiKey}
                  />
                </label>
                <label>
                  Anthropic API 키 (선택)
                  <input
                    onChange={(event) => setAnthropicKey(event.target.value)}
                    placeholder="sk-ant-..."
                    type="password"
                    value={anthropicKey}
                  />
                </label>
              </div>
            ) : (
              <p className="onboarding-note">
                지금은 브라우저 데모 모드입니다. 키 없이 시뮬레이션으로
                둘러볼 수 있습니다.
              </p>
            )}
            <div className="onboarding-actions">
              <button
                disabled={saving}
                onClick={() => void saveKeysAndNext()}
                type="button"
              >
                {saving ? "저장 중…" : "다음"}
              </button>
              <button className="ghost" onClick={() => setStep(2)} type="button">
                건너뛰기
              </button>
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Layers size={30} />
            <h1>티어별 AI 설정</h1>
            <p>
              업무 난이도에 따라{" "}
              <strong>local → economy → standard → premium</strong> 순으로 AI가
              자동 배정됩니다. 각 티어에 어떤 Provider·모델을 쓸지 정하세요. 키가
              없으면 <strong>mock</strong>(시뮬레이션)으로 두어도 됩니다.
            </p>
            <ul className="onboarding-tier-guide">
              {tierGuide.map((item) => (
                <li key={item.tier}>
                  <span className={`tier-badge tier-${item.tier}`}>
                    {item.tier}
                  </span>
                  <span>{item.desc}</span>
                </li>
              ))}
            </ul>
            <div className="onboarding-tier-config">
              <ModelTierSection
                concurrency={concurrency}
                onConcurrencyChange={setConcurrency}
                onTiersChange={setTiers}
                readOnly={!bridge}
                tiers={tiers}
              />
              {usesLmstudio ? (
                <div className="settings-section">
                  <h2>
                    <Globe size={13} /> LM Studio 서버 주소
                  </h2>
                  <p className="settings-note">
                    LM Studio의 Developer(Local Server) 탭에서 Start Server 후
                    표시되는 주소를 입력하세요. 이 로컬 AI는 API 키가 없어도
                    서버 주소 설정이 필요합니다.
                  </p>
                  <label className="settings-inline settings-url">
                    서버 URL
                    <input
                      disabled={!bridge}
                      onChange={(event) => setLmstudioUrl(event.target.value)}
                      placeholder="http://localhost:1234/v1"
                      type="url"
                      value={lmstudioUrl}
                    />
                  </label>
                </div>
              ) : null}
              {usesCursorCli ? (
                <div className="settings-section">
                  <h2>
                    <Terminal size={13} /> Cursor Agent CLI
                  </h2>
                  <p className="settings-note">
                    비우면 자동 탐색합니다. 최초 1회 <code>agent login</code>이
                    필요합니다. 이 로컬 AI도 실행 전 CLI 로그인이 필요합니다.
                  </p>
                  <div className="settings-fields-row">
                    <label className="settings-inline">
                      실행 명령
                      <input
                        disabled={!bridge}
                        onChange={(event) => setCursorCommand(event.target.value)}
                        placeholder="비우면 자동 탐색"
                        value={cursorCommand}
                      />
                    </label>
                    <label className="settings-inline">
                      접두 인자
                      <input
                        disabled={!bridge}
                        onChange={(event) => setCursorPrefix(event.target.value)}
                        placeholder="보통 비움"
                        value={cursorPrefix}
                      />
                    </label>
                  </div>
                </div>
              ) : null}
            </div>
            {!bridge ? (
              <p className="onboarding-note">
                브라우저 데모에서는 저장할 수 없습니다. Electron 앱에서 설정을
                저장하세요.
              </p>
            ) : null}
            <div className="onboarding-actions">
              <button
                disabled={saving}
                onClick={() => void saveTiersAndNext()}
                type="button"
              >
                {saving ? "저장 중…" : "저장하고 다음"}
              </button>
              <button className="ghost" onClick={() => setStep(3)} type="button">
                건너뛰기
              </button>
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Rocket size={30} />
            <h1>첫 업무를 맡겨보세요</h1>
            <p>
              {starredCommands.length > 0
                ? "즐겨찾기한 명령을 누르면 바로 시작합니다."
                : "아래 예시를 누르면 바로 시작합니다."}
            </p>
            <div className="onboarding-examples">
              {quickCommands.map((command) => (
                <button
                  key={command}
                  onClick={() => finish(command)}
                  type="button"
                >
                  {command}
                </button>
              ))}
            </div>
            <div className="onboarding-actions">
              <button className="ghost" onClick={() => finish()} type="button">
                직접 입력할게요
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
