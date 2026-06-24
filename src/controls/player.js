import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { shorelineZ } from '../scene/terrain.js';

// ──────────────────────────────────────────────────────────────────────────
// Chunk 6 — Player Controls
// createPlayer(camera, renderer, terrain) → { controls, update(dt), object }
//   terrain: { group, getHeight(x,z)=>number, roads } from createTerrain()
// First-person PointerLockControls + WASD + sprint/jump/crouch + terrain bounds.
// ──────────────────────────────────────────────────────────────────────────

// Movement tuning ----------------------------------------------------------
const EYE_LEVEL_STAND = 2.0;          // eye height above terrain (standing)
const EYE_LEVEL_CROUCH = 1.2;         // eye height when crouching
const WALK_SPEED = 8;                 // units / second
const SPRINT_SPEED = 18;              // units / second (Shift)
const CROUCH_SPEED = 3.5;             // units / second (Ctrl)
const ACCEL = 12.0;                   // velocity lerp rate (higher = snappier)
const AIR_ACCEL = 2.0;                // reduced control while airborne
const GRAVITY = 25.0;                 // units / second²
const JUMP_VELOCITY = 8.0;            // initial upward velocity on Space

// Bounds -------------------------------------------------------------------
const SEA_MARGIN = 3;                  // allow player this far onto the beach past shoreline

// Reusable temp vectors (avoid per-frame allocation) -----------------------
const _desired = new THREE.Vector3();
const _pos = new THREE.Vector3();

export function createPlayer(camera, renderer, terrain) {
  const domElement = renderer.domElement;           // MANDATORY in r184
  const controls = new PointerLockControls(camera, domElement);
  const object = controls.object;                   // NOT getObject() — removed in r184
  const getHeight = terrain.getHeight;

  // Key state ---------------------------------------------------------------
  const keys = {
    forward: false,
    back: false,
    left: false,
    right: false,
    sprint: false,
    jump: false,
    crouch: false,
  };

  // Horizontal velocity (x = strafe, z = forward) in object-local space, plus
  // vertical velocity (y) for jumping/gravity. Units/second.
  const velocity = new THREE.Vector3();
  let onGround = true;

  // ── Input handlers ───────────────────────────────────────────────────────
  function onKeyDown(e) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    keys.forward = true; break;
      case 'KeyS': case 'ArrowDown':  keys.back = true; break;
      case 'KeyA': case 'ArrowLeft':  keys.left = true; break;
      case 'KeyD': case 'ArrowRight': keys.right = true; break;
      case 'ShiftLeft': case 'ShiftRight': keys.sprint = true; break;
      case 'Space':                   keys.jump = true; break;
      case 'ControlLeft': case 'ControlRight': keys.crouch = true; break;
      default: return;
    }
  }

  function onKeyUp(e) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    keys.forward = false; break;
      case 'KeyS': case 'ArrowDown':  keys.back = false; break;
      case 'KeyA': case 'ArrowLeft':  keys.left = false; break;
      case 'KeyD': case 'ArrowRight': keys.right = false; break;
      case 'ShiftLeft': case 'ShiftRight': keys.sprint = false; break;
      case 'Space':                   keys.jump = false; break;
      case 'ControlLeft': case 'ControlRight': keys.crouch = false; break;
      default: return;
    }
  }

  // Only listen while pointer is locked — avoids capturing keys for the
  // intro overlay / page UI before the player enters the scene.
  function onLock() {
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
  }
  function onUnlock() {
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    // Drop any held keys so the player doesn't drift after Esc.
    keys.forward = keys.back = keys.left = keys.right = false;
    keys.sprint = keys.jump = keys.crouch = false;
    velocity.set(0, 0, 0);
  }

  controls.addEventListener('lock', onLock);
  controls.addEventListener('unlock', onUnlock);

  // ── Per-frame integration ────────────────────────────────────────────────
  function update(dt) {
    if (!controls.isLocked) return;

    // Clamp dt — large gaps (tab switch) would otherwise fling the player.
    const d = Math.min(dt, 0.1);

    // Desired horizontal movement in object-local space:
    //   z: forward (+) / back (−)   →  moveForward expects +forward
    //   x: right (+) / left (−)
    _desired.set(0, 0, 0);
    if (keys.forward) _desired.z += 1;
    if (keys.back)    _desired.z -= 1;
    if (keys.right)   _desired.x += 1;
    if (keys.left)    _desired.x -= 1;
    if (_desired.lengthSq() > 0) _desired.normalize();

    // Target speed depends on stance.
    let speed = WALK_SPEED;
    if (keys.crouch) speed = CROUCH_SPEED;
    else if (keys.sprint) speed = SPRINT_SPEED;

    const accel = onGround ? ACCEL : AIR_ACCEL;

    // Accelerate horizontal velocity toward desired * speed.
    const targetX = _desired.x * speed;
    const targetZ = _desired.z * speed;
    const k = 1 - Math.exp(-accel * d);   // frame-rate independent lerp
    velocity.x += (targetX - velocity.x) * k;
    velocity.z += (targetZ - velocity.z) * k;

    // Jump + vertical integration.
    if (keys.jump && onGround) {
      velocity.y = JUMP_VELOCITY;
      onGround = false;
    }
    velocity.y -= GRAVITY * d;

    // Apply horizontal motion via the controls' built-in movers (they keep
    // movement on the xz-plane regardless of camera pitch).
    controls.moveRight(velocity.x * d);
    controls.moveForward(velocity.z * d);

    // Apply vertical motion + terrain follow.
    _pos.copy(object.position);
    _pos.y += velocity.y * d;

    const groundY = getHeight(_pos.x, _pos.z);
    const eyeLevel = keys.crouch ? EYE_LEVEL_CROUCH : EYE_LEVEL_STAND;
    const floorY = groundY + eyeLevel;

    if (_pos.y <= floorY) {
      _pos.y = floorY;
      velocity.y = 0;
      onGround = true;
    } else {
      onGround = false;
    }

    // ── Bounds ─────────────────────────────────────────────────────────────
    // Clamp to terrain extent.
    _pos.x = THREE.MathUtils.clamp(_pos.x, -BOUND_XZ, BOUND_XZ);
    _pos.z = THREE.MathUtils.clamp(_pos.z, -BOUND_XZ, BOUND_XZ);
    // Prevent walking into the sea (south edge). The shoreline is an S-curve,
    // so clamp Z to the shoreline at the player's X plus a small beach margin.
    const seaZ = shorelineZ(_pos.x) + SEA_MARGIN;
    if (_pos.z < seaZ) _pos.z = seaZ;

    object.position.copy(_pos);
  }

  return { controls, update, object };
}
