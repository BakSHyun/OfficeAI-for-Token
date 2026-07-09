import { Lock } from "lucide-react";
import { missingRolesForPlan } from "../../shared/entitlement";
import { labelExecutor } from "../../shared/role-labels";
import type { RunState } from "../state/engine-store";
import { useEntitlement } from "../state/use-entitlement";

type EmployeeGateBannerProps = {
  run?: RunState;
  onOpenMarket: () => void;
};

export function EmployeeGateBanner({ run, onOpenMarket }: EmployeeGateBannerProps) {
  const entitlement = useEntitlement();
  if (!run?.plan) return null;

  const missing = missingRolesForPlan(run.plan, entitlement.ownedSkus);
  if (missing.length === 0) return null;

  return (
    <div className="employee-gate-banner" role="status">
      <Lock size={14} aria-hidden />
      <p>
        이 업무는{" "}
        {missing.map((role) => labelExecutor(role)).join(", ")}(구매 필요)에
        최적화됩니다.
      </p>
      <button className="panel-btn" onClick={onOpenMarket} type="button">
        직원 마켓
      </button>
    </div>
  );
}
