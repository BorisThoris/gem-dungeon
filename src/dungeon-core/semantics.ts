import { deepFreeze } from "./config";
import type { Rng, RngStreams } from "./rng";
import type {
  ConnectionKind,
  DungeonSemantics,
  GenerationConfig,
  GenerationTraceEvent,
  MissionEdge,
  MissionGraph,
  MissionNode,
  ProgressionGrant,
  RoomArchetype,
  SemanticEdgeAssignment,
  SemanticRoomAssignment,
  StageResult,
  TraversalRule,
} from "./types";

interface MutableRoomAssignment {
  archetype: RoomArchetype;
  biome: string;
  grants: { flags: string[]; items: string[] };
  nodeId: string;
  tags: string[];
}

export function directDungeonSemantics(
  graph: MissionGraph,
  config: GenerationConfig,
  streams: RngStreams,
): StageResult<DungeonSemantics> {
  const rng = streams.stream("semantics");
  const portalRng = streams.stream("portals");
  const trace: GenerationTraceEvent[] = [];
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const neighbors = neighborMap(graph);
  const maximumDepth = Math.max(...graph.nodes.map((node) => node.progressionDepth), 1);
  const assignments = new Map<string, MutableRoomAssignment>();

  for (const node of [...graph.nodes].sort(compareMissionNodes)) {
    const context = {
      degree: neighbors.get(node.id)?.length ?? 0,
      deadEnd: (neighbors.get(node.id)?.length ?? 0) === 1,
      normalizedDepth: node.progressionDepth / maximumDepth,
    };
    const archetype = archetypeForNode(node, context, rng);
    assignments.set(node.id, {
      archetype,
      biome: biomeForDepth(context.normalizedDepth, config.semantics.biomes),
      grants: { flags: [], items: [] },
      nodeId: node.id,
      tags: semanticTags(node, context),
    });
  }

  assignShops(assignments, graph, config, rng, trace);
  assignRestStops(assignments, graph, config, trace);
  assignRewardChallenges(assignments, graph, neighbors, rng, trace);

  const baseEdges = [...graph.edges].sort(compareMissionEdges);
  const edgeRules = new Map<string, TraversalRule>(
    baseEdges.map((edge) => [edge.id, openTraversal()]),
  );

  const lockResult = assignKeyLocks(
    baseEdges,
    nodeById,
    assignments,
    edgeRules,
    config.progression.keyLockPairs,
    rng,
    trace,
  );
  if (!lockResult.ok) {
    return { ...lockResult, trace: [...trace, ...lockResult.trace] };
  }

  const bossAssignment = assignments.get(graph.bossNodeId)!;
  bossAssignment.grants.flags.push("boss-cleared");
  const bossEndEdge = baseEdges.find(
    (edge) =>
      (edge.from === graph.bossNodeId && edge.to === graph.endNodeId)
      || (edge.to === graph.bossNodeId && edge.from === graph.endNodeId),
  );
  if (!bossEndEdge) {
    return semanticsFailure(
      "SEMANTICS_MISSING_BOSS_END_EDGE",
      "Mission topology must directly connect the boss to the end",
      {},
      trace,
    );
  }
  edgeRules.set(bossEndEdge.id, {
    direction: "bidirectional",
    lockedByDefault: true,
    requiredAction: "defeat-boss",
    requiredFlags: ["boss-cleared"],
    requiredItems: [],
  });

  const secretIds = chooseEdgeIds(
    baseEdges.filter((edge) => edge.kind === "optional"),
    config.progression.secretRoutes,
    rng,
  );
  const breakableIds = chooseEdgeIds(
    baseEdges.filter(
      (edge) => edge.kind === "optional" && !secretIds.has(edge.id),
    ),
    config.progression.breakableRoutes,
    rng,
  );
  const shortcutIds = chooseEdgeIds(
    baseEdges.filter((edge) => edge.kind === "loop"),
    config.progression.shortcuts,
    rng,
  );

  protectParallelPaths(baseEdges, nodeById, edgeRules, trace);

  if (secretIds.size < config.progression.secretRoutes) {
    return semanticsFailure(
      "SEMANTICS_SECRET_TARGET_INFEASIBLE",
      "Not enough optional edges are available for the requested secret routes",
      { available: secretIds.size, requested: config.progression.secretRoutes },
      trace,
    );
  }
  if (breakableIds.size < config.progression.breakableRoutes) {
    return semanticsFailure(
      "SEMANTICS_BREAKABLE_TARGET_INFEASIBLE",
      "Not enough optional edges are available for the requested breakable routes",
      { available: breakableIds.size, requested: config.progression.breakableRoutes },
      trace,
    );
  }
  if (shortcutIds.size < config.progression.shortcuts) {
    return semanticsFailure(
      "SEMANTICS_SHORTCUT_TARGET_INFEASIBLE",
      "Not enough loop edges are available for the requested shortcuts",
      { available: shortcutIds.size, requested: config.progression.shortcuts },
      trace,
    );
  }

  for (const edgeId of secretIds) {
    edgeRules.set(edgeId, {
      ...edgeRules.get(edgeId)!,
      requiredAction: "discover-secret",
    });
  }
  for (const edgeId of breakableIds) {
    edgeRules.set(edgeId, {
      ...edgeRules.get(edgeId)!,
      requiredAction: "break-barrier",
    });
  }

  const portalResult = insertSafePortals(
    graph,
    config.progression.portals,
    portalRng,
    trace,
  );
  if (!portalResult.ok) {
    return portalResult;
  }
  const directedGraph = portalResult.value;

  const directedAssignments: SemanticEdgeAssignment[] = directedGraph.edges.map((edge) => {
    const portal = edge.kind === "portal";
    const secret = secretIds.has(edge.id);
    const breakable = breakableIds.has(edge.id);
    return {
      edgeId: edge.id,
      kind: edgeConnectionKind(edge, secret, breakable),
      secret,
      shortcut: shortcutIds.has(edge.id),
      traversal: portal ? openTraversal() : edgeRules.get(edge.id) ?? openTraversal(),
    };
  });
  const edgeAssignments = propagateProgressionRegionRequirements(
    directedGraph,
    directedAssignments,
    nodeById,
    trace,
  );

  const rooms: SemanticRoomAssignment[] = [...assignments.values()]
    .sort((left, right) => left.nodeId.localeCompare(right.nodeId))
    .map((assignment) => ({
      archetype: assignment.archetype,
      biome: assignment.biome,
      grants: normalizeGrant(assignment.grants),
      nodeId: assignment.nodeId,
      tags: [...new Set(assignment.tags)].sort(),
    }));

  trace.push({
    attempt: 0,
    code: "SEMANTICS_COMPLETE",
    message: `Assigned ${rooms.length} rooms, ${lockResult.value} key/lock pairs, and ${config.progression.portals} portals`,
    stage: "semantics",
  });
  return {
    ok: true,
    trace,
    value: deepFreeze({
      edges: edgeAssignments.sort((left, right) => left.edgeId.localeCompare(right.edgeId)),
      graph: directedGraph,
      rooms,
    }),
  };
}

