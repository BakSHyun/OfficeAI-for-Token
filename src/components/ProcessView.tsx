import { useMemo } from "react";
import { GitBranch } from "lucide-react";
import type { PlannedUnit } from "../state/bridge-types";
import type { LiveNode } from "../state/engine-store";
import type { RunState } from "../state/engine-store";

type ProcessViewProps = {
  run?: RunState;
  nodes: Record<string, LiveNode>;
};

type UnitView = {
  unit: PlannedUnit;
  level: number;
  status: "pending" | "working" | "done" | "failed" | "blocked";
  usedTokens: number;
  detail: string;
};

/** dependsOn 기반 위상 레벨 계산 (사이클은 dispatcher가 방지) */
function computeLevels(units: PlannedUnit[]): Map<string, number> {
  const levels = new Map<string, number>();
  const resolve = (id: string, seen: Set<string>): number => {
    const cached = levels.get(id);
    if (cached !== undefined) return cached;
    if (seen.has(id)) return 0;
    seen.add(id);
    const unit = units.find((candidate) => candidate.id === id);
    if (!unit || unit.dependsOn.length === 0) {
      levels.set(id, 0);
      return 0;
    }
    const level =
      1 +
      Math.max(...unit.dependsOn.map((dependency) => resolve(dependency, seen)));
    levels.set(id, level);
    return level;
  };
  for (const unit of units) resolve(unit.id, new Set());
  return levels;
}

export function ProcessView({ run, nodes }: ProcessViewProps) {
  const views = useMemo<UnitView[]>(() => {
    if (!run?.plan) return [];
    const levels = computeLevels(run.plan.units);
    return run.plan.units.map((unit) => {
      const liveNodes = Object.values(nodes).filter(
        (node) =>
          node.runId === run.runId &&
          node.descriptor.workUnitId === unit.id &&
          node.descriptor.kind === "executor",
      );
      const live = liveNodes[liveNodes.length - 1];
      const status =
        live?.status === "working" || live?.status === "spawned"
          ? "working"
          : live?.status === "done"
            ? "done"
            : live?.status === "failed"
              ? "failed"
              : live?.status === "blocked"
                ? "blocked"
                : "pending";
      const usedTokens = liveNodes.reduce(
        (total, node) => total + node.usedTokens,
        0,
      );
      return {
        unit,
        level: levels.get(unit.id) ?? 0,
        status,
        usedTokens,
        detail: live?.detail ?? "",
      };
    });
  }, [run, nodes]);

  if (!run?.plan) {
    return (
      <section className="view-panel decision-empty">
        <GitBranch size={34} strokeWidth={1.4} />
        <h1>진행 중인 프로세스가 없습니다</h1>
        <p>명령을 입력하면 작업 분해 DAG가 여기에 실시간으로 그려집니다.</p>
      </section>
    );
  }

  const maxLevel = Math.max(...views.map((view) => view.level));
  const columns: UnitView[][] = Array.from(
    { length: maxLevel + 1 },
    (_, level) => views.filter((view) => view.level === level),
  );

  return (
    <section className="view-panel">
      <header className="view-heading">
        <h1>업무 프로세스</h1>
        <span>
          {run.command} — {run.plan.strategy === "single-worker" ? "단일 작업" : "역할 분리"}
          , 예상 ${run.plan.estimatedCostUsd.toFixed(4)}
        </span>
      </header>
      <div className="dag-scroll">
        <div className="dag-grid">
          {columns.map((column, level) => (
            <div className="dag-column" key={level}>
              {column.map((view) => (
                <div
                  className={`dag-node status-${view.status}`}
                  key={view.unit.id}
                >
                  <div className="dag-node-head">
                    <strong>{view.unit.title}</strong>
                    <span className={`tier-badge tier-${view.unit.tier}`}>
                      {view.unit.tier}
                    </span>
                  </div>
                  <small>
                    {view.unit.role}
                    {view.unit.critics.length > 0
                      ? ` · 검토 ${view.unit.critics.length}명`
                      : ""}
                  </small>
                  <div className="dag-node-foot">
                    <em className={`dag-status ${view.status}`}>
                      {view.status === "working"
                        ? "실행 중"
                        : view.status === "done"
                          ? "완료"
                          : view.status === "failed"
                            ? "실패"
                            : view.status === "blocked"
                              ? "대기(결정 필요)"
                              : "대기"}
                    </em>
                    {view.usedTokens > 0 ? (
                      <span>{view.usedTokens.toLocaleString()} tok</span>
                    ) : null}
                  </div>
                  {view.unit.dependsOn.length > 0 ? (
                    <i className="dag-deps">← {view.unit.dependsOn.join(", ")}</i>
                  ) : null}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      {run.verdicts.length > 0 ? (
        <div className="verdict-strip">
          {run.verdicts.slice(-6).map((verdict, index) => (
            <span
              className={verdict.verdict === "approve" ? "ok" : "warn"}
              key={`${verdict.persona}-${index}`}
            >
              {verdict.persona} {verdict.score}점
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
