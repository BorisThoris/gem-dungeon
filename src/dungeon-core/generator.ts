import {
  DEFAULT_GENERATION_CONFIG,
  deepFreeze,
  normalizeSeed,
  resolveGenerationConfig,
} from "./config";
import { hashValue } from "./identity";
import { computeDungeonMetrics } from "./metrics";
import { freezeDungeon } from "./model";
import { placeMissionRooms } from "./placement";
import { createRngStreams } from "./rng";
import { routeDungeonConnections } from "./routing";
import { directDungeonSemantics } from "./semantics";
import { DEFAULT_ROOM_TEMPLATES, getTemplateSetVersion, validateTemplateSet } from "./templates";
import { generateMissionGraph } from "./topology";
import {
  DUNGEON_GENERATOR_VERSION,
  DUNGEON_SCHEMA_VERSION,
  type Dungeon,
  type GenerationDiagnostics,
  type GenerationError,
  type GenerationResult,
  type GenerationSpec,
  type GenerationTraceEvent,
} from "./types";
import { validateDungeon } from "./validation";

interface MutableDiagnostics {
  backtracks: number;
  configHash: string;
  placementAttempts: number;
  placementCandidates: number;
  routingAttempts: number;
  routingExpandedNodes: number;
  seed: string;
  templateSetVersion: string;
  topologyRetries: number;
  trace: GenerationTraceEvent[];
  validationFailures: string[];
}

