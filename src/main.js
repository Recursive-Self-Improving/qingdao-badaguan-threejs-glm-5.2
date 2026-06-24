import * as THREE from 'three';

// Chunk 5 — Integration: wire all parallel scene modules (2/3/4) + lighting +
// postprocessing into one render loop. This is the dedicated integration
// sub-step (sole writer of main.js at this stage).

import { createTerrain } from './scene/terrain.js';
import { createSea } from './scene/sea.js';
import { createSky } from './scene/sky.js';
import { createVillas } from './scene/villas.js';
import { createLandmarks } from './scene/landmarks.js';
import { createVegetation } from './scene/vegetation.js';
import { createLighting } from './scene/lighting.js';
import { createPostprocessing } from './scene/postprocessing.js';
import { createPlayer } from './controls/player.js';

// ── Renderer ────────────────────────────────────────────────────────────────
// outputBufferType: HalfFloatType is REQUIRED by renderer.setEffects() in r184 —
// with the default UnsignedByteType, setEffects() logs an error and no-ops, so
// the bloom pass would never run. HalfFloat gives HDR headroom for bloom.
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  outputBufferType: THREE.HalfFloatType,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
// Shadow + tone mapping set here for safety; createLighting also sets them.
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;          // PCFSoftShadowMap deprecated r182+
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('app').appendChild(renderer.domElement);

// ── Scene + camera ───────────────────────────────────────────────────────────
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  2000,
);
// Initial position set by Chunk 6 player controls below; camera starts neutral.
camera.position.set(0, 4, 50);

// ── Parallel scene modules (Chunks 2/3/4) ───────────────────────────────────
const terrain = createTerrain();                        // { group, getHeight, roads }
scene.add(terrain.group);
// terrain.getHeight + terrain.roads kept for Chunk 6 (player) + vegetation.

const sea = createSea();                                // { group, update }
scene.add(sea.group);

const sky = createSky();                                // { group, fog }
scene.add(sky.group);
scene.fog = sky.fog;                                    // FogExp2 is not an Object3D

const villas = createVillas();                          // { group }
scene.add(villas.group);

const landmarks = createLandmarks();                    // { group }
scene.add(landmarks.group);

// Pass terrain.roads so tree species match the road layout.
const vegetation = createVegetation(terrain.roads);     // { group }
scene.add(vegetation.group);

// ── Lighting (Chunk 5) ───────────────────────────────────────────────────────
const { lights } = createLighting(renderer);
for (const light of lights) scene.add(light);

// ── Postprocessing (Chunk 5) ─────────────────────────────────────────────────
// r184: setEffects([...]) makes the renderer run the bloom pass internally and
// then applies ACES tone mapping + sRGB output itself (no OutputPass needed).
const post = createPostprocessing(renderer);            // { passes, setSize }
renderer.setEffects(post.passes);
// ── Player controls (Chunk 6) ────────────────────────────────────────────────
// createPlayer wires PointerLockControls against terrain.getHeight for Y-bounds.
const player = createPlayer(camera, renderer, terrain);  // { controls, update, object }
scene.add(player.object);

// Start the player at a good viewpoint: mid-scene on land, looking south toward
// the bay and the Huashi castle area. Y is set from the terrain sampler.
const startX = 0;
const startZ = 50;
player.object.position.set(startX, terrain.getHeight(startX, startZ) + 2, startZ);
camera.lookAt(0, 5, -20);

// Pointer lock: click the canvas to enter first-person look. Chunk 7 UI will
// hook these lock/unlock events for the intro overlay + HUD.
renderer.domElement.addEventListener('click', () => player.controls.lock());
player.controls.addEventListener('lock', () => console.log('[player] pointer locked'));
player.controls.addEventListener('unlock', () => console.log('[player] pointer unlocked'));

// ── Animation loop ───────────────────────────────────────────────────────────
const clock = new THREE.Clock();

// Collect per-frame update functions (only modules that export one).
const updaters = [sea.update, player.update];

renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  for (const update of updaters) update(dt);
  renderer.render(scene, camera);
});

// ── Resize ───────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h);                               // forwards to output.setSize → effect.setSize
  post.setSize(w, h);                                   // safety net
});
