import { contextBridge, ipcRenderer } from "electron";
import type { RunEvent } from "../core/src/orchestration/contracts";
import { IPC, type OfficeAIBridge } from "./ipc-contract";

const bridge: OfficeAIBridge = {
  submitCommand: (command) => ipcRenderer.invoke(IPC.submitCommand, command),
  cancelRun: (runId) => ipcRenderer.invoke(IPC.cancelRun, runId),
  resolveApproval: (requestId, approved, note) =>
    ipcRenderer.invoke(IPC.resolveApproval, requestId, approved, note),
  pendingApprovals: () => ipcRenderer.invoke(IPC.pendingApprovals),
  recentRuns: (limit) => ipcRenderer.invoke(IPC.recentRuns, limit),
  runEvents: (runId) => ipcRenderer.invoke(IPC.runEvents, runId),
  usageTotals: () => ipcRenderer.invoke(IPC.usageTotals),
  getSettings: () => ipcRenderer.invoke(IPC.getSettings),
  saveSettings: (payload) => ipcRenderer.invoke(IPC.saveSettings, payload),
  onEvent: (listener) => {
    const handler = (_event: unknown, payload: RunEvent) => listener(payload);
    ipcRenderer.on(IPC.engineEvent, handler);
    return () => ipcRenderer.removeListener(IPC.engineEvent, handler);
  },
};

contextBridge.exposeInMainWorld("officeai", bridge);
