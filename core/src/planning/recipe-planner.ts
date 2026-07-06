import type {
  RiskLevel,
  TaskEnvelope,
  WorkerRole,
  WorkPlan,
  WorkUnit,
} from "../contracts";

const contextBudgetByCategory: Record<TaskEnvelope["category"], number> = {
  planning: 12_000,
  development: 18_000,
  pm: 10_000,
  research: 14_000,
  operations: 12_000,
  mixed: 18_000,
};

function specialistRole(task: TaskEnvelope): WorkerRole {
  switch (task.category) {
    case "development":
      return "developer";
    case "pm":
      return "pm";
    case "operations":
      return "operator";
    case "research":
      return "researcher";
    case "planning":
    case "mixed":
      return "planner";
  }
}

function unit(
  id: string,
  title: string,
  role: WorkerRole,
  dependsOn: string[],
  tokenBudget: number,
  risk: RiskLevel,
  verification: string[],
  requiresApproval = false,
): WorkUnit {
  return {
    id,
    title,
    role,
    dependsOn,
    expectedOutput: `${title} 구조화 결과`,
    tokenBudget,
    risk,
    requiresApproval,
    verification,
  };
}

export function planWork(task: TaskEnvelope): WorkPlan {
  const simple =
    task.risk === "low" &&
    task.complexity < 0.34 &&
    task.projectHints.length <= 1;
  const contextBudget = Math.round(
    contextBudgetByCategory[task.category] *
      Math.max(0.45, task.complexity),
  );
  const approvalReasons: string[] = [];

  if (task.risk === "high") {
    approvalReasons.push("고위험 외부 상태 변경 가능성");
    approvalReasons.push("명시적 승인 대상 동작 포함");
  }

  if (simple) {
    const execute = unit(
      "execute",
      "업무 실행",
      specialistRole(task),
      [],
      Math.max(1_200, task.expectedOutputTokens),
      task.risk,
      task.deterministicCheckAvailable
        ? ["output-schema", "acceptance-criteria"]
        : ["source-coverage"],
    );
    const report = unit(
      "report",
      "결과 보고",
      "reporter",
      ["execute"],
      700,
      "low",
      ["evidence-links"],
    );

    return {
      task,
      strategy: "single-worker",
      contextBudget,
      workUnits: [execute, report],
      approvalReasons,
    };
  }

  const contextUnit = unit(
    "context",
    "관련 업무 맥락 컴파일",
    "context-curator",
    [],
    contextBudget,
    "low",
    ["token-budget", "source-hash", "recency-conflict"],
  );
  const planningOnly =
    task.risk === "low" &&
    ["planning", "research", "pm", "mixed"].includes(task.category);
  const planUnit = unit(
    "plan",
    "완료 기준과 작업 DAG 작성",
    "planner",
    ["context"],
    Math.round(1_500 + task.complexity * 2_000),
    task.risk,
    ["schema", "dependency-cycle", "acceptance-criteria"],
  );
  const executeUnit = unit(
    "execute",
    planningOnly ? "기획 산출물 작성" : "전문 업무 실행",
    specialistRole(task),
    planningOnly ? ["context"] : ["plan"],
    Math.round(2_000 + task.complexity * 5_000),
    task.risk,
    task.deterministicCheckAvailable
      ? ["lint", "typecheck", "tests", "scope-check"]
      : ["source-coverage", "claim-citations"],
  );
  const workUnits: WorkUnit[] = [
    contextUnit,
    ...(planningOnly ? [] : [planUnit]),
    executeUnit,
    unit(
      "verify",
      "독립 검증",
      task.risk === "high" ? "skeptic" : "verifier",
      ["execute"],
      Math.round(1_200 + task.complexity * 2_500),
      task.risk,
      ["evidence-completeness", "counterexample", "policy-check"],
      approvalReasons.length > 0,
    ),
    unit(
      "report",
      "결정·증거·비용 보고",
      "reporter",
      ["verify"],
      900,
      "low",
      ["evidence-links", "residual-risk"],
    ),
  ];

  return {
    task,
    strategy: "role-separated",
    contextBudget,
    workUnits,
    approvalReasons,
  };
}
