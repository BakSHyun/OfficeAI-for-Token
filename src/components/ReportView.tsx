import { useState } from "react";
import { Copy, Download, FileText } from "lucide-react";
import { formatCost } from "../state/format-cost";
import { DeliverableActions } from "./DeliverableActions";
import { copyDeliverableToClipboard } from "../state/export-deliverable";
import { formatSavingsMessage } from "../state/savings";
import { useSavings } from "../state/use-savings";
import type { RunState } from "../state/engine-store";

type ReportViewProps = {
  run?: RunState;
};

type DeliverableCardProps = {
  title: string;
  content: string;
};

function DeliverableCard({ title, content }: DeliverableCardProps) {
  const [note, setNote] = useState("");
  const bridge = window.officeai;

  async function handleCopy() {
    try {
      await copyDeliverableToClipboard(content);
      setNote("클립보드에 복사했습니다");
    } catch {
      setNote("복사에 실패했습니다");
    }
  }

  async function handleSave() {
    if (!bridge) return;
    try {
      const result = await bridge.exportDeliverable({ title, content });
      setNote(
        result.saved && result.path
          ? `저장됨: ${result.path}`
          : "저장이 취소되었습니다",
      );
    } catch {
      setNote("저장에 실패했습니다");
    }
  }

  return (
    <article className="report-deliverable">
      <div className="report-deliverable-header">
        <h2>{title}</h2>
        <div className="report-deliverable-actions">
          <button
            className="panel-btn"
            onClick={() => void handleCopy()}
            type="button"
          >
            <Copy size={12} /> 복사
          </button>
          {bridge ? (
            <button
              className="panel-btn"
              onClick={() => void handleSave()}
              type="button"
            >
              <Download size={12} /> MD 저장
            </button>
          ) : null}
        </div>
      </div>
      <pre>{content}</pre>
      <DeliverableActions content={content} />
      {note ? <p className="report-deliverable-note">{note}</p> : null}
    </article>
  );
}

export function ReportView({ run }: ReportViewProps) {
  const savings = useSavings(run?.runId);

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
  const savingsMessage = savings ? formatSavingsMessage(savings) : null;
  return (
    <section className="view-panel">
      <header className="view-heading">
        <h1>실행 보고</h1>
        <span>
          토큰 {""}
          {(
            report.totalUsage.inputTokens + report.totalUsage.outputTokens
          ).toLocaleString()}{" "}
          · {formatCost(report.totalUsage.costUsd)}
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
        <DeliverableCard
          content={
            deliverable.deliverable.trim() ||
            "(산출물이 비어 있습니다 — 모델 라우팅에서 Cursor Agent CLI 연결을 확인하세요)"
          }
          key={deliverable.unitId}
          title={deliverable.title}
        />
      ))}

      {savingsMessage && savings && savings.savedPercent > 0 ? (
        <footer className="report-savings">
          <div className="verdict-strip">
            <span className="ok">{savings.savedPercent}% 토큰 절약</span>
          </div>
          <p>{savingsMessage}</p>
        </footer>
      ) : null}
    </section>
  );
}
