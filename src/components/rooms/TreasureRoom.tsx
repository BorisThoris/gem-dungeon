import React, { useState, useRef } from "react";
import { RigidBody } from "@react-three/rapier";
import { Text } from "@react-three/drei";
import type { Item } from "../../types/map";
import ItemSprite from "../ItemSprite";
import { Group } from "three";

interface TreasureRoomProps {
  items: Item[];
  onItemPickup: (item: Item) => void;
  isOpened: boolean;
  onOpen: () => void;
}

const TreasureRoom: React.FC<TreasureRoomProps> = ({
  items,
  onItemPickup,
  isOpened,
  onOpen,
}) => {
  const [hovered, setHovered] = useState(false);

  // Create simple chest model instead of loading VOX
  const chestRef = useRef<Group>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleChestOpen = () => {
    if (!isOpened && !isAnimating) {
      setIsAnimating(true);
      onOpen();

      // Add opening animation effect
      setTimeout(() => {
        setIsAnimating(false);
        // Spawn treasure items with animation
        items.forEach((_item, index) => {
          setTimeout(() => {
            // Item spawn effect could go here
          }, index * 200);
        });
      }, 1000);
    }
  };

  return (
    <group>
      {/* Treasure Chest - Simple 3D model */}
      <RigidBody type="fixed" colliders="trimesh">
        <group
          ref={chestRef}
          position={[0, 0, 0]}
          onClick={handleChestOpen}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        >
          {/* Chest Base */}
          <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
            <boxGeometry args={[2, 0.6, 1.2]} />
            <meshLambertMaterial color="#8B4513" />
          </mesh>
          {/* Chest Lid */}
          <mesh
            position={[0, 0.6, 0]}
            rotation={[isOpened ? -Math.PI / 3 : 0, 0, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[2.1, 0.2, 1.3]} />
            <meshLambertMaterial color="#DAA520" />
          </mesh>
          {/* Chest Lock */}
          {!isOpened && (
            <mesh position={[0, 0.4, 0.6]}>
              <boxGeometry args={[0.3, 0.3, 0.2]} />
              <meshLambertMaterial color="#FFD700" />
            </mesh>
          )}
        </group>
      </RigidBody>

      {/* Treasure Glow Effect */}
      {isOpened && (
        <mesh position={[0, 1, 0]}>
          <sphereGeometry args={[0.5, 8, 8]} />
          <meshBasicMaterial color="#FFD700" transparent opacity={0.3} />
        </mesh>
      )}

      {/* Treasure Items */}
      {isOpened &&
        items.map((item, index) => (
          <ItemSprite
            key={item.id}
            item={item}
            position={
              [
                ((index % 3) - 1) * 1.5,
                1.5,
                Math.floor(index / 3) * 1.5 - 0.5,
              ] as [number, number, number]
            }
            scale={0.8}
            onClick={() => onItemPickup(item)}
            isHovered={hovered}
          />
        ))}

      {/* Room Label - Large visible sign */}
      <mesh position={[0, 3, 0]}>
        <boxGeometry args={[4, 0.5, 0.2]} />
        <meshBasicMaterial color="#FFD700" />
      </mesh>

      {/* Room Title Text */}
      <Text
        position={[0, 3, 0.15]}
        fontSize={0.8}
        color="#000000"
        anchorX="center"
        anchorY="middle"
      >
        TREASURE ROOM
      </Text>

      {/* Treasure Indicator - Large golden pyramid */}
      <mesh position={[0, 4, 0]}>
        <coneGeometry args={[1.5, 2, 8]} />
        <meshBasicMaterial color="#FFD700" />
      </mesh>

      {/* Interaction Hint - Simple colored cube */}
      {!isOpened && (
        <mesh position={[0, -1.5, 0]}>
          <boxGeometry args={[1, 0.2, 0.1]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
      )}
    </group>
  );
};

export default TreasureRoom;
