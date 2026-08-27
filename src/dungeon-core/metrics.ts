import { hashValue } from "./identity";
import type {
  Dungeon,
  DungeonConnection,
  DungeonMetrics,
  DungeonRoom,
} from "./types";

export type DungeonMetricsInput = Pick<
  Dungeon,
  | "bossRoomId"
  | "config"
  | "connections"
  | "endRoomId"
  | "rooms"
  | "startRoomId"
>;

interface AdjacencyEntry {
  readonly edgeId: string;
  readonly neighbor: string;
}

export function computeDungeonMetrics(dungeon: DungeonMetricsInput): DungeonMetrics {
  const adjacency = adjacencyMap(dungeon.rooms, dungeon.connections);
  const components = connectedComponents(adjacency);
  const degrees = dungeon.rooms.map((room) => adjacency.get(room.id)?.length ?? 0);
  const degreeHistogram: Record<string, number> = {};
  for (const degree of [...degrees].sort((left, right) => left - right)) {
    degreeHistogram[String(degree)] = (degreeHistogram[String(degree)] ?? 0) + 1;
  }

  const distancesByRoom = new Map<string, ReadonlyMap<string, number>>();
  for (const room of dungeon.rooms) {
    distancesByRoom.set(room.id, breadthFirstDistances(room.id, adjacency));
  }
  let graphDiameter = 0;
  for (const distances of distancesByRoom.values()) {
    for (const distance of distances.values()) graphDiameter = Math.max(graphDiameter, distance);
  }
  const startDistances = distancesByRoom.get(dungeon.startRoomId) ?? new Map();
  const startToEndDistance = startDistances.get(dungeon.endRoomId) ?? -1;
  const criticalPathLength = Math.max(
    0,
    ...dungeon.rooms.map((room) => (room.criticalPathIndex ?? -1) + 1),
  );
  const branchDepths = dungeon.rooms
    .filter((room) => room.branchDepth > 0)
    .map((room) => room.branchDepth)
    .sort((left, right) => left - right);
  const maximumProgressionDepth = Math.max(
    1,
    ...dungeon.rooms.map((room) => room.progressionDepth),
  );
  const boss = dungeon.rooms.find((room) => room.id === dungeon.bossRoomId);
  const topologyHash = computeTopologyHash(dungeon);
  const spatialHash = computeSpatialHash(dungeon);
  const graphCuts = articulationAndBridges(dungeon.rooms, dungeon.connections, adjacency);

  const corridorLengths = dungeon.connections
    .map((connection) => connection.corridor?.cells.length ?? 0)
    .filter((length) => length > 0);
  const corridorTotal = sum(corridorLengths);
  const corridorCellUses = new Map<string, number>();
  const routeStretches: number[] = [];
  for (const connection of dungeon.connections) {
    if (!connection.corridor) continue;
    for (const cell of connection.corridor.cells) {
      const key = `${cell.floor}:${cell.x}:${cell.z}`;
      corridorCellUses.set(key, (corridorCellUses.get(key) ?? 0) + 1);
    }
    const cells = connection.corridor.cells;
    const start = cells[0];
    const end = cells[cells.length - 1];
    const direct = Math.abs(start.x - end.x) + Math.abs(start.z - end.z);
    routeStretches.push(direct === 0 ? 1 : (cells.length - 1) / direct);
  }
  const corridorIntersections = [...corridorCellUses.values()]
    .filter((uses) => uses > 1)
    .reduce((total, uses) => total + uses - 1, 0);

  const areas = dungeon.rooms.map((room) => room.footprint.cells.length);
  const allCells = dungeon.rooms.flatMap((room) => room.footprint.cells);
  const occupiedArea = sum(areas);
  const boundingVolume = allCells.length === 0
    ? 1
    : (Math.max(...allCells.map((cell) => cell.x)) - Math.min(...allCells.map((cell) => cell.x)) + 1)
      * (Math.max(...allCells.map((cell) => cell.z)) - Math.min(...allCells.map((cell) => cell.z)) + 1)
      * (Math.max(...allCells.map((cell) => cell.floor))
        - Math.min(...allCells.map((cell) => cell.floor))
        + 1);

  const keyLockDistances: number[] = [];
  for (const connection of dungeon.connections) {
    for (const item of connection.traversal.requiredItems) {
      const providers = dungeon.rooms.filter((room) => room.grants.items.includes(item));
      const distances = providers.flatMap((provider) => {
        const fromProvider = distancesByRoom.get(provider.id) ?? new Map();
        return [
          fromProvider.get(connection.from.roomId),
          fromProvider.get(connection.to.roomId),
        ].filter((distance): distance is number => distance !== undefined);
      });
      if (distances.length > 0) keyLockDistances.push(Math.min(...distances));
    }
  }

  let archetypeRepetitions = 0;
  let biomeRepetitions = 0;
  let biomeTransitions = 0;
  let transitions = 0;
  const roomById = new Map(dungeon.rooms.map((room) => [room.id, room]));
  for (const connection of dungeon.connections) {
    const from = roomById.get(connection.from.roomId);
    const to = roomById.get(connection.to.roomId);
    if (!from || !to) continue;
    if (from.archetype === to.archetype) archetypeRepetitions += 1;
    else transitions += 1;
    if (from.biome === to.biome) biomeRepetitions += 1;
    else biomeTransitions += 1;
  }

  return {
    archetypeRepetitions,
    archetypeSpacing: {
      rest: spacingForArchetype("rest", dungeon.rooms, distancesByRoom),
      reward: spacingForArchetype("treasure", dungeon.rooms, distancesByRoom),
      shop: spacingForArchetype("shop", dungeon.rooms, distancesByRoom),
    },
    articulationPoints: graphCuts.articulationPoints,
    biomeRepetitions,
    biomeTransitions,
    bossNormalizedDepth: round((boss?.progressionDepth ?? 0) / maximumProgressionDepth),
    branchDepths,
    bridgeEdges: graphCuts.bridgeEdges,
    compactness: round(occupiedArea / boundingVolume),
    componentCount: components.length,
    corridorIntersections,
    corridorLength: {
      max: corridorLengths.length > 0 ? Math.max(...corridorLengths) : 0,
      mean: mean(corridorLengths),
      total: corridorTotal,
    },
    corridorTurns: sum(
      dungeon.connections.map((connection) => connection.corridor?.turns ?? 0),
    ),
    criticalPathLength,
    cycleRank: dungeon.connections.length - dungeon.rooms.length + components.length,
    deadEndCount: degrees.filter((degree) => degree === 1).length,
    degreeHistogram,
    edgeCount: dungeon.connections.length,
    footprintArea: {
      max: areas.length > 0 ? Math.max(...areas) : 0,
      mean: mean(areas),
      min: areas.length > 0 ? Math.min(...areas) : 0,
    },
    graphDiameter,
    keyLockDistances: keyLockDistances.sort((left, right) => left - right),
    maxBranchDepth: branchDepths.length > 0 ? Math.max(...branchDepths) : 0,
    nodeCount: dungeon.rooms.length,
    optionalContentRatio: round(
      dungeon.rooms.filter((room) => !room.mandatory).length
        / Math.max(1, dungeon.rooms.length),
    ),
    reachableFromStart: startDistances.size,
    routeStretch: {
      max: routeStretches.length > 0 ? round(Math.max(...routeStretches)) : 0,
      mean: mean(routeStretches),
    },
    spatialHash,
    startToEndDistance,
    topologyHash,
    transitions,
    utilization: round(
      occupiedArea
        / (dungeon.config.world.width
          * dungeon.config.world.depth
          * dungeon.config.world.floors),
    ),
  };
}

