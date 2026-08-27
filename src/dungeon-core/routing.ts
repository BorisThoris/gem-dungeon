import { deepFreeze } from "./config";
import { indexFreeSpace, type FreeSpaceIndex } from "./free-space";
import { cellKey } from "./identity";
import { OccupancyGrid } from "./occupancy";
import { createRng, type Rng, type RngStreams } from "./rng";
import type {
  ConnectionKind,
  CorridorRoute,
  DungeonConnection,
  DungeonRoom,
  DungeonSemantics,
  GenerationConfig,
  GenerationTraceEvent,
  GridCell,
  GridVector,
  MissionEdge,
  SemanticEdgeAssignment,
  Socket,
  StageResult,
  VerticalRoute,
} from "./types";

const HORIZONTAL_DIRECTIONS = [
  { id: "north", vector: { x: 0, y: 0, z: -1 } },
  { id: "east", vector: { x: 1, y: 0, z: 0 } },
  { id: "south", vector: { x: 0, y: 0, z: 1 } },
  { id: "west", vector: { x: -1, y: 0, z: 0 } },
] as const satisfies readonly Readonly<{ id: string; vector: GridVector }>[];

type HorizontalDirectionId = (typeof HORIZONTAL_DIRECTIONS)[number]["id"];

interface SearchNode {
  readonly cell: GridCell;
  readonly direction: HorizontalDirectionId | "start";
  readonly expandedOrder: number;
  readonly f: number;
  readonly g: number;
  readonly key: string;
  readonly steps: number;
}

interface SearchResult {
  readonly expandedNodes: number;
  readonly route: CorridorRoute | null;
}

interface SocketPair {
  readonly from: Socket;
  readonly order: number;
  readonly score: number;
  readonly to: Socket;
}

export interface RoutingGeneration {
  readonly connections: readonly DungeonConnection[];
  readonly expandedNodes: number;
  readonly routingAttempts: number;
}

