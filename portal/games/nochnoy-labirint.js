// «Ночной лабиринт» — ремейк-донор урока 3 по мотивам механики Pac-Man.
// Образец игры в лабиринте по клеткам: герой с поворотом заранее, охотники с простыми правилами выбора пути, смена режимов.
// Секрет донора — у каждого из четырёх волков одно своё правило (гонится, заходит наперерез, срезает по напарнику, пугается вблизи)
// и погоня сменяется разбегом. Из простых механик рождается динамика «меня окружают». Ручка «Секрет», пресет «Без секрета».
const GAME = {
  title: 'Ночной лабиринт',
  subtitle: 'Собери светлячков в каменном лабиринте у дольмена. Схватил факел — и волки бегут от тебя.',
  donor: 'Pac-Man',
  players: 1,
  duo: 'vs', // ручка vs > 0 включает второго игрока: он ведёт Вожака
  controls: [
    { input: 'move4', text: 'бежать по лабиринту' },
  ],
  camera: { type: 'iso', beta: 0.56, target: [0, 0, -1.2] },
  field: { w: 26, h: 31 },
  accent: '#d8ff6a',
  decisions: [
    'Чувство: «меня окружают» — волки заходят с разных сторон, а с факелом охотник и добыча меняются местами',
    'Честность: у каждого волка свой цвет и характер, факел мигает перед концом, дольмен светится цветом волка, который сейчас выйдет',
    'Выбор: собирать светлячков дальше или подманить волков к факелу и прогнать всех разом',
  ],
  config: {
    secret: { value: 1, min: 0, max: 1, step: 1, label: 'Секрет: у каждого волка свой характер', hint: '0 — все волки просто гонятся за тобой и не отступают; 1 — четыре характера и разбег, как в оригинале' },
    heroSpeed: { value: 5.4, min: 2, max: 10, step: 0.2, label: 'Скорость пастушка, клеток/с' },
    wolfSpeed: { value: 4.8, min: 2, max: 10, step: 0.2, label: 'Скорость волков, клеток/с' },
    frightSpeed: { value: 2.8, min: 1, max: 6, step: 0.2, label: 'Скорость волков, бегущих от факела' },
    powerTime: { value: 7, min: 1, max: 20, step: 0.5, label: 'Факел горит, с' },
    warnTime: { value: 2, min: 0, max: 5, step: 0.5, label: 'Факел мигает перед концом, с' },
    scatterTime: { value: 6, min: 0, max: 15, step: 1, label: 'Разбег: волки уходят в свои углы, с' },
    chaseTime: { value: 18, min: 5, max: 40, step: 1, label: 'Погоня, с' },
    ahead: { value: 4, min: 0, max: 8, step: 1, label: 'Хитрец целится на клеток вперёд тебя' },
    shyRadius: { value: 6, min: 2, max: 12, step: 1, label: 'Трус пугается ближе, клеток' },
    release: { value: 4, min: 0.5, max: 12, step: 0.5, label: 'Волки выходят из дольмена раз в, с' },
    wolves: { value: 4, min: 1, max: 4, step: 1, label: 'Волков', restart: true },
    nightUp: { value: 0.06, min: 0, max: 0.2, step: 0.01, label: 'Волки быстрее с каждой ночью' },
    showTargets: { value: 0, min: 0, max: 1, step: 1, label: 'Показать, куда целится каждый волк', hint: 'Крестик цвета волка на клетке, к которой он идёт' },
    vs: { value: 0, min: 0, max: 1, step: 1, label: 'Второй игрок ведёт Вожака', hint: '1 — пастушок на WASD или геймпаде 1, Вожак на стрелках или геймпаде 2', restart: true },
    lives: { value: 3, min: 1, max: 9, step: 1, label: 'Жизни', restart: true },
  },
  presets: {
    'Новичок': { wolfSpeed: 4, powerTime: 10, warnTime: 3, wolves: 3, lives: 5 },
    'Без секрета': { secret: 0 },
    'Цели видно': { showTargets: 1 },
    'Безумие': { wolfSpeed: 6.4, heroSpeed: 6.4, powerTime: 3, release: 1, scatterTime: 2 },
    'Вдвоём': { vs: 1 },
  },

  S: 1.25, // шаг клетки, м
  // # — стена, . — светлячок, o — факел, P — пастушок, D — дольмен, - — дверь дольмена, x — пусто за лабиринтом. Строка 9 — тоннель
  MAP: [
    '###################',
    '#o.......#.......o#',
    '#.##.###.#.###.##.#',
    '#.................#',
    '#.##.#.#####.#.##.#',
    '#....#...#...#....#',
    '####.### # ###.####',
    'xxx#.#       #.#xxx',
    '####.# ##-## #.####',
    '    .  #DDD#  .    ',
    '####.# ##### #.####',
    'xxx#.#       #.#xxx',
    '####.# ##### #.####',
    '#........#........#',
    '#.##.###.#.###.##.#',
    '#o.#.....P.....#.o#',
    '##.#.#.#####.#.#.##',
    '#....#...#...#....#',
    '#.######.#.######.#',
    '#.................#',
    '###################',
  ],
  DIRS: [[0, -1], [-1, 0], [0, 1], [1, 0]], // вверх, влево, вниз, вправо: порядок решает ничьи, как в оригинале
  // волки: цвет = характер. corner — угол разбега (за краем поля), slot — место в дольмене
  WOLVES: [
    { name: 'Вожак', rule: 'гонится', color: '#e0483c', eye: '#ff5a4a', corner: [17, -3], slot: [9, 9] },
    { name: 'Хитрец', rule: 'заходит наперерез', color: '#e98fd0', eye: '#ff8ae6', corner: [1, -3], slot: [9, 9] },
    { name: 'Ловчий', rule: 'срезает по напарнику', color: '#5fd0e0', eye: '#5ff0ff', corner: [18, 22], slot: [8, 9] },
    { name: 'Трус', rule: 'пугается вблизи', color: '#f2a23a', eye: '#ffb84a', corner: [0, 22], slot: [10, 9] },
  ],
  EXIT: [9, 7], // клетка над дверью дольмена
  CHEESE: [9, 11],

  // ---------- новая партия ----------
  start(lab, scene) {
    const st = lab.state;
    st.W = this.MAP[0].length; st.H = this.MAP.length;
    st.night = 1; st.combo = 0; st.eaten = 0; st.chased = 0; st.pincers = 0; st.tails = 0; st.ambush = 0;
    st.checkT = 0; st.pinCool = 0; st.tailT = 0; st.tailCool = 0; st.freeze = 0; st.cheese = null;
    this.scenery(lab, scene);
    this.buildMaze(lab, scene);
    this.buildHero(lab, scene);
    this.buildWolves(lab, scene);
    this.fillDots(lab, scene);
    this.resetActors(lab);
    lab.hud('night', 'Ночь 1');
  },

  // ---------- каждый кадр ----------
  update(lab, dt) {
    const st = lab.state, cfg = lab.cfg;
    this.animate(lab, dt);
    if (st.freeze > 0) { st.freeze -= dt; return; }
    this.modes(lab, dt);
    this.moveHero(lab, dt);
    this.releaseWolves(lab, dt);
    st.wolves.forEach(w => this.moveWolf(lab, w, dt));
    this.collide(lab);
    this.watchDynamics(lab, dt);
    this.updateCheese(lab, dt);
    lab.hud('left', 'Светлячков: ' + st.dotsLeft);
    lab.hud('mode', st.fright > 0 ? `Волки бегут от факела: ${Math.ceil(st.fright)} с` : Math.round(cfg.secret) ? (st.mode === 'scatter' ? 'Волки: разбег по углам' : 'Волки: погоня') : 'Волки: погоня без отдыха');
  },

  overNote(lab) {
    const st = lab.state, notes = [];
    notes.push(Math.round(lab.cfg.secret) ? 'Механика: у четырёх волков по одному правилу — гонится, наперерез, по напарнику, пугается вблизи' : 'Секрет выключен: все волки гнались одинаково. Заметил, что они ходят хвостом?');
    notes.push(`Динамика: тебя окружали с разных сторон ${st.pincers} раз, волки шли за тобой хвостом ${st.tails} раз`);
    notes.push(`Ты подманил волков к факелу ${st.ambush} раз и прогнал ${st.chased} волков`);
    notes.push(`Светлячков: ${st.eaten}, ночь ${st.night}`);
    return notes;
  },

  // ---------- клетки ----------
  wrap(lab, x) { const W = lab.state.W; return ((x % W) + W) % W; },
  cell(lab, x, y) { return y < 0 || y >= lab.state.H ? '#' : this.MAP[y][this.wrap(lab, x)]; },
  open(lab, x, y) { const c = this.cell(lab, x, y); return c !== '#' && c !== 'D' && c !== '-' && c !== 'x'; },
  wx(lab, x) { return (x - (lab.state.W - 1) / 2) * this.S; },
  wz(lab, y) { return ((lab.state.H - 1) / 2 - y) * this.S; },
  posOf(a) { return [a.tx + a.dx * a.t, a.ty + a.dy * a.t]; },
  place(lab, a, y) {
    const [x, z] = this.posOf(a);
    a.mesh.position.set(this.wx(lab, x), y, this.wz(lab, z));
    if (a.dx || a.dy) { // поворот головой по ходу, по кратчайшей дуге
      const want = Math.atan2(a.dx, -a.dy);
      let d = want - a.mesh.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
      a.mesh.rotation.y += d * Math.min(1, lab.dt * 14);
    }
  },
  // движение по клеткам: t — путь от центра клетки (tx, ty) к соседней по направлению (dx, dy); в центре клетки решает decide
  move(lab, a, dist, decide) {
    for (let g = 0; g < 6 && dist > 0; g++) {
      if (!a.dx && !a.dy) { decide(a); if (!a.dx && !a.dy) return; }
      const left = 1 - a.t;
      if (dist < left) { a.t += dist; return; }
      dist -= left; a.tx = this.wrap(lab, a.tx + a.dx); a.ty += a.dy; a.t = 0;
      decide(a);
    }
  },
  reverse(lab, a) { if (a.t > 0) { a.tx = this.wrap(lab, a.tx + a.dx); a.ty += a.dy; a.t = 1 - a.t; } a.dx = -a.dx; a.dy = -a.dy; },
  near(lab, a, b) { const [ax, ay] = this.posOf(a), [bx, by] = this.posOf(b); let dx = Math.abs(ax - bx); dx = Math.min(dx, lab.state.W - dx); return Math.hypot(dx, ay - by); },

  // ---------- пастушок: поворот заранее, разворот на месте ----------
  moveHero(lab, dt) {
    const st = lab.state, h = st.hero, p = lab.p1;
    if (Math.abs(p.x) > 0.3 || Math.abs(p.y) > 0.3) st.want = Math.abs(p.x) > Math.abs(p.y) ? [Math.sign(p.x), 0] : [0, -Math.sign(p.y)];
    const w = st.want;
    if (w && w[0] === -h.dx && w[1] === -h.dy && (h.dx || h.dy)) this.reverse(lab, h);
    const mul = 1 + lab.cfg.nightUp * (st.night - 1) * 0.5;
    this.move(lab, h, lab.cfg.heroSpeed * mul * dt, a => {
      if (w && this.open(lab, a.tx + w[0], a.ty + w[1])) { a.dx = w[0]; a.dy = w[1]; }
      else if (!this.open(lab, a.tx + a.dx, a.ty + a.dy)) { a.dx = 0; a.dy = 0; }
      if (a.t === 0) this.eat(lab, a.tx, a.ty);
    });
    this.place(lab, h, (h.dx || h.dy) ? Math.abs(Math.sin(lab.t * 14)) * 0.08 : 0);
    lab.stat('светлячков собрано', st.eaten);
  },
  eat(lab, x, y) {
    const st = lab.state, key = x + ',' + y, d = st.dots[key];
    if (!d) return;
    delete st.dots[key]; d.mesh.dispose(); st.dotsLeft--;
    if (d.torch) {
      lab.addScore(50, d.mesh.position, '#ffb347'); lab.sfx.power(); lab.flash('#ff9a3c', 0.25); lab.count('факелы');
      lab.burst(d.mesh.position, { count: 30, colors: ['#ffd23f', '#ff7a2a', '#fff3a0'], speed: 6, up: 4 });
      if (st.wolves.some(wf => wf.state === 'active' && this.near(lab, wf, st.hero) < 4.5)) { st.ambush++; lab.count('засада у факела'); }
      st.fright = lab.cfg.powerTime * Math.pow(0.88, st.night - 1); st.combo = 0;
      st.wolves.forEach(wf => { if (wf.state === 'active') { wf.fr = true; this.reverse(lab, wf); } });
    } else {
      st.eaten++; lab.addScore(10); lab.count('светлячки');
      lab.tone(st.eaten % 2 ? 520 : 410, 0.06, 'triangle', 0.05);
      if (st.eaten % 70 === 0 && !st.cheese) this.spawnCheese(lab);
    }
    if (st.dotsLeft === 0) this.nextNight(lab);
  },
  nextNight(lab) {
    const st = lab.state;
    st.night++; lab.addScore(500, st.hero.mesh.position, '#7cf5a8');
    lab.sfx.win(); lab.flash('#d8ff6a', 0.3); lab.count('ночи');
    lab.popup(lab.v3(0, 3, 0), 'Ночь ' + st.night, '#d8ff6a', 30);
    this.fillDots(lab, lab.scene); this.resetActors(lab);
    lab.hud('night', 'Ночь ' + st.night);
  },

  // ---------- режимы: разбег и погоня сменяют друг друга; факел их останавливает ----------
  modes(lab, dt) {
    const st = lab.state, cfg = lab.cfg;
    if (st.fright > 0) {
      st.fright -= dt;
      const warn = st.fright < cfg.warnTime && Math.floor(st.fright * 6) % 2 === 0; // честно: факел гаснет — волки мигают белым
      st.frMat.diffuseColor = lab.color(warn ? '#ffffff' : '#3d5bff');
      st.frMat.emissiveColor = lab.color(warn ? '#9aa6ff' : '#1a2a99');
      if (st.fright <= 0) st.wolves.forEach(w => { w.fr = false; });
      return;
    }
    if (!Math.round(cfg.secret)) { st.mode = 'chase'; return; }
    st.modeT -= dt;
    if (st.modeT > 0) return;
    const plan = [cfg.scatterTime, cfg.chaseTime, cfg.scatterTime, cfg.chaseTime, cfg.scatterTime * 0.7, 1e9];
    st.phase = Math.min(st.phase + 1, plan.length - 1);
    st.mode = st.phase % 2 ? 'chase' : 'scatter'; st.modeT = plan[st.phase];
    if (st.mode === 'scatter') lab.count('разбеги');
    st.wolves.forEach(w => { if (w.state === 'active' && !w.human) this.reverse(lab, w); }); // смена режима видна: все волки разворачиваются
    lab.tone(st.mode === 'chase' ? 260 : 520, 0.5, 'sine', 0.05, st.mode === 'chase' ? 420 : 300);
  },

  // ---------- волки ----------
  target(lab, w) {
    const st = lab.state, cfg = lab.cfg, h = st.hero, hd = [h.dx || (st.want || [0, 0])[0], h.dy || (st.want || [0, 0])[1]];
    if (w.state === 'eyes') return this.EXIT;
    if (!Math.round(cfg.secret)) return [h.tx, h.ty];
    if (st.mode === 'scatter') return w.def.corner;
    if (w.i === 1) return [h.tx + hd[0] * cfg.ahead, h.ty + hd[1] * cfg.ahead];
    if (w.i === 2) {
      const red = st.wolves[0];
      if (!red || red.state !== 'active') return [h.tx, h.ty];
      const px = h.tx + hd[0] * 2, py = h.ty + hd[1] * 2;
      return [px * 2 - red.tx, py * 2 - red.ty];
    }
    if (w.i === 3 && this.near(lab, w, h) < cfg.shyRadius) return w.def.corner;
    return [h.tx, h.ty];
  },
  choose(lab, w, tgt) {
    const back = [-w.dx, -w.dy];
    let opts = this.DIRS.filter(d => this.open(lab, w.tx + d[0], w.ty + d[1]) && !(d[0] === back[0] && d[1] === back[1]));
    if (!opts.length) opts = [back];
    if (w.fr && w.state === 'active') return lab.pick(opts);
    let best = opts[0], bd = 1e9;
    for (const d of opts) {
      const dist = (w.tx + d[0] - tgt[0]) ** 2 + (w.ty + d[1] - tgt[1]) ** 2;
      if (dist < bd) { bd = dist; best = d; }
    }
    return best;
  },
  moveWolf(lab, w, dt) {
    const st = lab.state, cfg = lab.cfg;
    if (w.state === 'home') { w.mesh.position.y = 0.15 + Math.abs(Math.sin(lab.t * 4 + w.i)) * 0.25; this.skin(w); return; }
    if (w.state === 'exit' || w.state === 'enter') {
      w.k = Math.min(1, w.k + dt * 1.6);
      const [ax, ay] = w.state === 'exit' ? w.def.slot : this.EXIT, [bx, by] = w.state === 'exit' ? this.EXIT : w.def.slot;
      w.mesh.position.set(this.wx(lab, lab.lerp(ax, bx, w.k)), 0, this.wz(lab, lab.lerp(ay, by, w.k)));
      if (w.k >= 1) {
        if (w.state === 'exit') { w.state = 'active'; w.tx = this.EXIT[0]; w.ty = this.EXIT[1]; w.t = 0; w.dx = -1; w.dy = 0; }
        else { w.state = 'home'; w.homeT = 1.5; w.fr = false; }
      }
      this.skin(w); return;
    }
    const mul = 1 + cfg.nightUp * (st.night - 1);
    const speed = w.state === 'eyes' ? cfg.wolfSpeed * 2.2 : w.fr ? cfg.frightSpeed : cfg.wolfSpeed * mul;
    const p2 = lab.p2;
    if (w.human && w.state === 'active') { // второй игрок ведёт Вожака
      if (Math.abs(p2.x) > 0.3 || Math.abs(p2.y) > 0.3) w.want = Math.abs(p2.x) > Math.abs(p2.y) ? [Math.sign(p2.x), 0] : [0, -Math.sign(p2.y)];
      if (w.want && w.want[0] === -w.dx && w.want[1] === -w.dy) this.reverse(lab, w);
    }
    this.move(lab, w, speed * dt, a => {
      if (a.state === 'enter') { a.dx = 0; a.dy = 0; return; }
      if (a.state === 'eyes' && a.tx === this.EXIT[0] && a.ty === this.EXIT[1]) { a.state = 'enter'; a.k = 0; a.dx = 0; a.dy = 0; return; }
      if (a.human && a.state === 'active' && a.want && this.open(lab, a.tx + a.want[0], a.ty + a.want[1])) { a.dx = a.want[0]; a.dy = a.want[1]; return; }
      if (a.human && a.state === 'active' && this.open(lab, a.tx + a.dx, a.ty + a.dy)) return;
      const tgt = this.target(lab, a), d = this.choose(lab, a, tgt);
      // секрет сработал: характер повёл волка не туда, куда ведёт простая погоня (скрытый счётчик для урока)
      if (Math.round(cfg.secret) && a.state === 'active' && !a.fr && !a.human) {
        const plain = this.choose(lab, a, [st.hero.tx, st.hero.ty]);
        if (plain[0] !== d[0] || plain[1] !== d[1]) lab.count('_secret');
      }
      a.dx = d[0]; a.dy = d[1];
    });
    if (w.state === 'enter') return;
    this.place(lab, w, 0);
    this.skin(w);
    const tg = st.marks[w.i];
    if (tg) {
      const on = !!Math.round(cfg.showTargets) && w.state === 'active' && !w.fr;
      tg.setEnabled(on);
      if (on) { const t = this.target(lab, w); tg.position.set(this.wx(lab, t[0]), 0.06, this.wz(lab, t[1])); }
    }
  },
  // какой меш волка виден: свой цвет, синий «бегу от факела» или одни глаза по дороге в дольмен
  skin(w) {
    const eyes = w.state === 'eyes' || w.state === 'enter';
    w.body.setEnabled(!eyes && !w.fr); w.scared.setEnabled(!eyes && !!w.fr); w.eyes.setEnabled(eyes);
  },
  releaseWolves(lab, dt) {
    const st = lab.state;
    st.relT += dt;
    st.wolves.forEach(w => {
      if (w.state !== 'home') return;
      w.homeT -= dt;
      if (w.homeT <= 0) { w.state = 'exit'; w.k = 0; lab.tone(330, 0.2, 'sine', 0.04, 220); }
    });
    // честно: дверь дольмена светится цветом волка, который выйдет следующим
    const next = st.wolves.filter(w => w.state === 'home').sort((a, b) => a.homeT - b.homeT)[0];
    const glow = next && next.homeT < 1.2 && Math.floor(lab.t * 8) % 2 === 0;
    st.doorMat.emissiveColor = lab.color(glow ? next.def.eye : '#2a2018');
  },
  collide(lab) {
    const st = lab.state;
    for (const w of st.wolves) {
      if (w.state !== 'active' || this.near(lab, w, st.hero) > 0.62) continue;
      if (w.fr) {
        st.combo++; st.chased++; lab.count('прогнал волков');
        const pts = 200 * Math.pow(2, Math.min(st.combo, 4) - 1);
        lab.addScore(pts, w.mesh.position, w.def.eye); lab.hitstop(0.06); lab.shake(0.25);
        lab.burst(w.mesh.position, { count: 20, colors: [w.def.color, '#ffffff', '#3d5bff'], speed: 6 });
        lab.tone(300, 0.25, 'square', 0.05, 1200);
        w.state = 'eyes'; w.fr = false;
      } else if (lab.hurt(st.hero.mesh.position, 'Волки поймали пастушка')) {
        lab.count('поймали');
        if (lab.lives > 0) { st.freeze = 1; this.resetActors(lab); lab.popup(lab.v3(0, 3, -4), 'Ещё попытка!', '#ffd23f', 24); }
        return;
      }
    }
  },

  // ---------- телеметрия динамики: что делают игроки и волки вместе ----------
  // окружение — волки близко с двух противоположных сторон и идут на тебя; хвост — волки сбились в стаю и идут друг за другом
  watchDynamics(lab, dt) {
    const st = lab.state, h = st.hero;
    st.pinCool -= dt; st.tailCool -= dt; st.checkT -= dt;
    if (st.checkT > 0) return;
    st.checkT = 0.25;
    const [hx, hy] = this.posOf(h), sides = new Set(), act = st.wolves.filter(w => w.state === 'active' && !w.fr);
    for (const w of act) {
      if (this.near(lab, w, h) > 6) continue;
      const [x, y] = this.posOf(w), dx = x - hx, dy = y - hy;
      if (Math.sign(-dx) * w.dx + Math.sign(-dy) * w.dy <= 0) continue; // идёт не к тебе
      sides.add(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : (dy > 0 ? 'S' : 'N'));
    }
    const pincer = (sides.has('E') && sides.has('W')) || (sides.has('N') && sides.has('S')) || sides.size >= 3;
    if (pincer && st.pinCool <= 0) { st.pincers++; st.pinCool = 3; lab.count('окружения'); }
    const pack = act.some((a, i) => act.some((b, j) => j > i && this.near(lab, a, b) < 2.2));
    st.tailT = pack ? st.tailT + 0.25 : 0;
    if (st.tailT >= 1.5 && st.tailCool <= 0) { st.tails++; st.tailCool = 4; st.tailT = 0; lab.count('хвост'); }
  },

  // ---------- сыр-бонус под дольменом ----------
  spawnCheese(lab) {
    const st = lab.state, m = st.cheeseSrc.createInstance('сыр');
    m.position.set(this.wx(lab, this.CHEESE[0]), 0.35, this.wz(lab, this.CHEESE[1]));
    st.cheese = { mesh: m, t: 9 }; lab.tone(660, 0.3, 'sine', 0.05, 990);
  },
  updateCheese(lab, dt) {
    const st = lab.state, c = st.cheese;
    if (!c) return;
    c.t -= dt; c.mesh.rotation.y += dt * 2;
    c.mesh.isVisible = c.t > 2 || Math.floor(c.t * 6) % 2 === 0;
    const h = st.hero;
    if (h.tx === this.CHEESE[0] && h.ty === this.CHEESE[1]) {
      lab.addScore(300 * st.night, c.mesh.position, '#fff3a0'); lab.sfx.coin(); lab.count('сыр');
      lab.burst(c.mesh.position, { count: 16, colors: ['#fff3c4', '#ffd23f'], speed: 5 });
      c.mesh.dispose(); st.cheese = null;
    } else if (c.t <= 0) { c.mesh.dispose(); st.cheese = null; }
  },

  // ---------- расстановка: пастушок внизу, Вожак у двери, остальные в дольмене ----------
  resetActors(lab) {
    const st = lab.state, cfg = lab.cfg;
    const h = st.hero;
    Object.assign(h, { tx: st.start[0], ty: st.start[1], t: 0, dx: -1, dy: 0 }); st.want = null;
    h.mesh.rotation.y = -Math.PI / 2; this.place(lab, h, 0);
    st.fright = 0; st.mode = Math.round(cfg.secret) && cfg.scatterTime > 0 ? 'scatter' : 'chase'; st.phase = st.mode === 'scatter' ? 0 : 1;
    st.modeT = st.mode === 'scatter' ? cfg.scatterTime : cfg.chaseTime; st.relT = 0;
    st.wolves.forEach((w, i) => {
      Object.assign(w, { fr: false, t: 0, dx: -1, dy: 0, k: 0, want: null });
      if (i === 0) { w.state = 'active'; w.tx = this.EXIT[0]; w.ty = this.EXIT[1]; this.place(lab, w, 0); }
      else { w.state = 'home'; w.homeT = cfg.release * i; w.mesh.position.set(this.wx(lab, w.def.slot[0]), 0.15, this.wz(lab, w.def.slot[1])); w.mesh.rotation.y = Math.PI; }
      this.skin(w);
    });
  },

  // ---------- лабиринт: стены пролётами, светлячки и факелы ----------
  buildMaze(lab, scene) {
    const B = BABYLON, st = lab.state, S = this.S;
    lab.floor({ type: 'брусчатка', w: st.W * S, h: st.H * S, colors: { камень: '#2a3548' } });
    // стена — каменная кладка с мхом поверху; соседние клетки «#» в строке собраны в один пролёт, все пролёты — в один меш
    const stone = [], moss = [];
    this.MAP.forEach((row, y) => {
      for (let x = 0; x < row.length;) {
        if (row[x] !== '#') { x++; continue; }
        let e = x; while (e < row.length && row[e] === '#') e++;
        const len = e - x, cx = this.wx(lab, x + (len - 1) / 2), cz = this.wz(lab, y);
        const b = B.MeshBuilder.CreateBox('кладка', { width: len * S - 0.12, height: 0.9, depth: S - 0.12 }, scene);
        b.position.set(cx, 0.45, cz); stone.push(b);
        const m = B.MeshBuilder.CreateBox('мох', { width: len * S - 0.3, height: 0.14, depth: S - 0.3 }, scene);
        m.position.set(cx, 0.96, cz); moss.push(m);
        x = e;
      }
    });
    const walls = B.Mesh.MergeMeshes(stone, true, true); walls.material = lab.mat('#77738a');
    const tops = B.Mesh.MergeMeshes(moss, true, true); tops.material = lab.mat('#357a46');
    // дольмен — логово волков: низкие каменные плиты вокруг, лаз спереди и наклонная плита-крыша сзади; волков внутри видно
    const dx = this.wx(lab, 9), dz = this.wz(lab, 9), G = '#a39780';
    lab.build('дольмен', [['box', [4.1, 0.75, 0.22], [0, 0.37, -0.7], 0, G], ['box', [0.22, 0.75, 1.6], [-2.0, 0.37, 0], 0, G], ['box', [0.22, 0.75, 1.6], [2.0, 0.37, 0], 0, G],
      ['box', [1.45, 0.75, 0.22], [-1.32, 0.37, 0.7], 0, G], ['box', [1.45, 0.75, 0.22], [1.32, 0.37, 0.7], 0, G], ['box', [2.4, 0.2, 1.2], [-1.0, 1.15, -1.05], [0, 0, 0.12], G],
      ['ico', [0.5, 0.3, 0.4], [1.6, 0.9, -0.7], 0, 'мох', { d: 1 }]], { shape: 'как есть' }).copy([dx, 0, dz]);
    const door = B.MeshBuilder.CreateBox('лаз', { width: 1.1, height: 0.12, depth: 0.24 }, scene);
    door.position.set(dx, 0.7, dz + 0.7);
    st.doorMat = lab.mat('#2a2018').clone('дверь'); door.material = st.doorMat;
    [walls, tops].forEach(m => m.freezeWorldMatrix());
    // на мху поверх стен — кусты, камни и цветы: копии трёх исходников
    const deco = [lab.prop('куст', { h: 0.6 }), lab.prop('куст', { v: 1, h: 0.45 }), lab.prop('валун', { h: 0.35 })];
    this.MAP.forEach((row, y) => row.split('').forEach((c, x) => {
      if (c !== '#' || !lab.chance(0.3)) return;
      lab.pick(deco).copy([this.wx(lab, x) + lab.rand(-0.3, 0.3), 0.98, this.wz(lab, y) + lab.rand(-0.3, 0.3)], lab.rand(0, 3), [1, lab.rand(0.6, 1), 1]);
    }));
    // исходники светлячка и факела — дальше только копии
    st.dotSrc = B.MeshBuilder.CreateSphere('светлячок', { diameter: 0.24, segments: 3 }, scene);
    st.dotMat = lab.mat('#d8ff6a', { glow: 1 }).clone('светлячки'); st.dotSrc.material = st.dotMat; st.dotSrc.isVisible = false; lab.noShadow(st.dotSrc);
    st.torchSrc = lab.build('факел', [['cyl', [0.16, 0.9, 0.16], [0, 0.45, 0], 0, '#6b4a2e', { top: 0.62 }], ['cyl', [0.42, 0.18, 0.42], [0, 0.95, 0], 0, '#3a3a44', { top: 1, taper: 0.5 }],
      ['cone', [0.36, 0.55, 0.36], [0, 1.3, 0], 0, '#ff9a3c', { glow: 1 }]], { shape: 'как есть' }).mesh;
    // сыр — круг адыгейского сыра
    const ch = B.MeshBuilder.CreateCylinder('сыр', { height: 0.3, diameter: 0.8, tessellation: 10 }, scene);
    ch.material = lab.mat('#fff1c8', { glow: 0.25 }); ch.isVisible = false; st.cheeseSrc = ch;
    this.MAP.forEach((row, y) => { const x = row.indexOf('P'); if (x >= 0) st.start = [x, y]; });
  },
  fillDots(lab) {
    const st = lab.state;
    Object.values(st.dots || {}).forEach(d => d.mesh.dispose());
    st.dots = {}; st.dotsLeft = 0;
    this.MAP.forEach((row, y) => row.split('').forEach((c, x) => {
      if (c !== '.' && c !== 'o') return;
      const torch = c === 'o', mesh = (torch ? st.torchSrc : st.dotSrc).createInstance(torch ? 'факел' : 'светлячок');
      mesh.position.set(this.wx(lab, x), torch ? 0 : 0.45, this.wz(lab, y)); if (torch) mesh.scaling.setAll(1.35);
      st.dots[x + ',' + y] = { mesh, torch }; st.dotsLeft++;
    }));
  },

  // ---------- герои ----------
  part(list, mesh, color, lab, o) { mesh.material = lab.mat(color, o); list.push(mesh); return mesh; },
  buildHero(lab, scene) {
    const st = lab.state;
    const c = lab.creature({ plan: 'двуногий', size: 2.4, role: 'герой', colors: { main: '#f1c9a0', belly: '#f1c9a0', second: '#2b2230', detail: '#8a2f35', accent: '#e8c15a' },
      wear: ['папаха', 'черкеска'], holds: 'фонарь', eyes: { look: 'круглые' }, face: { cheeks: true } });
    c.autoFace = false; // поворачивает place по клеткам
    const light = new BABYLON.PointLight('свет фонаря', new BABYLON.Vector3(0.3, 1.2, 0.6), scene);
    light.diffuse = lab.color('#ffcf7a'); light.intensity = 0.9; light.range = 6; light.parent = c.root;
    st.hero = { c, mesh: c.root, light, tx: 0, ty: 0, t: 0, dx: 0, dy: 0 };
    lab.hero(c.root);
  },
  wolfMesh(lab, scene, color, eye, name) {
    const B = BABYLON, P = [];
    const add = (m, c, o) => this.part(P, m, c, lab, o);
    add(B.MeshBuilder.CreateBox('тело', { width: 0.44, height: 0.42, depth: 0.86 }, scene), color).position.y = 0.55;
    const head = add(B.MeshBuilder.CreateBox('голова', { width: 0.38, height: 0.36, depth: 0.36 }, scene), color);
    head.position.set(0, 0.78, 0.5);
    add(B.MeshBuilder.CreateBox('морда', { width: 0.2, height: 0.16, depth: 0.24 }, scene), color).position.set(0, 0.7, 0.75);
    add(B.MeshBuilder.CreateBox('нос', { width: 0.08, height: 0.07, depth: 0.06 }, scene), '#1a1a22').position.set(0, 0.75, 0.88);
    for (const x of [-0.12, 0.12]) {
      add(B.MeshBuilder.CreateCylinder('ухо', { height: 0.2, diameterTop: 0, diameterBottom: 0.14, tessellation: 4 }, scene), color).position.set(x, 1.03, 0.45);
      add(B.MeshBuilder.CreateBox('глаз', { width: 0.08, height: 0.07, depth: 0.04 }, scene), eye, { glow: 1 }).position.set(x * 0.9, 0.84, 0.69);
    }
    for (const x of [-0.14, 0.14]) for (const z of [-0.28, 0.28]) add(B.MeshBuilder.CreateBox('лапа', { width: 0.12, height: 0.36, depth: 0.12 }, scene), color).position.set(x, 0.18, z);
    const tail = add(B.MeshBuilder.CreateCylinder('хвост', { height: 0.5, diameterTop: 0.08, diameterBottom: 0.16, tessellation: 5 }, scene), color);
    tail.rotation.x = -0.9; tail.position.set(0, 0.68, -0.6);
    add(B.MeshBuilder.CreateBox('ошейник', { width: 0.46, height: 0.08, depth: 0.12 }, scene), eye, { glow: 0.6 }).position.set(0, 0.66, 0.3);
    P.forEach(m => m.convertToFlatShadedMesh());
    const mesh = B.Mesh.MergeMeshes(P, true, true, undefined, false, true);
    mesh.name = name; return mesh;
  },
  buildWolves(lab, scene) {
    const B = BABYLON, st = lab.state, n = Math.round(lab.cfg.wolves);
    // испуганный волк один на всех: материал копии меняет цвет, когда факел гаснет
    const scaredSrc = this.wolfMesh(lab, scene, '#3d5bff', '#ffffff', 'испуганный волк');
    st.frMat = new B.StandardMaterial('испуг', scene); st.frMat.diffuseColor = lab.color('#3d5bff'); st.frMat.emissiveColor = lab.color('#1a2a99');
    scaredSrc.material = st.frMat; scaredSrc.isVisible = false;
    const eP = [];
    for (const x of [-0.14, 0.14]) {
      this.part(eP, B.MeshBuilder.CreateSphere('глаз', { diameter: 0.2, segments: 4 }, scene), '#ffffff', lab, { glow: 0.6 }).position.set(x, 0.6, 0);
      this.part(eP, B.MeshBuilder.CreateBox('зрачок', { size: 0.09 }, scene), '#3d5bff', lab, { glow: 1 }).position.set(x, 0.6, 0.09);
    }
    const eyesSrc = B.Mesh.MergeMeshes(eP, true, true, undefined, false, true); eyesSrc.isVisible = false;
    st.wolves = []; st.marks = [];
    for (let i = 0; i < n; i++) {
      const def = this.WOLVES[i];
      const root = new B.TransformNode(def.name, scene); root.scaling.setAll(1.4);
      const wolf = lab.creature({ plan: 'четвероногий', size: 1.05, role: 'враг', colors: { main: def.color, belly: '#f4ece0', eye: def.eye, accent: def.eye },
        build: { legs: 'длинные' }, parts: ['уши', 'хвост:пушистый'], eyes: { look: def.rule === 'пугается вблизи' ? 'испуганные' : 'злые' } });
      wolf.autoFace = false; wolf.root.parent = root; const body = wolf.root;
      const scared = scaredSrc.createInstance('испуганный'); scared.parent = root;
      const eyes = eyesSrc.createInstance('глаза'); eyes.parent = root;
      st.wolves.push({ i, def, mesh: root, body, scared, eyes, human: i === 0 && Math.round(lab.cfg.vs) === 1, state: 'home', tx: 0, ty: 0, t: 0, dx: 0, dy: 0 });
      // крестик цели: куда идёт волк (ручка «Показать, куда целится»)
      const a = B.MeshBuilder.CreateBox('цель', { width: 0.9, height: 0.03, depth: 0.16 }, scene), b = a.clone('цель');
      a.rotation.y = Math.PI / 4; b.rotation.y = -Math.PI / 4;
      const mark = B.Mesh.MergeMeshes([a, b], true); mark.material = lab.mat(def.eye, { unlit: true, alpha: 0.85 }); lab.noShadow(mark); mark.setEnabled(false);
      st.marks.push(mark);
    }
    if (st.wolves[0] && st.wolves[0].human) lab.popup(lab.v3(0, 3, 6), 'Вожак — второй игрок', '#ff5a4a', 20);
  },

  // ---------- ночь вокруг: лес, горы, луна ----------
  scenery(lab, scene) {
    lab.style({ mood: 'ночь', shape: 'угловатый', detail: 'обычно', wear: 'старое', palette: { земля: '#16301f', листва: '#175236', камень: '#77738a', мох: '#357a46', свет: '#d8ff6a' } });
    lab.backdrop({ type: 'горы', layers: 2 });
    lab.scatter([['ель', 4], ['валун', 1]], { n: 50, area: 'вокруг' });
    lab.ambient('светлячки', { n: 24 });
    // луна — свой ориентир: диск с кратерами и светлым ореолом
    lab.build('луна', [['sphere', [7, 7, 7], [0, 0, 0], 0, '#fff4d6', { unlit: true }], ['disc', [11, 0, 11], [0, 0, 1.5], [Math.PI / 2, 0, 0], '#fff4d6', { alpha: 0.12, unlit: true }],
      ['sphere', [1.4, 1.4, 0.6], [1.5, 1, -3.1], 0, '#e6dcc0', { unlit: true }], ['sphere', [1, 1, 0.5], [-1.8, -1.2, -3.1], 0, '#e6dcc0', { unlit: true }]], { shape: 'как есть', shadow: false }).copy([-30, 34, 70]);
  },
  animate(lab, dt) {
    const st = lab.state, t = lab.t;
    st.dotMat.emissiveColor = lab.color('#d8ff6a').scale(0.55 + 0.45 * Math.sin(t * 5)); // светлячки мерцают
  },
};
