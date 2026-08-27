import type {
  GenerationConfig,
  GenerationConfigInput,
  Seed,
} from "./types";

const TOP_LEVEL_KEYS = [
  "placement",
  "progression",
  "quality",
  "routing",
  "semantics",
  "topology",
  "world",
] as const;

export const DEFAULT_GENERATION_CONFIG: GenerationConfig = deepFreeze({
  placement: {
    candidateLimitPerRoom: 160,
    maxBacktracks: 8_000,
    maxRetries: 6,
    roomGap: { min: 2, max: 6 },
  },
  progression: {
    breakableRoutes: 1,
    keyLockPairs: 1,
    portals: 1,
    secretRoutes: 1,
    shortcuts: 1,
  },
  quality: {
    maxCorridorLength: 48,
    maxCorridorTurns: 12,
    minimumBossDepth: 0.7,
  },
  routing: {
    existingCorridorCost: 0.6,
    heuristicWeight: 1.05,
    intersectionCost: 4,
    maxExpandedNodes: 30_000,
    maxRetries: 5,
    proximityCost: 0.35,
    stepCost: 1,
    turnCost: 1.75,
  },
  semantics: {
    biomes: ["stone", "fungal", "crystal"],
    challengeSpacing: 2,
    rewardSpacing: 2,
    restSpacing: 3,
    shopCount: { min: 1, max: 2 },
  },
  topology: {
    branchBudget: 7,
    criticalPathLength: { min: 8, max: 11 },
    deadEndCount: { min: 4, max: 8 },
    hubCount: { min: 1, max: 2 },
    hubChance: 0.55,
    loopCount: { min: 1, max: 2 },
    maxBranchDepth: 3,
    optionalContentRatio: 0.35,
    totalRooms: { min: 16, max: 22 },
  },
  world: {
    cellSize: 4,
    depth: 56,
    floorHeight: 8,
    floors: 1,
    width: 56,
  },
});

export function normalizeSeed(seed: Seed): string {
  if (typeof seed === "number") {
    if (!Number.isFinite(seed) || !Number.isSafeInteger(seed)) {
      throw new Error("seed must be a finite safe integer or a non-empty string");
    }
    return String(seed);
  }

  const normalized = seed.trim();
  if (normalized.length === 0) {
    throw new Error("seed must not be empty");
  }
  return normalized;
}

