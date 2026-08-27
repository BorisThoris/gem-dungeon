export const DUNGEON_SCHEMA_VERSION = "2.0.0" as const;
export const DUNGEON_GENERATOR_VERSION = "epic-1.0.0" as const;

export type DungeonSchemaVersion = typeof DUNGEON_SCHEMA_VERSION;
export type Seed = string | number;
export type Rotation = 0 | 90 | 180 | 270;

export interface GridCell {
  readonly floor: number;
  readonly x: number;
  readonly z: number;
}

export interface LocalCell {
  readonly x: number;
  readonly z: number;
}

export interface GridVector {
  readonly x: -1 | 0 | 1;
  readonly y: -1 | 0 | 1;
  readonly z: -1 | 0 | 1;
}

export interface GridBounds {
  readonly maxFloor: number;
  readonly maxX: number;
  readonly maxZ: number;
  readonly minFloor: number;
  readonly minX: number;
  readonly minZ: number;
}

export interface Footprint {
  readonly bounds: GridBounds;
  readonly cells: readonly GridCell[];
  readonly clearance: readonly GridCell[];
}

export type RoomShape =
  | "square"
  | "line"
  | "block"
  | "L"
  | "T"
  | "plus"
  | "U"
  | "C"
  | "H";

export type MissionRole =
  | "start"
  | "critical"
  | "optional"
  | "reward-leaf"
  | "hub"
  | "gate"
  | "boss-approach"
  | "boss"
  | "end";

export type RoomArchetype =
  | "start"
  | "normal"
  | "enemy"
  | "challenge"
  | "puzzle"
  | "treasure"
  | "shop"
  | "rest"
  | "secret"
  | "gate"
  | "boss-approach"
  | "boss"
  | "end";

export type ConnectionKind =
  | "door"
  | "corridor"
  | "secret"
  | "breakable"
  | "portal"
  | "stairs"
  | "elevator"
  | "drop"
  | "ladder";

export type TraversalDirection = "bidirectional" | "from-to" | "to-from";

export interface SocketAperture {
  readonly height: number;
  readonly width: number;
}

export interface TemplateSocket {
  readonly allowedConnectionKinds: readonly ConnectionKind[];
  readonly aperture: SocketAperture;
  readonly cell: LocalCell;
  readonly compatibility: readonly string[];
  readonly id: string;
  readonly normal: GridVector;
  readonly shareable?: boolean;
}

export interface RoomTemplate {
  readonly allowedArchetypes: readonly RoomArchetype[];
  readonly allowedRotations: readonly Rotation[];
  readonly clearance: readonly LocalCell[];
  readonly footprint: readonly LocalCell[];
  readonly id: string;
  readonly name: string;
  readonly shape: RoomShape;
  readonly sockets: readonly TemplateSocket[];
  readonly version: number;
}

export interface Socket {
  readonly allowedConnectionKinds: readonly ConnectionKind[];
  readonly aperture: SocketAperture;
  readonly cell: GridCell;
  readonly compatibility: readonly string[];
  readonly exteriorCell: GridCell;
  readonly id: string;
  readonly normal: GridVector;
  readonly roomId: string;
  readonly shareable: boolean;
  readonly templateSocketId: string;
}

export interface RoomTransform {
  readonly origin: GridCell;
  readonly rotation: Rotation;
}

export interface ProgressionGrant {
  readonly flags: readonly string[];
  readonly items: readonly string[];
}

export interface DungeonRoom {
  readonly archetype: RoomArchetype;
  readonly biome: string;
  readonly branchDepth: number;
  readonly criticalPathIndex: number | null;
  readonly footprint: Footprint;
  readonly grants: ProgressionGrant;
  readonly id: string;
  readonly mandatory: boolean;
  readonly progressionDepth: number;
  readonly role: MissionRole;
  readonly shape: RoomShape;
  readonly sockets: readonly Socket[];
  readonly tags: readonly string[];
  readonly templateId: string;
  readonly topologyNodeId: string;
  readonly transform: RoomTransform;
}

export interface ConnectionEndpoint {
  readonly roomId: string;
  readonly socketId: string;
}

export interface TraversalRule {
  readonly direction: TraversalDirection;
  readonly lockedByDefault: boolean;
  readonly requiredAction: string | null;
  readonly requiredFlags: readonly string[];
  readonly requiredItems: readonly string[];
}

export interface CorridorRoute {
  readonly cells: readonly GridCell[];
  readonly cost: number;
  readonly intersections: number;
  readonly turns: number;
  readonly waypoints: readonly GridCell[];
}

export interface VerticalRoute {
  readonly from: GridCell;
  readonly to: GridCell;
}

export interface DungeonConnection {
  readonly corridor: CorridorRoute | null;
  readonly from: ConnectionEndpoint;
  readonly id: string;
  readonly kind: ConnectionKind;
  readonly mandatory: boolean;
  readonly secret: boolean;
  readonly shortcut: boolean;
  readonly to: ConnectionEndpoint;
  readonly topologyEdgeId: string;
  readonly traversal: TraversalRule;
  readonly vertical: VerticalRoute | null;
}

