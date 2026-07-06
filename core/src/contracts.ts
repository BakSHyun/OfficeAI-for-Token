export type SourceKind =
  | "markdown"
  | "cursor-plan"
  | "cursor-transcript"
  | "cursor-workspace"
  | "git-status"
  | "git-commit";

export type WorkCategory =
  | "planning"
  | "development"
  | "pm"
  | "research"
  | "operations"
  | "mixed";

export type RiskLevel = "low" | "medium" | "high";

export type Sensitivity = "public" | "internal" | "restricted";

export type WorkEvent = {
  id: string;
  kind: SourceKind;
  project: string;
  occurredAt: string;
  title: string;
  summary: string;
  sourceRef: string;
  sourceHash: string;
  confidence: number;
  sensitivity: Sensitivity;
  tags: string[];
  metadata?: Record<string, string | number | boolean>;
};

export type ContextItem = {
  event: WorkEvent;
  score: number;
  estimatedTokens: number;
  reasons: string[];
  components: {
    lexical: number;
    recency: number;
    confidence: number;
    source: number;
  };
};

export type ContextPack = {
  query: string;
  tokenBudget: number;
  estimatedTokens: number;
  items: ContextItem[];
  citations: Array<{
    id: string;
    sourceRef: string;
    sourceHash: string;
  }>;
};

export type TaskEnvelope = {
  id: string;
  objective: string;
  category: WorkCategory;
  projectHints: string[];
  risk: RiskLevel;
  complexity: number;
  expectedInputTokens: number;
  expectedOutputTokens: number;
  requiresTools: boolean;
  deterministicCheckAvailable: boolean;
  privacy: "local-only" | "cloud-allowed";
  attempt: number;
};

export type ModelTier = "local" | "economy" | "standard" | "premium";

export type ModelProfile = {
  id: string;
  tier: ModelTier;
  local: boolean;
  inputCostPerMillion: number;
  outputCostPerMillion: number;
  latencyScore: number;
  capabilities: {
    reasoning: number;
    coding: number;
    longContext: number;
    toolUse: number;
    verification: number;
  };
};

export type RoutingDecision = {
  selected: ModelProfile;
  eligible: Array<{
    model: ModelProfile;
    expectedCost: number;
    successProbability: number;
  }>;
  rejected: Array<{ model: ModelProfile; reason: string }>;
  reasons: string[];
};

export type WorkerRole =
  | "context-curator"
  | "planner"
  | "researcher"
  | "developer"
  | "pm"
  | "operator"
  | "verifier"
  | "skeptic"
  | "reporter";

export type WorkUnit = {
  id: string;
  title: string;
  role: WorkerRole;
  dependsOn: string[];
  expectedOutput: string;
  tokenBudget: number;
  risk: RiskLevel;
  requiresApproval: boolean;
  verification: string[];
};

export type WorkPlan = {
  task: TaskEnvelope;
  strategy: "single-worker" | "role-separated";
  contextBudget: number;
  workUnits: WorkUnit[];
  approvalReasons: string[];
};
