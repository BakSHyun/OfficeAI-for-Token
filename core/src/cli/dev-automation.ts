import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  codexBindingStatus,
  executeWithCodex,
} from "../execution/codex-executor";
import { createBaseline } from "../repositories/baseline";
import { prepareDevelopmentAutomation } from "../development/automation";
import { loadRepositoryConfig } from "../repositories/config";
import { inspectRepository } from "../repositories/inspector";
import { planVerification } from "../repositories/verification-planner";
import { runVerification } from "../repositories/verification-runner";
import { probeToolchain } from "../repositories/toolchain-probe";

const [mode = "probe", ...rest] = process.argv.slice(2);
const command =
  rest.join(" ").trim() ||
  "현재 개발 작업을 파악하고 다음 안전한 변경 계획을 작성한다.";

if (mode === "probe") {
  const config = await loadRepositoryConfig(
    resolve("config/repositories.local.json"),
  );
  const repositories = await Promise.all(
    config.repositories.map(inspectRepository),
  );
  const toolchains = Object.fromEntries(
    await Promise.all(
      repositories.map(async (repository) => [
        repository.id,
        await probeToolchain(repository),
      ]),
    ),
  );
  console.log(
    JSON.stringify(
      {
        platform: process.platform,
        repositories: repositories.map((repository) => ({
          id: repository.id,
          stack: repository.stack,
          root: repository.root,
          branch: repository.branch,
          upstream: repository.upstream,
          changedFiles: repository.changedFiles,
          rulesLoaded: repository.rules.length > 0,
          packageScripts: repository.packageScripts,
          available: repository.available,
          issues: repository.issues,
        })),
        toolchains,
        codexBindings: codexBindingStatus(),
      },
      null,
      2,
    ),
  );
} else if (mode === "prepare") {
  const prepared = await prepareDevelopmentAutomation(command);
  console.log(
    JSON.stringify(
      {
        task: prepared.task,
        selectedModelTier: prepared.routing.selected.tier,
        context: {
          tokenBudget: prepared.context.tokenBudget,
          estimatedTokens: prepared.context.estimatedTokens,
          citationCount: prepared.context.citations.length,
          sourceRefs: prepared.context.citations
            .slice(0, 12)
            .map(({ sourceRef }) => sourceRef),
        },
        repositories: prepared.repositories.map((repository) => ({
          id: repository.id,
          root: repository.root,
          branch: repository.branch,
          changedFiles: repository.changedFiles,
          issues: repository.issues,
        })),
        baselines: prepared.repositories.map((repository) => {
          const baseline = prepared.baselines.find(
            (item) => item.repositoryId === repository.id,
          );
          return {
            repositoryId: repository.id,
            found: Boolean(baseline),
            passed: baseline?.passed ?? null,
            head: baseline?.head ?? null,
          };
        }),
        verification: prepared.verification,
        runDirectory: prepared.runDirectory,
      },
      null,
      2,
    ),
  );
} else if (mode === "plan" || mode === "apply") {
  const prepared = await prepareDevelopmentAutomation(command);
  if (
    mode === "apply" &&
    prepared.repositories.some(
      (repository) =>
        !prepared.baselines.some(
          (baseline) =>
            baseline.repositoryId === repository.id &&
            baseline.head === repository.head,
        ),
    )
  ) {
    throw new Error(
      "Apply requires a baseline for every repository. Run dev:auto -- baseline first.",
    );
  }
  const result = await executeWithCodex({
    mode,
    tier: prepared.routing.selected.tier,
    task: prepared.task,
    repositories: prepared.repositories,
    prompt: prepared.prompt,
    runDirectory: prepared.runDirectory,
  });
  let verificationAfterApply = null;
  if (mode === "apply" && result.exitCode === 0 && !result.timedOut) {
    const config = await loadRepositoryConfig(
      resolve("config/repositories.local.json"),
    );
    const requested = new Set(prepared.task.projectHints);
    const repositories = await Promise.all(
      config.repositories
        .filter(
          (repository) =>
            requested.size === 0 || requested.has(repository.id),
        )
        .map(inspectRepository),
    );
    const verification = planVerification(repositories);
    const results = await runVerification(verification);
    verificationAfterApply = { verification, results };
    await writeFile(
      join(prepared.runDirectory, "verification.json"),
      JSON.stringify(verificationAfterApply, null, 2) + "\n",
      "utf8",
    );
  }
  console.log(
    JSON.stringify(
      {
        mode,
        exitCode: result.exitCode,
        timedOut: result.timedOut,
        outputPath: result.outputPath,
        runDirectory: prepared.runDirectory,
        verificationAfterApply,
      },
      null,
      2,
    ),
  );
} else if (mode === "verify") {
  const config = await loadRepositoryConfig(
    resolve("config/repositories.local.json"),
  );
  const repositories = await Promise.all(
    config.repositories.map(inspectRepository),
  );
  const verification = planVerification(repositories);
  const results = await runVerification(verification);
  console.log(JSON.stringify({ verification, results }, null, 2));
} else if (mode === "baseline") {
  const config = await loadRepositoryConfig(
    resolve("config/repositories.local.json"),
  );
  const repositories = await Promise.all(
    config.repositories.map(inspectRepository),
  );
  const baselines = [];
  for (const repository of repositories) {
    if (!repository.available) continue;
    baselines.push(
      await createBaseline(resolve(".officeai"), repository),
    );
  }
  console.log(
    JSON.stringify(
      {
        baselines: baselines.map((baseline) => ({
          repositoryId: baseline.repositoryId,
          head: baseline.head,
          passed: baseline.passed,
          commands: baseline.results.map((result) => ({
            id: result.commandId,
            exitCode: result.exitCode,
            timedOut: result.timedOut,
          })),
        })),
      },
      null,
      2,
    ),
  );
} else {
  throw new Error(`Unknown mode: ${mode}`);
}
