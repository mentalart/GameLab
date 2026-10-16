/* ===== Фабрика MDA: ученик собирает игру из своих карт, игра показывает механику, динамику и эстетику ===== */
const HEROES = ['🦊', '🐉', '🤖', '👻', '🐝', '🧙', '🐱', '🚀'];
const PALS = [
  { n: 'Лаго-Наки', bg: '#24502e', bg2: '#4f8f4a', edge: '#e8d9a8', item: '#ffd23f', foe: '#7a2e24', txt: '#fff6dc', acc: '#ffd23f' },
  { n: 'Неон', bg: '#0e0820', bg2: '#22124a', edge: '#ff3df2', item: '#3dfcff', foe: '#ff4d6e', txt: '#e9fbff', acc: '#3dfcff' },
  { n: 'Закат', bg: '#3b1c38', bg2: '#c9604b', edge: '#ffcf8a', item: '#fff1b8', foe: '#21102a', txt: '#fff1dc', acc: '#ffcf8a' },
  { n: 'Ночь', bg: '#070d1e', bg2: '#16213f', edge: '#6f86c9', item: '#cfe3ff', foe: '#9a7bff', txt: '#dfe8ff', acc: '#9fc0ff' },
  { n: 'Конфетный', bg: '#ffc2dc', bg2: '#fff0f7', edge: '#ff6aa8', item: '#7a5cff', foe: '#e8245a', txt: '#3a0d22', acc: '#ff3d8a' },
];
const MUSIC = ['Тишина', 'Мягкие ноты', 'Быстрый бит'];
const GOALS = [
  { n: 'Собирать', d: 'На поле лежат цели, каждая даёт очки. Взял одну, появилась новая.' },
  { n: 'Охотиться', d: 'Цели убегают от героя. Догони и поймай.' },
  { n: 'Найти выход', d: 'Дойди до двери. Каждая следующая дверь даёт больше очков и ещё одну угрозу.' },
  { n: 'Выжить', d: 'Очки капают каждую секунду. Продержись до конца раунда.' },
];
const VERBS = [
  { n: 'Рывок', d: 'Короткий бросок вперёд, в рывке тебя нельзя ранить. Есть перезарядка.' },
  { n: 'Щит', d: 'Купол на секунду: отталкивает врагов и держит удар. Долгая перезарядка.' },
  { n: 'Выстрел', d: 'Снаряд летит туда, куда смотрит герой, и сбивает врагов.' },
  { n: 'Магнит', d: 'Пока держишь A, цели летят к тебе, но ты идёшь медленнее.' },
  { n: 'Замедление', d: 'Пока держишь A, мир замедляется. Энергия кончается и копится снова.' },
];
const THREATS = [
  { n: 'Охотники', d: 'Враги бегут за героем. Каждые несколько секунд их больше.' },
  { n: 'Метеоры', d: 'Падают с неба. Тень показывает место удара за секунду.' },
  { n: 'Патрули', d: 'Шипастые шары летят по прямой и отскакивают от стен.' },
  { n: 'Сжатие', d: 'Края поля горят и ползут к центру. Каждая цель отодвигает огонь.' },
  { n: 'Никого', d: 'Мирная игра, на героя никто не нападает.' },
];
const TWISTS = [
  { n: 'Без поворота', d: 'Только то, что выше.' },
  { n: 'Жадность', d: 'Цели подряд без удара дают множитель до ×5, но угрозы с ним ускоряются.' },
  { n: 'Тьма', d: 'Свет вокруг героя гаснет. Каждая цель возвращает свет.' },
  { n: 'Эхо', d: 'Где ты был 3 секунды назад, ходит твой призрак. Он ранит.' },
  { n: 'Зеркало', d: 'Каждые 12 с лево и право меняются местами. За 2 с мигает предупреждение.' },
];
const PLEAS = ['Ощущения', 'Фантазия', 'Повествование', 'Вызов', 'Общение', 'Открытие', 'Самовыражение', 'Отдых'];
const PLEAS_HINT = { 'Ощущения': 'приятно двигаться, смотреть и слушать', 'Фантазия': 'я кто-то другой в другом мире', 'Повествование': 'со мной происходит история', 'Вызов': 'трудно, но я справляюсь', 'Общение': 'играю вместе с другими или против них', 'Открытие': 'хочу узнать, что будет дальше', 'Самовыражение': 'играю по-своему, в своём стиле', 'Отдых': 'спокойно, можно не напрягаться' };
const DICE = {
  name: ['Хычин-рывок', 'Ночной аул', 'Лис против метеоров', 'Тихий сбор', 'Огненное кольцо', 'Почта нартов', 'Пчела без паники'],
  hero: ['Лис-почтальон', 'Робот-пекарь', 'Призрак из старой башни', 'Пчела-курьер', 'Юный нарт', 'Котёнок-астронавт'],
  world: ['ночной аул', 'плато Лаго-Наки', 'неоновый рынок', 'облачная кухня', 'пещера Азиш-Тау', 'крыша небоскрёба'],
  item: ['хычины', 'звёзды', 'письма', 'кристаллы', 'яблоки', 'искры'],
  why: ['Я задаю только механику, а динамику создаёт игрок своими действиями', 'Одна карта поменяла то, как я двигался, и вместе с этим поменялось чувство', 'Чтобы попасть в чувство, надо менять ту механику, которая рождает нужную динамику'],
};
const HONEST = ['Враги появляются у края со вспышкой, а не рядом с героем', 'Тень показывает место удара заранее', 'Шары летят по прямой, их путь можно прочитать', 'Огонь ползёт медленно, и его край хорошо виден', 'На героя ничто не нападает исподтишка'];
const CARDK = { look: 'Облик', pal: 'Палитра', music: 'Музыка', goal: 'Цель', verb: 'Глагол A', threat: 'Угроза', twist: 'Поворот' };

