import { createHash } from "node:crypto";
import type {
  RiskLevel,
  TaskEnvelope,
  WorkCategory,
} from "../contracts";
import type { WorkProfile } from "../memory/work-profile";
import { estimateTokens } from "../context/token-estimator";
import { redactSensitiveText } from "../security/redaction";

const categoryRules: Record<WorkCategory, RegExp[]> = {
  planning: [/기획|계획|로드맵|요구사항|정책|우선순위|설계/gi],
  development: [
    /개발|구현|수정|리팩터|코드|버그|api|migration|테스트|빌드/gi,
  ],
  pm: [/일정|담당|마감|진행|리스크|의존성|상태|보고|회의/gi],
  research: [/조사|분석|비교|찾아|리서치|근거|시장|경쟁사/gi],
  operations: [/배포|운영|서버|장애|모니터링|로그|인프라|docker/gi],
  mixed: [],
};

const highRiskAction =
  /(?:운영|프로덕션).*(?:배포|수정|삭제|db)|(?:배포|삭제|송금|환불|결제\s*취소|메일\s*발송|메시지\s*발송|권한\s*변경|merge|push).*(?:실행|진행|적용|처리|해줘|해주세요)|(?:실행|진행|적용|처리).*(?:배포|삭제|송금|환불|결제\s*취소|권한\s*변경|merge|push)/i;
const mediumRiskAction =
  /수정|구현|migration|외부\s*api\s*호출|일정\s*변경|담당\s*지정|파일\s*이동|코드\s*변경/i;

function categoryScores(command: string) {
  return Object.entries(categoryRules).map(([category, patterns]) => ({
    category: category as WorkCategory,
    score: patterns.reduce(
      (total, pattern) => total + (command.match(pattern)?.length ?? 0),
      0,
    ),
  }));
}

function classifyCategory(command: string): WorkCategory {
  const ranked = categoryScores(command)
    .filter(({ category }) => category !== "mixed")
    .sort((a, b) => b.score - a.score);
  if (!ranked[0] || ranked[0].score === 0) return "mixed";
  if (ranked[1] && ranked[1].score === ranked[0].score && ranked[0].score > 0) {
    return "mixed";
  }
  return ranked[0].category;
}

export function inferProjectHints(command: string, profile?: WorkProfile) {
  if (!profile) return [];
  const lower = command.toLocaleLowerCase("ko-KR");
  const candidates = [
    ...profile.currentFocus,
    ...profile.topProjects.filter(
      (project) =>
        !profile.currentFocus.some(({ name }) => name === project.name),
    ),
  ];
  const explicit = candidates
    .filter(({ name }) => lower.includes(name.toLocaleLowerCase("ko-KR")))
    .map(({ name }) => name);
  if (explicit.length > 0) return explicit.slice(0, 3);
  if (profile.currentFocus.length > 1) {
    const [first, second] = profile.currentFocus;
    if (second.score >= first.score * 0.85) {
      return [first.name, second.name];
    }
  }
  return candidates.slice(0, 1).map(({ name }) => name);
}

function classifyRisk(command: string): RiskLevel {
  if (highRiskAction.test(command)) return "high";
  if (mediumRiskAction.test(command)) return "medium";
  return "low";
}

function estimateComplexity(command: string, projectCount: number) {
  const clauses = command.split(/그리고|또한|동시에|후에|,|;/).length;
  const deliverables =
    command.match(/기획서|문서|코드|테스트|보고서|배포|분석|화면/gi)
      ?.length ?? 0;
  return Math.min(
    1,
    0.12 +
      command.length / 450 +
      Math.max(0, clauses - 1) * 0.09 +
      Math.max(0, deliverables - 1) * 0.08 +
      Math.max(0, projectCount - 1) * 0.12,
  );
}

export function createTaskEnvelope(
  command: string,
  profile?: WorkProfile,
): TaskEnvelope {
  const trimmed = command.trim();
  if (!trimmed) throw new Error("Command is empty.");

  const redacted = redactSensitiveText(trimmed);
  const projectHints = inferProjectHints(redacted.text, profile);
  const category = classifyCategory(redacted.text);
  const risk = classifyRisk(redacted.text);
  const complexity = estimateComplexity(redacted.text, projectHints.length);
  const baseInput = estimateTokens(redacted.text);
  const categoryContext: Record<WorkCategory, number> = {
    planning: 9_000,
    development: 14_000,
    pm: 7_000,
    research: 10_000,
    operations: 8_000,
    mixed: 12_000,
  };

  return {
    id: createHash("sha256").update(redacted.text).digest("hex").slice(0, 16),
    objective: redacted.text,
    category,
    projectHints,
    risk,
    complexity,
    expectedInputTokens:
      baseInput + Math.round(categoryContext[category] * complexity),
    expectedOutputTokens: Math.round(700 + 3_500 * complexity),
    requiresTools:
      projectHints.length > 0 ||
      category === "development" ||
      category === "operations" ||
      /파일|저장소|문서|로컬|최근\s*작업|파악/gi.test(redacted.text),
    deterministicCheckAvailable:
      category === "development" ||
      category === "operations" ||
      /표|json|스키마|목록|형식/gi.test(redacted.text),
    privacy:
      redacted.redactionCount > 0 ? "local-only" : "cloud-allowed",
    attempt: 0,
  };
}
