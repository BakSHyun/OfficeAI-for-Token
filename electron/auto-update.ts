import { app } from "electron";
import { autoUpdater } from "electron-updater";
import {
  createIdleUpdateStatus,
  type UpdateStatus,
} from "./update-status";

export type AutoUpdateService = {
  start(): void;
  getStatus(): UpdateStatus;
  install(): void;
  stop(): void;
};

export function isAutoUpdateEnabled() {
  if (!app.isPackaged) return false;
  if (process.env.OFFICEAI_DISABLE_AUTO_UPDATE === "1") return false;
  return true;
}

export function createAutoUpdateService(input: {
  sendStatus(status: UpdateStatus): void;
}): AutoUpdateService {
  const currentVersion = app.getVersion();
  let status = createIdleUpdateStatus(currentVersion);

  function publish(next: UpdateStatus) {
    status = next;
    input.sendStatus(status);
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("checking-for-update", () => {
    publish({ phase: "checking", currentVersion });
  });

  autoUpdater.on("update-available", (info) => {
    publish({
      phase: "available",
      currentVersion,
      availableVersion: info.version,
    });
  });

  autoUpdater.on("update-not-available", () => {
    publish(createIdleUpdateStatus(currentVersion));
  });

  autoUpdater.on("download-progress", (progress) => {
    publish({
      phase: "downloading",
      currentVersion,
      availableVersion: status.availableVersion,
      percent: progress.percent,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    publish({
      phase: "downloaded",
      currentVersion,
      availableVersion: info.version,
    });
  });

  autoUpdater.on("error", (error) => {
    publish({
      phase: "error",
      currentVersion,
      availableVersion: status.availableVersion,
      message: error.message,
    });
  });

  async function check() {
    if (!isAutoUpdateEnabled()) return;
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      publish({
        phase: "error",
        currentVersion,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  let timer: ReturnType<typeof setInterval> | undefined;

  return {
    start() {
      if (!isAutoUpdateEnabled()) return;
      void check();
      timer = setInterval(() => {
        void check();
      }, 4 * 60 * 60 * 1000);
      timer.unref?.();
    },
    getStatus() {
      return status;
    },
    install() {
      if (status.phase !== "downloaded") return;
      autoUpdater.quitAndInstall();
    },
    stop() {
      if (timer) clearInterval(timer);
    },
  };
}
