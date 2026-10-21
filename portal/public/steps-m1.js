// Шаги модуля 1 «Что делает игру игрой» (уроки 2–4, аудит 21.10.2026, сессия 3). Подключается после student.js и steps-m6.js,
// берёт его помощники (S, ans, Games, valText) и библиотеку сцен MOTION из steps-m4.js. На проекторе файл тоже грузится — ради сцен
// для театра сцены (В5), типы шагов там не нужны. Сцены теории с переключателями (В1): решённая игра, гольф Сьютса, восемь деталей,
// доминирующая стратегия (урок 2); следы охотников, четыре охотника, мост MDA, предсказание (урок 3); цикл глагола, длина цикла,
// честный стакан (урок 4). Входы в урок (Г1) — типы шагов:
//   spor    — спор: две партии одной игры (А и Б), потом голос «какая лучше» и до двух причин; класс видит итог после своего голоса;
//   zagadka — загадка-сцена без слов: сцена идёт seconds секунд, потом вопрос; после ответа сцена подписывает себя (ctl.reveal);
//   slomano — сломанная игра: в доноре выключена одна деталь, 3 минуты найти какую; после ответа — «Сыграй починенную»;
//   koloda  — колода понятий: карты переворачиваются по нажатию, потом выбираешь главную для своей игры (урок 3: 8 удовольствий Леблана,
//             выбор уходит в поле Фабрики с from).
'use strict';
(function () {
  const M = window.LabMotion;
  if (!M) return;
  const { MOTION } = M;
  const { TAU, clamp, seg, io, ob, lerp, rr, text, disc, glow, arrow, confetti } = M.kit;
  const calm = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- помощники рисования ---------------- */
  const emo = (g, e, x, y, px = 24) => { g.fillStyle = '#ffffff'; g.font = `${px}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, x, y); };
  const bg = (g, W, H, col = '#0b1020') => { g.fillStyle = col; g.fillRect(0, 0, W, H); };
  // подпись-плашка: формула крупно, пояснение мельче
  // подпись сцены: не шире холста — шрифт ужимается (fit), а не вылезает за край
  function caption(g, big, small, x = 320, y = 270, col = '#ffe08a') {
    const maxW = Math.min(620, 2 * Math.min(x, 640 - x) - 12);
    fit(g, big, x, small ? y - 9 : y, maxW, col, 18);
    if (small) fit(g, small, x, y + 13, maxW, '#9aa3c7', 13, 'center', 600);
  }
  // время сцены после переключателя: сцена начинается заново, когда ученик щёлкнул (ctl._t), иначе — с начала шага
  const since = (t, c) => (c && c._t < 90 ? c._t : t);
  // состояние сцены на холсте (живые охотники): своё у каждого холста, сбрасывается, когда время пошло назад
  const MEM = new WeakMap();
  const mem = (g, t, init) => { let m = MEM.get(g); if (!m || t < m.t - 0.5) { m = Object.assign({ t }, init()); MEM.set(g, m); } return m; };

  /* ================= урок 1 ================= */
  // «Твист и спрятанная механика» (автор, 21.10.2026): перед сортировкой «Твист или спрятанная механика?» — одна мини-игра двумя
  // способами. Твист игра объявляет, игрок видит правило и играет иначе; спрятанная механика молчит, игрок видит только вспышку.
  const INV = ['..X..X..', '...XX...', '.XXXXXX.', 'XX.XX.XX', 'XXXXXXXX', '.X....X.'];
  const inv = (g, x, y, col, s = 4) => { g.fillStyle = col; INV.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === 'X') g.fillRect(x - 4 * s + i * s, y - 3 * s + j * s, s, s); })); };
  const cannon = (g, x, y, col = '#7cf5a8') => { rr(g, x - 20, y, 40, 12, 4, col); rr(g, x - 4, y - 12, 8, 14, 3, col); };
  const ALX = [140, 230, 320, 410, 500];
  // волна пришельцев: dead — кого уже сбили (индексы), пришельцы покачиваются
  function wave(g, t, dead, y = 74) { ALX.forEach((x, i) => { if (!dead.includes(i)) inv(g, x + 10 * Math.sin(t * 1.6), y, '#ff8fa0'); }); }
  const pop = (g, x, y, k, col = '#ffe08a') => { if (k <= 0 || k >= 1) return; for (let a = 0; a < 8; a++) disc(g, x + Math.cos(a * TAU / 8) * 26 * k, y + Math.sin(a * TAU / 8) * 26 * k, 4 * (1 - k), col); };
  // табличка правила в углу: open — правило видно, иначе замок
  function plate(g, x, y, w, icon, label, col, open = true) { rr(g, x, y, w, 34, 10, open ? 'rgba(124,245,168,.12)' : '#141c36', col); emo(g, icon, x + 20, y + 17, 18); fit(g, label, x + 38, y + 17, w - 46, open ? '#f2efe6' : '#6f7aa8', 14, 'left'); }
  function bubble(g, s, x, y, col = '#f2efe6', k = 1) { if (k <= 0) return; g.save(); g.translate(x, y); g.scale(k, k); g.font = "800 14px system-ui,-apple-system,'Segoe UI',sans-serif"; const w = g.measureText(s).width + 22; rr(g, -w / 2, -16, w, 32, 14, '#24304f', col); text(g, s, 0, 0, col, 14); g.restore(); }
  // сцена 1: твист — правило «снаряды летят дугой» объявлено баннером, висит в углу, игрок целится по-новому
  MOTION['tvist-gromko'] = (g, t, W, H) => {
    bg(g, W, H);
    const T = t % 7, hx0 = 230, hx1 = 440;
    const before = T < 1;
    // до объявления: стреляет прямо вверх под пришельцем
    const dead = [];
    if (T > 0.75) dead.push(1);
    if (T > 4.4) dead.push(2);
    wave(g, t, dead);
    if (before) { const p = seg(T, 0.2, 0.75); if (p > 0 && p < 1) disc(g, hx0, lerp(204, 80, p), 5, '#ffe08a'); }
    pop(g, ALX[1], 74, seg(T, 0.75, 1.2));
    // объявление: баннер прилетает крупно, трясёт экран, потом уезжает табличкой в угол
    const inK = ob(seg(T, 1, 1.4)), outK = io(seg(T, 2.3, 2.8));
    const hx = lerp(hx0, hx1, io(seg(T, 2.6, 3.2)));
    cannon(g, hx, 208);
    if (T > 1 && T < 2.8) {
      const sh = T < 1.5 ? Math.sin(T * 80) * 6 * (1.5 - T) : 0;
      g.fillStyle = `rgba(124,245,168,${0.25 * (1 - seg(T, 1, 1.6))})`; g.fillRect(0, 0, W, H);
      g.save(); g.translate(lerp(320, 470, outK) + sh, lerp(140, 26, outK)); const k = lerp(inK, 0.45, outK); g.scale(k, k);
      rr(g, -230, -46, 460, 92, 18, '#1a2445', '#7cf5a8');
      text(g, '📢 НОВОЕ ПРАВИЛО', 0, -18, '#7cf5a8', 16); text(g, 'Снаряды летят дугой!', 0, 16, '#f2efe6', 30);
      g.restore();
    }
    if (T >= 2.8) { plate(g, 380, 10, 250, '👁', 'Снаряды летят дугой', '#7cf5a8'); }
    // после: прицел-дуга пунктиром, снаряд летит по дуге в пришельца, который не над пушкой
    if (T > 3.2) {
      const P0 = [hx1, 200], P1 = [hx1 + 140, 40], P2 = [ALX[2] + 10 * Math.sin(t * 1.6), 74];
      const at = p => [lerp(lerp(P0[0], P1[0], p), lerp(P1[0], P2[0], p), p), lerp(lerp(P0[1], P1[1], p), lerp(P1[1], P2[1], p), p)];
      if (T < 4.4) { g.fillStyle = 'rgba(124,245,168,.55)'; for (let k = 0.05; k < 1; k += 0.07) { const [x, y] = at(k); disc(g, x, y, 2.5, 'rgba(124,245,168,.6)'); } }
      const p = seg(T, 3.7, 4.4); if (p > 0 && p < 1) { const [x, y] = at(p); glow(g, x, y, 16, 'rgba(255,224,138,.5)'); disc(g, x, y, 5, '#ffe08a'); }
      pop(g, ALX[2], 74, seg(T, 4.4, 4.9));
    }
    bubble(g, 'Ага, теперь целюсь иначе!', hx1 - 40, 168, '#7cf5a8', ob(seg(T, 3.3, 3.7)));
    caption(g, 'Твист: игра объявляет правило громко', 'игрок видит само правило и сразу играет иначе', 320, 268, '#7cf5a8');
  };
  // сцена 2: спрятанная механика — каждый пятый сбитый даёт ×5, игра молчит. Лупа автора (c.lupa) открывает правило в углу
  MOTION['sekret-tiho'] = (g, t, W, H, c = {}) => {
    const step = 0.55, n = Math.floor(t / step), p = (t % step) / step, hit = n % 5 === 4, flash = n % 5 === 0 && n > 0 && p < 0.9;
    bg(g, W, H, flash ? '#2a2410' : '#0b1020');
    if (flash) { g.fillStyle = `rgba(255,210,63,${0.35 * (1 - p)})`; g.fillRect(0, 0, W, H); }
    const tgt = n % 5, x = ALX[tgt] + 10 * Math.sin(t * 1.6);
    wave(g, t, [...Array(tgt).keys()]);
    cannon(g, x, 208, hit ? '#ffd23f' : '#7cf5a8');
    disc(g, x, lerp(204, 80, p), 5, hit ? '#ffd23f' : '#ffe08a');
    // счёт: обычный +10, пятый — +50 с золотом
    const done = Math.floor(n / 5) * 5, base = n - done;
    text(g, `сбито: ${n}`, 24, 26, '#9aa3c7', 14, 'left', 700);
    if (flash) {
      glow(g, ALX[4], 74, 120 * (0.4 + p), 'rgba(255,210,63,.55)');
      confetti(g, ALX[4], 74, p, 22, n);
      g.save(); g.translate(320, 150); const k = ob(seg(p, 0, 0.35)); g.scale(k, k); text(g, '×5!', 0, 0, '#ffd23f', 54); g.restore();
    } else if (base > 0 && p < 0.5) text(g, '+10', ALX[base - 1] + 10 * Math.sin(t * 1.6), 104 - 20 * p, '#9aa3c7', 14);
    // игрок видит только эффект
    emo(g, flash ? '🤩' : '🙂', 44, 206, 34);
    bubble(g, 'Ого! А почему?!', 110, 160, '#ffd23f', flash ? ob(seg(p, 0.05, 0.4)) : 0);
    // правило: замок у игрока, лупа автора его открывает
    const lu = !!c.lupa, k = io(seg(since(t, c), 0, 0.5));
    if (lu) { plate(g, 360, 10, 270, '🔍', 'Каждый 5-й сбитый — очки ×5', '#ffd23f'); g.globalAlpha = k; text(g, 'это знает только автор', 495, 56, '#ffd23f', 12, 'center', 700); g.globalAlpha = 1; }
    else plate(g, 400, 10, 230, '🔒', 'Правило: ???', '#3a4670', false);
    if (lu) caption(g, 'Правило знает автор — игра его не объявляет', 'игрок по-прежнему видит только вспышку', 320, 268, '#ffd23f');
    else caption(g, 'Спрятанная механика: игра молчит', 'игрок видит эффект — золотую вспышку, а правила не видит', 320, 268, '#ffd23f');
  };
  // сцена 3: проверка «Увидит ли игрок само правило?» — карточки падают в «Твист» или «Спрятанная механика».
  // c.obyavit: игра объявляет «×5» — та же механика уходит в твисты
  MOTION['tvist-proverka'] = (g, t, W, H, c = {}) => {
    bg(g, W, H);
    const tt = since(t, c), loud = !!c.obyavit;
    rr(g, 170, 14, 300, 46, 14, '#1a2445', '#f2efe6');
    emo(g, '👁', 196, 37, 22); fit(g, 'Увидит ли игрок само правило?', 334, 37, 250, '#f2efe6', 18);
    const L = [130, 170], R = [510, 170];
    arrow(g, 260, 62, 168, 132, '#7cf5a8', 3); arrow(g, 380, 62, 472, 132, '#ffd23f', 3);
    text(g, 'да', 196, 92, '#7cf5a8', 15); text(g, 'нет, только эффект', 470, 92, '#ffd23f', 14, 'left');
    rr(g, L[0] - 110, 136, 220, 96, 14, 'rgba(124,245,168,.08)', '#7cf5a8'); text(g, '📢 ТВИСТ', L[0], 154, '#7cf5a8', 17);
    rr(g, R[0] - 120, 136, 240, 96, 14, 'rgba(255,210,63,.08)', '#ffd23f'); text(g, '🔒 СПРЯТАННАЯ МЕХАНИКА', R[0], 154, '#ffd23f', 14);
    // карточка летит из-под вопроса в свою корзину
    function card(s, a, to, col) {
      const k = io(seg(tt, a + 0.4, a + 1.2)), inK = ob(seg(tt, a, a + 0.4)); if (inK <= 0) return;
      const x = lerp(320, to[0], k), y = lerp(110, to[1] + 12, k), sc = lerp(1, 0.8, k) * inK;
      g.save(); g.translate(x, y); g.scale(sc, sc); rr(g, -112, -17, 224, 34, 10, '#24304f', col); fit(g, s, 0, 0, 208, '#f2efe6', 14); g.restore();
    }
    card('Снаряды летят дугой', 0.2, L, '#7cf5a8');
    if (loud) card('📢 «Каждый пятый — ×5!»', 2.0, [L[0], L[1] + 30], '#7cf5a8');
    else card('Каждый 5-й сбитый — ×5', 2.0, R, '#ffd23f');
    if (loud) caption(g, 'Игра объявила «×5» — и это уже твист', 'игрок видит правило и охотится за пятым: играет иначе', 320, 268, '#7cf5a8');
    else caption(g, 'Проверка: увидит ли игрок само правило?', 'увидит — твист; видит только эффект — спрятанная механика', 320, 268, '#f2efe6');
  };

  /* ================= урок 2 ================= */
  // Камни мудреца: ☀ — ты, 🌙 — мудрец. Весы исхода: −1 мудрец выигрывает, 0 ничья, +1 ты.
  const CELL = (i, x0, y0, s) => [x0 + (i % 3) * s + s / 2, y0 + Math.floor(i / 3) * s + s / 2];
  function board(g, x0, y0, s, stones, opt = {}) {
    rr(g, x0 - 8, y0 - 8, s * 3 + 16, s * 3 + 16, 14, '#24304f');
    for (let i = 0; i < 9; i++) { const [cx, cy] = CELL(i, x0, y0, s); disc(g, cx, cy, s * 0.36, '#16203b'); }
    stones.forEach(st => {
      const [cx, cy] = CELL(st.at, x0, y0, s), k = st.k == null ? 1 : st.k;
      if (k <= 0) return;
      g.save(); g.translate(cx, cy); g.scale(k, k);
      if (st.p === 'x') { glow(g, 0, 0, s * 0.5, 'rgba(255,181,71,.35)'); disc(g, 0, 0, s * 0.3, '#ffb547'); emo(g, '☀', 0, 1, s * 0.34); }
      else { glow(g, 0, 0, s * 0.5, 'rgba(180,155,255,.3)'); disc(g, 0, 0, s * 0.3, '#b49bff'); emo(g, '🌙', 0, 1, s * 0.32); }
      g.restore();
    });
    if (opt.line) { const [a, b] = [CELL(opt.line[0], x0, y0, s), CELL(opt.line[2], x0, y0, s)]; g.strokeStyle = '#7cf5a8'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(lerp(a[0], b[0], opt.lineK), lerp(a[1], b[1], opt.lineK)); g.stroke(); }
  }
  // весы исхода: стрелка между «мудрец» и «ты», под ними — линия по ходам
  function scales(g, x, y, w, v, hist, n) {
    text(g, 'Весы исхода', x + w / 2, y, '#9aa3c7', 13, 'center', 700);
    rr(g, x, y + 16, w, 14, 7, '#1a2445');
    const gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, '#b49bff'); gr.addColorStop(0.5, '#3a4880'); gr.addColorStop(1, '#ffb547');
    rr(g, x, y + 16, w, 14, 7, gr);
    const nx = x + w / 2 + v * w / 2;
    g.fillStyle = '#f2efe6'; g.beginPath(); g.moveTo(nx, y + 34); g.lineTo(nx - 8, y + 48); g.lineTo(nx + 8, y + 48); g.fill();
    text(g, '🌙 мудрец', x, y + 60, '#b49bff', 12, 'left', 700); text(g, 'ничья', x + w / 2, y + 60, '#9aa3c7', 12, 'center', 700); text(g, 'ты ☀', x + w, y + 60, '#ffb547', 12, 'right', 700);
    // линия по ходам
    const gy = y + 120, gh = 44;
    g.strokeStyle = '#2a3560'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, gy); g.lineTo(x + w, gy); g.stroke();
    text(g, 'по ходам →', x + w, gy + gh + 10, '#6f7aa8', 11, 'right', 600);
    g.strokeStyle = '#7cf5a8'; g.lineWidth = 3; g.lineJoin = 'round'; g.beginPath();
    hist.forEach((h, i) => { const px = x + (i / Math.max(1, n - 1)) * w, py = gy - h * gh; if (i) g.lineTo(px, py); else g.moveTo(px, py); });
    g.stroke();
    hist.forEach((h, i) => disc(g, x + (i / Math.max(1, n - 1)) * w, gy - h * gh, 3.5, '#7cf5a8'));
  }
  // три партии: классика (ничья с первого хода), с ветром, с одним ходом наугад. v — весы после хода
  const MATCH = {
    klassika: { moves: [{ p: 'x', at: 4 }, { p: 'o', at: 0 }, { p: 'x', at: 2 }, { p: 'o', at: 6 }, { p: 'x', at: 3 }, { p: 'o', at: 5 }, { p: 'x', at: 7 }, { p: 'o', at: 1 }, { p: 'x', at: 8 }], v: [0, 0, 0, 0, 0, 0, 0, 0, 0], end: 'Ничья — как и было ясно с первого хода' },
    veter: { moves: [{ p: 'x', at: 4 }, { p: 'o', at: 0 }, { p: 'x', aim: 2, at: 5 }, { p: 'o', at: 2 }, { p: 'x', at: 1 }, { p: 'o', aim: 3, at: 6 }, { p: 'x', at: 3 }], v: [0, 0, -0.4, -0.7, 0.2, 0.8, 1], line: [3, 4, 5], end: 'Ты победил — исход решился в последний ход' },
    naugad: { moves: [{ p: 'x', at: 4 }, { p: 'o', at: 0 }, { p: 'x', at: 8 }, { p: 'o', at: 5, dice: true }, { p: 'x', at: 6 }, { p: 'o', at: 2 }, { p: 'x', at: 7 }], v: [0, 0, 0, 0.6, 1, 0.9, 1], line: [6, 7, 8], end: 'Мудрец ошибся один раз — и ты победил' },
  };
  MOTION.reshennaya = (g, t, W, H, c = {}) => {
    bg(g, W, H);
    const m = c.veter ? MATCH.veter : c.naugad ? MATCH.naugad : MATCH.klassika, step = 0.9, tt = since(t, c) % (m.moves.length * step + 3.2);
    const n = Math.min(m.moves.length, Math.floor(tt / step) + 1), x0 = 50, y0 = 48, s = 66;
    const stones = m.moves.slice(0, n).map((mv, i) => Object.assign({}, mv, { k: i === n - 1 ? ob(seg(tt, i * step, i * step + 0.35)) : 1 }));
    const done = n === m.moves.length && tt > n * step;
    board(g, x0, y0, s, stones, done && m.line ? { line: m.line, lineK: io(seg(tt, n * step, n * step + 0.5)) } : {});
    const last = m.moves[n - 1];
    if (last && last.aim != null && tt < n * step + 0.3) { // ветер сдвинул камень: призрак там, куда целился, и стрелка
      const [ax, ay] = CELL(last.aim, x0, y0, s), [bx, by] = CELL(last.at, x0, y0, s);
      g.globalAlpha = 0.45; disc(g, ax, ay, s * 0.3, last.p === 'x' ? '#ffb547' : '#b49bff'); g.globalAlpha = 1;
      arrow(g, ax, ay, bx, by, '#5fe0ff', 3); emo(g, '🌬', (ax + bx) / 2, (ay + by) / 2 - 14, 22);
    }
    if (last && last.dice && tt < n * step + 0.6) { const [bx, by] = CELL(last.at, x0, y0, s); emo(g, '🎲', bx + 22, by - 22, 22); }
    const v = m.v[n - 1] || 0, hist = m.v.slice(0, n);
    scales(g, 330, 40, 270, v, hist, m.moves.length);
    const live = c.veter || c.naugad;
    if (done) caption(g, m.end, live ? 'Исход был неизвестен до конца — поэтому интересно' : 'Мудрец не ошибается: игра решена', 465, 268, live ? '#7cf5a8' : '#ffb547');
    else caption(g, live ? 'Весы качаются' : 'Весы стоят на «ничья» с первого хода', '', 465, 268, live ? '#7cf5a8' : '#9aa3c7');
  };
  // гольф Сьютса: донести мяч рукой — задача решена; только клюшкой — появилась игра
  MOTION['golf-syuts'] = (g, t, W, H, c = {}) => {
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#13284a'); gr.addColorStop(1, '#0b1020'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = '#2f6b3a'; g.beginPath(); g.ellipse(320, 210, 300, 46, 0, 0, TAU); g.fill();
    const hx = 520, hy = 212; disc(g, hx, hy, 9, '#081008'); g.fillStyle = '#f2efe6'; g.fillRect(hx - 1, hy - 60, 2, 60); g.fillStyle = '#ff5d6e'; g.beginPath(); g.moveTo(hx + 1, hy - 60); g.lineTo(hx + 26, hy - 52); g.lineTo(hx + 1, hy - 44); g.fill();
    const tt = since(t, c);
    if (!c.klyushka) {
      const k = io(seg(tt % 5, 0.4, 2.6)), x = lerp(120, hx, k);
      emo(g, '🚶', x, 182, 40); disc(g, x + 12, 196, 6, '#ffffff');
      if (tt % 5 > 2.7) { emo(g, '✅', hx, 150, 26); caption(g, 'Мяч в лунке за 2 секунды. Задача решена', 'а играть незачем', 320, 52, '#9aa3c7'); }
      else caption(g, 'Донести мяч рукой — проще всего', '', 320, 52, '#9aa3c7');
      return;
    }
    // клюшкой: три удара — недолёт, перелёт, в лунку
    const shots = [[120, 330], [330, 560], [560, hx]], per = 1.6, T = tt % (shots.length * per + 2.4), i = Math.min(shots.length - 1, Math.floor(T / per)), k = seg(T, i * per + 0.3, i * per + 1.3);
    const [a, b] = shots[i], x = lerp(a, b, k), y = hy - Math.sin(k * Math.PI) * (i === 2 ? 30 : 90);
    emo(g, '🏌', a - 24, 176, 40);
    disc(g, x, y - 4, 6, '#ffffff');
    text(g, `Удар ${i + 1}`, 120, 40, '#ffe08a', 15, 'left');
    if (i === 1 && k > 0.9) emo(g, '😬', hx + 40, 160, 24);
    if (T > shots.length * per) { emo(g, '🎉', hx, 150, 30); caption(g, 'Игра — необязательное препятствие, которое выбираешь сам', 'Бернард Сьютс: клюшка мешает — и в этом вся игра', 320, 270, '#7cf5a8'); }
    else caption(g, 'Только клюшкой — рукой нельзя', 'препятствие добровольное', 320, 270, '#ffe08a');
  };
  // восемь деталей на партии донора: убери одну — и игра разваливается
  const DET = [
    ['👥', 'Игроки', 'ты и мудрец'], ['🎯', 'Цель', 'три в ряд'], ['👆', 'Процедуры', 'положи камень'], ['📏', 'Правила', 'в занятую нельзя'],
    ['🪨', 'Ресурсы', 'камни и ходы'], ['⚔', 'Конфликт', 'мудрец закрывает'], ['🔲', 'Границы', 'доска 3 × 3'], ['🏁', 'Исход', 'победа или ничья'],
  ];
  const DET_OFF = { cel: 1, pravila: 3, granicy: 6, konflikt: 5 };
  MOTION['vosem-detalei'] = (g, t, W, H, c = {}) => {
    bg(g, W, H);
    const tt = since(t, c), off = Object.keys(DET_OFF).filter(k => c[k]);
    DET.forEach(([ic, name, ex], i) => {
      const left = i < 4, x = left ? 18 : 452, y = 12 + (i % 4) * 56, k = ob(seg(t, 0.2 + i * 0.25, 0.6 + i * 0.25)), gone = off.some(o => DET_OFF[o] === i);
      if (k <= 0) return;
      g.save(); g.globalAlpha = gone ? 0.35 : 1; g.translate(x + 85, y + 24); g.scale(k, k); g.translate(-(x + 85), -(y + 24));
      rr(g, x, y, 170, 48, 12, gone ? '#2a1620' : '#1a2445', gone ? '#ff5d6e' : '#3a4880');
      emo(g, ic, x + 22, y + 24, 20); text(g, name, x + 42, y + 16, '#f2efe6', 15, 'left'); text(g, ex, x + 42, y + 33, '#9aa3c7', 12, 'left', 600);
      if (gone) { g.strokeStyle = '#ff5d6e'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 8, y + 8); g.lineTo(x + 162, y + 42); g.stroke(); }
      g.restore();
    });
    // доска: что с ней стало без детали
    const x0 = 230, y0 = 40, s = 60, R = (i, a) => Math.sin(i * 12.9898 + a * 78.233) * 43758.5453 % 1;
    let stones = [{ p: 'x', at: 4 }, { p: 'o', at: 0 }, { p: 'x', at: 2 }, { p: 'o', at: 6 }, { p: 'x', at: 3 }], verdict = ['Все восемь на месте — игра держится', 'убери одну — переключатели ниже'];
    const n = Math.min(stones.length, 1 + Math.floor((tt % 6) / 0.7));
    if (c.granicy) {
      rr(g, x0 - 8, y0 - 8, s * 3 + 16, s * 3 + 16, 14, 'rgba(36,48,79,.35)');
      for (let i = 0; i < 10; i++) { const k = seg(tt, i * 0.3, i * 0.3 + 0.4); if (k <= 0) continue; const x = x0 + 90 + Math.abs(R(i, 1)) * 260 - 130 + Math.cos(i * 2.1) * k * 60, y = y0 + 90 + Math.sin(i * 1.7) * k * 110; disc(g, clamp(x, 212, 428), clamp(y, 20, 230), 15, i % 2 ? '#b49bff' : '#ffb547'); }
      verdict = ['Нет границ — камни расползлись', 'где идёт игра? непонятно'];
    } else if (c.pravila) {
      board(g, x0, y0, s, []);
      const [cx, cy] = CELL(4, x0, y0, s), k = Math.min(7, Math.floor(tt / 0.5));
      for (let i = 0; i < k; i++) disc(g, cx + (i % 2 ? 3 : -3), cy - i * 7, 18, i % 2 ? '#b49bff' : '#ffb547');
      verdict = ['Нет правил — все кладут в одну лунку', 'можно всё — значит, выбора нет'];
    } else if (c.konflikt) {
      const xs = [{ p: 'x', at: 0 }, { p: 'x', at: 1 }, { p: 'x', at: 2 }], k = Math.min(3, 1 + Math.floor(tt / 0.6));
      board(g, x0, y0, s, xs.slice(0, k), k === 3 ? { line: [0, 1, 2], lineK: io(seg(tt, 1.4, 1.9)) } : {});
      verdict = ['Нет соперника — победа без усилия', 'скучно: исход известен'];
    } else if (c.cel) {
      const all = [4, 0, 2, 6, 3, 5, 7, 1, 8].map((at, i) => ({ p: i % 2 ? 'o' : 'x', at })), k = Math.min(9, 1 + Math.floor(tt / 0.4));
      board(g, x0, y0, s, all.slice(0, k));
      if (k === 9) emo(g, '🤷', x0 + 90, y0 + 90, 54);
      verdict = ['Нет цели — кладём камни просто так', 'зачем? никто не выиграл и не проиграл'];
    } else board(g, x0, y0, s, stones.slice(0, n));
    caption(g, verdict[0], verdict[1], 320, 268, off.length ? '#ff8a8a' : '#7cf5a8');
  };
  // доминирующая стратегия: одна кнопка всегда выигрывает — пока у неё нет цены
  MOTION.dominanta = (g, t, W, H, c = {}) => {
    bg(g, W, H);
    const btn = [['💥', 'Удар'], ['🛡', 'Блок'], ['💨', 'Рывок']], share = c.cena ? [0.36, 0.33, 0.31] : [0.9, 0.05, 0.05], win = c.cena ? [0.34, 0.33, 0.33] : [0.92, 0.04, 0.04];
    text(g, 'Что жмут игроки', 160, 32, '#9aa3c7', 14); text(g, 'Как часто выигрывает', 480, 32, '#9aa3c7', 14);
    btn.forEach(([ic, name], i) => {
      const y = 70 + i * 52, k = io(seg(since(t, c), 0.2 + i * 0.15, 1.2 + i * 0.15));
      emo(g, ic, 34, y, 24); text(g, name, 56, y, '#f2efe6', 14, 'left');
      rr(g, 120, y - 9, 180, 18, 9, '#1a2445'); rr(g, 120, y - 9, Math.max(18, 180 * share[i] * k), 18, 9, i === 0 && !c.cena ? '#ff5d6e' : '#5fe0ff');
      rr(g, 380, y - 9, 180, 18, 9, '#1a2445'); rr(g, 380, y - 9, Math.max(18, 180 * win[i] * k), 18, 9, i === 0 && !c.cena ? '#ff5d6e' : '#7cf5a8');
      text(g, Math.round(win[i] * 100 * k) + '%', 600, y, '#f2efe6', 13, 'right');
    });
    // лента нажатий: без цены — одно и то же
    const R = i => (Math.sin(i * 91.7) * 1e4) % 1;
    for (let i = 0; i < 14; i++) { const r = Math.abs(R(i + Math.floor(since(t, c) * 2))), b = c.cena ? (r < 0.36 ? 0 : r < 0.69 ? 1 : 2) : (r < 0.9 ? 0 : 1 + (r > 0.95)); emo(g, btn[b][0], 60 + i * 38, 232, 18); }
    if (c.cena) { text(g, 'Удар тратит силы: после него ты медленнее', 320, 200, '#ffe08a', 13, 'center', 700); caption(g, 'У каждой кнопки есть цена — выбор вернулся', 'исход снова неизвестен', 320, 272, '#7cf5a8'); }
    else caption(g, 'Одна кнопка выигрывает всегда — игры нет', 'доминирующая стратегия: исход известен заранее', 320, 272, '#ff8a8a');
  };

  /* ================= урок 3 ================= */
  // Волки «Ночного лабиринта»: красный Вожак гонится, розовый Хитрец наперерез, голубой Ловчий по напарнику, оранжевый Трус пугается вблизи
  const WOLF = { vozhak: ['#ff5d6e', 'Вожак: гонится'], hitrec: ['#ff9bd2', 'Хитрец: наперерез'], lovchiy: ['#5fe0ff', 'Ловчий: по напарнику'], trus: ['#ffb547', 'Трус: пугается вблизи'] };
  function wolf(g, x, y, col, s = 13, eyes = true) {
    disc(g, x, y, s, col);
    g.fillStyle = col; g.beginPath(); g.moveTo(x - s * 0.9, y - s * 0.3); g.lineTo(x - s * 0.5, y - s * 1.3); g.lineTo(x - s * 0.1, y - s * 0.7); g.fill();
    g.beginPath(); g.moveTo(x + s * 0.9, y - s * 0.3); g.lineTo(x + s * 0.5, y - s * 1.3); g.lineTo(x + s * 0.1, y - s * 0.7); g.fill();
    if (eyes) { disc(g, x - s * 0.35, y - s * 0.1, s * 0.22, '#fff'); disc(g, x + s * 0.35, y - s * 0.1, s * 0.22, '#fff'); }
  }
  const maze = (g, x0, y0, w, h, step = 40) => {
    g.fillStyle = '#0d1428'; g.fillRect(x0, y0, w, h);
    g.strokeStyle = '#1f2b52'; g.lineWidth = 1;
    for (let x = x0; x <= x0 + w; x += step) { g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y0 + h); g.stroke(); }
    for (let y = y0; y <= y0 + h; y += step) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + w, y); g.stroke(); }
  };
  // загадка без слов: следы четырёх волков сходятся к пастушку с разных сторон; ctl.reveal — после ответа подписать, кто как шёл
  const TRAILS = {
    vozhak: [[40, 150], [120, 150], [200, 150], [280, 150]],
    hitrec: [[600, 30], [520, 30], [440, 30], [440, 70], [440, 110], [400, 150], [370, 150]],
    lovchiy: [[330, 290], [330, 250], [330, 210], [330, 185]],
    trus: [[600, 290], [540, 270], [480, 240], [430, 215], [470, 250], [540, 280], [600, 295]],
  };
  const along = (pts, k) => { // точка на ломаной по доле пути
    const L = []; let sum = 0; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(d); sum += d; }
    let s = k * sum; for (let i = 0; i < L.length; i++) { if (s <= L[i]) { const q = L[i] ? s / L[i] : 0; return [lerp(pts[i][0], pts[i + 1][0], q), lerp(pts[i][1], pts[i + 1][1], q), Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0])]; } s -= L[i]; }
    const a = pts[pts.length - 2], b = pts[pts.length - 1]; return [b[0], b[1], Math.atan2(b[1] - a[1], b[0] - a[0])];
  };
  const LABEL_AT = { vozhak: [200, 122], hitrec: [480, 122], lovchiy: [236, 200], trus: [530, 214] };
  MOTION['sledy-ohotnikov'] = (g, t, W, H, c = {}) => {
    maze(g, 0, 0, W, H);
    const tt = c.reveal ? 9 : t % 11;
    Object.entries(TRAILS).forEach(([id, pts], wi) => {
      const col = WOLF[id][0], k = seg(tt, 0.4 + wi * 0.3, 6 + wi * 0.3), n = Math.floor(k * 22);
      for (let i = 0; i <= n; i++) { // лапы: парные точки по обе стороны пути
        const [x, y, a] = along(pts, i / 22), side = i % 2 ? 1 : -1, ox = Math.cos(a + Math.PI / 2) * 5 * side, oy = Math.sin(a + Math.PI / 2) * 5 * side;
        g.globalAlpha = 0.35 + 0.65 * (i / 22); disc(g, x + ox, y + oy, 3.2, col); disc(g, x + ox + Math.cos(a) * 4, y + oy + Math.sin(a) * 4, 1.6, col); g.globalAlpha = 1;
      }
      if (c.reveal) {
        const [x, y] = along(pts, 1); wolf(g, x, y, col, 12);
        const [lx, ly] = LABEL_AT[id]; // подписи не наезжают друг на друга и на итог
        rr(g, lx - 82, ly - 12, 164, 24, 8, 'rgba(11,16,32,.85)'); text(g, WOLF[id][1], lx, ly, col, 13);
      }
    });
    // пастушок в центре: оглядывается
    const look = Math.sin(t * 2.2) * 0.6;
    glow(g, 330, 150, 46, 'rgba(255,224,138,.35)');
    disc(g, 330, 150, 14, '#ffe08a'); disc(g, 330 + 5 * Math.cos(look), 146, 3.4, '#0b1020'); disc(g, 330 - 5 + 5 * Math.cos(look), 146, 3.4, '#0b1020');
    if (c.reveal) rr(g, 60, 247, 520, 46, 12, 'rgba(11,16,32,.88)');
    if (c.reveal) caption(g, 'Четыре простых правила — и вместе они окружают', 'правила «окружи» в игре нет', 320, 270, '#7cf5a8');
  };
  // четыре охотника включаются по одному: из простых правил рождается динамика, внизу загорается чувство
  const WOLF_IDS = ['vozhak', 'hitrec', 'lovchiy', 'trus'];
  // строка в рамке: шрифт уменьшается до 11px, дальше — две строки по словам
  function fit(g, s, x, y, maxW, col, px, align = 'center', weight = 800) {
    const font = n => `${weight} ${n}px system-ui,-apple-system,'Segoe UI',sans-serif`;
    let n = px; g.font = font(n);
    while (n > 11 && g.measureText(s).width > maxW) g.font = font(--n);
    if (g.measureText(s).width <= maxW) { text(g, s, x, y, col, n, align, weight); return; }
    const words = s.split(' '); let a = words.join(' '), cut = words.length;
    while (cut > 1 && g.measureText(a).width > maxW) a = words.slice(0, --cut).join(' ');
    text(g, a, x, y - n * 0.6, col, n, align, weight); text(g, words.slice(cut).join(' '), x, y + n * 0.6, col, n, align, weight);
  }
  function mdaOf(c) {
    const on = WOLF_IDS.filter(id => c[id]), n = on.length;
    if (!n) return ['Никто не гонится', '😴', 'Скука'];
    if (n === 1) return [c.trus ? 'Волк то подходит, то отступает' : 'Волк бежит следом — легко уйти', '🙂', 'Легко'];
    if (n === 2) return [c.vozhak && c.hitrec ? 'Клещи: сзади и спереди' : 'Двое заходят с разных сторон', '😬', 'Напряжение'];
    if (n === 3) return ['Окружают — тесно', '😰', 'Вызов'];
    return ['Окружают, а Трус даёт выдохнуть', '🔥', 'Вызов и азарт'];
  }
  MOTION['chetyre-ohotnika'] = (g, t, W, H, c = {}) => {
    bg(g, W, H);
    const A = { x: 8, y: 8, w: 404, h: 284 };
    maze(g, A.x, A.y, A.w, A.h, 36);
    const hp = tt => [A.x + 200 + 150 * Math.sin(0.55 * tt), A.y + 142 + 95 * Math.sin(1.1 * tt)];
    const m = mem(g, t, () => ({ pos: { vozhak: [30, 30], hitrec: [390, 30], lovchiy: [30, 270], trus: [390, 270] } }));
    const dt = clamp(t - m.t, 0, 0.1); m.t = t;
    const [hx, hy] = hp(t), [nx, ny] = hp(t + 0.1), dl = Math.hypot(nx - hx, ny - hy) || 1, dx = (nx - hx) / dl, dy = (ny - hy) / dl;
    const target = id => {
      const P = m.pos;
      if (id === 'vozhak') return [hx, hy];
      if (id === 'hitrec') return [hx + dx * 80, hy + dy * 80];
      if (id === 'lovchiy') { const ax = hx + dx * 40, ay = hy + dy * 40, L = c.vozhak ? P.vozhak : [hx, hy]; return [2 * ax - L[0], 2 * ay - L[1]]; }
      return Math.hypot(P.trus[0] - hx, P.trus[1] - hy) < 110 ? [A.x + 20, A.y + A.h - 20] : [hx, hy];
    };
    for (const id of WOLF_IDS) {
      if (!c[id]) continue;
      const p = m.pos[id], [tx, ty] = target(id);
      if (dt === 0 && calm()) { p[0] = clamp(tx, A.x + 14, A.x + A.w - 14); p[1] = clamp(ty, A.y + 14, A.y + A.h - 14); } // «уменьшить движение»: сразу на месте
      else { const d = Math.hypot(tx - p[0], ty - p[1]) || 1, v = 78 * dt; p[0] = clamp(p[0] + (tx - p[0]) / d * Math.min(v, d), A.x + 14, A.x + A.w - 14); p[1] = clamp(p[1] + (ty - p[1]) / d * Math.min(v, d), A.y + 14, A.y + A.h - 14); }
      const [cx, cy] = target(id);
      g.strokeStyle = WOLF[id][0]; g.globalAlpha = 0.4; g.setLineDash([3, 4]); g.lineWidth = 1.5; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(clamp(cx, A.x, A.x + A.w), clamp(cy, A.y, A.y + A.h)); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
      wolf(g, p[0], p[1], WOLF[id][0], 11);
    }
    glow(g, hx, hy, 34, 'rgba(255,224,138,.4)'); disc(g, hx, hy, 11, '#ffe08a');
    // правая колонка: механика → динамика → эстетика
    const [dyn, face, feel] = mdaOf(c), x = 426, w = 206;
    const box = (y, h, title, col, lit) => { rr(g, x, y, w, h, 12, lit ? '#1a2445' : '#121a33', lit ? col : '#2a3560'); text(g, title, x + 12, y + 14, col, 11, 'left', 800); };
    box(8, 112, 'МЕХАНИКА · ПРАВИЛА', '#5fe0ff', true);
    WOLF_IDS.forEach((id, i) => { const on = !!c[id]; g.globalAlpha = on ? 1 : 0.35; disc(g, x + 18, 40 + i * 21, 6, WOLF[id][0]); text(g, WOLF[id][1], x + 30, 40 + i * 21, on ? '#f2efe6' : '#6f7aa8', 12, 'left', 700); g.globalAlpha = 1; });
    const lit = WOLF_IDS.some(id => c[id]), k = lit ? ob(seg(c._t, 0.2, 0.7)) : 1;
    box(128, 70, 'ДИНАМИКА · ЧТО СЛУЧАЕТСЯ', '#b49bff', lit);
    g.save(); g.translate(x + w / 2, 170); g.scale(k, k); fit(g, dyn, 0, 0, w - 20, '#f2efe6', 14); g.restore();
    box(206, 86, 'ЭСТЕТИКА · ЧТО ЧУВСТВУЮ', '#ffb547', lit);
    if (lit) glow(g, x + 40, 254, 40, 'rgba(255,181,71,.35)', k);
    emo(g, face, x + 40, 254, 30); fit(g, feel, x + 70, 254, w - 80, '#ffe08a', 17, 'left');
  };
  // мост MDA: дизайнер трогает только механику, игрок чувствует только эстетику, между ними — динамика
  MOTION['mda-most'] = (g, t, W, H, c = {}) => {
    bg(g, W, H);
    const cols = [[110, '🧑‍💻', 'Дизайнер', 'пишет правила', '#5fe0ff', 'МЕХАНИКА'], [320, '🎮', 'Игра', 'в неё играют', '#b49bff', 'ДИНАМИКА'], [530, '😬', 'Игрок', 'чувствует', '#ffb547', 'ЭСТЕТИКА']];
    cols.forEach(([x, ic, who, what, col, layer], i) => {
      const k = ob(seg(t, 0.2 + i * 0.5, 0.7 + i * 0.5)); if (k <= 0) return;
      g.save(); g.translate(x, 120); g.scale(k, k);
      rr(g, -88, -84, 176, 168, 16, '#1a2445', col);
      text(g, layer, 0, -66, col, 12); emo(g, ic, 0, -20, 44); text(g, who, 0, 30, '#f2efe6', 16); text(g, what, 0, 52, '#9aa3c7', 13, 'center', 600);
      g.restore();
    });
    const p = (t * 0.6) % 1;
    if (t > 1.8) { arrow(g, 202, 120, 228, 120, '#7cf5a8', 3); arrow(g, 412, 120, 438, 120, '#7cf5a8', 3); disc(g, lerp(110, 530, p), 214, 6, '#7cf5a8'); }
    if (c.pleytest) { // обратная дорога: плейтест показывает дизайнеру, что почувствовал игрок
      g.strokeStyle = '#ffe08a'; g.setLineDash([6, 6]); g.lineWidth = 2.5; g.beginPath(); g.moveTo(530, 210); g.quadraticCurveTo(320, 300, 110, 210); g.stroke(); g.setLineDash([]);
      const q = (since(t, c) * 0.5) % 1; disc(g, lerp(530, 110, q), 210 + Math.sin(q * Math.PI) * 44, 6, '#ffe08a');
      caption(g, 'Плейтест — дорога назад: смотрим, что почувствовали, и правим механику', '', 320, 284, '#ffe08a');
    } else caption(g, 'Дизайнер трогает только правила — игрок чувствует только эстетику', 'динамику нельзя написать: её предсказывают и проверяют', 320, 266, '#7cf5a8');
  };
  // предсказание и плейтест: что автор ждал и что записала телеметрия
  MOTION.predskazanie = (g, t, W, H, c = {}) => {
    bg(g, W, H);
    rr(g, 20, 30, 240, 110, 14, '#1a2445', '#b49bff');
    text(g, 'МОЁ ПРЕДСКАЗАНИЕ', 36, 50, '#b49bff', 11, 'left'); emo(g, '🔮', 44, 92, 30);
    text(g, 'Игроки будут ждать', 70, 84, '#f2efe6', 15, 'left'); text(g, 'волков у факела', 70, 104, '#f2efe6', 15, 'left');
    const bars = c.pravka ? [['🔥 засада у факела', 0.8], ['🏃 убегают в угол', 0.3], ['🔄 кругами у стены', 0.2]] : [['🔥 засада у факела', 0.15], ['🏃 убегают в угол', 0.85], ['🔄 кругами у стены', 0.35]];
    text(g, 'ТЕЛЕМЕТРИЯ ПЛЕЙТЕСТА', 300, 50, '#5fe0ff', 11, 'left');
    if (!c.pleytest) { text(g, 'Ещё никто не играл', 300, 92, '#6f7aa8', 15, 'left', 700); caption(g, 'Динамику нельзя написать — только предсказать', 'включи плейтест', 320, 250, '#9aa3c7'); return; }
    const tt = since(t, c);
    bars.forEach(([name, v], i) => { const y = 80 + i * 40, k = io(seg(tt, 0.2 + i * 0.15, 1.2 + i * 0.15)); text(g, name, 300, y, '#f2efe6', 13, 'left', 700); rr(g, 460, y - 8, 150, 16, 8, '#1a2445'); rr(g, 460, y - 8, Math.max(16, 150 * v * k), 16, 8, i === 0 ? '#ffb547' : '#5fe0ff'); });
    const hit = c.pravka, k = ob(seg(tt, 1.4, 1.9));
    if (k > 0) { g.save(); g.translate(140, 200); g.rotate(-0.12); g.scale(k, k); rr(g, -110, -26, 220, 52, 10, hit ? 'rgba(124,245,168,.15)' : 'rgba(255,181,71,.15)', hit ? '#7cf5a8' : '#ffb547'); text(g, hit ? 'Совпало ✓' : 'Не совпало — открытие!', 0, 0, hit ? '#7cf5a8' : '#ffb547', 17); g.restore(); }
    caption(g, hit ? 'Поправил механику — и динамика стала той, что задумал' : 'Игроки нашли то, чего ты не писал', hit ? 'факел ярче и ближе к углам' : 'правь механику, а не игроков', 420, 250, hit ? '#7cf5a8' : '#ffb547');
  };

  /* ================= урок 4 ================= */
  // цикл глагола «Каменного стакана»: действие → отклик → награда → новая задача → снова. Выключи отклик или награду — круг рвётся
  const CYC = [['👆', 'Действие', 'повернуть и поставить', -Math.PI / 2], ['💥', 'Отклик', 'вспышка и звук', 0], ['🏆', 'Награда', 'линия и очки', Math.PI / 2], ['🧩', 'Новая задача', 'следующий камень', Math.PI]];
  MOTION['cikl-glagola'] = (g, t, W, H, c = {}) => {
    bg(g, W, H);
    const cx = 230, cy = 122, R = 80, broken = [c.otklik === false ? 1 : -1, c.nagrada === false ? 2 : -1].filter(i => i >= 0);
    const cut = broken.length ? Math.min(...broken) : 9; // точка застревает перед первым разрывом
    // дуги между узлами
    for (let i = 0; i < 4; i++) {
      const a0 = CYC[i][3] + 0.28, a1 = CYC[(i + 1) % 4][3] - 0.28 + (i === 3 ? TAU : 0), bad = broken.includes((i + 1) % 4);
      g.strokeStyle = bad ? '#ff5d6e' : '#3a4880'; g.lineWidth = bad ? 3 : 5; g.setLineDash(bad ? [4, 10] : []);
      g.beginPath(); g.arc(cx, cy, R, a0, a1); g.stroke(); g.setLineDash([]);
    }
    const per = 3, ph = (since(t, c) % per) / per; // доля круга
    let a = -Math.PI / 2 + ph * TAU; const stopA = CYC[cut] ? CYC[cut][3] - 0.32 + (cut === 0 ? TAU : 0) : 99;
    const stuck = broken.length && a >= stopA - 0.01; if (stuck) a = stopA;
    CYC.forEach(([ic, name, ex, ang], i) => {
      const x = cx + Math.cos(ang) * R, y = cy + Math.sin(ang) * R, off = broken.includes(i), near = !stuck && Math.abs(((a - ang) % TAU + TAU) % TAU) < 0.35;
      if (near) glow(g, x, y, 44, 'rgba(124,245,168,.45)');
      disc(g, x, y, 24, off ? '#2a1620' : '#1a2445'); g.globalAlpha = off ? 0.35 : 1; emo(g, ic, x, y, 22); g.globalAlpha = 1;
      const lx = i === 1 || i === 0 ? x + 30 : i === 3 ? x - 30 : x, ly = i === 2 ? y + 36 : y, al = i === 1 || i === 0 ? 'left' : i === 3 ? 'right' : 'center';
      text(g, name, lx, ly - 7, off ? '#ff8a8a' : '#f2efe6', 14, al); text(g, off ? 'выключено' : ex, lx, ly + 9, off ? '#ff8a8a' : '#9aa3c7', 11, al, 600);
    });
    disc(g, cx + Math.cos(a) * R, cy + Math.sin(a) * R, 8, stuck ? '#ff5d6e' : '#7cf5a8');
    // в центре — маленький стакан: камень ложится, ряд вспыхивает (если есть отклик)
    rr(g, cx - 30, cy - 34, 60, 70, 6, '#24304f');
    for (let j = 0; j < 3; j++) for (let i = 0; i < 6; i++) if (!(j === 0 && i === 4)) g.fillRect(cx - 27 + i * 9.5, cy + 24 - j * 9.5, 8.5, 8.5), g.fillStyle = ['#ffb547', '#5fe0ff', '#b49bff'][(i + j) % 3];
    const fallK = seg(ph, 0, 0.25), fy = lerp(cy - 30, cy + 24 - 0 * 9.5 - 9.5 * 0, fallK);
    g.fillStyle = '#7cf5a8'; g.fillRect(cx - 27 + 4 * 9.5, fy, 8.5, 8.5);
    if (c.otklik !== false && ph > 0.25 && ph < 0.45) { g.fillStyle = `rgba(255,255,255,${1 - seg(ph, 0.25, 0.45)})`; g.fillRect(cx - 28, cy + 23, 58, 11); }
    // «хочется ещё»
    const want = broken.length === 2 ? 0.08 : broken.length ? 0.3 : 0.92;
    text(g, 'Хочется ещё?', 520, 60, '#9aa3c7', 14);
    rr(g, 440, 80, 160, 18, 9, '#1a2445'); rr(g, 440, 80, Math.max(18, 160 * want), 18, 9, want > 0.5 ? '#7cf5a8' : '#ff5d6e');
    emo(g, want > 0.5 ? '🔥' : broken.length === 2 ? '😴' : '😐', 520, 140, 40);
    text(g, want > 0.5 ? 'Ещё один камень!' : 'Зачем ещё?', 520, 184, want > 0.5 ? '#7cf5a8' : '#ff8a8a', 16);
    caption(g, broken.length ? 'Круг порвался — повторять не тянет' : 'Сделал — получил — хочется ещё', broken.length ? 'без отклика и награды действие пустое' : 'основной цикл: 2–4 секунды на круг', 320, 280, broken.length ? '#ff8a8a' : '#ffe08a');
  };
  // длина цикла: Flappy Bird, «Тетрис», Angry Birds — сколько кругов за то же время
  MOTION['dlina-cikla'] = (g, t, W, H, c = {}) => {
    bg(g, W, H);
    const games = [['🐦', 'Flappy Bird', 0.8], ['🧱', '«Тетрис»', c.medlenno ? 5 : 3], ['🐤', 'Angry Birds', 8]], tt = since(t, c);
    games.forEach(([ic, name, per], i) => {
      const x = 110 + i * 210, y = 120, R = 52, ph = (tt % per) / per, laps = Math.floor(tt / per);
      g.strokeStyle = '#3a4880'; g.lineWidth = 5; g.beginPath(); g.arc(x, y, R, 0, TAU); g.stroke();
      g.strokeStyle = i === 1 && c.medlenno ? '#ff5d6e' : '#7cf5a8'; g.beginPath(); g.arc(x, y, R, -Math.PI / 2, -Math.PI / 2 + ph * TAU); g.stroke();
      emo(g, ic, x, y - 4, 30); text(g, name, x, y + R + 22, '#f2efe6', 15); text(g, `круг — ${String(per).replace('.', ',')} с`, x, y + R + 42, '#9aa3c7', 12, 'center', 600);
      text(g, `×${laps}`, x + R - 2, y - R + 4, '#ffe08a', 15, 'left');
    });
    if (c.medlenno) caption(g, 'Отклик опоздал на 2 секунды — «Тетрис» перестал тянуть', 'круг длиннее — повторять хочется реже', 320, 272, '#ff8a8a');
    else caption(g, 'Чем короче круг, тем сильнее тянет повторить', 'длинный круг держит зрелищем результата, как в Angry Birds', 320, 272, '#ffe08a');
  };
  // честный стакан: мешок и предпросмотр. Без мешка палка не приходит, без предпросмотра не видно, что дальше
  const KINDS = ['#5fe0ff', '#ffb547', '#b49bff', '#7cf5a8', '#ff5d6e', '#ffe08a', '#ff9bd2'];
  MOTION.chestno = (g, t, W, H, c = {}) => {
    bg(g, W, H);
    const bag = c.meshok !== false, prev = c.predprosmotr !== false, tt = since(t, c);
    // стакан с колодцем под палку
    const x0 = 40, y0 = 40, s = 16;
    rr(g, x0 - 6, y0 - 6, s * 10 + 12, s * 12 + 12, 8, '#24304f');
    for (let j = 0; j < 8; j++) for (let i = 0; i < 10; i++) if (i !== 9) { g.fillStyle = KINDS[(i * 3 + j) % 7]; g.globalAlpha = 0.8; g.fillRect(x0 + i * s + 1, y0 + (11 - j) * s + 1, s - 2, s - 2); g.globalAlpha = 1; }
    const wait = bag ? Math.min(12, Math.floor(tt * 2) % 13) : Math.floor(tt * 2) + 6, came = bag && Math.floor(tt * 2) % 13 === 12;
    if (came) { g.fillStyle = KINDS[0]; for (let j = 0; j < 4; j++) g.fillRect(x0 + 9 * s + 1, y0 + (11 - j) * s + 1, s - 2, s - 2); }
    text(g, 'ждём палку', x0 + 9 * s + 8, y0 - 18, '#5fe0ff', 12);
    // лента следующих камней
    text(g, prev ? 'ВИДНО ТРИ СЛЕДУЮЩИХ' : 'СЛЕДУЮЩИЕ НЕ ВИДНЫ', 260, 70, prev ? '#7cf5a8' : '#ff8a8a', 12, 'left');
    for (let i = 0; i < 3; i++) { const x = 270 + i * 54; rr(g, x, 86, 44, 44, 8, '#1a2445'); if (prev) { g.fillStyle = KINDS[(Math.floor(tt * 2) + i * 2 + 1) % 7]; g.fillRect(x + 10, x % 2 ? 98 : 102, 24, 20); } else text(g, '?', x + 22, 108, '#6f7aa8', 22); }
    text(g, `Палки нет уже ${wait} камней`, 260, 160, !bag && wait > 12 ? '#ff8a8a' : '#f2efe6', 15, 'left');
    text(g, bag ? 'мешок: не дольше 12' : 'без мешка: сколько угодно', 260, 182, '#9aa3c7', 12, 'left', 600);
    const fair = bag && prev, face = fair ? '🙂' : !bag ? '😤' : '😟';
    emo(g, face, 560, 120, 44);
    text(g, fair ? 'Понял, почему' : !bag ? 'Нечестно!' : 'Не видно, что будет', 560, 170, fair ? '#7cf5a8' : '#ff8a8a', 14);
    caption(g, fair ? 'Проиграл — и понял почему: хочется ещё раз' : 'Проигрыш по вине случая — хочется бросить', 'мешок и предпросмотр делают проигрыш честным', 320, 268, fair ? '#7cf5a8' : '#ff8a8a');
  };

  // дальше — типы шагов: на проекторе их нет
  if (typeof STEPS === 'undefined') return;
  const { el, api, toast, beep } = Lab;
  const fast = () => !!window.LAB_FAST;
  // полоски итога класса (доля 0..1)
  const bars = rows => el('div', { class: 'm6-bars' }, rows.map((r, i) => el('div', { class: 'm6-bar' + (r.me ? ' me' : '') },
    el('span', { class: 'lab' }, r.label), el('span', { class: 'track' }, el('i', { style: `--w:${Math.round(clamp(r.k, 0, 1) * 100)}%;--d:${i * 0.08}s` })), el('b', {}, r.show != null ? r.show : ''))));
  const tally = id => api('/api/m6/tally?step=' + encodeURIComponent(id)).catch(() => null);
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
  // вопрос с вариантами: кнопки, «Ответить»; после ответа — вердикт
  function optionGrid(options, pick, onPick) {
    const grid = el('div', { class: 'opts', role: 'radiogroup' });
    options.forEach(o => grid.append(el('button', { type: 'button', class: 'opt' + (pick === o ? ' on' : ''), 'aria-pressed': String(pick === o), onclick: () => onPick(o) }, o)));
    return grid;
  }
  // итог класса по вариантам вопроса: после своего ответа
  function classBars(box, st, mine, label = 'Класс ответил') {
    tally(st.id).then(r => {
      if (!r || r.hidden || !r.n) return;
      box.replaceChildren(el('div', { class: 'eyebrow' }, `${label} · ${r.n}`), bars(r.rows.map(x => ({ label: x.label, k: x.n / r.n, show: x.n, me: x.label === mine }))));
    });
  }

  /* ---------------- spor: две партии, голос и причины ---------------- */
  STEPS.spor = ctx => {
    const st = ctx.step, need = st.minRounds || 1, L = id => (st.sides.find(s => s.id === id) || {}).label || id;
    let v = Object.assign({ sides: {}, why: [] }, ctx.value);
    let cur = st.sides.find(s => !((v.sides[s.id] || {}).rounds >= need)) || st.sides[0], h = null;
    const host = el('div', { class: 'stack m1-spor' }), playBox = el('div', { class: 'stack' }), voteBox = el('div', { class: 'stack' }), tallyBox = el('div', { class: 'stack' });
    const played = id => ((v.sides[id] || {}).rounds || 0) >= need;
    function mount() {
      if (h) h.destroy();
      const side = cur, status = el('b', {});
      const show = () => { const x = v.sides[side.id] || {}; status.textContent = `${side.label}: партий ${x.rounds || 0}` + (x.rounds >= need ? ' ✓' : ` из ${need}`); };
      h = Games.frame({
        src: () => '/engine/game.html?game=../' + st.game, key: () => 'remake:' + st.id + ':' + side.id, cfg: Object.assign({}, st.cfg, side.cfg), label: 'Играть: ' + side.label,
        onOver: m => {
          const x = Object.assign({ rounds: 0, best: 0, secret: 0, custom: {} }, v.sides[side.id]), custom = Object.assign({}, x.custom);
          for (const [k, n] of Object.entries((m.tele || {}).custom || {})) custom[k] = (custom[k] || 0) + (Number(n) || 0);
          v.sides = Object.assign({}, v.sides, { [side.id]: { rounds: x.rounds + 1, best: Math.max(x.best, m.score || 0), secret: x.secret + (Number(((m.tele || {}).custom || {})._secret) || 0), custom } });
          ctx.save(v); show(); beep('tick');
          const next = st.sides.find(s => !played(s.id));
          if (next && next !== side) { toast(`Теперь — ${next.label}`); cur = next; setTimeout(() => { if (host.isConnected) draw(); }, fast() ? 50 : 900); }
          else draw();
        },
      });
      show();
      const segBox = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Партия' });
      st.sides.forEach(s => segBox.append(el('button', { type: 'button', class: 'opt' + (s === cur ? ' on' : ''), 'aria-pressed': String(s === cur), 'data-side': s.id, onclick: () => { if (s === cur) return; cur = s; beep('tick'); draw(); } },
        el('b', {}, (played(s.id) ? '✓ ' : '') + s.label), s.hint ? el('div', { class: 'small muted' }, s.hint) : null)));
      playBox.replaceChildren(segBox, h.box, Games.bar(h, status));
    }
    function drawVote() {
      if (!st.sides.every(s => played(s.id))) { voteBox.replaceChildren(el('p', { class: 'small muted' }, `Сыграй обе партии — потом голос: ${st.question}`)); return; }
      const picks = st.sides.map(s => [s.id, s.label]).concat([['same', st.sameLabel || 'Одинаково']]);
      const seg2 = el('div', { class: 'opts', role: 'radiogroup', 'aria-label': st.question });
      picks.forEach(([id, label]) => seg2.append(el('button', { type: 'button', class: 'opt' + (v.pick === id ? ' on' : ''), 'aria-pressed': String(v.pick === id), 'data-pick': id, onclick: () => { v.pick = id; ctx.save(v); beep('tick'); drawVote(); } }, label)));
      const why = el('div', { class: 'cardopts', 'aria-label': 'Почему' });
      (st.reasons || []).forEach(r => why.append(el('button', { type: 'button', class: 'cardopt' + (v.why.includes(r) ? ' on' : ''), 'aria-pressed': String(v.why.includes(r)), 'data-why': r, onclick: () => {
        v.why = v.why.includes(r) ? v.why.filter(x => x !== r) : v.why.concat(r).slice(-2); ctx.save(v); beep('tick'); drawVote();
      } }, r)));
      const own = el('input', { type: 'text', id: 'f-' + st.id + 'own', maxlength: 160, placeholder: 'Или своими словами: почему?', value: v.own || '' });
      own.addEventListener('input', () => { v.own = own.value; ctx.save(v); });
      voteBox.replaceChildren(el('div', { class: 'm1-q' }, st.question), seg2, el('div', { class: 'eyebrow' }, 'Почему? До двух карточек'), why, own,
        el('div', {}, el('button', { type: 'button', class: 'btn', 'data-vote': 'go', onclick: () => {
          if (!v.pick) { toast('Выбери партию'); return; }
          if (!v.why.length && !(v.own || '').trim()) { toast('Скажи почему: карточка или свои слова'); return; }
          v.voted = true; ctx.save(v, true, true); beep('good'); drawVote(); paintTally();
        } }, v.voted ? 'Голос отдан ✓' : 'Голосую')));
    }
    function paintTally() {
      if (!v.voted) return;
      tally(st.id).then(r => {
        if (!r || r.hidden || !r.n) return;
        const rows = st.sides.map(s => ({ label: s.label, n: r.pick[s.id] || 0, me: v.pick === s.id })).concat([{ label: st.sameLabel || 'Одинаково', n: r.pick.same || 0, me: v.pick === 'same' }]);
        tallyBox.replaceChildren(el('div', { class: 'eyebrow' }, `Голос класса · ${r.n}`), bars(rows.map(x => Object.assign(x, { k: x.n / r.n, show: x.n }))),
          r.top.length ? el('div', { class: 'm6-cloud' }, r.top.map(a => el('span', { style: `--s:${(0.9 + 0.4 * a.n / Math.max(1, r.top[0].n)).toFixed(2)}` }, `${a.text} · ${a.n}`))) : null,
          st.after ? el('p', { class: 'concept' }, st.after) : null);
      });
    }
    function draw() { mount(); drawVote(); }
    host.append(playBox, voteBox, tallyBox);
    draw(); paintTally();
    return host;
  };

  /* ---------------- zagadka: загадка-сцена без слов ---------------- */
  STEPS.zagadka = ctx => {
    const st = ctx.step, wait = fast() ? 0.4 : (st.seconds || 8);
    let v = Object.assign({}, ctx.value), pick = v.pick || null;
    const ctl = { reveal: !!v.pick };
    const cv = sceneCanvas(st.anim, ctl, 'Загадка без слов: ' + (st.title || ''));
    const host = el('div', { class: 'stack m1-zagadka' }), ask = el('div', { class: 'stack' }), tallyBox = el('div', { class: 'stack' });
    const timer = el('div', { class: 'm1-watch' }, el('i'));
    function draw() {
      if (!v.pick) {
        ask.replaceChildren(el('div', { class: 'm1-q' }, st.question), optionGrid(st.options, pick, o => { pick = o; beep('tick'); draw(); }),
          el('div', {}, el('button', { type: 'button', class: 'btn', onclick: () => {
            if (!pick) { toast('Выбери вариант'); return; }
            v = { pick, correct: pick === st.right }; ctl.reveal = true; ctx.save(v, true, true); beep(v.correct ? 'good' : 'bad'); draw();
          } }, 'Ответить')));
        return;
      }
      ask.replaceChildren(el('p', { class: 'verdict ' + (v.correct ? 'good' : 'bad') }, v.correct ? '🎯 Разгадал без слов!' : `Не совсем. Ответ: «${st.right}».`),
        el('p', { class: 'concept' }, st.why));
      classBars(tallyBox, st, v.pick);
    }
    let shown = !!v.pick || calm();
    if (!shown) {
      ask.replaceChildren(el('p', { class: 'small muted' }, 'Смотри молча. Вопрос появится через несколько секунд.'), timer);
      timer.firstChild.style.animationDuration = wait + 's';
      setTimeout(() => { if (host.isConnected || !shown) { shown = true; draw(); } }, wait * 1000);
    } else draw();
    host.append(el('div', { class: 'm4-stage' }, cv), ask, tallyBox);
    return host;
  };

  /* ---------------- slomano: сломанная игра ---------------- */
  STEPS.slomano = ctx => {
    const st = ctx.step, total = st.seconds || 180;
    let v = Object.assign({ rounds: 0, fixedRounds: 0 }, ctx.value);
    if (!v.t0) { v.t0 = Date.now(); ctx.save(v); }
    let pick = v.pick || null, fixed = false, h = null, tick = 0;
    const host = el('div', { class: 'stack m1-slomano' }), playBox = el('div', { class: 'stack' }), ask = el('div', { class: 'stack' }), tallyBox = el('div', { class: 'stack' });
    const clock = el('b', { class: 'm1-clock' }), bar = el('div', { class: 'm1-watch on' }, el('i')), hint = el('p', { class: 'concept', hidden: true }, st.hint || '');
    function paintClock() {
      const left = Math.max(0, total - (Date.now() - v.t0) / 1000);
      clock.textContent = v.pick ? 'Нашёл ✓' : left > 0 ? `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : 'Время вышло';
      bar.firstChild.style.width = (v.pick ? 100 : 100 * left / total) + '%';
      hint.hidden = !!v.pick || left > 0 || !st.hint;
      if (v.pick || left <= 0) clearInterval(tick);
    }
    function mount() {
      if (h) h.destroy();
      const status = el('b', {}, fixed ? 'Починенная игра' : 'Что-то здесь не так. Найди что');
      h = Games.frame({
        src: () => '/engine/game.html?game=../' + st.game, key: () => 'remake:' + st.id + (fixed ? ':fixed' : ''), cfg: Object.assign({}, fixed ? st.fixed : st.cfg), label: fixed ? '▶ Сыграй починенную' : 'Играть: сломанная игра',
        onOver: () => { if (fixed) v.fixedRounds++; else v.rounds++; ctx.save(v); },
      });
      playBox.replaceChildren(h.box, Games.bar(h, status));
    }
    function draw() {
      if (!v.pick) {
        ask.replaceChildren(el('div', { class: 'm1-q' }, st.question), optionGrid(st.options, pick, o => { pick = o; beep('tick'); draw(); }),
          el('div', {}, el('button', { type: 'button', class: 'btn', onclick: () => {
            if (!pick) { toast('Выбери вариант'); return; }
            v = Object.assign({}, v, { pick, correct: pick === st.right, trap: pick === st.trap, t: Math.round((Date.now() - v.t0) / 1000) });
            ctx.save(v, true, true); beep(v.correct ? 'good' : 'bad'); paintClock(); draw();
          } }, 'Это сломано!')));
        return;
      }
      const verdict = v.correct ? ['good', `🔧 Нашёл за ${Math.floor(v.t / 60)}:${String(v.t % 60).padStart(2, '0')}! ${st.why}`] : v.trap ? ['bad', st.trapText || `Ловушка! Ответ: «${st.right}».`] : ['bad', `Не это. Сломано другое: «${st.right}». ${st.why}`];
      ask.replaceChildren(el('p', { class: 'verdict ' + verdict[0] }, verdict[1]),
        el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn' + (fixed ? ' ghost' : ''), 'data-fixed': 'play', onclick: () => { fixed = !fixed; beep('tick'); mount(); draw(); } }, fixed ? '← Вернуть сломанную' : '▶ Сыграй починенную'),
          el('span', { class: 'small muted' }, fixed ? 'Сравни: что изменилось в чувстве?' : 'Та же игра с деталью на месте')));
      classBars(tallyBox, st, v.pick);
    }
    host.append(el('div', { class: 'row m1-clockrow' }, el('span', { class: 'eyebrow' }, 'Три минуты на поиск'), el('span', { class: 'grow' }), clock), bar, playBox, hint, ask, tallyBox);
    mount(); draw(); paintClock();
    if (!v.pick) tick = setInterval(() => { if (!host.isConnected) { clearInterval(tick); return; } paintClock(); }, 1000);
    return host;
  };

  /* ---------------- koloda: колода понятий, переверни и выбери главное ---------------- */
  STEPS.koloda = ctx => {
    const st = ctx.step, C = st.cards;
    let v = Object.assign({ seen: [] }, ctx.value);
    const host = el('div', { class: 'stack m1-koloda' }), grid = el('div', { class: 'm1-deck' }), foot = el('div', { class: 'stack' }), tallyBox = el('div', { class: 'stack' });
    const count = el('b', {});
    function flip(c) {
      if (v.seen.includes(c.id)) return;
      v.seen = v.seen.concat(c.id); ctx.save(v); beep('tick'); draw();
    }
    function draw() {
      if (grid.childElementCount) { // карты уже разложены: только переворот и метка главной, без новой раздачи
        [...grid.children].forEach((card, i) => {
          const c = C[i], open = v.seen.includes(c.id), main = v.pick === c.id, face = card.lastChild, tag = face.querySelector('.tag');
          card.classList.toggle('flipped', open); card.classList.toggle('main', main); card.style.animation = 'none';
          card.setAttribute('aria-label', open ? `${c.name}: ${c.line}` : `Карта ${i + 1}: перевернуть`);
          if (main && !tag) face.append(el('span', { class: 'tag' }, '★ главное')); else if (!main && tag) tag.remove();
        });
        paintFoot(); return;
      }
      grid.replaceChildren(...C.map((c, i) => {
        const open = v.seen.includes(c.id), main = v.pick === c.id;
        const card = el('button', { type: 'button', class: 'm1-card' + (open ? ' flipped' : '') + (main ? ' main' : ''), 'data-card': c.id, 'aria-label': open ? `${c.name}: ${c.line}` : `Карта ${i + 1}: перевернуть`, style: `--d:${i * 0.04}s`, onclick: () => (v.seen.includes(c.id) ? (v.seen.length === C.length ? choose(c) : null) : flip(c)) },
          el('span', { class: 'm1-back' }, el('b', {}, '?'), el('span', { class: 'small muted' }, String(i + 1))),
          el('span', { class: 'm1-face' }, el('span', { class: 'ic', 'aria-hidden': 'true' }, c.icon), el('b', {}, c.name), el('span', { class: 'small' }, c.line), c.example ? el('span', { class: 'small muted' }, c.example) : null,
            main ? el('span', { class: 'tag' }, '★ главное') : null));
        return card;
      }));
      paintFoot();
    }
    function paintFoot() {
      count.textContent = `Перевернул ${v.seen.length} из ${C.length}`;
      const all = v.seen.length === C.length;
      foot.replaceChildren(...(all ? [el('div', { class: 'm1-q' }, st.question || 'Какая карта главная для твоей игры?'),
        el('p', { class: 'small muted' }, v.pick ? `Твоя главная: ${C.find(c => c.id === v.pick).name}. Можно выбрать другую — нажми на карту.` : 'Нажми на одну карту — это главное в твоей игре.')] : [el('p', { class: 'small muted' }, 'Переверни все карты — нажми на каждую.')]));
    }
    function choose(c) {
      v.pick = c.id; v.line = `${c.name}: ${c.line}`; ctx.save(v, true, true); beep('good'); draw();
      document.dispatchEvent(new CustomEvent('lab:pick', { detail: { step: st.id } })); // поле Фабрики с from: 'koloda' берёт карту сразу
      classBars(tallyBox, st, c.name, 'Главное у класса');
    }
    host.append(el('div', { class: 'row' }, el('span', { class: 'eyebrow' }, st.deckTitle || 'Колода'), el('span', { class: 'grow' }), count), grid, foot, tallyBox);
    draw(); if (v.pick) classBars(tallyBox, st, (C.find(c => c.id === v.pick) || {}).name, 'Главное у класса');
    return host;
  };

  // итог шага одной строкой — для «Скопировать результат»
  window.LabStepsM1Summary = (step, v) => {
    switch (step.type) {
      case 'spor': return v.pick ? `голос: ${v.pick === 'same' ? 'одинаково' : (step.sides.find(s => s.id === v.pick) || {}).label}; почему: ${(v.why || []).concat(v.own ? [v.own] : []).join('; ') || '—'}` : `сыграно партий: ${Object.values(v.sides || {}).map(x => x.rounds).join(' и ') || 0}`;
      case 'zagadka': return v.pick ? `ответ: ${v.pick}${v.correct ? ' — верно' : ''}` : 'не ответил';
      case 'slomano': return v.pick ? `сломано: ${v.pick}${v.correct ? ` — нашёл за ${v.t} с` : v.trap ? ' — ловушка' : ''}` : `партий: ${v.rounds || 0}`;
      case 'koloda': return v.line ? `главное: ${v.line}` : `перевернул ${(v.seen || []).length} из ${step.cards.length}`;
      default: return null;
    }
  };
})();
