# CHECKLIST.md — Progress Tracker

> Qingdao Badaguan Three.js Virtual Landscape. One section per implementation chunk. `[ ]` = unchecked (implementation has NOT started), `[x]` = done. Each chunk lists: name, owned files, dependency, and concrete tasks. See `PLAN.md` for full design.

---

## Chunk 1 — Project Scaffold

**Owned files:** `package.json`, `vite.config.js`, `index.html`, `src/main.js`, `src/config/sun.js`, `.gitignore`
**Dependency:** none (foundation)
**Parallel?** Sequential — must complete first.

### Tasks
- [x] Create `package.json` with `three@0.184.0`, `vite@8.1.0`; scripts: `dev` (vite), `build` (vite build), `preview` (vite preview); type module.
- [x] Create `vite.config.js` — minimal ESM config (server host/open, base path).
- [x] Create `index.html` — root `<div id="app">` + `<canvas>` mount, `<script type="module" src="/src/main.js">`, full-viewport CSS, no margins/scroll.
- [x] Create `.gitignore` — `node_modules`, `dist`, `.vite`, editor/OS files.
- [x] Create `src/main.js` — minimal skeleton: import `three`, create `WebGLRenderer` (attach to canvas), `Scene`, `PerspectiveCamera`, animation loop, resize handler. No scene content yet.
- [x] Create `src/config/sun.js` — shared sun config: export `SUN_ELEVATION` (~10°), `SUN_AZIMUTH` (warm golden-hour azimuth), and `SUN_DIRECTION` (THREE.Vector3 computed from elevation+azimuth). Single source of truth imported by Chunk 2 sea/sky and Chunk 5 lighting.
- [x] **Build gate:** `bun install` succeeds; `bun run dev` serves a blank canvas page with no console errors; `three@0.184.0` + `vite@8.1.0` resolved in lockfile.

---

## Chunk 2 — Terrain + Sea + Sky + Atmosphere Base

**Owned files:** `src/scene/terrain.js`, `src/scene/sea.js`, `src/scene/sky.js`
**Dependency:** Chunk 1
**Parallel?** Yes (after Chunk 1) — disjoint file scope. **MUST NOT touch `src/main.js`.**

- [x] `src/scene/terrain.js`: `createTerrain()` → `{ group, getHeight(x,z)=>number }` with:
  - [x] Large ground plane (~400×400), warm-stone/soil base material.
  - [x] Gentle northward rise (low-frequency displacement) = southern foot of Taiping Mountain.
  - [x] Taiping Bay shoreline S-curve along south edge; beach sand strip (`#D9C9A0`/`#C9B688`).
  - [x] Second Bathing Beach: wider sand arc on southwest (Huashi Building site).
  - [x] Road grid: 10 pass-named roads as warm-stone paths (`#B8A88E`/`#A8987A`); N-S: Zijingguan, Ningwuguan, Shaoguan; E-W: Wushengguan, Jiayuguan, Hanguguan, Zhengyangguan, Linhuai, Juyongguan, Shanhaiguan. Grid spacing ~30u, road width ~6u.
  - [x] Lawn blocks between roads (`#6E8E4E`/`#5E7E42`).
  - [x] `getHeight(x, z)` returns the terrain Y at (x,z) for player Y-bounds in Chunk 6 (sample the displacement function).
- [x] `src/scene/sea.js`: `createSea()` → `{ group, update(dt) }` with:
  - [x] `Water` planar surface covering south (Taiping Bay); import `SUN_DIRECTION` from `src/config/sun.js` to drive reflections.
  - [x] Color gradient `#2E5E6E`→`#4E8E9E` with golden highlights `#C9A85A` driven by `SUN_DIRECTION`.
  - [x] Water normals: generate a procedural `THREE.DataTexture` ripple normal map at runtime (do NOT import `waternormals.jpeg` — not shipped in npm `three`).
  - [x] `update(dt)` for water animation.
- [x] `src/scene/sky.js`: `createSky()` → `{ group, fog }` with:
  - [x] `Sky` shader dome; sun position from `SUN_DIRECTION` (import `src/config/sun.js`) — low/warm, matches Chunk 5 light.
  - [x] Horizon `#E8B870` → zenith `#4E7EA0` tuning via uniforms.
  - [x] **No lights** in sky.js (all lighting owned by Chunk 5).
  - [x] `FogExp2` warm grey-cream `#D9D4C8` returned via the `fog` slot (assigned as `scene.fog` at integration, NOT added to group). Base density; final tuning in Chunk 5.
- [x] **Build gate:** create a throwaway `debug/terrain.html` (uncommitted, under `debug/`) that imports only `createTerrain`/`createSea`/`createSky` into its own `Scene`+renderer — dev server shows ground + road grid + beach + sea + sky dome + base fog; no console errors. **Do NOT touch `src/main.js`** (integration is Chunk 5). Delete the debug file before commit.

---

## Chunk 3 — Villas + Landmarks

**Owned files:** `src/scene/villas.js`, `src/scene/landmarks.js`
**Dependency:** Chunk 1
**Parallel?** Yes (after Chunk 1) — disjoint file scope. **MUST NOT touch `src/main.js`.**

