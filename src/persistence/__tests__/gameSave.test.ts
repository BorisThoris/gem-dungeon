import { describe, expect, test } from "vitest";
import { generateDungeon } from "../../dungeon-core/generator";
import { createDungeonRunState } from "../../dungeon-core/model";
import type { PersistedGameState } from "../../store/gameStore";
import {
  decodeGameSave,
  encodeGameSave,
  GAME_SAVE_SCHEMA_VERSION,
  GameSaveError,
} from "../gameSave";

const gameState: PersistedGameState = {
  completedRooms: [],
  currentFloor: 1,
  currentRoomId: null,
  discoveredSecrets: [],
  gamePhase: "exploration",
  inventory: [],
  playerStats: {
    bombs: 0,
    buffs: { defenseBoost: 0, luckBoost: 0, speedBoost: 0, strengthBoost: 0 },
    currentFloor: 1,
    defense: 0,
    dimensions: { capsuleHeight: 1.4, capsuleRadius: 0.3, depth: 0.6, height: 1.8, width: 0.6 },
    experience: 0,
    keys: 0,
    level: 1,
    lives: 3,
    luck: 0,
    maxLives: 3,
    maxStreak: 0,
    points: 0,
    roomsCompleted: 0,
    size: 1,
    speed: 1,
    streak: 0,
    strength: 1,
  },
  totalScore: 0,
};

describe("canonical game saves", () => {
  test("round-trips the exact dungeon and Set-backed run state", () => {
    const generated = generateDungeon({ seed: "save-round-trip" });
    if (!generated.ok) throw new Error(generated.error.message);
    const runState = createDungeonRunState(generated.dungeon);
    const snapshot = { ...gameState, currentRoomId: runState.currentRoomId };
    const encoded = encodeGameSave(generated.dungeon, runState, snapshot, 1234);
    const decoded = decodeGameSave(encoded);

    expect(decoded.dungeon).toEqual(generated.dungeon);
    expect(decoded.dungeonRunState).toEqual(runState);
    expect(decoded.gameState).toEqual(snapshot);
    expect(decoded.timestamp).toBe(1234);
    expect(JSON.parse(encoded).schemaVersion).toBe(GAME_SAVE_SCHEMA_VERSION);
  }, 30_000);

  test("rejects legacy regeneration saves and cross-model room drift", () => {
    expect(() => decodeGameSave(JSON.stringify({ version: "1.0.0" }))).toThrowError(
      GameSaveError,
    );

    const generated = generateDungeon({ seed: "save-drift" });
    if (!generated.ok) throw new Error(generated.error.message);
    const runState = createDungeonRunState(generated.dungeon);
    expect(() => encodeGameSave(
      generated.dungeon,
      runState,
      { ...gameState, currentRoomId: "missing-room" },
      0,
    )).toThrow(/missing room/);
  }, 30_000);
});
