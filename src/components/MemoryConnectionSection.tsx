import { useEffect, useState } from "react";
import { FolderOpen, RefreshCw } from "lucide-react";
import type { MemoryStatus } from "../state/bridge-types";

export function MemoryConnectionSection() {
  const bridge = window.officeai;
  const [status, setStatus] = useState<MemoryStatus>({ eventCount: 0 });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!bridge) return;
    void bridge.getMemoryStatus().then(setStatus);
  }, [bridge]);

  async function handleConnect() {
    if (!bridge) return;
    setBusy(true);
    setNote(null);
    try {
      const result = await bridge.connectMemoryFolder();
      if (!result.connected || !result.folderPath) {
        setNote("폴더 선택이 취소되었습니다.");
        return;
      }
      setStatus({
        folderPath: result.folderPath,
        lastScannedAt: result.lastScannedAt,
        eventCount: result.eventCount,
      });
      setNote(`${result.eventCount}건의 업무 기록을 학습했습니다`);
    } catch {
      setNote("스캔에 실패했습니다. 폴더 경로와 권한을 확인하세요.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRescan() {
    if (!bridge) return;
    setBusy(true);
    setNote(null);
    try {
      const result = await bridge.rescanMemory();
      if (!result.connected) {
        setNote("연결된 폴더가 없습니다.");
        return;
      }
      setStatus({
        folderPath: result.folderPath,
        lastScannedAt: result.lastScannedAt,
        eventCount: result.eventCount,
      });
      setNote(`${result.eventCount}건의 업무 기록을 다시 학습했습니다`);
    } catch {
      setNote("다시 스캔에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  if (!bridge) {
    return (
      <div className="settings-section">
        <h2>
          <FolderOpen size={13} /> 업무 기억
        </h2>
        <p className="settings-note">
          Electron 앱(<code>npm run app:dev</code>)에서 Obsidian·마크다운 폴더를
          연결하면 명령 시 맥락이 자동으로 포함됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="settings-section memory-section">
      <h2>
        <FolderOpen size={13} /> 업무 기억
      </h2>
      <p className="settings-note">
        업무 기록 폴더를 스캔해 맥락냥이 명령 실행 시 관련 노트를 자동으로
        인용합니다.
      </p>

      {status.folderPath ? (
        <div className="memory-status">
          <span>연결된 폴더</span>
          <code>{status.folderPath}</code>
          <small>
            {status.eventCount.toLocaleString()}건 학습됨
            {status.lastScannedAt
              ? ` · ${new Intl.DateTimeFormat("ko-KR", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(status.lastScannedAt))}`
              : ""}
          </small>
        </div>
      ) : (
        <p className="settings-note">아직 연결된 폴더가 없습니다.</p>
      )}

      <div className="settings-footer memory-footer">
        <button disabled={busy} onClick={() => void handleConnect()} type="button">
          <FolderOpen size={14} /> {busy ? "스캔 중…" : "폴더 선택 및 스캔"}
        </button>
        {status.folderPath ? (
          <button
            className="ghost"
            disabled={busy}
            onClick={() => void handleRescan()}
            type="button"
          >
            <RefreshCw size={14} /> 다시 스캔
          </button>
        ) : null}
        {note ? <small>{note}</small> : null}
      </div>
    </div>
  );
}
