import React from "react";
import useMapStore from "../store/mapStore";
import Room from "./Room";
import ConnectionLine from "./ConnectionLine";
import InteractionManager from "./InteractionManager";

const MapRenderer: React.FC = () => {
  const { currentMap, currentRoomId, visitedRooms, generateMap } =
    useMapStore();

  // Generate map on first load
  React.useEffect(() => {
    if (!currentMap) {
      generateMap();
    }
  }, [currentMap, generateMap]);

  if (!currentMap) {
    return null;
  }

  return (
    <group>
      {/* Render connection lines first (behind rooms) */}
      {currentMap.rooms.map((room) =>
        room.connections.map((connectedRoomId) => {
          const connectedRoom = currentMap.rooms.find(
            (r) => r.id === connectedRoomId
          );
          if (!connectedRoom) return null;

          return (
            <ConnectionLine
              key={`${room.id}-${connectedRoomId}`}
              from={room.position}
              to={connectedRoom.position}
              isVisited={
                visitedRooms.has(room.id) || visitedRooms.has(connectedRoomId)
              }
            />
          );
        })
      )}

      {/* Render rooms */}
      {currentMap.rooms.map((room) => {
        const connectedRooms = currentMap.rooms.filter((r) =>
          room.connections.includes(r.id)
        );

        return (
          <Room
            key={room.id}
            room={room}
            isCurrent={room.id === currentRoomId}
            isVisited={visitedRooms.has(room.id)}
            connectedRooms={connectedRooms}
            playerPosition={[0, 0, 0]} // This would be actual player position
            onInteraction={(interactionType, roomId) => {
              console.log(`Interaction: ${interactionType} in room ${roomId}`);
            }}
            onClick={() => {
              // Handle room click for navigation
              console.log(`Clicked room: ${room.id} (${room.type})`);
            }}
          />
        );
      })}

      {/* Interaction Manager */}
      <InteractionManager
        playerPosition={[0, 0, 0]} // This would be actual player position
      />
    </group>
  );
};

export default MapRenderer;
