import { useEffect, useState } from "react";
import { History } from "lucide-react";
import type { RecentRun } from "../state/bridge-types";
import type { RunState } from "../state/engine-store";

type RunsViewProps = {
  runs: Record<string, RunState>;
  onSelect: (runId: string) => void;
};

const statusLabel: Record<string, string> = {
  running: "실행 중",
  completed: "완료",
  failed: "실패",
  cancelled: "취소",
};

export function RunsView({ runs, onSelect }: RunsViewProps) {
  const [history, setHistory] = useState<RecentRun[]>([]);

  useEffect(() => {
    void window.officeai?.recentRuns(50).then(setHistory);
  }, []);

  const liveRuns = Object.values(runs).sort((a, b) =>
    b.startedAt.localeCompare(a.startedAt),
  );
  const liveIds = new Set(liveRuns.map((run) => run.runId));
  const pastRuns = history.filter((run) => !liveIds.has(run.runId));

  if (liveRuns.length === 0 && pastRuns.length === 0) {
    return (
      <section className="view-panel decision-empty">
        <History size={34} strokeWidth={1.4} />
        <h1>업무 이력이 없습니다</h1>
        <p>첫 명령을 내리면 실행 이력과 토큰·비용이 여기에 쌓입니다.</p>
      </section>
    );
  }

  return (
    <section className="view-panel">
      <header className="view-heading">
        <h1>업무 관리</h1>
        <span>
          진행 {liveRuns.filter((run) => run.status === "running").length}건 ·
          이력 {liveRuns.length + pastRuns.length}건
        </span>
      </header>
      <table className="runs-table">
        <thead>
          <tr>
            <th>명령</th>
            <th>상태</th>
            <th>토큰</th>
            <th>비용</th>
            <th>시작</th>
          </tr>
        </thead>
        <tbody>
          {liveRuns.map((run) => (
            <tr key={run.runId} onClick={() => onSelect(run.runId)}>
              <td>{run.command}</td>
              <td>
                <em className={`run-status ${run.status}`}>
                  {statusLabel[run.status] ?? run.status}
                </em>
              </td>
              <td>
                {run.report
                  ? (
                      run.report.totalUsage.inputTokens +
                      run.report.totalUsage.outputTokens
                    ).toLocaleString()
                  : "—"}
              </td>
              <td>
                {run.report
                  ? `$${run.report.totalUsage.costUsd.toFixed(4)}`
                  : "—"}
              </td>
              <td>
                {new Intl.DateTimeFormat("ko-KR", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(run.startedAt))}
              </td>
            </tr>
          ))}
          {pastRuns.map((run) => (
            <tr className="is-history" key={run.runId}>
              <td>{run.command}</td>
              <td>
                <em className={`run-status ${run.status}`}>
                  {statusLabel[run.status] ?? run.status}
                </em>
              </td>
              <td>{(run.inputTokens + run.outputTokens).toLocaleString()}</td>
              <td>${run.costUsd.toFixed(4)}</td>
              <td>
                {run.startedAt
                  ? new Intl.DateTimeFormat("ko-KR", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(run.startedAt))
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
