import React, { useState, useEffect } from "react";
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
  const [previewTiles, setPreviewTiles] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30); // 30 second timer
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // Timer countdown
  useEffect(() => {
    if (timeLeft > 0 && matchedTiles.length < puzzle.tiles.length) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0) {
      // Time's up - reset puzzle
      setFlippedTiles([]);
      setMatchedTiles([]);
      setMoves(0);
      setTimeLeft(30);
    }
  }, [timeLeft, matchedTiles.length, puzzle.tiles.length]);

  // Preview mode - show all tiles briefly
  const startPreview = () => {
    if (isPreviewMode) return;
    setIsPreviewMode(true);
    setPreviewTiles(puzzle.tiles.map((t) => t.id));

    setTimeout(() => {
      setPreviewTiles([]);
      setIsPreviewMode(false);
    }, 2000);
  };

  const handleTileClick = (tile: PuzzleTile) => {
    if (tile.state === "matched" || tile.state === "flipped" || isPreviewMode)
      return;

    onTileClick(tile);
    setMoves((prev) => prev + 1);

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

  const getTileGlow = (state: string): number => {
    switch (state) {
      case "matched":
        return 0.5;
      case "preview":
        return 0.3;
      case "flipped":
        return 0.2;
      default:
        return 0;
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
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {puzzle.type.replace("-", " ").toUpperCase()}
      </Text>

      {/* Timer and Stats */}
      <group position={[0, (gridSize * tileSize) / 2 + 0.5, 0]}>
        <Text
          position={[-2, 0, 0]}
          fontSize={0.4}
          color={timeLeft < 10 ? "#ff0000" : "#ffffff"}
          anchorX="center"
          anchorY="middle"
        >
          Time: {timeLeft}s
        </Text>
        <Text
          position={[0, 0, 0]}
          fontSize={0.4}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
        >
          Moves: {moves}
        </Text>
        <Text
          position={[2, 0, 0]}
          fontSize={0.4}
          color="#00ff00"
          anchorX="center"
          anchorY="middle"
        >
          Matched: {matchedTiles.length / 2}/{puzzle.tiles.length / 2}
        </Text>
      </group>

      {/* Preview Button */}
      <mesh
        position={[0, (gridSize * tileSize) / 2 + 0.2, 0]}
        onClick={startPreview}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <boxGeometry args={[1, 0.3, 0.1]} />
        <meshBasicMaterial color={isPreviewMode ? "#ff0000" : "#4CAF50"} />
      </mesh>
      <Text
        position={[0, (gridSize * tileSize) / 2 + 0.2, 0.1]}
        fontSize={0.2}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        PREVIEW
      </Text>

      {/* Grid */}
      {puzzle.tiles.map((tile, index) => {
        const row = Math.floor(index / gridSize);
        const col = index % gridSize;
        const x = (col - (gridSize - 1) / 2) * (tileSize + spacing);
        const z = (row - (gridSize - 1) / 2) * (tileSize + spacing);

        const state = getTileState(tile);
        const color = getTileColor(state);
        const glow = getTileGlow(state);

        return (
          <group key={tile.id}>
            <mesh
              position={[x, 0, z]}
              onClick={() => handleTileClick(tile)}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = "pointer";
              }}
              onPointerOut={() => {
                document.body.style.cursor = "auto";
              }}
            >
              <boxGeometry args={[tileSize, 0.2, tileSize]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={glow}
              />

              {/* Tile Content */}
              {state !== "hidden" && (
                <Text
                  position={[0, 0.2, 0]}
                  fontSize={0.6}
                  color="#ffffff"
                  anchorX="center"
                  anchorY="middle"
                  outlineWidth={0.01}
                  outlineColor="#000000"
                >
                  {tile.shape}
                </Text>
              )}
            </mesh>

            {/* Glow Effect */}
            {glow > 0 && (
              <mesh position={[x, 0.1, z]}>
                <boxGeometry args={[tileSize + 0.2, 0.1, tileSize + 0.2]} />
                <meshBasicMaterial
                  color={color}
                  transparent
                  opacity={glow * 0.5}
                />
              </mesh>
            )}
          </group>
        );
      })}

      {/* Completion Message */}
      {matchedTiles.length === puzzle.tiles.length && (
        <Text
          position={[0, (-gridSize * tileSize) / 2 - 1, 0]}
          fontSize={0.8}
          color="#00ff00"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          PUZZLE COMPLETE!
        </Text>
      )}
    </group>
  );
};

export default PuzzleGrid;
