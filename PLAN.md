# PLAN.md — Qingdao Badaguan Three.js Virtual Landscape

> Durable implementation plan. Verified against `'/root/.omp/agent/sessions/-gitfiles-Recursive-Self-Improving-qingdao-badaguan-threejs-glm-5.2/2026-06-24T05-18-41-390Z_019ef810-f4ee-7000-868d-3a8374cf1273/local/context-brief.md'` (place facts, three.js r184 API facts, color palette, toolchain). Implementation has NOT started.

## 1. Goal

Build a beautiful, atmospheric **interactive three.js virtual landscape** of Qingdao Badaguan (青岛八大关), the "Museum of World Architecture" scenic area on Taiping Bay. The page must:

- Render a real, recognizable Badaguan: red-tile/cream-wall villas along a grid of pass-named roads, each road lined with a distinct tree species, the Huashi Building castle beside the Second Bathing Beach, Taiping Bay sea to the south, Taiping Mountain rising gently to the north.
- Let the player **freely move (WASD) and rotate view (pointer-lock mouse)** through the scene, with terrain-bounded collision.
- Convey the **real atmosphere**: a golden-hour autumn afternoon with light sea mist — warm low sun, long shadows, golden ginkgo and red maple avenues, soft fog rolling over the bay.
- Be a single-page Vite app, plain JS ES modules, no TypeScript.

## 2. Tech stack decision

| Concern | Decision | Rationale |
|---|---|---|
| Renderer | three@**0.184.0** (r184) | Current npm latest; brief-verified. |
| Bundler | vite@**8.1.0** | Current npm latest; zero-config ESM dev server. |
| Language | **Plain JS (ES modules)**, no TypeScript | Small single-page scene; brief mandates this. |
| Package manager | **bun** (bun 1.3.14) for install/run; node v24.16.0 as fallback runtime | Brief-verified toolchain. `bun install`, `bun run dev`. |
| Postprocessing | `WebGLRenderer.setEffects([...])` (r180+ API) with `UnrealBloomPass` + `OutputPass` | Replaces legacy `EffectComposer` pipeline per r184 facts. |
| Shadows | `THREE.PCFShadowMap` (now soft by default) | `PCFSoftShadowMap` deprecated r182+. |
| Controls | `PointerLockControls` from `three/addons/controls/PointerLockControls.js` | First-person walk; `controls.object` (not `getObject()`). |
| Water | `Water` from `three/addons/objects/Water.js` | Planar sea surface with golden-hour reflections. |
| Sky | `Sky` from `three/addons/objects/Sky.js` | r180+ gamma-corrected shader (cannot restore legacy look — accepted). |

## 3. File / module structure

```
qingdao-badaguan-threejs-glm-5.2/
├── package.json              # Chunk 1
├── vite.config.js            # Chunk 1
├── index.html                # Chunk 1
├── .gitignore                # Chunk 1
├── PLAN.md                   # (this file)
├── CHECKLIST.md              # progress tracker
└── src/
    ├── config/
    │   └── sun.js            # Chunk 1 — shared sun direction + elevation constant (single source of truth for sea/sky/light)
    ├── main.js               # Chunk 1 scaffold; SHARED integration point (see §6)
    ├── scene/
    │   ├── terrain.js        # Chunk 2 — ground, shoreline, beach, roads
    │   ├── sea.js            # Chunk 2 — Water + FogExp2 base
    │   ├── sky.js            # Chunk 2 — Sky shader + sun position
    │   ├── villas.js         # Chunk 3 — procedural villa generator + variants
    │   ├── landmarks.js      # Chunk 3 — Huashi Building, Princess Building
    │   ├── vegetation.js     # Chunk 4 — tree avenues (InstancedMesh), lawns, walls
    │   ├── lighting.js       # Chunk 5 — DirectionalLight, hemisphere, shadows
    │   └── postprocessing.js # Chunk 5 — bloom + OutputPass via setEffects
    ├── controls/
    │   └── player.js         # Chunk 6 — PointerLockControls WASD + bounds
    └── ui/
        ├── overlay.js        # Chunk 7 — intro screen, HUD, location name
        └── styles.css        # Chunk 7 — overlay styling
```

