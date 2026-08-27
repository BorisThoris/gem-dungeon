import { deepFreeze } from "./config";
import type { Rng, RngStreams } from "./rng";
import type {
  GenerationConfig,
  GenerationError,
  GenerationTraceEvent,
  MissionEdge,
  MissionEdgeKind,
  MissionGraph,
  MissionNode,
  MissionRole,
  StageResult,
} from "./types";

const MAX_TOPOLOGY_ATTEMPTS = 32;

interface MutableMissionDraft {
  edgeSequence: number;
  edges: MissionEdge[];
  nodeSequence: number;
  nodes: MissionNode[];
  trace: GenerationTraceEvent[];
}

export interface TopologyGeneration {
  readonly graph: MissionGraph;
  readonly retries: number;
}

export function generateMissionGraph(
  config: GenerationConfig,
  streams: RngStreams,
): StageResult<TopologyGeneration> {
  const failures: string[] = [];
  const combinedTrace: GenerationTraceEvent[] = [];

  for (let attempt = 0; attempt < MAX_TOPOLOGY_ATTEMPTS; attempt += 1) {
    const rng = streams.stream(`topology:attempt-${attempt}`);
    const result = buildMissionGraph(config, rng, attempt);
    combinedTrace.push(...result.trace);
    if (result.ok) {
      return {
        ok: true,
        trace: combinedTrace,
        value: { graph: result.value, retries: attempt },
      };
    }
    failures.push(result.error.message);
  }

  return failure(
    "TOPOLOGY_ATTEMPTS_EXHAUSTED",
    `Unable to satisfy topology constraints after ${MAX_TOPOLOGY_ATTEMPTS} attempts`,
    { failures },
    combinedTrace,
  );
}