function propagateProgressionRegionRequirements(
  graph: MissionGraph,
  edgeAssignments: readonly SemanticEdgeAssignment[],
  nodeById: ReadonlyMap<string, MissionNode>,
  trace: GenerationTraceEvent[],
): SemanticEdgeAssignment[] {
  const edgeById = new Map(graph.edges.map((edge) => [edge.id, edge]));
  const assignmentByEdge = new Map(
    edgeAssignments.map((assignment) => [assignment.edgeId, assignment]),
  );
  const gates = graph.edges
    .filter((edge) => edge.mandatory)
    .map((edge) => {
      const traversal = assignmentByEdge.get(edge.id)?.traversal;
      return {
        depth: Math.max(
          nodeById.get(edge.from)?.progressionDepth ?? 0,
          nodeById.get(edge.to)?.progressionDepth ?? 0,
        ),
        requiredFlags: traversal?.requiredFlags ?? [],
        requiredItems: traversal?.requiredItems ?? [],
      };
    })
    .filter((gate) => gate.requiredFlags.length > 0 || gate.requiredItems.length > 0);
  let propagated = 0;
  const result = edgeAssignments.map((assignment) => {
    const edge = edgeById.get(assignment.edgeId);
    if (!edge) return assignment;
    const minimumDepth = Math.min(
      nodeById.get(edge.from)?.progressionDepth ?? 0,
      nodeById.get(edge.to)?.progressionDepth ?? 0,
    );
    const inherited = gates.filter((gate) => gate.depth <= minimumDepth);
    if (inherited.length === 0) return assignment;
    const requiredFlags = [...new Set([
      ...assignment.traversal.requiredFlags,
      ...inherited.flatMap((gate) => gate.requiredFlags),
    ])].sort();
    const requiredItems = [...new Set([
      ...assignment.traversal.requiredItems,
      ...inherited.flatMap((gate) => gate.requiredItems),
    ])].sort();
    if (
      requiredFlags.length === assignment.traversal.requiredFlags.length
      && requiredItems.length === assignment.traversal.requiredItems.length
    ) return assignment;
    propagated += 1;
    return {
      ...assignment,
      traversal: {
        ...assignment.traversal,
        lockedByDefault: true,
        requiredFlags,
        requiredItems,
      },
    };
  });
  trace.push({
    attempt: 0,
    code: "SEMANTICS_PROGRESS_REGION_GUARDS",
    message: `Propagated mandatory gate requirements to ${propagated} downstream connections`,
    stage: "semantics",
  });
  return result;
}

