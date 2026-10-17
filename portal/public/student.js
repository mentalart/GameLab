// Страница ученика: урок по чекпоинтам и типовые шаги (play, teacher-demo, choice, text, sort, rounds, cycle, cards, secret, factory, decisions, igra, producer, build, aicheck, workshop, release, arcade, playtest).
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
  S.cpId = pickCheckpoint();
  render();
  listen();
}
function listen() {
  const es = new EventSource('/api/events?token=' + encodeURIComponent(Lab.token.get()));
  es.addEventListener('class', e => {
    const d = JSON.parse(e.data);
    if (d.lesson !== S.lesson.id) { location.reload(); return; }
    const before = S.opened;
    const wasLocked = !isOpen(cpById(S.cpId)); // до обновления: ученик ждал на закрытом чекпоинте, и учитель открыл именно его
    S.opened = d.opened;
    $('#noteBtn').hidden = !d.authorMode;
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
function save(stepId, value, done, now) {
  const prev = ans(stepId);
  S.answers[stepId] = { value, done: done == null ? !!prev.done : !!done, at: new Date().toISOString() };
  clearTimeout(saveTimers[stepId]);
  const go = () => api('/api/answer', { step: stepId, value, done: S.answers[stepId].done }).catch(e => toast(e.message, 'err'));
  if (now || done != null) go(); else saveTimers[stepId] = setTimeout(go, 600);
  if (done != null) renderSide();
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
function renderMain() {
  stopFrames(); S.hooks = [];
  const main = $('#main'); main.innerHTML = '';
  const cp = cpById(S.cpId);
  if (!isOpen(cp)) {
    main.append(el('div', { class: 'card locked-msg' }, el('h2', {}, 'Ждём учителя'), el('p', { style: 'margin-top:8px' }, 'Учитель откроет первый чекпоинт, и урок начнётся. Страницу обновлять не нужно.')));
    return;
  }
  const idx = S.lesson.checkpoints.indexOf(cp);
  main.append(el('div', { class: 'stack', style: 'gap:6px' },
    el('div', { class: 'eyebrow' }, `Чекпоинт ${idx + 1} из ${S.lesson.checkpoints.length} · ${cp.minutes} минут`),
    el('h1', {}, cp.title)));
  cp.steps.forEach((step, i) => main.append(stepCard(step, i, cp)));
  const next = S.lesson.checkpoints[idx + 1];
  main.append(el('div', { class: 'row' },
    el('button', { class: 'btn ghost', type: 'button', onclick: () => copy(cpSummary(cp)) }, '⧉ Скопировать результат'),
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
  const filled = values.filter(v => valText(v)), own = filled.filter(v => !v.dice);
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
  const host = el('div', { class: 'stack' });
  let h = null;
  function mount() {
    if (h) h.destroy();
    h = Games.frame({
      src: () => '/engine/game.html?game=../' + st.game, key: () => 'remake:' + st.id, cfg: Object.assign({}, st.cfg, variants ? variants[vi].cfg : null), label: variants ? 'Играть: ' + variants[vi].label : 'Играть',
      onOver: m => {
        const custom = Object.assign({}, v.custom);
        for (const [k, n] of Object.entries((m.tele || {}).custom || {})) custom[k] = (custom[k] || 0) + (Number(n) || 0);
        v = Object.assign({}, v, { rounds: v.rounds + 1, best: Math.max(v.best, m.score || 0), secret: v.secret + (Number(((m.tele || {}).custom || {})._secret) || 0), custom });
        if (variants) v.variant = variants[vi].label;
        show(); ctx.save(v, ctx.done || v.rounds >= (st.minRounds || 1));
      },
    });
    host.innerHTML = '';
    if (variants) {
      const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Вариант игры' });
      variants.forEach((x, k) => seg.append(el('button', { type: 'button', class: 'opt' + (k === vi ? ' on' : ''), 'aria-pressed': String(k === vi), onclick: () => { if (k === vi) return; vi = k; v.variant = x.label; ctx.save(v); beep('tick'); mount(); } },
        el('b', {}, x.label), x.hint ? el('div', { class: 'small muted' }, x.hint) : null)));
      host.append(seg);
    }
    host.append(h.box, Games.bar(h, status));
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
      src: () => `/play/${game.id}/${game.current}`, key: () => 'demo:' + game.id, label: 'Играть в игру класса', autostart: false,
      onOver: m => { v = { rounds: v.rounds + 1, best: Math.max(v.best, m.score || 0) }; showStatus(); ctx.save(v, ctx.done || v.rounds >= (st.minRounds || 1)); },
      onError: err => h.message(el('div', { class: 'stack', style: 'align-items:center' }, el('b', {}, 'Игра упала: ' + (err.message || 'ошибка')), el('p', { class: 'muted small' }, 'Учитель починит её на проекторе — она обновится сама.'))),
    });
    showStatus();
    host.append(el('div', { class: 'donor-card' }, el('div', { class: 'ico' }, '🎲'), el('div', { class: 'stack', style: 'gap:6px' },
      el('div', { class: 'eyebrow' }, 'Игра класса за пять минут'), el('h3', {}, game.title || d.title), formula, cards())),
    h.box, Games.bar(h, status),
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
      onOver: m => {
        const hits = Number(((m.tele || {}).custom || {})._secret) || 0;
        v = Object.assign(v, { rounds: v.rounds + 1, best: Math.max(v.best, m.score || 0), secret: v.secret + hits });
        show(); ctx.save(v, ctx.done || v.rounds >= (st.minRounds || 1));
      },
      onError: err => cur.message(el('div', { class: 'stack', style: 'align-items:center' }, el('b', {}, 'Игра класса упала: ' + (err.message || 'ошибка')), el('p', { class: 'muted small' }, 'Скажи учителю — он пересоберёт игру или возьмёт запасную.'))),
    });
    show();
    host.append(el('div', { class: 'donor-card' }, el('div', { class: 'ico' }, '🃏'), el('div', {},
      el('div', { class: 'eyebrow' }, st.secretOff ? 'Игра класса · секрет выключен' : 'Игра класса'), el('h3', {}, g.title || 'Игра класса'),
      el('p', { class: 'muted small' }, S.wow.cards.map(c => c.text).filter(Boolean).join(' · ')))),
    cur.box, Games.bar(cur, status),
    el('div', {}, el('button', { class: 'btn ghost small', type: 'button', onclick: () => { if (!v.rounds) { toast('Сначала сыграй хотя бы одну партию'); return; } ctx.save(v, true); } }, 'Готово, дальше')));
  }
  S.hooks.push(kind => { if (kind === 'wow') draw(); });
  draw();
  return host;
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
        el('div', { class: 'wc-text' }, c.text || '?'),
        c.text && W.status === 'cards' ? el('button', { class: 'btn ghost small' + (mine ? ' on' : ''), type: 'button', 'aria-pressed': String(mine), onclick: () => vote(c.id) },
          `🔁 Перетянуть${c.voters.length ? ' · ' + c.voters.length : ''}`) : null));
      if (fresh && prev[c.id] !== undefined) flipped = true;
      prev[c.id] = c.text;
    });
    if (flipped) beep('dice');
    host.append(row, el('p', { class: 'wow-status', 'aria-live': 'polite' }, wowStatusText(W)));
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

