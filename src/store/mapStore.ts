import { create } from 'zustand';
import type { MapState, MapActions, GameMap, MapConfig, Room } from '../types/map';
import { RoomType } from '../types/map';

const defaultConfig: MapConfig = {
  width: 20,
  height: 20,
  roomSize: 10,
  minRooms: 8,
  maxRooms: 15,
  specialRoomChance: 0.3,
  connectionChance: 0.4,
};

const useMapStore = create<MapState & MapActions>((set, get) => ({
  // State
  currentMap: null,
  currentRoomId: null,
  visitedRooms: new Set(),
  isGenerating: false,
  error: null,

  // Actions
  generateMap: (config = {}) => {
    set({ isGenerating: true, error: null });
    
    try {
      const finalConfig = { ...defaultConfig, ...config };
      const map = generateProceduralMap(finalConfig);
      
      set({
        currentMap: map,
        currentRoomId: map.startRoomId,
        visitedRooms: new Set([map.startRoomId]),
        isGenerating: false,
        error: null,
      });
    } catch (error) {
      set({
        isGenerating: false,
        error: error instanceof Error ? error.message : 'Failed to generate map',
      });
    }
  },

  setCurrentRoom: (roomId: string) => {
    const { currentMap } = get();
    if (currentMap && currentMap.rooms.find(room => room.id === roomId)) {
      set({ currentRoomId: roomId });
    }
  },

  markRoomVisited: (roomId: string) => {
    const { visitedRooms } = get();
    const newVisitedRooms = new Set(visitedRooms);
    newVisitedRooms.add(roomId);
    set({ visitedRooms: newVisitedRooms });
  },

  clearMap: () => {
    set({
      currentMap: null,
      currentRoomId: null,
      visitedRooms: new Set(),
      error: null,
    });
  },

  setError: (error: string | null) => {
    set({ error });
  },
}));

// Binding of Isaac style map generation
function generateProceduralMap(config: MapConfig): GameMap {
  const { roomSize, specialRoomChance } = config;
  
  const rooms: Room[] = [];
  const gridSize = 7; // 7x7 grid like BoI
  const grid: (Room | null)[][] = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null));
  
  // Start room in center of grid
  const startX = Math.floor(gridSize / 2);
  const startZ = Math.floor(gridSize / 2);
  
  const startRoom: Room = {
    id: 'start',
    position: { x: 0, z: 0 }, // Start at world origin
    type: RoomType.START,
    connections: [],
    size: roomSize,
    isVisited: true,
    isCurrent: true,
  };
  
  rooms.push(startRoom);
  grid[startX][startZ] = startRoom;
  
  // Generate room patterns like BoI
  generateBoIPattern(grid, rooms, startX, startZ, roomSize, gridSize, specialRoomChance);
  
  // Ensure connectivity
  ensureConnectivity(rooms);
  
  // Debug: Log room positions
  console.log('Generated rooms:', rooms.map(r => ({ id: r.id, pos: r.position, connections: r.connections.length })));
  
  // Create the map
  const map: GameMap = {
    id: `map_${Date.now()}`,
    rooms,
    startRoomId: startRoom.id,
    endRoomId: rooms[rooms.length - 1].id,
    config,
    generatedAt: Date.now(),
  };

  return map;
}

// Binding of Isaac style pattern generation
function generateBoIPattern(
  grid: (Room | null)[][], 
  rooms: Room[], 
  startX: number, 
  startZ: number, 
  roomSize: number, 
  gridSize: number, 
  specialRoomChance: number
): void {
  const patterns = ['cross', 'line', 'l-shape', 't-shape', 'plus'];
  const selectedPattern = patterns[Math.floor(Math.random() * patterns.length)];
  
  const roomId = 1;
  const maxRooms = 8 + Math.floor(Math.random() * 5); // 8-12 rooms like BoI
  
  // Generate pattern-based rooms
  switch (selectedPattern) {
    case 'cross':
      generateCrossPattern(grid, rooms, startX, startZ, roomSize, gridSize, specialRoomChance, roomId, maxRooms);
      break;
    case 'line':
      generateLinePattern(grid, rooms, startX, startZ, roomSize, gridSize, specialRoomChance, roomId, maxRooms);
      break;
    case 'l-shape':
      generateLPattern(grid, rooms, startX, startZ, roomSize, gridSize, specialRoomChance, roomId, maxRooms);
      break;
    case 't-shape':
      generateTPattern(grid, rooms, startX, startZ, roomSize, gridSize, specialRoomChance, roomId, maxRooms);
      break;
    case 'plus':
      generatePlusPattern(grid, rooms, startX, startZ, roomSize, gridSize, specialRoomChance, roomId, maxRooms);
      break;
  }
}

