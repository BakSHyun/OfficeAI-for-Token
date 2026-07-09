import type { EmployeeSku } from "./employees";

export const EMPLOYEE_CATALOG: EmployeeSku[] = [
  {
    id: "context-curator",
    role: "context-curator",
    displayName: "맥락냥",
    priceKrw: 0,
    includedInBase: true,
    summary: "업무 맥락·근거를 골라 실행에 전달합니다.",
  },
  {
    id: "planner",
    role: "planner",
    displayName: "기획냥",
    priceKrw: 0,
    includedInBase: true,
    summary: "목표와 범위를 구조화하고 작업을 분해합니다.",
  },
  {
    id: "reporter",
    role: "reporter",
    displayName: "보고냥",
    priceKrw: 0,
    includedInBase: true,
    summary: "결과를 보고서 형태로 압축·정리합니다.",
  },
  {
    id: "developer",
    role: "developer",
    displayName: "코드냥",
    priceKrw: 29_000,
    includedInBase: false,
    summary: "설계·구현·리팩터링 업무를 담당합니다.",
  },
  {
    id: "developer-pro",
    role: "developer",
    displayName: "코드냥 Pro",
    variant: "pro",
    tierFloor: "premium",
    priceKrw: 79_000,
    includedInBase: false,
    summary: "프리미엄 티어 보장 + 강화 프롬프트로 개발 품질을 높입니다.",
    promptPackId: "developer-pro",
  },
  {
    id: "researcher",
    role: "researcher",
    displayName: "리서치냥",
    priceKrw: 19_000,
    includedInBase: false,
    summary: "조사·비교·근거 수집을 담당합니다.",
  },
  {
    id: "pm",
    role: "pm",
    displayName: "PM냥",
    priceKrw: 19_000,
    includedInBase: false,
    summary: "일정·리스크·의존성을 정리합니다.",
  },
  {
    id: "operator",
    role: "operator",
    displayName: "운영냥",
    priceKrw: 24_000,
    includedInBase: false,
    summary: "배포·운영·장애 대응 절차를 다룹니다.",
  },
  {
    id: "verifier",
    role: "verifier",
    displayName: "검증냥",
    priceKrw: 24_000,
    includedInBase: false,
    summary: "요구사항 충족 여부를 검증합니다.",
  },
];

export function findEmployeeSku(id: string) {
  return EMPLOYEE_CATALOG.find((sku) => sku.id === id);
}
