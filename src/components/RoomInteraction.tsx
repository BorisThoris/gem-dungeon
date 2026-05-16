import React, { useState, useEffect } from "react";
import { Text } from "@react-three/drei";
import type { Room } from "../types/map";

interface RoomInteractionProps {
  room: Room;
  playerPosition: [number, number, number];
  onInteraction: (interactionType: string, roomId: string) => void;
}

const RoomInteraction: React.FC<RoomInteractionProps> = ({
  room,
  playerPosition,
  onInteraction,
}) => {
  const [isNearby, setIsNearby] = useState(false);
  const [interactionPrompt, setInteractionPrompt] = useState<string | null>(
    null
  );

  // Check if player is close enough to interact
  useEffect(() => {
    const distance = Math.sqrt(
      Math.pow(playerPosition[0] - room.position.x, 2) +
        Math.pow(playerPosition[2] - room.position.z, 2)
    );

    const isClose = distance < 3;
    setIsNearby(isClose);

    if (isClose) {
      // Determine what interaction is available
      if (room.type === "puzzle" && room.puzzle) {
        setInteractionPrompt("Press E to solve puzzle");
      } else if (
        room.type === "treasure" &&
        room.specialProperties?.isOpened === false
      ) {
        setInteractionPrompt("Press E to open chest");
      } else if (room.type === "shop") {
        setInteractionPrompt("Press E to browse shop");
      } else if (room.type === "library") {
        setInteractionPrompt("Press E to read books");
      } else if (room.type === "devil-room" || room.type === "angel-room") {
        setInteractionPrompt("Press E to interact with altar");
      } else if (room.type === "boss") {
        setInteractionPrompt("Press E to start boss fight");
      } else if (room.type === "secret") {
        setInteractionPrompt("Press E to discover secret");
      } else {
        setInteractionPrompt(null);
      }
    } else {
      setInteractionPrompt(null);
    }
  }, [playerPosition, room]);

  // Handle interaction based on room type
  const handleInteraction = React.useCallback(() => {
    if (!isNearby) return;

    switch (room.type) {
      case "puzzle":
        onInteraction("puzzle", room.id);
        break;
      case "treasure":
        onInteraction("treasure", room.id);
        break;
      case "shop":
        onInteraction("shop", room.id);
        break;
      case "library":
        onInteraction("library", room.id);
        break;
      case "devil-room":
      case "angel-room":
        onInteraction("altar", room.id);
        break;
      case "boss":
        onInteraction("boss", room.id);
        break;
      case "secret":
        onInteraction("secret", room.id);
        break;
    }
  }, [isNearby, onInteraction, room.id, room.type]);

  // Listen for E key press
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === "e" || event.key === "E") {
        handleInteraction();
      }
    };

    if (isNearby) {
      document.addEventListener("keydown", handleKeyPress);
      return () => document.removeEventListener("keydown", handleKeyPress);
    }
  }, [isNearby, room, handleInteraction]);

  if (!isNearby || !interactionPrompt) return null;

  return (
    <group
      position={[
        room.position.x,
        3,
        room.position.z,
      ]}
    >
      {/* Interaction Prompt */}
      <Text
        position={[0, 0, 0]}
        fontSize={0.8}
        color="#FFFFFF"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {interactionPrompt}
      </Text>

      {/* Interaction Icon */}
      <mesh position={[0, -1, 0]}>
        <boxGeometry args={[0.5, 0.1, 0.5]} />
        <meshBasicMaterial color="#00FF00" transparent opacity={0.7} />
      </mesh>

      {/* Pulsing Effect */}
      <mesh position={[0, -1, 0]}>
        <boxGeometry args={[0.6, 0.05, 0.6]} />
        <meshBasicMaterial
          color="#00FF00"
          transparent
          opacity={0.3 + Math.sin(Date.now() * 0.005) * 0.3}
        />
      </mesh>
    </group>
  );
};

export default RoomInteraction;
