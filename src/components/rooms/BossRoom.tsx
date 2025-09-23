import React, { useState, useRef } from "react";
import { RigidBody } from "@react-three/rapier";
import { Text } from "@react-three/drei";
import { Group, Vector3 } from "three";
import { useFrame } from "@react-three/fiber";
import type { Item } from "../../types/map";
import ItemSprite from "../ItemSprite";

interface BossRoomProps {
  bossType: "dragon" | "lich" | "demon" | "giant";
  onBossDefeat: () => void;
  onPlayerDamage: (damage: number) => void;
  playerPosition: [number, number, number];
  rewardItems: Item[];
  onItemPickup: (item: Item) => void;
}

const BossRoom: React.FC<BossRoomProps> = ({
  bossType,
  onBossDefeat,
  onPlayerDamage,
  playerPosition,
  rewardItems,
  onItemPickup,
}) => {
  const [bossHealth, setBossHealth] = useState(100);
  const [isAlive, setIsAlive] = useState(true);
  const [isAttacking, setIsAttacking] = useState(false);
  const [attackPhase, setAttackPhase] = useState(1);
  const [lastAttack, setLastAttack] = useState(0);
  const [isDefeated, setIsDefeated] = useState(false);
  const bossRef = useRef<Group>(null);

  const getBossColor = (type: string): string => {
    switch (type) {
      case "dragon":
        return "#8B0000";
      case "lich":
        return "#4B0082";
      case "demon":
        return "#DC143C";
      case "giant":
        return "#696969";
      default:
        return "#FF0000";
    }
  };

  const getBossIcon = (type: string): string => {
    switch (type) {
      case "dragon":
        return "🐉";
      case "lich":
        return "💀";
      case "demon":
        return "👹";
      case "giant":
        return "🗿";
      default:
        return "👹";
    }
  };

  const getBossSize = (type: string): number => {
    switch (type) {
      case "dragon":
        return 2.5;
      case "lich":
        return 1.8;
      case "demon":
        return 2.0;
      case "giant":
        return 3.0;
      default:
        return 2.0;
    }
  };

  // Boss AI and Attack Patterns
  useFrame(() => {
    if (!bossRef.current || !isAlive) return;

    const bossPos = bossRef.current.position;
    const playerPos = new Vector3(...playerPosition);
    const distance = bossPos.distanceTo(playerPos);

    // Phase-based attack patterns
    const currentTime = Date.now();
    if (currentTime - lastAttack > 2000) {
      // 2 second cooldown
      setIsAttacking(true);
      setLastAttack(currentTime);

      // Different attacks based on phase
      if (attackPhase === 1) {
        // Basic attack
        if (distance < 5) {
          onPlayerDamage(10);
        }
      } else if (attackPhase === 2) {
        // Ranged attack
        onPlayerDamage(15);
      } else if (attackPhase === 3) {
        // Area attack
        onPlayerDamage(20);
      }

      setTimeout(() => setIsAttacking(false), 1000);
    }

    // Phase transitions
    if (bossHealth <= 66 && attackPhase === 1) {
      setAttackPhase(2);
    } else if (bossHealth <= 33 && attackPhase === 2) {
      setAttackPhase(3);
    }
  });

  const handleBossClick = () => {
    if (!isAlive) return;

    setBossHealth((prev) => {
      const newHealth = prev - 5;
      if (newHealth <= 0) {
        setIsAlive(false);
        setIsDefeated(true);
        onBossDefeat();
      }
      return newHealth;
    });
  };

  return (
    <group>
      {/* Boss Room Floor */}
      <RigidBody type="fixed" colliders="trimesh">
        <mesh position={[0, -0.5, 0]} receiveShadow>
          <boxGeometry args={[10, 0.2, 10]} />
          <meshLambertMaterial color="#2F2F2F" />
        </mesh>
      </RigidBody>

      {/* Boss Entity */}
      {isAlive && (
        <group ref={bossRef} position={[0, 1, 0]}>
          <RigidBody type="dynamic" colliders="trimesh">
            <mesh
              onClick={handleBossClick}
              onPointerOver={() => {
                document.body.style.cursor = "pointer";
              }}
              onPointerOut={() => {
                document.body.style.cursor = "auto";
              }}
            >
              <boxGeometry
                args={[
                  getBossSize(bossType),
                  getBossSize(bossType),
                  getBossSize(bossType),
                ]}
              />
              <meshLambertMaterial
                color={getBossColor(bossType)}
                emissive={isAttacking ? "#FF0000" : "#000000"}
                emissiveIntensity={isAttacking ? 0.5 : 0}
              />
            </mesh>
          </RigidBody>

          {/* Boss Icon */}
          <Text
            position={[0, getBossSize(bossType) + 1, 0]}
            fontSize={1.5}
            color="#FFFFFF"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#000000"
          >
            {getBossIcon(bossType)}
          </Text>

          {/* Boss Health Bar */}
          <group position={[0, getBossSize(bossType) + 2, 0]}>
            {/* Health Bar Background */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[4, 0.2, 0.1]} />
              <meshBasicMaterial color="#FF0000" />
            </mesh>
            {/* Health Bar Fill */}
            <mesh position={[0, 0, 0.05]}>
              <boxGeometry args={[(bossHealth / 100) * 4, 0.15, 0.05]} />
              <meshBasicMaterial color="#00FF00" />
            </mesh>
          </group>

          {/* Attack Indicator */}
          {isAttacking && (
            <group>
              <mesh position={[0, getBossSize(bossType) + 0.5, 0]}>
                <sphereGeometry args={[0.5, 8, 8]} />
                <meshBasicMaterial color="#FF0000" transparent opacity={0.7} />
              </mesh>

              {/* Attack Phase Indicator */}
              <Text
                position={[0, getBossSize(bossType) + 1.5, 0]}
                fontSize={0.5}
                color="#FF0000"
                anchorX="center"
                anchorY="middle"
              >
                PHASE {attackPhase}
              </Text>
            </group>
          )}
        </group>
      )}

      {/* Boss Defeat Effects */}
      {isDefeated && (
        <group>
          {/* Victory Particles */}
          {Array.from({ length: 30 }).map((_, i) => (
            <mesh
              key={i}
              position={[
                (Math.random() - 0.5) * 6,
                Math.random() * 4,
                (Math.random() - 0.5) * 6,
              ]}
            >
              <sphereGeometry args={[0.2, 4, 4]} />
              <meshBasicMaterial color="#FFD700" transparent opacity={0.8} />
            </mesh>
          ))}

          {/* Victory Message */}
          <Text
            position={[0, 4, 0]}
            fontSize={1.2}
            color="#FFD700"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#000000"
          >
            BOSS DEFEATED!
          </Text>

          {/* Reward Items */}
          {rewardItems.map((item, index) => (
            <ItemSprite
              key={item.id}
              item={item}
              position={
                [((index % 4) - 1.5) * 2, 1, Math.floor(index / 4) * 2 - 1] as [
                  number,
                  number,
                  number
                ]
              }
              scale={1.2}
              onClick={() => onItemPickup(item)}
            />
          ))}
        </group>
      )}

      {/* Boss Room Title */}
      <Text
        position={[0, 5, 0]}
        fontSize={1}
        color="#FF0000"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        BOSS ROOM
      </Text>

      {/* Atmospheric Lighting */}
      <pointLight
        position={[0, 3, 0]}
        color={getBossColor(bossType)}
        intensity={1}
        distance={15}
      />

      {/* Phase-specific Effects */}
      {attackPhase >= 2 && (
        <pointLight
          position={[3, 2, 3]}
          color="#FF4500"
          intensity={0.5}
          distance={10}
        />
      )}

      {attackPhase >= 3 && (
        <pointLight
          position={[-3, 2, -3]}
          color="#FF0000"
          intensity={0.7}
          distance={12}
        />
      )}
    </group>
  );
};

export default BossRoom;
