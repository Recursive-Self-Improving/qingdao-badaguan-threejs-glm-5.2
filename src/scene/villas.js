import * as THREE from 'three';

// Chunk 3 — Villas. Procedural villa generator + ~6-8 placed instances.
// Does NOT touch main.js. Exports createVilla(opts) and createVillas() -> { group }.
//
// Palette (from context-brief.md / PLAN.md):
//   Walls:  #E8D9A0 / #D9C77A / #C9B06B / #F2EDE3
//   Roofs:  #A8322A / #8E2A22 / #B53A2E, shadow side #6E2018
//   Window glow: #E8B870 (emissive warm, golden-hour)
//   Japanese green-tile accent: #3E5E3E

const WALL_PALETTE = [0xe8d9a0, 0xd9c77a, 0xc9b06b, 0xf2ede3];
const ROOF_PALETTE = [0xa8322a, 0x8e2a22, 0xb53a2e];
const ROOF_SHADOW = 0x6e2018;
const WINDOW_GLOW = 0xe8b870;
const JP_TILE = 0x3e5e3e;

// ---- helpers ---------------------------------------------------------------

function mat(color, { roughness = 0.8, metalness = 0.0 } = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function shadow(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Reusable box maker.
function box(w, h, d, material, { x = 0, y = 0, z = 0, rx = 0, rz = 0 } = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.rotation.x = rx;
  m.rotation.z = rz;
  return shadow(m);
}

// Gable roof: two slanted boxes meeting at a ridge.
function gableRoof(width, depth, height, roofMat, shadowMat) {
  const g = new THREE.Group();
  const slope = Math.atan2(height, depth / 2);
  const slabW = Math.hypot(height, depth / 2) + 0.05;
  const left = box(width + 0.2, 0.18, slabW, roofMat, {
    x: 0,
    y: height / 2,
    z: -depth / 4,
    rx: -slope,
  });
  const right = box(width + 0.2, 0.18, slabW, shadowMat, {
    x: 0,
    y: height / 2,
    z: depth / 4,
    rx: slope,
  });
  g.add(left, right);
  // ridge cap
  g.add(box(width + 0.25, 0.12, 0.18, roofMat, { x: 0, y: height + 0.05, z: 0 }));
  return g;
}

// Hipped roof: a pyramid (ConeGeometry with 4 segments) over the body.
function hippedRoof(width, depth, height, roofMat) {
  const g = new THREE.Group();
  const radius = Math.max(width, depth) * 0.62;
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(radius, height, 4, 1),
    roofMat,
  );
  cone.rotation.y = Math.PI / 4;
  cone.scale.set(width / radius, 1, depth / radius);
  cone.position.y = height / 2;
  g.add(shadow(cone));
  return g;
}

// Flat roof: a thin slab with a slight parapet lip.
function flatRoof(width, depth, roofMat) {
  const g = new THREE.Group();
  g.add(box(width + 0.2, 0.2, depth + 0.2, roofMat, { y: 0.1 }));
  // parapet
  const p = 0.12;
  g.add(box(width + 0.2, p, p, roofMat, { y: 0.26, z: -depth / 2 }));
  g.add(box(width + 0.2, p, p, roofMat, { y: 0.26, z: depth / 2 }));
  g.add(box(p, p, depth + 0.2, roofMat, { y: 0.26, x: -width / 2 }));
  g.add(box(p, p, depth + 0.2, roofMat, { y: 0.26, x: width / 2 }));
  return g;
}

// Turret: a cylinder + cone cap.
function turret(radius, height, wallMat, roofMat) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 12),
    wallMat,
  );
  body.position.y = height / 2;
  g.add(shadow(body));
  const cap = new THREE.Mesh(
    new THREE.ConeGeometry(radius + 0.15, radius * 1.6, 12),
    roofMat,
  );
  cap.position.y = height + radius * 0.8;
  g.add(shadow(cap));
  return g;
}

