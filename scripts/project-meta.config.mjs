// Curated identity and real keyboard/mouse capture recipes.
import path from 'node:path';
const portfolioRoot = process.env.PORTFOLIO_ROOT ?? String.raw`C:\Users\Gaming PC\Desktop\Repos\portfolio`;
export default {
  "slug": "gem-dungeon",
  "classification": "web-app",
  "curated": {
    "title": "Gem Dungeon Editor",
    "subtitle": "Explore connected rooms, save progress, and playtest your own",
    "description": "Explore a generated first-person dungeon with real room discovery, progression keys, connected corridors and a floor map. Save a chamber checkpoint, then open the original room, texture and mosaic tools. Edit a room and playtest it with the same keyboard and mouse controls. React Three Fiber, Rapier physics and Electron packaging.",
    "tags": [
      "React Three Fiber",
      "Three.js",
      "Level Editor",
      "Rapier",
      "Electron"
    ],
    "accent": "#54d88b",
    "deploymentUrl": "https://gem-dungeon-git.pages.dev/",
    "localUrl": "http://127.0.0.1:26110/",
    "buildCommand": "yarn build",
    "buildOutput": "dist",
    "runCommand": "npm run preview -- --host 127.0.0.1 --port 26110",
    "devPort": 26110,
    "showcaseTier": "more"
  },
  "capture": {
    "browserChannel": "chrome",
    "route": "/",
    "actions": [
      {
        "type": "waitFor",
        "target": {
          "role": "button",
          "name": "Begin exploring"
        },
        "state": "visible",
        "timeoutMs": 90000
      },
      {
        "type": "click",
        "target": {
          "role": "button",
          "name": "Begin exploring"
        }
      },
      {
        "type": "waitFor",
        "target": {
          "selector": "main[data-paused=\"false\"]"
        },
        "state": "visible"
      },
      {
        "type": "wait",
        "ms": 300
      },
      {
        "type": "key",
        "key": "w",
        "holdMs": 3000
      },
      {
        "type": "drag",
        "button": "right",
        "from": [
          0.5,
          0.5
        ],
        "deltaPixels": [
          -1571,
          0
        ],
        "lockWaitMs": 100,
        "steps": 1,
        "label": "hold right mouse and turn through the corridor"
      },
      {
        "type": "key",
        "key": "w",
        "holdMs": 3000
      },
      {
        "type": "drag",
        "button": "right",
        "from": [
          0.5,
          0.5
        ],
        "deltaPixels": [
          -1571,
          0
        ],
        "lockWaitMs": 100,
        "steps": 1,
        "label": "hold right mouse and turn through the corridor"
      },
      {
        "type": "key",
        "key": "w",
        "until": {"selector": "[data-testid=\"rooms-visited\"]:has-text(\"2\")"},
        "timeoutMs": 15000
      },
      {
        "type": "waitFor",
        "target": {
          "selector": "[data-testid=\"rooms-visited\"]:has-text(\"2\")"
        },
        "state": "visible",
        "timeoutMs": 15000
      },
      {
        "type": "click",
        "target": {
          "role": "button",
          "name": "Map"
        }
      },
      {
        "type": "waitFor",
        "target": {
          "role": "complementary",
          "name": "Canonical dungeon map"
        },
        "state": "visible"
      }
    ],
    "waitAfterReadyMs": 350,
    "quality": {
      "minStd": 12
    },
    "browserArgs": [
      "--disable-dev-shm-usage"
    ]
  },
  "scores": {
    "priorityScore": 76,
    "demoabilityScore": 90,
    "depthScore": 84,
    "polishScore": 82,
    "uniquenessScore": 88,
    "maintenanceScore": 76
  },
  "analysisNotes": "Original colored dungeon rooms, gem markers, night HDR and authoring tools retained. Verified keyboard exploration through five rooms, key acquisition and matching gate traversal, pause/save/restore and room edit/play/return. Desktop keyboard/mouse controls; native Electron packaging has not been reverified in this pass.",
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
        "title": "Gem Dungeon: explore, save and playtest",
        "kind": "capture",
        "inputs": [
          "src",
          "index.html",
          "vite.config.ts",
          "scripts/project-media-lib.mjs"
        ],
        "source": "local",
        "music": "project-media/music/tour.m4a",
        "posterAt": 0.4,
        "recipe": {
          "preserveTiming": true,
          "strictActions": true,
          "browserChannel": "chrome",
          "route": "/",
          "viewport": {
            "width": 1280,
            "height": 720
          },
          "durationMs": 36000,
          "quality": {
            "minStd": 8,
            "minColours": 6
          },
          "setup": {
            "actions": [
              {
                "type": "waitFor",
                "target": {
                  "role": "button",
                  "name": "Begin exploring"
                },
                "state": "visible",
                "timeoutMs": 90000
              },
              {
                "type": "click",
                "target": {
                  "role": "button",
                  "name": "Begin exploring"
                }
              },
              {
                "type": "waitFor",
                "target": {
                  "selector": "main[data-paused=\"false\"]"
                },
                "state": "visible"
              },
              {
                "type": "wait",
                "ms": 300
              }
            ],
            "waitAfterReadyMs": 200
          },
          "timeline": [
            {
              "type": "key",
              "key": "w",
              "holdMs": 3000
            },
            {
              "type": "drag",
              "button": "right",
              "from": [
                0.5,
                0.5
              ],
              "deltaPixels": [
                -1571,
                0
              ],
              "lockWaitMs": 100,
              "steps": 1,
              "label": "hold right mouse and turn through the corridor"
            },
            {
              "type": "key",
              "key": "w",
              "holdMs": 3000
            },
            {
              "type": "drag",
              "button": "right",
              "from": [
                0.5,
                0.5
              ],
              "deltaPixels": [
                -1571,
                0
              ],
              "lockWaitMs": 100,
              "steps": 1,
              "label": "hold right mouse and turn through the corridor"
            },
            {
              "type": "key",
              "key": "w",
              "until": {"selector": "[data-testid=\"rooms-visited\"]:has-text(\"2\")"},
        "timeoutMs": 15000
            },
            {
              "type": "waitFor",
              "target": {
                "selector": "[data-testid=\"rooms-visited\"]:has-text(\"2\")"
              },
              "state": "visible",
              "timeoutMs": 15000
            },
            {
              "type": "click",
              "target": {
                "role": "button",
                "name": "Map"
              }
            },
            {
              "type": "wait",
              "ms": 1400
            },
            {
              "type": "click",
              "target": {
                "role": "button",
                "name": "Workshop"
              }
            },
            {
              "type": "click",
              "target": {
                "role": "button",
                "name": "Save & open 3D Editor"
              }
            },
            {
              "type": "waitFor",
              "target": {
                "role": "button",
                "name": "Play scene"
              },
              "state": "visible",
              "timeoutMs": 30000
            },
            {
              "type": "fill",
              "target": {
                "role": "spinbutton"
              },
              "value": "8"
            },
            {
              "type": "press",
              "key": "Tab"
            },
            {
              "type": "wait",
              "ms": 1200
            },
            {
              "type": "drag",
              "from": [
                0.65,
                0.48
              ],
              "to": [
                0.72,
                0.5
              ],
              "steps": 35,
              "label": "orbit the original room in the editor"
            },
            {
              "type": "wait",
              "ms": 800
            },
            {
              "type": "click",
              "target": {
                "role": "button",
                "name": "Play scene"
              }
            },
            {
              "type": "wait",
              "ms": 600
            },
            {
              "type": "key",
              "key": "w",
              "holdMs": 300
            },
            {
              "type": "wait",
              "ms": 1200
            },
            {
              "type": "press",
              "key": "Escape"
            },
            {
              "type": "wait",
              "ms": 1000
            },
            {
              "type": "click",
              "target": {
                "role": "button",
                "name": "Return to expedition"
              }
            },
            {
              "type": "click",
              "target": {
                "role": "button",
                "name": "Begin exploring"
              }
            },
            {
              "type": "wait",
              "ms": 1200
            }
          ]
        }
      }
    ]
  }
};
