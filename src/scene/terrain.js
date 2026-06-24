import * as THREE from 'three';

// ──────────────────────────────────────────────────────────────────────────
// Chunk 2 — Terrain, shoreline, beach, road grid, lawns.
// createTerrain() → { group, getHeight, roads }
// ──────────────────────────────────────────────────────────────────────────

// Layout constants ----------------------------------------------------------
const TERRAIN_SIZE = 400;          // ground plane 400×400, centred on origin
const SHORE_BASE_Z = -130;         // nominal shoreline on the south edge
const RISE_RATE = 0.035;           // gentle northward (+Z) rise per unit
const ROAD_WIDTH = 6;              // pass-named road width
const ROAD_RAISE = 0.22;           // roads sit this far above ground
const LAWN_RAISE = 0.09;           // lawns sit this far above ground
const BEACH_RAISE = 0.07;          // beach sand sits this far above ground

// Huashi Building / Second Bathing Beach pad (southwest) -------------------
const HUASHI = { x: -95, z: -118, r: 38 };

// Road grid ----------------------------------------------------------------
// 3 north-south roads (fixed X, run along Z).
const NS_ROADS = [
  { name: 'Zijingguan', species: 'cedar',       x: -60 },
  { name: 'Ningwuguan', species: 'crabapple',   x:   0 },
  { name: 'Shaoguan',   species: 'peach',       x:  60 },
];
// 7 east-west roads (fixed Z, run along X).
const EW_ROADS = [
  { name: 'Wushengguan',    species: 'ginkgo',       z:  -80 },
  { name: 'Jiayuguan',      species: 'ginkgo',       z:  -50 },
  { name: 'Hanguguan',      species: 'ginkgo',       z:  -20 },
  { name: 'Zhengyangguan',  species: 'crape-myrtle', z:   10 },
  { name: 'Linhuai',        species: 'ginkgo',       z:   40 },
  { name: 'Juyongguan',     species: 'maple',        z:   70 },
  { name: 'Shanhaiguan',    species: 'ginkgo',       z:  100 },
];
// Extent of the road grid (roads span these ranges).
const NS_Z_FROM = -95;
const NS_Z_TO = 115;
const EW_X_FROM = -90;
const EW_X_TO = 90;

// ── Height field ───────────────────────────────────────────────────────────

// Smooth S-curve shoreline along the south (negative Z) — the Taiping Bay
// land/sea boundary. A compound sine gives a gentle, natural S-bend.
export function shorelineZ(x) {
  return SHORE_BASE_Z + 10 * Math.sin(x * 0.010) - 6 * Math.sin(x * 0.022 + 1.0);
}

// Width of the beach sand strip at a given X. Wider on the southwest where
// the Second Bathing Beach (and Huashi Building) sits.
function beachWidth(x) {
  let w = 14;
  if (x < -40) {
    // smoothstep: 1 at x=-40, 0 at x=-120 → widens toward the far southwest.
    const t = THREE.MathUtils.smoothstep(x, -120, -40);
    w = 14 + (1 - t) * 28; // up to ~42 units on the Second Bathing Beach
  }
  return w;
}

// Low-frequency rolling displacement (amplitude ~5) + gentle linear rise to
// the north. Damped near/under the water so the shoreline stays smooth, and
// flattened around the Huashi pad so the landmark has a level platform.
function heightAt(x, z) {
  const shore = shorelineZ(x);
  const base = (z - shore) * RISE_RATE;            // 0 at shoreline, +inland
  const disp =
    3.5 * Math.sin(x * 0.012) * Math.cos(z * 0.010) +
    2.0 * Math.cos(x * 0.020 + z * 0.015);
  const damp = THREE.MathUtils.smoothstep(base, -2, 6); // 0 underwater → 1 inland
  let h = base + disp * damp;

  // Flat pad for Huashi Building on the Second Bathing Beach.
  const dx = x - HUASHI.x, dz = z - HUASHI.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const flat = 1 - THREE.MathUtils.smoothstep(dist, HUASHI.r * 0.55, HUASHI.r);
  h = h * (1 - flat) + 1.0 * flat;                  // blend to a 1.0u platform

  return h;
}

// Exported sampler for the player Y-bounds (Chunk 6) — matches the displaced
// geometry exactly because both share `heightAt`.
function getHeight(x, z) {
  return heightAt(x, z);
}

// ── Geometry helpers ───────────────────────────────────────────────────────

// Ground plane displaced to the height field.
function buildGround() {
  const seg = 140;
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, seg, seg);
  geo.rotateX(-Math.PI / 2);                        // lay flat in XZ
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: 0x8a7a5e,                                // warm soil/base
    roughness: 0.95,
    metalness: 0.0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  return mesh;
}

