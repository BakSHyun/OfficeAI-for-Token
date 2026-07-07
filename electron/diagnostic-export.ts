import { arch, platform, release } from "node:os";
import type { RunEvent } from "../core/src/orchestration/contracts";
import type { ProviderConfig } from "../core/src/providers/contracts";
import { redactSensitiveJson } from "../core/src/security/redaction";
import type { RecentRun } from "./ipc-contract";

export type DiagnosticBundle = {
  exportedAt: string;
  app: { name: string; version: string };
  system: { platform: string; release: string; arch: string };
  settings: {
    providers: ProviderConfig;
    apiKeyPresence: Record<string, boolean>;
  };
  usage: { inputTokens: number; outputTokens: number; costUsd: number };
  recentRuns: RecentRun[];
  events: Array<{
    runId: string;
    type: RunEvent["type"];
    at: string;
    payload: unknown;
  }>;
};

export function buildDiagnosticBundle(input: {
  appName: string;
  appVersion: string;
  providers: ProviderConfig;
  apiKeyPresence: Record<string, boolean>;
  usage: { inputTokens: number; outputTokens: number; costUsd: number };
  recentRuns: RecentRun[];
  runEvents: (runId: string) => RunEvent[];
  maxRuns?: number;
}): DiagnosticBundle {
  const maxRuns = input.maxRuns ?? 5;
  const runs = input.recentRuns.slice(0, maxRuns);
  const events: DiagnosticBundle["events"] = [];

  for (const run of runs) {
    for (const event of input.runEvents(run.runId)) {
      events.push({
        runId: run.runId,
        type: event.type,
        at: event.at,
        payload: redactSensitiveJson(event),
      });
    }
  }

  return redactSensitiveJson({
    exportedAt: new Date().toISOString(),
    app: { name: input.appName, version: input.appVersion },
    system: {
      platform: platform(),
      release: release(),
      arch: arch(),
    },
    settings: {
      providers: input.providers,
      apiKeyPresence: input.apiKeyPresence,
    },
    usage: input.usage,
    recentRuns: runs,
    events,
  }) as DiagnosticBundle;
}
