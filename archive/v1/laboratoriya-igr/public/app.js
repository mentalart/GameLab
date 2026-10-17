'use strict';
/* Приложение ученика «Лаборатория игр»: проигрывает сценарий урока шаг за шагом. */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pick = a => a[Math.floor(Math.random() * a.length)];
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };
const DICE = '⚄';
const MARK = ' [кубик]';

let TOKEN = store.get('lab-token');
let L = null, ME = null, UNLOCKED = 1, SHARED = null, MODE = 'qwen';
let view = 0, pollT = null, msgHandlers = [], waiting = false;
const pending = {};
const lastTele = {};
const autoFixed = {};

/* ---------- сеть ---------- */
async function api(path, body) {
  const r = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: Object.assign({ 'Content-Type': 'application/json' }, TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && TOKEN) { store.del('lab-token'); TOKEN = null; location.reload(); throw new Error('Нужно войти заново'); }
  if (!r.ok) { const e = new Error(j.error || 'Ошибка ' + r.status); e.data = j; e.status = r.status; throw e; }
  return j;
}
async function waitJob(job, onTick) {
  for (;;) {
    await sleep(1500);
    const j = await api('/api/job/' + job);
    if (onTick) onTick(j.seconds);
    if (j.status === 'done') return j.result;
    if (j.status === 'error') throw new Error(j.error);
  }
}
async function refresh() {
  const j = await api('/api/me');
  ME = j.me; UNLOCKED = j.unlocked; SHARED = j.shared; MODE = j.mode;
  renderTop();
}
const ans = id => (ME.answers && ME.answers[id]) || {};
async function saveAnswer(stepId, value) { const j = await api('/api/answer', { stepId, value }); ME = j.me; renderTop(); }

/* ---------- запуск ---------- */
(async function boot() {
  L = await api('/api/lesson');
  if (TOKEN) {
    try { await refresh(); view = Math.min(ME.step || 0, L.steps.length - 1); render(); startPoll(); return; }
    catch (e) { store.del('lab-token'); TOKEN = null; }
  }
  renderJoin();
})();
function startPoll() {
  clearInterval(pollT);
  pollT = setInterval(async () => {
    const u = UNLOCKED, sv = SHARED && SHARED.version;
    try { await refresh(); } catch (e) { return; }
    if (waiting && UNLOCKED !== u) render();
    else if (SHARED && SHARED.version !== sv && L.steps[view].type === 'shared') render();
  }, 5000);
}
window.addEventListener('message', e => {
  const d = e.data;
  if (!d || d.source !== 'lab-game') return;
  msgHandlers.forEach(h => { try { h(d, e.source); } catch (err) { console.error(err); } });
});

/* ---------- вход ---------- */
function renderJoin() {
  $('#top').hidden = true;
  $('#main').innerHTML = `<div class="join step">
    <div class="eyebrow">Школа креативных индустрий</div>
    <h1>Лаборатория игр</h1>
    <p class="lead">Курс, где каждое правило геймдизайна сразу становится игрой.</p>
    <div class="panel">
      <div class="field nodice"><label for="jName">Как тебя зовут?</label><input id="jName" autocomplete="off" placeholder="Имя и первая буква фамилии"></div>
      <div class="field nodice"><label for="jCode">Код класса (на доске у учителя)</label><input id="jCode" inputmode="numeric" autocomplete="off" placeholder="4 цифры"></div>
      <div class="row"><button class="btn" id="jGo" type="button">Войти в студию</button><button class="ghost" id="jMe" type="button" hidden>Это я, продолжить</button></div>
      <div class="err" id="jErr" role="alert"></div>
    </div>
  </div>`;
  const go = async resume => {
    $('#jErr').textContent = '';
    try {
      const j = await api('/api/join', { name: $('#jName').value, classCode: $('#jCode').value, resume });
      TOKEN = j.token; store.set('lab-token', TOKEN);
      await refresh(); view = Math.min(ME.step || 0, L.steps.length - 1); render(); startPoll();
    } catch (e) { $('#jErr').textContent = e.message; $('#jMe').hidden = !(e.data && e.data.canResume); }
  };
  $('#jGo').onclick = () => go(false);
  $('#jMe').onclick = () => go(true);
  $('#jCode').addEventListener('keydown', e => { if (e.key === 'Enter') go(false); });
}

/* ---------- шапка ---------- */
function renderTop() {
  if (!ME || !L) return;
  $('#top').hidden = false;
  $('#whoName').textContent = ME.name;
  $('#xp').textContent = ME.xp + ' XP';
  const cur = (L.steps[view] || {}).cp || 1;
  $('#cps').innerHTML = L.checkpoints.map(c => `<span class="cp ${c.n < cur ? 'done' : ''} ${c.n === cur ? 'now' : ''} ${c.n > UNLOCKED ? 'locked' : ''}" title="${esc(c.title)}"><i>${c.n}</i>${esc(c.title)}</span>`).join('');
}

