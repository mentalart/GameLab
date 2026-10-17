// Панель учителя: классы, чекпоинты с таймером, живой урок (где каждый ученик, кубики, ошибки, запросы к ИИ, «застряли»), проектор,
// отзыв учителя, сравнение моделей, вау-старт, аркада класса, настройки и лимиты ИИ, отчёт журнала генераций, заметки автора со статусом.
'use strict';
const { el, api, toast, copy, beep, fmtTime, fieldEditor, valText } = Lab;
const $ = s => document.querySelector(s);
const T = { classes: [], lessons: [], modules: [], module: null, code: null, overview: null, timer: null, skew: 0, demo: false, filter: 'all' };

async function boot() {
  try { await loadClasses(); } catch (e) { if (e.status === 401) { location.href = '/'; return; } toast(e.message, 'err'); return; }
  api('/api/info').then(i => { $('#demoBanner').hidden = !i.demo; T.demo = i.demo; });
  try { T.code = localStorage.getItem('lab:teacher:class'); } catch (e) { /* пусто */ }
  if (!T.classes.find(c => c.code === T.code)) T.code = T.classes[0] ? T.classes[0].code : null;
  drawClassSel();
  await selectClass(T.code);
  T.timer = setInterval(refresh, 3000);
}
async function loadClasses() {
  const r = await api('/api/teacher/classes');
  T.classes = r.classes; T.lessons = r.lessons; T.modules = r.modules || [];
}
const lessonOf = id => T.lessons.find(l => l.id === id);
const moduleLessons = m => T.lessons.filter(l => l.module === m);
function drawClassSel() {
  // классы — строки списка, а не <select>: у раскрытого <select> клавиша Del до страницы не доходит
  const sel = $('#classSel'); sel.innerHTML = '';
  if (!T.classes.length) sel.append(el('div', { class: 'muted small' }, 'Классов пока нет — создайте ниже'));
  T.classes.forEach(c => sel.append(el('button', { type: 'button', class: 'classrow' + (c.code === T.code ? ' on' : ''), role: 'option', 'aria-selected': String(c.code === T.code), 'data-code': c.code, onclick: () => pickClass(c.code) }, `${c.name} · ${c.code}`)));
  const cls = T.classes.find(c => c.code === T.code), cur = cls && lessonOf(cls.lesson);
  if (T.module == null) T.module = cur ? cur.module : 1;
  drawModuleSel();
}
// меню модулей над классом: в списке «Урок» — только уроки выбранного модуля
function drawModuleSel() {
  const ms = $('#moduleSel'); ms.innerHTML = '';
  T.modules.forEach(m => {
    const n = moduleLessons(m.number).length;
    ms.append(el('option', { value: m.number, selected: m.number === T.module ? true : null }, (m.number ? `${m.number}. ` : '') + m.title + (n ? '' : ' · уроков пока нет')));
  });
  drawLessonSel();
}
function drawLessonSel() {
  const ls = $('#lessonSel'); ls.innerHTML = '';
  const list = moduleLessons(T.module), cur = T.overview && T.overview.class.lesson;
  if (!list.length) ls.append(el('option', { value: '' }, 'В этом модуле уроков пока нет'));
  else if (!list.some(l => l.id === cur)) ls.append(el('option', { value: '', selected: true }, 'Выберите урок модуля'));
  list.forEach(l => ls.append(el('option', { value: l.id, selected: l.id === cur ? true : null }, `Урок ${l.number}. ${l.title}`)));
}
async function selectClass(code) {
  T.code = code;
  try { localStorage.setItem('lab:teacher:class', code || ''); } catch (e) { /* пусто */ }
  $('#classBox').hidden = !code;
  if (!code) { $('#tab-lesson').innerHTML = ''; $('#tab-lesson').append(el('div', { class: 'card' }, 'Создайте класс слева: получите код, по которому ученики войдут в урок.')); return; }
  await refresh(true);
}
async function refresh(full) {
  if (!T.code) return;
  let o;
  try { o = await api('/api/teacher/overview?code=' + T.code); } catch (e) { if (full) toast(e.message, 'err'); return; }
  T.overview = o; T.skew = Date.parse(o.now) - Date.now();
  $('#classCode').textContent = o.class.code;
  $('#classLink').textContent = `Адрес: ${location.origin}/?code=${o.class.code}`;
  if (T.lastLesson !== o.class.lesson) { // урок класса сменился — меню модулей переходит в его модуль
    T.lastLesson = o.class.lesson;
    const l = lessonOf(o.class.lesson); if (l) T.module = l.module;
    drawModuleSel();
  }
  const sw = $('#authorSw'); sw.classList.toggle('on', !!o.class.authorMode); sw.setAttribute('aria-checked', String(!!o.class.authorMode));
  drawLesson();
}

