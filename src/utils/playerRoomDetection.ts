import {
  createDungeonSpatialIndex,
  detectDungeonRoom,
  gridCellToWorld,
  type DungeonSpatialIndex,
} from "../dungeon-core/spatial";
import type { Dungeon } from "../dungeon-core/types";
import type { Room } from "../types/map";

export interface RoomBounds {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY: number;
  maxY: number;
  centerX: number;
  centerZ: number;
  size: number;
}

export class PlayerRoomDetection {
  private canonicalDungeon: Dungeon | null = null;
  private canonicalIndex: DungeonSpatialIndex | null = null;
  private readonly roomBounds = new Map<string, RoomBounds>();
  private currentRoomId: string | null = null;
  private lastPlayerPosition: { x: number; y: number; z: number } | null = null;
  private detectionThreshold = 0.25;
  private detectionEnabled = true;

  initializeDungeon(dungeon: Dungeon): void {
    this.canonicalDungeon = dungeon;
    this.canonicalIndex = createDungeonSpatialIndex(dungeon);
    this.roomBounds.clear();
    for (const room of dungeon.rooms) {
      const centers = room.footprint.cells.map((cell) => gridCellToWorld(cell, dungeon.config));
      const halfCell = dungeon.config.world.cellSize / 2;
      const floorCenter = room.transform.origin.floor * dungeon.config.world.floorHeight;
      const width =
        (room.footprint.bounds.maxX - room.footprint.bounds.minX + 1)
        * dungeon.config.world.cellSize;
      const depth =
        (room.footprint.bounds.maxZ - room.footprint.bounds.minZ + 1)
        * dungeon.config.world.cellSize;
      this.roomBounds.set(room.id, {
        centerX: centers.reduce((total, center) => total + center.x, 0) / centers.length,
        centerZ: centers.reduce((total, center) => total + center.z, 0) / centers.length,
        id: room.id,
        maxX: Math.max(...centers.map((center) => center.x)) + halfCell,
        maxY: floorCenter + dungeon.config.world.floorHeight / 2,
        maxZ: Math.max(...centers.map((center) => center.z)) + halfCell,
        minX: Math.min(...centers.map((center) => center.x)) - halfCell,
        minY: floorCenter - dungeon.config.world.floorHeight / 2,
        minZ: Math.min(...centers.map((center) => center.z)) - halfCell,
        size: Math.max(width, depth),
      });
    }
    this.clearCurrentRoom();
  }

  /** @deprecated Legacy square bounds are supported only for non-canonical maps. */
  initializeRoomBounds(rooms: Room[]): void {
    this.canonicalDungeon = null;
    this.canonicalIndex = null;
    this.roomBounds.clear();
    for (const room of rooms) {
      const roomSize = room.actualSize ?? room.size ?? 10;
      const halfSize = roomSize / 2;
      this.roomBounds.set(room.id, {
        centerX: room.position.x,
        centerZ: room.position.z,
        id: room.id,
        maxX: room.position.x + halfSize,
        maxY: 4,
        maxZ: room.position.z + halfSize,
        minX: room.position.x - halfSize,
        minY: -2,
        minZ: room.position.z - halfSize,
        size: roomSize,
      });
    }
    this.clearCurrentRoom();
  }

  detectCurrentRoom(playerPosition: { x: number; y: number; z: number }): string | null {
    if (!this.detectionEnabled) return this.currentRoomId;
    if (!this.shouldRecalculate(playerPosition)) return this.currentRoomId;
    this.lastPlayerPosition = { ...playerPosition };

    const detected = this.canonicalDungeon && this.canonicalIndex
      ? detectDungeonRoom(this.canonicalDungeon, this.canonicalIndex, playerPosition)
      : this.detectLegacyRoom(playerPosition);
    this.currentRoomId = detected;
    return detected;
  }

  getCurrentRoomId(): string | null {
    return this.currentRoomId;
  }

  getRoomBounds(roomId: string): RoomBounds | undefined {
    return this.roomBounds.get(roomId);
  }

  getAllRoomBounds(): Map<string, RoomBounds> {
    return new Map(this.roomBounds);
  }

  setDetectionEnabled(enabled: boolean): void {
    this.detectionEnabled = enabled;
  }

  isDetectionEnabled(): boolean {
    return this.detectionEnabled;
  }

  setDetectionThreshold(threshold: number): void {
    if (!Number.isFinite(threshold) || threshold < 0) {
      throw new Error("Room detection threshold must be a finite non-negative number");
    }
    this.detectionThreshold = threshold;
  }

  clearCurrentRoom(): void {
    this.currentRoomId = null;
    this.lastPlayerPosition = null;
  }

  clearDungeon(): void {
    this.canonicalDungeon = null;
    this.canonicalIndex = null;
    this.roomBounds.clear();
    this.clearCurrentRoom();
  }

  getDebugInfo(): {
    canonical: boolean;
    currentRoomId: string | null;
    lastPlayerPosition: { x: number; y: number; z: number } | null;
    detectionThreshold: number;
    isDetectionEnabled: boolean;
    roomCount: number;
  } {
    return {
      canonical: this.canonicalDungeon !== null,
      currentRoomId: this.currentRoomId,
      detectionThreshold: this.detectionThreshold,
      isDetectionEnabled: this.detectionEnabled,
      lastPlayerPosition: this.lastPlayerPosition,
      roomCount: this.roomBounds.size,
    };
  }

  private shouldRecalculate(playerPosition: { x: number; y: number; z: number }): boolean {
    if (!this.lastPlayerPosition) return true;
    const dx = playerPosition.x - this.lastPlayerPosition.x;
    const dy = playerPosition.y - this.lastPlayerPosition.y;
    const dz = playerPosition.z - this.lastPlayerPosition.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) >= this.detectionThreshold;
  }

  private detectLegacyRoom(playerPosition: { x: number; y: number; z: number }): string | null {
    for (const [roomId, bounds] of this.roomBounds) {
      if (
        playerPosition.x >= bounds.minX
        && playerPosition.x <= bounds.maxX
        && playerPosition.z >= bounds.minZ
        && playerPosition.z <= bounds.maxZ
        && playerPosition.y >= bounds.minY
        && playerPosition.y <= bounds.maxY
      ) {
        return roomId;
      }
    }
    return null;
  }
}

export const playerRoomDetection = new PlayerRoomDetection();
