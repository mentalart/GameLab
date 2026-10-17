// Панель учителя: классы, чекпоинты, ученики и отзыв учителя, аркада класса, настройки ИИ, журнал генераций, заметки автора.
'use strict';
const { el, api, toast, copy, fmtTime, fieldEditor, valText } = Lab;
const $ = s => document.querySelector(s);
const T = { classes: [], lessons: [], code: null, overview: null, timer: null };

async function boot() {
  try { await loadClasses(); } catch (e) { if (e.status === 401) { location.href = '/'; return; } toast(e.message, 'err'); return; }
  api('/api/info').then(i => { $('#demoBanner').hidden = !i.demo; });
  try { T.code = localStorage.getItem('lab:teacher:class'); } catch (e) { /* пусто */ }
  if (!T.classes.find(c => c.code === T.code)) T.code = T.classes[0] ? T.classes[0].code : null;
  drawClassSel();
  await selectClass(T.code);
  T.timer = setInterval(refresh, 3000);
}
async function loadClasses() {
  const r = await api('/api/teacher/classes');
  T.classes = r.classes; T.lessons = r.lessons;
}
function drawClassSel() {
  const sel = $('#classSel'); sel.innerHTML = '';
  if (!T.classes.length) sel.append(el('option', { value: '' }, 'Классов пока нет — создайте ниже'));
  T.classes.forEach(c => sel.append(el('option', { value: c.code, selected: c.code === T.code ? true : null }, `${c.name} · ${c.code}`)));
  const ls = $('#lessonSel'); ls.innerHTML = '';
  T.lessons.forEach(l => ls.append(el('option', { value: l.id }, `Урок ${l.number}. ${l.title}`)));
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
  T.overview = o;
  $('#classCode').textContent = o.class.code;
  $('#classLink').textContent = `Адрес: ${location.origin}/?code=${o.class.code}`;
  $('#lessonSel').value = o.class.lesson;
  const sw = $('#authorSw'); sw.classList.toggle('on', !!o.class.authorMode); sw.setAttribute('aria-checked', String(!!o.class.authorMode));
  drawLesson();
}

