import { describe, expect, test } from "vitest";
import { canonicalDungeonToGameMap } from "../../adapters/canonicalMapAdapter";
import { generateDungeon } from "../generator";
import { createDungeonRunState, enterDungeonRoom } from "../model";

describe("temporary canonical-to-legacy map adapter", () => {
  test("derives legacy relationships without introducing another source of truth", () => {
    const generated = generateDungeon({ seed: "legacy-adapter" });
    expect(generated.ok, generated.ok ? undefined : generated.error.message).toBe(true);
    if (!generated.ok) return;
    const firstNeighbor = generated.dungeon.connections.find(
      (connection) => connection.from.roomId === generated.dungeon.startRoomId,
    )?.to.roomId ?? generated.dungeon.startRoomId;
    const state = enterDungeonRoom(
      generated.dungeon,
      createDungeonRunState(generated.dungeon),
      firstNeighbor,
    );
    const map = canonicalDungeonToGameMap(generated.dungeon, state);

    expect(map.id).toBe(`map_${generated.dungeon.replay.spatialHash}`);
    expect(map.generatedAt).toBe(0);
    expect(map.rooms).toHaveLength(generated.dungeon.rooms.length);
    expect(map.rooms.filter((room) => room.isCurrent).map((room) => room.id)).toEqual([
      firstNeighbor,
    ]);
    for (const legacyRoom of map.rooms) {
      const canonicalRoom = generated.dungeon.rooms.find((room) => room.id === legacyRoom.id)!;
      const expectedNeighbors = generated.dungeon.connections
        .filter(
          (connection) =>
            connection.from.roomId === canonicalRoom.id
            || connection.to.roomId === canonicalRoom.id,
        )
        .map((connection) =>
          connection.from.roomId === canonicalRoom.id
            ? connection.to.roomId
            : connection.from.roomId,
        );
      expect(legacyRoom.connections).toEqual([...new Set(expectedNeighbors)].sort());
      expect(legacyRoom.tilePositions).toHaveLength(canonicalRoom.footprint.cells.length);
      expect(legacyRoom.specialProperties?.canonicalFootprint).toEqual(canonicalRoom.footprint);
      for (const entry of legacyRoom.entryPoints ?? []) {
        expect(entry.connectedTo).toBeTruthy();
        expect(canonicalRoom.sockets.some((socket) => socket.id === entry.id)).toBe(true);
      }
    }
  }, 30_000);

  test("accepts timestamps only as explicit runtime adapter metadata", () => {
    const generated = generateDungeon({ seed: "legacy-runtime-time" });
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;
    const state = createDungeonRunState(generated.dungeon);
    const first = canonicalDungeonToGameMap(generated.dungeon, state, { generatedAt: 123 });
    const second = canonicalDungeonToGameMap(generated.dungeon, state, { generatedAt: 456 });
    expect(first.generatedAt).toBe(123);
    expect(second.generatedAt).toBe(456);
    expect({ ...first, generatedAt: 0 }).toEqual({ ...second, generatedAt: 0 });
  }, 30_000);
});
