import type {
  NodeDescriptor,
  RunEvent,
} from "../../core/src/orchestration/contracts";

/**
 * 3D 오피스 캐릭터 상태 머신 (렌더러 독립 순수 로직).
 * - applyEvent: 엔진 RunEvent -> 캐릭터 목표 상태 전이
 * - tick: 시간 경과에 따른 이동/타이머 전이 (걷기, 축하, 커피, 퇴근)
 * r3f 씬은 이 머신의 characters 스냅샷을 읽어 렌더만 담당한다.
 */

export type Vec2 = { x: number; z: number };

export type CharacterState =
  | "entering" // 입구에서 책상으로 출근 중
  | "working" // 책상에서 타이핑
  | "reviewing" // 크리틱이 검토 중
  | "celebrating" // 완료 직후 기지개/댄스
  | "walking-to-coffee"
  | "coffee" // 커피 마시는 중
  | "walking-to-owner" // 승인 대기하러 사용자 책상으로
  | "waiting-approval"
  | "blocked" // 자리에서 고민 (예산 등)
  | "leaving" // 퇴근 중
  | "gone";

export type Character = {
  nodeId: string;
  runId: string;
  name: string;
  kind: NodeDescriptor["kind"];
  role: string;
  persona?: string;
  tier: string;
  state: CharacterState;
  /** 현재 위치 */
  position: Vec2;
  /** 이동 목표 */
  target: Vec2;
  /** 배정된 책상 */
  desk: Vec2;
  deskIndex: number;
  /** 현재 상태에 남은 시간(ms). 타이머 전이에 사용 */
  stateRemainingMs: number;
  /** 말풍선 텍스트 */
  speech: string;
  usedTokens: number;
};

export type OfficeLayout = {
  entrance: Vec2;
  exit: Vec2;
  coffee: Vec2;
  ownerDesk: Vec2;
  desks: Vec2[];
};

export const defaultLayout: OfficeLayout = {
  entrance: { x: -9, z: 6 },
  exit: { x: -9, z: 6 },
  coffee: { x: 8, z: 6 },
  ownerDesk: { x: 0, z: 8 },
  desks: [
    { x: -6, z: -4 },
    { x: -2, z: -4 },
    { x: 2, z: -4 },
    { x: 6, z: -4 },
    { x: -6, z: 0 },
    { x: -2, z: 0 },
    { x: 2, z: 0 },
    { x: 6, z: 0 },
    { x: -6, z: 3 },
    { x: -2, z: 3 },
    { x: 2, z: 3 },
    { x: 6, z: 3 },
  ],
};

const WALK_SPEED = 3.2; // units/sec
const CELEBRATE_MS = 2_200;
const COFFEE_MS = 5_000;
const LINGER_AFTER_COFFEE_MS = 1_500;

function distance(a: Vec2, b: Vec2) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export type CharacterMachine = {
  applyEvent(event: RunEvent): void;
  /** dtMs 만큼 시간을 진행시킨다. 렌더 루프에서 매 프레임 호출 */
  tick(dtMs: number): void;
  characters(): Character[];
  /** gone 상태 캐릭터 정리 */
  prune(): void;
};

