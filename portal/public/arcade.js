// Аркада класса (/arcade): игры одноклассников с рекордами, вызов «побей мой мир» по коду и личная аркада ученика.
'use strict';
const { el, api, toast, beep } = Lab;
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
function play(c, ch) {
  Games.stopAll();
  A.playing = c.id;
  const stage = $('#stage'); stage.innerHTML = ''; stage.hidden = false;
  const seed = ch ? ch.challenge.seed : null, version = ch ? ch.challenge.version : c.version;
  const scoreHost = el('div'), chHost = el('div'), topHost = el('div');
  const showScores = () => { scoreHost.innerHTML = ''; scoreHost.append(Games.scores(c)); };
  const showTop = list => {
    topHost.innerHTML = '';
    if (list && list.length) topHost.append(el('div', { class: 'small' }, el('b', {}, ch ? 'Таблица вызова: ' : 'Таблица рекордов: '), list.slice(0, 5).map((r, i) => `${i + 1}. ${r.nick} — ${r.score}`).join(' · ')));
  };
  const game = Object.assign({}, c, { version });
  const h = Games.frame({
    src: () => `/play/${c.id}/${version}` + (seed != null ? '?seed=' + seed : ''), key: () => 'game:' + c.id,
    info: () => ({ version, challenge: ch ? ch.challenge.code : undefined }), label: ch ? 'Принять вызов' : 'Играть', autostart: true,
    onOver: m => { chHost.innerHTML = ''; chHost.append(Games.challenge(game, m)); },
    onScore: (m, r) => {
      c.authorBest = r.authorBest || 0; c.myBest = r.mine; c.record = r.record; showScores();
      if (ch && r.challenge) {
        showTop(r.challenge.top);
        if (m.score > ch.challenge.score) { beep('done'); toast(`Вызов принят и выигран: ${m.score} против ${ch.challenge.score}!`, 'ok'); }
      } else showTop(r.top);
    },
    onError: err => h.message(el('b', {}, 'Игра упала: ' + (err.message || 'ошибка') + '. Скажи автору.')),
  });
  stage.append(
    el('div', { class: 'row' }, el('div', { class: 'grow stack', style: 'gap:2px' },
      el('div', { class: 'eyebrow' }, ch ? `Вызов ${ch.challenge.code} от ${ch.challenge.nick}` : 'Сейчас играешь'),
      el('h2', {}, c.title), el('div', { class: 'small muted' }, `автор: ${c.nick} · версия ${version}` + (c.donor ? ` · по мотивам механики ${c.donor}` : ''))),
      el('button', { class: 'btn ghost small', type: 'button', onclick: () => { Games.stopAll(); stage.hidden = true; A.playing = null; history.replaceState(null, '', '/arcade'); } }, '✕ Закрыть')),
    ch ? el('p', { class: 'concept' }, `⚔ ${ch.challenge.nick} набрал ${ch.challenge.score} очков в мире №${seed}. У тебя тот же мир — побей!`) : null,
    scoreHost, h.box, Games.bar(h), topHost, chHost);
  showScores();
  if (ch) showTop(ch.records.top);
  stage.scrollIntoView({ behavior: 'smooth' });
}
async function openChallenge(code) {
  code = String(code || '').trim().toUpperCase();
  if (!code) return;
  try {
    const r = await api('/api/challenge?code=' + encodeURIComponent(code));
    history.replaceState(null, '', '/arcade?ch=' + code);
    play(r.game, r);
  } catch (e) { toast(e.message, 'err'); }
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
      Games.card(c, { actions: [el('button', { class: 'btn small', type: 'button', onclick: () => play(c) }, '▶ Играть'), hide] }),
      el('div', { class: 'card stack', style: 'gap:8px' }, el('h3', {}, `Урок ${c.lesson ? c.lesson.number + '. ' + c.lesson.title : ''}`),
        el('div', { class: 'small muted' }, `Версий: ${c.versions}, в аркаде — версия ${c.version}. Партий чужих игроков: ${c.plays}.`),
        Games.discovery(c.discovery))));
  });
}

$('#chForm').addEventListener('submit', e => { e.preventDefault(); openChallenge($('#chCode').value); });
$('#logout').addEventListener('click', () => { Lab.token.clear(); location.href = '/'; });

(async () => {
  if (!(await load())) return;
  const q = new URLSearchParams(location.search);
  if (q.get('ch')) openChallenge(q.get('ch'));
  else if (q.get('game')) { const c = A.data.games.concat(A.data.mine).find(g => g.id === q.get('game')); if (c) play(c); }
  // соседи собрали игру или поставили рекорд — аркада обновляется сама (сцена с игрой не трогается)
  const es = new EventSource('/api/events?token=' + encodeURIComponent(Lab.token.get()));
  let t = null;
  es.addEventListener('arcade', () => { clearTimeout(t); t = setTimeout(load, 800); });
})();
