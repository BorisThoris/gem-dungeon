import { deepFreeze } from "../dungeon-core/config";
import { cellKey, compareGridCells } from "../dungeon-core/identity";
import {
  gridCellToWorld,
  isGridCellInBounds,
  type WorldPosition,
} from "../dungeon-core/spatial";
import type {
  ConnectionKind,
  Dungeon,
  DungeonConnection,
  DungeonRoom,
  GridCell,
  GridVector,
  MissionRole,
  RoomArchetype,
  RoomShape,
  TraversalRule,
} from "../dungeon-core/types";

export type CanonicalTileKind = "room" | "corridor";
export type CanonicalWallAxis = "x" | "z";

export interface CanonicalFloorTile {
  readonly cell: GridCell;
  readonly connectionIds: readonly string[];
  readonly id: string;
  readonly kind: CanonicalTileKind;
  readonly materialKey: string;
  readonly position: WorldPosition;
  readonly roomId: string | null;
}

export interface CanonicalWallSegment {
  readonly axis: CanonicalWallAxis;
  readonly cell: GridCell;
  readonly id: string;
  readonly materialKey: string;
  readonly normal: GridVector;
  readonly position: WorldPosition;
  readonly roomId: string | null;
}

/** Stable semantic anchors for deterministic texture/model population. */
export interface CanonicalRoomAssetAnchor {
  readonly archetype: RoomArchetype;
  readonly biome: string;
  readonly floor: number;
  readonly id: string;
  readonly materialKey: string;
  readonly position: WorldPosition;
  readonly role: MissionRole;
  readonly roomId: string;
  readonly rotationY: number;
  readonly shape: RoomShape;
  readonly tags: readonly string[];
}

export interface CanonicalConnectionPath {
  readonly connectionId: string;
  readonly fromRoomId: string;
  readonly kind: ConnectionKind;
  readonly mandatory: boolean;
  readonly points: readonly WorldPosition[];
  readonly secret: boolean;
  readonly shortcut: boolean;
  readonly toRoomId: string;
  readonly traversal: TraversalRule;
}

export interface CanonicalConnectionGate {
  readonly axis: CanonicalWallAxis;
  readonly connectionId: string;
  readonly endpoint: "from" | "to";
  readonly fromRoomId: string;
  readonly id: string;
  readonly kind: ConnectionKind;
  readonly normal: GridVector;
  readonly position: WorldPosition;
  readonly toRoomId: string;
  readonly traversal: TraversalRule;
}

export interface CanonicalTraversalEndpoint {
  readonly floor: number;
  readonly position: WorldPosition;
  readonly roomId: string;
  readonly socketId: string;
}

export interface CanonicalTraversalLink {
  readonly connectionId: string;
  readonly from: CanonicalTraversalEndpoint;
  readonly kind: Extract<ConnectionKind, "portal" | "stairs" | "elevator" | "drop" | "ladder">;
  readonly to: CanonicalTraversalEndpoint;
  readonly traversal: TraversalRule;
}

export interface CanonicalDungeonGeometry {
  readonly assetAnchors: readonly CanonicalRoomAssetAnchor[];
  readonly connectionGates: readonly CanonicalConnectionGate[];
  readonly connectionPaths: readonly CanonicalConnectionPath[];
  readonly floorTiles: readonly CanonicalFloorTile[];
  readonly spawn: WorldPosition;
  readonly traversalLinks: readonly CanonicalTraversalLink[];
  readonly walls: readonly CanonicalWallSegment[];
}

interface MutableTile {
  cell: GridCell;
  connectionIds: Set<string>;
  kind: CanonicalTileKind;
  materialKey: string;
  roomId: string | null;
}

const CARDINAL_DIRECTIONS: readonly GridVector[] = [
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 0, z: -1 },
  { x: 0, y: 0, z: 1 },
  { x: 1, y: 0, z: 0 },
];