export function routeDungeonConnections(
  semantics: DungeonSemantics,
  rooms: readonly DungeonRoom[],
  config: GenerationConfig,
  streams: RngStreams,
  attempt = 0,
): StageResult<RoutingGeneration> {
  const trace: GenerationTraceEvent[] = [];
  const occupancy = new OccupancyGrid(config);
  for (const room of rooms) {
    const reservation = occupancy.reserveRoom(room.id, room.footprint);
    if (!reservation.ok) {
      return routingFailure(
        "ROUTING_INVALID_ROOM_OCCUPANCY",
        `Room ${room.id} could not be reconstructed in canonical occupancy`,
        { conflicts: reservation.conflicts, outOfBounds: reservation.outOfBounds },
        trace,
      );
    }
  }

  const roomByNode = new Map(rooms.map((room) => [room.topologyNodeId, room]));
  const freeSpace = indexFreeSpace(config, occupancy);
  const assignmentByEdge = new Map(semantics.edges.map((edge) => [edge.edgeId, edge]));
  const usedSockets = new Map<string, string>();
  const connections: DungeonConnection[] = [];
  let expandedNodes = 0;
  let routingAttempts = 0;

  const orderedEdges = [...semantics.graph.edges].sort((left, right) => {
    const leftAssignment = assignmentByEdge.get(left.id)!;
    const rightAssignment = assignmentByEdge.get(right.id)!;
    return (
      edgePriority(left, leftAssignment) - edgePriority(right, rightAssignment)
      || left.id.localeCompare(right.id)
    );
  });

  for (const edge of orderedEdges) {
    const assignment = assignmentByEdge.get(edge.id);
    const fromRoom = roomByNode.get(edge.from);
    const toRoom = roomByNode.get(edge.to);
    if (!assignment || !fromRoom || !toRoom) {
      return routingFailure(
        "ROUTING_DANGLING_MISSION_EDGE",
        `Mission edge ${edge.id} cannot resolve rooms and semantics`,
        { edge },
        trace,
      );
    }
    const connectionId = `connection-${edge.id}`;
    const rng = createRng(
      `${streams.seed}:routing:${attempt}:${edge.id}`,
      "routing",
    );
    const pairs = compatibleSocketPairs(
      fromRoom,
      toRoom,
      assignment.kind,
      usedSockets,
      occupancy,
      freeSpace,
      rng,
    );
    if (pairs.length === 0) {
      return routingFailure(
        "ROUTING_NO_COMPATIBLE_SOCKET_PAIR",
        `No unreserved compatible sockets can materialize ${edge.id}`,
        { edgeId: edge.id, fromRoomId: fromRoom.id, kind: assignment.kind, toRoomId: toRoom.id },
        trace,
      );
    }

    let connection: DungeonConnection | null = null;
    const edgeDiagnostics = {
      overLength: 0,
      overTurns: 0,
      reservationFailures: 0,
      routesFound: 0,
      searchesFailed: 0,
    };
    if (assignment.kind === "portal") {
      const pair = pairs[0];
      connection = createConnection(
        connectionId,
        edge,
        assignment,
        pair,
        null,
        null,
      );
    } else if (isVerticalKind(assignment.kind)) {
      const pair = pairs[0];
      const vertical: VerticalRoute = { from: pair.from.cell, to: pair.to.cell };
      connection = createConnection(
        connectionId,
        edge,
        assignment,
        pair,
        null,
        vertical,
      );
    } else {
      for (const pair of pairs) {
        routingAttempts += 1;
        const search = routeAStar(
          pair.from.exteriorCell,
          pair.to.exteriorCell,
          occupancy,
          config,
        );
        expandedNodes += search.expandedNodes;
        if (!search.route) {
          edgeDiagnostics.searchesFailed += 1;
          continue;
        }
        edgeDiagnostics.routesFound += 1;
        if (
          search.route.cells.length > config.quality.maxCorridorLength
        ) {
          edgeDiagnostics.overLength += 1;
        }
        if (search.route.turns > config.quality.maxCorridorTurns) {
          edgeDiagnostics.overTurns += 1;
        }
        const reservation = occupancy.reserveCorridor(connectionId, search.route.cells);
        if (!reservation.ok) {
          edgeDiagnostics.reservationFailures += 1;
          continue;
        }
        connection = createConnection(
          connectionId,
          edge,
          assignment,
          pair,
          search.route,
          null,
        );
        break;
      }
    }

    if (!connection) {
      return routingFailure(
        "ROUTING_SOCKET_ALTERNATIVES_EXHAUSTED",
        `All ${pairs.length} compatible socket alternatives failed for ${edge.id}`,
        {
          edgeId: edge.id,
          edgeDiagnostics,
          expandedNodes,
          kind: assignment.kind,
          socketPairs: pairs.length,
        },
        trace,
      );
    }

    reserveSocket(connection.from.socketId, connection.id, fromRoom, usedSockets);
    reserveSocket(connection.to.socketId, connection.id, toRoom, usedSockets);
    connections.push(connection);
    traceBounded(trace, {
      attempt,
      candidateCount: pairs.length,
      code: "ROUTING_EDGE_MATERIALIZED",
      message: `${edge.id} became ${assignment.kind} through explicit sockets`,
      stage: "routing",
    });
  }

  const sortedConnections = connections.sort((left, right) => left.id.localeCompare(right.id));
  trace.push({
    attempt,
    code: "ROUTING_COMPLETE",
    message: `Materialized ${sortedConnections.length} connections after expanding ${expandedNodes} A* states`,
    stage: "routing",
  });
  return {
    ok: true,
    trace,
    value: deepFreeze({ connections: sortedConnections, expandedNodes, routingAttempts }),
  };
}

