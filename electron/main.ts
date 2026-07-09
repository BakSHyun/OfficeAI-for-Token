import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  BrowserWindow,
  app,
  dialog,
  ipcMain,
  safeStorage,
  shell,
} from "electron";
import { createEngine } from "../core/src/engine";
import type { Engine } from "../core/src/engine";
import type { ProviderConfig } from "../core/src/providers/contracts";
import {
  IPC,
  defaultBudgetSettings,
  type BudgetSettings,
  type ExportDeliverablePayload,
  type MemoryScanResult,
  type MemoryStatus,
  type PrivacySettings,
  type SaveSettingsPayload,
  type SavingsSummary,
  type SettingsPayload,
  type ActivateLicenseResult,
  type LicenseStatus,
  type ActionProposal,
  type ActionWorkspaceStatus,
  type ExecuteActionResult,
  type ProviderProbeResult,
  type UpdateStatus,
} from "./ipc-contract";
import {
  appendActionLog,
  executeRunCommand,
  executeWriteFile,
  loadActionWorkspace,
  saveActionWorkspace,
} from "./action-runner";
import {
  createAutoUpdateService,
  type AutoUpdateService,
} from "./auto-update";
import { createIdleUpdateStatus } from "./update-status";
import { probeUsedProviders } from "./provider-probe";
import {
  appendRunSummary,
  enrichCommandWithContext,
  loadRecentSummaries,
} from "./run-summaries";
import {
  loadProjectSummaryForCommand,
  loadWorkProfile,
  updateProjectSummaryAfterRun,
} from "./project-summaries";
import {
  memoryOutputDir,
  runMemoryScan,
  type MemorySettings,
} from "./memory-scan";
import { buildDiagnosticBundle } from "./diagnostic-export";
import {
  buildDeliverableMarkdown,
  suggestDeliverableFileName,
} from "./deliverable-export";
import {
  areCommandsPaused,
  createDesktopIntegration,
  markAppQuitting,
  type DesktopIntegration,
} from "./desktop-integration";
import {
  findDueSchedules,
  markSchedulesRan,
  normalizeScheduledTask,
  type ScheduledTask,
} from "./schedules";
import type { RunEvent } from "../core/src/orchestration/contracts";
import {
  planUsesPaidApi,
  verifyLicenseKey,
  TRIAL_API_RUN_LIMIT,
  resolveLicenseStatus,
  type LicenseState,
} from "../shared/license-crypto";
import { loadLicenseState, saveLicenseState } from "./license-store";
import { normalizeLicenseKeys } from "../shared/license-core";
import {
  getEmployeeCatalog,
  loadEntitlement,
  saveActiveSkus,
} from "./employee-service";
import { buildEntitlement } from "../shared/entitlement";
import type { EmployeeSkuId } from "../shared/employees";
import { initCrashReporting, captureMainException } from "./crash-reporting";
import {
  loadPrivacySettings,
  savePrivacySettings,
} from "./privacy-store";

let engine: Engine | null = null;
let mainWindow: BrowserWindow | null = null;
let autoUpdate: AutoUpdateService | null = null;
let desktop: DesktopIntegration | null = null;
let cachedSchedules: ScheduledTask[] = [];
let scheduleTimer: ReturnType<typeof setInterval> | null = null;
let licenseState: LicenseState | null = null;

const electronCacheRoot = join(
  process.env.LOCALAPPDATA ?? tmpdir(),
  "OfficeAI",
  "electron-cache",
);
mkdirSync(electronCacheRoot, { recursive: true });
app.commandLine.appendSwitch("disk-cache-dir", join(electronCacheRoot, "disk"));
app.commandLine.appendSwitch(
  "gpu-shader-disk-cache-dir",
  join(electronCacheRoot, "gpu"),
);

async function getLicenseState(): Promise<LicenseState> {
  if (!licenseState) {
    licenseState = await loadLicenseState(app.getPath("userData"));
  }
  return licenseState;
}

async function pushLicenseStatus() {
  const status = resolveLicenseStatus(await getLicenseState());
  mainWindow?.webContents.send(IPC.licenseStatusChanged, status);
  await pushEntitlement();
}

