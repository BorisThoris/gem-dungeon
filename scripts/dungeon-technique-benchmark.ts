import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { generateDungeon } from "../src/dungeon-core/generator";
import { encodeDungeon } from "../src/dungeon-core/serialization";
import type {
  Dungeon,
  DungeonMetrics,
  GenerationConfigInput,
  GenerationResult,
} from "../src/dungeon-core/types";
import { validateDungeon } from "../src/dungeon-core/validation";

interface BenchmarkScenario {
  readonly config: GenerationConfigInput;
  readonly description: string;
  readonly id: string;
}

interface CandidateRun {
  readonly backtracks: number;
  readonly dungeon: Dungeon | null;
  readonly elapsedMs: number;
  readonly errorCode: string | null;
  readonly errorStage: string | null;
  readonly routingExpandedNodes: number;
  readonly score: number | null;
  readonly seed: string;
  readonly traceEvents: number;
  readonly valid: boolean;
}

const SCENARIOS: readonly BenchmarkScenario[] = [
  {
    config: {},
    description: "Production defaults",
    id: "production-default",
  },
  {
    config: {
      placement: {
        candidateLimitPerRoom: 240,
        maxBacktracks: 20_000,
        maxRetries: 8,
        roomGap: { max: 5, min: 1 },
      },
      quality: {
        maxCorridorLength: 36,
        maxCorridorTurns: 9,
        minimumBossDepth: 0.75,
      },
      routing: {
        maxExpandedNodes: 50_000,
        maxRetries: 8,
      },
      topology: {
        branchBudget: 10,
        criticalPathLength: { max: 12, min: 10 },
        deadEndCount: { max: 9, min: 6 },
        hubCount: { max: 3, min: 2 },
        hubChance: 0.75,
        loopCount: { max: 4, min: 3 },
        maxBranchDepth: 4,
        optionalContentRatio: 0.5,
        totalRooms: { max: 26, min: 22 },
      },
      world: { depth: 44, width: 44 },
    },
    description: "Dense topology in reduced single-floor bounds",
    id: "dense-tight",
  },
  {
    config: {
      placement: {
        candidateLimitPerRoom: 220,
        maxBacktracks: 16_000,
        maxRetries: 8,
      },
      routing: {
        maxExpandedNodes: 50_000,
        maxRetries: 8,
      },
      topology: {
        branchBudget: 9,
        criticalPathLength: { max: 12, min: 10 },
        deadEndCount: { max: 8, min: 5 },
        loopCount: { max: 3, min: 2 },
        totalRooms: { max: 24, min: 20 },
      },
      world: { depth: 48, floors: 3, width: 48 },
    },
    description: "Three floors with vertical socket reservations",
    id: "three-floor",
  },
  {
    config: {
      placement: {
        candidateLimitPerRoom: 180,
        maxBacktracks: 8_000,
        maxRetries: 5,
        roomGap: { max: 4, min: 1 },
      },
      progression: {
        breakableRoutes: 2,
        keyLockPairs: 2,
        portals: 2,
        secretRoutes: 2,
        shortcuts: 2,
      },
      routing: {
        maxExpandedNodes: 30_000,
        maxRetries: 5,
      },
      topology: {
        branchBudget: 9,
        criticalPathLength: { max: 12, min: 10 },
        deadEndCount: { max: 8, min: 5 },
        loopCount: { max: 3, min: 2 },
        maxBranchDepth: 4,
        optionalContentRatio: 0.45,
        totalRooms: { max: 25, min: 22 },
      },
      world: { depth: 52, width: 52 },
    },
    description: "High branch, loop, and gated-progression pressure",
    id: "progression-pressure",
  },
];

const options = parseArguments(process.argv.slice(2));
const requestedScenarios = options.scenario === null
  ? SCENARIOS
  : SCENARIOS.filter((scenario) => scenario.id === options.scenario);
if (requestedScenarios.length === 0) {
  throw new Error(`Unknown --scenario ${options.scenario}`);
}

