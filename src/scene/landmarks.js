import * as THREE from 'three';

// Chunk 3 — Landmarks. Huashi Building (花石楼) + Princess Building (公主楼).
// Does NOT touch main.js. Exports createLandmarks() -> { group }.
//
// Palette (from context-brief.md / PLAN.md):
//   Granite (Huashi): #B8B0A4 / #9A9088, roughness ~0.9
//   Princess walls: #F2EDE3 (white trim), roof #A8322A (red tile)
//   Roof shadow: #6E2018
//   Window glow: #E8B870 (emissive warm)

const GRANITE_LIGHT = 0xb8b0a4;
const GRANITE_DARK = 0x9a9088;
const ROOF_RED = 0xa8322a;
const ROOF_SHADOW = 0x6e2018;
const WHITE_TRIM = 0xf2ede3;
const WINDOW_GLOW = 0xe8b870;

// ---- helpers ---------------------------------------------------------------

function mat(color, { roughness = 0.9, metalness = 0.0 } = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function shadow(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function box(w, h, d, material, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 } = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  return shadow(m);
}

function glowPane(w, h, intensity = 0.9) {
  return new THREE.MeshStandardMaterial({
    color: WINDOW_GLOW,
    emissive: WINDOW_GLOW,
    emissiveIntensity: intensity,
    roughness: 0.4,
  });
}

// Crenellation ring of small box merlons around a rectangular deck.
function crenellations(width, depth, merlonMat, { merlon = 0.35, gap = 0.35, h = 0.5 } = {}) {
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

// Cylindrical corner tower with crenellated top.
function tower(radius, height, wallMat, merlonMat) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 1.05, height, 16),
    wallMat,
  );
  body.position.y = height / 2;
  g.add(shadow(body));
  // crenellated top ring
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(radius + 0.1, radius + 0.1, 0.3, 16),
    merlonMat,
  );
  ring.position.y = height + 0.15;
  g.add(shadow(ring));
  // merlons
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const m = box(0.25, 0.4, 0.25, merlonMat);
    m.position.set(Math.cos(a) * (radius + 0.05), height + 0.5, Math.sin(a) * (radius + 0.05));
    g.add(m);
  }
  return g;
}

// Window inset on a wall face.
function windowOn(group, w, h, x, y, z, ry) {
  const pane = box(w, h, 0.06, glowPane(w, h), { x, y, z: z + 0.04, ry });
  const frame = box(w + 0.1, h + 0.1, 0.04, mat(GRANITE_DARK), { x, y, z, ry });
  group.add(frame, pane);
}

// ---- Huashi Building (花石楼) ----------------------------------------------
// 5-floor European medieval castle, granite/cobblestone, Roman+Gothic traces,
// crenellated observation deck, 4 corner turrets. Highest-detail model.
function createHuashiBuilding() {
  const g = new THREE.Group();
  const lightMat = mat(GRANITE_LIGHT, { roughness: 0.9 });
  const darkMat = mat(GRANITE_DARK, { roughness: 0.9 });

  const width = 14;
  const depth = 12;
  const floorH = 2.6;
  const totalH = floorH * 5; // 13

  // 5 stacked floor segments with floor-line insets (slight step each floor).
  for (let f = 0; f < 5; f++) {
    const inset = f * 0.15;
    const fw = width - inset * 2;
    const fd = depth - inset * 2;
    const y = f * floorH;
    const m = f % 2 === 0 ? lightMat : darkMat;
    g.add(box(fw, floorH, fd, m, { y: y + floorH / 2 }));
    // floor-line trim band
    g.add(box(fw + 0.1, 0.12, fd + 0.1, darkMat, { y: y + floorH - 0.06 }));
  }

  // Crenellated observation deck on top.
  const deckY = totalH;
  const deck = box(width + 0.6, 0.4, depth + 0.6, darkMat, { y: deckY + 0.2 });
  g.add(deck);
  g.add(crenellations(width + 0.6, depth + 0.6, darkMat).translateY(deckY + 0.4));

  // Four corner turrets, slightly taller than the main body.
  const tr = 1.4;
  const tH = totalH + 2.5;
  const off = 0.4;
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
    const t = tower(tr, tH, lightMat, darkMat);
    t.position.set(
      (sx * width) / 2 - sx * tr * 0.3 + sx * off,
      0,
      (sz * depth) / 2 - sz * tr * 0.3 + sz * off,
    );
    g.add(t);
  });

  // Roman-arch main entrance (semicylinder + door) on the south (z+) face.
  const arch = new THREE.Mesh(
    new THREE.CylinderGeometry(1.3, 1.3, 0.3, 20, 1, false, 0, Math.PI),
    darkMat,
  );
  arch.rotation.x = Math.PI / 2;
  arch.rotation.z = Math.PI;
  arch.position.set(0, 2.4, depth / 2 + 0.05);
  g.add(shadow(arch));
  const door = box(2.0, 2.4, 0.15, mat(ROOF_SHADOW, { roughness: 0.85 }), {
    x: 0,
    y: 1.2,
    z: depth / 2 + 0.1,
  });
  g.add(door);

  // Gothic-style tall arched windows on floors 2-4 (z+ facade).
  for (let f = 1; f < 4; f++) {
    const y = f * floorH + floorH / 2;
    windowOn(g, 1.0, 1.6, -2.5, y, depth / 2, 0);
    windowOn(g, 1.0, 1.6, 2.5, y, depth / 2, 0);
    windowOn(g, 1.0, 1.6, -2.5, y, -depth / 2, Math.PI);
    windowOn(g, 1.0, 1.6, 2.5, y, -depth / 2, Math.PI);
    // side windows
    windowOn(g, 1.0, 1.6, width / 2, y, -2.5, Math.PI / 2);
    windowOn(g, 1.0, 1.6, width / 2, y, 2.5, Math.PI / 2);
    windowOn(g, 1.0, 1.6, -width / 2, y, -2.5, -Math.PI / 2);
    windowOn(g, 1.0, 1.6, -width / 2, y, 2.5, -Math.PI / 2);
  }

  // A central rooftop lantern (small observation cupola).
  const lantern = box(2.0, 1.6, 2.0, lightMat, { y: deckY + 1.2 });
  g.add(lantern);
  const lanternRoof = new THREE.Mesh(
    new THREE.ConeGeometry(1.6, 1.4, 4),
    darkMat,
  );
  lanternRoof.rotation.y = Math.PI / 4;
  lanternRoof.position.y = deckY + 2.7;
  g.add(shadow(lanternRoof));

  g.position.set(-90, 0, -100);
  return g;
}

