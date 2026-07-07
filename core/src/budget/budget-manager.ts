import type { BudgetScopeState, RunEvent } from "../orchestration/contracts";

export type BudgetConfig = {
  /** 전역(일 단위) 토큰 한도 */
  globalDailyTokens: number;
  /** 태스크(run) 기본 한도. Dispatcher 계획 예상치의 배수로 확장될 수 있음 */
  runDefaultTokens: number;
  /** WorkUnit 기본 한도 */
  unitDefaultTokens: number;
  /** 경고 발행 비율 */
  warnRatio: number;
};

export const defaultBudgetConfig: BudgetConfig = {
  globalDailyTokens: 2_000_000,
  runDefaultTokens: 120_000,
  unitDefaultTokens: 24_000,
  warnRatio: 0.8,
};

export type BudgetCheck =
  | { action: "ok"; remainingTokens: number }
  | { action: "degrade"; remainingTokens: number; reason: string }
  | { action: "block"; remainingTokens: number; reason: string };

export type BudgetManager = {
  openRun(runId: string, budgetTokens?: number): void;
  openUnit(runId: string, unitId: string, budgetTokens?: number): void;
  /** LLM 호출 전 게이트. degrade = 하위 티어 강등 권고, block = 에스컬레이션 필요 */
  check(runId: string, unitId: string, estimatedTokens: number): BudgetCheck;
  record(runId: string, unitId: string, usedTokens: number): void;
  /** 사용자 승인으로 run 예산 증액 */
  extendRun(runId: string, additionalTokens: number): void;
  snapshot(runId: string): BudgetScopeState[];
};

type Scope = { budget: number; used: number; warned: boolean };

export function createBudgetManager(options: {
  config?: Partial<BudgetConfig>;
  emit?: (event: RunEvent) => void;
  initialGlobalUsed?: number;
}): BudgetManager {
  const config = { ...defaultBudgetConfig, ...options.config };
  const emit = options.emit ?? (() => {});
  const global: Scope = {
    budget: config.globalDailyTokens,
    used: options.initialGlobalUsed ?? 0,
    warned: false,
  };
  const runs = new Map<string, Scope>();
  const units = new Map<string, Scope>();

  function unitKey(runId: string, unitId: string) {
    return `${runId}:${unitId}`;
  }

  function state(
    scope: "global" | "run" | "unit",
    key: string,
    value: Scope,
  ): BudgetScopeState {
    return {
      scope,
      key,
      budgetTokens: value.budget,
      usedTokens: value.used,
    };
  }

  function evaluate(
    runId: string,
    scope: "global" | "run" | "unit",
    key: string,
    value: Scope,
    estimated: number,
  ): BudgetCheck | null {
    const projected = value.used + estimated;
    const remaining = Math.max(0, value.budget - value.used);
    if (projected > value.budget) {
      // 유닛 초과는 강등으로 흡수 시도, run/global 초과는 사용자 결정 필요
      const action = scope === "unit" ? "degrade" : "block";
      emit({
        type: "budget:exceeded",
        runId,
        state: state(scope, key, value),
        action: action === "degrade" ? "degrade" : "escalate",
        at: new Date().toISOString(),
      });
      return {
        action,
        remainingTokens: remaining,
        reason: `${scope} 예산 초과 예상 (${projected.toLocaleString()} / ${value.budget.toLocaleString()} tokens)`,
      };
    }
    if (!value.warned && projected > value.budget * config.warnRatio) {
      value.warned = true;
      emit({
        type: "budget:warning",
        runId,
        state: state(scope, key, value),
        at: new Date().toISOString(),
      });
    }
    return null;
  }

  return {
    openRun(runId, budgetTokens) {
      runs.set(runId, {
        budget: budgetTokens ?? config.runDefaultTokens,
        used: 0,
        warned: false,
      });
    },
    openUnit(runId, unitId, budgetTokens) {
      units.set(unitKey(runId, unitId), {
        budget: budgetTokens ?? config.unitDefaultTokens,
        used: 0,
        warned: false,
      });
    },
    check(runId, unitId, estimatedTokens) {
      const run = runs.get(runId);
      const unit = units.get(unitKey(runId, unitId));

      const globalResult = evaluate(
        runId,
        "global",
        "today",
        global,
        estimatedTokens,
      );
      if (globalResult) return globalResult;
      if (run) {
        const runResult = evaluate(runId, "run", runId, run, estimatedTokens);
        if (runResult) return runResult;
      }
      if (unit) {
        const unitResult = evaluate(
          runId,
          "unit",
          unitId,
          unit,
          estimatedTokens,
        );
        if (unitResult) return unitResult;
      }
      const remaining = Math.min(
        global.budget - global.used,
        run ? run.budget - run.used : Number.POSITIVE_INFINITY,
        unit ? unit.budget - unit.used : Number.POSITIVE_INFINITY,
      );
      return { action: "ok", remainingTokens: Math.max(0, remaining) };
    },
    record(runId, unitId, usedTokens) {
      global.used += usedTokens;
      const run = runs.get(runId);
      if (run) run.used += usedTokens;
      const unit = units.get(unitKey(runId, unitId));
      if (unit) unit.used += usedTokens;
    },
    extendRun(runId, additionalTokens) {
      const run = runs.get(runId);
      if (run) {
        run.budget += additionalTokens;
        run.warned = false;
      }
    },
    snapshot(runId) {
      const result: BudgetScopeState[] = [state("global", "today", global)];
      const run = runs.get(runId);
      if (run) result.push(state("run", runId, run));
      for (const [key, value] of units) {
        if (key.startsWith(`${runId}:`)) {
          result.push(state("unit", key.slice(runId.length + 1), value));
        }
      }
      return result;
    },
  };
}
