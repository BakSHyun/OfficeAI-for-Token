import { Bell, Play, Star, UserRound } from "lucide-react";
import { FormEvent, useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  getSuggestions,
  loadHistory,
  loadStarred,
  toggleStarred,
} from "../state/command-history";

type CommandBarProps = {
  command: string;
  onCommandChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  notificationCount?: number;
  onOpenNotifications?: () => void;
  profileName?: string;
  profileSub?: string;
};

export function CommandBar({
  command,
  onCommandChange,
  onSubmit,
  notificationCount = 0,
  onOpenNotifications,
  profileName = "Owner",
  profileSub = "OfficeAI",
}: CommandBarProps) {
  const [focused, setFocused] = useState(false);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [starred, setStarred] = useState(loadStarred);
  const draftRef = useRef("");
  const history = loadHistory();
  const suggestions =
    focused && history.length > 0 ? getSuggestions(command) : [];

  useEffect(() => {
    if (historyIndex === null) {
      draftRef.current = command;
    }
  }, [command, historyIndex]);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowUp") {
      if (history.length === 0) return;
      event.preventDefault();
      const nextIndex =
        historyIndex === null
          ? 0
          : Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(nextIndex);
      onCommandChange(history[nextIndex] ?? "");
      return;
    }

    if (event.key === "ArrowDown") {
      if (historyIndex === null) return;
      event.preventDefault();
      if (historyIndex === 0) {
        setHistoryIndex(null);
        onCommandChange(draftRef.current);
        return;
      }
      const nextIndex = historyIndex - 1;
      setHistoryIndex(nextIndex);
      onCommandChange(history[nextIndex] ?? "");
    }
  }

  function pickSuggestion(value: string) {
    onCommandChange(value);
    setHistoryIndex(null);
    setFocused(true);
  }

  function handleToggleStar(value: string) {
    toggleStarred(value);
    setStarred(loadStarred());
  }

  function isItemStarred(value: string) {
    return starred.includes(value);
  }

  return (
    <header className="command-header">
      <form className="command-form" onSubmit={onSubmit}>
        <div className="command-input-wrap">
          <input
            aria-autocomplete="list"
            aria-controls={
              suggestions.length > 0 ? "command-suggestions" : undefined
            }
            aria-expanded={focused && suggestions.length > 0}
            aria-label="업무 명령"
            onBlur={() => {
              window.setTimeout(() => setFocused(false), 120);
            }}
            onChange={(event) => {
              setHistoryIndex(null);
              onCommandChange(event.target.value);
            }}
            onFocus={() => setFocused(true)}
            onKeyDown={handleKeyDown}
            placeholder="무엇을 맡길까요?"
            role="combobox"
            value={command}
          />
          {suggestions.length > 0 ? (
            <ul className="command-suggestions" id="command-suggestions">
              {suggestions.map((item) => (
                <li key={item}>
                  <button
                    className="command-suggestion-pick"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      pickSuggestion(item);
                    }}
                    type="button"
                  >
                    {item}
                  </button>
                  <button
                    aria-label={
                      isItemStarred(item) ? "즐겨찾기 해제" : "즐겨찾기 추가"
                    }
                    className={
                      isItemStarred(item)
                        ? "command-suggestion-star on"
                        : "command-suggestion-star"
                    }
                    onMouseDown={(event) => {
                      event.preventDefault();
                      handleToggleStar(item);
                    }}
                    type="button"
                  >
                    <Star fill={isItemStarred(item) ? "currentColor" : "none"} size={14} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <button type="submit">
          <Play fill="currentColor" size={15} />
          업무 시작
        </button>
      </form>
      <div className="header-actions">
        <button
          aria-label={`알림 ${notificationCount}건`}
          className="icon-button"
          disabled={notificationCount === 0}
          onClick={onOpenNotifications}
          type="button"
        >
          <Bell size={18} />
          {notificationCount > 0 ? <i>{notificationCount}</i> : null}
        </button>
        <div className="profile">
          <span>
            <UserRound size={17} />
          </span>
          <div>
            <strong>{profileName}</strong>
            <small>{profileSub}</small>
          </div>
        </div>
      </div>
    </header>
  );
}
