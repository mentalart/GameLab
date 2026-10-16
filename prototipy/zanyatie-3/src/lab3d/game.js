/* ===== Игра: карты механики в деле ===== */
let S = {}, gt = 0, score = 0, lives = 3, invuln = 0, best = 0, hitstop = 0;
const ents = new THREE.Group(); scene.add(ents);
const v2 = (x, z) => ({ x, z });
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ITEM = () => (DESIGN.item || 'цели').replace(/\s*\[кубик\]/, '');
function add(o) { ents.add(o); return o; }
function del(o) { if (o) ents.remove(o); }
function freeSpot(minD, from) { let x, z, k = 0; const b = (S.border || 0) + 2; do { x = rnd(-AX + b, AX - b); z = rnd(-AZ + b, AZ - b); } while (from && Math.hypot(x - from.x, z - from.z) < minD && ++k < 40); return v2(x, z); }
function edgeSpot(minD) { let p, k = 0; do { const e = Math.floor(Math.random() * 4); p = e < 2 ? v2(e ? AX - 1 : -AX + 1, rnd(-AZ + 1, AZ - 1)) : v2(rnd(-AX + 1, AX - 1), e === 2 ? -AZ + 1 : AZ - 1); } while (dist(p, S.h) < minD && ++k < 30); return p; }
function heightAt(x, z) { let h = 0; if (S.plats) for (const p of S.plats) if (Math.hypot(x - p.x, z - p.z) < p.r) h = Math.max(h, p.h); return h; }

/* ---------- старт партии ---------- */
function startGame() {
  if (errored) return;
  audio(); state = 'play'; paused = false; gt = 0; score = 0; invuln = 0; hitstop = 0;
  $('#startScreen').hidden = true; $('#overScreen').hidden = true; $('#pauseScreen').hidden = true; $('#resBox').hidden = true; $('#panelNote').hidden = true;
  setupRun();
}
function setupRun() {
  while (ents.children.length) ents.remove(ents.children[0]);
  for (const m of parts) scene.remove(m); parts.length = 0;
  const goal = ci('goal'), thr = ci('threat'), tw = ci('twist');
  lives = tw === 8 ? 1 : Math.round(cfg.lives);
  S = { h: { x: 0, z: AZ - 3, y: 0, vy: 0, yaw: Math.PI, vx: 0, vz: 0, r: 0.8, scale: 1, carry: null }, foes: [], pats: [], mets: [], bul: [], items: [], runners: [], traps: [], logs: [], trail: [], gates: [], blocks: [],
    cd: 0, dashT: 0, shieldT: 0, energy: 1, mult: tw === 8 ? 2 : 1, level: 1, light: 13, border: 0, lava: 0, spT: 0, metT: 0, patT: 0, mirT: 0, mirror: false, lastFlip: -9, lastHurt: -9, trailT: 0, survT: 0,
    beat: 0, note: 0, nmArmed: true, lastDir: '', day: true, dayT: 0, lowG: false, gT: 0, wind: 0, windT: 0, logT: 0, slow: 1, camYaw: Math.PI, lap: 0, gateI: 0, lapT: 0, bestLap: null, lapRec: [], ghostRec: null,
    d: { heat: new Array(24 * 14).fill(0), edge: 0, center: 0, idle: 0, turns: 0, nm: 0, uses: 0, saves: 0, hold: 0, goals: 0, greedy: 0, hurts: 0, flipHurts: 0, echoHurts: 0, maxMult: 1, lightSum: 0, distSum: 0, distT: 0, kills: 0, hurtPos: [], shots: 0, shotHits: 0, shotCatch: 0, touchCatch: 0, backHits: 0, bossDmg: 0, bossDowns: 0, dodged: 0, causes: {}, lavaT: 0, carryT: 0 },
    snap: Object.assign({}, cfg) };
  S.h.mesh = add(makeHero(ci('look')));
  S.ring = add(ring(0.95, 1.12, P().acc, 0.85)); S.ringBg = add(ring(0.95, 1.12, '#000000', 0.25));
  if (goal === 0) for (let i = 0; i < 3; i++) spawnItem();
  if (goal === 1) for (let i = 0; i < 3; i++) spawnRunner();
  if (goal === 2) placeDoor();
  if (goal === 4 || goal === 7) { S.pad = add(makePad()); S.pad.position.set(-AX + 4, 0, 0); S.padP = v2(-AX + 4, 0); spawnCargo(); }
  if (goal === 5) { S.treasure = add(makeTreasure()); S.tHP = 10; S.h.z = 4; }
  if (goal === 6) { for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 - Math.PI / 2, g = add(makeGate()); g.position.set(Math.cos(a) * (AX - 5), 0, Math.sin(a) * (AZ - 3.5)); g.rotation.y = -a; S.gates.push(g); } S.h.x = 0; S.h.z = AZ - 3.5; }
  if (thr === 0) spawnFoe();
  if (thr === 2) { spawnPatrol(); spawnPatrol(); }
  if (thr === 3) { S.fire = add(new THREE.Group()); for (let i = 0; i < 4; i++) { const w = M(G.box(1, 1, 1), '#ff6a2a', 0, 0.7, 0, { emissive: '#ff3a0a', ei: 1.2, opacity: 0.8, shadow: false }); S.fire.add(w); } }
  if (thr === 4) { S.plats = []; const pts = [[-12, -5, 2.2], [11, -6, 1.6], [-4, 5, 1.2], [14, 5, 2.4], [-15, 6, 0.9], [3, -4, 1.9], [-8, -1, 0.7]]; for (const [x, z, h] of pts) { const r = 2.6 + (h > 1.5 ? 0.6 : 0); const m = add(M(jitter(G.cyl(r, r + 0.4, h, 7), 0.15), P().rock, x, h / 2, z)); S.plats.push({ x, z, r, h, m }); } S.lavaM = add(new THREE.Mesh(new THREE.PlaneGeometry(AX * 2 + 2, AZ * 2 + 2, 20, 12), new THREE.MeshStandardMaterial({ color: '#ff5a1a', emissive: '#ff3a0a', emissiveIntensity: 1.1, flatShading: true, transparent: true, opacity: 0.92 }))); S.lavaM.rotation.x = -Math.PI / 2; }
  if (thr === 6) spawnBoss();
  if (tw === 3) { S.ghost = add(makeHero(ci('look'))); S.ghost.traverse(o => { if (o.isMesh) { o.material = new THREE.MeshStandardMaterial({ color: '#cfc8ff', emissive: '#7a6aff', emissiveIntensity: 0.6, transparent: true, opacity: 0.38, flatShading: true }); o.castShadow = false; } }); S.ghost.visible = false; }
  S.cave = buildCave();
  placeHero(); camSnap();
  buildHUD();
}
function buildCave() {
  // вход в пещеру на краю арены: декорация мира (если мир — пещера)
  if (!/пещер|азиш/i.test(DESIGN.world || '')) return null;
  const p = P(), g = add(new THREE.Group());
  for (let i = 0; i < 9; i++) { const a = i / 8 * Math.PI; g.add(M(jitter(G.dod(2.2 + hash(i, 2, 2)), 0.8), p.rock, Math.cos(a) * 5.5, Math.sin(a) * 4.2 + 0.4, 0, { s: [1, 1.2, 1.4] })); }
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(4.2, 9, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#0a0806' })); mouth.position.set(0, 0.3, -0.6); g.add(mouth);
  for (let i = 0; i < 6; i++) g.add(M(G.cone(0.35, 1.5, 5), '#d8d0c0', -3 + i * 1.2, 4.2 - Math.abs(i - 2.5) * 0.3, 0.4, { r: [Math.PI, 0, 0] }));
  g.position.set(0, 0, -AZ - 4.5); return g;
}

/* ---------- спавн ---------- */
function spawnItem() { const p = freeSpot(6, S.h), m = add(makeItem()); m.position.set(p.x, 1, p.z); S.items.push({ x: p.x, z: p.z, m, ph: Math.random() * 6 }); }
function makeKhychin() {
  const p = P(), g = new THREE.Group();
  g.add(M(G.cyl(0.6, 0.62, 0.22, 9), '#e8b25a', 0, 0.55, 0)); g.add(M(G.cyl(0.5, 0.55, 0.06, 9), '#f6d48a', 0, 0.68, 0, { shadow: false }));
  for (let i = 0; i < 4; i++) g.add(M(G.sph(0.08, 5, 3), '#b87a2a', Math.cos(i * 1.7) * 0.3, 0.71, Math.sin(i * 1.7) * 0.3, { s: [1, 0.4, 1], shadow: false }));
  [-1, 1].forEach(s => { const l = M(G.box(0.08, 0.4, 0.08), '#7a4a2a', s * 0.22, 0.22, 0); l.userData.leg = s; g.add(l); });
  eyes(g, 0.62, 0.55, 0.16, 0.06); return g;
}
function spawnRunner() { const p = freeSpot(9, S.h), m = add(/хычин/i.test(DESIGN.item || '') ? makeKhychin() : makeRunner()); m.position.set(p.x, 0, p.z); S.runners.push({ x: p.x, z: p.z, vx: 0, vz: 0, wt: 0, m, r: 0.6, stuck: 0, hop: Math.random() * 6 }); }
function placeDoor() { const p = freeSpot(16, S.h); if (S.door) del(S.door.m); const m = add(makeDoor()); m.position.set(p.x, 0, p.z); m.rotation.y = Math.atan2(S.h.x - p.x, S.h.z - p.z); S.door = { x: p.x, z: p.z, m }; }
function spawnCargo() { const p = freeSpot(14, S.padP), m = add(ci('goal') === 7 ? (DESIGN.makeCargo ? DESIGN.makeCargo() : M(G.box(0.8, 0.8, 0.8), P().acc, 0, 0, 0, { emissive: P().acc, ei: 0.3 })) : makeItem()); m.position.set(p.x, 0.8, p.z); S.cargo = { x: p.x, z: p.z, m }; }
function spawnFoe() { const p = edgeSpot(10), m = add(makeHunter()); m.position.set(p.x, 0, p.z); S.foes.push({ x: p.x, z: p.z, r: 0.75, m, stuck: 0, hop: Math.random() * 6 }); burst({ x: p.x, z: p.z }, { colors: ['#ffffff', P().foe], count: 12 }); }
function spawnPatrol() { const p = edgeSpot(9), a = Math.random() * 6.283, v = cfg.foeSpeed * 1.25, m = add(makePatrol()); m.position.set(p.x, 0, p.z); const pl = add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 7), new THREE.MeshBasicMaterial({ color: P().foe, transparent: true, opacity: 0.4, depthWrite: false }))); S.pats.push({ x: p.x, z: p.z, vx: Math.cos(a) * v, vz: Math.sin(a) * v, r: 0.85, m, pl, stuck: 0 }); }
function spawnBoss() { const m = add(makeBoss()); m.position.set(0, 0, -AZ + 2.5); S.boss = { x: 0, z: -AZ + 2.5, r: 1.9, hp: 30, max: 30, m, t: 3, atk: null, down: 0, tier: 0, yaw: 0 }; }

