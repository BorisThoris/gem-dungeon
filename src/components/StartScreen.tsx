import React from "react";
import { Canvas } from "@react-three/fiber";
import { Physics, RigidBody } from "@react-three/rapier";
import { Environment } from "@react-three/drei";
import { useCameraController } from "../hooks/useCameraController";
import { Player } from "./Player";
import { SafeSpawnArea } from "./SafeSpawnArea";
import UnifiedRoomManager from "./UnifiedRoomManager";
import MapUI from "./MapUI";
import Minimap from "./Minimap";
import Cursor from "./Cursor";
import PauseMenu from "./PauseMenu";
import EventDrivenActionCards from "./EventDrivenActionCards";
import SharedNavigation from "./SharedNavigation";
// WallToggleProvider removed - now using Zustand store
import useGameStore from "../store/gameStore";
import { domUIManager } from "../utils/domUIManager";
import { uiEvents, UI_EVENTS } from "../utils/uiEvents";
import GameInitializer from "./GameInitializer";
import { canonicalDungeonToGeometry } from "../adapters/canonicalGeometryAdapter";
import useMapStore from "../store/mapStore";

// First-person controls handled by FirstPersonPlayer component

// Ground Plane Component
const Ground: React.FC = () => {
  return (
    <RigidBody type="fixed" colliders="trimesh">
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -2, 0]}
        receiveShadow
        onClick={() => {
          // Floor clicked
        }}
        onPointerOver={() => {
          // Floor hovered
        }}
      >
        <planeGeometry args={[50, 50]} />
        <meshLambertMaterial color="#2d5016" />
      </mesh>
    </RigidBody>
  );
};

// Safety Floor - very large invisible catch plane to prevent falling
const SafetyFloor: React.FC = () => {
  return (
    <RigidBody type="fixed" colliders="trimesh">
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -10, 0]}
        visible={false}
      >
        <planeGeometry args={[2000, 2000]} />
        <meshBasicMaterial color="#000000" transparent opacity={0} />
      </mesh>
    </RigidBody>
  );
};

// Main Scene Component
const GhostScene: React.FC = () => {
  const currentDungeon = useMapStore((state) => state.currentDungeon);
  const canonicalSpawn = React.useMemo<[number, number, number]>(() => {
    if (!currentDungeon) return [0, 1.5, 0];
    const spawn = canonicalDungeonToGeometry(currentDungeon).spawn;
    return [spawn.x, spawn.y, spawn.z];
  }, [currentDungeon]);
  // Mount centralized camera controller to handle programmatic rotations
  useCameraController();
  return (
    <>
      {/* Environment */}
      <Environment files="./night.hdr" ground={{ scale: 100 }} />

      {/* Lighting */}
      <ambientLight intensity={0.2} />
      <directionalLight
        intensity={0.7}
        castShadow
        shadow-bias={-0.0004}
        position={[-20, 20, 20]}
      >
        <orthographicCamera attach="shadow-camera" args={[-20, 20, 20, -20]} />
      </directionalLight>

      {/* Physics World */}
      <Physics timeStep="vary" gravity={[0, -9.81, 0]}>
        {/* Safe Spawn Area */}
        {!currentDungeon && <SafeSpawnArea position={[0, 0, 0]} size={8} />}

        {/* Safe First Person Player */}
        <Player
          initialSpawnPosition={canonicalSpawn}
          key={currentDungeon?.replay.spatialHash ?? "legacy-player"}
          showDebugInfo={false}
        />

        {/* Room Instance Manager - Single room at a time */}
        <UnifiedRoomManager mode={currentDungeon ? "canonical" : "instance"} />

        {/* Ground */}
        {!currentDungeon && <Ground />}

        {/* Safety catch floor (invisible) */}
        <SafetyFloor />
      </Physics>
    </>
  );
};

const StartScreenContent: React.FC = () => {
  const { inventory, useItem: consumeItem } = useGameStore();
  const currentDungeon = useMapStore((state) => state.currentDungeon);
  const currentMap = useMapStore((state) => state.currentMap);
  const currentRoomId = useMapStore((state) => state.currentRoomId);
  const [isPaused, setIsPaused] = React.useState(false);

  // Initialize DOM UI manager
  React.useEffect(() => {
    domUIManager.init();

    // Listen for item use events from DOM UI
    const handleItemUse = (event: CustomEvent) => {
      consumeItem(event.detail.id);
    };

    window.addEventListener("itemUse", handleItemUse as EventListener);

    return () => {
      window.removeEventListener("itemUse", handleItemUse as EventListener);
      domUIManager.destroy();
    };
  }, [consumeItem]);

  React.useEffect(() => {
    const canonicalRoom = currentDungeon?.rooms.find((room) => room.id === currentRoomId);
    const legacyRoom = currentMap?.rooms.find((room) => room.id === currentRoomId);
    uiEvents.emit(
      UI_EVENTS.ROOM_CHANGE,
      canonicalRoom?.archetype ?? legacyRoom?.type ?? currentRoomId ?? "Unknown",
    );
  }, [currentDungeon, currentMap, currentRoomId]);

  // Update UI when inventory changes (throttled)
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      uiEvents.emit(UI_EVENTS.INVENTORY_UPDATE, inventory);
    }, 100); // Throttle updates

    return () => clearTimeout(timeoutId);
  }, [inventory]);

  // Player stats are now handled by ref-based state (no React re-renders)

  // Item use is now handled by DOM UI manager

  // Handle pause/unpause
  const handlePause = () => {
    setIsPaused(true);
  };

  const handleUnpause = () => {
    setIsPaused(false);
  };

  // Listen for X key to pause/unpause
  React.useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === "x" || event.key === "X") {
        if (isPaused) {
          handleUnpause();
        } else {
          handlePause();
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [isPaused]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        margin: 0,
        padding: 0,
        overflow: "hidden",
        background: "linear-gradient(to bottom, #87CEEB 0%, #98D8E8 100%)",
        position: "fixed",
        top: 0,
        left: 0,
        cursor: "none", // Hide default cursor
      }}
    >
      {!isPaused &&
        (() => {
          return (
            <Canvas
              shadows
              style={{
                width: "100%",
                height: "100%",
                background: "transparent",
                display: "block",
                cursor: "default", // Show default cursor in free hand mode
              }}
              gl={{
                antialias: true,
                alpha: true,
                powerPreference: "high-performance",
                stencil: false,
                depth: true,
              }}
              camera={{
                fov: 95,
                position: [0, 5, 0],
                rotation: [0, -Math.PI / 2, 0], // Look straight ahead
              }}
              dpr={[1, 2]}
              performance={{ min: 0.5 }}
              frameloop="always"
            >
              <GhostScene />
            </Canvas>
          );
        })()}

      {/* Event-Driven Action Cards */}
      <EventDrivenActionCards />

      {/* Map UI Overlay */}
      <MapUI />

      {/* Minimap */}
      <Minimap />

      {/* Cursor - Outside Canvas so it's always visible */}
      {!isPaused && <Cursor />}

      {/* Pause Menu */}
      <PauseMenu isVisible={isPaused} onUnpause={handleUnpause} />

      {/* Shared Navigation */}
      <SharedNavigation currentPage="game" />

      {/* UI is now handled by DOM UI Manager - no React re-renders */}
    </div>
  );
};

const StartScreen: React.FC = () => {
  return (
    <GameInitializer>
      <StartScreenContent />
    </GameInitializer>
  );
};

export default StartScreen;
