import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { inferProjectHints } from "../core/src/intake/task-intake";
import type { WorkProfile } from "../core/src/memory/work-profile";
import {
  pickPrimaryProject,
  PROJECT_RUNS_WINDOW,
  type ProjectRunSnippet,
  type StoredProjectSummary,
} from "../core/src/context/hierarchical-summary";
import type { ProviderRegistry } from "../core/src/providers/registry";
import {
  loadAllRunSummaries,
  type StoredRunSummary,
} from "./run-summaries";
import { buildHierarchicalProjectSummary } from "./project-summary-llm";

const PROJECT_SUMMARIES_FILE = "project-summaries.json";

export function projectSummariesPath(userDataPath: string) {
  return join(userDataPath, PROJECT_SUMMARIES_FILE);
}

export async function loadWorkProfile(
  userDataPath: string,
): Promise<WorkProfile | undefined> {
  const path = join(userDataPath, ".officeai", "work-profile.json");
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(await readFile(path, "utf8")) as WorkProfile;
  } catch {
    return undefined;
  }
}

export function inferProjectForCommand(
  command: string,
  profile?: WorkProfile,
) {
  return pickPrimaryProject(inferProjectHints(command, profile));
}

export async function loadProjectSummaries(
  userDataPath: string,
): Promise<Record<string, StoredProjectSummary>> {
  const path = projectSummariesPath(userDataPath);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(await readFile(path, "utf8")) as Record<
      string,
      StoredProjectSummary
    >;
  } catch {
    return {};
  }
}

async function saveProjectSummaries(
  userDataPath: string,
  summaries: Record<string, StoredProjectSummary>,
) {
  await mkdir(userDataPath, { recursive: true });
  await writeFile(
    projectSummariesPath(userDataPath),
    `${JSON.stringify(summaries, null, 2)}\n`,
    "utf8",
  );
}

function toRunSnippet(entry: StoredRunSummary): ProjectRunSnippet {
  return {
    runId: entry.runId,
    command: entry.command,
    summary: entry.summary,
    finishedAt: entry.finishedAt,
  };
}

export function collectProjectRuns(
  allRuns: StoredRunSummary[],
  project: string,
) {
  return allRuns
    .filter((entry) => entry.project === project)
    .slice(-PROJECT_RUNS_WINDOW)
    .map(toRunSnippet);
}

export async function updateProjectSummaryAfterRun(
  userDataPath: string,
  entry: StoredRunSummary,
  registry?: ProviderRegistry,
  profile?: WorkProfile,
): Promise<void> {
  const project =
    entry.project ?? inferProjectForCommand(entry.command, profile);
  if (!project) return;

  const allRuns = await loadAllRunSummaries(userDataPath);
  const projectRuns = collectProjectRuns(allRuns, project);
  if (projectRuns.length === 0) return;

  let summary = projectRuns[projectRuns.length - 1]?.summary ?? "";
  let summaryMethod: StoredProjectSummary["summaryMethod"] = "rule";

  if (registry) {
    const result = await buildHierarchicalProjectSummary(
      project,
      projectRuns,
      registry,
    );
    summary = result.summary;
    summaryMethod = result.method;
  }

  const existing = (await loadProjectSummaries(userDataPath))[project];
  const next: StoredProjectSummary = {
    project,
    summary,
    updatedAt: entry.finishedAt,
    runCount: (existing?.runCount ?? 0) + 1,
    summaryMethod,
    lastRunIds: projectRuns.map((run) => run.runId),
  };
  const all = await loadProjectSummaries(userDataPath);
  await saveProjectSummaries(userDataPath, {
    ...all,
    [project]: next,
  });
}

export async function loadProjectSummaryForCommand(
  userDataPath: string,
  command: string,
  profile?: WorkProfile,
): Promise<StoredProjectSummary | undefined> {
  const project = inferProjectForCommand(
    command,
    profile ?? (await loadWorkProfile(userDataPath)),
  );
  if (!project) return undefined;
  const summaries = await loadProjectSummaries(userDataPath);
  return summaries[project];
}
