import React, { useState } from "react";
import { RigidBody } from "@react-three/rapier";
import { Text } from "@react-three/drei";
import type { Item } from "../../types/map";
import ItemSprite from "../ItemSprite";

interface SpecialRoomProps {
  roomType: "devil-room" | "angel-room" | "cursed-room" | "secret";
  items: Item[];
  onItemInteraction: (item: Item) => void;
  onRoomEnter: () => void;
}

const SpecialRoom: React.FC<SpecialRoomProps> = ({
  roomType,
  items,
  onItemInteraction,
  onRoomEnter,
}) => {
  const [isEntered, setIsEntered] = useState(false);

  const getRoomTheme = () => {
    switch (roomType) {
      case "devil-room":
        return {
          color: "#8B0000",
          accentColor: "#FF4500",
          icon: "👹",
          title: "DEVIL ROOM",
          atmosphere: "dark",
          particles: "#FF0000",
        };
      case "angel-room":
        return {
          color: "#87CEEB",
          accentColor: "#FFD700",
          icon: "👼",
          title: "ANGEL ROOM",
          atmosphere: "light",
          particles: "#FFFFFF",
        };
      case "cursed-room":
        return {
          color: "#4B0082",
          accentColor: "#FF00FF",
          icon: "💀",
          title: "CURSED ROOM",
          atmosphere: "dark",
          particles: "#800080",
        };
      case "secret":
        return {
          color: "#2F4F4F",
          accentColor: "#00FFFF",
          icon: "🔍",
          title: "SECRET ROOM",
          atmosphere: "mysterious",
          particles: "#00FFFF",
        };
      default:
        return {
          color: "#696969",
          accentColor: "#FFFFFF",
          icon: "❓",
          title: "SPECIAL ROOM",
          atmosphere: "neutral",
          particles: "#FFFFFF",
        };
    }
  };

  const theme = getRoomTheme();

  // Create simple pillar model instead of loading VOX

  const getRoomDescription = () => {
    switch (roomType) {
      case "devil-room":
        return "Dangerous rewards await...";
      case "angel-room":
        return "Divine blessings found here";
      case "cursed-room":
        return "Cursed but powerful items";
      case "secret":
        return "Hidden treasures discovered";
      default:
        return "Mysterious room";
    }
  };

  const handleEnter = () => {
    if (!isEntered) {
      setIsEntered(true);
      onRoomEnter();
    }
  };

  return (
    <group>
      {/* Room Floor */}
      <RigidBody type="fixed" colliders="trimesh">
        <mesh position={[0, -0.5, 0]}>
          <boxGeometry args={[10, 0.2, 10]} />
          <meshLambertMaterial color={theme.color} />
        </mesh>
      </RigidBody>

      {/* Atmospheric Particles */}
      {Array.from({ length: 20 }).map((_, i) => (
        <mesh
          key={i}
          position={[
            (Math.random() - 0.5) * 8,
            Math.random() * 3 + 1,
            (Math.random() - 0.5) * 8,
          ]}
        >
          <sphereGeometry args={[0.05, 4, 4]} />
          <meshBasicMaterial
            color={theme.particles}
            transparent
            opacity={0.6}
          />
        </mesh>
      ))}

      {/* Central Altar/Shrine - Made much larger and more visible */}
      <group position={[0, 0, 0]}>
        {/* Devil Room Special Altar */}
        {roomType === "devil-room" && (
          <>
            {/* Skull Base - Enhanced material */}
            <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
              <sphereGeometry args={[2, 16, 16]} />
              <meshStandardMaterial
                color="#2F2F2F"
                roughness={0.8}
                metalness={0.2}
                emissive="#1A1A1A"
                emissiveIntensity={0.1}
              />
            </mesh>
            {/* Skull Eye Sockets */}
            <mesh position={[-0.7, 0.7, 1.8]}>
              <sphereGeometry args={[0.3]} />
              <meshLambertMaterial color="#000000" />
            </mesh>
            <mesh position={[0.7, 0.7, 1.8]}>
              <sphereGeometry args={[0.3]} />
              <meshLambertMaterial color="#000000" />
            </mesh>
            {/* Skull Nose */}
            <mesh position={[0, 0.2, 1.8]}>
              <coneGeometry args={[0.2, 0.4, 4]} />
              <meshLambertMaterial color="#000000" />
            </mesh>
            {/* Altar Platform - Simple box model */}
            <mesh position={[0, -1, 0]} castShadow receiveShadow>
              <boxGeometry args={[2, 0.5, 2]} />
              <meshLambertMaterial color="#8B4513" />
            </mesh>
            {/* Altar Steps - Enhanced material */}
            <mesh position={[0, -1.8, 0]} castShadow receiveShadow>
              <boxGeometry args={[6, 0.5, 6]} />
              <meshStandardMaterial
                color="#4B0000"
                roughness={0.7}
                metalness={0.1}
                emissive="#2B0000"
                emissiveIntensity={0.1}
              />
            </mesh>
          </>
        )}

        {/* Default Altar for other room types - Simple pillar model */}
        {roomType !== "devil-room" && (
          <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.5, 0.5, 3, 8]} />
            <meshLambertMaterial color="#8B4513" />
          </mesh>
        )}
      </group>

      {/* Special Items */}
      {isEntered &&
        items.map((item, index) => (
          <ItemSprite
            key={item.id}
            item={item}
            position={
              [((index % 3) - 1) * 2, 1.5, Math.floor(index / 3) * 2 - 1] as [
                number,
                number,
                number
              ]
            }
            scale={0.8}
            onClick={() => onItemInteraction(item)}
          />
        ))}

      {/* Room Title - Large visible sign with text */}
      <mesh position={[0, 4, 0]}>
        <boxGeometry args={[6, 1, 0.5]} />
        <meshBasicMaterial color={theme.accentColor} />
      </mesh>

      {/* Room Title Text - Using proper 3D Text component */}
      <Text
        position={[0, 4, 0.3]}
        fontSize={1.5}
        color="#FFFFFF"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.05}
        outlineColor="#000000"
        strokeWidth={0.02}
        strokeColor="#000000"
      >
        {theme.title}
      </Text>

      {/* Room Type Indicator - Different shapes for each room type */}
      {roomType === "devil-room" && (
        <group position={[0, 5, 0]}>
          {/* Main Devil Symbol - Large 3D octahedron with enhanced material */}
          <mesh position={[0, 0, 0]} castShadow receiveShadow>
            <octahedronGeometry args={[2]} />
            <meshStandardMaterial
              color="#8B0000"
              roughness={0.4}
              metalness={0.6}
              emissive="#4B0000"
              emissiveIntensity={0.3}
            />
          </mesh>
          {/* Devil Horns - Enhanced materials */}
          <mesh
            position={[-1.5, 1.5, 0]}
            rotation={[0, 0, Math.PI / 4]}
            castShadow
            receiveShadow
          >
            <coneGeometry args={[0.5, 1.5, 8]} />
            <meshStandardMaterial
              color="#FF0000"
              roughness={0.3}
              metalness={0.7}
              emissive="#800000"
              emissiveIntensity={0.4}
            />
          </mesh>
          <mesh
            position={[1.5, 1.5, 0]}
            rotation={[0, 0, -Math.PI / 4]}
            castShadow
            receiveShadow
          >
            <coneGeometry args={[0.5, 1.5, 8]} />
            <meshStandardMaterial
              color="#FF0000"
              roughness={0.3}
              metalness={0.7}
              emissive="#800000"
              emissiveIntensity={0.4}
            />
          </mesh>
          {/* Devil Eyes - Glowing effect */}
          <mesh position={[-0.5, 0.5, 1.5]}>
            <sphereGeometry args={[0.2, 8, 8]} />
            <meshStandardMaterial
              color="#FF0000"
              emissive="#FF0000"
              emissiveIntensity={0.8}
            />
          </mesh>
          <mesh position={[0.5, 0.5, 1.5]}>
            <sphereGeometry args={[0.2, 8, 8]} />
            <meshStandardMaterial
              color="#FF0000"
              emissive="#FF0000"
              emissiveIntensity={0.8}
            />
          </mesh>
        </group>
      )}
      {roomType === "angel-room" && (
        <mesh position={[0, 5, 0]} castShadow receiveShadow>
          <coneGeometry args={[1.5, 3, 12]} />
          <meshStandardMaterial
            color="#FFD700"
            roughness={0.2}
            metalness={0.8}
            emissive="#FFD700"
            emissiveIntensity={0.3}
          />
        </mesh>
      )}
      {roomType === "cursed-room" && (
        <mesh position={[0, 5, 0]} castShadow receiveShadow>
          <dodecahedronGeometry args={[1.5]} />
          <meshStandardMaterial
            color="#800080"
            roughness={0.5}
            metalness={0.5}
            emissive="#400040"
            emissiveIntensity={0.4}
          />
        </mesh>
      )}
      {roomType === "secret" && (
        <mesh position={[0, 5, 0]} castShadow receiveShadow>
          <torusGeometry args={[1.5, 0.5, 8, 16]} />
          <meshStandardMaterial
            color="#00FFFF"
            roughness={0.3}
            metalness={0.7}
            emissive="#008080"
            emissiveIntensity={0.5}
          />
        </mesh>
      )}

      {/* Enter Prompt - Much larger and more visible */}
      {!isEntered && (
        <group position={[0, 2, 0]}>
          <mesh
            onClick={handleEnter}
            onPointerOver={(e) => {
              e.stopPropagation();
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              document.body.style.cursor = "auto";
            }}
          >
            <boxGeometry args={[5, 1, 2]} />
            <meshBasicMaterial
              color={theme.accentColor}
              transparent
              opacity={0.8}
            />
          </mesh>
          {/* Enter text - Much larger */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[4, 0.5, 0.2]} />
            <meshBasicMaterial color="#000000" />
          </mesh>
          <Text
            position={[0, 0, 0.15]}
            fontSize={0.8}
            color="#FFFFFF"
            anchorX="center"
            anchorY="middle"
          >
            ENTER
          </Text>
        </group>
      )}

      {/* Room Description - Much larger and more visible */}
      {isEntered && (
        <group position={[0, -3, 0]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[4, 0.5, 0.2]} />
            <meshBasicMaterial color={theme.accentColor} />
          </mesh>
          <Text
            position={[0, 0, 0.15]}
            fontSize={0.6}
            color="#FFFFFF"
            anchorX="center"
            anchorY="middle"
          >
            {getRoomDescription()}
          </Text>
        </group>
      )}

      {/* Atmospheric Lighting */}
      <pointLight
        position={[0, 2, 0]}
        color={theme.particles}
        intensity={0.5}
        distance={10}
      />

      {/* Devil Room Special Effects - Enhanced based on Three.js examples */}
      {roomType === "devil-room" && (
        <>
          {/* Main Red Glow */}
          <pointLight
            position={[0, 3, 0]}
            color="#FF0000"
            intensity={1.5}
            distance={20}
            decay={2}
          />
          {/* Flickering Fire Effect */}
          <pointLight
            position={[2, 1, 2]}
            color="#FF4500"
            intensity={1.2}
            distance={10}
            decay={2}
          />
          <pointLight
            position={[-2, 1, -2]}
            color="#FF4500"
            intensity={1.2}
            distance={10}
            decay={2}
          />
          {/* Additional atmospheric lighting */}
          <spotLight
            position={[0, 8, 0]}
            color="#FF0000"
            intensity={0.5}
            angle={Math.PI / 3}
            penumbra={0.5}
            target-position={[0, 0, 0]}
          />
        </>
      )}
    </group>
  );
};

export default SpecialRoom;
