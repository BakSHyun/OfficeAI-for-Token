import { Suspense, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Character, Vec2 } from "./character-machine";
import { defaultLayout } from "./character-machine";
import { CatModel } from "./CatModel";
import { FollowCamera } from "./FollowCamera";
import { ModelErrorBoundary } from "./ModelErrorBoundary";
import { PrimitiveCat } from "./PrimitiveCat";
import { useCharacterMachine } from "./useCharacters";
import { useSceneEffects } from "./useSceneEffects";

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
      <group position={[defaultLayout.coffee.x, 0, defaultLayout.coffee.z]}>
        <mesh castShadow position={[0, 0.5, 0]}>
          <boxGeometry args={[0.7, 1, 0.7]} />
          <meshStandardMaterial color="#7c5b3a" />
        </mesh>
        <Html center position={[0, 1.3, 0]}>
          <div className="cat-zone">커피</div>
        </Html>
      </group>
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

function CatCharacter({
  character,
  useGltf,
}: {
  character: Character;
  useGltf: boolean;
}) {
  if (!useGltf) {
    return <PrimitiveCat character={character} />;
  }
  return (
    <ModelErrorBoundary character={character}>
      <Suspense fallback={<PrimitiveCat character={character} />}>
        <CatModel character={character} />
      </Suspense>
    </ModelErrorBoundary>
  );
}

function SceneContent({
  controlsRef,
  followEnabled,
  followNodeId,
  onSelect,
  useGltf,
}: {
  controlsRef: RefObject<OrbitControlsImpl | null>;
  followEnabled: boolean;
  followNodeId?: string;
  onSelect?: (nodeId: string) => void;
  useGltf: boolean;
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
    forceRender((value) => (value + 1) % 1_000_000);
  });

  const getFollowPosition = (): Vec2 | null => {
    if (!followNodeId) return null;
    const character = machine
      .characters()
      .find((entry) => entry.nodeId === followNodeId);
    return character ? character.position : null;
  };

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight
        castShadow
        intensity={1.1}
        position={[8, 14, 6]}
        shadow-mapSize={[1024, 1024]}
      />
      <FollowCamera
        controlsRef={controlsRef}
        enabled={followEnabled}
        getFollowPosition={getFollowPosition}
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
          <CatCharacter character={character} useGltf={useGltf} />
        </group>
      ))}
    </>
  );
}

type OfficeSceneProps = {
  followEnabled?: boolean;
  followNodeId?: string;
  onSelect?: (nodeId: string) => void;
};

export function OfficeScene({
  followEnabled = false,
  followNodeId,
  onSelect,
}: OfficeSceneProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  useSceneEffects();

  return (
    <div className="office-3d">
      <Canvas camera={{ position: [12, 13, 14], fov: 38 }} shadows>
        <color args={["#0b1420"]} attach="background" />
        <Suspense fallback={null}>
          <SceneContent
            controlsRef={controlsRef}
            followEnabled={followEnabled}
            followNodeId={followNodeId}
            onSelect={onSelect}
            useGltf
          />
        </Suspense>
        <OrbitControls
          ref={controlsRef}
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
