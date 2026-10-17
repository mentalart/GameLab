#!/usr/bin/env node
// Портал «Лаборатория игр». Запуск: node portal/server.js  →  http://localhost:8080/
// Без зависимостей, Node.js 18+. Ключ ИИ и пароль учителя — в portal/config.json (создаётся при первом запуске).
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const store = require('./lib/store');
const ai = require('./lib/ai');

const PORTAL = __dirname;
const PUBLIC = path.join(PORTAL, 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.ico': 'image/x-icon',
};

/* ---------------- уроки ---------------- */
function lessons() {
  return fs.readdirSync(path.join(PORTAL, 'lessons')).filter(f => /^urok-\d+\.js$/.test(f)).sort().map(f => {
    delete require.cache[require.resolve('./lessons/' + f)];
    return require('./lessons/' + f);
  });
}
function lesson(id) { return lessons().find(l => l.id === id) || null; }
function stepOf(les, stepId) { for (const cp of les.checkpoints) for (const s of cp.steps) if (s.id === stepId) return { cp, step: s }; return null; }

/* ---------------- задания ИИ (идут долго, клиент опрашивает) ---------------- */
const jobs = new Map();
function startJob(owner, kind, fn) {
  const job = { id: store.id(12), owner, kind, state: 'running', started: Date.now(), chars: 0, phase: '', result: null, error: null };
  jobs.set(job.id, job);
  Promise.resolve().then(() => fn((chars, phase) => { job.chars = chars; if (phase) job.phase = phase; }))
    .then(r => { job.state = 'done'; job.result = r; }, e => { job.state = 'error'; job.error = e.message; })
    .finally(() => { job.ended = Date.now(); setTimeout(() => jobs.delete(job.id), 3600e3); });
  return job;
}

/* ---------------- живые обновления (SSE) ---------------- */
const listeners = new Map(); // код класса → Set(res)
function broadcast(code, event, data) {
  for (const res of listeners.get(code) || []) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
setInterval(() => { for (const set of listeners.values()) for (const res of set) res.write(': пульс\n\n'); }, 25000).unref();

/* ---------------- замысел ученика ---------------- */
const fieldText = f => (f && typeof f === 'object' ? f.text : f) || '';
function buildPlan(les, st) {
  const A = id => (st.answers[id] || {}).value || {};
  const P = les.plan;
  const fac = A(P.factory), facFields = fac.fields || {};
  const facStep = stepOf(les, P.factory).step;
  const level = (facStep.levels || []).find(l => l.id === fac.level) || (facStep.levels || [])[0] || { label: 'Базовый', hint: '' };
  const details = facStep.fields.filter(f => !['title', 'twist', 'world'].includes(f.id) && fieldText(facFields[f.id]))
    .map(f => `${f.label}: ${fieldText(facFields[f.id])}`);
  const dec = (A(P.decisions).fields) || {}, igra = (A(P.igra).fields) || {};
  const prod = A(P.producer);
  const forks = ((prod.result && prod.result.forks) || []).map((f, i) => ({ question: f.question, answer: (prod.choices || {})[i] })).filter(f => f.answer);
  const all = [facFields, dec, igra].flatMap(o => Object.values(o));
  return {
    title: fieldText(facFields.title) || 'Моя игра',
    donor: `${les.donor} — ${facStep.donorCard ? facStep.donorCard.text : ''}`,
    twist: fieldText(facFields.twist), world: fieldText(facFields.world),
    level: `${level.label} (${level.hint})`, details,
    decisions: { feeling: fieldText(dec.feeling), honesty: fieldText(dec.honesty), choice: fieldText(dec.choice) },
    igra: { i: fieldText(igra.i), g: fieldText(igra.g), r: fieldText(igra.r), a: fieldText(igra.a) },
    forks,
    diceCount: all.filter(f => f && f.dice).length,
    fieldCount: all.filter(f => fieldText(f)).length,
  };
}

/* ---------------- HTTP ---------------- */
function send(res, code, body, type = 'application/json; charset=utf-8', extra = {}) {
  res.writeHead(code, Object.assign({ 'Content-Type': type, 'Cache-Control': 'no-store' }, extra));
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
const fail = (res, code, msg) => send(res, code, { error: msg });
function readBody(req, limit = 3e6) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('Слишком большой запрос')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(new Error('Запрос не в JSON')); } });
    req.on('error', reject);
  });
}
function serveFile(res, file, extraHeaders = {}) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Не найдено', 'text/plain; charset=utf-8');
    res.writeHead(200, Object.assign({ 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' }, extraHeaders));
    fs.createReadStream(file).pipe(res);
  });
}
function staticUnder(root, rel, res, extra) {
  const file = path.resolve(root, '.' + rel);
  if (!file.startsWith(root + path.sep)) return send(res, 403, 'Нельзя', 'text/plain; charset=utf-8');
  serveFile(res, file, extra);
}
// игры работают в рамке без своего происхождения (sandbox без allow-same-origin): им нужен CORS для wasm
const CORS = { 'Access-Control-Allow-Origin': '*' };

