import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { generateDungeon } from "../generator";
import { cellKey, stableStringify } from "../identity";
import { decodeDungeon, encodeDungeon } from "../serialization";
import { validateDungeon } from "../validation";
import type { Dungeon, GenerationConfigInput } from "../types";

const FAST_CONFIG: GenerationConfigInput = {
  placement: { candidateLimitPerRoom: 100, maxBacktracks: 3_000, maxRetries: 3 },
  progression: {
    breakableRoutes: 1,
    keyLockPairs: 1,
    portals: 1,
    secretRoutes: 1,
    shortcuts: 1,
  },
  semantics: { shopCount: { min: 1, max: 1 } },
  topology: {
    branchBudget: 2,
    criticalPathLength: { min: 7, max: 7 },
    deadEndCount: { min: 4, max: 4 },
    hubCount: { min: 1, max: 1 },
    loopCount: { min: 1, max: 1 },
    totalRooms: { min: 10, max: 10 },
  },
  world: { depth: 40, width: 40 },
};

describe("fast-check canonical invariants", () => {
  test("shrinks and replays deterministic integer seeds", () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const first = generateDungeon({ config: FAST_CONFIG, seed });
        const second = generateDungeon({ config: FAST_CONFIG, seed });
        expect(first.ok, first.ok ? undefined : `${seed}:${first.error.code}`).toBe(true);
        expect(second.ok, second.ok ? undefined : `${seed}:${second.error.code}`).toBe(true);
        if (!first.ok || !second.ok) return;
        expect(stableStringify(second.dungeon)).toBe(stableStringify(first.dungeon));
        assertHardInvariants(first.dungeon);
      }),
      { numRuns: 8, seed: 0x5eed_2026 },
    );
  }, 30_000);

  test("covers deterministic layered occupancy and vertical reachability", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 1, max: 3 }), (seed, floors) => {
        const result = generateDungeon({
          config: { ...FAST_CONFIG, world: { ...FAST_CONFIG.world, floors } },
          seed: `fc-floor:${seed}:${floors}`,
        });
        expect(result.ok, result.ok ? undefined : result.error.message).toBe(true);
        if (!result.ok) return;
        assertHardInvariants(result.dungeon);
        expect(new Set(result.dungeon.rooms.map((room) => room.transform.origin.floor)).size)
          .toBe(floors);
        if (floors > 1) {
          expect(result.dungeon.connections.some((connection) => connection.vertical !== null))
            .toBe(true);
        }
      }),
      { numRuns: 6, seed: 0x1a2b_3c4d },
    );
  }, 30_000);
});

function assertHardInvariants(dungeon: Dungeon): void {
  const report = validateDungeon(dungeon);
  expect(report.valid, JSON.stringify(report.issues)).toBe(true);
  expect(report.physicallyTraversable).toBe(true);
  expect(report.progressionSolvable).toBe(true);
  expect(dungeon.rooms.filter((room) => room.role === "start")).toHaveLength(1);
  expect(dungeon.rooms.filter((room) => room.role === "end")).toHaveLength(1);
  const occupied = new Set<string>();
  const socketIds = new Set<string>();
  for (const room of dungeon.rooms) {
    for (const cell of room.footprint.cells) {
      const key = cellKey(cell);
      expect(occupied.has(key)).toBe(false);
      occupied.add(key);
    }
    for (const socket of room.sockets) {
      expect(socketIds.has(socket.id)).toBe(false);
      socketIds.add(socket.id);
    }
  }
  expect(decodeDungeon(encodeDungeon(dungeon))).toEqual(dungeon);
}
