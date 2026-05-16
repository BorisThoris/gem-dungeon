import React, { useState, useEffect } from "react";
import { Html } from "@react-three/drei";
import PuzzleGrid from "./PuzzleGrid";
import type { Puzzle } from "../types/map";

interface FirstPersonPuzzleProps {
  puzzle: Puzzle;
  onComplete: () => void;
  onExit: () => void;
}

const FirstPersonPuzzle: React.FC<FirstPersonPuzzleProps> = ({
  puzzle,
  onComplete,
  onExit,
}) => {
  const [isComplete, setIsComplete] = useState(false);
  const [moves, setMoves] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60); // 60 second timer

  // Timer countdown
  useEffect(() => {
    if (timeLeft > 0 && !isComplete) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0) {
      // Time's up - exit puzzle
      onExit();
    }
  }, [timeLeft, isComplete, onExit]);

  // Listen for escape key to exit
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onExit();
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [onExit]);

  const handlePuzzleComplete = () => {
    setIsComplete(true);
    setTimeout(() => {
      onComplete();
    }, 2000);
  };

  const handleTileClick = () => {
    setMoves((prev) => prev + 1);
  };

  return (
    <group>
      {/* Header UI */}
      <Html
        position={[0, 5, 0]}
        center
        style={{
          width: "100vw",
          height: "100vh",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "20px",
            left: "20px",
            right: "20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "white",
            fontFamily: "monospace",
            pointerEvents: "auto",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "1.5rem" }}>Memory Puzzle</h2>
            <p style={{ margin: "5px 0 0 0", fontSize: "1rem" }}>
              Match the tiles to complete the puzzle!
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "1.2rem", marginBottom: "5px" }}>
              Time:{" "}
              <span style={{ color: timeLeft < 10 ? "#ff0000" : "#00ff00" }}>
                {timeLeft}s
              </span>
            </div>
            <div style={{ fontSize: "1rem" }}>Moves: {moves}</div>
          </div>
        </div>

        {/* Instructions */}
        <div
          style={{
            position: "absolute",
            top: "80px",
            left: "20px",
            right: "20px",
            color: "white",
            fontFamily: "monospace",
            fontSize: "0.9rem",
            textAlign: "center",
          }}
        >
          <p>Click tiles to flip them. Match pairs to clear them!</p>
          <p>
            Press{" "}
            <kbd
              style={{
                background: "#333",
                padding: "2px 6px",
                borderRadius: "3px",
              }}
            >
              ESC
            </kbd>{" "}
            to exit
          </p>
        </div>

        {/* Exit Button */}
        <button
          onClick={onExit}
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            padding: "10px 20px",
            background: "rgba(255, 0, 0, 0.8)",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            fontFamily: "monospace",
            fontSize: "1rem",
            pointerEvents: "auto",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = "rgba(255, 0, 0, 1)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "rgba(255, 0, 0, 0.8)";
          }}
        >
          EXIT (ESC)
        </button>

        {/* Completion Overlay */}
        {isComplete && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background: "rgba(0, 0, 0, 0.8)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              color: "white",
              fontFamily: "monospace",
              pointerEvents: "auto",
            }}
          >
            <h1 style={{ fontSize: "3rem", margin: 0, color: "#00ff00" }}>
              PUZZLE COMPLETE!
            </h1>
            <p style={{ fontSize: "1.5rem", margin: "20px 0" }}>
              Moves: {moves} | Time: {60 - timeLeft}s
            </p>
            <div style={{ fontSize: "1rem", opacity: 0.7 }}>
              Returning to game...
            </div>
          </div>
        )}
      </Html>

      {/* Puzzle Grid */}
      <PuzzleGrid
        puzzle={puzzle}
        onTileClick={handleTileClick}
        onComplete={handlePuzzleComplete}
      />
    </group>
  );
};

export default FirstPersonPuzzle;