/* ---------- каркас шага ---------- */
function render() {
  msgHandlers = [];
  const st = L.steps[view];
  renderTop();
  const main = $('#main');
  if (st.cp > UNLOCKED) {
    waiting = true;
    const cp = L.checkpoints.find(c => c.n === st.cp);
    const own = ME.games[ME.games.length - 1];
    main.innerHTML = `<div class="wait step"><div class="spinner" aria-hidden="true"></div><h2>Ждём учителя</h2><p>Скоро откроется чекпоинт ${st.cp} «${esc(cp ? cp.title : '')}». Не закрывай страницу.</p>
      ${own ? `<p class="note">А пока можно ещё раз сыграть в свою игру: <a href="/play/${own.id}?v=${own.version}" target="_blank" rel="noopener">${esc(own.title || 'моя игра')}</a></p>` : ''}
      ${view > 0 ? '<button class="ghost" id="back" type="button">Назад</button>' : ''}</div>`;
    const b = $('#back'); if (b) b.onclick = () => { view--; render(); };
    return;
  }
  waiting = false;
  main.innerHTML = `<section class="step" aria-labelledby="stTitle">
    <div class="eyebrow">Чекпоинт ${st.cp} · шаг ${view + 1} из ${L.steps.length}</div>
    <h1 id="stTitle">${esc(st.title)}</h1>
    <div class="step" id="body"></div>
    <div class="navrow"><div>${view > 0 ? '<button class="ghost" id="back" type="button">Назад</button>' : ''}</div>
      <div class="row"><span class="err" id="navErr" role="alert"></span>${st.next ? `<button class="btn" id="next" type="button">${esc(st.next)}</button>` : ''}</div></div>
  </section>`;
  const ctx = { body: $('#body'), before: null };
  const nextBtn = $('#next');
  ctx.enable = on => { if (nextBtn) nextBtn.disabled = !on; };
  ctx.enable(true);
  if ($('#back')) $('#back').onclick = () => { view--; render(); scrollTo(0, 0); };
  if (nextBtn) nextBtn.onclick = async () => {
    $('#navErr').textContent = '';
    nextBtn.disabled = true;
    try {
      if (ctx.before && (await ctx.before()) === false) { nextBtn.disabled = false; return; }
      view = Math.min(view + 1, L.steps.length - 1);
      if (view > (ME.step || 0)) { ME.step = view; api('/api/progress', { step: view }).catch(() => {}); }
      render(); scrollTo(0, 0);
    } catch (e) { $('#navErr').textContent = e.message; nextBtn.disabled = false; }
  };
  (R[st.type] || R.say)(st, ctx);
}

/* ---------- общие кусочки ---------- */
function gameFrame(src, label) {
  return `<div class="frame"><iframe src="${src}" title="${esc(label)}" sandbox="allow-scripts allow-pointer-lock" allow="gamepad; autoplay; fullscreen"></iframe></div>`;
}
function stripMark(v) { return String(v || '').replace(MARK, ''); }
function diceField(f, value, opts = {}) {
  const v = stripMark(value), marked = String(value || '').includes(MARK);
  const input = opts.area
    ? `<textarea id="f-${f.id}" placeholder="${esc(f.ph || '')}" ${marked ? `data-dice="${esc(v)}"` : ''}>${esc(v)}</textarea>`
    : `<input id="f-${f.id}" ${f.kind === 'number' ? 'type="number" inputmode="numeric"' : ''} value="${esc(v)}" placeholder="${esc(f.ph || '')}" ${marked ? `data-dice="${esc(v)}"` : ''}>`;
  if (!f.deck && !f.gen) return `<div class="field nodice"><label for="f-${f.id}">${esc(f.label)}</label>${input}</div>`;
  return `<div class="field"><label for="f-${f.id}">${esc(f.label)}</label>${input}<button type="button" class="dice" data-for="${f.id}" aria-label="Случайный вариант">${DICE}</button></div>`;
}
function wireDice(root, gens) {
  root.querySelectorAll('.dice').forEach(b => {
    b.onclick = () => {
      const id = b.dataset.for, el = $('#f-' + id, root), gen = gens[id];
      if (!el || !gen) return;
      let v, n = 0; do { v = gen(); n++; } while (v === el.value && n < 8);
      el.value = v; el.dataset.dice = v;
      b.classList.add('spin'); setTimeout(() => b.classList.remove('spin'), 300);
      el.dispatchEvent(new Event('input'));
    };
  });
}
function readField(root, id) {
  const el = $('#f-' + id, root); if (!el) return '';
  const v = el.value.trim(); if (!v) return '';
  return el.dataset.dice && el.dataset.dice === el.value ? v + MARK : v;
}
function aiText(t) { return esc(t).replace(/\n/g, '<br>'); }
function loadingBox(msgs) {
  const el = document.createElement('div'); el.className = 'loading'; el.setAttribute('role', 'status');
  el.innerHTML = `<div class="spinner" aria-hidden="true"></div><div><b class="lm">${esc(msgs[0])}</b><div class="note"><span class="ls">0</span> с</div></div>`;
  let i = 0; const t = setInterval(() => { i = (i + 1) % msgs.length; const m = el.querySelector('.lm'); if (m) m.textContent = msgs[i]; else clearInterval(t); }, 3500);
  el.tick = s => { const x = el.querySelector('.ls'); if (x) x.textContent = s; };
  el.stop = () => clearInterval(t);
  return el;
}
const NAMES = { left: 'влево', right: 'вправо', up: 'вверх', down: 'вниз', a: 'кнопку A (пробел)', b: 'кнопку B (Shift)' };
function insights(t) {
  if (!t || !t.time || t.time < 5) return [];
  const out = [];
  for (const k of Object.keys(NAMES)) {
    const share = t.held[k] / t.time;
    if (share > 0.6) out.push(`Ты держал ${NAMES[k]} ${Math.round(share * 100)}% времени. Может, это доминирующая стратегия — действие, о котором не нужно думать?`);
  }
  for (const k of ['a', 'b']) if (t.presses[k] === 0 && t.time > 15 && t.held[k] === 0) out.push(`Ты ни разу не нажал ${NAMES[k]}. Нужна ли она игре, или игрок о ней не догадался?`);
  if (t.hurts === 0 && t.time > 40) out.push('За всю партию ты ни разу не получил урон. Может, игре не хватает вызова?');
  if (!out.length) out.push('Ты пользовался управлением разнообразно. Похоже, выбор в игре живой.');
  return out;
}
function teleSummary(t) {
  if (!t) return '';
  const parts = Object.keys(NAMES).filter(k => t.held[k] > 0).map(k => `${NAMES[k]} ${Math.round(t.held[k] / t.time * 100)}%`);
  return `партия ${Math.round(t.time)} с, урон ${t.hurts} раз, доля времени с зажатой кнопкой: ${parts.join(', ') || 'нет данных'}`;
}

