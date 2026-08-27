import { cellKey } from "./identity";
import type { Dungeon, GenerationConfig, GridCell } from "./types";

export interface WorldPosition {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface DungeonSpatialIndex {
  readonly roomIdByCell: ReadonlyMap<string, string>;
}

export type DungeonSpatialSource = Pick<Dungeon, "config" | "rooms">;

export function createDungeonSpatialIndex(dungeon: DungeonSpatialSource): DungeonSpatialIndex {
  const roomIdByCell = new Map<string, string>();
  for (const room of dungeon.rooms) {
    for (const cell of room.footprint.cells) {
      const key = cellKey(cell);
      if (roomIdByCell.has(key)) {
        throw new Error(`Cannot index overlapping canonical cell ${key}`);
      }
      roomIdByCell.set(key, room.id);
    }
  }
  return { roomIdByCell };
}

export function gridCellToWorld(
  cell: GridCell,
  config: GenerationConfig,
): WorldPosition {
  assertGridCellInBounds(cell, config);
  return {
    x: (cell.x - (config.world.width - 1) / 2) * config.world.cellSize,
    y: cell.floor * config.world.floorHeight,
    z: (cell.z - (config.world.depth - 1) / 2) * config.world.cellSize,
  };
}

export function worldToGridCell(
  position: WorldPosition,
  config: GenerationConfig,
): GridCell | null {
  if (![position.x, position.y, position.z].every(Number.isFinite)) return null;
  const floor = Math.round(position.y / config.world.floorHeight);
  const floorCenter = floor * config.world.floorHeight;
  if (Math.abs(position.y - floorCenter) > config.world.floorHeight / 2) return null;
  const cell: GridCell = {
    floor,
    x: Math.floor(position.x / config.world.cellSize + config.world.width / 2),
    z: Math.floor(position.z / config.world.cellSize + config.world.depth / 2),
  };
  return isGridCellInBounds(cell, config) ? cell : null;
}

export function detectDungeonRoom(
  dungeon: DungeonSpatialSource,
  index: DungeonSpatialIndex,
  position: WorldPosition,
): string | null {
  const cell = worldToGridCell(position, dungeon.config);
  return cell ? index.roomIdByCell.get(cellKey(cell)) ?? null : null;
}

export function isGridCellInBounds(cell: GridCell, config: GenerationConfig): boolean {
  return (
    Number.isInteger(cell.floor)
    && Number.isInteger(cell.x)
    && Number.isInteger(cell.z)
    && cell.floor >= 0
    && cell.floor < config.world.floors
    && cell.x >= 0
    && cell.x < config.world.width
    && cell.z >= 0
    && cell.z < config.world.depth
  );
}

function assertGridCellInBounds(cell: GridCell, config: GenerationConfig): void {
  if (!isGridCellInBounds(cell, config)) {
    throw new Error(`Grid cell ${cellKey(cell)} is outside the canonical world`);
  }
}