export function routeAStar(
  start: GridCell,
  goal: GridCell,
  occupancy: OccupancyGrid,
  config: GenerationConfig,
): SearchResult {
  if (start.floor !== goal.floor) {
    return { expandedNodes: 0, route: null };
  }
  const endpointKeys = new Set([cellKey(start), cellKey(goal)]);
  if (
    !occupancy.canRouteThrough(start, endpointKeys)
    || !occupancy.canRouteThrough(goal, endpointKeys)
  ) {
    return { expandedNodes: 0, route: null };
  }
  if (cellKey(start) === cellKey(goal)) {
    return {
      expandedNodes: 1,
      route: {
        cells: [start],
        cost: 0,
        intersections: occupancy.corridorOwnerCount(start) > 0 ? 1 : 0,
        turns: 0,
        waypoints: [start],
      },
    };
  }

  const startKey = searchKey(start, "start");
  let order = 0;
  const open = new MinHeap<SearchNode>(compareSearchNodes);
  open.push({
    cell: start,
    direction: "start",
    expandedOrder: order,
    f: weightedHeuristic(start, goal, config),
    g: 0,
    key: startKey,
    steps: 0,
  });
  const bestCost = new Map([[startKey, 0]]);
  const cameFrom = new Map<string, string>();
  const nodes = new Map<string, SearchNode>();
  let expandedNodes = 0;
  nodes.set(startKey, open.peek()!);

  while (open.size > 0 && expandedNodes < config.routing.maxExpandedNodes) {
    const current = open.pop()!;
    if (current.g !== bestCost.get(current.key)) continue;
    expandedNodes += 1;
    if (cellKey(current.cell) === cellKey(goal)) {
      const cells = reconstructCells(current.key, cameFrom, nodes);
      const turns = countTurns(cells);
      const intersections = cells.filter(
        (cell) => occupancy.corridorOwnerCount(cell) > 0,
      ).length;
      return {
        expandedNodes,
        route: {
          cells,
          cost: roundCost(current.g),
          intersections,
          turns,
          waypoints: compressWaypoints(cells),
        },
      };
    }

    for (const direction of HORIZONTAL_DIRECTIONS) {
      const next: GridCell = {
        floor: current.cell.floor,
        x: current.cell.x + direction.vector.x,
        z: current.cell.z + direction.vector.z,
      };
      const steps = current.steps + 1;
      if (!occupancy.canRouteThrough(next, endpointKeys)) {
        continue;
      }
      const nextKey = searchKey(next, direction.id);
      const nextExisting = occupancy.corridorOwnerCount(next) > 0;
      const currentExisting = occupancy.corridorOwnerCount(current.cell) > 0;
      let transitionCost = nextExisting
        ? config.routing.existingCorridorCost
        : config.routing.stepCost;
      if (nextExisting && !currentExisting && !endpointKeys.has(cellKey(next))) {
        transitionCost += config.routing.intersectionCost;
      }
      if (current.direction !== "start" && current.direction !== direction.id) {
        transitionCost += config.routing.turnCost;
      }
      transitionCost += occupancy.roomProximity(next) * config.routing.proximityCost;
      const nextCost = current.g + transitionCost;
      if (nextCost >= (bestCost.get(nextKey) ?? Infinity)) continue;

      order += 1;
      const node: SearchNode = {
        cell: next,
        direction: direction.id,
        expandedOrder: order,
        f: nextCost + weightedHeuristic(next, goal, config),
        g: nextCost,
        key: nextKey,
        steps,
      };
      bestCost.set(nextKey, nextCost);
      cameFrom.set(nextKey, current.key);
      nodes.set(nextKey, node);
      open.push(node);
    }
  }
  return { expandedNodes, route: null };
}

