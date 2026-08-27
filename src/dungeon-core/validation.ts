import { cellKey } from "./identity";
import type {
  Dungeon,
  DungeonConnection,
  DungeonRoom,
  GridCell,
  Socket,
  ValidationIssue,
  ValidationReport,
} from "./types";

export type DungeonValidationInput = Pick<
  Dungeon,
  | "bossRoomId"
  | "config"
  | "connections"
  | "endRoomId"
  | "floors"
  | "rooms"
  | "startRoomId"
>;

const VERTICAL_KINDS = new Set(["stairs", "elevator", "drop", "ladder"]);

export function validateDungeon(dungeon: DungeonValidationInput): ValidationReport {
  const issues: ValidationIssue[] = [];
  const roomById = uniqueMap(dungeon.rooms, (room) => room.id, "ROOM_ID_DUPLICATE", issues);
  const connectionById = uniqueMap(
    dungeon.connections,
    (connection) => connection.id,
    "CONNECTION_ID_DUPLICATE",
    issues,
  );
  const socketById = new Map<string, Socket>();
  const socketUseCount = new Map<string, number>();
  const occupiedCells = new Map<string, string>();
  const reservedCells = new Map<string, string>();

  validateSpecialRooms(dungeon, roomById, issues);
  for (const room of dungeon.rooms) {
    validateRoom(room, dungeon, socketById, occupiedCells, reservedCells, issues);
  }
  for (const connection of dungeon.connections) {
    validateConnection(
      connection,
      dungeon,
      roomById,
      socketById,
      socketUseCount,
      occupiedCells,
      issues,
    );
  }
  for (const [socketId, count] of socketUseCount) {
    const socket = socketById.get(socketId);
    if (socket && !socket.shareable && count > 1) {
      issues.push({
        code: "SOCKET_REUSED",
        message: `Non-shareable socket ${socketId} is used by ${count} connections`,
        roomId: socket.roomId,
        severity: "error",
      });
    }
  }

  const physicalReachable = graphReachable(dungeon, dungeon.startRoomId);
  const mandatoryRoomIds = dungeon.rooms.filter((room) => room.mandatory).map((room) => room.id);
  const missingPhysical = mandatoryRoomIds.filter((id) => !physicalReachable.has(id));
  if (missingPhysical.length > 0) {
    issues.push({
      code: "MANDATORY_ROOM_PHYSICALLY_UNREACHABLE",
      message: `Mandatory rooms lack a materialized path from start: ${missingPhysical.join(", ")}`,
      severity: "error",
    });
  }

  validateKeyAvailability(dungeon, issues);
  validateProgressionBypass(dungeon, roomById, issues);
  validateCorridorJunctionBypass(dungeon, roomById, issues);
  const stateReachability = progressionReachability(dungeon, roomById);
  const missingProgression = mandatoryRoomIds.filter(
    (id) => !stateReachability.reachableRooms.has(id),
  );
  if (missingProgression.length > 0) {
    issues.push({
      code: "MANDATORY_ROOM_PROGRESSION_UNREACHABLE",
      message: `Traversal-state search cannot reach mandatory rooms: ${missingProgression.join(", ")}`,
      severity: "error",
    });
  }
  if (!stateReachability.reachableRooms.has(dungeon.endRoomId)) {
    issues.push({
      code: "END_PROGRESSION_UNREACHABLE",
      message: "Traversal-state search cannot reach the dungeon end",
      roomId: dungeon.endRoomId,
      severity: "error",
    });
  }

  const sortedIssues = issues.sort(compareIssues);
  const physicalCodes = new Set([
    "CONNECTION_CORRIDOR_MISSING",
    "CONNECTION_DANGLING_ROOM",
    "CONNECTION_DANGLING_SOCKET",
    "CORRIDOR_COLLIDES_WITH_ROOM",
    "CORRIDOR_DISCONTINUOUS",
    "CORRIDOR_ENDPOINT_MISMATCH",
    "CORRIDOR_OUT_OF_BOUNDS",
    "MANDATORY_ROOM_PHYSICALLY_UNREACHABLE",
    "ROOM_CELL_DUPLICATE",
    "ROOM_FOOTPRINT_OVERLAP",
    "ROOM_OUT_OF_BOUNDS",
    "SOCKET_REUSED",
    "VERTICAL_CONNECTION_INVALID",
  ]);
  const physicallyTraversable = !sortedIssues.some(
    (issue) => issue.severity === "error" && physicalCodes.has(issue.code),
  );
  const progressionSolvable = !sortedIssues.some(
    (issue) =>
      issue.severity === "error"
      && (issue.code.includes("PROGRESSION")
        || issue.code.includes("KEY_BEHIND")
        || issue.code.includes("BYPASS")),
  );
  return {
    issues: sortedIssues,
    physicallyTraversable,
    progressionSolvable,
    valid: !sortedIssues.some((issue) => issue.severity === "error"),
  };
}