async function handleLicensePlannedEvent(event: RunEvent, current: Engine) {
  if (event.type !== "run:planned") return;
  if (!planUsesPaidApi(event.plan, current.registry.config)) return;

  const state = await getLicenseState();
  const hasValidLicense = normalizeLicenseKeys(state).some(
    (key) => verifyLicenseKey(key).valid,
  );
  if (hasValidLicense) return;

  if (state.apiRunsUsed >= TRIAL_API_RUN_LIMIT) {
    current.orchestrator.cancel(event.runId);
    await pushLicenseStatus();
    return;
  }

  licenseState = { ...state, apiRunsUsed: state.apiRunsUsed + 1 };
  await saveLicenseState(app.getPath("userData"), licenseState);
  await pushLicenseStatus();
}

async function initPrivacyAndCrashReporting() {
  const privacy = await loadPrivacySettings(app.getPath("userData"));
  initCrashReporting({
    enabled: privacy.crashReporting,
    dsn: process.env.OFFICEAI_SENTRY_DSN,
    release: await readAppVersion(),
  });
}

function userDataPath(...segments: string[]) {
  return join(app.getPath("userData"), ...segments);
}

async function readAppVersion(): Promise<string> {
  try {
    const path = app.isPackaged
      ? join(process.resourcesPath, "app.asar", "package.json")
      : join(process.cwd(), "package.json");
    const pkg = JSON.parse(await readFile(path, "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/** API 키는 OS 키체인 기반 safeStorage로 암호화해 userData에 저장 */
async function loadApiKeys(): Promise<Record<string, string>> {
  const path = userDataPath("keys.enc.json");
  if (!existsSync(path)) return {};
  try {
    const encrypted = JSON.parse(await readFile(path, "utf8")) as Record<
      string,
      string
    >;
    const keys: Record<string, string> = {};
    for (const [provider, value] of Object.entries(encrypted)) {
      keys[provider] = safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(Buffer.from(value, "base64"))
        : Buffer.from(value, "base64").toString("utf8");
    }
    return keys;
  } catch {
    return {};
  }
}

async function saveApiKeys(keys: Record<string, string>) {
  const existing = await loadApiKeys();
  const merged = { ...existing, ...keys };
  const encrypted: Record<string, string> = {};
  for (const [provider, value] of Object.entries(merged)) {
    if (!value) continue;
    encrypted[provider] = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(value).toString("base64")
      : Buffer.from(value, "utf8").toString("base64");
  }
  await mkdir(app.getPath("userData"), { recursive: true });
  await writeFile(
    userDataPath("keys.enc.json"),
    JSON.stringify(encrypted),
    "utf8",
  );
}

async function loadProviderOverrides(): Promise<Partial<ProviderConfig>> {
  const path = userDataPath("providers.json");
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(await readFile(path, "utf8")) as Partial<ProviderConfig>;
  } catch {
    return {};
  }
}

async function saveProviderOverrides(overrides: Partial<ProviderConfig>) {
  const existing = await loadProviderOverrides();
  const merged: Partial<ProviderConfig> = {
    ...existing,
    ...overrides,
    baseUrls: {
      ...existing.baseUrls,
      ...overrides.baseUrls,
    },
    cursorAgentCli: {
      ...existing.cursorAgentCli,
      ...overrides.cursorAgentCli,
    },
  };
  await mkdir(app.getPath("userData"), { recursive: true });
  await writeFile(
    userDataPath("providers.json"),
    JSON.stringify(merged, null, 2),
    "utf8",
  );
}

async function loadBudgetSettings(): Promise<BudgetSettings> {
  const path = userDataPath("budget.json");
  if (!existsSync(path)) return defaultBudgetSettings;
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as Partial<BudgetSettings>;
    return {
      globalDailyTokens:
        Number(parsed.globalDailyTokens) ||
        defaultBudgetSettings.globalDailyTokens,
      krwPerUsd: Number(parsed.krwPerUsd) || defaultBudgetSettings.krwPerUsd,
    };
  } catch {
    return defaultBudgetSettings;
  }
}

async function saveBudgetSettings(budget: BudgetSettings) {
  await mkdir(app.getPath("userData"), { recursive: true });
  await writeFile(userDataPath("budget.json"), JSON.stringify(budget, null, 2), "utf8");
}

async function loadSchedules(): Promise<ScheduledTask[]> {
  const path = userDataPath("schedules.json");
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as ScheduledTask[];
    return Array.isArray(parsed)
      ? parsed.map((task) =>
          normalizeScheduledTask({
            ...task,
            id: task.id,
            command: task.command,
          }),
        )
      : [];
  } catch {
    return [];
  }
}

async function saveSchedules(tasks: ScheduledTask[]) {
  const normalized = tasks.map((task) =>
    normalizeScheduledTask({ ...task, id: task.id, command: task.command }),
  );
  cachedSchedules = normalized;
  await mkdir(app.getPath("userData"), { recursive: true });
  await writeFile(
    userDataPath("schedules.json"),
    JSON.stringify(normalized, null, 2),
    "utf8",
  );
}

async function tickSchedules() {
  if (areCommandsPaused()) return;
  const tasks =
    cachedSchedules.length > 0 ? cachedSchedules : await loadSchedules();
  cachedSchedules = tasks;
  const due = findDueSchedules(tasks);
  if (due.length === 0) return;

  const updated = markSchedulesRan(
    tasks,
    due.map((task) => task.id),
  );
  await saveSchedules(updated);

  const current = engine ?? (await bootEngine());
  for (const task of due) {
    void current.orchestrator.run(task.command);
  }
}

function startScheduleTicker() {
  if (scheduleTimer) return;
  scheduleTimer = setInterval(() => void tickSchedules(), 60_000);
  void tickSchedules();
}

function stopScheduleTicker() {
  if (!scheduleTimer) return;
  clearInterval(scheduleTimer);
  scheduleTimer = null;
}

async function loadMemorySettings(): Promise<MemorySettings | null> {
  const path = userDataPath("memory.json");
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as MemorySettings;
    if (!parsed.folderPath) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function saveMemorySettings(settings: MemorySettings) {
  await mkdir(app.getPath("userData"), { recursive: true });
  await writeFile(userDataPath("memory.json"), JSON.stringify(settings, null, 2), "utf8");
}

async function readMemoryEventCount(): Promise<number> {
  const eventsPath = join(memoryOutputDir(app.getPath("userData")), "work-events.jsonl");
  if (!existsSync(eventsPath)) return 0;
  const content = await readFile(eventsPath, "utf8");
  return content.split(/\r?\n/).filter((line) => line.trim()).length;
}

async function getMemoryStatus(): Promise<MemoryStatus> {
  const saved = await loadMemorySettings();
  const eventCount = saved?.eventCount ?? (await readMemoryEventCount());
  return {
    folderPath: saved?.folderPath,
    lastScannedAt: saved?.lastScannedAt,
    eventCount,
  };
}

async function executeMemoryScan(folderPath: string): Promise<MemoryScanResult> {
  const outputDir = memoryOutputDir(app.getPath("userData"));
  const result = await runMemoryScan({ folderPath, outputDir });
  const lastScannedAt = new Date().toISOString();
  await saveMemorySettings({
    folderPath,
    lastScannedAt,
    eventCount: result.events.length,
  });
  await bootEngine();
  return {
    connected: true,
    folderPath,
    eventCount: result.events.length,
    lastScannedAt,
    sourceCounts: result.sourceCounts,
  };
}

async function bootEngine(): Promise<Engine> {
  if (engine) {
    engine.close();
    engine = null;
  }
  const apiKeys = await loadApiKeys();
  // 엔진의 registry는 "env:NAME" 참조를 해석하므로, 저장된 키를 env로 노출
  if (apiKeys.openai) process.env.OPENAI_API_KEY = apiKeys.openai;
  if (apiKeys.anthropic) process.env.ANTHROPIC_API_KEY = apiKeys.anthropic;

  const workspaceRoot = process.env.OFFICEAI_WORKSPACE ?? app.getPath("userData");
  const overrides = await loadProviderOverrides();
  const budgetSettings = await loadBudgetSettings();
  const created = await createEngine({
    workspaceRoot,
    confirmPlan: true,
    providerOverrides: overrides,
    budget: { globalDailyTokens: budgetSettings.globalDailyTokens },
  });

  created.bus.subscribe((event) => {
    mainWindow?.webContents.send(IPC.engineEvent, event);
    desktop?.onEngineEvent(event);
    void handleLicensePlannedEvent(event, created);
    if (event.type === "run:completed") {
      const userData = app.getPath("userData");
      void (async () => {
        const profile = await loadWorkProfile(userData);
        const entry = await appendRunSummary(
          userData,
          event.report,
          created.registry,
          profile,
        );
        await updateProjectSummaryAfterRun(
          userData,
          entry,
          created.registry,
          profile,
        );
      })();
    }
  });
  created.ledger.markInterruptedRuns("앱 종료로 중단");
  engine = created;
  return created;
}

async function chooseActionWorkspaceDialog(): Promise<string | undefined> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "액션 작업 폴더 선택 (파일 저장/명령 실행 기준)",
    properties: ["openDirectory", "createDirectory"],
  });
  if (canceled || !filePaths[0]) return undefined;
  await saveActionWorkspace(app.getPath("userData"), filePaths[0]);
  return filePaths[0];
}