function buildMissionGraph(
  config: GenerationConfig,
  rng: Rng,
  attempt: number,
): StageResult<MissionGraph> {
  const draft: MutableMissionDraft = {
    edgeSequence: 0,
    edges: [],
    nodeSequence: 0,
    nodes: [],
    trace: [],
  };

  const criticalCount = rng.int(
    config.topology.criticalPathLength.min,
    config.topology.criticalPathLength.max,
  );
  const totalMinimum = Math.max(config.topology.totalRooms.min, criticalCount);
  if (totalMinimum > config.topology.totalRooms.max) {
    return topologyFailure(
      "TOPOLOGY_ROOM_RANGE_INFEASIBLE",
      "Critical-path target does not fit the total-room range",
      { criticalCount, totalMinimum },
      draft.trace,
    );
  }

  const ratioTarget = Math.round(
    criticalCount / Math.max(0.01, 1 - config.topology.optionalContentRatio),
  );
  const totalCount = clamp(
    ratioTarget + rng.int(-1, 1),
    totalMinimum,
    config.topology.totalRooms.max,
  );
  const optionalCount = totalCount - criticalCount;

  insertCriticalPath(draft, criticalCount, config.world.floors, attempt);
  addGate(draft);
  addBossApproach(draft);

  const feasibleHubMaximum = Math.min(
    config.topology.hubCount.max,
    Math.floor(optionalCount / 3),
    config.topology.branchBudget,
  );
  if (config.topology.hubCount.min > feasibleHubMaximum) {
    return topologyFailure(
      "TOPOLOGY_HUB_TARGET_INFEASIBLE",
      "Room and branch budgets cannot satisfy the minimum hub count",
      { feasibleHubMaximum, optionalCount },
      draft.trace,
    );
  }

  let hubTarget = config.topology.hubCount.min;
  while (
    hubTarget < feasibleHubMaximum
    && rng.chance(config.topology.hubChance)
  ) {
    hubTarget += 1;
  }

  const feasibleDeadEndMinimum = 2 + hubTarget * 2;
  const feasibleDeadEndMaximum = 2 + Math.max(0, optionalCount - hubTarget);
  const deadEndMinimum = Math.max(
    config.topology.deadEndCount.min,
    feasibleDeadEndMinimum,
  );
  const deadEndMaximum = Math.min(
    config.topology.deadEndCount.max,
    feasibleDeadEndMaximum,
  );
  if (deadEndMinimum > deadEndMaximum) {
    return topologyFailure(
      "TOPOLOGY_DEAD_END_TARGET_INFEASIBLE",
      "Room and hub targets cannot satisfy the configured dead-end range",
      { deadEndMaximum, deadEndMinimum, optionalCount },
      draft.trace,
    );
  }
  const deadEndTarget = rng.int(deadEndMinimum, deadEndMaximum);
  const optionalLeafTarget = deadEndTarget - 2;

  const criticalAnchors = rng.shuffle(
    draft.nodes.filter(
      (node) =>
        node.criticalPathIndex !== null
        && node.role !== "start"
        && node.role !== "boss"
        && node.role !== "end",
    ),
  );
  if (optionalCount > 0 && criticalAnchors.length === 0) {
    return topologyFailure(
      "TOPOLOGY_NO_BRANCH_ANCHOR",
      "No legal critical-path node can anchor optional content",
      {},
      draft.trace,
    );
  }

  let remaining = optionalCount;
  let branchRoots = 0;
  const leaves: string[] = [];
  const hubs: string[] = [];

  for (let index = 0; index < hubTarget; index += 1) {
    const anchor = criticalAnchors[index % criticalAnchors.length];
    const hub = addHub(draft, anchor, attempt);
    const firstLeaf = addRewardDeadEnd(draft, hub, attempt);
    const secondLeaf = addRewardDeadEnd(draft, hub, attempt);
    hubs.push(hub.id);
    leaves.push(firstLeaf.id, secondLeaf.id);
    branchRoots += 1;
    remaining -= 3;
  }

  while (leaves.length < optionalLeafTarget && remaining > 0) {
    if (branchRoots >= config.topology.branchBudget) {
      return topologyFailure(
        "TOPOLOGY_BRANCH_BUDGET_EXHAUSTED",
        "Branch budget cannot satisfy the configured dead-end range",
        { branchRoots, optionalLeafTarget },
        draft.trace,
      );
    }
    const anchor = rng.pick(criticalAnchors);
    const leaf = addOptionalBranch(draft, anchor, "reward-leaf", attempt);
    leaves.push(leaf.id);
    branchRoots += 1;
    remaining -= 1;
  }

  while (remaining > 0) {
    const extendableLeaves = leaves
      .map((id) => getNode(draft, id))
      .filter((node) => node.branchDepth < config.topology.maxBranchDepth);
    if (extendableLeaves.length > 0) {
      const parent = rng.pick(extendableLeaves);
      replaceRole(draft, parent.id, "optional");
      const child = addRewardDeadEnd(draft, parent, attempt);
      leaves.splice(leaves.indexOf(parent.id), 1, child.id);
      remaining -= 1;
      continue;
    }

    if (branchRoots < config.topology.branchBudget) {
      const anchor = rng.pick(criticalAnchors);
      const leaf = addOptionalBranch(draft, anchor, "reward-leaf", attempt);
      leaves.push(leaf.id);
      branchRoots += 1;
      remaining -= 1;
      continue;
    }

    const expandableHubs = hubs
      .map((id) => getNode(draft, id))
      .filter((node) => node.branchDepth < config.topology.maxBranchDepth);
    if (expandableHubs.length > 0) {
      const leaf = addRewardDeadEnd(draft, rng.pick(expandableHubs), attempt);
      leaves.push(leaf.id);
      remaining -= 1;
      continue;
    }

    return topologyFailure(
      "TOPOLOGY_BRANCH_DEPTH_EXHAUSTED",
      "Optional rooms do not fit within branch-count and branch-depth budgets",
      { remaining },
      draft.trace,
    );
  }

  const loopTarget = rng.int(
    config.topology.loopCount.min,
    config.topology.loopCount.max,
  );
  for (let loopIndex = 0; loopIndex < loopTarget; loopIndex += 1) {
    if (!addParallelPath(draft, rng, attempt)) {
      return topologyFailure(
        "TOPOLOGY_LOOP_TARGET_INFEASIBLE",
        "Could not add the requested number of non-duplicate parallel paths",
        { loopIndex, loopTarget },
        draft.trace,
      );
    }
  }

  const start = draft.nodes.find((node) => node.role === "start")!;
  const boss = draft.nodes.find((node) => node.role === "boss")!;
  const end = draft.nodes.find((node) => node.role === "end")!;
  const graph: MissionGraph = deepFreeze({
    bossNodeId: boss.id,
    edges: [...draft.edges].sort(compareEdges),
    endNodeId: end.id,
    nodes: [...draft.nodes].sort(compareNodes),
    startNodeId: start.id,
  });
  const validationError = validateMissionGraph(graph, config, criticalCount);
  if (validationError) {
    return topologyFailure(
      validationError.code,
      validationError.message,
      validationError.details,
      draft.trace,
    );
  }

  draft.trace.push({
    attempt,
    code: "TOPOLOGY_COMPLETE",
    message: `Built ${graph.nodes.length} rooms with ${loopTarget} loops`,
    stage: "topology",
  });
  return { ok: true, trace: draft.trace, value: graph };
}