/* ---------- вкладка «Урок»: живой урок ---------- */
const mmss = sec => { const x = Math.max(0, Math.round(sec)); return String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0'); };
const rub = x => (Math.round((x || 0) * 100) / 100).toLocaleString('ru-RU');
const FILTERS = [
  ['all', 'Все', () => true],
  ['stuck', 'Застряли', s => s.stuck],
  ['dice', 'Кубик 3+', s => s.dice >= 3],
  ['error', 'Ошибка игры', s => s.game && s.game.error],
  ['limit', 'Лимит ИИ на исходе', s => s.aiLimit - s.aiCalls <= 3],
];
function drawLesson() {
  const o = T.overview, host = $('#tab-lesson');
  const keepScroll = scrollY;
  host.innerHTML = '';
  const opened = o.class.opened;
  const cps = o.lesson.checkpoints;
  const nextCp = cps.find(c => !opened.includes(c.id));
  host.append(el('div', { class: 'row' },
    el('div', { class: 'grow stack', style: 'gap:2px' }, el('div', { class: 'eyebrow' }, `Урок ${o.lesson.number} · донор ${o.lesson.donor}`), el('h2', {}, o.lesson.title)),
    el('a', { class: 'btn warm', href: '/projector?code=' + o.class.code, target: 'lab-projector', rel: 'opener', id: 'projectorBtn' }, '📽 Проектор ↗'),
    nextCp ? el('button', { class: 'btn', type: 'button', onclick: () => setOpened(opened.concat(nextCp.id)) }, `Открыть: ${nextCp.title} →`) : el('span', { class: 'tag ok' }, 'все чекпоинты открыты'),
    el('button', { class: 'btn ghost small', type: 'button', onclick: () => setOpened(cps.map(c => c.id)) }, 'Открыть все'),
    el('button', { class: 'btn ghost small', type: 'button', onclick: () => { if (confirm('Закрыть все чекпоинты?')) setOpened([]); } }, 'Закрыть все')));
  host.append(el('p', { class: 'muted small' }, o.lesson.goal));
  host.append(spendBar(o));
  const total = o.students.length;
  const studentsAt = id => o.students.filter(s => s.where && cps.find(c => c.id === id).steps.some(st => st.id === s.where)).length;
  const finished = c => o.students.filter(s => c.steps.every(st => s.doneSteps.includes(st.id))).length;
  host.append(el('div', { class: 'stack', style: 'gap:6px' }, cps.map((c, i) => {
    const on = opened.includes(c.id);
    const sw = el('div', { class: 'switch' + (on ? ' on' : ''), role: 'switch', tabindex: '0', 'aria-checked': String(on), 'aria-label': 'Открыть чекпоинт ' + c.title });
    const toggle = () => setOpened(on ? opened.filter(x => x !== c.id) : opened.concat(c.id));
    sw.addEventListener('click', toggle); sw.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); } });
    const timed = o.class.timer && o.class.timer.cp === c.id;
    return el('div', { class: 'cprow' + (on ? ' open' : '') + (timed ? ' timed' : '') }, sw,
      el('div', { class: 'grow' }, el('b', {}, `${i + 1}. ${c.title}`), el('div', { class: 'small muted' }, `${c.minutes} мин · ${c.steps.map(s => s.title).join(' · ')}`)),
      timed ? el('span', { class: 'tag timer-tag', 'data-timer': '1' }, '⏱') : on ? el('button', { class: 'btn ghost small', type: 'button', title: 'Запустить таймер этого чекпоинта', onclick: () => timer('restart', c.id) }, '⏱ таймер') : null,
      on && total ? el('span', { class: 'tag' + (finished(c) === total ? ' ok' : '') }, `закончили: ${finished(c)} из ${total}`) : null,
      el('span', { class: 'tag' }, `здесь: ${studentsAt(c.id)}`));
  })));
  if (o.class.timer) host.append(el('div', { class: 'row small' }, el('span', { class: 'muted' }, 'Таймер чекпоинта:'),
    el('button', { class: 'btn ghost small', type: 'button', onclick: () => timer('restart') }, '↻ заново'),
    el('button', { class: 'btn ghost small', type: 'button', onclick: () => timer('add') }, '+2 минуты'),
    el('button', { class: 'btn ghost small', type: 'button', onclick: () => timer('stop') }, '■ стоп')));
  const list = FILTERS.find(f => f[0] === T.filter) || FILTERS[0];
  host.append(el('div', { class: 'row' }, el('h3', { class: 'grow' }, `Ученики (${total})`),
    el('div', { class: 'seg filters', role: 'radiogroup', 'aria-label': 'Фильтр учеников' }, FILTERS.map(([id, label, fn]) => {
      const n = o.students.filter(fn).length;
      return el('button', { type: 'button', class: 'chipbtn' + (T.filter === id || (!T.filter && id === 'all') ? ' on' : '') + (id === 'stuck' && n ? ' hot' : ''), 'data-filter': id, 'aria-pressed': String(T.filter === id),
        onclick: () => { T.filter = id; drawLesson(); } }, `${label} · ${n}`);
    }))));
  if (!total) host.append(el('p', { class: 'muted' }, `Пока никто не вошёл. Ученики открывают ${location.origin}/ и вводят код ${o.class.code}.`));
  else {
    const stepTitle = id => { for (const c of cps) for (const s of c.steps) if (s.id === id) return [el('div', {}, s.title), el('div', { class: 'small muted' }, c.title)]; return '—'; };
    const rows = o.students.filter(list[2]).sort((a, b) => Number(b.stuck) - Number(a.stuck) || a.nick.localeCompare(b.nick, 'ru'));
    if (!rows.length) host.append(el('p', { class: 'muted' }, list[0] === 'stuck' ? 'Никто не застрял: у всех было движение за последние 5 минут.' : 'Таких учеников нет.'));
    else host.append(el('div', { class: 'tablewrap' }, el('table', { id: 'students' },
      el('thead', {}, el('tr', {}, ['Ник', 'Где сейчас', 'Шагов', 'Своими словами', 'Игра', 'Плейтест', 'Отзыв', 'Запросы к ИИ', 'Движение'].map(h => el('th', {}, h)))),
      el('tbody', {}, rows.map(s => el('tr', { class: 'click' + (s.stuck ? ' stuck' : ''), 'data-nick': s.nick, onclick: () => openStudent(s.nick) },
        el('td', {}, el('span', { class: 'dot-online' + (s.online ? ' on' : ''), title: s.online ? 'на связи' : 'страница закрыта' }), el('b', {}, s.nick)),
        el('td', {}, stepTitle(s.where)),
        el('td', {}, String(s.done), s.left ? el('div', { class: 'small muted' }, `осталось открытых: ${s.left}`) : null),
        el('td', { class: s.dice >= 3 ? 'warn' : null }, s.fields ? `${s.fields - s.dice} из ${s.fields}` : '—', s.dice ? el('span', { class: 'tag dice', style: 'margin-left:6px' }, `кубик: ${s.dice}`) : null),
        el('td', {}, s.game ? [`v${s.game.current} из ${s.game.versions}`, s.game.error ? el('span', { class: 'tag err', style: 'margin-left:6px', title: s.game.error }, 'ошибка') : null,
          s.game.errors ? el('div', { class: 'small muted' }, `ошибок в версиях: ${s.game.errors}`) : null, s.game.hidden ? el('span', { class: 'tag', style: 'margin-left:6px' }, 'скрыта') : null] : '—'),
        el('td', {}, s.game ? `партий чужих: ${s.plays}` : '—'),
        el('td', {}, s.feedback ? el('span', { class: 'tag ok' }, '✓ есть') : s.game ? el('span', { class: 'tag' }, 'написать →') : '—'),
        el('td', {}, aiCell(s)),
        el('td', { class: s.stuck ? 'warn' : 'muted' }, s.stuck ? `застрял: ${Math.floor(s.idle / 60)} мин` : fmtTime(s.moved))))))));
  }
  tickTimers();
  scrollTo(0, keepScroll);
}
// запросы к ИИ: полоска расхода и «+10» прямо в таблице
function aiCell(s) {
  const share = s.aiLimit ? Math.min(1, s.aiCalls / s.aiLimit) : 1;
  const add = el('button', { class: 'btn ghost small', type: 'button', title: 'Добавить ученику 10 запросов на этот урок', onclick: e => { e.stopPropagation(); addCalls(s.nick, 10); } }, '+10');
  return el('div', { class: 'stack', style: 'gap:4px' }, el('div', { class: 'row', style: 'gap:6px' }, el('b', {}, `${s.aiCalls} из ${s.aiLimit}`), add),
    el('span', { class: 'meter' + (share >= 0.9 ? ' hot' : '') }, el('i', { style: `width:${Math.round(share * 100)}%` })));
}
function spendBar(o) {
  const sp = o.spend, cap = sp.cap;
  const share = cap ? Math.min(1, sp.rub / cap) : 0;
  return el('div', { class: 'card spend row' },
    el('div', { class: 'grow stack', style: 'gap:4px' },
      el('div', {}, el('b', {}, `ИИ на этом уроке: ${rub(sp.rub)} ₽`), cap ? ` из ${rub(cap)} ₽` : ' · потолок не задан', el('span', { class: 'muted' }, ` · вызовов модели: ${sp.calls}`)),
      cap ? el('span', { class: 'meter wide' + (share >= 0.9 ? ' hot' : '') }, el('i', { style: `width:${Math.round(share * 100)}%` })) : null),
    el('span', { class: 'muted small' }, `на ученика: ${o.limits.aiCallsPerStudentPerLesson} запросов`),
    el('button', { class: 'btn ghost small', type: 'button', onclick: () => document.querySelector('.tabs [data-tab=ai]').click() }, 'Лимиты →'));
}
function tickTimers() {
  const t = T.overview && T.overview.class.timer;
  document.querySelectorAll('[data-timer]').forEach(x => {
    if (!t) return;
    const rem = t.minutes * 60 - (Date.now() + T.skew - Date.parse(t.startedAt)) / 1000;
    x.textContent = rem >= 0 ? `⏱ ${mmss(rem)} из ${mmss(t.minutes * 60)}` : `⏱ +${mmss(-rem)} сверх ${t.minutes} мин`;
    x.classList.toggle('err', rem < 0);
  });
}
setInterval(tickTimers, 1000);
async function setOpened(list) {
  try { await api('/api/teacher/class/update', { code: T.code, opened: list }); await refresh(); } catch (e) { toast(e.message, 'err'); }
}
async function timer(action, cp) {
  try { await api('/api/teacher/timer', { code: T.code, action, cp }); await refresh(); } catch (e) { toast(e.message, 'err'); }
}
async function addCalls(nick, add) {
  try { const r = await api('/api/teacher/student/bonus', { code: T.code, nick, add }); toast(`${nick}: теперь ${r.aiCalls} из ${r.aiLimit} запросов`, 'ok'); await refresh(); return r; } catch (e) { toast(e.message, 'err'); return null; }
}
async function openStudent(nick) {
  try {
    const r = await api(`/api/teacher/student?code=${T.code}&nick=${encodeURIComponent(nick)}`);
    Games.stopAll();
    $('#sdTitle').textContent = nick;
    const body = $('#sdBody'); body.innerHTML = '';
    // лимит запросов к ИИ
    const lim = el('b', {}, `${r.aiCalls} из ${r.aiLimit}`);
    body.append(el('div', { class: 'row card', style: 'padding:10px 14px' }, el('span', {}, 'Запросов к ИИ на уроке: '), lim, r.aiBonus ? el('span', { class: 'muted small' }, `(учитель добавил ${r.aiBonus})`) : null, el('span', { class: 'grow' }),
      [5, 10].map(n => el('button', { class: 'btn ghost small', type: 'button', onclick: async () => { const x = await addCalls(nick, n); if (x) lim.textContent = `${x.aiCalls} из ${x.aiLimit}`; } }, `+${n} запросов`))));
    body.append(el('h3', {}, 'Замысел (так его видят продюсер и программист)'), el('pre', { class: 'plan' }, r.plan));
    if (r.answerList && r.answerList.length) body.append(el('details', { class: 'card' }, el('summary', {}, el('b', {}, `Все ответы ученика · ${r.answerList.length}`)),
      el('div', { class: 'stack', style: 'gap:6px;margin-top:8px' }, r.answerList.map(a => el('div', {}, el('div', { class: 'small muted' }, `${a.cp} · ${a.step}`), el('div', { style: 'white-space:pre-wrap' }, a.text || (a.done ? 'готово' : '…')))))));
    if (r.game && r.game.versions.length) {
      body.append(el('h3', {}, `Игра «${r.game.title || ''}»`));
      body.append(el('div', { class: 'stack', style: 'gap:4px' }, r.game.versions.map(v => el('div', { class: 'row small' },
        el('a', { href: `/play/${r.game.id}/${v.n}`, target: '_blank', rel: 'noopener' }, `v${v.n}`),
        el('span', {}, v.kind || ''), v.request ? el('span', { class: 'muted' }, '«' + v.request + '»') : null,
        el('span', { class: 'muted' }, `${v.model || ''}${v.attempts > 1 ? ', попыток ' + v.attempts : ''}`),
        v.n === r.game.current ? el('span', { class: 'tag ok' }, 'текущая') : null,
        v.error ? el('span', { class: 'tag err', title: v.error.message }, 'ошибка: ' + v.error.message) : null))));
      body.append(compareBox(nick, r));
    } else body.append(el('p', { class: 'muted' }, 'Игра ещё не собрана.'));
    if (r.discovery) body.append(el('h3', {}, 'Плейтест: игра глазами класса'), Games.discovery(r.discovery));
    body.append(feedbackEditor(nick, r.feedback));
    if (!$('#studentDlg').open) $('#studentDlg').showModal();
  } catch (e) { toast(e.message, 'err'); }
}
// сравнение моделей на одном замысле: пересобрать другой моделью и открыть обе версии в одной рамке по очереди
function compareBox(nick, r) {
  const box = el('div', { class: 'card stack cmpbox' });
  const first = r.game.versions.find(v => v.kind === 'сборка') || r.game.versions[0];
  const variants = [{ label: `Ученик · ${first.model || '—'}`, game: r.game, own: true }].concat(r.compares.map(g => ({ label: `Учитель · ${g.model}`, game: g, own: false })));
  const sel = el('select', { id: 'cmpModel', 'aria-label': 'Модель для сравнения' });
  (r.models || []).map(m => m.id).concat(r.codeModel ? [r.codeModel] : []).filter((m, i, a) => a.indexOf(m) === i).forEach(m => sel.append(el('option', { value: m, selected: m !== first.model && !sel.querySelector('[selected]') ? true : null }, m)));
  const custom = el('input', { type: 'text', id: 'cmpCustom', placeholder: 'или id модели', style: 'max-width:200px' });
  const prog = el('div');
  const go = el('button', { class: 'btn', type: 'button' }, '⚖ Пересобрать другой моделью');
  go.addEventListener('click', async () => {
    const model = custom.value.trim() || sel.value;
    go.disabled = true; prog.innerHTML = '';
    const p = el('p', {}, `${model} собирает тот же замысел…`);
    prog.append(el('div', { class: 'progress' }, el('div', { class: 'spinner' }), p));
    try {
      await Lab.job('/api/teacher/compare', { code: T.code, nick, model }, j => { p.textContent = `${model} собирает тот же замысел… ${j.seconds} с` + (j.chars ? ` · ${j.chars.toLocaleString('ru-RU')} символов` : ''); });
      toast('Пересборка готова — сравните версии', 'ok'); openStudent(nick);
    } catch (e) { toast(e.message, 'err', 8000); prog.innerHTML = ''; go.disabled = false; }
  });
  box.append(el('h3', {}, 'Сравнение моделей на этом замысле'),
    el('p', { class: 'muted small' }, 'Тот же замысел ученика пишет другая модель. Пересборка — отдельная игра: у ученика и в аркаде её нет, в отчёт журнала генераций она попадает с пометкой «сравнение».'),
    el('div', { class: 'row' }, sel, custom, go), prog);
  if (variants.length > 1) {
    const stage = el('div', { class: 'stack' });
    const tabs = el('div', { class: 'seg' });
    const show = k => {
      tabs.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === k));
      stage.innerHTML = '';
      const vr = variants[k];
      let g = vr.game;
      if (vr.own) { // игра ученика: просто запускаем, без починки и без записи партий
        const h = Games.frame({ src: () => `/play/${g.id}/${g.current}`, key: () => 'teacher:' + g.id, score: false, label: 'Играть', autostart: true,
          onError: err => h.message(el('b', {}, 'Игра упала: ' + (err.message || 'ошибка'))) });
        stage.append(h.box, Games.bar(h));
      } else {
        const tf = Games.teacherFrame({ get: () => g, set: ng => { g = ng; vr.game = ng; }, label: 'Играть', autostart: true, demo: () => T.demo });
        stage.append(tf.h.box, Games.bar(tf.h, tf.status));
      }
      stage.append(el('div', { class: 'small muted' }, el('a', { href: `/play/${g.id}/${g.current}`, target: '_blank', rel: 'noopener' }, 'Открыть в отдельной вкладке ↗')));
    };
    variants.forEach((vr, k) => {
      const v = vr.game.versions[vr.game.versions.length - 1] || {};
      tabs.append(el('button', { type: 'button', class: 'opt', onclick: () => show(k) }, el('b', {}, String.fromCharCode(65 + k) + ' · ' + vr.label),
        el('div', { class: 'small muted' }, vr.game.versions.length ? `версий: ${vr.game.versions.length}` + (vr.game.versions.some(x => x.error) ? ', были ошибки' : '') + (v.ms ? ` · ${Math.round(v.ms / 1000)} с` : '') : 'собирается…')));
    });
    box.append(tabs, stage);
  }
  return box;
}