STEPS.choice = ctx => {
  const st = ctx.step;
  let v = Object.assign({ selected: [], own: { text: '' } }, ctx.value);
  const wrap = el('div', { class: 'stack' });
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
  if (st.own) wrap.append(fieldEditor({ id: st.id, label: st.options && st.options.length ? 'Или своими словами' : 'Твой ответ', deck: st.deck }, v.own, nv => { v.own = nv; ctx.save(v); }));
  wrap.append(el('div', {}, el('button', { class: 'btn', type: 'button', onclick: () => {
    if (!v.selected.length && !valText(v.own)) { toast('Выбери карточку или напиши ответ'); return; }
    ctx.save(v, true);
  } }, 'Ответить')));
  return wrap;
};

// карточки квиза из игры класса: {hero} {action} {place} {twist} — карты, {secret} — секрет после шага «Найди секрет»
function wowItems(st) {
  if (!st.wowItems || !S.wow) return [];
  const vars = {};
  S.wow.cards.forEach(c => { if (c.text) vars[c.id] = c.text; });
  const hunt = lessonSteps().find(x => x.type === 'secret'), sec = hunt && (ans(hunt.id).value || {}).secret;
  if (sec) vars.secret = sec.title;
  return st.wowItems.filter(it => [...it.text.matchAll(/\{(\w+)\}/g)].every(m => vars[m[1]]))
    .map(it => Object.assign({}, it, { text: it.text.replace(/\{(\w+)\}/g, (_, k) => vars[k]) }));
}
STEPS.sort = ctx => {
  const st = ctx.step;
  let ITEMS = st.items.concat(wowItems(st));
  const box = el('div', { class: 'sorter', tabindex: '0', 'aria-label': 'Квиз-сортировщик' });
  let order = [], i = 0, score = 0, streak = 0, bestStreak = 0, correct = 0, mistakes = [], left = 0, raf = 0, locked = false, active = false, padPrev = [];
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
    i = 0; score = 0; streak = 0; bestStreak = 0; correct = 0; mistakes = [];
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
    const v = { score, correct, total: order.length, bestStreak, mistakes };
    ctx.save(v, true);
    box.innerHTML = '';
    box.append(el('div', { class: 'stack', style: 'align-items:center;text-align:center;margin:auto' },
      el('div', { class: 'eyebrow' }, 'Итог'), el('h2', {}, `${correct} из ${order.length} · ${score} очков`),
      el('p', { class: 'muted' }, `Лучшая серия: ${bestStreak}`),
      mistakes.length ? el('div', { class: 'small', style: 'text-align:left' }, el('b', {}, 'Ошибки:'), el('ul', {}, mistakes.map(m => el('li', {}, m)))) : el('p', {}, 'Без ошибок!'),
      el('div', { class: 'row', style: 'justify-content:center' },
        el('button', { class: 'btn', type: 'button', onclick: begin }, 'Ещё раз'),
        el('button', { class: 'btn ghost', type: 'button', onclick: () => copy(`Квиз «${st.title}»: ${correct} из ${order.length}, ${score} очков, серия ${bestStreak}.` + (mistakes.length ? ' Ошибки: ' + mistakes.join('; ') : '')) }, '⧉ Скопировать результат'))));
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
// таймер, серия, звук, разбор после каждой карты (дальше — пробел, Enter или кнопка A), итог с «Скопировать результат».
STEPS.rounds = ctx => {
  const st = ctx.step;
  const L = st.left || { label: 'Игра' }, R = st.right || { label: 'Не игра' };
  const box = el('div', { class: 'rounds', tabindex: '0', 'aria-label': 'Квиз-раунды' });
  let order = [], i = 0, score = 0, streak = 0, bestStreak = 0, correct = 0, mistakes = [], left = 0, raf = 0, phase = 'intro', padPrev = {}, answeredAt = 0;
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
    i = 0; score = 0; streak = 0; bestStreak = 0; correct = 0; mistakes = [];
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
  box.addEventListener('keydown', e => {
    if (phase === 'intro' || phase === 'end') return;
    const k = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'next', Enter: 'next', NumpadEnter: 'next' }[e.code];
    if (k) { e.preventDefault(); press(k); }
  });
  intro();
  return box;
};

