import type { CharacterState } from "./character-machine";

const walkingStates = new Set<CharacterState>([
  "entering",
  "walking-to-coffee",
  "walking-to-owner",
  "leaving",
]);

export function isWalkingState(state: CharacterState) {
  return walkingStates.has(state);
}

export function animationClipForState(state: CharacterState): string {
  switch (state) {
    case "entering":
    case "walking-to-coffee":
    case "walking-to-owner":
    case "leaving":
      return "Walk";
    case "celebrating":
      return "Jump_Loop";
    case "coffee":
      return "Idle_Eating";
    case "blocked":
      return "Death";
    default:
      return "Idle";
  }
}
