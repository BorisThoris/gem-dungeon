import React from "react";
import { RigidBody } from "@react-three/rapier";
import type { Room as RoomType, Item, RoomType as RoomTypeName } from "../types/map";
import { RoomType as RoomTypeValues } from "../types/map";
import ItemSprite from "./ItemSprite";
import PuzzleGrid from "./PuzzleGrid";
import TreasureRoom from "./rooms/TreasureRoom";
import ShopRoom from "./rooms/ShopRoom";
import PuzzleRoom from "./rooms/PuzzleRoom";
import SpecialRoom from "./rooms/SpecialRoom";
import LibraryRoom from "./rooms/LibraryRoom";
import RoomInteraction from "./RoomInteraction";
import Door from "./Door";
import DestructibleWall from "./DestructibleWall";

type SpecialRoomKind = "devil-room" | "angel-room" | "cursed-room" | "secret";

const specializedRoomTypes: RoomTypeName[] = [
  RoomTypeValues.TREASURE,
  RoomTypeValues.SHOP,
  RoomTypeValues.PUZZLE,
  RoomTypeValues.DEVIL_ROOM,
  RoomTypeValues.ANGEL_ROOM,
  RoomTypeValues.CURSED_ROOM,
  RoomTypeValues.SECRET,
  RoomTypeValues.LIBRARY,
];

interface RoomProps {
  room: RoomType;
  isCurrent: boolean;
  isVisited: boolean;
  connectedRooms: RoomType[];
  onClick?: () => void;
  playerPosition?: [number, number, number];
  onInteraction?: (interactionType: string, roomId: string) => void;
}

const Room: React.FC<RoomProps> = ({
  room,
  isCurrent,
  isVisited,
  connectedRooms,
  onClick,
  playerPosition = [0, 0, 0],
  onInteraction,
}) => {
  const getDoorPosition = (
    _room: RoomType,
    _connection: string,
    index: number
  ) => {
    const roomSize = 8;
    const positions = [
      {
        position: [roomSize / 2, 1.5, 0] as [number, number, number],
        rotation: [0, Math.PI / 2, 0] as [number, number, number],
      }, // Right
      {
        position: [-roomSize / 2, 1.5, 0] as [number, number, number],
        rotation: [0, -Math.PI / 2, 0] as [number, number, number],
      }, // Left
      {
        position: [0, 1.5, roomSize / 2] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
      }, // Front
      {
        position: [0, 1.5, -roomSize / 2] as [number, number, number],
        rotation: [0, Math.PI, 0] as [number, number, number],
      }, // Back
    ];
    return positions[index % positions.length];
  };

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

      {/* Simple visual indicator for special rooms */}
      {room.type !== RoomTypeValues.NORMAL &&
        room.type !== RoomTypeValues.START &&
        room.type !== RoomTypeValues.END && (
          <mesh position={[0, 2, 0]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color={roomColor} />
          </mesh>
        )}

      {/* Enhanced Room Features - Always render all specialized rooms */}
      <>
        {/* Specialized Room Types */}
        {room.type === RoomTypeValues.TREASURE && (
          <TreasureRoom
            items={room.items || []}
            onItemPickup={(item) => {
              console.log(`Picked up treasure: ${item.name}`);
              // Handle treasure pickup
            }}
            isOpened={room.isOpened || false}
            onOpen={() => {
              console.log("Opened treasure chest!");
              // Handle chest opening
            }}
          />
        )}

        {room.type === RoomTypeValues.SHOP && (
          <ShopRoom
            items={room.items || []}
            onItemPurchase={(item) => {
              console.log(`Purchased: ${item.name} for ${item.cost} points`);
              // Handle item purchase
            }}
            playerPoints={100} // Get from game store
          />
        )}

        {room.type === RoomTypeValues.PUZZLE && room.puzzle && (
          <PuzzleRoom
            puzzle={room.puzzle}
            onPuzzleComplete={() => {
              console.log("Puzzle completed!");
              // Handle puzzle completion
            }}
            onTileClick={(tile) => {
              console.log(`Clicked tile: ${tile.id}`);
              // Handle puzzle tile click
            }}
            reward={room.reward}
            onRewardClaim={(item) => {
              console.log(`Claimed reward: ${item.name}`);
              // Handle reward claim
            }}
          />
        )}

        {(room.type === RoomTypeValues.DEVIL_ROOM ||
          room.type === RoomTypeValues.ANGEL_ROOM ||
          room.type === RoomTypeValues.CURSED_ROOM ||
          room.type === RoomTypeValues.SECRET) && (
          <SpecialRoom
            roomType={room.type as SpecialRoomKind}
            items={room.items || []}
            onItemInteraction={(item) => {
              console.log(`Interacted with special item: ${item.name}`);
              // Handle special item interaction
            }}
            onRoomEnter={() => {
              console.log(`Entered ${room.type}`);
              // Handle special room entry
            }}
          />
        )}

        {room.type === RoomTypeValues.LIBRARY && (
          <LibraryRoom
            books={room.books || room.items || []}
            onBookRead={(book) => {
              console.log(`Read book: ${book.name}`);
              // Handle book reading
            }}
            onKnowledgeGain={(amount) => {
              console.log(`Gained ${amount} knowledge`);
              // Handle knowledge gain
            }}
          />
        )}

        {/* Fallback for other room types */}
        {!specializedRoomTypes.includes(room.type as RoomTypeName) && (
          <>
            {/* Items in room */}
            {room.items?.map((item: Item, index: number) => (
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
            {room.puzzle && (
              <PuzzleGrid
                puzzle={room.puzzle}
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
            {room.specialProperties && (
              <group position={[0, roomHeight + 2, 0]}>
                {/* Special room indicator */}
                <mesh>
                  <sphereGeometry args={[0.2, 8, 8]} />
                  <meshBasicMaterial
                    color="#FFD700"
                    transparent
                    opacity={0.8}
                  />
                </mesh>
              </group>
            )}
          </>
        )}

        {/* Room Interaction System */}
        {onInteraction && (
          <RoomInteraction
            room={room}
            playerPosition={playerPosition}
            onInteraction={onInteraction}
          />
        )}

        {/* Doors */}
        {room.connections && room.connections.length > 0 && (
          <>
            {room.connections.map((connection, index) => {
              const doorPosition = getDoorPosition(room, connection, index);
              return (
                <Door
                  key={`door-${connection}`}
                  position={doorPosition.position}
                  rotation={doorPosition.rotation}
                  keyRequired={Math.random() > 0.7} // 30% chance of requiring key
                  keyId="master-key"
                />
              );
            })}
          </>
        )}

        {/* Destructible Walls */}
        {Math.random() > 0.8 && ( // 20% chance of having destructible walls
          <>
            <DestructibleWall
              position={[4, 1.5, 0]}
              rotation={[0, Math.PI / 2, 0]}
              bombRequired={Math.random() > 0.5}
            />
            <DestructibleWall
              position={[-4, 1.5, 0]}
              rotation={[0, -Math.PI / 2, 0]}
              bombRequired={Math.random() > 0.5}
            />
          </>
        )}
      </>
    </group>
  );
};

export default Room;
