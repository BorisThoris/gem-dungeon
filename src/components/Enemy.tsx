import React, { useRef, useState } from "react";
import { RigidBody } from "@react-three/rapier";
import { Text } from "@react-three/drei";
import { Group, Vector3 } from "three";
import { useFrame } from "@react-three/fiber";

export interface Enemy {
  id: string;
  type: "skeleton" | "zombie" | "spider" | "slime" | "knight";
  health: number;
  maxHealth: number;
  damage: number;
  speed: number;
  position: [number, number, number];
  isAlive: boolean;
  lastAttack: number;
  attackCooldown: number;
}

interface EnemyProps {
  enemy: Enemy;
  playerPosition: [number, number, number];
  onEnemyDeath: (enemyId: string) => void;
  onPlayerDamage: (damage: number) => void;
}

const Enemy: React.FC<EnemyProps> = ({
  enemy,
  playerPosition,
  onEnemyDeath,
  onPlayerDamage,
}) => {
  const ref = useRef<Group>(null);
  const [isAttacking, setIsAttacking] = useState(false);
  const [healthBarVisible, setHealthBarVisible] = useState(false);

  const getEnemyColor = (type: string): string => {
    switch (type) {
      case "skeleton":
        return "#F5F5DC";
      case "zombie":
        return "#8B4513";
      case "spider":
        return "#2F4F4F";
      case "slime":
        return "#32CD32";
      case "knight":
        return "#C0C0C0";
      default:
        return "#FF0000";
    }
  };

  const getEnemyShape = (type: string) => {
    switch (type) {
      case "skeleton":
        return <boxGeometry args={[0.8, 1.5, 0.4]} />;
      case "zombie":
        return <boxGeometry args={[0.9, 1.6, 0.5]} />;
      case "spider":
        return <boxGeometry args={[1.2, 0.6, 1.2]} />;
      case "slime":
        return <sphereGeometry args={[0.7, 8, 8]} />;
      case "knight":
        return <boxGeometry args={[0.8, 1.8, 0.4]} />;
      default:
        return <boxGeometry args={[1, 1, 1]} />;
    }
  };

  const getEnemyIcon = (type: string): string => {
    switch (type) {
      case "skeleton":
        return "💀";
      case "zombie":
        return "🧟";
      case "spider":
        return "🕷️";
      case "slime":
        return "🟢";
      case "knight":
        return "⚔️";
      default:
        return "👹";
    }
  };

  // AI Movement and Attack Logic
  useFrame(() => {
    if (!ref.current || !enemy.isAlive) return;

    const enemyPos = ref.current.position;
    const playerPos = new Vector3(...playerPosition);
    const distance = enemyPos.distanceTo(playerPos);

    // Move towards player if within range
    if (distance > 1.5 && distance < 10) {
      const direction = playerPos.clone().sub(enemyPos).normalize();
      const moveSpeed = enemy.speed * 0.01;

      ref.current.position.add(direction.multiplyScalar(moveSpeed));
      ref.current.lookAt(playerPos);
    }

    // Attack if close enough
    if (distance <= 2 && Date.now() - enemy.lastAttack > enemy.attackCooldown) {
      setIsAttacking(true);
      onPlayerDamage(enemy.damage);
      enemy.lastAttack = Date.now();

      setTimeout(() => setIsAttacking(false), 500);
    }

    // Show health bar when damaged
    if (enemy.health < enemy.maxHealth) {
      setHealthBarVisible(true);
      setTimeout(() => setHealthBarVisible(false), 2000);
    }
  });

  const handleEnemyClick = () => {
    if (!enemy.isAlive) return;

    // Simple damage system - reduce health
    enemy.health -= 1;

    if (enemy.health <= 0) {
      enemy.isAlive = false;
      onEnemyDeath(enemy.id);
    }
  };

  if (!enemy.isAlive) return null;

  return (
    <group ref={ref} position={enemy.position}>
      <RigidBody type="dynamic" colliders="trimesh">
        <mesh
          onClick={handleEnemyClick}
          onPointerOver={() => {
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            document.body.style.cursor = "auto";
          }}
        >
          {getEnemyShape(enemy.type)}
          <meshLambertMaterial
            color={getEnemyColor(enemy.type)}
            emissive={isAttacking ? "#FF0000" : "#000000"}
            emissiveIntensity={isAttacking ? 0.3 : 0}
          />
        </mesh>
      </RigidBody>

      {/* Enemy Icon */}
      <Text
        position={[0, 1.5, 0]}
        fontSize={0.5}
        color="#FFFFFF"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {getEnemyIcon(enemy.type)}
      </Text>

      {/* Health Bar */}
      {healthBarVisible && (
        <group position={[0, 2, 0]}>
          {/* Health Bar Background */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[1.5, 0.1, 0.1]} />
            <meshBasicMaterial color="#FF0000" />
          </mesh>
          {/* Health Bar Fill */}
          <mesh position={[0, 0, 0.05]}>
            <boxGeometry
              args={[(enemy.health / enemy.maxHealth) * 1.5, 0.08, 0.05]}
            />
            <meshBasicMaterial color="#00FF00" />
          </mesh>
        </group>
      )}

      {/* Attack Indicator */}
      {isAttacking && (
        <mesh position={[0, 1, 0]}>
          <sphereGeometry args={[0.3, 8, 8]} />
          <meshBasicMaterial color="#FF0000" transparent opacity={0.7} />
        </mesh>
      )}

      {/* Death Effect */}
      {!enemy.isAlive && (
        <group>
          {Array.from({ length: 10 }).map((_, i) => (
            <mesh
              key={i}
              position={[
                (Math.random() - 0.5) * 2,
                Math.random() * 2,
                (Math.random() - 0.5) * 2,
              ]}
            >
              <sphereGeometry args={[0.1, 4, 4]} />
              <meshBasicMaterial
                color={getEnemyColor(enemy.type)}
                transparent
                opacity={0.8}
              />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
};

export default Enemy;
