import { describe, expect, test } from "vitest";
import { generateDungeon } from "../../dungeon-core/generator";
import { gridCellToWorld } from "../../dungeon-core/spatial";
import { PlayerRoomDetection } from "../playerRoomDetection";

describe("runtime canonical room detection", () => {
  test("uses exact shaped footprints, including holes, and respects floor layers", () => {
    const result = generateDungeon({
      config: { world: { floors: 3 } },
      seed: "detect-0",
    });
    if (!result.ok) throw new Error(result.error.message);
    const detector = new PlayerRoomDetection();
    detector.setDetectionThreshold(0);
    detector.initializeDungeon(result.dungeon);

    for (const room of result.dungeon.rooms) {
      for (const cell of room.footprint.cells) {
        const center = gridCellToWorld(cell, result.dungeon.config);
        expect(detector.detectCurrentRoom(center)).toBe(room.id);
      }
    }

    const hollow = result.dungeon.rooms.find((room) =>
      room.shape === "U" || room.shape === "C" || room.shape === "H");
    if (!hollow) throw new Error("fixture did not produce a hollow room");
    const occupied = new Set(hollow.footprint.cells.map((cell) => `${cell.x}:${cell.z}`));
    const hole = Array.from(
      { length: hollow.footprint.bounds.maxX - hollow.footprint.bounds.minX + 1 },
      (_, dx) => Array.from(
        { length: hollow.footprint.bounds.maxZ - hollow.footprint.bounds.minZ + 1 },
        (_unused, dz) => ({
          floor: hollow.transform.origin.floor,
          x: hollow.footprint.bounds.minX + dx,
          z: hollow.footprint.bounds.minZ + dz,
        }),
      ),
    ).flat().find((cell) => !occupied.has(`${cell.x}:${cell.z}`));
    if (!hole) throw new Error("hollow fixture has no interior hole");
    const holePosition = gridCellToWorld(hole, result.dungeon.config);
    expect(detector.detectCurrentRoom(holePosition)).not.toBe(hollow.id);

    const upperRoom = result.dungeon.rooms.find((room) => room.transform.origin.floor === 2);
    if (!upperRoom) throw new Error("fixture has no room on floor three");
    const upperPosition = gridCellToWorld(upperRoom.footprint.cells[0], result.dungeon.config);
    expect(detector.detectCurrentRoom(upperPosition)).toBe(upperRoom.id);
    expect(detector.detectCurrentRoom({
      ...upperPosition,
      y: upperPosition.y - result.dungeon.config.world.floorHeight,
    })).not.toBe(upperRoom.id);
  }, 30_000);
});
