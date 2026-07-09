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
import type { ActionProposal } from "../shared/action-blocks";
import type { EmployeeSku, EmployeeSkuId, Entitlement } from "../shared/employees";

export type { EmployeeSku, EmployeeSkuId, Entitlement };

export const IPC = {
  submitCommand: "engine:submit",
  cancelRun: "engine:cancel",
  resolveApproval: "engine:resolve-approval",
  pendingApprovals: "engine:pending-approvals",
  recentRuns: "engine:recent-runs",
  runEvents: "engine:run-events",
  usageTotals: "engine:usage-totals",
  savingsSummary: "engine:savings-summary",
  getSettings: "settings:get",
  saveSettings: "settings:save",
  exportDiagnostic: "diagnostic:export",
  exportDeliverable: "deliverable:export",
  getSchedules: "schedules:get",
  saveSchedules: "schedules:save",
  getMemoryStatus: "memory:status",
  connectMemoryFolder: "memory:connect",
  rescanMemory: "memory:rescan",
  getLicenseStatus: "license:get",
  activateLicense: "license:activate",
  getPrivacySettings: "privacy:get",
  savePrivacySettings: "privacy:save",
  executeAction: "actions:execute",
  getActionWorkspace: "actions:get-workspace",
  chooseActionWorkspace: "actions:choose-workspace",
  probeProviders: "providers:probe",
  getEmployeeCatalog: "employees:catalog",
  getEntitlement: "employees:entitlement",
  setActiveEmployees: "employees:set-active",
  updateGetStatus: "update:get-status",
  updateInstall: "update:install",
  /** main -> renderer push */
  engineEvent: "engine:event",
  navigateTo: "app:navigate-to",
  licenseStatusChanged: "license:status-changed",
  updateStatusChanged: "update:status-changed",
  entitlementChanged: "employees:changed",
} as const;

export type NavigateView =
  | "대시보드"
  | "업무 관리"
  | "에이전트"
  | "승인 대기"
  | "보고서"
  | "모델 라우팅"
  | "지식 & 근거"
  | "직원 마켓"
  | "설정";

export type NavigatePayload = { view: NavigateView; runId?: string };

export type BudgetSettings = {
  globalDailyTokens: number;
  krwPerUsd: number;
};

export const defaultBudgetSettings: BudgetSettings = {
  globalDailyTokens: 2_000_000,
  krwPerUsd: 1400,
};

export type SubmitResult = {
  runId: string;
  rejected?: boolean;
  rejectReason?: "paused" | "trial_exhausted";
};

export type SettingsPayload = {
  providers: ProviderConfig;
  /** provider id -> 키 존재 여부 (실제 키는 renderer로 보내지 않는다) */
  apiKeyPresence: Record<string, boolean>;
  budget: BudgetSettings;
};

export type SaveSettingsPayload = {
  providers?: Partial<ProviderConfig>;
  /** provider id -> 새 API 키 (safeStorage로 암호화 저장) */
  apiKeys?: Record<string, string>;
  budget?: BudgetSettings;
};

export type ExportDiagnosticResult = {
  saved: boolean;
  path?: string;
};

export type ExportDeliverablePayload = {
  title: string;
  content: string;
};

export type ExportDeliverableResult = {
  saved: boolean;
  path?: string;
};

export type SavingsSummary = {
  actualCostUsd: number;
  premiumEquivalentCostUsd: number;
  savedUsd: number;
  savedPercent: number;
};

export type ScheduledTask = {
  id: string;
  command: string;
  weekdays: number[];
  hour: number;
  minute: number;
  enabled: boolean;
  lastRunKey?: string;
};

export type MemoryStatus = {
  folderPath?: string;
  lastScannedAt?: string;
  eventCount: number;
};

export type MemoryScanResult = {
  connected: boolean;
  folderPath?: string;
  eventCount: number;
  lastScannedAt?: string;
  sourceCounts?: Record<string, number>;
};

export type LicenseStatus = {
  mode: "trial" | "licensed";
  email?: string;
  expiresAt?: string;
  edition?: string;
  trialApiRunsUsed: number;
  trialApiRunsLimit: number;
  trialApiRunsRemaining: number;
};

export type ActivateLicenseResult = {
  ok: boolean;
  error?: string;
  status?: LicenseStatus;
};

export type PrivacySettings = {
  crashReporting: boolean;
};

export type ActionWorkspaceStatus = {
  /** write-file/run-command가 실행되는 기준 폴더. 미설정이면 실행 전에 선택을 요구한다. */
  folderPath?: string;
};

export type ExecuteActionResult = {
  ok: boolean;
  /** 저장된 파일 경로 또는 명령 출력 요약 */
  detail?: string;
  error?: string;
};

export type ProviderProbeResult = {
  provider: string;
  ok: boolean;
  detail: string;
};

export type UpdateStatus = {
  phase:
    | "idle"
    | "checking"
    | "available"
    | "downloading"
    | "downloaded"
    | "error";
  currentVersion: string;
  availableVersion?: string;
  percent?: number;
  message?: string;
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
  savingsSummary(runId?: string): Promise<SavingsSummary>;
  getSettings(): Promise<SettingsPayload>;
  saveSettings(payload: SaveSettingsPayload): Promise<void>;
  exportDiagnostic(): Promise<ExportDiagnosticResult>;
  exportDeliverable(
    payload: ExportDeliverablePayload,
  ): Promise<ExportDeliverableResult>;
  getSchedules(): Promise<ScheduledTask[]>;
  saveSchedules(tasks: ScheduledTask[]): Promise<void>;
  getMemoryStatus(): Promise<MemoryStatus>;
  connectMemoryFolder(): Promise<MemoryScanResult>;
  rescanMemory(): Promise<MemoryScanResult>;
  getLicenseStatus(): Promise<LicenseStatus>;
  activateLicense(key: string): Promise<ActivateLicenseResult>;
  getPrivacySettings(): Promise<PrivacySettings>;
  savePrivacySettings(settings: PrivacySettings): Promise<void>;
  executeAction(action: ActionProposal): Promise<ExecuteActionResult>;
  getActionWorkspace(): Promise<ActionWorkspaceStatus>;
  chooseActionWorkspace(): Promise<ActionWorkspaceStatus>;
  probeProviders(): Promise<ProviderProbeResult[]>;
  getUpdateStatus(): Promise<UpdateStatus>;
  installUpdate(): Promise<void>;
  getEmployeeCatalog(): Promise<EmployeeSku[]>;
  getEntitlement(): Promise<Entitlement>;
  setActiveEmployees(activeSkus: EmployeeSkuId[]): Promise<Entitlement>;
  onEvent(listener: (event: RunEvent) => void): () => void;
  onNavigate(listener: (payload: NavigatePayload) => void): () => void;
  onLicenseStatusChanged(listener: (status: LicenseStatus) => void): () => void;
  onUpdateStatusChanged(listener: (status: UpdateStatus) => void): () => void;
  onEntitlementChanged(listener: (entitlement: Entitlement) => void): () => void;
};

export type { ApprovalRequest, RunEvent, RunReport, ProviderConfig };
export type { ActionProposal };
