import * as THREE from 'three';
import { SUN_DIRECTION, SUN_POSITION } from '../config/sun.js';

// ──────────────────────────────────────────────────────────────────────────
// Chunk 5 — Lighting: golden-hour sun + hemisphere + ambient.
// createLighting(renderer) → { lights, update? }
// All scene lighting is owned here (Chunk 2 created none) to avoid duplicates.
// ──────────────────────────────────────────────────────────────────────────

export function createLighting(renderer) {
  // Renderer shadow + tone-mapping setup. (main.js also sets these for safety.)
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;        // PCFSoftShadowMap deprecated r182+
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  // Low golden-hour sun — warm directional light, long shadows across the scene.
  const sun = new THREE.DirectionalLight(0xE8B870, 2.2);
  sun.position.copy(SUN_POSITION);                    // ~800 units along SUN_DIRECTION
  sun.castShadow = true;

  // Shadow camera covers the ~400-unit scene.
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 2000;
  sun.shadow.camera.left = -250;
  sun.shadow.camera.right = 250;
  sun.shadow.camera.top = 250;
  sun.shadow.camera.bottom = -250;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;                       // reduce peter-panning on displaced terrain

  // Warm sky / green ground fill — softens shadow side with golden-hour bounce.
  const hemi = new THREE.HemisphereLight(0xE8B870, 0x5E7E42, 0.6);

  // Low warm ambient — lifts the shadow floor without flattening the mood.
  const ambient = new THREE.AmbientLight(0xE8D9A0, 0.15);

  const lights = [sun, hemi, ambient];

  // No per-frame light animation needed (sun is static). `update` is omitted;
  // main.js only calls update functions that exist.
  return { lights };
}
