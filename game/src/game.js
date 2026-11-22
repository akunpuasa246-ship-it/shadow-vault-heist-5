// NEON HEIST — Shadow Protocol
// Full heist game: thief, guards with vision cones, cameras, loot, alarm meter

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// ── Colours ────────────────────────────────────────────────────────
const C = {
  bg:        '#060610',
  grid:      '#0d0d20',
  wall:      '#0a1628',
  wallEdge:  '#1a3a5c',
  floor:     '#080818',
  thief:     '#00ffcc',
  thiefGlow: '#00ffcc66',
  guard:     '#ff3366',
  guardGlow: '#ff336688',
  cone:      'rgba(255,80,80,0.13)',
  coneEdge:  'rgba(255,80,80,0.35)',
  coneAlert: 'rgba(255,200,0,0.22)',
  coneAlertEdge:'rgba(255,200,0,0.6)',
  cam:       '#ff9900',
  camGlow:   '#ff990066',
  camCone:   'rgba(255,153,0,0.12)',
  camEdge:   'rgba(255,153,0,0.3)',
  loot:      '#ffee00',
  lootGlow:  '#ffee0088',
  wall2:     '#112244',
};

// ── State ──────────────────────────────────────────────────────────
let alarm = 0, score = 0, state = 'play'; // play | win | dead
let frame = 0;

const keys = {};
document.addEventListener('keydown', e => { keys[e.key] = true; });
document.addEventListener('keyup',   e => { keys[e.key] = false; });

// ── Map ────────────────────────────────────────────────────────────
// 0=floor 1=wall  (25 cols × 17 rows, each cell 32px → 800×544, padded to 800×560)
const COLS = 25, ROWS = 17, CELL = 32;
const MAP = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,0,0,1,0,1,1,1,0,1,0,1,0,1,0,1,1,1,0,1,0,1],
  [1,0,1,0,0,0,0,0,0,0,1,0,1,0,0,0,1,0,0,0,1,0,1,0,1],
  [1,0,1,0,1,1,1,1,0,0,1,0,1,1,1,0,1,1,1,0,0,0,1,0,1],
  [1,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,1],
  [1,1,1,0,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,1],
  [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1],
  [1,0,1,1,1,0,1,0,1,1,0,1,0,1,1,0,1,0,1,1,0,1,0,0,1],
  [1,0,0,0,1,0,0,0,1,0,0,1,0,0,0,0,0,0,1,0,0,1,0,0,1],
  [1,0,1,0,1,1,1,0,1,0,1,1,1,0,1,0,1,0,1,0,1,1,1,0,1],
  [1,0,1,0,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,1,0,1],
  [1,0,1,1,0,1,1,1,1,0,1,0,1,1,1,0,1,1,1,0,1,0,1,0,1],
  [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,1,0,0,0,1,0,0,0,1],
  [1,0,1,1,0,1,0,1,1,0,1,1,1,0,1,0,1,0,1,0,1,1,1,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

function isWall(col, row) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return true;
  return MAP[row][col] === 1;
}

function cellCenter(col, row) {
  return { x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 };
}

// ── Player ─────────────────────────────────────────────────────────
const player = { x: 1.5 * CELL, y: 15.5 * CELL, r: 9, speed: 2.2, trail: [] };

// ── Loot ───────────────────────────────────────────────────────────
const loot = { col: 23, row: 1, collected: false };

// ── Guards ─────────────────────────────────────────────────────────
const guards = [
  { col: 7,  row: 3,  angle: 0,    da: 0.022, range: 120, fov: 0.95, alert: 0 },
  { col: 12, row: 8,  angle: 1.57, da: 0.018, range: 130, fov: 0.9,  alert: 0 },
  { col: 18, row: 5,  angle: 3.14, da: 0.025, range: 115, fov: 1.0,  alert: 0 },
  { col: 5,  row: 10, angle: 4.71, da: 0.020, range: 125, fov: 0.85, alert: 0 },
  { col: 20, row: 13, angle: 2.5,  da: 0.023, range: 120, fov: 0.95, alert: 0 },
];

