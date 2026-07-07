import type {
  ModelProfile,
  ModelTier,
  TaskEnvelope,
  WorkUnit,
} from "../contracts";
import { routeModel } from "../routing/model-router";
import { planWork } from "../planning/recipe-planner";
import type { ProviderConfig } from "../providers/contracts";
import type { DispatchPlan, PlannedUnit } from "./contracts";
import { selectCritics } from "./roles";

/** 티어별 표준 역량 프리셋. 실제 비용은 provider 설정에서 가져온다. */
const tierCapabilities: Record<ModelTier, ModelProfile["capabilities"]> = {
  local: {
    reasoning: 0.5,
    coding: 0.5,
    longContext: 0.4,
    toolUse: 0.4,
    verification: 0.4,
  },
  economy: {
    reasoning: 0.6,
    coding: 0.58,
    longContext: 0.68,
    toolUse: 0.62,
    verification: 0.55,
  },
  standard: {
    reasoning: 0.8,
    coding: 0.82,
    longContext: 0.82,
    toolUse: 0.82,
    verification: 0.76,
  },
  premium: {
    reasoning: 0.94,
    coding: 0.92,
    longContext: 0.94,
    toolUse: 0.9,
    verification: 0.94,
  },
};

const tierLatency: Record<ModelTier, number> = {
  local: 0.7,
  economy: 0.25,
  standard: 0.4,
  premium: 0.65,
};

export function buildModelRegistry(config: ProviderConfig): ModelProfile[] {
  return (Object.keys(config.tiers) as ModelTier[]).map((tier) => {
    const binding = config.tiers[tier];
    return {
      id: `${binding.provider}:${binding.model}`,
      tier,
      local:
        binding.provider === "codex-cli" ||
        binding.provider === "cursor-agent-cli" ||
        tier === "local",
      inputCostPerMillion: binding.inputCostPerMillion,
      outputCostPerMillion: binding.outputCostPerMillion,
      latencyScore: tierLatency[tier],
      capabilities: tierCapabilities[tier],
    };
  });
}

function unitEnvelope(task: TaskEnvelope, unit: WorkUnit): TaskEnvelope {
  const roleComplexity =
    unit.role === "developer" || unit.role === "planner"
      ? task.complexity
      : Math.min(task.complexity, 0.45);
  return {
    ...task,
    id: `${task.id}:${unit.id}`,
    objective: unit.title,
    risk: unit.risk,
    complexity: roleComplexity,
    expectedInputTokens: Math.min(task.expectedInputTokens, unit.tokenBudget * 3),
    expectedOutputTokens: unit.tokenBudget,
    deterministicCheckAvailable:
      task.deterministicCheckAvailable && unit.role === "developer",
  };
}

/**
 * Dispatcher Node: WorkPlan의 각 유닛에 딱 필요한 AI 레벨(티어)과
 * Critic 조합을 배정한다. 규칙 + 기대비용 라우팅 기반이라 LLM 호출 없이
 * 0 토큰으로 동작한다.
 */
export function dispatch(
  task: TaskEnvelope,
  providerConfig: ProviderConfig,
): DispatchPlan {
  const plan = planWork(task);
  const registry = buildModelRegistry(providerConfig);

  const units: PlannedUnit[] = plan.workUnits.map((unit) => {
    const decision = routeModel(unitEnvelope(task, unit), registry);
    const tier = decision.selected.tier;
    return {
      ...unit,
      tier,
      model: providerConfig.tiers[tier].model,
      critics: selectCritics(unit.role, unit.risk),
    };
  });

  const estimatedTokens = units.reduce(
    (total, unit) => total + unit.tokenBudget * 2,
    task.expectedInputTokens,
  );
  const estimatedCostUsd = units.reduce((total, unit) => {
    const binding = providerConfig.tiers[unit.tier];
    return (
      total +
      (unit.tokenBudget / 1_000_000) *
        (binding.inputCostPerMillion + binding.outputCostPerMillion)
    );
  }, 0);

  return {
    task,
    strategy: plan.strategy,
    contextBudget: plan.contextBudget,
    units,
    approvalReasons: plan.approvalReasons,
    estimatedTokens,
    estimatedCostUsd,
  };
}

export function degradeTier(tier: ModelTier): ModelTier | null {
  const order: ModelTier[] = ["premium", "standard", "economy", "local"];
  const index = order.indexOf(tier);
  if (index < 0 || index === order.length - 1) return null;
  return order[index + 1];
}
