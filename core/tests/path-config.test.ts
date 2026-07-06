import assert from "node:assert/strict";
import test from "node:test";
import {
  expandEnvironment,
  expandHome,
  resolveConfiguredPath,
} from "../src/config/path";

test("expands macOS home and repository environment variables", () => {
  assert.equal(
    expandHome("~/dev/gtsn-backend", "/Users/tester"),
    resolveConfiguredPath("/Users/tester/dev/gtsn-backend"),
  );
  assert.equal(
    expandEnvironment("${GTSN_BACKEND_ROOT}", {
      GTSN_BACKEND_ROOT: "/Users/tester/dev/gtsn-backend",
    }),
    "/Users/tester/dev/gtsn-backend",
  );
});
