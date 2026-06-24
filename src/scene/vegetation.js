import * as THREE from 'three';

// Chunk 4 — Vegetation: tree avenues (InstancedMesh), shrub clusters, garden walls.
// createVegetation(roads) returns { group }.
//
// `roads` is an array of road objects from terrain.js (Chunk 2), each shaped like
// { name, species, start, end, direction } where start/end are THREE.Vector3-like
// points and direction is 'ns' (north-south) or 'ew' (east-west). If `roads` is
// undefined, a self-contained default 10-road layout on a ~30-unit grid spanning
// -120..120 on X and Z is used so the module works standalone.

// ---------------------------------------------------------------------------
// Color palette (exact hex from the brief — single source of truth for foliage)
// ---------------------------------------------------------------------------
const BARK_COLOR = 0x5e4a3e;
const SHRUB_COLOR = 0x5e7e42;
const WALL_COLOR = 0xb8a88e;

const SPECIES = {
  peach: {
    canopyColor: 0xe8a8b0,
    canopyShape: 'sphere',
    canopyRadius: 2.2,
    trunkHeight: 3.2,
    trunkRadius: 0.28,
  },
  crapeMyrtle: {
    canopyColor: 0x8e5a8e,
    canopyShape: 'sphere',
    canopyRadius: 1.7,
    trunkHeight: 2.6,
    trunkRadius: 0.22,
  },
  maple: {
    canopyColor: 0xb8322a,
    canopyColor2: 0x9e2a22,
    canopyShape: 'sphere',
    canopyRadius: 2.8,
    trunkHeight: 3.6,
    trunkRadius: 0.32,
  },
  cedar: {
    canopyColor: 0x3e5e3e,
    canopyColor2: 0x2e4a2e,
    canopyShape: 'cone',
    canopyRadius: 1.8,
    canopyHeight: 6.0,
    trunkHeight: 2.0,
    trunkRadius: 0.3,
  },
  crabapple: {
    canopyColor: 0xe8a8b0,
    canopyShape: 'sphere',
    canopyRadius: 2.0,
    trunkHeight: 3.0,
    trunkRadius: 0.26,
  },
  ginkgo: {
    canopyColor: 0xe8b84a,
    canopyColor2: 0xd4a02a,
    canopyShape: 'sphere',
    canopyRadius: 2.6,
    trunkHeight: 4.0,
    trunkRadius: 0.32,
  },
  pine: {
    canopyColor: 0x2e4a2e,
    canopyShape: 'cone',
    canopyRadius: 1.6,
    canopyHeight: 4.5,
    trunkHeight: 1.6,
    trunkRadius: 0.28,
  },
};

// Road name -> species key. Matches the brief's "one species per road" mapping.
const ROAD_SPECIES = {
  'Shaoguan Road': 'peach',
  'Zhengyangguan Road': 'crapeMyrtle',
  'Juyongguan Road': 'maple',
  'Zijingguan Road': 'cedar',
  'Ningwuguan Road': 'crabapple',
};

// ---------------------------------------------------------------------------
// Default road layout (used when `roads` is undefined).
// 10 pass-named roads on a ~30-unit grid spanning -120..120 on X and Z.
// N-S roads run along X=const; E-W roads run along Z=const.
// ---------------------------------------------------------------------------
function defaultRoads() {
  // North-south roads (run along constant X, varying Z).
  const ns = [
    { name: 'Zijingguan Road', x: -60 },
    { name: 'Ningwuguan Road', x: 0 },
    { name: 'Shaoguan Road', x: 60 },
  ];
  // East-west roads (run along constant Z, varying X).
  const ew = [
    { name: 'Wushengguan Road', z: -90 },
    { name: 'Jiayuguan Road', z: -60 },
    { name: 'Hanguguan Road', z: -30 },
    { name: 'Zhengyangguan Road', z: 0 },
    { name: 'Linhuai Road', z: 30 },
    { name: 'Juyongguan Road', z: 60 },
    { name: 'Shanhaiguan Road', z: 90 },
  ];
  const roads = [];
  for (const r of ns) {
    roads.push({
      name: r.name,
      species: ROAD_SPECIES[r.name] || 'ginkgo',
      start: new THREE.Vector3(r.x, 0, -120),
      end: new THREE.Vector3(r.x, 0, 120),
      direction: 'ns',
    });
  }
  for (const r of ew) {
    roads.push({
      name: r.name,
      species: ROAD_SPECIES[r.name] || 'ginkgo',
      start: new THREE.Vector3(-120, 0, r.z),
      end: new THREE.Vector3(120, 0, r.z),
      direction: 'ew',
    });
  }
  return roads;
}

