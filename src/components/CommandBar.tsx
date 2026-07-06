import { Bell, Play, UserRound } from "lucide-react";
import { FormEvent } from "react";

type CommandBarProps = {
  command: string;
  onCommandChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function CommandBar({
  command,
  onCommandChange,
  onSubmit,
}: CommandBarProps) {
  return (
    <header className="command-header">
      <form className="command-form" onSubmit={onSubmit}>
        <input
          aria-label="업무 명령"
          onChange={(event) => onCommandChange(event.target.value)}
          placeholder="무엇을 맡길까요?"
          value={command}
        />
        <button type="submit">
          <Play fill="currentColor" size={15} />
          업무 시작
        </button>
      </form>
      <div className="header-actions">
        <button aria-label="알림" className="icon-button" type="button">
          <Bell size={18} />
          <i>2</i>
        </button>
        <div className="profile">
          <span>
            <UserRound size={17} />
          </span>
          <div>
            <strong>김프로</strong>
            <small>Owner</small>
          </div>
        </div>
      </div>
    </header>
  );
}
