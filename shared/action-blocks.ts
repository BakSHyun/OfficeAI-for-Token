/**
 * 산출물(마크다운)에서 실행 가능한 액션 제안을 감지하는 파서.
 * 코어 계약을 건드리지 않기 위해 오케스트레이터 밖(공유 레이어)에서 동작한다.
 * 실행 자체는 electron/action-runner.ts가 담당한다 (renderer는 표시만).
 */

export type WriteFileAction = {
  kind: "write-file";
  /** 항상 forward-slash 정규화된 상대 경로 */
  path: string;
  content: string;
};

export type RunCommandAction = {
  kind: "run-command";
  command: string;
};

export type ActionProposal = WriteFileAction | RunCommandAction;

const WINDOWS_DRIVE = /^[a-zA-Z]:/;
const INVALID_SEGMENT_CHARS = /[<>:"|?*]/;

export function normalizeRelativePath(path: string): string {
  return path.trim().replace(/\\/g, "/").replace(/^\.\//, "");
}

/** 베이스 폴더 탈출(절대 경로, `..`)과 OS 금지 문자를 차단한다. */
export function isSafeRelativePath(path: string): boolean {
  if (!path || path.length > 260) return false;
  if (path.startsWith("/") || WINDOWS_DRIVE.test(path)) return false;
  const segments = path.split("/");
  return segments.every(
    (segment) =>
      segment.length > 0 &&
      segment !== "." &&
      segment !== ".." &&
      !INVALID_SEGMENT_CHARS.test(segment),
  );
}

/** 펜스 info 문자열에서 path=... / file=... / filename=... 속성 추출 */
function pathFromInfo(info: string): string | undefined {
  const match =
    /(?:^|\s)(?:path|file|filename)=(?:"([^"]+)"|'([^']+)'|([^\s"']+))/i.exec(
      info,
    );
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

/** 펜스 바로 위 줄의 "파일: src/foo.ts" / "### file: a.md" 류 라벨 추출 */
function pathFromLabel(line: string): string | undefined {
  const match =
    /^(?:#{1,6}\s+)?(?:\*\*)?\s*(?:파일|file)\s*[:：]\s*`?([^`*]+?)`?\s*(?:\*\*)?\s*$/i.exec(
      line,
    );
  return match?.[1];
}

function parseActionJson(body: string): ActionProposal[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return [];
  }
  const items = Array.isArray(parsed) ? parsed : [parsed];
  const proposals: ActionProposal[] = [];
  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    if (
      record.kind === "write-file" &&
      typeof record.path === "string" &&
      typeof record.content === "string"
    ) {
      const path = normalizeRelativePath(record.path);
      if (isSafeRelativePath(path)) {
        proposals.push({ kind: "write-file", path, content: record.content });
      }
    } else if (
      record.kind === "run-command" &&
      typeof record.command === "string" &&
      record.command.trim().length > 0
    ) {
      proposals.push({ kind: "run-command", command: record.command.trim() });
    }
  }
  return proposals;
}

/**
 * 마크다운에서 액션 제안 추출.
 * 감지 규칙:
 * 1. ```officeai-action 펜스의 JSON (write-file / run-command)
 * 2. 펜스 info의 path=/file= 속성 → write-file
 * 3. 펜스 바로 위 "파일: <경로>" 라벨 → write-file
 * 같은 경로의 write-file은 첫 번째 것만 유지한다.
 */
export function parseActionProposals(markdown: string): ActionProposal[] {
  const lines = markdown.split(/\r?\n/);
  const proposals: ActionProposal[] = [];
  const seenPaths = new Set<string>();
  let lastMeaningfulLine = "";
  let index = 0;

  const pushWriteFile = (rawPath: string, content: string) => {
    const path = normalizeRelativePath(rawPath);
    if (!isSafeRelativePath(path) || seenPaths.has(path)) return;
    seenPaths.add(path);
    proposals.push({ kind: "write-file", path, content });
  };

  while (index < lines.length) {
    const opener = /^\s*(```|~~~)(.*)$/.exec(lines[index]);
    if (!opener) {
      if (lines[index].trim()) lastMeaningfulLine = lines[index].trim();
      index += 1;
      continue;
    }
    const marker = opener[1];
    const info = opener[2].trim();
    const body: string[] = [];
    index += 1;
    while (index < lines.length && !lines[index].trim().startsWith(marker)) {
      body.push(lines[index]);
      index += 1;
    }
    index += 1;
    const content = body.join("\n");
    const lang = info.split(/\s+/)[0] ?? "";
    if (lang.toLowerCase() === "officeai-action") {
      for (const action of parseActionJson(content)) {
        if (action.kind === "write-file") {
          pushWriteFile(action.path, action.content);
        } else {
          proposals.push(action);
        }
      }
    } else {
      const path = pathFromInfo(info) ?? pathFromLabel(lastMeaningfulLine);
      if (path) pushWriteFile(path, content);
    }
    lastMeaningfulLine = "";
  }
  return proposals;
}
