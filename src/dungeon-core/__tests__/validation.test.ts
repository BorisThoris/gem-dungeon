import { describe, expect, test } from "vitest";
import { resolveGenerationConfig } from "../config";
import { generateDungeon } from "../generator";
import { placeMissionRooms } from "../placement";
import { createRngStreams } from "../rng";
import { routeDungeonConnections } from "../routing";
import { directDungeonSemantics } from "../semantics";
import { DEFAULT_ROOM_TEMPLATES } from "../templates";
import { generateMissionGraph } from "../topology";
import { validateDungeon, type DungeonValidationInput } from "../validation";

function rawCandidate(seed: string | number, floors = 1): DungeonValidationInput {
  const config = resolveGenerationConfig({ world: { floors } });
  const streams = createRngStreams(seed);
  const topology = generateMissionGraph(config, streams);
  if (!topology.ok) throw new Error(topology.error.message);
  const semantics = directDungeonSemantics(topology.value.graph, config, streams);
  if (!semantics.ok) throw new Error(semantics.error.message);
  const placement = placeMissionRooms(semantics.value, config, DEFAULT_ROOM_TEMPLATES, streams);
  if (!placement.ok) throw new Error(placement.error.message);
  const routing = routeDungeonConnections(
    semantics.value,
    placement.value.rooms,
    config,
    streams,
  );
  if (!routing.ok) throw new Error(`${routing.error.code}: ${routing.error.message}`);
  const roomByNode = new Map(
    placement.value.rooms.map((room) => [room.topologyNodeId, room.id]),
  );
  return {
    bossRoomId: roomByNode.get(semantics.value.graph.bossNodeId)!,
    config,
    connections: routing.value.connections,
    endRoomId: roomByNode.get(semantics.value.graph.endNodeId)!,
    floors,
    rooms: placement.value.rooms,
    startRoomId: roomByNode.get(semantics.value.graph.startNodeId)!,
  };
}

function generatedCandidate(seed: string | number, floors = 1): DungeonValidationInput {
  const result = generateDungeon({ config: { world: { floors } }, seed });
  if (!result.ok) throw new Error(result.error.message);
  return result.dungeon;
}

describe("non-mutating canonical validation", () => {
  test("proves physical and traversal-state reachability", () => {
    for (let seed = 0; seed < 2; seed += 1) {
      const dungeon = generatedCandidate(seed);
      const report = validateDungeon(dungeon);
      expect(report.valid, `seed ${seed}: ${JSON.stringify(report.issues, null, 2)}`).toBe(true);
      expect(report.physicallyTraversable).toBe(true);
      expect(report.progressionSolvable).toBe(true);
    }
  }, 30_000);

  test("validates explicit vertical traversal across three floors", () => {
    const report = validateDungeon(generatedCandidate("validation-floors", 3));
    expect(report.valid, JSON.stringify(report.issues, null, 2)).toBe(true);
  });

  test("reports a broken corridor without repairing or mutating it", () => {
    const dungeon = generatedCandidate("validation-corruption");
    const target = dungeon.connections.find((connection) => connection.corridor)!;
    const corrupted = {
      ...dungeon,
      connections: dungeon.connections.map((connection) =>
        connection.id === target.id
          ? {
              ...connection,
              corridor: {
                ...connection.corridor!,
                cells: connection.corridor!.cells.slice(1),
              },
            }
          : connection,
      ),
    };
    const before = JSON.stringify(corrupted);
    const report = validateDungeon(corrupted);
    expect(report.valid).toBe(false);
    expect(report.issues.some((issue) => issue.code === "CORRIDOR_ENDPOINT_MISMATCH"))
      .toBe(true);
    expect(JSON.stringify(corrupted)).toBe(before);
  });

  test("rejects a graph-valid route set when shared corridors bypass a gate", () => {
    const protectedCandidate = rawCandidate(0);
    const unsafeCandidate = {
      ...protectedCandidate,
      connections: protectedCandidate.connections.map((connection) =>
        connection.traversal.requiredAction === null
          ? {
              ...connection,
              traversal: {
                ...connection.traversal,
                lockedByDefault: false,
                requiredFlags: [],
                requiredItems: [],
              },
            }
          : connection,
      ),
    };
    const report = validateDungeon(unsafeCandidate);
    expect(report.valid).toBe(false);
    expect(report.issues.some((issue) =>
      issue.code === "CORRIDOR_JUNCTION_PROGRESSION_BYPASS")).toBe(true);
  }, 30_000);
});