const GAME = {
  title: 'Фабрика MDA',
  subtitle: 'Собери свою игру из карт.',
  controls: [{ input: 'move4', text: 'двигаться' }, { input: 'a', text: 'глагол' }],
  decisions: [],
  palette: { bg: '#0e0820', accent: '#ffd23f' },
  config: {
    look: { value: 0, min: 0, max: 7, step: 1, names: HEROES, label: 'Облик героя' },
    pal: { value: 0, min: 0, max: 4, step: 1, names: PALS.map(p => p.n), label: 'Палитра' },
    music: { value: 0, min: 0, max: 2, step: 1, names: MUSIC, label: 'Музыка' },
    goal: { value: 0, min: 0, max: 3, step: 1, names: GOALS.map(x => x.n), label: 'Цель' },
    verb: { value: 0, min: 0, max: 4, step: 1, names: VERBS.map(x => x.n), label: 'Глагол на A' },
    threat: { value: 0, min: 0, max: 4, step: 1, names: THREATS.map(x => x.n), label: 'Угроза' },
    twist: { value: 0, min: 0, max: 4, step: 1, names: TWISTS.map(x => x.n), label: 'Поворот' },
    heroSpeed: { value: 260, min: 120, max: 450, step: 10, label: 'Скорость героя' },
    foeSpeed: { value: 130, min: 40, max: 300, step: 10, label: 'Скорость угроз' },
    spawnEvery: { value: 4, min: 1, max: 10, step: 0.5, label: 'Новая угроза раз в, с' },
    verbCd: { value: 1.2, min: 0.2, max: 6, step: 0.1, label: 'Перезарядка глагола, с' },
    roundTime: { value: 60, min: 20, max: 120, step: 5, label: 'Длина раунда, с' },
    lives: { value: 3, min: 1, max: 9, step: 1, label: 'Жизни' },
  },

  /* ---------- партия ---------- */
  start(g) {
    const s = g.state, c = g.cfg, W = g.W, H = g.H;
    s.h = { x: W / 2, y: H / 2, r: 18, fx: 1, fy: 0 };
    s.foes = []; s.pat = []; s.met = []; s.bul = []; s.items = []; s.tg = []; s.trail = [];
    s.cd = 0; s.dashT = 0; s.shieldT = 0; s.energy = 1; s.mult = 1; s.level = 1; s.light = 320; s.border = 0;
    s.spT = 0; s.metT = 0; s.patT = 0; s.mirT = 0; s.mirror = false; s.lastFlip = -9; s.lastHurt = -9; s.trailT = 0; s.survT = 0;
    s.beat = 0; s.note = 0; s.nmArmed = true; s.lastDir = '';
    s.d = { heat: new Array(24 * 14).fill(0), edge: 0, center: 0, idle: 0, turns: 0, nm: 0, uses: 0, saves: 0, hold: 0, goals: 0, greedy: 0, hurts: 0, flipHurts: 0, echoHurts: 0, maxMult: 1, lightSum: 0, distSum: 0, distT: 0, kills: 0, hurtPos: [] };
    s.snap = Object.assign({}, c);
    g.lives = Math.round(c.lives);
    const P = PALS[Math.round(c.pal)] || PALS[0]; g.palette.bg = P.bg; g.palette.accent = P.acc;
    const goal = Math.round(c.goal), thr = Math.round(c.threat);
    if (goal === 0) for (let i = 0; i < 3; i++) spawnItem(g);
    if (goal === 1) for (let i = 0; i < 3; i++) spawnTarget(g);
    if (goal === 2) placeDoor(g);
    if (thr === 0) spawnFoe(g);
    if (thr === 2) spawnPatrol(g);
  },

  update(g, dt) {
    const s = g.state, c = g.cfg, h = s.h; if (!h) return;
    const goal = Math.round(c.goal), verb = Math.round(c.verb), thr = Math.round(c.threat), tw = Math.round(c.twist);
    music(g, dt);
    // поворот «Зеркало»
    if (tw === 4) { s.mirT += dt; if (s.mirT >= 12) { s.mirT = 0; s.mirror = !s.mirror; s.lastFlip = g.t; g.sfx.whoosh(); g.flash('#ffffff', 0.25); g.popup(h.x, h.y - 40, s.mirror ? 'ЗЕРКАЛО!' : 'ОБРАТНО!', '#ffffff', 22); } }
    // ввод
    let ix = (g.input.right ? 1 : 0) - (g.input.left ? 1 : 0), iy = (g.input.down ? 1 : 0) - (g.input.up ? 1 : 0);
    if (s.mirror) ix = -ix;
    if (ix || iy) { const l = Math.hypot(ix, iy); ix /= l; iy /= l; const nd = Math.sign(ix) + ',' + Math.sign(iy); if (s.lastDir && nd !== s.lastDir) s.d.turns++; s.lastDir = nd; h.fx = ix; h.fy = iy; } else s.d.idle += dt;
    // глагол
    const near = nearest(g);
    const use = () => { s.d.uses++; if (near < 140) s.d.saves++; g.count('глагол'); };
    s.cd = Math.max(0, s.cd - dt);
    let slow = 1, spdK = 1;
    if (verb === 0 && g.pressed.a && s.cd <= 0) { s.dashT = 0.18; s.cd = c.verbCd; use(); g.sfx.whoosh(); g.burst(h.x, h.y, { count: 10, colors: ['#ffffff', PAL(g).acc], speed: 160 }); }
    if (verb === 1 && g.pressed.a && s.cd <= 0) { s.shieldT = 1.2; s.cd = c.verbCd * 3; use(); g.sfx.power(); }
    if (verb === 2 && g.pressed.a && s.cd <= 0) { s.bul.push({ x: h.x, y: h.y, vx: h.fx * 720, vy: h.fy * 720, life: 1 }); s.cd = c.verbCd * 0.3; use(); g.tone(900, 0.06, 'square', 0.06, 400); }
    if (verb === 3 && g.input.a) { spdK = 0.55; s.d.hold += dt; if (g.pressed.a) use(); }
    if (verb === 4) { if (g.input.a && s.energy > 0) { slow = 0.35; s.energy = Math.max(0, s.energy - dt / 3); s.d.hold += dt; if (g.pressed.a) { use(); g.tone(300, 0.4, 'sine', 0.08, 120); } } else s.energy = Math.min(1, s.energy + dt / Math.max(0.5, c.verbCd * 4)); }
    const wdt = dt * slow;
    // движение героя
    const sp = c.heroSpeed * spdK;
    if (s.dashT > 0) { s.dashT -= dt; h.x += h.fx * sp * 3.2 * dt; h.y += h.fy * sp * 3.2 * dt; }
    else { h.x += ix * sp * dt; h.y += iy * sp * dt; }
    h.x = g.clamp(h.x, h.r, g.W - h.r); h.y = g.clamp(h.y, h.r, g.H - h.r);
    s.shieldT = Math.max(0, s.shieldT - dt);
    const gk = tw === 1 ? 1 + 0.12 * (s.mult - 1) : 1;
    // угрозы
    s.spT += wdt;
    if (thr === 0) {
      if (s.spT >= c.spawnEvery && s.foes.length < 14) { s.spT = 0; spawnFoe(g); }
      for (const f of s.foes) {
        const a = Math.atan2(h.y - f.y, h.x - f.x), v = c.foeSpeed * gk * wdt;
        f.x += Math.cos(a) * v; f.y += Math.sin(a) * v;
        for (const o of s.foes) if (o !== f) { const dd = Math.hypot(f.x - o.x, f.y - o.y); if (dd < 30 && dd > 0) { f.x += (f.x - o.x) / dd * 40 * wdt; f.y += (f.y - o.y) / dd * 40 * wdt; } }
        const dd = Math.hypot(h.x - f.x, h.y - f.y);
        if (s.shieldT > 0 && dd < 70) { f.x -= Math.cos(a) * 260 * dt; f.y -= Math.sin(a) * 260 * dt; }
        else if (dd < h.r + f.r && hit(g, f.x, f.y)) { f.x -= Math.cos(a) * 90; f.y -= Math.sin(a) * 90; }
      }
    }
    if (thr === 1) {
      s.metT += wdt;
      const every = Math.max(0.35, c.spawnEvery * 0.3 - g.t * 0.004);
      if (s.metT >= every) { s.metT = 0; s.met.push({ x: g.clamp(h.x + g.rand(-220, 220), 30, g.W - 30), y: g.clamp(h.y + g.rand(-160, 160), 30, g.H - 30), t: 1, r: 48 }); }
      for (const m of s.met) {
        m.t -= wdt;
        if (m.t <= 0 && !m.done) { m.done = true; g.sfx.explode(); g.shake(6); g.burst(m.x, m.y, { count: 14, colors: [PAL(g).foe, '#ffb35c', '#ffffff'], speed: 240 }); if (Math.hypot(h.x - m.x, h.y - m.y) < m.r + h.r - 6) hit(g, m.x, m.y); }
      }
      s.met = s.met.filter(m => !m.done);
    }
    if (thr === 2) {
      s.patT += wdt;
      if (s.patT >= c.spawnEvery * 1.5 && s.pat.length < 8) { s.patT = 0; spawnPatrol(g); }
      for (const p of s.pat) {
        p.x += p.vx * gk * wdt; p.y += p.vy * gk * wdt;
        if (p.x < p.r || p.x > g.W - p.r) { p.vx *= -1; p.x = g.clamp(p.x, p.r, g.W - p.r); }
        if (p.y < p.r || p.y > g.H - p.r) { p.vy *= -1; p.y = g.clamp(p.y, p.r, g.H - p.r); }
        const dd = Math.hypot(h.x - p.x, h.y - p.y);
        if (s.shieldT > 0 && dd < 70) { p.vx = (p.x - h.x) / dd * Math.hypot(p.vx, p.vy); p.vy = (p.y - h.y) / dd * Math.hypot(p.vx, p.vy); }
        else if (dd < h.r + p.r - 4) hit(g, p.x, p.y);
      }
    }
    if (thr === 3) {
      s.border = Math.min(200, s.border + c.foeSpeed * 0.06 * gk * wdt);
      const b = s.border;
      if (h.x - h.r < b || h.x + h.r > g.W - b || h.y - h.r < b || h.y + h.r > g.H - b) {
        if (hit(g, h.x, h.y)) { h.x = g.clamp(h.x, b + h.r + 20, g.W - b - h.r - 20); h.y = g.clamp(h.y, b + h.r + 20, g.H - b - h.r - 20); }
      }
    }
    // снаряды
    for (const u of s.bul) {
      u.x += u.vx * dt; u.y += u.vy * dt; u.life -= dt;
      for (const arr of [s.foes, s.pat]) for (const f of arr) if (!f.dead && Math.hypot(u.x - f.x, u.y - f.y) < f.r + 6) { f.dead = true; u.life = 0; s.d.kills++; g.addScore(5, f.x, f.y); g.burst(f.x, f.y, { count: 14, colors: [PAL(g).foe, '#ffffff'], speed: 220 }); g.sfx.explode(); }
      for (const t of s.tg) if (!t.got && Math.hypot(u.x - t.x, u.y - t.y) < t.r + 6) { t.got = true; u.life = 0; onGoal(g, t.x, t.y, 20); }
    }
    s.bul = s.bul.filter(u => u.life > 0 && u.x > -20 && u.x < g.W + 20 && u.y > -20 && u.y < g.H + 20);
    s.foes = s.foes.filter(f => !f.dead); s.pat = s.pat.filter(f => !f.dead);
    // цели
    const magnet = verb === 3 && g.input.a;
    const pull = o => { if (!magnet) return; const dd = Math.hypot(h.x - o.x, h.y - o.y); if (dd < 240 && dd > 1) { o.x += (h.x - o.x) / dd * 300 * dt; o.y += (h.y - o.y) / dd * 300 * dt; } };
    if (goal === 0) {
      for (const it of s.items) { pull(it); if (Math.hypot(h.x - it.x, h.y - it.y) < h.r + 12) { it.got = true; onGoal(g, it.x, it.y, 10); } }
      s.items = s.items.filter(i => !i.got); while (s.items.length < 3) spawnItem(g);
    }
    if (goal === 1) {
      for (const t of s.tg) {
        const dd = Math.hypot(h.x - t.x, h.y - t.y);
        if (dd < 260) { const a = Math.atan2(t.y - h.y, t.x - h.x); t.vx = Math.cos(a) * c.heroSpeed * 0.78; t.vy = Math.sin(a) * c.heroSpeed * 0.78; }
        else { t.wt -= wdt; if (t.wt <= 0) { t.wt = g.rand(1, 2.5); const a = g.rand(0, 6.283); t.vx = Math.cos(a) * 70; t.vy = Math.sin(a) * 70; } }
        t.x += t.vx * wdt; t.y += t.vy * wdt;
        t.x = g.clamp(t.x, t.r, g.W - t.r); t.y = g.clamp(t.y, t.r, g.H - t.r);
        pull(t);
        if (Math.hypot(h.x - t.x, h.y - t.y) < h.r + t.r) { t.got = true; onGoal(g, t.x, t.y, 20); }
      }
      s.tg = s.tg.filter(t => !t.got); while (s.tg.length < 3) spawnTarget(g);
    }
    if (goal === 2 && s.door && Math.hypot(h.x - s.door.x, h.y - s.door.y) < h.r + 26) {
      onGoal(g, s.door.x, s.door.y, 50 * s.level); s.level++; placeDoor(g);
      if (thr === 0) spawnFoe(g); if (thr === 2) spawnPatrol(g); if (thr === 1) s.metT = 99;
    }
    if (goal === 3) {
      g.score += 5 * dt * s.mult;
      s.survT += dt; if (s.survT >= 6) { s.survT = 0; s.d.goals++; if (near < 140) s.d.greedy++; if (tw === 1) { s.mult = Math.min(5, s.mult + 1); s.d.maxMult = Math.max(s.d.maxMult, s.mult); } if (tw === 2) s.light = Math.min(320, s.light + 110); if (thr === 3) s.border = Math.max(0, s.border - 45); }
    }
    // повороты
    if (tw === 2) { s.light = Math.max(70, s.light - 14 * dt); s.d.lightSum += s.light * dt; }
    if (tw === 3) {
      s.trailT += dt; if (s.trailT >= 0.05) { s.trailT = 0; s.trail.push({ x: h.x, y: h.y, t: g.t }); }
      while (s.trail.length && g.t - s.trail[0].t > 3) s.trail.shift();
      if (g.t > 3 && s.trail.length) { const gh = s.trail[0]; if (Math.hypot(h.x - gh.x, h.y - gh.y) < h.r + 10 && Math.hypot(h.x - gh.x, h.y - gh.y) > 0.5 && hit(g, gh.x, gh.y)) s.d.echoHurts++; }
    }
    // телеметрия динамики
    const d = s.d, cx = Math.min(23, Math.floor(h.x / g.W * 24)), cy = Math.min(13, Math.floor(h.y / g.H * 14));
    d.heat[cy * 24 + cx] += dt;
    if (h.x < 110 || h.x > g.W - 110 || h.y < 110 || h.y > g.H - 110) d.edge += dt;
    if (Math.abs(h.x - g.W / 2) < g.W * 0.2 && Math.abs(h.y - g.H / 2) < g.H * 0.2) d.center += dt;
    const nn = nearest(g);
    if (isFinite(nn)) { d.distSum += Math.min(nn, 500) * dt; d.distT += dt; if (nn < 34 && s.nmArmed && g.t - s.lastHurt > 0.4) { d.nm++; s.nmArmed = false; } if (nn > 80) s.nmArmed = true; }
    if (g.t >= c.roundTime) g.win('Раунд пройден: ' + Math.round(c.roundTime) + ' с');
  },

  draw(g, ctx) {
    const s = g.state, c = g.cfg, P = PAL(g), W = g.W, H = g.H;
    const gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, P.bg); gr.addColorStop(1, P.bg2);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = P.edge; ctx.globalAlpha = 0.08; ctx.lineWidth = 1;
    for (let x = 40; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 40; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.globalAlpha = 1;
    if (!s.h) return;
    const h = s.h, tw = Math.round(c.twist), verb = Math.round(c.verb);
    // сжатие
    if (s.border > 0) {
      const b = s.border; ctx.fillStyle = 'rgba(255,90,40,.55)';
      ctx.fillRect(0, 0, W, b); ctx.fillRect(0, H - b, W, b); ctx.fillRect(0, b, b, H - 2 * b); ctx.fillRect(W - b, b, b, H - 2 * b);
      ctx.strokeStyle = '#ffb35c'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -g.t * 30; ctx.strokeRect(b, b, W - 2 * b, H - 2 * b); ctx.setLineDash([]);
    }
    // дверь
    if (s.door) { const pulse = 1 + 0.08 * Math.sin(g.t * 6); ctx.fillStyle = P.acc; ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(s.door.x, s.door.y, 40 * pulse, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1; ctx.fillStyle = P.edge; ctx.fillRect(s.door.x - 18, s.door.y - 26, 36, 52); ctx.fillStyle = P.bg; ctx.fillRect(s.door.x - 12, s.door.y - 20, 24, 46); ctx.fillStyle = P.acc; ctx.fillRect(s.door.x + 4, s.door.y + 2, 4, 4); }
    // цели
    for (const it of s.items) { const k = 0.6 + 0.4 * Math.sin(g.t * 4 + it.ph); ctx.fillStyle = P.item; ctx.globalAlpha = 0.25 * k; ctx.beginPath(); ctx.arc(it.x, it.y, 24, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(it.x, it.y, 11, 0, 6.283); ctx.fill(); }
    for (const t of s.tg) { ctx.fillStyle = P.item; ctx.beginPath(); ctx.ellipse(t.x, t.y, t.r, t.r * 0.8, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = P.bg; ctx.beginPath(); ctx.arc(t.x + Math.sign(t.vx || 1) * 5, t.y - 3, 3, 0, 6.283); ctx.fill(); }
    // метеоры: тень растёт, пока не ударит
    for (const m of s.met) { const k = 1 - Math.max(0, m.t); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(m.x, m.y, m.r * (0.4 + 0.6 * k), 0, 6.283); ctx.fill(); ctx.strokeStyle = P.foe; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.283); ctx.stroke(); const fy = m.y - 300 * Math.max(0, m.t); ctx.fillStyle = P.foe; ctx.beginPath(); ctx.arc(m.x, fy, 12, 0, 6.283); ctx.fill(); }
    // враги
    for (const f of s.foes) { ctx.fillStyle = P.foe; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283); ctx.fill(); const a = Math.atan2(h.y - f.y, h.x - f.x); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * 6 - 4, f.y + Math.sin(a) * 6 - 2, 3.5, 0, 6.283); ctx.arc(f.x + Math.cos(a) * 6 + 4, f.y + Math.sin(a) * 6 - 2, 3.5, 0, 6.283); ctx.fill(); }
    for (const p of s.pat) { ctx.fillStyle = P.foe; ctx.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283 + g.t * 3, rr = i % 2 ? p.r : p.r * 0.6; ctx.lineTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr); } ctx.fill(); }
    for (const u of s.bul) { ctx.fillStyle = P.acc; ctx.beginPath(); ctx.arc(u.x, u.y, 5, 0, 6.283); ctx.fill(); }
    // эхо
    if (tw === 3 && s.trail.length) {
      ctx.strokeStyle = P.edge; ctx.globalAlpha = 0.3; ctx.lineWidth = 3; ctx.beginPath(); s.trail.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); ctx.globalAlpha = 1;
      if (g.t > 3) { const gh = s.trail[0]; ctx.globalAlpha = 0.55; ctx.font = '28px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(HEROES[Math.round(c.look)] || '🦊', gh.x, gh.y); ctx.globalAlpha = 1; }
    }
    // герой
    if (!g.blink()) {
      ctx.fillStyle = P.acc; ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.arc(h.x, h.y, h.r + 6, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1;
      ctx.font = '32px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(HEROES[Math.round(c.look)] || '🦊', h.x, h.y + 1);
      ctx.fillStyle = P.txt; ctx.beginPath(); ctx.arc(h.x + h.fx * 26, h.y + h.fy * 26, 3, 0, 6.283); ctx.fill();
    }
    if (s.shieldT > 0) { ctx.strokeStyle = P.acc; ctx.lineWidth = 4; ctx.globalAlpha = Math.min(1, s.shieldT * 2); ctx.beginPath(); ctx.arc(h.x, h.y, 60, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1; }
    if (verb === 3 && g.input.a) { ctx.strokeStyle = P.item; ctx.globalAlpha = 0.35; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(h.x, h.y, 240, 0, 6.283); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; }
    // тьма
    if (tw === 2) {
      const rg = ctx.createRadialGradient(h.x, h.y, s.light * 0.6, h.x, h.y, s.light);
      rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,.94)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    }
    if (verb === 4 && g.input.a && s.energy > 0) { ctx.fillStyle = 'rgba(120,160,255,.12)'; ctx.fillRect(0, 0, W, H); }
    // шкала глагола под героем: видно, когда можно снова
    const vb = verb === 4 ? s.energy : verb === 3 ? 1 : 1 - s.cd / Math.max(0.01, verb === 1 ? c.verbCd * 3 : verb === 2 ? c.verbCd * 0.3 : c.verbCd);
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(h.x - 22, h.y + 26, 44, 5); ctx.fillStyle = vb >= 1 ? P.acc : '#9aa3c7'; ctx.fillRect(h.x - 22, h.y + 26, 44 * Math.max(0, Math.min(1, vb)), 5);
    if (tw === 1 && s.mult > 1) g.text('×' + s.mult, h.x, h.y - 30, { size: 16, color: P.acc, align: 'center' });
    // верхняя строка
    const goal = Math.round(c.goal), left = Math.max(0, Math.ceil(c.roundTime - g.t));
    const lab = goal === 0 ? `${G_ITEM()}: ${s.d.goals}` : goal === 1 ? `поймано: ${s.d.goals}` : goal === 2 ? `дверь ${s.level}` : 'держись';
    ctx.fillStyle = 'rgba(4,6,13,.6)'; ctx.fillRect(W / 2 - 160, 8, 320, 30);
    g.text(`${lab} · ${left} с` + (tw === 4 ? (s.mirror ? ' · ⇄ ЗЕРКАЛО' : '') : ''), W / 2, 28, { size: 15, color: '#ffffff', align: 'center' });
    if (tw === 4 && s.mirT > 10) { const on = Math.floor(g.t * 6) % 2; if (on) g.text('⇄ через ' + Math.ceil(12 - s.mirT), W / 2, 70, { size: 26, color: '#ffffff', align: 'center' }); }
  },

  /* ---------- фабрика: экран сборки ---------- */
  boot(g) { Fab.init(g); },
  padHook(b, prev, st) { return Fab.pad(b, prev, st); },
  onOver(g, tele) { Fab.over(g, tele); },
  overNote() { return ''; },
};

