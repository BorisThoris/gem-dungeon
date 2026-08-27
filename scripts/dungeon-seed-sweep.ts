import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { generateDungeon } from "../src/dungeon-core/generator";
import { validateDungeon } from "../src/dungeon-core/validation";

interface SweepFailure {
  readonly code: string;
  readonly configHash: string;
  readonly seed: string;
  readonly stage: string;
  readonly templateSetVersion: string;
}

const options = parseArguments(process.argv.slice(2));
const failures: SweepFailure[] = [];
const started = performance.now();
let totalRooms = 0;
let totalBacktracks = 0;
for (let index = 0; index < options.count; index += 1) {
  const seed = `${options.prefix}:${index}`;
  const result = generateDungeon({
    config: { world: { floors: options.floors } },
    now: () => performance.now(),
    seed,
  });
  if (!result.ok) {
    failures.push({
      code: result.error.code,
      configHash: result.diagnostics.configHash,
      seed,
      stage: result.error.stage,
      templateSetVersion: result.diagnostics.templateSetVersion,
    });
    continue;
  }
  const report = validateDungeon(result.dungeon);
  if (!report.valid) {
    failures.push({
      code: report.issues.find((issue) => issue.severity === "error")?.code ?? "INVALID",
      configHash: result.dungeon.replay.configHash,
      seed,
      stage: "validation",
      templateSetVersion: result.dungeon.replay.templateSetVersion,
    });
    continue;
  }
  totalRooms += result.dungeon.rooms.length;
  totalBacktracks += result.diagnostics.backtracks;
}
const report = {
  backtracks: totalBacktracks,
  count: options.count,
  durationMs: Math.round((performance.now() - started) * 1_000) / 1_000,
  failures,
  floors: options.floors,
  meanRooms: options.count - failures.length === 0
    ? 0
    : totalRooms / (options.count - failures.length),
  prefix: options.prefix,
  successes: options.count - failures.length,
};
const output = `${JSON.stringify(report, null, 2)}\n`;
if (options.output) {
  const outputPath = resolve(options.output);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, output, "utf8");
}
process.stdout.write(output);
if (failures.length > 0) process.exitCode = 1;

function parseArguments(args: readonly string[]): Readonly<{
  count: number;
  floors: number;
  output: string | null;
  prefix: string;
}> {
  const value = (name: string): string | undefined => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const count = Number(value("--count") ?? 25);
  const floors = Number(value("--floors") ?? 1);
  if (!Number.isInteger(count) || count < 1 || count > 100_000) {
    throw new Error("--count must be an integer between 1 and 100000");
  }
  if (!Number.isInteger(floors) || floors < 1 || floors > 8) {
    throw new Error("--floors must be an integer between 1 and 8");
  }
  return {
    count,
    floors,
    output: value("--output") ?? null,
    prefix: value("--prefix") ?? "sweep",
  };
}
