import { create } from 'zustand';
import type { Item } from '../types/map';

export interface PlayerDimensions {
  width: number; // Player width in units
  height: number; // Player height in units
  depth: number; // Player depth in units (for 3D hitbox)
  capsuleRadius: number; // Radius for capsule collider
  capsuleHeight: number; // Height for capsule collider
}

export interface PlayerStats {
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
  // Character upgrades
  size: number; // Character scale multiplier
  speed: number; // Movement speed multiplier
  strength: number; // Damage multiplier
  defense: number; // Damage reduction
  luck: number; // Better item drops
  // Physical dimensions
  dimensions: PlayerDimensions;
  // Temporary buffs
  buffs: {
    speedBoost: number; // Coffee effect duration
    strengthBoost: number; // Protein shake duration
    defenseBoost: number; // Armor duration
    luckBoost: number; // Lucky charm duration
  };
}

export interface GameState {
  playerStats: PlayerStats;
  inventory: Item[];
  isPreviewing: boolean;
  previewTime: number;
  maxPreviewTime: number;
  currentRoomId: string | null;
  discoveredSecrets: string[];
  completedRooms: string[];
  currentFloor: number;
  totalScore: number;
  gamePhase: 'exploration' | 'puzzle' | 'boss';
}

export type PersistedGameState = Pick<
  GameState,
  | 'playerStats'
  | 'inventory'
  | 'currentRoomId'
  | 'discoveredSecrets'
  | 'completedRooms'
  | 'currentFloor'
  | 'totalScore'
  | 'gamePhase'
>;

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
  
  // Character upgrades
  upgradeSize: (amount: number) => void;
  upgradeSpeed: (amount: number) => void;
  upgradeStrength: (amount: number) => void;
  upgradeDefense: (amount: number) => void;
  upgradeLuck: (amount: number) => void;
  
  // Temporary buffs
  addBuff: (buffType: keyof PlayerStats['buffs'], duration: number) => void;
  updateBuffs: () => void;
  
  // Inventory
  addItem: (item: Item) => void;
  removeItem: (itemId: string) => void;
  useItem: (itemId: string) => boolean;
  getItem: (itemId: string) => Item | undefined;
  
  // Game mechanics
  startPreview: () => boolean;
  stopPreview: () => void;
  
  // Room system
  enterRoom: (roomId: string) => void;
  completeRoom: (roomId: string) => void;
  discoverSecret: (secretId: string) => void;
  
  // Progression
  advanceFloor: () => void;
  addScore: (points: number) => void;
  setGamePhase: (phase: GameState['gamePhase']) => void;
  restoreGameState: (state: PersistedGameState) => void;
  
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
  // Character upgrades
  size: 1.0,
  speed: 1.0,
  strength: 1.0,
  defense: 0,
  luck: 0,
  // Physical dimensions (standard player size)
  dimensions: {
    width: 0.6, // Player width
    height: 1.8, // Player height (typical human height)
    depth: 0.6, // Player depth
    capsuleRadius: 0.3, // Capsule collider radius
    capsuleHeight: 1.4, // Capsule collider height
  },
  // Temporary buffs
  buffs: {
    speedBoost: 0,
    strengthBoost: 0,
    defenseBoost: 0,
    luckBoost: 0,
  },
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

  // Character upgrades
  upgradeSize: (amount) => {
    set((state) => ({
      playerStats: {
        ...state.playerStats,
        size: Math.max(0.5, state.playerStats.size + amount),
        maxLives: Math.max(3, state.playerStats.maxLives + Math.floor(amount * 2)) // Size increases max health
      }
    }));
  },

  upgradeSpeed: (amount) => {
    set((state) => ({
      playerStats: {
        ...state.playerStats,
        speed: Math.max(0.5, state.playerStats.speed + amount)
      }
    }));
  },

  upgradeStrength: (amount) => {
    set((state) => ({
      playerStats: {
        ...state.playerStats,
        strength: Math.max(0.5, state.playerStats.strength + amount)
      }
    }));
  },

  upgradeDefense: (amount) => {
    set((state) => ({
      playerStats: {
        ...state.playerStats,
        defense: Math.max(0, state.playerStats.defense + amount)
      }
    }));
  },

  upgradeLuck: (amount) => {
    set((state) => ({
      playerStats: {
        ...state.playerStats,
        luck: Math.max(0, state.playerStats.luck + amount)
      }
    }));
  },

  // Temporary buffs
  addBuff: (buffType, duration) => {
    set((state) => ({
      playerStats: {
        ...state.playerStats,
        buffs: {
          ...state.playerStats.buffs,
          [buffType]: Math.max(state.playerStats.buffs[buffType], duration)
        }
      }
    }));
  },

  updateBuffs: () => {
    set((state) => {
      const newBuffs = { ...state.playerStats.buffs };
      let hasChanges = false;

      // Decrease all buff durations by 1 second
      Object.keys(newBuffs).forEach(key => {
        const buffKey = key as keyof PlayerStats['buffs'];
        if (newBuffs[buffKey] > 0) {
          newBuffs[buffKey] = Math.max(0, newBuffs[buffKey] - 1);
          hasChanges = true;
        }
      });

      return hasChanges ? {
        playerStats: {
          ...state.playerStats,
          buffs: newBuffs
        }
      } : state;
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

  // Room system
  enterRoom: (roomId) => {
    set({ currentRoomId: roomId });
    // Mark room as visited when entering
    if (!get().completedRooms.includes(roomId)) {
      set((state) => ({
        completedRooms: [...state.completedRooms, roomId]
      }));
    }
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

  restoreGameState: (state) => {
    set({
      completedRooms: [...state.completedRooms],
      currentFloor: state.currentFloor,
      currentRoomId: state.currentRoomId,
      discoveredSecrets: [...state.discoveredSecrets],
      gamePhase: state.gamePhase,
      inventory: state.inventory.map((item) => ({
        ...item,
        effects: item.effects.map((effect) => ({ ...effect })),
      })),
      playerStats: {
        ...state.playerStats,
        buffs: { ...state.playerStats.buffs },
        dimensions: { ...state.playerStats.dimensions },
      },
      totalScore: state.totalScore,
    });
  },

  resetGame: () => {
    set({
      playerStats: initialStats,
      inventory: [],
      isPreviewing: false,
      previewTime: 0,
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
