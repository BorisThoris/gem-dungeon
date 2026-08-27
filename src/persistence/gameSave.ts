import { stableStringify } from "../dungeon-core/identity";
import {
  dungeonRunStateFromDocument,
  toDungeonRunStateDocument,
  type DungeonRunStateDocument,
} from "../dungeon-core/run-state-serialization";
import { decodeDungeon, encodeDungeon } from "../dungeon-core/serialization";
import type { Dungeon, DungeonRunState } from "../dungeon-core/types";
import type { PersistedGameState, PlayerStats } from "../store/gameStore";
import type { Item } from "../types/map";

export const GAME_SAVE_SCHEMA_VERSION = "2.0.0" as const;

export interface CanonicalGameSaveDocument {
  readonly dungeon: unknown;
  readonly dungeonRunState: DungeonRunStateDocument;
  readonly gameState: PersistedGameState;
  readonly schemaVersion: typeof GAME_SAVE_SCHEMA_VERSION;
  readonly timestamp: number;
}

export interface DecodedGameSave {
  readonly dungeon: Dungeon;
  readonly dungeonRunState: DungeonRunState;
  readonly gameState: PersistedGameState;
  readonly timestamp: number;
}

export class GameSaveError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "GameSaveError";
    this.code = code;
  }
}

export function encodeGameSave(
  dungeon: Dungeon,
  dungeonRunState: DungeonRunState,
  gameState: PersistedGameState,
  timestamp: number,
  space = 0,
): string {
  assertTimestamp(timestamp);
  assertPersistedGameState(gameState, dungeon, dungeonRunState);
  const document: CanonicalGameSaveDocument = {
    dungeon: JSON.parse(encodeDungeon(dungeon)) as unknown,
    dungeonRunState: toDungeonRunStateDocument(dungeon, dungeonRunState),
    gameState: clonePersistedGameState(gameState),
    schemaVersion: GAME_SAVE_SCHEMA_VERSION,
    timestamp,
  };
  return stableStringify(document, space);
}

export function decodeGameSave(serialized: string): DecodedGameSave {
  let value: unknown;
  try {
    value = JSON.parse(serialized) as unknown;
  } catch (cause) {
    throw new GameSaveError(
      "GAME_SAVE_JSON_INVALID",
      `Save JSON could not be parsed: ${errorMessage(cause)}`,
    );
  }
  const document = requireRecord(value, "save document");
  if (document.schemaVersion !== GAME_SAVE_SCHEMA_VERSION) {
    throw new GameSaveError(
      "GAME_SAVE_SCHEMA_UNSUPPORTED",
      `Unsupported save schema version ${String(document.schemaVersion)}`,
    );
  }
  const timestamp = requireNumber(document.timestamp, "timestamp");
  assertTimestamp(timestamp);
  const dungeon = decodeDungeon(stableStringify(document.dungeon));
  const dungeonRunState = dungeonRunStateFromDocument(
    dungeon,
    document.dungeonRunState,
  );
  const gameState = readPersistedGameState(document.gameState);
  assertPersistedGameState(gameState, dungeon, dungeonRunState);
  return {
    dungeon,
    dungeonRunState,
    gameState: clonePersistedGameState(gameState),
    timestamp,
  };
}

function assertPersistedGameState(
  state: PersistedGameState,
  dungeon: Dungeon,
  runState: DungeonRunState,
): void {
  const roomIds = new Set(dungeon.rooms.map((room) => room.id));
  if (state.currentRoomId !== null && !roomIds.has(state.currentRoomId)) {
    invalid(`Game state references missing room ${state.currentRoomId}`);
  }
  if (state.currentRoomId !== null && state.currentRoomId !== runState.currentRoomId) {
    invalid("Game state and canonical run state disagree about the current room");
  }
  for (const roomId of state.completedRooms) {
    if (!roomIds.has(roomId)) invalid(`Game state references missing room ${roomId}`);
  }
}

function readPersistedGameState(value: unknown): PersistedGameState {
  const record = requireRecord(value, "gameState");
  const phase = record.gamePhase;
  if (phase !== "exploration" && phase !== "puzzle" && phase !== "boss") {
    invalid("gameState.gamePhase is invalid");
  }
  const currentRoomId = record.currentRoomId;
  if (currentRoomId !== null && typeof currentRoomId !== "string") {
    invalid("gameState.currentRoomId must be a string or null");
  }
  const playerStats = requireRecord(record.playerStats, "gameState.playerStats");
  const inventory = requireArray(record.inventory, "gameState.inventory");
  return {
    completedRooms: readStringArray(record.completedRooms, "gameState.completedRooms"),
    currentFloor: requireFiniteNumber(record.currentFloor, "gameState.currentFloor"),
    currentRoomId,
    discoveredSecrets: readStringArray(
      record.discoveredSecrets,
      "gameState.discoveredSecrets",
    ),
    gamePhase: phase,
    inventory: inventory as Item[],
    playerStats: playerStats as unknown as PlayerStats,
    totalScore: requireFiniteNumber(record.totalScore, "gameState.totalScore"),
  };
}

function clonePersistedGameState(state: PersistedGameState): PersistedGameState {
  return {
    completedRooms: [...state.completedRooms],
    currentFloor: state.currentFloor,
    currentRoomId: state.currentRoomId,
    discoveredSecrets: [...state.discoveredSecrets],
    gamePhase: state.gamePhase,
    inventory: state.inventory.map((item) => ({
      ...item,
      effects: item.effects.map((effect) => ({ ...effect })),
    })),
    playerStats: {
      ...state.playerStats,
      buffs: { ...state.playerStats.buffs },
      dimensions: { ...state.playerStats.dimensions },
    },
    totalScore: state.totalScore,
  };
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    invalid(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireArray(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) invalid(`${label} must be an array`);
  return value as readonly unknown[];
}

function readStringArray(value: unknown, label: string): string[] {
  const array = requireArray(value, label);
  if (!array.every((entry) => typeof entry === "string")) {
    invalid(`${label} must contain only strings`);
  }
  return [...array] as string[];
}

function requireNumber(value: unknown, label: string): number {
  if (typeof value !== "number") invalid(`${label} must be a number`);
  return value as number;
}

function requireFiniteNumber(value: unknown, label: string): number {
  const number = requireNumber(value, label);
  if (!Number.isFinite(number)) invalid(`${label} must be finite`);
  return number;
}

function assertTimestamp(timestamp: number): void {
  if (!Number.isFinite(timestamp) || timestamp < 0) {
    invalid("Save timestamp must be a finite non-negative number");
  }
}

function invalid(message: string): never {
  throw new GameSaveError("GAME_SAVE_INVALID", message);
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
