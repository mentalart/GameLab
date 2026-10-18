// «Тур над Хаджохом» — ремейк-донор урока 5 по мотивам механики прыжка Super Mario Bros. и Celeste: обби на минуту.
// Секрет донора — отзывчивость: время койота, буфер нажатия, падение быстрее подъёма, высота от длительности нажатия
// и зависание на вершине. Все приёмы — ручки «Лаборатории прыжка», общий выключатель — ручка secret (пресет «Без секрета»).
const GAME = {
  title: 'Тур над Хаджохом',
  subtitle: 'Горный тур скачет по скалам Хаджохской теснины. Добеги до сакли пастуха быстрее призрака!',
  donor: 'Super Mario Bros. и Celeste',
  players: 1,
  controls: [
    { input: 'move', text: 'бежать' },
    { input: 'a', text: 'прыжок: держи — выше' },
  ],
  camera: 'side', // в start: своя дистанция, цель едет за туром
  field: { w: 26, h: 14 },
  sky: '#8fd3f0',
  accent: '#ffd23f',
  lives: 0,
  decisions: [
    'Чувство: прыжок слушается с полуслова — сорвался с края и всё равно долетел',
    'Честность: обрыв и река видны заранее, огоньки висят там, где прыжок рискованный',
    'Выбор: прыгнуть коротко под скалой или длинно за огоньком',
  ],
  // «Лаборатория прыжка»: 11 ручек прыжка и бега и общий выключатель секрета
  config: {
    jumpH: { value: 3.2, min: 1.5, max: 6, step: 0.1, label: 'Высота прыжка, м' },
    apex: { value: 0.38, min: 0.2, max: 0.8, step: 0.01, label: 'Время до вершины, с' },
    fall: { value: 1.8, min: 1, max: 3, step: 0.1, label: 'Падение быстрее подъёма, ×', hint: '1 — вниз так же медленно, как вверх' },
    cut: { value: 0.45, min: 0, max: 1, step: 0.05, label: 'Отпустил кнопку — прыжок ниже', hint: 'доля скорости вверх после отпускания; 1 — высота не зависит от нажатия' },
    coyote: { value: 0.1, min: 0, max: 0.3, step: 0.01, label: 'Время койота, с', hint: 'сколько ещё можно прыгнуть, сорвавшись с края' },
    buffer: { value: 0.12, min: 0, max: 0.3, step: 0.01, label: 'Буфер нажатия, с', hint: 'нажатие чуть раньше приземления не теряется' },
    hang: { value: 0.5, min: 0.2, max: 1, step: 0.05, label: 'Зависание на вершине: тяжесть ×', hint: '1 — без зависания' },
    run: { value: 7.5, min: 3, max: 14, step: 0.5, label: 'Скорость бега' },
    accel: { value: 0.12, min: 0.02, max: 0.6, step: 0.02, label: 'Разгон до полной скорости, с' },
    air: { value: 0.8, min: 0, max: 1, step: 0.05, label: 'Управление в воздухе', hint: 'доля разгона в полёте' },
    maxFall: { value: 22, min: 6, max: 40, step: 1, label: 'Предельная скорость падения' },
    secret: { value: 1, min: 0, max: 1, step: 0.05, label: 'Секрет: честный прыжок', hint: '0 — сырой прыжок: без койота, буфера, быстрого падения и высоты от нажатия' },
    ghost: { value: 1, min: 0, max: 1, step: 1, label: 'Призрак лучшей попытки', restart: true },
    race: { value: 0, min: 0, max: 1, step: 1, label: 'Спидран: без огоньков, очки только за время', restart: true },
    limit: { value: 150, min: 60, max: 300, step: 10, label: 'Время на трассу, с' },
  },
  presets: {
    'Новичок': { jumpH: 3.6, run: 6.5, coyote: 0.16, buffer: 0.2, air: 1, limit: 240 },
    'Без секрета': { secret: 0 },
    'Луна': { apex: 0.7, fall: 1.1, hang: 0.9, maxFall: 10 },
    'Безумие': { run: 12, apex: 0.26, accel: 0.04, limit: 90 },
  },

  HW: 0.38, HH: 0.95, // половина ширины и рост тура
  // трасса: [x начала, x конца, верх] — скала; s — камень в реке, m — плот (dx, dy, период), c — нависающая скала (низ на y)
  LEVEL: [
    [-8, 14, 0], [17, 26, 0], [29, 34, 1.5], [37.5, 44, 3], [47.5, 57, 1.8], [60, 70, 1.8],
    [73.5, 75.5, 0.4, 's'], [79, 81, 1, 's'], [84.5, 86.5, 0.4, 's'], [89.5, 92.5, 1.2, 'm', 2.2, 0, 2.6], [97.5, 99.5, 1.4, 's'],
    [103, 105, 0.6, 's'], [108.5, 110.5, 1.6, 's'], [114, 117, 1.8, 'm', 0, 1.6, 2.2], [120.5, 130, 2.2],
    [133.5, 136.5, 4.4], [136, 142, 9.2, 'c'], [139.5, 142.5, 6.2], [145.5, 148.5, 8.2], [147, 153, 12.8, 'c'], [151.5, 154.5, 10],
    [157.5, 160.5, 11.8, 'm', 0, 2, 2.4], [163.5, 167, 14.2], [170, 186, 14.2],
  ],
  CHECKS: [0, 62, 122, 178], // флажки участков; последний — сакля, финиш
  ORBS: [[15.5, 2.6], [27.5, 3.4], [45.8, 5.4], [58.5, 4.2], [77.2, 3.2], [95, 3.6], [101.2, 3.9], [112.2, 4.4], [118.8, 6.6], [131.8, 5.4], [143.9, 8.6], [155.9, 12.4], [161.9, 16.6], [168.6, 16.4]],

  start(lab, scene) {
    const st = lab.state;
    lab.setCamera({ type: 'side', beta: 1.42, target: [0, 3.5, 0], distance: 22 });
    Object.assign(st, { solids: [], movers: [], orbs: [], cp: 0, deaths: 0, jumps: 0, shorts: 0, early: 0, edge: 0, lost: 0, saved: 0, got: 0, dead: 0, path: [], pathT: 0, fx: [] });
    lab.style({ mood: 'день', shape: 'угловатый', wind: 0.5, palette: { камень: '#c98a68', листва: '#2f8a4c', земля: '#6cc04a', вода: '#1784a3', стена: '#f4ead8', крыша: '#c0573a', дерево: '#7a4a2a' } });
    this.sources(lab, scene);
    this.world(lab, scene);
    this.track(lab, scene);
    st.hero = this.buildTur(lab, scene, false);
    lab.hero(st.hero.node);
    const run = this.bestRun;
    if (run && lab.cfg.ghost >= 1) { st.ghost = this.buildTur(lab, scene, true); lab.hud('ghost', `Призрак: ${run.t.toFixed(1)} с`); }
    this.respawn(lab);
  },

  update(lab, dt) {
    const st = lab.state, h = st.hero, p = lab.p1;
    st.movers.forEach(m => this.moveMover(lab, m, dt));
    this.tickWorld(lab, dt);
    if ((st.pathT -= dt) <= 0) { st.pathT += 0.05; st.path.push([h.x, h.y, h.face]); } // путь для призрака
    if (st.ghost) this.ghostAt(lab, st.ghost, lab.t);
    if (st.dead > 0) { st.dead -= dt; if (st.dead <= 0) this.respawn(lab); this.camera(lab, dt); return; }
    this.control(lab, h, p, dt);
    this.camera(lab, dt);
    this.animate(lab, h, dt);
    // огоньки, флажки, финиш, обрыв
    st.orbs.forEach(o => {
      if (o.taken || Math.abs(o.x - h.x) > 0.9 || Math.abs(o.y - (h.y + 0.5)) > 1) return;
      o.taken = true; o.m.setEnabled(false); st.got++; lab.count('огоньки');
      lab.addScore(100, o.m, '#ffd23f'); lab.sfx.coin(); lab.burst(o.m, { count: 18, colors: ['#ffd23f', '#fff1a8'], speed: 5 });
    });
    const next = this.CHECKS[st.cp + 1];
    if (next != null && h.x >= next) this.reach(lab, st.cp + 1);
    if (h.y < -2.6) this.die(lab);
    if (lab.t > lab.cfg.limit) lab.gameOver('Время вышло');
    lab.hud('time', `⏱ ${lab.t.toFixed(1)} с · участок ${Math.min(st.cp + 1, 3)} из 3` + (lab.cfg.race ? ' · спидран' : ` · огоньки ${st.got} из ${this.ORBS.length}`));
  },

  overNote(lab) {
    const st = lab.state;
    return [st.cp >= 3 ? `Трасса за ${st.finish.toFixed(1)} с, падений ${st.deaths}` : `Участок ${st.cp + 1} из 3, падений ${st.deaths}`,
      `Прыжков ${st.jumps}, коротких (отпустил кнопку) ${st.shorts}`,
      `Нажал чуть раньше приземления или чуть позже края: ${st.early + st.edge} раз — прыжок случился ${st.saved}, игра «проглотила» ${st.lost}`];
  },

  /* ---------- управление и прыжок ---------- */
  control(lab, h, p, dt) {
    const c = lab.cfg, st = lab.state, s = c.secret;
    const coyote = c.coyote * s, buffer = c.buffer * s, fallK = 1 + (c.fall - 1) * s, cutK = 1 - (1 - c.cut) * s, hangK = 1 - (1 - c.hang) * s;
    const g = 2 * c.jumpH / (c.apex * c.apex), v0 = 2 * c.jumpH / c.apex;
    // бег: разгон к цели, в воздухе слабее
    const want = p.x * c.run, rate = c.run / c.accel * (h.ground ? 1 : c.air);
    h.vx += lab.clamp(want - h.vx, -rate * dt, rate * dt);
    if (Math.abs(p.x) > 0.1) h.face = Math.sign(p.x);
    // нажатие: прыжок сейчас, по койоту или в буфер до приземления
    h.off = h.ground ? 0 : h.off + dt;
    if (h.pend != null) h.pend += dt;
    if (p.pressed.a) {
      if (h.ground) this.jump(lab, h, v0);
      else if (!h.jumped && h.off <= 0.2) { // чуть позже края
        st.edge++;
        if (h.off <= coyote) { this.jump(lab, h, v0); this.helped(lab, 'Койот!'); } else { st.lost++; lab.count('потерянные нажатия'); }
      } else h.pend = 0;
    }
    if (h.cutReady && !p.a && h.vy > 0) { h.vy *= cutK; h.cutReady = false; if (cutK < 0.95) { st.shorts++; if (s > 0) lab.count('_secret'); } }
    // тяжесть: на вершине легче, вниз — быстрее
    let k = h.vy < 0 ? fallK : 1;
    if (Math.abs(h.vy) < 2.5 && p.a) k *= hangK;
    h.vy = Math.max(h.vy - g * k * dt, -c.maxFall);
    const was = h.ground;
    this.move(lab, h, h.vx * dt, h.vy * dt);
    if (h.ground && !was) this.land(lab, h, v0, buffer);
  },
  jump(lab, h, v0) {
    h.vy = v0; h.ground = null; h.jumped = true; h.cutReady = true; h.pend = null;
    lab.state.jumps++; lab.count('прыжки'); lab.sfx.jump();
    h.sq = -0.35; // растянуть вверх
    lab.burst([h.x, h.y + 0.1, 0], { count: 8, colors: ['#e8d7b0', '#c9b08a'], speed: 2.5, up: 1, size: 0.18 });
  },
  land(lab, h, v0, buffer) {
    const st = lab.state, hard = h.fallV > 12;
    h.jumped = false; h.sq = hard ? 0.4 : 0.22; // сплющить
    lab.tone(hard ? 110 : 160, 0.07, 'sine', 0.12, 60); lab.noise(0.05, 0.05, 900);
    lab.burst([h.x, h.y + 0.05, 0], { count: hard ? 14 : 6, colors: ['#e8d7b0', '#c9b08a'], speed: hard ? 4 : 2.5, up: 0.5, size: 0.18 });
    if (hard) lab.shake(0.12);
    if (h.pend != null && h.pend <= 0.2) { // нажал чуть раньше приземления
      st.early++;
      if (h.pend <= buffer) { this.jump(lab, h, v0); this.helped(lab, 'Буфер!'); } else { st.lost++; lab.count('потерянные нажатия'); }
    }
    h.pend = null;
  },
  helped(lab) { lab.state.saved++; lab.count('_secret'); }, // секрет сработал: игрок этого не видит, но чувствует
  // движение по осям с выталкиванием из скал; стоя на плоту, тур едет вместе с ним
  move(lab, h, dx, dy) {
    const W = this.HW, H = this.HH, S = lab.state.solids;
    if (h.ground && h.ground.mover) { dx += h.ground.mover.dx; dy += Math.min(0, h.ground.mover.dy); h.y += Math.max(0, h.ground.mover.dy); }
    h.x += dx;
    for (const s of S) if (h.x + W > s.x0 && h.x - W < s.x1 && h.y < s.y1 - 0.01 && h.y + H > s.y0 + 0.01) { h.x = dx > 0 ? s.x0 - W : s.x1 + W; h.vx = 0; }
    h.fallV = -h.vy; h.y += dy; h.ground = null;
    for (const s of S) if (h.x + W > s.x0 && h.x - W < s.x1 && h.y < s.y1 && h.y + H > s.y0) {
      if (dy <= 0 && h.y - dy >= s.y1 - 0.25) { h.y = s.y1; h.vy = 0; h.ground = s; }
      else if (dy > 0) { h.y = s.y0 - H; h.vy = 0; lab.tone(90, 0.05, 'square', 0.05); } // стукнулся о скалу
    }
  },
  die(lab) {
    const st = lab.state, h = st.hero;
    st.deaths++; st.dead = 0.6; lab.count('падения');
    h.node.setEnabled(false);
    lab.burst([h.x, -2.2, 0], { count: 30, colors: ['#bff4ff', '#4fc3e8', '#ffffff'], speed: 6, up: 4 });
    lab.sfx.hit(); lab.shake(0.3); lab.flash('#4fc3e8', 0.2);
  },
  respawn(lab) {
    const st = lab.state, x = this.CHECKS[Math.min(st.cp, 2)] + 1.5, top = st.solids.find(s => !s.ceil && x >= s.x0 && x <= s.x1);
    st.hero = Object.assign(st.hero, { x, y: top ? top.y1 : 2, vx: 0, vy: 0, ground: top, off: 0, pend: null, jumped: false, face: 1, sq: 0 });
    st.hero.node.setEnabled(true);
    if (st.cp > 0) lab.pulse(st.hero.node, 1.3, 0.2);
  },
  reach(lab, i) {
    const st = lab.state, f = st.flags[i];
    st.cp = i; lab.pulse(f, 1.5, 0.3);
    if (i < 3) f.material = lab.mat('#4fc35a', { glow: 0.5 });
    lab.burst(f, { count: 30, colors: ['#ff4d5e', '#ffd23f', '#ffffff'], speed: 7, up: 3 });
    if (i < 3) { lab.sfx.power(); lab.popup(f, `Участок ${i + 1}!`, '#ffffff', 24); return; }
    // финиш: очки за время и рекорд призрака
    st.finish = lab.t; lab.count('финиш');
    lab.addScore(Math.max(0, Math.round((lab.cfg.limit - lab.t) * (lab.cfg.race ? 100 : 40))), f, '#7cf5a8');
    if (!this.bestRun || lab.t < this.bestRun.t) { this.bestRun = { t: lab.t, path: st.path.concat([[st.hero.x, st.hero.y, 1]]) }; lab.popup(st.hero.node, 'Новый призрак!', '#bff4ff', 22); }
    lab.win(`Сакля! Трасса за ${lab.t.toFixed(1)} с`);
  },

  /* ---------- картинка ---------- */
  part(lab, mesh, color, x = 0, y = 0, z = 0, o) { mesh.material = lab.mat(color, o || {}); mesh.position.set(x, y, z); return mesh; },
  merge(parts, name) {
    const groups = new Map();
    parts.forEach(p => groups.set(p.material, (groups.get(p.material) || []).concat(p)));
    const pieces = [...groups.values()].map(g => (g.length > 1 ? BABYLON.Mesh.MergeMeshes(g, true, true) : g[0]));
    const m = pieces.length > 1 ? BABYLON.Mesh.MergeMeshes(pieces, true, true, undefined, false, true) : pieces[0];
    m.name = name; m.isVisible = false; return m;
  },
  sources(lab, scene) {
    const MB = BABYLON.MeshBuilder, src = lab.state.src = {};
    const box = (c, o) => { const m = MB.CreateBox('блок', { size: 1 }, scene); m.material = lab.mat(c, o || {}); m.isVisible = false; return m; };
    src.rock = box('#d9844f'); src.rock2 = box('#c26b42'); src.grass = box('#6cc04a'); src.stone = box('#7d8fa3'); src.moss = box('#5fae4c');
    src.raft = box('#a8743f'); src.ceil = box('#c26b42');
    src.pine = [lab.prop('пихта', { v: 0 }), lab.prop('пихта', { v: 1 })];
    src.orb = this.part(lab, MB.CreateIcoSphere('огонёк', { radius: 0.32, subdivisions: 1, flat: true }, scene), '#ffd23f', 0, 0, 0, { glow: 1 }); src.orb.isVisible = false;
    src.foam = lab.noShadow(box('#e9fbff', { glow: 0.4 }));
  },
  // мир из готовых деталей: стены теснины, дальние горы, облака; своё — кош пастуха и сакля на финише
  world(lab, scene) {
    const MB = BABYLON.MeshBuilder, st = lab.state, src = st.src;
    lab.backdrop({ type: 'скалы ущелья', layers: 1 });
    lab.backdrop({ type: 'горы', layers: 1, colors: { камень: '#7d8fc0' } });
    lab.ambient('облака', { n: 10 });
    lab.ambient('птицы', { n: 5 });
    // река внизу теснины и пена
    const river = lab.noShadow(this.part(lab, MB.CreateBox('река', { width: 320, height: 0.2, depth: 30 }, scene), '#1784a3', 85, -2.9, 6));
    river.receiveShadows = true;
    st.foam = [];
    for (let i = 0; i < 30; i++) { const f = src.foam.createInstance('пена'); f.scaling.set(lab.rand(0.8, 2.5), 0.05, 0.12); f.position.set(lab.rand(-20, 200), -2.78, lab.rand(-2, 4)); st.foam.push(f); }
    // кош пастуха: каменная ограда с плетёной калиткой — стоит на широких скалах за тропой
    const kosh = lab.build('кош', [['box', [3.2, 0.7, 0.4], [0, 0.35, -1], 0, 'камень'], ['box', [3.2, 0.7, 0.4], [0, 0.35, 1], 0, 'камень'], ['box', [0.4, 0.7, 2.4], [-1.4, 0.35, 0], 0, 'камень'],
      ['box', [0.12, 0.9, 1.6], [1.5, 0.45, 0], 0.2, 'дерево'], ['box', [0.5, 0.5, 0.5], [-0.6, 0.25, 0], 0.4, '#f4f0e6'], ['sphere', [0.3, 0.3, 0.3], [-0.3, 0.55, 0], 0, '#f4f0e6']]);
    for (const x of [6, 64, 125]) { const s = this.LEVEL.find(l => !l[3] && x >= l[0] && x <= l[1]); kosh.copy([x, s[2], 3.2], 0.3); }
  },
  // скалы, камни, плоты, огоньки, флажки и сакля
  track(lab, scene) {
    const MB = BABYLON.MeshBuilder, st = lab.state, src = st.src;
    for (const [x0, x1, y, kind, mx, my, per] of this.LEVEL) {
      const w = x1 - x0, cx = (x0 + x1) / 2;
      if (kind === 'c') { // нависающая скала: потолок
        const r = src.ceil.createInstance('навес'); r.scaling.set(w, 12, 2.4); r.position.set(cx, y + 6, 0);
        st.solids.push({ x0, x1, y0: y, y1: y + 3, ceil: true });
        continue;
      }
      const s = { x0, x1, y0: kind ? y - 0.8 : -3, y1: y };
      if (kind === 'm') {
        const m = src.raft.createInstance('плот'); m.scaling.set(w, 0.5, 2.2);
        Object.assign(s, { y0: y - 0.5, mover: { m, bx: x0, by: y, w, mx, my, per, t: 0, dx: 0, dy: 0 } });
        st.movers.push(s);
      } else if (kind === 's') {
        const b = src.stone.createInstance('камень'); b.scaling.set(w, 3.4, 2.4); b.position.set(cx, y - 1.7, 0);
        const t = src.moss.createInstance('мох'); t.scaling.set(w * 0.9, 0.2, 2.2); t.position.set(cx, y + 0.02, 0);
      } else {
        const b = (x0 & 1 ? src.rock : src.rock2).createInstance('скала'); b.scaling.set(w, y + 3, 3); b.position.set(cx, (y - 3) / 2, 0);
        const t = src.grass.createInstance('трава'); t.scaling.set(w, 0.3, 3.1); t.position.set(cx, y + 0.05, 0);
        if (x1 < 168) for (let k = 0; k < w / 6; k++) lab.pick(src.pine).copy([lab.rand(x0 + 0.5, x1 - 0.5), y, lab.rand(1.2, 1.4)], lab.rand(0, 6), lab.rand(0.6, 0.9)); // у сакли без пихт: финиш виден
      }
      st.solids.push(s);
    }
    if (!lab.cfg.race) this.ORBS.forEach(([x, y]) => { const m = src.orb.createInstance('огонёк'); m.position.set(x, y, 0); st.orbs.push({ x, y, m }); });
    // флажки участков: серые, пока не добежал; последний — сакля
    st.flags = this.CHECKS.map((x, i) => {
      const top = st.solids.find(s => !s.ceil && x >= s.x0 && x <= s.x1).y1;
      if (i === 3) return this.saklya(lab, scene, x, top);
      this.part(lab, MB.CreateCylinder('древко', { height: 2.6, diameter: 0.1, tessellation: 5 }, scene), '#f4f0e6', x, top + 1.3, 0.6);
      return this.part(lab, MB.CreateBox('флаг', { width: 1, height: 0.6, depth: 0.05 }, scene), i ? '#9aa3ad' : '#4fc35a', x + 0.5, top + 2.25, 0.6, i ? {} : { glow: 0.5 });
    });
  },
  // сакля пастуха — ориентир финиша: видна с середины трассы, дым из трубы
  saklya(lab, scene, x, y) {
    const m = lab.build('сакля пастуха', [['box', [4, 2.4, 3], [0, 1.2, 0], 0, 'стена'], ['prism', [4.6, 1.6, 3.6], [0, 3.2, 0], 0, 'крыша'],
      ['box', [0.9, 1.5, 0.1], [-0.8, 0.75, -1.52], 0, 'дерево'], ['box', [0.8, 0.6, 0.1], [0.9, 1.4, -1.52], 0, '#ffd86b', { glow: 0.9 }],
      ['box', [0.5, 1.4, 0.5], [1.2, 3.8, 0.6], 0, 'камень'], ['box', [5, 0.3, 4], [0, 0.15, 0], 0, 'камень']]).copy([x, y, 2.5]);
    lab.ambient('дым из трубы', { at: [x + 1.2, y + 4.6, 3.1] });
    return m;
  },
  // тур — существо из набора: четвероногий, рога, борода; призрак — тот же тур, полупрозрачный
  buildTur(lab, scene, ghost) {
    const node = new BABYLON.TransformNode(ghost ? 'призрак' : 'тур', scene);
    const c = lab.creature({ plan: 'четвероногий', size: 1.5, role: ghost ? null : 'герой', autoFace: false, seed: 7,
      colors: { main: '#f2c46b', belly: '#fff4dc', second: '#6b4426', detail: '#4a3a2a', accent: '#ffd23f' },
      parts: ['рога', 'хвост'], face: { beard: '#4a3a2a' }, build: { legs: 'длинные' } });
    c.root.parent = node; c.root.rotation.y = Math.PI / 2; // лицом вправо, разворот — у узла
    if (ghost) c.meshes.forEach(m => { m.visibility = 0.35; lab.noShadow(m); });
    return { node, c, x: 0, y: 0, vx: 0, vy: 0, face: 1, sq: 0 };
  },
  animate(lab, h, dt) {
    const n = h.node, k = 1 - Math.exp(-dt * 12);
    n.position.set(h.x, h.y, 0);
    n.rotation.y = lab.lerp(n.rotation.y, h.face > 0 ? 0 : Math.PI, k * 1.5);
    n.rotation.z = h.ground ? 0 : lab.clamp(h.vy * 0.03, -0.35, 0.35) * h.face;
    h.sq = lab.lerp(h.sq, 0, k); // сжатие и растяжение
    n.scaling.set(1 + h.sq * 0.6, 1 - h.sq, 1 + h.sq * 0.3);
  },
  ghostAt(lab, g, t) {
    const P = this.bestRun.path, i = Math.min(P.length - 1, Math.floor(t / 0.05)), p = P[i];
    g.node.position.set(p[0], p[1], 0.8); g.node.rotation.y = p[2] > 0 ? 0 : Math.PI;
  },
  moveMover(lab, s, dt) {
    const m = s.mover, ox = s.x0, oy = s.y1;
    m.t += dt;
    const k = Math.sin(m.t * Math.PI * 2 / m.per);
    s.x0 = m.bx + m.mx * k; s.x1 = s.x0 + m.w; s.y1 = m.by + m.my * k; s.y0 = s.y1 - 0.5;
    m.dx = s.x0 - ox; m.dy = s.y1 - oy;
    m.m.position.set(s.x0 + m.w / 2, s.y1 - 0.25, 0);
  },
  camera(lab, dt) {
    const h = lab.state.hero, t = lab.camera.target, k = 1 - Math.exp(-dt * 4);
    t.x = lab.lerp(t.x, h.x + h.vx * 0.35 + 3, k);
    t.y = lab.lerp(t.y, Math.max(3.5, h.y + 2.5), k * 0.7);
  },
  tickWorld(lab, dt) {
    const st = lab.state;
    st.foam.forEach(f => { f.position.x -= dt * 3; if (f.position.x < lab.camera.target.x - 30) f.position.x += 60; });
    st.orbs.forEach((o, i) => { if (!o.taken) { o.m.position.y = o.y + Math.sin(lab.t * 3 + i) * 0.15; o.m.rotation.y += dt * 2; } });
  },
};
