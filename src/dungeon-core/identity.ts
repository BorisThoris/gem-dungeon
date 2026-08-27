import type { GridCell, GridVector, LocalCell } from "./types";

export function cellKey(cell: GridCell): string {
  return `${cell.floor}:${cell.x}:${cell.z}`;
}

export function localCellKey(cell: LocalCell): string {
  return `${cell.x}:${cell.z}`;
}

export function vectorKey(vector: GridVector): string {
  return `${vector.x}:${vector.y}:${vector.z}`;
}

export function compareGridCells(left: GridCell, right: GridCell): number {
  return left.floor - right.floor || left.z - right.z || left.x - right.x;
}

export function compareLocalCells(left: LocalCell, right: LocalCell): number {
  return left.z - right.z || left.x - right.x;
}

export function stableStringify(value: unknown, space?: number): string {
  return JSON.stringify(toStableValue(value), null, space);
}

export function hashValue(value: unknown): string {
  return hashString(stableStringify(value));
}

export function hashString(value: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
    second ^= second >>> 13;
  }
  return `${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0)
    .toString(16)
    .padStart(8, "0")}`;
}

export function hashStringToInt32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193);
  }
  return hash | 0;
}

function toStableValue(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error("Canonical data cannot contain non-finite numbers");
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(toStableValue);
  }

  if (value instanceof Set) {
    return [...value].map(toStableValue).sort(compareStableValues);
  }

  if (value instanceof Map) {
    return [...value.entries()]
      .map(([key, child]) => [toStableValue(key), toStableValue(child)])
      .sort((left, right) => compareStableValues(left[0], right[0]));
  }

  const result: Record<string, unknown> = {};
  const source = value as Record<string, unknown>;
  for (const key of Object.keys(source).sort()) {
    const child = source[key];
    if (child !== undefined) {
      result[key] = toStableValue(child);
    }
  }
  return result;
}

function compareStableValues(left: unknown, right: unknown): number {
  return JSON.stringify(left).localeCompare(JSON.stringify(right));
}
