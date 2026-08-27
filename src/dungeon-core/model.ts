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

export function canTraverseDungeonConnection(
  dungeon: Dungeon,
  state: DungeonRunState,
  connectionId: string,
  fromRoomId: string,
): boolean {
  const connection = getDungeonConnection(dungeon, connectionId);
  if (connection.from.roomId !== fromRoomId && connection.to.roomId !== fromRoomId) {
    return false;
  }
  if (
    connection.traversal.direction === "from-to"
    && connection.from.roomId !== fromRoomId
  ) return false;
  if (
    connection.traversal.direction === "to-from"
    && connection.to.roomId !== fromRoomId
  ) return false;
  if (!connection.traversal.requiredItems.every((item) => state.inventory.has(item))) {
    return false;
  }
  if (!connection.traversal.requiredFlags.every((flag) => state.flags.has(flag))) {
    return false;
  }
  if (state.openedConnectionIds.has(connection.id)) return true;
  return connection.traversal.requiredAction === null
    || connection.traversal.requiredAction === "unlock"
    || connection.traversal.requiredAction === "unlock-shortcut"
    || connection.traversal.requiredAction === "defeat-boss";
}

export function openDungeonConnection(
  dungeon: Dungeon,
  state: DungeonRunState,
  connectionId: string,
): DungeonRunState {
  const connection = getDungeonConnection(dungeon, connectionId);
  if (
    connection.from.roomId !== state.currentRoomId
    && connection.to.roomId !== state.currentRoomId
  ) {
    throw new Error(
      `Cannot open connection ${connection.id} outside either endpoint room`,
    );
  }
  if (!connection.traversal.requiredItems.every((item) => state.inventory.has(item))) {
    throw new Error(`Connection ${connection.id} is missing required inventory`);
  }
  if (!connection.traversal.requiredFlags.every((flag) => state.flags.has(flag))) {
    throw new Error(`Connection ${connection.id} is missing required flags`);
  }
  return {
    ...state,
    openedConnectionIds: new Set([...state.openedConnectionIds, connection.id]),
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
