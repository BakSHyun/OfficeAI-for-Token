import { execFileSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { basename, dirname, relative, sep } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import type { WorkEvent } from "../contracts";
import type { ScannerConfig, SourceConfig } from "./config";
import { walkFiles } from "./files";
import {
  createWorkEvent,
  relativeRef,
  tagsFromText,
  titleFromText,
} from "./normalize";

function normalizeMarkdown(raw: string) {
  return raw
    .replace(/^---[\s\S]*?---\s*/m, "")
    .replace(/```[\s\S]*?```/g, "[code block]")
    .trim();
}

function projectFromTranscriptPath(root: string, path: string) {
  const relativePath = relative(root, path);
  return relativePath.split(sep)[0] || "cursor";
}

function timestampFromText(text: string, fallback: string) {
  const raw = text.match(/<timestamp>\s*([\s\S]*?)\s*<\/timestamp>/i)?.[1];
  if (!raw) return fallback;
  const normalized = raw.replace(/\(UTC([+-]\d{1,2})\)/i, (_, offset) => {
    const sign = offset.startsWith("-") ? "-" : "+";
    const hours = offset.replace(/[+-]/, "").padStart(2, "0");
    return `GMT${sign}${hours}00`;
  });
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function extractUserQuery(text: string) {
  const query = text.match(/<user_query>\s*([\s\S]*?)\s*<\/user_query>/i)?.[1];
  return (query ?? text)
    .replace(/<timestamp>[\s\S]*?<\/timestamp>/gi, "")
    .replace(/^@\S+\s+\(\d+-\d+\)\s*$/gm, "")
    .trim();
}

export async function scanMarkdown(
  source: SourceConfig,
  config: ScannerConfig,
  kind: "markdown" | "cursor-plan",
): Promise<WorkEvent[]> {
  const files = await walkFiles(source.root, (path) =>
    path.toLocaleLowerCase().endsWith(".md"),
  );
  const output: WorkEvent[] = [];

  for (const path of files) {
    const info = await stat(path);
    if (info.size > config.maxFileBytes) continue;
    const raw = await readFile(path, "utf8");
    const content = normalizeMarkdown(raw).slice(0, 12_000);
    if (!content) continue;

    output.push(
      createWorkEvent({
        kind,
        project: source.label,
        occurredAt: info.mtime.toISOString(),
        title: titleFromText(content, basename(path)),
        summary: content,
        sourceRef: `${source.label}:${relativeRef(source.root, path)}`,
        confidence: kind === "cursor-plan" ? 0.92 : 0.88,
        tags: tagsFromText(content),
        metadata: {
          bytes: info.size,
          absolutePath: path,
        },
      }),
    );
  }

  return output;
}

export async function scanCursorTranscripts(
  source: SourceConfig,
  config: ScannerConfig,
): Promise<WorkEvent[]> {
  const files = await walkFiles(source.root, (path) =>
    path.toLocaleLowerCase().endsWith(".jsonl"),
  );
  const output: WorkEvent[] = [];

  for (const path of files) {
    const info = await stat(path);
    const rawProject = projectFromTranscriptPath(source.root, path);
    const project = config.projectAliases[rawProject] ?? rawProject;
    const stream = createReadStream(path, { encoding: "utf8" });
    const lines = createInterface({ input: stream, crlfDelay: Infinity });
    let lineNumber = 0;
    const fileEvents: WorkEvent[] = [];

    for await (const line of lines) {
      lineNumber += 1;

      let parsed: {
        role?: string;
        message?: {
          content?: Array<{ type?: string; text?: string }>;
        };
      };
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      if (parsed.role !== "user" || !Array.isArray(parsed.message?.content)) {
        continue;
      }

      const text = parsed.message.content
        .filter((part) => part.type === "text" && part.text)
        .map((part) => part.text)
        .join("\n");
      const query = extractUserQuery(text);
      if (query.length < 8) continue;

      const event = createWorkEvent({
        kind: "cursor-transcript",
        project,
        occurredAt: timestampFromText(text, info.mtime.toISOString()),
        title: titleFromText(query, basename(path)),
        summary: query.slice(0, 4_000),
        sourceRef: `${source.label}:${relativeRef(source.root, path)}#L${lineNumber}`,
        confidence: 0.72,
        tags: tagsFromText(`${project} ${query}`),
        metadata: {
          transcriptBytes: info.size,
          absolutePath: path,
        },
      });
      fileEvents.push(event);
      if (fileEvents.length > config.maxTranscriptEventsPerFile) {
        fileEvents.shift();
      }
    }
    output.push(...fileEvents);
  }

  return output;
}

export async function scanCursorWorkspaces(
  source: SourceConfig,
): Promise<WorkEvent[]> {
  const files = await walkFiles(
    source.root,
    (path) => basename(path).toLocaleLowerCase() === "workspace.json",
  );
  const output: WorkEvent[] = [];

  for (const path of files) {
    const info = await stat(path);
    try {
      const parsed = JSON.parse(await readFile(path, "utf8")) as {
        folder?: string;
      };
      if (!parsed.folder) continue;
      const folderPath = parsed.folder.startsWith("file:")
        ? fileURLToPath(parsed.folder)
        : parsed.folder;
      const title = basename(folderPath);

      output.push(
        createWorkEvent({
          kind: "cursor-workspace",
          project: title,
          occurredAt: info.mtime.toISOString(),
          title: `Cursor workspace: ${title}`,
          summary: `Cursor workspace root ${folderPath}`,
          sourceRef: `${source.label}:${relativeRef(source.root, path)}`,
          confidence: 0.65,
          tags: ["workspace"],
          metadata: {
            workspaceRoot: folderPath,
            storageDirectory: dirname(path),
          },
        }),
      );
    } catch {
      continue;
    }
  }

  return output;
}

export async function scanGit(source: SourceConfig): Promise<WorkEvent[]> {
  let raw: string;
  try {
    raw = execFileSync(
      "git",
      [
        "-C",
        source.root,
        "log",
        "-200",
        "--date=iso-strict",
        "--pretty=format:%H%x1f%ad%x1f%s",
      ],
      { encoding: "utf8", windowsHide: true },
    );
  } catch {
    return [];
  }

  const commits = raw
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      const [hash, occurredAt, subject] = line.split("\u001f");
      if (!hash || !occurredAt || !subject) return [];
      return [
        createWorkEvent({
          kind: "git-commit",
          project: source.label,
          occurredAt,
          title: subject,
          summary: subject,
          sourceRef: `${source.label}:git:${hash}`,
          confidence: 0.96,
          tags: tagsFromText(`${source.label} ${subject}`),
          metadata: {
            commit: hash,
            repositoryRoot: source.root,
          },
        }),
      ];
    });
  let status = "";
  try {
    status = execFileSync(
      "git",
      [
        "-C",
        source.root,
        "status",
        "--short",
        "--branch",
        "--untracked-files=no",
      ],
      { encoding: "utf8", windowsHide: true },
    ).trim();
  } catch {
    return commits;
  }
  const lines = status.split(/\r?\n/).filter(Boolean);
  const branch = lines[0]?.replace(/^##\s*/, "") ?? "unknown";
  const changedFiles = lines.slice(1);
  const statusEvent = createWorkEvent({
    kind: "git-status",
    project: source.label,
    occurredAt: new Date().toISOString(),
    title: `Working tree: ${branch}`,
    summary:
      changedFiles.length > 0
        ? `${changedFiles.length} changed files\n${changedFiles.join("\n")}`
        : "Working tree clean",
    sourceRef: `${source.label}:git:working-tree`,
    confidence: 0.99,
    tags: tagsFromText(`${source.label} ${branch} ${changedFiles.join(" ")}`),
    metadata: {
      branch,
      changedFileCount: changedFiles.length,
      repositoryRoot: source.root,
    },
  });

  return [...commits, statusEvent];
}

export async function scanSource(
  source: SourceConfig,
  config: ScannerConfig,
): Promise<WorkEvent[]> {
  switch (source.kind) {
    case "markdown":
      return scanMarkdown(source, config, "markdown");
    case "cursor-plans":
      return scanMarkdown(source, config, "cursor-plan");
    case "cursor-transcripts":
      return scanCursorTranscripts(source, config);
    case "cursor-workspaces":
      return scanCursorWorkspaces(source);
    case "git":
      return scanGit(source);
  }
}
