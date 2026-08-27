import { stableStringify } from "./identity";
import { DungeonSerializationError } from "./serialization";
import type { Dungeon, DungeonRunState } from "./types";

export const DUNGEON_RUN_STATE_SCHEMA_VERSION = "1.0.0" as const;

export interface DungeonRunStateDocument {
  readonly completedRoomIds: readonly string[];
  readonly currentFloor: number;
  readonly currentRoomId: string;
  readonly dungeonSpatialHash: string;
  readonly flags: readonly string[];
  readonly inventory: readonly string[];
  readonly openedConnectionIds: readonly string[];
  readonly schemaVersion: typeof DUNGEON_RUN_STATE_SCHEMA_VERSION;
  readonly visitedRoomIds: readonly string[];
}

export function encodeDungeonRunState(
  dungeon: Dungeon,
  state: DungeonRunState,
  space = 0,
): string {
  assertDungeonRunState(dungeon, state);
  return stableStringify(toDungeonRunStateDocument(dungeon, state), space);
}

export function decodeDungeonRunState(
  dungeon: Dungeon,
  serialized: string,
): DungeonRunState {
  let document: unknown;
  try {
    document = JSON.parse(serialized) as unknown;
  } catch (cause) {
    throw new DungeonSerializationError(
      "DUNGEON_RUN_STATE_JSON_INVALID",
      `Dungeon run-state JSON could not be parsed: ${errorMessage(cause)}`,
    );
  }
  return dungeonRunStateFromDocument(dungeon, document);
}

export function toDungeonRunStateDocument(
  dungeon: Dungeon,
  state: DungeonRunState,
): DungeonRunStateDocument {
  assertDungeonRunState(dungeon, state);
  return {
    completedRoomIds: sorted(state.completedRoomIds),
    currentFloor: state.currentFloor,
    currentRoomId: state.currentRoomId,
    dungeonSpatialHash: dungeon.replay.spatialHash,
    flags: sorted(state.flags),
    inventory: sorted(state.inventory),
    openedConnectionIds: sorted(state.openedConnectionIds),
    schemaVersion: DUNGEON_RUN_STATE_SCHEMA_VERSION,
    visitedRoomIds: sorted(state.visitedRoomIds),
  };
}

export function dungeonRunStateFromDocument(
  dungeon: Dungeon,
  document: unknown,
): DungeonRunState {
  const record = requireRecord(document, "dungeon run-state document");
  if (record.schemaVersion !== DUNGEON_RUN_STATE_SCHEMA_VERSION) {
    throw new DungeonSerializationError(
      "DUNGEON_RUN_STATE_SCHEMA_UNSUPPORTED",
      `Unsupported dungeon run-state schema version ${String(record.schemaVersion)}`,
    );
  }
  if (record.dungeonSpatialHash !== dungeon.replay.spatialHash) {
    throw new DungeonSerializationError(
      "DUNGEON_RUN_STATE_DUNGEON_MISMATCH",
      "Dungeon run state belongs to a different canonical dungeon",
    );
  }

  const state: DungeonRunState = {
    completedRoomIds: new Set(readStringArray(record.completedRoomIds, "completedRoomIds")),
    currentFloor: readInteger(record.currentFloor, "currentFloor"),
    currentRoomId: readString(record.currentRoomId, "currentRoomId"),
    flags: new Set(readStringArray(record.flags, "flags")),
    inventory: new Set(readStringArray(record.inventory, "inventory")),
    openedConnectionIds: new Set(
      readStringArray(record.openedConnectionIds, "openedConnectionIds"),
    ),
    visitedRoomIds: new Set(readStringArray(record.visitedRoomIds, "visitedRoomIds")),
  };
  assertDungeonRunState(dungeon, state);
  return state;
}

export function assertDungeonRunState(
  dungeon: Dungeon,
  state: DungeonRunState,
): void {
  const roomById = new Map(dungeon.rooms.map((room) => [room.id, room]));
  const connectionIds = new Set(
    dungeon.connections.map((connection) => connection.id),
  );
  const currentRoom = roomById.get(state.currentRoomId);
  if (!currentRoom) {
    invalid(`Current room ${state.currentRoomId} is not in the dungeon`);
  }
  if (!Number.isInteger(state.currentFloor)
    || state.currentFloor < 0
    || state.currentFloor >= dungeon.floors) {
    invalid(`Current floor ${state.currentFloor} is outside the dungeon`);
  }
  if (currentRoom.transform.origin.floor !== state.currentFloor) {
    invalid(
      `Current floor ${state.currentFloor} does not match room ${state.currentRoomId}`,
    );
  }
  if (!state.visitedRoomIds.has(state.currentRoomId)) {
    invalid(`Current room ${state.currentRoomId} must be visited`);
  }

  for (const roomId of [...state.visitedRoomIds, ...state.completedRoomIds]) {
    if (!roomById.has(roomId)) invalid(`Run state references missing room ${roomId}`);
  }
  for (const connectionId of state.openedConnectionIds) {
    if (!connectionIds.has(connectionId)) {
      invalid(`Run state references missing connection ${connectionId}`);
    }
  }
  for (const value of [...state.flags, ...state.inventory]) {
    if (typeof value !== "string" || value.length === 0) {
      invalid("Run-state inventory and flags must contain non-empty strings");
    }
  }
}

function sorted(values: ReadonlySet<string>): readonly string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new DungeonSerializationError(
      "DUNGEON_RUN_STATE_SHAPE_INVALID",
      `${label} must be a JSON object`,
    );
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new DungeonSerializationError(
      "DUNGEON_RUN_STATE_FIELD_INVALID",
      `${label} must be a non-empty string`,
    );
  }
  return value;
}

function readStringArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) {
    throw new DungeonSerializationError(
      "DUNGEON_RUN_STATE_FIELD_INVALID",
      `${label} must be an array`,
    );
  }
  const strings = value.map((entry, index) => readString(entry, `${label}[${index}]`));
  if (new Set(strings).size !== strings.length) {
    throw new DungeonSerializationError(
      "DUNGEON_RUN_STATE_FIELD_INVALID",
      `${label} must not contain duplicates`,
    );
  }
  return strings;
}

function readInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value)) {
    throw new DungeonSerializationError(
      "DUNGEON_RUN_STATE_FIELD_INVALID",
      `${label} must be an integer`,
    );
  }
  return value as number;
}

function invalid(message: string): never {
  throw new DungeonSerializationError("DUNGEON_RUN_STATE_INVALID", message);
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