function insertCriticalPath(
  draft: MutableMissionDraft,
  count: number,
  floors: number,
  attempt: number,
): void {
  let previous: MissionNode | null = null;
  for (let index = 0; index < count; index += 1) {
    const role: MissionRole =
      index === 0
        ? "start"
        : index === count - 1
          ? "end"
          : index === count - 2
            ? "boss"
            : "critical";
    const node = addNode(draft, {
      branchDepth: 0,
      criticalPathIndex: index,
      desiredFloor:
        floors === 1 ? 0 : Math.round((index * (floors - 1)) / (count - 1)),
      mandatory: true,
      progressionDepth: index,
      role,
    });
    if (previous) {
      addEdge(
        draft,
        previous,
        node,
        previous.desiredFloor === node.desiredFloor ? "mandatory" : "vertical",
        true,
      );
    }
    previous = node;
  }
  draft.trace.push({
    attempt,
    code: "RULE_INSERT_CRITICAL_PATH",
    message: `Inserted ${count}-room critical path`,
    stage: "topology",
  });
}

function addGate(draft: MutableMissionDraft): void {
  const critical = criticalNodes(draft);
  const upperExclusive = Math.max(2, critical.length - 3);
  const gateIndex = clamp(Math.floor((critical.length - 1) * 0.55), 1, upperExclusive - 1);
  replaceRole(draft, critical[gateIndex].id, "gate");
}

function addBossApproach(draft: MutableMissionDraft): void {
  const critical = criticalNodes(draft);
  replaceRole(draft, critical[critical.length - 3].id, "boss-approach");
}

function addOptionalBranch(
  draft: MutableMissionDraft,
  parent: MissionNode,
  role: MissionRole,
  attempt: number,
): MissionNode {
  const node = addNode(draft, {
    branchDepth: parent.branchDepth + 1,
    criticalPathIndex: null,
    desiredFloor: parent.desiredFloor,
    mandatory: false,
    progressionDepth: parent.progressionDepth,
    role,
  });
  addEdge(draft, parent, node, "optional", false);
  draft.trace.push({
    attempt,
    code: "RULE_ADD_OPTIONAL_BRANCH",
    message: `Attached ${node.id} to ${parent.id}`,
    stage: "topology",
  });
  return node;
}

function addRewardDeadEnd(
  draft: MutableMissionDraft,
  parent: MissionNode,
  attempt: number,
): MissionNode {
  const node = addOptionalBranch(draft, parent, "reward-leaf", attempt);
  draft.trace.push({
    attempt,
    code: "RULE_ADD_REWARD_DEAD_END",
    message: `Marked ${node.id} as a reward dead end`,
    stage: "topology",
  });
  return node;
}

function addHub(
  draft: MutableMissionDraft,
  parent: MissionNode,
  attempt: number,
): MissionNode {
  const node = addOptionalBranch(draft, parent, "hub", attempt);
  draft.trace.push({
    attempt,
    code: "RULE_ADD_HUB",
    message: `Inserted hub ${node.id}`,
    stage: "topology",
  });
  return node;
}

