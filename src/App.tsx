import { FormEvent, useState } from "react";
import { ActivityRail } from "./components/ActivityRail";
import { CommandBar } from "./components/CommandBar";
import { NavSidebar } from "./components/NavSidebar";
import { OfficeCanvas } from "./components/OfficeCanvas";
import { TaskInspector } from "./components/TaskInspector";
import { agents, initialActivities } from "./data";

function nowTime() {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

export default function App() {
  const [activeNav, setActiveNav] = useState("대시보드");
  const [selectedAgentId, setSelectedAgentId] = useState("developer");
  const [command, setCommand] = useState("");
  const [activities, setActivities] = useState(initialActivities);
  const [evidenceOpen, setEvidenceOpen] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [approvalState, setApprovalState] = useState<"pending" | "approved">(
    "pending",
  );

  const selectedAgent =
    agents.find((agent) => agent.id === selectedAgentId) ?? agents[0];

  function handleCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedCommand = command.trim();
    if (!trimmedCommand) return;

    setActivities((current) => [
      {
        id: Date.now(),
        time: nowTime(),
        agent: "오케스트레이터",
        message: `“${trimmedCommand}” 업무를 분석 중`,
        status: "running",
      },
      ...current.slice(0, 5),
    ]);
    setCommand("");
    setIsPaused(false);
  }

  function handleStop() {
    setIsPaused(true);
    setActivities((current) => [
      {
        id: Date.now(),
        time: nowTime(),
        agent: "Owner",
        message: "업무 실행을 중지했습니다",
        status: "failed",
      },
      ...current.slice(0, 5),
    ]);
  }

  function handleApprove() {
    setApprovalState("approved");
    setActivities((current) => [
      {
        id: Date.now(),
        time: nowTime(),
        agent: "Owner",
        message: "출시 계획 최종 보고를 승인했습니다",
        status: "passed",
      },
      ...current.slice(0, 5),
    ]);
  }

  return (
    <div className="app-shell">
      <NavSidebar active={activeNav} onChange={setActiveNav} />
      <main className="workspace">
        <CommandBar
          command={command}
          onCommandChange={setCommand}
          onSubmit={handleCommand}
        />
        <div className="workspace-grid">
          <div className="workspace-center">
            <OfficeCanvas
              agents={agents}
              onSelectAgent={setSelectedAgentId}
              selectedAgentId={selectedAgentId}
            />
            <ActivityRail activities={activities} />
          </div>
          <TaskInspector
            approvalState={approvalState}
            evidenceOpen={evidenceOpen}
            isPaused={isPaused}
            onApprove={handleApprove}
            onPause={() => setIsPaused((current) => !current)}
            onStop={handleStop}
            onToggleEvidence={() => setEvidenceOpen((current) => !current)}
            selectedAgent={selectedAgent}
          />
        </div>
      </main>
    </div>
  );
}
