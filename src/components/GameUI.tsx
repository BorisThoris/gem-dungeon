import React from "react";
import type { Item } from "../types/map";

interface PlayerStats {
  lives: number;
  maxLives: number;
  points: number;
  keys: number;
  bombs: number;
  level: number;
  experience: number;
  streak: number;
  maxStreak: number;
}

interface GameUIProps {
  playerStats: PlayerStats;
  inventory: Item[];
  currentRoom?: string;
  onItemUse?: (item: Item) => void;
}

const GameUI: React.FC<GameUIProps> = ({
  playerStats,
  inventory,
  currentRoom,
  onItemUse,
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

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: "none",
        zIndex: 1000,
      }}
    >
      {/* Top HUD - Player Stats */}
      <div
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          background: "rgba(0,0,0,0.8)",
          padding: "15px",
          borderRadius: "8px",
          color: "white",
          fontFamily: "monospace",
          fontSize: "14px",
          minWidth: "200px",
          pointerEvents: "auto",
          zIndex: 1001,
        }}
      >
        <div
          style={{
            marginBottom: "10px",
            fontSize: "16px",
            fontWeight: "bold",
          }}
        >
          Ghost Explorer
        </div>

        <div style={{ display: "flex", gap: "20px", marginBottom: "10px" }}>
          <div>
            <div>
              ❤️ Lives: {playerStats.lives}/{playerStats.maxLives}
            </div>
            <div>⭐ Level: {playerStats.level}</div>
            <div>🔥 Streak: {playerStats.streak}</div>
          </div>
          <div>
            <div>💰 Points: {playerStats.points}</div>
            <div>🗝️ Keys: {playerStats.keys}</div>
            <div>💣 Bombs: {playerStats.bombs}</div>
          </div>
        </div>

        {currentRoom && (
          <div style={{ fontSize: "12px", color: "#ccc" }}>
            Current Room: {currentRoom}
          </div>
        )}
      </div>

      {/* Inventory - Bottom Right */}
      <div
        style={{
          position: "absolute",
          bottom: "20px",
          right: "20px",
          background: "rgba(0,0,0,0.8)",
          padding: "15px",
          borderRadius: "8px",
          color: "white",
          fontFamily: "monospace",
          fontSize: "14px",
          minWidth: "300px",
          maxHeight: "300px",
          overflowY: "auto",
          zIndex: 1001,
          pointerEvents: "auto",
        }}
      >
        <div
          style={{
            marginBottom: "10px",
            fontSize: "16px",
            fontWeight: "bold",
          }}
        >
          Inventory ({inventory.length})
        </div>

        {inventory.length === 0 ? (
          <div style={{ color: "#666", fontStyle: "italic" }}>No items</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {inventory.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "8px",
                  background: "rgba(255,255,255,0.1)",
                  borderRadius: "4px",
                  cursor: onItemUse ? "pointer" : "default",
                }}
                onClick={() => onItemUse?.(item)}
              >
                <span style={{ fontSize: "20px" }}>{item.icon}</span>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      color: getRarityColor(item.rarity),
                      fontWeight: "bold",
                    }}
                  >
                    {item.name}
                  </div>
                  <div style={{ fontSize: "12px", color: "#ccc" }}>
                    {item.description}
                  </div>
                  <div style={{ fontSize: "10px", color: "#999" }}>
                    {item.type} • {item.rarity}
                  </div>
                </div>
                {item.maxUses && (
                  <div style={{ fontSize: "12px", color: "#ffa500" }}>
                    {item.currentUses}/{item.maxUses}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom HUD - Controls */}
      <div
        style={{
          position: "absolute",
          bottom: "20px",
          left: "20px",
          background: "rgba(0,0,0,0.8)",
          padding: "15px",
          borderRadius: "8px",
          color: "white",
          fontFamily: "monospace",
          fontSize: "12px",
          pointerEvents: "auto",
        }}
      >
        <div style={{ marginBottom: "8px", fontWeight: "bold" }}>Controls</div>
        <div>WASD - Move</div>
        <div>Space - Jump</div>
        <div>Shift - Run</div>
        <div>Mouse - Look around</div>
        <div>Click - Interact</div>
      </div>

      {/* Experience Bar */}
      <div
        style={{
          position: "absolute",
          bottom: "20px",
          right: "20px",
          background: "rgba(0,0,0,0.8)",
          padding: "15px",
          borderRadius: "8px",
          color: "white",
          fontFamily: "monospace",
          fontSize: "12px",
          pointerEvents: "auto",
          minWidth: "200px",
        }}
      >
        <div style={{ marginBottom: "8px", fontWeight: "bold" }}>
          Experience
        </div>
        <div
          style={{
            background: "#333",
            height: "20px",
            borderRadius: "10px",
            overflow: "hidden",
            marginBottom: "5px",
          }}
        >
          <div
            style={{
              background: "linear-gradient(90deg, #4CAF50, #8BC34A)",
              height: "100%",
              width: `${playerStats.experience % 100}%`,
              transition: "width 0.3s ease",
            }}
          />
        </div>
        <div style={{ fontSize: "10px", color: "#ccc" }}>
          {playerStats.experience} XP • Next level:{" "}
          {Math.ceil(playerStats.experience / 100) * 100}
        </div>
      </div>
    </div>
  );
};

export default GameUI;
