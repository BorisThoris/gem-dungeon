export interface Position {
  x: number;
  z: number;
}

export interface Room {
  id: string;
  position: Position;
  type: string;
  connections: string[]; // IDs of connected rooms
  size: number; // Room size in units
  isVisited: boolean;
  isCurrent: boolean;
  // Enhanced room properties
  items?: any[]; // Demo items for special rooms
  specialProperties?: { [key: string]: any }; // Special room properties
}

export const RoomType = {
  START: 'start',
  END: 'end',
  NORMAL: 'normal',
  TREASURE: 'treasure',
  ENEMY: 'enemy',
  PUZZLE: 'puzzle',
  BOSS: 'boss',
  SECRET: 'secret',
  // Enhanced room types from React Native game
  MEMORY_CHAMBER: 'memory-chamber',
  SHOP: 'shop',
  TRAP: 'trap',
  CHALLENGE: 'challenge',
  LIBRARY: 'library',
  CURSED_ROOM: 'cursed-room',
  DEVIL_ROOM: 'devil-room',
  ANGEL_ROOM: 'angel-room'
} as const;

export type RoomType = typeof RoomType[keyof typeof RoomType];

export interface MapConfig {
  width: number;
  height: number;
  roomSize: number;
  minRooms: number;
  maxRooms: number;
  specialRoomChance: number;
  connectionChance: number;
}

export interface GameMap {
  id: string;
  rooms: Room[];
  startRoomId: string;
  endRoomId: string;
  config: MapConfig;
  generatedAt: number;
}

export interface MapState {
  currentMap: GameMap | null;
  currentRoomId: string | null;
  visitedRooms: Set<string>;
  isGenerating: boolean;
  error: string | null;
}

export interface MapActions {
  generateMap: (config?: Partial<MapConfig>) => void;
  setCurrentRoom: (roomId: string) => void;
  markRoomVisited: (roomId: string) => void;
  clearMap: () => void;
  setError: (error: string | null) => void;
}

// Item system types
export interface ItemEffect {
  type: string;
  value: number;
  duration?: number;
  description: string;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  type: 'consumable' | 'passive' | 'active' | 'trinket';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  cost: number;
  effects: ItemEffect[];
  icon: string;
  maxUses?: number;
  currentUses?: number;
  floorRequirement?: number;
  roomTypeRequirement?: string[];
}

// Puzzle system types
export interface PuzzleTile {
  id: string;
  shape: string;
  x: number;
  y: number;
  state: 'hidden' | 'flipped' | 'matched' | 'mismatched' | 'preview';
  pairId: string | null;
}

export interface Puzzle {
  id: string;
  type: 'memory-pairs' | 'sequence' | 'pattern' | 'color' | 'number';
  difficulty: number;
  tiles: PuzzleTile[];
  gridSize: number;
  completed: boolean;
  timeLimit?: number;
}

// Enhanced room interface
export interface EnhancedRoom extends Room {
  puzzle?: Puzzle;
  items: Item[];
  specialProperties?: { [key: string]: any };
  rewards: Item[];
  isLocked?: boolean;
  requiresKey?: boolean;
  timeLimit?: number;
}
