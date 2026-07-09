import { Download, RefreshCw } from "lucide-react";
import {
  formatUpdateBannerText,
  shouldShowUpdateBanner,
} from "../../electron/update-status";
import { useUpdateStatus } from "../state/use-update-status";

export function UpdateBanner() {
  const status = useUpdateStatus();

  if (!window.officeai || !shouldShowUpdateBanner(status)) return null;

  const ready = status.phase === "downloaded";

  return (
    <div className="update-banner" role="status">
      <div className="update-banner-copy">
        {ready ? (
          <RefreshCw size={14} strokeWidth={2} aria-hidden />
        ) : (
          <Download size={14} strokeWidth={2} aria-hidden />
        )}
        <p>{formatUpdateBannerText(status)}</p>
      </div>
      {ready ? (
        <button
          type="button"
          className="update-banner-action"
          onClick={() => void window.officeai?.installUpdate()}
        >
          재시작하여 업데이트
        </button>
      ) : null}
    </div>
  );
}
