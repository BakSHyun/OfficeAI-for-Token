/** Renderer·shared 전용 직원·검토자 한글 라벨 (core/roles.ts와 동기화) */

export const executorLabels: Record<string, string> = {
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

export const criticLabels: Record<string, string> = {
  executive: "임원냥",
  user: "유저냥",
  cfo: "CFO냥",
  cto: "CTO냥",
};

export const roleSummaries: Record<string, string> = {
  "context-curator": "관련 맥락 추출",
  planner: "목표·범위 구조화",
  researcher: "조사·근거 수집",
  developer: "설계·구현",
  pm: "일정·리스크 정리",
  operator: "운영 절차",
  verifier: "요구사항 검증",
  skeptic: "반례·허점 점검",
  reporter: "결과 보고 압축",
};

export const tierLabels: Record<string, string> = {
  local: "로컬",
  economy: "이코노미",
  standard: "스탠다드",
  premium: "프리미엄",
};

/** 검토 페르소나별 기대 AI 레벨 (표시용) */
export const criticReviewTier: Record<string, string> = {
  executive: "standard",
  user: "local",
  cfo: "economy",
  cto: "premium",
};

export function labelExecutor(role: string) {
  return executorLabels[role] ?? role;
}

export function labelCritic(persona: string) {
  return criticLabels[persona] ?? persona;
}

export function labelTier(tier: string) {
  return tierLabels[tier] ?? tier;
}