/* ---------- типы шагов ---------- */
const R = {};

R.say = (st, ctx) => { ctx.body.innerHTML = st.html || ''; };

R.shared = (st, ctx) => {
  const dec = (SHARED && SHARED.decisions) || [];
  ctx.body.innerHTML = `${st.html || ''}
    ${gameFrame('/play/shared?v=' + encodeURIComponent(SHARED.version), 'Общая игра')}
    <div class="under"><span>Кликни по игре, чтобы управлять с клавиатуры.</span><a href="/play/shared?v=${encodeURIComponent(SHARED.version)}" target="_blank" rel="noopener">Открыть на весь экран</a></div>
    ${dec.length ? `<div class="panel"><div class="eyebrow">Что решил дизайнер</div><ol class="decisions">${dec.map(d => `<li>${esc(d)}</li>`).join('')}</ol></div>` : ''}`;
};

R.playtest = (st, ctx) => {
  const a = ans(st.id), own = ME.games[ME.games.length - 1];
  const vals = a.values || {};
  const gameBlock = st.game === 'own' && own
    ? `${gameFrame(`/play/${own.id}?v=${own.version}`, 'Моя игра')}<div class="under"><span>Кликни по игре, чтобы управлять.</span><a href="/play/${own.id}?v=${own.version}" target="_blank" rel="noopener">Открыть на весь экран</a></div><div id="ins"></div>`
    : `<p class="note">Сыграть ещё раз: <a href="/play/shared?v=${encodeURIComponent(SHARED.version)}" target="_blank" rel="noopener">${esc(SHARED.title)}</a></p>`;
  const fields = st.fields.map(f => {
    const ff = Object.assign({}, f);
    if (f.dice) ff.deck = f.dice;
    if (f.nameDice) { ff.deck = L.decks.names; }
    let v = vals[f.id];
    if (v == null && f.nameDice && own) v = own.title || '';
    return diceField(ff, v, { area: !f.kind && !f.nameDice });
  }).join('');
  ctx.body.innerHTML = `${st.html || ''}${gameBlock}
    <div class="panel" id="pt">${fields}
      <div class="row"><button class="btn mint" id="ptSend" type="button">${a.submitted ? 'Обновить ответы' : 'Отправить ответы'}</button><span class="err" id="ptErr" role="alert"></span></div>
    </div><div id="fbBox"></div>`;
  const pt = $('#pt');
  const gens = {}; st.fields.forEach(f => { if (f.dice) gens[f.id] = () => pick(f.dice); if (f.nameDice) gens[f.id] = () => pick(L.decks.names); });
  wireDice(pt, gens);
  const showIns = () => {
    const box = $('#ins'); if (!box || !own) return;
    const t = lastTele[own.id] || own.telemetry;
    box.innerHTML = t ? `<div class="insight"><b>Игра заметила:</b> ${insights(t).map(esc).join(' ')}</div>` : '';
  };
  showIns();
  if (st.game === 'own' && own) msgHandlers.push(d => { if (d.type === 'gameover') { lastTele[own.id] = d.telemetry; api('/api/game/meta', { gameId: own.id, telemetry: d.telemetry }).catch(() => {}); showIns(); } });
  const fbText = ME.ai && ME.ai['fb_' + st.id];
  if (fbText) $('#fbBox').innerHTML = `<div class="fb"><div class="av" aria-hidden="true">У</div><p>${aiText(fbText)}</p></div>`;
  ctx.enable(!!a.submitted);
  $('#ptSend').onclick = async () => {
    $('#ptErr').textContent = '';
    const values = {}; let missing = false;
    st.fields.forEach(f => { values[f.id] = readField(pt, f.id); if (!values[f.id]) missing = true; });
    if (missing) { $('#ptErr').textContent = 'Ответь на все вопросы. Если не знаешь, брось кубик и поправь.'; return; }
    $('#ptSend').disabled = true;
    try {
      await saveAnswer(st.id, { values, submitted: true });
      if (st.fields.some(f => f.nameDice) && own) { await api('/api/game/meta', { gameId: own.id, title: stripMark(values.name) }); await refresh(); }
      ctx.enable(true);
      if (st.feedback) {
        const box = $('#fbBox'); box.innerHTML = ''; const ld = loadingBox(['Учитель читает твои ответы…']); box.appendChild(ld);
        const lines = st.fields.map(f => `${f.label}: ${values[f.id]}`);
        const t = own && (lastTele[own.id] || own.telemetry);
        try {
          const { job } = await api('/api/ai/feedback', { stepId: st.id, lines, gameTitle: st.game === 'own' ? (own && own.title) : SHARED.title, telemetry: st.game === 'own' && t ? teleSummary(t) : '' });
          const r = await waitJob(job, ld.tick); ld.stop();
          box.innerHTML = `<div class="fb"><div class="av" aria-hidden="true">У</div><p>${aiText(r.text)}</p></div>`;
          ME.ai = ME.ai || {}; ME.ai['fb_' + st.id] = r.text;
        } catch (e) { ld.stop(); box.innerHTML = `<p class="note">Отзыв учителя не загрузился: ${esc(e.message)}. Ответы сохранены, можно идти дальше.</p>`; }
      }
    } catch (e) { $('#ptErr').textContent = e.message; }
    $('#ptSend').disabled = false; $('#ptSend').textContent = 'Обновить ответы';
  };
};

