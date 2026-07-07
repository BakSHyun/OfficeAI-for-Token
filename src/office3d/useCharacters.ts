import { useEffect, useRef } from "react";
import { connectEngine } from "../state/engine-client";
import {
  createCharacterMachine,
  type CharacterMachine,
} from "./character-machine";

/**
 * 원시 RunEvent 스트림을 캐릭터 상태 머신에 연결한다.
 * 반환된 machine을 r3f useFrame에서 tick/characters 호출로 소비.
 */
export function useCharacterMachine(): CharacterMachine {
  const machineRef = useRef<CharacterMachine | null>(null);
  if (!machineRef.current) {
    machineRef.current = createCharacterMachine();
  }

  useEffect(() => {
    const client = connectEngine();
    const unsubscribe = client.subscribeRaw((event) => {
      machineRef.current?.applyEvent(event);
    });
    return unsubscribe;
  }, []);

  return machineRef.current;
}