function validateSpecialRooms(
  dungeon: DungeonValidationInput,
  roomById: ReadonlyMap<string, DungeonRoom>,
  issues: ValidationIssue[],
): void {
  for (const [role, id] of [
    ["start", dungeon.startRoomId],
    ["boss", dungeon.bossRoomId],
    ["end", dungeon.endRoomId],
  ] as const) {
    const room = roomById.get(id);
    if (!room) {
      issues.push({
        code: "SPECIAL_ROOM_DANGLING",
        message: `${role}RoomId ${id} does not reference a room`,
        severity: "error",
      });
    } else if (room.role !== role || room.archetype !== role) {
      issues.push({
        code: "SPECIAL_ROOM_ROLE_MISMATCH",
        message: `${id} is declared as ${role} but has ${room.role}/${room.archetype}`,
        roomId: id,
        severity: "error",
      });
    }
    const matching = dungeon.rooms.filter((candidate) => candidate.role === role);
    if (matching.length !== 1) {
      issues.push({
        code: "SPECIAL_ROOM_COUNT",
        message: `Expected exactly one ${role} room, found ${matching.length}`,
        severity: "error",
      });
    }
  }
  if (dungeon.floors !== dungeon.config.world.floors) {
    issues.push({
      code: "FLOOR_CONFIG_MISMATCH",
      message: "Dungeon floor count differs from its canonical config snapshot",
      severity: "error",
    });
  }
}

function validateRoom(
  room: DungeonRoom,
  dungeon: DungeonValidationInput,
  socketById: Map<string, Socket>,
  occupiedCells: Map<string, string>,
  reservedCells: Map<string, string>,
  issues: ValidationIssue[],
): void {
  if (room.footprint.cells.length === 0) {
    issues.push({
      code: "ROOM_FOOTPRINT_EMPTY",
      message: `Room ${room.id} has no occupied cells`,
      roomId: room.id,
      severity: "error",
    });
  }
  const localKeys = new Set<string>();
  for (const cell of room.footprint.cells) {
    const key = cellKey(cell);
    if (localKeys.has(key)) {
      issues.push({
        code: "ROOM_CELL_DUPLICATE",
        message: `Room ${room.id} repeats occupied cell ${key}`,
        roomId: room.id,
        severity: "error",
      });
    }
    localKeys.add(key);
    if (!inBounds(cell, dungeon)) {
      issues.push({
        code: "ROOM_OUT_OF_BOUNDS",
        message: `Room ${room.id} occupies out-of-bounds cell ${key}`,
        roomId: room.id,
        severity: "error",
      });
    }
    const priorRoom = occupiedCells.get(key);
    const priorReservation = reservedCells.get(key);
    if ((priorRoom && priorRoom !== room.id) || (priorReservation && priorReservation !== room.id)) {
      issues.push({
        code: "ROOM_FOOTPRINT_OVERLAP",
        message: `Room ${room.id} overlaps reservation at ${key}`,
        roomId: room.id,
        severity: "error",
      });
    }
    occupiedCells.set(key, room.id);
  }
  for (const cell of room.footprint.clearance) {
    const key = cellKey(cell);
    if (!inBounds(cell, dungeon)) {
      issues.push({
        code: "ROOM_CLEARANCE_OUT_OF_BOUNDS",
        message: `Room ${room.id} clearance is out of bounds at ${key}`,
        roomId: room.id,
        severity: "error",
      });
    }
    const priorRoom = occupiedCells.get(key);
    const priorReservation = reservedCells.get(key);
    if ((priorRoom && priorRoom !== room.id) || (priorReservation && priorReservation !== room.id)) {
      issues.push({
        code: "ROOM_CLEARANCE_OVERLAP",
        message: `Room ${room.id} clearance overlaps another reservation at ${key}`,
        roomId: room.id,
        severity: "error",
      });
    }
    reservedCells.set(key, room.id);
  }

  for (const socket of room.sockets) {
    if (socketById.has(socket.id)) {
      issues.push({
        code: "SOCKET_ID_DUPLICATE",
        message: `Socket ID ${socket.id} is duplicated`,
        roomId: room.id,
        severity: "error",
      });
    }
    socketById.set(socket.id, socket);
    if (socket.roomId !== room.id || !localKeys.has(cellKey(socket.cell))) {
      issues.push({
        code: "SOCKET_ROOM_MISMATCH",
        message: `Socket ${socket.id} is not anchored to its owning room footprint`,
        roomId: room.id,
        severity: "error",
      });
    }
    const expectedExterior = {
      floor: socket.cell.floor + socket.normal.y,
      x: socket.cell.x + socket.normal.x,
      z: socket.cell.z + socket.normal.z,
    };
    if (cellKey(expectedExterior) !== cellKey(socket.exteriorCell)) {
      issues.push({
        code: "SOCKET_EXTERIOR_MISMATCH",
        message: `Socket ${socket.id} exterior does not follow its geometric normal`,
        roomId: room.id,
        severity: "error",
      });
    }
    if (
      socket.allowedConnectionKinds.length === 0
      || socket.compatibility.length === 0
      || socket.aperture.height <= 0
      || socket.aperture.width <= 0
    ) {
      issues.push({
        code: "SOCKET_METADATA_INVALID",
        message: `Socket ${socket.id} has invalid compatibility or aperture metadata`,
        roomId: room.id,
        severity: "error",
      });
    }
  }
}

