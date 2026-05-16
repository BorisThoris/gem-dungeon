import React, { useState, useEffect, useCallback } from "react";
import { RigidBody } from "@react-three/rapier";
import { Text } from "@react-three/drei";
import useGameStore from "../store/gameStore";

interface DestructibleWallProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  health?: number;
  bombRequired?: boolean;
  onDestroy?: () => void;
  onDamage?: (damage: number) => void;
}

const DestructibleWall: React.FC<DestructibleWallProps> = ({
  position,
  rotation = [0, 0, 0],
  health = 3,
  bombRequired = false,
  onDestroy,
}) => {
  const { playerStats, inventory, consumeItem } = useGameStore();
  const [currentHealth, setCurrentHealth] = useState(health);
  const [isDestroyed, setIsDestroyed] = useState(false);
  const [isNearby, setIsNearby] = useState(false);
  const [canDestroy, setCanDestroy] = useState(false);
  const [isDamaged] = useState(false);

  // Check if player can destroy the wall
  useEffect(() => {
    if (bombRequired) {
      const hasBomb =
        playerStats.bombs > 0 ||
        inventory?.some((item) => item.id === "bomb");
      setCanDestroy(hasBomb && !isDestroyed);
    } else {
      setCanDestroy(!isDestroyed);
    }
  }, [playerStats.bombs, inventory, bombRequired, isDestroyed]);

  const handleDestroyWall = useCallback(() => {
    if (bombRequired) {
      // Use a bomb
      if (playerStats.bombs > 0) {
        consumeItem("bomb");
      } else {
        // Use bomb item
        const bombItem = inventory?.find((item) => item.id === "bomb");
        if (bombItem) {
          consumeItem(bombItem.id);
        }
      }
    }

    // Destroy the wall
    setCurrentHealth(0);
    setIsDestroyed(true);
    onDestroy?.();
  }, [bombRequired, playerStats.bombs, consumeItem, inventory, onDestroy]);

  // Listen for B key press to use bomb
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === "b" || event.key === "B") {
        if (isNearby && canDestroy && !isDestroyed) {
          handleDestroyWall();
        }
      }
    };

    if (isNearby) {
      document.addEventListener("keydown", handleKeyPress);
      return () => document.removeEventListener("keydown", handleKeyPress);
    }
  }, [isNearby, canDestroy, isDestroyed, handleDestroyWall]);

  // Damage handling would be implemented here

  // Check if player is nearby (simplified for demo)
  const checkPlayerNearby = () => {
    setIsNearby(true); // Simplified for demo
  };

  useEffect(() => {
    checkPlayerNearby();
  }, []);

  if (isDestroyed) {
    return (
      <group position={position} rotation={rotation}>
        {/* Destroyed wall debris */}
        {Array.from({ length: 5 }).map((_, i) => (
          <mesh
            key={i}
            position={[
              (Math.random() - 0.5) * 2,
              Math.random() * 0.5,
              (Math.random() - 0.5) * 2,
            ]}
            rotation={[
              Math.random() * Math.PI,
              Math.random() * Math.PI,
              Math.random() * Math.PI,
            ]}
          >
            <boxGeometry args={[0.3, 0.3, 0.3]} />
            <meshLambertMaterial color="#666666" />
          </mesh>
        ))}
      </group>
    );
  }

  return (
    <group position={position} rotation={rotation}>
      {/* Wall */}
      <RigidBody type="fixed" colliders="trimesh">
        <mesh>
          <boxGeometry args={[2, 3, 0.5]} />
          <meshLambertMaterial
            color={
              isDamaged
                ? "#FF0000"
                : currentHealth === health
                ? "#8B4513"
                : "#A0522D"
            }
          />
        </mesh>

        {/* Cracks for damaged walls */}
        {currentHealth < health && (
          <>
            <mesh position={[0, 0, 0.26]}>
              <boxGeometry args={[1.8, 0.1, 0.02]} />
              <meshLambertMaterial color="#000000" />
            </mesh>
            <mesh position={[0, 0, 0.26]}>
              <boxGeometry args={[0.1, 2.8, 0.02]} />
              <meshLambertMaterial color="#000000" />
            </mesh>
          </>
        )}

        {/* Bomb indicator */}
        {bombRequired && (
          <mesh position={[0, 0, 0.26]}>
            <boxGeometry args={[0.3, 0.3, 0.05]} />
            <meshLambertMaterial color="#FF0000" />
          </mesh>
        )}
      </RigidBody>

      {/* Interaction Prompt */}
      {isNearby && !isDestroyed && (
        <group position={[0, 2, 0]}>
          <Text
            position={[0, 0, 0]}
            fontSize={0.5}
            color={canDestroy ? "#00FF00" : "#FF0000"}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#000000"
          >
            {bombRequired
              ? canDestroy
                ? "Press B to bomb"
                : "Bomb required"
              : "Press B to destroy"}
          </Text>

          {/* Health Bar */}
          <group position={[0, -0.5, 0]}>
            {/* Health Bar Background */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[1.5, 0.1, 0.1]} />
              <meshBasicMaterial color="#FF0000" />
            </mesh>
            {/* Health Bar Fill */}
            <mesh position={[0, 0, 0.05]}>
              <boxGeometry
                args={[(currentHealth / health) * 1.5, 0.08, 0.05]}
              />
              <meshBasicMaterial color="#00FF00" />
            </mesh>
          </group>

          {/* Bomb Icon */}
          {bombRequired && (
            <Text
              position={[0, -1, 0]}
              fontSize={0.3}
              color="#FF0000"
              anchorX="center"
              anchorY="middle"
            >
              💣
            </Text>
          )}
        </group>
      )}

      {/* Destruction Effect */}
      {isDestroyed && (
        <group position={[0, 1.5, 0]}>
          {/* Explosion particles */}
          {Array.from({ length: 20 }).map((_, i) => (
            <mesh
              key={i}
              position={[
                (Math.random() - 0.5) * 4,
                Math.random() * 2,
                (Math.random() - 0.5) * 4,
              ]}
            >
              <sphereGeometry args={[0.1, 4, 4]} />
              <meshBasicMaterial color="#FF4500" transparent opacity={0.8} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
};

export default DestructibleWall;
