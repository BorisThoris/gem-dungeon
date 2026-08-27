import { afterEach, describe, expect, test } from "vitest";
import { createDungeonRunState } from "../../dungeon-core/model";
import useMapStore from "../mapStore";

describe("canonical map store cutover", () => {
  afterEach(() => useMapStore.getState().clearMap());

  test("keeps Dungeon authoritative while exposing a legacy adapter", () => {
    useMapStore.getState().generateMap({}, undefined, "map-store-seed");
    const state = useMapStore.getState();
    expect(state.error).toBeNull();
    expect(state.currentDungeon?.replay.seed).toBe("map-store-seed");
    expect(state.currentMap?.rooms).toHaveLength(state.currentDungeon?.rooms.length ?? 0);
    expect(state.currentMap?.id).toBe(`map_${state.currentDungeon?.replay.spatialHash}`);
    expect(state.currentRoomId).toBe(state.currentDungeon?.startRoomId);
  }, 30_000);

  test("restores the exact model and synchronizes legacy visited flags", () => {
    useMapStore.getState().generateMap({}, undefined, "map-store-restore");
    const dungeon = useMapStore.getState().currentDungeon;
    if (!dungeon) throw new Error("generation failed");
    const runState = createDungeonRunState(dungeon);
    useMapStore.getState().clearMap();
    useMapStore.getState().restoreDungeon(dungeon, runState);

    const restored = useMapStore.getState();
    expect(restored.currentDungeon).toBe(dungeon);
    expect(restored.dungeonRunState).toEqual(runState);
    expect(restored.currentMap?.rooms.find((room) => room.id === dungeon.startRoomId)?.isVisited)
      .toBe(true);
  }, 30_000);
});
