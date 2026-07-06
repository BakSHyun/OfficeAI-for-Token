import type { TaskEnvelope } from "../contracts";
import {
  exampleModelRegistry,
  routeModel,
} from "../routing/model-router";

const task: TaskEnvelope = {
  id: "demo-development-task",
  objective: "기존 결제 흐름을 분석하고 안전한 변경 계획을 작성한다.",
  category: "development",
  projectHints: ["gtsn-backend", "gtsn-admin"],
  risk: "medium",
  complexity: 0.68,
  expectedInputTokens: 12_000,
  expectedOutputTokens: 2_500,
  requiresTools: true,
  deterministicCheckAvailable: true,
  privacy: "cloud-allowed",
  attempt: 0,
};

const decision = routeModel(task, exampleModelRegistry);
console.log(
  JSON.stringify(
    {
      selected: decision.selected.id,
      reasons: decision.reasons,
      candidates: decision.eligible.map((candidate) => ({
        id: candidate.model.id,
        tier: candidate.model.tier,
        expectedCost: candidate.expectedCost,
        successProbability: candidate.successProbability,
      })),
      rejected: decision.rejected.map(({ model, reason }) => ({
        id: model.id,
        reason,
      })),
    },
    null,
    2,
  ),
);