R.quiz = (st, ctx) => {
  const a = ans(st.id);
  let qi = 0, score = 0;
  if (a.done) {
    ctx.body.innerHTML = `<div class="panel"><h2>Результат: ${a.score} из ${st.questions.length}</h2><p>${a.score === st.questions.length ? 'Без ошибок! Достижение «Глаз дизайнера» твоё.' : 'Хороший результат. Главное — понимать, на какой вопрос отвечает каждое решение: «что» или «как».'}</p><div class="row"><button class="ghost" id="retry" type="button">Пройти ещё раз</button></div></div>`;
    $('#retry').onclick = () => { ME.answers[st.id] = {}; R.quiz(st, ctx); };
    ctx.enable(true); return;
  }
  ctx.enable(false);
  const show = () => {
    const q = st.questions[qi];
    ctx.body.innerHTML = `<div class="panel"><div class="eyebrow">Вопрос ${qi + 1} из ${st.questions.length}</div><p class="quizq">${esc(q.q)}</p>
      <div class="opts">${q.options.map((o, i) => `<button class="opt" type="button" data-i="${i}">${esc(o)}</button>`).join('')}</div><div id="why"></div></div>`;
    ctx.body.querySelectorAll('.opt').forEach(b => b.onclick = async () => {
      const i = +b.dataset.i, ok = i === q.correct;
      if (ok) score++;
      ctx.body.querySelectorAll('.opt').forEach(x => { x.disabled = true; if (+x.dataset.i === q.correct) x.classList.add('right'); });
      if (!ok) b.classList.add('wrong');
      const last = qi === st.questions.length - 1;
      $('#why').innerHTML = `<p style="margin-top:10px"><b>${ok ? 'Точно.' : 'Не совсем.'}</b> ${esc(q.why)}</p><div class="row" style="margin-top:10px"><button class="btn mint" id="qn" type="button">${last ? 'Результат' : 'Следующий вопрос'}</button></div>`;
      $('#qn').onclick = async () => {
        if (!last) { qi++; show(); return; }
        await saveAnswer(st.id, { score, done: true });
        R.quiz(st, ctx);
      };
    });
  };
  show();
};

