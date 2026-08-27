import { useCallback } from "react";
import {
  decodeGameSave,
  encodeGameSave,
  GAME_SAVE_SCHEMA_VERSION,
} from "../persistence/gameSave";
import useGameStore, { type PersistedGameState } from "../store/gameStore";
import useMapStore from "../store/mapStore";

const SAVE_KEY = "ghostDungeonSave";

export const useSaveSystem = () => {
  const saveGame = useCallback(() => {
    try {
      const game = useGameStore.getState();
      const map = useMapStore.getState();
      if (!map.currentDungeon || !map.dungeonRunState) {
        throw new Error("Cannot save before a canonical dungeon is loaded");
      }
      const persistedGameState: PersistedGameState = {
        completedRooms: game.completedRooms,
        currentFloor: game.currentFloor,
        currentRoomId: map.dungeonRunState.currentRoomId,
        discoveredSecrets: game.discoveredSecrets,
        gamePhase: game.gamePhase,
        inventory: game.inventory,
        playerStats: game.playerStats,
        totalScore: game.totalScore,
      };
      localStorage.setItem(
        SAVE_KEY,
        encodeGameSave(
          map.currentDungeon,
          map.dungeonRunState,
          persistedGameState,
          Date.now(),
        ),
      );
      return true;
    } catch (error) {
      console.error("Failed to save game:", error);
      return false;
    }
  }, []);

  const loadGame = useCallback(() => {
    try {
      const serialized = localStorage.getItem(SAVE_KEY);
      if (!serialized) return false;
      const save = decodeGameSave(serialized);
      useMapStore.getState().restoreDungeon(save.dungeon, save.dungeonRunState);
      useGameStore.getState().restoreGameState(save.gameState);
      return true;
    } catch (error) {
      console.error("Failed to load game:", error);
      return false;
    }
  }, []);

  const hasSaveData = useCallback(() => localStorage.getItem(SAVE_KEY) !== null, []);

  const deleteSave = useCallback(() => {
    try {
      localStorage.removeItem(SAVE_KEY);
      return true;
    } catch (error) {
      console.error("Failed to delete save:", error);
      return false;
    }
  }, []);

  const getSaveInfo = useCallback(() => {
    try {
      const serialized = localStorage.getItem(SAVE_KEY);
      if (!serialized) return null;
      const save = decodeGameSave(serialized);
      return {
        floor: save.gameState.currentFloor,
        level: save.gameState.playerStats.level,
        score: save.gameState.totalScore,
        seed: save.dungeon.replay.seed,
        timestamp: save.timestamp,
        version: GAME_SAVE_SCHEMA_VERSION,
      };
    } catch (error) {
      console.error("Failed to inspect save:", error);
      return null;
    }
  }, []);

  return {
    deleteSave,
    getSaveInfo,
    hasSaveData,
    loadGame,
    saveGame,
  };
};