const PAL = g => PALS[Math.round(g.cfg.pal)] || PALS[0];
const G_ITEM = () => (Fab.B.item.v || 'цели');
function edgeSpawn(g) { const h = g.state.h; let x, y, k = 0; do { const e = g.randInt(0, 3); x = e === 0 ? 20 : e === 1 ? g.W - 20 : g.rand(20, g.W - 20); y = e === 2 ? 20 : e === 3 ? g.H - 20 : g.rand(20, g.H - 20); if (e < 2) y = g.rand(20, g.H - 20); } while (Math.hypot(x - h.x, y - h.y) < 260 && ++k < 20); return { x, y }; }
function spawnFoe(g) { const p = edgeSpawn(g); g.state.foes.push({ x: p.x, y: p.y, r: 16 }); g.burst(p.x, p.y, { count: 10, colors: ['#ffffff', PAL(g).foe], speed: 140 }); }
function spawnPatrol(g) { const p = edgeSpawn(g), a = g.rand(0, 6.283), v = g.cfg.foeSpeed * 1.3; g.state.pat.push({ x: p.x, y: p.y, r: 18, vx: Math.cos(a) * v, vy: Math.sin(a) * v }); }
function freeSpot(g, minD) { const h = g.state.h, b = g.state.border + 40; let x, y, k = 0; do { x = g.rand(b + 20, g.W - b - 20); y = g.rand(b + 50, g.H - b - 20); } while (Math.hypot(x - h.x, y - h.y) < minD && ++k < 30); return { x, y }; }
function spawnItem(g) { const p = freeSpot(g, 140); g.state.items.push({ x: p.x, y: p.y, ph: g.rand(0, 6) }); }
function spawnTarget(g) { const p = freeSpot(g, 200); g.state.tg.push({ x: p.x, y: p.y, r: 14, vx: 0, vy: 0, wt: 0 }); }
function placeDoor(g) { const p = freeSpot(g, 380); g.state.door = p; }
function nearest(g) {
  const s = g.state, h = s.h; let m = Infinity;
  for (const f of s.foes) m = Math.min(m, Math.hypot(h.x - f.x, h.y - f.y) - f.r - h.r);
  for (const f of s.pat) m = Math.min(m, Math.hypot(h.x - f.x, h.y - f.y) - f.r - h.r);
  for (const f of s.met) if (f.t < 0.7) m = Math.min(m, Math.hypot(h.x - f.x, h.y - f.y) - f.r - h.r);
  if (Math.round(g.cfg.threat) === 3) { const b = s.border; m = Math.min(m, h.x - h.r - b, g.W - b - h.x - h.r, h.y - h.r - b, g.H - b - h.y - h.r); }
  if (Math.round(g.cfg.twist) === 3 && g.t > 3 && s.trail.length) m = Math.min(m, Math.hypot(h.x - s.trail[0].x, h.y - s.trail[0].y) - 10 - h.r);
  return m;
}
function hit(g, x, y) {
  const s = g.state;
  if (s.dashT > 0 || s.shieldT > 0) return false;
  if (!g.hurt(x, y)) return false;
  s.d.hurts++; s.lastHurt = g.t; s.mult = 1; s.d.hurtPos.push([s.h.x, s.h.y]);
  if (Math.round(g.cfg.twist) === 4 && g.t - s.lastFlip < 1.5) s.d.flipHurts++;
  return true;
}
function onGoal(g, x, y, pts) {
  const s = g.state, c = g.cfg, tw = Math.round(c.twist);
  s.d.goals++; if (nearest(g) < 140) s.d.greedy++;
  g.addScore(pts * s.mult, x, y); g.sfx.coin(); g.burst(x, y, { count: 14, colors: [PAL(g).item, '#ffffff'], speed: 200 });
  if (tw === 1) { s.mult = Math.min(5, s.mult + 1); s.d.maxMult = Math.max(s.d.maxMult, s.mult); }
  if (tw === 2) s.light = Math.min(320, s.light + 110);
  if (Math.round(c.threat) === 3) s.border = Math.max(0, s.border - 45);
}
const PENTA = [392, 440, 523, 587, 659, 784];
function music(g, dt) {
  const s = g.state, m = Math.round(g.cfg.music); if (m === 0) return;
  s.beat += dt;
  if (m === 1 && s.beat > 0.75) { s.beat = 0; g.tone(g.pick(PENTA) / (s.note++ % 4 ? 1 : 2), 0.9, 'sine', 0.035); }
  if (m === 2 && s.beat > 0.2) { s.beat = 0; const n = s.note++ % 8; g.tone(n % 4 === 0 ? 110 : n % 2 ? 220 : 165, 0.08, 'square', 0.04); if (n % 2) g.noise(0.03, 0.04, 6000); }
}