function playPage(res, gameId, n) {
  const g = store.getGame(gameId);
  const code = g && store.versionCode(gameId, n || g.current);
  if (!code) return send(res, 404, 'Нет такой версии игры', 'text/plain; charset=utf-8');
  const html = fs.readFileSync(path.join(PORTAL, 'engine', 'game.html'), 'utf8')
    .replace('<head>', '<head>\n<base href="/engine/">')
    .replace('<!--GAME-->', '<script>\n' + code.replace(/<\/script/gi, '<\\/script') + '\n</script>');
  // CSP sandbox: даже открытая отдельной вкладкой игра не видит данных портала (своё «пустое» происхождение)
  send(res, 200, html, 'text/html; charset=utf-8', Object.assign({ 'Content-Security-Policy': 'sandbox allow-scripts allow-pointer-lock' }, CORS));
}
// решения программиста из поля notes текущей версии — для шага «Найди, где ИИ своевольничал»
function gameNotes(code) {
  const m = /\bnotes\s*:\s*\[([\s\S]*?)\]/.exec(code || '');
  if (!m) return [];
  return [...m[1].matchAll(/(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g)].map(x => x[2].replace(/\\(['"`\\])/g, '$1'));
}

function who(req, url) {
  const token = req.headers['x-lab-token'] || url.searchParams.get('token');
  const s = store.session(token);
  return s ? Object.assign({ token }, s) : null;
}

/* ---------------- API ---------------- */
const routes = {};
const route = (method, p, fn) => { routes[method + ' ' + p] = fn; };

route('GET', '/api/info', () => ({ demo: ai.demo(), models: ai.models(), lessons: lessons().map(l => ({ id: l.id, number: l.number, title: l.title, donor: l.donor })) }));

route('POST', '/api/login', (ctx) => {
  const b = ctx.body;
  if (b.role === 'teacher') {
    if (!b.password || b.password !== ai.loadConfig().teacherPassword) throw Object.assign(new Error('Неверный пароль учителя'), { status: 403 });
    return { token: store.createSession({ role: 'teacher' }), role: 'teacher' };
  }
  const code = String(b.code || '').trim().toUpperCase();
  const nick = String(b.nick || '').trim().replace(/\s+/g, ' ');
  const cls = store.getClass(code);
  if (!cls) throw Object.assign(new Error('Нет класса с таким кодом. Спроси код у учителя.'), { status: 404 });
  if (!/^[\p{L}\p{N} _.-]{2,20}$/u.test(nick)) throw Object.assign(new Error('Ник — от 2 до 20 букв и цифр, без фамилии'), { status: 400 });
  store.ensureStudent(code, nick);
  return { token: store.createSession({ role: 'student', class: code, nick }), role: 'student' };
});

function needStudent(ctx) {
  const w = ctx.who;
  if (!w || w.role !== 'student') throw Object.assign(new Error('Войди по коду класса'), { status: 401 });
  const cls = store.getClass(w.class);
  if (!cls) throw Object.assign(new Error('Класс удалён'), { status: 401 });
  const les = lesson(cls.lesson);
  const s = store.ensureStudent(w.class, w.nick);
  const st = store.lessonState(s, les.id);
  return { w, cls, les, s, st };
}
function needTeacher(ctx) { if (!ctx.who || ctx.who.role !== 'teacher') throw Object.assign(new Error('Нужен вход учителя'), { status: 401 }); }

route('GET', '/api/me', (ctx) => {
  const { w, cls, les, s, st } = needStudent(ctx);
  s.seen = store.now(); store.saveStudent(w.class, s);
  const g = st.gameId ? store.getGame(st.gameId) : null;
  return { nick: w.nick, class: { code: cls.code, name: cls.name, opened: cls.opened, authorMode: cls.authorMode }, lesson: les, answers: st.answers, game: g, feedback: st.feedback || null, demo: ai.demo(), aiCalls: st.aiCalls, aiLimit: ai.loadConfig().limits.aiCallsPerStudentPerLesson };
});

route('POST', '/api/answer', (ctx) => {
  const { w, les, s, st } = needStudent(ctx);
  const { step, value, done } = ctx.body;
  if (!stepOf(les, step)) throw Object.assign(new Error('Нет такого шага'), { status: 400 });
  const prev = st.answers[step] || {};
  st.answers[step] = { value: value === undefined ? prev.value : value, done: done === undefined ? !!prev.done : !!done, at: store.now() };
  s.where = step; s.seen = store.now();
  store.saveStudent(w.class, s);
  return { ok: true };
});

route('POST', '/api/note', (ctx) => {
  const w = ctx.who;
  if (!w) throw Object.assign(new Error('Нужен вход'), { status: 401 });
  const text = String(ctx.body.text || '').trim().slice(0, 4000);
  if (!text) throw Object.assign(new Error('Пустая заметка'), { status: 400 });
  store.addNote({ who: w.role === 'teacher' ? 'учитель' : w.nick, class: w.class || null, lesson: ctx.body.lesson || null, checkpoint: ctx.body.checkpoint || null, step: ctx.body.step || null, text });
  return { ok: true };
});

// рекорды: ключ игры в пределах класса. Партия в игре ученика (ключ game:<id>) ещё и пишет телеметрию для плейтеста автора,
// партия по вызову (challenge) попадает и в таблицу вызова.
route('POST', '/api/score', (ctx) => {
  const { w } = needStudent(ctx);
  const key = String(ctx.body.game).slice(0, 80);
  const score = Math.round(Number(ctx.body.score) || 0);
  const all = store.addScore(w.class + ':' + key, w.nick, score);
  const out = records(all, w.nick);
  const g = classGame(w, (/^game:([\w-]+)$/.exec(key) || [])[1]);
  if (g) {
    out.authorBest = all[g.nick] ? all[g.nick].score : 0;
    store.addPlay(g.id, { type: 'over', nick: w.nick, version: Number(ctx.body.version) || g.current, score, seed: seedOf(ctx.body.seed), tele: cleanTele(ctx.body.tele) });
    if (w.nick !== g.nick) broadcast(w.class, 'arcade', { game: g.id, author: g.nick });
  }
  const ch = ctx.body.challenge && store.getChallenge(w.class, ctx.body.challenge);
  if (ch) out.challenge = records(store.addScore(w.class + ':challenge:' + ch.code, w.nick, score), w.nick);
  return out;
});
route('GET', '/api/records', (ctx) => {
  const { w } = needStudent(ctx);
  const out = records(store.scores(w.class + ':' + String(ctx.url.searchParams.get('game')).slice(0, 80)), w.nick);
  const ch = store.getChallenge(w.class, ctx.url.searchParams.get('challenge'));
  if (ch) out.challenge = records(store.scores(w.class + ':challenge:' + ch.code), w.nick);
  return out;
});
function records(all, nick) {
  const list = Object.entries(all).map(([n, v]) => ({ nick: n, score: v.score })).sort((a, b) => b.score - a.score);
  return { record: list[0] || null, mine: all[nick] ? all[nick].score : 0, top: list.slice(0, 10) };
}

/* ---------- аркада класса, вызовы, плейтест (срез 2) ---------- */
const BTN_NAMES = { left: '← влево', right: '→ вправо', up: '↑ вверх', down: '↓ вниз', a: 'A — главная кнопка', b: 'B — вторая кнопка' };
const seedOf = v => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v) >>> 0);
function cleanTele(t) {
  t = t && typeof t === 'object' ? t : {};
  const nums = (o, keys) => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([k, v]) => (!keys || keys.includes(k)) && Number.isFinite(Number(v))).slice(0, 12).map(([k, v]) => [String(k).slice(0, 40), Math.round(Number(v) * 10) / 10]));
  const btn = Object.keys(BTN_NAMES);
  return { time: Math.max(0, Math.round((Number(t.time) || 0) * 10) / 10), hold: nums(t.hold, btn), presses: nums(t.presses, btn), custom: nums(t.custom) };
}
function classGame(w, id) { const g = id && store.getGame(id); return g && g.class === w.class && g.current ? g : null; }
// все собранные игры класса: по одной на ученика и урок
function classGames(code) {
  const out = [];
  for (const s of store.students(code)) for (const st of Object.values(s.lessons || {})) {
    const g = st.gameId && store.getGame(st.gameId);
    if (g && g.current) out.push(g);
  }
  return out;
}
// карточка игры в аркаде: название, автор, донор, «Что решил я», версия, рекорд класса, рекорд автора
function gameCard(code, g, viewer) {
  const les = lesson(g.lesson);
  let dec = g.decisions;
  if (!dec && les) { const s = store.getStudent(code, g.nick); dec = s ? buildPlan(les, store.lessonState(s, les.id)).decisions : {}; }
  const all = store.scores(code + ':game:' + g.id), rec = records(all, viewer);
  return {
    id: g.id, title: g.title || 'Моя игра', nick: g.nick, donor: g.donor || (les ? les.donor : ''),
    lesson: les ? { id: les.id, number: les.number, title: les.title } : null,
    decisions: dec || {}, version: g.current, versions: g.versions.length,
    record: rec.record, top: rec.top.slice(0, 5), authorBest: all[g.nick] ? all[g.nick].score : 0, myBest: rec.mine,
    plays: store.plays(g.id).filter(p => p.type === 'over' && p.nick !== g.nick).length,
    hidden: !!g.hidden, mine: g.nick === viewer,
  };
}
// игра соседа по кругу: следующий по алфавиту автор после after (по умолчанию — после меня); игры этого урока — первыми
function neighbour(cards, me, after, lessonId) {
  const pool = cards.filter(c => !c.hidden && c.nick !== me);
  const same = pool.filter(c => c.lesson && c.lesson.id === lessonId);
  const list = (same.length ? same : pool).sort((a, b) => a.nick.localeCompare(b.nick, 'ru'));
  return list.find(c => c.nick.localeCompare(after || me, 'ru') > 0) || list[0] || null;
}
// «открытие плейтеста» для автора: только партии чужих игроков
function discovery(g) {
  const plays = store.plays(g.id).filter(p => p.nick !== g.nick);
  const overs = plays.filter(p => p.type === 'over');
  const hold = {}, presses = {}, custom = {};
  let time = 0;
  const add = (to, o) => { for (const [k, v] of Object.entries(o || {})) to[k] = (to[k] || 0) + (Number(v) || 0); };
  for (const p of overs) { const t = p.tele || {}; time += Number(t.time) || 0; add(hold, t.hold); add(presses, t.presses); add(custom, t.custom); }
  const holds = Object.entries(hold).filter(([k, v]) => BTN_NAMES[k] && v > 0)
    .map(([k, v]) => ({ key: k, name: BTN_NAMES[k], share: time ? Math.min(1, Math.round(100 * v / time) / 100) : 0 })).sort((a, b) => b.share - a.share);
  const last = {};
  for (const p of plays) if (p.type === 'card') last[p.nick] = Object.assign({ nick: p.nick, at: p.at }, p.card);
  const cards = Object.values(last);
  const emotions = {};
  cards.forEach(c => (c.emotions || []).forEach(e => { emotions[e] = (emotions[e] || 0) + 1; }));
  return {
    rounds: overs.length, players: new Set(overs.map(p => p.nick)).size, again: plays.filter(p => p.type === 'again').length,
    time: Math.round(time), best: overs.reduce((n, p) => Math.max(n, p.score || 0), 0),
    holds, dominant: holds[0] || null,
    presses: { a: Math.round(presses.a || 0), b: Math.round(presses.b || 0) },
    custom: Object.entries(custom).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => ({ name: k, value: Math.round(v * 10) / 10 })),
    cards, emotions,
  };
}
const cleanField = f => ({ text: String((f && typeof f === 'object' ? f.text : f) || '').trim().slice(0, 400), dice: !!(f && f.dice) });