function validateConnection(
  connection: DungeonConnection,
  dungeon: DungeonValidationInput,
  roomById: ReadonlyMap<string, DungeonRoom>,
  socketById: ReadonlyMap<string, Socket>,
  socketUseCount: Map<string, number>,
  occupiedCells: ReadonlyMap<string, string>,
  issues: ValidationIssue[],
): void {
  const fromRoom = roomById.get(connection.from.roomId);
  const toRoom = roomById.get(connection.to.roomId);
  if (!fromRoom || !toRoom || fromRoom.id === toRoom.id) {
    issues.push({
      code: "CONNECTION_DANGLING_ROOM",
      connectionId: connection.id,
      message: `Connection ${connection.id} has missing or identical room endpoints`,
      severity: "error",
    });
    return;
  }
  const fromSocket = socketById.get(connection.from.socketId);
  const toSocket = socketById.get(connection.to.socketId);
  if (
    !fromSocket
    || !toSocket
    || fromSocket.roomId !== fromRoom.id
    || toSocket.roomId !== toRoom.id
  ) {
    issues.push({
      code: "CONNECTION_DANGLING_SOCKET",
      connectionId: connection.id,
      message: `Connection ${connection.id} has invalid explicit socket endpoints`,
      severity: "error",
    });
    return;
  }
  socketUseCount.set(fromSocket.id, (socketUseCount.get(fromSocket.id) ?? 0) + 1);
  socketUseCount.set(toSocket.id, (socketUseCount.get(toSocket.id) ?? 0) + 1);
  if (
    !fromSocket.allowedConnectionKinds.includes(connection.kind)
    || !toSocket.allowedConnectionKinds.includes(connection.kind)
    || !fromSocket.compatibility.some((code) => toSocket.compatibility.includes(code))
  ) {
    issues.push({
      code: "CONNECTION_SOCKET_INCOMPATIBLE",
      connectionId: connection.id,
      message: `Connection ${connection.id} uses incompatible socket metadata`,
      severity: "error",
    });
  }
  if (
    connection.traversal.lockedByDefault
    && connection.traversal.requiredFlags.length === 0
    && connection.traversal.requiredItems.length === 0
    && connection.traversal.requiredAction === null
  ) {
    issues.push({
      code: "CONNECTION_PERMANENTLY_LOCKED",
      connectionId: connection.id,
      message: `Locked connection ${connection.id} has no explicit unlock rule`,
      severity: "error",
    });
  }

  if (connection.kind === "portal") {
    if (connection.corridor !== null || connection.vertical !== null) {
      issues.push({
        code: "PORTAL_HAS_PHYSICAL_ROUTE",
        connectionId: connection.id,
        message: `Portal ${connection.id} must not masquerade as a corridor or vertical route`,
        severity: "error",
      });
    }
    return;
  }
  if (VERTICAL_KINDS.has(connection.kind)) {
    validateVerticalConnection(connection, fromSocket, toSocket, issues);
    return;
  }
  if (!connection.corridor) {
    issues.push({
      code: "CONNECTION_CORRIDOR_MISSING",
      connectionId: connection.id,
      message: `Ordinary connection ${connection.id} has no physical corridor`,
      severity: "error",
    });
    return;
  }
  if (connection.vertical !== null) {
    issues.push({
      code: "CONNECTION_UNEXPECTED_VERTICAL_ROUTE",
      connectionId: connection.id,
      message: `Horizontal connection ${connection.id} contains vertical metadata`,
      severity: "error",
    });
  }
  const cells = connection.corridor.cells;
  if (
    cells.length === 0
    || cellKey(cells[0]) !== cellKey(fromSocket.exteriorCell)
    || cellKey(cells[cells.length - 1]) !== cellKey(toSocket.exteriorCell)
  ) {
    issues.push({
      code: "CORRIDOR_ENDPOINT_MISMATCH",
      connectionId: connection.id,
      message: `Corridor ${connection.id} does not terminate at its socket exterior cells`,
      severity: "error",
    });
  }
  for (let index = 0; index < cells.length; index += 1) {
    const cell = cells[index];
    if (!inBounds(cell, dungeon)) {
      issues.push({
        code: "CORRIDOR_OUT_OF_BOUNDS",
        connectionId: connection.id,
        message: `Corridor ${connection.id} leaves the world at ${cellKey(cell)}`,
        severity: "error",
      });
    }
    if (occupiedCells.has(cellKey(cell))) {
      issues.push({
        code: "CORRIDOR_COLLIDES_WITH_ROOM",
        connectionId: connection.id,
        message: `Corridor ${connection.id} crosses room cell ${cellKey(cell)}`,
        severity: "error",
      });
    }
    if (index > 0 && gridDistance(cells[index - 1], cell) !== 1) {
      issues.push({
        code: "CORRIDOR_DISCONTINUOUS",
        connectionId: connection.id,
        message: `Corridor ${connection.id} has a discontinuity at index ${index}`,
        severity: "error",
      });
    }
  }
}