export interface MissionNode {
  readonly branchDepth: number;
  readonly criticalPathIndex: number | null;
  readonly desiredFloor: number;
  readonly id: string;
  readonly mandatory: boolean;
  readonly progressionDepth: number;
  readonly role: MissionRole;
}

export type MissionEdgeKind =
  | "mandatory"
  | "optional"
  | "loop"
  | "secret"
  | "shortcut"
  | "portal"
  | "vertical";

export interface MissionEdge {
  readonly from: string;
  readonly id: string;
  readonly kind: MissionEdgeKind;
  readonly mandatory: boolean;
  readonly to: string;
}

export interface MissionGraph {
  readonly bossNodeId: string;
  readonly edges: readonly MissionEdge[];
  readonly endNodeId: string;
  readonly nodes: readonly MissionNode[];
  readonly startNodeId: string;
}

export interface WorldGenerationConfig {
  readonly cellSize: number;
  readonly depth: number;
  readonly floorHeight: number;
  readonly floors: number;
  readonly width: number;
}

export interface TopologyGenerationConfig {
  readonly branchBudget: number;
  readonly criticalPathLength: Readonly<{ max: number; min: number }>;
  readonly deadEndCount: Readonly<{ max: number; min: number }>;
  readonly hubCount: Readonly<{ max: number; min: number }>;
  readonly hubChance: number;
  readonly loopCount: Readonly<{ max: number; min: number }>;
  readonly maxBranchDepth: number;
  readonly optionalContentRatio: number;
  readonly totalRooms: Readonly<{ max: number; min: number }>;
}

export interface SemanticsGenerationConfig {
  readonly biomes: readonly string[];
  readonly challengeSpacing: number;
  readonly rewardSpacing: number;
  readonly restSpacing: number;
  readonly shopCount: Readonly<{ max: number; min: number }>;
}

export interface PlacementGenerationConfig {
  readonly candidateLimitPerRoom: number;
  readonly maxBacktracks: number;
  readonly maxRetries: number;
  readonly roomGap: Readonly<{ max: number; min: number }>;
}

export interface RoutingGenerationConfig {
  readonly existingCorridorCost: number;
  readonly heuristicWeight: number;
  readonly intersectionCost: number;
  readonly maxExpandedNodes: number;
  readonly maxRetries: number;
  readonly proximityCost: number;
  readonly stepCost: number;
  readonly turnCost: number;
}

export interface ProgressionGenerationConfig {
  readonly breakableRoutes: number;
  readonly keyLockPairs: number;
  readonly portals: number;
  readonly secretRoutes: number;
  readonly shortcuts: number;
}

export interface QualityGenerationConfig {
  readonly maxCorridorLength: number;
  readonly maxCorridorTurns: number;
  readonly minimumBossDepth: number;
}

export interface GenerationConfig {
  readonly placement: PlacementGenerationConfig;
  readonly progression: ProgressionGenerationConfig;
  readonly quality: QualityGenerationConfig;
  readonly routing: RoutingGenerationConfig;
  readonly semantics: SemanticsGenerationConfig;
  readonly topology: TopologyGenerationConfig;
  readonly world: WorldGenerationConfig;
}

export interface GenerationConfigInput {
  readonly placement?: Partial<PlacementGenerationConfig> & {
    readonly roomGap?: Partial<PlacementGenerationConfig["roomGap"]>;
  };
  readonly progression?: Partial<ProgressionGenerationConfig>;
  readonly quality?: Partial<QualityGenerationConfig>;
  readonly routing?: Partial<RoutingGenerationConfig>;
  readonly semantics?: Partial<SemanticsGenerationConfig> & {
    readonly shopCount?: Partial<SemanticsGenerationConfig["shopCount"]>;
  };
  readonly topology?: Partial<TopologyGenerationConfig> & {
    readonly criticalPathLength?: Partial<TopologyGenerationConfig["criticalPathLength"]>;
    readonly deadEndCount?: Partial<TopologyGenerationConfig["deadEndCount"]>;
    readonly hubCount?: Partial<TopologyGenerationConfig["hubCount"]>;
    readonly loopCount?: Partial<TopologyGenerationConfig["loopCount"]>;
    readonly totalRooms?: Partial<TopologyGenerationConfig["totalRooms"]>;
  };
  readonly world?: Partial<WorldGenerationConfig>;
}

export interface DungeonReplayIdentity {
  readonly configHash: string;
  readonly generatorVersion: string;
  readonly seed: string;
  readonly spatialHash: string;
  readonly templateSetVersion: string;
  readonly topologyHash: string;
}

