/**
 * Provider별 공개 모델 프리셋. renderer·electron·core 테스트에서 공유한다.
 * 가격은 USD/1M 토큰 기준이며 API 공개 요금을 반영한다(구독 CLI는 0).
 */

export type CodexReasoningEffort =
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh";

export type ModelPreset = {
  id: string;
  label: string;
  inputCostPerMillion: number;
  outputCostPerMillion: number;
  codexReasoningEffort?: CodexReasoningEffort;
};

export type ProviderModelCatalog = {
  provider: string;
  allowCustom: boolean;
  customHint?: string;
  presets: ModelPreset[];
};

const CODEX_EFFORT_ORDER: CodexReasoningEffort[] = [
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
];

export const CODEX_REASONING_OPTIONS: Array<{
  value: CodexReasoningEffort;
  label: string;
}> = [
  { value: "minimal", label: "minimal — 최소 추론" },
  { value: "low", label: "low" },
  { value: "medium", label: "medium — 기본" },
  { value: "high", label: "high — 깊은 추론" },
  { value: "xhigh", label: "xhigh — 최대" },
];

/** codex-cli model 필드: `모델id|effort` (effort 생략 가능) */
export function parseCodexModelField(model: string): {
  modelId: string;
  effort?: CodexReasoningEffort;
} {
  const [modelId, effort] = model.split("|");
  const trimmed = modelId.trim() || "default";
  if (!effort) return { modelId: trimmed };
  const normalized = effort.trim().toLowerCase() as CodexReasoningEffort;
  if (CODEX_EFFORT_ORDER.includes(normalized)) {
    return { modelId: trimmed, effort: normalized };
  }
  return { modelId: trimmed };
}

export function formatCodexModelField(
  modelId: string,
  effort?: CodexReasoningEffort,
): string {
  if (!effort || effort === "medium") {
    return modelId;
  }
  return `${modelId}|${effort}`;
}

export const PROVIDER_MODEL_CATALOGS: ProviderModelCatalog[] = [
  {
    provider: "openai",
    allowCustom: true,
    customHint: "OpenAI 모델 ID",
    presets: [
      {
        id: "gpt-4.1-mini",
        label: "GPT-4.1 mini",
        inputCostPerMillion: 0.4,
        outputCostPerMillion: 1.6,
      },
      {
        id: "gpt-4.1",
        label: "GPT-4.1",
        inputCostPerMillion: 2,
        outputCostPerMillion: 8,
      },
      {
        id: "gpt-4o-mini",
        label: "GPT-4o mini",
        inputCostPerMillion: 0.15,
        outputCostPerMillion: 0.6,
      },
      {
        id: "gpt-4o",
        label: "GPT-4o",
        inputCostPerMillion: 2.5,
        outputCostPerMillion: 10,
      },
    ],
  },
  {
    provider: "anthropic",
    allowCustom: true,
    customHint: "Anthropic 모델 ID",
    presets: [
      {
        id: "claude-haiku-4-5",
        label: "Claude Haiku 4.5",
        inputCostPerMillion: 0.8,
        outputCostPerMillion: 4,
      },
      {
        id: "claude-sonnet-4-5",
        label: "Claude Sonnet 4.5",
        inputCostPerMillion: 3,
        outputCostPerMillion: 15,
      },
      {
        id: "claude-opus-4-5",
        label: "Claude Opus 4.5",
        inputCostPerMillion: 15,
        outputCostPerMillion: 75,
      },
    ],
  },
  {
    provider: "codex-cli",
    allowCustom: true,
    customHint: "Codex 모델 ID (예: gpt-5-codex)",
    presets: [
      {
        id: "gpt-5-codex",
        label: "GPT-5 Codex",
        inputCostPerMillion: 0,
        outputCostPerMillion: 0,
        codexReasoningEffort: "medium",
      },
      {
        id: "gpt-5",
        label: "GPT-5",
        inputCostPerMillion: 0,
        outputCostPerMillion: 0,
        codexReasoningEffort: "high",
      },
      {
        id: "default",
        label: "기본(설정 파일)",
        inputCostPerMillion: 0,
        outputCostPerMillion: 0,
        codexReasoningEffort: "medium",
      },
    ],
  },
  {
    provider: "cursor-agent-cli",
    allowCustom: true,
    customHint: "Cursor Agent 모델 식별자",
    presets: [
      {
        id: "default",
        label: "기본(자동)",
        inputCostPerMillion: 0,
        outputCostPerMillion: 0,
      },
      {
        id: "claude-sonnet-4-5",
        label: "Claude Sonnet 4.5",
        inputCostPerMillion: 0,
        outputCostPerMillion: 0,
      },
      {
        id: "gpt-5.3-codex",
        label: "GPT-5.3 Codex",
        inputCostPerMillion: 0,
        outputCostPerMillion: 0,
      },
    ],
  },
  {
    provider: "lmstudio",
    allowCustom: true,
    customHint: "LM Studio에 로드된 모델 이름",
    presets: [
      {
        id: "qwen2.5-7b-instruct",
        label: "Qwen 2.5 7B (예시)",
        inputCostPerMillion: 0,
        outputCostPerMillion: 0,
      },
      {
        id: "llama-3.2-3b-instruct",
        label: "Llama 3.2 3B (예시)",
        inputCostPerMillion: 0,
        outputCostPerMillion: 0,
      },
    ],
  },
  {
    provider: "mock",
    allowCustom: false,
    presets: [
      {
        id: "mock",
        label: "mock",
        inputCostPerMillion: 0,
        outputCostPerMillion: 0,
      },
    ],
  },
];

export function catalogForProvider(
  provider: string,
): ProviderModelCatalog | undefined {
  return PROVIDER_MODEL_CATALOGS.find((item) => item.provider === provider);
}

export function defaultPresetForProvider(
  provider: string,
): ModelPreset | undefined {
  return catalogForProvider(provider)?.presets[0];
}

export function bindingFromPreset(
  provider: string,
  preset: ModelPreset,
): {
  model: string;
  inputCostPerMillion: number;
  outputCostPerMillion: number;
} {
  if (provider === "codex-cli") {
    return {
      model: formatCodexModelField(
        preset.id,
        preset.codexReasoningEffort ?? "medium",
      ),
      inputCostPerMillion: preset.inputCostPerMillion,
      outputCostPerMillion: preset.outputCostPerMillion,
    };
  }
  return {
    model: preset.id,
    inputCostPerMillion: preset.inputCostPerMillion,
    outputCostPerMillion: preset.outputCostPerMillion,
  };
}

export function matchPreset(
  provider: string,
  model: string,
): ModelPreset | undefined {
  const catalog = catalogForProvider(provider);
  if (!catalog) return undefined;
  if (provider === "codex-cli") {
    const { modelId, effort } = parseCodexModelField(model);
    return (
      catalog.presets.find(
        (preset) =>
          preset.id === modelId &&
          (preset.codexReasoningEffort ?? "medium") === (effort ?? "medium"),
      ) ??
      catalog.presets.find((preset) => preset.id === modelId)
    );
  }
  return catalog.presets.find((preset) => preset.id === model);
}

export function isCustomModel(provider: string, model: string): boolean {
  const catalog = catalogForProvider(provider);
  if (!catalog?.allowCustom) return false;
  return !matchPreset(provider, model);
}
