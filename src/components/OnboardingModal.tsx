import { useState } from "react";
import { KeyRound, Rocket, Sparkles } from "lucide-react";
import { ONBOARDING_KEY } from "../state/onboarding";

type OnboardingModalProps = {
  onFinish: (firstCommand?: string) => void;
};

const exampleCommands = [
  "이번 주 업무를 파악하고 다음 주 계획을 세워줘",
  "신규 기능 아이디어를 기획서로 정리해줘",
  "경쟁사 3곳을 조사하고 비교 보고서를 만들어줘",
];

export function OnboardingModal({ onFinish }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [saving, setSaving] = useState(false);
  const bridge = window.officeai;

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

  return (
    <div className="onboarding-backdrop">
      <div className="onboarding-modal">
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
              키체인에 암호화되어 저장되며 외부로 전송되지 않습니다. 나중에
              설정에서 변경할 수 있습니다.
            </p>
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
                키 없이 둘러보기
              </button>
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Rocket size={30} />
            <h1>첫 업무를 맡겨보세요</h1>
            <p>아래 예시를 누르면 바로 시작합니다.</p>
            <div className="onboarding-examples">
              {exampleCommands.map((command) => (
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