/* ---------- урон ---------- */
function hurt(src, cause) {
  const h = S.h;
  if (S.dashT > 0 || S.shieldT > 0 || invuln > 0 || state !== 'play') return false;
  lives--; invuln = 1.3; hitstop = 0.07; S.d.hurts++; S.lastHurt = gt; S.mult = ci('twist') === 8 ? 2 : 1;
  S.d.hurtPos.push([h.x, h.z]); S.d.causes[cause] = (S.d.causes[cause] || 0) + 1;
  if (src) { const fx = Math.sin(h.yaw), fz = Math.cos(h.yaw), dx = src.x - h.x, dz = src.z - h.z; if (fx * dx + fz * dz < 0) S.d.backHits++; }
  if (ci('twist') === 4 && gt - S.lastFlip < 1.5) S.d.flipHurts++;
  shake(0.7); flash('#ff4d5e', 0.35); sfx.hit(); rumble(250, 0.9);
  burst({ x: h.x, z: h.z, y: 1 }, { count: 22, speed: 10, colors: ['#ff4d5e', '#ffb35c', '#ffffff'] });
  popup({ x: h.x, z: h.z, y: 1.6 }, cause, '#ffd0d6');
  if (lives <= 0) endGame('Нарт выбился из сил');
  return true;
}
function onGoal(x, z, pts, how) {
  const tw = ci('twist'); S.d.goals++; if ((how !== 'carry' && nearest() < 5.8) || S.pickGreedy) S.d.greedy++; S.pickGreedy = false;
  const k = (tw === 5 && !S.day ? 2 : 1) * S.mult; score += pts * k; popup({ x, z, y: 1 }, '+' + Math.round(pts * k), P().acc);
  sfx.coin(); burst({ x, z, y: 0.8 }, { count: 16, colors: [P().item, '#ffffff'], speed: 9 });
  if (tw === 1) { S.mult = Math.min(5, S.mult + 1); S.d.maxMult = Math.max(S.d.maxMult, S.mult); }
  if (tw === 2) S.light = Math.min(13, S.light + 4.5);
  if (tw === 7) S.h.scale = Math.min(2, S.h.scale * 1.08);
  if (ci('threat') === 3) S.border = Math.max(0, S.border - 1.9);
  if (ci('threat') === 4) S.lava = Math.max(0, S.lava - 0.35);
}
function nearest() {
  const h = S.h; let m = Infinity;
  for (const f of S.foes) m = Math.min(m, dist(h, f) - f.r - h.r);
  for (const f of S.pats) m = Math.min(m, dist(h, f) - f.r - h.r);
  for (const f of S.logs) m = Math.min(m, dist(h, f) - 0.8 - h.r);
  for (const f of S.mets) if (f.t < 0.7) m = Math.min(m, dist(h, f) - f.r - h.r);
  if (S.boss && !S.boss.down) { m = Math.min(m, dist(h, S.boss) - S.boss.r - h.r); const a = S.boss.atk; if (a && a.zone) m = Math.min(m, zoneGap(a)); }
  if (ci('threat') === 3) { const b = S.border; m = Math.min(m, h.x - h.r + AX - b, AX - b - h.x - h.r, h.z - h.r + AZ - b, AZ - b - h.z - h.r); }
  if (ci('threat') === 4 && S.lava > 0.05) m = Math.min(m, heightAt(h.x, h.z) > S.lava ? 3 : 0);
  if (S.ghost && S.ghost.visible) m = Math.min(m, Math.hypot(h.x - S.ghost.position.x, h.z - S.ghost.position.z) - 1.4);
  return m;
}
function zoneGap(a) {
  const h = S.h;
  if (a.type === 'slam') return dist(h, a) - a.R;
  if (a.type === 'charge') { const dx = h.x - a.x, dz = h.z - a.z, along = dx * a.dx + dz * a.dz, side = Math.abs(dx * a.dz - dz * a.dx); return along < -1 || along > a.len + 1 ? 9 : side - a.w / 2; }
  if (a.type === 'throw') return Math.min(...a.rocks.map(r => dist(h, r) - r.R));
  return 9;
}

