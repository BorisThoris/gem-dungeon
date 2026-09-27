import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { uiEvents, UI_EVENTS } from "../utils/uiEvents";
import { gameEvents, GAME_EVENTS } from "../utils/gameEvents";
import { cameraRotationRefs } from "../utils/cameraRotationRef";

export const useMouseLook = (editorMode: boolean = false) => {
  const { camera } = useThree();
  const isPointerLocked = useRef(false);
  const euler = useRef({ x: 0, y: 0 });
  const sensitivity = 0.001; // Reduced for smoother movement
  const isMouseDown = useRef(false);
  const lastRotationUpdate = useRef(0);
  const pendingRotation = useRef({ x: 0, y: 0 });

  // Check if we're running in Electron
  const isElectron =
    typeof window !== "undefined" &&
    window.navigator.userAgent.toLowerCase().includes("electron");

  useEffect(() => {
    // Skip mouse look setup in editor mode
    if (editorMode) return;

    // Set FOV to 95 degrees
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = 75;
      camera.updateProjectionMatrix();
    }

    // Set camera rotation order but don't override existing rotation
    camera.rotation.order = "YXZ";

    // Only set default rotation if camera hasn't been positioned yet
    if (camera.position.length() === 0) {
      camera.rotation.x = 0; // Look straight ahead (not down)
      camera.rotation.y = -Math.PI / 2; // Face forward
      camera.rotation.z = 0;

      // Initialize euler refs to match camera rotation
      euler.current.x = 0;
      euler.current.y = -Math.PI / 2;
    } else {
      // Use existing camera rotation
      euler.current.x = camera.rotation.x;
      euler.current.y = camera.rotation.y;
    }

    // Listen for camera rotation changes from teleportation
    const handleCameraUpdate = () => {
      // Sync euler refs with current camera rotation
      euler.current.x = camera.rotation.x;
      euler.current.y = camera.rotation.y;
    };

    // Listen for teleportation events to sync rotation
    const handleTeleport = () => {
      setTimeout(() => {
        handleCameraUpdate();
        updateCameraRotation(); // Ensure camera rotation is applied immediately
      }, 50); // Small delay to ensure camera is updated
    };

    window.addEventListener("playerTeleport", handleTeleport);

    // Listen for programmatic camera rotation requests
    const offSetRotation = gameEvents.on(
      GAME_EVENTS.CAMERA_SET_ROTATION,
      (rotation: { x: number; y: number; z?: number }) => {
        euler.current.x = rotation.x;
        euler.current.y = rotation.y;
        updateCameraRotation();
      }
    );

    // Simple camera update function
    const updateCameraRotation = () => {
      camera.rotation.order = "YXZ";
      camera.rotation.y = euler.current.y;
      camera.rotation.x = euler.current.x;

      // Update global camera rotation refs
      cameraRotationRefs.updateRotation({
        y: euler.current.y,
        x: euler.current.x,
      });

      // Emit camera rotation change event for UI components
      gameEvents.emit(GAME_EVENTS.CAMERA_ROTATION_CHANGE, {
        y: euler.current.y,
        x: euler.current.x,
      });
    };

    const handleMouseMove = (event: MouseEvent) => {
      // Only handle mouse look when pointer is locked (right mouse button held)
      if (!isPointerLocked.current || !isMouseDown.current) return;

      // Don't interfere with Three.js object interactions
      if (event.target && (event.target as Element).closest("canvas")) {
        return;
      }

      // Get movement delta - use movementX/Y if available, otherwise calculate from clientX/Y
      let deltaX = event.movementX || 0;
      let deltaY = event.movementY || 0;

      // Electron fallback: if movementX/Y are not available, use a different approach
      if (isElectron && deltaX === 0 && deltaY === 0) {
        // In Electron, sometimes movementX/Y are not available
        // We'll use a simpler approach with clientX/Y tracking
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        deltaX = event.clientX - centerX;
        deltaY = event.clientY - centerY;

        // Reset cursor to center (this would need to be handled by the main process)
        // For now, we'll just use the delta as-is
      }

      // Accumulate rotation changes
      euler.current.y -= deltaX * sensitivity;
      euler.current.x -= deltaY * sensitivity;

      // Clamp vertical rotation
      euler.current.x = Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, euler.current.x)
      );

      // Update camera rotation
      updateCameraRotation();
    };

    const handlePointerLockChange = () => {
      isPointerLocked.current = document.pointerLockElement !== null;

      // Electron-specific pointer lock handling
      if (isElectron) {
        // Force update camera rotation when pointer lock changes
        if (isPointerLocked.current && isMouseDown.current) {
          updateCameraRotation();
        }
      }
    };

    // Right mouse button to enable mouse look
    const handleMouseDown = (event: MouseEvent) => {
      if (event.button === 2) {
        // Right mouse button
        isMouseDown.current = true;

        if (!isPointerLocked.current) {
          // Try to request pointer lock
          const requestPromise = document.body.requestPointerLock();

          // Electron-specific handling
          if (isElectron) {
            requestPromise.catch((error) => {
              console.warn("Pointer lock failed in Electron:", error);
              // Fallback: enable mouse look without pointer lock
              isPointerLocked.current = true;
              updateCameraRotation();
            });
          }
        }

        // Emit UI event instead of React state update
        uiEvents.emit(UI_EVENTS.MOUSE_LOOK_START);
      }
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (event.button === 2) {
        // Right mouse button
        isMouseDown.current = false;
        if (isPointerLocked.current) {
          document.exitPointerLock();
        }
        // Emit UI event instead of React state update
        uiEvents.emit(UI_EVENTS.MOUSE_LOOK_END);
      }
    };

    // Prevent context menu on right click
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener(
        "pointerlockchange",
        handlePointerLockChange
      );
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("playerTeleport", handleTeleport);
      offSetRotation?.();
    };
  }, [camera, isElectron, editorMode]);

  return {
    isPointerLocked: isPointerLocked.current,
    isMouseDown: isMouseDown.current,
  };
};
