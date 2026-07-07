import { useRef } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { Character } from "./character-machine";
import { isWalkingState } from "./animation-map";

const tierColor: Record<string, string> = {
  local: "#8c98a6",
  economy: "#54d69b",
  standard: "#4e8fff",
  premium: "#a78bfa",
};

function truncate(text: string, max = 14) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function PrimitiveCat({ character }: { character: Character }) {
  const groupRef = useRef<Group>(null);
  const animationTime = useRef(Math.random() * 10);
  const color = tierColor[character.tier] ?? "#8c98a6";

  useFrame((_, delta) => {
    animationTime.current += delta;
    const group = groupRef.current;
    if (!group) return;
    group.position.x = character.position.x;
    group.position.z = character.position.z;

    if (isWalkingState(character.state)) {
      const dx = character.target.x - character.position.x;
      const dz = character.target.z - character.position.z;
      if (Math.hypot(dx, dz) > 0.05) {
        group.rotation.y = Math.atan2(dx, dz);
      }
    }

    const time = animationTime.current;
    switch (character.state) {
      case "working":
      case "reviewing":
        group.position.y = Math.abs(Math.sin(time * 6)) * 0.05;
        break;
      case "celebrating":
        group.position.y = Math.abs(Math.sin(time * 10)) * 0.4;
        group.rotation.y += delta * 8;
        break;
      case "waiting-approval":
        group.position.y = 0;
        group.rotation.y = Math.sin(time * 4) * 0.4;
        break;
      case "entering":
      case "walking-to-coffee":
      case "walking-to-owner":
      case "leaving":
        group.position.y = Math.abs(Math.sin(time * 9)) * 0.12;
        break;
      default:
        group.position.y = 0;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh castShadow position={[0, 0.45, 0]}>
        <capsuleGeometry args={[0.28, 0.5, 6, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh castShadow position={[0, 1.05, 0]}>
        <sphereGeometry args={[0.26, 16, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[-0.14, 1.3, 0]} rotation={[0, 0, 0.25]}>
        <coneGeometry args={[0.09, 0.18, 4]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0.14, 1.3, 0]} rotation={[0, 0, -0.25]}>
        <coneGeometry args={[0.09, 0.18, 4]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 1.05, 0.24]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color="#1c2733" />
      </mesh>
      {character.state === "blocked" ? (
        <Html center position={[0, 1.75, 0]}>
          <div className="cat-alert">!</div>
        </Html>
      ) : null}
      <Html center position={[0, 1.65, 0]} zIndexRange={[10, 0]}>
        <div className="cat-label">
          <strong>{character.name}</strong>
          {character.speech ? <span>{truncate(character.speech)}</span> : null}
        </div>
      </Html>
    </group>
  );
}
