import { describe, expect, test } from "vitest";
import { resolveGenerationConfig } from "../config";
import { OccupancyGrid } from "../occupancy";
import { DEFAULT_ROOM_TEMPLATES, placeTemplate } from "../templates";

describe("canonical layered occupancy", () => {
  const config = resolveGenerationConfig({ world: { depth: 20, floors: 2, width: 20 } });
  const block = DEFAULT_ROOM_TEMPLATES.find((template) => template.shape === "block")!;

  test("reserves every transformed footprint cell and rejects partial overlap", () => {
    const occupancy = new OccupancyGrid(config);
    const first = placeTemplate(block, "first", { floor: 0, x: 5, z: 5 }, 0);
    const overlapping = placeTemplate(block, "second", { floor: 0, x: 6, z: 6 }, 0);

    expect(occupancy.reserveRoom("first", first.footprint).ok).toBe(true);
    const result = occupancy.reserveRoom("second", overlapping.footprint);
    expect(result.ok).toBe(false);
    expect(result.conflicts.some((entry) => entry.roomOwnerId === "first")).toBe(true);
    expect(occupancy.records().filter((entry) => entry.roomOwnerId === "second")).toHaveLength(0);
  });

  test("allows the same x/z footprint on a different floor", () => {
    const occupancy = new OccupancyGrid(config);
    const lower = placeTemplate(block, "lower", { floor: 0, x: 5, z: 5 }, 0);
    const upper = placeTemplate(block, "upper", { floor: 1, x: 5, z: 5 }, 0);
    expect(occupancy.reserveRoom("lower", lower.footprint).ok).toBe(true);
    expect(occupancy.reserveRoom("upper", upper.footprint).ok).toBe(true);
  });

  test("rejects out-of-bounds footprints and releases owners transactionally", () => {
    const occupancy = new OccupancyGrid(config);
    const outside = placeTemplate(block, "outside", { floor: 0, x: 19, z: 19 }, 0);
    expect(occupancy.reserveRoom("outside", outside.footprint).outOfBounds).not.toHaveLength(0);
    expect(occupancy.records()).toHaveLength(0);

    const inside = placeTemplate(block, "inside", { floor: 0, x: 2, z: 2 }, 0);
    occupancy.reserveRoom("inside", inside.footprint);
    occupancy.releaseOwner("inside");
    expect(occupancy.records()).toHaveLength(0);
  });
});
