import type { WorkerRole } from "../core/src/contracts";
import type { DispatchPlan } from "../core/src/orchestration/contracts";
import type { LicensePayload } from "./license-core";
import { EMPLOYEE_CATALOG, findEmployeeSku } from "./employee-catalog";
import type { EmployeeSkuId, Entitlement } from "./employees";

export function baseIncludedSkuIds(): EmployeeSkuId[] {
  return EMPLOYEE_CATALOG.filter((sku) => sku.includedInBase).map((sku) => sku.id);
}

export function ownedSkusFromPayloads(payloads: LicensePayload[]): EmployeeSkuId[] {
  const owned = new Set<EmployeeSkuId>(baseIncludedSkuIds());
  for (const payload of payloads) {
    for (const skuId of payload.employees ?? []) {
      if (findEmployeeSku(skuId)) owned.add(skuId);
    }
  }
  return [...owned];
}

export function normalizeActiveSkus(
  ownedSkus: EmployeeSkuId[],
  activeSkus: EmployeeSkuId[],
): EmployeeSkuId[] {
  const owned = new Set(ownedSkus);
  const normalized = activeSkus.filter((skuId) => owned.has(skuId));
  if (normalized.length > 0) return normalized;
  return [...ownedSkus];
}

export function buildEntitlement(
  ownedSkus: EmployeeSkuId[],
  activeSkus: EmployeeSkuId[],
): Entitlement {
  const owned = [...new Set(ownedSkus)];
  return {
    ownedSkus: owned,
    activeSkus: normalizeActiveSkus(owned, activeSkus),
  };
}

export function ownedRoles(ownedSkus: EmployeeSkuId[]): Set<WorkerRole> {
  const roles = new Set<WorkerRole>();
  for (const skuId of ownedSkus) {
    const sku = findEmployeeSku(skuId);
    if (sku) roles.add(sku.role);
  }
  return roles;
}

export function isRoleOwned(role: WorkerRole, ownedSkus: EmployeeSkuId[]) {
  return ownedRoles(ownedSkus).has(role);
}

export function missingRolesForPlan(
  plan: DispatchPlan,
  ownedSkus: EmployeeSkuId[],
): WorkerRole[] {
  const owned = ownedRoles(ownedSkus);
  const missing = new Set<WorkerRole>();
  for (const unit of plan.units) {
    if (!owned.has(unit.role)) missing.add(unit.role);
  }
  return [...missing];
}

export function skuStatus(
  skuId: EmployeeSkuId,
  entitlement: Entitlement,
): "included" | "owned" | "locked" {
  const sku = findEmployeeSku(skuId);
  if (!sku) return "locked";
  if (sku.includedInBase) return "included";
  return entitlement.ownedSkus.includes(skuId) ? "owned" : "locked";
}

export function toggleActiveSku(
  entitlement: Entitlement,
  skuId: EmployeeSkuId,
  enabled: boolean,
): Entitlement {
  if (!entitlement.ownedSkus.includes(skuId)) return entitlement;
  const active = new Set(entitlement.activeSkus);
  if (enabled) active.add(skuId);
  else active.delete(skuId);
  return buildEntitlement(entitlement.ownedSkus, [...active]);
}
