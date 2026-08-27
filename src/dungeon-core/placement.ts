import { deepFreeze } from "./config";
import { indexFreeSpace } from "./free-space";
import { cellKey, hashValue } from "./identity";
import { OccupancyGrid } from "./occupancy";
import { createRng, type Rng, type RngStreams } from "./rng";
import {
  placeTemplate,
  transformLocalCell,
  transformVector,
  validateTemplateSet,
} from "./templates";
import type {
  ConnectionKind,
  DungeonRoom,
  DungeonSemantics,
  GenerationConfig,
  GenerationTraceEvent,
  GridCell,
  GridVector,
  MissionEdge,
  MissionNode,
  RoomTemplate,
  Rotation,
  SemanticEdgeAssignment,
  SemanticRoomAssignment,
  Socket,
  StageResult,
  TemplateSocket,
} from "./types";

interface PlacementCandidate {
  readonly room: DungeonRoom;
  readonly score: number;
}

interface PlacementCounters {
  backtracks: number;
  candidateEvaluations: number;
  placementAttempts: number;
}

interface PlacementContext {
  readonly attempt: number;
  readonly config: GenerationConfig;
  readonly edgeAssignmentById: ReadonlyMap<string, SemanticEdgeAssignment>;
  readonly edgesByNode: ReadonlyMap<string, readonly MissionEdge[]>;
  readonly nodeById: ReadonlyMap<string, MissionNode>;
  readonly roomAssignmentByNode: ReadonlyMap<string, SemanticRoomAssignment>;
  readonly seed: string;
  readonly semantics: DungeonSemantics;
  readonly templates: readonly RoomTemplate[];
  readonly trace: GenerationTraceEvent[];
}

export interface PlacementGeneration {
  readonly backtracks: number;
  readonly candidateEvaluations: number;
  readonly placementAttempts: number;
  readonly rooms: readonly DungeonRoom[];
}

export function placeMissionRooms(
  semantics: DungeonSemantics,
  config: GenerationConfig,
  templates: readonly RoomTemplate[],
  streams: RngStreams,
  attempt = 0,
): StageResult<PlacementGeneration> {
  const validatedTemplates = validateTemplateSet(templates);
  const trace: GenerationTraceEvent[] = [];
  const context: PlacementContext = {
    attempt,
    config,
    edgeAssignmentById: new Map(semantics.edges.map((edge) => [edge.edgeId, edge])),
    edgesByNode: edgesByNode(semantics),
    nodeById: new Map(semantics.graph.nodes.map((node) => [node.id, node])),
    roomAssignmentByNode: new Map(semantics.rooms.map((room) => [room.nodeId, room])),
    seed: streams.seed,
    semantics,
    templates: validatedTemplates,
    trace,
  };
  const occupancy = new OccupancyGrid(config);
  const placed = new Map<string, DungeonRoom>();
  const counters: PlacementCounters = {
    backtracks: 0,
    candidateEvaluations: 0,
    placementAttempts: 0,
  };

  const solved = solvePlacement(context, occupancy, placed, counters, 0);
  if (!solved) {
    trace.push({
      attempt,
      code: "PLACEMENT_BUDGET_EXHAUSTED",
      message: `Placement failed after ${counters.backtracks} backtracks and ${counters.candidateEvaluations} candidates`,
      stage: "placement",
    });
    return {
      error: {
        code:
          counters.backtracks >= config.placement.maxBacktracks
            ? "PLACEMENT_BACKTRACK_BUDGET_EXHAUSTED"
            : "PLACEMENT_NO_SOLUTION",
        details: {
          backtracks: counters.backtracks,
          candidateEvaluations: counters.candidateEvaluations,
          placedRooms: placed.size,
          roomCount: semantics.graph.nodes.length,
        },
        message: "No legal exact-footprint placement was found within the configured budget",
        stage: "placement",
      },
      ok: false,
      trace,
    };
  }

  const rooms = [...placed.values()].sort((left, right) => left.id.localeCompare(right.id));
  trace.push({
    attempt,
    candidateCount: counters.candidateEvaluations,
    code: "PLACEMENT_COMPLETE",
    message: `Placed ${rooms.length} exact room footprints with ${counters.backtracks} backtracks`,
    stage: "placement",
  });
  return {
    ok: true,
    trace,
    value: deepFreeze({
      backtracks: counters.backtracks,
      candidateEvaluations: counters.candidateEvaluations,
      placementAttempts: counters.placementAttempts,
      rooms,
    }),
  };
}