function archetypeForNode(
  node: MissionNode,
  context: Readonly<{ deadEnd: boolean; degree: number; normalizedDepth: number }>,
  rng: Rng,
): RoomArchetype {
  switch (node.role) {
    case "start":
      return "start";
    case "end":
      return "end";
    case "boss":
      return "boss";
    case "boss-approach":
      return "boss-approach";
    case "gate":
      return "gate";
    case "reward-leaf":
      return "treasure";
    case "hub":
      return "normal";
    case "optional":
      return rng.weightedPick([
        { value: "challenge", weight: context.deadEnd ? 3 : 1.5 },
        { value: "enemy", weight: 2 + context.normalizedDepth },
        { value: "puzzle", weight: node.branchDepth >= 2 ? 2.5 : 1.25 },
        { value: "secret", weight: context.deadEnd ? 1.5 : 0.5 },
      ]);
    case "critical":
      return rng.weightedPick([
        { value: "normal", weight: 2 },
        { value: "enemy", weight: 2 + context.normalizedDepth * 2 },
        { value: "challenge", weight: context.degree > 2 ? 0.5 : 1.25 },
        { value: "puzzle", weight: 0.75 },
      ]);
  }
}

function assignShops(
  assignments: Map<string, MutableRoomAssignment>,
  graph: MissionGraph,
  config: GenerationConfig,
  rng: Rng,
  trace: GenerationTraceEvent[],
): void {
  const target = rng.int(config.semantics.shopCount.min, config.semantics.shopCount.max);
  const maximumDepth = Math.max(...graph.nodes.map((node) => node.progressionDepth), 1);
  const eligible = [...graph.nodes]
    .filter(
      (node) =>
        node.role === "hub"
        || (node.role === "critical"
          && node.progressionDepth > 1
          && node.progressionDepth < maximumDepth - 2),
    )
    .sort(
      (left, right) =>
        Math.abs(left.progressionDepth / maximumDepth - 0.5)
          - Math.abs(right.progressionDepth / maximumDepth - 0.5)
        || left.id.localeCompare(right.id),
    );
  for (const node of eligible.slice(0, target)) {
    const assignment = assignments.get(node.id)!;
    assignment.archetype = "shop";
    assignment.tags.push("junction-service");
  }
  trace.push({
    attempt: 0,
    candidateCount: eligible.length,
    code: "SEMANTICS_ASSIGN_SHOPS",
    message: `Assigned ${Math.min(target, eligible.length)} context-aware shops`,
    stage: "semantics",
  });
}

