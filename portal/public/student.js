// Страница ученика: урок по чекпоинтам и типовые шаги (play, choice, text, sort, factory, decisions, igra, producer, build, aicheck, workshop).
'use strict';
const { el, api, toast, roll, beep, copy } = Lab;
const $ = s => document.querySelector(s);
const S = { me: null, lesson: null, answers: {}, game: null, opened: [], cpId: null, frames: [], demo: false };

/* =================== загрузка и синхронизация =================== */
async function boot() {
  let me;
  try { me = await api('/api/me'); } catch (e) {
    if (e.status === 401) { location.href = '/'; return; }
    $('#main').innerHTML = ''; $('#main').append(el('div', { class: 'locked-msg' }, e.message)); return;
  }
  S.me = me; S.lesson = me.lesson; S.answers = me.answers || {}; S.game = me.game; S.opened = me.class.opened; S.demo = me.demo;
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
    S.opened = d.opened;
    $('#noteBtn').hidden = !d.authorMode;
    const fresh = S.lesson.checkpoints.filter(cp => d.opened.includes(cp.id) && !before.includes(cp.id));
    const wasLocked = !isOpen(cpById(S.cpId));
    if (fresh.length) {
      beep('tick');
      toast(`Учитель открыл: ${fresh.map(c => c.title).join(', ')}`, 'ok');
      if (wasLocked || cpDone(cpById(S.cpId))) { S.cpId = fresh[0].id; renderMain(); }
    }
    renderSide();
    if (!isOpen(cpById(S.cpId))) renderMain();
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
function stopFrames() { S.frames.forEach(f => f.destroy()); S.frames = []; }
function renderMain() {
  stopFrames();
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

/* =================== поля с кубиком =================== */
function valText(v) { return v && typeof v === 'object' ? v.text || '' : v || ''; }
function fieldTag(v) {
  if (!valText(v)) return null;
  if (v.dice) return el('span', { class: 'tag dice', title: 'Вариант кубика, автор его не менял' }, '[кубик]');
  if (v.auto) return el('span', { class: 'tag auto' }, 'черновик Фабрики');
  return el('span', { class: 'tag own' }, 'свои слова');
}
function fieldEditor(f, value, onChange, opts = {}) {
  let v = Object.assign({ text: '', dice: false }, typeof value === 'object' ? value : { text: value || '' });
  const tagHost = el('span');
  const setTag = () => { tagHost.innerHTML = ''; const t = fieldTag(v); if (t) tagHost.append(t); };
  const ta = el(opts.single ? 'input' : 'textarea', { type: opts.single ? 'text' : null, rows: opts.rows || 2, id: 'f-' + (opts.idPrefix || '') + f.id, placeholder: f.placeholder || 'Своими словами или брось кубик' });
  ta.value = v.text;
  ta.addEventListener('input', () => { v = { text: ta.value, dice: false }; setTag(); onChange(v); });
  const kids = [ta];
  if (f.deck && f.deck.length) {
    const d = el('button', { type: 'button', class: 'dicebtn', title: 'Кубик: случайный вариант', 'aria-label': 'Бросить кубик для поля «' + f.label + '»' }, '🎲');
    d.addEventListener('click', () => {
      d.classList.remove('roll'); void d.offsetWidth; d.classList.add('roll'); beep('dice');
      v = { text: roll(f.deck, v.text), dice: true }; ta.value = v.text; setTag(); onChange(v);
    });
    kids.push(d);
  }
  setTag();
  return el('div', { class: 'field' },
    el('div', { class: 'head' }, f.letter ? el('span', { class: 'letter' }, f.letter) : null, el('label', { class: 'lbl', for: ta.id, style: 'margin:0' }, f.label), tagHost),
    f.hint ? el('div', { class: 'hint' }, f.hint) : null,
    el('div', { class: 'box' }, kids));
}
function ownCounter(values) {
  const filled = values.filter(v => valText(v)), own = filled.filter(v => !v.dice);
  return el('div', { class: 'counter' }, 'Своими словами: ', el('b', {}, String(own.length)), ` из ${filled.length || 0}`);
}

/* =================== рамка игры =================== */
// Игра идёт в изолированной рамке. Одновременно работает только одна рамка: запуск новой ставит остальные на паузу.
function gameFrame({ src, key, cfg, label, onReady, onOver, onError, autostart }) {
  const box = el('div', { class: 'gamebox' });
  const veil = el('div', { class: 'veil' });
  let iframe = null, timer = null, ready = false;
  const post = m => { try { iframe && iframe.contentWindow.postMessage(Object.assign({ target: 'lab-game' }, m), '*'); } catch (e) { /* рамка закрыта */ } };
  async function sendRecords() { try { const r = await api('/api/records?game=' + encodeURIComponent(key())); post({ type: 'records', record: r.record, best: r.mine }); } catch (e) { /* без рекордов */ } }
  function onMsg(e) {
    if (!iframe || e.source !== iframe.contentWindow) return;
    const m = e.data || {};
    if (m.source !== 'lab-game') return;
    if (m.type === 'ready') { ready = true; clearTimeout(timer); sendRecords(); if (cfg) post({ type: 'setCfg', cfg }); if (onReady) onReady(m.meta || {}); }
    if (m.type === 'over') { api('/api/score', { game: key(), score: m.score }).then(r => post({ type: 'records', record: r.record, best: r.mine })).catch(() => {}); if (onOver) onOver(m); }
    if (m.type === 'error') { clearTimeout(timer); if (onError) onError(m); }
  }
  addEventListener('message', onMsg);
  function showVeil(content) { veil.innerHTML = ''; veil.append(content); veil.hidden = false; }
  const h = {
    box,
    start() {
      S.frames.forEach(f => { if (f !== h) f.stop(); });
      h.stop(true);
      ready = false;
      iframe = el('iframe', { sandbox: 'allow-scripts allow-pointer-lock', allow: 'gamepad; fullscreen; autoplay', title: label || 'Игра', src: src() });
      box.prepend(iframe);
      veil.hidden = true;
      timer = setTimeout(() => { if (!ready && onError) onError({ phase: 'загрузка', message: 'игра не запустилась за 25 секунд' }); }, 25000);
      iframe.addEventListener('load', () => { try { iframe.focus(); } catch (e) { /* фокус по клику */ } });
    },
    stop(silent) {
      clearTimeout(timer);
      if (iframe) { iframe.remove(); iframe = null; }
      if (!silent) showVeil(el('button', { class: 'btn', type: 'button', onclick: () => h.start() }, '▶ ' + (label || 'Играть')));
    },
    message(content) { if (iframe) { iframe.remove(); iframe = null; } clearTimeout(timer); showVeil(content); },
    destroy() { removeEventListener('message', onMsg); h.stop(true); },
    fullscreen() { if (box.requestFullscreen) box.requestFullscreen().catch(() => {}); },
  };
  box.append(veil);
  S.frames.push(h);
  if (autostart) h.start(); else h.stop();
  return h;
}
function frameBar(h, extra) {
  return el('div', { class: 'gamebar' },
    el('span', {}, 'Кликни по игре, чтобы управлять. Tab — ручки, R — заново.'),
    el('span', { class: 'grow' }), extra || null,
    el('button', { class: 'btn ghost small', type: 'button', onclick: () => h.fullscreen() }, '⛶ На весь экран'));
}

/* =================== типы шагов =================== */
const STEPS = {};

STEPS.text = ctx => el('div', { class: 'stack' },
  el('div', { class: 'text-html', html: ctx.step.html }),
  el('div', {}, el('button', { class: 'btn', type: 'button', onclick: () => ctx.save({ read: true }, true) }, ctx.done ? 'Прочитано ✓' : 'Понятно')));

STEPS.play = ctx => {
  const st = ctx.step;
  let v = Object.assign({ rounds: 0, best: 0 }, ctx.value);
  const status = el('b', {});
  const show = () => { status.textContent = `Партий: ${v.rounds} · лучший счёт: ${v.best}` + (st.minRounds && v.rounds < st.minRounds ? ` · нужно партий: ${st.minRounds}` : ''); };
  const h = gameFrame({
    src: () => '/engine/game.html?game=../' + st.game, key: () => 'remake:' + st.id, cfg: st.cfg, label: 'Играть',
    onOver: m => { v = { rounds: v.rounds + 1, best: Math.max(v.best, m.score || 0) }; show(); ctx.save(v, ctx.done || v.rounds >= (st.minRounds || 1)); },
  });
  show();
  return el('div', { class: 'stack' }, h.box, frameBar(h, status),
    el('div', {}, el('button', { class: 'btn ghost small', type: 'button', onclick: () => ctx.save(v, true) }, 'Готово, дальше')));
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

STEPS.sort = ctx => {
  const st = ctx.step;
  const box = el('div', { class: 'sorter', tabindex: '0', 'aria-label': 'Квиз-сортировщик' });
  let order = [], i = 0, score = 0, streak = 0, bestStreak = 0, correct = 0, mistakes = [], left = 0, raf = 0, locked = false, active = false, padPrev = [];
  const hud = el('div', { class: 'hud' }), timer = el('div', { class: 'timer' }, el('i')), item = el('div', { class: 'item' }), why = el('div', { class: 'why', 'aria-live': 'polite' });
  const bins = el('div', { class: 'bins' });
  const keysHint = ['1 · ←', '2 · ↓', '3 · →'];
  const binBtns = st.bins.map((b, k) => { const btn = el('button', { type: 'button', class: 'bin', onclick: () => answer(k) }, b.label, el('kbd', {}, keysHint[k])); bins.append(btn); return btn; });
  function intro() {
    active = false; cancelAnimationFrame(raf);
    box.innerHTML = '';
    const prev = ctx.value;
    box.append(el('div', { class: 'stack', style: 'align-items:center;text-align:center;margin:auto' },
      el('h3', {}, `${st.items.length} решений · ${st.seconds} секунд на каждое`),
      el('p', { class: 'muted' }, 'Серия правильных ответов умножает очки. Геймпад: крестовина ◀ ▼ ▶.'),
      prev ? el('p', {}, `Твой результат: ${prev.correct} из ${prev.total}, очки ${prev.score}`) : null,
      el('button', { class: 'btn', type: 'button', onclick: begin }, prev ? 'Сыграть ещё раз' : '▶ Начать')));
  }
  function begin() {
    order = st.items.map((x, k) => k).sort(() => Math.random() - 0.5);
    i = 0; score = 0; streak = 0; bestStreak = 0; correct = 0; mistakes = [];
    box.innerHTML = ''; box.append(hud, timer, item, why, bins); box.focus();
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
    const map = [[14, 2], [13, 0], [15, 1]];
    map.forEach(([btn, alt], k) => { const on = b[btn] || b[alt]; if (on && !padPrev[k]) answer(k); padPrev[k] = on; });
  }
  function next() {
    if (i >= order.length) return finish();
    const it = st.items[order[i]];
    item.className = 'item'; item.textContent = it.text; why.textContent = '';
    left = st.seconds; locked = false;
    hud.innerHTML = ''; hud.append(el('span', {}, `${i + 1} / ${order.length}`), el('span', {}, streak > 1 ? `серия ×${streak}` : ''), el('span', {}, `очки ${score}`));
  }
  function answer(k) {
    if (!active || locked) return;
    locked = true;
    const it = st.items[order[i]], right = st.bins.findIndex(b => b.id === it.bin);
    const ok = k === right;
    if (ok) { streak++; bestStreak = Math.max(bestStreak, streak); correct++; score += 100 * Math.min(streak, 5) + Math.round(left * 10); beep('good'); }
    else { streak = 0; mistakes.push(`${it.text} → ${st.bins[right].label}`); beep('bad'); }
    item.classList.add(ok ? 'good' : 'bad');
    const btn = binBtns[k >= 0 ? k : right];
    btn.classList.add(ok ? 'flash-good' : 'flash-bad');
    if (!ok) binBtns[right].classList.add('flash-good');
    why.textContent = (ok ? 'Верно! ' : k < 0 ? 'Время вышло. ' : `Это ${st.bins[right].label.toLowerCase()}. `) + it.why;
    setTimeout(() => { binBtns.forEach(b => b.classList.remove('flash-good', 'flash-bad')); i++; next(); }, ok ? 900 : 2200);
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
    const k = { Digit1: 0, Numpad1: 0, ArrowLeft: 0, Digit2: 1, Numpad2: 1, ArrowDown: 1, Digit3: 2, Numpad3: 2, ArrowRight: 2 }[e.code];
    if (k != null) { e.preventDefault(); answer(k); }
  });
  intro();
  return box;
};

STEPS.factory = ctx => {
  const st = ctx.step;
  let v = Object.assign({ level: st.levels[0].id, fields: {} }, ctx.value);
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
    visible().forEach(f => fieldsHost.append(fieldEditor(f, v.fields[f.id], nv => { v.fields[f.id] = nv; ctx.save(v); count(); }, { single: f.id === 'title', idPrefix: st.id })));
    count();
  }
  const visible = () => st.fields.filter(f => !f.levels || f.levels.includes(v.level));
  const count = () => { counterHost.innerHTML = ''; counterHost.append(ownCounter(visible().map(f => v.fields[f.id]))); };
  wrap.append(el('div', { class: 'formula' }, el('span', {}, 'Донор'), '×', el('span', {}, 'Твист'), '×', el('span', {}, 'Мир')));
  wrap.append(el('div', { class: 'eyebrow' }, 'Уровень'), levelSeg);
  if (st.donorCard) wrap.append(el('div', { class: 'donor-card' }, el('div', { class: 'ico' }, '👾'), el('div', {}, el('div', { class: 'eyebrow' }, 'Донор урока · карта'), el('h3', {}, st.donorCard.title), el('p', { class: 'muted' }, st.donorCard.text))));
  wrap.append(fieldsHost, el('div', { class: 'row' }, counterHost, el('span', { class: 'grow' }),
    el('button', { class: 'btn ghost', type: 'button', onclick: () => {
      const empty = visible().filter(f => !valText(v.fields[f.id]) && f.deck);
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
  const h = gameFrame({
    src: () => `/play/${g().id}/${g().current}`, key: () => 'game:' + g().id, label: 'Играть в свою игру', autostart,
    onReady: () => { status.textContent = `Версия ${g().current} запущена.`; fixTries = 0; },
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
  return { h, el: el('div', { class: 'stack' }, h.box, frameBar(h), el('div', { class: 'row' }, el('span', { class: 'small muted' }, 'Версии:'), versions), status), drawVersions };
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
        toast(S.demo ? 'Демо-режим: правка записана, но игра не изменилась' : `Готово: версия ${r.version}`, 'ok'); draw(); S.frames[S.frames.length - 1].start();
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

/* =================== итог чекпоинта для чата =================== */
function stepSummary(step) {
  const a = ans(step.id), v = a.value || {};
  const f = x => valText(x) + (x && x.dice ? ' [кубик]' : '');
  switch (step.type) {
    case 'play': return `партий ${v.rounds || 0}, лучший счёт ${v.best || 0}`;
    case 'choice': return [(v.selected || []).join('; '), valText(v.own) ? 'свои слова: ' + f(v.own) : ''].filter(Boolean).join(' · ') || '—';
    case 'sort': return v.total ? `верно ${v.correct} из ${v.total}, очки ${v.score}, серия ${v.bestStreak}` + ((v.mistakes || []).length ? '; ошибки: ' + v.mistakes.join('; ') : '') : 'не пройден';
    case 'text': return a.done ? 'прочитано' : 'не прочитано';
    case 'factory': return [`уровень: ${(step.levels.find(l => l.id === v.level) || {}).label || '—'}`].concat(step.fields.filter(x => valText((v.fields || {})[x.id])).map(x => `${x.label}: ${f(v.fields[x.id])}`)).join('\n');
    case 'decisions': case 'igra': return step.fields.map(x => `${x.letter ? x.letter + ' — ' : ''}${x.label}: ${f((v.fields || {})[x.id]) || '—'}`).join('\n');
    case 'producer': return v.result ? [v.result.praise, ...v.result.findings.map(x => `[${x.kind}] ${x.text}`), ...v.result.forks.map((x, i) => `${x.question} → ${(v.choices || {})[i] || 'не выбрано'}`)].filter(Boolean).join('\n') : 'не вызывался';
    case 'build': return S.game ? `«${S.game.title || ''}», версий ${S.game.versions.length}, текущая v${S.game.current}, модель ${(S.game.versions[S.game.current - 1] || {}).model || '—'}, партий ${v.rounds || 0}` : 'игра не собрана';
    case 'aicheck': return `догадка: ${v.text || '—'}` + (v.notes ? '\nрешения программиста: ' + (v.notes.join('; ') || 'нет записей') : '');
    case 'workshop': return (v.requests || []).map(r => `${r.text}${r.dice ? ' [кубик]' : ''} → v${r.version}`).join('\n') || 'правок не было';
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
