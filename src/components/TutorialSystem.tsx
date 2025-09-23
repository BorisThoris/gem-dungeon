import React, { useState, useEffect } from "react";
import { Text } from "@react-three/drei";

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  position: [number, number, number];
  trigger:
    | "room_enter"
    | "item_pickup"
    | "puzzle_start"
    | "combat_start"
    | "boss_encounter"
    | "secret_discover"
    | "manual";
  condition?: (gameState: any) => boolean;
  completed: boolean;
}

interface TutorialSystemProps {
  gameState: any;
  onTutorialComplete: (tutorialId: string) => void;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "movement",
    title: "Movement",
    description: "Use WASD to move around. Mouse to look around.",
    position: [0, 2, 0],
    trigger: "room_enter",
    completed: false,
  },
  {
    id: "item_pickup",
    title: "Item Pickup",
    description:
      "Click on items to pick them up. Items give you special abilities!",
    position: [0, 2, 0],
    trigger: "item_pickup",
    completed: false,
  },
  {
    id: "puzzle_mechanics",
    title: "Puzzle Rooms",
    description:
      "Match the tiles to complete puzzles. Use the PREVIEW button for help!",
    position: [0, 2, 0],
    trigger: "puzzle_start",
    completed: false,
  },
  {
    id: "combat_basics",
    title: "Combat",
    description: "Click on enemies to attack them. Watch your health!",
    position: [0, 2, 0],
    trigger: "combat_start",
    completed: false,
  },
  {
    id: "shop_system",
    title: "Shopping",
    description:
      "Spend points to buy items. Green = affordable, Red = too expensive.",
    position: [0, 2, 0],
    trigger: "room_enter",
    condition: (state) => state.currentRoomId?.includes("shop"),
    completed: false,
  },
  {
    id: "secret_discovery",
    title: "Secret Rooms",
    description: "Get close to walls to discover hidden secrets!",
    position: [0, 2, 0],
    trigger: "secret_discover",
    completed: false,
  },
  {
    id: "boss_fight",
    title: "Boss Battle",
    description: "Bosses have multiple phases. Attack them to win!",
    position: [0, 2, 0],
    trigger: "boss_encounter",
    completed: false,
  },
];

const TutorialSystem: React.FC<TutorialSystemProps> = ({
  gameState,
  onTutorialComplete,
}) => {
  const [activeTutorials, setActiveTutorials] = useState<TutorialStep[]>([]);
  const [completedTutorials, setCompletedTutorials] = useState<Set<string>>(
    new Set()
  );

  // Check for tutorial triggers
  useEffect(() => {
    const newActiveTutorials: TutorialStep[] = [];

    TUTORIAL_STEPS.forEach((step) => {
      if (completedTutorials.has(step.id)) return;

      let shouldShow = false;

      switch (step.trigger) {
        case "room_enter":
          shouldShow = gameState.currentRoomId !== null;
          break;
        case "item_pickup":
          shouldShow = gameState.inventory.length > 0;
          break;
        case "puzzle_start":
          shouldShow = gameState.gamePhase === "puzzle";
          break;
        case "combat_start":
          shouldShow = gameState.gamePhase === "combat";
          break;
        case "boss_encounter":
          shouldShow = gameState.gamePhase === "boss";
          break;
        case "secret_discover":
          shouldShow = gameState.discoveredSecrets.length > 0;
          break;
        case "manual":
          shouldShow = false; // Manual triggers only
          break;
      }

      if (step.condition) {
        shouldShow = shouldShow && step.condition(gameState);
      }

      if (shouldShow) {
        newActiveTutorials.push(step);
      }
    });

    setActiveTutorials(newActiveTutorials);
  }, [gameState, completedTutorials]);

  const completeTutorial = (tutorialId: string) => {
    setCompletedTutorials((prev) => new Set([...prev, tutorialId]));
    setActiveTutorials((prev) => prev.filter((t) => t.id !== tutorialId));
    onTutorialComplete(tutorialId);
  };

  const skipTutorial = (tutorialId: string) => {
    completeTutorial(tutorialId);
  };

  if (activeTutorials.length === 0) return null;

  return (
    <group>
      {activeTutorials.map((tutorial) => (
        <group key={tutorial.id} position={tutorial.position}>
          {/* Tutorial Background */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[6, 2, 0.2]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.8} />
          </mesh>

          {/* Tutorial Title */}
          <Text
            position={[0, 0.5, 0.1]}
            fontSize={0.4}
            color="#FFD700"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#000000"
          >
            {tutorial.title}
          </Text>

          {/* Tutorial Description */}
          <Text
            position={[0, 0, 0.1]}
            fontSize={0.25}
            color="#FFFFFF"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.01}
            outlineColor="#000000"
          >
            {tutorial.description}
          </Text>

          {/* Tutorial Controls */}
          <Text
            position={[0, -0.5, 0.1]}
            fontSize={0.2}
            color="#CCCCCC"
            anchorX="center"
            anchorY="middle"
          >
            Click to continue
          </Text>

          {/* Interactive Area */}
          <mesh
            position={[0, 0, 0]}
            onClick={() => completeTutorial(tutorial.id)}
            onPointerOver={(e) => {
              e.stopPropagation();
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              document.body.style.cursor = "auto";
            }}
          >
            <boxGeometry args={[6, 2, 0.1]} />
            <meshBasicMaterial transparent opacity={0} />
          </mesh>

          {/* Skip Button */}
          <mesh
            position={[2.5, -0.8, 0.1]}
            onClick={() => skipTutorial(tutorial.id)}
            onPointerOver={(e) => {
              e.stopPropagation();
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              document.body.style.cursor = "auto";
            }}
          >
            <boxGeometry args={[1, 0.3, 0.05]} />
            <meshBasicMaterial color="#666666" />
          </mesh>

          <Text
            position={[2.5, -0.8, 0.15]}
            fontSize={0.15}
            color="#FFFFFF"
            anchorX="center"
            anchorY="middle"
          >
            Skip
          </Text>
        </group>
      ))}
    </group>
  );
};

export default TutorialSystem;
