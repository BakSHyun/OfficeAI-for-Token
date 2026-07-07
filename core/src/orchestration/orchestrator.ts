import { randomUUID } from "node:crypto";
import type { ModelTier, TaskEnvelope, WorkEvent } from "../contracts";
import { buildContextPack } from "../context/context-pack";
import { estimateTokens } from "../context/token-estimator";
import { createTaskEnvelope } from "../intake/task-intake";
import type { WorkProfile } from "../memory/work-profile";
import type { LLMMessage } from "../providers/contracts";
import { LLMAuthError } from "../providers/retry";
import type { ProviderRegistry } from "../providers/registry";
import type { BudgetManager } from "../budget/budget-manager";
import type { ApprovalGate } from "./approval-gate";
import type {
  CriticPersona,
  CriticVerdict,
  DispatchPlan,
  LLMUsage,
  NodeDescriptor,
  PlannedUnit,
  RunReport,
  UnitOutput,
} from "./contracts";
import { degradeTier, dispatch } from "./dispatcher";
import type { EventBus } from "./event-bus";
import { parseJsonLenient } from "./json";
import {
  criticNames,
  criticPrompts,
  criticVerdictSchema,
  executorNames,
  executorPrompts,
  unitOutputSchema,
} from "./roles";

export type OrchestratorOptions = {
  registry: ProviderRegistry;
  bus: EventBus;
  gate: ApprovalGate;
  budget: BudgetManager;
  workEvents?: WorkEvent[];
  profile?: WorkProfile;
  /** true면 실행 전 계획 승인을 사용자에게 요청 */
  confirmPlan?: boolean;
  maxReworks?: number;
};

export type Orchestrator = {
  run(command: string): Promise<RunReport>;
  cancel(runId: string): void;
};

const CRITIC_APPROVE_SCORE = 65;

function now() {
  return new Date().toISOString();
}

function emptyUsage(): LLMUsage {
  return { inputTokens: 0, outputTokens: 0, costUsd: 0 };
}

function addUsage(total: LLMUsage, delta: LLMUsage) {
  total.inputTokens += delta.inputTokens;
  total.outputTokens += delta.outputTokens;
  total.costUsd += delta.costUsd;
}

function truncate(text: string, maxCharacters: number) {
  if (text.length <= maxCharacters) return text;
  return `${text.slice(0, maxCharacters)}\n…(이하 생략, 원문 ${text.length}자)`;
}

