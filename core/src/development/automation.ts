import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { WorkEvent } from "../contracts";
import { buildContextPack } from "../context/context-pack";
import { createTaskEnvelope } from "../intake/task-intake";
import type { WorkProfile } from "../memory/work-profile";
import { planWork } from "../planning/recipe-planner";
import { loadRepositoryConfig } from "../repositories/config";
import { loadBaseline } from "../repositories/baseline";
import { inspectRepository } from "../repositories/inspector";
import { planVerification } from "../repositories/verification-planner";
import {
  exampleModelRegistry,
  routeModel,
} from "../routing/model-router";
import { buildDevelopmentPrompt } from "./prompt-builder";

export type DevelopmentPreparation = Awaited<
  ReturnType<typeof prepareDevelopmentAutomation>
>;

async function readEvents(path: string) {
  return (await readFile(path, "utf8"))
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as WorkEvent);
}

export async function prepareDevelopmentAutomation(command: string) {
  const officeAiDirectory = resolve(".officeai");
  const profile = JSON.parse(
    await readFile(join(officeAiDirectory, "work-profile.json"), "utf8"),
  ) as WorkProfile;
  const events = await readEvents(
    join(officeAiDirectory, "work-events.jsonl"),
  );
  const task = createTaskEnvelope(command, profile);
  const config = await loadRepositoryConfig(
    resolve("config/repositories.local.json"),
  );
  const requested = new Set(task.projectHints);
  const selectedConfigs = config.repositories.filter(
    (repository) =>
      requested.size === 0 || requested.has(repository.id),
  );
  const repositories = await Promise.all(
    selectedConfigs.map(inspectRepository),
  );
  if (repositories.length === 0) {
    throw new Error(
      `No configured repository matched: ${task.projectHints.join(", ")}`,
    );
  }
  const routing = routeModel(task, exampleModelRegistry);
  const selectedEvents = events.filter(
    (event) =>
      (routing.selected.local || event.sensitivity !== "restricted") &&
      event.kind !== "git-status" &&
      (requested.size === 0 ||
        requested.has(event.project) ||
        event.kind === "cursor-plan" ||
        event.project === "obsidian"),
  );
  const contextBudget = Math.min(
    12_000,
    Math.max(3_000, Math.round(task.expectedInputTokens * 1.4)),
  );
  const context = buildContextPack(
    `${task.objective} ${task.projectHints.join(" ")}`,
    selectedEvents,
    contextBudget,
  );
  const plan = planWork(task);
  const verification = planVerification(repositories);
  const baselines = (
    await Promise.all(
      repositories.map((repository) =>
        loadBaseline(officeAiDirectory, repository),
      ),
    )
  ).filter((baseline) => baseline !== null);
  const prompt = buildDevelopmentPrompt({
    task,
    plan,
    context,
    repositories,
    verification,
    baselines,
    routing,
  });
  const runDirectory = join(
    officeAiDirectory,
    "runs",
    `${new Date().toISOString().replaceAll(/[:.]/g, "-")}-${task.id}`,
  );
  await mkdir(runDirectory, { recursive: true });
  const record = {
    task,
    plan,
    routing: {
      selected: routing.selected,
      reasons: routing.reasons,
      eligible: routing.eligible,
      rejected: routing.rejected,
    },
    context: {
      tokenBudget: context.tokenBudget,
      estimatedTokens: context.estimatedTokens,
      citations: context.citations,
    },
    repositories,
    baselines,
    verification,
    runDirectory,
  };
  await Promise.all([
    writeFile(
      join(runDirectory, "preparation.json"),
      JSON.stringify(record, null, 2) + "\n",
      "utf8",
    ),
    writeFile(join(runDirectory, "prompt.md"), prompt, "utf8"),
  ]);

  return {
    ...record,
    prompt,
  };
}
