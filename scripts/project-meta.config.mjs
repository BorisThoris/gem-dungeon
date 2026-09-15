// Metadata inputs for this repository - unique to gem-dungeon-epic-1.
//
// This checkout tracks main of github.com/BorisThoris/gem-dungeon, which
// Cloudflare Pages builds into https://gem-dungeon-git.pages.dev/.
//
// Everything here is curated by hand. Derived facts (stack, metrics, git,
// screenshots) are computed by scripts/generate-project-meta.mjs, which writes
// project.meta.json. Run it with:
//   npm run meta          regenerate project.meta.json
//   npm run meta:check    fail if project.meta.json is stale
//   npm run meta:refresh  shots -> social -> icons -> meta, for a release

import path from 'node:path';

// Screenshots are captured by the portfolio (npm run capture there). Point
// PORTFOLIO_ROOT elsewhere, or drop images in ./project-media, to override.
const portfolioRoot = process.env.PORTFOLIO_ROOT ?? String.raw`C:\Users\Gaming PC\Desktop\Repos\portfolio`;

export default {
  slug: "gem-dungeon",
  classification: "web-app",

  curated: {
    "title": "Gem Dungeon Editor",
    "subtitle": "Walk the dungeon, then rebuild it in place",
    "description": "A first-person dungeon you explore and edit in the same window: procedurally generated rooms and corridors, a component browser of breakable and interactive objects, texture painting and mosaic tools, and Rapier physics under your feet. React Three Fiber and Zustand, packaged with Electron.",
    "tags": [
      "React Three Fiber",
      "Three.js",
      "Level Editor",
      "Rapier",
      "Electron"
    ],
    "accent": "#22d3ee",
    "deploymentUrl": "https://gem-dungeon-git.pages.dev/",
    "localUrl": "http://127.0.0.1:4103/",
    "buildCommand": "yarn build",
    "buildOutput": "dist",
    "runCommand": "yarn dev --host 127.0.0.1 --port 4103",
    "devPort": 4103,
    "showcaseTier": "more"
  },

  // How this project photographs itself (npm run shots): the game view opens
  // facing a dark wall, so the card shows the 3D editor instead.
  capture: {
    "route": "/",
    "actions": [
      {
        "type": "waitFor",
        "target": { "selector": "canvas" },
        "state": "visible",
        "label": "wait for the loaded 3D scene"
      },
      {
        "type": "click",
        "target": { "role": "button", "name": "3D Editor" },
        "label": "open the 3D editor tab"
      },
      { "type": "wait", "ms": 3000, "label": "let the editor scene load" },
      {
        "type": "uncheck",
        "target": { "role": "checkbox", "name": "Show Player State" },
        "label": "hide the player-state overlay"
      }
    ],
    "waitAfterReadyMs": 1500
  },

  scores: {
    "priorityScore": 76,
    "demoabilityScore": 90,
    "depthScore": 84,
    "polishScore": 82,
    "uniquenessScore": 88,
    "maintenanceScore": 76
  },

  analysisNotes:
    "React Three Fiber dungeon editor with procedural rooms, physics, a component browser and a clean Vite demo path; deployed from main.",

  // Where the link-preview card lives: the page head that carries the Open
  // Graph tags, and the static directory the image is published from.
  social: {
    "htmlFile": "index.html",
    "pageTitle": "Gem Dungeon Editor",
    "staticDir": "public",
    "imageName": "og-image.jpg",
    "imageUrlPath": "/og-image.jpg"
  },

  // The icon set is rendered from public/favicon.svg by scripts/generate-app-icons.mjs.
  icons: {
    "background": "#111827",
    "themeColor": "#111827",
    "shortName": "Gem Editor"
  },

  media: {
    sourceDir: path.join(portfolioRoot, "public", "project-shots", "gem-dungeon", "latest"),
    publicPathPrefix: "/project-shots/gem-dungeon/latest",
    primaryProfile: "card"
  }
};
