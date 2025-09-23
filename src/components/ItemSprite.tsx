import React from "react";
import { Text } from "@react-three/drei";
import type { Item } from "../types/map";

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
    <group position={position} scale={finalScale} onClick={onClick}>
      {/* Item Icon */}
      <Text
        position={[0, 0, 0]}
        fontSize={2}
        color={rarityColor}
        anchorX="center"
        anchorY="middle"
        font="/fonts/NotoColorEmoji.ttf"
      >
        {item.icon}
      </Text>

      {/* Rarity Glow Effect */}
      {glowIntensity > 0 && (
        <Text
          position={[0, 0, -0.1]}
          fontSize={2.2}
          color={rarityColor}
          anchorX="center"
          anchorY="middle"
          font="/fonts/NotoColorEmoji.ttf"
        >
          {item.icon}
        </Text>
      )}

      {/* Item Name (hover tooltip) */}
      {isHovered && (
        <Text
          position={[0, -1.5, 0]}
          fontSize={0.5}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
        >
          {item.name}
        </Text>
      )}

      {/* Rarity Indicator */}
      <mesh position={[0, 1.2, 0]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshBasicMaterial color={rarityColor} />
      </mesh>
    </group>
  );
};

export default ItemSprite;
