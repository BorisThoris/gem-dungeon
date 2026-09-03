// Metadata inputs for this repository - unique to gem-dungeon-epic-1.
//
// Everything here is curated by hand. Derived facts (stack, metrics, git,
// screenshots) are computed by scripts/generate-project-meta.mjs, which writes
// project.meta.json. Run it with:
//   npm run meta          regenerate project.meta.json
//   npm run meta:check    fail if project.meta.json is stale

import path from 'node:path';

// Screenshots are captured by the portfolio (npm run capture there). Point
// PORTFOLIO_ROOT elsewhere, or drop images in ./project-media, to override.
const portfolioRoot = process.env.PORTFOLIO_ROOT ?? String.raw`C:\Users\Gaming PC\Desktop\Repos\portfolio`;

export default {
  slug: "gem-dungeon-editor-epic-1",
  classification: "duplicate",

  curated: {
    "title": "ThreeJS Gem Dungeon Editor (epic-1)",
    "subtitle": "Feature-branch copy of the dungeon editor",
    "description": "An epic-1 feature checkout of the React Three Fiber dungeon crawler and editor.",
    "tags": [
      "React Three Fiber",
      "Three.js",
      "Electron"
    ],
    "accent": "#c084fc",
    "showcaseTier": "excluded",
    "duplicateOf": "threejs-gem-dungeon-editor",
    "excludedReason": "Feature-branch copy of the dungeon editor."
  },

  analysisNotes:
    "Branch copy; ThreeJsGem-Fixed is the portfolio surface.",

  // Where the link-preview card lives: the page head that carries the Open
  // Graph tags, and the static directory the image is published from.
  social: {
    "htmlFile": "index.html",
    "staticDir": "public",
    "imageName": "og-image.jpg",
    "imageUrlPath": "/og-image.jpg"
  },

  media: {
    sourceDir: path.join(portfolioRoot, "public", "project-shots", "gem-dungeon-editor-epic-1", "latest"),
    publicPathPrefix: "/project-shots/gem-dungeon-editor-epic-1/latest",
    primaryProfile: "card"
  }
};
