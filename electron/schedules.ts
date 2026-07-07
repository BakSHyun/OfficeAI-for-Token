export type ScheduledTask = {
  id: string;
  command: string;
  /** 0=일요일 … 6=토요일 (`Date.getDay()`) */
  weekdays: number[];
  hour: number;
  minute: number;
  enabled: boolean;
  /** 같은 분에 중복 실행 방지 (`YYYY-MM-DDTHH:mm`) */
  lastRunKey?: string;
};

export const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function runKeyForDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

export function normalizeScheduledTask(
  task: Partial<ScheduledTask> & Pick<ScheduledTask, "id" | "command">,
): ScheduledTask {
  const weekdays = (task.weekdays ?? []).filter(
    (day) => Number.isInteger(day) && day >= 0 && day <= 6,
  );
  return {
    id: task.id,
    command: task.command.trim(),
    weekdays: [...new Set(weekdays)].sort((a, b) => a - b),
    hour: Math.min(23, Math.max(0, Number(task.hour) || 0)),
    minute: Math.min(59, Math.max(0, Number(task.minute) || 0)),
    enabled: task.enabled !== false,
    lastRunKey: task.lastRunKey,
  };
}

export function findDueSchedules(
  tasks: ScheduledTask[],
  now = new Date(),
): ScheduledTask[] {
  const key = runKeyForDate(now);
  return tasks.filter(
    (task) =>
      task.enabled &&
      task.command.length > 0 &&
      task.weekdays.includes(now.getDay()) &&
      task.hour === now.getHours() &&
      task.minute === now.getMinutes() &&
      task.lastRunKey !== key,
  );
}

export function markSchedulesRan(
  tasks: ScheduledTask[],
  ranIds: string[],
  at = new Date(),
): ScheduledTask[] {
  if (ranIds.length === 0) return tasks;
  const key = runKeyForDate(at);
  const ran = new Set(ranIds);
  return tasks.map((task) =>
    ran.has(task.id) ? { ...task, lastRunKey: key } : task,
  );
}

export function formatScheduleWhen(task: ScheduledTask): string {
  const days =
    task.weekdays.length === 7
      ? "매일"
      : task.weekdays.map((day) => WEEKDAY_LABELS[day]).join("·");
  const hh = String(task.hour).padStart(2, "0");
  const mm = String(task.minute).padStart(2, "0");
  return `${days} ${hh}:${mm}`;
}
