import assert from "node:assert/strict";
import test from "node:test";
import { redactSensitiveText } from "../src/security/redaction";

test("redacts common secret shapes before indexing", () => {
  const input =
    'Authorization: Bearer abcdefghijklmnopqrstuvwxyz and api_key=super-secret-value and {"token":"another-secret"}';
  const result = redactSensitiveText(input);

  assert.equal(result.redactionCount, 3);
  assert.doesNotMatch(result.text, /abcdefghijklmnopqrstuvwxyz/);
  assert.doesNotMatch(result.text, /super-secret-value/);
  assert.doesNotMatch(result.text, /another-secret/);
});
