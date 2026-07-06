import type {
  ModelProfile,
  RoutingDecision,
  TaskEnvelope,
} from "../contracts";

function requiredCapability(task: TaskEnvelope) {
  const coding = task.category === "development" ? 0.7 : 0.35;
  const reasoning =
    task.category === "planning" || task.category === "mixed"
      ? 0.55 + task.complexity * 0.25
      : 0.35 + task.complexity * 0.25;
  const toolUse = task.requiresTools ? 0.65 : 0.2;
  const verification = task.risk === "high" ? 0.8 : 0.4;
  const longContext =
    task.expectedInputTokens > 32_000
      ? 0.8
      : task.expectedInputTokens > 12_000
        ? 0.6
        : 0.25;

  return { coding, reasoning, toolUse, verification, longContext };
}

function successProbability(task: TaskEnvelope, model: ModelProfile) {
  const required = requiredCapability(task);
  const dimensions = Object.keys(required) as Array<keyof typeof required>;
  const deficits = dimensions.map((key) =>
    Math.max(0, required[key] - model.capabilities[key]),
  );
  const averageDeficit =
    deficits.reduce((sum, value) => sum + value, 0) / deficits.length;
  const retryPenalty = Math.min(0.22, task.attempt * 0.09);
  return Math.max(
    0.05,
    Math.min(0.99, 0.94 - averageDeficit * 1.7 - retryPenalty),
  );
}

function callCost(task: TaskEnvelope, model: ModelProfile) {
  return (
    (task.expectedInputTokens / 1_000_000) * model.inputCostPerMillion +
    (task.expectedOutputTokens / 1_000_000) * model.outputCostPerMillion
  );
}

function successFloor(task: TaskEnvelope) {
  const base =
    task.risk === "high" ? 0.84 : task.risk === "medium" ? 0.76 : 0.7;
  const verificationPenalty = task.deterministicCheckAvailable ? 0 : 0.08;
  const complexityPenalty = task.complexity >= 0.7 ? 0.04 : 0;
  return Math.min(0.94, base + verificationPenalty + complexityPenalty);
}

export function routeModel(
  task: TaskEnvelope,
  models: ModelProfile[],
): RoutingDecision {
  const rejected: RoutingDecision["rejected"] = [];
  const candidates: RoutingDecision["eligible"] = [];

  for (const model of models) {
    if (task.privacy === "local-only" && !model.local) {
      rejected.push({ model, reason: "local-only 작업" });
      continue;
    }
    if (
      task.risk === "high" &&
      !task.deterministicCheckAvailable &&
      model.capabilities.verification < 0.85
    ) {
      rejected.push({
        model,
        reason: "고위험·비결정론적 작업의 독립 검증 역량 부족",
      });
      continue;
    }

    const probability = successProbability(task, model);
    const floor = successFloor(task);
    if (probability < floor) {
      rejected.push({
        model,
        reason: `예상 성공률 ${probability.toFixed(2)} < 최소 ${floor.toFixed(2)}`,
      });
      continue;
    }

    const baseCost = callCost(task, model);
    const failureImpact =
      task.risk === "high" ? 0.1 : task.risk === "medium" ? 0.02 : 0.001;
    const retryCost = (baseCost + failureImpact) * (1 - probability);
    const latencyPenalty = model.latencyScore * 0.0002;
    const riskPenalty =
      task.risk === "high"
        ? (1 - probability) * 0.03
        : task.risk === "medium"
          ? (1 - probability) * 0.01
          : 0;
    const expectedCost = baseCost + retryCost + latencyPenalty + riskPenalty;

    candidates.push({
      model,
      expectedCost,
      successProbability: probability,
    });
  }

  candidates.sort((a, b) => a.expectedCost - b.expectedCost);
  const winner = candidates[0];
  if (!winner) {
    throw new Error("정책을 충족하는 모델이 없습니다.");
  }

  return {
    selected: winner.model,
    eligible: candidates,
    rejected,
    reasons: [
      `예상 총비용 최소: ${winner.expectedCost.toFixed(6)}`,
      `예상 성공률: ${winner.successProbability.toFixed(2)}`,
      `위험도: ${task.risk}`,
      task.deterministicCheckAvailable
        ? "결정론적 검증 가능"
        : "독립 검증 필요",
    ],
  };
}

export const exampleModelRegistry: ModelProfile[] = [
  {
    id: "local-8b",
    tier: "local",
    local: true,
    inputCostPerMillion: 0,
    outputCostPerMillion: 0,
    latencyScore: 0.7,
    capabilities: {
      reasoning: 0.48,
      coding: 0.48,
      longContext: 0.35,
      toolUse: 0.35,
      verification: 0.38,
    },
  },
  {
    id: "cloud-economy",
    tier: "economy",
    local: false,
    inputCostPerMillion: 0.2,
    outputCostPerMillion: 0.8,
    latencyScore: 0.25,
    capabilities: {
      reasoning: 0.58,
      coding: 0.56,
      longContext: 0.68,
      toolUse: 0.62,
      verification: 0.52,
    },
  },
  {
    id: "cloud-standard",
    tier: "standard",
    local: false,
    inputCostPerMillion: 1.5,
    outputCostPerMillion: 6,
    latencyScore: 0.4,
    capabilities: {
      reasoning: 0.78,
      coding: 0.82,
      longContext: 0.82,
      toolUse: 0.82,
      verification: 0.74,
    },
  },
  {
    id: "cloud-premium",
    tier: "premium",
    local: false,
    inputCostPerMillion: 5,
    outputCostPerMillion: 25,
    latencyScore: 0.65,
    capabilities: {
      reasoning: 0.94,
      coding: 0.92,
      longContext: 0.94,
      toolUse: 0.9,
      verification: 0.94,
    },
  },
];