STEPS.factory = ctx => {
  const st = ctx.step;
  let v = Object.assign({ level: st.levels[0].id, fields: {} }, ctx.value);
  // donors — несколько доноров на выбор (урок 2: змейка, пинг-понг…): у каждого свои колоды кубиков, чтобы кубик не приносил правило из другой игры
  if (st.donors && !st.donors.some(d => d.id === v.donor)) v.donor = st.donors[0].id;
  const donor = () => st.donors ? st.donors.find(d => d.id === v.donor) : null;
  const withDeck = f => { const d = donor(); return d && d.decks && d.decks[f.id] ? Object.assign({}, f, { deck: d.decks[f.id] }) : f; };
  const wrap = el('div', { class: 'stack' });
  const levelSeg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Уровень задания' });
  st.levels.forEach(l => {
    const b = el('button', { type: 'button', class: 'opt' + (v.level === l.id ? ' on' : ''), 'aria-pressed': String(v.level === l.id) }, el('b', {}, l.label), el('div', { class: 'small muted' }, l.hint));
    b.addEventListener('click', () => { v.level = l.id; ctx.save(v); draw(); });
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
    el('button', { class: 'btn', type: 'button', onclick: () => {
      const missing = visible().filter(f => !valText(v.fields[f.id]));
      if (missing.length) { toast('Заполни: ' + missing.map(f => f.label).join(', ')); return; }
      ctx.save(v, true);
    } }, 'Замысел готов')));
  draw();
  return wrap;
};

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
  return out;
}
const fillTpl = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] || '…');

