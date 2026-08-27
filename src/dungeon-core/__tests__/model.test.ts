import { describe, expect, test } from "vitest";
import { generateDungeon } from "../generator";
import {
  canTraverseDungeonConnection,
  createDungeonRunState,
  enterDungeonRoom,
  openDungeonConnection,
} from "../model";

describe("canonical run-state traversal", () => {
  test("enforces direction, grants, and explicit actions without changing the dungeon", () => {
    const result = generateDungeon({ seed: "runtime-traversal" });
    if (!result.ok) throw new Error(result.error.message);
    const dungeon = result.dungeon;
    let state = createDungeonRunState(dungeon);
    const startEdge = dungeon.connections.find((connection) =>
      connection.from.roomId === dungeon.startRoomId
      || connection.to.roomId === dungeon.startRoomId);
    if (!startEdge) throw new Error("fixture has no start connection");

    expect(canTraverseDungeonConnection(
      dungeon,
      state,
      startEdge.id,
      dungeon.startRoomId,
    )).toBe(true);

    const explicit = dungeon.connections.find((connection) =>
      connection.traversal.requiredAction === "discover-secret"
      || connection.traversal.requiredAction === "break-barrier");
    if (explicit) {
      const endpoint = explicit.from.roomId;
      state = enterDungeonRoom(dungeon, state, endpoint);
      state = {
        ...state,
        flags: new Set([...state.flags, ...explicit.traversal.requiredFlags]),
        inventory: new Set([...state.inventory, ...explicit.traversal.requiredItems]),
      };
      expect(canTraverseDungeonConnection(dungeon, state, explicit.id, endpoint)).toBe(false);
      state = openDungeonConnection(dungeon, state, explicit.id);
      expect(canTraverseDungeonConnection(dungeon, state, explicit.id, endpoint)).toBe(true);
      expect(state.openedConnectionIds.has(explicit.id)).toBe(true);
    }
  }, 30_000);
});
