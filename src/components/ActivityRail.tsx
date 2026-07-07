import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ShieldCheck,
} from "lucide-react";
import type { Activity } from "../types";

const DAILY_TOKEN_BUDGET = 2_000_000;

function formatTokens(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${value}`;
}

type ActivityRailProps = {
  activities: Activity[];
  usage?: { inputTokens: number; outputTokens: number; costUsd: number };
  approvalCount?: number;
};

export function ActivityRail({
  activities,
  usage,
  approvalCount = 0,
}: ActivityRailProps) {
  const totalTokens = usage ? usage.inputTokens + usage.outputTokens : 0;
  const tokenRatio = Math.min(100, (totalTokens / DAILY_TOKEN_BUDGET) * 100);
  return (
    <section className="activity-rail">
      <div className="usage-panel">
        <div className="rail-heading">
          <h2>실시간 사용 현황</h2>
          <span>이번 세션</span>
        </div>
        <div className="usage-row">
          <span>토큰 사용량</span>
          <strong>
            {formatTokens(totalTokens)}{" "}
            <small>/ {formatTokens(DAILY_TOKEN_BUDGET)}</small>
          </strong>
          <div><i style={{ width: `${tokenRatio}%` }} /></div>
        </div>
        <div className="usage-row">
          <span>사용 비용</span>
          <strong>
            ${usage ? usage.costUsd.toFixed(4) : "0.0000"}
          </strong>
          <div><i style={{ width: `${Math.min(100, (usage?.costUsd ?? 0) * 20)}%` }} /></div>
        </div>
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
        <ul>
          <li>
            <CheckCircle2 size={14} />
            기능 흐름 테스트
            <span>통과</span>
          </li>
          <li>
            <CheckCircle2 size={14} />
            보안 취약점 스캔
            <span>통과</span>
          </li>
          <li className="failed">
            <AlertTriangle size={14} />
            외부 유효성 테스트
            <span>실패</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
