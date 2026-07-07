import { useEffect, useState } from "react";
import type { SavingsSummary } from "./bridge-types";
import { computeDemoSavings } from "./savings";
import { useEngineStore } from "./engine-store";

export function useSavings(runId?: string) {
  const usageRows = useEngineStore((state) => state.usageRows);
  const usage = useEngineStore((state) => state.usage);
  const [summary, setSummary] = useState<SavingsSummary | null>(null);

  useEffect(() => {
    const bridge = window.officeai;
    if (bridge) {
      void bridge.savingsSummary(runId).then(setSummary);
      return;
    }
    const rows = runId
      ? usageRows.filter((row) => row.runId === runId)
      : usageRows;
    setSummary(computeDemoSavings(rows));
  }, [runId, usageRows, usage.costUsd]);

  return summary;
}
