// Страница ученика: урок по чекпоинтам и типовые шаги (play, teacher-demo, choice, text, sort, rounds, cycle, trace, predict, blind, blindpair, listen, sequencer, vote, cards, secret, factory, decisions, igra, producer, build, aicheck, workshop, release, arcade, playtest).
// Рамка игры, карточки аркады и открытие плейтеста — в games.js, поле с кубиком — в common.js.
'use strict';
const { el, api, toast, roll, beep, copy, valText, fieldEditor } = Lab;
const $ = s => document.querySelector(s);
const S = { me: null, lesson: null, answers: {}, game: null, wow: null, opened: [], cpId: null, hooks: [], demo: false };

/* =================== загрузка и синхронизация =================== */
async function boot() {
  let me;
  try { me = await api('/api/me'); } catch (e) {
    if (e.status === 401) { location.href = '/'; return; }
    $('#main').innerHTML = ''; $('#main').append(el('div', { class: 'locked-msg' }, e.message)); return;
  }
  S.me = me; S.lesson = me.lesson; S.answers = me.answers || {}; S.game = me.game; S.wow = me.wow; S.opened = me.class.opened; S.demo = me.demo;
  $('#lessonTitle').textContent = `Урок ${me.lesson.number} · ${me.lesson.title} · донор: ${me.lesson.donor}`;
  $('#nick').textContent = me.nick + ' · класс ' + me.class.code;
  $('#demoBanner').hidden = !me.demo;
  $('#noteBtn').hidden = !me.class.authorMode;
  drawHelp();
  S.cpId = pickCheckpoint();
  S.board = Games.board(); // доска вызовов класса: над шагами любого чекпоинта
  render();
  listen();
}
// поднятая рука: видна учителю в очереди «Нужна помощь», опускается самим учеником или кнопкой учителя «Помог»
function drawHelp() {
  const b = $('#helpBtn'), on = !!S.me.help;
  b.textContent = on ? '✋ Рука поднята — учитель идёт' : '✋ Нужна помощь';
  b.classList.toggle('warm', on); b.classList.toggle('ghost', !on); b.setAttribute('aria-pressed', String(on));
}
$('#helpBtn').addEventListener('click', async () => {
  try { const r = await api('/api/help', { on: !S.me.help }); S.me.help = r.help; drawHelp(); if (r.help) toast('Учитель увидит тебя первым в очереди', 'ok'); } catch (e) { toast(e.message, 'err'); }
});
function listen() {
  const es = new EventSource('/api/events?token=' + encodeURIComponent(Lab.token.get()));
  es.addEventListener('class', e => {
    const d = JSON.parse(e.data);
    if (d.lesson !== S.lesson.id) { location.reload(); return; }
    const before = S.opened;
    const wasLocked = !isOpen(cpById(S.cpId)); // до обновления: ученик ждал на закрытом чекпоинте, и учитель открыл именно его
    S.opened = d.opened;
    $('#noteBtn').hidden = !d.authorMode; S.me.class.authorMode = d.authorMode;
    const fresh = S.lesson.checkpoints.filter(cp => d.opened.includes(cp.id) && !before.includes(cp.id));
    if (fresh.length) {
      beep('tick');
      toast(`Учитель открыл: ${fresh.map(c => c.title).join(', ')}`, 'ok');
      if (wasLocked || cpDone(cpById(S.cpId))) { S.cpId = fresh[0].id; renderMain(); }
    }
    renderSide();
    if (!isOpen(cpById(S.cpId))) renderMain();
  });
  // аркада класса: соседи собрали игру, сыграли в мою, оставили плейтест — шаги arcade и playtest обновляются сами
  es.addEventListener('arcade', e => { const d = JSON.parse(e.data); S.hooks.forEach(h => h('arcade', d)); });
  // вызовы «побей мой мир»: новый вызов, новый лидер (обойдённому — «отыграйся»), мир дня от учителя
  es.addEventListener('challenge', e => Games.challengeEvent(JSON.parse(e.data), S.me.nick, S.board));
  // вау-старт: учитель тянет карты, собирает и раздаёт игру класса — шаги cards, play (shared) и secret обновляются сами
  es.addEventListener('wow', e => {
    const before = S.wow;
    S.wow = JSON.parse(e.data);
    if (S.wow.status === 'given' && (!before || before.status !== 'given')) { beep('done'); toast('Игра класса готова — играем!', 'ok'); }
    S.hooks.forEach(h => h('wow', S.wow));
  });
  es.addEventListener('feedback', e => {
    const d = JSON.parse(e.data);
    if (d.nick !== S.me.nick) return;
    api('/api/playtest/mine').then(r => { S.me.feedback = r.feedback; S.hooks.forEach(h => h('feedback', r)); }).catch(() => {});
    beep('good'); toast('Учитель оставил тебе отзыв — он в шаге плейтеста', 'ok');
  });
  // вау-старт учителя: карты, сборка, игра открылась — шаг teacher-demo обновляется сам
  es.addEventListener('demo', e => { const d = JSON.parse(e.data); S.hooks.forEach(h => h('demo', d)); });
  es.addEventListener('help', e => { if (JSON.parse(e.data).nick === S.me.nick) { S.me.help = null; drawHelp(); } });
  es.addEventListener('limits', e => {
    const d = JSON.parse(e.data);
    if (d.nick !== S.me.nick) return;
    S.me.aiLimit = d.limit; beep('good'); toast(`Учитель добавил тебе запросов к ИИ: теперь ${d.calls} из ${d.limit}`, 'ok');
  });
}
const cpById = id => S.lesson.checkpoints.find(c => c.id === id);
const isOpen = cp => !!cp && S.opened.includes(cp.id);
const ans = id => S.answers[id] || {};
const cpDone = cp => !!cp && cp.steps.every(s => ans(s.id).done);
function pickCheckpoint() {
  const open = S.lesson.checkpoints.filter(isOpen);
  return (open.find(cp => !cpDone(cp)) || open[open.length - 1] || S.lesson.checkpoints[0]).id;
}

let saveTimers = {};
const pendingSaves = {}, inflight = new Set();
function save(stepId, value, done, now) {
  const prev = ans(stepId);
  S.answers[stepId] = { value, done: done == null ? !!prev.done : !!done, at: new Date().toISOString() };
  clearTimeout(saveTimers[stepId]);
  const go = () => {
    delete pendingSaves[stepId];
    const p = api('/api/answer', { step: stepId, value, done: S.answers[stepId].done }).catch(e => toast(e.message, 'err'));
    inflight.add(p); p.finally(() => inflight.delete(p));
    return p;
  };
  if (now || done != null) go(); else { pendingSaves[stepId] = go; saveTimers[stepId] = setTimeout(go, 600); }
  if (done != null) renderSide();
  // замысел изменился: шаг ИГРА в том же чекпоинте пересобирает черновик (событие 'plan')
  const plan = S.lesson.plan || {};
  if (stepId === plan.factory || stepId === plan.decisions) S.hooks.forEach(h => h('plan', stepId));
}
// перед сборкой: все ответы, которые ещё ждут отправки, уходят на сервер — замысел собирается из них
function flushSaves() {
  for (const [id, go] of Object.entries(pendingSaves)) { clearTimeout(saveTimers[id]); go(); }
  return Promise.all([...inflight]);
}

/* =================== отрисовка =================== */
function render() { renderSide(); renderMain(); }
function renderSide() {
  const side = $('#side'); side.innerHTML = '';
  side.append(el('div', { class: 'eyebrow', style: 'margin:0 0 6px 4px' }, 'Чекпоинты урока'));
  S.lesson.checkpoints.forEach((cp, i) => {
    const open = isOpen(cp), done = cpDone(cp);
    side.append(el('button', {
      type: 'button', class: `cp ${open ? 'open' : 'locked'} ${done ? 'done' : ''} ${cp.id === S.cpId ? 'active' : ''}`,
      'aria-current': cp.id === S.cpId ? 'step' : null,
      onclick: () => { if (!open) { toast('Этот чекпоинт ещё не открыт учителем'); return; } S.cpId = cp.id; renderSide(); renderMain(); scrollTo(0, 0); },
    }, el('span', { class: 'dot' }, done ? '✓' : open ? String(i + 1) : '🔒'),
    el('span', {}, el('div', { class: 't' }, cp.title), el('div', { class: 'm' }, `${cp.minutes} мин · шагов: ${cp.steps.length}`))));
  });
  side.append(el('p', { class: 'muted small', style: 'margin:12px 4px 0' }, S.lesson.lens));
}
function stopFrames() { Games.stopAll(); }
// сборка и правка: остановить все игры, но не снимать их — другие шаги чекпоинта (игра соседа, своя игра) остаются живыми
function pauseFrames() { Games.frames.slice().forEach(f => f.stop()); }
function renderMain() {
  stopFrames(); S.hooks = [];
  const main = $('#main'); main.innerHTML = '';
  const cp = cpById(S.cpId);
  if (!isOpen(cp)) {
    main.append(el('div', { class: 'card locked-msg' }, el('h2', {}, 'Ждём учителя'), el('p', { style: 'margin-top:8px' }, 'Учитель откроет первый чекпоинт, и урок начнётся. Страницу обновлять не нужно.')));
    return;
  }
  const idx = S.lesson.checkpoints.indexOf(cp);
  if (S.board) main.append(S.board);
  main.append(el('div', { class: 'stack', style: 'gap:6px' },
    el('div', { class: 'eyebrow' }, `Чекпоинт ${idx + 1} из ${S.lesson.checkpoints.length} · ${cp.minutes} минут`),
    el('h1', {}, cp.title)));
  if (idx === 0 && S.me.prevPlan) {
    const pp = S.me.prevPlan;
    main.append(el('div', { class: 'card prev-plan stack', style: 'gap:6px' },
      el('b', {}, `Твой план версии 2 с урока ${pp.lesson}` + (pp.game ? ` для «${pp.game}»` : '')),
      el('p', {}, pp.text),
      el('p', { class: 'small muted' }, 'Сегодня можно взять этот план в новую игру или вернуться к старой. Все игры и записи — в «Моей студии».')));
  }
  cp.steps.forEach((step, i) => main.append(stepCard(step, i, cp)));
  const next = S.lesson.checkpoints[idx + 1];
  main.append(el('div', { class: 'row' },
    S.me.class.authorMode ? el('button', { class: 'btn ghost', type: 'button', title: 'Для чата «Прохождение» с Claude', onclick: () => copy(cpSummary(cp)) }, '⧉ Скопировать результат') : null,
    next && isOpen(next) ? el('button', { class: 'btn', type: 'button', onclick: () => { S.cpId = next.id; render(); scrollTo(0, 0); } }, `Дальше: ${next.title} →`) :
      next ? el('span', { class: 'muted small' }, 'Следующий чекпоинт откроет учитель') : el('span', { class: 'muted small' }, 'Это последний чекпоинт урока')));
}
function stepCard(step, i, cp) {
  const a = ans(step.id);
  const card = el('section', { class: 'step' + (a.done ? ' done' : ''), id: 'step-' + step.id });
  const doneTag = el('span', { class: 'tag ok', hidden: !a.done }, '✓ готово');
  card.append(el('div', { class: 'step-head' },
    el('div', { class: 'stack', style: 'gap:4px' }, el('div', { class: 'n' }, `Шаг ${i + 1} из ${cp.steps.length}`), el('h2', {}, step.title)), doneTag));
  if (step.text) card.append(el('p', { class: 'muted' }, step.text));
  const ctx = {
    step, get value() { return ans(step.id).value; }, get done() { return !!ans(step.id).done; },
    save(value, done, now) { save(step.id, value, done, now); if (done != null) { card.classList.toggle('done', !!done); doneTag.hidden = !done; if (done) beep('done'); } },
  };
  const R = STEPS[step.type];
  card.append(R ? R(ctx) : el('p', { class: 'err' }, 'Неизвестный тип шага: ' + step.type));
  return card;
}

function ownCounter(values) {
  const filled = values.filter(v => valText(v)), own = filled.filter(v => !v.dice && !v.card);
  return el('div', { class: 'counter' }, 'Своими словами: ', el('b', {}, String(own.length)), ` из ${filled.length || 0}`);
}

/* =================== типы шагов =================== */
const STEPS = {};

STEPS.text = ctx => el('div', { class: 'stack' },
  el('div', { class: 'text-html', html: ctx.step.html }),
  el('div', {}, el('button', { class: 'btn', type: 'button', onclick: () => ctx.save({ read: true }, true) }, ctx.done ? 'Прочитано ✓' : 'Понятно')));

// play: ремейк учителя. variants — варианты одной игры кнопками (свои значения ручек), например «классика» и «одно правило».
// Скрытый счётчик _secret и счётчики телеметрии (lab.count) копятся по всем партиям шага: их сравнивает шаг secret.
STEPS.play = ctx => {
  const st = ctx.step;
  if (st.shared) return sharedPlay(ctx);
  let v = Object.assign({ rounds: 0, best: 0, secret: 0, custom: {} }, ctx.value);
  const variants = st.variants || null;
  let vi = variants ? Math.max(0, variants.findIndex(x => x.label === v.variant)) : 0;
  const status = el('b', {});
  const show = () => { status.textContent = `Партий: ${v.rounds} · лучший счёт: ${v.best}` + (st.minRounds && v.rounds < st.minRounds ? ` · нужно партий: ${st.minRounds}` : ''); };
  const host = el('div', { class: 'stack' }), chHost = el('div');
  let h = null;
  function mount() {
    if (h) h.destroy();
    chHost.innerHTML = '';
    h = Games.frame({
      src: () => '/engine/game.html?game=../' + st.game, key: () => 'remake:' + st.id, cfg: Object.assign({}, st.cfg, variants ? variants[vi].cfg : null), label: variants ? 'Играть: ' + variants[vi].label : 'Играть',
      challenge: true,
      onOver: m => {
        chHost.innerHTML = ''; chHost.append(Games.challenge({ step: st.id }, m));
        const custom = Object.assign({}, v.custom);
        for (const [k, n] of Object.entries((m.tele || {}).custom || {})) custom[k] = (custom[k] || 0) + (Number(n) || 0);
        v = Object.assign({}, v, { rounds: v.rounds + 1, best: Math.max(v.best, m.score || 0), secret: v.secret + (Number(((m.tele || {}).custom || {})._secret) || 0), custom });
        if (variants) v.variant = variants[vi].label;
        show(); ctx.save(v, ctx.done || v.rounds >= (st.minRounds || 1));
        S.hooks.forEach(fn => fn('played', { step: st.id })); // шаг predict сравнивает предсказание с телеметрией
      },
    });
    host.innerHTML = '';
    if (variants) {
      const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Вариант игры' });
      variants.forEach((x, k) => seg.append(el('button', { type: 'button', class: 'opt' + (k === vi ? ' on' : ''), 'aria-pressed': String(k === vi), onclick: () => { if (k === vi) return; vi = k; v.variant = x.label; ctx.save(v); beep('tick'); mount(); } },
        el('b', {}, x.label), x.hint ? el('div', { class: 'small muted' }, x.hint) : null)));
      host.append(seg);
    }
    host.append(h.box, Games.bar(h, status), chHost);
  }
  mount(); show();
  return el('div', { class: 'stack' }, host,
    el('div', {}, el('button', { class: 'btn ghost small', type: 'button', onclick: () => ctx.save(v, true) }, 'Готово, дальше')));
};

