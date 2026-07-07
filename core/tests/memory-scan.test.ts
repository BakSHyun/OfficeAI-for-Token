import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMemoryScannerConfig } from "../../electron/memory-scan";

describe("memory scan", () => {
  it("buildMemoryScannerConfig는 선택 폴더를 markdown 소스로 스캔한다", () => {
    const config = buildMemoryScannerConfig({
      folderPath: "D:\\vault",
      outputDir: "C:\\userData\\.officeai",
    });
    assert.equal(config.outputDir, "C:\\userData\\.officeai");
    assert.equal(config.sources.length, 1);
    assert.equal(config.sources[0]?.kind, "markdown");
    assert.equal(config.sources[0]?.root, "D:\\vault");
  });
});