R.igra = (st, ctx) => {
  const D = L.decks, prev = ans(st.id).form || {};
  let level = prev.level || 'Базовый', card = prev.card || '';
  const F = [
    { id: 'd1', label: 'Чувство: что должен почувствовать игрок?', ph: 'Уютная спешка, как когда опаздываешь на автобус' },
    { id: 'd2', label: 'Честность: почему проигрыш не будет обидным?', ph: 'Опасность видна за секунду до удара' },
    { id: 'd3', label: 'Выбор: какое решение игрок принимает снова и снова?', ph: 'Рискнуть за бонусом или идти безопасно' },
  ];
  const P = [
    { id: 'pI', l: 'И', label: 'Идея в одной фразе и главное чувство', ph: 'Аркада про улитку-почтальона, которая успевает разнести письма до грозы. Чувство — уютная спешка' },
    { id: 'pG', l: 'Г', label: 'Глагол: что делает игрок и какими кнопками', ph: 'Влево-вправо — ползти, пробел — спрятаться в раковину' },
    { id: 'pR', l: 'Р', label: 'Правила: цель, победа, поражение, очки, что мешает', ph: 'Капли падают с неба, в раковине не страшно, но время идёт. 60 секунд, очки за письма' },
    { id: 'pA', l: 'А', label: 'Атмосфера: стиль, цвета, звуки, сочность', ph: 'Мокрая улица, жёлтые фонари, уютное шлёпанье, брызги' },
  ];
  const valAttr = id => { const v = prev[id] || ''; const m = String(v).includes(MARK); return { v: stripMark(v), m }; };
  const ltr = p => { const { v, m } = valAttr(p.id); return `<div class="ltr-grid"><span class="lab">${esc(p.label)}</span><div class="ltr" aria-hidden="true">${p.l}</div><textarea id="f-${p.id}" aria-label="${esc(p.label)}" placeholder="${esc(p.ph)}" ${m ? `data-dice="${esc(v)}"` : ''}>${esc(v)}</textarea><button type="button" class="dice" data-for="${p.id}" aria-label="Случайный вариант">${DICE}</button></div>`; };
  ctx.body.innerHTML = `
    <div class="panel"><h2>Уровень</h2>
      <div class="levels">
        <button type="button" class="level" data-v="Базовый"><b>Базовый</b><span>Игра по карте идеи</span></button>
        <button type="button" class="level" data-v="Продвинутый"><b>Продвинутый</b><span>Своя идея и механика</span></button>
        <button type="button" class="level" data-v="Босс"><b>Босс</b><span>Сломай одно правило общей игры «${esc(SHARED.title)}»</span></button>
      </div>
      <div class="idea" id="ideaBox"><button class="ghost" id="draw" type="button">Вытянуть карту идеи</button><span id="cardText">${card ? `<b>${esc(card)}</b>` : 'Кубик у буквы «И» возьмёт героя с этой карты'}</span></div>
    </div>
    <div class="panel" id="formA"><h2>Три решения до промпта</h2>${F.map(f => diceField({ id: f.id, label: f.label, ph: f.ph, deck: true }, prev[f.id])).join('')}</div>
    <div class="panel" id="formB"><h2>Промпт по формуле «ИГРА»</h2>${P.map(ltr).join('')}
      <p class="note">Кубик предлагает, автор решает: поправь хотя бы пару слов, чтобы вариант стал твоим. Варианты без правок уйдут с пометкой «кубик».</p>
      <div class="row"><button class="ghost" id="all" type="button">${DICE} Бросить все кубики</button></div>
    </div>`;
  const setLevel = v => { level = v; ctx.body.querySelectorAll('.level').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v))); $('#ideaBox').hidden = v !== 'Базовый'; };
  ctx.body.querySelectorAll('.level').forEach(b => b.onclick = () => setLevel(b.dataset.v));
  setLevel(level);
  const drawCard = () => { card = `${pick(D.hero)} ${pick(D.action)} ${pick(D.place)}`; $('#cardText').innerHTML = `<b>${esc(card)}</b>`; };
  $('#draw').onclick = drawCard;
  const feelWord = () => stripMark(($('#f-d1').value || pick(D.feel))).split(':')[0].toLowerCase();
  const gens = {
    d1: () => pick(D.feel), d2: () => pick(D.fair), d3: () => pick(D.choice),
    pI: () => {
      if (level === 'Босс') return `${pick(D.boss)} — в игре «${SHARED.title}». Чувство — ${feelWord()}`;
      if (level === 'Базовый') { if (!card) drawCard(); return `${pick(D.genre)} про то, как ${card}. Чувство — ${feelWord()}`; }
      return `${pick(D.genre)} про то, как ${pick(D.hero)} ${pick(D.action)} ${pick(D.place)}, а ${pick(D.twist)}. Чувство — ${feelWord()}`;
    },
    pG: () => pick(D.verb), pR: () => pick(D.rules), pA: () => pick(D.mood),
  };
  wireDice(ctx.body, gens);
  $('#all').onclick = () => ['d1', 'd2', 'd3', 'pI', 'pG', 'pR', 'pA'].forEach((id, i) => setTimeout(() => { const b = ctx.body.querySelector(`.dice[data-for="${id}"]`); if (b) b.click(); }, i * 90));
  ctx.before = async () => {
    const form = { level, card: level === 'Базовый' ? card : '' };
    for (const id of ['d1', 'd2', 'd3']) { form[id] = readField(ctx.body, id); if (!form[id]) throw new Error('Сначала три решения: так работает студия.'); }
    for (const id of ['pI', 'pG', 'pR', 'pA']) { form[id] = readField(ctx.body, id); if (!form[id]) throw new Error('Заполни все четыре буквы формулы «ИГРА».'); }
    await saveAnswer(st.id, { form, submitted: true });
    await saveAnswer('producer', { picks: {}, decisions: null, done: false });
    const { job } = await api('/api/ai/review', { form });
    pending.review = job;
    if (ME.ai) delete ME.ai.review;
    return true;
  };
};

