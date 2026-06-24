// ──────────────────────────────────────────────────────────────────────────
// Chunk 7 — UI Overlay.
// createOverlay(player, landmarks, roads) → { update(dt) }
//   player:    { controls, update, object } from createPlayer (Chunk 6).
//   landmarks: optional array of { name, position:{x,z} } for location
//              detection + minimap. Falls back to a static Huashi/Princess
//              list derived from landmarks.js positions.
//   roads:     optional array of road objects from terrain.js, shaped
//              { name, direction, start:{x,z}, end:{x,z} }. Used for nearest-
//              road location detection. Falls back to a static grid.
// Builds the intro screen (#intro), HUD (#hud), and a small minimap
// (#minimap). Vite injects styles.css via the import below.
// ──────────────────────────────────────────────────────────────────────────
import './styles.css';

// Bilingual road-name table (zh + pinyin/English). Keys match terrain.js
// road `name` values (e.g. 'Shanhaiguan', 'Zijingguan'). Suffix ' Road' is
// tolerated — normalized by stripping it before lookup.
const ROAD_LABELS = {
  Zijingguan:    { zh: '紫荆关路', en: 'Zijingguan Road' },
  Ningwuguan:    { zh: '宁武关路', en: 'Ningwuguan Road' },
  Shaoguan:      { zh: '韶关路',   en: 'Shaoguan Road' },
  Wushengguan:   { zh: '武胜关路', en: 'Wushengguan Road' },
  Jiayuguan:     { zh: '嘉峪关路', en: 'Jiayuguan Road' },
  Hanguguan:     { zh: '函谷关路', en: 'Hanguguan Road' },
  Zhengyangguan: { zh: '正阳关路', en: 'Zhengyangguan Road' },
  Linhuai:       { zh: '临淮关路', en: 'Linhuai Road' },
  Juyongguan:    { zh: '居庸关路', en: 'Juyongguan Road' },
  Shanhaiguan:   { zh: '山海关路', en: 'Shanhaiguan Road' },
};

// Static fallbacks (used when caller passes no roads/landmarks) — match the
// real terrain.js layout so detection is correct even without arguments.
const FALLBACK_ROADS = [
  { name: 'Zijingguan',    direction: 'north-south', start: { x: -60, z: -95 },  end: { x: -60, z: 115 } },
  { name: 'Ningwuguan',    direction: 'north-south', start: { x:   0, z: -95 },  end: { x:   0, z: 115 } },
  { name: 'Shaoguan',      direction: 'north-south', start: { x:  60, z: -95 },  end: { x:  60, z: 115 } },
  { name: 'Wushengguan',   direction: 'east-west',   start: { x: -90, z: -80 },  end: { x:  90, z: -80 } },
  { name: 'Jiayuguan',     direction: 'east-west',   start: { x: -90, z: -50 },  end: { x:  90, z: -50 } },
  { name: 'Hanguguan',     direction: 'east-west',   start: { x: -90, z: -20 },  end: { x:  90, z: -20 } },
  { name: 'Zhengyangguan', direction: 'east-west',   start: { x: -90, z:  10 },  end: { x:  90, z:  10 } },
  { name: 'Linhuai',       direction: 'east-west',   start: { x: -90, z:  40 },  end: { x:  90, z:  40 } },
  { name: 'Juyongguan',    direction: 'east-west',   start: { x: -90, z:  70 },  end: { x:  90, z:  70 } },
  { name: 'Shanhaiguan',   direction: 'east-west',   start: { x: -90, z: 100 },  end: { x:  90, z: 100 } },
];

const FALLBACK_LANDMARKS = [
  { name: { zh: '花石楼', en: 'Huashi Building' }, position: { x: -90, z: -100 } },
  { name: { zh: '公主楼', en: 'Princess Building' }, position: { x:  30, z:   30 } },
];

// Minimap world extent (matches terrain ~400², clamped to ±200 in player).
const MAP_EXTENT = 200;
const MAP_SIZE = 150;

// Distance thresholds for location detection.
const LANDMARK_NEAR = 22;   // within this → landmark name wins
const ROAD_NEAR = 9;        // within this of a road centerline → road name

// ── helpers ───────────────────────────────────────────────────────────────

// Distance from point (px,pz) to a finite segment (a→b) in the XZ plane.
function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  let t = lenSq > 0 ? ((px - ax) * dx + (pz - az) * dz) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cz = az + t * dz;
  const ex = px - cx, ez = pz - cz;
  return Math.sqrt(ex * ex + ez * ez);
}