function compatibleSocketPairs(
  fromRoom: DungeonRoom,
  toRoom: DungeonRoom,
  kind: ConnectionKind,
  usedSockets: ReadonlyMap<string, string>,
  occupancy: OccupancyGrid,
  freeSpace: FreeSpaceIndex,
  rng: Rng,
): SocketPair[] {
  const vertical = isVerticalKind(kind);
  const floorDelta = toRoom.transform.origin.floor - fromRoom.transform.origin.floor;
  const result: SocketPair[] = [];
  for (const from of fromRoom.sockets) {
    if (
      (!from.shareable && usedSockets.has(from.id))
      || !from.allowedConnectionKinds.includes(kind)
      || (!vertical
        && kind !== "portal"
        && !socketHasRoutingEscape(from, occupancy, freeSpace))
    ) {
      continue;
    }
    for (const to of toRoom.sockets) {
      if (
        (!to.shareable && usedSockets.has(to.id))
        || !to.allowedConnectionKinds.includes(kind)
        || (!vertical
          && kind !== "portal"
          && !socketHasRoutingEscape(to, occupancy, freeSpace))
        || !compatibleCodes(from.compatibility, to.compatibility)
      ) {
        continue;
      }
      if (vertical) {
        const direction = Math.sign(floorDelta);
        if (
          Math.abs(floorDelta) !== 1
          || from.normal.y !== direction
          || to.normal.y !== -direction
          || from.cell.x !== to.cell.x
          || from.cell.z !== to.cell.z
        ) {
          continue;
        }
        result.push({ from, order: 0, score: 0, to });
      } else if (from.normal.y === 0 && to.normal.y === 0) {
        const distance = manhattan(from.exteriorCell, to.exteriorCell);
        const towardTo = {
          x: Math.sign(to.exteriorCell.x - from.exteriorCell.x),
          z: Math.sign(to.exteriorCell.z - from.exteriorCell.z),
        };
        const towardFrom = { x: -towardTo.x, z: -towardTo.z };
        const facingPenalty =
          (from.normal.x * towardTo.x + from.normal.z * towardTo.z <= 0 ? 4 : 0)
          + (to.normal.x * towardFrom.x + to.normal.z * towardFrom.z <= 0 ? 4 : 0);
        result.push({ from, order: 0, score: distance + facingPenalty, to });
      }
    }
  }
  return rng.shuffle(result).map((pair, order) => ({ ...pair, order })).sort(
    (left, right) =>
      left.score - right.score
      || left.order - right.order,
  );
}

function socketHasRoutingEscape(
  socket: Socket,
  occupancy: OccupancyGrid,
  freeSpace: FreeSpaceIndex,
): boolean {
  const outward = {
    floor: socket.exteriorCell.floor,
    x: socket.exteriorCell.x + socket.normal.x,
    z: socket.exteriorCell.z + socket.normal.z,
  };
  return (
    occupancy.canRouteThrough(outward)
    && freeSpace.componentByCell.get(cellKey(outward))
      === freeSpace.largestComponentByFloor.get(outward.floor)
  );
}

function createConnection(
  id: string,
  edge: MissionEdge,
  assignment: SemanticEdgeAssignment,
  pair: SocketPair,
  corridor: CorridorRoute | null,
  vertical: VerticalRoute | null,
): DungeonConnection {
  return deepFreeze({
    corridor,
    from: { roomId: pair.from.roomId, socketId: pair.from.id },
    id,
    kind: assignment.kind,
    mandatory: edge.mandatory,
    secret: assignment.secret,
    shortcut: assignment.shortcut,
    to: { roomId: pair.to.roomId, socketId: pair.to.id },
    topologyEdgeId: edge.id,
    traversal: assignment.traversal,
    vertical,
  });
}

function reserveSocket(
  socketId: string,
  connectionId: string,
  room: DungeonRoom,
  usedSockets: Map<string, string>,
): void {
  const socket = room.sockets.find((candidate) => candidate.id === socketId)!;
  if (!socket.shareable) usedSockets.set(socketId, connectionId);
}

function edgePriority(edge: MissionEdge, assignment: SemanticEdgeAssignment): number {
  if (edge.mandatory) return 0;
  if (isVerticalKind(assignment.kind)) return 1;
  if (assignment.kind === "portal") return 4;
  if (assignment.shortcut) return 3;
  return 2;
}

