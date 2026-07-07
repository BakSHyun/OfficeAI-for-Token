import { useFrame } from "@react-three/fiber";
import type { RefObject } from "react";
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Vec2 } from "./character-machine";

const followTarget = new Vector3();

type FollowCameraProps = {
  controlsRef: RefObject<OrbitControlsImpl | null>;
  enabled: boolean;
  getFollowPosition: () => Vec2 | null;
};

export function FollowCamera({
  controlsRef,
  enabled,
  getFollowPosition,
}: FollowCameraProps) {
  useFrame((_, delta) => {
    if (!enabled) return;
    const controls = controlsRef.current;
    if (!controls) return;
    const position = getFollowPosition();
    if (!position) return;
    followTarget.set(position.x, 0.6, position.z);
    const blend = 1 - Math.exp(-5 * delta);
    controls.target.lerp(followTarget, blend);
    controls.update();
  });
  return null;
}
