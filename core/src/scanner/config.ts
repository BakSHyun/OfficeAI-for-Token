import { readFile } from "node:fs/promises";
import { resolveConfiguredPath } from "../config/path";

export type SourceConfig = {
  kind:
    | "markdown"
    | "cursor-plans"
    | "cursor-transcripts"
    | "cursor-workspaces"
    | "git";
  label: string;
  root: string;
};

export type ScannerConfig = {
  outputDir: string;
  maxFileBytes: number;
  maxTranscriptEventsPerFile: number;
  projectAliases: Record<string, string>;
  sources: SourceConfig[];
};

export async function loadScannerConfig(path: string): Promise<ScannerConfig> {
  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw) as Partial<ScannerConfig>;

  if (!parsed.outputDir || !Array.isArray(parsed.sources)) {
    throw new Error("Invalid scanner config.");
  }

  return {
    outputDir: parsed.outputDir,
    maxFileBytes: parsed.maxFileBytes ?? 1_048_576,
    maxTranscriptEventsPerFile:
      parsed.maxTranscriptEventsPerFile ?? 100,
    projectAliases: parsed.projectAliases ?? {},
    sources: parsed.sources.map((source) => ({
      ...source,
      root: resolveConfiguredPath(source.root),
    })),
  };
}
