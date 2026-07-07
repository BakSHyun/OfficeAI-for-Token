export function buildDeliverableMarkdown(title: string, body: string) {
  const trimmed = body.trimEnd();
  return `# ${title}\n\n${trimmed}\n`;
}

const INVALID_FILE_CHARS = /[<>:"/\\|?*]/g;

export function suggestDeliverableFileName(title: string) {
  const normalized = title
    .trim()
    .replace(INVALID_FILE_CHARS, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return normalized || "deliverable";
}