// Crenellation ring: small box merlons around a rectangular deck.
function crenellations(width, depth, merlonMat, { merlon = 0.3, gap = 0.3, h = 0.4 } = {}) {
  const g = new THREE.Group();
  const step = merlon + gap;
  const perim = (len) => Math.max(2, Math.round(len / step));
  const place = (len, axis, fixedVal) => {
    const n = perim(len);
    const start = -len / 2 + step / 2;
    for (let i = 0; i < n; i++) {
      const pos = start + i * step;
      const m = box(merlon, h, merlon, merlonMat);
      if (axis === 'x') m.position.set(pos, h / 2, fixedVal);
      else m.position.set(fixedVal, h / 2, pos);
      g.add(m);
    }
  };
  place(width, 'x', -depth / 2 + merlon / 2);
  place(width, 'x', depth / 2 - merlon / 2);
  place(depth, 'z', -width / 2 + merlon / 2);
  place(depth, 'z', width / 2 - merlon / 2);
  return g;
}

// Window inset: a small emissive box sunk slightly into a wall + a frame.
function windowInset(w, h, wallMat, { frame = 0.08 } = {}) {
  const g = new THREE.Group();
  const pane = box(
    w,
    h,
    0.06,
    new THREE.MeshStandardMaterial({
      color: WINDOW_GLOW,
      emissive: WINDOW_GLOW,
      emissiveIntensity: 0.9,
      roughness: 0.4,
    }),
    { z: 0.04 },
  );
  const fr = box(w + frame, h + frame, 0.04, wallMat, { z: 0.0 });
  g.add(fr, pane);
  return g;
}

// Distribute windows on the four walls of a body.
function addWindows(group, width, depth, height, wallMat, density) {
  if (!density) return;
  const wW = 0.7;
  const wH = 1.0;
  const floors = Math.max(1, Math.round(height / 2.2));
  const perSide = Math.max(1, Math.round(Math.min(width, depth) / 2.5));
  const yBase = 0.9;
  for (let f = 0; f < floors; f++) {
    const y = yBase + f * 2.2;
    if (y > height - 0.6) break;
    for (let i = 0; i < perSide; i++) {
      const x = -((perSide - 1) / 2) * 2.4 + i * 2.4;
      const z = -((perSide - 1) / 2) * 2.4 + i * 2.4;
      const wA = windowInset(wW, wH, wallMat);
      wA.position.set(x, y, depth / 2);
      group.add(wA);
      const wB = windowInset(wW, wH, wallMat);
      wB.position.set(x, y, -depth / 2);
      wB.rotation.y = Math.PI;
      group.add(wB);
      const wC = windowInset(wW, wH, wallMat);
      wC.position.set(width / 2, y, z);
      wC.rotation.y = Math.PI / 2;
      group.add(wC);
      const wD = windowInset(wW, wH, wallMat);
      wD.position.set(-width / 2, y, z);
      wD.rotation.y = -Math.PI / 2;
      group.add(wD);
    }
  }
}

// Pediment: a triangular gable-end above an entrance (renaissance).
function pediment(width, height, m) {
  const g = new THREE.Group();
  const tri = new THREE.Mesh(
    new THREE.CylinderGeometry(width * 0.55, width * 0.55, 0.2, 3, 1),
    m,
  );
  tri.rotation.x = Math.PI / 2;
  tri.rotation.z = Math.PI / 6;
  tri.scale.set(1, 1, height / (width * 0.55));
  tri.position.y = height;
  g.add(shadow(tri));
  return g;
}

// ---- style-specific builders ----------------------------------------------

function buildCastle(opts, wallMat, roofMat, shadowMat) {
  const { width, depth, height } = opts;
  const g = new THREE.Group();
  g.add(box(width, height, depth, wallMat, { y: height / 2 }));
  const tr = Math.min(width, depth) * 0.18;
  const tH = height * 1.25;
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
    const t = turret(tr, tH, wallMat, roofMat);
    t.position.set((sx * width) / 2 - sx * tr * 0.3, 0, (sz * depth) / 2 - sz * tr * 0.3);
    g.add(t);
  });
  g.add(crenellations(width, depth, wallMat));
  addWindows(g, width, depth, height, wallMat, opts.windows);
  return g;
}

