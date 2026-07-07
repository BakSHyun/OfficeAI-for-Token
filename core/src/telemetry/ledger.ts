import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import type { RunEvent, RunReport } from "../orchestration/contracts";
import type { TierBinding } from "../providers/contracts";
import type { EventBus } from "../orchestration/event-bus";
import {
  computeSavingsSummary,
  type SavingsSummary,
  type UsageCostRow,
} from "./savings";

export type LedgerRunRow = {
  runId: string;
  command: string;
  status: string;
  summary: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  startedAt: string;
  finishedAt: string;
};

export type Ledger = {
  /** Event Bus를 구독해 모든 이벤트/사용량을 기록 */
  attach(bus: EventBus): () => void;
  saveReport(report: RunReport): void;
  /** 앱 비정상 종료 시 status=running 인 run을 failed로 정리 */
  markInterruptedRuns(reason: string): number;
  todayTokens(): number;
  recentRuns(limit?: number): LedgerRunRow[];
  runEvents(runId: string): RunEvent[];
  totals(): { inputTokens: number; outputTokens: number; costUsd: number };
  savingsSummary(premium: TierBinding, runId?: string): SavingsSummary;
  close(): void;
};

/** SQLite를 쓸 수 없는 환경을 위한 메모리 폴백. 프로세스 종료 시 데이터는 사라진다. */
export function createMemoryLedger(): Ledger {
  const events: RunEvent[] = [];
  const runs = new Map<string, LedgerRunRow>();
  const usageRows: Array<UsageCostRow & { runId: string }> = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let costUsd = 0;

  function handleEvent(event: RunEvent) {
    events.push(event);
    if (event.type === "run:started") {
      runs.set(event.runId, {
        runId: event.runId,
        command: event.command,
        status: "running",
        summary: "",
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        startedAt: event.at,
        finishedAt: "",
      });
    }
    if (event.type === "token:used") {
      inputTokens += event.usage.inputTokens;
      outputTokens += event.usage.outputTokens;
      costUsd += event.usage.costUsd;
      usageRows.push({
        runId: event.runId,
        inputTokens: event.usage.inputTokens,
        outputTokens: event.usage.outputTokens,
        costUsd: event.usage.costUsd,
      });
    }
  }

  return {
    attach(bus) {
      return bus.subscribe(handleEvent);
    },
    saveReport(report) {
      runs.set(report.runId, {
        runId: report.runId,
        command: report.command,
        status: report.status,
        summary: report.summary,
        inputTokens: report.totalUsage.inputTokens,
        outputTokens: report.totalUsage.outputTokens,
        costUsd: report.totalUsage.costUsd,
        startedAt: report.startedAt,
        finishedAt: report.finishedAt,
      });
    },
    markInterruptedRuns(reason) {
      const at = new Date().toISOString();
      let count = 0;
      for (const [runId, row] of runs) {
        if (row.status !== "running") continue;
        runs.set(runId, {
          ...row,
          status: "failed",
          summary: reason,
          finishedAt: at,
        });
        events.push({ type: "run:failed", runId, error: reason, at });
        count += 1;
      }
      return count;
    },
    todayTokens() {
      return inputTokens + outputTokens;
    },
    recentRuns(limit = 20) {
      return [...runs.values()]
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .slice(0, limit);
    },
    runEvents(runId) {
      return events.filter(
        (event) => "runId" in event && event.runId === runId,
      );
    },
    totals() {
      return { inputTokens, outputTokens, costUsd };
    },
    savingsSummary(premium, runId) {
      const rows = runId
        ? usageRows.filter((row) => row.runId === runId)
        : usageRows;
      return computeSavingsSummary(rows, premium);
    },
    close() {},
  };
}

