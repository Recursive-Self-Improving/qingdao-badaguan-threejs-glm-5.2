import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { SUN_POSITION } from '../config/sun.js';

// ──────────────────────────────────────────────────────────────────────────
// Chunk 2 — Sky shader dome + base exponential fog.
// createSky() → { group, fog }
// No lights here — all lighting is owned by Chunk 5.
// ──────────────────────────────────────────────────────────────────────────

export function createSky() {
  const group = new THREE.Group();
  group.name = 'sky';

  const sky = new Sky();
  sky.scale.setScalar(400000);                      // very large dome
  sky.name = 'sky-dome';

  const uniforms = sky.material.uniforms;

  // Golden-hour warm look: high turbidity + rayleigh for a warm low sun,
  // tuned so the horizon reads ~#E8B870 and the zenith ~#4E7EA0.
  uniforms['turbidity'].value = 10;
  uniforms['rayleigh'].value = 2.5;
  uniforms['mieCoefficient'].value = 0.008;
  uniforms['mieDirectionalG'].value = 0.85;

  // Sun position drives the sky scattering; shared from sun.js so the sea
  // reflections and the Chunk 5 DirectionalLight all agree.
  uniforms['sunPosition'].value.copy(SUN_POSITION);

  group.add(sky);

  const fog = new THREE.FogExp2(0xD9D4C8, 0.008);

  return { group, fog };
}
