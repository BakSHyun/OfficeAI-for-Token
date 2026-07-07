import { FormEvent, Suspense, lazy, useState } from "react";
import { ActivityRail } from "./components/ActivityRail";
import { CommandBar } from "./components/CommandBar";
import { DecisionInbox } from "./components/DecisionInbox";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { NavSidebar } from "./components/NavSidebar";
import { OfficeCanvas } from "./components/OfficeCanvas";
import { OnboardingModal } from "./components/OnboardingModal";
import { shouldShowOnboarding } from "./state/onboarding";
import { ProcessView } from "./components/ProcessView";
import { ReportView } from "./components/ReportView";
import { RunsView } from "./components/RunsView";
import { SettingsView } from "./components/SettingsView";
import { TaskInspector } from "./components/TaskInspector";
import { agents as fallbackAgents } from "./data";

const OfficeScene = lazy(() =>
  import("./office3d/OfficeScene").then((module) => ({
    default: module.OfficeScene,
  })),
);
import { useEngineStore } from "./state/engine-store";
import { useEngine } from "./state/useEngine";

export default function App() {
  const [activeNav, setActiveNav] = useState("대시보드");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [command, setCommand] = useState("");
  const [evidenceOpen, setEvidenceOpen] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [sceneMode, setSceneMode] = useState<"3d" | "2d">("3d");
  const [showOnboarding, setShowOnboarding] = useState(shouldShowOnboarding);

  const engine = useEngine();
  const nodes = useEngineStore((state) => state.nodes);
  const agents = engine.agents.length > 0 ? engine.agents : fallbackAgents;
  const selectedAgent =
    agents.find((agent) => agent.id === selectedAgentId) ?? agents[0];

  function handleCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedCommand = command.trim();
    if (!trimmedCommand) return;
    void engine.submitCommand(trimmedCommand);
    setCommand("");
    setIsPaused(false);
    setActiveNav("대시보드");
  }

  const firstApproval = engine.approvals[0];
  const activeRun = engine.activeRun;

  function renderView() {
    switch (activeNav) {
      case "업무 관리":
        return (
          <RunsView
            onSelect={(runId) => {
              useEngineStore.getState().selectRun(runId);
              setActiveNav("보고서");
            }}
            runs={engine.runs}
          />
        );
      case "승인 대기":
        return (
          <DecisionInbox
            approvals={engine.approvals}
            onResolve={(requestId, approved) =>
              void engine.resolveApproval(requestId, approved)
            }
          />
        );
      case "보고서":
        return <ReportView run={activeRun} />;
      case "모델 라우팅":
      case "에이전트":
        return <ProcessView nodes={nodes} run={activeRun} />;
      case "설정":
        return <SettingsView />;
      default:
        return (
          <div className="workspace-grid">
            <div className="workspace-center">
              <div className="office-panel">
                <div className="office-toolbar">
                  <div>
                    <span>라이브 오피스</span>
                    <small>
                      {engine.usage.inputTokens + engine.usage.outputTokens > 0
                        ? `누적 ${(engine.usage.inputTokens + engine.usage.outputTokens).toLocaleString()} tokens · $${engine.usage.costUsd.toFixed(4)}`
                        : "대기 중"}
                    </small>
                  </div>
                  <div>
                    <button
                      className={sceneMode === "3d" ? "scene-toggle on" : "scene-toggle"}
                      onClick={() => setSceneMode("3d")}
                      type="button"
                    >
                      3D
                    </button>
                    <button
                      className={sceneMode === "2d" ? "scene-toggle on" : "scene-toggle"}
                      onClick={() => setSceneMode("2d")}
                      type="button"
                    >
                      2D
                    </button>
                  </div>
                </div>
                {sceneMode === "3d" ? (
                  <ErrorBoundary label="3D 오피스">
                    <Suspense
                      fallback={<div className="office-3d office-3d-loading">3D 오피스 준비 중…</div>}
                    >
                      <OfficeScene onSelect={setSelectedAgentId} />
                    </Suspense>
                  </ErrorBoundary>
                ) : (
                  <OfficeCanvas
                    agents={agents}
                    embedded
                    onSelectAgent={setSelectedAgentId}
                    selectedAgentId={selectedAgent?.id ?? ""}
                  />
                )}
              </div>
              <ActivityRail
                activities={engine.activities}
                approvalCount={engine.approvals.length}
                usage={engine.usage}
              />
            </div>
            <TaskInspector
              approvalState={firstApproval ? "pending" : "approved"}
              evidenceOpen={evidenceOpen}
              isPaused={isPaused}
              onApprove={() => {
                if (firstApproval) {
                  void engine.resolveApproval(firstApproval.id, true);
                }
              }}
              onPause={() => setIsPaused((current) => !current)}
              onStop={() => setIsPaused(true)}
              onToggleEvidence={() => setEvidenceOpen((current) => !current)}
              selectedAgent={selectedAgent}
            />
          </div>
        );
    }
  }

  return (
    <div className="app-shell">
      <NavSidebar
        active={activeNav}
        approvalCount={engine.approvals.length}
        onChange={setActiveNav}
      />
      <main className="workspace">
        <CommandBar
          command={command}
          onCommandChange={setCommand}
          onSubmit={handleCommand}
        />
        {renderView()}
      </main>
      {showOnboarding ? (
        <OnboardingModal
          onFinish={(firstCommand) => {
            setShowOnboarding(false);
            if (firstCommand) void engine.submitCommand(firstCommand);
          }}
        />
      ) : null}
    </div>
  );
}
