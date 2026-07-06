import type { Activity, Agent, Evidence } from "./types";

export const agents: Agent[] = [
  {
    id: "planner",
    name: "기획냥",
    team: "기획팀",
    task: "요구사항 구조화",
    progress: 62,
    status: "running",
    position: { left: "13%", top: "31%" },
  },
  {
    id: "researcher",
    name: "리서치냥",
    team: "기획팀",
    task: "시장 근거 수집",
    progress: 84,
    status: "review",
    position: { left: "30%", top: "19%" },
  },
  {
    id: "developer",
    name: "코드냥",
    team: "개발팀",
    task: "기능 구현",
    progress: 73,
    status: "running",
    position: { left: "51%", top: "25%" },
  },
  {
    id: "pm",
    name: "PM냥",
    team: "PM",
    task: "진행 모니터링",
    progress: 55,
    status: "running",
    position: { left: "72%", top: "35%" },
  },
  {
    id: "reviewer",
    name: "검증냥",
    team: "검증팀",
    task: "근거 교차검증",
    progress: 48,
    status: "review",
    position: { left: "30%", top: "61%" },
  },
  {
    id: "qa",
    name: "테스트냥",
    team: "검증팀",
    task: "회귀 테스트",
    progress: 91,
    status: "review",
    position: { left: "52%", top: "67%" },
  },
  {
    id: "break",
    name: "휴식냥",
    team: "브레이크 존",
    task: "다음 작업 대기",
    progress: 0,
    status: "waiting",
    position: { left: "80%", top: "68%" },
  },
];

export const initialActivities: Activity[] = [
  {
    id: 1,
    time: "10:17",
    agent: "코드냥",
    message: "API 설계 초안 작성 완료",
    status: "running",
  },
  {
    id: 2,
    time: "10:16",
    agent: "기획냥",
    message: "요구사항 정의서 초안 생성",
    status: "passed",
  },
  {
    id: 3,
    time: "10:15",
    agent: "검증냥",
    message: "테스트 케이스 12개 통과",
    status: "passed",
  },
  {
    id: 4,
    time: "10:12",
    agent: "PM냥",
    message: "출시 범위 확정 요청",
    status: "approval",
  },
  {
    id: 5,
    time: "10:09",
    agent: "리서치냥",
    message: "데이터 신뢰도 기준 미달",
    status: "failed",
  },
];

export const evidence: Evidence[] = [
  {
    id: 1,
    label: "시장 조사 리포트 요약",
    source: "원문 3건",
    status: "passed",
  },
  {
    id: 2,
    label: "경쟁사 기능 비교 분석",
    source: "공식 문서",
    status: "passed",
  },
  {
    id: 3,
    label: "사용자 인터뷰 인사이트",
    source: "회의록 5건",
    status: "passed",
  },
  {
    id: 4,
    label: "기술 스펙 초안",
    source: "저장소 분석",
    status: "warning",
  },
  {
    id: 5,
    label: "위험 요소 및 대응 방안",
    source: "검증 대기",
    status: "failed",
  },
];

export const navItems = [
  "대시보드",
  "업무 관리",
  "에이전트",
  "승인 대기",
  "보고서",
  "모델 라우팅",
  "지식 & 근거",
  "설정",
];
