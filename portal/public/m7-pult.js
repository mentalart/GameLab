// Модуль 7 «Играть вместе» для учителя и проектора: пульт арены класса (загон, старт, правила голосом класса, карта забега),
// турнирная сетка (собрать из тех, кто на связи, поправить победителя) и команды джема (разложить по три).
// Панель учителя — вкладка «Вместе» (с кнопками), проектор — вкладка «Вместе» (только карта, итоги и сетка, крупно).
// Сетку рисует и страница ученика (шаг bracket): bracketSvg и colorOf общие.
'use strict';
window.LabM7 = (() => {
  const { el, api, toast, beep } = Lab;
  const COLS = ['#ff5fa2', '#ffb238', '#7cf5a8', '#5fd0ff', '#b48aff', '#ff6a4a', '#ffe14a', '#4affd8', '#ff8ad8', '#9ae64a', '#4a8aff', '#ffa0a0'];
  const colorOf = name => { let h = 7; for (const c of String(name)) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0; return COLS[h % COLS.length]; };
  const FIN_Z = -112, CPS = [0, -10, -32, -54, -76, -98];
  const PHASE = { off: 'Арена закрыта', lobby: 'Загон: класс разминается', run: 'Забег идёт', done: 'Забег окончен' };

  // турнирная сетка: колонки кругов, пары, провода к следующему кругу; победитель — с кубком, чемпион — с короной.
  // onSeat(round, match, nick) — щелчок по имени (учитель поправляет победителя)
  function bracketSvg(b, me, onSeat) {
    const R = b.rounds, colW = 168, rowH = 44, H = Math.max(1, R[0].length) * rowH * 2;
    const NS = 'http://www.w3.org/2000/svg', mk = (tag, a, ...kids) => { const n = document.createElementNS(NS, tag); for (const k in a) n.setAttribute(k, a[k]); kids.forEach(x => x != null && n.append(x)); return n; };
    const svg = mk('svg', { viewBox: `0 0 ${R.length * colW + 120} ${H + 10}`, class: 'm7-bracket', role: 'img', 'aria-label': 'Турнирная сетка' });
    const yOf = (r, i) => (i + 0.5) * (H / R[r].length);
    R.forEach((round, r) => round.forEach((m, i) => {
      const x = 8 + r * colW, y = yOf(r, i);
      if (r > 0) { const ya = yOf(r - 1, 2 * i), yb = yOf(r - 1, 2 * i + 1); svg.append(mk('path', { d: `M${x - colW + 150} ${ya}H${x - 8}V${yb}H${x - colW + 150}M${x - 8} ${y}H${x}`, class: 'm7-wire' + (m.a || m.b ? ' lit' : '') })); }
      [['a', -11], ['b', 11]].forEach(([side, dy]) => {
        const nick = m[side], won = m.w && m.w === nick, lost = m.w && nick && m.w !== nick;
        const g = mk('g', { class: 'm7-seat' + (won ? ' won' : '') + (lost ? ' lost' : '') + (nick && nick === me ? ' me' : '') + (onSeat && nick ? ' click' : ''), style: `--d:${(r * 4 + i) * 40}ms` });
        g.append(mk('rect', { x, y: y + dy - 10, width: 142, height: 20, rx: 6, style: nick ? `stroke:${colorOf(nick)}` : '' }), mk('text', { x: x + 8, y: y + dy + 5 }, document.createTextNode(nick ? (won ? '🏆 ' : '') + nick : m.bye ? '—' : '…')));
        if (onSeat && nick) g.addEventListener('click', () => onSeat(r, i, nick));
        svg.append(g);
      });
    }));
    const champ = R[R.length - 1][0].w;
    if (champ) { const x = 8 + R.length * colW - 20, y = yOf(R.length - 1, 0); svg.append(mk('g', { class: 'm7-champ' }, mk('text', { x: x + 10, y: y - 14 }, document.createTextNode('👑')), mk('text', { x, y: y + 12, class: 'name' }, document.createTextNode(champ)))); }
    return svg;
  }

  // карта забега сбоку: трасса слева направо, чекпоинты, точки учеников с именами, корона на финише.
  // Точки плывут к новым местам (данные приходят раз в секунду); в проверке без видеокарты (LAB_LOWRES) — 5 кадров в секунду
  function minimap(get) {
    const W = 900, H = 230, cv = el('canvas', { width: W, height: H, class: 'm7-map', 'aria-label': 'Карта забега' }), g = cv.getContext('2d');
    const shown = new Map(); let raf = 0, drawn = 0;
    const X = z => 40 + (W - 90) * (z / FIN_Z);
    const loop = now => {
      if (!cv.isConnected) { cancelAnimationFrame(raf); return; }
      raf = requestAnimationFrame(loop);
      if (window.LAB_LOWRES && now - drawn < 200) return;
      const dt = Math.min(0.1, (now - (drawn || now)) / 1000); drawn = now;
      const d = get() || {};
      g.clearRect(0, 0, W, H);
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#79c7ff'); gr.addColorStop(1, '#cbeaff'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = '#f0c75e'; g.fillRect(X(0), 120, X(FIN_Z) - X(0), 22);
      [['вертушки', -14, -28], ['острова', -32, -50], ['молоты', -54, -72], ['плиты', -76, -94], ['подъём', -98, -112]].forEach(([n, a, b], k) => {
        g.fillStyle = k % 2 ? 'rgba(255,95,162,.25)' : 'rgba(95,208,255,.25)'; g.fillRect(X(a), 110, X(b) - X(a), 42);
        g.fillStyle = '#21325a'; g.font = '700 12px system-ui'; g.textAlign = 'center'; g.fillText(n, (X(a) + X(b)) / 2, 168);
      });
      CPS.forEach(z => { g.fillStyle = '#ffffff'; g.fillRect(X(z) - 1, 104, 2, 54); });
      g.font = '22px system-ui'; g.fillText('👑', X(FIN_Z) + 14, 120);
      const dots = d.dots || [], seen = new Set();
      dots.forEach((p, k) => {
        seen.add(p.n);
        const s = shown.get(p.n) || { x: X(p.z), y: 131 + (p.x || 0) * 2 };
        s.x += (X(p.z) - s.x) * Math.min(1, dt * 6); s.y += (131 + (p.x || 0) * 2 - s.y) * Math.min(1, dt * 6); shown.set(p.n, s);
        g.fillStyle = colorOf(p.n); g.beginPath(); g.arc(s.x, s.y, p.f != null ? 7 : 6, 0, Math.PI * 2); g.fill();
        if (p.f != null) { g.strokeStyle = '#ffd23f'; g.lineWidth = 2; g.stroke(); }
        g.fillStyle = '#0b1020'; g.font = '700 11px system-ui'; g.textAlign = 'center'; g.fillText(p.n.slice(0, 10), s.x, s.y - (k % 2 ? 12 : -20));
      });
      for (const n of [...shown.keys()]) if (!seen.has(n)) shown.delete(n);
      g.fillStyle = 'rgba(11,16,32,.8)'; g.fillRect(10, 10, 360, 34);
      g.fillStyle = '#ffffff'; g.font = '800 16px system-ui'; g.textAlign = 'left';
      const left = d.phase === 'run' && d.start ? Math.ceil((d.start - (Date.now() + (d.skew || 0))) / 1000) : 0;
      g.fillText(`${PHASE[d.phase] || '—'}${left > 0 ? ' · старт через ' + left : ''} · на арене ${d.players || 0}`, 20, 32);
    };
    raf = requestAnimationFrame(loop);
    return cv;
  }

  // пульт: host — куда рисовать, code() — код класса, lesson() — урок с чекпоинтами (какие разделы нужны)
  function pult(host, { code, lesson, projector }) {
    const S = { arena: null, bracket: null, teams: null, skew: 0 };
    const hasStep = t => { const l = lesson(); return !!l && l.checkpoints.some(c => c.steps.some(s => s.type === t)); };
    const q = () => '?code=' + encodeURIComponent(code());
    const arenaBox = el('div', { class: 'stack' }), bracketBox = el('div', { class: 'stack' }), teamsBox = el('div', { class: 'stack' });
    const map = minimap(() => S.arena && Object.assign({}, S.arena, { skew: S.skew }));
    const board = el('div'), ctrl = el('div', { class: 'row' }), cards = el('div', { class: 'm7-rulegrid' });
    const act = async (path, body, after) => { try { const r = await api(path, Object.assign({ code: code() }, body)); beep('tick'); if (after) after(r); } catch (e) { toast(e.message, 'err'); } };
    function drawArena() {
      const a = S.arena; if (!a) return;
      ctrl.innerHTML = ''; cards.innerHTML = ''; board.innerHTML = '';
      if (!projector) {
        const b = (label, action, cls = 'btn small') => el('button', { type: 'button', class: cls, onclick: () => act('/api/teacher/arena', { action }, r => { S.arena = Object.assign({}, S.arena, r); drawArena(); }) }, label);
        ctrl.append(b('🟡 Открыть загон', 'open', 'btn ghost small'), b('🟢 Старт через 3 с', 'start'), b('🏁 Закончить забег', 'end', 'btn ghost small'), b('Закрыть арену', 'close', 'btn ghost small'),
          el('span', { class: 'small muted' }, `${PHASE[a.phase]} · раунд ${a.round} · на арене ${a.players} · квота ${a.quota || '—'} из ${a.n || 0}`));
      }
      const max = Math.max(1, ...(a.cards || []).map(c => c.votes));
      (a.cards || []).forEach(c => cards.append(el('div', { class: 'm7-rule' + (JSON.stringify(a.rules) === JSON.stringify((lessonCard(c.id) || {}).rules) ? ' on' : '') },
        el('span', { class: 'm7-ic' }, (lessonCard(c.id) || {}).icon || '🎲'), el('b', {}, c.label), el('i', { class: 'm7-bar' }, el('i', { style: `width:${Math.round(100 * c.votes / max)}%` })), el('span', { class: 'small' }, `голосов: ${c.votes}`),
        projector ? null : el('button', { type: 'button', class: 'btn ghost small', onclick: () => act('/api/teacher/arena', { action: 'rules', card: c.id }, r => { S.arena = Object.assign({}, S.arena, r); drawArena(); }) }, 'Применить'))));
      if (!projector && (a.cards || []).length) cards.append(el('div', { class: 'm7-rule' }, el('span', { class: 'm7-ic' }, '↺'), el('b', {}, 'Обычные правила'), el('button', { type: 'button', class: 'btn ghost small', onclick: () => act('/api/teacher/arena', { action: 'rules', rules: {} }, r => { S.arena = Object.assign({}, S.arena, r); drawArena(); }) }, 'Применить')));
      const res = a.results || [];
      if (res.length) {
        const list = el('ol', { class: 'm7-podium' + (projector ? ' big' : '') });
        res.slice(0, projector ? 10 : 20).forEach((r, i) => list.append(el('li', { style: `--c:${colorOf(r.nick)};--d:${i * 60}ms` }, el('b', {}, i === 0 ? '👑' : String(i + 1)), el('span', {}, r.nick), el('span', { class: 'muted' }, String(r.t).replace('.', ',') + ' с'))));
        board.append(el('div', { class: 'eyebrow' }, `Забег ${a.round}: прошли ${res.length}${a.quota ? ' из квоты ' + a.quota : ''}`), list);
      } else if ((a.log || []).length) board.append(el('div', { class: 'small muted' }, 'Прошлые забеги: ' + a.log.map(l => `№${l.round} — ${(l.results[0] || {}).nick || 'никто'} первым`).join(' · ')));
    }
    const lessonCard = id => { const l = lesson(); const st = l && l.checkpoints.flatMap(c => c.steps).find(s => s.type === 'arena' && s.cards); return st ? st.cards.find(c => c.id === id) : null; };
    function drawBracket() {
      bracketBox.innerHTML = '';
      bracketBox.append(el('h3', {}, '🏆 Турнирная сетка'));
      if (!projector) bracketBox.append(el('div', { class: 'row' },
        el('button', { type: 'button', class: 'btn small', onclick: () => act('/api/teacher/bracket', { action: 'make' }, r => { S.bracket = r.bracket; drawBracket(); }) }, S.bracket ? '↻ Собрать заново' : 'Собрать сетку из тех, кто на связи'),
        S.bracket ? el('button', { type: 'button', class: 'btn ghost small', onclick: () => act('/api/teacher/bracket', { action: 'reset' }, r => { S.bracket = null; drawBracket(); }) }, 'Убрать сетку') : null,
        el('span', { class: 'small muted' }, 'Щелчок по имени — поправить победителя пары')));
      if (!S.bracket) { bracketBox.append(el('div', { class: 'muted small' }, 'Сетки пока нет.')); return; }
      bracketBox.append(bracketSvg(S.bracket, null, projector ? null : (r, i, nick) => act('/api/teacher/bracket', { action: 'win', round: r, match: i, winner: nick }, x => { S.bracket = x.bracket; drawBracket(); })));
      if (S.bracket.champion) bracketBox.append(el('div', { class: 'm7-champline' }, `👑 Чемпион класса: ${S.bracket.champion}`));
    }
    function drawTeams() {
      teamsBox.innerHTML = '';
      teamsBox.append(el('h3', {}, '🛡 Команды джема'));
      const d = S.teams || { teams: [], free: [] };
      if (!projector) teamsBox.append(el('div', { class: 'row' },
        el('button', { type: 'button', class: 'btn small', onclick: () => act('/api/teacher/teams', { action: 'auto', size: 3 }, r => { S.teams = Object.assign({}, S.teams, r); loadTeams(); }) }, 'Разложить остальных по три'),
        el('button', { type: 'button', class: 'btn ghost small', onclick: async () => { if (await Lab.ask('Убрать все команды? Идеи и карточки команд пропадут, игры останутся.', { ok: 'Убрать', danger: true })) act('/api/teacher/teams', { action: 'reset' }, () => loadTeams()); } }, 'Убрать команды'),
        el('span', { class: 'small muted' }, d.free.length ? `Без команды: ${d.free.join(', ')}` : 'Все в командах')));
      const grid = el('div', { class: 'm7-teams' });
      d.teams.forEach((t, i) => grid.append(el('div', { class: 'm7-teamcard', style: `--d:${i * 60}ms` },
        el('b', {}, `${t.emblem || '🛡'} ${t.name}`), el('span', { class: 'small' }, t.members.map(n => `${n} (${t.roles[n] || '—'})`).join(', ') || 'пусто'),
        el('span', { class: 'small muted' }, t.cards && t.cards.donor ? `🎲 ${t.cards.donor.title}${t.cards.legend ? ' + ' + t.cards.legend.title : ''}${t.cards.locked ? ' ✓' : ''}` : 'карточки не брошены'),
        el('span', { class: 'small muted' }, `💡 идей: ${t.ideas.length}${t.pick ? ' · ★ ' + t.pick.text : ''}`),
        el('span', { class: 'small muted' }, t.gameId ? '🎮 игра команды есть' : 'игры пока нет'))));
      teamsBox.append(grid);
    }
    async function loadArena() { try { const r = await api('/api/arena' + q()); S.skew = r.now - Date.now(); S.arena = r; drawArena(); } catch (e) { /* класс сменился */ } }
    async function loadBracket() { try { S.bracket = (await api('/api/bracket' + q())).bracket; drawBracket(); } catch (e) { /* нет сетки */ } }
    async function loadTeams() { try { S.teams = await api('/api/teacher/teams' + q()); drawTeams(); } catch (e) { /* нет команд */ } }
    function layout() {
      host.innerHTML = '';
      const parts = [];
      if (hasStep('arena')) { arenaBox.innerHTML = ''; arenaBox.append(el('h3', {}, '🏃 Арена класса'), ctrl, map, el('div', { class: 'm7-arena' }, board, el('div', { class: 'stack' }, el('div', { class: 'eyebrow' }, 'Правило следующего забега: голоса класса'), cards))); parts.push(arenaBox); }
      if (hasStep('bracket')) parts.push(bracketBox);
      if (hasStep('team')) parts.push(teamsBox);
      if (!parts.length) parts.push(el('div', { class: 'card muted' }, 'В этом уроке нет арены, турнира и команд. Они появятся в уроках модуля 7.'));
      host.append(...parts);
    }
    let tick = 0, timer = null;
    function refresh() {
      if (!host.isConnected || host.closest('[hidden]')) return;
      const l = lesson(); if (l && l.id !== S.les) { S.les = l.id; layout(); } // учитель сменил урок — разделы пульта другие
      tick++;
      if (hasStep('arena')) loadArena();
      if (hasStep('bracket') && tick % 3 === 1) loadBracket();
      if (hasStep('team') && tick % 3 === 1) loadTeams();
    }
    return {
      show() { S.les = (lesson() || {}).id; layout(); tick = 0; refresh(); if (!timer) timer = setInterval(refresh, 1000); },
      hide() { clearInterval(timer); timer = null; },
    };
  }
  return { bracketSvg, colorOf, minimap, pult };
})();
