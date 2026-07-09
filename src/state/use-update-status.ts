import { useEffect, useState } from "react";
import type { UpdateStatus } from "./bridge-types";

const idleStatus: UpdateStatus = {
  phase: "idle",
  currentVersion: "0.0.0",
};

export function useUpdateStatus() {
  const [status, setStatus] = useState<UpdateStatus>(idleStatus);

  useEffect(() => {
    const bridge = window.officeai;
    if (!bridge) return;
    void bridge.getUpdateStatus().then(setStatus);
    return bridge.onUpdateStatusChanged(setStatus);
  }, []);

  return status;
}