function solvePlacement(
  context: PlacementContext,
  occupancy: OccupancyGrid,
  placed: Map<string, DungeonRoom>,
  counters: PlacementCounters,
  depth: number,
): boolean {
  if (placed.size === context.semantics.graph.nodes.length) {
    return true;
  }
  if (counters.backtracks > context.config.placement.maxBacktracks) {
    return false;
  }

  const selection = selectMostConstrainedNode(context, occupancy, placed, depth, counters);
  if (!selection || selection.candidates.length === 0) {
    return false;
  }
  traceBounded(context.trace, {
    attempt: context.attempt,
    candidateCount: selection.candidates.length,
    code: "PLACEMENT_MRV_SELECT",
    message: `Selected ${selection.node.id} at depth ${depth}`,
    stage: "placement",
  });

  for (const candidate of selection.candidates) {
    if (counters.backtracks > context.config.placement.maxBacktracks) {
      return false;
    }
    counters.placementAttempts += 1;
    const reservation = occupancy.reserveRoom(candidate.room.id, candidate.room.footprint);
    if (!reservation.ok) {
      continue;
    }
    placed.set(selection.node.id, candidate.room);

    if (
      hasSharedRoutingEnvelope(context, occupancy, placed)
      && forwardCheck(context, occupancy, placed, depth + 1, counters)
      && solvePlacement(context, occupancy, placed, counters, depth + 1)
    ) {
      return true;
    }

    placed.delete(selection.node.id);
    occupancy.releaseOwner(candidate.room.id);
    counters.backtracks += 1;
  }
  return false;
}

function hasSharedRoutingEnvelope(
  context: PlacementContext,
  occupancy: OccupancyGrid,
  placed: ReadonlyMap<string, DungeonRoom>,
): boolean {
  const freeSpace = indexFreeSpace(context.config, occupancy);
  for (let floor = 0; floor < context.config.world.floors; floor += 1) {
    const rooms = [...placed.values()].filter(
      (room) => room.transform.origin.floor === floor,
    );
    const largestComponent = freeSpace.largestComponentByFloor.get(floor);
    if (rooms.length > 0 && largestComponent === undefined) return false;
    let sharedComponents = new Set<number>(
      largestComponent === undefined ? [] : [largestComponent],
    );
    for (const room of rooms) {
      const node = context.nodeById.get(room.topologyNodeId)!;
      const requiredSockets = (context.edgesByNode.get(node.id) ?? []).filter((edge) => {
        const kind = context.edgeAssignmentById.get(edge.id)!.kind;
        return kind !== "portal" && !isVerticalKind(kind);
      }).length;
      if (requiredSockets === 0) continue;

      const socketsByComponent = new Map<number, number>();
      for (const socket of room.sockets) {
        if (socket.normal.y !== 0) continue;
        const outward: GridCell = {
          floor,
          x: socket.exteriorCell.x + socket.normal.x,
          z: socket.exteriorCell.z + socket.normal.z,
        };
        const component = freeSpace.componentByCell.get(cellKey(outward));
        if (component !== undefined) {
          socketsByComponent.set(component, (socketsByComponent.get(component) ?? 0) + 1);
        }
      }
      const eligible = new Set<number>(
        [...socketsByComponent.entries()]
          .filter(([, count]) => count >= requiredSockets)
          .map(([component]) => component),
      );
      if (eligible.size === 0) return false;
      sharedComponents = new Set(
        [...sharedComponents].filter((component) => eligible.has(component)),
      );
      if (sharedComponents.size === 0) return false;
    }
  }
  return true;
}

