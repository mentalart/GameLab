// Шаги модуля 6 «Игрок в центре: мотивация, UX, этика» (уроки 23–25) и их моушн-дизайн. Подключается после student.js и vybor.js,
// берёт его помощники (S, ans, el, api, toast, beep, Games, fieldEditor, valText). Сцены-объяснялки добавляются в библиотеку MOTION
// из steps-m4.js (шаг motion, у сцены могут быть переключатели toggles — «попробуй сам»). Типы шагов:
//   brosok     — квиз-бросок: карточка летит персонажу (типы игроков Бартла, «увлечение или манипуляция»), серия, таймер-фитиль, реакции;
//   portrait   — портрет игрока для будущей итоговой игры: карты и кубик, живая карточка игрока собирается анимацией;
//   setka      — «Загадка дня класса»: игра автора дня на зерне даты, сетка-результат без спойлеров, галерея сеток класса с переворотом плиток;
//   minuta     — «Первая минута»: запись новичка анимацией, пробел — «здесь потерялся», разбор с настоящими моментами;
//   sekundomer — «Новичок с улицы»: секундомер до понимания цели до и после правки, гонка двух полос;
//   audit      — UX-аудит игры соседа: игра, «думай вслух» штампами по времени, чек-лист 10 пунктов с кольцом оценки; ниже — аудиты моей игры;
//   darkhunt   — «Охота за тёмными паттернами» в ремейке: найденные карты переворачиваются, на обороте — честная замена;
//   debate     — дебаты: позиция до, аргументы, канат класса, позиция после и сдвиг;
//   kodeks     — «Кодекс честного геймдизайнера»: предложить правила, свиток класса из семи правил, подпись со штампом;
//   adopt      — взять свою игру из прошлых уроков в этот урок (злая и честная версии своей релизной игры).
'use strict';
(function () {
  const M = window.LabMotion;
  if (!M) return;
  const { MOTION } = M;
  const { TAU, clamp, seg, io, ob, lerp, rng, rr, text, disc, glow, sky, hero, arrow, confetti, fast } = M.kit;
  const calm = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- помощники рисования ---------------- */
  function wrap(g, s, x, y, maxW, lh, col = '#f2efe6', px = 15, align = 'center', weight = 700) {
    g.font = `${weight} ${px}px system-ui,-apple-system,'Segoe UI',sans-serif`;
    const words = String(s).split(/\s+/), lines = [];
    let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur);
    const y0 = y - (lines.length - 1) * lh / 2;
    lines.forEach((l, i) => text(g, l, x, y0 + i * lh, col, px, align, weight));
    return lines.length;
  }
  const emo = (g, e, x, y, px = 24) => { g.fillStyle = '#ffffff'; g.font = `${px}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, x, y); };
  function bubble(g, x, y, s, col = '#fffbe8', ink = '#1b1430', px = 13) {
    g.font = `800 ${px}px system-ui,sans-serif`;
    const w = Math.min(260, g.measureText(s).width + 22), h = px + 14;
    rr(g, x - w / 2, y - h, w, h, 10, col);
    g.fillStyle = col; g.beginPath(); g.moveTo(x - 6, y - 1); g.lineTo(x, y + 8); g.lineTo(x + 6, y - 1); g.fill();
    text(g, s, x, y - h / 2, ink, px);
  }
  function caption(g, n, s, W) { rr(g, 14, 12, W - 28, 36, 10, 'rgba(11,16,32,.78)'); if (n) text(g, n, 34, 30, '#ffd23f', 18); text(g, s, n ? W / 2 + 10 : W / 2, 30, '#f2efe6', 14); }
  function tile(g, x, y, s, col, sym, flip = 0) {
    const k = Math.abs(Math.cos(flip * Math.PI)); g.save(); g.translate(x + s / 2, y + s / 2); g.scale(1, Math.max(0.04, k));
    rr(g, -s / 2, -s / 2, s, s, 5, col, 'rgba(0,0,0,.25)'); if (sym) emo(g, sym, 0, 1, s * 0.55); g.restore();
  }
  const SYM = ['☀️', '⛰️', '🌊', '⭐', '🌲', '🌙', '🔥', '💧'];
  const C = { g: '#3fbf5f', y: '#f0b429', n: '#4b5161', e: '#e8dcc0' };
  // огород для сцен урока 24: грядки, кабанчик, орехомёт
  function garden(g, W, H, lanes = 3, top = 70) {
    sky(g, W, H, '#8fd3ff', '#d9f2c4');
    const lh = (H - top - 20) / lanes;
    for (let i = 0; i < lanes; i++) { g.fillStyle = i % 2 ? '#6fb84a' : '#7fc75a'; g.fillRect(0, top + i * lh, W, lh); }
    g.fillStyle = '#3e7a2e'; g.fillRect(W - 46, top, 46, lanes * lh);
    return { lh, top, y: i => top + i * lh + lh / 2 };
  }
  function boar(g, x, y, s = 1, hurt = 0) { g.save(); g.translate(x, y); g.scale(s, s); disc(g, 0, 0, 16, hurt ? '#ff9a9a' : '#8b5a3c'); disc(g, -14, 2, 8, '#b07a5a'); disc(g, -18, 0, 2, '#2a1a10'); disc(g, -6, -8, 3, '#fff'); disc(g, -6, -8, 1.5, '#111'); g.fillStyle = '#fff6e0'; g.fillRect(-20, 6, 3, 6); g.restore(); }
  function shooter(g, x, y, s = 1) { g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = '#3a8a3a'; g.fillRect(-3, 0, 6, 18); disc(g, 0, -4, 13, '#55c255'); disc(g, 9, -6, 6, '#2e7a2e'); disc(g, -3, -9, 3, '#fff'); disc(g, -2, -9, 1.5, '#111'); g.restore(); }
  function sunflower(g, x, y, t = 0) { for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + t; disc(g, x + Math.cos(a) * 11, y + Math.sin(a) * 11, 6, '#ffd23f'); } disc(g, x, y, 8, '#8a5a2c'); g.fillStyle = '#3a8a3a'; g.fillRect(x - 2, y + 8, 4, 14); }
  function hand(g, x, y, ghost = false) { g.save(); g.globalAlpha = ghost ? 0.55 : 1; emo(g, '👆', x, y + 12, 28); g.restore(); }

  /* =================== урок 23: почему люди играют =================== */
  MOTION['sdt-flame'] = (g, t, W, H, c = {}) => {
    sky(g, W, H, '#1a1640', '#3a2a5a');
    const on = ['avt', 'komp', 'svyaz'].filter(k => c[k]).length;
    const P = [{ k: 'avt', x: 110, y: 120, e: '🧭', n: 'Автономия', s: 'сам выбираю путь', col: '#5fe0ff' }, { k: 'komp', x: 320, y: 70, e: '💪', n: 'Компетентность', s: 'у меня получается', col: '#7cf5a8' }, { k: 'svyaz', x: 530, y: 120, e: '🤝', n: 'Связь', s: 'я вместе с другими', col: '#ffb547' }];
    const fx = 320, fy = 236, fh = 26 + on * 34 + Math.sin(t * 9) * 4 * (on + 1);
    // костёр мотивации: чем больше топлива, тем выше пламя
    g.fillStyle = '#6b4a30'; g.fillRect(fx - 46, fy + 10, 92, 10); g.fillRect(fx - 30, fy + 4, 60, 8);
    glow(g, fx, fy - fh * 0.4, 50 + on * 34, on ? 'rgba(255,170,60,.55)' : 'rgba(120,120,160,.25)');
    for (let i = 0; i < 3; i++) { const w = (30 - i * 8) * (0.6 + on * 0.25), hh = fh * (1 - i * 0.22); g.fillStyle = ['#ff5a2a', '#ff9a3c', '#ffe14a'][i]; g.beginPath(); g.moveTo(fx - w, fy + 6); g.quadraticCurveTo(fx - w * 0.6, fy - hh * 0.5, fx + Math.sin(t * 7 + i) * 6, fy - hh); g.quadraticCurveTo(fx + w * 0.6, fy - hh * 0.5, fx + w, fy + 6); g.fill(); }
    P.forEach((p, i) => {
      const yes = !!c[p.k];
      glow(g, p.x, p.y, yes ? 46 : 0, p.col, 0.6);
      rr(g, p.x - 74, p.y - 28, 148, 56, 14, yes ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.04)', yes ? p.col : '#3a3a5a');
      emo(g, p.e, p.x - 50, p.y, 24); text(g, p.n, p.x + 14, p.y - 8, yes ? p.col : '#8a8aa8', 13); text(g, p.s, p.x + 14, p.y + 10, '#c8c8e0', 10, 'center', 600);
      if (yes) for (let k = 0; k < 6; k++) { const q = ((t * 0.7 + k / 6 + i * 0.13) % 1), xx = lerp(p.x, fx, io(q)), yy = lerp(p.y + 24, fy - 20, q) - Math.sin(q * Math.PI) * 30; disc(g, xx, yy, 3.5 * (1 - q * 0.5), p.col); }
    });
    // игрок у костра: реплика зависит от топлива
    hero(g, 470, 252, 16, '#ff7ad9', -1, 0);
    bubble(g, 470, 226, ['Скучно… выйду', 'Ну, ничего так', 'Интересно!', 'Ещё! И завтра тоже!'][on], on === 3 ? '#fff1a8' : '#fffbe8');
    text(g, `Мотивация: ${['гаснет', 'тлеет', 'горит', 'пылает'][on]}`, 120, 266, ['#8a8aa8', '#ffb547', '#ffd23f', '#ff8a4c'][on], 15);
  };
  MOTION['tile-colors'] = (g, t, W, H, c = {}) => {
    g.fillStyle = '#121a33'; g.fillRect(0, 0, W, H);
    const nums = !!c.nums, s = 46, x0 = 196, rows = [[['☀️', 'n'], ['🌊', 'y'], ['⭐', 'n'], ['🌙', 'g'], ['🔥', 'n']], [['🌊', 'g'], ['🌲', 'n'], ['🌙', 'y'], ['🌙', 'n'], ['💧', 'g']], [['🌊', 'g'], ['🌙', 'g'], ['⛰️', 'g'], ['🌙', 'g'], ['💧', 'g']]];
    const T = t % 9;
    rows.forEach((row, r) => {
      const start = 0.4 + r * 2.6;
      row.forEach(([sym, m], i) => {
        const k = seg(T, start + i * 0.22, start + i * 0.22 + 0.3), done = k >= 1;
        const col = T < start ? '#2a3560' : !done ? (k < 0.5 ? C.e : (nums ? '#7d86a8' : C[m])) : (nums ? '#7d86a8' : C[m]);
        tile(g, x0 + i * (s + 6), 52 + r * (s + 8), s, T < start ? '#2a3560' : col, T < start ? '' : sym, k < 1 ? k : 0);
      });
      if (T > start + 1.5) {
        if (nums) { const a = row.filter(x => x[1] === 'g').length, b = row.filter(x => x[1] === 'y').length; text(g, `${a}● ${b}○`, x0 + 5 * (s + 6) + 36, 52 + r * (s + 8) + s / 2, '#ffffff', 16); }
        else if (r < 2) text(g, r === 0 ? '🌙 на месте!' : '🌊 и 💧 нашлись!', x0 + 5 * (s + 6) + 54, 52 + r * (s + 8) + s / 2, '#7cf5a8', 12);
      }
    });
    if (!nums) { [['g', 'на месте'], ['y', 'есть, но не тут'], ['n', 'нет в узоре']].forEach(([m, l], i) => { rr(g, 20, 70 + i * 34, 22, 22, 4, C[m]); text(g, l, 50, 81 + i * 34, '#f2efe6', 12, 'left'); }); }
    else { text(g, 'Какой именно на месте?', 100, 110, '#ff8a8a', 13); emo(g, '🤷', 100, 150, 34); }
    if (T > 7.6) { const k = ob(seg(T, 7.6, 8)); g.save(); g.translate(320, 268); g.scale(k, k); text(g, nums ? 'Числа: угадал, но не знаешь что — компетентность не растёт' : 'Каждая плитка говорит правду — «я понял сам!»', 0, 0, nums ? '#ffb547' : '#7cf5a8', 15); g.restore(); }
  };
  MOTION['one-day'] = (g, t, W, H, c = {}) => {
    sky(g, W, H, '#162244', '#2b3f73');
    const each = !!c.each, cx = 320, cy = 150, N = 7;
    // чат класса в центре
    rr(g, cx - 90, cy - 44, 180, 92, 16, 'rgba(255,255,255,.08)', '#5fe0ff');
    text(g, '💬 Чат класса', cx, cy - 58, '#5fe0ff', 13);
    for (let i = 0; i < N; i++) {
      const a = -Math.PI / 2 + i * TAU / N, px = cx + Math.cos(a) * 230, py = cy + Math.sin(a) * 112;
      hero(g, px, py, 14, ['#ff7ad9', '#ffd23f', '#7cf5a8', '#5fe0ff', '#ff8a4c', '#b49bff', '#ff5d6e'][i], Math.cos(a) > 0 ? -1 : 1);
      const R = rng(i * 7 + (each ? Math.floor(t / 2) : 3));
      const q = ((t * 0.45 + i / N) % 1) * 0.8, fx = lerp(px, cx + Math.cos(a) * 60, io(q)), fy = lerp(py, cy + Math.sin(a) * 26, io(q));
      // сетка летит в чат
      for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) { const v = R(); g.fillStyle = each ? ['#7d86a8', '#5a6380'][r % 2] : v > 0.6 ? C.g : v > 0.3 ? C.y : C.n; g.fillRect(fx - 12 + k * 6, fy - 9 + r * 6, 5, 5); }
    }
    if (!each) { text(g, '🟩🟨⬛ × 7', cx, cy + 4, '#fff1a8', 14); text(g, '«У меня за 3!» «А у меня 5…»', cx, cy + 24, '#f2efe6', 11, 'center', 600); }
    else { emo(g, '🤷', cx, cy + 8, 28); text(g, 'у всех разное', cx, cy + 28, '#ff8a8a', 11); }
    const left = 86400 - Math.floor(t * 37) % 86400, hh = Math.floor(left / 3600), mm = Math.floor(left / 60) % 60, ss = left % 60;
    rr(g, 12, 262, 220, 28, 8, 'rgba(0,0,0,.4)');
    text(g, each ? 'Новая загадка каждую минуту' : `Новая загадка через ${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`, 122, 276, each ? '#ff8a8a' : '#ffd23f', 12);
    text(g, each ? 'Сравнивать нечего — и ждать нечего' : 'Одна на всех — есть о чём поговорить', 470, 276, each ? '#ff8a8a' : '#7cf5a8', 13);
  };
  MOTION['bartle-map'] = (g, t, W, H) => {
    g.fillStyle = '#10172d'; g.fillRect(0, 0, W, H);
    const cx = 320, cy = 160;
    g.strokeStyle = '#3a4880'; g.lineWidth = 2; g.beginPath(); g.moveTo(60, cy); g.lineTo(580, cy); g.moveTo(cx, 40); g.lineTo(cx, 285); g.stroke();
    text(g, '← действовать', 40, cy, '#9aa3c7', 11, 'left'); text(g, 'общаться →', 600, cy, '#9aa3c7', 11, 'right');
    text(g, 'мир ↑', cx, 28, '#9aa3c7', 11); text(g, 'люди ↓', cx, 292, '#9aa3c7', 11);
    const Q = [
      { x: 180, y: 100, e: '🏆', n: 'Покорители', s: 'пройти всё на 100%', col: '#ffd23f' },
      { x: 460, y: 100, e: '🧭', n: 'Исследователи', s: 'найти тайное', col: '#5fe0ff' },
      { x: 460, y: 222, e: '💬', n: 'Общающиеся', s: 'играть с друзьями', col: '#ff7ad9' },
      { x: 180, y: 222, e: '⚔️', n: 'Соперники', s: 'обогнать других', col: '#ff5d6e' },
    ];
    const cur = Math.floor(t / 2.2) % 4;
    Q.forEach((q, i) => {
      const on = i === cur, k = on ? (t % 2.2) / 2.2 : 0, a = ob(seg(t, i * 0.3, i * 0.3 + 0.5));
      g.save(); g.translate(q.x, q.y); g.scale(a, a);
      rr(g, -110, -42, 220, 84, 16, on ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.03)', on ? q.col : '#2a3560');
      hero(g, -70, 6 - (on ? Math.abs(Math.sin(k * Math.PI * 3)) * 10 : 0), 15, q.col, 1);
      emo(g, q.e, -70, -22, 18); text(g, q.n, 18, -10, q.col, 15); text(g, q.s, 18, 12, '#c8c8e0', 11, 'center', 600);
      g.restore();
      if (on) {
        if (i === 0) for (let s = 0; s < 3; s++) emo(g, '⭐', q.x + 40 + s * 22, q.y + 30 - Math.max(0, Math.sin(k * 6 - s)) * 12, 12);
        if (i === 1) { glow(g, q.x + 90 * k - 40, q.y + 30, 30, '#fff3b0'); emo(g, '🗝️', q.x + 80, q.y + 30, 14); }
        if (i === 2) for (let s = 0; s < 3; s++) emo(g, '❤️', q.x + 30 + s * 20, q.y + 30 - ((k * 3 + s * 0.3) % 1) * 20, 11);
        if (i === 3) emo(g, '👑', q.x + 70, q.y + 30 - Math.abs(Math.sin(k * 8)) * 6, 16);
      }
    });
  };
  MOTION['player-lens'] = (g, t, W, H) => {
    sky(g, W, H, '#1b1430', '#2f2350');
    const k1 = ob(seg(t, 0.2, 0.8)), k2 = seg(t, 1, 1.6), k3 = seg(t, 2, 2.6), k4 = seg(t, 3, 3.6), k5 = ob(seg(t, 4.2, 4.8));
    g.save(); g.translate(200, 150); g.scale(k1, k1); g.rotate((1 - k1) * 0.4);
    rr(g, -110, -120, 220, 240, 18, '#fffbe8'); rr(g, -96, -106, 192, 92, 12, '#b49bff');
    hero(g, 0, -60, 30, '#ff7ad9', 1);
    g.globalAlpha = k2; text(g, 'Лиана, 14 лет', 0, 2, '#1b1430', 16); g.globalAlpha = 1;
    g.globalAlpha = k3; text(g, '❤ любит тайные комнаты', 0, 30, '#3a2a5a', 12, 'center', 700); g.globalAlpha = 1;
    g.globalAlpha = k4; text(g, '⏱ 10 минут в автобусе', 0, 54, '#3a2a5a', 12, 'center', 700); g.globalAlpha = 1;
    if (k5 > 0) { g.save(); g.translate(70, 92); g.scale(k5, k5); g.rotate(-0.2); disc(g, 0, 0, 30, '#5fe0ff'); emo(g, '🧭', 0, -2, 22); text(g, 'исследователь', 0, 22, '#0b1020', 8); g.restore(); }
    g.restore();
    const q = seg(t, 5.2, 6);
    if (q > 0) { g.globalAlpha = q; wrap(g, 'Линза игрока: для кого эта игра и что ему нужно?', 470, 120, 280, 26, '#ffd23f', 20); wrap(g, 'Сначала портрет — потом механика. Одна игра не может понравиться всем.', 470, 196, 280, 20, '#c8c8e0', 13, 'center', 600); g.globalAlpha = 1; }
  };

  /* =================== урок 24: онбординг, интерфейс, доступность =================== */
  MOTION['pvz-first'] = (g, t, W, H) => {
    const T = t % 10, L = garden(g, W, H, 1, 120);
    g.fillStyle = 'rgba(40,30,20,.55)'; g.fillRect(0, 70, W, 50); g.fillRect(0, 280, W, 20);
    rr(g, 16, 16, 64, 80, 10, T < 3 ? '#fff1a8' : '#e8dcc0', '#7a4b25'); shooter(g, 48, 58, 0.9); text(g, '100', 48, 86, '#7a4b25', 11);
    if (T < 3) glow(g, 48, 56, 50 + Math.sin(T * 8) * 6, 'rgba(255,220,80,.6)');
    const cell = 150;
    // рука-призрак показывает, куда посадить
    if (T < 3) { const k = io(seg(T, 0.6, 2.4)); hand(g, lerp(48, cell, k), lerp(70, L.y(0), k), true); if (T > 2.2) { g.globalAlpha = 0.5; shooter(g, cell, L.y(0)); g.globalAlpha = 1; } }
    if (T >= 3) shooter(g, cell, L.y(0), T < 3.3 ? ob(seg(T, 3, 3.3)) : 1);
    // кабанчик выходит только после посадки — безопасный момент
    if (T > 4) {
      const bx = Math.max(cell + 50, lerp(640, 240, seg(T, 4, 9))), hits = Math.floor(Math.max(0, T - 4.6) / 0.8);
      for (let i = 0; i <= hits; i++) { const q = ((T - 4.6) - i * 0.8) / 0.8; if (q > 0 && q < 1) disc(g, lerp(cell + 14, bx, q), L.y(0) - 6, 5, '#a0703a'); }
      if (hits < 5) boar(g, bx, L.y(0), 1, (T - 4.6) % 0.8 < 0.1 ? 1 : 0); else confetti(g, bx, L.y(0), seg(T, 8.6, 9.6), 16);
    }
    caption(g, T < 3 ? '1' : T < 4 ? '2' : '3', T < 3 ? 'Одна грядка, одна карта — и рука показывает, что делать' : T < 4 ? 'Ты сделал сам. Враг ещё не пришёл: ошибиться не страшно' : 'Первый враг — слабый и медленный: правило проверено делом', W);
  };
  MOTION['one-thing'] = (g, t, W, H, c = {}) => {
    g.fillStyle = '#12182e'; g.fillRect(0, 0, W, H);
    const all = !!c.all, cards = [['🌰', 'Орехомёт'], ['🌻', 'Подсолнух'], ['🎃', 'Тыква'], ['🐝', 'Улей'], ['🌶️', 'Перец']];
    if (!all) {
      g.strokeStyle = '#3a4880'; g.lineWidth = 3; g.beginPath(); g.moveTo(50, 190); g.lineTo(600, 190); g.stroke();
      cards.forEach(([e, n], i) => {
        const x = 70 + i * 128, a = ob(seg(t % 9, i * 1.4, i * 1.4 + 0.5));
        disc(g, x, 190, 7, a > 0 ? '#7cf5a8' : '#3a4880'); text(g, 'День ' + (i + 1), x, 214, '#9aa3c7', 11);
        if (a > 0) { g.save(); g.translate(x, 130); g.scale(a, a); rr(g, -38, -46, 76, 92, 12, '#fffbe8', '#7cf5a8'); emo(g, e, 0, -10, 30); text(g, n, 0, 30, '#1b1430', 11); g.restore(); hero(g, x, 252, 11, '#5fe0ff', 1); emo(g, '💡', x + 14, 236, 13); }
      });
      caption(g, '', 'По одной вещи, вовремя: новый защитник — новый день', W);
    } else {
      cards.forEach(([e, n], i) => { const x = 80 + i * 120, y = 110 + Math.sin(t * 6 + i) * 4; rr(g, x - 40, y - 46, 80, 92, 12, '#fffbe8', '#ff5d6e'); emo(g, e, x, y - 10, 30); text(g, n, x, y + 30, '#1b1430', 11); });
      const R = rng(Math.floor(t * 2)); for (let i = 0; i < 5; i++) emo(g, '❓', 60 + R() * 520, 210 + R() * 60, 18 + R() * 10);
      hero(g, 320, 250, 14, '#5fe0ff', 1); bubble(g, 320, 226, 'Что из этого нажимать?!', '#ffd6d6');
      caption(g, '', 'Всё сразу: пять новых вещей — и ни одну не понял', W);
    }
  };
  MOTION['clean-ui'] = (g, t, W, H, c = {}) => {
    const clean = !!c.clean, k = clean ? seg(c._id === 'clean' ? c._t : 9, 0, 0.6) : 1 - seg(c._id === 'clean' ? c._t : 9, 0, 0.6);
    const L = garden(g, W, H, 3, 80);
    shooter(g, 140, L.y(0)); sunflower(g, 90, L.y(1), t); shooter(g, 140, L.y(2)); boar(g, 420 - (t * 20) % 120, L.y(1));
    // главное: жизни и цель — крупнее, когда второстепенное спрятано
    const sMain = lerp(1, 1.35, k);
    rr(g, 14, 12, 150 * sMain, 34 * sMain, 10, 'rgba(0,0,0,.55)'); text(g, '☀ 150', 14 + 75 * sMain, 12 + 17 * sMain, '#ffd23f', 15 * sMain);
    rr(g, W - 14 - 170 * sMain, 12, 170 * sMain, 34 * sMain, 10, 'rgba(0,0,0,.55)'); text(g, 'Волна 2 из 5', W - 14 - 85 * sMain, 12 + 17 * sMain, '#7cf5a8', 14 * sMain);
    g.globalAlpha = 1 - k;
    const junk = ['XP 1234/5000', '⭐ 12', '💎 3', 'FPS 60', 'Сезон 4', '🎁 Ежедневная!', 'Магазин', 'Лига', '⚙', 'Друзья 3', 'Ур. 17', 'Квест 2/7'];
    junk.forEach((s, i) => { const x = 40 + (i % 6) * 100, y = 56 + Math.floor(i / 6) * 230; rr(g, x - 44, y - 12, 88, 24, 6, 'rgba(0,0,0,.6)', '#ff8a4c'); text(g, s, x, y, '#ffffff', 11); });
    g.globalAlpha = 1;
    text(g, clean ? 'Главное видно сразу: ресурс и цель' : 'Где тут мой ресурс? И что за «Сезон 4»?', 320, 290, clean ? '#7cf5a8' : '#ff8a8a', 14);
  };
  MOTION.a11y = (g, t, W, H, c = {}) => {
    const hc = !!c.contrast, big = !!c.big, cb = !!c.cb, slow = !!c.slow, sp = slow ? 0.45 : 1;
    if (hc) { g.fillStyle = '#05070f'; g.fillRect(0, 0, W, H); } else sky(g, W, H, '#a8c8a0', '#bcd4b0');
    const lanes = 3, top = 70, lh = 64;
    for (let i = 0; i < lanes; i++) { g.fillStyle = hc ? (i % 2 ? '#1a1a1a' : '#262626') : (i % 2 ? '#9cbf8a' : '#a6c894'); g.fillRect(0, top + i * lh, W, lh); }
    // враги красные, друзья зелёные — без контраста и значков их трудно отличить
    const items = [[0, 1], [1, 0], [2, 1], [0, 0], [2, 0]];
    items.forEach(([lane, bad], i) => {
      const x = (W + 60) - ((t * 70 * sp + i * 140) % (W + 120)), y = top + lane * lh + lh / 2;
      const col = hc ? (bad ? '#ff2a4a' : '#3dff7a') : (bad ? '#a88a5a' : '#94a85a');
      disc(g, x, y, 18, col); if (hc) { g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 18, 0, TAU); g.stroke(); }
      if (cb) emo(g, bad ? '⚠️' : '🙂', x, y - 30, 18);
      if (cb && bad) { g.strokeStyle = hc ? '#fff' : '#3a2a1a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 10, y - 10); g.lineTo(x + 10, y + 10); g.moveTo(x + 10, y - 10); g.lineTo(x - 10, y + 10); g.stroke(); }
    });
    const px = big ? 22 : 11;
    rr(g, 12, 12, big ? 300 : 170, big ? 44 : 26, 8, hc ? '#ffffff' : 'rgba(0,0,0,.25)');
    text(g, 'Лови 🙂, обходи ⚠', 12 + (big ? 150 : 85), 12 + (big ? 22 : 13), hc ? '#000' : '#5a6a50', px);
    if (slow) { rr(g, W - 130, 14, 116, 30, 8, '#5fe0ff'); text(g, '⏸ P · ×0,45', W - 72, 29, '#0b1020', 13); }
    const on = [hc, big, cb, slow].filter(Boolean).length;
    text(g, on ? `Включено ${on} из 4 — играть могут больше людей` : 'Плохо видишь цвета или мелкий шрифт? Тогда эта игра — не для тебя…', 320, 284, hc ? '#ffffff' : '#2a3a20', 14);
  };
  MOTION['portal-60'] = (g, t, W, H) => {
    const T = t % 12;
    g.fillStyle = '#d9e0e8'; g.fillRect(0, 0, W, H); g.fillStyle = '#9aa4b0'; g.fillRect(0, 240, W, 60);
    for (let i = 40; i < W; i += 80) { g.strokeStyle = '#c3ccd6'; g.strokeRect(i, 30, 80, 80); }
    rr(g, 520, 140, 70, 100, 6, T > 8.5 ? '#7cf5a8' : '#5a6370'); text(g, T > 8.5 ? 'открыто' : 'дверь', 555, 190, '#fff', 11);
    // кнопка на полу, куб, героиня
    rr(g, 380, 232, 60, 10, 4, T > 7.5 ? '#ff7ad9' : '#a03a7a');
    const cubeX = T < 4 ? 160 : T < 7.5 ? lerp(160, 410, io(seg(T, 5, 7.5))) : 410, cubeY = T < 4 ? 212 : T < 7.5 ? 160 : 212;
    rr(g, cubeX - 14, cubeY - 14, 28, 28, 4, '#c3ccd6', '#6f7986'); disc(g, cubeX, cubeY, 5, '#ff7ad9');
    const hx = T < 4 ? lerp(60, 140, seg(T, 0.5, 3.5)) : T < 7.5 ? lerp(140, 390, io(seg(T, 5, 7.5))) : T < 10 ? lerp(390, 550, seg(T, 9, 11)) : 550;
    hero(g, hx, 224, 14, '#f2efe6', 1);
    const think = T < 2 ? 'Комната… куб… кнопка…' : T < 4.5 ? 'А если взять куб?' : T < 7.5 ? 'Несу на кнопку!' : T < 9 ? 'Дверь открылась — я понял сам!' : 'Дальше!';
    bubble(g, hx, 196, think, T > 7.5 && T < 9 ? '#d6ffe4' : '#fffbe8');
    // полоса времени: что понял игрок
    g.fillStyle = '#2a3560'; g.fillRect(40, 270, 560, 6); g.fillStyle = '#5fe0ff'; g.fillRect(40, 270, 560 * (T / 12), 6);
    [[2, 'смотрю'], [4.5, 'догадка'], [7.5, 'проверка'], [9, 'награда']].forEach(([s, l]) => { disc(g, 40 + 560 * s / 12, 273, 6, T >= s ? '#ffd23f' : '#3a4880'); text(g, l, 40 + 560 * s / 12, 290, '#3a4050', 10); });
    caption(g, '', 'Portal: первая минута — комната учит без слов, игрок думает вслух', W);
  };
  // записи новичка для «Первой минуты»: что делает игрок (курсор и герой), без подсказок, где он потерялся
  MOTION['clip-wall'] = (g, t, W, H) => {
    const L = garden(g, W, H, 3, 70);
    rr(g, 12, 6, 200, 56, 8, '#fffbe8', '#7a4b25'); [['🌰', 0], ['🌻', 1], ['🎃', 2]].forEach(([e, i]) => { rr(g, 18 + i * 64, 10, 56, 48, 6, '#e8dcc0'); emo(g, e, 46 + i * 64, 34, 24); });
    if (t < 9) { // стена текста
      g.fillStyle = 'rgba(0,0,0,.7)'; g.fillRect(0, 0, W, H); rr(g, 80, 40, 480, 220, 12, '#fffbe8');
      text(g, 'ПРАВИЛА ИГРЫ', 320, 62, '#1b1430', 16);
      for (let i = 0; i < 9; i++) { g.fillStyle = '#9a8f7a'; g.fillRect(100, 82 + i * 18, 440 - (i % 3) * 60, 6); }
      rr(g, 270, 236, 100, 18, 6, '#7cf5a8'); text(g, 'Понятно', 320, 245, '#06140c', 11);
      const cx = t < 5 ? 320 + Math.sin(t * 1.2) * 30 : lerp(320, 320, 1), cy = t < 5 ? 150 + Math.cos(t) * 20 : lerp(150, 245, seg(t, 7, 8.6));
      emo(g, '🖱️', cx, cy, 18);
    } else {
      const bx = lerp(640, 160, seg(t, 9, 18));
      boar(g, bx, L.y(1));
      const cx = t < 14 ? 120 + Math.sin(t * 3) * 90 : t < 18 ? lerp(120, 46, seg(t, 14, 16)) : 46 + Math.sin(t * 9) * 4, cy = t < 14 ? 40 + Math.cos(t * 2.4) * 30 : 34;
      emo(g, '🖱️', cx, cy, 18);
      if (t > 18) { shooter(g, 100, L.y(0)); text(g, 'посадил не на ту грядку', 220, L.y(0), '#3a2a1a', 11); }
      if (t > 21) { g.fillStyle = 'rgba(255,60,60,.25)'; g.fillRect(0, L.y(1) - L.lh / 2, 160, L.lh); }
    }
    text(g, `${Math.floor(t)} с`, W - 30, 286, '#1b1430', 12);
  };
  MOTION['clip-all'] = (g, t, W, H) => {
    const L = garden(g, W, H, 5, 70);
    rr(g, 8, 6, 330, 56, 8, '#fffbe8', '#7a4b25');
    ['🌰', '🌻', '🎃', '🐝', '🌶️'].forEach((e, i) => { rr(g, 14 + i * 64, 10, 58, 48, 6, '#e8dcc0'); emo(g, e, 43 + i * 64, 34, 22); });
    text(g, '☀ 50', 380, 34, '#ffd23f', 16);
    // курсор мечется по картам, ничего не выбирает
    let cx, cy;
    if (t < 7) { const k = Math.floor(t * 1.6) % 5; cx = 43 + k * 64 + Math.sin(t * 9) * 4; cy = 34; }
    else if (t < 12) { cx = lerp(43 + 3 * 64, 300, seg(t, 7, 9)); cy = lerp(34, L.y(4), seg(t, 7, 9)); if (t > 9) emo(g, '🐝', 300, L.y(4), 20); }
    else { cx = 200 + Math.sin(t * 2) * 140; cy = 120 + Math.cos(t * 1.7) * 60; }
    [0, 2, 3].forEach((lane, i) => { const bx = lerp(660, 60, seg(t, 3 + i * 2, 21 + i)); boar(g, bx, L.y(lane), 0.8); });
    if (t > 15) { g.fillStyle = 'rgba(255,60,60,.25)'; g.fillRect(0, L.y(0) - L.lh / 2, 100, L.lh); }
    emo(g, '🖱️', cx, cy, 18);
    text(g, `${Math.floor(t)} с`, W - 30, 286, '#1b1430', 12);
  };
  MOTION['clip-good'] = (g, t, W, H) => {
    const L = garden(g, W, H, 1, 120);
    g.fillStyle = 'rgba(40,30,20,.55)'; g.fillRect(0, 70, W, 50);
    rr(g, 14, 14, 60, 76, 10, t < 3 ? '#fff1a8' : '#e8dcc0', '#7a4b25'); shooter(g, 44, 52, 0.85);
    if (t < 3) { glow(g, 44, 52, 46, 'rgba(255,220,80,.6)'); hand(g, lerp(44, 160, io(seg(t, 0.5, 2.5))), lerp(60, L.y(0), io(seg(t, 0.5, 2.5))), true); }
    let cx = t < 4 ? 44 : t < 5.5 ? lerp(44, 160, io(seg(t, 4, 5.5))) : 160, cy = t < 4 ? 52 : t < 5.5 ? lerp(52, L.y(0), io(seg(t, 4, 5.5))) : L.y(0);
    if (t > 5.5) shooter(g, 160, L.y(0));
    if (t > 8) { const bx = Math.max(220, lerp(660, 220, seg(t, 8, 15))); if (t < 15) boar(g, bx, L.y(0)); else confetti(g, 240, L.y(0), seg(t, 15, 16), 14); }
    // значок без подписи: новичок не понимает, что это — единственная заминка
    rr(g, W - 60, 14, 46, 46, 10, '#5a6380'); emo(g, '⚙️', W - 37, 37, 22);
    if (t > 16 && t < 22) { cx = lerp(160, W - 37, seg(t, 16, 18)); cy = lerp(L.y(0), 37, seg(t, 16, 18)) + (t > 18 ? Math.sin(t * 8) * 3 : 0); }
    emo(g, '🖱️', cx, cy, 18);
    text(g, `${Math.floor(t)} с`, W - 30, 286, '#1b1430', 12);
  };

  /* =================== урок 25: этика =================== */
  MOTION['variable-reward'] = (g, t, W, H, c = {}) => {
    sky(g, W, H, '#2a1f10', '#5a3a14');
    const rnd = !!c.random, cyc = 1.1, n = Math.floor(t / cyc), k = (t % cyc) / cyc;
    // улей и нажатие
    rr(g, 70, 110, 120, 120, 50, '#ffb547', '#8a5a2c'); for (let i = 0; i < 4; i++) { g.fillStyle = '#c8822c'; g.fillRect(80, 140 + i * 22, 100, 5); }
    emo(g, '👆', 150, 220 - (k < 0.2 ? 10 : 0), 26);
    const R = rng(n * 13 + 1), v = rnd ? (R() > 0.85 ? 500 : R() > 0.5 ? 20 : 1) : 10;
    if (k < 0.7) { const s = rnd && v === 500 ? 34 : 18; text(g, '+' + v, 130 + k * 60, 100 - k * 60, v === 500 ? '#ffd23f' : '#ffffff', s); if (v === 500) confetti(g, 140, 90, k, 18, n); }
    // «хочу ещё»: шкала тянется к случайной награде
    let want = 0; for (let i = 0; i <= n; i++) { const r = rng(i * 13 + 1); const vv = rnd ? (r() > 0.85 ? 500 : 0) : 0; want = want * 0.8 + (rnd ? (vv ? 1 : 0.35) : 0.12); }
    want = clamp(want / (rnd ? 2.4 : 0.7), 0, 1);
    rr(g, 300, 80, 290, 34, 10, 'rgba(0,0,0,.4)'); rr(g, 304, 84, 282 * want, 26, 8, rnd ? '#ff5d6e' : '#7cf5a8'); text(g, 'Хочу ещё', 445, 97, '#ffffff', 14);
    wrap(g, rnd ? 'Награда то крошка, то джекпот — мозг ждёт следующего джекпота и жмёт снова' : 'Награда всегда одна: понятно, сколько получишь, — легко остановиться', 445, 170, 290, 22, rnd ? '#ffb3b3' : '#b9f5cf', 15);
    caption(g, '', 'Почему трудно остановиться: случайная награда', W);
  };
  MOTION['fomo-streak'] = (g, t, W, H, c = {}) => {
    const honest = !!c.honest;
    g.fillStyle = honest ? '#10241a' : '#2a0f16'; g.fillRect(0, 0, W, H);
    // слева — таймер «только сейчас», справа — серия дней
    if (!honest) {
      const left = Math.max(0, 9.9 - (t * 1.3) % 10), flash = Math.sin(t * 12) > 0;
      rr(g, 30, 60, 260, 140, 16, flash ? '#ff2a4a' : '#c81e3a'); text(g, 'ТОЛЬКО СЕЙЧАС! ×3 МЁД', 160, 92, '#ffffff', 16); text(g, `0:0${left.toFixed(1).replace('.', ',')}`, 160, 140, '#ffe14a', 34);
      text(g, 'Не успеешь — потеряешь!', 160, 182, '#ffd6d6', 12);
    } else {
      rr(g, 30, 60, 260, 140, 16, '#1f5a3c', '#7cf5a8'); text(g, 'Медовый час', 160, 90, '#7cf5a8', 18);
      ['пн', 'ср', 'пт'].forEach((d, i) => { rr(g, 56 + i * 76, 112, 60, 50, 8, '#2a7a4f'); text(g, d, 86 + i * 76, 126, '#ffffff', 12); text(g, '18:00', 86 + i * 76, 148, '#b9f5cf', 11); });
      text(g, 'Расписание видно — успеешь в другой раз', 160, 182, '#b9f5cf', 11);
    }
    const days = 7, miss = 4;
    for (let i = 0; i < days; i++) {
      const x = 340 + i * 38, y = 110, shown = (t * 1.6) % (days + 3) > i;
      rr(g, x, y, 32, 40, 6, shown ? (i === miss ? (honest ? '#3a5a4a' : '#5a1a22') : '#ffb547') : '#2a3048');
      if (shown) emo(g, i === miss ? (honest ? '💤' : '💔') : '🔥', x + 16, y + 20, 18);
    }
    const after = (t * 1.6) % (days + 3) > miss + 1;
    text(g, after ? (honest ? 'Пропустил день — серия ждёт тебя' : 'Пропустил день — серия СГОРЕЛА') : 'Серия дней', 474, 176, after ? (honest ? '#7cf5a8' : '#ff8a8a') : '#ffd23f', 14);
    caption(g, '', honest ? 'Честно: событие вернётся, серия не сгорает' : 'Страх упустить: таймер и серия, которая сгорает', W);
  };
  MOTION['loot-near'] = (g, t, W, H, c = {}) => {
    sky(g, W, H, '#1b1430', '#3a1f50');
    const odds = !!c.odds, cx = 200, cy = 160, R = 110, T = t % 6;
    const secs = odds ? [{ a: 0.02, col: '#ffd23f', n: '💎' }, { a: 0.18, col: '#b49bff', n: '🎩' }, { a: 0.8, col: '#5a6380', n: '🪨' }] : [{ a: 0.16, col: '#ffd23f', n: '💎' }, { a: 0.17, col: '#5a6380', n: '🪨' }, { a: 0.17, col: '#b49bff', n: '🎩' }, { a: 0.16, col: '#ffd23f', n: '💎' }, { a: 0.17, col: '#5a6380', n: '🪨' }, { a: 0.17, col: '#b49bff', n: '🎩' }];
    const spin = T < 4 ? (1 - Math.pow(1 - T / 4, 3)) * 14.2 : 14.2;
    let a0 = spin;
    secs.forEach(s => { const a1 = a0 + s.a * TAU; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, a0, a1); g.closePath(); g.fillStyle = s.col; g.fill(); g.strokeStyle = '#1b1430'; g.lineWidth = 2; g.stroke(); const m = (a0 + a1) / 2; if (s.a > 0.05) emo(g, s.n, cx + Math.cos(m) * R * 0.65, cy + Math.sin(m) * R * 0.65, 20); a0 = a1; });
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(cx + R + 4, cy); g.lineTo(cx + R + 26, cy - 12); g.lineTo(cx + R + 26, cy + 12); g.fill();
    if (T > 4) {
      if (!odds) { text(g, 'ЧУТЬ-ЧУТЬ НЕ ХВАТИЛО!', 450, 120, '#ff5d6e', 18); text(g, 'Ещё разок? 💎 рядом!', 450, 152, '#ffd23f', 15); text(g, 'Колесо нарочно встаёт у джекпота', 450, 200, '#c8c8e0', 12); }
      else { text(g, 'Шансы: 💎 2%, 🎩 18%, 🪨 80%', 450, 120, '#7cf5a8', 16); text(g, 'Видно, сколько на самом деле', 450, 152, '#b9f5cf', 13); text(g, 'Решаешь сам: стоит ли платить', 450, 200, '#c8c8e0', 12); }
    }
    caption(g, '', odds ? 'Честно: шансы видны заранее' : 'Сундук-лутбокс: «почти выиграл» тянет крутить снова', W);
  };
  MOTION['wait-friends'] = (g, t, W, H, c = {}) => {
    const honest = !!c.honest;
    g.fillStyle = '#141c36'; g.fillRect(0, 0, W, H);
    // энергия
    const e = Math.max(0, 1 - (t % 6) / 3);
    rr(g, 40, 80, 240, 30, 8, '#2a3560'); rr(g, 44, 84, 232 * e, 22, 6, '#5fe0ff'); text(g, '⚡ Энергия пчёл', 160, 66, '#5fe0ff', 13);
    if (e <= 0) {
      if (!honest) { rr(g, 40, 126, 240, 70, 12, '#3a1a2a', '#ff5d6e'); text(g, 'Пчёлы устали! Жди 4:59:59', 160, 148, '#ff8a8a', 13); text(g, 'или 💎 5 — сразу!', 160, 176, '#ffd23f', 15); }
      else { rr(g, 40, 126, 240, 70, 12, '#10241a', '#7cf5a8'); text(g, 'Пчёлы отдыхают 10 секунд', 160, 150, '#7cf5a8', 13); text(g, 'Можно заняться другим', 160, 174, '#b9f5cf', 12); }
    }
    // уведомления от «друзей»
    const names = ['Аслан', 'Мадина', 'Тимур'];
    for (let i = 0; i < 3; i++) {
      const k = seg((t + i * 1.4) % 6, 0, 0.4), y = 70 + i * 62;
      if (honest && i > 0) continue;
      g.save(); g.translate(lerp(680, 330, ob(k)), y);
      rr(g, 0, 0, 280, 48, 12, honest ? '#1f3a5a' : '#3a1a2a', honest ? '#5fe0ff' : '#ff5d6e');
      emo(g, honest ? '🏆' : '😈', 26, 24, 22);
      text(g, honest ? 'Рекорд класса побит: 1240 (это правда)' : `${names[i]} обогнал тебя! Верни своё!`, 152, 24, '#ffffff', 12);
      g.restore();
    }
    caption(g, '', honest ? 'Честно: отдых короткий, сообщения — только настоящие' : 'Ожидание за деньги и давление через друзей', W);
  };
  MOTION.respect = (g, t, W, H, c = {}) => {
    const stop = !!c.stop;
    sky(g, W, H, stop ? '#1d3a5a' : '#2a1020', stop ? '#f7c98a' : '#5a1a30');
    // часы: время утекает
    const cx = 130, cy = 150, sp = stop ? 0.5 : 4;
    disc(g, cx, cy, 70, '#fffbe8'); disc(g, cx, cy, 64, stop ? '#e8f7ff' : '#ffe8e8');
    for (let i = 0; i < 12; i++) { const a = i * TAU / 12; disc(g, cx + Math.cos(a) * 54, cy + Math.sin(a) * 54, 3, '#1b1430'); }
    const a1 = t * sp - Math.PI / 2, a2 = t * sp / 12 - Math.PI / 2;
    arrow(g, cx, cy, cx + Math.cos(a1) * 50, cy + Math.sin(a1) * 50, '#ff5d6e', 3); arrow(g, cx, cy, cx + Math.cos(a2) * 34, cy + Math.sin(a2) * 34, '#1b1430', 4);
    text(g, stop ? '15 минут' : `${Math.floor(t * sp * 2)} минут…`, cx, cy + 92, stop ? '#1f5a3c' : '#ff8a8a', 15);
    if (!stop) {
      const k = (t * 1.4) % 1; hero(g, 400, 200 - Math.abs(Math.sin(k * Math.PI)) * 10, 18, '#ff7ad9', 1);
      rr(g, 340, 90, 200, 50, 14, '#ff2a4a'); text(g, 'ЕЩЁ РАЗОК!', 440, 115, '#ffffff', 20); rr(g, 500, 150, 70, 18, 6, '#3a1a2a'); text(g, 'хватит', 535, 159, '#7a5a6a', 9);
      text(g, 'Нет цели — нет конца. Время ушло, а радости нет', 420, 262, '#ffb3b3', 13);
    } else {
      const k = seg(t % 6, 2, 4); hero(g, lerp(400, 560, k), 220, 18, '#ff7ad9', 1);
      rr(g, 320, 80, 260, 70, 14, '#fffbe8', '#7cf5a8'); text(g, 'Бочка полна! 🍯', 450, 104, '#1b1430', 18); text(g, 'Ты молодец — можно отдохнуть', 450, 130, '#2a7a4f', 13);
      text(g, 'Цель достигнута — игрок рад и уходит сам', 430, 262, '#1f5a3c', 14);
    }
    caption(g, '', 'Линза уважения: рад ли игрок, что провёл время в моей игре?', W);
  };

  window.LabM6 = { wrap, emo, bubble, tile, garden, boar, shooter, C, SYM };
})();

/* =================================================================================================
   Типы шагов модуля 6. Берут помощники страницы ученика из student.js: S, ans, stepById, Games, el, api, toast, beep, copy, fieldEditor, valText.
   ================================================================================================= */
(function () {
  if (typeof STEPS === 'undefined' || !window.LabMotion) return;
  const { TAU, clamp, seg, io, ob, lerp, rng, hashStr, rr, text, disc, glow, hero, confetti, fast } = window.LabMotion.kit;
  const { wrap, emo, C: TC } = window.LabM6;
  const padReader = window.LabMotion.padReader;
  const shuffle = (list, seed) => { const r = rng(seed), a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const mySeed = id => hashStr((S.me && S.me.nick || '') + ':' + id);
  const plural = (n, a, b, c) => { const m = Math.abs(n) % 100, k = m % 10; return m > 10 && m < 20 ? c : k === 1 ? a : k >= 2 && k <= 4 ? b : c; };
  // холст, который рисует draw(g, t) каждый кадр, пока он на странице
  function liveCanvas(w, h, draw, cls) {
    const cv = el('canvas', { width: w, height: h, class: 'm4-cv ' + (cls || ''), tabindex: '0' }), g = cv.getContext('2d');
    const t0 = performance.now(); let raf = 0;
    // холст за экраном не рисуется; в автопроверке (LAB_LOWRES) — 10 кадров в секунду: без видеокарты холсты съедают процессор у игр
    let last = 0;
    const loop = now => {
      if (!cv.isConnected && now - t0 > 3000) { cancelAnimationFrame(raf); return; }
      raf = requestAnimationFrame(loop);
      if (window.LAB_LOWRES && now - last < 100) return;
      const r = cv.getBoundingClientRect(); if (cv.isConnected && (r.bottom < 0 || r.top > innerHeight) && last) { draw.idle && draw.idle(); return; }
      last = now; g.save(); g.clearRect(0, 0, w, h); try { draw(g, (now - t0) / 1000); } catch (e) { /* кадр пропущен */ } g.restore();
    };
    raf = requestAnimationFrame(loop);
    return cv;
  }
  // кольцо-оценка: SVG, дуга дорисовывается анимацией
  function ring(val, max, label, col = 'var(--accent)') {
    const r = 34, L = 2 * Math.PI * r, k = max ? clamp(val / max, 0, 1) : 0;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 90 90'); svg.setAttribute('class', 'm6-ring');
    svg.innerHTML = `<circle cx="45" cy="45" r="${r}" class="bg"/><circle cx="45" cy="45" r="${r}" class="fg" style="stroke:${col};stroke-dasharray:${L};--to:${L * (1 - k)}"/><text x="45" y="44" class="v">${val}</text><text x="45" y="60" class="l">из ${max}</text>`;
    return el('div', { class: 'm6-ringbox' }, svg, el('span', { class: 'small' }, label));
  }
  // полоски с анимацией роста (доля 0..1)
  const bars = rows => el('div', { class: 'm6-bars' }, rows.map((r, i) => el('div', { class: 'm6-bar' + (r.me ? ' me' : '') },
    el('span', { class: 'lab' }, r.label), el('span', { class: 'track' }, el('i', { style: `--w:${Math.round(clamp(r.k, 0, 1) * 100)}%;--d:${i * 0.08}s;${r.col ? 'background:' + r.col : ''}` })), el('b', {}, r.show != null ? r.show : ''))));

  /* ---------------- brosok: брось карточку тому, кому она понравится ---------------- */
  STEPS.brosok = ctx => {
    const st = ctx.step, T = st.targets, N = T.length, secs = st.seconds || 14;
    const order = shuffle(st.items.map((_, i) => i), mySeed(st.id));
    let v = Object.assign({ i: 0, correct: 0, score: 0, streak: 0, best: 0, mistakes: [], by: {} }, ctx.value || {});
    let phase = 'aim', sel = 0, fly = null, t0 = performance.now(), result = null, hitAt = 0, lastNow = 0;
    const W = 640, H = 330, pad = padReader();
    const pos = k => ({ x: N === 2 ? (k ? 470 : 170) : 80 + k * (480 / (N - 1)), y: 252 });
    const host = el('div', { class: 'stack m6-brosok' });
    const why = el('div', { class: 'm6-why', 'aria-live': 'polite' });
    const btns = el('div', { class: 'm6-targets', style: `grid-template-columns:repeat(${N},minmax(0,1fr))` });
    const next = el('button', { type: 'button', class: 'btn', 'data-brosok': 'next', hidden: true, onclick: () => advance() }, 'Дальше →');
    const cur = () => st.items[order[v.i]];
    function throwTo(k) {
      if (phase !== 'aim') return;
      phase = 'fly'; sel = k; fly = { k, t: performance.now() };
      beep('tick');
      setTimeout(() => land(k), fast() ? 200 : 450);
    }
    function land(k) {
      const it = cur(), right = T.findIndex(x => x.id === it.target), ok = k === right;
      const b = v.by[it.target] = v.by[it.target] || [0, 0]; b[1]++;
      if (ok) { b[0]++; v.correct++; v.streak++; v.best = Math.max(v.best, v.streak); const left = Math.max(0, secs - (performance.now() - t0) / 1000); v.score += Math.round(100 * Math.min(4, v.streak) + left * 5); beep('good'); }
      else { v.streak = 0; v.mistakes = v.mistakes.concat(it.text).slice(-12); beep('bad'); }
      result = { ok, k, right, timeout: k < 0 }; hitAt = performance.now(); phase = 'show';
      why.replaceChildren(el('b', {}, ok ? (['Точно!', 'Да!', 'В цель!', 'Верно!'][v.i % 4]) : k < 0 ? 'Время вышло.' : 'Не совсем.'), ' ', ok ? '' : `Это для «${T[right].label}». `, it.why || '');
      next.hidden = false; next.textContent = v.i + 1 < order.length ? 'Дальше →' : 'Итог';
      ctx.save(Object.assign({}, v, { i: v.i }), null);
      if (ok && !fast()) setTimeout(() => { if (phase === 'show' && result && result.ok && host.isConnected) advance(); }, 1500);
      paintBtns();
    }
    function advance() {
      if (phase !== 'show') return;
      v.i++; result = null; why.replaceChildren(); next.hidden = true;
      if (v.i >= order.length) { phase = 'end'; v.total = order.length; ctx.save(v, true, true); beep('done'); finish(); return; }
      ctx.save(v); phase = 'aim'; t0 = performance.now(); paintBtns();
    }
    function paintBtns() {
      btns.replaceChildren(...T.map((x, k) => el('button', { type: 'button', class: 'opt m6-tbtn' + (k === sel && phase === 'aim' ? ' on' : '') + (result && k === result.right ? ' good' : '') + (result && !result.ok && k === result.k ? ' bad' : ''), 'data-throw': x.id, disabled: phase !== 'aim', onclick: () => throwTo(k) },
        el('span', { class: 'm4-key' }, String(k + 1)), x.icon + ' ' + x.label)));
    }
    function finish() {
      host.replaceChildren(el('div', { class: 'stack m6-result' },
        el('h2', {}, `Попаданий ${v.correct} из ${v.total} · очки ${v.score}`),
        el('p', { class: 'muted' }, `Лучшая серия: ${v.best}. ${v.correct === v.total ? 'Ни одного промаха!' : 'Промахи — ниже, загляни в разбор.'}`),
        bars(T.map(x => { const b = v.by[x.id] || [0, 0]; return { label: x.icon + ' ' + x.label, k: b[1] ? b[0] / b[1] : 0, show: `${b[0]} из ${b[1]}`, col: x.color }; })),
        v.mistakes.length ? el('details', {}, el('summary', {}, `Промахи (${v.mistakes.length})`), el('ul', {}, v.mistakes.map(m => { const it = st.items.find(x => x.text === m) || {}; const tg = T.find(x => x.id === it.target) || {}; return el('li', {}, `${m} → ${tg.icon || ''} ${tg.label || ''}. ${it.why || ''}`); }))) : null,
        st.after ? el('p', { class: 'concept' }, st.after) : null,
        el('button', { type: 'button', class: 'btn ghost small', 'data-brosok': 'again', onclick: () => { v = { i: 0, correct: 0, score: 0, streak: 0, best: 0, mistakes: [], by: {} }; phase = 'aim'; t0 = performance.now(); ctx.save(v); host.replaceChildren(...body()); paintBtns(); } }, '↻ Ещё раз')));
    }
    const cv = liveCanvas(W, H, (g, tt) => {
      g.fillStyle = '#10172d'; g.fillRect(0, 0, W, H);
      const now = performance.now();
      // таймер идёт, только пока квиз на экране и вкладка открыта: ушёл листать выше — фитиль ждёт
      const r = cv.getBoundingClientRect(), seen = !document.hidden && r.bottom > 0 && r.top < innerHeight;
      if (!seen || phase !== 'aim' || now - (lastNow || now) > 250) t0 += now - (lastNow || now); // за экраном и в паузе кадров фитиль стоит
      lastNow = now;
      if (phase === 'aim' && (now - t0) / 1000 > secs) land(-1);
      const p = pad(); if (phase === 'aim') { if (p.left) { sel = (sel + N - 1) % N; paintBtns(); } if (p.right) { sel = (sel + 1) % N; paintBtns(); } if (p.a) throwTo(sel); } else if (phase === 'show' && (p.a || p.right)) advance();
      // персонажи
      T.forEach((x, k) => {
        const q = pos(k), on = phase === 'aim' && k === sel, hit = result && result.ok && result.k === k, sad = result && !result.ok && result.k === k, show = result && !result.ok && result.right === k;
        const jump = hit ? Math.abs(Math.sin((now - hitAt) / 1000 * 9)) * 18 * Math.max(0, 1 - (now - hitAt) / 1200) : 0;
        glow(g, q.x, q.y - 10, on || show ? 54 : 0, x.color, 0.45);
        disc(g, q.x, q.y + 30, 26, 'rgba(0,0,0,.25)');
        hero(g, q.x, q.y - jump, 26, x.color, sad ? -1 : 1, sad ? 0.3 : 0);
        emo(g, x.icon, q.x, q.y - 44 - jump, 26);
        text(g, x.label, q.x, q.y + 44 - (N > 3 ? 0 : 0), on ? '#ffffff' : '#c8c8e0', 13);
        if (hit) confetti(g, q.x, q.y - 30, clamp((now - hitAt) / 900, 0, 1), 18, k + 3);
        if (show) text(g, '← сюда', q.x, q.y - 76, '#ffd23f', 13);
        if (on) text(g, String(k + 1), q.x + 30, q.y - 30, '#ffd23f', 14);
      });
      // карточка: в центре или в полёте
      const it = cur(); if (!it || phase === 'end') return;
      let cx = 320, cy = 86, s = 1, rot = 0;
      if (phase === 'fly' || (phase === 'show')) {
        const q = pos(fly ? fly.k : 0), k = clamp((now - (fly ? fly.t : now)) / (fast() ? 200 : 450), 0, 1);
        if (result && !result.ok) { const back = clamp((now - hitAt) / 400, 0, 1); cx = lerp(q.x, 320, io(back)); cy = lerp(q.y - 40, 86, io(back)); s = lerp(0.4, 1, back); rot = Math.sin(back * 12) * 0.1 * (1 - back); }
        else if (fly && fly.k >= 0) { cx = lerp(320, q.x, io(k)); cy = lerp(86, q.y - 40, k) - Math.sin(k * Math.PI) * 60; s = lerp(1, 0.35, k); rot = k * 0.6; if (result) s = Math.max(0, 0.35 - (now - hitAt) / 800); }
      }
      if (s <= 0.01) return;
      g.save(); g.translate(cx, cy); g.rotate(rot); g.scale(s, s);
      rr(g, -170, -50, 340, 100, 14, result && !result.ok ? '#ffe3e3' : '#fffbe8', '#ffd23f');
      wrap(g, it.text, 0, 0, 310, 20, '#1b1430', 16, 'center', 800);
      g.restore();
      // фитиль-таймер, очки, серия
      if (phase === 'aim') { const left = clamp(1 - (now - t0) / 1000 / secs, 0, 1); rr(g, 150, 146, 340, 6, 3, '#2a3560'); rr(g, 150, 146, 340 * left, 6, 3, left < 0.3 ? '#ff5d6e' : '#ffd23f'); disc(g, 150 + 340 * left, 149, 4 + Math.sin(tt * 30) * 1.5, '#fff3b0'); }
      text(g, `${Math.min(v.i + 1, order.length)} / ${order.length}`, 40, 22, '#9aa3c7', 12);
      text(g, `очки ${v.score}` + (v.streak > 1 ? ` · серия ×${Math.min(4, v.streak)}` : ''), W - 90, 22, v.streak > 1 ? '#ffd23f' : '#9aa3c7', 13);
    }, 'm6-brosokcv');
    cv.setAttribute('aria-label', 'Квиз: брось карточку персонажу');
    cv.addEventListener('keydown', e => {
      const d = /^(Digit|Numpad)(\d)$/.exec(e.code);
      if (d && Number(d[2]) >= 1 && Number(d[2]) <= N) { e.preventDefault(); throwTo(Number(d[2]) - 1); return; }
      if (e.code === 'ArrowLeft' && phase === 'aim') { e.preventDefault(); sel = (sel + N - 1) % N; paintBtns(); }
      if (e.code === 'ArrowRight' && phase === 'aim') { e.preventDefault(); sel = (sel + 1) % N; paintBtns(); }
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (phase === 'aim') throwTo(sel); else if (phase === 'show') advance(); }
    });
    cv.addEventListener('click', ev => { // щелчок по персонажу — бросок ему
      const r = cv.getBoundingClientRect(), x = (ev.clientX - r.left) * W / r.width, y = (ev.clientY - r.top) * H / r.height;
      if (phase === 'show') { advance(); return; }
      const k = T.findIndex((_, i) => Math.hypot(pos(i).x - x, pos(i).y - y) < 50); if (k >= 0) throwTo(k);
    });
    const body = () => [el('div', { class: 'm4-stage' }, cv), btns, el('div', { class: 'row' }, why, el('span', { class: 'grow' }), next),
      el('p', { class: 'small muted' }, `Клавиши 1–${N} или ← → и пробел, щелчок по персонажу, геймпад: крестовина и A.`)];
    if (ctx.done && v.total) { phase = 'end'; finish(); } else { host.append(...body()); paintBtns(); }
    host.setAttribute('data-brosok-item', ''); // для проверки: какой пункт сейчас в полёте
    const tick = setInterval(() => { if (!host.isConnected) { clearInterval(tick); return; } host.setAttribute('data-brosok-item', phase === 'end' ? 'end' : String(order[v.i])); host.setAttribute('data-phase', phase); }, 100);
    return host;
  };

  /* ---------------- portrait: портрет игрока ---------------- */
  STEPS.portrait = ctx => {
    const st = ctx.step;
    let v = Object.assign({ fields: {}, type: null }, ctx.value || {});
    const host = el('div', { class: 'm6-portrait' });
    let popT = performance.now(), popKey = '';
    const filled = () => st.fields.filter(f => valText(v.fields[f.id]).trim()).length;
    const save = done => ctx.save(v, done == null ? null : done);
    const typeOf = () => (st.types || []).find(x => x.id === v.type);
    const cv = liveCanvas(320, 380, (g, t) => {
      const ty = typeOf(), col = ty ? ty.color : '#5a6380';
      const k = ob(clamp((performance.now() - popT) / 500, 0, 1));
      rr(g, 10, 10, 300, 360, 22, '#fffbe8');
      rr(g, 24, 24, 272, 130, 16, col);
      for (let i = 0; i < 12; i++) disc(g, 40 + (i * 53) % 260, 30 + (i * 37) % 120, 3, 'rgba(255,255,255,.25)');
      hero(g, 160, 92 + Math.sin(t * 2) * 3, 38, '#ff7ad9', 1);
      const name = valText(v.fields[(st.fields[0] || {}).id]) || 'Кто он?';
      text(g, name.length > 26 ? name.slice(0, 25) + '…' : name, 160, 178, '#1b1430', 16);
      st.fields.slice(1).forEach((f, i) => {
        const val = valText(v.fields[f.id]); const yes = !!val.trim(), kk = popKey === f.id ? k : 1;
        g.save(); g.globalAlpha = yes ? kk : 0.35; g.translate(0, (1 - kk) * 12);
        emo(g, f.icon || '•', 40, 214 + i * 40, 18);
        wrap(g, yes ? val : f.label, 172, 214 + i * 40, 236, 15, yes ? '#2a2040' : '#8a8090', 12, 'center', 700);
        g.restore();
      });
      if (ty) { const kk = popKey === 'type' ? k : 1; g.save(); g.translate(262, 146); g.scale(kk, kk); g.rotate(-0.18); disc(g, 0, 0, 34, ty.color); disc(g, 0, 0, 29, '#ffffff'); emo(g, ty.icon, 0, -6, 24); text(g, ty.label.toLowerCase(), 0, 18, '#1b1430', 8); g.restore(); }
    }, 'm6-pcard');
    cv.setAttribute('aria-label', 'Карточка игрока');
    const fields = el('div', { class: 'stack' }, st.fields.map(f => fieldEditor(Object.assign({ cards: true }, f), v.fields[f.id] || '', nv => { v.fields[f.id] = nv; popKey = f.id; popT = performance.now(); save(); paintBtn(); }, { rows: 1, idPrefix: st.id })));
    const types = el('div', { class: 'm6-types', role: 'radiogroup', 'aria-label': 'Тип игрока' }, (st.types || []).map(x => el('button', { type: 'button', role: 'radio', class: 'opt' + (v.type === x.id ? ' on' : ''), 'aria-checked': String(v.type === x.id), 'data-ptype': x.id,
      onclick: e => { v.type = x.id; popKey = 'type'; popT = performance.now(); beep('good'); save(); types.querySelectorAll('.opt').forEach(b => { const on = b.dataset.ptype === x.id; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }); paintBtn(); void e; } }, x.icon + ' ' + x.label, el('small', {}, x.say || ''))));
    const btn = el('button', { type: 'button', class: 'btn', 'data-portrait': 'save', onclick: () => { if (!v.type || filled() < 2) { toast('Нужны тип игрока и хотя бы два поля'); return; } save(true); beep('done'); toast('Портрет игрока в журнале: он пригодится для итоговой игры', 'ok'); paintBtn(); } });
    function paintBtn() { btn.textContent = ctx.done ? '✓ Портрет сохранён — можно поправить' : `Сохранить портрет (${filled()} из ${st.fields.length} полей${v.type ? ', тип выбран' : ''})`; }
    paintBtn();
    host.append(el('div', { class: 'stack' }, fields, el('div', { class: 'lbl' }, st.typesLabel || 'Какой он игрок?'), types, btn), el('div', { class: 'm4-stage m6-pstage' }, cv));
    return host;
  };

  /* ---------------- setka: загадка дня класса и сетки-результаты ---------------- */
  // сетка — строки из квадратиков 🟩🟨🟧🟦⬛ или «3● 1○»: рисуем плитками, которые переворачиваются по очереди
  function gridView(s, delay = 0) {
    const lines = String(s || '').split('\n').filter(Boolean), head = lines[0] && !/^[🟩🟨🟧🟦⬛⬜\s]+$/u.test(lines[0]) ? lines.shift() : '';
    let n = 0;
    return el('div', { class: 'm6-grid' }, head ? el('div', { class: 'small' }, head) : null, lines.slice(0, 10).map(l => el('div', { class: 'row6' },
      [...l.matchAll(/🟩|🟨|🟧|🟦|⬛|⬜|\d+[●○]/gu)].map(m => { const c = m[0]; const cls = c === '🟩' || c === '🟧' ? 'g' : c === '🟨' || c === '🟦' ? 'y' : /\d/.test(c) ? 'num' : 'n'; return el('span', { class: 'sq ' + cls + (c === '🟧' || c === '🟦' ? ' hc' : ''), style: `--d:${(delay + n++ * 0.07).toFixed(2)}s` }, /\d/.test(c) ? c : ''); }))));
  }
  STEPS.setka = ctx => {
    const st = ctx.step;
    let v = Object.assign({}, ctx.value || {});
    const host = el('div', { class: 'stack' }), gal = el('div', { class: 'stack' }), mine = el('div', { class: 'stack' });
    let frame = null, data = null;
    async function load() {
      try { data = await api('/api/m6/tally?step=' + encodeURIComponent(st.id)); } catch (e) { host.replaceChildren(el('p', { class: 'err' }, e.message)); return; }
      if (frame) paintLists(); else draw(); // рамку не пересоздаём: на экране конца партии у ученика его сетка
    }
    function save(grid, extra) {
      v = Object.assign(v, { grid: String(grid).slice(0, 400), day: data.day, game: data.author ? data.author.game : null, author: data.author ? data.author.nick : null }, extra || {});
      ctx.save(v, true, true); beep('done'); if (pasteBox) pasteBox.hidden = true; setTimeout(load, 300);
    }
    let pasteBox = null;
    function paintLists() {
      mine.replaceChildren(...(v.grid ? [el('div', { class: 'row' }, el('div', { class: 'stack' }, el('b', {}, 'Моя сетка'), gridView(v.grid)), el('button', { type: 'button', class: 'btn ghost small', onclick: () => Lab.copy(v.grid) }, '⧉ Скопировать сетку'))] : []));
      gal.replaceChildren(...(data.hidden ? [el('p', { class: 'small muted' }, 'Сетки класса откроются, когда выложишь свою: так никто не подсмотрит ответ.')]
        : [el('div', { class: 'eyebrow' }, `Сетки класса · ${data.grids.length}`), el('div', { class: 'm6-gallery' }, data.grids.map((x, i) => el('div', { class: 'm6-gcard' + (x.nick === S.me.nick ? ' me' : '') }, el('b', {}, x.nick), gridView(x.grid, i * 0.15))))]));
    }
    function draw() {
      if (frame) { frame.destroy(); frame = null; }
      const a = data.author, day = data.day;
      const src = a ? `/play/${a.game}/${a.version}?seed=${day}` : `/engine/game.html?game=../${st.fallback}&seed=${day}`;
      frame = Games.frame({ src: () => src, key: () => (a ? 'game:' + a.game : 'setka:' + day), info: () => (a ? { version: a.version } : {}), data: { day: String(day) }, score: !!a, label: 'Загадка дня',
        onOver: m => { const t = m.tele || {}; const grid = t.share || (t.stats || {})['сетка'] || (t.stats || {}).share; if (grid && !ctx.done) save(grid, { solved: m.kind === 'win' || /\/\d/.test(String(grid).split('\n')[0]) && !/X\//.test(grid) }); else if (!grid && !ctx.done) paste.hidden = false; } });
      const paste = el('div', { class: 'stack', hidden: !!ctx.done },
        el('p', { class: 'small muted' }, 'Игра не прислала сетку? Скопируй её с экрана конца партии или собери сам: строка — попытка, 🟩 на месте, 🟨 есть, но не тут, ⬛ нет.'),
        el('textarea', { rows: 4, class: 'm6-gridin', placeholder: '🟨⬛⬛🟩⬛\n🟩🟩⬛🟩🟨\n🟩🟩🟩🟩🟩' }),
        el('button', { type: 'button', class: 'btn ghost small', 'data-setka': 'paste', onclick: e => { const ta = e.currentTarget.parentElement.querySelector('textarea'); if (!/[🟩🟨🟧🟦⬛●]/u.test(ta.value)) { toast('В сетке нужны квадратики 🟩🟨⬛'); return; } save(ta.value.trim(), { manual: true }); } }, 'Выложить сетку'));
      paste.hidden = true;
      host.replaceChildren(
        el('div', { class: 'm6-dayhead' }, el('span', { class: 'm6-cal' }, el('b', {}, String(Number(String(day).slice(6, 8)))), el('small', {}, ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'][Number(String(day).slice(4, 6)) - 1] || '')),
          el('div', { class: 'stack', style: 'gap:2px' }, el('b', {}, a ? `Загадка дня — «${a.title}» от ${a.nick}` : `Загадка дня — донор урока «${st.fallbackTitle || 'Узор дня'}»`),
            el('span', { class: 'small muted' }, a ? 'Одно зерно — дата — у всего класса: загадка у всех одна.' : 'В классе пока нет игр урока: загадку дня даёт донор.'),
            data.week && data.week.length ? el('span', { class: 'small' }, '📅 Неделя загадок: ' + data.week.map(w => `${w.label} — ${w.nick}`).join(' · ')) : null)),
        frame.box, Games.bar(frame), paste, mine, gal);
      pasteBox = paste; paintLists();
    }
    S.hooks.push(kind => { if (kind === 'arcade' && data && !data.hidden && host.isConnected) load(); });
    host.append(el('p', { class: 'muted' }, 'Загружаем загадку дня…'));
    load();
    return host;
  };

  /* ---------------- minuta: «Первая минута» — где новичок потерялся ---------------- */
  STEPS.minuta = ctx => {
    const st = ctx.step, clips = st.clips, win = st.window || 2.5, W = 640, H = 300;
    let v = Object.assign({ clips: {} }, ctx.value || {});
    // запись идёт, только когда её запустили и она на экране: время записи копится кадрами
    let ci = 0, played = 0, lastNow = 0, marks = [], state = 'ready';
    const host = el('div', { class: 'stack m6-minuta' }), info = el('div', { class: 'stack' }), tl = el('div', { class: 'm6-timeline' });
    const clipT = () => (state === 'shown' ? clips[ci].seconds : played);
    const playB = el('button', { type: 'button', class: 'btn', 'data-minuta': 'play', onclick: () => { if (state === 'ready') { state = 'play'; played = 0; playB.hidden = true; markBtn.disabled = false; beep('tick'); cv.focus(); } } }, '▶ Смотреть запись');
    const markBtn = el('button', { type: 'button', class: 'btn warm', 'data-minuta': 'mark', onclick: () => mark() }, '😵 Здесь потерялся! (пробел)');
    const skip = el('button', { type: 'button', class: 'btn ghost small', 'data-minuta': 'skip', onclick: () => reveal() }, '⏭ К разбору');
    const nextB = el('button', { type: 'button', class: 'btn', 'data-minuta': 'next', hidden: true, onclick: () => nextClip() });
    const again = el('button', { type: 'button', class: 'btn ghost small', 'data-minuta': 'again', hidden: true, onclick: () => start(ci) }, '↻ Смотреть ещё раз');
    function mark() { if (state !== 'play') return; const t = clipT(); if (marks.some(m => Math.abs(m - t) < 0.6)) return; marks.push(t); beep('tick'); paintTl(); }
    function paintTl() {
      const c = clips[ci], dur = c.seconds;
      const kids = [el('i', { class: 'head', style: `left:${clamp(clipT() / dur, 0, 1) * 100}%` })];
      if (state === 'shown') c.lost.forEach(l => kids.push(el('span', { class: 'lost', style: `left:${(l.at - win) / dur * 100}%;width:${2 * win / dur * 100}%`, title: l.why }, '?')));
      marks.forEach(m => { const hit = state === 'shown' && c.lost.some(l => Math.abs(l.at - m) <= win); kids.push(el('b', { class: 'pin' + (state === 'shown' ? (hit ? ' hit' : ' miss') : ''), style: `left:${m / dur * 100}%` }, '📍')); });
      tl.replaceChildren(...kids);
    }
    function reveal() {
      if (state === 'shown') return;
      state = 'shown';
      const c = clips[ci], found = c.lost.filter(l => marks.some(m => Math.abs(l.at - m) <= win)), extra = marks.filter(m => !c.lost.some(l => Math.abs(l.at - m) <= win)).length;
      v.clips[c.anim] = { marks: marks.map(m => Math.round(m * 10) / 10), found: found.length, of: c.lost.length, extra };
      const doneAll = clips.every(x => v.clips[x.anim]);
      v.total = clips.reduce((n, x) => n + x.lost.length, 0); v.found = clips.reduce((n, x) => n + ((v.clips[x.anim] || {}).found || 0), 0);
      ctx.save(v, doneAll ? true : null, true);
      beep(found.length === c.lost.length ? 'done' : 'good');
      info.replaceChildren(el('h3', {}, `Нашёл ${found.length} из ${c.lost.length}` + (extra ? ` · лишних отметок: ${extra}` : '')),
        el('ol', { class: 'm6-lostlist' }, c.lost.map(l => el('li', { class: found.includes(l) ? 'ok-text' : '' }, `${found.includes(l) ? '✓' : '✗'} ${Math.round(l.at)}-я секунда: ${l.why}`))),
        c.sum ? el('p', { class: 'concept' }, c.sum) : null);
      nextB.hidden = false; nextB.textContent = ci + 1 < clips.length ? 'Следующая запись →' : doneAll ? '✓ Все записи разобраны' : 'Итог';
      again.hidden = false; markBtn.disabled = true; skip.hidden = true; playB.hidden = true; paintTl();
    }
    function nextClip() { if (ci + 1 < clips.length) start(ci + 1); else { const left = clips.findIndex(x => !v.clips[x.anim]); if (left >= 0) start(left); } }
    function start(i) { ci = i; played = 0; marks = []; state = 'ready'; playB.hidden = false; info.replaceChildren(el('p', { class: 'small muted' }, clips[i].hint || 'Смотри, что делает новичок. Нажимай пробел каждый раз, когда видишь: он не понимает, что делать.')); nextB.hidden = true; again.hidden = true; markBtn.disabled = true; skip.hidden = false; paintTl(); title.textContent = `Запись ${i + 1} из ${clips.length}: ${clips[i].title}`; }
    const title = el('h3');
    const cv = liveCanvas(W, H, (g, t) => {
      const now = performance.now(), r = cv.getBoundingClientRect(), seen = !document.hidden && r.bottom > 0 && r.top < innerHeight;
      if (state === 'play' && seen && lastNow && now - lastNow < 250) played += (now - lastNow) / 1000 * (fast() ? 4 : 1);
      lastNow = now;
      const c = clips[ci], tt = Math.min(clipT(), c.seconds), f = window.LabMotion.MOTION[c.anim];
      if (f) f(g, tt, W, H, {}); else { g.fillStyle = '#141c36'; g.fillRect(0, 0, W, H); }
      if (state === 'play' && clipT() >= c.seconds) reveal();
      if (state === 'shown') { g.fillStyle = 'rgba(11,16,32,.35)'; g.fillRect(0, 0, W, H); c.lost.forEach((l, k) => { const x = 60 + k * ((W - 120) / Math.max(1, c.lost.length - 1 || 1)); emo(g, '❓', c.lost.length === 1 ? W / 2 : x, 140 + Math.sin(t * 3 + k) * 6, 38); }); }
      else if (state === 'ready') { g.fillStyle = 'rgba(11,16,32,.55)'; g.fillRect(0, 0, W, H); text(g, '▶ Смотреть запись', W / 2, H / 2, '#ffffff', 22); }
      else { disc(g, W - 22, 20, 7, Math.sin(t * 6) > 0 ? '#ff3b5c' : '#7a1a2a'); text(g, 'запись', W - 56, 20, '#ffffff', 11); }
      paintTlHead();
    }, 'm6-minutacv');
    let lastHead = 0;
    function paintTlHead() { const now = performance.now(); if (now - lastHead < 120) return; lastHead = now; const h = tl.querySelector('.head'); if (h) h.style.left = clamp(clipT() / clips[ci].seconds, 0, 1) * 100 + '%'; }
    const act = () => (state === 'ready' ? playB.click() : mark());
    cv.addEventListener('keydown', e => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); act(); } });
    const padR = padReader(); const padT = setInterval(() => { if (!host.isConnected) { clearInterval(padT); return; } const p = padR(); if (p.a) act(); }, 50);
    cv.addEventListener('click', () => act());
    host.append(title, el('div', { class: 'm4-stage' }, cv), tl, el('div', { class: 'row' }, playB, markBtn, skip, el('span', { class: 'grow' }), again, nextB), info);
    start(0); paintTl();
    if (ctx.done) info.append(el('p', { class: 'ok-text small' }, `✓ Разобрано: нашёл ${v.found || 0} из ${v.total || 0} моментов. Можно посмотреть ещё раз.`));
    return host;
  };

  /* ---------------- sekundomer: «Новичок с улицы» ---------------- */
  STEPS.sekundomer = ctx => {
    const st = ctx.step, runs = st.runs || [{ id: 'before', label: 'До правки' }, { id: 'after', label: 'После правки' }];
    let v = Object.assign({ runs: {} }, ctx.value || {});
    let cur = runs.find(r => v.runs[r.id] == null) || runs[runs.length - 1], t0 = 0, going = false;
    const host = el('div', { class: 'stack m6-sek' }), res = el('div', { class: 'stack' });
    const cv = liveCanvas(300, 300, (g, t) => {
      const sec = going ? (performance.now() - t0) / 1000 : v.runs[cur.id] || 0;
      disc(g, 150, 160, 120, '#fffbe8'); disc(g, 150, 160, 110, going ? '#e8f7ff' : '#f2efe6');
      rr(g, 135, 18, 30, 26, 6, '#5a6380'); rr(g, 120, 10, 60, 14, 6, going ? '#ff5d6e' : '#5a6380');
      for (let i = 0; i < 60; i++) { const a = i * TAU / 60 - Math.PI / 2, r1 = i % 5 ? 100 : 92; g.strokeStyle = '#1b1430'; g.lineWidth = i % 5 ? 1 : 3; g.beginPath(); g.moveTo(150 + Math.cos(a) * r1, 160 + Math.sin(a) * r1); g.lineTo(150 + Math.cos(a) * 104, 160 + Math.sin(a) * 104); g.stroke(); }
      const a = (sec % 60) / 60 * TAU - Math.PI / 2;
      g.fillStyle = 'rgba(95,224,255,.35)'; g.beginPath(); g.moveTo(150, 160); g.arc(150, 160, 96, -Math.PI / 2, a); g.closePath(); g.fill();
      g.strokeStyle = '#ff3b5c'; g.lineWidth = 4; g.beginPath(); g.moveTo(150, 160); g.lineTo(150 + Math.cos(a) * 92, 160 + Math.sin(a) * 92); g.stroke(); disc(g, 150, 160, 7, '#ff3b5c');
      text(g, sec.toFixed(1).replace('.', ',') + ' с', 150, 214, '#1b1430', 24);
      text(g, cur.label, 150, 110, '#5a6380', 13);
    }, 'm6-sekcv');
    const startB = el('button', { type: 'button', class: 'btn', 'data-sek': 'start', onclick: () => { going = true; t0 = performance.now(); beep('tick'); paint(); } }, '▶ Новичок начал играть');
    const stopB = el('button', { type: 'button', class: 'btn warm', 'data-sek': 'stop', onclick: () => stop() }, '🎯 Понял цель! (пробел)');
    function stop() { if (!going) return; going = false; v.runs[cur.id] = Math.round((performance.now() - t0) / 100) / 10; const nx = runs.find(r => v.runs[r.id] == null); const all = !nx; ctx.save(v, all ? true : null, true); beep(all ? 'done' : 'good'); if (nx) cur = nx; paint(); }
    cv.addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); going ? stop() : startB.click(); } });
    const tabs = el('div', { class: 'seg' });
    function paint() {
      startB.hidden = going; stopB.hidden = !going;
      tabs.replaceChildren(...runs.map(r => el('button', { type: 'button', class: 'opt' + (r === cur ? ' on' : ''), 'data-run': r.id, onclick: () => { if (going) return; cur = r; paint(); } }, `${r.label}: ${v.runs[r.id] != null ? String(v.runs[r.id]).replace('.', ',') + ' с' : '—'}`)));
      const done = runs.every(r => v.runs[r.id] != null);
      res.replaceChildren();
      if (done) {
        const a = v.runs[runs[0].id], b = v.runs[runs[1].id], max = Math.max(a, b, 1);
        res.append(el('div', { class: 'm6-race' }, runs.map((r, i) => el('div', { class: 'lane' }, el('span', {}, r.label), el('span', { class: 'track' }, el('i', { class: i ? 'after' : 'before', style: `--w:${Math.round(v.runs[r.id] / max * 100)}%;--dur:${(0.6 + v.runs[r.id] / max * 1.4).toFixed(2)}s` }, '🏃')), el('b', {}, String(v.runs[r.id]).replace('.', ',') + ' с')))),
          el('p', { class: 'concept' }, b < a ? `После правки новичок понял цель на ${String(Math.round((a - b) * 10) / 10).replace('.', ',')} с быстрее. Это и есть хороший онбординг: меньше секунд до «а, понял!».` : b > a ? 'После правки понимать стало дольше. Посмотри, что новичок делал эти секунды, — подсказка там.' : 'Время одинаковое: правка не задела первую минуту.'),
          st.question ? el('div', { class: 'stack' }, el('div', { class: 'lbl' }, st.question), el('div', { class: 'cardopts' }, (st.deck || []).map(d => el('button', { type: 'button', class: 'cardopt' + (v.helped === d ? ' on' : ''), onclick: () => { v.helped = d; ctx.save(v, true, true); paint(); } }, d)))) : null);
      }
      const manual = el('details', { class: 'small' }, el('summary', {}, 'Засекли на телефоне? Впиши секунды'), el('div', { class: 'row' }, el('input', { type: 'number', min: 0, max: 600, step: 0.1, class: 'inp', style: 'width:110px', 'data-sek': 'manual' }),
        el('button', { type: 'button', class: 'btn ghost small', onclick: e => { const x = Number(e.currentTarget.previousSibling.value); if (!(x > 0)) return; v.runs[cur.id] = x; const nx = runs.find(r => v.runs[r.id] == null); ctx.save(v, !nx ? true : null, true); if (nx) cur = nx; paint(); } }, 'Записать')));
      ctrl.replaceChildren(tabs, el('div', { class: 'row' }, startB, stopB), manual);
    }
    const ctrl = el('div', { class: 'stack' });
    host.append(el('div', { class: 'm6-sekrow' }, el('div', { class: 'm4-stage m6-sekstage' }, cv), ctrl), res);
    paint();
    return host;
  };

  /* ---------------- audit: UX-аудит игры соседа и аудиты моей игры ---------------- */
  STEPS.audit = ctx => {
    const st = ctx.step, items = st.items, think = st.think || ['🤔 Не понял', '💡 Понял!', '😤 Не получается', '😮 Вау'];
    let v = Object.assign({ marks: {}, think: [], top: null, note: '' }, ctx.value || {});
    const host = el('div', { class: 'stack' }), top = el('div', { class: 'stack' }), mineBox = el('div', { class: 'stack' });
    let frame = null, t0 = 0, target = null;
    async function pickTarget() {
      const aboutV = st.about ? (ans(st.about).value || {}) : {};
      let card = null;
      try { const r = await api('/api/arcade'); card = aboutV.game ? r.games.find(c => c.id === aboutV.game) : null; } catch (e) { /* без аркады — донор */ }
      target = card ? { game: card.id, version: card.version, title: card.title, nick: card.nick } : { remake: st.fallback, title: st.fallbackTitle || 'донор урока' };
      draw();
    }
    const score = () => items.filter(x => v.marks[x.id] === true).length;
    function draw() {
      if (frame) frame.destroy();
      frame = Games.frame({ src: () => (target.game ? `/play/${target.game}/${target.version}` : `/engine/game.html?game=../${target.remake}`), key: () => (target.game ? 'game:' + target.game : 'audit:' + st.id), info: () => (target.game ? { version: target.version } : {}), score: !!target.game, label: 'Играть и думать вслух', onReady: () => { t0 = performance.now(); } });
      const stamps = el('div', { class: 'm6-stamps' });
      const paintStamps = () => stamps.replaceChildren(...v.think.map(s => el('span', { class: 'm6-stamp' }, `${Math.floor(s.t / 60)}:${String(Math.round(s.t % 60)).padStart(2, '0')} ${s.e}`)));
      paintStamps();
      const thinkRow = el('div', { class: 'row' }, el('span', { class: 'eyebrow' }, 'Думай вслух:'), think.map(e => el('button', { type: 'button', class: 'chip', 'data-think': e, onclick: () => { v.think = v.think.concat({ e, t: t0 ? Math.round((performance.now() - t0) / 100) / 10 : 0 }).slice(-40); ctx.save(v); beep('tick'); paintStamps(); } }, e)));
      const ringHost = el('div');
      const paintRing = () => ringHost.replaceChildren(ring(score(), items.length, 'UX-оценка: «да» из 10'));
      const list = el('div', { class: 'm6-audit' }, items.map(x => {
        const b = el('button', { type: 'button', class: 'm6-aitem', 'data-audit': x.id, onclick: () => { const cur = v.marks[x.id]; v.marks[x.id] = cur === true ? false : cur === false ? undefined : true; if (v.marks[x.id] === undefined) delete v.marks[x.id]; ctx.save(v); beep(v.marks[x.id] ? 'good' : 'tick'); paintItem(); paintRing(); paintTop(); } });
        const paintItem = () => { const m = v.marks[x.id]; b.className = 'm6-aitem' + (m === true ? ' yes' : m === false ? ' no' : ''); b.replaceChildren(el('span', { class: 'ico' }, x.icon || '•'), el('span', { class: 'stack', style: 'gap:2px' }, el('b', {}, x.label), x.hint ? el('small', {}, x.hint) : null), el('span', { class: 'mk' }, m === true ? '✓' : m === false ? '✗' : '?')); };
        paintItem(); return b;
      }));
      function paintTop() {
        const bad = items.filter(x => v.marks[x.id] === false);
        const send = el('button', { type: 'button', class: 'btn', 'data-audit': 'send', onclick: async () => {
          if (Object.keys(v.marks).length < items.length) { toast(`Отметь все ${items.length} пунктов: ✓ — да, ✗ — нет`); return; }
          if (!v.top && bad.length) { toast('Выбери главную находку — что починить первым'); return; }
          try { if (target.game) await api('/api/m6/audit', { game: target.game, marks: v.marks, think: v.think, top: v.top, note: v.note }); v.sent = true; v.title = target.title; v.score = score(); ctx.save(v, true, true); beep('done'); toast(target.game ? 'Аудит у автора' : 'Аудит донора сохранён', 'ok'); paintTop(); } catch (e) { toast(e.message, 'err'); }
        } }, v.sent ? '✓ Аудит отправлен — можно обновить' : 'Отправить аудит автору');
        top.replaceChildren(bad.length ? el('div', { class: 'lbl' }, 'Главная находка — что починить первым?') : null,
          bad.length ? el('div', { class: 'cardopts' }, bad.map(x => el('button', { type: 'button', class: 'cardopt' + (v.top === x.id ? ' on' : ''), 'data-top': x.id, onclick: () => { v.top = x.id; ctx.save(v); paintTop(); } }, x.icon + ' ' + x.label))) : null,
          el('input', { type: 'text', class: 'inp', maxlength: 200, placeholder: 'Одна фраза автору (по желанию)', value: v.note || '', oninput: e => { v.note = e.target.value; ctx.save(v); } }), send);
      }
      paintRing(); paintTop();
      host.replaceChildren(el('p', { class: 'small' }, target.game ? `Игра соседа: «${target.title}» (${target.nick}).` : `Соседа пока нет — тренируйся на доноре: «${target.title}».`),
        frame.box, Games.bar(frame), thinkRow, stamps, el('div', { class: 'm6-auditrow' }, list, ringHost), top, mineBox);
      loadMine();
    }
    async function loadMine() {
      let r; try { r = await api('/api/m6/audit/mine'); } catch (e) { return; }
      if (!r.n) { mineBox.replaceChildren(el('p', { class: 'small muted' }, 'Аудитов твоей игры пока нет — они появятся здесь сами.')); return; }
      mineBox.replaceChildren(el('div', { class: 'eyebrow' }, `Твоя игра глазами соседей · аудитов: ${r.n}`),
        bars(items.map(x => { const k = r.items[x.id] || { yes: 0, n: 0 }; return { label: (x.icon || '') + ' ' + x.label, k: k.n ? k.yes / k.n : 0, show: `${k.yes} из ${k.n}`, col: k.n && k.yes / k.n < 0.5 ? 'var(--danger)' : null }; })),
        r.top.length ? el('p', { class: 'concept' }, 'Чинить первым: ' + r.top.map(x => `${(items.find(i => i.id === x.id) || {}).label || x.id} (${x.n})`).join(', ')) : null,
        r.think.length ? el('div', { class: 'm6-stamps' }, r.think.map(s => el('span', { class: 'm6-stamp' }, `${s.nick}: ${Math.floor(s.t / 60)}:${String(Math.round(s.t % 60)).padStart(2, '0')} ${s.e}`))) : null,
        r.notes.length ? el('ul', { class: 'small' }, r.notes.map(n => el('li', {}, `${n.nick}: ${n.note}`))) : null);
    }
    S.hooks.push(kind => { if (kind === 'arcade' && host.isConnected) loadMine(); if (kind === 'picked' && host.isConnected) pickTarget(); });
    host.append(el('p', { class: 'muted' }, 'Загружаем игру соседа…'));
    pickTarget();
    return host;
  };

  /* ---------------- darkhunt: охота за тёмными паттернами ---------------- */
  STEPS.darkhunt = ctx => {
    const st = ctx.step, P = st.patterns;
    let v = Object.assign({ found: [], rounds: 0, best: 0, flip: {} }, ctx.value || {});
    const host = el('div', { class: 'stack' }), cards = el('div', { class: 'm6-dark' }), sum = el('div');
    const frame = Games.frame({ src: () => `/engine/game.html?game=../${st.game}`, key: () => 'remake:' + st.id, cfg: st.cfg || { hunt: 1 }, score: false, label: 'Начать охоту',
      onOver: m => {
        const cust = (m.tele || {}).custom || {}, got = P.filter(p => cust['поймал: ' + p.name] > 0 || cust['поймал:' + p.id] > 0).map(p => p.id);
        const fresh = got.filter(id => !v.found.includes(id));
        v.found = [...new Set(v.found.concat(got))]; v.rounds++; v.best = Math.max(v.best, got.length); v.last = got.length;
        ctx.save(v, v.found.length >= (st.minFound || Math.ceil(P.length / 2)) || v.rounds >= 2 ? true : null, true);
        beep(fresh.length ? 'done' : 'good'); paint(fresh);
      } });
    function paint(fresh = []) {
      cards.replaceChildren(...P.map((p, i) => {
        const got = v.found.includes(p.id), side = v.flip[p.id] || 0; // 0 — лицо паттерна, 1 — честная замена
        return el('button', { type: 'button', class: 'm6-dcard' + (got ? ' got' : '') + (side ? ' honest' : '') + (fresh.includes(p.id) ? ' fresh' : ''), style: `--d:${(fresh.indexOf(p.id) * 0.18).toFixed(2)}s`, 'data-pattern': p.id,
          onclick: () => { if (!got && !ctx.done) { toast('Сначала найди этот паттерн в игре — или закончи охоту'); return; } v.flip[p.id] = side ? 0 : 1; ctx.save(v); beep('tick'); paint(); } },
          el('span', { class: 'in' },
            el('span', { class: 'face front' }, got || ctx.done ? [el('span', { class: 'ico' }, p.icon), el('b', {}, p.name), el('small', {}, p.what), !got ? el('em', { class: 'small' }, 'не найден') : null] : [el('span', { class: 'ico' }, '❓'), el('b', {}, `Паттерн ${i + 1}`), el('small', {}, 'спрятан в игре')]),
            el('span', { class: 'face back' }, el('span', { class: 'ico' }, '🌱'), el('b', {}, 'Честно:'), el('small', {}, p.honest))));
      }));
      sum.replaceChildren(v.rounds ? el('p', { class: 'concept' }, `Найдено ${v.found.length} из ${P.length}` + (v.last != null ? ` (в последней охоте ${v.last})` : '') + '. Нажми на карту — на обороте честная замена.') : el('p', { class: 'small muted' }, `В игре ${P.length} ${plural(P.length, 'тёмный паттерн', 'тёмных паттерна', 'тёмных паттернов')}. Увидел — жми B («Поймал!»). Ложная тревога стоит 5 секунд.`));
    }
    paint();
    host.append(frame.box, Games.bar(frame), sum, cards);
    return host;
  };

  /* ---------------- debate: дебаты класса ---------------- */
  STEPS.debate = ctx => {
    const st = ctx.step, POS = [-2, -1, 0, 1, 2];
    const label = p => [st.left, 'Скорее ' + st.left.toLowerCase(), 'Не знаю', 'Скорее ' + st.right.toLowerCase(), st.right][p + 2];
    let v = Object.assign({ args: { left: [], right: [] } }, ctx.value || {});
    let tally = null;
    const host = el('div', { class: 'stack m6-debate' }), rope = el('div'), argsBox = el('div', { class: 'stack' }), after = el('div', { class: 'stack' });
    async function load() { try { tally = await api('/api/m6/tally?step=' + encodeURIComponent(st.id)); } catch (e) { tally = null; } paintRope(); }
    function posRow(key, title) {
      return el('div', { class: 'stack' }, el('div', { class: 'lbl' }, title), el('div', { class: 'm6-pos', role: 'radiogroup' }, POS.map(p => el('button', { type: 'button', role: 'radio', class: 'opt' + (v[key] === p ? ' on' : ''), 'aria-checked': String(v[key] === p), 'data-pos': key + ':' + p,
        onclick: () => { v[key] = p; ctx.save(v, key === 'after' ? true : null, true); beep('tick'); draw(); load(); } }, ['⛔', '👎', '🤔', '👍', '✅'][p + 2] + ' ' + label(p)))));
    }
    function draw() {
      const args = side => el('div', { class: 'stack m6-args ' + side }, el('b', {}, side === 'left' ? `Самые сильные «${st.left}»` : `Самые сильные «${st.right}»`),
        el('div', { class: 'cardopts' }, st.args[side].map(a => el('button', { type: 'button', class: 'cardopt' + (v.args[side].includes(a) ? ' on' : ''), 'data-arg': side, onclick: () => {
          const has = v.args[side].includes(a); v.args[side] = has ? v.args[side].filter(x => x !== a) : v.args[side].concat(a).slice(-2); ctx.save(v, null, true); beep('tick'); draw(); load(); } }, a))));
      argsBox.replaceChildren(...(v.before == null ? [] : [el('div', { class: 'eyebrow' }, 'Выбери до двух сильных аргументов с каждой стороны — даже с той, с которой не согласен'), el('div', { class: 'm6-argrow' }, args('left'), args('right'))]));
      after.replaceChildren(...(v.before != null && (v.args.left.length || v.args.right.length) ? [posRow('after', 'После дебатов: что ты думаешь теперь?')] : []));
      if (v.after != null) after.append(el('p', { class: 'concept' }, v.after === v.before ? 'Ты остался при своём — и теперь знаешь сильные аргументы другой стороны.' : `Ты сдвинулся: ${label(v.before)} → ${label(v.after)}. Хорошие дебаты меняют мнения.`));
      host.replaceChildren(el('div', { class: 'm6-q' }, st.question), posRow('before', 'До дебатов: твоя позиция'), rope, argsBox, after);
      paintRope();
    }
    function paintRope() {
      if (!tally || tally.hidden) { rope.replaceChildren(el('p', { class: 'small muted' }, 'Канат класса появится, когда выберешь позицию.')); return; }
      const avg = (tally.after.n ? tally.after.avg : tally.before.avg) || 0, k = (avg + 2) / 4;
      rope.replaceChildren(el('div', { class: 'm6-rope', style: `--k:${k.toFixed(3)}` },
        el('span', { class: 'end l' }, '⛔ ' + st.left + ` · ${(tally.after.n ? tally.after : tally.before).left}`), el('span', { class: 'line' }, el('i', { class: 'knot' }, '🎀')), el('span', { class: 'end r' }, st.right + ' ✅' + ` · ${(tally.after.n ? tally.after : tally.before).right}`)),
        el('p', { class: 'small muted' }, `Голосов до: ${tally.before.n}` + (tally.after.n ? ` · после: ${tally.after.n}, средняя позиция ${String(tally.before.avg).replace('.', ',')} → ${String(tally.after.avg).replace('.', ',')}` : '')),
        tally.top.length ? el('div', { class: 'm6-cloud' }, tally.top.map(a => el('span', { class: a.side, style: `--s:${(0.9 + 0.4 * a.n / Math.max(1, tally.top[0].n)).toFixed(2)}` }, `${a.text} · ${a.n}`))) : null);
    }
    draw(); load();
    S.hooks.push(kind => { if (kind === 'answer' && host.isConnected) load(); });
    const poll = setInterval(() => { if (!host.isConnected) { clearInterval(poll); return; } if (v.before != null) load(); }, 8000);
    return host;
  };

  /* ---------------- kodeks: кодекс честного геймдизайнера ---------------- */
  STEPS.kodeks = ctx => {
    const st = ctx.step, size = st.size || 7, pick = st.pick || 3;
    let v = Object.assign({ picks: [], own: '' }, ctx.value || {});
    let tally = null;
    const host = el('div', { class: 'stack' }), scroll = el('div');
    async function load() { try { tally = await api('/api/m6/tally?step=' + encodeURIComponent(st.id)); } catch (e) { tally = null; } paintScroll(); }
    function draw() {
      const deck = el('div', { class: 'cardopts' }, st.deck.map(r => el('button', { type: 'button', class: 'cardopt' + (v.picks.includes(r) ? ' on' : ''), 'data-rule': '', onclick: () => {
        v.picks = v.picks.includes(r) ? v.picks.filter(x => x !== r) : v.picks.concat(r).slice(-pick); ctx.save(v, null, true); beep('tick'); draw(); } }, r)));
      const own = el('input', { type: 'text', class: 'inp', maxlength: 120, placeholder: 'Своё правило (по желанию)', value: v.own || '' });
      const send = el('button', { type: 'button', class: 'btn ghost', 'data-kodeks': 'send', onclick: () => { v.own = own.value.trim(); if (v.picks.length + (v.own ? 1 : 0) < pick) { toast(`Выбери ${pick} правила (своё тоже считается)`); return; } v.sent = true; ctx.save(v, null, true); beep('good'); load(); } }, v.sent ? '✓ Предложено — можно поменять' : `Предложить классу (${v.picks.length + (own.value.trim() ? 1 : 0)} из ${pick})`);
      own.addEventListener('input', () => { send.textContent = `Предложить классу (${v.picks.length + (own.value.trim() ? 1 : 0)} из ${pick})`; });
      host.replaceChildren(el('div', { class: 'lbl' }, `Выбери ${pick} правила, без которых игра нечестная`), deck, el('div', { class: 'row' }, own, send), scroll);
      paintScroll();
    }
    function paintScroll() {
      if (!tally || tally.hidden) { scroll.replaceChildren(el('p', { class: 'small muted' }, 'Свиток класса развернётся, когда предложишь свои правила.')); return; }
      const rules = tally.rules.slice(0, size);
      scroll.replaceChildren(el('div', { class: 'm6-scroll' + (v.signed ? ' signed' : '') },
        el('div', { class: 'rod' }), el('h3', {}, 'Кодекс честного геймдизайнера'), el('div', { class: 'small' }, `класса · предложили ${tally.n}`),
        el('ol', {}, rules.map((r, i) => el('li', { style: `--d:${(0.3 + i * 0.25).toFixed(2)}s` }, r.text, el('small', {}, ` · ${r.n}`)))),
        el('div', { class: 'sigs' }, tally.signed.map(n => el('span', { class: 'sig' + (n === S.me.nick ? ' me' : '') }, n))),
        v.signed ? el('div', { class: 'stamp' }, 'ПОДПИСАНО') : null,
        el('div', { class: 'rod' })),
        v.signed ? el('p', { class: 'ok-text small' }, '✓ Кодекс подписан: он действует для итоговых проектов модуля 8.') : el('button', { type: 'button', class: 'btn', 'data-kodeks': 'sign', disabled: rules.length < 3, onclick: () => { v.signed = true; v.rules = rules.map(r => r.text); ctx.save(v, true, true); beep('done'); load(); } }, rules.length < 3 ? 'Ждём правила класса…' : '✍ Подписать кодекс'));
    }
    draw(); load();
    const poll = setInterval(() => { if (!host.isConnected) { clearInterval(poll); return; } if (v.sent) load(); }, 8000);
    return host;
  };

  /* ---------------- adopt: своя игра прошлых уроков — в этот урок ---------------- */
  STEPS.adopt = ctx => {
    const st = ctx.step, host = el('div', { class: 'stack' });
    async function draw() {
      let r; try { r = await api('/api/arcade'); } catch (e) { host.replaceChildren(el('p', { class: 'err' }, e.message)); return; }
      const mine = r.mine.filter(c => c.lesson && c.lesson.id !== S.lesson.id).sort((a, b) => (b.release ? 1 : 0) - (a.release ? 1 : 0) || (b.lesson.number - a.lesson.number));
      const cur = S.game && S.game.current ? S.game : null;
      const take = async body => {
        try { const x = await api('/api/game/adopt', body); S.game = x.game; ctx.save({ from: body.from || 'remake', title: x.game.title }, true, true); beep('done'); toast(`«${x.game.title}» теперь в этом уроке: версия ${x.version}`, 'ok'); S.hooks.forEach(fn => fn('game')); renderMain(); } catch (e) { toast(e.message, 'err'); }
      };
      host.replaceChildren(
        cur ? el('p', { class: 'concept' }, `В уроке: «${cur.title || 'Моя игра'}», версия ${cur.current}. Правки ниже пойдут в неё.`) : null,
        mine.length ? el('div', { class: 'm6-adopt' }, mine.slice(0, 12).map(c => el('button', { type: 'button', class: 'm6-acard' + (c.release ? ' rel' : ''), 'data-adopt': c.id, onclick: () => take({ from: c.id }) },
          el('b', {}, c.title), el('small', {}, `урок ${c.lesson.number} · v${c.version}`), c.release ? el('span', { class: 'tag ok' }, 'релиз 1.0') : null))) : el('p', { class: 'small muted' }, 'Игр прошлых уроков пока нет.'),
        el('button', { type: 'button', class: 'btn ghost small', 'data-adopt': 'remake', onclick: () => take({ remake: true }) }, `Взять основу — донор «${st.fallbackTitle || 'урока'}»`));
    }
    host.append(el('p', { class: 'muted' }, 'Загружаем твои игры…'));
    draw();
    return host;
  };

  // итог шага одной строкой — для «Скопировать результат»
  window.LabStepsM6Summary = (step, v, a) => {
    switch (step.type) {
      case 'brosok': return v.total ? `попаданий ${v.correct} из ${v.total}, очки ${v.score}, лучшая серия ${v.best}` + ((v.mistakes || []).length ? '; промахи: ' + v.mistakes.join('; ') : '') : `пройдено карточек: ${v.i || 0}`;
      case 'portrait': return `${Object.entries(v.fields || {}).map(([k, x]) => `${k}: ${valText(x)}`).join('; ')}; тип: ${v.type || '—'}`;
      case 'setka': return v.grid ? `сетка${v.manual ? ' (вставлена)' : ''}:\n${v.grid}` : 'не играл';
      case 'minuta': return v.total ? `нашёл ${v.found} из ${v.total} моментов, где новичок потерялся` : 'не разобрано';
      case 'sekundomer': return Object.entries(v.runs || {}).map(([k, x]) => `${k}: ${x} с`).join('; ') + (v.helped ? `; помогло: ${v.helped}` : '');
      case 'audit': return v.sent ? `аудит «${v.title}»: ${v.score} из ${step.items.length}; главное: ${v.top || '—'}; думал вслух: ${(v.think || []).map(s => s.e).join(' ')}` : 'аудит не отправлен';
      case 'darkhunt': return `найдено паттернов ${(v.found || []).length} из ${step.patterns.length} за ${v.rounds || 0} охот`;
      case 'debate': return `до: ${v.before}, после: ${v.after == null ? '—' : v.after}; аргументы: ${[...(v.args || {}).left || [], ...((v.args || {}).right || [])].join('; ')}`;
      case 'kodeks': return `правила: ${(v.picks || []).concat(v.own ? [v.own] : []).join('; ')}${v.signed ? '; кодекс подписан' : ''}`;
      case 'adopt': return v.title ? `в уроке игра «${v.title}»` : 'игра не выбрана';
      default: return a && null;
    }
  };
})();