STEPS.igra = ctx => {
  const st = ctx.step;
  let v = Object.assign({ fields: {} }, ctx.value);
  const vars = planVars();
  let changed = false;
  st.fields.forEach(f => { if (!valText(v.fields[f.id]) && f.prefill) { v.fields[f.id] = { text: fillTpl(f.prefill, vars), auto: true }; changed = true; } });
  if (changed) ctx.save(v);
  const host = el('div', { class: 'stack' });
  const counterHost = el('div');
  const count = () => { counterHost.innerHTML = ''; counterHost.append(ownCounter(st.fields.map(f => v.fields[f.id]))); };
  function draw() {
    host.innerHTML = '';
    st.fields.forEach(f => host.append(fieldEditor(f, v.fields[f.id], nv => { v.fields[f.id] = nv; ctx.save(v); count(); }, { rows: 3, idPrefix: st.id })));
    count();
  }
  draw();
  return el('div', { class: 'stack' }, host, el('div', { class: 'row' }, counterHost, el('span', { class: 'grow' }),
    el('button', { class: 'btn ghost', type: 'button', onclick: () => {
      const vars2 = planVars();
      st.fields.forEach(f => { if (f.prefill && (!valText(v.fields[f.id]) || v.fields[f.id].auto)) v.fields[f.id] = { text: fillTpl(f.prefill, vars2), auto: true }; });
      ctx.save(v); draw(); toast('Черновик собран заново: поля, которые ты правил, не тронуты');
    } }, '↻ Черновик из Фабрики'),
    el('button', { class: 'btn', type: 'button', onclick: () => {
      const missing = st.fields.filter(f => !valText(v.fields[f.id]));
      if (missing.length) { toast('Заполни: ' + missing.map(f => f.letter).join(', ')); return; }
      ctx.save(v, true);
    } }, 'Промпт готов')));
};