function assignRestStops(
  assignments: Map<string, MutableRoomAssignment>,
  graph: MissionGraph,
  config: GenerationConfig,
  trace: GenerationTraceEvent[],
): void {
  const critical = graph.nodes
    .filter((node) => node.criticalPathIndex !== null)
    .sort(
      (left, right) =>
        (left.criticalPathIndex ?? 0) - (right.criticalPathIndex ?? 0),
    );
  let lastRest = -Infinity;
  for (let index = 1; index < critical.length - 3; index += 1) {
    const node = critical[index];
    const assignment = assignments.get(node.id)!;
    const preBossWindow = index === critical.length - 4;
    if (
      assignment.archetype !== "shop"
      && (preBossWindow || index - lastRest >= config.semantics.restSpacing + 2)
    ) {
      assignment.archetype = "rest";
      assignment.tags.push(preBossWindow ? "pre-boss-rest" : "recovery-window");
      lastRest = index;
    }
  }
  trace.push({
    attempt: 0,
    code: "SEMANTICS_ASSIGN_REST",
    message: "Placed rest rooms using critical-path spacing and pre-boss context",
    stage: "semantics",
  });
}

function assignRewardChallenges(
  assignments: Map<string, MutableRoomAssignment>,
  graph: MissionGraph,
  neighbors: ReadonlyMap<string, readonly string[]>,
  rng: Rng,
  trace: GenerationTraceEvent[],
): void {
  for (const reward of graph.nodes.filter((node) => node.role === "reward-leaf")) {
    const parent = (neighbors.get(reward.id) ?? [])
      .map((id) => graph.nodes.find((node) => node.id === id)!)
      .filter((node) => node.branchDepth < reward.branchDepth)
      .sort((left, right) => right.branchDepth - left.branchDepth)[0];
    if (!parent) continue;
    const assignment = assignments.get(parent.id)!;
    if (["normal", "enemy", "secret"].includes(assignment.archetype)) {
      assignment.archetype = rng.chance(0.5) ? "challenge" : "puzzle";
      assignment.tags.push("guards-reward");
    }
  }
  trace.push({
    attempt: 0,
    code: "SEMANTICS_GUARD_REWARDS",
    message: "Assigned challenge or puzzle context before reward leaves",
    stage: "semantics",
  });
}

function assignKeyLocks(
  edges: readonly MissionEdge[],
  nodeById: ReadonlyMap<string, MissionNode>,
  assignments: Map<string, MutableRoomAssignment>,
  edgeRules: Map<string, TraversalRule>,
  requested: number,
  rng: Rng,
  trace: GenerationTraceEvent[],
): StageResult<number> {
  if (requested === 0) {
    return { ok: true, trace: [], value: 0 };
  }
  const candidates = edges
    .filter((edge) => edge.mandatory && edge.kind !== "vertical")
    .map((edge) => {
      const from = nodeById.get(edge.from)!;
      const to = nodeById.get(edge.to)!;
      return from.progressionDepth <= to.progressionDepth
        ? { edge, from, to }
        : { edge, from: to, to: from };
    })
    .filter(
      ({ from, to }) =>
        from.role !== "start"
        && to.role !== "boss"
        && to.role !== "end"
        && to.progressionDepth >= 2,
    )
    .sort(
      (left, right) =>
        (left.to.role === "gate" ? -1 : 0) - (right.to.role === "gate" ? -1 : 0)
        || left.to.progressionDepth - right.to.progressionDepth
        || left.edge.id.localeCompare(right.edge.id),
    );
  if (candidates.length < requested) {
    return semanticsFailure(
      "SEMANTICS_KEY_LOCK_TARGET_INFEASIBLE",
      "Not enough mandatory non-vertical edges can host requested key/lock pairs",
      { available: candidates.length, requested },
      [],
    );
  }

  const chosen = chooseDistributed(candidates, requested, rng).sort(
    (left, right) => left.to.progressionDepth - right.to.progressionDepth,
  );
  for (let index = 0; index < chosen.length; index += 1) {
    const { edge, from, to } = chosen[index];
    const key = `key-${String(index + 1).padStart(2, "0")}`;
    assignments.get(from.id)!.grants.items.push(key);
    assignments.get(from.id)!.tags.push("progression-key");
    edgeRules.set(edge.id, {
      direction: "bidirectional",
      lockedByDefault: true,
      requiredAction: "unlock",
      requiredFlags: [],
      requiredItems: [key],
    });
    trace.push({
      attempt: 0,
      code: "SEMANTICS_KEY_BEFORE_LOCK",
      message: `Placed ${key} in ${from.id} before lock ${edge.id} entering ${to.id}`,
      stage: "semantics",
    });
  }
  return { ok: true, trace: [], value: chosen.length };
}

