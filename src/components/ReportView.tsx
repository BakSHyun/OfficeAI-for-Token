import { FileText } from "lucide-react";
import type { RunState } from "../state/engine-store";

type ReportViewProps = {
  run?: RunState;
};

export function ReportView({ run }: ReportViewProps) {
  if (!run?.report) {
    return (
      <section className="view-panel decision-empty">
        <FileText size={34} strokeWidth={1.4} />
        <h1>보고서가 없습니다</h1>
        <p>업무가 완료되면 산출물과 검토 결과가 여기에 정리됩니다.</p>
      </section>
    );
  }

  const { report } = run;
  return (
    <section className="view-panel">
      <header className="view-heading">
        <h1>실행 보고</h1>
        <span>
          토큰 {""}
          {(
            report.totalUsage.inputTokens + report.totalUsage.outputTokens
          ).toLocaleString()}{" "}
          · ${report.totalUsage.costUsd.toFixed(4)}
        </span>
      </header>

      <div className="report-summary">
        <span>명령</span>
        <p>{report.command}</p>
        <span>요약</span>
        <p>{report.summary}</p>
      </div>

      {run.verdicts.length > 0 ? (
        <div className="verdict-strip">
          {run.verdicts.map((verdict, index) => (
            <span
              className={verdict.verdict === "approve" ? "ok" : "warn"}
              key={`${verdict.persona}-${index}`}
            >
              {verdict.persona} {verdict.score}점
            </span>
          ))}
        </div>
      ) : null}

      {report.deliverables.map((deliverable) => (
        <article className="report-deliverable" key={deliverable.unitId}>
          <h2>{deliverable.title}</h2>
          <pre>{deliverable.deliverable}</pre>
        </article>
      ))}
    </section>
  );
}
