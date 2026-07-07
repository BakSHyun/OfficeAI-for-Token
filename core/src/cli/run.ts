import { createEngine } from "../engine";
import type { RunEvent } from "../orchestration/contracts";

function formatEvent(event: RunEvent): string | null {
  switch (event.type) {
    case "run:started":
      return `▶ 실행 시작: "${event.command}"`;
    case "run:planned": {
      const units = event.plan.units
        .map(
          (unit) =>
            `  - [${unit.tier}] ${unit.title} (${unit.role}${
              unit.critics.length > 0
                ? `, 검토: ${unit.critics.join("/")}`
                : ""
            })`,
        )
        .join("\n");
      return `계획 수립 — ${event.plan.units.length}개 유닛, 예상 $${event.plan.estimatedCostUsd.toFixed(4)}\n${units}`;
    }
    case "node:spawned":
      return `+ ${event.node.title} 투입 (${event.node.kind}/${event.node.tier})`;
    case "node:working":
      return `… ${event.nodeId.split(":")[0]}: ${event.detail}`;
    case "node:done":
      return `✓ ${event.nodeId.split(":")[0]}: ${event.summary}`;
    case "node:failed":
      return `✗ ${event.nodeId.split(":")[0]}: ${event.error}`;
    case "critic:verdict":
      return `  ⚖ ${event.verdict.persona}: ${event.verdict.verdict} (${event.verdict.score}점)${
        event.verdict.issues.length > 0
          ? ` — ${event.verdict.issues[0]}`
          : ""
      }`;
    case "token:used":
      return `  ₮ ${event.tier}/${event.model}: in ${event.usage.inputTokens} / out ${event.usage.outputTokens} ($${event.usage.costUsd.toFixed(5)})`;
    case "budget:warning":
      return `⚠ 예산 경고: ${event.state.scope} ${event.state.usedTokens.toLocaleString()}/${event.state.budgetTokens.toLocaleString()} tokens`;
    case "budget:exceeded":
      return `⚠ 예산 초과(${event.action}): ${event.state.scope}`;
    case "approval:requested":
      return `? 승인 요청 [${event.request.kind}]: ${event.request.reason}`;
    case "approval:resolved":
      return `→ 승인 ${event.approved ? "허용" : "거부"}`;
    case "run:completed":
      return null;
    case "run:failed":
      return `✗ 실행 실패: ${event.error}`;
    default:
      return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const mock = args.includes("--mock") || process.env.OFFICEAI_MOCK === "1";
  const command = args.filter((argument) => !argument.startsWith("--")).join(" ");
  if (!command) {
    console.error(
      '사용법: npm run core:run -- "지시문" [--mock]\n  --mock  API 키 없이 mock provider로 파이프라인 검증',
    );
    process.exit(1);
  }

  const engine = await createEngine({
    autoApprove: true,
    confirmPlan: false,
    forceMock: mock,
  });
  engine.bus.subscribe((event) => {
    const line = formatEvent(event);
    if (line) console.log(line);
  });

  const report = await engine.orchestrator.run(command);

  console.log("\n===== 실행 보고 =====");
  console.log(`상태: ${report.status}`);
  console.log(`요약: ${report.summary}`);
  console.log(
    `토큰: in ${report.totalUsage.inputTokens.toLocaleString()} / out ${report.totalUsage.outputTokens.toLocaleString()} — $${report.totalUsage.costUsd.toFixed(4)}`,
  );
  for (const deliverable of report.deliverables) {
    console.log(`\n--- ${deliverable.title} ---`);
    console.log(deliverable.deliverable.slice(0, 2_000));
  }
  engine.close();
  process.exit(report.status === "completed" ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
