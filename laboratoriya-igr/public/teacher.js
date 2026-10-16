'use strict';
/* Панель учителя: чекпоинты, общая игра, ученики, аркада класса. */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pick = a => a[Math.floor(Math.random() * a.length)];
let KEY = ''; try { KEY = sessionStorage.getItem('lab-teacher') || ''; } catch (e) {}
let S = null, LESSON = null, pollT = null, openStudent = null, previewId = null;

async function api(path, body) {
  const r = await fetch(path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'x-teacher-key': KEY }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) { KEY = ''; try { sessionStorage.removeItem('lab-teacher'); } catch (e) {} login('Неверный пароль'); throw new Error('auth'); }
  if (!r.ok) throw new Error(j.error || 'Ошибка ' + r.status);
  return j;
}

function login(err) {
  clearInterval(pollT);
  $('#main').innerHTML = `<div class="join step"><div class="eyebrow">Лаборатория игр</div><h1>Панель учителя</h1>
    <div class="panel"><div class="field nodice"><label for="pw">Пароль учителя (в config.json и в окне сервера)</label><input id="pw" type="password" autocomplete="current-password"></div>
    <div class="row"><button class="btn" id="go" type="button">Войти</button></div><div class="err" role="alert">${esc(err || '')}</div></div></div>`;
  const go = async () => { KEY = $('#pw').value.trim(); try { sessionStorage.setItem('lab-teacher', KEY); } catch (e) {} try { await load(); renderAll(); startPoll(); } catch (e) {} };
  $('#go').onclick = go; $('#pw').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
}

async function load() { S = await api('/api/teacher/state'); if (!LESSON) LESSON = await (await fetch('/api/lesson')).json(); }
function startPoll() { clearInterval(pollT); pollT = setInterval(async () => { try { await load(); renderLive(); } catch (e) {} }, 3000); }

function renderAll() {
  $('#main').innerHTML = `<div class="step">
    <div><div class="eyebrow">Лаборатория игр</div><h1>Панель учителя · ${esc(S.lesson.title)}</h1></div>
    <div class="cols">
      <div class="panel"><div class="eyebrow">Код класса</div><div class="code" id="code"></div><div class="note">Ученики открывают:</div><div id="urls"></div></div>
      <div class="panel"><div class="eyebrow">ИИ</div><div id="ai"></div><div class="row"><button class="ghost" id="test" type="button">Проверить связь с Qwen</button></div><div class="note" id="testRes"></div></div>
    </div>
    <div class="panel"><h2>Чекпоинты</h2><p class="note">Ученики видят шаги только до открытого чекпоинта. Открывайте следующий, когда класс готов.</p><div class="cpbtns" id="cps"></div></div>
    <div class="panel"><h2>Общая игра урока</h2><p class="note">По умолчанию — «Сова-хакер». Можно собрать новую вместе с классом: вытяните карты или запишите идею, которую выкрикнули ученики.</p>
      <div class="row"><b id="sharedTitle"></b><a href="/play/shared" target="_blank" rel="noopener" id="sharedOpen">Открыть на проектор</a><button class="ghost" id="sova" type="button">Вернуть «Сову-хакера»</button></div>
      <div class="field"><label for="f-idea">Идея общей игры</label><textarea id="f-idea" placeholder="Сова-хакер уворачивается от метеоритов на плато Лаго-Наки, а гравитация переворачивается каждые 10 секунд"></textarea><button type="button" class="dice" id="ideaDice" aria-label="Вытянуть карты">⚄</button></div>
      <div class="row"><button class="btn" id="genShared" type="button">Собрать с Qwen</button></div><div id="sharedBox"></div></div>
    <div class="panel"><h2>Ученики</h2><div class="tablewrap"><table><thead><tr><th>Имя</th><th>Где сейчас</th><th>Игры</th><th>XP</th><th>Активность</th></tr></thead><tbody id="students"></tbody></table></div></div>
    <div class="panel"><h2>Аркада класса</h2><p class="note">Все игры учеников. Открывайте на проекторе для общего плейтеста.</p><div id="arcade" class="games"></div></div>
    <div class="panel"><h2>Новый класс</h2><p class="note">Сохранит резервную копию в папку data, очистит учеников и выдаст новый код класса.</p><div class="row"><button class="ghost" id="reset" type="button">Начать с новым классом</button></div><div class="note" id="resetRes"></div></div>
  </div><div id="drawerBox"></div>`;
  $('#test').onclick = async () => { $('#testRes').textContent = 'Проверяю…'; try { const r = await api('/api/teacher/test-ai', {}); $('#testRes').textContent = (r.ok ? 'Работает: ' : 'Ошибка: ') + r.text; } catch (e) { $('#testRes').textContent = e.message; } };
  $('#ideaDice').onclick = () => { const d = LESSON.decks; $('#f-idea').value = `${pick(d.hero)} ${pick(d.action)} ${pick(d.place)}, а ${pick(d.twist)}`; };
  $('#sova').onclick = async () => { await api('/api/teacher/shared/set', {}); await load(); renderLive(); };
  $('#genShared').onclick = genShared;
  $('#reset').onclick = async () => {
    const box = $('#resetRes');
    box.innerHTML = 'Чтобы подтвердить, напишите СБРОС: <input id="rc" style="width:120px"> <button class="ghost" id="rcGo" type="button">Подтвердить</button>';
    $('#rcGo').onclick = async () => { try { const r = await api('/api/teacher/new-lesson-run', { confirm: $('#rc').value.trim() }); box.textContent = `Готово. Резервная копия: ${r.backup}. Новый код класса: ${r.classCode}`; await load(); renderLive(); } catch (e) { box.textContent = e.message; } };
  };
  renderLive();
}

