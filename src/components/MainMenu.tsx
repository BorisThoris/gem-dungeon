import React, { useState } from "react";
import { useSaveSystem } from "../hooks/useSaveSystem";
import { useSettings } from "../hooks/useSettings";

interface MainMenuProps {
  onStartGame: () => void;
  onLoadGame: () => void;
  onShowSettings: () => void;
  onShowCredits: () => void;
}

const MainMenu: React.FC<MainMenuProps> = ({
  onStartGame,
  onLoadGame,
  onShowSettings,
  onShowCredits,
}) => {
  const { hasSaveData, getSaveInfo, deleteSave } = useSaveSystem();
  const {} = useSettings();
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const saveInfo = getSaveInfo();

  const handleDeleteSave = () => {
    if (deleteSave()) {
      setShowConfirmDelete(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background:
          "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontFamily: "monospace",
        zIndex: 10000,
      }}
    >
      {/* Game Title */}
      <div
        style={{
          fontSize: "4rem",
          fontWeight: "bold",
          marginBottom: "2rem",
          textShadow: "0 0 20px #00ffff",
          textAlign: "center",
        }}
      >
        GHOST DUNGEON
      </div>

      {/* Subtitle */}
      <div
        style={{
          fontSize: "1.2rem",
          marginBottom: "3rem",
          color: "#cccccc",
          textAlign: "center",
        }}
      >
        A Roguelike Puzzle Dungeon Crawler
      </div>

      {/* Menu Buttons */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          minWidth: "300px",
        }}
      >
        {/* New Game */}
        <button
          onClick={onStartGame}
          style={{
            padding: "15px 30px",
            fontSize: "1.2rem",
            background: "linear-gradient(45deg, #4CAF50, #45a049)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
            transition: "all 0.3s ease",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 6px 12px rgba(0,0,0,0.4)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.3)";
          }}
        >
          🎮 NEW GAME
        </button>

        {/* Load Game */}
        {hasSaveData() && (
          <button
            onClick={onLoadGame}
            style={{
              padding: "15px 30px",
              fontSize: "1.2rem",
              background: "linear-gradient(45deg, #2196F3, #1976D2)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
              transition: "all 0.3s ease",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 6px 12px rgba(0,0,0,0.4)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.3)";
            }}
          >
            💾 LOAD GAME
            {saveInfo && (
              <div style={{ fontSize: "0.8rem", marginTop: "5px" }}>
                Level {saveInfo.level} • Floor {saveInfo.floor} • Score:{" "}
                {saveInfo.score}
              </div>
            )}
          </button>
        )}

        {/* Settings */}
        <button
          onClick={onShowSettings}
          style={{
            padding: "15px 30px",
            fontSize: "1.2rem",
            background: "linear-gradient(45deg, #FF9800, #F57C00)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
            transition: "all 0.3s ease",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 6px 12px rgba(0,0,0,0.4)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.3)";
          }}
        >
          ⚙️ SETTINGS
        </button>

        {/* Credits */}
        <button
          onClick={onShowCredits}
          style={{
            padding: "15px 30px",
            fontSize: "1.2rem",
            background: "linear-gradient(45deg, #9C27B0, #7B1FA2)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
            transition: "all 0.3s ease",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 6px 12px rgba(0,0,0,0.4)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.3)";
          }}
        >
          📜 CREDITS
        </button>

        {/* Delete Save */}
        {hasSaveData() && (
          <button
            onClick={() => setShowConfirmDelete(true)}
            style={{
              padding: "10px 20px",
              fontSize: "1rem",
              background: "linear-gradient(45deg, #F44336, #D32F2F)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
              transition: "all 0.3s ease",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 6px 12px rgba(0,0,0,0.4)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.3)";
            }}
          >
            🗑️ DELETE SAVE
          </button>
        )}
      </div>

      {/* Game Info */}
      <div
        style={{
          marginTop: "3rem",
          fontSize: "0.9rem",
          color: "#888888",
          textAlign: "center",
          maxWidth: "600px",
        }}
      >
        <div>Inspired by Binding of Isaac and Noita</div>
        <div>
          Explore procedurally generated dungeons, solve puzzles, and discover
          secrets!
        </div>
        <div style={{ marginTop: "1rem" }}>
          <strong>Controls:</strong> WASD to move • Mouse to look • Click to
          interact
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showConfirmDelete && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10001,
          }}
        >
          <div
            style={{
              background: "#2a2a2a",
              padding: "2rem",
              borderRadius: "8px",
              textAlign: "center",
              border: "2px solid #ff4444",
            }}
          >
            <h3 style={{ color: "#ff4444", marginBottom: "1rem" }}>
              Delete Save Game?
            </h3>
            <p style={{ marginBottom: "2rem" }}>
              This action cannot be undone. Are you sure you want to delete your
              save?
            </p>
            <div
              style={{ display: "flex", gap: "1rem", justifyContent: "center" }}
            >
              <button
                onClick={handleDeleteSave}
                style={{
                  padding: "10px 20px",
                  background: "#ff4444",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Yes, Delete
              </button>
              <button
                onClick={() => setShowConfirmDelete(false)}
                style={{
                  padding: "10px 20px",
                  background: "#666666",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainMenu;
