import type {
  ContextPack,
  RoutingDecision,
  TaskEnvelope,
  WorkPlan,
} from "../contracts";
import type {
  RepositoryBaseline,
  RepositorySnapshot,
  VerificationPlan,
} from "../repositories/contracts";

export function buildDevelopmentPrompt(options: {
  task: TaskEnvelope;
  plan: WorkPlan;
  context: ContextPack;
  repositories: RepositorySnapshot[];
  verification: VerificationPlan;
  baselines: RepositoryBaseline[];
  routing: RoutingDecision;
}) {
  const repositorySections = options.repositories
    .map(
      (repository) => `## Repository: ${repository.id}

- Root: ${repository.root}
- Branch: ${repository.branch}
- Upstream: ${repository.upstream ?? "none"}
- Existing changes: ${repository.changedFiles.length === 0 ? "none" : repository.changedFiles.join(", ")}

### Repository rules

${repository.rules}`,
    )
    .join("\n\n");
  const context = options.context.items
    .map(
      ({ event }, index) => `### [S${index + 1}] ${event.title}

- Project: ${event.project}
- Date: ${event.occurredAt}
- Source: ${event.sourceRef}
- Hash: ${event.sourceHash}

${event.summary.slice(0, 1_200)}`,
    )
    .join("\n\n");
  const units = options.plan.workUnits
    .map(
      (unit) =>
        `- ${unit.id}: ${unit.title} (${unit.role}), verify=${unit.verification.join(",")}`,
    )
    .join("\n");
  const verification = options.verification.commands
    .map(
      (item) =>
        `- ${item.repositoryId}: ${item.command} ${item.args.join(" ")} (${item.reason})`,
    )
    .join("\n");
  const baselines = options.repositories
    .map((repository) => {
      const baseline = options.baselines.find(
        (item) => item.repositoryId === repository.id,
      );
      if (!baseline) return `- ${repository.id}: missing`;
      const failed = baseline.results
        .filter((result) => result.exitCode !== 0 || result.timedOut)
        .map((result) => result.commandId);
      return `- ${repository.id}@${baseline.head.slice(0, 12)}: ${
        baseline.passed ? "passed" : `existing failures: ${failed.join(", ")}`
      }`;
    })
    .join("\n");

  return `# Development task

${options.task.objective}

## Safety and scope

- Work only inside the listed repositories.
- Preserve existing user changes.
- Read narrowly. Start with named files and source references, then use targeted rg.
- Never push, merge, deploy, send messages, change permissions, or modify production data.
- Do not read or print .env values, credentials, private keys, customer data, or unrelated logs.
- A task is not complete without verification evidence.

## Work plan

${units}

## Selected execution tier

${options.routing.selected.tier} (${options.routing.selected.id})

## Relevant local context

${context || "No prior context selected."}

${repositorySections}

## Planned verification

${verification || "Select the narrowest verification after identifying changed files."}

## Baseline verification

${baselines}

## Required final response

Return JSON matching the supplied schema. Set requires_approval=true for any action beyond local code edits and verification.`;
}
