const XO_RULES = ['Классика', 'Каждый 3-й ход — фишкой соперника', 'Гравитация: фишка падает вниз', 'Только 3 фишки: старая исчезает', 'Клетка-бомба (правило ученика)'];
const TALLY = { w: 0, d: 0, l: 0 };
const INK = { X: '#1f3fbf', O: '#c4302b' };

const GAME = {
  title: 'Крестики-нолики: одно правило',
  subtitle: 'Ты ставишь крестики, бот ставит нолики. Сначала сыграй классику пару раз. Потом открой ручки (Tab) и включи новое правило.',
  controls: [
    { input: 'move4', text: 'выбрать клетку' },
    { input: 'a', text: 'поставить крестик' },
  ],
  decisions: [
    'Чувство: «а вдруг выиграю?» вместо «опять ничья».',
    'Честность: правило объявлено заранее; фишка, которая исчезнет, подсвечена.',
    'Выбор: каждый ход — угроза или защита, и бот тоже может ошибиться.',
  ],
  palette: { bg: '#f3f1e8', accent: '#3f6df2' },
  config: {
    rule: { value: 0, min: 0, max: 4, step: 1, names: XO_RULES, label: 'Новое правило' },
    size: { value: 3, min: 3, max: 9, step: 1, label: 'Поле, клеток в стороне' },
    winLen: { value: 3, min: 3, max: 6, step: 1, label: 'Сколько в ряд для победы' },
    botSkill: { value: 1, min: 0, max: 1, step: 0.05, label: 'Ум бота (1 — не ошибается)' },
    botDelay: { value: 0.5, min: 0.1, max: 2, step: 0.1, label: 'Бот думает, с' },
    maxPieces: { value: 3, min: 2, max: 6, step: 1, label: '«Только N фишек»: N' },
    swapEvery: { value: 3, min: 2, max: 6, step: 1, label: '«Чужая фишка»: каждый N-й ход' },
  },
  presets: {
    'Классика': { rule: 0, size: 3, winLen: 3 },
    '7×7, 4 в ряд': { rule: 0, size: 7, winLen: 4 },
    'Чужая фишка': { rule: 1, size: 3, winLen: 3 },
    'Гравитация': { rule: 2, size: 5, winLen: 4 },
    'Три фишки': { rule: 3, size: 3, winLen: 3 },
    'Бомба': { rule: 4, size: 3, winLen: 3 },
    'Бомба 5×5': { rule: 4, size: 5, winLen: 4 },
  },

  start(g) {
    const s = g.state, c = g.cfg;
    s.N = Math.round(c.size); s.K = Math.min(Math.round(c.winLen), s.N); s.rule = Math.round(c.rule);
    s.b = Array(s.N * s.N).fill(null); s.age = Array(s.N * s.N).fill(0);
    s.cx = Math.floor(s.N / 2); s.cy = Math.floor(s.N / 2);
    this.cfgSwap = c.swapEvery; this.cfgMax = c.maxPieces;
    s.turn = 'X'; s.moves = 0; s.botT = 0; s.done = false; s.winLine = null; s.last = -1; s.endT = 0; s.armed = false;
    s.bomb = s.rule === 4 ? Math.floor(Math.random() * s.b.length) : -1;
  },

  // какой фишкой ходит тот, чей ход
  pieceFor(s, who) {
    if (s.rule === 1 && (s.moves + 1) % Math.round(this.cfgSwap) === 0) return who === 'X' ? 'O' : 'X';
    return who;
  },
  dropRow(s, col) { for (let y = s.N - 1; y >= 0; y--) if (!s.b[y * s.N + col]) return y; return -1; },
  legal(s) {
    const out = [];
    if (s.rule === 2) { for (let x = 0; x < s.N; x++) { const y = this.dropRow(s, x); if (y >= 0) out.push(y * s.N + x); } }
    else for (let i = 0; i < s.b.length; i++) if (!s.b[i]) out.push(i);
    return out;
  },
  oldest(s, p) {
    let idx = -1, a = Infinity, n = 0;
    for (let i = 0; i < s.b.length; i++) if (s.b[i] === p) { n++; if (s.age[i] < a) { a = s.age[i]; idx = i; } }
    return n >= Math.round(this.cfgMax) ? idx : -1;
  },
  lineFrom(b, N, K, p) {
    const D = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (b[y * N + x] !== p) continue;
      for (const [dx, dy] of D) {
        const cells = [];
        for (let k = 0; k < K; k++) { const xx = x + dx * k, yy = y + dy * k; if (xx < 0 || yy < 0 || xx >= N || yy >= N || b[yy * N + xx] !== p) break; cells.push(yy * N + xx); }
        if (cells.length === K) return cells;
      }
    }
    return null;
  },
  blast(b, N, i) {
    const out = [], x = i % N, y = Math.floor(i / N);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < N && yy < N && b[yy * N + xx]) { b[yy * N + xx] = null; out.push(yy * N + xx); }
    }
    return out;
  },
  place(g, i, piece) {
    const s = g.state;
    if (s.rule === 3) { const o = this.oldest(s, piece); if (o >= 0) { s.b[o] = null; g.burst(...this.center(g, o), { count: 10, colors: ['#9aa3c7'] }); } }
    s.b[i] = piece; s.age[i] = ++s.moves; s.last = i;
    if (s.rule === 4 && i === s.bomb) {
      const gone = this.blast(s.b, s.N, i);
      for (const k of gone) g.burst(...this.center(g, k), { count: 18, speed: 300, colors: ['#ff8a00', '#2b2b2b', '#ffd23f'] });
      g.sfx.explode(); g.shake(16); g.flash('#ff8a00', 0.3); g.rumble(300, 1); g.count('взрывов');
      const free = s.b.map((v, k) => v || k === i ? -1 : k).filter(k => k >= 0);
      s.bomb = free.length ? g.pick(free) : -1;
    }
    g.sfx.beep(); g.burst(...this.center(g, i), { count: 8, colors: [INK[piece]] });
    const wx = this.lineFrom(s.b, s.N, s.K, 'X'), wo = this.lineFrom(s.b, s.N, s.K, 'O');
    if (wx || wo) {
      s.done = true; s.winLine = wx || wo;
      // если оба ряда сразу (чужая фишка), побеждает тот, чей ряд собран, а при двух — ничья
      s.result = wx && wo ? 'draw' : wx ? 'win' : 'loss';
    } else if (!this.legal(s).length) { s.done = true; s.result = 'draw'; }
    s.turn = s.turn === 'X' ? 'O' : 'X';
  },
  // оценка позиции для бота
  scoreLines(b, N, K, me, op) {
    let sc = 0; const D = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) for (const [dx, dy] of D) {
      let m = 0, o = 0, ok = true;
      for (let k = 0; k < K; k++) { const xx = x + dx * k, yy = y + dy * k; if (xx < 0 || yy < 0 || xx >= N || yy >= N) { ok = false; break; } const v = b[yy * N + xx]; if (v === me) m++; else if (v === op) o++; }
      if (!ok || (m && o)) continue;
      if (m) sc += Math.pow(10, m); if (o) sc -= Math.pow(10, o) * 1.2;
    }
    return sc;
  },
  minimax(b, turn, depth) {
    const w = this.lineFrom(b, 3, 3, 'O') ? 10 - depth : this.lineFrom(b, 3, 3, 'X') ? depth - 10 : null;
    if (w !== null) return w;
    const free = b.map((v, i) => v ? -1 : i).filter(i => i >= 0);
    if (!free.length) return 0;
    let best = turn === 'O' ? -99 : 99;
    for (const i of free) { b[i] = turn; const v = this.minimax(b, turn === 'O' ? 'X' : 'O', depth + 1); b[i] = null; best = turn === 'O' ? Math.max(best, v) : Math.min(best, v); }
    return best;
  },
  botMove(g) {
    const s = g.state, c = g.cfg, moves = this.legal(s);
    if (!moves.length) return;
    const piece = this.pieceFor(s, 'O');
    if (Math.random() > c.botSkill) return this.place(g, g.pick(moves), piece);
    // классика 3×3: идеальная игра
    if (s.rule === 0 && s.N === 3 && s.K === 3) {
      let best = -99, pick = moves[0];
      for (const i of moves) { s.b[i] = 'O'; const v = this.minimax(s.b, 'X', 1); s.b[i] = null; if (v > best) { best = v; pick = i; } }
      return this.place(g, pick, piece);
    }
    // остальные правила: выиграть, помешать, лучшая клетка
    let best = -Infinity, pick = moves[0];
    for (const i of moves) {
      const b = s.b.slice();
      if (s.rule === 3) { const o = this.oldest(s, piece); if (o >= 0) b[o] = null; }
      b[i] = piece;
      if (s.rule === 4 && i === s.bomb) this.blast(b, s.N, i);
      let v = this.scoreLines(b, s.N, s.K, 'O', 'X');
      if (this.lineFrom(b, s.N, s.K, 'O')) v += 1e7;
      if (this.lineFrom(b, s.N, s.K, 'X')) v -= 1e7;
      const mid = (s.N - 1) / 2; v -= (Math.abs(i % s.N - mid) + Math.abs(Math.floor(i / s.N) - mid)) * 0.5;
      v += Math.random() * 0.3;
      if (v > best) { best = v; pick = i; }
    }
    this.place(g, pick, piece);
  },

  update(g, dt) {
    const s = g.state, c = g.cfg;
    this.cfgSwap = c.swapEvery; this.cfgMax = c.maxPieces;
    if (s.done) {
      s.endT += dt;
      if (s.endT > 0.9) {
        if (s.result === 'win') { TALLY.w++; g.addScore(100); g.win('Ты победил!'); }
        else if (s.result === 'loss') { TALLY.l++; g.gameOver('Бот победил'); }
        else { TALLY.d++; g.addScore(30); g.gameOver('Ничья'); }
      }
      return;
    }
    if (!g.input.a) s.armed = true;
    if (s.turn === 'X') {
      const p = g.pressed;
      if (p.left) s.cx = (s.cx + s.N - 1) % s.N;
      if (p.right) s.cx = (s.cx + 1) % s.N;
      if (s.rule !== 2) { if (p.up) s.cy = (s.cy + s.N - 1) % s.N; if (p.down) s.cy = (s.cy + 1) % s.N; }
      if (p.left || p.right || p.up || p.down) g.tone(520, 0.04, 'triangle', 0.05);
      if (p.a && s.armed) {
        const i = s.rule === 2 ? (this.dropRow(s, s.cx) >= 0 ? this.dropRow(s, s.cx) * s.N + s.cx : -1) : s.cy * s.N + s.cx;
        if (i >= 0 && !s.b[i]) { this.place(g, i, this.pieceFor(s, 'X')); s.botT = 0; }
        else { g.shake(4); g.tone(160, 0.12, 'square', 0.08); }
      }
    } else {
      s.botT += dt;
      if (s.botT >= c.botDelay) this.botMove(g);
    }
  },

  geo(g) { const s = g.state, size = 440, cell = size / s.N; return { x0: (g.W - size) / 2, y0: 70, cell, size }; },
  center(g, i) { const s = g.state, { x0, y0, cell } = this.geo(g); return [x0 + (i % s.N + 0.5) * cell, y0 + (Math.floor(i / s.N) + 0.5) * cell]; },

  draw(g, ctx) {
    const s = g.state;
    // тетрадный лист
    ctx.fillStyle = '#f3f1e8'; ctx.fillRect(0, 0, g.W, g.H);
    ctx.strokeStyle = 'rgba(80,120,200,.18)'; ctx.lineWidth = 1;
    for (let x = 0; x < g.W; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, g.H); ctx.stroke(); }
    for (let y = 0; y < g.H; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(g.W, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(220,60,60,.45)'; ctx.beginPath(); ctx.moveTo(60, 0); ctx.lineTo(60, g.H); ctx.stroke();
    if (!s.b) return;
    const { x0, y0, cell, size } = this.geo(g), N = s.N;
    // сетка поля
    ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let k = 1; k < N; k++) {
      ctx.beginPath(); ctx.moveTo(x0 + k * cell, y0 + 4); ctx.lineTo(x0 + k * cell + 2, y0 + size - 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0 + 4, y0 + k * cell); ctx.lineTo(x0 + size - 4, y0 + k * cell + 2); ctx.stroke();
    }
    if (s.rule === 2) { ctx.strokeRect(x0, y0, size, size); }
    // бомба: видно = правда, подсвечены клетки, которые она очистит
    if (s.rule === 4 && s.bomb >= 0 && !s.b[s.bomb]) {
      const [bx, by] = this.center(g, s.bomb), r = cell * 0.22, x = s.bomb % N, y = Math.floor(s.bomb / N);
      ctx.fillStyle = 'rgba(255,138,0,.12)';
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if ((dx || dy) && xx >= 0 && yy >= 0 && xx < N && yy < N) ctx.fillRect(x0 + xx * cell + 3, y0 + yy * cell + 3, cell - 6, cell - 6); }
      ctx.fillStyle = '#2b2b2b'; ctx.beginPath(); ctx.arc(bx, by + 4, r, 0, 6.283); ctx.fill();
      ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bx + r * 0.5, by - r * 0.6); ctx.quadraticCurveTo(bx + r, by - r * 1.6, bx + r * 1.5, by - r * 1.3); ctx.stroke();
      ctx.fillStyle = Math.floor(g.t * 8) % 2 ? '#ffd23f' : '#ff8a00'; ctx.beginPath(); ctx.arc(bx + r * 1.5, by - r * 1.3, 4, 0, 6.283); ctx.fill();
    }
    // курсор / куда упадёт
    if (!s.done && s.turn === 'X') {
      let ci = s.cy * N + s.cx;
      if (s.rule === 2) { const y = this.dropRow(s, s.cx); ci = y >= 0 ? y * N + s.cx : -1; ctx.fillStyle = 'rgba(63,109,242,.12)'; ctx.fillRect(x0 + s.cx * cell, y0, cell, size); }
      if (ci >= 0) { ctx.strokeStyle = '#3f6df2'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.strokeRect(x0 + (ci % N) * cell + 6, y0 + Math.floor(ci / N) * cell + 6, cell - 12, cell - 12); ctx.setLineDash([]); }
    }
    // фишки
    const fadeX = s.rule === 3 ? this.oldest(s, 'X') : -1, fadeO = s.rule === 3 ? this.oldest(s, 'O') : -1;
    for (let i = 0; i < s.b.length; i++) {
      const p = s.b[i]; if (!p) continue;
      const [cx, cy] = this.center(g, i), r = cell * 0.3;
      ctx.globalAlpha = (i === fadeX || i === fadeO) ? 0.35 : 1;
      ctx.strokeStyle = INK[p]; ctx.lineWidth = Math.max(3, cell * 0.08);
      ctx.beginPath();
      if (p === 'X') { ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r); ctx.moveTo(cx + r, cy - r); ctx.lineTo(cx - r, cy + r); }
      else ctx.arc(cx, cy, r, 0, 6.283);
      ctx.stroke(); ctx.globalAlpha = 1;
      if (i === fadeX || i === fadeO) g.text('исчезнет', cx, cy + r + 16, { size: 11, color: '#666', align: 'center' });
    }
    if (s.winLine) {
      const a = this.center(g, s.winLine[0]), b = this.center(g, s.winLine[s.winLine.length - 1]);
      ctx.strokeStyle = 'rgba(30,30,30,.8)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    // подсказки
    const nextPiece = this.pieceFor(s, s.turn);
    let msg = s.done ? '' : s.turn === 'X' ? 'Твой ход' : 'Бот думает…';
    if (!s.done && nextPiece !== s.turn) msg += s.turn === 'X' ? ': этот ход ставишь НОЛИК соперника!' : ': бот ставит твой крестик!';
    g.text(msg, g.W / 2, 44, { size: 20, color: !s.done && nextPiece !== s.turn ? '#c4302b' : '#2b2b2b', align: 'center' });
    g.text('Правило: ' + XO_RULES[s.rule] + ' · поле ' + N + '×' + N + ', ' + s.K + ' в ряд', g.W / 2, g.H - 14, { size: 13, color: '#555', align: 'center' });
    g.text('Счёт за сессию', 76, 66, { size: 12, color: '#555' }); g.text(`победы ${TALLY.w} · ничьи ${TALLY.d} · поражения ${TALLY.l}`, 76, 84, { size: 12, color: '#555' });
  },

  overNote(g, tele) {
    const n = TALLY.w + TALLY.d + TALLY.l;
    return `Счёт за сессию: победы <b>${TALLY.w}</b>, ничьи <b>${TALLY.d}</b>, поражения <b>${TALLY.l}</b> из ${n}. Правило: <b>${XO_RULES[g.state.rule]}</b>.` + (g.state.rule === 4 ? ` Взрывов за партию: ${(tele && tele.custom['взрывов']) || 0}.` : '');
  },
};