export function createLedger(databasePath: string): Ledger {
  mkdirSync(dirname(databasePath), { recursive: true });
  const database = new Database(databasePath);
  database.pragma("journal_mode = WAL");
  database.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      run_id TEXT PRIMARY KEY,
      command TEXT NOT NULL,
      status TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cost_usd REAL NOT NULL DEFAULT 0,
      started_at TEXT NOT NULL,
      finished_at TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_run ON events(run_id);
    CREATE TABLE IF NOT EXISTS usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      node_id TEXT NOT NULL,
      tier TEXT NOT NULL,
      model TEXT NOT NULL,
      provider TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      cost_usd REAL NOT NULL,
      at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_usage_at ON usage(at);
  `);

  const insertEvent = database.prepare(
    "INSERT INTO events (run_id, type, payload, at) VALUES (?, ?, ?, ?)",
  );
  const insertUsage = database.prepare(
    `INSERT INTO usage
      (run_id, node_id, tier, model, provider, input_tokens, output_tokens, cost_usd, at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const upsertRun = database.prepare(
    `INSERT INTO runs
      (run_id, command, status, summary, input_tokens, output_tokens, cost_usd, started_at, finished_at)
     VALUES (@runId, @command, @status, @summary, @inputTokens, @outputTokens, @costUsd, @startedAt, @finishedAt)
     ON CONFLICT(run_id) DO UPDATE SET
      status=@status, summary=@summary, input_tokens=@inputTokens,
      output_tokens=@outputTokens, cost_usd=@costUsd, finished_at=@finishedAt`,
  );
  const selectRunningRuns = database.prepare(
    `SELECT run_id AS runId, command, status, summary,
            input_tokens AS inputTokens, output_tokens AS outputTokens,
            cost_usd AS costUsd, started_at AS startedAt, finished_at AS finishedAt
     FROM runs WHERE status = 'running'`,
  );
  const markRunFailed = database.prepare(
    `UPDATE runs SET status = 'failed', summary = ?, finished_at = ? WHERE run_id = ?`,
  );

  function handleEvent(event: RunEvent) {
    const runId = "runId" in event ? event.runId : "unknown";
    insertEvent.run(runId, event.type, JSON.stringify(event), event.at);

    if (event.type === "run:started") {
      upsertRun.run({
        runId: event.runId,
        command: event.command,
        status: "running",
        summary: "",
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        startedAt: event.at,
        finishedAt: "",
      });
    }
    if (event.type === "token:used") {
      insertUsage.run(
        event.runId,
        event.nodeId,
        event.tier,
        event.model,
        event.provider,
        event.usage.inputTokens,
        event.usage.outputTokens,
        event.usage.costUsd,
        event.at,
      );
    }
  }

  const selectUsageRows = database.prepare(
    `SELECT input_tokens AS inputTokens, output_tokens AS outputTokens, cost_usd AS costUsd
     FROM usage WHERE (? IS NULL OR run_id = ?)`,
  );

  return {
    attach(bus) {
      return bus.subscribe(handleEvent);
    },
    saveReport(report) {
      upsertRun.run({
        runId: report.runId,
        command: report.command,
        status: report.status,
        summary: report.summary,
        inputTokens: report.totalUsage.inputTokens,
        outputTokens: report.totalUsage.outputTokens,
        costUsd: report.totalUsage.costUsd,
        startedAt: report.startedAt,
        finishedAt: report.finishedAt,
      });
    },
    markInterruptedRuns(reason) {
      const at = new Date().toISOString();
      const running = selectRunningRuns.all() as LedgerRunRow[];
      for (const row of running) {
        markRunFailed.run(reason, at, row.runId);
        const event: RunEvent = {
          type: "run:failed",
          runId: row.runId,
          error: reason,
          at,
        };
        insertEvent.run(row.runId, event.type, JSON.stringify(event), at);
      }
      return running.length;
    },
    todayTokens() {
      const today = new Date().toISOString().slice(0, 10);
      const row = database
        .prepare(
          `SELECT COALESCE(SUM(input_tokens + output_tokens), 0) AS total
           FROM usage WHERE at >= ?`,
        )
        .get(`${today}T00:00:00.000Z`) as { total: number };
      return row.total;
    },
    recentRuns(limit = 20) {
      const rows = database
        .prepare(
          `SELECT run_id AS runId, command, status, summary,
                  input_tokens AS inputTokens, output_tokens AS outputTokens,
                  cost_usd AS costUsd, started_at AS startedAt, finished_at AS finishedAt
           FROM runs ORDER BY started_at DESC LIMIT ?`,
        )
        .all(limit);
      return rows as LedgerRunRow[];
    },
    runEvents(runId) {
      const rows = database
        .prepare("SELECT payload FROM events WHERE run_id = ? ORDER BY id ASC")
        .all(runId) as Array<{ payload: string }>;
      return rows.map((row) => JSON.parse(row.payload) as RunEvent);
    },
    totals() {
      const row = database
        .prepare(
          `SELECT COALESCE(SUM(input_tokens),0) AS inputTokens,
                  COALESCE(SUM(output_tokens),0) AS outputTokens,
                  COALESCE(SUM(cost_usd),0) AS costUsd
           FROM usage`,
        )
        .get() as { inputTokens: number; outputTokens: number; costUsd: number };
      return row;
    },
    savingsSummary(premium, runId) {
      const rows = selectUsageRows.all(
        runId ?? null,
        runId ?? null,
      ) as UsageCostRow[];
      return computeSavingsSummary(rows, premium);
    },
    close() {
      database.close();
    },
  };
}
