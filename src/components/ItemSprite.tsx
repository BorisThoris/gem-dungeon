import React, { useRef, useState } from "react";
import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Item } from "../types/map";
import { Group } from "three";

interface ItemSpriteProps {
  item: Item;
  position: [number, number, number];
  scale?: number;
  onClick?: () => void;
  isHovered?: boolean;
}

const ItemSprite: React.FC<ItemSpriteProps> = ({
  item,
  position,
  scale = 1,
  onClick,
  isHovered = false,
}) => {
  const ref = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(() => {
    if (ref.current) {
      ref.current.rotation.y += 0.01;
      ref.current.position.y = position[1] + Math.sin(Date.now() * 0.002) * 0.1;
    }
  });

  const getRarityColor = (rarity: Item["rarity"]): string => {
    switch (rarity) {
      case "common":
        return "#ffffff";
      case "uncommon":
        return "#00ff00";
      case "rare":
        return "#0080ff";
      case "epic":
        return "#8000ff";
      case "legendary":
        return "#ff8000";
      default:
        return "#ffffff";
    }
  };

  const getRarityGlow = (rarity: Item["rarity"]): number => {
    switch (rarity) {
      case "common":
        return 0;
      case "uncommon":
        return 0.2;
      case "rare":
        return 0.4;
      case "epic":
        return 0.6;
      case "legendary":
        return 0.8;
      default:
        return 0;
    }
  };

  const rarityColor = getRarityColor(item.rarity);
  const glowIntensity = getRarityGlow(item.rarity);
  const finalScale = isHovered ? scale * 1.2 : scale;

  return (
    <group
      ref={ref}
      position={position}
      scale={finalScale}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onClick={onClick}
    >
      {/* Item Icon - Dynamic shape based on type */}
      <mesh position={[0, 0, 0]}>
        {item.type === "consumable" ? (
          <boxGeometry args={[1, 1, 1]} />
        ) : item.type === "passive" ? (
          <octahedronGeometry args={[1]} />
        ) : item.type === "active" ? (
          <coneGeometry args={[1, 1.5, 8]} />
        ) : (
          <sphereGeometry args={[1, 12, 12]} />
        )}
        <meshBasicMaterial color={rarityColor} />
      </mesh>

      {/* Rarity Glow Effect - Pulsing ring */}
      {glowIntensity > 0 && (
        <mesh position={[0, 0, 0]}>
          <torusGeometry args={[1.2, 0.1, 8, 16]} />
          <meshBasicMaterial
            color={rarityColor}
            transparent
            opacity={0.3 + Math.sin(Date.now() * 0.005) * 0.3}
          />
        </mesh>
      )}

      {/* Item Name Text */}
      {(isHovered || hovered) && (
        <Text
          position={[0, 1.5, 0]}
          fontSize={0.3}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {item.name}
        </Text>
      )}

      {/* Cost Display for Shop Items */}
      {item.cost > 0 && (
        <Text
          position={[0, -1.2, 0]}
          fontSize={0.2}
          color="#FFD700"
          anchorX="center"
          anchorY="middle"
        >
          {item.cost}
        </Text>
      )}

      {/* Rarity Indicator - Glowing orb */}
      <mesh position={[0, 1.2, 0]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial
          color={rarityColor}
          emissive={rarityColor}
          emissiveIntensity={0.3}
        />
      </mesh>
    </group>
  );
};

export default ItemSprite;
