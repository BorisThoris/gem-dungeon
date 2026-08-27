import { describe, expect, test } from "vitest";
import {
  DEFAULT_GENERATION_CONFIG,
  normalizeSeed,
  resolveGenerationConfig,
} from "../config";
import { hashValue } from "../identity";

describe("canonical generation config", () => {
  test("uses one immutable validated snapshot", () => {
    const config = resolveGenerationConfig({
      topology: { totalRooms: { min: 18, max: 24 } },
      world: { depth: 72, width: 64 },
    });

    expect(config.world).toEqual({
      ...DEFAULT_GENERATION_CONFIG.world,
      depth: 72,
      width: 64,
    });
    expect(config.topology.totalRooms).toEqual({ min: 18, max: 24 });
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.topology.totalRooms)).toBe(true);
    expect(hashValue(config)).toBe(hashValue(resolveGenerationConfig(config)));
  });

  test("rejects drift, invalid ranges, and decorative unknown knobs", () => {
    expect(() =>
      resolveGenerationConfig({ world: { width: 10 } }),
    ).toThrow(/world.width/);
    expect(() =>
      resolveGenerationConfig({
        topology: { totalRooms: { min: 25, max: 20 } },
      }),
    ).toThrow(/totalRooms.min/);
    expect(() =>
      resolveGenerationConfig({ roomSize: 10 } as never),
    ).toThrow(/unknown option roomSize/);
    expect(() =>
      resolveGenerationConfig({ world: { gridSize: 12 } } as never),
    ).toThrow(/unknown option gridSize/);
  });

  test("normalizes deterministic seeds and rejects time-like invalid values", () => {
    expect(normalizeSeed(42)).toBe("42");
    expect(normalizeSeed(" dungeon-42 ")).toBe("dungeon-42");
    expect(() => normalizeSeed(1.5)).toThrow(/safe integer/);
    expect(() => normalizeSeed("   ")).toThrow(/must not be empty/);
  });
});
