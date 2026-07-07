import type {
  ModelTier,
  RiskLevel,
  TaskEnvelope,
  WorkerRole,
  WorkUnit,
} from "../contracts";

export type NodeKind = "orchestrator" | "dispatcher" | "executor" | "critic";

export type CriticPersona = "executive" | "user" | "cfo" | "cto";

export type NodeDescriptor = {
  id: string;
  kind: NodeKind;
  role: WorkerRole | "coordinator";
  persona?: CriticPersona;
  title: string;
  tier: ModelTier;
  workUnitId?: string;
};

export type LLMUsage = {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

export type PlannedUnit = WorkUnit & {
  tier: ModelTier;
  model: string;
  critics: CriticPersona[];
};

export type DispatchPlan = {
  task: TaskEnvelope;
  strategy: "single-worker" | "role-separated";
  contextBudget: number;
  units: PlannedUnit[];
  approvalReasons: string[];
  estimatedTokens: number;
  estimatedCostUsd: number;
};

export type CriticVerdict = {
  persona: CriticPersona;
  score: number;
  verdict: "approve" | "revise";
  issues: string[];
  mustFix: string[];
};

export type UnitOutput = {
  unitId: string;
  role: WorkerRole;
  summary: string;
  deliverable: string;
  evidence: string[];
  usage: LLMUsage;
  verdicts?: CriticVerdict[];
  attempts: number;
};

export type RunReport = {
  runId: string;
  command: string;
  status: "completed" | "failed" | "cancelled";
  summary: string;
  deliverables: Array<{ unitId: string; title: string; deliverable: string }>;
  verdicts: CriticVerdict[];
  totalUsage: LLMUsage;
  startedAt: string;
  finishedAt: string;
  error?: string;
};

export type ApprovalRequest = {
  id: string;
  runId: string;
  kind: "plan-confirm" | "budget-escalation" | "critic-rejection" | "side-effect";
  reason: string;
  payload: Record<string, unknown>;
  requestedAt: string;
};

export type BudgetScopeState = {
  scope: "global" | "run" | "unit";
  key: string;
  budgetTokens: number;
  usedTokens: number;
};

export type RunEvent =
  | { type: "run:started"; runId: string; command: string; at: string }
  | { type: "run:planned"; runId: string; plan: DispatchPlan; at: string }
  | { type: "node:spawned"; runId: string; node: NodeDescriptor; at: string }
  | {
      type: "node:working";
      runId: string;
      nodeId: string;
      detail: string;
      at: string;
    }
  | {
      type: "node:done";
      runId: string;
      nodeId: string;
      summary: string;
      usage: LLMUsage;
      at: string;
    }
  | {
      type: "node:failed";
      runId: string;
      nodeId: string;
      error: string;
      at: string;
    }
  | {
      type: "node:blocked";
      runId: string;
      nodeId: string;
      reason: string;
      at: string;
    }
  | {
      type: "critic:verdict";
      runId: string;
      nodeId: string;
      workUnitId: string;
      verdict: CriticVerdict;
      at: string;
    }
  | {
      type: "approval:requested";
      runId: string;
      request: ApprovalRequest;
      at: string;
    }
  | {
      type: "approval:resolved";
      runId: string;
      requestId: string;
      approved: boolean;
      note?: string;
      at: string;
    }
  | {
      type: "token:used";
      runId: string;
      nodeId: string;
      tier: ModelTier;
      model: string;
      provider: string;
      usage: LLMUsage;
      at: string;
    }
  | {
      type: "budget:warning";
      runId: string;
      state: BudgetScopeState;
      at: string;
    }
  | {
      type: "budget:exceeded";
      runId: string;
      state: BudgetScopeState;
      action: "degrade" | "escalate" | "block";
      at: string;
    }
  | { type: "run:completed"; runId: string; report: RunReport; at: string }
  | { type: "run:failed"; runId: string; error: string; at: string };

export type UnitRiskLevel = RiskLevel;