route('GET', '/api/arcade', (ctx) => {
  const { w, cls, les } = needStudent(ctx);
  const cards = classGames(w.class).map(g => gameCard(w.class, g, w.nick));
  const mine = cards.filter(c => c.mine).sort((a, b) => ((a.lesson || {}).number || 0) - ((b.lesson || {}).number || 0))
    .map(c => Object.assign(c, { discovery: discovery(store.getGame(c.id)) }));
  return {
    nick: w.nick, class: { code: cls.code, name: cls.name }, lesson: { id: les.id, number: les.number, title: les.title },
    games: cards.filter(c => !c.hidden), mine,
    neighbour: neighbour(cards, w.nick, ctx.url.searchParams.get('after'), les.id),
  };
});
route('POST', '/api/arcade/hide', (ctx) => {
  const { w } = needStudent(ctx);
  const g = classGame(w, ctx.body.game);
  if (!g || g.nick !== w.nick) throw Object.assign(new Error('Скрыть можно только свою игру'), { status: 403 });
  g.hidden = !!ctx.body.hidden; store.saveGame(g);
  broadcast(w.class, 'arcade', { game: g.id, author: g.nick });
  return { hidden: g.hidden };
});
route('POST', '/api/play/again', (ctx) => {
  const { w } = needStudent(ctx);
  const g = classGame(w, ctx.body.game);
  if (g) store.addPlay(g.id, { type: 'again', nick: w.nick });
  return { ok: true };
});
route('POST', '/api/challenge', (ctx) => {
  const { w } = needStudent(ctx);
  const g = classGame(w, ctx.body.game);
  const version = Number(ctx.body.version) || (g && g.current);
  const seed = seedOf(ctx.body.seed);
  if (!g || !g.versions[version - 1]) throw Object.assign(new Error('Нет такой игры'), { status: 404 });
  if (seed == null) throw Object.assign(new Error('Нет зерна партии — сыграй партию до конца'), { status: 400 });
  const score = Math.round(Number(ctx.body.score) || 0);
  const ch = store.createChallenge(w.class, { game: g.id, version, seed, score, nick: w.nick, title: g.title });
  store.addScore(w.class + ':challenge:' + ch.code, w.nick, score);
  return { code: ch.code, url: '/arcade?ch=' + ch.code, seed, version };
});
route('GET', '/api/challenge', (ctx) => {
  const { w } = needStudent(ctx);
  const ch = store.getChallenge(w.class, ctx.url.searchParams.get('code'));
  const g = ch && classGame(w, ch.game);
  if (!g) throw Object.assign(new Error('Нет такого вызова в твоём классе. Проверь код.'), { status: 404 });
  return { challenge: ch, game: gameCard(w.class, g, w.nick), records: records(store.scores(w.class + ':challenge:' + ch.code), w.nick) };
});
route('POST', '/api/playtest', (ctx) => {
  const { w } = needStudent(ctx);
  const g = classGame(w, ctx.body.game);
  if (!g) throw Object.assign(new Error('Нет такой игры'), { status: 404 });
  if (g.nick === w.nick) throw Object.assign(new Error('Плейтест пишут на чужую игру'), { status: 400 });
  const c = ctx.body.card || {};
  const card = { emotions: (Array.isArray(c.emotions) ? c.emotions : []).slice(0, 6).map(e => String(e).slice(0, 40)), like: cleanField(c.like), want: cleanField(c.want), whatif: cleanField(c.whatif) };
  store.addPlay(g.id, { type: 'card', nick: w.nick, card });
  broadcast(w.class, 'arcade', { game: g.id, author: g.nick });
  return { ok: true };
});
// моя игра урока глазами класса: открытие плейтеста и отзыв учителя
route('GET', '/api/playtest/mine', (ctx) => {
  const { w, st } = needStudent(ctx);
  const g = st.gameId && store.getGame(st.gameId);
  return { game: g && g.current ? gameCard(w.class, g, w.nick) : null, discovery: g && g.current ? discovery(g) : null, feedback: st.feedback || null };
});

