import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { EMPLOYEE_CATALOG } from "../shared/employee-catalog";
import {
  buildEntitlement,
  ownedSkusFromPayloads,
} from "../shared/entitlement";
import type { EmployeeSkuId, Entitlement } from "../shared/employees";
import type { LicensePayload } from "../shared/license-core";
import { verifyLicenseKey } from "../shared/license-crypto";
import { normalizeLicenseKeys } from "../shared/license-core";
import type { LicenseState } from "../shared/license-core";

const ROSTER_FILE = "employee-roster.json";

type RosterFile = {
  activeSkus: EmployeeSkuId[];
};

export function rosterPath(userDataPath: string) {
  return join(userDataPath, ROSTER_FILE);
}

function validPayloadsFromKeys(keys: string[]): LicensePayload[] {
  const payloads: LicensePayload[] = [];
  for (const key of keys) {
    const verified = verifyLicenseKey(key);
    if (verified.valid) payloads.push(verified.payload);
  }
  return payloads;
}

export function entitlementFromLicenseState(state: LicenseState): Entitlement {
  const keys = normalizeLicenseKeys(state);
  const ownedSkus = ownedSkusFromPayloads(validPayloadsFromKeys(keys));
  return buildEntitlement(ownedSkus, ownedSkus);
}

export async function loadActiveSkus(userDataPath: string): Promise<EmployeeSkuId[]> {
  const path = rosterPath(userDataPath);
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as RosterFile;
    return Array.isArray(parsed.activeSkus) ? parsed.activeSkus : [];
  } catch {
    return [];
  }
}

export async function saveActiveSkus(
  userDataPath: string,
  activeSkus: EmployeeSkuId[],
) {
  await mkdir(userDataPath, { recursive: true });
  await writeFile(
    rosterPath(userDataPath),
    `${JSON.stringify({ activeSkus }, null, 2)}\n`,
    "utf8",
  );
}

export async function loadEntitlement(
  userDataPath: string,
  licenseState: LicenseState,
): Promise<Entitlement> {
  const ownedSkus = ownedSkusFromPayloads(
    validPayloadsFromKeys(normalizeLicenseKeys(licenseState)),
  );
  const activeSkus = await loadActiveSkus(userDataPath);
  return buildEntitlement(ownedSkus, activeSkus);
}

export function getEmployeeCatalog() {
  return EMPLOYEE_CATALOG;
}