// отзыв учителя: одно понятие геймдизайна + один вопрос, кубики — из колод урока (lesson.feedback)
function feedbackEditor(nick, fb) {
  const decks = T.overview.lesson.feedback || {};
  const v = { concept: (fb && fb.concept) || { text: '' }, question: (fb && fb.question) || { text: '' } };
  const save = el('button', { class: 'btn', type: 'button' }, fb ? 'Обновить отзыв' : 'Отправить отзыв ученику');
  const state = el('span', { class: 'muted small' }, fb ? 'Ученик уже видит отзыв в шаге плейтеста.' : 'Ученик увидит отзыв сразу, в шаге плейтеста.');
  save.addEventListener('click', async () => {
    if (!valText(v.concept) || !valText(v.question)) { toast('Нужны понятие и вопрос'); return; }
    save.disabled = true;
    try { await api('/api/teacher/feedback', { code: T.code, nick, concept: v.concept, question: v.question }); toast('Отзыв отправлен', 'ok'); state.textContent = 'Отправлено: ученик видит отзыв.'; save.textContent = 'Обновить отзыв'; refresh(); }
    catch (e) { toast(e.message, 'err'); }
    save.disabled = false;
  });
  return el('div', { class: 'card stack fbedit' }, el('h3', {}, 'Отзыв учителя: одно понятие + один вопрос'),
    fieldEditor({ id: 'concept', label: 'Понятие геймдизайна', hint: 'Одно понятие, которое видно в игре ученика', deck: decks.concepts }, v.concept, nv => { v.concept = nv; }, { idPrefix: 'fb-' }),
    fieldEditor({ id: 'question', label: 'Вопрос автору', hint: 'Один вопрос, на который автор ответит следующей версией', deck: decks.questions }, v.question, nv => { v.question = nv; }, { idPrefix: 'fb-' }),
    el('div', { class: 'row' }, save, state));
}

