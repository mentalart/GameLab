// «Башня до неба» — ремейк-донор урока 8 по мотивам Stack (Ketchapp, 2016): одна кнопка ставит каменную плиту на башню над плато Лаго-Наки.
// Плита ездит туда-сюда, нажатие её останавливает, всё, что свисает, отрезается и падает. Чем выше башня, тем ближе небо: день, закат, звёзды.
// Спрятанная механика донора — окно «идеально»: промах на пару сантиметров засчитывается как точное попадание, плита встаёт ровно,
// а серия точных попаданий возвращает плите ширину. Ручка secret = 0 (пресет «Без спрятанной механики») — честная линейка без прощения.
// Вдвоём (ручка duel) — две башни рядом: у каждого своя кнопка, выше — победил.
const GAME = {
  title: 'Башня до неба',
  subtitle: 'Одна кнопка. Останови плиту ровно над башней — и строй выше облаков!',
  donor: 'Stack',
  players: 1,
  duo: 'duel', // ручка duel = 1 — две башни рядом
  controls: [
    { input: 'a', text: 'поставить плиту' },
  ],
  camera: 'iso',
  field: { w: 12, h: 12 },
  sky: '#8fd3ff',
  fog: 0.006,
  accent: '#ffd23f',
  lives: 3,
  decisions: [
    'Чувство: поймал момент — плита встала ровно, и нота стала выше',
    'Честность: видно, что свисает, — ровно это и отрежется',
    'Выбор: ждать идеального момента или жать сразу, пока плита не разогналась',
  ],
  config: {
    size: { value: 3.4, min: 1.5, max: 6, step: 0.1, label: 'Ширина первой плиты, м', restart: true },
    speed: { value: 3.2, min: 1, max: 8, step: 0.1, label: 'Скорость плиты, м/с' },
    speedup: { value: 0.07, min: 0, max: 0.3, step: 0.01, label: 'Разгон за каждую плиту' },
    maxSpeed: { value: 7, min: 2, max: 14, step: 0.5, label: 'Предельная скорость' },
    range: { value: 4.2, min: 2, max: 8, step: 0.2, label: 'Размах хода плиты, м' },
    thick: { value: 0.5, min: 0.2, max: 1.2, step: 0.05, label: 'Толщина плиты, м', restart: true },
    snap: { value: 0.12, min: 0, max: 0.4, step: 0.01, label: 'Окно «идеально», м', hint: 'промах меньше окна — плита встаёт ровно' },
    grow: { value: 4, min: 1, max: 12, step: 1, label: 'Серия «идеально», которая расширяет плиту' },
    growBy: { value: 0.25, min: 0, max: 1, step: 0.05, label: 'На сколько расширить, м' },
    lives: { value: 3, min: 1, max: 5, step: 1, label: 'Плит, которые можно уронить', restart: true },
    secret: { value: 1, min: 0, max: 1, step: 1, label: 'Спрятанная механика: окно «идеально» и рост за серию' },
    duel: { value: 0, min: 0, max: 1, step: 1, label: 'Вдвоём: две башни', restart: true },
  },
  presets: {
    'Новичок': { speed: 2.2, speedup: 0.03, snap: 0.2, size: 4.2 },
    'Без спрятанной механики': { secret: 0 },
    'Вдвоём': { duel: 1 },
    'Ветер': { speed: 4.5, speedup: 0.12, maxSpeed: 10, range: 5.5 },
  },

  NOTES: [262, 294, 330, 392, 440, 523, 587, 659, 784, 880], // пентатоника вверх: каждая точная плита — нота выше

  start(lab, scene) {
    const st = lab.state, c = lab.cfg, two = lab.players === 2;
    lab.setCamera({ type: 'iso', alpha: -Math.PI / 2 - 0.72, beta: 1.12, target: [0, 2.5, 0], distance: two ? 25 : 18 });
    Object.assign(st, { towers: [], falls: [], sky: 0, offs: [], best: 0, cloudY: 14 });
    this.world(lab, scene);
    const players = two ? [[-3.6, lab.p1, 'Синий'], [3.6, lab.p2, 'Красный']] : [[0, lab.p1, '']];
    players.forEach(([x, pad, name], i) => st.towers.push(this.tower(lab, scene, x, pad, name, i)));
    if (two) lab.lives = 0; // вдвоём у каждой башни свои сердца — в строке счёта
    lab.hud('top', '');
  },

  update(lab, dt) {
    const st = lab.state, c = lab.cfg;
    for (const T of st.towers) {
      if (T.out) continue;
      if (T.wait > 0) { T.wait -= dt; if (T.wait <= 0) this.spawn(lab, T); continue; }
      this.slide(lab, T, dt);
      if (T.pad.pressed.a) this.place(lab, T);
    }
    // обрезки падают и кувыркаются
    st.falls = st.falls.filter(f => {
      f.vy -= 22 * dt; f.m.position.x += f.vx * dt; f.m.position.y += f.vy * dt; f.m.position.z += f.vz * dt;
      f.m.rotation.x += f.rx * dt; f.m.rotation.z += f.rz * dt; f.t += dt;
      if (f.t > 2.2) { f.m.dispose(); return false; }
      return true;
    });
    const top = Math.max(...st.towers.map(T => T.n));
    this.camera(lab, dt, top);
    this.skyAt(lab, top * c.thick);
    this.eagle(lab);
    const live = st.towers.filter(T => !T.out);
    if (!live.length && !st.ended) {
      st.ended = true;
      if (st.towers.length === 2) {
        const [a, b] = st.towers;
        lab.win(a.n === b.n ? `Ничья: по ${a.n} плит` : `${a.n > b.n ? a.name : b.name} выше: ${Math.max(a.n, b.n)} плит против ${Math.min(a.n, b.n)}`);
      } else lab.gameOver(`Башня в ${st.towers[0].n} плит, ${(st.towers[0].n * c.thick).toFixed(1)} м`);
    }
    lab.hud('top', st.towers.map(T => (T.name ? T.name + ': ' : '') + `плит ${T.n} · серия ${T.combo}` + (lab.players === 2 ? ' ' + '♥'.repeat(Math.max(0, T.lives)) : '')).join('   '));
  },

  overNote(lab) {
    const st = lab.state, offs = st.offs;
    const avg = offs.length ? Math.round(100 * offs.reduce((a, b) => a + b, 0) / offs.length) : 0;
    const T = st.towers[0];
    return [`Плит: ${st.towers.map(t => t.n).join(' и ')}, идеально: ${st.towers.map(t => t.perfect).join(' и ')}, лучшая серия ${st.best}`,
      offs.length ? `Промах в среднем ${avg} см от края башни` : 'Ни одной плиты — нажми, когда плита над башней',
      lab.cfg.secret ? `Окно «идеально» поймало ${T.saved} промахов на пару сантиметров` : 'Спрятанная механика выключена: каждый сантиметр промаха отрезается'];
  },

  /* ---------- башня: плиты, ход, постановка ---------- */
  tower(lab, scene, x0, pad, name, i) {
    const c = lab.cfg, st = lab.state;
    const T = { x0, pad, name, i, n: 0, combo: 0, perfect: 0, saved: 0, lives: c.lives, wait: 0, blocks: [], out: false, dir: 1, mv: null };
    // подножие: широкий камень на плато
    const base = BABYLON.MeshBuilder.CreateBox('подножие', { width: c.size + 0.6, height: 1.2, depth: c.size + 0.6 }, scene);
    base.material = lab.mat('#8d7b68'); base.position.set(x0, -0.6, 0);
    T.top = { x: x0, z: 0, w: c.size, d: c.size, y: 0 };
    this.spawn(lab, T);
    return T;
  },
  color(lab, n, i) {
    // плиты меняют оттенок с высотой, как слои горы: 36 оттенков на круг — материалы из кэша
    const h = (((i ? 200 : 20) + n * 9) % 360) / 360, s = 0.62, l = 0.6;
    const f = k => { const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; let t = h + k; if (t < 0) t += 1; if (t > 1) t -= 1;
      return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return '#' + [1 / 3, 0, -1 / 3].map(k => Math.round(f(k) * 255).toString(16).padStart(2, '0')).join('');
  },
  slab(lab, w, d, color) {
    const m = BABYLON.MeshBuilder.CreateBox('плита', { width: 1, height: lab.cfg.thick, depth: 1 }, lab.scene);
    m.scaling.set(w, 1, d); m.material = lab.mat(color);
    return m;
  },
  spawn(lab, T) {
    const c = lab.cfg, t = T.top, axis = T.n % 2 ? 'z' : 'x';
    const m = this.slab(lab, t.w, t.d, this.color(lab, T.n + 1, T.i));
    const mv = { m, axis, x: t.x, z: t.z, w: t.w, d: t.d, y: (T.n + 0.5) * c.thick };
    const from = (axis === 'x' ? t.x : t.z) + (T.n % 4 < 2 ? -1 : 1) * c.range;
    mv[axis] = from; T.dir = from < (axis === 'x' ? t.x : t.z) ? 1 : -1;
    T.mv = mv; this.drawMv(T);
  },
  drawMv(T) { const v = T.mv; v.m.position.set(v.x, v.y, v.z); },
  slide(lab, T, dt) {
    const c = lab.cfg, v = T.mv, a = v.axis, mid = a === 'x' ? T.top.x : T.top.z;
    const sp = Math.min(c.maxSpeed, c.speed + c.speedup * T.n);
    v[a] += T.dir * sp * dt;
    if (v[a] > mid + c.range) { v[a] = mid + c.range; T.dir = -1; }
    if (v[a] < mid - c.range) { v[a] = mid - c.range; T.dir = 1; }
    this.drawMv(T);
  },
  place(lab, T) {
    const c = lab.cfg, st = lab.state, v = T.mv, a = v.axis, sz = a === 'x' ? 'w' : 'd', t = T.top;
    const delta = v[a] - t[a], over = Math.abs(delta), size = v[sz];
    st.offs.push(over);
    if (c.secret && over <= c.snap) { // окно «идеально»: плита встаёт ровно
      v[a] = t[a];
      if (over > 0.005) { T.saved++; lab.count('_secret'); }
      T.combo++; T.perfect++; st.best = Math.max(st.best, T.combo);
      lab.count('идеально');
      if (T.combo >= c.grow && c.growBy > 0) this.widen(lab, T);
      this.settle(lab, T, true);
      return;
    }
    T.combo = 0;
    if (over >= size) return this.topple(lab, T); // мимо башни — плита падает целиком
    const keep = size - over, cx = t[a] + delta / 2;
    // отрезок: то, что свисало, падает в сторону промаха
    const cut = this.slab(lab, a === 'x' ? over : v.w, a === 'x' ? v.d : over, this.color(lab, T.n + 1, T.i));
    const cpos = cx + Math.sign(delta) * (keep / 2 + over / 2);
    cut.position.set(a === 'x' ? cpos : v.x, v.y, a === 'x' ? v.z : cpos);
    st.falls.push({ m: cut, t: 0, vy: 1.5, vx: a === 'x' ? Math.sign(delta) * 2 : 0, vz: a === 'z' ? Math.sign(delta) * 2 : 0, rx: a === 'z' ? Math.sign(delta) * 3 : 0, rz: a === 'x' ? -Math.sign(delta) * 3 : 0 });
    v[sz] = keep; v[a] = cx;
    v.m.scaling.set(v.w, 1, v.d);
    lab.count('срезано, см', Math.round(over * 100));
    lab.burst(cut, { count: 8, colors: ['#ffffff', '#d9cbb8'], speed: 3, up: 1 });
    lab.shake(Math.min(0.35, over * 0.5));
    this.settle(lab, T, false);
  },
  widen(lab, T) {
    const v = T.mv, a = v.axis === 'x' ? 'w' : 'd', max = lab.cfg.size;
    if (v[a] >= max - 0.01) return;
    v[a] = Math.min(max, v[a] + lab.cfg.growBy); v.m.scaling.set(v.w, 1, v.d);
    lab.popup(v.m, 'Шире!', '#7cf5a8', 22); lab.flash('#ffffff', 0.25);
  },
  settle(lab, T, perfect) {
    const v = T.mv, c = lab.cfg;
    this.drawMv(T); // плита встаёт туда, где её засчитали
    T.blocks.push(v.m); T.n++;
    T.top = { x: v.x, z: v.z, w: v.w, d: v.d, y: v.y };
    lab.count('плиты');
    lab.addScore(perfect ? 10 + 5 * Math.min(T.combo, 6) : 10, v.m, perfect ? '#ffd23f' : '#ffffff');
    lab.pulse(v.m, perfect ? 0.12 : 0.06, 0.18);
    const note = this.NOTES[perfect ? Math.min(T.combo - 1, this.NOTES.length - 1) : 0];
    lab.tone(note * (perfect ? 1 : 0.5), perfect ? 0.22 : 0.12, perfect ? 'triangle' : 'square', perfect ? 0.13 : 0.07);
    if (perfect) {
      lab.hitstop(0.035); lab.whiten(v.m, 0.09);
      lab.burst([v.x, v.y + c.thick / 2, v.z], { count: 14 + 2 * Math.min(T.combo, 8), colors: ['#ffd23f', '#ffffff', '#ff8ad8'], speed: 4, up: 1.5 });
      lab.popup(v.m, T.combo > 1 ? `Идеально ×${T.combo}` : 'Идеально!', '#ffd23f', 20 + Math.min(T.combo, 6) * 2);
    }
    // старые плиты далеко внизу убираем: камера их уже не видит
    if (T.blocks.length > 34) T.blocks.shift().dispose();
    if (T.n === 30) lab.popup(v.m, 'Выше облаков!', '#ffffff', 26);
    this.spawn(lab, T);
  },
  topple(lab, T) {
    const st = lab.state, v = T.mv;
    st.falls.push({ m: v.m, t: 0, vy: 0, vx: 0, vz: 0, rx: 1.4, rz: 1.1 });
    T.lives--; T.mv = null; lab.count('уронено');
    if (lab.players === 1) lab.lives = T.lives;
    if (T.lives > 0) T.wait = 0.6; else T.out = true;
    lab.tone(196, 0.5, 'sawtooth', 0.12, 60); lab.noise(0.3, 0.12, 900);
    lab.shake(0.5); lab.vibrate(250, 0.8);
    lab.popup([v.x, v.y, v.z], T.lives > 0 ? 'Мимо башни!' : 'Башня готова', '#ff6b6b', 24);
    if (st.towers.every(t => t.out)) lab.slowmo(0.8, 0.35);
  },

  /* ---------- камера и небо ---------- */
  camera(lab, dt, top) {
    const t = lab.camera.target, k = 1 - Math.exp(-dt * 3);
    t.y = lab.lerp(t.y, 2.5 + top * lab.cfg.thick, k); // вершина башни чуть ниже середины экрана: видно небо
  },
  SKY: [[0, [143, 211, 255]], [9, [255, 196, 140]], [16, [214, 110, 140]], [24, [44, 40, 98]], [40, [10, 12, 36]]],
  skyAt(lab, h) {
    const S = this.SKY; let i = 0;
    while (i < S.length - 2 && h > S[i + 1][0]) i++;
    const [h0, c0] = S[i], [h1, c1] = S[i + 1], k = lab.clamp((h - h0) / (h1 - h0), 0, 1);
    const rgb = c0.map((x, j) => (x + (c1[j] - x) * k) / 255);
    const sc = lab.scene;
    sc.clearColor.r = rgb[0]; sc.clearColor.g = rgb[1]; sc.clearColor.b = rgb[2];
    if (sc.fogColor) sc.fogColor.set(rgb[0], rgb[1], rgb[2]);
    if (lab.state.stars) lab.state.stars.visibility = lab.clamp((h - 14) / 10, 0, 1);
  },

  eagle(lab) { // орёл кружит над вершиной башни
    const e = lab.state.eagle, t = lab.t * 0.4;
    e.position.set(Math.cos(t) * 12, lab.camera.target.y + 5, Math.sin(t) * 12); e.rotation.y = -t; e.rotation.z = Math.sin(lab.t * 3) * 0.2;
  },

  /* ---------- мир: плато, горы, аул, облака, звёзды ---------- */
  part(lab, mesh, color, x = 0, y = 0, z = 0, o) { mesh.material = lab.mat(color, o || {}); mesh.position.set(x, y, z); return mesh; },
  merge(parts, name) {
    const groups = new Map();
    parts.forEach(p => groups.set(p.material, (groups.get(p.material) || []).concat(p)));
    const pieces = [...groups.values()].map(g => (g.length > 1 ? BABYLON.Mesh.MergeMeshes(g, true, true) : g[0]));
    const m = pieces.length > 1 ? BABYLON.Mesh.MergeMeshes(pieces, true, true, undefined, false, true) : pieces[0];
    m.name = name; return m;
  },
  world(lab, scene) {
    const MB = BABYLON.MeshBuilder, st = lab.state;
    lab.ground({ w: 220, h: 220, color: '#4f9a4a', y: -1.2 });
    // горы вокруг плато
    const peaks = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + 0.3, r = 46 + (i % 3) * 9, h = 16 + ((i * 7) % 5) * 5;
      peaks.push(this.part(lab, MB.CreateCylinder('гора', { height: h, diameterTop: 0, diameterBottom: h * 1.4, tessellation: 5 }, scene), i % 2 ? '#6a7fa8' : '#7d8fb5', Math.cos(a) * r, h / 2 - 1.2, Math.sin(a) * r));
      peaks.push(this.part(lab, MB.CreateCylinder('снег', { height: h * 0.28, diameterTop: 0, diameterBottom: h * 0.4, tessellation: 5 }, scene), '#ffffff', Math.cos(a) * r, h * 0.86 - 1.2, Math.sin(a) * r));
    }
    lab.noShadow(this.merge(peaks, 'горы'));
    // аул у подножия: сакли и деревья
    const aul = [];
    [[-17, 11], [-22, -4], [15, 17], [23, 2], [-10, 22], [19, -15]].forEach(([x, z], i) => {
      aul.push(this.part(lab, MB.CreateBox('сакля', { width: 2.4, height: 1.6, depth: 2 }, scene), '#f1e3c8', x, -0.4, z));
      const roof = this.part(lab, MB.CreateCylinder('крыша', { height: 2.8, diameter: 1.9, tessellation: 3 }, scene), '#c0573d', x, 0.85, z);
      roof.rotation.z = Math.PI / 2; roof.rotation.y = i % 2 ? Math.PI / 2 : 0; roof.scaling.y = 0.9; aul.push(roof);
    });
    [[-26, 14], [-8, -19], [11, -22], [27, 11], [-28, -12], [5, 25], [30, -6], [-14, 6], [13, 8]].forEach(([x, z]) => {
      aul.push(this.part(lab, MB.CreateCylinder('ствол', { height: 1, diameter: 0.3, tessellation: 5 }, scene), '#6b4a2b', x, -0.7, z));
      aul.push(this.part(lab, MB.CreateCylinder('крона', { height: 2.4, diameterTop: 0, diameterBottom: 1.8, tessellation: 6 }, scene), '#2f8f4e', x, 0.9, z));
    });
    this.merge(aul, 'аул');
    // облака на высоте: башня пробивает их
    const clouds = [];
    for (let i = 0; i < 16; i++) {
      const a = i * 2.4, r = 7 + (i % 4) * 4, y = 11 + (i % 5) * 1.6;
      for (let k = 0; k < 3; k++) clouds.push(this.part(lab, MB.CreateSphere('облако', { diameter: 2.2 - k * 0.4, segments: 6 }, scene), '#ffffff', Math.cos(a) * r + k * 1.2, y + (k === 1 ? 0.4 : 0), Math.sin(a) * r, { alpha: 0.85 }));
    }
    lab.noShadow(this.merge(clouds, 'облака'));
    // звёзды проступают, когда башня выше заката
    const stars = [];
    for (let i = 0; i < 70; i++) {
      const a = lab.rand(0, Math.PI * 2), e = lab.rand(0.15, 1.3), r = 140;
      stars.push(this.part(lab, MB.CreateSphere('звезда', { diameter: lab.rand(0.6, 1.4), segments: 3 }, scene), '#fff6c8', Math.cos(a) * Math.cos(e) * r, 20 + Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r, { unlit: true }));
    }
    st.stars = this.merge(stars, 'звёзды'); lab.noShadow(st.stars); st.stars.visibility = 0;
    // орёл кружит над плато
    st.eagle = this.merge([this.part(lab, MB.CreateBox('крыло', { width: 2.4, height: 0.08, depth: 0.5 }, scene), '#4a3426'),
      this.part(lab, MB.CreateBox('тело', { width: 0.35, height: 0.25, depth: 0.9 }, scene), '#5c4030')], 'орёл');
    lab.noShadow(st.eagle);
  },
};

