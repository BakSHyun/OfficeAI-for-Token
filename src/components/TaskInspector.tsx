import { useMemo } from "react";
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
import { labelCritic, labelTier } from "../../shared/role-labels";
import type {
  ApprovalRequest,
  BudgetScopeState,
  CriticVerdict,
} from "../state/bridge-types";
import { formatCost } from "../state/format-cost";
import type { LiveNode, RunState } from "../state/engine-store";
import type { Agent } from "../types";

type TaskInspectorProps = {
  selectedAgent: Agent;
  selectedNode?: LiveNode;
  activeRun?: RunState;
  runNodes: LiveNode[];
  budgetScopes: BudgetScopeState[];
  dailyTokenBudget: number;
  krwPerUsd: number;
  isPaused: boolean;
  evidenceOpen: boolean;
  pendingApproval?: ApprovalRequest;
  onPause: () => void;
  onStop: () => void;
  onToggleEvidence: () => void;
  onApprove: () => void;
};

const stages = ["접수", "분해", "실행", "검증", "보고"];

const statusLabel: Record<string, string> = {
  running: "실행 중",
  completed: "완료",
  failed: "실패",
  cancelled: "취소",
};

function pipelineIndex(run: RunState | undefined, nodes: LiveNode[]) {
  if (!run) return 0;
  if (
    run.status === "completed" ||
    run.status === "failed" ||
    run.status === "cancelled"
  ) {
    return 4;
  }
  const executorBusy = nodes.some(
    (node) =>
      node.descriptor.kind === "executor" &&
      (node.status === "working" || node.status === "spawned"),
  );
  const criticBusy = nodes.some(
    (node) =>
      node.descriptor.kind === "critic" &&
      (node.status === "working" || node.status === "spawned"),
  );
  if (criticBusy || run.verdicts.length > 0) return 3;
  if (executorBusy) return 2;
  if (run.plan) return 1;
  return 0;
}

function pipelineMessage(
  run: RunState | undefined,
  nodes: LiveNode[],
  activeIndex: number,
) {
  if (!run) return "명령을 입력하면 업무가 시작됩니다.";
  if (run.status === "completed") {
    return run.report?.summary ?? "업무가 완료되었습니다.";
  }
  if (run.status === "failed") return "업무 실행 중 오류가 발생했습니다.";
  if (run.status === "cancelled") return "사용자가 업무를 취소했습니다.";
  const failed = nodes.find((node) => node.status === "failed");
  if (failed?.detail) return failed.detail;
  const busy = nodes.find((node) => node.status === "working");
  if (busy?.detail) return busy.detail;
  const labels = ["접수", "작업 분해", "유닛 실행", "검토", "보고"];
  return `현재 단계 · ${labels[activeIndex] ?? "진행"}`;
}

function tierDistribution(run: RunState | undefined) {
  const counts = { local: 0, economy: 0, standard: 0, premium: 0 };
  if (!run?.plan) return counts;
  for (const unit of run.plan.units) counts[unit.tier] += 1;
  return counts;
}

function verdictEvidence(verdicts: CriticVerdict[]) {
  return verdicts.map((verdict, index) => ({
    id: `verdict-${index}`,
    label: `${labelCritic(verdict.persona)} 검토 (${verdict.score}점)`,
    source:
      verdict.issues[0] ??
      (verdict.verdict === "approve" ? "승인" : "수정 요청"),
    status:
      verdict.verdict === "approve"
        ? ("passed" as const)
        : ("failed" as const),
  }));
}

