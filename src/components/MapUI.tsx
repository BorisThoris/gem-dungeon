import React from "react";
import useMapStore from "../store/mapStore";
import { RoomType as RoomTypeValues } from "../types/map";

const MapUI: React.FC = () => {
  const {
    currentMap,
    currentRoomId,
    visitedRooms,
    isGenerating,
    error,
    generateMap,
    clearMap,
  } = useMapStore();

  if (!currentMap) {
    return (
      <div
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          color: "white",
          background: "rgba(0,0,0,0.7)",
          padding: "10px",
          borderRadius: "8px",
          fontFamily: "monospace",
          fontSize: "14px",
        }}
      >
        {isGenerating ? "Generating map..." : "No map loaded"}
      </div>
    );
  }

  const currentRoom = currentMap.rooms.find(
    (room) => room.id === currentRoomId
  );
  const totalRooms = currentMap.rooms.length;
  const visitedCount = visitedRooms.size;

  const getRoomTypeName = (type: string): string => {
    switch (type) {
      case RoomTypeValues.START:
        return "Start";
      case RoomTypeValues.END:
        return "End";
      case RoomTypeValues.TREASURE:
        return "Treasure";
      case RoomTypeValues.ENEMY:
        return "Enemy";
      case RoomTypeValues.PUZZLE:
        return "Puzzle";
      case RoomTypeValues.BOSS:
        return "Boss";
      case RoomTypeValues.SECRET:
        return "Secret";
      default:
        return "Normal";
    }
  };

  const getAlgorithmName = (mapId: string): string => {
    // BoI-style patterns
    const patterns = [
      "Cross Pattern",
      "Line Pattern",
      "L-Shape Pattern",
      "T-Shape Pattern",
      "Plus Pattern",
    ];
    const hash = mapId.split("_")[1] ? parseInt(mapId.split("_")[1]) : 0;
    return patterns[hash % patterns.length];
  };

  return (
    <div
      style={{
        position: "absolute",
        top: "20px",
        left: "20px",
        color: "white",
        background: "rgba(0,0,0,0.7)",
        padding: "15px",
        borderRadius: "8px",
        fontFamily: "monospace",
        fontSize: "14px",
        minWidth: "250px",
      }}
    >
      <h3 style={{ margin: "0 0 10px 0", color: "#4CAF50" }}>Ghost Dungeon</h3>

      {currentRoom && (
        <div style={{ marginBottom: "10px" }}>
          <div>
            <strong>Current Room:</strong> {getRoomTypeName(currentRoom.type)}
          </div>
          <div>
            <strong>Position:</strong> ({currentRoom.position.x},{" "}
            {currentRoom.position.z})
          </div>
          <div>
            <strong>Connections:</strong> {currentRoom.connections.length}
          </div>
        </div>
      )}

      <div style={{ marginBottom: "10px" }}>
        <div>
          <strong>Progress:</strong> {visitedCount}/{totalRooms} rooms visited
        </div>
        <div>
          <strong>Map Size:</strong> {currentMap.config.width}x
          {currentMap.config.height}
        </div>
        <div>
          <strong>Algorithm:</strong> {getAlgorithmName(currentMap.id)}
        </div>
      </div>

      <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
        <button
          onClick={() => generateMap()}
          style={{
            background: "#4CAF50",
            color: "white",
            border: "none",
            padding: "8px 12px",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
          }}
        >
          New Map
        </button>
        <button
          onClick={() => clearMap()}
          style={{
            background: "#F44336",
            color: "white",
            border: "none",
            padding: "8px 12px",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
          }}
        >
          Clear
        </button>
      </div>

      {error && (
        <div
          style={{
            color: "#F44336",
            marginTop: "10px",
            fontSize: "12px",
          }}
        >
          Error: {error}
        </div>
      )}

      <div
        style={{
          marginTop: "15px",
          fontSize: "12px",
          color: "#ccc",
        }}
      >
        <div>
          <strong>Controls:</strong>
        </div>
        <div>WASD - Move</div>
        <div>Space - Jump</div>
        <div>Shift - Run</div>
        <div>Mouse - Look around</div>
      </div>
    </div>
  );
};

export default MapUI;
