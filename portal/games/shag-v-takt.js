// «Шаг в такт» — ремейк-донор урока 7 по мотивам Geometry Dash и ритм-баттлов: танцор бежит по улице аула на джэгу,
// кувшины стоят ровно на долях мелодии. Секрет донора — игра и музыка на одних часах: препятствие на доле,
// окна «идеально / хорошо / мимо» и щелчок, который предупреждает раньше картинки (ручка secret, пресет «Без секрета»).
// Уровень строится из мелодии: своя мелодия приходит из секвенсора портала в lab.data.melody. Вдвоём — дуэль «повтори за мной».
const GAME = {
  title: 'Шаг в такт',
  subtitle: 'Танцор бежит по аулу на джэгу. Прыгай через кувшины ровно в долю — музыка подскажет когда!',
  donor: 'Geometry Dash и ритм-баттлов',
  players: 1,
  duo: 'duel', // ручка duel = 1 — дуэль «повтори за мной»
  controls: [
    { input: 'a', text: 'прыжок в долю' },
  ],
  camera: 'side', // в start: цель едет за танцором
  field: { w: 22, h: 10 },
  sky: '#2a2d6e',
  accent: '#ffd23f',
  lives: 5,
  decisions: [
    'Чувство: попал в долю — и музыка будто играет от твоего прыжка',
    'Честность: кувшин стоит ровно на доле, щелчок звучит за долю до него',
    'Выбор: прыгать по звуку или по картинке',
  ],
  config: {
    bpm: { value: 112, min: 70, max: 170, step: 2, label: 'Темп, ударов в минуту', restart: true },
    ramp: { value: 8, min: 0, max: 30, step: 2, label: 'Темп быстрее с каждым кругом', restart: true },
    laps: { value: 3, min: 1, max: 6, step: 1, label: 'Кругов мелодии', restart: true },
    perfect: { value: 0.06, min: 0.02, max: 0.15, step: 0.01, label: 'Окно «идеально», с' },
    good: { value: 0.15, min: 0.06, max: 0.3, step: 0.01, label: 'Окно «хорошо», с' },
    cue: { value: 1, min: 0, max: 2, step: 0.5, label: 'Щелчок-подсказка за … долей до кувшина', hint: '0 — без подсказки' },
    offset: { value: 0, min: -0.15, max: 0.15, step: 0.01, label: 'Поправка на задержку звука, с', hint: 'если «идеально» не выходит, а жмёшь точно' },
    secret: { value: 1, min: 0, max: 1, step: 1, label: 'Секрет: игра и музыка на одних часах', hint: '0 — кувшины не на долях, музыка на своих часах, без щелчка', restart: true },
    duel: { value: 0, min: 0, max: 1, step: 1, label: 'Вдвоём: дуэль «повтори за мной»', restart: true },
  },
  presets: {
    'Новичок': { bpm: 92, ramp: 4, perfect: 0.09, good: 0.22 },
    'Без секрета': { secret: 0 },
    'Дуэль': { duel: 1 },
    'Шторм': { bpm: 150, ramp: 14, perfect: 0.04, good: 0.1 },
  },

  U: 3, // метров на долю
  NOTES: [220, 261.6, 293.7, 329.6, 392], // ля-минорная пентатоника: строки секвенсора снизу вверх
  MELODY: [-1, -1, -1, -1, 0, -1, 2, -1, 3, -1, 3, 2, 4, -1, -1, -1, 0, -1, 2, -1, 3, 2, 3, -1, 4, 3, 2, -1, 0, -1, -1, -1],

  start(lab, scene) {
    const st = lab.state, duel = lab.players === 2;
    Object.assign(st, { time: -1.2, evts: [], ei: 0, obs: [], combo: 0, best: 0, hits: { perfect: 0, good: 0, miss: 0 }, devs: [], extra: 0 });
    lab.setCamera({ type: 'side', beta: 1.38, target: [0, 3, 0], distance: duel ? 17 : 20 });
    this.world(lab, scene, duel);
    st.hero = this.dancer(lab, scene, '#c0392b');
    lab.hero(st.hero.node);
    if (duel) return this.duelStart(lab, scene);
    this.timeline(lab, scene);
    lab.hud('acc', 'Слушай щелчок: кувшин будет через долю');
  },

  update(lab, dt) {
    const st = lab.state;
    st.time += dt;
    this.schedule(lab);
    if (st.duel) return this.duelUpdate(lab, dt);
    const h = st.hero, t = st.time + lab.cfg.offset;
    h.x = this.xAt(st, st.time);
    if (lab.p1.pressed.a) this.press(lab, t);
    for (const o of st.obs) if (!o.done && t > o.t + lab.cfg.good) this.judge(lab, o, 'miss', 0);
    this.animate(lab, h, dt);
    const tg = lab.camera.target, k = 1 - Math.exp(-dt * 6);
    tg.x = lab.lerp(tg.x, h.x + 5, k); tg.y = 3;
    this.pulseBeat(lab, dt);
    if (st.time > st.end + 1) lab.win(`Мелодия пройдена: идеально ${st.hits.perfect}, хорошо ${st.hits.good}, мимо ${st.hits.miss}`);
    lab.hud('acc', `идеально ${st.hits.perfect} · хорошо ${st.hits.good} · мимо ${st.hits.miss} · серия ${st.combo}`);
  },

  overNote(lab) {
    const st = lab.state, d = st.devs, avg = d.length ? d.reduce((a, b) => a + b, 0) / d.length : 0;
    if (st.duel) return [`Дуэль: ${st.pts[0]} : ${st.pts[1]}`, 'Кто точнее повторил чужой ритм, тот и сильнее слышит долю'];
    return [`Идеально ${st.hits.perfect}, хорошо ${st.hits.good}, мимо ${st.hits.miss}, лучшая серия ${st.best}`,
      d.length ? `В среднем ты жмёшь ${Math.abs(avg) < 0.01 ? 'ровно в долю' : (avg < 0 ? 'раньше' : 'позже') + ' на ' + Math.round(Math.abs(avg) * 1000) + ' мс'}` : 'Ни одного попадания в окно — попробуй слушать щелчок',
      `Лишних прыжков без кувшина: ${st.extra}`];
  },

  /* ---------- часы: доли, ноты, кувшины ---------- */
  // круги мелодии подряд, темп растёт; x(t) — путь танцора: ровно U метров за долю
  timeline(lab, scene) {
    const st = lab.state, c = lab.cfg, own = lab.data && lab.data.melody,
      mel = Array.isArray(own) && own.some(n => n >= 0) ? own.slice(0, 64).map(n => (Number.isInteger(n) && n >= 0 && n < 5 ? n : -1)) : this.MELODY;
    st.laps = [];
    let T = 0, X = 0;
    for (let L = 0; L < c.laps; L++) {
      const beat = 60 / (c.bpm + c.ramp * L);
      st.laps.push({ T, X, beat });
      mel.forEach((n, i) => {
        const tb = T + i * beat, drift = c.secret ? 1 : 1.035; // без секрета музыка идёт на своих часах
        st.evts.push({ t: tb * drift, kind: i % 4 ? 'kick' : 'bar' }, { t: (tb + beat / 2) * drift, kind: 'hat' });
        if (n < 0) return;
        st.evts.push({ t: tb * drift, kind: 'note', n });
        if (L === 0 && i < 4) return; // первый такт — вступление
        const to = c.secret ? tb : tb + lab.rand(-0.4, 0.4) * beat; // без секрета кувшин не на доле
        st.obs.push({ t: to, n, done: false });
        if (c.secret && c.cue > 0) st.evts.push({ t: to - c.cue * beat, kind: 'cue' });
      });
      T += mel.length * beat; X += mel.length * this.U;
    }
    st.end = T;
    st.evts.sort((a, b) => a.t - b.t);
    st.obs.forEach(o => { o.x = this.xAt(st, o.t); o.m = this.jug(lab, o); });
    this.road(lab, X);
  },
  xAt(st, t) {
    let L = st.laps[0];
    for (const l of st.laps) if (t >= l.T) L = l;
    return L.X + (t - L.T) / L.beat * this.U;
  },
  // звук планируется заранее по часам игры: lab.tone(…, задержка) звучит точно в долю
  schedule(lab) {
    const st = lab.state;
    while (st.ei < st.evts.length && st.evts[st.ei].t < st.time + 0.1) {
      const e = st.evts[st.ei++], d = Math.max(0, e.t - st.time);
      if (e.t < st.time - 0.05) continue;
      if (e.kind === 'kick' || e.kind === 'bar') { lab.tone(e.kind === 'bar' ? 90 : 120, 0.14, 'sine', 0.32, 40, d); lab.noise(0.03, 0.06, 2500, d); }
      if (e.kind === 'hat') lab.noise(0.03, 0.04, 9000, d);
      if (e.kind === 'note') { lab.tone(this.NOTES[e.n] * 2, 0.22, 'triangle', 0.11, 0, d); lab.tone(this.NOTES[e.n], 0.3, 'sine', 0.06, 0, d); }
      if (e.kind === 'cue') { lab.tone(1760, 0.03, 'square', 0.05, 0, d); if (lab.cfg.secret) lab.count('_secret'); }
      if (e.kind === 'beat') { lab.tone(e.hi ? 1320 : 880, 0.05, 'square', 0.06, 0, d); }
    }
  },
  press(lab, t) {
    const st = lab.state, c = lab.cfg;
    const o = st.obs.filter(x => !x.done && Math.abs(x.t - t) <= c.good).sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t))[0];
    st.hero.jump = 0.0001;
    lab.count('прыжки');
    if (!o) { st.extra++; lab.count('лишние нажатия'); return; }
    const dev = t - o.t;
    this.judge(lab, o, Math.abs(dev) <= c.perfect ? 'perfect' : 'good', dev);
  },
  judge(lab, o, kind, dev) {
    const st = lab.state, at = [o.x, 1.4, 0];
    o.done = true; st.hits[kind]++;
    if (kind === 'miss') {
      st.combo = 0; lab.count('мимо');
      o.m.rotation.z = -1.2; o.m.position.y = 0.3;
      lab.tone(98, 0.25, 'sawtooth', 0.12, 70); // фальшивая нота
      lab.popup(at, 'Мимо', '#ff6b6b', 20);
      lab.hurt(at, 'Сбился с ритма');
      st.hero.c.hurt(at);
      return;
    }
    st.devs.push(dev); st.combo++; st.best = Math.max(st.best, st.combo);
    lab.count(kind === 'perfect' ? 'идеально' : 'хорошо');
    o.m.setEnabled(false);
    const f = this.NOTES[o.n] * 4;
    lab.tone(f * lab.pitch(Math.min(st.combo, 12) % 5), 0.12, 'triangle', 0.08); // нота в тон мелодии
    lab.burst(at, { count: kind === 'perfect' ? 24 : 10, colors: kind === 'perfect' ? ['#ffd23f', '#ffffff', '#ff8ad8'] : ['#7cf5a8', '#ffffff'], speed: 6, up: 2 });
    lab.addScore(kind === 'perfect' ? 100 + 10 * st.combo : 50, null);
    lab.popup(at, kind === 'perfect' ? `Идеально! ×${st.combo}` : 'Хорошо', kind === 'perfect' ? '#ffd23f' : '#7cf5a8', kind === 'perfect' ? 24 : 18);
    if (kind === 'perfect') { lab.shake(0.12); lab.pulse(st.hero.node, 1.2, 0.12); }
  },

  /* ---------- дуэль «повтори за мной» ---------- */
  // такт ведущего: 8 восьмых, он стучит свой ритм; такт повтора: второй игрок повторяет. Шесть раундов, ведущий меняется.
  duelStart(lab, scene) {
    const st = lab.state, c = lab.cfg, beat = 60 / c.bpm;
    st.duel = { beat, bar: 0, taps: [], lead: [] }; st.pts = [0, 0];
    st.hero.node.position.set(-3, 0, 0);
    st.hero2 = this.dancer(lab, scene, '#2e86de'); st.hero2.node.position.set(3, 0, 0); st.hero2.node.rotation.y = Math.PI;
    st.tiles = [];
    for (let i = 0; i < 8; i++) { const m = BABYLON.MeshBuilder.CreateBox('клетка', { width: 1, height: 0.2, depth: 1 }, scene); m.position.set(-4.2 + i * 1.2, 5.5, 0); m.material = lab.mat('#3a3f8f'); st.tiles.push(m); }
    for (let i = 0; i < 4 * 13; i++) st.evts.push({ t: i * beat, kind: 'beat', hi: i % 4 === 0 });
    st.end = 4 * 13 * beat; // метроном: такт отсчёта и 6 раундов по два такта
    lab.hud('acc', 'Такт 1 — отсчёт. Потом ведёт игрок 1 (F), игрок 2 (K) повторяет');
  },
  duelUpdate(lab, dt) {
    const st = lab.state, D = st.duel, barLen = 4 * D.beat, t = st.time;
    if (t < 0) return;
    const bar = Math.floor(t / barLen), round = Math.floor((bar - 1) / 2), lead = round % 2, echo = (bar - 1) % 2 === 1;
    const who = echo ? 1 - lead : lead, p = who ? lab.p2 : lab.p1, step = Math.round((t - bar * barLen) / (D.beat / 2)) % 8;
    if (bar !== D.bar) { // новый такт
      if (D.bar >= 1 && (D.bar - 1) % 2 === 1) this.duelScore(lab, D);
      D.bar = bar; D.taps = [];
      if (bar >= 1 && !echo) D.lead = [];
      st.tiles.forEach((m, i) => { m.material = lab.mat(echo && D.lead.includes(i) ? '#ffd23f' : '#3a3f8f', echo && D.lead.includes(i) ? { glow: 0.6 } : {}); });
      if (bar > 12) return lab.win(st.pts[0] === st.pts[1] ? 'Ничья!' : `Победил игрок ${st.pts[0] > st.pts[1] ? 1 : 2}`);
      lab.hud('acc', bar === 0 ? 'Отсчёт' : `Раунд ${round + 1} из 6 · ${echo ? 'повторяет' : 'ведёт'} игрок ${who + 1} · счёт ${st.pts[0]} : ${st.pts[1]}`);
    }
    if (bar >= 1 && p.pressed.a && !D.taps.includes(step)) {
      D.taps.push(step); if (!echo) D.lead.push(step);
      const ok = !echo || D.lead.includes(step), m = st.tiles[step];
      m.material = lab.mat(ok ? (echo ? '#7cf5a8' : '#ffd23f') : '#ff4d5e', { glow: 0.8 });
      lab.tone(this.NOTES[step % 5] * 2, 0.15, 'triangle', 0.12);
      lab.burst(m, { count: 8, colors: [ok ? '#ffd23f' : '#ff4d5e', '#ffffff'], speed: 4 });
      (who ? st.hero2 : st.hero).jump = 0.0001;
    }
    [st.hero, st.hero2].forEach(h => this.animate(lab, h, dt));
  },
  duelScore(lab, D) {
    const st = lab.state, round = Math.floor((D.bar - 1) / 2), echoer = 1 - (round % 2);
    const hit = D.taps.filter(s => D.lead.includes(s)).length, extra = D.taps.length - hit, missed = D.lead.length - hit;
    const pts = Math.max(0, hit - extra - missed);
    st.pts[echoer] += pts; lab.count(pts === D.lead.length && D.lead.length ? 'идеально' : 'мимо');
    lab.popup([echoer ? 3 : -3, 3.5, 0], pts === D.lead.length && D.lead.length ? 'Точно!' : `+${pts}`, '#ffd23f', 24);
  },

  /* ---------- картинка ---------- */
  part(lab, mesh, color, x = 0, y = 0, z = 0, o) { mesh.material = lab.mat(color, o || {}); mesh.position.set(x, y, z); return mesh; },
  merge(parts, name) {
    const groups = new Map();
    parts.forEach(p => groups.set(p.material, (groups.get(p.material) || []).concat(p)));
    const pieces = [...groups.values()].map(g => (g.length > 1 ? BABYLON.Mesh.MergeMeshes(g, true, true) : g[0]));
    const m = pieces.length > 1 ? BABYLON.Mesh.MergeMeshes(pieces, true, true, undefined, false, true) : pieces[0];
    m.name = name; return m;
  },
  // танцор — существо из набора: белая папаха, черкеска в цвет игрока, газыри — своя примета
  dancer(lab, scene, coat) {
    const node = new BABYLON.TransformNode('танцор', scene);
    const c = lab.creature({ plan: 'двуногий', size: 2.5, role: 'герой', autoFace: false,
      colors: { main: '#f2c9a0', belly: '#e8e8f0', second: '#1a1a22', detail: coat, accent: '#ffd23f' },
      wear: ['папаха:#f4f0e6', 'черкеска', 'пояс:#ffd23f'], face: { mustache: true } });
    c.root.parent = node; c.root.rotation.y = Math.PI / 2; // лицом по ходу — вправо
    return { node, c, x: 0, jump: 0 };
  },
  animate(lab, h, dt) {
    const st = lab.state, beat = st.duel ? st.duel.beat : st.beat || 0.5;
    if (h.jump > 0) {
      if (h.jump === 0.0001) h.c.stretch();
      h.jump += dt / (beat * 0.9);
      if (h.jump >= 1) { h.jump = 0; h.c.squash(); }
    }
    h.node.position.y = h.jump > 0 ? Math.sin(Math.PI * h.jump) * 1.9 : 0;
    if (!st.duel) h.node.position.x = h.x;
    h.node.rotation.z = h.jump > 0 ? -h.jump * Math.PI * 2 * (lab.juicy('squash') ? 1 : 0) : 0; // сальто
  },
  // кувшин на доле; цвет — высота ноты
  jug(lab, o) {
    const st = lab.state;
    if (!st.jugSrc) {
      const MB = BABYLON.MeshBuilder, sc = lab.scene;
      st.jugSrc = ['#e07a3f', '#e0a23f', '#c9df4a', '#4fd1c5', '#c77dff'].map(c => {
        const m = this.merge([this.part(lab, MB.CreateSphere('пузо', { diameter: 1, segments: 7 }, sc), c, 0, 0.5, 0),
          this.part(lab, MB.CreateCylinder('горло', { height: 0.5, diameterTop: 0.45, diameterBottom: 0.3, tessellation: 7 }, sc), c, 0, 1.15, 0),
          this.part(lab, MB.CreateTorus('ручка', { diameter: 0.5, thickness: 0.08, tessellation: 8 }, sc), '#7a3f20', 0.35, 0.85, 0)], 'кувшин');
        m.isVisible = false; return m;
      });
    }
    const m = st.jugSrc[o.n % 5].createInstance('кувшин');
    m.position.set(o.x, 0, 0);
    return m;
  },
  road(lab, len) {
    const st = lab.state, MB = BABYLON.MeshBuilder, sc = lab.scene;
    const a = this.part(lab, MB.CreateBox('плита', { width: this.U - 0.08, height: 0.3, depth: 3 }, sc), '#c9a36b'); a.isVisible = false;
    const b = this.part(lab, MB.CreateBox('плита', { width: this.U - 0.08, height: 0.3, depth: 3 }, sc), '#b08a55'); b.isVisible = false;
    for (let i = -4; i * this.U < len + 30; i++) { const m = (i % 2 ? a : b).createInstance('плита'); m.position.set(i * this.U, -0.15, 0); }
    // фонари вдоль улицы мигают в долю
    st.lamps = [];
    const lamp = lab.build('фонарь аула', [['cyl', [0.12, 3, 0.12], [0, 1.5, 0], 0, '#2a2440'], ['box', [0.3, 0.3, 0.3], [0, 0.15, 0], 0, '#2a2440'],
      ['sphere', [0.55, 0.55, 0.55], [0, 3.1, 0], 0, 'свет', { glow: 1 }], ['cone', [0.5, 0.25, 0.5], [0, 3.45, 0], 0, '#2a2440']]);
    for (let x = -8; x < len + 30; x += this.U * 4) st.lamps.push(lamp.copy([x, 0, 2.2]));
  },
  // мир из готовых деталей: аул ночью, своя сакля с террасой и сторожевая башня на каждом круге
  world(lab, scene, duel) {
    lab.style({ mood: 'ночь', shape: 'круглый', wind: 0.4, palette: { земля: '#24543f', стена: '#f1e3c8', крыша: '#b5523b', камень: '#4b3f8f', дерево: '#8a5a33', свет: '#ffcf5a', акцент: '#ffd23f' } });
    lab.ground({ w: 900, h: 80, color: '#24543f', y: -0.31 }).position.x = 300;
    lab.backdrop({ type: 'горы', layers: 2 });
    const range = duel ? 30 : 700, face = Math.PI; // дома и плетни смотрят на камеру
    const saklya = lab.build('сакля', [['box', [4, 2.6, 3], [0, 1.3, 0], 0, 'стена'], ['box', [4.4, 0.25, 3.4], [0, 2.7, 0], 0, 'дерево'],
      ['box', [4.4, 0.5, 0.08], [0, 3.05, 1.66], 0, 'дерево'], ['box', [0.08, 0.5, 3.4], [2.16, 3.05, 0], 0, 'дерево'], ['box', [0.08, 0.5, 3.4], [-2.16, 3.05, 0], 0, 'дерево'],
      ['box', [0.8, 0.7, 0.1], [-0.9, 1.4, 1.52], 0, 'свет', { glow: 0.9 }], ['box', [0.8, 0.7, 0.1], [0.9, 1.4, 1.52], 0, 'свет', { glow: 0.9 }],
      ['box', [0.9, 1.6, 0.08], [0, 0.8, 1.53], 0, 'дерево'], ['box', [1.2, 1.4, 1.2], [1.2, 3.5, -0.6], 0, 'стена'], ['prism', [1.5, 0.7, 1.5], [1.2, 4.55, -0.6], 0, 'крыша']]);
    const fence = lab.prop('плетень', { v: 3 });
    for (let x = -20; x < range; x += 9) {
      saklya.copy([x + lab.rand(-1, 1), 0, lab.rand(7, 10)], face);
      fence.copy([x + 4.5, 0, 4.2], face);
    }
    const tower = lab.build('сторожевая башня', [['box', [2.4, 9, 2.4], [0, 4.5, 0], 0, 'камень', { taper: 0.78 }], ['box', [2.1, 0.5, 2.1], [0, 9.1, 0], 0, '#3a3070'],
      ['pyramid', [2.2, 1.6, 2.2], [0, 10.1, 0], 0, 'крыша'], ['box', [0.25, 0.7, 0.1], [0, 6.5, 1.0], 0, 'свет', { glow: 1 }], ['box', [0.25, 0.6, 0.1], [0, 3.6, 1.12], 0, 'свет', { glow: 0.7 }]]);
    for (let x = 30; x < range + 40; x += this.U * 32) tower.copy([x, 0, 13], face); // на каждом круге мелодии
    lab.scatter([['тополь', 2], ['куст', 3]], { n: duel ? 14 : 160, area: { x: range / 2 - 10, w: range + 40, z: 12, h: 4 } });
    lab.state.moon = this.part(lab, BABYLON.MeshBuilder.CreateSphere('луна', { diameter: 7, segments: 10 }, scene), '#fff4c2', 30, 26, 70, { glow: 1 });
  },
  // свет в долю: фонари и луна вспыхивают на каждой доле — картинка тоже играет музыку
  pulseBeat(lab) {
    const st = lab.state, L = st.laps.find((l, i) => !st.laps[i + 1] || st.time < st.laps[i + 1].T) || st.laps[0];
    st.beat = L.beat;
    const ph = ((st.time - L.T) / L.beat) % 1, k = Math.max(0, 1 - Math.abs(ph < 0.5 ? ph : ph - 1) * 6);
    if (!lab.cfg.secret) return;
    st.lamps.forEach(l => l.scaling.setAll(1 + k * 0.25 * (lab.juicy('squash') ? 1 : 0)));
    st.moon.position.x = lab.camera.target.x + 30;
  },
};