// Cross pattern: rooms in a cross shape
function generateCrossPattern(
  grid: (Room | null)[][], 
  rooms: Room[], 
  startX: number, 
  startZ: number, 
  roomSize: number, 
  gridSize: number, 
  specialRoomChance: number,
  roomId: number,
  maxRooms: number
): void {
  const directions = [
    { dx: 0, dz: -1 }, // North
    { dx: 0, dz: 1 },  // South
    { dx: -1, dz: 0 }, // West
    { dx: 1, dz: 0 }   // East
  ];
  
  let currentRoomId = roomId;
  
  directions.forEach((dir) => {
    let x = startX + dir.dx;
    let z = startZ + dir.dz;
    const length = 1 + Math.floor(Math.random() * 3); // 1-3 rooms per direction
    
    for (let i = 0; i < length && currentRoomId < maxRooms; i++) {
      if (x >= 0 && x < gridSize && z >= 0 && z < gridSize && !grid[x][z]) {
        const roomType = currentRoomId === maxRooms - 1 ? RoomType.END :
                        Math.random() < specialRoomChance ? getRandomSpecialRoom() : RoomType.NORMAL;
        
        const newRoom: Room = {
          id: `room_${currentRoomId}`,
          position: { x: (x - startX) * roomSize, z: (z - startZ) * roomSize },
          type: roomType,
          connections: [],
          size: roomSize,
          isVisited: false,
          isCurrent: false,
        };
        
        rooms.push(newRoom);
        grid[x][z] = newRoom;
        
        // Connect to previous room
        if (i === 0) {
          // Connect to start room
          newRoom.connections.push(rooms[0].id);
          rooms[0].connections.push(newRoom.id);
        } else {
          // Connect to previous room in this direction
          const prevRoom = rooms[rooms.length - 2];
          newRoom.connections.push(prevRoom.id);
          prevRoom.connections.push(newRoom.id);
        }
        
        currentRoomId++;
      }
      
      x += dir.dx;
      z += dir.dz;
    }
  });
}

// Line pattern: rooms in a straight line
function generateLinePattern(
  grid: (Room | null)[][], 
  rooms: Room[], 
  startX: number, 
  startZ: number, 
  roomSize: number, 
  gridSize: number, 
  specialRoomChance: number,
  roomId: number,
  maxRooms: number
): void {
  const direction = Math.floor(Math.random() * 4);
  const directions = [
    { dx: 0, dz: -1 }, // North
    { dx: 0, dz: 1 },  // South
    { dx: -1, dz: 0 }, // West
    { dx: 1, dz: 0 }   // East
  ];
  
  const dir = directions[direction];
  let x = startX + dir.dx;
  let z = startZ + dir.dz;
  let currentRoomId = roomId;
  
  for (let i = 0; i < maxRooms - 1 && x >= 0 && x < gridSize && z >= 0 && z < gridSize; i++) {
    if (!grid[x][z]) {
      const roomType = i === maxRooms - 2 ? RoomType.END :
                      Math.random() < specialRoomChance ? getRandomSpecialRoom() : RoomType.NORMAL;
      
      // Calculate position relative to center (0,0)
      const relativeX = (x - startX) * roomSize;
      const relativeZ = (z - startZ) * roomSize;
      
      const newRoom: Room = {
        id: `room_${currentRoomId}`,
        position: { x: relativeX, z: relativeZ },
        type: roomType,
        connections: [],
        size: roomSize,
        isVisited: false,
        isCurrent: false,
      };
      
      rooms.push(newRoom);
      grid[x][z] = newRoom;
      
      // Connect to previous room
      const prevRoom = rooms[rooms.length - 2];
      newRoom.connections.push(prevRoom.id);
      prevRoom.connections.push(newRoom.id);
      
      currentRoomId++;
    }
    
    x += dir.dx;
    z += dir.dz;
  }
}

