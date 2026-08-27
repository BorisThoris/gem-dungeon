import { deepFreeze } from "./config";
import {
  cellKey,
  compareGridCells,
  compareLocalCells,
  hashValue,
  localCellKey,
} from "./identity";
import type {
  ConnectionKind,
  Footprint,
  GridBounds,
  GridCell,
  GridVector,
  LocalCell,
  RoomArchetype,
  RoomShape,
  RoomTemplate,
  Rotation,
  Socket,
  TemplateSocket,
} from "./types";

const HORIZONTAL_DIRECTIONS = [
  { id: "north", normal: { x: 0, y: 0, z: -1 } },
  { id: "east", normal: { x: 1, y: 0, z: 0 } },
  { id: "south", normal: { x: 0, y: 0, z: 1 } },
  { id: "west", normal: { x: -1, y: 0, z: 0 } },
] as const satisfies readonly Readonly<{ id: string; normal: GridVector }>[];

const ORDINARY_KINDS: readonly ConnectionKind[] = [
  "door",
  "corridor",
  "secret",
  "breakable",
  "portal",
];

const VERTICAL_KINDS: readonly ConnectionKind[] = [
  "stairs",
  "elevator",
  "drop",
  "ladder",
];

const GENERAL_ARCHETYPES: readonly RoomArchetype[] = [
  "normal",
  "enemy",
  "challenge",
  "puzzle",
  "treasure",
  "shop",
  "rest",
  "secret",
  "gate",
  "boss-approach",
];

export const ROOM_SHAPE_FOOTPRINTS: Readonly<Record<RoomShape, readonly LocalCell[]>> =
  deepFreeze({
    square: [{ x: 0, z: 0 }],
    line: [
      { x: 0, z: -1 },
      { x: 0, z: 0 },
      { x: 0, z: 1 },
    ],
    block: [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 0, z: 1 },
      { x: 1, z: 1 },
    ],
    L: [
      { x: 0, z: 0 },
      { x: 0, z: 1 },
      { x: 0, z: 2 },
      { x: 1, z: 2 },
    ],
    T: [
      { x: -1, z: 0 },
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 0, z: 1 },
    ],
    plus: [
      { x: 0, z: -1 },
      { x: -1, z: 0 },
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 0, z: 1 },
    ],
    U: [
      { x: -1, z: -1 },
      { x: -1, z: 0 },
      { x: -1, z: 1 },
      { x: 0, z: 1 },
      { x: 1, z: -1 },
      { x: 1, z: 0 },
      { x: 1, z: 1 },
    ],
    C: [
      { x: -1, z: -1 },
      { x: 0, z: -1 },
      { x: 1, z: -1 },
      { x: -1, z: 0 },
      { x: -1, z: 1 },
      { x: 0, z: 1 },
      { x: 1, z: 1 },
    ],
    H: [
      { x: -1, z: -1 },
      { x: -1, z: 0 },
      { x: -1, z: 1 },
      { x: 0, z: 0 },
      { x: 1, z: -1 },
      { x: 1, z: 0 },
      { x: 1, z: 1 },
    ],
  });

export const DEFAULT_ROOM_TEMPLATES: readonly RoomTemplate[] = deepFreeze([
  createRoomTemplate("square", "Square", "square", ROOM_SHAPE_FOOTPRINTS.square, [
    ...GENERAL_ARCHETYPES,
    "start",
    "end",
  ]),
  createRoomTemplate("line", "Line", "line", ROOM_SHAPE_FOOTPRINTS.line, GENERAL_ARCHETYPES),
  createRoomTemplate("block", "Block", "block", ROOM_SHAPE_FOOTPRINTS.block, [
    ...GENERAL_ARCHETYPES,
    "boss",
  ]),
  createRoomTemplate("l-room", "L Room", "L", ROOM_SHAPE_FOOTPRINTS.L, GENERAL_ARCHETYPES),
  createRoomTemplate("t-room", "T Room", "T", ROOM_SHAPE_FOOTPRINTS.T, GENERAL_ARCHETYPES),
  createRoomTemplate(
    "plus-hub",
    "Plus Hub",
    "plus",
    ROOM_SHAPE_FOOTPRINTS.plus,
    [...GENERAL_ARCHETYPES, "shop"],
  ),
  createRoomTemplate("u-room", "U Room", "U", ROOM_SHAPE_FOOTPRINTS.U, GENERAL_ARCHETYPES),
  createRoomTemplate("c-room", "C Room", "C", ROOM_SHAPE_FOOTPRINTS.C, GENERAL_ARCHETYPES),
  createRoomTemplate("h-room", "H Room", "H", ROOM_SHAPE_FOOTPRINTS.H, GENERAL_ARCHETYPES),
]);