// Normalize a road object into a canonical form the planter understands.
// Species alias map — tolerates terrain.js's hyphenated keys (e.g. 'crape-myrtle').
const SPECIES_ALIASES = {
  'crape-myrtle': 'crapeMyrtle',
  'crapeMyrtle': 'crapeMyrtle',
  'crabapple': 'crabapple',
  'peach': 'peach',
  'maple': 'maple',
  'cedar': 'cedar',
  'ginkgo': 'ginkgo',
  'pine': 'pine',
};

// Normalize a road object into a canonical form the planter understands.
// Tolerates: THREE.Vector3 or plain {x,z} start/end; 'ns'/'ew' or
// 'north-south'/'east-west' direction; hyphenated or camelCase species keys.
function normalizeRoad(road) {
  const start = road.start instanceof THREE.Vector3
    ? road.start.clone()
    : new THREE.Vector3(road.start?.x ?? 0, road.start?.y ?? 0, road.start?.z ?? 0);
  const end = road.end instanceof THREE.Vector3
    ? road.end.clone()
    : new THREE.Vector3(road.end?.x ?? 0, road.end?.y ?? 0, road.end?.z ?? 0);
  let direction = road.direction;
  if (direction === 'north-south') direction = 'ns';
  else if (direction === 'east-west') direction = 'ew';
  if (!direction) {
    const dx = Math.abs(end.x - start.x);
    const dz = Math.abs(end.z - start.z);
    direction = dx >= dz ? 'ew' : 'ns';
  }
  let species = SPECIES_ALIASES[road.species];
  if (!species || !SPECIES[species]) {
    species = ROAD_SPECIES[road.name] || 'ginkgo';
  }
  return { name: road.name || 'Road', species, start, end, direction };
}

// Deterministic pseudo-random per-index so the avenue looks natural but is stable.
function jitter(i, salt) {
  const s = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return s - Math.floor(s); // 0..1
}

// ---------------------------------------------------------------------------
// Build one InstancedMesh pair (trunk + canopy) for a given species, placing
// instances along both flanks of a road. Returns { trunk, canopy } or null.
// ---------------------------------------------------------------------------
function buildAvenue(road, group) {
  const spec = SPECIES[road.species];
  if (!spec) return null;

  // Compute flank offsets perpendicular to the road direction.
  // Road width ~6 units; trees sit ~5 units off the road centerline.
  const flank = 5;
  const spacing = 8; // ~8-unit spacing along the road
  const along = new THREE.Vector3().subVectors(road.end, road.start);
  const length = along.length();
  if (length < 1) return null;
  const dir = along.clone().normalize();
  // Perpendicular in the XZ plane (rotate dir by 90° around Y).
  const perp = new THREE.Vector3(-dir.z, 0, dir.x).normalize();

  const countPerSide = Math.max(2, Math.floor(length / spacing));
  const total = countPerSide * 2;

  // --- Trunk InstancedMesh (cylinder) ---
  const trunkGeo = new THREE.CylinderGeometry(
    spec.trunkRadius,
    spec.trunkRadius * 1.3,
    spec.trunkHeight,
    7,
  );
  const trunkMat = new THREE.MeshStandardMaterial({
    color: BARK_COLOR,
    roughness: 0.8,
    metalness: 0.0,
  });
  const trunk = new THREE.InstancedMesh(trunkGeo, trunkMat, total);
  trunk.castShadow = true;
  trunk.receiveShadow = false;

  // --- Canopy InstancedMesh (sphere or cone) ---
  let canopyGeo;
  if (spec.canopyShape === 'cone') {
    canopyGeo = new THREE.ConeGeometry(
      spec.canopyRadius,
      spec.canopyHeight,
      8,
    );
  } else {
    canopyGeo = new THREE.SphereGeometry(spec.canopyRadius, 10, 8);
  }
  const canopyMat = new THREE.MeshStandardMaterial({
    color: spec.canopyColor,
    roughness: 0.9,
    metalness: 0.0,
  });
  const canopy = new THREE.InstancedMesh(canopyGeo, canopyMat, total);
  canopy.castShadow = true;
  canopy.receiveShadow = false;

  const dummy = new THREE.Object3D();
  let idx = 0;
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < countPerSide; i++) {
      const t = (i + 0.5) / countPerSide; // center the row
      const base = new THREE.Vector3().lerpVectors(road.start, road.end, t);
      const offset = perp.clone().multiplyScalar(side * flank);
      const px = base.x + offset.x + (jitter(idx, 1) - 0.5) * 1.5;
      const pz = base.z + offset.z + (jitter(idx, 2) - 0.5) * 1.5;
      const heightVar = 0.85 + jitter(idx, 3) * 0.3; // 0.85..1.15
      const rotY = jitter(idx, 4) * Math.PI * 2;
      const scaleXY = 0.9 + jitter(idx, 5) * 0.2; // 0.9..1.1

      // Trunk: base sits on ground (y=0), cylinder centered so shift up by half height.
      const trunkH = spec.trunkHeight * heightVar;
      dummy.position.set(px, trunkH / 2, pz);
      dummy.rotation.set(0, rotY, 0);
      dummy.scale.set(scaleXY, heightVar, scaleXY);
      dummy.updateMatrix();
      trunk.setMatrixAt(idx, dummy.matrix);

      // Canopy: sits atop the trunk. Cone/sphere geometry is centered at its
      // own centroid, so lift by trunk height + half canopy size.
      const canopyLift = spec.canopyShape === 'cone'
        ? trunkH + spec.canopyHeight * 0.5 * heightVar
        : trunkH + spec.canopyRadius * 0.6 * heightVar;
      dummy.position.set(px, canopyLift, pz);
      dummy.rotation.set(0, rotY, 0);
      dummy.scale.set(scaleXY, heightVar, scaleXY);
      dummy.updateMatrix();
      canopy.setMatrixAt(idx, dummy.matrix);

      idx++;
    }
  }
  trunk.count = total;
  canopy.count = total;
  trunk.instanceMatrix.needsUpdate = true;
  canopy.instanceMatrix.needsUpdate = true;
  trunk.computeBoundingSphere();
  canopy.computeBoundingSphere();
  // frustumCulled stays true (default) — bounding spheres are now valid.

  group.add(trunk);
  group.add(canopy);
  return { trunk, canopy };
}

