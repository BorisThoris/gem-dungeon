import { describe, expect, test } from "vitest";
import { localCellKey } from "../identity";
import {
  DEFAULT_ROOM_TEMPLATES,
  ROOM_SHAPE_FOOTPRINTS,
  createRoomTemplate,
  getTemplateSetVersion,
  placeTemplate,
  transformLocalCell,
  validateTemplateSet,
} from "../templates";

describe("canonical room templates and footprints", () => {
  test.each([
    ["square", ["0:0"]],
    ["line", ["0:-1", "0:0", "0:1"]],
    ["block", ["0:0", "1:0", "0:1", "1:1"]],
    ["L", ["0:0", "0:1", "0:2", "1:2"]],
    ["T", ["-1:0", "0:0", "1:0", "0:1"]],
    ["plus", ["0:-1", "-1:0", "0:0", "1:0", "0:1"]],
    ["U", ["-1:-1", "-1:0", "-1:1", "0:1", "1:-1", "1:0", "1:1"]],
    ["C", ["-1:-1", "0:-1", "1:-1", "-1:0", "-1:1", "0:1", "1:1"]],
    ["H", ["-1:-1", "-1:0", "-1:1", "0:0", "1:-1", "1:0", "1:1"]],
  ] as const)("defines the expected %s cells without duplicates", (shape, expected) => {
    const keys = ROOM_SHAPE_FOOTPRINTS[shape].map(localCellKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(expect.arrayContaining([...expected]));
    expect(keys).toHaveLength(expected.length);
  });

  test("rotates footprints and geometric socket normals deterministically", () => {
    expect(transformLocalCell({ x: 2, z: 1 }, 90)).toEqual({ x: -1, z: 2 });
    const template = DEFAULT_ROOM_TEMPLATES.find((candidate) => candidate.shape === "L")!;
    const placed = placeTemplate(
      template,
      "room-001",
      { floor: 1, x: 10, z: 20 },
      90,
    );

    expect(placed.footprint.cells).toEqual(
      expect.arrayContaining([
        { floor: 1, x: 10, z: 20 },
        { floor: 1, x: 9, z: 20 },
        { floor: 1, x: 8, z: 20 },
        { floor: 1, x: 8, z: 21 },
      ]),
    );
    expect(placed.sockets.every((socket) => socket.roomId === "room-001")).toBe(true);
    expect(placed.sockets.some((socket) => socket.normal.y === 1)).toBe(true);
    expect(placed.sockets.some((socket) => socket.normal.y === -1)).toBe(true);
  });

  test("creates boundary sockets and rejects malformed footprints", () => {
    const square = DEFAULT_ROOM_TEMPLATES.find((candidate) => candidate.shape === "square")!;
    const horizontalSockets = square.sockets.filter((socket) => socket.normal.y === 0);
    expect(horizontalSockets).toHaveLength(4);
    expect(horizontalSockets.every((socket) => socket.compatibility.includes("standard"))).toBe(true);
    expect(() =>
      createRoomTemplate(
        "duplicate",
        "Duplicate",
        "T",
        [
          { x: 0, z: 0 },
          { x: 0, z: 0 },
        ],
        ["normal"],
      ),
    ).toThrow(/duplicate cell/);
    expect(() =>
      createRoomTemplate(
        "disconnected",
        "Disconnected",
        "line",
        [
          { x: 0, z: 0 },
          { x: 3, z: 0 },
        ],
        ["normal"],
      ),
    ).toThrow(/4-neighbor connected/);
  });

  test("computes a stable template-set version independent of array order", () => {
    expect(getTemplateSetVersion(DEFAULT_ROOM_TEMPLATES)).toBe(
      getTemplateSetVersion([...DEFAULT_ROOM_TEMPLATES].reverse()),
    );
  });

  test("validates custom socket geometry instead of silently regenerating it", () => {
    const square = DEFAULT_ROOM_TEMPLATES.find((candidate) => candidate.id === "square")!;
    expect(() =>
      validateTemplateSet([
        {
          ...square,
          sockets: [
            ...square.sockets,
            { ...square.sockets[0], cell: { x: 99, z: 99 }, id: "off-footprint" },
          ],
        },
      ]),
    ).toThrow(/not on its footprint/);
    expect(() =>
      validateTemplateSet([
        {
          ...square,
          sockets: [square.sockets[0], { ...square.sockets[0] }],
        },
      ]),
    ).toThrow(/duplicate socket id/);
    const validated = validateTemplateSet([...DEFAULT_ROOM_TEMPLATES].reverse());
    expect(Object.isFrozen(validated)).toBe(true);
    expect(validated.map((template) => template.id)).toEqual(
      [...validated.map((template) => template.id)].sort(),
    );
  });
});
