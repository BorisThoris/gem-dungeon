import { describe, expect, test } from "vitest";
import { resolveGenerationConfig } from "../config";
import { cellKey, hashValue } from "../identity";
import { placeMissionRooms } from "../placement";
import { createRngStreams } from "../rng";
import { directDungeonSemantics } from "../semantics";
import { DEFAULT_ROOM_TEMPLATES } from "../templates";
import { generateMissionGraph } from "../topology";
import type { GenerationConfigInput } from "../types";

function place(seed: string | number, input: GenerationConfigInput = {}) {
  const config = resolveGenerationConfig(input);
  const streams = createRngStreams(seed);
  const topology = generateMissionGraph(config, streams);
  if (!topology.ok) throw new Error(topology.error.message);
  const semantics = directDungeonSemantics(topology.value.graph, config, streams);
  if (!semantics.ok) throw new Error(semantics.error.message);
  return { config, result: placeMissionRooms(semantics.value, config, DEFAULT_ROOM_TEMPLATES, streams) };
}

describe("exact-footprint bounded placement", () => {
  test("places seed cohorts without overlap and within authoritative bounds", () => {
    for (let seed = 0; seed < 10; seed += 1) {
      const { config, result } = place(seed);
      expect(result.ok, result.ok ? undefined : result.error.message).toBe(true);
      if (!result.ok) continue;
      const occupied = new Set<string>();
      for (const room of result.value.rooms) {
        expect(new Set(room.footprint.cells.map(cellKey)).size).toBe(room.footprint.cells.length);
        for (const cell of room.footprint.cells) {
          expect(cell.x).toBeGreaterThanOrEqual(0);
          expect(cell.x).toBeLessThan(config.world.width);
          expect(cell.z).toBeGreaterThanOrEqual(0);
          expect(cell.z).toBeLessThan(config.world.depth);
          expect(cell.floor).toBeGreaterThanOrEqual(0);
          expect(cell.floor).toBeLessThan(config.world.floors);
          expect(occupied.has(cellKey(cell)), `${cellKey(cell)} overlaps`).toBe(false);
          occupied.add(cellKey(cell));
        }
      }
    }
  }, 60_000);

  test("replays identical transforms and diagnostics", () => {
    const first = place("placement-replay").result;
    const second = place("placement-replay").result;
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(hashValue(second.value)).toBe(hashValue(first.value));
    }
  });

  test("aligns explicit vertical socket candidates across floors", () => {
    const { result } = place("placement-floors", { world: { floors: 3 } });
    expect(result.ok, result.ok ? undefined : result.error.message).toBe(true);
    if (!result.ok) return;
    expect(new Set(result.value.rooms.map((room) => room.transform.origin.floor))).toEqual(
      new Set([0, 1, 2]),
    );
    for (const floor of [0, 1]) {
      const lowerSockets = result.value.rooms
        .filter((room) => room.transform.origin.floor === floor)
        .flatMap((room) => room.sockets)
        .filter((socket) => socket.normal.y === 1);
      const upperSockets = result.value.rooms
        .filter((room) => room.transform.origin.floor === floor + 1)
        .flatMap((room) => room.sockets)
        .filter((socket) => socket.normal.y === -1);
      expect(
        lowerSockets.some((lower) =>
          upperSockets.some(
            (upper) => upper.cell.x === lower.cell.x && upper.cell.z === lower.cell.z,
          ),
        ),
      ).toBe(true);
    }
  });
});
