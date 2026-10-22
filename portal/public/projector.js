// Проектор учителя (/projector?code=КОД): крупно код класса, открытый чекпоинт с таймером и сколько учеников закончили каждый шаг.
// Вкладка «Вау-старт»: учитель тянет карты колоды безумных идей и при всех собирает игру с ИИ. Для урока с колодой wow (урок 1) —
// сцена «Пять опор» (public/opory.js), карты, голоса «перетянуть», сборка и раздача общей игры класса; спрятанная механика на проектор не выводится. Для шага teacher-demo — его карты и таймер.
// Вкладка «Ответы класса»: голоса шагов выбора и слепых тестов полосками без имён, в реальном времени.
// Вкладка «Спрятанная механика рядом» (урок 1, после «Найди спрятанную механику»): две копии игры класса рядом, в одном мире; бот-новичок играет обе одними нажатиями
// в настоящем времени — слева без спрятанной механики, справа со спрятанной механикой и лупой. Копии расходятся только из-за спрятанной механики.
// Вкладка «Мир дня»: учитель даёт всему классу один мир одной из игр урока, таблица мира растёт на проекторе.
// Вкладка «Финал»: стена аркады урока — игры урока с рекордами, игра класса, лидер мира дня; «🤡» на карточке игры — в «Провал дня».
// Вкладка «🤡 Провал дня» (А5): учитель одним нажатием выбирает баг игры урока, автор соглашается на своём экране, игра — в рамке на весь класс,
// под ней «Почему так вышло?» — причины чипами и вывод класса.
// Вкладка «Выставка и турнир» (урок с шагом vote): лидеры номинаций и кнопочный турнир в игре-победителе номинации step.tournament.
// Вкладка «Вместе» (модуль 7, уроки с шагами arena, bracket, team): карта забега «Арены класса», итоги, голоса за правило, турнирная сетка, команды джема (public/m7-pult.js).
// Вкладка «Проект» (модуль 8, уроки с teamGroup 'proekt'): дорога к Фестивалю, сцена питча с кольцом, стена питчей, диздоки, Фестиваль и номинации (public/m8-pult.js).
// Проектор и класс (аудит, сессия 2; public/klass-pult.js): вкладка «🎭 Сцена» — театр сцены motion с голосованием класса «что изменится?» (В5),
// вкладка «🎯 Цель» — цель класса и награда (Д2), реакции учеников всплывают поверх любой игры, которая видна на проекторе (Д3),
// в «🤡 Провале дня» — галерея провалов класса и нарезка лучших к Фестивалю (Д5), заставка «Уровень N» при открытии чекпоинта (Д7).
'use strict';
const { el, api, toast, beep } = Lab;
const $ = s => document.querySelector(s);
const P = { cup: [], cupFrame: null, cupKey: null, code: null, o: null, skew: 0, tab: 'lesson', d: null, info: null, job: null, frameFor: null, tf: null, keys: {}, w: null, wKey: null, wFrame: null };
const mmss = sec => { const s = Math.max(0, Math.round(sec)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const serverNow = () => Date.now() + P.skew;
const CARDS = [['hero', 'Герой'], ['place', 'Место'], ['twist', 'Поворот']];

async function boot() {
  const q = new URLSearchParams(location.search);
  try { P.code = q.get('code') || localStorage.getItem('lab:teacher:class'); } catch (e) { P.code = q.get('code'); }
  if (!P.code) { $('#pj-lesson').append(el('div', { class: 'card' }, 'Сначала создайте класс в панели учителя.')); return; }
  if (['demo', 'day', 'poll', 'final', 'fail', 'pair', 'm7', 'm8', 'teatr', 'goal', 'sab', 'kar', 'kv', 'sv'].includes(q.get('tab'))) P.tab = q.get('tab');
  P.reacts = LabKlassPult.reacts(); P.reactBuf = [];
  await refresh();
  listenPj();
  setInterval(refresh, 2000);
  setInterval(tick, 250);
  setInterval(flushReacts, 5000);
}
/* ---------- живые события класса на проекторе: реакции (Д3), театр сцены (В5), цель (Д2), галерея провалов (Д5) ---------- */
function listenPj() {
  const es = new EventSource('/api/events?token=' + encodeURIComponent(Lab.token.get()) + '&code=' + encodeURIComponent(P.code));
  es.addEventListener('react', e => {
    const d = JSON.parse(e.data), f = P.reacts.add(d.emoji), m = f && /^\/play\/([\w-]+)\/(\d+)/.exec(f.src || '');
    if (m) P.reactBuf.push({ game: m[1], version: Number(m[2]), sec: f.sec(), emoji: d.emoji }); // «где смеялись»: секунда партии в рамке — в телеметрию игры
  });
  es.addEventListener('theater', e => { if (P.teatr) P.teatr.event(JSON.parse(e.data)); });
  es.addEventListener('sabotage', () => { if (P.sab) P.sab.event(); });
  es.addEventListener('karusel', () => { if (P.kar) P.kar.event(); });
  es.addEventListener('kvest', () => { if (P.kv) P.kv.event(); });
  es.addEventListener('sovet', () => { if (P.sv) P.sv.event(); });
  es.addEventListener('goal', e => { const d = JSON.parse(e.data); if (P.o) { P.o.goal = d.off ? null : d; if (P.tab === 'goal' && P.goalPult) P.goalPult.draw(); if (P.tab === 'lesson') drawLesson(); } });
  es.addEventListener('fails', () => { if (P.failGal) P.failGal.load(); });
}
function flushReacts() {
  const buf = P.reactBuf || []; if (!buf.length) return;
  P.reactBuf = [];
  const by = new Map();
  buf.forEach(x => { const k = x.game + '/' + x.version; if (!by.has(k)) by.set(k, { game: x.game, version: x.version, items: [] }); by.get(k).items.push({ sec: x.sec, emoji: x.emoji }); });
  by.forEach(b => api('/api/teacher/react/log', Object.assign({ code: P.code }, b)).catch(() => {}));
}
// какая игра сейчас видна на проекторе: ученики получают кнопки реакций, пока она на экране (раз в 15 секунд — «жива»)
function reportLive() {
  const f = Games.shownFrame(), src = (f && f.src) || '';
  if (src === P.liveSrc && Date.now() - (P.liveAt || 0) < 15000) return;
  if (src !== P.liveSrc) P.reacts.reset(src);
  P.liveSrc = src; P.liveAt = Date.now();
  api('/api/teacher/live', { code: P.code, src }).catch(() => {});
}
// заставка чекпоинта (Д7) и на проекторе: учитель открыл один новый чекпоинт — «Уровень N: название» на секунду
function splashOpened(o) {
  const opened = o.class.opened || [], key = o.lesson.id;
  if (P.openedFor === key && opened.length === P.opened.length + 1) {
    const cp = o.lesson.checkpoints.find(c => opened.includes(c.id) && !P.opened.includes(c.id));
    if (cp) LabKlass.splash({ n: o.lesson.checkpoints.indexOf(cp) + 1, title: cp.title, minutes: cp.minutes });
  }
  P.opened = opened.slice(); P.openedFor = key;
}
async function refresh() {
  let o;
  try { o = await api('/api/teacher/overview?code=' + encodeURIComponent(P.code)); } catch (e) { if (e.status === 401) { location.href = '/'; return; } toast(e.message, 'err'); return; }
  P.o = o; P.skew = Date.parse(o.now) - Date.now();
  splashOpened(o);
  $('#pjClass').textContent = `${o.class.name} · урок ${o.lesson.number}. ${o.lesson.title}`;
  P.mode = o.lesson.checkpoints.some(c => c.steps.some(s => s.type === 'teacher-demo')) ? 'demo' : o.lesson.wow ? 'wow' : null;
  $('#demoTab').hidden = !P.mode;
  $('#pairTab').hidden = P.mode !== 'wow';
  if (P.mode !== 'wow' && P.tab === 'pair') P.tab = 'lesson';
  if (P.lastMode !== P.mode) { // учитель сменил урок: вкладка вау-старта строится заново
    dropAsk();
    Games.stopAll(); P.tf = null; P.frameFor = null; P.wFrame = null; P.wKey = null; P.dKey = null; P.d = null; P.w = null; P.pair = null; $('#pj-pair').innerHTML = '';
    $('#pj-demo').innerHTML = ''; P.lastMode = P.mode;
  }
  if (!P.mode && P.tab === 'demo') P.tab = 'lesson';
  const m7 = o.lesson.checkpoints.some(c => c.steps.some(s => ['arena', 'bracket', 'team'].includes(s.type)));
  $('#m7Tab').hidden = !m7;
  if (!m7 && P.tab === 'm7') P.tab = 'lesson';
  const m8 = o.lesson.teamGroup === 'proekt';
  $('#m8Tab').hidden = !m8;
  if (!m8 && P.tab === 'm8') P.tab = 'lesson';
  const vs = voteStep();
  $('#cupTab').hidden = !vs;
  if (!vs && P.tab === 'cup') P.tab = 'lesson';
  const motion = o.lesson.checkpoints.some(c => c.steps.some(s => s.type === 'motion'));
  $('#teatrTab').hidden = !motion;
  if (!motion && P.tab === 'teatr') P.tab = 'lesson';
  if (P.teatr && P.teatrLesson !== o.lesson.id) { P.teatr.destroy(); P.teatr = null; } // другой урок — другие сцены
  // саботаж (Г2, сессия 4): вкладка есть, если в уроке шаг secret с форматом «саботаж»
  const sab = o.lesson.checkpoints.some(c => c.steps.some(s => s.type === 'secret' && s.hunt && s.hunt.format === 'sabotazh'));
  $('#sabTab').hidden = !sab;
  if (!sab && P.tab === 'sab') P.tab = 'lesson';
  if (P.sab && P.sabLesson !== o.lesson.id) { P.sab.destroy(); P.sab = null; }
  // карусель (Г5, сессия 5): вкладка есть, если в уроке шаг karusel
  const kar = o.lesson.checkpoints.some(c => c.steps.some(s => s.type === 'karusel'));
  $('#karTab').hidden = !kar;
  if (!kar && P.tab === 'kar') P.tab = 'lesson';
  if (P.kar && P.karLesson !== o.lesson.id) { P.kar.destroy(); P.kar = null; }
  // урок-квест и совет аула (сессия 6): вкладки есть, если в уроке шаг kvest или sovet
  for (const [tab, type] of [['kv', 'kvest'], ['sv', 'sovet']]) {
    const has = o.lesson.checkpoints.some(c => c.steps.some(s => s.type === type));
    $('#' + tab + 'Tab').hidden = !has;
    if (!has && P.tab === tab) P.tab = 'lesson';
    if (P[tab] && P[tab + 'Lesson'] !== o.lesson.id) { P[tab].destroy(); P[tab] = null; }
  }
  showTab();
  if (P.tab === 'lesson') drawLesson();
  else if (P.tab === 'day') await refreshDay();
  else if (P.tab === 'poll') await refreshPoll();
  else if (P.tab === 'final') await refreshFinal();
  else if (P.tab === 'fail') await refreshFail();
  else if (P.tab === 'cup') drawCup(vs);
  else if (P.tab === 'pair') await refreshPair();
  else if (P.tab === 'teatr') P.teatr.refresh();
  else if (P.tab === 'sab') P.sab.refresh();
  else if (P.tab === 'kar') P.kar.refresh();
  else if (P.tab === 'kv' || P.tab === 'sv') { /* живут по событиям класса */ }
  else if (P.tab === 'goal') P.goalPult.draw();
  else if (P.mode === 'wow') await refreshWow();
  else await refreshDemo();
  reportLive();
}
function showTab() {
  document.querySelectorAll('.pj-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === P.tab));
  $('#pj-lesson').hidden = P.tab !== 'lesson'; $('#pj-demo').hidden = P.tab !== 'demo'; $('#pj-day').hidden = P.tab !== 'day';
  $('#pj-poll').hidden = P.tab !== 'poll'; $('#pj-final').hidden = P.tab !== 'final';
  if (P.tab !== 'day') P.dayKey = null;
  if (P.tab !== 'poll') P.pollKey = null;
  if (P.tab !== 'final') P.finalKey = null;
  $('#pj-fail').hidden = P.tab !== 'fail';
  if (P.tab !== 'fail') { P.failKey = null; if (P.failFrame) { P.failFrame.destroy(); P.failFrame = null; } if (P.failGal) { P.failGal.destroy(); P.failGal = null; } }
  // театр сцены (В5): ушли с вкладки — показ классу заканчивается, ученики возвращаются к своим шагам
  $('#pj-teatr').hidden = P.tab !== 'teatr';
  if (P.tab === 'teatr' && !P.teatr) { P.teatr = LabKlassPult.teatr($('#pj-teatr'), { code: () => P.code, lesson: () => P.o && P.o.lesson }); P.teatrLesson = P.o.lesson.id; }
  if (P.tab !== 'teatr' && P.teatr) { P.teatr.destroy(); P.teatr = null; api('/api/teacher/theater', { code: P.code, action: 'end' }).catch(() => {}); }
  $('#pj-sab').hidden = P.tab !== 'sab';
  if (P.tab === 'sab' && !P.sab) { P.sab = LabKlassPult.sabotazh($('#pj-sab'), { code: () => P.code, lesson: () => P.o && P.o.lesson }); P.sabLesson = P.o.lesson.id; }
  if (P.tab !== 'sab' && P.sab) { P.sab.destroy(); P.sab = null; }
  $('#pj-kar').hidden = P.tab !== 'kar';
  if (P.tab === 'kar' && !P.kar) { P.kar = LabStepsM3.karuselPult($('#pj-kar'), { code: () => P.code, lesson: () => P.o && P.o.lesson }); P.karLesson = P.o.lesson.id; }
  if (P.tab !== 'kar' && P.kar) { P.kar.destroy(); P.kar = null; }
  for (const [tab, make] of [['kv', 'kvestPult'], ['sv', 'sovetPult']]) {
    $('#pj-' + tab).hidden = P.tab !== tab;
    if (P.tab === tab && !P[tab]) { P[tab] = LabStepsM47[make]($('#pj-' + tab), { code: () => P.code, lesson: () => P.o && P.o.lesson }); P[tab + 'Lesson'] = P.o.lesson.id; }
    if (P.tab !== tab && P[tab]) { P[tab].destroy(); P[tab] = null; }
  }
  $('#pj-goal').hidden = P.tab !== 'goal';
  if (P.tab === 'goal' && !P.goalPult) P.goalPult = LabKlassPult.goal($('#pj-goal'), { code: () => P.code, get: () => P.o && P.o.goal });
  if (P.tab !== 'goal' && P.goalPult) { P.goalPult = null; $('#pj-goal').innerHTML = ''; }
  $('#pj-cup').hidden = P.tab !== 'cup';
  $('#pj-m7').hidden = P.tab !== 'm7';
  if (P.tab === 'm7' && !P.m7) { P.m7 = LabM7.pult($('#pj-m7'), { code: () => P.code, lesson: () => P.o && P.o.lesson, projector: true }); P.m7.show(); }
  if (P.tab !== 'm7' && P.m7) { P.m7.hide(); P.m7 = null; $('#pj-m7').innerHTML = ''; }
  $('#pj-m8').hidden = P.tab !== 'm8';
  if (P.tab === 'm8' && !P.m8) { P.m8 = LabM8.pult($('#pj-m8'), { code: () => P.code, lesson: () => P.o && P.o.lesson, projector: true, reel: openReel }); P.m8.show(); }
  if (P.tab !== 'm8' && P.m8) { P.m8.hide(); P.m8 = null; $('#pj-m8').innerHTML = ''; }
  $('#pj-pair').hidden = P.tab !== 'pair';
  if (P.tab !== 'pair' && P.pair) { P.pair.frames.forEach(f => f.h.destroy()); P.pair = null; $('#pj-pair').innerHTML = ''; }
  if (P.tab !== 'cup' && P.cupFrame) { P.cupFrame.destroy(); P.cupFrame = null; P.cupKey = null; $('#pj-cup').innerHTML = ''; }
  if (P.tab !== 'demo' && (P.tf || P.wFrame)) {
    dropAsk();
    Games.stopAll(); P.tf = null; P.frameFor = null; P.wFrame = null; P.wKey = null;
    const gh = $('#pjWowGame'); if (gh) gh.innerHTML = ''; // остановленная рамка не остаётся на странице второй игрой
  }
}

/* ---------- мир дня: один мир одной игры урока для всего класса, живая таблица ---------- */
async function refreshDay() {
  let r;
  try { r = await api('/api/teacher/day?code=' + encodeURIComponent(P.code)); } catch (e) { toast(e.message, 'err'); return; }
  const key = JSON.stringify(r);
  if (key === P.dayKey) return; // без перерисовки: не сбивать выбор игры
  P.dayKey = key;
  const host = $('#pj-day'); host.innerHTML = '';
  const act = (url, body) => async () => { try { await api(url, Object.assign({ code: P.code }, body)); beep('done'); P.dayKey = null; await refreshDay(); } catch (e) { toast(e.message, 'err'); } };
  if (!r.day) {
    const sel = el('select', { id: 'pjDaySel', 'aria-label': 'Игра для мира дня' }, r.options.map(o => el('option', { value: o.id }, o.label)));
    host.append(el('div', { class: 'stack', style: 'gap:14px;max-width:760px' },
      el('div', { class: 'eyebrow' }, 'Мир дня'), el('h1', {}, 'Один мир на весь класс'),
      el('p', { class: 'pj-sub' }, 'Все играют одну и ту же расстановку: одно зерно, одни ручки. Таблица растёт здесь, а у каждого в игре — призрак лидера.'),
      r.options.length ? el('div', { class: 'row' }, sel, el('button', { class: 'btn', type: 'button', id: 'pjDayGo', onclick: () => act('/api/teacher/day', { option: sel.value })() }, '🌍 Дать классу мир дня'))
        : el('p', { class: 'muted' }, 'В этом уроке пока нет игры для мира дня: нужен донор урока или розданная игра класса.')));
    return;
  }
  const d = r.day;
  host.append(el('div', { class: 'pj-day' },
    el('div', { class: 'stack', style: 'gap:12px' }, el('div', { class: 'eyebrow' }, 'Мир дня · мир №' + d.seed), el('h1', {}, d.title),
      el('p', { class: 'pj-sub' }, `Сыграли: ${d.players}. Кнопка «▶ Играть» — на доске вызовов у каждого ученика.`),
      el('p', { class: 'concept' }, 'Одно зерно — честное сравнение: мир у всех одинаковый, разница только в игроке. Где здесь мастерство, а где удача?'),
      el('div', { class: 'row' }, el('button', { class: 'btn ghost small', type: 'button', onclick: act('/api/teacher/day/end') }, '■ Закончить мир дня'))),
    el('div', { class: 'pj-dtop', id: 'pjDayTop' }, d.top.length ? d.top.map(x => el('div', {}, el('span', {}, x.nick), el('b', {}, String(x.score)))) : el('p', { class: 'pj-sub' }, 'Ждём первые партии…'))));
}

/* ---------- ответы класса: голоса полосками без имён ---------- */
// По умолчанию — шаги с голосами текущего чекпоинта, иначе последнего открытого; чипы сверху переключают на любой открытый шаг.
async function refreshPoll() {
  let r;
  try { r = await api('/api/teacher/poll?code=' + encodeURIComponent(P.code)); } catch (e) { toast(e.message, 'err'); return; }
  const opened = P.o.class.opened, cp = currentCp();
  const list = r.steps.filter(x => opened.includes(x.cp));
  const key = JSON.stringify([list, P.pollStep, cp && cp.id]);
  if (key === P.pollKey) return;
  P.pollKey = key;
  const host = $('#pj-poll'); host.innerHTML = '';
  if (!list.length) { host.append(el('div', { class: 'stack', style: 'gap:12px' }, el('div', { class: 'eyebrow' }, 'Ответы класса'), el('h1', {}, 'Голосов пока нет'), el('p', { class: 'pj-sub' }, 'Шаги с выбором появятся здесь, когда учитель откроет их чекпоинт.'))); return; }
  const now = cp ? list.filter(x => x.cp === cp.id) : [];
  const view = list.filter(x => x.id === P.pollStep).length ? list.filter(x => x.id === P.pollStep) : now.length ? now : [list[list.length - 1]];
  host.append(el('div', { class: 'row pj-pollchips' }, el('span', { class: 'eyebrow' }, 'Ответы класса · без имён'), list.map(x => el('button', { type: 'button', class: 'chipbtn' + (view.includes(x) ? ' on' : ''),
    onclick: () => { P.pollStep = P.pollStep === x.id ? null : x.id; P.pollKey = null; refreshPoll(); } }, `${x.title} · ${x.n}`))));
  host.append(el('div', { class: 'pj-polls' }, view.map(x => {
    const max = x.max || Math.max(1, x.n, x.compare ? x.compare.n : 0); // max — своя шкала (модуль 3: среднее по шкале 0–10)
    // compare: под каждой полоской — тонкая полоска «тогда» (предсказание или ответ в начале урока) на той же шкале
    return el('div', { class: 'card stack pj-pollcard' }, el('div', { class: 'row' }, el('h2', { class: 'grow' }, x.title), el('span', { class: 'pj-sub' }, `ответили: ${x.n}`)),
      x.compare ? el('p', { class: 'pj-sub' }, `Тонкая полоска — «${x.compare.title}»: ${x.compare.n} ответов. Толстая — сейчас.`) : null,
      el('div', { class: 'bars' }, x.bars.map(b => el('div', { class: 'barrow' + (b.before != null ? ' cmp' : '') }, el('span', { class: 'bl' }, b.label),
        el('span', { class: 'bt' }, el('i', { style: `width:${Math.round(100 * b.n / max)}%` }), b.before != null ? el('em', { style: `width:${Math.round(100 * b.before / max)}%` }) : null),
        el('b', {}, b.show || (b.before != null ? `${b.before} → ${b.n}` : String(b.n)))))),
      x.kind === 'secret' && x.n ? el('p', { class: 'concept' }, `Спрятанную механику почувствовали вслепую ${x.bars[0].n} из ${x.n}.`) : null,
      x.note ? el('p', { class: 'concept' }, x.note) : null,
      (x.own || []).length ? el('div', { class: 'pj-own' }, x.own.map(t => el('span', { class: 'tag' }, '«' + t + '»'))) : null);
  })));
}

/* ---------- финал: стена аркады урока, рекорды, мир дня; «🤡» на карточке — в «Провал дня» ---------- */
async function refreshFinal() {
  let r, w = { again: [], fails: [] };
  try { r = await api('/api/teacher/final?code=' + encodeURIComponent(P.code)); } catch (e) { toast(e.message, 'err'); return; }
  try { w = await api('/api/teacher/wall?code=' + encodeURIComponent(P.code)); } catch (e) { /* без рейтинга «ещё раз» */ }
  const key = JSON.stringify([r, w]);
  if (key === P.finalKey) return;
  P.finalKey = key;
  const host = $('#pj-final'); host.innerHTML = '';
  const rec = c => (c.record ? `рекорд ${c.record.score} · ${c.record.nick}` : 'рекорда пока нет');
  // лидеры: мир дня и игра класса
  const day = r.day ? el('div', { class: 'card stack' }, el('div', { class: 'eyebrow' }, '🌍 Мир дня'), el('h3', {}, r.day.title || 'Мир дня'),
    r.day.top.length ? el('ol', { class: 'pj-cuptable' }, r.day.top.slice(0, 3).map((x, i) => el('li', { class: i ? '' : 'top' }, `${x.nick} — ${x.score}`))) : el('p', { class: 'muted' }, 'Партий не было.'))
    : el('div', { class: 'card stack' }, el('div', { class: 'eyebrow' }, '🌍 Мир дня'), el('p', { class: 'muted' }, 'Турнира мира дня ещё не было: вкладка «Мир дня».'));
  const cg = r.classGame ? el('div', { class: 'card stack' }, el('div', { class: 'eyebrow' }, '🃏 Игра класса'), el('h3', {}, r.classGame.title), el('p', {}, rec(r.classGame))) : null;
  // провал дня — своя вкладка; здесь короткая карточка и переход
  const f = r.fail;
  const failBox = el('div', { class: 'card stack pj-fail' }, el('div', { class: 'eyebrow' }, '🤡 Провал дня'),
    f ? el('h3', {}, `«${f.title}» · ${f.nick}`) : el('p', { class: 'muted' }, 'Самый смешной баг урока: «🤡» на карточке игры ниже.'),
    f && f.consent === 'ask' ? el('p', { class: 'pj-sub' }, 'Ждём согласия автора…') : f && f.why.length ? el('p', { class: 'pj-sub' }, f.why.join(' · ')) : null,
    el('div', {}, el('button', { class: 'btn ghost small', type: 'button', onclick: () => { P.tab = 'fail'; refresh(); } }, 'Открыть вкладку «🤡 Провал дня» →')));
  host.append(el('div', { class: 'row' }, el('div', { class: 'grow stack', style: 'gap:4px' }, el('div', { class: 'eyebrow' }, `Финал урока ${r.lesson.number}`), el('h1', {}, 'Стена аркады урока')),
      el('span', { class: 'pj-sub' }, `игр урока: ${r.games.length}`)),
    el('div', { class: 'pj-finaltop' }, day, cg, failBox),
    wallRow(w),
    r.games.length ? el('div', { class: 'agrid' }, r.games.map(c => Games.card(c, { compact: true,
      actions: [el('button', { class: 'btn ghost small', type: 'button', title: 'Провал дня: спросить автора и показать баг этой игры всему классу', onclick: () => nominateFail(c) }, '🤡 Провал дня')] })))
      : el('p', { class: 'pj-sub' }, 'Игр урока пока нет.'));
}
// одним нажатием: игра урока — в «Провал дня», автору уходит вопрос «можно показать?», проектор переходит на вкладку
async function nominateFail(c) {
  try { await api('/api/teacher/fail', { code: P.code, game: c.id, version: c.version }); beep('tick'); P.tab = 'fail'; P.failKey = null; await refresh(); } catch (e) { toast(e.message, 'err'); }
}

/* ---------- «🤡 Провал дня» (А5): согласие автора, игра в рамке, «Почему так вышло?» ---------- */
// «Сегодня» — провал этого урока; «Галерея» — все провалы класса с голосами учеников и нарезка лучших к Фестивалю (Д5, klass-pult.js)
function failSwitch() {
  return el('div', { class: 'row pj-pollchips' }, [['today', '🤡 Провал урока'], ['gallery', '🖼 Галерея и нарезка']].map(([id, label]) =>
    el('button', { type: 'button', class: 'chipbtn' + ((P.failView || 'today') === id ? ' on' : ''), 'data-fail-view': id, onclick: () => setFailView(id) }, label)));
}
function setFailView(id) {
  P.failView = id; P.failKey = null;
  if (P.failFrame) { P.failFrame.destroy(); P.failFrame = null; }
  if (P.failGal) { P.failGal.destroy(); P.failGal = null; }
  $('#pj-fail').innerHTML = '';
  return refreshFail();
}
async function openReel() { P.tab = 'fail'; await refresh(); await setFailView('gallery'); P.failGal.reel(); } // кнопка «Нарезка провалов» на Фестивале (m8-pult.js)
async function refreshFail() {
  if (P.failView === 'gallery') {
    if (!P.failGal) { const host = $('#pj-fail'), box = el('div', { class: 'stack' }); host.innerHTML = ''; host.append(failSwitch(), box); P.failGal = LabKlassPult.fails(box, { code: () => P.code }); }
    return;
  }
  let r;
  try { r = await api('/api/teacher/final?code=' + encodeURIComponent(P.code)); } catch (e) { toast(e.message, 'err'); return; }
  const f = r.fail;
  const key = JSON.stringify([f && [f.game, f.consent, f.version, f.lesson], r.games.map(c => c.id)]);
  if (key === P.failKey) return; // без перерисовки: рамка с багом, причины и поля живут
  P.failKey = key;
  if (P.failFrame) { P.failFrame.destroy(); P.failFrame = null; }
  const host = $('#pj-fail'); host.innerHTML = '';
  const setFail = async body => { try { await api('/api/teacher/fail', Object.assign({ code: P.code }, body)); beep('tick'); P.failKey = null; await refreshFail(); } catch (e) { toast(e.message, 'err'); } };
  host.append(failSwitch(), el('div', { class: 'stack', style: 'gap:6px' }, el('div', { class: 'eyebrow' }, `🤡 Провал дня · урок ${r.lesson.number}`),
    el('h1', {}, 'Баг — повод посмеяться и разобраться'),
    el('p', { class: 'pj-sub' }, 'Не оценка, а находка: самый смешной или поучительный баг урока. Показываем только с согласия автора.')));
  const pick = note => el('div', { class: 'stack' }, note ? el('p', { class: 'concept' }, note) : null,
    r.games.length ? el('div', { class: 'agrid' }, r.games.map(c => Games.card(c, { compact: true,
      actions: [el('button', { class: 'btn small', type: 'button', 'data-fail-pick': c.id, onclick: () => setFail({ game: c.id, version: c.version }) }, '🤡 Показать этот баг')] })))
      : el('p', { class: 'pj-sub' }, 'Игр урока пока нет: провал дня выбирают из игр этого урока.'));
  if (!f) { host.append(pick('Нажмите «🤡» на игре, где случилось самое смешное. Автор увидит вопрос на своём экране.')); return; }
  if (f.consent === 'ask') {
    host.append(el('div', { class: 'card stack pj-fail pj-fail-wait' }, el('div', { class: 'eyebrow' }, 'Ждём согласия автора'),
      el('h2', {}, `«${f.title}» · ${f.nick}`), el('p', { class: 'pj-sub' }, 'На экране автора — вопрос «Можно показать твой баг классу?». Игра откроется здесь, как только он нажмёт «Можно».'),
      el('div', {}, el('button', { class: 'btn ghost small', type: 'button', onclick: () => setFail({ game: null }) }, '✕ Отменить'))));
    return;
  }
  if (f.consent === 'no') { host.append(pick(`Автор «${f.title}» попросил не показывать — это его право. Выберите другой баг.`)); return; }
  const sel = el('select', { 'aria-label': 'Версия с багом' }, f.versions.map(v => el('option', { value: v.n, selected: v.n === f.version ? true : null }, `v${v.n} · ${v.kind}${v.error ? ' · ошибка' : ''}`)));
  const note = el('input', { type: 'text', maxlength: '200', placeholder: 'Что случилось — одной фразой', value: f.note || '', 'aria-label': 'Что случилось' });
  const moral = el('input', { type: 'text', maxlength: '200', placeholder: 'Что поняли: как не повторить', value: f.moral || '', 'aria-label': 'Что поняли' });
  const why = new Set(f.why);
  const chips = el('div', { class: 'row pj-failwhy', role: 'group', 'aria-label': 'Почему так вышло' }, r.failWhy.map(t => {
    const b = el('button', { type: 'button', class: 'chipbtn' + (why.has(t) ? ' on' : ''), 'aria-pressed': String(why.has(t)) }, t);
    b.addEventListener('click', () => { if (why.has(t)) why.delete(t); else why.add(t); b.classList.toggle('on', why.has(t)); b.setAttribute('aria-pressed', String(why.has(t))); beep('tick'); });
    return b;
  }));
  P.failFrame = Games.frame({ src: () => `/play/${f.game}/${sel.value}`, key: () => 'fail:' + f.game, score: false, label: 'Показать баг',
    onError: err => P.failFrame.message(el('b', {}, 'Игра упала: ' + (err.message || 'ошибка') + ' — это тоже провал дня!')) });
  sel.addEventListener('change', () => { P.failFrame.start(); });
  const save = () => setFail({ game: f.game, version: sel.value, note: note.value, moral: moral.value, why: [...why] });
  host.append(el('div', { class: 'pj-failgrid' },
    el('div', { class: 'card stack pj-fail' }, el('div', { class: 'row' }, el('h2', { class: 'grow' }, `«${f.title}» · ${f.nick}`), sel),
      P.failFrame.box, Games.bar(P.failFrame)),
    el('div', { class: 'card stack pj-failtalk' }, el('div', { class: 'eyebrow' }, 'Разбираем всем классом'),
      el('label', { class: 'lbl' }, 'Что случилось?'), note,
      el('label', { class: 'lbl' }, 'Почему так вышло? Отметьте, что предложил класс'), chips,
      el('label', { class: 'lbl' }, 'Что поняли?'), moral,
      el('div', { class: 'row' }, el('button', { class: 'btn', type: 'button', onclick: save }, 'Сохранить разбор'), el('span', { class: 'grow' }),
        el('button', { class: 'btn ghost small', type: 'button', onclick: () => setFail({ game: null }) }, '✕ Убрать'))),
    f.note || f.why.length || f.moral ? el('p', { class: 'pj-sub pj-failsaved' }, '✓ ' + [f.note, f.why.join(', '), f.moral].filter(Boolean).join(' · ')) : null));
}

// финал: рейтинг «ещё раз» (чужие игроки сами захотели вернуться — главный тест курса)
// и эксперимент, где предсказание не сбылось: несбывшееся предсказание — находка, а не ошибка. Ник не показывается
function wallRow(w) {
  const again = el('div', { class: 'card stack' }, el('div', { class: 'eyebrow' }, '🔁 Ещё раз!'),
    w.again.length ? el('ol', { class: 'pj-again' }, w.again.map(g => el('li', {}, el('span', { class: 'pj-ag-n' }, String(g.again)),
      el('div', {}, el('b', {}, g.title), el('div', { class: 'pj-sub' }, `${g.emblem ? g.emblem + ' ' : ''}${g.nick} · сыграли ${g.plays}`)))))
      : el('p', { class: 'muted' }, 'Пока никто не нажал «ещё раз» в чужой игре: захотел ли игрок вернуться сам — главный тест.'));
  const f = w.fails[0];
  const surprise = el('div', { class: 'card stack' }, el('div', { class: 'eyebrow' }, '🧪 Предсказание не сбылось'),
    f ? el('div', { class: 'stack', style: 'gap:6px' }, el('p', {}, el('b', {}, 'Предсказали: '), f.guess || '—'),
      el('p', {}, `Ручка ${f.knob}: ${f.from} → ${f.to}. Счёт ${f.before.score} → ${f.after.score}, партия ${f.before.time} → ${f.after.time} с.`),
      el('p', { class: 'pj-big' }, f.result + '!'), f.noticed ? el('p', {}, el('b', {}, 'Заметили: '), f.noticed) : null)
      : el('p', { class: 'muted' }, 'Появится, когда чьё-то предсказание в эксперименте с ручкой не сбудется. Это лучшая находка урока.'));
  return el('div', { class: 'pj-wallrow' }, again, surprise);
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
    el('div', { class: 'pj-sub' }, `учеников: ${total}` + (total ? ` · на связи: ${onl}` : '')), LabKlassPult.goalStrip(o.goal)));
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
    el('button', { class: 'btn ghost small', type: 'button', disabled: building || null, onclick: async () => { if (!(await Lab.ask('Начать заново: новые карты, новая игра?', { ok: 'Начать заново' }))) return; try { await api('/api/teacher/demo/reset', { code: P.code }); Games.stopAll(); P.tf = null; P.frameFor = null; $('#pjGame').innerHTML = ''; await refreshDemo(); } catch (e) { toast(e.message, 'err'); } } }, '↺ Новые карты')].filter(Boolean));
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
      get: () => P.d.game, label: 'Играть в игру класса', autostart: true,
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
// барабан карты: мелькают имена из колоды, потом карта встаёт (face — как нарисовать итог, например «имя — особенность»)
function spin(node, deck, final, face) {
  if (!deck.length) return;
  beep('dice');
  let n = 0;
  const t = setInterval(() => {
    node.textContent = Games.cardParts(deck[Math.floor(Math.random() * deck.length)])[0];
    if (++n > 12) { clearInterval(t); node.textContent = ''; node.append(...(face ? face(final) : [final])); node.parentNode.classList.add('landed'); beep('good'); }
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

/* ---------- «Спрятанная механика рядом»: две копии игры класса, бот играет обе в настоящем времени ---------- */
const PAIR_SECONDS = 60, PAIR_SEED = 4242;
async function refreshPair() {
  let r;
  try { r = await api('/api/teacher/wow?code=' + encodeURIComponent(P.code)); } catch (e) { toast(e.message, 'err'); return; }
  const host = $('#pj-pair'), g = r.game, sec = r.built;
  const gkey = g && sec ? g.id + '/' + g.version : null;
  if (P.pair && P.pair.gkey === gkey) return; // рамки уже стоят: не сбивать показ
  if (P.pair) { P.pair.frames.forEach(f => f.h.destroy()); P.pair = null; }
  host.innerHTML = '';
  if (!gkey) { host.append(el('div', { class: 'card' }, el('h2', {}, 'Спрятанная механика рядом'), el('p', { class: 'pj-sub' }, 'Сначала соберите игру класса во вкладке «Вау-старт».'))); return; }
  const knob = g.knob || 'secret';
  const side = (withSecret) => {
    const res = el('p', { class: 'pj-sub', 'aria-live': 'polite' }, withSecret ? 'Лупа загорается каждый раз, когда срабатывает спрятанная механика.' : 'Та же игра с выключенной спрятанной механикой.');
    const f = { res, withSecret, done: null };
    f.h = Games.frame({ src: () => `/play/${g.id}/${g.version}`, key: () => 'pair:' + g.id, label: withSecret ? 'Со спрятанной механикой' : 'Без спрятанной механики', score: false, pair: 'secret',
      cfg: withSecret ? null : { [knob]: 0 }, reveal: withSecret ? sec.title : null,
      onReady: () => f.h.post({ type: 'botShow', options: { seconds: PAIR_SECONDS, seed: PAIR_SEED, strategy: 'random', mute: !withSecret } }),
      onShow: m => {
        if (m.type === 'showStep') { res.textContent = `Бот играет: ${m.t} из ${m.seconds} с`; return; }
        if (m.error) { res.textContent = 'Бот не смог сыграть: ' + m.error + '. Сыграйте копию сами — лупа всё равно горит.'; return; }
        f.done = m.result; drawResult();
      },
      onError: err => f.h.message(el('b', {}, 'Игра упала: ' + (err.message || 'ошибка'))) });
    f.box = el('div', { class: 'pj-pair-side', 'data-side': withSecret ? 'on' : 'off' }, el('h2', {}, withSecret ? '🔍 Со спрятанной механикой' : 'Без спрятанной механики'), f.h.box, res);
    return f;
  };
  const off = side(false), on = side(true);
  function line(x) { return `${x.seconds} с · очки ${x.score} · урон ${x.hurts}`; }
  function drawResult() {
    [off, on].forEach(f => { if (f.done) f.res.textContent = line(f.done) + (f.withSecret ? ` · спрятанная механика сработала ${f.done.secret} раз` : ''); });
    if (off.done && on.done) beep('done');
  }
  const head = el('h1', { class: 'grow' }, 'Спрятанная механика рядом'); // название спрятанной механики — только после запуска: вкладку могли открыть до разгадки
  const run = el('button', { class: 'btn warm', type: 'button', id: 'pjPairRun', onclick: () => { head.textContent = 'Спрятанная механика рядом: «' + sec.title + '»'; off.done = on.done = null; off.h.start(); on.h.start(); } }, `▶ Бот играет обе копии (${PAIR_SECONDS} с)`);
  P.pair = { gkey, frames: [off, on] };
  host.append(el('div', { class: 'row' }, head, run),
    el('p', { class: 'pj-sub' }, 'Один мир, одни и те же нажатия бота-новичка. Копии расходятся только из-за спрятанной механики. Показывайте после шага «Найди спрятанную механику».'),
    el('div', { class: 'pj-pair-grid' }, off.box, on.box));
}

/* ---------- вау-старт урока с колодой wow: пять вопросов, сборка, раздача общей игры ---------- */
async function refreshWow() {
  const seq = P.wSeq = (P.wSeq || 0) + 1;
  let r;
  try { r = await api('/api/teacher/wow?code=' + encodeURIComponent(P.code)); } catch (e) { toast(e.message, 'err'); return; }
  if (seq !== P.wSeq) return;
  P.w = r;
  drawWow();
}
// Вау-старт пятью вопросами (wow.ask, решение автора 19.10.2026): пробел — портал выкладывает три карты вопроса, класс голосует с ноутбуков,
// полоски растут на глазах; по таймеру или по пробелу — итог: карта-победитель вспыхивает, летит под свою опору, опора растёт,
// строка проявляется в документе, слой — в наброске игры. Когда опор пять — сборка игры с ИИ, как раньше.
function dropAsk() {
  if (!P.ask) return;
  P.ask.scene.destroy(); clearInterval(P.ask.timer); P.ask = null;
}
function buildAsk(r) {
  const host = $('#pj-demo');
  host.innerHTML = '';
  dropAsk();
  const scene = Opory.scene({ cards: r.cards, look: r.look, onAsk: id => askOffer(id) });
  const A = P.ask = { scene, steps: el('div', { class: 'op-steps', style: '--n:' + r.cards.length }), q: el('div', { class: 'op-q' }), picks: el('div', { class: 'op-picks' }),
    ctl: el('div', { class: 'op-ctl' }), offerId: null, lastShown: r.wow.last ? r.wow.last.id : null, end: 0, full: 1, total: 1, picked: false, busy: false, flying: false, ticked: 0, polled: 0 };
  host.append(el('div', { class: 'stack', id: 'pjAsk' },
    el('div', { class: 'pj-dhead' }, el('div', { class: 'grow' }, el('div', { class: 'eyebrow' }, 'Вау-старт · пять вопросов геймдизайнера'),
      el('div', { class: 'pj-sub' }, 'Отвечаем всем классом на пять вопросов. Каждый ответ — опора нашей игры. Пять опор держат гейм дизайн документ, по нему ИИ соберёт игру, и мы в неё сыграем.'))),
    A.steps, el('div', { class: 'op-ask' }, el('div', { class: 'op-ask-main' }, A.q, A.picks, A.ctl), el('div', { class: 'op-ask-side' }, scene.roof, scene.base, scene.cap)),
    el('div', { id: 'pjWowLink' }), el('div', { id: 'pjWowCtrl', class: 'row' }), el('div', { id: 'pjWowGame', class: 'stack' })));
  scene.update(r.wow.cards, r.frame); // итог прошлых вопросов уже был до открытия вкладки — без полёта
  A.timer = setInterval(askTick, 200);
}
function askQuestion(c, i, n) {
  const q = P.ask.q;
  q.innerHTML = ''; q.dataset.op = c.id;
  q.append(el('div', { class: 'eyebrow' }, `Вопрос ${i + 1} из ${n} · опора «${c.pillar || c.label}»`), el('h1', {}, c.q || c.label), el('p', { class: 'op-why' }, c.why || ''));
}
function drawAsk() {
  const r = P.w, w = r.wow;
  if (!P.ask || !$('#pjAsk')) buildAsk(r);
  const A = P.ask, o = r.offer, cards = r.cards, next = cards.find(c => !w.cards[c.id]);
  A.steps.innerHTML = '';
  cards.forEach((c, i) => {
    const t = w.cards[c.id], f = Opory.face(t, r.look), now = o ? o.card === c.id : !!next && next.id === c.id;
    A.steps.append(el('div', { class: 'op-step' + (t ? ' done' : '') + (now ? ' now' : ''), 'data-op': c.id },
      el('b', {}, `${i + 1}. ${c.pillar || c.label}`), el('span', {}, t ? `${f.em} ${c.id === 'twist' ? t : f.name}`.trim() : c.q || c.label)));
  });
  A.total = Math.max(1, P.o.students.filter(s => s.online).length);
  if (o && o.id !== A.offerId) { // новый вопрос: три карты ложатся на стол
    const c = cards.find(x => x.id === o.card);
    Object.assign(A, { offerId: o.id, end: Date.now() + o.left, full: Math.max(1, o.left), picked: false, ticked: 0, flying: false });
    askQuestion(c, cards.indexOf(c), cards.length);
    A.picks.innerHTML = '';
    o.options.forEach(t => A.picks.append(Opory.pick(t, c, r.look)));
    beep('dice');
  }
  if (o) Opory.paintVotes(A.picks, o.counts, A.total);
  const last = w.last;
  if (!o && last && last.id !== A.lastShown) { // итог: победитель вспыхивает и летит под свою опору
    A.lastShown = last.id;
    const shown = A.offerId === last.id ? [...A.picks.children] : [];
    if (shown.length) {
      Opory.paintVotes(A.picks, last.counts, A.total);
      shown.forEach((p, i) => p.classList.add(i === last.option ? 'win' : 'lose'));
      const win = shown[last.option];
      Opory.confetti(win, ['#ffb547', '#7cf5a8', '#b49bff', '#ff5d6e', '#5fe0ff']); beep('done');
      A.flying = true;
      setTimeout(() => Opory.fly(win, A.scene.slot(last.card), () => {
        if (P.ask !== A) return;
        A.flying = false; A.offerId = null; A.picks.innerHTML = '';
        P.wKey = null; drawWow();
      }), 900);
    }
  }
  if (!A.flying) A.scene.update(w.cards, r.frame);
  if (!o && A.offerId && !A.flying) { A.offerId = null; A.picks.innerHTML = ''; } // голосование закрыли без итога: учитель вытянул карту сам
  if (!o && !A.picks.children.length) { // между вопросами: следующий вопрос или игра готова к сборке
    A.q.innerHTML = '';
    if (!next) {
      delete A.q.dataset.op;
      A.q.append(el('div', { class: 'op-ready' }, el('div', { class: 'eyebrow' }, 'Пять из пяти'), el('h1', {}, 'Игра класса готова к сборке'),
        el('p', { class: 'op-why' }, 'Опоры стоят, документ заполнен. Нажмите на любую опору справа: что сломается, если её убрать? Потом — Enter, и ИИ соберёт игру.'),
        el('div', { class: 'op-flow' }, el('span', {}, '📄 документ'), el('i', {}, '→'), el('span', {}, '🤖 ИИ собирает'), el('i', {}, '→'), el('span', {}, '🎮 играем всем классом'), el('i', {}, '→'), el('span', {}, '🔍 ищем спрятанную механику'))));
    } else {
      askQuestion(next, cards.indexOf(next), cards.length);
      A.q.append(el('p', { class: 'op-wait' }, 'Пробел — портал выложит три карты. Голосуйте у себя на ноутбуке.'));
    }
  }
  drawAskCtl();
}
function drawAskCtl() {
  const A = P.ask, r = P.w, w = r.wow, o = r.offer, next = r.cards.find(c => !w.cards[c.id]);
  A.ctl.innerHTML = '';
  if (w.given || w.status === 'building' || P.job) return;
  if (o) A.ctl.append(el('div', { class: 'op-timer', id: 'pjAskTimer' }, ''),
    el('button', { class: 'btn warm', type: 'button', id: 'pjAskPick', onclick: askPick }, '✓ Подвести итог', el('kbd', {}, 'пробел')),
    el('button', { class: 'btn ghost', type: 'button', onclick: () => askOffer(o.card) }, '🎲 Другие карты'),
    el('span', { class: 'muted small' }, `проголосовали: ${o.voted} из ${A.total}`));
  else if (next && !A.flying) A.ctl.append(el('button', { class: 'btn', type: 'button', id: 'pjAskNext', onclick: () => askOffer() }, `❓ ${next.q || next.label}`, el('kbd', {}, 'пробел')));
  askTick();
}
function askTick() {
  const A = P.ask, r = P.w;
  if (!A || !r || !r.offer || A.offerId !== r.offer.id || P.tab !== 'demo') return;
  const left = Math.max(0, A.end - Date.now()), sec = Math.ceil(left / 1000), box = $('#pjAskTimer');
  if (box) { box.textContent = sec; box.style.setProperty('--p', left / A.full); box.classList.toggle('hot', sec <= 5); }
  if (sec <= 3 && sec > 0 && A.ticked !== sec) { A.ticked = sec; beep('tick'); }
  if (left <= 0 && !A.picked) { A.picked = true; askPick(); }
  if (!A.busy && Date.now() - A.polled > 800) { A.polled = Date.now(); A.busy = true; refreshWow().finally(() => { A.busy = false; }); } // голоса растут почти сразу
}
async function askOffer(card) {
  try { await api('/api/teacher/wow/offer', card ? { code: P.code, card } : { code: P.code }); await refreshWow(); } catch (e) { toast(e.message, 'err'); }
}
async function askPick() {
  const o = P.w && P.w.offer;
  if (!o) return;
  try { await api('/api/teacher/wow/pick', { code: P.code, offer: o.id }); await refreshWow(); } catch (e) { toast(e.message, 'err'); }
}
function drawWow() {
  const r = P.w, w = r.wow;
  const ready = r.cards.every(c => w.cards[c.id]), busy = w.status === 'building' || !!P.job;
  const key = JSON.stringify([w.cards, w.status, w.given, w.link, r.offer && [r.offer.id, r.offer.counts], w.last && w.last.id, r.game && r.game.id + '/' + r.game.version, !!P.job, P.o.students.length, P.o.students.filter(s => s.online).length]);
  if (key === P.wKey) return;
  P.wKey = key;
  drawAsk();
  const lh = $('#pjWowLink'); lh.innerHTML = '';
  const link = w.link && w.link.cards === JSON.stringify(w.cards) ? w.link : null;
  lh.append(Games.linkBox({ link, ready, editable: !w.given && !busy, code: P.code, onChange: () => { P.wKey = null; refreshWow(); } }));
  const total = P.o.students.length, onl = P.o.students.filter(s => s.online).length;
  const ctrl = $('#pjWowCtrl'); ctrl.innerHTML = '';
  ctrl.append(...[
    !w.given ? el('button', { class: 'btn' + (ready && !r.game ? '' : ' ghost'), type: 'button', id: 'pjWowBuild', disabled: !ready || busy || null, onclick: wowBuild }, r.game ? '↻ Собрать заново' : '⚙ Собрать игру с ИИ', el('kbd', {}, 'Enter')) : null,
    r.game && w.status === 'preview' ? (w.given ? el('button', { class: 'btn ghost', type: 'button', onclick: () => wowGive(false) }, 'Забрать у класса')
      : el('button', { class: 'btn warm', type: 'button', id: 'pjWowGive', onclick: () => wowGive(true) }, '📣 Раздать классу')) : null,
    el('span', { class: 'grow' }),
    el('span', { class: 'muted small' }, `на связи: ${onl} из ${total}`)].filter(Boolean));
  const gh = $('#pjWowGame');
  if (P.job) return; // прогресс сборки рисует wowBuild()
  const status = { cards: ready ? 'Пять опор стоят. Enter — ИИ соберёт игру класса.' : 'Отвечаем на вопросы: ' + r.cards.map(c => (c.pillar || c.label).toLowerCase()).join(', ') + '.', building: '⚙ Qwen собирает игру класса прямо сейчас…', preview: w.given ? '✓ Игра у всех — играйте!' : 'Игра собрана. Проверим её здесь и раздадим классу.' }[w.status] || '';
  const gkey = r.game ? r.game.id + '/' + r.game.version : null;
  if (!gkey || P.wFrame && P.wFrame.gkey !== gkey) { if (P.wFrame) { P.wFrame.h.destroy(); P.wFrame = null; } gh.innerHTML = ''; }
  if (!gkey) { gh.append(el('p', { class: 'pj-sub', id: 'pjWowStatus' }, status)); return; }
  if (!P.wFrame) {
    gh.innerHTML = ''; // после вкладки «Урок» рамка остановлена, но её коробка ещё на странице — иначе на проекторе две игры
    const g = r.game;
    const h = Games.frame({ src: () => `/play/${g.id}/${g.version}`, key: () => 'wow:' + g.id, label: 'Играть в игру класса', score: false,
      onError: err => h.message(el('b', {}, 'Игра упала: ' + (err.message || 'ошибка') + '. Соберите заново или возьмите запасную игру в панели учителя.')) });
    P.wFrame = { h, gkey };
    gh.append(el('p', { class: 'pj-sub', id: 'pjWowStatus' }), el('h2', {}, g.title || 'Игра класса'), h.box, Games.bar(h, el('span', {})));
  }
  const ws = $('#pjWowStatus'); if (ws) ws.textContent = status;
}
async function wowGive(given) {
  try { await api('/api/teacher/wow/give', { code: P.code, given }); if (given) beep('done'); await refreshWow(); } catch (e) { toast(e.message, 'err'); }
}
async function wowBuild() {
  if (P.job) return;
  if (P.wFrame) { P.wFrame.h.destroy(); P.wFrame = null; }
  const gh = $('#pjWowGame'); gh.innerHTML = '';
  const p = el('p', {}, 'Qwen собирает игру класса при всех…');
  gh.append(el('div', { class: 'progress pj-progress' }, el('div', { class: 'spinner' }), p, el('p', { class: 'muted small' }, 'Пока ИИ пишет — спросите класс: что почувствует игрок?')));
  P.job = true; P.wKey = null;
  try {
    await Lab.job('/api/teacher/wow/build', { code: P.code }, j => { p.textContent = `Qwen собирает игру класса… ${mmss(j.seconds)}` + (j.chars ? ` · ${j.chars.toLocaleString('ru-RU')} символов кода` : '') + (j.phase === 'синтаксис' ? ' · чинит опечатку' : ''); });
    beep('done'); toast('Игра класса собрана!', 'ok');
  } catch (e) { toast(e.message, 'err', 8000); }
  P.job = null; P.wKey = null; gh.innerHTML = '';
  await refreshWow();
}

/* ---------- события ---------- */
/* ---------- выставка и турнир (урок 8): лидеры номинаций и кнопочный турнир в игре-победителе ---------- */
function voteStep() { return P.o.lesson.checkpoints.flatMap(c => c.steps).find(s => s.type === 'vote') || null; }
function drawCup(step) {
  const host = $('#pj-cup'), t = (P.o.votes || {})[step.id] || { voters: 0, noms: [] };
  const cupNom = t.noms.find(n => n.id === step.tournament) || t.noms[0];
  const win = cupNom && cupNom.top[0];
  if (!host.firstChild) host.append(el('div', { class: 'pj-cp' }, el('div', { class: 'eyebrow' }, 'Выставка джема'), el('h2', {}, step.title), el('div', { id: 'pjNoms' })),
    el('div', { class: 'pj-cp', id: 'pjCupBox' }));
  const noms = $('#pjNoms'); noms.innerHTML = '';
  noms.append(el('p', { class: 'pj-sub' }, t.voters ? `проголосовали: ${t.voters} из ${P.o.students.length}` : 'Голосов пока нет: ученики играют в игры класса и голосуют в шаге «' + step.title + '»'),
    el('div', { class: 'pj-noms' }, t.noms.map(n => el('div', { class: 'pj-nom' }, el('div', { class: 'eyebrow' }, n.label),
      n.top[0] ? el('h3', {}, n.top[0].title) : el('h3', { class: 'muted' }, '—'),
      n.top[0] ? el('div', { class: 'pj-sub' }, `${n.top[0].nick} · голосов ${n.top[0].votes}`) : null))));
  const box = $('#pjCupBox');
  if (!win) { box.innerHTML = ''; P.cupKey = null; box.append(el('p', { class: 'pj-sub' }, `Игра турнира — победитель номинации «${cupNom ? cupNom.label : ''}». Она появится здесь после первых голосов.`)); return; }
  const key = win.game + '/' + win.version;
  if (P.cupKey !== key) { // рамка строится один раз на игру: обновление проектора её не трогает
    if (P.cupFrame) P.cupFrame.destroy();
    box.innerHTML = ''; P.cupKey = key; P.cup = [];
    const name = el('input', { type: 'text', id: 'pjCupName', maxlength: '24', placeholder: 'Кто играет', class: 'pj-cupname' });
    const h = Games.frame({ src: () => `/play/${win.game}/${win.version}`, key: () => 'cup:' + win.game, label: 'Начать турнир', score: false,
      onOver: m => { P.cup.push({ name: name.value.trim() || `Игрок ${P.cup.length + 1}`, score: m.score || 0 }); name.value = ''; beep('done'); drawTable(); },
      onError: err => h.message(el('b', {}, 'Игра упала: ' + (err.message || 'ошибка'))) });
    P.cupFrame = h;
    box.append(el('div', { class: 'eyebrow' }, `Кнопочный турнир · «${cupNom.label}»`), el('h2', {}, `${win.title} — автор ${win.nick}`),
      el('div', { class: 'row' }, name, el('span', { class: 'pj-sub' }, 'Каждый играет одну партию. Лучший счёт — наверху.')), h.box, Games.bar(h, el('span', {})), el('div', { id: 'pjCupTable' }));
    drawTable();
  }
}
function drawTable() {
  const tb = $('#pjCupTable'); if (!tb) return;
  tb.innerHTML = '';
  const rows = P.cup.slice().sort((a, b) => b.score - a.score);
  if (rows.length) tb.append(el('ol', { class: 'pj-cuptable' }, rows.map((r, i) => el('li', { class: i === 0 ? 'top' : '' }, el('b', {}, r.name), ' — ', String(r.score)))));
}

document.querySelectorAll('.pj-tabs button').forEach(b => b.addEventListener('click', () => { P.tab = b.dataset.tab; refresh(); }));
$('#pjFull').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); });
addEventListener('keydown', e => {
  if (P.tab !== 'demo' || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) return;
  if (P.mode === 'wow') {
    const w = P.w && P.w.wow;
    if (!w || w.given || w.status === 'building' || P.job) return;
    if (e.code === 'Space') { e.preventDefault(); if (P.w.offer) askPick(); else if (!(P.ask && P.ask.flying) && P.w.cards.some(c => !w.cards[c.id])) askOffer(); }
    if (e.code === 'Enter' && !P.w.game && P.w.cards.every(c => w.cards[c.id])) { e.preventDefault(); wowBuild(); }
    return;
  }
  if (!P.d) return;
  if (e.code === 'Space') { e.preventDefault(); drawNext(); }
  if (e.code === 'Enter' && !P.d.ready && !P.job) { e.preventDefault(); if (CARDS.every(([k]) => P.d.cards[k])) build(); }
});

boot();
