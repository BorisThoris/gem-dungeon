import { cellKey, compareGridCells } from "./identity";
import type { Footprint, GenerationConfig, GridCell } from "./types";

export interface OccupancyRecord {
  readonly cell: GridCell;
  readonly clearanceOwnerId: string | null;
  readonly corridorOwnerIds: readonly string[];
  readonly roomOwnerId: string | null;
}

interface MutableOccupancyRecord {
  cell: GridCell;
  clearanceOwnerId: string | null;
  corridorOwnerIds: Set<string>;
  roomOwnerId: string | null;
}

export interface ReservationResult {
  readonly conflicts: readonly OccupancyRecord[];
  readonly ok: boolean;
  readonly outOfBounds: readonly GridCell[];
}

export class OccupancyGrid {
  private readonly recordsByCell = new Map<string, MutableOccupancyRecord>();
  private readonly config: GenerationConfig;

  constructor(config: GenerationConfig) {
    this.config = config;
  }

  clone(): OccupancyGrid {
    const copy = new OccupancyGrid(this.config);
    for (const [key, record] of this.recordsByCell) {
      copy.recordsByCell.set(key, {
        cell: record.cell,
        clearanceOwnerId: record.clearanceOwnerId,
        corridorOwnerIds: new Set(record.corridorOwnerIds),
        roomOwnerId: record.roomOwnerId,
      });
    }
    return copy;
  }

  isInBounds(cell: GridCell): boolean {
    return (
      Number.isInteger(cell.x)
      && Number.isInteger(cell.z)
      && Number.isInteger(cell.floor)
      && cell.x >= 0
      && cell.x < this.config.world.width
      && cell.z >= 0
      && cell.z < this.config.world.depth
      && cell.floor >= 0
      && cell.floor < this.config.world.floors
    );
  }

  canReserveRoom(footprint: Footprint): ReservationResult {
    const cells = [...footprint.cells, ...footprint.clearance];
    const outOfBounds = cells.filter((cell) => !this.isInBounds(cell));
    const conflicts = cells
      .map((cell) => this.get(cell))
      .filter((record): record is OccupancyRecord => Boolean(record))
      .filter(
        (record) =>
          record.roomOwnerId !== null
          || record.clearanceOwnerId !== null
          || record.corridorOwnerIds.length > 0,
      );
    return { conflicts, ok: outOfBounds.length === 0 && conflicts.length === 0, outOfBounds };
  }

  reserveRoom(ownerId: string, footprint: Footprint): ReservationResult {
    const result = this.canReserveRoom(footprint);
    if (!result.ok) {
      return result;
    }
    for (const cell of footprint.cells) {
      this.mutableRecord(cell).roomOwnerId = ownerId;
    }
    for (const cell of footprint.clearance) {
      this.mutableRecord(cell).clearanceOwnerId = ownerId;
    }
    return result;
  }

  canRouteThrough(cell: GridCell, endpointKeys: ReadonlySet<string> = new Set()): boolean {
    if (!this.isInBounds(cell)) {
      return false;
    }
    const record = this.recordsByCell.get(cellKey(cell));
    if (!record) {
      return true;
    }
    if (record.roomOwnerId !== null) {
      return false;
    }
    if (endpointKeys.has(cellKey(cell))) {
      return true;
    }
    return record.clearanceOwnerId === null;
  }

  reserveCorridor(ownerId: string, cells: readonly GridCell[]): ReservationResult {
    const endpointKeys = new Set(
      cells.length > 0 ? [cellKey(cells[0]), cellKey(cells[cells.length - 1])] : [],
    );
    const outOfBounds = cells.filter((cell) => !this.isInBounds(cell));
    const conflicts = cells
      .filter((cell) => !this.canRouteThrough(cell, endpointKeys))
      .map((cell) => this.get(cell))
      .filter((record): record is OccupancyRecord => Boolean(record));
    const result = {
      conflicts,
      ok: outOfBounds.length === 0 && conflicts.length === 0,
      outOfBounds,
    };
    if (!result.ok) {
      return result;
    }
    for (const cell of cells) {
      this.mutableRecord(cell).corridorOwnerIds.add(ownerId);
    }
    return result;
  }

  releaseOwner(ownerId: string): void {
    for (const [key, record] of this.recordsByCell) {
      if (record.roomOwnerId === ownerId) {
        record.roomOwnerId = null;
      }
      if (record.clearanceOwnerId === ownerId) {
        record.clearanceOwnerId = null;
      }
      record.corridorOwnerIds.delete(ownerId);
      if (
        record.roomOwnerId === null
        && record.clearanceOwnerId === null
        && record.corridorOwnerIds.size === 0
      ) {
        this.recordsByCell.delete(key);
      }
    }
  }

  corridorOwnerCount(cell: GridCell): number {
    return this.recordsByCell.get(cellKey(cell))?.corridorOwnerIds.size ?? 0;
  }

  roomProximity(cell: GridCell): number {
    let count = 0;
    for (const [dx, dz] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ] as const) {
      const record = this.recordsByCell.get(
        cellKey({ floor: cell.floor, x: cell.x + dx, z: cell.z + dz }),
      );
      if (record?.roomOwnerId !== null && record?.roomOwnerId !== undefined) {
        count += 1;
      }
    }
    return count;
  }

  get(cell: GridCell): OccupancyRecord | null {
    const record = this.recordsByCell.get(cellKey(cell));
    return record ? toReadonlyRecord(record) : null;
  }

  records(): readonly OccupancyRecord[] {
    return [...this.recordsByCell.values()]
      .sort((left, right) => compareGridCells(left.cell, right.cell))
      .map(toReadonlyRecord);
  }

  private mutableRecord(cell: GridCell): MutableOccupancyRecord {
    const key = cellKey(cell);
    const existing = this.recordsByCell.get(key);
    if (existing) {
      return existing;
    }
    const created: MutableOccupancyRecord = {
      cell,
      clearanceOwnerId: null,
      corridorOwnerIds: new Set(),
      roomOwnerId: null,
    };
    this.recordsByCell.set(key, created);
    return created;
  }
}

function toReadonlyRecord(record: MutableOccupancyRecord): OccupancyRecord {
  return {
    cell: record.cell,
    clearanceOwnerId: record.clearanceOwnerId,
    corridorOwnerIds: [...record.corridorOwnerIds].sort(),
    roomOwnerId: record.roomOwnerId,
  };
}
