import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DispatchPlan } from "../src/orchestration/contracts";
import {
  buildEntitlement,
  isRoleOwned,
  missingRolesForPlan,
  ownedSkusFromPayloads,
  skuStatus,
  toggleActiveSku,
} from "../../shared/entitlement";

describe("entitlement (G16 M1)", () => {
  it("ownedSkusFromPayloads는 기본 직원과 라이선스 직원을 합친다", () => {
    const owned = ownedSkusFromPayloads([
      { v: 1, employees: ["developer", "pm"] },
    ]);
    assert.ok(owned.includes("planner"));
    assert.ok(owned.includes("developer"));
    assert.ok(owned.includes("pm"));
    assert.equal(owned.includes("researcher"), false);
  });

  it("isRoleOwned는 SKU role로 판정한다", () => {
    const entitlement = buildEntitlement(
      ["planner", "developer-pro"],
      ["planner", "developer-pro"],
    );
    assert.equal(isRoleOwned("developer", entitlement.ownedSkus), true);
    assert.equal(isRoleOwned("researcher", entitlement.ownedSkus), false);
  });

  it("missingRolesForPlan은 미보유 역할만 반환한다", () => {
    const plan = {
      units: [
        { role: "planner" },
        { role: "developer" },
        { role: "researcher" },
      ],
    } as DispatchPlan;
    const missing = missingRolesForPlan(
      plan,
      buildEntitlement(["planner", "reporter"], ["planner"]).ownedSkus,
    );
    assert.deepEqual(missing.sort(), ["developer", "researcher"].sort());
  });

  it("toggleActiveSku는 보유 SKU만 토글한다", () => {
    const base = buildEntitlement(["planner", "developer"], ["planner", "developer"]);
    const toggled = toggleActiveSku(base, "developer", false);
    assert.deepEqual(toggled.activeSkus, ["planner"]);
    const locked = toggleActiveSku(base, "researcher", true);
    assert.deepEqual(locked.activeSkus, base.activeSkus);
  });

  it("skuStatus는 included/owned/locked를 구분한다", () => {
    const entitlement = buildEntitlement(["planner", "developer"], ["planner"]);
    assert.equal(skuStatus("planner", entitlement), "included");
    assert.equal(skuStatus("developer", entitlement), "owned");
    assert.equal(skuStatus("researcher", entitlement), "locked");
  });
});
