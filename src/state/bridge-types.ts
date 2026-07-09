/**
 * Renderer가 사용하는 엔진 타입들.
 * core의 타입을 다시 선언하지 않고 electron/ipc-contract를 단일 출처로 쓴다.
 */
export type {
  ApprovalRequest,
  BudgetSettings,
  ExportDeliverablePayload,
  ExportDeliverableResult,
  ExportDiagnosticResult,
  MemoryScanResult,
  MemoryStatus,
  NavigatePayload,
  NavigateView,
  OfficeAIBridge,
  ProviderConfig,
  RecentRun,
  RunEvent,
  RunReport,
  SaveSettingsPayload,
  SavingsSummary,
  ScheduledTask,
  SettingsPayload,
  LicenseStatus,
  ActivateLicenseResult,
  PrivacySettings,
  ActionProposal,
  ActionWorkspaceStatus,
  ExecuteActionResult,
  ProviderProbeResult,
  UpdateStatus,
  EmployeeSku,
  EmployeeSkuId,
  Entitlement,
} from "../../electron/ipc-contract";
export type {
  BudgetScopeState,
  CriticVerdict,
  DispatchPlan,
  LLMUsage,
  NodeDescriptor,
  PlannedUnit,
} from "../../core/src/orchestration/contracts";

declare global {
  interface Window {
    officeai?: import("../../electron/ipc-contract").OfficeAIBridge;
  }
}
