import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { WorkEvent } from "./contracts";
import type { WorkProfile } from "./memory/work-profile";
import { createBudgetManager } from "./budget/budget-manager";
import type { BudgetConfig } from "./budget/budget-manager";
import { createApprovalGate } from "./orchestration/approval-gate";
import type { ApprovalGate } from "./orchestration/approval-gate";
import { createEventBus } from "./orchestration/event-bus";
import type { EventBus } from "./orchestration/event-bus";
import { createOrchestrator } from "./orchestration/orchestrator";
import type { Orchestrator } from "./orchestration/orchestrator";
import {
  createProviderRegistry,
  loadProviderConfig,
} from "./providers/registry";
import type { ProviderRegistry } from "./providers/registry";
import { createLedger, createMemoryLedger } from "./telemetry/ledger";
import type { Ledger } from "./telemetry/ledger";

export type Engine = {
  orchestrator: Orchestrator;
  bus: EventBus;
  gate: ApprovalGate;
  ledger: Ledger;
  registry: ProviderRegistry;
  close(): void;
};

export type EngineOptions = {
  workspaceRoot?: string;
  /** true면 모든 승인 요청을 자동 승인 (CLI --yes) */
  autoApprove?: boolean;
  /** true면 실행 전 계획 승인 요청 */
  confirmPlan?: boolean;
  budget?: Partial<BudgetConfig>;
  /** 티어 바인딩을 mock으로 강제 (오프라인 검증용) */
  forceMock?: boolean;
  /** 파일 설정 위에 덮어쓸 provider 설정 (Electron 설정 화면 등) */
  providerOverrides?: Partial<
    import("./providers/contracts").ProviderConfig
  >;
};

async function loadWorkEvents(officeaiDir: string): Promise<WorkEvent[]> {
  const path = join(officeaiDir, "work-events.jsonl");
  if (!existsSync(path)) return [];
  const lines = (await readFile(path, "utf8")).split(/\r?\n/);
  const events: WorkEvent[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line) as WorkEvent);
    } catch {
      // 손상된 줄은 건너뛴다
    }
  }
  return events;
}

async function loadWorkProfile(
  officeaiDir: string,
): Promise<WorkProfile | undefined> {
  const path = join(officeaiDir, "work-profile.json");
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(await readFile(path, "utf8")) as WorkProfile;
  } catch {
    return undefined;
  }
}

export async function createEngine(
  options: EngineOptions = {},
): Promise<Engine> {
  const root = options.workspaceRoot ?? process.cwd();
  const officeaiDir = join(root, ".officeai");

  let config = await loadProviderConfig(join(root, "config"));
  if (options.providerOverrides) {
    config = {
      ...config,
      ...options.providerOverrides,
      tiers: { ...config.tiers, ...options.providerOverrides.tiers },
      apiKeys: { ...config.apiKeys, ...options.providerOverrides.apiKeys },
      baseUrls: { ...config.baseUrls, ...options.providerOverrides.baseUrls },
    };
  }
  if (options.forceMock) {
    config = {
      ...config,
      tiers: Object.fromEntries(
        Object.entries(config.tiers).map(([tier, binding]) => [
          tier,
          { ...binding, provider: "mock" },
        ]),
      ) as typeof config.tiers,
    };
  }
  const registry = createProviderRegistry(config);
  const bus = createEventBus();
  // better-sqlite3 네이티브 바인딩이 없는 환경(Electron ABI 불일치 등)에서도
  // 엔진은 살아있어야 하므로 메모리 ledger로 폴백한다.
  let ledger: Ledger;
  try {
    ledger = createLedger(join(officeaiDir, "telemetry.db"));
  } catch (error) {
    console.warn(
      `[officeai] SQLite ledger를 열 수 없어 메모리 ledger로 대체합니다: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    ledger = createMemoryLedger();
  }
  ledger.attach(bus);

  const gate = createApprovalGate({
    emit: (event) => bus.emit(event),
    autoResolver: options.autoApprove
      ? () => ({ approved: true, note: "자동 승인" })
      : undefined,
  });
  const budget = createBudgetManager({
    config: options.budget,
    emit: (event) => bus.emit(event),
    initialGlobalUsed: ledger.todayTokens(),
  });

  const [workEvents, profile] = await Promise.all([
    loadWorkEvents(officeaiDir),
    loadWorkProfile(officeaiDir),
  ]);

  const orchestrator = createOrchestrator({
    registry,
    bus,
    gate,
    budget,
    workEvents,
    profile,
    confirmPlan: options.confirmPlan,
  });

  bus.subscribe((event) => {
    if (event.type === "run:completed") ledger.saveReport(event.report);
    if (event.type === "run:failed") {
      // run:failed 이후 report는 orchestrator.run 반환값에서 저장됨
    }
  });

  return {
    orchestrator,
    bus,
    gate,
    ledger,
    registry,
    close() {
      ledger.close();
    },
  };
}
