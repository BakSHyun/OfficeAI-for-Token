import { readdir } from "node:fs/promises";
import { join } from "node:path";

const ignoredDirectories = new Set([
  ".git",
  ".obsidian",
  ".idea",
  ".vscode",
  "dist",
  "build",
  "node_modules",
  "vendor",
]);

export async function walkFiles(
  root: string,
  predicate: (path: string) => boolean,
): Promise<string[]> {
  const output: string[] = [];
  const queue = [root];

  while (queue.length > 0) {
    const current = queue.pop()!;
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) queue.push(fullPath);
      } else if (entry.isFile() && predicate(fullPath)) {
        output.push(fullPath);
      }
    }
  }

  return output;
}
