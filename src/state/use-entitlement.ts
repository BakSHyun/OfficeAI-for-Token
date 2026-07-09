import { useEffect, useState } from "react";
import { baseIncludedSkuIds, buildEntitlement } from "../../shared/entitlement";
import type { Entitlement } from "./bridge-types";

const demoEntitlement: Entitlement = buildEntitlement(
  baseIncludedSkuIds(),
  baseIncludedSkuIds(),
);

export function useEntitlement() {
  const [entitlement, setEntitlement] = useState<Entitlement>(demoEntitlement);

  useEffect(() => {
    const bridge = window.officeai;
    if (!bridge) {
      setEntitlement(demoEntitlement);
      return;
    }
    void bridge.getEntitlement().then(setEntitlement);
    return bridge.onEntitlementChanged(setEntitlement);
  }, []);

  return entitlement;
}
