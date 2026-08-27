import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { generateDungeon } from "../src/dungeon-core/generator";

const args = process.argv.slice(2);
const argument = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const count = Number(argument("--count") ?? 100);
const floors = Number(argument("--floors") ?? 1);
const format = argument("--format") ?? "json";
const outputPath = argument("--output");
if (!Number.isInteger(count) || count < 1) throw new Error("--count must be positive");
if (!Number.isInteger(floors) || floors < 1 || floors > 8) throw new Error("invalid --floors");
if (format !== "json" && format !== "csv") throw new Error("--format must be json or csv");

const rows: Array<Record<string, string | number>> = [];
const failures: Array<Record<string, string>> = [];
for (let index = 0; index < count; index += 1) {
  const seed = `expressive:${floors}:${index}`;
  const result = generateDungeon({
    config: { world: { floors } },
    now: () => performance.now(),
    seed,
  });
  if (!result.ok) {
    failures.push({ code: result.error.code, seed, stage: result.error.stage });
    continue;
  }
  const metrics = result.dungeon.metrics;
  rows.push({
    backtracks: result.diagnostics.backtracks,
    bossDepth: metrics.bossNormalizedDepth,
    compactness: metrics.compactness,
    corridorMean: metrics.corridorLength.mean,
    corridorTurns: metrics.corridorTurns,
    cycleRank: metrics.cycleRank,
    deadEnds: metrics.deadEndCount,
    durationMs: result.diagnostics.durationMs,
    graphDiameter: metrics.graphDiameter,
    nodeCount: metrics.nodeCount,
    optionalRatio: metrics.optionalContentRatio,
    routingExpanded: result.diagnostics.routingExpandedNodes,
    seed,
    spatialHash: metrics.spatialHash,
    topologyHash: metrics.topologyHash,
    utilization: metrics.utilization,
  });
}
const numericKeys = rows.length === 0
  ? []
  : Object.keys(rows[0]).filter((key) => typeof rows[0][key] === "number");
const distributions = Object.fromEntries(numericKeys.map((key) => {
  const values = rows.map((row) => Number(row[key]));
  return [key, {
    max: Math.max(...values),
    mean: values.reduce((total, value) => total + value, 0) / values.length,
    min: Math.min(...values),
  }];
}));
const jsonReport = {
  count,
  distributions,
  failures,
  floors,
  generatorVersion: "epic-1.0.0",
  rows,
  spatialDiversity: new Set(rows.map((row) => row.spatialHash)).size,
  successes: rows.length,
  topologyDiversity: new Set(rows.map((row) => row.topologyHash)).size,
};
const csvKeys = rows.length === 0 ? [] : Object.keys(rows[0]);
const csv = [
  csvKeys.join(","),
  ...rows.map((row) => csvKeys.map((key) => csvCell(row[key])).join(",")),
].join("\n");
const output = format === "json" ? `${JSON.stringify(jsonReport, null, 2)}\n` : `${csv}\n`;
if (outputPath) {
  const resolved = resolve(outputPath);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, output, "utf8");
}
process.stdout.write(output);
if (failures.length > 0) process.exitCode = 1;

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