function selectMostConstrainedNode(
  context: PlacementContext,
  occupancy: OccupancyGrid,
  placed: ReadonlyMap<string, DungeonRoom>,
  depth: number,
  counters: PlacementCounters,
): Readonly<{ candidates: readonly PlacementCandidate[]; node: MissionNode }> | null {
  const start = context.nodeById.get(context.semantics.graph.startNodeId)!;
  if (!placed.has(start.id)) {
    return {
      candidates: generateCandidates(start, context, occupancy, placed, depth, counters),
      node: start,
    };
  }

  const frontier = context.semantics.graph.nodes
    .filter((node) => !placed.has(node.id))
    .map((node) => ({
      node,
      placedNeighborCount: physicalPlacedNeighbors(node, context, placed).length,
    }))
    .filter((entry) => entry.placedNeighborCount > 0)
    .sort(
      (left, right) =>
        right.placedNeighborCount - left.placedNeighborCount
        || Number(right.node.mandatory) - Number(left.node.mandatory)
        || left.node.id.localeCompare(right.node.id),
    );
  if (frontier.length === 0) {
    return null;
  }

  let selected: Readonly<{
    candidates: readonly PlacementCandidate[];
    node: MissionNode;
    placedNeighborCount: number;
  }> | null = null;
  for (const entry of frontier) {
    const candidates = generateCandidates(
      entry.node,
      context,
      occupancy,
      placed,
      depth,
      counters,
    );
    if (
      selected === null
      || candidates.length < selected.candidates.length
      || (candidates.length === selected.candidates.length
        && entry.placedNeighborCount > selected.placedNeighborCount)
      || (candidates.length === selected.candidates.length
        && entry.placedNeighborCount === selected.placedNeighborCount
        && entry.node.id < selected.node.id)
    ) {
      selected = { ...entry, candidates };
    }
    if (candidates.length === 0) {
      break;
    }
  }
  return selected;
}

function forwardCheck(
  context: PlacementContext,
  occupancy: OccupancyGrid,
  placed: ReadonlyMap<string, DungeonRoom>,
  depth: number,
  counters: PlacementCounters,
): boolean {
  const affected = context.semantics.graph.nodes.filter(
    (node) =>
      !placed.has(node.id) && physicalPlacedNeighbors(node, context, placed).length > 0,
  );
  for (const node of affected) {
    if (generateCandidates(node, context, occupancy, placed, depth, counters, true).length === 0) {
      traceBounded(context.trace, {
        attempt: context.attempt,
        candidateCount: 0,
        code: "PLACEMENT_FORWARD_CHECK_REJECT",
        message: `${node.id} has no legal transform after reservation`,
        stage: "placement",
      });
      return false;
    }
  }
  return true;
}

function generateCandidates(
  node: MissionNode,
  context: PlacementContext,
  occupancy: OccupancyGrid,
  placed: ReadonlyMap<string, DungeonRoom>,
  depth: number,
  counters: PlacementCounters,
  existenceOnly = false,
): PlacementCandidate[] {
  const assignment = context.roomAssignmentByNode.get(node.id)!;
  const eligibleTemplates = context.templates.filter(
    (template) =>
      template.allowedArchetypes.includes(assignment.archetype)
      && templateHasSocketCapacity(template, node, context),
  );
  if (eligibleTemplates.length === 0) {
    return [];
  }

  const signature = hashValue(
    [...placed.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([id, room]) => [id, room.templateId, room.transform]),
  );
  const rng = createRng(
    `${context.seed}:placement:${context.attempt}:${depth}:${node.id}:${signature}`,
    "placement",
  );
  const candidates: PlacementCandidate[] = [];
  const seen = new Set<string>();
  const limit = existenceOnly ? 1 : context.config.placement.candidateLimitPerRoom;

  if (node.id === context.semantics.graph.startNodeId && placed.size === 0) {
    const origins = startOrigins(context.config, node.desiredFloor, rng);
    for (const template of rng.shuffle(eligibleTemplates)) {
      for (const rotation of rng.shuffle(template.allowedRotations)) {
        for (const origin of origins) {
          addCandidate(
            node,
            assignment,
            template,
            rotation,
            origin,
            context,
            occupancy,
            placed,
            candidates,
            seen,
            counters,
          );
          if (candidates.length >= limit) return sortCandidates(candidates).slice(0, limit);
        }
      }
    }
    return sortCandidates(candidates).slice(0, limit);
  }

  const anchors = rng.shuffle(physicalPlacedNeighbors(node, context, placed));
  for (const anchor of anchors) {
    const kind = context.edgeAssignmentById.get(anchor.edge.id)!.kind;
    if (isVerticalKind(kind)) {
      generateVerticalCandidates(
        node,
        assignment,
        anchor.room,
        kind,
        eligibleTemplates,
        context,
        occupancy,
        placed,
        rng,
        candidates,
        seen,
        counters,
        limit,
      );
    } else {
      generateHorizontalCandidates(
        node,
        assignment,
        anchor.room,
        kind,
        eligibleTemplates,
        context,
        occupancy,
        placed,
        rng,
        candidates,
        seen,
        counters,
        limit,
      );
    }
    if (candidates.length >= limit) break;
  }
  return sortCandidates(candidates).slice(0, limit);
}

