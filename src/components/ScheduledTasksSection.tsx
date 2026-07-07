import { useEffect, useState } from "react";
import { CalendarClock, Plus, Trash2 } from "lucide-react";
import type { ScheduledTask } from "../state/bridge-types";
import {
  WEEKDAY_LABELS,
  formatScheduleWhen,
  loadSchedules,
  saveSchedules,
} from "../state/schedules-client";

function createId() {
  return `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ScheduledTasksSection() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [command, setCommand] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([new Date().getDay()]);
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    void loadSchedules().then(setTasks);
  }, []);

  function toggleWeekday(day: number) {
    setWeekdays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort((a, b) => a - b),
    );
  }

  async function persist(next: ScheduledTask[], message?: string) {
    setSaving(true);
    try {
      await saveSchedules(next);
      setTasks(next);
      if (message) setNote(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd() {
    const trimmed = command.trim();
    if (!trimmed || weekdays.length === 0) return;
    const next: ScheduledTask = {
      id: createId(),
      command: trimmed,
      weekdays,
      hour: Math.min(23, Math.max(0, hour)),
      minute: Math.min(59, Math.max(0, minute)),
      enabled: true,
    };
    await persist([next, ...tasks], "정기 업무를 추가했습니다");
    setCommand("");
  }

  async function handleToggle(task: ScheduledTask) {
    const next = tasks.map((entry) =>
      entry.id === task.id ? { ...entry, enabled: !entry.enabled } : entry,
    );
    await persist(next);
  }

  async function handleRemove(taskId: string) {
    await persist(
      tasks.filter((task) => task.id !== taskId),
      "정기 업무를 삭제했습니다",
    );
  }

  return (
    <div className="settings-section schedules-section">
      <h2>
        <CalendarClock size={13} /> 정기 업무
      </h2>
      <p className="settings-note">
        {window.officeai
          ? "예약 시각에 조용히 실행되고, 완료·승인 요청은 알림으로 전달됩니다."
          : "데모 모드에서는 목록만 localStorage에 저장됩니다."}
      </p>

      <div className="schedule-form">
        <label className="schedule-command">
          명령
          <input
            onChange={(event) => setCommand(event.target.value)}
            placeholder="예: 오늘 할 일 브리핑"
            value={command}
          />
        </label>
        <div className="schedule-weekdays">
          <span>요일</span>
          <div>
            {WEEKDAY_LABELS.map((label, day) => (
              <button
                className={
                  weekdays.includes(day) ? "schedule-weekday is-on" : "schedule-weekday"
                }
                key={label}
                onClick={() => toggleWeekday(day)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-fields-row">
          <label className="settings-inline">
            시
            <input
              max={23}
              min={0}
              onChange={(event) => setHour(Number(event.target.value) || 0)}
              type="number"
              value={hour}
            />
          </label>
          <label className="settings-inline">
            분
            <input
              max={59}
              min={0}
              onChange={(event) => setMinute(Number(event.target.value) || 0)}
              type="number"
              value={minute}
            />
          </label>
        </div>
      </div>

      <div className="settings-footer schedules-footer">
        <button
          disabled={saving || !command.trim() || weekdays.length === 0}
          onClick={() => void handleAdd()}
          type="button"
        >
          <Plus size={14} /> 추가
        </button>
        {note ? <small>{note}</small> : null}
      </div>

      {tasks.length > 0 ? (
        <table className="settings-table schedules-table">
          <thead>
            <tr>
              <th>명령</th>
              <th>일정</th>
              <th>상태</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td>{task.command}</td>
                <td>{formatScheduleWhen(task)}</td>
                <td>
                  <button
                    className="panel-btn"
                    onClick={() => void handleToggle(task)}
                    type="button"
                  >
                    {task.enabled ? "사용 중" : "일시정지"}
                  </button>
                </td>
                <td>
                  <button
                    aria-label="삭제"
                    className="panel-btn"
                    onClick={() => void handleRemove(task.id)}
                    type="button"
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="settings-note">등록된 정기 업무가 없습니다.</p>
      )}
    </div>
  );
}
