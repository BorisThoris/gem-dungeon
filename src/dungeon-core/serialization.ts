import { deepFreeze, resolveGenerationConfig } from "./config";
import { hashValue, stableStringify } from "./identity";
import { computeDungeonMetrics } from "./metrics";
import { freezeDungeon } from "./model";
import {
  DUNGEON_SCHEMA_VERSION,
  type Dungeon,
  type DungeonRoom,
} from "./types";
import { validateDungeon } from "./validation";

const LEGACY_SCHEMA_VERSION = "1.0.0";
const MIGRATION_GENERATOR_VERSION = "migration-v1-to-v2";

export class DungeonSerializationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "DungeonSerializationError";
    this.code = code;
  }
}

export function encodeDungeon(dungeon: Dungeon, space = 0): string {
  assertCanonicalDungeon(dungeon);
  return stableStringify(dungeon, space);
}

export function decodeDungeon(serialized: string): Dungeon {
  let document: unknown;
  try {
    document = JSON.parse(serialized) as unknown;
  } catch (cause) {
    throw new DungeonSerializationError(
      "DUNGEON_JSON_INVALID",
      `Dungeon JSON could not be parsed: ${errorMessage(cause)}`,
    );
  }
  const migrated = migrateDungeonDocument(document);
  assertCanonicalDungeon(migrated);
  return freezeDungeon(migrated);
}

export function migrateDungeonDocument(document: unknown): Dungeon {
  const record = requireRecord(document, "dungeon document");
  switch (record.schemaVersion) {
    case DUNGEON_SCHEMA_VERSION:
      return record as unknown as Dungeon;
    case LEGACY_SCHEMA_VERSION:
      return migrateV1ToV2(record);
    default:
      throw new DungeonSerializationError(
        "DUNGEON_SCHEMA_UNSUPPORTED",
        `Unsupported dungeon schema version ${String(record.schemaVersion)}`,
      );
  }
}

function migrateV1ToV2(record: Record<string, unknown>): Dungeon {
  if (!Array.isArray(record.rooms) || !Array.isArray(record.connections)) {
    throw new DungeonSerializationError(
      "DUNGEON_V1_SHAPE_INVALID",
      "Legacy dungeon must contain room and connection arrays",
    );
  }
  const config = resolveGenerationConfig(
    requireRecord(record.config, "legacy config") as never,
  );
  const rooms = record.rooms.map((rawRoom, index) => {
    const room = requireRecord(rawRoom, `legacy room ${index}`);
    const criticalPathIndex =
      typeof room.criticalPathIndex === "number" ? room.criticalPathIndex : null;
    return {
      ...room,
      biome: typeof room.biome === "string" ? room.biome : "legacy",
      branchDepth: typeof room.branchDepth === "number" ? room.branchDepth : 0,
      progressionDepth:
        typeof room.progressionDepth === "number"
          ? room.progressionDepth
          : criticalPathIndex ?? 0,
      shape: typeof room.shape === "string" ? room.shape : "square",
      tags: Array.isArray(room.tags) ? room.tags : ["migrated:v1"],
    } as unknown as DungeonRoom;
  });
  const candidate = {
    bossRoomId: requireString(record.bossRoomId, "legacy bossRoomId"),
    config,
    connections: record.connections as Dungeon["connections"],
    endRoomId: requireString(record.endRoomId, "legacy endRoomId"),
    floors: config.world.floors,
    rooms,
    startRoomId: requireString(record.startRoomId, "legacy startRoomId"),
  };
  const report = validateDungeon(candidate);
  if (!report.valid) {
    throw new DungeonSerializationError(
      "DUNGEON_V1_MIGRATION_INVALID",
      `Legacy dungeon cannot migrate cleanly: ${report.issues
        .filter((issue) => issue.severity === "error")
        .map((issue) => issue.code)
        .join(", ")}`,
    );
  }
  const metrics = computeDungeonMetrics(candidate);
  const legacyReplay = isRecord(record.replay) ? record.replay : {};
  return freezeDungeon({
    ...candidate,
    metrics,
    replay: {
      configHash: hashValue(config),
      generatorVersion: MIGRATION_GENERATOR_VERSION,
      seed: typeof legacyReplay.seed === "string" ? legacyReplay.seed : "legacy-v1",
      spatialHash: metrics.spatialHash,
      templateSetVersion:
        typeof legacyReplay.templateSetVersion === "string"
          ? legacyReplay.templateSetVersion
          : "templates-legacy-v1",
      topologyHash: metrics.topologyHash,
    },
    schemaVersion: DUNGEON_SCHEMA_VERSION,
  });
}

function assertCanonicalDungeon(dungeon: Dungeon): void {
  const record = requireRecord(dungeon, "canonical dungeon");
  if (record.schemaVersion !== DUNGEON_SCHEMA_VERSION) {
    throw new DungeonSerializationError(
      "DUNGEON_SCHEMA_NOT_CANONICAL",
      `Expected schema ${DUNGEON_SCHEMA_VERSION}, received ${String(record.schemaVersion)}`,
    );
  }
  if (!Array.isArray(record.rooms) || !Array.isArray(record.connections)) {
    throw new DungeonSerializationError(
      "DUNGEON_SHAPE_INVALID",
      "Canonical dungeon must contain room and connection arrays",
    );
  }
  const report = validateDungeon(dungeon);
  if (!report.valid) {
    throw new DungeonSerializationError(
      "DUNGEON_INVARIANTS_INVALID",
      `Canonical dungeon is invalid: ${report.issues
        .filter((issue) => issue.severity === "error")
        .map((issue) => issue.code)
        .join(", ")}`,
    );
  }
  const metrics = computeDungeonMetrics(dungeon);
  if (stableStringify(metrics) !== stableStringify(dungeon.metrics)) {
    throw new DungeonSerializationError(
      "DUNGEON_METRICS_STALE",
      "Canonical metrics do not match the serialized dungeon graph and geometry",
    );
  }
  if (
    dungeon.replay.configHash !== hashValue(dungeon.config)
    || dungeon.replay.topologyHash !== metrics.topologyHash
    || dungeon.replay.spatialHash !== metrics.spatialHash
  ) {
    throw new DungeonSerializationError(
      "DUNGEON_REPLAY_IDENTITY_STALE",
      "Replay identity does not match canonical config, topology, or geometry",
    );
  }
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new DungeonSerializationError(
      "DUNGEON_DOCUMENT_SHAPE_INVALID",
      `${label} must be a JSON object`,
    );
  }
  return value;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new DungeonSerializationError(
      "DUNGEON_DOCUMENT_FIELD_INVALID",
      `${label} must be a non-empty string`,
    );
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

export const SUPPORTED_DUNGEON_SCHEMA_VERSIONS = deepFreeze([
  LEGACY_SCHEMA_VERSION,
  DUNGEON_SCHEMA_VERSION,
] as const);
