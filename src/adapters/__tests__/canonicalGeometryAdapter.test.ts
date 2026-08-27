import { describe, expect, test } from "vitest";
import { canonicalDungeonToGeometry } from "../canonicalGeometryAdapter";
import { generateDungeon } from "../../dungeon-core/generator";
import { cellKey } from "../../dungeon-core/identity";

describe("canonical geometry adapter", () => {
  test("materializes exact room footprints and routed corridor occupancy", () => {
    const result = generateDungeon({ seed: "geometry-adapter" });
    if (!result.ok) throw new Error(result.error.message);
    const geometry = canonicalDungeonToGeometry(result.dungeon);
    const tileByCell = new Map(geometry.floorTiles.map((tile) => [cellKey(tile.cell), tile]));

    for (const room of result.dungeon.rooms) {
      for (const cell of room.footprint.cells) {
        const tile = tileByCell.get(cellKey(cell));
        expect(tile?.kind).toBe("room");
        expect(tile?.roomId).toBe(room.id);
      }
    }
    for (const connection of result.dungeon.connections) {
      for (const cell of connection.corridor?.cells ?? []) {
        expect(tileByCell.get(cellKey(cell))?.connectionIds).toContain(connection.id);
      }
    }
    expect(geometry.assetAnchors).toHaveLength(result.dungeon.rooms.length);
    expect(geometry.connectionPaths).toHaveLength(result.dungeon.connections.length);
    expect(geometry.connectionGates).toHaveLength(2 *
      result.dungeon.connections.filter(
        (connection) => connection.kind !== "portal" && connection.vertical === null,
      ).length,
    );
    expect(canonicalDungeonToGeometry(result.dungeon)).toEqual(geometry);
    expect(Object.isFrozen(geometry)).toBe(true);
  }, 30_000);

  test("opens only canonical room/path adjacencies and partitions accidental neighbors", () => {
    const result = generateDungeon({ seed: "geometry-walls" });
    if (!result.ok) throw new Error(result.error.message);
    const geometry = canonicalDungeonToGeometry(result.dungeon);
    const wallAdjacencies = new Set(geometry.walls.map((wall) => {
      const neighbor = {
        floor: wall.cell.floor,
        x: wall.cell.x + wall.normal.x,
        z: wall.cell.z + wall.normal.z,
      };
      return [cellKey(wall.cell), cellKey(neighbor)].sort().join("|");
    }));
    expect(new Set(geometry.walls.map((wall) => wall.id)).size).toBe(geometry.walls.length);

    for (const connection of result.dungeon.connections) {
      if (!connection.corridor) continue;
      const fromRoom = result.dungeon.rooms.find((room) => room.id === connection.from.roomId)!;
      const toRoom = result.dungeon.rooms.find((room) => room.id === connection.to.roomId)!;
      const from = fromRoom.sockets.find((socket) => socket.id === connection.from.socketId)!.cell;
      const to = toRoom.sockets.find((socket) => socket.id === connection.to.socketId)!.cell;
      const path = [from, ...connection.corridor.cells, to];
      for (let index = 1; index < path.length; index += 1) {
        const adjacency = [cellKey(path[index - 1]), cellKey(path[index])].sort().join("|");
        expect(wallAdjacencies.has(adjacency)).toBe(false);
      }
    }
  }, 30_000);

  test("exposes explicit vertical and portal traversal plus stable asset tokens", () => {
    const result = generateDungeon({
      config: { progression: { portals: 1 }, world: { floors: 3 } },
      seed: "geometry-multi-floor",
    });
    if (!result.ok) throw new Error(result.error.message);
    const geometry = canonicalDungeonToGeometry(result.dungeon);

    expect(geometry.floorTiles.some((tile) => tile.cell.floor === 2)).toBe(true);
    expect(geometry.traversalLinks.some((link) => link.kind === "stairs")).toBe(true);
    expect(geometry.traversalLinks.some((link) => link.kind === "portal")).toBe(true);
    for (const anchor of geometry.assetAnchors) {
      expect(anchor.materialKey).toBe(
        `room:${anchor.biome}:${anchor.archetype}`,
      );
    }
  }, 30_000);
});
