import {
  BookOpen,
  Cpu,
  ExternalLink,
  Sparkles,
  Terminal,
} from "lucide-react";

type ConnectionGuideProps = {
  /** 설정 화면 전체 가이드 vs 온보딩 요약 */
  variant?: "full" | "compact";
  /** Electron 앱에서 키 입력 가능 여부 */
  canSaveKeys?: boolean;
};

const providerCards = [
  {
    id: "openai",
    name: "OpenAI (GPT)",
    tier: "economy",
    badge: "API 키",
    summary: "리서치·보조 업무에 적합합니다. economy 티어에 연결하세요.",
    steps: [
      "platform.openai.com → API Keys에서 새 키를 만듭니다.",
      "아래 「API 키」란에 OpenAI 키를 입력하고 저장합니다.",
      "모델 티어 표에서 economy → Provider를 openai, 모델을 gpt-4.1-mini 등으로 설정합니다.",
    ],
    link: "https://platform.openai.com/api-keys",
    linkLabel: "OpenAI API 키 발급",
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    tier: "standard / premium",
    badge: "API 키",
    summary: "기획·개발·고난도 검토에 적합합니다. standard 또는 premium 티어에 연결하세요.",
    steps: [
      "console.anthropic.com → API Keys에서 키를 발급합니다.",
      "아래 「API 키」란에 Anthropic 키를 입력하고 저장합니다.",
      "standard → anthropic + claude-sonnet-4-5, premium → claude-opus-4-5 권장.",
    ],
    link: "https://console.anthropic.com/settings/keys",
    linkLabel: "Anthropic API 키 발급",
  },
  {
    id: "lmstudio",
    name: "LM Studio",
    tier: "local / economy",
    badge: "로컬 서버",
    summary:
      "PC에서 돌리는 오프라인 모델입니다. API 키·비용 없이 완전 로컬로 실행할 수 있습니다.",
    steps: [
      "LM Studio(lmstudio.ai)를 설치하고 모델을 다운로드합니다.",
      "Developer(Local Server) 탭에서 Start Server를 누릅니다 (기본 http://localhost:1234/v1).",
      "모델 티어 표에서 local 또는 economy → Provider를 lmstudio로 선택합니다.",
      "모델 이름을 LM Studio에 로드된 모델 식별자와 동일하게 입력합니다 (서버 로그/모델 목록에서 확인).",
      "아래 「연결 상태」에서 새로고침 → LM Studio가 '서버 연결됨'이면 준비 완료입니다.",
    ],
    link: "https://lmstudio.ai",
    linkLabel: "LM Studio 다운로드",
  },
  {
    id: "codex-cli",
    name: "Codex CLI",
    tier: "local",
    badge: "로컬 CLI",
    summary: "ChatGPT/Codex 구독을 그대로 씁니다. API 키 없이 PC에서 codex가 실행됩니다.",
    steps: [
      "터미널에서 codex CLI가 설치되어 있는지 확인합니다 (codex --version).",
      "최초 1회: codex login 으로 로그인합니다.",
      "모델 티어 표에서 local → Provider를 codex-cli로 선택하고 저장합니다.",
      "OfficeAI가 업무 실행 시 내부에서 codex exec 를 자동 호출합니다. 터미널에 직접 입력할 필요 없습니다.",
    ],
    link: "https://developers.openai.com/codex/cli/",
    linkLabel: "Codex CLI 문서",
  },
  {
    id: "cursor-agent-cli",
    name: "Cursor Agent CLI",
    tier: "local",
    badge: "로컬 CLI",
    summary: "Cursor 구독으로 코드 수정·개발 업무를 맡깁니다. CommandBar 지시만으로 agent가 실행됩니다.",
    steps: [
      "Cursor Agent CLI를 설치합니다 (cursor.com/docs/cli).",
      "최초 1회: agent login (또는 cursor agent login) 으로 로그인합니다.",
      "모델 티어 표에서 local → Provider를 cursor-agent-cli로 선택하고 저장합니다.",
      "Windows에서 agent 명령이 없으면 Cursor 앱과 함께 설치된 cursor 경로를 사용하거나, 설정 파일(config/providers.local.json)에 cursorAgentCli 항목을 추가하세요.",
    ],
    link: "https://cursor.com/docs/cli/overview",
    linkLabel: "Cursor Agent CLI 문서",
  },
] as const;

