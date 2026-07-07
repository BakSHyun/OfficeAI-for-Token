import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  BrowserWindow,
  Menu,
  nativeImage,
  Notification,
  Tray,
  app,
} from "electron";
import type { RunEvent } from "../core/src/orchestration/contracts";
import { IPC, type NavigateView } from "./ipc-contract";

export type DesktopIntegration = {
  onEngineEvent(event: RunEvent): void;
  attachWindow(window: BrowserWindow): void;
  isPaused(): boolean;
  destroy(): void;
};

let tray: Tray | null = null;
let isQuitting = false;
let commandsPaused = false;

export function markAppQuitting() {
  isQuitting = true;
}

export function isAppQuitting() {
  return isQuitting;
}

export function areCommandsPaused() {
  return commandsPaused;
}

function trayIconPath() {
  const candidates = [
    join(process.cwd(), "build", "icon.png"),
    join(app.getAppPath(), "build", "icon.png"),
    join(process.resourcesPath, "icon.png"),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return candidates[0]!;
}

function loadTrayIcon() {
  const icon = nativeImage.createFromPath(trayIconPath());
  if (icon.isEmpty()) return nativeImage.createEmpty();
  return icon.resize({ width: 16, height: 16 });
}

function focusWindow(window: BrowserWindow | null) {
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

function pushNavigate(
  window: BrowserWindow | null,
  view: NavigateView,
  runId?: string,
) {
  window?.webContents.send(IPC.navigateTo, { view, runId });
}

function shouldNotify(window: BrowserWindow | null) {
  if (!window) return true;
  return !window.isFocused() || window.isMinimized();
}

function showDesktopNotification(input: {
  title: string;
  body: string;
  view: NavigateView;
  runId?: string;
  window: BrowserWindow | null;
}) {
  if (!Notification.isSupported()) return;
  const notification = new Notification({
    title: input.title,
    body: input.body.slice(0, 240),
    icon: trayIconPath(),
    silent: false,
  });
  notification.on("click", () => {
    focusWindow(input.window);
    pushNavigate(input.window, input.view, input.runId);
  });
  notification.show();
}

function buildTrayMenu(input: {
  window: BrowserWindow | null;
  approvalCount: number;
  onPauseToggle: () => void;
}) {
  const pauseLabel = commandsPaused ? "재개" : "일시정지";
  const badge =
    input.approvalCount > 0 ? ` (승인 ${input.approvalCount})` : "";
  return Menu.buildFromTemplate([
    {
      label: `OfficeAI 열기${badge}`,
      click: () => focusWindow(input.window),
    },
    {
      label: pauseLabel,
      click: () => input.onPauseToggle(),
    },
    { type: "separator" },
    {
      label: "종료",
      click: () => {
        markAppQuitting();
        app.quit();
      },
    },
  ]);
}

function refreshTray(input: {
  window: BrowserWindow | null;
  approvalCount: number;
  onPauseToggle: () => void;
}) {
  if (!tray) return;
  const badge =
    input.approvalCount > 0 ? ` — 승인 대기 ${input.approvalCount}건` : "";
  tray.setToolTip(`OfficeAI${badge}`);
  if (process.platform === "darwin") {
    tray.setTitle(input.approvalCount > 0 ? String(input.approvalCount) : "");
  }
  tray.setContextMenu(buildTrayMenu(input));
}

export function createDesktopIntegration(options: {
  getWindow: () => BrowserWindow | null;
  getApprovalCount: () => number;
}): DesktopIntegration {
  tray = new Tray(loadTrayIcon());
  tray.setToolTip("OfficeAI");

  const onPauseToggle = () => {
    commandsPaused = !commandsPaused;
    refreshTray({
      window: options.getWindow(),
      approvalCount: options.getApprovalCount(),
      onPauseToggle,
    });
  };

  const refresh = () =>
    refreshTray({
      window: options.getWindow(),
      approvalCount: options.getApprovalCount(),
      onPauseToggle,
    });

  tray.on("double-click", () => focusWindow(options.getWindow()));
  refresh();

  return {
    isPaused: () => commandsPaused,
    attachWindow(window) {
      window.on("close", (event) => {
        if (!isQuitting) {
          event.preventDefault();
          window.hide();
        }
      });
    },
    onEngineEvent(event) {
      refresh();
      const window = options.getWindow();
      if (!shouldNotify(window)) return;

      if (event.type === "approval:requested") {
        showDesktopNotification({
          title: "승인 요청",
          body: event.request.reason,
          view: "승인 대기",
          window,
        });
        return;
      }

      if (event.type === "run:completed") {
        showDesktopNotification({
          title: "업무 완료",
          body: event.report.summary,
          view: "보고서",
          runId: event.runId,
          window,
        });
      }
    },
    destroy() {
      tray?.destroy();
      tray = null;
    },
  };
}
