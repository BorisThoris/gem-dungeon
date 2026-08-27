import { create } from "zustand";
import { canonicalDungeonToGameMap } from "../adapters/canonicalMapAdapter";
import { legacyMapConfigToGenerationConfig } from "../adapters/legacyGenerationConfig";
import { generateDungeon } from "../dungeon-core/generator";
import {
  createDungeonRunState,
  enterDungeonRoom,
  openDungeonConnection,
} from "../dungeon-core/model";
import { assertDungeonRunState } from "../dungeon-core/run-state-serialization";
import { validateDungeon } from "../dungeon-core/validation";
import type { Dungeon, DungeonRunState } from "../dungeon-core/types";
import type { GameMap, MapActions, MapConfig, MapState } from "../types/map";
import { playerRoomDetection } from "../utils/playerRoomDetection";

const defaultConfig: MapConfig = {
  connectionChance: 0.4,
  height: 56,
  maxRooms: 22,
  minRooms: 16,
  roomSize: 4,
  specialRoomChance: 0.35,
  width: 56,
};

let runtimeGenerationSequence = 0;

const useMapStore = create<MapState & MapActions>((set, get) => ({
  currentDungeon: null,
  currentMap: null,
  currentRoomId: null,
  dungeonRunState: null,
  error: null,
  generationDiagnostics: null,
  isGenerating: false,
  visitedRooms: new Set(),

  generateMap: (config = {}, enabledBiomeCategories, requestedSeed) => {
    set({ error: null, isGenerating: true });
    try {
      const legacyConfig = { ...defaultConfig, ...config };
      const generationConfig = legacyMapConfigToGenerationConfig(
        legacyConfig,
        enabledBiomeCategories,
      );
      const seed = requestedSeed ?? `runtime-map-${runtimeGenerationSequence}`;
      runtimeGenerationSequence += 1;
      const result = generateDungeon({
        config: generationConfig,
        now: () => globalThis.performance.now(),
        seed,
      });
      if (!result.ok) {
        throw new Error(`${result.error.code}: ${result.error.message}`);
      }
      const runState = createDungeonRunState(result.dungeon);
      const map = canonicalDungeonToGameMap(result.dungeon, runState, {
        generatedAt: Date.now(),
      });
      playerRoomDetection.initializeDungeon(result.dungeon);
      set({
        currentDungeon: result.dungeon,
        currentMap: { ...map, config: legacyConfig },
        currentRoomId: result.dungeon.startRoomId,
        dungeonRunState: runState,
        error: null,
        generationDiagnostics: result.diagnostics,
        isGenerating: false,
        visitedRooms: new Set([result.dungeon.startRoomId]),
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to generate map",
        isGenerating: false,
      });
    }
  },

  restoreDungeon: (dungeon, requestedRunState) => {
    const report = validateDungeon(dungeon);
    if (!report.valid) {
      throw new Error(
        `Cannot restore invalid dungeon: ${report.issues
          .filter((issue) => issue.severity === "error")
          .map((issue) => issue.code)
          .join(", ")}`,
      );
    }
    const runState = requestedRunState ?? createDungeonRunState(dungeon);
    assertDungeonRunState(dungeon, runState);
    const map = canonicalDungeonToGameMap(dungeon, runState, { generatedAt: Date.now() });
    playerRoomDetection.initializeDungeon(dungeon);
    set({
      currentDungeon: dungeon,
      currentMap: map,
      currentRoomId: runState.currentRoomId,
      dungeonRunState: runState,
      error: null,
      generationDiagnostics: null,
      isGenerating: false,
      visitedRooms: new Set(runState.visitedRoomIds),
    });
  },

  openConnection: (connectionId) => {
    const { currentDungeon, dungeonRunState } = get();
    if (!currentDungeon || !dungeonRunState) return;
    try {
      const nextRunState = openDungeonConnection(
        currentDungeon,
        dungeonRunState,
        connectionId,
      );
      set({ dungeonRunState: nextRunState });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to open connection" });
    }
  },

  setCurrentRoom: (roomId) => {
    const { currentDungeon, currentMap, dungeonRunState } = get();
    if (!currentDungeon || !dungeonRunState) {
      if (currentMap?.rooms.some((room) => room.id === roomId)) {
        set({ currentRoomId: roomId });
      }
      return;
    }
    if (!currentDungeon.rooms.some((room) => room.id === roomId)) return;
    const nextRunState = enterDungeonRoom(currentDungeon, dungeonRunState, roomId);
    set({
      currentMap: currentMap
        ? updateLegacyRoomFlags(currentMap, roomId, nextRunState.visitedRoomIds)
        : null,
      currentRoomId: roomId,
      dungeonRunState: nextRunState,
      visitedRooms: new Set(nextRunState.visitedRoomIds),
    });
  },

  markRoomVisited: (roomId) => {
    const { currentDungeon, currentMap, dungeonRunState, visitedRooms } = get();
    if (currentDungeon && !currentDungeon.rooms.some((room) => room.id === roomId)) return;
    const nextVisited = new Set(visitedRooms);
    nextVisited.add(roomId);
    const nextRunState = dungeonRunState
      ? { ...dungeonRunState, visitedRoomIds: new Set([...dungeonRunState.visitedRoomIds, roomId]) }
      : null;
    set({
      currentMap: currentMap
        ? updateLegacyRoomFlags(currentMap, get().currentRoomId, nextVisited)
        : null,
      dungeonRunState: nextRunState,
      visitedRooms: nextVisited,
    });
  },

  clearMap: () => {
    playerRoomDetection.clearDungeon();
    set({
      currentDungeon: null,
      currentMap: null,
      currentRoomId: null,
      dungeonRunState: null,
      error: null,
      generationDiagnostics: null,
      isGenerating: false,
      visitedRooms: new Set(),
    });
  },

  setError: (error) => set({ error }),
}));

function updateLegacyRoomFlags(
  map: GameMap,
  currentRoomId: string | null,
  visitedRoomIds: ReadonlySet<string>,
): GameMap {
  return {
    ...map,
    rooms: map.rooms.map((room) => ({
      ...room,
      isCurrent: room.id === currentRoomId,
      isVisited: visitedRoomIds.has(room.id),
    })),
  };
}

export default useMapStore;