function insertSafePortals(
  graph: MissionGraph,
  requested: number,
  rng: Rng,
  trace: GenerationTraceEvent[],
): StageResult<MissionGraph> {
  if (requested === 0) {
    return { ok: true, trace, value: graph };
  }
  const existing = new Set(
    graph.edges.map((edge) => pairKey(edge.from, edge.to)),
  );
  const candidates: Array<readonly [MissionNode, MissionNode]> = [];
  const optional = graph.nodes.filter(
    (node) => !node.mandatory && node.role !== "hub",
  );
  for (let leftIndex = 0; leftIndex < optional.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < optional.length; rightIndex += 1) {
      const left = optional[leftIndex];
      const right = optional[rightIndex];
      if (
        left.progressionDepth === right.progressionDepth
        && !existing.has(pairKey(left.id, right.id))
      ) {
        candidates.push([left, right]);
      }
    }
  }
  if (candidates.length < requested) {
    return semanticsFailure(
      "SEMANTICS_PORTAL_TARGET_INFEASIBLE",
      "Not enough same-progression-segment endpoint pairs exist for safe portals",
      { available: candidates.length, requested },
      trace,
    );
  }

  const selected: Array<readonly [MissionNode, MissionNode]> = [];
  for (const pair of rng.shuffle(candidates)) {
    if (selected.length >= requested) break;
    if (
      selected.some(
        ([left, right]) =>
          left.id === pair[0].id
          || left.id === pair[1].id
          || right.id === pair[0].id
          || right.id === pair[1].id,
      )
    ) {
      continue;
    }
    selected.push(pair);
  }
  if (selected.length < requested) {
    return semanticsFailure(
      "SEMANTICS_PORTAL_SOCKET_PRESSURE",
      "Safe portal endpoints cannot be kept distinct for the requested portal count",
      { availableDistinctPairs: selected.length, requested },
      trace,
    );
  }

  const portalEdges: MissionEdge[] = selected.map(([from, to], index) => ({
    from: from.id,
    id: `edge-portal-${String(index).padStart(3, "0")}`,
    kind: "portal",
    mandatory: false,
    to: to.id,
  }));
  trace.push({
    attempt: 0,
    candidateCount: candidates.length,
    code: "SEMANTICS_INSERT_SAFE_PORTALS",
    message: `Inserted ${portalEdges.length} portals within progression segments`,
    stage: "semantics",
  });
  return {
    ok: true,
    trace,
    value: deepFreeze({
      ...graph,
      edges: [...graph.edges, ...portalEdges].sort(compareMissionEdges),
    }),
  };
}

function protectParallelPaths(
  edges: readonly MissionEdge[],
  nodeById: ReadonlyMap<string, MissionNode>,
  edgeRules: Map<string, TraversalRule>,
  trace: GenerationTraceEvent[],
): void {
  const lockedMandatoryEdges = edges
    .filter((edge) => edge.mandatory)
    .map((edge) => ({
      depth: Math.max(
        nodeById.get(edge.from)?.progressionDepth ?? 0,
        nodeById.get(edge.to)?.progressionDepth ?? 0,
      ),
      rule: edgeRules.get(edge.id) ?? openTraversal(),
    }))
    .filter(
      ({ rule }) => rule.requiredItems.length > 0 || rule.requiredFlags.length > 0,
    );
  for (const edge of edges.filter((candidate) => candidate.kind === "loop")) {
    const depths = [
      nodeById.get(edge.from)?.progressionDepth ?? 0,
      nodeById.get(edge.to)?.progressionDepth ?? 0,
    ];
    const minimum = Math.min(...depths);
    const maximum = Math.max(...depths);
    const crossed = lockedMandatoryEdges.filter(
      (gate) => gate.depth > minimum && gate.depth <= maximum,
    );
    if (crossed.length === 0) continue;
    const requiredItems = [...new Set(crossed.flatMap((gate) => gate.rule.requiredItems))].sort();
    const requiredFlags = [...new Set(crossed.flatMap((gate) => gate.rule.requiredFlags))].sort();
    edgeRules.set(edge.id, {
      direction: "bidirectional",
      lockedByDefault: true,
      requiredAction: "unlock-shortcut",
      requiredFlags,
      requiredItems,
    });
    trace.push({
      attempt: 0,
      code: "SEMANTICS_PROTECT_SHORTCUT",
      message: `${edge.id} inherits requirements for ${crossed.length} crossed mandatory gate(s)`,
      stage: "semantics",
    });
  }
}