// ---------------------------------------------------------------------------
// Pine/cypress accent rows: a few evergreen cones interspersed on ginkgo roads
// to add evergreen contrast per the brief ("pine/cypress accents").
// ---------------------------------------------------------------------------
function buildPineAccents(road, group) {
  const spec = SPECIES.pine;
  const flank = 7.5; // slightly outside the main avenue
  const spacing = 24; // sparse accents
  const along = new THREE.Vector3().subVectors(road.end, road.start);
  const length = along.length();
  if (length < 1) return;
  const dir = along.clone().normalize();
  const perp = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
  const countPerSide = Math.max(1, Math.floor(length / spacing));
  const total = countPerSide * 2;

  const trunkGeo = new THREE.CylinderGeometry(
    spec.trunkRadius,
    spec.trunkRadius * 1.3,
    spec.trunkHeight,
    6,
  );
  const trunkMat = new THREE.MeshStandardMaterial({
    color: BARK_COLOR,
    roughness: 0.8,
  });
  const trunk = new THREE.InstancedMesh(trunkGeo, trunkMat, total);
  trunk.castShadow = true;

  const canopyGeo = new THREE.ConeGeometry(spec.canopyRadius, spec.canopyHeight, 7);
  const canopyMat = new THREE.MeshStandardMaterial({
    color: spec.canopyColor,
    roughness: 0.9,
  });
  const canopy = new THREE.InstancedMesh(canopyGeo, canopyMat, total);
  canopy.castShadow = true;

  const dummy = new THREE.Object3D();
  let idx = 0;
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < countPerSide; i++) {
      const t = (i + 0.5) / countPerSide;
      const base = new THREE.Vector3().lerpVectors(road.start, road.end, t);
      const offset = perp.clone().multiplyScalar(side * flank);
      const px = base.x + offset.x + (jitter(idx, 11) - 0.5) * 2;
      const pz = base.z + offset.z + (jitter(idx, 12) - 0.5) * 2;
      const hv = 0.8 + jitter(idx, 13) * 0.4;
      const rotY = jitter(idx, 14) * Math.PI * 2;
      const sc = 0.85 + jitter(idx, 15) * 0.3;

      const trunkH = spec.trunkHeight * hv;
      dummy.position.set(px, trunkH / 2, pz);
      dummy.rotation.set(0, rotY, 0);
      dummy.scale.set(sc, hv, sc);
      dummy.updateMatrix();
      trunk.setMatrixAt(idx, dummy.matrix);

      const lift = trunkH + spec.canopyHeight * 0.5 * hv;
      dummy.position.set(px, lift, pz);
      dummy.scale.set(sc, hv, sc);
      dummy.updateMatrix();
      canopy.setMatrixAt(idx, dummy.matrix);
      idx++;
    }
  }
  trunk.count = total;
  canopy.count = total;
  trunk.instanceMatrix.needsUpdate = true;
  canopy.instanceMatrix.needsUpdate = true;
  trunk.computeBoundingSphere();
  canopy.computeBoundingSphere();

  group.add(trunk);
  group.add(canopy);
}

