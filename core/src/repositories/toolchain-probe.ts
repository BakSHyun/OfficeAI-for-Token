import type { RepositorySnapshot } from "./contracts";
import { runProcess } from "../process/process-runner";

export async function probeToolchain(repository: RepositorySnapshot) {
  if (!repository.available) return [];
  const commands =
    repository.stack === "laravel"
      ? [
          { command: "php", args: ["--version"] },
          { command: "composer", args: ["--version"] },
          { command: "php", args: ["artisan", "--version"] },
        ]
      : [
          { command: "node", args: ["--version"] },
          { command: "npm", args: ["--version"] },
        ];

  const results = [];
  for (const item of commands) {
    const result = await runProcess({
      ...item,
      cwd: repository.root,
      timeoutMs: 30_000,
      maxOutputBytes: 2_000,
    });
    results.push({
      command: `${item.command} ${item.args.join(" ")}`,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      version:
        result.stdout.split(/\r?\n/).find(Boolean)?.trim() ??
        result.stderr.split(/\r?\n/).find(Boolean)?.trim() ??
        "",
    });
  }
  return results;
}
