export type RepositoryStack = "laravel" | "vite-react";

export type PlatformKey = "win32" | "darwin" | "linux";

export type RepositoryConfig = {
  id: string;
  stack: RepositoryStack;
  rootEnv: string;
  pathCandidates: Record<PlatformKey, string[]>;
  rulesFile: string;
};

export type RepositoryConfigFile = {
  repositories: RepositoryConfig[];
};

export type RepositorySnapshot = {
  id: string;
  stack: RepositoryStack;
  root: string;
  head: string;
  branch: string;
  upstream: string | null;
  changedFiles: string[];
  rules: string;
  packageScripts: string[];
  available: boolean;
  issues: string[];
};

export type VerificationCommand = {
  id: string;
  repositoryId: string;
  label: string;
  command: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  reason: string;
};

export type VerificationPlan = {
  commands: VerificationCommand[];
  manualChecks: string[];
};

export type CommandResult = {
  commandId: string;
  exitCode: number | null;
  durationMs: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

export type RepositoryBaseline = {
  repositoryId: string;
  head: string;
  createdAt: string;
  verification: VerificationPlan;
  results: CommandResult[];
  passed: boolean;
};
