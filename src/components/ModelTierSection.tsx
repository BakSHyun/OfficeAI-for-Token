import type { ProviderConfig } from "../state/bridge-types";
import {
  CODEX_REASONING_OPTIONS,
  bindingFromPreset,
  catalogForProvider,
  defaultPresetForProvider,
  formatCodexModelField,
  isCustomModel,
  matchPreset,
  parseCodexModelField,
  type CodexReasoningEffort,
  type ModelPreset,
} from "../../shared/provider-model-catalog";

const tierOrder = ["local", "economy", "standard", "premium"] as const;

const providerOptions = [
  "openai",
  "anthropic",
  "lmstudio",
  "codex-cli",
  "cursor-agent-cli",
  "mock",
] as const;

type ModelTierSectionProps = {
  tiers: ProviderConfig["tiers"];
  concurrency: number;
  onTiersChange: (tiers: ProviderConfig["tiers"]) => void;
  onConcurrencyChange: (value: number) => void;
  readOnly?: boolean;
};

function applyProviderDefaults(
  provider: string,
  current: ProviderConfig["tiers"][typeof tierOrder[number]],
) {
  const preset = defaultPresetForProvider(provider);
  if (!preset) {
    return {
      ...current,
      provider,
      model: provider === "mock" ? "mock" : "default",
      inputCostPerMillion: 0,
      outputCostPerMillion: 0,
    };
  }
  return {
    ...current,
    provider,
    ...bindingFromPreset(provider, preset),
  };
}

function TierModelCell({
  binding,
  readOnly,
  onUpdate,
}: {
  binding: ProviderConfig["tiers"][typeof tierOrder[number]];
  readOnly: boolean;
  onUpdate: (
    patch: Partial<ProviderConfig["tiers"][typeof tierOrder[number]]>,
  ) => void;
}) {
  const catalog = catalogForProvider(binding.provider);
  const custom = isCustomModel(binding.provider, binding.model);
  const codexParts =
    binding.provider === "codex-cli"
      ? parseCodexModelField(binding.model)
      : null;

  function selectPreset(preset: ModelPreset) {
    onUpdate(bindingFromPreset(binding.provider, preset));
  }

  function selectCodexModel(modelId: string) {
    const effort = codexParts?.effort ?? "medium";
    onUpdate({
      model: formatCodexModelField(modelId, effort),
    });
  }

  function selectCodexEffort(effort: CodexReasoningEffort) {
    const modelId = codexParts?.modelId ?? "default";
    onUpdate({
      model: formatCodexModelField(modelId, effort),
    });
  }

  if (!catalog || catalog.presets.length === 0) {
    return (
      <input
        disabled={readOnly}
        onChange={(event) => onUpdate({ model: event.target.value })}
        value={binding.model}
      />
    );
  }

  const presetValue = custom
    ? "__custom__"
    : (matchPreset(binding.provider, binding.model)?.id ??
      codexParts?.modelId ??
      binding.model);

  return (
    <div className="tier-model-cell">
      <select
        disabled={readOnly}
        onChange={(event) => {
          const value = event.target.value;
          if (value === "__custom__") {
            onUpdate({ model: "" });
            return;
          }
          const preset = catalog.presets.find((item) => item.id === value);
          if (preset) selectPreset(preset);
          else if (binding.provider === "codex-cli") selectCodexModel(value);
        }}
        value={presetValue}
      >
        {catalog.presets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.label}
          </option>
        ))}
        {catalog.allowCustom ? (
          <option value="__custom__">직접 입력…</option>
        ) : null}
      </select>
      {custom ? (
        <input
          className="tier-model-custom"
          disabled={readOnly}
          onChange={(event) => onUpdate({ model: event.target.value })}
          placeholder={catalog.customHint ?? "모델 ID"}
          value={binding.model}
        />
      ) : null}
      {binding.provider === "codex-cli" && !custom ? (
        <select
          className="tier-effort-select"
          disabled={readOnly}
          onChange={(event) =>
            selectCodexEffort(event.target.value as CodexReasoningEffort)
          }
          title="Codex 추론 강도 (model_reasoning_effort)"
          value={codexParts?.effort ?? "medium"}
        >
          {CODEX_REASONING_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

export function ModelTierSection({
  tiers,
  concurrency,
  onTiersChange,
  onConcurrencyChange,
  readOnly = false,
}: ModelTierSectionProps) {
  return (
    <>
      <div className="settings-section" id="model-tier">
        <h2>모델 티어</h2>
        <p className="settings-note">
          Provider를 바꾸면 대표 모델과 토큰 단가가 자동으로 채워집니다. Codex는
          추론 강도(minimal~xhigh)도 지정할 수 있습니다. 변경 후 「저장」을
          누르세요.
        </p>
        <div className="settings-table-wrap">
          <table className="settings-table settings-table-tier">
            <thead>
              <tr>
                <th>티어</th>
                <th>Provider</th>
                <th>모델</th>
                <th>입력 $/1M</th>
                <th>출력 $/1M</th>
              </tr>
            </thead>
            <tbody>
              {tierOrder.map((tier) => {
                const binding = tiers[tier];
                const update = (
                  patch: Partial<(typeof tiers)[typeof tier]>,
                ) => onTiersChange({ ...tiers, [tier]: { ...binding, ...patch } });
                return (
                  <tr key={tier}>
                    <td>
                      <span className={`tier-badge tier-${tier}`}>{tier}</span>
                    </td>
                    <td>
                      <select
                        disabled={readOnly}
                        onChange={(event) => {
                          const provider = event.target.value;
                          onTiersChange({
                            ...tiers,
                            [tier]: applyProviderDefaults(provider, binding),
                          });
                        }}
                        value={binding.provider}
                      >
                        {providerOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <TierModelCell
                        binding={binding}
                        onUpdate={update}
                        readOnly={readOnly}
                      />
                    </td>
                    <td>
                      <input
                        disabled={readOnly}
                        inputMode="decimal"
                        onChange={(event) =>
                          update({
                            inputCostPerMillion: Number(event.target.value) || 0,
                          })
                        }
                        title="자동 채움 — 필요 시 수정"
                        value={binding.inputCostPerMillion}
                      />
                    </td>
                    <td>
                      <input
                        disabled={readOnly}
                        inputMode="decimal"
                        onChange={(event) =>
                          update({
                            outputCostPerMillion: Number(event.target.value) || 0,
                          })
                        }
                        title="자동 채움 — 필요 시 수정"
                        value={binding.outputCostPerMillion}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="settings-section">
        <h2>동시 실행</h2>
        <label className="settings-inline">
          최대 동시 LLM 호출 수
          <input
            disabled={readOnly}
            max={12}
            min={1}
            onChange={(event) =>
              onConcurrencyChange(
                Math.max(1, Math.min(12, Number(event.target.value) || 1)),
              )
            }
            type="number"
            value={concurrency}
          />
        </label>
      </div>
    </>
  );
}