export function createRoomTemplate(
  id: string,
  name: string,
  shape: RoomShape,
  footprint: readonly LocalCell[],
  allowedArchetypes: readonly RoomArchetype[],
  options: Readonly<{
    allowedRotations?: readonly Rotation[];
    clearance?: readonly LocalCell[];
    includeVerticalSockets?: boolean;
    version?: number;
  }> = {},
): RoomTemplate {
  const sortedFootprint = uniqueLocalCells(footprint, `${id}.footprint`);
  assertConnectedFootprint(sortedFootprint, id);
  const footprintKeys = new Set(sortedFootprint.map(localCellKey));
  const requestedClearance = options.clearance
    ?? generateBoundaryClearance(sortedFootprint);
  const clearance = uniqueLocalCells(requestedClearance, `${id}.clearance`).filter(
    (cell) => !footprintKeys.has(localCellKey(cell)),
  );
  const sockets = generateTemplateSockets(
    sortedFootprint,
    options.includeVerticalSockets ?? true,
  );

  if (id.trim().length === 0 || name.trim().length === 0) {
    throw new Error("Room template id and name must not be empty");
  }
  if (allowedArchetypes.length === 0) {
    throw new Error(`Room template ${id} must allow at least one archetype`);
  }

  const allowedRotations: readonly Rotation[] = [
    ...new Set<Rotation>(options.allowedRotations ?? [0, 90, 180, 270]),
  ].sort((left, right) => left - right);

  return deepFreeze({
    allowedArchetypes: [...new Set(allowedArchetypes)].sort(),
    allowedRotations,
    clearance,
    footprint: sortedFootprint,
    id,
    name,
    shape,
    sockets,
    version: options.version ?? 1,
  });
}

export function validateTemplateSet(templates: readonly RoomTemplate[]): readonly RoomTemplate[] {
  if (templates.length === 0) {
    throw new Error("Template set must contain at least one room template");
  }
  const ids = new Set<string>();
  const validated: RoomTemplate[] = [];
  for (const template of templates) {
    if (ids.has(template.id)) {
      throw new Error(`Duplicate room template id ${template.id}`);
    }
    ids.add(template.id);
    const structuralCopy = createRoomTemplate(
      template.id,
      template.name,
      template.shape,
      template.footprint,
      template.allowedArchetypes,
      {
        allowedRotations: template.allowedRotations,
        clearance: template.clearance,
        includeVerticalSockets: template.sockets.some((socket) => socket.normal.y !== 0),
        version: template.version,
      },
    );
    if (!Number.isInteger(template.version) || template.version < 1) {
      throw new Error(`Room template ${template.id} version must be a positive integer`);
    }
    if (template.allowedRotations.length === 0) {
      throw new Error(`Room template ${template.id} must allow at least one rotation`);
    }
    if (new Set(template.allowedRotations).size !== template.allowedRotations.length) {
      throw new Error(`Room template ${template.id} contains duplicate rotations`);
    }
    if (template.sockets.length === 0) {
      throw new Error(`Room template ${template.id} must expose at least one socket`);
    }
    const footprintKeys = new Set(template.footprint.map(localCellKey));
    const socketIds = new Set<string>();
    for (const socket of template.sockets) {
      validateTemplateSocket(template, socket, footprintKeys, socketIds);
    }
    validated.push(deepFreeze({
      ...structuralCopy,
      allowedArchetypes: [...template.allowedArchetypes],
      allowedRotations: [...template.allowedRotations],
      sockets: template.sockets.map((socket) => ({
        ...socket,
        allowedConnectionKinds: [...socket.allowedConnectionKinds],
        aperture: { ...socket.aperture },
        cell: { ...socket.cell },
        compatibility: [...socket.compatibility],
        normal: { ...socket.normal },
      })),
    }));
  }
  return deepFreeze(validated.sort((left, right) => left.id.localeCompare(right.id)));
}

export function getTemplateSetVersion(templates: readonly RoomTemplate[]): string {
  return `templates-${hashValue(
    [...templates]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((template) => ({
        allowedArchetypes: template.allowedArchetypes,
        allowedRotations: template.allowedRotations,
        clearance: template.clearance,
        footprint: template.footprint,
        id: template.id,
        shape: template.shape,
        sockets: template.sockets,
        version: template.version,
      })),
  )}`;
}

export function transformLocalCell(cell: LocalCell, rotation: Rotation): LocalCell {
  switch (rotation) {
    case 0:
      return { x: cell.x, z: cell.z };
    case 90:
      return { x: -cell.z, z: cell.x };
    case 180:
      return { x: -cell.x, z: -cell.z };
    case 270:
      return { x: cell.z, z: -cell.x };
  }
}