/* ---------- вкладка «Урок» ---------- */
function drawLesson() {
  const o = T.overview, host = $('#tab-lesson');
  const keepScroll = scrollY;
  host.innerHTML = '';
  const opened = o.class.opened;
  const cps = o.lesson.checkpoints;
  const nextCp = cps.find(c => !opened.includes(c.id));
  host.append(el('div', { class: 'row' },
    el('div', { class: 'grow stack', style: 'gap:2px' }, el('div', { class: 'eyebrow' }, `Урок ${o.lesson.number} · донор ${o.lesson.donor}`), el('h2', {}, o.lesson.title)),
    nextCp ? el('button', { class: 'btn', type: 'button', onclick: () => setOpened(opened.concat(nextCp.id)) }, `Открыть: ${nextCp.title} →`) : el('span', { class: 'tag ok' }, 'все чекпоинты открыты'),
    el('button', { class: 'btn ghost small', type: 'button', onclick: () => setOpened(cps.map(c => c.id)) }, 'Открыть все'),
    el('button', { class: 'btn ghost small', type: 'button', onclick: () => { if (confirm('Закрыть все чекпоинты?')) setOpened([]); } }, 'Закрыть все')));
  host.append(el('p', { class: 'muted small' }, o.lesson.goal));
  const studentsAt = id => o.students.filter(s => s.where && cps.find(c => c.id === id).steps.some(st => st.id === s.where)).length;
  host.append(el('div', { class: 'stack', style: 'gap:6px' }, cps.map((c, i) => {
    const on = opened.includes(c.id);
    const sw = el('div', { class: 'switch' + (on ? ' on' : ''), role: 'switch', tabindex: '0', 'aria-checked': String(on), 'aria-label': 'Открыть чекпоинт ' + c.title });
    const toggle = () => setOpened(on ? opened.filter(x => x !== c.id) : opened.concat(c.id));
    sw.addEventListener('click', toggle); sw.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); } });
    return el('div', { class: 'cprow' + (on ? ' open' : '') }, sw,
      el('div', { class: 'grow' }, el('b', {}, `${i + 1}. ${c.title}`), el('div', { class: 'small muted' }, `${c.minutes} мин · ${c.steps.map(s => s.title).join(' · ')}`)),
      el('span', { class: 'tag' }, `здесь: ${studentsAt(c.id)}`));
  })));
  host.append(el('h3', {}, `Ученики (${o.students.length})`));
  if (!o.students.length) host.append(el('p', { class: 'muted' }, `Пока никто не вошёл. Ученики открывают ${location.origin}/ и вводят код ${o.class.code}.`));
  else {
    const stepTitle = id => { for (const c of cps) for (const s of c.steps) if (s.id === id) return `${c.title} → ${s.title}`; return '—'; };
    host.append(el('div', { class: 'tablewrap' }, el('table', {},
      el('thead', {}, el('tr', {}, ['Ник', 'Где сейчас', 'Шагов готово', 'Своими словами', 'Игра', 'Плейтест', 'Отзыв учителя', 'Запросов к ИИ', 'Был'].map(h => el('th', {}, h)))),
      el('tbody', {}, o.students.map(s => el('tr', { class: 'click', onclick: () => openStudent(s.nick) },
        el('td', {}, el('b', {}, s.nick)),
        el('td', {}, stepTitle(s.where)),
        el('td', {}, String(s.done)),
        el('td', {}, s.fields ? `${s.fields - s.dice} из ${s.fields}` : '—', s.dice >= 3 ? el('span', { class: 'tag dice', style: 'margin-left:6px' }, `кубик: ${s.dice}`) : null),
        el('td', {}, s.game ? [`v${s.game.current} из ${s.game.versions}`, s.game.error ? el('span', { class: 'tag err', style: 'margin-left:6px', title: s.game.error }, 'ошибка') : null, s.game.hidden ? el('span', { class: 'tag', style: 'margin-left:6px' }, 'скрыта') : null] : '—'),
        el('td', {}, s.game ? `партий чужих: ${s.plays}` : '—'),
        el('td', {}, s.feedback ? el('span', { class: 'tag ok' }, '✓ есть') : s.game ? el('span', { class: 'tag' }, 'написать →') : '—'),
        el('td', {}, String(s.aiCalls)),
        el('td', { class: 'muted' }, fmtTime(s.seen))))))));
  }
  scrollTo(0, keepScroll);
}
async function setOpened(list) {
  try { await api('/api/teacher/class/update', { code: T.code, opened: list }); await refresh(); } catch (e) { toast(e.message, 'err'); }
}
async function openStudent(nick) {
  try {
    const r = await api(`/api/teacher/student?code=${T.code}&nick=${encodeURIComponent(nick)}`);
    $('#sdTitle').textContent = nick;
    const body = $('#sdBody'); body.innerHTML = '';
    body.append(el('h3', {}, 'Замысел (так его видят продюсер и программист)'), el('pre', { class: 'plan' }, r.plan));
    if (r.game && r.game.versions.length) {
      body.append(el('h3', {}, `Игра «${r.game.title || ''}»`));
      body.append(el('div', { class: 'stack', style: 'gap:4px' }, r.game.versions.map(v => el('div', { class: 'row small' },
        el('a', { href: `/play/${r.game.id}/${v.n}`, target: '_blank', rel: 'noopener' }, `v${v.n}`),
        el('span', {}, v.kind || ''), v.request ? el('span', { class: 'muted' }, '«' + v.request + '»') : null,
        el('span', { class: 'muted' }, `${v.model || ''}${v.attempts > 1 ? ', попыток ' + v.attempts : ''}`),
        v.n === r.game.current ? el('span', { class: 'tag ok' }, 'текущая') : null,
        v.error ? el('span', { class: 'tag err', title: v.error.message }, 'ошибка: ' + v.error.message) : null))));
    } else body.append(el('p', { class: 'muted' }, 'Игра ещё не собрана.'));
    if (r.discovery) body.append(el('h3', {}, 'Плейтест: игра глазами класса'), Games.discovery(r.discovery));
    body.append(feedbackEditor(nick, r.feedback));
    $('#studentDlg').showModal();
  } catch (e) { toast(e.message, 'err'); }
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

/* ---------- вкладка «Аркада» ---------- */
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
      } }, 'Проверить ключ и список моделей')),
    el('p', { class: 'muted small' }, `Лимиты: ${s.limits.aiCallsPerStudentPerLesson} запросов на ученика за урок` + (s.limits.rublesPerLesson ? `, потолок урока ${s.limits.rublesPerLesson} ₽` : ', потолок расходов не задан') + '. Цены моделей для подсчёта рублей — в config.json (models).')));
  const box = el('pre', { class: 'plan', hidden: true });
  host.append(box);
  host.append(el('h3', {}, 'Журнал генераций'),
    el('p', { class: 'muted small' }, `Вызовов модели: ${g.total.calls}, потрачено: ${g.total.rub} ₽` + (g.total.demo ? ` · демо-вызовов: ${g.total.demo}` : '') + '. Это и есть проверка главного допущения: сколько игр собирается с первой попытки, сколько стоит и сколько длится.'));
  if (g.byModel.length) host.append(el('div', { class: 'tablewrap' }, el('table', {},
    el('thead', {}, el('tr', {}, ['Модель', 'Вызовов', 'Без ошибки', 'Среднее время', 'Токены вход/выход', '₽'].map(h => el('th', {}, h)))),
    el('tbody', {}, g.byModel.map(m => el('tr', {}, el('td', {}, m.model), el('td', {}, String(m.calls)), el('td', {}, Math.round(100 * m.ok / m.calls) + '%'),
      el('td', {}, Math.round(m.ms / m.calls / 1000) + ' с'), el('td', {}, `${m.tokensIn} / ${m.tokensOut}`), el('td', {}, String(Math.round(m.rub * 100) / 100))))))));
  if (g.last.length) host.append(el('div', { class: 'tablewrap' }, el('table', {},
    el('thead', {}, el('tr', {}, ['Когда', 'Ученик', 'Что', 'Модель', 'Время', '₽', 'Итог'].map(h => el('th', {}, h)))),
    el('tbody', {}, g.last.map(e => el('tr', {}, el('td', { class: 'muted' }, fmtTime(e.at)), el('td', {}, e.nick || ''), el('td', {}, e.kind), el('td', {}, e.model || ''),
      el('td', {}, e.ms ? Math.round(e.ms / 1000) + ' с' : '—'), el('td', {}, e.rub == null ? '—' : String(e.rub)), el('td', {}, e.ok ? el('span', { class: 'tag ok' }, 'ок') : el('span', { class: 'tag err', title: e.error || '' }, e.error ? e.error.slice(0, 40) : 'ошибка'))))))));
}

