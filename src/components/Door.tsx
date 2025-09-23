import React, { useState, useEffect, useCallback } from "react";
import { RigidBody } from "@react-three/rapier";
import { Text } from "@react-three/drei";
import useGameStore from "../store/gameStore";

interface DoorProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  keyRequired?: boolean;
  keyId?: string;
  isLocked?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
}

const Door: React.FC<DoorProps> = ({
  position,
  rotation = [0, 0, 0],
  keyRequired = false,
  keyId,
  isLocked = false,
  onOpen,
  onClose: _onClose,
}) => {
  const { playerStats, inventory, useItem } = useGameStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isNearby, setIsNearby] = useState(false);
  const [canOpen, setCanOpen] = useState(false);

  // Check if player can open the door
  useEffect(() => {
    if (keyRequired && keyId) {
      const hasKey =
        playerStats.keys > 0 ||
        inventory?.some((item: any) => item.id === keyId);
      setCanOpen(hasKey && !isLocked);
    } else {
      setCanOpen(!isLocked);
    }
  }, [playerStats.keys, inventory, keyRequired, keyId, isLocked]);

  // Listen for E key press to open door
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === "e" || event.key === "E") {
        if (isNearby && canOpen && !isOpen) {
          handleOpenDoor();
        }
      }
    };

    if (isNearby) {
      document.addEventListener("keydown", handleKeyPress);
      return () => document.removeEventListener("keydown", handleKeyPress);
    }
  }, [isNearby, canOpen, isOpen]);

  const handleOpenDoor = useCallback(() => {
    if (keyRequired && keyId) {
      // Use a key
      if (playerStats.keys > 0) {
        useItem("key");
      } else {
        // Use specific key item
        const keyItem = inventory?.find((item: any) => item.id === keyId);
        if (keyItem) {
          useItem(keyItem.id);
        }
      }
    }

    setIsOpen(true);
    onOpen?.();
  }, [keyRequired, keyId, playerStats.keys, useItem, inventory, onOpen]);

  // Door closing would be implemented here

  // Check if player is nearby (simplified for demo)
  const checkPlayerNearby = () => {
    // This would normally check actual player position
    // For now, we'll use a simple distance check
    setIsNearby(true); // Simplified for demo
  };

  useEffect(() => {
    checkPlayerNearby();
  }, []);

  return (
    <group position={position} rotation={rotation}>
      {/* Door Frame */}
      <RigidBody type="fixed" colliders="trimesh">
        <mesh position={[0, 1.5, 0]}>
          <boxGeometry args={[0.2, 3, 0.2]} />
          <meshLambertMaterial color="#8B4513" />
        </mesh>
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[0.2, 0.2, 0.2]} />
          <meshLambertMaterial color="#8B4513" />
        </mesh>
      </RigidBody>

      {/* Door Panel */}
      <RigidBody
        type={isOpen ? "dynamic" : "fixed"}
        colliders={isOpen ? "hull" : "trimesh"}
        position={isOpen ? [1, 0, 0] : [0, 0, 0]}
        rotation={isOpen ? [0, -Math.PI / 2, 0] : [0, 0, 0]}
      >
        <mesh>
          <boxGeometry args={[2, 3, 0.1]} />
          <meshLambertMaterial
            color={isLocked ? "#666666" : canOpen ? "#8B4513" : "#4B0000"}
          />
        </mesh>

        {/* Door Handle */}
        <mesh position={[0.8, 0, 0.1]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshLambertMaterial color="#FFD700" />
        </mesh>

        {/* Lock Indicator */}
        {isLocked && (
          <mesh position={[0, 0, 0.1]}>
            <boxGeometry args={[0.3, 0.3, 0.05]} />
            <meshLambertMaterial color="#FF0000" />
          </mesh>
        )}

        {/* Keyhole */}
        {keyRequired && (
          <mesh position={[0, 0, 0.1]}>
            <cylinderGeometry args={[0.05, 0.05, 0.1, 8]} />
            <meshLambertMaterial color="#000000" />
          </mesh>
        )}
      </RigidBody>

      {/* Interaction Prompt */}
      {isNearby && !isOpen && (
        <group position={[0, 2, 0]}>
          <Text
            position={[0, 0, 0]}
            fontSize={0.5}
            color={canOpen ? "#00FF00" : "#FF0000"}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#000000"
          >
            {isLocked
              ? "DOOR LOCKED"
              : keyRequired
              ? canOpen
                ? "Press E to unlock"
                : "Key required"
              : "Press E to open"}
          </Text>

          {/* Key Icon */}
          {keyRequired && (
            <Text
              position={[0, -0.5, 0]}
              fontSize={0.3}
              color="#FFD700"
              anchorX="center"
              anchorY="middle"
            >
              🗝️
            </Text>
          )}
        </group>
      )}

      {/* Open Door Indicator */}
      {isOpen && (
        <group position={[0, 2, 0]}>
          <Text
            position={[0, 0, 0]}
            fontSize={0.5}
            color="#00FF00"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#000000"
          >
            DOOR OPEN
          </Text>
        </group>
      )}
    </group>
  );
};

export default Door;