/* ---------- вкладка «Вау-старт» ---------- */
// Учитель тянет карты при классе, кубик выбирает секрет (учитель может тайно заменить), ИИ собирает общую игру, учитель раздаёт её классу.
// Вкладку можно держать на проекторе: секрет скрыт, пока учитель его не откроет. Пока вкладка открыта, голоса и сводка обновляются сами.
const W = { data: null, showSecret: false, gameKey: null, preview: null, busy: false };
async function drawWow(full) {
  const host = $('#tab-wow');
  if (!T.code) { host.innerHTML = ''; return; }
  let r;
  try { r = await api('/api/teacher/wow?code=' + T.code); } catch (e) { host.innerHTML = ''; host.append(el('p', { class: 'muted' }, e.message)); W.data = null; return; }
  const prev = W.data; W.data = r;
  if (full || !host.querySelector('#wowCards')) {
    host.innerHTML = '';
    host.append(el('div', { class: 'row' },
      el('div', { class: 'grow stack', style: 'gap:2px' }, el('div', { class: 'eyebrow' }, 'Чекпоинт 1 · колода безумных идей'), el('h2', {}, r.formula)),
      el('button', { class: 'btn', type: 'button', onclick: () => wowAct('/api/teacher/wow/draw', { card: 'all' }) }, '🎲 Тянуть все карты')),
      el('p', { class: 'muted small' }, 'Карты появляются у учеников сразу. Ученики голосуют «перетянуть» — число голосов видно под картой. Вкладку можно показывать на проекторе: секрет скрыт.'),
      el('div', { id: 'wowCards' }), el('div', { id: 'wowLink' }), el('div', { id: 'wowSecret' }), el('div', { id: 'wowBuild' }), el('div', { id: 'wowSummary' }));
    W.gameKey = null;
  }
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  if (full || !prev || !same(prev.wow.cards, r.wow.cards) || !same(prev.wow.votes, r.wow.votes) || prev.wow.status !== r.wow.status) drawWowCards();
  if (full || !prev || !same(prev.wow.cards, r.wow.cards) || !same(prev.wow.link, r.wow.link) || prev.wow.status !== r.wow.status) drawWowLink();
  if (full || !prev || !same(prev.secret, r.secret) || prev.wow.secretBy !== r.wow.secretBy || !same(prev.built, r.built)) drawWowSecret();
  const key = (r.game ? r.game.id + '/' + r.game.version : '') + '|' + r.wow.status + '|' + r.wow.given + '|' + r.cards.every(c => r.wow.cards[c.id]);
  if (full || key !== W.gameKey) { W.gameKey = key; drawWowBuild(); }
  if (full || !prev || !same(prev.summary, r.summary)) drawWowSummary();
}
function drawWowCards() {
  const r = W.data, host = $('#wowCards'); host.innerHTML = '';
  const row = el('div', { class: 'wowcards' });
  r.cards.forEach(c => {
    const text = r.wow.cards[c.id], votes = (r.wow.votes[c.id] || []).length;
    row.append(el('div', { class: 'wowcard' + (text ? ' up' : ''), 'data-card': c.id },
      el('div', { class: 'wc-label' }, c.label), el('div', { class: 'wc-text' }, text || '?'),
      el('div', { class: 'row' }, el('button', { class: 'btn ghost small', type: 'button', onclick: () => wowAct('/api/teacher/wow/draw', { card: c.id }) }, text ? '🎲 Перетянуть' : '🎲 Тянуть'),
        votes ? el('span', { class: 'tag dice', title: (r.wow.votes[c.id] || []).join(', ') }, `перетянуть: ${votes}`) : null)));
  });
  host.append(row);
}
function drawWowLink() {
  const r = W.data, host = $('#wowLink'); host.innerHTML = '';
  const ready = r.cards.every(c => r.wow.cards[c.id]);
  const fresh = r.wow.link && r.wow.link.cards === JSON.stringify(r.wow.cards) ? r.wow.link : null;
  host.append(Games.linkBox({ link: fresh, ready, editable: !r.wow.given && r.wow.status !== 'building', code: T.code, onChange: () => drawWow() }));
}
function drawWowSecret() {
  const r = W.data, host = $('#wowSecret'); host.innerHTML = '';
  const box = el('div', { class: 'secretbox' });
  box.append(el('div', { class: 'row' }, el('b', { class: 'grow' }, '🤫 Секрет игры — его видите только вы'),
    el('button', { class: 'btn ghost small', type: 'button', onclick: () => { W.showSecret = !W.showSecret; drawWowSecret(); } }, W.showSecret ? 'Скрыть' : 'Показать')));
  if (W.showSecret) {
    const sel = el('select', { id: 'wowSecretSel', 'aria-label': 'Выбрать секрет' });
    r.secrets.forEach(x => sel.append(el('option', { value: x.id, selected: x.id === r.secret.id ? true : null }, `${x.title} (${x.effect})`)));
    sel.addEventListener('change', () => wowAct('/api/teacher/wow/secret', { id: sel.value }));
    box.append(el('div', {}, el('span', { class: 'tag ' + (r.wow.secretBy === 'кубик' ? 'dice' : 'own') }, r.wow.secretBy === 'кубик' ? '[кубик]' : 'выбор учителя'), ' ', el('b', {}, r.secret.title)),
      el('div', { class: 'row' }, el('div', { class: 'grow' }, sel), el('button', { class: 'btn ghost small', type: 'button', onclick: () => wowAct('/api/teacher/wow/secret', {}) }, '🎲 Другой секрет')),
      r.built && r.built.id !== r.secret.id ? el('p', { class: 'small', style: 'color:var(--warm)' }, `В собранной игре сейчас другой секрет: «${r.built.title}». Пересоберите игру, чтобы заложить новый.`) : null,
      r.demo ? el('p', { class: 'small muted' }, 'Демо-режим: без ключа ИИ собирается запасная игра урока, у неё свой секрет — ускорение волны.') : null);
  }
  host.append(box);
}
function drawWowBuild() {
  const r = W.data, host = $('#wowBuild');
  if (W.preview) { W.preview.destroy(); W.preview = null; }
  host.innerHTML = '';
  const ready = r.cards.every(c => r.wow.cards[c.id]);
  const box = el('div', { class: 'card stack' });
  const statusLine = { cards: ready ? 'Карты на столе. Собирайте игру.' : 'Вытяните все четыре карты.', building: '⚙ ИИ собирает игру…', preview: r.wow.given ? '✓ Игра у учеников.' : 'Игра собрана. Проверьте её и раздайте классу.' }[r.wow.status] || '';
  box.append(el('div', { class: 'row' }, el('h3', { class: 'grow' }, 'Игра класса'), el('span', { class: 'muted small' }, statusLine)));
  const prog = el('div');
  const buildBtn = el('button', { class: 'btn', type: 'button', disabled: !ready || r.wow.status === 'building' || W.busy ? true : null, onclick: async () => {
    W.busy = true; buildBtn.disabled = true;
    const p = el('p', {}, 'ИИ собирает игру класса…');
    prog.innerHTML = ''; prog.append(el('div', { class: 'progress' }, el('div', { class: 'spinner' }), p));
    try {
      const res = await Lab.job('/api/teacher/wow/build', { code: T.code }, j => { p.textContent = `ИИ собирает игру класса… ${j.seconds} с` + (j.chars ? ` · ${j.chars.toLocaleString('ru-RU')} символов кода` : '') + (j.phase === 'синтаксис' ? ' · чинит опечатку' : ''); });
      toast(`Игра «${res.title}» собрана`, 'ok');
    } catch (e) { toast(e.message, 'err', 8000); }
    W.busy = false; drawWow(true);
  } }, r.game ? '↻ Собрать заново' : '⚙ Собрать с ИИ');
  box.append(el('div', { class: 'row' }, buildBtn,
    el('button', { class: 'btn ghost small', type: 'button', onclick: () => { if (confirm('Взять запасную игру урока вместо сборки ИИ? Её секрет — ускорение волны.')) wowAct('/api/teacher/wow/fallback', {}, true); } }, 'Запасная игра'),
    el('span', { class: 'muted small' }, r.demo ? 'Демо-режим: соберётся запасная игра урока с названием по картам.' : 'Полная 3D-игра пишется 5–20 минут. Пока ИИ пишет, класс играет в донора.')), prog);
  if (r.game) {
    const g = r.game;
    box.append(el('div', { class: 'row small' }, el('b', {}, `«${g.title}» v${g.version}`), el('span', { class: 'muted' }, g.fallback ? 'запасная игра' : `модель ${g.model}${g.attempts > 1 ? ', попыток ' + g.attempts : ''}`),
      ...(g.warnings || []).map(w => el('span', { class: 'tag err', title: 'Замечание проверки' }, w))));
    W.preview = Games.frame({ src: () => `/play/${g.id}/${g.version}`, key: () => 'wow:' + g.id, label: 'Проверить игру',
      onError: err => W.preview.message(el('div', { class: 'stack', style: 'align-items:center' }, el('b', {}, 'Игра упала: ' + (err.message || 'ошибка')), el('p', { class: 'muted small' }, 'Соберите заново или возьмите запасную игру.'))) });
    box.append(W.preview.box, Games.bar(W.preview),
      el('div', { class: 'row' },
        r.wow.given ? el('button', { class: 'btn ghost', type: 'button', onclick: () => wowAct('/api/teacher/wow/give', { given: false }, true) }, 'Забрать у класса')
          : el('button', { class: 'btn warm', type: 'button', onclick: () => wowAct('/api/teacher/wow/give', { given: true }, true) }, '📣 Раздать классу'),
        el('a', { class: 'btn ghost small', href: `/play/${g.id}/${g.version}`, target: '_blank', rel: 'noopener' }, '⛶ Открыть на проектор ↗')));
  }
  host.append(box);
}
function drawWowSummary() {
  const r = W.data, s = r.summary, host = $('#wowSummary'); host.innerHTML = '';
  const box = el('div', { class: 'card stack' }, el('h3', {}, 'Чекпоинт 2 · как секрет влияет на игру'));
  if (!s.rows.length) { box.append(el('p', { class: 'muted' }, 'Пока никто не сыграл в игру класса.')); host.append(box); return; }
  box.append(el('div', { class: 'compare' },
    el('div', {}, el('div', { class: 'eyebrow' }, 'С секретом'), el('b', {}, `средний лучший счёт ${s.onAvg}`), el('div', { class: 'small muted' }, `секрет сработал ${s.hits} раз за все партии класса`)),
    el('div', {}, el('div', { class: 'eyebrow' }, 'Без секрета'), el('b', {}, `средний лучший счёт ${s.offAvg}`), el('div', { class: 'small muted' }, `угадали секрет: ${s.correct} из ${s.guessed}, попались в ловушку карт: ${s.trap}` + (s.voted ? ` · слепой тест: почувствовали секрет ${s.felt} из ${s.voted}` : '')))),
  el('div', { class: 'tablewrap' }, el('table', {},
    el('thead', {}, el('tr', {}, ['Ник', 'С секретом: партий / лучший', 'Сработал', 'Без секрета: партий / лучший', 'Слепой тест', 'Догадка'].map(h => el('th', {}, h)))),
    el('tbody', {}, s.rows.map(x => el('tr', {}, el('td', {}, el('b', {}, x.nick)), el('td', {}, `${x.onRounds} / ${x.onBest}`), el('td', {}, String(x.hits)), el('td', {}, `${x.offRounds} / ${x.offBest}`),
      el('td', {}, x.vote ? el('span', { class: 'tag ' + (x.felt ? 'ok' : '') }, x.felt ? 'почувствовал' : x.vote === 'same' ? 'разницы нет' : 'мимо') : '—'),
      el('td', {}, x.guess ? [x.guess + ' ', el('span', { class: 'tag ' + (x.correct ? 'ok' : x.trap ? 'dice' : '') }, x.correct ? 'угадал' : x.trap ? 'ловушка' : 'мимо')] : '—')))))));
  host.append(box);
}
async function wowAct(path, body, full) {
  try { await api(path, Object.assign({ code: T.code }, body)); } catch (e) { toast(e.message, 'err'); }
  drawWow(full);
}
setInterval(() => { if (!$('#tab-wow').hidden && !W.busy) drawWow(); }, 4000);

