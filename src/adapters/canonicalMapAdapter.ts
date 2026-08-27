/**
 * Temporary strangler adapter for legacy consumers. Canonical gameplay code must
 * use DungeonConnection/Socket directly; `connections: string[]` and
 * `EntryPoint.connectedTo` are emitted only at this boundary.
 */
import { gridCellToWorld } from "../dungeon-core/spatial";
import type {
  Dungeon,
  DungeonConnection,
  DungeonRoom,
  DungeonRunState,
  Socket,
} from "../dungeon-core/types";
import type {
  EntryDirection,
  EntryPoint,
  GameMap,
  MapConfig,
  Position,
  Room,
} from "../types/map";

export interface LegacyMapAdapterOptions {
  readonly generatedAt?: number;
}

export function canonicalDungeonToGameMap(
  dungeon: Dungeon,
  runState: DungeonRunState,
  options: LegacyMapAdapterOptions = {},
): GameMap {
  const generatedAt = options.generatedAt ?? 0;
  if (!Number.isFinite(generatedAt) || generatedAt < 0) {
    throw new Error("Legacy generatedAt must be a finite non-negative runtime timestamp");
  }
  const rooms = dungeon.rooms.map((room) =>
    canonicalRoomToLegacy(room, dungeon, runState),
  );
  const config: MapConfig = {
    connectionChance:
      dungeon.rooms.length < 2
        ? 0
        : dungeon.connections.length
          / ((dungeon.rooms.length * (dungeon.rooms.length - 1)) / 2),
    height: dungeon.config.world.depth,
    maxRooms: dungeon.rooms.length,
    minRooms: dungeon.rooms.length,
    roomSize: dungeon.config.world.cellSize,
    specialRoomChance: dungeon.metrics.optionalContentRatio,
    width: dungeon.config.world.width,
  };
  return {
    config,
    endRoomId: dungeon.endRoomId,
    generatedAt,
    id: `map_${dungeon.replay.spatialHash}`,
    rooms,
    startRoomId: dungeon.startRoomId,
  };
}

function canonicalRoomToLegacy(
  room: DungeonRoom,
  dungeon: Dungeon,
  runState: DungeonRunState,
): Room {
  const connections = dungeon.connections.filter(
    (connection) =>
      connection.from.roomId === room.id || connection.to.roomId === room.id,
  );
  const neighboringRoomIds = [...new Set(connections.map((connection) =>
    connection.from.roomId === room.id ? connection.to.roomId : connection.from.roomId,
  ))].sort();
  const center = roomCenter(room, dungeon);
  const widthCells = room.footprint.bounds.maxX - room.footprint.bounds.minX + 1;
  const depthCells = room.footprint.bounds.maxZ - room.footprint.bounds.minZ + 1;
  const portal = connections.find((connection) => connection.kind === "portal");
  const entryPoints = connections
    .map((connection) => legacyEntryPoint(room, connection, dungeon, center))
    .filter((entry): entry is EntryPoint => entry !== null)
    .sort((left, right) => left.id.localeCompare(right.id));

  return {
    actualSize: Math.max(widthCells, depthCells) * dungeon.config.world.cellSize,
    biomeId: room.biome,
    biomeScale: [widthCells, 1, depthCells],
    connections: neighboringRoomIds,
    entryPoints,
    height: depthCells * dungeon.config.world.cellSize,
    id: room.id,
    isCurrent: runState.currentRoomId === room.id,
    isMultiTile: room.footprint.cells.length > 1,
    isPortal: Boolean(portal),
    isVisited: runState.visitedRoomIds.has(room.id),
    portalDestination: portal
      ? portal.from.roomId === room.id
        ? portal.to.roomId
        : portal.from.roomId
      : undefined,
    position: center,
    rotation: (room.transform.rotation * Math.PI) / 180,
    shape: room.shape,
    size: dungeon.config.world.cellSize,
    specialProperties: {
      canonicalConnectionIds: connections.map((connection) => connection.id).sort(),
      canonicalFootprint: room.footprint,
      canonicalFloor: room.transform.origin.floor,
      canonicalGrants: room.grants,
      canonicalProgressionDepth: room.progressionDepth,
      canonicalRole: room.role,
      canonicalSchemaVersion: dungeon.schemaVersion,
      canonicalSocketIds: room.sockets.map((socket) => socket.id).sort(),
      canonicalTags: room.tags,
    },
    theme: room.biome,
    tilePositions: room.footprint.cells.map((cell) => {
      const world = gridCellToWorld(cell, dungeon.config);
      return { x: world.x, z: world.z };
    }),
    type: room.archetype,
    useBiomeWalls: true,
    width: widthCells * dungeon.config.world.cellSize,
  };
}

function legacyEntryPoint(
  room: DungeonRoom,
  connection: DungeonConnection,
  dungeon: Dungeon,
  center: Position,
): EntryPoint | null {
  const endpoint = connection.from.roomId === room.id ? connection.from : connection.to;
  const otherEndpoint = connection.from.roomId === room.id ? connection.to : connection.from;
  const socket = room.sockets.find((candidate) => candidate.id === endpoint.socketId);
  if (!socket || socket.normal.y !== 0) return null;
  const direction = legacyDirection(socket);
  if (!direction) return null;
  const world = gridCellToWorld(socket.cell, dungeon.config);
  return {
    connectedTo: otherEndpoint.socketId,
    direction,
    id: socket.id,
    isActive: true,
    position: { x: world.x - center.x, z: world.z - center.z },
    type:
      connection.kind === "portal"
        ? "portal"
        : connection.kind === "corridor"
          ? "corridor"
          : "door",
  };
}

function legacyDirection(socket: Socket): EntryDirection | null {
  if (socket.normal.x === 1 && socket.normal.z === 0) return "east";
  if (socket.normal.x === -1 && socket.normal.z === 0) return "west";
  if (socket.normal.x === 0 && socket.normal.z === 1) return "south";
  if (socket.normal.x === 0 && socket.normal.z === -1) return "north";
  return null;
}

function roomCenter(room: DungeonRoom, dungeon: Dungeon): Position {
  const positions = room.footprint.cells.map((cell) => gridCellToWorld(cell, dungeon.config));
  return {
    x: positions.reduce((total, position) => total + position.x, 0) / positions.length,
    z: positions.reduce((total, position) => total + position.z, 0) / positions.length,
  };
}
