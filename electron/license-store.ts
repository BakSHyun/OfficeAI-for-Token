import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { LicenseState } from "./license";

export async function loadLicenseState(userDataDir: string): Promise<LicenseState> {
  const path = join(userDataDir, "license.json");
  if (!existsSync(path)) {
    return { apiRunsUsed: 0 };
  }
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as Partial<LicenseState>;
    return {
      key: typeof parsed.key === "string" ? parsed.key : undefined,
      apiRunsUsed: Number(parsed.apiRunsUsed) || 0,
    };
  } catch {
    return { apiRunsUsed: 0 };
  }
}

export async function saveLicenseState(
  userDataDir: string,
  state: LicenseState,
) {
  await mkdir(userDataDir, { recursive: true });
  await writeFile(
    join(userDataDir, "license.json"),
    JSON.stringify(state, null, 2),
    "utf8",
  );
}