// teacher-demo: вау-старт учителя. Пока учитель тянет карты и собирает игру — «смотри на проектор» и карты вживую,
// потом игра учителя в рамке (открывает учитель или таймер шага). Рекорды — общая таблица класса по этой игре.
const DEMO_CARD_NAMES = [['hero', 'Герой'], ['place', 'Место'], ['twist', 'Поворот']];
const mmss = sec => { sec = Math.max(0, Math.round(sec)); return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0'); };
STEPS['teacher-demo'] = ctx => {
  const st = ctx.step;
  let v = Object.assign({ rounds: 0, best: 0 }, ctx.value);
  const host = el('div', { class: 'stack' });
  let d = null, skew = 0, tick = null, shownGame = null, h = null;
  const status = el('b', {});
  const showStatus = () => { status.textContent = `Партий: ${v.rounds} · лучший счёт: ${v.best}`; };
  function cards() {
    return el('div', { class: 'demo-cards' }, DEMO_CARD_NAMES.map(([k, label]) => el('div', { class: 'dcard' + (d.cards[k] ? ' on' : '') },
      el('div', { class: 'eyebrow' }, label), el('b', {}, d.cards[k] || '?'))));
  }
  function draw() {
    clearInterval(tick);
    if (h) { h.destroy(); h = null; }
    host.innerHTML = '';
    if (!d) { host.append(el('p', { class: 'muted' }, 'Смотрим, что на проекторе…')); return; }
    const formula = el('div', { class: 'formula' }, el('span', {}, S.lesson.donor), '×', el('span', {}, d.cards.twist ? 'поворот' : 'поворот?'), '×', el('span', {}, d.cards.place ? 'мир' : 'мир?'));
    if (!d.visible || !d.game) {
      shownGame = null;
      const line = el('p', { class: 'muted', 'aria-live': 'polite' });
      const upd = () => {
        const left = d.deadline ? (Date.parse(d.deadline) - Date.now() - skew) / 1000 : null;
        line.textContent = d.state === 'building' ? `ИИ пишет игру при всех… ${mmss((Date.now() + skew - Date.parse(d.buildStartedAt)) / 1000)}` :
          d.state === 'error' ? 'У ИИ не получилось с первого раза — учитель пробует ещё раз.' :
          d.ready ? 'Игра готова! Учитель проверяет её на проекторе.' :
          !d.startedAt ? 'Учитель вот-вот начнёт тянуть карты.' : 'Учитель тянет карты колоды безумных идей.';
        if (left != null && left > 0 && d.state !== 'error') line.textContent += ` Игра откроется у всех через ${mmss(left)}.`;
      };
      upd(); tick = setInterval(upd, 1000);
      host.append(el('div', { class: 'projector-wait' }, el('div', { class: 'big' }, '📽'), el('h3', {}, 'Смотри на проектор'),
        d.title ? el('div', { class: 'eyebrow' }, '«' + d.title + '»') : null, formula, cards(), line));
      return;
    }
    shownGame = d.game.id + ':' + d.game.current;
    const game = d.game;
    h = Games.frame({
      src: () => `/play/${game.id}/${game.current}`, key: () => 'demo:' + game.id, label: 'Играть в игру класса', autostart: false, challenge: true,
      onOver: m => {
        v = { rounds: v.rounds + 1, best: Math.max(v.best, m.score || 0) }; showStatus(); ctx.save(v, ctx.done || v.rounds >= (st.minRounds || 1));
        chHost.innerHTML = ''; chHost.append(Games.challenge({ id: game.id, version: game.current }, m));
      },
      onError: err => h.message(el('div', { class: 'stack', style: 'align-items:center' }, el('b', {}, 'Игра упала: ' + (err.message || 'ошибка')), el('p', { class: 'muted small' }, 'Учитель починит её на проекторе — она обновится сама.'))),
    });
    showStatus();
    const chHost = el('div');
    host.append(el('div', { class: 'donor-card' }, el('div', { class: 'ico' }, '🎲'), el('div', { class: 'stack', style: 'gap:6px' },
      el('div', { class: 'eyebrow' }, 'Игра класса за пять минут'), el('h3', {}, game.title || d.title), formula, cards())),
    h.box, Games.bar(h, status), chHost,
    el('p', { class: 'concept' }, 'Это формула курса: ', el('b', {}, 'Донор × Твист × Мир'), '. Сегодня ты соберёшь по ней свою игру — и решать будешь ты, а не карты.'),
    el('div', {}, el('button', { class: 'btn ghost small', type: 'button', onclick: () => ctx.save(v, true) }, 'Готово, дальше')));
  }
  async function load() {
    try { const r = await api('/api/demo'); skew = Date.parse(r.now) - Date.now(); d = r; } catch (e) { host.innerHTML = ''; host.append(el('p', { class: 'err' }, e.message)); return; }
    draw();
  }
  S.hooks.push((kind, nd) => {
    if (kind !== 'demo') return;
    skew = Date.parse(nd.now) - Date.now();
    const same = d && nd.visible && d.visible && nd.game && shownGame === nd.game.id + ':' + nd.game.current;
    d = nd;
    if (!same) { if (nd.visible && nd.game && !shownGame) { beep('done'); toast('Игра класса открыта — играй!', 'ok'); } draw(); }
  });
  host.append(el('p', { class: 'muted' }, 'Смотрим, что на проекторе…'));
  load();
  return host;
};

// общая игра класса из вау-старта: появляется, когда учитель её раздаст. secretOff — партия с выключенным секретом.
// Скрытый счётчик _secret из телеметрии показывает, сколько раз сработал секрет.
function sharedPlay(ctx) {
  const st = ctx.step;
  const host = el('div', { class: 'stack' });
  let cur = null, shown;
  function draw() {
    const g = S.wow && S.wow.game, key = g ? g.id + '/' + g.version : null;
    if (key && key === shown) return;
    shown = key;
    if (cur) { cur.destroy(); cur = null; }
    host.innerHTML = '';
    if (!g) {
      host.append(el('div', { class: 'locked-msg card' }, el('h3', {}, 'Игра класса ещё собирается'),
        el('p', { style: 'margin-top:6px' }, wowStatusText(S.wow) + ' Как только учитель раздаст игру, она появится здесь сама.')));
      return;
    }
    let v = Object.assign({ rounds: 0, best: 0, secret: 0 }, ctx.value);
    if (v.game && v.game !== key) v = { rounds: 0, best: 0, secret: 0 }; // учитель пересобрал игру — счёт заново
    v.game = key;
    const status = el('b', {});
    const show = () => { status.textContent = `Партий: ${v.rounds} · лучший счёт: ${v.best}` + (st.minRounds && v.rounds < st.minRounds ? ` · нужно партий: ${st.minRounds}` : ''); };
    cur = Games.frame({
      src: () => `/play/${g.id}/${g.version}`, key: () => 'wow:' + g.id, cfg: st.secretOff && g.knob ? { [g.knob]: 0 } : null, label: st.secretOff ? 'Играть без секрета' : 'Играть в игру класса',
      challenge: true,
      onOver: m => {
        const hits = Number(((m.tele || {}).custom || {})._secret) || 0;
        v = Object.assign(v, { rounds: v.rounds + 1, best: Math.max(v.best, m.score || 0), secret: v.secret + hits });
        show(); ctx.save(v, ctx.done || v.rounds >= (st.minRounds || 1));
        chHost.innerHTML = ''; chHost.append(Games.challenge({ id: g.id, version: g.version }, m));
      },
      onError: err => cur.message(el('div', { class: 'stack', style: 'align-items:center' }, el('b', {}, 'Игра класса упала: ' + (err.message || 'ошибка')), el('p', { class: 'muted small' }, 'Скажи учителю — он пересоберёт игру или возьмёт запасную.'))),
    });
    show();
    const chHost = el('div');
    host.append(el('div', { class: 'donor-card' }, el('div', { class: 'ico' }, '🃏'), el('div', {},
      el('div', { class: 'eyebrow' }, st.secretOff ? 'Игра класса · секрет выключен' : 'Игра класса'), el('h3', {}, g.title || 'Игра класса'),
      el('p', { class: 'muted small' }, S.wow.cards.map(c => c.text).filter(Boolean).join(' · ')))),
    cur.box, Games.bar(cur, status), chHost,
    el('div', {}, el('button', { class: 'btn ghost small', type: 'button', onclick: () => { if (!v.rounds) { toast('Сначала сыграй хотя бы одну партию'); return; } ctx.save(v, true); } }, 'Готово, дальше')));
  }
  S.hooks.push(kind => { if (kind === 'wow') draw(); });
  draw();
  return host;
}
// abtest: слепой тест на игре класса — две одинаковые на вид копии «А» и «Б», в одной секрет выключен (ручка knob = 0).
// В какой копии секрет, решает хеш ника и игры: у соседей по-разному, у одного ученика — всегда одинаково.
// По партии в каждую (minRounds), потом голос «где напряжённее». Счёт, время, урон и моменты срабатывания секрета (marks) копятся по копиям.
const hashStr = t => [...String(t)].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
STEPS.abtest = ctx => {
  const st = ctx.step, need = st.minRounds || 1;
  const host = el('div', { class: 'stack' });
  let cur = null, shown, pick = 'A';
  function draw() {
    const g = S.wow && S.wow.game, key = g ? g.id + '/' + g.version : null;
    if (cur) { cur.destroy(); cur = null; }
    host.innerHTML = '';
    if (!g) { host.append(el('div', { class: 'locked-msg card' }, el('h3', {}, 'Игра класса ещё собирается'), el('p', { style: 'margin-top:6px' }, wowStatusText(S.wow)))); return; }
    const blank = () => ({ rounds: 0, best: 0, secret: 0, time: 0, hurts: 0, marks: [] });
    let v = Object.assign({}, ctx.value);
    if (v.game !== key) v = { game: key, side: hashStr(S.me.nick + g.id) % 2 ? 'B' : 'A', A: blank(), B: blank(), vote: null }; // учитель пересобрал игру — тест заново
    shown = key;
    const voted = !!v.vote, ready = v.A.rounds >= need && v.B.rounds >= need;
    const tabs = el('div', { class: 'seg ab-tabs', role: 'tablist' }, ['A', 'B'].map(k => el('button', { type: 'button', role: 'tab', class: 'opt ab-' + k + (pick === k ? ' on' : ''), 'aria-selected': String(pick === k),
      onclick: () => { if (pick !== k) { pick = k; beep('tick'); draw(); } } }, el('b', {}, 'Игра ' + (k === 'A' ? 'А' : 'Б')), el('span', { class: 'small muted' }, ` · партий ${v[k].rounds}` + (v[k].rounds < need ? ` из ${need}` : ' ✓')))));
    const status = el('b', {}, `Игра ${pick === 'A' ? 'А' : 'Б'} · лучший счёт ${v[pick].best}`);
    cur = Games.frame({
      src: () => `/play/${g.id}/${g.version}`, key: () => 'wow:' + g.id, cfg: pick !== v.side && g.knob ? { [g.knob]: 0 } : null, label: 'Играть: игра ' + (pick === 'A' ? 'А' : 'Б'),
      onOver: m => {
        const t = m.tele || {}, x = v[pick];
        x.rounds++; x.best = Math.max(x.best, m.score || 0); x.time += Number(t.time) || 0; x.hurts += Number(t.hurts) || 0;
        x.secret += Number((t.custom || {})._secret) || 0;
        const mk = (t.marks || {})._secret || [];
        if (mk.length) x.marks = { len: Number(t.time) || 0, at: mk.slice(0, 200) }; // моменты секрета последней партии, где он сработал
        ctx.save(v); status.textContent = `Игра ${pick === 'A' ? 'А' : 'Б'} · лучший счёт ${x.best}`;
        tabs.querySelector('.ab-' + pick + ' .small').textContent = ` · партий ${x.rounds}` + (x.rounds < need ? ` из ${need}` : ' ✓');
        if (!ready && v.A.rounds >= need && v.B.rounds >= need) draw();
      },
      onError: err => cur.message(el('b', {}, 'Игра класса упала: ' + (err.message || 'ошибка') + '. Скажи учителю.')),
    });
    const ask = voted ? el('p', { class: 'verdict good' }, `Твой ответ: ${v.vote === 'same' ? 'разницы нет' : 'напряжённее в игре ' + (v.vote === 'A' ? 'А' : 'Б')}. В какой копии был секрет, узнаешь в следующем шаге.`)
      : ready ? el('div', { class: 'stack' }, el('div', { class: 'eyebrow' }, st.question || 'В какой игре было напряжённее?'),
        el('div', { class: 'opts' }, [['A', 'В игре А'], ['B', 'В игре Б'], ['same', 'Разницы нет']].map(([k, label]) => el('button', { type: 'button', class: 'opt', onclick: () => { v.vote = k; beep('good'); ctx.save(v, true, true); draw(); } }, label))))
        : el('p', { class: 'muted' }, `Сыграй хотя бы ${need === 1 ? 'одну партию' : need + ' партии'} в каждую копию — потом появится вопрос.`);
    host.append(tabs, cur.box, Games.bar(cur, status), ask);
  }
  S.hooks.push(kind => { if (kind === 'wow') { const g = S.wow && S.wow.game; if (!g || g.id + '/' + g.version !== shown) draw(); } });
  draw();
  return host;
};
// полоска партии с моментами, когда сработал секрет
function marksBar(m) {
  if (!m || !m.at || !m.len) return null;
  const bar = el('div', { class: 'marks', title: `Секрет срабатывал ${m.at.length} раз за ${Math.round(m.len)} с партии` });
  m.at.forEach(t => bar.append(el('i', { style: `left:${Math.min(100, 100 * t / m.len)}%` })));
  return el('div', { class: 'stack', style: 'gap:4px' }, el('div', { class: 'small muted' }, `Когда срабатывал секрет в одной партии: ${m.at.length} раз за ${Math.round(m.len)} с`), bar,
    el('div', { class: 'row small muted' }, el('span', {}, 'начало'), el('span', { class: 'grow' }), el('span', {}, 'конец партии')));
}
function wowStatusText(W) {
  if (!W) return '';
  const drawn = W.cards.filter(c => c.text).length;
  return { cards: drawn ? (drawn < W.cards.length ? 'Учитель тянет карты.' : 'Карты на столе. Не нравится карта — голосуй «перетянуть».') : 'Ждём, пока учитель вытянет карты.',
    building: '⚙ ИИ собирает игру класса прямо сейчас. Пока ждёшь — сыграй в донор ниже.', preview: 'Игра собрана, учитель её проверяет.', given: '✓ Игра готова — играй в следующем шаге!' }[W.status] || '';
}

// колода безумных идей: карты, которые учитель тянет при классе, появляются у всех сразу; голос «перетянуть»
STEPS.cards = ctx => {
  const host = el('div', { class: 'stack' });
  let prev = {};
  function draw() {
    host.innerHTML = '';
    const W = S.wow;
    let flipped = false;
    if (!W) { host.append(el('p', { class: 'muted' }, 'В этом уроке нет колоды безумных идей.')); return; }
    host.append(el('div', { class: 'formula' }, ...W.formula.split(' × ').flatMap((x, i) => i ? ['×', el('span', {}, x)] : [el('span', {}, x)])));
    const row = el('div', { class: 'wowcards' });
    W.cards.forEach(c => {
      const mine = c.voters.includes(S.me.nick), fresh = c.text && prev[c.id] !== c.text;
      row.append(el('div', { class: 'wowcard' + (c.text ? ' up' : '') + (fresh ? ' flip' : ''), 'data-card': c.id },
        el('div', { class: 'wc-label' }, c.label),
        el('div', { class: 'wc-text' }, Games.cardFace(c.text, c.parts)),
        c.text && W.status === 'cards' ? el('button', { class: 'btn ghost small' + (mine ? ' on' : ''), type: 'button', 'aria-pressed': String(mine), onclick: () => vote(c.id) },
          `🔁 Перетянуть${c.voters.length ? ' · ' + c.voters.length : ''}`) : null));
      if (fresh && prev[c.id] !== undefined) flipped = true;
      prev[c.id] = c.text;
    });
    if (flipped) beep('dice');
    host.append(row, W.link ? Games.linkBox({ link: Object.assign({ accepted: true }, W.link), ready: true, editable: false }) : '',
      el('p', { class: 'wow-status', 'aria-live': 'polite' }, wowStatusText(W)));
    if (W.status === 'given' && !ctx.done) ctx.save({ cards: W.cards.map(c => `${c.label}: ${c.text}`) }, true);
  }
  async function vote(card) {
    try { await api('/api/wow/vote', { card }); beep('tick'); } catch (e) { toast(e.message, 'err'); }
  }
  S.hooks.push(kind => { if (kind === 'wow') draw(); });
  draw();
  return host;
};

// найди секрет: варианты с сервера (настоящий, два чужих из колоды и ловушка с карты), раскрытие только после догадки
const lessonSteps = () => S.lesson.checkpoints.flatMap(c => c.steps);
// hunt в шаге — секрет донора без игры класса: варианты, сравнение и подписи из сценария, ответ и раскрытие — с сервера после догадки
const stepById = id => lessonSteps().find(x => x.id === id);
STEPS.secret = ctx => {
  const host = el('div', { class: 'stack' });
  const H = ctx.step.hunt || null;
  let data = null, pick = null;
  async function load() {
    try { data = await api('/api/wow/hunt?step=' + encodeURIComponent(ctx.step.id)); } catch (e) { host.innerHTML = ''; host.append(el('p', { class: 'err' }, e.message)); return; }
    if (data.answer && !(ctx.value && ctx.value.secret)) S.answers[ctx.step.id] = { value: data.answer, done: true };
    draw();
  }
  function draw() {
    host.innerHTML = '';
    const a = ctx.value && ctx.value.secret ? ctx.value : null;
    if (!data || !data.options.length) { host.append(el('p', { class: 'muted' }, H ? 'Варианты не загрузились — обнови страницу.' : 'Сначала учитель соберёт игру класса в чекпоинте «Вау-старт».')); return; }
    if (!a) {
      const grid = el('div', { class: 'opts', role: 'radiogroup' });
      data.options.forEach(o => grid.append(el('button', { type: 'button', class: 'opt' + (pick === o ? ' on' : ''), 'aria-pressed': String(pick === o), onclick: () => { pick = o; beep('tick'); draw(); } }, o)));
      host.append(el('div', { class: 'eyebrow' }, H ? H.question : 'Что было спрятано в коде игры класса?'), grid,
        el('div', {}, el('button', { class: 'btn', type: 'button', onclick: guess }, H ? 'Ответить' : 'Это секрет!')));
      return;
    }
    const verdict = a.correct ? ['good', H ? '🎯 Точно! Ты назвал секрет донора.' : '🎯 Угадал! Ты почувствовал секрет, не видя его.']
      : a.trap ? ['bad', a.trapText || 'Ловушка! Это было на картах, а значит, не секрет. Проверяй, а не верь: то, что заказал сам, игра не прятала.']
        : ['bad', 'Не угадал: секрет был другим. Зато теперь ты знаешь, что искать.'];
    const C = H && H.compare;
    const ab = !H && lessonSteps().find(x => x.type === 'abtest'), AB = ab && ans(ab.id).value;
    if (AB && AB.A) {
      const sk = AB.side, ok = sk === 'A' ? 'B' : 'A', L = k => (k === 'A' ? 'А' : 'Б');
      const felt = AB.vote === sk ? ['good', `Ты выбрал игру ${L(sk)} — и секрет был именно там. Ты его почувствовал, не видя!`]
        : AB.vote === 'same' ? ['bad', `Ты не заметил разницы, а секрет был в игре ${L(sk)}. Попробуй сыграть ещё раз и сравнить.`]
          : AB.vote ? ['bad', `Ты выбрал игру ${L(ok)}, а секрет был в игре ${L(sk)}. Бывает: напряжение делает не только секрет.`] : null;
      const avg = x => (x.rounds ? Math.round(x.time / x.rounds) : 0);
      const col = (k, withSecret) => el('div', {}, el('div', { class: 'eyebrow' }, `Игра ${L(k)} · ${withSecret ? 'с секретом' : 'без секрета'}`),
        el('b', {}, `лучший счёт ${AB[k].best}`),
        el('div', { class: 'small muted' }, [`партий ${AB[k].rounds}`, `в среднем ${avg(AB[k])} с`, `урона ${AB[k].hurts}`].concat(withSecret ? [`секрет сработал ${AB[k].secret} раз`] : []).join(' · ')));
      host.append(el('p', { class: 'verdict ' + verdict[0] }, verdict[1]), felt ? el('p', { class: 'verdict ' + felt[0] }, felt[1]) : '',
        el('div', { class: 'secret-reveal' },
          el('div', { class: 'eyebrow' }, 'Секрет игры класса'), el('h3', {}, a.secret.title), el('p', {}, a.secret.reveal),
          a.secret.effect ? el('span', { class: 'tag' }, a.secret.effect === 'помощник' ? 'помощник: незаметно помогает игроку' : 'нагнетатель: делает игру напряжённее') : null),
        data.felt && data.felt.voted ? el('p', { class: 'concept' }, `В классе секрет почувствовали вслепую ${data.felt.felt} из ${data.felt.voted}.`) : '',
        el('div', { class: 'compare' }, col(sk, true), col(ok, false)), marksBar(AB[sk].marks) || '',
        el('p', { class: 'concept' }, 'Открой ручки (Tab) в игре класса и покрути ручку «Секрет» от 0 до 1. Как меняется чувство игры?'));
      return;
    }
    const on = C ? stepById(C.on) : lessonSteps().find(x => x.type === 'play' && x.shared && !x.secretOff);
    const off = C ? stepById(C.off) : lessonSteps().find(x => x.type === 'play' && x.shared && x.secretOff);
    const V = step => (step && ans(step.id).value) || {};
    // строка сравнения: лучший счёт, партии и счётчики телеметрии из шага play (compare.show — их имена)
    const line = (step, withSecret) => {
      const x = V(step), cs = (C && C.show) || [];
      return [`партий ${x.rounds || 0}`].concat(cs.map(k => `${k} ${(x.custom || {})[k] || 0}`), withSecret ? [`секрет сработал ${x.secret || 0} раз`] : []).join(' · ');
    };
    host.append(el('p', { class: 'verdict ' + verdict[0] }, verdict[1]),
      el('div', { class: 'secret-reveal' },
        el('div', { class: 'eyebrow' }, H ? 'Секрет донора' : 'Секрет игры класса'), el('h3', {}, a.secret.title),
        el('p', {}, a.secret.reveal),
        a.secret.effect ? el('span', { class: 'tag' }, a.secret.effect === 'помощник' ? 'помощник: незаметно помогает игроку' : a.secret.effect === 'нагнетатель' ? 'нагнетатель: делает игру напряжённее' : a.secret.effect) : null),
      el('div', { class: 'compare' },
        el('div', {}, el('div', { class: 'eyebrow' }, (C && C.onLabel) || 'С секретом'), el('b', {}, `лучший счёт ${V(on).best || 0}`), el('div', { class: 'small muted' }, line(on, true))),
        el('div', {}, el('div', { class: 'eyebrow' }, (C && C.offLabel) || 'Без секрета'), el('b', {}, `лучший счёт ${V(off).best || 0}`), el('div', { class: 'small muted' }, line(off, false)))),
      el('p', { class: 'concept' }, (H && H.after) || 'Открой ручки (Tab) в игре выше и покрути ручку «Секрет» от 0 до 1. Как меняется чувство игры?'));
  }
  async function guess() {
    if (!pick) { toast('Выбери вариант'); return; }
    try { const r = await api('/api/wow/guess', { guess: pick, step: ctx.step.id }); ctx.save(r, true, true); beep(r.correct ? 'good' : 'bad'); draw(); } catch (e) { toast(e.message, 'err'); }
  }
  S.hooks.push(kind => { if (kind === 'wow' && (!data || !data.options.length)) load(); });
  host.append(el('p', { class: 'muted' }, 'Загружаем…'));
  load();
  return host;
};

// recall — id прошлого шага choice: его ответ показывается над вопросом («Ты предсказал: …» → «Совпало?»)
const choiceText = id => { const x = ans(id).value || {}; return [(x.selected || []).join('; '), valText(x.own)].filter(Boolean).join(' · '); };
STEPS.choice = ctx => {
  const st = ctx.step;
  let v = Object.assign({ selected: [], own: { text: '' } }, ctx.value);
  const wrap = el('div', { class: 'stack' });
  if (st.recall) {
    const was = choiceText(st.recall), rs = stepById(st.recall);
    wrap.append(el('div', { class: 'recall' }, el('b', {}, (rs ? rs.title : 'Твой ответ') + ' — ты ответил: '), was || 'ответа нет'));
  }
  if (st.options && st.options.length) {
    const grid = el('div', { class: 'opts', role: st.multi ? 'group' : 'radiogroup' });
    st.options.forEach(o => {
      const b = el('button', { type: 'button', class: 'opt' + (v.selected.includes(o) ? ' on' : ''), 'aria-pressed': String(v.selected.includes(o)) }, o);
      b.addEventListener('click', () => {
        if (st.multi) {
          if (v.selected.includes(o)) v.selected = v.selected.filter(x => x !== o);
          else { if (st.max && v.selected.length >= st.max) { toast(`Можно выбрать не больше ${st.max}`); return; } v.selected = v.selected.concat(o); }
        } else v.selected = v.selected[0] === o ? [] : [o];
        grid.querySelectorAll('.opt').forEach(x => { const on = v.selected.includes(x.textContent); x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
        beep('tick'); ctx.save(v);
      });
      grid.append(b);
    });
    wrap.append(grid);
  }
  if (st.own) wrap.append(fieldEditor({ id: st.id, label: st.ownLabel || (st.options && st.options.length ? 'Или своими словами' : 'Твой ответ'), deck: st.deck }, v.own, nv => { v.own = nv; ctx.save(v); }));
  wrap.append(el('div', {}, el('button', { class: 'btn', type: 'button', onclick: () => {
    if (!v.selected.length && !valText(v.own)) { toast('Выбери карточку или напиши ответ'); return; }
    ctx.save(v, true);
  } }, 'Ответить')));
  return wrap;
};

// карточки квиза из игры класса: {hero} {action} {place} {threat} {twist} — карты, {heroName} {heroTrait} — имя и особенность карты «имя — особенность»,
// {secret} — секрет после шага «Найди секрет»
function wowItems(st) {
  if (!st.wowItems || !S.wow) return [];
  const vars = {};
  S.wow.cards.forEach(c => {
    if (!c.text) return;
    const [name, trait] = Games.cardParts(c.text);
    vars[c.id] = c.text; vars[c.id + 'Name'] = name;
    if (trait) vars[c.id + 'Trait'] = trait;
  });
  const hunt = lessonSteps().find(x => x.type === 'secret'), sec = hunt && (ans(hunt.id).value || {}).secret;
  if (sec) vars.secret = sec.title;
  return st.wowItems.filter(it => [...it.text.matchAll(/\{(\w+)\}/g)].every(m => vars[m[1]]))
    .map(it => Object.assign({}, it, { text: it.text.replace(/\{(\w+)\}/g, (_, k) => vars[k]) }));
}
STEPS.sort = ctx => {
  const st = ctx.step;
  let ITEMS = st.items.concat(wowItems(st));
  const box = el('div', { class: 'sorter', tabindex: '0', 'aria-label': 'Квиз-сортировщик' });
  let order = [], i = 0, score = 0, streak = 0, bestStreak = 0, correct = 0, mistakes = [], picks = [], left = 0, raf = 0, locked = false, active = false, padPrev = [];
  const hud = el('div', { class: 'hud' }), timer = el('div', { class: 'timer' }, el('i')), item = el('div', { class: 'item' }), why = el('div', { class: 'why', 'aria-live': 'polite' });
  // до 3 лотков — клавиши 1 2 3 или ← ↓ →; больше (до 8) — цифры, или стрелками выбрать лоток и пробел; у лотка — пример, после ошибки — подсказка
  const many = st.bins.length > 3;
  let sel = 0;
  const bins = el('div', { class: 'bins' + (many ? ' many' : '') });
  const keysHint = many ? st.bins.map((b, k) => String(k + 1)) : ['1 · ←', '2 · ↓', '3 · →'];
  const binBtns = st.bins.map((b, k) => { const btn = el('button', { type: 'button', class: 'bin', onclick: () => answer(k) }, b.label, b.example ? el('small', {}, b.example) : null, el('kbd', {}, keysHint[k])); bins.append(btn); return btn; });
  const select = k => { sel = (k + st.bins.length) % st.bins.length; binBtns.forEach((x, n) => x.classList.toggle('sel', n === sel)); };
  function intro() {
    active = false; cancelAnimationFrame(raf);
    ITEMS = st.items.concat(wowItems(st));
    box.innerHTML = '';
    const prev = ctx.value;
    box.append(el('div', { class: 'stack', style: 'align-items:center;text-align:center;margin:auto' },
      el('h3', {}, `${ITEMS.length} решений · ${st.seconds} секунд на каждое`),
      el('p', { class: 'muted' }, many ? `Серия правильных ответов умножает очки. Клавиши 1–${st.bins.length} или стрелки и пробел, на геймпаде — крестовина и A.` : 'Серия правильных ответов умножает очки. Геймпад: крестовина ◀ ▼ ▶.'),
      prev ? el('p', {}, `Твой результат: ${prev.correct} из ${prev.total}, очки ${prev.score}`) : null,
      el('button', { class: 'btn', type: 'button', onclick: begin }, prev ? 'Сыграть ещё раз' : '▶ Начать')));
  }
  function begin() {
    ITEMS = st.items.concat(wowItems(st));
    order = ITEMS.map((x, k) => k).sort(() => Math.random() - 0.5);
    i = 0; score = 0; streak = 0; bestStreak = 0; correct = 0; mistakes = []; picks = [];
    box.innerHTML = ''; box.append(hud, timer, item, why, bins); box.focus();
    if (many) select(0);
    active = true; next();
    let last = performance.now();
    const loop = t => {
      if (!active) return;
      const dt = (t - last) / 1000; last = t;
      if (!locked) { left -= dt; if (left <= 0) answer(-1); }
      timer.firstChild.style.width = Math.max(0, 100 * left / st.seconds) + '%';
      pollPad();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }
  function pollPad() {
    let pads = []; try { pads = [...navigator.getGamepads()].filter(Boolean); } catch (e) { return; }
    const gp = pads[0]; if (!gp) return;
    const b = gp.buttons.map(x => x && x.pressed);
    if (many) { // крестовина выбирает лоток, A кладёт карточку
      [[14, -1], [15, 1], [12, -4], [13, 4]].forEach(([btn, d], k) => { if (b[btn] && !padPrev[k]) select(sel + d); padPrev[k] = b[btn]; });
      if (b[0] && !padPrev[4]) answer(sel);
      padPrev[4] = b[0];
      return;
    }
    const map = [[14, 2], [13, 0], [15, 1]];
    map.forEach(([btn, alt], k) => { const on = b[btn] || b[alt]; if (on && !padPrev[k]) answer(k); padPrev[k] = on; });
  }
  function next() {
    if (i >= order.length) return finish();
    const it = ITEMS[order[i]];
    item.className = 'item'; item.textContent = it.text; why.textContent = '';
    left = st.seconds; locked = false;
    hud.innerHTML = ''; hud.append(el('span', {}, `${i + 1} / ${order.length}`), el('span', {}, streak > 1 ? `серия ×${streak}` : ''), el('span', {}, `очки ${score}`));
  }
  function answer(k) {
    if (!active || locked) return;
    locked = true;
    const it = ITEMS[order[i]], right = st.bins.findIndex(b => b.id === it.bin);
    const ok = k === right;
    picks.push({ text: it.text, right: st.bins[right].label, chose: k >= 0 ? st.bins[k].label : 'время вышло', ok, sec: Math.round((st.seconds - left) * 10) / 10 });
    if (ok) { streak++; bestStreak = Math.max(bestStreak, streak); correct++; score += 100 * Math.min(streak, 5) + Math.round(left * 10); beep('good'); }
    else { streak = 0; mistakes.push(`${it.text} → ${st.bins[right].label}`); beep('bad'); }
    item.classList.add(ok ? 'good' : 'bad');
    const btn = binBtns[k >= 0 ? k : right];
    btn.classList.add(ok ? 'flash-good' : 'flash-bad');
    if (!ok) binBtns[right].classList.add('flash-good');
    const hint = !ok && st.bins[right].hint ? ' Подсказка: ' + st.bins[right].hint : '';
    why.textContent = (ok ? 'Верно! ' : k < 0 ? 'Время вышло. ' : `Это ${st.bins[right].label.toLowerCase()}. `) + it.why + hint;
    setTimeout(() => { binBtns.forEach(b => b.classList.remove('flash-good', 'flash-bad')); i++; next(); }, ok ? 900 : hint ? 3200 : 2200);
  }
  function finish() {
    active = false; cancelAnimationFrame(raf);
    const v = { score, correct, total: order.length, bestStreak, mistakes, picks, tries: ((ctx.value || {}).tries || 0) + 1 };
    ctx.save(v, true);
    box.innerHTML = '';
    box.append(el('div', { class: 'stack', style: 'align-items:center;text-align:center;margin:auto' },
      el('div', { class: 'eyebrow' }, 'Итог'), el('h2', {}, `${correct} из ${order.length} · ${score} очков`),
      el('p', { class: 'muted' }, `Лучшая серия: ${bestStreak}`),
      mistakes.length ? el('div', { class: 'small', style: 'text-align:left' }, el('b', {}, 'Ошибки:'), el('ul', {}, mistakes.map(m => el('li', {}, m)))) : el('p', {}, 'Без ошибок!'),
      el('div', { class: 'row', style: 'justify-content:center' },
        el('button', { class: 'btn', type: 'button', onclick: begin }, 'Ещё раз'),
        el('p', { class: 'muted small' }, '✓ Результат отправлен учителю'))));
  }
  box.addEventListener('keydown', e => {
    if (!active) return;
    if (many) {
      const d = /^(Digit|Numpad)([1-8])$/.exec(e.code);
      if (d && Number(d[2]) <= st.bins.length) { e.preventDefault(); answer(Number(d[2]) - 1); return; }
      const mv = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -4, ArrowDown: 4 }[e.code];
      if (mv) { e.preventDefault(); select(sel + mv); return; }
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); answer(sel); }
      return;
    }
    const k = { Digit1: 0, Numpad1: 0, ArrowLeft: 0, Digit2: 1, Numpad2: 1, ArrowDown: 1, Digit3: 2, Numpad3: 2, ArrowRight: 2 }[e.code];
    if (k != null) { e.preventDefault(); answer(k); }
  });
  intro();
  return box;
};

// rounds: квиз-раунды «Игра или не игра?» — карточка и два ответа ◀ ▶ (клавиши ← → и A D, геймпад, тап, свайп),
// таймер, серия, звук, разбор после каждой карты (дальше — пробел, Enter или кнопка A); итог с ответами по карточкам сам уходит учителю.
STEPS.rounds = ctx => {
  const st = ctx.step;
  const L = st.left || { label: 'Игра' }, R = st.right || { label: 'Не игра' };
  const box = el('div', { class: 'rounds', tabindex: '0', 'aria-label': 'Квиз-раунды' });
  let order = [], i = 0, score = 0, streak = 0, bestStreak = 0, correct = 0, mistakes = [], picks = [], left = 0, raf = 0, phase = 'intro', padPrev = {}, answeredAt = 0;
  const hud = el('div', { class: 'hud' }), timer = el('div', { class: 'timer' }, el('i')), card = el('div', { class: 'rcard' }), why = el('div', { class: 'why', 'aria-live': 'polite' });
  const btnL = el('button', { type: 'button', class: 'rbtn left', onclick: () => press('left') }, el('span', { class: 'arr' }, '◀'), el('b', {}, L.label), el('kbd', {}, '← или A'));
  const btnR = el('button', { type: 'button', class: 'rbtn right', onclick: () => press('right') }, el('b', {}, R.label), el('span', { class: 'arr' }, '▶'), el('kbd', {}, '→ или D'));
  const nextBtn = el('button', { type: 'button', class: 'btn', hidden: true, onclick: () => press('next') }, 'Дальше ▶');
  const answers = el('div', { class: 'rbtns' }, btnL, btnR);
  function intro() {
    phase = 'intro'; cancelAnimationFrame(raf);
    box.innerHTML = '';
    const prev = ctx.value;
    box.append(el('div', { class: 'stack', style: 'align-items:center;text-align:center;margin:auto' },
      el('div', { class: 'rvs' }, el('span', {}, '◀ ' + L.label), el('i', {}, 'или'), el('span', {}, R.label + ' ▶')),
      el('h3', {}, `${st.items.length} карточек · ${st.seconds} секунд на каждую`),
      el('p', { class: 'muted' }, 'Серия правильных ответов умножает очки. После каждой карточки — разбор. Геймпад: крестовина или стик ◀ ▶, A — дальше. На телефоне можно смахнуть карточку.'),
      prev && prev.total ? el('p', {}, `Твой результат: ${prev.correct} из ${prev.total}, очки ${prev.score}`) : null,
      el('button', { class: 'btn', type: 'button', onclick: begin }, prev && prev.total ? 'Сыграть ещё раз' : '▶ Начать')));
  }
  function begin() {
    order = st.items.map((x, k) => k).sort(() => Math.random() - 0.5);
    i = 0; score = 0; streak = 0; bestStreak = 0; correct = 0; mistakes = []; picks = [];
    box.innerHTML = ''; box.append(hud, timer, card, why, answers, el('div', { class: 'row', style: 'justify-content:center' }, nextBtn)); box.focus();
    show();
    let last = performance.now();
    const loop = t => {
      if (phase === 'intro' || phase === 'end') return;
      const dt = (t - last) / 1000; last = t;
      if (phase === 'ask') { left -= dt; if (left <= 0) answer(null); }
      timer.firstChild.style.width = Math.max(0, 100 * left / st.seconds) + '%';
      pollPad();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }
  function show() {
    if (i >= order.length) return finish();
    const it = st.items[order[i]];
    phase = 'ask'; left = st.seconds;
    card.className = 'rcard'; card.style.transform = ''; card.textContent = it.text; why.textContent = '';
    nextBtn.hidden = true; answers.classList.remove('locked'); box.focus({ preventScroll: true });
    hud.innerHTML = ''; hud.append(el('span', {}, `${i + 1} / ${order.length}`), el('span', { class: 'streak' }, streak > 1 ? `серия ×${streak}` : ''), el('span', {}, `очки ${score}`));
  }
  function answer(side) {
    if (phase !== 'ask') return;
    phase = 'why'; answeredAt = performance.now();
    const it = st.items[order[i]], ok = side === it.side;
    const lab = x => x === 'left' ? L.label : x === 'right' ? R.label : 'время вышло';
    picks.push({ text: it.text, right: lab(it.side), chose: lab(side), ok, sec: Math.round((st.seconds - left) * 10) / 10 });
    if (ok) { streak++; bestStreak = Math.max(bestStreak, streak); correct++; score += 100 * Math.min(streak, 5) + Math.round(Math.max(0, left) * 10); beep('good'); }
    else { streak = 0; mistakes.push(`${it.text} → ${(it.side === 'left' ? L : R).label}`); beep('bad'); }
    card.classList.add(ok ? 'good' : 'bad', side === 'left' ? 'out-left' : side === 'right' ? 'out-right' : 'out-none');
    answers.classList.add('locked'); box.focus({ preventScroll: true }); // фокус с кнопки ответа — чтобы пробел «Дальше» не нажал её ещё раз
    why.innerHTML = '';
    why.append(el('b', {}, ok ? 'Верно! ' : side == null ? 'Время вышло. ' : `Это «${(it.side === 'left' ? L : R).label.toLowerCase()}». `), it.why || '');
    hud.querySelector('.streak').textContent = streak > 1 ? `серия ×${streak}` : '';
    hud.lastChild.textContent = `очки ${score}`;
    nextBtn.hidden = false; nextBtn.textContent = i + 1 >= order.length ? 'Итог ▶' : 'Дальше ▶';
  }
  function press(what) {
    if (phase === 'ask' && (what === 'left' || what === 'right')) answer(what);
    else if (phase === 'why' && what === 'next') { i++; show(); } // стрелки разбор не пролистывают: его надо успеть прочитать
  }
  function pollPad() {
    let pads = []; try { pads = [...navigator.getGamepads()].filter(Boolean); } catch (e) { return; }
    const gp = pads[0]; if (!gp) return;
    const b = k => !!(gp.buttons[k] && gp.buttons[k].pressed), ax = gp.axes[0] || 0;
    const now = { left: b(14) || b(4) || ax < -0.6, right: b(15) || b(5) || ax > 0.6, next: b(0) };
    for (const k of Object.keys(now)) { if (now[k] && !padPrev[k]) press(k); padPrev[k] = now[k]; }
  }
  // свайп карточки: потянул влево или вправо дальше 80 пикселей — ответ
  let drag = null;
  card.addEventListener('pointerdown', e => { if (phase !== 'ask') return; drag = { x: e.clientX }; card.setPointerCapture(e.pointerId); });
  card.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x; card.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`; });
  const drop = e => { if (!drag) return; const dx = e.clientX - drag.x; drag = null; card.style.transform = ''; if (Math.abs(dx) > 80) answer(dx < 0 ? 'left' : 'right'); };
  card.addEventListener('click', () => { if (phase === 'why' && performance.now() - answeredAt > 400) press('next'); }); // не тот же клик, что ответил свайпом
  card.addEventListener('pointerup', drop); card.addEventListener('pointercancel', () => { drag = null; card.style.transform = ''; });
  function finish() {
    phase = 'end'; cancelAnimationFrame(raf);
    const v = { score, correct, total: order.length, bestStreak, mistakes, picks, tries: ((ctx.value || {}).tries || 0) + 1 };
    ctx.save(v, true);
    box.innerHTML = '';
    const result = `Квиз «${st.title}»: ${correct} из ${order.length}, ${score} очков, серия ${bestStreak}.` + (mistakes.length ? ' Ошибки: ' + mistakes.join('; ') : '');
    box.append(el('div', { class: 'stack', style: 'align-items:center;text-align:center;margin:auto' },
      el('div', { class: 'eyebrow' }, 'Итог'), el('h2', {}, `${correct} из ${order.length} · ${score} очков`),
      el('p', { class: 'muted' }, `Лучшая серия: ${bestStreak}`),
      mistakes.length ? el('div', { class: 'small', style: 'text-align:left' }, el('b', {}, 'Ошибки:'), el('ul', {}, mistakes.map(m => el('li', {}, m)))) : el('p', {}, 'Без ошибок!'),
      el('div', { class: 'row', style: 'justify-content:center' },
        el('button', { class: 'btn', type: 'button', onclick: begin }, 'Ещё раз'),
        el('p', { class: 'muted small' }, '✓ Результат отправлен учителю'), S.me.class.authorMode ? el('button', { class: 'btn ghost small', type: 'button', onclick: () => copy(result) }, '⧉ Скопировать') : null)));
  }
  box.addEventListener('keydown', e => {
    if (phase === 'intro' || phase === 'end') return;
    const k = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'next', Enter: 'next', NumpadEnter: 'next' }[e.code];
    if (k) { e.preventDefault(); press(k); }
  });
  intro();
  return box;
};

// trace: квиз «Угадай охотника по следу». В маленьком лабиринте бегает герой, охотник идёт по одному правилу и оставляет след.
// Ученик называет правило: цифры, стрелки и пробел, крестовина и A, тап. Таймер, серия, звук; после ответа видна цель охотника.
// Правила встроены в шаг (rules[].id): chase — гонится, ambush — наперерез, flank — по напарнику, shy — пугается вблизи,
// scatter — уходит в свой угол, random — бродит наугад. Подписи и разбор — из сценария.
const TRACE_MAZE = [
  '#################',
  '#.......#.......#',
  '#.##.##.#.##.##.#',
  '#...............#',
  '#.##.#.###.#.##.#',
  '#....#..#..#....#',
  '####.##.#.##.####',
  '#...............#',
  '#.##.###.###.##.#',
  '#...............#',
  '###.#.#####.#.###',
  '#.....#...#.....#',
  '#.###.#.#.#.###.#',
  '#...............#',
  '#################',
];
STEPS.trace = ctx => {
  const st = ctx.step, R = st.rules, M = st.maze || TRACE_MAZE, W = M[0].length, H = M.length;
  const DIRS = [[0, -1], [-1, 0], [0, 1], [1, 0]];
  const open = (x, y) => y >= 0 && y < H && x >= 0 && x < W && M[y][x] !== '#';
  const box = el('div', { class: 'sorter trace', tabindex: '0', 'aria-label': 'Квиз: угадай охотника по следу' });
  const cv = el('canvas', { width: W * 26, height: H * 26, 'aria-label': 'Лабиринт со следом охотника' });
  const hud = el('div', { class: 'hud' }), timer = el('div', { class: 'timer' }, el('i')), why = el('div', { class: 'why', 'aria-live': 'polite' });
  const bins = el('div', { class: 'bins' + (R.length > 3 ? ' many' : '') });
  let sel = 0, order = [], i = 0, score = 0, streak = 0, bestStreak = 0, correct = 0, mistakes = [], left = 0, raf = 0, phase = 'intro', padPrev = [], sim = null;
  const btns = R.map((r, k) => { const b = el('button', { type: 'button', class: 'bin', onclick: () => answer(k) }, r.label, el('kbd', {}, String(k + 1))); bins.append(b); return b; });
  const select = k => { sel = (k + R.length) % R.length; btns.forEach((b, n) => b.classList.toggle('sel', n === sel)); };
  // мир раунда: герой бродит, охотник выбирает на каждом перекрёстке клетку ближе к своей цели
  function newSim(rule) {
    const free = []; M.forEach((row, y) => row.split('').forEach((c, x) => { if (c !== '#') free.push([x, y]); }));
    const far = (from, list) => list.filter(p => Math.abs(p[0] - from[0]) + Math.abs(p[1] - from[1]) > 9);
    const hero = { p: free[Math.floor(Math.random() * free.length)], d: [1, 0] };
    const pick = list => list[Math.floor(Math.random() * list.length)];
    const s = { rule, hero, hunter: { p: pick(far(hero.p, free)), d: [0, 1] }, mate: rule === 'flank' ? { p: pick(far(hero.p, free)), d: [0, -1] } : null, trail: [], t: 0, caught: 0, corner: [W - 2, 1] };
    return s;
  }
  function target(s) {
    const h = s.hero.p, hd = s.hero.d, hu = s.hunter.p;
    switch (s.rule) {
      case 'ambush': return [h[0] + hd[0] * 4, h[1] + hd[1] * 4];
      case 'flank': { const m = s.mate.p, px = h[0] + hd[0] * 2, py = h[1] + hd[1] * 2; return [px * 2 - m[0], py * 2 - m[1]]; }
      case 'shy': return Math.abs(hu[0] - h[0]) + Math.abs(hu[1] - h[1]) < 6 ? [1, H - 2] : h;
      case 'scatter': return s.corner;
      case 'random': return null;
      default: return h;
    }
  }
  function stepActor(a, tgt) {
    let opts = DIRS.filter(d => open(a.p[0] + d[0], a.p[1] + d[1]) && !(d[0] === -a.d[0] && d[1] === -a.d[1]));
    if (!opts.length) opts = [[-a.d[0], -a.d[1]]];
    let d = opts[Math.floor(Math.random() * opts.length)];
    if (tgt) { let bd = 1e9; for (const o of opts) { const n = (a.p[0] + o[0] - tgt[0]) ** 2 + (a.p[1] + o[1] - tgt[1]) ** 2; if (n < bd) { bd = n; d = o; } } }
    else if (a.wander && opts.some(o => o[0] === a.d[0] && o[1] === a.d[1]) && Math.random() < 0.6) d = a.d; // герой чаще бежит прямо
    a.d = d; a.p = [a.p[0] + d[0], a.p[1] + d[1]];
  }
  function tick(s, dt) {
    s.t += dt; s.ht = (s.ht || 0) + dt; s.ut = (s.ut || 0) + dt;
    s.hero.wander = true;
    if (s.ht > 0.17) { s.ht = 0; stepActor(s.hero, null); if (s.mate) stepActor(s.mate, s.hero.p); }
    if (s.ut > 0.2) {
      s.ut = 0; stepActor(s.hunter, target(s));
      s.trail.push(s.hunter.p.slice()); if (s.trail.length > 18) s.trail.shift();
    }
    if (s.hunter.p[0] === s.hero.p[0] && s.hunter.p[1] === s.hero.p[1]) { // поймал — герой убегает в дальний угол
      s.caught++; s.hero.p = [s.hero.p[0] < W / 2 ? W - 2 : 1, s.hero.p[1] < H / 2 ? H - 2 : 1]; beep('tick');
    }
  }
  function draw(s, reveal) {
    const g = cv.getContext('2d'), c = cv.width / W;
    g.fillStyle = '#121a33'; g.fillRect(0, 0, cv.width, cv.height);
    M.forEach((row, y) => row.split('').forEach((ch, x) => { if (ch === '#') { g.fillStyle = '#3b4a78'; g.fillRect(x * c + 2, y * c + 2, c - 4, c - 4); } }));
    const dot = (p, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(p[0] * c + c / 2, p[1] * c + c / 2, r, 0, Math.PI * 2); g.fill(); };
    s.trail.forEach((p, k) => { g.globalAlpha = 0.15 + 0.6 * k / s.trail.length; dot(p, c * 0.18, '#ff8a3d'); });
    g.globalAlpha = 1;
    if (s.mate) { dot(s.mate.p, c * 0.32, '#e0483c'); g.fillStyle = '#fff'; g.font = `${Math.round(c * 0.42)}px sans-serif`; g.fillText('напарник', s.mate.p[0] * c - c * 0.6, s.mate.p[1] * c - 2); }
    dot(s.hero.p, c * 0.38, '#ffd23f');
    dot(s.hunter.p, c * 0.4, '#ff8a3d');
    const t = reveal && target(s);
    if (t) { // после ответа: куда целился охотник
      const tx = t[0] * c + c / 2, ty = t[1] * c + c / 2;
      g.strokeStyle = '#ff8a3d'; g.lineWidth = 3; g.setLineDash([6, 5]); g.beginPath(); g.moveTo(s.hunter.p[0] * c + c / 2, s.hunter.p[1] * c + c / 2); g.lineTo(tx, ty); g.stroke(); g.setLineDash([]);
      g.beginPath(); g.moveTo(tx - 8, ty - 8); g.lineTo(tx + 8, ty + 8); g.moveTo(tx + 8, ty - 8); g.lineTo(tx - 8, ty + 8); g.stroke();
    }
  }
  function intro() {
    phase = 'intro'; cancelAnimationFrame(raf);
    box.innerHTML = '';
    const prev = ctx.value;
    box.append(el('div', { class: 'stack', style: 'align-items:center;text-align:center;margin:auto' },
      el('h3', {}, `${st.rounds || 8} охотников · ${st.seconds} секунд на каждого`),
      el('p', { class: 'muted' }, `Жёлтый — герой, оранжевый — охотник и его след. Назови правило охотника: клавиши 1–${R.length} или стрелки и пробел, на геймпаде — крестовина и A.`),
      prev && prev.total ? el('p', {}, `Твой результат: ${prev.correct} из ${prev.total}, очки ${prev.score}`) : null,
      el('button', { class: 'btn', type: 'button', onclick: begin }, prev && prev.total ? 'Сыграть ещё раз' : '▶ Начать')));
  }
  function begin() {
    const n = st.rounds || 8, ids = R.map(r => r.id);
    order = [];
    while (order.length < n) order = order.concat(ids.slice().sort(() => Math.random() - 0.5)); // каждое правило встретится
    order = order.slice(0, n);
    i = 0; score = 0; streak = 0; bestStreak = 0; correct = 0; mistakes = [];
    box.innerHTML = ''; box.append(hud, timer, cv, why, bins); box.focus();
    select(0); show();
    let last = performance.now();
    const loop = t => {
      if (!box.isConnected || phase === 'intro' || phase === 'end') return;
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      tick(sim, dt);
      if (phase === 'ask') { left -= dt; if (left <= 0) answer(-1); }
      timer.firstChild.style.width = Math.max(0, 100 * left / st.seconds) + '%';
      draw(sim, phase === 'why');
      pollPad();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }
  function show() {
    if (i >= order.length) return finish();
    sim = newSim(order[i]);
    for (let k = 0; k < 15; k++) tick(sim, 0.2); // след уже виден с первой секунды
    phase = 'ask'; left = st.seconds; why.textContent = '';
    btns.forEach(b => b.classList.remove('flash-good', 'flash-bad')); select(sel);
    hud.innerHTML = ''; hud.append(el('span', {}, `${i + 1} / ${order.length}`), el('span', {}, streak > 1 ? `серия ×${streak}` : ''), el('span', {}, `очки ${score}`));
  }
  function answer(k) {
    if (phase !== 'ask') return;
    phase = 'why';
    const right = R.findIndex(r => r.id === sim.rule), ok = k === right;
    if (ok) { streak++; bestStreak = Math.max(bestStreak, streak); correct++; score += 100 * Math.min(streak, 5) + Math.round(left * 10); beep('good'); }
    else { streak = 0; mistakes.push(`${R[right].label}${k >= 0 ? ' (ответ: ' + R[k].label + ')' : ''}`); beep('bad'); }
    btns.forEach(b => b.classList.remove('sel'));
    if (k >= 0) btns[k].classList.add(ok ? 'flash-good' : 'flash-bad');
    if (!ok) btns[right].classList.add('flash-good');
    why.innerHTML = ''; why.append(el('b', {}, ok ? 'Верно! ' : k < 0 ? `Время вышло. Это «${R[right].label}». ` : `Это «${R[right].label}». `), R[right].why || '', target(sim) ? ' Пунктир — куда он целился.' : '');
    setTimeout(() => { if (phase === 'why') { i++; show(); } }, ok ? 1800 : 3600);
  }
  function finish() {
    phase = 'end'; cancelAnimationFrame(raf);
    const v = { score, correct, total: order.length, bestStreak, mistakes };
    ctx.save(v, true);
    box.innerHTML = '';
    const result = `Квиз «${st.title}»: ${correct} из ${order.length}, ${score} очков, серия ${bestStreak}.` + (mistakes.length ? ' Ошибки: ' + mistakes.join('; ') : '');
    box.append(el('div', { class: 'stack', style: 'align-items:center;text-align:center;margin:auto' },
      el('div', { class: 'eyebrow' }, 'Итог'), el('h2', {}, `${correct} из ${order.length} · ${score} очков`),
      el('p', { class: 'muted' }, `Лучшая серия: ${bestStreak}`),
      mistakes.length ? el('div', { class: 'small', style: 'text-align:left' }, el('b', {}, 'Ошибки:'), el('ul', {}, mistakes.map(m => el('li', {}, m)))) : el('p', {}, 'Без ошибок!'),
      el('div', { class: 'row', style: 'justify-content:center' },
        el('button', { class: 'btn', type: 'button', onclick: begin }, 'Ещё раз'),
        el('button', { class: 'btn ghost', type: 'button', onclick: () => copy(result) }, '⧉ Скопировать результат'))));
  }
  function pollPad() {
    let pads = []; try { pads = [...navigator.getGamepads()].filter(Boolean); } catch (e) { return; }
    const gp = pads[0]; if (!gp) return;
    const b = gp.buttons.map(x => x && x.pressed);
    [[14, -1], [15, 1], [12, -4], [13, 4]].forEach(([btn, d], k) => { if (b[btn] && !padPrev[k]) select(sel + d); padPrev[k] = b[btn]; });
    if (b[0] && !padPrev[4]) answer(sel);
    padPrev[4] = b[0];
  }
  box.addEventListener('keydown', e => {
    if (phase !== 'ask') return;
    const d = /^(Digit|Numpad)([1-8])$/.exec(e.code);
    if (d && Number(d[2]) <= R.length) { e.preventDefault(); answer(Number(d[2]) - 1); return; }
    const mv = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -4, ArrowDown: 4 }[e.code];
    if (mv) { e.preventDefault(); select(sel + mv); return; }
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); answer(sel); }
  });
  intro();
  return box;
};

// predict: предсказание динамики. Ученик выбирает, что будет происходить в игре, потом играет в шаге play,
// и шаг сравнивает предсказание со счётчиками телеметрии этого шага (в среднем за партию). miss — начало фразы, если не сбылось.
STEPS.predict = ctx => {
  const st = ctx.step, max = st.max || 2;
  let v = Object.assign({ picked: [], locked: false }, ctx.value);
  const host = el('div', { class: 'stack predict' });
  function draw() {
    host.innerHTML = '';
    if (!v.locked) {
      const grid = el('div', { class: 'opts', role: 'group' });
      st.options.forEach(o => grid.append(el('button', { type: 'button', class: 'opt' + (v.picked.includes(o.counter) ? ' on' : ''), 'aria-pressed': String(v.picked.includes(o.counter)), onclick: () => {
        if (v.picked.includes(o.counter)) v.picked = v.picked.filter(x => x !== o.counter);
        else { if (v.picked.length >= max) { toast(`Можно выбрать не больше ${max}`); return; } v.picked = v.picked.concat(o.counter); }
        beep('tick'); ctx.save(v); draw();
      } }, o.text)));
      host.append(el('div', { class: 'eyebrow' }, st.question || 'Что будет происходить в игре?'), grid,
        el('div', {}, el('button', { class: 'btn', type: 'button', onclick: () => { if (!v.picked.length) { toast('Выбери хотя бы одно предсказание'); return; } v.locked = true; ctx.save(v, null, true); beep('done'); draw(); } }, '🔮 Записать предсказание')));
      return;
    }
    const mine = st.options.filter(o => v.picked.includes(o.counter)).map(o => o.text);
    host.append(el('p', {}, el('b', {}, '🔮 Твоё предсказание: '), mine.join('; ')));
    const play = ans(st.play).value || {};
    if (!play.rounds) { host.append(el('p', { class: 'muted' }, 'Теперь сыграй в шаге ниже. Телеметрия посчитает, что происходило на самом деле.')); return; }
    const per = o => Math.round(10 * ((play.custom || {})[o.counter] || 0) / play.rounds) / 10;
    const vals = st.options.map(per), top = Math.max(...vals);
    const hit = top > 0 && st.options.some((o, k) => vals[k] === top && v.picked.includes(o.counter));
    const rows = el('div', { class: 'prows' });
    st.options.forEach((o, k) => rows.append(el('div', { class: 'prow' + (vals[k] === top && top > 0 ? ' top' : '') },
      el('span', { class: 'pl' }, (v.picked.includes(o.counter) ? '🔮 ' : '') + o.text),
      el('span', { class: 'pbar' }, el('i', { style: `width:${top ? Math.round(100 * vals[k] / top) : 0}%` })),
      el('b', {}, String(vals[k])))));
    const topOpt = st.options[vals.indexOf(top)];
    host.append(el('div', { class: 'eyebrow' }, `Телеметрия: в среднем за партию (партий: ${play.rounds})`), rows,
      el('p', { class: 'verdict ' + (hit ? 'good' : 'bad') }, top === 0 ? 'Телеметрия пока ничего не заметила — сыграй ещё партию подольше.' : hit ? '🎯 Предсказание сбылось: ты угадал главную динамику.' : `${st.miss || 'В игре вышло по-другому'}: чаще всего — «${topOpt.text}».`),
      top > 0 && topOpt.why ? el('p', { class: 'concept' }, topOpt.why) : '',
      el('div', {}, el('button', { class: 'btn', type: 'button', onclick: () => { v.result = { hit, top: topOpt.counter, values: Object.fromEntries(st.options.map((o, k) => [o.counter, vals[k]])) }; ctx.save(v, true, true); } }, ctx.done ? 'Сравнил ✓' : 'Понятно, дальше')));
  }
  S.hooks.push((kind, d) => { if (kind === 'played' && d.step === st.play && v.locked) draw(); });
  draw();
  return host;
};

// factory: lockLevels — уровни выше первого открываются после первой сборки (цель версии 2); hookFrom — ответ «Что цепляет?» подсказкой;
// quickBuild — «⚙ Собрать сейчас» в любой момент: пустые поля сервер дописывает кубиком
const hasGame = () => !!(S.game && S.game.current);
STEPS.factory = ctx => {
  const st = ctx.step;
  let v = Object.assign({ level: st.levels[0].id, fields: {} }, ctx.value);
  const locked = l => st.lockLevels && l.id !== st.levels[0].id && !hasGame();
  if (st.levels.some(l => l.id === v.level && locked(l))) v.level = st.levels[0].id;
  // donors — несколько доноров на выбор (урок 2: змейка, пинг-понг…): у каждого свои колоды кубиков, чтобы кубик не приносил правило из другой игры
  if (st.donors && !st.donors.some(d => d.id === v.donor)) v.donor = st.donors[0].id;
  const donor = () => st.donors ? st.donors.find(d => d.id === v.donor) : null;
  const withDeck = f => { const d = donor(); return d && d.decks && d.decks[f.id] ? Object.assign({}, f, { deck: d.decks[f.id] }) : f; };
  const wrap = el('div', { class: 'stack' });
  const levelSeg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Уровень задания' });
  st.levels.forEach(l => {
    const lock = locked(l);
    const b = el('button', { type: 'button', class: 'opt' + (v.level === l.id ? ' on' : '') + (lock ? ' lvl-lock' : ''), 'aria-pressed': String(v.level === l.id), 'aria-disabled': lock ? 'true' : null },
      el('b', {}, (lock ? '🔒 ' : '') + l.label), el('div', { class: 'small muted' }, lock ? 'Откроется после первой сборки — цель версии 2' : l.hint));
    b.addEventListener('click', () => { if (lock) { toast('На первом уроке — базовый уровень. Этот откроется после первой сборки'); return; } v.level = l.id; ctx.save(v); draw(); });
    levelSeg.append(b);
  });
  const fieldsHost = el('div', { class: 'stack' });
  const counterHost = el('div');
  function draw() {
    levelSeg.querySelectorAll('.opt').forEach((b, k) => { const on = st.levels[k].id === v.level; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    fieldsHost.innerHTML = '';
    drawDonor();
    visible().map(withDeck).forEach(f => fieldsHost.append(fieldEditor(f, v.fields[f.id], nv => { v.fields[f.id] = nv; ctx.save(v); count(); }, { single: f.id === 'title', idPrefix: st.id })));
    count();
  }
  const visible = () => st.fields.filter(f => !f.levels || f.levels.includes(v.level));
  const count = () => { counterHost.innerHTML = ''; counterHost.append(ownCounter(visible().map(f => v.fields[f.id]))); };
  wrap.append(el('div', { class: 'formula' }, el('span', {}, 'Донор'), '×', el('span', {}, 'Твист'), '×', el('span', {}, 'Мир')));
  wrap.append(el('div', { class: 'eyebrow' }, 'Уровень'), levelSeg);
  const hook = st.hookFrom ? choiceText(st.hookFrom) : '';
  if (hook) wrap.append(el('div', { class: 'hookbox' }, el('b', {}, 'Тебя зацепило в доноре: '), `«${hook}». Оставишь это в своей игре? Возьми в твист, мир или чувство.`));
  if (st.donorCard) wrap.append(el('div', { class: 'donor-card' }, el('div', { class: 'ico' }, st.donorCard.icon || '👾'), el('div', {}, el('div', { class: 'eyebrow' }, 'Донор урока · карта'), el('h3', {}, st.donorCard.title), el('p', { class: 'muted' }, st.donorCard.text))));
  const donorHost = el('div', { class: 'stack' });
  function drawDonor() {
    if (!st.donors) return;
    donorHost.innerHTML = '';
    const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Донор' });
    st.donors.forEach(d => seg.append(el('button', { type: 'button', class: 'opt' + (d.id === v.donor ? ' on' : ''), 'aria-pressed': String(d.id === v.donor), 'data-donor': d.id, onclick: () => {
      if (d.id === v.donor) return;
      // кубики прошлого донора уходят: правило змейки не годится пинг-понгу; свои слова остаются
      for (const [k, f] of Object.entries(v.fields)) if (f && f.dice) delete v.fields[k];
      v.donor = d.id; beep('tick'); ctx.save(v); draw();
    } }, el('b', {}, (d.icon ? d.icon + ' ' : '') + d.title))));
    const d = donor();
    donorHost.append(el('div', { class: 'eyebrow' }, 'Донор: какую классику берёшь'), seg,
      el('div', { class: 'donor-card' }, el('div', { class: 'ico' }, d.icon || '🎮'), el('div', {}, el('div', { class: 'eyebrow' }, 'Донор · карта'), el('h3', {}, d.title), el('p', { class: 'muted' }, d.text))));
  }
  if (st.donors) { if (!ctx.value || !ctx.value.donor) ctx.save(v); wrap.append(donorHost); }
  wrap.append(fieldsHost, el('div', { class: 'row' }, counterHost, el('span', { class: 'grow' }),
    el('button', { class: 'btn ghost', type: 'button', onclick: () => {
      const empty = visible().map(withDeck).filter(f => !valText(v.fields[f.id]) && f.deck);
      empty.forEach(f => { v.fields[f.id] = { text: roll(f.deck), dice: true }; });
      beep('dice'); ctx.save(v); draw();
    } }, '🎲 Кубик для пустых полей'),
    st.quickBuild ? el('button', { class: 'btn ghost', type: 'button', title: 'Собрать игру с тем, что есть: пустые поля допишет кубик', onclick: () => { ctx.save(v); startBuild(); } }, '⚙ Собрать сейчас') : null,
    el('button', { class: 'btn', type: 'button', onclick: async () => {
      const missing = visible().filter(f => !valText(v.fields[f.id]));
      if (missing.length) { toast('Заполни: ' + missing.map(f => f.label).join(', ')); return; }
      // честно: замысел целиком из кубика — ещё не игра автора
      const own = visible().filter(f => !(v.fields[f.id] || {}).dice).length;
      if (!own && !(await Lab.ask('Весь замысел пока из кубика. Это ещё не твоя игра: перепиши своими словами хотя бы твист. Всё равно готово?', { ok: 'Всё равно готово', cancel: 'Поправлю' }))) return;
      ctx.save(v, true);
    } }, 'Замысел готов')));
  draw();
  return wrap;
};
// «⚙ Собрать сейчас»: переходит к шагу сборки (его чекпоинт должен быть открыт) и запускает её
function startBuild() {
  const id = S.lesson.plan && S.lesson.plan.build, cp = id && S.lesson.checkpoints.find(c => c.steps.some(x => x.id === id));
  if (!cp) return;
  if (!isOpen(cp)) { toast(`Сборка откроется в чекпоинте «${cp.title}»`); return; }
  if (S.cpId !== cp.id) { S.cpId = cp.id; render(); }
  setTimeout(() => {
    const card = document.getElementById('step-' + id), btn = card && card.querySelector('.buildbtn');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (btn) btn.click();
  }, 50);
}

STEPS.decisions = ctx => {
  const st = ctx.step;
  let v = Object.assign({ fields: {} }, ctx.value);
  const counterHost = el('div');
  const count = () => { counterHost.innerHTML = ''; counterHost.append(ownCounter(st.fields.map(f => v.fields[f.id]))); };
  const wrap = el('div', { class: 'stack' }, st.fields.map(f => fieldEditor(f, v.fields[f.id], nv => { v.fields[f.id] = nv; ctx.save(v); count(); }, { idPrefix: st.id })));
  wrap.append(el('div', { class: 'row' }, counterHost, el('span', { class: 'grow' }), el('button', { class: 'btn', type: 'button', onclick: () => {
    const missing = st.fields.filter(f => !valText(v.fields[f.id]));
    if (missing.length) { toast('Нужны все три решения: ' + missing.map(f => f.label).join(', ')); return; }
    ctx.save(v, true);
  } }, 'Решения приняты')));
  count();
  return wrap;
};

// значения полей Фабрики и решений для черновика ИГРА
function planVars() {
  const P = S.lesson.plan, out = {};
  for (const id of [P.factory, P.decisions]) for (const [k, f] of Object.entries((ans(id).value || {}).fields || {})) out[k] = valText(f);
  // донор на выбор: {donor} — название, {donorRules} и {donorKeys} — правила и кнопки классики для черновика ИГРА
  const fac = lessonSteps().find(x => x.id === P.factory), dv = (ans(P.factory).value || {}).donor;
  const d = fac && fac.donors && (fac.donors.find(x => x.id === dv) || fac.donors[0]);
  if (d) Object.assign(out, { donor: d.title, donorRules: d.rules || '', donorKeys: d.keys || '' });
  if (P.melody) out.melody = (ans(P.melody).value || {}).line || ''; // мелодия из секвенсора (урок 7)
  return out;
}
const fillTpl = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] || '…');

// igra: preview — готовый промпт «вот что получит программист», правка по желанию («✎ Поправить»); черновик из Фабрики обновляется сам,
// пока ученик не правил поле своими словами
STEPS.igra = ctx => {
  const st = ctx.step;
  let v = Object.assign({ fields: {} }, ctx.value);
  const refresh = () => {
    const vars = planVars();
    let changed = false;
    st.fields.forEach(f => {
      if (!f.prefill) return;
      const auto = !valText(v.fields[f.id]) || (st.preview && v.fields[f.id].auto);
      const text = fillTpl(f.prefill, vars);
      if (auto && valText(v.fields[f.id]) !== text) { v.fields[f.id] = { text, auto: true }; changed = true; }
    });
    if (changed) ctx.save(v);
    return changed;
  };
  refresh();
  // Фабрика и решения в том же чекпоинте: готовый промпт обновляется сразу, пока ученик его не правит
  S.hooks.push(kind => { if (kind === 'plan' && st.preview && !editing && refresh()) draw(); });
  let editing = !st.preview;
  const host = el('div', { class: 'stack' });
  const counterHost = el('div');
  const count = () => { counterHost.innerHTML = ''; counterHost.append(ownCounter(st.fields.map(f => v.fields[f.id]))); };
  const ready = () => {
    const missing = st.fields.filter(f => !valText(v.fields[f.id]));
    if (missing.length) { toast('Заполни: ' + missing.map(f => f.letter).join(', ')); return false; }
    return true;
  };
  function draw() {
    host.innerHTML = '';
    if (!editing) {
      host.append(el('div', { class: 'card preview-igra' }, el('div', { class: 'eyebrow' }, 'Вот что получит программист'),
        ...st.fields.map(f => el('div', { class: 'pi-row' }, el('span', { class: 'letter' }, f.letter),
          el('div', { class: 'stack', style: 'gap:2px' }, el('b', {}, f.label), el('div', {}, valText(v.fields[f.id]) || '—'))))),
      el('div', { class: 'row' }, el('span', { class: 'grow' }),
        el('button', { class: 'btn ghost', type: 'button', onclick: () => { editing = true; draw(); } }, '✎ Поправить'),
        el('button', { class: 'btn', type: 'button', onclick: () => { if (ready()) ctx.save(v, true); } }, ctx.done ? 'Всё верно ✓' : 'Всё верно')));
      return;
    }
    st.fields.forEach(f => host.append(fieldEditor(f, v.fields[f.id], nv => { v.fields[f.id] = nv; ctx.save(v); count(); }, { rows: 3, idPrefix: st.id })));
    count();
    host.append(el('div', { class: 'row' }, counterHost, el('span', { class: 'grow' }),
      el('button', { class: 'btn ghost', type: 'button', onclick: () => {
        const vars2 = planVars();
        st.fields.forEach(f => { if (f.prefill && (!valText(v.fields[f.id]) || v.fields[f.id].auto)) v.fields[f.id] = { text: fillTpl(f.prefill, vars2), auto: true }; });
        ctx.save(v); draw(); toast('Черновик собран заново: поля, которые ты правил, не тронуты');
      } }, '↻ Черновик из Фабрики'),
      el('button', { class: 'btn', type: 'button', onclick: () => { if (!ready()) return; ctx.save(v, true); if (st.preview) { editing = false; draw(); } } }, st.preview ? 'Готово' : 'Промпт готов')));
  }
  draw();
  return host;
};

// producer: разбор замысла (находки, развилки кнопками). «Пусть поправит продюсер» — он сам переписывает поля ИГРА по своему разбору,
// ученик видит «было → стало» и решает, принять ли правку.
STEPS.producer = ctx => {
  const host = el('div', { class: 'stack' });
  let fix = null; // предложенная правка продюсера: { igra, changes, before }
  function draw() {
    host.innerHTML = '';
    const v = ctx.value;
    const runBtn = el('button', { class: 'btn' + (v ? ' ghost' : ''), type: 'button', onclick: run }, v ? '↻ Спросить продюсера ещё раз' : 'Отдать замысел продюсеру');
    if (!v || !v.result) { host.append(el('div', {}, runBtn)); return; }
    const r = v.result, choices = v.choices || {};
    if (r.praise) host.append(el('p', { class: 'concept' }, r.praise));
    if (r.frame) host.append(el('p', { class: 'small muted' }, el('b', {}, 'Каркас игры: '), r.frame, ' — по нему программист возьмёт образец.'));
    if (r.findings.length) host.append(el('h3', {}, 'Что может сломать игру'), ...r.findings.map(f => el('div', { class: 'finding' }, el('span', { class: 'tag' }, f.kind), el('span', {}, f.text))));
    if (r.forks.length) {
      host.append(el('h3', {}, 'Развилки — решаешь ты'));
      r.forks.forEach((f, i) => {
        const grid = el('div', { class: 'opts' });
        f.options.forEach(o => grid.append(el('button', { type: 'button', class: 'opt' + (choices[i] === o ? ' on' : ''), onclick: () => {
          const nv = Object.assign({}, v, { choices: Object.assign({}, choices, { [i]: o }) });
          const all = r.forks.every((_, k) => nv.choices[k]);
          ctx.save(nv, all); beep('tick'); draw();
        } }, o)));
        host.append(el('div', { class: 'fork' }, el('b', {}, f.question), grid));
      });
    }
    if (!r.findings.length && !r.forks.length) host.append(el('p', {}, 'Продюсер не нашёл проблем. Можно собирать!'));
    if (r.raw) host.append(el('details', {}, el('summary', {}, 'Ответ продюсера целиком'), el('pre', { class: 'plan' }, r.raw)));
    if (fix) host.append(fixPreview());
    else if (v.fixed) host.append(el('p', { class: 'concept' }, '✓ Продюсер поправил промпт ИГРА, ты принял правку. Можно спросить продюсера ещё раз или собирать игру.'));
    const fixBtn = el('button', { class: 'btn' + (r.findings.length || r.forks.length ? ' warm' : ' ghost'), type: 'button', onclick: () => askFix(fixBtn) }, '🪄 Пусть поправит продюсер');
    host.append(el('div', { class: 'row' }, runBtn,
      fix ? null : fixBtn,
      el('button', { class: 'btn ghost', type: 'button', onclick: () => document.getElementById('step-' + S.lesson.plan.igra).scrollIntoView({ behavior: 'smooth' }) }, '✎ Поправить промпт ИГРА'),
      !r.forks.length ? el('button', { class: 'btn', type: 'button', onclick: () => ctx.save(v, true) }, 'Дальше') : null));
  }
  const igraStep = () => lessonSteps().find(x => x.id === S.lesson.plan.igra);
  function fixPreview() {
    const st = igraStep(), letters = Object.fromEntries((st ? st.fields : []).map(f => [f.id, f]));
    return el('div', { class: 'card stack fixbox' },
      el('h3', {}, '🪄 Продюсер переписал промпт ИГРА — было → стало'),
      fix.changes.length ? el('ul', { class: 'small' }, fix.changes.map(c => el('li', {}, c))) : null,
      ...['i', 'g', 'r', 'a'].map(k => el('div', { class: 'fixrow' + (fix.before[k] === fix.igra[k] ? ' same' : '') },
        el('b', {}, `${(letters[k] || {}).letter || k.toUpperCase()} — ${(letters[k] || {}).label || ''}`),
        fix.before[k] === fix.igra[k] ? el('div', { class: 'small muted' }, 'без изменений: ' + fix.igra[k])
          : [el('div', { class: 'was' }, fix.before[k] || '—'), el('div', { class: 'now' }, fix.igra[k])])),
      el('div', { class: 'row' },
        el('button', { class: 'btn', type: 'button', onclick: acceptFix }, '✓ Принять правку'),
        el('button', { class: 'btn ghost', type: 'button', onclick: () => { fix = null; draw(); } }, 'Оставить как было'),
        el('span', { class: 'muted small' }, 'Решаешь ты: принятые поля можно потом поправить своими словами в шаге ИГРА.')));
  }
  async function askFix(btn) {
    btn.disabled = true;
    try { fix = await Lab.job('/api/ai/producer-fix', {}, j => { btn.textContent = `🪄 Продюсер правит промпт… ${j.seconds} с`; }); beep('good'); } catch (e) { toast(e.message, 'err'); }
    draw();
  }
  function acceptFix() {
    const id = S.lesson.plan.igra, iv = Object.assign({ fields: {} }, ans(id).value), fields = Object.assign({}, iv.fields);
    for (const k of ['i', 'g', 'r', 'a']) if (fix.igra[k] && fix.igra[k] !== fix.before[k]) fields[k] = { text: fix.igra[k], producer: true };
    save(id, Object.assign({}, iv, { fields }), true, true);
    fix = null;
    ctx.save(Object.assign({}, ctx.value, { fixed: true }), true, true);
    toast('Промпт ИГРА поправлен продюсером', 'ok');
    renderMain(); // шаг ИГРА показывает новые поля
    const card = document.getElementById('step-' + S.lesson.plan.producer); if (card) card.scrollIntoView({ block: 'center' });
  }
  async function run() {
    if (!(ans(S.lesson.plan.igra) || {}).done) { toast('Сначала проверь промпт ИГРА выше и подтверди его'); return; }
    host.innerHTML = '';
    const p = el('p', { class: 'muted' }, 'Продюсер читает замысел…');
    host.append(el('div', { class: 'progress' }, el('div', { class: 'spinner' }), p));
    try {
      const result = await Lab.job('/api/ai/producer', {}, j => { p.textContent = `Продюсер читает замысел… ${j.seconds} с`; });
      ctx.save({ result, choices: {} }, false, true);
    } catch (e) { toast(e.message, 'err'); }
    draw();
  }
  draw();
  return host;
};

/* ---------- своя игра: версии, автопочинка ---------- */
// «Мой баланс»: повёрнутые ручки (Tab) сохраняются новой версией без ИИ — соседи, аркада и вызовы играют в неё,
// а «Как задумано» в ручках становится числами автора. Переключатели оболочки (сочность, камера) сюда не входят.
const fmtNum = v => String(Math.round(Number(v) * 100) / 100).replace('.', ',');
function balanceBar(h, gameId, onSaved, { why } = {}) {
  const conf = () => (h.meta || {}).config || {};
  const mine = () => Object.fromEntries(Object.entries(h.changed || {}).filter(([k]) => k in conf()));
  const line = el('span', { class: 'small muted grow', 'aria-live': 'polite' });
  const btn = el('button', { class: 'btn ghost small', type: 'button', disabled: true, 'data-balance': '1' }, '💾 Сохранить мой баланс');
  function show() {
    const c = conf(), m = mine(), keys = Object.keys(m), shell = Object.keys(h.changed || {}).filter(k => !(k in c)).length;
    btn.disabled = !keys.length;
    line.textContent = keys.length
      ? 'Повёрнуто: ' + keys.map(k => `${(c[k] && c[k].label) || k} ${fmtNum(c[k].value)} → ${fmtNum(m[k])}`).join('; ') + '.' + (shell ? ' Переключатели оболочки в баланс не входят.' : '')
      : shell ? 'Переключатели оболочки (сочность, камера) в баланс не входят — только ручки игры.' : 'Поверни ручки (Tab) и сохрани числа, которые нравятся: это новая версия игры без ИИ.';
  }
  h.onCfg = show;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      const r = await api('/api/game/balance', { game: gameId(), cfg: mine(), why: why ? why() : '' });
      beep('done'); toast(`Баланс сохранён: версия ${r.version}. Соседи и аркада играют в неё, «Как задумано» — твои числа.`, 'ok', 6000);
      if (onSaved) onSaved(r);
    } catch (e) { toast(e.message, 'err'); show(); }
  });
  show();
  return el('div', { class: 'row balance' }, btn, line);
}
const gameChanged = () => S.hooks.forEach(fn => fn('game'));
function ownGame({ onOver, autostart, onReady, onBalance, balanceWhy } = {}) {
  const status = el('div', { class: 'small', 'aria-live': 'polite' });
  const versions = el('div', { class: 'versions' });
  let fixTries = 0;
  const g = () => S.game;
  const h = Games.frame({
    src: () => `/play/${g().id}/${g().current}`, key: () => 'game:' + g().id, info: () => ({ version: g().current }), label: 'Играть в свою игру', autostart,
    onReady: meta => { status.textContent = `Версия ${g().current} запущена.`; fixTries = 0; api('/api/game/ran', { version: g().current }).catch(() => {}); if (onReady) onReady(meta); },
    onOver: m => {
      // обложка в аркаде: кадр после первой партии каждой новой версии
      const gg = g();
      if (gg && (!gg.poster || gg.poster.version !== gg.current)) { gg.poster = { version: gg.current }; h.post({ type: 'poster' }); }
      if (onOver) onOver(m);
    },
    onPoster: data => { const gg = g(); api('/api/game/poster', { game: gg.id, version: gg.current, data }).catch(() => { gg.poster = null; }); },
    onError: async err => {
      const n = g().current;
      if (fixTries >= 2 || S.demo) {
        h.message(el('div', { class: 'stack', style: 'align-items:center' }, el('b', {}, 'Игра упала: ' + (err.message || 'ошибка')),
          el('p', { class: 'muted small' }, S.demo ? 'В демо-режиме программист не чинит ошибки.' : 'Программист не смог починить за 2 попытки. Откати версию или опиши ошибку в Мастерской по формуле «Делал… Ожидал… Получилось… Не трогай…».')));
        api('/api/game/error', { version: n, error: err }).catch(() => {});
        return;
      }
      fixTries++;
      const p = el('p', {}, `Игра упала: ${err.message || 'ошибка'}${err.line ? ' (строка ' + err.line + ')' : ''}. Программист чинит — попытка ${fixTries} из 2…`);
      h.message(el('div', { class: 'progress' }, el('div', { class: 'spinner' }), p));
      try {
        const r = await Lab.job('/api/ai/fix', { version: n, error: { phase: err.phase, message: err.message, line: err.line } }, j => { p.textContent = `Программист чинит ошибку «${err.message}» — попытка ${fixTries} из 2… ${j.seconds} с`; });
        S.game = r.game; gameChanged(); h.start();
      } catch (e) { h.message(el('p', {}, 'Починка не удалась: ' + e.message)); }
    },
  });
  function drawVersions() {
    versions.innerHTML = '';
    if (!g()) return;
    g().versions.forEach(v => versions.append(el('button', {
      type: 'button', class: 'ver' + (v.n === g().current ? ' cur' : '') + (v.error ? ' bad' : ''),
      title: (v.kind || '') + (v.request ? ': ' + v.request : '') + (v.error ? ' · ошибка: ' + v.error.message : ''),
      onclick: async () => { try { const r = await api('/api/game/current', { version: v.n }); S.game = r.game; fixTries = 0; gameChanged(); h.start(); } catch (e) { toast(e.message, 'err'); } },
    }, `v${v.n} · ${v.kind || ''}`)));
  }
  drawVersions();
  // своя игра видна в нескольких шагах (сборка, эксперимент, мастерская): новая версия в одном — списки версий обновляются во всех
  S.hooks.push(kind => { if (kind === 'game') drawVersions(); });
  const bal = balanceBar(h, () => g().id, r => { S.game = r.game; fixTries = 0; gameChanged(); h.start(); if (onBalance) onBalance(r); }, { why: balanceWhy });
  return { h, el: el('div', { class: 'stack' }, h.box, Games.bar(h), bal, el('div', { class: 'row' }, el('span', { class: 'small muted' }, 'Версии:'), versions), status), drawVersions };
}

// build: собрать можно в любой момент — пустые поля Фабрики, решений и ИГРА сервер дописывает кубиком и возвращает их сюда.
// minRounds: 0 — шаг готов, как только игра собрана (первая партия — в другом шаге, например после перемены)
STEPS.build = ctx => {
  const st = ctx.step, need = st.minRounds == null ? 1 : st.minRounds;
  const host = el('div', { class: 'stack' });
  let v = Object.assign({ rounds: 0 }, ctx.value);
  // заголовок замысла: Фабрика в том же чекпоинте меняет его на лету (событие 'plan')
  const head = { title: el('h3', {}), sub: el('p', { class: 'muted small' }) };
  const paintHead = () => { const vars = planVars(); head.title.textContent = vars.title || 'Моя игра'; head.sub.textContent = [vars.twist, vars.world].filter(Boolean).join(' · '); };
  S.hooks.push(kind => { if (kind === 'plan') paintHead(); });
  let live = null; // рамка своей игры этого шага
  function draw(autostart) {
    host.innerHTML = '';
    host.append(el('div', { class: 'donor-card' }, el('div', { class: 'ico' }, '🛠'), el('div', {},
      el('div', { class: 'eyebrow' }, 'Замысел'), head.title, head.sub)));
    paintHead();
    const buildBtn = el('button', { class: 'btn buildbtn' + (S.game && S.game.current ? ' ghost' : ''), type: 'button', onclick: build }, S.game && S.game.current ? '↻ Собрать заново по замыслу' : '⚙ Собрать игру');
    if (live) { live.h.destroy(); live = null; }
    if (S.game && S.game.current) {
      const og = live = ownGame({ autostart, onOver: () => { v.rounds++; ctx.save(v, ctx.done || v.rounds >= need); } });
      host.append(og.el);
    }
    host.append(el('div', { class: 'row' }, buildBtn, el('span', { class: 'muted small' }, S.demo ? 'Демо-режим: соберётся образец урока с твоим названием.' : 'Программист пишет 5–10 минут, игра сохранится.')));
  }
  async function build() {
    if (S.game && S.game.current && !(await Lab.ask('Собрать игру заново по замыслу? Правки этой игры останутся в версиях.', { ok: 'Собрать заново' }))) return;
    pauseFrames();
    host.innerHTML = '';
    const p = el('p', {}, 'Программист пишет игру…');
    host.append(el('div', { class: 'progress', style: 'padding:30px' }, el('div', { class: 'spinner' }), p, el('p', { class: 'muted small' }, 'Программист пишет 5–10 минут, игра сохранится. Можно не ждать на этой странице.')));
    try {
      await flushSaves();
      const r = await Lab.job('/api/ai/build', {}, j => { p.textContent = `Программист пишет игру… ${j.seconds} с` + (j.chars ? ` · ${j.chars.toLocaleString('ru-RU')} символов кода` : '') + (j.phase === 'синтаксис' ? ' · чинит опечатку' : ''); });
      S.game = r.game; v.gameId = r.gameId;
      // поля, которые дописал кубик сервера: Фабрика, решения и ИГРА показывают их с пометкой [кубик]
      for (const [id, a] of Object.entries(r.filled || {})) S.answers[id] = Object.assign({}, ans(id), { value: a.value });
      ctx.save(v, need === 0 ? true : null);
      toast(r.filledCount ? `Игра собрана! Пустые поля замысла дописал кубик: ${r.filledCount}.` : 'Игра собрана! Кликни по ней и играй.', 'ok'); beep('done');
      if (r.filledCount) { // шаги Фабрики, решений и ИГРА перерисовываются с полями кубика
        S.autostartBuild = true; renderMain();
        const card = document.getElementById('step-' + st.id); if (card) card.scrollIntoView({ block: 'start' });
        return;
      }
      draw(true);
    } catch (e) { toast(e.message, 'err', 8000); draw(false); }
  }
  draw(!!S.autostartBuild); S.autostartBuild = false;
  return host;
};

// ownplay: партии в своей игре и один вопрос о ней (урок 1: «Какая ручка сильнее всего меняет задуманное чувство?»).
// Над игрой — задуманное чувство из решений автора. Готово, когда сыграно minRounds партий и есть ответ.
STEPS.ownplay = ctx => {
  const st = ctx.step, need = st.minRounds || 1;
  let v = Object.assign({ rounds: 0, answer: { text: '' } }, ctx.value);
  const host = el('div', { class: 'stack' });
  if (!hasGame()) {
    host.append(el('div', { class: 'locked-msg card' }, el('h3', {}, 'Игра ещё собирается'),
      el('p', { style: 'margin-top:6px' }, 'Программист пишет её 5–10 минут. Как только игра будет готова, жми «Проверить».'),
      el('div', { style: 'margin-top:12px' }, el('button', { class: 'btn ghost small', type: 'button', onclick: async () => {
        try { const me = await api('/api/me'); S.game = me.game; if (hasGame()) renderMain(); else toast('Игра ещё собирается'); } catch (e) { toast(e.message, 'err'); }
      } }, '↻ Проверить'))));
    return host;
  }
  const ready = () => v.rounds >= need && (!st.question || !!valText(v.answer));
  const feel = valText(((ans(S.lesson.plan.decisions).value || {}).fields || {}).feeling);
  const status = el('b', {});
  const show = () => { status.textContent = `Партий: ${v.rounds}` + (v.rounds < need ? ` из ${need}` : ' ✓'); };
  const og = ownGame({ onOver: () => { v.rounds++; show(); ctx.save(v, ready() ? true : null); } });
  if (feel) host.append(el('div', { class: 'recall' }, el('b', {}, 'Ты задумал: '), feel));
  host.append(og.el, el('div', { class: 'small' }, status),
    st.question ? fieldEditor({ id: 'answer', label: st.question, deck: st.deck }, v.answer, nv => { v.answer = nv; ctx.save(v, ready() ? true : null); }, { idPrefix: st.id }) : null);
  show();
  return host;
};

// experiment: эксперимент с одной ручкой своей игры — партия как есть → ручка и предсказание → партия с повёрнутой ручкой →
// сравнение цифр двух партий, «сбылось или нет» и решение: оставить числа (новая версия «баланс») или вернуть как было. ИИ не нужен.
const EXPERIMENT_DECK = [
  'Станет напряжённее: угрозы будут ближе к герою',
  'Станет легче, и партия будет дольше',
  'Партия станет короче, но веселее',
  'Я буду чаще жать главную кнопку',
  'Появится стратегия «стоять на месте»',
  'Счёт вырастет, но играть станет скучнее',
];
const partStats = m => { const t = m.tele || {}; return { score: Math.round(m.score || 0), time: Math.round(t.time || 0), hurts: t.hurts || 0, presses: Object.values(t.presses || {}).reduce((a, b) => a + b, 0) }; };
STEPS.experiment = ctx => {
  const st = ctx.step;
  let v = Object.assign({ knob: null, from: null, to: null, guess: { text: '' }, before: null, after: null, result: null, noticed: { text: '' }, kept: null }, ctx.value);
  const host = el('div', { class: 'stack' });
  if (!S.game || !S.game.current) { host.append(el('p', { class: 'muted' }, 'Сначала собери игру в чекпоинте «Сборка».')); return host; }
  let conf = {};
  const save = done => ctx.save(v, done == null ? null : done, true);
  const og = ownGame({
    onReady: meta => {
      conf = meta.config || {};
      if (v.knob && !(v.knob in conf)) v.knob = null;
      if (v.knob && v.to != null && !v.after && !v.kept) og.h.post({ type: 'setCfg', cfg: { [v.knob]: v.to } }); // рамка перезапустилась — ручка снова повёрнута
      draw();
    },
    onOver: m => {
      const ch = og.h.changed || {};
      if (!v.before && !Object.keys(ch).some(k => k in conf)) { v.before = partStats(m); save(); draw(); return; }
      if (v.before && v.knob && v.to != null && ch[v.knob] === v.to && !v.after) { v.after = partStats(m); save(); draw(); }
    },
    onBalance: () => { v.kept = 'keep'; save(true); draw(); },
    balanceWhy: () => v.knob ? `эксперимент: ${(conf[v.knob] || {}).label || v.knob}; предсказание — ${valText(v.guess) || '—'}; итог — ${v.result || '—'}` : '',
  });
  const panel = el('div', { class: 'stack' });
  host.append(og.el, panel);
  const stage = (n, title, body, on) => el('div', { class: 'exp-stage' + (on ? ' on' : '') }, el('b', {}, `${n}. ${title}`), body);
  function draw() {
    panel.innerHTML = '';
    const keys = Object.keys(conf);
    // 1. партия как есть
    panel.append(stage(1, 'Сыграй партию как есть', v.before ? el('p', { class: 'small ok-text' }, `✓ Счёт ${v.before.score}, партия ${v.before.time} с, урон ${v.before.hurts}`) : el('p', { class: 'small muted' }, 'Ручки не трогай: это точка отсчёта.'), !v.before));
    if (!v.before) return;
    // 2. одна ручка и предсказание
    const body2 = el('div', { class: 'stack', style: 'gap:8px' });
    if (!keys.length) body2.append(el('p', { class: 'small muted' }, 'Ручки игры ещё загружаются — запусти игру.'));
    else {
      const sel = el('select', { 'aria-label': 'Ручка для эксперимента', 'data-exp': 'knob' }, el('option', { value: '' }, 'Выбери одну ручку…'), ...keys.map(k => el('option', { value: k, selected: k === v.knob ? true : null }, conf[k].label || k)));
      sel.addEventListener('change', () => { if (v.after) return; v.knob = sel.value || null; v.from = v.knob ? conf[v.knob].value : null; v.to = null; save(); draw(); });
      body2.append(sel);
      if (v.knob) {
        const c = conf[v.knob];
        if (c.hint) body2.append(el('p', { class: 'small muted' }, c.hint));
        body2.append(fieldEditor({ id: 'guess', label: 'Что изменится, если повернуть её?', hint: 'Одной фразой: что почувствует игрок и почему', deck: st.deck || EXPERIMENT_DECK }, v.guess, nv => { v.guess = nv; save(); }, { idPrefix: st.id }));
        const out = el('output', {}, fmtNum(v.to != null ? v.to : c.value));
        const range = el('input', { type: 'range', min: c.min, max: c.max, step: c.step || 1, value: v.to != null ? v.to : c.value, 'aria-label': c.label || v.knob, 'data-exp': 'range', disabled: v.after ? true : null });
        range.addEventListener('input', () => { out.textContent = fmtNum(range.value); });
        range.addEventListener('change', () => {
          if (!valText(v.guess)) { toast('Сначала запиши предсказание'); range.value = v.to != null ? v.to : c.value; out.textContent = fmtNum(range.value); return; }
          v.to = Number(range.value); save(); og.h.post({ type: 'setCfg', cfg: { [v.knob]: v.to } }); beep('tick'); draw();
        });
        body2.append(el('label', { class: 'row small' }, el('span', {}, `${c.label || v.knob}: было ${fmtNum(v.from)}, стало`), out), range);
      }
    }
    panel.append(stage(2, 'Выбери одну ручку и предскажи', body2, !v.to && v.to !== 0));
    if (v.to == null) return;
    // 3. партия с повёрнутой ручкой
    panel.append(stage(3, 'Сыграй партию с повёрнутой ручкой', v.after ? el('p', { class: 'small ok-text' }, `✓ Счёт ${v.after.score}, партия ${v.after.time} с, урон ${v.after.hurts}`) : el('p', { class: 'small muted' }, 'Ручка уже повёрнута в игре. Играй как обычно.'), !v.after));
    if (!v.after) return;
    // 4. сравнение и вывод
    const row = (label, k) => el('tr', {}, el('td', {}, label), el('td', {}, String(v.before[k])), el('td', {}, String(v.after[k])), el('td', { class: v.after[k] > v.before[k] ? 'ok-text' : v.after[k] < v.before[k] ? 'warn-text' : 'muted' }, v.after[k] === v.before[k] ? '=' : (v.after[k] > v.before[k] ? '+' : '') + (v.after[k] - v.before[k])));
    const res = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Сбылось ли предсказание' });
    ['Сбылось', 'Не сбылось', 'Вышло неожиданно'].forEach(x => res.append(el('button', { type: 'button', class: 'opt' + (v.result === x ? ' on' : ''), 'aria-pressed': String(v.result === x), 'data-result': x, onclick: () => { v.result = x; save(); beep('tick'); draw(); } }, x)));
    const body4 = el('div', { class: 'stack', style: 'gap:8px' },
      el('p', { class: 'small' }, el('b', {}, 'Предсказание: '), valText(v.guess)),
      el('div', { class: 'tablewrap' }, el('table', {}, el('thead', {}, el('tr', {}, ['', 'как есть', 'с ручкой', 'разница'].map(h => el('th', {}, h)))),
        el('tbody', {}, row('Счёт', 'score'), row('Длина партии, с', 'time'), row('Урон герою', 'hurts'), row('Нажатий', 'presses')))),
      res);
    if (v.result) {
      body4.append(fieldEditor({ id: 'noticed', label: 'Что заметил?', hint: 'Одна партия — ещё не закон: что проверишь на соседе?' }, v.noticed, nv => { v.noticed = nv; save(); }, { idPrefix: st.id }));
      if (v.kept === 'keep') body4.append(el('p', { class: 'concept' }, '✓ Числа сохранены новой версией «баланс». Соседи в «Играем вместе» играют уже в неё.'));
      else if (v.kept === 'back') body4.append(el('p', { class: 'concept' }, '↩ Ручка вернулась как было. Эксперимент записан, а это тоже результат.'));
      else body4.append(el('div', { class: 'row' },
        el('button', { class: 'btn', type: 'button', 'data-exp': 'keep', onclick: async () => {
          try {
            const r = await api('/api/game/balance', { cfg: { [v.knob]: v.to }, why: `эксперимент: ${(conf[v.knob] || {}).label || v.knob}; предсказание — ${valText(v.guess)}; итог — ${v.result}` });
            S.game = r.game; gameChanged(); v.kept = 'keep'; save(true); beep('done'); toast(`Баланс сохранён: версия ${r.version}`, 'ok'); og.h.start();
          } catch (e) { toast(e.message, 'err'); }
        } }, '💾 Оставить эти числа'),
        el('button', { class: 'btn ghost', type: 'button', 'data-exp': 'back', onclick: () => { og.h.post({ type: 'setCfg', cfg: { [v.knob]: v.from } }); v.kept = 'back'; save(true); draw(); } }, '↩ Вернуть как было')));
    }
    panel.append(stage(4, 'Сравни и реши', body4, true));
  }
  draw();
  return host;
};

STEPS.aicheck = ctx => {
  let v = Object.assign({ text: '', notes: null }, ctx.value);
  const host = el('div', { class: 'stack' });
  function draw() {
    host.innerHTML = '';
    if (!S.game || !S.game.current) { host.append(el('p', { class: 'muted' }, 'Сначала собери игру в чекпоинте «Фабрика и сборка».')); return; }
    const ta = el('textarea', { rows: 3, id: 'aicheck-text', placeholder: 'Например: у врагов появились щиты, а я их не просил' });
    ta.value = v.text;
    ta.addEventListener('input', () => { v.text = ta.value; ctx.save(v); });
    host.append(el('label', { class: 'lbl', for: 'aicheck-text' }, 'Что ИИ добавил сам?'), ta);
    host.append(el('div', {}, el('button', { class: 'btn', type: 'button', onclick: async () => {
      if (!v.text.trim()) { toast('Сначала напиши свою догадку'); return; }
      try { const r = await api('/api/game/notes'); v.notes = r.notes; ctx.save(v, true, true); draw(); } catch (e) { toast(e.message, 'err'); }
    } }, v.notes ? '↻ Обновить решения программиста' : 'Показать, что программист решил сам')));
    if (v.notes) {
      host.append(el('h3', {}, 'Программист записал свои решения:'));
      host.append(v.notes.length ? el('ul', {}, v.notes.map(n => el('li', {}, n))) : el('p', { class: 'muted' }, 'Программист не оставил записей. Проверь по игре сам.'));
      host.append(el('p', { class: 'concept' }, 'Сравни со своей догадкой. Что из этого ты оставишь? Что уберёшь правкой в Мастерской? Проверяй, а не верь: ИИ ошибается уверенно.'));
    }
  }
  draw();
  return host;
};

// кнопки правки: ученик называет беду игры, программист получает точную инструкцию; сценарий может дать свои (presets)
const WORKSHOP_PRESETS = [
  { label: 'Слишком легко', request: 'Игра слишком лёгкая. Сделай угрозы чуть быстрее и чаще к середине партии, чтобы сложность росла заметнее. Управление и условия победы не меняй.' },
  { label: 'Слишком сложно', request: 'Игра слишком сложная. Первые 20 секунд сделай спокойнее: угроз меньше, игрок успевает понять управление. Дальше сложность пусть растёт как раньше.' },
  { label: 'Непонятно, что делать', request: 'Новичок не понимает цель. В начале партии на 3–4 секунды покажи крупную подсказку: цель и клавиши. Подсвети первую цель. Механику не меняй.' },
  { label: 'Скучно в середине', request: 'В середине партии становится скучно. Добавь на 30–40 секунде новое событие или угрозу с другим поведением, которое меняет ситуацию. Начало партии не трогай.' },
  { label: 'Героя плохо видно', request: 'Героя плохо видно или он уходит за кадр. Пусть камера всегда держит героя в кадре, а сам герой будет ярче и контрастнее фона. Механику не трогай.' },
  { label: 'Вяло, мало сочности', request: 'Главное действие ощущается вяло. Добавь к нему вспышку, частицы и звук, к попаданию — короткую паузу удара и лёгкую тряску камеры. Механику и числа не трогай.' },
];

// workshop: limit — правок в этом шаге (сервер считает правки урока по сумме limit всех шагов workshop);
// cardsFrom — над просьбой карточки соседей из плейтеста моей игры («Хочется», «А что если»): касание берёт карточку в просьбу
STEPS.workshop = ctx => {
  const st = ctx.step;
  let v = Object.assign({ requests: [] }, ctx.value);
  const several = lessonSteps().filter(x => x.type === 'workshop').length > 1;
  const presets = st.presets || WORKSHOP_PRESETS;
  const host = el('div', { class: 'stack' });
  let live = null; // рамка своей игры этого шага
  function draw() {
    host.innerHTML = '';
    if (live) { live.h.destroy(); live = null; }
    if (!S.game || !S.game.current) { host.append(el('p', { class: 'muted' }, 'Сначала собери игру в чекпоинте «Фабрика и сборка».')); return; }
    const og = live = ownGame({});
    const left = st.limit ? st.limit - v.requests.length : Infinity;
    if (left <= 0) {
      host.append(og.el, el('p', { class: 'concept' }, st.limit === 1 ? (several ? '✓ Правка этого шага использована.' : '✓ Правка урока использована.') + ' Числа можно и дальше крутить ручками (Tab).' : `✓ Все ${st.limit} правки ${several ? 'шага' : 'урока'} использованы. Числа можно и дальше крутить ручками (Tab).`));
    } else {
      let req = { text: '' }, preset = null;
      const grid = el('div', { class: 'opts', role: 'radiogroup', 'aria-label': 'Что не так с игрой' });
      presets.forEach(pr => {
        const b = el('button', { type: 'button', class: 'opt', 'aria-pressed': 'false', title: pr.request }, pr.label);
        b.addEventListener('click', () => {
          preset = preset === pr ? null : pr;
          grid.querySelectorAll('.opt').forEach((x, k) => { const on = presets[k] === preset; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
          beep('tick');
        });
        grid.append(b);
      });
      const send = el('button', { class: 'btn', type: 'button' }, 'Отправить программисту');
      const prog = el('div');
      // баг по формуле — четыре коротких поля: программисту нужен шаг, ожидание, результат и то, что ломать нельзя
      const BUG = [['did', 'Делал', 'Нажал пробел у края экрана'], ['want', 'Ожидал', 'Герой выстрелит'], ['got', 'Получилось', 'Герой застрял в стене'], ['keep', 'Не трогай', 'Скорость врагов и счёт']];
      const bug = {};
      const bugBox = el('div', { class: 'bugform', hidden: true }, BUG.map(([k, label, ph]) => el('label', { class: 'row small' }, el('b', { style: 'min-width:92px' }, label + '…'),
        el('input', { type: 'text', maxlength: 160, placeholder: ph, 'data-bug': k, class: 'grow', style: 'width:auto;flex:1', oninput: e => { bug[k] = e.target.value.trim(); } }))));
      const bugBtn = el('button', { class: 'btn ghost small', type: 'button', 'aria-expanded': 'false', onclick: () => { bugBox.hidden = !bugBox.hidden; bugBtn.setAttribute('aria-expanded', String(!bugBox.hidden)); } }, '🐞 Это баг — опишу по формуле');
      send.addEventListener('click', async () => {
        const bugText = bug.did || bug.got ? `Баг. Делал: ${bug.did || '—'}. Ожидал: ${bug.want || '—'}. Получилось: ${bug.got || '—'}.` + (bug.keep ? ` Не трогай: ${bug.keep}.` : '') : '';
        if (!bugBox.hidden && bugText && (!bug.did || !bug.got)) { toast('Для бага нужны хотя бы «Делал» и «Получилось»'); return; }
        const own = [valText(req).trim(), bugText].filter(Boolean).join('\n');
        if (!preset && !own) { toast('Выбери, что не так, или напиши свою просьбу'); return; }
        if (st.limit && !(await Lab.ask(left === 1 ? (several ? 'Это единственная правка в этом шаге. Отправить?' : 'Это единственная правка на уроке. Отправить?') : `Осталось правок: ${left}. Отправить?`, { ok: 'Отправить' }))) return;
        const text = preset ? preset.request + (own ? '\nЕщё от автора: ' + own : '') : own;
        send.disabled = true; pauseFrames();
        prog.innerHTML = ''; const p = el('p', {}, 'Программист вносит правку…');
        prog.append(el('div', { class: 'progress' }, el('div', { class: 'spinner' }), p));
        try {
          const r = await Lab.job('/api/ai/change', { request: text }, j => { p.textContent = `Программист вносит правку… ${j.seconds} с` + (j.chars ? ` · ${j.chars.toLocaleString('ru-RU')} символов` : ''); });
          S.game = r.game; v.requests = v.requests.concat({ text: preset ? preset.label + (own ? ': ' + own : '') : own, dice: !preset && !!req.dice, version: r.version }); ctx.save(v, true, true);
          toast(S.demo ? 'Демо-режим: правка записана, но игра не изменилась' : `Готово: версия ${r.version}`, 'ok'); draw(); gameChanged(); if (live) live.h.start();
        } catch (e) { toast(e.message, 'err', 8000); send.disabled = false; prog.innerHTML = ''; }
      });
      const cardsHost = el('div', { class: 'stack' });
      if (st.cardsFrom) loadCards(cardsHost);
      host.append(og.el, cardsHost,
        el('label', { class: 'lbl' }, 'Что не так с игрой?'), grid,
        fieldEditor({ id: 'req', label: 'Или своими словами (можно вместе с кнопкой)', hint: 'Числа программист не нужен: их меняют ручки (Tab) и «Сохранить мой баланс».', deck: st.deck }, req, nv => { req = nv; }, { rows: 2, idPrefix: st.id }),
        bugBtn, bugBox,
        el('div', { class: 'row' }, send, st.limit ? el('span', { class: 'muted small' }, left === 1 ? (several ? 'Здесь одна правка: выбирай главное.' : 'На этом уроке одна правка: выбирай главное.') : `Осталось правок: ${left}`) : null), prog);
    }
    if (v.requests.length) host.append(el('details', {}, el('summary', {}, `Мои правки (${v.requests.length})`), el('ol', {}, v.requests.map(r => el('li', {}, `${r.text}${r.dice ? ' [кубик]' : ''} → v${r.version}`)))));
  }
  async function loadCards(box) {
    let r;
    try { r = await api('/api/playtest/mine'); } catch (e) { return; }
    const cards = ((r.discovery || {}).cards || []);
    const items = cards.flatMap(c => [['Хочется', c.want], ['А что если', c.whatif]].filter(([, x]) => valText(x)).map(([k, x]) => ({ who: c.nick, kind: k, text: valText(x) })));
    box.innerHTML = '';
    if (!items.length) { box.append(el('p', { class: 'muted small' }, 'Соседи ещё не оставили карточек плейтеста. Они появятся в шаге «Плейтест» чекпоинта «Играем вместе».')); return; }
    box.append(el('div', { class: 'eyebrow' }, 'Что сказали соседи — нажми, чтобы взять в просьбу'),
      el('div', { class: 'cardopts' }, items.map(it => el('button', { type: 'button', class: 'cardopt', title: 'Автор карточки: ' + it.who, onclick: () => {
        const ta = document.getElementById('f-' + st.id + 'req');
        if (!ta) return;
        ta.value = `${it.kind} (сосед): ${it.text}`; ta.dispatchEvent(new Event('input')); ta.focus(); beep('tick');
      } }, el('b', {}, it.kind + ': '), it.text))));
  }
  draw();
  return host;
};

/* ---------- играем вместе: игра соседа и плейтест ---------- */
// arcade: игра одноклассника по кругу или на выбор, рекорд автора и свой, вызов «побей мой мир».
// about — id прошлого шага arcade: та же игра соседа, уже в новой версии (урок 1: «Сосед играет версию 2»)
STEPS.arcade = ctx => {
  const st = ctx.step;
  let v = Object.assign({ game: null, rounds: 0, best: 0, beat: false, played: 0 }, ctx.value);
  const host = el('div', { class: 'stack' });
  let data = null, waiting = false, cur = null;
  const pick = game => { v = Object.assign(v, { game: game.id, author: game.nick, title: game.title, rounds: 0, best: 0, beat: false }); ctx.save(v); S.hooks.forEach(fn => fn('picked', game)); };
  async function load(after) {
    try { data = await api('/api/arcade' + (after ? '?after=' + encodeURIComponent(after) : '')); } catch (e) { host.innerHTML = ''; host.append(el('p', { class: 'err' }, e.message)); return; }
    const want = v.game || (ctx.step.about && (ans(ctx.step.about).value || {}).game);
    const game = (!after && want && data.games.find(g => g.id === want && !g.mine)) || data.neighbour;
    if (game && game.id !== v.game) pick(game);
    draw(game);
  }
  function draw(game) {
    if (cur) { cur.destroy(); cur = null; }
    host.innerHTML = '';
    waiting = !game;
    if (!game) {
      host.append(el('div', { class: 'locked-msg card' }, el('h3', {}, 'Ждём игру соседа'),
        el('p', { style: 'margin-top:6px' }, 'Пока никто из одноклассников не собрал игру. Как только сосед соберёт свою, она появится здесь сама.'),
        el('div', { style: 'margin-top:12px' }, el('button', { class: 'btn ghost small', type: 'button', onclick: () => load() }, '↻ Проверить'))));
      return;
    }
    const scoreHost = el('div'), chHost = el('div'), cardHost = el('div');
    const showScores = () => { scoreHost.innerHTML = ''; scoreHost.append(Games.scores(game)); cardHost.innerHTML = ''; cardHost.append(Games.card(game, { compact: true })); };
    const status = el('b', {});
    const showStatus = () => { status.textContent = `Партий: ${v.rounds} · лучший счёт: ${v.best}` + (v.beat ? ' · рекорд автора побит!' : ''); };
    const h = cur = Games.frame({
      src: () => `/play/${game.id}/${game.version}`, key: () => 'game:' + game.id, info: () => ({ version: game.version }), label: 'Играть в игру соседа', challenge: true,
      onOver: m => {
        v.rounds++; v.played = (v.played || 0) + 1; v.best = Math.max(v.best, m.score || 0);
        ctx.save(v, ctx.done || v.played >= (st.minRounds || 1)); showStatus();
        chHost.innerHTML = ''; chHost.append(Games.challenge(game, m));
      },
      onScore: (m, r) => {
        game.authorBest = r.authorBest || 0; game.myBest = r.mine; game.record = r.record; showScores();
        if (m.score > game.authorBest && !v.beat) { v.beat = true; ctx.save(v); showStatus(); beep('done'); toast(`Рекорд автора побит: ${m.score} против ${game.authorBest}! Брось ему вызов.`, 'ok'); }
      },
      onError: err => h.message(el('div', { class: 'stack', style: 'align-items:center' }, el('b', {}, 'Игра соседа упала: ' + (err.message || 'ошибка')),
        el('p', { class: 'muted small' }, 'Скажи автору — пусть починит в Мастерской. А пока возьми следующую игру по кругу.'))),
    });
    const picker = el('div', { class: 'agrid', hidden: true });
    data.games.filter(g => !g.mine).forEach(g => picker.append(Games.card(g, { compact: true, actions: [el('button', { class: 'btn small', type: 'button', onclick: () => {
      pick(g); draw(g); host.scrollIntoView({ behavior: 'smooth' });
    } }, g.id === game.id ? 'Играешь сейчас' : '▶ Эту')] })));
    showScores(); showStatus();
    host.append(cardHost, scoreHost, h.box, Games.bar(h, status), chHost,
      el('div', { class: 'row' },
        el('button', { class: 'btn ghost small', type: 'button', onclick: () => load(game.nick) }, '↻ Следующая игра по кругу'),
        el('button', { class: 'btn ghost small', type: 'button', onclick: () => { picker.hidden = !picker.hidden; } }, `Выбрать из аркады (${data.games.filter(g => !g.mine).length})`),
        el('a', { class: 'btn ghost small', href: '/arcade', target: '_blank', rel: 'noopener' }, '🕹 Вся аркада ↗'),
        el('span', { class: 'grow' }),
        el('button', { class: 'btn small', type: 'button', onclick: () => { if (!v.played) { toast('Сначала сыграй хотя бы одну партию'); return; } ctx.save(v, true); } }, 'Готово, дальше')),
      picker);
  }
  S.hooks.push(kind => { if (kind === 'arcade' && waiting) load(); });
  host.append(el('p', { class: 'muted' }, 'Ищем игру соседа…'));
  load();
  return host;
};

// playtest: тап-карточка отзыва на игру соседа + открытие плейтеста моей игры и отзыв учителя
STEPS.playtest = ctx => {
  const st = ctx.step;
  const emotions = st.emotions || ['😄 Весело', '😬 Напряжённо', '🤩 Вау', '🤔 Непонятно', '😤 Обидно', '😴 Скучно'];
  const decks = st.decks || {};
  let v = Object.assign({ game: null, emotions: [], like: { text: '' }, want: { text: '' }, whatif: { text: '' }, sent: false }, ctx.value);
  const host = el('div', { class: 'stack' });
  const mineHost = el('div', { class: 'stack' });
  function drawCard() {
    const about = ans(st.about).value || {};
    const box = el('div', { class: 'stack ptform' });
    if (!about.game) { box.append(el('p', { class: 'muted' }, 'Сначала сыграй в игру соседа в шаге выше — отзыв пишут на игру, в которую сыграл.')); return box; }
    if (v.game !== about.game) v = Object.assign(v, { game: about.game, title: about.title, author: about.author, sent: false });
    box.append(el('h3', {}, `Отзыв на «${about.title || 'игру соседа'}»`), el('p', { class: 'muted small' }, `Автор: ${about.author || '—'}. Отзыв конкретный и доброжелательный: что нравится, чего хочется, а что если…`));
    const grid = el('div', { class: 'emos', role: 'group', 'aria-label': 'Что ты чувствовал' });
    emotions.forEach(e => {
      const b = el('button', { type: 'button', class: 'emo' + (v.emotions.includes(e) ? ' on' : ''), 'aria-pressed': String(v.emotions.includes(e)) }, e);
      b.addEventListener('click', () => {
        if (v.emotions.includes(e)) v.emotions = v.emotions.filter(x => x !== e);
        else { if (v.emotions.length >= 2) { toast('Не больше двух эмоций'); return; } v.emotions = v.emotions.concat(e); }
        b.classList.toggle('on', v.emotions.includes(e)); b.setAttribute('aria-pressed', String(v.emotions.includes(e))); beep('tick'); ctx.save(v);
      });
      grid.append(b);
    });
    box.append(el('div', { class: 'eyebrow' }, 'Что ты чувствовал? Одна-две кнопки'), grid);
    [['like', 'Нравится', 'Что было лучше всего?'], ['want', 'Хочется', 'Чего не хватило?'], ['whatif', 'А что если', 'Одна смелая идея для версии 2']].forEach(([k, label, hint]) =>
      box.append(fieldEditor({ id: k, label, hint, deck: decks[k] }, v[k], nv => { v[k] = nv; ctx.save(v); }, { idPrefix: st.id })));
    const send = el('button', { class: 'btn', type: 'button' }, v.sent ? 'Отправить заново' : 'Отправить автору');
    send.addEventListener('click', async () => {
      if (!v.emotions.length) { toast('Нажми хотя бы одну эмоцию'); return; }
      const missing = [['like', 'Нравится'], ['want', 'Хочется'], ['whatif', 'А что если']].filter(([k]) => !valText(v[k]));
      if (missing.length) { toast('Заполни: ' + missing.map(m => m[1]).join(', ')); return; }
      send.disabled = true;
      try { await api('/api/playtest', { game: v.game, card: { emotions: v.emotions, like: v.like, want: v.want, whatif: v.whatif } }); v.sent = true; ctx.save(v, true, true); toast('Отзыв ушёл автору', 'ok'); send.textContent = 'Отправить заново'; }
      catch (e) { toast(e.message, 'err'); }
      send.disabled = false;
    });
    box.append(el('div', { class: 'row' }, send, v.sent ? el('span', { class: 'tag ok' }, 'отправлено') : null));
    return box;
  }
  async function drawMine() {
    let r;
    try { r = await api('/api/playtest/mine'); } catch (e) { mineHost.innerHTML = ''; mineHost.append(el('p', { class: 'err' }, e.message)); return; }
    S.me.feedback = r.feedback;
    mineHost.innerHTML = '';
    mineHost.append(el('div', { class: 'row' }, el('h3', { class: 'grow' }, r.game ? `Твоя игра «${r.game.title}» глазами класса` : 'Твоя игра глазами класса'),
      el('button', { class: 'btn ghost small', type: 'button', onclick: drawMine }, '↻ Обновить')));
    if (!r.game) mineHost.append(el('p', { class: 'muted' }, 'Ты ещё не собрал игру — открытие плейтеста появится, когда в неё сыграют соседи.'));
    else {
      mineHost.append(Games.discovery(r.discovery));
      if (r.juice) mineHost.append(el('p', { class: 'concept' }, el('b', {}, 'Слепая проба сочности твоей игры. '),
        `Вернуться в сочную захотели ${r.juice.juicy}, в сухую — ${r.juice.dry}, разницы не почувствовали ${r.juice.same}. `,
        r.juice.juicy > r.juice.dry + r.juice.same ? 'Сочность работает.' : 'Сочность пока не тянет назад: может, эффекты мешают видеть главное или их мало?'));
      // открытие плейтеста — повод для решения: проверить ручкой (без ИИ) или попросить программиста
      const go = type => { const cp = S.lesson.checkpoints.find(c => c.steps.some(x => x.type === type)); return cp ? () => { S.cpId = cp.id; render(); const sx = cp.steps.find(x => x.type === type); setTimeout(() => { const n = document.getElementById('step-' + sx.id); if (n) n.scrollIntoView({ block: 'start' }); }, 50); } : null; };
      const toKnob = go('experiment'), toCoder = go('workshop');
      if (r.discovery && r.discovery.rounds && (toKnob || toCoder)) mineHost.append(el('div', { class: 'row' }, el('span', { class: 'small' }, el('b', {}, 'Что сделаешь с открытием?')),
        toKnob ? el('button', { class: 'btn ghost small', type: 'button', 'data-act': 'knob', onclick: toKnob }, '🎚 Проверю ручкой') : null,
        toCoder ? el('button', { class: 'btn ghost small', type: 'button', 'data-act': 'coder', onclick: toCoder }, '🛠 Попрошу программиста') : null));
    }
    // predict: что автор предсказал в Фабрике (удовольствие, динамика) — рядом с тем, что телеметрия увидела у соседей
    const pred = (st.predict || []).map(p => [p.label, valText((((ans(p.step).value || {}).fields) || {})[p.field])]).filter(p => p[1]);
    if (r.game && pred.length) mineHost.append(el('div', { class: 'secret-reveal' }, el('div', { class: 'eyebrow' }, st.predictTitle || 'Твоё предсказание из Фабрики — совпало с тем, что делали соседи?'),
      el('ul', {}, pred.map(([label, text]) => el('li', {}, el('b', {}, label + ': '), text)))));
    // слепая пара с секретом: сколько соседей почувствовали секрет автора вслепую
    if (r.game && r.blind && r.blind.voted) mineHost.append(el('p', { class: 'verdict ' + (r.blind.felt * 2 >= r.blind.voted ? 'good' : 'bad') },
      `Слепая пара: твой секрет почувствовали ${r.blind.felt} из ${r.blind.voted}.` + (r.blind.felt * 2 >= r.blind.voted ? ' Секрет работает!' : ' Секрет пока слабый — усиль его правкой или ручкой «Секрет».')));
    mineHost.append(Games.feedback(r.feedback));
  }
  const cardHost = el('div');
  const redrawCard = () => { cardHost.innerHTML = ''; cardHost.append(drawCard()); };
  S.hooks.push((kind, d) => {
    if (kind === 'picked') redrawCard();
    if (kind === 'feedback' || (kind === 'arcade' && d.author === S.me.nick)) drawMine();
  });
  redrawCard();
  host.append(cardHost, el('hr', { class: 'sep' }), mineHost);
  mineHost.append(el('p', { class: 'muted small' }, 'Загружаем открытие плейтеста…'));
  drawMine();
  return host;
};

// cycle: квиз «Собери цикл». У каждой игры четыре карточки: три — её основной цикл, четвёртая — из другой игры.
// Собери цикл по порядку: действие → результат → награда или новая задача → и снова действие. Таймер на раунд, серия, звук,
// клавиши 1–4 или ← → и пробел, геймпад (крестовина и A), тап. Ошибка — подсказка; время вышло — цикл показывается сам. После раунда — разбор.
STEPS.cycle = ctx => {
  const st = ctx.step, slots = st.slots || ['Действие', 'Результат', 'Награда или новая задача'];
  const box = el('div', { class: 'rounds cycle', tabindex: '0', 'aria-label': 'Квиз «Собери цикл»' });
  let order = [], i = 0, cards = [], filled = 0, cur = 0, left = 0, errs = 0, phase = 'intro', raf = 0, padPrev = {};
  let score = 0, streak = 0, bestStreak = 0, perfect = 0, mistakes = [], slotEls = [], cardEls = [];
  const hud = el('div', { class: 'hud' }), timer = el('div', { class: 'timer' }, el('i')), name = el('h3', { class: 'cyc-game' });
  const ring = el('div', { class: 'cyc-ring' }), deck = el('div', { class: 'cyc-cards' }), why = el('div', { class: 'why', 'aria-live': 'polite' });
  const nextBtn = el('button', { type: 'button', class: 'btn', hidden: true, onclick: () => press('next') }, 'Дальше ▶');
  const shuffle = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
  const round = () => st.rounds[order[i]];
  function intro() {
    phase = 'intro'; cancelAnimationFrame(raf); box.innerHTML = '';
    const prev = ctx.value;
    box.append(el('div', { class: 'stack', style: 'align-items:center;text-align:center;margin:auto' },
      el('div', { class: 'cyc-ring demo' }, slots.map((s, k) => [el('div', { class: 'cyc-slot on' }, el('small', {}, `${k + 1}`), el('b', {}, s)), el('span', { class: 'cyc-arrow' }, k < slots.length - 1 ? '→' : '↻')]).flat()),
      el('h3', {}, `${st.rounds.length} игр · ${st.seconds} секунд на каждую`),
      el('p', { class: 'muted' }, 'Нажимай карточки по порядку цикла. Одна карточка — из другой игры: не попадись. Клавиши 1–4, стрелки и пробел, на геймпаде — крестовина и A.'),
      prev && prev.total ? el('p', {}, `Твой результат: ${prev.perfect} из ${prev.total} без ошибок, очки ${prev.score}`) : null,
      el('button', { class: 'btn', type: 'button', onclick: begin }, prev && prev.total ? 'Сыграть ещё раз' : '▶ Начать')));
  }
  function begin() {
    order = shuffle(st.rounds.map((x, k) => k)); i = 0; score = 0; streak = 0; bestStreak = 0; perfect = 0; mistakes = [];
    box.innerHTML = ''; box.append(hud, timer, name, ring, deck, why, el('div', { class: 'row', style: 'justify-content:center' }, nextBtn)); box.focus();
    show();
    let last = performance.now();
    const loop = t => {
      if (phase === 'intro' || phase === 'end') return;
      const dt = (t - last) / 1000; last = t;
      if (phase === 'ask') { left -= dt; if (left <= 0) finishRound(false); }
      timer.firstChild.style.width = Math.max(0, 100 * left / st.seconds) + '%';
      pollPad();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }
  function show() {
    if (i >= order.length) return finish();
    const r = round();
    phase = 'ask'; left = st.seconds; filled = 0; errs = 0; cur = 0;
    cards = shuffle(r.cards.map((text, slot) => ({ text, slot })).concat({ text: r.decoy, slot: -1 }));
    name.textContent = (r.icon ? r.icon + ' ' : '') + r.game;
    ring.innerHTML = ''; ring.classList.remove('closed');
    slotEls = slots.map((s, k) => el('div', { class: 'cyc-slot' }, el('small', {}, `${k + 1}. ${s}`), el('b', {}, '?')));
    slotEls.forEach((e, k) => ring.append(e, el('span', { class: 'cyc-arrow' }, k < slots.length - 1 ? '→' : '↻')));
    deck.innerHTML = '';
    cardEls = cards.map((c, k) => el('button', { type: 'button', class: 'opt cyc-card', onclick: () => pick(k) }, el('kbd', {}, String(k + 1)), c.text));
    deck.append(...cardEls);
    why.textContent = ''; nextBtn.hidden = true; mark();
    hud.innerHTML = ''; hud.append(el('span', {}, `${i + 1} / ${order.length}`), el('span', { class: 'streak' }, streak > 1 ? `серия ×${streak}` : ''), el('span', {}, `очки ${score}`));
    box.focus({ preventScroll: true });
  }
  const mark = () => { cardEls.forEach((b, k) => b.classList.toggle('cur', k === cur)); slotEls.forEach((s, k) => s.classList.toggle('next', k === filled && phase === 'ask')); };
  function pick(k) {
    if (phase !== 'ask') return;
    const c = cards[k];
    if (!c || c.used) return;
    if (c.slot === filled) {
      c.used = true; cardEls[k].classList.add('used'); cardEls[k].disabled = true;
      slotEls[filled].classList.add('on'); slotEls[filled].querySelector('b').textContent = c.text;
      filled++; beep('good');
      if (filled === slots.length) return finishRound(true);
      cur = cards.findIndex(x => !x.used); mark();
      return;
    }
    errs++; beep('bad');
    cardEls[k].classList.remove('bad'); void cardEls[k].offsetWidth; cardEls[k].classList.add('bad');
    why.textContent = c.slot < 0 ? `Эта карточка из другой игры${round().decoyFrom ? ': ' + round().decoyFrom : ''}. Кубик из другой игры ломает цикл.` : `Не по порядку: сейчас нужен шаг «${slots[filled]}».`;
  }
  function finishRound(ok) {
    if (phase !== 'ask') return;
    phase = 'why';
    const r = round(), clean = ok && !errs;
    slotEls.forEach((s, k) => { if (!s.classList.contains('on')) { s.classList.add('on', 'miss'); s.querySelector('b').textContent = r.cards[k]; } });
    cardEls.forEach((b, k) => { b.disabled = true; if (cards[k].slot < 0) b.classList.add('decoy'); });
    ring.classList.add('closed');
    if (clean) { streak++; perfect++; bestStreak = Math.max(bestStreak, streak); } else { streak = 0; mistakes.push(r.game + (ok ? ` (ошибок: ${errs})` : ' (время вышло)')); }
    const pts = ok ? Math.max(10, 100 + Math.round(left * 10) - 40 * errs) * Math.max(1, Math.min(streak, 3)) : 0;
    score += pts; beep(clean ? 'done' : ok ? 'tick' : 'bad');
    why.innerHTML = '';
    why.append(el('b', {}, clean ? `Цикл собран! +${pts}. ` : ok ? `Собран с ошибками: +${pts}. ` : 'Время вышло. '), r.why || '');
    hud.querySelector('.streak').textContent = streak > 1 ? `серия ×${streak}` : ''; hud.lastChild.textContent = `очки ${score}`;
    nextBtn.hidden = false; nextBtn.textContent = i + 1 >= order.length ? 'Итог ▶' : 'Дальше ▶';
    box.focus({ preventScroll: true });
  }
  function press(what) {
    if (phase === 'ask') {
      if (what === 'left' || what === 'right') { const free = cards.map((c, k) => k).filter(k => !cards[k].used); if (!free.length) return; const at = Math.max(0, free.indexOf(cur)); cur = free[(at + (what === 'right' ? 1 : free.length - 1)) % free.length]; mark(); }
      else if (what === 'next') pick(cur);
      else if (typeof what === 'number') pick(what);
    } else if (phase === 'why' && what === 'next') { i++; show(); }
  }
  function pollPad() {
    let pads = []; try { pads = [...navigator.getGamepads()].filter(Boolean); } catch (e) { return; }
    const gp = pads[0]; if (!gp) return;
    const b = k => !!(gp.buttons[k] && gp.buttons[k].pressed), ax = gp.axes[0] || 0;
    const now = { left: b(14) || ax < -0.6, right: b(15) || ax > 0.6, next: b(0) };
    for (const k of Object.keys(now)) { if (now[k] && !padPrev[k]) press(k); padPrev[k] = now[k]; }
  }
  function finish() {
    phase = 'end'; cancelAnimationFrame(raf);
    const v = { score, perfect, total: order.length, bestStreak, mistakes };
    ctx.save(v, true);
    box.innerHTML = '';
    const result = `Квиз «${st.title}»: ${perfect} из ${order.length} циклов без ошибок, ${score} очков, серия ${bestStreak}.` + (mistakes.length ? ' Трудно было: ' + mistakes.join('; ') : '');
    box.append(el('div', { class: 'stack', style: 'align-items:center;text-align:center;margin:auto' },
      el('div', { class: 'eyebrow' }, 'Итог'), el('h2', {}, `${perfect} из ${order.length} без ошибок · ${score} очков`),
      el('p', { class: 'muted' }, `Лучшая серия: ${bestStreak}`),
      mistakes.length ? el('div', { class: 'small', style: 'text-align:left' }, el('b', {}, 'Трудно было:'), el('ul', {}, mistakes.map(m => el('li', {}, m)))) : el('p', {}, 'Все циклы — без ошибок!'),
      el('div', { class: 'row', style: 'justify-content:center' },
        el('button', { class: 'btn', type: 'button', onclick: begin }, 'Ещё раз'),
        el('button', { class: 'btn ghost', type: 'button', onclick: () => copy(result) }, '⧉ Скопировать результат'))));
  }
  box.addEventListener('keydown', e => {
    if (phase === 'intro' || phase === 'end') return;
    const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
    const k = m ? Number(m[1]) - 1 : { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'next', Enter: 'next', NumpadEnter: 'next' }[e.code];
    if (k != null) { e.preventDefault(); press(k); }
  });
  intro();
  return box;
};

// blind: слепой турнир по одной ручке. В каждом раунде у ремейка повёрнута одна ручка (или включён один эффект) —
// ученик играет в «Загадку», сравнивает с «Как задумано» и угадывает, что изменилось. Поле cfg — общая основа всех раундов,
// rounds — [{ cfg, answer, why }], options — подписи ответов (на раунд берутся верный и ещё choices − 1), seconds — сколько играть до ответа,
// baseLabel — подпись вкладки с основой (по умолчанию «Как задумано»).
STEPS.blind = ctx => {
  const st = ctx.step, need = st.seconds || 6, choices = st.choices || 4;
  const host = el('div', { class: 'stack blind' });
  let v = Object.assign({ i: 0, picks: [] }, ctx.value), tab = 'mystery', h = null, played = 0, tick = null, auto = false;
  const round = () => st.rounds[v.i];
  const optsOf = r => { // верный ответ и ещё несколько — у ученика в раунде всегда одни и те же
    const others = st.options.filter(o => o !== r.answer).sort((a, b) => hashStr(S.me.nick + a) - hashStr(S.me.nick + b)).slice(0, choices - 1);
    return others.concat(r.answer).sort((a, b) => hashStr(v.i + a) - hashStr(v.i + b));
  };
  function draw() {
    clearInterval(tick); if (h) { h.destroy(); h = null; }
    host.innerHTML = '';
    if (v.i >= st.rounds.length) return finish();
    const r = round(), done = v.picks[v.i];
    const wait = el('p', { class: 'muted', 'aria-live': 'polite' });
    const btns = optsOf(r).map(o => el('button', { type: 'button', class: 'opt' + (done && o === r.answer ? ' on' : ''), disabled: !!done,
      onclick: () => { if (played < need) return; const ok = o === r.answer; v.picks[v.i] = { text: r.answer, chose: o, ok, right: r.answer }; beep(ok ? 'good' : 'bad'); ctx.save(v, null, true); draw(); } }, o));
    const ready = () => { wait.textContent = done || played >= need ? '' : `Поиграй в загадку ещё ${need - played} с — потом выбирай.`; btns.forEach(b => b.classList.toggle('dim', !done && played < need)); };
    const tabs = el('div', { class: 'seg', role: 'tablist' }, [['mystery', '❓ Загадка'], ['base', st.baseLabel || 'Как задумано']].map(([k, label]) =>
      el('button', { type: 'button', role: 'tab', class: 'opt' + (tab === k ? ' on' : ''), 'aria-selected': String(tab === k), onclick: () => { if (tab !== k) { tab = k; auto = true; beep('tick'); draw(); } } }, el('b', {}, label))));
    h = Games.frame({
      src: () => '/engine/game.html?game=../' + st.game, key: () => 'remake:' + st.id, score: false, autostart: auto,
      cfg: Object.assign({}, st.cfg, tab === 'mystery' ? r.cfg : null), label: tab === 'mystery' ? 'Играть: загадка' : 'Играть: как задумано',
      onReady: () => { if (tab !== 'mystery' || done) return; clearInterval(tick); tick = setInterval(() => { played++; ready(); if (played >= need) clearInterval(tick); }, 1000); },
    });
    ready();
    host.append(el('div', { class: 'hud' }, el('span', {}, `Загадка ${v.i + 1} из ${st.rounds.length}`), el('span', {}, `угадано ${v.picks.filter(p => p && p.ok).length}`)),
      tabs, h.box, Games.bar(h), el('div', { class: 'eyebrow' }, st.question || 'Что изменилось?'), wait, el('div', { class: 'opts' }, btns));
    if (done) host.append(el('p', { class: 'verdict ' + (done.ok ? 'good' : 'bad') }, done.ok ? `Верно: ${r.answer}.` : `Нет, изменилось другое: ${r.answer}.`),
      r.why ? el('p', { class: 'concept' }, r.why) : '',
      el('div', {}, el('button', { class: 'btn', type: 'button', onclick: () => { v.i++; played = 0; tab = 'mystery'; auto = true; ctx.save(v, null, true); draw(); } }, v.i + 1 < st.rounds.length ? 'Следующая загадка ▶' : 'Итог ▶')));
  }
  function finish() {
    const ok = v.picks.filter(p => p && p.ok).length;
    v = Object.assign(v, { correct: ok, total: st.rounds.length, mistakes: v.picks.filter(p => p && !p.ok).map(p => `${p.right} (выбрал: ${p.chose})`) });
    if (!ctx.done) ctx.save(v, true, true);
    host.append(el('div', { class: 'stack', style: 'align-items:center;text-align:center' },
      el('div', { class: 'eyebrow' }, 'Итог'), el('h2', {}, `Угадано ${ok} из ${st.rounds.length}`),
      v.mistakes.length ? el('div', { class: 'small', style: 'text-align:left' }, el('b', {}, 'Не почувствовал:'), el('ul', {}, v.mistakes.map(m => el('li', {}, m)))) : el('p', {}, 'Ты почувствовал каждую ручку!'),
      st.after ? el('p', { class: 'concept' }, st.after) : null,
      el('button', { class: 'btn ghost', type: 'button', onclick: () => { v = { i: 0, picks: [] }; played = 0; tab = 'mystery'; auto = false; ctx.save(v, null, true); draw(); } }, 'Пройти заново')));
  }
  draw();
  return host;
};

// blindpair: слепая проба игры соседа — две одинаковые на вид копии «А» и «Б», в одной выключены все 12 переключателей сочности
// оболочки (ручки j_…). В какой копии сухо, решает хеш ника и игры. По партии в каждую (minRounds), потом голос «куда хочется вернуться».
// about — id шага arcade: берётся игра соседа оттуда, иначе — сосед по кругу.
// mode: 'secret' — вместо сочности выключается секрет автора (ручка knob его игры, обычно secret = 0): голос «где напряжённее»,
// автор в плейтесте видит, сколько соседей почувствовали его секрет вслепую (урок 1)
const DRY = Object.fromEntries(['hitstop', 'shake', 'squash', 'burst', 'flash', 'whiten', 'popup', 'sound', 'pitch', 'vibrate', 'glow', 'slowmo'].map(k => ['j_' + k, 0]));
STEPS.blindpair = ctx => {
  const st = ctx.step, need = st.minRounds || 1;
  const host = el('div', { class: 'stack' });
  let data = null, cur = null, pick = 'A';
  async function load() {
    try { data = await api('/api/arcade'); } catch (e) { host.innerHTML = ''; host.append(el('p', { class: 'err' }, e.message)); return; }
    draw();
  }
  function gameOf() {
    const id = (st.about && (ans(st.about).value || {}).game) || (ctx.value || {}).game;
    return (id && data.games.find(g => g.id === id && !g.mine)) || data.neighbour;
  }
  function draw() {
    if (cur) { cur.destroy(); cur = null; }
    host.innerHTML = '';
    const g = gameOf();
    if (!g) {
      host.append(el('div', { class: 'locked-msg card' }, el('h3', {}, 'Ждём игру соседа'), el('p', { style: 'margin-top:6px' }, 'Как только одноклассник соберёт игру, она появится здесь.'),
        el('div', { style: 'margin-top:12px' }, el('button', { class: 'btn ghost small', type: 'button', onclick: load }, '↻ Проверить'))));
      return;
    }
    let v = Object.assign({}, ctx.value);
    if (v.game !== g.id) v = { game: g.id, title: g.title, author: g.nick, dry: hashStr(S.me.nick + g.id) % 2 ? 'B' : 'A', A: 0, B: 0, vote: null };
    const name = k => (k === 'A' ? 'А' : 'Б'), ready = v.A >= need && v.B >= need;
    const secretMode = st.mode === 'secret';
    if (secretMode && !g.knob) { // игру собрали без карты секрета: сравнивать нечего
      host.append(el('div', { class: 'donor-card' }, el('div', { class: 'ico' }, '🕹'), el('div', {}, el('div', { class: 'eyebrow' }, `Игра соседа · автор ${g.nick}`), el('h3', {}, g.title || 'Игра'))),
        el('p', { class: 'muted' }, 'В этой игре нет ручки секрета: её собрали без карты секрета. Слепую пару пропускаем.'),
        el('div', {}, el('button', { class: 'btn', type: 'button', onclick: () => { ctx.save({ game: g.id, title: g.title, author: g.nick, noSecret: true }, true, true); } }, 'Дальше')));
      return;
    }
    const OFF = secretMode ? { [g.knob]: 0 } : DRY;
    const tabs = el('div', { class: 'seg ab-tabs', role: 'tablist' }, ['A', 'B'].map(k => el('button', { type: 'button', role: 'tab', class: 'opt ab-' + k + (pick === k ? ' on' : ''), 'aria-selected': String(pick === k),
      onclick: () => { if (pick !== k) { pick = k; beep('tick'); draw(); } } }, el('b', {}, 'Игра ' + name(k)), el('span', { class: 'small muted' }, ` · партий ${v[k]}` + (v[k] < need ? ` из ${need}` : ' ✓')))));
    cur = Games.frame({
      src: () => `/play/${g.id}/${g.version}`, key: () => 'game:' + g.id, score: false, cfg: pick === v.dry ? OFF : null, label: 'Играть: игра ' + name(pick),
      onOver: () => { v[pick]++; ctx.save(v); if (v.A >= need && v.B >= need && !ready) draw(); else tabs.querySelector('.ab-' + pick + ' .small').textContent = ` · партий ${v[pick]}` + (v[pick] < need ? ` из ${need}` : ' ✓'); },
      onError: err => cur.message(el('b', {}, 'Игра соседа упала: ' + (err.message || 'ошибка'))),
    });
    const juicy = v.dry === 'A' ? 'B' : 'A';
    const ask = secretMode ? (v.vote ? el('div', { class: 'stack' },
      el('p', { class: 'verdict ' + (v.vote === juicy ? 'good' : 'bad') }, v.vote === 'same' ? 'Ты не почувствовал разницы.' : `Тебе было напряжённее в игре ${name(v.vote)}.`),
      el('div', { class: 'secret-reveal' }, el('div', { class: 'eyebrow' }, 'Раскрытие'), el('h3', {}, `Секрет был в игре ${name(juicy)}`),
        el('p', {}, v.vote === juicy ? 'Ты почувствовал секрет соседа вслепую. Значит, его решение работает!' : v.vote === 'same' ? 'Секрет соседа ты не почувствовал. Подскажи ему в плейтесте: может, секрет слишком слабый?' : 'Ты выбрал копию без секрета. Бывает: напряжение делает не только секрет.')),
      st.after ? el('p', { class: 'concept' }, st.after) : null)
      : ready ? el('div', { class: 'stack' }, el('div', { class: 'eyebrow' }, st.question || 'В какой копии было напряжённее?'),
        el('div', { class: 'opts' }, [['A', 'В игре А'], ['B', 'В игре Б'], ['same', 'Разницы нет']].map(([k, label]) => el('button', { type: 'button', class: 'opt', onclick: () => { v.vote = k; v.felt = k === juicy; beep('good'); ctx.save(v, true, true); draw(); } }, label))))
        : el('p', { class: 'muted' }, `Сыграй ${need === 1 ? 'партию' : need + ' партии'} в каждую копию — потом появится вопрос.`))
    : v.vote ? el('div', { class: 'stack' },
      el('p', { class: 'verdict ' + (v.vote === juicy ? 'good' : 'bad') }, v.vote === 'same' ? 'Ты не почувствовал разницы.' : `Тебе хочется вернуться в игру ${name(v.vote)}.`),
      el('div', { class: 'secret-reveal' }, el('div', { class: 'eyebrow' }, 'Раскрытие'), el('h3', {}, `Сухой была игра ${name(v.dry)}`),
        el('p', {}, `В ней выключены все 12 переключателей сочности: стоп-кадр, тряска, частицы, вспышки, звук и остальные. Механика та же — счёт, скорость, правила. ${v.vote === juicy ? 'Ты выбрал сочную: сочность и правда тянет вернуться.' : v.vote === 'same' ? 'Значит, в этой игре сочности пока мало — подскажи автору в плейтесте.' : 'Ты выбрал сухую — интересно! Может, эффекты в этой игре мешают видеть главное?'}`)),
      st.after ? el('p', { class: 'concept' }, st.after) : null)
      : ready ? el('div', { class: 'stack' }, el('div', { class: 'eyebrow' }, st.question || 'Куда хочется вернуться?'),
        el('div', { class: 'opts' }, [['A', 'В игру А'], ['B', 'В игру Б'], ['same', 'Разницы нет']].map(([k, label]) => el('button', { type: 'button', class: 'opt', onclick: () => { v.vote = k; v.juicy = k === juicy; beep('good'); ctx.save(v, true, true); draw(); } }, label))))
        : el('p', { class: 'muted' }, `Сыграй ${need === 1 ? 'партию' : need + ' партии'} в каждую копию — потом появится вопрос.`);
    host.append(el('div', { class: 'donor-card' }, el('div', { class: 'ico' }, '🕹'), el('div', {}, el('div', { class: 'eyebrow' }, `Игра соседа · автор ${g.nick}`), el('h3', {}, g.title || 'Игра'))),
      tabs, cur.box, Games.bar(cur), ask);
  }
  S.hooks.push(kind => { if (kind === 'arcade' && data && !gameOf()) load(); });
  host.append(el('p', { class: 'muted' }, 'Ищем игру соседа…'));
  load();
  return host;
};

// vote: выставка джема (урок 8). Игры класса этого урока карточками: сыграй, потом голосуй в номинациях
// (только за игры, в которые сыграл, не за свою). После голоса — итоги класса и игра кнопочного турнира: победитель номинации tournament.
STEPS.vote = ctx => {
  const st = ctx.step, need = st.minGames || 2;
  const host = el('div', { class: 'stack vote' });
  let data = null, cur = null, tally = null;
  let v = Object.assign({ played: {}, votes: null }, ctx.value);
  const games = () => data.games.filter(g => !g.mine && g.lesson && g.lesson.id === S.lesson.id);
  async function load() {
    try { data = await api('/api/arcade'); } catch (e) { host.innerHTML = ''; host.append(el('p', { class: 'err' }, e.message)); return; }
    if (v.votes) await loadTally();
    draw();
  }
  async function loadTally() { try { tally = await api('/api/votes?step=' + encodeURIComponent(st.id)); } catch (e) { tally = null; } }
  function play(g, box) {
    if (cur) cur.destroy();
    cur = Games.frame({ src: () => `/play/${g.id}/${g.version}`, key: () => 'game:' + g.id, info: () => ({ version: g.version }), label: 'Играть: ' + (g.title || 'игра'), autostart: true,
      onOver: () => { v.played[g.id] = (v.played[g.id] || 0) + 1; ctx.save(v); drawVote(); },
      onError: err => cur.message(el('b', {}, 'Игра упала: ' + (err.message || 'ошибка') + '. Возьми другую.')) });
    box.innerHTML = ''; box.append(el('h3', {}, `${g.title || 'Игра'} · ${g.nick}`), cur.box, Games.bar(cur));
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  const voteBox = el('div', { class: 'stack' });
  function drawVote() {
    voteBox.innerHTML = '';
    const list = games(), played = list.filter(g => v.played[g.id]);
    if (v.votes) {
      voteBox.append(el('div', { class: 'eyebrow' }, 'Твои голоса'),
        el('ul', {}, st.nominations.map(n => { const g = list.find(x => x.id === v.votes[n.id]); return el('li', {}, el('b', {}, n.label + ': '), g ? `${g.title} (${g.nick})` : '—'); })));
      if (tally && !tally.hidden) {
        const cup = tally.noms.find(n => n.id === st.tournament), win = cup && cup.top[0];
        voteBox.append(el('div', { class: 'eyebrow' }, `Итоги класса · проголосовали ${tally.voters}`),
          el('div', { class: 'vote-noms' }, tally.noms.map(n => el('div', { class: 'card vote-nom' }, el('b', {}, n.label),
            n.top.length ? el('ol', {}, n.top.slice(0, 3).map(t => el('li', {}, `${t.title} — ${t.nick} · ${t.votes}`))) : el('p', { class: 'muted small' }, 'голосов нет')))),
          win ? el('p', { class: 'concept' }, `Игра кнопочного турнира — «${win.title}» (${win.nick}): победитель номинации «${cup.label}». Турнир идёт на проекторе: каждый играет одну партию.`) : '');
      }
      voteBox.append(el('div', { class: 'row' }, el('button', { class: 'btn ghost small', type: 'button', onclick: async () => { await loadTally(); drawVote(); } }, '↻ Обновить итоги'),
        el('button', { class: 'btn ghost small', type: 'button', onclick: () => { v.votes = null; tally = null; ctx.save(v); drawVote(); } }, 'Изменить голоса')));
      return;
    }
    const n = Math.min(need, list.length);
    if (played.length < n) { voteBox.append(el('p', { class: 'muted' }, `Сыграй хотя бы в ${n === 1 ? 'одну игру' : n + ' игры'} класса — потом откроется голосование. Сыграно: ${played.length}.`)); return; }
    const pick = {};
    voteBox.append(el('div', { class: 'eyebrow' }, 'Голосуй: за свою игру нельзя, только за те, в которые сыграл'));
    st.nominations.forEach(n => {
      const sel = el('select', { id: 'vote-' + n.id, 'aria-label': n.label, onchange: () => { pick[n.id] = sel.value; } },
        el('option', { value: '' }, '— выбери игру —'), played.map(g => el('option', { value: g.id }, `${g.title || 'Игра'} · ${g.nick}`)));
      voteBox.append(el('label', { class: 'vote-row' }, el('span', {}, el('b', {}, n.label), n.hint ? el('span', { class: 'small muted' }, ' · ' + n.hint) : null), sel));
    });
    voteBox.append(el('div', {}, el('button', { class: 'btn', type: 'button', onclick: async () => {
      if (st.nominations.some(n => !pick[n.id])) { toast('Выбери игру в каждой номинации'); return; }
      v.votes = Object.assign({}, pick); ctx.save(v, true, true); beep('done');
      await loadTally(); drawVote();
    } }, '🏆 Отдать голоса')));
  }
  function draw() {
    if (cur) { cur.destroy(); cur = null; }
    host.innerHTML = '';
    const list = games();
    if (!list.length) {
      host.append(el('div', { class: 'locked-msg card' }, el('h3', {}, 'Ждём игры класса'), el('p', { style: 'margin-top:6px' }, 'Как только одноклассники соберут игры джема, они появятся здесь.'),
        el('div', { style: 'margin-top:12px' }, el('button', { class: 'btn ghost small', type: 'button', onclick: load }, '↻ Проверить'))));
      return;
    }
    const stage = el('div', { class: 'stack' });
    host.append(el('div', { class: 'agrid' }, list.map(g => Games.card(g, { compact: true, actions: [el('button', { class: 'btn small', type: 'button', onclick: () => play(g, stage) }, (v.played[g.id] ? '✓ ' : '▶ ') + 'Играть')] }))), stage, voteBox);
    drawVote();
  }
  S.hooks.push(kind => { if (kind === 'arcade' && data && !v.votes) load(); });
  host.append(el('p', { class: 'muted' }, 'Собираем выставку…'));
  load();
  return host;
};

// звук шагов listen и sequencer: тон и шум по рецепту, как lab.tone и lab.noise в оболочке
const Snd = (() => {
  let AC = null, nb = null;
  const ac = () => {
    if (!AC) { AC = new (window.AudioContext || window.webkitAudioContext)(); nb = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  };
  function play(list, at = 0) {
    let c; try { c = ac(); } catch (e) { return; }
    for (const x of list) {
      try {
        const t = c.currentTime + at + (x.at || 0), g = c.createGain();
        g.gain.setValueAtTime(x.v || 0.1, t); g.gain.exponentialRampToValueAtTime(0.0001, t + x.d); g.connect(c.destination);
        if (x.noise) { const s = c.createBufferSource(), f = c.createBiquadFilter(); s.buffer = nb; f.type = 'lowpass'; f.frequency.value = x.freq || 1000; s.connect(f); f.connect(g); s.start(t); s.stop(t + x.d + 0.02); continue; }
        const o = c.createOscillator(); o.type = x.w || 'square'; o.frequency.setValueAtTime(Math.max(20, x.f), t);
        if (x.s) o.frequency.exponentialRampToValueAtTime(Math.max(20, x.s), t + x.d);
        o.connect(g); o.start(t); o.stop(t + x.d + 0.02);
      } catch (e) { /* звук не критичен */ }
    }
  }
  return { play, now: () => { try { return ac().currentTime; } catch (e) { return 0; } } };
})();

// listen: квиз «Угадай по звуку» (урок 7). Звук раунда — рецепт из тонов и шума (`sound`), ученик слушает (▶ или пробел)
// и выбирает, что случилось в игре: верный ответ и ещё choices − 1 из options. Клавиши 1–4, серия, итог.
STEPS.listen = ctx => {
  const st = ctx.step, choices = st.choices || 4;
  const box = el('div', { class: 'rounds listen', tabindex: '0', 'aria-label': 'Квиз «' + st.title + '»' });
  let order = [], i = 0, opts = [], phase = 'intro', score = 0, streak = 0, bestStreak = 0, correct = 0, picks = [], mistakes = [];
  const shuffle = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
  const round = () => st.rounds[order[i]];
  function intro() {
    phase = 'intro'; box.innerHTML = '';
    const prev = ctx.value;
    box.append(el('div', { class: 'stack', style: 'align-items:center;text-align:center;margin:auto' },
      el('div', { class: 'big' }, '🔊'), el('h3', {}, `${st.rounds.length} звуков`),
      el('p', { class: 'muted' }, 'Включи звук. Пробел — послушать ещё раз, клавиши 1–4 — ответ.'),
      prev && prev.total ? el('p', {}, `Твой результат: ${prev.correct} из ${prev.total}, очки ${prev.score}`) : null,
      el('button', { class: 'btn', type: 'button', onclick: begin }, prev && prev.total ? 'Сыграть ещё раз' : '▶ Начать')));
  }
  function begin() { order = shuffle(st.rounds.map((x, k) => k)); i = 0; score = 0; streak = 0; bestStreak = 0; correct = 0; picks = []; mistakes = []; show(); }
  function show() {
    if (i >= order.length) return finish();
    phase = 'ask';
    const r = round();
    opts = shuffle(shuffle(st.options.filter(o => o !== r.answer)).slice(0, choices - 1).concat(r.answer));
    box.innerHTML = '';
    box.append(el('div', { class: 'hud' }, el('span', {}, `${i + 1} / ${order.length}`), el('span', { class: 'streak' }, streak > 1 ? `серия ×${streak}` : ''), el('span', {}, `очки ${score}`)),
      el('div', { style: 'text-align:center' }, el('button', { class: 'btn big-play', type: 'button', onclick: () => Snd.play(r.sound) }, '▶ Послушать')),
      el('div', { class: 'opts' }, opts.map((o, k) => el('button', { type: 'button', class: 'opt', onclick: () => answer(k) }, el('kbd', {}, String(k + 1)), ' ', o))),
      el('div', { class: 'why', 'aria-live': 'polite' }));
    box.focus({ preventScroll: true });
    Snd.play(r.sound, 0.15);
  }
  function answer(k) {
    if (phase !== 'ask' || !opts[k]) return;
    phase = 'why';
    const r = round(), ok = opts[k] === r.answer;
    picks.push({ text: r.answer, chose: opts[k], ok, right: r.answer });
    if (ok) { correct++; streak++; bestStreak = Math.max(bestStreak, streak); score += 100 * Math.min(streak, 3); } else { streak = 0; mistakes.push(`${r.answer} (выбрал: ${opts[k]})`); }
    beep(ok ? 'good' : 'bad');
    box.querySelectorAll('.opts .opt').forEach((b, j) => { b.disabled = true; if (opts[j] === r.answer) b.classList.add('on'); else if (j === k) b.classList.add('miss'); });
    const why = box.querySelector('.why'); why.innerHTML = '';
    why.append(el('b', {}, ok ? 'Верно! ' : `Это был звук «${r.answer}». `), r.why || '', ' ',
      el('button', { class: 'btn', type: 'button', onclick: () => { i++; show(); } }, i + 1 >= order.length ? 'Итог ▶' : 'Дальше ▶'));
  }
  function finish() {
    phase = 'end';
    const v = { score, correct, total: order.length, bestStreak, mistakes, picks };
    ctx.save(v, true);
    box.innerHTML = '';
    box.append(el('div', { class: 'stack', style: 'align-items:center;text-align:center;margin:auto' },
      el('div', { class: 'eyebrow' }, 'Итог'), el('h2', {}, `${correct} из ${order.length} · ${score} очков`),
      mistakes.length ? el('div', { class: 'small', style: 'text-align:left' }, el('b', {}, 'Перепутал:'), el('ul', {}, mistakes.map(m => el('li', {}, m)))) : el('p', {}, 'Все звуки узнаны!'),
      el('button', { class: 'btn', type: 'button', onclick: begin }, 'Ещё раз')));
  }
  box.addEventListener('keydown', e => {
    const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
    if (phase === 'ask' && m) { e.preventDefault(); answer(Number(m[1]) - 1); }
    else if (phase === 'ask' && e.code === 'Space') { e.preventDefault(); Snd.play(round().sound); }
    else if (phase === 'why' && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); i++; show(); }
  });
  intro();
  return box;
};

// sequencer: секвенсор мелодии (урок 7). Сетка: колонки — доли (8 тактов по 4), строки — ноты (снизу вверх, notes);
// в колонке одна нота. «Послушать» играет мелодию в темпе bpm, «Пробежать» отдаёт её ремейку в lab.data.melody —
// на каждой ноте встаёт препятствие. Мелодия уходит в черновик ИГРА шаблоном {melody} (plan.melody — id этого шага).
const SEQ_FREQ = [220, 261.6, 293.7, 329.6, 392];
const melodyText = (mel, names) => (mel || []).map(n => (n < 0 ? '—' : names[n])).reduce((a, x, k) => a + (k && k % 4 === 0 ? ' | ' : k ? ' ' : '') + x, '');
STEPS.sequencer = ctx => {
  const st = ctx.step, cols = (st.bars || 8) * 4, names = st.notes || ['ля', 'до', 'ре', 'ми', 'соль'], need = st.minNotes || 8;
  let v = Object.assign({ melody: new Array(cols).fill(-1) }, ctx.value);
  const host = el('div', { class: 'stack seq' });
  let playing = null, h = null;
  const count = () => v.melody.filter(n => n >= 0).length;
  const grid = el('div', { class: 'seq-grid', style: `grid-template-columns:auto repeat(${cols},1fr)` });
  const info = el('div', { class: 'small muted', 'aria-live': 'polite' });
  const cells = [];
  for (let r = names.length - 1; r >= 0; r--) {
    grid.append(el('div', { class: 'seq-name' }, names[r]));
    for (let c = 0; c < cols; c++) {
      const b = el('button', { type: 'button', class: 'seq-cell' + (c % 4 === 0 ? ' bar' : ''), 'aria-label': `доля ${c + 1}, ${names[r]}`, onclick: () => {
        v.melody[c] = v.melody[c] === r ? -1 : r;
        if (v.melody[c] >= 0) Snd.play([{ f: SEQ_FREQ[r] * 2, d: 0.2, w: 'triangle', v: 0.12 }]);
        save(); paint();
      } });
      cells.push({ b, r, c }); grid.append(b);
    }
  }
  function paint(cur = -1) {
    cells.forEach(x => { x.b.classList.toggle('on', v.melody[x.c] === x.r); x.b.classList.toggle('cur', x.c === cur); });
    info.textContent = `Нот: ${count()}` + (count() < need ? ` · нужно хотя бы ${need}` : ' ✓') + ` · ${melodyText(v.melody, names)}`;
  }
  function save() { v.line = melodyText(v.melody, names); ctx.save(v, !ctx.done && count() >= need ? true : null); }
  function listen() {
    stop();
    const beat = 60 / (st.bpm || 112), t0 = 0.1;
    v.melody.forEach((n, c) => {
      Snd.play([{ f: c % 4 ? 120 : 90, d: 0.14, w: 'sine', v: 0.3, s: 40, at: c * beat }, { noise: true, d: 0.03, v: 0.04, freq: 9000, at: c * beat + beat / 2 }], t0);
      if (n >= 0) Snd.play([{ f: SEQ_FREQ[n] * 2, d: 0.22, w: 'triangle', v: 0.11, at: c * beat }], t0);
    });
    const start = performance.now() + t0 * 1000;
    playing = setInterval(() => { const c = Math.floor((performance.now() - start) / 1000 / beat); if (c >= cols) { stop(); return; } paint(c); }, 40);
  }
  function stop() { clearInterval(playing); playing = null; paint(); }
  const run = el('div', { class: 'stack' });
  function runLevel() {
    if (count() < need) { toast(`Поставь хотя бы ${need} нот`); return; }
    stop(); if (h) h.destroy();
    h = Games.frame({ src: () => '/engine/game.html?game=../' + st.game, key: () => 'remake:' + st.id, score: false, autostart: true, data: { melody: v.melody.slice() }, label: 'Пробежать свою мелодию',
      onOver: () => { v.ran = (v.ran || 0) + 1; save(); } });
    run.innerHTML = ''; run.append(h.box, Games.bar(h));
  }
  const presets = (st.presets || []).map(p => el('button', { class: 'btn ghost small', type: 'button', onclick: () => { v.melody = p.melody.slice(0, cols); while (v.melody.length < cols) v.melody.push(-1); beep('dice'); save(); paint(); } }, '🎲 ' + p.label));
  host.append(el('div', { class: 'seq-wrap' }, grid), info,
    el('div', { class: 'row' }, el('button', { class: 'btn', type: 'button', onclick: listen }, '▶ Послушать'), el('button', { class: 'btn ghost', type: 'button', onclick: stop }, '■ Стоп'),
      el('button', { class: 'btn', type: 'button', onclick: runLevel }, '🏃 Пробежать в «Шаге в такт»'), el('span', { class: 'grow' }), ...presets,
      el('button', { class: 'btn ghost small', type: 'button', onclick: () => { v.melody = new Array(cols).fill(-1); save(); paint(); } }, 'Очистить')),
    run);
  paint();
  return host;
};

// release: релиз модуля. Ученик выбирает лучшую игру модуля (не обязательно сегодняшнюю), проверяет её в рамке и идёт по чек-листу.
// У пунктов с auto портал показывает, что видно из аркады (подпись донора, три решения, чужие партии, время партии, версии);
// отмечает пункты сам ученик. «Выпустить 1.0» — метка релиза в аркаде класса, одна игра на модуль.
const RELEASE_AUTO = {
  donor: g => g.donor ? [true, `подпись: по мотивам механики ${g.donor}`] : [false, 'нет подписи донора — пересобери игру из Фабрики'],
  decisions: g => { const n = ['feeling', 'honesty', 'choice'].filter(k => valText((g.decisions || {})[k])).length; return [n === 3, `в карточке решений: ${n} из 3`]; },
  plays: g => { const d = g.discovery || {}; return [d.rounds > 0, d.rounds ? `соседи сыграли ${d.rounds} партий, «ещё раз» — ${d.again}, рекорд класса ${g.record ? g.record.score : 0}` : 'в игру ещё не играл никто, кроме тебя']; },
  time: g => { const d = g.discovery || {}; const avg = d.rounds ? Math.round(d.time / d.rounds) : 0; return [avg >= 60, d.rounds ? `соседи играли в среднем ${avg} с за партию` : 'нет чужих партий — проверь с соседом']; },
  versions: g => [g.versions > 1, `версий: ${g.versions}${g.versions > 1 ? ' — были правки' : ' — правок ещё не было'}`],
  balance: g => [g.balanced > 0, g.balanced ? `свой баланс сохранён ${g.balanced} раз — «Как задумано» это твои числа` : 'баланс ещё не сохранён: поверни ручки (Tab) и нажми «Сохранить мой баланс»'],
};
STEPS.release = ctx => {
  const st = ctx.step;
  let v = Object.assign({ game: null, checks: {}, note: { text: '' }, released: null }, ctx.value);
  const host = el('div', { class: 'stack' });
  let data = null, cur = null, waiting = false;
  async function load() {
    try { data = await api('/api/arcade'); } catch (e) { host.innerHTML = ''; host.append(el('p', { class: 'err' }, e.message)); return; }
    draw();
  }
  function draw() {
    if (cur) { cur.destroy(); cur = null; }
    host.innerHTML = '';
    const games = data.mine.filter(c => c.lesson && c.lesson.module === S.lesson.module);
    const inArcade = data.games.filter(c => c.lesson && c.lesson.module === S.lesson.module && c.nick === S.me.nick).length;
    waiting = !games.length;
    if (!games.length) {
      host.append(el('div', { class: 'locked-msg card' }, el('h3', {}, 'Пока нет игр этого модуля'),
        el('p', { style: 'margin-top:6px' }, 'Собери игру в шаге «Сборка» — она появится здесь сама.'),
        el('div', { style: 'margin-top:12px' }, el('button', { class: 'btn ghost small', type: 'button', onclick: load }, '↻ Проверить'))));
      return;
    }
    if (!games.some(g => g.id === v.game)) v.game = (games.find(g => g.release) || games[games.length - 1]).id;
    const g = games.find(x => x.id === v.game);
    const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Игра на релиз' });
    games.forEach(x => seg.append(el('button', { type: 'button', class: 'opt' + (x.id === g.id ? ' on' : ''), 'aria-pressed': String(x.id === g.id), 'data-game': x.id, onclick: () => {
      if (x.id === v.game) return;
      v.game = x.id; v.checks = {}; ctx.save(v); beep('tick'); draw();
    } }, el('b', {}, x.title), el('div', { class: 'small muted' }, `урок ${x.lesson.number} · версия ${x.version}` + (x.release ? ' · 1.0' : '')))));
    host.append(el('p', { class: 'small' }, el('b', {}, `Твоих игр модуля ${S.lesson.module} в аркаде: ${inArcade} из ${st.goal || 4}. `), 'Выбери лучшую — не обязательно сегодняшнюю.'), seg);
    const h = cur = Games.frame({ src: () => `/play/${g.id}/${g.version}`, key: () => 'game:' + g.id, info: () => ({ version: g.version }), label: 'Проверить игру перед релизом' });
    host.append(Games.card(g, { compact: true }), h.box, Games.bar(h), balanceBar(h, () => g.id, () => load()));
    const list = el('div', { class: 'checklist' });
    st.checklist.forEach(item => {
      const auto = item.auto && RELEASE_AUTO[item.auto] ? RELEASE_AUTO[item.auto](g) : null;
      const on = !!v.checks[item.id];
      const b = el('button', { type: 'button', class: 'check' + (on ? ' on' : ''), 'aria-pressed': String(on), 'data-check': item.id, onclick: () => {
        v.checks[item.id] = !v.checks[item.id]; ctx.save(v); beep('tick');
        b.classList.toggle('on', v.checks[item.id]); b.setAttribute('aria-pressed', String(v.checks[item.id])); b.querySelector('.box').textContent = v.checks[item.id] ? '✓' : '';
      } }, el('span', { class: 'box' }, on ? '✓' : ''),
      el('span', { class: 'stack', style: 'gap:2px' }, el('b', {}, item.label), item.hint ? el('span', { class: 'small muted' }, item.hint) : null,
        auto ? el('span', { class: 'small ' + (auto[0] ? 'ok-text' : 'warn-text') }, (auto[0] ? '✓ ' : '⚠ ') + auto[1]) : null));
      list.append(b);
    });
    host.append(el('div', { class: 'eyebrow' }, 'Чек-лист версии 1.0'), list,
      fieldEditor({ id: 'note', label: 'Что изменено после плейтестов', hint: 'Запись в журнал релиза: что поменял и почему', deck: st.deck }, v.note, nv => { v.note = nv; ctx.save(v); }, { idPrefix: st.id }));
    const go = el('button', { class: 'btn', type: 'button' }, g.release ? '↻ Выпустить заново' : '🚀 Выпустить версию 1.0');
    go.addEventListener('click', async () => {
      const missing = st.checklist.filter(item => !v.checks[item.id]);
      if (missing.length) { toast('Не отмечено: ' + missing.map(x => x.label).join('; ')); return; }
      if (!valText(v.note)) { toast('Напиши, что изменил после плейтестов'); return; }
      go.disabled = true;
      try {
        const r = await api('/api/release', { game: g.id, checks: v.checks, note: v.note });
        v.released = { game: g.id, title: g.title, version: r.release.version, lesson: g.lesson.number };
        ctx.save(v, true, true); beep('done'); toast(`«${g.title}» вышла версией 1.0!`, 'ok'); load();
      } catch (e) { toast(e.message, 'err'); go.disabled = false; }
    });
    host.append(el('div', { class: 'row' }, go, g.release ? el('span', { class: 'tag ok' }, `версия 1.0 — это v${g.release.version} от урока ${g.lesson.number}`) : null));
  }
  S.hooks.push(kind => { if (kind === 'arcade' && waiting) load(); });
  host.append(el('p', { class: 'muted' }, 'Загружаем твои игры…'));
  load();
  return host;
};

/* =================== итог чекпоинта для чата =================== */
function stepSummary(step) {
  const a = ans(step.id), v = a.value || {};
  const f = x => valText(x) + (x && x.dice ? ' [кубик]' : '');
  switch (step.type) {
    case 'play': return `партий ${v.rounds || 0}, лучший счёт ${v.best || 0}` + (step.shared && S.wow && S.wow.game ? ` (игра класса «${S.wow.game.title}»${step.secretOff ? ', секрет выключен' : ''})` : '');
    case 'cards': return S.wow ? S.wow.cards.map(c => `${c.label}: ${c.text || '—'}`).join('; ') : '—';
    case 'abtest': return v.A ? `секрет в игре ${v.side === 'A' ? 'А' : 'Б'}; голос: ${v.vote ? (v.vote === 'same' ? 'разницы нет' : 'напряжённее ' + (v.vote === 'A' ? 'А' : 'Б')) : 'нет'}; партий А ${v.A.rounds}, Б ${v.B.rounds}; секрет сработал ${v[v.side].secret} раз` : 'не играл';
    case 'secret': return v.secret ? `догадка: ${v.guess} — ${v.correct ? 'угадал' : v.trap ? 'ловушка: это было на картах' : 'не угадал'}; секрет: ${v.secret.title}` : 'не отвечал';
    case 'teacher-demo': return `партий ${v.rounds || 0}, лучший счёт ${v.best || 0}`;
    case 'rounds': return v.total ? `верно ${v.correct} из ${v.total}, очки ${v.score}, серия ${v.bestStreak}` + ((v.mistakes || []).length ? '; ошибки: ' + v.mistakes.join('; ') : '') : 'не пройден';
    case 'choice': return [(v.selected || []).join('; '), valText(v.own) ? 'свои слова: ' + f(v.own) : ''].filter(Boolean).join(' · ') || '—';
    case 'cycle': return v.total ? `без ошибок ${v.perfect} из ${v.total}, очки ${v.score}, серия ${v.bestStreak}` + ((v.mistakes || []).length ? '; трудно: ' + v.mistakes.join('; ') : '') : 'не пройден';
    case 'release': return v.released ? `выпущена версия 1.0: «${v.released.title}» (урок ${v.released.lesson}, v${v.released.version}); что изменено: ${f(v.note)}` : `не выпущена; отмечено пунктов: ${Object.values(v.checks || {}).filter(Boolean).length}`;
    case 'blindpair': if (step.mode === 'secret' && v.game) return v.noSecret ? `игра «${v.title}» (автор ${v.author}) без секрета` : `игра «${v.title}» (автор ${v.author}); секрет был в ${v.dry === 'A' ? 'Б' : 'А'}; напряжённее: ${v.vote ? (v.vote === 'same' ? 'разницы нет' : v.vote === 'A' ? 'в А' : 'в Б') : '—'}${v.felt ? ' — почувствовал секрет' : ''}`;
      return v.game ? `игра «${v.title}» (автор ${v.author}); сухой была ${v.dry === 'A' ? 'А' : 'Б'}; хочется вернуться: ${v.vote ? (v.vote === 'same' ? 'разницы нет' : v.vote === 'A' ? 'в А' : 'в Б') : '—'}${v.vote && v.juicy ? ' — в сочную' : ''}` : 'не играл';
    case 'vote': return v.votes ? 'голоса: ' + Object.values(v.votes).length + ', сыграно игр: ' + Object.keys(v.played || {}).length : `сыграно игр: ${Object.keys(v.played || {}).length}`;
    case 'listen': return v.total ? `верно ${v.correct} из ${v.total}, очки ${v.score}` + ((v.mistakes || []).length ? '; перепутал: ' + v.mistakes.join('; ') : '') : 'не пройден';
    case 'sequencer': return v.line ? `мелодия: ${v.line}; пробежек ${v.ran || 0}` : 'мелодии нет';
    case 'blind': return v.total ? `угадано ${v.correct} из ${v.total}` + ((v.mistakes || []).length ? '; не почувствовал: ' + v.mistakes.join('; ') : '') : `загадок пройдено ${(v.picks || []).length}`;
    case 'trace': return v.total ? `верно ${v.correct} из ${v.total}, очки ${v.score}, серия ${v.bestStreak}` + ((v.mistakes || []).length ? '; ошибки: ' + v.mistakes.join('; ') : '') : 'не пройден';
    case 'predict': return (v.picked || []).length ? `предсказание: ${step.options.filter(o => v.picked.includes(o.counter)).map(o => o.text).join('; ')}` + (v.result ? ` — ${v.result.hit ? 'сбылось' : 'не сбылось'}; телеметрия за партию: ` + step.options.map(o => `${o.text} ${v.result.values[o.counter]}`).join(', ') : '') : 'не предсказывал';
    case 'sort': return v.total ? `верно ${v.correct} из ${v.total}, очки ${v.score}, серия ${v.bestStreak}` + ((v.mistakes || []).length ? '; ошибки: ' + v.mistakes.join('; ') : '') : 'не пройден';
    case 'text': return a.done ? 'прочитано' : 'не прочитано';
    case 'factory': return [`уровень: ${(step.levels.find(l => l.id === v.level) || {}).label || '—'}`].concat(step.fields.filter(x => valText((v.fields || {})[x.id])).map(x => `${x.label}: ${f(v.fields[x.id])}`)).join('\n');
    case 'decisions': case 'igra': return step.fields.map(x => `${x.letter ? x.letter + ' — ' : ''}${x.label}: ${f((v.fields || {})[x.id]) || '—'}`).join('\n');
    case 'producer': return v.result ? [v.result.praise, ...v.result.findings.map(x => `[${x.kind}] ${x.text}`), ...v.result.forks.map((x, i) => `${x.question} → ${(v.choices || {})[i] || 'не выбрано'}`)].filter(Boolean).join('\n') : 'не вызывался';
    case 'build': return S.game ? `«${S.game.title || ''}», версий ${S.game.versions.length}, текущая v${S.game.current}, модель ${(S.game.versions[S.game.current - 1] || {}).model || '—'}, партий ${v.rounds || 0}` : 'игра не собрана';
    case 'ownplay': return `партий ${v.rounds || 0}` + (step.question ? `; ${step.question} — ${f(v.answer) || '—'}` : '');
    case 'experiment': return v.knob ? `ручка ${v.knob}: ${v.from} → ${v.to == null ? '—' : v.to}; предсказание: ${f(v.guess) || '—'}` + (v.before && v.after ? `; счёт ${v.before.score} → ${v.after.score}, партия ${v.before.time} → ${v.after.time} с` : '') + (v.result ? `; ${v.result.toLowerCase()}` : '') + (valText(v.noticed) ? `; заметил: ${f(v.noticed)}` : '') + (v.kept === 'keep' ? '; числа сохранены' : v.kept === 'back' ? '; вернул как было' : '') : 'не начат';
    case 'aicheck': return `догадка: ${v.text || '—'}` + (v.notes ? '\nрешения программиста: ' + (v.notes.join('; ') || 'нет записей') : '');
    case 'workshop': return (v.requests || []).map(r => `${r.text}${r.dice ? ' [кубик]' : ''} → v${r.version}`).join('\n') || 'правок не было';
    case 'arcade': return v.game ? `игра «${v.title || ''}» (автор ${v.author || '—'}), партий ${v.rounds || 0}, лучший счёт ${v.best || 0}${v.beat ? ', рекорд автора побит' : ''}` : 'не играл';
    case 'playtest': return (v.sent ? `отзыв на «${v.title || ''}»: ${(v.emotions || []).join(' ')}; нравится: ${f(v.like)}; хочется: ${f(v.want)}; а что если: ${f(v.whatif)}` : 'отзыв не отправлен') +
      (S.me.feedback ? `\nотзыв учителя: понятие — ${valText(S.me.feedback.concept)}; вопрос — ${valText(S.me.feedback.question)}` : '');
    default: return JSON.stringify(v);
  }
}
function cpSummary(cp) {
  return `Урок ${S.lesson.number} «${S.lesson.title}» · чекпоинт «${cp.title}» · ${S.me.nick}\n\n` +
    cp.steps.map(s => `## ${s.title}${ans(s.id).done ? ' ✓' : ''}\n${stepSummary(s)}`).join('\n\n');
}

/* =================== заметка автора =================== */
$('#noteBtn').addEventListener('click', () => {
  const sel = $('#noteWhere'); sel.innerHTML = '';
  const cp = cpById(S.cpId);
  sel.append(el('option', { value: '' }, 'Урок целиком / портал'));
  S.lesson.checkpoints.forEach(c => {
    sel.append(el('option', { value: c.id + '|', selected: c.id === cp.id ? true : null }, `Чекпоинт «${c.title}»`));
    c.steps.forEach(s => sel.append(el('option', { value: c.id + '|' + s.id }, `   шаг «${s.title}»`)));
  });
  $('#noteText').value = '';
  $('#noteDlg').showModal();
});
$('#noteForm').addEventListener('submit', async e => {
  if (e.submitter && e.submitter.value !== 'send') return;
  const text = $('#noteText').value.trim();
  if (!text) return;
  const [checkpoint, step] = ($('#noteWhere').value || '|').split('|');
  try { await api('/api/note', { lesson: S.lesson.id, checkpoint: checkpoint || null, step: step || null, text }); toast('Заметка сохранена', 'ok'); } catch (err) { toast(err.message, 'err'); }
});
$('#logout').addEventListener('click', () => { Lab.token.clear(); location.href = '/'; });

boot();
