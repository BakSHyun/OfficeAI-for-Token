import { create } from "zustand";
import type {
  ApprovalRequest,
  BudgetScopeState,
  CriticVerdict,
  DispatchPlan,
  NodeDescriptor,
  RunEvent,
  RunReport,
} from "./bridge-types";

export type NodeStatus =
  | "spawned"
  | "working"
  | "done"
  | "failed"
  | "blocked";

export type LiveNode = {
  descriptor: NodeDescriptor;
  status: NodeStatus;
  detail: string;
  runId: string;
  usedTokens: number;
  updatedAt: string;
};

export type ActivityEntry = {
  id: string;
  at: string;
  actor: string;
  message: string;
  kind: "info" | "success" | "warning" | "error" | "approval";
};

export type RunState = {
  runId: string;
  command: string;
  status: "running" | "completed" | "failed" | "cancelled";
  plan?: DispatchPlan;
  report?: RunReport;
  verdicts: CriticVerdict[];
  startedAt: string;
};

type EngineState = {
  connected: boolean;
  runs: Record<string, RunState>;
  activeRunId: string | null;
  nodes: Record<string, LiveNode>;
  activities: ActivityEntry[];
  approvals: ApprovalRequest[];
  budget: BudgetScopeState[];
  usage: { inputTokens: number; outputTokens: number; costUsd: number };
  applyEvent(event: RunEvent): void;
  setConnected(connected: boolean): void;
  setApprovals(approvals: ApprovalRequest[]): void;
  removeApproval(requestId: string): void;
  selectRun(runId: string | null): void;
  reset(): void;
};

const MAX_ACTIVITIES = 60;

let activitySequence = 0;
function activity(
  at: string,
  actor: string,
  message: string,
  kind: ActivityEntry["kind"] = "info",
): ActivityEntry {
  activitySequence += 1;
  return { id: `${Date.now()}-${activitySequence}`, at, actor, message, kind };
}

function shortNodeName(nodeId: string, nodes: Record<string, LiveNode>) {
  return nodes[nodeId]?.descriptor.title ?? nodeId.split(":")[0];
}

