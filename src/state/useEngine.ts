import { useEffect, useMemo } from "react";
import type { Activity, Agent } from "../types";
import { connectEngine } from "./engine-client";
import { useEngineStore } from "./engine-store";
import type { LiveNode } from "./engine-store";

/** 2D OfficeCanvas용 프리셋 좌표 슬롯 (책상 배치) */
const positionSlots = [
  { left: "13%", top: "31%" },
  { left: "30%", top: "19%" },
  { left: "51%", top: "25%" },
  { left: "72%", top: "35%" },
  { left: "30%", top: "61%" },
  { left: "52%", top: "67%" },
  { left: "80%", top: "68%" },
  { left: "14%", top: "62%" },
];

function nodeToAgent(node: LiveNode, index: number): Agent {
  const status =
    node.status === "working"
      ? "running"
      : node.status === "done"
        ? "review"
        : node.status === "blocked" || node.status === "failed"
          ? "paused"
          : "waiting";
  return {
    id: node.descriptor.id,
    name: node.descriptor.title,
    team:
      node.descriptor.kind === "critic"
        ? "검증팀"
        : node.descriptor.kind === "orchestrator"
          ? "총괄"
          : `${node.descriptor.role} (${node.descriptor.tier})`,
    task: node.detail || "대기 중",
    progress: node.status === "done" ? 100 : node.status === "working" ? 55 : 10,
    status,
    position: positionSlots[index % positionSlots.length],
  };
}

/**
 * 기존 UI 컴포넌트(Agent/Activity 타입)와 엔진 이벤트 스트림을 잇는 훅.
 * mount 시 엔진(Electron IPC 또는 브라우저 데모)에 연결한다.
 */
export function useEngine() {
  useEffect(() => {
    connectEngine();
  }, []);

  const nodes = useEngineStore((state) => state.nodes);
  const activities = useEngineStore((state) => state.activities);
  const approvals = useEngineStore((state) => state.approvals);
  const usage = useEngineStore((state) => state.usage);
  const runs = useEngineStore((state) => state.runs);
  const activeRunId = useEngineStore((state) => state.activeRunId);

  const agents: Agent[] = useMemo(() => {
    const list = Object.values(nodes).filter(
      (node) => node.status !== "done" || node.descriptor.kind === "executor",
    );
    return list.slice(-8).map((node, index) => nodeToAgent(node, index));
  }, [nodes]);

  const legacyActivities: Activity[] = useMemo(
    () =>
      activities.slice(0, 8).map((entry, index) => ({
        id: index,
        time: new Intl.DateTimeFormat("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date(entry.at)),
        agent: entry.actor,
        message: entry.message,
        status:
          entry.kind === "success"
            ? "passed"
            : entry.kind === "error"
              ? "failed"
              : entry.kind === "approval"
                ? "approval"
                : "running",
      })),
    [activities],
  );

  return {
    agents,
    activities: legacyActivities,
    approvals,
    usage,
    runs,
    activeRun: activeRunId ? runs[activeRunId] : undefined,
    submitCommand: (command: string) => connectEngine().submitCommand(command),
    resolveApproval: (requestId: string, approved: boolean, note?: string) =>
      connectEngine().resolveApproval(requestId, approved, note),
  };
}