export function TaskInspector({
  selectedAgent,
  selectedNode,
  activeRun,
  runNodes,
  budgetScopes,
  dailyTokenBudget,
  krwPerUsd,
  isPaused,
  evidenceOpen,
  pendingApproval,
  onPause,
  onStop,
  onToggleEvidence,
  onApprove,
}: TaskInspectorProps) {
  const activeIndex = pipelineIndex(activeRun, runNodes);
  const stageMessage = pipelineMessage(activeRun, runNodes, activeIndex);
  const tiers = useMemo(() => tierDistribution(activeRun), [activeRun]);
  const tierTotal = Object.values(tiers).reduce((sum, value) => sum + value, 0);

  const runBudget = activeRun
    ? budgetScopes.find(
        (scope) => scope.scope === "run" && scope.key === activeRun.runId,
      )
    : undefined;
  const globalBudget = budgetScopes.find(
    (scope) => scope.scope === "global" && scope.key === "today",
  );
  const budgetScope = runBudget ?? globalBudget;
  const usedTokens = budgetScope?.usedTokens ?? 0;
  const budgetTokens = budgetScope?.budgetTokens ?? dailyTokenBudget;
  const budgetRatio =
    budgetTokens > 0 ? Math.min(100, (usedTokens / budgetTokens) * 100) : 0;

  const verdicts = activeRun?.report?.verdicts ?? activeRun?.verdicts ?? [];
  const evidence = verdictEvidence(verdicts);

  const runStatus = activeRun?.status ?? "idle";
  const displayStatus =
    isPaused && runStatus === "running"
      ? "일시 정지"
      : activeRun
        ? (statusLabel[runStatus] ?? runStatus)
        : "대기";

  const dotClass =
    runStatus === "failed"
      ? "failed"
      : runStatus === "completed"
        ? "review"
        : runStatus === "running"
          ? "running"
          : "waiting";

  return (
    <aside className="inspector">
      <div className="inspector-heading">
        <span>업무 상세</span>
        <small>{activeRun ? `RUN-${activeRun.runId}` : "대기"}</small>
      </div>

      <section className="task-title">
        <span>선택된 업무</span>
        <h1>{activeRun?.command ?? "진행 중인 업무 없음"}</h1>
        <div>
          <span className={`status-dot ${dotClass}`} />
          {displayStatus}
        </div>
        <dl>
          <div>
            <dt>담당 에이전트</dt>
            <dd>{selectedAgent.name}</dd>
          </div>
          <div>
            <dt>현재 작업</dt>
            <dd>{selectedNode?.detail || selectedAgent.task}</dd>
          </div>
        </dl>
      </section>

      <section className="inspector-section">
        <div className="section-title">
          <h2>작업 파이프라인</h2>
          <span>
            {activeRun
              ? `${Math.min(activeIndex + 1, stages.length)} / ${stages.length}`
              : "—"}
          </span>
        </div>
        <div className="pipeline">
          {stages.map((stage, index) => (
            <div
              className={
                index < activeIndex
                  ? "done"
                  : index === activeIndex
                    ? "active"
                    : "pending"
              }
              key={stage}
            >
              <i>{index < activeIndex ? <Check size={12} /> : index + 1}</i>
              <span>{stage}</span>
            </div>
          ))}
        </div>
        <div className="stage-message">
          <Clock3 size={14} />
          <p>
            <strong>{stageMessage}</strong>
          </p>
        </div>
      </section>

      {tierTotal > 0 ? (
        <section className="inspector-section">
          <div className="section-title">
            <h2>모델 라우팅</h2>
            <span>이번 run</span>
          </div>
          <div className="routing-list">
            {(
              [
                ["local", "로컬"],
                ["economy", "이코노미"],
                ["standard", "스탠다드"],
                ["premium", "프리미엄"],
              ] as const
            ).map(([tier, label]) => {
              const count = tiers[tier];
              if (count === 0) return null;
              const ratio = Math.round((count / tierTotal) * 100);
              return (
                <div key={tier}>
                  <span>{label}</span>
                  <small>
                    {labelTier(tier)} · {count}개 유닛
                  </small>
                  <i>
                    <b style={{ width: `${ratio}%` }} />
                  </i>
                  <em>{ratio}%</em>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="inspector-section budget">
        <div className="section-title">
          <h2>토큰 예산</h2>
          <span>{Math.round(budgetRatio)}%</span>
        </div>
        <strong>
          {(usedTokens / 1_000_000).toFixed(2)}M{" "}
          <small>/ {(budgetTokens / 1_000_000).toFixed(2)}M</small>
        </strong>
        <div className="meter">
          <i style={{ width: `${budgetRatio}%` }} />
        </div>
        <div className="budget-meta">
          <span>사용 비용</span>
          <strong>
            {formatCost(
              activeRun?.report?.totalUsage.costUsd ?? 0,
              { globalDailyTokens: dailyTokenBudget, krwPerUsd },
            )}
          </strong>
        </div>
      </section>

      <section className="inspector-section evidence">
        <button
          aria-expanded={evidenceOpen}
          className="section-title evidence-toggle"
          onClick={onToggleEvidence}
          type="button"
        >
          <h2>
            근거 <small>(Evidence)</small>
          </h2>
          <span>{evidence.length}건</span>
          {evidenceOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        {evidenceOpen ? (
          evidence.length > 0 ? (
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
          ) : (
            <p className="inspector-empty-note">아직 검증 결과가 없습니다.</p>
          )
        ) : null}
      </section>

      {pendingApproval ? (
        <section className="approval-gate">
          <div>
            <CircleAlert size={17} />
            <span>
              <strong>승인 필요</strong>
              {pendingApproval.reason}
            </span>
          </div>
          <button onClick={onApprove} type="button">
            <Check size={15} />
            승인하기
          </button>
        </section>
      ) : null}

      <div className="task-controls">
        <button disabled={!activeRun} onClick={onPause} type="button">
          <Pause size={15} />
          {isPaused ? "계속 실행" : "일시 정지"}
        </button>
        <button disabled={!activeRun} onClick={onStop} type="button">
          <Square fill="currentColor" size={12} />
          중지
        </button>
      </div>
    </aside>
  );
}
