import { randomUUID } from "node:crypto";
import type { ApprovalRequest, RunEvent } from "./contracts";

export type ApprovalDecision = { approved: boolean; note?: string };

export type ApprovalGate = {
  /** 결정이 내려질 때까지 대기. UI/CLI가 resolve를 호출한다. */
  request(
    runId: string,
    kind: ApprovalRequest["kind"],
    reason: string,
    payload?: Record<string, unknown>,
  ): Promise<ApprovalDecision>;
  resolve(requestId: string, decision: ApprovalDecision): boolean;
  pending(): ApprovalRequest[];
};

/**
 * 승인 게이트. resolver를 주면 자동 정책(예: CLI --yes)으로 즉시 결정하고,
 * 없으면 외부(UI)에서 resolve()가 호출될 때까지 대기한다.
 */
export function createApprovalGate(options: {
  emit: (event: RunEvent) => void;
  autoResolver?: (request: ApprovalRequest) => ApprovalDecision | null;
}): ApprovalGate {
  const waiting = new Map<
    string,
    { request: ApprovalRequest; resolve: (decision: ApprovalDecision) => void }
  >();

  return {
    request(runId, kind, reason, payload = {}) {
      const request: ApprovalRequest = {
        id: randomUUID(),
        runId,
        kind,
        reason,
        payload,
        requestedAt: new Date().toISOString(),
      };

      const auto = options.autoResolver?.(request);
      options.emit({
        type: "approval:requested",
        runId,
        request,
        at: request.requestedAt,
      });
      if (auto) {
        options.emit({
          type: "approval:resolved",
          runId,
          requestId: request.id,
          approved: auto.approved,
          note: auto.note,
          at: new Date().toISOString(),
        });
        return Promise.resolve(auto);
      }

      return new Promise<ApprovalDecision>((resolve) => {
        waiting.set(request.id, {
          request,
          resolve: (decision) => {
            options.emit({
              type: "approval:resolved",
              runId,
              requestId: request.id,
              approved: decision.approved,
              note: decision.note,
              at: new Date().toISOString(),
            });
            resolve(decision);
          },
        });
      });
    },
    resolve(requestId, decision) {
      const entry = waiting.get(requestId);
      if (!entry) return false;
      waiting.delete(requestId);
      entry.resolve(decision);
      return true;
    },
    pending() {
      return [...waiting.values()].map((entry) => entry.request);
    },
  };
}
