import { CirclePause, Maximize2, Radio, Volume2 } from "lucide-react";
import type { Agent, AgentStatus } from "../types";

const statusLabel: Record<AgentStatus, string> = {
  running: "실행 중",
  review: "검증 중",
  waiting: "대기",
  paused: "보류",
};

type OfficeCanvasProps = {
  agents: Agent[];
  selectedAgentId: string;
  onSelectAgent: (id: string) => void;
  /** true면 외부 패널/툴바 없이 씬만 렌더 (App의 통합 패널에 삽입용) */
  embedded?: boolean;
};

export function OfficeCanvas({
  agents,
  selectedAgentId,
  onSelectAgent,
  embedded = false,
}: OfficeCanvasProps) {
  const scene = (
    <div className="office-scene">
        <img
          alt="기획, 개발, PM, 검증, 휴식 공간으로 구성된 AI 에이전트 오피스"
          src="/assets/office-diorama.png"
        />
        <div className="scene-shade" />
        <div className="zone-label zone-plan">기획팀</div>
        <div className="zone-label zone-dev">개발팀</div>
        <div className="zone-label zone-pm">PM</div>
        <div className="zone-label zone-review">검증팀</div>
        <div className="zone-label zone-break">브레이크 존</div>

        {agents.map((agent) => (
          <button
            aria-pressed={selectedAgentId === agent.id}
            className={
              selectedAgentId === agent.id
                ? "agent-card is-selected"
                : "agent-card"
            }
            key={agent.id}
            onClick={() => onSelectAgent(agent.id)}
            style={agent.position}
            type="button"
          >
            <span className={`status-dot ${agent.status}`} />
            <span className="agent-copy">
              <strong>{agent.name}</strong>
              <small>{agent.task}</small>
            </span>
            <em>{statusLabel[agent.status]}</em>
            <span className="agent-progress">
              <i style={{ width: `${agent.progress}%` }} />
            </span>
          </button>
        ))}

        <div className="scene-summary">
          <span>오늘의 업무</span>
          <strong>신규 기능 출시 계획 수립</strong>
          <div>
            <i style={{ width: "58%" }} />
          </div>
          <small>전체 진행률 58%</small>
        </div>

        <div className="scene-legend">
          <span>
            <i className="running" /> 실행 중
          </span>
          <span>
            <i className="review" /> 검증 중
          </span>
          <span>
            <i className="waiting" /> 대기
          </span>
        </div>
      </div>
  );

  if (embedded) return scene;

  return (
    <section className="office-panel" aria-label="AI 에이전트 오피스">
      <div className="office-toolbar">
        <div>
          <Radio size={15} />
          <span>라이브 오피스</span>
          <small>{agents.length}명 접속</small>
        </div>
        <div>
          <button aria-label="소리" type="button">
            <Volume2 size={15} />
          </button>
          <button aria-label="일시 정지" type="button">
            <CirclePause size={15} />
          </button>
          <button aria-label="전체 화면" type="button">
            <Maximize2 size={15} />
          </button>
        </div>
      </div>
      {scene}
    </section>
  );
}