STEPS.producer = ctx => {
  const host = el('div', { class: 'stack' });
  function draw() {
    host.innerHTML = '';
    const v = ctx.value;
    const runBtn = el('button', { class: 'btn' + (v ? ' ghost' : ''), type: 'button', onclick: run }, v ? '↻ Спросить продюсера ещё раз' : 'Отдать замысел продюсеру');
    if (!v || !v.result) { host.append(el('div', {}, runBtn)); return; }
    const r = v.result, choices = v.choices || {};
    if (r.praise) host.append(el('p', { class: 'concept' }, r.praise));
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
    host.append(el('div', { class: 'row' }, runBtn,
      el('button', { class: 'btn ghost', type: 'button', onclick: () => document.getElementById('step-' + S.lesson.plan.igra).scrollIntoView({ behavior: 'smooth' }) }, '✎ Поправить промпт ИГРА'),
      !r.forks.length ? el('button', { class: 'btn', type: 'button', onclick: () => ctx.save(v, true) }, 'Дальше') : null));
  }
  async function run() {
    if (!(ans(S.lesson.plan.igra) || {}).done) { toast('Сначала нажми «Промпт готов» в шаге ИГРА'); return; }
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
function ownGame({ onOver, autostart } = {}) {
  const status = el('div', { class: 'small', 'aria-live': 'polite' });
  const versions = el('div', { class: 'versions' });
  let fixTries = 0;
  const g = () => S.game;
  const h = Games.frame({
    src: () => `/play/${g().id}/${g().current}`, key: () => 'game:' + g().id, info: () => ({ version: g().current }), label: 'Играть в свою игру', autostart,
    onReady: () => { status.textContent = `Версия ${g().current} запущена.`; fixTries = 0; api('/api/game/ran', { version: g().current }).catch(() => {}); },
    onOver: m => { if (onOver) onOver(m); },
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
        S.game = r.game; drawVersions(); h.start();
      } catch (e) { h.message(el('p', {}, 'Починка не удалась: ' + e.message)); }
    },
  });
  function drawVersions() {
    versions.innerHTML = '';
    if (!g()) return;
    g().versions.forEach(v => versions.append(el('button', {
      type: 'button', class: 'ver' + (v.n === g().current ? ' cur' : '') + (v.error ? ' bad' : ''),
      title: (v.kind || '') + (v.request ? ': ' + v.request : '') + (v.error ? ' · ошибка: ' + v.error.message : ''),
      onclick: async () => { try { const r = await api('/api/game/current', { version: v.n }); S.game = r.game; fixTries = 0; drawVersions(); h.start(); } catch (e) { toast(e.message, 'err'); } },
    }, `v${v.n} · ${v.kind || ''}`)));
  }
  drawVersions();
  return { h, el: el('div', { class: 'stack' }, h.box, Games.bar(h), el('div', { class: 'row' }, el('span', { class: 'small muted' }, 'Версии:'), versions), status), drawVersions };
}

STEPS.build = ctx => {
  const st = ctx.step;
  const host = el('div', { class: 'stack' });
  let v = Object.assign({ rounds: 0 }, ctx.value);
  function draw(autostart) {
    host.innerHTML = '';
    const vars = planVars();
    host.append(el('div', { class: 'donor-card' }, el('div', { class: 'ico' }, '🛠'), el('div', {},
      el('div', { class: 'eyebrow' }, 'Замысел'), el('h3', {}, vars.title || 'Моя игра'),
      el('p', { class: 'muted small' }, [vars.twist, vars.world].filter(Boolean).join(' · ')))));
    const buildBtn = el('button', { class: 'btn' + (S.game && S.game.current ? ' ghost' : ''), type: 'button', onclick: build }, S.game && S.game.current ? '↻ Собрать заново по замыслу' : '⚙ Собрать игру');
    if (S.game && S.game.current) {
      const og = ownGame({ autostart, onOver: () => { v.rounds++; ctx.save(v, ctx.done || v.rounds >= (st.minRounds || 1)); } });
      host.append(og.el);
    }
    host.append(el('div', { class: 'row' }, buildBtn, el('span', { class: 'muted small' }, S.demo ? 'Демо-режим: соберётся образец урока с твоим названием.' : 'Обычно 1–3 минуты. Пока программист пишет — подумай, что почувствует игрок.')));
  }
  async function build() {
    if (!(ans(S.lesson.plan.producer) || {}).done && !confirm('Продюсер ещё не прочитал замысел или развилки не выбраны. Собрать всё равно?')) return;
    stopFrames();
    host.innerHTML = '';
    const p = el('p', {}, 'Программист пишет игру…');
    host.append(el('div', { class: 'progress', style: 'padding:30px' }, el('div', { class: 'spinner' }), p, el('p', { class: 'muted small' }, 'Можно не ждать на этой странице — игра сохранится.')));
    try {
      const r = await Lab.job('/api/ai/build', {}, j => { p.textContent = `Программист пишет игру… ${j.seconds} с` + (j.chars ? ` · ${j.chars.toLocaleString('ru-RU')} символов кода` : '') + (j.phase === 'синтаксис' ? ' · чинит опечатку' : ''); });
      S.game = r.game; v.gameId = r.gameId; ctx.save(v);
      toast('Игра собрана! Кликни по ней и играй.', 'ok'); beep('done');
      draw(true);
    } catch (e) { toast(e.message, 'err', 8000); draw(false); }
  }
  draw(false);
  return host;
};

