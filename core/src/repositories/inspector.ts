import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type {
  RepositoryConfig,
  RepositorySnapshot,
} from "./contracts";
import { resolveRepositoryRoot } from "./config";
import { runProcess } from "../process/process-runner";

function parseBranch(raw: string) {
  const first = raw.split(/\r?\n/)[0]?.replace(/^##\s*/, "") ?? "unknown";
  const [branchPart, upstreamPart] = first.split("...");
  return {
    branch: branchPart.trim(),
    upstream: upstreamPart?.split(/\s/)[0]?.trim() || null,
  };
}

async function packageScripts(
  root: string,
  stack: RepositoryConfig["stack"],
) {
  const file = stack === "laravel" ? "composer.json" : "package.json";
  try {
    const parsed = JSON.parse(await readFile(join(root, file), "utf8")) as {
      scripts?: Record<string, unknown>;
    };
    return Object.keys(parsed.scripts ?? {});
  } catch {
    return [];
  }
}

export async function inspectRepository(
  config: RepositoryConfig,
): Promise<RepositorySnapshot> {
  const issues: string[] = [];
  let root: string;
  try {
    root = await resolveRepositoryRoot(config);
  } catch (error) {
    return {
      id: config.id,
      stack: config.stack,
      root: "",
      head: "",
      branch: "",
      upstream: null,
      changedFiles: [],
      rules: "",
      packageScripts: [],
      available: false,
      issues: [error instanceof Error ? error.message : String(error)],
    };
  }

  const status = await runProcess({
    command: "git",
    args: ["status", "--short", "--branch"],
    cwd: root,
    timeoutMs: 15_000,
  });
  if (status.exitCode !== 0) {
    issues.push(`git status failed: ${status.stderr.trim()}`);
  }
  const headResult = await runProcess({
    command: "git",
    args: ["rev-parse", "HEAD"],
    cwd: root,
    timeoutMs: 15_000,
  });
  if (headResult.exitCode !== 0) {
    issues.push(`git rev-parse failed: ${headResult.stderr.trim()}`);
  }
  const branch = parseBranch(status.stdout);
  const changedFiles = status.stdout
    .split(/\r?\n/)
    .slice(1)
    .filter(Boolean)
    .map((line) => line.slice(3).trim());
  let rules = "";
  try {
    rules = (await readFile(join(root, config.rulesFile), "utf8")).slice(
      0,
      12_000,
    );
  } catch {
    issues.push(`${config.rulesFile} not found in ${basename(root)}`);
  }

  return {
    id: config.id,
    stack: config.stack,
    root,
    head: headResult.stdout.trim(),
    branch: branch.branch,
    upstream: branch.upstream,
    changedFiles,
    rules,
    packageScripts: await packageScripts(root, config.stack),
    available: status.exitCode === 0,
    issues,
  };
}
