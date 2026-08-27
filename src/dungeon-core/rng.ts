import { uniformFloat64 } from "pure-rand/distribution/uniformFloat64";
import { uniformInt } from "pure-rand/distribution/uniformInt";
import { xoroshiro128plus } from "pure-rand/generator/xoroshiro128plus";
import type { RandomGenerator } from "pure-rand/types/RandomGenerator";
import { normalizeSeed } from "./config";
import { hashStringToInt32 } from "./identity";
import type { Seed } from "./types";

export const RNG_STREAM_NAMES = [
  "topology",
  "semantics",
  "placement",
  "routing",
  "portals",
  "population",
  "decoration",
] as const;

export type RngStreamName = (typeof RNG_STREAM_NAMES)[number];

export interface Rng {
  chance(probability: number): boolean;
  float(): number;
  int(minimum: number, maximum: number): number;
  pick<T>(values: readonly T[]): T;
  shuffle<T>(values: readonly T[]): T[];
  weightedPick<T>(values: readonly Readonly<{ value: T; weight: number }>[]): T;
}

export interface RngStreams {
  readonly seed: string;
  stream(name: RngStreamName | `${RngStreamName}:${string}`): Rng;
}

class PureRandRng implements Rng {
  private readonly generator: RandomGenerator;

  constructor(generator: RandomGenerator) {
    this.generator = generator;
  }

  float(): number {
    return uniformFloat64(this.generator);
  }

  int(minimum: number, maximum: number): number {
    if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum) || minimum > maximum) {
      throw new Error("Rng.int requires safe integer bounds with minimum <= maximum");
    }
    return uniformInt(this.generator, minimum, maximum);
  }

  chance(probability: number): boolean {
    if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
      throw new Error("Rng.chance probability must be between 0 and 1");
    }
    return this.float() < probability;
  }

  pick<T>(values: readonly T[]): T {
    if (values.length === 0) {
      throw new Error("Rng.pick cannot choose from an empty collection");
    }
    return values[this.int(0, values.length - 1)];
  }

  shuffle<T>(values: readonly T[]): T[] {
    const shuffled = [...values];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = this.int(0, index);
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
  }

  weightedPick<T>(values: readonly Readonly<{ value: T; weight: number }>[]): T {
    if (values.length === 0) {
      throw new Error("Rng.weightedPick cannot choose from an empty collection");
    }
    let total = 0;
    for (const entry of values) {
      if (!Number.isFinite(entry.weight) || entry.weight < 0) {
        throw new Error("Rng.weightedPick weights must be finite non-negative numbers");
      }
      total += entry.weight;
    }
    if (total <= 0) {
      throw new Error("Rng.weightedPick requires at least one positive weight");
    }

    let cursor = this.float() * total;
    for (const entry of values) {
      cursor -= entry.weight;
      if (cursor < 0) {
        return entry.value;
      }
    }
    return values[values.length - 1].value;
  }
}

class NamedRngStreams implements RngStreams {
  readonly seed: string;
  private readonly streams = new Map<string, Rng>();

  constructor(seed: Seed) {
    this.seed = normalizeSeed(seed);
  }

  stream(name: RngStreamName | `${RngStreamName}:${string}`): Rng {
    const rootName = name.split(":", 1)[0];
    if (!RNG_STREAM_NAMES.includes(rootName as RngStreamName)) {
      throw new Error(`Unknown RNG stream ${name}`);
    }

    const existing = this.streams.get(name);
    if (existing) {
      return existing;
    }

    const streamSeed = hashStringToInt32(`${this.seed}\u0000${name}`);
    const created = new PureRandRng(xoroshiro128plus(streamSeed));
    this.streams.set(name, created);
    return created;
  }
}

export function createRngStreams(seed: Seed): RngStreams {
  return new NamedRngStreams(seed);
}

export function createRng(seed: Seed, stream: RngStreamName): Rng {
  return createRngStreams(seed).stream(stream);
}