export function resolveGenerationConfig(
  input: GenerationConfigInput = {},
): GenerationConfig {
  assertKnownKeys(input, TOP_LEVEL_KEYS, "config");
  assertKnownKeys(input.world, Object.keys(DEFAULT_GENERATION_CONFIG.world), "config.world");
  assertKnownKeys(
    input.topology,
    Object.keys(DEFAULT_GENERATION_CONFIG.topology),
    "config.topology",
  );
  assertKnownKeys(
    input.topology?.criticalPathLength,
    ["min", "max"],
    "config.topology.criticalPathLength",
  );
  assertKnownKeys(
    input.topology?.deadEndCount,
    ["min", "max"],
    "config.topology.deadEndCount",
  );
  assertKnownKeys(
    input.topology?.totalRooms,
    ["min", "max"],
    "config.topology.totalRooms",
  );
  assertKnownKeys(
    input.topology?.loopCount,
    ["min", "max"],
    "config.topology.loopCount",
  );
  assertKnownKeys(
    input.topology?.hubCount,
    ["min", "max"],
    "config.topology.hubCount",
  );
  assertKnownKeys(
    input.placement,
    Object.keys(DEFAULT_GENERATION_CONFIG.placement),
    "config.placement",
  );
  assertKnownKeys(input.placement?.roomGap, ["min", "max"], "config.placement.roomGap");
  assertKnownKeys(
    input.routing,
    Object.keys(DEFAULT_GENERATION_CONFIG.routing),
    "config.routing",
  );
  assertKnownKeys(
    input.semantics,
    Object.keys(DEFAULT_GENERATION_CONFIG.semantics),
    "config.semantics",
  );
  assertKnownKeys(
    input.semantics?.shopCount,
    ["min", "max"],
    "config.semantics.shopCount",
  );
  assertKnownKeys(
    input.progression,
    Object.keys(DEFAULT_GENERATION_CONFIG.progression),
    "config.progression",
  );
  assertKnownKeys(
    input.quality,
    Object.keys(DEFAULT_GENERATION_CONFIG.quality),
    "config.quality",
  );

  const config: GenerationConfig = {
    placement: {
      ...DEFAULT_GENERATION_CONFIG.placement,
      ...input.placement,
      roomGap: {
        ...DEFAULT_GENERATION_CONFIG.placement.roomGap,
        ...input.placement?.roomGap,
      },
    },
    progression: {
      ...DEFAULT_GENERATION_CONFIG.progression,
      ...input.progression,
    },
    quality: {
      ...DEFAULT_GENERATION_CONFIG.quality,
      ...input.quality,
    },
    routing: {
      ...DEFAULT_GENERATION_CONFIG.routing,
      ...input.routing,
    },
    semantics: {
      ...DEFAULT_GENERATION_CONFIG.semantics,
      ...input.semantics,
      biomes: input.semantics?.biomes
        ? [...input.semantics.biomes]
        : [...DEFAULT_GENERATION_CONFIG.semantics.biomes],
      shopCount: {
        ...DEFAULT_GENERATION_CONFIG.semantics.shopCount,
        ...input.semantics?.shopCount,
      },
    },
    topology: {
      ...DEFAULT_GENERATION_CONFIG.topology,
      ...input.topology,
      criticalPathLength: {
        ...DEFAULT_GENERATION_CONFIG.topology.criticalPathLength,
        ...input.topology?.criticalPathLength,
      },
      deadEndCount: {
        ...DEFAULT_GENERATION_CONFIG.topology.deadEndCount,
        ...input.topology?.deadEndCount,
      },
      hubCount: {
        ...DEFAULT_GENERATION_CONFIG.topology.hubCount,
        ...input.topology?.hubCount,
      },
      loopCount: {
        ...DEFAULT_GENERATION_CONFIG.topology.loopCount,
        ...input.topology?.loopCount,
      },
      totalRooms: {
        ...DEFAULT_GENERATION_CONFIG.topology.totalRooms,
        ...input.topology?.totalRooms,
      },
    },
    world: {
      ...DEFAULT_GENERATION_CONFIG.world,
      ...input.world,
    },
  };

  validateConfig(config);
  return deepFreeze(config);
}

