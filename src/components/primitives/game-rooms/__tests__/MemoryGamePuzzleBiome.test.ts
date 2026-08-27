import { describe, expect, test } from "vitest";

function validatePattern(
  playerSequence: readonly number[],
  expectedPattern: readonly number[],
): boolean {
  return playerSequence.length === expectedPattern.length
    && playerSequence.every((id, index) => id === expectedPattern[index]);
}

function generatePattern(
  length: number,
  blockCount: number,
  next: () => number,
): number[] {
  if (!Number.isInteger(length) || length < 0) throw new Error("invalid pattern length");
  if (!Number.isInteger(blockCount) || blockCount < 1) throw new Error("invalid block count");
  return Array.from({ length }, () => Math.floor(next() * blockCount));
}

describe("MemoryGamePuzzleBiome pattern logic", () => {
  test.each([
    { expected: [0], player: [0] },
    { expected: [1, 2], player: [1, 2] },
    { expected: [0, 1, 2], player: [0, 1, 2] },
    { expected: [0, 0, 1, 1], player: [0, 0, 1, 1] },
    { expected: [], player: [] },
  ])("accepts an exact sequence: $expected", ({ expected, player }) => {
    expect(validatePattern(player, expected)).toBe(true);
  });

  test.each([
    { expected: [0], player: [1] },
    { expected: [1, 2], player: [2, 1] },
    { expected: [0, 1, 2], player: [0, 1] },
    { expected: [0, 1], player: [0, 1, 2] },
    { expected: [0, 0, 1, 1], player: [0, 1, 0, 1] },
  ])("rejects an incorrect or partial sequence: $player", ({ expected, player }) => {
    expect(validatePattern(player, expected)).toBe(false);
  });

  test("generates bounded patterns through an injected deterministic source", () => {
    const values = [0, 0.24, 0.5, 0.99];
    let index = 0;
    const pattern = generatePattern(8, 4, () => values[index++ % values.length]);
    expect(pattern).toEqual([0, 0, 2, 3, 0, 0, 2, 3]);
    expect(pattern.every((id) => id >= 0 && id < 4)).toBe(true);
  });

  test("rejects invalid generation bounds explicitly", () => {
    expect(() => generatePattern(-1, 4, () => 0)).toThrow(/pattern length/);
    expect(() => generatePattern(2, 0, () => 0)).toThrow(/block count/);
  });
});