function validateVerticalConnection(
  connection: DungeonConnection,
  fromSocket: Socket,
  toSocket: Socket,
  issues: ValidationIssue[],
): void {
  const vertical = connection.vertical;
  const floorDelta = toSocket.cell.floor - fromSocket.cell.floor;
  if (
    connection.corridor !== null
    || vertical === null
    || Math.abs(floorDelta) !== 1
    || fromSocket.normal.y !== Math.sign(floorDelta)
    || toSocket.normal.y !== -Math.sign(floorDelta)
    || fromSocket.cell.x !== toSocket.cell.x
    || fromSocket.cell.z !== toSocket.cell.z
    || (vertical && cellKey(vertical.from) !== cellKey(fromSocket.cell))
    || (vertical && cellKey(vertical.to) !== cellKey(toSocket.cell))
  ) {
    issues.push({
      code: "VERTICAL_CONNECTION_INVALID",
      connectionId: connection.id,
      message: `Vertical connection ${connection.id} has mismatched floors, sockets, or route`,
      severity: "error",
    });
  }
  if (connection.kind === "drop" && connection.traversal.direction === "bidirectional") {
    issues.push({
      code: "VERTICAL_DROP_DIRECTION_INVALID",
      connectionId: connection.id,
      message: `Drop ${connection.id} must be explicitly one-way`,
      severity: "error",
    });
  }
}

