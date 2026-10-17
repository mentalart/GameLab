// «Камни мудреца» — ремейк-донор урока 2 по мотивам механики «Крестики-нолики».
// Образец пошаговой игры на поле-сетке с ботом: ход игрока курсором, ход бота по перебору (минимакс), матч из нескольких партий.
// Секрет донора — неопределённость исхода. В классике мудрец не ошибается, и исход известен заранее: при точной игре — ничья.
// Одно правило (ручка «Секрет: одно правило») делает игру слишком большой для полного расчёта, и исход снова открыт.
const GAME = {
  title: 'Камни мудреца',
  subtitle: 'Три камня в ряд против мудреца с плато Лаго-Наки. Он не ошибается — пока в игре нет одного правила.',
  donor: 'Крестики-нолики',
  players: 1,
  controls: [
    { input: 'move4', text: 'выбрать лунку' },
    { input: 'a', text: 'положить камень' },
  ],
  camera: { type: 'iso', beta: 0.92, target: [0, 1, 0.6] },
  field: { w: 15, h: 15 },
  sky: '#9fd3f5',
  fog: 0.007,
  accent: '#ffd23f',
  decisions: [
    'Чувство: азарт «а вдруг выиграю», который пропадает в решённой игре и возвращается с одним правилом',
    'Честность: камень, который исчезнет следующим, заранее мигает красным, а ветер показывает, куда сдвинет камень',
    'Выбор: занять центр сейчас или сберечь камень, который скоро исчезнет',
  ],
  config: {
    vs: { value: 0, min: 0, max: 1, step: 1, label: 'Соперник', hint: '0 — мудрец, 1 — друг за этим же экраном: ходите по очереди', restart: true },
    rule: { value: 1, min: 0, max: 2, step: 1, label: 'Секрет: одно правило', hint: '0 — классика: исход известен заранее; 1 — старые камни исчезают; 2 — ветер сдвигает камни', restart: true },
    keep: { value: 3, min: 2, max: 5, step: 1, label: 'Правило 1: камней у каждого', hint: 'Кладёшь лишний — самый старый твой камень исчезает', restart: true },
    wind: { value: 0.6, min: 0, max: 1, step: 0.05, label: 'Правило 2: доля ходов с ветром' },
    depth: { value: 9, min: 1, max: 9, step: 1, label: 'Мудрость: на сколько ходов вперёд считает', hint: 'В классике 9 — до конца игры. С правилом 1 мудрец видит не дальше 4 ходов, с ветром — 3' },
    mistake: { value: 0, min: 0, max: 0.6, step: 0.05, label: 'Мудрец ошибается: доля случайных ходов' },
    first: { value: 2, min: 0, max: 2, step: 1, label: 'Кто ходит первым', hint: '0 — ты, 1 — мудрец, 2 — по очереди' },
    turnTime: { value: 0, min: 0, max: 15, step: 1, label: 'Время на ход, с', hint: '0 — без ограничения' },
    think: { value: 0.7, min: 0.1, max: 2, step: 0.1, label: 'Мудрец думает, с' },
    cap: { value: 30, min: 12, max: 60, step: 2, label: 'Правило 1: ничья после ходов' },
    games: { value: 5, min: 1, max: 9, step: 1, label: 'Партий в матче', restart: true },
    lives: { value: 3, min: 1, max: 9, step: 1, label: 'Жизни (поражение — минус жизнь)', restart: true },
    win: { value: 100, min: 10, max: 300, step: 10, label: 'Очки за победу' },
    draw: { value: 25, min: 0, max: 100, step: 5, label: 'Очки за ничью' },
  },
  presets: {
    'Новичок': { depth: 2, mistake: 0.25, first: 0, lives: 5, think: 0.9 },
    'Без секрета': { rule: 0 },
    'Ветер с Фишта': { rule: 2 },
    'Безумие': { rule: 1, keep: 2, turnTime: 3, think: 0.2 },
    'Вдвоём': { vs: 1 },
  },

  CELL: 2.3, // шаг лунок, м
  TOP: 1.0,  // высота плиты-доски
  LINES: [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]],
  WINDS: [{ d: [0, -1], name: 'к мудрецу', arrow: '↑' }, { d: [0, 1], name: 'к тебе', arrow: '↓' }, { d: [-1, 0], name: 'влево', arrow: '←' }, { d: [1, 0], name: 'вправо', arrow: '→' }],

  // ---------- новая партия: мир и матч ----------
  start(lab, scene) {
    const st = lab.state;
    st.game = 0; st.wins = 0; st.draws = 0; st.losses = 0; st.secretHits = 0; st.timeouts = 0;
    st.known = []; st.lengths = []; st.anims = []; st.stones = [];
    this.scenery(lab, scene);
    this.buildTable(lab, scene);
    this.buildSage(lab, scene);
    this.buildMarkers(lab, scene);
    st.cursor = 4; st.repeat = 0;
    this.newGame(lab);
  },

  // ---------- каждый кадр ----------
  update(lab, dt) {
    const st = lab.state, cfg = lab.cfg;
    this.tickAnims(lab, dt);
    this.animateWorld(lab, dt);
    const duel = Math.round(cfg.vs) === 1;
    if (st.phase === 'turn' && (st.turn === 1 || duel)) this.playerTurn(lab, dt);
    else if (st.phase === 'turn' && st.turn === 2) {
      st.t -= dt;
      if (st.t <= 0) { st.target = this.botMove(lab); st.phase = 'aim'; st.t = 0.4; this.showAim(lab, st.target); lab.tone(880, 0.08, 'sine', 0.05, 1320); }
    } else if (st.phase === 'aim') {
      st.t -= dt;
      if (st.t <= 0) { this.hideAim(lab); this.place(lab, st.target, 2); }
    } else if (st.phase === 'anim') {
      if (!st.anims.length) this.afterMove(lab);
    } else if (st.phase === 'end') {
      st.t -= dt;
      if (st.t <= 0) {
        if (st.game >= Math.round(cfg.games)) lab.win(`Матч сыгран: ${st.wins} ${this.plural(st.wins, 'победа', 'победы', 'побед')}, ${st.draws} ${this.plural(st.draws, 'ничья', 'ничьи', 'ничьих')}`);
        else this.newGame(lab);
      }
    }
    this.updateMarkers(lab, dt);
    lab.hud('game', `Партия ${Math.min(st.game, Math.round(cfg.games))} из ${Math.round(cfg.games)} · ${st.wins} : ${st.losses} · ничьих ${st.draws}`);
    lab.hud('rule', ['Правило: классика', `Правило: у каждого не больше ${Math.round(cfg.keep)} камней`, 'Правило: ветер с Фишта'][Math.round(cfg.rule)]);
    const clock = cfg.turnTime > 0 ? ` · ${Math.ceil(Math.max(0, st.clock))} с` : '';
    lab.hud('turn', st.phase === 'end' ? st.resultText : duel ? (st.turn === 1 ? 'Ходят солнца (игрок 1)' : 'Ходят луны (игрок 2)') + clock : st.turn === 1 ? 'Твой ход' + clock : 'Мудрец думает…');
    lab.hud('wind', Math.round(cfg.rule) === 2 && st.phase !== 'end' ? (st.wind ? `Ветер ${st.wind.arrow} ${st.wind.name}` : 'Безветрие') : null);
  },

  overNote(lab) {
    const st = lab.state, rule = Math.round(lab.cfg.rule), n = st.wins + st.draws + st.losses, notes = [];
    if (Math.round(lab.cfg.vs) === 1) notes.push(`Партий: ${n} · солнца ${st.wins} : ${st.losses} луны · ничьих ${st.draws}`);
    else notes.push(`Партий: ${n} · побед ${st.wins} · ничьих ${st.draws} · поражений ${st.losses}`);
    const avg = list => list.length ? Math.round(10 * list.reduce((a, b) => a + b, 0) / list.length) / 10 : 0;
    const duel = Math.round(lab.cfg.vs) === 1;
    if (rule === 0) notes.push(duel ? 'Классика решена: кто знает, как не проиграть, всегда сведёт партию вничью.' : 'Исход каждой партии был известен с первого хода: при точной игре — ничья. Мудрец просчитал игру до конца.');
    else if (st.known.length) notes.push(`Исход становился известен в среднем на ходу ${avg(st.known)} из ${avg(st.lengths)}: до этого игра была открыта`);
    if (rule === 1) notes.push(`Секрет сработал ${st.secretHits} раз: старые камни исчезали`);
    if (rule === 2) notes.push(`Секрет сработал ${st.secretHits} раз: ветер сдвигал камни`);
    if (rule === 0 && n && st.draws === n) notes.push('Все партии — ничьи. Решённая игра: что бы ты ни делал, исход известен заранее.');
    if (rule === 0 && !duel && lab.cfg.mistake > 0) notes.push('Мудрец иногда ошибался — неопределённость принесла его ошибка, а не правило');
    if (st.timeouts) notes.push(`Ход по таймеру сделан за тебя ${st.timeouts} раз`);
    return notes;
  },

  // ---------- партия ----------
  newGame(lab) {
    const st = lab.state, cfg = lab.cfg;
    st.stones.forEach(s => s.dispose()); st.stones = [];
    st.anims = [];
    st.meshAt = new Array(9).fill(null);
    st.pos = { b: new Array(9).fill(0), q: [null, [], []], ply: 0 };
    st.game++;
    st.knownAt = null;
    const first = Math.round(cfg.first);
    st.turn = first === 2 ? (st.game % 2 ? 1 : 2) : first === 0 ? 1 : 2;
    st.line.isVisible = false;
    lab.popup(lab.v3(0, 3.2, 0), `Партия ${st.game}`, '#ffffff', 24);
    this.beginTurn(lab);
  },
  beginTurn(lab) {
    const st = lab.state, cfg = lab.cfg;
    st.phase = 'turn';
    st.wind = null;
    if (Math.round(cfg.rule) === 2 && lab.chance(cfg.wind)) { st.wind = lab.pick(this.WINDS); lab.sfx.whoosh(); }
    if (st.turn === 1) st.clock = cfg.turnTime;
    else if (Math.round(cfg.vs) === 1) st.clock = cfg.turnTime;
    else st.t = cfg.think;
    this.checkKnown(lab);
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
      if (r * 3 + c !== st.cursor) { st.cursor = r * 3 + c; lab.tone(520, 0.04, 'triangle', 0.04); }
    }
    if (p.pressed.a) {
      if (st.pos.b[st.cursor]) { lab.tone(140, 0.12, 'square', 0.05); lab.pulse(st.cursorMesh, 1.25, 0.15); lab.count('в занятую лунку'); }
      else { this.place(lab, st.cursor, st.turn); return; }
    }
    if (lab.cfg.turnTime > 0) {
      st.clock -= dt;
      if (st.clock <= 0) { // время вышло: камень кладётся в случайную свободную лунку
        const free = st.pos.b.map((v, i) => v ? -1 : i).filter(i => i >= 0);
        st.timeouts++; lab.count('ходы по таймеру'); lab.sfx.warn();
        this.place(lab, lab.pick(free), st.turn);
      }
    }
  },

  // ---------- ход: камень, ветер, исчезновение ----------
  place(lab, cell, side) {
    const st = lab.state, cfg = lab.cfg;
    const res = this.step(st.pos, cell, side, st.wind, Math.round(cfg.rule), Math.round(cfg.keep));
    const mesh = (side === 1 ? st.sunSrc : st.moonSrc).createInstance(side === 1 ? 'солнце' : 'луна');
    const from = this.cellPos(cell), to = this.cellPos(res.at);
    mesh.position.set(from.x, this.TOP + 3, from.z);
    mesh.rotation.y = lab.rand(0, 6.28);
    st.stones.push(mesh);
    st.anims.push({ mesh, t: 0, dur: 0.2, kind: 'drop', y: side === 1 ? this.TOP + 0.2 : this.TOP + 0.55, side });
    if (res.at !== cell) { // ветер сдвинул камень — секрет сработал
      st.anims.push({ mesh, t: -0.22, dur: 0.28, kind: 'slide', from, to });
      st.secretHits++; lab.count('_secret');
      lab.tone(300, 0.25, 'sine', 0.05, 700, 0.2);
    }
    st.meshAt[res.at] = mesh;
    if (res.gone >= 0) { // старый камень исчезает — секрет сработал
      const old = st.meshAt[res.gone]; st.meshAt[res.gone] = null;
      if (old) st.anims.push({ mesh: old, t: -0.15, dur: 0.3, kind: 'vanish' });
      st.secretHits++; lab.count('_secret');
    }
    st.pos = res;
    if (side === 1) lab.count('мои ходы');
    st.phase = 'anim';
  },
  afterMove(lab) {
    const st = lab.state, cfg = lab.cfg;
    const w = this.winner(st.pos.b);
    const full = st.pos.b.every(Boolean) || (Math.round(cfg.rule) === 1 && st.pos.ply >= cfg.cap);
    if (!w && !full) { st.turn = 3 - st.turn; this.beginTurn(lab); return; }
    if (st.knownAt == null) st.knownAt = st.pos.ply;
    st.known.push(st.knownAt); st.lengths.push(st.pos.ply);
    st.phase = 'end'; st.t = 1.8;
    if (w) {
      const line = this.LINES.find(l => l.every(i => st.pos.b[i] === w));
      this.showLine(lab, line, w);
    }
    const duel = Math.round(cfg.vs) === 1;
    if (w === 1) {
      st.wins++; st.resultText = duel ? 'Солнца выиграли партию' : 'Победа!'; lab.count('победы');
      lab.addScore(cfg.win, lab.v3(0, 3, 0), '#ffd23f'); lab.sfx.power(); lab.flash('#ffd23f', 0.3); lab.shake(0.4);
      lab.burst(lab.v3(0, this.TOP + 1, 0), { count: 50, colors: ['#ffd23f', '#fff3a0', '#ff8a3d'], speed: 9, up: 3 });
    } else if (w === 2 && duel) { // вдвоём луны — второй игрок: его победа без потери жизни
      st.losses++; st.resultText = 'Луны выиграли партию'; lab.count('победы лун');
      lab.sfx.power(); lab.flash('#5fa8ff', 0.3); lab.shake(0.4);
      lab.burst(lab.v3(0, this.TOP + 1, 0), { count: 50, colors: ['#5fa8ff', '#8fe3ff', '#ffffff'], speed: 9, up: 3 });
    } else if (w === 2) {
      st.losses++; st.resultText = 'Мудрец выиграл партию'; lab.count('поражения');
      lab.hurt(lab.v3(0, this.TOP + 1, 0), 'Мудрец забрал все жизни');
    } else {
      st.draws++; st.resultText = Math.round(cfg.rule) === 1 && !st.pos.b.every(Boolean) ? 'Ничья: ходы кончились' : 'Ничья';
      lab.count('ничьи'); lab.addScore(cfg.draw, lab.v3(0, 3, 0), '#bfe9ff');
      lab.tone(392, 0.3, 'triangle', 0.08); lab.tone(392, 0.3, 'triangle', 0.08, 0, 0.18);
    }
    const rule = Math.round(cfg.rule);
    if (st.known.length) lab.stat('исход известен с хода', rule === 0 ? 1 : Math.round(10 * st.known.reduce((a, b) => a + b, 0) / st.known.length) / 10);
  },

  // ---------- правила и перебор (чистые функции позиции) ----------
  // позиция: b — 9 лунок (0 пусто, 1 ты, 2 мудрец), q — очередь камней каждой стороны (старые первыми), ply — сделано ходов
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
  botMove(lab) {
    const st = lab.state, cfg = lab.cfg;
    const free = st.pos.b.map((v, i) => v ? -1 : i).filter(i => i >= 0);
    if (lab.chance(cfg.mistake)) { lab.count('ошибки мудреца'); return lab.pick(free); }
    const ctx = this.ctx(lab, 120000);
    const depth = Math.min(Math.round(cfg.depth), ctx.rule === 2 ? 3 : ctx.rule === 1 ? 4 : 9); // с правилом игра слишком велика для расчёта до конца
    let best = -Infinity, moves = [];
    for (const m of free) { // ход мудреца: ветер этого хода известен, дальше — среднее
      const next = this.step(st.pos, m, 2, st.wind, ctx.rule, ctx.keep);
      const v = ctx.rule === 0 && depth >= 9 ? -this.solve(next, 1) : -this.search(next, 1, depth - 1, -Infinity, Infinity, ctx);
      if (v > best + 1e-6) { best = v; moves = [m]; } else if (Math.abs(v - best) < 1e-6) moves.push(m);
    }
    return lab.pick(moves);
  },
  // исход известен: в классике — всегда (игра решена); с правилом — когда перебор находит вынужденную победу одной из сторон
  checkKnown(lab) {
    const st = lab.state;
    if (st.knownAt != null) return;
    const ctx = this.ctx(lab, 15000);
    if (ctx.rule === 0) { st.knownAt = st.pos.ply + 1; return; }
    const v = this.search(st.pos, st.turn, ctx.rule === 2 ? 2 : 5, -Infinity, Infinity, ctx);
    if (Math.abs(v) > 900) st.knownAt = st.pos.ply + 1;
  },

  // ---------- анимации ----------
  tickAnims(lab, dt) {
    const st = lab.state;
    st.anims = st.anims.filter(a => {
      a.t += dt;
      if (a.t < 0) return true;
      const k = Math.min(1, a.t / a.dur), m = a.mesh;
      if (a.kind === 'drop') {
        m.position.y = lab.lerp(this.TOP + 3, a.y, k * k);
        if (k >= 1) {
          lab.burst(m.position, { count: 14, colors: a.side === 1 ? ['#ffd23f', '#fff3a0'] : ['#8fe3ff', '#5fa8ff'], speed: 5 });
          lab.tone(a.side === 1 ? 660 : 330, 0.1, 'triangle', 0.08, a.side === 1 ? 990 : 220); lab.shake(0.12);
          lab.pulse(m, 1.2, 0.14);
        }
      } else if (a.kind === 'slide') {
        m.position.x = lab.lerp(a.from.x, a.to.x, k); m.position.z = lab.lerp(a.from.z, a.to.z, k);
      } else if (a.kind === 'vanish') {
        if (a.t - dt <= 0) lab.tone(240, 0.25, 'sine', 0.06, 90);
        m.scaling.setAll(Math.max(0.01, 1 - k)); m.position.y += dt * 2;
        if (k >= 1) { lab.burst(m.position, { count: 16, colors: ['#c9ccd4', '#ffffff'], speed: 4 }); m.dispose(); st.stones = st.stones.filter(x => x !== m); }
      }
      return k < 1;
    });
  },
  animateWorld(lab, dt) {
    const st = lab.state, t = lab.t;
    const thinking = Math.round(lab.cfg.vs) !== 1 && (st.phase === 'turn' && st.turn === 2 || st.phase === 'aim');
    st.head.rotation.x = thinking ? Math.sin(t * 5) * 0.12 : lab.lerp(st.head.rotation.x, 0, 0.1);
    st.tip.scaling.setAll(thinking ? 1 + Math.sin(t * 12) * 0.25 : 1);
    st.sheep.forEach((s, i) => { s.position.y = Math.abs(Math.sin(t * 2 + i)) * 0.05; s.rotation.y += Math.sin(t * 0.3 + i) * dt * 0.2; });
    if (st.windArrow) {
      const w = Math.round(lab.cfg.rule) === 2 && st.phase !== 'end' ? st.wind : null;
      st.windArrow.setEnabled(!!w);
      if (w) {
        st.windArrow.rotation.y = Math.atan2(w.d[0], -w.d[1]);
        const k = 0.5 + 0.4 * Math.sin(t * 4); // стрелка у ближнего края доски «дует» в сторону ветра
        st.windArrow.position.x = w.d[0] * k; st.windArrow.position.z = -4.9 - w.d[1] * k * 0.5;
      }
    }
  },

  // ---------- маркеры: курсор, призрак под ветром, предупреждение об исчезновении, прицел мудреца ----------
  updateMarkers(lab, dt) {
    const st = lab.state, cfg = lab.cfg, my = st.phase === 'turn' && (st.turn === 1 || Math.round(cfg.vs) === 1);
    const c = this.cellPos(st.cursor);
    st.cursorMesh.setEnabled(my);
    if (my) {
      st.cursorMesh.position.set(c.x, this.TOP + 0.08, c.z);
      st.cursorMesh.material = st.pos.b[st.cursor] ? st.badMat : st.okMat;
      st.cursorMesh.rotation.y += dt;
    }
    // призрак: куда на самом деле ляжет камень при этом ветре
    let ghostAt = -1;
    if (my && st.wind && !st.pos.b[st.cursor]) { const r = this.step(st.pos, st.cursor, st.turn, st.wind, 2, 9); if (r.at !== st.cursor) ghostAt = r.at; }
    st.ghost.setEnabled(ghostAt >= 0);
    if (ghostAt >= 0) st.ghost.material = st.turn === 1 ? st.sunGhost : st.moonGhost;
    if (ghostAt >= 0) { const g = this.cellPos(ghostAt); st.ghost.position.set(g.x, this.TOP + 0.25 + Math.sin(lab.t * 6) * 0.08, g.z); }
    // «видно = правда»: камень, который исчезнет при следующем ходе своей стороны, мигает красным
    [1, 2].forEach(side => {
      const ring = st.doom[side], q = st.pos.q[side];
      const on = Math.round(cfg.rule) === 1 && q.length >= Math.round(cfg.keep) && st.phase !== 'end' && st.meshAt[q[0]];
      ring.setEnabled(!!on);
      if (on) { const p = this.cellPos(q[0]); ring.position.set(p.x, this.TOP + 0.06, p.z); ring.scaling.setAll(1 + 0.12 * Math.sin(lab.t * 10)); }
    });
  },
  showAim(lab, cell) {
    const st = lab.state, p = this.cellPos(cell);
    st.aim.setEnabled(true); st.aim.position.set(p.x, this.TOP + 0.08, p.z);
    const from = st.tip.getAbsolutePosition(), to = lab.v3(p.x, this.TOP + 0.3, p.z);
    const len = BABYLON.Vector3.Distance(from, to);
    st.beam.setEnabled(true); st.beam.scaling.y = len;
    st.beam.position = BABYLON.Vector3.Center(from, to);
    st.beam.lookAt(to); st.beam.rotation.x += Math.PI / 2;
  },
  hideAim(lab) { lab.state.aim.setEnabled(false); lab.state.beam.setEnabled(false); },
  showLine(lab, line, side) {
    const st = lab.state, a = this.cellPos(line[0]), b = this.cellPos(line[2]);
    const len = Math.hypot(b.x - a.x, b.z - a.z) + 1.6;
    st.line.isVisible = true;
    st.line.material = side === 1 ? st.sunLine : st.moonLine;
    st.line.scaling.x = len; st.line.position.set((a.x + b.x) / 2, this.TOP + 0.75, (a.z + b.z) / 2);
    st.line.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    lab.pulse(st.line, 1.3, 0.25);
  },
  cellPos(i) { return { x: (i % 3 - 1) * this.CELL, z: (1 - Math.floor(i / 3)) * this.CELL }; },
  plural(n, one, few, many) { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? one : m >= 2 && m <= 4 && (h < 12 || h > 14) ? few : many; },

  // ---------- стол-плита, лунки, камни ----------
  buildTable(lab, scene) {
    const B = BABYLON, st = lab.state, T = this.TOP;
    const slab = B.MeshBuilder.CreateBox('плита', { width: 8.4, height: 0.5, depth: 8.4 }, scene);
    slab.position.y = T - 0.25; slab.material = lab.mat('#9a9ca4'); slab.convertToFlatShadedMesh();
    const leg = B.MeshBuilder.CreateBox('опора', { width: 1.3, height: T - 0.5, depth: 1.3 }, scene);
    leg.material = lab.mat('#7f8189'); leg.isVisible = false;
    for (const x of [-3, 3]) for (const z of [-3, 3]) leg.createInstance('опора').position.set(x, (T - 0.5) / 2, z);
    // лунки и золотая резьба по краю — копии
    const hole = B.MeshBuilder.CreateCylinder('лунка', { diameter: 1.9, height: 0.04, tessellation: 16 }, scene);
    hole.material = lab.mat('#6e717a'); hole.isVisible = false; lab.noShadow(hole);
    for (let i = 0; i < 9; i++) { const p = this.cellPos(i); hole.createInstance('лунка').position.set(p.x, T + 0.01, p.z); }
    const groove = B.MeshBuilder.CreateBox('резьба', { width: 7.0, height: 0.05, depth: 0.12 }, scene);
    groove.material = lab.mat('#d9ad4a', { glow: 0.2 }); groove.isVisible = false; lab.noShadow(groove);
    for (const k of [-0.5, 0.5]) {
      groove.createInstance('резьба').position.set(0, T + 0.02, k * this.CELL);
      const g2 = groove.createInstance('резьба'); g2.position.set(k * this.CELL, T + 0.02, 0); g2.rotation.y = Math.PI / 2;
    }
    // орнамент: золотые треугольники по краю плиты
    const tri = B.MeshBuilder.CreateCylinder('орнамент', { diameter: 0.4, height: 0.06, tessellation: 3 }, scene);
    tri.material = lab.mat('#d9ad4a', { glow: 0.25 }); tri.isVisible = false; lab.noShadow(tri);
    for (let k = -3.6; k <= 3.61; k += 0.8) for (const [x, z, a] of [[k, -3.95, 0], [k, 3.95, Math.PI], [-3.95, k, Math.PI / 2], [3.95, k, -Math.PI / 2]]) {
      const o = tri.createInstance('орнамент'); o.position.set(x, T + 0.02, z); o.rotation.y = a;
    }
    // камень игрока — золотое солнце с лучами (части в один меш, дальше копии)
    const parts = [];
    const disc = B.MeshBuilder.CreateCylinder('солнце', { diameter: 1.25, height: 0.32, tessellation: 12 }, scene);
    disc.material = lab.mat('#ffc93c', { glow: 0.12 }); parts.push(disc);
    const face = B.MeshBuilder.CreateCylinder('солнце', { diameter: 0.7, height: 0.36, tessellation: 12 }, scene);
    face.material = lab.mat('#fff0a8', { glow: 0.3 }); parts.push(face);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2, ray = B.MeshBuilder.CreateCylinder('луч', { diameterTop: 0, diameterBottom: 0.32, height: 0.38, tessellation: 4 }, scene);
      ray.rotation.z = -Math.PI / 2; ray.rotation.y = -a; ray.position.set(Math.cos(a) * 0.78, 0, Math.sin(a) * 0.78);
      ray.material = lab.mat('#ff9f1c', { glow: 0.15 }); parts.push(ray);
    }
    parts.forEach(m => m.convertToFlatShadedMesh());
    st.sunSrc = B.Mesh.MergeMeshes(parts, true, true, undefined, false, true); st.sunSrc.name = 'солнце'; st.sunSrc.isVisible = false;
    // камень мудреца — голубой кристалл-луна
    st.moonSrc = B.MeshBuilder.CreatePolyhedron('луна', { type: 1, size: 0.62 }, scene);
    st.moonSrc.scaling.y = 1.25; st.moonSrc.material = lab.mat('#5fa8ff', { glow: 0.45, shiny: true }); st.moonSrc.isVisible = false;
    // плетёные корзины с запасом камней у каждой стороны стола
    const basket = B.MeshBuilder.CreateCylinder('корзина', { diameterTop: 1.5, diameterBottom: 1.1, height: 0.6, tessellation: 10 }, scene);
    basket.material = lab.mat('#a8743f'); basket.isVisible = false; basket.convertToFlatShadedMesh();
    [[-5.4, -3.4, st.sunSrc], [5.4, 3.6, st.moonSrc]].forEach(([x, z, src]) => {
      basket.createInstance('корзина').position.set(x, 0.3, z);
      for (let i = 0; i < 3; i++) {
        const s = src.createInstance('запас'); s.scaling.setAll(0.5); s.scaling.y *= src === st.moonSrc ? 1.25 : 1;
        s.position.set(x + Math.cos(i * 2.1) * 0.32, 0.72 + i * 0.06, z + Math.sin(i * 2.1) * 0.32); s.rotation.set(0.3, i, 0.2);
      }
    });
  },

  // ---------- мудрец в черкеске и папахе ----------
  buildSage(lab, scene) {
    const B = BABYLON, st = lab.state;
    const sage = new B.TransformNode('мудрец', scene);
    const add = (mesh, color, o, parent) => { mesh.material = lab.mat(color, o || {}); mesh.parent = parent || sage; mesh.convertToFlatShadedMesh(); return mesh; };
    add(B.MeshBuilder.CreateBox('камень-сиденье', { width: 1.8, height: 0.7, depth: 1.3 }, scene), '#8a8c94').position.y = 0.35;
    add(B.MeshBuilder.CreateCylinder('черкеска', { diameterTop: 0.75, diameterBottom: 1.35, height: 1.6, tessellation: 8 }, scene), '#7a2a3a').position.y = 1.5;
    add(B.MeshBuilder.CreateCylinder('пояс', { diameter: 1.08, height: 0.14, tessellation: 8 }, scene), '#d9ad4a', { glow: 0.2 }).position.y = 1.15;
    for (const x of [-0.22, 0.22]) {
      const g = add(B.MeshBuilder.CreateBox('газыри', { width: 0.22, height: 0.3, depth: 0.1 }, scene), '#efe2c4');
      g.position.set(x, 1.85, -0.38);
    }
    const head = new B.TransformNode('голова', scene); head.parent = sage; head.position.y = 2.45;
    add(B.MeshBuilder.CreateSphere('лицо', { diameter: 0.62, segments: 4 }, scene), '#e9c29b', null, head);
    add(B.MeshBuilder.CreateCylinder('папаха', { diameter: 0.74, height: 0.46, tessellation: 9 }, scene), '#f1ede4', null, head).position.y = 0.38;
    const beard = add(B.MeshBuilder.CreateCylinder('борода', { diameterTop: 0.52, diameterBottom: 0.05, height: 0.7, tessellation: 6 }, scene), '#f7f7f7', null, head);
    beard.position.set(0, -0.36, -0.2);
    for (const x of [-0.12, 0.12]) add(B.MeshBuilder.CreateBox('глаз', { size: 0.07 }, scene), '#1c1f27', null, head).position.set(x, 0.05, -0.29);
    const staff = add(B.MeshBuilder.CreateCylinder('посох', { diameter: 0.1, height: 3.0, tessellation: 6 }, scene), '#7a5232');
    staff.position.set(1.0, 1.5, -0.25);
    const arm = add(B.MeshBuilder.CreateBox('рука', { width: 0.7, height: 0.2, depth: 0.2 }, scene), '#7a2a3a'); arm.position.set(0.62, 1.8, -0.22); arm.rotation.z = -0.3;
    st.tip = add(B.MeshBuilder.CreatePolyhedron('огонь посоха', { type: 1, size: 0.2 }, scene), '#8fe3ff', { glow: 1 });
    st.tip.position.set(1.0, 3.1, -0.25); lab.noShadow(st.tip);
    sage.position.set(0, 0, 6.3); sage.rotation.y = 0;
    st.head = head; st.sage = sage;
  },

  buildMarkers(lab, scene) {
    const B = BABYLON, st = lab.state;
    st.okMat = lab.mat('#ffffff', { unlit: true }); st.badMat = lab.mat('#8a909c', { unlit: true }); // занятая лунка: серый курсор, красный — только у камня, который исчезнет
    st.cursorMesh = lab.noShadow(B.MeshBuilder.CreateTorus('курсор', { diameter: 1.95, thickness: 0.13, tessellation: 24 }, scene));
    st.cursorMesh.material = st.okMat;
    st.ghost = lab.noShadow(B.MeshBuilder.CreateCylinder('призрак', { diameter: 1.25, height: 0.3, tessellation: 12 }, scene));
    st.sunGhost = st.ghost.material = lab.mat('#ffd23f', { unlit: true, alpha: 0.4 });
    st.moonGhost = lab.mat('#5fa8ff', { unlit: true, alpha: 0.4 });
    st.doom = [null, 1, 2].map(s => {
      if (!s) return null;
      const r = lab.noShadow(B.MeshBuilder.CreateTorus('исчезнет', { diameter: 1.6, thickness: 0.16, tessellation: 20 }, scene));
      r.material = lab.mat('#ff4d5e', { unlit: true, alpha: 0.85 }); r.setEnabled(false); return r;
    });
    st.aim = lab.noShadow(B.MeshBuilder.CreateTorus('прицел', { diameter: 1.95, thickness: 0.13, tessellation: 24 }, scene));
    st.aim.material = lab.mat('#8fe3ff', { unlit: true }); st.aim.setEnabled(false);
    st.beam = lab.noShadow(B.MeshBuilder.CreateCylinder('луч мудреца', { diameter: 0.08, height: 1, tessellation: 6 }, scene));
    st.beam.material = lab.mat('#8fe3ff', { unlit: true, alpha: 0.6 }); st.beam.setEnabled(false);
    st.line = lab.noShadow(B.MeshBuilder.CreateBox('линия', { width: 1, height: 0.18, depth: 0.32 }, scene));
    st.sunLine = lab.mat('#ffd23f', { glow: 1 }); st.moonLine = lab.mat('#5fa8ff', { glow: 1 });
    st.line.isVisible = false;
    // стрелка ветра над доской
    const arrow = new B.TransformNode('ветер', scene);
    const shaft = lab.noShadow(B.MeshBuilder.CreateCylinder('ветер', { diameter: 0.22, height: 1.6, tessellation: 6 }, scene));
    shaft.rotation.x = Math.PI / 2; shaft.parent = arrow;
    const head = lab.noShadow(B.MeshBuilder.CreateCylinder('ветер', { diameterTop: 0, diameterBottom: 0.7, height: 0.7, tessellation: 6 }, scene));
    head.rotation.x = Math.PI / 2; head.position.z = 1.1; head.parent = arrow;
    shaft.material = head.material = lab.mat('#e8f7ff', { glow: 0.6 });
    arrow.position.y = this.TOP + 0.5; arrow.setEnabled(false);
    st.windArrow = arrow;
  },

  // ---------- плато Лаго-Наки: горы, ели, камни, овцы, дольмен ----------
  scenery(lab, scene) {
    const B = BABYLON, st = lab.state;
    lab.ground({ w: 160, h: 160, color: '#5c9646' });
    const meadow = B.MeshBuilder.CreateGround('луг', { width: 16, height: 16 }, scene);
    meadow.position.y = 0.01; meadow.material = lab.mat('#6aa850'); lab.noShadow(meadow);
    const source = (mesh, color, o) => { mesh.material = lab.mat(color, o); mesh.isVisible = false; mesh.convertToFlatShadedMesh(); return mesh; };
    const cone = (name, color) => source(B.MeshBuilder.CreateCylinder(name, { height: 1, diameterTop: 0, diameterBottom: 1, tessellation: 6 }, scene), color);
    const rock = lab.noShadow(cone('гора', '#7d8aa6')), snow = lab.noShadow(cone('снег', '#f4f8ff'));
    [[-40, 70, 30, 15], [-12, 78, 40, 19], [18, 72, 30, 14], [44, 64, 22, 11], [4, 60, 16, 8], [-60, 50, 20, 10], [62, 48, 18, 9]].forEach(([x, z, h, r]) => {
      const a = lab.rand(0, 1);
      const m = rock.createInstance('гора'); m.scaling.set(r * 2, h, r * 2); m.position.set(x, h / 2 - 0.5, z); m.rotation.y = a;
      const c = snow.createInstance('снег'); c.scaling.set(r * 0.7, h * 0.32, r * 0.7); c.position.set(x, h * 0.84 - 0.5, z); c.rotation.y = a;
    });
    const trunk = source(B.MeshBuilder.CreateCylinder('ствол', { height: 0.7, diameter: 0.3, tessellation: 5 }, scene), '#5a3d2b');
    const crowns = ['#1f5a3a', '#25683f', '#2f7a46'].map(c => cone('крона', c));
    for (let i = 0; i < 30; i++) {
      const a = lab.rand(0, Math.PI * 2), d = lab.rand(13, 26), x = Math.cos(a) * d, z = Math.abs(Math.sin(a)) * d * 0.9 + lab.rand(-4, 8), h = lab.rand(2, 4);
      if (Math.abs(x) < 6 && z < 14) continue;
      trunk.createInstance('ствол').position.set(x, 0.35, z);
      const cr = lab.pick(crowns).createInstance('крона'); cr.scaling.set(h * 0.7, h, h * 0.7); cr.position.set(x, 0.7 + h / 2, z); cr.rotation.y = lab.rand(0, 3);
    }
    const boulder = source(B.MeshBuilder.CreatePolyhedron('валун', { type: 2, size: 0.6 }, scene), '#a3a6ae');
    for (let i = 0; i < 14; i++) {
      const b = boulder.createInstance('валун'), s = lab.rand(0.5, 1.6);
      b.scaling.set(s, s * 0.6, s); b.position.set(lab.pick([-1, 1]) * lab.rand(7, 16), s * 0.25, lab.rand(-8, 12)); b.rotation.y = lab.rand(0, 3);
    }
    // цветы на лугу — маленькие копии
    const flower = lab.noShadow(source(B.MeshBuilder.CreateCylinder('цветок', { diameter: 0.22, height: 0.12, tessellation: 5 }, scene), '#ffffff', { glow: 0.2 }));
    const flower2 = lab.noShadow(source(B.MeshBuilder.CreateCylinder('цветок', { diameter: 0.22, height: 0.12, tessellation: 5 }, scene), '#ff7eb6', { glow: 0.2 }));
    for (let i = 0; i < 60; i++) {
      const x = lab.rand(-14, 14), z = lab.rand(-9, 12);
      if (Math.abs(x) < 5 && Math.abs(z) < 5.5) continue;
      (i % 3 ? flower : flower2).createInstance('цветок').position.set(x, 0.08, z);
    }
    // овцы: тело, голова и ноги в один меш, дальше копии
    const parts = [];
    const wool = B.MeshBuilder.CreateSphere('шерсть', { diameter: 1, segments: 2 }, scene);
    wool.scaling.set(1.1, 0.75, 0.8); wool.position.y = 0.7; wool.material = lab.mat('#f7f4ec'); parts.push(wool);
    const muzzle = B.MeshBuilder.CreateBox('голова', { width: 0.32, height: 0.36, depth: 0.42 }, scene);
    muzzle.position.set(0.62, 0.82, 0); muzzle.material = lab.mat('#2b2b30'); parts.push(muzzle);
    for (const x of [-0.3, 0.3]) for (const z of [-0.2, 0.2]) {
      const l = B.MeshBuilder.CreateBox('нога', { width: 0.1, height: 0.42, depth: 0.1 }, scene);
      l.position.set(x, 0.21, z); l.material = lab.mat('#2b2b30'); parts.push(l);
    }
    parts.forEach(m => m.convertToFlatShadedMesh());
    const sheep = B.Mesh.MergeMeshes(parts, true, true, undefined, false, true); sheep.name = 'овца'; sheep.isVisible = false;
    st.sheep = [[-9, 3], [-10.5, 4.5], [-8, 6], [9.5, -2], [11, 0], [8.5, 8], [-12, -4]].map(([x, z]) => {
      const s = sheep.createInstance('овца'); s.position.set(x, 0, z); s.rotation.y = lab.rand(0, 6.28); return s;
    });
    // дольмен за спиной мудреца
    const dp = [];
    const slab = (w, h, d, x, y, z) => { const m = B.MeshBuilder.CreateBox('дольмен', { width: w, height: h, depth: d }, scene); m.position.set(x, y, z); m.material = lab.mat('#878a92'); dp.push(m); };
    slab(0.45, 2.6, 3.2, -1.8, 1.3, 11); slab(0.45, 2.6, 3.2, 1.8, 1.3, 11); slab(4.0, 2.6, 0.45, 0, 1.3, 12.6);
    slab(4.0, 2.6, 0.45, 0, 1.3, 9.4); slab(4.8, 0.5, 4.2, 0, 2.85, 11);
    const hole = B.MeshBuilder.CreateCylinder('лаз', { diameter: 0.9, height: 0.1, tessellation: 12 }, scene);
    hole.rotation.x = Math.PI / 2; hole.position.set(0, 1.1, 9.15); hole.material = lab.mat('#25262c'); dp.push(hole);
    dp.forEach(m => m.convertToFlatShadedMesh());
    B.Mesh.MergeMeshes(dp, true, true, undefined, false, true).name = 'дольмен';
  },
};
