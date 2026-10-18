// «Моя студия» (/studio): полка своих игр, значки за решения геймдизайнера, колоды доноров и линз,
// журнал открытий и планов, банк идей класса и эмблема студии (она видна рядом с ником в аркаде).
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
  drawEmblems(); drawShelf(); drawBadges(); drawDeck(); drawJournal(); drawIdeas();
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
    host.append(Games.card(c, { actions: [
      el('a', { class: 'btn small', href: '/arcade?game=' + encodeURIComponent(c.id) }, '▶ Играть'),
      el('a', { class: 'btn ghost small', href: `/download/${c.id}/${c.version}.html`, download: '', title: 'Один файл .html: открывается в браузере без портала и без интернета. Можно отправить друзьям.' }, '⬇ Одним файлом'),
      el('span', { class: 'small muted' }, `версий ${c.versions}` + (c.balanced ? `, из них баланс ${c.balanced}` : '') + (d.players ? ` · играли ${d.players}` : '') + (c.hidden ? ' · скрыта из аркады' : '')),
    ] }));
  });
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
      j.twist ? ['Поворот', j.twist] : null,
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
