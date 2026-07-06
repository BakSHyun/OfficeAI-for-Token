import { access, readFile } from "node:fs/promises";
import { resolveConfiguredPath } from "../config/path";
import type {
  PlatformKey,
  RepositoryConfig,
  RepositoryConfigFile,
} from "./contracts";

export async function loadRepositoryConfig(
  path: string,
): Promise<RepositoryConfigFile> {
  const parsed = JSON.parse(await readFile(path, "utf8")) as
    Partial<RepositoryConfigFile>;
  if (!Array.isArray(parsed.repositories)) {
    throw new Error("Invalid repository config.");
  }
  return { repositories: parsed.repositories };
}

async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function resolveRepositoryRoot(
  repository: RepositoryConfig,
  platform = process.platform as PlatformKey,
  environment: NodeJS.ProcessEnv = process.env,
) {
  const configured = environment[repository.rootEnv];
  if (configured) {
    const expanded = resolveConfiguredPath(configured, environment);
    if (!(await exists(expanded))) {
      throw new Error(
        `${repository.rootEnv} points to a missing path: ${expanded}`,
      );
    }
    return expanded;
  }

  const candidates = repository.pathCandidates[platform] ?? [];
  for (const candidate of candidates) {
    const expanded = resolveConfiguredPath(candidate, environment);
    if (await exists(expanded)) return expanded;
  }

  throw new Error(
    `Repository ${repository.id} not found. Set ${repository.rootEnv}.`,
  );
}