/* ---------- ИИ ---------- */
function aiGuard(ctx) {
  const c = needStudent(ctx);
  const lim = ai.loadConfig().limits;
  if (c.st.aiCalls >= lim.aiCallsPerStudentPerLesson) throw Object.assign(new Error(`Лимит запросов к ИИ на урок исчерпан (${lim.aiCallsPerStudentPerLesson}). Попроси учителя.`), { status: 429 });
  if (lim.rublesPerLesson > 0) {
    const spent = store.genlog().filter(e => e.class === c.w.class && e.lesson === c.les.id).reduce((n, e) => n + (e.rub || 0), 0);
    if (spent >= lim.rublesPerLesson) throw Object.assign(new Error(`Потолок расходов урока достигнут (${lim.rublesPerLesson} ₽)`), { status: 429 });
  }
  c.st.aiCalls++; store.saveStudent(c.w.class, c.s);
  c.whoAI = { class: c.w.class, nick: c.w.nick, lesson: c.les.id };
  return c;
}
function saveStudentField(code, nick, lessonId, fn) {
  const s = store.ensureStudent(code, nick); const st = store.lessonState(s, lessonId); fn(st); store.saveStudent(code, s);
}

route('POST', '/api/ai/producer', (ctx) => {
  const c = aiGuard(ctx);
  const plan = buildPlan(c.les, c.st);
  const job = startJob(c.w.token, 'producer', async () => {
    const result = await ai.producer(plan, c.les, c.whoAI);
    saveStudentField(c.w.class, c.w.nick, c.les.id, st => { st.answers[c.les.plan.producer] = { value: { result, choices: {} }, done: false, at: store.now() }; });
    return result;
  });
  return { job: job.id };
});