export function createCharacterMachine(
  layout: OfficeLayout = defaultLayout,
): CharacterMachine {
  const characters = new Map<string, Character>();
  const deskOccupancy = new Map<number, string>();

  function allocateDesk(nodeId: string): number {
    for (let index = 0; index < layout.desks.length; index += 1) {
      if (!deskOccupancy.has(index)) {
        deskOccupancy.set(index, nodeId);
        return index;
      }
    }
    // 책상이 모자라면 순환 배정 (겹침 허용)
    return characters.size % layout.desks.length;
  }

  function releaseDesk(character: Character) {
    if (deskOccupancy.get(character.deskIndex) === character.nodeId) {
      deskOccupancy.delete(character.deskIndex);
    }
  }

  function spawn(runId: string, node: NodeDescriptor) {
    if (characters.has(node.id)) return;
    // 오케스트레이터는 사용자 책상 옆 고정 위치
    if (node.kind === "orchestrator") {
      characters.set(node.id, {
        nodeId: node.id,
        runId,
        name: node.title,
        kind: node.kind,
        role: node.role,
        persona: node.persona,
        tier: node.tier,
        state: "working",
        position: { x: layout.ownerDesk.x + 2, z: layout.ownerDesk.z - 1 },
        target: { x: layout.ownerDesk.x + 2, z: layout.ownerDesk.z - 1 },
        desk: { x: layout.ownerDesk.x + 2, z: layout.ownerDesk.z - 1 },
        deskIndex: -1,
        stateRemainingMs: 0,
        speech: "업무 총괄 중",
        usedTokens: 0,
      });
      return;
    }
    const deskIndex = allocateDesk(node.id);
    const desk = layout.desks[deskIndex];
    characters.set(node.id, {
      nodeId: node.id,
      runId,
      name: node.title,
      kind: node.kind,
      role: node.role,
      persona: node.persona,
      tier: node.tier,
      state: "entering",
      position: { ...layout.entrance },
      target: { ...desk },
      desk: { ...desk },
      deskIndex,
      stateRemainingMs: 0,
      speech: "출근!",
      usedTokens: 0,
    });
  }

  function applyEvent(event: RunEvent) {
    switch (event.type) {
      case "node:spawned":
        spawn(event.runId, event.node);
        break;
      case "node:working": {
        const character = characters.get(event.nodeId);
        if (!character) break;
        character.speech = event.detail;
        if (
          character.state !== "entering" ||
          distance(character.position, character.desk) < 0.2
        ) {
          character.state = character.kind === "critic" ? "reviewing" : "working";
        }
        break;
      }
      case "node:done": {
        const character = characters.get(event.nodeId);
        if (!character) break;
        character.speech = event.summary;
        if (character.kind === "orchestrator") break;
        character.state = "celebrating";
        character.stateRemainingMs = CELEBRATE_MS;
        break;
      }
      case "node:failed":
      case "node:blocked": {
        const character = characters.get(event.nodeId);
        if (!character) break;
        character.state = "blocked";
        character.speech =
          event.type === "node:failed" ? event.error : event.reason;
        break;
      }
      case "approval:requested": {
        // 해당 run의 오케스트레이터가 사용자 책상 앞으로 온다
        for (const character of characters.values()) {
          if (
            character.runId === event.runId &&
            character.kind === "orchestrator"
          ) {
            character.state = "walking-to-owner";
            character.target = {
              x: layout.ownerDesk.x,
              z: layout.ownerDesk.z - 1.5,
            };
            character.speech = event.request.reason;
          }
        }
        break;
      }
      case "approval:resolved": {
        for (const character of characters.values()) {
          if (
            character.runId === event.runId &&
            character.state === "waiting-approval"
          ) {
            character.state = "working";
            character.target = { ...character.desk };
            character.speech = event.approved ? "승인 받았다!" : "반려됐다…";
          }
        }
        break;
      }
      case "token:used": {
        const character = characters.get(event.nodeId);
        if (character) {
          character.usedTokens +=
            event.usage.inputTokens + event.usage.outputTokens;
        }
        break;
      }
      case "run:completed":
      case "run:failed": {
        // run이 끝나면 소속 캐릭터 전원 퇴근
        for (const character of characters.values()) {
          if (character.runId !== event.runId) continue;
          if (
            character.state === "celebrating" ||
            character.state === "coffee" ||
            character.state === "walking-to-coffee"
          ) {
            continue; // 축하/커피는 마저 하고 tick에서 퇴근
          }
          character.state = "leaving";
          character.target = { ...layout.exit };
        }
        break;
      }
      default:
        break;
    }
  }

  function tick(dtMs: number) {
    const step = (WALK_SPEED * dtMs) / 1_000;
    for (const character of characters.values()) {
      // 이동
      const moving =
        character.state === "entering" ||
        character.state === "walking-to-coffee" ||
        character.state === "walking-to-owner" ||
        character.state === "leaving";
      if (moving) {
        const gap = distance(character.position, character.target);
        if (gap <= step) {
          character.position = { ...character.target };
          if (character.state === "entering") {
            character.state = "working";
          } else if (character.state === "walking-to-coffee") {
            character.state = "coffee";
            character.stateRemainingMs = COFFEE_MS;
            character.speech = "커피 타임 ☕";
          } else if (character.state === "walking-to-owner") {
            character.state = "waiting-approval";
          } else if (character.state === "leaving") {
            character.state = "gone";
            releaseDesk(character);
          }
        } else {
          character.position = {
            x:
              character.position.x +
              ((character.target.x - character.position.x) / gap) * step,
            z:
              character.position.z +
              ((character.target.z - character.position.z) / gap) * step,
          };
        }
        continue;
      }

      // 타이머 전이
      if (character.stateRemainingMs > 0) {
        character.stateRemainingMs -= dtMs;
        if (character.stateRemainingMs <= 0) {
          if (character.state === "celebrating") {
            character.state = "walking-to-coffee";
            character.target = { ...layout.coffee };
          } else if (character.state === "coffee") {
            character.state = "leaving";
            character.target = { ...layout.exit };
            character.stateRemainingMs = LINGER_AFTER_COFFEE_MS;
            character.speech = "퇴근~";
          }
        }
      }
    }
  }

  return {
    applyEvent,
    tick,
    characters: () => [...characters.values()],
    prune() {
      for (const [nodeId, character] of characters) {
        if (character.state === "gone") characters.delete(nodeId);
      }
    },
  };
}
