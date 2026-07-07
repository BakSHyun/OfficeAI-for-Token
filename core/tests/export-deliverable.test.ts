import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDeliverableMarkdown,
  suggestDeliverableFileName,
} from "../../electron/deliverable-export";

describe("deliverable export", () => {
  it("buildDeliverableMarkdown은 제목과 본문 전체를 담는다", () => {
    const markdown = buildDeliverableMarkdown("요약 보고", "첫 줄\n둘째 줄");
    assert.equal(markdown, "# 요약 보고\n\n첫 줄\n둘째 줄\n");
  });

  it("suggestDeliverableFileName은 파일명에 쓸 수 없는 문자를 제거한다", () => {
    assert.equal(
      suggestDeliverableFileName('보고서: "최종"'),
      "보고서-최종",
    );
  });
});
