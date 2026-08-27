import { describe, expect, test } from "vitest";
import { resolveGenerationConfig } from "../config";
import { generateDungeon } from "../generator";
import { hashValue, stableStringify } from "../identity";
import { validateDungeon } from "../validation";

describe("public deterministic dungeon generator", () => {
  test("replays canonical output exactly from seed, config, and templates", () => {
    const config = {
      topology: { totalRooms: { min: 16, max: 16 } },
      world: { depth: 56, width: 56 },
    } as const;
    const first = generateDungeon({ config, seed: "canonical-replay" });
    const second = generateDungeon({ config, seed: "canonical-replay" });
    expect(first.ok, first.ok ? undefined : first.error.message).toBe(true);
    expect(second.ok, second.ok ? undefined : second.error.message).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(stableStringify(second.dungeon)).toBe(stableStringify(first.dungeon));
    expect(hashValue(second.dungeon)).toBe(hashValue(first.dungeon));
    expect(first.dungeon.config).toEqual(resolveGenerationConfig(config));
    expect(first.dungeon.replay.configHash).toBe(hashValue(first.dungeon.config));
    expect(first.dungeon.replay.spatialHash).toBe(first.dungeon.metrics.spatialHash);
    expect(first.dungeon.replay.topologyHash).toBe(first.dungeon.metrics.topologyHash);
    expect(validateDungeon(first.dungeon).valid).toBe(true);
  }, 30_000);

  test("keeps nondeterministic timing outside canonical dungeon identity", () => {
    let firstClock = 10;
    const first = generateDungeon({ now: () => (firstClock += 2), seed: "timing-boundary" });
    let secondClock = 100;
    const second = generateDungeon({ now: () => (secondClock += 17), seed: "timing-boundary" });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.diagnostics.durationMs).not.toBe(second.diagnostics.durationMs);
    expect(first.dungeon).toEqual(second.dungeon);
  }, 30_000);

  test("emits deterministic health metrics and genuine multi-floor output", () => {
    const result = generateDungeon({ seed: "generator-floors", config: { world: { floors: 3 } } });
    expect(result.ok, result.ok ? undefined : result.error.message).toBe(true);
    if (!result.ok) return;
    expect(result.dungeon.floors).toBe(3);
    expect(result.dungeon.metrics.componentCount).toBe(1);
    expect(result.dungeon.metrics.reachableFromStart).toBe(result.dungeon.rooms.length);
    expect(result.dungeon.metrics.nodeCount).toBe(result.dungeon.rooms.length);
    expect(result.dungeon.metrics.edgeCount).toBe(result.dungeon.connections.length);
    expect(result.dungeon.connections.filter((connection) => connection.vertical).length)
      .toBeGreaterThanOrEqual(2);
  }, 30_000);

  test("returns structured config failures instead of clamping", () => {
    const result = generateDungeon({ seed: "bad-config", config: { world: { width: 4 } } });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.stage).toBe("config");
    expect(result.error.code).toBe("GENERATION_CONFIG_INVALID");
  });
});
