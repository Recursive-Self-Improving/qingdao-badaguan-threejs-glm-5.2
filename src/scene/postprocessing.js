import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ──────────────────────────────────────────────────────────────────────────
// Chunk 5 — Postprocessing: subtle golden-hour bloom via renderer.setEffects.
// createPostprocessing(renderer) → { passes, setSize }
//
// r184 note: with renderer.setEffects([...]) the renderer's internal WebGLOutput
// applies ACES tone mapping + sRGB color space conversion AUTOMATICALLY after
// all effect passes. OutputPass is therefore redundant (the renderer even warns
// "OutputPass is not needed in setEffects()") and is intentionally omitted.
// Inline renderer tone mapping is disabled during the effect pass chain and
// re-applied by the internal output stage, so the lit scene is preserved.
//
// r184 requirement: the renderer MUST be constructed with
// `outputBufferType: THREE.HalfFloatType` (or FloatType) or setEffects() will
// log an error and silently no-op. main.js sets this.
// ──────────────────────────────────────────────────────────────────────────

export function createPostprocessing(renderer) {
  const size = renderer.getSize(new THREE.Vector2());
  const resolution = new THREE.Vector2(size.width, size.height);

  // Subtle bloom — golden roof/sea highlights, NOT neon. Low strength + high
  // threshold keeps the bloom to the brightest sun-facing surfaces only.
  const bloomPass = new UnrealBloomPass(resolution, 0.4, 0.6, 0.85);

  const passes = [bloomPass];

  // Resize hook. The renderer's setSize() already calls output.setSize() which
  // forwards to each effect's setSize(), so this is strictly a safety net for
  // any code path that resizes the canvas without going through renderer.setSize.
  function setSize(width, height) {
    bloomPass.setSize(width, height);
  }

  return { passes, setSize };
}