function ensureGame(c) {
  let g = c.st.gameId ? store.getGame(c.st.gameId) : null;
  if (!g) {
    g = store.createGame({ class: c.w.class, nick: c.w.nick, lesson: c.les.id });
    saveStudentField(c.w.class, c.w.nick, c.les.id, st => { st.gameId = g.id; });
  }
  return g;
}
function addVersion(gameId, r, info) {
  const g = store.getGame(gameId);
  const n = store.addVersion(g, r.code, Object.assign({ model: r.model, attempts: r.attempts, warnings: r.warnings, demo: !!r.demo }, info));
  broadcast(g.class, 'arcade', { game: gameId, author: g.nick }); // новая версия — сразу в аркаде класса
  return { gameId, version: n, game: store.getGame(gameId) };
}

route('POST', '/api/ai/build', (ctx) => {
  const c = aiGuard(ctx);
  const plan = buildPlan(c.les, c.st);
  if (!plan.igra.i && !plan.igra.r) throw Object.assign(new Error('Сначала заполни промпт ИГРА'), { status: 400 });
  const g = ensureGame(c);
  const job = startJob(c.w.token, 'build', async (progress) => {
    const r = await ai.build(plan, c.whoAI, progress);
    // название, донор и три решения — подпись игры в аркаде класса
    const g2 = store.getGame(g.id); g2.title = plan.title; g2.donor = c.les.donor; g2.decisions = plan.decisions; store.saveGame(g2);
    return addVersion(g.id, r, { kind: 'сборка' });
  });
  return { job: job.id };
});

