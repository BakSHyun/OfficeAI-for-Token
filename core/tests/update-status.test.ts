import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatUpdateBannerText,
  shouldShowUpdateBanner,
} from "../../electron/update-status";

describe("update-status (G3)", () => {
  it("shouldShowUpdateBanner는 downloaded/downloading/available에서 true", () => {
    assert.equal(
      shouldShowUpdateBanner({
        phase: "downloaded",
        currentVersion: "0.1.0",
        availableVersion: "0.2.0",
      }),
      true,
    );
    assert.equal(
      shouldShowUpdateBanner({ phase: "idle", currentVersion: "0.1.0" }),
      false,
    );
  });

  it("formatUpdateBannerText는 재시작 안내 문구를 만든다", () => {
    const text = formatUpdateBannerText({
      phase: "downloaded",
      currentVersion: "0.1.0",
      availableVersion: "0.2.0",
    });
    assert.match(text, /0\.2\.0/);
    assert.match(text, /재시작/);
  });
});
