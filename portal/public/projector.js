// Проектор учителя (/projector?code=КОД): крупно код класса, открытый чекпоинт с таймером и сколько учеников закончили каждый шаг.
// Вкладка «Вау-старт»: учитель тянет карты колоды безумных идей и при всех собирает игру с ИИ. Для урока с колодой wow (урок 1) —
// карты, голоса «перетянуть», сборка и раздача общей игры класса; секрет на проектор не выводится. Для шага teacher-demo — его карты и таймер.
'use strict';
const { el, api, toast, beep } = Lab;
const $ = s => document.querySelector(s);
const P = { code: null, o: null, skew: 0, tab: 'lesson', isDemo: false, d: null, info: null, job: null, frameFor: null, tf: null, keys: {}, w: null, wKey: null, wFrame: null };
const mmss = sec => { const s = Math.max(0, Math.round(sec)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const serverNow = () => Date.now() + P.skew;
const CARDS = [['hero', 'Герой'], ['place', 'Место'], ['twist', 'Поворот']];

async function boot() {
  const q = new URLSearchParams(location.search);
  try { P.code = q.get('code') || localStorage.getItem('lab:teacher:class'); } catch (e) { P.code = q.get('code'); }
  if (!P.code) { $('#pj-lesson').append(el('div', { class: 'card' }, 'Сначала создайте класс в панели учителя.')); return; }
  try { P.isDemo = (await api('/api/info')).demo; } catch (e) { /* без разницы */ }
  if (q.get('tab') === 'demo') P.tab = 'demo';
  await refresh();
  setInterval(refresh, 2000);
  setInterval(tick, 250);
}
async function refresh() {
  let o;
  try { o = await api('/api/teacher/overview?code=' + encodeURIComponent(P.code)); } catch (e) { if (e.status === 401) { location.href = '/'; return; } toast(e.message, 'err'); return; }
  P.o = o; P.skew = Date.parse(o.now) - Date.now();
  $('#pjClass').textContent = `${o.class.name} · урок ${o.lesson.number}. ${o.lesson.title}`;
  P.mode = o.lesson.checkpoints.some(c => c.steps.some(s => s.type === 'teacher-demo')) ? 'demo' : o.lesson.wow ? 'wow' : null;
  $('#demoTab').hidden = !P.mode;
  if (P.lastMode !== P.mode) { // учитель сменил урок: вкладка вау-старта строится заново
    Games.stopAll(); P.tf = null; P.frameFor = null; P.wFrame = null; P.wKey = null; P.dKey = null; P.d = null; P.w = null;
    $('#pj-demo').innerHTML = ''; P.lastMode = P.mode;
  }
  if (!P.mode && P.tab === 'demo') P.tab = 'lesson';
  showTab();
  if (P.tab === 'lesson') drawLesson();
  else if (P.mode === 'wow') await refreshWow();
  else await refreshDemo();
}
function showTab() {
  document.querySelectorAll('.pj-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === P.tab));
  $('#pj-lesson').hidden = P.tab !== 'lesson'; $('#pj-demo').hidden = P.tab !== 'demo';
  if (P.tab !== 'demo' && (P.tf || P.wFrame)) { Games.stopAll(); P.tf = null; P.frameFor = null; P.wFrame = null; P.wKey = null; }
}

/* ---------- урок: код, чекпоинт, таймер, кто закончил шаги ---------- */
function currentCp() {
  const o = P.o, cps = o.lesson.checkpoints, t = o.class.timer;
  return (t && cps.find(c => c.id === t.cp && o.class.opened.includes(c.id))) || cps.filter(c => o.class.opened.includes(c.id)).pop() || null;
}
function drawLesson() {
  const o = P.o, host = $('#pj-lesson'), cps = o.lesson.checkpoints;
  const cp = currentCp(), total = o.students.length, onl = o.students.filter(s => s.online).length;
  host.innerHTML = '';
  host.append(el('div', { class: 'pj-codebox' },
    el('div', { class: 'eyebrow' }, 'Вход в урок'), el('div', { class: 'pj-url' }, location.host + '/'),
    el('div', { class: 'pj-code', id: 'pjCode' }, o.class.code),
    el('div', { class: 'pj-sub' }, `учеников: ${total}` + (total ? ` · на связи: ${onl}` : ''))));
  const main = el('div', { class: 'pj-cp' });
  if (!cp) {
    main.append(el('div', { class: 'eyebrow' }, `Урок ${o.lesson.number} · донор ${o.lesson.donor}`), el('h1', {}, o.lesson.title),
      el('p', { class: 'pj-sub' }, 'Входите по коду слева. Урок начнётся, когда учитель откроет первый чекпоинт.'),
      el('div', {}, el('button', { class: 'btn', type: 'button', onclick: () => openCp(cps[0]) }, `Открыть: ${cps[0].title} →`)));
    host.append(main); return;
  }
  const idx = cps.indexOf(cp), next = cps.slice(idx + 1).find(c => !o.class.opened.includes(c.id));
  const timed = o.class.timer && o.class.timer.cp === cp.id;
  main.append(el('div', { class: 'eyebrow' }, `Чекпоинт ${idx + 1} из ${cps.length} · ${cp.minutes} минут`), el('h1', {}, cp.title),
    el('div', { class: 'pj-timer', id: 'pjTimer' }, timed ? '' : '—'), el('div', { class: 'pj-sub', id: 'pjTimerSub' }, timed ? '' : 'таймер не запущен'));
  main.append(el('div', { class: 'pj-steps' }, cp.steps.map(s => {
    const n = o.stepsDone[s.id] || 0, share = total ? n / total : 0;
    return el('div', { class: 'pj-step' + (total && n === total ? ' all' : '') }, el('span', { class: 'pj-st' }, s.title),
      el('span', { class: 'bt' }, el('i', { style: `width:${Math.round(share * 100)}%` })), el('b', {}, `${n} из ${total}`));
  })), el('div', { class: 'pj-sub' }, 'закончили шаг'));
  main.append(el('div', { class: 'row pj-ctrl' },
    el('button', { class: 'btn ghost small', type: 'button', onclick: () => timer('restart', cp.id) }, '↻ Таймер заново'),
    timed ? el('button', { class: 'btn ghost small', type: 'button', onclick: () => timer('add') }, '+2 минуты') : null,
    next ? el('button', { class: 'btn small', type: 'button', onclick: () => openCp(next) }, `Открыть: ${next.title} →`) : el('span', { class: 'tag ok' }, 'все чекпоинты открыты')));
  host.append(main);
  tick();
}
function tick() {
  const t = P.o && P.o.class.timer, box = $('#pjTimer');
  if (box && t && P.tab === 'lesson') {
    const rem = t.minutes * 60 - (serverNow() - Date.parse(t.startedAt)) / 1000;
    box.textContent = rem >= 0 ? mmss(rem) : '+' + mmss(-rem);
    box.classList.toggle('over', rem < 0); box.classList.toggle('soon', rem >= 0 && rem < 60);
    $('#pjTimerSub').textContent = rem >= 0 ? `осталось из ${mmss(t.minutes * 60)}` : 'время чекпоинта вышло';
  }
  const clock = $('#pjDemoClock');
  if (clock && P.d) {
    const left = P.d.deadline ? (Date.parse(P.d.deadline) - serverNow()) / 1000 : null;
    clock.textContent = left == null ? '05:00' : left > 0 ? mmss(left) : '00:00';
    clock.classList.toggle('over', left != null && left <= 0);
    const line = $('#pjOpenLine');
    if (line) line.textContent = openLine();
  }
  const prog = $('#pjBuildClock');
  if (prog && P.d && P.d.buildStartedAt && !P.job) prog.textContent = `ИИ пишет игру при всех… ${mmss((serverNow() - Date.parse(P.d.buildStartedAt)) / 1000)}`;
}
async function openCp(cp) {
  try { await api('/api/teacher/class/update', { code: P.code, opened: P.o.class.opened.concat(cp.id) }); beep('tick'); await refresh(); } catch (e) { toast(e.message, 'err'); }
}
async function timer(action, cp) {
  try { await api('/api/teacher/timer', { code: P.code, action, cp }); await refresh(); } catch (e) { toast(e.message, 'err'); }
}

/* ---------- вау-старт: карты, сборка при всех, игра у всех ---------- */
async function refreshDemo() {
  // ответ опроса, ушедшего до конца сборки или починки, устарел: он вернул бы «собирается» и убил рамку с новой игрой
  const seq = P.seq = (P.seq || 0) + 1;
  let r;
  try { r = await api('/api/teacher/demo?code=' + encodeURIComponent(P.code)); } catch (e) { toast(e.message, 'err'); return; }
  if (seq !== P.seq) return;
  const prev = P.d;
  P.info = r; P.d = r.demo;
  drawDemo(prev);
}
function openLine() {
  const d = P.d;
  if (d.visible) return '✓ Игра открыта у всех учеников';
  if (d.open === false) return 'Игра скрыта от учеников';
  const left = d.deadline ? (Date.parse(d.deadline) - serverNow()) / 1000 : null;
  if (!d.ready) return left != null && left > 0 ? `Игра откроется у всех через ${mmss(left)}, когда соберётся` : 'Игра откроется у всех, как только соберётся';
  return left != null && left > 0 ? `Откроется у всех через ${mmss(left)}` : 'Открывается у всех…';
}
function drawDemo(prev) {
  const host = $('#pj-demo'), d = P.d, r = P.info;
  if (!d) { host.innerHTML = ''; host.append(el('div', { class: 'card' }, 'В этом уроке нет вау-старта.')); return; }
  if (!host.firstChild) {
    host.append(el('div', { class: 'pj-dhead' }, el('div', { class: 'grow', id: 'pjDTitle' }), el('div', { class: 'stack', style: 'gap:0;align-items:flex-end' }, el('div', { class: 'eyebrow' }, 'Игра класса через'), el('div', { class: 'pj-timer small', id: 'pjDemoClock' }, '05:00'))),
      el('div', { id: 'pjCards' }), el('div', { id: 'pjDCtrl', class: 'row' }), el('div', { id: 'pjGame', class: 'stack' }));
  }
  // перерисовываем только то, что поменялось: опрос идёт каждые 2 секунды, а рамка с игрой и поле названия должны жить
  const key = JSON.stringify([d.cards, d.title, d.state, d.ready, d.visible, d.open, d.error, d.game && d.game.current, r.watching, r.played, r.students, !!P.job]);
  if (key === P.dKey) { drawGame(); tick(); return; }
  P.dKey = key;
  const step = r.step;
  const th = $('#pjDTitle');
  if (!(document.activeElement && document.activeElement.id === 'pjTitle')) { // учитель печатает название — не мешаем
    th.innerHTML = '';
    const title = el('input', { type: 'text', id: 'pjTitle', maxlength: '60', placeholder: 'Название игры класса', value: d.title || '' });
    title.addEventListener('change', () => setDemo({ title: title.value }));
    th.append(el('div', { class: 'eyebrow' }, 'Вау-старт · колода безумных идей'),
      el('div', { class: 'row', style: 'gap:8px' }, el('div', { class: 'grow pj-titlebox' }, title),
        el('button', { class: 'dicebtn', type: 'button', title: 'Название с кубика', 'aria-label': 'Название с кубика', onclick: () => draw('title') }, '🎲')),
      el('div', { class: 'formula pj-formula' }, el('span', {}, r.donor), '×', el('span', {}, d.cards.twist ? 'поворот' : 'поворот ?'), '×', el('span', {}, d.cards.place ? 'мир' : 'мир ?')));
  }
  const ch = $('#pjCards'); ch.innerHTML = '';
  ch.append(el('div', { class: 'pj-cards' }, CARDS.map(([k, label]) => {
    const val = el('b', { class: 'cv', 'data-card': k }, d.cards[k] || '?');
    const c = el('div', { class: 'pj-card' + (d.cards[k] ? ' on' : '') }, el('div', { class: 'eyebrow' }, label), val,
      el('button', { class: 'dicebtn', type: 'button', title: 'Перетянуть карту', 'aria-label': 'Перетянуть карту «' + label + '»', onclick: () => draw(k) }, '🎲'));
    if (prev && d.cards[k] && prev.cards[k] !== d.cards[k]) spin(val, (step.decks || {})[k] || [], d.cards[k]);
    return c;
  })));
  // кнопки
  const ctrl = $('#pjDCtrl'); ctrl.innerHTML = '';
  const all = CARDS.every(([k]) => d.cards[k]);
  const building = d.state === 'building' || !!P.job;
  ctrl.append(...[
    el('button', { class: 'btn' + (all ? ' ghost' : ''), type: 'button', onclick: () => drawNext(), disabled: building || null }, '🎲 Тянуть карту', el('kbd', {}, 'пробел')),
    el('button', { class: 'btn' + (all && !d.ready ? '' : ' ghost'), type: 'button', id: 'pjBuild', onclick: build, disabled: !all || building || null }, d.ready ? '↻ Собрать заново' : '⚙ Собрать игру с ИИ', el('kbd', {}, 'Enter')),
    el('span', { class: 'grow' }),
    el('span', { class: 'muted small' }, `на связи: ${r.watching} из ${r.students} · сыграли: ${r.played}`),
    el('button', { class: 'btn ghost small', type: 'button', disabled: building || null, onclick: async () => { if (!confirm('Начать заново: новые карты, новая игра?')) return; try { await api('/api/teacher/demo/reset', { code: P.code }); Games.stopAll(); P.tf = null; P.frameFor = null; $('#pjGame').innerHTML = ''; await refreshDemo(); } catch (e) { toast(e.message, 'err'); } } }, '↺ Новые карты')].filter(Boolean));
  drawGame();
  tick();
}
function drawGame() {
  const d = P.d, host = $('#pjGame');
  if (P.job) return; // идёт сборка из этого окна: прогресс рисует build()
  if (d.state === 'building') { killFrame(); host.innerHTML = ''; host.append(el('div', { class: 'progress pj-progress' }, el('div', { class: 'spinner' }), el('p', { id: 'pjBuildClock' }, 'ИИ пишет игру при всех…'))); return; }
  if (!d.ready) {
    killFrame(); host.innerHTML = '';
    if (d.state === 'error') host.append(el('div', { class: 'card stack' }, el('b', {}, 'Не собралось: ' + (d.error || 'ошибка')), el('p', { class: 'muted small' }, 'Перетяните карту или нажмите «Собрать игру с ИИ» ещё раз.')));
    else host.append(el('p', { class: 'pj-sub' }, Object.values(d.cards).filter(Boolean).length < 3 ? 'Тяните три карты: кто герой, где всё происходит и какой поворот.' : 'Карты на столе. Собираем игру с ИИ — прямо сейчас, при всех.'));
    return;
  }
  // опрос мог вернуться раньше, чем сервер записал починенную версию: рамка уже на более новой — не откатываем
  const [fid, fv] = String(P.frameFor || '').split(':');
  if (fid === d.game.id && Number(fv) > d.game.current) d.game.current = Number(fv);
  const key = d.game.id + ':' + d.game.current;
  if (P.frameFor !== key && !(P.tf && P.tf.fixing && fid === d.game.id)) {
    killFrame(); host.innerHTML = '';
    P.frameFor = key;
    P.tf = Games.teacherFrame({
      get: () => P.d.game, label: 'Играть в игру класса', autostart: true, demo: () => P.isDemo,
      set: g => { P.d.game = Object.assign({}, P.d.game, { current: g.current, versions: g.versions }); P.frameFor = g.id + ':' + g.current; },
    });
    host.append(P.tf.h.box, Games.bar(P.tf.h, P.tf.status), el('div', { class: 'row', id: 'pjOpenCtrl' }));
  }
  const oc = $('#pjOpenCtrl'); oc.innerHTML = '';
  oc.append(...[el('b', { id: 'pjOpenLine', class: 'grow' }, openLine()),
    d.visible ? el('button', { class: 'btn ghost', type: 'button', onclick: () => setDemo({ open: false }) }, '⏸ Скрыть от учеников')
      : el('button', { class: 'btn warm', type: 'button', id: 'pjOpenAll', onclick: () => { beep('done'); setDemo({ open: true }); } }, '▶ Открыть всем сейчас'),
    d.open !== null ? el('button', { class: 'btn ghost small', type: 'button', onclick: () => setDemo({ open: null }) }, 'Открыть по таймеру') : null].filter(Boolean));
}
function killFrame() { if (P.tf) { P.tf.h.destroy(); P.tf = null; } P.frameFor = null; }
// карта «крутится» как барабан: варианты колоды мелькают и останавливаются на вытянутом
function spin(node, deck, final) {
  if (!deck.length) return;
  beep('dice');
  let n = 0;
  const t = setInterval(() => {
    node.textContent = deck[Math.floor(Math.random() * deck.length)];
    if (++n > 12) { clearInterval(t); node.textContent = final; node.parentNode.classList.add('landed'); beep('good'); }
  }, 55);
}
async function draw(card) {
  try { await api('/api/teacher/demo/draw', { code: P.code, card }); await refreshDemo(); } catch (e) { toast(e.message, 'err'); }
}
function drawNext() {
  const empty = CARDS.find(([k]) => !P.d.cards[k]);
  if (!empty) { toast('Все карты на столе. Кубик у карты — перетянуть её.'); return; }
  draw(empty[0]);
}
async function setDemo(patch) {
  try { await api('/api/teacher/demo/set', Object.assign({ code: P.code }, patch)); await refreshDemo(); } catch (e) { toast(e.message, 'err'); }
}
async function build() {
  if (P.job) return;
  killFrame();
  const host = $('#pjGame'); host.innerHTML = '';
  const p = el('p', {}, 'ИИ пишет игру при всех…');
  host.append(el('div', { class: 'progress pj-progress' }, el('div', { class: 'spinner' }), p, el('p', { class: 'muted small' }, 'Пока ИИ пишет — спросите класс: что почувствует игрок?')));
  P.job = true;
  try {
    await Lab.job('/api/teacher/demo/build', { code: P.code }, j => { p.textContent = `ИИ пишет игру при всех… ${mmss(j.seconds)}` + (j.chars ? ` · ${j.chars.toLocaleString('ru-RU')} символов кода` : '') + (j.phase === 'синтаксис' ? ' · чинит опечатку' : ''); });
    beep('done'); toast('Игра класса собрана!', 'ok');
  } catch (e) { toast(e.message, 'err', 8000); }
  P.job = null;
  await refreshDemo();
}

/* ---------- вау-старт урока с колодой wow: карты, сборка, раздача общей игры ---------- */
async function refreshWow() {
  const seq = P.wSeq = (P.wSeq || 0) + 1;
  let r;
  try { r = await api('/api/teacher/wow?code=' + encodeURIComponent(P.code)); } catch (e) { toast(e.message, 'err'); return; }
  if (seq !== P.wSeq) return;
  const prev = P.w;
  P.w = r;
  drawWow(prev);
}
function drawWow(prev) {
  const r = P.w, host = $('#pj-demo'), w = r.wow, decks = Object.fromEntries((P.o.lesson.wow.cards || []).map(c => [c.id, c.deck || []]));
  const ready = r.cards.every(c => w.cards[c.id]), busy = w.status === 'building' || !!P.job;
  const key = JSON.stringify([w.cards, w.votes, w.status, w.given, r.game && r.game.id + '/' + r.game.version, !!P.job, P.o.students.length, P.o.students.filter(s => s.online).length]);
  if (key === P.wKey) return;
  P.wKey = key;
  if (!host.querySelector('#pjWowCards')) {
    host.innerHTML = '';
    host.append(el('div', { class: 'pj-dhead' }, el('div', { class: 'grow' }, el('div', { class: 'eyebrow' }, 'Вау-старт · колода безумных идей'),
      el('div', { class: 'formula pj-formula' }, ...r.formula.split(' × ').flatMap((x, i) => i ? ['×', el('span', {}, x)] : [el('span', {}, x)])))),
    el('div', { id: 'pjWowCards' }), el('div', { id: 'pjWowCtrl', class: 'row' }), el('div', { id: 'pjWowGame', class: 'stack' }));
  }
  const ch = $('#pjWowCards'); ch.innerHTML = '';
  ch.append(el('div', { class: 'pj-cards four' }, r.cards.map(c => {
    const text = w.cards[c.id], votes = (w.votes[c.id] || []).length;
    const val = el('b', { class: 'cv' }, text || '?');
    if (prev && text && prev.wow.cards[c.id] !== text) spin(val, decks[c.id] || [], text);
    return el('div', { class: 'pj-card' + (text ? ' on' : ''), 'data-card': c.id }, el('div', { class: 'eyebrow' }, c.label), val,
      votes ? el('div', { class: 'tag dice pj-votes' }, `перетянуть: ${votes}`) : null,
      !w.given && !busy ? el('button', { class: 'dicebtn', type: 'button', title: text ? 'Перетянуть карту' : 'Тянуть карту', 'aria-label': (text ? 'Перетянуть' : 'Тянуть') + ' карту «' + c.label + '»', onclick: () => wowDraw(c.id) }, '🎲') : null);
  })));
  const total = P.o.students.length, onl = P.o.students.filter(s => s.online).length;
  const ctrl = $('#pjWowCtrl'); ctrl.innerHTML = '';
  ctrl.append(...[
    !w.given ? el('button', { class: 'btn' + (ready ? ' ghost' : ''), type: 'button', disabled: busy || null, onclick: wowNext }, '🎲 Тянуть карту', el('kbd', {}, 'пробел')) : null,
    !w.given ? el('button', { class: 'btn' + (ready && !r.game ? '' : ' ghost'), type: 'button', id: 'pjWowBuild', disabled: !ready || busy || null, onclick: wowBuild }, r.game ? '↻ Собрать заново' : '⚙ Собрать игру с ИИ', el('kbd', {}, 'Enter')) : null,
    r.game && w.status === 'preview' ? (w.given ? el('button', { class: 'btn ghost', type: 'button', onclick: () => wowGive(false) }, 'Забрать у класса')
      : el('button', { class: 'btn warm', type: 'button', id: 'pjWowGive', onclick: () => wowGive(true) }, '📣 Раздать классу')) : null,
    el('span', { class: 'grow' }),
    el('span', { class: 'muted small' }, `на связи: ${onl} из ${total}`)].filter(Boolean));
  const gh = $('#pjWowGame');
  if (P.job) return; // прогресс сборки рисует wowBuild()
  const status = { cards: ready ? 'Карты на столе. Не нравится карта — голосуйте «перетянуть» у себя.' : 'Тяните карты: герой, действие, место и поворот.', building: '⚙ ИИ собирает игру класса прямо сейчас…', preview: w.given ? '✓ Игра у всех — играйте!' : 'Игра собрана. Проверим её здесь и раздадим классу.' }[w.status] || '';
  const gkey = r.game ? r.game.id + '/' + r.game.version : null;
  if (!gkey || P.wFrame && P.wFrame.gkey !== gkey) { if (P.wFrame) { P.wFrame.h.destroy(); P.wFrame = null; } gh.innerHTML = ''; }
  if (!gkey) { gh.append(el('p', { class: 'pj-sub', id: 'pjWowStatus' }, status)); return; }
  if (!P.wFrame) {
    const g = r.game;
    const h = Games.frame({ src: () => `/play/${g.id}/${g.version}`, key: () => 'wow:' + g.id, label: 'Играть в игру класса', score: false,
      onError: err => h.message(el('b', {}, 'Игра упала: ' + (err.message || 'ошибка') + '. Соберите заново или возьмите запасную игру в панели учителя.')) });
    P.wFrame = { h, gkey };
    gh.append(el('p', { class: 'pj-sub', id: 'pjWowStatus' }), el('h2', {}, g.title || 'Игра класса'), h.box, Games.bar(h, el('span', {})));
  }
  $('#pjWowStatus').textContent = status;
}
async function wowDraw(card) {
  try { await api('/api/teacher/wow/draw', { code: P.code, card }); await refreshWow(); } catch (e) { toast(e.message, 'err'); }
}
function wowNext() {
  const empty = P.w.cards.find(c => !P.w.wow.cards[c.id]);
  if (!empty) { toast('Все карты на столе. Кубик у карты — перетянуть её.'); return; }
  wowDraw(empty.id);
}
async function wowGive(given) {
  try { await api('/api/teacher/wow/give', { code: P.code, given }); if (given) beep('done'); await refreshWow(); } catch (e) { toast(e.message, 'err'); }
}
async function wowBuild() {
  if (P.job) return;
  if (P.wFrame) { P.wFrame.h.destroy(); P.wFrame = null; }
  const gh = $('#pjWowGame'); gh.innerHTML = '';
  const p = el('p', {}, 'ИИ собирает игру класса при всех…');
  gh.append(el('div', { class: 'progress pj-progress' }, el('div', { class: 'spinner' }), p, el('p', { class: 'muted small' }, 'Пока ИИ пишет — спросите класс: что почувствует игрок?')));
  P.job = true; P.wKey = null;
  try {
    await Lab.job('/api/teacher/wow/build', { code: P.code }, j => { p.textContent = `ИИ собирает игру класса… ${mmss(j.seconds)}` + (j.chars ? ` · ${j.chars.toLocaleString('ru-RU')} символов кода` : '') + (j.phase === 'синтаксис' ? ' · чинит опечатку' : ''); });
    beep('done'); toast('Игра класса собрана!', 'ok');
  } catch (e) { toast(e.message, 'err', 8000); }
  P.job = null; P.wKey = null; gh.innerHTML = '';
  await refreshWow();
}

/* ---------- события ---------- */
document.querySelectorAll('.pj-tabs button').forEach(b => b.addEventListener('click', () => { P.tab = b.dataset.tab; refresh(); }));
$('#pjFull').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); });
addEventListener('keydown', e => {
  if (P.tab !== 'demo' || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) return;
  if (P.mode === 'wow') {
    const w = P.w && P.w.wow;
    if (!w || w.given || w.status === 'building' || P.job) return;
    if (e.code === 'Space') { e.preventDefault(); wowNext(); }
    if (e.code === 'Enter' && !P.w.game && P.w.cards.every(c => w.cards[c.id])) { e.preventDefault(); wowBuild(); }
    return;
  }
  if (!P.d) return;
  if (e.code === 'Space') { e.preventDefault(); drawNext(); }
  if (e.code === 'Enter' && !P.d.ready && !P.job) { e.preventDefault(); if (CARDS.every(([k]) => P.d.cards[k])) build(); }
});

boot();
