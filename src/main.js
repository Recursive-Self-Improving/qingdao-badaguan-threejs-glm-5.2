import * as THREE from 'three';

// Chunk 1 scaffold — minimal renderer + scene + camera + animation loop.
// No scene content yet (terrain/sea/sky/villas/vegetation added in later chunks).

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
// Placeholder background — replaced by Sky shader in Chunk 2.
scene.background = new THREE.Color(0x4e7ea0);

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  2000,
);
camera.position.set(0, 10, 0);

// Empty-scene render loop. setAnimationLoop is the r184-recommended way to
// drive rendering and stays in sync with the browser's refresh rate.
renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});