// L-shape pattern
function generateLPattern(
  grid: (Room | null)[][], 
  rooms: Room[], 
  startX: number, 
  startZ: number, 
  roomSize: number, 
  gridSize: number, 
  specialRoomChance: number,
  roomId: number,
  maxRooms: number
): void {
  // Generate two perpendicular lines
  const horizontalDir = Math.random() < 0.5 ? 1 : -1; // East or West
  const verticalDir = Math.random() < 0.5 ? 1 : -1;   // North or South
  
  let currentRoomId = roomId;
  let x = startX + horizontalDir;
  let z = startZ;
  
  // Horizontal line
  for (let i = 0; i < 3 && x >= 0 && x < gridSize && currentRoomId < maxRooms; i++) {
    if (!grid[x][z]) {
      const roomType = currentRoomId === maxRooms - 1 ? RoomType.END :
                      Math.random() < specialRoomChance ? getRandomSpecialRoom() : RoomType.NORMAL;
      
      // Calculate position relative to center (0,0)
      const relativeX = (x - startX) * roomSize;
      const relativeZ = (z - startZ) * roomSize;
      
      const newRoom: Room = {
        id: `room_${currentRoomId}`,
        position: { x: relativeX, z: relativeZ },
        type: roomType,
        connections: [],
        size: roomSize,
        isVisited: false,
        isCurrent: false,
      };
      
      rooms.push(newRoom);
      grid[x][z] = newRoom;
      
      // Connect to previous room
      const prevRoom = rooms[rooms.length - 2];
      newRoom.connections.push(prevRoom.id);
      prevRoom.connections.push(newRoom.id);
      
      currentRoomId++;
    }
    x += horizontalDir;
  }
  
  // Vertical line from the end of horizontal
  x -= horizontalDir; // Go back one step
  z += verticalDir;
  
  for (let i = 0; i < 3 && z >= 0 && z < gridSize && currentRoomId < maxRooms; i++) {
    if (!grid[x][z]) {
      const roomType = currentRoomId === maxRooms - 1 ? RoomType.END :
                      Math.random() < specialRoomChance ? getRandomSpecialRoom() : RoomType.NORMAL;
      
      // Calculate position relative to center (0,0)
      const relativeX = (x - startX) * roomSize;
      const relativeZ = (z - startZ) * roomSize;
      
      const newRoom: Room = {
        id: `room_${currentRoomId}`,
        position: { x: relativeX, z: relativeZ },
        type: roomType,
        connections: [],
        size: roomSize,
        isVisited: false,
        isCurrent: false,
      };
      
      rooms.push(newRoom);
      grid[x][z] = newRoom;
      
      // Connect to previous room
      const prevRoom = rooms[rooms.length - 2];
      newRoom.connections.push(prevRoom.id);
      prevRoom.connections.push(newRoom.id);
      
      currentRoomId++;
    }
    z += verticalDir;
  }
}

// T-shape pattern
function generateTPattern(
  grid: (Room | null)[][], 
  rooms: Room[], 
  startX: number, 
  startZ: number, 
  roomSize: number, 
  gridSize: number, 
  specialRoomChance: number,
  roomId: number,
  maxRooms: number
): void {
  // Generate a T shape
  const directions = [
    { dx: 0, dz: -1 }, // North
    { dx: 0, dz: 1 },  // South
    { dx: -1, dz: 0 }, // West
    { dx: 1, dz: 0 }   // East
  ];
  
  let currentRoomId = roomId;
  
  // Main line (vertical or horizontal)
  const mainDir = directions[Math.floor(Math.random() * 2)]; // North or South
  let x = startX + mainDir.dx;
  let z = startZ + mainDir.dz;
  
  for (let i = 0; i < 2 && x >= 0 && x < gridSize && z >= 0 && z < gridSize && currentRoomId < maxRooms; i++) {
    if (!grid[x][z]) {
      const roomType = currentRoomId === maxRooms - 1 ? RoomType.END :
                      Math.random() < specialRoomChance ? getRandomSpecialRoom() : RoomType.NORMAL;
      
      // Calculate position relative to center (0,0)
      const relativeX = (x - startX) * roomSize;
      const relativeZ = (z - startZ) * roomSize;
      
      const newRoom: Room = {
        id: `room_${currentRoomId}`,
        position: { x: relativeX, z: relativeZ },
        type: roomType,
        connections: [],
        size: roomSize,
        isVisited: false,
        isCurrent: false,
      };
      
      rooms.push(newRoom);
      grid[x][z] = newRoom;
      
      // Connect to previous room
      const prevRoom = rooms[rooms.length - 2];
      newRoom.connections.push(prevRoom.id);
      prevRoom.connections.push(newRoom.id);
      
      currentRoomId++;
    }
    x += mainDir.dx;
    z += mainDir.dz;
  }
  
  // Cross line (perpendicular)
  const crossDir = directions[Math.floor(Math.random() * 2) + 2]; // West or East
  x = startX + crossDir.dx;
  z = startZ + crossDir.dz;
  
  for (let i = 0; i < 2 && x >= 0 && x < gridSize && z >= 0 && z < gridSize && currentRoomId < maxRooms; i++) {
    if (!grid[x][z]) {
      const roomType = currentRoomId === maxRooms - 1 ? RoomType.END :
                      Math.random() < specialRoomChance ? getRandomSpecialRoom() : RoomType.NORMAL;
      
      // Calculate position relative to center (0,0)
      const relativeX = (x - startX) * roomSize;
      const relativeZ = (z - startZ) * roomSize;
      
      const newRoom: Room = {
        id: `room_${currentRoomId}`,
        position: { x: relativeX, z: relativeZ },
        type: roomType,
        connections: [],
        size: roomSize,
        isVisited: false,
        isCurrent: false,
      };
      
      rooms.push(newRoom);
      grid[x][z] = newRoom;
      
      // Connect to start room
      newRoom.connections.push(rooms[0].id);
      rooms[0].connections.push(newRoom.id);
      
      currentRoomId++;
    }
    x += crossDir.dx;
    z += crossDir.dz;
  }
}