// Normalize a road name to a ROAD_LABELS key ('Shanhaiguan Road' → 'Shanhaiguan').
function roadKey(name) {
  if (!name) return '';
  return String(name).replace(/\s*Road$/i, '').trim();
}

function roadLabel(name) {
  const key = roadKey(name);
  const lbl = ROAD_LABELS[key];
  if (lbl) return `${lbl.zh} ${lbl.en}`;
  return name ? `${name} Road` : '';
}

// Normalize the landmarks argument into { name:{zh,en}, position:{x,z} }.
function normalizeLandmarks(landmarks) {
  if (!landmarks || !landmarks.length) return FALLBACK_LANDMARKS;
  return landmarks.map((l) => {
    const pos = l.position || (l.object && l.object.position) || { x: 0, z: 0 };
    let name = l.name;
    if (typeof name === 'string') {
      // Heuristic: Chinese chars present → zh, else treat as en.
      if (/[\u4e00-\u9fff]/.test(name)) name = { zh: name, en: '' };
      else name = { zh: '', en: name };
    } else if (!name) {
      name = { zh: '', en: 'Landmark' };
    }
    return { name, position: { x: pos.x, z: pos.z } };
  });
}

// Normalize the roads argument into { name, direction, start:{x,z}, end:{x,z} }.
function normalizeRoads(roads) {
  if (!roads || !roads.length) return FALLBACK_ROADS;
  return roads.map((r) => {
    const s = r.start || {}, e = r.end || {};
    return {
      name: r.name,
      direction: r.direction,
      start: { x: s.x, z: s.z },
      end: { x: e.x, z: e.z },
    };
  });
}

// ── DOM construction ──────────────────────────────────────────────────────

function buildIntro() {
  const intro = document.createElement('div');
  intro.id = 'intro';
  intro.innerHTML = `
    <h1 class="intro-title">
      <span class="zh">青岛八大关</span>
      <span class="en">Qingdao Badaguan</span>
    </h1>
    <div class="intro-prompt">Click to enter</div>
    <div class="intro-sub">A golden-hour walk through the Museum of World Architecture on Taiping Bay.</div>
    <div class="intro-error">Pointer lock failed — click again to retry.</div>
  `;
  return intro;
}

function buildHud() {
  const hud = document.createElement('div');
  hud.id = 'hud';
  hud.innerHTML = `
    <div class="hud-location" data-loc>八大关 Badaguan</div>
    <div class="hud-controls">
      <span class="key">WASD</span> move ·
      <span class="key">Mouse</span> look ·
      <span class="key">Shift</span> sprint ·
      <span class="key">Esc</span> release
    </div>
  `;
  return hud;
}

function buildMinimap() {
  const wrap = document.createElement('div');
  wrap.id = 'minimap';
  wrap.innerHTML = `
    <span class="minimap-label">Map</span>
    <canvas width="${MAP_SIZE}" height="${MAP_SIZE}"></canvas>
  `;
  return wrap;
}

// ── factory ───────────────────────────────────────────────────────────────

