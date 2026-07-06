import { homedir } from "node:os";
import { resolve } from "node:path";

export function expandEnvironment(
  input: string,
  environment: NodeJS.ProcessEnv = process.env,
) {
  return input.replace(/\$\{([A-Z0-9_]+)\}/gi, (_, name: string) => {
    const value = environment[name];
    if (!value) throw new Error(`Environment variable ${name} is not set.`);
    return value;
  });
}

export function expandHome(path: string, home = homedir()) {
  if (path === "~") return home;
  if (path.startsWith("~/") || path.startsWith("~\\")) {
    return resolve(home, path.slice(2));
  }
  return path;
}

export function resolveConfiguredPath(
  path: string,
  environment: NodeJS.ProcessEnv = process.env,
) {
  return resolve(expandHome(expandEnvironment(path, environment)));
}