// Plus pattern
function generatePlusPattern(
  grid: (Room | null)[][], 
  rooms: Room[], 
  startX: number, 
  startZ: number, 
  roomSize: number, 
  gridSize: number, 
  specialRoomChance: number,
  roomId: number,
  maxRooms: number
): void {
  const directions = [
    { dx: 0, dz: -1 }, // North
    { dx: 0, dz: 1 },  // South
    { dx: -1, dz: 0 }, // West
    { dx: 1, dz: 0 }   // East
  ];
  
  let currentRoomId = roomId;
  
  directions.forEach((dir) => {
    let x = startX + dir.dx;
    let z = startZ + dir.dz;
    const length = 1 + Math.floor(Math.random() * 2); // 1-2 rooms per direction
    
    for (let i = 0; i < length && x >= 0 && x < gridSize && z >= 0 && z < gridSize && currentRoomId < maxRooms; i++) {
      if (!grid[x][z]) {
        const roomType = currentRoomId === maxRooms - 1 ? RoomType.END :
                        Math.random() < specialRoomChance ? getRandomSpecialRoom() : RoomType.NORMAL;
        
        const newRoom: Room = {
          id: `room_${currentRoomId}`,
          position: { x: (x - startX) * roomSize, z: (z - startZ) * roomSize },
          type: roomType,
          connections: [],
          size: roomSize,
          isVisited: false,
          isCurrent: false,
        };
        
        rooms.push(newRoom);
        grid[x][z] = newRoom;
        
        // Connect to start room
        newRoom.connections.push(rooms[0].id);
        rooms[0].connections.push(newRoom.id);
        
        currentRoomId++;
      }
      
      x += dir.dx;
      z += dir.dz;
    }
  });
}

// Helper function to get random special room
function getRandomSpecialRoom(): string {
  const specialTypes = [RoomType.TREASURE, RoomType.ENEMY, RoomType.PUZZLE, RoomType.SECRET];
  return specialTypes[Math.floor(Math.random() * specialTypes.length)];
}

// Clean, simple BoI-style map generation

function ensureConnectivity(rooms: Room[]): void {
  const visited = new Set<string>();
  const queue = [rooms[0].id]; // Start with first room
  
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    
    visited.add(currentId);
    const currentRoom = rooms.find(r => r.id === currentId)!;
    
    for (const connectedId of currentRoom.connections) {
      if (!visited.has(connectedId)) {
        queue.push(connectedId);
      }
    }
  }
  
  // If not all rooms are connected, add connections
  const unvisited = rooms.filter(r => !visited.has(r.id));
  for (const room of unvisited) {
    const closestRoom = rooms
      .filter(r => visited.has(r.id))
      .reduce((closest, current) => {
        const roomDist = Math.abs(room.position.x - current.position.x) + Math.abs(room.position.z - current.position.z);
        const closestDist = Math.abs(room.position.x - closest.position.x) + Math.abs(room.position.z - closest.position.z);
        return roomDist < closestDist ? current : closest;
      });
    
    room.connections.push(closestRoom.id);
    closestRoom.connections.push(room.id);
    visited.add(room.id);
  }
}

// Removed unused function

export default useMapStore;