function validateKeyAvailability(
  dungeon: DungeonValidationInput,
  issues: ValidationIssue[],
): void {
  const requiredItems = new Set(
    dungeon.connections.flatMap((connection) => connection.traversal.requiredItems),
  );
  for (const item of requiredItems) {
    const reachable = graphReachable(
      dungeon,
      dungeon.startRoomId,
      (connection) => !connection.traversal.requiredItems.includes(item),
    );
    const providers = dungeon.rooms.filter((room) => room.grants.items.includes(item));
    if (providers.length === 0 || providers.every((room) => !reachable.has(room.id))) {
      issues.push({
        code: "KEY_BEHIND_OWN_LOCK",
        message: `${item} is unavailable without traversing a connection that already requires it`,
        severity: "error",
      });
    }
  }
}

function validateProgressionBypass(
  dungeon: DungeonValidationInput,
  roomById: ReadonlyMap<string, DungeonRoom>,
  issues: ValidationIssue[],
): void {
  const gates = dungeon.connections
    .filter(
      (connection) =>
        connection.mandatory
        && (connection.traversal.requiredFlags.length > 0
          || connection.traversal.requiredItems.length > 0),
    )
    .map((connection) => ({
      connection,
      depth: Math.max(
        roomById.get(connection.from.roomId)?.progressionDepth ?? 0,
        roomById.get(connection.to.roomId)?.progressionDepth ?? 0,
      ),
    }));
  for (const connection of dungeon.connections.filter(
    (candidate) => candidate.kind === "portal" || candidate.shortcut,
  )) {
    const depths = [
      roomById.get(connection.from.roomId)?.progressionDepth ?? 0,
      roomById.get(connection.to.roomId)?.progressionDepth ?? 0,
    ];
    const minimum = Math.min(...depths);
    const maximum = Math.max(...depths);
    for (const gate of gates.filter((candidate) => candidate.depth > minimum && candidate.depth <= maximum)) {
      const itemsCovered = gate.connection.traversal.requiredItems.every((item) =>
        connection.traversal.requiredItems.includes(item),
      );
      const flagsCovered = gate.connection.traversal.requiredFlags.every((flag) =>
        connection.traversal.requiredFlags.includes(flag),
      );
      if (!itemsCovered || !flagsCovered) {
        issues.push({
          code: "PROGRESSION_BYPASS",
          connectionId: connection.id,
          message: `${connection.id} bypasses mandatory gate ${gate.connection.id} without equivalent requirements`,
          severity: "error",
        });
      }
    }
  }
}

interface CorridorEndpoint {
  readonly connection: DungeonConnection;
  readonly inward: boolean;
  readonly outward: boolean;
  readonly roomId: string;
}

interface CorridorComponent {
  readonly connectionIds: ReadonlySet<string>;
  readonly endpoints: readonly CorridorEndpoint[];
}

function validateCorridorJunctionBypass(
  dungeon: DungeonValidationInput,
  roomById: ReadonlyMap<string, DungeonRoom>,
  issues: ValidationIssue[],
): void {
  const gates = dungeon.connections
    .filter((connection) => connection.mandatory
      && (connection.traversal.requiredFlags.length > 0
        || connection.traversal.requiredItems.length > 0))
    .map((connection) => ({
      connection,
      depth: Math.max(
        roomById.get(connection.from.roomId)?.progressionDepth ?? 0,
        roomById.get(connection.to.roomId)?.progressionDepth ?? 0,
      ),
    }));
  const reported = new Set<string>();
  for (const component of corridorComponents(dungeon.connections)) {
    if (component.connectionIds.size < 2) continue;
    for (const entry of component.endpoints.filter((endpoint) => endpoint.outward)) {
      for (const exit of component.endpoints.filter((endpoint) => endpoint.inward)) {
        if (entry.roomId === exit.roomId || entry.connection.id === exit.connection.id) continue;
        const entryDepth = roomById.get(entry.roomId)?.progressionDepth ?? 0;
        const exitDepth = roomById.get(exit.roomId)?.progressionDepth ?? 0;
        const minimum = Math.min(entryDepth, exitDepth);
        const maximum = Math.max(entryDepth, exitDepth);
        const routeItems = new Set([
          ...entry.connection.traversal.requiredItems,
          ...exit.connection.traversal.requiredItems,
        ]);
        const routeFlags = new Set([
          ...entry.connection.traversal.requiredFlags,
          ...exit.connection.traversal.requiredFlags,
        ]);
        for (const gate of gates.filter((candidate) =>
          candidate.depth > minimum && candidate.depth <= maximum)) {
          const protectedByItems = gate.connection.traversal.requiredItems.every((item) =>
            routeItems.has(item));
          const protectedByFlags = gate.connection.traversal.requiredFlags.every((flag) =>
            routeFlags.has(flag));
          if (protectedByItems && protectedByFlags) continue;
          const reportKey = [
            componentKey(component),
            gate.connection.id,
          ].join("|");
          if (reported.has(reportKey)) continue;
          reported.add(reportKey);
          issues.push({
            code: "CORRIDOR_JUNCTION_PROGRESSION_BYPASS",
            connectionId: exit.connection.id,
            message: `Shared corridor network lets ${entry.roomId} reach ${exit.roomId} around mandatory gate ${gate.connection.id}`,
            severity: "error",
          });
        }
      }
    }
  }
}