function weightedHeuristic(
  cell: GridCell,
  goal: GridCell,
  config: GenerationConfig,
): number {
  return (
    manhattan(cell, goal)
    * Math.min(config.routing.stepCost, config.routing.existingCorridorCost)
    * config.routing.heuristicWeight
  );
}

function reconstructCells(
  endKey: string,
  cameFrom: ReadonlyMap<string, string>,
  nodes: ReadonlyMap<string, SearchNode>,
): GridCell[] {
  const result: GridCell[] = [];
  let current: string | undefined = endKey;
  while (current) {
    result.push(nodes.get(current)!.cell);
    current = cameFrom.get(current);
  }
  return result.reverse();
}

function compressWaypoints(cells: readonly GridCell[]): GridCell[] {
  if (cells.length <= 2) return [...cells];
  const result = [cells[0]];
  let previousDirection = directionBetween(cells[0], cells[1]);
  for (let index = 1; index < cells.length - 1; index += 1) {
    const direction = directionBetween(cells[index], cells[index + 1]);
    if (direction !== previousDirection) result.push(cells[index]);
    previousDirection = direction;
  }
  result.push(cells[cells.length - 1]);
  return result;
}

function countTurns(cells: readonly GridCell[]): number {
  return Math.max(0, compressWaypoints(cells).length - 2);
}

function directionBetween(left: GridCell, right: GridCell): string {
  return `${right.x - left.x}:${right.z - left.z}`;
}

function searchKey(cell: GridCell, direction: HorizontalDirectionId | "start"): string {
  return `${cellKey(cell)}:${direction}`;
}

function compareSearchNodes(left: SearchNode, right: SearchNode): number {
  return (
    left.f - right.f
    || left.g - right.g
    || left.key.localeCompare(right.key)
    || left.expandedOrder - right.expandedOrder
  );
}

function compatibleCodes(left: readonly string[], right: readonly string[]): boolean {
  return left.some((code) => right.includes(code));
}

function isVerticalKind(kind: ConnectionKind): boolean {
  return kind === "stairs" || kind === "elevator" || kind === "drop" || kind === "ladder";
}

function manhattan(left: GridCell, right: GridCell): number {
  return (
    Math.abs(left.floor - right.floor)
    + Math.abs(left.x - right.x)
    + Math.abs(left.z - right.z)
  );
}

function roundCost(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function routingFailure(
  code: string,
  message: string,
  details: Readonly<Record<string, unknown>>,
  trace: readonly GenerationTraceEvent[],
): StageResult<never> {
  return {
    error: { code, details, message, stage: "routing" },
    ok: false,
    trace,
  };
}

function traceBounded(
  trace: GenerationTraceEvent[],
  event: GenerationTraceEvent,
): void {
  if (trace.length < 512) trace.push(event);
}

class MinHeap<T> {
  private readonly values: T[] = [];
  private readonly compare: (left: T, right: T) => number;

  constructor(compare: (left: T, right: T) => number) {
    this.compare = compare;
  }

  get size(): number {
    return this.values.length;
  }

  peek(): T | undefined {
    return this.values[0];
  }

  push(value: T): void {
    this.values.push(value);
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compare(this.values[parent], this.values[index]) <= 0) break;
      [this.values[parent], this.values[index]] = [this.values[index], this.values[parent]];
      index = parent;
    }
  }

  pop(): T | undefined {
    if (this.values.length === 0) return undefined;
    const root = this.values[0];
    const tail = this.values.pop()!;
    if (this.values.length > 0) {
      this.values[0] = tail;
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (
          left < this.values.length
          && this.compare(this.values[left], this.values[smallest]) < 0
        ) {
          smallest = left;
        }
        if (
          right < this.values.length
          && this.compare(this.values[right], this.values[smallest]) < 0
        ) {
          smallest = right;
        }
        if (smallest === index) break;
        [this.values[index], this.values[smallest]] = [
          this.values[smallest],
          this.values[index],
        ];
        index = smallest;
      }
    }
    return root;
  }
}