function ago(t) { if (!t) return '—'; const s = Math.round((Date.now() - t) / 1000); return s < 60 ? `${s} с назад` : s < 3600 ? `${Math.round(s / 60)} мин назад` : 'давно'; }

function renderLive() {
  if (!S || !$('#code')) return;
  $('#code').textContent = S.classCode;
  $('#urls').innerHTML = S.urls.map(u => `<div><b>${esc(u)}</b></div>`).join('');
  $('#ai').innerHTML = S.mode === 'demo'
    ? '<p><b>Демо-режим.</b> Ключ Qwen не задан в config.json, ответы подставные. Подходит для репетиции урока.</p>'
    : `<p>Qwen, модель <b>${esc(S.model)}</b>. Запросов: ${S.usage.calls}, токенов: ${S.usage.promptTokens + S.usage.completionTokens}, ошибок: ${S.usage.errors}. Сейчас в работе: ${S.running}, в очереди: ${S.queued}.</p>`;
  $('#cps').innerHTML = S.lesson.checkpoints.map(c => `<button type="button" class="cpbtn" data-n="${c.n}" aria-pressed="${c.n <= S.unlocked}"><b>${c.n}. ${esc(c.title)}</b><span>${c.n <= S.unlocked ? 'открыт' : 'закрыт'}</span></button>`).join('');
  document.querySelectorAll('.cpbtn').forEach(b => b.onclick = async () => { const n = +b.dataset.n; await api('/api/teacher/unlock', { cp: n === S.unlocked ? n - 1 || 1 : n }); await load(); renderLive(); });
  $('#sharedTitle').textContent = 'Сейчас: ' + (S.sharedTitle || '—');
  const counts = {}; S.students.forEach(s => { counts[s.cp] = (counts[s.cp] || 0) + 1; });
  $('#students').innerHTML = S.students.length ? S.students.sort((a, b) => a.name.localeCompare(b.name)).map(s => `<tr class="click" data-id="${s.id}" tabindex="0"><td><span class="dot ${s.busy ? '' : 'idle'}" title="${s.busy ? 'ждёт ответа Qwen' : ''}"></span>${esc(s.name)}</td><td>${s.cp ? 'Ч' + s.cp + ' · ' : ''}${esc(s.stepTitle || '')}</td><td>${s.games}</td><td>${s.xp}</td><td>${ago(s.lastSeen)}</td></tr>`).join('') : '<tr><td colspan="5" class="note">Пока никто не вошёл. Покажите код класса и адрес.</td></tr>';
  document.querySelectorAll('tr.click').forEach(tr => { tr.onclick = () => showStudent(tr.dataset.id); tr.onkeydown = e => { if (e.key === 'Enter') showStudent(tr.dataset.id); }; });
  $('#arcade').innerHTML = S.arcade.length ? S.arcade.map(g => `<article class="cab"><h3>${esc(g.title || 'Без названия')}</h3><div class="meta"><span class="chip">${esc(g.author)}</span><span class="chip">версия ${g.version}</span></div><a class="btn" style="align-self:flex-start;text-decoration:none" href="/play/${g.id}" target="_blank" rel="noopener">Открыть</a></article>`).join('') : '<p class="note">Игры появятся, когда ученики дойдут до чекпоинта 3.</p>';
}

