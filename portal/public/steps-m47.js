// Шаги и сцены модулей 4–7 (уроки 14–28, аудит 21.10.2026, сессия 6). Подключается после steps-m3.js, берёт помощники страницы
// (S, Games, STEPS) и библиотеку сцен MOTION из steps-m4.js. На проекторе файл тоже грузится — ради сцен театра (В5)
// и вкладок «🗺 Квест» и «👑 Совет».
// Сцены: «Кадр в тумане» (загадка урока 16), «Запись генератора» (видео-петля урока 17), «Три кадра комнаты» (загадка урока 20),
//   кадры гостей: уровень Spelunky из комнат-шаблонов (урок 17) и разговор-пазл Florence (урок 22).
// Типы шагов:
//   gost  — гость урока (Г1): мысль разработчика донора своими словами, кадр его игры сценой и минута на круге; потом вопрос и голос класса.
//           Поля: who, role, quote, source, anim, seconds (60), ask (через сколько секунд вопрос, 10), question, options, right, why, after.
//   kvest — урок-квест (Г4, урок 16): класс вместе исследует одну большую карту донора, секреты общие. Игра в рамке шлёт находку
//           (lab.net), шаг отдаёт игре, что нашёл класс. Под игрой — план квеста с никами нашедших. Поля: game, cfg, map (строки карты,
//           'S' — секрет), question, options, own. Сервер — lib/m47.js, на проекторе — вкладка «🗺 Квест».
//   sovet — совет аула (Г1 «игра класса», урок 19): учитель на проекторе ведёт карты, класс голосует ← или →, большинство решает
//           за всех, решения возвращаются картами-эхом. Поля: scales [{ icon, label }], start, cards [{ id, who, icon, text,
//           left/right: { label, fx: [±шкалы] }, if: { card, side } }], question, options, after. Сервер — lib/m47.js.
//   muzei — музей класса (Г4, урок 20): игры урока — залы экспозиции, гость ходит по залам, играет и оставляет записку в книге
//           отзывов; автор видит записки в своём зале. Поля: need (залов), ask { label, hint }, emotions, deck (готовые записки).
'use strict';
(function () {
  const M = window.LabMotion;
  if (!M) return;
  const { MOTION } = M;
  const { TAU, clamp, seg, io, ob, lerp, rr, text, disc, glow, sky, hero, arrow, confetti } = M.kit;
  const calm = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const emo = (g, e, x, y, px = 24) => { g.fillStyle = '#ffffff'; g.font = `${px}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, x, y); };
  const bell = k => Math.sin(clamp(k, 0, 1) * Math.PI);
  // подпись в плашке
  function note(g, s, x, y, k, col = '#ffe08a', bgc = 'rgba(11,16,32,.9)') {
    if (k <= 0) return;
    g.font = "800 13px system-ui,-apple-system,'Segoe UI',sans-serif"; const w = g.measureText(s).width + 22;
    g.save(); g.globalAlpha = clamp(k, 0, 1); g.translate(x, y); g.scale(0.85 + 0.15 * ob(k), 0.85 + 0.15 * ob(k)); rr(g, -w / 2, -14, w, 28, 9, bgc, col); text(g, s, 0, 1, col, 13); g.restore();
  }
  function cap(g, s, col = '#f2efe6', y = 284, bgc = 'rgba(11,16,32,.82)') {
    g.font = "800 14px system-ui,-apple-system,'Segoe UI',sans-serif"; const w = Math.min(620, g.measureText(s).width + 28);
    rr(g, 320 - w / 2, y - 15, w, 30, 10, bgc); text(g, s, 320, y, col, 14);
  }
  const prng = seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  /* =================== урок 16: загадка «Кадр в тумане» =================== */
  // туман, путница со спины, три пути: тёмные скалы слева, столб света вдали, густой туман справа. После ответа (c.reveal) — подписи
  MOTION['tuman-kadr'] = (g, t, W, H, c = {}) => {
    sky(g, W, H, '#56637a', '#9aa6b4');
    const R = !!c.reveal, pulse = 0.75 + 0.25 * Math.sin(t * 2.4);
    // дальняя гряда и вершина со светом
    g.fillStyle = '#6f7b8f'; g.beginPath(); g.moveTo(0, 170); g.lineTo(120, 120); g.lineTo(240, 150); g.lineTo(360, 96); g.lineTo(470, 140); g.lineTo(640, 118); g.lineTo(640, 300); g.lineTo(0, 300); g.fill();
    g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,240,190,${0.3 * pulse})`; g.beginPath(); g.moveTo(352, 98); g.lineTo(368, 98); g.lineTo(404, -10); g.lineTo(316, -10); g.fill(); g.restore();
    glow(g, 360, 98, 46 * pulse, '#fff3b0'); disc(g, 360, 98, 5, '#fffbe0');
    // тёмные скалы слева
    g.fillStyle = '#2c3240'; g.beginPath(); g.moveTo(0, 300); g.lineTo(0, 150); g.lineTo(46, 128); g.lineTo(96, 160); g.lineTo(150, 146); g.lineTo(190, 200); g.lineTo(170, 300); g.fill();
    // земля и тропинки
    g.fillStyle = '#7f8b77'; g.fillRect(0, 214, W, 86);
    g.fillStyle = 'rgba(217,194,122,.55)'; g.beginPath(); g.moveTo(300, 300); g.lineTo(340, 214); g.lineTo(352, 214); g.lineTo(350, 300); g.fill();
    // туман слоями, справа гуще
    for (let i = 0; i < 6; i++) { const y = 150 + i * 26, dx = Math.sin(t * 0.4 + i) * 40; const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, 'rgba(210,218,226,.10)'); gr.addColorStop(0.55, 'rgba(210,218,226,.22)'); gr.addColorStop(1, 'rgba(225,230,236,.85)'); g.fillStyle = gr; g.fillRect(dx - 40, y, W + 80, 30); }
    // путница со спины
    hero(g, 324, 262, 14, '#ff8a4c', 1);
    if (!R) return;
    const k = seg((t % 6) + 2, 2, 3);
    g.setLineDash([6, 8]); g.strokeStyle = '#ffd23f'; g.lineWidth = 3; g.beginPath(); g.moveTo(324, 244); g.lineTo(lerp(324, 360, k), lerp(244, 110, k)); g.stroke(); g.setLineDash([]);
    note(g, '☀ Свет — самое яркое пятно', 470, 60, 1, '#ffe08a');
    note(g, 'Тёмные скалы — «туда не надо»', 110, 112, 1, '#9aa3c7');
    note(g, 'Густой туман — ничего не видно', 540, 190, 1, '#9aa3c7');
    cap(g, 'Свет и контраст ведут взгляд: почти все идут к свету без единой стрелки', '#7cf5a8');
  };

  /* =================== урок 17: гость — уровень Spelunky из комнат =================== */
  // сетка 4 × 4 комнаты-шаблона: путь сверху вниз собирается первым, остальные комнаты — потом; c.reveal — подпись «путь гарантирован»
  const SPL_PATH = [[1, 0], [2, 0], [2, 1], [1, 1], [0, 1], [0, 2], [1, 2], [1, 3], [2, 3], [3, 3]];
  MOTION['gost-spelunky'] = (g, t, W, H, c = {}) => {
    t %= 9; g.fillStyle = '#1a1208'; g.fillRect(0, 0, W, H);
    const s = 62, x0 = 196, y0 = 18, onPath = (x, y) => SPL_PATH.some(p => p[0] === x && p[1] === y);
    const rnd = prng(17);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const pi = SPL_PATH.findIndex(p => p[0] === x && p[1] === y), at = pi >= 0 ? 0.3 + pi * 0.32 : 3.8 + (y * 4 + x) * 0.12, k = ob(seg(t, at, at + 0.35));
      const X = x0 + x * s, Y = y0 + y * s;
      rr(g, X + 2, Y + 2, s - 4, s - 4, 6, k > 0 ? (pi >= 0 ? '#3a2a14' : '#2a2010') : '#140e06', k > 0 ? (pi >= 0 ? '#ffb547' : '#5a4628') : '#2a2010');
      if (k <= 0) continue;
      g.save(); g.globalAlpha = clamp(k, 0, 1);
      for (let j = 0; j < 6; j++) { const bx = X + 6 + Math.floor(rnd() * 6) * 8, by = Y + 8 + Math.floor(rnd() * 5) * 9; g.fillStyle = '#7a5a34'; g.fillRect(bx, by, 8, 8); } // камни комнаты-шаблона
      if (x === 1 && y === 0) emo(g, '🚪', X + s / 2, Y + s / 2, 22);
      if (x === 3 && y === 3) emo(g, '🏁', X + s / 2, Y + s / 2, 22);
      if (pi < 0 && (x + y) % 3 === 0) emo(g, '💎', X + s / 2, Y + s / 2, 16);
      g.restore();
    }
    // путь игрока по комнатам
    const pk = seg(t, 0.4, 3.6), n = Math.floor(pk * (SPL_PATH.length - 1));
    g.strokeStyle = '#ffd23f'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath();
    SPL_PATH.slice(0, n + 1).forEach(([x, y], i) => { const X = x0 + x * s + s / 2, Y = y0 + y * s + s / 2; if (i) g.lineTo(X, Y); else g.moveTo(X, Y); });
    g.stroke();
    text(g, 'Spelunky (2008): уровень из 16 комнат-шаблонов', 320, 272, '#ffe08a', 15);
    if (c.reveal) { note(g, 'Путь вниз строится первым', 100, 80, 1, '#ffd23f', 'rgba(26,18,8,.92)'); note(g, 'Остальные комнаты — потом', 540, 200, 1, '#c9a46a', 'rgba(26,18,8,.92)'); }
  };

  /* =================== урок 17: видео-петля «Запись генератора» =================== */
  // запись одного запуска генератора: правило копает пещеру → заливка от старта не дошла до выхода → генератор прорыл ход →
  // выход в самую дальнюю клетку → мышь подальше от старта. c.reveal — подписи по шагам. Карта — своё случайное блуждание с зерном
  const PZ = (() => {
    const Wd = 18, Hd = 10, m = [...Array(Hd)].map(() => Array(Wd).fill('#')), rnd = prng(4242), dig = [];
    const walk = (x, y, n, lo, hi) => { for (let i = 0; i < n; i++) { if (m[y][x] === '#') { m[y][x] = '.'; dig.push([x, y]); } const d = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(rnd() * 4)]; x = clamp(x + d[0], lo, hi); y = clamp(y + d[1], 1, Hd - 2); } };
    walk(2, 2, 70, 1, 7); if (m[5][7] === '#') { m[5][7] = '.'; dig.push([7, 5]); }
    walk(14, 6, 70, 10, 16); if (m[5][10] === '#') { m[5][10] = '.'; dig.push([10, 5]); }
    const flood = () => { const d = new Map([['2,2', 0]]), q = [[2, 2]]; while (q.length) { const [x, y] = q.shift(); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + a, Y = y + b, k = X + ',' + Y; if (m[Y] && m[Y][X] === '.' && !d.has(k)) { d.set(k, d.get(x + ',' + y) + 1); q.push([X, Y]); } } } return d; };
    m[2][2] = '.';
    const f1 = flood(), right = dig.filter(([x]) => x >= 10), exit0 = right.reduce((a, b) => (b[0] + b[1] > a[0] + a[1] ? b : a), right[0]);
    const tunnel = [[8, 5], [9, 5]]; tunnel.forEach(([x, y]) => { m[y][x] = '.'; });
    const f2 = flood(); let far = [2, 2], fd = 0; for (const [k, d] of f2) if (d > fd) { fd = d; far = k.split(',').map(Number); }
    return { Wd, Hd, dig, f1, f2, exit0, tunnel, far, fd, max1: Math.max(...f1.values()) };
  })();
  MOTION['petlya-zerna'] = (g, t, W, H, c = {}) => {
    g.fillStyle = '#0b1020'; g.fillRect(0, 0, W, H);
    const T = t % 10, R = !!c.reveal, s = 26, x0 = 86, y0 = 18, P = PZ;
    const dug = Math.floor(P.dig.length * seg(T, 0.2, 2.2)), dugSet = new Set(P.dig.slice(0, dug).map(p => p.join(',')));
    const tun = T > 5.2, wave1 = seg(T, 2.6, 4.0) * (P.max1 + 1), wave2 = seg(T, 5.8, 7.6) * (P.fd + 1);
    for (let y = 0; y < P.Hd; y++) for (let x = 0; x < P.Wd; x++) {
      const k = x + ',' + y, open = dugSet.has(k) || (x === 2 && y === 2 && T > 0.2) || (tun && P.tunnel.some(p => p[0] === x && p[1] === y));
      let col = open ? '#3a3226' : '#1c1a24';
      if (open && T < 5.2 && P.f1.has(k) && P.f1.get(k) < wave1) col = '#24507a';
      if (open && T > 5.8 && P.f2.has(k) && P.f2.get(k) < wave2) col = '#1f5a3c';
      if (tun && P.tunnel.some(p => p[0] === x && p[1] === y)) col = T < 5.8 ? '#7a5a14' : col;
      g.fillStyle = col; g.fillRect(x0 + x * s, y0 + y * s, s - 1, s - 1);
    }
    const cell = ([x, y]) => [x0 + x * s + s / 2, y0 + y * s + s / 2];
    if (T > 2.3) { const [a, b] = cell([2, 2]); disc(g, a, b, 9, '#7cf5a8'); }
    const ex = T < 5.2 ? P.exit0 : T > 7.6 ? P.far : null;
    if (T > 2.3 && ex) { const [a, b] = cell(ex); emo(g, '🚪', a, b, 18); }
    if (T > 4.0 && T < 5.2) { const [a, b] = cell(P.exit0); text(g, '✗', a, b - 20, '#ff5d6e', 22); }
    if (T > 7.9) { const [a, b] = cell(P.far); text(g, '✓', a, b - 20, '#7cf5a8', 22); }
    // мышь: сначала у старта, после проверки — в дальнем углу
    const bat = T < 8.4 ? [3, 3] : [P.far[0] - 1, Math.max(1, P.far[1] - 1)], [bx, by] = cell(bat);
    if (T > 2.3) emo(g, '🦇', bx, by, 16);
    text(g, T < 2.6 ? 'запись: генератор, зерно 4242' : T < 5.2 ? 'проверка заливкой от старта' : T < 7.9 ? 'ход прорыт, проверка ещё раз' : 'мир готов', 20, 286, '#9aa3c7', 12, 'left', 700);
    if (R) {
      note(g, '1. Правило копает пещеру', 320, 12 + 260, seg(T, 0.4, 0.8) * (T < 2.6 ? 1 : 0));
      note(g, '2. Заливка не дошла до выхода', 470, 46, seg(T, 3.9, 4.2) * (T < 5.2 ? 1 : 0), '#ff8a8a');
      note(g, '3. Генератор прорыл ход', 320, 162, seg(T, 5.2, 5.5) * (T < 7.6 ? 1 : 0), '#ffb547');
      note(g, '4. Выход — в самую дальнюю клетку, мышь — подальше', 320, 270, seg(T, 7.9, 8.3), '#7cf5a8');
    }
  };

  /* =================== урок 20: загадка «Три кадра комнаты» =================== */
  // три полароида без слов: стол на двоих, часы и свеча, стул у окна. Что здесь случилось? c.reveal — подписи-улики
  function polaroid(g, x, y, k, draw) {
    if (k <= 0) return;
    g.save(); g.translate(x + 85, y + 100); g.rotate((x % 3 - 1) * 0.04); g.scale(0.9 + 0.1 * ob(k), 0.9 + 0.1 * ob(k)); g.globalAlpha = clamp(k * 1.5, 0, 1);
    rr(g, -82, -96, 164, 186, 4, '#f4ede0'); g.save(); g.beginPath(); g.rect(-72, -86, 144, 132); g.clip(); g.translate(-72, -86); draw(); g.restore(); g.restore();
  }
  MOTION['tri-kadra-komnaty'] = (g, t, W, H, c = {}) => {
    sky(g, W, H, '#3a2a22', '#22180f');
    const T = c.reveal ? 9 : t % 12, R = !!c.reveal;
    polaroid(g, 22, 22, seg(T, 0.2, 0.8), () => { // стол на двоих: одна чашка выпита, вторая полная, пирог не тронут
      g.fillStyle = '#e9dcc4'; g.fillRect(0, 0, 144, 132); g.fillStyle = '#a8774e'; g.fillRect(0, 84, 144, 48);
      disc(g, 40, 80, 14, '#f2efe6'); disc(g, 104, 80, 14, '#f2efe6'); disc(g, 40, 80, 9, '#d9c7a8'); disc(g, 104, 80, 9, '#7a4a28');
      g.fillStyle = '#e0a060'; g.beginPath(); g.arc(72, 64, 22, Math.PI, 0); g.fill(); g.fillStyle = '#c86a3a'; g.fillRect(50, 62, 44, 6);
    });
    polaroid(g, 235, 30, seg(T, 2.6, 3.2), () => { // часы: стрелки бегут с шести до одиннадцати, свеча догорает
      g.fillStyle = '#d8c9ae'; g.fillRect(0, 0, 144, 132);
      disc(g, 72, 52, 34, '#f4ede0'); g.strokeStyle = '#5a3a26'; g.lineWidth = 3; g.beginPath(); g.arc(72, 52, 34, 0, TAU); g.stroke();
      const h = lerp(6, 11, seg(T, 3.2, 5.0)), ah = (h / 12) * TAU - Math.PI / 2, am = (h % 1) * TAU - Math.PI / 2 + h * TAU;
      g.lineWidth = 4; g.beginPath(); g.moveTo(72, 52); g.lineTo(72 + Math.cos(ah) * 18, 52 + Math.sin(ah) * 18); g.stroke();
      g.lineWidth = 2; g.beginPath(); g.moveTo(72, 52); g.lineTo(72 + Math.cos(am) * 27, 52 + Math.sin(am) * 27); g.stroke();
      const cH = lerp(34, 6, seg(T, 3.2, 5.0)); rr(g, 60, 122 - cH, 24, cH, 3, '#f2efe6'); glow(g, 72, 112 - cH, 12, 'rgba(255,200,80,.8)');
    });
    polaroid(g, 448, 22, seg(T, 5.4, 6.0), () => { // стул повёрнут к окну, плед, за окном ночь и пустая дорога
      g.fillStyle = '#cdb898'; g.fillRect(0, 0, 144, 132); g.fillStyle = '#0f1a33'; g.fillRect(30, 12, 84, 60);
      for (let i = 0; i < 6; i++) disc(g, 38 + i * 13, 20 + (i % 3) * 7, 1.4, '#fffbe8');
      g.fillStyle = '#5a5248'; g.fillRect(30, 58, 84, 14); g.strokeStyle = '#f4ede0'; g.lineWidth = 3; g.strokeRect(30, 12, 84, 60);
      rr(g, 52, 82, 40, 34, 4, '#8a5f3e'); rr(g, 52, 72, 40, 12, 4, '#a8774e'); rr(g, 46, 86, 22, 28, 6, '#3f8f88');
    });
    if (R) {
      note(g, 'Вторая чашка — полная', 107, 236, 1); note(g, 'Ждали с шести до одиннадцати', 320, 244, 1); note(g, 'Стул к окну — смотрели на дорогу', 533, 236, 1);
      cap(g, 'Здесь ждали гостя, а он не пришёл. Ни одного слова — только вещи', '#ffe08a', 278, 'rgba(43,29,22,.92)');
    }
  };

  /* =================== урок 22: гость — разговор-пазл Florence =================== */
  // два кадра одного разговора: в начале любви кусочки реплики крупные и складываются сами, в ссоре — мелкие и не подходят
  MOTION['gost-florence'] = (g, t, W, H, c = {}) => {
    t %= 9; g.fillStyle = '#fbf3ea'; g.fillRect(0, 0, W, H);
    const panel = (x, title, pieces, fit, col) => {
      rr(g, x, 30, 260, 210, 18, '#ffffff', '#e8d6c4'); text(g, title, x + 130, 52, '#6a4c93', 14);
      rr(g, x + 40, 76, 180, 70, 30, col); // пузырь реплики
      pieces.forEach((p, i) => {
        const k = ob(seg(t, 0.6 + i * 0.5 + (fit ? 0 : 2.4), 1.1 + i * 0.5 + (fit ? 0 : 2.4)));
        const px = lerp(x + 40 + (i % 3) * 70, x + 54 + i * (160 / pieces.length), fit ? k : k * 0.4), py = lerp(200, 100, fit ? k : k * 0.5);
        rr(g, px, py, 150 / pieces.length + (fit ? 6 : -4), 30, 6, fit ? '#ffb7a1' : '#9aa3c7');
      });
    };
    panel(40, 'Первое свидание', [0, 1], true, 'rgba(255,183,161,.35)');
    panel(340, 'Ссора', [0, 1, 2, 3, 4, 5], false, 'rgba(154,163,199,.3)');
    text(g, 'Florence (2018): разговор — это пазл', 320, 270, '#6a4c93', 15);
    if (c.reveal) { note(g, 'Два кусочка — слова легко', 170, 222, 1, '#c8668a', '#ffffff'); note(g, 'Шесть мелких — слова не идут', 470, 222, 1, '#4a3b6b', '#ffffff'); }
  };

  /* ================= план квеста: общая карта класса ================= */
  const KCOL = { '#': '#5f6678', T: '#2d6b3f', '~': '#3a7bd5', ',': '#d9c27a', o: '#ffd23f', L: '#9aa0b3', '@': '#7cf5a8', A: '#fff3b0', S: '#7f8b77', '.': '#7f8b77', ' ': '#7f8b77' };
  function kvestMap(cv, map, K, me) {
    const rows = String(map || '').split('\n'), Hm = rows.length, Wm = Math.max(...rows.map(r => r.length)), g = cv.getContext('2d');
    const s = Math.floor(Math.min(cv.width / Wm, cv.height / Hm)), ox = Math.floor((cv.width - Wm * s) / 2), oy = Math.floor((cv.height - Hm * s) / 2);
    g.fillStyle = '#0b1020'; g.fillRect(0, 0, cv.width, cv.height);
    rows.forEach((row, r) => [...row].forEach((ch, k) => { g.fillStyle = KCOL[ch] || '#7f8b77'; g.fillRect(ox + k * s, oy + r * s, s, s); }));
    // плато разделены проходами: подписи над тремя частями
    ['Утро на плато', 'Туманный лес', 'Каменные гряды'].forEach((n, i) => { if (Wm >= 100) text(g, n, ox + (i + 0.5) * (Wm / 3) * s, oy + 8, 'rgba(255,255,255,.85)', Math.max(10, s * 1.3)); });
    const found = (K && K.found) || [];
    found.forEach((f, i) => {
      const [k, r] = f.key.split(',').map(Number), x = ox + (k + 0.5) * s, y = oy + (r + 0.5) * s, mine = f.nick === me;
      glow(g, x, y, s * 3, mine ? 'rgba(124,245,168,.55)' : 'rgba(180,155,255,.6)'); disc(g, x, y, s * 0.9, mine ? '#7cf5a8' : '#b49bff');
      text(g, `${i + 1}. ${f.nick}`, x, y - s * 1.8, '#ffffff', Math.max(11, s * 1.5));
    });
  }

  // вкладка проектора «🗺 Квест»: карта класса крупно, счётчик, кто что нашёл, «Начать заново»
  function kvestPult(host, { code, lesson }) {
    const { el, api, toast, beep } = Lab;
    const P = { k: null };
    const step = () => (lesson() ? lesson().checkpoints.flatMap(c => c.steps).find(s => s.type === 'kvest') : null);
    async function load() { try { P.k = (await api('/api/teacher/kvest?code=' + encodeURIComponent(code()))).kvest; draw(); } catch (e) { toast(e.message, 'err'); } }
    function draw() {
      const st = step(), K = P.k;
      if (!st) { host.replaceChildren(el('div', { class: 'card' }, el('h2', {}, 'В этом уроке нет квеста'))); return; }
      const cv = el('canvas', { width: 1080, height: 300, class: 'm47-kmap', 'aria-label': 'Карта квеста класса' });
      host.replaceChildren(el('div', { class: 'card stack m3-pult' },
        el('div', { class: 'row' }, el('div', { class: 'eyebrow grow' }, '🗺 Урок-квест'), el('span', { class: 'pj-sub', 'data-kv-count': '' }, K ? `Класс нашёл ${K.found.length} из ${K.total}` : '')),
        el('h2', {}, st.title), cv,
        K && K.found.length ? el('ol', { class: 'm47-finds' }, K.found.map(f => el('li', {}, el('b', {}, f.nick), ' — секрет ', f.key.replace(',', ' · ')))) : el('p', { class: 'pj-sub' }, 'Пока никто не нашёл ни одного секрета. Туман густой — ищите вместе.'),
        el('div', { class: 'row' }, el('button', { class: 'btn ghost small', type: 'button', 'data-kv': 'reset', onclick: async () => { try { P.k = (await api('/api/teacher/kvest', { code: code(), action: 'reset' })).kvest; beep('tick'); draw(); } catch (e) { toast(e.message, 'err'); } } }, '↻ Начать квест заново'))));
      kvestMap(cv, st.map, K, null);
    }
    load();
    return { event() { load(); }, refresh() { load(); }, destroy() { host.replaceChildren(); } };
  }

  // вкладка проектора «👑 Совет»: карта крупно, голоса класса, шкалы аула, «Решить» и «Начать совет»
  function sovetScales(el, st, scales, fxShow) {
    return el('div', { class: 'm47-scales' }, st.scales.map((sc, i) => {
      const v = scales ? scales[i] : 50, d = fxShow ? fxShow[i] || 0 : 0;
      return el('div', { class: 'm47-scale' + (v <= 20 || v >= 80 ? ' edge' : '') + (d ? (d > 0 ? ' up' : ' down') : '') },
        el('span', { class: 'ic', 'aria-hidden': 'true' }, sc.icon), el('span', { class: 'm47-bar' }, el('i', { style: `height:${v}%` })), el('small', {}, sc.label + (d ? (d > 0 ? ' ▲' : ' ▼') : '')));
    }));
  }
  function sovetCard(el, card) {
    return el('div', { class: 'm47-card' + (card.echo ? ' echo' : '') }, el('span', { class: 'ic', 'aria-hidden': 'true' }, card.icon), el('b', {}, card.who), el('p', {}, card.text),
      card.echo ? el('span', { class: 'tag' }, '↩ решение вернулось') : null);
  }
  function endText(st, x) { const e = x.end || {}; return e.all ? `Совет решил все карты: ${x.log.length} сезонов правления.` : `Шкала «${st.scales[e.scale].label}» ${e.high ? 'переполнилась' : 'опустела'} — правление окончено через ${x.log.length} сезонов.`; }
  function sovetPult(host, { code, lesson }) {
    const { el, api, toast, beep } = Lab;
    const P = { x: null };
    const step = () => (lesson() ? lesson().checkpoints.flatMap(c => c.steps).find(s => s.type === 'sovet') : null);
    async function act(body) { try { P.x = (await api('/api/teacher/sovet', Object.assign({ code: code(), step: step() && step().id }, body))).sovet; beep('tick'); draw(); } catch (e) { toast(e.message, 'err'); } }
    async function load() { try { P.x = (await api('/api/teacher/sovet?code=' + encodeURIComponent(code()))).sovet; draw(); } catch (e) { toast(e.message, 'err'); } }
    function draw() {
      const st = step(), x = P.x;
      if (!st) { host.replaceChildren(el('div', { class: 'card' }, el('h2', {}, 'В этом уроке нет совета'))); return; }
      if (!x || !x.phase) {
        host.replaceChildren(el('div', { class: 'card stack m3-pult' }, el('div', { class: 'eyebrow' }, '👑 Совет аула'), el('h2', {}, st.title),
          el('p', { class: 'pj-sub' }, 'Класс правит аулом вместе. На каждую карту — голос с ноутбука: ← или →. Решает большинство. Следите за шкалами: ни одна не должна опустеть или переполниться.'),
          sovetScales(el, st, st.start || st.scales.map(() => 50)),
          el('div', { class: 'row' }, el('button', { class: 'btn warm', type: 'button', 'data-sv': 'start', onclick: () => act({ action: 'start' }) }, '▶ Начать совет'))));
        return;
      }
      const last = x.log[x.log.length - 1];
      if (x.phase === 'end') {
        host.replaceChildren(el('div', { class: 'card stack m3-pult' }, el('div', { class: 'eyebrow' }, '👑 Совет окончен'), el('h2', {}, endText(st, x)),
          sovetScales(el, st, x.scales, last && last.fx),
          el('ol', { class: 'm47-log' }, x.log.map(l => el('li', { class: l.echo ? 'echo' : '' }, `${l.icon} ${l.who}: «${l.label}» (${l.votes.left}:${l.votes.right})`))),
          el('div', { class: 'row' }, el('button', { class: 'btn', type: 'button', 'data-sv': 'start', onclick: () => act({ action: 'start' }) }, '↻ Новый совет'),
            el('button', { class: 'btn ghost small', type: 'button', 'data-sv': 'reset', onclick: () => act({ action: 'reset' }) }, 'Убрать'))));
        return;
      }
      const v = x.votes || { left: 0, right: 0 }, n = v.left + v.right;
      host.replaceChildren(el('div', { class: 'card stack m3-pult' },
        el('div', { class: 'row' }, el('div', { class: 'eyebrow grow' }, `👑 Совет аула · сезон ${x.season}`), el('span', { class: 'pj-sub', 'data-sv-n': '' }, `голосов: ${n}`)),
        el('div', { class: 'm47-table' }, sovetCard(el, x.card),
          el('div', { class: 'm47-sides' }, ['left', 'right'].map(sd => el('div', { class: 'm47-side' }, el('b', {}, (sd === 'left' ? '← ' : '') + x.card[sd] + (sd === 'right' ? ' →' : '')),
            el('span', { class: 'track' }, el('i', { style: `width:${n ? Math.round(100 * v[sd] / n) : 0}%` })), el('span', {}, String(v[sd])))))),
        sovetScales(el, st, x.scales, last && last.fx),
        last ? el('p', { class: 'pj-sub' }, `Прошлый сезон: ${last.who} — «${last.label}»${last.echo ? ' (решение вернулось!)' : ''}`) : null,
        el('div', { class: 'row' }, el('button', { class: 'btn warm', type: 'button', 'data-sv': 'decide', onclick: () => act({ action: 'decide' }) }, '⚖ Решить большинством'),
          el('button', { class: 'btn ghost small', type: 'button', 'data-sv': 'reset', onclick: () => act({ action: 'reset' }) }, '■ Закончить'))));
    }
    load();
    return { event() { load(); }, refresh() { load(); }, destroy() { host.replaceChildren(); } };
  }
  window.LabStepsM47 = { kvestPult, sovetPult };

  // дальше — типы шагов: на проекторе их нет
  if (typeof STEPS === 'undefined') return;
  const { el, api, toast, beep } = Lab;
  const fast = () => !!window.LAB_FAST;
  const bars = rows => el('div', { class: 'm6-bars' }, rows.map((r, i) => el('div', { class: 'm6-bar' + (r.me ? ' me' : '') },
    el('span', { class: 'lab' }, r.label), el('span', { class: 'track' }, el('i', { style: `--w:${Math.round(clamp(r.k, 0, 1) * 100)}%;--d:${i * 0.08}s` })), el('b', {}, r.show != null ? r.show : ''))));
  const tally = id => api('/api/m6/tally?step=' + encodeURIComponent(id)).catch(() => null);
  function classBars(box, st, mine, label = 'Класс ответил') {
    tally(st.id).then(r => {
      if (!r || r.hidden || !r.n) return;
      box.replaceChildren(el('div', { class: 'eyebrow' }, `${label} · ${r.n}`), bars(r.rows.map(x => ({ label: x.label, k: x.n / r.n, show: x.n, me: x.label === mine }))));
    });
  }
  // холст сцены вне шага motion: 10 кадров в секунду в автопроверке, за экраном не рисуется, «уменьшить движение» — последний кадр
  function sceneCanvas(anim, ctl, label) {
    const cv = el('canvas', { width: 640, height: 300, class: 'm4-cv m4-motion', 'aria-label': label || 'Анимация' }), g = cv.getContext('2d'), t0 = performance.now();
    let raf = 0, last = 0;
    const loop = now => {
      if (!cv.isConnected && now - t0 > 2000) { cancelAnimationFrame(raf); return; }
      raf = requestAnimationFrame(loop);
      const still = calm(), r = cv.getBoundingClientRect(), off = !cv.offsetParent || r.bottom < 0 || r.top > innerHeight;
      if ((window.LAB_LOWRES && now - last < 100) || (still && now - last < 400) || (off && last)) return;
      last = now; g.save(); g.clearRect(0, 0, 640, 300);
      try { MOTION[anim](g, still ? 9 : (now - t0) / 1000, 640, 300, Object.assign({ _t: 99, _id: null }, ctl)); } catch (e) { /* кадр пропущен */ }
      g.restore();
    };
    raf = requestAnimationFrame(loop);
    return cv;
  }
  function optionGrid(options, pick, onPick) {
    const grid = el('div', { class: 'opts', role: 'radiogroup' });
    options.forEach(o => grid.append(el('button', { type: 'button', class: 'opt' + (pick === o ? ' on' : ''), 'aria-pressed': String(pick === o), onclick: () => onPick(o) }, o)));
    return grid;
  }
  const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  /* ---------------- gost: гость урока ---------------- */
  STEPS.gost = ctx => {
    const st = ctx.step, total = fast() ? 1 : (st.seconds || 60), askAt = fast() ? 0.3 : (st.ask != null ? st.ask : 10);
    let v = Object.assign({}, ctx.value), pick = v.pick || null, tick = 0;
    if (!v.t0) { v.t0 = Date.now(); ctx.save(v); }
    const ctl = { reveal: !!v.pick };
    const host = el('div', { class: 'stack m47-gost' }), ask = el('div', { class: 'stack' }), tallyBox = el('div', { class: 'stack' });
    const ring = el('div', { class: 'm47-ring', role: 'timer', 'aria-label': 'Минута с гостем' }, el('b', {}, ''), el('small', {}, 'минута с гостем'));
    const left = () => Math.max(0, total - (Date.now() - v.t0) / 1000);
    function paintRing() {
      const l = v.pick ? 0 : left();
      ring.style.setProperty('--p', String(Math.round(100 * (1 - l / total))));
      ring.firstChild.textContent = l > 0 ? mmss(l) : '✓';
      if ((total - l >= askAt || l <= 0) && !shown) { shown = true; draw(); }
      if (l <= 0) clearInterval(tick);
    }
    function draw() {
      if (!shown) { ask.replaceChildren(el('p', { class: 'small muted' }, 'Прочитай и посмотри на кадр. Вопрос появится через несколько секунд.')); return; }
      if (!v.pick) {
        ask.replaceChildren(el('div', { class: 'm1-q' }, st.question), optionGrid(st.options, pick, o => { pick = o; beep('tick'); draw(); }),
          el('div', {}, el('button', { type: 'button', class: 'btn', onclick: () => {
            if (!pick) { toast('Выбери вариант'); return; }
            v = Object.assign({}, v, { pick, correct: pick === st.right }); ctl.reveal = true; ctx.save(v, true, true); beep(v.correct ? 'good' : 'bad'); paintRing(); draw();
          } }, 'Ответить')));
        return;
      }
      ask.replaceChildren(el('p', { class: 'verdict ' + (v.correct ? 'good' : 'bad') }, v.correct ? `🎯 Да, так думает ${st.who}.` : `Не совсем. Ответ: «${st.right}».`),
        el('p', { class: 'concept' }, st.why), ...(st.after ? [el('p', { class: 'small muted' }, st.after)] : []));
      classBars(tallyBox, st, v.pick);
    }
    let shown = !!v.pick || calm();
    host.append(
      el('div', { class: 'm47-guest' }, el('span', { class: 'm47-ava', 'aria-hidden': 'true' }, st.icon || '🎙'),
        el('div', { class: 'grow' }, el('div', { class: 'eyebrow' }, 'Гость урока'), el('b', {}, st.who), el('div', { class: 'small muted' }, st.role)), ring),
      el('blockquote', { class: 'm47-quote' }, st.quote, st.source ? el('cite', {}, st.source) : null),
      el('div', { class: 'm4-stage' }, sceneCanvas(st.anim, ctl, 'Кадр игры гостя: ' + (st.role || ''))), ask, tallyBox);
    draw(); paintRing();
    if (!v.pick) tick = setInterval(() => { if (!host.isConnected) { clearInterval(tick); return; } paintRing(); }, 1000);
    return host;
  };

  /* ---------------- kvest: урок-квест на одной карте ---------------- */
  STEPS.kvest = ctx => {
    const st = ctx.step;
    let v = Object.assign({ rounds: 0, found: 0 }, ctx.value), K = null, pick = v.pick || null, busy = false;
    const host = el('div', { class: 'stack m47-kvest' }), count = el('b', { class: 'm47-kcount', 'aria-live': 'polite' }), finds = el('div', { class: 'small muted' }), ask = el('div', { class: 'stack' }), tallyBox = el('div', { class: 'stack' });
    const cv = el('canvas', { width: 864, height: 220, class: 'm47-kmap', 'aria-label': 'План квеста: что нашёл класс' });
    const h = Games.frame({
      src: () => '/engine/game.html?game=../' + st.game, key: () => 'remake:' + st.id, cfg: st.cfg, label: 'Войти в туман',
      onReady: () => push(),
      onNet: m => { const key = m.me && m.me.secret; if (key) report(String(key)); },
      onOver: () => { v.rounds++; ctx.save(v); paintAsk(); },
    });
    // игре — что нашёл класс: room.found { 'кол,строка': ник }, total
    function push() { if (h.ready && K) h.post({ type: 'net', now: Date.now(), room: { found: Object.fromEntries(K.found.map(f => [f.key, f.nick])), total: K.total }, others: [] }); }
    async function report(key) {
      try {
        const r = await api('/api/kvest/found', { key }); K = r.kvest;
        v.found = K.mine; ctx.save(v); paint(); push();
        if (r.first) { beep('good'); toast(`Секрет открыт для всего класса! Класс нашёл ${K.found.length} из ${K.total}`); }
      } catch (e) { toast(e.message, 'err'); }
    }
    async function load() {
      if (busy) return; busy = true;
      try { K = (await api('/api/kvest')).kvest; if (K) { v.found = K.mine; } paint(); push(); } catch (e) { /* сеть моргнула */ }
      busy = false;
    }
    function paint() {
      if (!K) return;
      count.textContent = `🗺 Класс нашёл ${K.found.length} из ${K.total}` + (K.mine ? ` · твоих ${K.mine}` : '');
      finds.textContent = K.found.length ? 'Нашли: ' + K.found.map((f, i) => `${i + 1}. ${f.nick}`).join(' · ') : 'Пока никто ничего не нашёл. Первый секрет откроется для всех.';
      kvestMap(cv, st.map, K, S.me && S.me.nick);
      paintAsk();
    }
    function paintAsk() {
      if (!v.rounds && !v.found) { ask.replaceChildren(el('p', { class: 'small muted' }, 'Найди хотя бы один секрет или сыграй партию — потом вопрос.')); return; }
      if (!v.pick) {
        const own = el('input', { type: 'text', id: 'f-' + st.id + 'own', maxlength: 160, placeholder: 'Или своими словами', value: v.own || '' });
        own.addEventListener('input', () => { v.own = own.value; });
        ask.replaceChildren(el('div', { class: 'm1-q' }, st.question), optionGrid(st.options, pick, o => { pick = o; beep('tick'); paintAsk(); }), ...(st.own ? [own] : []),
          el('div', {}, el('button', { type: 'button', class: 'btn', onclick: () => {
            if (!pick && !(v.own || '').trim()) { toast('Выбери вариант или напиши своими словами'); return; }
            v = Object.assign({}, v, { pick: pick || null }); ctx.save(v, true, true); beep('good'); paintAsk();
          } }, 'Ответить')));
        return;
      }
      ask.replaceChildren(el('p', { class: 'verdict good' }, `Твой ответ: ${v.pick || v.own}.`), ...(st.after ? [el('p', { class: 'concept' }, st.after)] : []));
      classBars(tallyBox, st, v.pick, 'Что вело класс');
    }
    S.hooks.push(kind => { if (kind === 'kvest' && host.isConnected) load(); });
    const timer = setInterval(() => { if (!host.isConnected) { clearInterval(timer); h.destroy && h.destroy(); return; } if (h.ready) push(); }, 2000);
    host.append(h.box, Games.bar(h, el('b', {}, 'Одна карта на весь класс')), el('div', { class: 'row' }, count), cv, finds, ask, tallyBox);
    paintAsk(); load();
    return host;
  };

  /* ---------------- sovet: совет аула ---------------- */
  STEPS.sovet = ctx => {
    const st = ctx.step;
    let v = Object.assign({ votes: 0, cards: {} }, ctx.value), X = null, pick = v.pick || null;
    const host = el('div', { class: 'stack m47-sovet' }), table = el('div', { class: 'stack' }), ask = el('div', { class: 'stack' }), tallyBox = el('div', { class: 'stack' });
    async function load() { try { X = (await api('/api/sovet')).sovet; paint(); } catch (e) { table.replaceChildren(el('p', { class: 'err' }, e.message)); } }
    async function vote(side) {
      try {
        X = (await api('/api/sovet/vote', { card: X.card.id, side })).sovet;
        if (!v.cards[X.card.id]) v.votes++;
        v.cards = Object.assign({}, v.cards, { [X.card.id]: side }); ctx.save(v); beep('tick'); paint();
      } catch (e) { toast(e.message, 'err'); if (/сменилась|начался/.test(e.message)) load(); }
    }
    function paint() {
      if (!X || !X.phase) {
        table.replaceChildren(el('div', { class: 'm2-wait' }, el('span', { class: 'ic', 'aria-hidden': 'true' }, '👑'),
          el('div', {}, el('b', {}, 'Совет откроет учитель на проекторе'), el('p', { class: 'small muted' }, 'Класс правит аулом вместе: каждый голосует ← или →, решает большинство. Смотри на шкалы.'))),
        sovetScales(el, st, st.start || st.scales.map(() => 50)));
      } else if (X.phase === 'end') {
        table.replaceChildren(el('div', { class: 'eyebrow' }, '👑 Совет окончен'), el('h3', {}, endText(st, X)), sovetScales(el, st, X.scales),
          el('ol', { class: 'm47-log' }, X.log.map(l => el('li', { class: l.echo ? 'echo' : '' }, `${l.icon} ${l.who}: «${l.label}»` + (v.cards[l.card] ? (v.cards[l.card] === l.side ? ' — как ты' : ' — ты был против') : '')))));
      } else {
        const last = X.log[X.log.length - 1];
        table.replaceChildren(el('div', { class: 'row' }, el('span', { class: 'eyebrow grow' }, `Сезон ${X.season}`), el('span', { class: 'small muted' }, X.votes ? `класс: ← ${X.votes.left} · ${X.votes.right} →` : `голосов: ${X.n}`)),
          ...(last ? [el('p', { class: 'small muted' }, `Прошлый сезон класс решил: ${last.who} — «${last.label}».`)] : []),
          sovetCard(el, X.card),
          el('div', { class: 'row m47-vote' }, ['left', 'right'].map(sd => el('button', { type: 'button', class: 'btn' + (X.mine === sd ? '' : ' ghost'), 'data-sovet': sd, 'aria-pressed': String(X.mine === sd), onclick: () => vote(sd) },
            sd === 'left' ? `← ${X.card.left}` : `${X.card.right} →`))),
          sovetScales(el, st, X.scales, last && last.fx));
      }
      paintAsk();
    }
    function paintAsk() {
      if (!(v.votes >= 3 || (X && X.phase === 'end'))) { ask.replaceChildren(); return; }
      if (!v.pick) {
        ask.replaceChildren(el('div', { class: 'm1-q' }, st.question), optionGrid(st.options, pick, o => { pick = o; beep('tick'); paintAsk(); }),
          el('div', {}, el('button', { type: 'button', class: 'btn', onclick: () => {
            if (!pick) { toast('Выбери вариант'); return; }
            v = Object.assign({}, v, { pick }); ctx.save(v, true, true); beep('good'); paintAsk();
          } }, 'Ответить')));
        return;
      }
      ask.replaceChildren(el('p', { class: 'verdict good' }, `Твой ответ: ${v.pick}.`), ...(st.after ? [el('p', { class: 'concept' }, st.after)] : []));
      classBars(tallyBox, st, v.pick);
    }
    S.hooks.push(kind => { if (kind === 'sovet' && host.isConnected) load(); });
    host.append(table, ask, tallyBox);
    table.append(el('p', { class: 'muted' }, 'Загружаем совет…'));
    load();
    return host;
  };

  /* ---------------- muzei: музей класса ---------------- */
  STEPS.muzei = ctx => {
    const st = ctx.step, need = st.need || 2;
    let v = Object.assign({ notes: {} }, ctx.value), A = null, hall = null, frame = null, played = 0, form = { emotion: null, story: '' };
    const host = el('div', { class: 'stack m47-muzei' }), plan = el('div', { class: 'stack' }), room = el('div', { class: 'stack' }), mine = el('div', { class: 'stack' });
    const halls = () => (A ? A.games.filter(g => !g.mine && g.lesson && g.lesson.id === S.lesson.id && g.version) : []);
    const visited = () => Object.keys(v.notes).length;
    async function load() { try { A = await api('/api/arcade'); paintPlan(); paintMine(); } catch (e) { plan.replaceChildren(el('p', { class: 'err' }, e.message)); } }
    function maybeDone() { const n = halls().length; if (!ctx.done && (visited() >= need || (n > 0 && visited() >= n))) ctx.save(v, true, true); }
    function paintPlan() {
      const list = halls();
      if (hall) { plan.replaceChildren(); return; }
      plan.replaceChildren(el('div', { class: 'row' }, el('span', { class: 'eyebrow grow' }, `🏛 План музея · залов ${list.length}`), el('b', {}, `Ты побывал в ${visited()} из ${Math.min(need, list.length) || need}`)),
        list.length ? el('div', { class: 'm47-halls' }, list.map((g, i) => el('button', { type: 'button', class: 'm47-hall' + (v.notes[g.id] ? ' seen' : ''), 'data-hall': g.id, onclick: () => open(g) },
          el('span', { class: 'm47-no' }, `Зал ${i + 1}`), el('b', {}, `«${g.title}»`), el('small', {}, `автор: ${g.nick} · гостей: ${g.plays}`), v.notes[g.id] ? el('span', { class: 'tag ok' }, '✓ записка оставлена') : null)))
          : el('div', { class: 'm2-wait' }, el('span', { class: 'ic', 'aria-hidden': 'true' }, '🏛'), el('div', {}, el('b', {}, 'Залы ещё готовятся'), el('p', { class: 'small muted' }, 'Музей откроется, когда одноклассники соберут свои комнаты. Обнови через минуту.'))),
        el('div', {}, el('button', { class: 'btn ghost small', type: 'button', onclick: () => { if (!visited() && list.length) { toast('Сначала побывай хотя бы в одном зале'); return; } ctx.save(v, true); } }, 'Готово, дальше')));
    }
    function open(g) {
      hall = g; played = 0; form = { emotion: null, story: '' };
      if (frame) frame.destroy();
      frame = Games.frame({ src: () => `/play/${g.id}/${g.version}`, key: () => 'game:' + g.id, info: () => ({ version: g.version }), label: `Войти в зал «${g.title}»`,
        onOver: () => { played++; paintRoom(); }, onError: () => { played = played || 0.5; paintRoom(); } });
      beep('tick'); paintPlan(); paintRoom();
    }
    function paintRoom() {
      if (!hall) { room.replaceChildren(); return; }
      const g = hall, deck = (st.deck || []).map(t => el('button', { type: 'button', class: 'cardopt' + (form.story === t ? ' on' : ''), onclick: () => { form.story = t; beep('tick'); paintRoom(); } }, t));
      const inp = el('input', { type: 'text', id: 'f-' + st.id + 'story', maxlength: 200, placeholder: (st.ask && st.ask.hint) || 'Своими словами, одной фразой', value: form.story });
      inp.addEventListener('input', () => { form.story = inp.value; });
      const send = el('button', { type: 'button', class: 'btn', 'data-muzei': 'send', onclick: async () => {
        if (!played) { toast('Сначала побудь в зале: сыграй партию'); return; }
        if (!(form.story || '').trim()) { toast('Напиши записку: что здесь случилось?'); return; }
        send.disabled = true;
        try {
          await api('/api/playtest', { game: g.id, card: { emotions: form.emotion ? [form.emotion] : [], story: { text: form.story }, like: '', want: '', whatif: '' } });
          v.notes = Object.assign({}, v.notes, { [g.id]: { title: g.title, author: g.nick, story: form.story, emotion: form.emotion } }); ctx.save(v);
          beep('good'); toast('Записка в книге отзывов зала'); hall = null; if (frame) { frame.destroy(); frame = null; } maybeDone(); paintRoom(); paintPlan();
        } catch (e) { toast(e.message, 'err'); send.disabled = false; }
      } }, 'Оставить записку');
      room.replaceChildren(el('div', { class: 'row' }, el('h3', { class: 'grow' }, `🏛 Зал «${g.title}»`), el('span', { class: 'muted small' }, `автор ${g.nick} молчит`),
        el('button', { class: 'btn ghost small', type: 'button', onclick: () => { hall = null; if (frame) { frame.destroy(); frame = null; } paintRoom(); paintPlan(); } }, '← План музея')),
      frame.box, Games.bar(frame),
      el('div', { class: 'stack ptform' }, el('div', { class: 'eyebrow' }, 'Книга отзывов зала'), el('div', { class: 'm1-q' }, (st.ask && st.ask.label) || 'Что здесь случилось?'),
        deck.length ? el('div', { class: 'cardopts' }, deck) : null, inp,
        el('div', { class: 'emos', role: 'radiogroup' }, (st.emotions || []).map(e => el('button', { type: 'button', class: 'emo' + (form.emotion === e ? ' on' : ''), 'aria-pressed': String(form.emotion === e), onclick: () => { form.emotion = form.emotion === e ? null : e; beep('tick'); paintRoom(); } }, e))),
        el('div', { class: 'row' }, send, played ? null : el('span', { class: 'muted small' }, 'сначала партия'))));
    }
    function paintMine() {
      const card = A && A.mine.find(c => c.lesson && c.lesson.id === S.lesson.id);
      if (!card) { mine.replaceChildren(el('p', { class: 'small muted' }, 'Твоего зала в музее пока нет: собери игру урока — и к тебе придут гости.')); return; }
      const notes = ((card.discovery || {}).cards || []).filter(c => c.story && (c.story.text || c.story));
      mine.replaceChildren(el('div', { class: 'eyebrow' }, `🖼 Твой зал «${card.title}» · записок: ${notes.length}`),
        notes.length ? el('ul', { class: 'm47-notes' }, notes.map(n => el('li', {}, el('b', {}, n.nick), ' ', (n.emotions || []).join(' '), ` «${(n.story && n.story.text) || n.story}»`)))
          : el('p', { class: 'small muted' }, 'Гости ещё не оставили записок. Сравнишь их с тем, что задумал, когда придут.'));
    }
    S.hooks.push(kind => { if (kind === 'arcade' && host.isConnected) load(); });
    host.append(plan, room, mine);
    plan.append(el('p', { class: 'muted' }, 'Открываем музей…'));
    load();
    return host;
  };

  // итог шага одной строкой — для «Скопировать результат»
  const prevSummary = window.LabStepsM3Summary;
  window.LabStepsM3Summary = (step, v, a) => {
    switch (step.type) {
      case 'gost': return v.pick ? `ответ гостю: ${v.pick}${v.correct ? ' — верно' : ''}` : 'не ответил';
      case 'kvest': return `секретов нашёл: ${v.found || 0}; партий ${v.rounds || 0}` + (v.pick || v.own ? `; что привело: ${v.pick || v.own}` : '');
      case 'sovet': return `голосов в совете: ${v.votes || 0}` + (v.pick ? `; ответ: ${v.pick}` : '');
      case 'muzei': { const n = Object.values(v.notes || {}); return n.length ? `записок: ${n.length}; ` + n.map(x => `«${x.title}»: ${x.story}`).join('; ') : 'залов не посетил'; }
      default: return prevSummary ? prevSummary(step, v, a) : null;
    }
  };
})();