let integrityFailure = false;
const scenarioReports = requestedScenarios.map((scenario) => {
  const baselineRuns: CandidateRun[] = [];
  const selectedRuns: CandidateRun[] = [];
  const allRuns: CandidateRun[] = [];
  const groupElapsedMs: number[] = [];
  const selectedCandidateIndices: number[] = [];
  let baselineDeterministic = 0;
  let selectedDeterministic = 0;

  for (let trial = 0; trial < options.count; trial += 1) {
    process.stderr.write(
      `[benchmark] ${scenario.id} trial ${trial + 1}/${options.count}\n`,
    );
    const candidates: CandidateRun[] = [];
    for (let candidate = 0; candidate < options.candidates; candidate += 1) {
      const seed = `technique:${scenario.id}:${trial}:candidate:${candidate}`;
      const run = runCandidate(seed, scenario.config);
      if (run.errorCode === "BENCHMARK_VALIDATION_INVALID") integrityFailure = true;
      candidates.push(run);
      allRuns.push(run);
    }
    baselineRuns.push(candidates[0]);
    groupElapsedMs.push(candidates.reduce((sum, run) => sum + run.elapsedMs, 0));
    const selected = selectBestValid(candidates);
    const selectedRun = selected?.run ?? candidates[0];
    selectedRuns.push(selectedRun);
    selectedCandidateIndices.push(selected?.index ?? -1);

    if (replaysExactly(candidates[0], scenario.config)) baselineDeterministic += 1;
    if (replaysExactly(selectedRun, scenario.config)) selectedDeterministic += 1;
  }

  const baselineValid = baselineRuns.filter((run) => run.valid);
  const selectedValid = selectedRuns.filter((run) => run.valid);
  const allValid = allRuns.filter((run) => run.valid);
  const baseline = summarizeStrategy(
    baselineRuns,
    baselineValid,
    baselineDeterministic,
    options.count,
    baselineRuns.map((run) => run.elapsedMs),
  );
  const bestOfN = {
    ...summarizeStrategy(
      selectedRuns,
      selectedValid,
      selectedDeterministic,
      options.count,
      groupElapsedMs,
    ),
    candidatesPerTrial: options.candidates,
    selectedCandidateIndices,
  };
  const report = {
    baseline,
    bestOfN,
    comparison: {
      elapsedMultiplier: divideNullable(bestOfN.meanElapsedMs, baseline.meanElapsedMs),
      meanQualityDelta: subtractNullable(
        bestOfN.meanQualityScore,
        baseline.meanQualityScore,
      ),
    },
    config: scenario.config,
    description: scenario.description,
    id: scenario.id,
    solverAttempts: {
      attempts: allRuns.length,
      failuresByCode: failureCounts(allRuns),
      meanBacktracks: mean(allValid.map((run) => run.backtracks)),
      meanRoutingExpandedNodes: mean(allValid.map((run) => run.routingExpandedNodes)),
      meanTraceEvents: mean(allRuns.map((run) => run.traceEvents)),
      successRate: ratio(allValid.length, allRuns.length),
      successes: allValid.length,
    },
  };
  return report;
});

const report = {
  benchmarkVersion: "1.0.0",
  candidateStrategy: {
    hardGate: "Only canonical dungeons passing validateDungeon are scored",
    score: "2*criticalPath + 4*cycleRank + deadEnds + 10*optionalRatio + 8*bossDepth - meanRouteStretch - 0.05*meanCorridorLength - 0.1*(archetypeRepetitions+biomeRepetitions)",
  },
  candidatesPerTrial: options.candidates,
  runtime: {
    architecture: process.arch,
    node: process.version,
    platform: process.platform,
  },
  scenarios: scenarioReports,
  trialsPerScenario: options.count,
};
const output = `${JSON.stringify(report, null, 2)}\n`;
if (options.output) {
  const outputPath = resolve(options.output);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, output, "utf8");
}
process.stdout.write(output);
if (integrityFailure) process.exitCode = 1;

function runCandidate(seed: string, config: GenerationConfigInput): CandidateRun {
  const started = performance.now();
  const result = generateDungeon({ config, now: () => performance.now(), seed });
  const elapsedMs = round(performance.now() - started);
  if (!result.ok) return failedRun(seed, elapsedMs, result);
  const validation = validateDungeon(result.dungeon);
  if (!validation.valid) {
    return {
      backtracks: result.diagnostics.backtracks,
      dungeon: null,
      elapsedMs,
      errorCode: "BENCHMARK_VALIDATION_INVALID",
      errorStage: "validation",
      routingExpandedNodes: result.diagnostics.routingExpandedNodes,
      score: null,
      seed,
      traceEvents: result.diagnostics.trace.length,
      valid: false,
    };
  }
  return {
    backtracks: result.diagnostics.backtracks,
    dungeon: result.dungeon,
    elapsedMs,
    errorCode: null,
    errorStage: null,
    routingExpandedNodes: result.diagnostics.routingExpandedNodes,
    score: qualityScore(result.dungeon.metrics),
    seed,
    traceEvents: result.diagnostics.trace.length,
    valid: true,
  };
}