export function generateDungeon(spec: GenerationSpec): GenerationResult {
  const startedAt = spec.now?.() ?? 0;
  const mutable = emptyDiagnostics();
  let config = DEFAULT_GENERATION_CONFIG;
  let templates = DEFAULT_ROOM_TEMPLATES;

  try {
    mutable.seed = normalizeSeed(spec.seed);
    config = resolveGenerationConfig(spec.config);
    templates = validateTemplateSet(spec.templates ?? DEFAULT_ROOM_TEMPLATES);
    mutable.configHash = hashValue(config);
    mutable.templateSetVersion = getTemplateSetVersion(templates);
    mutable.trace.push({
      attempt: 0,
      code: "CONFIG_RESOLVED",
      message: "Validated and froze the authoritative generation snapshot",
      stage: "config",
    });
  } catch (cause) {
    return generationFailure(
      {
        code: "GENERATION_CONFIG_INVALID",
        details: { cause: errorMessage(cause) },
        message: errorMessage(cause),
        stage: "config",
      },
      mutable,
      elapsed(spec, startedAt),
    );
  }

  const streams = createRngStreams(mutable.seed);
  const topology = generateMissionGraph(config, streams);
  mutable.trace.push(...topology.trace);
  if (!topology.ok) {
    return generationFailure(topology.error, mutable, elapsed(spec, startedAt));
  }
  mutable.topologyRetries = topology.value.retries;

  const semantics = directDungeonSemantics(topology.value.graph, config, streams);
  mutable.trace.push(...semantics.trace);
  if (!semantics.ok) {
    return generationFailure(semantics.error, mutable, elapsed(spec, startedAt));
  }

  let lastError: GenerationError = {
    code: "GENERATION_ATTEMPTS_EXHAUSTED",
    details: {},
    message: "No placement/routing attempt completed",
    stage: "placement",
  };
  for (
    let placementAttempt = 0;
    placementAttempt < config.placement.maxRetries;
    placementAttempt += 1
  ) {
    const placement = placeMissionRooms(
      semantics.value,
      config,
      templates,
      streams,
      placementAttempt,
    );
    mutable.trace.push(...placement.trace);
    if (!placement.ok) {
      lastError = placement.error;
      continue;
    }
    mutable.backtracks += placement.value.backtracks;
    mutable.placementAttempts += placement.value.placementAttempts;
    mutable.placementCandidates += placement.value.candidateEvaluations;

    for (
      let routingRetry = 0;
      routingRetry < config.routing.maxRetries;
      routingRetry += 1
    ) {
      const routingAttempt = placementAttempt * config.routing.maxRetries + routingRetry;
      const routing = routeDungeonConnections(
        semantics.value,
        placement.value.rooms,
        config,
        streams,
        routingAttempt,
      );
      mutable.trace.push(...routing.trace);
      if (!routing.ok) {
        lastError = routing.error;
        continue;
      }
      mutable.routingAttempts += routing.value.routingAttempts;
      mutable.routingExpandedNodes += routing.value.expandedNodes;

      const roomByNode = new Map(
        placement.value.rooms.map((room) => [room.topologyNodeId, room.id]),
      );
      const candidate = {
        bossRoomId: roomByNode.get(semantics.value.graph.bossNodeId)!,
        config,
        connections: routing.value.connections,
        endRoomId: roomByNode.get(semantics.value.graph.endNodeId)!,
        floors: config.world.floors,
        rooms: placement.value.rooms,
        startRoomId: roomByNode.get(semantics.value.graph.startNodeId)!,
      };
      const report = validateDungeon(candidate);
      mutable.trace.push({
        attempt: routingAttempt,
        code: report.valid ? "VALIDATION_COMPLETE" : "VALIDATION_REJECTED",
        message: report.valid
          ? "Canonical structural, physical, and progression invariants passed"
          : `Validation rejected ${report.issues.length} invariant violation(s)`,
        stage: "validation",
      });
      if (!report.valid) {
        mutable.validationFailures.push(
          ...report.issues
            .filter((issue) => issue.severity === "error")
            .map((issue) => `${issue.code}:${issue.connectionId ?? issue.roomId ?? "dungeon"}`),
        );
        lastError = {
          code: "GENERATION_VALIDATION_FAILED",
          details: { issues: report.issues },
          message: "Generated candidate failed canonical validation",
          stage: "validation",
        };
        break;
      }

      const metrics = computeDungeonMetrics(candidate);
      mutable.trace.push({
        attempt: routingAttempt,
        code: "METRICS_COMPLETE",
        message: `Measured topology ${metrics.topologyHash} and spatial layout ${metrics.spatialHash}`,
        stage: "metrics",
      });
      const dungeon: Dungeon = freezeDungeon({
        ...candidate,
        metrics,
        replay: {
          configHash: mutable.configHash,
          generatorVersion: DUNGEON_GENERATOR_VERSION,
          seed: mutable.seed,
          spatialHash: metrics.spatialHash,
          templateSetVersion: mutable.templateSetVersion,
          topologyHash: metrics.topologyHash,
        },
        schemaVersion: DUNGEON_SCHEMA_VERSION,
      });
      return {
        diagnostics: freezeDiagnostics(mutable, elapsed(spec, startedAt)),
        dungeon,
        ok: true,
      };
    }
  }

  return generationFailure(
    {
      code: "GENERATION_ATTEMPTS_EXHAUSTED",
      details: {
        lastError,
        placementRetries: config.placement.maxRetries,
        routingRetries: config.routing.maxRetries,
      },
      message: `Generation retries were exhausted; last failure: ${lastError.message}`,
      stage: lastError.stage,
    },
    mutable,
    elapsed(spec, startedAt),
  );
}

function emptyDiagnostics(): MutableDiagnostics {
  return {
    backtracks: 0,
    configHash: "",
    placementAttempts: 0,
    placementCandidates: 0,
    routingAttempts: 0,
    routingExpandedNodes: 0,
    seed: "",
    templateSetVersion: "",
    topologyRetries: 0,
    trace: [],
    validationFailures: [],
  };
}

function freezeDiagnostics(
  diagnostics: MutableDiagnostics,
  durationMs: number,
): GenerationDiagnostics {
  return deepFreeze({
    ...diagnostics,
    durationMs,
    trace: [...diagnostics.trace],
    validationFailures: [...diagnostics.validationFailures],
  });
}

function generationFailure(
  error: GenerationError,
  diagnostics: MutableDiagnostics,
  durationMs: number,
): GenerationResult {
  return {
    diagnostics: freezeDiagnostics(diagnostics, durationMs),
    error: deepFreeze(error),
    ok: false,
  };
}

function elapsed(spec: GenerationSpec, startedAt: number): number {
  if (!spec.now) return 0;
  return Math.max(0, Math.round((spec.now() - startedAt) * 1_000) / 1_000);
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
