import { describe, expect, test } from "vitest";
import { resolveGenerationConfig } from "../config";
import {
  createDungeonSpatialIndex,
  detectDungeonRoom,
  gridCellToWorld,
  worldToGridCell,
  type DungeonSpatialSource,
} from "../spatial";
import { DEFAULT_ROOM_TEMPLATES, placeTemplate } from "../templates";
import type { DungeonRoom, Rotation } from "../types";

function spatialRoom(
  templateIndex: number,
  rotation: Rotation,
  floor = 0,
): Readonly<{ source: DungeonSpatialSource; room: DungeonRoom }> {
  const config = resolveGenerationConfig({ world: { floors: Math.max(1, floor + 1) } });
  const template = DEFAULT_ROOM_TEMPLATES[templateIndex];
  const id = `spatial-${template.shape}-${rotation}-${floor}`;
  const placed = placeTemplate(template, id, { floor, x: 28, z: 28 }, rotation);
  const room = {
    archetype: "normal",
    biome: "test",
    branchDepth: 0,
    criticalPathIndex: null,
    footprint: placed.footprint,
    grants: { flags: [], items: [] },
    id,
    mandatory: false,
    progressionDepth: 0,
    role: "optional",
    shape: template.shape,
    sockets: placed.sockets,
    tags: [],
    templateId: template.id,
    topologyNodeId: id,
    transform: { origin: { floor, x: 28, z: 28 }, rotation },
  } satisfies DungeonRoom;
  return { room, source: { config, rooms: [room] } };
}

describe("canonical footprint spatial detection", () => {
  test("detects every occupied cell for every shape and rotation", () => {
    for (let templateIndex = 0; templateIndex < DEFAULT_ROOM_TEMPLATES.length; templateIndex += 1) {
      for (const rotation of [0, 90, 180, 270] as const) {
        const { room, source } = spatialRoom(templateIndex, rotation);
        const index = createDungeonSpatialIndex(source);
        for (const cell of room.footprint.cells) {
          const center = gridCellToWorld(cell, source.config);
          expect(detectDungeonRoom(source, index, center)).toBe(room.id);
          expect(worldToGridCell(center, source.config)).toEqual(cell);
        }
      }
    }
  });

  test("does not claim empty holes inside U/C/H bounding boxes", () => {
    for (const shape of ["U", "C", "H"] as const) {
      const templateIndex = DEFAULT_ROOM_TEMPLATES.findIndex(
        (template) => template.shape === shape,
      );
      const { room, source } = spatialRoom(templateIndex, 0);
      const index = createDungeonSpatialIndex(source);
      for (let z = room.footprint.bounds.minZ; z <= room.footprint.bounds.maxZ; z += 1) {
        for (let x = room.footprint.bounds.minX; x <= room.footprint.bounds.maxX; x += 1) {
          const cell = { floor: 0, x, z };
          const occupied = room.footprint.cells.some(
            (candidate) => candidate.x === x && candidate.z === z,
          );
          expect(detectDungeonRoom(source, index, gridCellToWorld(cell, source.config)))
            .toBe(occupied ? room.id : null);
        }
      }
    }
  });

  test("keeps identical x/z cells distinct across floors", () => {
    const config = resolveGenerationConfig({ world: { floors: 2 } });
    const template = DEFAULT_ROOM_TEMPLATES.find((candidate) => candidate.shape === "square")!;
    const makeRoom = (floor: number): DungeonRoom => {
      const id = `floor-${floor}`;
      const placed = placeTemplate(template, id, { floor, x: 20, z: 20 }, 0);
      return {
        archetype: "normal",
        biome: "test",
        branchDepth: 0,
        criticalPathIndex: null,
        footprint: placed.footprint,
        grants: { flags: [], items: [] },
        id,
        mandatory: false,
        progressionDepth: 0,
        role: "optional",
        shape: "square",
        sockets: placed.sockets,
        tags: [],
        templateId: template.id,
        topologyNodeId: id,
        transform: { origin: { floor, x: 20, z: 20 }, rotation: 0 },
      };
    };
    const source = { config, rooms: [makeRoom(0), makeRoom(1)] };
    const index = createDungeonSpatialIndex(source);
    expect(detectDungeonRoom(source, index, gridCellToWorld({ floor: 0, x: 20, z: 20 }, config)))
      .toBe("floor-0");
    expect(detectDungeonRoom(source, index, gridCellToWorld({ floor: 1, x: 20, z: 20 }, config)))
      .toBe("floor-1");
  });
});
