import { FormEvent, Suspense, lazy, useEffect, useMemo, useState } from "react";
import { ActivityRail } from "./components/ActivityRail";
import { CommandBar } from "./components/CommandBar";
import { DecisionInbox } from "./components/DecisionInbox";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { NavSidebar } from "./components/NavSidebar";
import { OfficeCanvas } from "./components/OfficeCanvas";
import { OnboardingModal } from "./components/OnboardingModal";
import { shouldShowOnboarding } from "./state/onboarding";
import { pushCommand } from "./state/command-history";
import { loadBudgetPreferencesSync } from "./state/budget-preferences";
import {
  loadSceneFollowEnabled,
  saveSceneFollowEnabled,
} from "./state/scene-preferences";
import { formatCost } from "./state/format-cost";
import { useSavings } from "./state/use-savings";
import { KnowledgeView } from "./components/KnowledgeView";
import { ProcessView } from "./components/ProcessView";
import { ReportView } from "./components/ReportView";
import { RunsView } from "./components/RunsView";
import { ModelRoutingView } from "./components/ModelRoutingView";
import { SettingsView } from "./components/SettingsView";
import { licenseModeLabel, useLicenseStatus } from "./state/use-license-status";
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
  const [followCamera, setFollowCamera] = useState(loadSceneFollowEnabled);
  const [showOnboarding, setShowOnboarding] = useState(shouldShowOnboarding);

  useEffect(() => {
    const bridge = window.officeai;
    if (!bridge) return;
    return bridge.onNavigate(({ view, runId }) => {
      if (runId) useEngineStore.getState().selectRun(runId);
      setActiveNav(view);
    });
  }, []);

  const engine = useEngine();
  const nodes = useEngineStore((state) => state.nodes);
  const connected = useEngineStore((state) => state.connected);
  const licenseStatus = useLicenseStatus();
  const agents = engine.agents.length > 0 ? engine.agents : fallbackAgents;

  const nodeList = Object.values(nodes);
  const onlineCount = nodeList.filter((node) => node.status !== "failed").length;
  const runningCount = Object.values(engine.runs).filter(
    (run) => run.status === "running",
  ).length;
  const selectedAgent =
    agents.find((agent) => agent.id === selectedAgentId) ?? agents[0];

  function handleCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedCommand = command.trim();
    if (!trimmedCommand) return;
    pushCommand(trimmedCommand);
    void engine.submitCommand(trimmedCommand);
    setCommand("");
    setIsPaused(false);
    setActiveNav("대시보드");
  }

  const firstApproval = engine.approvals[0];
  const activeRun = engine.activeRun;
  const budgetPrefs = loadBudgetPreferencesSync();
  const sessionSavings = useSavings();
  const selectedNode = selectedAgent ? nodes[selectedAgent.id] : undefined;
  const activeRunNodes = useMemo(() => {
    if (!activeRun) return [];
    return Object.values(nodes).filter((node) => node.runId === activeRun.runId);
  }, [activeRun, nodes]);
  const recentVerdicts = useMemo(() => {
    const collected = Object.values(engine.runs).flatMap((run) =>
      run.report?.verdicts?.length
        ? run.report.verdicts
        : run.verdicts,
    );
    return collected.slice(-8).reverse();
  }, [engine.runs]);

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
        return <ModelRoutingView />;
      case "에이전트":
        return <ProcessView nodes={nodes} run={activeRun} />;
      case "지식 & 근거":
        return <KnowledgeView runs={engine.runs} />;
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
                        ? `누적 ${(engine.usage.inputTokens + engine.usage.outputTokens).toLocaleString()} tokens · ${formatCost(engine.usage.costUsd, budgetPrefs)}`
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
                    {sceneMode === "3d" ? (
                      <button
                        className={followCamera ? "scene-toggle on" : "scene-toggle"}
                        onClick={() => {
                          setFollowCamera((current) => {
                            const next = !current;
                            saveSceneFollowEnabled(next);
                            return next;
                          });
                        }}
                        type="button"
                      >
                        추적
                      </button>
                    ) : null}
                  </div>
                </div>
                {sceneMode === "3d" ? (
                  <ErrorBoundary label="3D 오피스">
                    <Suspense
                      fallback={<div className="office-3d office-3d-loading">3D 오피스 준비 중…</div>}
                    >
                      <OfficeScene
                        followEnabled={followCamera}
                        followNodeId={selectedAgentId || undefined}
                        onSelect={setSelectedAgentId}
                      />
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
                budgetScopes={engine.budget}
                dailyTokenBudget={budgetPrefs.globalDailyTokens}
                savings={sessionSavings}
                usage={engine.usage}
                verdicts={recentVerdicts}
              />
            </div>
            <TaskInspector
              activeRun={activeRun}
              budgetScopes={engine.budget}
              dailyTokenBudget={budgetPrefs.globalDailyTokens}
              evidenceOpen={evidenceOpen}
              isPaused={isPaused}
              krwPerUsd={budgetPrefs.krwPerUsd}
              onApprove={() => {
                if (firstApproval) {
                  void engine.resolveApproval(firstApproval.id, true);
                }
              }}
              onPause={() => setIsPaused((current) => !current)}
              onStop={() => {
                if (activeRun?.runId) {
                  void engine.cancelRun(activeRun.runId);
                }
                setIsPaused(true);
              }}
              onToggleEvidence={() => setEvidenceOpen((current) => !current)}
              pendingApproval={firstApproval}
              runNodes={activeRunNodes}
              selectedAgent={selectedAgent}
              selectedNode={selectedNode}
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
        connected={connected}
        onChange={setActiveNav}
        onlineCount={onlineCount}
        runningCount={runningCount}
      />
      <main className="workspace">
        <CommandBar
          command={command}
          notificationCount={engine.approvals.length}
          onCommandChange={setCommand}
          onOpenNotifications={() => setActiveNav("승인 대기")}
          onSubmit={handleCommand}
          profileSub={licenseModeLabel(licenseStatus)}
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
