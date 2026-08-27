import { describe, expect, test } from "vitest";
import { createRng, createRngStreams, RNG_STREAM_NAMES } from "../rng";

describe("deterministic RNG streams", () => {
  test("replays the same sequence for the same seed and stream", () => {
    const first = createRng("regression-seed", "topology");
    const second = createRng("regression-seed", "topology");

    expect(Array.from({ length: 16 }, () => first.int(-1000, 1000))).toEqual(
      Array.from({ length: 16 }, () => second.int(-1000, 1000)),
    );
  });

  test("isolates named streams from unrelated draw counts", () => {
    const baseline = createRngStreams("stream-isolation");
    const perturbed = createRngStreams("stream-isolation");

    const expectedTopology = Array.from({ length: 12 }, () =>
      baseline.stream("topology").float(),
    );
    Array.from({ length: 500 }, () => perturbed.stream("decoration").float());
    const actualTopology = Array.from({ length: 12 }, () =>
      perturbed.stream("topology").float(),
    );

    expect(actualTopology).toEqual(expectedTopology);
  });

  test("supports deterministic attempt substreams without stream-order coupling", () => {
    const first = createRngStreams(42);
    const second = createRngStreams(42);
    const attemptTwo = Array.from({ length: 8 }, () =>
      first.stream("placement:attempt-2").int(0, 10_000),
    );
    Array.from({ length: 40 }, () => second.stream("placement:attempt-0").float());

    expect(
      Array.from({ length: 8 }, () =>
        second.stream("placement:attempt-2").int(0, 10_000),
      ),
    ).toEqual(attemptTwo);
  });

  test("implements bounded helpers and rejects invalid calls", () => {
    const rng = createRng("helpers", "population");
    expect(RNG_STREAM_NAMES).toHaveLength(7);
    expect(rng.shuffle([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
    expect(["a", "b"]).toContain(rng.pick(["a", "b"]));
    expect(rng.weightedPick([{ value: "only", weight: 1 }])).toBe("only");
    expect(() => rng.int(2, 1)).toThrow(/minimum <= maximum/);
    expect(() => rng.pick([])).toThrow(/empty/);
    expect(() => rng.chance(1.1)).toThrow(/between 0 and 1/);
  });
});
