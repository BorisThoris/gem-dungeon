// Metadata inputs for this repository - unique to gem-dungeon-epic-1.
//
// Everything here is curated by hand: identity, commands, the screenshot recipe
// (capture), the recorded trailer (trailers.items, kind: capture) and where the
// card, icons and trailers are published. scripts/generate-project-meta.mjs
// derives the rest into project.meta.json; scripts/project-media.test.mjs
// checks that everything here was actually produced.
//   npm run meta:refresh   trailers -> shots -> social -> icons -> meta
//   npm run test:media     the media contract

import path from 'node:path';

const portfolioRoot = process.env.PORTFOLIO_ROOT ?? String.raw`C:\Users\Gaming PC\Desktop\Repos\portfolio`;

export default {
  "slug": "gem-dungeon",
  "classification": "web-app",
  "curated": {
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
  "capture": {
    "route": "/",
    "actions": [
      {
        "type": "waitFor",
        "target": {
          "selector": "canvas"
        },
        "state": "visible",
        "timeoutMs": 90000,
        "label": "wait for the rooms to pre-load"
      },
      {
        "type": "click",
        "target": {
          "role": "button",
          "name": "3D Editor"
        },
        "label": "open the 3D editor tab",
        "optional": true
      },
      {
        "type": "wait",
        "ms": 3500,
        "label": "let the editor scene load",
        "optional": true
      },
      {
        "type": "uncheck",
        "target": {
          "role": "checkbox",
          "name": "Show Player State"
        },
        "label": "hide the player-state overlay",
        "optional": true
      }
    ],
    "waitAfterReadyMs": 1500,
    "quality": {
      "minStd": 12
    }
  },
  "scores": {
    "priorityScore": 76,
    "demoabilityScore": 90,
    "depthScore": 84,
    "polishScore": 82,
    "uniquenessScore": 88,
    "maintenanceScore": 76
  },
  "analysisNotes": "React Three Fiber dungeon editor with procedural rooms, physics, a component browser and a clean Vite demo path; deployed from main.",
  "social": {
    "htmlFile": "index.html",
    "pageTitle": "Gem Dungeon Editor",
    "staticDir": "public",
    "imageName": "og-image.jpg",
    "imageUrlPath": "/og-image.jpg"
  },
  "icons": {
    "background": "#111827",
    "themeColor": "#111827",
    "shortName": "Gem Editor"
  },
  "media": {
    "sourceDir": path.join(portfolioRoot, "public", "project-shots", "gem-dungeon", "latest"),
    "publicPathPrefix": "/project-shots/gem-dungeon/latest",
    "primaryProfile": "card"
  },
  "trailers": {
    "items": [
      {
        "id": "tour",
        "title": "Gem Dungeon Editor: rooms, textures and mosaics",
        "kind": "capture",
        "inputs": [
          "src",
          "index.html"
        ],
        "source": "deployment",
        "music": "project-media/music/tour.m4a",
        "posterAt": 0.5,
        "recipe": {
          "route": "/",
          "viewport": {
            "width": 1280,
            "height": 720
          },
          "durationMs": 24000,
          "quality": {
            "minStd": 8,
            "minColours": 6
          },
          "setup": {
            "actions": [
              {
                "type": "waitFor",
                "target": {
                  "selector": "canvas"
                },
                "state": "visible",
                "timeoutMs": 90000,
                "label": "wait for the rooms to pre-load"
              },
              {
                "type": "click",
                "target": {
                  "role": "button",
                  "name": "3D Editor"
                },
                "label": "open the 3D editor tab"
              },
              {
                "type": "wait",
                "ms": 3000,
                "label": "let the editor scene load"
              },
              {
                "type": "uncheck",
                "target": {
                  "role": "checkbox",
                  "name": "Show Player State"
                },
                "label": "hide the player-state overlay",
                "optional": true
              }
            ],
            "waitAfterReadyMs": 800
          },
          "timeline": [
            {
              "type": "drag",
              "from": [
                0.62,
                0.5
              ],
              "to": [
                0.42,
                0.44
              ],
              "steps": 60,
              "label": "orbit the room"
            },
            {
              "type": "wait",
              "ms": 1500
            },
            {
              "type": "wait",
              "ms": 3500
            },
            {
              "type": "drag",
              "from": [
                0.4,
                0.5
              ],
              "to": [
                0.62,
                0.52
              ],
              "steps": 60,
              "label": "orbit again"
            },
            {
              "type": "wait",
              "ms": 1200
            },
            {
              "type": "click",
              "target": {
                "role": "button",
                "name": "Room Builder"
              },
              "label": "room builder tab",
              "optional": true
            },
            {
              "type": "wait",
              "ms": 3000
            },
            {
              "type": "click",
              "target": {
                "role": "button",
                "name": "Textures"
              },
              "label": "textures tab",
              "optional": true
            },
            {
              "type": "wait",
              "ms": 2500
            },
            {
              "type": "click",
              "target": {
                "role": "button",
                "name": "3D Editor"
              },
              "label": "back to the editor",
              "optional": true
            },
            {
              "type": "wait",
              "ms": 2500
            },
            {
              "type": "drag",
              "from": [
                0.5,
                0.55
              ],
              "to": [
                0.55,
                0.4
              ],
              "steps": 50,
              "label": "final orbit"
            }
          ]
        }
      }
    ]
  }
};