function progressionReachability(
  dungeon: DungeonValidationInput,
  roomById: ReadonlyMap<string, DungeonRoom>,
): Readonly<{ reachableRooms: ReadonlySet<string> }> {
  const start = roomById.get(dungeon.startRoomId);
  if (!start) return { reachableRooms: new Set() };
  const initial = collectGrants(new Set(), new Set(), start);
  const corridorNetwork = corridorComponents(dungeon.connections);
  const queue = [{ flags: initial.flags, inventory: initial.inventory, roomId: start.id }];
  const visited = new Set<string>();
  const reachableRooms = new Set<string>();
  for (let index = 0; index < queue.length; index += 1) {
    const state = queue[index];
    const stateKey = progressionStateKey(state.roomId, state.inventory, state.flags);
    if (visited.has(stateKey)) continue;
    visited.add(stateKey);
    reachableRooms.add(state.roomId);
    for (const connection of dungeon.connections.filter((candidate) => !candidate.corridor)) {
      const targetId = traversalTarget(connection, state.roomId);
      if (!targetId || !requirementsMet(connection, state.inventory, state.flags)) continue;
      const target = roomById.get(targetId);
      if (!target) continue;
      const collected = collectGrants(state.inventory, state.flags, target);
      const nextKey = progressionStateKey(target.id, collected.inventory, collected.flags);
      if (!visited.has(nextKey)) {
        queue.push({ ...collected, roomId: target.id });
      }
    }
    for (const targetId of corridorTraversalTargets(
      corridorNetwork,
      state.roomId,
      state.inventory,
      state.flags,
    )) {
      const target = roomById.get(targetId);
      if (!target) continue;
      const collected = collectGrants(state.inventory, state.flags, target);
      const nextKey = progressionStateKey(target.id, collected.inventory, collected.flags);
      if (!visited.has(nextKey)) queue.push({ ...collected, roomId: target.id });
    }
  }
  return { reachableRooms };
}

function corridorTraversalTargets(
  components: readonly CorridorComponent[],
  roomId: string,
  inventory: ReadonlySet<string>,
  flags: ReadonlySet<string>,
): ReadonlySet<string> {
  const targets = new Set<string>();
  for (const component of components) {
    const canEnter = component.endpoints.some((endpoint) =>
      endpoint.roomId === roomId
      && endpoint.outward
      && requirementsMet(endpoint.connection, inventory, flags));
    if (!canEnter) continue;
    for (const endpoint of component.endpoints) {
      if (
        endpoint.roomId !== roomId
        && endpoint.inward
        && requirementsMet(endpoint.connection, inventory, flags)
      ) targets.add(endpoint.roomId);
    }
  }
  return targets;
}

function corridorComponents(
  connections: readonly DungeonConnection[],
): readonly CorridorComponent[] {
  const routed = connections.filter((connection) => connection.corridor !== null);
  const parent = new Map(routed.map((connection) => [connection.id, connection.id]));
  const ownerByCell = new Map<string, string>();
  const find = (id: string): string => {
    const current = parent.get(id)!;
    if (current === id) return id;
    const root = find(current);
    parent.set(id, root);
    return root;
  };
  const union = (left: string, right: string) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) {
      const [first, second] = [leftRoot, rightRoot].sort();
      parent.set(second, first);
    }
  };
  for (const connection of routed) {
    for (const cell of connection.corridor!.cells) {
      const key = cellKey(cell);
      const owner = ownerByCell.get(key);
      if (owner) union(owner, connection.id);
      else ownerByCell.set(key, connection.id);
    }
  }
  const grouped = new Map<string, DungeonConnection[]>();
  for (const connection of routed) {
    const root = find(connection.id);
    const group = grouped.get(root) ?? [];
    group.push(connection);
    grouped.set(root, group);
  }
  return [...grouped.values()].map((group) => ({
    connectionIds: new Set(group.map((connection) => connection.id)),
    endpoints: group.flatMap((connection): CorridorEndpoint[] => [
      {
        connection,
        inward: connection.traversal.direction !== "from-to",
        outward: connection.traversal.direction !== "to-from",
        roomId: connection.from.roomId,
      },
      {
        connection,
        inward: connection.traversal.direction !== "to-from",
        outward: connection.traversal.direction !== "from-to",
        roomId: connection.to.roomId,
      },
    ]),
  }));
}

