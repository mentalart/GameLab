// Объяснялки модуля 5 «Истории, миры, смыслы» (уроки 19–22). Загружается после steps-m4.js и steps-m7.js и до student.js.
// Новых типов шагов нет: файл только добавляет сцены в общую библиотеку шага motion (window.LabMotion из steps-m4.js).
//   урок 19 «Ветвящаяся история» (Reigns): reigns-swipe, reigns-echo, branch-tree, branch-beads, branch-hub;
//   урок 20 «История, рассказанная пространством» (Unpacking, Gone Home, Edith Finch): unpack-box, room-reads, three-frames, item-with-story;
//   урок 21 «Мир и визуальный стиль» (Alto's Adventure, Journey): palette-five, mood-shift, silhouette, hero-colour;
//   урок 22 «Игра о чувстве» (Florence, Passage, Тамагочи): florence-puzzle, passage-life, one-mechanic-many-feelings, quiet-end, feel-loop.
// Каждая сцена — функция (g, t, W, H) для холста 640 × 300, крутится сама по кругу.
// Без эмодзи (в проверке без окна нет шрифта эмодзи — значки рисуются фигурами) и без Math.random (случайность — от номера).
'use strict';
(function () {
  const M = window.LabMotion;
  if (!M) return;
  const { MOTION, rr, text, disc, glow, sky, arrow, confetti, seg, io, lerp, clamp, TAU } = M;
  // отскок: до начала — ровно 0 (у ob(0) бывает крошечный хвост, и свечение проступало раньше времени)
  const ob = k => (k <= 1e-6 ? 0 : M.ob(k));

  /* =================== помощники сцен =================== */
  const FONT = "system-ui,-apple-system,'Segoe UI',sans-serif";
  // псевдослучайное число 0..1 от номера: одинаковое при каждом кадре
  const pr = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const oc = k => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
  const bell = k => Math.sin(clamp(k, 0, 1) * Math.PI);
  // «шатёр»: 0 до a, растёт к b, держится до c, гаснет к d
  const tent = (v, a, b, c, d) => (v < b ? seg(v, a, b) : 1 - seg(v, c, d));
  const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  // смесь двух цветов #rrggbb, ответ — тоже #rrggbb
  const mix = (a, b, k) => { const A = hexRgb(a), B = hexRgb(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], clamp(k, 0, 1))).toString(16).padStart(2, '0')).join(''); };
  function tw(g, s, px, weight = 800) { g.font = `${weight} ${px}px ${FONT}`; return g.measureText(s).width; }
  // текст, ужатый под ширину: не вылезает за плашку
  function fit(g, s, x, y, col, px, maxW, align = 'center', weight = 800) {
    let p = px; while (p > 9 && tw(g, s, p, weight) > maxW) p--;
    text(g, s, x, y, col, p, align, weight); return p;
  }
  function poly(g, pts, col) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fillStyle = col; g.fill(); }
  function line(g, x1, y1, x2, y2, col, w = 2) { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
  function alpha(g, a, fn) { const A = g.globalAlpha; g.globalAlpha = A * clamp(a, 0, 1); fn(); g.globalAlpha = A; }
  // подпись сцены: плашка по ширине текста, появляется с отскоком
  function cap(g, s, t, at = 0, o = {}) {
    const k = ob(seg(t, at, at + 0.45)); if (k <= 0) return;
    const px = o.px || 15, w = Math.min(o.maxW || 612, tw(g, s, px) + 40), x = o.x != null ? o.x : 320, y = o.y != null ? o.y : 274;
    g.save(); g.globalAlpha = Math.min(1, k); g.translate(x, y); g.scale(0.9 + 0.1 * k, 0.9 + 0.1 * k);
    rr(g, -w / 2, -17, w, 34, 12, o.bg || 'rgba(26,15,38,.86)', o.edge); fit(g, s, 0, 1, o.col || '#f3e2c0', px, w - 26); g.restore();
  }
  // подписи по фазам: [[с какой секунды, текст], …]
  function caps(g, t, list, o) {
    if (t < list[0][0]) return; let i = 0;
    list.forEach((p, j) => { if (t >= p[0]) i = j; });
    cap(g, list[i][1], t, list[i][0], o);
  }
  function cross(g, x, y, s, k, col = '#ff4d5e', halo) {
    if (k <= 0) return; const a = clamp(k * 2, 0, 1), b = clamp(k * 2 - 1, 0, 1);
    const draw = (c, w) => { g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - s, y - s); g.lineTo(x - s + 2 * s * a, y - s + 2 * s * a); if (b > 0) { g.moveTo(x + s, y - s); g.lineTo(x + s - 2 * s * b, y - s + 2 * s * b); } g.stroke(); };
    if (halo) draw(halo, Math.max(4, s * 0.3) + 5); draw(col, Math.max(4, s * 0.3));
  }
  function tick(g, x, y, s, k, col = '#3aa66a') {
    if (k <= 0) return; const p = clamp(k, 0, 1), A = [x - s, y], B = [x - s * 0.3, y + s * 0.7], C = [x + s, y - s * 0.8];
    g.strokeStyle = col; g.lineWidth = Math.max(3, s * 0.32); g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(...A);
    if (p < 0.4) g.lineTo(lerp(A[0], B[0], p / 0.4), lerp(A[1], B[1], p / 0.4)); else { g.lineTo(...B); g.lineTo(lerp(B[0], C[0], (p - 0.4) / 0.6), lerp(B[1], C[1], (p - 0.4) / 0.6)); }
    g.stroke();
  }
  function heart(g, x, y, s, col) {
    g.save(); g.translate(x, y); g.scale(s / 10, s / 10); g.beginPath(); g.moveTo(0, 8); g.bezierCurveTo(-13, -1, -7, -12, 0, -4); g.bezierCurveTo(7, -12, 13, -1, 0, 8); g.fillStyle = col; g.fill(); g.restore();
  }
  // мягкое свечение одного цвета: на светлом фоне без серой каймы (glow гаснет в чёрный)
  function soft(g, x, y, r, rgb, a = 1) {
    const gr = g.createRadialGradient(x, y, 0, x, y, Math.max(1, r)); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  // мягкое затемнение на стыке круга: сцена не «прыгает» в начало
  function fade(g, W, H, t, P, col, d = 0.35) { const a = Math.max(1 - t / d, (t - P + d) / d); if (a > 0) alpha(g, a, () => { g.fillStyle = col; g.fillRect(0, 0, W, H); }); }
  // точки кривой Безье: частичная линия по прогрессу k
  function qcurve(g, x0, y0, cx, cy, x1, y1, k, n = 24) {
    g.beginPath(); g.moveTo(x0, y0);
    for (let i = 1; i <= n; i++) { const u = (i / n) * k, v = 1 - u; g.lineTo(v * v * x0 + 2 * v * u * cx + u * u * x1, v * v * y0 + 2 * v * u * cy + u * u * y1); }
  }
  // второй холст для плавной смены настроений (glow сбрасывает прозрачность — поэтому рисуем отдельно и накладываем)
  let OFF = null;
  function offCtx(W, H) {
    if (!OFF) OFF = document.createElement('canvas');
    if (OFF.width !== W || OFF.height !== H) { OFF.width = W; OFF.height = H; }
    const c = OFF.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.clearRect(0, 0, W, H); return c;
  }

  /* =================== урок 19: ветвящаяся история (Reigns) =================== */
  // палитра: тёплый вечер у очага — янтарь, слива, пергамент
  const C19 = { amber: '#ffb547', plum: '#2a1a3a', deep: '#1a0f26', parch: '#f3e2c0', ink: '#3a2414', red: '#ff5d5d', green: '#9be37a' };
  function hearth(g, W, H, t) {
    sky(g, W, H, '#1a0f26', '#3a2148');
    glow(g, 320, H + 60, 330, 'rgba(255,150,60,.38)');
    // искры очага поднимаются вверх
    for (let i = 0; i < 22; i++) {
      const sp = 14 + pr(i) * 26, y = H - ((t * sp + pr(i + 50) * H) % (H + 20)), x = pr(i + 9) * W + Math.sin(t * 1.3 + i) * 8;
      alpha(g, (0.2 + 0.6 * pr(i + 3)) * clamp(y / H, 0, 1), () => disc(g, x, y, 1.2 + pr(i + 7) * 1.8, i % 3 ? C19.amber : '#ffd98a'));
    }
  }
  // значки весов: 0 урожай (колос), 1 люди, 2 стада (овца), 3 гости (кувшин-кумган). Одним цветом — для заливки «снизу вверх»
  function icon19(g, kind, x, y, s, col) {
    g.fillStyle = col; g.strokeStyle = col; g.lineCap = 'round';
    if (kind === 0) {
      g.lineWidth = s * 0.13; g.beginPath(); g.moveTo(x, y + s); g.lineTo(x, y - s * 0.7); g.stroke();
      for (let j = 0; j < 4; j++) for (const d of [-1, 1]) { g.save(); g.translate(x + d * s * 0.22, y + s * 0.38 - j * s * 0.38); g.rotate(d * 0.5); g.beginPath(); g.ellipse(0, 0, s * 0.17, s * 0.3, 0, 0, TAU); g.fill(); g.restore(); }
      g.beginPath(); g.ellipse(x, y - s * 0.92, s * 0.15, s * 0.26, 0, 0, TAU); g.fill();
    } else if (kind === 1) {
      disc(g, x - s * 0.4, y - s * 0.42, s * 0.32, col); disc(g, x + s * 0.42, y - s * 0.3, s * 0.27, col);
      g.beginPath(); g.arc(x - s * 0.4, y + s * 0.95, s * 0.62, Math.PI, 0); g.fill(); g.beginPath(); g.arc(x + s * 0.44, y + s * 0.95, s * 0.52, Math.PI, 0); g.fill();
    } else if (kind === 2) {
      [[-0.42, 0.05], [0, -0.15], [0.38, 0.05], [-0.22, 0.3], [0.2, 0.3]].forEach(([a, b]) => disc(g, x + a * s, y + b * s, s * 0.36, col));
      g.beginPath(); g.ellipse(x + s * 0.8, y - s * 0.2, s * 0.22, s * 0.32, 0.5, 0, TAU); g.fill();
      g.fillRect(x - s * 0.5, y + s * 0.5, s * 0.16, s * 0.48); g.fillRect(x + s * 0.28, y + s * 0.5, s * 0.16, s * 0.48);
    } else {
      g.beginPath(); g.ellipse(x, y + s * 0.35, s * 0.52, s * 0.6, 0, 0, TAU); g.fill();
      g.fillRect(x - s * 0.17, y - s * 0.62, s * 0.34, s * 0.55); g.fillRect(x - s * 0.32, y - s * 0.76, s * 0.64, s * 0.16);
      g.lineWidth = s * 0.14; g.beginPath(); g.moveTo(x + s * 0.4, y + s * 0.25); g.quadraticCurveTo(x + s * 0.85, y - s * 0.05, x + s * 0.98, y - s * 0.6); g.stroke();
      g.beginPath(); g.arc(x - s * 0.55, y + s * 0.15, s * 0.32, Math.PI * 0.5, Math.PI * 1.5); g.stroke();
    }
  }
  const SC_X = [230, 290, 350, 410], SC_NAMES = ['урожай', 'люди', 'стада', 'гости'];
  // весы сверху: значок заливается снизу на долю vals[i]; dots — подсказки (2 — сильно, 1 — чуть-чуть); flash[i] = [цвет, 0..1]; shake[i] = 0..1
  function scales19(g, vals, dots, dk, flash = {}, shake = {}) {
    rr(g, 186, 6, 268, 70, 14, 'rgba(26,15,38,.78)', 'rgba(255,181,71,.3)');
    SC_X.forEach((x0, i) => {
      const s = 15, y = 28, top = y - s * 1.1, bot = y + s * 1.0, hg = bot - top, v = clamp(vals[i], 0, 1);
      const x = x0 + (shake[i] ? Math.sin(shake[i] * 60) * 4 * (1 - shake[i]) : 0);
      const fl = flash[i];
      if (fl) glow(g, x, y, 36, fl[0], bell(fl[1]));
      icon19(g, i, x, y, s, '#4c3664');
      g.save(); g.beginPath(); g.rect(x - 30, bot - hg * v, 60, hg * v + 2); g.clip();
      icon19(g, i, x, y, s, fl ? mix(C19.amber, fl[0], bell(fl[1])) : C19.amber); g.restore();
      text(g, SC_NAMES[i], x0, 54, '#d9c49c', 11, 'center', 700);
      if (dots && dots[i] && dk > 0) alpha(g, dk, () => { glow(g, x0, 67, 12, 'rgba(255,240,200,.7)', dk); disc(g, x0, 67, (dots[i] === 2 ? 5.5 : 2.8) * (0.6 + 0.4 * ob(dk)), '#fff3d6'); });
    });
  }
  // герои карт Reigns — жители аула
  const WHO = {
    elder: { bg: '#6b3d7a', coat: '#3b2a5a', hat: 'papakha', beard: '#ece4d4', name: 'Старейшина', gaz: true },
    smith: { bg: '#8a3b22', coat: '#4a3a32', apron: '#7a4a2a', mous: '#2b1d16', item: 'hammer', name: 'Кузнец' },
    shepherd: { bg: '#3f6b4a', coat: '#2b2b33', burka: true, hat: 'felt', item: 'staff', name: 'Пастух' },
    guest: { bg: '#2f5a7a', coat: '#6a4c3a', hat: 'felt', item: 'bag', name: 'Гость' },
    gone: { bg: '#3a2a40', coat: '#4a3a32', item: 'bundle', name: 'Кузнец', back: true },
  };
  // житель: (0, 0) — низ фигуры, рост ≈ 2.4 s
  function folk(g, s, o) {
    if (o.burka) poly(g, [[-s * 1.15, 0], [-s * 0.45, -s * 1.45], [s * 0.45, -s * 1.45], [s * 1.15, 0]], o.coat);
    else poly(g, [[-s * 0.85, 0], [-s * 0.5, -s * 1.35], [s * 0.5, -s * 1.35], [s * 0.85, 0]], o.coat);
    if (o.apron) rr(g, -s * 0.42, -s * 1.05, s * 0.84, s * 1.05, s * 0.12, o.apron);
    if (o.gaz) for (let j = 0; j < 3; j++) { rr(g, -s * 0.42, -s * 1.05 + j * s * 0.2, s * 0.2, s * 0.12, 1, '#c9b48f'); rr(g, s * 0.22, -s * 1.05 + j * s * 0.2, s * 0.2, s * 0.12, 1, '#c9b48f'); }
    disc(g, 0, -s * 1.72, s * 0.48, '#e2a77c');
    if (o.back) { g.beginPath(); g.arc(0, -s * 1.72, s * 0.49, Math.PI * 0.9, Math.PI * 2.1); g.fillStyle = '#2b1d16'; g.fill(); }
    if (o.beard) { g.beginPath(); g.arc(0, -s * 1.62, s * 0.46, 0.15, Math.PI - 0.15); g.fillStyle = o.beard; g.fill(); }
    if (o.mous) rr(g, -s * 0.26, -s * 1.58, s * 0.52, s * 0.11, s * 0.05, o.mous);
    if (!o.back) { disc(g, -s * 0.17, -s * 1.8, s * 0.075, '#2b1d16'); disc(g, s * 0.17, -s * 1.8, s * 0.075, '#2b1d16'); }
    if (o.hat === 'papakha') rr(g, -s * 0.52, -s * 2.42, s * 1.04, s * 0.58, s * 0.16, '#2b1d16');
    if (o.hat === 'felt') { g.fillStyle = '#5a4030'; g.beginPath(); g.ellipse(0, -s * 2.08, s * 0.78, s * 0.15, 0, 0, TAU); g.fill(); rr(g, -s * 0.4, -s * 2.52, s * 0.8, s * 0.46, s * 0.2, '#5a4030'); }
    if (o.item === 'hammer') { line(g, s * 0.75, -s * 0.3, s * 1.05, -s * 1.45, '#9a7a5a', s * 0.15); rr(g, s * 0.72, -s * 1.72, s * 0.66, s * 0.32, 2, '#aab3c0'); }
    if (o.item === 'staff') { line(g, -s * 1.0, 0, -s * 1.12, -s * 2.3, '#c9a06a', s * 0.12); g.strokeStyle = '#c9a06a'; g.beginPath(); g.arc(-s * 0.92, -s * 2.3, s * 0.2, Math.PI, TAU); g.stroke(); }
    if (o.item === 'bag') disc(g, s * 0.85, -s * 0.55, s * 0.36, '#a87a4a');
    if (o.item === 'bundle') { line(g, -s * 0.3, -s * 1.25, s * 0.95, -s * 2.15, '#9a7a5a', s * 0.11); disc(g, s * 1.0, -s * 2.15, s * 0.34, '#c9a06a'); }
  }
  // карта: (x, y) — центр; label — ответ на ленте сверху (видна, когда карта наклонена)
  function card19(g, x, y, rot, sc, who, label, lean) {
    const o = WHO[who], w = 128, h = 150;
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(sc, sc);
    rr(g, -w / 2 + 5, -h / 2 + 7, w, h, 12, 'rgba(0,0,0,.35)');
    rr(g, -w / 2, -h / 2, w, h, 12, C19.parch, '#8a5a2b');
    g.save(); rr(g, -w / 2 + 8, -h / 2 + 8, w - 16, h - 44, 8); g.clip();
    g.fillStyle = o.bg; g.fillRect(-w / 2, -h / 2, w, h); glow(g, 0, -20, 70, 'rgba(255,210,140,.28)');
    g.translate(0, h / 2 - 38); folk(g, 30, o); g.restore();
    fit(g, o.name, 0, h / 2 - 18, C19.ink, 15, w - 16);
    if (label) {
      const a = clamp(Math.abs(lean) * 1.8 - 0.35, 0, 1);
      if (a > 0) alpha(g, a, () => { rr(g, -w / 2 + 6, -h / 2 + 6, w - 12, 30, 8, 'rgba(26,15,38,.88)'); text(g, label, lean < 0 ? -w / 2 + 16 : w / 2 - 16, -h / 2 + 22, C19.amber, 17, lean < 0 ? 'left' : 'right'); });
    }
    g.restore();
  }
  // колода: рубашки карт под верхней
  function deck19(g, x, y, n) {
    for (let i = n; i > 0; i--) {
      rr(g, x - 64 + i * 2, y - 75 + i * 3, 128, 150, 12, '#3a2148', 'rgba(255,181,71,.55)');
      poly(g, [[x + i * 2, y - 30 + i * 3], [x + 22 + i * 2, y + i * 3], [x + i * 2, y + 30 + i * 3], [x - 22 + i * 2, y + i * 3]], 'rgba(255,181,71,.35)');
    }
  }
  // просьба героя — пергаментная плашка над картой
  function ask19(g, s, kin, a = 1) {
    if (kin <= 0 || a <= 0) return; const w = tw(g, s, 15) + 34, k = ob(clamp(kin, 0, 1));
    g.save(); g.globalAlpha = clamp(Math.min(kin * 2, a), 0, 1); g.translate(320, 92); g.scale(0.9 + 0.1 * k, 0.9 + 0.1 * k);
    rr(g, -w / 2, -14, w, 28, 10, C19.parch); text(g, s, 0, 1, C19.ink, 15); g.restore();
  }
  // свайп одной карты: появилась в a, наклонилась к dir в b, улетела в c (перед броском — замах назад)
  function swipe(t, a, b, c, dir) {
    const kin = ob(seg(t, a, a + 0.45)), kl = io(seg(t, b, b + 0.35)), kf = seg(t, c, c + 0.45), f2 = kf * kf;
    const lean = dir * kl * (1 - 0.35 * bell(seg(t, c - 0.3, c + 0.05)));
    return { x: 320 + lean * 34 + dir * f2 * 440, y: 182 + (1 - kin) * 34 - bell(kf) * 16, rot: lean * 0.2 + dir * f2 * 0.8, s: 0.86 + 0.14 * kin, lean, on: t >= a && kf < 1 };
  }

  MOTION['reigns-swipe'] = (g, t, W, H) => {
    t %= 9; hearth(g, W, H, t);
    const before = [0.55, 0.5, 0.6, 0.45], after = [0.28, 0.6, 0.6, 0.78];
    const kv = io(seg(t, 5.6, 6.4)), vals = before.map((v, i) => lerp(v, after[i], kv));
    // наклон: влево («нет») → вправо («да») → замах → бросок вправо
    let lean = -io(seg(t, 0.9, 1.4)) + 2 * io(seg(t, 2.4, 3.1)) - 0.35 * bell(seg(t, 4.2, 4.85));
    if (t > 1.4 && t < 4.2) lean += Math.sin(t * 5) * 0.04;
    const fly = seg(t, 4.8, 5.4), f2 = fly * fly;
    const dk = clamp(Math.abs(lean) * 1.5 - 0.25, 0, 1) * (1 - seg(t, 5.3, 5.7));
    const fk = seg(t, 5.6, 6.8), flash = t > 5.6 && t < 6.8 ? { 0: [C19.red, fk], 1: [C19.green, fk], 3: [C19.green, fk] } : {};
    deck19(g, 320, 182, 2);
    if (t > 5.3) { const nk = ob(seg(t, 5.4, 5.9)); card19(g, 320, 182 + (1 - nk) * 8, 0, 0.95 + 0.05 * nk, 'shepherd', null, 0); }
    if (fly < 1) { const k0 = ob(seg(t, 0.1, 0.6)); card19(g, 320 + lean * 34 + f2 * 440, 182 + (1 - k0) * 34 - bell(fly) * 16, lean * 0.2 + f2 * 0.8, 0.86 + 0.14 * k0, 'elder', lean < 0 ? 'Нет' : 'Да', lean); }
    // стрелки-подсказки по бокам
    if (t < 4.8) {
      alpha(g, 0.5 + 0.5 * clamp(-lean, 0, 1), () => text(g, '‹ нет', 196, 182, lean < -0.3 ? C19.amber : '#8a7398', 15));
      alpha(g, 0.5 + 0.5 * clamp(lean, 0, 1), () => text(g, 'да ›', 444, 182, lean > 0.3 ? C19.amber : '#8a7398', 15));
    }
    scales19(g, vals, lean < 0 ? [0, 2, 0, 1] : [2, 1, 0, 2], dk, flash);
    if (t < 5.3) ask19(g, 'Старейшина: устроим праздник урожая?', seg(t, 0.2, 0.6), 1 - seg(t, 4.8, 5.1));
    else ask19(g, 'Пастух: пустишь стадо на луг?', seg(t, 5.9, 6.3));
    // итог: что изменилось
    if (t > 5.7 && t < 8.7) alpha(g, seg(t, 5.7, 6.0) * (1 - seg(t, 8.3, 8.7)), () => { text(g, '−', SC_X[0] - 22, 18, C19.red, 20); text(g, '+', SC_X[1] + 22, 18, C19.green, 16); text(g, '+', SC_X[3] + 22, 18, C19.green, 20); });
    caps(g, t, [[0.2, 'Влево — «нет», вправо — «да»: решает игрок'], [2.4, 'Точки над весами: большая — сильно, маленькая — чуть-чуть'], [4.8, 'Свайп — и весы сдвинулись: праздник съел запасы'], [6.8, 'Каждый ответ что-то стоит']]);
    fade(g, W, H, t, 9, C19.deep);
  };

  MOTION['reigns-echo'] = (g, t, W, H) => {
    t %= 10; hearth(g, W, H, t);
    // весы: «нет» кузнецу — люди чуть вверх; пастуху «да» — стада; гостю «да» — гости; кузнец ушёл — урожай рушится
    const v = [0.66, 0.5, 0.48, 0.5];
    v[1] += 0.07 * io(seg(t, 2.1, 2.5)); v[2] += 0.12 * io(seg(t, 3.4, 3.8)); v[3] += 0.12 * io(seg(t, 4.6, 5.0)); v[0] -= 0.5 * io(seg(t, 6.4, 7.0));
    const flash = {}, shake = {};
    if (t > 2.1 && t < 2.9) flash[1] = [C19.green, seg(t, 2.1, 2.9)];
    if (t > 3.4 && t < 4.2) flash[2] = [C19.green, seg(t, 3.4, 4.2)];
    if (t > 4.6 && t < 5.4) flash[3] = [C19.green, seg(t, 4.6, 5.4)];
    if (t > 6.4 && t < 8.2) { flash[0] = [C19.red, (seg(t, 6.4, 8.2) * 3) % 1]; shake[0] = seg(t, 6.4, 7.1); }
    deck19(g, 320, 182, 2);
    const CARDS = [['smith', 0.1, 0.8, 1.7, -1, 'Нет', 'Кузнец: дай угля для кузни'], ['shepherd', 2.3, 2.7, 3.0, 1, 'Да', 'Пастух: пустишь стадо на луг?'], ['guest', 3.5, 3.9, 4.2, 1, 'Да', 'Гость: можно переночевать?']];
    let ask = null;
    CARDS.forEach(([who, a, b, c, dir, lab, s]) => {
      const p = swipe(t, a, b, c, dir); if (!p.on) return;
      card19(g, p.x, p.y, p.rot, p.s, who, lab, p.lean); if (t < c) ask = [s, seg(t, a + 0.1, a + 0.4)];
    });
    if (t > 4.8) {
      const k = ob(seg(t, 4.8, 5.3)), sh = t > 5.6 && t < 6.2 ? Math.sin(t * 40) * 3 * (1 - seg(t, 5.6, 6.2)) : 0;
      card19(g, 320 + sh, 182 + (1 - k) * 34, 0, 0.86 + 0.14 * k, 'gone', null, 0); ask = ['Кузнец: я ушёл в соседний аул', seg(t, 5.0, 5.4)];
    }
    if (ask) ask19(g, ask[0], ask[1]);
    scales19(g, v, null, 0, flash, shake);
    // счётчик сезонов
    const season = 1 + (t > 3.2 ? 1 : 0) + (t > 4.4 ? 1 : 0), sk = Math.max(bell(seg(t, 3.2, 3.5)), bell(seg(t, 4.4, 4.7)));
    g.save(); g.translate(548, 40); g.scale(1 + 0.18 * sk, 1 + 0.18 * sk);
    rr(g, -66, -22, 132, 44, 12, 'rgba(26,15,38,.8)', 'rgba(255,181,71,.4)');
    disc(g, -40, 0, 9, C19.amber); for (let j = 0; j < 8; j++) { const a = j * TAU / 8 + t * 0.5; line(g, -40 + Math.cos(a) * 12, Math.sin(a) * 12, -40 + Math.cos(a) * 16, Math.sin(a) * 16, C19.amber, 2); }
    text(g, 'сезон ' + season, 14, 1, C19.parch, 16); g.restore();
    // память: сыгранные карты слева
    const CH = [['Кузнец — нет', 1.95], ['Пастух — да', 3.2], ['Гость — да', 4.4]];
    CH.forEach(([s, a], i) => {
      const k = ob(seg(t, a, a + 0.4)); if (k <= 0) return; const y = 130 + i * 36, hot = i === 0 && t > 6.0;
      g.save(); g.globalAlpha = clamp(k, 0, 1); g.translate((1 - k) * 60, 0);
      rr(g, 18, y - 14, 150, 28, 9, hot ? 'rgba(90,20,30,.9)' : 'rgba(26,15,38,.78)', hot ? C19.red : 'rgba(243,226,192,.25)');
      text(g, s, 93, y + 1, hot ? '#ffd0d0' : C19.parch, 13, 'center', 700); g.restore();
    });
    if (t > 6.0) {
      const k = io(seg(t, 6.0, 6.5)); g.setLineDash([6, 6]); g.strokeStyle = C19.red; g.lineWidth = 3;
      qcurve(g, 170, 130, 222, 128, 254, 168, k); g.stroke(); g.setLineDash([]);
      if (k >= 1) { const ag = Math.atan2(168 - 128, 254 - 222); poly(g, [[257, 171], [257 - Math.cos(ag - 0.5) * 13, 171 - Math.sin(ag - 0.5) * 13], [257 - Math.cos(ag + 0.5) * 13, 171 - Math.sin(ag + 0.5) * 13]], C19.red); }
    }
    if (t > 6.6) {
      const k = ob(seg(t, 6.6, 7.0)); g.save(); g.translate(520, 168); g.scale(k, k);
      rr(g, -96, -30, 192, 60, 12, 'rgba(90,20,30,.9)', C19.red); text(g, 'нет кузнеца —', 0, -10, '#ffd0d0', 14); text(g, 'нет серпов и урожая', 0, 11, '#ffd0d0', 13, 'center', 700); g.restore();
    }
    caps(g, t, [[0.3, 'Отказал кузнецу — весы почти не дрогнули'], [2.3, 'Прошли сезоны…'], [4.8, '…и кузнец вернулся с новостью'], [6.6, 'Видимое — сейчас, скрытое — потом']]);
    fade(g, W, H, t, 10, C19.deep);
  };

  MOTION['branch-tree'] = (g, t, W, H) => {
    const n = Math.floor(t / 9); t %= 9; hearth(g, W, H, t * 0.5);
    const LX = L => 46 + L * 112, gap = L => 23.5 * Math.pow(2, 4 - L);
    const Y = (L, i) => 150 + (i - (Math.pow(2, L) - 1) / 2) * gap(L);
    const T = L => 0.3 + L * 1.0; // когда появляется ярус L
    const grow = L => (L <= 4 ? io(seg(t, T(L) - 0.55, T(L))) : io(seg(t, 5.3 + (L - 5) * 0.35, 5.8 + (L - 5) * 0.35)));
    // путь, который увидит игрок (в каждом круге другой)
    const path = [0, 1, 2, 3].map(j => (pr(n * 5 + j) > 0.5 ? 1 : 0));
    const idx = L => path.slice(0, L).reduce((a, b) => a * 2 + b, 0);
    const walk = seg(t, 6.4, 8.4) * 4;
    for (let L = 1; L <= 6; L++) {
      const k = grow(L); if (k <= 0) continue;
      g.strokeStyle = L <= 4 ? 'rgba(243,226,192,.5)' : 'rgba(243,226,192,.22)'; g.lineWidth = Math.max(1, 3.4 - L * 0.5);
      for (let i = 0; i < 2 ** L; i++) {
        const x0 = LX(L - 1), y0 = Y(L - 1, i >> 1), x1 = LX(L), y1 = Y(L, i);
        g.beginPath(); g.moveTo(x0, y0); for (let u = 0.1; u < k + 0.05; u += 0.1) { const uu = Math.min(u, k); g.lineTo(lerp(x0, x1, uu), lerp(y0, y1, io(uu))); } g.stroke();
      }
    }
    // путь игрока подсвечен
    if (t > 6.4) for (let L = 1; L <= 4; L++) {
      const k = clamp(walk - (L - 1), 0, 1); if (k <= 0) continue;
      const x0 = LX(L - 1), y0 = Y(L - 1, idx(L - 1)), x1 = LX(L), y1 = Y(L, idx(L));
      g.strokeStyle = C19.amber; g.lineWidth = 5; g.beginPath(); g.moveTo(x0, y0); for (let u = 0.1; u < k + 0.05; u += 0.1) { const uu = Math.min(u, k); g.lineTo(lerp(x0, x1, uu), lerp(y0, y1, io(uu))); } g.stroke();
    }
    for (let L = 0; L <= 6; L++) {
      const k = L <= 4 ? ob(seg(t, T(L), T(L) + 0.35)) : grow(L); if (k <= 0) continue;
      for (let i = 0; i < 2 ** L; i++) {
        const x = LX(L), y = Y(L, i); if (y < -20 || y > H + 20) continue;
        if (L === 4) { glow(g, x, y, 16, 'rgba(255,181,71,.55)'); disc(g, x, y, 6 * k, C19.amber); disc(g, x, y, 2.4 * k, '#fff3d6'); }
        else if (L > 4) alpha(g, 0.7, () => disc(g, x, y, 2.6 * k, C19.amber));
        else { disc(g, x, y, (10 - L * 1.5) * k, C19.parch); disc(g, x, y, (5 - L * 0.7) * k, '#c99a5a'); }
      }
    }
    if (t > 6.4) {
      const L = Math.min(3, Math.floor(walk)), u = walk >= 4 ? 1 : walk - L;
      const x = lerp(LX(L), LX(L + 1), u), y = lerp(Y(L, idx(L)), Y(L + 1, idx(L + 1)), io(u));
      glow(g, x, y, 26, 'rgba(255,240,200,.8)'); disc(g, x, y, 7, '#fff3d6');
    }
    // счётчик концовок
    const lv = [0, 1, 2, 3, 4].filter(L => t >= T(L)).pop(), cnt = lv == null ? 1 : 2 ** lv, pk = bell(seg(t - T(lv || 0), 0, 0.3));
    const two = t > 5.3, kk = ob(seg(t, 5.3, 5.8));
    g.save(); g.translate(528, 40); rr(g, -96, -26, 192, two ? 74 : 44, 12, 'rgba(26,15,38,.9)', 'rgba(255,181,71,.5)');
    g.save(); g.translate(0, -4); g.scale(1 + 0.2 * pk, 1 + 0.2 * pk); text(g, 'концовок: ' + cnt, 0, 0, C19.parch, 19); g.restore();
    if (two) { g.save(); g.translate(0, 30); g.scale(kk, kk); fit(g, 'после 10 развилок — 1024', 0, 0, C19.amber, 15, 176); g.restore(); }
    g.restore();
    caps(g, t, [[0.3, 'Каждая развилка удваивает концовки'], [6.4, 'Игрок пройдёт одну ветку — а написать нужно все']]);
    fade(g, W, H, t, 9, C19.deep);
  };

  MOTION['branch-beads'] = (g, t, W, H) => {
    const n = Math.floor(t / 8); t %= 8; hearth(g, W, H, t);
    const S = [34, 150], B = [[170, 150], [350, 150], [550, 150]], NAMES = ['Встреча', 'Ссора', 'Финал'];
    const SECS = [{ a: S, b: B[0], ys: [80, 220] }, { a: B[0], b: B[1], ys: [58, 150, 242] }, { a: B[1], b: B[2], ys: [84, 216] }];
    // в каждом прохождении — другой путь; пунктиром — путь прошлого раза
    const pickOf = m => { m = ((m % 6) + 6) % 6; return [m % 2, (m * 2 + 1) % 3, (m + 1) % 2]; };
    const pick = pickOf(n), prev = pickOf(n - 1);
    const ctl = (s, j) => { const [x0, y0] = s.a, [x1, y1] = s.b, mx = (x0 + x1) / 2; return [2 * mx - (x0 + x1) / 2, 2 * s.ys[j] - (y0 + y1) / 2]; };
    const at = (s, j, u) => { const [x0, y0] = s.a, [x1, y1] = s.b, [cx, cy] = ctl(s, j), v = 1 - u; return [v * v * x0 + 2 * v * u * cx + u * u * x1, v * v * y0 + 2 * v * u * cy + u * u * y1]; };
    const draw = (s, j, k, col, w, dash) => { const [cx, cy] = ctl(s, j); g.strokeStyle = col; g.lineWidth = w; g.setLineDash(dash || []); qcurve(g, s.a[0], s.a[1], cx, cy, s.b[0], s.b[1], k); g.stroke(); g.setLineDash([]); };
    SECS.forEach((s, i) => s.ys.forEach((_, j) => draw(s, j, 1, 'rgba(243,226,192,.2)', 3)));
    SECS.forEach((s, i) => draw(s, prev[i], 1, 'rgba(255,181,71,.45)', 2, [5, 7]));
    const prog = i => io(seg(t, 0.5 + i * 2, 1.9 + i * 2));
    SECS.forEach((s, i) => { const k = prog(i); if (k > 0) { draw(s, pick[i], k, 'rgba(255,181,71,.25)', 11); draw(s, pick[i], k, C19.amber, 4.5); } });
    // маленькие сцены на ветках
    SECS.forEach((s, i) => s.ys.forEach((_, j) => { const [x, y] = at(s, j, 0.5), on = j === pick[i] && prog(i) > 0.5; disc(g, x, y, on ? 7 : 5, on ? C19.amber : '#6b5478'); }));
    disc(g, S[0], S[1], 8, C19.parch);
    // бусины — важные сцены, их видят все
    B.forEach(([x, y], i) => {
      const k = seg(t, 1.9 + i * 2, 2.5 + i * 2), on = k > 0, sc = 1 + 0.3 * bell(k);
      if (on) glow(g, x, y, 46, 'rgba(255,181,71,.6)');
      g.save(); g.translate(x, y); g.scale(sc, sc); disc(g, 0, 0, 21, on ? C19.amber : '#8a5f2e'); disc(g, -6, -7, 6, on ? '#fff3d6' : '#b48550'); g.restore();
      text(g, NAMES[i], x, y + 38, on ? C19.parch : '#b9a3c4', 14);
    });
    // точка-игрок
    let dx = S[0], dy = S[1];
    for (let i = 0; i < 3; i++) if (t >= 0.5 + i * 2) [dx, dy] = at(SECS[i], pick[i], prog(i));
    glow(g, dx, dy, 22, 'rgba(255,240,200,.9)'); disc(g, dx, dy, 7, '#fff3d6');
    if (t > 6.0) confetti(g, B[2][0], B[2][1], seg(t, 6.0, 7.4), 20, 4 + n);
    // легенда и номер прохождения
    rr(g, 14, 10, 150, 28, 9, 'rgba(26,15,38,.8)'); text(g, 'прохождение ' + (n + 1), 89, 25, C19.parch, 13, 'center', 700);
    rr(g, 470, 10, 156, 50, 9, 'rgba(26,15,38,.8)');
    line(g, 482, 25, 512, 25, C19.amber, 4); text(g, 'этот путь', 522, 25, C19.parch, 12, 'left', 700);
    g.setLineDash([5, 6]); line(g, 482, 45, 512, 45, 'rgba(255,181,71,.7)', 2); g.setLineDash([]); text(g, 'прошлый раз', 522, 45, '#c9b48f', 12, 'left', 700);
    caps(g, t, [[0.3, 'Ветки расходятся — и снова сходятся в бусинах'], [6.0, 'Важные сцены видят все, а путь к ним у каждого свой']]);
    fade(g, W, H, t, 8, C19.deep);
  };

  // места вокруг аула: значки фигурами
  const HUB = [{ n: 'Гора', a: -90 }, { n: 'Лес', a: -18 }, { n: 'Река', a: 54 }, { n: 'Пасека', a: 126 }, { n: 'Рынок', a: 198 }];
  function place19(g, i, x, y) {
    if (i === 0) { poly(g, [[x - 18, y + 10], [x - 2, y - 14], [x + 6, y - 4], [x + 11, y - 9], [x + 19, y + 10]], '#8a7a9a'); poly(g, [[x - 7, y - 7], [x - 2, y - 14], [x + 3, y - 7]], '#f3e2c0'); }
    if (i === 1) [[-11, 4, 1], [0, 0, 1.25], [11, 4, 1]].forEach(([dx, dy, s]) => { poly(g, [[x + dx - 8 * s, y + dy + 8], [x + dx, y + dy - 14 * s], [x + dx + 8 * s, y + dy + 8]], '#6fbf6a'); g.fillStyle = '#7a5236'; g.fillRect(x + dx - 1.5, y + dy + 8, 3, 4); });
    if (i === 2) for (let j = 0; j < 3; j++) { g.strokeStyle = '#7cc8f0'; g.lineWidth = 3; g.beginPath(); for (let u = -16; u <= 16; u += 2) g.lineTo(x + u, y - 8 + j * 8 + Math.sin(u / 4) * 2.5); g.stroke(); }
    if (i === 3) { [[0, 6, 14], [0, -2, 11], [0, -9, 7]].forEach(([dx, dy, r]) => { g.fillStyle = '#e8a83a'; g.beginPath(); g.ellipse(x + dx, y + dy, r, 5, 0, 0, TAU); g.fill(); }); disc(g, x, y + 9, 3, '#5a3a1a'); disc(g, x + 13, y - 11, 3, '#ffd23f'); line(g, x + 11, y - 13, x + 14, y - 15, '#fff', 1.5); }
    if (i === 4) { for (let j = 0; j < 4; j++) poly(g, [[x - 16 + j * 8, y - 6], [x - 12 + j * 8, y - 14], [x - 8 + j * 8, y - 6]], j % 2 ? '#f3e2c0' : '#e05a4a'); g.fillStyle = '#e05a4a'; g.fillRect(x - 16, y - 7, 32, 4); line(g, x - 14, y - 4, x - 14, y + 11, '#c9a06a', 2); line(g, x + 14, y - 4, x + 14, y + 11, '#c9a06a', 2); rr(g, x - 9, y + 3, 18, 8, 2, '#c99a5a'); }
  }
  MOTION['branch-hub'] = (g, t, W, H) => {
    const n = Math.floor(t / 10); t %= 10; hearth(g, W, H, t);
    const cx = 320, cy = 140, P = HUB.map(h => [cx + Math.cos(h.a * Math.PI / 180) * 232, cy + Math.sin(h.a * Math.PI / 180) * 90]);
    // в каждом круге — свой порядок
    const order = [0, 1, 2, 3, 4].map(i => [pr(n * 13 + i * 7 + 1), i]).sort((a, b) => a[0] - b[0]).map(p => p[1]);
    const A = v => 0.5 + v * 1.75;
    const visited = order.filter((_, v) => t > A(v) + 0.65);
    // дороги
    P.forEach(([x, y], i) => {
      const on = visited.includes(i); g.setLineDash(on ? [] : [6, 7]);
      line(g, cx, cy, x, y, on ? 'rgba(255,181,71,.75)' : 'rgba(201,154,90,.45)', on ? 4 : 3); g.setLineDash([]);
    });
    // аул в центре
    const back = Math.max(...[0, 1, 2, 3, 4].map(v => bell(seg(t, A(v) + 1.4, A(v) + 1.75))), t > 9.2 ? bell(seg(t, 9.2, 9.9)) : 0);
    glow(g, cx, cy, 70 + 20 * back, 'rgba(255,181,71,' + (0.3 + 0.4 * back).toFixed(2) + ')');
    disc(g, cx, cy, 42, '#3a2148'); g.strokeStyle = C19.amber; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, 42, 0, TAU); g.stroke();
    [[-18, 10, 1], [16, 12, 0.9], [-2, 18, 0.8]].forEach(([dx, dy, s]) => { g.fillStyle = C19.parch; g.fillRect(cx + dx - 9 * s, cy + dy - 10 * s, 18 * s, 12 * s); poly(g, [[cx + dx - 12 * s, cy + dy - 9 * s], [cx + dx, cy + dy - 19 * s], [cx + dx + 12 * s, cy + dy - 9 * s]], '#c0503a'); });
    g.fillStyle = '#d9c49c'; g.fillRect(cx - 5, cy - 30, 10, 30); poly(g, [[cx - 8, cy - 29], [cx, cy - 40], [cx + 8, cy - 29]], '#c0503a');
    text(g, 'аул', cx, cy + 32, C19.amber, 11, 'center', 700);
    // места
    P.forEach(([x, y], i) => {
      const v = order.indexOf(i), on = visited.includes(i), k = bell(seg(t, A(v) + 0.6, A(v) + 1.0));
      g.save(); g.translate(x, y); g.scale(1 + 0.2 * k, 1 + 0.2 * k);
      if (on) glow(g, 0, 0, 44, 'rgba(255,181,71,.5)');
      disc(g, 0, 0, 27, on ? '#4e2f5e' : '#2e1d40'); g.strokeStyle = on ? C19.amber : '#6b5478'; g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, 27, 0, TAU); g.stroke();
      place19(g, i, 0, 0); g.restore();
      const ly = y > cy ? y + 37 : y - 37; text(g, HUB[i].n, x, ly, on ? C19.parch : '#b9a3c4', 13);
      if (on) { const bk = ob(seg(t, A(v) + 0.65, A(v) + 0.95)); g.save(); g.translate(x + 22, y - 20); g.scale(bk, bk); disc(g, 0, 0, 10, C19.amber); text(g, String(v + 1), 0, 1, C19.deep, 12); g.restore(); }
    });
    // точка-игрок: в место и обратно в аул
    let dx = cx, dy = cy;
    const v = clamp(Math.floor((t - 0.5) / 1.75), 0, 4), u = t - A(v), [px, py] = P[order[v]];
    if (u > 0 && u < 0.65) { const e = io(u / 0.65); dx = lerp(cx, px, e); dy = lerp(cy, py, e); }
    else if (u >= 0.65 && u < 0.95) { dx = px; dy = py - bell((u - 0.65) / 0.3) * 12; }
    else if (u >= 0.95 && u < 1.6) { const e = io((u - 0.95) / 0.65); dx = lerp(px, cx, e); dy = lerp(py, cy, e); }
    glow(g, dx, dy, 22, 'rgba(255,240,200,.9)'); disc(g, dx, dy, 7, '#fff3d6');
    if (t > 9.2) confetti(g, cx, cy, seg(t, 9.2, 10), 22, 6 + n);
    // порядок этого круга
    const names = visited.map(i => HUB[i].n).join(' → ') || '…';
    rr(g, 14, 10, 260, 28, 9, 'rgba(26,15,38,.82)'); fit(g, 'порядок: ' + names, 24, 25, C19.parch, 13, 240, 'left', 700);
    caps(g, t, [[0.3, 'Хаб: из аула — в любое место и обратно'], [4.0, 'Порядок игрок выбирает сам — каждый раз другой'], [8.6, 'А дорога всегда ведёт домой']]);
    fade(g, W, H, t, 10, C19.deep);
  };

  /* =================== урок 20: история, рассказанная пространством =================== */
  // палитра: уютный пыльный чердак — тёплое дерево, жёлтая лампа, бирюзовые акценты
  const C20 = { wood: '#b5835a', woodD: '#7a5236', lamp: '#ffd98a', teal: '#5fc2b8', ink: '#2b1d16', paper: '#f4ead8' };
  function attic(g, W, H, t, o = {}) {
    sky(g, W, H, '#5e4332', '#34251c');
    poly(g, [[0, 0], [170, 0], [0, 130]], '#2e2018'); poly(g, [[W, 0], [W - 170, 0], [W, 130]], '#2e2018');
    line(g, -4, 136, 176, -4, '#7a5236', 9); line(g, W + 4, 136, W - 176, -4, '#7a5236', 9);
    const fy = o.floor || 262;
    g.fillStyle = C20.wood; g.fillRect(0, fy, W, H - fy);
    for (let y = fy + 12; y < H; y += 14) line(g, 0, y, W, y, '#9a6c48', 1.5);
    for (let i = 0; i < 9; i++) line(g, (i * 83 + 30) % W, fy + 14 * (i % 3), (i * 83 + 30) % W, fy + 14 * (i % 3) + 14, '#9a6c48', 1.5);
    glow(g, 320, 30, 300, 'rgba(255,217,138,.26)');
    if (o.lamp !== false) { line(g, 320, 0, 320, 20, '#2a1c14', 2); rr(g, 310, 18, 20, 6, 2, '#3a2a1e'); disc(g, 320, 30, 8, C20.lamp); glow(g, 320, 30, 34, 'rgba(255,230,160,.85)'); }
    // пылинки в свете лампы
    for (let i = 0; i < 26; i++) {
      const x = (pr(i) * W + t * (5 + pr(i + 1) * 8)) % W, y = 40 + pr(i + 2) * 200 + Math.sin(t * 0.8 + i) * 10;
      alpha(g, 0.2 + 0.4 * Math.pow(Math.sin(t * 1.5 + i * 2), 2), () => disc(g, x, y, 1 + pr(i + 3) * 1.4, C20.lamp));
    }
  }
  // вещи: (x, y) — низ по центру
  function thing(g, kind, x, y, s = 1) {
    g.save(); g.translate(x, y); g.scale(s, s);
    if (kind === 'cup') { g.strokeStyle = C20.teal; g.lineWidth = 4; g.beginPath(); g.arc(12, -14, 6, -Math.PI / 2, Math.PI / 2); g.stroke(); rr(g, -12, -26, 24, 26, 5, C20.teal); rr(g, -12, -26, 24, 5, 2, '#9ae8de'); }
    if (kind === 'book') { rr(g, -9, -40, 18, 40, 3, '#c0503a'); rr(g, -9, -40, 5, 40, 2, '#8e3526'); g.fillStyle = C20.lamp; g.fillRect(-2, -30, 9, 3); g.fillRect(-2, -12, 9, 3); }
    if (kind === 'toy') {
      disc(g, -8, -38, 5, '#b9783e'); disc(g, 8, -38, 5, '#b9783e'); disc(g, 0, -12, 12, '#c98a4a'); disc(g, 0, -30, 10, '#d99a5a');
      disc(g, 0, -27, 4, '#f0c890'); disc(g, -3.5, -32, 1.7, C20.ink); disc(g, 3.5, -32, 1.7, C20.ink); disc(g, 0, -11, 6, '#f0c890');
    }
    if (kind === 'frame') { rr(g, -18, -36, 36, 36, 3, '#e8c27a'); g.fillStyle = '#9fd8f0'; g.fillRect(-13, -31, 26, 26); poly(g, [[-13, -5], [-4, -17], [3, -10], [13, -20], [13, -5]], '#6fae6a'); disc(g, 6, -25, 3, C20.lamp); }
    if (kind === 'plant') { poly(g, [[-10, -16], [10, -16], [7, 0], [-7, 0]], '#c0603a'); [[-0.5, 14], [0, 18], [0.5, 14]].forEach(([a, l]) => { g.save(); g.translate(0, -16); g.rotate(a); g.fillStyle = '#5fae6a'; g.beginPath(); g.ellipse(0, -l / 2 - 2, 4, l / 2 + 2, 0, 0, TAU); g.fill(); g.restore(); }); }
    if (kind === 'books') { rr(g, -16, -34, 9, 34, 2, '#5f8fc0'); rr(g, -6, -38, 10, 38, 2, C20.teal); rr(g, 5, -30, 9, 30, 2, '#e0a050'); }
    if (kind === 'photo') {
      rr(g, -21, -38, 42, 38, 3, C20.paper, '#b5835a'); g.fillStyle = '#e8c9a8'; g.fillRect(-16, -33, 32, 26);
      disc(g, -7, -24, 4.5, '#7a5236'); rr(g, -12, -19, 10, 12, 4, '#ff8fa3'); disc(g, 7, -25, 4.5, '#3a2a1e'); rr(g, 2, -20, 10, 13, 4, '#5f8fc0');
      heart(g, 0, -29, 4, '#e0505a');
    }
    g.restore();
  }

  MOTION['unpack-box'] = (g, t, W, H) => {
    t %= 9; attic(g, W, H, t);
    const shelf = (x, y, w) => { rr(g, x, y, w, 8, 2, C20.wood); g.fillStyle = C20.woodD; g.fillRect(x + 12, y + 8, 6, 16); g.fillRect(x + w - 18, y + 8, 6, 16); };
    shelf(40, 128, 210); shelf(390, 128, 220);
    thing(g, 'plant', 222, 128); thing(g, 'books', 588, 128);
    // комод с ящиками
    const open = io(seg(t, 5.6, 6.0)) * (1 - io(seg(t, 6.75, 7.05))), dy = 16 * open, bump = bell(seg(t, 7.0, 7.3));
    g.save(); g.translate(525, 262); g.scale(1 + bump * 0.04, 1 - bump * 0.05); g.translate(-525, -262);
    rr(g, 452, 184, 146, 78, 6, '#8a5f3e'); rr(g, 456, 188, 138, 32, 4, '#1e140e');
    const ph = seg(t, 6.15, 6.7); // фото уходит в ящик
    if (ph > 0 && ph < 1) thing(g, 'photo', lerp(380, 525, io(ph)), lerp(150, 212, io(ph)) + 18 * ph, 1 - 0.3 * ph);
    rr(g, 458, 190 + dy, 134, 28, 4, C20.wood); disc(g, 525, 204 + dy, 4, '#5a3a26');
    rr(g, 458, 226, 134, 30, 4, C20.wood); disc(g, 525, 241, 4, '#5a3a26');
    g.restore();
    // коробка: качается (замах) и открывается
    const wob = Math.sin(t * 22) * 0.035 * bell(seg(t, 0.1, 0.7)), fl = ob(seg(t, 0.6, 1.0));
    g.save(); g.translate(320, 262); g.rotate(wob); g.translate(-320, -262);
    rr(g, 256, 200, 128, 62, 4, '#c9965f'); g.fillStyle = '#b07f4c'; g.fillRect(256, 200, 128, 8); g.fillStyle = 'rgba(255,240,200,.35)'; g.fillRect(312, 200, 16, 62);
    g.save(); g.translate(256, 200); g.rotate(-fl * 2.3); g.fillStyle = '#d8a56c'; g.fillRect(0, -8, 64, 8); g.restore();
    g.save(); g.translate(384, 200); g.rotate(fl * 2.3); g.fillStyle = '#d8a56c'; g.fillRect(-64, -8, 64, 8); g.restore();
    g.restore();
    // вещи по полкам: вылетают по одной
    [['cup', 80], ['book', 150], ['toy', 440], ['frame', 500]].forEach(([k, x], i) => {
      const a = 1.0 + i * 0.8, u = seg(t, a, a + 0.65); if (t < a) return;
      const e = io(u), px = lerp(320, x, e), py = lerp(204, 128, e) - bell(u) * 92;
      const land = seg(t, a + 0.65, a + 0.95), sq = u >= 1 ? bell(land) * 0.3 * (1 - land) : 0;
      g.save(); g.translate(px, py); if (u < 1) g.rotate((1 - e) * (i % 2 ? -1.8 : 1.8)); g.scale(1 + sq, 1 - sq); thing(g, k, 0, 0); g.restore();
    });
    // фотография вдвоём: ей нет места на полках
    if (t > 4.4 && ph <= 0) {
      const up = ob(seg(t, 4.4, 4.9)), tr = io(seg(t, 4.9, 5.3)), shake = t > 5.3 && t < 5.8 ? Math.sin(t * 50) * 4 * (1 - seg(t, 5.3, 5.8)) : 0, to = io(seg(t, 5.8, 6.15));
      const x = lerp(lerp(320, 470, tr), 380, to) + shake, y = lerp(lerp(204, 150, up), 128, tr * (1 - to)) + to * 22;
      thing(g, 'photo', x, y, 1.15);
      if (t > 5.3 && t < 5.9) { const qk = ob(seg(t, 5.3, 5.55)); g.save(); g.translate(x + 26, y - 52); g.scale(qk, qk); disc(g, 0, 0, 13, C20.paper); text(g, '?', 0, 1, C20.ink, 18); g.restore(); }
    }
    if (t > 7.1 && t < 7.8) alpha(g, 1 - seg(t, 7.1, 7.8), () => { for (let j = 0; j < 7; j++) disc(g, 470 + j * 18 + Math.sin(j) * 6, 182 - seg(t, 7.1, 7.8) * 14 - pr(j) * 8, 3 + pr(j + 3) * 3, '#d9c4a8'); });
    caps(g, t, [[0.3, 'Unpacking: ты просто раскладываешь вещи'], [4.4, 'А эту фотографию поставить некуда…'], [6.9, 'Ни одного слова — а ты уже знаешь, что случилось']], { bg: 'rgba(43,29,22,.9)', col: C20.paper });
    fade(g, W, H, t, 9, '#2a1c14');
  };

  // изометрия комнаты: x, y — по полу, z — вверх
  const ISO = (x, y, z) => [320 + (x - y) * 24, 84 + (x + y) * 13.5 - z * 26];
  const isoPoly = (g, pts, col) => poly(g, pts.map(p => ISO(...p)), col);
  function isoBox(g, x, y, z, w, d, h, top, left, right) {
    isoPoly(g, [[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]], left);
    isoPoly(g, [[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]], right);
    isoPoly(g, [[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]], top);
  }
  MOTION['room-reads'] = (g, t, W, H) => {
    t %= 10; sky(g, W, H, '#3a2a22', '#22180f');
    glow(g, 320, 120, 320, 'rgba(255,217,138,.16)');
    // стены и пол
    isoPoly(g, [[0, 0, 0], [7, 0, 0], [7, 0, 3], [0, 0, 3]], '#8a6248'); isoPoly(g, [[0, 0, 0], [0, 7, 0], [0, 7, 3], [0, 0, 3]], '#6e4c38');
    isoPoly(g, [[0, 0, 0], [7, 0, 0], [7, 7, 0], [0, 7, 0]], C20.wood);
    for (let i = 1; i < 7; i++) { const [a, b] = ISO(i, 0, 0), [c, d] = ISO(i, 7, 0); line(g, a, b, c, d, '#9a6c48', 1.5); }
    // окно с вечерним небом
    isoPoly(g, [[0, 1.8, 1.1], [0, 3.8, 1.1], [0, 3.8, 2.5], [0, 1.8, 2.5]], '#e8c27a'); isoPoly(g, [[0, 1.95, 1.2], [0, 3.65, 1.2], [0, 3.65, 2.4], [0, 1.95, 2.4]], '#ffb58a');
    { const [a, b] = ISO(0, 2.8, 1.2), [c, d] = ISO(0, 2.8, 2.4); line(g, a, b, c, d, '#e8c27a', 3); }
    // дверь
    isoPoly(g, [[4.4, 0, 0], [5.9, 0, 0], [5.9, 0, 2.4], [4.4, 0, 2.4]], '#5a3a26'); { const [a, b] = ISO(5.6, 0, 1.15); disc(g, a, b, 3, C20.lamp); }
    // коврик
    isoPoly(g, [[1.6, 2.6, 0], [4.6, 2.6, 0], [4.6, 5.8, 0], [1.6, 5.8, 0]], '#3f8f88'); isoPoly(g, [[1.9, 2.9, 0], [4.3, 2.9, 0], [4.3, 5.5, 0], [1.9, 5.5, 0]], '#4fa8a0');
    // чемоданы у двери
    isoBox(g, 4.5, 0.55, 0, 0.7, 0.35, 1.3, '#e07a5a', '#a8503a', '#c0603f'); isoBox(g, 5.35, 0.7, 0, 0.75, 0.4, 1.0, '#7fd8cf', '#3f8f88', C20.teal);
    { const [a, b] = ISO(4.85, 0.72, 1.3); rr(g, a - 6, b - 6, 12, 5, 2, '#5a2a1a'); }
    // стол с билетом
    isoBox(g, 2.9, 2.5, 0, 1.6, 1.2, 0.9, '#c9965f', '#8a5f3e', '#a8774e');
    isoPoly(g, [[3.2, 2.85, 0.9], [4.05, 2.85, 0.9], [4.05, 3.3, 0.9], [3.2, 3.3, 0.9]], '#ffd0c0'); isoPoly(g, [[3.75, 2.85, 0.9], [3.82, 2.85, 0.9], [3.82, 3.3, 0.9], [3.75, 3.3, 0.9]], '#c0503a');
    // табурет с недопитым чаем
    isoBox(g, 0.7, 5.0, 0, 0.8, 0.8, 0.7, '#c9965f', '#8a5f3e', '#a8774e');
    { const [a, b] = ISO(1.1, 5.4, 0.7); rr(g, a - 7, b - 13, 14, 13, 4, C20.paper); g.strokeStyle = C20.paper; g.lineWidth = 2.5; g.beginPath(); g.arc(a + 8, b - 7, 4, -Math.PI / 2, Math.PI / 2); g.stroke(); g.fillStyle = '#a8643a'; g.beginPath(); g.ellipse(a, b - 12, 6, 2, 0, 0, TAU); g.fill(); }
    // улики по очереди
    const CL = [{ p: ISO(5.1, 0.8, 0.7), s: 'два чемодана у двери', lx: 520, ly: 76 }, { p: ISO(3.6, 3.1, 0.9), s: 'билет на поезд', lx: 470, ly: 238 }, { p: ISO(1.1, 5.4, 0.95), s: 'недопитый чай', lx: 112, ly: 150 }];
    CL.forEach((c, i) => {
      const a = 0.8 + i * 1.9, k = ob(seg(t, a, a + 0.45)); if (t < a) return;
      const cur = t < a + 1.9 && t < 6.6, [x, y] = c.p, pul = 1 + 0.12 * Math.sin(t * 6);
      if (cur) glow(g, x, y, 46, 'rgba(255,217,138,.55)');
      g.strokeStyle = cur ? C20.lamp : 'rgba(255,217,138,.55)'; g.lineWidth = cur ? 3 : 2; g.beginPath(); g.ellipse(x, y, 30 * k * (cur ? pul : 1), 18 * k * (cur ? pul : 1), 0, 0, TAU); g.stroke();
      const w = tw(g, c.s, 14) + 26;
      line(g, x, y, lerp(x, c.lx, k), lerp(y, c.ly, k), 'rgba(255,217,138,.6)', 2);
      g.save(); g.translate(c.lx, c.ly); g.scale(k, k); rr(g, -w / 2, -14, w, 28, 9, 'rgba(43,29,22,.92)', cur ? C20.lamp : 'rgba(255,217,138,.35)'); text(g, c.s, 0, 1, C20.paper, 14); g.restore();
    });
    // фраза собирается из трёх слов
    const WORDS = ['Кто-то', 'уехал', 'в спешке'], FROM = [[112, 150], [520, 76], [470, 238]], px = 22;
    const ws = WORDS.map(s => tw(g, s, px)), total = ws.reduce((a, b) => a + b, 0) + 12 * 2;
    if (t > 6.6) {
      const done = ob(seg(t, 7.9, 8.3));
      if (done > 0) { g.save(); g.translate(320, 34); g.scale(0.85 + 0.15 * done, 0.85 + 0.15 * done); glow(g, 0, 0, 160, 'rgba(255,217,138,.4)', done); rr(g, -total / 2 - 20, -22, total + 40, 44, 14, C20.lamp); g.restore(); }
      let x = 320 - total / 2;
      WORDS.forEach((s, i) => {
        const k = io(seg(t, 6.6 + i * 0.35, 7.2 + i * 0.35)), tx = x + ws[i] / 2; x += ws[i] + 12;
        if (k <= 0) return; const [fx, fy] = FROM[i];
        text(g, s, lerp(fx, tx, k), lerp(fy, 34, k) - bell(k) * 30, done > 0 ? C20.ink : C20.lamp, px);
      });
    }
    caps(g, t, [[0.3, 'Gone Home: комнату читают, как письмо'], [6.6, 'Вещи — это улики: история сложилась сама']], { bg: 'rgba(43,29,22,.9)', col: C20.paper });
    fade(g, W, H, t, 10, '#22180f');
  };

  // кадры-полароиды «Что здесь случилось?»
  function cat(g, x, y, s) {
    g.fillStyle = '#6b6f7a'; g.beginPath(); g.ellipse(x, y - 9 * s, 16 * s, 9 * s, 0, 0, TAU); g.fill();
    disc(g, x + 13 * s, y - 18 * s, 8 * s, '#6b6f7a'); poly(g, [[x + 7 * s, y - 22 * s], [x + 9 * s, y - 31 * s], [x + 14 * s, y - 24 * s]], '#6b6f7a'); poly(g, [[x + 14 * s, y - 25 * s], [x + 20 * s, y - 31 * s], [x + 20 * s, y - 21 * s]], '#6b6f7a');
    g.strokeStyle = '#6b6f7a'; g.lineWidth = 4 * s; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - 15 * s, y - 8 * s); g.quadraticCurveTo(x - 26 * s, y + 4 * s, x - 22 * s, y + 18 * s); g.stroke();
    disc(g, x + 10 * s, y - 19 * s, 1.6 * s, '#ffd98a'); disc(g, x + 16 * s, y - 19 * s, 1.6 * s, '#ffd98a');
  }
  function paw(g, x, y, s, col) { disc(g, x, y, 3.2 * s, col); [[-3.6, -4], [0, -5.4], [3.6, -4]].forEach(([dx, dy]) => disc(g, x + dx * s, y + dy * s, 1.5 * s, col)); }
  function frameScene(g, i, x, y, t) { // x, y — левый верх кадра 140 × 102
    g.save(); g.beginPath(); g.rect(x, y, 140, 102); g.clip();
    g.fillStyle = '#e9dcc4'; g.fillRect(x, y, 140, 102); g.fillStyle = '#c9a77f'; g.fillRect(x, y + 74, 140, 28);
    if (i === 0 || i === 2) {
      g.fillStyle = '#9fd8f0'; g.beginPath(); g.ellipse(x + 62, y + 88, 30, 6, 0, 0, TAU); g.fill();
      [[44, 84, 0.3], [58, 90, 1.4], [76, 86, 2.4], [86, 92, 0.9], [66, 80, 3.6]].forEach(([dx, dy, a], j) => { g.save(); g.translate(x + dx, y + dy); g.rotate(a); poly(g, [[-6, 3], [0, -6], [7, 4]], j % 2 ? C20.teal : '#3f8f88'); g.restore(); });
      line(g, x + 96, y + 90, x + 116, y + 82, '#5fae6a', 2.5); disc(g, x + 118, y + 81, 5, '#ff8fa3');
    }
    if (i === 1) { g.fillStyle = '#9fd8f0'; g.beginPath(); g.ellipse(x + 30, y + 88, 24, 5, 0, 0, TAU); g.fill(); for (let j = 0; j < 5; j++) paw(g, x + 52 + j * 17, y + 92 - j * 9 + (j % 2) * 5, 1, '#5f7f9a'); }
    if (i === 2) { rr(g, x + 70, y + 36, 70, 6, 2, '#8a5f3e'); cat(g, x + 100, y + 36, 0.9); disc(g, x + 112, y + 6, 4.5, '#ff8fa3'); line(g, x + 112, y + 10, x + 112, y + 16, '#5fae6a', 2); }
    if (i !== 2) { rr(g, x + 70, y + 36, 70, 6, 2, '#8a5f3e'); }
    g.restore();
  }
  MOTION['three-frames'] = (g, t, W, H) => {
    t %= 9; attic(g, W, H, t, { lamp: false });
    const OPEN = [0.6, 2.8, 5.0], VAL = [300, 200, 100];
    OPEN.forEach((o, i) => {
      const x = 40 + i * 200, y = 62, k = seg(t, o, o + 0.5), sx = Math.max(0.02, Math.abs(Math.cos(k * Math.PI))), front = k >= 0.5;
      const glowF = i === 0 && t > 7.3 ? bell(seg(t, 7.3, 8.6)) : 0;
      g.save(); g.translate(x + 80, y + 75); g.rotate((i - 1) * 0.04); g.scale(sx, 1); g.translate(-x - 80, -y - 75);
      if (glowF) glow(g, x + 80, y + 75, 130, 'rgba(255,217,138,.7)', glowF);
      rr(g, x + 4, y + 6, 160, 150, 6, 'rgba(0,0,0,.35)');
      if (front) {
        rr(g, x, y, 160, 150, 6, C20.paper); frameScene(g, i, x + 10, y + 10, t);
        text(g, 'кадр ' + (i + 1), x + 46, y + 132, '#7a5236', 13, 'center', 700);
        rr(g, x + 96, y + 120, 54, 24, 8, i === Math.min(2, OPEN.filter(q => t >= q).length - 1) ? C20.lamp : '#e8d8bc'); text(g, String(VAL[i]), x + 123, y + 133, C20.ink, 14);
      } else { rr(g, x, y, 160, 150, 6, '#3f8f88', '#7fd8cf'); text(g, '?', x + 80, y + 72, C20.lamp, 48); }
      g.restore();
      rr(g, x + 58, y - 8, 44, 14, 2, 'rgba(255,240,200,.55)');
    });
    // очки: падают с каждым кадром
    const sc = 300 - 100 * io(seg(t, 3.05, 3.4)) - 100 * io(seg(t, 5.25, 5.6)), hit = Math.max(bell(seg(t, 3.05, 3.35)), bell(seg(t, 5.25, 5.55)));
    g.save(); g.translate(320, 32); g.scale(1 + 0.12 * hit, 1 + 0.12 * hit); rr(g, -82, -20, 164, 40, 12, 'rgba(43,29,22,.92)', hit > 0.05 ? '#ff6f6f' : C20.lamp); text(g, 'очки: ' + Math.round(sc / 10) * 10, 0, 1, hit > 0.05 ? '#ffb0b0' : C20.lamp, 20); g.restore();
    [3.05, 5.25].forEach(a => { const k = seg(t, a, a + 0.9); if (k > 0 && k < 1) alpha(g, 1 - k, () => text(g, '−100', 440, 34 - k * 22, '#ff7070', 18)); });
    // догадка
    if (t > 6.3) {
      const k = ob(seg(t, 6.3, 6.7)); g.save(); g.translate(320, 236); g.scale(k, k);
      rr(g, -120, -18, 240, 36, 12, C20.paper, '#3aa66a'); text(g, 'Кот разбил вазу!', 12, 1, C20.ink, 16); tick(g, -96, 0, 9, seg(t, 6.6, 7.0)); g.restore();
    }
    if (t > 7.3) { const k = ob(seg(t, 7.3, 7.7)); g.save(); g.translate(120, 56); g.scale(k, k); rr(g, -84, -12, 168, 24, 8, C20.lamp); text(g, 'угадал бы тут — 300', 0, 1, C20.ink, 12); g.restore(); }
    caps(g, t, [[0.3, 'Что здесь случилось? Кадры открываются по одному'], [7.3, 'Чем раньше догадался — тем больше очков']], { bg: 'rgba(43,29,22,.92)', col: C20.paper });
    fade(g, W, H, t, 9, '#2a1c14');
  };

  // кружка: (x, y) — низ
  function mug(g, x, y, s, col) {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.strokeStyle = col; g.lineWidth = 10; g.beginPath(); g.arc(30, -38, 15, -Math.PI / 2, Math.PI / 2); g.stroke();
    rr(g, -30, -76, 60, 76, 12, col); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(-22, -68, 8, 54);
    g.fillStyle = mix(col, '#000000', 0.35); g.beginPath(); g.ellipse(0, -74, 26, 5, 0, 0, TAU); g.fill();
    g.restore();
  }
  MOTION['item-with-story'] = (g, t, W, H) => {
    t %= 8;
    // слева — прохладная пыльная комната, справа — тёплый свет лампы
    sky(g, W, H, '#6a4632', '#3a2618'); g.fillStyle = '#5c5a5c'; g.fillRect(0, 0, 320, H); g.fillStyle = '#76736f'; g.fillRect(0, 222, 320, H - 222);
    g.save(); g.beginPath(); g.rect(320, 0, 320, H); g.clip(); glow(g, 480, 40, 260, 'rgba(255,217,138,.35)'); g.fillStyle = C20.wood; g.fillRect(320, 222, 320, H - 222); line(g, 320, 236, 640, 236, '#9a6c48', 1.5); g.restore();
    line(g, 320, 0, 320, H, C20.lamp, 3);
    text(g, 'обычная вещь', 160, 26, '#c9c6c2', 13, 'center', 700); text(g, 'вещь с историей', 480, 26, C20.lamp, 13, 'center', 700);
    const pin = ob(seg(t, 0.2, 0.6));
    // слева — просто кружка
    g.save(); g.translate(160, 222); g.scale(pin, pin); mug(g, 0, 0, 1, C20.teal); g.restore();
    if (t > 5.0) alpha(g, 0.35 * seg(t, 5.0, 5.6), () => { g.fillStyle = '#4a4848'; g.fillRect(0, 0, 320, 222); });
    // справа — та же кружка: дрожит, разбивается, собирается, трещина золотом, записка
    const cx = 480, cy = 222, pre = bell(seg(t, 0.9, 1.3)), boom = oc(seg(t, 1.3, 1.65)), back = io(seg(t, 2.1, 2.9)), spread = boom * (1 - back);
    const WED = [[-2.2, -0.9], [-0.9, 0.3], [0.3, 1.6], [1.6, 2.9], [2.9, 4.1]];
    WED.forEach(([a0, a1], j) => {
      const mid = (a0 + a1) / 2, r = 46 * spread, rot = (j % 2 ? 1 : -1) * 0.9 * spread;
      g.save(); g.translate(cx + Math.cos(mid) * r, cy - 38 + Math.sin(mid) * r * 0.8 + spread * 18); g.rotate(rot);
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 140, a0, a1); g.closePath(); g.clip();
      g.translate(0, 38); g.scale(pin * (1 + pre * 0.06), pin * (1 - pre * 0.08)); mug(g, 0, 0, 1, C20.teal); g.restore();
    });
    const ck = seg(t, 2.9, 3.6);
    if (ck > 0) {
      const CR = [[[-30, -58], [-14, -48], [-4, -32], [10, -26], [30, -12]], [[-4, -32], [-12, -16], [-6, 0]]];
      g.save(); g.translate(cx, cy); glow(g, 0, -36, 70, 'rgba(255,217,138,.35)', ck);
      CR.forEach(pts => { const n = Math.max(1, Math.round(ck * (pts.length - 1) * 10)) / 10; g.strokeStyle = '#ffd98a'; g.lineWidth = 3.5; g.lineJoin = 'round'; g.beginPath(); g.moveTo(...pts[0]); for (let i = 1; i < pts.length; i++) { const u = clamp(n - (i - 1), 0, 1); if (u <= 0) break; g.lineTo(lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u)); } g.stroke(); });
      if (t > 5.6) for (let j = 0; j < 4; j++) { const k = (t * 0.8 + j * 0.25) % 1; alpha(g, bell(k), () => disc(g, lerp(-30, 30, (j * 0.29 + 0.1) % 1), -58 + j * 12, 2 + 2 * bell(k), '#fff3c0')); }
      g.restore();
    }
    // записка «не выбрасывать»
    if (t > 3.7) {
      const k = ob(seg(t, 3.7, 4.05)), sq = bell(seg(t, 3.95, 4.2)) * 0.15;
      g.save(); g.translate(570, 178); g.rotate(0.12); g.scale(k * (1 + sq), k * (1 - sq));
      rr(g, -46 + 3, -30 + 4, 92, 60, 3, 'rgba(0,0,0,.3)'); rr(g, -46, -30, 92, 60, 3, '#ffe36e'); g.fillStyle = '#f5cf3a'; g.fillRect(-46, -30, 92, 10);
      text(g, 'не', 0, -4, '#3a2a1e', 14, 'center', 700); fit(g, 'выбрасывать', 0, 15, '#3a2a1e', 14, 82, 'center', 700); g.restore();
    }
    // подписи под кружками
    const lk = ob(seg(t, 0.5, 0.9));
    if (lk > 0) { g.save(); g.translate(160, 248); g.scale(lk, lk); rr(g, -70, -13, 140, 26, 9, '#4a4848'); text(g, 'просто кружка', 0, 1, '#e6e2dc', 14); g.restore(); }
    const rk = ob(seg(t, 4.3, 4.7));
    if (rk > 0) { g.save(); g.translate(480, 248); g.scale(rk, rk); rr(g, -82, -13, 164, 26, 9, 'rgba(43,29,22,.9)', C20.lamp); text(g, 'та же, но склеенная', 0, 1, C20.lamp, 14); g.restore(); }
    caps(g, t, [[0.3, 'Слева и справа — одна и та же кружка'], [1.3, 'Справа она разбилась… и её склеили'], [5.0, 'Вещь с историей — та, что что-то пережила']], { bg: 'rgba(43,29,22,.92)', col: C20.paper, y: 280 });
    fade(g, W, H, t, 8, '#2a1c14');
  };

  /* =================== урок 21: мир и визуальный стиль =================== */
  // склон в духе Alto: одна геометрия, палитра — снаружи
  const SUNSET = { sky: ['#ffcf7a', '#ffcf7a'], sun: '#f2efe6', far: '#ff8a5c', mid: '#6a4c93', snow: '#f2efe6', tree: '#2b2d5a', hero: '#2b2d5a', scarf: '#ff8a5c' };
  const surf = x => 168 + x * 0.1 + 12 * Math.sin(x / 64 + 0.6);
  const slope = x => Math.atan(0.1 + (12 / 64) * Math.cos(x / 64 + 0.6));
  const TREES = [[40, 1.0], [100, 0.75], [470, 1.25], [532, 0.85], [604, 1.05]];
  function pine(g, x, y, s, col) {
    for (let j = 0; j < 3; j++) poly(g, [[x - (17 - j * 4) * s, y - (4 + j * 13) * s], [x, y - (30 + j * 13) * s], [x + (17 - j * 4) * s, y - (4 + j * 13) * s]], col);
    g.fillStyle = col; g.fillRect(x - 2.5 * s, y - 6 * s, 5 * s, 7 * s);
  }
  function alto(g, W, H, p, t) {
    if (p.sky[0] === p.sky[1]) { g.fillStyle = p.sky[0]; g.fillRect(0, 0, W, H); } else sky(g, W, H, p.sky[0], p.sky[1]);
    if (p.fx === 'night') for (let i = 0; i < 46; i++) alpha(g, 0.4 + 0.6 * Math.pow(Math.sin(t * 2 + i * 1.7), 2), () => disc(g, pr(i) * W, pr(i + 30) * 150, 0.8 + pr(i + 60) * 1.4, '#fffbe8'));
    if (p.fx === 'sun') soft(g, 470, 92, 140, '255,240,210', 0.7);
    disc(g, 470, 92, 34, p.sun);
    if (p.fx === 'night') disc(g, 484, 84, 30, p.sky[0]);
    poly(g, [[0, 170], [60, 122], [120, 150], [200, 80], [270, 140], [330, 108], [410, 160], [500, 98], [580, 150], [640, 118], [640, 300], [0, 300]], p.far);
    g.beginPath(); g.moveTo(0, 300); for (let x = 0; x <= W; x += 10) g.lineTo(x, 184 + 18 * Math.sin(x / 90 + 1) + 8 * Math.sin(x / 37)); g.lineTo(W, 300); g.closePath(); g.fillStyle = p.mid; g.fill();
    g.beginPath(); g.moveTo(0, 300); for (let x = 0; x <= W; x += 8) g.lineTo(x, surf(x)); g.lineTo(W, 300); g.closePath(); g.fillStyle = p.snow; g.fill();
    TREES.forEach(([x, s]) => pine(g, x, surf(x) + 3, s, p.tree));
  }
  // сноубордист с шарфом: (x, y) — точка на склоне, ang — наклон склона
  function boarder(g, x, y, ang, body, scarf, t, sq = 0) {
    g.save(); g.translate(x, y); g.rotate(ang); g.scale(1 + sq * 0.2, 1 - sq * 0.25);
    rr(g, -18, -4, 36, 5, 2.5, body);
    g.save(); g.rotate(0.25); rr(g, -5, -30, 10, 27, 5, body); g.restore();
    disc(g, 8.5, -35, 6.5, body);
    g.strokeStyle = scarf; g.lineWidth = 4.5; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(7, -26);
    for (let i = 1; i <= 4; i++) g.lineTo(7 - i * 7, -26 + Math.sin(t * 9 + i * 1.2) * 1.4 * i + i * 1.3); g.stroke();
    g.restore();
  }
  MOTION['palette-five'] = (g, t, W, H) => {
    t %= 9; const p = SUNSET, ACID = '#a6ff2b', COLS = ['#ffcf7a', '#ff8a5c', '#6a4c93', '#2b2d5a', '#f2efe6'];
    alto(g, W, H, p, t);
    const tx = 470, ty = surf(470) - 26, fl = seg(t, 3.2, 3.7), gone = io(seg(t, 5.0, 5.7)), hitK = seg(t, 3.7, 4.0);
    if (t > 3.7 && gone < 1) alpha(g, 1 - gone, () => {
      const s = 1 + 0.12 * bell(hitK); pine(g, tx, surf(tx) + 3, 1.25 * s, ACID);
      for (let j = 0; j < 10; j++) { const a = pr(j) * TAU, r = (22 + pr(j + 5) * 26) * oc(hitK); disc(g, tx + Math.cos(a) * r, ty + Math.sin(a) * r * 0.8, 2 + pr(j + 9) * 4, ACID); }
      for (let j = 0; j < 4; j++) { g.fillStyle = ACID; g.fillRect(tx - 14 + j * 9, ty + 6, 3, 6 + 14 * seg(t, 3.8 + j * 0.1, 4.8)); }
    });
    if (t > 3.2 && t < 3.7) { const bx = lerp(690, tx, fl), by = lerp(-30, ty, fl) - bell(fl) * 40; g.save(); g.translate(bx, by); g.rotate(Math.atan2(ty + 30, tx - 690)); g.scale(1.7, 0.7); disc(g, 0, 0, 11, ACID); g.restore(); }
    const hx = -30 + 700 * (t / 9); boarder(g, hx, surf(hx) + 1, slope(hx), p.hero, p.scarf, t);
    // образцы цветов
    const n6 = t > 3.8 ? ob(seg(t, 3.8, 4.15)) * (1 - gone) : 0, cnt = 5 + n6, step = 46, w = (cnt - 1) * step + 54;
    rr(g, 320 - w / 2, 228, w, 50, 14, '#2b2d5a');
    for (let i = 0; i < 6; i++) {
      const k = i < 5 ? ob(seg(t, 0.6 + i * 0.35, 0.95 + i * 0.35)) : n6; if (k <= 0) continue;
      const x = 320 - (cnt - 1) * step / 2 + i * step, wave = t > 5.9 ? bell(seg(t, 6.0 + i * 0.12, 6.4 + i * 0.12)) * 8 : 0;
      const jit = i === 5 ? Math.sin(t * 40) * 2 : 0;
      g.save(); g.translate(x + jit, 253 - wave); g.scale(k, k); rr(g, -17, -17, 34, 34, 8, i < 5 ? COLS[i] : ACID, '#f2efe6'); g.restore();
      if (i === 5) cross(g, x, 253, 14, seg(t, 4.4, 4.8) * (1 - gone));
    }
    cross(g, tx, ty - 8, 22, seg(t, 4.4, 4.8) * (1 - gone));
    caps(g, t, [[0.3, 'Alto: весь мир — из пяти красок'], [3.8, 'Шестой, кислотный — и мир будто сломался'], [5.8, 'Пять цветов — и мир цельный']], { y: 30, bg: '#2b2d5a', col: '#f2efe6' });
  };

  const MOODS = [
    { name: 'Закат', sky: ['#ff8a5c', '#ffcf7a'], sun: '#fff3d6', far: '#c8668a', mid: '#6a4c93', snow: '#f2efe6', tree: '#2b2d5a', hero: '#2b2d5a', scarf: '#ff5d5d', fx: 'sun', plate: '#2b2d5a', ink: '#ffcf7a' },
    { name: 'Ночь', sky: ['#0b0f2e', '#2b2d5a'], sun: '#e8eefc', far: '#262a5e', mid: '#1b1d46', snow: '#8fa6d6', tree: '#0b0d24', hero: '#0b0d24', scarf: '#ff8a5c', fx: 'night', plate: '#0b0d24', ink: '#e8eefc' },
    { name: 'Буран', sky: ['#9aa7b0', '#dfe5e8'], sun: '#eef2f4', far: '#8f9ca6', mid: '#76848f', snow: '#f4f7f8', tree: '#4a5761', hero: '#33404a', scarf: '#e0603f', fx: 'storm', plate: '#4a5761', ink: '#f4f7f8' },
    { name: 'Game Boy', sky: ['#9bbc0f', '#9bbc0f'], sun: '#8bac0f', far: '#8bac0f', mid: '#306230', snow: '#9bbc0f', tree: '#0f380f', hero: '#0f380f', scarf: '#306230', fx: 'pixel', plate: '#0f380f', ink: '#9bbc0f' },
  ];
  function moodFrame(g, W, H, p, t, lt) {
    alto(g, W, H, p, t);
    // герой подпрыгивает на кочке: присел — взлетел — приземлился
    const x = 250, pre = bell(seg(lt, 0.45, 0.65)), jump = bell(seg(lt, 0.65, 1.35)), land = bell(seg(lt, 1.35, 1.55));
    for (let j = 0; j < 4; j++) alpha(g, 0.35, () => line(g, x - 30 - j * 16, surf(x - 30) - 14 - j * 6 + j * 4, x - 46 - j * 16, surf(x - 46) - 14 - j * 6 + j * 4, p.tree, 2));
    boarder(g, x, surf(x) + 1 - jump * 30, slope(x) - jump * 0.15, p.hero, p.scarf, t, pre * 0.8 + land * 0.8);
    if (p.fx === 'storm') {
      alpha(g, 0.18, () => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); });
      for (let i = 0; i < 70; i++) { const sp = 260 + pr(i) * 260, x0 = ((pr(i + 7) * W * 1.4 - t * sp) % (W * 1.4) + W * 1.4) % (W * 1.4), y0 = (pr(i + 3) * H + t * sp * 0.35) % H; alpha(g, 0.5 + 0.4 * pr(i + 11), () => line(g, x0, y0, x0 + 14, y0 - 5, '#ffffff', 1.6)); }
    }
    if (p.fx === 'pixel') { g.fillStyle = 'rgba(15,56,15,.12)'; for (let x = 0; x < W; x += 4) g.fillRect(x, 0, 1, H); for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1); }
    // название настроения — крупно
    const k = ob(seg(lt, 0.05, 0.5)), w = tw(g, p.name, 32) + 40;
    g.save(); g.translate(16 - (1 - k) * 60, 18); g.globalAlpha = clamp(k, 0, 1); rr(g, 0, 0, w, 52, 12, p.plate); text(g, p.name, w / 2, 27, p.ink, 32); g.restore();
  }
  MOTION['mood-shift'] = (g, t, W, H) => {
    t %= 10; const m = Math.floor(t / 2.5), lt = t - m * 2.5, fk = io(seg(lt, 1.9, 2.5));
    moodFrame(g, W, H, MOODS[m], t, lt);
    if (fk > 0) { const o = offCtx(W, H); moodFrame(o, W, H, MOODS[(m + 1) % 4], t, lt - 2.5); g.save(); g.globalAlpha = fk; g.drawImage(OFF, 0, 0); g.restore(); }
    // полоска настроений
    MOODS.forEach((q, i) => { const on = i === m; rr(g, 452 + i * 44, 22, 36, 14, 7, on ? q.ink : 'rgba(255,255,255,.35)', on ? q.plate : null); });
    caps(g, t, [[0.3, 'Геометрия та же — меняются только цвет, свет и частицы']], { bg: 'rgba(20,20,40,.82)', col: '#f2efe6' });
  };

  // силуэты: m — цвет заливки целиком (тень) или null (в цвете)
  const SIL = [
    { name: 'здоровяк', h: 106, draw(g, x, y, m) {
      const c = k => m || k;
      disc(g, x - 24, y - 92, 12, c('#8a5a3a')); disc(g, x + 24, y - 92, 12, c('#8a5a3a'));
      rr(g, x - 38, y - 12, 26, 14, 7, c('#7a4a2a')); rr(g, x + 12, y - 12, 26, 14, 7, c('#7a4a2a'));
      disc(g, x, y - 52, 50, c('#b07a4a'));
      if (!m) { disc(g, x, y - 40, 30, '#e6c08a'); disc(g, x - 16, y - 72, 4, '#2b2d5a'); disc(g, x + 16, y - 72, 4, '#2b2d5a'); disc(g, x, y - 62, 6, '#2b2d5a'); }
    } },
    { name: 'жердь', h: 172, draw(g, x, y, m) {
      const c = k => m || k;
      rr(g, x - 8, y - 62, 6, 62, 3, c('#2b2d5a')); rr(g, x + 2, y - 62, 6, 62, 3, c('#2b2d5a'));
      line(g, x - 8, y - 106, x - 26, y - 60, c('#6a4c93'), 5); line(g, x + 8, y - 106, x + 24, y - 64, c('#6a4c93'), 5);
      rr(g, x - 11, y - 114, 22, 58, 9, c('#6a4c93'));
      disc(g, x, y - 126, 11, c('#f0c8a0'));
      rr(g, x - 17, y - 136, 34, 6, 3, c('#2b2d5a')); rr(g, x - 10, y - 172, 20, 38, 3, c('#2b2d5a'));
      if (!m) { g.fillStyle = '#ff8a5c'; g.fillRect(x - 10, y - 144, 20, 5); disc(g, x - 4, y - 127, 1.8, '#2b2d5a'); disc(g, x + 4, y - 127, 1.8, '#2b2d5a'); }
    } },
    { name: 'колючка', h: 96, draw(g, x, y, m) {
      const c = k => m || k;
      for (let j = 0; j < 9; j++) { const a = Math.PI + 0.15 + j * (Math.PI - 0.3) / 8, bx = x + Math.cos(a) * 30, by = y - 38 + Math.sin(a) * 30; poly(g, [[bx + Math.cos(a + 1.4) * 9, by + Math.sin(a + 1.4) * 9], [x + Math.cos(a) * 58, y - 38 + Math.sin(a) * 58], [bx + Math.cos(a - 1.4) * 9, by + Math.sin(a - 1.4) * 9]], c('#4a3b2a')); }
      disc(g, x, y - 36, 34, c('#8a6a4a')); rr(g, x - 22, y - 8, 14, 10, 5, c('#4a3b2a')); rr(g, x + 8, y - 8, 14, 10, 5, c('#4a3b2a'));
      if (!m) { disc(g, x, y - 30, 18, '#e6c08a'); disc(g, x - 8, y - 40, 3, '#2b2d5a'); disc(g, x + 8, y - 40, 3, '#2b2d5a'); disc(g, x, y - 30, 4.5, '#2b2d5a'); }
    } },
    { name: 'ушастик', h: 118, draw(g, x, y, m) {
      const c = k => m || k;
      [[-8, -0.18], [9, 0.22]].forEach(([dx, a]) => { g.save(); g.translate(x + dx, y - 64); g.rotate(a); g.fillStyle = c('#b9a0e0'); g.beginPath(); g.ellipse(0, -26, 7, 28, 0, 0, TAU); g.fill(); if (!m) { g.fillStyle = '#ffb3c7'; g.beginPath(); g.ellipse(0, -26, 3.5, 20, 0, 0, TAU); g.fill(); } g.restore(); });
      disc(g, x + 18, y - 14, 7, c('#f2efe6')); disc(g, x, y - 20, 20, c('#b9a0e0')); disc(g, x, y - 54, 16, c('#b9a0e0'));
      if (!m) { disc(g, x, y - 16, 11, '#f2efe6'); disc(g, x - 6, y - 56, 2.5, '#2b2d5a'); disc(g, x + 6, y - 56, 2.5, '#2b2d5a'); disc(g, x, y - 49, 2.5, '#ff8fa3'); }
    } },
  ];
  // плохая пара: одна форма, отличаются только узором
  function blob(g, x, y, m, kind) {
    const base = m || (kind ? '#ff8fa3' : '#5fc2b8');
    rr(g, x - 30, y - 78, 60, 78, 28, base); disc(g, x, y - 96, 22, m || '#f0c8a0');
    if (!m) {
      g.save(); rr(g, x - 30, y - 78, 60, 78, 28); g.clip();
      if (kind) for (let j = 0; j < 9; j++) disc(g, x - 22 + (j % 3) * 22, y - 64 + Math.floor(j / 3) * 22, 5, '#fff3f6');
      else for (let j = 0; j < 5; j++) { g.fillStyle = '#2b8f86'; g.fillRect(x - 30, y - 74 + j * 16, 60, 7); }
      g.restore(); disc(g, x - 7, y - 98, 2.5, '#2b2d5a'); disc(g, x + 7, y - 98, 2.5, '#2b2d5a');
    }
  }
  MOTION.silhouette = (g, t, W, H) => {
    t %= 9.5; sky(g, W, H, '#f2efe6', '#ffd99a');
    const GY = 232, INK = '#16141f';
    g.fillStyle = '#6a4c93'; g.fillRect(0, GY, W, H - GY);
    const out = 1 - seg(t, 5.0, 5.4);
    if (out > 0) alpha(g, out, () => SIL.forEach((c, i) => {
      const x = 92 + i * 152, k = ob(seg(t, 0.2 + i * 0.25, 0.6 + i * 0.25)), fill = io(seg(t, 2.3 + i * 0.25, 3.1 + i * 0.25)); if (k <= 0) return;
      g.save(); g.translate(x, GY); g.scale(k, k); g.translate(-x, -GY);
      c.draw(g, x, GY, null);
      if (fill > 0) { g.save(); g.beginPath(); g.rect(x - 90, GY + 2 - (c.h + 12) * fill, 180, (c.h + 12) * fill + 2); g.clip(); c.draw(g, x, GY, INK); g.restore(); }
      g.restore();
      text(g, c.name, x, GY + 16, '#f2efe6', 14);
      tick(g, x + 38, GY - c.h - 4, 9, seg(t, 3.6 + i * 0.2, 4.0 + i * 0.2));
    }));
    if (t > 5.3) {
      const k = ob(seg(t, 5.4, 5.9)), fill = io(seg(t, 6.4, 7.1));
      [[250, 0, 'полосатый'], [390, 1, 'в горошек']].forEach(([x, kind, name]) => {
        g.save(); g.translate(x, GY); g.scale(k, k); g.translate(-x, -GY);
        blob(g, x, GY, null, kind);
        if (fill > 0) { g.save(); g.beginPath(); g.rect(x - 60, GY + 2 - 132 * fill, 120, 132 * fill + 2); g.clip(); blob(g, x, GY, INK, kind); g.restore(); }
        g.restore(); text(g, name, x, GY + 16, '#f2efe6', 14);
      });
      if (t > 7.2) { const e = ob(seg(t, 7.2, 7.5)); g.save(); g.translate(320, 170); g.scale(e, e); text(g, '=', 0, 0, INK, 44); g.restore(); }
      cross(g, 320, 150, 70, seg(t, 7.6, 8.1), '#ff4d5e', 'rgba(255,255,255,.8)');
    }
    caps(g, t, [[0.3, 'Силуэт: героя узнают даже по тени'], [5.4, 'А эти двое отличаются только узором…'], [7.2, 'В тени — одно пятно: такой силуэт не читается']], { bg: 'rgba(43,45,90,.9)', col: '#f2efe6' });
    fade(g, W, H, t, 9.5, '#f2efe6');
  };

  // приглушённый мир и герой с красным шарфом
  function townsman(g, x, y, body, t, ph) { const b = Math.abs(Math.sin(t * 4 + ph)) * 2; rr(g, x - 7, y - 30 - b, 14, 24, 6, body); disc(g, x, y - 37 - b, 7, '#b8aca2'); line(g, x - 3, y - 7, x - 4, y, body, 4); line(g, x + 3, y - 7, x + 4, y, body, 4); }
  MOTION['hero-colour'] = (g, t, W, H) => {
    t %= 9; sky(g, W, H, '#bfc4c6', '#dcd8cf');
    const RED = '#ff3030', cam = 30 * t, hxW = 200 + 22 * t, GY = 222, S = 1.45, scr = (x, y) => [(x - cam) * S, 300 - (300 - y) * S];
    g.save(); g.translate(0, 300); g.scale(S, S); g.translate(-cam * 0.4, -300);
    poly(g, [[0, 170], [120, 120], [260, 160], [400, 110], [560, 150], [700, 112], [860, 160], [1000, 120], [1100, 150], [1100, 300], [0, 300]], '#adb2ad'); g.restore();
    g.save(); g.translate(0, 300); g.scale(S, S); g.translate(-cam, -300);
    g.beginPath(); g.moveTo(0, 300); for (let x = 0; x <= 1100; x += 10) g.lineTo(x, 196 + 10 * Math.sin(x / 80)); g.lineTo(1100, 300); g.closePath(); g.fillStyle = '#979d95'; g.fill();
    g.fillStyle = '#a8a593'; g.fillRect(0, GY, 1100, 80);
    [60, 330, 610, 880].forEach((x, i) => { g.fillStyle = '#b3ada3'; g.fillRect(x, GY - 54, 70, 54); poly(g, [[x - 8, GY - 52], [x + 35, GY - 82], [x + 78, GY - 52]], '#8d8781'); g.fillStyle = '#7f8a8e'; g.fillRect(x + 12, GY - 40, 14, 14); g.fillRect(x + 44, GY - 40, 14, 14); g.fillStyle = '#8a8178'; g.fillRect(x + 28, GY - 26, 14, 26); });
    [250, 540, 780, 1040].forEach(x => { g.fillStyle = '#7a7068'; g.fillRect(x - 3, GY - 30, 6, 30); disc(g, x, GY - 44, 20, '#7f8a7f'); disc(g, x - 12, GY - 34, 13, '#7f8a7f'); disc(g, x + 12, GY - 34, 13, '#7f8a7f'); });
    [[120, '#8a8f9a'], [380, '#9a8f84'], [560, '#7f8a86'], [700, '#8f8a9a'], [830, '#958a80']].forEach(([x, c], i) => townsman(g, x, GY, c, t, i));
    // цветок появляется — и спорит с героем за взгляд
    const fx = 430, fk = ob(seg(t, 3.9, 4.3)), drain = io(seg(t, 6.6, 7.2));
    if (fk > 0) { g.save(); g.translate(fx + 40, GY); g.scale(fk, fk); line(g, 0, 0, 0, -26, '#7f8a7f', 3); for (let j = 0; j < 5; j++) { const a = j * TAU / 5 + 0.3; disc(g, Math.cos(a) * 8, -32 + Math.sin(a) * 8, 7, mix(RED, '#a99c9a', drain)); } disc(g, 0, -32, 4.5, mix('#ffe070', '#bdb6a4', drain)); g.restore(); }
    // герой
    const b = Math.abs(Math.sin(t * 5)) * 2;
    rr(g, hxW - 8, GY - 32 - b, 16, 26, 6, '#5c6470'); disc(g, hxW, GY - 40 - b, 8, '#cdbfb2'); line(g, hxW - 3, GY - 7, hxW - 5, GY, '#5c6470', 4); line(g, hxW + 3, GY - 7, hxW + 5, GY, '#5c6470', 4);
    g.strokeStyle = RED; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(hxW + 6, GY - 31 - b); g.lineTo(hxW - 6, GY - 31 - b); for (let i = 1; i <= 4; i++) g.lineTo(hxW - 6 - i * 6, GY - 30 - b + Math.sin(t * 8 + i) * 2 * i * 0.6 + i); g.stroke();
    g.restore();
    // взгляд игрока — рамка-прицел
    const hs = scr(hxW, GY - 30), fs = scr(fx + 40, GY - 32);
    let tx = hs[0], ty = hs[1];
    const lock = ob(seg(t, 0.1, 0.55)); tx = lerp(320, hs[0], lock); ty = lerp(110, hs[1], lock);
    const conf = tent(t, 4.2, 4.5, 6.3, 6.8);
    if (conf > 0) { const w = 0.5 + 0.5 * Math.sin((t - 4.2) * 7); tx = lerp(tx, lerp(hs[0], fs[0], w), conf); ty = lerp(ty, lerp(hs[1], fs[1], w) + Math.sin(t * 23) * 4, conf); }
    const r = 30 * (1 + 0.3 * bell(seg(t, 0.5, 0.8)) + 0.3 * bell(seg(t, 6.8, 7.1)));
    g.strokeStyle = 'rgba(43,45,90,.55)'; g.lineWidth = 7; g.beginPath(); g.arc(tx, ty, r, 0, TAU); g.stroke();
    g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.beginPath(); g.arc(tx, ty, r, 0, TAU); g.stroke();
    g.save(); g.translate(tx + r * 0.75, ty - r * 0.85); disc(g, 0, 0, 11, '#2b2d5a'); g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(0, 0, 7, 4.2, 0, 0, TAU); g.fill(); disc(g, 0, 0, 2.6, '#2b2d5a'); g.restore();
    if (conf > 0.5) alpha(g, conf, () => { const q = Math.floor(t * 4) % 2; disc(g, tx - r - 4, ty - r + (q ? 0 : 4), 10, '#2b2d5a'); text(g, '?', tx - r - 4, ty - r + 1 + (q ? 0 : 4), '#ffffff', 14); });
    cross(g, fs[0], fs[1] - 4, 18, seg(t, 6.0, 6.4) * (1 - seg(t, 7.6, 8.0)), '#2b2d5a', '#ffffff');
    caps(g, t, [[0.3, 'Мир приглушён — глаз сразу находит героя'], [4.0, 'Красный цветок — и взгляд уже мечется'], [6.8, 'Цвет героя есть только у героя']], { bg: 'rgba(43,45,90,.88)', col: '#f2efe6' });
    fade(g, W, H, t, 9, '#bfc4c6');
  };

  /* =================== урок 22: игра о чувстве =================== */
  // палитра: мягкая пастель — розовый, небесный, мятный, чернильный
  const C22 = { pink: '#ffb3c7', sky: '#a8e0ff', mint: '#c9f2c7', ink: '#4a3b6b', lav: '#d9c8ff', peach: '#ffd8b0' };
  function pastel(g, W, H, t, a, b) {
    sky(g, W, H, a, b);
    for (let i = 0; i < 9; i++) { const x = pr(i) * W, y = 40 + pr(i + 4) * 200 + Math.sin(t * 0.6 + i) * 10, r = 30 + pr(i + 8) * 50; alpha(g, 0.28, () => disc(g, x, y, r, [C22.pink, C22.sky, C22.mint, C22.lav][i % 4])); }
  }
  // мягкий человечек: (x, y) — низ
  function buddy(g, x, y, s, col, o = {}) {
    g.save(); g.translate(x, y); g.scale(1 + (o.sq || 0) * 0.15, 1 - (o.sq || 0) * 0.15);
    rr(g, -s * 0.62, -s * 1.5, s * 1.24, s * 1.5, s * 0.55, col);
    disc(g, 0, -s * 1.9, s * 0.55, o.skin || '#ffe2cf');
    if (o.hair) { g.beginPath(); g.arc(0, -s * 1.97, s * 0.6, Math.PI * 1.02, Math.PI * 1.98); g.closePath(); g.fillStyle = o.hair; g.fill(); }
    const d = o.dir || 0;
    disc(g, -s * 0.18 + d * s * 0.12, -s * 1.86, s * 0.075, C22.ink); disc(g, s * 0.18 + d * s * 0.12, -s * 1.86, s * 0.075, C22.ink);
    alpha(g, 0.7, () => { disc(g, -s * 0.33 + d * s * 0.1, -s * 1.7, s * 0.1, '#ff8fab'); disc(g, s * 0.33 + d * s * 0.1, -s * 1.7, s * 0.1, '#ff8fab'); });
    g.restore();
  }
  function piece(g, x, y, s, col) { rr(g, x - s / 2, y - s / 2, s, s, 4, col); disc(g, x + s / 2, y, s * 0.18, col); disc(g, x, y - s / 2, s * 0.18, col); }

  MOTION['florence-puzzle'] = (g, t, W, H) => {
    t %= 10; pastel(g, W, H, t, '#fff0f4', '#eefaf0');
    const R = [{ n: 6, c: 3, r: 2, who: 0, a: 0.4 }, { n: 4, c: 2, r: 2, who: 1, a: 3.0 }, { n: 2, c: 2, r: 1, who: 0, a: 5.0 }, { n: 1, c: 1, r: 1, who: 1, a: 6.4 }];
    const DI = 0.27, popAt = q => q.a + 0.35 + (q.n === 1 ? 0.12 : q.n * DI + 0.15);
    let close = 0; R.forEach(q => { close += io(seg(t, popAt(q) + 0.1, popAt(q) + 0.7)); });
    const GY = 240, lx = lerp(150, 274, close / 4), rx = lerp(490, 366, close / 4);
    g.fillStyle = '#d9f0d0'; g.beginPath(); g.ellipse(320, GY + 30, 330, 36, 0, 0, TAU); g.fill();
    const talk = q => t > q.a && t < popAt(q) + 0.3;
    buddy(g, lx, GY, 34, C22.pink, { hair: '#8a4a6a', dir: 1, sq: R.some(q => q.who === 0 && talk(q)) ? 0.25 * Math.abs(Math.sin(t * 10)) : 0 });
    buddy(g, rx, GY, 34, C22.sky, { hair: C22.ink, dir: -1, sq: R.some(q => q.who === 1 && talk(q)) ? 0.25 * Math.abs(Math.sin(t * 10)) : 0 });
    const PC = [C22.pink, '#8fd0ff', '#9fe39a', '#c0a8ff', '#ffc890', '#ff9fb8'];
    R.forEach((q, ri) => {
      const pa = popAt(q), pk = seg(t, pa, pa + 0.35); if (t < q.a || pk >= 1) return;
      const sx = q.who ? rx : lx, bx = sx + (q.who ? -44 : 44), w = q.c * 34 + 22, h = q.r * 34 + 22, by = 150 - h / 2 - 8;
      const kin = ob(seg(t, q.a, q.a + 0.3));
      g.save(); g.translate(bx, by + h / 2); g.scale(kin * (1 + 0.35 * pk), kin * (1 + 0.35 * pk)); g.globalAlpha = 1 - pk; g.translate(-bx, -by - h / 2);
      rr(g, bx - w / 2, by, w, h, 16, '#ffffff', C22.ink); poly(g, [[sx + (q.who ? -6 : 6), by + h + 14], [bx - 8, by + h - 1], [bx + 8, by + h - 1]], '#ffffff');
      for (let j = 0; j < q.n; j++) {
        const cx = bx - w / 2 + 28 + (j % q.c) * 34, cy = by + 28 + Math.floor(j / q.c) * 34;
        g.setLineDash([3, 4]); g.strokeStyle = 'rgba(74,59,107,.4)'; g.lineWidth = 2; g.strokeRect(cx - 12, cy - 12, 24, 24); g.setLineDash([]);
        const st = q.a + 0.35 + j * DI, fk = ob(seg(t, st, st + (q.n === 1 ? 0.12 : 0.25)));
        if (t >= st) piece(g, lerp(sx + (j - 2) * 14, cx, fk), lerp(300, cy, fk), 24, PC[(j + ri) % PC.length]);
      }
      g.restore();
      if (pk > 0) for (let j = 0; j < 8; j++) { const a = j * TAU / 8, d = 30 + 50 * oc(pk); alpha(g, 1 - pk, () => disc(g, bx + Math.cos(a) * d, by + h / 2 + Math.sin(a) * d * 0.7, 4, PC[j % 6])); }
    });
    // сколько кусочков нужно сейчас
    const cur = R.filter(q => t >= q.a).pop() || R[0], ck = bell(seg(t, cur.a, cur.a + 0.3));
    g.save(); g.translate(92, 34); g.scale(1 + 0.15 * ck, 1 + 0.15 * ck); rr(g, -76, -18, 152, 36, 12, '#ffffff', C22.ink); piece(g, -52, 1, 16, C22.pink); text(g, 'кусочков: ' + cur.n, 12, 1, C22.ink, 15); g.restore();
    if (t > 7.0) { const k = ob(seg(t, 7.0, 7.5)), mx = (lx + rx) / 2; g.save(); g.translate(mx, 168); g.scale(k * (1 + 0.08 * Math.sin(t * 6)), k * (1 + 0.08 * Math.sin(t * 6))); heart(g, 0, 0, 22, '#ff6f91'); g.restore(); for (let j = 0; j < 5; j++) { const u = ((t - 7.0) * 0.5 + j * 0.2) % 1; alpha(g, bell(u), () => heart(g, mx - 40 + j * 20 + Math.sin(t * 2 + j) * 6, 160 - u * 70, 7, '#ff8fab')); } }
    caps(g, t, [[0.3, 'Florence: чтобы сказать — собери пазл'], [3.0, 'С каждым разом кусочков всё меньше'], [7.0, 'Говорить легче — механика сама показывает близость']], { bg: 'rgba(74,59,107,.9)', col: '#fff4f8' });
    fade(g, W, H, t, 10, '#fff0f4');
  };

  MOTION['passage-life'] = (g, t, W, H) => {
    t %= 10; pastel(g, W, H, t, '#f6f0ff', '#fff4ec');
    const X0 = 20, X1 = 620, Y0 = 116, Y1 = 176, CY = 146;
    const life = seg(t, 0.3, 8.4), k = 1 - Math.pow(1 - life, 1.8), hx = 44 + 516 * k;
    const grey = '#b8b0c4';
    // полоска-жизнь: краски тускнеют к старости
    rr(g, X0 - 5, Y0 - 5, X1 - X0 + 10, Y1 - Y0 + 10, 9, C22.ink);
    g.save(); rr(g, X0, Y0, X1 - X0, Y1 - Y0, 5); g.clip();
    const gr = g.createLinearGradient(X0, 0, X1, 0); gr.addColorStop(0, '#c9f2c7'); gr.addColorStop(0.45, '#ffe0c0'); gr.addColorStop(1, '#d6cfdc'); g.fillStyle = gr; g.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
    for (let i = 0; i < 46; i++) { const x = X0 + 6 + pr(i) * 588, y = Y0 + 5 + pr(i + 1) * 50; disc(g, x, y, 1.8 + pr(i + 2) * 2.2, mix([C22.pink, '#7fc8f0', '#8fd88a', '#ffc070'][i % 4], grey, (x - X0) / 600)); }
    // стены: у первой широкий проход, у второй — узкий, вдвоём не пройти
    g.fillStyle = '#7a6a9a'; g.fillRect(262, Y0, 12, 140 - Y0); g.fillRect(394, Y0, 12, 137 - Y0); g.fillRect(394, 155, 12, Y1 - 155); g.fillRect(500, 150, 12, Y1 - 150);
    // напарник ждёт, потом идут вместе
    const join = seg(hx, 150, 190), lag = tent(hx, 352, 390, 418, 452), sh = tent(hx, 226, 256, 276, 300);
    const offY = 8 * join * (1 - lag), py = lerp(CY - 14, CY - offY + sh * 12, join), hy = CY + offY + sh * 12;
    const pxp = join < 1 ? lerp(196, hx, join) : hx - lag * 22;
    const step = Math.abs(Math.sin(k * 70)) * 2.2 * (1 - life * 0.6), dead = seg(t, 8.4, 8.9);
    alpha(g, 1 - dead, () => {
      if (join > 0.2 && join < 1) heart(g, (hx + pxp) / 2, CY - 26 - join * 6, 7 * bell(join), '#ff6f91');
      disc(g, pxp, py - (join >= 1 ? step : 0), 6, mix('#4fb0ea', grey, life)); disc(g, pxp - 1.5, py - 2 - (join >= 1 ? step : 0), 1.6, '#ffffff');
      disc(g, hx, hy - step, 6, mix('#ff6f9a', grey, life)); disc(g, hx + 1.5, hy - 2 - step, 1.6, '#ffffff');
    });
    if (hx > 368 && hx < 400) { const q = bell(seg(hx, 368, 400)); g.save(); g.translate(378, Y0 + 12); g.scale(q, q); disc(g, 0, 0, 9, '#ff6f91'); text(g, '!', 0, 1, '#ffffff', 13); g.restore(); }
    // надгробие
    if (dead > 0) { const r = ob(seg(t, 8.5, 9.0)); g.save(); g.translate(hx, Y1 - 4); g.scale(r, r); rr(g, -10, -28, 20, 28, 9, '#9a90a8'); g.fillStyle = '#9a90a8'; g.fillRect(-10, -14, 20, 14); line(g, 0, -22, 0, -10, '#ece6f2', 2); line(g, -4, -18, 4, -18, '#ece6f2', 2); disc(g, 15, -4, 3.5, C22.pink); g.restore(); }
    g.restore();
    // этапы жизни над полоской
    [['детство', 70], ['вместе', 196], ['трудности', 396], ['старость', 540]].forEach(([s, x]) => {
      const q = ob(seg(hx, x - 30, x - 8)); if (q <= 0) return; g.save(); g.translate(x, 98); g.scale(q, q); text(g, s, 0, 0, mix('#4a3b6b', '#8a80a0', x / 600), 14); g.restore();
    });
    if (hx > 360) { const q = ob(seg(hx, 360, 384)); alpha(g, Math.min(1, q), () => { line(g, 400, 182, 400, 192, C22.ink, 2); text(g, 'вдвоём тут не пройти', 400, 202, C22.ink, 13, 'center', 700); }); }
    alpha(g, 0.55, () => { arrow(g, 40, 232, 600, 232, '#8a80a0', 2); text(g, 'время', 320, 222, '#8a80a0', 12, 'center', 700); });
    caps(g, t, [[0.3, 'Passage: вся жизнь — пять минут в узкой полоске'], [6.4, 'Механика — и есть высказывание']], { bg: 'rgba(74,59,107,.9)', col: '#fff4f8' });
    fade(g, W, H, t, 10, '#f6f0ff');
  };

  // росток, горшок, лейка
  function sprout(g, x, y, s, lean, wilt) {
    const len = 42 * s, a = lean + wilt * 1.3, tx = x + Math.sin(a) * len, ty = y - Math.cos(a) * len * (1 - wilt * 0.25), c = mix('#4fb862', '#b8945a', wilt);
    g.strokeStyle = c; g.lineWidth = 4 * s; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.sin(lean) * len * 0.4, y - len * 0.6, tx, ty); g.stroke();
    [-1, 1].forEach(d => { g.save(); g.translate(tx, ty); g.rotate(a + d * (0.9 + wilt * 0.7)); g.fillStyle = c; g.beginPath(); g.ellipse(0, -9 * s, 5.5 * s, 10 * s, 0, 0, TAU); g.fill(); g.restore(); });
    return [tx, ty];
  }
  function pot(g, x, y) { poly(g, [[x - 22, y - 26], [x + 22, y - 26], [x + 16, y], [x - 16, y]], '#f0a58a'); rr(g, x - 25, y - 32, 50, 9, 3, '#f7bfa8'); }
  function can(g, x, y, ang, col = '#7cc4f5') {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.strokeStyle = col; g.lineWidth = 5; g.beginPath(); g.arc(-18, -2, 11, Math.PI * 0.5, Math.PI * 1.5); g.stroke();
    rr(g, -18, -14, 36, 28, 7, col); line(g, 16, -2, 36, -16, col, 6); rr(g, 33, -22, 10, 10, 3, col); g.restore();
    return [x + Math.cos(ang) * 40 - Math.sin(ang) * -17, y + Math.sin(ang) * 40 + Math.cos(ang) * -17];
  }
  function drops(g, from, to, lt, col = '#5fb0f0') { for (let j = 0; j < 5; j++) { const u = (lt * 1.6 + j / 5) % 1; disc(g, lerp(from[0], to[0], u), lerp(from[1], to[1], u) + u * u * 8, 2.6, col); } }
  const FEEL = [
    { name: 'Забота', sub: 'тянется к тебе', col: '#4fbf72', bg: '#effcef' },
    { name: 'Тревога', sub: 'сохнет очень быстро', col: '#ff5d7a', bg: '#fff1f4' },
    { name: 'Вина', sub: 'вянет, пока ты занят', col: '#8a6fe0', bg: '#f4f0ff' },
  ];
  MOTION['one-mechanic-many-feelings'] = (g, t, W, H) => {
    t %= 9; pastel(g, W, H, t, '#fbf8ff', '#f0f8ff');
    const act = Math.floor(t / 3);
    FEEL.forEach((f, i) => {
      const x = 18 + i * 206, w = 192, y = 52, h = 186, on = i === act, lt = on ? t - act * 3 : 1.2, cx = x + w / 2, k = on ? ob(seg(lt, 0, 0.35)) : 0;
      g.save(); g.translate(cx, y + h / 2); g.scale(1 + 0.04 * k, 1 + 0.04 * k); g.translate(-cx, -y - h / 2);
      rr(g, x + 3, y + 5, w, h, 16, 'rgba(74,59,107,.12)'); rr(g, x, y, w, h, 16, f.bg, on ? f.col : 'rgba(74,59,107,.2)'); if (on) { g.strokeStyle = f.col; g.lineWidth = 4; rr(g, x, y, w, h, 16); g.stroke(); }
      text(g, f.name, cx, y + 22, f.col, 19);
      const px = cx + 22, py = y + 160;
      if (i === 0) {
        const lean = -0.45 * io(seg(lt, 0.3, 1.2)) + Math.sin(lt * 3) * 0.05, tip = sprout(g, px, py - 30, 1.1, lean, 0); pot(g, px, py);
        const sp = can(g, cx - 50, y + 70, 0.55); drops(g, sp, [px - 6, py - 34], lt);
        for (let j = 0; j < 3; j++) { const u = (lt * 0.6 + j / 3) % 1; alpha(g, bell(u), () => heart(g, tip[0] - 8 + j * 10, tip[1] - 14 - u * 26, 6, '#ff7f9e')); }
      }
      if (i === 1) {
        const lvl = 1 - ((lt * 0.9) % 1), shake = lvl < 0.35 ? Math.sin(lt * 50) * 2 : 0;
        sprout(g, px + shake, py - 30, 1.1, 0.1, 0.5 * (1 - lvl)); pot(g, px + shake, py);
        const sp = can(g, cx - 50, y + 70, 0.55); drops(g, sp, [px - 6, py - 34], lt * 1.8, '#5fb0f0');
        rr(g, cx - 70, y + 40, 140, 12, 6, '#ffe0e6'); rr(g, cx - 70, y + 40, Math.max(12, 140 * lvl), 12, 6, f.col);
        if (lvl < 0.35) { const q = 1 + 0.2 * Math.sin(lt * 18); g.save(); g.translate(cx + 80, y + 46); g.scale(q, q); disc(g, 0, 0, 9, f.col); text(g, '!', 0, 1, '#ffffff', 13); g.restore(); }
      }
      if (i === 2) {
        const wl = 0.3 + 0.5 * io(seg(lt, 0.2, 2.2)); sprout(g, px - 34, py - 30, 1.0, 0, wl); pot(g, px - 34, py);
        const blink = Math.floor(lt * 4) % 2, bx = cx + 58, by = y + 74;
        disc(g, bx, by, 18, blink ? f.col : '#c9bdf0'); poly(g, [[bx - 9, by + 6], [bx - 7, by - 6], [bx, by - 11], [bx + 7, by - 6], [bx + 9, by + 6]], '#ffffff'); disc(g, bx, by + 9, 2.6, '#ffffff');
        const sp = can(g, cx - 4, y + 96, -0.35); drops(g, sp, [bx - 14, by + 16], lt);
      }
      text(g, f.sub, cx, y + h - 12, '#4a3b6b', 13, 'center', 700);
      g.restore();
      if (!on) alpha(g, 0.45, () => rr(g, x, y, w, h, 16, '#fbf8ff'));
    });
    cap(g, 'Один глагол — «поливать» — три разных правила', t, 0.1, { y: 26, bg: 'rgba(74,59,107,.9)', col: '#fff4f8' });
    caps(g, t, [[0.4, 'Правило меняет чувство — а действие то же самое']], { bg: 'rgba(74,59,107,.9)', col: '#fff4f8' });
    fade(g, W, H, t, 9, '#fbf8ff');
  };

  MOTION['quiet-end'] = (g, t, W, H) => {
    t %= 10; pastel(g, W, H, t, '#f3eefc', '#fff3f6');
    const X = 70, Y = 18, w = 500, h = 228, TX = 430, GY = 200;
    rr(g, X - 9, Y - 9, w + 18, h + 18, 20, C22.ink);
    g.save(); rr(g, X, Y, w, h, 12); g.clip();
    sky(g, W, H, '#bfe6ff', '#ffe3ec'); disc(g, 160, 70, 22, '#fff6d8'); soft(g, 160, 70, 70, '255,246,216', 0.8);
    g.fillStyle = '#bfeec0'; g.beginPath(); g.ellipse(X + w * 0.62, Y + h + 50, 330, 106, 0, 0, TAU); g.fill();
    g.fillStyle = '#d6f6d0'; g.beginPath(); g.ellipse(X + 80, Y + h + 60, 220, 86, 0, 0, TAU); g.fill();
    // росток становится деревом
    const grow = io(seg(t, 1.2, 3.6));
    if (t < 1.6) { const s = ob(seg(t, 0.3, 0.8)); sprout(g, TX, GY, 0.6 * s, 0, 0); }
    if (grow > 0) {
      g.strokeStyle = '#b07a5a'; g.lineWidth = 4 + 8 * grow; g.lineCap = 'round'; g.beginPath(); g.moveTo(TX, GY); g.quadraticCurveTo(TX - 6, GY - 40 * grow, TX + 2, GY - 76 * grow); g.stroke();
      [[0, -98, 34], [-30, -80, 26], [30, -82, 26], [-16, -116, 22], [18, -118, 22], [0, -70, 20]].forEach(([dx, dy, r], j) => { const k = ob(seg(t, 2.0 + j * 0.2, 2.5 + j * 0.2)); if (k > 0) disc(g, TX + dx * grow, GY + dy * grow, r * k, j % 2 ? '#ffc7d6' : C22.pink); });
    }
    // герой приходит и садится под дерево
    const wk = seg(t, 3.4, 5.6), sit = io(seg(t, 5.6, 6.0)), bx = lerp(X - 20, TX - 52, io(wk)), bob = wk > 0 && wk < 1 ? Math.abs(Math.sin(t * 9)) * 3 : 0;
    g.save(); g.translate(bx, GY + 2 - bob); g.scale(1, 1 - 0.22 * sit); buddy(g, 0, 0, 20, C22.sky, { hair: C22.ink, dir: sit > 0.5 ? 0 : 1, sq: bell(seg(t, 5.6, 5.85)) * 0.6 }); g.restore();
    // лепестки
    for (let i = 0; i < 26; i++) {
      const lt = t - 5.4 - pr(i) * 2.4; if (lt <= 0) continue;
      const u = (lt * 0.35 + pr(i + 3)) % 1, x = TX + (pr(i + 1) - 0.5) * 120 + Math.sin(lt * 2 + i) * 14 + u * 40, y = GY - 110 + u * 130;
      alpha(g, bell(u), () => { g.save(); g.translate(x, y); g.rotate(lt * 2 + i); g.fillStyle = i % 2 ? '#ff9fb8' : '#ffd0dc'; g.beginPath(); g.ellipse(0, 0, 4, 2.4, 0, 0, TAU); g.fill(); g.restore(); });
    }
    // счётчик дней — и никаких очков
    const day = 1 + Math.round(39 * io(seg(t, 0.4, 4.6)));
    rr(g, X + 12, Y + 12, 96, 28, 10, 'rgba(255,255,255,.75)'); text(g, 'день ' + day, X + 60, Y + 27, C22.ink, 14);
    // тихий финал: всё растворяется
    const f = io(seg(t, 8.0, 9.2));
    if (f > 0) alpha(g, f * 0.88, () => { g.fillStyle = '#fff0f5'; g.fillRect(X, Y, w, h); });
    if (t > 8.6) alpha(g, seg(t, 8.6, 9.2), () => text(g, 'конец', 320, Y + h / 2, C22.ink, 26, 'center', 600));
    g.restore();
    caps(g, t, [[0.3, 'Ни очков, ни «ПОБЕДЫ» — просто история'], [6.2, 'Финал без победы и поражения тоже работает']], { bg: 'rgba(74,59,107,.9)', col: '#fff4f8', y: 278 });
    fade(g, W, H, t, 10, '#f3eefc');
  };

  const LOOP = [['засыхает сам', 'тревога', '#ff5d7a'], ['тянется к тебе', 'забота', '#4fbf72'], ['ждёт, пока ты занят', 'вина', '#8a6fe0']];
  MOTION['feel-loop'] = (g, t, W, H) => {
    t %= 9; pastel(g, W, H, t, '#fbf7ff', '#eef8ff');
    const L = Math.floor(t / 3), lt = t - L * 3, [rule, feel, col] = LOOP[L];
    const cx = 320, cy = 136, rx = 200, ry = 90, pos = a => [cx + Math.cos(a * Math.PI / 180) * rx, cy + Math.sin(a * Math.PI / 180) * ry];
    g.setLineDash([2, 9]); g.strokeStyle = 'rgba(74,59,107,.4)'; g.lineWidth = 4; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.stroke(); g.setLineDash([]);
    [-30, 90, 210].forEach(a => { const [x, y] = pos(a), [x2, y2] = pos(a + 3); const ag = Math.atan2(y2 - y, x2 - x); poly(g, [[x + Math.cos(ag) * 9, y + Math.sin(ag) * 9], [x + Math.cos(ag + 2.4) * 9, y + Math.sin(ag + 2.4) * 9], [x + Math.cos(ag - 2.4) * 9, y + Math.sin(ag - 2.4) * 9]], 'rgba(74,59,107,.55)'); });
    // точка бежит по кругу: правило → действие → чувство → снова правило
    const SG = [[0.2, 0.9, -90, 30], [1.1, 1.8, 30, 150], [2.0, 2.7, 150, 270]];
    const angAt = u => { let a = -90; SG.forEach(([p, q, f, to]) => { if (u >= p) a = lerp(f, to, io(seg(u, p, q))); }); return a; };
    for (let j = 5; j >= 0; j--) { const [x, y] = pos(angAt(lt - j * 0.035)); alpha(g, 1 - j / 6, () => disc(g, x, y, 8 - j, col)); }
    { const [x, y] = pos(angAt(lt)); soft(g, x, y, 24, '255,255,255', 0.95); disc(g, x, y, 8, col); }
    // росток в центре — по правилу этого круга
    const pxp = cx, pyp = cy + 64;
    if (L === 0) { sprout(g, pxp, pyp - 30, 0.9, 0.05 + Math.sin(t * 20) * 0.03, 0.55); }
    if (L === 1) { sprout(g, pxp, pyp - 30, 0.9, 0.4 * Math.sin(lt * 1.5) + 0.25, 0); }
    if (L === 2) { sprout(g, pxp, pyp - 30, 0.9, 0, 0.75); }
    pot(g, pxp, pyp);
    const NODES = [{ a: -90, h: 'ПРАВИЛО', v: rule, at: 0 }, { a: 30, h: 'ДЕЙСТВИЕ ИГРОКА', v: 'поливаешь', at: 0.9 }, { a: 150, h: 'ЧУВСТВО', v: feel, at: 1.8 }];
    NODES.forEach((nd, i) => {
      const [x, y] = pos(nd.a), pulse = bell(seg(lt, nd.at, nd.at + 0.35)) + (i === 0 ? bell(seg(lt, 2.7, 3.0)) : 0), w = 198, h = 56;
      g.save(); g.translate(x, y); g.scale(1 + 0.1 * pulse, 1 + 0.1 * pulse);
      rr(g, -w / 2 + 3, -h / 2 + 4, w, h, 14, 'rgba(74,59,107,.15)');
      rr(g, -w / 2, -h / 2, w, h, 14, i === 2 && lt > 1.8 ? mix(col, '#ffffff', 0.75) : '#ffffff', i === 1 ? C22.ink : col);
      text(g, nd.h, 0, -13, 'rgba(74,59,107,.7)', 11, 'center', 700);
      let fl = 1, val = nd.v;
      if (i === 0) fl = ob(seg(lt, 0, 0.3));
      if (i === 2) { if (lt < 1.8) { val = '…'; fl = 1; } else fl = ob(seg(lt, 1.8, 2.1)); }
      g.save(); g.translate(0, 9); g.scale(1, Math.max(0.05, fl)); fit(g, val, 0, 0, i === 1 ? C22.ink : col, i === 2 ? 20 : 17, w - 20); g.restore();
      g.restore();
    });
    LOOP.forEach((p, i) => disc(g, 588 + i * 16, 22, i === L ? 6 : 4, i === L ? p[2] : 'rgba(74,59,107,.25)'));
    caps(g, t, [[0.2, 'Поменяй правило — поменяется и чувство']], { bg: 'rgba(74,59,107,.9)', col: '#fff4f8' });
    fade(g, W, H, t, 9, '#fbf7ff');
  };
})();