STEPS.aicheck = ctx => {
  let v = Object.assign({ text: '', notes: null }, ctx.value);
  const host = el('div', { class: 'stack' });
  function draw() {
    host.innerHTML = '';
    if (!S.game || !S.game.current) { host.append(el('p', { class: 'muted' }, 'Сначала собери игру в чекпоинте «Сборка».')); return; }
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

STEPS.workshop = ctx => {
  const st = ctx.step;
  let v = Object.assign({ requests: [] }, ctx.value);
  const host = el('div', { class: 'stack' });
  function draw() {
    host.innerHTML = '';
    if (!S.game || !S.game.current) { host.append(el('p', { class: 'muted' }, 'Сначала собери игру в чекпоинте «Сборка».')); return; }
    const og = ownGame({});
    let req = { text: '' };
    const send = el('button', { class: 'btn', type: 'button' }, 'Отправить программисту');
    const prog = el('div');
    send.addEventListener('click', async () => {
      const text = valText(req).trim();
      if (!text) { toast('Напиши одну просьбу'); return; }
      send.disabled = true; stopFrames();
      prog.innerHTML = ''; const p = el('p', {}, 'Программист вносит правку…');
      prog.append(el('div', { class: 'progress' }, el('div', { class: 'spinner' }), p));
      try {
        const r = await Lab.job('/api/ai/change', { request: text }, j => { p.textContent = `Программист вносит правку… ${j.seconds} с` + (j.chars ? ` · ${j.chars.toLocaleString('ru-RU')} символов` : ''); });
        S.game = r.game; v.requests = v.requests.concat({ text, dice: !!req.dice, version: r.version }); ctx.save(v, true, true);
        toast(S.demo ? 'Демо-режим: правка записана, но игра не изменилась' : `Готово: версия ${r.version}`, 'ok'); draw(); Games.frames[Games.frames.length - 1].start();
      } catch (e) { toast(e.message, 'err', 8000); send.disabled = false; prog.innerHTML = ''; }
    });
    host.append(og.el,
      fieldEditor({ id: 'req', label: 'Одна просьба программисту', hint: 'Баг — по формуле «Делал… Ожидал… Получилось… Не трогай…». Числа меняй ручками (Tab).', deck: st.deck }, req, nv => { req = nv; }, { rows: 2, idPrefix: st.id }),
      el('div', { class: 'row' }, send), prog);
    if (v.requests.length) host.append(el('details', {}, el('summary', {}, `Мои правки (${v.requests.length})`), el('ol', {}, v.requests.map(r => el('li', {}, `${r.text}${r.dice ? ' [кубик]' : ''} → v${r.version}`)))));
  }
  draw();
  return host;
};

/* ---------- играем вместе: игра соседа и плейтест ---------- */
// arcade: игра одноклассника по кругу или на выбор, рекорд автора и свой, вызов «побей мой мир»
STEPS.arcade = ctx => {
  const st = ctx.step;
  let v = Object.assign({ game: null, rounds: 0, best: 0, beat: false, played: 0 }, ctx.value);
  const host = el('div', { class: 'stack' });
  let data = null, waiting = false, cur = null;
  const pick = game => { v = Object.assign(v, { game: game.id, author: game.nick, title: game.title, rounds: 0, best: 0, beat: false }); ctx.save(v); S.hooks.forEach(fn => fn('picked', game)); };
  async function load(after) {
    try { data = await api('/api/arcade' + (after ? '?after=' + encodeURIComponent(after) : '')); } catch (e) { host.innerHTML = ''; host.append(el('p', { class: 'err' }, e.message)); return; }
    const game = (!after && v.game && data.games.find(g => g.id === v.game && !g.mine)) || data.neighbour;
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
      src: () => `/play/${game.id}/${game.version}`, key: () => 'game:' + game.id, info: () => ({ version: game.version }), label: 'Играть в игру соседа',
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
    else mineHost.append(Games.discovery(r.discovery));
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

// release: релиз модуля. Ученик выбирает лучшую игру модуля (не обязательно сегодняшнюю), проверяет её в рамке и идёт по чек-листу.
// У пунктов с auto портал показывает, что видно из аркады (подпись донора, три решения, чужие партии, время партии, версии);
// отмечает пункты сам ученик. «Выпустить 1.0» — метка релиза в аркаде класса, одна игра на модуль.
const RELEASE_AUTO = {
  donor: g => g.donor ? [true, `подпись: по мотивам механики ${g.donor}`] : [false, 'нет подписи донора — пересобери игру из Фабрики'],
  decisions: g => { const n = ['feeling', 'honesty', 'choice'].filter(k => valText((g.decisions || {})[k])).length; return [n === 3, `в карточке решений: ${n} из 3`]; },
  plays: g => { const d = g.discovery || {}; return [d.rounds > 0, d.rounds ? `соседи сыграли ${d.rounds} партий, «ещё раз» — ${d.again}, рекорд класса ${g.record ? g.record.score : 0}` : 'в игру ещё не играл никто, кроме тебя']; },
  time: g => { const d = g.discovery || {}; const avg = d.rounds ? Math.round(d.time / d.rounds) : 0; return [avg >= 60, d.rounds ? `соседи играли в среднем ${avg} с за партию` : 'нет чужих партий — проверь с соседом']; },
  versions: g => [g.versions > 1, `версий: ${g.versions}${g.versions > 1 ? ' — были правки' : ' — правок ещё не было'}`],
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
    host.append(Games.card(g, { compact: true }), h.box, Games.bar(h));
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
    case 'secret': return v.secret ? `догадка: ${v.guess} — ${v.correct ? 'угадал' : v.trap ? 'ловушка: это было на картах' : 'не угадал'}; секрет: ${v.secret.title}` : 'не отвечал';
    case 'teacher-demo': return `партий ${v.rounds || 0}, лучший счёт ${v.best || 0}`;
    case 'rounds': return v.total ? `верно ${v.correct} из ${v.total}, очки ${v.score}, серия ${v.bestStreak}` + ((v.mistakes || []).length ? '; ошибки: ' + v.mistakes.join('; ') : '') : 'не пройден';
    case 'choice': return [(v.selected || []).join('; '), valText(v.own) ? 'свои слова: ' + f(v.own) : ''].filter(Boolean).join(' · ') || '—';
    case 'cycle': return v.total ? `без ошибок ${v.perfect} из ${v.total}, очки ${v.score}, серия ${v.bestStreak}` + ((v.mistakes || []).length ? '; трудно: ' + v.mistakes.join('; ') : '') : 'не пройден';
    case 'release': return v.released ? `выпущена версия 1.0: «${v.released.title}» (урок ${v.released.lesson}, v${v.released.version}); что изменено: ${f(v.note)}` : `не выпущена; отмечено пунктов: ${Object.values(v.checks || {}).filter(Boolean).length}`;
    case 'sort': return v.total ? `верно ${v.correct} из ${v.total}, очки ${v.score}, серия ${v.bestStreak}` + ((v.mistakes || []).length ? '; ошибки: ' + v.mistakes.join('; ') : '') : 'не пройден';
    case 'text': return a.done ? 'прочитано' : 'не прочитано';
    case 'factory': return [`уровень: ${(step.levels.find(l => l.id === v.level) || {}).label || '—'}`].concat(step.fields.filter(x => valText((v.fields || {})[x.id])).map(x => `${x.label}: ${f(v.fields[x.id])}`)).join('\n');
    case 'decisions': case 'igra': return step.fields.map(x => `${x.letter ? x.letter + ' — ' : ''}${x.label}: ${f((v.fields || {})[x.id]) || '—'}`).join('\n');
    case 'producer': return v.result ? [v.result.praise, ...v.result.findings.map(x => `[${x.kind}] ${x.text}`), ...v.result.forks.map((x, i) => `${x.question} → ${(v.choices || {})[i] || 'не выбрано'}`)].filter(Boolean).join('\n') : 'не вызывался';
    case 'build': return S.game ? `«${S.game.title || ''}», версий ${S.game.versions.length}, текущая v${S.game.current}, модель ${(S.game.versions[S.game.current - 1] || {}).model || '—'}, партий ${v.rounds || 0}` : 'игра не собрана';
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
