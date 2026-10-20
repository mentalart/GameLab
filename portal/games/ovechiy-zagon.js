// «Овечий загон» — ремейк-донор урока 15 по мотивам Sokoban (Хироюки Имабаяси, 1982) и Baba Is You (2019), оболочка «Лаб3D 1.0» (three.js).
// План.
// Фраза: пастушок загоняет отару в загоны на плато Лаго-Наки; овцу можно только толкать, по одной, и не в угол — из угла не вытолкнешь.
// Ядро на 3 секунды: шаг стрелкой → овца сдвигается на клетку с «бее» и облачком шерсти → встала в загон — сено золотится, колокольчик.
// Выбор, оплаченный очками: решить уровень за пар (ходы автора уровня) — очки ×2; лишние ходы стоят очков.
// Угроза — тупик: овца в углу или у плетня, откуда не вытолкнуть. Тупик краснеет, «B — отменить ход».
// Кривая партии: уровни по темпу «короткий — длинный — короткий»: 3 хода, 18, 7, 28, 10, 32. После длинного — передышка.
// Уровни — данные: каждый уровень — карта символами Sokoban (# плетень, @ пастух, $ овца, . загон, * овца в загоне, + пастух на загоне);
// игра берёт свои уровни и уровни гостей через lab.levels, а редактор портала строит уровни теми же символами.
// Вариации (Tab, ручка rules): лёд (_), тянуть овцу (B), норы (O — овца засыпает нору), слова-правила как в Baba Is You (P = S — «ПЛЕТЕНЬ ЕСТЬ СТОП»), лимит ходов.
// Спрятанная механика донора — честная головоломка: отмена хода, подсказка тупика и темп уровней (ручка secret 0 — без отмены, без подсказки,
// длинные уровни первыми). Разбор игр жанра — docs/01_Журнал_курса.md, раздел урока 15.
// Лицо игры: тёплое утро на плато, белые пушистые овцы на сочной траве, плетни из лозы; приёмы — шерстяные облачка от каждого толчка,
// золотое сено в занятом загоне, кружок-тупик красным. Палитра: трава #5fa83a/#6cbd45, плетень #8a6a44, овца #fffaf0, загон #ffd23f, пастух #2b2d42 и #e63946.
// Вид сверху под углом: клетка — 2 м, X — вправо, Z — вниз по карте (строки), Y — вверх.
const GAME = {
  engine: 'three',
  title: 'Овечий загон',
  subtitle: 'Загони отару в загоны: овцу можно только толкать и только по одной. Уложишься в пар?',
  donor: 'Sokoban и Baba Is You',
  players: 1,
  pace: 'turns',
  controls: [
    { input: 'move4', text: 'шаг и толчок' },
    { input: 'b', text: 'отменить ход (в «Тянуть» — держи, чтобы тянуть)' },
    { input: 'a', text: 'уровень заново' },
  ],
  camera: { type: 'iso', tilt: 0.62 },
  field: { w: 18, h: 14 },
  sky: ['#7fc4ff', '#fff1d6'],
  fog: 0.006,
  accent: '#ffd23f',
  scoreColor: '#ffd23f',
  lives: 0,
  decisions: [
    'Чувство: «ага!» — когда видишь, в каком порядке толкать',
    'Честность: тупик краснеет сразу, и любой ход можно отменить',
    'Выбор: короткий путь или надёжный — уложиться в пар или не рисковать',
  ],
  config: {
    rules: { value: 0, min: 0, max: 5, step: 1, label: 'Правила (вариация)', restart: true, names: ['классика', 'лёд', 'тянуть', 'норы', 'слова-правила', 'лимит ходов'] },
    secret: { value: 1, min: 0, max: 1, step: 1, label: 'Спрятанная механика: честная головоломка', restart: true, hint: '0 — без отмены хода, без подсказки тупика, длинные уровни первыми' },
    undo: { value: 1, min: 0, max: 1, step: 1, label: 'Отмена хода (B)', names: ['нет', 'есть'] },
    hint: { value: 1, min: 0, max: 1, step: 1, label: 'Подсказка тупика', names: ['нет', 'есть'] },
    limit: { value: 3, min: 0, max: 20, step: 1, label: 'Лимит ходов сверх пара (в «Лимите ходов»)' },
    step: { value: 0.16, min: 0.06, max: 0.4, step: 0.01, label: 'Шаг при удержании стрелки, с' },
    time: { value: 300, min: 60, max: 900, step: 30, label: 'Время на партию, с' },
  },
  presets: {
    'Новичок': { time: 600, step: 0.2 },
    'Без спрятанной механики': { secret: 0 },
    'Лёд': { rules: 1 },
    'Тянуть': { rules: 2 },
    'Норы': { rules: 3 },
    'Слова-правила': { rules: 4 },
    'Лимит ходов': { rules: 5 },
  },
  notes: [
    'R — уровень заново с начала партии; A — этот уровень заново.',
    'Пар — ходы, за которые уровень решил его автор: решил в пар — очки ×2.',
  ],
  LEGEND: { '#': 'плетень', '@': 'пастух', '$': 'овца', '.': 'загон', '*': 'овца в загоне', '+': 'пастух на загоне', ' ': 'трава', '_': 'лёд', 'O': 'нора', 'P': 'слово ПЛЕТЕНЬ', '=': 'слово ЕСТЬ', 'S': 'слово СТОП' },
  // уровни: [название, пар, карта]; пар посчитан перебором (минимум ходов) — tools в журнале урока 15
  SETS: {
    classic: [
      ['Первый толчок', 3, ['#######', '#@ $ .#', '#######']],
      ['Две овцы', 18, ['########', '#  .   #', '# $##$ #', '#   @  #', '##  ## #', ' #.    #', ' #######']],
      ['За угол', 7, ['######', '#@   #', '# $  #', '#    #', '#   .#', '######']],
      ['Плетни посередине', 28, ['#########', '#   #@  #', '#.   $# #', '# # #   #', '#$  .$  #', '#   .   #', '#########']],
      ['Два загона рядом', 10, ['########', '#@ $  .#', '# $  . #', '########']],
      ['Большая отара', 32, ['#########', '#. #  #@#', '#. .    #', '# $     #', '#$ # $# #', '#      ##', '#########']],
    ],
    ice: [
      ['Скользкий пруд', 3, ['#########', '#@ ____ #', '#  $___.#', '#########']],
      ['Лёд в два ряда', 6, ['#########', '#@  ___ #', '# $_____#', '#  ___ .#', '#########']],
      ['Каток с ямками', 5, ['  ######', '###____#', '#@ $___#', '#  _ _.#', '#______#', '########']],
    ],
    pull: [
      ['Овца в углу', 6, ['######', '#$   #', '#  . #', '#@   #', '######']],
      ['За плетнём', 19, ['#######', '#$    #', '#  #  #', '#@   .#', '#######']],
      ['Две в углах', 22, ['########', '#$    $#', '#  ##  #', '#.  @ .#', '########']],
    ],
    holes: [
      ['Мостик из овцы', 9, ['#########', '#@$ O   #', '# $ O $ #', '#   O  .#', '#########']],
      ['Сначала нора', 16, ['##########', '#@ $ $O .#', '#    #   #', '##########']],
    ],
    words: [
      ['Плетень есть стоп', 10, ['#########', '#  P   ##', '#  =  #.#', '#@ S $# #', '#     ###', '#########']],
      ['Сломай правило', 10, ['##########', '#   ##.###', '# $ #  # #', '#@P=S    #', '#   ######', '##########']],
    ],
  },
  CELL: 2,

  ownLevels(lab) {
    const c = lab.cfg, r = Math.round(c.rules), S = this.SETS;
    let list = r === 1 ? S.ice : r === 2 ? S.pull : r === 3 ? S.holes : r === 4 ? S.words : r === 5 ? [S.classic[4], S.classic[1], S.classic[3]] : S.classic;
    if (c.secret < 0.5 && (r === 0 || r === 5)) list = [5, 3, 1, 4, 2, 0].map(i => S.classic[i]); // без спрятанной механики: длинные первыми
    return list.map(([name, par, rows]) => ({ name, map: rows.join('\n'), par }));
  },

  start(lab, scene) {
    const st = lab.state, own = this.ownLevels(lab);
    Object.assign(st, { moves: 0, pushes: 0, undos: 0, deadT: 0, done: 0, solved: 0, repT: 0, held: null, anim: [], hist: [], warned: false });
    st.list = lab.levels(own.map(x => ({ name: x.name, map: x.map })), this.LEGEND).map(x => Object.assign(x, { par: (own.find(o => o.map === x.map) || {}).par || null }));
    st.rules = Math.round(lab.cfg.rules);
    this.world(lab);
    st.hero = this.buildShepherd(lab);
    lab.hero(st.hero.node);
    if (this.cur == null || this.cur >= st.list.length || this.listKey !== st.list.map(x => x.name).join('|')) this.cur = 0;
    this.listKey = st.list.map(x => x.name).join('|');
    this.load(lab, this.cur, true);
  },

  update(lab, dt) {
    const st = lab.state, c = lab.cfg, p = lab.p1;
    this.animate(lab, dt);
    if (st.done > 0) { st.done -= dt; if (st.done <= 0) this.next(lab); return; }
    if (st.fail > 0) { st.fail -= dt; if (st.fail <= 0) this.load(lab, st.li, false); return; }
    const canUndo = c.undo > 0 && c.secret > 0;
    if (p.pressed.a) { this.load(lab, st.li, false); lab.count('заново'); lab.tone(330, 0.12, 'triangle', 0.06, 220); return; }
    if (p.pressed.b && !(st.rules === 2)) { if (canUndo) this.undo(lab); else lab.popup(st.hero.node, 'Отмены нет', '#ff8a8a', 18); }
    // стрелки: шаг по нажатию, при удержании — повтор
    const dir = p.pressed.left ? [-1, 0] : p.pressed.right ? [1, 0] : p.pressed.up ? [0, -1] : p.pressed.down ? [0, 1] : null;
    if (dir) { st.held = dir; st.repT = 0.28; this.step(lab, dir); }
    else if (st.held) {
      const still = (st.held[0] < 0 && p.left) || (st.held[0] > 0 && p.right) || (st.held[1] < 0 && p.up) || (st.held[1] > 0 && p.down);
      if (!still) st.held = null; else if ((st.repT -= dt) <= 0) { st.repT = c.step; this.step(lab, st.held); }
    }
    if (st.rules === 2 && p.pressed.b && !p.left && !p.right && !p.up && !p.down) lab.popup(st.hero.node, 'Держи B и шагай от овцы', '#ffd23f', 16);
    if (lab.t > c.time) lab.gameOver(`Время вышло: решено уровней ${st.solved}`);
    const L = st.lv, parTxt = L.par != null ? ` · пар ${L.par}` : '';
    lab.hud('lvl', `Уровень ${st.li + 1} из ${st.list.length}: «${L.name}»` + (L.guest ? ` · гость ${L.guest}` : ''), { color: '#fff1a8', size: 18 });
    lab.hud('moves', `Ходы ${st.moves}${parTxt}` + (st.rules === 5 && L.par != null ? ` · можно до ${L.par + c.limit}` : '') + ` · ⏱ ${Math.max(0, Math.round(c.time - lab.t))} с`, { color: L.par != null && st.moves > L.par ? '#ffb547' : '#ffffff' });
    lab.hud('keys', canUndo ? (st.rules === 2 ? 'A — заново · держи B и шагай — тянуть' : 'B — отменить ход · A — заново') : 'Отмены нет · A — заново', { color: '#bfe9ff', size: 13 });
  },

  overNote(lab) {
    const st = lab.state, per = st.solved ? Math.round(st.movesAll / st.solved) : 0;
    lab.stat('ходов на уровень', per);
    lab.stat('уровней', st.solved);
    return [`Решено уровней ${st.solved} из ${st.list.length}`, `Ходов всего ${st.movesAll || 0}, отмен ${st.undos}, тупиков ${st.deadN || 0}`,
      lab.cfg.secret > 0 ? 'Темп уровней: короткий — длинный — короткий. Сравни с «Без спрятанной механики».' : 'Спрятанная механика выключена: ни отмены, ни подсказки тупика, длинные уровни первыми.'];
  },

  /* ---------- уровень из карты: клетки, овцы, загоны, слова ---------- */
  parse(map) {
    const rows = map.split('\n'), H = rows.length, W = Math.max(...rows.map(r => r.length)), g = { W, H, wall: new Set(), goal: new Set(), ice: new Set(), hole: new Set(), sheep: [], words: [], p: null, floor: new Set() };
    rows.forEach((r, y) => { for (let x = 0; x < W; x++) {
      const ch = r[x] || ' ', k = x + ',' + y;
      if (ch === '#') g.wall.add(k); else g.floor.add(k);
      if ('.*+'.includes(ch)) g.goal.add(k);
      if ('$*'.includes(ch)) g.sheep.push([x, y]);
      if ('@+'.includes(ch)) g.p = [x, y];
      if (ch === '_') g.ice.add(k);
      if (ch === 'O') g.hole.add(k);
      if ('P=S'.includes(ch)) g.words.push({ x, y, w: ch });
    } });
    // пастуха нет на карте гостя — первая свободная клетка
    if (!g.p) { for (const k of g.floor) { const [x, y] = k.split(',').map(Number); if (!g.sheep.some(s => s[0] === x && s[1] === y) && !g.hole.has(k)) { g.p = [x, y]; break; } } }
    return g;
  },
  load(lab, i, first) {
    const st = lab.state;
    st.li = i; this.cur = i;
    st.lv = st.list[i];
    st.g = this.parse(st.lv.map);
    st.moves = 0; st.hist = []; st.dead = new Set(); st.fail = 0; st.done = 0;
    this.build(lab);
    lab.level(i);
    if (!first) { lab.tone(392, 0.08, 'triangle', 0.06); lab.tone(523, 0.1, 'triangle', 0.06, 0, 0.07); }
    lab.popup([0, 3, 0], `${i + 1}. ${st.lv.name}`, '#fff1a8', 28);
  },
  next(lab) {
    const st = lab.state;
    if (st.li + 1 >= st.list.length) { this.cur = 0; lab.win(`Все загоны полны! Уровней ${st.solved}, ходов ${st.movesAll}`); return; }
    this.load(lab, st.li + 1, false);
  },
  rule(st) { // «ПЛЕТЕНЬ ЕСТЬ СТОП»: три слова подряд по горизонтали или вертикали
    const W = st.g.words; if (!W.length) return true;
    const at = (x, y) => (W.find(w => w.x === x && w.y === y) || {}).w;
    return W.some(w => w.w === 'P' && ((at(w.x + 1, w.y) === '=' && at(w.x + 2, w.y) === 'S') || (at(w.x, w.y + 1) === '=' && at(w.x, w.y + 2) === 'S')));
  },
  solid(st, x, y) {
    const g = st.g;
    if (x < 0 || y < 0 || x >= g.W || y >= g.H) return true;
    if (!g.wall.has(x + ',' + y)) return false;
    return x === 0 || y === 0 || x === g.W - 1 || y === g.H - 1 || this.rule(st); // по краю — всегда стена
  },
  sheepAt(st, x, y) { return st.g.sheep.findIndex(s => s[0] === x && s[1] === y); },
  wordAt(st, x, y) { return st.g.words.findIndex(w => w.x === x && w.y === y); },
  snap(st) { return { p: st.g.p.slice(), sheep: st.g.sheep.map(s => s.slice()), words: st.g.words.map(w => Object.assign({}, w)), hole: [...st.g.hole], moves: st.moves }; },

  /* ---------- ход: шаг, толчок, лёд, тянуть, нора, слова ---------- */
  step(lab, [dx, dy]) {
    const st = lab.state, g = st.g, c = lab.cfg;
    const [px, py] = g.p, nx = px + dx, ny = py + dy;
    st.hero.face = Math.atan2(dx, dy);
    if (this.solid(st, nx, ny) || g.hole.has(nx + ',' + ny)) { this.bump(lab, nx, ny); return; }
    const before = this.snap(st);
    const si = this.sheepAt(st, nx, ny), wi = this.wordAt(st, nx, ny);
    if (si >= 0 || wi >= 0) {
      let bx = nx + dx, by = ny + dy;
      if (this.solid(st, bx, by) || this.sheepAt(st, bx, by) >= 0 || this.wordAt(st, bx, by) >= 0) { this.bump(lab, bx, by); return; }
      if (si >= 0) {
        if (g.hole.has(bx + ',' + by)) { this.fillHole(lab, si, bx, by); }
        else {
          while (st.rules === 1 && g.ice.has(bx + ',' + by)) { const cx = bx + dx, cy = by + dy; if (this.solid(st, cx, cy) || this.sheepAt(st, cx, cy) >= 0 || this.wordAt(st, cx, cy) >= 0 || g.hole.has(cx + ',' + cy)) break; bx = cx; by = cy; }
          g.sheep[si] = [bx, by]; this.baa(lab, si, dx, dy);
        }
      } else { g.words[wi].x = bx; g.words[wi].y = by; this.wordMoved(lab, wi); }
      st.pushes++; lab.count('толчки');
    }
    let ex = nx, ey = ny;
    // тянуть: держишь B и шагаешь от овцы — она идёт следом
    if (st.rules === 2 && lab.p1.b && si < 0) { const bi = this.sheepAt(st, px - dx, py - dy); if (bi >= 0) { g.sheep[bi] = [px, py]; this.baa(lab, bi, dx, dy); lab.count('тянул'); } }
    if (st.rules === 1 && si < 0 && wi < 0) while (g.ice.has(ex + ',' + ey)) { const cx = ex + dx, cy = ey + dy; if (this.solid(st, cx, cy) || this.sheepAt(st, cx, cy) >= 0 || this.wordAt(st, cx, cy) >= 0 || g.hole.has(cx + ',' + cy)) break; ex = cx; ey = cy; }
    g.p = [ex, ey];
    st.hist.push(before); if (st.hist.length > 400) st.hist.shift();
    st.moves++; st.movesAll = (st.movesAll || 0) + 1; lab.count('ходы');
    lab.spot('where', ex, ey);
    lab.tone(180 + (st.moves % 4) * 20, 0.04, 'triangle', 0.03);
    st.hero.hop = 1;
    this.check(lab);
  },
  bump(lab, x, y) { lab.tone(110, 0.06, 'square', 0.04); lab.state.hero.bump = 1; },
  baa(lab, i, dx, dy) {
    const st = lab.state, s = st.sheepM[i], [x, y] = st.g.sheep[i], on = st.g.goal.has(x + ',' + y);
    lab.tone(on ? 520 : 300 + i * 30, 0.16, 'sawtooth', 0.035, on ? 640 : 250); // «бее»
    if (s) { s.hop = 1; lab.burst(this.at(x - dx * 0.5, y - dy * 0.5, 0.6), { count: 6, colors: ['#ffffff', '#f2ece0'], speed: 1.6, up: 0.6, size: 0.22, life: 0.5 }); }
  },
  fillHole(lab, si, x, y) {
    const st = lab.state, g = st.g, s = st.sheepM[si];
    g.hole.delete(x + ',' + y); g.sheep.splice(si, 1); st.sheepM.splice(si, 1);
    st.filled.push({ x, y }); lab.count('норы');
    if (s) { s.target = this.at(x, y, -1.2); s.sink = true; }
    lab.tone(200, 0.3, 'sine', 0.08, 90); lab.noise(0.2, 0.05, 600);
    lab.burst(this.at(x, y, 0.4), { count: 14, colors: ['#ffffff', '#a07a4a'], speed: 2.5, up: 1.5 });
    lab.popup(this.at(x, y, 1.5), 'Мостик!', '#ffd23f', 18);
    this.placeHoles(lab);
  },
  wordMoved(lab, i) {
    const st = lab.state, was = st.ruleOn, now = this.rule(st);
    st.ruleOn = now;
    if (was !== now) {
      lab.tone(now ? 220 : 660, 0.25, 'triangle', 0.08, now ? 160 : 990); lab.shake(0.12);
      lab.popup([0, 4, 0], now ? 'ПЛЕТЕНЬ ЕСТЬ СТОП' : 'Правило сломано: плетень пропускает!', now ? '#ff8a8a' : '#7cf5a8', 22);
      if (!now) lab.count('правила'); else lab.count('_secret', 0);
      this.fenceLook(lab);
    }
  },
  undo(lab) {
    const st = lab.state, h = st.hist.pop();
    if (!h) { lab.tone(120, 0.05, 'square', 0.03); return; }
    const wasDead = st.dead.size > 0;
    const holes = new Set(h.hole), refill = st.filled.filter(f => holes.has(f.x + ',' + f.y));
    Object.assign(st.g, { p: h.p, sheep: h.sheep, words: h.words, hole: holes }); st.moves = h.moves;
    if (refill.length || st.sheepM.length !== st.g.sheep.length) { st.filled = st.filled.filter(f => !holes.has(f.x + ',' + f.y)); this.build(lab, true); }
    st.undos++; lab.count('отмены');
    if (wasDead) lab.count('_secret'); // отмена спасла из тупика: игра честная, ошибка ничего не стоит
    lab.tone(440, 0.08, 'triangle', 0.05, 330);
    this.check(lab, true);
  },
  // тупик — овца не в загоне и в углу (две стены под прямым углом); загон полон — уровень решён
  check(lab, quiet) {
    const st = lab.state, g = st.g, c = lab.cfg, hint = c.hint > 0 && c.secret > 0;
    const dead = new Set();
    g.sheep.forEach(([x, y], i) => {
      if (g.goal.has(x + ',' + y)) return;
      const s = (a, b) => this.solid(st, a, b);
      if ((s(x - 1, y) || s(x + 1, y)) && (s(x, y - 1) || s(x, y + 1))) dead.add(i);
    });
    const fresh = [...dead].filter(i => !st.dead.has(i));
    st.dead = dead;
    if (fresh.length && !quiet) {
      st.deadN = (st.deadN || 0) + 1; lab.count('тупики');
      const [x, y] = g.sheep[fresh[0]]; lab.spot('death', x, y);
      if (hint) { lab.tone(196, 0.3, 'sawtooth', 0.05, 150); lab.popup(this.at(x, y, 2), c.undo > 0 ? 'Тупик! B — отменить ход' : 'Тупик! A — заново', '#ff8a8a', 18); lab.count('_secret'); }
    }
    const filled = [...g.goal].filter(k => g.sheep.some(([x, y]) => x + ',' + y === k)).length;
    if (g.goal.size && filled === g.goal.size && !st.done) this.solve(lab);
    else if (st.rules === 5 && st.lv.par != null && st.moves > st.lv.par + c.limit && !st.fail) {
      st.fail = 1.1; lab.count('не уложился'); lab.popup([0, 4, 0], 'Не уложился в ходы! Ещё раз', '#ff8a8a', 22); lab.tone(220, 0.3, 'sawtooth', 0.06, 110);
    }
  },
  solve(lab) {
    const st = lab.state, L = st.lv, par = L.par, under = par != null && st.moves <= par;
    st.solved++; st.done = 1.6; lab.count('уровни');
    const pts = 500 + (par != null ? Math.max(0, par * 2 - st.moves) * 20 : 200);
    lab.addScore(under ? pts * 2 : pts, [0, 4, 0], under ? '#ffd23f' : '#ffffff');
    if (under) { lab.popup([0, 5.5, 0], 'В пар! ×2', '#ffd23f', 30); lab.count('в пар'); }
    lab.clear({ moves: st.moves });
    for (let n = 0; n < 5; n++) lab.tone(784 * lab.pitch(n * 2), 0.15, 'triangle', 0.07, 0, n * 0.07);
    st.sheepM.forEach(s => { s.hop = 1.6; });
    lab.burst([0, 3, 0], { count: 50, colors: ['#ffd23f', '#ffffff', '#7cf5a8', '#ff8fb1'], speed: 8, up: 5 });
    lab.shake(0.15);
  },

  /* ---------- мир и клетки уровня ---------- */
  at(x, y, h = 0) { const st = this._st, C = this.CELL; return [(x - (st.g.W - 1) / 2) * C, h, (y - (st.g.H - 1) / 2) * C]; },
  build(lab, keepCam) {
    const st = lab.state, T = lab.THREE, g = st.g, C = this.CELL, O = x => Object.assign({ parent: st.lvl }, x);
    this._st = st;
    if (st.lvl) { st.lvl.parent.remove(st.lvl); st.lvl.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    st.lvl = lab.group();
    st.filled = st.filled && keepCam ? st.filled : [];
    // трава клетками двух оттенков
    const cells = [...g.floor].map(k => k.split(',').map(Number));
    const grass = lab.instances(new T.BoxGeometry(C * 0.98, 0.3, C * 0.98), lab.mat('#ffffff'), Math.max(1, cells.length), { parent: st.lvl });
    cells.forEach(([x, y], i) => lab.place(grass, i, this.at(x, y, -0.15), { color: (x + y) % 2 ? '#62ad3c' : '#71bd48' }));
    // лёд
    const ice = [...g.ice].map(k => k.split(',').map(Number));
    if (ice.length) { const m = lab.instances(new T.BoxGeometry(C * 0.98, 0.34, C * 0.98), lab.mat('#bfe9ff', { shiny: true, glow: 0.1 }), ice.length, { parent: st.lvl }); ice.forEach(([x, y], i) => lab.place(m, i, this.at(x, y, -0.12))); }
    // плетни: столбики и лоза
    const walls = [...g.wall].map(k => k.split(',').map(Number));
    st.fence = lab.instances(new T.BoxGeometry(C * 0.98, 0.7, C * 0.98), lab.mat('#9a7448'), Math.max(1, walls.length), { parent: st.lvl });
    st.fenceTop = lab.instances(new T.BoxGeometry(C * 1.0, 0.14, C * 1.0), lab.mat('#c8a26a'), Math.max(1, walls.length), { parent: st.lvl });
    st.stakes = lab.instances(new T.CylinderGeometry(0.07, 0.09, 1.3, 5), '#5a3f22', Math.max(1, walls.length), { parent: st.lvl });
    st.walls = walls;
    // вокруг уровня — луг: кочки, цветы, пихты и камни ближе к краю, чтобы мир был в кадре
    const R = Math.max(g.W, g.H) * C / 2, around = (a, b) => { const ang = lab.rand(0, Math.PI * 2), r = lab.rand(a, b); return [Math.cos(ang) * (g.W * C / 2 + r), 0, Math.sin(ang) * (g.H * C / 2 + r) * 0.9]; };
    const fl = lab.instances(new T.IcosahedronGeometry(0.18, 0), lab.mat('#ffffff', { glow: 0.15 }), 60, { parent: st.lvl, shadow: false });
    for (let i = 0; i < 60; i++) { const q = around(0.6, 4); q[1] = 0.12; lab.place(fl, i, q, { color: lab.pick(['#ff6f91', '#ffd23f', '#ffffff', '#b38cff', '#ff9f43']) }); }
    const tuft = lab.instances(new T.ConeGeometry(0.22, 0.6, 4), '#4f9c3a', 50, { parent: st.lvl, shadow: false });
    for (let i = 0; i < 50; i++) { const q = around(0.4, 5); q[1] = 0.25; lab.place(tuft, i, q, { rot: lab.rand(0, 3) }); }
    const pc = lab.instances(new T.ConeGeometry(1, 2.6, 7), '#2e7d4a', 14, { parent: st.lvl }), pt = lab.instances(new T.CylinderGeometry(0.18, 0.24, 1, 6), '#6b4a30', 14, { parent: st.lvl });
    for (let i = 0; i < 14; i++) { const q = around(3.5, 7), s2 = lab.rand(0.8, 1.3); lab.place(pt, i, [q[0], 0.5 * s2, q[2]], { scale: s2 }); lab.place(pc, i, [q[0], 2 * s2, q[2]], { scale: s2, rot: lab.rand(0, 3) }); }
    const rk = lab.instances(new T.DodecahedronGeometry(0.5, 0), '#9a948c', 10, { parent: st.lvl });
    for (let i = 0; i < 10; i++) { const q = around(1, 6); q[1] = 0.2; lab.place(rk, i, q, { rot: lab.rand(0, 3), scale: lab.rand(0.6, 1.3) }); }
    this.fenceLook(lab);
    // загоны: подстилка сена и угловые колья
    const goals = [...g.goal].map(k => k.split(',').map(Number));
    st.hay = lab.instances(new T.BoxGeometry(C * 0.8, 0.12, C * 0.8), lab.mat('#e0c25a', { glow: 0.15 }), Math.max(1, goals.length), { parent: st.lvl, shadow: false });
    const stakes = lab.instances(new T.CylinderGeometry(0.08, 0.1, 0.9, 5), '#6b4f2e', Math.max(1, goals.length * 4), { parent: st.lvl });
    goals.forEach(([x, y], i) => {
      lab.place(st.hay, i, this.at(x, y, 0.06));
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b], k) => { const p = this.at(x, y, 0.45); lab.place(stakes, i * 4 + k, [p[0] + a * C * 0.42, p[1], p[2] + b * C * 0.42]); });
    });
    st.goalCells = goals;
    // норы
    st.holeM = lab.instances(new T.CylinderGeometry(C * 0.42, C * 0.42, 0.1, 10), '#2a1d12', Math.max(1, g.hole.size + st.filled.length), { parent: st.lvl, shadow: false });
    st.bridgeM = lab.instances(new T.BoxGeometry(C * 0.86, 0.2, C * 0.86), lab.mat('#f2ece0'), Math.max(1, g.hole.size + st.filled.length), { parent: st.lvl });
    this.placeHoles(lab);
    // овцы
    st.sheepM = g.sheep.map(([x, y]) => this.buildSheep(lab, x, y));
    // слова-правила: дощечки с надписью
    st.wordM = g.words.map(w => this.buildWord(lab, w));
    st.ruleOn = this.rule(st);
    // пастух
    const hp = this.at(g.p[0], g.p[1]); st.hero.node.position.set(hp[0], 0, hp[2]);
    // камера: уровень целиком в кадре
    this.field = { w: g.W * C + 9, h: g.H * C + 8 };
    if (!keepCam) lab.setCamera('iso', { tilt: 0.62, target: [0, 0, 0.6] });
  },
  placeHoles(lab) {
    const st = lab.state, g = st.g; let i = 0;
    for (const k of g.hole) { const [x, y] = k.split(',').map(Number); lab.place(st.holeM, i, this.at(x, y, 0.02)); lab.place(st.bridgeM, i++, this.at(x, y, -5), { scale: 0 }); }
    for (const f of st.filled) { lab.place(st.holeM, i, this.at(f.x, f.y, -5), { scale: 0 }); lab.place(st.bridgeM, i++, this.at(f.x, f.y, -0.02)); }
  },
  fenceLook(lab) { // плетни: сломано правило — плетень полупрозрачный и ниже
    const st = lab.state, on = this.rule(st);
    st.walls.forEach(([x, y], i) => {
      const edge = x === 0 || y === 0 || x === st.g.W - 1 || y === st.g.H - 1, low = !on && !edge;
      lab.place(st.fence, i, this.at(x, y, low ? 0.1 : 0.35), { scale: [1, low ? 0.3 : 1, 1] });
      lab.place(st.fenceTop, i, this.at(x, y, low ? 0.22 : 0.74));
      lab.place(st.stakes, i, this.at(x, y, low ? 0.3 : 0.9), { scale: low ? 0.4 : 1 });
    });
  },
  buildSheep(lab, x, y) {
    const st = lab.state, O = o => Object.assign({ parent: null }, o), g = lab.group({ parent: st.lvl, at: this.at(x, y) });
    const body = lab.group({ parent: g });
    lab.merge([
      lab.ball(0.62, '#fffaf0', O({ at: [0, 0.75, 0], scale: [1, 0.85, 1.15], detail: 1 })),
      lab.ball(0.34, '#fffaf0', O({ at: [0.3, 1.15, -0.2], detail: 0 })), lab.ball(0.32, '#fffaf0', O({ at: [-0.3, 1.12, 0.25], detail: 0 })),
    ], body);
    const head = lab.group({ parent: body, at: [0, 0.85, 0.72] });
    lab.merge([lab.box(0.36, 0.38, 0.36, '#3a2f2a', O({ round: 0.1 })), lab.box(0.16, 0.08, 0.2, '#3a2f2a', O({ at: [0.24, 0.12, -0.05], rot: [0, 0, -0.5] })), lab.box(0.16, 0.08, 0.2, '#3a2f2a', O({ at: [-0.24, 0.12, -0.05], rot: [0, 0, 0.5] }))], head);
    lab.merge([lab.ball(0.07, '#ffffff', O({ at: [0.1, 0.06, 0.18], detail: 0 })), lab.ball(0.07, '#ffffff', O({ at: [-0.1, 0.06, 0.18], detail: 0 }))], head);
    lab.merge([[0.3, 0.35], [-0.3, 0.35], [0.3, -0.35], [-0.3, -0.35]].map(([a, b]) => lab.cyl(0.07, 0.07, 0.5, '#3a2f2a', O({ at: [a, 0.25, b], sides: 5 }))), body);
    const ring = lab.mesh(new lab.THREE.RingGeometry(0.75, 0.95, 20), lab.mat('#ff4d5e', { glow: 0.8, unlit: true, side: 'double' }), { parent: g, at: [0, 0.06, 0], rot: [-Math.PI / 2, 0, 0], shadow: false });
    ring.visible = false;
    return { node: g, body, head, ring, hop: 0, target: null, sink: false, ph: x * 1.7 + y };
  },
  buildWord(lab, w) {
    const T = lab.THREE, st = lab.state, text = { P: 'ПЛЕТЕНЬ', '=': 'ЕСТЬ', S: 'СТОП' }[w.w];
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
    const x = cv.getContext('2d'); x.fillStyle = w.w === 'S' ? '#ff5d6e' : w.w === '=' ? '#ffd23f' : '#ffb547'; x.fillRect(0, 0, 256, 128);
    x.fillStyle = '#1a1206'; x.font = `900 ${text.length > 5 ? 46 : 60}px system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, 66);
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
    const top = new T.MeshStandardMaterial({ map: tex, emissive: new T.Color('#ffffff'), emissiveMap: tex, emissiveIntensity: 0.25, flatShading: true });
    const side = lab.mat('#8a5a2c');
    const m = new T.Mesh(new T.BoxGeometry(1.7, 0.5, 1.2), [side, side, top, side, side, side]);
    m.castShadow = true; m.receiveShadow = true;
    st.lvl.add(m);
    const p = this.at(w.x, w.y, 0.3); m.position.set(p[0], p[1], p[2]);
    return m;
  },
  world(lab) {
    const T = lab.THREE, st = lab.state, O = x => Object.assign({ parent: null }, x);
    lab.ground({ w: 140, h: 120, color: '#5c9e3a', bumps: 1.5, flat: 0.45 });
    const mts = [];
    for (let i = 0; i < 9; i++) { const a = -1.2 + i * 0.3, r = lab.rand(10, 16), h = lab.rand(14, 22), x = Math.sin(a) * 60, z = -45 - Math.cos(a) * 10; mts.push(lab.cone(r, h, '#7b8fc8', O({ at: [x, h / 2 - 2, z], sides: 6, rot: lab.rand(0, 3) })), lab.cone(r * 0.35, h * 0.35, '#f4f6ff', O({ at: [x, h - 2 - h * 0.17, z], sides: 6 }))); }
    lab.noShadow(lab.merge(mts));
    const N = 46, crown = lab.instances(new T.ConeGeometry(1.2, 3, 7), '#2e7d4a', N), trunk = lab.instances(new T.CylinderGeometry(0.2, 0.26, 1.2, 6), '#6b4a30', N);
    for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2, r = lab.rand(24, 34), x = Math.cos(a) * r * 1.2, z = Math.sin(a) * r * 0.9 - 4, s = lab.rand(0.8, 1.4); lab.place(trunk, i, [x, 0.6 * s, z], { scale: s }); lab.place(crown, i, [x, 2.4 * s, z], { scale: s, rot: lab.rand(0, 3) }); }
    const fl = lab.instances(new T.IcosahedronGeometry(0.16, 0), lab.mat('#ffffff', { glow: 0.15 }), 140, { shadow: false });
    for (let i = 0; i < 140; i++) { const a = lab.rand(0, 6.28), r = lab.rand(14, 30); lab.place(fl, i, [Math.cos(a) * r * 1.2, 0.15, Math.sin(a) * r * 0.9], { color: lab.pick(['#ff6f91', '#ffd23f', '#ffffff', '#b38cff']) }); }
    // дольмен и кошара на краю луга
    lab.merge([lab.box(3.4, 2.4, 2.8, '#a49c8c', O({ at: [-20, 1.2, -14] })), lab.box(4.2, 0.4, 3.4, '#8d8576', O({ at: [-20, 2.6, -14] })), lab.box(0.9, 0.8, 0.1, '#3a3530', O({ at: [-20, 1, -12.58] }))]);
    lab.merge([lab.box(6, 2.6, 4, '#c9a46a', O({ at: [21, 1.3, -13] })), lab.cone(4.6, 2.2, '#9a6a3a', O({ at: [21, 3.7, -13], sides: 4, rot: Math.PI / 4, scale: [1, 1, 0.75] }))]);
    st.clouds = [0, 1, 2, 3, 4].map(i => { const c = lab.noShadow(lab.merge([[0, 0, 2.4], [2, -0.4, 1.7], [-2, -0.4, 1.6]].map(([x, y, r]) => lab.ball(r, lab.mat('#ffffff', { glow: 0.1 }), O({ at: [x, y, 0], scale: [1, 0.7, 0.8] }))))); c.position.set(-40 + i * 20, 18 + lab.rand(0, 4), -40 + lab.rand(-6, 6)); return c; });
  },
  buildShepherd(lab) {
    const O = x => Object.assign({ parent: null }, x), node = lab.group(), pose = lab.group({ parent: node, scale: 1.15 });
    lab.merge([
      lab.cone(0.62, 1.4, '#2b2d42', O({ at: [0, 0.75, 0], sides: 7 })), // бурка
      lab.box(0.5, 0.5, 0.36, '#e63946', O({ at: [0, 1.25, 0.12], round: 0.08 })), // красный бешмет
      lab.ball(0.3, '#f2c9a0', O({ at: [0, 1.72, 0], detail: 1 })),
      lab.cyl(0.32, 0.3, 0.32, '#f4f1ea', O({ at: [0, 2.02, 0], sides: 8 })), // белая папаха
    ], pose);
    lab.merge([lab.ball(0.06, '#15151c', O({ at: [0.1, 1.76, 0.26], detail: 0 })), lab.ball(0.06, '#15151c', O({ at: [-0.1, 1.76, 0.26], detail: 0 }))], pose);
    const staff = lab.cyl(0.04, 0.05, 2.1, '#8a5a2c', { parent: pose, at: [0.5, 1.05, 0.1], rot: [0, 0, 0.12] });
    const ring = lab.mesh(new lab.THREE.RingGeometry(0.6, 0.78, 20), lab.mat('#ffd23f', { glow: 0.6, unlit: true, side: 'double' }), { parent: node, at: [0, 0.05, 0], rot: [-Math.PI / 2, 0, 0], shadow: false });
    return { node, pose, staff, ring, face: 0, hop: 0, bump: 0 };
  },
  animate(lab, dt) {
    const st = lab.state, g = st.g, t = lab.t, h = st.hero;
    if (!g) return;
    const hp = this.at(g.p[0], g.p[1]);
    h.node.position.x = lab.damp(h.node.position.x, hp[0], 22, dt); h.node.position.z = lab.damp(h.node.position.z, hp[2], 22, dt);
    h.hop = Math.max(0, h.hop - dt * 6); h.bump = Math.max(0, h.bump - dt * 5);
    h.node.position.y = Math.sin(h.hop * Math.PI) * 0.25;
    h.node.rotation.y = lab.damp(h.node.rotation.y, h.face, 18, dt);
    h.pose.scale.y = 1.15 * (1 - h.bump * 0.12 + Math.sin(t * 3) * 0.015);
    h.ring.rotation.z += dt;
    st.sheepM.forEach((s, i) => {
      if (s.sink) { s.node.position.y = lab.damp(s.node.position.y, -1.4, 6, dt); return; }
      const [x, y] = g.sheep[i] || [0, 0], p = this.at(x, y), on = g.goal.has(x + ',' + y);
      s.node.position.x = lab.damp(s.node.position.x, p[0], 18, dt); s.node.position.z = lab.damp(s.node.position.z, p[2], 18, dt);
      s.hop = Math.max(0, s.hop - dt * 4);
      s.node.position.y = Math.abs(Math.sin(s.hop * Math.PI * (s.hop > 1 ? 2 : 1))) * 0.5;
      s.body.scale.set(1 + Math.sin(t * 2.5 + s.ph) * 0.03, 1 - Math.sin(t * 2.5 + s.ph) * 0.03, 1);
      s.head.rotation.y = Math.sin(t * 0.8 + s.ph) * 0.4;
      s.ring.visible = st.dead.has(i) && lab.cfg.hint > 0 && lab.cfg.secret > 0;
      if (s.ring.visible) s.ring.scale.setScalar(1 + Math.sin(t * 8) * 0.08);
      s.on = on;
    });
    if (st.goalCells && st.hay) st.goalCells.forEach(([x, y], i) => { const full = g.sheep.some(s => s[0] === x && s[1] === y); lab.place(st.hay, i, this.at(x, y, 0.06 + (full ? 0.05 : 0)), { scale: full ? [1.08, 2, 1.08] : 1 }); });
    if (st.wordM) st.wordM.forEach((m, i) => { const w = g.words[i], p = this.at(w.x, w.y, 0.3); m.position.x = lab.damp(m.position.x, p[0], 18, dt); m.position.z = lab.damp(m.position.z, p[2], 18, dt); m.position.y = 0.3 + Math.sin(t * 2 + i) * 0.05; });
    if (st.clouds) st.clouds.forEach(c => { c.position.x += dt * 0.6; if (c.position.x > 60) c.position.x = -60; });
  },
};
