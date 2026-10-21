// Шаги модуля 4 «Пространство и уровни» (уроки 14–18): уровень — это данные. Загружается до student.js, тот добавляет их в STEPS.
//   motion    — объяснялка с motion design: сцены-анимации на холсте и подпись, «Дальше» кнопкой, пробелом, → или A;
//   order     — квиз «Разложи уровень»: куски уровня по порядку (ввести → развить → перевернуть → завершить), после — пробежка по собранному уровню;
//   mapquiz   — квиз по картам: «Прочитай карту» (символы ↔ картинка, решение анимацией), «Найди правило генератора» (три карты растут на глазах),
//               «Куда ты пойдёшь?» (кадр на 3 секунды, потом — что повело взгляд);
//   heat      — тепловая карта своей игры: где погибали и где ходили соседи (portal.death / portal.where), отметка «здесь уровень не учит»;
//   leveledit — редактор уровня для донора урока или игры соседа: палитра из легенды игры, карта текстом и картинкой, «пройди сам», код уровня;
//   gallery   — галерея уровней класса: коды, «пройди за пар», «хочу ещё», оценка по трём вопросам, уровни гостей для автора.
// Помощники страницы ученика (S, ans, tiles, ladder, pause, hasGame, stepById, renderMain) берутся из student.js в момент вызова.
'use strict';
(function () {
  const { el, api, toast, beep } = Lab;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const io = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const ob = t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const lerp = (a, b, k) => a + (b - a) * k;
  const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const hashStr = s => [...String(s)].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0, 7);
  const rows = map => String(map || '').replace(/\r/g, '').split('\n');
  const dims = map => { const r = rows(map); return { w: Math.max(1, ...r.map(l => l.length)), h: r.length }; };
  const fast = () => !!window.LAB_FAST;
  // геймпад: новые нажатия A, B, крестовины с прошлого кадра
  function padReader() {
    let prev = [];
    return () => {
      let gp = null; try { gp = [...navigator.getGamepads()].filter(Boolean)[0]; } catch (e) { /* без геймпада */ }
      if (!gp) return {};
      const b = gp.buttons.map(x => !!(x && x.pressed)), hit = i => b[i] && !prev[i];
      const out = { a: hit(0), b: hit(1), up: hit(12), down: hit(13), left: hit(14), right: hit(15) };
      prev = b; return out;
    };
  }

  /* ---------------- холст: примитивы рисования ---------------- */
  function rr(g, x, y, w, h, r, fill, stroke) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = 2; g.stroke(); }
  }
  function text(g, s, x, y, col = '#f2efe6', px = 15, align = 'center', weight = 800) {
    g.fillStyle = col; g.font = `${weight} ${px}px system-ui,-apple-system,'Segoe UI',sans-serif`; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(s, x, y);
  }
  function disc(g, x, y, r, col) { g.beginPath(); g.arc(x, y, Math.max(0.1, r), 0, TAU); g.fillStyle = col; g.fill(); }
  function glow(g, x, y, r, col, a = 1) {
    const gr = g.createRadialGradient(x, y, 0, x, y, Math.max(1, r));
    gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = a; g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); g.globalAlpha = 1;
  }
  function sky(g, W, H, c1, c2) { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  // герой: капля с глазами, смотрит по dir
  function hero(g, x, y, s, col = '#5fe0ff', dir = 1, squash = 0) {
    g.save(); g.translate(x, y); g.scale(1 + squash * 0.25, 1 - squash * 0.25);
    disc(g, 0, 0, s, col);
    disc(g, dir * s * 0.32, -s * 0.18, s * 0.3, '#fff'); disc(g, dir * s * 0.4, -s * 0.16, s * 0.14, '#0b1020');
    g.restore();
  }
  function arrow(g, x1, y1, x2, y2, col, w = 3) {
    const a = Math.atan2(y2 - y1, x2 - x1);
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = w; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2 - Math.cos(a) * 8, y2 - Math.sin(a) * 8); g.stroke();
    g.beginPath(); g.moveTo(x2, y2); g.lineTo(x2 - Math.cos(a - 0.45) * 12, y2 - Math.sin(a - 0.45) * 12); g.lineTo(x2 - Math.cos(a + 0.45) * 12, y2 - Math.sin(a + 0.45) * 12); g.closePath(); g.fill();
  }
  function confetti(g, x, y, k, n = 18, seed = 3) {
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, v = 40 + r() * 90, cx = x + Math.cos(a) * v * k, cy = y + Math.sin(a) * v * k + 60 * k * k;
      g.fillStyle = ['#ffd23f', '#7cf5a8', '#ff5d6e', '#5fe0ff', '#b49bff'][i % 5]; g.globalAlpha = 1 - k;
      g.fillRect(cx, cy, 5, 5); g.globalAlpha = 1;
    }
  }

  /* ---------------- клетки карт: палитры уроков ---------------- */
  // символ → [цвет, вид]. Вид рисует drawTile. Палитра шага — step.palette; у игры соседа — по словам легенды (autoPalette)
  const PALETTES = {
    tropa: { '#': ['#6b5137', 'ground'], '=': ['#c8a26a', 'board'], '^': ['#ff5d6e', 'spring'], '>': ['#ff8a4c', 'springR'], '<': ['#ff8a4c', 'springL'], '*': ['#ffd23f', 'coin'], 'o': ['#b49bff', 'enemy'], 'x': ['#ff3b5c', 'spike'],
      '@': ['#5fe0ff', 'hero'], 'F': ['#7cf5a8', 'flag'], 'C': ['#ffe08a', 'check'], '%': ['#d98f5a', 'crumble'], '|': ['#bfe9ff', 'wind'], '?': ['#ffe08a', 'sign'], ' ': ['#1b2a4a', 'empty'], '.': ['#1b2a4a', 'empty'] },
    zagon: { '#': ['#8a6a44', 'fence'], '@': ['#5fe0ff', 'hero'], '$': ['#f5f1e6', 'sheep'], '.': ['#7cf5a8', 'goal'], '*': ['#f5f1e6', 'sheepGoal'], '+': ['#5fe0ff', 'heroGoal'], ' ': ['#2f5a2a', 'grass'],
      '_': ['#bfe9ff', 'ice'], 'O': ['#3a2a1a', 'hole'], 'P': ['#ffb547', 'word'], '=': ['#ffb547', 'word'], 'S': ['#ff5d6e', 'word'], '-': ['#2f5a2a', 'grass'] },
    plato: { '#': ['#5c6378', 'rock'], '.': ['#3e7a4a', 'grass'], ',': ['#d9c27a', 'path'], 'T': ['#2d6b3f', 'tree'], 'A': ['#ffe08a', 'light'], '@': ['#5fe0ff', 'hero'], 'o': ['#ffd23f', 'crumb'], 'S': ['#b49bff', 'secret'],
      'L': ['#ffb547', 'landmark'], '~': ['#3a7bd5', 'water'], '^': ['#58805a', 'hill'], ' ': ['#3e7a4a', 'grass'] },
    peshchery: { '#': ['#4a3b52', 'rock'], '.': ['#8a7a6a', 'floor'], ' ': ['#8a7a6a', 'floor'], '@': ['#5fe0ff', 'hero'], 'E': ['#7cf5a8', 'exit'], '*': ['#5fe0ff', 'crystal'], 'b': ['#b49bff', 'enemy'], '!': ['#ff5d6e', 'spike'], '~': ['#ff8a4c', 'lava'] },
  };
  const WORDS = { P: 'ПЛЕТЕНЬ', '=': 'ЕСТЬ', S: 'СТОП' };
  function autoPalette(legend) {
    const out = {}, hues = ['#ff8a4c', '#b49bff', '#5fe0ff', '#ffd23f', '#ff5d6e', '#7cf5a8', '#f5a3d7'];
    let k = 0;
    for (const [ch, name] of Object.entries(legend || {})) {
      const n = String(name).toLowerCase();
      const kind = /стен|скал|камен|забор|плетен|земл|блок|кирпич/.test(n) ? 'wall' : /геро|игрок|старт|я\b/.test(n) ? 'hero' : /цел|выход|финиш|флаг|загон|дом|двер/.test(n) ? 'goal'
        : /враг|монстр|волк|жук|летуч|охотник|угроз/.test(n) ? 'enemy' : /монет|кристал|звезд|бонус|ягод|сокров|приз/.test(n) ? 'coin' : /пружин|батут/.test(n) ? 'spring'
          : /вод|лав|яма|пропаст|шип|ловушк/.test(n) ? 'spike' : /пуст|трав|пол|воздух/.test(n) ? 'empty' : /ящик|овц|груз|камень-толк/.test(n) ? 'sheep' : 'block';
      const col = { wall: '#6b5b4a', hero: '#5fe0ff', goal: '#7cf5a8', enemy: '#b49bff', coin: '#ffd23f', spring: '#ff5d6e', spike: '#ff3b5c', empty: '#1b2a4a', sheep: '#f5f1e6' }[kind] || hues[k++ % hues.length];
      out[ch] = [col, kind];
    }
    if (!out[' ']) out[' '] = ['#1b2a4a', 'empty'];
    return out;
  }
  function drawTile(g, ch, spec, x, y, s, t = 0) {
    const [col, kind] = spec || ['#3a4880', 'block'];
    const c = x + s / 2, m = y + s / 2;
    switch (kind) {
      case 'empty': g.fillStyle = col; g.fillRect(x, y, s, s); return;
      case 'grass': g.fillStyle = col; g.fillRect(x, y, s, s); g.fillStyle = '#3b6d33'; g.fillRect(x + s * 0.2, y + s * 0.6, s * 0.08, s * 0.2); g.fillRect(x + s * 0.65, y + s * 0.3, s * 0.08, s * 0.2); return;
      case 'floor': g.fillStyle = col; g.fillRect(x, y, s, s); return;
      case 'path': g.fillStyle = '#3e7a4a'; g.fillRect(x, y, s, s); g.fillStyle = col; g.fillRect(x + s * 0.1, y + s * 0.1, s * 0.8, s * 0.8); return;
      case 'ice': g.fillStyle = col; g.fillRect(x, y, s, s); g.strokeStyle = '#ffffff88'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + s * 0.2, y + s * 0.7); g.lineTo(x + s * 0.6, y + s * 0.3); g.stroke(); return;
      case 'hole': g.fillStyle = '#2f5a2a'; g.fillRect(x, y, s, s); disc(g, c, m, s * 0.38, col); return;
      default: break;
    }
    // фон под предметом
    const under = { sheepGoal: '#7cf5a8', heroGoal: '#7cf5a8', goal: '#2f5a2a', tree: '#3e7a4a', crumb: '#3e7a4a', secret: '#3e7a4a', landmark: '#3e7a4a', light: '#3e7a4a', hill: '#3e7a4a', crystal: '#8a7a6a', exit: '#8a7a6a', lava: col, water: col }[kind];
    g.fillStyle = under || (/hero|sheep|enemy|coin|spring|flag|check|sign|wind/.test(kind) ? '#1b2a4a' : col);
    g.fillRect(x, y, s, s);
    const p = Math.sin(t * 4 + x * 0.3 + y * 0.2);
    switch (kind) {
      case 'wall': case 'ground': case 'rock': case 'fence': case 'block':
        g.fillStyle = col; g.fillRect(x, y, s, s);
        g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x, y, s, Math.max(1, s * 0.18));
        g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, y + s * 0.82, s, s * 0.18);
        if (kind === 'ground') { g.fillStyle = '#5fa83a'; g.fillRect(x, y, s, Math.max(1, s * 0.16)); }
        if (kind === 'fence') { g.fillStyle = '#5a4128'; g.fillRect(x + s * 0.1, y + s * 0.45, s * 0.8, s * 0.12); }
        return;
      case 'board': rr(g, x + 1, y + s * 0.15, s - 2, s * 0.3, 3, col); return;
      case 'crumble': rr(g, x + 1, y + s * 0.15, s - 2, s * 0.3, 3, col); g.strokeStyle = '#0006'; g.beginPath(); g.moveTo(c, y + s * 0.15); g.lineTo(c - 3, y + s * 0.45); g.stroke(); return;
      case 'spring': case 'springR': case 'springL': {
        g.save(); g.translate(c, m); if (kind === 'springR') g.rotate(Math.PI / 2); if (kind === 'springL') g.rotate(-Math.PI / 2);
        const h = s * (0.35 + 0.08 * p);
        g.strokeStyle = '#ffd23f'; g.lineWidth = Math.max(1.5, s * 0.08); g.beginPath();
        for (let i = 0; i <= 6; i++) g.lineTo((i % 2 ? 1 : -1) * s * 0.28, s * 0.4 - (i / 6) * h * 1.6);
        g.stroke(); rr(g, -s * 0.38, s * 0.4 - h * 1.7, s * 0.76, s * 0.16, 3, col); g.restore(); return;
      }
      case 'coin': case 'crystal': disc(g, c, m + p * s * 0.05, s * 0.24, col); disc(g, c - s * 0.07, m - s * 0.07, s * 0.07, '#fff'); return;
      case 'crumb': glow(g, c, m, s * 0.7, '#ffd23f88'); disc(g, c, m, s * 0.18, col); return;
      case 'light': glow(g, c, m, s * 1.6, '#fff3b0'); disc(g, c, m, s * 0.3, '#fffbe0'); return;
      case 'secret': rr(g, x + s * 0.2, y + s * 0.25, s * 0.6, s * 0.55, 3, '#6f6487'); disc(g, c, m + s * 0.05, s * 0.12, col); return;
      case 'landmark': g.fillStyle = col; g.fillRect(c - s * 0.15, y + s * 0.05, s * 0.3, s * 0.85); disc(g, c, y + s * 0.12, s * 0.16, '#ffe08a'); return;
      case 'tree': g.fillStyle = col; g.beginPath(); g.moveTo(c, y + s * 0.05); g.lineTo(x + s * 0.85, y + s * 0.8); g.lineTo(x + s * 0.15, y + s * 0.8); g.closePath(); g.fill(); return;
      case 'hill': disc(g, c, y + s, s * 0.5, col); return;
      case 'water': case 'lava': g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + ((t * 10 + y) % s), y + s * 0.4, s * 0.3, 2); return;
      case 'hero': case 'heroGoal': hero(g, c, m + p * s * 0.04, s * 0.34, col); return;
      case 'sheep': case 'sheepGoal': disc(g, c, m, s * 0.34, '#fffaf0'); disc(g, c - s * 0.16, m - s * 0.1, s * 0.16, '#fffaf0'); disc(g, c + s * 0.16, m - s * 0.12, s * 0.16, '#fffaf0'); disc(g, c + s * 0.26, m + s * 0.04, s * 0.11, '#3a2f2a'); return;
      case 'goal': g.strokeStyle = col; g.lineWidth = Math.max(1, s * 0.08); g.setLineDash([3, 3]); g.strokeRect(x + s * 0.15, y + s * 0.15, s * 0.7, s * 0.7); g.setLineDash([]); return;
      case 'exit': rr(g, x + s * 0.15, y + s * 0.1, s * 0.7, s * 0.8, 4, '#2a2030'); g.fillStyle = col; g.fillRect(x + s * 0.3, y + s * 0.3, s * 0.4, s * 0.08); g.fillRect(x + s * 0.3, y + s * 0.55, s * 0.4, s * 0.08); return;
      case 'enemy': disc(g, c, m, s * 0.32, col); disc(g, c - s * 0.12, m - s * 0.06, s * 0.08, '#fff'); disc(g, c + s * 0.12, m - s * 0.06, s * 0.08, '#fff'); g.fillStyle = '#0b1020'; g.fillRect(c - s * 0.2, m - s * 0.2, s * 0.14, s * 0.04); g.fillRect(c + s * 0.06, m - s * 0.2, s * 0.14, s * 0.04); return;
      case 'spike': g.fillStyle = col; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x + s * (0.05 + i * 0.3), y + s); g.lineTo(x + s * (0.2 + i * 0.3), y + s * 0.45); g.lineTo(x + s * (0.35 + i * 0.3), y + s); g.fill(); } return;
      case 'flag': g.fillStyle = '#f2efe6'; g.fillRect(c - 1, y + s * 0.05, 2, s * 0.9); g.fillStyle = col; g.beginPath(); g.moveTo(c + 1, y + s * 0.08); g.lineTo(c + s * 0.42, y + s * 0.22 + p * 2); g.lineTo(c + 1, y + s * 0.38); g.fill(); return;
      case 'check': disc(g, c, y + s * 0.8, s * 0.22, '#7d7a8a'); glow(g, c, y + s * 0.5, s * 0.5, '#ffe08a66'); return;
      case 'sign': rr(g, x + s * 0.1, y + s * 0.15, s * 0.8, s * 0.45, 3, '#c8a26a'); g.fillStyle = '#5a4128'; g.fillRect(c - 1, y + s * 0.6, 2, s * 0.4); text(g, '!', c, y + s * 0.38, '#3a2a1a', s * 0.35); return;
      case 'wind': g.strokeStyle = col; g.globalAlpha = 0.6; g.lineWidth = 1.5; for (let i = 0; i < 2; i++) { const yy = y + ((s - (t * 40 + i * s * 0.5) % s) + s) % s; g.beginPath(); g.moveTo(x + s * (0.25 + i * 0.4), yy); g.lineTo(x + s * (0.25 + i * 0.4), yy - s * 0.3); g.stroke(); } g.globalAlpha = 1; return;
      case 'word': rr(g, x + 1, y + 1, s - 2, s - 2, 3, col); text(g, (WORDS[ch] || ch).slice(0, s > 30 ? 7 : 3), c, m, '#1a1206', Math.max(7, s * (s > 30 ? 0.22 : 0.3))); return;
      default: g.fillStyle = col; rr(g, x + s * 0.12, y + s * 0.12, s * 0.76, s * 0.76, 4, col); text(g, ch, c, m, '#0b1020', s * 0.5); return;
    }
  }
  // карта целиком в прямоугольник; glyph — поверх клеток их символы (вид «уровень — это текст»)
  function drawMap(g, map, pal, box, o = {}) {
    const r = rows(map), { w, h } = dims(map);
    const s = Math.floor(Math.min(box.w / w, box.h / h) * 100) / 100;
    const ox = box.x + (box.w - s * w) / 2, oy = box.y + (box.h - s * h) / 2;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const ch = r[j][i] == null ? ' ' : r[j][i];
      if (o.glyph) { g.fillStyle = '#0b1020'; g.fillRect(ox + i * s, oy + j * s, s, s); text(g, ch === ' ' ? '·' : ch, ox + i * s + s / 2, oy + j * s + s / 2, ch === ' ' ? '#3a4880' : (pal[ch] || ['#f2efe6'])[0], s * 0.7, 'center', 700); }
      else drawTile(g, ch, pal[ch] || pal[' '], ox + i * s, oy + j * s, s, o.t || 0);
    }
    if (o.grid) { g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1; for (let i = 0; i <= w; i++) { g.beginPath(); g.moveTo(ox + i * s, oy); g.lineTo(ox + i * s, oy + h * s); g.stroke(); } for (let j = 0; j <= h; j++) { g.beginPath(); g.moveTo(ox, oy + j * s); g.lineTo(ox + w * s, oy + j * s); g.stroke(); } }
    return { s, ox, oy, w, h };
  }
  // холст, который подстраивается под ширину шага и рисует каждый кадр, пока он на странице
  function stage(W, H, draw, cls = 'm4-cv') {
    const cv = el('canvas', { width: W, height: H, class: cls }), g = cv.getContext('2d');
    let raf = 0; const t0 = performance.now();
    let drawn = 0;
    const loop = now => { if (!cv.isConnected && performance.now() - t0 > 1500) { cancelAnimationFrame(raf); return; } if (!(window.LAB_LOWRES && now - drawn < 100)) { drawn = now; draw(g, (now - t0) / 1000); } raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return cv;
  }

  /* ---------------- генераторы пещер (урок 17): те же правила, что у донора «Пещеры на зерне» ---------------- */
  const GEN = {
    // случайное блуждание: «копатель» идёт куда попало и выкапывает пол
    walk(seed, w = 28, h = 16, frac = 0.42) {
      const R = rng(seed), m = Array.from({ length: h }, () => Array(w).fill('#')), order = [];
      let x = w >> 1, y = h >> 1, dug = 0; const need = Math.floor((w - 2) * (h - 2) * frac);
      for (let n = 0; n < 40000 && dug < need; n++) {
        if (m[y][x] === '#') { m[y][x] = '.'; dug++; order.push([x, y]); }
        const d = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(R() * 4)];
        x = clamp(x + d[0], 1, w - 2); y = clamp(y + d[1], 1, h - 2);
      }
      return { m, order };
    },
    // комнаты и коридоры (Rogue, 1980): прямоугольники и Г-образные проходы между ними
    rooms(seed, w = 28, h = 16) {
      const R = rng(seed), m = Array.from({ length: h }, () => Array(w).fill('#')), order = [], rooms = [];
      const dig = (x, y) => { if (m[y][x] === '#') { m[y][x] = '.'; order.push([x, y]); } };
      for (let tries = 0; tries < 60 && rooms.length < 7; tries++) {
        const rw = 3 + Math.floor(R() * 5), rh = 2 + Math.floor(R() * 3), rx = 1 + Math.floor(R() * (w - rw - 2)), ry = 1 + Math.floor(R() * (h - rh - 2));
        if (rooms.some(o => rx < o.x + o.w + 1 && rx + rw + 1 > o.x && ry < o.y + o.h + 1 && ry + rh + 1 > o.y)) continue;
        const prev = rooms[rooms.length - 1]; rooms.push({ x: rx, y: ry, w: rw, h: rh });
        for (let j = ry; j < ry + rh; j++) for (let i = rx; i < rx + rw; i++) dig(i, j);
        if (prev) { const ax = prev.x + (prev.w >> 1), ay = prev.y + (prev.h >> 1), bx = rx + (rw >> 1), by = ry + (rh >> 1); for (let i = Math.min(ax, bx); i <= Math.max(ax, bx); i++) dig(i, ay); for (let j = Math.min(ay, by); j <= Math.max(ay, by); j++) dig(bx, j); }
      }
      return { m, order };
    },
    // клеточный автомат: шум, потом 4 сглаживания «стена, если вокруг 5+ стен» — круглые пещеры
    cells(seed, w = 28, h = 16) {
      const R = rng(seed); let m = Array.from({ length: h }, (_, j) => Array.from({ length: w }, (_, i) => (i === 0 || j === 0 || i === w - 1 || j === h - 1 || R() < 0.45 ? '#' : '.')));
      for (let k = 0; k < 4; k++) m = m.map((row, j) => row.map((c, i) => { if (i === 0 || j === 0 || i === w - 1 || j === h - 1) return '#'; let n = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (m[j + dj][i + di] === '#') n++; return n >= 5 ? '#' : '.'; }));
      const order = []; m.forEach((row, j) => row.forEach((c, i) => { if (c === '.') order.push([i, j]); }));
      order.sort((a, b) => (a[0] + a[1] * 0.3) - (b[0] + b[1] * 0.3));
      return { m, order };
    },
    // лабиринт: ход назад (recursive backtracker) по сетке через клетку
    maze(seed, w = 27, h = 15) {
      const R = rng(seed), m = Array.from({ length: h }, () => Array(w).fill('#')), order = [];
      const st = [[1, 1]]; m[1][1] = '.'; order.push([1, 1]);
      while (st.length) {
        const [x, y] = st[st.length - 1];
        const ns = [[2, 0], [-2, 0], [0, 2], [0, -2]].map(d => [x + d[0], y + d[1], d]).filter(([a, b]) => a > 0 && b > 0 && a < w - 1 && b < h - 1 && m[b][a] === '#');
        if (!ns.length) { st.pop(); continue; }
        const [a, b, d] = ns[Math.floor(R() * ns.length)];
        m[y + d[1] / 2][x + d[0] / 2] = '.'; m[b][a] = '.'; order.push([x + d[0] / 2, y + d[1] / 2], [a, b]); st.push([a, b]);
      }
      return { m, order };
    },
    // комнаты-шаблоны (Spelunky, 2008): сетка 4 × 3 комнат, путь сверху вниз гарантирован, комнаты из готовых заготовок
    templ(seed, w = 28, h = 15) {
      const R = rng(seed), m = Array.from({ length: h }, () => Array(w).fill('#')), order = [];
      const CW = 7, CH = 5, T = [['.......', '.##.##.', '.......', '..###..', '.......'], ['.......', '.......', '.#...#.', '.#...#.', '.......'], ['###.###', '#.....#', '#.#.#.#', '#.....#', '###.###'], ['.......', '.#####.', '.......', '.#####.', '.......']];
      let cx = Math.floor(R() * 4); const path = new Set();
      for (let cy = 0; cy < 3; cy++) { path.add(cx + ',' + cy); let steps = Math.floor(R() * 3); while (steps--) { cx = clamp(cx + (R() < 0.5 ? -1 : 1), 0, 3); path.add(cx + ',' + cy); } }
      for (let cy = 0; cy < 3; cy++) for (let cx2 = 0; cx2 < 4; cx2++) {
        const t = path.has(cx2 + ',' + cy) ? T[Math.floor(R() * 2)] : T[2 + Math.floor(R() * 2)];
        for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) { const X = cx2 * CW + i, Y = cy * CH + j; if (X > 0 && Y > 0 && X < w - 1 && Y < h - 1 && t[j][i] === '.') { m[Y][X] = '.'; order.push([X, Y]); } }
      }
      return { m, order };
    },
  };
  const GEN_NAMES = { walk: 'Случайное блуждание', rooms: 'Комнаты и коридоры', cells: 'Клеточный автомат', maze: 'Лабиринт', templ: 'Комнаты-шаблоны' };
  const genText = m => m.map(r => r.join('')).join('\n');

  /* =================== MOTION: сцены-объяснялки =================== */
  // Каждая сцена — функция (g, t, W, H) для холста 640 × 300; t — секунды с начала сцены, сцена крутится сама по кругу
  const MOTION = {};
  // --- урок 14: уровень, который учит без слов ---
  MOTION['mario-goomba'] = (g, t, W, H) => {
    t %= 6.5; sky(g, W, H, '#5c94fc', '#9fc4ff');
    g.fillStyle = '#c84c0c'; g.fillRect(0, 240, W, 60); g.fillStyle = '#e69c5c'; for (let i = 0; i < W; i += 32) g.fillRect(i, 240, 30, 6);
    // блок «?» над дорогой
    const hit = seg(t, 2.05, 2.25), bump = Math.sin(hit * Math.PI) * 8;
    rr(g, 300, 128 - bump, 34, 34, 4, t > 2.25 ? '#a0522d' : '#ffb547', '#7a3a00'); if (t < 2.25) text(g, '?', 317, 145 - bump, '#7a3a00', 22);
    if (t > 2.2) { const k = seg(t, 2.2, 2.9); disc(g, 317, 128 - 30 * ob(k), 8 * (1 - seg(t, 2.9, 3.3)), '#ffd23f'); }
    // гумба идёт навстречу
    const gx = t < 2.9 ? 520 - 70 * t : 317, flat = t > 2.9 ? 1 : 0;
    g.save(); g.translate(gx, 232); g.scale(1, flat ? 0.35 : 1); disc(g, 0, -2, 15, '#8b4a2b'); disc(g, -5, -6, 4, '#fff'); disc(g, 5, -6, 4, '#fff'); g.restore();
    // герой: прыжок в 1,6 с, бьёт блок головой, падает на гумбу
    let hx = 140, hy = 225;
    if (t > 1.6) { const k = seg(t, 1.6, 2.9); hx = lerp(140, 317, k); hy = 225 - Math.sin(k * Math.PI) * 120 + (k > 0.5 ? 0 : 0); if (k >= 1) hy = 210; }
    if (t > 2.9) { hx = 317 + (t - 2.9) * 40; hy = 225 - Math.max(0, Math.sin(seg(t, 2.9, 3.5) * Math.PI) * 40); }
    hero(g, hx, hy, 14, '#ff5d6e', 1);
    const cap = t < 1.6 ? ['1', 'Опасность идёт к тебе: ты сам решаешь прыгнуть'] : t < 2.9 ? ['2', 'Прыжок сам упирается в блок — игра наградила'] : ['3', 'Приземлился на врага: прыжок — это и оружие'];
    rr(g, 20, 16, 400, 40, 10, 'rgba(11,16,32,.75)'); text(g, cap[0], 42, 36, '#ffd23f', 20); text(g, cap[1], 230, 36, '#f2efe6', 14);
    if (t > 2.9 && t < 3.6) text(g, 'ТОП!', 317, 190, '#ffd23f', 20);
  };
  MOTION['mario-mushroom'] = (g, t, W, H) => {
    t %= 6; sky(g, W, H, '#5c94fc', '#9fc4ff');
    g.fillStyle = '#c84c0c'; g.fillRect(0, 240, W, 60);
    rr(g, 470, 170, 56, 70, 4, '#2fa84f', '#14612b'); rr(g, 462, 160, 72, 22, 4, '#3ccf63', '#14612b');
    hero(g, 150, 225, 14, '#ff5d6e', 1);
    // гриб: выходит из блока вправо, бьётся о трубу и катится к герою
    const k1 = seg(t, 0.4, 1.8), k2 = seg(t, 1.8, 4.2);
    const mx = t < 1.8 ? lerp(300, 456, k1) : lerp(456, 162, io(k2)), my = t < 0.7 ? 150 : t < 1.1 ? lerp(150, 228, seg(t, 0.7, 1.1)) : 228;
    rr(g, 284, 128, 34, 34, 4, '#a0522d');
    if (t < 4.3) { disc(g, mx, my - 6, 14, '#ff5d6e'); disc(g, mx - 5, my - 10, 4, '#fff'); disc(g, mx + 6, my - 4, 3, '#fff'); g.fillStyle = '#f5e6c8'; g.fillRect(mx - 8, my - 2, 16, 10); }
    if (t > 1.7 && t < 2.1) text(g, 'бум!', 456, 140, '#fff', 16);
    if (t > 4.2) { const k = seg(t, 4.2, 5); glow(g, 150, 220, 60 * k, '#ffd23f'); text(g, 'Гриб сам пришёл: значит, он хороший', 320, 90, '#ffd23f', 16); }
    if (t < 4.2) { rr(g, 20, 16, 470, 40, 10, 'rgba(11,16,32,.75)'); text(g, 'Труба развернула гриб к тебе. Ошибиться почти нельзя.', 255, 36, '#f2efe6', 14); }
  };
  MOTION['safe-risk-test'] = (g, t, W, H) => {
    t %= 7.5; sky(g, W, H, '#162244', '#2e4a7a');
    const P = [{ x: 20, name: 'Безопасная проба', pit: 0, col: '#7cf5a8' }, { x: 230, name: 'Небольшой риск', pit: 1, col: '#ffd23f' }, { x: 440, name: 'Проверка', pit: 2, col: '#ff5d6e' }];
    const cur = Math.min(2, Math.floor(t / 2.5));
    P.forEach((p, i) => {
      const on = i === cur, k = on ? (t % 2.5) / 2.5 : i < cur ? 1 : 0;
      rr(g, p.x, 40, 180, 220, 12, on ? 'rgba(124,245,168,.08)' : 'rgba(255,255,255,.03)', on ? p.col : '#2a3560');
      text(g, p.name, p.x + 90, 64, p.col, 14);
      // земля: в пробе под пружиной есть пол, в риске — неглубокая яма, в проверке — пропасть
      g.fillStyle = '#6b5137'; g.fillRect(p.x + 10, 220, 50, 30); g.fillRect(p.x + 130, 220, 40, 30);
      if (p.pit === 0) g.fillRect(p.x + 60, 235, 70, 15);
      if (p.pit === 1) { g.fillRect(p.x + 60, 248, 70, 4); text(g, 'вернёт на флажок', p.x + 95, 240, '#9aa3c7', 10, 'center', 600); }
      if (p.pit === 2) { g.fillStyle = '#05070f'; g.fillRect(p.x + 60, 220, 70, 40); }
      drawTile(g, '^', ['#ff5d6e', 'spring'], p.x + 30, 196, 24, t);
      const hx = lerp(p.x + 20, p.x + 150, k), hy = 212 - Math.sin(k * Math.PI) * (90 + p.pit * 10);
      if (i <= cur) hero(g, hx, hy, 10, '#5fe0ff', 1, k < 0.15 ? 0.6 : 0);
      if (i < cur) text(g, '✓', p.x + 160, 64, p.col, 16);
    });
    text(g, 'Одна идея — три раза: сначала без цены ошибки, потом с маленькой, потом всерьёз', 320, 284, '#9aa3c7', 13, 'center', 600);
  };
  MOTION.kishoten = (g, t, W, H) => {
    t %= 10; sky(g, W, H, '#10172d', '#1a2445');
    const names = [['起', 'Ки — ввести', '#7cf5a8'], ['承', 'Сё — развить', '#5fe0ff'], ['転', 'Тэн — перевернуть', '#ffb547'], ['結', 'Кэцу — завершить', '#ff5d6e']];
    const cur = Math.min(3, Math.floor(t / 2.2));
    names.forEach(([kan, name, col], i) => {
      const x = 14 + i * 156, appear = ob(seg(t, i * 2.2, i * 2.2 + 0.5)), k = ((t - i * 2.2) % 2.2) / 2.2;
      if (appear <= 0) return;
      g.save(); g.translate(x + 74, 150); g.scale(appear, appear); g.translate(-x - 74, -150);
      rr(g, x, 30, 148, 230, 12, i === cur ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.03)', i === cur ? col : '#2a3560');
      text(g, kan, x + 74, 64, col, 30); text(g, name, x + 74, 98, '#f2efe6', 13);
      g.fillStyle = '#6b5137'; g.fillRect(x + 8, 228, 132, 20);
      const kk = i === cur ? k : 1;
      if (i === 0) { drawTile(g, '^', ['#ff5d6e', 'spring'], x + 60, 205, 26, t); hero(g, x + 73, 196 - Math.abs(Math.sin(kk * Math.PI * 2)) * 70, 9); }
      if (i === 1) { g.fillStyle = '#05070f'; g.fillRect(x + 40, 228, 70, 20); [x + 20, x + 62, x + 104].forEach((sx, j) => drawTile(g, '^', ['#ff5d6e', 'spring'], sx, 205, 22, t)); hero(g, lerp(x + 30, x + 116, kk), 190 - Math.abs(Math.sin(kk * Math.PI * 3)) * 60, 9); }
      if (i === 2) { g.fillStyle = '#6b5137'; g.fillRect(x + 8, 120, 14, 110); drawTile(g, '>', ['#ff8a4c', 'springR'], x + 18, 160, 22, t); hero(g, lerp(x + 34, x + 130, kk), 175 - Math.sin(kk * Math.PI) * 40, 9); if (kk > 0.1 && kk < 0.5) text(g, '!', x + 120, 140, '#ffb547', 26); }
      if (i === 3) { g.fillStyle = '#05070f'; g.fillRect(x + 50, 228, 40, 20); drawTile(g, '^', ['#ff5d6e', 'spring'], x + 26, 205, 22, t); drawTile(g, 'F', ['#7cf5a8', 'flag'], x + 108, 196, 30, t); hero(g, lerp(x + 22, x + 116, kk), 200 - Math.sin(kk * Math.PI) * 70, 9); if (kk > 0.95) confetti(g, x + 120, 190, seg(t % 2.2, 2.0, 2.2), 12); }
      g.restore();
    });
  };
  MOTION['portal-chamber'] = (g, t, W, H) => {
    t %= 6; sky(g, W, H, '#dfe6ee', '#b9c3cf');
    g.fillStyle = '#8f99a6'; g.fillRect(0, 250, W, 50); g.fillStyle = '#6f7986'; g.fillRect(0, 0, 40, 250); g.fillRect(W - 40, 0, 40, 250);
    for (let i = 60; i < W - 60; i += 80) { g.strokeStyle = '#c3ccd6'; g.strokeRect(i, 20, 80, 80); }
    // голубой портал слева на полу, оранжевый — высоко на правой стене
    g.save(); g.translate(130, 248); g.scale(1, 0.25); glow(g, 0, 0, 70, '#3fa9ff'); disc(g, 0, 0, 42, '#3fa9ff'); disc(g, 0, 0, 30, '#cfe9ff'); g.restore();
    g.save(); g.translate(W - 42, 110); g.scale(0.25, 1); glow(g, 0, 0, 70, '#ff8a2a'); disc(g, 0, 0, 42, '#ff8a2a'); disc(g, 0, 0, 30, '#ffe0c2'); g.restore();
    rr(g, 480, 210, 40, 40, 6, '#a7b0bc', '#6f7986'); disc(g, 500, 230, 8, '#ff7ad9');
    // героиня прыгает в портал на полу и вылетает из стены
    let x, y;
    if (t < 1.5) { x = lerp(60, 130, seg(t, 0, 1.2)); y = 236 - (t > 1.2 ? (t - 1.2) * -200 : 0); }
    else if (t < 3.2) { const k = seg(t, 1.5, 3.2); x = lerp(W - 60, 380, k); y = 110 + k * k * 120; }
    else { x = 380 - (t - 3.2) * 10; y = 236; }
    if (t < 1.5 || t > 1.5) hero(g, x, Math.min(236, y), 13, '#f2efe6', t < 1.5 ? 1 : -1);
    rr(g, 70, 20, 500, 40, 10, 'rgba(11,16,32,.8)');
    text(g, t < 1.5 ? 'Одна комната — одна идея: вошёл в голубой…' : t < 3.2 ? '…вылетел из оранжевого с той же скоростью' : 'Комната учит правило раньше, чем ты прочтёшь подсказку', 320, 40, '#f2efe6', 14);
  };
  MOTION['heat-demo'] = (g, t, W, H) => {
    t %= 7; g.fillStyle = '#0b1020'; g.fillRect(0, 0, W, H);
    const map = ['                         F', '                  ===  ###', '    *  *         ###      ', '@   ^  ^   ###            ', '##########   ####  ########'].join('\n');
    const L = drawMap(g, map, PALETTES.tropa, { x: 20, y: 40, w: 600, h: 170 }, { t });
    const pits = [[11.2, 4], [11.6, 4], [12, 4], [11.4, 4], [12.3, 4], [11.8, 4], [17.4, 4], [17.8, 4], [5, 3.8], [11.1, 4]];
    pits.forEach(([x, y], i) => {
      const k = seg(t, 0.3 + i * 0.35, 0.8 + i * 0.35); if (k <= 0) return;
      const px = L.ox + x * L.s, py = L.oy + (y + 0.5) * L.s;
      if (k < 1) disc(g, px, lerp(L.oy - 20, py, k * k), 5, '#ff5d6e'); else glow(g, px, py, 26, 'rgba(255,60,80,.55)');
    });
    const n = pits.filter((_, i) => t > 0.8 + i * 0.35).length;
    rr(g, 20, 222, 600, 60, 10, 'rgba(26,36,69,.9)');
    text(g, `Смертей соседей: ${n}`, 120, 252, '#ff5d6e', 16);
    text(g, n >= 6 ? 'Красное пятно у ямы: здесь уровень не научил прыгать дальше' : 'Каждая точка — где сосед упал. Автор молчит и смотрит…', 400, 252, '#f2efe6', 13);
  };
  // --- урок 15: уровень — это данные ---
  const SOKO = ['#########', '#@  $  .#', '#  ###  #', '# $   . #', '#########'].join('\n');
  MOTION['map-to-level'] = (g, t, W, H) => {
    t %= 6; g.fillStyle = '#0b1020'; g.fillRect(0, 0, W, H);
    const r = rows(SOKO), k = io(seg(t, 1.2, 3.2)), back = io(seg(t, 4.6, 5.8)), m = k * (1 - back);
    const s0 = 26, ox0 = 30, oy0 = 80, s1 = 32, ox1 = 330, oy1 = 70;
    text(g, 'Текст', 30 + 9 * s0 / 2, 52, '#9aa3c7', 14); text(g, 'Уровень', ox1 + 9 * s1 / 2, 52, '#9aa3c7', 14);
    r.forEach((line, j) => [...line].forEach((ch, i) => {
      const x = lerp(ox0 + i * s0, ox1 + i * s1, m), y = lerp(oy0 + j * s0, oy1 + j * s1, m), s = lerp(s0, s1, m);
      if (m > 0.5) drawTile(g, ch, PALETTES.zagon[ch], x, y, s, t);
      g.globalAlpha = 1 - clamp(m * 2 - 0.6, 0, 1); text(g, ch === ' ' ? '·' : ch, x + s / 2, y + s / 2, ch === ' ' ? '#3a4880' : (PALETTES.zagon[ch] || ['#fff'])[0], s * 0.7, 'center', 700); g.globalAlpha = 1;
    }));
    const legend = [['#', 'плетень'], ['@', 'пастух'], ['$', 'овца'], ['.', 'загон']];
    legend.forEach(([c, n], i) => { text(g, c, 60 + i * 150, 262, (PALETTES.zagon[c] || ['#fff'])[0], 20, 'center', 800); text(g, '— ' + n, 104 + i * 150, 262, '#f2efe6', 13, 'center', 600); });
  };
  MOTION['edit-char'] = (g, t, W, H) => {
    t %= 7; g.fillStyle = '#0b1020'; g.fillRect(0, 0, W, H);
    const before = SOKO, after = SOKO.split('\n').map((l, j) => (j === 2 ? '#  # #  #' : l)).join('\n'), changed = t > 2.4;
    const cur = changed ? after : before;
    rr(g, 24, 30, 260, 170, 10, '#05070f', '#2a3560');
    rows(cur).forEach((line, j) => text(g, line.replace(/ /g, '·'), 154, 62 + j * 28, '#f2efe6', 20, 'center', 700));
    // курсор печатает пробел вместо «#»
    const blink = Math.floor(t * 3) % 2;
    if (t > 1 && t < 3.2) { const cx = 154 - 9 * 12 / 2 + 4 * 12 + 18, cy = 62 + 2 * 28; if (blink) { g.fillStyle = '#ffd23f'; g.fillRect(cx - 7, cy - 12, 2, 24); } text(g, changed ? '«#» → « »' : 'правим символ…', 154, 224, '#ffd23f', 14); }
    drawMap(g, cur, PALETTES.zagon, { x: 320, y: 30, w: 290, h: 170 }, { t });
    if (changed) { const k = seg(t, 2.4, 3); glow(g, 320 + 145, 30 + 85, 80 * k, 'rgba(124,245,168,.35)'); }
    rr(g, 24, 240, 592, 44, 10, 'rgba(26,36,69,.9)');
    text(g, changed ? 'Открылся проход — а код игры никто не трогал. Уровень — это данные.' : 'Дизайнер меняет текст карты, а не программу', 320, 262, changed ? '#7cf5a8' : '#f2efe6', 14);
  };
  MOTION['sokoban-push'] = (g, t, W, H) => {
    t %= 9; g.fillStyle = '#0b1020'; g.fillRect(0, 0, W, H);
    const base = ['#########', '#       #', '# @$  . #', '#       #', '#$      #', '#########'];
    const frames = [[2, 2, 3, 2], [3, 2, 4, 2], [4, 2, 5, 2], [5, 2, 6, 2]]; // пастух x,y — овца x,y
    const k = Math.min(3, Math.floor(seg(t, 0.5, 4.5) * 4));
    const st = frames[k], done = t > 4.5;
    const m = base.map((l, j) => [...l].map((c, i) => (c === '@' || c === '$' && j === 2 ? ' ' : c)));
    m[st[1]][st[0]] = '@'; m[st[3]][st[2]] = done ? '*' : '$';
    if (t > 5.2) { m[4][1] = '$'; }
    const L = drawMap(g, m.map(r => r.join('')).join('\n'), PALETTES.zagon, { x: 120, y: 20, w: 400, h: 220 }, { t });
    if (done && t < 5.2) confetti(g, L.ox + 6.5 * L.s, L.oy + 2.5 * L.s, seg(t, 4.5, 5.2));
    if (t > 5.6) { const p = 0.5 + 0.5 * Math.sin(t * 8); g.strokeStyle = `rgba(255,93,110,${0.5 + p * 0.5})`; g.lineWidth = 4; g.strokeRect(L.ox + L.s, L.oy + 4 * L.s, L.s, L.s); text(g, 'тупик: из угла овцу не вытолкнуть', L.ox + 4.5 * L.s, L.oy + 4.5 * L.s, '#ff5d6e', 14); }
    if (t > 7) text(g, '↩ отмена хода (B) — и снова думаешь', 320, 270, '#7cf5a8', 15);
    else text(g, done ? 'Овца в загоне!' : 'Толкать можно, тянуть — нет. Одну овцу за раз.', 320, 270, '#f2efe6', 15);
  };
  MOTION['baba-rule'] = (g, t, W, H) => {
    t %= 8; g.fillStyle = '#0b1020'; g.fillRect(0, 0, W, H);
    const broken = t > 3.2, s = 46, ox = 60, oy = 40;
    // правило: ПЛЕТЕНЬ ЕСТЬ СТОП, «СТОП» уезжает вниз
    const sx = ox + 2 * s, sy = oy + lerp(0, s * 1.4, io(seg(t, 2.2, 3.2)));
    drawTile(g, 'P', PALETTES.zagon.P, ox, oy, s, t); drawTile(g, '=', PALETTES.zagon['='], ox + s, oy, s, t); drawTile(g, 'S', PALETTES.zagon.S, sx, sy, s, t);
    const hx = t < 2.2 ? ox + 2.5 * s : t < 3.2 ? ox + 2.5 * s : lerp(ox + 2.5 * s, ox + 11 * s, seg(t, 3.6, 6.5));
    const hy = t < 2.2 ? oy - 0.2 * s + seg(t, 1.2, 2.2) * 0 : oy + 0.5 * s;
    hero(g, t < 2.2 ? ox + 2.5 * s : hx, t < 2.2 ? oy - 0.6 * s : t < 3.2 ? oy - 0.6 * s + seg(t, 2.2, 3.2) * 0 : oy + 3.6 * s, 14);
    for (let j = 0; j < 4; j++) { g.globalAlpha = broken ? 0.3 : 1; drawTile(g, '#', PALETTES.zagon['#'], ox + 7 * s, oy + 2 * s + j * s * 0.5, s * 0.5, t); g.globalAlpha = 1; }
    if (!broken) text(g, 'Пока фраза цела — плетень стоп', 360, 240, '#ffb547', 16);
    else text(g, 'Вытолкнул «СТОП» — правило исчезло, плетень пропускает!', 320, 240, '#7cf5a8', 16);
    if (t > 3.6 && t < 6.5) glow(g, hx, oy + 3.6 * s, 30, 'rgba(124,245,168,.4)');
    text(g, 'Baba Is You: правила мира — тоже блоки на карте', 320, 280, '#9aa3c7', 13, 'center', 600);
  };
  MOTION.pace = (g, t, W, H) => {
    t %= 6; g.fillStyle = '#0b1020'; g.fillRect(0, 0, W, H);
    const L = [3, 8, 4, 10, 3, 12, 5], x0 = 40;
    let x = x0;
    L.forEach((n, i) => {
      const w = n * 12, k = ob(seg(t, i * 0.4, i * 0.4 + 0.4)), hgt = (n > 6 ? 120 : 50) * k;
      rr(g, x, 200 - hgt, w - 6, hgt, 8, n > 6 ? '#ff8a4c' : '#7cf5a8');
      text(g, n > 6 ? 'длинный' : 'короткий', x + (w - 6) / 2, 220, '#9aa3c7', 11, 'center', 600);
      text(g, String(i + 1), x + (w - 6) / 2, 200 - hgt - 14, '#f2efe6', 13);
      x += w;
    });
    // пульс по уровням
    const p = (t * 1.2) % L.length, px = x0 + L.slice(0, Math.floor(p)).reduce((a, n) => a + n * 12, 0) + (p % 1) * L[Math.floor(p)] * 12;
    disc(g, px, 250, 7, '#ffd23f'); glow(g, px, 250, 24, 'rgba(255,210,63,.5)');
    text(g, 'Короткий — длинный — короткий: после трудного уровня игрок отдыхает', 320, 280, '#f2efe6', 14);
  };
  // --- урок 16: куда смотрит игрок ---
  function plateau(g, W, H, dark, t) {
    sky(g, W, H, dark ? '#1a1430' : '#5a6fa8', dark ? '#3a2b4a' : '#f0b98a');
    g.fillStyle = dark ? '#241b34' : '#6a6f9a'; g.beginPath(); g.moveTo(0, 210); g.lineTo(150, 150); g.lineTo(300, 190); g.lineTo(420, 90); g.lineTo(520, 160); g.lineTo(W, 130); g.lineTo(W, H); g.lineTo(0, H); g.fill();
    g.fillStyle = dark ? '#2e2440' : '#c99a6a'; g.fillRect(0, 230, W, 70);
  }
  MOTION['journey-light'] = (g, t, W, H) => {
    t %= 6; plateau(g, W, H, true, t);
    const pulse = 0.7 + 0.3 * Math.sin(t * 3);
    g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,240,180,${0.25 * pulse})`; g.beginPath(); g.moveTo(410, 90); g.lineTo(430, 90); g.lineTo(470, -10); g.lineTo(370, -10); g.fill(); g.restore();
    glow(g, 420, 90, 60 * pulse, '#fff3b0'); disc(g, 420, 90, 6, '#fffbe0');
    hero(g, 120, 250, 10, '#ff8a4c', 1);
    const k = io(seg(t, 1, 3));
    g.setLineDash([6, 8]); g.strokeStyle = '#ffd23f'; g.lineWidth = 2; g.beginPath(); g.moveTo(120, 240); g.lineTo(lerp(120, 420, k), lerp(240, 100, k)); g.stroke(); g.setLineDash([]);
    if (t > 3) { rr(g, 120, 20, 400, 40, 10, 'rgba(11,16,32,.75)'); text(g, 'Свет на вершине — цель без единой стрелки', 320, 40, '#ffe08a', 15); }
  };
  MOTION.contrast = (g, t, W, H) => {
    t %= 5; g.fillStyle = '#20263d'; g.fillRect(0, 0, W, H);
    const R = rng(5);
    for (let i = 0; i < 40; i++) { const x = 30 + R() * 580, y = 30 + R() * 200; disc(g, x, y, 10 + R() * 8, '#4a5070'); }
    const tx = 470, ty = 150, p = 0.6 + 0.4 * Math.sin(t * 5);
    glow(g, tx, ty, 40 * p, 'rgba(255,138,76,.6)'); disc(g, tx, ty, 16, '#ff8a4c');
    const k = io(seg(t, 0.8, 1.6)); g.strokeStyle = '#ffd23f'; g.lineWidth = 3; g.beginPath(); g.arc(lerp(150, tx, k), lerp(120, ty, k), 28, 0, TAU); g.stroke();
    text(g, 'Глаз находит единственное яркое за долю секунды', 320, 270, '#f2efe6', 15);
  };
  MOTION.crumbs = (g, t, W, H) => {
    t %= 7; plateau(g, W, H, false, t);
    rr(g, 300, 150, 90, 80, 20, '#5c6378');
    const pts = [[80, 260], [140, 255], [200, 250], [255, 245], [290, 238], [400, 236], [450, 240], [510, 246], [560, 250]];
    pts.forEach(([x, y], i) => { const on = t > 0.5 + i * 0.3; if (on) { glow(g, x, y, 18, 'rgba(255,210,63,.6)'); disc(g, x, y, 5, '#ffd23f'); } });
    rr(g, 575, 205, 40, 50, 6, '#2a2030'); glow(g, 595, 230, 30, 'rgba(255,240,180,.5)');
    const k = seg(t, 3.3, 6.3), i = Math.min(pts.length - 1, Math.floor(k * (pts.length - 1))), f = k * (pts.length - 1) - i;
    const a = pts[i], b = pts[Math.min(pts.length - 1, i + 1)];
    hero(g, lerp(a[0], b[0], f), lerp(a[1], b[1], f) - 12, 10, '#5fe0ff', 1);
    rr(g, 120, 20, 400, 40, 10, 'rgba(11,16,32,.75)'); text(g, 'Хлебные крошки ведут за скалу, где сам бы не догадался', 320, 40, '#f2efe6', 14);
  };
  MOTION.landmark = (g, t, W, H) => {
    t %= 6; plateau(g, W, H, false, t);
    g.fillStyle = '#ffb547'; g.fillRect(410, 60, 20, 130); disc(g, 420, 60, 12, '#ffe08a'); glow(g, 420, 60, 40, 'rgba(255,224,138,.5)');
    const starts = [[60, 280], [200, 290], [600, 285]];
    starts.forEach(([x, y], i) => { const k = io(seg(t, 0.4 + i * 0.4, 1.6 + i * 0.4)); g.setLineDash([4, 6]); g.strokeStyle = '#ffd23f'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(lerp(x, 420, k), lerp(y, 190, k)); g.stroke(); g.setLineDash([]); hero(g, x, y - 10, 8, '#5fe0ff'); });
    rr(g, 70, 20, 290, 40, 10, 'rgba(11,16,32,.75)'); text(g, 'Ориентир виден отовсюду: «я иду к башне»', 215, 40, '#f2efe6', 13);
  };
  MOTION['narrow-wide'] = (g, t, W, H) => {
    t %= 7; const k = io(seg(t, 2.5, 4.5));
    sky(g, W, H, '#5a6fa8', '#f0b98a');
    const gap = lerp(70, 320, k);
    g.fillStyle = '#3a3f52'; g.fillRect(0, 0, W / 2 - gap, H); g.fillRect(W / 2 + gap, 0, W / 2 - gap, H);
    g.fillStyle = '#4a5068'; for (let j = 0; j < H; j += 26) { g.fillRect(W / 2 - gap - 8, j + ((t * 60) % 26), 8, 14); g.fillRect(W / 2 + gap, j + ((t * 60 + 13) % 26), 8, 14); }
    g.fillStyle = '#c99a6a'; g.fillRect(W / 2 - gap, 240, gap * 2, 60);
    hero(g, W / 2, 230, 11, '#ff8a4c');
    rr(g, 20, 20, 150, 26, 8, 'rgba(11,16,32,.75)'); text(g, k < 0.5 ? 'теснота: тревожно' : 'простор: «вау»', 95, 33, k < 0.5 ? '#ffb547' : '#7cf5a8', 13);
    g.fillStyle = '#1a2445'; g.fillRect(470, 24, 150, 12); g.fillStyle = k < 0.5 ? '#ffb547' : '#7cf5a8'; g.fillRect(470, 24, 150 * (0.25 + 0.75 * k), 12);
    text(g, 'Сначала тесно — потом простор: пространство тоже вызывает чувство', 320, 280, '#0b1020', 14);
  };
  // --- урок 17: процедурная генерация ---
  function drawGen(g, m, box, upto, t, mark) {
    const h = m.length, w = m[0].length, s = Math.min(box.w / w, box.h / h), ox = box.x + (box.w - s * w) / 2, oy = box.y + (box.h - s * h) / 2;
    g.fillStyle = '#4a3b52'; g.fillRect(ox, oy, w * s, h * s);
    (upto || []).forEach(([i, j]) => { g.fillStyle = '#8a7a6a'; g.fillRect(ox + i * s, oy + j * s, s + 0.5, s + 0.5); });
    if (mark) mark(ox, oy, s);
    return { ox, oy, s };
  }
  MOTION.walker = (g, t, W, H) => {
    t %= 7; g.fillStyle = '#0b1020'; g.fillRect(0, 0, W, H);
    const { m, order } = GEN.walk(17, 32, 16, 0.4), n = Math.floor(order.length * seg(t, 0.2, 4.5));
    drawGen(g, m, { x: 20, y: 20, w: 600, h: 220 }, order.slice(0, n), t, (ox, oy, s) => {
      const p = order[Math.max(0, n - 1)]; if (p) { hero(g, ox + (p[0] + 0.5) * s, oy + (p[1] + 0.5) * s, s * 0.45, '#ffd23f'); }
      if (t > 4.6) { const e = order[order.length - 1]; drawTile(g, 'E', PALETTES.peshchery.E, ox + e[0] * s, oy + e[1] * s, s, t); glow(g, ox + (e[0] + 0.5) * s, oy + (e[1] + 0.5) * s, 30, 'rgba(124,245,168,.5)'); }
    });
    text(g, t < 4.6 ? `Копатель шагает куда попало: шагов ${n}` : 'Выход ставим в самую дальнюю клетку', 320, 270, '#f2efe6', 15);
  };
  MOTION['same-seed'] = (g, t, W, H) => {
    t %= 7; g.fillStyle = '#0b1020'; g.fillRect(0, 0, W, H);
    const A = GEN.cells(4242, 24, 14), C = GEN.cells(777, 24, 14), k = seg(t, 0.3, 2.5);
    [[A, 4242, 20], [A, 4242, 225], [C, 777, 430]].forEach(([G0, seed, x], i) => {
      const n = Math.floor(G0.order.length * (i === 2 ? seg(t, 2.8, 4.8) : k));
      drawGen(g, G0.m, { x, y: 50, w: 190, h: 150 }, G0.order.slice(0, n), t);
      rr(g, x + 30, 210, 130, 30, 8, i === 2 ? '#2a1f0c' : '#0c2418'); text(g, 'зерно ' + seed, x + 95, 225, i === 2 ? '#ffb547' : '#7cf5a8', 14);
    });
    if (t > 2.5) text(g, '=', 215, 125, '#7cf5a8', 30);
    if (t > 4.8) text(g, '≠', 420, 125, '#ffb547', 30);
    text(g, t < 2.5 ? 'Одно зерно — у тебя и у друга…' : t < 4.8 ? '…один и тот же мир, клетка в клетку' : 'Другое зерно — другой мир', 320, 270, '#f2efe6', 15);
  };
  MOTION.rooms = (g, t, W, H) => {
    t %= 6; g.fillStyle = '#0b1020'; g.fillRect(0, 0, W, H);
    const { m, order } = GEN.rooms(31, 32, 16), n = Math.floor(order.length * seg(t, 0.3, 4));
    drawGen(g, m, { x: 20, y: 20, w: 600, h: 220 }, order.slice(0, n), t);
    text(g, 'Rogue, 1980: сначала комнаты, потом коридоры между ними', 320, 270, '#f2efe6', 15);
  };
  MOTION.flood = (g, t, W, H) => {
    t %= 9; g.fillStyle = '#0b1020'; g.fillRect(0, 0, W, H);
    const bad = t > 4.5, base = GEN.cells(bad ? 99 : 4242, 26, 14).m.map(r => r.slice());
    // старт — первая свободная клетка слева, выход — справа; во втором мире выход замурован
    const free = []; base.forEach((r, j) => r.forEach((c, i) => { if (c === '.') free.push([i, j]); }));
    const st = free.reduce((a, b) => (b[0] < a[0] ? b : a)), ex = free.reduce((a, b) => (b[0] > a[0] ? b : a));
    if (bad) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (di || dj) { const y = ex[1] + dj, x = ex[0] + di; if (base[y] && base[y][x]) base[y][x] = '#'; }
    const dist = {}, q = [st]; dist[st] = 0;
    while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = x + dx, b = y + dy; if (base[b] && base[b][a] === '.' && dist[[a, b]] == null) { dist[[a, b]] = dist[[x, y]] + 1; q.push([a, b]); } } }
    const wave = (bad ? t - 4.5 : t) * 14, all = free.filter(p => base[p[1]][p[0]] === '.');
    const L = drawGen(g, base, { x: 40, y: 20, w: 560, h: 220 }, all, t);
    all.forEach(p => { const d = dist[p]; if (d != null && d < wave) { g.fillStyle = `rgba(95,224,255,${0.55 - Math.min(0.4, (wave - d) * 0.01)})`; g.fillRect(L.ox + p[0] * L.s, L.oy + p[1] * L.s, L.s, L.s); } });
    drawTile(g, '@', PALETTES.peshchery['@'], L.ox + st[0] * L.s, L.oy + st[1] * L.s, L.s, t); drawTile(g, 'E', PALETTES.peshchery.E, L.ox + ex[0] * L.s, L.oy + ex[1] * L.s, L.s, t);
    const reached = dist[ex] != null && dist[ex] < wave;
    text(g, !bad ? (reached ? '✓ Заливка дошла до выхода: мир проходим' : 'Заливка проверяет: можно ли дойти до выхода?') : (wave > 60 ? '✗ Выход замурован — генератор копает заново' : 'Другой мир…'), 320, 268, !bad ? (reached ? '#7cf5a8' : '#f2efe6') : '#ff5d6e', 15);
  };
  MOTION['rules-for-rules'] = (g, t, W, H) => {
    t %= 6; g.fillStyle = '#0b1020'; g.fillRect(0, 0, W, H);
    rr(g, 20, 70, 170, 140, 12, '#1a2445', '#7cf5a8'); text(g, 'Правила', 105, 92, '#7cf5a8', 15);
    ['копай 40% скалы', 'выход — дальше всех', 'путь — проверь', 'враг — не у старта'].forEach((s, i) => text(g, '• ' + s, 30, 120 + i * 22, '#f2efe6', 12, 'left', 600));
    arrow(g, 200, 140, 260, 140, '#ffd23f');
    rr(g, 262, 110, 80, 60, 12, '#2a1f0c', '#ffb547'); text(g, '⚙', 302, 140, '#ffb547', 26);
    for (let i = 0; i < 9; i++) {
      const k = ob(seg(t, 0.8 + i * 0.25, 1.2 + i * 0.25)); if (k <= 0) continue;
      const x = 370 + (i % 3) * 85, y = 30 + Math.floor(i / 3) * 80, G0 = GEN.cells(100 + i, 18, 11);
      g.save(); g.translate(x + 38, y + 32); g.scale(k, k); g.translate(-x - 38, -y - 32); drawGen(g, G0.m, { x, y, w: 76, h: 64 }, G0.order, t); g.restore();
    }
    text(g, 'Генератор — дизайнер, который пишет правила для правил', 320, 285, '#f2efe6', 14);
  };
  // --- урок 18: марафон мейкеров ---
  MOTION['maker-loop'] = (g, t, W, H) => {
    t %= 8; g.fillStyle = '#0b1020'; g.fillRect(0, 0, W, H);
    const st = [['🧱', 'Построй'], ['🏁', 'Пройди сам'], ['📤', 'Выложи код'], ['🎮', 'Играют другие'], ['♥', 'Хочу ещё!']];
    const cx = 320, cy = 145, R = 105;
    st.forEach(([ic, name], i) => {
      const a = -Math.PI / 2 + i * TAU / st.length, x = cx + Math.cos(a) * R * 1.6, y = cy + Math.sin(a) * R;
      const on = Math.floor(t / 1.6) % st.length === i;
      rr(g, x - 62, y - 24, 124, 48, 12, on ? '#0c2418' : '#141c36', on ? '#7cf5a8' : '#2a3560'); text(g, ic + ' ' + name, x, y, on ? '#7cf5a8' : '#f2efe6', 14);
    });
    const a = -Math.PI / 2 + (t / 1.6) * TAU / st.length; disc(g, cx + Math.cos(a) * R * 1.25, cy + Math.sin(a) * R * 0.75, 7, '#ffd23f');
    text(g, 'Super Mario Maker: уровень не выложить, пока сам его не прошёл', 320, 285, '#9aa3c7', 13, 'center', 600);
  };
  MOTION['guest-eyes'] = (g, t, W, H) => {
    t %= 7; g.fillStyle = '#0b1020'; g.fillRect(0, 0, W, H);
    const a = ['        F', '      ===', '   ^     ', '@  ^  ###', '#########'].join('\n'), b = ['   ^    F', '  ^ ^  ==', ' ^   ^   ', '@^     ##', '##   ####'].join('\n');
    text(g, 'Уровень автора', 160, 30, '#9aa3c7', 13); text(g, 'Уровень гостя', 480, 30, '#ffb547', 13);
    drawMap(g, a, PALETTES.tropa, { x: 20, y: 44, w: 280, h: 160 }, { t }); drawMap(g, b, PALETTES.tropa, { x: 340, y: 44, w: 280, h: 160 }, { t });
    if (t > 2) { const k = ob(seg(t, 2, 2.6)); g.save(); g.translate(160, 240); g.scale(k, k); text(g, '😮 «Я и не знал, что пружины так можно!»', 0, 0, '#ffd23f', 15); g.restore(); }
    if (t > 4) text(g, 'Гость показал автору его же игру глазами другого дизайнера', 320, 280, '#f2efe6', 14);
  };
  MOTION['three-questions'] = (g, t, W, H) => {
    t %= 6; g.fillStyle = '#0b1020'; g.fillRect(0, 0, W, H);
    [['🎓', 'Учит без слов?'], ['🥁', 'Есть ритм?'], ['🎯', 'Ясна цель?']].forEach(([ic, q], i) => {
      const on = t > 0.8 + i * 1.1, x = 110 + i * 210;
      if (on) glow(g, x, 120, 70, 'rgba(255,224,138,.4)');
      disc(g, x, 120, 42, on ? '#ffe08a' : '#1a2445'); text(g, ic, x, 120, '#0b1020', 30);
      text(g, q, x, 196, on ? '#ffe08a' : '#9aa3c7', 16);
    });
    text(g, 'Три вопроса к каждому уровню — и к своему, и к чужому', 320, 262, '#f2efe6', 14);
  };

  /* =================== motion =================== */
  // Объяснялка: сцены по очереди, «Дальше» — кнопка, пробел, → или A; в конце — итог одной фразой и «Понятно»
  function stepMotion(ctx) {
    const st = ctx.step, N = st.scenes.length;
    let i = ctx.done ? N - 1 : 0, sceneT0 = performance.now();
    const read = el('div', { class: 'm4-cap' }), dots = el('div', { class: 'm4-dots' });
    const cv = el('canvas', { width: 640, height: 300, class: 'm4-cv m4-motion', tabindex: '0', 'aria-label': 'Анимация: ' + (st.title || '') });
    const g = cv.getContext('2d'), pad = padReader();
    const back = el('button', { type: 'button', class: 'btn ghost small', 'data-motion': 'back', onclick: () => go(-1) }, '← Назад');
    const next = el('button', { type: 'button', class: 'btn', 'data-motion': 'next', onclick: () => go(1) });
    const fin = el('div', { class: 'concept m4-sum', hidden: true });
    // интерактивная сцена (модуль 6): у сцены переключатели toggles [{ id, label, on }] — ученик сам включает и выключает приём,
    // сцена получает пятым аргументом ctl { id: true/false, _t: секунды с последнего нажатия, _id: что нажали }. Клавиши 1–4 на холсте
    const ctls = st.scenes.map(sc => Object.assign({ _t: 99, _id: null }, Object.fromEntries((sc.toggles || []).map(x => [x.id, !!x.on]))));
    let ctlT0 = performance.now();
    const tog = el('div', { class: 'm6-toggles', hidden: true });
    function flip(k) {
      const sc = st.scenes[i], x = (sc.toggles || [])[k]; if (!x) return;
      ctls[i][x.id] = !ctls[i][x.id]; ctls[i]._id = x.id; ctlT0 = performance.now(); beep(ctls[i][x.id] ? 'good' : 'tick');
      const v = Object.assign({}, ctx.value || {}); v.tried = Object.assign({}, v.tried); v.tried[sc.anim] = (v.tried[sc.anim] || 0) + 1; ctx.save(v);
      drawToggles();
    }
    function drawToggles() {
      const sc = st.scenes[i], list = sc.toggles || [];
      tog.hidden = !list.length;
      tog.replaceChildren(...(list.length ? [el('span', { class: 'eyebrow' }, sc.try || 'Попробуй сам')] : []),
        ...list.map((x, k) => el('button', { type: 'button', class: 'm6-tog' + (ctls[i][x.id] ? ' on' : ''), 'aria-pressed': String(!!ctls[i][x.id]), 'data-toggle': x.id, onclick: () => flip(k) },
          el('span', { class: 'm4-key' }, String(k + 1)), el('span', { class: 'm6-sw' }, el('i')), x.label)));
    }
    function paint() {
      const sc = st.scenes[i];
      read.replaceChildren(el('div', { class: 'eyebrow' }, `${i + 1} из ${N}`), el('h3', {}, sc.title), el('p', {}, sc.text));
      read.classList.remove('in'); void read.offsetWidth; read.classList.add('in');
      drawToggles();
      dots.replaceChildren(...st.scenes.map((_, k) => el('i', { class: k === i ? 'on' : k < i ? 'ok' : '' })));
      back.disabled = i === 0;
      next.textContent = i < N - 1 ? 'Дальше →' : ctx.done ? 'Прочитано ✓' : 'Понятно ✓';
      const last = i === N - 1;
      fin.hidden = !last || !st.sum; if (st.sum) fin.textContent = st.sum;
    }
    function go(d) {
      if (d > 0 && i === N - 1) { if (!ctx.done) { ctx.save(Object.assign({}, ctx.value || {}, { read: true, seen: N }), true, true); beep('good'); paint(); } return; }
      const n = clamp(i + d, 0, N - 1); if (n === i) return;
      i = n; sceneT0 = performance.now(); beep('tick'); ctx.save(Object.assign({}, ctx.value || {}, { seen: Math.max(i + 1, (ctx.value || {}).seen || 0) })); paint();
    }
    cv.addEventListener('keydown', e => {
      if (['ArrowRight', 'Space', 'Enter'].includes(e.code)) { e.preventDefault(); go(1); } if (e.code === 'ArrowLeft') { e.preventDefault(); go(-1); }
      const d = /^(Digit|Numpad)([1-4])$/.exec(e.code); if (d) { e.preventDefault(); flip(Number(d[2]) - 1); }
    });
    cv.addEventListener('click', () => go(1));
    let raf = 0, last = 0;
    const loop = now => {
      if (!cv.isConnected && now - sceneT0 > 2000) { cancelAnimationFrame(raf); return; }
      // за экраном сцена не рисуется; в автопроверке (LAB_LOWRES) — 10 кадров в секунду, чтобы не отнимать процессор у игр
      const box = cv.getBoundingClientRect(), off = box.bottom < 0 || box.top > innerHeight;
      if ((window.LAB_LOWRES && now - last < 100) || (off && last)) { raf = requestAnimationFrame(loop); return; }
      last = now;
      const sc = st.scenes[i], f = MOTION[sc.anim];
      ctls[i]._t = (now - ctlT0) / 1000;
      g.save(); g.clearRect(0, 0, 640, 300);
      try { if (f) f(g, (now - sceneT0) / 1000 * (fast() ? 2 : 1), 640, 300, ctls[i]); else { g.fillStyle = '#141c36'; g.fillRect(0, 0, 640, 300); text(g, sc.title, 320, 150, '#f2efe6', 18); } } catch (e) { /* сцена не рисуется — текст остаётся */ }
      g.restore();
      const p = pad(); if (p.a || p.right) go(1); if (p.left || p.b) go(-1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    paint();
    return el('div', { class: 'stack m4-motionbox' }, el('div', { class: 'm4-stage' }, cv), tog, read, el('div', { class: 'row' }, back, dots, el('span', { class: 'grow' }), next), fin);
  }

  /* =================== order: «Разложи уровень» =================== */
  function stepOrder(ctx) {
    const st = ctx.step, R = st.rounds, slots = st.slots || ['Ввести', 'Развить', 'Перевернуть', 'Завершить'];
    const pal = PALETTES[st.palette] || PALETTES.tropa;
    let v = Object.assign({ total: 0, correct: 0, perfect: 0, score: 0, mistakes: [], tries: 0 }, ctx.value);
    let r = 0, placed = [], tray = [], wrong = 0, state = 'play', runT0 = 0;
    const host = el('div', { class: 'stack m4-order' });
    const shuffle = n => { const R0 = rng(hashStr((S.me && S.me.nick) + ':' + st.id + ':' + r + ':' + v.tries)); const a = [...Array(n).keys()]; for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(R0() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } if (a.every((x, k) => x === k)) a.reverse(); return a; };
    const mini = (map, w = 200, h = 100) => stage(w, h, (g, t) => { g.fillStyle = '#0b1020'; g.fillRect(0, 0, w, h); drawMap(g, map, pal, { x: 2, y: 2, w: w - 4, h: h - 4 }, { t }); }, 'm4-mini');
    function start() { placed = Array(slots.length).fill(null); tray = shuffle(R[r].pieces.length); wrong = 0; state = 'play'; draw(); }
    function place(pi) {
      if (state !== 'play') return;
      const k = placed.indexOf(null); if (k < 0) return;
      placed[k] = pi; tray = tray.filter(x => x !== pi); beep('tick');
      if (!placed.includes(null)) check(); else draw();
    }
    function unplace(k) { if (state !== 'play' || placed[k] == null) return; tray.push(placed[k]); placed[k] = null; beep('tick'); draw(); }
    function check() {
      const bad = placed.map((p, k) => p !== k);
      if (bad.some(Boolean)) {
        wrong++; state = 'wrong'; beep('bad'); draw(bad);
        setTimeout(() => { if (!host.isConnected) return; placed = placed.map((p, k) => (bad[k] ? null : p)); tray = R[r].pieces.map((_, k) => k).filter(k => !placed.includes(k)); state = 'play'; draw(); }, pause(1500));
        return;
      }
      state = 'run'; runT0 = performance.now(); beep('good');
      v.total++; if (!wrong) { v.correct++; v.perfect++; v.score += 100; } else { v.score += Math.max(20, 100 - wrong * 30); v.mistakes = v.mistakes.concat(R[r].title).slice(-12); }
      ctx.save(v); draw();
    }
    function runner() {
      // пробежка героя по собранному уровню: куски подряд, герой прыгает по клеткам с землёй
      const pcs = R[r].pieces.map(p => p.map), W = 640, H = 120;
      return stage(W, H, (g, t) => {
        t = (performance.now() - runT0) / 1000;
        g.fillStyle = '#0b1020'; g.fillRect(0, 0, W, H);
        const w = (W - 8) / pcs.length;
        pcs.forEach((m, k) => { drawMap(g, m, pal, { x: 4 + k * w, y: 4, w: w - 4, h: H - 8 }, { t }); text(g, slots[k], 4 + k * w + w / 2, 14, '#ffe08a', 11); });
        const k = clamp(t / 4, 0, 1), x = 4 + k * (W - 8);
        hero(g, x, H - 34 - Math.abs(Math.sin(k * Math.PI * 8)) * 26, 8, '#5fe0ff');
        if (k >= 1) confetti(g, W - 30, 40, clamp((t - 4) / 0.8, 0, 1), 16);
      }, 'm4-run');
    }
    function draw(bad) {
      host.innerHTML = '';
      const rd = R[r];
      host.append(el('div', { class: 'row small' }, el('b', {}, `Уровень ${r + 1} из ${R.length}: ${rd.title}`), el('span', { class: 'grow' }), el('span', { class: 'muted' }, `очки ${v.score}`)));
      host.append(el('div', { class: 'm4-slots' }, slots.map((name, k) => {
        const p = placed[k], wrongHere = bad && bad[k];
        return el('button', { type: 'button', class: 'm4-slot' + (p != null ? ' full' : '') + (wrongHere ? ' bad' : '') + (state === 'run' ? ' good' : ''), 'data-slot': k, onclick: () => unplace(k) },
          el('span', { class: 'eyebrow' }, `${k + 1}. ${name}`), p != null ? mini(rd.pieces[p].map) : el('span', { class: 'muted small' }, 'положи кусок'),
          p != null ? el('small', {}, rd.pieces[p].label) : null, wrongHere && rd.pieces[p].hint ? el('small', { class: 'warn-text' }, rd.pieces[p].hint) : null);
      })));
      if (state === 'run') {
        host.append(runner(), el('p', { class: 'verdict good' }, (wrong ? '✓ Собрано. ' : '🎯 С первой попытки! ') + rd.why),
          el('div', {}, el('button', { type: 'button', class: 'btn', 'data-order': 'next', onclick: nextRound }, r < R.length - 1 ? 'Следующий уровень →' : 'Итог')));
        return;
      }
      host.append(el('p', { class: 'muted small' }, 'Нажми кусок — он ляжет в следующую пустую клетку. Нажми клетку — кусок вернётся. Клавиши 1–4.'),
        el('div', { class: 'm4-tray' }, tray.map((pi, n) => el('button', { type: 'button', class: 'm4-piece', 'data-piece': pi, onclick: () => place(pi) },
          el('span', { class: 'm4-key' }, String(n + 1)), mini(rd.pieces[pi].map), el('small', {}, rd.pieces[pi].label)))));
      if (state === 'wrong') host.append(el('p', { class: 'verdict bad' }, 'Не в том порядке: красные куски вернутся на стол. Подумай: где игрок пробует без риска, а где его проверяют?'));
    }
    function nextRound() {
      if (r < R.length - 1) { r++; start(); return; }
      v.tries++; ctx.save(v, true, true); beep('done');
      host.innerHTML = '';
      host.append(el('h2', {}, `Собрано уровней: ${v.total} · с первой попытки ${v.perfect}`), el('p', { class: 'concept' }, st.after || 'Ввести → развить → перевернуть → завершить: так уровень учит без слов.'),
        el('div', {}, el('button', { type: 'button', class: 'btn ghost small', onclick: () => { v = Object.assign({}, v, { total: 0, correct: 0, perfect: 0, score: 0, mistakes: [] }); r = 0; start(); } }, '↻ Ещё раз')));
    }
    host.tabIndex = 0;
    host.addEventListener('keydown', e => { const n = Number(e.key); if (n >= 1 && n <= tray.length) { e.preventDefault(); place(tray[n - 1]); } if (e.key === 'Backspace') { const k = placed.map((p, i) => (p != null ? i : -1)).filter(i => i >= 0).pop(); if (k != null) unplace(k); } });
    if (ctx.done) { host.append(el('h2', {}, `Собрано уровней: ${v.total} · с первой попытки ${v.perfect}`), el('p', { class: 'concept' }, st.after || 'Ввести → развить → перевернуть → завершить: так уровень учит без слов.'), el('div', {}, el('button', { type: 'button', class: 'btn ghost small', onclick: () => { r = 0; start(); } }, '↻ Сыграть ещё раз'))); return host; }
    start();
    return host;
  }

  /* =================== mapquiz =================== */
  // Решение Sokoban для анимации ответа: path — строка ходов LRUD
  function sokoSim(map, path) {
    let m = rows(map).map(r => [...r]);
    let px = 0, py = 0; m.forEach((r, j) => r.forEach((c, i) => { if (c === '@' || c === '+') { px = i; py = j; } }));
    const frames = [m.map(r => r.join('')).join('\n')];
    const D = { L: [-1, 0], R: [1, 0], U: [0, -1], D: [0, 1] };
    for (const ch of String(path || '').toUpperCase()) {
      const d = D[ch]; if (!d) continue;
      const at = (x, y) => (m[y] && m[y][x]) || '#', goal = c => c === '.' || c === '*' || c === '+';
      const nx = px + d[0], ny = py + d[1], c1 = at(nx, ny);
      if (c1 === '#') continue;
      if (c1 === '$' || c1 === '*') { const bx = nx + d[0], by = ny + d[1], c2 = at(bx, by); if (c2 === '#' || c2 === '$' || c2 === '*') continue; m[by][bx] = goal(c2) ? '*' : '$'; m[ny][nx] = goal(c1) ? '.' : ' '; }
      m[py][px] = goal(m[py][px]) ? '.' : ' '; m[ny][nx] = goal(m[ny][nx]) ? '+' : '@'; px = nx; py = ny;
      frames.push(m.map(r => r.join('')).join('\n'));
    }
    return frames;
  }
  // кадр «Куда ты пойдёшь?»: три тропы, у одной — главная подсказка дизайнера (cue)
  function drawScene(g, W, H, sc, t, reveal) {
    const fogged = !!sc.fog;
    sky(g, W, H, sc.sky || '#5a6fa8', sc.horizon || '#f0b98a');
    g.fillStyle = sc.hills || '#6a6f9a'; g.beginPath(); g.moveTo(0, 150); g.lineTo(120, 120); g.lineTo(260, 140); g.lineTo(380, 110); g.lineTo(520, 135); g.lineTo(W, 115); g.lineTo(W, H); g.lineTo(0, H); g.fill();
    g.fillStyle = sc.ground || '#7a8a4a'; g.fillRect(0, 160, W, H - 160);
    const ends = { left: [90, 158], mid: [320, 150], right: [550, 158] };
    for (const [k, p] of Object.entries(sc.paths || {})) {
      const [ex, ey] = ends[k], wide = p.open ? 110 : p.narrow ? 18 : 40;
      g.fillStyle = p.color || sc.pathColor || '#b8a37a';
      g.beginPath(); g.moveTo(320 - (k === 'left' ? 160 : k === 'right' ? -60 : 50), H); g.lineTo(320 + (k === 'right' ? 160 : k === 'left' ? -60 : 50), H); g.lineTo(ex + wide / 2, ey); g.lineTo(ex - wide / 2, ey); g.fill();
      if (p.narrow) { g.fillStyle = '#4a4f62'; g.fillRect(ex - 60, ey - 70, 46, 80); g.fillRect(ex + 14, ey - 70, 46, 80); }
      if (p.light) { const pu = 0.7 + 0.3 * Math.sin(t * 4); glow(g, ex, ey - 40, 60 * pu, 'rgba(255,240,180,.85)'); disc(g, ex, ey - 40, 7, '#fffbe0'); }
      if (p.landmark) { g.fillStyle = '#ffb547'; g.fillRect(ex - 8, ey - 90, 16, 90); disc(g, ex, ey - 92, 10, '#ffe08a'); }
      if (p.crumbs) for (let i = 0; i < 6; i++) { const k2 = i / 6, x = lerp(320 + (k === 'left' ? -100 : k === 'right' ? 100 : 0), ex, k2), y = lerp(H - 10, ey + 6, k2); glow(g, x, y, 14 * (1 - k2 * 0.6), 'rgba(255,210,63,.7)'); disc(g, x, y, 4 * (1 - k2 * 0.6), '#ffd23f'); }
      if (p.dark) { g.fillStyle = 'rgba(10,8,20,.55)'; g.fillRect(ex - 90, ey - 100, 180, 140); }
      if (p.contrast) { glow(g, ex, ey - 10, 40, 'rgba(255,93,110,.6)'); disc(g, ex, ey - 10, 12, '#ff5d6e'); }
    }
    if (fogged) { g.fillStyle = 'rgba(220,220,235,.35)'; g.fillRect(0, 90, W, 90); }
    hero(g, 320, H - 26, 12, '#5fe0ff');
    if (reveal) {
      const [ex, ey] = ends[sc.cue];
      g.strokeStyle = '#ffd23f'; g.lineWidth = 4; g.setLineDash([8, 6]); g.beginPath(); g.arc(ex, ey - 30, 62 + 4 * Math.sin(t * 6), 0, TAU); g.stroke(); g.setLineDash([]);
      rr(g, ex - 80, ey - 128, 160, 30, 8, 'rgba(11,16,32,.85)'); text(g, sc.cueText || 'повело сюда', ex, ey - 113, '#ffd23f', 13);
    }
  }
  function stepMapquiz(ctx) {
    const st = ctx.step, R = st.rounds, kind = st.kind || 'map', pal = PALETTES[st.palette] || PALETTES.zagon;
    let v = Object.assign({ total: 0, correct: 0, score: 0, bestStreak: 0, mistakes: [], tries: 0 }, ctx.value);
    let r = 0, streak = 0, answered = null, glyph = kind === 'map' && st.glyphFirst !== false, t0 = performance.now(), timerOn = true;
    const host = el('div', { class: 'stack m4-quiz', tabindex: '0' }), pad = padReader();
    const W = 640, H = kind === 'gen' ? 200 : 280;
    const cv = el('canvas', { width: W, height: H, class: 'm4-cv' }), g = cv.getContext('2d');
    const bar = el('div', { class: 'm4-timer' }, el('i'));
    const optsBox = el('div', { class: 'm4-opts' }), verdict = el('div'), head = el('div', { class: 'row small' }), qEl = el('p', { class: 'bigq' });
    let raf = 0;
    const gens = rd => (rd.gen || []).map(x => GEN[x.rule] ? GEN[x.rule](x.seed, 26, 15) : GEN.walk(x.seed, 26, 15));
    let cache = null;
    function paintCanvas(now) {
      const rd = R[r], t = (now - t0) / 1000;
      g.clearRect(0, 0, W, H);
      if (kind === 'map') {
        let map = rd.map;
        if (answered && rd.path) { const fr = cache || (cache = sokoSim(rd.map, rd.path)); map = fr[Math.min(fr.length - 1, Math.floor(clamp(t - 0.4, 0, 99) * 5))]; }
        g.fillStyle = '#0b1020'; g.fillRect(0, 0, W, H);
        const L = drawMap(g, map, pal, { x: 10, y: 10, w: W - 20, h: H - 20 }, { t, glyph: glyph && !answered });
        if (answered && rd.marks) rd.marks.forEach(([x, y]) => { const p = 0.5 + 0.5 * Math.sin(t * 8); g.strokeStyle = `rgba(255,93,110,${0.5 + p * 0.5})`; g.lineWidth = 4; g.strokeRect(L.ox + x * L.s + 2, L.oy + y * L.s + 2, L.s - 4, L.s - 4); });
      } else if (kind === 'gen') {
        const gs = cache || (cache = gens(rd)), w = (W - 20) / gs.length;
        g.fillStyle = '#0b1020'; g.fillRect(0, 0, W, H);
        gs.forEach((G0, i) => { const n = Math.floor(G0.order.length * clamp((t - i * 0.2) / 2.2, 0, 1)); drawGen(g, G0.m, { x: 10 + i * w, y: 10, w: w - 10, h: H - 20 }, G0.order.slice(0, n), t); });
      } else drawScene(g, W, H, rd.scene, t, !!answered);
      // таймер: в «Куда ты пойдёшь?» кадр виден seconds секунд, потом закрывается туманом
      const secs = rd.seconds || st.seconds || 0;
      if (secs && !answered && timerOn) {
        const left = clamp(1 - t / (secs * (fast() ? 0.5 : 1)), 0, 1); bar.firstChild.style.width = (left * 100) + '%';
        if (left <= 0 && kind === 'scene') { g.fillStyle = 'rgba(200,205,225,.92)'; g.fillRect(0, 0, W, H); text(g, 'Куда пойдёшь? Выбирай!', W / 2, H / 2, '#1a2445', 22); }
      }
    }
    const loop = now => { if (!cv.isConnected && now - t0 > 2000) { cancelAnimationFrame(raf); return; } paintCanvas(now); const p = pad(); if (!answered) { const opts = R[r].options; if (p.left && kind === 'scene') pick(opts[0]); if (p.up && kind === 'scene') pick(opts[1]); if (p.right && kind === 'scene') pick(opts[2]); } else if (p.a) next(); raf = requestAnimationFrame(loop); };
    function pick(o) {
      if (answered) return;
      const rd = R[r]; answered = o; t0 = performance.now(); cache = null;
      const ok = o === rd.answer;
      v.total++; if (ok) { v.correct++; streak++; v.score += 100 + streak * 10; v.bestStreak = Math.max(v.bestStreak, streak); beep('good'); } else { streak = 0; v.mistakes = v.mistakes.concat(rd.q ? rd.q.slice(0, 40) : String(r + 1)).slice(-12); beep('bad'); }
      ctx.save(v); paint();
    }
    function next() { if (r < R.length - 1) { r++; answered = null; t0 = performance.now(); cache = null; glyph = kind === 'map' && st.glyphFirst !== false; paint(); return; } finish(); }
    function finish() {
      v.tries++; ctx.save(v, true, true); beep('done'); cancelAnimationFrame(raf);
      host.innerHTML = '';
      host.append(el('h2', {}, `Верно ${v.correct} из ${v.total} · очки ${v.score}`), st.after ? el('p', { class: 'concept' }, st.after) : '',
        el('div', {}, el('button', { type: 'button', class: 'btn ghost small', onclick: () => { v = Object.assign({}, v, { total: 0, correct: 0, score: 0, bestStreak: 0, mistakes: [] }); r = 0; answered = null; streak = 0; build(); } }, '↻ Ещё раз')));
    }
    function paint() {
      const rd = R[r];
      qEl.textContent = rd.q || st.question || '';
      head.replaceChildren(el('b', {}, `${r + 1} из ${R.length}`), el('span', { class: 'grow' }), el('span', { class: 'muted' }, `очки ${v.score}` + (streak > 1 ? ` · серия ×${streak}` : '')));
      optsBox.replaceChildren(...rd.options.map((o, k) => el('button', { type: 'button', class: 'opt m4-opt' + (answered ? (o === rd.answer ? ' good' : o === answered ? ' bad' : ' dim') : ''), 'data-quiz': k, disabled: !!answered, onclick: () => pick(o) },
        el('span', { class: 'm4-key' }, kind === 'scene' ? ['←', '↑', '→'][k] || String(k + 1) : String(k + 1)), o)));
      verdict.replaceChildren();
      if (answered) {
        const ok = answered === rd.answer;
        verdict.append(el('p', { class: 'verdict ' + (ok ? 'good' : 'bad') }, (ok ? '🎯 ' : 'Не совсем. ') + rd.why),
          el('div', {}, el('button', { type: 'button', class: 'btn', 'data-quiz': 'next', onclick: next }, r < R.length - 1 ? 'Дальше →' : 'Итог')));
      }
      bar.hidden = !(rd.seconds || st.seconds) || !!answered;
    }
    function build() {
      host.innerHTML = '';
      const tools = kind === 'map' ? el('div', { class: 'row small' }, el('button', { type: 'button', class: 'btn ghost small', 'data-quiz': 'flip', onclick: () => { glyph = !glyph; beep('tick'); } }, '🔤 Символы ↔ 🖼 Картинка'),
        el('span', { class: 'muted' }, st.legendText || '')) : null;
      host.append(...[head, qEl, el('div', { class: 'm4-stage' }, cv), bar, tools, optsBox, verdict].filter(Boolean));
      t0 = performance.now(); paint();
      cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    }
    host.addEventListener('keydown', e => {
      if (answered) { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); next(); } return; }
      const opts = R[r].options, n = Number(e.key);
      if (n >= 1 && n <= opts.length) { e.preventDefault(); pick(opts[n - 1]); }
      if (kind === 'scene') { const m = { ArrowLeft: 0, ArrowUp: 1, ArrowRight: 2 }[e.code]; if (m != null && opts[m]) { e.preventDefault(); pick(opts[m]); } }
    });
    if (ctx.done) {
      host.append(el('h2', {}, `Верно ${v.correct} из ${v.total} · очки ${v.score}`), st.after ? el('p', { class: 'concept' }, st.after) : '', el('div', {}, el('button', { type: 'button', class: 'btn ghost small', onclick: () => { v = Object.assign({}, v, { total: 0, correct: 0, score: 0, mistakes: [] }); build(); } }, '↻ Пройти ещё раз')));
      return host;
    }
    build();
    return host;
  }

  /* =================== heat: тепловая карта своей игры =================== */
  function stepHeat(ctx) {
    const st = ctx.step, mode = st.mode || 'deaths';
    let v = Object.assign({ marks: [], reason: null }, ctx.value);
    const host = el('div', { class: 'stack m4-heat' });
    let data = null, li = 0, who = 'others', t0 = performance.now();
    const W = 640, H = 300;
    const cv = el('canvas', { width: W, height: H, class: 'm4-cv m4-heatcv', 'aria-label': 'Тепловая карта уровня' }), g = cv.getContext('2d');
    let L = null, raf = 0;
    const list = () => (data ? (who === 'mine' ? data.heatMine : data.heat) || [] : []);
    const at = (x) => (Number.isInteger(x) ? x + 0.5 : x);
    function paintCanvas(now) {
      const hs = list(), h = hs[li];
      g.fillStyle = '#0b1020'; g.fillRect(0, 0, W, H);
      if (!h) { text(g, who === 'mine' ? 'Сыграй в свою игру — здесь появится твой след' : 'Пока никто из соседей не сыграл в твою игру', W / 2, H / 2, '#9aa3c7', 15); return; }
      const t = (now - t0) / 1000;
      const pal = PALETTES[st.palette] || autoPalette(Object.fromEntries([...new Set(h.map.replace(/\n/g, ''))].map(c => [c, ''])));
      L = drawMap(g, h.map, pal, { x: 8, y: 8, w: W - 16, h: H - 16 }, { t });
      g.fillStyle = 'rgba(11,16,32,.45)'; g.fillRect(L.ox, L.oy, L.w * L.s, L.h * L.s);
      // следы: копятся синим, смерти падают каплями и растекаются красным
      if (mode !== 'deaths') h.trail.forEach(([x, y], i) => { if (i / h.trail.length > t / 2.5) return; glow(g, L.ox + at(x) * L.s, L.oy + at(y) * L.s, L.s * 1.2, 'rgba(95,224,255,.18)'); });
      if (mode !== 'trail') h.deaths.forEach(([x, y], i) => {
        const k = seg(t, 0.4 + i * 0.12, 0.9 + i * 0.12); if (k <= 0) return;
        const px = L.ox + at(x) * L.s, py = L.oy + at(y) * L.s;
        if (k < 1) disc(g, px, lerp(L.oy - 10, py, k * k), Math.max(3, L.s * 0.2), '#ff5d6e'); else glow(g, px, py, L.s * 1.6, 'rgba(255,60,80,.45)');
      });
      (h.secrets || []).forEach(([x, y]) => { disc(g, L.ox + at(x) * L.s, L.oy + at(y) * L.s, L.s * 0.25, '#b49bff'); });
      (v.marks || []).filter(m => m.level === h.name).forEach(m => { const px = L.ox + m.x * L.s, py = L.oy + m.y * L.s; g.fillStyle = '#ffd23f'; g.fillRect(px - 1, py - L.s * 1.2, 2, L.s * 1.2); g.beginPath(); g.moveTo(px + 1, py - L.s * 1.2); g.lineTo(px + L.s * 0.7, py - L.s * 0.95); g.lineTo(px + 1, py - L.s * 0.7); g.fill(); });
    }
    const loop = now => { if (!cv.isConnected && now - t0 > 2500) { cancelAnimationFrame(raf); return; } paintCanvas(now); raf = requestAnimationFrame(loop); };
    cv.addEventListener('click', e => {
      const h = list()[li]; if (!h || !L) return;
      const b = cv.getBoundingClientRect(), x = ((e.clientX - b.left) * W / b.width - L.ox) / L.s, y = ((e.clientY - b.top) * H / b.height - L.oy) / L.s;
      if (x < 0 || y < 0 || x > L.w || y > L.h) return;
      v.marks = (v.marks || []).filter(m => m.level !== h.name).concat({ level: h.name, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
      beep('tick'); ctx.save(v); draw();
    });
    function summary(h) {
      if (!h) return '';
      const cells = {}; h.deaths.forEach(([x, y]) => { const k = Math.floor(x) + ',' + Math.floor(y); cells[k] = (cells[k] || 0) + 1; });
      const top = Object.entries(cells).sort((a, b) => b[1] - a[1])[0];
      return mode === 'trail' ? `Партий: ${h.runs} · игроков: ${h.players} · точек следа: ${h.trail.length}` + ((h.secrets || []).length ? ` · секретов нашли: ${h.secrets.length}` : '')
        : `Партий: ${h.runs} · игроков: ${h.players} · смертей: ${h.deaths.length}` + (top ? ` · больше всего — клетка ${top[0].replace(',', ', ')}: ${top[1]}` : '');
    }
    function draw() {
      host.innerHTML = '';
      if (!hasGame()) { host.append(el('p', { class: 'muted' }, 'Тепловая карта появится, когда соберёшь игру и соседи сыграют в неё.')); return; }
      const hs = list();
      if (li >= hs.length) li = 0;
      host.append(el('div', { class: 'row' },
        el('div', { class: 'seg', role: 'radiogroup' }, [['others', '👥 Соседи'], ['mine', '🙋 Мои партии']].map(([id, label]) => el('button', { type: 'button', class: 'opt' + (who === id ? ' on' : ''), 'data-heat': id, onclick: () => { who = id; li = 0; t0 = performance.now(); draw(); } }, label))),
        el('span', { class: 'grow' }), el('button', { type: 'button', class: 'btn ghost small', 'data-heat': 'reload', onclick: load }, '↻ Обновить')));
      if (hs.length > 1) host.append(el('div', { class: 'row', style: 'gap:6px' }, hs.map((h, k) => el('button', { type: 'button', class: 'chipbtn' + (k === li ? ' on' : ''), onclick: () => { li = k; t0 = performance.now(); draw(); } }, h.name || 'Уровень ' + (k + 1)))));
      host.append(el('div', { class: 'm4-stage' }, cv), el('p', { class: 'small muted' }, summary(hs[li])),
        el('div', { class: 'row small m4-legend' }, mode !== 'trail' ? el('span', {}, el('i', { class: 'dot red' }), 'где погибали') : null, mode !== 'deaths' ? el('span', {}, el('i', { class: 'dot blue' }), 'где ходили') : null, el('span', {}, el('i', { class: 'dot gold' }), 'твоя отметка')));
      if (!hs.length) return;
      const marked = (v.marks || []).length;
      host.append(el('p', { class: 'bigq' }, st.question || 'Где уровень не учит? Нажми на это место на карте.'));
      if (marked) {
        host.append(tiles((st.reasons || ['Опасность не видно заранее', 'Приём не показали без риска', 'Сразу слишком трудно', 'Непонятно, куда идти']).map(x => ({ id: x, icon: '🔧', label: x })), v.reason, it => {
          v.reason = it.id; v.finding = `${(v.marks.slice(-1)[0] || {}).level || 'уровень'}: ${it.id}`; ctx.save(v, true, true); beep('good'); draw();
        }, { attr: 'data-reason', label: 'Почему' }));
        if (v.reason) host.append(el('p', { class: 'verdict good' }, `📍 Находка для правки: ${v.finding}. Возьми её в «Правку 2».`));
      }
    }
    async function load() {
      try { data = (await api('/api/playtest/mine')).discovery; } catch (e) { data = null; }
      if (data && !(data.heat || []).length && (data.heatMine || []).length) who = 'mine';
      t0 = performance.now(); draw();
    }
    S.hooks.push(kind => { if (kind === 'arcade') load(); });
    raf = requestAnimationFrame(loop);
    host.append(el('p', { class: 'muted' }, 'Загружаем тепловую карту…'));
    load();
    return host;
  }

  /* =================== leveledit: редактор уровня =================== */
  const KIND_UI = { train: ['🎓', 'Обучающий', 'учит без слов: безопасная проба → риск → проверка'], tricky: ['😈', 'Коварный', 'хитрый, но честный: опасность видна заранее'], free: ['🧱', 'Свой уровень', 'любой — главное, пройди его сам'] };
  function stepLeveledit(ctx) {
    const st = ctx.step, kinds = st.kinds || ['free'];
    let v = Object.assign({ levels: {}, kind: kinds[0], maps: {}, titles: {} }, ctx.value);
    const host = el('div', { class: 'stack m4-edit' }), ui = el('div', { class: 'stack' }), fbox = el('div', { class: 'stack' });
    let target = null, frame = null, legend = null, base = [], pal = null, tool = null, cleared = null, cursor = [0, 0], textMode = false, probeTimer = 0;
    let map = null; // массив строк-массивов
    const keyOf = () => (target.remake ? 'remake:' + target.remake : 'game:' + target.id);
    const srcOf = () => (target.remake ? '/engine/game.html?game=../' + target.remake : `/play/${target.id}/${target.version}`);
    const asText = () => map.map(r => r.join('').replace(/\s+$/, '')).join('\n');
    const setMap = txt => { const r = rows(txt), w = Math.max(...r.map(l => l.length)); map = r.map(l => [...l.padEnd(w, ' ')]); };
    let fellBack = false;
    async function findTarget() {
      if (st.target === 'remake') return { remake: st.game, title: st.gameTitle || S.lesson.donor, author: 'донор урока' };
      // своя игра (урок 15): уровень встанет в неё после своих; игры нет или она не читает карты — уровень для донора урока
      if (st.target === 'mine') return hasGame() ? { id: S.game.id, version: S.game.current, title: S.game.title || 'Моя игра', author: S.me.nick, mine: true } : fallbackTarget();
      const about = st.about && ans(st.about).value;
      if (about && about.game) { const a = await api('/api/arcade'); const c = a.games.find(x => x.id === about.game); if (c) return { id: c.id, version: c.version, title: c.title, author: c.nick, lesson: c.lesson }; }
      const a = await api('/api/arcade');
      let n = a.neighbour;
      if (st.lessons) { // марафон (урок 18): игра соседа из нужных уроков — по кругу, у соседа берём последнюю
        const by = new Map();
        for (const c of a.games) if (c.nick !== S.me.nick && !c.hidden && c.lesson && st.lessons.includes(c.lesson.number) && (!by.has(c.nick) || by.get(c.nick).lesson.number < c.lesson.number)) by.set(c.nick, c);
        const pool = [...by.values()].sort((x, y) => x.nick.localeCompare(y.nick, 'ru'));
        n = pool.find(c => c.nick.localeCompare(S.me.nick, 'ru') > 0) || pool[0] || null;
      }
      if (n) return { id: n.id, version: n.version, title: n.title, author: n.nick, lesson: n.lesson };
      return st.fallback || st.fallbacks ? fallbackTarget(null, 'none') : null;
    }
    function probe() {
      // игра сама говорит свою легенду и уровни (portal.levels / lab.levels) — по ним палитра и заготовка
      if (frame) frame.destroy();
      legend = null;
      frame = Games.frame({
        src: srcOf, key: () => (target.remake ? 'remake:' + st.id : 'game:' + target.id), score: false, autostart: true, label: 'Играть: ' + target.title,
        onLevels: L => {
          if (legend) return;
          legend = L.legend || {}; base = (L.list || []).filter(x => x && x.map);
          pal = st.palette ? Object.assign(autoPalette(legend), PALETTES[st.palette]) : autoPalette(legend);
          if (!v.maps[v.kind]) setMap(st.template || (base[0] ? base[0].map : blank()));
          else setMap(v.maps[v.kind]);
          clearTimeout(probeTimer); draw();
        },
        onReady: () => { clearTimeout(probeTimer); probeTimer = setTimeout(() => {
          if (legend) return;
          if ((target.mine || st.target === 'neighbour') && !target.remake && (st.fallback || st.fallbacks)) { // игра не читает уровни-карты — строим для донора её урока
            const who = target.author; target = fallbackTarget(target.lesson && target.lesson.number, target.mine ? 'mine' : 'neighbour'); target.forAuthor = who; v.maps = {}; probe(); draw(); return;
          }
          legend = false; draw();
        }, fast() ? 4000 : 8000); },
        onClear: m => onClear(m),
      });
      fbox.replaceChildren(frame.box);
    }
    function fallbackTarget(lessonNo, why) {
      fellBack = why || 'mine';
      const f = (st.fallbacks && lessonNo && st.fallbacks[lessonNo]) || st.fallback;
      if (!f) return null;
      const file = typeof f === 'string' ? f : f.file, title = typeof f === 'string' ? st.fallbackTitle || S.lesson.donor : f.title;
      return { remake: file, title, author: 'донор урока' };
    }
    const blank = () => { const [w, h] = st.size || [20, 10]; return Array.from({ length: h }, (_, j) => (j === h - 1 ? '#'.repeat(w) : ' '.repeat(w))).join('\n'); };
    function onClear(m) {
      if (!map || !frame || !frame.testing) return;
      if ((m.map || '').trim() && rows(m.map).join('\n').replace(/\s+$/gm, '') !== asText().replace(/\s+$/gm, '')) return; // прошёл не этот уровень
      cleared = { moves: m.moves, time: m.time, map: asText() }; beep('done'); toast('Уровень пройден! Теперь его можно выложить.', 'ok'); draw();
    }
    function play() {
      v.maps[v.kind] = asText(); ctx.save(v);
      if (frame) frame.destroy();
      frame = Games.frame({
        src: () => Games.withLevels(srcOf(), [{ name: v.titles[v.kind] || KIND_UI[v.kind][1], map: asText(), author: S.me.nick }], 'only'),
        key: () => (target.remake ? 'remake:' + st.id + ':test' : 'game:' + target.id), score: false, autostart: true, label: 'Пройди свой уровень',
        onClear: m => onClear(m),
      });
      frame.testing = true; fbox.replaceChildren(el('p', { class: 'small muted' }, 'Проба: только твой уровень. Дойди до цели — портал засчитает.'), frame.box); draw();
    }
    async function publish(titleIn) {
      if (!cleared || cleared.map !== asText()) { toast('Сначала пройди уровень сам — после правки карты ещё раз'); return; }
      const title = (titleIn.value || '').trim() || `${KIND_UI[v.kind][1]} от ${S.me.nick}`;
      try {
        const r = await api('/api/levels', { game: keyOf(), title, kind: v.kind, map: asText(), cleared });
        if (target.mine) await api('/api/levels/accept', { code: r.level.code, on: true }).catch(() => {}); // свой уровень сразу встаёт в свою игру
        v.levels = Object.assign({}, v.levels, { [v.kind]: { code: r.level.code, title, par: r.level.par, parTime: r.level.parTime, game: keyOf() } });
        v.titles[v.kind] = title;
        const done = kinds.every(k => v.levels[k]) && Object.keys(v.levels).length >= (st.need || kinds.length);
        ctx.save(v, done ? true : null, true); beep('done'); toast(`Уровень выложен: код ${r.level.code}`, 'ok');
        const nextKind = kinds.find(k => !v.levels[k]); if (nextKind) { v.kind = nextKind; cleared = null; setMap(v.maps[nextKind] || st.template || (base[0] ? base[0].map : blank())); }
        draw();
      } catch (e) { toast(e.message, 'err'); }
    }
    function paintGrid(cv) {
      const g = cv.getContext('2d'), H = map.length, Wd = map[0].length;
      const s = Math.floor(Math.min(640 / Wd, 360 / H)); cv.width = Wd * s; cv.height = H * s;
      let raf = 0; const t0 = performance.now();
      const loop = now => {
        if (!cv.isConnected && now - t0 > 1500) { cancelAnimationFrame(raf); return; }
        if (map.length !== H || map[0].length !== Wd) { raf = requestAnimationFrame(loop); return; } // карту заменили — этот холст уже старый
        const t = (now - t0) / 1000;
        for (let j = 0; j < H; j++) for (let i = 0; i < Wd; i++) drawTile(g, map[j][i], pal[map[j][i]] || pal[' '] || ['#1b2a4a', 'empty'], i * s, j * s, s, t);
        g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1;
        for (let i = 0; i <= Wd; i++) { g.beginPath(); g.moveTo(i * s + 0.5, 0); g.lineTo(i * s + 0.5, H * s); g.stroke(); }
        for (let j = 0; j <= H; j++) { g.beginPath(); g.moveTo(0, j * s + 0.5); g.lineTo(Wd * s, j * s + 0.5); g.stroke(); }
        g.strokeStyle = '#ffd23f'; g.lineWidth = 2; g.strokeRect(cursor[0] * s + 1, cursor[1] * s + 1, s - 2, s - 2);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      let down = false;
      const cellAt = e => { const b = cv.getBoundingClientRect(); return [Math.floor((e.clientX - b.left) * cv.width / b.width / s), Math.floor((e.clientY - b.top) * cv.height / b.height / s)]; };
      const paintAt = ([i, j]) => { if (map[j] && map[j][i] != null && map[j][i] !== tool) { map[j][i] = tool; cursor = [i, j]; changed(); } };
      cv.addEventListener('pointerdown', e => { down = true; cv.setPointerCapture(e.pointerId); paintAt(cellAt(e)); });
      cv.addEventListener('pointermove', e => { if (down) paintAt(cellAt(e)); });
      cv.addEventListener('pointerup', () => { down = false; });
      cv.tabIndex = 0;
      cv.addEventListener('keydown', e => {
        const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.code];
        if (d) { e.preventDefault(); cursor = [clamp(cursor[0] + d[0], 0, Wd - 1), clamp(cursor[1] + d[1], 0, H - 1)]; }
        if (e.code === 'Space') { e.preventDefault(); paintAt(cursor); }
      });
    }
    function changed() {
      if (cleared && cleared.map !== asText()) { cleared = null; const s = host.querySelector('[data-edit=status]'); if (s) s.replaceWith(status()); }
      v.maps[v.kind] = asText(); ctx.save(v);
      const ta = host.querySelector('textarea.m4-maptext'); if (ta && document.activeElement !== ta) ta.value = asText();
    }
    const status = () => el('div', { 'data-edit': 'status', class: 'small ' + (cleared ? 'ok-text' : 'warn-text') }, cleared ? `✓ Пройден тобой: ${cleared.moves != null ? cleared.moves + ' ходов · ' : ''}${cleared.time} с — можно выкладывать` : '⚠ Ещё не пройден: «▶ Пройди сам» — как в Super Mario Maker');
    // рамка игры живёт в fbox и не переносится по странице: перенос перезагрузил бы игру
    function draw() {
      ui.innerHTML = '';
      const host = ui;
      host.append(el('div', { class: 'm4-for' }, el('span', { class: 'ti' }, target.remake ? '🎮' : target.mine ? '⭐' : '👤'), el('div', {}, el('div', { class: 'eyebrow' }, 'Строишь уровень для игры'), el('b', {}, `«${target.title}»`),
        el('div', { class: 'small muted' }, target.remake ? 'донор урока' : target.mine ? 'твоя игра: уровень встанет в неё после твоих' : `автор — ${target.author}`))));
      if (fellBack === 'neighbour') host.append(el('div', { class: 'stack', style: 'gap:6px' }, el('p', { class: 'small warn-text' }, `Игра ${target.forAuthor || 'соседа'} пока не читает уровни-карты, поэтому уровни — для донора её урока. Подскажи автору просьбу для Qwen:`),
        st.addLevels ? el('div', { class: 'row' }, el('pre', { class: 'm4-ask grow' }, st.addLevels), el('button', { type: 'button', class: 'btn ghost small', onclick: () => Lab.copy(st.addLevels) }, '⧉ Скопировать')) : null));
      else if (fellBack === 'none') host.append(el('p', { class: 'small warn-text' }, 'У соседей пока нет игр модуля с уровнями, поэтому уровни — для донора урока.'));
      else if (fellBack) host.append(el('p', { class: 'small warn-text' }, hasGame() ? 'Твоя игра пока не читает уровни-карты, поэтому уровень — для донора урока. Попроси Qwen в «Правке 2»: «научи игру уровням как данным».' : 'Своей игры ещё нет — строим уровень для донора урока.'));
      if (kinds.length > 1 || kinds[0] !== 'free') host.append(tiles(kinds.map(k => ({ id: k, icon: KIND_UI[k][0], label: KIND_UI[k][1], sub: v.levels[k] ? `✓ код ${v.levels[k].code}` : KIND_UI[k][2] })), v.kind, it => {
        v.maps[v.kind] = map ? asText() : v.maps[v.kind]; v.kind = it.id; cleared = null; setMap(v.maps[it.id] || st.template || (base[0] ? base[0].map : blank())); ctx.save(v); draw();
      }, { attr: 'data-kind', label: 'Какой уровень' }));
      if (legend === null) { host.append(el('p', { class: 'muted' }, 'Игра загружается и рассказывает свою легенду…')); return; }
      if (legend === false) {
        host.append(el('div', { class: 'card locked-msg' }, el('h3', {}, 'Эта игра не читает уровни-карты'),
          el('p', { style: 'margin-top:6px' }, 'Автор не попросил Qwen сделать «уровни как данные». Подскажи соседу: пусть отправит в свой чат Qwen просьбу ниже. А ты пока построй уровень для донора урока.'),
          st.addLevels ? el('pre', { class: 'm4-ask' }, st.addLevels) : null,
          st.addLevels ? el('div', {}, el('button', { type: 'button', class: 'btn ghost small', onclick: () => Lab.copy(st.addLevels) }, '⧉ Скопировать просьбу для автора')) : null));
        return;
      }
      const chars = Object.keys(pal).filter(c => c !== '\n');
      if (!tool || !chars.includes(tool)) tool = chars.find(c => c !== ' ') || ' ';
      const palette = el('div', { class: 'm4-pal', role: 'radiogroup', 'aria-label': 'Клетки' }, chars.map((c, n) => {
        const cvs = el('canvas', { width: 30, height: 30 }); const gg = cvs.getContext('2d'); drawTile(gg, c, pal[c], 0, 0, 30, 0);
        return el('button', { type: 'button', class: 'm4-chip' + (c === tool ? ' on' : ''), 'data-char': c === ' ' ? 'space' : c, title: `${n < 9 ? n + 1 + ' · ' : ''}${legend[c] || (c === ' ' ? 'пусто' : c)}`, onclick: () => { tool = c; beep('tick'); draw(); } },
          cvs, el('code', {}, c === ' ' ? '␣' : c), el('small', {}, legend[c] || (c === ' ' ? 'пусто' : '')));
      }));
      const gridCv = el('canvas', { class: 'm4-grid' }); paintGrid(gridCv);
      const ta = el('textarea', { class: 'm4-maptext', spellcheck: 'false', rows: String(map.length + 1), 'aria-label': 'Уровень текстом', hidden: !textMode }, asText());
      ta.addEventListener('input', () => { const txt = ta.value; if (!txt.trim()) return; const keepW = map[0].length; setMap(txt); if (map[0].length < keepW) map = map.map(r => r.concat(Array(keepW - r.length).fill(' '))); changed(); });
      const titleIn = el('input', { type: 'text', class: 'inp', placeholder: 'Название уровня', value: v.titles[v.kind] || '', maxlength: '40', oninput: e => { v.titles[v.kind] = e.target.value; ctx.save(v); } });
      host.append(el('p', { class: 'small muted' }, st.hint ? (typeof st.hint === 'string' ? st.hint : st.hint[v.kind] || '') : 'Выбери клетку и рисуй мышью или стрелками и пробелом.'),
        palette,
        el('div', { class: 'm4-gridbox' }, gridCv),
        el('div', { class: 'row small' },
          el('button', { type: 'button', class: 'btn ghost small', 'data-edit': 'text', onclick: () => { textMode = !textMode; ta.hidden = !textMode; beep('tick'); } }, '🔤 Уровень текстом'),
          base.length ? el('button', { type: 'button', class: 'btn ghost small', 'data-edit': 'base', onclick: () => { setMap(base[0].map); changed(); draw(); } }, '↺ Взять уровень игры') : null,
          el('button', { type: 'button', class: 'btn ghost small', 'data-edit': 'clear', onclick: () => { setMap(blank().split('\n').map(l => l.padEnd(map[0].length, ' ')).join('\n')); changed(); draw(); } }, '⬜ Очистить'),
          el('span', { class: 'grow' }), el('span', { class: 'muted' }, `${map[0].length} × ${map.length} клеток`)),
        ta, status(),
        el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn', 'data-edit': 'play', onclick: play }, '▶ Пройди сам'), titleIn,
          el('button', { type: 'button', class: 'btn warm', 'data-edit': 'publish', disabled: !cleared, onclick: () => publish(titleIn) }, '📤 Выложить в галерею')));
      const got = Object.entries(v.levels);
      if (got.length) host.append(el('div', { class: 'm4-codes' }, got.map(([k, x]) => el('div', { class: 'm4-code' }, el('span', {}, KIND_UI[k][0]), el('div', {}, el('div', { class: 'eyebrow' }, KIND_UI[k][1] + ' · код уровня'), el('b', { class: 'm4-codebig' }, x.code), el('div', { class: 'small muted' }, `«${x.title}» · пар: ${x.par != null ? x.par + ' ходов' : x.parTime + ' с'}`))))));
    }
    (async () => {
      try { target = await findTarget(); } catch (e) { target = null; }
      if (!target) { ui.innerHTML = ''; ui.append(el('p', { class: 'muted' }, 'Ждём игру соседа: она появится, когда одноклассник соберёт игру.'), el('button', { type: 'button', class: 'btn ghost small', onclick: () => renderMain() }, '↻ Проверить')); return; }
      probe(); draw();
    })();
    ui.append(el('p', { class: 'muted' }, 'Готовим редактор…'));
    host.append(ui, fbox);
    return host;
  }

  /* =================== gallery: уровни класса =================== */
  function stepGallery(ctx) {
    const st = ctx.step, mode = st.mode || 'maker', need = st.need == null ? 2 : st.need;
    let v = Object.assign({ played: {}, cleared: {}, rated: {}, accepted: [] }, ctx.value);
    const host = el('div', { class: 'stack m4-gal' });
    let list = [], cur = null, frame = null, filter = 'all', myGames = [], codeIn = null, flash = null;
    const srcOf = lv => { const m = /^remake:(.+)$/.exec(lv.game); if (m) return '/engine/game.html?game=../' + m[1]; const id = (/^game:(.+)$/.exec(lv.game) || [])[1], c = myGames.concat(S.galGames || []).find(x => x.id === id); return `/play/${id}/${c ? c.version : 1}`; };
    const doneNow = () => {
      if (mode === 'mine') return Object.keys(v.played).length >= Math.max(1, need) || (v.accepted || []).length > 0;
      const n = Object.keys(mode === 'par' ? v.cleared : v.played).filter(c => { const x = list.find(l => l.code === c); return !x || !x.mine; }).length;
      return n >= need && (!st.rate || Object.keys(v.rated).length >= Math.min(need, 1));
    };
    async function load() {
      try {
        const [L, A] = await Promise.all([api('/api/levels' + (st.game ? '?game=' + encodeURIComponent(st.game) : '')), api('/api/arcade')]);
        myGames = A.mine; S.galGames = A.games; list = L.levels;
        if (mode === 'mine') list = list.filter(x => myGames.some(g => x.game === 'game:' + g.id) && !x.mine);
        if (mode !== 'mine' && st.lessons) list = list.filter(x => st.lessons.includes(x.lesson));
      } catch (e) { list = []; }
      if (!cur) draw();
    }
    function mini(lv) {
      if (!lv.map) return el('div', { class: 'm4-seed' }, '🌱', el('b', {}, String(lv.seed)));
      const pal = PALETTES[st.palette] || PALETTES[{ 14: 'tropa', 15: 'zagon', 16: 'plato', 17: 'peshchery' }[lv.lesson]] || autoPalette({});
      return stage(220, 110, (g, t) => { g.fillStyle = '#0b1020'; g.fillRect(0, 0, 220, 110); drawMap(g, lv.map, pal, { x: 2, y: 2, w: 216, h: 106 }, { t }); }, 'm4-mini');
    }
    function card(lv) {
      const mineClear = (lv.my || {}).cleared;
      return el('div', { class: 'm4-lv' + (lv.mine ? ' mine' : ''), 'data-level': lv.code }, mini(lv),
        el('div', { class: 'stack', style: 'gap:2px' },
          el('div', { class: 'row', style: 'gap:6px' }, el('span', { class: 'tag' }, (KIND_UI[lv.kind] || KIND_UI.free)[0] + ' ' + lv.kindLabel), el('code', { class: 'm4-c' }, lv.code)),
          el('b', {}, lv.title), el('span', { class: 'small muted' }, `${lv.author} → «${lv.gameTitle}»`),
          el('span', { class: 'small' }, `✓ прошли ${lv.cleared} из ${lv.tried}` + (lv.par != null ? ` · пар ${lv.par} ходов` : lv.parTime ? ` · пар ${lv.parTime} с` : '') + ` · ♥ ${lv.likes}`),
          mineClear ? el('span', { class: 'small ok-text' }, `✓ ты прошёл: ${lv.my.moves != null ? lv.my.moves + ' ходов' : lv.my.time + ' с'}`) : null,
          el('div', { class: 'row', style: 'gap:6px' },
            el('button', { type: 'button', class: 'btn small', 'data-play': lv.code, onclick: () => open(lv) }, lv.mine ? '▶ Сыграть свой' : '▶ Играть'),
            mode === 'mine' ? el('button', { type: 'button', class: 'btn ghost small' + (lv.accepted ? ' on' : ''), 'data-accept': lv.code, onclick: () => accept(lv) }, lv.accepted ? '✅ В игре' : '➕ Взять в игру') : null)));
    }
    function draw() {
      if (frame) { frame.destroy(); frame = null; }
      host.innerHTML = '';
      codeIn = el('input', { type: 'text', class: 'inp m4-codein', placeholder: 'Код уровня, например LK7Q2', maxlength: '8' });
      const find = async () => {
        const c = codeIn.value.trim().toUpperCase(); if (!c) return;
        try { const r = await api('/api/levels?code=' + encodeURIComponent(c)); if (!r.levels.length) { toast('Нет уровня с таким кодом'); return; } open(r.levels[0]); } catch (e) { toast(e.message, 'err'); }
      };
      codeIn.addEventListener('keydown', e => { if (e.key === 'Enter') find(); });
      if (mode === 'seeds') host.append(seedBox());
      if (mode !== 'mine') host.append(el('div', { class: 'row' }, el('span', { class: 'ti' }, '🔑'), codeIn, el('button', { type: 'button', class: 'btn ghost small', 'data-code': 'find', onclick: find }, 'Найти')));
      const others = list.filter(x => !x.mine), n = Object.keys(mode === 'par' ? v.cleared : v.played).filter(c => others.some(x => x.code === c)).length;
      host.append(el('p', { class: 'small' }, mode === 'mine' ? `Уровни гостей для твоих игр: ${list.length}. Сыграй и возьми лучшие в игру — они встанут после твоих уровней.`
        : `${mode === 'par' ? 'Пройдено' : 'Сыграно'} чужих уровней: ${n} из ${need}` + (doneNow() ? ' ✓' : '')));
      if (mode !== 'mine') host.append(el('div', { class: 'seg' }, [['all', 'Все'], ['train', '🎓 Обучающие'], ['tricky', '😈 Коварные'], ['fresh', '✨ Ещё не играл']].filter(([id]) => mode === 'maker' || id === 'all' || id === 'fresh')
        .map(([id, label]) => el('button', { type: 'button', class: 'opt' + (filter === id ? ' on' : ''), onclick: () => { filter = id; draw(); } }, label))));
      const shown = list.filter(x => filter === 'all' || (filter === 'fresh' ? !v.played[x.code] && !x.mine : x.kind === filter));
      host.append(shown.length ? el('div', { class: 'm4-lvs' }, shown.map(card)) : el('p', { class: 'muted' }, mode === 'mine' ? 'Пока никто не построил уровень для твоей игры.' : 'Уровней пока нет — они появятся, как только одноклассники выложат свои.'));
    }
    // «Найди красивое зерно» (урок 17): мир по числу, дошёл до выхода — можно выложить зерно для класса
    function seedBox() {
      const inp = el('input', { type: 'number', class: 'inp m4-seedin', min: '1', max: '9999', placeholder: 'Зерно, например 4242', value: v.lastSeed ? String(v.lastSeed) : '' });
      const go = n => { n = Math.round(Number(n)); if (!(n >= 1 && n <= 9999)) { toast('Зерно — число от 1 до 9999'); return; } look(n); };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(inp.value); });
      return el('div', { class: 'stack m4-seedbox' }, el('p', { class: 'bigq' }, st.seedQ || 'Найди зерно с самым красивым миром: введи число и посмотри пещеру.'),
        el('div', { class: 'row' }, el('span', { class: 'ti' }, '🌱'), inp, el('button', { type: 'button', class: 'btn small', 'data-seed': 'look', onclick: () => go(inp.value) }, '▶ Посмотреть мир'),
          el('button', { type: 'button', class: 'btn ghost small', 'data-seed': 'dice', onclick: () => go(1000 + Math.floor(Math.random() * 9000)) }, '🎲 Случайное')));
    }
    function look(n) {
      v.lastSeed = n; cur = { seed: n }; host.innerHTML = '';
      if (frame) { frame.destroy(); frame = null; }
      const msg = el('div', { class: 'small', 'aria-live': 'polite' }, `Мир на зерне ${n}. Дойди до выхода — и зерно можно выложить для класса.`), pub = el('div', { class: 'row' });
      let cleared = null;
      const file = String(st.game || '').replace(/^remake:/, '');
      frame = Games.frame({
        src: () => '/engine/game.html?game=../' + file + '&seed=' + n, cfg: Object.assign({}, st.cfg, { zerno: n }), key: () => 'seed:' + n, score: false, autostart: true, label: 'Посмотреть мир ' + n,
        onClear: m => { cleared = m; msg.textContent = `✓ Выход за ${m.time} с. Дай миру имя и выложи зерно — класс выберет самый красивый.`; msg.className = 'verdict good'; beep('good'); showPub(); },
      });
      function showPub() {
        const t = el('input', { type: 'text', class: 'inp m4-seedtitle', maxlength: '40', placeholder: 'Имя мира, например «Хрустальный зал»' });
        pub.replaceChildren(t, el('button', { type: 'button', class: 'btn', 'data-seed': 'publish', onclick: async () => {
          try {
            const r = await api('/api/levels', { game: st.game, seed: n, title: t.value.trim() || 'Зерно ' + n, kind: 'free', cleared: { time: cleared.time }, cfg: Object.assign({}, st.cfg, { zerno: n }) });
            v.published = (v.published || []).concat(r.level.code); ctx.save(v, doneNow() ? true : null, true); beep('done'); toast(`Зерно ${n} выложено: код ${r.level.code}`, 'ok');
            cur = null; await load(); draw();
          } catch (e) { toast(e.message, 'err'); }
        } }, '🌱 Выложить зерно'));
      }
      host.append(el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn ghost small', onclick: () => { cur = null; load(); draw(); } }, '← К зёрнам класса'), el('b', {}, `🌱 Зерно ${n}`)), msg, frame.box, Games.bar(frame), pub);
    }
    function open(lv) {
      cur = lv; host.innerHTML = '';
      const status = el('div', { class: 'small', 'aria-live': 'polite' }, lv.par != null ? `Пар автора: ${lv.par} ходов — пройди так же или лучше!` : lv.parTime ? `Время автора: ${lv.parTime} с` : '');
      const box = el('div', { class: 'stack' });
      host.append(el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn ghost small', onclick: () => { cur = null; load(); draw(); } }, '← Все уровни'), el('b', {}, `«${lv.title}»`), el('span', { class: 'muted small' }, `${lv.author} · код ${lv.code}`)), status);
      const won = async m => {
        try {
          const r = await api('/api/levels/play', { code: lv.code, cleared: true, moves: m.moves, time: m.time });
          v.played[lv.code] = true; v.cleared[lv.code] = { moves: m.moves, time: m.time }; ctx.save(v, doneNow() ? true : null, true);
          flash = r.underPar ? `🏆 В пар! ${m.moves} ходов при паре ${lv.par}` : lv.par != null && m.moves != null ? `✓ Пройдено за ${m.moves} ходов — пар ${lv.par}. Ещё раз?` : `✓ Пройдено за ${m.time} с`;
          status.textContent = flash; status.className = 'verdict ' + (r.underPar || lv.par == null ? 'good' : 'bad'); beep(r.underPar ? 'done' : 'good');
          rate(box, r.level);
        } catch (e) { toast(e.message, 'err'); }
      };
      frame = Games.frame({
        src: () => (lv.map ? Games.withLevels(srcOf(lv), [{ name: lv.title, map: lv.map, author: lv.author }], 'only') : srcOf(lv) + (srcOf(lv).includes('?') ? '&' : '?') + 'seed=' + lv.seed),
        cfg: lv.cfg || null, key: () => 'level:' + lv.code, score: false, autostart: true, label: 'Играть: ' + lv.title,
        onClear: m => won(m),
        onOver: () => { if (!v.played[lv.code]) { v.played[lv.code] = true; api('/api/levels/play', { code: lv.code, cleared: false }).catch(() => {}); ctx.save(v, doneNow() ? true : null, true); rate(box, lv); } },
      });
      host.append(frame.box, Games.bar(frame), box);
      if (v.played[lv.code]) rate(box, lv);
    }
    function rate(box, lv) {
      box.innerHTML = '';
      if (lv.mine || mode === 'par' && !st.rate) return;
      const r = Object.assign({}, v.rated[lv.code] || lv.myRate || {});
      if (st.rate) {
        box.append(el('p', { class: 'bigq' }, 'Оцени уровень: три вопроса'));
        [['teach', '🎓 Учит без слов?'], ['rhythm', '🥁 Есть ритм: отдых и напряжение?'], ['goal', '🎯 Ясна цель?']].forEach(([k, q]) => box.append(el('div', { class: 'row m4-rate' }, el('span', { class: 'grow' }, q),
          ...[[true, 'Да'], [false, 'Нет']].map(([val, label]) => el('button', { type: 'button', class: 'opt' + (r[k] === val ? ' on' : ''), 'data-rate': k + ':' + label, onclick: async () => {
            r[k] = val; v.rated[lv.code] = r; beep('tick');
            try { await api('/api/levels/rate', { code: lv.code, rate: r }); } catch (e) { toast(e.message, 'err'); }
            ctx.save(v, doneNow() ? true : null, true); rate(box, lv);
          } }, label)))));
      }
      box.append(el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn ghost' + (lv.liked ? ' on' : ''), 'data-like': lv.code, onclick: async () => {
        try { const x = await api('/api/levels/rate', { code: lv.code, like: !lv.liked }); lv.liked = x.level.liked; lv.likes = x.level.likes; beep('good'); rate(box, lv); } catch (e) { toast(e.message, 'err'); }
      } }, (lv.liked ? '♥ ' : '♡ ') + (mode === 'seeds' ? 'Красивый мир · ' : 'Хочу ещё · ') + lv.likes)));
    }
    async function accept(lv) {
      try {
        const r = await api('/api/levels/accept', { code: lv.code, on: !lv.accepted });
        v.accepted = r.level.accepted ? [...new Set((v.accepted || []).concat(lv.code))] : (v.accepted || []).filter(c => c !== lv.code);
        ctx.save(v, doneNow() ? true : null, true); beep('done'); toast(r.level.accepted ? 'Уровень гостя теперь в твоей игре' : 'Уровень убран из игры', 'ok'); load();
      } catch (e) { toast(e.message, 'err'); }
    }
    S.hooks.push(kind => { if (kind === 'levels' && !cur) load(); });
    host.append(el('p', { class: 'muted' }, 'Загружаем галерею…'));
    load();
    return host;
  }

  // сцены и примитивы холста открыты другим модулям: шаги модулей 6 и 7 (steps-m6.js, steps-m7.js) добавляют свои сцены в ту же библиотеку.
  // Набор рисования — и прямо в LabMotion (так берёт модуль 7), и в LabMotion.kit (так берёт модуль 6)
  const kit = { TAU, clamp, seg, io, ob, lerp, rng, hashStr, rr, text, disc, glow, sky, hero, arrow, confetti, fast };
  window.LabMotion = Object.assign({ MOTION, stage, padReader, kit }, kit);
  window.LabStepsM4 = { motion: stepMotion, order: stepOrder, mapquiz: stepMapquiz, heat: stepHeat, leveledit: stepLeveledit, gallery: stepGallery };
  // итог шага одной строкой: для «Скопировать результат» в режиме автора
  window.LabStepsM4Summary = (step, v, a) => {
    switch (step.type) {
      case 'motion': return a && a.done ? 'посмотрел до конца' : `сцен: ${v.seen || 0} из ${step.scenes.length}`;
      case 'order': case 'mapquiz': return v.total ? `верно ${v.correct} из ${v.total}, очки ${v.score}` + ((v.mistakes || []).length ? '; трудно: ' + v.mistakes.join('; ') : '') : 'не пройден';
      case 'heat': return v.finding ? `находка: ${v.finding}` : `отметок: ${(v.marks || []).length}`;
      case 'leveledit': return Object.entries(v.levels || {}).map(([k, x]) => `${(KIND_UI[k] || KIND_UI.free)[1]}: «${x.title}», код ${x.code}, пар ${x.par != null ? x.par + ' ходов' : x.parTime + ' с'}`).join('; ') || 'уровень не выложен';
      case 'gallery': return `сыграно уровней: ${Object.keys(v.played || {}).length}, пройдено: ${Object.keys(v.cleared || {}).length}, оценено: ${Object.keys(v.rated || {}).length}` + ((v.accepted || []).length ? `, взято в игру: ${v.accepted.length}` : '');
      default: return null;
    }
  };
  window.LabM4 = { PALETTES, GEN, GEN_NAMES, drawMap, drawTile, autoPalette, sokoSim, genText }; // для проектора и проверок
})();
