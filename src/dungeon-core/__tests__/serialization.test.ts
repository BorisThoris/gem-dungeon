import { beforeAll, describe, expect, test } from "vitest";
import { generateDungeon } from "../generator";
import { stableStringify } from "../identity";
import {
  DungeonSerializationError,
  decodeDungeon,
  encodeDungeon,
  migrateDungeonDocument,
} from "../serialization";
import { DUNGEON_SCHEMA_VERSION, type Dungeon } from "../types";
import { validateDungeon } from "../validation";

describe("versioned canonical serialization", () => {
  let dungeon: Dungeon;

  beforeAll(() => {
    const result = generateDungeon({ seed: "serialization-fixture" });
    if (!result.ok) throw new Error(result.error.message);
    dungeon = result.dungeon;
  }, 30_000);

  test("round-trips canonical equality deterministically", () => {
    const encoded = encodeDungeon(dungeon);
    const decoded = decodeDungeon(encoded);
    expect(decoded).toEqual(dungeon);
    expect(encodeDungeon(decoded)).toBe(encoded);
    expect(Object.isFrozen(decoded)).toBe(true);
  });

  test("rejects stale identity and dangling endpoint corruption", () => {
    const stale = JSON.parse(encodeDungeon(dungeon)) as Record<string, any>;
    stale.metrics.nodeCount += 1;
    expect(() => decodeDungeon(stableStringify(stale))).toThrowError(DungeonSerializationError);
    try {
      decodeDungeon(stableStringify(stale));
    } catch (error) {
      expect((error as DungeonSerializationError).code).toBe("DUNGEON_METRICS_STALE");
    }

    const dangling = JSON.parse(encodeDungeon(dungeon)) as Record<string, any>;
    dangling.connections[0].from.socketId = "missing-socket";
    expect(() => decodeDungeon(stableStringify(dangling))).toThrow(/CONNECTION_DANGLING_SOCKET/);
  });

  test("migrates supported v1 documents deterministically", () => {
    const legacy = JSON.parse(encodeDungeon(dungeon)) as Record<string, any>;
    legacy.schemaVersion = "1.0.0";
    delete legacy.floors;
    delete legacy.metrics;
    for (const room of legacy.rooms) {
      delete room.biome;
      delete room.branchDepth;
      delete room.progressionDepth;
      delete room.tags;
    }

    const first = migrateDungeonDocument(legacy);
    const second = migrateDungeonDocument(JSON.parse(stableStringify(legacy)));
    expect(first).toEqual(second);
    expect(first.schemaVersion).toBe(DUNGEON_SCHEMA_VERSION);
    expect(first.rooms.every((room) => room.biome === "legacy")).toBe(true);
    expect(first.rooms.every((room) => room.tags.includes("migrated:v1"))).toBe(true);
    expect(validateDungeon(first).valid).toBe(true);
    expect(decodeDungeon(encodeDungeon(first))).toEqual(first);
  });

  test("rejects unknown schema versions explicitly", () => {
    expect(() => migrateDungeonDocument({ schemaVersion: "99.0.0" })).toThrow(
      /Unsupported dungeon schema version/,
    );
  });
});
