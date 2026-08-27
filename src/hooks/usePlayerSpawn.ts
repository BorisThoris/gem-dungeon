import { useState, useEffect } from "react";
import { useSimpleSafeSpawn } from "./useSimpleSafeSpawn";

interface UsePlayerSpawnProps {
  initialSpawnPosition: [number, number, number];
  showDebugInfo: boolean;
}

export const usePlayerSpawn = ({ 
  initialSpawnPosition, 
  showDebugInfo 
}: UsePlayerSpawnProps) => {
  const { findSafeSpawnPosition } = useSimpleSafeSpawn({
    maxAttempts: 100,
    searchRadius: 25,
    searchHeight: 5,
    playerRadius: 0.8,
    playerHeight: 1.6,
    stepSize: 0.5,
  });

  // State for spawn management
  const [spawnPosition, setSpawnPosition] = useState<[number, number, number]>(initialSpawnPosition);
  const [isSpawned, setIsSpawned] = useState(false);
  const [spawnInfo, setSpawnInfo] = useState<{
    isSafe: boolean;
    attempts: number;
    position: [number, number, number];
  } | null>(null);

  // Find safe spawn position on mount
  useEffect(() => {
    // The canonical geometry adapter supplies a floor-aware, validated spawn.
    const safeSpawnPosition: [number, number, number] = [
      initialSpawnPosition[0],
      initialSpawnPosition[1],
      initialSpawnPosition[2],
    ];

    setSpawnPosition(safeSpawnPosition);
    setSpawnInfo({
      position: safeSpawnPosition,
      isSafe: true,
      attempts: 1,
    });
    setIsSpawned(true);

    if (showDebugInfo) {
      console.log("Player: Safe spawning at", safeSpawnPosition);
      console.log(
        "Player: Player capsule will be from Y=",
        1.5 - 0.3,
        "to Y=",
        1.5 + 0.3
      );
    }
  }, [initialSpawnPosition, showDebugInfo]);

  return {
    spawnPosition,
    isSpawned,
    spawnInfo,
    setSpawnPosition,
  };
};
