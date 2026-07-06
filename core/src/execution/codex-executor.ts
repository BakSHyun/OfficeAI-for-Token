import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ModelTier, TaskEnvelope } from "../contracts";
import type { RepositorySnapshot } from "../repositories/contracts";
import { runProcess } from "../process/process-runner";

type CodexMode = "plan" | "apply";

function tierBinding(tier: ModelTier, environment = process.env) {
  const suffix = tier.toLocaleUpperCase().replaceAll("-", "_");
  return {
    model: environment[`OFFICEAI_CODEX_MODEL_${suffix}`],
    profile: environment[`OFFICEAI_CODEX_PROFILE_${suffix}`],
  };
}

export function codexBindingStatus(environment = process.env) {
  return (["local", "economy", "standard", "premium"] as ModelTier[]).map(
    (tier) => {
      const binding = tierBinding(tier, environment);
      return {
        tier,
        configured: Boolean(binding.model || binding.profile),
        binding: binding.profile
          ? `profile:${binding.profile}`
          : binding.model
            ? `model:${binding.model}`
            : null,
      };
    },
  );
}

export async function executeWithCodex(options: {
  mode: CodexMode;
  tier: ModelTier;
  task: TaskEnvelope;
  repositories: RepositorySnapshot[];
  prompt: string;
  runDirectory: string;
}) {
  if (options.mode === "apply" && process.env.OFFICEAI_ALLOW_APPLY !== "1") {
    throw new Error(
      "Apply is locked. Set OFFICEAI_ALLOW_APPLY=1 for this invocation.",
    );
  }
  const binding = tierBinding(options.tier);
  if (!binding.model && !binding.profile) {
    throw new Error(
      `No Codex binding for ${options.tier}. Set OFFICEAI_CODEX_MODEL_${options.tier.toUpperCase()} or OFFICEAI_CODEX_PROFILE_${options.tier.toUpperCase()}.`,
    );
  }
  const available = options.repositories.filter(
    (repository) => repository.available,
  );
  if (available.length === 0) throw new Error("No repository is available.");

  await mkdir(options.runDirectory, { recursive: true });
  const outputPath = join(options.runDirectory, "codex-result.json");
  const args = [
    "exec",
    "-C",
    available[0].root,
    "--ephemeral",
    "--json",
    "--output-schema",
    join(process.cwd(), "schemas", "codex-dev-result.schema.json"),
    "-o",
    outputPath,
    "-s",
    options.mode === "apply" ? "workspace-write" : "read-only",
  ];
  for (const repository of available.slice(1)) {
    args.push("--add-dir", repository.root);
  }
  if (binding.profile) args.push("-p", binding.profile);
  if (binding.model) args.push("-m", binding.model);
  args.push("-");

  const result = await runProcess({
    command: "codex",
    args,
    cwd: available[0].root,
    timeoutMs: 30 * 60 * 1_000,
    stdin: options.prompt,
    maxOutputBytes: 200_000,
  });
  await writeFile(
    join(options.runDirectory, "codex-events.jsonl"),
    result.stdout,
    "utf8",
  );
  return { ...result, outputPath };
}
