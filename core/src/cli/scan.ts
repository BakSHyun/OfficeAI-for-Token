import { resolve } from "node:path";
import { loadScannerConfig } from "../scanner/config";
import { runScan } from "../scanner/run";

function configPath(args: string[]) {
  const index = args.indexOf("--config");
  if (index >= 0 && args[index + 1]) return args[index + 1];
  return "config/sources.local.json";
}

const path = resolve(configPath(process.argv.slice(2)));
const config = await loadScannerConfig(path);
const result = await runScan(config);

console.log(
  JSON.stringify(
    {
      outputPath: result.outputPath,
      profilePath: result.profilePath,
      totalEvents: result.events.length,
      sourceCounts: result.sourceCounts,
      restrictedEvents: result.events.filter(
        (event) => event.sensitivity === "restricted",
      ).length,
      currentFocus: result.profile.currentFocus,
      topProjects: result.profile.topProjects.slice(0, 5),
      topThemes: result.profile.topThemes.slice(0, 8),
    },
    null,
    2,
  ),
);
