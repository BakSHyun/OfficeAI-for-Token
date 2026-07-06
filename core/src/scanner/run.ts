import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { WorkEvent } from "../contracts";
import { deriveWorkProfile, type WorkProfile } from "../memory/work-profile";
import type { ScannerConfig } from "./config";
import { scanSource } from "./connectors";

export type ScanResult = {
  events: WorkEvent[];
  outputPath: string;
  profilePath: string;
  profile: WorkProfile;
  sourceCounts: Record<string, number>;
};

export async function runScan(config: ScannerConfig): Promise<ScanResult> {
  const batches = await Promise.all(
    config.sources.map(async (source) => ({
      source,
      events: await scanSource(source, config),
    })),
  );

  const deduplicated = new Map<string, WorkEvent>();
  for (const { events } of batches) {
    for (const event of events) deduplicated.set(event.id, event);
  }

  const events = [...deduplicated.values()].sort((a, b) =>
    b.occurredAt.localeCompare(a.occurredAt),
  );
  const outputDirectory = resolve(config.outputDir);
  await mkdir(outputDirectory, { recursive: true });
  const outputPath = join(outputDirectory, "work-events.jsonl");
  await writeFile(
    outputPath,
    events.map((event) => JSON.stringify(event)).join("\n") + "\n",
    "utf8",
  );
  const profile = deriveWorkProfile(events);
  const profilePath = join(outputDirectory, "work-profile.json");
  await writeFile(profilePath, JSON.stringify(profile, null, 2) + "\n", "utf8");

  return {
    events,
    outputPath,
    profilePath,
    profile,
    sourceCounts: Object.fromEntries(
      batches.map(({ source, events: sourceEvents }) => [
        `${source.kind}:${source.label}`,
        sourceEvents.length,
      ]),
    ),
  };
}
