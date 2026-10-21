// Аркада класса (/arcade): игры одноклассников с рекордами, вызов «побей мой мир» по коду и личная аркада ученика;
// сверху — цель класса (партии в игры друг друга), внизу — галерея провалов класса с голосом «самый смешной».
'use strict';
const { el, api, toast } = Lab;
const $ = s => document.querySelector(s);
const A = { data: null, playing: null };

async function load() {
  try { A.data = await api('/api/arcade'); } catch (e) {
    if (e.status === 401) { location.href = '/?next=' + encodeURIComponent(location.pathname + location.search); return false; }
    toast(e.message, 'err'); return false;
  }
  $('#nick').textContent = A.data.nick + ' · класс ' + A.data.class.code;
  $('#className').textContent = A.data.class.name;
  drawGames(); drawMine();
  return true;
}

/* ---------- аркада класса ---------- */
function drawGames() {
  const host = $('#games'); host.innerHTML = '';
  const list = A.data.games.slice().sort((a, b) => Number(b.mine) - Number(a.mine) || ((b.lesson || {}).number || 0) - ((a.lesson || {}).number || 0) || a.title.localeCompare(b.title, 'ru'));
  if (!list.length) { host.append(el('p', { class: 'muted' }, 'В аркаде пока пусто. Игры появятся здесь, как только одноклассники их соберут.')); return; }
  list.forEach(c => host.append(Games.card(c, { actions: [
    el('button', { class: 'btn small', type: 'button', onclick: () => play(c) }, c.mine ? '▶ Сыграть в свою' : '▶ Играть'),
    c.mine ? null : el('span', { class: 'small muted' }, c.myBest ? `твой лучший: ${c.myBest}` : 'ещё не играл'),
  ] })));
}

/* ---------- сцена: игра, табло, вызов ---------- */
function play(c) {
  Games.stopAll();
  A.playing = c.id;
  const stage = $('#stage'); stage.innerHTML = ''; stage.hidden = false;
  const scoreHost = el('div'), chHost = el('div'), topHost = el('div');
  const showScores = () => { scoreHost.innerHTML = ''; scoreHost.append(Games.scores(c)); };
  const showTop = list => {
    topHost.innerHTML = '';
    if (list && list.length) topHost.append(el('div', { class: 'small' }, el('b', {}, 'Таблица рекордов: '), list.slice(0, 5).map((r, i) => `${i + 1}. ${r.nick} — ${r.score}`).join(' · ')));
  };
  const h = Games.frame({
    src: () => `/play/${c.id}/${c.version}`, key: () => 'game:' + c.id, info: () => ({ version: c.version }), label: 'Играть', autostart: true, challenge: true,
    onOver: m => { chHost.innerHTML = ''; chHost.append(Games.challenge(c, m)); },
    onScore: (m, r) => { c.authorBest = r.authorBest || 0; c.myBest = r.mine; c.record = r.record; showScores(); showTop(r.top); },
    onError: err => h.message(el('b', {}, 'Игра упала: ' + (err.message || 'ошибка') + '. Скажи автору.')),
  });
  stage.append(
    el('div', { class: 'row' }, el('div', { class: 'grow stack', style: 'gap:2px' },
      el('div', { class: 'eyebrow' }, 'Сейчас играешь'),
      el('h2', {}, c.title), el('div', { class: 'small muted' }, `автор: ${c.nick} · версия ${c.version}` + (c.donor ? ` · по мотивам механики ${c.donor}` : ''))),
      el('button', { class: 'btn ghost small', type: 'button', onclick: closeStage }, '✕ Закрыть')),
    scoreHost, h.box, Games.bar(h), topHost, chHost);
  showScores();
  stage.scrollIntoView({ behavior: 'smooth' });
}
function closeStage() { Games.stopAll(); $('#stage').hidden = true; A.playing = null; history.replaceState(null, '', '/arcade'); }
// вызов по коду или с доски вызовов: тот же мир, призрак лидера, таблица вызова — для любой игры урока (донор, игра класса, игра ученика)
async function openChallenge(code) {
  code = String(code || '').trim().toUpperCase();
  if (!code) return;
  let r;
  try { r = await api('/api/challenge?code=' + encodeURIComponent(code)); } catch (e) { toast(e.message, 'err'); return; }
  history.replaceState(null, '', '/arcade?ch=' + code);
  Games.stopAll();
  A.playing = r.challenge.game;
  const stage = $('#stage'); stage.innerHTML = ''; stage.hidden = false;
  stage.append(Games.challengeStage(r, { onClose: closeStage }));
  stage.scrollIntoView({ behavior: 'smooth' });
}

