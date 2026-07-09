import type { ModelTier, WorkerRole } from "../core/src/contracts";

export type EmployeeSkuId = string;

export type EmployeeSku = {
  id: EmployeeSkuId;
  role: WorkerRole;
  displayName: string;
  variant?: "base" | "pro";
  tierFloor?: ModelTier;
  priceKrw: number;
  includedInBase: boolean;
  summary: string;
  promptPackId?: string;
};

export type Entitlement = {
  ownedSkus: EmployeeSkuId[];
  activeSkus: EmployeeSkuId[];
};