function validateConfig(config: GenerationConfig): void {
  integerInRange(config.world.width, 16, 512, "config.world.width");
  integerInRange(config.world.depth, 16, 512, "config.world.depth");
  integerInRange(config.world.floors, 1, 8, "config.world.floors");
  finiteInRange(config.world.cellSize, 0.5, 64, "config.world.cellSize");
  finiteInRange(config.world.floorHeight, 2, 128, "config.world.floorHeight");

  validateIntegerRange(
    config.topology.criticalPathLength,
    5,
    128,
    "config.topology.criticalPathLength",
  );
  validateIntegerRange(config.topology.deadEndCount, 2, 128, "config.topology.deadEndCount");
  validateIntegerRange(config.topology.totalRooms, 7, 256, "config.topology.totalRooms");
  validateIntegerRange(config.topology.loopCount, 0, 64, "config.topology.loopCount");
  validateIntegerRange(config.topology.hubCount, 0, 32, "config.topology.hubCount");
  integerInRange(config.topology.branchBudget, 0, 128, "config.topology.branchBudget");
  integerInRange(config.topology.maxBranchDepth, 1, 16, "config.topology.maxBranchDepth");
  finiteInRange(config.topology.hubChance, 0, 1, "config.topology.hubChance");
  finiteInRange(
    config.topology.optionalContentRatio,
    0,
    0.8,
    "config.topology.optionalContentRatio",
  );
  if (config.topology.hubCount.min > 0 && config.topology.maxBranchDepth < 2) {
    throw new Error("config.topology.maxBranchDepth must be at least 2 when hubs are required");
  }
  if (config.topology.totalRooms.min < config.topology.criticalPathLength.min) {
    throw new Error(
      "config.topology.totalRooms.min must be at least criticalPathLength.min",
    );
  }
  if (config.topology.totalRooms.max < config.topology.criticalPathLength.max) {
    throw new Error(
      "config.topology.totalRooms.max must be at least criticalPathLength.max",
    );
  }

  integerInRange(config.placement.maxBacktracks, 0, 1_000_000, "config.placement.maxBacktracks");
  integerInRange(config.placement.maxRetries, 1, 100, "config.placement.maxRetries");
  integerInRange(
    config.placement.candidateLimitPerRoom,
    1,
    10_000,
    "config.placement.candidateLimitPerRoom",
  );
  validateIntegerRange(config.placement.roomGap, 1, 64, "config.placement.roomGap");
  if (
    config.placement.roomGap.max >= config.world.width
    || config.placement.roomGap.max >= config.world.depth
  ) {
    throw new Error("config.placement.roomGap.max must fit inside world width and depth");
  }

  integerInRange(
    config.routing.maxExpandedNodes,
    100,
    5_000_000,
    "config.routing.maxExpandedNodes",
  );
  integerInRange(config.routing.maxRetries, 1, 100, "config.routing.maxRetries");
  finiteInRange(config.routing.stepCost, 0.01, 1_000, "config.routing.stepCost");
  finiteInRange(config.routing.turnCost, 0, 1_000, "config.routing.turnCost");
  finiteInRange(config.routing.proximityCost, 0, 1_000, "config.routing.proximityCost");
  finiteInRange(
    config.routing.intersectionCost,
    0,
    1_000,
    "config.routing.intersectionCost",
  );
  finiteInRange(
    config.routing.existingCorridorCost,
    0.01,
    1_000,
    "config.routing.existingCorridorCost",
  );
  finiteInRange(
    config.routing.heuristicWeight,
    1,
    4,
    "config.routing.heuristicWeight",
  );

  if (config.semantics.biomes.length === 0) {
    throw new Error("config.semantics.biomes must contain at least one biome");
  }
  const uniqueBiomes = new Set<string>();
  for (const biome of config.semantics.biomes) {
    if (typeof biome !== "string" || biome.trim().length === 0) {
      throw new Error("config.semantics.biomes entries must be non-empty strings");
    }
    if (uniqueBiomes.has(biome)) {
      throw new Error(`config.semantics.biomes contains duplicate ${biome}`);
    }
    uniqueBiomes.add(biome);
  }
  integerInRange(
    config.semantics.challengeSpacing,
    0,
    64,
    "config.semantics.challengeSpacing",
  );
  integerInRange(
    config.semantics.rewardSpacing,
    0,
    64,
    "config.semantics.rewardSpacing",
  );
  integerInRange(
    config.semantics.restSpacing,
    0,
    64,
    "config.semantics.restSpacing",
  );
  validateIntegerRange(config.semantics.shopCount, 0, 16, "config.semantics.shopCount");

  for (const key of Object.keys(config.progression) as Array<keyof typeof config.progression>) {
    integerInRange(config.progression[key], 0, 64, `config.progression.${key}`);
  }

  integerInRange(
    config.quality.maxCorridorLength,
    1,
    1_024,
    "config.quality.maxCorridorLength",
  );
  integerInRange(
    config.quality.maxCorridorTurns,
    0,
    1_024,
    "config.quality.maxCorridorTurns",
  );
  finiteInRange(
    config.quality.minimumBossDepth,
    0.5,
    1,
    "config.quality.minimumBossDepth",
  );
}

function validateIntegerRange(
  range: Readonly<{ max: number; min: number }>,
  minimum: number,
  maximum: number,
  label: string,
): void {
  integerInRange(range.min, minimum, maximum, `${label}.min`);
  integerInRange(range.max, minimum, maximum, `${label}.max`);
  if (range.min > range.max) {
    throw new Error(`${label}.min must be less than or equal to ${label}.max`);
  }
}

function integerInRange(value: number, minimum: number, maximum: number, label: string): void {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be an integer between ${minimum} and ${maximum}`);
  }
}

function finiteInRange(value: number, minimum: number, maximum: number, label: string): void {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be a finite number between ${minimum} and ${maximum}`);
  }
}

function assertKnownKeys(
  value: object | undefined,
  allowedKeys: readonly string[],
  label: string,
): void {
  if (value === undefined) {
    return;
  }
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      throw new Error(`${label} contains unknown option ${key}`);
    }
  }
}

export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }
  return Object.freeze(value);
}
