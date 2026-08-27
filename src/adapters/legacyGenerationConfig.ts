import type { GenerationConfigInput } from "../dungeon-core/types";
import type { MapConfig } from "../types/map";

export function legacyMapConfigToGenerationConfig(
  config: MapConfig,
  enabledBiomes?: readonly string[],
): GenerationConfigInput {
  const minimumRooms = requireInteger(config.minRooms, "minRooms");
  const maximumRooms = requireInteger(config.maxRooms, "maxRooms");
  if (minimumRooms > maximumRooms) {
    throw new Error("minRooms must be less than or equal to maxRooms");
  }
  const criticalMaximum = Math.min(8, maximumRooms - 3);
  const criticalMinimum = Math.min(6, criticalMaximum);
  if (criticalMinimum < 5 || minimumRooms < criticalMinimum) {
    throw new Error("Legacy room range must fit a critical path of at least five rooms");
  }
  const loopMaximum = Math.max(1, Math.round(config.connectionChance * 4));
  const biomes = enabledBiomes
    ?.map((biome) => biome.trim())
    .filter((biome) => biome.length > 0);
  return {
    semantics: biomes && biomes.length > 0 ? { biomes } : undefined,
    topology: {
      criticalPathLength: { min: criticalMinimum, max: criticalMaximum },
      loopCount: { min: 1, max: loopMaximum },
      optionalContentRatio: config.specialRoomChance,
      totalRooms: { min: minimumRooms, max: maximumRooms },
    },
    world: {
      cellSize: config.roomSize,
      depth: requireInteger(config.height, "height"),
      width: requireInteger(config.width, "width"),
    },
  };
}

function requireInteger(value: number, label: string): number {
  if (!Number.isInteger(value)) throw new Error(`${label} must be an integer`);
  return value;
}
