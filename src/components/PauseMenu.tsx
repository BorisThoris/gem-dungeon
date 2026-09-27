import React from "react";

interface PauseMenuProps {
  isVisible: boolean;
  onUnpause: () => void;
}

const PauseMenu: React.FC<PauseMenuProps> = ({ isVisible, onUnpause }) => {
  if (!isVisible) return null;

  // Check if we're in development mode
  const isDevMode =
    import.meta.env.DEV || window.location.hostname === "localhost";

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 2000,
        color: "white",
        fontFamily: "monospace",
      }}
    >
      <h1
        style={{ fontSize: "3rem", margin: "0 0 2rem 0", textAlign: "center" }}
      >
        GAME PAUSED
      </h1>

      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <p style={{ fontSize: "1.2rem", margin: "0 0 1rem 0" }}>
          Press X or Escape to resume
        </p>
        <p style={{ fontSize: "1rem", opacity: 0.7, margin: 0 }}>
          Or click the button below
        </p>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "15px",
          alignItems: "center",
        }}
      >
        <button
          onClick={onUnpause}
          style={{
            padding: "15px 30px",
            fontSize: "1.5rem",
            backgroundColor: "#00ff00",
            color: "black",
            border: "none",
            borderRadius: "10px",
            cursor: "pointer",
            fontFamily: "monospace",
            fontWeight: "bold",
            transition: "all 0.3s ease",
            boxShadow: "0 4px 15px rgba(0, 255, 0, 0.3)",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = "#00cc00";
            e.currentTarget.style.transform = "scale(1.05)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = "#00ff00";
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          Resume exploration
        </button>

        {/* 3D Editor Button - Only show in dev mode */}
        {isDevMode && (
          <button
            onClick={() => (window.location.href = "?editor=true")}
            style={{
              padding: "12px 24px",
              fontSize: "1.2rem",
              background: "linear-gradient(45deg, #4CAF50, #8BC34A)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontFamily: "monospace",
              fontWeight: "bold",
              transition: "all 0.3s ease",
              boxShadow: "0 4px 15px rgba(76, 175, 80, 0.4)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = "scale(1.05)";
              e.currentTarget.style.boxShadow =
                "0 6px 20px rgba(76, 175, 80, 0.6)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow =
                "0 4px 15px rgba(76, 175, 80, 0.4)";
            }}
          >
            🎮 3D Editor
          </button>
        )}

        {/* Texture Tools - Only show in dev mode */}
        {isDevMode && (
          <>
            <button
              className="menu-button"
              onClick={() => (window.location.href = "?texture-painter=true")}
              style={{
                padding: "12px 24px",
                fontSize: "1.2rem",
                background: "linear-gradient(45deg, #4CAF50, #45a049)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontFamily: "monospace",
                fontWeight: "bold",
                transition: "all 0.3s ease",
                boxShadow: "0 4px 15px rgba(76, 175, 80, 0.4)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                margin: "5px",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = "scale(1.05)";
                e.currentTarget.style.boxShadow =
                  "0 6px 20px rgba(76, 175, 80, 0.6)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow =
                  "0 4px 15px rgba(76, 175, 80, 0.4)";
              }}
            >
              🎨 Texture Painter
            </button>
            <button
              className="menu-button"
              onClick={() => (window.location.href = "?mosaic-creator=true")}
              style={{
                padding: "12px 24px",
                fontSize: "1.2rem",
                background: "linear-gradient(45deg, #667eea, #764ba2)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontFamily: "monospace",
                fontWeight: "bold",
                transition: "all 0.3s ease",
                boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                margin: "5px",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = "scale(1.05)";
                e.currentTarget.style.boxShadow =
                  "0 6px 20px rgba(102, 126, 234, 0.6)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow =
                  "0 4px 15px rgba(102, 126, 234, 0.4)";
              }}
            >
              🧩 3D Mosaic Creator
            </button>
            <button
              className="menu-button"
              onClick={() => (window.location.href = "?url-test=true")}
              style={{
                padding: "12px 24px",
                fontSize: "1.2rem",
                background: "linear-gradient(45deg, #2196F3, #1976D2)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontFamily: "monospace",
                fontWeight: "bold",
                transition: "all 0.3s ease",
                boxShadow: "0 4px 15px rgba(33, 150, 243, 0.4)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                margin: "5px",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = "scale(1.05)";
                e.currentTarget.style.boxShadow =
                  "0 6px 20px rgba(33, 150, 243, 0.6)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow =
                  "0 4px 15px rgba(33, 150, 243, 0.4)";
              }}
            >
              🔗 URL Param Test
            </button>
            <button
              className="menu-button"
              onClick={() => (window.location.href = "?url-debug=true")}
              style={{
                padding: "12px 24px",
                fontSize: "1.2rem",
                background: "linear-gradient(45deg, #FF9800, #F57C00)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontFamily: "monospace",
                fontWeight: "bold",
                transition: "all 0.3s ease",
                boxShadow: "0 4px 15px rgba(255, 152, 0, 0.4)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                margin: "5px",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = "scale(1.05)";
                e.currentTarget.style.boxShadow =
                  "0 6px 20px rgba(255, 152, 0, 0.6)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow =
                  "0 4px 15px rgba(255, 152, 0, 0.4)";
              }}
            >
              🐛 URL Debug
            </button>
          </>
        )}
      </div>

      <div style={{ marginTop: "2rem", fontSize: "0.9rem", opacity: 0.5 }}>
        <p>Controls:</p>
        <p>WASD - Move | Mouse - Look around | Click - Interact</p>
      </div>
    </div>
  );
};

export default PauseMenu;