/* ---------- кадр ---------- */
function update(dt) {
  const c = cfg, h = S.h, goal = ci('goal'), verb = ci('verb'), thr = ci('threat'), tw = ci('twist'), camMode = ci('camera');
  music(dt);
  // повороты по времени
  if (tw === 4) { S.mirT += dt; if (S.mirT > 10 && S.mirT - dt <= 10) sfx.warn(); if (S.mirT >= 12) { S.mirT = 0; S.mirror = !S.mirror; S.lastFlip = gt; sfx.whoosh(); flash('#ffffff', 0.25); popup(h, S.mirror ? 'ЗЕРКАЛО!' : 'ОБРАТНО!'); } }
  if (tw === 5) { S.dayT += dt; if (S.dayT > 18 && S.dayT - dt <= 18) sfx.warn(); if (S.dayT >= 20) { S.dayT = 0; S.day = !S.day; sfx.whoosh(); } }
  if (tw === 6) { S.gT += dt; const ph = S.gT % 15; const lo = ph > 10; if (lo !== S.lowG) { S.lowG = lo; sfx.whoosh(); popup(h, lo ? 'НЕВЕСОМОСТЬ' : 'ВЕС ВЕРНУЛСЯ', '#bfe8ff'); } }
  // ввод
  let ix = held.right - held.left, iz = held.down - held.up;
  if (padAxes[0] || padAxes[1]) { ix = padAxes[0]; iz = padAxes[1]; }
  if (S.mirror) ix = -ix;
  const night = tw === 5 && !S.day, gk = (tw === 1 ? 1 + 0.12 * (S.mult - 1) : 1) * (night ? 1.4 : 1);
  // глагол
  const near = nearest(), use = () => { S.d.uses++; if (near < 5.8) S.d.saves++; };
  S.cd = Math.max(0, S.cd - dt); let spdK = 1; S.slow = 1;
  const fx = Math.sin(h.yaw), fz = Math.cos(h.yaw);
  if (pressed.a && S.cd <= 0) {
    if (verb === 0) { S.dashT = 0.2; S.cd = c.verbCd; use(); sfx.whoosh(); burst({ x: h.x, z: h.z, y: 0.5 }, { count: 12, colors: ['#ffffff', P().acc], speed: 6 }); }
    if (verb === 1 && h.y <= heightAt(h.x, h.z) + 0.01) { h.vy = S.lowG ? 15 : 11; S.cd = c.verbCd * 0.5; use(); sfx.jump(); }
    if (verb === 2) { S.shieldT = 1.2; S.cd = c.verbCd * 3; use(); sfx.power(); }
    if (verb === 3) { const m = add(new THREE.Group()); m.add(M(G.ico(0.22, 0), P().acc, 0, 0, 0, { emissive: P().acc, ei: 1.4, shadow: false })); m.add(glow(P().acc, 1.6)); m.position.set(h.x + fx, h.y + 1.6, h.z + fz); S.bul.push({ x: h.x + fx, z: h.z + fz, vx: fx * 30, vz: fz * 30, life: 0.9, m }); S.cd = c.verbCd * 0.3; S.d.shots++; use(); sfx.zap(); }
    if (verb === 6) { const ox = h.x, oz = h.z; h.x = clamp(h.x + fx * 6, -AX + h.r, AX - h.r); h.z = clamp(h.z + fz * 6, -AZ + h.r, AZ - h.r); S.cd = c.verbCd * 1.5; invuln = Math.max(invuln, 0.25); use(); sfx.whoosh(); burst({ x: ox, z: oz }, { count: 14, colors: [P().acc, '#ffffff'] }); burst({ x: h.x, z: h.z }, { count: 14, colors: [P().acc, '#ffffff'] }); }
    if (verb === 7) { if (S.traps.length >= 3) { del(S.traps[0].m); S.traps.shift(); } const m = add(new THREE.Group()); m.add(ring(0.5, 0.9, P().acc, 0.9)); for (let i = 0; i < 8; i++) m.add(M(G.cone(0.08, 0.35, 4), '#d8d8e8', Math.cos(i / 8 * 6.28) * 0.7, 0.15, Math.sin(i / 8 * 6.28) * 0.7)); m.position.set(h.x, 0, h.z); S.traps.push({ x: h.x, z: h.z, m }); S.cd = c.verbCd * 2; use(); tone(300, 0.15, 'square', 0.08, 600); }
    if (verb === 8) { S.cd = c.verbCd * 2; use(); sfx.boom(); shake(0.4); const wave = add(ring(0.5, 1.0, '#ffffff', 0.7)); wave.position.set(h.x, 0.1, h.z); S.wave = { m: wave, t: 0 }; for (const arr of [S.foes, S.pats, S.runners]) for (const f of arr) { const dd = dist(h, f); if (dd < 6 && dd > 0.01) { f.x += (f.x - h.x) / dd * (6 - dd); f.z += (f.z - h.z) / dd * (6 - dd); if (f.vx != null && arr === S.pats) { const sp = Math.hypot(f.vx, f.vz); f.vx = (f.x - h.x) / dd * sp; f.vz = (f.z - h.z) / dd * sp; } } } if (S.boss && dist(h, S.boss) < 6) { S.boss.t += 1; } }
  }
  if (verb === 4 && held.a) { spdK = 0.55; S.d.hold += dt; if (pressed.a) use(); }
  if (verb === 5) { if (held.a && S.energy > 0) { S.slow = 0.35; S.energy = Math.max(0, S.energy - dt / 3); S.d.hold += dt; if (pressed.a) { use(); tone(300, 0.4, 'sine', 0.08, 120); } } else S.energy = Math.min(1, S.energy + dt / Math.max(0.5, c.verbCd * 4)); }
  const wdt = dt * S.slow;
  if (S.wave) { S.wave.t += dt; S.wave.m.scale.setScalar(1 + S.wave.t * 14); S.wave.m.material.opacity = Math.max(0, 0.7 - S.wave.t * 2); if (S.wave.t > 0.4) { del(S.wave.m); S.wave = null; } }
  // движение героя
  let sp = c.heroSpeed * spdK * (S.h.carry ? 0.72 : 1) / Math.sqrt(h.scale);
  let mx = 0, mz = 0, moving = false;
  if (camMode === 1) { // из-за спины: поворот и газ, как верхом
    const turn = -ix * 3.1 * dt; h.yaw += turn; const thr2 = -iz; moving = Math.abs(thr2) > 0.1 || Math.abs(ix) > 0.1;
    const f = thr2 > 0 ? thr2 : thr2 * 0.55; mx = Math.sin(h.yaw) * f; mz = Math.cos(h.yaw) * f;
    if (Math.abs(ix) > 0.2 && thr2 <= 0.1) { mx += Math.sin(h.yaw) * 0.35; mz += Math.cos(h.yaw) * 0.35; }
  } else {
    let ux = ix, uz = iz; if (camMode === 3) { const a = Math.PI / 4; ux = ix * Math.cos(a) + iz * Math.sin(a); uz = -ix * Math.sin(a) + iz * Math.cos(a); }
    const l = Math.hypot(ux, uz); if (l > 0.15) { mx = ux / Math.max(1, l); mz = uz / Math.max(1, l); moving = true; const ty = Math.atan2(mx, mz); let dy = ((ty - h.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; h.yaw += dy * Math.min(1, dt * 14); }
  }
  if (moving) { const ang = Math.atan2(mx, mz); if (S.dirA == null) { S.dirA = ang; S.dirT = 0; } const df = Math.abs(((ang - S.dirA + Math.PI * 3) % (Math.PI * 2)) - Math.PI); if (df < 0.35) S.dirT += dt; else { if (df > 1.75 && S.dirT > 0.25) S.d.turns++; S.dirA = ang; S.dirT = 0; } } else S.d.idle += dt; // поворот = разворот больше 100° после того, как герой держал курс
  const inert = S.lowG ? 1.6 : 12;
  h.vx += (mx * sp - h.vx) * Math.min(1, dt * inert); h.vz += (mz * sp - h.vz) * Math.min(1, dt * inert);
  if (S.dashT > 0) { S.dashT -= dt; h.x += fx * sp * 3 * dt; h.z += fz * sp * 3 * dt; } else { h.x += h.vx * dt; h.z += h.vz * dt; }
  if (thr === 5) { h.x += Math.cos(S.wind) * c.foeSpeed * 0.32 * dt; h.z += Math.sin(S.wind) * c.foeSpeed * 0.32 * dt; }
  h.x = clamp(h.x, -AX + h.r, AX - h.r); h.z = clamp(h.z, -AZ + h.r, AZ - h.r);
  const gy = heightAt(h.x, h.z);
  h.vy -= (S.lowG ? 9 : 30) * dt; h.y += h.vy * dt; if (h.y < gy) { if (h.vy < -6) burst({ x: h.x, z: h.z, y: gy }, { count: 6, colors: [P().rock], speed: 4, lift: 1 }); h.y = gy; h.vy = 0; }
  S.shieldT = Math.max(0, S.shieldT - dt);
  const air = h.y > gy + 0.6;
  // угрозы
  S.spT += wdt;
  if (thr === 0) {
    if (S.spT >= c.spawnEvery && S.foes.length < 14) { S.spT = 0; spawnFoe(); }
    for (const f of S.foes) {
      if (f.stuck > 0) { f.stuck -= wdt; continue; }
      const tgt = goal === 5 ? v2(0, 0) : h, a = Math.atan2(tgt.z - f.z, tgt.x - f.x), v = c.foeSpeed * gk * wdt;
      f.x += Math.cos(a) * v; f.z += Math.sin(a) * v; f.yaw = Math.atan2(Math.cos(a), Math.sin(a));
      for (const o of S.foes) if (o !== f) { const dd = dist(f, o); if (dd < 1.4 && dd > 0) { f.x += (f.x - o.x) / dd * 2 * wdt; f.z += (f.z - o.z) / dd * 2 * wdt; } }
      const dd = dist(h, f);
      if (S.shieldT > 0 && dd < 3) { f.x -= Math.cos(a) * 11 * dt; f.z -= Math.sin(a) * 11 * dt; }
      else if (dd < h.r + f.r && !air) { if (goal === 5) { f.x -= Math.cos(Math.atan2(h.z - f.z, h.x - f.x)) * 4; f.z -= Math.sin(Math.atan2(h.z - f.z, h.x - f.x)) * 4; onGoal(f.x, f.z, 5); } else if (hurt(f, 'Охотник догнал')) { f.x -= Math.cos(a) * 4; f.z -= Math.sin(a) * 4; } }
      if (goal === 5 && Math.hypot(f.x, f.z) < 2) { S.tHP--; f.x = edgeSpot(8).x; f.z = edgeSpot(8).z; sfx.hit(); shake(0.4); popup(v2(0, 0), 'Сокровище −1', '#ff8a8a'); }
    }
  }
  if (thr === 1 || (thr === 6 && false)) {
    S.metT += wdt; const every = Math.max(0.35, c.spawnEvery * 0.3 - gt * 0.004);
    if (S.metT >= every) { S.metT = 0; const tg = goal === 5 ? v2(0, 0) : h; const p = v2(clamp(tg.x + rnd(-9, 9), -AX + 1, AX - 1), clamp(tg.z + rnd(-6, 6), -AZ + 1, AZ - 1)); const sh = add(ring(0.1, 2, '#000000', 0.35)); sh.position.set(p.x, 0.05, p.z); const rk = add(makeRock()); S.mets.push({ ...p, t: 1, r: 2, sh, rk }); }
    for (const m of S.mets) {
      m.t -= wdt; m.sh.scale.setScalar(0.3 + 0.7 * (1 - Math.max(0, m.t))); m.rk.position.set(m.x - m.t * 6, 0.6 + Math.max(0, m.t) * 16, m.z); m.rk.rotation.x += dt * 5;
      if (m.t <= 0 && !m.done) { m.done = true; sfx.boom(); shake(0.35); burst({ x: m.x, z: m.z }, { count: 18, colors: [P().foe, '#ffb35c', '#ffffff'], speed: 10 }); if (dist(h, m) < m.r + h.r - 0.3 && !air) hurt(m, 'Метеор: тень была под тобой'); else if (dist(h, m) < m.r + 2) S.d.dodged++; if (goal === 5 && Math.hypot(m.x, m.z) < m.r + 1.4) { S.tHP--; popup(v2(0, 0), 'Сокровище −1', '#ff8a8a'); } del(m.sh); del(m.rk); }
    }
    S.mets = S.mets.filter(m => !m.done);
  }
  if (thr === 2) {
    S.patT += wdt; if (S.patT >= c.spawnEvery * 1.5 && S.pats.length < 8) { S.patT = 0; spawnPatrol(); }
    for (const p of S.pats) {
      if (p.stuck > 0) { p.stuck -= wdt; continue; }
      p.x += p.vx * gk * wdt; p.z += p.vz * gk * wdt;
      if (p.x < -AX + p.r || p.x > AX - p.r) { p.vx *= -1; p.x = clamp(p.x, -AX + p.r, AX - p.r); }
      if (p.z < -AZ + p.r || p.z > AZ - p.r) { p.vz *= -1; p.z = clamp(p.z, -AZ + p.r, AZ - p.r); }
      const dd = dist(h, p);
      if (S.shieldT > 0 && dd < 3) { const s2 = Math.hypot(p.vx, p.vz); p.vx = (p.x - h.x) / dd * s2; p.vz = (p.z - h.z) / dd * s2; }
      else if (dd < h.r + p.r - 0.15 && !air) hurt(p, 'Патруль: шёл по своей линии');
      if (goal === 5 && Math.hypot(p.x, p.z) < 2.2) { S.tHP--; p.vx *= -1; p.vz *= -1; popup(v2(0, 0), 'Сокровище −1', '#ff8a8a'); }
    }
  }
  if (thr === 3) {
    S.border = Math.min(8.5, S.border + c.foeSpeed * 0.025 * gk * wdt); const b = S.border;
    if (h.x - h.r < -AX + b || h.x + h.r > AX - b || h.z - h.r < -AZ + b || h.z + h.r > AZ - b) if (hurt(null, 'Огонь с края')) { h.x = clamp(h.x, -AX + b + 2, AX - b - 2); h.z = clamp(h.z, -AZ + b + 2, AZ - b - 2); }
  }
  if (thr === 4) {
    S.lava = Math.min(1.7, S.lava + c.foeSpeed * 0.006 * gk * wdt);
    if (S.lava > 0.08 && h.y < S.lava - 0.02) { S.d.lavaT += dt; if (hurt(null, 'Лава: стоял ниже её уровня')) { h.vy = 12; } }
  }
  if (thr === 5) {
    S.windT += wdt; if (S.windT > 8) { S.windT = 0; S.wind += rnd(1.2, 2.6) * (Math.random() < 0.5 ? -1 : 1); sfx.whoosh(); }
    if (Math.random() < dt * 14) burst({ x: h.x - Math.cos(S.wind) * 14 + rnd(-10, 10), z: h.z - Math.sin(S.wind) * 10 + rnd(-8, 8), y: rnd(0.5, 3) }, { count: 1, colors: [P().g[1], '#ffffff'], speed: 0.5, lift: 0, gravity: 0, life: 1.5 });
    S.logT += wdt; if (S.logT >= Math.max(0.8, c.spawnEvery * 0.6)) { S.logT = 0; const w = S.wind, side = rnd(-1, 1); const p = v2(clamp(-Math.cos(w) * AX + -Math.sin(w) * side * AZ, -AX, AX), clamp(-Math.sin(w) * AZ + Math.cos(w) * side * AX, -AZ, AZ)); const m = add(M(G.cyl(0.35, 0.35, 2.2, 6), '#7a5234', 0, 0.6, 0, { r: [0, 0, Math.PI / 2] })); m.position.set(p.x, 0.6, p.z); S.logs.push({ ...p, m, life: 6 }); }
    for (const l of S.logs) { const v = c.foeSpeed * 1.8 * gk * wdt; l.x += Math.cos(S.wind) * v; l.z += Math.sin(S.wind) * v; l.life -= wdt; l.m.rotation.y = -S.wind; l.m.children.length; if (dist(h, l) < 1.2 && !air) hurt(l, 'Бревно, его нёс ветер'); }
    S.logs = S.logs.filter(l => { const ok = l.life > 0 && Math.abs(l.x) < AX + 3 && Math.abs(l.z) < AZ + 3; if (!ok) del(l.m); return ok; });
  }
  if (thr === 6 && S.boss) bossStep(dt, wdt, gk, air);
  // ловушки
  for (const t of S.traps) for (const arr of [S.foes, S.pats, S.runners]) for (const f of arr) if (!f.stuck && dist(t, f) < 1.1) { f.stuck = 3; t.used = true; burst({ x: t.x, z: t.z }, { count: 8, colors: ['#d8d8e8'] }); sfx.zap(); }
  if (S.boss && !S.boss.down) for (const t of S.traps) if (!t.used && dist(t, S.boss) < 2.4) { t.used = true; S.boss.t += 1.5; S.boss.slow = 2; popup(S.boss, 'В капкане!'); }
  S.traps = S.traps.filter(t => { if (t.used) del(t.m); return !t.used; });
  // снаряды
  for (const u of S.bul) {
    u.x += u.vx * dt; u.z += u.vz * dt; u.life -= dt; u.m.position.set(u.x, 1.6, u.z);
    for (const arr of [S.foes, S.pats]) for (const f of arr) if (!f.dead && dist(u, f) < f.r + 0.3) { f.dead = true; u.life = 0; S.d.kills++; S.d.shotHits++; score += 5; popup(f, '+5'); burst({ x: f.x, z: f.z }, { count: 14, colors: [P().foe, '#ffffff'] }); sfx.boom(); }
    for (const t of S.runners) if (!t.got && dist(u, t) < t.r + 0.35) { t.got = true; u.life = 0; S.d.shotHits++; S.d.shotCatch++; onGoal(t.x, t.z, 20); }
    if (S.boss && !S.boss.down && u.life > 0 && dist(u, S.boss) < S.boss.r + 0.3) { u.life = 0; S.d.shotHits++; bossDamage(); }
  }
  S.bul = S.bul.filter(u => { const ok = u.life > 0 && Math.abs(u.x) < AX + 4 && Math.abs(u.z) < AZ + 4; if (!ok) del(u.m); return ok; });
  for (const arr of ['foes', 'pats']) S[arr] = S[arr].filter(f => { if (f.dead) { del(f.m); if (f.pl) del(f.pl); } return !f.dead; });
  // цели
  const magnet = verb === 4 && held.a, reach = h.r * h.scale;
  const pull = o => { if (!magnet) return; const dd = dist(h, o); if (dd < 10 && dd > 0.1) { o.x += (h.x - o.x) / dd * 12 * dt; o.z += (h.z - o.z) / dd * 12 * dt; } };
  if (goal === 0) {
    for (const it of S.items) { pull(it); if (dist(h, it) < reach + 0.6 && Math.abs(h.y - heightAt(it.x, it.z)) < 1.6) { it.got = true; onGoal(it.x, it.z, 10); } }
    S.items = S.items.filter(i => { if (i.got) del(i.m); return !i.got; }); while (S.items.length < 3) spawnItem();
  }
  if (goal === 1) {
    for (const t of S.runners) {
      if (t.stuck > 0) { t.stuck -= wdt; } else {
        const dd = dist(h, t);
        if (dd < 10.5) { let a = Math.atan2(t.z - h.z, t.x - h.x); if (Math.abs(t.x) > AX - 2.5 || Math.abs(t.z) > AZ - 2.5) a += (Math.sin(gt + t.hop) > 0 ? 1 : -1) * 1.1; t.vx = Math.cos(a) * c.heroSpeed * 0.74; t.vz = Math.sin(a) * c.heroSpeed * 0.74; }
        else { t.wt -= wdt; if (t.wt <= 0) { t.wt = rnd(1, 2.5); const a = Math.random() * 6.283; t.vx = Math.cos(a) * 2.6; t.vz = Math.sin(a) * 2.6; } }
        t.x = clamp(t.x + t.vx * wdt, -AX + t.r, AX - t.r); t.z = clamp(t.z + t.vz * wdt, -AZ + t.r, AZ - t.r);
      }
      pull(t);
      if (dist(h, t) < reach + t.r) { t.got = true; S.d.touchCatch++; onGoal(t.x, t.z, 20); }
    }
    S.runners = S.runners.filter(t => { if (t.got) del(t.m); return !t.got; }); while (S.runners.length < 3) spawnRunner();
  }
  if (goal === 2 && S.door && dist(h, S.door) < reach + 1.1) { onGoal(S.door.x, S.door.z, 50 * S.level); S.level++; placeDoor(); if (thr === 0) spawnFoe(); if (thr === 2) spawnPatrol(); if (S.boss) S.boss.tier++; }
  if (goal === 3) { score += 5 * dt * S.mult; S.survT += dt; if (S.survT >= 6) { S.survT = 0; S.d.goals++; if (near < 5.8) S.d.greedy++; if (tw === 1) { S.mult = Math.min(5, S.mult + 1); S.d.maxMult = Math.max(S.d.maxMult, S.mult); } if (tw === 2) S.light = Math.min(13, S.light + 4.5); if (thr === 3) S.border = Math.max(0, S.border - 1.9); if (thr === 4) S.lava = Math.max(0, S.lava - 0.35); } }
  if (goal === 4 || goal === 7) {
    if (!h.carry && S.cargo && dist(h, S.cargo) < reach + 0.8) { h.carry = S.cargo.m; S.cargo = null; S.pickGreedy = nearest() < 3.5; sfx.coin(); }
    if (h.carry) { S.d.carryT += dt; h.carry.position.set(h.x, h.y + 2.4 * h.scale, h.z); if (dist(h, S.padP) < 2) { del(h.carry); h.carry = null; if (goal === 7) { const bl = add(DESIGN.makeBlock ? DESIGN.makeBlock(S.blocks.length) : M(G.box(1.1, 0.7, 1.1), shade(P().acc, -0.1 + S.blocks.length * 0.02), 0, 0, 0, { emissive: P().acc, ei: 0.15 })); bl.position.set(S.padP.x, 0.6 + S.blocks.length * 0.72, S.padP.z); bl.rotation.y = S.blocks.length * 0.3; S.blocks.push(bl); } onGoal(S.padP.x, S.padP.z, goal === 7 ? 25 : 30, 'carry'); spawnCargo(); } }
  }
  if (goal === 5) { score += dt; if (S.tHP <= 0) endGame('Сокровище разрушено'); }
  if (goal === 6) {
    S.lapT += dt; S.lapRec.push([h.x, h.z]);
    const gte = S.gates[S.gateI]; if (gte && Math.hypot(h.x - gte.position.x, h.z - gte.position.z) < 2) { S.gateI++; onGoal(gte.position.x, gte.position.z, 15); if (S.gateI >= S.gates.length) { S.gateI = 0; S.lap++; score += 50; popup(h, `Круг ${S.lap}: ${S.lapT.toFixed(1)} с`, '#ffffff'); if (!S.bestLap || S.lapT < S.bestLap) { S.bestLap = S.lapT; S.ghostRec = S.lapRec.slice(); } S.lapT = 0; S.lapRec = []; } }
    S.gates.forEach((g, i) => { g.userData.ring.material = mat(i === S.gateI ? P().acc : '#8a8aa0', i === S.gateI ? { emissive: P().acc, ei: 0.9 } : {}); g.userData.ring.rotation.y += dt * (i === S.gateI ? 2 : 0); });
  }
  // повороты, которые зависят от кадра
  if (tw === 2) { S.light = Math.max(3.5, S.light - 0.55 * dt); S.d.lightSum += S.light * dt; }
  if (tw === 3) {
    S.trailT += dt; if (S.trailT >= 0.05) { S.trailT = 0; S.trail.push({ x: h.x, z: h.z, y: h.y, yaw: h.yaw, t: gt }); }
    while (S.trail.length && gt - S.trail[0].t > 3) S.trail.shift();
    if (gt > 3 && S.trail.length) { const gh = S.trail[0]; S.ghost.visible = true; S.ghost.position.set(gh.x, gh.y, gh.z); S.ghost.rotation.y = gh.yaw; const dd = Math.hypot(h.x - gh.x, h.z - gh.z); if (dd < 1.3 && dd > 0.05 && Math.abs(h.y - gh.y) < 1.2 && hurt(gh, 'Эхо: ты сам был здесь 3 с назад')) S.d.echoHurts++; }
  }
  // телеметрия динамики
  const d = S.d, cx = clamp(Math.floor((h.x + AX) / (AX * 2) * 24), 0, 23), cz = clamp(Math.floor((h.z + AZ) / (AZ * 2) * 14), 0, 13);
  d.heat[cz * 24 + cx] += dt;
  if (Math.abs(h.x) > AX - 4.5 || Math.abs(h.z) > AZ - 4.5) d.edge += dt;
  if (Math.abs(h.x) < AX * 0.4 && Math.abs(h.z) < AZ * 0.4) d.center += dt;
  const nn = nearest();
  if (isFinite(nn)) { d.distSum += Math.min(nn, 20) * dt; d.distT += dt; if (nn < 1.3 && S.nmArmed && gt - S.lastHurt > 0.4) { d.nm++; S.nmArmed = false; } if (nn > 3.3) S.nmArmed = true; }
  if (gt >= c.roundTime) endGame(goal === 5 ? 'Сокровище спасено' : 'Раунд пройден', true);
}

/* ---------- босс: три понятные атаки, каждая подсвечена заранее ---------- */
function bossStep(dt, wdt, gk, air) {
  const b = S.boss, h = S.h, p = P();
  if (b.down > 0) { b.down -= dt; b.m.rotation.z = Math.min(1.2, b.m.rotation.z + dt * 3); if (b.down <= 0) { b.hp = b.max; b.tier++; b.m.rotation.z = 0; sfx.power(); popup(b, 'Страж поднялся!', '#ffb35c'); } return; }
  const tgt = ci('goal') === 5 ? v2(0, 0) : h;
  if (!b.atk) {
    const dd = dist(b, tgt), a = Math.atan2(tgt.x - b.x, tgt.z - b.z); b.yaw = a;
    const v = cfg.foeSpeed * 0.42 * gk * (b.slow > 0 ? 0.3 : 1) * wdt; b.slow = Math.max(0, (b.slow || 0) - dt);
    if (dd > 3.5) { b.x += Math.sin(a) * v; b.z += Math.cos(a) * v; }
    b.t -= wdt;
    if (b.t <= 0) {
      const kind = dd < 6.5 ? 'slam' : Math.random() < 0.55 ? 'charge' : 'throw', tel = Math.max(0.6, 1.0 - b.tier * 0.08);
      if (kind === 'slam') { const z = add(ring(0.1, 4.6, p.foe, 0.4)); z.position.set(b.x, 0.07, b.z); b.atk = { type: 'slam', x: b.x, z: b.z, R: 4.6, t: tel, tel, zone: z, name: 'Удар о землю: красный круг' }; }
      if (kind === 'charge') { const dx = Math.sin(a), dz = Math.cos(a), len = Math.min(26, dd + 6); const z = add(new THREE.Mesh(new THREE.PlaneGeometry(2.8, len), new THREE.MeshBasicMaterial({ color: p.foe, transparent: true, opacity: 0.35, depthWrite: false }))); z.rotation.x = -Math.PI / 2; z.rotation.z = -a + Math.PI; z.position.set(b.x + dx * len / 2, 0.07, b.z + dz * len / 2); b.atk = { type: 'charge', x: b.x, z: b.z, dx, dz, len, w: 2.8, t: tel, tel, zone: z, name: 'Таран: красная дорожка' }; }
      if (kind === 'throw') { const rocks = []; for (let i = 0; i < 3; i++) { const q = v2(clamp(tgt.x + rnd(-4, 4) * (i > 0), -AX + 1, AX - 1), clamp(tgt.z + rnd(-3, 3) * (i > 0), -AZ + 1, AZ - 1)); const z = add(ring(0.1, 1.9, p.foe, 0.45)); z.position.set(q.x, 0.07, q.z); const rk = add(makeRock()); rocks.push({ ...q, R: 1.9, z, rk }); } b.atk = { type: 'throw', rocks, t: tel + 0.3, tel: tel + 0.3, zone: true, name: 'Камень: красное пятно' }; }
      sfx.warn(); tone(110, 0.5, 'sawtooth', 0.08, 70);
    }
  } else {
    const A = b.atk; A.t -= wdt; const k = 1 - Math.max(0, A.t) / A.tel;
    if (A.type === 'slam') { A.zone.material.opacity = 0.25 + k * 0.4; b.m.position.y = Math.sin(k * Math.PI) * 2.2; }
    if (A.type === 'charge') A.zone.material.opacity = 0.2 + k * 0.4;
    if (A.type === 'throw') for (const r of A.rocks) { r.rk.position.set(b.x + (r.x - b.x) * k, 3.5 + Math.sin(k * Math.PI) * 7, b.z + (r.z - b.z) * k); r.z.material.opacity = 0.25 + k * 0.45; }
    if (A.t <= 0 && !A.fired) {
      A.fired = true; const gap = zoneGap(A), hit = gap < -0.2 && !air;
      if (A.type === 'slam') { sfx.boom(); shake(0.9); burst({ x: A.x, z: A.z }, { count: 30, colors: [p.rock, p.foe, '#ffffff'], speed: 14 }); b.m.position.y = 0; }
      if (A.type === 'charge') { b.x = clamp(b.x + A.dx * A.len, -AX + 2, AX - 2); b.z = clamp(b.z + A.dz * A.len, -AZ + 2, AZ - 2); sfx.boom(); shake(0.6); burst({ x: b.x, z: b.z }, { count: 20, colors: [p.rock, '#ffffff'], speed: 10 }); }
      if (A.type === 'throw') { sfx.boom(); shake(0.4); for (const r of A.rocks) { burst({ x: r.x, z: r.z }, { count: 12, colors: [p.foe, p.rock], speed: 9 }); del(r.rk); del(r.z); } }
      if (hit) hurt(b, A.name); else if (gap < 2) { S.d.dodged++; popup(h, 'Увернулся!', '#c8ffd8'); }
      if (ci('goal') === 5 && (A.type === 'slam' ? Math.hypot(A.x, A.z) < A.R + 1.4 : A.type === 'throw' ? A.rocks.some(r => Math.hypot(r.x, r.z) < r.R + 1.4) : false)) { S.tHP -= 2; popup(v2(0, 0), 'Сокровище −2', '#ff8a8a'); }
      A.end = 0.35;
    }
    if (A.fired) { A.end -= dt; if (A.end <= 0) { if (A.zone && A.zone !== true) del(A.zone); b.atk = null; b.t = Math.max(1.1, 2.8 - gt * 0.015 - b.tier * 0.3); } }
  }
  if (dist(h, b) < b.r + h.r && !air && !(b.atk && b.atk.type === 'slam') && hurt(b, 'Задел стража')) { const dd = Math.max(0.1, dist(h, b)); h.x = clamp(h.x + (h.x - b.x) / dd * 3.5, -AX + 1, AX - 1); h.z = clamp(h.z + (h.z - b.z) / dd * 3.5, -AZ + 1, AZ - 1); }
}
function bossDamage() {
  const b = S.boss; b.hp--; S.d.bossDmg++; score += 2; sfx.zap(); burst({ x: b.x, z: b.z, y: 2.5 }, { count: 6, colors: [P().rock, '#ffffff'], speed: 6 }); b.m.scale.setScalar(1.08);
  if (b.hp <= 0) { b.down = 5; S.d.bossDowns++; if (b.atk) { if (b.atk.zone && b.atk.zone !== true) del(b.atk.zone); if (b.atk.rocks) b.atk.rocks.forEach(r => { del(r.rk); del(r.z); }); b.atk = null; } score += 150; popup(b, 'Страж повержен! +150', '#ffe08a'); sfx.win(); shake(0.8); burst({ x: b.x, z: b.z, y: 2 }, { count: 40, colors: [P().acc, P().rock, '#ffffff'], speed: 14 }); }
}

/* ---------- музыка ---------- */
const PENTA = [392, 440, 523, 587, 659, 784];
function music(dt) {
  const m = ci('music'); if (m === 0) return; S.beat += dt; const n = () => S.note++;
  if (m === 1 && S.beat > 0.75) { S.beat = 0; tone(pick(PENTA) / (n() % 4 ? 1 : 2), 0.9, 'sine', 0.035); }
  if (m === 2 && S.beat > 0.2) { S.beat = 0; const k = n() % 8; tone(k % 4 === 0 ? 110 : k % 2 ? 220 : 165, 0.08, 'square', 0.04); if (k % 2) noise(0.03, 0.04, 6000); }
  if (m === 3 && S.beat > 0.16) { S.beat = 0; const k = n() % 12, pat = [1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 0, 0]; if (pat[k]) { tone(k % 6 === 0 ? 90 : 140, 0.16, 'sine', 0.12, 55); noise(0.06, 0.08, 900); } if (k === 0 || k === 6) tone(pick([294, 330, 392, 440]), 0.5, 'triangle', 0.03); }
  if (m === 4 && S.beat > 1.6) { S.beat = 0; tone(pick(PENTA) / 2, 2.4, 'sine', 0.03); tone(pick(PENTA), 2.0, 'sine', 0.015, 0, 0.4); }
  if (m === 5 && S.beat > 0.14) { S.beat = 0; const k = n() % 16; tone([523, 659, 784, 659, 587, 698, 880, 698][k % 8], 0.1, 'square', 0.03); if (k % 4 === 0) tone(131, 0.12, 'triangle', 0.06); }
  if (m === 6 && S.beat > 0.5) { S.beat = 0; const k = n() % 8; tone([196, 196, 233, 262, 196, 175, 196, 147][k], 0.5, 'sawtooth', 0.025); if (k % 4 === 0) { tone(65, 0.4, 'sine', 0.15, 40); noise(0.2, 0.06, 400); } }
  if (m === 7 && S.beat > 0.32) { S.beat = 0; const k = n() % 8; tone([262, 330, 392, 466][k % 4] * (k > 3 ? 1.122 : 1), 0.25, 'triangle', 0.04); if (k % 2) noise(0.04, 0.03, 8000); }
}

/* ---------- отрисовка и камера ---------- */
let flashCol = '#ffffff';
function flash(c, a) { flashCol = c; flashA = Math.max(flashA, a); }
function placeHero() { const h = S.h, m = h.mesh; m.position.set(h.x, h.y, h.z); m.rotation.y = h.yaw; }
function camSnap() { camStep(1, true); }
function camStep(dt, snap) {
  const h = S.h, mode = ci('camera'); cam = mode === 3 ? camO : camP;
  let px, py, pz, lx, ly, lz;
  if (mode === 0) { px = h.x * 0.85; py = 21; pz = h.z * 0.6 + 17; lx = h.x * 0.85; ly = 0; lz = h.z * 0.6 + 0.5; }
  if (mode === 1) { let dy = ((h.yaw - S.camYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; S.camYaw += dy * Math.min(1, dt * 4); const fx = Math.sin(S.camYaw), fz = Math.cos(S.camYaw); px = h.x - fx * 9; py = h.y + 5.2; pz = h.z - fz * 9; lx = h.x + fx * 5; ly = h.y + 1.2; lz = h.z + fz * 5; }
  if (mode === 2) { px = h.x * 0.9; py = 6.5; pz = AZ + 15; lx = h.x * 0.9; ly = 1; lz = 0; }
  if (mode === 3) { px = h.x * 0.5 + 24; py = 26; pz = h.z * 0.5 + 24; lx = h.x * 0.5; ly = 0; lz = h.z * 0.5; }
  const k = snap ? 1 : Math.min(1, dt * 5);
  cam.position.x += (px - cam.position.x) * k; cam.position.y += (py - cam.position.y) * k; cam.position.z += (pz - cam.position.z) * k;
  S.look = S.look || new THREE.Vector3(lx, ly, lz); S.look.x += (lx - S.look.x) * k; S.look.y += (ly - S.look.y) * k; S.look.z += (lz - S.look.z) * k;
  if (shakeAmp > 0.01) { cam.position.x += (Math.random() - 0.5) * shakeAmp * cfg.shake; cam.position.y += (Math.random() - 0.5) * shakeAmp * cfg.shake; }
  cam.lookAt(S.look);
  sun.position.set(h.x - 18, 34, h.z + 16); sun.target.position.set(h.x, 0, h.z);
}
function render(dt) {
  const h = S.h, p = P(), tw = ci('twist'), verb = ci('verb');
  if (!h) return;
  // герой
  placeHero(); const body = h.mesh.userData.body, sp = Math.hypot(h.vx, h.vz), run = gt * 12;
  body.position.y = Math.abs(Math.sin(run)) * Math.min(0.25, sp * 0.03); body.rotation.x = Math.min(0.2, sp * 0.015);
  h.mesh.scale.setScalar(h.scale); h.mesh.visible = !(invuln > 0 && Math.floor(invuln * 16) % 2 === 0);
  body.traverse(o => { if (o.userData.leg) o.rotation.x = Math.sin(run * 1.2) * o.userData.leg * Math.min(0.8, sp * 0.08); if (o.userData.wing) o.rotation.y = Math.sin(gt * 22) * 0.4 * o.userData.wing; });
  if (body.userData.flame) body.userData.flame.scale.setScalar(1.2 + Math.random() * 0.8);
  h.mesh.userData.blob.position.y = heightAt(h.x, h.z) - h.y + 0.03;
  // шкала глагола кольцом у ног: видно, когда можно снова
  const full = verb === 5 ? S.energy : verb === 4 ? 1 : 1 - S.cd / Math.max(0.01, [1, 0.5, 3, 0.3, 1, 1, 1.5, 2, 2][verb] * cfg.verbCd);
  const fr = Math.max(0.001, Math.min(1, full));
  if (Math.abs((S.ringF || 0) - fr) > 0.02) { S.ringF = fr; S.ring.geometry.dispose(); S.ring.geometry = new THREE.RingGeometry(0.95, 1.12, 32, 1, Math.PI / 2, fr * Math.PI * 2); S.ring.material.color.set(fr >= 1 ? p.acc : '#9aa3c7'); }
  for (const r of [S.ring, S.ringBg]) { r.position.set(h.x, heightAt(h.x, h.z) + 0.06, h.z); r.scale.setScalar(h.scale); }
  if (S.shieldT > 0) { if (!S.shM) { S.shM = add(M(G.ico(2, 1), p.acc, 0, 0, 0, { emissive: p.acc, ei: 0.5, opacity: 0.25, shadow: false })); } S.shM.visible = true; S.shM.position.set(h.x, h.y + 1, h.z); S.shM.material.opacity = Math.min(0.3, S.shieldT * 0.4); } else if (S.shM) S.shM.visible = false;
  // сущности
  for (const it of S.items) { it.m.position.set(it.x, 1 + Math.sin(gt * 3 + it.ph) * 0.2 + heightAt(it.x, it.z), it.z); it.m.children[0].rotation.y += dt * 2; }
  for (const t of S.runners) { t.hop += dt * (Math.hypot(t.vx, t.vz) > 3 ? 14 : 5); t.m.position.set(t.x, Math.abs(Math.sin(t.hop)) * 0.35, t.z); if (Math.hypot(t.vx, t.vz) > 0.3) t.m.rotation.y = Math.atan2(t.vx, t.vz); t.m.traverse(o => { if (o.userData.leg) o.rotation.x = Math.sin(t.hop * 2) * o.userData.leg * 0.8; }); if (t.stuck > 0) t.m.rotation.z = Math.sin(gt * 20) * 0.1; }
  for (const f of S.foes) { f.hop = (f.hop || 0) + dt * 9; f.m.position.set(f.x, Math.abs(Math.sin(f.hop)) * 0.3, f.z); f.m.rotation.y = Math.atan2(h.x - f.x, h.z - f.z); }
  for (const q of S.pats) { if (q.pl) { const sp = Math.hypot(q.vx, q.vz) || 1; q.pl.position.set(q.x + q.vx / sp * 4.4, 0.07, q.z + q.vz / sp * 4.4); q.pl.rotation.y = Math.atan2(q.vx, q.vz); } q.m.position.set(q.x, 0, q.z); q.m.userData.ball.rotation.x += dt * 4; q.m.rotation.y = Math.atan2(q.vx, q.vz); }
  if (S.boss) { const b = S.boss; b.m.position.x = b.x; b.m.position.z = b.z; b.m.rotation.y = b.yaw; b.m.scale.setScalar(b.m.scale.x + (1 - b.m.scale.x) * Math.min(1, dt * 10)); }
  if (S.door) { S.door.m.userData.portal.material.opacity = 0.55 + Math.sin(gt * 5) * 0.2; }
  if (S.fire) { const b = S.border, k = 1 + Math.sin(gt * 9) * 0.08; const fs = S.fire.children; const w = Math.max(0.01, b); fs[0].scale.set(AX * 2, k, w); fs[0].position.set(0, 0.5, -AZ + w / 2); fs[1].scale.set(AX * 2, k, w); fs[1].position.set(0, 0.5, AZ - w / 2); fs[2].scale.set(w, k, AZ * 2); fs[2].position.set(-AX + w / 2, 0.5, 0); fs[3].scale.set(w, k, AZ * 2); fs[3].position.set(AX - w / 2, 0.5, 0); S.fire.visible = b > 0.05; }
  if (S.lavaM) { S.lavaM.position.y = S.lava - 0.05; S.lavaM.visible = S.lava > 0.02; }
  for (const l of S.logs) { l.m.position.set(l.x, 0.6, l.z); l.m.rotation.x += dt * 6; }
  if (S.treasure) S.treasure.rotation.y += dt * 0.6;
  // свет: тьма, день и ночь
  const dark = tw === 2 ? clamp((S.light - 3.5) / 9.5, 0, 1) : tw === 5 && !S.day ? 0.25 : 1;
  hemi.intensity = p.hi * (0.15 + 0.85 * dark); sun.intensity = p.si * (0.1 + 0.9 * dark);
  if (dark < 1) { if (!S.lamp) { S.lamp = new THREE.PointLight(p.acc, 2.2, 14, 1.6); scene.add(S.lamp); } S.lamp.visible = true; S.lamp.distance = tw === 2 ? S.light * 1.6 : 14; S.lamp.position.set(h.x, h.y + 2.5, h.z); scene.fog.near = tw === 2 ? S.light * 0.6 : 10; scene.fog.far = tw === 2 ? S.light * 2.6 + 6 : 40; } else if (S.lamp) { S.lamp.visible = false; scene.fog.near = 45; scene.fog.far = 120; }
  stepParts(dt); stepPopups(dt); shakeAmp = Math.max(0, shakeAmp * (1 - dt * 8));
}
function buildHUD() { labels(); }
function hud() {
  const goal = ci('goal'), tw = ci('twist'), left = Math.max(0, Math.ceil(cfg.roundTime - gt));
  $('#hScore').textContent = 'ОЧКИ ' + String(Math.floor(score)).padStart(5, '0'); $('#hLives').textContent = '♥'.repeat(Math.max(0, lives));
  const g = goal === 0 ? `${ITEM()}: ${S.d.goals}` : goal === 1 ? `поймано ${ITEM()}: ${S.d.goals}` : goal === 2 ? `дверь ${S.level}` : goal === 3 ? 'держись' : goal === 4 ? `доставлено: ${S.d.goals}${S.h.carry ? ' · несёшь груз' : ''}` : goal === 5 ? `сокровище: ${'◆'.repeat(Math.max(0, S.tHP))}` : goal === 6 ? `круг ${S.lap + 1} · ворота ${S.gateI + 1}/5${S.bestLap ? ' · лучший ' + S.bestLap.toFixed(1) + ' с' : ''}` : `башня: ${S.blocks.length}`;
  let extra = '';
  if (tw === 1 && S.mult > 1) extra += ` · ×${S.mult}`;
  if (tw === 4 && S.mirror) extra += ' · ⇄ зеркало';
  if (tw === 5) extra += S.day ? ' · день' : ' · ночь ×2';
  if (S.boss) extra += S.boss.down > 0 ? ' · страж повержен' : ` · страж ${'▮'.repeat(Math.ceil(S.boss.hp / S.boss.max * 10))}`;
  $('#hGoal').textContent = `${g} · ${left} с${extra}`;
  let w = '';
  if (tw === 4 && S.mirT > 10) w = Math.floor(gt * 6) % 2 ? `⇄ через ${Math.ceil(12 - S.mirT)}` : '';
  if (tw === 5 && S.dayT > 18) w = Math.floor(gt * 6) % 2 ? (S.day ? 'Скоро ночь' : 'Скоро день') : '';
  if (ci('threat') === 5) w = w || `ветер ${['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'][((Math.round(S.wind / (Math.PI / 4)) % 8) + 8) % 8]}`;
  $('#warn').textContent = w;
}

/* ---------- цикл ---------- */
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, Math.max(0, (now - last) / 1000)); last = now;
  try {
    readInput();
    if (state === 'play' && !paused && !errored) {
      if (hitstop > 0) hitstop -= dt; else { gt += dt; invuln = Math.max(0, invuln - dt); update(dt); }
      hud();
    }
    if (!paused) { render(state === 'play' ? dt : dt * 0.3); }
    if (state !== 'play' && S.h) { S.h.yaw += dt * 0.25; }
    camStep(dt);
    R.render(scene, cam);
    $('#cv').style.boxShadow = flashA > 0.01 ? `inset 0 0 0 9999px ${flashCol}${Math.round(flashA * 255).toString(16).padStart(2, '0')}` : 'none'; flashA = Math.max(0, flashA - dt * 1.8);
  } catch (e) { fail('в кадре', e); console.error(e); }
  requestAnimationFrame(frame);
}
function onKnob(k) {
  if (k === 'pal' || k === '*') buildWorld();
  if (state === 'play' && (k === '*' || (CONFIG[k] && CONFIG[k].card))) { gt = 0; score = 0; setupRun(); }
  if (['look', 'pal', 'goal', 'threat', 'twist', 'camera', 'verb', '*'].includes(k) && state !== 'play') setupRun();
  labels();
}