route('POST', '/api/ai/change', (ctx) => {
  const c = aiGuard(ctx);
  const request = String(ctx.body.request || '').trim().slice(0, 1000);
  if (!request) throw Object.assign(new Error('Напиши одну просьбу'), { status: 400 });
  const g = c.st.gameId && store.getGame(c.st.gameId);
  if (!g || !g.current) throw Object.assign(new Error('Сначала собери игру'), { status: 400 });
  const base = g.current, code = store.versionCode(g.id, base);
  const job = startJob(c.w.token, 'change', async (progress) => addVersion(g.id, await ai.change(code, request, c.whoAI, progress), { kind: 'правка', request, from: base }));
  return { job: job.id };
});

route('POST', '/api/ai/fix', (ctx) => {
  const c = aiGuard(ctx);
  const g = c.st.gameId && store.getGame(c.st.gameId);
  const n = Number(ctx.body.version);
  const code = g && store.versionCode(g.id, n);
  if (!code) throw Object.assign(new Error('Нет такой версии'), { status: 400 });
  const err = ctx.body.error || {};
  const v = g.versions[n - 1]; v.error = { phase: err.phase, message: String(err.message || '').slice(0, 500), line: err.line || null }; store.saveGame(g);
  const job = startJob(c.w.token, 'fix', async (progress) => addVersion(g.id, await ai.fix(code, err, c.whoAI, progress), { kind: 'починка', from: n, fixes: v.error.message }));
  return { job: job.id };
});

route('POST', '/api/game/error', (ctx) => { // ошибка без автопочинки (лимит попыток) — для панели учителя
  const c = needStudent(ctx);
  const g = c.st.gameId && store.getGame(c.st.gameId);
  const v = g && g.versions[Number(ctx.body.version) - 1];
  if (v) { v.error = Object.assign({ message: String((ctx.body.error || {}).message || '').slice(0, 500) }, ctx.body.error || {}); store.saveGame(g); }
  return { ok: true };
});

route('GET', '/api/game/notes', (ctx) => {
  const c = needStudent(ctx);
  const g = c.st.gameId && store.getGame(c.st.gameId);
  return { notes: g && g.current ? gameNotes(store.versionCode(g.id, g.current)) : [] };
});

route('POST', '/api/game/current', (ctx) => {
  const c = needStudent(ctx);
  const g = c.st.gameId && store.getGame(c.st.gameId);
  const n = Number(ctx.body.version);
  if (!g || !g.versions[n - 1]) throw Object.assign(new Error('Нет такой версии'), { status: 400 });
  g.current = n; store.saveGame(g);
  return { game: g };
});

route('GET', '/api/job', (ctx) => {
  const job = jobs.get(ctx.url.searchParams.get('id'));
  if (!job || !ctx.who || job.owner !== ctx.who.token) throw Object.assign(new Error('Задание не найдено (сервер перезапускался?)'), { status: 404 });
  return { state: job.state, kind: job.kind, seconds: Math.round((Date.now() - job.started) / 1000), chars: job.chars, phase: job.phase, result: job.result, error: job.error };
});