function generateHorizontalCandidates(
  node: MissionNode,
  assignment: SemanticRoomAssignment,
  anchorRoom: DungeonRoom,
  kind: ConnectionKind,
  templates: readonly RoomTemplate[],
  context: PlacementContext,
  occupancy: OccupancyGrid,
  placed: ReadonlyMap<string, DungeonRoom>,
  rng: Rng,
  candidates: PlacementCandidate[],
  seen: Set<string>,
  counters: PlacementCounters,
  limit: number,
): void {
  const gaps = rng.shuffle(integerSequence(
    context.config.placement.roomGap.min,
    context.config.placement.roomGap.max,
  ));
  const offsets = rng.shuffle([0, -1, 1, -2, 2, -3, 3]);
  const sourceSockets = rng.shuffle(
    anchorRoom.sockets.filter(
      (socket) => socket.normal.y === 0 && socket.allowedConnectionKinds.includes(kind),
    ),
  );
  for (const sourceSocket of sourceSockets) {
    const perpendicular = { x: -sourceSocket.normal.z, z: sourceSocket.normal.x };
    for (const template of rng.shuffle(templates)) {
      for (const rotation of rng.shuffle(template.allowedRotations)) {
        const targetSockets = rng.shuffle(
          template.sockets.filter((socket) => {
            const normal = transformVector(socket.normal, rotation);
            return normal.y === 0
              && normal.x === -sourceSocket.normal.x
              && normal.z === -sourceSocket.normal.z
              && socket.allowedConnectionKinds.includes(kind)
              && compatibleCodes(sourceSocket.compatibility, socket.compatibility);
          }),
        );
        for (const targetSocket of targetSockets) {
          const targetNormal = transformVector(targetSocket.normal, rotation);
          const transformedCell = transformLocalCell(targetSocket.cell, rotation);
          for (const gap of gaps) {
            for (const offset of offsets) {
              const targetExterior = {
                floor: node.desiredFloor,
                x:
                  sourceSocket.exteriorCell.x
                  + sourceSocket.normal.x * gap
                  + perpendicular.x * offset,
                z:
                  sourceSocket.exteriorCell.z
                  + sourceSocket.normal.z * gap
                  + perpendicular.z * offset,
              } satisfies GridCell;
              const origin: GridCell = {
                floor: node.desiredFloor,
                x: targetExterior.x - transformedCell.x - targetNormal.x,
                z: targetExterior.z - transformedCell.z - targetNormal.z,
              };
              addCandidate(
                node,
                assignment,
                template,
                rotation,
                origin,
                context,
                occupancy,
                placed,
                candidates,
                seen,
                counters,
              );
              if (candidates.length >= limit) return;
            }
          }
        }
      }
    }
  }
}

function generateVerticalCandidates(
  node: MissionNode,
  assignment: SemanticRoomAssignment,
  anchorRoom: DungeonRoom,
  kind: ConnectionKind,
  templates: readonly RoomTemplate[],
  context: PlacementContext,
  occupancy: OccupancyGrid,
  placed: ReadonlyMap<string, DungeonRoom>,
  rng: Rng,
  candidates: PlacementCandidate[],
  seen: Set<string>,
  counters: PlacementCounters,
  limit: number,
): void {
  const floorDelta = node.desiredFloor - anchorRoom.transform.origin.floor;
  if (Math.abs(floorDelta) !== 1) return;
  const direction = floorDelta > 0 ? 1 : -1;
  const sourceSockets = rng.shuffle(
    anchorRoom.sockets.filter(
      (socket) => socket.normal.y === direction && socket.allowedConnectionKinds.includes(kind),
    ),
  );
  for (const sourceSocket of sourceSockets) {
    for (const template of rng.shuffle(templates)) {
      for (const rotation of rng.shuffle(template.allowedRotations)) {
        const targetSockets = rng.shuffle(
          template.sockets.filter((socket) => {
            const normal = transformVector(socket.normal, rotation);
            return normal.y === -direction
              && socket.allowedConnectionKinds.includes(kind)
              && compatibleCodes(sourceSocket.compatibility, socket.compatibility);
          }),
        );
        for (const targetSocket of targetSockets) {
          const transformedCell = transformLocalCell(targetSocket.cell, rotation);
          const origin: GridCell = {
            floor: node.desiredFloor,
            x: sourceSocket.cell.x - transformedCell.x,
            z: sourceSocket.cell.z - transformedCell.z,
          };
          addCandidate(
            node,
            assignment,
            template,
            rotation,
            origin,
            context,
            occupancy,
            placed,
            candidates,
            seen,
            counters,
          );
          if (candidates.length >= limit) return;
        }
      }
    }
  }
}

