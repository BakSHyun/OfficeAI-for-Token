import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { LicenseState } from "../shared/license-core";
import { normalizeLicenseKeys } from "../shared/license-core";

export { normalizeLicenseKeys };

export async function loadLicenseState(userDataDir: string): Promise<LicenseState> {
  const path = join(userDataDir, "license.json");
  if (!existsSync(path)) {
    return { apiRunsUsed: 0, keys: [] };
  }
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as Partial<LicenseState>;
    return {
      keys: normalizeLicenseKeys(parsed),
      apiRunsUsed: Number(parsed.apiRunsUsed) || 0,
    };
  } catch {
    return { apiRunsUsed: 0, keys: [] };
  }
}

export async function saveLicenseState(
  userDataDir: string,
  state: LicenseState,
) {
  const normalized: LicenseState = {
    keys: normalizeLicenseKeys(state),
    apiRunsUsed: Math.max(0, state.apiRunsUsed),
  };
  await mkdir(userDataDir, { recursive: true });
  await writeFile(
    join(userDataDir, "license.json"),
    `${JSON.stringify(normalized, null, 2)}\n`,
    "utf8",
  );
}