function addParallelPath(
  draft: MutableMissionDraft,
  rng: Rng,
  attempt: number,
): boolean {
  const candidates: Array<readonly [MissionNode, MissionNode]> = [];
  const nodes = draft.nodes.filter(
    (node) => node.role !== "start" && node.role !== "end" && node.role !== "reward-leaf",
  );
  for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
      const left = nodes[leftIndex];
      const right = nodes[rightIndex];
      if (
        left.desiredFloor === right.desiredFloor
        && left.id !== right.id
        && !hasEdge(draft, left.id, right.id)
        && Math.abs(left.progressionDepth - right.progressionDepth) <= 3
      ) {
        candidates.push([left, right]);
      }
    }
  }
  if (candidates.length === 0) {
    return false;
  }
  const [from, to] = rng.pick(candidates);
  addEdge(draft, from, to, "loop", false);
  draft.trace.push({
    attempt,
    candidateCount: candidates.length,
    code: "RULE_ADD_PARALLEL_PATH",
    message: `Added loop between ${from.id} and ${to.id}`,
    stage: "topology",
  });
  return true;
}

function addNode(
  draft: MutableMissionDraft,
  node: Omit<MissionNode, "id">,
): MissionNode {
  const created: MissionNode = {
    ...node,
    id: `node-${String(draft.nodeSequence).padStart(3, "0")}`,
  };
  draft.nodeSequence += 1;
  draft.nodes.push(created);
  return created;
}

function addEdge(
  draft: MutableMissionDraft,
  from: MissionNode,
  to: MissionNode,
  kind: MissionEdgeKind,
  mandatory: boolean,
): MissionEdge {
  if (from.id === to.id || hasEdge(draft, from.id, to.id)) {
    throw new Error(`Invalid duplicate/self mission edge ${from.id} -> ${to.id}`);
  }
  const edge: MissionEdge = {
    from: from.id,
    id: `edge-${String(draft.edgeSequence).padStart(3, "0")}`,
    kind,
    mandatory,
    to: to.id,
  };
  draft.edgeSequence += 1;
  draft.edges.push(edge);
  return edge;
}

function replaceRole(draft: MutableMissionDraft, id: string, role: MissionRole): void {
  const index = draft.nodes.findIndex((node) => node.id === id);
  if (index < 0) {
    throw new Error(`Cannot replace role for missing node ${id}`);
  }
  draft.nodes[index] = { ...draft.nodes[index], role };
}

function getNode(draft: MutableMissionDraft, id: string): MissionNode {
  const node = draft.nodes.find((candidate) => candidate.id === id);
  if (!node) {
    throw new Error(`Missing mission node ${id}`);
  }
  return node;
}

function criticalNodes(draft: MutableMissionDraft): MissionNode[] {
  return draft.nodes
    .filter((node) => node.criticalPathIndex !== null)
    .sort(
      (left, right) =>
        (left.criticalPathIndex ?? 0) - (right.criticalPathIndex ?? 0),
    );
}

function hasEdge(draft: MutableMissionDraft, left: string, right: string): boolean {
  return draft.edges.some(
    (edge) =>
      (edge.from === left && edge.to === right)
      || (edge.from === right && edge.to === left),
  );
}

