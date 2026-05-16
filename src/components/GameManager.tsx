import React, { useState, useEffect, useCallback } from "react";
import useGameStore from "../store/gameStore";
import { useSoundEffects } from "../hooks/useSoundEffects";
import { EffectManager } from "./VisualEffects";
import type { Enemy } from "./Enemy";

interface GameManagerProps {
  playerPosition: [number, number, number];
  onPlayerDamage?: (damage: number) => void;
}

const GameManager: React.FC<GameManagerProps> = ({
  playerPosition,
}) => {
  const {
    playerStats,
    enemies,
    gamePhase,
    spawnEnemy,
    // removeEnemy,
    // damageEnemy,
    // addScore,
    updateStats,
  } = useGameStore();

  const { playSound } = useSoundEffects();
  const [effects, setEffects] = useState<
    Array<{
      id: string;
      type: "damage" | "heal" | "score" | "levelup" | "combo" | "custom";
      value?: number;
      text?: string;
      position: [number, number, number];
      color?: string;
      duration?: number;
    }>
  >([]);

  // Add visual effect
  const addEffect = useCallback(
    (
      type: "damage" | "heal" | "score" | "levelup" | "combo" | "custom",
      value: number,
      position: [number, number, number],
      text?: string,
      color?: string,
      duration?: number
    ) => {
      const id = `${type}_${Date.now()}_${Math.random()}`;
      setEffects((prev) => [
        ...prev,
        {
          id,
          type,
          value,
          text,
          position,
          color,
          duration,
        },
      ]);
    },
    []
  );

  // Remove effect
  const removeEffect = useCallback((id: string) => {
    setEffects((prev) => prev.filter((effect) => effect.id !== id));
  }, []);

  // Handle enemy spawning
  const handleEnemySpawn = useCallback(
    (enemy: Enemy) => {
      spawnEnemy(enemy);
      playSound("enemyHit");
    },
    [spawnEnemy, playSound]
  );

  // Game event handlers (available for use by other components)
  // const handleEnemyDeath = useCallback(...)
  // const handleEnemyDamage = useCallback(...)
  // const handlePlayerDamage = useCallback(...)
  // const handlePlayerHeal = useCallback(...)
  // const handleItemPickup = useCallback(...)
  // const handlePuzzleComplete = useCallback(...)
  // const handleChestOpen = useCallback(...)
  // const handleSecretDiscover = useCallback(...)
  // const handleBossDefeat = useCallback(...)

  // Handle level up
  const handleLevelUp = useCallback(() => {
    addEffect("levelup", 0, [
      playerPosition[0],
      playerPosition[1] + 2,
      playerPosition[2],
    ]);
    playSound("levelUp");
  }, [playerPosition, addEffect, playSound]);

  // Check for level up
  useEffect(() => {
    const newLevel = Math.floor(playerStats.experience / 100) + 1;
    if (newLevel > playerStats.level) {
      updateStats({ level: newLevel });
      handleLevelUp();
    }
  }, [playerStats.experience, playerStats.level, updateStats, handleLevelUp]);

  // Auto-spawn enemies based on game phase
  useEffect(() => {
    if (gamePhase === "combat" && enemies.length === 0) {
      // Spawn random enemies
      const enemyTypes: Array<Enemy["type"]> = [
        "skeleton",
        "zombie",
        "spider",
        "slime",
      ];
      const randomType =
        enemyTypes[Math.floor(Math.random() * enemyTypes.length)];

      const enemy: Enemy = {
        id: `enemy_${Date.now()}`,
        type: randomType,
        health: 3,
        maxHealth: 3,
        damage: 1,
        speed: 0.5,
        position: [
          playerPosition[0] + (Math.random() - 0.5) * 10,
          playerPosition[1],
          playerPosition[2] + (Math.random() - 0.5) * 10,
        ],
        isAlive: true,
        lastAttack: 0,
        attackCooldown: 2000,
      };

      handleEnemySpawn(enemy);
    }
  }, [gamePhase, enemies.length, playerPosition, handleEnemySpawn]);

  // Handlers are available for use by other components

  return (
    <group>
      <EffectManager effects={effects} onEffectComplete={removeEffect} />

      {/* Render enemies */}
      {enemies.map((_enemy) => (
        <group key={_enemy.id}>
          {/* Enemy rendering would be handled by the Enemy component */}
        </group>
      ))}
    </group>
  );
};

export default GameManager;
