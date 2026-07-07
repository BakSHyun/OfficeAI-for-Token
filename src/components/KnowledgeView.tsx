import { useEffect, useState } from "react";
import { BrainCircuit, FolderOpen, ShieldCheck } from "lucide-react";
import type { MemoryStatus } from "../state/bridge-types";
import type { RunState } from "../state/engine-store";

type KnowledgeViewProps = {
  runs: Record<string, RunState>;
};

function snippet(text: string, max = 220) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

export function KnowledgeView({ runs }: KnowledgeViewProps) {
  const bridge = window.officeai;
  const [memory, setMemory] = useState<MemoryStatus | null>(null);

  useEffect(() => {
    if (!bridge) return;
    void bridge.getMemoryStatus().then(setMemory);
  }, [bridge]);

  const completedRuns = Object.values(runs)
    .filter((run) => run.report && run.report.deliverables.length > 0)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  const verdictRuns = Object.values(runs).filter(
    (run) => run.verdicts.length > 0,
  );

  const hasKnowledge = completedRuns.length > 0 || verdictRuns.length > 0;

  return (
    <section className="view-panel">
      <header className="view-heading">
        <h1>지식 & 근거</h1>
        <span>연결된 업무 기억과 완료된 산출물·검증 근거를 모아 봅니다.</span>
      </header>

      <div className="settings-section">
        <h2>
          <FolderOpen size={13} /> 연결된 업무 기억
        </h2>
        {!bridge ? (
          <p className="settings-note">
            브라우저 데모에서는 업무 기억 폴더를 연결할 수 없습니다. Electron
            앱의 설정에서 폴더를 연결하세요.
          </p>
        ) : memory?.folderPath ? (
          <p className="settings-note">
            {memory.folderPath} · {memory.eventCount.toLocaleString()}건 학습됨
            {memory.lastScannedAt
              ? ` · ${new Date(memory.lastScannedAt).toLocaleString("ko-KR")} 스캔`
              : ""}
          </p>
        ) : (
          <p className="settings-note">
            아직 연결된 폴더가 없습니다. 설정 → 업무 기록 폴더 연결에서 추가하면
            명령 맥락에 자동 포함됩니다.
          </p>
        )}
      </div>

      {!hasKnowledge ? (
        <div className="view-panel decision-empty">
          <BrainCircuit size={34} strokeWidth={1.4} />
          <h1>아직 축적된 지식이 없습니다</h1>
          <p>업무를 실행하면 산출물과 검증 근거가 여기에 정리됩니다.</p>
        </div>
      ) : null}

      {completedRuns.map((run) => (
        <div className="settings-section" key={run.runId}>
          <h2>{run.command}</h2>
          {run.report?.deliverables.map((deliverable) => (
            <article className="knowledge-card" key={deliverable.unitId}>
              <strong>{deliverable.title}</strong>
              <p>{snippet(deliverable.deliverable)}</p>
            </article>
          ))}
          {run.verdicts.length > 0 ? (
            <div className="verdict-strip">
              {run.verdicts.map((verdict, index) => (
                <span
                  className={verdict.verdict === "approve" ? "ok" : "warn"}
                  key={`${verdict.persona}-${index}`}
                >
                  <ShieldCheck size={11} /> {verdict.persona} {verdict.score}점
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </section>
  );
}