R.review = (st, ctx) => {
  const a = ans(st.id);
  const review = ME.ai && ME.ai.review;
  if (pending.review && !review) {
    ctx.enable(false);
    const ld = loadingBox(['Продюсер читает замысел…', 'Ищет противоречия…', 'Готовит вопросы автору…']);
    ctx.body.innerHTML = ''; ctx.body.appendChild(ld);
    waitJob(pending.review, ld.tick).then(async () => { ld.stop(); pending.review = null; await refresh(); render(); })
      .catch(e => { ld.stop(); pending.review = null; ctx.body.innerHTML = `<p class="err">${esc(e.message)}</p><div class="row"><button class="btn" id="again" type="button">Отправить ещё раз</button></div>`; $('#again').onclick = resend; });
    return;
  }
  async function resend() {
    const form = ans('igra').form;
    if (!form) { view--; render(); return; }
    const { job } = await api('/api/ai/review', { form }); pending.review = job; if (ME.ai) delete ME.ai.review; render();
  }
  if (!review) {
    ctx.enable(false);
    ctx.body.innerHTML = `<p>Замысел ещё не у продюсера.</p><div class="row"><button class="btn" id="again" type="button">Отправить продюсеру</button></div>`;
    $('#again').onclick = resend; return;
  }
  const picks = Object.assign({}, a.picks || {});
  const dec = a.decisions || review.decisions || {};
  const D = L.decks;
  ctx.body.innerHTML = `
    <p class="lead">В студии продюсер читает промпт до того, как его увидит программист: Qwen выполняет всё буквально, даже противоречия.</p>
    ${review.strong ? `<div class="fb"><div class="av" aria-hidden="true">П</div><p><b>Что сильное.</b> ${aiText(review.strong)}</p></div>` : ''}
    ${review.issues && review.issues.length ? `<div class="panel"><h2>Находки продюсера</h2><ol class="issues">${review.issues.map(i => `<li>${aiText(i)}</li>`).join('')}</ol></div>` : ''}
    ${(review.forks || []).map((f, fi) => `<div class="panel"><h3>${esc(f.question)}</h3><div class="forkopts">${(f.options || []).map(o => `<button type="button" class="level" data-f="${fi}" data-v="${esc(o.label)}" aria-pressed="${picks[f.question] === o.label}"><b>${esc(o.label)}</b><span>${esc(o.detail || '')}</span></button>`).join('')}</div></div>`).join('')}
    <div class="panel" id="decs"><h2>Три решения, переформулированные под твой глагол</h2><p class="note">Поправь, если продюсер понял не так. Это твои решения.</p>
      ${diceField({ id: 'feel', label: 'Чувство', deck: true }, dec.feel)}${diceField({ id: 'fair', label: 'Честность', deck: true }, dec.fair)}${diceField({ id: 'choice', label: 'Выбор', deck: true }, dec.choice)}
      <div class="row"><button class="ghost" id="rerun" type="button">Переписать замысел</button></div></div>`;
  ctx.body.querySelectorAll('.forkopts .level').forEach(b => b.onclick = () => {
    const f = review.forks[+b.dataset.f]; picks[f.question] = b.dataset.v;
    ctx.body.querySelectorAll(`.forkopts .level[data-f="${b.dataset.f}"]`).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  });
  wireDice($('#decs'), { feel: () => pick(D.feel), fair: () => pick(D.fair), choice: () => pick(D.choice) });
  $('#rerun').onclick = () => { view--; render(); };
  ctx.before = async () => {
    for (const f of review.forks || []) if (!picks[f.question]) throw new Error('Ответь на вопросы продюсера: развилки решает только автор.');
    const decisions = { feel: readField(ctx.body, 'feel'), fair: readField(ctx.body, 'fair'), choice: readField(ctx.body, 'choice') };
    if (!decisions.feel || !decisions.fair || !decisions.choice) throw new Error('Заполни три решения.');
    await saveAnswer(st.id, { picks, decisions, done: true });
    return true;
  };
};

