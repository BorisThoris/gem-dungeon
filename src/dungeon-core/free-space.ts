import { cellKey } from "./identity";
import type { OccupancyGrid } from "./occupancy";
import type { GenerationConfig } from "./types";

export interface FreeSpaceIndex {
  readonly componentByCell: ReadonlyMap<string, number>;
  readonly componentSize: ReadonlyMap<number, number>;
  readonly largestComponentByFloor: ReadonlyMap<number, number>;
}

export function indexFreeSpace(
  config: GenerationConfig,
  occupancy: OccupancyGrid,
): FreeSpaceIndex {
  const componentByCell = new Map<string, number>();
  const componentSize = new Map<number, number>();
  const largestComponentByFloor = new Map<number, number>();
  let nextComponent = 0;
  for (let floor = 0; floor < config.world.floors; floor += 1) {
    let largestComponent = -1;
    let largestSize = -1;
    for (let z = 0; z < config.world.depth; z += 1) {
      for (let x = 0; x < config.world.width; x += 1) {
        const start = { floor, x, z };
        const startKey = cellKey(start);
        if (componentByCell.has(startKey) || !occupancy.canRouteThrough(start)) continue;
        const component = nextComponent;
        nextComponent += 1;
        componentByCell.set(startKey, component);
        const queue = [start];
        for (let index = 0; index < queue.length; index += 1) {
          const current = queue[index];
          for (const [dx, dz] of [
            [0, -1],
            [1, 0],
            [0, 1],
            [-1, 0],
          ] as const) {
            const neighbor = { floor, x: current.x + dx, z: current.z + dz };
            const key = cellKey(neighbor);
            if (!componentByCell.has(key) && occupancy.canRouteThrough(neighbor)) {
              componentByCell.set(key, component);
              queue.push(neighbor);
            }
          }
        }
        componentSize.set(component, queue.length);
        if (queue.length > largestSize) {
          largestComponent = component;
          largestSize = queue.length;
        }
      }
    }
    if (largestComponent >= 0) largestComponentByFloor.set(floor, largestComponent);
  }
  return { componentByCell, componentSize, largestComponentByFloor };
}
