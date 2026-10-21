// Шаги модуля 2 «Ощущение игры» (уроки 5–8, аудит 21.10.2026, сессия 4). Подключается после student.js и steps-m1.js,
// берёт его помощники (S, Games) и библиотеку сцен MOTION из steps-m4.js. На проекторе файл тоже грузится — ради сцен театра (В5).
// Сцены теории с переключателями (В1): край прыжка и дуга прыжка, незаметные помощники (урок 5); сочный удар по одному приёму,
// мера сочности, две копии «Ледолома» (урок 6); танец без звука, задержка звука, ухо быстрее глаза, запись партии, окна попадания (урок 7);
// окно тайминга по этажам, когда нажать, три приёма на одном нажатии, ограничение (урок 8).
// Форматы поиска спрятанной механики (Г2) — части шага secret из student.js:
//   petlya   — видео-петля: записанная партия донора крутится сценой, ученик смотрит медленно (×½, ×¼, по кадрам) и находит приём;
//   sabotazh — саботаж: учитель на проекторе тайно поворачивает одну ручку донора, класс угадывает с ноутбуков какую, ответ — после «Раскрыть».
// Тип шага (Г1): bumaga — бумажная игра без компьютера: правила, таймер, метроном портала, потом вопрос классу.
'use strict';
(function () {
  const M = window.LabMotion;
  if (!M) return;
  const { MOTION } = M;
  const { TAU, clamp, seg, io, ob, lerp, rr, text, disc, glow, arrow, confetti, hero } = M.kit;
  const calm = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  function caption(g, big, small, col = '#ffe08a', y = 268) {
    fit(g, big, 320, small ? y - 9 : y, 620, col, 18);
    if (small) fit(g, small, 320, y + 13, 620, '#9aa3c7', 13, 'center', 600);
  }
  // время сцены после переключателя: сцена начинается заново, когда ученик щёлкнул (ctl._t), иначе — с начала шага
  const since = (t, c) => (c && c._t < 90 ? c._t : t);
  const MEM = new WeakMap();
  const mem = (g, t, init) => { let m = MEM.get(g); if (!m || t < m.t - 0.5) { m = Object.assign({ t }, init()); MEM.set(g, m); } return m; };
  // дуга прыжка от (x0, y0) к (x1, y1) высотой h; a — доля пути до вершины (меньше 0,5 — подъём короче падения)
  function arcY(f, y0, y1, h, a = 0.5) {
    const top = Math.min(y0, y1) - h;
    return f < a ? top + (y0 - top) * Math.pow((a - f) / a, 2) : top + (y1 - top) * Math.pow((f - a) / (1 - a), 2);
  }
  // пометка-плашка: ✓ зелёная или ✗ красная
  function tag(g, ok, s, x, y, w = 200) { rr(g, x - w / 2, y - 15, w, 30, 12, ok ? 'rgba(124,245,168,.14)' : 'rgba(255,93,110,.14)', ok ? '#7cf5a8' : '#ff5d6e'); fit(g, (ok ? '✓ ' : '✗ ') + s, x, y, w - 14, ok ? '#7cf5a8' : '#ff8a8a', 14); }
  // нажатие кнопки: клавиша-пробел с подписью
  function press(g, x, y, s, k = 1) { if (k <= 0) return; g.save(); g.globalAlpha = Math.min(1, k); rr(g, x - 26, y - 11, 52, 22, 6, '#24304f', '#ffd23f'); text(g, '␣', x, y + 1, '#ffd23f', 14); if (s) text(g, s, x, y - 22, '#ffd23f', 12, 'center', 700); g.restore(); }
  const num = v => String(v).replace('.', ',');
  // горы и река урока 5: фон «Тура над Хаджохом»
  function gorge(g, W, H) {
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#18305a'); gr.addColorStop(1, '#0b1020'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = '#1d2b4a'; g.beginPath(); g.moveTo(0, 150); [[80, 70], [170, 120], [260, 50], [380, 110], [470, 60], [560, 100], [640, 70], [640, 240], [0, 240]].forEach(([x, y]) => g.lineTo(x, y)); g.fill();
    g.fillStyle = '#1f5f8f'; g.fillRect(0, 222, W, 22); g.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i < 8; i++) g.fillRect(i * 84 + 10, 229, 30, 2);
  }
  const rock = (g, x0, x1, y, col = '#6d5a48') => { rr(g, x0, y, x1 - x0, 222 - y + 6, 6, col); g.fillStyle = '#8fae5a'; g.fillRect(x0, y, x1 - x0, 5); };
  const tur = (g, x, y, sq = 0) => hero(g, x, y - 14, 14, '#e8c79a', 1, sq);

  /* ================= урок 5: отзывчивость ================= */
  // край и буфер: нажатие чуть после края и чуть до приземления. c.koyot — время койота 0,1 с, c.bufer — буфер нажатия 0,12 с
  MOTION['kray-pryzhka'] = (g, t, W, H, c = {}) => {
    gorge(g, W, H);
    const T = since(t, c) % 8.5, ky = !!c.koyot, bf = !!c.bufer;
    rock(g, 30, 250, 150); rock(g, 340, 470, 150); rock(g, 520, 620, 96);
    let x, y = 150, sq = 0;
    // момент 1: край
    if (T < 1.4) x = lerp(60, 250, T / 1.4);
    else if (T < 1.55) { x = lerp(250, 262, (T - 1.4) / 0.15); y = 150 + (T - 1.4) * 40; }
    else if (ky && T < 2.5) { const f = (T - 1.55) / 0.95; x = lerp(262, 390, f); y = arcY(f, 156, 150, 70); }
    else if (!ky && T < 2.3) { x = 262 + (T - 1.55) * 20; y = 156 + Math.pow((T - 1.55) / 0.75, 2) * 70; }
    else if (!ky && T < 3.2) { x = null; }
    else if (T < 3.2) { x = 390; sq = Math.max(0, 0.6 - (T - 2.5) * 2); }
    // момент 2: прыжок на месте и буфер перед приземлением
    if (T >= 3.2 && T < 3.9) { const f = (T - 3.2) / 0.7; x = 390; y = arcY(f, 150, 150, 46); if (!ky && T < 3.4) g.globalAlpha = (T - 3.2) * 5; }
    else if (T >= 3.9 && bf && T < 4.9) { const f = (T - 3.9) / 1; x = lerp(390, 565, f); y = arcY(f, 150, 96, 80); }
    else if (T >= 3.9 && (!bf || T >= 4.9)) { x = bf ? 565 : 390; y = bf ? 96 : 150; sq = Math.max(0, 0.6 - (T - (bf ? 4.9 : 3.9)) * 2); }
    if (x != null) tur(g, x, y, sq);
    g.globalAlpha = 1;
    if (!ky && T > 2.0 && T < 2.6) { emo(g, '💦', 268, 214, 26); }
    // нажатия
    if (T > 1.5 && T < 2.6) { press(g, 262, 92, 'через 0,06 с после края', 1.6 - Math.max(0, T - 2.1) * 2); g.strokeStyle = 'rgba(255,210,63,.6)'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(250, 60); g.lineTo(250, 150); g.stroke(); g.setLineDash([]); }
    if (T > 3.75 && T < 4.6) press(g, 390, 70, 'за 0,08 с до земли', 1.6 - Math.max(0, T - 4.1) * 2);
    if (T > 2.5 && T < 3.3) tag(g, ky, ky ? 'Прыгнул: игра простила миг' : 'Сорвался: нажатие «проглочено»', 320, 36, 300);
    if (T > 4.3 && T < 6.6) tag(g, bf, bf ? 'Прыгнул сразу, как коснулся земли' : '«Я же нажал!» — прыжка нет', 430, 36, 320);
    if (T >= 6.6) {
      const k = ob(seg(T, 6.6, 7.0));
      g.save(); g.globalAlpha = k;
      rr(g, 120, 24, 400, 92, 14, 'rgba(11,16,32,.88)', '#3a4880');
      tag(g, ky, ky ? 'У края: время койота 0,1 с' : 'У края: койота нет — сорвался', 320, 50, 360);
      tag(g, bf, bf ? 'После прыжка: буфер 0,12 с' : 'После прыжка: буфера нет — нажатие потеряно', 320, 90, 360);
      g.restore();
    }
    if (ky && bf) caption(g, 'Игра слушает намерение, а не миллисекунды', 'нажал чуть мимо — и всё равно прыгнул');
    else caption(g, 'Без помощника игра «глотает» нажатия', ky || bf ? 'включи второй — и сравни' : 'включи 1 и 2 — помощники вернутся', '#ff8a8a');
  };
  // дуга прыжка: c.padenie — вниз быстрее, чем вверх; c.otpustil — отпустил кнопку, прыжок ниже
  MOTION['duga-pryzhka'] = (g, t, W, H, c = {}) => {
    gorge(g, W, H);
    const T = since(t, c) % 6.4, fast = !!c.padenie, cut = !!c.otpustil;
    rock(g, 20, 620, 200); rr(g, 210, 92, 130, 34, 8, '#6d5a48'); g.fillStyle = '#4b3d31'; g.fillRect(210, 120, 130, 6);
    rock(g, 470, 610, 112);
    const a = fast ? 0.64 : 0.5, low = cut ? 52 : 118, dur = fast ? 0.95 : 1.3;
    // пути пунктиром: короткий прыжок под скалой и высокий на уступ
    const path = (x0, x1, y0, y1, h, upto = 1) => { g.beginPath(); for (let i = 0; i <= 40 * upto; i++) { const f = i / 40, xx = lerp(x0, x1, f), yy = arcY(f, y0, y1, h, a) - 14; i ? g.lineTo(xx, yy) : g.moveTo(xx, yy); } g.stroke(); };
    g.setLineDash([3, 6]); g.lineWidth = 2;
    const bump = !cut; // высокий прыжок под скалой упирается в неё
    const hitF = bump ? 0.36 : 1;
    g.strokeStyle = 'rgba(255,224,138,.45)'; path(140, 360, 200, 200, low, hitF);
    g.strokeStyle = 'rgba(124,245,168,.45)'; path(380, 540, 200, 112, 140);
    g.setLineDash([]);
    let x = 140, y = 200, sq = 0;
    if (T < 0.3) { x = lerp(110, 140, T / 0.3); }
    else if (T < 0.3 + dur) {
      const f = (T - 0.3) / dur;
      if (bump && f > hitF) { const k = (f - hitF) / (1 - hitF); x = lerp(140, 360, hitF) + k * 10; y = lerp(arcY(hitF, 200, 200, low, a), 200, k * k); if (k < 0.3) emo(g, '💥', x, 128, 22); }
      else { x = lerp(140, 360, f); y = arcY(f, 200, 200, low, a); }
    } else if (T < 2.6) { const k = (T - 0.3 - dur) / (2.6 - 0.3 - dur); x = lerp(bump ? 220 : 360, 380, Math.min(1, k * 1.4)); sq = Math.max(0, 0.5 - k * 3); }
    else if (T < 2.6 + dur * 1.1) { const f = (T - 2.6) / (dur * 1.1); x = lerp(380, 540, f); y = arcY(f, 200, 112, 140, a); }
    else { x = 540; y = 112; sq = Math.max(0, 0.6 - (T - 2.6 - dur * 1.1) * 2); }
    tur(g, x, y, sq);
    press(g, 140, 60, cut ? 'короткое нажатие' : 'короткое — а прыжок полный', T > 0.2 && T < 1.6 ? 1 : 0);
    press(g, 430, 50, 'держу пробел', T > 2.5 && T < 3.8 ? 1 : 0);
    text(g, `в воздухе ${num(fast ? 0.7 : 0.9)} с`, 560, 70, fast ? '#7cf5a8' : '#ffb547', 13, 'center', 700);
    if (!cut) caption(g, 'Отпустил кнопку — а тур всё летит вверх', 'под нависающей скалой коротко не прыгнуть', '#ff8a8a');
    else if (!fast) caption(g, 'Вниз так же медленно, как вверх — прыжок «плывёт»', 'как воздушный шарик: приземление трудно угадать', '#ffb547');
    else caption(g, 'Вверх — сколько держишь, вниз — камнем', 'прыжок тяжёлый и точный');
  };
  // незаметные помощники в пробежке: c.pokazat — подсветить, где сработали койот и буфер
  MOTION['pomoshchniki'] = (g, t, W, H, c = {}) => {
    gorge(g, W, H);
    const T = since(t, c) % 7, show = !!c.pokazat;
    rock(g, 20, 172, 170); rock(g, 240, 360, 170); rock(g, 452, 620, 170);
    let x = 40, y = 170, sq = 0;
    if (T < 1) { x = lerp(40, 184, T); y = x > 172 ? 170 + (x - 172) * 0.3 : 170; }
    else if (T < 1.8) { const f = (T - 1) / 0.8; x = lerp(184, 290, f); y = arcY(f, 174, 170, 62); }
    else if (T < 2.1) { x = lerp(290, 300, (T - 1.8) / 0.3); sq = Math.max(0, 0.5 - (T - 1.8) * 3); }
    else if (T < 2.6) { const f = (T - 2.1) / 0.5; x = lerp(300, 335, f); y = arcY(f, 170, 170, 30); }
    else if (T < 3.5) { const f = (T - 2.6) / 0.9; x = lerp(335, 490, f); y = arcY(f, 170, 170, 72); }
    else if (T < 4.6) { x = lerp(490, 600, (T - 3.5) / 1.1); sq = T < 3.7 ? 0.4 : 0; }
    else { x = 600; }
    let saved = 0;
    if (T > 1) saved++; if (T > 2.6) saved++;
    if (show) {
      g.fillStyle = 'rgba(255,210,63,.22)'; g.fillRect(172, 120, 16, 50); text(g, 'койот 0,1 с', 180, 110, '#ffd23f', 12, 'center', 700);
      g.fillStyle = 'rgba(95,224,255,.2)'; g.fillRect(318, 140, 34, 30); text(g, 'буфер 0,12 с', 335, 130, '#5fe0ff', 12, 'center', 700);
      if (T > 0.95 && T < 1.5) emo(g, '🐺', 196, 92, 22);
      if (T > 2.45 && T < 3) emo(g, '🧲', 352, 112, 20);
      rr(g, 470, 18, 150, 40, 10, '#141c36', '#ffd23f'); text(g, `спасено нажатий: ${saved}`, 545, 38, '#ffd23f', 14);
    }
    tur(g, x, y, sq);
    if (T > 4.6) emo(g, '🏠', 600, 120, 30);
    if (show) caption(g, 'Два спасения за пробежку — игрок не видел ни одного', 'время койота у края и буфер перед приземлением');
    else caption(g, 'Игрок видит только: «я успел!»', 'включи «Показать помощников» — и увидишь, кто помог', '#9aa3c7');
  };

  /* ================= урок 6: сочность ================= */
  const JUICE5 = [['stop', '⏸'], ['tryaska', '📳'], ['chasticy', '✨'], ['szhatie', '🫧'], ['zvuk', '🔊']];
  function cave(g, W, H) { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#132447'); gr.addColorStop(1, '#0a1226'); g.fillStyle = gr; g.fillRect(-20, -20, W + 40, H + 40); }
  const brick = (g, x, y, w = 74, h = 24, col = '#9fe3ff', k = 1) => { if (k <= 0) return; g.save(); g.translate(x, y); g.scale(k, k); rr(g, -w / 2, -h / 2, w, h, 6, col, 'rgba(255,255,255,.5)'); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(-w / 2 + 6, -h / 2 + 4, w * 0.4, 4); g.restore(); };
  function ball(g, x, y, sx = 1, sy = 1, glowOn = false) { if (glowOn) glow(g, x, y, 34, 'rgba(255,170,60,.7)'); g.save(); g.translate(x, y); g.scale(sx, sy); disc(g, 0, 0, 11, '#ffb547'); disc(g, -3, -3, 4, '#ffe08a'); g.restore(); }
  const paddle = (g, x, y, sq = 0) => { g.save(); g.translate(x, y); g.scale(1 + sq * 0.2, 1 - sq * 0.4); rr(g, -50, -7, 100, 14, 7, '#c9a27a', '#f2efe6'); g.restore(); };
  // один удар хычина по льду, сочность — по одному приёму: c.stop, c.tryaska, c.chasticy, c.szhatie, c.zvuk
  MOTION['sochny-udar'] = (g, t, W, H, c = {}) => {
    const P = 2.6, loop = Math.floor(t / P), T = t % P, on = JUICE5.filter(([id]) => c[id]).map(([id]) => id), n = on.length;
    const hit = 0.9, freeze = c.stop ? 0.12 : 0, te = T < hit ? T : T < hit + freeze ? hit : T - freeze, dt = T - hit;
    let ox = 0, oy = 0;
    if (c.tryaska && dt > 0 && dt < 0.32) { const k = 1 - dt / 0.32; ox = Math.sin(dt * 90) * 8 * k; oy = Math.cos(dt * 70) * 6 * k; }
    g.save(); g.translate(ox, oy);
    cave(g, W, H);
    const bx = [92, 168, 244, 320, 396, 472, 548];
    bx.forEach((x, i) => { if (i === 3) return; brick(g, x, 62); brick(g, x, 92, 74, 24, '#7cc9f0'); });
    // целевой кирпич: пропадает на ударе; сжатие — подскок и лопается; стоп-кадр — белеет
    if (te < hit) brick(g, 320, 92, 74, 24, '#7cc9f0');
    else if (c.stop && T < hit + freeze) brick(g, 320, 92, 74, 24, '#ffffff');
    else if (c.szhatie && dt < freeze + 0.14) brick(g, 320, 92, 74, 24, '#cfefff', 1 + (dt - freeze) * 2);
    brick(g, 320, 62);
    // хычин: вверх от лопаты, удар, вниз
    const up = seg(te, 0.2, hit), down = seg(te, hit, 1.7);
    const by = te < hit ? lerp(226, 106, up) : lerp(106, 226, down);
    let sx = 1, sy = 1;
    if (c.szhatie) {
      if (dt >= 0 && dt < freeze + 0.12) { sx = 1.45; sy = 0.62; }
      else if ((te > 0.25 && te < hit) || (te > hit && te < 1.65)) { sx = 0.86; sy = 1.18; }
    }
    if (te > 0.15) ball(g, 320, by, sx, sy);
    paddle(g, 320, 238, c.szhatie && (T < 0.32 || (T > 1.7 + freeze && T < 1.95 + freeze)) ? 0.7 : 0);
    // частицы льда
    if (c.chasticy && dt > freeze) {
      const k = (dt - freeze);
      for (let i = 0; i < 14; i++) { const a = -Math.PI * (0.1 + 0.8 * ((i * 37) % 14) / 14), v = 90 + (i * 53) % 80; const px = 320 + Math.cos(a) * v * k, py = 92 + Math.sin(a) * v * k * -1 + 260 * k * k; if (k < 0.9) { g.globalAlpha = 1 - k; g.fillStyle = i % 2 ? '#cfefff' : '#9fe3ff'; g.fillRect(px - 3, py - 3, 6, 6); g.globalAlpha = 1; } }
    }
    // звук: волны и нота, с каждым ударом выше
    if (c.zvuk && dt >= 0 && dt < 0.7) {
      const k = dt / 0.7; g.strokeStyle = `rgba(255,224,138,${1 - k})`; g.lineWidth = 3;
      for (let r = 0; r < 3; r++) { g.beginPath(); g.arc(320, 92, 20 + (k * 80) + r * 14, -Math.PI * 0.9, -Math.PI * 0.1); g.stroke(); }
      const notes = ['до', 'ре', 'ми', 'фа', 'соль'];
      text(g, `♪ дзынь — ${notes[loop % 5]} ↑`, 430, 150 - k * 20, `rgba(255,224,138,${1 - k * 0.8})`, 16);
      const m = mem(g, t, () => ({ loop: -1 }));
      if (m.loop !== loop && !calm() && !window.LAB_LOWRES && !window.LAB_FAST && window.Lab && Lab.beep) { m.loop = loop; try { Lab.beep('tick'); } catch (e) { /* без звука */ } }
    }
    g.restore();
    // счётчик приёмов
    rr(g, 14, 128, 132, 64, 10, 'rgba(11,16,32,.8)', '#3a4880'); text(g, `эффектов: ${n} из 5`, 80, 146, n ? '#7cf5a8' : '#9aa3c7', 13);
    JUICE5.forEach(([id, ic], i) => { g.globalAlpha = c[id] ? 1 : 0.25; emo(g, ic, 32 + i * 24, 172, 17); g.globalAlpha = 1; });
    if (!n) caption(g, 'Сухой удар: кирпич просто пропал', 'включай приёмы по одному: 1–5');
    else if (n < 5) caption(g, 'Тот же удар, правила те же — а чувствуется сильнее', `включено ${n} из 5: какой дал больше всего?`, '#7cf5a8');
    else caption(g, 'Сочно! Механика не изменилась ни на строчку', 'стоп-кадр, тряска, частицы, сжатие и звук', '#7cf5a8');
  };
  // мера сочности: c.perebor — эффекты ×10, вспышка прячет мяч
  MOTION['mera-sochnosti'] = (g, t, W, H, c = {}) => {
    const T = since(t, c) % 3.2, big = !!c.perebor, hit = 0.8, dt = T - hit;
    let ox = 0, oy = 0;
    if (dt > 0 && dt < (big ? 0.9 : 0.25)) { const k = 1 - dt / (big ? 0.9 : 0.25); ox = Math.sin(dt * 80) * (big ? 22 : 4) * k; oy = Math.cos(dt * 60) * (big ? 16 : 3) * k; }
    g.save(); g.translate(ox, oy);
    cave(g, W, H);
    [92, 168, 244, 396, 472, 548].forEach(x => brick(g, x, 62));
    // мяч: вверх, удар, вниз мимо лопаты при переборе
    const miss = big;
    const bx = T < hit ? lerp(320, 340, T / hit) : lerp(340, miss ? 470 : 380, seg(T, hit, 2.2)), by = T < hit ? lerp(226, 80, T / hit) : lerp(80, miss ? 300 : 226, seg(T, hit, 2.2));
    ball(g, bx, by);
    if (dt > 0) {
      const k = dt;
      if (big) {
        for (let i = 0; i < 70; i++) { const a = (i * 2.39) % TAU, v = 60 + (i * 37) % 160, px = 340 + Math.cos(a) * v * k * 1.4, py = 80 + Math.sin(a) * v * k + 120 * k * k; if (k < 1.6) { g.globalAlpha = Math.max(0, 1 - k / 1.6); g.fillStyle = ['#ffd23f', '#ff5d6e', '#5fe0ff', '#ffffff', '#b49bff'][i % 5]; g.fillRect(px - 5, py - 5, 10, 10); } }
        g.globalAlpha = 1;
        if (k < 0.5) { g.fillStyle = `rgba(255,255,255,${0.75 * (1 - k * 2)})`; g.fillRect(-20, -20, W + 40, H + 40); }
        if (k < 1.4) text(g, '+100 СУПЕР!!!', 340, 150 - k * 20, '#ffd23f', 34 - k * 4);
      } else if (k < 0.5) {
        for (let i = 0; i < 10; i++) { const a = -Math.PI * (0.15 + 0.7 * i / 9), px = 340 + Math.cos(a) * 70 * k, py = 80 - Math.sin(a) * 60 * k + 200 * k * k; g.globalAlpha = 1 - k * 2; g.fillStyle = '#cfefff'; g.fillRect(px - 3, py - 3, 6, 6); }
        g.globalAlpha = 1;
      }
    }
    paddle(g, 380, 238);
    g.restore();
    if (big && T > 2.0) tag(g, false, 'Мяч потерян в салюте', 320, 36, 260);
    if (big) caption(g, 'Перебор: вспышка прячет мяч — это уже шум', 'видно = правда: эффект служит главному', '#ff8a8a');
    else caption(g, 'В меру: удар чувствуется, а мяч видно всегда', 'эффект служит главному');
  };
  // слепая проба: две копии без подписей, класс выбирает, куда вернуться; c.podpisi — открыть, где какая
  MOTION['dva-ledoloma'] = (g, t, W, H, c = {}) => {
    bg(g, W, H);
    const T = t % 2.4, labels = !!c.podpisi, hit = 0.8, dt = T - hit;
    [[20, true], [330, false]].forEach(([x0, juicy]) => {
      g.save(); g.beginPath(); g.rect(x0, 30, 290, 190); g.clip();
      let ox = 0; if (juicy && dt > 0 && dt < 0.25) ox = Math.sin(dt * 90) * 5 * (1 - dt / 0.25);
      g.translate(ox, 0);
      const gr = g.createLinearGradient(0, 30, 0, 220); gr.addColorStop(0, '#132447'); gr.addColorStop(1, '#0a1226'); g.fillStyle = gr; g.fillRect(x0, 30, 290, 190);
      [x0 + 50, x0 + 110, x0 + 180, x0 + 240].forEach(x => brick(g, x, 60, 52, 18));
      if (T < hit) brick(g, x0 + 145, 84, 52, 18, '#7cc9f0');
      const by = T < hit ? lerp(200, 96, T / hit) : lerp(96, 200, seg(T, hit, 1.8));
      ball(g, x0 + 145, by, juicy && dt > 0 && dt < 0.1 ? 1.4 : 1, juicy && dt > 0 && dt < 0.1 ? 0.65 : 1, juicy);
      if (juicy && dt > 0 && dt < 0.6) for (let i = 0; i < 10; i++) { const a = -Math.PI * (0.1 + 0.8 * i / 9), px = x0 + 145 + Math.cos(a) * 60 * dt, py = 84 - Math.sin(a) * 50 * dt + 160 * dt * dt; g.globalAlpha = 1 - dt / 0.6; g.fillStyle = '#cfefff'; g.fillRect(px - 3, py - 3, 6, 6); g.globalAlpha = 1; }
      paddle(g, x0 + 145, 210);
      g.restore();
      rr(g, x0, 30, 290, 190, 12, null, labels ? (juicy ? '#7cf5a8' : '#9aa3c7') : '#3a4880');
      text(g, labels ? (juicy ? 'Сочная: 12 переключателей' : 'Сухая: всё выключено') : (juicy ? 'Копия А' : 'Копия Б'), x0 + 145, 16, labels ? (juicy ? '#7cf5a8' : '#9aa3c7') : '#f2efe6', 14);
    });
    // голоса класса: куда хочется вернуться
    const k = io(seg(t, 0.5, 4)), a = Math.round(21 * k), b = Math.round(6 * k);
    text(g, `♥ ${a}`, 165, 234, '#ff8fa0', 15); text(g, `♥ ${b}`, 475, 234, '#ff8fa0', 15);
    if (labels) caption(g, 'Выбирают сочную — даже не замечая эффектов', 'если разницы нет, сочности мало', '#7cf5a8', 272);
    else caption(g, 'Слепая проба: куда хочется вернуться?', 'включи «Подписи» — где какая копия', '#ffe08a', 272);
  };

  /* ================= урок 7: звук и обратная связь ================= */
  // аул на джэгу: фонари мигают в долю (k — яркость), земля, танцор и кувшины
  function aul(g, W, H, lamp = 0, ground = 206) {
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1b1640'); gr.addColorStop(1, '#0b1020'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 6; i++) { const x = 50 + i * 110; g.strokeStyle = '#3a3360'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 40); g.lineTo(x, 70); g.stroke(); glow(g, x, 74, 22 + lamp * 26, `rgba(255,210,63,${0.25 + lamp * 0.6})`); disc(g, x, 74, 7, lamp > 0.4 ? '#fff3b0' : '#c9a24a'); }
    g.fillStyle = '#2a2040'; g.fillRect(0, ground, W, H - ground);
    g.fillStyle = '#3a2d55'; for (let i = 0; i < 16; i++) g.fillRect(i * 44, ground, 22, 3);
  }
  const dancer = (g, x, y, sq = 0) => hero(g, x, y - 15, 15, '#ff8fa0', 1, sq);
  const jug = (g, x, y) => { g.fillStyle = '#c8743a'; g.beginPath(); g.ellipse(x, y - 13, 12, 14, 0, 0, TAU); g.fill(); g.fillStyle = '#a85a28'; g.fillRect(x - 5, y - 32, 10, 8); };
  const lampAt = (T, beats) => { let k = 0; beats.forEach(b => { const d = T - b; if (d >= 0 && d < 0.35) k = Math.max(k, 1 - d / 0.35); }); return k; };
  // загадка без слов: три прыжка через кувшины без звука; c.reveal — подписать, какой попал в долю
  MOTION['tanec-bez-zvuka'] = (g, t, W, H, c = {}) => {
    const T = t % 9.6, X = 200, V = 190, G = 206;
    const beats = []; for (let b = 0.75; b < 9.6; b += 0.75) beats.push(b);
    aul(g, W, H, lampAt(T, beats), G);
    const JB = [1.5, 4.5, 7.5], OFF = [-0.18, 0, 0.15], LBL = ['рано на 0,18 с', 'идеально', 'поздно на 0,15 с'], OK = [false, true, false];
    JB.forEach(b => { const x = X + (b - T) * V; if (x > -30 && x < W + 30) jug(g, x, G); });
    let y = G, sq = 0;
    JB.forEach((b, i) => { const apex = b + OFF[i], f = (T - (apex - 0.32)) / 0.64; if (f >= 0 && f <= 1) y = G - 4 * 70 * f * (1 - f); if (f > 1 && f < 1.4) sq = 0.5 * (1.4 - f) / 0.4; });
    dancer(g, X, y, sq);
    JB.forEach((b, i) => {
      const k = seg(T, b - 0.5, b - 0.3);
      if (k > 0 && T < b + 1.6) { text(g, String(i + 1), X, 112, '#f2efe6', 26); }
      if (c.reveal && T > b + 0.3 && T < b + 2.2) tag(g, OK[i], LBL[i], X + 170, 130, 220);
    });
    text(g, '🔇', 600, 24, '#f2efe6', 20);
    if (c.reveal) caption(g, 'Второй — точно в долю: фонари вспыхнули над кувшином', 'со звуком ты услышал бы сразу: «идеально» звучит в тон', '#7cf5a8', 262);
    else caption(g, 'Смотри молча: фонари мигают в долю', 'три прыжка через кувшины', '#9aa3c7', 262);
  };
  // задержка звука против картинки: c.delay — секунды (0, 0,1, 0,25, 0,5) или да/нет из театра сцены
  MOTION['zaderzhka-zvuka'] = (g, t, W, H, c = {}) => {
    const d = typeof c.delay === 'number' ? c.delay : c.delay ? 0.25 : 0;
    const T = t % 3, beat = 1.5, X = 170, V = 170, G = 150;
    aul(g, W, 300, lampAt(T, [0.75, 1.5, 2.25]), G);
    const jx = X + (beat - T) * V; jug(g, jx, G);
    const f = (T - (beat - 0.3)) / 0.6; const y = f >= 0 && f <= 1 ? G - 4 * 55 * f * (1 - f) : G;
    dancer(g, X, y);
    // звук прыжка: волна в момент beat + d
    const ds = T - (beat + d);
    if (ds >= 0 && ds < 0.6) { g.strokeStyle = `rgba(95,224,255,${1 - ds / 0.6})`; g.lineWidth = 3; for (let r = 0; r < 3; r++) { g.beginPath(); g.arc(X, G - 40, 14 + ds * 90 + r * 12, -2.6, -0.5); g.stroke(); } text(g, '♪ хоп', X + 60, G - 80 - ds * 20, '#5fe0ff', 15); }
    // полоса времени: окна вокруг доли, глаз и ухо
    const x0 = 330, x1 = 620, t0 = beat - 0.3, t1 = beat + 0.6, XT = s => lerp(x0, x1, (s - t0) / (t1 - t0));
    rr(g, x0 - 10, 30, x1 - x0 + 20, 120, 12, '#141c36', '#2a3560');
    g.fillStyle = 'rgba(255,210,63,.18)'; g.fillRect(XT(beat - 0.15), 44, XT(beat + 0.15) - XT(beat - 0.15), 60);
    g.fillStyle = 'rgba(124,245,168,.3)'; g.fillRect(XT(beat - 0.06), 44, XT(beat + 0.06) - XT(beat - 0.06), 60);
    text(g, 'идеально', XT(beat), 112, '#7cf5a8', 11, 'center', 700); text(g, 'хорошо', XT(beat + 0.11), 124, '#ffd23f', 11, 'center', 700);
    g.strokeStyle = '#ffd23f'; g.lineWidth = 2; g.beginPath(); g.moveTo(XT(beat), 40); g.lineTo(XT(beat), 108); g.stroke();
    emo(g, '👁', XT(beat), 58, 18); emo(g, '👂', XT(beat + d), 88, 18);
    if (d > 0) arrow(g, XT(beat) + 6, 88, XT(beat + d) - 12, 88, '#5fe0ff', 2);
    // ползунок задержки
    rr(g, 340, 170, 270, 8, 4, '#24304f'); disc(g, lerp(340, 610, d / 0.5), 174, 10, '#5fe0ff');
    text(g, `звук отстаёт на ${num(d)} с`, 475, 196, '#5fe0ff', 14);
    const ear = d <= 0.06 ? 'идеально' : d <= 0.15 ? 'чуть мимо' : 'мимо';
    tag(g, true, 'Глаз: идеально', 105, 30, 170); tag(g, d <= 0.06, 'Ухо: ' + ear, 105, 66, 170);
    if (d === 0) caption(g, 'Звук и картинка вместе — попадание чувствуется', 'поверни «Звук отстаёт» и сравни', '#7cf5a8', 252);
    else if (d <= 0.1) caption(g, 'Всего 0,1 с — а ухо уже слышит «чуть мимо»', 'игрок начнёт жать раньше', '#ffd23f', 252);
    else caption(g, 'Звук врёт: глаз видит «идеально», ухо слышит промах', 'игра и музыка должны идти на одних часах', '#ff8a8a', 252);
  };
  // ухо быстрее глаза: c.shchelchok — щелчок за долю до кувшина
  MOTION['uho-bystree'] = (g, t, W, H, c = {}) => {
    const T = since(t, c) % 4, click = !!c.shchelchok, beat = 2.6, X = 230, V = 180, G = 206;
    aul(g, W, H, lampAt(T, [1.1, 1.85, 2.6, 3.35]), G);
    const jx = X + (beat - T) * V; jug(g, jx, G);
    const late = click ? 0 : 0.14, apex = beat + late, f = (T - (apex - 0.3)) / 0.6, y = f >= 0 && f <= 1 ? G - 4 * 60 * f * (1 - f) : G;
    dancer(g, X, y);
    if (click) { const ds = T - (beat - 0.75); if (ds >= 0 && ds < 0.5) { g.strokeStyle = `rgba(255,224,138,${1 - ds * 2})`; g.lineWidth = 3; g.beginPath(); g.arc(560, 120, 12 + ds * 60, 0, TAU); g.stroke(); text(g, '🔔 щёлк!', 560, 120, '#ffe08a', 15); } if (T > beat - 0.75 && T < beat) text(g, '!', X, G - 50, '#ffe08a', 22); }
    else if (T > beat - 0.35 && T < beat) text(g, '?', X, G - 50, '#9aa3c7', 22);
    if (T > apex + 0.2 && T < 3.9) tag(g, click, click ? 'идеально: готов заранее' : 'хорошо: увидел кувшин — и опоздал', 470, 30, 300);
    // скорость реакции: глаз и ухо
    rr(g, 16, 16, 220, 70, 10, 'rgba(11,16,32,.85)', '#3a4880');
    const k = seg(T, 0.2, 1.2);
    text(g, '👁 на картинку', 26, 36, '#9aa3c7', 12, 'left', 700); rr(g, 130, 30, 96 * Math.min(1, k * 0.17 / 0.25 * 1.47), 10, 4, '#9aa3c7');
    text(g, '👂 на звук', 26, 62, '#5fe0ff', 12, 'left', 700); rr(g, 130, 56, 96 * Math.min(1, k), 10, 4, '#5fe0ff');
    if (k >= 1) { text(g, '≈0,25 с', 196, 46, '#9aa3c7', 10, 'center', 700); text(g, '≈0,17 с', 196, 74, '#5fe0ff', 10, 'center', 700); }
    if (click) caption(g, 'Ухо быстрее глаза: щелчок за долю — и ты готов', 'звук предупреждает раньше картинки', '#7cf5a8', 262);
    else caption(g, 'Без звука ждёшь, пока кувшин станет виден', 'включи «щелчок за долю» и сравни', '#ffd23f', 262);
  };
  // запись партии «Шага в такт» для видео-петли: дорожки долей, звука, кувшинов и нажатий; c.reveal — подписать дорожки
  MOTION['petlya-takt'] = (g, t, W, H, c = {}) => {
    const T = t % 8, X = 160, V = 160, G = 150, B = 0.6;
    const beats = []; for (let b = 0.6; b < 8; b += B) beats.push(Math.round(b * 10) / 10);
    const jugs = [1.8, 3.0, 4.2, 5.4, 6.6], clicks = jugs.map(j => Math.round((j - B) * 10) / 10);
    aul(g, W, 300, lampAt(T, beats), G);
    jugs.forEach(j => { const x = X + (j - T) * V; if (x > -20 && x < W + 20) jug(g, x, G); });
    let y = G; jugs.forEach(j => { const f = (T - (j - 0.28)) / 0.56; if (f >= 0 && f <= 1) y = G - 4 * 52 * f * (1 - f); });
    dancer(g, X, y);
    clicks.forEach(k => { const ds = T - k; if (ds >= 0 && ds < 0.4) { g.strokeStyle = `rgba(255,224,138,${1 - ds / 0.4})`; g.lineWidth = 3; g.beginPath(); g.arc(590, 40, 10 + ds * 50, 0, TAU); g.stroke(); } });
    emo(g, '🔊', 590, 40, 18);
    jugs.forEach(j => { const ds = T - j; if (ds >= 0 && ds < 0.6) text(g, 'идеально', X, 70 - ds * 20, `rgba(124,245,168,${1 - ds / 0.6})`, 14); });
    // дорожки: как в редакторе музыки
    const x0 = 160, x1 = 620, XT = s => lerp(x0, x1, s / 8), rows = [['🥁', beats, '#9aa3c7', 'доли музыки'], ['🔊', clicks, '#ffe08a', 'щелчок'], ['🏺', jugs, '#c8743a', 'кувшин на доле'], ['✋', jugs, '#7cf5a8', 'нажатие']];
    rr(g, 10, 168, 620, 92, 10, '#141c36', '#2a3560');
    rows.forEach(([ic, list, col, lab], i) => {
      const yy = 182 + i * 21; emo(g, ic, 26, yy, 14);
      if (c.reveal) text(g, lab, 44, yy, col, 11, 'left', 700);
      list.forEach(s => { g.fillStyle = col; g.globalAlpha = s <= T ? 1 : 0.45; g.fillRect(XT(s) - 2, yy - 6, 4, 12); g.globalAlpha = 1; });
    });
    if (c.reveal) jugs.forEach((j, i) => { g.strokeStyle = 'rgba(255,224,138,.5)'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(XT(clicks[i]), 189); g.lineTo(XT(j), 210); g.stroke(); g.setLineDash([]); });
    g.strokeStyle = '#ff5d6e'; g.lineWidth = 2; g.beginPath(); g.moveTo(XT(T), 170); g.lineTo(XT(T), 258); g.stroke();
    text(g, `запись партии · ${num(T.toFixed(1))} с`, 20, 20, '#9aa3c7', 12, 'left', 700);
    if (c.reveal) caption(g, 'Игра и музыка на одних часах: щелчок — за долю до кувшина', '', '#7cf5a8', 284);
  };
  // окна попадания: c.zvukokon — у каждого окна свой звук
  MOTION['okna-popadaniya'] = (g, t, W, H, c = {}) => {
    bg(g, W, H);
    const T = since(t, c) % 6.6, own = !!c.zvukokon, x0 = 80, x1 = 560, s0 = -0.3, s1 = 0.3, XT = s => lerp(x0, x1, (s - s0) / (s1 - s0));
    g.fillStyle = 'rgba(255,93,110,.12)'; g.fillRect(x0, 90, x1 - x0, 70);
    g.fillStyle = 'rgba(255,210,63,.22)'; g.fillRect(XT(-0.15), 90, XT(0.15) - XT(-0.15), 70);
    g.fillStyle = 'rgba(124,245,168,.35)'; g.fillRect(XT(-0.06), 90, XT(0.06) - XT(-0.06), 70);
    text(g, 'мимо', XT(-0.23), 176, '#ff8a8a', 12, 'center', 700); text(g, 'хорошо', XT(-0.105), 176, '#ffd23f', 12, 'center', 700); text(g, 'идеально', XT(0), 176, '#7cf5a8', 12, 'center', 700);
    text(g, 'хорошо', XT(0.105), 176, '#ffd23f', 12, 'center', 700); text(g, 'мимо', XT(0.23), 176, '#ff8a8a', 12, 'center', 700);
    g.strokeStyle = '#ffd23f'; g.lineWidth = 2; g.beginPath(); g.moveTo(XT(0), 80); g.lineTo(XT(0), 168); g.stroke(); text(g, 'доля', XT(0), 70, '#ffd23f', 13);
    const P = [[0.02, '♪ в тон', '#7cf5a8', 30], [0.1, '♪ глуше', '#ffd23f', 22], [0.22, '✗ фальшь', '#ff8a8a', 16]];
    P.forEach(([off, snd, col, ring], i) => {
      const at = 0.6 + i * 1.8, k = seg(T, at, at + 0.4); if (k <= 0) return;
      const x = XT(off); emo(g, '✋', x, 125, 22);
      if (T - at < 1.4) {
        const ds = (T - at) / 1.4;
        if (own) { g.strokeStyle = col; g.globalAlpha = 1 - ds; g.lineWidth = 3; g.beginPath(); g.arc(x, 125, 16 + ds * ring * 2, 0, TAU); g.stroke(); g.globalAlpha = 1; text(g, snd, x, 205 + 0 * ds, col, 16); }
        else text(g, '♪ щёлк', x, 205, '#9aa3c7', 16);
      } else { g.fillStyle = own ? col : '#9aa3c7'; disc(g, x, 125, 5, own ? col : '#9aa3c7'); }
    });
    if (own) caption(g, 'У каждого окна свой звук — игрок слышит точность', '«идеально» в тон, «хорошо» глуше, промах — фальшь', '#7cf5a8', 262);
    else caption(g, 'Всё звучит одинаково: попал или нет — не слышно', 'включи «свой звук у окна»', '#ffd23f', 262);
  };

  /* ================= урок 8: одна кнопка ================= */
  function sky8(g, W, H, k = 0) { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, k > 0.5 ? '#1a1f4a' : '#2f5b8f'); gr.addColorStop(1, '#0b1020'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  const slab = (g, cx, y, w, col = '#c9a27a', h = 18) => { rr(g, cx - w / 2, y - h, w, h, 4, col, 'rgba(255,255,255,.35)'); };
  // окно тайминга по этажам: c.idealno — окно «идеально» прощает пару сантиметров; c.suzhenie — окно уже с каждым этажом
  MOTION['okno-tayminga'] = (g, t, W, H, c = {}) => {
    const T = since(t, c) % 8, ok = !!c.idealno, narrow = !!c.suzhenie, FL = 6, per = 1.05;
    sky8(g, W, H, T / 8);
    const offs = [3, -7, 9, -5, 12, -4];
    let width = 160, cx = 320; const floors = [];
    for (let f = 0; f < FL; f++) {
      const win = ok ? (narrow ? Math.max(3, 14 - f * 2.4) : 14) : 0, off = offs[f], snapped = Math.abs(off) <= win;
      const w2 = snapped ? width : width - Math.abs(off), c2 = snapped ? cx : cx + off / 2;
      floors.push({ win, off, snapped, w: w2, cx: c2, from: width, fromCx: cx }); width = w2; cx = c2;
    }
    const n = Math.min(FL, Math.floor(T / per)), cur = floors[n], base = 236;
    slab(g, 320, base + 18, 200, '#6d5a48');
    for (let f = 0; f < n; f++) slab(g, floors[f].cx, base - f * 18, floors[f].w, floors[f].snapped ? '#e8c79a' : '#c9a27a');
    if (cur) {
      const ph = (T - n * per) / per, y = base - n * 18;
      // плита ездит, нажатие на 0,7 доли проезда
      const sx = ph < 0.7 ? 320 + Math.sin(ph / 0.7 * Math.PI * 1.5 - Math.PI / 2) * 150 : cur.fromCx + cur.off;
      g.fillStyle = 'rgba(124,245,168,.25)'; if (cur.win) g.fillRect(cur.fromCx - cur.win * 2, y - 40, cur.win * 4, 40);
      if (ph < 0.7) slab(g, sx, y - 24, cur.from, '#e8c79a');
      else {
        slab(g, cur.cx, y, cur.w, cur.snapped ? '#ffe08a' : '#e8c79a');
        if (!cur.snapped) { const k = (ph - 0.7) / 0.3, side = Math.sign(cur.off); g.save(); g.globalAlpha = 1 - k; slab(g, cur.cx + side * (cur.w / 2 + Math.abs(cur.off) / 2), y + k * 60, Math.abs(cur.off), '#c97a5a'); g.restore(); }
        else text(g, 'идеально ♪', cur.cx, y - 34, '#7cf5a8', 14);
      }
      rr(g, 16, 16, 196, 52, 10, 'rgba(11,16,32,.85)', '#3a4880');
      text(g, `этаж ${n + 1}`, 26, 32, '#f2efe6', 14, 'left');
      text(g, ok ? `окно «идеально» ±${num(cur.win.toFixed(1))} см` : 'окна нет: режется всё', 26, 54, ok ? '#7cf5a8' : '#ff8a8a', 12, 'left', 700);
    }
    const w = floors[Math.max(0, n - 1)].w;
    text(g, `ширина плиты ${Math.round(w)}`, 620, 30, '#9aa3c7', 12, 'right', 700);
    if (!ok) caption(g, 'Без окна каждый сантиметр промаха отрезается', 'плита тает — обидно, хотя «я же попал»', '#ff8a8a', 280);
    else if (!narrow) caption(g, 'Окно всё время широкое — скоро станет скучно', 'включи сужение: трудность растёт сама', '#ffd23f', 280);
    else caption(g, 'Одна кнопка: окно уже с каждым этажом', 'вся глубина игры — в моменте нажатия', '#7cf5a8', 280);
  };
  // когда нажать: надёжно или рискнуть ради «идеально»; c.risk — ждать идеального момента
  MOTION['kogda-nazhat'] = (g, t, W, H, c = {}) => {
    const T = since(t, c) % 7.2, risk = !!c.risk;
    sky8(g, W, H, 0.3);
    const tries = risk ? [['идеально', 2], ['идеально', 2], ['мимо!', 0]] : [['надёжно', 1], ['надёжно', 1], ['надёжно', 1]];
    const n = Math.min(3, Math.floor(T / 2.2)), ph = (T % 2.2) / 2.2;
    let score = 0; for (let i = 0; i < n; i++) score += tries[i][1] * 10;
    slab(g, 320, 254, 200, '#6d5a48');
    for (let i = 0; i < n; i++) if (tries[i][1]) slab(g, 320 + (risk ? 0 : (i % 2 ? 6 : -6)), 236 - i * 18, risk ? 150 : 150 - (i + 1) * 10, risk ? '#ffe08a' : '#e8c79a');
    if (n < 3) {
      const tr = tries[n], y = 236 - n * 18, stop = risk ? 0.8 : 0.55, sx = 320 - Math.cos(Math.min(ph, stop) / stop * Math.PI / 2) * 150;
      slab(g, ph < stop ? sx : (tr[1] ? 320 : 320 + 90), ph < stop ? y - 24 : y + (tr[1] ? 0 : (ph - stop) * 200), 150, '#e8c79a');
      if (ph > stop) text(g, tr[0], 320, y - 40, tr[1] === 2 ? '#7cf5a8' : tr[1] ? '#ffd23f' : '#ff8a8a', 16);
      press(g, 520, 120, risk ? 'жду до последнего…' : 'жму заранее', ph > stop - 0.15 && ph < stop + 0.2 ? 1 : 0);
    }
    rr(g, 16, 16, 150, 40, 10, 'rgba(11,16,32,.85)', '#3a4880'); text(g, `очки: ${score}`, 91, 36, '#ffe08a', 15);
    if (risk) caption(g, 'Рискнул ради «идеально»: нота выше и плита шире — или промах', 'игрок сам выбирает, насколько рисковать', '#ffd23f', 280);
    else caption(g, 'Надёжно: каждый раз чуть отрезает, но башня растёт', 'включи «ждать идеального» и сравни', '#9aa3c7', 280);
  };
  // три приёма модуля на одном нажатии: c.otklik (урок 5), c.sochnost (урок 6), c.zvuk (урок 7)
  MOTION['tri-priema'] = (g, t, W, H, c = {}) => {
    const T = since(t, c) % 3.2, P3 = [['otklik', '⚡ Отзывчивость', 'урок 5'], ['sochnost', '✨ Сочность', 'урок 6'], ['zvuk', '🔊 Звук', 'урок 7']], n = P3.filter(([id]) => c[id]).length;
    const at = 1.3, lag = c.otklik ? 0 : 0.18, stopT = at + lag, dt = T - stopT;
    let ox = 0; if (c.sochnost && dt > 0 && dt < 0.25) ox = Math.sin(dt * 90) * 5 * (1 - dt / 0.25);
    g.save(); g.translate(ox, 0);
    sky8(g, W, H, 0.4);
    slab(g, 320, 254, 200, '#6d5a48'); slab(g, 320, 236, 160, '#e8c79a'); slab(g, 320, 218, 160, '#e8c79a');
    // плита едет слева направо 230 точек в секунду; без отзывчивости встаёт на 0,18 с позже — и свисает
    const pos = s => 20 + 230 * s, sx = pos(Math.min(T, stopT)), missed = !c.otklik, y = 200, over = sx - 320;
    if (T < stopT) slab(g, sx, y - 4, 160, '#e8c79a');
    else {
      const sq = c.sochnost && dt < 0.15 ? 0.3 : 0, keep = 160 - Math.max(0, over);
      g.save(); g.translate(320 + (160 - keep) / 2, y); g.scale(1 + sq * 0.15, 1 - sq); slab(g, 0, 0, keep, c.sochnost && dt < 0.12 ? '#ffffff' : '#ffe08a'); g.restore();
      if (missed) { const k = Math.min(1, dt / 0.8); g.globalAlpha = 1 - k; slab(g, 400 + over / 2, y + k * 50, over, '#c97a5a'); g.globalAlpha = 1; }
      if (c.sochnost && dt < 0.6) for (let i = 0; i < 12; i++) { const a = -Math.PI * (i / 11), px = 320 + Math.cos(a) * 110 * dt * 1.5, py = y - 10 + Math.sin(a) * 50 * dt + 120 * dt * dt; g.globalAlpha = 1 - dt / 0.6; g.fillStyle = '#ffe08a'; g.fillRect(px - 3, py - 3, 6, 6); g.globalAlpha = 1; }
      if (c.zvuk && dt < 0.7) { g.strokeStyle = `rgba(95,224,255,${1 - dt / 0.7})`; g.lineWidth = 3; g.beginPath(); g.arc(320, y - 10, 30 + dt * 90, -2.8, -0.35); g.stroke(); text(g, '♪ ми ↑', 430, 120 - dt * 20, '#5fe0ff', 16); }
    }
    g.restore();
    press(g, 120, 120, 'нажал ровно над башней', T > at - 0.1 && T < at + 0.6 ? 1 : 0);
    P3.forEach(([id, lab, from], i) => { const on = !!c[id]; rr(g, 440, 16 + i * 30, 184, 26, 8, on ? 'rgba(124,245,168,.12)' : '#141c36', on ? '#7cf5a8' : '#2a3560'); text(g, lab, 452, 29 + i * 30, on ? '#7cf5a8' : '#6f7aa8', 13, 'left'); text(g, from, 614, 29 + i * 30, '#9aa3c7', 11, 'right', 600); });
    if (!n) caption(g, 'Нажал вовремя — а игра опоздала и промолчала', 'включай приёмы модуля по одному: 1–3', '#ff8a8a', 280);
    else if (n < 3) caption(g, `Приёмов ${n} из 3 — уже лучше`, missed ? 'без отзывчивости плита встаёт с опозданием' : 'включи остальные и сравни', '#ffd23f', 280);
    else caption(g, 'Отвечает сразу, чувствуется и звучит', 'одно нажатие — три приёма модуля', '#7cf5a8', 280);
  };
  // ограничение дарит идею: c.vse — разрешить все кнопки, и игра раздувается
  MOTION['ogranichenie'] = (g, t, W, H, c = {}) => {
    bg(g, W, H);
    const T = since(t, c) % 6, all = !!c.vse;
    if (!all) {
      rr(g, 40, 50, 260, 170, 14, '#132447', '#3a4880');
      const ph = T % 1.2, y = 150 - Math.sin(ph / 1.2 * Math.PI) * 50;
      disc(g, 120, y, 14, '#ffd23f'); [[200, 90], [260, 120]].forEach(([x, gap]) => { const xx = x - (T * 40) % 220; g.fillStyle = '#7cf5a8'; g.fillRect(xx, 50, 20, gap - 20); g.fillRect(xx, gap + 60, 20, 220 - gap - 60); });
      disc(g, 470, 135, 56, ph < 0.15 ? '#ffe08a' : '#ffb547'); text(g, 'ОДНА', 470, 128, '#0b1020', 16); text(g, 'кнопка', 470, 148, '#0b1020', 13);
      caption(g, 'Одна кнопка: придумываешь одно — но хорошо', 'всё решает «когда»', '#7cf5a8', 268);
      return;
    }
    rr(g, 40, 50, 260, 170, 14, '#2a1620', '#ff5d6e');
    const feats = ['стрелять', 'рывок', 'инвентарь', 'крафт', 'диалоги', 'карта', 'прокачка', 'магазин', 'питомец', 'погода', 'лодка', 'босс'];
    feats.forEach((f, i) => { const k = ob(seg(T, i * 0.25, i * 0.25 + 0.3)); if (k <= 0) return; const x = 340 + (i % 4) * 72, y = 60 + Math.floor(i / 4) * 52; g.save(); g.translate(x + 30, y + 18); g.scale(k, k); rr(g, -32, -18, 64, 36, 10, '#24304f', '#ff8fa0'); fit(g, f, 0, 0, 58, '#f2efe6', 12); g.restore(); });
    for (let i = 0; i < 9; i++) { const k = seg(T, i * 0.3, i * 0.3 + 0.3); if (k > 0) emo(g, ['🔫', '⚔', '🎒', '🗺', '💬', '🐶', '⛵', '🌧', '👑'][i], 70 + (i % 3) * 80, 90 + Math.floor(i / 3) * 50, 24); }
    disc(g, 120, 160, 14, '#ffd23f'); text(g, '?', 120, 132, '#ff8a8a', 18);
    caption(g, 'Можно всё — и ни одна идея не доделана', 'раздувание: фич больше, времени столько же', '#ff8a8a', 268);
  };

  // дальше — типы шагов: на проекторе их нет
  if (typeof STEPS === 'undefined') return;
  const { el, api, toast, beep } = Lab;
  const fast = () => !!window.LAB_FAST;
  const bars = rows => el('div', { class: 'm6-bars' }, rows.map((r, i) => el('div', { class: 'm6-bar' + (r.me ? ' me' : '') },
    el('span', { class: 'lab' }, r.label), el('span', { class: 'track' }, el('i', { style: `--w:${Math.round(clamp(r.k, 0, 1) * 100)}%;--d:${i * 0.08}s` })), el('b', {}, r.show != null ? r.show : ''))));
  const tally = id => api('/api/m6/tally?step=' + encodeURIComponent(id)).catch(() => null);
  function optionGrid(options, pick, onPick) {
    const grid = el('div', { class: 'opts', role: 'radiogroup' });
    options.forEach(o => grid.append(el('button', { type: 'button', class: 'opt' + (pick === o ? ' on' : ''), 'aria-pressed': String(pick === o), onclick: () => onPick(o) }, o)));
    return grid;
  }

  /* ---------------- видео-петля (Г2 «petlya»): запись партии сценой, скорость ×1, ×½, ×¼, пауза и шаг по кадрам ---------------- */
  // Возвращает { el, reveal(on) }: шаг secret добавляет её над вопросом и не пересоздаёт при перерисовке
  function loop(anim, label) {
    const cv = el('canvas', { width: 640, height: 300, class: 'm4-cv m4-motion m2-loop', 'aria-label': label || 'Запись партии' }), g = cv.getContext('2d');
    const ctl = { reveal: false, _t: 99, _id: null };
    let speed = 1, playing = !calm(), at = calm() ? 3.3 : 0, prev = performance.now(), raf = 0, lastDraw = 0;
    const clock = el('b', { class: 'm2-clock' });
    const speeds = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Скорость' });
    const sp = [[1, '×1'], [0.5, '×½'], [0.25, '×¼']];
    function paintCtl() {
      speeds.replaceChildren(...sp.map(([v, l]) => el('button', { type: 'button', class: 'opt' + (speed === v ? ' on' : ''), 'aria-pressed': String(speed === v), 'data-speed': String(v), onclick: () => { speed = v; playing = true; beep('tick'); paintCtl(); draw(true); } }, l)));
      playBtn.textContent = playing ? '⏸ Пауза' : '▶ Играть';
    }
    const playBtn = el('button', { type: 'button', class: 'btn ghost small', 'data-loop': 'play', onclick: () => { playing = !playing; beep('tick'); paintCtl(); } });
    const step = d => el('button', { type: 'button', class: 'btn ghost small', 'data-loop': d > 0 ? 'fwd' : 'back', 'aria-label': d > 0 ? 'Кадр вперёд' : 'Кадр назад', onclick: () => { playing = false; at = Math.max(0, at + d); paintCtl(); draw(true); } }, d > 0 ? '›' : '‹');
    const box = el('div', { class: 'stack m2-loopbox' }, el('div', { class: 'm4-stage' }, cv),
      el('div', { class: 'row m2-loopctl' }, playBtn, step(-0.1), step(0.1), speeds, el('span', { class: 'grow' }), clock));
    function draw(force) {
      const now = performance.now(), dt = Math.min(0.1, (now - prev) / 1000); prev = now;
      if (playing) at += dt * speed * (fast() ? 2 : 1);
      if (!force && ((window.LAB_LOWRES && now - lastDraw < 100) || (!cv.offsetParent && lastDraw))) return;
      lastDraw = now;
      clock.textContent = `${speed === 1 ? '' : (speed === 0.5 ? '×½ · ' : '×¼ · ')}${num((at % 8).toFixed(1))} с`;
      g.save(); g.clearRect(0, 0, 640, 300);
      try { MOTION[anim](g, at, 640, 300, ctl); } catch (e) { /* кадр пропущен */ }
      g.restore();
    }
    const tick = () => { if (!cv.isConnected && performance.now() - prev > 3000) { cancelAnimationFrame(raf); return; } raf = requestAnimationFrame(tick); draw(); };
    paintCtl(); draw(true); raf = requestAnimationFrame(tick);
    return { el: box, reveal(on) { ctl.reveal = !!on; draw(true); } };
  }

  /* ---------------- саботаж (Г2 «sabotazh»): учитель тайно поворачивает ручку на проекторе, класс угадывает ---------------- */
  function sabotazh(ctx) {
    const st = ctx.step, H = st.hunt, host = el('div', { class: 'stack m2-sab' });
    let data = null, pick = null;
    async function load() {
      try { data = await api('/api/wow/hunt?step=' + encodeURIComponent(st.id)); } catch (e) { host.replaceChildren(el('p', { class: 'err' }, e.message)); return; }
      if (data.answer && data.answer.secret && !(ctx.value && ctx.value.secret)) ctx.save(data.answer, true, true);
      draw();
    }
    function draw() {
      const sab = data && data.sabotage, a = data && data.answer;
      const parts = [H.lead ? el('p', { class: 'concept m1-lead' }, H.lead) : null];
      if (!sab) parts.push(el('div', { class: 'm2-wait' }, el('span', { class: 'ic', 'aria-hidden': 'true' }, '🕵'),
        el('div', {}, el('b', {}, 'Смотри на проектор'), el('p', { class: 'small muted' }, H.wait || 'Учитель вот-вот тайно повернёт одну ручку. Вопрос появится, как только саботаж начнётся.'))));
      else if (a && a.secret && a.round === sab.round) {
        const v = a.correct ? ['good', '🕵 Раскусил саботаж!'] : a.trap ? ['bad', a.trapText || 'Ловушка! Это не меняли.'] : ['bad', `Не угадал: выключено было другое — «${sab.label || ''}».`];
        parts.push(el('p', { class: 'verdict ' + v[0] }, v[1]),
          el('div', { class: 'secret-reveal' }, el('div', { class: 'eyebrow' }, 'Что повернул учитель'), el('h3', {}, a.secret.title), el('p', {}, a.secret.reveal)),
          H.after ? el('p', { class: 'concept' }, H.after) : null);
      } else if (a && a.round === sab.round) parts.push(el('p', { class: 'verdict' }, `Ответ принят: «${a.guess}». Ждём, когда учитель раскроет саботаж.`), el('p', { class: 'small muted' }, `Ответили: ${sab.n}`));
      else if (sab.phase === 'play') {
        parts.push(el('div', { class: 'eyebrow' }, `Раунд ${sab.round} · ${H.question}`), optionGrid(data.options, pick, o => { pick = o; beep('tick'); draw(); }),
          el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn', 'data-sab': 'guess', onclick: guess }, 'Ответить'), el('span', { class: 'small muted' }, `Ответили: ${sab.n}`)));
      } else parts.push(el('p', { class: 'verdict bad' }, `Не успел ответить. Учитель выключил «${sab.label}».`), sab.why ? el('p', {}, sab.why) : null);
      host.replaceChildren(...parts.filter(Boolean));
    }
    async function guess() {
      if (!pick) { toast('Выбери вариант'); return; }
      try { const r = await api('/api/wow/guess', { guess: pick, step: st.id }); ctx.save(r, true, true); beep('tick'); pick = null; await load(); } catch (e) { toast(e.message, 'err'); }
    }
    if (typeof S !== 'undefined') S.hooks.push(kind => { if (kind === 'sabotage' && host.isConnected) load(); });
    host.append(el('p', { class: 'muted' }, 'Загружаем…'));
    load();
    return host;
  }

  /* ---------------- bumaga: бумажная игра без компьютера ---------------- */
  // Поля: rules — правила по пунктам, roles — кто что делает, minutes — таймер, bpm — метроном портала (необязательно),
  // rounds [{ label, text }] — раунды, question, options, own, why — вопрос после игры, итог класса — после своего ответа
  let audio = null;
  function click(hi) {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), v = audio.createGain(); o.type = 'square'; o.frequency.value = hi ? 1320 : 880;
      v.gain.setValueAtTime(0.06, audio.currentTime); v.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.05);
      o.connect(v); v.connect(audio.destination); o.start(); o.stop(audio.currentTime + 0.06);
    } catch (e) { /* без звука */ }
  }
  STEPS.bumaga = ctx => {
    const st = ctx.step, total = (st.minutes || 5) * 60;
    let v = Object.assign({ round: 0 }, ctx.value), pick = v.pick || null, tick = 0, met = 0, beat = 0;
    const host = el('div', { class: 'stack m2-bumaga' }), clockBox = el('div', { class: 'stack' }), ask = el('div', { class: 'stack' }), tallyBox = el('div', { class: 'stack' });
    const rules = el('ol', { class: 'm2-rules' }, (st.rules || []).map(r => el('li', {}, r)));
    const roundsBox = el('div', { class: 'row m2-rounds' });
    function paintRounds() {
      roundsBox.replaceChildren(...(st.rounds || []).map((r, i) => el('button', { type: 'button', class: 'chipbtn' + (v.round === i ? ' on' : ''), 'data-round': String(i), onclick: () => { v.round = i; ctx.save(v); beep('tick'); paintRounds(); } },
        el('b', {}, r.label), ' ', el('span', { class: 'small' }, r.text))));
    }
    function stopMet() { clearInterval(met); met = 0; }
    function paintClock() {
      const left = v.t0 ? Math.max(0, total - (Date.now() - v.t0) / 1000) : total;
      const mm = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
      const metBtn = st.bpm ? el('button', { type: 'button', class: 'btn ghost small', 'data-bumaga': 'metronome', 'aria-pressed': String(!!met), onclick: () => {
        if (met) { stopMet(); paintClock(); return; }
        beat = 0; met = setInterval(() => { if (!host.isConnected) { stopMet(); return; } click(beat % 4 === 3); beat++; }, 60000 / st.bpm); paintClock();
      } }, met ? '⏹ Метроном' : `🥁 Метроном ${st.bpm}`) : null;
      clockBox.replaceChildren(el('div', { class: 'row m1-clockrow' }, el('span', { class: 'eyebrow' }, `Игра на ${st.minutes || 5} минут`), el('span', { class: 'grow' }), el('b', { class: 'm1-clock' }, v.played ? 'Сыграли ✓' : v.t0 ? (left > 0 ? mm : 'Время вышло') : mm)),
        el('div', { class: 'm1-watch on' }, el('i', { style: `width:${v.played ? 100 : 100 * left / total}%` })),
        el('div', { class: 'row' }, !v.t0 ? el('button', { type: 'button', class: 'btn', 'data-bumaga': 'start', onclick: () => { v.t0 = Date.now(); ctx.save(v); beep('good'); paintClock(); run(); } }, '▶ Начать игру')
          : !v.played ? el('button', { type: 'button', class: 'btn', 'data-bumaga': 'played', onclick: () => { v.played = true; stopMet(); ctx.save(v); beep('good'); paintClock(); drawAsk(); } }, 'Мы сыграли ✓') : null, metBtn));
      if (v.played || (v.t0 && left <= 0)) { clearInterval(tick); if (!v.played && left <= 0) { v.played = true; ctx.save(v); drawAsk(); } }
    }
    function run() { clearInterval(tick); tick = setInterval(() => { if (!host.isConnected) { clearInterval(tick); stopMet(); return; } paintClock(); }, 1000); }
    function drawAsk() {
      if (!v.played) { ask.replaceChildren(el('p', { class: 'small muted' }, 'Сыграйте — потом вопрос.')); return; }
      if (!v.voted) {
        const own = st.own ? el('input', { type: 'text', id: 'f-' + st.id + 'own', maxlength: 160, placeholder: 'Или своими словами', value: v.own || '' }) : null;
        if (own) own.addEventListener('input', () => { v.own = own.value; ctx.save(v); });
        ask.replaceChildren(el('div', { class: 'm1-q' }, st.question), optionGrid(st.options, pick, o => { pick = o; beep('tick'); drawAsk(); }), own,
          el('div', {}, el('button', { type: 'button', class: 'btn', 'data-bumaga': 'answer', onclick: () => {
            if (!pick && !(v.own || '').trim()) { toast('Выбери вариант или скажи своими словами'); return; }
            v = Object.assign({}, v, { pick, voted: true }); ctx.save(v, true, true); beep('good'); drawAsk();
          } }, 'Ответить')));
        return;
      }
      ask.replaceChildren(el('p', { class: 'verdict good' }, `Твой ответ: ${v.pick || v.own}`), st.why ? el('p', { class: 'concept' }, st.why) : null);
      tally(st.id).then(r => {
        if (!r || r.hidden || !r.n) return;
        tallyBox.replaceChildren(el('div', { class: 'eyebrow' }, `Класс ответил · ${r.n}`), bars(r.rows.map(x => ({ label: x.label, k: x.n / r.n, show: x.n, me: x.label === v.pick }))));
      });
    }
    host.append(el('div', { class: 'card m2-paper' }, el('div', { class: 'eyebrow' }, '📄 Без компьютера'), rules,
      st.roles ? el('p', { class: 'small' }, el('b', {}, 'Кто что делает: '), st.roles) : null, st.need ? el('p', { class: 'small muted' }, 'Нужно: ' + st.need) : null),
    st.rounds ? roundsBox : null, clockBox, ask, tallyBox);
    paintRounds(); paintClock(); drawAsk();
    if (v.t0 && !v.played) run();
    return host;
  };

  window.LabStepsM2 = { loop, sabotazh };
  // итог шага одной строкой — для «Скопировать результат»
  window.LabStepsM2Summary = (step, v) => {
    switch (step.type) {
      case 'bumaga': return v.voted ? `ответ: ${v.pick || v.own}` : v.played ? 'сыграли' : 'не начинали';
      default: return null;
    }
  };
})();
