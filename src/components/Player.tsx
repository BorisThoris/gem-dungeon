import { useRef } from "react";
import { RigidBody, RapierRigidBody } from "@react-three/rapier";
import { CapsuleCollider } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMouseLook } from "../hooks/useMouseLook";
import { refBasedGameState } from "../utils/refBasedGameState";
import PlayerHand from "./PlayerHand";
import { usePlayerCamera } from "../hooks/usePlayerCamera";
import { usePlayerMovement } from "../hooks/usePlayerMovement";
import { usePlayerSpawn } from "../hooks/usePlayerSpawn";
import { usePlayerTeleportation } from "../hooks/usePlayerTeleportation";
import { usePlayerDebugInfo } from "../hooks/usePlayerDebugInfo";
import { useHandsOut } from "../store/consolidatedGameStore";

interface PlayerProps {
  initialSpawnPosition?: [number, number, number];
  showDebugInfo?: boolean;
  showHand?: boolean;
  handGesture?: "idle" | "pointing" | "grabbing" | "waving";
  editorMode?: boolean;
}

export function Player({
  initialSpawnPosition = [0, 1.5, 0],
  showDebugInfo = false,
  showHand = true,
  handGesture = "idle",
  editorMode = false,
}: PlayerProps) {
  const ref = useRef<RapierRigidBody>(null);

  // Enable mouse look only when not in editor mode
  useMouseLook(editorMode);

  // Use modular hooks
  const { spawnPosition, isSpawned, spawnInfo } = usePlayerSpawn({
    initialSpawnPosition,
    showDebugInfo,
  });

  const { handPositionRef, handRotationRef, updateCameraPosition } =
    usePlayerCamera({
      isSpawned,
      spawnPosition,
      editorMode,
      showHand,
    });

  const { handleMovement } = usePlayerMovement({
    isSpawned,
    editorMode,
  });

  usePlayerTeleportation({ rigidBodyRef: ref });

  // Get hands out state from store
  const handsOut = useHandsOut();

  // Always call hooks, but conditionally execute logic
  const debugInfo = usePlayerDebugInfo({
    showDebugInfo,
    spawnInfo,
    spawnPosition,
  });

  // Player position ref for hand positioning
  const playerPositionRef = useRef<[number, number, number]>([0, 0, 0]);

  // Main game loop
  useFrame((state, delta) => {
    if (!isSpawned || !ref.current) return;

    // Update ref-based game state (no React re-renders)
    refBasedGameState.update();

    // Get player position
    const { x, y, z } = ref.current.translation();
    const playerPosition = new THREE.Vector3(x, y, z);
    playerPositionRef.current = [x, y, z];

    // Update camera position
    updateCameraPosition(playerPosition);

    // Handle movement
    handleMovement(ref.current);
  });

  if (!isSpawned) {
    return null; // Don't render until we have a safe spawn position
  }

  return (
    <>
      <RigidBody
        gravityScale={2}
        ref={ref}
        colliders={false}
        mass={50}
        name="canonical-player"
        type="dynamic"
        position={spawnPosition}
        enabledRotations={[false, false, false]}
        lockRotations
        onCollisionEnter={(event) => {
          if (showDebugInfo) {
            console.log("Player: Collision detected", event);
          }
        }}
      >
        <CapsuleCollider args={[0.8, 0.3]} />
      </RigidBody>

      {/* Floating Hand - Mouse Driven */}
      {handsOut && isSpawned && (
        <PlayerHand
          position={[0, 0, 0]} // Position is now handled by mouse following
          rotation={[0, 0, 0]} // Rotation is now handled by mouse following
          scale={[0.8, 0.8, 0.8]}
          visible={true}
          gesture={handGesture}
          animationSpeed={1.0}
          followMouse={true}
          followDistance={3}
          playerPosition={playerPositionRef.current}
          editorMode={editorMode}
        />
      )}

      {/* Debug information */}
      {debugInfo}
    </>
  );
}