/* ---------- вкладка «Аркада» ---------- */
/* ---------- вкладка «Ответы»: все ответы класса по шагам урока, разбор квизов по карточкам, выгрузка для анализа ---------- */
const AN = { cp: null };
async function drawAnswers() {
  const host = $('#tab-answers'); host.innerHTML = '';
  if (!T.code) return;
  let r;
  try { r = await api('/api/teacher/answers?code=' + T.code); } catch (e) { toast(e.message, 'err'); return; }
  const cps = [...new Map(r.steps.map(x => [x.cp, x.cpTitle])).entries()];
  if (!cps.some(([id]) => id === AN.cp)) AN.cp = cps[0] && cps[0][0];
  host.append(el('div', { class: 'row' },
    el('p', { class: 'muted grow' }, `Урок ${r.lesson.number}: ответы сохраняются сами, как только ученик отвечает. Учеников: ${r.students.length}.`),
    el('a', { class: 'btn ghost small', href: dl(`/api/teacher/answers.csv?code=${T.code}&kind=steps`), download: '', id: 'csvAnswers' }, '⬇ CSV всех ответов'),
    el('a', { class: 'btn ghost small', href: dl(`/api/teacher/answers.csv?code=${T.code}&kind=quiz`), download: '', id: 'csvQuiz' }, '⬇ CSV квизов по карточкам'),
    el('button', { class: 'btn ghost small', type: 'button', onclick: drawAnswers }, '↻ Обновить')));
  host.append(el('div', { class: 'seg' }, cps.map(([id, title]) => el('button', { type: 'button', class: 'btn small' + (id === AN.cp ? '' : ' ghost'), onclick: () => { AN.cp = id; drawAnswers(); } }, title))));
  const steps = r.steps.filter(x => x.cp === AN.cp);
  if (!r.students.length) host.append(el('div', { class: 'card' }, 'В классе пока нет учеников.'));
  else host.append(el('div', { class: 'tablewrap' }, el('table', { id: 'answers' },
    el('thead', {}, el('tr', {}, el('th', {}, 'Ученик'), steps.map(x => el('th', {}, x.title)))),
    el('tbody', {}, r.students.map(s => el('tr', {}, el('td', {}, el('a', { href: '#', onclick: e => { e.preventDefault(); openStudent(s.nick); } }, s.nick)),
      steps.map(x => { const a = s.answers[x.id]; return el('td', { class: 'small ans' + (a && a.done ? '' : ' muted'), title: a ? a.text : '' }, a ? (a.text || (a.done ? 'готово' : '…')) : '—'); })))))));
  const quizzes = r.quizzes.filter(q => steps.some(x => x.id === q.id));
  quizzes.forEach(q => host.append(el('div', { class: 'card stack' }, el('h3', {}, `Квиз «${q.title}»: какие карточки труднее всего`),
    el('div', { class: 'tablewrap' }, el('table', {},
      el('thead', {}, el('tr', {}, el('th', {}, 'Карточка'), el('th', {}, 'Правильно'), el('th', {}, 'Верно'), el('th', {}, 'Чаще ошибались'))),
      el('tbody', {}, q.cards.map(c => {
        const w = Object.entries(c.wrong).sort((a, b) => b[1] - a[1])[0];
        return el('tr', {}, el('td', {}, c.text), el('td', {}, c.right), el('td', {}, el('b', {}, `${Math.round(100 * c.ok / c.total)}%`), el('span', { class: 'muted small' }, ` · ${c.ok} из ${c.total}`)), el('td', { class: 'small' }, w ? `${w[0]} (${w[1]})` : '—'));
      })))))));
}

