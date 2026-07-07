import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isSafeRelativePath,
  parseActionProposals,
} from "../../shared/action-blocks";

describe("action-blocks 파서", () => {
  it("officeai-action 펜스에서 write-file/run-command를 읽는다", () => {
    const markdown = [
      "설명 텍스트",
      "```officeai-action",
      JSON.stringify([
        { kind: "write-file", path: "docs/plan.md", content: "# 계획" },
        { kind: "run-command", command: "npm run lint" },
      ]),
      "```",
    ].join("\n");
    const actions = parseActionProposals(markdown);
    assert.equal(actions.length, 2);
    assert.deepEqual(actions[0], {
      kind: "write-file",
      path: "docs/plan.md",
      content: "# 계획",
    });
    assert.deepEqual(actions[1], {
      kind: "run-command",
      command: "npm run lint",
    });
  });

  it("펜스 info의 path= 속성으로 write-file을 감지한다", () => {
    const markdown = [
      "```ts path=src/util.ts",
      "export const x = 1;",
      "```",
    ].join("\n");
    const actions = parseActionProposals(markdown);
    assert.equal(actions.length, 1);
    assert.equal(actions[0].kind, "write-file");
    assert.equal((actions[0] as { path: string }).path, "src/util.ts");
  });

  it('펜스 위 "파일: 경로" 라벨로 write-file을 감지한다', () => {
    const markdown = [
      "### 파일: `notes/todo.md`",
      "```markdown",
      "- 할 일",
      "```",
    ].join("\n");
    const actions = parseActionProposals(markdown);
    assert.equal(actions.length, 1);
    assert.equal((actions[0] as { path: string }).path, "notes/todo.md");
  });

  it("같은 경로는 첫 번째 것만 유지한다", () => {
    const markdown = [
      "```md path=a.md",
      "first",
      "```",
      "```md path=a.md",
      "second",
      "```",
    ].join("\n");
    const actions = parseActionProposals(markdown);
    assert.equal(actions.length, 1);
    assert.equal((actions[0] as { content: string }).content, "first");
  });

  it("경로 탈출과 절대 경로를 차단한다", () => {
    assert.equal(isSafeRelativePath("../secret.txt"), false);
    assert.equal(isSafeRelativePath("/etc/passwd"), false);
    assert.equal(isSafeRelativePath("C:/windows/a.txt"), false);
    assert.equal(isSafeRelativePath("docs/../../a.txt"), false);
    assert.equal(isSafeRelativePath("docs/a.txt"), true);
    const markdown = [
      "```officeai-action",
      JSON.stringify({
        kind: "write-file",
        path: "../escape.md",
        content: "x",
      }),
      "```",
    ].join("\n");
    assert.equal(parseActionProposals(markdown).length, 0);
  });

  it("라벨/속성 없는 일반 코드 펜스는 무시한다", () => {
    const markdown = ["```python", "print(1)", "```"].join("\n");
    assert.equal(parseActionProposals(markdown).length, 0);
  });
});
