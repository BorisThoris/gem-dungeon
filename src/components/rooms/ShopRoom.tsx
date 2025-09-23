import React, { useState } from "react";
import { RigidBody } from "@react-three/rapier";
import { Text } from "@react-three/drei";
import type { Item } from "../../types/map";
import ItemSprite from "../ItemSprite";

interface ShopRoomProps {
  items: Item[];
  onItemPurchase: (item: Item) => void;
  playerPoints: number;
}

const ShopRoom: React.FC<ShopRoomProps> = ({
  items,
  onItemPurchase,
  playerPoints,
}) => {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  // Create simple table model instead of loading VOX
  const [purchasedItems, setPurchasedItems] = useState<string[]>([]);

  const handleItemPurchase = (item: Item) => {
    if (playerPoints >= item.cost && !purchasedItems.includes(item.id)) {
      onItemPurchase(item);
      setPurchasedItems((prev) => [...prev, item.id]);
    }
  };

  return (
    <group>
      {/* Shop Counter - Simple 3D model */}
      <RigidBody type="fixed" colliders="trimesh">
        <group position={[0, 0, 0]}>
          {/* Counter Top */}
          <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
            <boxGeometry args={[4, 0.1, 2]} />
            <meshLambertMaterial color="#8B4513" />
          </mesh>
          {/* Counter Base */}
          <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
            <boxGeometry args={[3.8, 0.5, 1.8]} />
            <meshLambertMaterial color="#654321" />
          </mesh>
        </group>
      </RigidBody>

      {/* Shopkeeper NPC */}
      <group position={[0, 1, 0]}>
        {/* NPC Body */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.8, 1.6, 0.4]} />
          <meshLambertMaterial color="#4A4A4A" />
        </mesh>

        {/* NPC Head */}
        <mesh position={[0, 1, 0]}>
          <sphereGeometry args={[0.4, 8, 8]} />
          <meshLambertMaterial color="#FDBCB4" />
        </mesh>

        {/* NPC Hat */}
        <mesh position={[0, 1.3, 0]}>
          <boxGeometry args={[0.6, 0.2, 0.6]} />
          <meshLambertMaterial color="#8B4513" />
        </mesh>

        {/* NPC Eyes */}
        <mesh position={[-0.1, 1.1, 0.3]}>
          <sphereGeometry args={[0.05, 4, 4]} />
          <meshBasicMaterial color="#000000" />
        </mesh>
        <mesh position={[0.1, 1.1, 0.3]}>
          <sphereGeometry args={[0.05, 4, 4]} />
          <meshBasicMaterial color="#000000" />
        </mesh>
      </group>

      {/* Shop Items Display */}
      {items.map((item, index) => {
        const canAfford = playerPoints >= item.cost;
        const isHovered = hoveredItem === item.id;
        const isPurchased = purchasedItems.includes(item.id);

        return (
          <group key={item.id}>
            <ItemSprite
              item={item}
              position={
                [
                  ((index % 4) - 1.5) * 1.2,
                  1.5,
                  Math.floor(index / 4) * 1.5 - 0.5,
                ] as [number, number, number]
              }
              scale={isPurchased ? 0.3 : 0.6}
              onClick={() => !isPurchased && handleItemPurchase(item)}
              isHovered={isHovered}
            />

            {/* Price Tag */}
            <mesh
              position={[
                ((index % 4) - 1.5) * 1.2,
                0.8,
                Math.floor(index / 4) * 1.5 - 0.5,
              ]}
            >
              <boxGeometry args={[0.8, 0.2, 0.1]} />
              <meshBasicMaterial
                color={
                  isPurchased ? "#888888" : canAfford ? "#00FF00" : "#FF0000"
                }
              />
            </mesh>

            {/* Price Text */}
            <Text
              position={[
                ((index % 4) - 1.5) * 1.2,
                0.8,
                Math.floor(index / 4) * 1.5 - 0.5,
              ]}
              fontSize={0.15}
              color="#000000"
              anchorX="center"
              anchorY="middle"
            >
              {isPurchased ? "SOLD" : item.cost.toString()}
            </Text>

            {/* Item Platform */}
            <mesh
              position={[
                ((index % 4) - 1.5) * 1.2,
                0.4,
                Math.floor(index / 4) * 1.5 - 0.5,
              ]}
              onPointerOver={() => setHoveredItem(item.id)}
              onPointerOut={() => setHoveredItem(null)}
            >
              <boxGeometry args={[0.8, 0.1, 0.8]} />
              <meshLambertMaterial
                color={
                  isPurchased ? "#666666" : canAfford ? "#4CAF50" : "#F44336"
                }
                transparent
                opacity={hoveredItem === item.id ? 0.8 : 0.5}
              />
            </mesh>

            {/* Sold Out Overlay */}
            {isPurchased && (
              <mesh
                position={[
                  ((index % 4) - 1.5) * 1.2,
                  1.5,
                  Math.floor(index / 4) * 1.5 - 0.5,
                ]}
              >
                <boxGeometry args={[1.2, 1.2, 0.1]} />
                <meshBasicMaterial color="#000000" transparent opacity={0.5} />
              </mesh>
            )}
          </group>
        );
      })}

      {/* Shop Sign - Large visible sign */}
      <mesh position={[0, 3, 0]}>
        <boxGeometry args={[4, 0.5, 0.2]} />
        <meshBasicMaterial color="#FFD700" />
      </mesh>

      {/* Shop Title Text */}
      <Text
        position={[0, 3, 0.15]}
        fontSize={0.8}
        color="#000000"
        anchorX="center"
        anchorY="middle"
      >
        SHOP
      </Text>

      {/* Shop Indicator - Large green cube */}
      <mesh position={[0, 4, 0]}>
        <boxGeometry args={[2, 2, 2]} />
        <meshBasicMaterial color="#4CAF50" />
      </mesh>

      {/* Player Points Display - Simple colored cube */}
      <mesh position={[0, -2, 0]}>
        <boxGeometry args={[2, 0.2, 0.1]} />
        <meshBasicMaterial color="#FFFFFF" />
      </mesh>

      {/* Shopkeeper Speech - Simple colored cube */}
      <mesh position={[0, 2.2, 0]}>
        <boxGeometry args={[2, 0.2, 0.1]} />
        <meshBasicMaterial color="#FFFFFF" />
      </mesh>
    </group>
  );
};

export default ShopRoom;