export function createOverlay(player, landmarks, roads) {
  const controls = player.controls;
  const object = player.object;

  const lmNorm = normalizeLandmarks(landmarks);
  const roadsNorm = normalizeRoads(roads);

  // Build + mount DOM.
  const intro = buildIntro();
  const hud = buildHud();
  const minimap = buildMinimap();
  document.body.appendChild(intro);
  document.body.appendChild(hud);
  document.body.appendChild(minimap);

  const locEl = hud.querySelector('[data-loc]');
  const canvas = minimap.querySelector('canvas');
  const ctx = canvas.getContext('2d');

  let locked = false;
  let hudVisible = false;
  let mapVisible = false;

  // ── Pointer-lock lifecycle ──────────────────────────────────────────────
  function enterScene() {
    intro.classList.remove('has-error');
    controls.lock();
  }

  // Click anywhere on the intro → request pointer lock.
  intro.addEventListener('click', enterScene);

  function onLock() {
    locked = true;
    intro.classList.add('is-hidden');
    // After the fade, fully remove from layout so it never intercepts events.
    setTimeout(() => {
      if (locked) intro.classList.add('is-removed');
    }, 650);
    showHud(true);
    showMap(true);
  }

  function onUnlock() {
    locked = false;
    intro.classList.remove('is-removed');
    // Force reflow so the transition runs from the hidden state.
    void intro.offsetWidth;
    intro.classList.remove('is-hidden');
    showHud(false);
    showMap(false);
  }

  function onPointerLockError() {
    // Browser-level error (e.g. iframe / user-agent denial). Surface a retry.
    intro.classList.add('has-error');
    intro.classList.remove('is-hidden');
    intro.classList.remove('is-removed');
  }

  controls.addEventListener('lock', onLock);
  controls.addEventListener('unlock', onUnlock);
  document.addEventListener('pointerlockerror', onPointerLockError);

  function showHud(v) {
    if (v === hudVisible) return;
    hudVisible = v;
    hud.classList.toggle('is-visible', v);
  }
  function showMap(v) {
    if (v === mapVisible) return;
    mapVisible = v;
    minimap.classList.toggle('is-visible', v);
  }

  // ── Location detection ──────────────────────────────────────────────────
  // Returns a bilingual label string for the player's current position.
  function detectLocation(px, pz) {
    // 1) Nearest landmark — wins if within LANDMARK_NEAR.
    let bestLm = null;
    let bestLmD = Infinity;
    for (const l of lmNorm) {
      const dx = px - l.position.x, dz = pz - l.position.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestLmD) { bestLmD = d; bestLm = l; }
    }
    if (bestLm && bestLmD < LANDMARK_NEAR) {
      const n = bestLm.name;
      return `${n.zh} ${n.en}`.trim();
    }

    // 2) Nearest road centerline — wins if within ROAD_NEAR.
    let bestRoad = null;
    let bestRoadD = Infinity;
    for (const r of roadsNorm) {
      const d = distToSegment(px, pz, r.start.x, r.start.z, r.end.x, r.end.z);
      if (d < bestRoadD) { bestRoadD = d; bestRoad = r; }
    }
    if (bestRoad && bestRoadD < ROAD_NEAR) {
      return roadLabel(bestRoad.name);
    }

    // 3) Nearest landmark by name even if not "near" — gives a sense of place
    //    when wandering a block (e.g. "near 花石楼 Huashi Building").
    if (bestLm) {
      const n = bestLm.name;
      const near = `${n.zh} ${n.en}`.trim();
      return `近 ${near}`;
    }

    return '八大关 Badaguan';
  }

  // ── Minimap drawing ─────────────────────────────────────────────────────
  // World (x,z) ∈ [-MAP_EXTENT, MAP_EXTENT] → canvas [0, MAP_SIZE].
  // North (+Z) is up on the map.
  function worldToMap(x, z) {
    const u = (x + MAP_EXTENT) / (2 * MAP_EXTENT) * MAP_SIZE;
    const v = MAP_SIZE - (z + MAP_EXTENT) / (2 * MAP_EXTENT) * MAP_SIZE;
    return [u, v];
  }

  function drawMinimap(px, pz) {
    ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);

    // Translucent ground tint.
    ctx.fillStyle = 'rgba(110, 142, 78, 0.18)';
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

    // Sea strip at the south (bottom of map, low Z).
    ctx.fillStyle = 'rgba(46, 94, 110, 0.35)';
    const seaV = MAP_SIZE - ((-135 + MAP_EXTENT) / (2 * MAP_EXTENT)) * MAP_SIZE;
    ctx.fillRect(0, seaV, MAP_SIZE, MAP_SIZE - seaV);

    // Roads.
    ctx.strokeStyle = 'rgba(184, 168, 142, 0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const r of roadsNorm) {
      const [u1, v1] = worldToMap(r.start.x, r.start.z);
      const [u2, v2] = worldToMap(r.end.x, r.end.z);
      ctx.moveTo(u1, v1);
      ctx.lineTo(u2, v2);
    }
    ctx.stroke();

    // Landmarks.
    for (const l of lmNorm) {
      const [u, v] = worldToMap(l.position.x, l.position.z);
      ctx.fillStyle = '#E8B870';
      ctx.beginPath();
      ctx.arc(u, v, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player dot + facing wedge.
    const [pu, pv] = worldToMap(px, pz);
    ctx.fillStyle = '#F2EDE3';
    ctx.beginPath();
    ctx.arc(pu, pv, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(232, 184, 112, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(pu, pv, 4.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ── Per-frame update (throttled to ~10fps) ──────────────────────────────
  let accum = 0;
  const INTERVAL = 0.1; // seconds

  function update(dt) {
    accum += dt;
    if (accum < INTERVAL) return;
    accum = 0;

    const px = object.position.x;
    const pz = object.position.z;

    const label = detectLocation(px, pz);
    if (locEl.textContent !== label) locEl.textContent = label;

    drawMinimap(px, pz);
  }

  // ── Cleanup (not strictly needed for a single-page scene, but tidy) ─────
  function dispose() {
    controls.removeEventListener('lock', onLock);
    controls.removeEventListener('unlock', onUnlock);
    document.removeEventListener('pointerlockerror', onPointerLockError);
    intro.remove();
    hud.remove();
    minimap.remove();
  }

  return { update, dispose };
}
