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
}

export const RoomType = {
  START: 'start',
  END: 'end',
  NORMAL: 'normal',
  TREASURE: 'treasure',
  ENEMY: 'enemy',
  PUZZLE: 'puzzle',
  BOSS: 'boss',
  SECRET: 'secret'
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