function buildRenaissance(opts, wallMat, roofMat, shadowMat) {
  const { width, depth, height } = opts;
  const g = new THREE.Group();
  g.add(box(width, height, depth, wallMat, { y: height / 2 }));
  g.add(hippedRoof(width, depth, height * 0.4, roofMat));
  const ped = pediment(width * 0.5, height * 0.25, wallMat);
  ped.position.z = depth / 2;
  g.add(ped);
  const door = box(1.4, 2.2, 0.1, shadowMat, { x: 0, y: 1.1, z: depth / 2 + 0.02 });
  g.add(door);
  addWindows(g, width, depth, height, wallMat, opts.windows);
  return g;
}

function buildDanish(opts, wallMat, roofMat, shadowMat) {
  const { width, depth, height } = opts;
  const g = new THREE.Group();
  g.add(box(width, height, depth, wallMat, { y: height / 2 }));
  const roofH = height * 0.7;
  const roof = gableRoof(width, depth, roofH, roofMat, shadowMat);
  roof.position.y = height;
  g.add(roof);
  g.add(box(width + 0.1, 0.25, depth + 0.1, mat(0xf2ede3, { roughness: 0.7 }), {
    y: height - 0.1,
  }));
  const bay = box(1.6, height * 0.6, 1.0, wallMat, {
    x: 0,
    y: height * 0.3,
    z: depth / 2 + 0.5,
  });
  g.add(bay);
  addWindows(g, width, depth, height, wallMat, opts.windows);
  return g;
}

function buildJapanese(opts, wallMat, roofMat, shadowMat) {
  const { width, depth, height } = opts;
  const g = new THREE.Group();
  g.add(box(width, height, depth, wallMat, { y: height / 2 }));
  g.add(flatRoof(width, depth, mat(JP_TILE, { roughness: 0.7 })));
  g.add(box(width + 0.15, 0.3, depth + 0.15, mat(JP_TILE, { roughness: 0.7 }), {
    y: height + 0.05,
  }));
  if (opts.windows) {
    const floors = Math.max(1, Math.round(height / 2.2));
    for (let f = 0; f < floors; f++) {
      const y = 1.0 + f * 2.2;
      if (y > height - 0.4) break;
      const ribbon = box(width - 0.6, 0.6, 0.06,
        new THREE.MeshStandardMaterial({
          color: WINDOW_GLOW, emissive: WINDOW_GLOW, emissiveIntensity: 0.7, roughness: 0.4,
        }),
        { y, z: depth / 2 });
      g.add(shadow(ribbon));
      const ribbon2 = box(0.06, 0.6, depth - 0.6,
        new THREE.MeshStandardMaterial({
          color: WINDOW_GLOW, emissive: WINDOW_GLOW, emissiveIntensity: 0.7, roughness: 0.4,
        }),
        { y, x: width / 2 });
      g.add(shadow(ribbon2));
    }
  }
  return g;
}

function buildModern(opts, wallMat, roofMat, shadowMat) {
  const { width, depth, height } = opts;
  const g = new THREE.Group();
  g.add(box(width, height, depth, wallMat, { y: height / 2 }));
  g.add(flatRoof(width, depth, roofMat));
  if (opts.windows) {
    const floors = Math.max(1, Math.round(height / 2.2));
    for (let f = 0; f < floors; f++) {
      const y = 1.0 + f * 2.2;
      if (y > height - 0.4) break;
      const strip = box(width - 0.4, 0.8, 0.05,
        new THREE.MeshStandardMaterial({
          color: WINDOW_GLOW, emissive: WINDOW_GLOW, emissiveIntensity: 0.6, roughness: 0.3,
        }),
        { y, z: depth / 2 });
      g.add(shadow(strip));
    }
  }
  return g;
}

function buildMixed(opts, wallMat, roofMat, shadowMat) {
  const { width, depth, height } = opts;
  const g = new THREE.Group();
  g.add(box(width, height, depth, wallMat, { y: height / 2 }));
  g.add(gableRoof(width, depth, height * 0.5, roofMat, shadowMat).translateY(height));
  const eave = 0.4;
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.3, eave, 6),
      roofMat,
    );
    tip.position.set((sx * width) / 2, height + height * 0.5 + 0.2, (sz * depth) / 2);
    tip.rotation.z = sx * 0.5;
    tip.rotation.x = sz * 0.5;
    g.add(shadow(tip));
  });
  const arch = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 0.9, 0.1, 16, 1, false, 0, Math.PI),
    shadowMat,
  );
  arch.rotation.x = Math.PI / 2;
  arch.rotation.z = Math.PI;
  arch.position.set(0, 1.2, depth / 2 + 0.03);
  g.add(shadow(arch));
  addWindows(g, width, depth, height, wallMat, opts.windows);
  return g;
}

