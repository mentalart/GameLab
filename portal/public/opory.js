// Сцена «Пять опор» вау-старта (урок 1, решение автора 19.10.2026): классу видно, что карты — опоры, на которых стоят гейм дизайн документ и игра.
// Каждая вытянутая карта вырастает опорой с понятием геймдизайна (Персонаж, Правила, Мир, Вызов, Изюминка), её строка проявляется в документе,
// а в наброске игры над документом появляется её слой. Когда на столе все пять карт, опору можно выбить: документ кренится, строка становится дырой,
// из наброска пропадает слой карты, а подпись говорит, что сломалось. Набросок — схема на canvas по жанру карты действия, не игра Qwen.
// Проектор и ученик строят одну сцену: roof (набросок и документ) и cap (подпись) ставят над картами, pillar(id) — над каждой картой.
'use strict';
const Opory = (() => {
  const { el } = Lab;
  const P = {
    hero: { what: 'Персонаж', field: 'Герой и кнопки', say: 'за кого играем и чем он особенный', lost: 'Без героя некем играть: вместо персонажа серый кубик со знаком вопроса.' },
    action: { what: 'Правила', field: 'Жанр и камера', say: 'во что играем: что нажимать, как набрать очки и как проиграть', lost: 'Без правил непонятно, что нажимать и как выиграть. Это уже не игра, а картинка.' },
    place: { what: 'Мир', field: 'Мир и картинка', say: 'как игра выглядит: цвета, небо и всё вокруг', lost: 'Без мира игра серая и пустая, как черновик.' },
    threat: { what: 'Вызов', field: 'Угроза', say: 'кто нам мешает и чего мы боимся', lost: 'Без угрозы нечего бояться: никто не мешает, играть скучно.' },
    twist: { what: 'Изюминка', field: 'Изюминка', say: 'то, чего нет в обычной игре этого жанра', lost: 'Без поворота это игра как у всех, в ней нет ничего своего.' },
  };
  // палитра мира: небо, земля, акцент — выбирается по имени места, чтобы один мир всегда выглядел одинаково
  const PAL = [['#7fd3ff', '#ffb547', '#ff4f8b'], ['#ffd1e8', '#7a5cff', '#2de2c6'], ['#2b2f6b', '#4a3aa8', '#ffe066'], ['#b8f2c9', '#3e8f4f', '#ff8a3d'],
    ['#ffe7a3', '#c56a2d', '#3ac1ff'], ['#a8c6ff', '#5d7bd6', '#ff5d5d'], ['#14213d', '#1f6f8b', '#fca311'], ['#ffc9a8', '#8b4a7a', '#4dd6ff']];
  const hash = s => [...String(s || '')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const parts = t => Games.cardParts(t || '');
  // каркас наброска по камере жанра: вид сбоку, бег навстречу, арена, тир, ловля
  const kindOf = frame => /сбоку/i.test(frame) ? 'side' : /навстречу/i.test(frame) ? 'run' : /^Тир/i.test(frame) ? 'tir' : /Ловля/i.test(frame) ? 'catch' : 'arena';

  function scene({ ids, labels }) {
    const S = { cards: {}, frame: '', out: new Set(), seen: new Set(), t: 0, shake: 0, burst: 0, sparks: [], last: null, raf: 0, alive: true };
    const cv = el('canvas', { width: '720', height: '250', 'aria-label': 'Набросок игры, который складывается из карт' });
    const name = el('span', {});
    const lines = Object.fromEntries(ids.map(id => [id, el('div', { class: 'op-ln', 'data-op': id }, el('i', {}), el('b', {}, P[id] ? P[id].field : labels[id]), el('span', {}, '…'))]));
    const roof = el('div', { class: 'op-roof' }, el('div', { class: 'op-game' }, cv),
      el('div', { class: 'op-doc' }, el('div', { class: 'op-doc-h' }, 'Гейм дизайн документ', name), ...ids.map(id => lines[id])));
    const capText = el('span', {});
    const cap = el('div', { class: 'op-cap', 'aria-live': 'polite' }, el('span', { class: 'op-who' }, 'Учитель'), capText);
    const pillars = {};
    const all = () => ids.every(id => S.cards[id]);
    const has = id => !!S.cards[id] && !S.out.has(id);

    function pillar(id) {
      const b = el('button', { class: 'op-pil', type: 'button', 'data-op': id, 'aria-label': `Опора «${P[id] ? P[id].what : labels[id]}»: выбить или вернуть`, onclick: () => knock(id) }, el('em', {}, P[id] ? P[id].what : labels[id]));
      pillars[id] = b;
      if (S.cards[id] && S.seen.has(id)) b.classList.add('up'); // уже стоявшая опора не вырастает заново при перерисовке
      else if (S.cards[id]) requestAnimationFrame(() => requestAnimationFrame(() => b.classList.add('up')));
      if (S.out.has(id)) b.classList.add('out');
      if (S.cards[id]) S.seen.add(id);
      return b;
    }
    function knock(id) {
      if (!all()) return;
      if (S.out.has(id)) S.out.delete(id); else S.out.add(id);
      S.shake = 0.3; paint();
    }
    // frame — камера жанра карты действия (wow.genres[].frame), по ней набросок выбирает каркас
    function update(cards, frame) {
      const before = S.cards;
      S.cards = Object.assign({}, cards); S.frame = frame || '';
      for (const id of ids) if (!S.cards[id]) { S.seen.delete(id); S.out.delete(id); }
      const fresh = ids.find(id => S.cards[id] && S.cards[id] !== before[id]);
      if (fresh) S.last = fresh;
      if (!all()) S.out.clear();
      paint(fresh);
    }
    function lineText(id) {
      const [n, t] = parts(S.cards[id]);
      if (id === 'action') return `${n}: ${(S.frame || t || '').toLowerCase()}`;
      if (id === 'twist') return S.cards[id];
      return t && id !== 'place' ? `${n}, ${t}` : n;
    }
    function paint(fresh) {
      const genre = parts(S.cards.action)[0];
      name.textContent = genre || '';
      for (const id of ids) {
        const l = lines[id], on = has(id), hole = !!S.cards[id] && S.out.has(id);
        l.classList.toggle('on', on); l.classList.toggle('hole', hole);
        l.lastChild.textContent = on ? lineText(id) : hole ? '??? здесь дыра' : '…';
        if (fresh === id) { l.classList.remove('pop'); void l.offsetWidth; l.classList.add('pop'); }
        const p = pillars[id];
        if (p) { p.classList.toggle('out', S.out.has(id)); if (S.cards[id] && !p.classList.contains('up')) requestAnimationFrame(() => p.classList.add('up')); if (!S.cards[id]) p.classList.remove('up'); }
      }
      let tilt = 0;
      S.out.forEach(id => { const i = ids.indexOf(id) - (ids.length - 1) / 2; tilt += (i || -0.8) * 2.2; });
      roof.style.transform = S.out.size ? `rotate(${Math.max(-7, Math.min(7, tilt))}deg) translateY(${S.out.size * 4}px)` : '';
      roof.classList.toggle('live', all() && !S.out.size);
      if (S.out.size) capText.textContent = [...S.out].map(id => P[id] ? P[id].lost : '').join(' ');
      else if (all()) capText.textContent = `${ids.length} опор держат документ, документ держит игру. Нажмите на любую опору: что сломается, если её убрать?`;
      else if (S.last && S.cards[S.last] && P[S.last]) capText.textContent = `Карта «${labels[S.last]}»: ${parts(S.cards[S.last])[0]}. Это опора «${P[S.last].what}»: ${P[S.last].say}.`;
      else capText.textContent = 'Каждая карта станет опорой нашей игры. Тянем первую.';
    }

    /* ---------- набросок игры: каждый слой — от своей карты ---------- */
    const cx = cv.getContext('2d');
    function blob(x, y, w, h, col, sq) {
      const sx = 1 + (sq || 0) * 0.25, sy = 1 - (sq || 0) * 0.25;
      cx.save(); cx.translate(x, y); cx.scale(sx, sy);
      cx.fillStyle = col; cx.beginPath(); cx.roundRect(-w / 2, -h, w, h, Math.min(w, h) * 0.35); cx.fill();
      cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(-w * 0.18, -h * 0.62, w * 0.13, 0, 7); cx.arc(w * 0.18, -h * 0.62, w * 0.13, 0, 7); cx.fill();
      cx.fillStyle = '#111'; cx.beginPath(); cx.arc(-w * 0.14, -h * 0.6, w * 0.06, 0, 7); cx.arc(w * 0.22, -h * 0.6, w * 0.06, 0, 7); cx.fill();
      cx.restore();
    }
    function frame(dt) {
      S.t += dt; S.shake = Math.max(0, S.shake - dt);
      const t = S.t, on = Object.fromEntries(ids.map(id => [id, has(id)]));
      const pal = PAL[hash(parts(S.cards.place)[0]) % PAL.length], heroCol = `hsl(${hash(parts(S.cards.hero)[0]) % 360} 80% 58%)`, enemy = '#e2402f';
      const kind = kindOf(S.frame);
      cx.save();
      if (S.shake > 0) cx.translate((Math.random() - 0.5) * 14 * S.shake / 0.3, (Math.random() - 0.5) * 10 * S.shake / 0.3);
      const g = cx.createLinearGradient(0, 0, 0, 250); g.addColorStop(0, on.place ? pal[0] : '#3a4152'); g.addColorStop(1, on.place ? '#ffffff' : '#596173');
      cx.fillStyle = g; cx.fillRect(-20, -20, 760, 290);
      const ground = on.place ? pal[1] : '#7d8596', gy = 205;
      if (on.place) { cx.fillStyle = pal[2]; cx.globalAlpha = 0.35; for (let i = 0; i < 8; i++) { const x = ((i * 110 - t * 30) % 880 + 880) % 880 - 80; cx.beginPath(); cx.moveTo(x, gy); cx.lineTo(x + 34, gy - 70 - (i % 3) * 18); cx.lineTo(x + 68, gy); cx.fill(); } cx.globalAlpha = 1; }
      let hx = 200, hy = gy, enemies = [];
      if (on.action) {
        cx.fillStyle = ground;
        if (kind === 'side') {
          cx.fillRect(-20, gy, 760, 60);
          [[300, 150, 110], [470, 110, 90], [600, 160, 100]].forEach(([x, y, w]) => cx.fillRect(x - ((t * 40) % 40), y, w, 14));
          hy = gy - Math.abs(Math.sin(t * 2.6)) * 80;
          for (let i = 0; i < 5; i++) { cx.fillStyle = '#ffd23f'; cx.beginPath(); cx.ellipse(320 + i * 70 - ((t * 40) % 40), 120 + (i % 2) * 22, 4 + 6 * Math.abs(Math.cos(t * 4 + i)), 9, 0, 0, 7); cx.fill(); }
          enemies = [0, 1, 2].map(i => [((700 - t * 90 - i * 230) % 760 + 760) % 760, gy, 36]);
        } else if (kind === 'run') {
          cx.beginPath(); cx.moveTo(300, 60); cx.lineTo(420, 60); cx.lineTo(640, 250); cx.lineTo(80, 250); cx.fill();
          cx.strokeStyle = 'rgba(255,255,255,.5)'; cx.lineWidth = 3; for (let i = 0; i < 6; i++) { const k = ((i / 6 + t * 0.5) % 1), y = 60 + k * k * 190; cx.beginPath(); cx.moveTo(360 - 4 * k, y); cx.lineTo(360 + 4 * k, y + 10 * k); cx.stroke(); }
          hx = 360 + Math.sin(t * 1.4) * 120; hy = 235;
          enemies = [0, 1, 2].map(i => { const k = ((i / 3 + t * 0.35) % 1); return [360 + (i - 1) * 150 * k * k, 60 + k * k * 175, 10 + 30 * k * k]; });
        } else if (kind === 'tir') {
          for (let r = 0; r < 2; r++) cx.fillRect(60, 110 + r * 85, 600, 14);
          enemies = [0, 1, 2].map(i => [160 + i * 200, 110 + (i % 2) * 85 - Math.max(0, Math.sin(t * 2 + i * 2)) * 34, 30, 'tir']);
          hx = 360; hy = 250;
        } else if (kind === 'catch') {
          for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) { cx.fillStyle = on.place ? pal[(r + c) % 3] : '#7d8596'; cx.fillRect(70 + c * 74, 30 + r * 26, 66, 20); }
          const bx = 360 + Math.sin(t * 1.7) * 240, by = 140 + Math.cos(t * 2.3) * 40; cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(bx, by, 9, 0, 7); cx.fill();
          hx = 360 + Math.sin(t * 1.7) * 220; hy = 238; cx.fillStyle = ground; cx.fillRect(hx - 60, hy - 6, 120, 12);
          enemies = [0, 1].map(i => [120 + i * 480 + Math.sin(t + i) * 30, 175, 30]);
        } else {
          cx.beginPath(); cx.ellipse(360, 150, 330, 92, 0, 0, 7); cx.fill();
          hx = 360 + Math.cos(t * 0.9) * 120; hy = 160 + Math.sin(t * 1.3) * 40;
          for (let i = 0; i < 6; i++) { cx.fillStyle = '#7ef0ff'; cx.beginPath(); cx.arc(150 + i * 85, 120 + (i % 2) * 70, 6, 0, 7); cx.fill(); }
          enemies = [0, 1, 2].map(i => { const a = t * 0.6 + i * 2.1; return [hx + Math.cos(a) * (150 + i * 20), hy + 30 + Math.sin(a) * 50, 36]; });
        }
      } else {
        cx.fillStyle = '#c9cfdb'; cx.font = '700 18px system-ui, sans-serif'; cx.textAlign = 'center'; cx.fillText(S.cards.action ? 'Нет правил: что здесь делать?' : '', 360, 50);
        hx = 360; hy = 170 + Math.sin(t * 2) * 6;
        enemies = [0, 1, 2].map(i => [180 + i * 180, 200, 36]);
      }
      if (on.threat) for (const [ex, ey, s, k] of enemies) {
        if (k === 'tir') { cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(ex, ey, s, Math.PI, 0); cx.fill(); cx.fillStyle = enemy; cx.beginPath(); cx.arc(ex, ey, s * 0.62, Math.PI, 0); cx.fill(); }
        else blob(ex, ey, s, s * 0.85, enemy, Math.sin(t * 8 + ex) * 0.2);
      }
      if (kind === 'tir' && on.action) { const ax = 360 + Math.cos(t * 1.2) * 200, ay = 120 + Math.sin(t * 1.7) * 40; cx.strokeStyle = on.hero ? heroCol : '#9aa2ab'; cx.lineWidth = 4; cx.beginPath(); cx.arc(ax, ay, 18, 0, 7); cx.moveTo(ax - 28, ay); cx.lineTo(ax + 28, ay); cx.moveTo(ax, ay - 28); cx.lineTo(ax, ay + 28); cx.stroke(); }
      if (on.hero) blob(hx, hy, 44, 52, heroCol, kind === 'side' && on.action ? (hy > gy - 4 ? 0.6 : -0.5) : 0);
      else if (S.cards.hero || on.action) { cx.fillStyle = '#9aa2ab'; cx.fillRect(hx - 22, hy - 44, 44, 44); cx.fillStyle = '#fff'; cx.font = '800 26px system-ui, sans-serif'; cx.textAlign = 'center'; cx.fillText('?', hx, hy - 12); }
      if (on.twist) {
        const tw = S.cards.twist, txt = tw.length > 34 ? tw.slice(0, 33) + '…' : tw;
        cx.font = '700 13px system-ui, sans-serif'; const w = cx.measureText(txt).width + 26, bx = Math.max(w / 2 + 6, Math.min(714 - w / 2, hx)), by = Math.max(28, hy - 78);
        cx.fillStyle = '#d98a00'; cx.beginPath(); cx.roundRect(bx - w / 2, by - 15, w, 26, 13); cx.fill(); cx.fillStyle = '#fff'; cx.textAlign = 'center'; cx.fillText('★ ' + txt, bx, by + 3);
      }
      // все опоры на месте — игра оживает: искры и тряска, как сочность в настоящей игре
      if (all() && !S.out.size) {
        S.burst -= dt;
        if (S.burst <= 0) { S.burst = 1.1; S.shake = 0.18; for (let i = 0; i < 16; i++) { const a = Math.random() * 6.28, v = 60 + Math.random() * 180; S.sparks.push({ x: hx + 40, y: hy - 30, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, t: 0, c: i % 3 ? pal[2] : '#fff' }); } }
      }
      for (const p of S.sparks) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt; cx.globalAlpha = Math.max(0, 1 - p.t / 0.6); cx.fillStyle = p.c; cx.fillRect(p.x - 3, p.y - 3, 6, 6); }
      cx.globalAlpha = 1; S.sparks = S.sparks.filter(p => p.t < 0.6);
      cx.restore();
    }
    let prev = performance.now();
    const loop = now => { if (!S.alive) return; const dt = Math.min(0.05, (now - prev) / 1000); prev = now; if (cv.isConnected) frame(dt); S.raf = requestAnimationFrame(loop); };
    S.raf = requestAnimationFrame(loop);
    paint();
    return { roof, cap, pillar, update, destroy: () => { S.alive = false; cancelAnimationFrame(S.raf); } };
  }
  return { scene, kindOf };
})();
