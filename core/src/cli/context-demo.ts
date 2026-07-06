import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { WorkEvent } from "../contracts";
import { buildContextPack } from "../context/context-pack";

const args = process.argv.slice(2);
const inlineBudget = args.find((value) => value.startsWith("--budget="));
const budgetIndex = args.indexOf("--budget");
const trailingBudgetIndex =
  budgetIndex < 0 &&
  !inlineBudget &&
  args.length > 1 &&
  /^\d+$/.test(args.at(-1) ?? "")
    ? args.length - 1
    : -1;
const budgetValue = inlineBudget?.split("=")[1]
  ?? (budgetIndex >= 0 ? args[budgetIndex + 1] : undefined)
  ?? (trailingBudgetIndex >= 0 ? args[trailingBudgetIndex] : undefined);
const budget = budgetValue ? Number(budgetValue) : 3_000;
const excluded = new Set<number>();
if (budgetIndex >= 0) {
  excluded.add(budgetIndex);
  excluded.add(budgetIndex + 1);
}
if (trailingBudgetIndex >= 0) excluded.add(trailingBudgetIndex);
const query =
  args
    .filter(
      (value, index) =>
        !excluded.has(index) && !value.startsWith("--budget="),
    )
    .join(" ")
    .trim() || "최근 진행 중인 업무와 다음 우선순위";

const raw = await readFile(
  resolve(".officeai/work-events.jsonl"),
  "utf8",
);
const events = raw
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line) as WorkEvent);
const pack = buildContextPack(query, events, budget);

console.log(
  JSON.stringify(
    {
      query: pack.query,
      tokenBudget: pack.tokenBudget,
      estimatedTokens: pack.estimatedTokens,
      selectedEvents: pack.items.length,
      items: pack.items.slice(0, 15).map((item) => ({
        score: Number(item.score.toFixed(3)),
        tokens: item.estimatedTokens,
        project: item.event.project,
        title: item.event.title,
        occurredAt: item.event.occurredAt,
        sourceRef: item.event.sourceRef,
      })),
    },
    null,
    2,
  ),
);
