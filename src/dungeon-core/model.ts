import { deepFreeze } from "./config";
import type {
  Dungeon,
  DungeonConnection,
  DungeonRoom,
  DungeonRunState,
  Socket,
} from "./types";

export function createDungeonRunState(dungeon: Dungeon): DungeonRunState {
  const startRoom = getDungeonRoom(dungeon, dungeon.startRoomId);
  return {
    completedRoomIds: new Set<string>(),
    currentFloor: startRoom.transform.origin.floor,
    currentRoomId: startRoom.id,
    flags: new Set(startRoom.grants.flags),
    inventory: new Set(startRoom.grants.items),
    openedConnectionIds: new Set<string>(),
    visitedRoomIds: new Set([startRoom.id]),
  };
}

export function enterDungeonRoom(
  dungeon: Dungeon,
  state: DungeonRunState,
  roomId: string,
): DungeonRunState {
  const room = getDungeonRoom(dungeon, roomId);
  return {
    ...state,
    currentFloor: room.transform.origin.floor,
    currentRoomId: room.id,
    flags: new Set([...state.flags, ...room.grants.flags]),
    inventory: new Set([...state.inventory, ...room.grants.items]),
    visitedRoomIds: new Set([...state.visitedRoomIds, room.id]),
  };
}

export function getDungeonRoom(dungeon: Dungeon, roomId: string): DungeonRoom {
  const room = dungeon.rooms.find((candidate) => candidate.id === roomId);
  if (!room) {
    throw new Error(`Dungeon does not contain room ${roomId}`);
  }
  return room;
}

export function getDungeonConnection(
  dungeon: Dungeon,
  connectionId: string,
): DungeonConnection {
  const connection = dungeon.connections.find((candidate) => candidate.id === connectionId);
  if (!connection) {
    throw new Error(`Dungeon does not contain connection ${connectionId}`);
  }
  return connection;
}

export function getRoomSocket(room: DungeonRoom, socketId: string): Socket {
  const socket = room.sockets.find((candidate) => candidate.id === socketId);
  if (!socket) {
    throw new Error(`Room ${room.id} does not contain socket ${socketId}`);
  }
  return socket;
}

export function getRoomConnections(
  dungeon: Dungeon,
  roomId: string,
): readonly DungeonConnection[] {
  return dungeon.connections.filter(
    (connection) => connection.from.roomId === roomId || connection.to.roomId === roomId,
  );
}

export function freezeDungeon(dungeon: Dungeon): Dungeon {
  return deepFreeze(dungeon);
}
