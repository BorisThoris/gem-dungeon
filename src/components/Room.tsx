import React from "react";
import { RigidBody } from "@react-three/rapier";
import type { Room as RoomType, Item } from "../types/map";
import { RoomType as RoomTypeValues } from "../types/map";
import ItemSprite from "./ItemSprite";
import PuzzleGrid from "./PuzzleGrid";

interface RoomProps {
  room: RoomType;
  isCurrent: boolean;
  isVisited: boolean;
  connectedRooms: RoomType[];
  onClick?: () => void;
}

const Room: React.FC<RoomProps> = ({
  room,
  isCurrent,
  isVisited,
  connectedRooms,
  onClick,
}) => {
  const getRoomColor = (type: string): string => {
    switch (type) {
      case RoomTypeValues.START:
        return "#4CAF50"; // Green
      case RoomTypeValues.END:
        return "#F44336"; // Red
      case RoomTypeValues.TREASURE:
        return "#FFD700"; // Gold
      case RoomTypeValues.ENEMY:
        return "#FF5722"; // Orange
      case RoomTypeValues.PUZZLE:
        return "#9C27B0"; // Purple
      case RoomTypeValues.BOSS:
        return "#E91E63"; // Pink
      case RoomTypeValues.SECRET:
        return "#607D8B"; // Blue Grey
      // Enhanced room types
      case RoomTypeValues.MEMORY_CHAMBER:
        return "#673AB7"; // Deep Purple
      case RoomTypeValues.SHOP:
        return "#4CAF50"; // Green
      case RoomTypeValues.TRAP:
        return "#FF5722"; // Orange
      case RoomTypeValues.CHALLENGE:
        return "#FF9800"; // Amber
      case RoomTypeValues.LIBRARY:
        return "#795548"; // Brown
      case RoomTypeValues.CURSED_ROOM:
        return "#9C27B0"; // Purple
      case RoomTypeValues.DEVIL_ROOM:
        return "#E91E63"; // Pink
      case RoomTypeValues.ANGEL_ROOM:
        return "#00BCD4"; // Cyan
      default:
        return "#2196F3"; // Blue
    }
  };

  const getRoomHeight = (type: string): number => {
    switch (type) {
      case RoomTypeValues.START:
      case RoomTypeValues.END:
        return 0.2;
      case RoomTypeValues.BOSS:
        return 0.3;
      default:
        return 0.1;
    }
  };

  const roomColor = getRoomColor(room.type);
  const roomHeight = getRoomHeight(room.type);
  const opacity = isVisited ? 1 : 0.3;
  const scale = isCurrent ? 1.1 : 1;

  const wallThickness = 0.2;
  const wallHeight = 3;
  const doorWidth = 2; // Width of door openings

  // Check which walls should have doors (connections)
  const hasNorthConnection = connectedRooms.some(
    (connectedRoom) =>
      connectedRoom.position.z < room.position.z &&
      Math.abs(room.position.z - connectedRoom.position.z) === room.size &&
      room.position.x === connectedRoom.position.x
  );

  const hasSouthConnection = connectedRooms.some(
    (connectedRoom) =>
      connectedRoom.position.z > room.position.z &&
      Math.abs(room.position.z - connectedRoom.position.z) === room.size &&
      room.position.x === connectedRoom.position.x
  );

  const hasEastConnection = connectedRooms.some(
    (connectedRoom) =>
      connectedRoom.position.x > room.position.x &&
      Math.abs(room.position.x - connectedRoom.position.x) === room.size &&
      room.position.z === connectedRoom.position.z
  );

  const hasWestConnection = connectedRooms.some(
    (connectedRoom) =>
      connectedRoom.position.x < room.position.x &&
      Math.abs(room.position.x - connectedRoom.position.x) === room.size &&
      room.position.z === connectedRoom.position.z
  );

  return (
    <group position={[room.position.x, 0, room.position.z]} scale={scale}>
      {/* Physical Floor with Collision */}
      <RigidBody type="fixed" colliders="trimesh">
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -roomHeight / 2, 0]}
          receiveShadow
          onClick={onClick}
        >
          <planeGeometry args={[room.size, room.size]} />
          <meshLambertMaterial
            color={roomColor}
            transparent
            opacity={opacity}
          />
        </mesh>
      </RigidBody>

      {/* North Wall - Split into segments if there's a door */}
      {hasNorthConnection ? (
        <>
          {/* Left segment */}
          <RigidBody type="fixed" colliders="trimesh">
            <mesh
              position={[-room.size / 4, wallHeight / 2, -room.size / 2]}
              castShadow
            >
              <boxGeometry
                args={[
                  room.size / 2 - doorWidth / 2,
                  wallHeight,
                  wallThickness,
                ]}
              />
              <meshLambertMaterial color="#8B4513" />
            </mesh>
          </RigidBody>
          {/* Right segment */}
          <RigidBody type="fixed" colliders="trimesh">
            <mesh
              position={[room.size / 4, wallHeight / 2, -room.size / 2]}
              castShadow
            >
              <boxGeometry
                args={[
                  room.size / 2 - doorWidth / 2,
                  wallHeight,
                  wallThickness,
                ]}
              />
              <meshLambertMaterial color="#8B4513" />
            </mesh>
          </RigidBody>
        </>
      ) : (
        <RigidBody type="fixed" colliders="trimesh">
          <mesh position={[0, wallHeight / 2, -room.size / 2]} castShadow>
            <boxGeometry args={[room.size, wallHeight, wallThickness]} />
            <meshLambertMaterial color="#8B4513" />
          </mesh>
        </RigidBody>
      )}

      {/* South Wall - Split into segments if there's a door */}
      {hasSouthConnection ? (
        <>
          {/* Left segment */}
          <RigidBody type="fixed" colliders="trimesh">
            <mesh
              position={[-room.size / 4, wallHeight / 2, room.size / 2]}
              castShadow
            >
              <boxGeometry
                args={[
                  room.size / 2 - doorWidth / 2,
                  wallHeight,
                  wallThickness,
                ]}
              />
              <meshLambertMaterial color="#8B4513" />
            </mesh>
          </RigidBody>
          {/* Right segment */}
          <RigidBody type="fixed" colliders="trimesh">
            <mesh
              position={[room.size / 4, wallHeight / 2, room.size / 2]}
              castShadow
            >
              <boxGeometry
                args={[
                  room.size / 2 - doorWidth / 2,
                  wallHeight,
                  wallThickness,
                ]}
              />
              <meshLambertMaterial color="#8B4513" />
            </mesh>
          </RigidBody>
        </>
      ) : (
        <RigidBody type="fixed" colliders="trimesh">
          <mesh position={[0, wallHeight / 2, room.size / 2]} castShadow>
            <boxGeometry args={[room.size, wallHeight, wallThickness]} />
            <meshLambertMaterial color="#8B4513" />
          </mesh>
        </RigidBody>
      )}

      {/* East Wall - Split into segments if there's a door */}
      {hasEastConnection ? (
        <>
          {/* Top segment */}
          <RigidBody type="fixed" colliders="trimesh">
            <mesh
              position={[room.size / 2, wallHeight / 2, -room.size / 4]}
              castShadow
            >
              <boxGeometry
                args={[
                  wallThickness,
                  wallHeight,
                  room.size / 2 - doorWidth / 2,
                ]}
              />
              <meshLambertMaterial color="#8B4513" />
            </mesh>
          </RigidBody>
          {/* Bottom segment */}
          <RigidBody type="fixed" colliders="trimesh">
            <mesh
              position={[room.size / 2, wallHeight / 2, room.size / 4]}
              castShadow
            >
              <boxGeometry
                args={[
                  wallThickness,
                  wallHeight,
                  room.size / 2 - doorWidth / 2,
                ]}
              />
              <meshLambertMaterial color="#8B4513" />
            </mesh>
          </RigidBody>
        </>
      ) : (
        <RigidBody type="fixed" colliders="trimesh">
          <mesh position={[room.size / 2, wallHeight / 2, 0]} castShadow>
            <boxGeometry args={[wallThickness, wallHeight, room.size]} />
            <meshLambertMaterial color="#8B4513" />
          </mesh>
        </RigidBody>
      )}

      {/* West Wall - Split into segments if there's a door */}
      {hasWestConnection ? (
        <>
          {/* Top segment */}
          <RigidBody type="fixed" colliders="trimesh">
            <mesh
              position={[-room.size / 2, wallHeight / 2, -room.size / 4]}
              castShadow
            >
              <boxGeometry
                args={[
                  wallThickness,
                  wallHeight,
                  room.size / 2 - doorWidth / 2,
                ]}
              />
              <meshLambertMaterial color="#8B4513" />
            </mesh>
          </RigidBody>
          {/* Bottom segment */}
          <RigidBody type="fixed" colliders="trimesh">
            <mesh
              position={[-room.size / 2, wallHeight / 2, room.size / 4]}
              castShadow
            >
              <boxGeometry
                args={[
                  wallThickness,
                  wallHeight,
                  room.size / 2 - doorWidth / 2,
                ]}
              />
              <meshLambertMaterial color="#8B4513" />
            </mesh>
          </RigidBody>
        </>
      ) : (
        <RigidBody type="fixed" colliders="trimesh">
          <mesh position={[-room.size / 2, wallHeight / 2, 0]} castShadow>
            <boxGeometry args={[wallThickness, wallHeight, room.size]} />
            <meshLambertMaterial color="#8B4513" />
          </mesh>
        </RigidBody>
      )}

      {/* Current Room Indicator */}
      <mesh position={[0, roomHeight + 0.5, 0]}>
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshLambertMaterial
          color={isCurrent ? "#FFEB3B" : roomColor}
          transparent
          opacity={isCurrent ? 1 : 0.7}
        />
      </mesh>

      {/* Room Type Icon */}
      {room.type !== RoomTypeValues.NORMAL && (
        <mesh position={[0, roomHeight + 0.8, 0]}>
          <boxGeometry args={[0.2, 0.2, 0.2]} />
          <meshLambertMaterial color="#FFFFFF" />
        </mesh>
      )}

      {/* Room Type Label */}
      <mesh position={[0, roomHeight + 1.2, 0]}>
        <planeGeometry args={[2, 0.5]} />
        <meshLambertMaterial color="#FFFFFF" transparent opacity={0.8} />
      </mesh>

      {/* Enhanced Room Features */}
      {isCurrent && (
        <>
          {/* Items in room */}
          {(room as any).items?.map((item: Item, index: number) => (
            <ItemSprite
              key={item.id}
              item={item}
              position={
                [
                  ((index % 3) - 1) * 2,
                  roomHeight + 0.5,
                  Math.floor(index / 3) * 2 - 1,
                ] as [number, number, number]
              }
              scale={0.5}
              onClick={() => {
                console.log(`Picked up ${item.name}`);
                // Handle item pickup
              }}
            />
          ))}

          {/* Puzzle in room */}
          {(room as any).puzzle && (
            <PuzzleGrid
              puzzle={(room as any).puzzle}
              onTileClick={(tile) => {
                console.log(`Clicked tile: ${tile.id}`);
                // Handle puzzle tile click
              }}
              onComplete={() => {
                console.log("Puzzle completed!");
                // Handle puzzle completion
              }}
            />
          )}

          {/* Special room effects */}
          {(room as any).specialProperties && (
            <group position={[0, roomHeight + 2, 0]}>
              {/* Special room indicator */}
              <mesh>
                <sphereGeometry args={[0.2, 8, 8]} />
                <meshBasicMaterial color="#FFD700" transparent opacity={0.8} />
              </mesh>
            </group>
          )}
        </>
      )}
    </group>
  );
};

export default Room;
