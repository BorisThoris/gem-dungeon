import { gameEvents, GAME_EVENTS } from "../utils/gameEvents";
import { useRef, useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Vector3 } from "three";

interface UsePlayerCameraProps {
  isSpawned: boolean;
  spawnPosition: [number, number, number];
  editorMode: boolean;
  showHand: boolean;
  initialYaw?: number;
}

export const usePlayerCamera = ({
  isSpawned,
  spawnPosition,
  editorMode,
  showHand,
  initialYaw = 0,
}: UsePlayerCameraProps) => {
  const { camera } = useThree();
  const cameraPositionRef = useRef(new Vector3());
  const lastUpdateTime = useRef(0);

  // Hand position tracking
  const handPositionRef = useRef(new Vector3());
  const handRotationRef = useRef(new Vector3());

  // Initialize camera position and rotation once spawned
  useEffect(() => {
    if (isSpawned && spawnPosition && !editorMode) {
      // Set camera position to spawn position with eye level offset
      camera.position.set(spawnPosition[0], spawnPosition[1] + 0.65, spawnPosition[2]);
      
      // Set camera rotation to look forward (reset from editor angle)
      camera.rotation.set(-0.05, initialYaw, 0);
      gameEvents.emit(GAME_EVENTS.CAMERA_SET_ROTATION, { x: -0.05, y: initialYaw });
      camera.updateMatrixWorld(true);
    }
  }, [camera, spawnPosition, isSpawned, editorMode, initialYaw]);

  // Update camera position during gameplay
  const updateCameraPosition = (playerPosition: Vector3) => {
    if (editorMode) return;

    const now = performance.now();
    if (now - lastUpdateTime.current > 16) { // ~60fps max
      // Update camera position
      cameraPositionRef.current.set(playerPosition.x, playerPosition.y + 0.65, playerPosition.z);
      camera.position.copy(cameraPositionRef.current);
      camera.updateMatrixWorld(true);

      // Update hand position relative to camera
      if (showHand && camera.right && camera.direction) {
        // Position hand slightly in front and to the right of the camera
        handPositionRef.current.set(
          playerPosition.x + camera.right.x * 0.3 + camera.direction.x * 0.5,
          playerPosition.y + 1.2, // Slightly lower than camera
          playerPosition.z + camera.right.z * 0.3 + camera.direction.z * 0.5
        );

        // Match hand rotation to camera rotation
        handRotationRef.current.set(
          camera.rotation.x,
          camera.rotation.y,
          camera.rotation.z
        );
      } else if (showHand) {
        // Fallback position if camera vectors aren't ready yet
        handPositionRef.current.set(
          playerPosition.x + 0.3, // Simple offset to the right
          playerPosition.y + 1.2, // Slightly lower than camera
          playerPosition.z + 0.5 // Simple offset forward
        );

        // Use default rotation
        handRotationRef.current.set(0, 0, 0);
      }

      lastUpdateTime.current = now;
    }
  };

  return {
    handPositionRef,
    handRotationRef,
    updateCameraPosition,
  };
};