export function canonicalDungeonToGeometry(dungeon: Dungeon): CanonicalDungeonGeometry {
  const mutableTiles = collectWalkableTiles(dungeon);
  const floorTiles = [...mutableTiles.values()]
    .sort((left, right) => compareGridCells(left.cell, right.cell))
    .map((tile): CanonicalFloorTile => ({
      cell: tile.cell,
      connectionIds: [...tile.connectionIds].sort(),
      id: `tile:${cellKey(tile.cell)}`,
      kind: tile.kind,
      materialKey: tile.materialKey,
      position: gridCellToWorld(tile.cell, dungeon.config),
      roomId: tile.roomId,
    }));
  const wallHeight = Math.min(
    dungeon.config.world.floorHeight * 0.48,
    dungeon.config.world.cellSize,
  );
  const walls = createBoundaryWalls(
    dungeon,
    mutableTiles,
    collectOpenAdjacencies(dungeon),
    wallHeight,
  );
  const start = getRoom(dungeon, dungeon.startRoomId);
  const startPosition = roomCentroid(start, dungeon);

  return deepFreeze({
    assetAnchors: dungeon.rooms
      .map((room) => roomAssetAnchor(room, dungeon))
      .sort((left, right) => left.roomId.localeCompare(right.roomId)),
    connectionPaths: dungeon.connections
      .map((connection) => connectionPath(connection, dungeon))
      .sort((left, right) => left.connectionId.localeCompare(right.connectionId)),
    connectionGates: dungeon.connections
      .filter((connection) => connection.kind !== "portal" && connection.vertical === null)
      .flatMap((connection) => connectionGates(connection, dungeon, wallHeight))
      .sort((left, right) => left.connectionId.localeCompare(right.connectionId)),
    floorTiles,
    spawn: {
      ...startPosition,
      y: startPosition.y + Math.max(1.25, dungeon.config.world.cellSize * 0.375),
    },
    traversalLinks: dungeon.connections
      .filter(isTraversalLink)
      .map((connection) => traversalLink(connection, dungeon))
      .sort((left, right) => left.connectionId.localeCompare(right.connectionId)),
    walls,
  });
}

function connectionGates(
  connection: DungeonConnection,
  dungeon: Dungeon,
  wallHeight: number,
): readonly CanonicalConnectionGate[] {
  return (["from", "to"] as const).map((endpoint) => {
    const reference = connection[endpoint];
    const socket = getSocket(dungeon, reference.roomId, reference.socketId);
    return connectionGate(connection, endpoint, socket, dungeon, wallHeight);
  });
}

function connectionGate(
  connection: DungeonConnection,
  endpoint: "from" | "to",
  socket: ReturnType<typeof getSocket>,
  dungeon: Dungeon,
  wallHeight: number,
): CanonicalConnectionGate {
  if (socket.normal.y !== 0) {
    throw new Error(`Horizontal connection ${connection.id} uses a vertical socket`);
  }
  const center = gridCellToWorld(socket.cell, dungeon.config);
  return {
    axis: socket.normal.x === 0 ? "x" : "z",
    connectionId: connection.id,
    endpoint,
    fromRoomId: connection.from.roomId,
    id: `gate:${connection.id}:${endpoint}`,
    kind: connection.kind,
    normal: socket.normal,
    position: {
      x: center.x + socket.normal.x * dungeon.config.world.cellSize / 2,
      y: center.y + wallHeight / 2,
      z: center.z + socket.normal.z * dungeon.config.world.cellSize / 2,
    },
    toRoomId: connection.to.roomId,
    traversal: connection.traversal,
  };
}

function collectWalkableTiles(dungeon: Dungeon): Map<string, MutableTile> {
  const tiles = new Map<string, MutableTile>();
  for (const room of dungeon.rooms) {
    for (const cell of room.footprint.cells) {
      const key = cellKey(cell);
      if (tiles.has(key)) {
        throw new Error(`Canonical geometry received overlapping room cell ${key}`);
      }
      tiles.set(key, {
        cell,
        connectionIds: new Set(),
        kind: "room",
        materialKey: `room:${room.biome}:${room.archetype}`,
        roomId: room.id,
      });
    }
  }
  for (const connection of dungeon.connections) {
    for (const cell of connection.corridor?.cells ?? []) {
      addConnectionTile(tiles, cell, connection, dungeon);
    }
  }
  return tiles;
}