R.build = (st, ctx) => {
  const own = ME.games[ME.games.length - 1];
  const D = L.decks;
  const form = ans('igra').form || {}, prod = ans('producer');
  if (!own) {
    ctx.enable(false);
    const dec = prod.decisions || {};
    ctx.body.innerHTML = `<div class="panel"><h2>Задание для Qwen</h2>
      <ol class="decisions"><li><b>Чувство:</b> ${esc(stripMark(dec.feel || form.d1))}</li><li><b>Честность:</b> ${esc(stripMark(dec.fair || form.d2))}</li><li><b>Выбор:</b> ${esc(stripMark(dec.choice || form.d3))}</li></ol>
      <ol class="decisions" style="list-style:none;padding:0"><li><b>И:</b> ${esc(stripMark(form.pI))}</li><li><b>Г:</b> ${esc(stripMark(form.pG))}</li><li><b>Р:</b> ${esc(stripMark(form.pR))}</li><li><b>А:</b> ${esc(stripMark(form.pA))}</li></ol>
      ${Object.keys(prod.picks || {}).length ? `<p class="note">Решения по вопросам продюсера: ${Object.entries(prod.picks).map(([q, v]) => esc(v)).join(' · ')}</p>` : ''}
      <p class="note">Стандарт студии добавится сам: ручки геймдизайнера, геймпад, тач-кнопки, звук и сочность.</p>
      <div class="row"><button class="btn" id="gen" type="button">Собрать игру</button></div></div><div id="genBox"></div>`;
    const go = async () => {
      $('#gen').disabled = true;
      const box = $('#genBox'); box.innerHTML = '';
      const ld = loadingBox(['Qwen читает твой замысел…', 'Пишет правила игры…', 'Расставляет ручки геймдизайнера…', 'Добавляет сочность…', 'Проверяет код…']);
      box.appendChild(ld);
      try {
        const { job } = await api('/api/ai/generate', {});
        pending.build = job;
        await waitJob(job, ld.tick); ld.stop(); pending.build = null;
        await refresh(); render();
      } catch (e) { ld.stop(); pending.build = null; box.innerHTML = `<p class="err">${esc(e.message)}</p>`; $('#gen').disabled = false; }
    };
    $('#gen').onclick = go;
    if (pending.build) { $('#gen').disabled = true; const ld = loadingBox(['Qwen всё ещё собирает игру…']); $('#genBox').appendChild(ld); waitJob(pending.build, ld.tick).then(async () => { ld.stop(); pending.build = null; await refresh(); render(); }).catch(e => { ld.stop(); pending.build = null; $('#genBox').innerHTML = `<p class="err">${esc(e.message)}</p>`; $('#gen').disabled = false; }); }
    return;
  }
  ctx.enable(true);
  ctx.body.innerHTML = `
    <p class="lead">Твоя игра готова: <b>${esc(own.title || 'без названия')}</b>, версия ${own.version}. Сыграй и реши, что поправить.</p>
    ${gameFrame(`/play/${own.id}?v=${own.version}`, 'Моя игра')}
    <div class="under"><span>Кликни по игре, чтобы управлять. Ручки — клавиша Tab.</span><a href="/play/${own.id}?v=${own.version}" target="_blank" rel="noopener">Открыть на весь экран</a></div>
    <div id="errArea"></div>
    <div class="panel" id="fixP"><h2>Поправить игру</h2>
      <p class="note">Одна правка — один запрос. Числа лучше крутить ручками, а Qwen просить о том, чего ручками не сделать.</p>
      ${diceField({ id: 'fix', label: 'Что изменить?', deck: true, ph: 'Сделай начало спокойнее: первые 10 секунд без врагов' }, '', { area: true })}
      <div class="row"><button class="btn mint" id="fixGo" type="button">Попросить Qwen</button><button class="ghost" id="undo" type="button">Откатить к прошлой версии</button><button class="ghost" id="regen" type="button">Собрать заново</button></div>
      <div id="fixBox"></div></div>`;
  wireDice($('#fixP'), { fix: () => pick(D.fix) });
  const fix = async (payload, msgs) => {
    const box = $('#fixBox'); box.innerHTML = '';
    const ld = loadingBox(msgs); box.appendChild(ld);
    ['fixGo', 'undo', 'regen'].forEach(i => $('#' + i).disabled = true);
    try { const { job } = await api('/api/ai/fix', Object.assign({ gameId: own.id }, payload)); await waitJob(job, ld.tick); ld.stop(); await refresh(); render(); }
    catch (e) { ld.stop(); box.innerHTML = `<p class="err">${esc(e.message)}</p>`; ['fixGo', 'undo', 'regen'].forEach(i => $('#' + i).disabled = false); }
  };
  $('#fixGo').onclick = () => {
    const req = readField($('#fixP'), 'fix');
    if (!req) { $('#fixBox').innerHTML = '<p class="err">Напиши, что изменить, или брось кубик.</p>'; return; }
    fix({ request: req }, ['Qwen читает просьбу…', 'Меняет код…', 'Проверяет, что ничего не сломалось…']);
  };
  $('#undo').onclick = async () => { try { await api('/api/game/undo', { gameId: own.id }); await refresh(); render(); } catch (e) { $('#fixBox').innerHTML = `<p class="err">${esc(e.message)}</p>`; } };
  $('#regen').onclick = async () => {
    $('#regen').disabled = true;
    const box = $('#fixBox'); box.innerHTML = ''; const ld = loadingBox(['Qwen собирает игру заново…']); box.appendChild(ld);
    try { const { job } = await api('/api/ai/generate', {}); await waitJob(job, ld.tick); ld.stop(); await refresh(); render(); }
    catch (e) { ld.stop(); box.innerHTML = `<p class="err">${esc(e.message)}</p>`; $('#regen').disabled = false; }
  };
  msgHandlers.push(d => {
    if (d.type === 'error') {
      const key = own.id + ':' + own.version;
      $('#errArea').innerHTML = `<div class="insight"><b>Игра сломалась:</b> ${esc(d.message)}. Так бывает — это «провал дня», а не беда.</div><div class="row" style="margin-top:8px"><button class="btn" id="autofix" type="button">Починить игру</button></div>`;
      $('#autofix').onclick = () => fix({ error: `${d.where}: ${d.message}\n${d.stack || ''}` }, ['Qwen ищет ошибку…', 'Чинит код…']);
      if (!autoFixed[key]) { autoFixed[key] = true; $('#autofix').click(); }
    }
    if (d.type === 'gameover') { lastTele[own.id] = d.telemetry; api('/api/game/meta', { gameId: own.id, telemetry: d.telemetry }).catch(() => {}); }
  });
};

