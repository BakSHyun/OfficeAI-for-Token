import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bindingFromPreset,
  defaultPresetForProvider,
  formatCodexModelField,
  matchPreset,
  parseCodexModelField,
} from "../../shared/provider-model-catalog";

describe("provider-model-catalog", () => {
  it("defaultPresetForProvider는 openai 첫 프리셋을 반환한다", () => {
    const preset = defaultPresetForProvider("openai");
    assert.ok(preset);
    assert.equal(preset?.id, "gpt-4.1-mini");
    assert.ok(preset!.inputCostPerMillion > 0);
  });

  it("bindingFromPreset은 모델과 단가를 채운다", () => {
    const preset = defaultPresetForProvider("anthropic")!;
    const binding = bindingFromPreset("anthropic", preset);
    assert.equal(binding.model, preset.id);
    assert.equal(binding.inputCostPerMillion, preset.inputCostPerMillion);
  });

  it("codex model 필드는 model|effort 형식이다", () => {
    assert.equal(
      formatCodexModelField("gpt-5-codex", "high"),
      "gpt-5-codex|high",
    );
    assert.deepEqual(parseCodexModelField("gpt-5-codex|high"), {
      modelId: "gpt-5-codex",
      effort: "high",
    });
    assert.deepEqual(parseCodexModelField("gpt-5-codex"), {
      modelId: "gpt-5-codex",
    });
  });

  it("matchPreset은 codex modelId로 프리셋을 찾는다", () => {
    const preset = matchPreset("codex-cli", "gpt-5-codex|high");
    assert.equal(preset?.id, "gpt-5-codex");
    assert.equal(parseCodexModelField("gpt-5-codex|high").effort, "high");
  });
});
