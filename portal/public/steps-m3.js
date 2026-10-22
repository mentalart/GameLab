// Шаги модуля 3 «Выбор, вызов, баланс» (уроки 9–13, аудит 21.10.2026, сессия 5). Подключается после student.js, vybor.js и steps-m2.js,
// берёт помощники страницы (S, Games, STEPS) и библиотеку сцен MOTION из steps-m4.js. На проекторе файл тоже грузится — ради сцен
// театра (В5) и вкладки «🎠 Карусель».
// Сцены теории с переключателями (В2, вместо SVG-схем): канал потока и умение игрока, пила и передышка (урок 9); «Свинья»: когда хватит,
// три карточки с ценой и без (урок 10); гонка трёх тележек со снежным комом и резинкой (урок 11); кубик до или после решения, намерение
// врага, запись хода «Колоды нарта» для видео-петли (урок 12); родник, кувшин и сток, цена по силе (урок 13).
// Тип шага (Г5): karusel — обмен игр по кругу: каждые 4 минуты игра уходит следующему, на каждой — короткий отзыв; автор видит,
//   где совпало у всех, а где у одного. Сервер — lib/karusel.js, ведёт учитель на проекторе.
'use strict';
(function () {
  const M = window.LabMotion;
  if (!M) return;
  const { MOTION } = M;
  const { TAU, clamp, seg, ob, lerp, rr, text, disc, glow, arrow, confetti, hero } = M.kit;

  /* ---------------- помощники рисования ---------------- */
  const emo = (g, e, x, y, px = 24) => { g.fillStyle = '#ffffff'; g.font = `${px}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, x, y); };
  const bg = (g, W, H, col = '#0b1020') => { g.fillStyle = col; g.fillRect(0, 0, W, H); };
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
  // подпись сцены: крупно и мельче, не шире холста
  function caption(g, big, small, col = '#ffe08a', y = 270) {
    fit(g, big, 320, small ? y - 9 : y, 620, col, 18);
    if (small) fit(g, small, 320, y + 13, 620, '#9aa3c7', 13, 'center', 600);
  }
  // время сцены после переключателя: сцена начинается заново, когда ученик щёлкнул (ctl._t), иначе — с начала шага
  const since = (t, c) => (c && c._t < 90 ? c._t : t);
  const num = v => String(v).replace('.', ',');
  // плашка ✓ зелёная или ✗ красная
  function tag(g, ok, s, x, y, w = 200) { rr(g, x - w / 2, y - 15, w, 30, 12, ok ? 'rgba(124,245,168,.14)' : 'rgba(255,93,110,.14)', ok ? '#7cf5a8' : '#ff5d6e'); fit(g, (ok ? '✓ ' : '✗ ') + s, x, y, w - 14, ok ? '#7cf5a8' : '#ff8a8a', 14); }
  // подпись-раскрытие видео-петли: жёлтая плашка со стрелкой к месту
  function note(g, s, x, y, w, k = 1) { if (k <= 0) return; g.save(); g.globalAlpha = Math.min(1, k); rr(g, x - w / 2, y - 14, w, 28, 10, 'rgba(255,210,63,.16)', '#ffd23f'); fit(g, s, x, y, w - 12, '#ffe08a', 13); g.restore(); }
  // карта: рамка, значок, имя и число
  function card(g, x, y, w, h, icon, name, col = '#24304f', edge = '#3a4880', k = 1) {
    if (k <= 0) return;
    g.save(); g.translate(x, y); g.scale(k, k);
    rr(g, -w / 2, -h / 2, w, h, 10, col, edge);
    emo(g, icon, 0, -h / 2 + 20, 20);
    fit(g, name, 0, h / 2 - 16, w - 10, '#f2efe6', 13);
    g.restore();
  }
  // кубик с числом (0 — грань без точек, пока крутится)
  function die(g, x, y, n, s = 34, col = '#f2efe6') {
    rr(g, x - s / 2, y - s / 2, s, s, 7, col, '#0b1020');
    if (!n) return;
    const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[n] || [];
    P.forEach(([a, b]) => disc(g, x + a * s * 0.26, y + b * s * 0.26, s * 0.08, n === 1 ? '#ff5d6e' : '#0b1020'));
  }
  // полоска-шкала: подпись, заливка k (0..1), число справа
  function meter(g, x, y, w, k, label, val, col = '#7cf5a8', on = false) {
    text(g, label, x, y, on ? '#ffe08a' : '#9aa3c7', 13, 'left', on ? 800 : 600);
    rr(g, x + 92, y - 8, w, 16, 8, '#1a2240');
    if (k > 0) rr(g, x + 92, y - 8, Math.max(10, w * clamp(k, 0, 1)), 16, 8, col);
    text(g, val, x + 100 + w, y, on ? '#ffe08a' : '#f2efe6', 13, 'left', 800);
  }
  const shade = (k, a, b) => (k ? a : b);

  /* ================= урок 9: поток ================= */
  // канал потока: c.umenie — умение игрока (новичок, средний, мастер) поднимает канал; c.rovno — ровный подъём вместо пилы
  const X0 = 64, X1 = 600, Y0 = 232, Y1 = 34;
  const px9 = f => lerp(X0, X1, f), py9 = v => lerp(Y0, Y1, clamp(v, 0, 1.05));
  // пила: пять волн, каждая нарастает 80 % времени и падает в передышку; ровно — тот же средний подъём без передышек
  function saw(f) { const p = (f * 5) % 1; const w = p < 0.8 ? -1 + 2.2 * p / 0.8 : 1.2 - 2.2 * (p - 0.8) / 0.2; return 0.2 + 0.52 * f + 0.09 * w; }
  const ramp = f => 0.14 + 0.66 * f;
  MOTION['kanal-potoka'] = (g, t, W, H, c = {}) => {
    bg(g, W, H);
    const T = since(t, c) % 9, sk = c.umenie === 'новичок' ? -0.24 : c.umenie === 'мастер' ? 0.24 : 0, flat = !!c.rovno;
    const lo = f => 0.08 + 0.52 * f + sk, hi = f => 0.34 + 0.52 * f + sk;
    // оси и зоны
    g.strokeStyle = '#3a4880'; g.lineWidth = 2; g.beginPath(); g.moveTo(X0, Y1 - 6); g.lineTo(X0, Y0); g.lineTo(X1 + 10, Y0); g.stroke();
    text(g, 'трудность ↑', X0 + 6, Y1 - 14, '#9aa3c7', 12, 'left', 700); text(g, 'время партии →', X1, Y0 + 14, '#9aa3c7', 12, 'right', 700);
    // канал потока: полоса между lo и hi, при смене умения плавно переезжает
    const k = c._id === 'umenie' ? ob(seg(c._t, 0, 0.6)) : 1;
    const prevSk = MOTION['kanal-potoka']._sk == null ? sk : MOTION['kanal-potoka']._sk;
    const s2 = lerp(prevSk, sk, k); if (k >= 1) MOTION['kanal-potoka']._sk = sk;
    g.beginPath();
    for (let i = 0; i <= 40; i++) { const f = i / 40; g.lineTo(px9(f), py9(0.08 + 0.52 * f + s2)); }
    for (let i = 40; i >= 0; i--) { const f = i / 40; g.lineTo(px9(f), py9(0.34 + 0.52 * f + s2)); }
    g.closePath(); g.fillStyle = 'rgba(124,245,168,.16)'; g.fill(); g.strokeStyle = 'rgba(124,245,168,.5)'; g.lineWidth = 1.5; g.stroke();
    text(g, '🌊 канал потока', px9(0.52), py9(0.24 + 0.52 * 0.52 + s2) + 4, '#7cf5a8', 13, 'center', 800);
    text(g, '😬 тревога: сдаётся', X0 + 14, Y1 + 10, '#ff8a8a', 13, 'left', 800);
    text(g, '😴 скука: бросает', X1 - 4, Y0 - 14, '#8fb3ff', 13, 'right', 800);
    // кривая рисуется за 4 секунды; цвет куска — где он относительно канала
    const upto = clamp(T / 4.2, 0, 1), curve = flat ? ramp : saw;
    g.lineWidth = 4; g.lineCap = 'round';
    let state = 'flow';
    for (let i = 0; i < 120 * upto; i++) {
      const f = i / 120, f2 = (i + 1) / 120, v = curve(f);
      const st = v > hi(f) ? 'up' : v < lo(f) ? 'down' : 'flow';
      g.strokeStyle = st === 'up' ? '#ff5d6e' : st === 'down' ? '#8fb3ff' : '#ffd23f';
      g.beginPath(); g.moveTo(px9(f), py9(v)); g.lineTo(px9(f2), py9(curve(f2))); g.stroke();
      state = st;
    }
    // всадник на конце кривой и его лицо
    const f = upto, v = curve(f);
    hero(g, px9(f), py9(v) - 12, 10, '#e8c79a', 1);
    emo(g, state === 'up' ? '😬' : state === 'down' ? '😴' : '🌊', px9(f) + 22, py9(v) - 26, 18);
    if (!flat && upto > 0.25) text(g, 'передышка', px9(0.19), py9(saw(0.19)) + 22, '#9aa3c7', 11, 'center', 700);
    if (T > 4.4) {
      const up = [...Array(60).keys()].filter(i => { const x = i / 60; return curve(x) > hi(x); }).length, dn = [...Array(60).keys()].filter(i => { const x = i / 60; return curve(x) < lo(x); }).length;
      if (up > 12) caption(g, flat && !sk ? 'Ровный подъём без передышки уходит в тревогу' : 'Та же трасса — выше канала: тревога', flat && !sk ? 'в конце выдохнуть негде, игрок сдаётся' : 'новичку надо начать ниже или учить по пути', '#ff8a8a');
      else if (dn > 12) caption(g, 'Та же трасса — ниже канала: скука', 'мастеру нужна трасса выше — или вызов на рекорд', '#8fb3ff');
      else caption(g, flat ? 'Подъём пока в канале — но выдоха нет' : 'Пила идёт внутри канала: поток', flat ? 'смени умение — и увидишь, где он вываливается' : 'передышки возвращают игрока в канал');
    } else caption(g, 'Канал потока поднимается: игрок учится', 'трудность должна расти вместе с ним');
  };
  // пила и передышка: c.peredyshka — между волнами 4 секунды отдыха; без неё напряжение копится до предела
  MOTION['pila-vydoh'] = (g, t, W, H, c = {}) => {
    bg(g, W, H);
    const T = since(t, c) % 9.5, rest = !!c.peredyshka;
    // напряжение по времени: волны с отдыхом или ровный рост
    const tension = x => {
      if (!rest) return Math.min(1.02, 0.12 + 0.135 * x);
      const p = x % 2.2, wave = Math.floor(x / 2.2);
      return 0.16 + 0.07 * wave + (p < 1.7 ? 0.5 * p / 1.7 : 0.5 - 0.48 * (p - 1.7) / 0.5);
    };
    const gx = x => 70 + x * 58, gy = v => 150 - v * 110;
    g.strokeStyle = '#3a4880'; g.lineWidth = 2; g.beginPath(); g.moveTo(70, 30); g.lineTo(70, 150); g.lineTo(615, 150); g.stroke();
    text(g, 'напряжение', 76, 26, '#9aa3c7', 12, 'left', 700);
    g.setLineDash([6, 5]); g.strokeStyle = '#ff5d6e'; g.beginPath(); g.moveTo(70, gy(0.9)); g.lineTo(615, gy(0.9)); g.stroke(); g.setLineDash([]);
    text(g, 'предел', 612, gy(0.9) - 10, '#ff8a8a', 12, 'right', 700);
    const end = rest ? 9.2 : Math.min(9.2, 5.8);
    const upto = Math.min(T, end);
    g.lineWidth = 4; g.strokeStyle = rest ? '#ffd23f' : '#ff9a3d'; g.beginPath();
    for (let x = 0; x <= upto; x += 0.05) { const y = gy(tension(x)); x ? g.lineTo(gx(x), y) : g.moveTo(gx(x), y); }
    g.stroke();
    if (rest) for (let w = 0; w < 4; w++) { const a = w * 2.2 + 1.7; if (a < upto) { g.fillStyle = 'rgba(124,245,168,.16)'; g.fillRect(gx(a), 34, 0.5 * 58, 116); text(g, '🍃', gx(a + 0.25), 44, '#7cf5a8', 13); } }
    // дорога: конь бежит, преграды едут навстречу волнами; в передышке — только подковы
    const roadY = 214; g.fillStyle = '#1d2b4a'; g.fillRect(0, roadY + 14, W, 12);
    const crash = !rest && T >= 5.8;
    for (let i = 0; i < 26; i++) {
      const at = i * 0.36, x = 640 - (T - at) * 160;
      if (x < -20 || x > 660) continue;
      const p = at % 2.2, inRest = rest && p >= 1.7;
      emo(g, inRest ? '🧲' : '🪵', x, roadY + 6, inRest ? 16 : 20);
    }
    if (!crash) emo(g, '🐎', 120 + Math.sin(T * 9) * 2, roadY - 2 + Math.abs(Math.sin(T * 9)) * -6, 32);
    else { emo(g, '💥', 128, roadY - 4, 34); tag(g, false, 'Сдался на 58-й секунде', 320, 186, 280); }
    text(g, rest ? 'волна → передышка → волна выше' : 'подъём без остановки', 615, 168, '#9aa3c7', 12, 'right', 700);
    if (rest) caption(g, 'Передышка — вдох перед новой волной', 'напряжение растёт волнами и не упирается в предел');
    else caption(g, 'Без передышек напряжение копится — и игрок ломается', 'средняя скорость та же, а выдохнуть негде', '#ff8a8a');
  };

  /* ================= урок 10: интересное решение ================= */
  // «Свинья»: c.porog — до скольких очков бросаешь (10, 20, 35, 100). Четыре хода на одних и тех же кубиках, справа — в среднем за ход
  const PIG = [[4, 6, 5, 3, 6, 2, 1], [3, 1], [6, 5, 4, 6, 6, 3, 2, 5, 1], [2, 5, 6, 4, 3, 5, 6, 1]];
  const PIG_AVG = { 10: [6.9, 41], 20: [8.1, 62], 35: [7, 81], 100: [0, 100] }; // 200 000 ходов симуляцией: очки за ход и сколько ходов сгорает
  MOTION['svinya-risk'] = (g, t, W, H, c = {}) => {
    bg(g, W, H);
    const k = Number(c.porog) || 20, T = since(t, c) % 11;
    text(g, `Бросаю, пока не наберу ${k}`, 20, 22, '#ffe08a', 15, 'left', 800);
    let total = 0;
    PIG.forEach((row, r) => {
      const y = 58 + r * 46, t0 = r * 2.2, n = Math.max(0, Math.floor((T - t0) / 0.28));
      let s = 0, i = 0, out = null;
      for (; i < row.length; i++) { if (row[i] === 1) { out = 'bust'; break; } s += row[i]; if (s >= k) { out = 'take'; i++; break; } }
      const all = out === 'bust' ? i + 1 : i, shown = Math.min(n, all);
      // длинный ход ужимает кубики: ряд с ярлыком не заходит под табличку справа
      const dx = Math.min(34, 230 / Math.max(1, all)), ds = Math.min(28, dx - 4);
      for (let j = 0; j < shown; j++) die(g, 34 + j * dx, y, row[j], ds);
      let run = 0; for (let j = 0; j < shown; j++) run = row[j] === 1 ? 0 : run + row[j];
      if (shown < all) text(g, run ? `в ходе ${run}` : '', 34 + shown * dx + 6, y, '#9aa3c7', 13, 'left', 700);
      else if (out === 'take') { tag(g, true, `забрал ${s}`, 34 + shown * dx + 62, y, 120); total += s; }
      else tag(g, false, `сгорело ${s}`, 34 + shown * dx + 68, y, 132);
    });
    // справа: в среднем за ход по 200 000 ходов
    rr(g, 404, 34, 222, 196, 14, 'rgba(26,34,64,.9)', '#3a4880');
    text(g, 'В среднем за ход', 515, 54, '#9aa3c7', 13, 'center', 700);
    [10, 20, 35, 100].forEach((p, i) => meter(g, 416, 84 + i * 30, 60, PIG_AVG[p][0] / 9, `до ${p}`, num(PIG_AVG[p][0]), p === 20 ? '#7cf5a8' : '#ffb547', p === k));
    text(g, `сгорает ходов: ${PIG_AVG[k] ? PIG_AVG[k][1] : '—'} %`, 515, 212, '#ff8a8a', 13, 'center', 800);
    if (T > 9) {
      if (k <= 10) caption(g, 'Осторожно: редко сгорает, но мало', 'риск маленький — и награда тоже');
      else if (k <= 20) caption(g, 'Риск и награда в равновесии', 'каждый бросок — решение: жадность или осторожность', '#7cf5a8');
      else if (k < 100) caption(g, 'Жадно: сгорает чаще, чем забирает', 'большая награда — большой риск', '#ffb547');
      else caption(g, 'Без «хватит» всё сгорает', 'решение есть, только когда можно остановиться', '#ff8a8a');
    } else caption(g, 'Бросить ещё или забрать?', 'одни и те же кубики — разная жадность');
  };
  // три карточки улучшений: c.cena — у каждой своя цена и свой путь; без неё одна в разы сильнее, и класс берёт только её
  MOTION['tri-kartochki'] = (g, t, W, H, c = {}) => {
    bg(g, W, H);
    const T = since(t, c) % 8, on = !!c.cena;
    const C = on ? [['🔥', 'Посох: +1 снаряд', 'урон'], ['🛡', 'Бурка: −20 % урона', 'защита'], ['🧲', 'Магнит: кристаллы с 3 м', 'подбор']]
      : [['🔥', '+40 % урона всему', 'в 20 раз сильнее'], ['👟', '+2 % к бегу', 'почти ничего'], ['🧲', '+0,1 м магнита', 'почти ничего']];
    const share = on ? [0.38, 0.27, 0.35] : [0.9, 0.05, 0.05];
    C.forEach(([ic, name, sub], i) => {
      const x = 120 + i * 200, k = ob(seg(T, 0.1 + i * 0.12, 0.5 + i * 0.12)), best = !on && i === 0;
      if (best) glow(g, x, 78, 90, 'rgba(255,210,63,.35)');
      card(g, x, 78, 170, 84, ic, name, best ? '#3a2f12' : '#24304f', best ? '#ffd23f' : on ? '#7cf5a8' : '#3a4880', k);
      if (k > 0.9) text(g, sub, x, 132, best ? '#ffd23f' : on ? '#7cf5a8' : '#9aa3c7', 12, 'center', 700);
    });
    // класс выбирает: 30 точек летят снизу к карточкам
    const R = M.kit.rng(on ? 11 : 7);
    let acc = 0; const bins = share.map(s => { const n = Math.round(s * 30); return n; });
    let idx = 0;
    bins.forEach((n, i) => { for (let j = 0; j < n; j++, idx++) {
      const start = 1.4 + idx * 0.05, f = io2(seg(T, start, start + 0.7)), sx = 80 + R() * 480, ex = 120 + i * 200 + (j % 10 - 4.5) * 12, ey = 168 + Math.floor(j / 10) * 12;
      if (f > 0) disc(g, lerp(sx, ex, f), lerp(236, ey, f), 4, ['#5fe0ff', '#ffd23f', '#ff8fa0', '#b49bff'][idx % 4]);
    } acc += n; });
    if (T > 3.4) bins.forEach((n, i) => text(g, `${Math.round(share[i] * 100)} %`, 120 + i * 200, 218, on ? '#7cf5a8' : i === 0 ? '#ffd23f' : '#9aa3c7', 15, 'center', 800));
    if (T < 3.4) caption(g, 'Класс выбирает улучшение…', '30 игроков, одна тройка');
    else if (on) caption(g, 'Сила сравнима, пути разные — выбор настоящий', 'лучшее зависит от того, как ты играешь', '#7cf5a8');
    else caption(g, 'Одна карточка в разы сильнее — это не выбор', 'все берут одно и то же, думать не о чем', '#ff8a8a');
  };
  const io2 = x => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

  /* ================= урок 11: петли обратной связи ================= */
  // гонка трёх тележек на 3 круга: c.kom — снежный ком (лидер быстрее), c.rezinka — помощь отстающему (резинка).
  // Гонка считается шагами по 1/30 с от старта, одинаково при каждом кадре: удары у всех в одни и те же моменты
  const RACERS = [{ col: '#ffd23f', base: 0.4, hits: [2.6, 5.9] }, { col: '#5fe0ff', base: 0.385, hits: [1.3, 4.6] }, { col: '#ff8fa0', base: 0.37, hits: [3.4, 6.8] }];
  // до финиша победителя: p — круги, won — когда финишировал первый, changes — смены лидера (с запасом 0,02 круга, без дрожи)
  function race(kom, rez, upto) {
    const p = [0, 0, 0], dt = 1 / 30; let lead = 0, changes = 0, won = null;
    for (let t = 0; t < upto && won == null; t += dt) {
      const max = Math.max(...p), mean = (p[0] + p[1] + p[2]) / 3;
      for (let i = 0; i < 3; i++) {
        let v = RACERS[i].base;
        if (RACERS[i].hits.some(h => t >= h && t < h + 0.5)) v *= 0.35; // удар: полсекунды тележка ползёт
        if (kom) v += 0.5 * (p[i] - mean); // снежный ком: кто впереди, тот быстрее
        if (rez) v += 1.0 * (max - p[i]) - (p[i] === max ? 0.03 : 0); // резинка: отстающего тянет, лидер чуть медленнее
        p[i] += Math.max(0.08, v) * dt;
      }
      const nl = p.indexOf(Math.max(...p)); if (nl !== lead && p[nl] - p[lead] > 0.02) { changes++; lead = nl; }
      if (Math.max(...p) >= 3) won = t;
    }
    return { p, lead, changes, won };
  }
  MOTION['gonka-petli'] = (g, t, W, H, c = {}) => {
    bg(g, W, H, '#0e1a12');
    const kom = !!c.kom, rez = !!c.rezinka, T = since(t, c) % 11;
    const r = race(kom, rez, T);
    // овальная трасса
    const cx = 250, cy = 128, rx = 210, ry = 88;
    g.lineWidth = 26; g.strokeStyle = '#5a4630'; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.stroke();
    g.lineWidth = 2; g.setLineDash([8, 8]); g.strokeStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#f2efe6'; g.fillRect(cx - 3, cy + ry - 14, 6, 28); emo(g, '🏁', cx, cy + ry + 26, 16);
    emo(g, '🎪', cx, cy, 34);
    r.p.forEach((p, i) => {
      const a = Math.PI / 2 - Math.min(p, 3) * TAU, off = (i - 1) * 7;
      const x = cx + Math.cos(a) * (rx + off), y = cy + Math.sin(a) * (ry + off);
      if (i === r.lead) glow(g, x, y, 22, 'rgba(255,255,255,.35)');
      disc(g, x, y, 9, RACERS[i].col); g.strokeStyle = '#0b1020'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 9, 0, TAU); g.stroke();
    });
    // справа — табло: круги, разрыв, смены лидера
    rr(g, 476, 22, 150, 206, 14, 'rgba(11,16,32,.9)', '#3a4880');
    const order = [0, 1, 2].sort((a, b) => r.p[b] - r.p[a]);
    order.forEach((i, k) => { disc(g, 498, 50 + k * 26, 8, RACERS[i].col); text(g, `${k + 1} место · круг ${Math.min(3, Math.floor(r.p[i]) + 1)}`, 512, 50 + k * 26, '#f2efe6', 12, 'left', 700); });
    const done = r.won != null, gap = (r.p[order[0]] - r.p[order[2]]) / 0.39; // разрыв в секундах хода
    text(g, done ? 'Разрыв на финише' : 'Разрыв сейчас', 551, 142, '#9aa3c7', 12, 'center', 700);
    text(g, `${num(gap.toFixed(1))} с`, 551, 164, gap > 3 ? '#ff8a8a' : '#7cf5a8', 22, 'center', 900);
    text(g, `смен лидера: ${r.changes}`, 551, 200, r.changes ? '#ffe08a' : '#9aa3c7', 13, 'center', 800);
    if (!done) caption(g, kom && rez ? 'Обе петли: лидер сильнее, но не сбегает' : kom ? 'Снежный ком: кто впереди — тот быстрее' : rez ? 'Помощь отстающему: последних подтягивает' : 'Без петель: как выпало', 'смотри на разрыв и смены лидера');
    else if (kom && !rez) caption(g, 'Снежный ком: всё решилось на первом круге', 'лидер уехал — остальным играть незачем', '#ff8a8a');
    else if (rez && !kom) caption(g, 'Помощь отстающему: рядом до самого финиша', 'исход неясен — гонка напряжённая', '#7cf5a8');
    else if (rez && kom) caption(g, 'Две петли уравновешивают друг друга', 'лучший награждён, но остальные не сдаются', '#7cf5a8');
    else caption(g, 'Без петель гонка решается ударами случая', 'включи петлю — и сравни разрыв');
  };

  /* ================= урок 12: случай и мастерство ================= */
  // c.posle — кубик бросают после решения: выбрал хорошую карту, а кубик отнял. Без него — случай до решения: рука пришла, думай
  MOTION['kubik-do-posle'] = (g, t, W, H, c = {}) => {
    bg(g, W, H);
    const T = since(t, c) % 8.5, after = !!c.posle;
    // порядок сверху: две плашки и стрелка
    const A = after ? ['🧠 Решение', '🎲 Случай'] : ['🎲 Случай', '🧠 Решение'];
    rr(g, 170, 14, 120, 30, 12, after ? '#24304f' : '#3a2f12', after ? '#7aa2ff' : '#ffd23f'); text(g, A[0], 230, 29, '#f2efe6', 14);
    arrow(g, 296, 29, 344, 29, '#9aa3c7', 2);
    rr(g, 350, 14, 120, 30, 12, after ? '#3a2f12' : '#24304f', after ? '#ffd23f' : '#7aa2ff'); text(g, A[1], 410, 29, '#f2efe6', 14);
    // враг: иныж с жизнями 6
    let hp = 6; const ex = 520, ey = 130;
    // рука
    const hand = after ? [['⚔', 'Удар 7'], ['🛡', 'Щит 5'], ['⚔', 'Удар 3']] : [['⚔', 'Удар 3'], ['🛡', 'Щит 5'], ['⚔', 'Удар 7']];
    const dealt = after ? 1 : ob(seg(T, 1.0, 1.6));
    if (!after) { const roll = T < 1 ? 1 + Math.floor((T * 18) % 6) : 0; die(g, 120, 110, T < 1 ? roll : 0, 40, '#ffe08a'); if (T >= 1) text(g, 'раздача', 120, 140, '#ffd23f', 12, 'center', 800); }
    const pickT = after ? 1.2 : 2.6, hitT = after ? 3.8 : 3.6;
    hand.forEach(([ic, name], i) => {
      const chosen = name === 'Удар 7', x0 = after ? 120 + i * 90 : 210 + i * 90, y0 = 210;
      let x = x0, y = y0;
      if (chosen && T > pickT) { const f = ob(seg(T, pickT, pickT + 0.7)); x = lerp(x0, ex - 70, f); y = lerp(y0, ey, f); }
      if (!(chosen && T > hitT)) card(g, x, y, 80, 70, ic, name, chosen && T > pickT - 0.6 ? '#3a2f12' : '#24304f', chosen && T > pickT - 0.6 ? '#ffd23f' : '#3a4880', dealt);
    });
    let dmg = 0, verdict = null;
    if (!after && T > hitT) { dmg = 7; verdict = 'me'; }
    if (after && T > 2.4) {
      const f = T < 3.4 ? 1 + Math.floor((T * 18) % 6) : 1;
      die(g, 330, 110, f, 40, '#ffe08a'); text(g, T < 3.4 ? 'кубик…' : '1: промах, урон ×½', 330, 142, '#ff8a8a', 12, 'center', 800);
      if (T > hitT) { dmg = 3; verdict = 'die'; }
    }
    hp = Math.max(0, 6 - dmg);
    if (hp > 0) { hero(g, ex, ey, 30, '#8d6e63', -1); text(g, `❤ ${hp}`, ex, ey - 44, '#ff8fa0', 15); }
    else if (T < hitT + 0.8) confetti(g, ex, ey, seg(T, hitT, hitT + 0.8));
    if (T > hitT) emo(g, '💥', ex - 30, ey - 6, 26);
    if (after && T > hitT + 0.6 && hp > 0) { arrow(g, ex - 30, ey + 10, 300, 220, '#ff5d6e', 3); text(g, 'ответный удар 8', 400, 200, '#ff8a8a', 13, 'center', 800); }
    if (verdict === 'me' && T > hitT + 0.5) caption(g, 'Случай до решения: рука пришла — думай', 'выиграл или проиграл — решал ты', '#7cf5a8');
    else if (verdict === 'die' && T > hitT + 0.5) caption(g, 'Случай после решения: решил верно — а кубик отнял', 'обидно: решал не ты', '#ff8a8a');
    else caption(g, after ? 'Сначала решаешь, потом кубик…' : 'Сначала кубик раздаёт карты, потом решаешь ты', 'смотри, где стоит кубик');
  };
  // намерение врага: c.skryto — пузырь над врагом не виден; игрок бьёт наугад и получает удар, которого не ждал
  MOTION['namerenie-vraga'] = (g, t, W, H, c = {}) => {
    bg(g, W, H);
    const T = since(t, c) % 8, hid = !!c.skryto;
    const ex = 470, ey = 120;
    hero(g, ex, ey, 34, '#8d6e63', -1);
    const ehp = hid && T > 3.2 ? 8 : 14; text(g, `❤ ${ehp}`, ex, ey + 50, '#ff8fa0', 14);
    const k = ob(seg(T, 0.4, 0.9));
    if (k > 0) { g.save(); g.translate(ex, ey - 64); g.scale(k, k); rr(g, -38, -18, 76, 36, 16, hid ? '#24304f' : '#4a1a22', hid ? '#9aa3c7' : '#ff5d6e'); text(g, hid ? '❓' : '⚔ 9', 0, 0, hid ? '#f2efe6' : '#ff8a8a', 18); g.restore(); }
    if (!hid && k >= 1 && T < 2.4) note(g, 'Враг ударит на 9', ex, ey - 104, 150);
    // герой и рука
    const hx = 150, hy = 136;
    hero(g, hx, hy, 26, '#5fe0ff', 1);
    let hhp = 20, shield = 0;
    const pick = hid ? 0 : 1, pT = 2.2;
    [['⚔', 'Удар 6'], ['🛡', 'Щит 8']].forEach(([ic, name], i) => {
      const chosen = i === pick, x0 = 120 + i * 100, y0 = 214;
      let x = x0, y = y0;
      if (chosen && T > pT) { const f = ob(seg(T, pT, pT + 0.7)); x = lerp(x0, hid ? ex - 60 : hx + 50, f); y = lerp(y0, hid ? ey : hy - 30, f); }
      if (!(chosen && T > 3.1)) card(g, x, y, 84, 50, ic, name, chosen && T > 1.6 ? '#3a2f12' : '#24304f', chosen && T > 1.6 ? '#ffd23f' : '#3a4880');
    });
    if (!hid && T > 3.1) { shield = 8; rr(g, hx - 40, hy - 50, 80, 22, 10, 'rgba(95,224,255,.2)', '#5fe0ff'); text(g, '🛡 8', hx, hy - 39, '#5fe0ff', 13); }
    if (T > 4.4) {
      const f = seg(T, 4.4, 4.9);
      arrow(g, ex - 40, ey + 6, lerp(ex - 40, hx + 34, f), lerp(ey + 6, hy, f), '#ff5d6e', 4);
      if (f >= 1) { const lost = Math.max(0, 9 - shield); hhp = 20 - lost; emo(g, '💥', hx + 26, hy - 6, 24); text(g, `−${lost}`, hx + 50, hy - 30, lost > 2 ? '#ff5d6e' : '#7cf5a8', 20, 'center', 900); }
    }
    text(g, `❤ ${hhp}`, hx, hy + 44, '#ff8fa0', 14);
    if (T > 5.2) {
      if (hid) caption(g, '«Откуда?!» — игрок гадал, а не решал', 'без намерения проигрыш кажется нечестным', '#ff8a8a');
      else caption(g, 'Видел удар — закрылся: решил сам', 'намерение превращает случай в задачу', '#7cf5a8');
    } else caption(g, hid ? 'Что задумал враг? Не видно…' : 'Над врагом видно, что он сделает', 'реши: бить или закрываться');
  };
  // видео-петля урока 12 (Г2 «petlya»): запись одного хода «Колоды нарта»; c.reveal — после ответа сцена подписывает, где случай, а где точность
  MOTION['petlya-kolody'] = (g, t, W, H, c = {}) => {
    bg(g, W, H, '#14111f');
    const T = t % 8, R = !!c.reveal;
    // стол у дольмена
    g.fillStyle = '#2a2236'; g.fillRect(0, 186, W, 114);
    // колода и рука: 5 карт прилетают из колоды
    rr(g, 24, 206, 46, 64, 8, '#3a2f52', '#b49bff'); emo(g, '🂠', 47, 238, 26);
    const HAND = [['🛡', 'Щит 6'], ['⚔', 'Удар 5'], ['⚔', 'Удар 4'], ['🔥', 'Огонь 3'], ['🛡', 'Щит 3']];
    HAND.forEach(([ic, name], i) => {
      const f = ob(seg(T, 0.1 + i * 0.18, 0.5 + i * 0.18)), x0 = 120 + i * 82, y0 = 244;
      let x = lerp(47, x0, f), y = lerp(238, y0, f);
      if (i === 0 && T > 2.2) { const k = ob(seg(T, 2.2, 2.9)); x = lerp(x0, 150, k); y = lerp(y0, 128, k); if (T > 3.0) return; }
      if (i === 1 && T > 3.6) { const k = ob(seg(T, 3.6, 4.3)); x = lerp(x0, 470, k); y = lerp(y0, 112, k); if (T > 4.4) return; }
      if (f > 0) card(g, x, y, 72, 62, ic, name, '#24304f', i < 2 && T > 1.9 ? '#ffd23f' : '#3a4880', f);
    });
    // герой и щит
    hero(g, 150, 140, 24, '#5fe0ff', 1);
    let hp = 30, sh = T > 3.0 && T < 7.6 ? 6 : 0;
    if (sh) { rr(g, 112, 94, 76, 22, 10, 'rgba(95,224,255,.2)', '#5fe0ff'); text(g, '🛡 6', 150, 105, '#5fe0ff', 13); }
    // два врага с пузырями намерений
    const E = [{ x: 400, hp: 12, it: '⚔ 7' }, { x: 520, hp: 5, it: '⚔ 4' }];
    E.forEach((e, i) => {
      const dead = i === 1 && T > 4.4;
      if (dead) { if (T < 5) confetti(g, e.x, 120, seg(T, 4.4, 5)); return; }
      hero(g, e.x, 120, i ? 22 : 28, i ? '#a1887f' : '#8d6e63', -1); text(g, `❤ ${e.hp}`, e.x, 160, '#ff8fa0', 13);
      const k = ob(seg(T, 1.2 + i * 0.2, 1.6 + i * 0.2));
      if (k > 0) { g.save(); g.translate(e.x, 70); g.scale(k, k); rr(g, -32, -15, 64, 30, 14, '#4a1a22', '#ff5d6e'); text(g, e.it, 0, 0, '#ff8a8a', 15); g.restore(); }
    });
    if (T > 3.6 && T < 4.6) emo(g, '💥', 506, 112, 26);
    // враг 1 бьёт на 7: щит 6 берёт почти всё
    if (T > 5.2 && T < 6.6) { arrow(g, 370, 124, 186, 140, '#ff5d6e', 4); if (T > 5.6) text(g, '−1', 196, 112, '#7cf5a8', 20, 'center', 900); }
    if (T > 5.6) hp = 29;
    text(g, `❤ ${hp}`, 150, 176, '#ff8fa0', 13);
    text(g, T < 7 ? 'запись партии · ход 3' : 'ход окончен', 20, 22, '#9aa3c7', 12, 'left', 700);
    if (R) {
      note(g, '🎲 Случай: какие 5 карт пришли', 250, 200, 250, seg(T, 0.6, 1.0));
      note(g, '👁 Намерения видны до хода', 460, 30, 230, seg(T, 1.4, 1.8));
      note(g, 'Щит 6 — ровно 6', 150, 64, 150, seg(T, 2.9, 3.2));
      note(g, 'Удар 5 — ровно 5: враг не успел', 530, 184, 210, seg(T, 4.3, 4.6) * (T < 7 ? 1 : 0));
      if (T > 6.6) { rr(g, 0, 244, W, 56, 0, 'rgba(11,16,32,.92)'); caption(g, 'Случай только в раздаче — дальше всё видно и точно', 'ход решил игрок, а не кубик', '#7cf5a8'); }
    }
  };

  /* ================= урок 13: экономика ================= */
  // родник → кувшин → бойцы → сток: c.stok — бойцы гибнут в схватке (сток); без него поле захлёбывается.
  // c.dvoynoy — двойной эликсир: во второй половине капли вдвое чаще
  MOTION['rodnik-kuvshin'] = (g, t, W, H, c = {}) => {
    bg(g, W, H, '#0d1626');
    const T = since(t, c) % 11, stok = !!c.stok, dbl = !!c.dvoynoy;
    // река и мост
    g.fillStyle = '#16365c'; g.fillRect(300, 150, 40, 70); g.fillStyle = '#6d5a48'; g.fillRect(292, 176, 56, 16);
    g.fillStyle = '#1d2b4a'; g.fillRect(0, 176, 300, 16); g.fillRect(340, 176, 300, 16);
    // родник и кувшин слева (у врага — справа, так же)
    const rate = x => (dbl && x > 5.5 ? 5 : 2.5), cost = 4;
    // сколько капель пришло к моменту x: интеграл скорости
    const drops = x => (dbl && x > 5.5 ? 5.5 * 2.5 + (x - 5.5) * 5 : x * 2.5);
    // кувшин: каждая 4-я капля — боец; потолок 10 и перелив
    const spawns = []; let lvl = 0, lost = 0, prev = 0;
    for (let x = 0; x <= T; x += 0.05) { const d = drops(x) - prev; prev = drops(x); lvl += d; if (lvl >= cost) { lvl -= cost; spawns.push(x); } if (lvl > 10) { lost += lvl - 10; lvl = 10; } }
    [[70, 1], [570, -1]].forEach(([jx, dir]) => {
      emo(g, '🚰', jx, 46, 26);
      const k = (T * rate(T)) % 1; disc(g, jx + 4 * dir, 66 + k * 30, 4, '#5fe0ff');
      rr(g, jx - 26, 100, 52, 62, 12, '#2a3a5c', '#5fe0ff');
      const h = 56 * lvl / 10; rr(g, jx - 22, 158 - h, 44, Math.max(2, h), 8, '#3aa0ff');
      text(g, `${Math.floor(lvl)}/10`, jx, 92, '#9fe3ff', 12, 'center', 800);
    });
    text(g, 'источник', 70, 20, '#9aa3c7', 12, 'center', 700); text(g, 'кувшин', 70, 176 - 4, '#9aa3c7', 11, 'center', 700);
    // бойцы идут к мосту; со стоком встречаются и гибнут, без стока копятся у моста
    const speed = 70, meet = (300 - 110) / speed;
    let crowd = 0, fights = 0;
    spawns.forEach((s, i) => {
      const age = T - s;
      [[110, 1, '#5fe0ff'], [530, -1, '#ff8fa0']].forEach(([x0, dir, col]) => {
        if (stok && age > meet + 0.6) { fights++; return; }
        const x = age < meet ? x0 + dir * age * speed : 320 - dir * (16 + (stok ? 0 : (i % 6) * 9));
        const y = age < meet ? 184 : 184 - (stok ? 0 : Math.floor(i / 6) * 12);
        if (age >= meet) crowd++;
        hero(g, x, y - 8, 8, col, dir);
        if (stok && age >= meet && age < meet + 0.6) emo(g, '⚔', 320, 160, 18);
      });
    });
    text(g, `на поле: ${spawns.length * 2 - fights}`, 320, 230, !stok && crowd > 8 ? '#ff8a8a' : '#f2efe6', 15, 'center', 800);
    if (lost > 0.5) text(g, `впустую: ${Math.round(lost)} капель`, 320, 252, '#ffb547', 12, 'center', 700);
    if (dbl && T > 5.5) { rr(g, 250, 14, 140, 28, 12, 'rgba(255,210,63,.16)', '#ffd23f'); text(g, '×2 капли!', 320, 28, '#ffe08a', 14); }
    if (!stok && crowd > 8) caption(g, 'Без стока поле захлёбывается', 'бойцов всё больше, никто не уходит — играть не во что', '#ff8a8a');
    else if (stok && dbl && T > 5.5) caption(g, 'Двойной эликсир: финал горячее', 'источник сильнее — больше решений за секунду', '#ffe08a');
    else caption(g, 'Источник → кувшин → сток: ресурс течёт', 'бойцы тратят капли и уходят в схватке — поле дышит');
  };
  // цена по силе: c.vsadnik — Всадник дешевле своей силы; класс выпускает только его
  MOTION['cena-sily'] = (g, t, W, H, c = {}) => {
    bg(g, W, H);
    const T = since(t, c) % 8, br = !!c.vsadnik;
    const U = [['🏹', 'Лучницы', 3, 3], ['🛡', 'Рыцарь', 4, 4], ['🐎', 'Всадник', br ? 3 : 5, br ? 6.5 : 5], ['🗿', 'Великан', 7, 7]];
    const picks = br ? [0.06, 0.06, 0.82, 0.06] : [0.27, 0.24, 0.26, 0.23];
    text(g, 'цена, капли', 222, 22, '#5fe0ff', 12, 'center', 700); text(g, 'сила', 372, 22, '#ffb547', 12, 'center', 700); text(g, 'выпускает класс', 540, 22, '#9aa3c7', 12, 'center', 700);
    U.forEach(([ic, name, cost, pw], i) => {
      const y = 52 + i * 46, k = ob(seg(T, 0.2 + i * 0.15, 0.7 + i * 0.15)), bad = br && i === 2;
      if (bad) { rr(g, 12, y - 20, 616, 40, 12, 'rgba(255,93,110,.12)', '#ff5d6e'); }
      emo(g, ic, 34, y, 20); text(g, name, 56, y, bad ? '#ff8a8a' : '#f2efe6', 14, 'left', 800);
      rr(g, 160, y - 7, 124 * k * cost / 7, 14, 7, '#3aa0ff'); text(g, String(cost), 166 + 124 * k * cost / 7, y, '#9fe3ff', 12, 'left', 800);
      rr(g, 310, y - 7, 124 * k * pw / 7, 14, 7, bad ? '#ff5d6e' : '#ffb547'); text(g, num(pw), 316 + 124 * k * pw / 7, y, bad ? '#ff8a8a' : '#ffe08a', 12, 'left', 800);
      const f = ob(seg(T, 2.2, 3.4));
      rr(g, 470, y - 9, 140 * f * picks[i], 18, 8, bad ? '#ff5d6e' : '#7cf5a8');
      if (f > 0.9) text(g, `${Math.round(picks[i] * 100)} %`, 476 + 140 * picks[i], y, '#f2efe6', 12, 'left', 800);
    });
    if (T < 3.4) caption(g, 'Сила растёт вместе с ценой?', 'сравни синюю и оранжевую полоски');
    else if (br) caption(g, 'Дешёвая сила ломает выбор', 'все выпускают Всадника — игра стала одной картой', '#ff8a8a');
    else caption(g, 'Цена по силе: каждый боец стоит своих капель', 'что выпустить, решает план, а не цена', '#7cf5a8');
  };

  /* ================= карусель (Г5): обмен игр по кругу ================= */
  const { el, api, toast, beep } = Lab;
  const mmss = ms => { const v = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`; };
  const roundWord = n => (n % 10 === 1 && n % 100 !== 11 ? 'круг' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'круга' : 'кругов');
  // сводка отзывов на игру автора: чипы с числом и пометкой «у всех», «у большинства», «заметил один»
  function agree(list, n) {
    return el('div', { class: 'm3-agree' }, list.map(x => el('span', { class: 'chip m3-chip' + (x.all || x.most ? ' many' : x.one ? ' one' : ''), 'data-agree': x.all ? 'all' : x.most ? 'most' : x.one ? 'one' : 'some' },
      `${x.label} · ${x.n} из ${n}`, el('i', {}, x.all ? 'совпало у всех' : x.most ? 'у большинства' : x.one ? 'заметил один' : ''))));
  }
  function summaryBox(m) {
    if (!m || !m.n) return el('p', { class: 'muted small' }, 'Отзывов на твою игру пока нет: они появятся, как только соседи отправят первые.');
    return el('div', { class: 'secret-reveal stack m3-sum' }, el('div', { class: 'eyebrow' }, `Твоя «${m.title}» прошла по кругу · отзывов: ${m.n}`),
      m.feel.length ? [el('b', {}, 'Что чувствовали'), agree(m.feel, m.n)] : null,
      m.fix.length ? [el('b', {}, 'Что поправить'), agree(m.fix, m.n)] : null,
      m.texts.length ? el('ul', { class: 'm3-texts' }, m.texts.map(x => el('li', {}, `«${x.text}»`, el('span', { class: 'muted small' }, ` · круг ${x.round}`)))) : null,
      el('p', { class: 'concept' }, 'Совпало у всех — это про игру, а не про вкус одного игрока: чини первым. Заметил один — проверь в следующем плейтесте.'));
  }

  // вкладка проектора «🎠 Карусель»: учитель запускает круг, большой таймер, кто кому передаёт, «Следующий круг сейчас», «Закончить»
  function karuselPult(host, { code, lesson }) {
    const P = { k: null, skew: 0, tick: 0, round: null };
    const step = () => (lesson() ? lesson().checkpoints.flatMap(c => c.steps).find(s => s.type === 'karusel') : null);
    async function act(body) {
      try { const r = await api('/api/teacher/karusel', Object.assign({ code: code(), step: step() && step().id }, body)); take(r.karusel); beep('tick'); } catch (e) { toast(e.message, 'err'); }
    }
    async function load() { try { take((await api('/api/teacher/karusel?code=' + encodeURIComponent(code()))).karusel); } catch (e) { toast(e.message, 'err'); } }
    function take(k) {
      if (k && k.now) P.skew = k.now - Date.now();
      if (P.k && k && k.phase === 'run' && P.round != null && k.round !== P.round) beep('done'); // игра уходит дальше — звук на весь класс
      P.k = k; P.round = k && k.phase === 'run' ? k.round : null; draw();
    }
    function ring(k) {
      const n = k.ring.length, R = 42, box = el('div', { class: 'm3-ring', role: 'img', 'aria-label': 'Круг: ' + k.ring.map(x => x.nick).join(' → ') });
      k.ring.forEach((x, i) => {
        const a = -Math.PI / 2 + i * 2 * Math.PI / n;
        box.append(el('span', { class: 'm3-seat', style: `left:${50 + R * Math.cos(a)}%;top:${50 + R * Math.sin(a)}%` }, el('b', {}, x.nick), el('i', {}, x.title)));
      });
      box.append(el('span', { class: 'm3-hub' }, el('span', { class: 'm3-wheel', 'aria-hidden': 'true' }, '🎠'), el('small', {}, k.phase === 'run' ? `круг ${k.round + 1}: каждый играет игру ${k.round ? `${k.round + 1}-го соседа` : 'соседа'} по часовой` : '')));
      return box;
    }
    function draw() {
      const k = P.k, st = step();
      if (!st) { host.replaceChildren(el('div', { class: 'card' }, el('h2', {}, 'В этом уроке нет карусели'))); return; }
      const min = st.minutes || 4, rounds = st.rounds || 5;
      if (!k || !k.phase) {
        host.replaceChildren(el('div', { class: 'card stack m3-pult' }, el('div', { class: 'eyebrow' }, '🎠 Карусель'), el('h2', {}, st.title),
          el('p', { class: 'pj-sub' }, `Каждые ${min} минуты игра уходит следующему по кругу. ${rounds} ${roundWord(rounds)} — ${rounds} игроков и ${rounds} коротких отзывов на каждую игру. Автор в конце видит, где совпало у всех, а где у одного.`),
          el('div', { class: 'row' }, el('button', { class: 'btn warm', type: 'button', 'data-kar': 'start', onclick: () => act({ action: 'start' }) }, '▶ Запустить карусель'))));
        return;
      }
      if (k.phase === 'end') {
        host.replaceChildren(el('div', { class: 'card stack m3-pult' }, el('div', { class: 'eyebrow' }, '🎠 Карусель'), el('h2', {}, 'Карусель закончена'),
          el('p', { class: 'pj-sub' }, `Отзывов: ${k.notes}. Каждый автор видит у себя, что совпало у всех и что заметил один.`), ring(k),
          el('div', { class: 'row' }, el('button', { class: 'btn', type: 'button', 'data-kar': 'start', onclick: () => act({ action: 'start' }) }, '↻ Новая карусель'),
            el('button', { class: 'btn ghost small', type: 'button', 'data-kar': 'reset', onclick: () => act({ action: 'reset' }) }, 'Убрать'))));
        return;
      }
      host.replaceChildren(el('div', { class: 'card stack m3-pult' },
        el('div', { class: 'row' }, el('div', { class: 'eyebrow grow' }, `🎠 Карусель · круг ${k.round + 1} из ${k.rounds}`), el('span', { class: 'pj-sub', 'data-kar-sent': '' }, `отзывов в этом круге: ${k.sent} из ${k.size}`)),
        el('div', { class: 'm3-bigclock', 'data-kar-clock': '' }, mmss(k.ends - Date.now() - P.skew)),
        el('div', { class: 'm1-watch on' }, el('i', { 'data-kar-bar': '', style: `width:${100 * Math.max(0, k.ends - Date.now() - P.skew) / (k.sec * 1000)}%` })),
        el('p', { class: 'pj-sub' }, 'Сыграй, отправь короткий отзыв. Звук — и игра уходит дальше по кругу.'), ring(k),
        el('div', { class: 'row' }, el('button', { class: 'btn', type: 'button', 'data-kar': 'next', onclick: () => act({ action: 'next' }) }, '⏭ Следующий круг сейчас'),
          el('button', { class: 'btn ghost small', type: 'button', 'data-kar': 'end', onclick: () => act({ action: 'end' }) }, '■ Закончить'))));
    }
    // часы: каждую секунду — таймер; конец круга — свежее состояние с сервера
    P.tick = setInterval(() => {
      if (!host.isConnected) { clearInterval(P.tick); return; }
      const k = P.k; if (!k || k.phase !== 'run') return;
      const left = k.ends - Date.now() - P.skew, c = host.querySelector('[data-kar-clock]'), b = host.querySelector('[data-kar-bar]');
      if (c) c.textContent = mmss(left); if (b) b.style.width = `${100 * Math.max(0, left) / (k.sec * 1000)}%`;
      if (left <= 0) load();
    }, 1000);
    load();
    return { event() { load(); }, refresh() { if (!P.k || P.k.phase !== 'run') load(); }, destroy() { clearInterval(P.tick); host.replaceChildren(); } };
  }
  window.LabStepsM3 = { karuselPult };

  if (typeof STEPS === 'undefined') return;
  // шаг karusel: свой таймер круга, игра соседа в рамке, отзыв на одну строку; в конце — сводка отзывов на свою игру
  // поля: feelings — чувства, fixes — «что поправить», minutes (4), rounds (5)
  STEPS.karusel = ctx => {
    const st = ctx.step;
    let v = Object.assign({ given: 0, notes: {}, played: {} }, ctx.value);
    let K = null, skew = 0, frame = null, frameKey = null, tick = 0, form = { feel: null, fix: null, text: '' }, formRound = null;
    const host = el('div', { class: 'stack m3-kar' }), head = el('div', { class: 'stack' }), stage = el('div', { class: 'stack' }), fb = el('div', { class: 'stack' }), mine = el('div', { class: 'stack' });
    const left = () => (K && K.ends ? K.ends - Date.now() - skew : 0);
    async function load() {
      try { K = (await api('/api/karusel')).karusel; skew = K.now - Date.now(); } catch (e) { head.replaceChildren(el('p', { class: 'err' }, e.message)); return; }
      paint();
    }
    function finish() { if (!ctx.done) ctx.save(v, true, true); }
    function paintHead() {
      if (!K || !K.phase) {
        head.replaceChildren(el('div', { class: 'm2-wait' }, el('span', { class: 'ic', 'aria-hidden': 'true' }, '🎠'),
          el('div', {}, el('b', {}, 'Карусель запустит учитель'), el('p', { class: 'small muted' }, `Каждые ${st.minutes || 4} минуты игра уходит следующему по кругу. ${st.rounds || 5} игр — ${st.rounds || 5} коротких отзывов. Свою игру не играешь.`))));
        return;
      }
      if (K.phase === 'end') { head.replaceChildren(el('div', { class: 'eyebrow' }, `🎠 Карусель закончена · ты дал отзывов: ${K.given}`)); return; }
      const pips = el('div', { class: 'm3-pips', 'aria-hidden': 'true' }, [...Array(K.rounds).keys()].map(i => el('i', { class: i < K.round ? 'ok' : i === K.round ? 'on' : '' })));
      head.replaceChildren(el('div', { class: 'row m1-clockrow' }, el('span', { class: 'eyebrow' }, `Круг ${K.round + 1} из ${K.rounds}`), pips, el('span', { class: 'grow' }),
        el('b', { class: 'm1-clock', 'data-kar-left': '' }, mmss(left()))),
      el('div', { class: 'm1-watch on' }, el('i', { 'data-kar-bar': '', style: `width:${100 * Math.max(0, left()) / (K.sec * 1000)}%` })));
    }
    function paintStage() {
      const tg = K && K.phase === 'run' ? K.target : null, key = tg ? `${K.round}:${tg.id}:${tg.version}` : null;
      if (key === frameKey) return;
      frameKey = key;
      if (frame) { frame.destroy(); frame = null; }
      if (!tg) { stage.replaceChildren(); return; }
      const r = K.round;
      frame = Games.frame({ src: () => `/play/${tg.id}/${tg.version}`, key: () => 'karusel:' + tg.id, info: () => ({ version: tg.version }), label: `Играть: «${tg.title}»`,
        onOver: () => { v.played[r] = (v.played[r] || 0) + 1; ctx.save(v); paintForm(); },
        onError: err => { v.played[r] = v.played[r] || 0.5; ctx.save(v); paintForm(); frame && frame.message(el('div', { class: 'stack', style: 'align-items:center' }, el('b', {}, 'Игра упала: ' + (err.message || 'ошибка')), el('p', { class: 'muted small' }, 'Так и напиши в отзыве — автору это важно.'))); } });
      stage.replaceChildren(el('div', { class: 'row' }, el('h3', { class: 'grow', 'data-kar-title': '' }, `«${tg.title}»`), el('span', { class: 'muted small' }, `автор: ${tg.nick}`)), frame.box, Games.bar(frame));
    }
    function chips(list, cur, onPick, cls, attr) {
      return el('div', { class: cls, role: 'radiogroup' }, list.map(x => el('button', { type: 'button', class: (cls === 'emos' ? 'emo' : 'cardopt') + (cur === x ? ' on' : ''), 'aria-pressed': String(cur === x), [attr]: x, onclick: () => onPick(cur === x ? null : x) }, x)));
    }
    function paintForm() {
      if (!K || K.phase !== 'run' || !K.target) { fb.replaceChildren(); return; }
      if (formRound !== K.round) { formRound = K.round; form = Object.assign({ feel: null, fix: null, text: '' }, K.sent || {}); }
      const r = K.round, played = v.played[r] || 0;
      const inp = el('input', { type: 'text', maxlength: 160, id: 'f-' + st.id + 'text', placeholder: 'Одна строка своими словами (необязательно)', value: form.text || '' });
      inp.addEventListener('input', () => { form.text = inp.value; });
      const send = el('button', { type: 'button', class: 'btn', 'data-kar': 'send', onclick: async () => {
        if (!played) { toast('Сначала сыграй хотя бы одну партию'); return; }
        if (!form.feel && !form.fix && !(form.text || '').trim()) { toast('Выбери чувство или напиши строку'); return; }
        send.disabled = true;
        try {
          const tg = K.target;
          K = (await api('/api/karusel/note', { round: r, game: tg.id, feel: form.feel, fix: form.fix, text: form.text })).karusel;
          // game — последняя игра круга: шаг с about: 'karusel' (UX-аудит урока 24) берёт её, как игру соседа из шага arcade
          v.notes[r] = { game: tg.title, feel: form.feel, fix: form.fix, text: form.text }; v.game = tg.id; v.title = tg.title; v.given = K.given; ctx.save(v, ctx.done || v.given >= Math.min(3, K.rounds));
          beep('good'); paint();
        } catch (e) { toast(e.message, 'err'); send.disabled = false; if (/сменился|закончилась/.test(e.message)) load(); }
      } }, K.sent ? 'Отправить заново' : 'Отправить отзыв');
      fb.replaceChildren(el('div', { class: 'stack ptform' },
        el('div', { class: 'eyebrow' }, 'Что ты чувствовал? Одна кнопка'), chips(st.feelings || [], form.feel, x => { form.feel = x; beep('tick'); paintForm(); }, 'emos', 'data-kar-feel'),
        el('div', { class: 'eyebrow' }, 'Что поправить первым?'), chips(st.fixes || [], form.fix, x => { form.fix = x; beep('tick'); paintForm(); }, 'cardopts', 'data-kar-fix'),
        inp, el('div', { class: 'row' }, send, K.sent ? el('span', { class: 'tag ok' }, 'отзыв ушёл автору') : played ? null : el('span', { class: 'muted small' }, 'сначала партия'))));
    }
    function paintMine() {
      if (!K || !K.phase) { mine.replaceChildren(); return; }
      if (!K.inRing) { mine.replaceChildren(el('p', { class: 'muted small' }, 'Твоей игры этого урока нет в круге: ты играешь и пишешь отзывы другим.')); return; }
      mine.replaceChildren(K.phase === 'end' ? summaryBox(K.mine) : el('p', { class: 'small muted', 'data-kar-mine': '' }, `Твою «${K.mine.title}» уже оценили: ${K.mine.n}. Сводка — когда карусель закончится.`));
    }
    function paint() {
      paintHead(); paintStage(); paintForm(); paintMine();
      if (K && K.phase === 'end') finish();
    }
    tick = setInterval(() => {
      if (!host.isConnected) { clearInterval(tick); if (frame) frame.destroy(); return; }
      if (!K || K.phase !== 'run') return;
      const l = left(), c = host.querySelector('[data-kar-left]'), b = host.querySelector('[data-kar-bar]');
      if (c) c.textContent = mmss(l); if (b) b.style.width = `${100 * Math.max(0, l) / (K.sec * 1000)}%`;
      if (l <= 0) { K.ends = null; load(); }
    }, 1000);
    S.hooks.push(kind => { if (kind === 'karusel' && host.isConnected) load(); });
    host.append(head, stage, fb, mine,
      el('div', {}, el('button', { class: 'btn ghost small', type: 'button', onclick: () => { if (!v.given && !(K && K.phase === 'end')) { toast('Сначала отправь хотя бы один отзыв'); return; } ctx.save(v, true); } }, 'Готово, дальше')));
    head.append(el('p', { class: 'muted' }, 'Загружаем карусель…'));
    load();
    return host;
  };
  // итог шага одной строкой — для «Скопировать результат»
  const prevSummary = window.LabStepsM3Summary;
  window.LabStepsM3Summary = (step, v, a) => {
    if (step.type !== 'karusel') return prevSummary ? prevSummary(step, v, a) : null;
    const notes = Object.values(v.notes || {});
    return notes.length ? `отзывов: ${notes.length}; ` + notes.map(n => `«${n.game}»: ${[n.feel, n.fix, n.text].filter(Boolean).join(', ')}`).join('; ') : 'отзывов нет';
  };
})();
