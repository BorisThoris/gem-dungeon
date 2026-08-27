# Canonical dungeon core

`src/dungeon-core` is the authoritative, pure TypeScript dungeon compiler. It has
no React, Three.js, Rapier, Zustand, Electron, DOM, or browser dependency.

```text
GenerationSpec + seed + templates
  -> topology
  -> progression semantics
  -> exact-footprint placement
  -> socket/corridor/vertical routing
  -> validation
  -> metrics
  -> immutable Dungeon
```

## Public API

Import the supported surface from `src/dungeon-core/index.ts`:

```ts
import {
  decodeDungeon,
  encodeDungeon,
  generateDungeon,
  validateDungeon,
} from "./src/dungeon-core";

const result = generateDungeon({
  seed: "daily-2026-08-28",
  config: { world: { floors: 3 } },
});

if (!result.ok) {
  console.error(result.error.stage, result.error.code, result.diagnostics.trace);
  throw new Error(result.error.message);
}

const report = validateDungeon(result.dungeon);
if (!report.valid) throw new Error("Canonical validation failed");

const serialized = encodeDungeon(result.dungeon);
const restored = decodeDungeon(serialized);
```

The replay identity records the normalized seed, config hash, template-set
version, topology hash, and spatial hash. Runtime timing is diagnostics only and
is deliberately excluded from canonical identity.

Mutable gameplay data is separate. Use `createDungeonRunState`,
`enterDungeonRoom`, `canTraverseDungeonConnection`, and
`openDungeonConnection`; serialize it with `encodeDungeonRunState`. Whole-game
saves use the schema-v2 adapter in `src/persistence/gameSave.ts` and restore the
exact dungeon rather than regenerating it.

## Runtime and asset adapters

The core owns gameplay truth. Application-specific consumers derive views from
it:

- `canonicalMapAdapter.ts` is a temporary legacy `GameMap` boundary.
- `canonicalGeometryAdapter.ts` emits exact floor tiles, walls, authorized path
  adjacency, endpoint gates, traversal links, spawn position, material keys, and
  stable room asset anchors.
- R3F rendering, Rapier colliders, minimap, and room detection consume those
  canonical values. They do not reconstruct square room bounds or invent edges.

Texture and 3D-model tooling is reusable *through this adapter contract*:

- `materialKey` selects a material/texture family without putting renderer
  objects in the core.
- `CanonicalRoomAssetAnchor` supplies stable room ID, role, archetype, biome,
  shape, tags, world position, floor, and rotation for model placement or asset
  generation.
- An asset pipeline can derive an isolated seed such as
  `createRng(dungeon.replay.seed + ":asset:" + anchor.id)` so changing one room's
  decoration does not perturb topology or another room's assets.

The adapter does **not** generate bitmap textures or mesh files itself. Existing
scripts such as `scripts/generate-textures.js` and `scripts/generate-assets.js`
remain separate authoring tools. A future unified asset generator should accept
canonical material keys/anchors, return asset references, and never feed visual
decisions back into footprint, collision, or progression truth.

## Invariants and commands

```bash
yarn typecheck:dungeon
yarn test:dungeon
yarn test:dungeon:property
yarn test:dungeon:sweep
yarn test:dungeon:stress
yarn analyze:dungeon
yarn benchmark:dungeon:techniques
```

Generation failures remain structured failures. Do not repair a failed result by
adding graph-only edges or mutating it into apparent validity. Preserve a failing
seed in `tests/seeds`, fix the responsible stage, and make the regression
executable.
