import {
  buildRunSummaryPrompt,
  buildUnitCompressPrompt,
  compressUnitVerbatim,
  formatStoredSummary,
  needsUnitCompression,
  normalizeLlmSummaryText,
  ruleCompressText,
  RUN_SUMMARY_MAX_CHARS,
  UNIT_COMPRESSED_MAX_CHARS,
  type CompressedUnit,
} from "../core/src/context/hierarchical-summary";
import type { RunReport } from "../core/src/orchestration/contracts";
import type { ProviderRegistry } from "../core/src/providers/registry";
import { buildRunSummaryText } from "./run-summaries";

export type HierarchicalSummaryResult = {
  text: string;
  method: "rule" | "llm";
};

async function compressUnitWithLlm(
  registry: ProviderRegistry,
  input: {
    command: string;
    unitId: string;
    title: string;
    deliverable: string;
  },
): Promise<CompressedUnit> {
  const originalChars = input.deliverable.replace(/\s+/g, " ").trim().length;
  if (!needsUnitCompression(input.deliverable)) {
    return compressUnitVerbatim(input.unitId, input.title, input.deliverable);
  }

  const { provider, binding } = registry.resolveTier("economy");
  const prompt = buildUnitCompressPrompt({
    command: input.command,
    unitTitle: input.title,
    deliverable: input.deliverable,
  });
  const response = await provider.complete({
    tier: "economy",
    model: binding.model,
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
    maxOutputTokens: 520,
  });
  const text =
    normalizeLlmSummaryText(response.text).slice(0, UNIT_COMPRESSED_MAX_CHARS) ||
    ruleCompressText(input.deliverable, UNIT_COMPRESSED_MAX_CHARS);

  return {
    unitId: input.unitId,
    title: input.title,
    originalChars,
    text,
    method: "llm",
  };
}

export async function buildHierarchicalRunSummary(
  report: RunReport,
  registry: ProviderRegistry,
): Promise<HierarchicalSummaryResult> {
  if (report.status !== "completed") {
    return { text: buildRunSummaryText(report), method: "rule" };
  }

  try {
    const units: CompressedUnit[] = [];
    for (const item of report.deliverables) {
      units.push(
        await compressUnitWithLlm(registry, {
          command: report.command,
          unitId: item.unitId,
          title: item.title,
          deliverable: item.deliverable,
        }),
      );
    }

    const { provider, binding } = registry.resolveTier("economy");
    const runPrompt = buildRunSummaryPrompt({
      command: report.command,
      reportSummary: report.summary,
      units,
    });
    const runResponse = await provider.complete({
      tier: "economy",
      model: binding.model,
      messages: [
        { role: "system", content: runPrompt.system },
        { role: "user", content: runPrompt.user },
      ],
      maxOutputTokens: 640,
    });
    const runSummary = normalizeLlmSummaryText(runResponse.text).slice(
      0,
      RUN_SUMMARY_MAX_CHARS,
    );
    if (!runSummary) {
      throw new Error("run 요약이 비어 있습니다");
    }

    return {
      text: formatStoredSummary(runSummary, units),
      method: "llm",
    };
  } catch {
    return { text: buildRunSummaryText(report), method: "rule" };
  }
}
