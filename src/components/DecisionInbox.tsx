import {
  AlertOctagon,
  CircleDollarSign,
  ClipboardList,
  Inbox,
  ShieldAlert,
} from "lucide-react";
import type { ApprovalRequest } from "../state/bridge-types";

type PlanUnitSummary = {
  id: string;
  title: string;
  role: string;
  tier: string;
  critics: string[];
};

const kindMeta: Record<
  ApprovalRequest["kind"],
  { label: string; icon: typeof Inbox; tone: string }
> = {
  "plan-confirm": { label: "계획 승인", icon: ClipboardList, tone: "blue" },
  "budget-escalation": {
    label: "예산 초과",
    icon: CircleDollarSign,
    tone: "amber",
  },
  "critic-rejection": { label: "검토 반려", icon: ShieldAlert, tone: "orange" },
  "side-effect": { label: "외부 실행", icon: AlertOctagon, tone: "coral" },
};

type DecisionInboxProps = {
  approvals: ApprovalRequest[];
  onResolve: (requestId: string, approved: boolean) => void;
};

export function DecisionInbox({ approvals, onResolve }: DecisionInboxProps) {
  if (approvals.length === 0) {
    return (
      <section className="view-panel decision-empty">
        <Inbox size={34} strokeWidth={1.4} />
        <h1>결정할 항목이 없습니다</h1>
        <p>
          노드 AI들이 알아서 일하는 중입니다. 승인이 필요한 순간에만 여기로
          모입니다.
        </p>
      </section>
    );
  }

  return (
    <section className="view-panel">
      <header className="view-heading">
        <h1>결정 인박스</h1>
        <span>{approvals.length}건 대기 중</span>
      </header>
      <div className="decision-list">
        {approvals.map((request) => {
          const meta = kindMeta[request.kind];
          const Icon = meta.icon;
          const units = Array.isArray(request.payload?.units)
            ? (request.payload.units as PlanUnitSummary[])
            : null;
          return (
            <article className={`decision-card tone-${meta.tone}`} key={request.id}>
              <div className="decision-head">
                <Icon size={16} />
                <strong>{meta.label}</strong>
                <time>
                  {new Intl.DateTimeFormat("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(request.requestedAt))}
                </time>
              </div>
              <p className="decision-reason">{request.reason}</p>
              {units ? (
                <table className="decision-units">
                  <thead>
                    <tr>
                      <th>작업</th>
                      <th>역할</th>
                      <th>AI 레벨</th>
                      <th>검토</th>
                    </tr>
                  </thead>
                  <tbody>
                    {units.map((unit) => (
                      <tr key={unit.id}>
                        <td>{unit.title}</td>
                        <td>{unit.role}</td>
                        <td>
                          <span className={`tier-badge tier-${unit.tier}`}>
                            {unit.tier}
                          </span>
                        </td>
                        <td>{unit.critics.join(", ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
              {Array.isArray(request.payload?.verdicts) ? (
                <ul className="decision-verdicts">
                  {(
                    request.payload.verdicts as Array<{
                      persona: string;
                      score: number;
                      issues: string[];
                    }>
                  ).map((verdict) => (
                    <li key={verdict.persona}>
                      <strong>{verdict.persona}</strong> {verdict.score}점 —{" "}
                      {verdict.issues.join(" / ") || "사유 미기재"}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="decision-actions">
                <button
                  className="approve"
                  onClick={() => onResolve(request.id, true)}
                  type="button"
                >
                  승인
                </button>
                <button
                  className="reject"
                  onClick={() => onResolve(request.id, false)}
                  type="button"
                >
                  반려
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