export function createOrchestrator(
  options: OrchestratorOptions,
): Orchestrator {
  const { registry, bus, gate, budget } = options;
  const maxReworks = options.maxReworks ?? 1;
  const cancelled = new Set<string>();

  async function callLLM(input: {
    runId: string;
    node: NodeDescriptor;
    unitId: string;
    tier: ModelTier;
    messages: LLMMessage[];
    maxOutputTokens: number;
    jsonSchema?: { name: string; schema: Record<string, unknown> };
  }): Promise<{ text: string; usage: LLMUsage; tier: ModelTier }> {
    let tier = input.tier;
    const estimatedInput = estimateTokens(
      input.messages.map((message) => message.content).join("\n"),
    );

    // 실행 전 예산 게이트: 초과 시 티어 강등 → 사용자 에스컬레이션 순서로 대응
    for (;;) {
      const check = budget.check(
        input.runId,
        input.unitId,
        estimatedInput + input.maxOutputTokens,
      );
      if (check.action === "ok") break;
      if (check.action === "degrade") {
        const lower = degradeTier(tier);
        if (lower) {
          tier = lower;
          bus.emit({
            type: "node:working",
            runId: input.runId,
            nodeId: input.node.id,
            detail: `예산 보호를 위해 ${input.tier} → ${tier} 티어로 강등`,
            at: now(),
          });
          break;
        }
      }
      bus.emit({
        type: "node:blocked",
        runId: input.runId,
        nodeId: input.node.id,
        reason: check.reason,
        at: now(),
      });
      const decision = await gate.request(
        input.runId,
        "budget-escalation",
        check.reason,
        { unitId: input.unitId, estimatedTokens: estimatedInput },
      );
      if (!decision.approved) {
        throw new Error(`예산 초과로 중단됨: ${check.reason}`);
      }
      budget.extendRun(input.runId, estimatedInput + input.maxOutputTokens * 2);
      break;
    }

    const { provider, binding } = registry.resolveTier(tier);
    let response;
    try {
      response = await provider.complete({
        tier,
        model: binding.model,
        messages: input.messages,
        maxOutputTokens: input.maxOutputTokens,
        jsonSchema: input.jsonSchema,
      });
    } catch (error) {
      if (error instanceof LLMAuthError) {
        bus.emit({
          type: "node:blocked",
          runId: input.runId,
          nodeId: input.node.id,
          reason: error.message,
          at: now(),
        });
        await gate.request(
          input.runId,
          "budget-escalation",
          `LLM API 설정 오류 — 키와 provider 설정을 확인하세요. ${error.message}`,
          { unitId: input.unitId, tier },
        );
      }
      throw error;
    }
    const usage: LLMUsage = {
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      costUsd: registry.costUsd(tier, response.usage),
    };
    budget.record(
      input.runId,
      input.unitId,
      usage.inputTokens + usage.outputTokens,
    );
    bus.emit({
      type: "token:used",
      runId: input.runId,
      nodeId: input.node.id,
      tier,
      model: response.model,
      provider: response.provider,
      usage,
      at: now(),
    });
    return { text: response.text, usage, tier };
  }

  async function reviewWithCritics(input: {
    runId: string;
    unit: PlannedUnit;
    deliverable: string;
    objective: string;
    totalUsage: LLMUsage;
  }): Promise<CriticVerdict[]> {
    const reviews = input.unit.critics.map(async (persona: CriticPersona) => {
      const node: NodeDescriptor = {
        id: `${input.unit.id}:critic:${persona}:${randomUUID().slice(0, 8)}`,
        kind: "critic",
        role: "verifier",
        persona,
        title: criticNames[persona],
        tier: "economy",
        workUnitId: input.unit.id,
      };
      bus.emit({ type: "node:spawned", runId: input.runId, node, at: now() });
      bus.emit({
        type: "node:working",
        runId: input.runId,
        nodeId: node.id,
        detail: `${input.unit.title} 산출물 검토`,
        at: now(),
      });
      try {
        const result = await callLLM({
          runId: input.runId,
          node,
          unitId: input.unit.id,
          tier: "economy",
          maxOutputTokens: 700,
          jsonSchema: criticVerdictSchema,
          messages: [
            { role: "system", content: criticPrompts[persona] },
            {
              role: "user",
              content: `업무 목표: ${input.objective}\n\n검토 대상 산출물:\n${truncate(input.deliverable, 6_000)}\n\nJSON으로 평가를 출력하라.`,
            },
          ],
        });
        addUsage(input.totalUsage, result.usage);
        const parsed = parseJsonLenient<Omit<CriticVerdict, "persona">>(
          result.text,
        );
        const verdict: CriticVerdict = {
          persona,
          score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
          verdict:
            parsed.verdict === "revise" ||
            (Number(parsed.score) || 0) < CRITIC_APPROVE_SCORE
              ? "revise"
              : "approve",
          issues: Array.isArray(parsed.issues) ? parsed.issues : [],
          mustFix: Array.isArray(parsed.mustFix) ? parsed.mustFix : [],
        };
        bus.emit({
          type: "critic:verdict",
          runId: input.runId,
          nodeId: node.id,
          workUnitId: input.unit.id,
          verdict,
          at: now(),
        });
        bus.emit({
          type: "node:done",
          runId: input.runId,
          nodeId: node.id,
          summary: `${verdict.verdict === "approve" ? "승인" : "반려"} (${verdict.score}점)`,
          usage: emptyUsage(),
          at: now(),
        });
        return verdict;
      } catch (error) {
        bus.emit({
          type: "node:failed",
          runId: input.runId,
          nodeId: node.id,
          error: error instanceof Error ? error.message : String(error),
          at: now(),
        });
        // 크리틱 실패는 파이프라인을 막지 않는다 (검토 생략으로 처리)
        return null;
      }
    });
    const settled = await Promise.all(reviews);
    return settled.filter((verdict): verdict is CriticVerdict => !!verdict);
  }

  async function runUnit(input: {
    runId: string;
    task: TaskEnvelope;
    unit: PlannedUnit;
    dependencies: UnitOutput[];
    contextText: string;
  }): Promise<UnitOutput> {
    const { runId, unit } = input;
    const totalUsage = emptyUsage();
    const node: NodeDescriptor = {
      id: `${unit.id}:${randomUUID().slice(0, 8)}`,
      kind: "executor",
      role: unit.role,
      title: executorNames[unit.role],
      tier: unit.tier,
      workUnitId: unit.id,
    };
    bus.emit({ type: "node:spawned", runId, node, at: now() });

    const dependencyContext = input.dependencies
      .map(
        (dependency) =>
          `### 선행 작업 [${dependency.unitId}] 결과\n${dependency.summary}\n${truncate(dependency.deliverable, 3_000)}`,
      )
      .join("\n\n");

    let feedback = "";
    let verdicts: CriticVerdict[] = [];
    let output: Omit<UnitOutput, "unitId" | "role" | "usage" | "attempts"> = {
      summary: "",
      deliverable: "",
      evidence: [],
    };

    for (let attempt = 0; attempt <= maxReworks; attempt += 1) {
      if (cancelled.has(runId)) throw new Error("사용자가 실행을 취소했습니다.");
      bus.emit({
        type: "node:working",
        runId,
        nodeId: node.id,
        detail:
          attempt === 0 ? unit.title : `${unit.title} 재작업 (${attempt}차)`,
        at: now(),
      });

      const userSections = [
        `업무 목표: ${input.task.objective}`,
        `담당 파트: ${unit.title}`,
        `기대 산출물: ${unit.expectedOutput}`,
        input.contextText
          ? `업무 맥락:\n${truncate(input.contextText, 4_000)}`
          : "",
        dependencyContext,
        feedback,
      ].filter(Boolean);

      const result = await callLLM({
        runId,
        node,
        unitId: unit.id,
        tier: unit.tier,
        maxOutputTokens: Math.max(1_000, unit.tokenBudget),
        jsonSchema: unitOutputSchema,
        messages: [
          { role: "system", content: executorPrompts[unit.role] },
          { role: "user", content: userSections.join("\n\n") },
        ],
      });
      addUsage(totalUsage, result.usage);

      try {
        const parsed = parseJsonLenient<typeof output>(result.text);
        output = {
          summary: parsed.summary || unit.title,
          deliverable:
            (typeof parsed.deliverable === "string" && parsed.deliverable.trim()) ||
            result.text.trim() ||
            "",
          evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [],
        };
      } catch {
        output = {
          summary: `${unit.title} 결과`,
          deliverable: result.text,
          evidence: [],
        };
      }

      verdicts = await reviewWithCritics({
        runId,
        unit,
        deliverable: output.deliverable,
        objective: input.task.objective,
        totalUsage,
      });
      const rejected = verdicts.filter(
        (verdict) => verdict.verdict === "revise",
      );
      if (rejected.length === 0) break;

      if (attempt < maxReworks) {
        feedback = `이전 산출물이 반려되었다. 반드시 다음을 고쳐라:\n${rejected
          .flatMap((verdict) =>
            verdict.mustFix.length > 0 ? verdict.mustFix : verdict.issues,
          )
          .map((issue) => `- ${issue}`)
          .join("\n")}`;
        continue;
      }

      // 재작업 한도 소진 → 사용자 결정으로 승격 (무한 반려 루프 방지)
      const decision = await gate.request(
        runId,
        "critic-rejection",
        `${unit.title}: 재작업 후에도 ${rejected.map((verdict) => criticNames[verdict.persona]).join(", ")} 반려`,
        {
          unitId: unit.id,
          verdicts: rejected.map((verdict) => ({
            persona: verdict.persona,
            score: verdict.score,
            issues: verdict.issues,
          })),
        },
      );
      if (!decision.approved) {
        throw new Error(`사용자가 ${unit.title} 산출물을 반려했습니다.`);
      }
    }

    const unitOutput: UnitOutput = {
      unitId: unit.id,
      role: unit.role,
      ...output,
      usage: totalUsage,
      verdicts,
      attempts: 1,
    };
    bus.emit({
      type: "node:done",
      runId,
      nodeId: node.id,
      summary: output.summary,
      usage: totalUsage,
      at: now(),
    });
    return unitOutput;
  }

  async function executeDag(input: {
    runId: string;
    plan: DispatchPlan;
    contextText: string;
  }): Promise<Map<string, UnitOutput>> {
    const { runId, plan } = input;
    const outputs = new Map<string, UnitOutput>();
    const pending = new Map(plan.units.map((unit) => [unit.id, unit]));
    const running = new Map<string, Promise<void>>();
    const concurrency = Math.max(1, registry.config.concurrency);
    let failure: Error | null = null;

    while ((pending.size > 0 || running.size > 0) && !failure) {
      if (cancelled.has(runId)) {
        throw new Error("사용자가 실행을 취소했습니다.");
      }
      const ready = [...pending.values()].filter(
        (unit) =>
          running.size < concurrency &&
          !running.has(unit.id) &&
          unit.dependsOn.every((dependency) => outputs.has(dependency)),
      );
      for (const unit of ready.slice(0, concurrency - running.size)) {
        pending.delete(unit.id);
        const job = runUnit({
          runId,
          task: plan.task,
          unit,
          dependencies: unit.dependsOn
            .map((dependency) => outputs.get(dependency))
            .filter((output): output is UnitOutput => !!output),
          contextText: input.contextText,
        })
          .then((output) => {
            outputs.set(unit.id, output);
          })
          .catch((error: unknown) => {
            failure =
              error instanceof Error ? error : new Error(String(error));
          })
          .finally(() => {
            running.delete(unit.id);
          });
        running.set(unit.id, job);
      }
      if (running.size === 0 && pending.size > 0) {
        throw new Error(
          `실행할 수 없는 WorkUnit이 남았습니다 (의존성 순환 또는 선행 실패): ${[...pending.keys()].join(", ")}`,
        );
      }
      if (running.size > 0) {
        await Promise.race(running.values());
      }
    }
    if (failure) throw failure;
    return outputs;
  }

  return {
    async run(command: string): Promise<RunReport> {
      const runId = randomUUID().slice(0, 12);
      const startedAt = now();
      bus.emit({ type: "run:started", runId, command, at: startedAt });

      try {
        // 1. Intake: 규칙 기반 분류 (0 토큰)
        const task = createTaskEnvelope(command, options.profile);

        // 2. Dispatcher: 역할 분해 + 티어/크리틱 배정 (0 토큰)
        const orchestratorNode: NodeDescriptor = {
          id: `orchestrator:${runId}`,
          kind: "orchestrator",
          role: "coordinator",
          title: "총괄냥",
          tier: "local",
        };
        bus.emit({
          type: "node:spawned",
          runId,
          node: orchestratorNode,
          at: now(),
        });
        const plan = dispatch(task, registry.config);
        bus.emit({ type: "run:planned", runId, plan, at: now() });

        // 3. 계획 승인 (설정 시)
        if (options.confirmPlan) {
          const decision = await gate.request(
            runId,
            "plan-confirm",
            `${plan.units.length}개 작업으로 분해, 예상 비용 $${plan.estimatedCostUsd.toFixed(4)}`,
            {
              units: plan.units.map((unit) => ({
                id: unit.id,
                title: unit.title,
                role: unit.role,
                tier: unit.tier,
                model: unit.model,
                provider: registry.config.tiers[unit.tier].provider,
                critics: unit.critics,
                expectedOutput: unit.expectedOutput,
              })),
              estimatedTokens: plan.estimatedTokens,
            },
          );
          if (!decision.approved) {
            const report: RunReport = {
              runId,
              command,
              status: "cancelled",
              summary: "사용자가 계획을 반려했습니다.",
              deliverables: [],
              verdicts: [],
              totalUsage: emptyUsage(),
              startedAt,
              finishedAt: now(),
            };
            bus.emit({ type: "run:completed", runId, report, at: now() });
            return report;
          }
        }

        // 4. 예산 오픈
        budget.openRun(runId, Math.max(plan.estimatedTokens * 3, 60_000));
        for (const unit of plan.units) {
          budget.openUnit(runId, unit.id, Math.max(unit.tokenBudget * 8, 8_000));
        }

        // 5. 맥락 컴파일 (로컬 업무 기록이 있으면, 0 토큰)
        const contextText = options.workEvents?.length
          ? buildContextPack(command, options.workEvents, plan.contextBudget)
              .items.map(
                (item) =>
                  `- [${item.event.project}] ${item.event.title}: ${item.event.summary}`,
              )
              .join("\n")
          : "";

        // 6. DAG 동시 실행
        const outputs = await executeDag({ runId, plan, contextText });

        // 7. 결과 종합
        const ordered = plan.units
          .map((unit) => outputs.get(unit.id))
          .filter((output): output is UnitOutput => !!output);
        const totalUsage = emptyUsage();
        for (const output of ordered) addUsage(totalUsage, output.usage);
        const reporterOutput = ordered.find(
          (output) => output.role === "reporter",
        );
        const report: RunReport = {
          runId,
          command,
          status: "completed",
          summary:
            reporterOutput?.summary ??
            ordered[ordered.length - 1]?.summary ??
            "완료",
          deliverables: plan.units
            .filter((unit) => outputs.has(unit.id))
            .map((unit) => ({
              unitId: unit.id,
              title: unit.title,
              deliverable: outputs.get(unit.id)!.deliverable,
            })),
          verdicts: ordered.flatMap((output) => output.verdicts ?? []),
          totalUsage,
          startedAt,
          finishedAt: now(),
        };
        bus.emit({
          type: "node:done",
          runId,
          nodeId: `orchestrator:${runId}`,
          summary: report.summary,
          usage: emptyUsage(),
          at: now(),
        });
        bus.emit({ type: "run:completed", runId, report, at: now() });
        return report;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const report: RunReport = {
          runId,
          command,
          status: "failed",
          summary: message,
          deliverables: [],
          verdicts: [],
          totalUsage: emptyUsage(),
          startedAt,
          finishedAt: now(),
          error: message,
        };
        bus.emit({ type: "run:failed", runId, error: message, at: now() });
        return report;
      } finally {
        cancelled.delete(runId);
      }
    },
    cancel(runId: string) {
      cancelled.add(runId);
    },
  };
}
