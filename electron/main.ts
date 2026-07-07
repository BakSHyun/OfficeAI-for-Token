import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  BrowserWindow,
  app,
  ipcMain,
  safeStorage,
  shell,
} from "electron";
import { createEngine } from "../core/src/engine";
import type { Engine } from "../core/src/engine";
import type { ProviderConfig } from "../core/src/providers/contracts";
import {
  IPC,
  type SaveSettingsPayload,
  type SettingsPayload,
} from "./ipc-contract";

let engine: Engine | null = null;
let mainWindow: BrowserWindow | null = null;

function userDataPath(...segments: string[]) {
  return join(app.getPath("userData"), ...segments);
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
  await mkdir(app.getPath("userData"), { recursive: true });
  await writeFile(
    userDataPath("providers.json"),
    JSON.stringify({ ...existing, ...overrides }, null, 2),
    "utf8",
  );
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
  const created = await createEngine({
    workspaceRoot,
    confirmPlan: true,
    providerOverrides: overrides,
  });

  created.bus.subscribe((event) => {
    mainWindow?.webContents.send(IPC.engineEvent, event);
  });
  engine = created;
  return created;
}

function registerIpc() {
  ipcMain.handle(IPC.submitCommand, async (_event, command: string) => {
    const current = engine ?? (await bootEngine());
    // run은 오래 걸리므로 fire-and-forget. 진행/결과는 이벤트 스트림으로 전달.
    void current.orchestrator.run(command);
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

  ipcMain.handle(IPC.getSettings, async (): Promise<SettingsPayload> => {
    const current = engine ?? (await bootEngine());
    const apiKeys = await loadApiKeys();
    return {
      providers: current.registry.config,
      apiKeyPresence: Object.fromEntries(
        Object.keys(current.registry.config.apiKeys ?? {}).map((provider) => [
          provider,
          Boolean(apiKeys[provider]),
        ]),
      ),
    };
  });

  ipcMain.handle(
    IPC.saveSettings,
    async (_event, payload: SaveSettingsPayload) => {
      if (payload.apiKeys) await saveApiKeys(payload.apiKeys);
      if (payload.providers) await saveProviderOverrides(payload.providers);
      await bootEngine();
    },
  );
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
}

app.whenReady().then(async () => {
  registerIpc();
  await bootEngine();
  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on("window-all-closed", () => {
  engine?.close();
  if (process.platform !== "darwin") app.quit();
});
