import React, { useState } from "react";
import { RigidBody } from "@react-three/rapier";
import { Text } from "@react-three/drei";
import PuzzleGrid from "../PuzzleGrid";
import type { Puzzle, Item } from "../../types/map";

interface PuzzleRoomProps {
  puzzle: Puzzle;
  onPuzzleComplete: () => void;
  onTileClick: (tile: { id: string; pairId?: string | null }) => void;
  reward?: Item;
  onRewardClaim: (item: Item) => void;
}

const PuzzleRoom: React.FC<PuzzleRoomProps> = ({
  puzzle,
  onPuzzleComplete,
  onTileClick,
  reward,
  onRewardClaim: _onRewardClaim,
}) => {
  const [isCompleted, setIsCompleted] = useState(false);
  const [showReward, setShowReward] = useState(false);

  // Create simple table model instead of loading VOX

  const handlePuzzleComplete = () => {
    setIsCompleted(true);
    setShowReward(true);
    onPuzzleComplete();
  };

  return (
    <group>
      {/* Puzzle Table - Simple 3D model */}
      <RigidBody type="fixed" colliders="trimesh">
        <group position={[0, 0, 0]}>
          {/* Table Top */}
          <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
            <boxGeometry args={[4, 0.1, 4]} />
            <meshLambertMaterial color="#8B4513" />
          </mesh>
          {/* Table Legs */}
          {[
            [-1.8, -1.8],
            [1.8, -1.8],
            [-1.8, 1.8],
            [1.8, 1.8],
          ].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.2, z]}>
              <boxGeometry args={[0.2, 0.4, 0.2]} />
              <meshLambertMaterial color="#654321" />
            </mesh>
          ))}
        </group>
      </RigidBody>

      {/* Puzzle Area */}
      <group position={[0, 0, 0]}>
        <PuzzleGrid
          puzzle={puzzle}
          onTileClick={onTileClick}
          onComplete={handlePuzzleComplete}
        />
      </group>

      {/* Room Decoration - Puzzle Symbols */}
      <group position={[-3, 1, -3]}>
        <mesh>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshLambertMaterial color="#9B59B6" />
        </mesh>
        {/* Puzzle icon - Simple colored sphere */}
        <mesh position={[0, 0.5, 0]}>
          <sphereGeometry args={[0.2, 8, 8]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
      </group>

      <group position={[3, 1, -3]}>
        <mesh>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshLambertMaterial color="#9B59B6" />
        </mesh>
        {/* Target icon - Simple colored sphere */}
        <mesh position={[0, 0.5, 0]}>
          <sphereGeometry args={[0.2, 8, 8]} />
          <meshBasicMaterial color="#FF5722" />
        </mesh>
      </group>

      <group position={[-3, 1, 3]}>
        <mesh>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshLambertMaterial color="#9B59B6" />
        </mesh>
        {/* Search icon - Simple colored sphere */}
        <mesh position={[0, 0.5, 0]}>
          <sphereGeometry args={[0.2, 8, 8]} />
          <meshBasicMaterial color="#2196F3" />
        </mesh>
      </group>

      <group position={[3, 1, 3]}>
        <mesh>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshLambertMaterial color="#9B59B6" />
        </mesh>
        {/* Lightbulb icon - Simple colored sphere */}
        <mesh position={[0, 0.5, 0]}>
          <sphereGeometry args={[0.2, 8, 8]} />
          <meshBasicMaterial color="#FFD700" />
        </mesh>
      </group>

      {/* Room Label - Simple colored cube */}
      {/* Puzzle Title - Large visible sign */}
      <mesh position={[0, 3, 0]}>
        <boxGeometry args={[4, 0.5, 0.2]} />
        <meshBasicMaterial color="#9B59B6" />
      </mesh>

      {/* Puzzle Title Text */}
      <Text
        position={[0, 3, 0.15]}
        fontSize={0.8}
        color="#FFFFFF"
        anchorX="center"
        anchorY="middle"
      >
        PUZZLE ROOM
      </Text>

      {/* Puzzle Indicator - Large purple diamond */}
      <mesh position={[0, 4, 0]}>
        <octahedronGeometry args={[1.5]} />
        <meshBasicMaterial color="#9B59B6" />
      </mesh>

      {/* Completion Status */}
      <mesh position={[0, 2.5, 0]}>
        <boxGeometry args={[1.5, 0.2, 0.1]} />
        <meshBasicMaterial color={isCompleted ? "#4CAF50" : "#F44336"} />
      </mesh>
      <Text
        position={[0, 2.5, 0.15]}
        fontSize={0.4}
        color="#FFFFFF"
        anchorX="center"
        anchorY="middle"
      >
        {isCompleted ? "COMPLETED" : "IN PROGRESS"}
      </Text>

      {/* Reward Display */}
      {showReward && reward && (
        <group position={[0, 1.5, 0]}>
          <mesh>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="#FFD700" transparent opacity={0.8} />
          </mesh>
          {/* Reward icon - Simple colored sphere */}
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[0.3, 8, 8]} />
            <meshBasicMaterial color="#FFD700" />
          </mesh>
          {/* Claim text - Simple colored cube */}
          <mesh position={[0, -1, 0]}>
            <boxGeometry args={[1.5, 0.2, 0.1]} />
            <meshBasicMaterial color="#FFD700" />
          </mesh>
        </group>
      )}

      {/* Instructions - Simple colored cube */}
      {!isCompleted && (
        <mesh position={[0, -2, 0]}>
          <boxGeometry args={[2, 0.2, 0.1]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
      )}
    </group>
  );
};

export default PuzzleRoom;