function componentKey(component: CorridorComponent): string {
  return [...component.connectionIds].sort().join(",");
}

function traversalTarget(connection: DungeonConnection, roomId: string): string | null {
  if (
    connection.from.roomId === roomId
    && connection.traversal.direction !== "to-from"
  ) {
    return connection.to.roomId;
  }
  if (
    connection.to.roomId === roomId
    && connection.traversal.direction !== "from-to"
  ) {
    return connection.from.roomId;
  }
  return null;
}

function requirementsMet(
  connection: DungeonConnection,
  inventory: ReadonlySet<string>,
  flags: ReadonlySet<string>,
): boolean {
  return (
    connection.traversal.requiredItems.every((item) => inventory.has(item))
    && connection.traversal.requiredFlags.every((flag) => flags.has(flag))
  );
}

function collectGrants(
  inventory: ReadonlySet<string>,
  flags: ReadonlySet<string>,
  room: DungeonRoom,
): Readonly<{ flags: Set<string>; inventory: Set<string> }> {
  return {
    flags: new Set([...flags, ...room.grants.flags]),
    inventory: new Set([...inventory, ...room.grants.items]),
  };
}

function progressionStateKey(
  roomId: string,
  inventory: ReadonlySet<string>,
  flags: ReadonlySet<string>,
): string {
  return `${roomId}|${[...inventory].sort().join(",")}|${[...flags].sort().join(",")}`;
}

function graphReachable(
  dungeon: DungeonValidationInput,
  startRoomId: string,
  include: (connection: DungeonConnection) => boolean = () => true,
): Set<string> {
  const visited = new Set([startRoomId]);
  const queue = [startRoomId];
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const connection of dungeon.connections) {
      if (!include(connection)) continue;
      const other =
        connection.from.roomId === current
          ? connection.to.roomId
          : connection.to.roomId === current
            ? connection.from.roomId
            : null;
      if (other && !visited.has(other)) {
        visited.add(other);
        queue.push(other);
      }
    }
  }
  return visited;
}

function inBounds(cell: GridCell, dungeon: DungeonValidationInput): boolean {
  return (
    Number.isInteger(cell.floor)
    && Number.isInteger(cell.x)
    && Number.isInteger(cell.z)
    && cell.floor >= 0
    && cell.floor < dungeon.config.world.floors
    && cell.x >= 0
    && cell.x < dungeon.config.world.width
    && cell.z >= 0
    && cell.z < dungeon.config.world.depth
  );
}

function gridDistance(left: GridCell, right: GridCell): number {
  return (
    Math.abs(left.floor - right.floor)
    + Math.abs(left.x - right.x)
    + Math.abs(left.z - right.z)
  );
}

function uniqueMap<T>(
  values: readonly T[],
  keyFor: (value: T) => string,
  code: string,
  issues: ValidationIssue[],
): Map<string, T> {
  const result = new Map<string, T>();
  for (const value of values) {
    const key = keyFor(value);
    if (result.has(key)) {
      issues.push({ code, message: `${key} is duplicated`, severity: "error" });
    }
    result.set(key, value);
  }
  return result;
}

function compareIssues(left: ValidationIssue, right: ValidationIssue): number {
  return (
    left.severity.localeCompare(right.severity)
    || left.code.localeCompare(right.code)
    || (left.roomId ?? "").localeCompare(right.roomId ?? "")
    || (left.connectionId ?? "").localeCompare(right.connectionId ?? "")
    || left.message.localeCompare(right.message)
  );
}
