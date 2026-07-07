import { join } from "node:path";
import { runScan, type ScanResult } from "../core/src/scanner/run";
import type { ScannerConfig } from "../core/src/scanner/config";

export type MemorySettings = {
  folderPath: string;
  lastScannedAt: string;
  eventCount: number;
};

export function buildMemoryScannerConfig(input: {
  folderPath: string;
  outputDir: string;
}): ScannerConfig {
  return {
    outputDir: input.outputDir,
    maxFileBytes: 1_048_576,
    maxTranscriptEventsPerFile: 100,
    projectAliases: {},
    sources: [
      {
        kind: "markdown",
        label: "memory-vault",
        root: input.folderPath,
      },
    ],
  };
}

export async function runMemoryScan(input: {
  folderPath: string;
  outputDir: string;
}): Promise<ScanResult> {
  return runScan(buildMemoryScannerConfig(input));
}

export function memoryOutputDir(userDataPath: string) {
  return join(userDataPath, ".officeai");
}
