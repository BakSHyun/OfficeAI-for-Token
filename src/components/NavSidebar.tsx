import {
  Bot,
  BrainCircuit,
  ClipboardCheck,
  FileText,
  Gauge,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { navItems } from "../data";

const icons = [
  LayoutDashboard,
  ClipboardCheck,
  Bot,
  ShieldCheck,
  FileText,
  BrainCircuit,
  Sparkles,
  Settings,
];

type NavSidebarProps = {
  active: string;
  onChange: (item: string) => void;
  approvalCount?: number;
};

export function NavSidebar({ active, onChange, approvalCount = 0 }: NavSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Gauge size={18} strokeWidth={2.1} />
        </div>
        <div>
          <strong>Office AI</strong>
          <span>COMMAND CENTER</span>
        </div>
      </div>

      <nav aria-label="주요 메뉴">
        {navItems.map((item, index) => {
          const Icon = icons[index];
          return (
            <button
              className={active === item ? "nav-item is-active" : "nav-item"}
              key={item}
              onClick={() => onChange(item)}
              type="button"
            >
              <Icon size={17} strokeWidth={1.8} />
              <span>{item}</span>
              {item === "승인 대기" && approvalCount > 0 ? (
                <em>{approvalCount}</em>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="system-card">
        <span className="eyebrow">시스템 상태</span>
        <div className="system-row">
          <span className="status-dot running" />
          정상 운영 중
        </div>
        <div className="system-stats">
          <div>
            <strong>7</strong>
            <span>온라인</span>
          </div>
          <div>
            <strong>3</strong>
            <span>실행 중</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