// ---- Princess Building (公主楼) --------------------------------------------
// Danish style, Andersen-fairytale proportions, steep gable roof, white trim,
// small tower/bay window. Slightly smaller and charming.
function createPrincessBuilding() {
  const g = new THREE.Group();
  const wallMat = mat(WHITE_TRIM, { roughness: 0.8 });
  const trimMat = mat(WHITE_TRIM, { roughness: 0.7 });
  const roofMat = mat(ROOF_RED, { roughness: 0.8 });
  const shadowMat = mat(ROOF_SHADOW, { roughness: 0.85 });

  const width = 9;
  const depth = 7;
  const height = 5; // slightly smaller, charming

  // Main body.
  g.add(box(width, height, depth, wallMat, { y: height / 2 }));

  // Steep gable roof along depth axis.
  const roofH = height * 0.85;
  const slope = Math.atan2(roofH, depth / 2);
  const slabW = Math.hypot(roofH, depth / 2) + 0.05;
  g.add(box(width + 0.3, 0.18, slabW, roofMat, {
    x: 0, y: height + roofH / 2, z: -depth / 4, rx: -slope,
  }));
  g.add(box(width + 0.3, 0.18, slabW, shadowMat, {
    x: 0, y: height + roofH / 2, z: depth / 4, rx: slope,
  }));
  // ridge cap
  g.add(box(width + 0.35, 0.14, 0.2, roofMat, { y: height + roofH + 0.05 }));

  // White trim band under eaves.
  g.add(box(width + 0.15, 0.3, depth + 0.15, trimMat, { y: height - 0.15 }));

  // Small corner tower (fairytale accent).
  const tR = 1.1;
  const tH = height + 1.5;
  const tBody = new THREE.Mesh(
    new THREE.CylinderGeometry(tR, tR, tH, 12),
    wallMat,
  );
  tBody.position.set(-width / 2 + tR * 0.5, tH / 2, depth / 2 - tR * 0.5);
  g.add(shadow(tBody));
  const tCap = new THREE.Mesh(
    new THREE.ConeGeometry(tR + 0.2, tR * 2.0, 12),
    roofMat,
  );
  tCap.position.set(-width / 2 + tR * 0.5, tH + tR, depth / 2 - tR * 0.5);
  g.add(shadow(tCap));

  // Bay window on the front (z+).
  const bay = box(1.8, height * 0.55, 1.1, wallMat, {
    x: 1.2, y: height * 0.28, z: depth / 2 + 0.55,
  });
  g.add(bay);
  // little roof over bay
  const bayRoof = new THREE.Mesh(
    new THREE.ConeGeometry(1.4, 0.9, 4),
    roofMat,
  );
  bayRoof.rotation.y = Math.PI / 4;
  bayRoof.position.set(1.2, height * 0.55 + 0.45, depth / 2 + 0.55);
  g.add(shadow(bayRoof));

  // Entrance door (warm shadow tone).
  g.add(box(1.3, 2.0, 0.12, shadowMat, { x: -1.2, y: 1.0, z: depth / 2 + 0.06 }));

  // Windows with white frames + warm glow on the front facade.
  const wW = 0.8;
  const wH = 1.1;
  const floors = 2;
  for (let f = 0; f < floors; f++) {
    const y = 1.0 + f * 2.2;
    if (y > height - 0.6) break;
    [2.5, -2.5].forEach((x) => {
      const pane = box(wW, wH, 0.06, glowPane(wW, wH), { x, y, z: depth / 2 + 0.04 });
      const frame = box(wW + 0.12, wH + 0.12, 0.04, trimMat, { x, y, z: depth / 2 });
      g.add(frame, pane);
    });
    // side windows
    const sp = box(wW, wH, 0.06, glowPane(wW, wH), { x: width / 2 + 0.04, y, z: 0, ry: Math.PI / 2 });
    const sf = box(wW + 0.12, wH + 0.12, 0.04, trimMat, { x: width / 2, y, z: 0, ry: Math.PI / 2 });
    g.add(sf, sp);
  }

  g.position.set(30, 0, 30);
  return g;
}

// ---- public API ------------------------------------------------------------

/**
 * Create the landmark buildings group: Huashi Building (花石楼) at the Second
 * Bathing Beach (SW) and Princess Building (公主楼) at Juyongguan Road.
 * Returns { group }.
 */
export function createLandmarks() {
  const group = new THREE.Group();
  group.add(createHuashiBuilding());
  group.add(createPrincessBuilding());

  group.userData.dispose = () => {
    group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
    });
  };

  return { group };
}
