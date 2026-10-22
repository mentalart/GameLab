// «Моя студия» (/studio): полка своих игр, значки за решения геймдизайнера, колоды доноров и линз,
// журнал открытий и планов, банк идей класса, лесенка роста по самооценкам модулей (А4) и эмблема студии (она видна рядом с ником в аркаде).
'use strict';
const { el, api, toast } = Lab;
const $ = s => document.querySelector(s);
let D = null;

async function load() {
  try { D = await api('/api/studio'); } catch (e) {
    if (e.status === 401) { location.href = '/?next=' + encodeURIComponent(location.pathname); return; }
    toast(e.message, 'err'); return;
  }
  $('#nick').textContent = (D.emblem ? D.emblem + ' ' : '') + D.nick + ' · класс ' + D.class.code;
  $('#className').textContent = D.class.name;
  drawEmblems(); drawShelf(); drawPostcards(); drawRost(); drawBadges(); drawDeck(); drawJournal(); drawIdeas();
}

// полка открыток (И3): открытка первой игры каждого урока, тот же вид, что в шаге урока
function drawPostcards() {
  const host = $('#postcards'); host.innerHTML = '';
  if (!(D.postcards || []).length) { host.append(el('p', { class: 'muted' }, 'Открытка появится в финале урока: «Открытка первой игры».')); return; }
  D.postcards.forEach(c => host.append(el('div', { class: 'postcard' },
    el('div', { class: 'pc-top' }, el('span', { class: 'pc-emb' }, c.emblem || '🎮'), el('div', {}, el('div', { class: 'eyebrow' }, `Урок ${c.lesson} · v${c.version}`), el('h3', {}, c.title))),
    c.moment ? el('img', { class: 'pc-mo', src: c.moment, alt: 'Лучший момент игры', loading: 'lazy', onerror: e => e.currentTarget.remove() }) : null,
    c.feeling ? el('div', {}, el('span', { class: 'small muted' }, 'Задумал: '), c.feeling) : null,
    el('div', {}, el('span', { class: 'small muted' }, 'Соседи почувствовали: '), (c.emotions || []).length ? c.emotions.join(' ') : '—'),
    c.secret ? el('div', {}, el('span', { class: 'small muted' }, 'Спрятано: '), c.secret, c.voted ? el('span', { class: 'tag', style: 'margin-left:6px' }, `заметили ${c.felt} из ${c.voted}`) : null) : null,
    el('div', { class: 'pc-foot' }, c.record ? `🏆 Рекорд ${c.record.score} · ${c.record.nick}` : '🏆 Рекорда пока нет', el('span', { class: 'grow' }), c.at || ''))));
}

// лесенка роста (А4): ступень на модуль — средний балл самооценки; ниже — каждый вопрос: первый модуль → последний
function drawRost() {
  const host = $('#rost'); host.innerHTML = '';
  const R = D.rost || { ladder: [], skills: [], scale: [] }, L = R.ladder;
  if (!L.length) { host.append(el('p', { class: 'muted' }, 'Первая ступень появится в конце модуля 1: шаг «Что я умею как геймдизайнер».')); return; }
  const comma = x => String(x).replace('.', ',');
  const first = L[0], last = L[L.length - 1];
  host.append(el('div', { class: 'rost-ladder', role: 'list', 'aria-label': 'Лесенка роста по модулям' }, L.map(r => {
    const d = Math.round(10 * (r.avg - first.avg)) / 10;
    return el('div', { class: 'rost-rung' + (r === last ? ' now' : ''), role: 'listitem', style: `--h:${Math.round(r.avg / 5 * 100)}%`, title: (r.concepts || []).join(' · ') },
      el('span', { class: 'rr-bar', 'aria-hidden': 'true' }, el('i', {})), el('b', {}, comma(r.avg)), el('span', { class: 'eyebrow' }, `Модуль ${r.module}`),
      r !== first && d ? el('span', { class: 'small ' + (d > 0 ? 'rr-up' : 'muted') }, (d > 0 ? '+' : '') + comma(d)) : null,
      r.phrase ? el('span', { class: 'small muted rr-phrase' }, '«' + r.phrase + '»') : null);
  })));
  if (L.length > 1) host.append(el('div', { class: 'rost-skills' }, R.skills.map(k => {
    const a = Number(first.scores[k.id]) || 0, b = Number(last.scores[k.id]) || 0;
    return el('div', { class: 'row small' }, el('span', { 'aria-hidden': 'true' }, k.icon), el('span', { class: 'grow' }, k.label),
      el('span', { class: 'muted' }, `${R.scale[a - 1] || '—'} → `), el('b', { class: b > a ? 'rr-up' : '' }, R.scale[b - 1] || '—'));
  })));
}

function drawEmblems() {
  const host = $('#emblems'); host.innerHTML = '';
  D.emblems.forEach(e => host.append(el('button', {
    type: 'button', class: 'emblem' + (e === D.emblem ? ' on' : ''), role: 'radio', 'aria-checked': String(e === D.emblem), 'aria-label': 'Эмблема ' + e,
    onclick: async () => { try { await api('/api/studio/emblem', { emblem: e === D.emblem ? '' : e }); await load(); } catch (err) { toast(err.message, 'err'); } },
  }, e)));
}

