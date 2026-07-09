import { contextBridge, ipcRenderer } from "electron";
import type { RunEvent } from "../core/src/orchestration/contracts";
import { IPC, type NavigatePayload, type OfficeAIBridge } from "./ipc-contract";

const bridge: OfficeAIBridge = {
  submitCommand: (command) => ipcRenderer.invoke(IPC.submitCommand, command),
  cancelRun: (runId) => ipcRenderer.invoke(IPC.cancelRun, runId),
  resolveApproval: (requestId, approved, note) =>
    ipcRenderer.invoke(IPC.resolveApproval, requestId, approved, note),
  pendingApprovals: () => ipcRenderer.invoke(IPC.pendingApprovals),
  recentRuns: (limit) => ipcRenderer.invoke(IPC.recentRuns, limit),
  runEvents: (runId) => ipcRenderer.invoke(IPC.runEvents, runId),
  usageTotals: () => ipcRenderer.invoke(IPC.usageTotals),
  savingsSummary: (runId) => ipcRenderer.invoke(IPC.savingsSummary, runId),
  getSettings: () => ipcRenderer.invoke(IPC.getSettings),
  saveSettings: (payload) => ipcRenderer.invoke(IPC.saveSettings, payload),
  exportDiagnostic: () => ipcRenderer.invoke(IPC.exportDiagnostic),
  exportDeliverable: (payload) =>
    ipcRenderer.invoke(IPC.exportDeliverable, payload),
  getSchedules: () => ipcRenderer.invoke(IPC.getSchedules),
  saveSchedules: (tasks) => ipcRenderer.invoke(IPC.saveSchedules, tasks),
  getMemoryStatus: () => ipcRenderer.invoke(IPC.getMemoryStatus),
  connectMemoryFolder: () => ipcRenderer.invoke(IPC.connectMemoryFolder),
  rescanMemory: () => ipcRenderer.invoke(IPC.rescanMemory),
  getLicenseStatus: () => ipcRenderer.invoke(IPC.getLicenseStatus),
  activateLicense: (key) => ipcRenderer.invoke(IPC.activateLicense, key),
  getPrivacySettings: () => ipcRenderer.invoke(IPC.getPrivacySettings),
  savePrivacySettings: (settings) =>
    ipcRenderer.invoke(IPC.savePrivacySettings, settings),
  executeAction: (action) => ipcRenderer.invoke(IPC.executeAction, action),
  getActionWorkspace: () => ipcRenderer.invoke(IPC.getActionWorkspace),
  chooseActionWorkspace: () => ipcRenderer.invoke(IPC.chooseActionWorkspace),
  probeProviders: () => ipcRenderer.invoke(IPC.probeProviders),
  getUpdateStatus: () => ipcRenderer.invoke(IPC.updateGetStatus),
  installUpdate: () => ipcRenderer.invoke(IPC.updateInstall),
  getEmployeeCatalog: () => ipcRenderer.invoke(IPC.getEmployeeCatalog),
  getEntitlement: () => ipcRenderer.invoke(IPC.getEntitlement),
  setActiveEmployees: (activeSkus) =>
    ipcRenderer.invoke(IPC.setActiveEmployees, activeSkus),
  onEvent: (listener) => {
    const handler = (_event: unknown, payload: RunEvent) => listener(payload);
    ipcRenderer.on(IPC.engineEvent, handler);
    return () => ipcRenderer.removeListener(IPC.engineEvent, handler);
  },
  onNavigate: (listener) => {
    const handler = (_event: unknown, payload: NavigatePayload) =>
      listener(payload);
    ipcRenderer.on(IPC.navigateTo, handler);
    return () => ipcRenderer.removeListener(IPC.navigateTo, handler);
  },
  onLicenseStatusChanged: (listener) => {
    const handler = (_event: unknown, payload: import("./ipc-contract").LicenseStatus) =>
      listener(payload);
    ipcRenderer.on(IPC.licenseStatusChanged, handler);
    return () => ipcRenderer.removeListener(IPC.licenseStatusChanged, handler);
  },
  onUpdateStatusChanged: (listener) => {
    const handler = (_event: unknown, payload: import("./ipc-contract").UpdateStatus) =>
      listener(payload);
    ipcRenderer.on(IPC.updateStatusChanged, handler);
    return () => ipcRenderer.removeListener(IPC.updateStatusChanged, handler);
  },
  onEntitlementChanged: (listener) => {
    const handler = (
      _event: unknown,
      payload: import("./ipc-contract").Entitlement,
    ) => listener(payload);
    ipcRenderer.on(IPC.entitlementChanged, handler);
    return () => ipcRenderer.removeListener(IPC.entitlementChanged, handler);
  },
};

contextBridge.exposeInMainWorld("officeai", bridge);
