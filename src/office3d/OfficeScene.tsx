import { Suspense, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import type { Group } from "three";
import type { Character } from "./character-machine";
import { defaultLayout } from "./character-machine";
import { useCharacterMachine } from "./useCharacters";

const tierColor: Record<string, string> = {
  local: "#8c98a6",
  economy: "#54d69b",
  standard: "#4e8fff",
  premium: "#a78bfa",
};

function truncate(text: string, max = 14) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function CatCharacter({ character }: { character: Character }) {
  const groupRef = useRef<Group>(null);
  const animationTime = useRef(Math.random() * 10);
  const color = tierColor[character.tier] ?? "#8c98a6";

  useFrame((_, delta) => {
    animationTime.current += delta;
    const group = groupRef.current;
    if (!group) return;
    group.position.x = character.position.x;
    group.position.z = character.position.z;

    const time = animationTime.current;
    switch (character.state) {
      case "working":
      case "reviewing":
        group.position.y = Math.abs(Math.sin(time * 6)) * 0.05;
        group.rotation.y = 0;
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
        group.rotation.y = 0;
    }
  });

  return (
    <group ref={groupRef}>
      {/* 몸통 */}
      <mesh castShadow position={[0, 0.45, 0]}>
        <capsuleGeometry args={[0.28, 0.5, 6, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* 머리 */}
      <mesh castShadow position={[0, 1.05, 0]}>
        <sphereGeometry args={[0.26, 16, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* 귀 */}
      <mesh position={[-0.14, 1.3, 0]} rotation={[0, 0, 0.25]}>
        <coneGeometry args={[0.09, 0.18, 4]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0.14, 1.3, 0]} rotation={[0, 0, -0.25]}>
        <coneGeometry args={[0.09, 0.18, 4]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* 얼굴 */}
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

function Desk({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh castShadow position={[0, 0.55, -0.6]}>
        <boxGeometry args={[1.5, 0.08, 0.8]} />
        <meshStandardMaterial color="#3b4a5e" />
      </mesh>
      <mesh position={[-0.65, 0.27, -0.6]}>
        <boxGeometry args={[0.08, 0.55, 0.7]} />
        <meshStandardMaterial color="#2c3a4c" />
      </mesh>
      <mesh position={[0.65, 0.27, -0.6]}>
        <boxGeometry args={[0.08, 0.55, 0.7]} />
        <meshStandardMaterial color="#2c3a4c" />
      </mesh>
      {/* 모니터 */}
      <mesh position={[0, 0.85, -0.75]}>
        <boxGeometry args={[0.55, 0.35, 0.04]} />
        <meshStandardMaterial
          color="#0d1825"
          emissive="#1d4ed8"
          emissiveIntensity={0.35}
        />
      </mesh>
    </group>
  );
}

function OfficeFloor() {
  return (
    <group>
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[22, 0.1, 18]} />
        <meshStandardMaterial color="#16222f" />
      </mesh>
      {defaultLayout.desks.map((desk, index) => (
        <Desk key={index} x={desk.x} z={desk.z} />
      ))}
      {/* 커피머신 */}
      <group position={[defaultLayout.coffee.x, 0, defaultLayout.coffee.z]}>
        <mesh castShadow position={[0, 0.5, 0]}>
          <boxGeometry args={[0.7, 1, 0.7]} />
          <meshStandardMaterial color="#7c5b3a" />
        </mesh>
        <Html center position={[0, 1.3, 0]}>
          <div className="cat-zone">커피</div>
        </Html>
      </group>
      {/* 사용자(Owner) 책상 */}
      <group position={[defaultLayout.ownerDesk.x, 0, defaultLayout.ownerDesk.z]}>
        <mesh castShadow position={[0, 0.55, 0]}>
          <boxGeometry args={[2.4, 0.1, 1]} />
          <meshStandardMaterial color="#54d69b" opacity={0.85} transparent />
        </mesh>
        <Html center position={[0, 1.2, 0]}>
          <div className="cat-zone owner">Owner</div>
        </Html>
      </group>
    </group>
  );
}

function SceneContent({
  onSelect,
}: {
  onSelect?: (nodeId: string) => void;
}) {
  const machine = useCharacterMachine();
  const [, forceRender] = useState(0);
  const pruneTimer = useRef(0);

  useFrame((_, delta) => {
    machine.tick(delta * 1_000);
    pruneTimer.current += delta;
    if (pruneTimer.current > 1) {
      machine.prune();
      pruneTimer.current = 0;
    }
    // 캐릭터 수 변화를 React에 반영 (위치는 ref로 직접 갱신)
    forceRender((value) => (value + 1) % 1_000_000);
  });

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight
        castShadow
        intensity={1.1}
        position={[8, 14, 6]}
        shadow-mapSize={[1024, 1024]}
      />
      <OfficeFloor />
      {machine.characters().map((character) => (
        <group
          key={character.nodeId}
          onClick={(event) => {
            event.stopPropagation();
            onSelect?.(character.nodeId);
          }}
        >
          <CatCharacter character={character} />
        </group>
      ))}
    </>
  );
}

type OfficeSceneProps = {
  onSelect?: (nodeId: string) => void;
};

export function OfficeScene({ onSelect }: OfficeSceneProps) {
  return (
    <div className="office-3d">
      <Canvas
        camera={{ position: [12, 13, 14], fov: 38 }}
        shadows
      >
        <color args={["#0b1420"]} attach="background" />
        <Suspense fallback={null}>
          <SceneContent onSelect={onSelect} />
        </Suspense>
        <OrbitControls
          enablePan={false}
          maxDistance={30}
          maxPolarAngle={Math.PI / 2.4}
          minDistance={8}
          target={[0, 0, 0]}
        />
      </Canvas>
    </div>
  );
}
