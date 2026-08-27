import { useEffect, type RefObject } from "react";
import { useThree } from "@react-three/fiber";
import type { RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";

interface PlayerTeleportDetail {
  readonly position: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
}

interface UsePlayerTeleportationProps {
  readonly rigidBodyRef: RefObject<RapierRigidBody | null>;
}

export const usePlayerTeleportation = ({
  rigidBodyRef,
}: UsePlayerTeleportationProps): void => {
  const { camera } = useThree();

  useEffect(() => {
    const handleTeleport = (rawEvent: Event) => {
      const event = rawEvent as CustomEvent<PlayerTeleportDetail>;
      const position = event.detail?.position;
      if (!isVectorTuple(position) || !rigidBodyRef.current) return;
      const rotation = isVectorTuple(event.detail.rotation)
        ? event.detail.rotation
        : [0, camera.rotation.y, 0] as const;
      const body = rigidBodyRef.current;
      body.setTranslation(
        { x: position[0], y: position[1], z: position[2] },
        true,
      );
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      camera.position.set(position[0], position[1] + 1.6, position[2]);
      camera.rotation.copy(new THREE.Euler(rotation[0], rotation[1], rotation[2]));
      camera.updateMatrixWorld(true);
    };

    window.addEventListener("playerTeleport", handleTeleport);
    return () => window.removeEventListener("playerTeleport", handleTeleport);
  }, [camera, rigidBodyRef]);
};

function isVectorTuple(value: unknown): value is readonly [number, number, number] {
  return Array.isArray(value)
    && value.length >= 3
    && value.slice(0, 3).every((entry) => typeof entry === "number" && Number.isFinite(entry));
}
