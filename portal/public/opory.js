// Сцена «Пять опор» вау-старта (урок 1, решение автора 19.10.2026): классу видно, что ответы на пять вопросов — опоры, на которых стоят
// гейм дизайн документ и игра. Каждый ответ вырастает опорой с понятием геймдизайна (Правила, Мир, Персонаж, Вызов, Изюминка), его строка
// проявляется в документе, а в наброске игры над документом появляется его слой: каркас игры, палитра и декор мира, герой, враги, поворот.
// Когда ответов пять, опору можно выбить: документ кренится, строка становится дырой, из наброска пропадает слой, подпись говорит, что сломалось.
// Набросок — схема на canvas по облику карт (wow.look: значки, палитры миров, каркас игры), не игра Qwen.
// Проектор и ученик строят одну сцену: roof (набросок и документ), base (опоры с ответами) и cap (подпись учителя).
// Opory.pick — карта вопроса (значок, имя, особенность, полоска голосов), paintVotes — голоса, confetti и fly — победа карты и её полёт к опоре.
'use strict';
const Opory = (() => {
  const { el } = Lab;
  const LOST = {
    action: 'Без правил непонятно, что нажимать и как выиграть. Это уже не игра, а картинка.',
    place: 'Без мира игра серая и пустая, как черновик.',
    hero: 'Без героя некем играть: вместо персонажа серый кубик со знаком вопроса.',
    threat: 'Без угрозы нечего бояться: никто не мешает, играть скучно.',
    twist: 'Без изюминки это игра как у всех, в ней нет ничего своего.',
  };
  const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  const KINDS = { side: 1, run: 1, tir: 1, arena: 1, catch: 1, flap: 1 };
  // каркас наброска, если у игры нет облика в look: по камере жанра
  const kindOf = frame => /сбоку/i.test(frame) ? 'side' : /навстречу/i.test(frame) ? 'run' : /^Тир/i.test(frame) ? 'tir' : /Ловля/i.test(frame) ? 'catch' : 'arena';

  function face(text, look) {
    const [name, trait] = Games.cardParts(text || '');
    const icons = (look && look.icons) || {};
    return { em: icons[text] || '', name: name || '', trait: trait || '' };
  }

  // cards — карты урока по порядку вопросов ({ id, label, pillar, q }), look — облик карт урока; onAsk(id) — учитель задаёт вопрос этой карты ещё раз
  function scene({ cards, look, onAsk }) {
    look = look || {};
    const ids = cards.map(c => c.id), meta = Object.fromEntries(cards.map(c => [c.id, c]));
    const S = { cards: {}, frame: '', out: new Set(), shown: new Set(), t: 0, shake: 0, burst: 0, flash: 0, sparks: [], last: null, raf: 0, alive: true };
    const cv = el('canvas', { width: '800', height: '450', 'aria-label': 'Набросок игры класса: каждый ответ добавляет в неё слой' });
    const name = el('span', {});
    const lines = Object.fromEntries(ids.map(id => [id, el('div', { class: 'op-ln', 'data-op': id }, el('i', {}), el('b', {}, meta[id].label), el('span', {}, '…'))]));
    const goal = el('div', { class: 'op-ln op-goal', hidden: true }, el('i', {}), el('b', {}, 'Цель'), el('span', {}));
    const roof = el('div', { class: 'op-roof' }, el('div', { class: 'op-game' }, cv),
      el('div', { class: 'op-doc' }, el('div', { class: 'op-doc-h' }, 'Гейм дизайн документ класса', name), ...ids.map(id => lines[id]), goal));
    const pillars = {}, minis = {};
    const base = el('div', { class: 'op-base', style: '--n:' + ids.length }, ids.map(id => {
      pillars[id] = el('button', { class: 'op-pil', type: 'button', 'data-op': id, 'aria-label': `Опора «${meta[id].pillar || meta[id].label}»: выбить или вернуть`, onclick: () => knock(id) }, el('em', {}, meta[id].pillar || meta[id].label));
      minis[id] = el('div', { class: 'op-mini', 'data-op': id });
      return el('div', { class: 'op-col' }, pillars[id], minis[id]);
    }));
    const capText = el('span', {});
    const cap = el('div', { class: 'op-cap', 'aria-live': 'polite' }, el('span', { class: 'op-who' }, 'Учитель'), capText);
    const all = () => ids.every(id => S.cards[id]);
    const has = id => !!S.cards[id] && !S.out.has(id);

    function knock(id) {
      if (!all()) return;
      if (S.out.has(id)) S.out.delete(id); else S.out.add(id);
      S.shake = 0.35; paint();
    }
    // frame — камера жанра карты игры (wow.genres[].frame): каркас наброска, если у игры нет облика в look
    function update(cardsNow, frame) {
      const before = S.cards;
      S.cards = Object.assign({}, cardsNow); S.frame = frame || '';
      const fresh = ids.filter(id => S.cards[id] && S.cards[id] !== before[id]);
      if (fresh.length) { S.last = fresh[fresh.length - 1]; S.flash = 1; }
      if (!all()) S.out.clear();
      paint(fresh);
    }
    const W = () => (look.worlds || {})[S.cards.place] || null, G = () => (look.games || {})[S.cards.action] || null;
    function lineText(id) {
      const f = face(S.cards[id], look);
      if (id === 'action') { const g = G(); return g ? `${f.em} ${f.name}, как ${g.like}: ${f.trait}` : `${f.name}: ${f.trait}`; }
      if (id === 'place') { const w = W(); return w ? `${f.em} ${w.name}: собираем ${w.item} ${w.itemName}, вокруг ${w.decor.slice(0, 3).join('')}` : S.cards[id]; }
      if (id === 'twist') return '✨ ' + S.cards[id];
      return `${f.em} ${f.name}${f.trait ? ' — ' + f.trait : ''}`.trim();
    }
    function paint(fresh) {
      fresh = fresh || [];
      const g = G(), w = W();
      name.textContent = [g ? g.name : face(S.cards.action).name, w ? w.name : ''].filter(Boolean).join(' · ');
      for (const id of ids) {
        const l = lines[id], on = has(id), hole = !!S.cards[id] && S.out.has(id);
        l.classList.toggle('on', on); l.classList.toggle('hole', hole);
        l.lastChild.textContent = on ? lineText(id) : hole ? '??? здесь дыра' : '…';
        if (fresh.includes(id)) { l.classList.remove('pop'); void l.offsetWidth; l.classList.add('pop'); }
        const p = pillars[id];
        p.classList.toggle('out', S.out.has(id));
        if (S.cards[id] && !S.shown.has(id)) { S.shown.add(id); requestAnimationFrame(() => requestAnimationFrame(() => p.classList.add('up'))); }
        if (!S.cards[id]) { S.shown.delete(id); p.classList.remove('up'); }
        const m = minis[id], f = face(S.cards[id], look);
        m.innerHTML = '';
        m.classList.toggle('on', !!S.cards[id]);
        m.append(...[el('span', { class: 'op-mini-em' }, S.cards[id] ? f.em || '✨' : '?'), el('span', { class: 'op-mini-nm' }, S.cards[id] ? (id === 'twist' ? S.cards[id] : f.name) : meta[id].label),
          onAsk ? el('button', { class: 'op-mini-ask', type: 'button', title: 'Задать этот вопрос ещё раз', 'aria-label': `Задать вопрос «${meta[id].q || meta[id].label}» ещё раз`, onclick: () => onAsk(id) }, '↻') : null].filter(Boolean));
      }
      goal.hidden = !(g && has('action'));
      if (g) goal.lastChild.textContent = g.goal;
      let tilt = 0;
      S.out.forEach(id => { const i = ids.indexOf(id) - (ids.length - 1) / 2; tilt += (i || -0.8) * 2.2; });
      roof.style.transform = S.out.size ? `rotate(${Math.max(-7, Math.min(7, tilt))}deg) translateY(${S.out.size * 4}px)` : '';
      roof.classList.toggle('live', all() && !S.out.size);
      const last = S.last && meta[S.last];
      if (S.out.size) capText.textContent = [...S.out].map(id => LOST[id] || '').join(' ');
      else if (all()) capText.textContent = `${ids.length} опор держат документ, документ держит игру. Нажмите на любую опору: что сломается, если её убрать?`;
      else if (last && S.cards[S.last]) capText.textContent = `«${last.q || last.label}» — ${S.last === 'twist' ? S.cards.twist : face(S.cards[S.last]).name}. Это опора «${last.pillar || last.label}».`;
      else capText.textContent = 'Каждый ответ станет опорой нашей игры. Начинаем с первого вопроса.';
    }
    // слот ответа: куда летит карта-победитель на проекторе
    const slot = id => minis[id];

    /* ---------- набросок игры: каждый слой — от своей карты ---------- */
    const cx = cv.getContext('2d'), CW = 800, CH = 450;
    function emo(e, x, y, size) { cx.font = `${size}px ${EMOJI}`; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(e, x, y); }
    function heroAt(x, y, size, sq) {
      const f = face(S.cards.hero, look);
      cx.save(); cx.translate(x, y); cx.scale(1 + (sq || 0) * 0.2, 1 - (sq || 0) * 0.2);
      if (has('hero') && f.em) { cx.fillStyle = 'rgba(255,255,255,.88)'; cx.beginPath(); cx.arc(0, 0, size * 0.62, 0, 7); cx.fill(); emo(f.em, 0, 2, size); }
      else if (has('hero')) { cx.fillStyle = '#3fd0bd'; cx.beginPath(); cx.roundRect(-size * 0.4, -size * 0.45, size * 0.8, size * 0.9, 12); cx.fill(); }
      else { cx.fillStyle = '#8b909c'; cx.beginPath(); cx.roundRect(-size * 0.4, -size * 0.45, size * 0.8, size * 0.9, 10); cx.fill(); cx.fillStyle = '#fff'; cx.font = `800 ${size * 0.5}px system-ui, sans-serif`; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('?', 0, 2); }
      cx.restore();
    }
    function enemyAt(x, y, size) {
      if (!has('threat')) return;
      const f = face(S.cards.threat, look);
      cx.save(); cx.shadowColor = 'rgba(255,40,30,.9)'; cx.shadowBlur = 16;
      if (f.em) emo(f.em, x, y, size); else { cx.fillStyle = '#e2402f'; cx.beginPath(); cx.arc(x, y, size * 0.4, 0, 7); cx.fill(); }
      cx.restore();
    }
    function itemAt(x, y, size) {
      const w = has('place') && W();
      cx.save(); cx.shadowColor = '#ffd23f'; cx.shadowBlur = 14;
      if (w) emo(w.item, x, y, size * (0.8 + 0.2 * Math.abs(Math.cos(S.t * 4 + x))));
      else { cx.fillStyle = '#ffd23f'; cx.beginPath(); cx.arc(x, y, size * 0.3, 0, 7); cx.fill(); }
      cx.restore();
    }
    function frame(dt) {
      S.t += dt; S.shake = Math.max(0, S.shake - dt); S.flash = Math.max(0, S.flash - dt * 2);
      const t = S.t, w = has('place') && W(), g = G();
      const kind = has('action') ? (g && KINDS[g.kind] ? g.kind : kindOf(S.frame)) : null;
      cx.save();
      if (S.shake > 0) cx.translate((Math.random() - 0.5) * 20 * S.shake, (Math.random() - 0.5) * 14 * S.shake);
      const sk = cx.createLinearGradient(0, 0, 0, CH); sk.addColorStop(0, w ? w.sky[0] : '#2c3347'); sk.addColorStop(1, w ? w.sky[1] : '#4a5268');
      cx.fillStyle = sk; cx.fillRect(-30, -30, CW + 60, CH + 60);
      const gy = 360;
      if (w) {
        cx.fillStyle = w.far; cx.beginPath(); cx.moveTo(-20, gy); for (let i = 0; i <= 10; i++) cx.lineTo(i * 85 - 20, 250 + ((i * 53) % 4) * 22); cx.lineTo(CW + 20, gy); cx.fill();
        w.decor.forEach((d, i) => emo(d, ((i * 150 - t * 20) % 900 + 900) % 900 - 50, gy - 26 - (i % 2) * 10, 40 + (i % 3) * 8));
      }
      if (!kind) {
        cx.fillStyle = 'rgba(255,255,255,.85)'; cx.font = '700 26px system-ui, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
        cx.fillText(S.cards.action ? 'Нет правил: что здесь делать?' : 'Здесь вырастет игра класса', CW / 2, CH / 2 - (has('hero') ? 80 : 0));
        if (has('hero') || has('threat')) { heroAt(CW / 2, 300 + Math.sin(t * 2) * 6, 58, 0); [200, 600].forEach(x => enemyAt(x, 300, 46)); }
        finish(dt, CW / 2, 300, w); cx.restore(); return;
      }
      const ground = w ? w.ground : '#7d8290';
      let hx = 200, hy = 300, sq = 0, enemies = [], items = [];
      cx.fillStyle = ground;
      if (kind === 'side' || kind === 'flap') {
        cx.fillRect(-30, gy, CW + 60, 120);
        if (kind === 'side') {
          [[330, 260, 120], [520, 210, 100], [680, 270, 110]].forEach(([x, y, l]) => { const px = ((x - t * 60) % 900 + 900) % 900 - 60; cx.fillStyle = ground; cx.fillRect(px, y, l, 16); items.push([px + l / 2, y - 34]); });
          const j = Math.abs(Math.sin(t * 2.6)); hy = gy - 34 - j * 110; sq = j < 0.08 ? 0.5 : -0.3;
          enemies = [0, 1].map(i => [((760 - t * 110 - i * 400) % 900 + 900) % 900 - 50, gy - 24]);
        } else {
          for (let i = 0; i < 4; i++) { const px = ((i * 240 + 300 - t * 120) % 960 + 960) % 960 - 80, gap = 150 + Math.sin(i * 2) * 60; cx.fillStyle = ground; cx.fillRect(px, -10, 60, gap - 70); cx.fillRect(px, gap + 70, 60, gy - gap - 70); items.push([px + 30, gap]); }
          hy = 200 + Math.sin(t * 3) * 60; sq = Math.cos(t * 3) > 0.9 ? -0.4 : 0;
          enemies = [[((700 - t * 160) % 900 + 900) % 900 - 50, 110], [((300 - t * 160) % 900 + 900) % 900 - 50, 300]];
        }
      } else if (kind === 'run') {
        cx.beginPath(); cx.moveTo(340, 150); cx.lineTo(460, 150); cx.lineTo(760, CH); cx.lineTo(40, CH); cx.fill();
        cx.strokeStyle = 'rgba(255,255,255,.55)'; cx.lineWidth = 4; [-1, 1].forEach(s => { cx.beginPath(); cx.moveTo(400 + s * 20, 150); cx.lineTo(400 + s * 120, CH); cx.stroke(); });
        hx = 400 + Math.round(Math.sin(t * 1.3)) * 207; hy = 400; sq = Math.abs(Math.sin(t * 8)) * 0.15;
        for (let i = 0; i < 3; i++) { const k = ((i / 3 + t * 0.35) % 1), L = (i % 3) - 1, y = 150 + k * k * 300, x = 400 + L * (20 + k * k * 180); (i === 1 ? items : enemies).push([x, y, 16 + 50 * k * k]); }
      } else if (kind === 'tir') {
        for (let r = 0; r < 2; r++) cx.fillRect(80, 190 + r * 120, 640, 18);
        enemies = [0, 1, 2].map(i => [200 + i * 200, 190 + (i % 2) * 120 - 34 - Math.max(0, Math.sin(t * 2 + i * 2)) * 30]);
        items = [[120 + ((t * 80) % 560), 120]];
        const ax = 400 + Math.cos(t * 1.2) * 230, ay = 200 + Math.sin(t * 1.7) * 60;
        cx.strokeStyle = w ? w.acc : '#ddd'; cx.lineWidth = 5; cx.beginPath(); cx.arc(ax, ay, 26, 0, 7); cx.moveTo(ax - 40, ay); cx.lineTo(ax + 40, ay); cx.moveTo(ax, ay - 40); cx.lineTo(ax, ay + 40); cx.stroke();
        hx = 90; hy = 400;
      } else if (kind === 'catch') {
        for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) { cx.fillStyle = w ? [w.acc, w.ground, w.far][(r + c) % 3] : '#8b909c'; cx.fillRect(40 + c * 82, 30 + r * 32, 76, 26); }
        items = [[400 + Math.sin(t * 1.7) * 300, 230 + Math.cos(t * 2.3) * 70]];
        hx = 400 + Math.sin(t * 1.7) * 280; hy = 400; cx.fillStyle = ground; cx.beginPath(); cx.roundRect(hx - 80, hy + 22, 160, 16, 8); cx.fill();
        enemies = [[150 + Math.sin(t) * 40, 160], [650 + Math.cos(t) * 40, 170]];
      } else {
        cx.beginPath(); cx.ellipse(400, 330, 390, 110, 0, 0, 7); cx.fill();
        hx = 400 + Math.cos(t * 0.9) * 140; hy = 320 + Math.sin(t * 1.3) * 40; sq = Math.abs(Math.sin(t * 7)) * 0.12;
        enemies = [0, 1, 2, 3].map(i => { const a = t * 0.5 + i * 1.6; return [hx + Math.cos(a) * 190, hy + Math.sin(a) * 70]; });
        items = [[220, 300], [600, 350]];
        if (has('threat')) { cx.strokeStyle = '#fff'; cx.lineWidth = 4; const e = enemies[Math.floor(t * 2) % 4]; cx.beginPath(); cx.moveTo(hx, hy); cx.lineTo(e[0], e[1]); cx.stroke(); }
      }
      items.forEach(([x, y, s]) => itemAt(x, y, s || 30));
      enemies.forEach(([x, y, s]) => enemyAt(x, y, s || 46));
      heroAt(hx, hy, 58, sq);
      finish(dt, hx, hy, w);
      cx.restore();
    }
    // поворот плашкой, искры и счёт, когда стоят все опоры, вспышка нового слоя, затемнение без опоры
    function finish(dt, hx, hy, w) {
      if (has('twist')) {
        const tw = S.cards.twist, txt = '✨ ' + (tw.length > 34 ? tw.slice(0, 33) + '…' : tw);
        cx.font = '700 20px system-ui, sans-serif'; const tw2 = cx.measureText(txt).width + 30;
        cx.fillStyle = '#e08a00'; cx.beginPath(); cx.roundRect(CW - tw2 - 16, 16, tw2, 38, 19); cx.fill(); cx.fillStyle = '#fff'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(txt, CW - tw2 / 2 - 16, 36);
      }
      if (all() && !S.out.size) {
        S.burst -= dt;
        if (S.burst <= 0) { S.burst = 1; S.shake = Math.max(S.shake, 0.15); for (let i = 0; i < 18; i++) { const a = Math.random() * 6.28, v = 80 + Math.random() * 220; S.sparks.push({ x: hx, y: hy - 20, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, t: 0, c: i % 3 ? (w ? w.acc : '#ffd23f') : '#fff' }); } }
        cx.fillStyle = 'rgba(0,0,0,.45)'; cx.beginPath(); cx.roundRect(16, 16, 150, 40, 12); cx.fill(); cx.fillStyle = '#fff'; cx.font = '800 20px system-ui, sans-serif'; cx.textAlign = 'left'; cx.textBaseline = 'middle'; cx.fillText('★ ' + (Math.floor(S.t * 7) % 1000), 30, 37);
      }
      for (const p of S.sparks) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; cx.globalAlpha = Math.max(0, 1 - p.t / 0.6); cx.fillStyle = p.c; cx.fillRect(p.x - 4, p.y - 4, 8, 8); }
      cx.globalAlpha = 1; S.sparks = S.sparks.filter(p => p.t < 0.6);
      if (S.flash > 0) { cx.fillStyle = `rgba(255,255,255,${S.flash * 0.45})`; cx.fillRect(-30, -30, CW + 60, CH + 60); }
      if (S.out.size) { cx.fillStyle = 'rgba(0,0,0,.4)'; cx.fillRect(-30, -30, CW + 60, CH + 60); cx.fillStyle = '#fff'; cx.font = '800 28px system-ui, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('Игра сломалась: чего-то не хватает', CW / 2, 70); }
    }
    let prev = performance.now();
    const loop = now => { if (!S.alive) return; const dt = Math.min(0.05, (now - prev) / 1000); prev = now; if (cv.isConnected) frame(dt); S.raf = requestAnimationFrame(loop); };
    S.raf = requestAnimationFrame(loop);
    paint();
    return { roof, base, cap, update, slot, destroy: () => { S.alive = false; cancelAnimationFrame(S.raf); } };
  }

  // карта вопроса: большой значок, имя, особенность, полоска голосов — проектор и ученик
  function pick(text, card, look, opts) {
    opts = opts || {};
    const f = face(text, look);
    return el(opts.button ? 'button' : 'div', Object.assign({ class: 'op-pick', 'data-op': card.id }, opts.button ? { type: 'button', onclick: opts.onclick } : {}),
      el('span', { class: 'op-pick-em' }, f.em || '✨'), el('span', { class: 'op-pick-nm' }, card.id === 'twist' ? text : f.name),
      card.id !== 'twist' && f.trait ? el('span', { class: 'op-pick-tr' }, f.trait) : null,
      el('span', { class: 'op-bar' }, el('i', {})), el('span', { class: 'op-votes' }, ''));
  }
  const votesWord = n => (n % 10 === 1 && n % 100 !== 11 ? 'голос' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'голоса' : 'голосов');
  // полоски голосов: доля от числа учеников (total) или от проголосовавших
  function paintVotes(box, counts, total, mine) {
    const sum = Math.max(1, total || counts.reduce((a, b) => a + b, 0));
    [...box.querySelectorAll('.op-pick')].forEach((p, i) => {
      const n = counts[i] || 0, bar = p.querySelector('.op-bar i'), v = p.querySelector('.op-votes');
      bar.style.width = Math.min(100, n / sum * 100) + '%';
      const txt = `${n} ${votesWord(n)}`;
      if (v.textContent !== txt) { v.textContent = txt; v.classList.remove('bump'); void v.offsetWidth; v.classList.add('bump'); }
      p.classList.toggle('mine', mine === i);
    });
  }
  // конфетти над элементом: победа карты в голосовании
  function confetti(target, colors) {
    const r = target.getBoundingClientRect(), box = el('div', { class: 'op-confetti', 'aria-hidden': 'true' });
    box.style.left = r.left + r.width / 2 + 'px'; box.style.top = r.top + r.height / 2 + 'px';
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 220;
      const p = el('i', {}); p.style.background = colors[i % colors.length];
      p.style.setProperty('--x', Math.cos(a) * d + 'px'); p.style.setProperty('--y', Math.sin(a) * d - 80 + 'px'); p.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
      p.style.animationDelay = Math.random() * 0.08 + 's';
      box.append(p);
    }
    document.body.append(box);
    setTimeout(() => box.remove(), 1400);
  }
  // полёт карты-победителя в её слот под опорой (FLIP): копия карты летит и тает, потом опора растёт
  function fly(from, to, done) {
    if (!from || !to || !from.isConnected || matchMedia('(prefers-reduced-motion: reduce)').matches) { done(); return; }
    const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
    const ghost = from.cloneNode(true);
    ghost.classList.add('op-ghost');
    Object.assign(ghost.style, { left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px' });
    document.body.append(ghost);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2), k = Math.max(0.2, b.width / a.width);
    const anim = ghost.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 60}px) scale(${(1 + k) / 2}) rotate(-8deg)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(${k})`, opacity: 0.2 }], { duration: 750, easing: 'cubic-bezier(.5,0,.3,1)' });
    anim.onfinish = () => { ghost.remove(); done(); };
  }
  return { scene, face, pick, paintVotes, confetti, fly, kindOf };
})();