### Tasks
- [x] `src/scene/villas.js`: procedural villa generator `createVilla(opts)` + `createVillas()` → `{ group }`:
  - [x] Parametric opts: `{ wallColor, roofColor, roofStyle, height, width, depth, windows, style }`.
  - [x] Build from BoxGeometry walls + roof (gable / hipped / flat / turret variants).
  - [x] Window insets with emissive warm panes (golden-hour glow).
  - [x] 4–6 style variants: castle, renaissance, danish, japanese, modern, mixed chinese-western.
  - [x] Wall palette: `#E8D9A0`/`#D9C77A`/`#C9B06B`/`#F2EDE3`. Roof palette: `#A8322A`/`#8E2A22`/`#B53A2E`, shadow `#6E2018`.
  - [x] Per-instance slight random rotation/scale so no two villas alike.
  - [x] Place ~6–8 villas along road-grid blocks, set back behind garden walls.
- [x] `src/scene/landmarks.js`: `createLandmarks()` → `{ group }`:
  - [x] **Huashi Building (花石楼)** — 5-floor European medieval castle at Second Bathing Beach; granite/cobblestone walls `#B8B0A4`/`#9A9088`; Roman+Gothic traces; crenellated observation deck; corner turrets. Highest detail.
  - [x] **Princess Building (公主楼)** — Danish style at Juyongguan Road position; steep gable, white trim, fairytale proportions.
  - [x] (Stretch) No.1 / No.5 Shanhaiguan Road, Butterfly Building, Han Fuju Villa, Small Auditorium — if budget allows, else generic variants.
- [x] **Build gate:** create a throwaway `debug/villas.html` (uncommitted, under `debug/`) importing only `createVillas`/`createLandmarks` into its own Scene+renderer — Huashi castle + Princess villa + variants visible; no console errors. **Do NOT touch `src/main.js`.** Delete the debug file before commit.

---

## Chunk 4 — Vegetation

**Owned files:** `src/scene/vegetation.js`
**Dependency:** Chunk 1
**Parallel?** Yes (after Chunk 1) — disjoint file scope. **MUST NOT touch `src/main.js`.**

### Tasks
- [x] `src/scene/vegetation.js`: `createVegetation()` → `{ group }`:
  - [x] Tree avenue system — one species per road per brief:
    - [x] Shaoguan Road → flowering peach (pink `#E8A8B0`).
    - [x] Zhengyangguan Road → crape myrtle (purple `#8E5A8E`).
    - [x] Juyongguan Road → five-leaf maple (autumn red `#B8322A`/`#9E2A22`).
    - [x] Zijingguan Road → cedar (evergreen `#3E5E3E`/`#2E4A2E`).
    - [x] Ningwuguan Road → crabapple (pink `#E8A8B0`).
    - [x] Remaining roads → ginkgo (autumn gold `#E8B84A`/`#D4A02A`) + pine/cypress accents.
  - [x] **InstancedMesh** per species (trunk mesh + canopy mesh); bark `#5E4A3E`.
  - [x] Rows flanking each road, ~8u spacing, slight height/rotation jitter.
  - [x] Call `computeBoundingSphere()` after setting instance matrices; `frustumCulled = true` (default).
  - [x] Shrub clusters at villa gardens.
  - [x] Low garden walls around villa plots (warm stone, ~1.2u tall, permeable styling).
- [x] **Build gate:** create a throwaway `debug/vegetation.html` (uncommitted, under `debug/`) importing only `createVegetation` into its own Scene+renderer — InstancedMesh avenues per road species visible; `computeBoundingSphere()` called; no console errors. **Do NOT touch `src/main.js`.** Delete the debug file before commit.

---

## Chunk 5 — Lighting + Postprocessing + Integration + Mood

**Owned files:** `src/scene/lighting.js`, `src/scene/postprocessing.js`, **`src/main.js`** (integration of parallel wave 2/3/4)
**Dependency:** Chunks 2, 3, 4 (parallel wave complete)
**Parallel?** Sequential — sole writer of `main.js` at this stage.

### Tasks
- [x] `src/scene/lighting.js`: `createLighting(renderer)` → `{ lights, update? }`:
  - [x] `DirectionalLight` low golden-hour sun: color ~`#E8B870`, position from `SUN_DIRECTION` (import `src/config/sun.js`), `castShadow = true`.
  - [x] `renderer.shadowMap.enabled = true`; `renderer.shadowMap.type = THREE.PCFShadowMap` (NOT `PCFSoftShadowMap` — deprecated r182+).
  - [x] `shadow.mapSize` 2048²; tune `shadow.camera` near/far/left/right to scene bounds (~400u).
  - [x] `HemisphereLight` warm sky / green ground + low `AmbientLight` — ALL lighting owned here (Chunk 2 created none).
  - [x] `renderer.toneMapping = THREE.ACESFilmicToneMapping`; `toneMappingExposure` ~1.0–1.1.
