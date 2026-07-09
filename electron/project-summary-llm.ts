import {
  buildProjectSummaryPrompt,
  buildRuleProjectSummary,
  needsProjectRollup,
  normalizeLlmSummaryText,
  PROJECT_RUNS_WINDOW,
  PROJECT_SUMMARY_MAX_CHARS,
  type ProjectRunSnippet,
} from "../core/src/context/hierarchical-summary";
import type { ProviderRegistry } from "../core/src/providers/registry";

export type ProjectSummaryResult = {
  summary: string;
  method: "rule" | "llm";
};

export async function buildHierarchicalProjectSummary(
  project: string,
  runs: ProjectRunSnippet[],
  registry: ProviderRegistry,
): Promise<ProjectSummaryResult> {
  const windowed = runs.slice(-PROJECT_RUNS_WINDOW);
  if (windowed.length === 0) {
    return { summary: "", method: "rule" };
  }
  if (!needsProjectRollup(windowed)) {
    const only = windowed[windowed.length - 1];
    return {
      summary: only.summary,
      method: "rule",
    };
  }

  try {
    const { provider, binding } = registry.resolveTier("economy");
    const prompt = buildProjectSummaryPrompt({ project, runs: windowed });
    const response = await provider.complete({
      tier: "economy",
      model: binding.model,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      maxOutputTokens: 720,
    });
    const summary = normalizeLlmSummaryText(response.text).slice(
      0,
      PROJECT_SUMMARY_MAX_CHARS,
    );
    if (!summary) {
      throw new Error("프로젝트 요약이 비어 있습니다");
    }
    return { summary, method: "llm" };
  } catch {
    return {
      summary: buildRuleProjectSummary(project, windowed),
      method: "rule",
    };
  }
}
