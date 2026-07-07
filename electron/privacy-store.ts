import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PrivacySettings } from "./ipc-contract";

const defaultPrivacySettings: PrivacySettings = {
  crashReporting: false,
};

export async function loadPrivacySettings(
  userDataDir: string,
): Promise<PrivacySettings> {
  const path = join(userDataDir, "privacy.json");
  if (!existsSync(path)) return defaultPrivacySettings;
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as Partial<PrivacySettings>;
    return {
      crashReporting: Boolean(parsed.crashReporting),
    };
  } catch {
    return defaultPrivacySettings;
  }
}

export async function savePrivacySettings(
  userDataDir: string,
  settings: PrivacySettings,
) {
  await mkdir(userDataDir, { recursive: true });
  await writeFile(
    join(userDataDir, "privacy.json"),
    JSON.stringify(settings, null, 2),
    "utf8",
  );
}
