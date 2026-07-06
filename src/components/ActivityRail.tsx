import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ShieldCheck,
} from "lucide-react";
import type { Activity } from "../types";

type ActivityRailProps = {
  activities: Activity[];
};

export function ActivityRail({ activities }: ActivityRailProps) {
  return (
    <section className="activity-rail">
      <div className="usage-panel">
        <div className="rail-heading">
          <h2>실시간 사용 현황</h2>
          <span>10:18 기준</span>
        </div>
        <div className="usage-row">
          <span>토큰 사용량</span>
          <strong>1.24M <small>/ 2.00M</small></strong>
          <div><i style={{ width: "62%" }} /></div>
        </div>
        <div className="usage-row">
          <span>예상 비용</span>
          <strong>₩21,450 <small>/ ₩35,000</small></strong>
          <div><i style={{ width: "61%" }} /></div>
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
          <span>2건</span>
        </div>
        <div className="approval-item">
          <Clock3 size={16} />
          <div>
            <strong>신규 기능 출시 범위 확정</strong>
            <small>PM냥 · 6분 전</small>
          </div>
          <button type="button">검토</button>
        </div>
        <div className="approval-item">
          <CircleDollarSign size={16} />
          <div>
            <strong>예산 초과 가능성 검토</strong>
            <small>검증냥 · 10분 전</small>
          </div>
          <button type="button">검토</button>
        </div>
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
