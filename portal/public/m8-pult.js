// Модуль 8 «Своя игра: от питча до Фестиваля» для учителя и проектора: вкладка «Проект».
// Дорога к Фестивалю (фишки команд едут по восьми остановкам — вехи уроков 29–36, lib/m8.js roadOf), стена питчей и сцена
// (питч на 60 секунд с кольцом-таймером), диздоки команд с печатью «Утверждено», пульт Фестиваля: фазы программы с таймером,
// жетоны «Выбор зрителей», стенды с живыми рекордами, номинации с раскрытием по очереди.
// Панель учителя — с кнопками, проектор — то же крупно и без кнопок. Данные — GET /api/proekt?code=… раз в полторы секунды.
'use strict';
window.LabM8 = (() => {
  const { el, api, toast, beep } = Lab;
  const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ob = t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const mmss = sec => { const s = Math.max(0, Math.round(sec)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const colorOf = n => (window.LabM7 ? window.LabM7.colorOf(n) : '#5fe0ff');
  const calm = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function text(g, s, x, y, col = '#f2efe6', px = 15, align = 'center', weight = 800) { g.fillStyle = col; g.font = `${weight} ${px}px system-ui,-apple-system,'Segoe UI',sans-serif`; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(s, x, y); }
  function disc(g, x, y, r, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  const BEATS = [[0, 10, 'Одной фразой', '#ffd23f'], [10, 30, 'Как играется', '#5fe0ff'], [30, 50, 'Твист: чего нет у донора', '#ff5fa2'], [50, 60, '«Хочешь сыграть?»', '#7cf5a8']];
  // кольцо питча: четыре бита (как у ученика в шаге pitch), бегунок и сколько осталось
  function pitchRing(g, x, y, r, sec) {
    BEATS.forEach(([a, b, , col]) => { g.lineWidth = 18; g.lineCap = 'round'; g.strokeStyle = col + '44'; g.beginPath(); g.arc(x, y, r, -Math.PI / 2 + TAU * a / 60 + 0.03, -Math.PI / 2 + TAU * b / 60 - 0.03); g.stroke(); });
    BEATS.forEach(([a, b, , col]) => { const k = clamp((sec - a) / (b - a), 0, 1); if (k <= 0) return; g.strokeStyle = col; g.beginPath(); g.arc(x, y, r, -Math.PI / 2 + TAU * a / 60 + 0.03, -Math.PI / 2 + TAU * (a + (b - a) * k) / 60 - 0.03); g.stroke(); });
    const cur = BEATS.find(([a, b]) => sec >= a && sec < b) || BEATS[3], ang = -Math.PI / 2 + TAU * clamp(sec, 0, 60) / 60;
    disc(g, x + Math.cos(ang) * r, y + Math.sin(ang) * r, 11, '#ffffff');
    text(g, mmss(Math.max(0, 60 - sec)), x, y - 16, sec >= 60 ? '#ff5d6e' : '#f2efe6', 48);
    text(g, sec >= 60 ? 'время!' : cur[2], x, y + 32, cur[3], 17);
  }

  // дорога к Фестивалю: восемь остановок по извилистой дороге, фишки команд плывут к своей остановке и подпрыгивают на новой
  function road(get, big) {
    const W = 960, H = big ? 300 : 250, cv = el('canvas', { width: W, height: H, class: 'm8-road', 'aria-label': 'Дорога к Фестивалю' }), g = cv.getContext('2d');
    const shown = new Map(), bursts = []; let raf = 0, drawn = 0;
    const P = i => { const t = i / 7; return { x: 60 + t * (W - 120), y: H * 0.55 + Math.sin(t * Math.PI * 2.2) * H * 0.2 }; };
    const loop = now => {
      if (!cv.isConnected) { cancelAnimationFrame(raf); return; }
      raf = requestAnimationFrame(loop);
      if (window.LAB_LOWRES && now - drawn < 200) return; drawn = now;
      const rows = get() || [], stops = (rows[0] && rows[0].steps) || [];
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1a1640'); gr.addColorStop(1, '#2f2a5a'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#f0c75e55'; g.lineWidth = 26; g.lineCap = 'round'; g.beginPath(); for (let i = 0; i <= 70; i++) { const p = P(i / 10); i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); } g.stroke();
      g.setLineDash([10, 12]); g.strokeStyle = '#ffffff66'; g.lineWidth = 2; g.stroke(); g.setLineDash([]);
      const icons = ['💡', '⬜', '🍰', '✂️', '🗺️', '👀', '✨', '🎪'];
      for (let i = 0; i < 8; i++) {
        const p = P(i), reached = rows.filter(r => r.at > i).length;
        disc(g, p.x, p.y, i === 7 ? 26 : 20, reached ? '#7cf5a8' : '#141c36'); g.strokeStyle = '#ffffffaa'; g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y, i === 7 ? 26 : 20, 0, TAU); g.stroke();
        text(g, icons[i], p.x, p.y, '#fff', i === 7 ? 24 : 18);
        text(g, (stops[i] && stops[i].label) || '', p.x, p.y + (i % 2 ? -40 : 40), '#c9cff0', big ? 14 : 11, 'center', 700);
      }
      // фишки: на остановке после последней пройденной вехи, несколько команд на одной остановке — веером
      const at = new Map();
      rows.forEach(r => { const k = Math.min(7, r.at); at.set(k, (at.get(k) || 0) + 1); });
      const placed = new Map();
      rows.forEach(r => {
        const k = Math.min(7, r.at), n = placed.get(k) || 0; placed.set(k, n + 1);
        const base = r.at ? P(k) : { x: 26, y: H * 0.55 }, spread = (n - ((at.get(k) || 1) - 1) / 2) * 30;
        const tx = base.x + spread * 0.6, ty = base.y - 34 - Math.abs(spread) * 0.25;
        let s = shown.get(r.key);
        if (!s) { s = { x: tx, y: ty, at: r.at, hop: 0 }; shown.set(r.key, s); }
        if (r.at > s.at) { s.hop = 1; bursts.push({ x: tx, y: ty, t: 0 }); beep('good'); }
        s.at = r.at;
        const f = calm() ? 1 : 0.08; s.x += (tx - s.x) * f; s.y += (ty - s.y) * f; s.hop = Math.max(0, s.hop - 0.03);
        const y = s.y - Math.sin(s.hop * Math.PI) * 30, col = colorOf(r.members[0] || r.name);
        disc(g, s.x, y, big ? 16 : 13, col); g.strokeStyle = '#0b1020'; g.lineWidth = 2; g.beginPath(); g.arc(s.x, y, big ? 16 : 13, 0, TAU); g.stroke();
        text(g, r.emblem || r.name.slice(0, 1).toUpperCase(), s.x, y, '#0b1020', big ? 15 : 12);
        text(g, r.name.slice(0, 14), s.x, y - (big ? 26 : 22), '#ffffff', big ? 13 : 10, 'center', 700);
      });
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i]; b.t += 0.03; if (b.t >= 1) { bursts.splice(i, 1); continue; }
        for (let k = 0; k < 14; k++) { const a = k / 14 * TAU, d = ob(b.t) * 46; g.globalAlpha = 1 - b.t; disc(g, b.x + Math.cos(a) * d, b.y + Math.sin(a) * d, 3, ['#ffd23f', '#ff5fa2', '#7cf5a8', '#5fe0ff'][k % 4]); }
        g.globalAlpha = 1;
      }
      if (!rows.length) text(g, 'Команды появятся, когда ученики откроют урок модуля 8', W / 2, 30, '#9aa3c7', 14, 'center', 700);
    };
    raf = requestAnimationFrame(loop);
    return cv;
  }

  // пульт: host — куда рисовать, code() — код класса, lesson() — открытый урок (какие разделы нужны), projector — крупно без кнопок
  function pult(host, { code, lesson, projector }) {
    const S = { d: null, got: 0, les: null, seenAwards: 0 };
    const has = (...types) => { const l = lesson(); return !!l && l.checkpoints.some(c => c.steps.some(s => types.includes(s.type))); };
    const act = async (body) => { try { S.d = await api('/api/teacher/proekt', Object.assign({ code: code() }, body)); S.got = Date.now(); beep('tick'); draw(); } catch (e) { toast(e.message, 'err'); } };
    const roadBox = el('section', { class: 'stack' }), stageBox = el('section', { class: 'stack' }), wallBox = el('section', { class: 'stack' }), docsBox = el('section', { class: 'stack' }), festBox = el('section', { class: 'stack' }), teamsBox = el('section', { class: 'stack' });
    let ringCv = null, ringRaf = 0;
    function layout() {
      host.innerHTML = '';
      const box = el('div', { class: 'm8-pult' });
      roadBox.replaceChildren(el('h3', {}, '🛣 Дорога к Фестивалю'), road(() => S.d && S.d.road, projector));
      box.append(roadBox);
      if (has('pitch', 'pitchwall')) box.append(stageBox, wallBox);
      if (has('dizdok')) box.append(docsBox);
      if (has('fest', 'sertifikat')) box.append(festBox);
      if (!projector) box.append(teamsBox);
      host.append(box);
      draw();
    }
    function stageDraw() {
      const d = S.d, s = d && d.stage, p = s && d.pitches.find(x => x.key === s.key);
      if (!p) { stageBox.hidden = true; ringCv = null; return; }
      stageBox.hidden = false;
      if (stageBox.dataset.key !== s.key + s.at) {
        stageBox.dataset.key = s.key + s.at;
        ringCv = el('canvas', { width: 320, height: 300, 'aria-label': 'Таймер питча' });
        stageBox.replaceChildren(el('div', { class: 'm8-pstage' }, ringCv,
          el('div', { class: 'stack' }, el('span', { class: 'm8-live' }, '● Питч на сцене'), el('div', { class: 'm8-ptitle' }, `${p.emblem || ''} ${p.title}`), el('div', { class: 'm8-pphrase' }, p.phrase),
            el('div', { class: 'm8-pformula' }, el('span', {}, '🕹️ ' + (p.donor || '—')), el('i', {}, '×'), el('span', {}, '🌀 ' + (p.twist || '—')), el('i', {}, '×'), el('span', {}, '🌍 ' + (p.world || '—'))),
            el('div', { class: 'small muted' }, (p.members || []).join(', ') + ` · ❤ ${p.hearts}`),
            projector ? null : el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn ghost small', onclick: () => act({ action: 'unstage' }) }, '■ Убрать со сцены'), el('button', { type: 'button', class: 'btn ghost small', onclick: () => act({ action: 'stage', key: p.key }) }, '↻ Ещё раз 60 секунд')))));
        const left0 = s.left, got = S.got, cv = ringCv, g = cv.getContext('2d'); let last = '', drawn = 0;
        cancelAnimationFrame(ringRaf);
        const loop = now => {
          if (!cv.isConnected) return; ringRaf = requestAnimationFrame(loop);
          if (window.LAB_LOWRES && now - drawn < 200) return; drawn = now;
          const sec = 60 - (left0 - (Date.now() - got) / 1000);
          g.clearRect(0, 0, 320, 300); pitchRing(g, 160, 150, 118, Math.max(0, sec));
          const beat = (BEATS.find(([a, b]) => sec >= a && sec < b) || [])[2] || (sec >= 60 ? 'end' : '');
          if (beat !== last) { last = beat; if (sec > 0) beep(beat === 'end' ? 'done' : 'tick'); }
        };
        ringRaf = requestAnimationFrame(loop);
      }
    }
    function wallDraw() {
      const d = S.d; if (!d) return;
      const list = d.pitches.slice().sort((a, b) => b.hearts - a.hearts || a.at - b.at), max = Math.max(1, ...list.map(x => x.hearts));
      wallBox.replaceChildren(el('h3', {}, `📌 Стена питчей · ${list.length}`),
        el('div', { class: 'm8-wall' }, ...(list.length ? list.slice(0, projector ? 12 : 40).map((x, i) => el('div', { class: 'm8-wcard', style: `--d:${i * 40}ms;--c:${colorOf(x.by)}` },
          el('b', {}, `${x.emblem || ''} ${x.title}`), el('p', {}, x.phrase), el('span', { class: 'small muted' }, `${x.donor} · ${(x.members || []).join(', ')}`),
          el('i', { class: 'm8-hbar' }, el('i', { style: `width:${Math.round(100 * x.hearts / max)}%` })),
          el('div', { class: 'row' }, el('span', { class: 'small' }, `❤ ${x.hearts}`), x.approved ? el('span', { class: 'tag ok' }, 'утверждено') : null, el('span', { class: 'grow' }),
            projector ? null : el('button', { type: 'button', class: 'btn small' + (d.stage && d.stage.key === x.key ? '' : ' ghost'), 'data-stage': x.key, onclick: () => act({ action: 'stage', key: x.key }) }, '🎤 На сцену')))) : [el('div', { class: 'muted' }, 'Питчей пока нет: они появятся, когда ученики нажмут «На стену питчей».')])));
    }
    function docsDraw() {
      const d = S.d; if (!d) return;
      const docs = Object.entries(d.docs || {}), rows = d.road || [];
      const name = key => (rows.find(r => r.key === key) || {}).name || key.slice(2);
      const ok = docs.filter(([k]) => d.pitches.some(p => p.key === k && p.approved) || (rows.find(r => r.key === k) || {}).approved).length;
      docsBox.replaceChildren(el('h3', {}, `📄 Диздоки · утверждено ${ok} из ${docs.length}`),
        el('div', { class: 'm8-pteams' }, ...(docs.length ? docs.map(([k, doc]) => {
          const ap = !!(rows.find(r => r.key === k) || {}).approved;
          return el('div', { class: 'm8-pteam' + (ap ? ' ok' : '') },
            el('b', {}, `«${doc.title}» — ${name(k)}`),
            projector ? null : el('dl', { class: 'small' }, ...doc.lines.flatMap(l => [el('dt', { class: 'muted' }, l.k), el('dd', { style: 'margin:0 0 4px' + (l.v === '—' ? ';color:var(--danger)' : '') }, l.v)])),
            projector ? el('span', { class: 'small' }, ap ? '✅ УТВЕРЖДЕНО' : '⏳ ждёт печати') : el('button', { type: 'button', class: 'btn small' + (ap ? ' ghost' : ''), 'data-approve': k, onclick: () => act({ action: ap ? 'unapprove' : 'approve', key: k }) }, ap ? 'Снять печать' : '✅ Утвердить'));
        }) : [el('div', { class: 'muted' }, 'Диздоков пока нет: они появятся по кнопке «На утверждение учителю».')])));
    }
    function festDraw() {
      const d = S.d, f = d && d.fest; if (!f) return;
      const ph = f.phases.find(x => x.id === f.phase), left = ph ? phLeft(f, ph) : 0;
      const head = el('div', { class: 'row' }, el('h3', { class: 'grow' }, `🎪 Фестиваль ${f.open ? '· идёт' : '· закрыт'}`),
        ph ? el('span', { class: 'm8-ptimer', 'data-left': '1' }, mmss(left)) : null);
      const parts = [head];
      if (!projector) parts.push(el('div', { class: 'row' },
        el('button', { type: 'button', class: 'btn small' + (f.open ? ' ghost' : ''), 'data-fest': 'open', onclick: () => act({ action: 'fest', open: !f.open }) }, f.open ? 'Закрыть Фестиваль' : '🎪 Открыть Фестиваль'),
        el('button', { type: 'button', class: 'btn ghost small', onclick: async () => { if (await Lab.ask('Обнулить гостей, партии и жетоны Фестиваля?', { ok: 'Обнулить' })) act({ action: 'reset-fest' }); } }, 'Обнулить')));
      parts.push(el('div', { class: 'm8-phase' }, ...f.phases.map((x, i) => projector ? el('span', { class: 'opt' + (x.id === f.phase ? ' on' : '') }, `${i + 1}. ${x.label}`)
        : el('button', { type: 'button', class: 'opt' + (x.id === f.phase ? ' on' : ''), 'data-phase': x.id, onclick: () => act({ action: 'phase', phase: x.id }) }, `${i + 1}. ${x.label} · ${x.min} мин`))));
      parts.push(el('div', { class: 'm8-fstats' }, ...[[f.totals.guests, 'гостей'], [f.totals.plays, 'партий'], [f.totals.again, '«ещё раз»'], [f.stands.length, 'стендов']].map(([n, l]) => el('div', {}, el('b', {}, String(n)), el('span', {}, l)))));
      if (f.awards || f.phase === 'awards') {
        // номинации открываются по очереди: на проекторе — с отскоком, у учителя — сразу списком
        parts.push(el('div', { class: 'm8-noms' }, ...f.nominations.map((n, i) => el('div', { class: 'm8-nom', style: `--d:${i * 900}ms` },
          el('span', { class: 'm8-ni' }, ['🏆', '🔁', '🎈', '📈'][i] || '🏅'), el('span', { class: 'eyebrow' }, n.label),
          el('b', {}, n.win ? n.win.title : '—'), el('span', { class: 'small muted' }, n.win ? `${n.win.authors.join(', ')} · ${n.how}: ${n.win.value}` : n.how)))));
        if (S.seenAwards !== f.phaseAt) { S.seenAwards = f.phaseAt; beep('done'); }
      }
      parts.push(el('div', { class: 'm8-pteams' }, ...f.stands.slice().sort((a, b) => (b.tokens * 2 + b.likes.wow) - (a.tokens * 2 + a.likes.wow)).map(s => el('div', { class: 'm8-pteam' + (s.release ? ' ok' : '') },
        el('b', {}, `${s.title}${s.release ? ' · 1.0' : ''}`), el('span', { class: 'small muted' }, s.authors.join(', ')),
        el('span', { class: 'small' }, `👥 ${s.guests} · ▶ ${s.plays} · 🔁 ${s.again} · 🤩 ${s.likes.wow} 😃 ${s.likes.ok} 🙂 ${s.likes.meh}`),
        s.record ? el('span', { class: 'small' }, `🏆 ${s.record.nick} — ${s.record.score}`) : el('span', { class: 'small muted' }, 'рекорда пока нет'),
        el('div', { class: 'row' }, el('span', {}, `🎟 жетонов: ${s.tokens}`), projector ? null : el('span', { class: 'grow' }),
          projector ? null : el('button', { type: 'button', class: 'btn ghost small', onclick: () => act({ action: 'token', game: s.game, delta: -1 }) }, '−'),
          projector ? null : el('button', { type: 'button', class: 'btn small', 'data-token': s.game, onclick: () => act({ action: 'token', game: s.game, delta: 1 }) }, '+ 🎟'))))));
      if (!f.stands.length) parts.push(el('div', { class: 'muted' }, 'Стендов пока нет: стенд — игра команды проекта.'));
      festBox.replaceChildren(...parts);
    }
    function teamsDraw() {
      const rows = (S.d && S.d.road) || [];
      teamsBox.replaceChildren(el('h3', {}, '🛡 Команды проекта'),
        el('div', { class: 'm8-pteams' }, ...(rows.length ? rows.map(r => el('div', { class: 'm8-pteam' + (r.approved ? ' ok' : '') },
          el('b', {}, `${r.emblem || '🛡'} ${r.name}${r.title ? ' — «' + r.title + '»' : ''}`), el('span', { class: 'small muted' }, r.members.join(', ')),
          el('span', { class: 'small' }, `остановка ${r.at} из ${r.steps.length} · ${r.pitch ? 'питч ✓' : 'питча нет'} · ${r.approved ? 'диздок ✓' : 'диздок не утверждён'} · версий ${r.versions}${r.release ? ' · 1.0' : ''}`),
          el('span', { class: 'small muted' }, r.steps.map(x => (x.done ? '●' : '○') + ' ' + x.label).join('  ')))) : [el('div', { class: 'muted' }, 'Команд пока нет.')])));
    }
    function draw() {
      if (!S.d) return;
      if (has('pitch', 'pitchwall')) { stageDraw(); wallDraw(); }
      if (has('dizdok')) docsDraw();
      if (has('fest', 'sertifikat')) festDraw();
      if (!projector) teamsDraw();
    }
    // сколько осталось фазе: по часам сервера (f.now) плюс время с последнего ответа
    const phLeft = (f, ph) => ph.min * 60 - (f.now - f.phaseAt) / 1000 - (Date.now() - S.got) / 1000;
    let timer = null;
    async function refresh() {
      if (!host.isConnected || host.closest('[hidden]')) return;
      const l = lesson(); if (l && l.id !== S.les) { S.les = l.id; layout(); }
      try { S.d = await api('/api/proekt?code=' + encodeURIComponent(code())); S.got = Date.now(); draw(); } catch (e) { /* класс сменился */ }
    }
    // таймер фазы Фестиваля тикает каждую секунду и без нового запроса
    const tick = setInterval(() => { const t = host.querySelector('[data-left]'), f = S.d && S.d.fest, ph = f && f.phases.find(x => x.id === f.phase); if (t && ph) t.textContent = mmss(phLeft(f, ph)); if (!host.isConnected) clearInterval(tick); }, 1000);
    return {
      show() { S.les = (lesson() || {}).id; layout(); refresh(); if (!timer) timer = setInterval(refresh, 1500); },
      hide() { clearInterval(timer); timer = null; },
    };
  }
  return { pult, road, pitchRing };
})();
