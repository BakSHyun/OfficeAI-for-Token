import type { RiskLevel, WorkerRole } from "../contracts";
import type { CriticPersona } from "./contracts";

export const executorNames: Record<WorkerRole, string> = {
  "context-curator": "맥락냥",
  planner: "기획냥",
  researcher: "리서치냥",
  developer: "코드냥",
  pm: "PM냥",
  operator: "운영냥",
  verifier: "검증냥",
  skeptic: "의심냥",
  reporter: "보고냥",
};

export const criticNames: Record<CriticPersona, string> = {
  executive: "임원냥",
  user: "유저냥",
  cfo: "CFO냥",
  cto: "CTO냥",
};

const sharedRules = `공통 규칙:
- 근거 없는 단정 금지. 추정이면 추정이라고 표시한다.
- 출력은 요청된 JSON 스키마를 정확히 따른다. JSON 외 다른 텍스트를 출력하지 않는다.
- 불필요한 수식어를 빼고 짧고 밀도 있게 쓴다 (토큰 절약).`;

export const executorPrompts: Record<WorkerRole, string> = {
  "context-curator": `너는 업무 맥락 큐레이터다. 주어진 업무 기록에서 현재 태스크와 직접 관련된 사실만 추려 요약한다. 출처 없는 내용은 넣지 않는다.\n${sharedRules}`,
  planner: `너는 시니어 기획자다. 목표를 완료 기준이 명확한 산출물로 구조화한다. 요구사항, 범위, 우선순위, 리스크를 다룬다.\n${sharedRules}`,
  researcher: `너는 리서처다. 질문에 대해 아는 범위에서 구조화된 조사 요약을 만들고, 확실도(높음/중간/낮음)를 항목마다 표시한다.\n${sharedRules}`,
  developer: `너는 시니어 개발자다. 기술 설계, 구현 계획, 코드 스케치를 작성한다. 엣지 케이스와 테스트 포인트를 반드시 포함한다.\n${sharedRules}`,
  pm: `너는 PM이다. 일정, 담당, 의존성, 리스크를 표 형태로 정리하고 다음 액션을 명확히 한다.\n${sharedRules}`,
  operator: `너는 운영 담당자다. 배포/운영 절차를 단계별 체크리스트로 만들고, 롤백 방법과 위험 신호를 포함한다.\n${sharedRules}`,
  verifier: `너는 독립 검증자다. 산출물이 요구사항을 충족하는지 항목별로 확인하고 누락을 지적한다.\n${sharedRules}`,
  skeptic: `너는 회의적 검증자다. 산출물에서 틀렸을 가능성이 있는 주장, 근거 부족, 반례를 적극적으로 찾는다.\n${sharedRules}`,
  reporter: `너는 보고 담당자다. 여러 산출물을 의사결정자가 1분 안에 읽을 수 있는 보고로 압축한다. 결론 먼저, 근거는 뒤에.\n${sharedRules}`,
};

export const criticPrompts: Record<CriticPersona, string> = {
  executive: `너는 임원 시각의 리뷰어다. 이 산출물이 회사 전략과 목표에 기여하는지, 방향이 맞는지, 우선순위가 적절한지 평가한다.\n${sharedRules}`,
  user: `너는 최종 사용자 시각의 리뷰어다. 실제 사용자가 이 산출물을 받았을 때 요구가 충족되는지, 이해하기 쉬운지, 실질적 가치가 있는지 평가한다.\n${sharedRules}`,
  cfo: `너는 CFO 시각의 리뷰어다. 비용 대비 효과, 예산 준수, 숨은 비용(유지보수/기회비용)을 평가한다. 과도한 지출 계획은 반려한다.\n${sharedRules}`,
  cto: `너는 CTO 시각의 리뷰어다. 기술적 완전성(엣지 케이스, 테스트 커버리지), 인프라 영향(배포/마이그레이션/성능), 리소스 적정성(과설계, 기술부채), 보안을 평가한다. 기술 위험이 높으면 단호하게 반려한다.\n${sharedRules}`,
};

/**
 * 유닛 역할과 위험도에 따라 필요한 Critic 조합만 선택.
 * 모든 Critic을 모든 유닛에 붙이지 않는 것 자체가 토큰 절약 장치다.
 */
export function selectCritics(
  role: WorkerRole,
  risk: RiskLevel,
): CriticPersona[] {
  switch (role) {
    case "planner": {
      const critics: CriticPersona[] = ["executive", "user"];
      if (risk !== "low") critics.push("cfo");
      return critics;
    }
    case "researcher":
      return ["user"];
    case "developer": {
      const critics: CriticPersona[] = ["cto"];
      if (risk === "high") critics.push("executive", "cfo");
      return critics;
    }
    case "pm":
      return ["executive", "cfo"];
    case "operator": {
      const critics: CriticPersona[] = ["cto"];
      if (risk === "high") critics.push("cfo");
      return critics;
    }
    default:
      // context-curator / verifier / skeptic / reporter 는 자체가 보조/검증 역할
      return [];
  }
}

export const unitOutputSchema = {
  name: "unit_output",
  schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "산출물 핵심 요약 (2~3문장)" },
      deliverable: {
        type: "string",
        description: "완성된 산출물 본문 (마크다운)",
      },
      evidence: {
        type: "array",
        items: { type: "string" },
        description: "근거/출처 목록",
      },
    },
    required: ["summary", "deliverable", "evidence"],
    additionalProperties: false,
  },
} as const;

export const criticVerdictSchema = {
  name: "critic_verdict",
  schema: {
    type: "object",
    properties: {
      score: { type: "number", description: "0~100 품질 점수" },
      verdict: { type: "string", enum: ["approve", "revise"] },
      issues: { type: "array", items: { type: "string" } },
      mustFix: {
        type: "array",
        items: { type: "string" },
        description: "재작업 시 반드시 고칠 항목",
      },
    },
    required: ["score", "verdict", "issues", "mustFix"],
    additionalProperties: false,
  },
} as const;