function addConnectionTile(
  tiles: Map<string, MutableTile>,
  cell: GridCell,
  connection: DungeonConnection,
  dungeon: Dungeon,
): void {
  if (!isGridCellInBounds(cell, dungeon.config)) {
    throw new Error(`Canonical corridor cell ${cellKey(cell)} is out of bounds`);
  }
  const key = cellKey(cell);
  const existing = tiles.get(key);
  if (existing) {
    existing.connectionIds.add(connection.id);
    return;
  }
  tiles.set(key, {
    cell,
    connectionIds: new Set([connection.id]),
    kind: "corridor",
    materialKey: `corridor:${connection.kind}`,
    roomId: null,
  });
}

function createBoundaryWalls(
  dungeon: Dungeon,
  tiles: ReadonlyMap<string, MutableTile>,
  openAdjacencies: ReadonlySet<string>,
  wallHeight: number,
): readonly CanonicalWallSegment[] {
  const walls: CanonicalWallSegment[] = [];
  const cellSize = dungeon.config.world.cellSize;
  for (const tile of tiles.values()) {
    const center = gridCellToWorld(tile.cell, dungeon.config);
    for (const normal of CARDINAL_DIRECTIONS) {
      const neighbor = {
        floor: tile.cell.floor,
        x: tile.cell.x + normal.x,
        z: tile.cell.z + normal.z,
      };
      const neighborKey = cellKey(neighbor);
      if (tiles.has(neighborKey)) {
        if (openAdjacencies.has(adjacencyKey(tile.cell, neighbor))) continue;
        if (cellKey(tile.cell).localeCompare(neighborKey) > 0) continue;
      }
      const side = directionName(normal);
      walls.push({
        axis: normal.x === 0 ? "x" : "z",
        cell: tile.cell,
        id: `wall:${cellKey(tile.cell)}:${side}`,
        materialKey: tile.roomId
          ? `${tile.materialKey}:wall`
          : "corridor:wall",
        normal,
        position: {
          x: center.x + normal.x * cellSize / 2,
          y: center.y + wallHeight / 2,
          z: center.z + normal.z * cellSize / 2,
        },
        roomId: tile.roomId,
      });
    }
  }
  return walls.sort((left, right) => left.id.localeCompare(right.id));
}

function collectOpenAdjacencies(dungeon: Dungeon): ReadonlySet<string> {
  const open = new Set<string>();
  for (const room of dungeon.rooms) {
    const footprintCells = new Set(room.footprint.cells.map(cellKey));
    for (const cell of room.footprint.cells) {
      for (const direction of CARDINAL_DIRECTIONS) {
        const neighbor = {
          floor: cell.floor,
          x: cell.x + direction.x,
          z: cell.z + direction.z,
        };
        if (footprintCells.has(cellKey(neighbor))) {
          open.add(adjacencyKey(cell, neighbor));
        }
      }
    }
  }
  for (const connection of dungeon.connections) {
    if (!connection.corridor) continue;
    const fromSocket = getSocket(dungeon, connection.from.roomId, connection.from.socketId);
    const toSocket = getSocket(dungeon, connection.to.roomId, connection.to.socketId);
    const path = [fromSocket.cell, ...connection.corridor.cells, toSocket.cell];
    for (let index = 1; index < path.length; index += 1) {
      if (cellKey(path[index - 1]) !== cellKey(path[index])) {
        open.add(adjacencyKey(path[index - 1], path[index]));
      }
    }
  }
  return open;
}

function adjacencyKey(left: GridCell, right: GridCell): string {
  return [cellKey(left), cellKey(right)].sort().join("|");
}