async function ensureActionWorkspace(): Promise<string | undefined> {
  const saved = await loadActionWorkspace(app.getPath("userData"));
  if (saved && existsSync(saved)) return saved;
  return chooseActionWorkspaceDialog();
}

async function runProposedAction(
  action: ActionProposal,
): Promise<ExecuteActionResult> {
  const baseDir = await ensureActionWorkspace();
  if (!baseDir) {
    return { ok: false, error: "작업 폴더가 설정되지 않았습니다" };
  }
  if (action.kind === "write-file") {
    return executeWriteFile(baseDir, action.path, action.content);
  }
  // 셸 명령은 어떤 것이든 side-effect — 실행 직전 네이티브 확인을 강제한다
  const { response } = await dialog.showMessageBox({
    type: "warning",
    title: "명령 실행 확인",
    message: "다음 명령을 실행할까요?",
    detail: `${action.command}\n\n실행 위치: ${baseDir}`,
    buttons: ["실행", "취소"],
    defaultId: 1,
    cancelId: 1,
  });
  if (response !== 0) {
    return { ok: false, error: "사용자가 취소했습니다" };
  }
  return executeRunCommand(baseDir, action.command);
}

function registerIpc() {
  ipcMain.handle(IPC.submitCommand, async (_event, command: string) => {
    if (areCommandsPaused()) {
      return { runId: "paused", rejected: true as const };
    }
    const current = engine ?? (await bootEngine());
    const userData = app.getPath("userData");
    const profile = await loadWorkProfile(userData);
    const summaries = await loadRecentSummaries(userData);
    const projectSummary = await loadProjectSummaryForCommand(
      userData,
      command,
      profile,
    );
    const commandWithContext = enrichCommandWithContext(
      command,
      summaries,
      projectSummary,
    );
    // run은 오래 걸리므로 fire-and-forget. 진행/결과는 이벤트 스트림으로 전달.
    void current.orchestrator.run(commandWithContext);
    return { runId: "pending" };
  });

  ipcMain.handle(IPC.cancelRun, (_event, runId: string) => {
    engine?.orchestrator.cancel(runId);
  });

  ipcMain.handle(
    IPC.resolveApproval,
    (_event, requestId: string, approved: boolean, note?: string) =>
      engine?.gate.resolve(requestId, { approved, note }) ?? false,
  );

  ipcMain.handle(IPC.pendingApprovals, () => engine?.gate.pending() ?? []);

  ipcMain.handle(IPC.recentRuns, (_event, limit?: number) =>
    engine?.ledger.recentRuns(limit) ?? [],
  );

  ipcMain.handle(IPC.runEvents, (_event, runId: string) =>
    engine?.ledger.runEvents(runId) ?? [],
  );

  ipcMain.handle(
    IPC.usageTotals,
    () =>
      engine?.ledger.totals() ?? {
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
      },
  );

  ipcMain.handle(
    IPC.savingsSummary,
    (_event, runId?: string): SavingsSummary => {
      const current = engine;
      if (!current) {
        return {
          actualCostUsd: 0,
          premiumEquivalentCostUsd: 0,
          savedUsd: 0,
          savedPercent: 0,
        };
      }
      return current.ledger.savingsSummary(
        current.registry.config.tiers.premium,
        runId,
      );
    },
  );

  ipcMain.handle(IPC.getSettings, async (): Promise<SettingsPayload> => {
    const current = engine ?? (await bootEngine());
    const apiKeys = await loadApiKeys();
    const budget = await loadBudgetSettings();
    return {
      providers: current.registry.config,
      apiKeyPresence: Object.fromEntries(
        Object.keys(current.registry.config.apiKeys ?? {}).map((provider) => [
          provider,
          Boolean(apiKeys[provider]),
        ]),
      ),
      budget,
    };
  });

  ipcMain.handle(
    IPC.saveSettings,
    async (_event, payload: SaveSettingsPayload) => {
      if (payload.apiKeys) await saveApiKeys(payload.apiKeys);
      if (payload.providers) await saveProviderOverrides(payload.providers);
      if (payload.budget) await saveBudgetSettings(payload.budget);
      await bootEngine();
    },
  );

  ipcMain.handle(IPC.exportDiagnostic, async () => {
    const current = engine ?? (await bootEngine());
    const apiKeys = await loadApiKeys();
    const budget = await loadBudgetSettings();
    const settings: SettingsPayload = {
      providers: current.registry.config,
      apiKeyPresence: Object.fromEntries(
        Object.keys(current.registry.config.apiKeys ?? {}).map((provider) => [
          provider,
          Boolean(apiKeys[provider]),
        ]),
      ),
      budget,
    };
    const bundle = buildDiagnosticBundle({
      appName: app.getName(),
      appVersion: await readAppVersion(),
      providers: settings.providers,
      apiKeyPresence: settings.apiKeyPresence,
      usage: current.ledger.totals(),
      recentRuns: current.ledger.recentRuns(5),
      runEvents: (runId) => current.ledger.runEvents(runId),
    });
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "진단 파일 저장",
      defaultPath: `officeai-diagnostic-${stamp}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (canceled || !filePath) return { saved: false };
    await writeFile(filePath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
    return { saved: true, path: filePath };
  });

  ipcMain.handle(
    IPC.exportDeliverable,
    async (_event, payload: ExportDeliverablePayload) => {
      const markdown = buildDeliverableMarkdown(payload.title, payload.content);
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: "산출물 저장",
        defaultPath: `${suggestDeliverableFileName(payload.title)}.md`,
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (canceled || !filePath) return { saved: false };
      await writeFile(filePath, markdown, "utf8");
      return { saved: true, path: filePath };
    },
  );

  ipcMain.handle(IPC.getSchedules, async () => {
    cachedSchedules = await loadSchedules();
    return cachedSchedules;
  });

  ipcMain.handle(IPC.saveSchedules, async (_event, tasks: ScheduledTask[]) => {
    await saveSchedules(tasks);
  });

  ipcMain.handle(IPC.getMemoryStatus, async (): Promise<MemoryStatus> =>
    getMemoryStatus(),
  );

  ipcMain.handle(IPC.connectMemoryFolder, async (): Promise<MemoryScanResult> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: "업무 기록 폴더 선택",
      properties: ["openDirectory"],
    });
    if (canceled || !filePaths[0]) {
      return { connected: false, eventCount: 0 };
    }
    return executeMemoryScan(filePaths[0]);
  });

  ipcMain.handle(IPC.rescanMemory, async (): Promise<MemoryScanResult> => {
    const saved = await loadMemorySettings();
    if (!saved?.folderPath) {
      return { connected: false, eventCount: 0 };
    }
    return executeMemoryScan(saved.folderPath);
  });

  ipcMain.handle(IPC.getLicenseStatus, async (): Promise<LicenseStatus> =>
    resolveLicenseStatus(await getLicenseState()),
  );

  ipcMain.handle(
    IPC.activateLicense,
    async (_event, key: string): Promise<ActivateLicenseResult> => {
      const verified = verifyLicenseKey(key);
      if (!verified.valid) {
        return { ok: false, error: verified.error };
      }
      const current = await getLicenseState();
      const keys = normalizeLicenseKeys(current);
      const trimmed = key.trim();
      if (!keys.includes(trimmed)) keys.push(trimmed);
      licenseState = { ...current, keys, apiRunsUsed: current.apiRunsUsed };
      await saveLicenseState(app.getPath("userData"), licenseState);
      const status = resolveLicenseStatus(licenseState);
      mainWindow?.webContents.send(IPC.licenseStatusChanged, status);
      await pushEntitlement();
      return { ok: true, status };
    },
  );

  ipcMain.handle(IPC.getEmployeeCatalog, () => getEmployeeCatalog());

  ipcMain.handle(IPC.getEntitlement, async () =>
    loadEntitlement(app.getPath("userData"), await getLicenseState()),
  );

  ipcMain.handle(
    IPC.setActiveEmployees,
    async (_event, activeSkus: EmployeeSkuId[]) => {
      const state = await getLicenseState();
      const entitlement = await loadEntitlement(app.getPath("userData"), state);
      const next = buildEntitlement(entitlement.ownedSkus, activeSkus);
      await saveActiveSkus(app.getPath("userData"), next.activeSkus);
      mainWindow?.webContents.send(IPC.entitlementChanged, next);
      return next;
    },
  );

  ipcMain.handle(IPC.getPrivacySettings, async (): Promise<PrivacySettings> =>
    loadPrivacySettings(app.getPath("userData")),
  );

  ipcMain.handle(
    IPC.savePrivacySettings,
    async (_event, settings: PrivacySettings) => {
      await savePrivacySettings(app.getPath("userData"), settings);
      await initPrivacyAndCrashReporting();
    },
  );

  ipcMain.handle(
    IPC.getActionWorkspace,
    async (): Promise<ActionWorkspaceStatus> => ({
      folderPath: await loadActionWorkspace(app.getPath("userData")),
    }),
  );

  ipcMain.handle(
    IPC.chooseActionWorkspace,
    async (): Promise<ActionWorkspaceStatus> => {
      const chosen = await chooseActionWorkspaceDialog();
      return {
        folderPath:
          chosen ?? (await loadActionWorkspace(app.getPath("userData"))),
      };
    },
  );

  ipcMain.handle(
    IPC.executeAction,
    async (_event, action: ActionProposal): Promise<ExecuteActionResult> => {
      const result = await runProposedAction(action);
      await appendActionLog(app.getPath("userData"), {
        kind: action.kind,
        target: action.kind === "write-file" ? action.path : action.command,
        ok: result.ok,
        error: result.error,
      }).catch(() => undefined);
      return result;
    },
  );

  ipcMain.handle(
    IPC.probeProviders,
    async (): Promise<ProviderProbeResult[]> => {
      const current = engine ?? (await bootEngine());
      const apiKeys = await loadApiKeys();
      const budget = await loadBudgetSettings();
      const settings: SettingsPayload = {
        providers: current.registry.config,
        apiKeyPresence: Object.fromEntries(
          Object.keys(current.registry.config.apiKeys).map((key) => [
            key,
            Boolean(apiKeys[key]),
          ]),
        ),
        budget,
      };
      return probeUsedProviders(
        {
          providers: settings.providers,
          apiKeyPresence: settings.apiKeyPresence,
          apiKeys,
        },
        app.getPath("userData"),
      );
    },
  );

  ipcMain.handle(IPC.updateGetStatus, (): UpdateStatus => {
    return (
      autoUpdate?.getStatus() ??
      createIdleUpdateStatus(app.getVersion())
    );
  });

  ipcMain.handle(IPC.updateInstall, () => {
    autoUpdate?.install();
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 680,
    title: "OfficeAI Command Center",
    backgroundColor: "#0d1117",
    webPreferences: {
      preload: join(__dirname, "../preload/preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  desktop = createDesktopIntegration({
    getWindow: () => mainWindow,
    getApprovalCount: () => engine?.gate.pending().length ?? 0,
  });
  desktop.attachWindow(mainWindow);

  autoUpdate = createAutoUpdateService({
    sendStatus: (status) => {
      mainWindow?.webContents.send(IPC.updateStatusChanged, status);
    },
  });
  autoUpdate.start();

  return mainWindow;
}

app.whenReady().then(async () => {
  registerIpc();
  await initPrivacyAndCrashReporting();
  process.on("uncaughtException", (error) => {
    captureMainException(error);
  });
  process.on("unhandledRejection", (reason) => {
    captureMainException(reason);
  });
  await bootEngine();
  cachedSchedules = await loadSchedules();
  startScheduleTicker();
  await createWindow();
  await pushEntitlement();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform === "darwin") return;
});

app.on("before-quit", () => {
  markAppQuitting();
  stopScheduleTicker();
  autoUpdate?.stop();
  desktop?.destroy();
  engine?.close();
});
