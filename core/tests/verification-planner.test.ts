import assert from "node:assert/strict";
import test from "node:test";
import type { RepositorySnapshot } from "../src/repositories/contracts";
import { planVerification } from "../src/repositories/verification-planner";

function repository(
  overrides: Partial<RepositorySnapshot>,
): RepositorySnapshot {
  return {
    id: "repo",
    stack: "laravel",
    root: "/repo",
    head: "abc123",
    branch: "main",
    upstream: "origin/main",
    changedFiles: [],
    rules: "",
    packageScripts: [],
    available: true,
    issues: [],
    ...overrides,
  };
}

test("uses PHP syntax and targeted tests for backend changes", () => {
  const plan = planVerification([
    repository({
      id: "gtsn-backend",
      changedFiles: [
        "app/Services/PaymentService.php",
        "tests/Unit/PaymentServiceTest.php",
      ],
    }),
  ]);

  assert.equal(plan.commands.length, 3);
  assert.ok(plan.commands.some(({ args }) => args[0] === "-l"));
  assert.ok(
    plan.commands.some(({ args }) => args.includes("tests/Unit/PaymentServiceTest.php")),
  );
});

test("runs lint and build for admin TypeScript changes", () => {
  const plan = planVerification([
    repository({
      id: "gtsn-admin",
      stack: "vite-react",
      changedFiles: ["src/pages/FinancePage.tsx"],
    }),
  ]);

  assert.deepEqual(
    plan.commands.map(({ args }) => args.join(" ")),
    ["run lint", "run build"],
  );
});
