import { estimateTokens } from "../context/token-estimator";
import type { LLMProvider, LLMRequest, LLMResponse } from "./contracts";

/**
 * API 키 없이 파이프라인 전체를 검증하기 위한 결정론적 mock provider.
 * jsonSchema 요청에는 스키마 이름에 맞는 그럴듯한 JSON을 돌려준다.
 */
export function createMockProvider(): LLMProvider {
  return {
    id: "mock",
    async complete(request: LLMRequest): Promise<LLMResponse> {
      const lastUser =
        [...request.messages].reverse().find((m) => m.role === "user")
          ?.content ?? "";
      const text = request.jsonSchema
        ? mockJson(request.jsonSchema.name, lastUser)
        : `[mock:${request.tier}] ${lastUser.slice(0, 160)} 에 대한 산출물입니다.\n- 핵심 요약 1\n- 핵심 요약 2\n- 다음 단계 제안`;
      const inputTokens = estimateTokens(
        request.messages.map((m) => m.content).join("\n"),
      );
      return {
        text,
        usage: { inputTokens, outputTokens: estimateTokens(text) },
        model: request.model,
        provider: "mock",
      };
    },
  };
}

function mockJson(schemaName: string, objective: string): string {
  if (schemaName === "dispatch_plan") {
    return JSON.stringify({
      reasoning: "목표를 리서치와 산출물 작성으로 분해",
      units: [
        {
          id: "research",
          title: "관련 정보 조사",
          role: "researcher",
          dependsOn: [],
          tier: "economy",
          expectedOutput: "조사 요약",
          critics: [],
        },
        {
          id: "draft",
          title: "산출물 작성",
          role: "planner",
          dependsOn: ["research"],
          tier: "standard",
          expectedOutput: `${objective.slice(0, 40)} 산출물`,
          critics: ["executive", "user"],
        },
      ],
    });
  }
  if (schemaName === "critic_verdict") {
    return JSON.stringify({
      score: 82,
      verdict: "approve",
      issues: ["세부 근거 보강 여지"],
      mustFix: [],
    });
  }
  if (schemaName === "unit_output") {
    return JSON.stringify({
      summary: "요청 산출물을 작성했습니다.",
      deliverable: `# 산출물\n\n${objective.slice(0, 200)}`,
      evidence: ["mock-source-1"],
    });
  }
  return JSON.stringify({ note: "mock", objective: objective.slice(0, 80) });
}
