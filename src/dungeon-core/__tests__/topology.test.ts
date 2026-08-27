import { describe, expect, test } from "vitest";
import { resolveGenerationConfig } from "../config";
import { hashValue } from "../identity";
import { createRngStreams } from "../rng";
import { generateMissionGraph } from "../topology";

describe("graph-first mission topology", () => {
  test("guarantees start -> boss -> end roles and configured structure", () => {
    const config = resolveGenerationConfig();
    for (let seed = 0; seed < 50; seed += 1) {
      const result = generateMissionGraph(config, createRngStreams(seed));
      expect(result.ok, result.ok ? undefined : result.error.message).toBe(true);
      if (!result.ok) continue;

      const { graph } = result.value;
      expect(graph.nodes.length).toBeGreaterThanOrEqual(config.topology.totalRooms.min);
      expect(graph.nodes.length).toBeLessThanOrEqual(config.topology.totalRooms.max);
      expect(graph.nodes.filter((node) => node.role === "start")).toHaveLength(1);
      expect(graph.nodes.filter((node) => node.role === "boss")).toHaveLength(1);
      expect(graph.nodes.filter((node) => node.role === "end")).toHaveLength(1);
      expect(graph.nodes.some((node) => node.role === "gate")).toBe(true);
      expect(graph.nodes.some((node) => node.role === "boss-approach")).toBe(true);

      const cycleRank = graph.edges.length - graph.nodes.length + 1;
      expect(cycleRank).toBeGreaterThanOrEqual(config.topology.loopCount.min);
      expect(cycleRank).toBeLessThanOrEqual(config.topology.loopCount.max);
      const degree = new Map(graph.nodes.map((node) => [node.id, 0]));
      for (const edge of graph.edges) {
        degree.set(edge.from, degree.get(edge.from)! + 1);
        degree.set(edge.to, degree.get(edge.to)! + 1);
      }
      const deadEnds = [...degree.values()].filter((value) => value === 1).length;
      expect(deadEnds).toBeGreaterThanOrEqual(config.topology.deadEndCount.min);
      expect(deadEnds).toBeLessThanOrEqual(config.topology.deadEndCount.max);
    }
  });

  test("topology replay is isolated from unrelated streams", () => {
    const config = resolveGenerationConfig();
    const baseline = generateMissionGraph(config, createRngStreams("isolated"));
    const perturbedStreams = createRngStreams("isolated");
    for (let index = 0; index < 1_000; index += 1) {
      perturbedStreams.stream("decoration").float();
      perturbedStreams.stream("population").float();
    }
    const perturbed = generateMissionGraph(config, perturbedStreams);
    expect(baseline.ok).toBe(true);
    expect(perturbed.ok).toBe(true);
    if (baseline.ok && perturbed.ok) {
      expect(hashValue(perturbed.value.graph)).toBe(hashValue(baseline.value.graph));
    }
  });

  test("creates explicit cross-floor mission edges", () => {
    const config = resolveGenerationConfig({ world: { floors: 3 } });
    const result = generateMissionGraph(config, createRngStreams("three-floors"));
    expect(result.ok, result.ok ? undefined : result.error.message).toBe(true);
    if (!result.ok) return;

    expect(new Set(result.value.graph.nodes.map((node) => node.desiredFloor))).toEqual(
      new Set([0, 1, 2]),
    );
    expect(result.value.graph.edges.filter((edge) => edge.kind === "vertical").length)
      .toBeGreaterThanOrEqual(2);
  });

  test("returns a structured failure for infeasible branch constraints", () => {
    const config = resolveGenerationConfig({
      topology: {
        branchBudget: 0,
        hubCount: { min: 0, max: 0 },
        totalRooms: { min: 16, max: 16 },
      },
    });
    const result = generateMissionGraph(config, createRngStreams("infeasible"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.stage).toBe("topology");
    expect(result.error.code).toBe("TOPOLOGY_ATTEMPTS_EXHAUSTED");
    expect(result.trace.length).toBeGreaterThanOrEqual(0);
  });
});