/* ---------- динамика из телеметрии ---------- */
function dynamics(d, c, T) {
  const out = [], pct = x => Math.round(x / Math.max(0.1, T) * 100), perMin = x => Math.round(x / Math.max(0.1, T) * 60);
  const verb = VERBS[Math.round(c.verb)].n, thr = Math.round(c.threat), tw = Math.round(c.twist), danger = thr !== 4 || tw === 3;
  const add = (w, txt, p) => out.push({ w, txt, p });
  if (d.edge / T > 0.4) add(d.edge / T, `Держался у краёв поля: ${pct(d.edge)}% времени у стен`, 'Отдых или осторожность');
  if (d.center / T > 0.45) add(d.center / T, `Держал центр поля: ${pct(d.center)}% времени`, 'Вызов');
  if (d.idle / T > 0.25) add(d.idle / T, `Стоял и выжидал: ${pct(d.idle)}% времени без движения`, 'Отдых');
  if (d.turns / T > 1.2) add(Math.min(1, d.turns / T / 3), `Петлял: ${perMin(d.turns)} смен направления в минуту`, 'Ощущения');
  if (danger && d.nm >= 2 && perMin(d.nm) > 3) add(Math.min(1, perMin(d.nm) / 10), `Проходил впритирку: ${d.nm} раз опасность была в шаге и не задела`, 'Вызов');
  if (danger && d.distT > 5 && d.distSum / d.distT > 170 && d.nm < 3) add(0.55, `Держался подальше от опасности: в среднем ${Math.round(d.distSum / d.distT)} px`, 'Отдых');
  if (d.uses === 0) add(0.9, `Кнопку A (${verb}) не тронул ни разу: глагол молчит`, '—');
  else if (d.uses >= 3 && d.saves / d.uses > 0.5) add(d.saves / d.uses, `${verb} спасал: ${d.saves} из ${d.uses} раз рядом была опасность`, 'Вызов');
  else if (perMin(d.uses) > 25) add(0.7, `Жал ${verb} без остановки: ${perMin(d.uses)} раз в минуту`, 'Ощущения');
  if (d.hold / T > 0.35) add(d.hold / T, `${verb} держал зажатым ${pct(d.hold)}% времени`, 'Ощущения');
  if (d.goals >= 3 && d.greedy / d.goals > 0.35) add(d.greedy / d.goals, `Жадничал: ${d.greedy} из ${d.goals} целей взял рядом с опасностью`, 'Вызов');
  if (danger && d.goals >= 3 && d.greedy / d.goals < 0.1) add(0.5, `Осторожничал: брал только безопасные цели`, 'Отдых');
  if (d.goals / T * 60 > 14) add(0.6, `Собирал на скорости: ${perMin(d.goals)} целей в минуту`, 'Ощущения');
  if (d.hurts === 0 && T >= c.roundTime * 0.95 && danger) add(0.65, 'Ни одного удара: игра не давила', 'Отдых');
  if (d.hurts > 0 && T < c.roundTime * 0.5) add(0.8, `Игра раздавила быстро: конец на ${Math.round(T)}-й секунде`, 'Вызов');
  if (d.flipHurts) add(0.85, `Зеркало ловило: ${d.flipHurts} удар(а) сразу после переворота`, 'Открытие');
  if (d.maxMult >= 4) add(0.75, `Разгонял жадность до ×${d.maxMult}`, 'Вызов');
  if (tw === 2 && d.lightSum / T < 140) add(0.7, `Жил в темноте: свет в среднем ${Math.round(d.lightSum / T)} px`, 'Открытие');
  if (d.echoHurts) add(0.75, `Попался своему эху ${d.echoHurts} раз`, 'Открытие');
  if (d.kills >= 4) add(0.6, `Сбил ${d.kills} врагов`, 'Вызов');
  out.sort((a, b) => b.w - a.w);
  if (out.length < 2) out.push({ w: 0.1, txt: 'Спокойно бродил по полю', p: 'Отдых' });
  return out.slice(0, 3);
}