function drawShelf() {
  const host = $('#shelf'); host.innerHTML = '';
  if (!D.games.length) { host.append(el('p', { class: 'muted' }, 'Полка пустая. Первая игра встанет сюда, как только ты соберёшь её на уроке.')); return; }
  D.games.forEach(c => {
    const d = c.discovery || {};
    host.append(Games.card(c, { extra: moments(c), actions: [
      el('a', { class: 'btn small', href: '/arcade?game=' + encodeURIComponent(c.id) }, '▶ Играть'),
      el('a', { class: 'btn ghost small', href: `/download/${c.id}/${c.version}.html`, download: '', title: 'Один файл .html: открывается в браузере без портала и без интернета. Можно отправить друзьям.' }, '⬇ Одним файлом'),
      el('span', { class: 'small muted' }, `версий ${c.versions}` + (c.balanced ? `, из них баланс ${c.balanced}` : '') + (d.players ? ` · играли ${d.players}` : '') + (c.hidden ? ' · скрыта из аркады' : '')),
    ] }));
  });
}

// лучшие моменты игры (Д4): ролики по 5 секунд — после рекорда или кнопкой «🎬 Момент»; 📌 — какой идёт на обложку аркады,
// открытку и в раскадровку трейлера, ✕ — убрать ролик
function moments(c) {
  const box = el('div', { class: 'stack', style: 'gap:6px', 'data-moments': c.id }, el('div', { class: 'eyebrow' }, '🎬 Лучшие моменты'));
  if (!(c.moments || []).length) { box.append(el('p', { class: 'small muted' }, 'Поставь рекорд или нажми «🎬 Момент» под игрой — последние 5 секунд станут роликом.')); return box; }
  const act = async (url, body, msg) => { try { await api(url, Object.assign({ game: c.id }, body)); toast(msg, 'ok'); await load(); } catch (e) { toast(e.message, 'err'); } };
  const best = c.moment && c.moment.id;
  box.append(el('div', { class: 'moments' }, c.moments.map(m => el('div', { class: 'moment' + (m.id === best ? ' pinned' : '') },
    el('img', { src: m.url, alt: `Момент: ${m.kindLabel}`, loading: 'lazy' }),
    el('span', {}, (m.id === best ? '★ ' : '') + (m.kind === 'record' ? `рекорд ${m.score}` : 'кнопка') + ` · ${m.nick}`),
    el('div', { class: 'row' },
      el('button', { class: 'btn ghost small', type: 'button', 'aria-pressed': String(!!m.pinned), 'data-pin': m.id, title: 'Этот момент — на обложку, открытку и в трейлер', onclick: () => act('/api/game/moment/pick', { id: m.id }, m.pinned ? 'Момент откреплён' : 'Этот момент теперь лучший') }, m.pinned ? '📌 открепить' : '📌'),
      el('button', { class: 'btn ghost small', type: 'button', title: 'Убрать ролик', onclick: () => act('/api/game/moment/remove', { id: m.id }, 'Момент убран') }, '✕'))))));
  return box;
}

function drawBadges() {
  const host = $('#badges'); host.innerHTML = '';
  D.badges.forEach(b => host.append(el('div', { class: 'badge' + (b.got ? ' got' : ''), title: b.how },
    el('span', { class: 'ico', 'aria-hidden': 'true' }, b.icon),
    el('div', {}, el('b', {}, b.title), el('div', { class: 'small muted' }, b.got ? 'получен' : b.how)))));
}

function drawDeck() {
  const host = $('#deck'); host.innerHTML = '';
  if (!D.deck.length) { host.append(el('p', { class: 'muted' }, 'Карты появятся после первого урока.')); return; }
  D.deck.forEach(d => {
    host.append(el('div', { class: 'deck-card donor' }, el('div', { class: 'small muted' }, `Донор · урок ${d.lesson}`), el('b', {}, d.donor || d.title), el('p', { class: 'small' }, d.goal)));
    if (d.lens) host.append(el('div', { class: 'deck-card lens' }, el('div', { class: 'small muted' }, `Линза · урок ${d.lesson}`), el('b', {}, d.lens)));
  });
}

function drawJournal() {
  const host = $('#journal'); host.innerHTML = '';
  if (!D.journal.length) { host.append(el('p', { class: 'muted' }, 'В конце каждого урока ты записываешь открытие дня и план версии 2. Они соберутся здесь.')); return; }
  D.journal.slice().reverse().forEach(j => {
    const rows = [
      j.twist ? ['Твист', j.twist] : null,
      j.decisions && j.decisions.feeling ? ['Что почувствует игрок', j.decisions.feeling] : null,
      ...(j.experiments || []).map(x => ['Эксперимент', x]),
      j.discovery ? ['Открытие дня', j.discovery] : null,
      j.plan ? ['План версии 2', j.plan] : null,
    ].filter(Boolean);
    host.append(el('div', { class: 'card stack journal-entry', style: 'gap:8px' },
      el('h3', {}, `Урок ${j.lesson}. ${j.title}` + (j.game ? ` — «${j.game}»` : '')),
      el('dl', { class: 'jl' }, ...rows.flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, v)]))));
  });
}

function drawIdeas() {
  const host = $('#ideas'); host.innerHTML = '';
  if (!D.ideas.length) { host.append(el('p', { class: 'muted' }, 'Идеи появятся, когда класс начнёт оставлять карточки плейтеста.')); return; }
  D.ideas.forEach(i => host.append(el('div', { class: 'idea' }, el('span', { class: 'tag' }, i.from), el('span', {}, i.text),
    el('span', { class: 'small muted' }, i.game ? `к игре «${i.game}»` : i.question || ''))));
}

$('#logout').addEventListener('click', () => { Lab.token.clear(); location.href = '/'; });
load();