async function drawArcade() {
  const host = $('#tab-arcade'); host.innerHTML = '';
  if (!T.code) return;
  let r;
  try { r = await api('/api/teacher/arcade?code=' + T.code); } catch (e) { toast(e.message, 'err'); return; }
  host.append(el('p', { class: 'muted' }, `Игр в аркаде класса: ${r.games.filter(g => !g.hidden).length}` + (r.games.some(g => g.hidden) ? `, скрыто авторами: ${r.games.filter(g => g.hidden).length}` : '') + `. Ученики открывают аркаду по адресу ${location.origin}/arcade.`));
  if (!r.games.length) { host.append(el('p', { class: 'muted' }, 'Пока никто не собрал игру.')); return; }
  const grid = el('div', { class: 'agrid' });
  r.games.forEach(g => {
    const d = g.discovery;
    grid.append(Games.card(g, {
      extra: el('div', { class: 'small muted' }, `Партий чужих: ${d.rounds}, «ещё раз»: ${d.again}, отзывов: ${d.cards.length}` + (d.dominant ? `. Дольше всего держали ${d.dominant.name} — ${Math.round(d.dominant.share * 100)}%` : '')),
      actions: [el('a', { class: 'btn small', href: `/play/${g.id}/${g.version}`, target: '_blank', rel: 'noopener' }, '▶ Открыть'),
        el('button', { class: 'btn ghost small', type: 'button', onclick: () => openStudent(g.nick) }, 'Ученик и отзыв')],
    }));
  });
  host.append(grid);
}

