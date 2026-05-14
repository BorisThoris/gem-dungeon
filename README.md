# Gem Dungeon

**Gem Dungeon** is a React Three Fiber / Three.js first-person dungeon adventure prototype. It combines a 3D dungeon environment with generated rooms, puzzles, enemies, treasure/shop/special room types, inventory-style item data, visual effects, sound hooks, and map UI.

This repository is a portfolio-ready 3D web game project rather than a small Three.js demo. It shows modern React, TypeScript, Three.js rendering, physics integration, state management, room/map systems, and reusable gameplay components.

## What It Demonstrates

- React 19 application structure with TypeScript and Vite.
- Three.js rendering through `@react-three/fiber` and `@react-three/drei`.
- Physics integration through `@react-three/rapier`.
- First-person dungeon exploration flow.
- Generated map/room state using Zustand stores.
- Dungeon room types including puzzle, boss, shop, library, treasure, special, and secret rooms.
- Interactions for doors, destructible walls, items, puzzles, enemies, particles, and visual effects.
- Game UI, map UI, tutorial flow, sound hooks, settings hooks, and save-system hooks.
- 3D asset usage through GLB, HDR, and VOX assets in `public/`.

## Tech Stack

- React 19
- TypeScript
- Three.js
- React Three Fiber
- Drei
- Rapier physics
- Zustand
- Vite
- ESLint

## Main Code Areas

- `src/App.tsx` - app entry point.
- `src/components/StartScreen.tsx` - primary game shell.
- `src/components/MapContainer.tsx`, `MapRenderer.tsx`, and `MapUI.tsx` - map display and interaction.
- `src/components/Room.tsx` and `src/components/rooms/` - dungeon rooms and room-specific gameplay.
- `src/components/FirstPersonPuzzle.tsx` and `PuzzleGrid.tsx` - puzzle interaction flow.
- `src/components/GameManager.tsx`, `GameUI.tsx`, and `InteractionManager.tsx` - gameplay coordination and UI.
- `src/store/` - Zustand game and map state.
- `src/hooks/` - settings, save, and sound hooks.
- `src/data/itemDatabase.ts` - item definitions.

## Run Locally

```bash
npm install
npm run dev
```

Useful scripts:

```bash
npm run build
npm run lint
npm run preview
```

## Status

Archived portfolio project. The goal of this repository is to show React/Three.js 3D game architecture and gameplay-system exploration, not to represent a finished commercial game.
