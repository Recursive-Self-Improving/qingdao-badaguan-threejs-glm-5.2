# 青岛八大关 · Qingdao Badaguan — Three.js Virtual Landscape

An interactive, atmospheric three.js virtual landscape of Qingdao's Badaguan
(青岛八大关) scenic area — the "Museum of World Architecture" on Taiping Bay.
Stroll a golden-hour autumn afternoon through tree-lined avenues of
pass-named roads, past red-tile villas in a dozen European styles, to the
Huashi Building castle on the Second Bathing Beach.

![Mood](https://img.shields.io/badge/mood-golden%20hour%20autumn%20%2B%20sea%20mist-E8B870)

## Requirements met

- **Free movement + view rotation** — first-person `PointerLockControls` with
  WASD, Shift sprint, Ctrl crouch, Space jump. Mouse-look via pointer lock.
  Terrain-following Y, XZ bounds, and a curved shoreline sea clamp.
- **Lighting + atmosphere** — golden-hour `DirectionalLight` with long PCF
  shadows, `HemisphereLight` + `AmbientLight`, `ACESFilmicToneMapping`,
  subtle `UnrealBloomPass` via `renderer.setEffects()`, and `FogExp2` sea
  mist.
- **Real Badaguan atmosphere** — 10 pass-named roads each lined with a
  distinct tree species (peach / crape myrtle / maple / cedar / crabapple /
  ginkgo), the Huashi Building (花石楼) castle, the Princess Building
  (公主楼), 8 procedural villas in 6 architectural styles, Taiping Bay sea
  with an S-curve shoreline, and the faithful "red tile, green trees, blue
  sea" color palette.

## Quick start

```bash
bun install
bun run dev          # http://localhost:5173
```

Click the canvas to enter (pointer lock), then:

| Key | Action |
|---|---|
| **W / A / S / D** | Move forward / strafe left / back / right |
| **Mouse** | Look around |
| **Shift** | Sprint |
| **Ctrl** | Crouch |
| **Space** | Jump |
| **Esc** | Release pointer (shows intro overlay) |

A HUD shows your current location (nearest road or landmark) and a minimap.

## Production build

```bash
bun run build       # outputs to dist/
bun run preview     # serve the production build
```

## Tech stack

| | |
|---|---|
| Renderer | [three.js](https://threejs.org) `0.184.0` (r184) |
| Bundler | [Vite](https://vitejs.dev) `8.1.0` |
| Language | Plain JS (ES modules) — no TypeScript |
| Package manager | [Bun](https://bun.sh) `1.3.14` |

### r184 API notes

- **Postprocessing** uses `renderer.setEffects([...])` (r180+), NOT the
  legacy `EffectComposer`. The renderer is constructed with
  `outputBufferType: THREE.HalfFloatType` — without it `setEffects()`
  silently no-ops. `OutputPass` is intentionally omitted because
  `setEffects` applies tone mapping + sRGB color space automatically.
- **Shadows** use `THREE.PCFShadowMap` — `PCFSoftShadowMap` is deprecated
  (r182+); `PCFShadowMap` is now soft by default.
- **PointerLockControls** uses `controls.object` (not `getObject()`, removed)
  and requires `renderer.domElement` as the second constructor argument.
- **Water normals** are generated procedurally as a `THREE.DataTexture` at
  runtime — the examples `waternormals.jpeg` is not shipped in the npm
  `three` package.

## Project structure

```
src/
├── config/
│   └── sun.js              # shared sun direction (single source of truth)
├── main.js                 # scene assembly + render loop
├── scene/
│   ├── terrain.js          # ground, shoreline, beach, 10-road grid, getHeight()
│   ├── sea.js              # Water + procedural normals + shallow tint
│   ├── sky.js              # Sky shader + FogExp2 (no lights)
│   ├── villas.js           # procedural villa generator + 8 placed villas
│   ├── landmarks.js        # Huashi Building + Princess Building
│   ├── vegetation.js       # InstancedMesh tree avenues + shrubs + walls
│   ├── lighting.js         # DirectionalLight + Hemisphere + Ambient
│   └── postprocessing.js   # UnrealBloomPass for setEffects
├── controls/
│   └── player.js           # PointerLockControls + WASD + terrain bounds
└── ui/
    ├── overlay.js          # intro screen, HUD, minimap, location detection
    └── styles.css          # overlay styling
```

Each scene module exports a `create*()` factory returning a structured object
`{ group, update?, fog?, getHeight?, lights? }` so cross-module handoffs (fog,
height sampling, sun direction, lights) have defined slots.

## Scene composition

- **Mood**: golden-hour autumn afternoon with light sea mist.
- **Terrain**: 400×400 ground with a gentle northward rise (southern foot of
  Taiping Mountain), S-curve shoreline, Second Bathing Beach sand arc.
- **Roads**: 10 pass-named roads on a ~30-unit grid — N-S: Zijingguan
  (紫荆关), Ningwuguan (宁武关), Shaoguan (韶关); E-W: Wushengguan
  (武胜关), Jiayuguan (嘉峪关), Hanguguan (函谷关), Zhengyangguan
  (正阳关), Linhuai (临淮), Juyongguan (居庸关), Shanhaiguan (山海关).
- **Trees**: one species per road — Shaoguan → flowering peach, Zhengyangguan
  → crape myrtle, Juyongguan → maple, Zijingguan → cedar, Ningwuguan →
  crabapple, remaining → ginkgo + pine accents.
- **Villas**: 8 procedural villas in 6 styles (castle, renaissance, danish,
  japanese, modern, mixed chinese-western), each with red-tile roofs and
  cream/yellow walls.
- **Landmarks**: Huashi Building (花石楼) — 5-floor granite medieval castle
  with crenellations and corner turrets on the Second Bathing Beach; Princess
  Building (公主楼) — Danish-style fairytale villa with steep gable.

## Color palette

| Element | Hex |
|---|---|
| Villa walls (cream/yellow) | `#E8D9A0` `#D9C77A` `#C9B06B` |
| Villa walls (white) | `#F2EDE3` |
| Red-tile roofs | `#A8322A` `#8E2A22` `#B53A2E` |
| Granite (Huashi) | `#B8B0A4` `#9A9088` |
| Ginkgo (autumn gold) | `#E8B84A` `#D4A02A` |
| Maple (autumn red) | `#B8322A` `#9E2A22` |
| Cedar / pine | `#3E5E3E` `#2E4A2E` |
| Crape myrtle | `#8E5A8E` |
| Sea (deep → shallow) | `#2E5E6E` → `#4E8E9E` |
| Sand | `#D9C9A0` `#C9B688` |
| Sky (horizon → zenith) | `#E8B870` → `#4E7EA0` |
| Sea-mist fog | `#D9D4C8` |

## License

MIT
