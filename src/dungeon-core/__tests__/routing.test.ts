import { describe, expect, test } from "vitest";
import { resolveGenerationConfig } from "../config";
import { cellKey, hashValue } from "../identity";
import { OccupancyGrid } from "../occupancy";
import { placeMissionRooms } from "../placement";
import { createRngStreams } from "../rng";
import { routeAStar, routeDungeonConnections } from "../routing";
import { directDungeonSemantics } from "../semantics";
import { DEFAULT_ROOM_TEMPLATES } from "../templates";
import { generateMissionGraph } from "../topology";
import type { GenerationConfigInput } from "../types";

function route(seed: string | number, input: GenerationConfigInput = {}) {
  const config = resolveGenerationConfig(input);
  const streams = createRngStreams(seed);
  const topology = generateMissionGraph(config, streams);
  if (!topology.ok) throw new Error(topology.error.message);
  const semantics = directDungeonSemantics(topology.value.graph, config, streams);
  if (!semantics.ok) throw new Error(semantics.error.message);
  const placement = placeMissionRooms(
    semantics.value,
    config,
    DEFAULT_ROOM_TEMPLATES,
    streams,
  );
  if (!placement.ok) throw new Error(placement.error.message);
  return {
    config,
    placement: placement.value,
    result: routeDungeonConnections(semantics.value, placement.value.rooms, config, streams),
    semantics: semantics.value,
  };
}

describe("weighted A* and authoritative socket routing", () => {
  test("routes around forbidden room cells deterministically", () => {
    const config = resolveGenerationConfig({
      topology: { hubCount: { min: 0, max: 0 } },
      world: { depth: 20, width: 20 },
    });
    const occupancy = new OccupancyGrid(config);
    const wallCells = Array.from({ length: 5 }, (_, index) => ({
      floor: 0,
      x: 10,
      z: 8 + index,
    }));
    expect(occupancy.reserveRoom("wall", {
      bounds: {
        maxFloor: 0,
        maxX: 10,
        maxZ: 12,
        minFloor: 0,
        minX: 10,
        minZ: 8,
      },
      cells: wallCells,
      clearance: [],
    }).ok).toBe(true);
    const start = { floor: 0, x: 7, z: 10 };
    const end = { floor: 0, x: 13, z: 10 };
    const first = routeAStar(start, end, occupancy, config);
    const second = routeAStar(start, end, occupancy, config);
    expect(first.route).not.toBeNull();
    expect(hashValue(second)).toBe(hashValue(first));
    for (const cell of first.route!.cells) {
      expect(occupancy.get(cell)?.roomOwnerId ?? null).toBeNull();
    }
    expect(first.route!.turns).toBeGreaterThanOrEqual(2);
  });

  test("materializes every edge with unique valid sockets and continuous paths", () => {
    for (let seed = 0; seed < 10; seed += 1) {
      const { placement, result, semantics } = route(seed);
      expect(result.ok, result.ok ? undefined : `seed ${seed}: ${result.error.code}: ${result.error.message} ${JSON.stringify(result.error.details)}`)
        .toBe(true);
      if (!result.ok) continue;
      expect(result.value.connections).toHaveLength(semantics.graph.edges.length);
      const roomById = new Map(placement.rooms.map((room) => [room.id, room]));
      const used = new Set<string>();
      const roomCells = new Set(
        placement.rooms.flatMap((room) => room.footprint.cells.map(cellKey)),
      );
      for (const connection of result.value.connections) {
        const fromSocket = roomById
          .get(connection.from.roomId)!
          .sockets.find((socket) => socket.id === connection.from.socketId);
        const toSocket = roomById
          .get(connection.to.roomId)!
          .sockets.find((socket) => socket.id === connection.to.socketId);
        expect(fromSocket).toBeDefined();
        expect(toSocket).toBeDefined();
        expect(used.has(connection.from.socketId)).toBe(false);
        expect(used.has(connection.to.socketId)).toBe(false);
        used.add(connection.from.socketId);
        used.add(connection.to.socketId);

        if (connection.corridor) {
          expect(connection.corridor.cells[0]).toEqual(fromSocket!.exteriorCell);
          expect(connection.corridor.cells.at(-1)).toEqual(toSocket!.exteriorCell);
          for (let index = 1; index < connection.corridor.cells.length; index += 1) {
            const previous = connection.corridor.cells[index - 1];
            const current = connection.corridor.cells[index];
            expect(
              Math.abs(previous.x - current.x) + Math.abs(previous.z - current.z),
            ).toBe(1);
            expect(previous.floor).toBe(current.floor);
          }
          for (const cell of connection.corridor.cells) {
            expect(roomCells.has(cellKey(cell)), `${connection.id} crosses ${cellKey(cell)}`)
              .toBe(false);
          }
        } else {
          expect(connection.kind === "portal" || connection.vertical !== null).toBe(true);
        }
      }
    }
  }, 30_000);

  test("materializes deterministic vertical traversal on three floors", () => {
    const first = route("route-three-floors", { world: { floors: 3 } });
    expect(first.result.ok, first.result.ok ? undefined : first.result.error.message).toBe(true);
    if (!first.result.ok) return;
    const vertical = first.result.value.connections.filter((connection) => connection.vertical);
    expect(vertical.length).toBeGreaterThanOrEqual(2);
    for (const connection of vertical) {
      expect(Math.abs(connection.vertical!.from.floor - connection.vertical!.to.floor)).toBe(1);
      expect(connection.corridor).toBeNull();
    }
    const second = route("route-three-floors", { world: { floors: 3 } });
    expect(second.result.ok).toBe(true);
    if (second.result.ok) {
      expect(hashValue(second.result.value)).toBe(hashValue(first.result.value));
    }
  });
});