function addCandidate(
  node: MissionNode,
  assignment: SemanticRoomAssignment,
  template: RoomTemplate,
  rotation: Rotation,
  origin: GridCell,
  context: PlacementContext,
  occupancy: OccupancyGrid,
  placed: ReadonlyMap<string, DungeonRoom>,
  candidates: PlacementCandidate[],
  seen: Set<string>,
  counters: PlacementCounters,
): void {
  const key = `${template.id}:${rotation}:${origin.floor}:${origin.x}:${origin.z}`;
  if (seen.has(key)) return;
  seen.add(key);
  counters.candidateEvaluations += 1;
  const roomId = roomIdForNode(node.id);
  const materialized = placeTemplate(template, roomId, origin, rotation);
  if (!occupancy.canReserveRoom(materialized.footprint).ok) return;
  const room: DungeonRoom = {
    archetype: assignment.archetype,
    biome: assignment.biome,
    branchDepth: node.branchDepth,
    criticalPathIndex: node.criticalPathIndex,
    footprint: materialized.footprint,
    grants: assignment.grants,
    id: roomId,
    mandatory: node.mandatory,
    progressionDepth: node.progressionDepth,
    role: node.role,
    shape: template.shape,
    sockets: materialized.sockets,
    tags: assignment.tags,
    templateId: template.id,
    topologyNodeId: node.id,
    transform: { origin, rotation },
  };
  candidates.push({ room, score: candidateScore(room, node, context, placed) });
}

function candidateScore(
  room: DungeonRoom,
  node: MissionNode,
  context: PlacementContext,
  placed: ReadonlyMap<string, DungeonRoom>,
): number {
  let score = 0;
  for (const { edge, room: neighbor } of physicalPlacedNeighbors(node, context, placed)) {
    const kind = context.edgeAssignmentById.get(edge.id)!.kind;
    if (isVerticalKind(kind)) {
      const aligned = room.sockets.some(
        (socket) =>
          socket.normal.y !== 0
          && neighbor.sockets.some(
            (other) =>
              other.normal.y === -socket.normal.y
              && other.cell.x === socket.cell.x
              && other.cell.z === socket.cell.z,
          ),
      );
      score += aligned ? 0 : 10_000;
      continue;
    }
    let minimum = Infinity;
    for (const socket of room.sockets.filter(
      (candidate) => candidate.normal.y === 0 && candidate.allowedConnectionKinds.includes(kind),
    )) {
      for (const other of neighbor.sockets.filter(
        (candidate) => candidate.normal.y === 0 && candidate.allowedConnectionKinds.includes(kind),
      )) {
        minimum = Math.min(minimum, manhattan(socket.exteriorCell, other.exteriorCell));
      }
    }
    score += minimum;
  }
  const centerX = (context.config.world.width - 1) / 2;
  const centerZ = (context.config.world.depth - 1) / 2;
  score +=
    (Math.abs(room.transform.origin.x - centerX) + Math.abs(room.transform.origin.z - centerZ))
    * 0.01;
  return score;
}

