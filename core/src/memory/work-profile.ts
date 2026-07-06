import type { WorkEvent } from "../contracts";

type RankedCount = {
  name: string;
  score: number;
  eventCount: number;
  lastSeen: string;
};

export type WorkProfile = {
  generatedAt: string;
  eventCount: number;
  currentFocus: RankedCount[];
  topProjects: RankedCount[];
  topThemes: RankedCount[];
  recentWork: Array<{
    occurredAt: string;
    project: string;
    title: string;
    sourceRef: string;
  }>;
};

function ageWeight(occurredAt: string, now: Date) {
  const parsed = Date.parse(occurredAt);
  if (!Number.isFinite(parsed)) return 0.1;
  const ageDays = Math.max(0, (now.getTime() - parsed) / 86_400_000);
  return Math.pow(0.5, ageDays / 21);
}

function rank(
  events: WorkEvent[],
  names: (event: WorkEvent) => string[],
  now: Date,
): RankedCount[] {
  const aggregate = new Map<string, RankedCount>();

  for (const event of events) {
    const weight = ageWeight(event.occurredAt, now) * event.confidence;
    for (const name of names(event)) {
      if (!name) continue;
      const current = aggregate.get(name) ?? {
        name,
        score: 0,
        eventCount: 0,
        lastSeen: event.occurredAt,
      };
      current.score += weight;
      current.eventCount += 1;
      if (event.occurredAt > current.lastSeen) {
        current.lastSeen = event.occurredAt;
      }
      aggregate.set(name, current);
    }
  }

  return [...aggregate.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map((item) => ({ ...item, score: Number(item.score.toFixed(3)) }));
}

function currentFocus(events: WorkEvent[], now: Date): RankedCount[] {
  const weights: Record<WorkEvent["kind"], number> = {
    "cursor-transcript": 1,
    "git-status": 1.2,
    "git-commit": 0.9,
    "cursor-plan": 0.65,
    "cursor-workspace": 0.5,
    markdown: 0.55,
  };
  const cutoff = now.getTime() - 72 * 60 * 60 * 1_000;
  const recent = events.filter((event) => {
    const parsed = Date.parse(event.occurredAt);
    return Number.isFinite(parsed) && parsed >= cutoff;
  });
  const aggregate = new Map<string, RankedCount>();

  for (const event of recent) {
    if (
      event.kind === "git-status" &&
      Number(event.metadata?.changedFileCount ?? 0) === 0
    ) {
      continue;
    }
    const parsed = Date.parse(event.occurredAt);
    const ageHours = Math.max(0, (now.getTime() - parsed) / 3_600_000);
    const recency = Math.pow(0.5, ageHours / 12);
    const score = recency * event.confidence * weights[event.kind];
    const existing = aggregate.get(event.project) ?? {
      name: event.project,
      score: 0,
      eventCount: 0,
      lastSeen: event.occurredAt,
    };
    existing.score += score;
    existing.eventCount += 1;
    if (event.occurredAt > existing.lastSeen) {
      existing.lastSeen = event.occurredAt;
    }
    aggregate.set(event.project, existing);
  }

  return [...aggregate.values()]
    .filter(({ name }) => !["cursor-plans", "cursor-workspaces"].includes(name))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((item) => ({ ...item, score: Number(item.score.toFixed(3)) }));
}

export function deriveWorkProfile(
  events: WorkEvent[],
  now = new Date(),
): WorkProfile {
  return {
    generatedAt: now.toISOString(),
    eventCount: events.length,
    currentFocus: currentFocus(events, now),
    topProjects: rank(events, (event) => [event.project], now),
    topThemes: rank(events, (event) => event.tags, now),
    recentWork: events
      .filter((event) => event.kind !== "cursor-workspace")
      .slice(0, 30)
      .map(({ occurredAt, project, title, sourceRef }) => ({
        occurredAt,
        project,
        title,
        sourceRef,
      })),
  };
}