const STYLE_BUILDERS = {
  castle: buildCastle,
  renaissance: buildRenaissance,
  danish: buildDanish,
  japanese: buildJapanese,
  modern: buildModern,
  mixed: buildMixed,
};

// ---- public API ------------------------------------------------------------

/**
 * Build a single parametric villa.
 * @param {object} opts
 *   wallColor, roofColor (hex numbers), roofStyle: 'gable'|'hipped'|'flat'|'turret',
 *   height, width, depth (numbers), windows (bool), style (key into STYLE_BUILDERS),
 *   position [x,y,z], rotation (radians, Y axis).
 */
export function createVilla(opts = {}) {
  const style = opts.style && STYLE_BUILDERS[opts.style] ? opts.style : 'danish';
  const wallColor = opts.wallColor ?? WALL_PALETTE[0];
  const roofColor = opts.roofColor ?? ROOF_PALETTE[0];
  const width = opts.width ?? 8;
  const depth = opts.depth ?? 7;
  const height = opts.height ?? 6;

  const wallMat = mat(wallColor, { roughness: 0.82 });
  const roofMat = mat(roofColor, { roughness: 0.8 });
  const shadowMat = mat(ROOF_SHADOW, { roughness: 0.85 });

  const builder = STYLE_BUILDERS[style];
  const body = builder(
    { width, depth, height, windows: opts.windows ?? true },
    wallMat,
    roofMat,
    shadowMat,
  );

  // roofStyle is honored as a style-level hint (castle -> turret, japanese/modern
  // -> flat, others -> gable). Kept in API for completeness.
  void opts.roofStyle;

  const group = new THREE.Group();
  group.add(body);

  if (opts.position) group.position.set(opts.position[0], opts.position[1], opts.position[2]);
  if (opts.rotation) group.rotation.y = opts.rotation;

  group.userData.dispose = () => {
    group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
    });
  };

  return group;
}

// Seeded RNG so placement is deterministic per session but varied.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const STYLES = ['castle', 'renaissance', 'danish', 'japanese', 'modern', 'mixed'];

/**
 * Create ~6-8 villas placed along the road grid blocks.
 * Grid spacing ~30 units spanning roughly -120..120 on X and Z, set back from roads.
 * Returns { group }.
 */
export function createVillas(getHeight) {
  const group = new THREE.Group();
  const rand = rng(20240624);

  // Hand-picked block centers (set back from ~30-unit road grid), 8 villas.
  const spots = [
    { x: -105, z: 75 },
    { x: -45, z: 90 },
    { x: 15, z: 75 },
    { x: 75, z: 90 },
    { x: -90, z: 15 },
    { x: -30, z: -15 },
    { x: 45, z: 15 },
    { x: 105, z: -45 },
  ];

  spots.forEach((spot, i) => {
    const style = STYLES[i % STYLES.length];
    const wallColor = WALL_PALETTE[Math.floor(rand() * WALL_PALETTE.length)];
    const roofColor = ROOF_PALETTE[Math.floor(rand() * ROOF_PALETTE.length)];
    const width = 7 + rand() * 3;
    const depth = 6 + rand() * 3;
    const height = 5 + rand() * 3;
    const rotation = (rand() - 0.5) * 0.5;
    const scaleJitter = 0.92 + rand() * 0.18;
    // Sit on the terrain surface when a getHeight sampler is provided; fall
    // back to Y=0 (ground level) for backward compatibility.
    const y = getHeight ? getHeight(spot.x, spot.z) : 0;

    const villa = createVilla({
      style,
      wallColor,
      roofColor,
      roofStyle:
        style === 'castle'
          ? 'turret'
          : style === 'japanese' || style === 'modern'
            ? 'flat'
            : 'gable',
      width,
      depth,
      height,
      windows: true,
      position: [spot.x, y, spot.z],
      rotation,
    });
    villa.scale.setScalar(scaleJitter);
    group.add(villa);
  });

  return { group };
}