export function transformVector(vector: GridVector, rotation: Rotation): GridVector {
  const transformed = transformLocalCell({ x: vector.x, z: vector.z }, rotation);
  return { x: toUnit(transformed.x), y: vector.y, z: toUnit(transformed.z) };
}

export function placeTemplate(
  template: RoomTemplate,
  roomId: string,
  origin: GridCell,
  rotation: Rotation,
): Readonly<{ footprint: Footprint; sockets: readonly Socket[] }> {
  if (!template.allowedRotations.includes(rotation)) {
    throw new Error(`Template ${template.id} does not allow rotation ${rotation}`);
  }
  const cells = template.footprint
    .map((cell) => toGridCell(transformLocalCell(cell, rotation), origin))
    .sort(compareGridCells);
  const cellKeys = new Set(cells.map(cellKey));
  const clearance = template.clearance
    .map((cell) => toGridCell(transformLocalCell(cell, rotation), origin))
    .filter((cell) => !cellKeys.has(cellKey(cell)))
    .sort(compareGridCells);
  const footprint: Footprint = {
    bounds: boundsForCells(cells),
    cells,
    clearance,
  };
  const sockets = template.sockets.map((socket) => {
    const normal = transformVector(socket.normal, rotation);
    const cell = toGridCell(transformLocalCell(socket.cell, rotation), origin);
    const exteriorCell: GridCell = {
      floor: cell.floor + normal.y,
      x: cell.x + normal.x,
      z: cell.z + normal.z,
    };
    return {
      allowedConnectionKinds: socket.allowedConnectionKinds,
      aperture: socket.aperture,
      cell,
      compatibility: socket.compatibility,
      exteriorCell,
      id: `${roomId}:socket:${socket.id}`,
      normal,
      roomId,
      shareable: socket.shareable ?? false,
      templateSocketId: socket.id,
    } satisfies Socket;
  });

  return deepFreeze({ footprint, sockets });
}

export function boundsForCells(cells: readonly GridCell[]): GridBounds {
  if (cells.length === 0) {
    throw new Error("Cannot calculate bounds for an empty footprint");
  }
  return {
    maxFloor: Math.max(...cells.map((cell) => cell.floor)),
    maxX: Math.max(...cells.map((cell) => cell.x)),
    maxZ: Math.max(...cells.map((cell) => cell.z)),
    minFloor: Math.min(...cells.map((cell) => cell.floor)),
    minX: Math.min(...cells.map((cell) => cell.x)),
    minZ: Math.min(...cells.map((cell) => cell.z)),
  };
}

function generateTemplateSockets(
  footprint: readonly LocalCell[],
  includeVerticalSockets: boolean,
): TemplateSocket[] {
  const occupied = new Set(footprint.map(localCellKey));
  const sockets: TemplateSocket[] = [];
  for (const cell of footprint) {
    for (const direction of HORIZONTAL_DIRECTIONS) {
      const exterior = {
        x: cell.x + direction.normal.x,
        z: cell.z + direction.normal.z,
      };
      if (!occupied.has(localCellKey(exterior))) {
        sockets.push({
          allowedConnectionKinds: ORDINARY_KINDS,
          aperture: { height: 2.4, width: 1.5 },
          cell,
          compatibility: ["standard"],
          id: `${cell.x}_${cell.z}_${direction.id}`,
          normal: direction.normal,
        });
      }
    }
  }

  if (includeVerticalSockets) {
    const anchor = [...footprint].sort(
      (left, right) =>
        Math.abs(left.x) + Math.abs(left.z) - (Math.abs(right.x) + Math.abs(right.z))
        || compareLocalCells(left, right),
    )[0];
    sockets.push(
      {
        allowedConnectionKinds: VERTICAL_KINDS,
        aperture: { height: 3, width: 2 },
        cell: anchor,
        compatibility: ["vertical"],
        id: `${anchor.x}_${anchor.z}_up`,
        normal: { x: 0, y: 1, z: 0 },
      },
      {
        allowedConnectionKinds: VERTICAL_KINDS,
        aperture: { height: 3, width: 2 },
        cell: anchor,
        compatibility: ["vertical"],
        id: `${anchor.x}_${anchor.z}_down`,
        normal: { x: 0, y: -1, z: 0 },
      },
    );
  }
  return sockets.sort((left, right) => left.id.localeCompare(right.id));
}

