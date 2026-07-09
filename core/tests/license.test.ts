import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  LICENSE_PREFIX,
  planUsesPaidApi,
  signLicensePayload,
  verifyLicenseKey,
  buildLicenseStatus,
} from "../../shared/license-crypto.ts";
import { ownedSkusFromPayloads } from "../../shared/entitlement";
import type { DispatchPlan } from "../src/orchestration/contracts";
import type { ProviderConfig } from "../src/providers/contracts";

const privateKey = readFileSync(
  join(process.cwd(), "config", "license-private.pem"),
  "utf8",
);

test("verifyLicenseKey는 유효한 키를 통과시킨다", () => {
  const key = signLicensePayload(
    {
      v: 1,
      email: "trial@officeai.test",
      expiresAt: "2099-12-31",
      edition: "standard",
    },
    privateKey,
  );
  assert.ok(key.startsWith(`${LICENSE_PREFIX}.`));
  const result = verifyLicenseKey(key);
  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.payload.email, "trial@officeai.test");
  }
});

test("verifyLicenseKey는 만료된 키를 거부한다", () => {
  const key = signLicensePayload(
    { v: 1, email: "old@officeai.test", expiresAt: "2000-01-01" },
    privateKey,
  );
  const result = verifyLicenseKey(key);
  assert.equal(result.valid, false);
});

test("verifyLicenseKey는 employees 필드를 읽는다", () => {
  const key = signLicensePayload(
    {
      v: 1,
      email: "emp@officeai.test",
      expiresAt: "2099-12-31",
      employees: ["developer", "pm"],
    },
    privateKey,
  );
  const result = verifyLicenseKey(key);
  assert.equal(result.valid, true);
  if (result.valid) {
    assert.deepEqual(result.payload.employees, ["developer", "pm"]);
    const owned = ownedSkusFromPayloads([result.payload]);
    assert.ok(owned.includes("developer"));
    assert.ok(owned.includes("planner"));
  }
});

test("buildLicenseStatus는 체험 잔여 횟수를 계산한다", () => {
  const status = buildLicenseStatus({ apiRunsUsed: 3 }, false);
  assert.equal(status.mode, "trial");
  assert.equal(status.trialApiRunsRemaining, 7);
});

test("planUsesPaidApi는 mock provider 실행은 체험 차감 대상이 아니다", () => {
  const providers = {
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
    concurrency: 4,
    apiKeys: {},
  } satisfies ProviderConfig;

  const plan = {
    units: [{ tier: "premium", model: "mock-premium" }],
  } as DispatchPlan;

  assert.equal(planUsesPaidApi(plan, providers), false);
});

test("planUsesPaidApi는 유료 API 티어를 감지한다", () => {
  const providers = {
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
        provider: "openai",
        model: "gpt-4.1-mini",
        inputCostPerMillion: 1,
        outputCostPerMillion: 2,
      },
      premium: {
        provider: "openai",
        model: "gpt-4.1",
        inputCostPerMillion: 2,
        outputCostPerMillion: 4,
      },
    },
    concurrency: 4,
    apiKeys: {},
  } satisfies ProviderConfig;

  const plan = {
    units: [{ tier: "standard", model: "gpt-4.1-mini" }],
  } as DispatchPlan;

  assert.equal(planUsesPaidApi(plan, providers), true);
});