/* ---------- учитель ---------- */
route('GET', '/api/teacher/classes', (ctx) => { needTeacher(ctx); return { classes: store.classes(), lessons: lessons().map(l => ({ id: l.id, number: l.number, title: l.title })) }; });
route('POST', '/api/teacher/class', (ctx) => {
  needTeacher(ctx);
  const les = lesson(ctx.body.lesson) || lessons()[0];
  return store.createClass({ name: String(ctx.body.name || '').slice(0, 60), lesson: les.id });
});
route('POST', '/api/teacher/class/update', (ctx) => {
  needTeacher(ctx);
  const cls = store.getClass(ctx.body.code);
  if (!cls) throw Object.assign(new Error('Нет класса'), { status: 404 });
  if (ctx.body.lesson && lesson(ctx.body.lesson) && ctx.body.lesson !== cls.lesson) { cls.lesson = ctx.body.lesson; cls.opened = []; }
  if (Array.isArray(ctx.body.opened)) cls.opened = ctx.body.opened.map(String);
  if (typeof ctx.body.authorMode === 'boolean') cls.authorMode = ctx.body.authorMode;
  store.saveClass(cls);
  broadcast(cls.code, 'class', { opened: cls.opened, lesson: cls.lesson, authorMode: cls.authorMode });
  return cls;
});
route('GET', '/api/teacher/overview', (ctx) => {
  needTeacher(ctx);
  const cls = store.getClass(ctx.url.searchParams.get('code'));
  if (!cls) throw Object.assign(new Error('Нет класса'), { status: 404 });
  const les = lesson(cls.lesson);
  const students = store.students(cls.code).map(s => {
    const st = (s.lessons || {})[les.id] || { answers: {}, aiCalls: 0 };
    const g = st.gameId ? store.getGame(st.gameId) : null;
    const plan = st.answers ? buildPlan(les, st) : null;
    const last = g && g.versions[g.current - 1];
    return {
      nick: s.nick, seen: s.seen, where: s.where || null,
      done: Object.values(st.answers || {}).filter(a => a.done).length,
      dice: plan ? plan.diceCount : 0, fields: plan ? plan.fieldCount : 0, aiCalls: st.aiCalls || 0,
      game: g ? { id: g.id, title: g.title, versions: g.versions.length, current: g.current, error: last && last.error ? last.error.message : null, model: last && last.model, hidden: !!g.hidden } : null,
      plays: g ? store.plays(g.id).filter(p => p.type === 'over' && p.nick !== g.nick).length : 0,
      feedback: !!st.feedback,
    };
  });
  return { class: cls, lesson: les, students };
});
route('GET', '/api/teacher/student', (ctx) => {
  needTeacher(ctx);
  const code = ctx.url.searchParams.get('code'), nick = ctx.url.searchParams.get('nick');
  const cls = store.getClass(code), s = cls && store.getStudent(code, nick);
  if (!s) throw Object.assign(new Error('Нет ученика'), { status: 404 });
  const les = lesson(cls.lesson), st = store.lessonState(s, les.id);
  const g = st.gameId ? store.getGame(st.gameId) : null;
  return { nick, answers: st.answers, plan: ai.planText(buildPlan(les, st)), game: g, discovery: g && g.current ? discovery(g) : null, feedback: st.feedback || null };
});
// отзыв учителя: одно понятие геймдизайна + один вопрос (с кубиком из колод урока)
route('POST', '/api/teacher/feedback', (ctx) => {
  needTeacher(ctx);
  const cls = store.getClass(ctx.body.code), s = cls && store.getStudent(cls.code, ctx.body.nick);
  if (!s) throw Object.assign(new Error('Нет ученика'), { status: 404 });
  const concept = cleanField(ctx.body.concept), question = cleanField(ctx.body.question);
  if (!concept.text || !question.text) throw Object.assign(new Error('Нужны понятие и вопрос'), { status: 400 });
  const st = store.lessonState(s, cls.lesson);
  st.feedback = { concept, question, at: store.now() };
  store.saveStudent(cls.code, s);
  broadcast(cls.code, 'feedback', { nick: s.nick });
  return { feedback: st.feedback };
});
route('GET', '/api/teacher/arcade', (ctx) => {
  needTeacher(ctx);
  const cls = store.getClass(ctx.url.searchParams.get('code'));
  if (!cls) throw Object.assign(new Error('Нет класса'), { status: 404 });
  return { games: classGames(cls.code).map(g => Object.assign(gameCard(cls.code, g, null), { discovery: discovery(g) })) };
});
route('GET', '/api/teacher/settings', (ctx) => {
  needTeacher(ctx);
  const c = ai.loadConfig();
  return { demo: ai.demo(), models: ai.models(), known: c.models, limits: c.limits, baseUrl: c.ai.baseUrl };
});
route('POST', '/api/teacher/settings', (ctx) => {
  needTeacher(ctx);
  const patch = {};
  if (typeof ctx.body.codeModel === 'string') patch.codeModel = ctx.body.codeModel.trim();
  if (typeof ctx.body.textModel === 'string') patch.textModel = ctx.body.textModel.trim();
  store.saveSettings(patch);
  return { models: ai.models() };
});
route('GET', '/api/teacher/models', async (ctx) => { needTeacher(ctx); return { ids: await ai.listModels() }; });
route('GET', '/api/teacher/notes', (ctx) => { needTeacher(ctx); return { notes: store.notes().reverse() }; });
route('GET', '/api/teacher/genlog', (ctx) => {
  needTeacher(ctx);
  const all = store.genlog();
  const real = all.filter(e => !e.demo);
  const sum = (arr, k) => arr.reduce((n, e) => n + (e[k] || 0), 0);
  const byModel = {};
  for (const e of real) {
    const m = byModel[e.model] = byModel[e.model] || { model: e.model, calls: 0, ok: 0, ms: 0, rub: 0, tokensIn: 0, tokensOut: 0 };
    m.calls++; if (e.ok) m.ok++; m.ms += e.ms || 0; m.rub += e.rub || 0; m.tokensIn += e.tokensIn || 0; m.tokensOut += e.tokensOut || 0;
  }
  return { total: { calls: real.length, rub: Math.round(sum(real, 'rub') * 100) / 100, demo: all.length - real.length }, byModel: Object.values(byModel), last: all.slice(-40).reverse() };
});