function templateHasSocketCapacity(
  template: RoomTemplate,
  node: MissionNode,
  context: PlacementContext,
): boolean {
  const requirements = (context.edgesByNode.get(node.id) ?? []).map(
    (edge) => context.edgeAssignmentById.get(edge.id)!.kind,
  );
  const horizontalRequired = requirements.filter((kind) => !isVerticalKind(kind)).length;
  const upRequired = requirements.filter((kind) => isVerticalKind(kind)).filter((_, index) => {
    const edge = (context.edgesByNode.get(node.id) ?? []).filter((candidate) =>
      isVerticalKind(context.edgeAssignmentById.get(candidate.id)!.kind),
    )[index];
    const otherId = edge.from === node.id ? edge.to : edge.from;
    return context.nodeById.get(otherId)!.desiredFloor > node.desiredFloor;
  }).length;
  const downRequired = requirements.filter((kind) => isVerticalKind(kind)).length - upRequired;
  return (
    template.sockets.filter((socket) => socket.normal.y === 0).length >= horizontalRequired
    && template.sockets.filter((socket) => socket.normal.y === 1).length >= upRequired
    && template.sockets.filter((socket) => socket.normal.y === -1).length >= downRequired
  );
}

function physicalPlacedNeighbors(
  node: MissionNode,
  context: PlacementContext,
  placed: ReadonlyMap<string, DungeonRoom>,
): Array<Readonly<{ edge: MissionEdge; room: DungeonRoom }>> {
  const result: Array<Readonly<{ edge: MissionEdge; room: DungeonRoom }>> = [];
  for (const edge of context.edgesByNode.get(node.id) ?? []) {
    const assignment = context.edgeAssignmentById.get(edge.id)!;
    if (assignment.kind === "portal") continue;
    const otherId = edge.from === node.id ? edge.to : edge.from;
    const room = placed.get(otherId);
    if (room) result.push({ edge, room });
  }
  return result.sort((left, right) => left.edge.id.localeCompare(right.edge.id));
}

function edgesByNode(semantics: DungeonSemantics): Map<string, MissionEdge[]> {
  const result = new Map(
    semantics.graph.nodes.map((node) => [node.id, [] as MissionEdge[]]),
  );
  for (const edge of semantics.graph.edges) {
    result.get(edge.from)!.push(edge);
    result.get(edge.to)!.push(edge);
  }
  for (const edges of result.values()) edges.sort((left, right) => left.id.localeCompare(right.id));
  return result;
}

function startOrigins(config: GenerationConfig, floor: number, rng: Rng): GridCell[] {
  const centerX = Math.floor(config.world.width / 2);
  const centerZ = Math.floor(config.world.depth / 2);
  const offsets: Array<readonly [number, number]> = [[0, 0]];
  for (let radius = 1; radius <= 4; radius += 1) {
    for (let delta = -radius; delta <= radius; delta += 1) {
      offsets.push(
        [delta, -radius],
        [radius, delta],
        [-delta, radius],
        [-radius, -delta],
      );
    }
  }
  return rng.shuffle(
    [...new Set(offsets.map(([x, z]) => `${x}:${z}`))].map((key) => {
      const [x, z] = key.split(":").map(Number);
      return { floor, x: centerX + x, z: centerZ + z };
    }),
  );
}

function sortCandidates(candidates: PlacementCandidate[]): PlacementCandidate[] {
  return candidates.sort(
    (left, right) =>
      left.score - right.score
      || left.room.templateId.localeCompare(right.room.templateId)
      || left.room.transform.origin.floor - right.room.transform.origin.floor
      || left.room.transform.origin.z - right.room.transform.origin.z
      || left.room.transform.origin.x - right.room.transform.origin.x
      || left.room.transform.rotation - right.room.transform.rotation,
  );
}

function compatibleCodes(left: readonly string[], right: readonly string[]): boolean {
  return left.some((code) => right.includes(code));
}

function isVerticalKind(kind: ConnectionKind): boolean {
  return kind === "stairs" || kind === "elevator" || kind === "drop" || kind === "ladder";
}

function roomIdForNode(nodeId: string): string {
  return `room-${nodeId}`;
}

function integerSequence(minimum: number, maximum: number): number[] {
  return Array.from({ length: maximum - minimum + 1 }, (_, index) => minimum + index);
}

function manhattan(left: GridCell, right: GridCell): number {
  return (
    Math.abs(left.floor - right.floor)
    + Math.abs(left.x - right.x)
    + Math.abs(left.z - right.z)
  );
}

function traceBounded(
  trace: GenerationTraceEvent[],
  event: GenerationTraceEvent,
): void {
  if (trace.length < 512) trace.push(event);
}