function roomAssetAnchor(
  room: DungeonRoom,
  dungeon: Dungeon,
): CanonicalRoomAssetAnchor {
  return {
    archetype: room.archetype,
    biome: room.biome,
    floor: room.transform.origin.floor,
    id: `asset-anchor:${room.id}`,
    materialKey: `room:${room.biome}:${room.archetype}`,
    position: roomCentroid(room, dungeon),
    role: room.role,
    roomId: room.id,
    rotationY: room.transform.rotation * Math.PI / 180,
    shape: room.shape,
    tags: [...room.tags],
  };
}

function connectionPath(
  connection: DungeonConnection,
  dungeon: Dungeon,
): CanonicalConnectionPath {
  const fromSocket = getSocket(dungeon, connection.from.roomId, connection.from.socketId);
  const toSocket = getSocket(dungeon, connection.to.roomId, connection.to.socketId);
  const cells = [
    fromSocket.cell,
    ...(connection.corridor?.cells ?? []),
    toSocket.cell,
  ];
  const uniqueCells = cells.filter(
    (cell, index) => index === 0 || cellKey(cell) !== cellKey(cells[index - 1]),
  );
  return {
    connectionId: connection.id,
    fromRoomId: connection.from.roomId,
    kind: connection.kind,
    mandatory: connection.mandatory,
    points: uniqueCells.map((cell) => gridCellToWorld(cell, dungeon.config)),
    secret: connection.secret,
    shortcut: connection.shortcut,
    toRoomId: connection.to.roomId,
    traversal: connection.traversal,
  };
}

function isTraversalLink(
  connection: DungeonConnection,
): connection is DungeonConnection & {
  kind: CanonicalTraversalLink["kind"];
} {
  return connection.kind === "portal" || connection.vertical !== null;
}

function traversalLink(
  connection: DungeonConnection & { kind: CanonicalTraversalLink["kind"] },
  dungeon: Dungeon,
): CanonicalTraversalLink {
  const fromSocket = getSocket(dungeon, connection.from.roomId, connection.from.socketId);
  const toSocket = getSocket(dungeon, connection.to.roomId, connection.to.socketId);
  return {
    connectionId: connection.id,
    from: {
      floor: fromSocket.cell.floor,
      position: gridCellToWorld(fromSocket.cell, dungeon.config),
      roomId: connection.from.roomId,
      socketId: fromSocket.id,
    },
    kind: connection.kind,
    to: {
      floor: toSocket.cell.floor,
      position: gridCellToWorld(toSocket.cell, dungeon.config),
      roomId: connection.to.roomId,
      socketId: toSocket.id,
    },
    traversal: connection.traversal,
  };
}

function roomCentroid(room: DungeonRoom, dungeon: Dungeon): WorldPosition {
  const positions = room.footprint.cells.map((cell) =>
    gridCellToWorld(cell, dungeon.config));
  return {
    x: positions.reduce((sum, position) => sum + position.x, 0) / positions.length,
    y: positions.reduce((sum, position) => sum + position.y, 0) / positions.length,
    z: positions.reduce((sum, position) => sum + position.z, 0) / positions.length,
  };
}

function getRoom(dungeon: Dungeon, roomId: string): DungeonRoom {
  const room = dungeon.rooms.find((candidate) => candidate.id === roomId);
  if (!room) throw new Error(`Canonical geometry cannot find room ${roomId}`);
  return room;
}

function getSocket(dungeon: Dungeon, roomId: string, socketId: string) {
  const socket = getRoom(dungeon, roomId).sockets.find(
    (candidate) => candidate.id === socketId,
  );
  if (!socket) throw new Error(`Canonical geometry cannot find socket ${socketId}`);
  return socket;
}

function directionName(normal: GridVector): string {
  if (normal.x === -1) return "west";
  if (normal.x === 1) return "east";
  if (normal.z === -1) return "north";
  if (normal.z === 1) return "south";
  throw new Error("Boundary wall normal must be horizontal");
}