/* ---------- фабрика (экран сборки, разбор после партии) ---------- */
const Fab = {
  B: {}, runs: [], felt: [], fr: 0, fc: 0, built: false, why: { v: '', d: false }, ofc: 0,
  rows() {
    const B = this.B, it = B.item.v || 'цели', vb = B.verb.i >= 0 ? VERBS[B.verb.i].n.toLowerCase() : 'глагол';
    return [
      { k: 'name', t: 'text', label: 'Название игры', sec: '1. Кто и где' },
      { k: 'hero', t: 'text', label: 'Кто герой' },
      { k: 'look', t: 'chips', label: 'Облик героя', list: HEROES.map(n => ({ n })) },
      { k: 'world', t: 'text', label: 'Где всё происходит' },
      { k: 'pal', t: 'chips', label: 'Палитра мира', list: PALS.map(p => ({ n: p.n })) },
      { k: 'music', t: 'chips', label: 'Музыка', list: MUSIC.map(n => ({ n })) },
      { k: 'item', t: 'text', label: 'Что герой собирает или ловит' },
      { k: 'goal', t: 'chips', label: 'Цель', list: GOALS, sec: '2. Правила. Это механика (M): только её ты задаёшь напрямую' },
      { k: 'verb', t: 'chips', label: 'Глагол на кнопке A', list: VERBS },
      { k: 'threat', t: 'chips', label: 'Угроза', list: THREATS },
      { k: 'twist', t: 'chips', label: 'Поворот', list: TWISTS },
      { k: 'aim', t: 'chips', label: 'Какое удовольствие хочешь подарить игроку', list: PLEAS.map(n => ({ n, d: PLEAS_HINT[n] })), sec: '3. Цель по чувству. Это эстетика (A): ручки для неё нет, её можно только вызвать' },
      { k: 'd1', t: 'text', label: 'Решение 1 · Чувство', sec: '4. Три решения' },
      { k: 'd2', t: 'text', label: 'Решение 2 · Честность' },
      { k: 'd3', t: 'text', label: 'Решение 3 · Выбор' },
    ];
  },
  deck(k) {
    const B = this.B, it = B.item.v || 'цели', vb = B.verb.i >= 0 ? VERBS[B.verb.i].n : 'глагол', aim = B.aim.i >= 0 ? PLEAS[B.aim.i] : 'Вызов';
    if (DICE[k]) return DICE[k];
    if (k === 'd1') return [`Игрок чувствует: ${PLEAS_HINT[aim]}`, `После каждой партии хочется сказать «ещё одну»`, `${B.hero.v || 'Герой'} кажется живым: игрок за него переживает`];
    if (k === 'd2') { const t = B.threat.i >= 0 ? B.threat.i : 4, a = [HONEST[t], 'Всё, что может ранить, видно на экране заранее']; if (B.twist.i === 4) a.push('Переворот управления мигает за 2 секунды'); if (B.twist.i === 3) a.push('След эха нарисован, и видно, где пройдёт призрак'); return a; }
    if (k === 'd3') return [`Взять ${it} рядом с опасностью или обойти`, `Потратить ${vb.toLowerCase()} сейчас или приберечь`, `Остаться у края или выйти в центр за ${it}`];
    return ['?'];
  },
  cfgOf: { look: 'look', pal: 'pal', music: 'music', goal: 'goal', verb: 'verb', threat: 'threat', twist: 'twist' },
  init(g) {
    this.g = g; const B = this.B;
    for (const k of ['name', 'hero', 'world', 'item', 'd1', 'd2', 'd3']) B[k] = { v: '', d: false };
    for (const k of ['look', 'pal', 'music', 'goal', 'verb', 'threat', 'twist', 'aim']) B[k] = { i: -1, d: false };
    const css = document.createElement('style');
    css.textContent = `
#fab .card{width:min(940px,100%);gap:10px}
#fab .sec{margin:12px 0 0;font-size:13px;letter-spacing:.06em;color:var(--accent);font-weight:800;border-top:1px dashed var(--line);padding-top:10px}
.frow{display:grid;grid-template-columns:minmax(0,190px) minmax(0,1fr) auto;gap:8px;align-items:start;padding:5px 6px;border-radius:10px;border:1px solid transparent}
.frow.pf{border-color:var(--accent);background:rgba(255,255,255,.03)}
.frow .lb{font-size:13px;color:var(--muted);padding-top:8px}
.frow .lb b{color:var(--text);font-weight:700}
.frow textarea{width:100%;box-sizing:border-box;resize:none;background:#04060d;color:var(--text);border:1px solid var(--line);border-radius:8px;font:14px/1.35 system-ui,sans-serif;padding:7px 9px;min-height:36px}
.frow textarea.dice{border-color:#c18cff;color:#e6d4ff}
.fch{display:flex;flex-wrap:wrap;gap:6px}
.fch button{font:600 13.5px system-ui,sans-serif;color:var(--text);background:#04060d;border:1px solid var(--line);border-radius:999px;padding:6px 12px;cursor:pointer}
.fch button[aria-pressed="true"]{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.fch button.dice[aria-pressed="true"]{background:#c18cff;border-color:#c18cff;color:#1a0b2e}
.fch button.pf{outline:2px solid #fff;outline-offset:2px}
.fdesc{grid-column:2/-1;font-size:12.5px;color:var(--muted);margin:-2px 0 0}
.fdie{font-size:18px;width:40px;height:36px;border-radius:8px;border:1px solid var(--line);background:#04060d;cursor:pointer}
.ftag{grid-column:2/-1;font-size:11.5px;color:#c18cff;margin-top:-4px}
#fPrompt{white-space:pre-wrap;font:13px/1.5 ui-monospace,Consolas,monospace;background:#04060d;border:1px solid var(--line);border-radius:10px;padding:10px 12px;color:var(--text);margin:0}
.fhint{font-size:12.5px;color:var(--muted)}
.fbig{display:flex;flex-wrap:wrap;gap:10px;align-items:center;position:sticky;bottom:-20px;background:var(--panel);padding:10px 0}
#overScreen .card{width:min(900px,100%)}
#mda{display:grid;gap:10px}
.lad{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.lad>div{background:#04060d;border:1px solid var(--line);border-radius:10px;padding:8px 10px;font-size:13px;min-width:0}
.lad h4{margin:0 0 4px;font-size:12px;letter-spacing:.08em;color:var(--accent)}
.lad ul{margin:0;padding-left:16px;display:grid;gap:3px}
.lad small{color:var(--muted)}
.heat{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.heat canvas{width:240px;height:135px;border-radius:8px;border:1px solid var(--line);position:static}
.runs{width:100%;border-collapse:collapse;font-size:12.5px}
.runs td,.runs th{border-top:1px solid var(--line);padding:4px 6px;text-align:left;vertical-align:top}
.runs th{color:var(--muted);font-weight:600}
@media (max-width:640px){.frow{grid-template-columns:minmax(0,1fr) auto}.frow .lb{grid-column:1/-1;padding:0}.fdesc,.ftag{grid-column:1/-1}.lad{grid-template-columns:1fr}}
`;
    document.head.appendChild(css);
    const scr = document.createElement('div'); scr.className = 'screen'; scr.id = 'fab';
    scr.innerHTML = `<div class="card"><div class="eyebrow">Занятие 3 · чекпоинт 1</div><h1>Фабрика MDA</h1>
      <p class="sub">Собери свою игру из карт и слов. Ты задаёшь только правила. Что игрок будет делать и что почувствует, покажет сама игра после партии.</p>
      <div class="fhint" id="fHint"></div>
      <div id="fRows"></div>
      <div class="sec">5. ИГРА: так твой замысел уйдёт к Qwen</div>
      <pre id="fPrompt"></pre>
      <div class="fbig"><button type="button" class="btn" id="fBuild">Собрать игру</button><button type="button" class="ghost" id="fAll">Бросить кубики на пустые</button><span class="fhint" id="fCount"></span></div>
    </div>`;
    document.querySelector('#stage').appendChild(scr);
    this.renderRows();
    scr.querySelector('#fBuild').onclick = () => this.build();
    scr.querySelector('#fAll').onclick = () => { this.fillEmpty(); __lab.sfx.beep(); };
    document.querySelector('#startScreen').hidden = true;
    __lab.setState('build');
    addEventListener('keydown', e => this.key(e), true);
    this.hint();
    // кнопка «Поменять карту» в экране конца
    const ag = document.querySelector('#againBtn').parentNode;
    const ch = document.createElement('button'); ch.type = 'button'; ch.className = 'ghost'; ch.id = 'fChange'; ch.onclick = () => this.reopen(); ag.appendChild(ch);
    const cp = document.createElement('button'); cp.type = 'button'; cp.className = 'ghost'; cp.id = 'fCopy'; cp.textContent = 'Скопировать результат'; cp.onclick = () => this.copy(cp); ag.appendChild(cp);
    this.labels();
    setInterval(() => this.labels(), 500);
  },
  labels() {
    const p = __lab.pad();
    const ch = document.querySelector('#fChange'); if (ch) ch.textContent = p ? 'Поменять одну карту · B' : 'Поменять одну карту · C';
    const b = document.querySelector('#fBuild'); if (b) b.textContent = p ? 'Собрать игру · Start' : 'Собрать игру · Enter';
    const a = document.querySelector('#fAll'); if (a) a.textContent = p ? 'Кубики на пустые · X' : 'Кубики на пустые · Q';
    this.hint();
  },
  hint() {
    const el = document.querySelector('#fHint'); if (!el) return;
    el.innerHTML = __lab.pad() ? '<kbd>Крестовина</kbd> ряд и карта · <kbd>A</kbd> выбрать · <kbd>Y</kbd> кубик ряда · <kbd>X</kbd> кубики на пустые · <kbd>Start</kbd> собрать' : 'Мышью или <kbd>↑ ↓</kbd> ряд, <kbd>← →</kbd> карта, <kbd>Пробел</kbd> выбрать, <kbd>R</kbd> кубик ряда, <kbd>Q</kbd> кубики на пустые, <kbd>Enter</kbd> собрать. Пиши в полях сам: то, что выпало на кубике и не тронуто, уйдёт с пометкой [кубик].';
  },
  renderRows() {
    const box = document.querySelector('#fRows'); box.innerHTML = '';
    this.rows().forEach((r, ri) => {
      if (r.sec) { const s = document.createElement('div'); s.className = 'sec'; s.textContent = r.sec; box.appendChild(s); }
      const w = document.createElement('div'); w.className = 'frow'; w.dataset.k = r.k; w.dataset.ri = ri;
      w.innerHTML = `<div class="lb"><b>${r.label}</b></div>` + (r.t === 'text' ? `<textarea rows="1" aria-label="${r.label}"></textarea>` : `<div class="fch"></div>`) + `<button type="button" class="fdie" aria-label="Кубик: ${r.label}">🎲</button>` + (r.t === 'chips' ? '<p class="fdesc"></p>' : '') + '<div class="ftag"></div>';
      box.appendChild(w);
      w.querySelector('.fdie').onclick = () => { this.roll(r.k); this.fr = ri; this.focus(); };
      if (r.t === 'text') {
        const ta = w.querySelector('textarea');
        ta.oninput = () => { this.B[r.k] = { v: ta.value, d: false }; this.updRow(r.k); this.prompt(); };
        ta.onfocus = () => { this.fr = ri; this.focus(); };
      }
      this.updRow(r.k);
    });
    this.prompt(); this.focus();
  },
  row(k) { return document.querySelector(`.frow[data-k="${k}"]`); },
  updRow(k) {
    const w = this.row(k); if (!w) return; const r = this.rows().find(x => x.k === k), v = this.B[k];
    if (r.t === 'text') { const ta = w.querySelector('textarea'); if (ta.value !== v.v) ta.value = v.v; ta.classList.toggle('dice', v.d); }
    else {
      const ch = w.querySelector('.fch');
      ch.innerHTML = r.list.map((o, i) => `<button type="button" aria-pressed="${v.i === i}" class="${v.i === i && v.d ? 'dice' : ''}" data-i="${i}">${o.n}</button>`).join('');
      ch.querySelectorAll('button').forEach(b => b.onclick = () => { this.choose(k, +b.dataset.i, false); this.fr = +w.dataset.ri; this.fc = +b.dataset.i; this.focus(); });
      w.querySelector('.fdesc').textContent = v.i >= 0 && r.list[v.i].d ? r.list[v.i].d : '';
    }
    w.querySelector('.ftag').textContent = v.d ? '[кубик] выпало на кубике. Поменяй, и станет твоим' : '';
  },
  choose(k, i, dice) { this.B[k] = { i, d: dice }; __lab.tone(600 + i * 50, 0.07, 'triangle', 0.08); this.updRow(k); if (k === 'verb' || k === 'threat' || k === 'twist' || k === 'aim' || k === 'goal') this.prompt(); this.prompt(); },
  roll(k) {
    const r = this.rows().find(x => x.k === k);
    if (r.t === 'text') { const deck = this.deck(k); let v, n = 0; do { v = deck[Math.floor(Math.random() * deck.length)]; } while (v === this.B[k].v && ++n < 10); this.B[k] = { v, d: true }; this.updRow(k); }
    else { let i, n = 0; do { i = Math.floor(Math.random() * r.list.length); } while (i === this.B[k].i && ++n < 10); this.choose(k, i, true); return; }
    __lab.tone(800, 0.06, 'square', 0.06); this.prompt();
  },
  empty(k) { const v = this.B[k]; return v.v != null ? !v.v.trim() : v.i < 0; },
  fillEmpty() { for (const r of this.rows()) if (this.empty(r.k)) this.roll(r.k); },
  T(k) { const v = this.B[k], r = this.rows().find(x => x.k === k); if (v.v != null) return v.v ? v.v + (v.d ? ' [кубик]' : '') : '…'; return v.i >= 0 ? r.list[v.i].n + (v.d ? ' [кубик]' : '') : '…'; },
  prompt() {
    const B = this.B, t = k => this.T(k);
    const txt = `ИГРА: «${t('name')}».\nГерой: ${t('hero')} ${B.look.i >= 0 ? HEROES[B.look.i] : ''}. Мир: ${t('world')}, палитра ${t('pal')}, музыка ${t('music')}.\nЦель: ${t('goal')} (${t('item')}). Кнопка A: ${t('verb')}. Угроза: ${t('threat')}. Поворот: ${t('twist')}.\nРешения: 1) ${t('d1')}. 2) ${t('d2')}. 3) ${t('d3')}.\nХочу подарить игроку удовольствие: ${t('aim')}.`;
    document.querySelector('#fPrompt').textContent = txt;
    const own = this.rows().filter(r => !this.empty(r.k) && !this.B[r.k].d).length;
    document.querySelector('#fCount').textContent = `своими руками: ${own} из ${this.rows().length}`;
  },
  focus() {
    document.querySelectorAll('.frow').forEach(w => w.classList.toggle('pf', +w.dataset.ri === this.fr));
    document.querySelectorAll('.fch button').forEach(b => b.classList.remove('pf'));
    const w = document.querySelector(`.frow[data-ri="${this.fr}"]`); if (!w) return;
    const bs = w.querySelectorAll('.fch button');
    if (bs.length) { this.fc = Math.max(0, Math.min(bs.length - 1, this.fc)); bs[this.fc].classList.add('pf'); }
    w.scrollIntoView({ block: 'nearest' });
  },
  nav(dir) {
    const R = this.rows();
    if (dir === 'up' || dir === 'down') { this.fr = Math.max(0, Math.min(R.length - 1, this.fr + (dir === 'down' ? 1 : -1))); const v = this.B[R[this.fr].k]; this.fc = v.i >= 0 ? v.i : 0; }
    else this.fc += dir === 'right' ? 1 : -1;
    __lab.tone(500, 0.03, 'triangle', 0.04); this.focus();
  },
  act() { const r = this.rows()[this.fr]; if (r.t === 'chips') this.choose(r.k, this.fc, false); else this.roll(r.k); },
  key(e) {
    const st = __lab.getState();
    if (st === 'build') {
      if (e.target && e.target.tagName === 'TEXTAREA') { if (e.code === 'Enter' && !e.shiftKey) { e.preventDefault(); e.target.blur(); } return; }
      const m = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.code];
      if (m) { e.preventDefault(); e.stopPropagation(); this.nav(m); return; }
      if (e.code === 'Space') { e.preventDefault(); this.act(); return; }
      if (e.code === 'KeyR') { this.roll(this.rows()[this.fr].k); this.focus(); return; }
      if (e.code === 'KeyQ') { this.fillEmpty(); return; }
      if (e.code === 'Enter') { e.preventDefault(); this.build(); return; }
    }
    if (st === 'over' && !(e.target && e.target.tagName === 'TEXTAREA')) {
      const n = +e.key; if (n >= 1 && n <= 8) { this.toggleFelt(n - 1); return; }
      if (e.code === 'KeyC') { this.reopen(); return; }
    }
  },
  pad(b, prev, st) {
    const down = i => b[i] && !prev[i];
    if (st === 'build') {
      if (down(12)) this.nav('up'); if (down(13)) this.nav('down'); if (down(14)) this.nav('left'); if (down(15)) this.nav('right');
      if (down(0)) this.act(); if (down(3)) { this.roll(this.rows()[this.fr].k); this.focus(); } if (down(2)) this.fillEmpty();
      if (down(9)) this.build(); if (down(8)) __lab.togglePanel();
      return true;
    }
    if (st === 'over') {
      if (down(14)) { this.ofc = (this.ofc + 7) % 8; this.overChips(); } if (down(15)) { this.ofc = (this.ofc + 1) % 8; this.overChips(); }
      if (down(0)) this.toggleFelt(this.ofc);
      if (down(1)) this.reopen();
      if (down(9)) __lab.confirmAction(); if (down(8)) __lab.togglePanel();
      return true;
    }
    return false;
  },
  build() {
    if (__lab.getState() !== 'build') return;
    this.fillEmpty();
    const g = this.g, B = this.B, D = __lab.defaults();
    for (const k in this.cfgOf) { g.cfg[this.cfgOf[k]] = B[k].i; D[this.cfgOf[k]] = B[k].i; }
    __lab.syncKnobs();
    GAME.title = B.name.v; GAME.subtitle = `${B.hero.v} ${HEROES[B.look.i]} · ${B.world.v}. Цель: ${GOALS[B.goal.i].n.toLowerCase()} (${B.item.v}). A: ${VERBS[B.verb.i].n.toLowerCase()}. Угроза: ${THREATS[B.threat.i].n.toLowerCase()}. Поворот: ${TWISTS[B.twist.i].n.toLowerCase()}.`;
    GAME.decisions = [B.d1.v, B.d2.v, B.d3.v];
    GAME.controls[1].text = VERBS[B.verb.i].n.toLowerCase() + (B.verb.i >= 3 ? ' (держать)' : '');
    document.title = B.name.v;
    document.querySelector('#gTitle').textContent = B.name.v;
    document.querySelector('#gSub').textContent = GAME.subtitle;
    document.querySelector('#decisions').innerHTML = GAME.decisions.map(d => `<li>${d.replace(/[&<>]/g, '')}</li>`).join('');
    document.querySelector('#decBox').hidden = false;
    document.querySelector('#eyebrow').textContent = 'Собрано Qwen по твоему замыслу';
    __lab.renderControls();
    g.state = {}; GAME.start(g);
    document.querySelector('#fab').hidden = true;
    document.querySelector('#overScreen').hidden = true;
    document.querySelector('#startScreen').hidden = false;
    __lab.setState('menu'); __lab.sfx.power(); this.built = true;
  },
  reopen() {
    if (__lab.getState() !== 'over') return;
    const g = this.g;
    for (const k in this.cfgOf) { const v = Math.round(g.cfg[this.cfgOf[k]]); if (v !== this.B[k].i) this.B[k] = { i: v, d: false }; }
    this.renderRows();
    const ex = document.querySelector('#fHint');
    this.hint(); ex.innerHTML = '<b style="color:var(--accent)">Эксперимент: поменяй только одну карту правил (или одну ручку в Tab) и собери снова. Так будет видно, какая механика двигает динамику.</b><br>' + ex.innerHTML;
    document.querySelector('#overScreen').hidden = true; document.querySelector('#fab').hidden = false;
    __lab.setState('build'); this.fr = 7; this.focus();
  },
  over(g, tele) {
    const s = g.state, c = g.cfg, T = Math.max(1, tele.time);
    const dyn = dynamics(s.d, c, T);
    const prev = this.runs[this.runs.length - 1];
    const changed = prev ? Object.keys(c).filter(k => Math.abs((prev.snap[k] ?? 0) - (s.snap[k] ?? 0)) > 1e-9).map(k => { const m = GAME.config[k] || { label: k }; const f = v => m.names ? m.names[Math.round(v)] : Math.round(v * 100) / 100; return `${m.label}: ${f(prev.snap[k])} → ${f(s.snap[k])}`; }) : [];
    this.runs.push({ snap: s.snap, score: Math.floor(g.score), time: Math.round(T), dyn, felt: [], changed, won: T >= c.roundTime - 0.1 });
    this.ofc = 0; this.drawOver(s.d); const cb = document.querySelector('#fCopyBox'); if (cb) cb.hidden = true;
  },
  drawOver(d) {
    const run = this.runs[this.runs.length - 1], sn = run.snap, B = this.B;
    const M = [`Цель: ${GOALS[Math.round(sn.goal)].n}`, `A: ${VERBS[Math.round(sn.verb)].n}`, `Угроза: ${THREATS[Math.round(sn.threat)].n}`, `Поворот: ${TWISTS[Math.round(sn.twist)].n}`];
    const aim = B.aim.i >= 0 ? PLEAS[B.aim.i] : '—';
    document.querySelector('#mda').innerHTML = `
      <div class="lad">
        <div><h4>M · ТЫ ЗАДАЛ</h4><ul>${M.map(x => `<li>${x}</li>`).join('')}</ul>${run.changed.length ? `<small>Поменял с прошлой партии: ${run.changed.join('; ')}</small>` : ''}</div>
        <div><h4>D · ЧТО ПОЛУЧИЛОСЬ В ИГРЕ</h4><ul>${run.dyn.map(x => `<li>${x.txt}</li>`).join('')}</ul><small>Это посчитала игра по твоей партии. Ты этого не задавал.</small></div>
        <div><h4>A · ЧТО ТЫ ПОЧУВСТВОВАЛ?</h4><div class="fch" id="oFelt"></div><small id="oAim"></small></div>
      </div>
      <div class="heat"><canvas id="oHeat" width="240" height="135" aria-label="Карта: где герой был дольше"></canvas><div class="fhint" style="flex:1;min-width:200px">Карта партии: чем ярче клетка, тем дольше там был герой. Красные крестики — удары. Это динамика, которую видно глазами.<br>${__lab.pad() ? '<kbd>← →</kbd> и <kbd>A</kbd> выбрать чувство (до двух)' : 'Клавиши <kbd>1</kbd>–<kbd>8</kbd> выбирают чувство (до двух)'}.</div></div>
      ${this.runs.length > 1 ? `<table class="runs"><tr><th>Партия</th><th>Что поменял</th><th>Главная динамика</th><th>Чувство</th><th>Очки</th></tr>${this.runs.map((r, i) => `<tr><td>${i + 1}</td><td>${r.changed.join('; ') || (i ? 'ничего' : 'первая сборка')}</td><td>${r.dyn[0].txt}</td><td>${r.felt.join(', ') || '…'}</td><td>${r.score}</td></tr>`).join('')}</table>` : ''}
      ${this.runs.length > 1 ? `<div class="frow" style="grid-template-columns:minmax(0,1fr) auto"><div class="lb" style="grid-column:1/-1;padding:0"><b>Что ты понял про M, D и A?</b></div><textarea id="oWhy" rows="2" aria-label="Что ты понял"></textarea><button type="button" class="fdie" id="oWhyD" aria-label="Кубик">🎲</button><div class="ftag" id="oWhyT" style="grid-column:1/-1"></div></div>` : '<p class="fhint">Теперь нажми «Поменять одну карту» и сыграй ещё раз: посмотрим, как поменяется динамика.</p>'}`;
    this.overChips(); this.heat(d);
    const ta = document.querySelector('#oWhy');
    if (ta) {
      ta.value = this.why.v; ta.classList.toggle('dice', this.why.d); document.querySelector('#oWhyT').textContent = this.why.d ? '[кубик] поправь пару слов, и мысль станет твоей' : '';
      ta.oninput = () => { this.why = { v: ta.value, d: false }; ta.classList.remove('dice'); document.querySelector('#oWhyT').textContent = ''; };
      document.querySelector('#oWhyD').onclick = () => { let v; do { v = DICE.why[Math.floor(Math.random() * DICE.why.length)]; } while (v === this.why.v); this.why = { v, d: true }; ta.value = v; ta.classList.add('dice'); document.querySelector('#oWhyT').textContent = '[кубик] поправь пару слов, и мысль станет твоей'; __lab.tone(800, 0.06, 'square', 0.06); };
    }
  },
  overChips() {
    const run = this.runs[this.runs.length - 1]; if (!run) return; const el = document.querySelector('#oFelt'); if (!el) return;
    el.innerHTML = PLEAS.map((p, i) => `<button type="button" aria-pressed="${run.felt.includes(p)}" class="${__lab.pad() && i === this.ofc ? 'pf' : ''}" data-i="${i}" title="${PLEAS_HINT[p]}">${i + 1} ${p}</button>`).join('');
    el.querySelectorAll('button').forEach(b => b.onclick = () => this.toggleFelt(+b.dataset.i));
    const aim = this.B.aim.i >= 0 ? PLEAS[this.B.aim.i] : null, o = document.querySelector('#oAim');
    if (!run.felt.length) o.textContent = `Ты целился в «${aim}». Выбери, что получилось на самом деле.`;
    else if (run.felt.includes(aim)) o.textContent = `Попал: целился в «${aim}», и игра это дала. Какая динамика слева это сделала?`;
    else o.textContent = `Мимо: целился в «${aim}», а вышло «${run.felt.join('», «')}». Найди в столбце D, что увело в сторону, и поменяй механику, которая это создаёт.`;
    const tr = document.querySelectorAll('.runs tr'); if (tr.length) tr[tr.length - 1].children[3].textContent = run.felt.join(', ') || '…';
  },
  toggleFelt(i) {
    const run = this.runs[this.runs.length - 1]; if (!run) return; const p = PLEAS[i];
    if (run.felt.includes(p)) run.felt = run.felt.filter(x => x !== p); else { run.felt.push(p); if (run.felt.length > 2) run.felt.shift(); }
    this.ofc = i; __lab.tone(650 + i * 40, 0.08, 'triangle', 0.08); this.overChips();
  },
  heat(d) {
    const cv = document.querySelector('#oHeat'); if (!cv) return; const x = cv.getContext('2d'), P = PAL(this.g);
    x.fillStyle = P.bg; x.fillRect(0, 0, 240, 135);
    const mx = Math.max(0.01, ...d.heat);
    for (let i = 0; i < d.heat.length; i++) { const v = d.heat[i] / mx; if (v <= 0) continue; x.fillStyle = P.acc; x.globalAlpha = Math.min(1, 0.12 + v * 0.88); x.fillRect((i % 24) * 10, Math.floor(i / 24) * 9.64, 10, 9.64); }
    x.globalAlpha = 1; x.strokeStyle = '#ff4d5e'; x.lineWidth = 2;
    for (const [hx, hy] of d.hurtPos) { const px = hx / 4, py = hy / 4; x.beginPath(); x.moveTo(px - 4, py - 4); x.lineTo(px + 4, py + 4); x.moveTo(px + 4, py - 4); x.lineTo(px - 4, py + 4); x.stroke(); }
  },
  copy(btn) {
    const B = this.B, t = k => this.T(k);
    const lines = ['Занятие 3 · чекпоинт 1 · Фабрика MDA', `Игра: «${t('name')}». Герой: ${t('hero')} ${B.look.i >= 0 ? HEROES[B.look.i] : ''}, мир: ${t('world')}, ${t('item')}.`, `Целился в удовольствие: ${t('aim')}`, `Решения: 1) ${t('d1')} 2) ${t('d2')} 3) ${t('d3')}`];
    this.runs.forEach((r, i) => {
      const sn = r.snap;
      lines.push(`Партия ${i + 1}: M = ${GOALS[Math.round(sn.goal)].n}, A: ${VERBS[Math.round(sn.verb)].n}, ${THREATS[Math.round(sn.threat)].n}, ${TWISTS[Math.round(sn.twist)].n}${r.changed.length ? ` · поменял: ${r.changed.join('; ')}` : ''}`);
      lines.push(`  D: ${r.dyn.map(x => x.txt).join(' | ')}`);
      lines.push(`  A: ${r.felt.join(', ') || '—'} · очки ${r.score}, ${r.time} с`);
    });
    if (this.runs.length > 1) lines.push(`Вывод: ${this.why.v ? this.why.v + (this.why.d ? ' [кубик]' : '') : '—'}`);
    const txt = lines.join('\n');
    const done = () => { btn.textContent = 'Скопировано'; setTimeout(() => btn.textContent = 'Скопировать результат', 1500); };
    try { navigator.clipboard.writeText(txt).then(done, () => this.showCopy(txt)); } catch (e) { this.showCopy(txt); }
    window.__fabLast = txt;
  },
  showCopy(txt) {
    let b = document.querySelector('#fCopyBox');
    if (!b) { b = document.createElement('textarea'); b.id = 'fCopyBox'; b.className = 'copy'; b.readOnly = true; b.setAttribute('aria-label', 'Результат'); document.querySelector('#fCopy').parentNode.after(b); }
    b.value = txt; b.hidden = false; b.select(); document.querySelector('#fCopy').textContent = 'Выдели и скопируй';
  },
};
