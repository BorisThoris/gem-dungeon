import React, { useState, useEffect } from "react";
import { RigidBody } from "@react-three/rapier";
import { Text } from "@react-three/drei";
import type { Item } from "../types/map";
import ItemSprite from "./ItemSprite";

interface SecretRoomProps {
  isDiscovered: boolean;
  onDiscover: () => void;
  secretItems: Item[];
  onItemPickup: (item: Item) => void;
  playerPosition: [number, number, number];
  roomPosition: [number, number, number];
}

const SecretRoom: React.FC<SecretRoomProps> = ({
  isDiscovered,
  onDiscover,
  secretItems,
  onItemPickup,
  playerPosition,
  roomPosition,
}) => {
  const [isRevealing, setIsRevealing] = useState(false);
  const [particles, setParticles] = useState<
    Array<{ id: number; position: [number, number, number] }>
  >([]);

  // Check if player is close enough to discover the secret
  useEffect(() => {
    const distance = Math.sqrt(
      Math.pow(playerPosition[0] - roomPosition[0], 2) +
        Math.pow(playerPosition[2] - roomPosition[2], 2)
    );

    if (distance < 3 && !isDiscovered) {
      setIsRevealing(true);
      setTimeout(() => {
        onDiscover();
        setIsRevealing(false);
      }, 1000);
    }
  }, [playerPosition, roomPosition, isDiscovered, onDiscover]);

  // Generate discovery particles
  useEffect(() => {
    if (isRevealing) {
      const newParticles = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        position: [
          (Math.random() - 0.5) * 4,
          Math.random() * 3,
          (Math.random() - 0.5) * 4,
        ] as [number, number, number],
      }));
      setParticles(newParticles);
    }
  }, [isRevealing]);

  if (!isDiscovered && !isRevealing) {
    return null; // Hidden until discovered
  }

  return (
    <group position={roomPosition}>
      {/* Secret Room Floor */}
      <RigidBody type="fixed" colliders="trimesh">
        <mesh position={[0, -0.5, 0]} receiveShadow>
          <boxGeometry args={[8, 0.2, 8]} />
          <meshLambertMaterial
            color="#2F4F4F"
            transparent
            opacity={isRevealing ? 0.5 : 1}
          />
        </mesh>
      </RigidBody>

      {/* Discovery Particles */}
      {isRevealing && (
        <group>
          {particles.map((particle) => (
            <mesh key={particle.id} position={particle.position}>
              <sphereGeometry args={[0.1, 4, 4]} />
              <meshBasicMaterial color="#00FFFF" transparent opacity={0.8} />
            </mesh>
          ))}
        </group>
      )}

      {/* Secret Room Title */}
      <Text
        position={[0, 3, 0]}
        fontSize={1}
        color="#00FFFF"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        SECRET ROOM
      </Text>

      {/* Secret Items */}
      {isDiscovered &&
        secretItems.map((item, index) => (
          <ItemSprite
            key={item.id}
            item={item}
            position={
              [((index % 3) - 1) * 2, 1, Math.floor(index / 3) * 2 - 1] as [
                number,
                number,
                number
              ]
            }
            scale={0.8}
            onClick={() => onItemPickup(item)}
          />
        ))}

      {/* Discovery Effect */}
      {isRevealing && (
        <group>
          {/* Expanding Ring */}
          <mesh position={[0, 0.1, 0]}>
            <torusGeometry args={[2, 0.1, 8, 16]} />
            <meshBasicMaterial color="#00FFFF" transparent opacity={0.6} />
          </mesh>

          {/* Central Glow */}
          <mesh position={[0, 1, 0]}>
            <sphereGeometry args={[0.5, 8, 8]} />
            <meshBasicMaterial color="#00FFFF" transparent opacity={0.8} />
          </mesh>
        </group>
      )}

      {/* Secret Room Indicator */}
      {isDiscovered && (
        <mesh position={[0, 4, 0]}>
          <octahedronGeometry args={[1]} />
          <meshStandardMaterial
            color="#00FFFF"
            emissive="#00FFFF"
            emissiveIntensity={0.3}
          />
        </mesh>
      )}

      {/* Atmospheric Lighting */}
      <pointLight
        position={[0, 2, 0]}
        color="#00FFFF"
        intensity={0.5}
        distance={10}
      />
    </group>
  );
};

export default SecretRoom;
