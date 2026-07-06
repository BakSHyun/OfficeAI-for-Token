import { createHash } from "node:crypto";
import { relative } from "node:path";
import type { WorkEvent } from "../contracts";
import {
  classifySensitivity,
  redactSensitiveText,
} from "../security/redaction";

export function hashText(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

export function titleFromText(text: string, fallback: string) {
  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return (firstLine ?? fallback).replace(/^#+\s*/, "").slice(0, 140);
}

export function tagsFromText(text: string) {
  const lower = text.toLocaleLowerCase("ko-KR");
  const tags = new Set<string>();
  const rules: Array<[string, RegExp]> = [
    ["payment", /결제|kcp|payment|coupon|쿠폰/],
    ["finance", /정산|매출|finance|reconciliation/],
    ["infrastructure", /인프라|redis|queue|docker|monitor/],
    ["backend", /backend|laravel|api|migration|mysql/],
    ["frontend", /frontend|react|vue|admin|ui/],
    ["testing", /test|테스트|검증|e2e/],
    ["planning", /계획|기획|roadmap|설계/],
    ["operations", /운영|배포|deploy|장애|로그/],
  ];

  for (const [tag, pattern] of rules) {
    if (pattern.test(lower)) tags.add(tag);
  }
  return [...tags];
}

type EventInput = Omit<
  WorkEvent,
  "id" | "sourceHash" | "summary" | "sensitivity"
> & {
  summary: string;
};

export function createWorkEvent(input: EventInput): WorkEvent {
  const summaryRedacted = redactSensitiveText(input.summary);
  const titleRedacted = redactSensitiveText(input.title);
  const sourceRefRedacted = redactSensitiveText(input.sourceRef);
  const metadata: Record<string, string | number | boolean> = {};
  let metadataRedactionCount = 0;
  const metadataMatchedTypes: string[] = [];
  for (const [key, value] of Object.entries(input.metadata ?? {})) {
    if (typeof value !== "string") {
      metadata[key] = value;
      continue;
    }
    const redacted = redactSensitiveText(value);
    metadata[key] = redacted.text;
    metadataRedactionCount += redacted.redactionCount;
    metadataMatchedTypes.push(...redacted.matchedTypes);
  }
  const totalRedactions =
    summaryRedacted.redactionCount +
    titleRedacted.redactionCount +
    sourceRefRedacted.redactionCount +
    metadataRedactionCount;
  const matchedTypes = new Set([
    ...summaryRedacted.matchedTypes,
    ...titleRedacted.matchedTypes,
    ...sourceRefRedacted.matchedTypes,
    ...metadataMatchedTypes,
  ]);
  const sourceHash = hashText(summaryRedacted.text);
  const eventHash = hashText(
    `${input.kind}|${sourceRefRedacted.text}|${sourceHash}`,
  );

  return {
    ...input,
    id: eventHash.slice(0, 20),
    sourceHash,
    title: titleRedacted.text,
    summary: summaryRedacted.text,
    sourceRef: sourceRefRedacted.text,
    sensitivity: classifySensitivity(totalRedactions),
    metadata: {
      ...metadata,
      redactionCount: totalRedactions,
      redactionTypes: [...matchedTypes].join(","),
    },
  };
}

export function relativeRef(root: string, path: string) {
  return relative(root, path).replaceAll("\\", "/");
}
