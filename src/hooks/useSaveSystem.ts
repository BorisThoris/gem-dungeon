import { useCallback } from 'react';
import useGameStore from '../store/gameStore';
import useMapStore from '../store/mapStore';

export const useSaveSystem = () => {
  const gameState = useGameStore();
  const mapState = useMapStore();

  const saveGame = useCallback(() => {
    const saveData = {
      gameState: {
        playerStats: gameState.playerStats,
        inventory: gameState.inventory,
        currentRoomId: gameState.currentRoomId,
        discoveredSecrets: gameState.discoveredSecrets,
        completedRooms: gameState.completedRooms,
        currentFloor: gameState.currentFloor,
        totalScore: gameState.totalScore,
        gamePhase: gameState.gamePhase,
        enemies: gameState.enemies,
      },
      mapState: {
        currentMap: mapState.currentMap,
        currentRoomId: mapState.currentRoomId,
        visitedRooms: Array.from(mapState.visitedRooms),
      },
      timestamp: Date.now(),
      version: '1.0.0',
    };

    try {
      localStorage.setItem('ghostDungeonSave', JSON.stringify(saveData));
      return true;
    } catch (error) {
      console.error('Failed to save game:', error);
      return false;
    }
  }, [gameState, mapState]);

  const loadGame = useCallback(() => {
    try {
      const saveData = localStorage.getItem('ghostDungeonSave');
      if (!saveData) return false;

      const parsed = JSON.parse(saveData);
      
      // Validate save data
      if (!parsed.gameState || !parsed.mapState) {
        console.error('Invalid save data');
        return false;
      }

      // Restore game state
      gameState.updateStats(parsed.gameState.playerStats);
      gameState.inventory = parsed.gameState.inventory;
      gameState.currentRoomId = parsed.gameState.currentRoomId;
      gameState.discoveredSecrets = parsed.gameState.discoveredSecrets;
      gameState.completedRooms = parsed.gameState.completedRooms;
      gameState.currentFloor = parsed.gameState.currentFloor;
      gameState.totalScore = parsed.gameState.totalScore;
      gameState.setGamePhase(parsed.gameState.gamePhase);
      gameState.enemies = parsed.gameState.enemies;

      // Restore map state
      if (parsed.mapState.currentMap) {
        mapState.generateMap();
        // Note: Map generation will create a new map, we'd need to implement
        // a setCurrentMap method in the store to properly restore saved maps
      }
      if (parsed.mapState.currentRoomId) {
        mapState.setCurrentRoom(parsed.mapState.currentRoomId);
      }
      // Note: visitedRooms would need a setter method in the store

      return true;
    } catch (error) {
      console.error('Failed to load game:', error);
      return false;
    }
  }, [gameState, mapState]);

  const hasSaveData = useCallback(() => {
    return localStorage.getItem('ghostDungeonSave') !== null;
  }, []);

  const deleteSave = useCallback(() => {
    try {
      localStorage.removeItem('ghostDungeonSave');
      return true;
    } catch (error) {
      console.error('Failed to delete save:', error);
      return false;
    }
  }, []);

  const getSaveInfo = useCallback(() => {
    try {
      const saveData = localStorage.getItem('ghostDungeonSave');
      if (!saveData) return null;

      const parsed = JSON.parse(saveData);
      return {
        timestamp: parsed.timestamp,
        version: parsed.version,
        level: parsed.gameState.playerStats.level,
        score: parsed.gameState.totalScore,
        floor: parsed.gameState.currentFloor,
      };
    } catch (error) {
      console.error('Failed to get save info:', error);
      return null;
    }
  }, []);

  return {
    saveGame,
    loadGame,
    hasSaveData,
    deleteSave,
    getSaveInfo,
  };
};