// ---------------------------------------------------------------------------
// Shrub clusters at villa garden positions. A few small instanced sphere
// clusters placed at known villa-plot corners along the road grid.
// ---------------------------------------------------------------------------
function buildShrubs(group) {
  // Villa garden positions (approx block centers set back from roads).
  const gardens = [
    { x: -45, z: -45 },
    { x: 45, z: -45 },
    { x: -45, z: 45 },
    { x: 45, z: 45 },
    { x: 0, z: -75 },
    { x: -75, z: 0 },
  ];
  const perGarden = 14;
  const total = gardens.length * perGarden;

  const geo = new THREE.SphereGeometry(0.6, 7, 6);
  const mat = new THREE.MeshStandardMaterial({
    color: SHRUB_COLOR,
    roughness: 0.9,
    metalness: 0.0,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, total);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const dummy = new THREE.Object3D();
  let idx = 0;
  for (const g of gardens) {
    for (let i = 0; i < perGarden; i++) {
      const a = (i / perGarden) * Math.PI * 2 + jitter(i, 21) * 0.6;
      const r = 1.5 + jitter(i, 22) * 3.5;
      const px = g.x + Math.cos(a) * r;
      const pz = g.z + Math.sin(a) * r;
      const sy = 0.6 + jitter(i, 23) * 0.6;
      const sxz = 0.7 + jitter(i, 24) * 0.6;
      dummy.position.set(px, sy * 0.5, pz);
      dummy.rotation.set(0, jitter(i, 25) * Math.PI, 0);
      dummy.scale.set(sxz, sy, sxz);
      dummy.updateMatrix();
      mesh.setMatrixAt(idx, dummy.matrix);
      idx++;
    }
  }
  mesh.count = total;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  group.add(mesh);
}

// ---------------------------------------------------------------------------
// Low garden walls around a few villa plots — warm stone boxes ~1.2 units tall,
// permeable styling (thin segments with gaps).
// ---------------------------------------------------------------------------
function buildWalls(group) {
  const wallH = 1.2;
  const wallT = 0.3; // thin
  const segLen = 4.0; // segment length
  const gap = 1.5; // gap between segments -> permeable
  const mat = new THREE.MeshStandardMaterial({
    color: WALL_COLOR,
    roughness: 0.8,
    metalness: 0.0,
  });

  // A few villa plots (rectangular footprints) to enclose.
  const plots = [
    { cx: -45, cz: -45, w: 22, d: 18 },
    { cx: 45, cz: -45, w: 20, d: 20 },
    { cx: -45, cz: 45, w: 24, d: 16 },
  ];

  const segments = [];
  for (const p of plots) {
    const hx = p.w / 2;
    const hz = p.d / 2;
    // Four sides; each side split into segments with gaps.
    const sides = [
      { x0: p.cx - hx, z0: p.cz - hz, x1: p.cx + hx, z1: p.cz - hz }, // south
      { x0: p.cx + hx, z0: p.cz - hz, x1: p.cx + hx, z1: p.cz + hz }, // east
      { x0: p.cx + hx, z0: p.cz + hz, x1: p.cx - hx, z1: p.cz + hz }, // north
      { x0: p.cx - hx, z0: p.cz + hz, x1: p.cx - hx, z1: p.cz - hz }, // west
    ];
    for (const s of sides) {
      const dx = s.x1 - s.x0;
      const dz = s.z1 - s.z0;
      const len = Math.hypot(dx, dz);
      const ux = dx / len;
      const uz = dz / len;
      const stride = segLen + gap;
      const n = Math.max(1, Math.floor(len / stride));
      for (let i = 0; i < n; i++) {
        const start = i * stride;
        const end = Math.min(start + segLen, len);
        if (end - start < 0.5) break;
        const mid = (start + end) / 2;
        const cx = s.x0 + ux * mid;
        const cz = s.z0 + uz * mid;
        segments.push({ cx, cz, length: end - start, angle: Math.atan2(uz, ux) });
      }
    }
  }

  const total = segments.length;
  const geo = new THREE.BoxGeometry(1, wallH, wallT);
  const mesh = new THREE.InstancedMesh(geo, mat, total);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const dummy = new THREE.Object3D();
  for (let i = 0; i < total; i++) {
    const s = segments[i];
    dummy.position.set(s.cx, wallH / 2, s.cz);
    dummy.rotation.set(0, -s.angle, 0); // align box length (X) along segment
    dummy.scale.set(s.length, 1, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.count = total;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  group.add(mesh);
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------
export function createVegetation(roads) {
  const group = new THREE.Group();
  group.name = 'vegetation';

  const normalized = (roads && roads.length)
    ? roads.map(normalizeRoad)
    : defaultRoads();

  for (const road of normalized) {
    buildAvenue(road, group);
    // Ginkgo avenues get pine/cypress accents per the brief.
    if (road.species === 'ginkgo') {
      buildPineAccents(road, group);
    }
  }

  buildShrubs(group);
  buildWalls(group);

  return { group };
}
