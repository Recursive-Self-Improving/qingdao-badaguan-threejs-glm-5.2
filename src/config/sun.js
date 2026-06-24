import * as THREE from 'three';

// Single source of truth for the sun direction across the whole scene.
// Chunk 2 (sea + sky) and Chunk 5 (lighting) both import these values so
// that water reflections, the Sky shader, and the DirectionalLight shadows
// all share one consistent golden-hour sun. Edit elevation/azimuth here only.

// Low golden-hour elevation (degrees above horizon).
export const SUN_ELEVATION = 10;
// Warm afternoon azimuth (degrees, compass bearing where 0 = +Z/north, 90 = +X/east).
export const SUN_AZIMUTH = 200;

// Normalized sun direction vector derived from elevation + azimuth.
// Azimuth rotates around Y; elevation tilts down toward the horizon.
const elevationRad = THREE.MathUtils.degToRad(SUN_ELEVATION);
const azimuthRad = THREE.MathUtils.degToRad(SUN_AZIMUTH);

export const SUN_DIRECTION = new THREE.Vector3(
  Math.sin(azimuthRad) * Math.cos(elevationRad),
  Math.sin(elevationRad),
  Math.cos(azimuthRad) * Math.cos(elevationRad),
).normalize();

// Sun position scaled out to ~800 units — used as the DirectionalLight
// position and the Sky shader sun position. DirectionalLight aims from
// this point toward the origin, so the light direction = -SUN_POSITION.normalized()
// which matches SUN_DIRECTION.
export const SUN_POSITION = SUN_DIRECTION.clone().multiplyScalar(800);
