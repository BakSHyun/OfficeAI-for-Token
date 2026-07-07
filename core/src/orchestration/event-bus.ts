import type { RunEvent } from "./contracts";

export type EventListener = (event: RunEvent) => void;

export type EventBus = {
  emit(event: RunEvent): void;
  subscribe(listener: EventListener): () => void;
  history(runId?: string): RunEvent[];
};

export function createEventBus(options?: { historyLimit?: number }): EventBus {
  const listeners = new Set<EventListener>();
  const events: RunEvent[] = [];
  const historyLimit = options?.historyLimit ?? 5_000;

  return {
    emit(event) {
      events.push(event);
      if (events.length > historyLimit) {
        events.splice(0, events.length - historyLimit);
      }
      for (const listener of listeners) {
        try {
          listener(event);
        } catch {
          // 구독자 오류가 파이프라인을 중단시키지 않도록 격리
        }
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    history(runId) {
      if (!runId) return [...events];
      return events.filter((event) => "runId" in event && event.runId === runId);
    },
  };
}
