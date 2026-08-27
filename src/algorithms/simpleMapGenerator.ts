/**
 * @deprecated Compatibility wrapper around the canonical dungeon core.
 * New code should call generateDungeon and keep Dungeon as its source of truth.
 */
import { canonicalDungeonToGameMap } from "../adapters/canonicalMapAdapter";
import { legacyMapConfigToGenerationConfig } from "../adapters/legacyGenerationConfig";
import { generateDungeon } from "../dungeon-core/generator";
import { createDungeonRunState } from "../dungeon-core/model";
import type { Dungeon, Seed } from "../dungeon-core/types";
import type { MapConfig, Room } from "../types/map";

export interface SimpleMapConfig extends MapConfig {
  corridorRunChance?: number;
  culDeSacChance?: number;
  enabledBiomeCategories?: string[];
  hubChance?: number;
  maxRoomSizeMultiplier?: number;
  minRoomSizeMultiplier?: number;
  multiTileChance?: number;
  multiTileMaxSegments?: number;
  portalChance: number;
  roomTypeWeights?: Record<string, number>;
  seed?: Seed;
  shapeChance: number;
  sizeVariationChance?: number;
  useLiminalSpaces?: boolean;
  useMultiTileRooms?: boolean;
  usePortals: boolean;
  useShapedRooms: boolean;
  useThemes?: boolean;
  useVariableRoomSizes?: boolean;
}

export const defaultSimpleConfig: SimpleMapConfig = {
  connectionChance: 0.4,
  enabledBiomeCategories: undefined,
  height: 56,
  maxRooms: 22,
  minRooms: 16,
  portalChance: 0.1,
  roomSize: 4,
  shapeChance: 1,
  specialRoomChance: 0.35,
  usePortals: true,
  useShapedRooms: true,
  width: 56,
};

export class SimpleMapGenerator {
  private readonly config: SimpleMapConfig;
  private generatedDungeon: Dungeon | null = null;

  constructor(config: Partial<SimpleMapConfig> = {}) {
    this.config = { ...defaultSimpleConfig, ...config };
  }

  generateMap(): { rooms: Room[]; startRoomId: string; endRoomId: string } {
    const result = generateDungeon({
      config: legacyMapConfigToGenerationConfig(
        this.config,
        this.config.enabledBiomeCategories,
      ),
      seed: this.config.seed ?? "simple-map-compatibility",
    });
    if (!result.ok) {
      throw new Error(`${result.error.code}: ${result.error.message}`);
    }
    this.generatedDungeon = result.dungeon;
    const map = canonicalDungeonToGameMap(
      result.dungeon,
      createDungeonRunState(result.dungeon),
    );
    return {
      endRoomId: map.endRoomId,
      rooms: map.rooms,
      startRoomId: map.startRoomId,
    };
  }

  getCanonicalDungeon(): Dungeon | null {
    return this.generatedDungeon;
  }
}
