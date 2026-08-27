import { describe, expect, test } from "vitest";
import { resolveGenerationConfig } from "../config";
import { hashValue } from "../identity";
import { createRngStreams } from "../rng";
import { directDungeonSemantics } from "../semantics";
import { generateMissionGraph } from "../topology";

function generate(seed: string | number) {
  const config = resolveGenerationConfig();
  const streams = createRngStreams(seed);
  const topology = generateMissionGraph(config, streams);
  if (!topology.ok) throw new Error(topology.error.message);
  return { config, result: directDungeonSemantics(topology.value.graph, config, streams) };
}

describe("context-aware progression semantics", () => {
  test("assigns every room and edge with fixed special roles", () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const { config, result } = generate(seed);
      expect(result.ok, result.ok ? undefined : result.error.message).toBe(true);
      if (!result.ok) continue;

      expect(result.value.rooms).toHaveLength(result.value.graph.nodes.length);
      expect(result.value.edges).toHaveLength(result.value.graph.edges.length);
      const byNode = new Map(result.value.rooms.map((room) => [room.nodeId, room]));
      expect(byNode.get(result.value.graph.startNodeId)?.archetype).toBe("start");
      expect(byNode.get(result.value.graph.bossNodeId)?.archetype).toBe("boss");
      expect(byNode.get(result.value.graph.endNodeId)?.archetype).toBe("end");
      expect(result.value.rooms.filter((room) => room.archetype === "shop").length)
        .toBeGreaterThanOrEqual(config.semantics.shopCount.min);
      expect(result.value.rooms.filter((room) => room.archetype === "treasure").length)
        .toBeGreaterThan(0);
    }
  });

  test("places each key before its own locked edge", () => {
    const { result } = generate("keys-before-locks");
    expect(result.ok, result.ok ? undefined : result.error.message).toBe(true);
    if (!result.ok) return;

    const nodeById = new Map(result.value.graph.nodes.map((node) => [node.id, node]));
    const roomByNode = new Map(result.value.rooms.map((room) => [room.nodeId, room]));
    const edgeById = new Map(result.value.graph.edges.map((edge) => [edge.id, edge]));
    for (const assignment of result.value.edges) {
      for (const item of assignment.traversal.requiredItems) {
        const edge = edgeById.get(assignment.edgeId)!;
        const lockDepth = Math.max(
          nodeById.get(edge.from)!.progressionDepth,
          nodeById.get(edge.to)!.progressionDepth,
        );
        const grantDepths = [...roomByNode.values()]
          .filter((room) => room.grants.items.includes(item))
          .map((room) => nodeById.get(room.nodeId)!.progressionDepth);
        expect(grantDepths.length).toBeGreaterThan(0);
        expect(Math.min(...grantDepths)).toBeLessThan(lockDepth);
      }
    }
  });

  test("inserts portals only within a known progression segment", () => {
    const { result } = generate("safe-portals");
    expect(result.ok, result.ok ? undefined : result.error.message).toBe(true);
    if (!result.ok) return;
    const nodeById = new Map(result.value.graph.nodes.map((node) => [node.id, node]));
    const portals = result.value.graph.edges.filter((edge) => edge.kind === "portal");
    expect(portals).toHaveLength(1);
    for (const portal of portals) {
      expect(nodeById.get(portal.from)!.progressionDepth).toBe(
        nodeById.get(portal.to)!.progressionDepth,
      );
    }
  });

  test("semantic replay is independent from population and decoration draws", () => {
    const config = resolveGenerationConfig();
    const firstStreams = createRngStreams("semantic-isolation");
    const firstTopology = generateMissionGraph(config, firstStreams);
    expect(firstTopology.ok).toBe(true);
    if (!firstTopology.ok) return;
    const first = directDungeonSemantics(firstTopology.value.graph, config, firstStreams);

    const secondStreams = createRngStreams("semantic-isolation");
    for (let index = 0; index < 500; index += 1) {
      secondStreams.stream("population").float();
      secondStreams.stream("decoration").float();
    }
    const secondTopology = generateMissionGraph(config, secondStreams);
    expect(secondTopology.ok).toBe(true);
    if (!secondTopology.ok) return;
    const second = directDungeonSemantics(secondTopology.value.graph, config, secondStreams);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(hashValue(second.value)).toBe(hashValue(first.value));
    }
  });
});
