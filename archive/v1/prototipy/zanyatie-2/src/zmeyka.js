const COLS = 30, ROWS = 15, CELL = 30, OX = 30, OY = 72;
const B_MODES = ['Рывок', 'Разворот вручную', 'Нет кнопки B'];
const WALL_MODES = ['Смерть (версия 1)', 'Автоповорот (версия 2)', 'Сквозные стены'];
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

const GAME = {
  title: 'Змейка-перевёртыш 2',
  subtitle: 'Каждые 10 секунд голова и хвост меняются местами. Версия 2: у стены змейка сама поворачивает, если ты не успел. Стрелка у головы заранее показывает куда.',
  controls: [
    { input: 'move4', text: 'поворот' },
    { input: 'b', text: 'рывок' },
  ],
  decisions: [
    'Чувство: радость и увлечение от новизны на поле.',
    'Честность: за 2 секунды до разворота хвост мигает и тикает отсчёт, стрелка показывает, куда поползёт голова.',
    'Выбор: расти ради рекорда или держаться короткой, чтобы разворот был безопасным.',
  ],
  palette: { bg: '#123a2e', accent: '#e8b730' },
  config: {
    wallMode: { value: 1, min: 0, max: 2, step: 1, names: WALL_MODES, label: 'Стены' },
    bMode: { value: 0, min: 0, max: 2, step: 1, names: B_MODES, label: 'Кнопка B' },
    swapTime: { value: 10, min: 3, max: 60, step: 1, label: 'Разворот раз в, с (60 — почти никогда)' },
    warnTime: { value: 2, min: 0, max: 4, step: 0.1, label: 'Предупреждение до разворота, с' },
    stepTime: { value: 0.13, min: 0.05, max: 0.3, step: 0.005, label: 'Шаг змейки, с (меньше — быстрее)' },
    diffEvery: { value: 15, min: 5, max: 60, step: 1, label: 'Сложность растёт раз в, с' },
    speedUp: { value: 0.008, min: 0, max: 0.03, step: 0.001, label: 'Шаг короче на, с' },
    minStep: { value: 0.06, min: 0.03, max: 0.15, step: 0.005, label: 'Самый быстрый шаг, с' },
    dashTime: { value: 1, min: 0.2, max: 3, step: 0.1, label: 'Рывок длится, с' },
    dashCd: { value: 4, min: 0.5, max: 10, step: 0.5, label: 'Перезарядка рывка, с' },
    swapCd: { value: 5, min: 1, max: 15, step: 0.5, label: 'Перезарядка ручного разворота, с' },
    startLen: { value: 4, min: 2, max: 10, step: 1, label: 'Длина на старте' },
    growPer: { value: 1, min: 1, max: 5, step: 1, label: 'Рост за хычин' },
    pointsLen: { value: 1, min: 0, max: 3, step: 0.1, label: 'Очки за длину (×длина)' },
  },
  presets: {
    'Версия 1': { wallMode: 0 },
    'Новичок': { stepTime: 0.17, warnTime: 3, speedUp: 0.005 },
    'Без переворота (классика)': { swapTime: 60 },
    'Разворот вручную': { bMode: 1 },
    'Безумие': { swapTime: 4, stepTime: 0.09, warnTime: 1 },
  },

  start(g) {
    const s = g.state;
    this.spawnSnake(g);
    s.swapT = 0; s.diffT = 0; s.extraSpeed = 0; s.dash = 0; s.dashCd = 0; s.swapCdT = 0;
    s.swaps = 0; s.maxLen = s.body.length; s.lastSwapAt = -9; s.ticked = -1;
    this.placeFood(g);
  },
  spawnSnake(g) {
    const s = g.state, n = Math.round(g.cfg.startLen), y = Math.floor(ROWS / 2);
    s.body = []; for (let i = 0; i < n; i++) s.body.push({ x: 8 - i, y });
    s.dir = 'right'; s.queue = []; s.acc = 0; s.grow = 0;
  },
  placeFood(g) {
    const s = g.state; let p, tries = 0;
    do { p = { x: g.randInt(0, COLS - 1), y: g.randInt(0, ROWS - 1) }; tries++; } while (tries < 500 && s.body.some(b => b.x === p.x && b.y === p.y));
    s.food = p;
  },
  dirOf(a, b) { // направление из b в a
    const dx = a.x - b.x, dy = a.y - b.y;
    return dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';
  },
  swap(g) {
    const s = g.state;
    if (s.body.length < 2) return;
    s.body.reverse(); s.dir = this.dirOf(s.body[0], s.body[1]); s.queue = [];
    s.swapT = 0; s.swaps++; s.lastSwapAt = g.t;
    g.sfx.whoosh(); g.flash('#e8b730', 0.25); g.rumble(120, 0.5); g.shake(5);
    const h = s.body[0]; g.burst(OX + (h.x + 0.5) * CELL, OY + (h.y + 0.5) * CELL, { count: 18, colors: ['#e8b730', '#ffffff'] });
  },
  die(g) {
    const s = g.state, h = s.body[0];
    if (g.t - s.lastSwapAt < 1.5) g.count('смертей сразу после разворота');
    g.hurt(OX + (h.x + 0.5) * CELL, OY + (h.y + 0.5) * CELL);
    if (g.lives > 0) { this.spawnSnake(g); s.swapT = 0; }
  },

  out(p) { return p.x < 0 || p.y < 0 || p.x >= COLS || p.y >= ROWS; },
  onBody(g, p) { return g.state.body.some(b => b.x === p.x && b.y === p.y); },
  plan(g) { // автоповорот выбирается заранее и рисуется стрелкой: видно = правда
    const s = g.state, h = s.body[0], [dx, dy] = DIRS[s.dir];
    if (Math.round(g.cfg.wallMode) !== 1 || !this.out({ x: h.x + dx, y: h.y + dy })) { s.planned = null; return; }
    const key = h.x + ',' + h.y + ',' + s.dir;
    if (s.plannedKey === key) return;
    const opts = (dx ? ['up', 'down'] : ['left', 'right']).filter(d => { const [ax, ay] = DIRS[d], p = { x: h.x + ax, y: h.y + ay }; return !this.out(p); });
    const safe = opts.filter(d => { const [ax, ay] = DIRS[d]; return !this.onBody(g, { x: h.x + ax, y: h.y + ay }); });
    const pool = safe.length ? safe : opts;
    s.planned = pool.length ? g.pick(pool) : null; s.plannedKey = key;
  },
  update(g, dt) {
    const s = g.state, c = g.cfg, mode = Math.round(c.bMode);
    // ввод: очередь поворотов, без разворота на 180°
    for (const k of ['up', 'down', 'left', 'right']) if (g.pressed[k]) {
      const last = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
      const [lx, ly] = DIRS[last], [nx, ny] = DIRS[k];
      if (lx + nx !== 0 || ly + ny !== 0) { if (s.queue.length < 3 && k !== last) s.queue.push(k); }
    }
    // кнопка B
    s.dashCd = Math.max(0, s.dashCd - dt); s.swapCdT = Math.max(0, s.swapCdT - dt); s.dash = Math.max(0, s.dash - dt);
    if (g.pressed.b) {
      if (mode === 0 && s.dashCd <= 0) { s.dash = c.dashTime; s.dashCd = c.dashCd + c.dashTime; g.sfx.power(); g.count('рывков'); }
      else if (mode === 1 && s.swapCdT <= 0) { this.swap(g); s.swapCdT = c.swapCd; }
      else g.tone(140, 0.08, 'square', 0.06);
    }
    // автоматический разворот
    if (mode !== 1) {
      s.swapT += dt;
      const left = c.swapTime - s.swapT;
      if (left <= c.warnTime && left > 0) { const sec = Math.ceil(left * 2); if (sec !== s.ticked) { s.ticked = sec; g.tone(sec <= 1 ? 1200 : 900, 0.05, 'square', 0.06); } }
      if (left <= 0) { this.swap(g); s.ticked = -1; }
    }
    // сложность
    s.diffT += dt;
    if (s.diffT >= c.diffEvery) { s.diffT = 0; s.extraSpeed += c.speedUp; g.popup(g.W / 2, 60, 'быстрее!', '#e8b730', 20); }
    const step = Math.max(c.minStep, c.stepTime - s.extraSpeed) * (s.dash > 0 ? 0.5 : 1);
    s.acc += dt;
    while (s.acc >= step) {
      s.acc -= step;
      if (s.queue.length) s.dir = s.queue.shift();
      const wm = Math.round(c.wallMode), h = s.body[0];
      let [dx, dy] = DIRS[s.dir], nh = { x: h.x + dx, y: h.y + dy };
      if (this.out(nh) && wm === 1) {
        this.plan(g);
        if (s.planned) { s.dir = s.planned; [dx, dy] = DIRS[s.dir]; nh = { x: h.x + dx, y: h.y + dy }; g.count('автоповоротов'); g.tone(700, 0.05, 'triangle', 0.05); }
      }
      if (this.out(nh) && wm === 2) { nh.x = (nh.x + COLS) % COLS; nh.y = (nh.y + ROWS) % ROWS; }
      // стена = узорная рамка, ровно по краю поля
      if (this.out(nh)) { this.die(g); return; }
      const tailMoves = s.grow === 0;
      const hit = s.body.some((b, i) => b.x === nh.x && b.y === nh.y && !(tailMoves && i === s.body.length - 1));
      if (hit) { this.die(g); return; }
      s.body.unshift(nh);
      if (s.grow > 0) s.grow--; else s.body.pop();
      if (nh.x === s.food.x && nh.y === s.food.y) {
        s.grow += Math.round(c.growPer);
        const pts = Math.round(10 + c.pointsLen * s.body.length);
        g.addScore(pts, OX + (nh.x + 0.5) * CELL, OY + nh.y * CELL);
        g.sfx.coin(); g.burst(OX + (nh.x + 0.5) * CELL, OY + (nh.y + 0.5) * CELL, { count: 14, colors: ['#e8b730', '#fff3c4'] });
        this.placeFood(g);
      }
      s.maxLen = Math.max(s.maxLen, s.body.length + s.grow);
    }
  },

  draw(g, ctx) {
    const s = g.state, c = g.cfg;
    // небо и горы Лаго-Наки с плоскими вершинами
    const gr = ctx.createLinearGradient(0, 0, 0, g.H); gr.addColorStop(0, '#0e2a3a'); gr.addColorStop(1, '#123a2e');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#1b4a3c';
    ctx.beginPath(); ctx.moveTo(0, 260); ctx.lineTo(120, 150); ctx.lineTo(300, 150); ctx.lineTo(420, 230); ctx.lineTo(560, 120); ctx.lineTo(760, 120); ctx.lineTo(880, 210); ctx.lineTo(960, 170); ctx.lineTo(960, 540); ctx.lineTo(0, 540); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(120, 150, 180, 6); ctx.fillRect(560, 120, 200, 6);
    // поле
    const W = COLS * CELL, H = ROWS * CELL;
    ctx.fillStyle = 'rgba(8,24,18,.82)'; ctx.fillRect(OX, OY, W, H);
    ctx.strokeStyle = 'rgba(232,183,48,.06)'; ctx.lineWidth = 1;
    for (let x = 1; x < COLS; x++) { ctx.beginPath(); ctx.moveTo(OX + x * CELL, OY); ctx.lineTo(OX + x * CELL, OY + H); ctx.stroke(); }
    for (let y = 1; y < ROWS; y++) { ctx.beginPath(); ctx.moveTo(OX, OY + y * CELL); ctx.lineTo(OX + W, OY + y * CELL); ctx.stroke(); }
    // узорная рамка: адыгейский орнамент-ромбы, стена совпадает с краем поля
    ctx.fillStyle = '#7a1f2b'; ctx.fillRect(OX - 12, OY - 12, W + 24, 12); ctx.fillRect(OX - 12, OY + H, W + 24, 12); ctx.fillRect(OX - 12, OY, 12, H); ctx.fillRect(OX + W, OY, 12, H);
    ctx.fillStyle = '#e8b730';
    const rh = (x, y) => { ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 5); ctx.lineTo(x - 5, y); ctx.fill(); };
    for (let x = OX; x <= OX + W; x += 20) { rh(x, OY - 6); rh(x, OY + H + 6); }
    for (let y = OY + 20; y < OY + H; y += 20) { rh(OX - 6, y); rh(OX + W + 6, y); }
    if (!s.body) return;
    // хычин
    const fx = OX + (s.food.x + 0.5) * CELL, fy = OY + (s.food.y + 0.5) * CELL;
    ctx.fillStyle = '#e8b730'; ctx.beginPath(); ctx.ellipse(fx, fy, 11, 9, 0, 0, 6.283); ctx.fill();
    ctx.strokeStyle = '#a36d12'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(fx, fy, 5, 0, 6.283); ctx.stroke();
    // змейка
    const mode = Math.round(c.bMode), left = c.swapTime - s.swapT, warn = mode !== 1 && left <= c.warnTime;
    const blinkOn = Math.floor(g.t * 8) % 2 === 0;
    if (!g.blink()) s.body.forEach((b, i) => {
      const x = OX + b.x * CELL, y = OY + b.y * CELL, tail = i === s.body.length - 1, head = i === 0;
      let col = i % 2 ? '#2fae6b' : '#3cc47c';
      if (head) col = '#7cf5a8';
      if (tail && warn) col = blinkOn ? '#ffffff' : '#e8b730';
      if (s.dash > 0 && !tail) col = head ? '#fff3c4' : '#e8d070';
      ctx.fillStyle = col; ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
      if (head) { ctx.fillStyle = '#0b1a14'; const [dx, dy] = DIRS[s.dir]; ctx.fillRect(x + CELL / 2 + dx * 6 - 3 - dy * 6, y + CELL / 2 + dy * 6 - 3 - dx * 6, 5, 5); ctx.fillRect(x + CELL / 2 + dx * 6 - 3 + dy * 6, y + CELL / 2 + dy * 6 - 3 + dx * 6, 5, 5); }
    });
    // стрелка автоповорота у стены
    this.plan(g);
    if (s.planned && !g.blink()) {
      const h = s.body[0], [dx, dy] = DIRS[s.planned], cx = OX + (h.x + 0.5) * CELL + dx * CELL * 0.8, cy = OY + (h.y + 0.5) * CELL + dy * CELL * 0.8;
      ctx.fillStyle = '#7cf5a8'; ctx.beginPath(); ctx.moveTo(cx + dx * 9, cy + dy * 9); ctx.lineTo(cx - dy * 7, cy - dx * 7); ctx.lineTo(cx + dy * 7, cy + dx * 7); ctx.closePath(); ctx.fill();
    }
    // стрелка: куда поползёт голова после разворота
    if (warn && s.body.length > 1) {
      const t = s.body[s.body.length - 1], p = s.body[s.body.length - 2], d = this.dirOf(t, p), [dx, dy] = DIRS[d];
      const cx = OX + (t.x + 0.5) * CELL + dx * CELL, cy = OY + (t.y + 0.5) * CELL + dy * CELL;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - dx * 10, cy - dy * 10); ctx.lineTo(cx + dx * 8, cy + dy * 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + dx * 10, cy + dy * 10); ctx.lineTo(cx + dx * 2 - dy * 7, cy + dy * 2 - dx * 7); ctx.lineTo(cx + dx * 2 + dy * 7, cy + dy * 2 + dx * 7); ctx.closePath(); ctx.fillStyle = '#ffffff'; ctx.fill();
    }
    // приборы
    if (mode !== 1) g.text(warn ? 'РАЗВОРОТ ЧЕРЕЗ ' + Math.max(0, left).toFixed(1) : 'разворот через ' + Math.ceil(Math.max(0, left)), g.W / 2, 50, { size: warn ? 20 : 14, color: warn ? '#ffffff' : '#9fc9b4', align: 'center' });
    const bText = mode === 0 ? (s.dash > 0 ? 'РЫВОК!' : s.dashCd > 0 ? 'рывок через ' + s.dashCd.toFixed(1) : 'рывок готов · B') : mode === 1 ? (s.swapCdT > 0 ? 'разворот через ' + s.swapCdT.toFixed(1) : 'разворот готов · B') : '';
    if (bText) g.text(bText, g.W - 40, 50, { size: 14, color: '#e8b730', align: 'right' });
    g.text('длина ' + s.body.length, 300, 30, { size: 14, color: '#9fc9b4' });
  },

  overNote(g, tele) {
    const s = g.state;
    return `Самая длинная змейка: <b>${s.maxLen}</b>. Разворотов: <b>${s.swaps}</b>. Смертей сразу после разворота: <b>${tele.custom['смертей сразу после разворота'] || 0}</b> из ${3}.` + (Math.round(g.cfg.bMode) === 0 ? ` Рывков: ${tele.custom['рывков'] || 0}.` : '') + (Math.round(g.cfg.wallMode) === 1 ? ` Автоповоротов у стены: ${tele.custom['автоповоротов'] || 0}.` : '');
  },
};
