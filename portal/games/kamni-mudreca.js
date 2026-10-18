// «Камни мудреца» — ремейк-донор урока 2 по мотивам механики «Крестики-нолики» на оболочке «Лаб3D 1.0» (three.js).
// Пошаговая игра на поле 3 × 3 с ботом: ход игрока курсором, ход мудреца по перебору (минимакс), матч из нескольких партий.
// Секрет донора — неопределённость исхода. В классике мудрец не ошибается, и исход известен заранее: при точной игре — ничья.
// Одно правило (ручка «Секрет: одно правило») делает игру слишком большой для полного расчёта, и исход снова открыт.
// Из лучших игр жанра: весы исхода — шкала оценки, как у шахматного движка; светится «две в ряд» и «вилка», как в «Четыре в ряд»;
// мудрец сначала показывает лунку лучом, как враги в Into the Breach; победная линия — замедление, наезд камеры и звон по нарастающей.
// Ось Z в three.js смотрит на игрока: дальний ряд доски и мудрец — в −Z, «вверх по экрану».
const GAME = {
  engine: 'three',
  title: 'Камни мудреца',
  subtitle: 'Три камня в ряд против мудреца с плато Лаго-Наки. Он не ошибается — пока в игре нет одного правила.',
  donor: 'Крестики-нолики',
  players: 1,
  pace: 'turns', // пошаговая: бот-плейтестер не ждёт угрозы без хода игрока
  controls: [
    { input: 'move4', text: 'выбрать лунку' },
    { input: 'a', text: 'положить камень' },
  ],
  camera: { type: 'iso', tilt: 0.98, target: [0, 0, -1.6] },
  field: { w: 12.5, h: 13 },
  sky: ['#5fa9e6', '#ffe1b3'],
  fog: 0.007,
  accent: '#ffd23f',
  decisions: [
    'Чувство: азарт «а вдруг выиграю», который пропадает в решённой игре и возвращается с одним правилом',
    'Честность: камень, который исчезнет следующим, заранее дрожит в красном круге, ветер показан стрелкой и призраком, весы показывают, что видит мудрец',
    'Выбор: занять центр сейчас или сберечь камень, который скоро исчезнет',
  ],
  config: {
    vs: { value: 0, min: 0, max: 1, step: 1, label: 'Соперник', hint: '0 — мудрец, 1 — друг за этим же экраном: ходите по очереди', restart: true },
    rule: { value: 1, min: 0, max: 2, step: 1, label: 'Секрет: одно правило', hint: '0 — классика: исход известен заранее; 1 — старые камни исчезают; 2 — ветер сдвигает камни', restart: true, names: ['классика', 'исчезающие камни', 'ветер с Фишта'] },
    keep: { value: 3, min: 2, max: 5, step: 1, label: 'Правило 1: камней у каждого', hint: 'Кладёшь лишний — самый старый твой камень исчезает', restart: true },
    wind: { value: 0.6, min: 0, max: 1, step: 0.05, label: 'Правило 2: доля ходов с ветром' },
    depth: { value: 9, min: 1, max: 9, step: 1, label: 'Мудрость: на сколько ходов вперёд считает', hint: 'В классике 9 — до конца игры. С правилом 1 мудрец видит не дальше 4 ходов, с ветром — 3' },
    mistake: { value: 0, min: 0, max: 0.6, step: 0.05, label: 'Мудрец ошибается: доля случайных ходов' },
    oracle: { value: 1, min: 0, max: 1, step: 1, label: 'Весы исхода: что видит мудрец', hint: 'Шкала у края доски: камень на весах уходит к тому, кто победит при точной игре. Замок — исход известен' },
    threats: { value: 1, min: 0, max: 1, step: 1, label: 'Подсказка «две в ряд»', hint: 'Пустая лунка, где кто-то следующим ходом соберёт три, светится его цветом' },
    first: { value: 2, min: 0, max: 2, step: 1, label: 'Кто ходит первым', hint: '0 — ты, 1 — мудрец, 2 — по очереди' },
    turnTime: { value: 0, min: 0, max: 15, step: 1, label: 'Время на ход, с', hint: '0 — без ограничения' },
    think: { value: 0.7, min: 0.1, max: 2, step: 0.1, label: 'Мудрец думает, с' },
    cap: { value: 30, min: 12, max: 60, step: 2, label: 'Правило 1: ничья после ходов' },
    games: { value: 5, min: 1, max: 9, step: 1, label: 'Партий в матче', restart: true },
    lives: { value: 3, min: 1, max: 9, step: 1, label: 'Жизни (поражение — минус жизнь)', restart: true },
    win: { value: 100, min: 10, max: 300, step: 10, label: 'Очки за победу' },
    draw: { value: 25, min: 0, max: 100, step: 5, label: 'Очки за ничью' },
    fork: { value: 20, min: 0, max: 100, step: 5, label: 'Очки за вилку (две угрозы разом)' },
  },
  presets: {
    'Новичок': { depth: 2, mistake: 0.25, first: 0, lives: 5, think: 0.9 },
    'Без секрета': { rule: 0 },
    'Ветер с Фишта': { rule: 2 },
    'Безумие': { rule: 1, keep: 2, turnTime: 3, think: 0.2 },
    'Вдвоём': { vs: 1 },
  },
  notes: [
    'Весы исхода считают тем же перебором, что и мудрец: в классике он видит игру до конца, с правилом — на несколько ходов',
    'Камень мудреца летит из посоха по дуге: видно, кто и куда сходил',
  ],

  CELL: 2.3, // шаг лунок, м
  TOP: 1.0,  // высота плиты-доски
  LINES: [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]],
  WINDS: [{ d: [0, -1], name: 'к мудрецу', arrow: '↑' }, { d: [0, 1], name: 'к тебе', arrow: '↓' }, { d: [-1, 0], name: 'влево', arrow: '←' }, { d: [1, 0], name: 'вправо', arrow: '→' }],
  SUN: ['#ffd23f', '#fff3a0', '#ff9f1c'],
  MOON: ['#5fa8ff', '#8fe3ff', '#ffffff'],

  // ---------- новая партия: мир и матч ----------
  start(lab, scene) {
    const st = lab.state;
    Object.assign(st, { game: 0, wins: 0, draws: 0, losses: 0, secretHits: 0, timeouts: 0, forks: 0, blocks: 0, sageBlocks: 0,
      known: [], lengths: [], stones: [], cursor: 4, repeat: 0, zoomK: 0, zoomWas: false, windT: 0, scaleX: 0, mood: '' });
    this.assets(lab);
    this.scenery(lab, scene);
    this.buildTable(lab);
    this.buildSage(lab);
    this.buildMarkers(lab);
    this.buildScales(lab);
    st.camT = lab.view.target.clone(); st.camBase = lab.view.distance; st.zoomAt = lab.v3(0, 0, 0);
    lab.hero(st.cursorMesh);
    this.newGame(lab);
  },

  // ---------- каждый кадр ----------
  update(lab, dt) {
    const st = lab.state, cfg = lab.cfg, duel = Math.round(cfg.vs) === 1;
    if (st.phase === 'turn' && (st.turn === 1 || duel)) this.playerTurn(lab, dt);
    else if (st.phase === 'turn') {
      st.t -= dt;
      if (st.t <= 0) { st.target = this.botMove(lab); st.phase = 'aim'; st.t = 0.45; this.showAim(lab, st.target); }
    } else if (st.phase === 'aim') {
      st.t -= dt;
      this.updateBeam(lab);
      if (st.t <= 0) { this.hideAim(lab); this.place(lab, st.target, 2); }
    } else if (st.phase === 'anim') {
      st.t -= dt;
      if (st.t <= 0) this.afterMove(lab);
    } else if (st.phase === 'end') {
      st.t -= dt;
      if (st.t <= 0) {
        if (st.game >= Math.round(cfg.games)) lab.win(`Матч сыгран: ${st.wins} ${this.plural(st.wins, 'победа', 'победы', 'побед')}, ${st.draws} ${this.plural(st.draws, 'ничья', 'ничьи', 'ничьих')}`);
        else this.newGame(lab);
      }
    }
    this.animateWorld(lab, dt);
    this.updateMarkers(lab, dt);
    this.updateScales(lab, dt);
    this.updateCamera(lab);
    const games = Math.round(cfg.games), rule = Math.round(cfg.rule);
    lab.hud('game', `Партия ${Math.min(st.game, games)} из ${games} · ${st.wins} : ${st.losses} · ничьих ${st.draws}`);
    lab.hud('rule', ['Правило: классика', `Правило: у каждого не больше ${Math.round(cfg.keep)} камней`, 'Правило: ветер с Фишта'][rule]);
    const clock = cfg.turnTime > 0 ? ` · ${Math.ceil(Math.max(0, st.clock))} с` : '';
    lab.hud('turn', st.phase === 'end' ? st.resultText : duel ? (st.turn === 1 ? 'Ходят солнца (игрок 1)' : 'Ходят луны (игрок 2)') + clock : st.turn === 1 ? 'Твой ход' + clock : 'Мудрец думает…');
    lab.hud('wind', rule === 2 && st.phase !== 'end' ? (st.wind ? `Ветер ${st.wind.arrow} ${st.wind.name}` : 'Безветрие') : null);
    lab.hud('oracle', cfg.oracle && st.phase !== 'end' ? this.oracleText(lab) : null);
  },

  overNote(lab) {
    const st = lab.state, rule = Math.round(lab.cfg.rule), n = st.wins + st.draws + st.losses, notes = [];
    const duel = Math.round(lab.cfg.vs) === 1;
    if (duel) notes.push(`Партий: ${n} · солнца ${st.wins} : ${st.losses} луны · ничьих ${st.draws}`);
    else notes.push(`Партий: ${n} · побед ${st.wins} · ничьих ${st.draws} · поражений ${st.losses}`);
    const avg = list => list.length ? Math.round(10 * list.reduce((a, b) => a + b, 0) / list.length) / 10 : 0;
    if (rule === 0) notes.push(duel ? 'Классика решена: кто знает, как не проиграть, всегда сведёт партию вничью.' : 'Исход каждой партии был известен с первого хода: при точной игре — ничья. Мудрец просчитал игру до конца.');
    else if (st.known.length) notes.push(`Исход становился известен в среднем на ходу ${avg(st.known)} из ${avg(st.lengths)}: до этого игра была открыта`);
    if (rule === 1) notes.push(`Секрет сработал ${st.secretHits} раз: старые камни исчезали`);
    if (rule === 2) notes.push(`Секрет сработал ${st.secretHits} раз: ветер сдвигал камни`);
    if (rule === 0 && n && st.draws === n) notes.push('Все партии — ничьи. Решённая игра: что бы ты ни делал, исход известен заранее.');
    if (rule === 0 && !duel && lab.cfg.mistake > 0) notes.push('Мудрец иногда ошибался — неопределённость принесла его ошибка, а не правило');
    if (st.forks || st.blocks || st.sageBlocks) notes.push(`Вилок: ${st.forks} · ты закрыл линий: ${st.blocks} · ${duel ? 'луны' : 'мудрец'} закрыл${duel ? 'и' : ''}: ${st.sageBlocks}`);
    if (st.timeouts) notes.push(`Ход по таймеру сделан за тебя ${st.timeouts} раз`);
    return notes;
  },

  // ---------- партия ----------
  newGame(lab) {
    const st = lab.state, cfg = lab.cfg;
    st.stones.forEach((g, i) => lab.after(i * 0.04, () => { // старые камни взлетают и тают
      const y0 = g.position.y;
      lab.tween(0.32, k => { g.position.y = y0 + k * 2.2; g.scale.setScalar(Math.max(0.01, 1 - k)); g.rotation.y += 0.2; }, 'inQuad');
      lab.after(0.33, () => g.removeFromParent());
    }));
    st.stones = [];
    st.meshAt = new Array(9).fill(null);
    st.pos = { b: new Array(9).fill(0), q: [null, [], []], ply: 0 };
    st.game++;
    st.knownAt = null; st.mood = ''; st.last = -1;
    const first = Math.round(cfg.first);
    st.turn = first === 2 ? (st.game % 2 ? 1 : 2) : first === 0 ? 1 : 2;
    if (st.line.visible) { const s = st.line.scale.x; lab.tween(0.25, k => { st.line.scale.x = Math.max(0.01, s * (1 - k)); }); lab.after(0.26, () => { st.line.visible = false; }); }
    lab.popup(lab.v3(0, 3.4, 0), `Партия ${st.game}`, '#ffffff', 28);
    const duel = Math.round(cfg.vs) === 1;
    lab.after(0.35, () => lab.popup(lab.v3(0, 2.6, 0), duel ? (st.turn === 1 ? 'Первыми — солнца' : 'Первыми — луны') : st.turn === 1 ? 'Ты ходишь первым' : 'Мудрец ходит первым', st.turn === 1 ? '#ffe680' : '#a8dcff', 18));
    lab.tone(392, 0.12, 'triangle', 0.06); lab.tone(587, 0.16, 'triangle', 0.06, 0, 0.1);
    this.beginTurn(lab);
  },
  beginTurn(lab) {
    const st = lab.state, cfg = lab.cfg;
    st.phase = 'turn';
    st.wind = null;
    if (Math.round(cfg.rule) === 2 && lab.chance(cfg.wind)) { st.wind = lab.pick(this.WINDS); lab.sfx.whoosh(); lab.pulse(st.windArrow, 1.4, 0.2); }
    if (st.turn === 1 || Math.round(cfg.vs) === 1) { st.clock = cfg.turnTime; st.tick = Math.ceil(cfg.turnTime); }
    else st.t = cfg.think;
    this.evaluate(lab);
  },
  playerTurn(lab, dt) {
    const st = lab.state, p = lab.p1;
    let dx = 0, dy = 0;
    if (p.pressed.left) dx = -1; else if (p.pressed.right) dx = 1;
    if (p.pressed.up) dy = -1; else if (p.pressed.down) dy = 1;
    // зажатая стрелка или стик повторяют шаг курсора
    if (p.left || p.right || p.up || p.down) {
      st.repeat += dt;
      if (st.repeat > 0.38) { st.repeat = 0.26; dx = p.left ? -1 : p.right ? 1 : 0; dy = p.up ? -1 : p.down ? 1 : 0; }
    } else st.repeat = 0;
    if (dx || dy) {
      const r = lab.clamp(Math.floor(st.cursor / 3) + dy, 0, 2), c = lab.clamp(st.cursor % 3 + dx, 0, 2);
      if (r * 3 + c !== st.cursor) { st.cursor = r * 3 + c; lab.tone(520 + r * 40 + c * 20, 0.04, 'triangle', 0.04); lab.pulse(st.cursorMesh, 1.15, 0.1); }
    }
    if (p.pressed.a) {
      if (st.pos.b[st.cursor]) { lab.tone(140, 0.12, 'square', 0.05); lab.pulse(st.cursorMesh, 1.3, 0.15); lab.shake(0.08); lab.count('в занятую лунку'); }
      else { this.place(lab, st.cursor, st.turn); return; }
    }
    if (lab.cfg.turnTime > 0) {
      st.clock -= dt;
      if (st.clock < st.tick - 1 && st.tick <= 4 && st.clock > 0) lab.tone(st.tick <= 2 ? 1040 : 780, 0.05, 'square', 0.04); // последние секунды тикают
      if (st.clock < st.tick - 1) st.tick--;
      if (st.clock <= 0) { // время вышло: камень кладётся в случайную свободную лунку
        const free = st.pos.b.map((v, i) => v ? -1 : i).filter(i => i >= 0);
        st.timeouts++; lab.count('ходы по таймеру'); lab.sfx.warn();
        this.place(lab, lab.pick(free), st.turn);
      }
    }
  },

  // ---------- ход: камень, ветер, исчезновение ----------
  place(lab, cell, side) {
    const st = lab.state, cfg = lab.cfg, T = this.TOP, duel = Math.round(cfg.vs) === 1;
    const rule = Math.round(cfg.rule), res = this.step(st.pos, cell, side, st.wind, rule, Math.round(cfg.keep));
    const oppThreats = this.threats(st.pos.b, 3 - side);
    const g = this.makeStone(lab, side), from = this.cellPos(cell), to = this.cellPos(res.at);
    const rest = T + (side === 1 ? 0.17 : 0.6);
    g.rotation.y = lab.rand(0, 6.28);
    let fly = 0.16;
    if (side === 2 && !duel) { // камень мудреца летит из посоха по дуге
      const tip = st.tip.getWorldPosition(lab.v3());
      fly = 0.34;
      g.position.copy(tip);
      const tr = lab.trail(g, { color: '#8fe3ff', width: 0.45, length: 12 });
      lab.tween(fly, k => { g.position.set(lab.lerp(tip.x, from.x, k), lab.lerp(tip.y, rest, k) + Math.sin(k * Math.PI) * 1.6, lab.lerp(tip.z, from.z, k)); g.rotation.y += 0.3; }, 'inOutQuad');
      lab.after(fly + 0.2, () => tr.dispose());
      lab.tone(880, 0.12, 'sine', 0.05, 1500);
      lab.burst(tip, { count: 10, colors: this.MOON, speed: 4 });
    } else {
      const y0 = T + 0.75;
      g.position.set(from.x, y0, from.z);
      lab.tween(fly, k => { g.position.y = lab.lerp(y0, rest, k); }, 'inQuad');
    }
    lab.after(fly, () => this.land(lab, g, side, res.at, rest));
    let wait = fly + 0.2;
    if (res.at !== cell) { // ветер сдвинул камень — секрет сработал
      lab.after(fly + 0.08, () => {
        lab.sfx.whoosh();
        lab.tween(0.32, k => { g.position.x = lab.lerp(from.x, to.x, k); g.position.z = lab.lerp(from.z, to.z, k); g.rotation.x = Math.sin(k * Math.PI) * 0.5 * (to.z - from.z ? Math.sign(to.z - from.z) : 1); }, 'inOutCubic');
        lab.after(0.32, () => { lab.ring([to.x, T, to.z], { color: '#e8f7ff', radius: 1.3 }); lab.burst([to.x, T + 0.3, to.z], { count: 10, color: '#e8f7ff', speed: 3 }); });
        lab.popup([to.x, T + 1.6, to.z], 'Ветер!', '#e8f7ff', 20);
      });
      st.secretHits++; lab.count('_secret');
      wait = fly + 0.5;
    }
    st.meshAt[res.at] = g; st.stones.push(g); st.last = res.at;
    if (res.gone >= 0) { // старый камень исчезает — секрет сработал
      const old = st.meshAt[res.gone]; st.meshAt[res.gone] = null;
      if (old) lab.after(fly + 0.1, () => this.vanish(lab, old));
      st.secretHits++; lab.count('_secret');
      wait = Math.max(wait, fly + 0.5);
    }
    // лучшие моменты жанра: закрыть чужую линию и поставить вилку
    const win = this.winner(res.b);
    if (!win && oppThreats.includes(res.at) && res.b[res.at] === side) {
      if (side === 1) { st.blocks++; lab.count('закрытые линии'); } else { st.sageBlocks++; lab.count(duel ? 'луны закрыли' : 'мудрец закрыл'); }
      lab.after(wait, () => { lab.popup([to.x, T + 1.8, to.z], side === 1 ? 'Закрыл!' : duel ? 'Закрыли!' : 'Мудрец закрыл', side === 1 ? '#ffe680' : '#a8dcff', 22); lab.tone(side === 1 ? 784 : 330, 0.14, 'square', 0.05); });
    }
    if (!win && this.threats(res.b, side).length >= 2) {
      if (side === 1) { st.forks++; lab.count('вилки'); } else lab.count(duel ? 'вилки лун' : 'вилки мудреца');
      lab.after(wait, () => {
        lab.popup([to.x, T + 2.4, to.z], 'Вилка!', side === 1 ? '#ffd23f' : '#8fe3ff', 30);
        lab.slowmo(0.4, 0.4); lab.flash(side === 1 ? '#ffd23f' : '#5fa8ff', 0.15);
        lab.tone(659, 0.1, 'triangle', 0.08); lab.tone(988, 0.18, 'triangle', 0.08, 0, 0.08);
        if (side === 1 && lab.cfg.fork > 0) lab.addScore(lab.cfg.fork, [to.x, T + 1.2, to.z], '#ffd23f');
      });
      wait += 0.25;
    }
    st.pos = res;
    if (side === 1) lab.count('мои ходы');
    st.phase = 'anim'; st.t = wait;
  },
  land(lab, g, side, cell, rest) {
    const st = lab.state, p = this.cellPos(cell), ply = st.pos.ply;
    g.position.y = rest;
    lab.burst([p.x, this.TOP + 0.3, p.z], { count: 14, colors: side === 1 ? this.SUN : this.MOON, speed: 5, up: 1 });
    lab.ring([p.x, this.TOP, p.z], { color: side === 1 ? '#ffd23f' : '#8fe3ff', radius: 1.4 });
    const f = (side === 1 ? 660 : 392) * lab.pitch(Math.floor(ply / 2)); // доска заполняется — звон всё выше
    lab.tone(f, 0.1, 'triangle', 0.08, f * 1.5); lab.noise(0.05, 0.08, 2600);
    lab.shake(0.12); lab.vibrate(40, 0.3);
    lab.pulse(g, 1.3, 0.16);
  },
  vanish(lab, old) {
    const st = lab.state, y0 = old.position.y, p = old.position.clone();
    lab.whiten(old, 0.1, '#ff4d5e');
    lab.tone(240, 0.28, 'sine', 0.07, 80); lab.noise(0.18, 0.08, 900);
    lab.tween(0.34, k => { old.scale.setScalar(Math.max(0.01, 1 - k)); old.position.y = y0 + k * 1.2; old.rotation.y += 0.25; }, 'inQuad');
    lab.after(0.34, () => {
      lab.burst(p, { count: 18, colors: ['#c9ccd4', '#ffffff', '#ff8a8a'], speed: 4, up: 2 });
      lab.ring([p.x, this.TOP, p.z], { color: '#ff6b7a', radius: 1.2 });
      old.removeFromParent(); st.stones = st.stones.filter(x => x !== old);
    });
  },
  afterMove(lab) {
    const st = lab.state, cfg = lab.cfg;
    const w = this.winner(st.pos.b);
    const full = st.pos.b.every(Boolean) || (Math.round(cfg.rule) === 1 && st.pos.ply >= cfg.cap);
    if (!w && !full) { st.turn = 3 - st.turn; this.beginTurn(lab); return; }
    if (st.knownAt == null) st.knownAt = st.pos.ply;
    st.known.push(st.knownAt); st.lengths.push(st.pos.ply);
    st.phase = 'end'; st.t = 2.2;
    const duel = Math.round(cfg.vs) === 1, at = lab.v3(0, this.TOP + 1, 0);
    if (w) this.winLine(lab, this.LINES.find(l => l.every(i => st.pos.b[i] === w)), w);
    if (w === 1) {
      st.wins++; st.resultText = duel ? 'Солнца выиграли партию' : 'Победа!'; lab.count('победы');
      lab.after(0.45, () => { lab.addScore(cfg.win, lab.v3(0, 3.2, 0), '#ffd23f'); lab.sfx.win(); lab.flash('#ffd23f', 0.35); lab.shake(0.45);
        lab.burst(at, { count: 70, colors: this.SUN, speed: 11, up: 5, life: 1 }); this.say(lab, 'Не может быть!', true); });
    } else if (w === 2 && duel) { // вдвоём луны — второй игрок: его победа без потери жизни
      st.losses++; st.resultText = 'Луны выиграли партию'; lab.count('победы лун');
      lab.after(0.45, () => { lab.sfx.win(); lab.flash('#5fa8ff', 0.35); lab.shake(0.45); lab.burst(at, { count: 70, colors: this.MOON, speed: 11, up: 5, life: 1 }); });
    } else if (w === 2) {
      st.losses++; st.resultText = 'Мудрец выиграл партию'; lab.count('поражения');
      lab.after(0.45, () => { lab.burst(st.tip, { count: 30, colors: this.MOON, speed: 7, up: 3 }); this.say(lab, 'Так было предначертано.', true); lab.hurt(at, 'Мудрец забрал все жизни'); });
    } else {
      st.draws++; st.resultText = Math.round(cfg.rule) === 1 && !st.pos.b.every(Boolean) ? 'Ничья: ходы кончились' : 'Ничья';
      lab.count('ничьи'); lab.addScore(cfg.draw, lab.v3(0, 3, 0), '#bfe9ff');
      lab.tone(392, 0.3, 'triangle', 0.08); lab.tone(494, 0.3, 'triangle', 0.07, 0, 0.16); lab.tone(392, 0.4, 'triangle', 0.08, 0, 0.32);
      st.stones.forEach((g, i) => lab.after(i * 0.05, () => lab.pulse(g, 0.85, 0.2))); // камни разом «вздыхают»
      if (!duel && Math.round(cfg.rule) === 0) this.say(lab, 'Как я и говорил: ничья.', true);
    }
    const rule = Math.round(cfg.rule);
    if (st.known.length) lab.stat('исход известен с хода', rule === 0 ? 1 : Math.round(10 * st.known.reduce((a, b) => a + b, 0) / st.known.length) / 10);
  },
  // победная линия: камни звенят по очереди всё выше, линия прочерчивается, стоп-кадр, замедление, камера наезжает
  winLine(lab, line, side) {
    const st = lab.state, a = this.cellPos(line[0]), b = this.cellPos(line[2]), T = this.TOP;
    const len = Math.hypot(b.x - a.x, b.z - a.z) + 1.8, cols = side === 1 ? this.SUN : this.MOON;
    lab.hitstop(0.1); lab.slowmo(0.7, 0.45);
    line.forEach((c, k) => lab.after(0.08 + k * 0.12, () => {
      const m = st.meshAt[c], p = this.cellPos(c);
      if (m) { const y0 = m.position.y; lab.tween(0.3, q => { m.position.y = y0 + Math.sin(q * Math.PI) * 0.9; }); lab.pulse(m, 1.5, 0.22); }
      lab.tone((side === 1 ? 523 : 392) * lab.pitch(k * 4), 0.18, 'triangle', 0.1);
      lab.burst([p.x, T + 0.6, p.z], { count: 16, colors: cols, speed: 6, up: 2 });
    }));
    st.line.material = side === 1 ? st.sunLine : st.moonLine;
    st.line.visible = true; st.line.scale.x = 0.01;
    st.line.position.set((a.x + b.x) / 2, T + 0.9, (a.z + b.z) / 2);
    st.line.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    lab.after(0.1, () => lab.tween(0.4, k => { st.line.scale.x = Math.max(0.01, len * k); }, 'outCubic'));
    st.zoomAt.set((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
    lab.tween(0.5, k => { st.zoomK = k; }, 'outCubic');
    lab.after(1.5, () => lab.tween(0.6, k => { st.zoomK = 1 - k; }, 'inOutCubic'));
  },

  // ---------- правила и перебор (чистые функции позиции) ----------
  // позиция: b — 9 лунок (0 пусто, 1 солнца, 2 луны), q — очередь камней каждой стороны (старые первыми), ply — сделано ходов
  step(pos, cell, side, wind, rule, keep) {
    const b = pos.b.slice(), q = [null, pos.q[1].slice(), pos.q[2].slice()];
    let at = cell;
    if (wind) {
      const r = Math.floor(cell / 3) + wind.d[1], c = cell % 3 + wind.d[0];
      if (r >= 0 && r < 3 && c >= 0 && c < 3 && !b[r * 3 + c]) at = r * 3 + c;
    }
    b[at] = side; q[side].push(at);
    let gone = -1;
    if (rule === 1 && q[side].length > keep) { gone = q[side].shift(); b[gone] = 0; }
    return { b, q, ply: pos.ply + 1, at, gone };
  },
  winner(b) { for (const [x, y, z] of this.LINES) if (b[x] && b[x] === b[y] && b[x] === b[z]) return b[x]; return 0; },
  // пустые лунки, где сторона s следующим ходом соберёт три в ряд
  threats(b, s) {
    const out = [];
    for (const l of this.LINES) {
      const mine = l.filter(i => b[i] === s).length, empty = l.filter(i => !b[i]);
      if (mine === 2 && empty.length === 1 && !out.includes(empty[0])) out.push(empty[0]);
    }
    return out;
  },
  heur(b, s) { // оценка позиции без перебора: открытые линии своих камней минус чужих
    let v = 0;
    for (const l of this.LINES) {
      const mine = l.filter(i => b[i] === s).length, theirs = l.filter(i => b[i] === 3 - s).length;
      if (!theirs) v += mine * mine; if (!mine) v -= theirs * theirs;
    }
    return v;
  },
  // негамакс с отсечением; в правиле 2 следующий ветер неизвестен — берём среднее по всем ветрам
  search(pos, s, depth, alpha, beta, ctx) {
    ctx.nodes++;
    const w = this.winner(pos.b);
    if (w) return w === s ? 1000 - pos.ply : pos.ply - 1000;
    const free = [];
    for (let i = 0; i < 9; i++) if (!pos.b[i]) free.push(i);
    if (!free.length || (ctx.rule === 1 && pos.ply >= ctx.cap)) return 0;
    if (depth <= 0 || ctx.nodes > ctx.budget) return this.heur(pos.b, s);
    free.sort((a, b) => (b === 4) - (a === 4)); // центр первым — отсечения раньше
    let best = -Infinity;
    for (const m of free) {
      let v = 0;
      if (ctx.rule === 2) for (const [wd, pr] of ctx.winds) v += pr ? -pr * this.search(this.step(pos, m, s, wd, 2, 0), 3 - s, depth - 1, -Infinity, Infinity, ctx) : 0;
      else v = -this.search(this.step(pos, m, s, null, ctx.rule, ctx.keep), 3 - s, depth - 1, -beta, -alpha, ctx);
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta && ctx.rule !== 2) break;
    }
    return best;
  },
  // классика решается целиком: позиций меньше 6 тысяч, ответы запоминаются на всю игру
  solve(pos, s) {
    const memo = this.memo || (this.memo = {}), key = pos.b.join('') + s;
    if (key in memo) return memo[key];
    const w = this.winner(pos.b);
    let best;
    if (w) best = w === s ? 1000 - pos.ply : pos.ply - 1000;
    else if (pos.b.every(Boolean)) best = 0;
    else {
      best = -Infinity;
      for (let m = 0; m < 9; m++) if (!pos.b[m]) best = Math.max(best, -this.solve(this.step(pos, m, s, null, 0, 9), 3 - s));
    }
    return (memo[key] = best);
  },
  ctx(lab, budget) {
    const cfg = lab.cfg, rule = Math.round(cfg.rule), wc = cfg.wind;
    const winds = [[null, 1 - wc]].concat(this.WINDS.map(w => [w, wc / 4]));
    return { rule, keep: Math.round(cfg.keep), cap: cfg.cap, winds, nodes: 0, budget };
  },
  sight(lab, rule) { return Math.min(Math.round(lab.cfg.depth), rule === 2 ? 3 : rule === 1 ? 4 : 9); }, // с правилом игра слишком велика для расчёта до конца
  botMove(lab) {
    const st = lab.state, cfg = lab.cfg;
    const free = st.pos.b.map((v, i) => v ? -1 : i).filter(i => i >= 0);
    if (lab.chance(cfg.mistake)) { lab.count('ошибки мудреца'); return lab.pick(free); }
    const ctx = this.ctx(lab, 120000), depth = this.sight(lab, ctx.rule);
    let best = -Infinity, moves = [];
    for (const m of free) { // ход мудреца: ветер этого хода известен, дальше — среднее
      const next = this.step(st.pos, m, 2, st.wind, ctx.rule, ctx.keep);
      const v = ctx.rule === 0 && depth >= 9 ? -this.solve(next, 1) : -this.search(next, 1, depth - 1, -Infinity, Infinity, ctx);
      if (v > best + 1e-6) { best = v; moves = [m]; } else if (Math.abs(v - best) < 1e-6) moves.push(m);
    }
    return lab.pick(moves);
  },
  // весы исхода: что видит мудрец тем же перебором. В классике — всё (игра решена); с правилом — только вынужденную победу на несколько ходов
  evaluate(lab) {
    const st = lab.state, ctx = this.ctx(lab, 15000), depth = this.sight(lab, ctx.rule);
    let v;
    if (ctx.rule === 0 && depth >= 9) { v = this.solve(st.pos, st.turn); st.sure = true; }
    else { v = this.search(st.pos, st.turn, ctx.rule === 2 ? 2 : Math.min(5, depth), -Infinity, Infinity, ctx); st.sure = Math.abs(v) > 900; }
    if (st.turn === 2) v = -v; // весы — от лица солнц
    st.evalV = v;
    st.scaleTo = st.sure ? Math.sign(v) : Math.tanh(v / 6) * 0.6;
    if (st.sure && st.knownAt == null) st.knownAt = st.pos.ply + 1;
    // реплика мудреца, когда меняется то, что он видит
    const mood = !st.sure ? 'open' : v > 0 ? 'sun' : v < 0 ? 'moon' : 'draw';
    if (mood !== st.mood) {
      const was = st.mood; st.mood = mood;
      if (Math.round(lab.cfg.vs) !== 1) {
        if (mood === 'draw') this.say(lab, 'Я вижу исход: ничья.');
        else if (mood === 'moon') this.say(lab, lab.pick(['Вижу свою победу.', 'Ты уже проиграл.']));
        else if (mood === 'sun') this.say(lab, 'Хм… я проиграл?');
        else if (was === '' || was === 'draw') this.say(lab, 'Хм… не вижу конца.');
      }
      if (st.sure && was !== '' && lab.cfg.oracle) { lab.tone(196, 0.4, 'sine', 0.08, 147); lab.pulse(st.scaleGem, 1.6, 0.25); lab.ring(st.scaleGem, { color: v > 0 ? '#ffd23f' : v < 0 ? '#5fa8ff' : '#ffffff', radius: 1.2 }); }
    }
  },
  oracleText(lab) {
    const st = lab.state, duel = Math.round(lab.cfg.vs) === 1;
    if (!st.sure) return 'Весы: исход открыт';
    if (st.evalV === 0) return 'Весы: исход известен — ничья';
    return st.evalV > 0 ? 'Весы: солнца побеждают при точной игре' : duel ? 'Весы: луны побеждают при точной игре' : 'Весы: мудрец видит свою победу';
  },
  say(lab, text, force) {
    const st = lab.state;
    if (!force && lab.t - (st.saidAt || -9) < 1.2) return;
    st.saidAt = lab.t;
    lab.popup(st.head.getWorldPosition(lab.v3()).add(lab.v3(0, 1.3, 0)), text, '#e8f7ff', 18);
  },

  // ---------- оживление мира ----------
  animateWorld(lab, dt) {
    const st = lab.state, t = lab.t, duel = Math.round(lab.cfg.vs) === 1;
    const thinking = !duel && (st.phase === 'turn' && st.turn === 2 || st.phase === 'aim');
    // мудрец следит за курсором, качает головой, когда думает; кристалл посоха пульсирует
    const c = this.cellPos(st.cursor), look = st.phase === 'turn' && st.turn === 1 ? Math.atan2(c.x, c.z + 6.3) * 0.8 : 0;
    st.head.rotation.y = lab.damp(st.head.rotation.y, thinking ? Math.sin(t * 2.2) * 0.35 : look, 6, dt);
    st.head.rotation.x = thinking ? Math.sin(t * 5) * 0.1 : lab.damp(st.head.rotation.x, 0.12, 6, dt);
    st.tip.scale.setScalar(thinking ? 1 + Math.sin(t * 12) * 0.25 : 1);
    st.tip.rotation.y += dt * (thinking ? 6 : 1.5);
    st.body.scale.y = 1 + Math.sin(t * 1.6) * 0.012; // дышит
    // овцы пасутся
    st.sheep.forEach((s, i) => {
      s.a += Math.sin(t * 0.3 + i * 1.7) * dt * 0.3;
      const hop = Math.abs(Math.sin(t * 2 + i)) * 0.05;
      lab.place(st.wool, i, [s.x, hop, s.z], { rot: s.a });
      lab.place(st.dark, i, [s.x, hop, s.z], { rot: s.a });
    });
    // ветер: стрелка над доской дует и гонит по доске струи
    const w = Math.round(lab.cfg.rule) === 2 && st.phase !== 'end' ? st.wind : null;
    st.windArrow.visible = !!w;
    if (w) {
      st.windArrow.rotation.y = Math.atan2(w.d[0], w.d[1]);
      const k = 0.4 * Math.sin(t * 4);
      st.windArrow.position.set(w.d[0] * k, this.TOP + 2.6, w.d[1] * k);
      if ((st.windT -= dt) <= 0) {
        st.windT = 0.09;
        const side = lab.rand(-4, 4), x = w.d[0] ? -w.d[0] * 4.5 : side, z = w.d[1] ? -w.d[1] * 4.5 : side;
        lab.burst([x, this.TOP + lab.rand(0.3, 1.2), z], { count: 2, color: '#f2fbff', speed: 2, dir: [w.d[0], 0, w.d[1]], gravity: 0, life: 1, size: 0.12 });
      }
    }
  },

  // ---------- маркеры: курсор, камень в руке, призрак под ветром, исчезающий камень, угрозы, прицел мудреца ----------
  updateMarkers(lab, dt) {
    const st = lab.state, cfg = lab.cfg, T = this.TOP, t = lab.t;
    const my = st.phase === 'turn' && (st.turn === 1 || Math.round(cfg.vs) === 1);
    const c = this.cellPos(st.cursor), busy = !!st.pos.b[st.cursor];
    st.cursorMesh.visible = my;
    if (my) {
      st.cursorMesh.position.set(c.x, T + 0.06, c.z);
      st.cursorMesh.material = busy ? st.badMat : st.turn === 1 ? st.okMat : st.okMoonMat;
      st.cursorMesh.rotation.z += dt;
    }
    // камень в руке: висит над лункой курсора, туда и упадёт
    [1, 2].forEach(s => {
      const h = st.hand[s], on = my && st.turn === s && !busy;
      h.visible = on;
      if (on) { h.position.set(lab.damp(h.position.x, c.x, 22, dt), T + 0.75 + Math.sin(t * 4) * 0.08, lab.damp(h.position.z, c.z, 22, dt)); h.rotation.y += dt * 1.2; }
    });
    // призрак: куда на самом деле ляжет камень при этом ветре
    let ghostAt = -1;
    if (my && st.wind && !busy) { const r = this.step(st.pos, st.cursor, st.turn, st.wind, 2, 9); if (r.at !== st.cursor) ghostAt = r.at; }
    [1, 2].forEach(s => {
      const g = st.ghost[s], on = ghostAt >= 0 && st.turn === s;
      g.visible = on;
      if (on) { const p = this.cellPos(ghostAt); g.position.set(p.x, T + 0.3 + Math.sin(t * 6) * 0.08, p.z); g.rotation.y += dt * 2; }
    });
    // «видно = правда»: камень, который исчезнет при следующем ходе своей стороны, дрожит в красном круге
    const doomed = [];
    [1, 2].forEach(s => {
      const ring = st.doom[s], q = st.pos.q[s];
      const on = Math.round(cfg.rule) === 1 && q.length >= Math.round(cfg.keep) && st.phase !== 'end' && st.meshAt[q[0]];
      ring.visible = !!on;
      if (on) { const p = this.cellPos(q[0]); ring.position.set(p.x, T + 0.07, p.z); ring.scale.setScalar(1 + 0.12 * Math.sin(t * 10)); doomed.push(st.meshAt[q[0]]); }
    });
    st.meshAt.forEach(m => { if (m) m.rotation.z = doomed.includes(m) && st.phase !== 'anim' ? Math.sin(t * 22) * 0.07 : 0; });
    // угрозы «две в ряд»: пустая лунка светится цветом того, кто соберёт там три
    let n = 0;
    if (cfg.threats && (st.phase === 'turn' || st.phase === 'aim')) {
      for (const s of [1, 2]) for (const i of this.threats(st.pos.b, s)) {
        const p = this.cellPos(i), k = 1 + 0.08 * Math.sin(t * 6 + s);
        lab.place(st.threat, n++, [p.x, T + 0.03, p.z], { scale: k, color: s === 1 ? '#ffb400' : '#2f8cff' });
      }
    }
    for (let i = n; i < 9; i++) lab.place(st.threat, i, [0, -5, 0], { scale: 0.001 });
    // последний ход подсвечен, как в шахматах
    st.lastMark.visible = st.last >= 0 && st.phase !== 'end' && !!st.pos.b[st.last];
    if (st.lastMark.visible) { const p = this.cellPos(st.last); st.lastMark.position.set(p.x, T + 0.025, p.z); st.lastMark.material = st.pos.b[st.last] === 1 ? st.lastSun : st.lastMoon; }
  },
  showAim(lab, cell) {
    const st = lab.state, p = this.cellPos(cell);
    st.aim.visible = true; st.aim.position.set(p.x, this.TOP + 0.07, p.z);
    st.beam.visible = true;
    lab.pulse(st.aim, 1.4, 0.2);
    lab.tone(880, 0.08, 'sine', 0.05, 1320);
    this.updateBeam(lab);
  },
  updateBeam(lab) {
    const st = lab.state, from = st.tip.getWorldPosition(lab.v3()), to = st.aim.position.clone();
    to.y += 0.2;
    const dir = to.clone().sub(from), len = dir.length();
    st.beam.position.copy(from).addScaledVector(dir, 0.5);
    st.beam.scale.set(1, len, 1);
    st.beam.quaternion.setFromUnitVectors(lab.v3(0, 1, 0), dir.normalize());
    st.aim.rotation.z += 0.05;
  },
  hideAim(lab) { lab.state.aim.visible = false; lab.state.beam.visible = false; },
  updateScales(lab, dt) {
    const st = lab.state, on = !!lab.cfg.oracle;
    st.scales.visible = on;
    if (!on) return;
    st.scaleX = lab.damp(st.scaleX, st.scaleTo || 0, 5, dt);
    const wob = st.sure ? 0 : Math.sin(lab.t * 3.1) * 0.06 + Math.sin(lab.t * 7.3) * 0.03; // открытый исход колеблется
    st.scaleGem.position.x = (st.scaleX + wob) * 3.0;
    st.scaleGem.rotation.y += dt * (st.sure ? 0.6 : 3);
    const col = !st.sure ? st.gemOpen : st.evalV > 0 ? st.gemSun : st.evalV < 0 ? st.gemMoon : st.gemDraw;
    st.scaleGem.children[0].material = col;
    st.lock.visible = !!st.sure;
    st.lock.position.x = st.scaleGem.position.x;
    st.lock.rotation.z += dt;
  },
  updateCamera(lab) {
    const st = lab.state, v = lab.view, k = st.zoomK;
    if (k > 0.001) { v.distance = st.camBase * (1 - 0.2 * k); st.zoomWas = true; }
    else if (st.zoomWas) { v.distance = st.camBase; st.zoomWas = false; }
    else st.camBase = v.distance; // окно поменялось — оболочка подобрала новое расстояние
    v.target.copy(st.camT).lerp(st.zoomAt, 0.55 * k);
  },
  cellPos(i) { return { x: (i % 3 - 1) * this.CELL, z: (Math.floor(i / 3) - 1) * this.CELL }; },
  plural(n, one, few, many) { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? one : m >= 2 && m <= 4 && (h < 12 || h > 14) ? few : many; },

  // ---------- камни: солнце (диск с лучами) и луна (кристалл), общие формы на всю партию ----------
  assets(lab) {
    const T3 = lab.THREE, U = lab.addons.BufferGeometryUtils, st = lab.state;
    const rays = [];
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2, g = new T3.ConeGeometry(0.16, 0.38, 4);
      g.rotateZ(-Math.PI / 2); g.rotateY(-a); g.translate(Math.cos(a) * 0.78, 0, Math.sin(a) * 0.78);
      rays.push(g);
    }
    const moon = new T3.OctahedronGeometry(0.62); moon.scale(1, 1.25, 1);
    st.geo = { sun: new T3.CylinderGeometry(0.62, 0.62, 0.32, 12), rays: U.mergeGeometries(rays), face: new T3.CylinderGeometry(0.36, 0.36, 0.36, 12), moon };
    rays.forEach(g => g.dispose());
    st.mats = { sun: lab.mat('#ffc93c', { glow: 0.15 }), rays: lab.mat('#ff9f1c', { glow: 0.2 }), face: lab.mat('#fff0a8', { glow: 0.4 }), moon: lab.mat('#5fa8ff', { glow: 0.45, shiny: true }) };
  },
  makeStone(lab, side, o = {}) {
    const st = lab.state, g = lab.group(o);
    if (side === 1) {
      lab.mesh(st.geo.sun, o.ghost || st.mats.sun, { parent: g });
      lab.mesh(st.geo.rays, o.ghost || st.mats.rays, { parent: g });
      if (!o.ghost) lab.mesh(st.geo.face, st.mats.face, { parent: g });
    } else lab.mesh(st.geo.moon, o.ghost || st.mats.moon, { parent: g });
    if (o.ghost) lab.noShadow(g);
    return g;
  },

  // ---------- стол-плита, лунки, корзины с запасом ----------
  buildTable(lab) {
    const T3 = lab.THREE, st = lab.state, T = this.TOP, S = 8.8;
    const parts = [lab.box(S, 0.5, S, '#9a9ca4', { at: [0, T - 0.25, 0] })];
    for (const x of [-3, 3]) for (const z of [-3, 3]) parts.push(lab.box(1.3, T - 0.5, 1.3, '#7f8189', { at: [x, (T - 0.5) / 2, z] }));
    lab.merge(parts);
    // лунки: тёмный край и светлое дно
    const hole = lab.instances(new T3.CylinderGeometry(0.98, 0.98, 0.04, 18), '#6e717a', 9, { shadow: false });
    const bed = lab.instances(new T3.CylinderGeometry(0.8, 0.8, 0.05, 18), '#858892', 9, { shadow: false });
    for (let i = 0; i < 9; i++) { const p = this.cellPos(i); lab.place(hole, i, [p.x, T + 0.01, p.z]); lab.place(bed, i, [p.x, T + 0.015, p.z]); }
    // золотая резьба между лунками и орнамент по краю — копии
    const groove = lab.instances(new T3.BoxGeometry(7.0, 0.05, 0.12), '#d9ad4a', 4, { glow: 0.25, shadow: false });
    [-0.5, 0.5].forEach((k, i) => {
      lab.place(groove, i * 2, [0, T + 0.02, k * this.CELL]);
      lab.place(groove, i * 2 + 1, [k * this.CELL, T + 0.02, 0], { rot: Math.PI / 2 });
    });
    const sides = [], E = S / 2 - 0.25;
    for (let k = -3.6; k <= 3.61; k += 0.8) sides.push([k, -E, Math.PI], [-E, k, -Math.PI / 2], [E, k, Math.PI / 2]);
    for (let k = -3.6; k <= 3.61; k += 0.8) if (Math.abs(k) > 3.4) sides.push([k, E, 0]); // ближний край — под весами исхода
    const tri = lab.instances(new T3.CylinderGeometry(0.2, 0.2, 0.06, 3), '#d9ad4a', sides.length, { glow: 0.3, shadow: false });
    sides.forEach(([x, z, a], i) => lab.place(tri, i, [x, T + 0.02, z], { rot: a }));
    // плетёные корзины с запасом камней у каждой стороны стола
    const basket = lab.instances(new T3.CylinderGeometry(0.75, 0.55, 0.6, 10), '#a8743f', 2);
    const band = lab.instances(new T3.CylinderGeometry(0.77, 0.7, 0.1, 10), '#7a5232', 2);
    const res = { sun: lab.instances(st.geo.sun, st.mats.sun, 3), rays: lab.instances(st.geo.rays, st.mats.rays, 3), face: lab.instances(st.geo.face, st.mats.face, 3), moon: lab.instances(st.geo.moon, st.mats.moon, 3) };
    [[-5.6, 3.4, 1], [5.6, -3.4, 2]].forEach(([x, z, side], b) => {
      lab.place(basket, b, [x, 0.3, z]); lab.place(band, b, [x, 0.45, z]);
      for (let i = 0; i < 3; i++) {
        const at = [x + Math.cos(i * 2.1) * 0.3, 0.72 + i * 0.07, z + Math.sin(i * 2.1) * 0.3], o = { scale: 0.5, rot: [0.3, i, 0.2] };
        if (side === 1) { lab.place(res.sun, i, at, o); lab.place(res.rays, i, at, o); lab.place(res.face, i, at, o); }
        else lab.place(res.moon, i, at, o);
      }
    });
  },

  // ---------- мудрец в черкеске и папахе: лицом к игроку (+Z) ----------
  buildSage(lab) {
    const T3 = lab.THREE, st = lab.state;
    const sage = lab.group({ at: [0, 0, -6.3], scale: 1.3 });
    // неподвижные части сливаются в один меш на цвет: сначала строим в начале координат, потом ставим на место
    const bake = (build, parent, at) => {
      const tmp = lab.group(); build(tmp);
      const out = lab.merge([tmp]); parent.add(out); if (at) out.position.set(at[0], at[1], at[2]);
      return out;
    };
    lab.box(1.8, 0.7, 1.3, '#8a8c94', { at: [0, 0.35, 0], parent: sage });
    st.body = bake(g => {
      lab.cyl(0.375, 0.675, 1.6, '#7a2a3a', { parent: g, at: [0, 0.8, 0], sides: 8 });
      lab.cyl(0.54, 0.54, 0.14, '#d9ad4a', { parent: g, at: [0, 0.45, 0], sides: 8, glow: 0.2 });
      for (const x of [-0.22, 0.22]) lab.box(0.22, 0.3, 0.1, '#efe2c4', { parent: g, at: [x, 1.15, 0.46] });
      lab.box(0.7, 0.2, 0.2, '#7a2a3a', { parent: g, at: [0.62, 1.1, 0.22], rot: [0, 0, -0.3] });
      lab.cyl(0.05, 0.05, 3.0, '#7a5232', { parent: g, at: [1.0, 0.8, 0.25], sides: 6 });
    }, sage, [0, 0.7, 0]);
    st.head = lab.group({ parent: sage, at: [0, 2.45, 0] });
    bake(g => {
      lab.ball(0.31, '#e9c29b', { parent: g, detail: 1 });
      lab.cyl(0.37, 0.37, 0.46, '#f1ede4', { parent: g, at: [0, 0.38, 0], sides: 9 });
      lab.cyl(0.26, 0.025, 0.7, '#f7f7f7', { parent: g, at: [0, -0.36, 0.2], sides: 6 });
      for (const x of [-0.12, 0.12]) lab.box(0.07, 0.07, 0.07, '#1c1f27', { parent: g, at: [x, 0.05, 0.29] });
      for (const x of [-0.12, 0.12]) lab.box(0.14, 0.04, 0.05, '#f7f7f7', { parent: g, at: [x, 0.14, 0.29] });
    }, st.head);
    st.tip = lab.mesh(new T3.OctahedronGeometry(0.2), '#8fe3ff', { parent: sage, at: [1.0, 3.1, 0.25], glow: 1, shadow: false });
    st.sage = sage;
  },

  buildMarkers(lab) {
    const T3 = lab.THREE, st = lab.state, flat = [Math.PI / 2, 0, 0];
    st.okMat = lab.mat('#fff4c2', { unlit: true, glow: 0.3 }); st.okMoonMat = lab.mat('#c8ecff', { unlit: true, glow: 0.3 });
    st.badMat = lab.mat('#8a909c', { unlit: true }); // занятая лунка: серый курсор, красный — только у камня, который исчезнет
    st.cursorMesh = lab.mesh(new T3.TorusGeometry(0.98, 0.07, 6, 28), st.okMat, { rot: flat, shadow: false });
    st.hand = [null, this.makeStone(lab, 1), this.makeStone(lab, 2)];
    st.hand.forEach(h => { if (h) h.visible = false; });
    const gs = lab.mat('#ffd23f', { unlit: true, alpha: 0.4 }), gm = lab.mat('#5fa8ff', { unlit: true, alpha: 0.4 });
    st.ghost = [null, this.makeStone(lab, 1, { ghost: gs }), this.makeStone(lab, 2, { ghost: gm })];
    st.ghost.forEach(g => { if (g) g.visible = false; });
    st.doom = [null, 1, 2].map(s => s && lab.mesh(new T3.TorusGeometry(0.82, 0.09, 6, 24), lab.mat('#ff4d5e', { unlit: true, glow: 0.5 }), { rot: flat, shadow: false }));
    st.doom.forEach(r => { if (r) r.visible = false; });
    const ringGeo = new T3.RingGeometry(0.5, 0.9, 24); ringGeo.rotateX(-Math.PI / 2);
    st.threat = lab.instances(ringGeo, lab.mat('#ffffff', { unlit: true, add: true }), 9, { shadow: false });
    const lastGeo = new T3.RingGeometry(0.86, 0.96, 28); lastGeo.rotateX(-Math.PI / 2);
    st.lastSun = lab.mat('#ffd23f', { unlit: true, alpha: 0.55 }); st.lastMoon = lab.mat('#5fa8ff', { unlit: true, alpha: 0.55 });
    st.lastMark = lab.mesh(lastGeo, st.lastSun, { shadow: false }); st.lastMark.visible = false;
    st.aim = lab.mesh(new T3.TorusGeometry(0.98, 0.07, 6, 28), lab.mat('#8fe3ff', { unlit: true, glow: 0.8 }), { rot: flat, shadow: false });
    st.beam = lab.mesh(new T3.CylinderGeometry(0.05, 0.05, 1, 6), lab.mat('#8fe3ff', { unlit: true, add: true }), { shadow: false });
    st.aim.visible = st.beam.visible = false;
    st.sunLine = lab.mat('#ffd23f', { glow: 1.2 }); st.moonLine = lab.mat('#5fa8ff', { glow: 1.2 });
    st.line = lab.box(1, 0.18, 0.32, st.sunLine, { shadow: false }); st.line.visible = false;
    // стрелка ветра над доской: смотрит по своей +Z
    st.windArrow = lab.group();
    const wm = lab.mat('#e8f7ff', { glow: 0.6 });
    lab.cyl(0.11, 0.11, 1.6, wm, { parent: st.windArrow, rot: [Math.PI / 2, 0, 0], sides: 6, shadow: false });
    lab.cone(0.35, 0.7, wm, { parent: st.windArrow, at: [0, 0, 1.1], rot: [Math.PI / 2, 0, 0], sides: 6, shadow: false });
    st.windArrow.visible = false;
  },
  // весы исхода у ближнего края доски: золото — солнца, синева — луны, середина — ничья
  buildScales(lab) {
    const T3 = lab.THREE, st = lab.state, y = this.TOP + 0.05, z = 3.75;
    st.scales = lab.group({ at: [0, y, z] });
    lab.box(6.8, 0.1, 0.3, '#5d6068', { parent: st.scales });
    lab.box(3.2, 0.06, 0.18, '#ffc93c', { parent: st.scales, at: [-1.65, 0.07, 0], glow: 0.35, shadow: false });
    lab.box(3.2, 0.06, 0.18, '#5fa8ff', { parent: st.scales, at: [1.65, 0.07, 0], glow: 0.35, shadow: false });
    lab.box(0.12, 0.16, 0.36, '#ffffff', { parent: st.scales, at: [0, 0.08, 0], glow: 0.3, shadow: false });
    st.gemOpen = lab.mat('#e6f0ff', { glow: 0.5, shiny: true }); st.gemSun = lab.mat('#ffd23f', { glow: 1 }); st.gemMoon = lab.mat('#5fa8ff', { glow: 1 }); st.gemDraw = lab.mat('#ffffff', { glow: 1 });
    st.scaleGem = lab.group({ parent: st.scales, at: [0, 0.38, 0] });
    lab.mesh(new T3.OctahedronGeometry(0.24), st.gemOpen, { parent: st.scaleGem });
    st.lock = lab.mesh(new T3.TorusGeometry(0.36, 0.045, 6, 20), lab.mat('#ffffff', { unlit: true, glow: 0.6 }), { parent: st.scales, at: [0, 0.38, 0], shadow: false });
    st.lock.visible = false;
    st.scaleTo = 0;
  },

  // ---------- плато Лаго-Наки: горы, пихты, валуны, цветы, овцы, дольмен ----------
  scenery(lab, scene) {
    const T3 = lab.THREE, st = lab.state;
    lab.ground({ w: 240, h: 240, color: '#5c9646', bumps: 2, flat: 0.7 });
    lab.box(18, 0.04, 18, '#6aa850', { at: [0, 0.02, -1], shadow: false }); // луг вокруг стола
    // горы вдали со снежными шапками — один меш на цвет
    const hills = [];
    [[-40, -70, 30, 15], [-12, -78, 40, 19], [18, -72, 30, 14], [44, -64, 22, 11], [4, -58, 16, 8], [-60, -50, 20, 10], [62, -48, 18, 9]].forEach(([x, z, h, r]) => {
      const a = lab.rand(0, 1);
      hills.push(lab.cone(r, h, '#7d8aa6', { at: [x, h / 2 - 0.5, z], sides: 6, rot: a }));
      hills.push(lab.cone(r * 0.36, h * 0.34, '#f4f8ff', { at: [x, h * 0.83 - 0.5, z], sides: 6, rot: a }));
    });
    lab.merge(hills);
    // пихты — копии: стволы и кроны разных оттенков
    const N = 46, trunk = lab.instances(new T3.CylinderGeometry(0.15, 0.2, 0.7, 5), '#5a3d2b', N), crown = lab.instances(new T3.ConeGeometry(0.5, 1, 6), '#ffffff', N * 2);
    let n = 0;
    for (let i = 0; i < 400 && n < N; i++) {
      const a = lab.rand(0, Math.PI * 2), d = lab.rand(13, 34), x = Math.cos(a) * d, z = -Math.abs(Math.sin(a)) * d * 0.9 + lab.rand(-6, 6);
      if (Math.abs(x) < 15 && z > -24) continue;
      const h = lab.rand(2, 4.2), col = lab.pick(['#1f5a3a', '#25683f', '#2f7a46']);
      lab.place(trunk, n, [x, 0.35, z]);
      lab.place(crown, n * 2, [x, 0.7 + h * 0.45, z], { scale: [h * 0.75, h * 0.9, h * 0.75], rot: lab.rand(0, 3), color: col });
      lab.place(crown, n * 2 + 1, [x, 0.7 + h * 0.95, z], { scale: [h * 0.5, h * 0.6, h * 0.5], rot: lab.rand(0, 3), color: col });
      n++;
    }
    const boulder = lab.instances(new T3.DodecahedronGeometry(0.6, 0), '#a3a6ae', 16);
    for (let i = 0; i < 16; i++) {
      const s = lab.rand(0.5, 1.6);
      lab.place(boulder, i, [lab.pick([-1, 1]) * lab.rand(8, 16), s * 0.2, lab.rand(-12, 8)], { scale: [s, s * 0.6, s], rot: lab.rand(0, 3) });
    }
    // цветы на лугу
    const flower = lab.instances(new T3.CylinderGeometry(0.12, 0.12, 0.1, 5), '#ffffff', 70, { shadow: false });
    let f = 0;
    for (let i = 0; i < 140 && f < 70; i++) {
      const x = lab.rand(-14, 14), z = lab.rand(-12, 9);
      if (Math.abs(x) < 6.5 && Math.abs(z + 1) < 6.5) continue;
      lab.place(flower, f++, [x, 0.07, z], { color: lab.pick(['#ffffff', '#ff7eb6', '#ffe14d', '#b48cff']) });
    }
    // овцы: шерсть и тёмные голова с ногами — две пачки копий
    const U = lab.addons.BufferGeometryUtils, wool = new T3.IcosahedronGeometry(0.5, 1);
    wool.scale(1.1, 0.75, 0.8); wool.translate(0, 0.7, 0);
    const bits = [new T3.BoxGeometry(0.32, 0.36, 0.42).rotateY(Math.PI / 2).translate(0.62, 0.82, 0)];
    for (const x of [-0.3, 0.3]) for (const z of [-0.2, 0.2]) bits.push(new T3.BoxGeometry(0.1, 0.42, 0.1).translate(x, 0.21, z));
    const dark = U.mergeGeometries(bits); bits.forEach(b => b.dispose());
    st.sheep = [[-9, -3], [-10.5, -4.5], [-8, -6], [9.5, 2], [11, 0], [8.5, -8], [-12, 4]].map(([x, z]) => ({ x, z, a: lab.rand(0, 6.28) }));
    st.wool = lab.instances(wool, '#f7f4ec', st.sheep.length);
    st.dark = lab.instances(dark, '#2b2b30', st.sheep.length);
    // дольмен за спиной мудреца
    const dp = [], slab = (w, h, d, x, y, z) => dp.push(lab.box(w, h, d, '#878a92', { at: [x, y, z] }));
    slab(0.45, 2.6, 3.2, -1.8, 1.3, -11); slab(0.45, 2.6, 3.2, 1.8, 1.3, -11); slab(4.0, 2.6, 0.45, 0, 1.3, -12.6);
    slab(4.0, 2.6, 0.45, 0, 1.3, -9.4); slab(4.8, 0.5, 4.2, 0, 2.85, -11);
    dp.push(lab.cyl(0.45, 0.45, 0.1, '#25262c', { at: [0, 1.1, -9.15], rot: [Math.PI / 2, 0, 0], sides: 12 }));
    lab.merge(dp);
  },
};
