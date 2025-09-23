import { create } from 'zustand';
import type { Item } from '../types/map';
import type { Enemy } from '../components/Enemy';

interface PlayerStats {
  lives: number;
  maxLives: number;
  level: number;
  experience: number;
  points: number;
  keys: number;
  bombs: number;
  streak: number;
  maxStreak: number;
  currentFloor: number;
  roomsCompleted: number;
}

interface GameState {
  playerStats: PlayerStats;
  inventory: Item[];
  isPreviewing: boolean;
  previewTime: number;
  maxPreviewTime: number;
  enemies: Enemy[];
  currentRoomId: string | null;
  discoveredSecrets: string[];
  completedRooms: string[];
  currentFloor: number;
  totalScore: number;
  gamePhase: 'exploration' | 'combat' | 'puzzle' | 'boss';
}

interface GameActions {
  // Player stats
  updateStats: (stats: Partial<PlayerStats>) => void;
  addExperience: (amount: number) => void;
  addPoints: (amount: number) => void;
  loseLife: () => void;
  gainLife: () => void;
  addKey: () => void;
  useKey: () => boolean;
  addBomb: () => void;
  useBomb: () => boolean;
  updateStreak: (increment: boolean) => void;
  
  // Inventory
  addItem: (item: Item) => void;
  removeItem: (itemId: string) => void;
  useItem: (itemId: string) => boolean;
  getItem: (itemId: string) => Item | undefined;
  
  // Game mechanics
  startPreview: () => boolean;
  stopPreview: () => void;
  
  // Combat system
  spawnEnemy: (enemy: Enemy) => void;
  removeEnemy: (enemyId: string) => void;
  damageEnemy: (enemyId: string, damage: number) => void;
  
  // Room system
  enterRoom: (roomId: string) => void;
  completeRoom: (roomId: string) => void;
  discoverSecret: (secretId: string) => void;
  
  // Progression
  advanceFloor: () => void;
  addScore: (points: number) => void;
  setGamePhase: (phase: GameState['gamePhase']) => void;
  
  resetGame: () => void;
}

const initialStats: PlayerStats = {
  lives: 3,
  maxLives: 3,
  level: 1,
  experience: 0,
  points: 100, // Start with some points for testing
  keys: 2,
  bombs: 1,
  streak: 0,
  maxStreak: 0,
  currentFloor: 1,
  roomsCompleted: 0,
};

// Demo items for testing
const demoItems: Item[] = [
  {
    id: 'demo-key',
    name: 'Demo Key',
    description: 'A test key for locked rooms',
    type: 'consumable',
    rarity: 'common',
    cost: 0,
    effects: [{ type: 'keys', value: 1, description: '+1 key' }],
    icon: '🗝️',
    maxUses: 1,
    currentUses: 1,
  },
  {
    id: 'demo-bomb',
    name: 'Demo Bomb',
    description: 'A test bomb for secret rooms',
    type: 'consumable',
    rarity: 'common',
    cost: 0,
    effects: [{ type: 'bombs', value: 1, description: '+1 bomb' }],
    icon: '💣',
    maxUses: 1,
    currentUses: 1,
  },
  {
    id: 'demo-heart',
    name: 'Demo Heart',
    description: 'A test heart for health',
    type: 'consumable',
    rarity: 'common',
    cost: 0,
    effects: [{ type: 'health', value: 1, description: '+1 life' }],
    icon: '❤️',
    maxUses: 1,
    currentUses: 1,
  },
];

