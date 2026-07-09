import { Users } from "lucide-react";
import { EMPLOYEE_CATALOG } from "../../shared/employee-catalog";
import { toggleActiveSku } from "../../shared/entitlement";
import { useEntitlement } from "../state/use-entitlement";

export function TeamRosterSection() {
  const bridge = window.officeai;
  const entitlement = useEntitlement();

  async function handleToggle(skuId: string, enabled: boolean) {
    if (!bridge) return;
    const next = toggleActiveSku(entitlement, skuId, enabled);
    await bridge.setActiveEmployees(next.activeSkus);
  }

  const owned = EMPLOYEE_CATALOG.filter((sku) =>
    entitlement.ownedSkus.includes(sku.id),
  );

  return (
    <div className="settings-section">
      <h2>
        <Users size={13} /> 내 팀 (활성 직원)
      </h2>
      <p className="settings-note">
        켜진 직원만 업무에 우선 배치됩니다. 미보유 직무는 기본 프롬프트로
        동작합니다.
      </p>
      <ul className="roster-list">
        {owned.map((sku) => {
          const active = entitlement.activeSkus.includes(sku.id);
          return (
            <li className="roster-item" key={sku.id}>
              <div>
                <strong>{sku.displayName}</strong>
                <span>{sku.summary}</span>
              </div>
              <button
                className={active ? "panel-btn roster-on" : "panel-btn"}
                disabled={!bridge}
                onClick={() => void handleToggle(sku.id, !active)}
                type="button"
              >
                {active ? "ON" : "OFF"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
