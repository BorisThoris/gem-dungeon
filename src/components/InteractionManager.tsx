import React, { useState, useEffect } from "react";
import useGameStore from "../store/gameStore";
import useMapStore from "../store/mapStore";
import FirstPersonPuzzle from "./FirstPersonPuzzle";
import type { Room } from "../types/map";

interface InteractionManagerProps {
  playerPosition: [number, number, number];
}

const InteractionManager: React.FC<InteractionManagerProps> = ({
  playerPosition: _playerPosition,
}) => {
  const { addScore, addExperience, addItem, setGamePhase } = useGameStore();
  const { currentMap } = useMapStore();

  const [activeInteraction, setActiveInteraction] = useState<string | null>(
    null
  );
  const [interactionRoom, setInteractionRoom] = useState<Room | null>(null);
  const [puzzleComplete, setPuzzleComplete] = useState(false);

  // Room interaction handling would be implemented here

  // Room interaction handlers would be implemented here

  // Handle puzzle completion
  const handlePuzzleComplete = () => {
    if (!interactionRoom) return;

    setPuzzleComplete(true);
    addScore(100);
    addExperience(50);

    // Give puzzle reward
    if (interactionRoom.items && interactionRoom.items.length > 0) {
      interactionRoom.items.forEach((item) => {
        addItem(item);
      });
    }

    console.log("Puzzle completed! You received a reward!");
  };

  // Handle puzzle exit
  const handlePuzzleExit = () => {
    setActiveInteraction(null);
    setInteractionRoom(null);
    setPuzzleComplete(false);
    setGamePhase("exploration");
  };

  // Auto-exit puzzle after completion
  useEffect(() => {
    if (puzzleComplete) {
      const timer = setTimeout(() => {
        handlePuzzleExit();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [puzzleComplete]);

  // Render active interaction
  const renderActiveInteraction = () => {
    if (!activeInteraction || !interactionRoom) return null;

    switch (activeInteraction) {
      case "puzzle":
        if ((interactionRoom as any).puzzle) {
          return (
            <FirstPersonPuzzle
              puzzle={(interactionRoom as any).puzzle}
              onComplete={handlePuzzleComplete}
              onExit={handlePuzzleExit}
            />
          );
        }
        break;
      default:
        return null;
    }

    return null;
  };

  return (
    <>
      {/* Render all room interactions */}
      {currentMap?.rooms.map((room) => (
        <group key={room.id}>
          {/* Room interaction would be handled by RoomInteraction component */}
        </group>
      ))}

      {/* Active interaction overlay */}
      {renderActiveInteraction()}
    </>
  );
};

export default InteractionManager;