/* ---------- вкладка «ИИ и расходы» ---------- */
const pctOf = x => (x == null ? '—' : Math.round(x * 100) + '%');
const dl = path => path + (path.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(Lab.token.get());
async function drawAI() {
  const host = $('#tab-ai'); host.innerHTML = '';
  let s, g;
  try { [s, g] = await Promise.all([api('/api/teacher/settings'), api('/api/teacher/genlog')]); } catch (e) { toast(e.message, 'err'); return; }
  const known = s.known.map(m => m.id);
  const pick = (id, cur) => {
    const sel = el('select', { id }); [...new Set(known.concat(cur ? [cur] : []))].forEach(m => sel.append(el('option', { value: m, selected: m === cur ? true : null }, (s.known.find(k => k.id === m) || {}).label ? `${s.known.find(k => k.id === m).label} (${m})` : m)));
    return sel;
  };
  const codeSel = pick('codeModel', s.models.code), textSel = pick('textModel', s.models.text);
  const custom = el('input', { type: 'text', id: 'customModel', placeholder: 'или впишите id модели из каталога провайдера' });
  host.append(el('div', { class: 'card stack' },
    el('h3', {}, s.demo ? 'ИИ: демо-режим' : 'ИИ подключён'),
    el('p', { class: 'muted small' }, s.demo ? 'Впишите ключ provod.ai в portal/config.json (поле ai.apiKey) и перезапустите портал.' : `Провайдер: ${s.baseUrl}. Ключ хранится только на сервере.`),
    el('div', { class: 'row' }, el('div', { class: 'grow' }, el('label', { class: 'lbl', for: 'codeModel' }, 'Программист (пишет игры)'), codeSel), el('div', { class: 'grow' }, el('label', { class: 'lbl', for: 'textModel' }, 'Продюсер (читает замыслы)'), textSel)),
    custom,
    el('div', { class: 'row' },
      el('button', { class: 'btn', type: 'button', onclick: async () => {
        const body = { codeModel: codeSel.value, textModel: textSel.value };
        if (custom.value.trim()) body.codeModel = custom.value.trim();
        try { await api('/api/teacher/settings', body); toast('Модели сохранены', 'ok'); drawAI(); } catch (e) { toast(e.message, 'err'); }
      } }, 'Сохранить модели'),
      el('button', { class: 'btn ghost', type: 'button', onclick: async (e) => {
        const b = e.currentTarget; b.disabled = true;
        try { const r = await api('/api/teacher/models'); box.textContent = r.ids.join('\n'); box.hidden = false; toast(`Ключ работает: моделей ${r.ids.length}`, 'ok'); } catch (err) { toast(err.message, 'err', 8000); }
        b.disabled = false;
      } }, 'Проверить ключ и список моделей'))));
  const box = el('pre', { class: 'plan', hidden: true });
  host.append(box);
  host.append(limitsCard(s));

  // отчёт проверки главного допущения: по моделям, на одну игру
  host.append(el('div', { class: 'row' }, el('h3', { class: 'grow' }, 'Проверка главного допущения: игры по моделям'),
    el('a', { class: 'btn ghost small', href: dl('/api/teacher/report.csv?kind=games'), download: '', id: 'csvGames' }, '⬇ CSV по играм'),
    el('a', { class: 'btn ghost small', href: dl('/api/teacher/report.csv?kind=calls'), download: '', id: 'csvCalls' }, '⬇ CSV всех вызовов')));
  host.append(el('p', { class: 'muted small' }, `Игр собрано: ${g.total.games}. «С первой попытки» — сборка без починки синтаксиса, игра запустилась в рамке и не упала. Доли считаются по играм, которые хоть раз запускались. Вызовов модели: ${g.total.calls}, потрачено: ${rub(g.total.rub)} ₽` + (g.total.demo ? ` · демо-вызовов: ${g.total.demo}` : '') + '.'));
  if (g.report.length) host.append(el('div', { class: 'tablewrap' }, el('table', { id: 'report' },
    el('thead', {}, el('tr', {}, ['Модель', 'Игр', 'С первой попытки', 'Работают в итоге', 'Починок на игру', 'Время на игру', '₽ на игру', 'Не запускались', 'Без игры'].map(h => el('th', {}, h)))),
    el('tbody', {}, g.report.map(m => el('tr', {}, el('td', {}, el('b', {}, m.model)), el('td', {}, String(m.games)),
      el('td', {}, el('span', { class: 'share' + (m.firstTryShare >= 0.7 ? ' ok' : m.firstTryShare != null && m.firstTryShare < 0.4 ? ' bad' : '') }, pctOf(m.firstTryShare))),
      el('td', {}, pctOf(m.worksShare)), el('td', {}, String(m.avgFixes).replace('.', ',')), el('td', {}, m.avgSec + ' с'), el('td', {}, m.avgRub == null ? '—' : rub(m.avgRub)),
      el('td', { class: 'muted' }, String(m.pending)), el('td', { class: m.noGame ? 'warn' : 'muted' }, String(m.noGame))))))));
  else host.append(el('p', { class: 'muted' }, 'Отчёт появится после первых сборок с настоящей моделью (демо-сборки в него не входят).'));
  if (g.comparisons.length) {
    host.append(el('h3', {}, 'Сравнения моделей на одном замысле'));
    const line = r => r ? `${r.model}: ${r.firstTry ? '✓ с первой попытки' : r.launched ? (r.works ? `заработала после ${r.syntaxFixes + r.runtimeFixes} починок` : 'не заработала') : 'ещё не запускали'} · ${Math.round(r.ms / 1000)} с` + (r.rub != null ? ` · ${rub(r.rub)} ₽` : '') : 'исходная сборка без модели (демо)';
    host.append(el('div', { class: 'stack', style: 'gap:6px' }, g.comparisons.map(c => el('div', { class: 'card stack', style: 'gap:4px;padding:12px 14px' },
      el('div', { class: 'row' }, el('b', { class: 'grow' }, `«${c.title}» · ${c.nick}`), el('button', { class: 'btn ghost small', type: 'button', onclick: () => openStudent(c.nick) }, 'Открыть обе версии')),
      el('div', { class: 'small' }, 'A — ', line(c.base)), c.others.map((r, i) => el('div', { class: 'small' }, String.fromCharCode(66 + i) + ' — ', line(r))))))) ;
  }
  host.append(el('h3', {}, 'Все вызовы модели'));
  if (g.byModel.length) host.append(el('div', { class: 'tablewrap' }, el('table', {},
    el('thead', {}, el('tr', {}, ['Модель', 'Вызовов', 'Без ошибки', 'Среднее время', 'Токены вход/выход', 'Вход из кэша', '₽'].map(h => el('th', {}, h)))),
    el('tbody', {}, g.byModel.map(m => el('tr', {}, el('td', {}, m.model), el('td', {}, String(m.calls)), el('td', {}, Math.round(100 * m.ok / m.calls) + '%'),
      el('td', {}, Math.round(m.ms / m.calls / 1000) + ' с'), el('td', {}, `${m.tokensIn} / ${m.tokensOut}`), el('td', {}, m.tokensIn ? Math.round(100 * (m.tokensCached || 0) / m.tokensIn) + '%' : '—'), el('td', {}, rub(m.rub))))))));
  if (g.last.length) host.append(el('details', {}, el('summary', {}, `Последние вызовы (${g.last.length})`), el('div', { class: 'tablewrap' }, el('table', {},
    el('thead', {}, el('tr', {}, ['Когда', 'Ученик', 'Что', 'Модель', 'Время', '₽', 'Итог'].map(h => el('th', {}, h)))),
    el('tbody', {}, g.last.map(e => el('tr', {}, el('td', { class: 'muted' }, fmtTime(e.at)), el('td', {}, e.nick || ''), el('td', {}, e.kind), el('td', {}, e.model || ''),
      el('td', {}, e.ms ? Math.round(e.ms / 1000) + ' с' : '—'), el('td', {}, e.rub == null ? '—' : String(e.rub)), el('td', {}, e.ok ? el('span', { class: 'tag ok' }, 'ок') : el('span', { class: 'tag err', title: e.error || '' }, e.error ? e.error.slice(0, 40) : 'ошибка')))))))));
}
// лимиты: потолок рублей на урок класса и запросов на ученика — расход урока и правка из панели (поверх config.json)
function limitsCard(s) {
  const o = T.overview;
  const calls = el('input', { type: 'number', id: 'limCalls', min: '0', max: '1000', value: String(s.limits.aiCallsPerStudentPerLesson), style: 'width:110px' });
  const cap = el('input', { type: 'number', id: 'limRub', min: '0', step: '10', value: String(s.limits.rublesPerLesson || 0), style: 'width:110px' });
  const spent = o ? o.spend : null;
  return el('div', { class: 'card stack' }, el('h3', {}, 'Лимиты'),
    spent ? el('div', {}, el('b', {}, `Класс «${o.class.name}», урок ${o.lesson.number}: ${rub(spent.rub)} ₽`), spent.cap ? ` из ${rub(spent.cap)} ₽` : ' · потолок не задан', el('span', { class: 'muted' }, ` · вызовов: ${spent.calls}`)) : null,
    spent && spent.cap ? el('span', { class: 'meter wide' + (spent.rub / spent.cap >= 0.9 ? ' hot' : '') }, el('i', { style: `width:${Math.min(100, Math.round(100 * spent.rub / spent.cap))}%` })) : null,
    el('div', { class: 'row' },
      el('label', { class: 'small', for: 'limCalls' }, 'Запросов к ИИ на ученика за урок'), calls,
      el('label', { class: 'small', for: 'limRub' }, 'Потолок урока класса, ₽ (0 — без потолка)'), cap,
      el('button', { class: 'btn small', type: 'button', onclick: async () => {
        try { await api('/api/teacher/settings', { limits: { aiCallsPerStudentPerLesson: Number(calls.value), rublesPerLesson: Number(cap.value) } }); toast('Лимиты сохранены', 'ok'); await refresh(); drawAI(); } catch (e) { toast(e.message, 'err'); }
      } }, 'Сохранить лимиты')),
    el('p', { class: 'muted small' }, `В config.json: ${s.configLimits.aiCallsPerStudentPerLesson} запросов, потолок ${s.configLimits.rublesPerLesson || 0} ₽. Отдельному ученику запросы добавляются кнопкой «+10» в таблице урока. Цены моделей для подсчёта рублей — в config.json (models).`));
}

/* ---------- вкладка «Заметки автора»: статус и выгрузка в Markdown ---------- */
const NOTE_ST = [['new', 'Новая'], ['work', 'В работе'], ['done', 'Сделано']];
async function drawNotes() {
  const host = $('#tab-notes'); host.innerHTML = '';
  let r;
  try { r = await api('/api/teacher/notes'); } catch (e) { toast(e.message, 'err'); return; }
  const f = T.noteFilter || 'all';
  const shown = r.notes.filter(n => f === 'all' || n.status === f);
  const md = list => '# Заметки автора курса\n\n' + list.map(n => `- [${n.status === 'done' ? 'x' : ' '}] **${[n.lesson || 'портал', n.checkpoint, n.step].filter(Boolean).join(' / ')}** — ${n.text.replace(/\s*\n\s*/g, ' ')} _(${n.who}, ${(NOTE_ST.find(x => x[0] === n.status) || [])[1]})_`).join('\n');
  host.append(el('div', { class: 'row' }, el('p', { class: 'grow muted' }, `Заметок: ${r.notes.length}. Их пишут на каждом шаге урока кнопкой «Заметка автора». Скопируйте новые и пришлите в чат «Сборка» — Claude превратит их в правки, а вы отметите «в работе» и «сделано».`),
    el('button', { class: 'btn', type: 'button', onclick: () => copy(md(shown)) }, '⧉ Скопировать ' + (f === 'all' ? 'все' : 'показанные')),
    el('a', { class: 'btn ghost', href: dl('/api/teacher/notes.md' + (f === 'all' ? '' : '?status=' + f)), download: '', id: 'notesMd' }, '⬇ Markdown')));
  host.append(el('div', { class: 'seg filters' }, [['all', 'Все']].concat(NOTE_ST).map(([id, label]) => el('button', { type: 'button', class: 'chipbtn' + (f === id ? ' on' : ''), 'data-nfilter': id,
    onclick: () => { T.noteFilter = id; drawNotes(); } }, `${label} · ${id === 'all' ? r.notes.length : r.notes.filter(n => n.status === id).length}`))));
  if (!shown.length) host.append(el('p', { class: 'muted' }, r.notes.length ? 'Таких заметок нет.' : 'Заметок пока нет.'));
  shown.forEach(n => {
    const seg = el('div', { class: 'seg nstatus', role: 'radiogroup', 'aria-label': 'Статус заметки' }, NOTE_ST.map(([id, label]) => el('button', { type: 'button', class: 'chipbtn st-' + id + (n.status === id ? ' on' : ''), 'aria-pressed': String(n.status === id),
      onclick: async () => { try { await api('/api/teacher/note/status', { id: n.id, status: id }); beep(id === 'done' ? 'done' : 'tick'); drawNotes(); } catch (e) { toast(e.message, 'err'); } } }, label)));
    host.append(el('div', { class: 'card stack note st-' + n.status, style: 'gap:6px;padding:12px 14px', 'data-note': n.id },
      el('div', { class: 'row small muted' }, el('span', { class: 'tag' }, [n.lesson, n.checkpoint, n.step].filter(Boolean).join(' / ') || 'портал'), n.who, ' · ', new Date(n.at).toLocaleString('ru-RU'), el('span', { class: 'grow' }), seg),
      el('div', {}, n.text)));
  });
}

/* ---------- события ---------- */
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
  ['lesson', 'wow', 'answers', 'arcade', 'ai', 'notes'].forEach(t => { $('#tab-' + t).hidden = t !== b.dataset.tab; });
  if (b.dataset.tab !== 'wow' && W.preview) { W.preview.destroy(); W.preview = null; W.gameKey = null; }
  if (b.dataset.tab === 'wow') drawWow(true);
  if (b.dataset.tab === 'answers') drawAnswers();
  if (b.dataset.tab === 'arcade') drawArcade();
  if (b.dataset.tab === 'ai') drawAI();
  if (b.dataset.tab === 'notes') drawNotes();
}));
function pickClass(code) {
  if (code === T.code) return;
  T.code = code; drawClassSel(); selectClass(code);
  if (!$('#tab-wow').hidden) drawWow(true);
}
// удаление класса: мышь над строкой класса (или фокус на ней) и клавиша Del — без отдельной кнопки
let hoverCode = null;
$('#classSel').addEventListener('mouseover', e => { const r = e.target.closest('.classrow'); hoverCode = r ? r.dataset.code : null; });
$('#classSel').addEventListener('mouseleave', () => { hoverCode = null; });
document.addEventListener('keydown', async e => {
  if (e.key !== 'Delete') return;
  const f = document.activeElement, focused = f && f.classList.contains('classrow') ? f.dataset.code : null;
  const code = hoverCode || focused;
  const c = code && T.classes.find(x => x.code === code);
  if (!c) return;
  e.preventDefault();
  if (!confirm(`Удалить класс «${c.name}» (${c.code})? Ученики больше не войдут по этому коду. Папка класса переедет в data/deleted.`)) return;
  try {
    await api('/api/teacher/class/delete', { code: c.code });
    await loadClasses(); hoverCode = null;
    const wasCurrent = c.code === T.code;
    if (wasCurrent) { T.code = T.classes[0] ? T.classes[0].code : null; T.lastLesson = null; }
    drawClassSel(); if (wasCurrent) await selectClass(T.code);
    toast(`Класс «${c.name}» удалён`, 'ok');
  } catch (err) { toast(err.message, 'err'); }
});
$('#moduleSel').addEventListener('change', e => { T.module = Number(e.target.value); drawLessonSel(); });
$('#lessonSel').addEventListener('change', async e => {
  if (!e.target.value) return;
  if (!confirm('Сменить урок класса? Открытые чекпоинты закроются, ответы учеников сохранятся.')) { drawLessonSel(); return; }
  try { await api('/api/teacher/class/update', { code: T.code, lesson: e.target.value }); await refresh(true); } catch (err) { toast(err.message, 'err'); }
});
function toggleAuthor() {
  const on = !T.overview.class.authorMode;
  api('/api/teacher/class/update', { code: T.code, authorMode: on }).then(() => refresh()).catch(e => toast(e.message, 'err'));
}
$('#authorSw').addEventListener('click', toggleAuthor);
$('#authorSw').addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleAuthor(); } });
$('#newClass').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const first = moduleLessons(T.module)[0] || T.lessons[0]; // новый класс начинает с первого урока выбранного модуля
    const c = await api('/api/teacher/class', { name: $('#newName').value, lesson: first && first.id });
    $('#newName').value = '';
    await loadClasses(); T.code = c.code; drawClassSel(); await selectClass(c.code);
    toast(`Класс создан. Код: ${c.code}`, 'ok');
  } catch (err) { toast(err.message, 'err'); }
});
$('#logout').addEventListener('click', () => { Lab.token.clear(); location.href = '/'; });
$('#studentDlg').addEventListener('close', () => Games.stopAll()); // рамки сравнения моделей не играют за закрытым окном

boot();
