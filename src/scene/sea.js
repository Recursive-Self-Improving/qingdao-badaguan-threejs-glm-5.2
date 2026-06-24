import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { SUN_DIRECTION } from '../config/sun.js';

// ──────────────────────────────────────────────────────────────────────────
// Chunk 2 — Taiping Bay sea surface.
// createSea() → { group, update(dt) }
// ──────────────────────────────────────────────────────────────────────────

// Procedural ripple normal map — the examples waternormals.jpeg is NOT shipped
// in the npm `three` package, so we synthesise a small 256×256 DataTexture of
// perturbed normals that simulates gentle ripples.
function createRippleNormals(size = 256) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // Multiple low-frequency sine ripples → smooth, tileable perturbation.
      const u = x / size, v = y / size;
      const nx =
        Math.sin(u * Math.PI * 6 + v * Math.PI * 4) * 0.5 +
        Math.sin(u * Math.PI * 13 - v * Math.PI * 9) * 0.25;
      const nz =
        Math.cos(v * Math.PI * 7 - u * Math.PI * 5) * 0.5 +
        Math.cos(v * Math.PI * 11 + u * Math.PI * 8) * 0.25;
      // Encode normal (nx, ny≈1, nz) into [0,255].
      const len = Math.sqrt(nx * nx + 1.0 + nz * nz);
      data[i + 0] = Math.round(((nx / len) * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round(((1.0 / len) * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round(((nz / len) * 0.5 + 0.5) * 255);
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function createSea() {
  const group = new THREE.Group();
  group.name = 'sea';

  const normals = createRippleNormals(256);

  // Large planar surface covering the south (Taiping Bay). Positioned at the
  // shoreline so it reads as the bay opening up to the south.
  const geometry = new THREE.PlaneGeometry(600, 600, 1, 1);
  geometry.rotateX(-Math.PI / 2);                   // horizontal

  const water = new Water(geometry, {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: normals,
    sunDirection: SUN_DIRECTION.clone(),
    sunColor: 0xC9A85A,                             // golden highlight #C9A85A
    waterColor: 0x2E5E6E,                           // deep #2E5E6E
    distortionScale: 3.0,
    alpha: 1.0,
    side: THREE.FrontSide,
    fog: true,
  });

  // Place the sea so its near edge sits around the shoreline and it extends
  // southward over the bay. The terrain shoreline is ~z=-130; centre the
  // plane a bit south of that and at water level.
  water.position.set(0, 0, -380);
  water.name = 'taiping-bay';
  water.castShadow = false;
  water.receiveShadow = true;

  group.add(water);

  // Shallow-water tint overlay: a second, slightly larger translucent plane
  // just below the surface gives the #4E8E9E shallower band near the shore.
  const shallowGeo = new THREE.PlaneGeometry(600, 220, 1, 1);
  shallowGeo.rotateX(-Math.PI / 2);
  const shallowMat = new THREE.MeshBasicMaterial({
    color: 0x4E8E9E,                                // shallow #4E8E9E
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const shallow = new THREE.Mesh(shallowGeo, shallowMat);
  shallow.position.set(0, 0.1, -250);              // just above the surface so it tints the water
  shallow.renderOrder = 1;
  shallow.receiveShadow = false;
  shallow.castShadow = false;
  group.add(shallow);

  // Per-frame animation — advance the water time uniform for ripple motion.
  function update(dt) {
    water.material.uniforms['time'].value += dt;
  }

  return { group, update };
}