/* ---------- вкладка «Заметки автора» ---------- */
async function drawNotes() {
  const host = $('#tab-notes'); host.innerHTML = '';
  let r;
  try { r = await api('/api/teacher/notes'); } catch (e) { toast(e.message, 'err'); return; }
  const text = r.notes.map(n => `- [${n.lesson || 'портал'}${n.checkpoint ? ' / ' + n.checkpoint : ''}${n.step ? ' / ' + n.step : ''}] ${n.text} (${n.who}, ${new Date(n.at).toLocaleString('ru-RU')})`).join('\n');
  host.append(el('div', { class: 'row' }, el('p', { class: 'grow muted' }, `Заметок: ${r.notes.length}. Их пишут на каждом шаге урока кнопкой «Заметка автора». Скопируйте и пришлите в чат «Сборка» — Claude превратит их в правки.`),
    el('button', { class: 'btn', type: 'button', onclick: () => copy('Заметки автора курса:\n' + text) }, '⧉ Скопировать все')));
  if (!r.notes.length) host.append(el('p', { class: 'muted' }, 'Заметок пока нет.'));
  r.notes.forEach(n => host.append(el('div', { class: 'card stack', style: 'gap:6px;padding:12px 14px' },
    el('div', { class: 'row small muted' }, el('span', { class: 'tag' }, [n.lesson, n.checkpoint, n.step].filter(Boolean).join(' / ') || 'портал'), n.who, ' · ', new Date(n.at).toLocaleString('ru-RU')),
    el('div', {}, n.text))));
}

/* ---------- события ---------- */
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
  ['lesson', 'arcade', 'ai', 'notes'].forEach(t => { $('#tab-' + t).hidden = t !== b.dataset.tab; });
  if (b.dataset.tab === 'arcade') drawArcade();
  if (b.dataset.tab === 'ai') drawAI();
  if (b.dataset.tab === 'notes') drawNotes();
}));
$('#classSel').addEventListener('change', e => selectClass(e.target.value));
$('#lessonSel').addEventListener('change', async e => {
  if (!confirm('Сменить урок класса? Открытые чекпоинты закроются, ответы учеников сохранятся.')) { e.target.value = T.overview.class.lesson; return; }
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
    const c = await api('/api/teacher/class', { name: $('#newName').value, lesson: T.lessons[0] && T.lessons[0].id });
    $('#newName').value = '';
    await loadClasses(); T.code = c.code; drawClassSel(); await selectClass(c.code);
    toast(`Класс создан. Код: ${c.code}`, 'ok');
  } catch (err) { toast(err.message, 'err'); }
});
$('#logout').addEventListener('click', () => { Lab.token.clear(); location.href = '/'; });

boot();
