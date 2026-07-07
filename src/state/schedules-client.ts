import type { ScheduledTask } from "./bridge-types";

export const SCHEDULES_KEY = "officeai.schedules";

export const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function formatScheduleWhen(task: ScheduledTask): string {
  const days =
    task.weekdays.length === 7
      ? "매일"
      : task.weekdays.map((day) => WEEKDAY_LABELS[day]).join("·");
  const hh = String(task.hour).padStart(2, "0");
  const mm = String(task.minute).padStart(2, "0");
  return `${days} ${hh}:${mm}`;
}

export function loadSchedulesLocal(): ScheduledTask[] {
  try {
    const raw = localStorage.getItem(SCHEDULES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScheduledTask[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSchedulesLocal(tasks: ScheduledTask[]) {
  localStorage.setItem(SCHEDULES_KEY, JSON.stringify(tasks));
}

export async function loadSchedules(): Promise<ScheduledTask[]> {
  const bridge = window.officeai;
  if (bridge) return bridge.getSchedules();
  return loadSchedulesLocal();
}

export async function saveSchedules(tasks: ScheduledTask[]): Promise<void> {
  const bridge = window.officeai;
  if (bridge) {
    await bridge.saveSchedules(tasks);
    return;
  }
  saveSchedulesLocal(tasks);
}
