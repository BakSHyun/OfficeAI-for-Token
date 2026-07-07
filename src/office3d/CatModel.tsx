import { useEffect, useMemo, useRef } from "react";
import { Html, useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Group, MeshStandardMaterial } from "three";
import { SkeletonUtils } from "three-stdlib";
import type { Character } from "./character-machine";
import { animationClipForState, isWalkingState } from "./animation-map";

useGLTF.preload("/models/Cat.gltf");

const tierTint: Record<string, string> = {
  local: "#8c98a6",
  economy: "#54d69b",
  standard: "#4e8fff",
  premium: "#a78bfa",
};

function truncate(text: string, max = 14) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function CatModel({ character }: { character: Character }) {
  const groupRef = useRef<Group>(null);
  const activeClip = useRef("");
  const { scene, animations } = useGLTF("/models/Cat.gltf");
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { actions } = useAnimations(animations, clone);
  const tint = tierTint[character.tier] ?? "#8c98a6";

  useEffect(() => {
    clone.traverse((object) => {
      if (!("material" in object) || !object.material) return;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials) {
        const standard = material as MeshStandardMaterial;
        if (!standard.emissive) continue;
        standard.emissive.set(tint);
        standard.emissiveIntensity = 0.18;
      }
    });
  }, [clone, tint]);

  useEffect(() => {
    const clipName = animationClipForState(character.state);
    if (clipName === activeClip.current) return;
    const next = actions[clipName];
    const previous = actions[activeClip.current];
    previous?.fadeOut(0.2);
    next?.reset().fadeIn(0.2).play();
    activeClip.current = clipName;
  }, [actions, character.state]);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    group.position.set(character.position.x, 0, character.position.z);

    if (isWalkingState(character.state)) {
      const dx = character.target.x - character.position.x;
      const dz = character.target.z - character.position.z;
      if (Math.hypot(dx, dz) > 0.05) {
        group.rotation.y = Math.atan2(dx, dz);
      }
      return;
    }
    group.rotation.y = 0;
  });

  return (
    <group ref={groupRef} scale={0.42}>
      <primitive object={clone} />
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