function edgeConnectionKind(
  edge: MissionEdge,
  secret: boolean,
  breakable: boolean,
): ConnectionKind {
  if (edge.kind === "vertical") return "stairs";
  if (edge.kind === "portal") return "portal";
  if (secret) return "secret";
  if (breakable) return "breakable";
  return "corridor";
}

function chooseEdgeIds(
  edges: readonly MissionEdge[],
  requested: number,
  rng: Rng,
): Set<string> {
  return new Set(rng.shuffle(edges).slice(0, requested).map((edge) => edge.id));
}

function chooseDistributed<T extends Readonly<{ to: MissionNode }>>(
  values: readonly T[],
  count: number,
  rng: Rng,
): T[] {
  if (count >= values.length) return [...values];
  const buckets: T[][] = Array.from({ length: count }, () => []);
  values.forEach((value, index) => {
    buckets[Math.min(count - 1, Math.floor((index * count) / values.length))].push(value);
  });
  return buckets.map((bucket) => rng.pick(bucket));
}

function biomeForDepth(normalizedDepth: number, biomes: readonly string[]): string {
  return biomes[Math.min(biomes.length - 1, Math.floor(normalizedDepth * biomes.length))];
}

function semanticTags(
  node: MissionNode,
  context: Readonly<{ deadEnd: boolean; degree: number; normalizedDepth: number }>,
): string[] {
  const tags = [node.mandatory ? "mandatory" : "optional", `role:${node.role}`];
  if (context.deadEnd) tags.push("dead-end");
  if (context.degree >= 3) tags.push("junction");
  if (context.normalizedDepth < 0.25) tags.push("early");
  else if (context.normalizedDepth > 0.75) tags.push("late");
  else tags.push("mid");
  return tags;
}

function normalizeGrant(grant: Readonly<{ flags: string[]; items: string[] }>): ProgressionGrant {
  return {
    flags: [...new Set(grant.flags)].sort(),
    items: [...new Set(grant.items)].sort(),
  };
}

function openTraversal(): TraversalRule {
  return {
    direction: "bidirectional",
    lockedByDefault: false,
    requiredAction: null,
    requiredFlags: [],
    requiredItems: [],
  };
}

function neighborMap(graph: MissionGraph): Map<string, string[]> {
  const result = new Map(graph.nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of graph.edges) {
    result.get(edge.from)!.push(edge.to);
    result.get(edge.to)!.push(edge.from);
  }
  for (const values of result.values()) values.sort();
  return result;
}

function pairKey(left: string, right: string): string {
  return left < right ? `${left}:${right}` : `${right}:${left}`;
}

function compareMissionNodes(left: MissionNode, right: MissionNode): number {
  return left.progressionDepth - right.progressionDepth || left.id.localeCompare(right.id);
}

function compareMissionEdges(left: MissionEdge, right: MissionEdge): number {
  return left.id.localeCompare(right.id);
}

function semanticsFailure(
  code: string,
  message: string,
  details: Readonly<Record<string, unknown>>,
  trace: readonly GenerationTraceEvent[],
): StageResult<never> {
  return {
    error: { code, details, message, stage: "semantics" },
    ok: false,
    trace,
  };
}
