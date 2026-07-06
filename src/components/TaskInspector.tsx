import {
  Check,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  Clock3,
  Pause,
  Square,
} from "lucide-react";
import { evidence } from "../data";
import type { Agent } from "../types";

type TaskInspectorProps = {
  selectedAgent: Agent;
  isPaused: boolean;
  evidenceOpen: boolean;
  approvalState: "pending" | "approved";
  onPause: () => void;
  onStop: () => void;
  onToggleEvidence: () => void;
  onApprove: () => void;
};

const stages = ["접수", "분해", "실행", "검증", "보고"];

export function TaskInspector({
  selectedAgent,
  isPaused,
  evidenceOpen,
  approvalState,
  onPause,
  onStop,
  onToggleEvidence,
  onApprove,
}: TaskInspectorProps) {
  return (
    <aside className="inspector">
      <div className="inspector-heading">
        <span>업무 상세</span>
        <small>JOB-2407</small>
      </div>

      <section className="task-title">
        <span>선택된 업무</span>
        <h1>신규 기능 출시 계획 수립</h1>
        <div>
          <span className="status-dot running" />
          {isPaused ? "일시 정지" : "실행 중"}
        </div>
        <dl>
          <div>
            <dt>담당 에이전트</dt>
            <dd>{selectedAgent.name}</dd>
          </div>
          <div>
            <dt>현재 작업</dt>
            <dd>{selectedAgent.task}</dd>
          </div>
        </dl>
      </section>

      <section className="inspector-section">
        <div className="section-title">
          <h2>작업 파이프라인</h2>
          <span>3 / 5</span>
        </div>
        <div className="pipeline">
          {stages.map((stage, index) => (
            <div
              className={
                index < 2 ? "done" : index === 2 ? "active" : "pending"
              }
              key={stage}
            >
              <i>{index < 2 ? <Check size={12} /> : index + 1}</i>
              <span>{stage}</span>
            </div>
          ))}
        </div>
        <div className="stage-message">
          <Clock3 size={14} />
          <p>
            <strong>현재 단계 · 실행</strong>
            기능 구현 및 관련 작업이 병렬로 진행 중입니다.
          </p>
        </div>
      </section>

      <section className="inspector-section">
        <div className="section-title">
          <h2>모델 라우팅</h2>
          <button type="button">정책 보기</button>
        </div>
        <div className="routing-list">
          <div>
            <span>경제형</span>
            <small>분류 · 요약 · 변환</small>
            <i>
              <b style={{ width: "42%" }} />
            </i>
            <em>42%</em>
          </div>
          <div>
            <span>표준형</span>
            <small>기획 · 문서 · 코드</small>
            <i>
              <b style={{ width: "46%" }} />
            </i>
            <em>46%</em>
          </div>
          <div>
            <span>프리미엄</span>
            <small>최종 검증 · 난제</small>
            <i>
              <b style={{ width: "12%" }} />
            </i>
            <em>12%</em>
          </div>
        </div>
      </section>

      <section className="inspector-section budget">
        <div className="section-title">
          <h2>토큰 예산</h2>
          <span>62%</span>
        </div>
        <strong>1.24M <small>/ 2.00M</small></strong>
        <div className="meter">
          <i style={{ width: "62%" }} />
        </div>
        <div className="budget-meta">
          <span>예상 비용</span>
          <strong>₩21,450 / ₩35,000</strong>
        </div>
      </section>

      <section className="inspector-section evidence">
        <button
          aria-expanded={evidenceOpen}
          className="section-title evidence-toggle"
          onClick={onToggleEvidence}
          type="button"
        >
          <h2>근거 <small>(Evidence)</small></h2>
          <span>{evidence.length}건</span>
          {evidenceOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        {evidenceOpen ? (
          <ul>
            {evidence.map((item) => (
              <li key={item.id}>
                {item.status === "passed" ? (
                  <CircleCheck size={14} />
                ) : (
                  <CircleAlert size={14} />
                )}
                <span>{item.label}</span>
                <small>{item.source}</small>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="approval-gate">
        <div>
          <CircleAlert size={17} />
          <span>
            <strong>승인 필요</strong>
            보고 전 최종 승인이 필요합니다.
          </span>
        </div>
        <button
          className={approvalState === "approved" ? "is-approved" : ""}
          onClick={onApprove}
          type="button"
        >
          <Check size={15} />
          {approvalState === "approved" ? "승인 완료" : "승인하기"}
        </button>
      </section>

      <div className="task-controls">
        <button onClick={onPause} type="button">
          <Pause size={15} />
          {isPaused ? "계속 실행" : "일시 정지"}
        </button>
        <button onClick={onStop} type="button">
          <Square fill="currentColor" size={12} />
          중지
        </button>
      </div>
    </aside>
  );
}