// ── Cameras ────────────────────────────────────────────────────────
const cameras = [
  { col: 3,  row: 1,  angle: -0.6, fov: 0.7, range: 160, speed: 0.015, alert: 0 },
  { col: 23, row: 7,  angle: 2.5,  fov: 0.7, range: 160, speed: 0.013, alert: 0 },
  { col: 11, row: 15, angle: 1.0,  fov: 0.65, range: 150, speed: 0.017, alert: 0 },
  { col: 15, row: 2,  angle: -1.2, fov: 0.65, range: 155, speed: 0.016, alert: 0 },
];
cameras.forEach(c => { c.base = c.angle; c.sweep = 0.9; });

// ── LOS ray cast ───────────────────────────────────────────────────
function hasLOS(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const steps = Math.ceil(dist / 8);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const cx = Math.floor((x1 + dx * t) / CELL);
    const cy = Math.floor((y1 + dy * t) / CELL);
    if (isWall(cx, cy)) return false;
  }
  return true;
}

function inCone(sx, sy, angle, fov, range, tx, ty) {
  const dx = tx - sx, dy = ty - sy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  const a = Math.atan2(dy, dx);
  let diff = Math.abs(a - angle) % (Math.PI * 2);
  if (diff > Math.PI) diff = Math.PI * 2 - diff;
  if (diff > fov / 2) return false;
  return hasLOS(sx, sy, tx, ty);
}

// ── Move player ────────────────────────────────────────────────────
function movePlayer() {
  let dx = 0, dy = 0;
  if (keys['ArrowLeft']  || keys['a'] || keys['A']) dx -= 1;
  if (keys['ArrowRight'] || keys['d'] || keys['D']) dx += 1;
  if (keys['ArrowUp']    || keys['w'] || keys['W']) dy -= 1;
  if (keys['ArrowDown']  || keys['s'] || keys['S']) dy += 1;
  if (dx && dy) { dx *= 0.707; dy *= 0.707; }

  const spd = player.speed;
  const nx = player.x + dx * spd;
  const ny = player.y + dy * spd;
  const r = player.r - 2;

  if (!isWall(Math.floor((nx + r) / CELL), Math.floor(player.y / CELL)) &&
      !isWall(Math.floor((nx - r) / CELL), Math.floor(player.y / CELL))) {
    player.x = nx;
  }
  if (!isWall(Math.floor(player.x / CELL), Math.floor((ny + r) / CELL)) &&
      !isWall(Math.floor(player.x / CELL), Math.floor((ny - r) / CELL))) {
    player.y = ny;
  }

  // Trail
  player.trail.push({ x: player.x, y: player.y, t: frame });
  if (player.trail.length > 18) player.trail.shift();
}

// ── Draw helpers ───────────────────────────────────────────────────
function drawGlow(x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

function drawCone(sx, sy, angle, fov, range, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const a = angle - fov / 2 + (fov / steps) * i;
    ctx.lineTo(sx + Math.cos(a) * range, sy + Math.sin(a) * range);
  }
  ctx.closePath();
  ctx.fillStyle = fill;   ctx.fill();
  ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke();
}

function drawDiamond(x, y, s, color, glow) {
  drawGlow(x, y, s * 2.5, glow);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = color;
  ctx.shadowColor = glow;
  ctx.shadowBlur = 20;
  ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.restore();
}