export interface DungeonMetrics {
  readonly archetypeSpacing: Readonly<
    Record<"rest" | "reward" | "shop", readonly number[]>
  >;
  readonly archetypeRepetitions: number;
  readonly articulationPoints: readonly string[];
  readonly bossNormalizedDepth: number;
  readonly biomeRepetitions: number;
  readonly biomeTransitions: number;
  readonly branchDepths: readonly number[];
  readonly bridgeEdges: readonly string[];
  readonly corridorIntersections: number;
  readonly corridorLength: Readonly<{ max: number; mean: number; total: number }>;
  readonly corridorTurns: number;
  readonly compactness: number;
  readonly componentCount: number;
  readonly criticalPathLength: number;
  readonly cycleRank: number;
  readonly deadEndCount: number;
  readonly degreeHistogram: Readonly<Record<string, number>>;
  readonly edgeCount: number;
  readonly footprintArea: Readonly<{ max: number; mean: number; min: number }>;
  readonly graphDiameter: number;
  readonly keyLockDistances: readonly number[];
  readonly maxBranchDepth: number;
  readonly nodeCount: number;
  readonly optionalContentRatio: number;
  readonly routeStretch: Readonly<{ max: number; mean: number }>;
  readonly reachableFromStart: number;
  readonly spatialHash: string;
  readonly startToEndDistance: number;
  readonly topologyHash: string;
  readonly transitions: number;
  readonly utilization: number;
}

export interface Dungeon {
  readonly bossRoomId: string;
  readonly config: GenerationConfig;
  readonly connections: readonly DungeonConnection[];
  readonly endRoomId: string;
  readonly floors: number;
  readonly metrics: DungeonMetrics;
  readonly replay: DungeonReplayIdentity;
  readonly rooms: readonly DungeonRoom[];
  readonly schemaVersion: DungeonSchemaVersion;
  readonly startRoomId: string;
}

export interface DungeonRunState {
  readonly completedRoomIds: ReadonlySet<string>;
  readonly currentFloor: number;
  readonly currentRoomId: string;
  readonly flags: ReadonlySet<string>;
  readonly inventory: ReadonlySet<string>;
  readonly openedConnectionIds: ReadonlySet<string>;
  readonly visitedRoomIds: ReadonlySet<string>;
}

export type GenerationStage =
  | "config"
  | "topology"
  | "semantics"
  | "placement"
  | "routing"
  | "validation"
  | "metrics"
  | "serialization";

export interface GenerationTraceEvent {
  readonly attempt: number;
  readonly candidateCount?: number;
  readonly code: string;
  readonly message: string;
  readonly stage: GenerationStage;
}

export interface GenerationDiagnostics {
  readonly backtracks: number;
  readonly configHash: string;
  readonly durationMs: number;
  readonly placementAttempts: number;
  readonly placementCandidates: number;
  readonly routingAttempts: number;
  readonly routingExpandedNodes: number;
  readonly seed: string;
  readonly templateSetVersion: string;
  readonly topologyRetries: number;
  readonly trace: readonly GenerationTraceEvent[];
  readonly validationFailures: readonly string[];
}

export interface GenerationError {
  readonly code: string;
  readonly details: Readonly<Record<string, unknown>>;
  readonly message: string;
  readonly stage: GenerationStage;
}

export interface GenerationSuccess {
  readonly diagnostics: GenerationDiagnostics;
  readonly dungeon: Dungeon;
  readonly ok: true;
}

export interface GenerationFailure {
  readonly diagnostics: GenerationDiagnostics;
  readonly error: GenerationError;
  readonly ok: false;
}

export type GenerationResult = GenerationSuccess | GenerationFailure;

export interface GenerationSpec {
  readonly config?: GenerationConfigInput;
  readonly now?: () => number;
  readonly seed: Seed;
  readonly templates?: readonly RoomTemplate[];
}

export interface ValidationIssue {
  readonly code: string;
  readonly connectionId?: string;
  readonly message: string;
  readonly roomId?: string;
  readonly severity: "error" | "warning";
}

export interface ValidationReport {
  readonly issues: readonly ValidationIssue[];
  readonly physicallyTraversable: boolean;
  readonly progressionSolvable: boolean;
  readonly valid: boolean;
}

export interface SemanticRoomAssignment {
  readonly archetype: RoomArchetype;
  readonly biome: string;
  readonly grants: ProgressionGrant;
  readonly nodeId: string;
  readonly tags: readonly string[];
}

export interface SemanticEdgeAssignment {
  readonly edgeId: string;
  readonly kind: ConnectionKind;
  readonly secret: boolean;
  readonly shortcut: boolean;
  readonly traversal: TraversalRule;
}

export interface DungeonSemantics {
  readonly edges: readonly SemanticEdgeAssignment[];
  readonly graph: MissionGraph;
  readonly rooms: readonly SemanticRoomAssignment[];
}

export interface StageSuccess<T> {
  readonly ok: true;
  readonly trace: readonly GenerationTraceEvent[];
  readonly value: T;
}

export interface StageFailure {
  readonly error: GenerationError;
  readonly ok: false;
  readonly trace: readonly GenerationTraceEvent[];
}

export type StageResult<T> = StageSuccess<T> | StageFailure;