function validateMissionGraph(
  graph: MissionGraph,
  config: GenerationConfig,
  criticalCount: number,
): GenerationError | null {
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const edgeIds = new Set(graph.edges.map((edge) => edge.id));
  if (nodeIds.size !== graph.nodes.length || edgeIds.size !== graph.edges.length) {
    return topologyError("TOPOLOGY_DUPLICATE_ID", "Mission graph IDs must be unique", {});
  }
  if (
    !nodeIds.has(graph.startNodeId)
    || !nodeIds.has(graph.bossNodeId)
    || !nodeIds.has(graph.endNodeId)
  ) {
    return topologyError(
      "TOPOLOGY_DANGLING_SPECIAL_NODE",
      "Start, boss, and end IDs must reference graph nodes",
      {},
    );
  }
  if (
    graph.nodes.filter((node) => node.role === "start").length !== 1
    || graph.nodes.filter((node) => node.role === "boss").length !== 1
    || graph.nodes.filter((node) => node.role === "end").length !== 1
  ) {
    return topologyError(
      "TOPOLOGY_SPECIAL_ROLE_COUNT",
      "Mission graph must contain exactly one start, boss, and end role",
      {},
    );
  }
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to) || edge.from === edge.to) {
      return topologyError(
        "TOPOLOGY_DANGLING_EDGE",
        `Mission edge ${edge.id} has invalid endpoints`,
        { edge },
      );
    }
  }

  const reachable = traverse(graph, graph.startNodeId);
  if (reachable.size !== graph.nodes.length) {
    return topologyError(
      "TOPOLOGY_DISCONNECTED",
      "Mission graph must be connected before spatial placement",
      { reachable: reachable.size, total: graph.nodes.length },
    );
  }
  const cycleRank = graph.edges.length - graph.nodes.length + 1;
  if (cycleRank < config.topology.loopCount.min || cycleRank > config.topology.loopCount.max) {
    return topologyError(
      "TOPOLOGY_LOOP_RANGE",
      "Mission graph cycle rank is outside the configured loop range",
      { cycleRank },
    );
  }
  const degree = degreeMap(graph);
  const deadEnds = [...degree.values()].filter((value) => value === 1).length;
  if (
    deadEnds < config.topology.deadEndCount.min
    || deadEnds > config.topology.deadEndCount.max
  ) {
    return topologyError(
      "TOPOLOGY_DEAD_END_RANGE",
      "Mission graph dead-end count is outside the configured range",
      { deadEnds },
    );
  }
  const hubs = graph.nodes.filter((node) => node.role === "hub").length;
  if (hubs < config.topology.hubCount.min || hubs > config.topology.hubCount.max) {
    return topologyError(
      "TOPOLOGY_HUB_RANGE",
      "Mission graph hub count is outside the configured range",
      { hubs },
    );
  }
  const boss = graph.nodes.find((node) => node.id === graph.bossNodeId)!;
  const bossDepth = (boss.criticalPathIndex ?? 0) / Math.max(1, criticalCount - 1);
  if (bossDepth < config.quality.minimumBossDepth) {
    return topologyError(
      "TOPOLOGY_BOSS_DEPTH",
      "Boss is shallower than the configured minimum normalized depth",
      { bossDepth },
    );
  }
  if (graph.nodes.some((node) => node.branchDepth > config.topology.maxBranchDepth)) {
    return topologyError(
      "TOPOLOGY_BRANCH_DEPTH",
      "A mission branch exceeds the configured maximum depth",
      {},
    );
  }
  return null;
}

function traverse(graph: MissionGraph, startId: string): Set<string> {
  const visited = new Set([startId]);
  const queue = [startId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of graph.edges) {
      const neighbor = edge.from === current ? edge.to : edge.to === current ? edge.from : null;
      if (neighbor && !visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return visited;
}

function degreeMap(graph: MissionGraph): Map<string, number> {
  const degree = new Map(graph.nodes.map((node) => [node.id, 0]));
  for (const edge of graph.edges) {
    degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
  }
  return degree;
}

function topologyFailure(
  code: string,
  message: string,
  details: Readonly<Record<string, unknown>>,
  trace: readonly GenerationTraceEvent[],
): StageResult<never> {
  return { error: topologyError(code, message, details), ok: false, trace };
}

function failure(
  code: string,
  message: string,
  details: Readonly<Record<string, unknown>>,
  trace: readonly GenerationTraceEvent[],
): StageResult<never> {
  return {
    error: { code, details, message, stage: "topology" },
    ok: false,
    trace,
  };
}

function topologyError(
  code: string,
  message: string,
  details: Readonly<Record<string, unknown>>,
): GenerationError {
  return { code, details, message, stage: "topology" };
}

function compareNodes(left: MissionNode, right: MissionNode): number {
  return left.id.localeCompare(right.id);
}

function compareEdges(left: MissionEdge, right: MissionEdge): number {
  return left.id.localeCompare(right.id);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