// ── Main draw ──────────────────────────────────────────────────────
function draw() {
  // Background
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  // Grid lines (subtle)
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 0.5;
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, H); ctx.stroke();
  }
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(W, r * CELL); ctx.stroke();
  }

  // Walls
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (MAP[r][c] === 1) {
        const x = c * CELL, y = r * CELL;
        ctx.fillStyle = C.wall;
        ctx.fillRect(x, y, CELL, CELL);
        ctx.strokeStyle = C.wallEdge;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
        // inner glow on walls
        ctx.fillStyle = '#1a3a5c18';
        ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
      }
    }
  }

  // Camera cones
  cameras.forEach(cam => {
    const { x: cx, y: cy } = cellCenter(cam.col, cam.row);
    const alerted = cam.alert > 0.3;
    drawCone(cx, cy, cam.angle, cam.fov, cam.range,
      alerted ? C.coneAlert : C.camCone,
      alerted ? C.coneAlertEdge : C.camEdge);
  });

  // Guard cones
  guards.forEach(g => {
    const { x: gx, y: gy } = cellCenter(g.col, g.row);
    const alerted = g.alert > 0.3;
    drawCone(gx, gy, g.angle, g.fov, g.range,
      alerted ? C.coneAlert : C.cone,
      alerted ? C.coneAlertEdge : C.coneEdge);
  });

  // Loot (diamond)
  if (!loot.collected) {
    const lc = cellCenter(loot.col, loot.row);
    const pulse = 0.9 + 0.1 * Math.sin(frame * 0.08);
    drawDiamond(lc.x, lc.y, 11 * pulse, C.loot, C.lootGlow);
    // "LOOT" label
    ctx.fillStyle = '#ffee0099';
    ctx.font = '8px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('LOOT', lc.x, lc.y + 22);
  }

  // Player trail
  player.trail.forEach((pt, i) => {
    const alpha = (i / player.trail.length) * 0.4;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,255,204,${alpha})`;
    ctx.fill();
  });

  // Player glow + body
  drawGlow(player.x, player.y, 28, C.thiefGlow);
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
  ctx.fillStyle = C.thief;
  ctx.shadowColor = C.thief;
  ctx.shadowBlur = 18;
  ctx.fill();
  ctx.shadowBlur = 0;
  // direction dot
  ctx.fillStyle = '#003322';
  ctx.beginPath(); ctx.arc(player.x, player.y, 3, 0, Math.PI * 2); ctx.fill();

  // Guards
  guards.forEach(g => {
    const { x: gx, y: gy } = cellCenter(g.col, g.row);
    const alerted = g.alert > 0.5;
    drawGlow(gx, gy, 24, alerted ? '#ff330055' : C.guardGlow);
    ctx.beginPath();
    ctx.arc(gx, gy, 11, 0, Math.PI * 2);
    ctx.fillStyle = alerted ? '#ff6600' : C.guard;
    ctx.shadowColor = alerted ? '#ff6600' : C.guard;
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.shadowBlur = 0;
    // Guard eye
    ctx.beginPath();
    ctx.arc(gx + Math.cos(g.angle) * 5, gy + Math.sin(g.angle) * 5, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    // "GUARD" label
    ctx.fillStyle = alerted ? '#ff6600cc' : '#ff336699';
    ctx.font = '8px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('GUARD', gx, gy + 22);
  });

  // Cameras
  cameras.forEach(cam => {
    const { x: cx, y: cy } = cellCenter(cam.col, cam.row);
    const alerted = cam.alert > 0.5;
    drawGlow(cx, cy, 18, alerted ? '#ff660055' : C.camGlow);
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fillStyle = alerted ? '#ff6600' : C.cam;
    ctx.shadowColor = alerted ? '#ff6600' : C.cam;
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
    // lens
    ctx.beginPath();
    ctx.arc(cx + Math.cos(cam.angle) * 4, cy + Math.sin(cam.angle) * 4, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    // "CAM" label
    ctx.fillStyle = alerted ? '#ff6600cc' : '#ff990099';
    ctx.font = '8px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('CAM', cx, cy + 18);
  });

  // Overlay: win / dead
  if (state === 'win') {
    ctx.fillStyle = 'rgba(0,10,20,0.75)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffee00';
    ctx.font = 'bold 48px Courier New';
    ctx.shadowColor = '#ffee00'; ctx.shadowBlur = 30;
    ctx.fillText('HEIST COMPLETE', W / 2, H / 2 - 20);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#00ffcc';
    ctx.font = '20px Courier New';
    ctx.fillText(`SCORE: ${score}`, W / 2, H / 2 + 24);
    ctx.fillStyle = '#ffffff88';
    ctx.font = '13px Courier New';
    ctx.fillText('Press R to restart', W / 2, H / 2 + 56);
  }
  if (state === 'dead') {
    ctx.fillStyle = 'rgba(20,0,0,0.78)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff3366';
    ctx.font = 'bold 48px Courier New';
    ctx.shadowColor = '#ff3366'; ctx.shadowBlur = 30;
    ctx.fillText('DETECTED', W / 2, H / 2 - 20);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff88';
    ctx.font = '14px Courier New';
    ctx.fillText('Press R to restart', W / 2, H / 2 + 20);
  }
}

// ── Update HUD ─────────────────────────────────────────────────────
function updateHUD() {
  const bar = document.getElementById('alarm-bar');
  const pct = document.getElementById('alarm-pct');
  const pctVal = Math.min(100, Math.round(alarm * 100));
  bar.style.width = pctVal + '%';
  bar.style.background = alarm > 0.6
    ? `linear-gradient(90deg, #ff6600, #ff0000)`
    : `linear-gradient(90deg, #ff4400, #ff0000)`;
  pct.textContent = pctVal + '%';
  document.getElementById('score-val').textContent = score;
  document.getElementById('msg').textContent =
    state === 'play'
      ? (alarm > 0.7 ? '⚠  ALARM CRITICAL — FIND COVER NOW' : 'Navigate to the diamond · Avoid vision cones')
      : state === 'win' ? '★ MISSION ACCOMPLISHED' : '✗ MISSION FAILED — PRESS R TO RETRY';
}

// ── Restart ────────────────────────────────────────────────────────
function restart() {
  player.x = 1.5 * CELL; player.y = 15.5 * CELL; player.trail = [];
  alarm = 0; score = 0; state = 'play'; loot.collected = false;
  guards.forEach(g => { g.alert = 0; });
  cameras.forEach(c => { c.alert = 0; });
}
document.addEventListener('keydown', e => { if (e.key === 'r' || e.key === 'R') restart(); });

// ── Game loop ──────────────────────────────────────────────────────
function update() {
  if (state !== 'play') { draw(); updateHUD(); requestAnimationFrame(update); return; }
  frame++;

  // Move guards
  guards.forEach(g => {
    g.angle += g.da;
    if (Math.random() < 0.003) g.da *= -1;
  });

  // Sweep cameras
  cameras.forEach(c => {
    c.angle = c.base + Math.sin(frame * c.speed) * c.sweep;
  });

  movePlayer();

  // Detection
  let detected = false;
  let maxAlert = 0;

  guards.forEach(g => {
    const { x: gx, y: gy } = cellCenter(g.col, g.row);
    if (inCone(gx, gy, g.angle, g.fov, g.range, player.x, player.y)) {
      g.alert = Math.min(1, g.alert + 0.025);
      detected = true;
    } else {
      g.alert = Math.max(0, g.alert - 0.008);
    }
    maxAlert = Math.max(maxAlert, g.alert);
  });

  cameras.forEach(c => {
    const { x: cx, y: cy } = cellCenter(c.col, c.row);
    if (inCone(cx, cy, c.angle, c.fov, c.range, player.x, player.y)) {
      c.alert = Math.min(1, c.alert + 0.03);
      detected = true;
    } else {
      c.alert = Math.max(0, c.alert - 0.01);
    }
    maxAlert = Math.max(maxAlert, c.alert);
  });

  if (detected) {
    alarm = Math.min(1, alarm + 0.004);
  } else {
    alarm = Math.max(0, alarm - 0.002);
  }

  if (alarm >= 1) { state = 'dead'; }

  // Loot pickup
  if (!loot.collected) {
    const lc = cellCenter(loot.col, loot.row);
    if (Math.hypot(player.x - lc.x, player.y - lc.y) < CELL * 0.6) {
      loot.collected = true;
      score += 1000 + Math.round((1 - alarm) * 500);
      state = 'win';
    }
  }

  score = Math.max(0, score + 1);

  draw();
  updateHUD();
  requestAnimationFrame(update);
}

update();
