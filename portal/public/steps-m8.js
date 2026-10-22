// Шаги модуля 8 «Своя игра: от питча до Фестиваля» (уроки 29–36) и их моушн-дизайн. Подключается после student.js и steps-m6.js,
// берёт его помощники (S, ans, el, api, toast, beep, Games, ownGame, hasGame, fieldEditor, valText, renderMain). Сцены-объяснялки —
// в общей библиотеке MOTION (шаг motion, переключатели toggles «попробуй сам»). Типы шагов:
//   donordeck — колода доноров курса: карты переворачиваются, донора можно сыграть, выбрать одного или скрестить двух — уходит в Фабрику команды;
//   pitch     — питч-карта (собирается из диздока на глазах) и репетиция 60 секунд: кольцо-таймер с четырьмя битами питча;
//   pitchwall — стена питчей класса: «❤ хочу сыграть» (три сердца), питч на сцене у учителя — баннер с таймером;
//   dizdok    — одностраничный диздок из ответов команды, «на утверждение» — учитель ставит печать, она падает на страницу;
//   seryy     — «Весело ли без графики?»: игра в цвете и серым прототипом, голос и гонка полос времени в игре;
//   observe   — наблюдение за плейтестом: метки по времени (застрял, смеётся, спросил…), живая лента и сводка «что увидели новые игроки»;
//   moscow    — «Должно / Хорошо бы / Потом»: ножницы режут треть задуманного, кольцо показывает долю вырезанного;
//   kontent   — карта контента на 10 минут: события на ленте и кривая интереса игрока, проигрыш «десять минут за десять секунд»;
//   trailer   — раскадровка трейлера на 30 секунд: пять кадров и просмотр раскадровки анимацией;
//   stand     — карточка стенда Фестиваля: название, авторы, управление, «по мотивам», QR аркады, печать и файл игры для дома;
//   fest      — стенд на Фестивале: заставка, партия гостя, реакция и «ещё раз», живые рекорды;
//   sertifikat — сертификат курса из «Моей студии»: игры, версии, плейтесты, значки — открывается анимацией.
'use strict';
(function () {
  const M = window.LabMotion;
  if (!M) return;
  const { MOTION } = M;
  const { TAU, clamp, seg, io, ob, lerp, rng, rr, text, disc, glow, sky, hero, arrow, confetti, fast } = M.kit;
  const calm = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mmss = sec => { const s = Math.max(0, Math.round(sec)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const colorOf = n => (window.LabM7 ? window.LabM7.colorOf(n) : '#5fe0ff');

  /* ---------------- помощники рисования ---------------- */
  const emo = (g, e, x, y, px = 24) => { g.fillStyle = '#ffffff'; g.font = `${px}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, x, y); };
  function wrap(g, s, x, y, maxW, lh, col = '#f2efe6', px = 14, align = 'center', weight = 700) {
    g.font = `${weight} ${px}px system-ui,-apple-system,'Segoe UI',sans-serif`;
    const words = String(s).split(/\s+/), lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur);
    const y0 = y - (lines.length - 1) * lh / 2;
    lines.forEach((l, i) => text(g, l, x, y0 + i * lh, col, px, align, weight));
  }
  // подпись внизу сцены
  function cap(g, s, t, at = 0.2, col = '#f2efe6') {
    const k = ob(seg(t, at, at + 0.45)); if (k <= 0) return;
    g.save(); g.globalAlpha = Math.min(1, k); g.translate(320, 274); g.scale(0.9 + 0.1 * k, 0.9 + 0.1 * k);
    rr(g, -305, -17, 610, 34, 10, 'rgba(11,16,32,.84)'); text(g, s, 0, 0, col, 13); g.restore();
  }
  function bubble(g, x, y, s, k = 1, col = '#fffbe8', ink = '#1b1430', px = 13) {
    if (k <= 0) return; g.save(); g.translate(x, y); const z = ob(Math.min(1, k)); g.scale(z, z);
    g.font = `800 ${px}px system-ui,sans-serif`; const w = Math.min(280, g.measureText(s).width + 22), h = px + 14;
    rr(g, -w / 2, -h, w, h, 10, col); g.fillStyle = col; g.beginPath(); g.moveTo(-6, -1); g.lineTo(0, 8); g.lineTo(6, -1); g.fill();
    text(g, s, 0, -h / 2, ink, px); g.restore();
  }
  // карта-донор: рубашка или лицо, переворот по k (0 — рубашка, 1 — лицо)
  function dcard(g, x, y, w, h, k, icon, title, col = '#2a3560', sub = '') {
    const s = Math.cos(clamp(k, 0, 1) * Math.PI); g.save(); g.translate(x, y); g.scale(Math.max(0.03, Math.abs(s)), 1);
    if (s > 0) { rr(g, -w / 2, -h / 2, w, h, 10, '#1a2445', '#3a4880'); emo(g, '🎲', 0, 0, w * 0.35); }
    else { rr(g, -w / 2, -h / 2, w, h, 10, col, '#ffffff44'); emo(g, icon, 0, -h * 0.18, w * 0.34); wrap(g, title, 0, h * 0.2, w - 12, 13, '#0b1020', 11, 'center', 800); if (sub) text(g, sub, 0, h * 0.4, '#0b1020aa', 9, 'center', 700); }
    g.restore();
  }
  // кольцо-таймер с метками
  function ring(g, x, y, r, k, col, back = '#2a3560', w = 10) {
    g.lineWidth = w; g.lineCap = 'round'; g.strokeStyle = back; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
    if (k > 0) { g.strokeStyle = col; g.beginPath(); g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(k, 0, 1)); g.stroke(); }
  }
  const BEATS = [[0, 10, 'Одной фразой', '#ffd23f'], [10, 30, 'Как играется', '#5fe0ff'], [30, 50, 'Твист: чего нет у донора', '#ff5fa2'], [50, 60, '«Хочешь сыграть?»', '#7cf5a8']];
  function pitchRing(g, x, y, r, sec, big = false) {
    BEATS.forEach(([a, b, , col]) => { g.lineWidth = big ? 16 : 11; g.strokeStyle = col + '44'; g.beginPath(); g.arc(x, y, r, -Math.PI / 2 + TAU * a / 60 + 0.03, -Math.PI / 2 + TAU * b / 60 - 0.03); g.stroke(); });
    const cur = BEATS.find(([a, b]) => sec >= a && sec < b) || BEATS[3];
    BEATS.forEach(([a, b, , col]) => { const k = clamp((sec - a) / (b - a), 0, 1); if (k <= 0) return; g.lineWidth = big ? 16 : 11; g.strokeStyle = col; g.beginPath(); g.arc(x, y, r, -Math.PI / 2 + TAU * a / 60 + 0.03, -Math.PI / 2 + TAU * (a + (b - a) * k) / 60 - 0.03); g.stroke(); });
    const ang = -Math.PI / 2 + TAU * clamp(sec, 0, 60) / 60; disc(g, x + Math.cos(ang) * r, y + Math.sin(ang) * r, big ? 10 : 7, '#ffffff');
    text(g, mmss(Math.max(0, 60 - sec)), x, y - (big ? 14 : 8), sec >= 60 ? '#ff5d6e' : '#f2efe6', big ? 44 : 26);
    text(g, sec >= 60 ? 'время!' : cur[2], x, y + (big ? 30 : 18), cur[3], big ? 18 : 12);
    return cur;
  }

  /* =================== MOTION: сцены модуля 8 =================== */
  // --- урок 29: питч ---
  const STATIONS = [['💡', 'Питч'], ['⬜', 'Серый прототип'], ['🍰', 'Срез'], ['✂️', 'Плейтест'], ['🗺️', 'Контент'], ['👀', 'Чужие'], ['✨', 'Полировка'], ['🎪', 'Фестиваль']];
  MOTION['road-fest'] = (g, t, W, H) => {
    t %= 12; sky(g, W, H, '#1a1640', '#2f2a5a');
    // извилистая дорога через восемь станций
    const pt = k => ({ x: 50 + k * 540, y: 150 + Math.sin(k * Math.PI * 2.2) * 60 });
    g.strokeStyle = '#3a3460'; g.lineWidth = 26; g.lineCap = 'round'; g.beginPath(); for (let k = 0; k <= 1.0001; k += 0.02) { const p = pt(k); k ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); } g.stroke();
    g.strokeStyle = '#ffffff33'; g.lineWidth = 2; g.setLineDash([8, 10]); g.beginPath(); for (let k = 0; k <= 1.0001; k += 0.02) { const p = pt(k); k ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); } g.stroke(); g.setLineDash([]);
    const prog = io(seg(t, 0.6, 9.5));
    STATIONS.forEach(([ic, name], i) => {
      const k = i / 7, p = pt(k), passed = prog >= k - 0.001, near = Math.abs(prog - k) < 0.05;
      if (passed) glow(g, p.x, p.y, near ? 40 : 26, i === 7 ? 'rgba(255,210,63,.6)' : 'rgba(124,245,168,.35)');
      disc(g, p.x, p.y, i === 7 ? 22 : 17, passed ? (i === 7 ? '#ffd23f' : '#7cf5a8') : '#1a2445'); emo(g, ic, p.x, p.y, i === 7 ? 20 : 15);
      text(g, name, p.x, p.y + (i % 2 ? -36 : 36), passed ? '#f2efe6' : '#8a8aa8', 11);
      text(g, 'урок ' + (29 + i), p.x, p.y + (i % 2 ? -52 : 52), '#8a8aa8', 9, 'center', 600);
    });
    const p = pt(prog); hero(g, p.x, p.y - 22 + Math.abs(Math.sin(t * 9)) * -5, 13, '#ff7ad9', 1);
    if (t > 9.6) confetti(g, pt(1).x, pt(1).y, seg(t, 9.6, 11.5), 26, 8);
    cap(g, t < 9.6 ? 'Восемь уроков — одна игра: от идеи до гостей Фестиваля' : 'Фестиваль: в твою игру играют люди, которые тебя не знают', t, 0.3);
  };
  MOTION['pitch-60'] = (g, t, W, H) => {
    t %= 13; g.fillStyle = '#0d1226'; g.fillRect(0, 0, W, H);
    const sec = clamp((t - 0.5) * 5.4, 0, 62);
    const cur = pitchRing(g, 160, 136, 92, sec);
    // справа — то, что говорит автор в этот бит
    const says = { 'Одной фразой': 'Это игра, где ты пчелой спасаешь последний цветок от зимы', 'Как играется': 'Летаешь, собираешь пыльцу, несёшь в улей. Каждые 30 секунд холоднее', 'Твист: чего нет у донора': 'Пыльца греет: чем больше несёшь, тем медленнее, но теплее', '«Хочешь сыграть?»': 'Хочешь попробовать? Рекорд класса — 4 цветка' };
    BEATS.forEach(([a, b, name, col], i) => {
      const on = cur[2] === name, y = 46 + i * 54, k = seg(sec, a, a + 2);
      rr(g, 290, y - 22, 330, 46, 12, on ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.03)', on ? col : '#2a3560');
      text(g, `${a}–${b} с · ${name}`, 300, y - 9, col, 11, 'left');
      if (k > 0) { g.save(); g.globalAlpha = Math.min(1, k * 1.5); wrap(g, says[name], 455, y + 9, 310, 13, '#f2efe6', 11, 'center', 600); g.restore(); }
    });
    if (sec > 58) { emo(g, '🙋', 560, 236, 24); emo(g, '🙋', 590, 230, 24); emo(g, '🙋‍♀️', 530, 232, 24); }
    cap(g, 'Питч за 60 секунд: фраза, как играется, твист и вопрос «хочешь сыграть?»', t, 0.2);
  };
  MOTION['one-phrase'] = (g, t, W, H, c = {}) => {
    sky(g, W, H, '#14203c', '#24305a');
    const short = !!c.short, k = clamp(c._t * 1.6, 0, 1);
    const long = 'Ну там короче есть герой и он может ходить и ещё прыгать, и там враги, но не все, а ещё магазин и уровни и босс и сюжет...';
    const one = 'Это игра, где ты пчелой спасаешь последний цветок от зимы';
    rr(g, 40, 30, 300, 140, 16, '#fffbe8'); wrap(g, short ? one : long, 190, 100, 270, 18, '#1b1430', short ? 16 : 12, 'center', short ? 800 : 600);
    hero(g, 190, 214, 22, '#ff7ad9', 1, Math.abs(Math.sin(t * 8)) * 0.15);
    // слушатели: заинтересованы или скучают
    for (let i = 0; i < 4; i++) {
      const x = 400 + i * 60, y = 200 + (i % 2) * 14, bored = !short, nod = short ? Math.sin(t * 5 + i) * 3 : 0;
      hero(g, x, y + nod, 18, ['#5fe0ff', '#ffb547', '#7cf5a8', '#b49bff'][i], -1, 0);
      emo(g, bored ? ['😴', '🥱', '😐', '📱'][i] : ['😮', '🤩', '🙋', '😃'][i], x, y - 34, 20);
    }
    if (short && k > 0.6) bubble(g, 490, 140, 'Хочу сыграть!', seg(c._t, 0.4, 0.8), '#c9f6ff');
    text(g, short ? '1 фраза · 12 слов' : '1 фраза · 30 слов и «короче»', 190, 150 + 40, short ? '#7cf5a8' : '#ff5d6e', 12);
    cap(g, short ? 'Одна фраза: кто ты, что делаешь и что необычного. Слушатель уже играет в голове' : 'Длинно и «короче» — слушатель потерялся на третьем слове. Включи «Одной фразой»', t, 0.2);
  };
  MOTION['cross-donors'] = (g, t, W, H, c = {}) => {
    t %= 9; g.fillStyle = '#0d1226'; g.fillRect(0, 0, W, H);
    const P = [[['🧱', 'Тетрис'], ['🏃', 'Бег по дорожкам'], ['🧱🏃', 'Строишь мост из падающих фигур прямо на бегу']], [['🛸', 'Space Invaders'], ['🌻', 'Огород'], ['🛸🌻', 'Пришельцы идут по грядкам, а ты сажаешь пушки']], [['🃏', 'Карточный бой'], ['🏁', 'Гонка'], ['🃏🏁', 'Каждая карта — манёвр на трассе: обгон, занос, щит']]];
    const pair = P[(c.next ? 1 : 0) + (c.third ? 1 : 0)] || P[0];
    const m = seg(t, 2.2, 3.6), m2 = ob(seg(t, 3.6, 4.4));
    dcard(g, lerp(150, 290, io(m)), 120, 120, 160, seg(t, 0.3, 0.9), pair[0][0], pair[0][1], '#ffb547');
    dcard(g, lerp(490, 350, io(m)), 120, 120, 160, seg(t, 0.9, 1.5), pair[1][0], pair[1][1], '#5fe0ff');
    if (m < 1) { text(g, '×', 320, 120, '#fff', 34); }
    if (m2 > 0) { g.save(); g.translate(320, 130); g.scale(m2, m2); glow(g, 0, 0, 110, 'rgba(255,224,138,.35)'); rr(g, -120, -82, 240, 164, 16, '#ffe08a'); emo(g, pair[2][0], 0, -42, 34); wrap(g, pair[2][1], 0, 22, 210, 17, '#3a2400', 14, 'center', 800); g.restore(); }
    if (t > 4.4) confetti(g, 320, 110, seg(t, 4.4, 6), 18, 3);
    cap(g, m2 > 0 ? 'Скрещивание: механика одного и мир или правило другого — игра, какой ещё не было' : 'Донор — твой: выбери одну игру курса или скрести двух', t, 0.2);
  };
  // --- урок 30: найти веселье ---
  MOTION['grey-box'] = (g, t, W, H, c = {}) => {
    const art = !!c.art, light = !!c.light, fx = !!c.fx, snd = !!c.snd;
    // одна и та же сцена: герой прыгает по платформам и собирает звёзды; ручки возвращают картинку
    const bg1 = art ? '#7ec8ff' : '#5d6168', bg2 = art ? '#d6f0ff' : '#7a7f86'; sky(g, W, H, bg1, bg2);
    if (light) { glow(g, 520, 50, 120, 'rgba(255,240,180,.7)'); }
    const plats = [[60, 220, 140], [240, 180, 120], [420, 140, 140]];
    plats.forEach(([x, y, w], i) => { rr(g, x, y, w, 18, art ? 6 : 0, art ? ['#6fbf4a', '#c98a4a', '#6f8fd8'][i] : '#9aa0a8'); if (art) { g.fillStyle = '#4a8a30'; g.fillRect(x, y, w, 5); } });
    const cyc = (t % 3) / 3, hx = lerp(100, 480, io(cyc)), hy = 200 - Math.abs(Math.sin(cyc * Math.PI * 2)) * 70 - cyc * 60;
    if (art) hero(g, hx, hy, 14, '#ff7ad9', 1); else rr(g, hx - 13, hy - 13, 26, 26, 0, '#c4c8ce');
    const st = [300, 470]; st.forEach((x, i) => { const got = cyc > (i ? 0.92 : 0.55); if (!got) { art ? emo(g, '⭐', x, 150 - i * 40, 22) : disc(g, x, 150 - i * 40, 9, '#c4c8ce'); } else if (fx) { const k = (cyc - (i ? 0.92 : 0.55)) * 6; confetti(g, x, 150 - i * 40, clamp(k, 0, 0.99), 12, i + 2); } });
    if (snd && Math.abs(cyc - 0.56) < 0.04) text(g, '♪ динь!', 300, 110, '#ffd23f', 16);
    if (light) { g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(hx, 216, 14, 4, 0, 0, TAU); g.fill(); }
    // счётчик: цикл тот же
    rr(g, 16, 14, 230, 30, 8, 'rgba(11,16,32,.75)'); text(g, 'прыгнуть → собрать → дальше', 131, 29, '#7cf5a8', 12);
    const n = [art, light, fx, snd].filter(Boolean).length;
    cap(g, n === 0 ? 'Серый прототип: кубы и цикл. Если весело уже так — веселье в механике' : n < 4 ? 'Картинка добавляет чувство, но цикл тот же самый' : 'Всё включено — красиво. Но если без этого скучно, красота не спасёт', t, 0.2);
  };
  MOTION['fun-loop'] = (g, t, W, H, c = {}) => {
    t %= 8; g.fillStyle = '#0d1226'; g.fillRect(0, 0, W, H);
    const noReward = !!c.noReward, cx = 220, cy = 140, R = 86;
    const N = [['🎮', 'Действие', '#5fe0ff'], ['⚡', 'Вызов', '#ffb547'], [noReward ? '…' : '🏆', noReward ? 'ничего' : 'Награда', noReward ? '#6a6f80' : '#7cf5a8']];
    N.forEach(([ic, name, col], i) => { const a = -Math.PI / 2 + i * TAU / 3, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R; disc(g, x, y, 30, col); emo(g, ic, x, y - 2, 22); text(g, name, x, y + 44, col, 12); });
    const k = (t * 0.6) % 1, a = -Math.PI / 2 + k * TAU, broke = noReward && k > 0.66;
    if (!broke) { g.strokeStyle = '#ffffff55'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, R, -Math.PI / 2, a); g.stroke(); disc(g, cx + Math.cos(a) * R, cy + Math.sin(a) * R, 7, '#ffe08a'); }
    else { text(g, '💤', cx, cy, '#fff', 30); }
    // справа — желание играть ещё
    const want = noReward ? Math.max(0.1, 1 - t / 6) : 0.6 + 0.4 * Math.abs(Math.sin(t));
    rr(g, 420, 60, 40, 160, 10, '#1a2445'); rr(g, 420, 60 + 160 * (1 - want), 40, 160 * want, 10, want > 0.4 ? '#7cf5a8' : '#ff5d6e');
    text(g, 'хочу ещё', 440, 236, '#9aa3c7', 12); emo(g, want > 0.4 ? '🤩' : '😴', 520, 140, 34);
    cap(g, noReward ? 'Убрали награду — круг рвётся: зачем действовать, если ничего не меняется?' : 'Веселье живёт в круге: действие → вызов → награда → снова. Выключи награду', t, 0.2);
  };
  MOTION['silent-test'] = (g, t, W, H, c = {}) => {
    t %= 9; sky(g, W, H, '#16203a', '#253256');
    const talk = !!c.talk;
    rr(g, 220, 40, 220, 130, 10, '#141c36', '#3a4880'); // экран
    const lost = t > 2 && t < 6, px = 260 + (talk ? Math.min(140, t * 40) : (lost ? 30 + Math.sin(t * 6) * 10 : Math.min(140, (t - 6) * 70 + 30)));
    disc(g, px, 120, 9, '#ff7ad9'); disc(g, 400, 80, 8, '#7cf5a8');
    hero(g, 220, 230, 22, '#5fe0ff', 1); hero(g, 450, 230, 22, '#ffb547', -1); // игрок и автор
    text(g, 'игрок', 220, 262, '#9aa3c7', 11); text(g, 'автор', 450, 262, '#9aa3c7', 11);
    if (talk) { bubble(g, 455, 196, 'Жми вправо! Там звезда!', seg(t, 0.5, 0.9), '#ffe08a'); emo(g, '🙂', 220, 192, 20); text(g, 'находок: 0', 330, 200, '#ff5d6e', 14); }
    else {
      emo(g, '🤐', 450, 192, 22);
      if (lost) { bubble(g, 215, 196, 'Куда идти?..', seg(t, 2.2, 2.6), '#c9f6ff'); }
      const marks = [[2.4, '😕'], [4.2, '❓'], [6.4, '😄']]; marks.forEach(([at, e], i) => { if (t > at) { emo(g, e, 300 + i * 40, 205, 18); } });
      text(g, 'находок: ' + [2.4, 4.2, 6.4].filter(a => t > a).length, 420, 140 + 120, '#7cf5a8', 0.01);
    }
    cap(g, talk ? 'Подсказал — игрок прошёл, а ты не узнал, где игра непонятна. Находок ноль' : 'Молчаливый плейтест: молчи и записывай, где игрок застрял, спросил, засмеялся', t, 0.2);
  };
  // --- урок 31: вертикальный срез ---
  MOTION['slice-cake'] = (g, t, W, H, c = {}) => {
    const slice = !!c.slice; g.fillStyle = '#0d1226'; g.fillRect(0, 0, W, H);
    const L = [['Механика', '#5fe0ff'], ['Уровни', '#7cf5a8'], ['Сочность', '#ffb547'], ['Звук', '#b49bff'], ['Мир и меню', '#ff5fa2']];
    const k = clamp(c._t * 0.7, 0, 1);
    L.forEach(([name, col], i) => {
      const y = 220 - i * 38;
      // по слоям: заполняется весь первый слой, потом следующий; срезом — узкий столбик через все слои
      const fill = slice ? (i <= 4 ? clamp(k * 1.3 - i * 0.05, 0, 1) : 0) : clamp(k * 5 - i, 0, 1) * (i < 2 ? 1 : 0.15);
      rr(g, 60, y, 360, 32, 6, '#1a2445'); text(g, name, 490, y + 16, col, 13, 'left');
      if (slice) rr(g, 210, y, 60 * fill, 32, 6, col); else rr(g, 60, y, 360 * fill, 32, 6, col + (i < 2 ? '' : '88'));
    });
    if (slice && k > 0.8) { g.strokeStyle = '#ffe08a'; g.lineWidth = 3; g.setLineDash([6, 4]); g.strokeRect(204, 64, 72, 192); g.setLineDash([]); emo(g, '🍰', 240, 44, 24); }
    if (!slice && k > 0.9) text(g, 'играть пока не во что', 240, 46, '#ff5d6e', 14);
    cap(g, slice ? 'Вертикальный срез: две минуты, где есть всё — механика, уровень, сочность, звук и мир' : 'По слоям: сначала вся механика, потом все уровни… до показа доживает не всё. Включи «Срезом»', t, 0.2);
  };
  MOTION['two-minutes'] = (g, t, W, H) => {
    t %= 11; sky(g, W, H, '#1a1640', '#322a5c');
    const B = [[0, 'Первые 10 с: понятно, что делать', '🎯'], [25, 'Первая победа', '🏆'], [55, 'Новая вещь', '🆕'], [85, 'Опасно!', '😬'], [110, 'Финал среза: хочется ещё', '🔁']];
    rr(g, 40, 150, 560, 10, 5, '#2a3560'); const k = seg(t, 0.5, 9); rr(g, 40, 150, 560 * k, 10, 5, '#ffd23f');
    B.forEach(([s, name, ic], i) => { const x = 40 + 560 * s / 120, on = k * 120 >= s; disc(g, x, 155, on ? 11 : 7, on ? '#ffd23f' : '#3a4880'); if (on) { emo(g, ic, x, 120, 22); wrap(g, name, x, i % 2 ? 196 : 86, 110, 13, '#f2efe6', 11); } });
    text(g, '0:00', 40, 176, '#9aa3c7', 10); text(g, '2:00', 600, 176, '#9aa3c7', 10);
    cap(g, 'Срез обещает всю игру: в двух минутах видно, во что превратится игра целиком', t, 0.2);
  };
  // В6 аудита: что обещают две минуты настоящей игры — пролог Celeste; «Без звука и сочности» — те же правила, но обещания нет
  MOTION['demo-promise'] = (g, t, W, H, c = {}) => {
    const dry = !!c.dry, T = Math.min(t % 12, 9.4), k = clamp(T / 8, 0, 1), sec = k * 120;
    sky(g, W, H, dry ? '#3a3d46' : '#1d2350', dry ? '#4a4e58' : '#5a4a8a');
    // гора: силуэт и тропа героя
    g.fillStyle = dry ? '#5a5e68' : '#2a2a55'; g.beginPath(); g.moveTo(0, 200); g.lineTo(140, 120); g.lineTo(260, 170); g.lineTo(420, 60); g.lineTo(560, 140); g.lineTo(640, 110); g.lineTo(640, 300); g.lineTo(0, 300); g.fill();
    if (!dry) for (let i = 0; i < 26; i++) { const x = (i * 97 + t * 30) % 660 - 10, y = (i * 53 + t * 40) % 210; disc(g, x, y, 1.6, 'rgba(255,255,255,.7)'); } // снег
    const B = [[0, '🏔️', 'Шаг и прыжок по снегу'], [35, '😱', 'Мост рушится за спиной'], [75, '🐦', 'Птица учит рывку'], [95, '💨', 'Рывок через пропасть!'], [118, '🔁', '«Это гора Селеста» — хочу дальше']];
    const X = 40, Wd = 560, Y = 226;
    rr(g, X, Y, Wd, 8, 4, dry ? '#6a6e78' : '#2a3560'); rr(g, X, Y, Wd * k, 8, 4, dry ? '#9a9ea8' : '#ffd23f');
    text(g, '0:00', X, Y + 20, '#c9d0ee', 10); text(g, '2:00', X + Wd, Y + 20, '#c9d0ee', 10);
    let lit = 0;
    B.forEach(([s, ic, name], i) => {
      const x = X + Wd * s / 120, on = sec >= s, z = on ? ob(seg(sec, s, s + 6)) : 0; if (on) lit++;
      disc(g, x, Y + 4, on ? 8 : 5, on ? (dry ? '#b0b4bc' : '#ffd23f') : '#3a4880');
      if (!on) return;
      const y = i % 2 ? 150 : 104, sh = !dry && sec - s < 4 ? Math.sin(t * 50) * 3 * (1 - (sec - s) / 4) : 0; // тряска на ударе — только с сочностью
      g.save(); g.translate(x + sh, y); g.scale(dry ? 1 : 0.6 + 0.4 * z, dry ? 1 : 0.6 + 0.4 * z);
      if (dry) { disc(g, 0, -14, 12, '#8a8e98'); text(g, '·', 0, -14, '#3a3d46', 18); } else emo(g, ic, 0, -14, 24);
      g.restore();
      wrap(g, name, x, y + 16, 118, 13, dry ? '#d6d8dd' : '#f2efe6', 11);
      if (!dry && sec - s < 6) { confetti(g, x, y - 14, clamp((sec - s) / 6, 0, 0.99), 10, i + 3); text(g, '♪', x + 26, y - 30 - (sec - s) * 3, `rgba(255,224,138,${1 - (sec - s) / 6})`, 16); }
    });
    // справа сверху — обещание: хочется ли дальше
    const want = dry ? 0.12 + lit * 0.04 : 0.1 + lit * 0.18;
    rr(g, 470, 14, 156, 30, 8, 'rgba(11,16,32,.8)'); text(g, 'хочу играть дальше', 536, 29, '#c9d0ee', 11); emo(g, want > 0.6 ? '🤩' : want > 0.3 ? '🙂' : '😐', 612, 29, 16);
    rr(g, 470, 48, 156, 10, 5, '#1a2445'); rr(g, 470, 48, 156 * clamp(want, 0, 1), 10, 5, want > 0.6 ? '#7cf5a8' : '#ffb547');
    text(g, 'Пролог Celeste', 90, 26, dry ? '#d6d8dd' : '#ffe08a', 14);
    cap(g, dry ? 'Те же правила без звука и сочности: понятно, но ничего не обещает' : 'Две минуты: понял, испугался, научился, победил — хочу дальше!', t, 0.2);
  };
  // --- урок 32: плейтест и урезание ---
  MOTION['cut-third'] = (g, t, W, H, c = {}) => {
    g.fillStyle = '#0d1226'; g.fillRect(0, 0, W, H);
    const cut = !!c.cut, k = cut ? clamp(c._t * 0.8, 0, 1) : 0;
    const F = ['Основной цикл', 'Рекорд класса', 'Проигрыш за секунду', 'Второй враг', 'Три уровня', 'Босс', 'Магазин', 'Сюжетная заставка', 'Сетевой режим'];
    F.forEach((s, i) => {
      const drop = i >= 6, kk = drop ? clamp(k * 3 - (i - 6) * 0.5, 0, 1) : 0, y = 24 + i * 25;
      g.save(); g.globalAlpha = 1 - kk * 0.75; g.translate(kk * 120, kk * 10);
      rr(g, 40, y, 250, 21, 6, i < 3 ? '#1f5a3c' : '#2a3560'); text(g, s, 165, y + 11, i < 3 ? '#7cf5a8' : '#c9d0ee', 12);
      g.restore(); if (kk > 0 && kk < 1) emo(g, '✂️', 40 + 250 * kk, y + 11, 18);
    });
    // время до Фестиваля и полоса готовности
    const ready = cut ? 0.45 + 0.5 * k : 0.45, need = cut ? 1 - 0.33 * k : 1;
    text(g, 'Готовность к Фестивалю', 470, 60, '#f2efe6', 14);
    rr(g, 360, 80, 220, 22, 11, '#1a2445'); rr(g, 360, 80, 220 * Math.min(1, ready / need), 22, 11, ready / need >= 0.95 ? '#7cf5a8' : '#ffb547');
    text(g, Math.round(100 * Math.min(1, ready / need)) + '%', 470, 91, '#0b1020', 12);
    emo(g, ready / need >= 0.95 ? '🎪' : '⏳', 470, 150, 40);
    text(g, cut ? `вычеркнуто ${Math.round(3 * k)} из 9 — треть` : 'задумано 9, успеем 4–5', 470, 200, cut ? '#7cf5a8' : '#ff5d6e', 13);
    cap(g, cut ? 'Вычеркнули треть — то, что осталось, успеем довести до блеска' : 'Главный навык модуля — вычёркивать. Включи ножницы', t, 0.2);
  };
  MOTION.moscow = (g, t, W, H) => {
    t %= 10; g.fillStyle = '#10172d'; g.fillRect(0, 0, W, H);
    const C = [['Должно', '#7cf5a8', 'без этого игры нет'], ['Хорошо бы', '#ffd23f', 'если успеем'], ['Потом', '#9aa3c7', 'после Фестиваля']];
    C.forEach(([n, col, sub], i) => { const x = 30 + i * 200; rr(g, x, 40, 180, 200, 12, '#141c36', col); text(g, n, x + 90, 60, col, 15); text(g, sub, x + 90, 78, '#9aa3c7', 10, 'center', 600); });
    const items = [['Глагол: прыгать', 0], ['Рекорд', 0], ['Второй враг', 1], ['Музыка', 1], ['Магазин', 2], ['Сюжет', 2], ['Сеть', 2]];
    items.forEach(([s, col], i) => {
      const at = 0.4 + i * 0.9, k = io(seg(t, at, at + 0.7)), slot = items.slice(0, i).filter(x => x[1] === col).length;
      const x0 = 320, y0 = 0, x1 = 30 + col * 200 + 90, y1 = 104 + slot * 32;
      const x = lerp(x0, x1, k), y = lerp(y0, y1, k) - Math.sin(k * Math.PI) * 30;
      if (t < at) return;
      rr(g, x - 70, y - 12, 140, 24, 6, col === 2 ? '#2a3560' : '#ffe9a0'); text(g, s, x, y, col === 2 ? '#9aa3c7' : '#3a2400', 11);
    });
    cap(g, 'Три корзины: «должно» — ядро, «хорошо бы» — если успеем, «потом» — список после Фестиваля', t, 0.2);
  };
  MOTION.telemetry = (g, t, W, H, c = {}) => {
    g.fillStyle = '#0d1226'; g.fillRect(0, 0, W, H);
    const all = !!c.all, n = all ? 4 : 1;
    text(g, all ? 'Сводка четырёх игроков' : 'Один игрок', 320, 26, '#f2efe6', 14);
    // полоса уровня: где бросили игру
    rr(g, 40, 70, 560, 40, 8, '#1a2445');
    const quits = [0.28, 0.31, 0.72, 0.3].slice(0, n), dur = [0.28, 0.31, 0.72, 0.3];
    for (let i = 0; i < n; i++) { const k = clamp((t - i * 0.25) * 0.5, 0, 1) * dur[i]; rr(g, 40, 120 + i * 22, 560 * k, 14, 7, colorOf('p' + i)); if (k >= dur[i] - 0.001) emo(g, '🚪', 40 + 560 * k + 10, 127 + i * 22, 14); }
    if (all) { glow(g, 40 + 560 * 0.3, 90, 50, 'rgba(255,93,110,.55)'); text(g, '3 из 4 ушли здесь', 40 + 560 * 0.3, 60, '#ff5d6e', 12); }
    text(g, 'начало', 50, 90, '#9aa3c7', 11, 'left'); text(g, 'конец', 590, 90, '#9aa3c7', 11, 'right');
    cap(g, all ? 'Один ушёл — случайность. Трое в одном месте — находка: там игру и чиним' : 'Один игрок ушёл на трети. Это мнение или правда? Включи сводку', t, 0.2);
  };
  // --- урок 33: контент ---
  // интерес игрока за 10 минут: каждая новинка поднимает интерес, без новинок он тает; передышка снимает усталость
  function interest(beats, mins = 10, steps = 200) {
    const out = []; let v = 0.85, tired = 0;
    const sorted = beats.slice().sort((a, b) => a.at - b.at);
    for (let i = 0; i <= steps; i++) {
      const m = i / steps * mins, dm = mins / steps;
      v -= dm * (0.06 + tired * 0.05); tired += dm * 0.12;
      for (const b of sorted) if (b.at > m - dm && b.at <= m) {
        const K = BEAT_K[b.kind] || BEAT_K.vrag;
        v += K.up * (tired > 0.6 && b.kind !== 'otdyh' ? 0.7 : 1); tired = Math.max(0, tired + K.tired);
      }
      v = clamp(v, 0, 1); out.push(v);
    }
    return out;
  }
  const BEAT_K = { vrag: { icon: '👾', label: 'Новый враг', up: 0.22, tired: 0.05 }, mesto: { icon: '🗺️', label: 'Новое место', up: 0.26, tired: -0.1 }, istoriya: { icon: '📜', label: 'Кусок истории', up: 0.14, tired: -0.2 }, boss: { icon: '👹', label: 'Босс', up: 0.4, tired: 0.15 }, otdyh: { icon: '🌿', label: 'Передышка', up: 0.04, tired: -0.55 }, nagrada: { icon: '🎁', label: 'Награда', up: 0.18, tired: -0.05 } };
  function curveDraw(g, x, y, w, h, vals, upto = 1, col = '#7cf5a8') {
    g.strokeStyle = col; g.lineWidth = 3; g.beginPath();
    const n = Math.max(1, Math.floor((vals.length - 1) * upto));
    for (let i = 0; i <= n; i++) { const px = x + w * i / (vals.length - 1), py = y + h * (1 - vals[i]); i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.stroke(); return { x: x + w * n / (vals.length - 1), y: y + h * (1 - vals[n]), v: vals[n] };
  }
  MOTION.enough = (g, t, W, H, c = {}) => {
    g.fillStyle = '#0d1226'; g.fillRect(0, 0, W, H);
    const beats = [];
    if (c.vrag) [2, 4, 6, 8].forEach(m => beats.push({ at: m, kind: 'vrag' }));
    if (c.otdyh) [3.5, 7].forEach(m => beats.push({ at: m, kind: 'otdyh' }));
    if (c.boss) beats.push({ at: 9, kind: 'boss' });
    const vals = interest(beats), X = 50, Y = 50, Wd = 540, Hd = 170;
    g.strokeStyle = '#2a3560'; g.lineWidth = 1; for (let m = 0; m <= 10; m++) { g.beginPath(); g.moveTo(X + Wd * m / 10, Y); g.lineTo(X + Wd * m / 10, Y + Hd); g.stroke(); text(g, m + '′', X + Wd * m / 10, Y + Hd + 12, '#6a7090', 9); }
    g.fillStyle = 'rgba(255,93,110,.12)'; g.fillRect(X, Y + Hd * 0.75, Wd, Hd * 0.25); text(g, 'скучно — уйду', X + 6, Y + Hd * 0.88, '#ff5d6e', 10, 'left');
    beats.forEach(b => emo(g, BEAT_K[b.kind].icon, X + Wd * b.at / 10, Y - 10, 16));
    const k = (t % 7) / 6, p = curveDraw(g, X, Y, Wd, Hd, vals, Math.min(1, k));
    emo(g, p.v > 0.55 ? '🤩' : p.v > 0.3 ? '🙂' : '😴', p.x, p.y - 18, 22);
    const quit = vals.findIndex(v => v < 0.25), qm = quit < 0 ? null : quit / (vals.length - 1) * 10;
    cap(g, qm == null ? 'Интерес держится все 10 минут — игре хватает контента' : `Игрок заскучает на ${qm.toFixed(1).replace('.', ',')}-й минуте. Включай новинки и передышки`, t, 0.2);
  };
  MOTION['content-data'] = (g, t, W, H) => {
    t %= 10; g.fillStyle = '#10172d'; g.fillRect(0, 0, W, H);
    const P = [['🗺️', 'Уровни из букв', 'урок 15', ['#####', '#@ $#', '#  .#', '#####']], ['⚖️', 'Баланс в таблице', 'урок 13', ['враг  жизни урон', 'волк    3    1', 'иныж   12    3']], ['📜', 'История на картах', 'карты событий', ['1. Зима пришла', '2. Цветок замёрз', '3. Улей ждёт']]];
    P.forEach(([ic, name, sub, lines], i) => {
      const x = 30 + i * 200, k = ob(seg(t, 0.4 + i * 0.8, 1 + i * 0.8)); if (k <= 0) return;
      g.save(); g.translate(x + 90, 130); g.scale(k, k); rr(g, -90, -100, 180, 200, 12, '#141c36', '#3a4880');
      emo(g, ic, 0, -74, 26); text(g, name, 0, -44, '#f2efe6', 13); text(g, sub, 0, -26, '#9aa3c7', 10, 'center', 600);
      g.font = '700 12px ui-monospace,monospace'; g.textAlign = 'left'; g.fillStyle = '#ffe08a'; lines.forEach((l, j) => g.fillText(l, -72, 4 + j * 18));
      g.restore();
    });
    cap(g, 'Контент — это данные: уровни, числа и история меняются без кода. Соседи строят и проверяют', t, 0.2);
  };
  // В6 аудита: темп нового на шкале 10 минут известной игры — первый мир Super Mario Bros.; «Всё новое в первую минуту» — интерес гаснет
  const MARIO = [[0.1, 'vrag', '🍄', 'Первый враг'], [0.4, 'nagrada', '❓', 'Гриб: растёшь'], [0.8, 'vrag', '🐢', 'Черепаха'], [1.4, 'nagrada', '⭐', 'Звезда'], [2, 'otdyh', '🚩', 'Флаг: 1-1'],
    [2.6, 'mesto', '🕳️', 'Подземелье 1-2'], [4.4, 'mesto', '🌳', 'Над пропастью 1-3'], [6.4, 'mesto', '🏰', 'Замок 1-4'], [7.6, 'vrag', '🔥', 'Огненные палки'], [9, 'boss', '🐲', 'Боузер']];
  MOTION['tempo-10'] = (g, t, W, H, c = {}) => {
    g.fillStyle = '#0d1226'; g.fillRect(0, 0, W, H);
    const rush = !!c.rush, beats = MARIO.map(([at, kind, ic, name], i) => ({ at: rush ? 0.1 + i * 0.09 : at, kind, ic, name }));
    const vals = interest(beats), X = 50, Y = 64, Wd = 540, Hd = 150;
    g.strokeStyle = '#2a3560'; g.lineWidth = 1; for (let m = 0; m <= 10; m++) { g.beginPath(); g.moveTo(X + Wd * m / 10, Y); g.lineTo(X + Wd * m / 10, Y + Hd); g.stroke(); text(g, m + '′', X + Wd * m / 10, Y + Hd + 12, '#6a7090', 9); }
    g.fillStyle = 'rgba(255,93,110,.12)'; g.fillRect(X, Y + Hd * 0.75, Wd, Hd * 0.25); text(g, 'скучно — уйду', X + 6, Y + Hd * 0.88, '#ff5d6e', 10, 'left');
    const k = Math.min(1, (t % 9) / 7.5), p = curveDraw(g, X, Y, Wd, Hd, vals, k, rush ? '#ffb547' : '#7cf5a8');
    // новинки над лентой: зажигаются, когда кривая до них дошла; подписи — только без «всё сразу», иначе их не прочесть
    beats.forEach((b, i) => { const x = X + Wd * b.at / 10, on = k * 10 >= b.at; g.globalAlpha = on ? 1 : 0.35; emo(g, b.ic, x, (rush ? 30 + (i % 2) * 16 : 36), 16); g.globalAlpha = 1; if (!rush && on && i % 2 === 0) text(g, b.name, x, 14, '#9aa3c7', 9); if (!rush && on && i % 2) text(g, b.name, x, 54, '#9aa3c7', 9); });
    emo(g, p.v > 0.55 ? '🤩' : p.v > 0.3 ? '🙂' : '😴', p.x, p.y - 18, 22);
    const quit = vals.findIndex(v => v < 0.25), qm = quit < 0 ? null : quit / (vals.length - 1) * 10;
    cap(g, rush ? `Всё новое в первую минуту: взлёт — и пусто. Игрок заскучает на ${qm == null ? 10 : qm.toFixed(1).replace('.', ',')}-й минуте` : 'Новое каждые минуту-две, передышка у флага, босс в конце', t, 0.2);
  };
  // --- урок 34: внешний плейтест ---
  MOTION.stranger = (g, t, W, H, c = {}) => {
    t %= 9; sky(g, W, H, '#16203a', '#253256');
    const str = !!c.str;
    rr(g, 200, 36, 240, 130, 10, '#141c36', '#3a4880');
    text(g, str ? '???' : 'Wasd, F — бомба, это я знаю', 320, 100, str ? '#ff5d6e' : '#7cf5a8', str ? 26 : 13);
    hero(g, 320, 222, 24, str ? '#ffb547' : '#5fe0ff', 1, 0);
    emo(g, str ? (t < 4 ? '🤔' : t < 7 ? '😕' : '💡') : '😎', 320, 180, 24);
    text(g, str ? 'гость, 10 лет — видит игру впервые' : 'одноклассник — видел, как ты её делал', 320, 258, '#9aa3c7', 11);
    if (str && t > 2) bubble(g, 440, 190, 'А что нажимать?', seg(t, 2, 2.4), '#c9f6ff');
    if (!str && t > 2) bubble(g, 430, 190, 'Да всё понятно!', seg(t, 2, 2.4), '#c9f6ff');
    cap(g, str ? 'Чужой не знает того, что знаешь ты. Его вопросы — самые честные находки' : 'Свой знает игру заранее: он не увидит, что непонятно. Включи «Чужой»', t, 0.2);
  };
  // В6 аудита: как наблюдать за гостем — во время партии молчать и ставить метки, после — спросить открытым вопросом.
  // «Автор подсказывает» — гость проходит, а находка пропала; «Спросить „Понравилось?“» — ответ «ну да» ничего не говорит
  MOTION['guest-watch'] = (g, t, W, H, c = {}) => {
    const hint = !!c.hint, bad = !!c.bad, T = Math.min(t % 12, 10.5), after = T >= 5.5;
    sky(g, W, H, '#16203a', '#253256');
    rr(g, 150, 24, 220, 120, 10, '#141c36', '#3a4880'); // экран игры
    text(g, after ? 'партия окончена' : 'игра гостя', 260, 38, '#6a7090', 10);
    // герой гостя на экране: без подсказки топчется у пропасти, потом догадывается; с подсказкой проходит сразу
    const stuck = !hint && T > 1.6 && T < 4.2, hx = after ? 340 : hint ? 170 + Math.min(1, T / 3) * 170 : stuck ? 230 + Math.sin(T * 7) * 8 : T < 1.6 ? 170 + T * 38 : 230 + Math.min(1, (T - 4.2) / 1.6) * 110;
    rr(g, 160, 112, 90, 10, 3, '#5d6b9a'); rr(g, 300, 112, 60, 10, 3, '#5d6b9a'); disc(g, hx, 102, 8, '#ff7ad9');
    hero(g, 120, 240, 22, '#ffb547', 1); hero(g, 420, 240, 22, '#5fe0ff', -1); // гость и автор
    text(g, 'гость', 120, 274, '#9aa3c7', 11); text(g, 'автор', 420, 274, '#9aa3c7', 11);
    // лента меток справа: что увидел автор
    const marks = hint ? [] : [[1.8, '😕', 'застрял у пропасти'], [3, '❓', '«а как прыгать?»'], [4.4, '💡', 'догадался сам']].filter(m => T > m[0]);
    const answers = after && T > 7 && !hint && !bad ? [['Не понял, как прыгать', 7], ['Хотел бросить у пропасти', 7.6]].filter(a => T > a[1]) : []; // с подсказкой гость не застревал — и после сказать нечего
    rr(g, 470, 24, 156, 170, 10, 'rgba(11,16,32,.8)'); text(g, 'Находки автора', 548, 40, '#f2efe6', 12);
    marks.forEach(([, e, s], i) => { emo(g, e, 488, 64 + i * 26, 16); text(g, s, 502, 64 + i * 26, '#c9d0ee', 10, 'left', 700); });
    answers.forEach(([s], i) => { emo(g, '🗣️', 488, 64 + (marks.length + i) * 26, 14); text(g, s, 502, 64 + (marks.length + i) * 26, '#7cf5a8', 10, 'left', 700); });
    const n = marks.length + answers.length;
    text(g, `находок: ${n}`, 548, 182, n ? '#7cf5a8' : '#ff5d6e', 13);
    if (!after) {
      if (hint) { bubble(g, 420, 206, 'Жми прыжок дольше! Туда!', seg(T, 1.4, 1.8), '#ffe08a'); emo(g, '🙂', 120, 206, 20); }
      else { emo(g, '🤐', 420, 206, 22); if (stuck) bubble(g, 125, 206, 'А как тут прыгать?', seg(T, 2.8, 3.2), '#c9f6ff'); }
      text(g, 'Во время партии', 260, 162, '#ffe08a', 13);
    } else {
      text(g, 'После партии', 260, 162, '#ffe08a', 13);
      bubble(g, 420, 206, bad ? 'Понравилось?' : 'Где было непонятно?', seg(T, 5.8, 6.2), '#ffe08a');
      if (T > 6.6) bubble(g, 125, 206, bad ? 'Ну… да' : hint ? 'Да всё понятно было' : 'У пропасти. И я не знал…', seg(T, 6.6, 7), '#c9f6ff');
    }
    cap(g, hint ? 'Автор подсказал — гость прошёл, а находок ноль. На Фестивале тебя рядом не будет' : bad ? '«Понравилось?» — «Ну да». Такой вопрос ничего не даёт: спроси, где было непонятно' : after ? 'После партии — открытый вопрос: «Где было непонятно? Где хотелось бросить?»' : 'Во время партии молчи и ставь метки: застрял, спросил, догадался', t, 0.2);
  };
  MOTION['observe-marks'] = (g, t, W, H) => {
    t %= 10; g.fillStyle = '#0d1226'; g.fillRect(0, 0, W, H);
    const M = [[0.8, '😕', 'застрял'], [2.1, '❓', 'спросил'], [3.6, '😄', 'засмеялся'], [5.2, '😕', 'застрял'], [6.4, '😄', 'засмеялся'], [7.8, '🔁', 'ещё раз!']];
    rr(g, 40, 120, 560, 8, 4, '#2a3560'); const k = seg(t, 0.3, 9); rr(g, 40, 120, 560 * k, 8, 4, '#5fe0ff');
    M.forEach(([at, e, n], i) => { if (k * 9 < at) return; const x = 40 + 560 * at / 9, z = ob(seg(k * 9, at, at + 0.4)); g.save(); g.translate(x, 100); g.scale(z, z); emo(g, e, 0, 0, 22); g.restore(); text(g, n, x, i % 2 ? 150 : 76, '#9aa3c7', 10); });
    const n = M.filter(m => k * 9 >= m[0]).length; text(g, `меток: ${n} · застрял ${M.filter(m => k * 9 >= m[0] && m[2] === 'застрял').length} раза`, 320, 200, '#f2efe6', 14);
    cap(g, 'Наблюдатель жмёт метку в ту секунду, когда это случилось. Потом видно, где игра теряет гостя', t, 0.2);
  };
  // --- урок 35: полировка и упаковка ---
  MOTION['first-10s'] = (g, t, W, H, c = {}) => {
    g.fillStyle = '#0d1226'; g.fillRect(0, 0, W, H);
    rr(g, 140, 24, 360, 220, 12, '#141c36', '#3a4880');
    const n = ['menu', 'learn', 'credits', 'a11y'].filter(k => c[k]).length;
    if (c.menu) { text(g, 'ПЧЕЛА И ЗИМА', 320, 62, '#ffd23f', 24); rr(g, 270, 80, 100, 26, 13, '#7cf5a8'); text(g, '▶ Играть', 320, 93, '#0b1020', 13); } else text(g, 'index.html', 320, 62, '#6a7090', 14);
    if (c.learn) { emo(g, '👆', 230 + Math.sin(t * 4) * 6, 160, 26); text(g, '← → летать', 320, 150, '#f2efe6', 13); text(g, 'неси пыльцу в улей', 320, 170, '#9aa3c7', 12); }
    if (c.credits) text(g, 'Авторы: Аня и Тимур · по мотивам механики Flappy Bird', 320, 228, '#9aa3c7', 10);
    if (c.a11y) { rr(g, 440, 34, 50, 22, 6, '#2a3560'); text(g, '♿ Aa', 465, 45, '#f2efe6', 11); }
    hero(g, 560, 160, 22, '#ffb547', -1); emo(g, ['😕', '🤔', '🙂', '😃', '🤩'][n], 560, 116, 26);
    text(g, `${n} из 4`, 560, 210, n === 4 ? '#7cf5a8' : '#9aa3c7', 13);
    cap(g, n < 4 ? 'Первые 10 секунд: гость решает, остаться ли. Включи всё, что ему нужно' : 'Меню, обучение делом, титры и доступность — гость понял игру за 10 секунд', t, 0.2);
  };
  MOTION['trailer-beats'] = (g, t, W, H) => {
    t %= 12; g.fillStyle = '#0d1226'; g.fillRect(0, 0, W, H);
    const S = [[3, '🎣', 'Крючок', '#ff5fa2'], [7, '🎮', 'Глагол', '#5fe0ff'], [8, '🌀', 'Твист', '#ffb547'], [7, '😬', 'Напряжение', '#b49bff'], [5, '🏷️', 'Название и QR', '#7cf5a8']];
    let acc = 0; const k = seg(t, 0.4, 10.4) * 30;
    S.forEach(([d, ic, n, col]) => { const x = 40 + 560 * acc / 30, w = 560 * d / 30, on = k >= acc && k < acc + d; rr(g, x + 2, 170, w - 4, 34, 6, on ? col : col + '44'); text(g, `${n} · ${d} с`, x + w / 2, 187, on ? '#0b1020' : '#f2efe6', 10); if (on) { rr(g, 170, 26, 300, 130, 10, '#141c36', col); emo(g, ic, 320, 76, 40); text(g, n, 320, 128, col, 18); } acc += d; });
    g.fillStyle = '#fff'; g.fillRect(40 + 560 * k / 30, 164, 2, 46);
    cap(g, 'Трейлер на 30 секунд: крючок, глагол, твист, напряжение и название — записью из самой игры', t, 0.2);
  };
  MOTION['stand-card'] = (g, t, W, H) => {
    t %= 9; sky(g, W, H, '#1a1640', '#2f2a5a');
    const parts = [['ПЧЕЛА И ЗИМА', 0.4], ['Аня, Тимур · 7 «Б»', 1.1], ['← → летать, A — нести', 1.8], ['по мотивам механики Flappy Bird', 2.5], ['QR', 3.2], ['Рекорд дня: 14', 3.9]];
    rr(g, 170, 20, 300, 236, 14, '#fffbe8');
    parts.forEach(([s, at], i) => {
      const k = ob(seg(t, at, at + 0.5)); if (k <= 0) return;
      g.save(); g.translate(320, [56, 86, 112, 134, 186, 238][i]); g.scale(k, k);
      if (s === 'QR') { const r = rng(7); for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if (r() > 0.5 || (x < 3 && y < 3) || (x > 5 && y < 3) || (x < 3 && y > 5)) { g.fillStyle = '#1b1430'; g.fillRect(-36 + x * 8, -36 + y * 8, 8, 8); } }
      else text(g, s, 0, 0, i === 0 ? '#1b1430' : i === 5 ? '#c23a00' : '#3a3550', i === 0 ? 22 : 12, 'center', i === 0 ? 900 : 700);
      g.restore();
    });
    if (t > 4.5) { hero(g, 540, 200, 20, '#5fe0ff', -1); emo(g, '📱', 512, 196, 18); bubble(g, 545, 160, 'Сыграю дома!', seg(t, 4.6, 5), '#c9f6ff'); }
    cap(g, 'Карточка стенда: название, авторы, управление, «по мотивам», QR и рекорд дня', t, 0.2);
  };
  // --- урок 36: Фестиваль ---
  MOTION['fest-program'] = (g, t, W, H) => {
    t %= 11; sky(g, W, H, '#2a1640', '#4a2a5a');
    const P = [['🎬', 'Трейлеры', 2], ['🕹️', 'Аркадный час', 50], ['🏆', 'Турнир и Арена', 20], ['🎤', 'Питчи финалистов', 15], ['🏅', 'Награждение', 10]];
    const total = 97; let acc = 0; const k = seg(t, 0.4, 9.5) * total;
    P.forEach(([ic, n, m], i) => { const x = 30 + 580 * acc / total, w = Math.max(60, 580 * m / total); const on = k >= acc, now = k >= acc && k < acc + m; const xx = i === 0 ? 30 : x; rr(g, xx, 140, Math.max(56, w - 4), 40, 8, now ? '#ffd23f' : on ? '#7a5a9a' : '#3a2a50'); emo(g, ic, xx + Math.max(56, w - 4) / 2, 118, 22); text(g, n, xx + Math.max(56, w - 4) / 2, i % 2 ? 200 : 214, now ? '#ffd23f' : '#d8c8ee', 11); text(g, m + ' мин', xx + Math.max(56, w - 4) / 2, 160, now ? '#3a2400' : '#f2efe6', 11); acc += m; });
    for (let i = 0; i < 14; i++) { const x = (i * 53 + t * 20) % 640; disc(g, x, 40 + Math.sin(i + t * 2) * 8, 3, ['#ffd23f', '#ff5fa2', '#5fe0ff'][i % 3]); }
    cap(g, 'Фестиваль: трейлеры, аркадный час для гостей, турнир, питчи и награждение', t, 0.2);
  };
  MOTION['guest-happy'] = (g, t, W, H, c = {}) => {
    t %= 9; sky(g, W, H, '#2a1640', '#4a2a5a');
    const n = ['smile', 'record', 'again'].filter(k => c[k]).length;
    rr(g, 230, 50, 180, 120, 10, '#141c36', '#3a4880'); text(g, c.record ? '🏆 рекорд дня: 14' : 'игра', 320, 76, c.record ? '#ffd23f' : '#6a7090', 13);
    disc(g, 320 + Math.sin(t * 3) * 40, 120, 8, '#ff7ad9');
    hero(g, 480, 220, 22, '#5fe0ff', -1); // автор у стенда
    emo(g, c.smile ? '😃' : '😐', 480, 180, 22);
    if (c.smile) bubble(g, 480, 150, 'Привет! Попробуешь?', seg(t, 0.4, 0.8), '#ffe08a');
    // гость: подходит, играет, остаётся или уходит
    const stay = n >= 2, gx = t < 2 ? lerp(-20, 260, io(seg(t, 0, 2))) : t < 6 ? 260 : stay ? 260 : lerp(260, -40, io(seg(t, 6, 8)));
    hero(g, gx, 226, 20, '#ffb547', t > 6 && !stay ? -1 : 1);
    emo(g, t < 2 ? '🙂' : t < 6 ? (n ? '😄' : '😐') : stay ? '🤩' : '😴', gx, 190, 20);
    if (c.again && t > 5) bubble(g, gx, 160, 'Ещё раз!', seg(t, 5, 5.4), '#c9f6ff');
    if (stay && t > 6) confetti(g, gx, 180, seg(t, 6, 8), 16, 5);
    cap(g, stay ? 'Гость остался и позвал друга: улыбка, рекорд на экране и «ещё раз» за секунду' : 'Гость ушёл через минуту. Включи то, что держит гостя у стенда', t, 0.2);
  };
  MOTION.awards = (g, t, W, H) => {
    t %= 10; sky(g, W, H, '#2a1640', '#4a2a5a');
    const N = [['👥', 'Выбор зрителей', 'жетоны гостей'], ['🔁', 'Ещё раз!', 'повторные партии'], ['🌀', 'Лучший твист', 'жюри'], ['📈', 'Самый большой рост', 'от первой игры до финала']];
    N.forEach(([ic, n, sub], i) => { const x = 90 + i * 155, k = ob(seg(t, 0.6 + i * 1.2, 1.2 + i * 1.2)); if (k <= 0) return; g.save(); g.translate(x, 130); g.scale(k, k); glow(g, 0, -20, 60, 'rgba(255,210,63,.35)'); disc(g, 0, -20, 34, '#ffd23f'); emo(g, ic, 0, -22, 26); text(g, n, 0, 34, '#ffe08a', 13); text(g, sub, 0, 54, '#d8c8ee', 10, 'center', 600); g.restore(); });
    if (t > 5.4) confetti(g, 320, 80, seg(t, 5.4, 7.5), 30, 9);
    cap(g, 'Номинации: часть считает портал по партиям и жетонам, часть решает жюри', t, 0.2);
  };

  /* =================== QR-код (байтовый режим, уровень L, версии 1–6) =================== */
  // для карточки стенда: ссылка на игру в аркаде. Небольшой честный кодировщик без библиотек
  const QR = (() => {
    const EXP = new Array(512), LOG = new Array(256);
    for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
    const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
    function rsGen(n) { let p = [1]; for (let i = 0; i < n; i++) { const q = new Array(p.length + 1).fill(0); for (let j = 0; j < p.length; j++) { q[j] ^= p[j]; q[j + 1] ^= mul(p[j], EXP[i]); } p = q; } return p; }
    function rs(data, n) { const gen = rsGen(n), r = new Array(n).fill(0); for (const d of data) { const f = d ^ r[0]; r.shift(); r.push(0); for (let i = 0; i < n; i++) r[i] ^= mul(gen[i + 1], f); } return r; }
    // версия: [всего кодовых слов, ec на блок, блоков]; уровень L
    const VER = { 1: [26, 7, 1], 2: [44, 10, 1], 3: [70, 15, 1], 4: [100, 20, 1], 5: [134, 26, 1], 6: [172, 18, 2] };
    const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34] };
    function encode(str) {
      const bytes = [...new TextEncoder().encode(str)];
      let ver = 1; for (; ver <= 6; ver++) { const [tot, ec, bl] = VER[ver]; if ((tot - ec * bl) - 2 >= bytes.length) break; }
      if (ver > 6) throw new Error('Слишком длинная ссылка для QR');
      const [tot, ec, bl] = VER[ver], dataN = tot - ec * bl;
      const bits = []; const put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >> i) & 1); };
      put(4, 4); put(bytes.length, 8); bytes.forEach(b => put(b, 8)); put(0, Math.min(4, dataN * 8 - bits.length));
      while (bits.length % 8) bits.push(0);
      const data = []; for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
      for (let p = 0; data.length < dataN; p++) data.push(p % 2 ? 0x11 : 0xec);
      const per = dataN / bl, blocks = [], ecs = [];
      for (let b = 0; b < bl; b++) { const d = data.slice(b * per, (b + 1) * per); blocks.push(d); ecs.push(rs(d, ec)); }
      const code = []; for (let i = 0; i < per; i++) blocks.forEach(d => code.push(d[i])); for (let i = 0; i < ec; i++) ecs.forEach(e => code.push(e[i]));
      const N = 17 + ver * 4, m = Array.from({ length: N }, () => new Array(N).fill(null)), fn = Array.from({ length: N }, () => new Array(N).fill(false));
      const set = (x, y, v) => { m[y][x] = v; fn[y][x] = true; };
      const finder = (x0, y0) => { for (let y = -1; y <= 7; y++) for (let x = -1; x <= 7; x++) { const X = x0 + x, Y = y0 + y; if (X < 0 || Y < 0 || X >= N || Y >= N) continue; const on = x >= 0 && x <= 6 && y >= 0 && y <= 6 && (x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4)); set(X, Y, on); } };
      finder(0, 0); finder(N - 7, 0); finder(0, N - 7);
      for (let i = 8; i < N - 8; i++) { set(i, 6, i % 2 === 0); set(6, i, i % 2 === 0); }
      const al = ALIGN[ver]; if (al.length) { const c = al[1]; for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) set(c + x, c + y, Math.max(Math.abs(x), Math.abs(y)) !== 1); }
      set(8, N - 8, true); // тёмный модуль
      for (let i = 0; i < 9; i++) { if (!fn[8][i]) fn[8][i] = true; if (!fn[i][8]) fn[i][8] = true; } for (let i = 0; i < 8; i++) { fn[8][N - 1 - i] = true; fn[N - 1 - i][8] = true; }
      // данные змейкой снизу вверх по парам столбцов
      const cbits = []; code.forEach(b => { for (let i = 7; i >= 0; i--) cbits.push((b >> i) & 1); });
      let k = 0, up = true;
      for (let x = N - 1; x > 0; x -= 2) { if (x === 6) x--; for (let j = 0; j < N; j++) { const y = up ? N - 1 - j : j; for (const dx of [0, 1]) { const X = x - dx; if (fn[y][X]) continue; m[y][X] = k < cbits.length ? !!cbits[k] : false; k++; } } up = !up; }
      // маска с наименьшим штрафом
      const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0, (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0];
      function format(mask) { const d = (1 << 3) | mask; let v = d << 10; for (let i = 14; i >= 10; i--) if (v & (1 << i)) v ^= 0x537 << (i - 10); return ((d << 10) | v) ^ 0x5412; } // уровень L = 01
      function apply(mask) {
        const r = m.map((row, y) => row.map((v, x) => (fn[y][x] ? v : v !== MASKS[mask](x, y))));
        const f = format(mask), bit = i => !!((f >> i) & 1);
        for (let i = 0; i <= 5; i++) r[i][8] = bit(i); r[7][8] = bit(6); r[8][8] = bit(7); r[8][7] = bit(8); for (let i = 9; i < 15; i++) r[8][14 - i] = bit(i);
        for (let i = 0; i < 8; i++) r[8][N - 1 - i] = bit(i); for (let i = 8; i < 15; i++) r[N - 15 + i][8] = bit(i);
        r[N - 8][8] = true;
        return r;
      }
      function penalty(r) {
        let p = 0;
        for (let y = 0; y < N; y++) for (let run = 1, x = 1; x <= N; x++) { if (x < N && r[y][x] === r[y][x - 1]) run++; else { if (run >= 5) p += run - 2; run = 1; } }
        for (let x = 0; x < N; x++) for (let run = 1, y = 1; y <= N; y++) { if (y < N && r[y][x] === r[y - 1][x]) run++; else { if (run >= 5) p += run - 2; run = 1; } }
        for (let y = 0; y < N - 1; y++) for (let x = 0; x < N - 1; x++) { const v = r[y][x]; if (v === r[y][x + 1] && v === r[y + 1][x] && v === r[y + 1][x + 1]) p += 3; }
        const dark = r.flat().filter(Boolean).length; p += Math.floor(Math.abs(dark * 20 - N * N * 10) / (N * N)) * 10;
        return p;
      }
      let best = null, bp = Infinity; for (let mk = 0; mk < 8; mk++) { const r = apply(mk), p = penalty(r); if (p < bp) { bp = p; best = r; } }
      return best;
    }
    function svg(str, px = 4) {
      const r = encode(str), N = r.length, q = 4, size = (N + q * 2) * px;
      let d = ''; r.forEach((row, y) => row.forEach((v, x) => { if (v) d += `M${(x + q) * px} ${(y + q) * px}h${px}v${px}h-${px}z`; }));
      const NS = 'http://www.w3.org/2000/svg', s = document.createElementNS(NS, 'svg');
      s.setAttribute('viewBox', `0 0 ${size} ${size}`); s.setAttribute('class', 'm8-qr'); s.setAttribute('role', 'img'); s.setAttribute('aria-label', 'QR-код: ' + str);
      s.innerHTML = `<rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#111"/>`;
      return s;
    }
    return { encode, svg };
  })();
  window.LabQR = QR;

  /* =================== общие данные проекта =================== */
  const PJ = { data: null, loading: null };
  const loadPJ = () => { PJ.loading = PJ.loading || api('/api/proekt').then(r => { PJ.data = r; PJ.loading = null; return r; }).catch(e => { PJ.loading = null; throw e; }); return PJ.loading; };
  function live(host, draw, kinds = ['proekt']) { S.hooks.push((kind) => { if (kinds.includes(kind) && host.isConnected) loadPJ().then(draw).catch(() => {}); }); }
  const stepVal = (type, f) => { const st = S.lesson.checkpoints.flatMap(c => c.steps).find(s => s.type === type); return st ? f(st, (ans(st.id).value) || {}) : null; };
  const facV = () => { const id = (S.lesson.plan || {}).factory || 'fabrika'; return (ans(id).value) || {}; };
  const decV = () => { const id = (S.lesson.plan || {}).decisions || 'resheniya'; return ((ans(id).value) || {}).fields || {}; };
  const field = (o, k) => valText((o || {})[k]);

  /* ---------------- donordeck: колода доноров ---------------- */
  // Б4 аудита (урок 29 легче для чтения): карта — значок, название и одна строка; описание заменяет живая петля — донор играет сам
  // в рамке без звука (бот оболочки, botShow с mute), петля за петлёй. «Сыграть самому» — та же рамка, обычная партия.
  // На обороте карты — спрятанная механика одной строкой. При LAB_LOWRES петля не стартует сама: кнопка «Смотреть» под рамкой
  const LOOP_SEC = 24;
  STEPS.donordeck = ctx => {
    const st = ctx.step, deck = st.deck || [];
    let v = Object.assign({ donor: null, cross: null, played: [], flipped: [], watched: [] }, ctx.value);
    let crossing = !!v.cross, frame = null, mode = 'loop', seedN = 0;
    const fac = facV(); if (!v.donor && fac.donor) v.donor = fac.donor;
    let focus = deck.find(d => d.id === (v.focus || v.donor)) || deck[0]; // урок перерисовался (учитель открыл чекпоинт) — витрина та же
    const host = el('div', { class: 'stack' }), grid = el('div', { class: 'm8-deck' }), pick = el('div', { class: 'm8-pick' });
    const show = el('div', { class: 'm8-show' }), screen = el('div', { class: 'm8-screen' }), side = el('div', { class: 'm8-sside' }), live = el('div', { class: 'small muted m8-live-cap', 'aria-live': 'polite' });
    function choose(id) {
      if (crossing && v.donor && v.donor !== id) v.cross = v.cross === id ? null : id;
      else { v.donor = v.donor === id && !crossing ? null : id; if (v.cross === v.donor) v.cross = null; }
      beep('tick'); ctx.save(v); draw();
    }
    function flip(d) { const card = side.querySelector('.m8-dcard'); if (card) card.classList.toggle('flip'); if (!v.flipped.includes(d.id)) { v.flipped = v.flipped.concat(d.id); ctx.save(v); } }
    // одна рамка на всю колоду: mode 'loop' — бот играет без звука, 'self' — играет ученик
    function start(m) {
      mode = m;
      if (!frame) {
        frame = Games.frame({ src: () => '/engine/game.html?game=../' + focus.game, key: () => 'remake:deck:' + focus.id, label: 'Смотреть: ' + focus.title, autostart: false,
          onReady: () => { if (mode === 'loop') loop(); else live.textContent = 'Твоя партия: кликни по игре и играй со звуком.'; },
          onShow: m2 => {
            if (mode !== 'loop') return;
            if (m2.type === 'showStep') { live.textContent = `▶ Донор играет сам, без звука · ${m2.t} с`; if (!v.watched.includes(focus.id)) { v.watched = v.watched.concat(focus.id); ctx.save(v); } return; }
            if (m2.error) { live.textContent = 'Петля не запустилась — сыграй сам.'; return; }
            if (screen.isConnected) loop(); // петля за петлёй
          },
          onOver: () => { if (mode === 'self' && !v.played.includes(focus.id)) { v.played = v.played.concat(focus.id); ctx.save(v); paintSide(); paintGrid(); } } });
      }
      if (!screen.contains(frame.box)) screen.replaceChildren(frame.box);
      frame.start();
      paintSide();
    }
    function loop() { seedN++; frame.post({ type: 'botShow', options: { seconds: LOOP_SEC, seed: 1000 + seedN * 7, strategy: 'random', mute: true } }); }
    function focusOn(d) {
      if (focus === d) return;
      focus = d; v.focus = d.id; ctx.save(v); beep('tick');
      if (frame) { if (window.LAB_LOWRES) frame.stop(); else start('loop'); }
      paintSide(); paintGrid();
      if (!calm()) show.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    async function take() {
      try { await api('/api/proekt/donor', { donor: v.donor, cross: v.cross || null }); v.taken = true; ctx.save(v, true, true); beep('done'); draw(true);
        // Фабрика ниже уже нарисована со старым донором: берём её ответ с сервера и перерисовываем урок
        const fid = (S.lesson.plan || {}).factory; if (fid) api('/api/me').then(r => { S.answers[fid] = r.answers[fid]; renderMain(); }).catch(() => {}); toast(v.cross ? 'Скрестили! Оба донора — в Фабрике команды' : 'Донор — в Фабрике команды', 'ok'); } catch (e) { toast(e.message, 'err'); }
    }
    const pickLabel = d => (v.donor === d.id ? '★ Донор' : v.cross === d.id ? '✚ Второй' : crossing && v.donor ? '✚ Скрестить' : 'Беру');
    function paintSide() {
      const d = focus, on = v.donor === d.id || v.cross === d.id;
      side.replaceChildren(
        el('div', { class: 'm8-dcard big' + (v.played.includes(d.id) ? ' played' : ''), 'data-donor': d.id },
          el('div', { class: 'm8-dface' },
            el('div', { class: 'm8-dfront' }, el('span', { class: 'm8-dic' }, d.icon), el('b', {}, d.title), el('span', {}, d.line), el('span', { class: 'small muted' }, `урок ${d.lesson} · глагол «${d.verb}»`)),
            el('div', { class: 'm8-dback' }, el('span', { class: 'eyebrow' }, 'Спрятанная механика'), el('b', {}, '🤫 ' + d.secret)))),
        el('div', { class: 'm8-dbtns' },
          el('button', { type: 'button', class: 'btn ghost small', title: 'Перевернуть: спрятанная механика', 'data-deck': 'flip', onclick: () => flip(d) }, '↻ Секрет'),
          el('button', { type: 'button', class: 'btn ghost small', 'data-deck': 'self', onclick: () => start('self') }, mode === 'self' && frame ? '↻ Ещё партия' : '🎮 Сыграть самому'),
          el('button', { type: 'button', class: 'btn small' + (on ? '' : ' ghost'), 'aria-pressed': String(on), 'data-deck': 'pick', onclick: () => choose(d.id) }, pickLabel(d))),
        live);
      if (!frame || !frame.src) {
        screen.replaceChildren(el('div', { class: 'm8-poster-loop' }, el('span', { class: 'm8-dic' }, d.icon),
          el('button', { type: 'button', class: 'btn', 'data-deck': 'watch', onclick: () => start('loop') }, '▶ Смотреть, как он играет'),
          el('span', { class: 'small muted' }, 'Донор сыграет сам, без звука')));
        live.textContent = '';
      }
    }
    function paintGrid() {
      grid.replaceChildren(...deck.map((d, i) => {
        const on = v.donor === d.id, x = v.cross === d.id;
        return el('button', { type: 'button', class: 'm8-dmini' + (on ? ' on' : '') + (x ? ' x' : '') + (d === focus ? ' focus' : '') + (v.played.includes(d.id) ? ' played' : ''), style: `--d:${i * 25}ms`, 'data-donor': d.id, 'aria-pressed': String(d === focus), onclick: () => focusOn(d) },
          el('span', { class: 'm8-dic' }, d.icon), el('b', {}, d.title.replace(/\s*\(.*\)$/, '')), el('span', { class: 'small' }, d.line));
      }));
    }
    function draw(boom) {
      paintGrid(); paintSide();
      const a = deck.find(d => d.id === v.donor), b = deck.find(d => d.id === v.cross);
      pick.replaceChildren(
        el('div', { class: 'm8-pickcards' + (boom ? ' boom' : '') + (b ? ' two' : '') },
          a ? el('div', { class: 'm8-mini' }, el('span', {}, a.icon), el('b', {}, a.title)) : el('div', { class: 'm8-mini empty' }, el('span', {}, '🎲'), el('b', {}, 'Выбери донора')),
          b ? el('span', { class: 'm8-x' }, '×') : null,
          b ? el('div', { class: 'm8-mini' }, el('span', {}, b.icon), el('b', {}, b.title)) : null),
        el('div', { class: 'row' },
          el('label', { class: 'm6-tog' + (crossing ? ' on' : '') }, el('input', { type: 'checkbox', checked: crossing, onchange: e => { crossing = e.target.checked; if (!crossing) { v.cross = null; ctx.save(v); } draw(); } }), el('span', { class: 'm6-sw' }, el('i')), ' Скрестить двух'),
          el('span', { class: 'grow' }),
          el('button', { type: 'button', class: 'btn', disabled: !a, onclick: take }, v.taken ? '✓ В Фабрике — обновить' : '✓ Берём в Фабрику')));
    }
    show.append(screen, side);
    draw();
    host.append(show, pick, grid); // выбор — сразу под витриной: до кнопки «Берём» не листать всю колоду
    if (!window.LAB_LOWRES) setTimeout(() => { if (host.isConnected && !frame) start('loop'); }, 0); // живая петля сразу — когда шаг уже на странице
    return host;
  };

  /* ---------------- pitch: питч-карта и репетиция ---------------- */
  // Б4 аудита: питч-карта по одному полю на экран с прогрессом (точки сверху — можно прыгнуть к любому), карта слева растёт на глазах;
  // поля из Фабрики уже заполнены — «Дальше» их принимает. Последний экран — репетиция 60 секунд и «На стену питчей»
  const PITCH_FIELDS = [
    ['phrase', 'Одна фраза', 'Это игра, где ты…', 'Это игра, где ты пчелой спасаешь последний цветок', 200],
    ['title', 'Название', 'Как зовут игру?', 'Пчела и зима', 60],
    ['twist', 'Твист', 'Чего нет у донора?', '', 200],
    ['world', 'Мир', 'Где это происходит?', '', 120],
    ['feeling', 'Чувство', 'Что почувствует игрок?', '', 80],
    ['who', 'Для кого', 'Кто будет играть?', 'Младший брат, 9 лет', 120],
  ];
  const donorTitle = id => { for (const s of S.lesson.checkpoints.flatMap(c => c.steps)) { const d = (s.donors || s.deck || []).find(x => x && x.id === id); if (d) return d.title; } return ''; };
  STEPS.pitch = ctx => {
    const f = facV(), ff = f.fields || {}, dec = decV();
    const donor = donorTitle(f.donor), cross = field(ff, 'cross').split(':')[0];
    const portrait = stepVal('portrait', (s, x) => valText((x.fields || {}).kto)) || '';
    let v = Object.assign({ card: {}, rehearsals: 0, best: null, sent: false }, ctx.value);
    const auto = { title: field(ff, 'title'), donor: donor + (cross ? ' × ' + cross : ''), twist: field(ff, 'twist'), world: field(ff, 'world'), feeling: field(dec, 'feeling'), who: portrait };
    const C = () => Object.assign({}, auto, Object.fromEntries(Object.entries(v.card).filter(([, x]) => x)));
    const host = el('div', { class: 'stack' }), poster = el('div', { class: 'm8-poster' }), wiz = el('div', { class: 'm8-wiz' });
    const cv = el('canvas', { width: 300, height: 260, class: 'm8-rehearse', 'aria-label': 'Таймер питча' }), g = cv.getContext('2d');
    const N = PITCH_FIELDS.length;
    let at = v.sent ? N : clamp(v.at || 0, 0, N), run = 0, t0 = 0, raf = 0, drawn = 0, lastBeat = '';
    const set = (k, val) => { v.card = Object.assign({}, v.card, { [k]: val }); ctx.save(v); paint(); };
    const cur = () => (PITCH_FIELDS[at] || [])[0];
    function paint() {
      const c = C(), mark = k => ({ 'data-k': k, class: cur() === k ? 'now' : '' });
      poster.replaceChildren(
        el('div', Object.assign(mark('title'), { class: 'm8-ptitle ' + (cur() === 'title' ? 'now' : '') }), c.title || 'Название игры'),
        el('div', Object.assign(mark('phrase'), { class: 'm8-pphrase ' + (cur() === 'phrase' ? 'now' : '') }), c.phrase || 'Это игра, где ты…'),
        el('div', { class: 'm8-pformula' }, el('span', {}, '🕹️ ' + (c.donor || 'донор')), el('i', {}, '×'), el('span', mark('twist'), '🌀 ' + (c.twist || 'твист')), el('i', {}, '×'), el('span', mark('world'), '🌍 ' + (c.world || 'мир'))),
        el('div', { class: 'm8-pfoot' }, el('span', mark('feeling'), '❤ ' + (c.feeling || 'чувство')), el('span', mark('who'), '🙂 для: ' + (c.who || 'кого'))));
    }
    function dots() {
      return el('div', { class: 'm8-wdots', role: 'tablist', 'aria-label': 'Поля питч-карты' }, ...PITCH_FIELDS.map(([k, label], i) => el('button', { type: 'button', class: (i === at ? 'on' : '') + (C()[k] ? ' ok' : ''), 'data-pstep': k, title: label, 'aria-label': label, onclick: () => go(i) })),
        el('button', { type: 'button', class: 'rh' + (at === N ? ' on' : '') + (v.rehearsals ? ' ok' : ''), 'data-pstep': 'rehearse', title: 'Репетиция', 'aria-label': 'Репетиция', onclick: () => go(N) }, '🎤'));
    }
    function go(i) { at = clamp(i, 0, N); v.at = at; ctx.save(v); beep('tick'); wizard(); paint(); const inp = wiz.querySelector('input'); if (inp) inp.focus(); }
    const status = el('span', { class: 'small muted' });
    const btn = el('button', { type: 'button', class: 'btn ghost', onclick: () => { run = 1; t0 = performance.now(); lastBeat = ''; btn.textContent = '⏱ Идёт…'; beep('tick'); if (!raf) raf = requestAnimationFrame(loop); } });
    function wizard() {
      if (at < N) {
        const [k, label, q, ph, max] = PITCH_FIELDS[at], fromFac = !v.card[k] && auto[k];
        const inp = el('input', { type: 'text', maxlength: String(max), value: v.card[k] || '', placeholder: auto[k] || ph || q, 'data-pf': k, 'aria-label': label,
          oninput: e => set(k, e.target.value), onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); go(at + 1); } } });
        wiz.replaceChildren(dots(), el('div', { class: 'eyebrow' }, `${at + 1} из ${N} · ${label}`), el('h3', {}, q), inp,
          el('span', { class: 'small muted' }, fromFac ? '✓ Уже есть из Фабрики — можно оставить' : k === 'phrase' ? 'Кто ты, что делаешь и что особенного' : ' '),
          el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn ghost small', disabled: at === 0, onclick: () => go(at - 1) }, '←'), el('span', { class: 'grow' }),
            el('button', { type: 'button', class: 'btn', 'data-pnext': '', onclick: () => go(at + 1) }, at === N - 1 ? '🎤 К репетиции' : 'Дальше →')));
        return;
      }
      btn.textContent = v.rehearsals ? '↻ Ещё репетиция' : '⏱ Репетиция 60 секунд';
      status.textContent = v.rehearsals ? `Репетиций: ${v.rehearsals}` : 'Расскажи соседу вслух. Кольцо подскажет, о чём сейчас.';
      wiz.replaceChildren(dots(), el('div', { class: 'eyebrow' }, 'Репетиция'), el('div', { class: 'stack', style: 'align-items:center' }, cv, btn, status),
        el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn ghost small', onclick: () => go(N - 1) }, '←'), el('span', { class: 'grow' }),
          el('button', { type: 'button', class: 'btn', onclick: send }, v.sent ? '↻ Обновить на стене' : '📌 На стену питчей')));
    }
    function loop(now) {
      if (!cv.isConnected && !host.isConnected) { cancelAnimationFrame(raf); raf = 0; return; }
      raf = requestAnimationFrame(loop);
      if (!cv.isConnected) return;
      if (window.LAB_LOWRES && now - drawn < 200) return; drawn = now;
      const sec = run ? (now - t0) / 1000 * (fast() ? 20 : 1) : 0;
      g.clearRect(0, 0, 300, 260); g.fillStyle = '#0d1226'; g.fillRect(0, 0, 300, 260);
      const c = pitchRing(g, 150, 120, 96, sec);
      if (run && c[2] !== lastBeat) { lastBeat = c[2]; beep('tick'); }
      if (run && sec >= 60) { run = 0; v.rehearsals++; ctx.save(v, v.sent ? true : null); beep('good'); btn.textContent = '↻ Ещё репетиция'; status.textContent = `Репетиций: ${v.rehearsals}. Уложился? Если нет — вычеркни слово.`; wiz.querySelector('[data-pstep=rehearse]') && wiz.querySelector('[data-pstep=rehearse]').classList.add('ok'); }
    }
    async function send() {
      try { await api('/api/proekt/pitch', { card: C() }); v.sent = true; ctx.save(v, true, true); beep('done'); poster.classList.add('sent'); wizard(); toast('Питч-карта на стене класса', 'ok'); } catch (e) { toast(e.message, 'err'); }
    }
    paint(); wizard(); raf = requestAnimationFrame(loop);
    host.append(el('div', { class: 'm8-pitch' }, poster, wiz));
    return host;
  };

  /* ---------------- pitchwall: стена питчей и «хочу сыграть» ---------------- */
  STEPS.pitchwall = ctx => {
    const host = el('div', { class: 'stack' }), stage = el('div', { class: 'm8-stagebar', hidden: true }), wall = el('div', { class: 'm8-wall' }), info = el('div', { class: 'small muted' });
    let timer = null;
    function draw() {
      const d = PJ.data; if (!d) return;
      const list = d.pitches.slice().sort((a, b) => b.hearts - a.hearts || a.at - b.at), max = Math.max(1, ...list.map(x => x.hearts));
      info.textContent = `У тебя ❤ ${d.heartsLeft} из 3. Сердце — «хочу сыграть в эту игру». За свою нельзя.`;
      wall.replaceChildren(...(list.length ? list.map((x, i) => el('div', { class: 'm8-wcard' + (x.mine ? ' mine' : '') + (x.mineHeart ? ' hearted' : ''), style: `--d:${i * 50}ms;--c:${colorOf(x.by)}`, 'data-key': x.key },
        el('b', {}, `${x.emblem || ''} ${x.title}`), el('p', {}, x.phrase), el('span', { class: 'small muted' }, `${x.donor}${x.team ? ' · команда «' + x.team + '»' : ''} · ${x.members.join(', ')}`),
        el('i', { class: 'm8-hbar' }, el('i', { style: `width:${Math.round(100 * x.hearts / max)}%` })),
        x.mine ? el('span', { class: 'small' }, `❤ ${x.hearts} — твоя игра`) : el('button', { type: 'button', class: 'btn small' + (x.mineHeart ? '' : ' ghost'), 'aria-pressed': String(x.mineHeart), onclick: () => heart(x.key) }, `❤ ${x.hearts}${x.mineHeart ? ' · ты хочешь' : ' · хочу сыграть'}`),
        x.approved ? el('span', { class: 'tag ok' }, 'диздок утверждён') : null)) : [el('div', { class: 'muted' }, 'Питчей пока нет — отправь свою питч-карту выше.')]));
      const s = d.stage, p = s && d.pitches.find(x => x.key === s.key);
      stage.hidden = !p;
      if (p) {
        clearInterval(timer);
        const got = Date.now(), tick = () => { const left = Math.max(0, Math.min(d.sec, s.left) - (Date.now() - got) / 1000); stage.replaceChildren(el('span', { class: 'm8-live' }, '● На сцене'), el('b', {}, p.title), el('span', {}, p.phrase), el('span', { class: 'm8-left' }, mmss(left))); if (left <= 0) clearInterval(timer); };
        tick(); timer = setInterval(() => { if (!stage.isConnected) clearInterval(timer); else tick(); }, 500);
      }
      const given = d.pitches.filter(x => x.mineHeart).length;
      if (given && !ctx.done) ctx.save({ hearts: d.pitches.filter(x => x.mineHeart).map(x => x.title) }, true);
      else if (given) ctx.save({ hearts: d.pitches.filter(x => x.mineHeart).map(x => x.title) });
    }
    async function heart(key) { try { PJ.data = await api('/api/proekt/heart', { key }); beep('good'); draw(); } catch (e) { toast(e.message, 'err'); } }
    live(host, draw); loadPJ().then(draw).catch(e => { host.textContent = e.message; });
    host.append(stage, info, wall);
    return host;
  };

  /* ---------------- dizdok: одностраничный диздок ---------------- */
  // Б4 аудита: сначала по одной строке на экран с прогрессом — главные строки и все пустые; строку можно дописать прямо здесь,
  // она уходит туда, откуда взялась (Фабрика, решения, портрет, питч-карта), — урок 30 соберёт игру по ней. Последний экран — страница целиком,
  // «На утверждение», печать учителя падает на страницу
  const DOC_KEY = ['phrase', 'cikl', 'kryuchok', 'who', 'rezhem'];
  STEPS.dizdok = ctx => {
    const host = el('div', { class: 'stack' }), page = el('article', { class: 'm8-doc' }), status = el('div', { class: 'row' }), wiz = el('div', { class: 'm8-wiz m8-dwiz' });
    const plan = S.lesson.plan || {}, facId = plan.factory || 'fabrika', decId = plan.decisions || 'resheniya';
    const idOf = type => { const x = S.lesson.checkpoints.flatMap(c => c.steps).find(s => s.type === type); return x ? x.id : null; };
    // строка диздока: k — ключ, label — подпись, v — текст, src — [шаг, 'fields' | 'card', поле] для правки (у донора и команды правки нет)
    function lines() {
      const f = facV(), ff = f.fields || {}, dec = decV();
      const donor = donorTitle(f.donor) || '—', cross = field(ff, 'cross').split(':')[0];
      const pitch = stepVal('pitch', (s, x) => x.card || {}) || {};
      const por = stepVal('portrait', (s, x) => x.fields || {}) || {};
      const team = stepVal('team', (s, x) => x) || {};
      const fab = k => [k, field(ff, k), [facId, 'fields', k]], de = k => [k, field(dec, k), [decId, 'fields', k]];
      const L = [
        ['Фраза', 'phrase', valText(pitch.phrase), [idOf('pitch'), 'card', 'phrase']],
        ['Донор', 'donor', donor + (cross ? ' × ' + cross : ''), null],
        ['Твист', ...fab('twist')], ['Мир', ...fab('world')], ['Герой', ...fab('hero')],
        ['Основной цикл', ...fab('cikl')], ['Крючок: зачем ещё раз', ...fab('kryuchok')],
        ['Чувство', ...de('feeling')], ['Честность', ...de('honesty')], ['Выбор', ...de('choice')],
        ['Для кого', 'who', [valText(por.kto), valText(por.lyubit), valText(por.kogda)].filter(Boolean).join(' · '), [idOf('portrait'), 'fields', 'kto']],
        ['Режем первым, если не успеем', ...fab('rezhem')],
        ['Команда', 'team', team.team ? `«${team.team}»: ${(team.members || []).join(', ')}` : 'делаю один', null],
      ];
      return { title: field(ff, 'title') || valText(pitch.title) || 'Моя игра', lines: L.map(([k, key, x, src]) => ({ k, key, v: x || '—', src: src && src[0] ? src : null })) };
    }
    // экраны: главные строки и все пустые, которые можно дописать; последний — страница
    const screens = () => lines().lines.filter(l => l.src && (DOC_KEY.includes(l.key) || l.v === '—'));
    let list = screens(), at = (ctx.value || {}).sent ? list.length : clamp((ctx.value || {}).at || 0, 0, list.length); // где остановился — после перерисовки урока там же
    function put(l, text) {
      const [id, kind, key] = l.src, cur = ans(id).value || {};
      if (kind === 'card') save(id, Object.assign({}, cur, { card: Object.assign({}, cur.card, { [key]: text }) }));
      else save(id, Object.assign({}, cur, { fields: Object.assign({}, cur.fields, { [key]: text ? { text } : null }) }));
    }
    function go(i) { list = i >= list.length ? screens() : list; at = clamp(i, 0, list.length); ctx.save(Object.assign({}, ctx.value, { at })); beep('tick'); paint(); const t = wiz.querySelector('textarea'); if (t) t.focus(); }
    function dots() {
      return el('div', { class: 'm8-wdots', 'aria-label': 'Строки диздока' }, ...list.map((l, i) => el('button', { type: 'button', class: (i === at ? 'on' : '') + (lines().lines.find(x => x.key === l.key).v !== '—' ? ' ok' : ''), 'data-dstep': l.key, title: l.k, 'aria-label': l.k, onclick: () => go(i) })),
        el('button', { type: 'button', class: 'rh' + (at === list.length ? ' on' : ''), 'data-dstep': 'page', title: 'Страница целиком', 'aria-label': 'Страница целиком', onclick: () => go(list.length) }, '📄'));
    }
    function paint(stamp) {
      if (at < list.length) {
        const l = lines().lines.find(x => x.key === list[at].key), empty = l.v === '—';
        const t = el('textarea', { rows: 2, maxlength: 300, 'data-dline': l.key, 'aria-label': l.k, placeholder: 'Допиши одной фразой' }); t.value = empty ? '' : l.v;
        t.addEventListener('input', () => put(l, t.value.trim()));
        t.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(at + 1); } });
        wiz.replaceChildren(dots(), el('div', { class: 'eyebrow' }, `${at + 1} из ${list.length} · диздок`), el('h3', {}, l.k), t,
          el('span', { class: 'small muted' }, empty ? 'Пустая строка: допиши здесь — она попадёт и в Фабрику' : '✓ Уже есть — поправь, если нужно'),
          el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn ghost small', disabled: at === 0, onclick: () => go(at - 1) }, '←'), el('span', { class: 'grow' }),
            el('button', { type: 'button', class: 'btn', 'data-dnext': '', onclick: () => go(at + 1) }, at === list.length - 1 ? '📄 Вся страница' : 'Дальше →')));
        page.hidden = true; status.hidden = true;
        return;
      }
      wiz.replaceChildren(dots());
      page.hidden = false; status.hidden = false;
      const d = lines(), a = PJ.data || {}, approved = a.approved, sent = a.doc;
      page.replaceChildren(el('header', {}, el('span', { class: 'eyebrow' }, 'Диздок на одну страницу'), el('h2', {}, d.title)),
        el('dl', {}, ...d.lines.flatMap((l, i) => [el('dt', { style: `--d:${i * 40}ms` }, l.k), el('dd', { style: `--d:${i * 40}ms`, class: l.v === '—' ? 'empty' : '' }, l.v)])),
        ...(approved ? [el('div', { class: 'm8-stamp' + (stamp ? ' slam' : '') }, 'УТВЕРЖДЕНО')] : [])); // replaceChildren(null) печатал «null» под страницей
      const empty = d.lines.filter(l => l.v === '—').length;
      status.replaceChildren(
        el('button', { type: 'button', class: 'btn', onclick: send }, sent ? '↻ Отправить заново' : '📨 На утверждение учителю'),
        el('button', { type: 'button', class: 'btn ghost small', onclick: () => { document.body.classList.add('m8-print-doc'); window.print(); setTimeout(() => document.body.classList.remove('m8-print-doc'), 500); } }, '🖨 Печать'),
        el('span', { class: 'small muted' }, approved ? '✓ Учитель утвердил диздок — можно собирать прототип.' : sent ? 'Ждём учителя: он поставит печать.' : empty ? `Пустых строк: ${empty} — нажми точку сверху и допиши.` : 'Все строки на месте.'));
      if (approved && stamp) { beep('done'); }
    }
    async function send() {
      try { await flushSaves(); PJ.data = Object.assign({}, PJ.data, await api('/api/proekt/doc', { doc: lines(), changed: !!(PJ.data && PJ.data.doc) })); ctx.save({ sent: true, title: lines().title, at }, true, true); beep('good'); paint(); toast('Диздок у учителя', 'ok'); } catch (e) { toast(e.message, 'err'); }
    }
    let was = null;
    const redraw = () => { const now = !!(PJ.data && PJ.data.approved); if (at === list.length) paint(was === false && now); if (now && !(ctx.value || {}).approved) ctx.save(Object.assign({}, ctx.value, { approved: true }), true, true); was = now; };
    live(host, redraw);
    // свой ввод тоже меняет Фабрику: экран строки не перерисовываем, чтобы не сбить курсор; страницу — да
    S.hooks.push(kind => { if ((kind === 'plan' || kind === 'answer' || kind === 'team') && host.isConnected && at === list.length) paint(); });
    loadPJ().then(redraw).catch(() => paint());
    paint();
    host.append(wiz, page, status);
    return host;
  };

  /* ---------------- seryy: весело ли без графики? ---------------- */
  STEPS.seryy = ctx => {
    const st = ctx.step, need = st.minRounds || 1;
    let v = Object.assign({ color: { rounds: 0, time: 0, best: 0 }, grey: { rounds: 0, time: 0, best: 0 }, vote: null }, ctx.value);
    let side = v.grey.rounds < need ? 'grey' : 'color', h = null;
    const host = el('div', { class: 'stack' }), tabs = el('div', { class: 'seg' }), box = el('div'), bars = el('canvas', { width: 600, height: 120, class: 'm8-bars' }), vote = el('div', { class: 'stack' });
    const own = st.own && hasGame();
    function frame() {
      if (h) { h.destroy(); h = null; }
      const cfg = Object.assign({}, st.cfg, { grey: side === 'grey' ? 1 : 0 });
      const onOver = m => { const x = v[side], t = Number(((m || {}).tele || {}).time) || 0; x.rounds++; x.time += t; x.best = Math.max(x.best, m.score || 0); ctx.save(v, v.vote && ready() ? true : null); drawTabs(); drawVote(); };
      if (own) { h = Games.frame({ src: () => `/play/${S.game.id}/${S.game.current}`, key: () => 'game:' + S.game.id, cfg, label: side === 'grey' ? 'Играть серым' : 'Играть в цвете', onOver }); }
      else h = Games.frame({ src: () => '/engine/game.html?game=../' + st.game, key: () => 'remake:' + st.id, cfg, label: side === 'grey' ? 'Играть серым' : 'Играть в цвете', onOver });
      box.replaceChildren(h.box, Games.bar(h));
    }
    const ready = () => v.grey.rounds >= need && v.color.rounds >= need;
    function drawTabs() {
      tabs.replaceChildren(...[['grey', '⬜ Серый прототип'], ['color', '🎨 В цвете']].map(([k, l]) => el('button', { type: 'button', class: 'opt' + (side === k ? ' on' : ''), 'aria-pressed': String(side === k), onclick: () => { if (side !== k) { side = k; beep('tick'); drawTabs(); frame(); } } },
        el('b', {}, l), el('span', { class: 'small muted' }, ` · партий ${v[k].rounds}${v[k].rounds >= need ? ' ✓' : ' из ' + need}`))));
    }
    // гонка полос: сколько секунд в игре и лучший счёт серым и в цвете
    let raf = 0, t0 = performance.now(), drawn = 0;
    function barsLoop(now) {
      if (!bars.isConnected) { cancelAnimationFrame(raf); return; } raf = requestAnimationFrame(barsLoop);
      if (window.LAB_LOWRES && now - drawn < 200) return; drawn = now;
      const g = bars.getContext('2d'), k = io(clamp((now - t0) / 900, 0, 1)); g.clearRect(0, 0, 600, 120);
      const mx = Math.max(1, v.grey.time, v.color.time);
      [['grey', '⬜ серым', '#c4c8ce'], ['color', '🎨 в цвете', '#ffb547']].forEach(([key, l, col], i) => {
        const y = 22 + i * 46; text(g, l, 10, y + 10, '#f2efe6', 13, 'left'); rr(g, 110, y, 420, 22, 11, '#1a2445'); rr(g, 110, y, Math.max(6, 420 * k * v[key].time / mx), 22, 11, col);
        text(g, `${Math.round(v[key].time)} с · рекорд ${v[key].best}`, 540, y + 11, '#9aa3c7', 11, 'left');
      });
    }
    function drawVote() {
      vote.innerHTML = '';
      if (!ready()) { vote.append(el('div', { class: 'small muted' }, `Сыграй хотя бы ${need} ${need === 1 ? 'партию' : 'партии'} серым и в цвете — потом голос.`)); return; }
      vote.append(el('div', { class: 'eyebrow' }, st.question || 'Весело ли без графики?'), el('div', { class: 'row' }, ...(st.options || ['В сером так же весело', 'В цвете веселее, но и серым хочется играть', 'Серым скучно — веселья в цикле нет']).map((o, i) => el('button', { type: 'button', class: 'opt' + (v.vote === o ? ' on' : ''), 'aria-pressed': String(v.vote === o), onclick: () => { v.vote = o; beep('good'); ctx.save(v, true); drawVote(); } }, ['😃 ', '🙂 ', '😴 '][i] + o))));
      if (v.vote) vote.append(el('p', { class: 'concept' }, v.vote.startsWith('Серым скучно') ? 'Находка: веселье пока держится на картинке. Чини основной цикл — глагол, вызов, награду — до того, как красить.' : 'Веселье живёт в механике. Картинка добавит чувство, но играть хочется уже сейчас — так и строят итоговую игру.'));
    }
    drawTabs(); frame(); drawVote(); raf = requestAnimationFrame(barsLoop);
    S.hooks.push(() => {});
    host.append(tabs, box, bars, vote);
    return host;
  };

  /* ---------------- observe: наблюдение за плейтестом ---------------- */
  const MARKS = [['stuck', '😕', 'Застрял'], ['laugh', '😄', 'Засмеялся'], ['ask', '❓', 'Спросил'], ['angry', '😤', 'Злится'], ['again', '🔁', 'Ещё раз!'], ['quit', '🚪', 'Бросил']];
  STEPS.observe = ctx => {
    const st = ctx.step, need = st.min || 1, marks = (st.marks ? MARKS.filter(m => st.marks.includes(m[0])) : MARKS).concat(st.silent ? [['hint', '🤐', 'Я подсказал']] : []);
    let v = Object.assign({ sessions: [], top: null }, ctx.value);
    let cur = null, t0 = 0, raf = 0, drawn = 0;
    const host = el('div', { class: 'stack' }), panel = el('div', { class: 'm8-obs' }), tape = el('canvas', { width: 640, height: 90, class: 'm8-tape', 'aria-label': 'Лента меток' }), sum = el('div', { class: 'stack' });
    const who = el('select', { 'aria-label': 'Кто играет' }, ...(st.who || ['Одноклассник', 'Младший ученик', 'Взрослый', 'Гость из другой школы']).map(x => el('option', { value: x }, x)));
    const sec = () => (performance.now() - t0) / 1000 * (fast() ? 4 : 1);
    function mark(k) {
      if (!cur) { toast('Сначала «▶ Начать наблюдение»'); return; }
      cur.marks.push({ k, t: Math.round(sec() * 10) / 10 }); beep(k === 'laugh' || k === 'again' ? 'good' : 'tick');
      const b = panel.querySelector(`[data-mark="${k}"]`); if (b) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); b.querySelector('.m8-n').textContent = cur.marks.filter(m => m.k === k).length; }
    }
    function start() { cur = { who: who.value, marks: [], at: Date.now() }; t0 = performance.now(); draw(); if (!raf) raf = requestAnimationFrame(loop); }
    function stop() { cur.len = Math.round(sec()); v.sessions = v.sessions.concat(cur).slice(-12); cur = null; ctx.save(v, v.sessions.length >= need && !!v.top ? true : null); beep('done'); draw(); }
    function loop(now) {
      if (!tape.isConnected) { cancelAnimationFrame(raf); raf = 0; return; } raf = requestAnimationFrame(loop);
      if (window.LAB_LOWRES && now - drawn < 200) return; drawn = now;
      const g = tape.getContext('2d'); g.clearRect(0, 0, 640, 90); g.fillStyle = '#0d1226'; g.fillRect(0, 0, 640, 90);
      const s = cur || v.sessions[v.sessions.length - 1]; if (!s) { text(g, 'Здесь появятся метки по времени', 320, 45, '#6a7090', 13); return; }
      const len = cur ? Math.max(60, sec() + 5) : Math.max(10, s.len || 60);
      rr(g, 20, 52, 600, 6, 3, '#2a3560'); if (cur) rr(g, 20, 52, 600 * clamp(sec() / len, 0, 1), 6, 3, '#5fe0ff');
      for (let m = 0; m <= len; m += 30) text(g, mmss(m), 20 + 600 * m / len, 74, '#6a7090', 9);
      s.marks.forEach((m, i) => { const x = 20 + 600 * m.t / len, age = cur ? sec() - m.t : 9, z = ob(clamp(age * 3, 0, 1)); g.save(); g.translate(x, 34 - (i % 2) * 8); g.scale(z, z); emo(g, (marks.find(x => x[0] === m.k) || MARKS.find(x => x[0] === m.k) || [0, '•'])[1], 0, 0, 18); g.restore(); });
      text(g, cur ? `● идёт ${mmss(sec())} · ${s.who}` : `последний: ${s.who}, ${mmss(s.len || 0)}`, 630, 12, cur ? '#ff5d6e' : '#9aa3c7', 11, 'right');
    }
    function draw() {
      panel.replaceChildren(...marks.map(([k, e, l], i) => el('button', { type: 'button', class: 'm8-mark', 'data-mark': k, disabled: !cur, onclick: () => mark(k) }, el('span', { class: 'm8-e' }, e), el('b', {}, l), el('span', { class: 'm4-key' }, String(i + 1)), el('span', { class: 'm8-n' }, cur ? String(cur.marks.filter(m => m.k === k).length) : ''))));
      const ctl = el('div', { class: 'row' }, cur ? el('button', { type: 'button', class: 'btn', onclick: stop }, '■ Закончить наблюдение') : [el('label', { class: 'small' }, 'Играет: ', who), el('button', { type: 'button', class: 'btn', onclick: start }, '▶ Начать наблюдение')], el('span', { class: 'small muted' }, `Наблюдений: ${v.sessions.length}${v.sessions.length < need ? ' из ' + need : ' ✓'}`));
      ctlBox.replaceChildren(ctl);
      drawSum();
    }
    function drawSum() {
      sum.innerHTML = '';
      if (!v.sessions.length) return;
      const all = v.sessions.flatMap(s => s.marks), count = k => all.filter(m => m.k === k).length;
      // где застревают: секунды, где метка «застрял» встречается у нескольких
      const stuck = all.filter(m => m.k === 'stuck').map(m => Math.round(m.t / 10) * 10), hot = {};
      stuck.forEach(s => { hot[s] = (hot[s] || 0) + 1; });
      const worst = Object.entries(hot).sort((a, b) => b[1] - a[1])[0];
      sum.append(el('div', { class: 'eyebrow' }, st.sumTitle || 'Что увидели игроки'),
        el('div', { class: 'm8-sumrow' }, ...marks.map(([k, e, l]) => el('div', { class: 'm8-sum', style: `--h:${Math.min(100, count(k) * 20)}%` }, el('span', {}, e), el('b', {}, String(count(k))), el('span', { class: 'small muted' }, l)))),
        worst ? el('p', { class: 'concept' }, `Чаще всего застревают около ${mmss(Number(worst[0]))} — ${worst[1]} ${worst[1] === 1 ? 'раз' : 'раза'}. Это первая находка.`) : null,
        el('label', { class: 'lbl' }, st.question || 'Главная находка: что увидели новые игроки?'),
        el('div', { class: 'row' }, ...(st.deck || ['Не понимают, что делать в начале', 'Смеются в одном и том же месте — это ядро', 'Просят «ещё раз» — крючок работает', 'Уходят на одном месте — там и чиним']).map(o => el('button', { type: 'button', class: 'opt' + (v.top === o ? ' on' : ''), onclick: () => { v.top = o; beep('good'); ctx.save(v, v.sessions.length >= need ? true : null); drawSum(); } }, o))));
    }
    const ctlBox = el('div');
    host.addEventListener('keydown', e => { const d = /^(Digit|Numpad)([1-7])$/.exec(e.code); if (d && cur && !/input|textarea|select/i.test(e.target.tagName)) { e.preventDefault(); const m = marks[Number(d[2]) - 1]; if (m) mark(m[0]); } });
    host.tabIndex = -1;
    draw(); raf = requestAnimationFrame(loop);
    host.append(ctlBox, panel, tape, sum);
    return host;
  };

  /* ---------------- moscow: должно / хорошо бы / потом ---------------- */
  const BASK = [['must', 'Должно', 'без этого игры нет'], ['nice', 'Хорошо бы', 'если успеем'], ['later', 'Потом', 'после Фестиваля']];
  STEPS.moscow = ctx => {
    const st = ctx.step, part = st.cut || 1 / 3;
    let v = Object.assign({ items: [] }, ctx.value);
    const host = el('div', { class: 'stack' }), board = el('div', { class: 'm8-moscow' }), meter = el('canvas', { width: 130, height: 130, class: 'm8-cutring' }), msg = el('div', { class: 'small' });
    const inp = el('input', { type: 'text', maxlength: '60', placeholder: 'Своя фича одной строкой, например «Пчела-разведчица»' });
    const add = text => { const t = String(text || '').trim(); if (t.length < 2 || v.items.some(i => i.t.toLowerCase() === t.toLowerCase())) return; v.items = v.items.concat({ t, b: 'must' }).slice(0, 24); save(); draw(); };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(inp.value); inp.value = ''; } });
    const cutN = () => v.items.filter(i => i.b === 'later').length, needN = () => Math.ceil(v.items.length * part);
    const ok = () => v.items.length >= (st.min || 6) && cutN() >= needN() && v.items.some(i => i.b === 'must');
    function save() { ctx.save(v, ok() ? true : null); }
    function move(i, b, cardEl) {
      const it = v.items[i]; if (!it || it.b === b) return;
      const was = it.b; it.b = b;
      if (b === 'later' && cardEl && !calm()) { cardEl.classList.add('cut'); beep('tick'); setTimeout(() => { save(); draw(); }, fast() ? 60 : 420); return; }
      beep(was === 'later' ? 'tick' : 'good'); save(); draw();
    }
    let k0 = 0, raf = 0, drawn = 0;
    function ringLoop(now) {
      if (!meter.isConnected) { cancelAnimationFrame(raf); raf = 0; return; } raf = requestAnimationFrame(ringLoop);
      if (window.LAB_LOWRES && now - drawn < 200) return; drawn = now;
      const g = meter.getContext('2d'); g.clearRect(0, 0, 130, 130);
      const n = v.items.length || 1, tgt = cutN() / n; k0 += (tgt - k0) * 0.15;
      ring(g, 65, 65, 50, k0, k0 >= part - 0.001 ? '#7cf5a8' : '#ffb547');
      const a = -Math.PI / 2 + TAU * part; g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.beginPath(); g.moveTo(65 + Math.cos(a) * 40, 65 + Math.sin(a) * 40); g.lineTo(65 + Math.cos(a) * 60, 65 + Math.sin(a) * 60); g.stroke();
      text(g, '✂️', 65, 52, '#fff', 20); text(g, `${cutN()} из ${v.items.length}`, 65, 78, '#f2efe6', 15); text(g, 'вычеркнуто', 65, 96, '#9aa3c7', 10, 'center', 600);
    }
    function draw() {
      board.replaceChildren(...BASK.map(([b, name, sub]) => {
        const col = el('div', { class: 'm8-bask ' + b, 'data-bask': b }, el('div', { class: 'm8-bhead' }, el('b', {}, name), el('span', { class: 'small muted' }, sub)));
        v.items.forEach((it, i) => {
          if (it.b !== b) return;
          const card = el('div', { class: 'm8-feat', style: `--d:${i * 25}ms` }, el('span', { class: 'grow' }, it.t),
            ...BASK.filter(x => x[0] !== b).map(([x, n]) => el('button', { type: 'button', class: 'btn ghost small', title: n, 'data-to': x, onclick: e => move(i, x, e.target.closest('.m8-feat')) }, x === 'later' ? '✂️' : x === 'must' ? '⬆' : '↔')),
            el('button', { type: 'button', class: 'btn ghost small', title: 'Убрать', onclick: () => { v.items.splice(i, 1); save(); draw(); } }, '×'));
          col.append(card);
        });
        return col;
      }));
      const need = needN(), c = cutN();
      msg.className = 'small ' + (ok() ? 'ok' : '');
      msg.textContent = v.items.length < (st.min || 6) ? `Сначала выпиши всё задуманное: ещё ${(st.min || 6) - v.items.length}, карточками или своими словами.` : c < need ? `Вычеркни ещё ${need - c}: в «Потом» должна уйти треть (${need} из ${v.items.length}). Режь то, без чего игра всё равно работает.` : '✓ Треть вычеркнута. То, что осталось в «Должно», доводим до блеска к Фестивалю.';
      sugg.replaceChildren(...(st.deck || []).filter(d => !v.items.some(i => i.t === d)).slice(0, 10).map(d => el('button', { type: 'button', class: 'chipbtn', onclick: () => add(d) }, '+ ' + d)));
    }
    const sugg = el('div', { class: 'row', style: 'gap:6px' });
    draw(); raf = requestAnimationFrame(ringLoop);
    host.append(el('div', { class: 'm8-mtop' }, meter, el('div', { class: 'stack grow' }, msg, el('div', { class: 'row' }, inp, el('button', { type: 'button', class: 'btn small', onclick: () => { add(inp.value); inp.value = ''; } }, 'Добавить')), sugg)), board);
    return host;
  };

  /* ---------------- kontent: карта контента на 10 минут ---------------- */
  STEPS.kontent = ctx => {
    const st = ctx.step, mins = st.minutes || 10;
    let v = Object.assign({ beats: [], watched: false }, ctx.value), tool = 'vrag', play = -1, t0 = 0;
    const host = el('div', { class: 'stack' }), pal = el('div', { class: 'row m8-pal' }), cv = el('canvas', { width: 640, height: 230, class: 'm8-kcv', tabindex: '0', 'aria-label': 'Лента 10 минут: щёлкни, чтобы поставить событие' });
    const g = cv.getContext('2d'), info = el('div', { class: 'small' }), out = el('div', { class: 'stack' });
    const X = 40, Wd = 570, Y = 60, Hd = 130;
    const quitAt = () => { const vals = interest(v.beats, mins); const q = vals.findIndex(x => x < 0.25); return q < 0 ? null : q / (vals.length - 1) * mins; };
    const ok = () => v.beats.length >= (st.min || 4) && v.watched && quitAt() == null;
    function save() { ctx.save(v, ok() ? true : null); }
    cv.addEventListener('click', e => {
      const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * 640 / r.width, y = (e.clientY - r.top) * 230 / r.height;
      const at = clamp((x - X) / Wd * mins, 0.2, mins - 0.1);
      const near = v.beats.findIndex(b => Math.abs(X + Wd * b.at / mins - x) < 12 && y < Y + 10);
      if (near >= 0) v.beats.splice(near, 1); else v.beats = v.beats.concat({ at: Math.round(at * 10) / 10, kind: tool }).slice(0, 24);
      beep('tick'); v.watched = false; save(); paint();
    });
    function paint() {
      pal.replaceChildren(...Object.entries(BEAT_K).map(([k, b]) => el('button', { type: 'button', class: 'opt' + (tool === k ? ' on' : ''), 'aria-pressed': String(tool === k), 'data-beat': k, onclick: () => { tool = k; paint(); } }, b.icon + ' ' + b.label)),
        el('span', { class: 'grow' }), el('button', { type: 'button', class: 'btn small', onclick: () => { play = 0; t0 = performance.now(); beep('good'); } }, '▶ 10 минут за 10 секунд'));
      const q = quitAt();
      info.className = 'small ' + (q == null && v.beats.length >= (st.min || 4) ? 'ok' : '');
      info.textContent = v.beats.length < (st.min || 4) ? `Поставь на ленту хотя бы ${st.min || 4} события: выбери вид и щёлкни по минуте. Щелчок по значку — убрать.` : q == null ? (v.watched ? '✓ Интерес держится все 10 минут — игре хватает контента.' : 'Интерес держится! Проиграй ленту, чтобы проверить на глаз.') : `Игрок заскучает на ${q.toFixed(1).replace('.', ',')}-й минуте: добавь туда новинку или передышку перед ней.`;
      const plan = v.beats.slice().sort((a, b) => a.at - b.at).map(b => `${b.at.toFixed(1).replace('.', ',')} мин — ${BEAT_K[b.kind].label.toLowerCase()}`).join('; ');
      out.replaceChildren(v.beats.length ? el('div', { class: 'recall small' }, el('b', {}, 'Просьба Qwen по карте: '), `Растяни игру на ${mins} минут по карте контента: ${plan}. Каждое новое — с подсказкой на экране, числа — в ручки.`,
        ' ', el('button', { type: 'button', class: 'btn ghost small', onclick: () => Lab.copy ? Lab.copy(`Растяни игру на ${mins} минут по карте контента: ${plan}. Каждое новое — с подсказкой на экране, числа — в ручки.`) : navigator.clipboard.writeText(plan) }, '⧉ Скопировать')) : '');
    }
    let raf = 0, drawn = 0;
    function loop(now) {
      if (!cv.isConnected) { cancelAnimationFrame(raf); return; } raf = requestAnimationFrame(loop);
      if (window.LAB_LOWRES && now - drawn < 150) return; drawn = now;
      g.clearRect(0, 0, 640, 230); g.fillStyle = '#0d1226'; g.fillRect(0, 0, 640, 230);
      g.fillStyle = 'rgba(255,93,110,.12)'; g.fillRect(X, Y + Hd * 0.75, Wd, Hd * 0.25); text(g, 'скучно — уйду', X + 6, Y + Hd * 0.88, '#ff5d6e', 10, 'left');
      g.strokeStyle = '#2a3560'; g.lineWidth = 1; for (let m = 0; m <= mins; m++) { const x = X + Wd * m / mins; g.beginPath(); g.moveTo(x, Y); g.lineTo(x, Y + Hd); g.stroke(); text(g, m + '′', x, Y + Hd + 14, '#6a7090', 10); }
      v.beats.forEach(b => { const x = X + Wd * b.at / mins; g.strokeStyle = '#ffffff22'; g.beginPath(); g.moveTo(x, Y); g.lineTo(x, Y + Hd); g.stroke(); emo(g, BEAT_K[b.kind].icon, x, Y - 18, 18); });
      const vals = interest(v.beats, mins);
      let upto = 1;
      if (play >= 0) { upto = clamp((now - t0) / 1000 / (fast() ? 1.5 : 10), 0, 1); if (upto >= 1) { play = -1; v.watched = true; save(); paint(); beep('done'); } }
      const p = curveDraw(g, X, Y, Wd, Hd, vals, upto, '#7cf5a8');
      if (play >= 0) { emo(g, p.v > 0.55 ? '🤩' : p.v > 0.3 ? '🙂' : '😴', p.x, p.y - 20, 24); text(g, mmss(upto * mins * 60), 620, 20, '#f2efe6', 13, 'right'); }
      const q = quitAt(); if (q != null && play < 0) { const x = X + Wd * q / mins; glow(g, x, Y + Hd * 0.8, 30, 'rgba(255,93,110,.5)'); emo(g, '🚪', x, Y + Hd * 0.8, 18); }
    }
    paint(); raf = requestAnimationFrame(loop);
    host.append(pal, cv, info, out);
    return host;
  };

  /* ---------------- trailer: раскадровка на 30 секунд ---------------- */
  STEPS.trailer = ctx => {
    const st = ctx.step, shots = st.shots || [];
    let v = Object.assign({ shots: {}, watched: false }, ctx.value);
    const host = el('div', { class: 'stack' }), list = el('div', { class: 'm8-shots' }), cv = el('canvas', { width: 640, height: 240, class: 'm8-tcv' }), g = cv.getContext('2d');
    const total = shots.reduce((a, s) => a + s.sec, 0) || 30;
    const ok = () => shots.every(s => valText(v.shots[s.id])) && v.watched;
    let t0 = -1, raf = 0, drawn = 0;
    function draw() {
      list.replaceChildren(...shots.map((s, i) => el('div', { class: 'm8-shot', style: `--c:${s.col || '#5fe0ff'};--w:${s.sec}` },
        el('div', { class: 'm8-shead' }, el('span', {}, s.icon), el('b', {}, s.label), el('span', { class: 'small muted' }, `${s.sec} с`)),
        fieldEditor({ id: s.id, label: s.hint, deck: s.deck }, v.shots[s.id], nv => { v.shots = Object.assign({}, v.shots, { [s.id]: nv }); ctx.save(v, ok() ? true : null); }, { idPrefix: st.id }))));
    }
    function loop(now) {
      if (!cv.isConnected) { cancelAnimationFrame(raf); return; } raf = requestAnimationFrame(loop);
      if (window.LAB_LOWRES && now - drawn < 150) return; drawn = now;
      g.fillStyle = '#05070f'; g.fillRect(0, 0, 640, 240);
      const sec = t0 < 0 ? 0 : (now - t0) / 1000 * (fast() ? 10 : 1);
      if (t0 >= 0 && sec >= total) { t0 = -1; v.watched = true; ctx.save(v, ok() ? true : null); beep('done'); }
      let acc = 0, curS = shots[0], local = 0;
      for (const s of shots) { if (sec >= acc && sec < acc + s.sec) { curS = s; local = (sec - acc) / s.sec; } acc += s.sec; }
      if (t0 < 0) { text(g, '▶ Посмотреть раскадровку', 320, 110, '#f2efe6', 18); text(g, `${total} секунд · ${shots.length} кадров`, 320, 140, '#9aa3c7', 12); }
      else if (curS) {
        const col = curS.col || '#5fe0ff', z = 1 + local * 0.08; // медленный наезд камеры
        g.save(); g.translate(320, 110); g.scale(z, z); glow(g, 0, 0, 160, col + '55'); emo(g, curS.icon, 0, -30, 46); wrap(g, valText(v.shots[curS.id]) || curS.label, 0, 34, 480, 22, '#ffffff', 18, 'center', 800); g.restore();
        if (local < 0.12) { g.fillStyle = `rgba(255,255,255,${0.6 * (1 - local / 0.12)})`; g.fillRect(0, 0, 640, 240); } // вспышка на склейке
        g.fillStyle = '#000'; g.fillRect(0, 0, 640, 18); g.fillRect(0, 222, 640, 18); // кинополосы
      }
      let x = 0; shots.forEach(s => { const w = 640 * s.sec / total; g.fillStyle = (s.col || '#5fe0ff') + (sec >= x / 640 * total && t0 >= 0 ? '' : '55'); g.fillRect(x + 1, 226, w - 2, 10); x += w; });
      if (t0 >= 0) { g.fillStyle = '#fff'; g.fillRect(640 * sec / total, 222, 2, 18); }
    }
    cv.addEventListener('click', () => { t0 = performance.now(); beep('good'); });
    draw(); raf = requestAnimationFrame(loop);
    host.append(cv, list, el('p', { class: 'small muted' }, st.howto || 'Запись из игры: Win + Alt + R (Xbox Game Bar в Windows) или OBS. Записывай кадр за кадром по раскадровке, потом склей.'));
    return host;
  };

  /* ---------------- stand: карточка стенда ---------------- */
  STEPS.stand = ctx => {
    const st = ctx.step;
    let v = Object.assign({ fields: {}, printed: false }, ctx.value);
    const host = el('div', { class: 'stack' }), card = el('div', { class: 'm8-stand' }), form = el('div', { class: 'm8-pfields' });
    let info = null;
    async function load() {
      try { const r = await api('/api/arcade'); info = (r.mine || []).find(c => S.game && c.id === S.game.id) || (r.mine || []).slice(-1)[0] || null; } catch (e) { info = null; }
      paint();
    }
    const pitch = stepVal('pitch', (s, x) => x.card || {}) || {};
    const val = k => valText(v.fields[k]);
    function paint() {
      const title = val('title') || (info && info.title) || 'Моя игра', authors = val('authors') || (info ? (info.members || [info.nick]).join(', ') : S.me.nick);
      const donor = val('donor') || (info && info.donor ? info.donor.split(' — ')[0] : '') || '…';
      const url = info ? `${location.origin}/arcade?game=${encodeURIComponent(info.id)}` : location.origin + '/arcade';
      let qr = null; try { qr = QR.svg(url, 4); } catch (e) { qr = el('div', { class: 'small muted' }, 'QR не поместился'); }
      card.replaceChildren(
        el('div', { class: 'm8-sttl' }, title), el('div', { class: 'm8-sauth' }, authors + ' · ' + (S.me.class && S.me.class.name || '')),
        el('div', { class: 'm8-sphrase' }, val('phrase') || valText(pitch.phrase) || ''),
        el('div', { class: 'm8-skeys' }, '🎮 ' + (val('keys') || 'Управление: …')),
        el('div', { class: 'm8-sqr' }, qr, el('span', { class: 'small' }, 'Сыграй дома: наведи камеру')),
        el('div', { class: 'm8-sdonor' }, 'по мотивам механики ' + donor),
        info && info.record ? el('div', { class: 'm8-srec' }, `🏆 Рекорд: ${info.record.score} — ${info.record.nick}`) : null);
      card.querySelectorAll(':scope > *').forEach((n, i) => n.style.setProperty('--d', `${i * 90}ms`));
    }
    const inp = (k, label, ph) => el('label', { class: 'm8-pf' }, el('span', { class: 'small muted' }, label), el('input', { type: 'text', maxlength: '120', value: val(k), placeholder: ph, 'data-sf': k, oninput: e => { v.fields = Object.assign({}, v.fields, { [k]: e.target.value }); ctx.save(v, ok() ? true : null); paint(); } }));
    const ok = () => !!val('keys') && (v.printed || v.saved);
    form.append(inp('title', 'Название', 'как в аркаде'), inp('authors', 'Авторы', 'ники команды'), inp('keys', 'Управление одной строкой', '← → летать, A — нести пыльцу'), inp('phrase', 'Одна фраза для гостя', 'из питча'), inp('donor', 'По мотивам механики', 'донор'));
    const dl = el('a', { class: 'btn ghost small', href: '#', onclick: e => { if (!S.game || !S.game.current) { e.preventDefault(); toast('Игры ещё нет'); return; } e.currentTarget.href = `/download/${S.game.id}/${S.game.current}.html`; } }, '⬇ Файл игры для дома');
    host.append(el('div', { class: 'm8-standwrap' }, card, form),
      el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn', onclick: () => { v.printed = true; ctx.save(v, ok() ? true : null, true); document.body.classList.add('m8-print-stand'); window.print(); setTimeout(() => document.body.classList.remove('m8-print-stand'), 500); } }, '🖨 Печать карточки'),
        el('button', { type: 'button', class: 'btn ghost small', onclick: () => { v.saved = true; ctx.save(v, ok() ? true : null, true); beep('done'); toast(ok() ? 'Карточка готова' : 'Допиши управление', ok() ? 'ok' : ''); } }, '✓ Карточка готова'), dl));
    paint(); load();
    return host;
  };

  /* ---------------- fest: стенд на Фестивале ---------------- */
  STEPS.fest = ctx => {
    const st = ctx.step;
    let v = Object.assign({ guests: 0, plays: 0, again: 0, likes: {} }, ctx.value);
    const host = el('div', { class: 'stack' });
    if (!hasGame()) { host.append(el('div', { class: 'card muted' }, 'У стенда нет игры: проверь, что ты в команде проекта, и обнови страницу.')); return host; }
    let stand = null, phase = 'attract', h = null;
    const wrap = el('div', { class: 'm8-fest' }), over = el('div', { class: 'm8-fover' }), stats = el('div', { class: 'm8-fstats' }), banner = el('div', { class: 'm8-fbanner', hidden: true });
    const ev = async (kind, extra) => { try { const r = await api('/api/fest/event', Object.assign({ kind }, extra)); stand = r.stand; paintStats(); } catch (e) { toast(e.message, 'err'); } };
    function paintStats() {
      const s = stand || { guests: v.guests, plays: v.plays, again: v.again, likes: v.likes, top: [] };
      stats.replaceChildren(el('div', {}, el('b', {}, String(s.guests)), el('span', {}, 'гостей')), el('div', {}, el('b', {}, String(s.plays)), el('span', {}, 'партий')), el('div', {}, el('b', {}, String(s.again)), el('span', {}, '«ещё раз»')),
        el('div', {}, el('b', {}, `🤩 ${(s.likes || {}).wow || 0}`), el('span', {}, `😃 ${(s.likes || {}).ok || 0} · 🙂 ${(s.likes || {}).meh || 0}`)),
        el('ol', { class: 'm8-ftop' }, ...((s.top || []).slice(0, 3).map((r, i) => el('li', {}, `${['🥇', '🥈', '🥉'][i]} ${r.nick} — ${r.score}`)))));
    }
    function paintOver() {
      over.hidden = phase === 'play';
      const g = S.game;
      if (phase === 'attract') over.replaceChildren(el('div', { class: 'm8-fattract' }, el('div', { class: 'm8-fttl' }, g.title || 'Моя игра'), el('div', { class: 'small' }, st.hint || 'Подходи — сыграй одну партию!'), el('button', { type: 'button', class: 'btn big', onclick: () => { v.guests++; ctx.save(v); ev('guest'); phase = 'play'; paintOver(); h.start(); } }, '▶ Играть')));
      else if (phase === 'like') over.replaceChildren(el('div', { class: 'm8-flike' }, el('b', {}, 'Как тебе?'), el('div', { class: 'row' }, ...[['wow', '🤩'], ['ok', '😃'], ['meh', '🙂']].map(([k, e]) => el('button', { type: 'button', class: 'm8-likebtn', 'data-like': k, onclick: () => { v.likes[k] = (v.likes[k] || 0) + 1; ctx.save(v, true); ev('like', { like: k }); beep('good'); phase = 'again'; paintOver(); } }, e)))));
      else if (phase === 'again') over.replaceChildren(el('div', { class: 'm8-flike' }, el('b', {}, 'Спасибо!'), el('div', { class: 'row' },
        el('button', { type: 'button', class: 'btn big', onclick: () => { v.again++; ctx.save(v, true); ev('again'); phase = 'play'; paintOver(); h.start(); } }, '🔁 Ещё раз!'),
        el('button', { type: 'button', class: 'btn ghost', onclick: () => { phase = 'attract'; paintOver(); h.stop(true); } }, 'Следующий гость →'))));
    }
    h = Games.frame({ src: () => `/play/${S.game.id}/${S.game.current}`, key: () => 'game:' + S.game.id, label: 'Играть', autostart: false,
      onOver: () => { v.plays++; ctx.save(v); ev('over'); setTimeout(() => { if (phase === 'play') { phase = 'like'; paintOver(); } }, fast() ? 100 : 1600); } });
    wrap.append(h.box, over);
    paintOver(); paintStats();
    S.hooks.push(kind => { if (kind === 'proekt' && host.isConnected) api('/api/fest').then(f => { stand = f.mine || stand; paintStats(); banner.hidden = !f.phase; const ph = (f.phases || []).find(x => x.id === f.phase); if (ph) banner.textContent = '🎪 Сейчас: ' + ph.label; }).catch(() => {}); });
    api('/api/fest').then(f => { stand = f.mine; paintStats(); }).catch(() => {});
    host.append(banner, wrap, stats, el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn ghost small', onclick: () => h.fullscreen() }, '⛶ Стенд на весь экран'), el('span', { class: 'small muted' }, 'После партии гость нажимает реакцию — портал считает «Ещё раз!» и «Выбор зрителей».')));
    return host;
  };

  /* ---------------- sertifikat: сертификат курса ---------------- */
  STEPS.sertifikat = ctx => {
    const host = el('div', { class: 'stack' }), card = el('div', { class: 'm8-cert' });
    async function load() {
      let s = null, f = null; try { s = await api('/api/studio'); } catch (e) { /* без студии */ } try { f = await api('/api/fest'); } catch (e) { /* без Фестиваля */ }
      const games = s ? s.games : [], vers = games.reduce((a, gm) => a + (gm.versions || 0), 0), rel = games.filter(gm => gm.release).length;
      const badges = s ? s.badges.filter(b => b.got) : [], fin = S.game && games.find(gm => gm.id === S.game.id), mine = f && f.mine;
      card.replaceChildren(el('div', { class: 'm8-cseal' }, '🎓'), el('div', { class: 'eyebrow' }, 'Лаборатория игр · ШКИ'), el('h2', {}, 'Сертификат геймдизайнера'),
        el('div', { class: 'm8-cname' }, S.me.nick), el('p', {}, 'прошёл курс «Лаборатория игр» от первой игры за 15 минут до своей игры на Фестивале'),
        el('div', { class: 'm8-cstats' }, ...[[games.length, 'игр'], [vers, 'версий'], [rel, 'релизов 1.0'], [badges.length, 'значков']].map(([n, l], i) => el('div', { style: `--d:${400 + i * 120}ms` }, el('b', {}, String(n)), el('span', {}, l)))),
        fin ? el('p', { class: 'm8-cfin' }, `Итоговая игра: «${fin.title}»` + (mine ? ` — ${mine.guests} гостей, ${mine.plays} партий, «ещё раз» ${mine.again}` : '')) : null,
        el('div', { class: 'm8-cbadges' }, ...badges.map((b, i) => el('span', { title: b.title, style: `--d:${900 + i * 80}ms` }, b.icon))));
      ctx.save({ games: games.length, versions: vers, releases: rel, badges: badges.length }, true);
    }
    load();
    host.append(card, el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn ghost small', onclick: () => { document.body.classList.add('m8-print-cert'); window.print(); setTimeout(() => document.body.classList.remove('m8-print-cert'), 500); } }, '🖨 Печать'), el('a', { class: 'btn ghost small', href: '/studio' }, 'Моя студия: все игры и журнал →')));
    return host;
  };

  // итог шага одной строкой — для «Скопировать результат» и выгрузки учителя
  window.LabStepsM8Summary = (step, v) => {
    switch (step.type) {
      case 'donordeck': return v.donor ? `донор: ${v.donor}${v.cross ? ' × ' + v.cross : ''}; сыграл: ${(v.played || []).join(', ') || '—'}` : 'донор не выбран';
      case 'pitch': return `питч «${valText((v.card || {}).title) || '—'}»: ${valText((v.card || {}).phrase) || '—'}; репетиций ${v.rehearsals || 0}${v.sent ? '; на стене' : ''}`;
      case 'pitchwall': return `❤ хочу сыграть: ${(v.hearts || []).join(', ') || '—'}`;
      case 'dizdok': return v.sent ? `диздок «${v.title || ''}» отправлен${v.approved ? ', утверждён' : ''}` : 'диздок не отправлен';
      case 'seryy': return `серым: партий ${(v.grey || {}).rounds || 0}, ${Math.round((v.grey || {}).time || 0)} с; в цвете: партий ${(v.color || {}).rounds || 0}, ${Math.round((v.color || {}).time || 0)} с; голос: ${v.vote || '—'}`;
      case 'observe': return `наблюдений ${(v.sessions || []).length}: ` + (v.sessions || []).map(s => `${s.who} ${mmss(s.len || 0)} — ${s.marks.map(m => (MARKS.find(x => x[0] === m.k) || [0, m.k])[1]).join('')}`).join('; ') + (v.top ? `; находка: ${v.top}` : '');
      case 'moscow': return BASK.map(([b, n]) => `${n}: ${(v.items || []).filter(i => i.b === b).map(i => i.t).join(', ') || '—'}`).join('; ');
      case 'kontent': return `событий ${(v.beats || []).length}: ` + (v.beats || []).slice().sort((a, b) => a.at - b.at).map(b => `${b.at} мин ${BEAT_K[b.kind] ? BEAT_K[b.kind].label : b.kind}`).join(', ');
      case 'trailer': return Object.entries(v.shots || {}).map(([k, x]) => `${k}: ${valText(x)}`).join('; ') + (v.watched ? '; раскадровка просмотрена' : '');
      case 'stand': return `карточка стенда: ${Object.entries(v.fields || {}).map(([k, x]) => `${k}: ${valText(x)}`).join('; ')}${v.printed ? '; напечатана' : ''}`;
      case 'fest': return `гостей ${v.guests || 0}, партий ${v.plays || 0}, «ещё раз» ${v.again || 0}, 🤩 ${(v.likes || {}).wow || 0}`;
      case 'sertifikat': return `игр ${v.games || 0}, версий ${v.versions || 0}, релизов ${v.releases || 0}, значков ${v.badges || 0}`;
      default: return null;
    }
  };
  window.LabM8Kit = { pitchRing, interest, BEAT_K, MARKS, QR, colorOf, mmss };
})();