const RANKS = [[0, 'Новичок'], [100, 'Прототипёр'], [250, 'Механик'], [450, 'Левел-дизайнер'], [700, 'Геймдизайнер'], [1000, 'Мастер игр']];
R.arcade = (st, ctx) => {
  const a = ans(st.id), D = L.decks;
  const rank = [...RANKS].reverse().find(r => ME.xp >= r[0]), next = RANKS.find(r => r[0] > ME.xp);
  const pt1 = (ans('pt1').values) || {}, pt2 = (ans('pt2').values) || {};
  const card = (title, meta, dec, finding, href) => `<article class="cab"><h3>${esc(title)}</h3><div class="meta">${meta.map(m => `<span class="chip">${esc(m)}</span>`).join('')}</div>
    ${dec && dec.length ? `<ol class="decisions">${dec.map(d => `<li>${esc(stripMark(d))}</li>`).join('')}</ol>` : ''}
    ${finding ? `<div class="finding"><small>Открытие плейтеста</small>${esc(stripMark(finding))}</div>` : ''}
    <a class="btn" style="align-self:flex-start;text-decoration:none" href="${href}" target="_blank" rel="noopener">Играть</a></article>`;
  const ownCards = ME.games.map(g => card(g.title || 'Моя игра', ['автор: ' + ME.name, 'версия ' + g.version, pt2.record ? 'рекорд ' + stripMark(pt2.record) : ''].filter(Boolean), g.decisions, pt2.often, `/play/${g.id}?v=${g.version}`)).join('');
  ctx.body.innerHTML = `
    <p class="lead">Все игры этого занятия. Аркада растёт с каждым уроком, а к Фестивалю в ней будут сотни игр класса.</p>
    <div class="games">${card(SHARED.title, ['общая игра урока', pt1.record ? 'рекорд ' + stripMark(pt1.record) : ''].filter(Boolean), SHARED.decisions, pt1.change, '/play/shared?v=' + encodeURIComponent(SHARED.version))}${ownCards}</div>
    <div class="cols">
      <div class="panel"><h2>Достижения</h2><div class="badges">${ME.achievements.map(b => `<div class="badge"><div class="ico">${esc(b.icon)}</div><div><b>${esc(b.title)}</b><small>${esc(b.text)}</small></div></div>`).join('') || '<p class="note">Пока пусто.</p>'}</div>
        <div><b>${ME.xp} XP · ${esc(rank[1])}</b>${next ? `<span class="note"> · до «${esc(next[1])}» ${next[0] - ME.xp}</span>` : ''}</div>
        <div class="bar"><i style="width:${next ? Math.round((ME.xp - rank[0]) / (next[0] - rank[0]) * 100) : 100}%"></i></div></div>
      <div class="panel"><h2>Колода линз</h2><div class="lens"><div class="k">Линза 1 · эмоции</div><div class="q">Что должен почувствовать игрок?</div><div>Задавай этот вопрос до промпта и после плейтеста. Если ответы разные, игре нужна новая версия.</div></div></div>
      <div class="panel" id="jr"><h2>Журнал</h2>
        ${diceField({ id: 'discovery', label: 'Открытие дня: что ты понял сегодня о том, как устроены игры?', deck: true }, a.discovery, { area: true })}
        ${diceField({ id: 'v2', label: 'Версия 2: что ты изменишь в своей игре на следующем занятии?', deck: true }, a.v2, { area: true })}
      </div>
    </div>`;
  wireDice($('#jr'), { discovery: () => pick(D.discovery), v2: () => pick(D.v2) });
  ctx.before = async () => {
    const discovery = readField(ctx.body, 'discovery'), v2 = readField(ctx.body, 'v2');
    if (!discovery) throw new Error('Запиши открытие дня — одной фразы хватит.');
    await saveAnswer(st.id, { discovery, v2, done: true });
    return true;
  };
};
