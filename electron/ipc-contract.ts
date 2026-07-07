/**
 * Renderer <-> Main IPC 계약.
 * 채널 이름과 페이로드 타입의 단일 출처. 양쪽 모두 이 파일만 import 한다.
 * 이 파일을 바꾸면 electron/main.ts, electron/preload.ts,
 * src/state/engine-client.ts 세 곳이 함께 바뀌어야 한다.
 */
import type {
  ApprovalRequest,
  RunEvent,
  RunReport,
} from "../core/src/orchestration/contracts";
import type { ProviderConfig } from "../core/src/providers/contracts";

export const IPC = {
  submitCommand: "engine:submit",
  cancelRun: "engine:cancel",
  resolveApproval: "engine:resolve-approval",
  pendingApprovals: "engine:pending-approvals",
  recentRuns: "engine:recent-runs",
  runEvents: "engine:run-events",
  usageTotals: "engine:usage-totals",
  getSettings: "settings:get",
  saveSettings: "settings:save",
  /** main -> renderer push */
  engineEvent: "engine:event",
} as const;

export type SubmitResult = { runId: string };

export type SettingsPayload = {
  providers: ProviderConfig;
  /** provider id -> 키 존재 여부 (실제 키는 renderer로 보내지 않는다) */
  apiKeyPresence: Record<string, boolean>;
};

export type SaveSettingsPayload = {
  providers?: Partial<ProviderConfig>;
  /** provider id -> 새 API 키 (safeStorage로 암호화 저장) */
  apiKeys?: Record<string, string>;
};

export type RecentRun = {
  runId: string;
  command: string;
  status: string;
  summary: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  startedAt: string;
  finishedAt: string;
};

/** preload가 window.officeai로 노출하는 API 표면 */
export type OfficeAIBridge = {
  submitCommand(command: string): Promise<SubmitResult>;
  cancelRun(runId: string): Promise<void>;
  resolveApproval(
    requestId: string,
    approved: boolean,
    note?: string,
  ): Promise<boolean>;
  pendingApprovals(): Promise<ApprovalRequest[]>;
  recentRuns(limit?: number): Promise<RecentRun[]>;
  runEvents(runId: string): Promise<RunEvent[]>;
  usageTotals(): Promise<{
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  }>;
  getSettings(): Promise<SettingsPayload>;
  saveSettings(payload: SaveSettingsPayload): Promise<void>;
  onEvent(listener: (event: RunEvent) => void): () => void;
};

export type { ApprovalRequest, RunEvent, RunReport, ProviderConfig };
