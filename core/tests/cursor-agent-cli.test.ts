import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildCursorAgentArgs,
  buildCursorAgentPrompt,
  extractCursorAgentOutput,
  isCursorEditorCliVersion,
  resolveCursorAgentCommand,
} from "../src/providers/cursor-agent-cli";
import type { LLMRequest } from "../src/providers/contracts";

const baseRequest: LLMRequest = {
  tier: "local",
  model: "default",
  messages: [
    { role: "system", content: "간결하게 답하세요." },
    { role: "user", content: "로그인 화면 개선안을 작성해줘." },
  ],
  maxOutputTokens: 800,
};

test("buildCursorAgentPrompt은 역할 라벨과 JSON 스키마 힌트를 포함한다", () => {
  const prompt = buildCursorAgentPrompt({
    ...baseRequest,
    jsonSchema: {
      name: "verdict",
      schema: { type: "object", properties: { approved: { type: "boolean" } } },
    },
  });

  assert.match(prompt, /\[지침\]/);
  assert.match(prompt, /\[요청\]/);
  assert.match(prompt, /JSON 스키마/);
  assert.match(prompt, /approved/);
});

test("buildCursorAgentArgs는 jsonSchema 요청 시 ask 모드로 제한한다", () => {
  const plain = buildCursorAgentArgs(baseRequest);
  assert.ok(plain.includes("--print"));
  assert.ok(!plain.includes("--mode"));

  const structured = buildCursorAgentArgs({
    ...baseRequest,
    jsonSchema: { name: "plan", schema: { type: "object" } },
  });
  assert.deepEqual(structured.slice(0, 2), ["--mode", "ask"]);
});

test("extractCursorAgentOutput은 agent CLI JSON result를 파싱한다", () => {
  const objectOutput = extractCursorAgentOutput(
    JSON.stringify({
      type: "result",
      subtype: "success",
      result: "완료했습니다.",
      usage: { inputTokens: 120, outputTokens: 45 },
    }),
  );
  assert.equal(objectOutput.text, "완료했습니다.");
  assert.equal(objectOutput.inputTokens, 120);
  assert.equal(objectOutput.outputTokens, 45);
});

test("extractCursorAgentOutput은 NDJSON 스트림을 파싱한다", () => {
  const streamOutput = extractCursorAgentOutput(
    [
      '{"type":"progress"}',
      '{"text":"중간"}',
      '{"result":"최종 답","usage":{"prompt_tokens":10,"completion_tokens":5}}',
    ].join("\n"),
  );
  assert.equal(streamOutput.text, "최종 답");
  assert.equal(streamOutput.inputTokens, 10);
  assert.equal(streamOutput.outputTokens, 5);
});

test("resolveCursorAgentCommand는 환경변수를 우선한다", () => {
  const previous = process.env.OFFICEAI_CURSOR_AGENT_COMMAND;
  process.env.OFFICEAI_CURSOR_AGENT_COMMAND = "cursor agent";
  try {
    assert.deepEqual(resolveCursorAgentCommand(), {
      command: "cursor",
      prefixArgs: ["agent"],
    });
  } finally {
    if (previous === undefined) delete process.env.OFFICEAI_CURSOR_AGENT_COMMAND;
    else process.env.OFFICEAI_CURSOR_AGENT_COMMAND = previous;
  }
});

test("isCursorEditorCliVersion은 Cursor 에디터 버전을 구분한다", () => {
  assert.equal(isCursorEditorCliVersion("3.8.23"), true);
  assert.equal(isCursorEditorCliVersion("2026.07.01-41b2de7"), false);
});

test("resolveCursorAgentCommand는 cursor 에디터 설정을 무시한다", () => {
  const resolved = resolveCursorAgentCommand({
    command: "cursor",
    commandPrefixArgs: ["agent"],
  });
  if (process.platform === "win32") {
    assert.notEqual(resolved.command.toLowerCase(), "cursor");
  } else {
    assert.equal(resolved.command, "agent");
  }
});