- [x] `src/scene/postprocessing.js`: `createPostprocessing(renderer)` → effect passes:
  - [x] `UnrealBloomPass` — subtle (golden roof/sea highlights, not neon).
  - [x] **OutputPass intentionally OMITTED** — r184 `renderer.setEffects()` applies ACES tone mapping + sRGB color space automatically; including OutputPass would double-apply and log a warning. (Source-verified in three.module.js.)
  - [x] Return `[bloomPass]` for `renderer.setEffects([...])` (r180+ API). Renderer constructed with `outputBufferType: THREE.HalfFloatType` (required for setEffects to function — default UnsignedByteType silently no-ops).
- [x] **Integrate parallel modules into `src/main.js`** (the dedicated integration sub-step):
  - [x] Import `createTerrain`, `createSea`, `createSky`, `createVillas`, `createLandmarks`, `createVegetation`.
  - [x] Call each; add `result.group` to the scene; if `result.fog` present, assign `scene.fog = result.fog`; keep `terrain.getHeight` reference for Chunk 6.
  - [x] Register `result.update(dt)` functions (sea, sky, any animated) in the render loop.
  - [x] Import + apply `createLighting(renderer)` (add `lights` to scene) and `createPostprocessing(renderer)`; call `renderer.setEffects([bloomPass, outputPass])`.
  - [x] Final fog density tuning against the lit scene (fog `#D9D4C8`).
- [x] **Build gate:** dev server shows the full scene together — terrain + roads + sea + sky + villas + Huashi castle + tree avenues + golden-hour sun + long shadows + bloom + ACES tone mapping + fog; no console errors.

---

## Chunk 6 — Player Controls

**Owned files:** `src/controls/player.js`, **`src/main.js`** (wire controls)
**Dependency:** Chunk 5
**Parallel?** Sequential — sole writer of `main.js`.

### Tasks
- [x] `src/controls/player.js`: `createPlayer(camera, renderer, terrain)` → `{ controls, update(dt) }` where `terrain` is the `{ group, getHeight }` object from Chunk 2/5:
  - [x] `new PointerLockControls(camera, renderer.domElement)` — domElement mandatory (r184).
  - [x] Use `controls.object` (NOT `getObject()` — removed).
  - [x] WASD movement (forward/back/strafe); `Shift` sprint; optional `Space` jump / `Ctrl` crouch.
  - [x] Movement speed ~8 u/s walk, ~18 u/s sprint; default mouse sensitivity.
  - [x] **Bounds**: clamp to terrain extent; keep Y at `terrain.getHeight(x, z) + eyeLevel` each frame; prevent walking past beach line into sea; optional AABB collision vs villa bounding boxes.
  - [x] `update(dt)` integrates velocity + bounds.
- [x] Wire into `src/main.js`: instantiate player, call `update(dt)` in render loop, handle pointer-lock enter/exit.
- [x] **Build gate:** click canvas → pointer lock; WASD moves; mouse looks; player bounded by terrain; cannot walk into sea; no console errors.

---

## Chunk 7 — UI Overlay

**Owned files:** `src/ui/overlay.js`, `src/ui/styles.css`, **`src/main.js`** (wire UI)
**Dependency:** Chunk 6
**Parallel?** Sequential — sole writer of `main.js`.

### Tasks
- [x] `src/ui/styles.css`: overlay styling — translucent warm panels, full-viewport, unobtrusive; intro + HUD + minimap styles.
- [x] `src/ui/overlay.js`: `createOverlay(player, landmarks)` → `{ update(dt) }`:
  - [x] Intro screen: "Click to enter" — requests pointer lock on click; fades out.
  - [x] HUD: current location name (nearest road/landmark detection), controls hint (WASD / mouse / Shift / Esc).
  - [x] Optional minimap: top-down canvas dot for player + landmarks.
  - [x] Handle `pointerlockchange` / `pointerlockerror`: Esc releases lock → show overlay; error → show retry message.
- [x] Wire into `src/main.js`: import overlay CSS, instantiate overlay, call `update(dt)` in render loop.
- [x] **Build gate:** intro "click to enter" overlay appears; click → pointer lock + overlay fades; HUD shows location name + controls hint; Esc releases lock and shows overlay; no console errors.

---

## Final Gate

Run after Chunk 7 is complete.

- [x] `bun run dev` serves the full scene; **no console errors or warnings**.
- [x] Pointer lock + WASD + mouse-look work; player bounded by terrain; cannot enter sea.
- [x] **Golden-hour mood visible**: warm low sun, long shadows, golden ginkgo/maple avenues, red-tile/cream-wall villas, Huashi castle on the beach, sea mist fog, bloom on roof/sea highlights.
- [x] Each road shows its **distinct tree species** (peach/crape myrtle/maple/cedar/crabapple/ginkgo).
- [x] HUD shows location name + controls hint; intro overlay works; Esc releases pointer.
- [x] **r184 API usage reviewed**: `renderer.setEffects([...])` with `outputBufferType: HalfFloatType`, `PCFShadowMap` (not `PCFSoftShadowMap`), `controls.object` (not `getObject()`), OutputPass intentionally omitted (setEffects auto-applies tone mapping), `PointerLockControls(camera, renderer.domElement)`.
- [x] `PLAN.md` + `CHECKLIST.md` reflect final state (all boxes checked).
