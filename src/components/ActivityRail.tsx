import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ShieldCheck,
} from "lucide-react";
import type { BudgetScopeState, CriticVerdict, SavingsSummary } from "../state/bridge-types";
import { labelCritic } from "../../shared/role-labels";
import { formatCost } from "../state/format-cost";
import { formatSavingsMessage } from "../state/savings";
import type { Activity } from "../types";

function formatTokens(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${value}`;
}

function hasBudgetWarning(scopes: BudgetScopeState[]) {
  return scopes.some(
    (scope) =>
      scope.budgetTokens > 0 && scope.usedTokens / scope.budgetTokens >= 0.8,
  );
}

type ActivityRailProps = {
  activities: Activity[];
  usage?: { inputTokens: number; outputTokens: number; costUsd: number };
  approvalCount?: number;
  dailyTokenBudget?: number;
  budgetScopes?: BudgetScopeState[];
  savings?: SavingsSummary | null;
  verdicts?: CriticVerdict[];
};

export function ActivityRail({
  activities,
  usage,
  approvalCount = 0,
  dailyTokenBudget = 2_000_000,
  budgetScopes = [],
  savings = null,
  verdicts = [],
}: ActivityRailProps) {
  const totalTokens = usage ? usage.inputTokens + usage.outputTokens : 0;
  const tokenRatio = Math.min(100, (totalTokens / dailyTokenBudget) * 100);
  const budgetWarning = hasBudgetWarning(budgetScopes);
  const costUsd = usage?.costUsd ?? 0;
  const savingsMessage = savings ? formatSavingsMessage(savings) : null;
  return (
    <section className="activity-rail">
      <div className="usage-panel">
        <div className="rail-heading">
          <h2>실시간 사용 현황</h2>
          <span>
            이번 세션
            {budgetWarning ? (
              <span className="rail-status-pill warn">예산 80%</span>
            ) : null}
          </span>
        </div>
        <div className="usage-row">
          <span>토큰 사용량</span>
          <strong>
            {formatTokens(totalTokens)}{" "}
            <small>/ {formatTokens(dailyTokenBudget)}</small>
          </strong>
          <div><i style={{ width: `${tokenRatio}%` }} /></div>
        </div>
        <div className="usage-row">
          <span>사용 비용</span>
          <strong>{formatCost(costUsd)}</strong>
          <div><i style={{ width: `${Math.min(100, costUsd * 20)}%` }} /></div>
        </div>
        {savingsMessage && savings && savings.savedPercent > 0 ? (
          <div className="usage-row usage-row-savings">
            <span>스마트 배정 절약</span>
            <strong>
              {savings.savedPercent}%
              <small>{savingsMessage}</small>
            </strong>
          </div>
        ) : null}
      </div>

      <div className="activity-panel">
        <div className="rail-heading">
          <h2>활동 로그</h2>
          <span>실시간</span>
        </div>
        <ul>
          {activities.map((activity) => (
            <li key={activity.id}>
              <time>{activity.time}</time>
              <span className="agent-tag">{activity.agent}</span>
              <p>{activity.message}</p>
              <em className={activity.status}>
                {activity.status === "passed"
                  ? "통과"
                  : activity.status === "approval"
                    ? "승인"
                    : activity.status === "failed"
                      ? "실패"
                      : "실행"}
              </em>
            </li>
          ))}
        </ul>
      </div>

      <div className="approval-panel">
        <div className="rail-heading">
          <h2>승인 대기</h2>
          <span>{approvalCount}건</span>
        </div>
        {approvalCount === 0 ? (
          <div className="approval-item">
            <Clock3 size={16} />
            <div>
              <strong>대기 중인 결정이 없습니다</strong>
              <small>승인이 필요하면 여기에 표시됩니다</small>
            </div>
          </div>
        ) : (
          <div className="approval-item">
            <CircleDollarSign size={16} />
            <div>
              <strong>{approvalCount}건의 결정이 기다립니다</strong>
              <small>좌측 “승인 대기” 메뉴에서 검토하세요</small>
            </div>
          </div>
        )}
      </div>

      <div className="verification-panel">
        <div className="rail-heading">
          <h2>최근 검증 결과</h2>
          <ShieldCheck size={16} />
        </div>
        {verdicts.length === 0 ? (
          <p className="rail-empty-note">검토가 완료되면 결과가 여기에 표시됩니다.</p>
        ) : (
          <ul>
            {verdicts.slice(0, 6).map((verdict, index) => {
              const passed = verdict.verdict === "approve";
              return (
                <li className={passed ? undefined : "failed"} key={`${verdict.persona}-${index}`}>
                  {passed ? (
                    <CheckCircle2 size={14} />
                  ) : (
                    <AlertTriangle size={14} />
                  )}
                  {labelCritic(verdict.persona)} ({verdict.score}점)
                  <span>{passed ? "통과" : "반려"}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