/* ---------------- сервер ---------------- */
async function handle(req, res) {
  let url;
  try { url = new URL(req.url, 'http://x'); } catch (e) { return fail(res, 400, 'Плохой адрес'); }
  const p = decodeURIComponent(url.pathname);

  if (p.startsWith('/api/')) {
    if (p === '/api/events') return events(req, res, url);
    const fn = routes[req.method + ' ' + p];
    if (!fn) return fail(res, 404, 'Нет такого запроса');
    try {
      const ctx = { req, url, who: who(req, url), body: req.method === 'POST' ? await readBody(req) : {} };
      return send(res, 200, await fn(ctx));
    } catch (e) {
      if (!e.status) console.error(e);
      return fail(res, e.status || 500, e.message);
    }
  }
  const m = /^\/play\/([\w-]+)\/(\d+)$/.exec(p);
  if (m) { // ?seed= — вызов «побей мой мир»: оболочка читает зерно из адреса и строит тот же мир
    const seed = url.searchParams.get('seed');
    if (seed != null && !/^\d{1,10}$/.test(seed)) return send(res, 400, 'Зерно — число', 'text/plain; charset=utf-8');
    return playPage(res, m[1], Number(m[2]));
  }
  if (p.startsWith('/engine/') || p.startsWith('/games/')) return staticUnder(PORTAL, p, res, CORS);
  if (p === '/' ) return serveFile(res, path.join(PUBLIC, 'index.html'));
  if (p === '/student' || p === '/teacher' || p === '/arcade') return serveFile(res, path.join(PUBLIC, p.slice(1) + '.html'));
  return staticUnder(PUBLIC, p, res);
}

function events(req, res, url) {
  const w = who(req, url);
  const code = w && (w.class || url.searchParams.get('code'));
  if (!code || !store.getClass(code)) return fail(res, 401, 'Нужен вход');
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
  res.write('retry: 3000\n\n');
  if (!listeners.has(code)) listeners.set(code, new Set());
  listeners.get(code).add(res);
  req.on('close', () => listeners.get(code).delete(res));
}

function start(port, host = '0.0.0.0') {
  const srv = http.createServer((req, res) => { handle(req, res).catch(e => { console.error(e); try { fail(res, 500, e.message); } catch (_) { /* ответ уже ушёл */ } }); });
  srv.requestTimeout = 0;
  return new Promise((resolve, reject) => { srv.on('error', reject); srv.listen(port, host, () => resolve(srv)); });
}
module.exports = { start };

if (require.main === module) {
  const cfg = ai.loadConfig();
  const port = Number(process.argv[2]) || cfg.port || 8080;
  start(port).then(() => {
    const nets = Object.values(require('os').networkInterfaces()).flat().filter(n => n && n.family === 'IPv4' && !n.internal).map(n => n.address);
    console.log(`\nЛаборатория игр запущена: http://localhost:${port}/`);
    if (nets.length) console.log(`Ученики в той же сети: ${nets.map(a => `http://${a}:${port}/`).join('  ')}`);
    console.log(`Учитель: http://localhost:${port}/teacher  (пароль — в portal/config.json)`);
    console.log(ai.demo() ? 'ИИ: демо-режим (ключ не задан в config.json)' : `ИИ: код — ${ai.models().code}, тексты — ${ai.models().text}`);
    console.log('Остановить: Ctrl + C\n');
  }).catch(e => { console.error('Не удалось запустить портал:', e.message); process.exit(1); });
}
