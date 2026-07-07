import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RunEvent } from "../src/orchestration/contracts";
import { buildDiagnosticBundle } from "../../electron/diagnostic-export";
import {
  redactSensitiveJson,
  redactSensitiveText,
} from "../src/security/redaction";

describe("diagnostic export", () => {
  it("redactSensitiveJson은 API 키 패턴을 제거한다", () => {
    const redacted = redactSensitiveJson({
      command: "test",
      api_key: "sk-abcdefghijklmnopqrstuvwxyz123456",
      nested: { token: "Bearer abcdefghijklmnopqrstuvwxyz" },
    });
    const text = JSON.stringify(redacted);
    assert.doesNotMatch(text, /sk-abcdefghijklmnopqrstuvwxyz123456/);
    assert.doesNotMatch(text, /abcdefghijklmnopqrstuvwxyz/);
    assert.match(text, /REDACTED/);
  });

  it("buildDiagnosticBundle은 시크릿이 포함된 이벤트를 redaction한다", () => {
    const events: RunEvent[] = [
      {
        type: "run:started",
        runId: "run-1",
        command: "api_key=super-secret-value",
        at: "2026-07-07T00:00:00.000Z",
      },
      {
        type: "run:failed",
        runId: "run-1",
        error: "OpenAI API 401: sk-badkey1234567890",
        at: "2026-07-07T00:01:00.000Z",
      },
    ];
    const bundle = buildDiagnosticBundle({
      appName: "OfficeAI",
      appVersion: "0.1.0",
      providers: {
        concurrency: 4,
        tiers: {
          local: {
            provider: "mock",
            model: "mock-local",
            inputCostPerMillion: 0,
            outputCostPerMillion: 0,
          },
          economy: {
            provider: "mock",
            model: "mock-economy",
            inputCostPerMillion: 0,
            outputCostPerMillion: 0,
          },
          standard: {
            provider: "mock",
            model: "mock-standard",
            inputCostPerMillion: 0,
            outputCostPerMillion: 0,
          },
          premium: {
            provider: "mock",
            model: "mock-premium",
            inputCostPerMillion: 0,
            outputCostPerMillion: 0,
          },
        },
      },
      apiKeyPresence: { openai: true },
      usage: { inputTokens: 1, outputTokens: 2, costUsd: 0.01 },
      recentRuns: [
        {
          runId: "run-1",
          command: "test",
          status: "failed",
          summary: "",
          inputTokens: 1,
          outputTokens: 2,
          costUsd: 0.01,
          startedAt: "2026-07-07T00:00:00.000Z",
          finishedAt: "2026-07-07T00:01:00.000Z",
        },
      ],
      runEvents: () => events,
    });

    const exported = JSON.stringify(bundle);
    assert.doesNotMatch(exported, /super-secret-value/);
    assert.doesNotMatch(exported, /sk-badkey1234567890/);
    assert.equal(bundle.app.version, "0.1.0");
    assert.equal(bundle.events.length, 2);
    assert.equal(redactSensitiveText(exported).redactionCount, 0);
  });
});
