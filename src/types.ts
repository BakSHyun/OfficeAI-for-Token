export type AgentStatus = "running" | "review" | "waiting" | "paused";

export type Agent = {
  id: string;
  name: string;
  team: string;
  task: string;
  progress: number;
  status: AgentStatus;
  position: { left: string; top: string };
};

export type Evidence = {
  id: number;
  label: string;
  source: string;
  status: "passed" | "warning" | "failed";
};

export type Activity = {
  id: number;
  time: string;
  agent: string;
  message: string;
  status: "running" | "passed" | "approval" | "failed";
};
