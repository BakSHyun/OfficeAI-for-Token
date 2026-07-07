import { useEffect, useMemo, useState } from "react";
import { FilePlus2, FolderCog, Play, Terminal } from "lucide-react";
import { parseActionProposals } from "../../shared/action-blocks";
import type { ActionProposal } from "../state/bridge-types";

type DeliverableActionsProps = {
  content: string;
};

type ActionState = {
  running: boolean;
  note?: string;
  ok?: boolean;
};

function actionLabel(action: ActionProposal) {
  return action.kind === "write-file" ? action.path : action.command;
}

export function DeliverableActions({ content }: DeliverableActionsProps) {
  const bridge = window.officeai;
  const actions = useMemo(() => parseActionProposals(content), [content]);
  const [states, setStates] = useState<Record<number, ActionState>>({});
  const [workspace, setWorkspace] = useState<string>();

  useEffect(() => {
    if (!bridge || actions.length === 0) return;
    void bridge.getActionWorkspace().then((status) => {
      setWorkspace(status.folderPath);
    });
  }, [bridge, actions.length]);

  if (actions.length === 0) return null;

  async function handleChooseWorkspace() {
    if (!bridge) return;
    const status = await bridge.chooseActionWorkspace();
    setWorkspace(status.folderPath);
  }

  async function handleExecute(index: number, action: ActionProposal) {
    if (!bridge) return;
    setStates((prev) => ({ ...prev, [index]: { running: true } }));
    try {
      const result = await bridge.executeAction(action);
      const status = await bridge.getActionWorkspace();
      setWorkspace(status.folderPath);
      setStates((prev) => ({
        ...prev,
        [index]: {
          running: false,
          ok: result.ok,
          note: result.ok
            ? result.detail ?? "완료"
            : result.error ?? "실패",
        },
      }));
    } catch {
      setStates((prev) => ({
        ...prev,
        [index]: { running: false, ok: false, note: "실행에 실패했습니다" },
      }));
    }
  }

  return (
    <div className="action-panel">
      <div className="action-panel-header">
        <span>감지된 액션 {actions.length}건</span>
        {bridge ? (
          <button
            className="panel-btn"
            onClick={() => void handleChooseWorkspace()}
            type="button"
          >
            <FolderCog size={12} />
            {workspace ? `폴더: ${workspace}` : "작업 폴더 선택"}
          </button>
        ) : (
          <span className="action-panel-hint">
            실행은 데스크톱 앱에서만 가능합니다
          </span>
        )}
      </div>
      <ul className="action-list">
        {actions.map((action, index) => {
          const state = states[index];
          return (
            <li className="action-row" key={`${action.kind}-${index}`}>
              {action.kind === "write-file" ? (
                <FilePlus2 size={13} />
              ) : (
                <Terminal size={13} />
              )}
              <span className="action-target" title={actionLabel(action)}>
                {actionLabel(action)}
              </span>
              {bridge ? (
                <button
                  className="panel-btn"
                  disabled={state?.running}
                  onClick={() => void handleExecute(index, action)}
                  type="button"
                >
                  <Play size={12} />
                  {state?.running
                    ? "실행 중…"
                    : action.kind === "write-file"
                      ? "파일 저장"
                      : "명령 실행"}
                </button>
              ) : null}
              {state?.note ? (
                <span
                  className={`action-note ${state.ok ? "ok" : "warn"}`}
                  title={state.note}
                >
                  {state.note}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