/* ---------- личная аркада ---------- */
function drawMine() {
  const host = $('#mine'); host.innerHTML = '';
  if (!A.data.mine.length) { host.append(el('p', { class: 'muted' }, 'Здесь появятся твои игры, когда соберёшь первую на уроке.')); return; }
  A.data.mine.forEach(c => {
    const hide = el('button', { class: 'btn ghost small', type: 'button' }, c.hidden ? '👁 Вернуть в аркаду' : '🙈 Скрыть из аркады');
    hide.addEventListener('click', async () => {
      try { await api('/api/arcade/hide', { game: c.id, hidden: !c.hidden }); toast(c.hidden ? 'Игра снова в аркаде' : 'Игра скрыта из аркады класса', 'ok'); await load(); } catch (e) { toast(e.message, 'err'); }
    });
    host.append(el('div', { class: 'mine-row' },
      Games.card(c, { actions: [el('button', { class: 'btn small', type: 'button', onclick: () => play(c) }, '▶ Играть'), hide,
        el('a', { class: 'btn ghost small', href: `/download/${c.id}/${c.version}.html`, download: '', title: 'Один файл .html: открывается без портала и без интернета' }, '⬇ Скачать')] }),
      el('div', { class: 'card stack', style: 'gap:8px' }, el('h3', {}, `Урок ${c.lesson ? c.lesson.number + '. ' + c.lesson.title : ''}`),
        el('div', { class: 'small muted' }, `Версий: ${c.versions}, в аркаде — версия ${c.version}. Партий чужих игроков: ${c.plays}.`),
        Games.discovery(c.discovery))));
  });
}

$('#chForm').addEventListener('submit', e => { e.preventDefault(); openChallenge($('#chCode').value); });
$('#logout').addEventListener('click', () => { Lab.token.clear(); location.href = '/'; });

(async () => {
  if (!(await load())) return;
  A.board = Games.board({ open: openChallenge });
  $('#board').append(A.board);
  const q = new URLSearchParams(location.search);
  if (q.get('ch')) openChallenge(q.get('ch'));
  else if (q.get('game')) { const c = A.data.games.concat(A.data.mine).find(g => g.id === q.get('game')); if (c) play(c); }
  // цель класса (Д2) над аркадой и галерея провалов класса (Д5) внизу — public/klass.js
  const goal = LabKlass.goalBar(); $('#goal').append(goal.box);
  api('/api/goal').then(r => goal.update(r.goal)).catch(() => {});
  const gal = LabKlass.fails($('#fails'));
  // соседи собрали игру или поставили рекорд — аркада обновляется сама (сцена с игрой не трогается)
  const es = new EventSource('/api/events?token=' + encodeURIComponent(Lab.token.get()));
  es.addEventListener('goal', e => goal.update(JSON.parse(e.data), true));
  let ft = null;
  es.addEventListener('fails', () => { clearTimeout(ft); ft = setTimeout(gal.load, 500); });
  es.addEventListener('challenge', e => Games.challengeEvent(JSON.parse(e.data), A.data.nick, A.board));
  let t = null;
  es.addEventListener('arcade', () => { clearTimeout(t); t = setTimeout(load, 800); });
})();
