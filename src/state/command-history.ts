export const HISTORY_KEY = "officeai.command-history";
export const STARRED_KEY = "officeai.starred-commands";
export const MAX_HISTORY = 20;

export function normalizeCommand(command: string) {
  return command.trim();
}

export function mergeHistory(
  history: string[],
  command: string,
  max = MAX_HISTORY,
) {
  const normalized = normalizeCommand(command);
  if (!normalized) return history;
  return [normalized, ...history.filter((item) => item !== normalized)].slice(
    0,
    max,
  );
}

export function filterSuggestions(
  history: string[],
  query: string,
  limit = 8,
) {
  const trimmed = query.trim();
  if (!trimmed) return history.slice(0, limit);
  const lower = trimmed.toLowerCase();
  return history
    .filter((item) => item.toLowerCase().includes(lower))
    .slice(0, limit);
}

function readJsonArray(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function writeJsonArray(key: string, values: string[]) {
  localStorage.setItem(key, JSON.stringify(values));
}

export function loadHistory() {
  return readJsonArray(HISTORY_KEY);
}

export function pushCommand(command: string) {
  writeJsonArray(HISTORY_KEY, mergeHistory(loadHistory(), command));
}

export function loadStarred() {
  return readJsonArray(STARRED_KEY);
}

export function isStarred(command: string) {
  const normalized = normalizeCommand(command);
  return loadStarred().includes(normalized);
}

export function toggleStarred(command: string) {
  const normalized = normalizeCommand(command);
  if (!normalized) return false;
  const starred = loadStarred();
  const exists = starred.includes(normalized);
  const next = exists
    ? starred.filter((item) => item !== normalized)
    : [normalized, ...starred];
  writeJsonArray(STARRED_KEY, next);
  return !exists;
}

export function getSuggestions(query: string, limit = 8) {
  return filterSuggestions(loadHistory(), query, limit);
}