async function genShared() {
  const idea = $('#f-idea').value.trim();
  if (!idea) { $('#sharedBox').innerHTML = '<p class="err">Запишите идею или вытяните карты.</p>'; return; }
  $('#genShared').disabled = true;
  $('#sharedBox').innerHTML = '<div class="loading"><div class="spinner"></div><div><b>Qwen собирает игру для класса…</b><div class="note"><span id="ss">0</span> с</div></div></div>';
  try {
    const { job } = await api('/api/teacher/shared/generate', { idea });
    let r;
    for (;;) { await sleep(1500); r = await api('/api/teacher/job/' + job); if ($('#ss')) $('#ss').textContent = r.seconds; if (r.status !== 'running') break; }
    if (r.status === 'error') throw new Error(r.error);
    previewId = r.result.gameId;
    $('#sharedBox').innerHTML = `<div class="frame"><iframe src="/play/${previewId}" title="Предпросмотр" sandbox="allow-scripts allow-pointer-lock" allow="gamepad; autoplay"></iframe></div>
      <div class="row"><button class="btn mint" id="give" type="button">Раздать классу</button><a href="/play/${previewId}" target="_blank" rel="noopener">Открыть на проектор</a><span class="note">Не понравилось — соберите ещё раз.</span></div>`;
    $('#give').onclick = async () => { await api('/api/teacher/shared/set', { gameId: previewId }); await load(); renderLive(); $('#give').textContent = 'Раздано'; $('#give').disabled = true; };
  } catch (e) { $('#sharedBox').innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  $('#genShared').disabled = false;
}

async function showStudent(id) {
  openStudent = id;
  const { student: s, spec } = await api('/api/teacher/student?id=' + encodeURIComponent(id));
  const A = s.answers || {};
  const pt = k => A[k] && A[k].values ? Object.entries(A[k].values).map(([q, v]) => `<div><b>${esc(q)}:</b> ${esc(v)}</div>`).join('') : '<p class="note">Нет ответов</p>';
  const rv = s.ai && s.ai.review;
  $('#drawerBox').innerHTML = `<aside class="drawer" aria-label="Ученик ${esc(s.name)}">
    <div class="row" style="justify-content:space-between"><h2>${esc(s.name)}</h2><button class="ghost" id="close" type="button">Закрыть</button></div>
    <div class="row"><span class="chip xp">${s.xp} XP</span>${s.achievements.map(a => `<span class="chip">${esc(a.title)}</span>`).join('')}</div>
    <h3>Игры</h3>${s.games.length ? s.games.map(g => `<div><a href="/play/${g.id}" target="_blank" rel="noopener">${esc(g.title || 'без названия')}</a> · версия ${g.version} · правок ${g.fixes}</div>`).join('') : '<p class="note">Пока нет</p>'}
    <h3>Плейтест общей игры</h3>${pt('pt1')}${s.ai && s.ai.fb_pt1 ? `<pre>${esc(s.ai.fb_pt1)}</pre>` : ''}
    <h3>Квиз</h3><p>${A.quiz1 && A.quiz1.done ? A.quiz1.score + ' из 5' : 'не пройден'}</p>
    <h3>Задание для Qwen</h3><pre>${esc(spec)}</pre>
    ${rv ? `<h3>Отзыв продюсера</h3><pre>${esc(rv.strong || '')}\n\n${(rv.issues || []).map(i => '— ' + i).join('\n')}</pre>` : ''}
    <h3>Плейтест своей игры</h3>${pt('pt2')}${s.ai && s.ai.fb_pt2 ? `<pre>${esc(s.ai.fb_pt2)}</pre>` : ''}
    <h3>Журнал</h3><p>${esc((A.arcade || {}).discovery || '—')}</p><p class="note">Версия 2: ${esc((A.arcade || {}).v2 || '—')}</p>
    <div class="row"><button class="ghost" id="rst" type="button">Вернуть на начало урока</button></div>
  </aside>`;
  $('#close').onclick = () => { $('#drawerBox').innerHTML = ''; openStudent = null; };
  $('#rst').onclick = async () => { await api('/api/teacher/reset-student', { id }); $('#drawerBox').innerHTML = ''; };
}

if (KEY) load().then(() => { renderAll(); startPoll(); }).catch(() => {}); else login();
