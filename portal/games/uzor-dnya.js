// «Узор дня» — ремейк-донор урока 23 по мотивам Wordle (Джош Уордл, 2021), оболочка «Лаб3D 1.0» (three.js).
// План.
// Фраза: ты — мастерица в ауле, ты ткёшь ковёр дня, но узор спрятан. Угадай пять знаков узора за шесть попыток. Узор дня один на весь класс.
// Ядро на 3 секунды: ↑ ↓ — знак в клетке, ← → — клетка, пробел — проверить → плитки по очереди переворачиваются
// и красятся: зелёная — знак на своём месте, жёлтая — знак есть в узоре, но не тут, серая — знака нет → «ага, значит…».
// Выбор, оплаченный очками: рискнуть и поставить новые знаки (больше узнаешь) или ставить проверенные (ближе к ответу);
// решил раньше — больше очков (1000 за первую попытку, −150 за каждую следующую).
// Угроза: попытки кончаются. Шестая — красная рамка и сердцебиение, после неё узор открывается серым.
// Кривая партии: первые ходы — разведка (много серого), потом жёлтые сужают выбор, развязка — волна зелёных и ковёр разворачивается.
// События: знак в клетке (щелчок своей высоты), переворот плитки (нота выше с каждой плиткой), зелёная (искры, прыжок), пять зелёных
// (волна прыжков, ковёр дня разворачивается, конфетти, сетка-результат без спойлеров), шестая попытка (красная рамка), неполный ряд (ряд трясётся).
// Узор дня считается из даты: у всех в классе в один день один узор (lab.data.day — день от портала, иначе сегодня). Сыграл узор дня —
// дальше «Тренировка» на случайных узорах: как в доноре, загадка дня одна.
// Вариации (Tab): только числа вместо цвета, бесконечные узоры, таймер на ход, сложный режим, подсказка за очки, гонка, контраст для дальтоников.
// Спрятанная механика донора — мотивация (теория самодетерминации): свой путь к ответу, подсказка цветом у каждой клетки и одна загадка дня
// для всех с сеткой, которой хочется поделиться (ручка secret 0 — только «на месте / не на месте» числами, новый узор каждую партию, сетки нет).
// Разбор игр жанра — docs/журнал/модуль-6.md, раздел урока 23.
// Лицо игры: тёплый двор мастерицы на закате, деревянный станок и плитки цвета сыра, мёда и мха; приёмы — плитки переворачиваются по одной,
// как в доноре; ковёр дня разворачивается за станком; на плетне висят ковры прошлых дней. Палитра: двор #7cc35a, дерево #a8743f,
// ковёр #c8323c, золото #ffd23f, зелёная плитка #3fbf5f, жёлтая #f0b429, серая #4b5161, мастерица #e63946 и #fff6e0.
// Поле: столбцы по X, ряды попыток по Z (первая попытка дальше всех, вверху экрана), полка знаков — ближе всех.
const GAME = {
  engine: 'three',
  title: 'Узор дня',
  subtitle: 'Угадай узор дня из пяти знаков за шесть попыток. Цвет плитки подскажет, что ты угадал.',
  donor: 'Wordle',
  players: 1,
  pace: 'turns',
  lives: 0,
  controls: [
    { input: 'move4', text: '← → клетка, ↑ ↓ знак' },
    { input: 'a', text: 'проверить ряд' },
    { input: 'b', text: 'стереть знак (в «Подсказке» — открыть клетку)' },
  ],
  camera: { type: 'iso', tilt: 0.56, target: [0, 0, 1.4] },
  field: { w: 21, h: 22 },
  sky: ['#7ec8ff', '#ffe2b8'],
  fog: 0.008,
  accent: '#ffd23f',
  scoreColor: '#ffd23f',
  decisions: [
    'Чувство: «я догадалась сама» — когда серые и жёлтые складываются в ответ',
    'Честность: каждая плитка честно говорит, что с ней, ничего не спрятано',
    'Выбор: проверить новые знаки или ставить уже найденные — рискнуть или бить наверняка',
  ],
  config: {
    secret: { value: 1, min: 0, max: 1, step: 1, label: 'Спрятанная механика: мотивация', restart: true, hint: '0 — только числа вместо цвета, новый узор каждую партию, без сетки-результата' },
    color: { value: 1, min: 0, max: 1, step: 1, label: 'Подсказка цветом у каждой плитки', restart: true, names: ['только числа', 'цвет у плитки'] },
    daily: { value: 1, min: 0, max: 1, step: 1, label: 'Узор дня один для всех', restart: true, names: ['новый каждую партию', 'узор дня'] },
    share: { value: 1, min: 0, max: 1, step: 1, label: 'Сетка-результат после партии', names: ['нет', 'есть'] },
    tries: { value: 6, min: 3, max: 10, step: 1, label: 'Попыток', restart: true },
    len: { value: 5, min: 4, max: 6, step: 1, label: 'Знаков в узоре', restart: true },
    kinds: { value: 8, min: 6, max: 10, step: 1, label: 'Видов знаков', restart: true },
    timer: { value: 0, min: 0, max: 60, step: 5, label: 'Таймер на ход, с (0 — без таймера)', restart: true },
    hard: { value: 0, min: 0, max: 1, step: 1, label: 'Сложный режим: найденное держать', names: ['нет', 'да'] },
    hint: { value: 0, min: 0, max: 1, step: 1, label: 'Подсказка за очки (B)', names: ['нет', 'да'] },
    race: { value: 0, min: 0, max: 1, step: 1, label: 'Гонка: очки за скорость', names: ['нет', 'да'] },
    shelf: { value: 1, min: 0, max: 1, step: 1, label: 'Полка знаков с подсказками', names: ['нет', 'есть'] },
    contrast: { value: 0, min: 0, max: 1, step: 1, label: 'Контраст для дальтоников', names: ['зелёный и жёлтый', 'оранжевый и голубой'] },
  },
  presets: {
    'Новичок': { tries: 8, kinds: 6 },
    'Без спрятанной механики': { secret: 0 },
    'Только числа': { color: 0 },
    'Бесконечная': { daily: 0, share: 0 },
    'Таймер': { timer: 20 },
    'Сложный режим': { hard: 1 },
    'Подсказка': { hint: 1 },
    'Гонка': { race: 1 },
    'Контраст': { contrast: 1 },
  },
  notes: [
    'Узор дня считается из даты: у всего класса в один день один узор. Повторная партия в тот же день — «Тренировка» на случайном узоре.',
    'Знаки в узоре не повторяются; в догадке повторять можно.',
  ],
  SYMBOLS: [
    { id: 'sun', name: 'Солнце', col: '#ffb01f' }, { id: 'hill', name: 'Гора', col: '#5b7cff' }, { id: 'river', name: 'Река', col: '#17b6e6' },
    { id: 'star', name: 'Звезда', col: '#ffe14a' }, { id: 'tree', name: 'Дерево', col: '#1d7a3a' }, { id: 'moon', name: 'Луна', col: '#b49bff' },
    { id: 'fire', name: 'Огонь', col: '#ff5a2a' }, { id: 'drop', name: 'Капля', col: '#3fd6ff' }, { id: 'horn', name: 'Рога', col: '#c98a4a' },
    { id: 'eye', name: 'Око', col: '#ff6fb1' },
  ],
  PITCH: 1.95, TILE: 1.7,

  // день и узор: из даты — одинаково у всех; из зерна партии — тренировка
  dayKey(lab) {
    const d = lab.data && /^\d{8}$/.test(String(lab.data.day || '')) ? String(lab.data.day) : (() => { const n = new Date(); return '' + n.getFullYear() + String(n.getMonth() + 1).padStart(2, '0') + String(n.getDate()).padStart(2, '0'); })();
    return d;
  },
  dayName(key) { const m = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']; return `${Number(key.slice(6, 8))} ${m[Number(key.slice(4, 6)) - 1] || ''}`; },
  hashRand(s) { let h = 2166136261 >>> 0; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return () => { h = (h + 0x6D2B79F5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; },
  makeAnswer(lab, st) {
    const pool = [...Array(st.kinds).keys()], out = [];
    const r = st.daily ? this.hashRand('uzor:' + st.day + ':' + st.len + ':' + st.kinds) : () => lab.rand(0, 1);
    while (out.length < st.len) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    return out;
  },

  start(lab, scene) {
    const st = lab.state, c = lab.cfg, sec = c.secret > 0;
    Object.assign(st, {
      len: Math.round(c.len), kinds: Math.max(Math.round(c.len), Math.round(c.kinds)), tries: Math.round(c.tries),
      color: sec && c.color > 0, daily: sec && c.daily > 0, share: sec && c.share > 0,
      row: 0, col: 0, guess: [], rows: [], busy: 0, over: false, known: {}, greensAt: new Set(), hints: 0, moveT: 0, shakeT: 0, warned: false,
    });
    st.day = this.dayKey(lab);
    // загадка дня одна: второй раз в тот же день — тренировка
    this.played = this.played || {};
    const dayId = st.day + ':' + st.len + ':' + st.kinds;
    st.practice = st.daily && !!this.played[dayId];
    if (st.practice) st.daily = false;
    st.dayId = dayId;
    st.answer = this.makeAnswer(lab, st);
    st.guess = Array(st.len).fill(-1);
    this.glyphMats = {}; this.texCache = {}; // партия строится на чистой сцене: текстуры знаков — заново
    this.world(lab);
    this.board(lab);
    st.hero = this.weaver(lab);
    lab.hero(st.hero.node);
    lab.popup([0, 3, -2], st.daily ? `Узор дня · ${this.dayName(st.day)}` : st.practice ? 'Тренировка: узор дня уже разгадан' : 'Новый узор', '#fff1a8', 26);
  },

  update(lab, dt) {
    const st = lab.state, c = lab.cfg, p = lab.p1;
    this.animate(lab, dt);
    if (st.over) return;
    if (st.busy > 0) { st.busy -= dt; return; }
    // таймер хода: время вышло — ряд уходит на проверку как есть
    if (c.timer > 0) {
      st.moveT += dt;
      if (st.moveT > c.timer) { lab.count('таймер'); lab.popup(this.at(2, st.row, 1.5), 'Время хода вышло!', '#ff8a8a', 22); this.submit(lab, true); return; }
      if (c.timer - st.moveT < 5 && !st.warned) { st.warned = true; lab.sfx.warn(); }
    }
    if (p.pressed.left) this.move(lab, -1);
    if (p.pressed.right) this.move(lab, 1);
    if (p.pressed.up) this.cycle(lab, 1);
    if (p.pressed.down) this.cycle(lab, -1);
    if (p.pressed.b) { if (c.hint > 0) this.hint(lab); else this.erase(lab); }
    if (p.pressed.a) this.submit(lab, false);
    this.hudLines(lab);
  },

  overNote(lab) {
    const st = lab.state;
    lab.stat('попыток', st.rows.length);
    const out = [st.solved ? `Узор разгадан за ${st.rows.length} из ${st.tries}` : `Узор не разгадан: попытки кончились`];
    if (st.grid) out.push(st.grid.split('\n').slice(0, 1)[0]);
    out.push(lab.cfg.secret > 0 ? 'Свой путь, цвет у каждой плитки и один узор на всех — вот почему хочется сыграть завтра.' : 'Спрятанная механика выключена: только числа, узор новый, сетки нет. Захотелось ли поделиться?');
    return out;
  },

  /* ---------- ход: клетка, знак, проверка ---------- */
  move(lab, d) {
    const st = lab.state;
    st.col = (st.col + d + st.len) % st.len;
    lab.tone(330 + st.col * 40, 0.04, 'triangle', 0.03);
  },
  cycle(lab, d) {
    const st = lab.state, cur = st.guess[st.col];
    let n = cur < 0 ? (d > 0 ? 0 : st.kinds - 1) : (cur + d + st.kinds) % st.kinds;
    st.guess[st.col] = n;
    const t = st.tiles[st.row][st.col];
    this.setGlyph(lab, t, n); t.state = 'typed'; t.mesh.material = this.mats.typed;
    lab.pulse(t.node, 1.15, 0.12);
    lab.tone(392 * Math.pow(2, n / 12), 0.05, 'square', 0.025);
    lab.count('знаки');
  },
  erase(lab) {
    const st = lab.state, t = st.tiles[st.row][st.col];
    if (st.guess[st.col] < 0) { this.move(lab, -1); return; }
    st.guess[st.col] = -1; this.setGlyph(lab, t, -1); t.state = 'empty'; t.mesh.material = this.mats.empty;
    lab.tone(220, 0.05, 'triangle', 0.03);
  },
  hint(lab) {
    const st = lab.state;
    const k = [...Array(st.len).keys()].find(i => !st.greensAt.has(i) && !(st.hinted || []).includes(i));
    if (k == null) { lab.popup(this.at(2, st.row, 1.5), 'Подсказывать нечего', '#ffffff', 18); return; }
    st.hinted = (st.hinted || []).concat(k); st.hints++;
    st.guess[k] = st.answer[k]; st.col = k;
    const t = st.tiles[st.row][k]; this.setGlyph(lab, t, st.answer[k]); t.mesh.material = this.mats.typed;
    lab.addScore(-150, this.at(k, st.row, 1.4), '#ff8a8a'); lab.count('подсказки');
    lab.burst(this.at(k, st.row, 0.6), { count: 12, colors: ['#ffd23f', '#ffffff'], speed: 3, up: 2 });
  },
  submit(lab, forced) {
    const st = lab.state, c = lab.cfg;
    if (!forced && st.guess.some(g => g < 0)) { st.shakeT = 0.45; lab.tone(140, 0.12, 'square', 0.05); lab.popup(this.at(2, st.row, 1.6), 'Заполни все клетки', '#ffffff', 18); lab.count('неполный ряд'); return; }
    if (!forced && c.hard > 0 && st.rows.length) { // сложный режим: зелёные на месте, жёлтые — в ряду
      const last = st.rows[st.rows.length - 1];
      const bad = last.marks.some((m, i) => m === 2 && st.guess[i] !== last.guess[i]) || last.marks.some((m, i) => m === 1 && !st.guess.includes(last.guess[i]));
      if (bad) { st.shakeT = 0.45; lab.tone(140, 0.12, 'square', 0.05); lab.popup(this.at(2, st.row, 1.6), 'Сложный режим: найденное держи', '#ffb547', 18); return; }
    }
    const marks = this.score(st.answer, st.guess);
    const row = { guess: st.guess.slice(), marks };
    st.rows.push(row); st.moveT = 0; st.warned = false;
    lab.count('попытки');
    const n = st.len, step = 0.28;
    st.busy = n * step + 0.45;
    const tiles = st.tiles[st.row];
    tiles.forEach((t, i) => {
      lab.after(i * step, () => {
        // переворот: на ребро — новый цвет — обратно
        lab.tween(step * 1.1, k => {
          if (k < 0.5) t.node.rotation.x = -k * Math.PI;
          else { if (!t.flipped) { t.flipped = true; t.mesh.material = st.color ? this.mats[['gray', 'yellow', 'green'][marks[i]]] : this.mats.plain; } t.node.rotation.x = (1 - k) * Math.PI; }
        }, 'inOutQuad');
        lab.tone(440 * lab.pitch(i), 0.07, 'triangle', 0.05, 0, step * 0.5);
        lab.after(step * 0.6, () => {
          if (st.color && marks[i] === 2) {
            lab.burst(this.at(i, st.row, 0.8), { count: 10, colors: ['#7cf5a8', '#ffd23f', '#ffffff'], speed: 3.4, up: 2.4 });
            lab.pulse(t.node, 1.25, 0.18);
            if (!st.greensAt.has(i)) { st.greensAt.add(i); lab.count('_secret'); lab.count('зелёные'); }
          }
        });
      });
    });
    lab.after(n * step + 0.3, () => this.afterRow(lab, row));
  },
  // оценка как у донора: сначала зелёные, потом жёлтые с учётом числа знаков
  score(ans, g) {
    const marks = g.map(() => 0), left = {};
    g.forEach((x, i) => { if (x === ans[i]) marks[i] = 2; else left[ans[i]] = (left[ans[i]] || 0) + 1; });
    g.forEach((x, i) => { if (marks[i] !== 2 && x >= 0 && left[x] > 0) { marks[i] = 1; left[x]--; } });
    return marks;
  },
  afterRow(lab, row) {
    const st = lab.state;
    // полка знаков: что известно о каждом знаке
    if (st.color) row.guess.forEach((x, i) => { if (x >= 0) st.known[x] = Math.max(st.known[x] == null ? -1 : st.known[x], row.marks[i]); });
    else this.pegs(lab, row);
    this.paintShelf(lab);
    const greens = row.marks.filter(m => m === 2).length;
    if (greens === st.len) { this.solve(lab); return; }
    st.row++; st.col = 0; st.guess = Array(st.len).fill(-1);
    if (st.row >= st.tries) { this.fail(lab); return; }
    if (st.row === st.tries - 1) { lab.popup(this.at(2, st.row, 2), 'Последняя попытка!', '#ff8a8a', 24); lab.sfx.warn(); lab.shake(0.08); }
    st.hinted = [];
  },
  solve(lab) {
    const st = lab.state, c = lab.cfg, n = st.rows.length;
    st.over = true; st.solved = true; lab.count('решено');
    if (st.daily) this.played[st.dayId] = true;
    let pts = Math.max(100, 1000 - (n - 1) * 150);
    if (c.race > 0) pts += Math.max(0, Math.round((180 - lab.t) * 5));
    lab.addScore(pts, [0, 3, -1], '#ffd23f');
    // волна прыжков по ряду, ковёр дня разворачивается
    st.tiles[st.row].forEach((t, i) => lab.after(i * 0.08, () => { t.hop = 1; lab.tone(523 * lab.pitch(i * 2), 0.12, 'triangle', 0.06); }));
    lab.after(0.5, () => { this.unroll(lab, false); lab.burst([0, 4, -8], { count: 60, colors: ['#ffd23f', '#ff5d6e', '#7cf5a8', '#ffffff', '#5fe0ff'], speed: 9, up: 6 }); lab.sfx.win(); lab.shake(0.12); });
    lab.popup([0, 4.5, -2], ['Гениально!', 'Великолепно!', 'Здорово!', 'Отлично!', 'Хорошо!', 'Уф, успела!', 'На грани!', 'Получилось!', 'Получилось!', 'Получилось!'][n - 1] || 'Получилось!', '#fff1a8', 30);
    this.makeGrid(lab, true);
    lab.after(st.share ? 3.2 : 1.8, () => lab.win(`Узор разгадан за ${n} из ${st.tries}`));
  },
  fail(lab) {
    const st = lab.state;
    st.over = true; st.solved = false;
    if (st.daily) this.played[st.dayId] = true;
    lab.addScore(st.greensAt.size * 40, [0, 3, -1], '#ffffff');
    lab.after(0.3, () => { this.unroll(lab, true); lab.sfx.lose(); });
    lab.popup([0, 4.5, -2], 'Узор был такой', '#ffd9a8', 26);
    this.makeGrid(lab, false);
    lab.after(st.share ? 3.2 : 2, () => lab.gameOver('Попытки кончились: узор на ковре'));
  },
  // сетка-результат без спойлеров: только цвета, ни одного знака
  makeGrid(lab, ok) {
    const st = lab.state, c = lab.cfg;
    const G = c.contrast > 0 ? '🟧' : '🟩', Y = c.contrast > 0 ? '🟦' : '🟨';
    const head = `${st.daily ? 'Узор дня ' + this.dayName(st.day) : st.practice ? 'Тренировка' : 'Узор'} · ${ok ? st.rows.length : 'X'}/${st.tries}${c.hard > 0 ? '*' : ''}`;
    const body = st.rows.map(r => (st.color ? r.marks.map(m => (m === 2 ? G : m === 1 ? Y : '⬛')).join('') : `${r.marks.filter(m => m === 2).length}● ${r.marks.filter(m => m === 1).length}○`)).join('\n');
    st.grid = head + '\n' + body;
    lab.stat('сетка', st.grid);
    if (st.share) {
      lab.count('_secret');
      lab.hud('grid', st.grid, { color: '#ffffff', size: 18 });
      lab.hud('gridHint', 'Сетку можно показать друзьям: в ней ни одного знака — никому не испортишь загадку', { color: '#fff1a8', size: 13 });
    }
  },
  pegs(lab, row) { // режим «только числа»: справа от ряда — сколько на месте и сколько не на месте
    const st = lab.state, a = row.marks.filter(m => m === 2).length, b = row.marks.filter(m => m === 1).length;
    const r = st.rows.length - 1, base = this.at(st.len - 0.2, r, 0.3);
    for (let i = 0; i < 6; i++) {
      const pg = st.pegList[r * 6 + i]; if (!pg) continue;
      pg.mesh.visible = i < a + b; pg.mesh.material = i < a ? this.mats.pegFull : this.mats.pegHalf;
      pg.mesh.position.set(base[0] + 0.4 + (i % 3) * 0.42, 0.35, base[2] - 0.25 + Math.floor(i / 3) * 0.5);
    }
    lab.popup(this.at(st.len, r, 1.2), `${a} на месте · ${b} не на месте`, '#ffffff', 16);
  },

  /* ---------- мир ---------- */
  at(i, r, h = 0) { const st = this._st, P = this.PITCH; return [(i - (st.len - 1) / 2) * P, h, (r - (st.tries - 1) / 2) * P - 1.2]; },
  glyphTex(lab, k) {
    this.texCache = this.texCache || {};
    if (this.texCache[k]) return this.texCache[k];
    const T = lab.THREE, cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const x = cv.getContext('2d'), s = this.SYMBOLS[k], C = 64;
    x.lineJoin = 'round'; x.lineCap = 'round'; x.lineWidth = 9; x.strokeStyle = '#1b1430'; x.fillStyle = s.col;
    const shape = (fn) => { x.beginPath(); fn(); x.stroke(); x.fill(); };
    switch (s.id) {
      case 'sun': for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; x.beginPath(); x.moveTo(C + Math.cos(a) * 30, C + Math.sin(a) * 30); x.lineTo(C + Math.cos(a) * 52, C + Math.sin(a) * 52); x.lineWidth = 12; x.stroke(); x.lineWidth = 6; x.strokeStyle = s.col; x.stroke(); x.strokeStyle = '#1b1430'; x.lineWidth = 9; } shape(() => x.arc(C, C, 24, 0, Math.PI * 2)); break;
      case 'hill': shape(() => { x.moveTo(12, 108); x.lineTo(50, 30); x.lineTo(70, 62); x.lineTo(84, 44); x.lineTo(116, 108); x.closePath(); }); break;
      case 'river': for (let j = 0; j < 3; j++) { x.beginPath(); for (let i = 0; i <= 100; i += 4) x.lineTo(14 + i, 36 + j * 28 + Math.sin(i / 14) * 10); x.lineWidth = 16; x.stroke(); x.lineWidth = 8; x.strokeStyle = s.col; x.stroke(); x.strokeStyle = '#1b1430'; x.lineWidth = 9; } break;
      case 'star': shape(() => { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 22 : 54; x.lineTo(C + Math.cos(a) * r, C + Math.sin(a) * r); } x.closePath(); }); break;
      case 'tree': shape(() => { x.moveTo(C, 10); x.lineTo(104, 86); x.lineTo(24, 86); x.closePath(); }); shape(() => x.rect(54, 86, 20, 30)); break;
      case 'moon': { // полумесяц: круг минус сдвинутый круг, обводка по краю
        const m = document.createElement('canvas'); m.width = m.height = 128; const y = m.getContext('2d');
        y.fillStyle = '#1b1430'; y.beginPath(); y.arc(C, C, 52, 0, Math.PI * 2); y.fill(); y.fillStyle = s.col; y.beginPath(); y.arc(C, C, 46, 0, Math.PI * 2); y.fill();
        y.globalCompositeOperation = 'destination-out'; y.beginPath(); y.arc(C + 30, C - 18, 44, 0, Math.PI * 2); y.fill();
        x.drawImage(m, 0, 0); break;
      }
      case 'fire': shape(() => { x.moveTo(C, 8); x.bezierCurveTo(100, 50, 112, 90, C, 118); x.bezierCurveTo(16, 90, 28, 50, C, 8); }); x.fillStyle = '#ffe14a'; x.beginPath(); x.moveTo(C, 56); x.bezierCurveTo(84, 80, 84, 100, C, 108); x.bezierCurveTo(44, 100, 44, 80, C, 56); x.fill(); break;
      case 'drop': shape(() => { x.moveTo(C, 8); x.bezierCurveTo(96, 60, 108, 80, C, 116); x.bezierCurveTo(20, 80, 32, 60, C, 8); }); break;
      case 'horn': x.beginPath(); x.arc(40, 70, 30, Math.PI * 0.2, Math.PI * 1.5); x.lineWidth = 22; x.stroke(); x.lineWidth = 12; x.strokeStyle = s.col; x.stroke(); x.strokeStyle = '#1b1430'; x.beginPath(); x.arc(88, 70, 30, Math.PI * 1.5, Math.PI * 0.8); x.lineWidth = 22; x.stroke(); x.lineWidth = 12; x.strokeStyle = s.col; x.stroke(); break;
      case 'eye': shape(() => { x.moveTo(8, C); x.quadraticCurveTo(C, 8, 120, C); x.quadraticCurveTo(C, 120, 8, C); x.closePath(); }); x.fillStyle = '#1b1430'; x.beginPath(); x.arc(C, C, 18, 0, Math.PI * 2); x.fill(); x.fillStyle = '#ffffff'; x.beginPath(); x.arc(C - 6, C - 6, 6, 0, Math.PI * 2); x.fill(); break;
      default: break;
    }
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
    return (this.texCache[k] = tex);
  },
  setGlyph(lab, t, k) {
    t.sym = k;
    if (k < 0) { t.glyph.visible = false; return; }
    this.glyphMats = this.glyphMats || {};
    const T = lab.THREE;
    if (!this.glyphMats[k] || this.glyphMats[k].userData.tex !== this.glyphTex(lab, k)) { this.glyphMats[k] = new T.MeshBasicMaterial({ map: this.glyphTex(lab, k), transparent: true, depthWrite: false }); this.glyphMats[k].userData.tex = this.glyphTex(lab, k); }
    t.glyph.material = this.glyphMats[k]; t.glyph.visible = true;
  },
  board(lab) {
    const st = lab.state, T = lab.THREE, c = lab.cfg; this._st = st;
    const G = c.contrast > 0 ? '#f5793a' : '#3fbf5f', Y = c.contrast > 0 ? '#5fb4ff' : '#f0b429';
    this.mats = {
      empty: lab.mat('#efe3c4', { rough: 0.9 }), typed: lab.mat('#fff1cf', { glow: 0.05 }), plain: lab.mat('#7d86a8'),
      green: lab.mat(G, { glow: 0.12 }), yellow: lab.mat(Y, { glow: 0.1 }), gray: lab.mat('#4b5161'),
      pegFull: lab.mat('#ff5d6e', { glow: 0.5 }), pegHalf: lab.mat('#ffffff', { glow: 0.3 }),
    };
    // станок: рама и нити
    const W = st.len * this.PITCH + 1.6, D = st.tries * this.PITCH + 1.6, z0 = this.at(0, 0)[2] - this.PITCH / 2 - 0.8, zc = (this.at(0, 0)[2] + this.at(0, st.tries - 1)[2]) / 2;
    const O = x => Object.assign({ parent: null }, x);
    lab.merge([
      lab.box(W + 0.6, 0.5, D + 0.6, '#8a5a2c', O({ at: [0, 0.05, zc], round: 0.1 })),
      lab.box(W, 0.12, D, '#c8323c', O({ at: [0, 0.34, zc] })),
      lab.box(W - 0.6, 0.13, D - 0.6, '#9c2430', O({ at: [0, 0.35, zc] })),
      ...[-1, 1].map(s => lab.box(0.35, 2.4, 0.35, '#7a4b25', O({ at: [s * (W / 2 + 0.2), 1.1, z0 - 0.4] }))),
      lab.box(W + 0.9, 0.3, 0.3, '#7a4b25', O({ at: [0, 2.2, z0 - 0.4] })),
    ]);
    // нити станка — тонкие золотые полосы под плитками
    const thr = lab.instances(new T.BoxGeometry(0.05, 0.02, D - 0.4), lab.mat('#ffd23f', { glow: 0.2 }), st.len + 1, { shadow: false });
    for (let i = 0; i <= st.len; i++) lab.place(thr, i, [(i - st.len / 2) * this.PITCH, 0.42, zc]);
    const geo = new T.BoxGeometry(this.TILE, 0.32, this.TILE), gplane = new T.PlaneGeometry(this.TILE * 0.9, this.TILE * 0.9);
    st.tiles = [];
    for (let r = 0; r < st.tries; r++) {
      const row = [];
      for (let i = 0; i < st.len; i++) {
        const node = lab.group({ at: this.at(i, r, 0.6) });
        const mesh = lab.mesh(geo, this.mats.empty, { parent: node });
        const glyph = lab.mesh(gplane, lab.mat('#ffffff', { unlit: true }), { parent: node, at: [0, 0.17, 0], rot: [-Math.PI / 2, 0, 0], shadow: false });
        glyph.visible = false;
        row.push({ node, mesh, glyph, sym: -1, state: 'empty', hop: 0, flipped: false });
      }
      st.tiles.push(row);
    }
    // рамка-курсор: светится вокруг текущей клетки
    st.cursor = lab.mesh(new T.RingGeometry(1.15, 1.32, 4, 1), lab.mat('#ffd23f', { glow: 1.2, unlit: true, side: 'double' }), { at: this.at(0, 0, 0.82), rot: [-Math.PI / 2, 0, Math.PI / 4], shadow: false });
    st.rowGlow = lab.mesh(new T.PlaneGeometry(W - 0.2, this.PITCH * 0.98), lab.mat('#fff1a8', { alpha: 0.18, unlit: true, glow: 0.2 }), { at: this.at((st.len - 1) / 2, 0, 0.43), rot: [-Math.PI / 2, 0, 0], shadow: false });
    // полка знаков (как клавиатура у донора): цвет — что ты знаешь о знаке
    st.shelf = [];
    const sp = 1.55, sz = this.at(0, st.tries - 1)[2] + this.PITCH + 1.4;
    lab.merge([lab.box(st.kinds * sp + 0.8, 0.3, 1.9, '#7a4b25', O({ at: [0, 0.15, sz], round: 0.08 }))]);
    for (let k = 0; k < st.kinds; k++) {
      const node = lab.group({ at: [(k - (st.kinds - 1) / 2) * sp, 0.42, sz] });
      const mesh = lab.mesh(new T.BoxGeometry(1.3, 0.22, 1.3), this.mats.empty, { parent: node });
      const glyph = lab.mesh(gplane, lab.mat('#ffffff', { unlit: true }), { parent: node, at: [0, 0.12, 0], rot: [-Math.PI / 2, 0, 0], scale: 0.72, shadow: false });
      const t = { node, mesh, glyph, sym: k }; this.setGlyph(lab, t, k);
      st.shelf.push(t);
    }
    st.shelfOn = c.shelf > 0;
    st.shelf.forEach(t => { t.node.visible = st.shelfOn; });
    // фишки «на месте / не на месте» для режима «только числа»
    st.pegList = [];
    const pg = new T.SphereGeometry(0.17, 8, 6);
    for (let r = 0; r < st.tries; r++) for (let i = 0; i < 6; i++) { const m = lab.mesh(pg, this.mats.pegHalf, { shadow: false }); m.visible = false; st.pegList.push({ row: r, mesh: m }); }
    // ковёр дня: разворачивается за станком
    st.carpet = lab.group({ at: [0, 6.6, z0 - 1.2] });
    st.carpetPlane = lab.mesh(new T.PlaneGeometry(st.len * 2 + 1.4, 4.6), lab.mat('#c8323c'), { parent: st.carpet, at: [0, -2.3, 0], shadow: false });
    st.carpet.scale.y = 0.02;
    lab.merge([lab.cyl(0.18, 0.18, st.len * 2 + 2.2, '#7a4b25', O({ at: [0, 6.6, z0 - 1.2], rot: [0, 0, Math.PI / 2] }))]);
  },
  paintShelf(lab) {
    const st = lab.state;
    if (!st.color) return;
    st.shelf.forEach((t, k) => { const v = st.known[k]; t.mesh.material = v == null ? this.mats.empty : this.mats[['gray', 'yellow', 'green'][v]]; });
  },
  carpetTexture(lab, failed) {
    const T = lab.THREE, st = lab.state, w = 128 * st.len + 160, h = 300, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const x = cv.getContext('2d');
    x.fillStyle = failed ? '#5a4b52' : '#b8232f'; x.fillRect(0, 0, w, h);
    x.strokeStyle = failed ? '#8a7b80' : '#ffd23f'; x.lineWidth = 10; x.strokeRect(14, 14, w - 28, h - 28);
    for (let i = 0; i < w; i += 28) { x.fillStyle = failed ? '#7a6b70' : '#ffd23f'; x.beginPath(); x.moveTo(i, 30); x.lineTo(i + 14, 44); x.lineTo(i + 28, 30); x.fill(); x.beginPath(); x.moveTo(i, h - 30); x.lineTo(i + 14, h - 44); x.lineTo(i + 28, h - 30); x.fill(); }
    st.answer.forEach((k, i) => { x.save(); x.globalAlpha = failed ? 0.75 : 1; x.drawImage(this.glyphTex(lab, k).image, 80 + i * 128, 86, 128, 128); x.restore(); });
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; return tex;
  },
  unroll(lab, failed) {
    const st = lab.state, T = lab.THREE;
    st.carpetPlane.material = new T.MeshStandardMaterial({ map: this.carpetTexture(lab, failed), flatShading: true, side: T.DoubleSide, emissive: new T.Color('#ffffff'), emissiveIntensity: 0.12, emissiveMap: null });
    lab.tween(0.9, k => { st.carpet.scale.y = 0.02 + 0.98 * k; }, 'outBack');
    lab.noise(0.5, 0.05, 900);
  },
  world(lab) {
    const T = lab.THREE, st = lab.state, O = x => Object.assign({ parent: null }, x);
    lab.ground({ w: 120, h: 110, color: '#7cc35a', bumps: 1.6, flat: 0.42 });
    // плитки двора: дорожка из камней под станком
    const pave = lab.instances(new T.CylinderGeometry(0.7, 0.8, 0.08, 7), '#c9b98f', 26, { shadow: false });
    for (let i = 0; i < 26; i++) { const a = lab.rand(0, 6.28), r = lab.rand(10, 16); lab.place(pave, i, [Math.cos(a) * r * 1.1, 0.03, Math.sin(a) * r * 0.75 - 3], { rot: lab.rand(0, 3), scale: lab.rand(0.5, 0.9), color: lab.pick(['#b8d68a', '#cfe39b', '#a7c97a']) }); }
    // пятна травы двух оттенков — земля не одной плоскостью
    const patch = lab.instances(new T.CircleGeometry(2.4, 7), lab.mat('#ffffff'), 30, { shadow: false });
    for (let i = 0; i < 30; i++) { const a = lab.rand(0, 6.28), r = lab.rand(6, 28); lab.place(patch, i, [Math.cos(a) * r * 1.2, 0.02, Math.sin(a) * r * 0.9], { rot: [-Math.PI / 2, 0, lab.rand(0, 3)], scale: lab.rand(0.6, 1.6), color: lab.pick(['#6cb34c', '#8bd068', '#74bb52']) }); }
    // горы и снежные шапки
    const mts = [];
    for (let i = 0; i < 9; i++) { const a = -1.2 + i * 0.3, r = lab.rand(10, 16), h = lab.rand(14, 24), x = Math.sin(a) * 62, z = -48 - Math.cos(a) * 10; mts.push(lab.cone(r, h, '#8a9bd6', O({ at: [x, h / 2 - 2, z], sides: 6, rot: lab.rand(0, 3) })), lab.cone(r * 0.35, h * 0.35, '#f4f6ff', O({ at: [x, h - 2 - h * 0.17, z], sides: 6 }))); }
    lab.noShadow(lab.merge(mts));
    // сакля мастерицы и навес
    lab.merge([
      lab.box(7, 3.4, 4.6, '#f2e6cf', O({ at: [-15, 1.7, -10] })), lab.cone(5.6, 2.6, '#a4552b', O({ at: [-15, 4.6, -10], sides: 4, rot: Math.PI / 4, scale: [1, 1, 0.72] })),
      lab.box(1.2, 2, 0.1, '#6b3d1e', O({ at: [-14, 1, -7.66] })), lab.box(1.1, 1, 0.1, '#5fd3ff', O({ at: [-16.6, 2, -7.66], glow: 0.2 })),
      lab.box(6, 2.8, 4, '#efe0c4', O({ at: [15, 1.4, -11] })), lab.cone(4.8, 2.2, '#a4552b', O({ at: [15, 3.9, -11], sides: 4, rot: Math.PI / 4, scale: [1, 1, 0.72] })),
    ]);
    // плетень по кругу и ковры прошлых дней на нём
    const N = 34, posts = lab.instances(new T.CylinderGeometry(0.1, 0.12, 1.6, 5), '#6b4a30', N), wattle = lab.instances(new T.BoxGeometry(2.2, 0.9, 0.18), '#a87b4b', N);
    for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2, x = Math.cos(a) * 19, z = Math.sin(a) * 15 - 1; if (z > 8 && Math.abs(x) < 9) continue; lab.place(posts, i, [x, 0.8, z]); lab.place(wattle, i, [x, 0.75, z], { rot: -a + Math.PI / 2 }); }
    st.oldCarpets = [];
    const oc = [['#2f6fb5', '#ffd23f'], ['#3a8a4a', '#fff1a8'], ['#7a2f8a', '#ffb547']];
    oc.forEach(([a, b], i) => {
      const cv = document.createElement('canvas'); cv.width = 96; cv.height = 64; const x = cv.getContext('2d'); x.fillStyle = a; x.fillRect(0, 0, 96, 64); x.strokeStyle = b; x.lineWidth = 5; x.strokeRect(5, 5, 86, 54);
      for (let k = 0; k < 4; k++) { x.fillStyle = b; x.beginPath(); x.moveTo(16 + k * 21, 32); x.lineTo(24 + k * 21, 22); x.lineTo(32 + k * 21, 32); x.lineTo(24 + k * 21, 42); x.fill(); }
      const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
      const m = lab.mesh(new T.PlaneGeometry(3, 2), new T.MeshStandardMaterial({ map: tex, side: T.DoubleSide, flatShading: true }), { at: [-12 + i * 12, 1.6, -15.6], shadow: false });
      st.oldCarpets.push(m);
    });
    // деревья (яблони), цветы, кочки
    const NT = 18, crown = lab.instances(new T.IcosahedronGeometry(1.5, 0), '#4f9c3a', NT), trunk = lab.instances(new T.CylinderGeometry(0.22, 0.3, 1.6, 6), '#6b4a30', NT), apples = lab.instances(new T.SphereGeometry(0.17, 6, 4), lab.mat('#ff4d4d', { glow: 0.2 }), NT * 4, { shadow: false });
    for (let i = 0; i < NT; i++) { const a = lab.rand(Math.PI * 1.05, Math.PI * 1.95) + (i % 3 === 0 ? lab.rand(-0.9, 0.9) : 0), r = lab.rand(22, 34), x = Math.cos(a) * r * 1.15, z = Math.min(4, Math.sin(a) * r * 0.8 - 6), s = lab.rand(0.8, 1.3); lab.place(trunk, i, [x, 0.8 * s, z], { scale: s }); lab.place(crown, i, [x, 2.4 * s, z], { scale: s, rot: lab.rand(0, 3) }); for (let k = 0; k < 4; k++) lab.place(apples, i * 4 + k, [x + lab.rand(-1, 1) * s, 2.2 * s + lab.rand(-0.6, 0.6), z + lab.rand(-1, 1) * s]); }
    const fl = lab.instances(new T.IcosahedronGeometry(0.16, 0), lab.mat('#ffffff', { glow: 0.15 }), 140, { shadow: false });
    for (let i = 0; i < 140; i++) { const a = lab.rand(0, 6.28), r = lab.rand(13, 30); lab.place(fl, i, [Math.cos(a) * r * 1.2, 0.15, Math.sin(a) * r * 0.9], { color: lab.pick(['#ff6f91', '#ffd23f', '#ffffff', '#b38cff', '#ff9f43']) }); }
    const tuft = lab.instances(new T.ConeGeometry(0.22, 0.6, 4), '#4f9c3a', 70, { shadow: false });
    for (let i = 0; i < 70; i++) { const a = lab.rand(0, 6.28), r = lab.rand(12, 26); lab.place(tuft, i, [Math.cos(a) * r * 1.2, 0.25, Math.sin(a) * r * 0.9], { rot: lab.rand(0, 3) }); }
    // клубки шерсти у станка — живая мелочь
    st.balls = [0, 1, 2, 3].map(i => lab.ball(0.42, ['#ff5d6e', '#ffd23f', '#5fe0ff', '#7cf5a8'][i], { at: [10.2 + (i % 2) * 1, 0.42, -2 + i * 1.3], detail: 1 }));
    st.clouds = [0, 1, 2, 3, 4].map(i => { const cl = lab.noShadow(lab.merge([[0, 0, 2.4], [2, -0.4, 1.7], [-2, -0.4, 1.6]].map(([x, y, r]) => lab.ball(r, lab.mat('#ffffff', { glow: 0.1 }), O({ at: [x, y, 0], scale: [1, 0.7, 0.8] }))))); cl.position.set(-40 + i * 20, 17 + lab.rand(0, 4), -40 + lab.rand(-6, 6)); return cl; });
  },
  weaver(lab) {
    const O = x => Object.assign({ parent: null }, x), node = lab.group(), pose = lab.group({ parent: node, scale: 1.25 });
    lab.merge([
      lab.cone(0.72, 1.5, '#e63946', O({ at: [0, 0.78, 0], sides: 8 })), // платье
      lab.box(0.56, 0.5, 0.36, '#b61f2e', O({ at: [0, 1.32, 0], round: 0.08 })),
      lab.ball(0.3, '#f2c9a0', O({ at: [0, 1.82, 0], detail: 1 })),
      lab.cone(0.36, 0.5, '#fff6e0', O({ at: [0, 2.05, -0.04], sides: 8 })), // платок
      lab.box(0.12, 0.6, 0.12, '#fff6e0', O({ at: [0, 1.6, -0.3] })),
    ], pose);
    lab.merge([lab.ball(0.06, '#15151c', O({ at: [0.1, 1.86, 0.26], detail: 0 })), lab.ball(0.06, '#15151c', O({ at: [-0.1, 1.86, 0.26], detail: 0 }))], pose);
    const arm = lab.group({ parent: pose, at: [0.3, 1.4, 0] });
    lab.box(0.12, 0.6, 0.12, '#e63946', { parent: arm, at: [0, -0.25, 0.1], rot: [0.7, 0, 0] });
    const ring = lab.mesh(new lab.THREE.RingGeometry(0.62, 0.8, 20), lab.mat('#ffd23f', { glow: 0.6, unlit: true, side: 'double' }), { parent: node, at: [0, 0.05, 0], rot: [-Math.PI / 2, 0, 0], shadow: false });
    return { node, pose, arm, ring };
  },
  hudLines(lab) {
    const st = lab.state, c = lab.cfg;
    lab.hud('day', `${st.daily ? 'Узор дня · ' + this.dayName(st.day) : st.practice ? 'Тренировка · узор дня уже разгадан' : 'Новый узор'} · попытка ${Math.min(st.row + 1, st.tries)} из ${st.tries}`, { color: st.row === st.tries - 1 ? '#ff8a8a' : '#fff1a8', size: 18 });
    lab.hud('keys', `← → клетка · ↑ ↓ знак (${st.guess[st.col] >= 0 ? this.SYMBOLS[st.guess[st.col]].name : 'пусто'}) · Пробел — проверить · B — ${c.hint > 0 ? 'подсказка −150' : 'стереть'}`, { color: '#bfe9ff', size: 13 });
    lab.hud('mode', !st.color ? 'Только числа: ● — знак на месте, ○ — есть, но не тут. Какой именно — гадай сам' : c.hard > 0 ? 'Сложный режим: зелёное держи на месте, жёлтое — в ряду' : null, { color: '#ffd9a8', size: 13 });
    if (c.timer > 0) lab.hud('timer', `⏱ ${Math.max(0, Math.ceil(c.timer - st.moveT))} с на ход`, { color: c.timer - st.moveT < 5 ? '#ff8a8a' : '#ffffff', size: 16 }); else lab.hud('timer', null);
    if (c.race > 0) lab.hud('race', `🏁 ${Math.floor(lab.t)} с — быстрее значит больше очков`, { color: '#7cf5a8', size: 14 }); else lab.hud('race', null);
  },
  animate(lab, dt) {
    const st = lab.state, t = lab.t;
    if (!st.tiles) return;
    const cur = this.at(st.col, Math.min(st.row, st.tries - 1), 0.82);
    st.cursor.position.x = lab.damp(st.cursor.position.x, cur[0], 20, dt); st.cursor.position.z = lab.damp(st.cursor.position.z, cur[2], 20, dt);
    st.cursor.visible = !st.over; st.cursor.scale.setScalar(1 + Math.sin(t * 6) * 0.04);
    const rg = this.at((st.len - 1) / 2, Math.min(st.row, st.tries - 1), 0.43);
    st.rowGlow.position.z = lab.damp(st.rowGlow.position.z, rg[2], 12, dt); st.rowGlow.visible = !st.over;
    st.rowGlow.material.color.set(st.row === st.tries - 1 ? '#ff8a8a' : '#fff1a8');
    // мастерица ходит вдоль своего ряда и показывает рукой на клетку
    const hp = this.at(-1.25, Math.min(st.row, st.tries - 1));
    const h = st.hero;
    h.node.position.x = lab.damp(h.node.position.x, hp[0] - 0.4, 6, dt); h.node.position.z = lab.damp(h.node.position.z, hp[2], 6, dt);
    h.node.rotation.y = lab.damp(h.node.rotation.y, Math.PI / 2, 8, dt);
    h.pose.scale.y = 1.25 * (1 + Math.sin(t * 2.4) * 0.02);
    h.arm.rotation.x = -0.6 + Math.sin(t * 3) * 0.08; h.ring.rotation.z += dt;
    // ряд трясётся, если неполный
    const shake = st.shakeT > 0 ? Math.sin(st.shakeT * 50) * 0.25 * st.shakeT : 0; st.shakeT = Math.max(0, st.shakeT - dt);
    st.tiles.forEach((row, r) => row.forEach((tile, i) => {
      const p = this.at(i, r, 0.6);
      tile.hop = Math.max(0, tile.hop - dt * 2.2);
      tile.node.position.y = p[1] + Math.sin(tile.hop * Math.PI) * 0.9;
      tile.node.position.x = p[0] + (r === st.row ? shake : 0);
    }));
    if (st.shelf) st.shelf.forEach((s, k) => { s.node.position.y = 0.42 + (st.guess[st.col] === k ? 0.25 + Math.sin(t * 6) * 0.05 : 0); });
    st.balls.forEach((b, i) => { b.rotation.y += dt * (0.4 + i * 0.2); b.position.y = 0.42 + Math.abs(Math.sin(t * 1.3 + i)) * 0.08; });
    st.oldCarpets.forEach((m, i) => { m.rotation.x = Math.sin(t * 1.1 + i) * 0.05; });
    st.clouds.forEach(cl => { cl.position.x += dt * 0.6; if (cl.position.x > 60) cl.position.x = -60; });
  },
};