export const useEngineStore = create<EngineState>((set, get) => ({
  connected: false,
  runs: {},
  activeRunId: null,
  nodes: {},
  activities: [],
  approvals: [],
  budget: [],
  usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },

  setConnected: (connected) => set({ connected }),
  setApprovals: (approvals) => set({ approvals }),
  removeApproval: (requestId) =>
    set((state) => ({
      approvals: state.approvals.filter((request) => request.id !== requestId),
    })),
  selectRun: (runId) => set({ activeRunId: runId }),
  reset: () =>
    set({
      runs: {},
      activeRunId: null,
      nodes: {},
      activities: [],
      approvals: [],
      budget: [],
    }),

  applyEvent: (event) => {
    const state = get();
    const push = (entry: ActivityEntry) =>
      [entry, ...state.activities].slice(0, MAX_ACTIVITIES);

    switch (event.type) {
      case "run:started":
        set({
          runs: {
            ...state.runs,
            [event.runId]: {
              runId: event.runId,
              command: event.command,
              status: "running",
              verdicts: [],
              startedAt: event.at,
            },
          },
          activeRunId: event.runId,
          activities: push(
            activity(event.at, "총괄냥", `"${event.command}" 접수`, "info"),
          ),
        });
        break;

      case "run:planned": {
        const run = state.runs[event.runId];
        if (!run) break;
        set({
          runs: {
            ...state.runs,
            [event.runId]: { ...run, plan: event.plan },
          },
          activities: push(
            activity(
              event.at,
              "분배냥",
              `${event.plan.units.length}개 작업으로 분해 (예상 $${event.plan.estimatedCostUsd.toFixed(4)})`,
              "info",
            ),
          ),
        });
        break;
      }

      case "node:spawned":
        set({
          nodes: {
            ...state.nodes,
            [event.node.id]: {
              descriptor: event.node,
              status: "spawned",
              detail: "",
              runId: event.runId,
              usedTokens: 0,
              updatedAt: event.at,
            },
          },
        });
        break;

      case "node:working": {
        const node = state.nodes[event.nodeId];
        set({
          nodes: node
            ? {
                ...state.nodes,
                [event.nodeId]: {
                  ...node,
                  status: "working",
                  detail: event.detail,
                  updatedAt: event.at,
                },
              }
            : state.nodes,
          activities: push(
            activity(
              event.at,
              shortNodeName(event.nodeId, state.nodes),
              event.detail,
              "info",
            ),
          ),
        });
        break;
      }

      case "node:done": {
        const node = state.nodes[event.nodeId];
        set({
          nodes: node
            ? {
                ...state.nodes,
                [event.nodeId]: {
                  ...node,
                  status: "done",
                  detail: event.summary,
                  updatedAt: event.at,
                },
              }
            : state.nodes,
          activities: push(
            activity(
              event.at,
              shortNodeName(event.nodeId, state.nodes),
              event.summary,
              "success",
            ),
          ),
        });
        break;
      }

      case "node:failed": {
        const node = state.nodes[event.nodeId];
        set({
          nodes: node
            ? {
                ...state.nodes,
                [event.nodeId]: {
                  ...node,
                  status: "failed",
                  detail: event.error,
                  updatedAt: event.at,
                },
              }
            : state.nodes,
          activities: push(
            activity(
              event.at,
              shortNodeName(event.nodeId, state.nodes),
              event.error,
              "error",
            ),
          ),
        });
        break;
      }

      case "node:blocked": {
        const node = state.nodes[event.nodeId];
        set({
          nodes: node
            ? {
                ...state.nodes,
                [event.nodeId]: {
                  ...node,
                  status: "blocked",
                  detail: event.reason,
                  updatedAt: event.at,
                },
              }
            : state.nodes,
          activities: push(
            activity(
              event.at,
              shortNodeName(event.nodeId, state.nodes),
              event.reason,
              "warning",
            ),
          ),
        });
        break;
      }

      case "critic:verdict": {
        const run = state.runs[event.runId];
        set({
          runs: run
            ? {
                ...state.runs,
                [event.runId]: {
                  ...run,
                  verdicts: [...run.verdicts, event.verdict],
                },
              }
            : state.runs,
          activities: push(
            activity(
              event.at,
              shortNodeName(event.nodeId, state.nodes),
              `${event.verdict.verdict === "approve" ? "승인" : "반려"} (${event.verdict.score}점)${
                event.verdict.issues[0] ? ` — ${event.verdict.issues[0]}` : ""
              }`,
              event.verdict.verdict === "approve" ? "success" : "warning",
            ),
          ),
        });
        break;
      }

      case "token:used": {
        const node = state.nodes[event.nodeId];
        set({
          usage: {
            inputTokens: state.usage.inputTokens + event.usage.inputTokens,
            outputTokens: state.usage.outputTokens + event.usage.outputTokens,
            costUsd: state.usage.costUsd + event.usage.costUsd,
          },
          nodes: node
            ? {
                ...state.nodes,
                [event.nodeId]: {
                  ...node,
                  usedTokens:
                    node.usedTokens +
                    event.usage.inputTokens +
                    event.usage.outputTokens,
                },
              }
            : state.nodes,
        });
        break;
      }

      case "budget:warning":
      case "budget:exceeded": {
        const next = state.budget.filter(
          (scope) =>
            !(scope.scope === event.state.scope && scope.key === event.state.key),
        );
        next.push(event.state);
        set({
          budget: next,
          activities: push(
            activity(
              event.at,
              "예산 관리",
              event.type === "budget:warning"
                ? `${event.state.scope} 예산 80% 도달`
                : `${event.state.scope} 예산 초과 (${event.action})`,
              "warning",
            ),
          ),
        });
        break;
      }

      case "approval:requested":
        set({
          approvals: [...state.approvals, event.request],
          activities: push(
            activity(event.at, "승인 요청", event.request.reason, "approval"),
          ),
        });
        break;

      case "approval:resolved":
        set({
          approvals: state.approvals.filter(
            (request) => request.id !== event.requestId,
          ),
          activities: push(
            activity(
              event.at,
              "Owner",
              event.approved ? "승인함" : "반려함",
              event.approved ? "success" : "warning",
            ),
          ),
        });
        break;

      case "run:completed": {
        const run = state.runs[event.runId];
        set({
          runs: run
            ? {
                ...state.runs,
                [event.runId]: {
                  ...run,
                  status: event.report.status === "completed"
                    ? "completed"
                    : event.report.status === "cancelled"
                      ? "cancelled"
                      : "failed",
                  report: event.report,
                },
              }
            : state.runs,
          activities: push(
            activity(event.at, "총괄냥", event.report.summary, "success"),
          ),
        });
        break;
      }

      case "run:failed": {
        const run = state.runs[event.runId];
        set({
          runs: run
            ? {
                ...state.runs,
                [event.runId]: { ...run, status: "failed" },
              }
            : state.runs,
          activities: push(activity(event.at, "총괄냥", event.error, "error")),
        });
        break;
      }
    }
  },
}));
