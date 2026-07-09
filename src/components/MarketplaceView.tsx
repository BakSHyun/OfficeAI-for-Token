import { useEffect, useState } from "react";
import { KeyRound, ShoppingBag } from "lucide-react";
import { EMPLOYEE_CATALOG } from "../../shared/employee-catalog";
import { skuStatus, toggleActiveSku } from "../../shared/entitlement";
import { labelExecutor } from "../../shared/role-labels";
import type { EmployeeSku } from "../state/bridge-types";
import { useEntitlement } from "../state/use-entitlement";

function formatPriceKrw(price: number) {
  if (price === 0) return "기본 제공";
  return `₩${price.toLocaleString("ko-KR")}`;
}

function statusLabel(status: ReturnType<typeof skuStatus>) {
  if (status === "included") return "기본 제공";
  if (status === "owned") return "보유";
  return "미보유";
}

export function MarketplaceView() {
  const bridge = window.officeai;
  const entitlement = useEntitlement();
  const [catalog, setCatalog] = useState<EmployeeSku[]>(EMPLOYEE_CATALOG);
  const [licenseKey, setLicenseKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!bridge) return;
    void bridge.getEmployeeCatalog().then(setCatalog);
  }, [bridge]);

  async function handleActivateKey() {
    const trimmed = licenseKey.trim();
    if (!trimmed || !bridge) return;
    setBusy(true);
    setNote(null);
    try {
      const result = await bridge.activateLicense(trimmed);
      if (!result.ok) {
        setNote(result.error ?? "키 활성화에 실패했습니다.");
        return;
      }
      setLicenseKey("");
      setNote("직원 라이선스가 활성화되었습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(skuId: string, enabled: boolean) {
    if (!bridge) return;
    const next = toggleActiveSku(entitlement, skuId, enabled);
    await bridge.setActiveEmployees(next.activeSkus);
  }

  return (
    <section className="view-panel">
      <header className="view-heading">
        <h1>직원 마켓</h1>
        <span>직무별 AI 직원을 구매·팀에 배치합니다</span>
      </header>

      <div className="settings-section">
        <h2>
          <KeyRound size={13} /> 직원 라이선스 키
        </h2>
        <p className="settings-note">
          결제 후 발급받은 OAIV1 키를 입력하면 해당 직원이 잠금 해제됩니다.
        </p>
        <label className="settings-field">
          라이선스 키
          <input
            disabled={!bridge}
            onChange={(event) => setLicenseKey(event.target.value)}
            placeholder="OAIV1...."
            value={licenseKey}
          />
        </label>
        <div className="settings-footer settings-footer-inline">
          <button
            disabled={!bridge || busy}
            onClick={() => void handleActivateKey()}
            type="button"
          >
            {busy ? "확인 중…" : "키 활성화"}
          </button>
          {note ? <small>{note}</small> : null}
        </div>
      </div>

      <div className="market-grid">
        {catalog.map((sku) => {
          const status = skuStatus(sku.id, entitlement);
          const active = entitlement.activeSkus.includes(sku.id);
          return (
            <article className="market-card" key={sku.id}>
              <div className="market-card-head">
                <strong>{sku.displayName}</strong>
                <span className={`market-badge market-badge-${status}`}>
                  {statusLabel(status)}
                </span>
              </div>
              <p>{sku.summary}</p>
              <small>
                {labelExecutor(sku.role)}
                {sku.variant === "pro" ? " · Pro" : ""}
              </small>
              <div className="market-card-foot">
                <em>{formatPriceKrw(sku.priceKrw)}</em>
                {status === "owned" || status === "included" ? (
                  <button
                    className="panel-btn"
                    disabled={!bridge}
                    onClick={() => void handleToggle(sku.id, !active)}
                    type="button"
                  >
                    {active ? "팀에서 해제" : "팀에 배치"}
                  </button>
                ) : (
                  <span className="market-hint">
                    <ShoppingBag size={12} /> 키 입력으로 구매
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
