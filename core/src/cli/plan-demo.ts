import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { WorkProfile } from "../memory/work-profile";
import { createTaskEnvelope } from "../intake/task-intake";
import { planWork } from "../planning/recipe-planner";
import {
  exampleModelRegistry,
  routeModel,
} from "../routing/model-router";

const command =
  process.argv.slice(2).join(" ").trim() ||
  "최근 KCP 결제 작업을 파악하고 다음 개발 계획을 작성해줘";
const profile = JSON.parse(
  await readFile(resolve(".officeai/work-profile.json"), "utf8"),
) as WorkProfile;
const task = createTaskEnvelope(command, profile);
const plan = planWork(task);
const routing = plan.workUnits.map((workUnit) => {
  const category =
    workUnit.role === "developer"
      ? "development"
      : workUnit.role === "operator"
        ? "operations"
        : workUnit.role === "pm" || workUnit.role === "reporter"
          ? "pm"
          : workUnit.role === "researcher" ||
              workUnit.role === "context-curator" ||
              workUnit.role === "verifier" ||
              workUnit.role === "skeptic"
            ? "research"
            : "planning";
  const workTask = {
    ...task,
    id: `${task.id}:${workUnit.id}`,
    objective: workUnit.title,
    category,
    complexity:
      workUnit.id === "context" || workUnit.id === "report"
        ? Math.min(0.25, task.complexity)
        : workUnit.id === "verify"
          ? Math.min(1, task.complexity + 0.15)
          : task.complexity,
    risk: workUnit.risk,
    expectedInputTokens:
      workUnit.id === "context"
        ? plan.contextBudget
        : Math.min(task.expectedInputTokens, workUnit.tokenBudget * 2),
    expectedOutputTokens: workUnit.tokenBudget,
    deterministicCheckAvailable: workUnit.verification.some((check) =>
      /schema|lint|typecheck|test|scope|evidence-links|source-hash|token-budget/.test(
        check,
      ),
    ),
  };
  const decision = routeModel(workTask, exampleModelRegistry);
  return {
    workUnit: workUnit.id,
    role: workUnit.role,
    selectedModel: decision.selected.id,
    selectedTier: decision.selected.tier,
  };
});

console.log(JSON.stringify({ task, plan, routing }, null, 2));