export function ConnectionGuide({
  variant = "full",
  canSaveKeys = true,
}: ConnectionGuideProps) {
  if (variant === "compact") {
    return (
      <div className="connection-guide connection-guide--compact">
        <p className="connection-guide-lead">
          연결 방식을 골라 설정하세요. API 키는 OS 키체인에 암호화 저장됩니다.
        </p>
        <div className="connection-guide-cards">
          {providerCards.map((card) => (
            <article className="connection-guide-card" key={card.id}>
              <div className="connection-guide-card-head">
                <strong>{card.name}</strong>
                <span className="connection-guide-badge">{card.badge}</span>
              </div>
              <small>{card.tier} 티어</small>
              <p>{card.summary}</p>
            </article>
          ))}
        </div>
        <p className="connection-guide-note">
          {canSaveKeys
            ? "아래에서 키를 입력하거나, 설정 화면에서 티어·Provider를 바꿀 수 있습니다."
            : "브라우저 데모에서는 mock으로 동작합니다. 실제 연결은 Electron 앱 설정에서 하세요."}
        </p>
      </div>
    );
  }

  return (
    <div className="connection-guide">
      <div className="connection-guide-intro">
        <BookOpen size={14} />
        <div>
          <h2>AI 연결 가이드</h2>
          <p>
            OfficeAI는 업무 난이도에 따라 <strong>local → economy → standard → premium</strong>{" "}
            티어로 AI를 자동 배정합니다. 아래에서 쓰실 서비스만 연결하면 됩니다.
          </p>
        </div>
      </div>

      <div className="connection-guide-tier-map">
        <div>
          <span className="tier-badge tier-local">local</span>
          <span>
            LM Studio · Codex CLI · Cursor Agent CLI — 로컬/구독, API 키 불필요
          </span>
        </div>
        <div>
          <span className="tier-badge tier-economy">economy</span>
          <span>OpenAI 또는 LM Studio — 가벼운 리서치·보조</span>
        </div>
        <div>
          <span className="tier-badge tier-standard">standard</span>
          <span>Claude (Anthropic) — 기획·개발</span>
        </div>
        <div>
          <span className="tier-badge tier-premium">premium</span>
          <span>Claude Opus — 고난도·최종 검토</span>
        </div>
      </div>

      <div className="connection-guide-list">
        {providerCards.map((card) => (
          <details className="connection-guide-item" key={card.id}>
            <summary>
              <span className="connection-guide-item-title">{card.name}</span>
              <span className="connection-guide-badge">{card.badge}</span>
              <span className="connection-guide-tier-hint">{card.tier}</span>
            </summary>
            <div className="connection-guide-item-body">
              <p>{card.summary}</p>
              <ol>
                {card.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <a
                className="connection-guide-link"
                href={card.link}
                rel="noreferrer"
                target="_blank"
              >
                {card.linkLabel}
                <ExternalLink size={11} />
              </a>
            </div>
          </details>
        ))}

        <details className="connection-guide-item">
          <summary>
            <span className="connection-guide-item-title">mock (데모)</span>
            <span className="connection-guide-badge">테스트</span>
            <span className="connection-guide-tier-hint">모든 티어</span>
          </summary>
          <div className="connection-guide-item-body">
            <p>
              API 키나 CLI 없이 흐름만 확인할 때 사용합니다. 브라우저 미리보기(
              <code>npm run dev</code>)는 기본적으로 mock으로 동작합니다.
            </p>
          </div>
        </details>
      </div>

      <div className="connection-guide-tips">
        <div>
          <Sparkles size={13} />
          <span>
            CommandBar에 지시만 입력하세요. CLI provider는 OfficeAI가 백그라운드에서
            대신 실행합니다.
          </span>
        </div>
        <div>
          <Terminal size={13} />
          <span>
            local 티어는 <strong>lmstudio</strong>, <strong>codex-cli</strong>,{" "}
            <strong>cursor-agent-cli</strong> 중 하나를 선택하세요.
          </span>
        </div>
        <div>
          <Cpu size={13} />
          <span>
            설정 저장 후 엔진이 자동 재시작됩니다. 연결 오류는 업무 실행 시 노드
            상태에 표시됩니다.
          </span>
        </div>
      </div>
    </div>
  );
}