const useGameStore = create<GameState & GameActions>((set, get) => ({
  playerStats: initialStats,
  inventory: demoItems, // Start with demo items
  isPreviewing: false,
  previewTime: 0,
  maxPreviewTime: 2,
  enemies: [],
  currentRoomId: null,
  discoveredSecrets: [],
  completedRooms: [],
  currentFloor: 1,
  totalScore: 0,
  gamePhase: 'exploration',

  updateStats: (stats) => {
    set((state) => ({
      playerStats: { ...state.playerStats, ...stats }
    }));
  },

  addExperience: (amount) => {
    set((state) => {
      const newExp = state.playerStats.experience + amount;
      const newLevel = Math.floor(newExp / 100) + 1;
      const levelUp = newLevel > state.playerStats.level;
      
      return {
        playerStats: {
          ...state.playerStats,
          experience: newExp,
          level: newLevel,
          maxLives: levelUp ? state.playerStats.maxLives + 1 : state.playerStats.maxLives,
          lives: levelUp ? state.playerStats.maxLives + 1 : state.playerStats.lives,
        }
      };
    });
  },

  addPoints: (amount) => {
    set((state) => ({
      playerStats: {
        ...state.playerStats,
        points: state.playerStats.points + amount
      }
    }));
  },

  loseLife: () => {
    set((state) => ({
      playerStats: {
        ...state.playerStats,
        lives: Math.max(0, state.playerStats.lives - 1),
        streak: 0 // Reset streak on death
      }
    }));
  },

  gainLife: () => {
    set((state) => ({
      playerStats: {
        ...state.playerStats,
        lives: Math.min(state.playerStats.maxLives, state.playerStats.lives + 1)
      }
    }));
  },

  addKey: () => {
    set((state) => ({
      playerStats: {
        ...state.playerStats,
        keys: state.playerStats.keys + 1
      }
    }));
  },

  useKey: () => {
    const state = get();
    if (state.playerStats.keys > 0) {
      set((state) => ({
        playerStats: {
          ...state.playerStats,
          keys: state.playerStats.keys - 1
        }
      }));
      return true;
    }
    return false;
  },

  addBomb: () => {
    set((state) => ({
      playerStats: {
        ...state.playerStats,
        bombs: state.playerStats.bombs + 1
      }
    }));
  },

  useBomb: () => {
    const state = get();
    if (state.playerStats.bombs > 0) {
      set((state) => ({
        playerStats: {
          ...state.playerStats,
          bombs: state.playerStats.bombs - 1
        }
      }));
      return true;
    }
    return false;
  },

  updateStreak: (increment) => {
    set((state) => {
      const newStreak = increment ? state.playerStats.streak + 1 : 0;
      return {
        playerStats: {
          ...state.playerStats,
          streak: newStreak,
          maxStreak: Math.max(state.playerStats.maxStreak, newStreak)
        }
      };
    });
  },

  addItem: (item) => {
    set((state) => ({
      inventory: [...state.inventory, item]
    }));
  },

  removeItem: (itemId) => {
    set((state) => ({
      inventory: state.inventory.filter(item => item.id !== itemId)
    }));
  },

  useItem: (itemId) => {
    const state = get();
    const item = state.inventory.find(i => i.id === itemId);
    
    if (!item) return false;
    
    // Handle consumable items
    if (item.type === 'consumable') {
      if (item.currentUses && item.currentUses > 0) {
        const updatedItem = { ...item, currentUses: item.currentUses - 1 };
        
        if (updatedItem.currentUses <= 0) {
          // Remove item when uses are exhausted
          set((state) => ({
            inventory: state.inventory.filter(i => i.id !== itemId)
          }));
        } else {
          // Update item with new uses
          set((state) => ({
            inventory: state.inventory.map(i => i.id === itemId ? updatedItem : i)
          }));
        }
        
        // Apply item effects
        item.effects.forEach(effect => {
          switch (effect.type) {
            case 'health':
              if (effect.value > 0) {
                get().gainLife();
              } else {
                get().loseLife();
              }
              break;
            case 'keys':
              for (let i = 0; i < effect.value; i++) {
                get().addKey();
              }
              break;
            case 'bombs':
              for (let i = 0; i < effect.value; i++) {
                get().addBomb();
              }
              break;
            case 'points':
              get().addPoints(effect.value);
              break;
          }
        });
        
        return true;
      }
    }
    
    return false;
  },

  getItem: (itemId) => {
    const state = get();
    return state.inventory.find(item => item.id === itemId);
  },

  startPreview: () => {
    const state = get();
    if (state.playerStats.points >= 50 || state.inventory.some(item => item.id === 'cheat-sight')) {
      set({ isPreviewing: true, previewTime: state.maxPreviewTime });
      
      // Deduct points if not using cheat sight
      if (!state.inventory.some(item => item.id === 'cheat-sight')) {
        get().addPoints(-50);
      }
      
      return true;
    }
    return false;
  },

  stopPreview: () => {
    set({ isPreviewing: false, previewTime: 0 });
  },

  // Combat system
  spawnEnemy: (enemy) => {
    set((state) => ({
      enemies: [...state.enemies, enemy]
    }));
  },

  removeEnemy: (enemyId) => {
    set((state) => ({
      enemies: state.enemies.filter(enemy => enemy.id !== enemyId)
    }));
  },

  damageEnemy: (enemyId, damage) => {
    set((state) => ({
      enemies: state.enemies.map(enemy => 
        enemy.id === enemyId 
          ? { ...enemy, health: Math.max(0, enemy.health - damage) }
          : enemy
      )
    }));
  },

  // Room system
  enterRoom: (roomId) => {
    set({ currentRoomId: roomId });
  },

  completeRoom: (roomId) => {
    set((state) => ({
      completedRooms: [...state.completedRooms, roomId],
      playerStats: {
        ...state.playerStats,
        roomsCompleted: state.playerStats.roomsCompleted + 1
      }
    }));
  },

  discoverSecret: (secretId) => {
    set((state) => ({
      discoveredSecrets: [...state.discoveredSecrets, secretId]
    }));
  },

  // Progression
  advanceFloor: () => {
    set((state) => ({
      currentFloor: state.currentFloor + 1,
      playerStats: {
        ...state.playerStats,
        level: state.playerStats.level + 1,
        maxLives: state.playerStats.maxLives + 1,
        lives: state.playerStats.maxLives + 1
      }
    }));
  },

  addScore: (points) => {
    set((state) => ({
      totalScore: state.totalScore + points,
      playerStats: {
        ...state.playerStats,
        points: state.playerStats.points + points
      }
    }));
  },

  setGamePhase: (phase) => {
    set({ gamePhase: phase });
  },

  resetGame: () => {
    set({
      playerStats: initialStats,
      inventory: [],
      isPreviewing: false,
      previewTime: 0,
      enemies: [],
      currentRoomId: null,
      discoveredSecrets: [],
      completedRooms: [],
      currentFloor: 1,
      totalScore: 0,
      gamePhase: 'exploration',
    });
  },
}));

export default useGameStore;