function generateBoundaryClearance(footprint: readonly LocalCell[]): LocalCell[] {
  const occupied = new Set(footprint.map(localCellKey));
  const clearance: LocalCell[] = [];
  for (const cell of footprint) {
    for (const direction of HORIZONTAL_DIRECTIONS) {
      const neighbor = {
        x: cell.x + direction.normal.x,
        z: cell.z + direction.normal.z,
      };
      if (!occupied.has(localCellKey(neighbor))) {
        clearance.push(neighbor);
      }
    }
  }
  return [...new Map(clearance.map((cell) => [localCellKey(cell), cell])).values()]
    .sort(compareLocalCells);
}

function validateTemplateSocket(
  template: RoomTemplate,
  socket: TemplateSocket,
  footprintKeys: ReadonlySet<string>,
  socketIds: Set<string>,
): void {
  if (socket.id.trim().length === 0 || socketIds.has(socket.id)) {
    throw new Error(`Room template ${template.id} has an empty or duplicate socket id ${socket.id}`);
  }
  socketIds.add(socket.id);
  if (!footprintKeys.has(localCellKey(socket.cell))) {
    throw new Error(`Room template ${template.id} socket ${socket.id} is not on its footprint`);
  }
  const { x, y, z } = socket.normal;
  if (
    !Number.isInteger(x)
    || !Number.isInteger(y)
    || !Number.isInteger(z)
    || Math.abs(x) > 1
    || Math.abs(y) > 1
    || Math.abs(z) > 1
    || (x === 0 && y === 0 && z === 0)
    || (y !== 0 && (x !== 0 || z !== 0))
  ) {
    throw new Error(`Room template ${template.id} socket ${socket.id} has an invalid normal`);
  }
  if (
    y === 0
    && footprintKeys.has(localCellKey({ x: socket.cell.x + x, z: socket.cell.z + z }))
  ) {
    throw new Error(`Room template ${template.id} socket ${socket.id} points inside its footprint`);
  }
  if (
    !Number.isFinite(socket.aperture.width)
    || !Number.isFinite(socket.aperture.height)
    || socket.aperture.width <= 0
    || socket.aperture.height <= 0
  ) {
    throw new Error(`Room template ${template.id} socket ${socket.id} has an invalid aperture`);
  }
  if (
    socket.compatibility.length === 0
    || socket.compatibility.some((code) => code.trim().length === 0)
    || new Set(socket.compatibility).size !== socket.compatibility.length
  ) {
    throw new Error(`Room template ${template.id} socket ${socket.id} has invalid compatibility codes`);
  }
  if (
    socket.allowedConnectionKinds.length === 0
    || new Set(socket.allowedConnectionKinds).size !== socket.allowedConnectionKinds.length
  ) {
    throw new Error(`Room template ${template.id} socket ${socket.id} has invalid connection kinds`);
  }
  if (
    (y === 0 && socket.allowedConnectionKinds.some((kind) => VERTICAL_KINDS.includes(kind)))
    || (y !== 0 && socket.allowedConnectionKinds.some((kind) => !VERTICAL_KINDS.includes(kind)))
  ) {
    throw new Error(`Room template ${template.id} socket ${socket.id} mixes horizontal and vertical kinds`);
  }
}

function uniqueLocalCells(cells: readonly LocalCell[], label: string): LocalCell[] {
  const seen = new Set<string>();
  const result: LocalCell[] = [];
  for (const cell of cells) {
    if (!Number.isInteger(cell.x) || !Number.isInteger(cell.z)) {
      throw new Error(`${label} cells must use integer coordinates`);
    }
    const key = localCellKey(cell);
    if (seen.has(key)) {
      throw new Error(`${label} contains duplicate cell ${key}`);
    }
    seen.add(key);
    result.push({ x: cell.x, z: cell.z });
  }
  if (result.length === 0 && label.endsWith(".footprint")) {
    throw new Error(`${label} must not be empty`);
  }
  return result.sort(compareLocalCells);
}

function assertConnectedFootprint(cells: readonly LocalCell[], templateId: string): void {
  const remaining = new Set(cells.map(localCellKey));
  const queue = [cells[0]];
  remaining.delete(localCellKey(cells[0]));
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const direction of HORIZONTAL_DIRECTIONS) {
      const neighbor = {
        x: current.x + direction.normal.x,
        z: current.z + direction.normal.z,
      };
      const key = localCellKey(neighbor);
      if (remaining.delete(key)) {
        queue.push(neighbor);
      }
    }
  }
  if (remaining.size > 0) {
    throw new Error(`Room template ${templateId} footprint must be 4-neighbor connected`);
  }
}

function toGridCell(cell: LocalCell, origin: GridCell): GridCell {
  return { floor: origin.floor, x: origin.x + cell.x, z: origin.z + cell.z };
}

function toUnit(value: number): -1 | 0 | 1 {
  if (value < 0) return -1;
  if (value > 0) return 1;
  return 0;
}