function computeTopologyHash(dungeon: DungeonMetricsInput): string {
  return hashValue({
    connections: [...dungeon.connections]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((connection) => ({
        from: connection.from.roomId,
        id: connection.id,
        kind: connection.kind,
        mandatory: connection.mandatory,
        secret: connection.secret,
        shortcut: connection.shortcut,
        to: connection.to.roomId,
        traversal: connection.traversal,
      })),
    rooms: [...dungeon.rooms]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((room) => ({
        archetype: room.archetype,
        biome: room.biome,
        branchDepth: room.branchDepth,
        grants: room.grants,
        id: room.id,
        mandatory: room.mandatory,
        progressionDepth: room.progressionDepth,
        role: room.role,
        shape: room.shape,
      })),
  });
}

function computeSpatialHash(dungeon: DungeonMetricsInput): string {
  return hashValue({
    connections: [...dungeon.connections]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((connection) => ({
        corridor: connection.corridor?.cells ?? null,
        from: connection.from,
        id: connection.id,
        to: connection.to,
        vertical: connection.vertical,
      })),
    rooms: [...dungeon.rooms]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((room) => ({
        footprint: room.footprint,
        id: room.id,
        templateId: room.templateId,
        transform: room.transform,
      })),
  });
}

function adjacencyMap(
  rooms: readonly DungeonRoom[],
  connections: readonly DungeonConnection[],
): Map<string, AdjacencyEntry[]> {
  const result = new Map(rooms.map((room) => [room.id, [] as AdjacencyEntry[]]));
  for (const connection of connections) {
    result.get(connection.from.roomId)?.push({
      edgeId: connection.id,
      neighbor: connection.to.roomId,
    });
    result.get(connection.to.roomId)?.push({
      edgeId: connection.id,
      neighbor: connection.from.roomId,
    });
  }
  for (const entries of result.values()) {
    entries.sort(
      (left, right) =>
        left.neighbor.localeCompare(right.neighbor) || left.edgeId.localeCompare(right.edgeId),
    );
  }
  return result;
}

