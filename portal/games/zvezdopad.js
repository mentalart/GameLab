// «Звездопад над Фиштом» — образец игры на оболочке «Лаб3D 1.0» (three.js). Не донор урока: на нём видно весь API оболочки.
// Механика по мотивам граза из bullet hell (Touhou): за опасность, пролетевшую впритык, дают очки. Секрет — граз:
// метеорит, упавший рядом, но не по тебе, удваивает серию. Без секрета (пресет «Без секрета») от метеоритов только убегают.
// Ось Z в three.js смотрит на игрока: «вверх по экрану» — это −Z.
const GAME = {
  engine: 'three',
  title: 'Звездопад над Фиштом',
  subtitle: 'Ёжик собирает упавшие звёзды на плато Лаго-Наки. Метеориты бьют туда, где светится круг, — проскочи рядом!',
  donor: 'граза из bullet hell',
  players: 1,
  controls: [
    { input: 'move4', text: 'бежать' },
    { input: 'a', text: 'рывок (сквозь метеорит — без урона)' },
  ],
  camera: { type: 'iso', tilt: 0.85 },
  field: { w: 24, h: 18 },
  sky: ['#141a3f', '#d9776b'],
  fog: 0.012,
  accent: '#ffd76a',
  decisions: [
    'Чувство: звёзды звенят всё выше, пока серия не прервалась',
    'Честность: метеорит бьёт ровно в светящийся круг, круг виден заранее',
    'Выбор: обойти круг стороной или проскочить впритык ради удвоения серии',
  ],
  config: {
    speed: { value: 7.5, min: 3, max: 14, step: 0.5, label: 'Скорость ёжика' },
    accel: { value: 16, min: 4, max: 40, step: 1, label: 'Разгон и торможение', hint: 'меньше — скользко, как на льду' },
    dash: { value: 3, min: 1.5, max: 5, step: 0.1, label: 'Сила рывка' },
    dashCd: { value: 0.7, min: 0.1, max: 2, step: 0.05, label: 'Перезарядка рывка, с' },
    meteorEvery: { value: 1.8, min: 0.4, max: 4, step: 0.1, label: 'Метеорит раз в … с' },
    ramp: { value: 0.012, min: 0, max: 0.04, step: 0.002, label: 'Нарастание: быстрее на … с за секунду' },
    warnTime: { value: 1.2, min: 0.4, max: 2.5, step: 0.05, label: 'Предупреждение до удара, с' },
    radius: { value: 1.6, min: 0.8, max: 3, step: 0.1, label: 'Радиус удара' },
    aim: { value: 0.45, min: 0, max: 1, step: 0.05, label: 'Доля метеоритов в ёжика', hint: 'к 40-й секунде; стоять на месте опасно' },
    starEvery: { value: 1.1, min: 0.4, max: 4, step: 0.1, label: 'Новая звезда раз в … с' },
    starLife: { value: 7, min: 2, max: 12, step: 0.5, label: 'Звезда лежит, с' },
    secret: { value: 1, min: 0, max: 1, step: 1, label: 'Секрет: граз', hint: 'метеорит упал рядом, но не по тебе — серия удваивается' },
    graze: { value: 1.8, min: 1.2, max: 3, step: 0.1, label: 'Граз: зона «впритык», в радиусах удара' },
    lives: { value: 3, min: 1, max: 9, step: 1, label: 'Жизни', restart: true },
  },
  presets: {
    'Новичок': { meteorEvery: 2.3, ramp: 0.006, warnTime: 1.6, radius: 1.3, aim: 0.3, lives: 5 },
    'Без секрета': { secret: 0 },
    'Метеоритный дождь': { meteorEvery: 0.8, ramp: 0.02, warnTime: 0.9 },
  },
  notes: ['Звёзды не появляются ближе 3 м к ёжику: иначе их собирают стоя.'],

  start(lab, scene) {
    const st = lab.state;
    Object.assign(st, { stars: [], meteors: [], scars: [], starT: 0.3, meteorT: 5, combo: 0, comboT: 0, bestCombo: 0, got: 0, grazes: 0, dashes: 0 });
    this.world(lab, scene);
    st.hero = this.hedgehog(lab);
    lab.hero(st.hero.g);
  },

  update(lab, dt) {
    const st = lab.state, c = lab.cfg, h = st.hero, p = lab.p1;
    // бег: скорость догоняет желаемую плавно (ручка «Разгон»), рывок — короткий бросок со следом
    const want = Math.hypot(p.x, p.y) > 0.1 ? [p.x, -p.y] : [0, 0];
    h.cd -= dt;
    if (p.pressed.a && h.cd <= 0) {
      const dir = Math.hypot(want[0], want[1]) > 0 ? want : [Math.sin(h.face), Math.cos(h.face)], n = Math.hypot(dir[0], dir[1]);
      h.vx = dir[0] / n * c.speed * c.dash; h.vz = dir[1] / n * c.speed * c.dash;
      h.dashT = 0.2; h.cd = c.dashCd; st.dashes++;
      lab.sfx.whoosh(); lab.pulse(h.body, 1.35, 0.18); lab.count('рывки');
      const tr = lab.trail(h.body, { color: '#8fe8ff', width: 0.7, length: 14 });
      lab.after(0.45, () => tr.dispose());
    }
    if (h.dashT > 0) h.dashT -= dt;
    else { h.vx = lab.damp(h.vx, want[0] * c.speed, c.accel, dt); h.vz = lab.damp(h.vz, want[1] * c.speed, c.accel, dt); }
    const W = this.field.w / 2 - 0.7, H = this.field.h / 2 - 0.7;
    h.x = lab.clamp(h.x + h.vx * dt, -W, W); h.z = lab.clamp(h.z + h.vz * dt, -H, H);
    const sp = Math.hypot(h.vx, h.vz);
    if (sp > 0.5) h.face = Math.atan2(h.vx, h.vz);
    h.g.position.set(h.x, 0, h.z);
    h.g.rotation.y += (Math.atan2(Math.sin(h.face - h.g.rotation.y), Math.cos(h.face - h.g.rotation.y))) * Math.min(1, dt * 14);
    h.body.position.y = 0.62 + Math.abs(Math.sin(lab.t * 16)) * Math.min(0.12, sp * 0.02); // семенит на бегу
    h.g.visible = !lab.blink();

    this.stars(lab, dt);
    this.meteors(lab, dt);
    if (st.comboT > 0 && (st.comboT -= dt) <= 0) st.combo = 0;
    lab.hud('combo', st.combo > 1 ? `Серия ×${st.combo}` : 'Собирай звёзды подряд — растёт серия');
    lab.hud('dash', h.cd > 0 ? 'Рывок: перезарядка' : 'Рывок готов');
  },

  overNote(lab) {
    const st = lab.state;
    return [`Звёзд собрано: ${st.got}, лучшая серия ×${st.bestCombo}, рывков ${st.dashes}`,
      lab.cfg.secret ? `Метеоритов впритык: ${st.grazes} — каждый удваивал серию` : 'Секрет выключен: метеориты только мешают. Включи «Как задумано» и сравни.'];
  },

  /* ---------- мир: плато, горы, пихты, камни по краю поля ---------- */
  world(lab, scene) {
    const T = lab.THREE, F = this.field;
    lab.ground({ w: 120, h: 120, color: '#3f8f3f', bumps: 3, flat: 0.25 });
    lab.box(F.w + 0.4, 0.06, F.h + 0.4, '#58a548', { at: [0, 0.03, 0], shadow: false }); // светлая поляна — где играем
    // горы вдали: конусы со снежными шапками, слиты в один меш на цвет
    const hills = [];
    for (let i = 0; i < 9; i++) {
      const x = -60 + i * 15 + lab.rand(-4, 4), z = -42 - lab.rand(0, 14), r = lab.rand(9, 16), hgt = lab.rand(14, 26);
      hills.push(lab.cone(r, hgt, '#5a6788', { at: [x, hgt / 2 - 1, z], sides: 6, rot: lab.rand(0, 3) }));
      hills.push(lab.cone(r * 0.38, hgt * 0.38, '#f4f6ff', { at: [x, hgt - 1 - hgt * 0.19 + 0.05, z], sides: 6, rot: lab.rand(0, 3) }));
    }
    lab.merge(hills);
    // пихты — копии одного дерева: 120 деревьев, 3 вызова отрисовки
    const N = 120, crown = lab.instances(new T.ConeGeometry(1, 2.4, 7), '#2f6b45', N * 2), trunk = lab.instances(new T.CylinderGeometry(0.18, 0.24, 1, 6), '#6b4a32', N);
    for (let i = 0; i < N; i++) {
      let x, z; do { x = lab.rand(-48, 48); z = lab.rand(-40, 30); } while (Math.abs(x) < F.w / 2 + 2 && Math.abs(z) < F.h / 2 + 2);
      const s = lab.rand(0.8, 1.6);
      lab.place(trunk, i, [x, 0.5 * s, z], { scale: s });
      lab.place(crown, i * 2, [x, 1.9 * s, z], { scale: [s * 1.2, s, s * 1.2], rot: lab.rand(0, 3) });
      lab.place(crown, i * 2 + 1, [x, 2.9 * s, z], { scale: [s * 0.85, s * 0.8, s * 0.85], rot: lab.rand(0, 3) });
    }
    // камни по краю поля: граница видна, за неё не выбежать
    const rocks = lab.instances(new T.IcosahedronGeometry(0.5, 0), '#8d8a86', 70);
    for (let i = 0; i < 70; i++) {
      const k = i / 70 * 2 * (F.w + F.h), side = k < F.w ? 0 : k < F.w + F.h ? 1 : k < 2 * F.w + F.h ? 2 : 3;
      const x = side === 0 ? -F.w / 2 + k : side === 2 ? F.w / 2 - (k - F.w - F.h) : side === 1 ? F.w / 2 : -F.w / 2;
      const z = side === 1 ? -F.h / 2 + (k - F.w) : side === 3 ? F.h / 2 - (k - 2 * F.w - F.h) : side === 0 ? -F.h / 2 : F.h / 2;
      lab.place(rocks, i, [x + lab.rand(-0.2, 0.2), 0.2, z + lab.rand(-0.2, 0.2)], { scale: [lab.rand(0.7, 1.4), lab.rand(0.5, 1), lab.rand(0.7, 1.3)], rot: lab.rand(0, 6) });
    }
    // луна и звёзды на небе
    lab.ball(4, '#fff3c4', { at: [-30, 38, -70], unlit: true, glow: 0.8, detail: 2, shadow: false });
    const pts = [];
    for (let i = 0; i < 300; i++) { const a = lab.rand(0, Math.PI * 2), e = lab.rand(0.15, 1.2); pts.push(Math.cos(a) * Math.cos(e) * 150, Math.sin(e) * 150, Math.sin(a) * Math.cos(e) * 150); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
    scene.add(new T.Points(g, new T.PointsMaterial({ color: '#ffffff', size: 0.8, fog: false })));
  },

  hedgehog(lab) {
    const g = lab.group(), body = lab.group({ parent: g, at: [0, 0.5, 0], scale: 1.3 });
    lab.ball(0.55, '#8a5a3c', { parent: body, scale: [1, 0.8, 1.15] });
    for (let i = 0; i < 9; i++) { // иголки
      const a = -0.6 + (i % 3) * 0.6, b = Math.floor(i / 3) * 0.55 - 0.7;
      lab.cone(0.16, 0.6, '#4a3122', { parent: body, at: [Math.sin(a) * 0.45, 0.3 + Math.cos(b) * 0.12, -0.15 + b * 0.5], rot: [-1.1 + b * 0.4, 0, -a], sides: 5 });
    }
    lab.ball(0.3, '#e9c7a2', { parent: body, at: [0, -0.02, 0.5], scale: [1, 0.8, 1.2] });
    lab.ball(0.1, '#ff6f91', { parent: body, at: [0, 0.02, 0.84], detail: 0 });
    for (const s of [-1, 1]) lab.ball(0.07, '#111111', { parent: body, at: [s * 0.2, 0.18, 0.6], detail: 0, shiny: true });
    g.rotation.y = Math.PI;
    return { g, body, x: 0, z: 3, vx: 0, vz: 0, face: Math.PI, cd: 0, dashT: 0 };
  },

  /* ---------- звёзды: лежат и мигают перед тем, как погаснуть ---------- */
  stars(lab, dt) {
    const st = lab.state, c = lab.cfg, h = st.hero, F = this.field;
    if ((st.starT -= dt) <= 0 && st.stars.length < 5) {
      st.starT = c.starEvery;
      let x, z, tries = 0; do { x = lab.rand(-F.w / 2 + 1.5, F.w / 2 - 1.5); z = lab.rand(-F.h / 2 + 1.5, F.h / 2 - 1.5); } while (Math.hypot(x - h.x, z - h.z) < 3 && ++tries < 20);
      const m = lab.mesh(new lab.THREE.OctahedronGeometry(0.42), '#ffd34d', { at: [x, 0.8, z], glow: 1.4, shiny: true });
      lab.pulse(m, 1.8, 0.3); lab.ring([x, 0, z], { color: '#ffd34d', radius: 1.2 });
      st.stars.push({ m, x, z, life: c.starLife });
    }
    st.stars = st.stars.filter(s => {
      s.life -= dt;
      s.m.rotation.y += dt * 2.5; s.m.position.y = 0.8 + Math.sin(lab.t * 3 + s.x) * 0.15;
      s.m.visible = s.life > 2 || Math.floor(s.life * 8) % 2 === 0;
      if (Math.hypot(s.x - h.x, s.z - h.z) < 1.4) { this.collect(lab, s); return false; }
      if (s.life <= 0) { s.m.removeFromParent(); lab.burst(s.m, { count: 6, color: '#887744', speed: 2 }); return false; }
      return true;
    });
  },
  collect(lab, s) {
    const st = lab.state;
    st.combo++; st.comboT = 2.6; st.got++; st.bestCombo = Math.max(st.bestCombo, st.combo);
    const pts = 10 * st.combo;
    lab.addScore(pts, [s.x, 1.4, s.z], st.combo > 4 ? '#ffffff' : '#ffd76a');
    lab.tone(880 * lab.pitch(st.combo - 1), 0.12, 'triangle', 0.1); lab.tone(1320 * lab.pitch(st.combo - 1), 0.14, 'sine', 0.06, 0, 0.05);
    lab.burst([s.x, 0.8, s.z], { count: 18, colors: ['#ffd34d', '#fff6c8', '#ff9f43'], speed: 6, up: 2 });
    lab.ring([s.x, 0, s.z], { color: '#ffe68a', radius: 2 });
    lab.pulse(st.hero.body, 1.3, 0.14); lab.vibrate(40, 0.25);
    lab.count('звёзды');
    s.m.removeFromParent();
  },

  /* ---------- метеориты: круг на земле → удар ровно в круг ---------- */
  meteors(lab, dt) {
    const st = lab.state, c = lab.cfg, h = st.hero, F = this.field;
    if ((st.meteorT -= dt) <= 0) {
      st.meteorT = Math.max(0.35, c.meteorEvery - lab.t * c.ramp);
      let x, z;
      // прицельных всё больше: стоять на месте опасно
      if (lab.chance(c.aim * Math.min(1, 0.4 + lab.t / 40))) { x = h.x + h.vx * c.warnTime * 0.4 + lab.rand(-1, 1); z = h.z + h.vz * c.warnTime * 0.4 + lab.rand(-1, 1); }
      else { x = lab.rand(-F.w / 2, F.w / 2); z = lab.rand(-F.h / 2, F.h / 2); }
      x = lab.clamp(x, -F.w / 2 + 0.5, F.w / 2 - 0.5); z = lab.clamp(z, -F.h / 2 + 0.5, F.h / 2 - 0.5);
      const from = [x + 9, 26, z - 14], m = lab.ball(0.6, '#ff6a3d', { at: from, glow: 1.6, detail: 0 });
      lab.noShadow(m);
      st.meteors.push({ m, x, z, from, t: 0, T: c.warnTime, r: c.radius, warn: lab.warn([x, 0, z], c.radius, c.warnTime, '#ff4d3a'), trail: lab.trail(m, { color: '#ff7a2e', width: 0.8, length: 10 }) });
      lab.sfx.warn();
    }
    st.meteors = st.meteors.filter(e => {
      e.t += dt;
      const k = Math.min(1, e.t / e.T);
      e.m.position.set(lab.lerp(e.from[0], e.x, k), lab.lerp(e.from[1], 0.3, k), lab.lerp(e.from[2], e.z, k));
      e.m.rotation.x += dt * 9;
      if (k < 1) return true;
      this.impact(lab, e);
      return false;
    });
    st.scars = st.scars.filter(s => { s.t -= dt; s.m.material.opacity = Math.min(0.55, s.t / 3); if (s.t > 0) return true; s.m.removeFromParent(); s.m.material.dispose(); return false; });
  },
  impact(lab, e) {
    const st = lab.state, c = lab.cfg, h = st.hero, d = Math.hypot(h.x - e.x, h.z - e.z), at = [e.x, 0.3, e.z];
    e.m.removeFromParent(); e.warn.dispose();
    lab.burst(at, { count: 30, colors: ['#ff6a3d', '#ffd34d', '#5a3a2a'], speed: 9, up: 3 });
    lab.ring(at, { color: '#ff8a4d', radius: e.r * 1.8 });
    lab.sfx.explode(); lab.shake(d < e.r * 3 ? 0.55 : 0.25);
    const scar = lab.mesh(new lab.THREE.CircleGeometry(e.r * 0.8, 9), new lab.THREE.MeshBasicMaterial({ color: '#2a1d18', transparent: true, opacity: 0.55, depthWrite: false }), { at: [e.x, 0.07, e.z], rot: [-Math.PI / 2, 0, 0], shadow: false });
    st.scars.push({ m: scar, t: 4 });
    if (d < e.r) {
      if (h.dashT > 0) { lab.popup([h.x, 1.6, h.z], 'Сквозь!', '#8fe8ff', 20); return; }
      lab.hurt([h.x, 0.6, h.z], 'Метеорит попал в ёжика');
      st.combo = 0;
    } else if (c.secret && d < e.r * c.graze) { // граз: впритык, но мимо — серия удваивается
      st.combo = Math.max(1, st.combo * 2); st.comboT = 2.6; st.grazes++; st.bestCombo = Math.max(st.bestCombo, st.combo);
      lab.addScore(25, [h.x, 1.8, h.z], '#8fe8ff');
      lab.popup([h.x, 2.4, h.z], `Впритык! Серия ×${st.combo}`, '#8fe8ff', 22);
      lab.slowmo(0.35, 0.35); lab.hitstop(0.04); lab.whiten(h.body, 0.08, '#bff4ff'); lab.tone(1560, 0.2, 'sine', 0.08, 2400);
      lab.count('_secret');
    }
  },
};