Each scene module exports a single `create*()` factory returning a structured object — NOT a bare `THREE.Group` — so cross-chunk handoffs (fog, height sampler, sun direction, lights) have defined slots. The canonical return shape is `{ group, update?, fog?, getHeight?, lights? }` where only `group` is always present and the rest are optional per module:
- `group` (`THREE.Group`): the scene graph subtree to add.
- `update(dt)` (function, optional): per-frame animation (sea, sky, etc.).
- `fog` (`THREE.FogExp2`, optional): scene fog to assign as `scene.fog` at integration (Chunk 5). Fog is NOT an Object3D and cannot live in a Group.
- `getHeight(x, z) => number` (function, optional): terrain height sampler for player Y-bounds (Chunk 6 calls this each frame).
- `lights` (array of `THREE.Light`, optional): lights created by this module that a later module may mutate (e.g. Chunk 5 refines Chunk 2's hemisphere light) — prevents duplicate lights.
`main.js` imports each factory, calls it, adds `group` to the scene, assigns `scene.fog` if present, registers `update(dt)` in the render loop, and passes `lights` to the lighting module for refinement.

## 4. Scene composition

### 4.1 Terrain + shoreline (Chunk 2)
- Large ground plane (~400×400 units) with a gentle northward rise representing the southern foot of Taiping Mountain (low-frequency displacement, not a full mountain — Badaguan is flat-to-gentle).
- **Taiping Bay shoreline curve**: a smooth S-curve along the south edge defining land/sea boundary; beach sand strip (`#D9C9A0`/`#C9B688`) between land and water.
- **Second Bathing Beach**: a wider sand arc on the southwest, where Huashi Building sits.
- **Road grid**: the 10 pass-named roads as warm-stone paths (`#B8A88E`/`#A8987A`) on a grid. North-south roads: Zijingguan, Ningwuguan, Shaoguan. East-west: Wushengguan, Jiayuguan, Hanguguan, Zhengyangguan, Linhuai, Juyongguan, Shanhaiguan. Grid spacing ~30 units; road width ~6 units.
- Lawns fill the blocks between roads (`#6E8E4E`/`#5E7E42`).

### 4.2 Sea + sky + atmosphere base (Chunk 2)
- **Shared sun config** (`src/config/sun.js`, created in Chunk 1): exports a single `SUN_DIRECTION` (THREE.Vector3, low golden-hour elevation ~10°, warm azimuth) and derived `SUN_ELEVATION`/`SUN_AZIMUTH`. This is the ONE source of truth — Chunk 2 sea/sky and Chunk 5 lighting both import it so reflections, sky, and shadows stay in sync.
- `Water` object for Taiping Bay: planar geometry covering the south, color gradient `#2E5E6E`→`#4E8E9E` with golden highlights `#C9A85A` driven by `SUN_DIRECTION`. **Water normals**: generate a procedural `DataTexture` at runtime (small ripple normal map) — the examples `waternormals.jpeg` is NOT shipped in the npm `three` package, so do not import it. Record this in CHECKLIST.
- `Sky` shader with sun position from `SUN_DIRECTION` (low, warm). Horizon `#E8B870` → zenith `#4E7EA0`.
- `FogExp2` with warm grey-cream color `#D9D4C8`, density tuned so the far sea/villas melt into mist but near avenues stay crisp. Returned via the `fog` slot of `createSky()`'s return object (NOT added to the group — assigned as `scene.fog` at integration).
- **No lights in Chunk 2.** All lighting (HemisphereLight, AmbientLight, DirectionalLight) is owned by Chunk 5's `createLighting()` to avoid duplicate lights. Chunk 2 only creates geometry + fog + sky.

### 4.3 Villas (Chunk 3)
- **Procedural villa generator** (`villas.js`): parametric — `{ wallColor, roofColor, roofStyle, height, width, depth, windows, style }`. Builds from BoxGeometry walls + roof (gable/hipped/flat/turret) + window insets (emissive warm panes for golden-hour glow). Each instance gets slight random rotation/scale so "no two alike".
- **4–6 style variants**: castle (turrets + crenellations), renaissance (symmetrical + pediment), danish (steep gable + white trim), japanese (low + flat roof + green-tile accent), modern (clean box + ribbon windows), mixed chinese-western.
- **Wall palette**: cream/yellow `#E8D9A0`/`#D9C77A`/`#C9B06B`, white `#F2EDE3`. **Roof palette**: `#A8322A`/`#8E2A22`/`#B53A2E`, shadow side `#6E2018`.
- **Placement**: ~6–8 villas distributed along the road grid blocks, set back from roads behind garden walls.

### 4.4 Landmarks (Chunk 3, `landmarks.js`)
- **Huashi Building (花石楼)** — hero landmark at the Second Bathing Beach. 5-floor European medieval castle: granite/cobblestone walls (`#B8B0A4`/`#9A9088`), Roman+Gothic traces, crenellated observation deck, corner turrets. Highest-detail model in the scene.
- **Princess Building (公主楼)** — Danish style at Juyongguan Road position; steep gable, white trim, Andersen-fairytale proportions.
- (Optional lower priority: No.1/No.5 Shanhaiguan Road, Butterfly Building, Han Fuju Villa, Small Auditorium — model if budget allows, else represent with generic variants.)

### 4.5 Vegetation (Chunk 4)
- **Tree avenue system**: one species per road, mapped per the brief:
  - Shaoguan Road → flowering peach (pink `#E8A8B0` blossoms)
  - Zhengyangguan Road → crape myrtle (purple `#8E5A8E`)
  - Juyongguan Road → five-leaf maple (autumn red `#B8322A`/`#9E2A22`)
  - Zijingguan Road → cedar (evergreen `#3E5E3E`/`#2E4A2E`)
  - Ningwuguan Road → crabapple (pink `#E8A8B0`)
  - Remaining roads → ginkgo (autumn gold `#E8B84A`/`#D4A02A`) as the signature golden avenue + pine/cypress accents
- **InstancedMesh** per species (trunk + canopy meshes) for performance; `computeBoundingSphere()` after instance updates; `frustumCulled = true` (default).
- Trees placed in rows flanking each road, ~8-unit spacing, slight height/rotation jitter.
- **Lawns**: ground-cover patches already in terrain; vegetation adds shrub clusters at villa gardens.
- **Garden walls**: low perimeter walls around villa plots (warm stone, ~1.2 units tall, permeable styling).

### 4.6 Lighting + mood (Chunk 5)
- **DirectionalLight** as the low golden-hour sun: warm color (~`#E8B870`), low elevation (~8–12°), long shadow camera covering the scene, `castShadow = true`.
- `HemisphereLight` warm sky / green ground + low `AmbientLight` — ALL lighting owned here in Chunk 5 (none in Chunk 2).
- `renderer.toneMapping = THREE.ACESFilmicToneMapping`; `toneMappingExposure` ~1.0–1.1.
- **Postprocessing** (`postprocessing.js`): `UnrealBloomPass` (subtle — golden roof/sea highlights, not neon) + `OutputPass` for tone mapping + color space, passed via `renderer.setEffects([bloomPass, outputPass])`. (Inline tone mapping does not work with postprocessing — `OutputPass` handles it.)
- Final fog density tuning against the lit scene.

### 4.7 Player controls (Chunk 6)
- `PointerLockControls(camera, renderer.domElement)` — domElement mandatory (r184).
- WASD movement (forward/back/strafe), `Shift` to sprint, optional `Space` jump / `Ctrl` crouch.
- **Bounds**: clamp player to the terrain extent; keep Y at terrain height + eye level (sample terrain height under player); prevent walking into the sea beyond the beach line; optional simple AABB collision against villa bounding boxes.
- Movement speed ~8 units/s walk, ~18 sprint; mouse sensitivity default.
- `update(dt)` integrates velocity and bounds.

### 4.8 UI overlay (Chunk 7)
- **Intro screen**: "Click to enter" — requests pointer lock on click; fades out.
- **HUD**: current location name (detected by nearest road/landmark), controls hint (WASD / mouse / Shift / Esc), optional simple minimap (top-down canvas dot for player + landmarks).
- `overlay.js` manages DOM + pointer-lock enter/exit events; `styles.css` for the overlay look (translucent warm panels, unobtrusive).

## 5. Mood & color palette (from brief)

**Mood**: golden-hour autumn afternoon with light sea mist.

**Palette (hex)** — single source of truth for all materials:
- Villa walls cream/yellow: `#E8D9A0`, `#D9C77A`, `#C9B06B`; white: `#F2EDE3`
- Red-tile roofs: `#A8322A`, `#8E2A22`, `#B53A2E`; roof shadow: `#6E2018`
- Granite (Huashi): `#B8B0A4`, `#9A9088`
- Ginkgo gold: `#E8B84A`, `#D4A02A`; Maple red: `#B8322A`, `#9E2A22`
- Crape myrtle purple: `#8E5A8E`; Cedar/pine: `#3E5E3E`, `#2E4A2E`; Crabapple pink: `#E8A8B0`
- Grass/lawn: `#6E8E4E`, `#5E7E42`
- Sea: `#2E5E6E`→`#4E8E9E`, golden highlights `#C9A85A`
- Sand: `#D9C9A0`, `#C9B688`
- Sky: horizon `#E8B870` → zenith `#4E7EA0`
- Sea-mist fog: `#D9D4C8`
- Road/path: `#B8A88E`, `#A8987A`
- Tree bark: `#5E4A3E`

## 6. `main.js` integration strategy (parallel-conflict avoidance)

`main.js` is the **shared integration point**. To prevent parallel chunks (2, 3, 4) from editing `main.js` simultaneously and colliding, the rule is:

- **Parallel chunks (2, 3, 4) ONLY create their own module files** (`src/scene/*.js`). They MUST NOT touch `main.js`.
- Each module exports a factory: `createTerrain()`, `createSea()`, `createSky()`, `createVillas()`, `createLandmarks()`, `createVegetation()` — returning the structured object `{ group, update?, fog?, getHeight?, lights? }` per §3 (NOT a bare Group).
- **A dedicated sequential integration sub-step (part of Chunk 5's sequencing, executed after the parallel wave 2/3/4 completes)** wires all parallel modules into `main.js`: imports the factories, calls them, adds groups to the scene, registers `update` functions in the render loop. This is recorded as an explicit task in Chunk 5's checklist ("Integrate parallel scene modules into main.js").
- Subsequent sequential chunks (5 lighting/postprocessing, 6 controls, 7 UI) each update `main.js` in order — never two chunks editing `main.js` at the same time.

This guarantees no parallel file conflicts on `main.js`.

## 7. Implementation chunks (dependency-ordered)

| Chunk | Name | Depends on | Owns files | Parallel? |
|---|---|---|---|---|
| 1 | Project scaffold | — | `package.json`, `vite.config.js`, `index.html`, `src/main.js`, `src/config/sun.js`, `.gitignore` | Sequential (foundation) |
| 2 | Terrain + sea + sky + atmosphere base | 1 | `src/scene/terrain.js`, `src/scene/sea.js`, `src/scene/sky.js` | **Parallel** (after 1) |
| 3 | Villas + landmarks | 1 | `src/scene/villas.js`, `src/scene/landmarks.js` | **Parallel** (after 1) |
| 4 | Vegetation | 1 | `src/scene/vegetation.js` | **Parallel** (after 1) |
| 5 | Lighting + postprocessing + integration + mood | 2,3,4 | `src/scene/lighting.js`, `src/scene/postprocessing.js`, **`src/main.js`** (integration) | Sequential (after parallel wave) |
| 6 | Player controls | 5 | `src/controls/player.js`, **`src/main.js`** (wire controls) | Sequential |
| 7 | UI overlay | 6 | `src/ui/overlay.js`, `src/ui/styles.css`, **`src/main.js`** (wire UI) | Sequential (after 6) |

**Parallelism graph:**
```
Chunk 1 (scaffold)
   │
   ├──> Chunk 2 (terrain/sea/sky)  ┐
   ├──> Chunk 3 (villas/landmarks) ├── parallel wave (disjoint file scope)
   └──> Chunk 4 (vegetation)       ┘
                │
                v
        Chunk 5 (lighting + postprocessing + main.js integration of 2/3/4)
                │
                v
        Chunk 6 (player controls + wire into main.js)
                │
                v
        Chunk 7 (UI overlay + wire into main.js)
```

### Chunk boundaries (reviewable / verifiable / committable)

**Chunk 1 — Scaffold.** Verifiable: `bun install` succeeds; `bun run dev` serves a blank canvas page with no console errors; three@0.184.0 + vite@8.1.0 in `package.json`. Owns the 5 foundation files. `src/main.js` here is a minimal renderer+scene+camera skeleton (no scene content yet).

**Chunk 2 — Terrain/sea/sky.** Verifiable: dev server shows ground plane with road grid, beach, sea surface, sky dome, base fog; no villas/trees yet. Owns 3 scene modules; does NOT touch `main.js`.

**Chunk 3 — Villas/landmarks.** Verifiable: `createVillas()` + `createLandmarks()` return groups; Huashi castle + Princess villa + 4–6 variants visible when temporarily added (or via a debug import). Owns 2 scene modules; does NOT touch `main.js`.

**Chunk 4 — Vegetation.** Verifiable: `createVegetation()` returns a group with InstancedMesh avenues per road species; `computeBoundingSphere()` called. Owns 1 scene module; does NOT touch `main.js`.

**Chunk 5 — Lighting/postprocessing/integration.** Verifiable: golden-hour sun + long shadows + bloom + ACES tone mapping via `setEffects`; **all parallel modules now wired into `main.js`** and visible together; fog tuned. Owns 2 scene modules + `main.js`.

**Chunk 6 — Controls.** Verifiable: click canvas → pointer lock; WASD moves; mouse looks; player bounded by terrain; cannot walk into sea. Owns `src/controls/player.js` + `main.js` wiring.

**Chunk 7 — UI.** Verifiable: intro "click to enter" overlay; HUD shows location name + controls hint; Esc releases pointer and shows overlay. Owns `src/ui/*` + `main.js` wiring.

## 8. Edge cases & error conditions to watch

- **r184 API gotchas**: use `controls.object` not `getObject()`; `renderer.shadowMap.type = THREE.PCFShadowMap` (not `PCFSoftShadowMap`); postprocessing via `setEffects([...])` + `OutputPass` (inline tone mapping won't apply with postprocessing); `PointerLockControls(camera, renderer.domElement)` — domElement mandatory.
- **Sky shader gamma**: r180+ Sky looks different from legacy; cannot restore — accept and tune sun + exposure instead.
- **Water normals**: `Water` needs a normals texture; the examples `waternormals.jpeg` is NOT shipped in the npm `three` package — generate a procedural `THREE.DataTexture` ripple normal map at runtime instead. Ensure `SUN_DIRECTION` drives reflections.
- **InstancedMesh culling**: call `computeBoundingSphere()` after updating instance matrices or distant avenues may vanish.
- **Shadow camera coverage**: scene is ~400 units; shadow camera left/right/top/bottom must cover the villa grid or shadows clip.
- **Pointer lock + iframe**: pointer lock can fail in some embedded contexts; overlay must handle the `pointerlockerror` event gracefully.
- **Terrain height sampling**: player Y must follow terrain displacement; if terrain is displaced, sample the height function under the player each frame.
- **Performance**: bloom + shadows + many instances — keep bloom resolution modest, shadow map 2048², instanced trees; target 60fps on mid GPU.
- **Fog vs sky**: `FogExp2` can wash out the sky dome — tune density so sky still reads above the horizon.

## 9. Verification (per chunk + final gate)

Each chunk's build gate: `bun install` (Chunk 1) then `bun run dev` — page loads with no console errors and the chunk's visible artifact present. No unit tests (visual scene); verification is visual + console-clean + API-correctness review against the r184 facts in the brief.

**Final Gate** (after Chunk 7):
- `bun run dev` serves the full scene; no console errors/warnings.
- Pointer lock + WASD + mouse-look work; player bounded.
- Golden-hour mood visible: warm low sun, long shadows, golden ginkgo/maple avenues, red-tile/cream-wall villas, Huashi castle on the beach, sea mist fog, bloom on roof/sea highlights.
- Each road shows its distinct tree species.
- HUD shows location name + controls hint; intro overlay works.
- r184 API usage reviewed: `setEffects`, `PCFShadowMap`, `controls.object`, `OutputPass`, `PointerLockControls(camera, domElement)`.

## 10. Critical files the implementer must read

- `'/root/.omp/agent/sessions/-gitfiles-Recursive-Self-Improving-qingdao-badaguan-threejs-glm-5.2/2026-06-24T05-18-41-390Z_019ef810-f4ee-7000-868d-3a8374cf1273/local/context-brief.md'` — all place facts, API facts, palette (already the source of truth for this plan).
- `PLAN.md` (this file) — chunk boundaries, integration strategy, palette.
- `CHECKLIST.md` — per-chunk task checkboxes.
- three.js r184 docs: `WebGLRenderer.setEffects`, `PointerLockControls`, `Sky`, `Water`, `UnrealBloomPass`, `OutputPass`, `FogExp2` — confirm signatures before use.
