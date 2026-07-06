import type {
  ContextItem,
  ContextPack,
  WorkEvent,
} from "../contracts";
import { estimateTokens } from "./token-estimator";

const sourceWeight: Record<WorkEvent["kind"], number> = {
  "git-commit": 0.9,
  "cursor-plan": 1,
  "cursor-transcript": 0.78,
  "cursor-workspace": 0.4,
  "git-status": 1,
  markdown: 0.92,
};

const stopWords = new Set([
  "최근",
  "작업",
  "업무",
  "기준",
  "다음",
  "개발",
  "계획",
  "준비",
  "작성",
  "진행",
  "해줘",
  "해주세요",
  "변경",
  "관련",
  "현재",
  "파악",
  "그리고",
  "기준으로",
]);

function terms(text: string) {
  return new Set(
    text
      .toLocaleLowerCase("ko-KR")
      .split(/[^0-9a-zA-Z가-힣_-]+/)
      .filter((term) => term.length >= 2 && !stopWords.has(term)),
  );
}

function lexicalScore(queryTerms: Set<string>, event: WorkEvent) {
  const eventTerms = terms(
    `${event.title} ${event.summary} ${event.tags.join(" ")}`,
  );
  if (queryTerms.size === 0) return 0;

  let matches = 0;
  for (const term of queryTerms) {
    if (eventTerms.has(term)) matches += 1;
  }
  return matches / queryTerms.size;
}

function recencyScore(occurredAt: string, now: Date) {
  const timestamp = Date.parse(occurredAt);
  if (!Number.isFinite(timestamp)) return 0.2;
  const ageDays = Math.max(0, (now.getTime() - timestamp) / 86_400_000);
  return Math.pow(0.5, ageDays / 30);
}

export function rankContext(
  query: string,
  events: WorkEvent[],
  now = new Date(),
): ContextItem[] {
  const queryTerms = terms(query);

  return events
    .map((event) => {
      const lexical = lexicalScore(queryTerms, event);
      const recency = recencyScore(event.occurredAt, now);
      const confidence = Math.max(0, Math.min(1, event.confidence));
      const score =
        lexical * 0.48 +
        recency * 0.22 +
        confidence * 0.15 +
        sourceWeight[event.kind] * 0.15;
      const estimatedTokens = estimateTokens(
        `${event.title}\n${event.summary}\n${event.sourceRef}`,
      );

      const reasons = [
        `lexical=${lexical.toFixed(2)}`,
        `recency=${recency.toFixed(2)}`,
        `confidence=${confidence.toFixed(2)}`,
        `source=${sourceWeight[event.kind].toFixed(2)}`,
      ];

      return {
        event,
        score,
        estimatedTokens,
        reasons,
        components: {
          lexical,
          recency,
          confidence,
          source: sourceWeight[event.kind],
        },
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function buildContextPack(
  query: string,
  events: WorkEvent[],
  tokenBudget: number,
  now = new Date(),
): ContextPack {
  const ranked = rankContext(query, events, now);
  const requireLexicalMatch = terms(query).size > 0;
  const selected: ContextItem[] = [];
  const hashes = new Set<string>();
  let estimatedTokens = 0;

  for (const item of ranked) {
    if (requireLexicalMatch && item.components.lexical === 0) continue;
    if (hashes.has(item.event.sourceHash)) continue;
    if (estimatedTokens + item.estimatedTokens > tokenBudget) continue;

    selected.push(item);
    hashes.add(item.event.sourceHash);
    estimatedTokens += item.estimatedTokens;
  }

  return {
    query,
    tokenBudget,
    estimatedTokens,
    items: selected,
    citations: selected.map(({ event }) => ({
      id: event.id,
      sourceRef: event.sourceRef,
      sourceHash: event.sourceHash,
    })),
  };
}