function failedRun(
  seed: string,
  elapsedMs: number,
  result: Extract<GenerationResult, { ok: false }>,
): CandidateRun {
  return {
    backtracks: result.diagnostics.backtracks,
    dungeon: null,
    elapsedMs,
    errorCode: result.error.code,
    errorStage: result.error.stage,
    routingExpandedNodes: result.diagnostics.routingExpandedNodes,
    score: null,
    seed,
    traceEvents: result.diagnostics.trace.length,
    valid: false,
  };
}

function selectBestValid(
  runs: readonly CandidateRun[],
): Readonly<{ index: number; run: CandidateRun }> | null {
  const valid = runs
    .map((run, index) => ({ index, run }))
    .filter((entry) => entry.run.valid)
    .sort((left, right) =>
      (right.run.score ?? -Infinity) - (left.run.score ?? -Infinity)
      || left.run.seed.localeCompare(right.run.seed));
  return valid[0] ?? null;
}

function replaysExactly(run: CandidateRun, config: GenerationConfigInput): boolean {
  const replay = generateDungeon({ config, now: () => 0, seed: run.seed });
  if (!run.valid) {
    return !replay.ok
      && replay.error.code === run.errorCode
      && replay.error.stage === run.errorStage;
  }
  return replay.ok && encodeDungeon(replay.dungeon) === encodeDungeon(run.dungeon!);
}

function summarizeStrategy(
  runs: readonly CandidateRun[],
  validRuns: readonly CandidateRun[],
  deterministic: number,
  determinismDenominator: number,
  elapsedMs: readonly number[],
) {
  return {
    attempts: runs.length,
    deterministic,
    deterministicRate: ratio(deterministic, determinismDenominator),
    failuresByCode: failureCounts(runs),
    meanElapsedMs: mean(elapsedMs),
    meanQualityScore: mean(validRuns.map((run) => run.score!)),
    p95ElapsedMs: percentile(elapsedMs, 0.95),
    successRate: ratio(validRuns.length, determinismDenominator),
    successes: validRuns.length,
  };
}

function qualityScore(metrics: DungeonMetrics): number {
  return round(
    metrics.criticalPathLength * 2
    + metrics.cycleRank * 4
    + metrics.deadEndCount
    + metrics.optionalContentRatio * 10
    + metrics.bossNormalizedDepth * 8
    - metrics.routeStretch.mean
    - metrics.corridorLength.mean * 0.05
    - (metrics.archetypeRepetitions + metrics.biomeRepetitions) * 0.1,
  );
}

function failureCounts(runs: readonly CandidateRun[]): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const run of runs) {
    if (run.errorCode) counts[run.errorCode] = (counts[run.errorCode] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) =>
    left.localeCompare(right)));
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function percentile(values: readonly number[], quantile: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return round(sorted[Math.ceil((sorted.length - 1) * quantile)]);
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : round(numerator / denominator);
}

function divideNullable(
  numerator: number | null,
  denominator: number | null,
): number | null {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return round(numerator / denominator);
}

function subtractNullable(left: number | null, right: number | null): number | null {
  if (left === null || right === null) return null;
  return round(left - right);
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function parseArguments(args: readonly string[]): Readonly<{
  candidates: number;
  count: number;
  output: string | null;
  scenario: string | null;
}> {
  const value = (name: string): string | undefined => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const candidates = Number(value("--candidates") ?? 4);
  const count = Number(value("--count") ?? 3);
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new Error("--count must be an integer between 1 and 100");
  }
  if (!Number.isInteger(candidates) || candidates < 2 || candidates > 16) {
    throw new Error("--candidates must be an integer between 2 and 16");
  }
  return {
    candidates,
    count,
    output: value("--output") ?? null,
    scenario: value("--scenario") ?? null,
  };
}
