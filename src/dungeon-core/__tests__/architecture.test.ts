import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const coreRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const forbiddenImports = [
  "react",
  "react-dom",
  "three",
  "@react-three/fiber",
  "@react-three/rapier",
  "zustand",
  "electron",
];

describe("pure TypeScript core boundary", () => {
  test("does not import UI/runtime packages or ambient generation entropy", () => {
    const violations: string[] = [];
    for (const file of sourceFiles(coreRoot)) {
      const source = readFileSync(file, "utf8");
      for (const packageName of forbiddenImports) {
        const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (new RegExp(`(?:from\\s+|import\\s*)["']${escaped}(?:/[^"']*)?["']`)
          .test(source)) {
          violations.push(`${file}: imports ${packageName}`);
        }
      }
      for (const globalName of ["Math.random", "Date.now", "window.", "document."]) {
        if (source.includes(globalName)) violations.push(`${file}: uses ${globalName}`);
      }
    }
    expect(violations).toEqual([]);
  });
});

function sourceFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sourceFiles(path);
    return entry.isFile() && entry.name.endsWith(".ts") ? [path] : [];
  });
}
