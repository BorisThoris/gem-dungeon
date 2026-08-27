export {
  DEFAULT_GENERATION_CONFIG,
  deepFreeze,
  normalizeSeed,
  resolveGenerationConfig,
} from "./config";
export { generateDungeon } from "./generator";
export { indexFreeSpace, type FreeSpaceIndex } from "./free-space";
export {
  cellKey,
  compareGridCells,
  hashString,
  hashValue,
  stableStringify,
} from "./identity";
export {
  canTraverseDungeonConnection,
  createDungeonRunState,
  enterDungeonRoom,
  freezeDungeon,
  getDungeonConnection,
  getDungeonRoom,
  getRoomConnections,
  getRoomSocket,
  openDungeonConnection,
} from "./model";
export { computeDungeonMetrics, type DungeonMetricsInput } from "./metrics";
export { OccupancyGrid, type OccupancyRecord, type ReservationResult } from "./occupancy";
export { placeMissionRooms, type PlacementGeneration } from "./placement";
export {
  RNG_STREAM_NAMES,
  createRng,
  createRngStreams,
  type Rng,
  type RngStreamName,
  type RngStreams,
} from "./rng";
export {
  DUNGEON_RUN_STATE_SCHEMA_VERSION,
  assertDungeonRunState,
  decodeDungeonRunState,
  dungeonRunStateFromDocument,
  encodeDungeonRunState,
  toDungeonRunStateDocument,
  type DungeonRunStateDocument,
} from "./run-state-serialization";
export {
  routeAStar,
  routeDungeonConnections,
  type RoutingGeneration,
} from "./routing";
export { directDungeonSemantics } from "./semantics";
export {
  DungeonSerializationError,
  SUPPORTED_DUNGEON_SCHEMA_VERSIONS,
  decodeDungeon,
  encodeDungeon,
  migrateDungeonDocument,
} from "./serialization";
export {
  createDungeonSpatialIndex,
  detectDungeonRoom,
  gridCellToWorld,
  isGridCellInBounds,
  worldToGridCell,
  type DungeonSpatialIndex,
  type DungeonSpatialSource,
  type WorldPosition,
} from "./spatial";
export {
  DEFAULT_ROOM_TEMPLATES,
  ROOM_SHAPE_FOOTPRINTS,
  boundsForCells,
  createRoomTemplate,
  getTemplateSetVersion,
  placeTemplate,
  transformLocalCell,
  transformVector,
  validateTemplateSet,
} from "./templates";
export { generateMissionGraph, type TopologyGeneration } from "./topology";
export { validateDungeon, type DungeonValidationInput } from "./validation";
export * from "./types";
