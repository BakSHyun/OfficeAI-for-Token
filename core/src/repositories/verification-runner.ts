import type {
  CommandResult,
  VerificationPlan,
} from "./contracts";
import { runProcess } from "../process/process-runner";

export async function runVerification(
  plan: VerificationPlan,
): Promise<CommandResult[]> {
  const results: CommandResult[] = [];

  for (const verification of plan.commands) {
    const result = await runProcess({
      command: verification.command,
      args: verification.args,
      cwd: verification.cwd,
      timeoutMs: verification.timeoutMs,
    });
    results.push({
      commandId: verification.id,
      ...result,
    });
    if (result.exitCode !== 0 || result.timedOut) break;
  }

  return results;
}
