import React, { useState } from "react";
import { Text } from "@react-three/drei";
import type { Puzzle, PuzzleTile } from "../types/map";

interface PuzzleGridProps {
  puzzle: Puzzle;
  onTileClick: (tile: PuzzleTile) => void;
  onComplete: () => void;
}

const PuzzleGrid: React.FC<PuzzleGridProps> = ({
  puzzle,
  onTileClick,
  onComplete,
}) => {
  const [flippedTiles, setFlippedTiles] = useState<string[]>([]);
  const [matchedTiles, setMatchedTiles] = useState<string[]>([]);
  const [previewTiles] = useState<string[]>([]);

  const handleTileClick = (tile: PuzzleTile) => {
    if (tile.state === "matched" || tile.state === "flipped") return;

    onTileClick(tile);

    // Add flip logic here
    setFlippedTiles((prev) => [...prev, tile.id]);

    // Check for matches
    const currentFlipped = [...flippedTiles, tile.id];
    if (currentFlipped.length === 2) {
      const [firstId, secondId] = currentFlipped;
      const firstTile = puzzle.tiles.find((t) => t.id === firstId);
      const secondTile = puzzle.tiles.find((t) => t.id === secondId);

      if (firstTile?.pairId === secondTile?.id) {
        // Match found
        setMatchedTiles((prev) => [...prev, firstId, secondId]);
        setFlippedTiles([]);

        // Check if puzzle is complete
        if (matchedTiles.length + 2 === puzzle.tiles.length) {
          onComplete();
        }
      } else {
        // No match, flip back after delay
        setTimeout(() => {
          setFlippedTiles([]);
        }, 1000);
      }
    }
  };

  const getTileState = (tile: PuzzleTile): string => {
    if (matchedTiles.includes(tile.id)) return "matched";
    if (flippedTiles.includes(tile.id)) return "flipped";
    if (previewTiles.includes(tile.id)) return "preview";
    return "hidden";
  };

  const getTileColor = (state: string): string => {
    switch (state) {
      case "hidden":
        return "#444444";
      case "flipped":
        return "#666666";
      case "matched":
        return "#00ff00";
      case "mismatched":
        return "#ff0000";
      case "preview":
        return "#ffff00";
      default:
        return "#444444";
    }
  };

  const gridSize = Math.sqrt(puzzle.tiles.length);
  const tileSize = 1.5;
  const spacing = 0.1;

  return (
    <group>
      {/* Puzzle Title */}
      <Text
        position={[0, (gridSize * tileSize) / 2 + 1, 0]}
        fontSize={0.8}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        {puzzle.type.replace("-", " ").toUpperCase()}
      </Text>

      {/* Grid */}
      {puzzle.tiles.map((tile, index) => {
        const row = Math.floor(index / gridSize);
        const col = index % gridSize;
        const x = (col - (gridSize - 1) / 2) * (tileSize + spacing);
        const z = (row - (gridSize - 1) / 2) * (tileSize + spacing);

        const state = getTileState(tile);
        const color = getTileColor(state);

        return (
          <mesh
            key={tile.id}
            position={[x, 0, z]}
            onClick={() => handleTileClick(tile)}
          >
            <boxGeometry args={[tileSize, 0.2, tileSize]} />
            <meshBasicMaterial color={color} />

            {/* Tile Content */}
            {state !== "hidden" && (
              <Text
                position={[0, 0.2, 0]}
                fontSize={0.6}
                color="#000000"
                anchorX="center"
                anchorY="middle"
              >
                {tile.shape}
              </Text>
            )}
          </mesh>
        );
      })}

      {/* Progress Indicator */}
      <Text
        position={[0, (-gridSize * tileSize) / 2 - 1, 0]}
        fontSize={0.6}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        {matchedTiles.length / 2} / {puzzle.tiles.length / 2} pairs
      </Text>
    </group>
  );
};

export default PuzzleGrid;
