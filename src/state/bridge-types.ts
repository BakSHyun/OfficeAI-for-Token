/**
 * Renderer가 사용하는 엔진 타입들.
 * core의 타입을 다시 선언하지 않고 electron/ipc-contract를 단일 출처로 쓴다.
 */
export type {
  ApprovalRequest,
  OfficeAIBridge,
  ProviderConfig,
  RecentRun,
  RunEvent,
  RunReport,
  SaveSettingsPayload,
  SettingsPayload,
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
