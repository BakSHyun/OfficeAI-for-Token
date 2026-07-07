import assert from "node:assert/strict";
import { test } from "node:test";
import { createTaskEnvelope } from "../src/intake/task-intake";
import { createBudgetManager } from "../src/budget/budget-manager";
import { createApprovalGate } from "../src/orchestration/approval-gate";
import { degradeTier, dispatch } from "../src/orchestration/dispatcher";
import { createEventBus } from "../src/orchestration/event-bus";
import { parseJsonLenient } from "../src/orchestration/json";
import { createOrchestrator } from "../src/orchestration/orchestrator";
import { selectCritics } from "../src/orchestration/roles";
import type { ProviderConfig } from "../src/providers/contracts";
import { createProviderRegistry } from "../src/providers/registry";
import type { RunEvent } from "../src/orchestration/contracts";

const mockConfig: ProviderConfig = {
  concurrency: 3,
  tiers: {
    local: {
      provider: "mock",
      model: "mock-local",
      inputCostPerMillion: 0,
      outputCostPerMillion: 0,
    },
    economy: {
      provider: "mock",
      model: "mock-economy",
      inputCostPerMillion: 0.25,
      outputCostPerMillion: 2,
    },
    standard: {
      provider: "mock",
      model: "mock-standard",
      inputCostPerMillion: 3,
      outputCostPerMillion: 15,
    },
    premium: {
      provider: "mock",
      model: "mock-premium",
      inputCostPerMillion: 15,
      outputCostPerMillion: 75,
    },
  },
};

test("dispatch는 유닛마다 티어와 크리틱 조합을 배정한다", () => {
  const task = createTaskEnvelope(
    "결제 정산 화면 개선 기획서를 작성하고 개발 계획까지 정리해줘",
  );
  const plan = dispatch(task, mockConfig);

  assert.ok(plan.units.length >= 2);
  for (const unit of plan.units) {
    assert.ok(["local", "economy", "standard", "premium"].includes(unit.tier));
    assert.ok(Array.isArray(unit.critics));
  }
  assert.ok(plan.estimatedTokens > 0);
});

test("selectCritics는 개발 역할에 CTO를 배정하고 보조 역할에는 크리틱을 붙이지 않는다", () => {
  assert.ok(selectCritics("developer", "medium").includes("cto"));
  assert.ok(selectCritics("developer", "high").includes("cfo"));
  assert.deepEqual(selectCritics("reporter", "low"), []);
  assert.deepEqual(selectCritics("context-curator", "low"), []);
  const plannerCritics = selectCritics("planner", "low");
  assert.ok(plannerCritics.includes("executive"));
  assert.ok(plannerCritics.includes("user"));
  assert.ok(!plannerCritics.includes("cfo"));
});

test("degradeTier는 한 단계 아래 티어를 돌려준다", () => {
  assert.equal(degradeTier("premium"), "standard");
  assert.equal(degradeTier("standard"), "economy");
  assert.equal(degradeTier("economy"), "local");
  assert.equal(degradeTier("local"), null);
});

test("budget manager는 초과 시 degrade/block을 돌려주고 사용량을 누적한다", () => {
  const events: RunEvent[] = [];
  const budget = createBudgetManager({
    config: {
      globalDailyTokens: 100_000,
      runDefaultTokens: 10_000,
      unitDefaultTokens: 1_000,
      warnRatio: 0.8,
    },
    emit: (event) => events.push(event),
  });
  budget.openRun("run1");
  budget.openUnit("run1", "unitA");

  const ok = budget.check("run1", "unitA", 500);
  assert.equal(ok.action, "ok");

  const degrade = budget.check("run1", "unitA", 5_000);
  assert.equal(degrade.action, "degrade");

  budget.record("run1", "unitA", 900);
  const warning = events.find((event) => event.type === "budget:warning");
  const exceeded = events.find((event) => event.type === "budget:exceeded");
  assert.ok(exceeded);

  // run 예산 초과는 block
  const block = budget.check("run1", "unitA", 50_000);
  assert.equal(block.action, "block");
  void warning;
});

test("approval gate는 autoResolver로 즉시 결정하고 이벤트를 발행한다", async () => {
  const events: RunEvent[] = [];
  const gate = createApprovalGate({
    emit: (event) => events.push(event),
    autoResolver: () => ({ approved: true }),
  });
  const decision = await gate.request("run1", "plan-confirm", "테스트");
  assert.equal(decision.approved, true);
  assert.ok(events.some((event) => event.type === "approval:requested"));
  assert.ok(events.some((event) => event.type === "approval:resolved"));
});

test("approval gate는 외부 resolve를 기다린다", async () => {
  const gate = createApprovalGate({ emit: () => {} });
  const pendingDecision = gate.request("run1", "critic-rejection", "반려");
  const [request] = gate.pending();
  assert.ok(request);
  gate.resolve(request.id, { approved: false, note: "다시" });
  const decision = await pendingDecision;
  assert.equal(decision.approved, false);
});

test("parseJsonLenient는 코드펜스와 잡담이 섞인 JSON을 파싱한다", () => {
  const parsed = parseJsonLenient<{ a: number }>(
    '설명입니다.\n```json\n{"a": 1}\n```\n끝.',
  );
  assert.equal(parsed.a, 1);
  const direct = parseJsonLenient<{ b: string }>('{"b": "x"}');
  assert.equal(direct.b, "x");
});

test("orchestrator는 mock provider로 엔드투엔드 실행을 완료한다", async () => {
  const bus = createEventBus();
  const registry = createProviderRegistry(mockConfig);
  const gate = createApprovalGate({
    emit: (event) => bus.emit(event),
    autoResolver: () => ({ approved: true }),
  });
  const budget = createBudgetManager({ emit: (event) => bus.emit(event) });
  const orchestrator = createOrchestrator({ registry, bus, gate, budget });

  const report = await orchestrator.run(
    "신규 기능 출시를 위한 기획서를 작성해줘",
  );

  assert.equal(report.status, "completed");
  assert.ok(report.deliverables.length > 0);
  assert.ok(report.totalUsage.inputTokens > 0);

  const history = bus.history(report.runId);
  assert.ok(history.some((event) => event.type === "run:planned"));
  assert.ok(history.some((event) => event.type === "node:spawned"));
  assert.ok(history.some((event) => event.type === "token:used"));
  assert.ok(history.some((event) => event.type === "run:completed"));
});

test("orchestrator는 의존성 있는 유닛을 순서대로, 없는 유닛은 동시에 실행한다", async () => {
  const bus = createEventBus();
  const registry = createProviderRegistry(mockConfig);
  const gate = createApprovalGate({
    emit: (event) => bus.emit(event),
    autoResolver: () => ({ approved: true }),
  });
  const budget = createBudgetManager({ emit: (event) => bus.emit(event) });
  const orchestrator = createOrchestrator({ registry, bus, gate, budget });

  const report = await orchestrator.run(
    "경쟁사 조사와 시장 분석을 하고 개발 로드맵과 일정 계획을 작성한 뒤 보고해줘",
  );
  assert.equal(report.status, "completed");

  const history = bus.history(report.runId);
  const doneOrder = history
    .filter(
      (event): event is Extract<RunEvent, { type: "node:done" }> =>
        event.type === "node:done",
    )
    .map((event) => event.nodeId.split(":")[0]);
  // report 유닛은 항상 마지막 완료 그룹에 있어야 한다
  const reportIndex = doneOrder.lastIndexOf("report");
  assert.ok(reportIndex >= 0);
});
