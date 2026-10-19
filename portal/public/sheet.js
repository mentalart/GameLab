// Лист урока на одну страницу (/sheet?code=КОД, У3): собирается из файла урока — вопрос урока, три понятия, хронометраж чекпоинтов
// со «Скажите» и «Дальше, когда», словарик и список «перед уроком». Только для учителя: читает /api/teacher/overview.
'use strict';
const { el, api } = Lab;
(async () => {
  const host = document.getElementById('sheet');
  let code = new URLSearchParams(location.search).get('code');
  try { code = code || localStorage.getItem('lab:teacher:class'); } catch (e) { /* пусто */ }
  let o;
  try { o = await api('/api/teacher/overview?code=' + encodeURIComponent(code || '')); } catch (e) {
    host.innerHTML = ''; host.append(el('p', {}, 'Лист урока открывается из панели учителя: ' + e.message)); return;
  }
  const les = o.lesson, cps = les.checkpoints;
  const clock = m => Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0');
  let at = 0;
  const rows = cps.map((c, i) => {
    const t = c.teacher || {}, start = at; at += c.minutes || 0;
    return el('tr', {},
      el('td', { class: 't' }, clock(start)),
      el('td', { class: 'cp' }, el('b', {}, `${i + 1}. ${c.title}`), el('span', { class: 'muted' }, `${c.minutes} мин`)),
      el('td', {}, t.say || '', el('div', { class: 'steps' }, c.steps.map(s => s.title).join(' · ')), t.next ? el('div', { class: 'next' }, 'Дальше, когда: ' + t.next) : null));
  });
  document.title = `Лист урока ${les.number} · ${les.title}`;
  host.innerHTML = '';
  host.append(
    el('h1', {}, `Урок ${les.number}. ${les.title}`),
    el('p', { class: 'meta' }, `Донор: ${les.donor} · ${at} мин · класс ${o.class.code}`),
    el('p', { style: 'margin:0 0 6px' }, les.goal),
    les.question ? el('div', { class: 'q' }, 'Вопрос урока, в начале и в конце: ', les.question) : null,
    les.concepts ? [el('h2', {}, 'Три понятия урока'), el('div', { class: 'cols' }, les.concepts.map(c => el('div', { class: 'concept' }, el('b', {}, c.title), c.text)))] : null,
    el('h2', {}, 'Ход урока'),
    el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, 'Время'), el('th', {}, 'Чекпоинт'), el('th', {}, 'Скажите · шаги · дальше'))), el('tbody', {}, rows)),
    o.glossary && o.glossary.length ? [el('h2', {}, 'Словарик: слово — одна фраза'), el('div', { class: 'gloss' }, o.glossary.map(g => el('div', {}, el('b', {}, g.term), ' — ', g.say)))] : null,
    les.lens ? el('p', { style: 'margin:8px 0 0' }, el('b', {}, 'Линза урока: '), les.lens) : null,
    el('h2', {}, 'Перед уроком'),
    el('ul', { class: 'check' }, ['Проектор открыт, код класса на экране', 'chat.qwen.ai открывается в школьной сети', 'Ученики знают адрес портала', 'Наушники или звук тише', 'Пульт: вкладка «Урок» в панели', 'Лист рядом']
      .map(x => el('li', {}, x))));
})();
