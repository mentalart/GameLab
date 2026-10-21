// Шаги модуля 7 «Игры вместе» (уроки 26–28). Загружается после steps-m4.js и до student.js, тот добавляет их в STEPS.
//   arena      — «Арена класса»: забег всем классом по сети (games/arena-klassa.js), квота, итоги и голос за правило следующего забега;
//   bracket    — турнирная сетка дуэлей «Бомб во дворе» вдвоём за одним компьютером: победителя отмечает любой из двоих;
//   team       — команда джема: создать или вступить, роль (Режиссёр, Мастер Qwen, Тестер); solo — кнопка «Делаю один» (модуль 8);
//   jamcards   — карточки джема на кубике: донор-жанр и легенда Адыгеи, по одному перебросу, «Берём!»;
//   brainstorm — мозговой штурм команды: 10 идей за 10 минут вживую, голоса, выбор одной.
// Моушн-дизайн (просьба автора, 20.10.2026): сцены-объяснялки модуля добавляются в общую библиотеку шага motion (window.LabMotion из steps-m4.js).
// Помощники страницы ученика (S, Games, renderMain) берутся из student.js в момент вызова.
'use strict';
(function () {
  const { el, api, toast, beep } = Lab;
  const M = window.LabMotion;
  if (!M) return;
  const { MOTION, rr, text, disc, glow, sky, hero, arrow, confetti, seg, io, ob, lerp, clamp, TAU } = M;
  const fast = () => !!window.LAB_FAST;
  const mmss = sec => { const s = Math.max(0, Math.round(sec)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const COLS = ['#ff5fa2', '#ffb238', '#7cf5a8', '#5fd0ff', '#b48aff', '#ff6a4a', '#ffe14a', '#4affd8', '#ff8ad8', '#9ae64a', '#4a8aff', '#ffa0a0'];
  const colorOf = window.LabM7.colorOf; // цвет ученика — тот же, что у его боба на арене

  /* =================== MOTION: сцены модуля 7 =================== */
  // подпись внизу сцены: плашка и текст, появляется с отскоком
  function cap(g, s, t, at = 0, col = '#f2efe6') {
    const k = ob(seg(t, at, at + 0.45)); if (k <= 0) return;
    g.save(); g.globalAlpha = Math.min(1, k); g.translate(320, 272); g.scale(0.9 + 0.1 * k, 0.9 + 0.1 * k);
    rr(g, -300, -18, 600, 36, 10, 'rgba(11,16,32,.82)'); text(g, s, 0, 0, col, 14); g.restore();
  }
  // боб-участник забега: капсула с визором
  function bean(g, x, y, s, col, tilt = 0, squash = 0) {
    g.save(); g.translate(x, y); g.rotate(tilt); g.scale(1 + squash * 0.2, 1 - squash * 0.2);
    rr(g, -s * 0.55, -s * 1.6, s * 1.1, s * 1.6, s * 0.55, col); rr(g, -s * 0.38, -s * 1.25, s * 0.76, s * 0.34, s * 0.17, '#1b2238');
    disc(g, -s * 0.14, -s * 1.08, s * 0.07, '#fff'); disc(g, s * 0.14, -s * 1.08, s * 0.07, '#fff'); g.restore();
  }
  // речевой пузырь
  function bubble(g, x, y, s, k, col = '#ffffff', ink = '#0b1020', px = 15) {
    if (k <= 0) return; const w = Math.max(40, s.length * px * 0.62 + 20);
    g.save(); g.translate(x, y); g.scale(ob(Math.min(1, k)), ob(Math.min(1, k)));
    rr(g, -w / 2, -18, w, 34, 14, col); g.beginPath(); g.moveTo(-6, 15); g.lineTo(0, 26); g.lineTo(8, 15); g.fillStyle = col; g.fill();
    text(g, s, 0, -1, ink, px); g.restore();
  }
  // бомба с фитилём
  function bomb(g, x, y, r, t) {
    disc(g, x, y, r, '#232a3d'); disc(g, x - r * 0.35, y - r * 0.35, r * 0.25, '#4a5470');
    g.strokeStyle = '#c8a46a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + r * 0.5, y - r * 0.8); g.quadraticCurveTo(x + r, y - r * 1.4, x + r * 1.1, y - r * 1.5); g.stroke();
    glow(g, x + r * 1.1, y - r * 1.5, 8 + Math.sin(t * 30) * 3, '#ffd23f');
  }
  // крест взрыва на сетке клеток
  function blast(g, cx, cy, cell, len, k) {
    if (k <= 0 || k >= 1) return; const a = 1 - k, L = len * ob(Math.min(1, k * 3));
    g.globalAlpha = a; g.fillStyle = '#ffb547';
    g.fillRect(cx - cell * (L + 0.5), cy - cell * 0.35, cell * (2 * L + 1), cell * 0.7); g.fillRect(cx - cell * 0.35, cy - cell * (L + 0.5), cell * 0.7, cell * (2 * L + 1));
    g.fillStyle = '#fff4c2'; g.fillRect(cx - cell * (L + 0.3), cy - cell * 0.15, cell * (2 * L + 0.6), cell * 0.3); g.globalAlpha = 1;
    glow(g, cx, cy, cell * 2 * a + 10, '#ffd23f');
  }
  // экран-монитор
  function screen(g, x, y, w, h, col = '#141c36') { rr(g, x, y, w, h, 8, col, '#3a4880'); rr(g, x + w / 2 - 14, y + h, 28, 10, 2, '#3a4880'); rr(g, x + w / 2 - 34, y + h + 9, 68, 6, 3, '#3a4880'); }

  // --- урок 26: игры вместе ---
  MOTION.couch = (g, t, W, H) => {
    t %= 9; sky(g, W, H, '#1a1430', '#2b2050');
    screen(g, 200, 26, 240, 120, '#0d2a3a');
    // на экране две точки гоняются друг за другом
    const a = t * 2.2; disc(g, 320 + Math.cos(a) * 70, 86 + Math.sin(a * 1.3) * 30, 8, '#ff5fa2'); disc(g, 320 + Math.cos(a - 0.9) * 70, 86 + Math.sin((a - 0.9) * 1.3) * 30, 8, '#5fd0ff');
    // диван и двое
    rr(g, 150, 190, 340, 50, 16, '#7a3d5c'); rr(g, 140, 170, 40, 70, 14, '#8d4a6c'); rr(g, 460, 170, 40, 70, 14, '#8d4a6c');
    const look = t > 3 ? Math.sin(seg(t, 3, 3.4) * Math.PI / 2) : 0; // головы поворачиваются друг к другу
    hero(g, 250, 178, 26, '#ff5fa2', 1, t > 6 ? 0.3 * Math.abs(Math.sin(t * 12)) : 0);
    hero(g, 390, 178, 26, '#5fd0ff', look > 0.5 ? -1 : 1, t > 6 ? 0.3 * Math.abs(Math.sin(t * 12 + 1)) : 0);
    bubble(g, 230, 128, 'Ой, не туда!', seg(t, 1, 1.4), '#ffe08a');
    bubble(g, 410, 128, 'Ха-ха!', seg(t, 2.1, 2.5), '#c9f6ff');
    if (t > 3.4) bubble(g, 320, 150, '👀', seg(t, 3.4, 3.8), '#ffffff', '#0b1020', 20);
    if (t > 6) { confetti(g, 320, 150, seg(t, 6, 7.5), 22, 5); }
    cap(g, t < 3.4 ? 'Один экран, два игрока: кричим, смеёмся, толкаемся локтями' : t < 6 ? 'Видишь лицо соседа — это половина игры' : 'Эмоции рождаются между игроками, а не только в игре', t, 0.3);
  };
  MOTION['three-ways'] = (g, t, W, H) => {
    t %= 10.5; g.fillStyle = '#0b1020'; g.fillRect(0, 0, W, H);
    const P = [
      { x: 20, name: 'Соревнование', col: '#ff5d6e', sub: 'цели против друг друга' },
      { x: 230, name: 'Кооперация', col: '#7cf5a8', sub: 'одна цель на двоих' },
      { x: 440, name: 'Асимметрия', col: '#ffb547', sub: 'разные роли и знания' },
    ];
    const cur = Math.min(2, Math.floor(t / 3.2));
    P.forEach((p, i) => {
      const on = i === cur, k = on ? seg(t % 3.2, 0, 1.6) : i < cur ? 1 : 0, cx = p.x + 90;
      rr(g, p.x, 20, 180, 210, 14, on ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.02)', on ? p.col : '#2a3560');
      text(g, p.name, cx, 44, p.col, 16); text(g, p.sub, cx, 66, '#9aa3c7', 11, 'center', 600);
      if (i > cur) return;
      if (i === 0) { // двое тянут к своим флагам в разные стороны
        const d = 30 + 20 * io(k); hero(g, cx - d, 150, 14, '#ff5fa2', -1); hero(g, cx + d, 150, 14, '#5fd0ff', 1);
        arrow(g, cx - d - 18, 150, cx - 78, 150, '#ff5fa2'); arrow(g, cx + d + 18, 150, cx + 78, 150, '#5fd0ff'); disc(g, cx, 150, 8 + 3 * Math.sin(t * 8), '#ffd23f');
        text(g, '🏆 один', cx, 205, '#ffd23f', 13);
      } else if (i === 1) { // двое несут бревно к одной цели
        const x = lerp(cx - 50, cx + 20, io(k)); rr(g, x - 30, 120, 70, 10, 5, '#a0673a');
        hero(g, x - 26, 146, 14, '#ff5fa2', 1); hero(g, x + 34, 146, 14, '#5fd0ff', 1); disc(g, cx + 70, 140, 10, '#7cf5a8');
        text(g, '🏆 вместе', cx, 205, '#7cf5a8', 13);
      } else { // один видит карту, второй действует
        rr(g, cx - 75, 100, 60, 44, 6, '#1b2a50', '#ffb547'); text(g, '🗺️', cx - 45, 122, '#fff', 20);
        hero(g, cx - 45, 170, 14, '#ff5fa2', 1); hero(g, cx + 45, 170, 14, '#5fd0ff', -1);
        bubble(g, cx - 10, 98 + 0, 'левее!', seg(t % 3.2, 0.4, 0.8), '#ffe08a', '#0b1020', 12);
        if (k > 0.7) text(g, '✂️', cx + 45, 130, '#fff', 20);
        text(g, 'знаю ≠ могу', cx, 205, '#ffb547', 13);
      }
    });
    cap(g, 'Три способа играть вместе: против, вместе, по-разному', t, 0.2);
  };
  MOTION['bomb-trap'] = (g, t, W, H) => {
    t %= 8; sky(g, W, H, '#1d3a22', '#2f5a33');
    const C = 34, ox = 150, oy = 40, cols = 10, rows = 6;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = ox + i * C, y = oy + j * C, wall = i % 2 === 1 && j % 2 === 1, edge = j === 0 || j === rows - 1;
      g.fillStyle = (i + j) % 2 ? '#5fa14e' : '#69ad57'; g.fillRect(x, y, C, C);
      if (wall || edge) rr(g, x + 2, y + 2, C - 4, C - 4, 5, '#8a8f9c', '#5a5f6c');
    }
    // коридор по строке 2: P2 бежит вправо, P1 кладёт бомбу у входа, P2 зажат
    const row = oy + 2 * C + C / 2;
    const p2x = ox + C / 2 + C * Math.min(5, 1 + t * 1.6), p1x = ox + C / 2 + C * (t < 2.5 ? 8 - t * 0.6 : 6.5);
    const bx = ox + C / 2 + C * 6, bombOn = t > 2.4 && t < 5.2;
    if (bombOn) bomb(g, bx, row, 11 * (1 + 0.1 * Math.sin(t * 20)), t);
    if (t > 2.4 && t < 5.2) { g.fillStyle = 'rgba(255,93,110,.25)'; for (let k = -2; k <= 2; k++) g.fillRect(bx - C / 2 + k * C, row - C / 2, C, C); }
    blast(g, bx, row, C, 2, seg(t, 5.2, 6.2));
    hero(g, p2x + (t > 4.5 && t < 5.2 ? Math.sin(t * 50) * 2 : 0), row, 13, '#5fd0ff', 1);
    if (t < 5.3) hero(g, p1x, row - (t > 2.5 && t < 3 ? 10 : 0), 13, '#ff5fa2', -1);
    if (t > 2.6) bubble(g, p1x, row - 40, 'Попался!', seg(t, 2.6, 3), '#ffe08a');
    if (t > 3.6 && t < 5.2) bubble(g, p2x, row - 40, 'Ааа!', seg(t, 3.6, 4), '#c9f6ff');
    cap(g, t < 2.4 ? 'Один коридор, двое — кто первым поставит бомбу?' : t < 5.2 ? 'Твоя бомба закрыла выход соседу: ход одного меняет ход другого' : 'Это и есть взаимодействие: игроки играют друг с другом', t, 0.2);
  };
  MOTION['keep-talking'] = (g, t, W, H) => {
    t %= 9; g.fillStyle = '#10172d'; g.fillRect(0, 0, W, H);
    // слева сапёр видит бомбу, справа эксперт читает инструкцию, между ними — только голос
    screen(g, 40, 40, 220, 130, '#1a1020');
    rr(g, 90, 70, 120, 70, 8, '#3a3f55'); ['#ff5d6e', '#5fe0ff', '#ffd23f'].forEach((c, i) => { const cut = i === 1 && t > 6; g.strokeStyle = c; g.lineWidth = 4; g.beginPath(); g.moveTo(100, 86 + i * 18); g.lineTo(cut ? 145 : 200, 86 + i * 18); if (cut) { g.moveTo(160, 92 + i * 18); g.lineTo(200, 86 + i * 18); } g.stroke(); });
    text(g, t < 6.4 ? '0:0' + Math.max(0, 9 - Math.floor(t)) : '✔', 150, 62, t < 6.4 ? '#ff5d6e' : '#7cf5a8', 14);
    rr(g, 400, 40, 180, 140, 10, '#f2efe6'); for (let i = 0; i < 6; i++) { g.fillStyle = i === 2 && t > 3 ? '#ffb547' : '#c9c3b4'; g.fillRect(418, 62 + i * 18, 140 - (i % 3) * 20, 8); }
    text(g, '📖 инструкция', 490, 168, '#6b5137', 12);
    hero(g, 150, 220, 22, '#ff5fa2', 1); hero(g, 490, 220, 22, '#5fd0ff', -1);
    bubble(g, 200, 196, 'Тут три провода!', seg(t, 0.8, 1.2), '#ffe08a', '#0b1020', 13);
    bubble(g, 440, 196, 'Режь второй!', seg(t, 3.4, 3.8), '#c9f6ff', '#0b1020', 13);
    for (let k = 0; k < 3; k++) { const p = (t * 0.9 + k / 3) % 1; if (t > 1 && t < 6) disc(g, lerp(250, 390, (t < 3.4 ? p : 1 - p)), 120 + Math.sin(p * TAU) * 8, 4, t < 3.4 ? '#ffe08a' : '#c9f6ff'); }
    if (t > 6.4) { confetti(g, 150, 120, seg(t, 6.4, 8), 20, 2); }
    cap(g, t < 6.4 ? 'Keep Talking and Nobody Explodes, 2015: один видит бомбу, другой — инструкцию' : 'Асимметрия: игра держится на том, что вы говорите друг другу', t, 0.2);
  };
  MOTION['ghost-revenge'] = (g, t, W, H) => {
    t %= 7.5; sky(g, W, H, '#1d3a22', '#2f5a33');
    const C = 32, ox = 160, oy = 34;
    for (let j = 0; j < 7; j++) for (let i = 0; i < 10; i++) { g.fillStyle = (i + j) % 2 ? '#5fa14e' : '#69ad57'; g.fillRect(ox + i * C, oy + j * C, C, C); }
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.setLineDash([6, 6]); g.lineWidth = 2; g.strokeRect(ox - 18, oy - 18, 10 * C + 36, 7 * C + 36); g.setLineDash([]);
    // призрак выбывшего едет по краю и кидает бомбу внутрь
    const k = seg(t, 0.4, 3), gx = ox - 18 + (10 * C + 36) * io(k), gy = oy - 18;
    g.globalAlpha = 0.6 + 0.2 * Math.sin(t * 6); hero(g, gx, gy, 14, '#d8e0ff', 1); g.globalAlpha = 1; text(g, '👻', gx, gy - 24, '#fff', 16);
    const tx = ox + 6.5 * C, ty = oy + 3.5 * C;
    if (t > 3 && t < 4.6) { const f = seg(t, 3, 3.6); bomb(g, lerp(gx, tx, f), lerp(gy, ty, f) - Math.sin(f * Math.PI) * 50, 10, t); }
    blast(g, tx, ty, C, 2, seg(t, 4.6, 5.6));
    hero(g, ox + 2.5 * C, ty, 13, '#ff5fa2', 1);
    if (t < 5) hero(g, tx + (t > 4 ? (t - 4) * 30 : 0), ty, 13, '#5fd0ff', 1);
    if (t > 5) { hero(g, tx + 30, ty, 13, '#5fd0ff', 1); bubble(g, tx + 30, ty - 36, 'Еле ушёл!', seg(t, 5, 5.4), '#c9f6ff'); }
    cap(g, t < 3 ? 'Выбыл? Ты не скучаешь: призраком катишься по краю' : 'Super Bomberman: месть духа — выбывший всё ещё в игре', t, 0.2);
  };
  // --- урок 26: сеть ---
  MOTION.packets = (g, t, W, H) => {
    t %= 10; g.fillStyle = '#0b1020'; g.fillRect(0, 0, W, H);
    screen(g, 30, 50, 170, 110); screen(g, 440, 50, 170, 110);
    rr(g, 262, 70, 116, 70, 12, '#1a2445', '#5fe0ff'); text(g, '🖥️ сервер', 320, 105, '#5fe0ff', 14);
    const smooth = t > 5.5;
    // моя капсула бегает слева; соседская на правом экране повторяет её по письмам
    const myX = 115 + Math.sin(t * 1.6) * 55; bean(g, myX, 140, 18, '#ff5fa2');
    const step = 0.4, last = Math.floor(t / step) * step, at = 115 + Math.sin(last * 1.6) * 55, prevAt = 115 + Math.sin((last - step) * 1.6) * 55;
    const shown = smooth ? lerp(prevAt, at, seg(t - last, 0, step)) : at;
    bean(g, shown + 410, 140, 18, '#ff5fa2'); text(g, smooth ? 'плавно' : 'рывками', 525, 66, smooth ? '#7cf5a8' : '#ff5d6e', 12);
    for (let k = 0; k < 4; k++) { const p = ((t / step) + k / 4) % 1; const x = p < 0.5 ? lerp(200, 262, p * 2) : lerp(378, 440, p * 2 - 1); rr(g, x - 9, 98, 18, 12, 2, '#ffe08a'); }
    text(g, '✉️ «я тут: x, y, z»', 320, 180, '#ffe08a', 14);
    cap(g, !smooth ? 'Сеть — это письма: 10 раз в секунду «я тут». Между письмами сосед стоит' : 'Игра дорисовывает путь между письмами — и рывков не видно', t, 0.2);
  };
  MOTION['server-clock'] = (g, t, W, H) => {
    t %= 8; g.fillStyle = '#0b1020'; g.fillRect(0, 0, W, H);
    const sync = t > 4;
    for (let i = 0; i < 4; i++) {
      const x = 30 + i * 150; rr(g, x, 40, 130, 130, 12, '#141c36', '#3a4880');
      const ph = t * 2 + (sync ? 0 : i * 1.7);
      g.save(); g.translate(x + 65, 105); g.rotate(ph); rr(g, -50, -5, 100, 10, 5, '#ffb547'); disc(g, -50, 0, 7, '#ff5d6e'); disc(g, 50, 0, 7, '#ff5d6e'); g.restore();
      disc(g, x + 65, 105, 9, '#ff5fa2'); text(g, ['Аня', 'Тимур', 'Бэла', 'Ислам'][i], x + 65, 186, '#9aa3c7', 12);
    }
    if (sync) { disc(g, 320, 222, 16, '#5fe0ff'); g.strokeStyle = '#0b1020'; g.lineWidth = 3; g.beginPath(); g.moveTo(320, 222); g.lineTo(320 + Math.cos(t * 3) * 11, 222 + Math.sin(t * 3) * 11); g.stroke(); text(g, 'часы сервера', 320, 248, '#5fe0ff', 12); }
    cap(g, !sync ? 'У каждого своё время — у всех вертушки в разной фазе. Нечестно!' : 'Одни часы на всех: вертушка бьёт всех в одну секунду', t, 0.2);
  };
  MOTION['quota-crowd'] = (g, t, W, H) => {
    t %= 9; sky(g, W, H, '#79c7ff', '#cbeaff');
    rr(g, 0, 210, W, 90, 0, '#f0c75e'); rr(g, 540, 60, 16, 150, 4, '#ff5fa2'); rr(g, 600, 60, 16, 150, 4, '#ff5fa2'); rr(g, 530, 50, 96, 22, 8, '#ffd23f'); text(g, 'ФИНИШ', 578, 61, '#7a3a00', 13);
    const N = 12, Q = 7; let passed = 0;
    for (let i = 0; i < N; i++) {
      const sp = 70 + ((i * 37) % 50), x = Math.min(590, 30 + (t - 0.5) * sp + (i % 3) * 12), y = 200 - (i % 4) * 9;
      const fin = x >= 590; if (fin) passed++;
      bean(g, x, y + Math.abs(Math.sin(t * 9 + i)) * -4, 13, COLS[i % COLS.length], Math.sin(t * 9 + i) * 0.1);
    }
    passed = Math.min(passed, N);
    rr(g, 20, 20, 230, 40, 10, 'rgba(11,16,32,.8)'); text(g, `Прошли: ${Math.min(passed, Q)} из квоты ${Q}`, 135, 40, passed >= Q ? '#ff5d6e' : '#ffd23f', 15);
    if (passed >= Q) bubble(g, 320, 120, 'Квота закрыта!', 1, '#ff5d6e', '#fff', 16);
    cap(g, passed < Q ? 'Fall Guys: финишируют не все — мест всего 7 из 12' : 'Квота делает каждый забег гонкой даже для последних', t, 0.2);
  };
  MOTION['rule-vote'] = (g, t, W, H) => {
    t %= 8; g.fillStyle = '#10172d'; g.fillRect(0, 0, W, H);
    const C = [['🌙', 'Луна', 9], ['🌀', 'Ураган', 5], ['🧊', 'Тонкий лёд', 7], ['🙅', 'Без толчков', 3]];
    C.forEach(([ic, name, n], i) => {
      const x = 40 + i * 145, k = seg(t, 0.5 + i * 0.25, 4), v = Math.round(n * io(k)), win = t > 4.5 && i === 0;
      rr(g, x, 40, 125, 160, 12, win ? 'rgba(255,224,138,.12)' : '#141c36', win ? '#ffe08a' : '#3a4880');
      text(g, ic, x + 62, 80, '#fff', 30); text(g, name, x + 62, 120, '#f2efe6', 14);
      rr(g, x + 14, 150, 97 * (v / 10), 14, 7, win ? '#ffe08a' : '#5fe0ff'); text(g, String(v), x + 62, 182, '#9aa3c7', 13);
    });
    if (t > 4.5) { confetti(g, 102, 110, seg(t, 4.5, 6), 18, 4); }
    cap(g, t < 4.5 ? 'Класс голосует: какое правило в следующем забеге?' : 'Правило поменяли — и та же трасса стала новой игрой', t, 0.2);
  };
  // --- урок 27: джем ---
  MOTION['jam-clock'] = (g, t, W, H) => {
    t %= 10; g.fillStyle = '#0b1020'; g.fillRect(0, 0, W, H);
    const parts = [['🎲', 'Карточки', 10, '#ffb547'], ['💡', '10 идей', 10, '#ffe08a'], ['📝', 'Замысел', 20, '#7cf5a8'], ['🤖', 'Сборка', 40, '#5fe0ff'], ['🧪', 'Тест', 40, '#b49bff'], ['🎉', 'Показ', 30, '#ff5fa2']];
    const total = parts.reduce((a, p) => a + p[2], 0); let x = 30;
    const now = (t / 9) * total;
    let acc = 0;
    parts.forEach(([ic, name, m, col], i) => {
      const w = (W - 60) * m / total, k = clamp((now - acc) / m, 0, 1);
      rr(g, x, 110, w - 4, 50, 8, '#1a2445'); if (k > 0) rr(g, x, 110, (w - 4) * k, 50, 8, col);
      text(g, ic, x + w / 2, 92, '#fff', 18); text(g, name, x + w / 2, 178, k > 0 ? col : '#9aa3c7', 12);
      if (i === 2) { g.strokeStyle = '#ffffff55'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(x + w - 2, 60); g.lineTo(x + w - 2, 200); g.stroke(); g.setLineDash([]); text(g, 'урок 27 | урок 28', x + w - 2, 52, '#9aa3c7', 11); }
      x += w; acc += m;
    });
    cap(g, 'Джем: два урока, одна команда, одна игра. Время — главный ресурс', t, 0.2);
  };
  MOTION['ten-ideas'] = (g, t, W, H) => {
    t %= 11; g.fillStyle = '#10172d'; g.fillRect(0, 0, W, H);
    const ideas = ['Нарт ловит мяч', 'Прыжки по скалам', 'Гонка на конях', 'Огонь Сосруко', 'Защити аул', 'Бой с иныжем', 'Мост из стрел', 'Кузня Тлепша', 'Колесо Жан-Шерх', 'Пчёлы Мериесы'];
    ideas.forEach((s, i) => {
      const k = seg(t, 0.3 + i * 0.75, 0.8 + i * 0.75); if (k <= 0) return;
      const x = 80 + (i % 5) * 120, y = 70 + Math.floor(i / 5) * 90, late = i >= 6;
      g.save(); g.translate(x, y); g.scale(ob(k), ob(k));
      rr(g, -56, -26, 112, 52, 12, late ? '#ffe08a' : '#2a3560'); text(g, String(i + 1), -44, -14, late ? '#7a3a00' : '#9aa3c7', 11); text(g, s, 0, 4, late ? '#3a2400' : '#c9d0ee', 11, 'center', 700);
      g.restore();
    });
    if (t > 8) glow(g, 440, 160, 80, 'rgba(255,224,138,.3)');
    cap(g, t < 5 ? 'Первые идеи — самые очевидные: такие придут в голову всем' : 'Идеи 7–10 — самые странные и самые интересные. Не останавливайся!', t, 0.2);
  };
  MOTION.scope = (g, t, W, H) => {
    t %= 10; g.fillStyle = '#0b1020'; g.fillRect(0, 0, W, H);
    const add = ['+ мультиплеер', '+ магазин', '+ 20 уровней', '+ босс', '+ сюжет', '+ крафт'];
    const k = seg(t, 0.5, 6), pop = t > 6.3, r = 30 + 90 * io(k);
    if (!pop) { glow(g, 200, 140, r + 20, 'rgba(255,93,110,.25)'); disc(g, 200, 140, r, '#ff5d6e'); text(g, 'наша игра', 200, 140, '#fff', 14); }
    else { const p = seg(t, 6.3, 7); for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; disc(g, 200 + Math.cos(a) * 130 * p, 140 + Math.sin(a) * 130 * p, 6 * (1 - p), '#ff5d6e'); } text(g, 'ПФФ… не успели', 200, 140, '#ff5d6e', 16); }
    add.forEach((s, i) => { if (t > 0.6 + i * 0.85 && !pop) text(g, s, 200 + Math.cos(i * 1.1) * (r + 46), 140 + Math.sin(i * 1.1) * (r + 26), '#ffb547', 12); });
    // справа маленький, но готовый шар
    disc(g, 500, 150, 34, '#7cf5a8'); text(g, 'ядро', 500, 150, '#06140c', 13); if (t > 7) { text(g, '✓ готово', 500, 206, '#7cf5a8', 15); confetti(g, 500, 120, seg(t, 7, 8.5), 14, 7); }
    cap(g, t < 6.3 ? 'Раздувание: каждая «а давай ещё» делает игру больше, а время не растёт' : 'Маленькая готовая игра лучше большой недоделанной', t, 0.2);
  };
  MOTION.roles = (g, t, W, H) => {
    t %= 9; g.fillStyle = '#10172d'; g.fillRect(0, 0, W, H);
    const R = [['🎬', 'Режиссёр', 'держит идею и чувство', '#ffb547'], ['🤖', 'Мастер Qwen', 'пишет задания и вставляет код', '#5fe0ff'], ['🧪', 'Тестер', 'играет, ищет, что сломано', '#b49bff']];
    R.forEach(([ic, name, sub, col], i) => {
      const x = 110 + i * 210, on = Math.floor(t / 2.4) % 3 === i;
      if (on) glow(g, x, 110, 70, col + '55');
      disc(g, x, 110, 42, on ? col : '#1a2445'); text(g, ic, x, 110, '#fff', 30);
      text(g, name, x, 172, col, 15); text(g, sub, x, 194, '#9aa3c7', 11, 'center', 600);
    });
    const p = (t % 2.4) / 2.4, from = Math.floor(t / 2.4) % 3, to = (from + 1) % 3;
    const ax = 110 + from * 210, bx = 110 + to * 210;
    if (to !== 0) { disc(g, lerp(ax + 44, bx - 44, io(p)), 110 - Math.sin(p * Math.PI) * 30, 7, '#ffe08a'); }
    else { const k = io(p); disc(g, lerp(530 - 30, 110 + 30, k), 220 + Math.sin(k * Math.PI) * 14, 7, '#ffe08a'); }
    cap(g, 'Три роли — один круг: идея → код → тест → снова идея', t, 0.2);
  };
  MOTION['legend-mix'] = (g, t, W, H) => {
    t %= 9; g.fillStyle = '#0b1020'; g.fillRect(0, 0, W, H);
    const flip = (x, k, front, back, col) => { const s = Math.cos(Math.min(1, k) * Math.PI); g.save(); g.translate(x, 120); g.scale(Math.abs(s) || 0.01, 1); rr(g, -70, -80, 140, 160, 12, s > 0 ? '#2a3560' : col, '#ffffff33'); if (s > 0) text(g, '🎲', 0, 0, '#fff', 40); else { text(g, back[0], 0, -30, '#fff', 34); text(g, back[1], 0, 22, '#0b1020', 13); text(g, back[2], 0, 44, '#0b1020', 10, 'center', 600); } g.restore(); };
    flip(120, seg(t, 0.5, 1.3), null, ['💣', 'Бомбы во дворе', 'жанр-основа'], '#ffb547');
    flip(320, seg(t, 1.8, 2.6), null, ['🔥', 'Огонь Сосруко', 'легенда нартов'], '#7cf5a8');
    if (t > 3.2) { text(g, '+', 220, 120, '#fff', 30); text(g, '=', 420, 120, '#fff', 30); }
    if (t > 3.6) { const k = ob(seg(t, 3.6, 4.3)); g.save(); g.translate(530, 120); g.scale(k, k); rr(g, -80, -80, 160, 160, 14, '#ffe08a'); text(g, '🕹️', 0, -30, '#fff', 36); text(g, 'Кто вынесет', 0, 18, '#3a2400', 13); text(g, 'огонь из пещеры?', 0, 38, '#3a2400', 13); g.restore(); }
    cap(g, t < 3.6 ? 'Жанр берём у классики, историю — у легенд Адыгеи' : 'Механика + легенда = своя игра, какой ещё не было', t, 0.2);
  };
  // --- урок 28: финиш джема ---
  MOTION['cut-feature'] = (g, t, W, H) => {
    t %= 9; g.fillStyle = '#10172d'; g.fillRect(0, 0, W, H);
    const F = ['ядро: бегать и ловить', 'спрятанная механика', 'второй игрок', 'магазин скинов', 'сюжетные ролики', '20 уровней'];
    F.forEach((s, i) => {
      const y = 40 + i * 34, cut = i >= 3 && t > 2 + (i - 3) * 1.1, k = cut ? seg(t, 2 + (i - 3) * 1.1, 2.6 + (i - 3) * 1.1) : 0;
      g.save(); g.globalAlpha = 1 - k * 0.7; g.translate(k * 160, 0);
      rr(g, 150, y, 340, 28, 8, i < 3 ? '#1f5a3c' : '#2a3560'); text(g, s, 320, y + 14, i < 3 ? '#7cf5a8' : '#c9d0ee', 13);
      g.restore();
      if (cut && k < 1) text(g, '✂️', 150 + 340 * k, y + 14, '#fff', 20);
    });
    cap(g, t < 2 ? 'За час до показа список хотелок длинный' : 'Режем всё, без чего игра всё равно работает. Ядро остаётся', t, 0.2);
  };
  MOTION.retro = (g, t, W, H) => {
    t %= 9; g.fillStyle = '#0b1020'; g.fillRect(0, 0, W, H);
    const C = [['👍', 'Сработало', '#7cf5a8', ['делили роли', 'тест каждые 10 минут']], ['👎', 'Не сработало', '#ff5d6e', ['спорили 15 минут', 'Qwen сломал счёт']], ['🧪', 'Попробуем', '#ffe08a', ['вырезать раньше', 'карту рисовать вместе']]];
    C.forEach(([ic, name, col, notes], i) => {
      const x = 30 + i * 200; rr(g, x, 30, 180, 200, 12, '#141c36', col);
      text(g, ic + ' ' + name, x + 90, 52, col, 15);
      notes.forEach((n, j) => { const k = ob(seg(t, 0.6 + i * 1.2 + j * 0.5, 1.1 + i * 1.2 + j * 0.5)); if (k <= 0) return; g.save(); g.translate(x + 90, 96 + j * 56); g.rotate((j - 0.5) * 0.06); g.scale(k, k); rr(g, -76, -20, 152, 40, 6, '#ffe9a0'); text(g, n, 0, 0, '#3a2400', 12, 'center', 700); g.restore(); });
    });
    cap(g, 'Ретро после релиза: не «кто виноват», а «что попробуем в следующий раз»', t, 0.2);
  };

  /* =================== arena: «Арена класса» по сети =================== */
  // Рамка игры шлёт положение (lab.net.send) — шаг каждые 100 мс отправляет его на сервер и отдаёт игре соседей, часы и правила.
  // Учитель не открыл арену — игра бежит одна с ботами. Под игрой — фаза забега, итоги и голос за правило следующего забега.
  function stepArena(ctx) {
    const st = ctx.step;
    let v = Object.assign({ rounds: [], best: null, offline: 0, vote: null }, ctx.value);
    let lastMe = null, busy = false, room = null, ar = null, lastPaint = 0, offlineRun = true;
    const phaseBox = el('div', { class: 'm7-phase', 'aria-live': 'polite' }), board = el('div', { class: 'm7-board' }), cardsBox = el('div', { class: 'm7-cards' });
    const h = Games.frame({
      src: () => '/engine/game.html?game=../' + st.game, key: () => 'remake:' + st.id, cfg: st.cfg, label: 'Выйти на арену', autostart: false,
      onNet: m => { lastMe = m.me || null; },
      onOver: () => { if (offlineRun) { v.offline++; ctx.save(v, ctx.done || v.offline >= 1 || v.rounds.length > 0); paintAll(); } },
    });
    async function tick() {
      if (!h.box.isConnected) return stop();
      if (busy || !h.ready) return;
      busy = true;
      try {
        const r = await api('/api/arena/move', { me: lastMe || {} });
        room = r.room; offlineRun = room.phase === 'off';
        if (!offlineRun) h.post({ type: 'net', now: r.now, room: r.room, others: r.others });
        if (r.me.f != null && !v.rounds.some(x => x.round === room.round)) {
          v.rounds = v.rounds.concat({ round: room.round, place: r.me.place, t: r.me.f }).slice(-20);
          v.best = Math.min(v.best || 99, r.me.place); beep('good'); ctx.save(v, true);
        }
        if (performance.now() - lastPaint > 500) { lastPaint = performance.now(); paintPhase(); }
      } catch (e) { /* сеть моргнула — следующее письмо через 100 мс */ }
      busy = false;
    }
    const timer = setInterval(tick, 100);
    function stop() { clearInterval(timer); }
    async function load() { try { ar = await api('/api/arena'); paintAll(); } catch (e) { /* без арены */ } }
    function paintPhase() {
      const ph = (room || ar || {}).phase || 'off', R = room || ar || {};
      const text = { off: '🤖 Учитель ещё не открыл арену — бежишь с ботами. Квота та же: финишируют не все.', lobby: '🟡 Загон: класс собирается. Разминайся, сейчас будет старт!', run: '🟢 Забег идёт! Квота: ' + (R.quota || '?') + ' из ' + (R.n || '?'), done: '🏁 Забег окончен. Смотри итоги и голосуй за правило следующего.' }[ph];
      phaseBox.className = 'm7-phase ' + ph; phaseBox.textContent = text;
    }
    function paintBoard() {
      const R = room || ar || {}, res = R.results || [];
      board.innerHTML = '';
      if (!res.length) { board.append(el('div', { class: 'muted small' }, v.rounds.length ? `Твои забеги: ${v.rounds.map(x => x.place + ' место').join(', ')}` : 'Итоги появятся, когда кто-то добежит до короны.')); return; }
      board.append(el('div', { class: 'eyebrow' }, `Забег ${R.round}: прошли ${res.length}${R.quota ? ' из квоты ' + R.quota : ''}`));
      const list = el('ol', { class: 'm7-podium' });
      res.slice(0, 12).forEach((r, i) => list.append(el('li', { class: r.nick === S.me.nick ? 'me' : '', style: `--c:${colorOf(r.nick)};--d:${i * 60}ms` }, el('b', {}, i === 0 ? '👑' : String(i + 1)), el('span', {}, r.nick), el('span', { class: 'muted' }, String(r.t).replace('.', ',') + ' с'))));
      board.append(list);
    }
    function paintCards() {
      cardsBox.innerHTML = '';
      if (!st.cards) return;
      const tally = ((ar && ar.cards) || []).reduce((o, c) => (o[c.id] = c.votes, o), {});
      const max = Math.max(1, ...Object.values(tally));
      cardsBox.append(el('div', { class: 'eyebrow' }, 'Правило следующего забега: голосуй'));
      const grid = el('div', { class: 'm7-rulegrid' });
      st.cards.forEach(c => {
        const n = tally[c.id] || 0, mine = (ar && ar.myVote) === c.id;
        grid.append(el('button', { type: 'button', class: 'm7-rule' + (mine ? ' on' : ''), 'aria-pressed': String(mine), onclick: () => vote(c.id) },
          el('span', { class: 'm7-ic' }, c.icon || '🎲'), el('b', {}, c.label), el('span', { class: 'small muted' }, c.hint || ''),
          el('i', { class: 'm7-bar' }, el('i', { style: `width:${Math.round(100 * n / max)}%` })), el('span', { class: 'small' }, n ? `${n} ${n === 1 ? 'голос' : n < 5 ? 'голоса' : 'голосов'}` : 'пока нет голосов')));
      });
      cardsBox.append(grid);
    }
    async function vote(id) {
      try { ar = await api('/api/arena/vote', { card: id }); v.vote = ar.myVote; ctx.save(v); beep('tick'); paintCards(); } catch (e) { toast(e.message, 'err'); }
    }
    function paintAll() { paintPhase(); paintBoard(); paintCards(); }
    S.hooks.push((kind, d) => { if (kind === 'arena' && h.box.isConnected) { ar = Object.assign({}, ar, d, { myVote: ar && ar.myVote }); if (d.phase !== 'off') room = Object.assign({}, room, d); paintAll(); } });
    load();
    return el('div', { class: 'stack' }, phaseBox, h.box, Games.bar(h), el('div', { class: 'm7-arena' }, board, cardsBox),
      el('div', {}, el('button', { class: 'btn ghost small', type: 'button', onclick: () => ctx.save(v, true) }, 'Готово, дальше')));
  }

  /* =================== bracket: турнирная сетка дуэлей =================== */
  // Пары садятся вдвоём за один компьютер. Победителя отмечает любой из двоих; сетка анимируется у всех и на проекторе (рисует m7-pult.js).
  // rule — как играет пара (урок 11: один заезд, выше финишировал — прошёл), wait — строка до сетки; без них — «до wins побед» дуэли урока 26
  function stepBracket(ctx) {
    const st = ctx.step;
    let v = Object.assign({ played: 0, reported: [], out: false }, ctx.value);
    let b = null;
    const box = el('div', { class: 'stack' }), mine = el('div', { class: 'm7-mymatch' });
    const h = Games.frame({ src: () => '/engine/game.html?game=../' + st.game, key: () => 'remake:' + st.id, cfg: st.cfg, label: 'Играть вдвоём',
      onOver: () => { v.played++; ctx.save(v, ctx.done || (!b && v.played >= 1)); } });
    function myMatch() {
      if (!b) return null;
      for (let r = 0; r < b.rounds.length; r++) for (let i = 0; i < b.rounds[r].length; i++) { const m = b.rounds[r][i]; if ((m.a === S.me.nick || m.b === S.me.nick) && !m.w && m.a && m.b) return { r, i, m }; }
      return null;
    }
    function paint() {
      box.innerHTML = ''; mine.innerHTML = '';
      if (!b) { box.append(el('div', { class: 'card muted' }, st.wait || 'Учитель ещё не собрал сетку. Пока сыграйте вдвоём с соседом: так вы разомнётесь перед турниром.')); return; }
      box.append(window.LabM7.bracketSvg(b, S.me.nick));
      if (b.champion) box.append(el('div', { class: 'm7-champline' }, `👑 Чемпион класса: ${b.champion}`));
      const mm = myMatch();
      const lost = b.rounds.some(rd => rd.some(m => m.w && (m.a === S.me.nick || m.b === S.me.nick) && m.w !== S.me.nick));
      if (lost && !v.out) { v.out = true; ctx.save(v, true); }
      if (mm) {
        const other = mm.m.a === S.me.nick ? mm.m.b : mm.m.a;
        mine.append(el('b', {}, `Твоя пара: ${mm.m.a} — ${mm.m.b}`), el('span', { class: 'muted small' }, `Садитесь за один компьютер: ${S.me.nick} — WASD и F, ${other} — стрелки и K (или два геймпада). ${st.rule || `Играйте до ${st.wins || 3} побед.`}`),
          el('div', { class: 'row' }, ...[mm.m.a, mm.m.b].map(n => el('button', { type: 'button', class: 'btn small' + (n === S.me.nick ? '' : ' ghost'), onclick: () => report(mm, n) }, `🏆 Победил(а) ${n}`))));
      } else if (lost) mine.append(el('span', {}, 'Ты выбыл(а) — смотри сетку и болей за соседей. Месть духа в реальной жизни не работает 😉'));
      else if (b.champion === S.me.nick) mine.append(el('b', {}, '👑 Ты чемпион класса!'));
      else mine.append(el('span', { class: 'muted' }, 'Ждём, пока доиграют пары перед тобой.'));
      box.append(mine);
    }
    async function report(mm, winner) {
      try { const r = await api('/api/bracket/win', { round: mm.r, match: mm.i, winner }); b = r.bracket; v.reported = v.reported.concat(`${mm.m.a}–${mm.m.b}: ${winner}`).slice(-10); ctx.save(v, true); beep('done'); paint(); } catch (e) { toast(e.message, 'err'); }
    }
    async function load() { try { b = (await api('/api/bracket')).bracket; } catch (e) { b = null; } paint(); }
    S.hooks.push((kind, d) => { if (kind === 'bracket' && box.isConnected) { b = d; paint(); } });
    load();
    return el('div', { class: 'stack' }, box, h.box, Games.bar(h),
      el('div', {}, el('button', { class: 'btn ghost small', type: 'button', onclick: () => ctx.save(v, true) }, 'Готово, дальше')));
  }

  /* =================== team: команда джема =================== */
  const T = { data: null, loading: null };
  function loadTeam() { T.loading = T.loading || api('/api/team').then(r => { T.data = r; T.loading = null; return r; }).catch(e => { T.loading = null; throw e; }); return T.loading; }
  // перерисовка шага по событию команды: подгружаем свежую команду (событие несёт только id)
  function teamLive(host, draw) {
    S.hooks.push((kind, d) => { if (kind === 'team' && host.isConnected && (!d.team || !T.data || !T.data.team || d.team === T.data.team.id || !d.step)) loadTeam().then(draw).catch(() => {}); });
  }
  function stepTeam(ctx) {
    const st = ctx.step, host = el('div', { class: 'stack' });
    const act = async (path, body) => { try { T.data = Object.assign({}, T.data, await api(path, body)); beep('tick'); draw(); } catch (e) { toast(e.message, 'err'); } };
    function draw() {
      const d = T.data; host.innerHTML = '';
      if (!d) { host.append(el('div', { class: 'muted' }, 'Загружаю команды…')); return; }
      const t = d.team;
      if (t) {
        const myRole = t.roles[S.me.nick];
        if (!ctx.done && myRole) ctx.save({ team: t.name, role: myRole, members: t.members }, true);
        host.append(el('div', { class: 'm7-team' },
          el('div', { class: 'row' }, el('h3', { class: 'grow' }, `${t.emblem || '🛡'} Команда «${t.name}»`), el('button', { type: 'button', class: 'btn ghost small', onclick: () => act('/api/team/leave', {}) }, 'Выйти')),
          el('div', { class: 'm7-members' }, ...t.members.map((n, i) => el('div', { class: 'm7-member' + (n === S.me.nick ? ' me' : ''), style: `--c:${colorOf(n)};--d:${i * 80}ms` }, el('i', {}, n.slice(0, 1).toUpperCase()), el('b', {}, n), el('span', { class: 'small muted' }, t.roles[n] || '—')))),
          el('div', { class: 'eyebrow' }, 'Моя роль'),
          el('div', { class: 'm7-roles' }, ...(d.roles || []).map(r => el('button', { type: 'button', class: 'opt' + (r === myRole ? ' on' : ''), 'aria-pressed': String(r === myRole), onclick: () => act('/api/team/role', { role: r }) },
            el('b', {}, { 'Режиссёр': '🎬 ', 'Мастер Qwen': '🤖 ', 'Тестер': '🧪 ' }[r] + r), el('div', { class: 'small muted' }, (st.roles || {})[r] || ''))))));
        if (t.members.length < 2 && !st.solo) host.append(el('div', { class: 'small muted' }, 'Позови ещё одного-двух: команда — от двух до трёх человек.'));
        return;
      }
      const form = el('form', { class: 'row' }, el('input', { type: 'text', name: 'name', placeholder: 'Имя команды, например «Нарты»', maxlength: '30', style: 'max-width:280px' }), el('button', { class: 'btn small', type: 'submit' }, 'Создать команду'));
      form.addEventListener('submit', e => { e.preventDefault(); act('/api/team/create', { name: form.name.value }); });
      host.append(el('div', { class: 'eyebrow' }, 'Команды класса'));
      const grid = el('div', { class: 'm7-teams' });
      (d.teams || []).forEach((x, i) => grid.append(el('button', { type: 'button', class: 'm7-teamcard', style: `--d:${i * 60}ms`, onclick: () => act('/api/team/join', { team: x.id }) },
        el('b', {}, `${x.emblem || '🛡'} ${x.name}`), el('span', { class: 'small muted' }, x.members.join(', ') || 'пусто'), el('span', { class: 'small' }, `${x.members.length} из ${st.size || 3} · вступить →`))));
      if (!(d.teams || []).length) grid.append(el('div', { class: 'muted small' }, 'Команд пока нет. Создай первую — или учитель разложит всех сам.'));
      host.append(grid, form);
      // итоговый проект (модуль 8): можно делать игру одному — команда из одного человека, «Студия <ник>»
      if (st.solo) host.append(el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn ghost', 'data-solo': '1', onclick: () => act('/api/team/create', { name: 'Студия ' + S.me.nick, emblem: '🎮' }) }, '🎮 Делаю один'), el('span', { class: 'small muted' }, st.solo === true ? 'Своя студия из одного: все роли — твои.' : st.solo)));
    }
    teamLive(host, draw);
    loadTeam().then(draw).catch(e => { host.textContent = e.message; });
    draw();
    return host;
  }

  /* =================== jamcards: донор и легенда на кубике =================== */
  function stepJamcards(ctx) {
    const st = ctx.step, host = el('div', { class: 'stack' });
    let rolling = null;
    async function roll(what, action) {
      rolling = what || 'lock'; draw();
      await new Promise(r => setTimeout(r, fast() ? 150 : 700));
      try { T.data = Object.assign({}, T.data, await api('/api/team/cards', { what, action })); beep(action === 'lock' ? 'done' : 'good'); } catch (e) { toast(e.message, 'err'); }
      rolling = null; draw();
    }
    function card(what, label, c, cards) {
      const spin = rolling === what;
      const face = c ? el('div', { class: 'm7-face back' }, el('span', { class: 'm7-ic' }, c.icon || (what === 'donor' ? '🕹️' : '📜')), el('b', {}, c.title), el('p', { class: 'small' }, c.text), c.hint ? el('p', { class: 'small muted' }, c.hint) : null)
        : el('div', { class: 'm7-face' }, el('span', { class: 'm7-ic' }, '🎲'), el('b', {}, label));
      const full = c && (what === 'donor' ? st.donors : st.legends).find(x => x.id === c.id);
      if (full && full.icon) face.querySelector('.m7-ic').textContent = full.icon;
      return el('div', { class: 'm7-jamcard' + (spin ? ' spin' : '') + (c ? ' open' : '') },
        el('div', { class: 'eyebrow' }, label), face,
        cards && !cards.locked ? el('div', { class: 'row' },
          !c ? el('button', { type: 'button', class: 'btn small', disabled: !!rolling, onclick: () => roll(what) }, '🎲 Бросить')
            : el('button', { type: 'button', class: 'btn ghost small', disabled: !!rolling || !cards.rerolls[what], onclick: () => roll(what) }, `↻ Переброс (${cards.rerolls[what]})`)) : null);
    }
    function draw() {
      host.innerHTML = '';
      const t = T.data && T.data.team;
      if (!t) { host.append(el('div', { class: 'card muted' }, 'Сначала вступи в команду в шаге выше.')); return; }
      const c = t.cards || { rerolls: { donor: 1, legend: 1 } };
      if (c.locked && !ctx.done) ctx.save({ donor: c.donor.title, legend: c.legend.title }, true);
      host.append(el('div', { class: 'm7-jam' }, card('donor', 'Жанр-основа', c.donor, c), el('div', { class: 'm7-plus' }, '+'), card('legend', 'Легенда Адыгеи', c.legend, c)));
      if (c.locked) host.append(el('div', { class: 'm7-locked' }, `✓ Берём: «${c.donor.title}» + «${c.legend.title}». Они уже в Фабрике каждого из команды.`));
      else host.append(el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn', disabled: !c.donor || !c.legend || !!rolling, onclick: () => roll(null, 'lock') }, '✓ Берём!'), el('span', { class: 'small muted' }, 'Кубик бросает любой из команды — карточки общие. По одному перебросу на каждую.')));
    }
    teamLive(host, draw);
    loadTeam().then(draw).catch(() => {});
    draw();
    return host;
  }

  /* =================== brainstorm: 10 идей за 10 минут =================== */
  function stepBrainstorm(ctx) {
    const st = ctx.step, host = el('div', { class: 'stack' }), goal = st.goal || 10, mins = st.minutes || 10;
    const input = el('input', { type: 'text', maxlength: '140', placeholder: 'Идея одной строкой: «А что если…»' });
    const ring = el('canvas', { width: 120, height: 120, class: 'm7-ring', 'aria-hidden': 'true' });
    let seen = new Set(), raf = 0, drawn = 0;
    const send = async () => {
      const text = input.value.trim(); if (!text) return;
      input.value = ''; // чистим сразу: пока идёт ответ, ученик уже пишет следующую идею
      try { T.data = Object.assign({}, T.data, await api('/api/team/idea', { text })); beep('good'); draw(); input.focus(); } catch (e) { if (!input.value) input.value = text; toast(e.message, 'err'); }
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
    const act = async (path, body) => { try { T.data = Object.assign({}, T.data, await api(path, body)); beep('tick'); draw(); } catch (e) { toast(e.message, 'err'); } };
    // кольцо-таймер: 10 минут с первой идеи команды; идеи — точки по кругу, после 10-й кольцо светится
    function ringLoop(now) {
      if (!ring.isConnected) { cancelAnimationFrame(raf); raf = 0; return; }
      raf = requestAnimationFrame(ringLoop);
      if (window.LAB_LOWRES && now - drawn < 200) return; drawn = now;
      const t = T.data && T.data.team, g = ring.getContext('2d'); g.clearRect(0, 0, 120, 120);
      const total = mins * 60, left = t && t.brainAt ? Math.max(0, total - (Date.now() - t.brainAt) / 1000) : total, n = t ? t.ideas.length : 0;
      g.lineWidth = 10; g.strokeStyle = '#2a3560'; g.beginPath(); g.arc(60, 60, 48, 0, TAU); g.stroke();
      g.strokeStyle = left < 60 ? '#ff5d6e' : '#ffe08a'; g.beginPath(); g.arc(60, 60, 48, -Math.PI / 2, -Math.PI / 2 + TAU * (left / total)); g.stroke();
      for (let i = 0; i < goal; i++) { const a = -Math.PI / 2 + i / goal * TAU; disc(g, 60 + Math.cos(a) * 48, 60 + Math.sin(a) * 48, i < n ? 6 : 3, i < n ? '#7cf5a8' : '#3a4880'); }
      if (n >= goal) glow(g, 60, 60, 50, 'rgba(124,245,168,.25)');
      text(g, t && t.brainAt ? mmss(left) : mmss(total), 60, 54, '#f2efe6', 18); text(g, `${n} из ${goal}`, 60, 76, '#9aa3c7', 11, 'center', 600);
    }
    function draw() {
      host.innerHTML = '';
      const t = T.data && T.data.team;
      if (!t) { host.append(el('div', { class: 'card muted' }, 'Сначала вступи в команду.')); return; }
      const mineN = t.ideas.filter(i => i.by === S.me.nick).length;
      const val = t.pick ? { pick: t.pick.text, ideas: t.ideas.length, mine: mineN } : { ideas: t.ideas.length, mine: mineN };
      if (!ctx.done && JSON.stringify(val) !== JSON.stringify(ctx.value || {})) ctx.save(val, t.pick ? true : null); // сохраняем, только когда счёт изменился
      const list = el('div', { class: 'm7-ideas' });
      t.ideas.forEach((i, k) => {
        const fresh = !seen.has(i.id); seen.add(i.id);
        const voted = (i.voters || []).includes(S.me.nick), picked = t.pick && t.pick.id === i.id;
        list.append(el('div', { class: 'm7-idea' + (fresh ? ' pop' : '') + (k >= 6 ? ' late' : '') + (picked ? ' picked' : ''), style: `--c:${colorOf(i.by)}` },
          el('span', { class: 'm7-n' }, String(k + 1)), el('span', { class: 'grow' }, i.text, el('span', { class: 'small muted' }, ' · ' + i.by)),
          i.by !== S.me.nick ? el('button', { type: 'button', class: 'btn ghost small' + (voted ? ' on' : ''), 'aria-pressed': String(voted), onclick: () => act('/api/team/idea/vote', { id: i.id }) }, `👍 ${i.votes || ''}`) : el('span', { class: 'small muted' }, `👍 ${i.votes || 0}`),
          t.ideas.length >= goal || (t.brainAt && Date.now() - t.brainAt > mins * 60e3) ? el('button', { type: 'button', class: 'btn small' + (picked ? '' : ' ghost'), onclick: () => act('/api/team/pick', { id: i.id }) }, picked ? '★ Наша' : 'Берём') : null));
      });
      host.append(el('div', { class: 'm7-brain' }, ring, el('div', { class: 'stack grow' },
        el('div', { class: 'small muted' }, st.rule || 'Правило штурма: не спорим и не критикуем, пока не набрали десять. Странные идеи — самые ценные.'),
        el('div', { class: 'row' }, input, el('button', { type: 'button', class: 'btn', onclick: send }, 'Добавить')),
        t.pick ? el('div', { class: 'm7-locked' }, `★ Команда выбрала: ${t.pick.text}`) : el('div', { class: 'small muted' }, t.ideas.length >= goal ? 'Десять есть! Теперь голосуйте 👍 и нажмите «Берём» у одной идеи.' : `Ещё ${goal - t.ideas.length} — и можно выбирать.`))), list);
      if (!raf) raf = requestAnimationFrame(ringLoop);
    }
    teamLive(host, draw);
    loadTeam().then(t => { (t.team ? t.team.ideas : []).forEach(i => seen.add(i.id)); draw(); }).catch(() => {});
    draw();
    return host;
  }

  window.LabStepsM7 = { arena: stepArena, bracket: stepBracket, team: stepTeam, jamcards: stepJamcards, brainstorm: stepBrainstorm };
  // строка шага для «Мои ответы» и выгрузки учителя
  window.LabStepsM7Summary = (step, v) => {
    switch (step.type) {
      case 'arena': return (v.rounds || []).length ? `забегов: ${v.rounds.length}, лучшее место: ${v.best}` + (v.vote ? `; голос за правило: ${v.vote}` : '') : `забегов с ботами: ${v.offline || 0}`;
      case 'bracket': return `партий: ${v.played || 0}` + ((v.reported || []).length ? '; ' + v.reported.join('; ') : '') + (v.out ? '; выбыл' : '');
      case 'team': return v.team ? `команда «${v.team}», роль: ${v.role}` : 'без команды';
      case 'jamcards': return v.donor ? `${v.donor} + ${v.legend}` : 'карточки не взяты';
      case 'brainstorm': return `идей команды: ${v.ideas || 0}, моих: ${v.mine || 0}` + (v.pick ? `; выбрали: ${v.pick}` : '');
      default: return null;
    }
  };
})();
