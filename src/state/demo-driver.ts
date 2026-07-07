import type {
  CriticVerdict,
  DispatchPlan,
  NodeDescriptor,
  PlannedUnit,
  RunEvent,
} from "./bridge-types";

/**
 * 브라우저 개발 모드(npm run dev)에서 Electron 없이 UI를 구동하기 위한
 * 결정론적 이벤트 시뮬레이터. 실제 엔진의 이벤트 시퀀스를 그대로 흉내낸다.
 * UI 컴포넌트는 이 드라이버와 실제 엔진을 구분할 수 없어야 한다.
 */
export function createDemoDriver(emit: (event: RunEvent) => void) {
  let runCounter = 0;

  function now() {
    return new Date().toISOString();
  }

  function makePlan(command: string): DispatchPlan {
    const units: PlannedUnit[] = [
      {
        id: "context",
        title: "관련 업무 맥락 컴파일",
        role: "context-curator",
        dependsOn: [],
        expectedOutput: "맥락 요약",
        tokenBudget: 3000,
        risk: "low",
        requiresApproval: false,
        verification: [],
        tier: "economy",
        model: "demo-mini",
        critics: [],
      },
      {
        id: "research",
        title: "시장/근거 조사",
        role: "researcher",
        dependsOn: ["context"],
        expectedOutput: "조사 요약",
        tokenBudget: 4000,
        risk: "low",
        requiresApproval: false,
        verification: [],
        tier: "economy",
        model: "demo-mini",
        critics: ["user"],
      },
      {
        id: "plan",
        title: "기획안 작성",
        role: "planner",
        dependsOn: ["context"],
        expectedOutput: "기획서",
        tokenBudget: 6000,
        risk: "medium",
        requiresApproval: false,
        verification: [],
        tier: "standard",
        model: "demo-sonnet",
        critics: ["executive", "user", "cfo"],
      },
      {
        id: "develop",
        title: "기술 설계",
        role: "developer",
        dependsOn: ["plan"],
        expectedOutput: "기술 설계서",
        tokenBudget: 8000,
        risk: "medium",
        requiresApproval: false,
        verification: [],
        tier: "standard",
        model: "demo-sonnet",
        critics: ["cto"],
      },
      {
        id: "report",
        title: "결과 보고",
        role: "reporter",
        dependsOn: ["research", "develop"],
        expectedOutput: "최종 보고",
        tokenBudget: 1500,
        risk: "low",
        requiresApproval: false,
        verification: [],
        tier: "economy",
        model: "demo-mini",
        critics: [],
      },
    ];
    return {
      task: {
        id: `demo-${runCounter}`,
        objective: command,
        category: "mixed",
        projectHints: [],
        risk: "medium",
        complexity: 0.55,
        expectedInputTokens: 9000,
        expectedOutputTokens: 4000,
        requiresTools: false,
        deterministicCheckAvailable: false,
        privacy: "cloud-allowed",
        attempt: 0,
      },
      strategy: "role-separated",
      contextBudget: 9000,
      units,
      approvalReasons: [],
      estimatedTokens: 32000,
      estimatedCostUsd: 0.18,
    };
  }

  const executorNames: Record<string, string> = {
    "context-curator": "맥락냥",
    researcher: "리서치냥",
    planner: "기획냥",
    developer: "코드냥",
    reporter: "보고냥",
  };
  const criticNames: Record<string, string> = {
    executive: "임원냥",
    user: "유저냥",
    cfo: "CFO냥",
    cto: "CTO냥",
  };

  function run(command: string) {
    runCounter += 1;
    const runId = `demo-run-${runCounter}`;
    const plan = makePlan(command);
    let clock = 0;
    const schedule = (delayMs: number, event: () => RunEvent) => {
      clock += delayMs;
      setTimeout(() => emit(event()), clock);
    };

    schedule(0, () => ({ type: "run:started", runId, command, at: now() }));
    schedule(200, () => ({
      type: "node:spawned",
      runId,
      node: {
        id: `orchestrator:${runId}`,
        kind: "orchestrator",
        role: "coordinator",
        title: "총괄냥",
        tier: "local",
      },
      at: now(),
    }));
    schedule(300, () => ({ type: "run:planned", runId, plan, at: now() }));

    const finishedAt = new Map<string, number>();
    for (const unit of plan.units) {
      const dependencyDone = Math.max(
        0,
        ...unit.dependsOn.map((dependency) => finishedAt.get(dependency) ?? 0),
      );
      const start = Math.max(clock, dependencyDone) + 400;
      const workMs = 1_800 + unit.tokenBudget / 4;
      const node: NodeDescriptor = {
        id: `${unit.id}:demo`,
        kind: "executor",
        role: unit.role,
        title: executorNames[unit.role] ?? unit.role,
        tier: unit.tier,
        workUnitId: unit.id,
      };

      setTimeout(
        () => emit({ type: "node:spawned", runId, node, at: now() }),
        start,
      );
      setTimeout(
        () =>
          emit({
            type: "node:working",
            runId,
            nodeId: node.id,
            detail: unit.title,
            at: now(),
          }),
        start + 200,
      );
      setTimeout(
        () =>
          emit({
            type: "token:used",
            runId,
            nodeId: node.id,
            tier: unit.tier,
            model: unit.model,
            provider: "demo",
            usage: {
              inputTokens: Math.round(unit.tokenBudget * 0.7),
              outputTokens: Math.round(unit.tokenBudget * 0.35),
              costUsd: unit.tokenBudget / 400_000,
            },
            at: now(),
          }),
        start + workMs * 0.7,
      );

      let criticEnd = start + workMs;
      unit.critics.forEach((persona, index) => {
        const criticStart = start + workMs + index * 150;
        const criticNode: NodeDescriptor = {
          id: `${unit.id}:critic:${persona}`,
          kind: "critic",
          role: "verifier",
          persona,
          title: criticNames[persona] ?? persona,
          tier: "economy",
          workUnitId: unit.id,
        };
        setTimeout(
          () =>
            emit({ type: "node:spawned", runId, node: criticNode, at: now() }),
          criticStart,
        );
        setTimeout(
          () =>
            emit({
              type: "node:working",
              runId,
              nodeId: criticNode.id,
              detail: `${unit.title} 검토`,
              at: now(),
            }),
          criticStart + 100,
        );
        const verdict: CriticVerdict = {
          persona,
          score: 70 + ((runCounter + index * 7) % 25),
          verdict: "approve",
          issues: index === 0 ? ["근거 보강 여지"] : [],
          mustFix: [],
        };
        const verdictAt = criticStart + 900;
        setTimeout(() => {
          emit({
            type: "critic:verdict",
            runId,
            nodeId: criticNode.id,
            workUnitId: unit.id,
            verdict,
            at: now(),
          });
          emit({
            type: "node:done",
            runId,
            nodeId: criticNode.id,
            summary: `승인 (${verdict.score}점)`,
            usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
            at: now(),
          });
        }, verdictAt);
        criticEnd = Math.max(criticEnd, verdictAt + 100);
      });

      setTimeout(
        () =>
          emit({
            type: "node:done",
            runId,
            nodeId: node.id,
            summary: `${unit.title} 완료`,
            usage: {
              inputTokens: Math.round(unit.tokenBudget * 0.7),
              outputTokens: Math.round(unit.tokenBudget * 0.35),
              costUsd: unit.tokenBudget / 400_000,
            },
            at: now(),
          }),
        criticEnd + 200,
      );
      finishedAt.set(unit.id, criticEnd + 300);
    }

    const allDone = Math.max(...finishedAt.values()) + 500;
    setTimeout(() => {
      emit({
        type: "run:completed",
        runId,
        report: {
          runId,
          command,
          status: "completed",
          summary: `"${command}" 처리 완료 — ${plan.units.length}개 작업, 모든 검토 통과`,
          deliverables: plan.units.map((unit) => ({
            unitId: unit.id,
            title: unit.title,
            deliverable: `# ${unit.title}\n\n(데모 산출물)`,
          })),
          verdicts: [],
          totalUsage: {
            inputTokens: 15_800,
            outputTokens: 7_900,
            costUsd: 0.056,
          },
          startedAt: now(),
          finishedAt: now(),
        },
        at: now(),
      });
    }, allDone);
  }

  function resolveApproval(requestId: string, approved: boolean) {
    emit({
      type: "approval:resolved",
      runId: "demo",
      requestId,
      approved,
      at: now(),
    });
  }

  return { run, resolveApproval };
}