// Beach sand strip following the shoreline S-curve, displaced to terrain.
function buildBeach() {
  const samples = 160;
  const xFrom = -TERRAIN_SIZE / 2, xTo = TERRAIN_SIZE / 2;
  const positions = [];
  const indices = [];
  for (let i = 0; i <= samples; i++) {
    const x = xFrom + (xTo - xFrom) * (i / samples);
    const shore = shorelineZ(x);
    const w = beachWidth(x);
    const zWater = shore - 5;                       // a little into the sea
    const zLand = shore + w;                        // inland edge
    positions.push(x, heightAt(x, zWater) + BEACH_RAISE, zWater);
    positions.push(x, heightAt(x, zLand) + BEACH_RAISE, zLand);
  }
  for (let i = 0; i < samples; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: 0xD9C9A0,                                // sand #D9C9A0
    roughness: 0.9,
    metalness: 0.0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'beach';
  return mesh;
}

// A road built as a terrain-following strip (displaced plane), slightly raised.
// axis 'x' → east-west road (x varies, z fixed); axis 'z' → north-south road.
function buildRoadStrip(axis, fixed, from, to, width, color) {
  const segments = 48;
  const positions = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = from + (to - from) * t;
    const cx = axis === 'x' ? a : fixed;
    const cz = axis === 'z' ? a : fixed;
    if (axis === 'x') {
      positions.push(cx, heightAt(cx, cz - width / 2) + ROAD_RAISE, cz - width / 2);
      positions.push(cx, heightAt(cx, cz + width / 2) + ROAD_RAISE, cz + width / 2);
    } else {
      positions.push(cx - width / 2, heightAt(cx - width / 2, cz) + ROAD_RAISE, cz);
      positions.push(cx + width / 2, heightAt(cx + width / 2, cz) + ROAD_RAISE, cz);
    }
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.85,
    metalness: 0.0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

// Lawn block filling one grid cell (flat patch at terrain height).
function buildLawnBlock(x0, x1, z0, z1) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const w = (x1 - x0) - ROAD_WIDTH * 0.5;
  const d = (z1 - z0) - ROAD_WIDTH * 0.5;
  if (w <= 1 || d <= 1) return null;
  const geo = new THREE.PlaneGeometry(w, d);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x6E8E4E,                                // lawn #6E8E4E
    roughness: 0.9,
    metalness: 0.0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(cx, heightAt(cx, cz) + LAWN_RAISE, cz);
  mesh.receiveShadow = true;
  return mesh;
}

// ── Road layout (exported for Chunk 4 vegetation) ──────────────────────────

function buildRoads(group) {
  const roads = [];
  const stoneA = 0xB8A88E;                         // warm stone #B8A88E
  const stoneB = 0xA8987A;                         // #A8987A

  // North-south roads (run along Z at a fixed X).
  for (let i = 0; i < NS_ROADS.length; i++) {
    const r = NS_ROADS[i];
    const color = i % 2 === 0 ? stoneA : stoneB;
    const mesh = buildRoadStrip('z', r.x, NS_Z_FROM, NS_Z_TO, ROAD_WIDTH, color);
    mesh.name = `road-${r.name}`;
    group.add(mesh);
    roads.push({
      name: r.name,
      species: r.species,
      direction: 'north-south',
      start: { x: r.x, z: NS_Z_FROM },
      end:   { x: r.x, z: NS_Z_TO },
    });
  }

  // East-west roads (run along X at a fixed Z).
  for (let i = 0; i < EW_ROADS.length; i++) {
    const r = EW_ROADS[i];
    const color = i % 2 === 0 ? stoneA : stoneB;
    const mesh = buildRoadStrip('x', r.z, EW_X_FROM, EW_X_TO, ROAD_WIDTH, color);
    mesh.name = `road-${r.name}`;
    group.add(mesh);
    roads.push({
      name: r.name,
      species: r.species,
      direction: 'east-west',
      start: { x: EW_X_FROM, z: r.z },
      end:   { x: EW_X_TO, z: r.z },
    });
  }

  return roads;
}

// Lawn blocks between roads (fill the grid cells).
function buildLawns(group) {
  // X boundaries of grid columns (N-S road positions + outer edges).
  const xCols = [EW_X_FROM, -60, 0, 60, EW_X_TO];
  // Z boundaries of grid rows (E-W road positions).
  const zRows = EW_ROADS.map(r => r.z);
  // Add outer z edges so the first/last rows also get lawns.
  const zBounds = [zRows[0] - 30, ...zRows, zRows[zRows.length - 1] + 30];

  for (let i = 0; i < xCols.length - 1; i++) {
    for (let j = 0; j < zBounds.length - 1; j++) {
      const block = buildLawnBlock(xCols[i], xCols[i + 1], zBounds[j], zBounds[j + 1]);
      if (block) {
        block.name = `lawn-${i}-${j}`;
        group.add(block);
      }
    }
  }
}

// ── Factory ────────────────────────────────────────────────────────────────

export function createTerrain() {
  const group = new THREE.Group();
  group.name = 'terrain';

  group.add(buildGround());
  group.add(buildBeach());
  const roads = buildRoads(group);
  buildLawns(group);

  return { group, getHeight, roads };
}