function connectedComponents(
  adjacency: ReadonlyMap<string, readonly AdjacencyEntry[]>,
): string[][] {
  const remaining = new Set(adjacency.keys());
  const result: string[][] = [];
  for (const start of [...remaining].sort()) {
    if (!remaining.has(start)) continue;
    const component: string[] = [];
    const queue = [start];
    remaining.delete(start);
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      component.push(current);
      for (const { neighbor } of adjacency.get(current) ?? []) {
        if (remaining.delete(neighbor)) queue.push(neighbor);
      }
    }
    result.push(component.sort());
  }
  return result;
}

function breadthFirstDistances(
  start: string,
  adjacency: ReadonlyMap<string, readonly AdjacencyEntry[]>,
): Map<string, number> {
  const result = new Map([[start, 0]]);
  const queue = [start];
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const { neighbor } of adjacency.get(current) ?? []) {
      if (!result.has(neighbor)) {
        result.set(neighbor, result.get(current)! + 1);
        queue.push(neighbor);
      }
    }
  }
  return result;
}

function articulationAndBridges(
  rooms: readonly DungeonRoom[],
  connections: readonly DungeonConnection[],
  adjacency: ReadonlyMap<string, readonly AdjacencyEntry[]>,
): Readonly<{ articulationPoints: readonly string[]; bridgeEdges: readonly string[] }> {
  const discovery = new Map<string, number>();
  const low = new Map<string, number>();
  const articulation = new Set<string>();
  const bridges = new Set<string>();
  let time = 0;

  const visit = (roomId: string, parentEdgeId: string | null): void => {
    time += 1;
    discovery.set(roomId, time);
    low.set(roomId, time);
    let children = 0;
    for (const entry of adjacency.get(roomId) ?? []) {
      if (entry.edgeId === parentEdgeId) continue;
      if (!discovery.has(entry.neighbor)) {
        children += 1;
        visit(entry.neighbor, entry.edgeId);
        low.set(roomId, Math.min(low.get(roomId)!, low.get(entry.neighbor)!));
        if (parentEdgeId === null && children > 1) articulation.add(roomId);
        if (parentEdgeId !== null && low.get(entry.neighbor)! >= discovery.get(roomId)!) {
          articulation.add(roomId);
        }
        if (low.get(entry.neighbor)! > discovery.get(roomId)!) bridges.add(entry.edgeId);
      } else {
        low.set(roomId, Math.min(low.get(roomId)!, discovery.get(entry.neighbor)!));
      }
    }
  };

  for (const room of [...rooms].sort((left, right) => left.id.localeCompare(right.id))) {
    if (!discovery.has(room.id)) visit(room.id, null);
  }
  const validEdgeIds = new Set(connections.map((connection) => connection.id));
  return {
    articulationPoints: [...articulation].sort(),
    bridgeEdges: [...bridges].filter((id) => validEdgeIds.has(id)).sort(),
  };
}

function spacingForArchetype(
  archetype: DungeonRoom["archetype"],
  rooms: readonly DungeonRoom[],
  distancesByRoom: ReadonlyMap<string, ReadonlyMap<string, number>>,
): number[] {
  const selected = rooms
    .filter((room) => room.archetype === archetype)
    .sort(
      (left, right) =>
        left.progressionDepth - right.progressionDepth || left.id.localeCompare(right.id),
    );
  const spacings: number[] = [];
  for (let index = 1; index < selected.length; index += 1) {
    const distance = distancesByRoom.get(selected[index - 1].id)?.get(selected[index].id);
    if (distance !== undefined) spacings.push(distance);
  }
  return spacings;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : round(sum(values) / values.length);
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
