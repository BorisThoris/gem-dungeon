import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { generateDungeon } from "../generator";
import { encodeDungeon } from "../serialization";
import { validateDungeon } from "../validation";
import type { GenerationConfigInput } from "../types";

interface RegressionCase {
  readonly config?: GenerationConfigInput;
  readonly fastCheck?: Readonly<{ path?: string; seed?: number }>;
  readonly seed: string | number;
  readonly stage: string;
}

interface RegressionFile {
  readonly cases: readonly RegressionCase[];
  readonly category: string;
}

const corpusDirectory = new URL("../../../tests/seeds/", import.meta.url);
const corpus = readdirSync(corpusDirectory)
  .filter((file) => file.endsWith(".json"))
  .sort()
  .map((file) =>
    JSON.parse(readFileSync(new URL(file, corpusDirectory), "utf8")) as RegressionFile,
  );

describe("persisted minimized regression seeds", () => {
  test("covers every invariant failure category", () => {
    expect(corpus.map((entry) => entry.category)).toEqual([
      "overlap",
      "portals",
      "progression",
      "routing",
      "sockets",
      "vertical",
    ]);
    expect(corpus.every((entry) => entry.cases.length > 0)).toBe(true);
  });

  for (const entry of corpus) {
    test(`${entry.category} corpus remains fixed`, () => {
      for (const regression of entry.cases) {
        const result = generateDungeon({ config: regression.config, seed: regression.seed });
        expect(
          result.ok,
          result.ok
            ? undefined
            : `${entry.category}/${String(regression.seed)}:${result.error.code}`,
        ).toBe(true);
        if (!result.ok) continue;
        expect(validateDungeon(result.dungeon).valid).toBe(true);
        expect(() => encodeDungeon(result.dungeon)).not.toThrow();
      }
    }, 30_000);
  }
});
