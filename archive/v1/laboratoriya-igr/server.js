// «Лаборатория игр» — локальный сервер урока. Запуск: node server.js
// Без внешних зависимостей, нужен Node.js 18 или новее.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const crypto = require('crypto');
const { GAME_SYSTEM, FIX_SYSTEM, REVIEW_SYSTEM, FEEDBACK_SYSTEM, BAD } = require('./prompts');

const ROOT = __dirname;
const LESSONS = { lesson1: require('./lessons/lesson1') };

/* ---------- настройки ---------- */
const CONFIG_PATH = path.join(ROOT, 'config.json');
if (!fs.existsSync(CONFIG_PATH)) {
  const ex = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.example.json'), 'utf8'));
  ex.teacherPassword = String(crypto.randomInt(100000, 999999));
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(ex, null, 2));
}
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const Q = Object.assign({ baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', codeModel: 'qwen3-coder-plus', chatModel: 'qwen-plus', maxConcurrent: 6, timeoutSec: 240 }, config.qwen || {});
const apiKey = process.env.DASHSCOPE_API_KEY || Q.apiKey || '';
const MOCK = !!config.demoMode || !apiKey;
const PORT = +(process.env.PORT || config.port || 8080);
const LIMITS = Object.assign({ generationsPerStudent: 12, fixesPerGame: 8 }, config.limits || {});

/* ---------- база в JSON-файле ---------- */
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
fs.mkdirSync(DATA_DIR, { recursive: true });
let db = { classCode: '', lessonId: 'lesson1', unlocked: 1, shared: { kind: 'file', file: 'sova-haker.html' }, students: {}, games: {}, usage: { calls: 0, promptTokens: 0, completionTokens: 0, errors: 0 } };
if (fs.existsSync(DB_PATH)) { try { db = Object.assign(db, JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))); } catch (e) { console.error('Не удалось прочитать data/db.json, начинаю с пустой базы:', e.message); } }
if (!db.classCode) db.classCode = String(config.classCode || crypto.randomInt(1000, 9999));
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = DB_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, DB_PATH);
  }, 300);
}
save();
const id = (n = 10) => crypto.randomBytes(n).toString('base64url').slice(0, n);
const lesson = () => LESSONS[db.lessonId];

/* ---------- очередь запросов к Qwen ---------- */
let running = 0; const waiters = [];
const acquire = () => new Promise(r => { if (running < Q.maxConcurrent) { running++; r(); } else waiters.push(r); });
const release = () => { const n = waiters.shift(); if (n) n(); else running--; };

const KEY_PROBLEM = /[^\x21-\x7E]/.test(apiKey) ? 'В поле apiKey в config.json не ключ, а текст с русскими буквами или пробелами. Вставьте настоящий ключ из личного кабинета (латиница и цифры, без кавычек внутри) и перезапустите сервер.' : '';
if (KEY_PROBLEM && !MOCK) console.error('\n  ВНИМАНИЕ: ' + KEY_PROBLEM + '\n');

async function qwen(model, messages, { maxTokens = 4000, temperature = 0.7 } = {}) {
  if (KEY_PROBLEM) throw new Error(KEY_PROBLEM);
  await acquire();
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), Q.timeoutSec * 1000);
    let r;
    try {
      r = await fetch(Q.baseUrl.replace(/\/$/, '') + '/chat/completions', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
      });
    } finally { clearTimeout(to); }
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error(`Qwen ответил ${r.status}: ${(j && ((j.error && j.error.message) || j.message)) || r.statusText}`);
    db.usage.calls++;
    if (j.usage) { db.usage.promptTokens += j.usage.prompt_tokens || 0; db.usage.completionTokens += j.usage.completion_tokens || 0; }
    save();
    const text = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (!text) throw new Error('Qwen вернул пустой ответ');
    return text;
  } catch (e) {
    db.usage.errors++; save();
    if (e.name === 'AbortError') throw new Error('Qwen не ответил вовремя. Попробуй ещё раз.');
    if (/fetch failed|ENOTFOUND|ECONNREFUSED|ECONNRESET/i.test(e.message + (e.cause ? e.cause.code : ''))) throw new Error('Нет связи с Qwen. Проверьте интернет на компьютере учителя и адрес baseUrl в config.json.');
    throw e;
  } finally { release(); }
}

/* ---------- фоновые задачи (ИИ отвечает долго, клиент опрашивает) ---------- */
const jobs = new Map();
function startJob(owner, kind, fn) {
  const jid = id(12);
  const job = { id: jid, owner, kind, status: 'running', started: Date.now() };
  jobs.set(jid, job);
  Promise.resolve().then(fn).then(res => { job.status = 'done'; job.result = res; }, err => { job.status = 'error'; job.error = err.message || String(err); console.error(`[${kind}]`, job.error); });
  setTimeout(() => jobs.delete(jid), 30 * 60 * 1000);
  return jid;
}

/* ---------- работа с кодом игры ---------- */
function extractCode(text) {
  const blocks = [...String(text).matchAll(/```(?:js|javascript)?\s*\n([\s\S]*?)```/gi)].map(m => m[1]);
  let code = blocks.sort((a, b) => b.length - a.length)[0] || String(text);
  code = code.trim();
  return code;
}
function checkCode(code) {
  if (!/\bGAME\s*=/.test(code)) return 'В коде нет объекта GAME';
  try { new vm.Script(code + '\n;GAME;'); } catch (e) { return 'Синтаксическая ошибка: ' + e.message; }
  return null;
}
async function writeGame(system, user) {
  if (MOCK) { await sleep(1500); return fs.readFileSync(path.join(ROOT, 'games', 'mock-game.js'), 'utf8'); }
  const messages = [{ role: 'system', content: system }, { role: 'user', content: user }];
  let text = await qwen(Q.codeModel, messages, { maxTokens: 8000, temperature: 0.4 });
  let code = extractCode(text), err = checkCode(code);
  if (err) {
    messages.push({ role: 'assistant', content: text }, { role: 'user', content: `В коде ошибка: ${err}. Верни полный исправленный код одним блоком \`\`\`js.` });
    text = await qwen(Q.codeModel, messages, { maxTokens: 8000, temperature: 0.2 });
    code = extractCode(text); err = checkCode(code);
    if (err) throw new Error('Qwen дважды прислал код с ошибкой. Попробуй переформулировать замысел. ' + err);
  }
  return code;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
function parseJson(text) {
  const s = String(text), a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('Продюсер ответил не в том формате. Попробуй ещё раз.');
  return JSON.parse(s.slice(a, b + 1));
}

/* ---------- сборка страницы игры ---------- */
const TEMPLATE = () => fs.readFileSync(path.join(ROOT, 'engine', 'template.html'), 'utf8');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function gameHtml(game) {
  if (game.kind === 'file') return fs.readFileSync(path.join(ROOT, 'games', game.file), 'utf8');
  let code = game.code.replace(/<\/script/gi, '<\\/script');
  const extra = [];
  if (game.author) extra.push(`GAME.author = ${JSON.stringify(game.author)};`);
  if (game.title) extra.push(`GAME.title = ${JSON.stringify(game.title)};`);
  if (extra.length) code += `\n;try { ${extra.join(' ')} } catch (e) {}`;
  return TEMPLATE().replace('__TITLE__', esc(game.title || 'Игра')).replace('/*__GAME_CODE__*/', () => code);
}
const GAME_CSP = "sandbox allow-scripts allow-pointer-lock; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data: blob:; media-src data: blob:";

/* ---------- ученики ---------- */
function studentPublic(s) {
  const own = (s.games || []).map(gid => db.games[gid]).filter(Boolean);
  return { id: s.id, name: s.name, step: s.step || 0, answers: s.answers || {}, ai: s.ai || {}, games: own.map(gamePublic), xp: xpOf(s), achievements: achievementsOf(s) };
}
function gamePublic(g) { return { id: g.id, title: g.title, version: g.version, decisions: g.decisions || [], created: g.created, telemetry: g.telemetry || null, fixes: g.fixes || 0 }; }
function xpOf(s) {
  const own = (s.games || []).map(g => db.games[g]).filter(Boolean);
  const a = s.answers || {};
  const playtests = ['pt1', 'pt2'].filter(k => a[k] && a[k].submitted).length;
  return own.length * 10 + own.reduce((n, g) => n + Math.min(3, g.fixes || 0) * 15, 0) + playtests * 5 + (a.quiz1 && a.quiz1.score === 5 ? 10 : 0);
}
function achievementsOf(s) {
  const a = s.answers || {}, own = (s.games || []).map(g => db.games[g]).filter(Boolean), out = [];
  if (own.length) out.push({ id: 'first', icon: '01', title: 'Первая игра', text: 'Своя игра в аркаде на первом занятии.' });
  if (a.quiz1 && a.quiz1.score === 5) out.push({ id: 'eye', icon: '5/5', title: 'Глаз дизайнера', text: 'Без ошибок отличил решения дизайнера от решений программиста и художника.' });
  if (s.ai && s.ai.review) out.push({ id: 'producer', icon: 'P', title: 'Прошёл продюсера', text: 'Замысел прочитан до программиста, развилки решены.' });
  if (own.some(g => (g.fixes || 0) > 0)) out.push({ id: 'fixer', icon: 'v2', title: 'Вторая версия', text: 'Поправил свою игру после того, как сыграл в неё.' });
  if (a.pt1 && a.pt1.submitted && a.pt2 && a.pt2.submitted) out.push({ id: 'tester', icon: 'PT', title: 'Плейтестер', text: 'Провёл два плейтеста и записал наблюдения.' });
  return out;
}
function textOf(obj) { return JSON.stringify(obj || {}); }
function blocked(...parts) { return parts.some(p => BAD.test(textOf(p))); }

/* ---------- HTTP ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
function send(res, code, body, headers = {}) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(code, Object.assign({ 'Content-Type': isObj ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }, headers));
  res.end(isObj ? JSON.stringify(body) : body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > 3e6) { reject(new Error('Слишком большой запрос')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { if (!chunks.length) return resolve({}); try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { reject(new Error('Неверный JSON')); } });
    req.on('error', reject);
  });
}
function serveStatic(res, rel) {
  const base = path.join(ROOT, 'public');
  const file = path.normalize(path.join(base, rel));
  if (!file.startsWith(base) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, 'Не найдено');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}
function studentByToken(req) {
  const t = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return t ? Object.values(db.students).find(s => s.token === t) : null;
}
const isTeacher = req => (req.headers['x-teacher-key'] || '') === String(config.teacherPassword);

/* ---------- сборка задания для генерации ---------- */
function specText(s) {
  const a = s.answers || {}, f = (a.igra || {}).form || {}, r = s.ai && s.ai.review, picks = (a.producer || {}).picks || {};
  const dec = (a.producer && a.producer.decisions) || (r && r.decisions) || {};
  const lines = [
    `Уровень: ${f.level || 'Базовый'}${f.card ? ` (карта идеи: ${f.card})` : ''}.`,
    'Три решения автора:',
    `1) Чувство: ${dec.feel || f.d1 || ''}`,
    `2) Честность: ${dec.fair || f.d2 || ''}`,
    `3) Выбор: ${dec.choice || f.d3 || ''}`,
    '', 'Промпт по формуле «ИГРА»:',
    `И: ${f.pI || ''}`, `Г: ${f.pG || ''}`, `Р: ${f.pR || ''}`, `А: ${f.pA || ''}`,
  ];
  const forkLines = Object.entries(picks).filter(([, v]) => v).map(([q, v]) => `- ${q} → ${v}`);
  if (forkLines.length) lines.push('', 'Решения автора по вопросам продюсера (они важнее промпта, если противоречат ему):', ...forkLines);
  return lines.join('\n');
}

/* ---------- маршруты ---------- */
async function route(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  if (req.method === 'GET') {
    if (p === '/' || p === '/index.html') return serveStatic(res, 'index.html');
    if (p === '/teacher' || p === '/teacher/') return serveStatic(res, 'teacher.html');
    if (p.startsWith('/static/')) return serveStatic(res, p.slice(8));
    if (p.startsWith('/play/')) {
      const gid = decodeURIComponent(p.slice(6));
      const game = gid === 'shared' ? (db.shared.kind === 'file' ? db.shared : db.games[db.shared.gameId]) : db.games[gid];
      if (!game) return send(res, 404, 'Игра не найдена');
      return send(res, 200, gameHtml(game), { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': GAME_CSP });
    }
    if (p === '/api/lesson') return send(res, 200, lesson());
  }

  if (p === '/api/join' && req.method === 'POST') {
    const b = await readBody(req);
    const name = String(b.name || '').trim().slice(0, 40);
    if (String(b.classCode || '').trim() !== db.classCode) return send(res, 400, { error: 'Неверный код класса. Спроси его у учителя.' });
    if (name.length < 2) return send(res, 400, { error: 'Напиши имя хотя бы из двух букв.' });
    if (blocked(name)) return send(res, 400, { error: 'Выбери другое имя.' });
    let s = Object.values(db.students).find(x => x.name.toLowerCase() === name.toLowerCase());
    if (s && !b.resume) return send(res, 409, { error: 'Такое имя уже есть в классе. Если это ты, нажми «Это я», иначе добавь фамилию.', canResume: true });
    if (!s) { s = { id: id(8), name, token: id(24), step: 0, answers: {}, games: [], ai: {}, created: Date.now() }; db.students[s.id] = s; }
    s.lastSeen = Date.now(); save();
    return send(res, 200, { token: s.token });
  }

  if (p.startsWith('/api/') && !p.startsWith('/api/teacher')) {
    const s = studentByToken(req);
    if (!s) return send(res, 401, { error: 'Нужно войти заново.' });
    s.lastSeen = Date.now();

    if (p === '/api/me' && req.method === 'GET') {
      const sharedTitle = db.shared.kind === 'file' ? lesson().sharedDefault.title : ((db.games[db.shared.gameId] || {}).title || 'Общая игра');
      const sharedDecisions = db.shared.kind === 'file' ? lesson().sharedDefault.decisions : ((db.games[db.shared.gameId] || {}).decisions || []);
      return send(res, 200, { me: studentPublic(s), unlocked: db.unlocked, shared: { title: sharedTitle, decisions: sharedDecisions, version: db.shared.gameId || db.shared.file }, mode: MOCK ? 'demo' : 'qwen' });
    }
    if (p === '/api/answer' && req.method === 'POST') {
      const b = await readBody(req);
      if (!b.stepId) return send(res, 400, { error: 'Нет шага' });
      s.answers = s.answers || {};
      s.answers[b.stepId] = Object.assign({}, s.answers[b.stepId] || {}, b.value || {});
      save(); return send(res, 200, { ok: true, me: studentPublic(s) });
    }
    if (p === '/api/progress' && req.method === 'POST') {
      const b = await readBody(req);
      const max = lesson().steps.filter(st => st.cp <= db.unlocked).length - 1;
      s.step = Math.max(0, Math.min(+b.step || 0, max)); save();
      return send(res, 200, { ok: true });
    }
    if (p.startsWith('/api/job/') && req.method === 'GET') {
      const job = jobs.get(p.slice(9));
      if (!job || job.owner !== s.id) return send(res, 404, { error: 'Задача не найдена. Попробуй ещё раз.' });
      return send(res, 200, { status: job.status, result: job.result, error: job.error, seconds: Math.round((Date.now() - job.started) / 1000) });
    }
    if (p === '/api/ai/review' && req.method === 'POST') {
      const b = await readBody(req);
      if (blocked(b.form)) return send(res, 400, { error: 'В замысле есть слова, которые не подходят для студии. Поправь текст.' });
      s.answers.igra = Object.assign({}, s.answers.igra || {}, { form: b.form }); save();
      const user = formText(b.form);
      const jid = startJob(s.id, 'review', async () => {
        const review = MOCK ? await mockReview(b.form) : parseJson(await qwen(Q.chatModel, [{ role: 'system', content: REVIEW_SYSTEM }, { role: 'user', content: user }], { maxTokens: 1500, temperature: 0.5 }));
        review.forks = Array.isArray(review.forks) ? review.forks.slice(0, 2) : [];
        review.issues = Array.isArray(review.issues) ? review.issues.slice(0, 3) : [];
        review.decisions = review.decisions || {};
        s.ai = s.ai || {}; s.ai.review = review; save();
        return review;
      });
      return send(res, 200, { job: jid });
    }
    if (p === '/api/ai/feedback' && req.method === 'POST') {
      const b = await readBody(req);
      const user = `Плейтест игры «${b.gameTitle || ''}».\nОтветы ученика:\n${(b.lines || []).join('\n')}${b.telemetry ? '\nСтатистика из игры: ' + b.telemetry : ''}`;
      const jid = startJob(s.id, 'feedback', async () => {
        const text = MOCK ? await mockFeedback(b) : await qwen(Q.chatModel, [{ role: 'system', content: FEEDBACK_SYSTEM }, { role: 'user', content: user }], { maxTokens: 600, temperature: 0.7 });
        s.ai = s.ai || {}; s.ai['fb_' + b.stepId] = text; save();
        return { text };
      });
      return send(res, 200, { job: jid });
    }
    if (p === '/api/ai/generate' && req.method === 'POST') {
      if ([...jobs.values()].some(j => j.owner === s.id && j.kind === 'generate' && j.status === 'running')) return send(res, 409, { error: 'Qwen уже собирает твою игру. Подожди минуту и обнови страницу.' });
      const count = (s.genCount || 0);
      if (count >= LIMITS.generationsPerStudent) return send(res, 429, { error: 'Лимит сборок на занятие исчерпан. Позови учителя.' });
      s.genCount = count + 1; save();
      const spec = specText(s);
      const jid = startJob(s.id, 'generate', async () => {
        const code = await writeGame(GAME_SYSTEM, spec);
        const dec = (s.answers.producer && s.answers.producer.decisions) || (s.ai.review && s.ai.review.decisions) || {};
        const gid = id(10);
        db.games[gid] = { id: gid, kind: 'module', owner: s.id, author: s.name, code, spec, version: 1, fixes: 0, created: Date.now(), decisions: [dec.feel && 'Чувство: ' + dec.feel, dec.fair && 'Честность: ' + dec.fair, dec.choice && 'Выбор: ' + dec.choice].filter(Boolean), history: [] };
        const t = /title\s*:\s*['"`]([^'"`]{1,60})['"`]/.exec(code); if (t) db.games[gid].title = t[1];
        s.games = s.games || []; s.games.push(gid); save();
        return { gameId: gid, title: db.games[gid].title };
      });
      return send(res, 200, { job: jid });
    }
    if (p === '/api/ai/fix' && req.method === 'POST') {
      const b = await readBody(req);
      const g = db.games[b.gameId];
      if (!g || g.owner !== s.id || g.kind !== 'module') return send(res, 404, { error: 'Игра не найдена' });
      if ((g.fixes || 0) >= LIMITS.fixesPerGame) return send(res, 429, { error: 'Лимит правок для этой игры исчерпан. Позови учителя.' });
      if (blocked(b.request)) return send(res, 400, { error: 'Переформулируй просьбу.' });
      const ask = b.error ? `Игра падает с ошибкой: ${b.error}\nИсправь ошибку, ничего больше не меняя.` : `Просьба автора: ${String(b.request || '').slice(0, 600)}`;
      const jid = startJob(s.id, 'fix', async () => {
        const code = await writeGame(FIX_SYSTEM, `Замысел игры:\n${g.spec || ''}\n\nТекущий код:\n\`\`\`js\n${g.code}\n\`\`\`\n\n${ask}`);
        g.history = (g.history || []).slice(-5); g.history.push({ code: g.code, version: g.version, request: b.error ? 'Исправление ошибки' : b.request });
        g.code = code; g.version = (g.version || 1) + 1; if (!b.error) g.fixes = (g.fixes || 0) + 1; save();
        return { gameId: g.id, version: g.version };
      });
      return send(res, 200, { job: jid });
    }
    if (p === '/api/game/undo' && req.method === 'POST') {
      const b = await readBody(req); const g = db.games[b.gameId];
      if (!g || g.owner !== s.id || !(g.history || []).length) return send(res, 400, { error: 'Откатывать некуда' });
      const prev = g.history.pop(); g.code = prev.code; g.version = (g.version || 1) + 1; save();
      return send(res, 200, { ok: true, version: g.version });
    }
    if (p === '/api/game/meta' && req.method === 'POST') {
      const b = await readBody(req); const g = db.games[b.gameId];
      if (!g || g.owner !== s.id) return send(res, 404, { error: 'Игра не найдена' });
      if (b.title != null) { const t = String(b.title).trim().slice(0, 60); if (t && !blocked(t)) g.title = t; }
      if (b.telemetry) g.telemetry = b.telemetry;
      save(); return send(res, 200, { ok: true });
    }
    return send(res, 404, { error: 'Нет такого запроса' });
  }

  /* ---------- учитель ---------- */
  if (p.startsWith('/api/teacher')) {
    if (!isTeacher(req)) return send(res, 401, { error: 'Неверный пароль учителя' });
    if (p === '/api/teacher/state') {
      const L = lesson();
      const students = Object.values(db.students).map(s => ({ id: s.id, name: s.name, step: s.step || 0, stepTitle: (L.steps[s.step || 0] || {}).title, cp: (L.steps[s.step || 0] || {}).cp, games: (s.games || []).length, xp: xpOf(s), lastSeen: s.lastSeen, busy: [...jobs.values()].some(j => j.owner === s.id && j.status === 'running') }));
      const arcade = Object.values(db.games).filter(g => g.owner !== 'teacher').map(g => ({ id: g.id, title: g.title, author: g.author, version: g.version }));
      return send(res, 200, { classCode: db.classCode, unlocked: db.unlocked, lesson: { title: L.title, checkpoints: L.checkpoints, steps: L.steps.map(s => ({ id: s.id, title: s.title, cp: s.cp })) }, students, arcade, shared: db.shared, sharedTitle: db.shared.kind === 'file' ? L.sharedDefault.title : (db.games[db.shared.gameId] || {}).title, usage: db.usage, mode: MOCK ? 'demo' : 'qwen', model: Q.codeModel, urls: lanUrls(), running, queued: waiters.length });
    }
    if (p === '/api/teacher/unlock' && req.method === 'POST') { const b = await readBody(req); db.unlocked = Math.max(1, Math.min(4, +b.cp || 1)); save(); return send(res, 200, { ok: true }); }
    if (p === '/api/teacher/student' && req.method === 'GET') {
      const s = db.students[url.searchParams.get('id')];
      if (!s) return send(res, 404, { error: 'Нет ученика' });
      return send(res, 200, { student: studentPublic(s), spec: specText(s) });
    }
    if (p === '/api/teacher/shared/generate' && req.method === 'POST') {
      const b = await readBody(req);
      const jid = startJob('teacher', 'shared', async () => {
        const code = await writeGame(GAME_SYSTEM, `Демо-игра учителя для всего класса. Сделай её особенно сочной и честной.\nЗамысел: ${String(b.idea || '').slice(0, 1500)}`);
        const gid = id(10);
        db.games[gid] = { id: gid, kind: 'module', owner: 'teacher', author: 'учитель и класс', code, spec: b.idea, version: 1, created: Date.now(), decisions: [] };
        const t = /title\s*:\s*['"`]([^'"`]{1,60})['"`]/.exec(code); if (t) db.games[gid].title = t[1];
        const d = /decisions\s*:\s*\[([\s\S]*?)\]/.exec(code); if (d) db.games[gid].decisions = [...d[1].matchAll(/['"`]([^'"`]+)['"`]/g)].map(m => m[1]).slice(0, 3);
        save(); return { gameId: gid, title: db.games[gid].title };
      });
      return send(res, 200, { job: jid });
    }
    if (p.startsWith('/api/teacher/job/')) { const job = jobs.get(p.slice(17)); if (!job) return send(res, 404, { error: 'Нет задачи' }); return send(res, 200, { status: job.status, result: job.result, error: job.error, seconds: Math.round((Date.now() - job.started) / 1000) }); }
    if (p === '/api/teacher/shared/set' && req.method === 'POST') {
      const b = await readBody(req);
      db.shared = b.gameId && db.games[b.gameId] ? { kind: 'module', gameId: b.gameId } : { kind: 'file', file: 'sova-haker.html' };
      save(); return send(res, 200, { ok: true });
    }
    if (p === '/api/teacher/reset-student' && req.method === 'POST') { const b = await readBody(req); const s = db.students[b.id]; if (s) { s.step = 0; s.genCount = 0; save(); } return send(res, 200, { ok: true }); }
    if (p === '/api/teacher/test-ai' && req.method === 'POST') {
      if (MOCK) return send(res, 200, { ok: true, text: 'Демо-режим: ключ Qwen не задан, ответы подставные.' });
      try { const t = await qwen(Q.chatModel, [{ role: 'user', content: 'Ответь одним словом: работает?' }], { maxTokens: 20 }); return send(res, 200, { ok: true, text: t }); }
      catch (e) { return send(res, 200, { ok: false, text: e.message }); }
    }
    if (p === '/api/teacher/new-lesson-run' && req.method === 'POST') {
      const b = await readBody(req);
      if (b.confirm !== 'СБРОС') return send(res, 400, { error: 'Нужно подтверждение' });
      const backup = path.join(DATA_DIR, `db-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      fs.writeFileSync(backup, JSON.stringify(db));
      db.students = {}; db.games = Object.fromEntries(Object.entries(db.games).filter(([, g]) => g.owner === 'teacher')); db.unlocked = 1; db.classCode = String(crypto.randomInt(1000, 9999)); save();
      return send(res, 200, { ok: true, backup: path.basename(backup), classCode: db.classCode });
    }
    return send(res, 404, { error: 'Нет такого запроса' });
  }
  return send(res, 404, 'Не найдено');
}

function formText(f = {}) {
  return [`Уровень: ${f.level || ''}${f.card ? ` (карта: ${f.card})` : ''}`,
    `Три решения: 1) ${f.d1 || ''}; 2) ${f.d2 || ''}; 3) ${f.d3 || ''}.`,
    'Промпт:', `И: ${f.pI || ''}`, `Г: ${f.pG || ''}`, `Р: ${f.pR || ''}`, `А: ${f.pA || ''}`].join('\n');
}

/* ---------- демо-режим без ключа ---------- */
async function mockReview(f) {
  await sleep(1200);
  const dice = Object.values(f || {}).filter(v => String(v).includes('[кубик]')).length;
  return {
    strong: `Глагол «${String(f.pG || 'управление').replace(' [кубик]', '').slice(0, 60)}» — хорошая основа: из него может вырасти выбор игрока.`,
    issues: [
      'Решения «чувство» и «честность» пока звучат как цели. Скажи, КАК игра этого добьётся.',
      dice ? `Полей с кубика без правок: ${dice}. Попробуй сказать хотя бы часть своими словами.` : 'Проверь, что для решения «выбор» у игрока есть кнопка.',
    ],
    forks: [
      { question: 'Какой будет первая минута игры?', options: [{ label: 'Спокойное начало', detail: 'Первые 10 секунд без опасности, игрок осваивается' }, { label: 'Сразу в бой', detail: 'Опасность с первой секунды, но медленная' }] },
    ],
    decisions: { feel: 'азарт «успею или нет» в каждом манёвре', fair: 'опасность видна заранее и движется предсказуемо', choice: 'рискнуть ради очков или сыграть безопасно' },
  };
}
async function mockFeedback(b) {
  await sleep(900);
  const first = (b.lines || []).find(l => l && !/рекорд/i.test(l)) || 'твои ответы';
  return `Хорошее наблюдение: «${first.replace(/^[^:]*:\s*/, '').slice(0, 90)}». Именно так геймдизайнер и смотрит на игру — через ощущения, а не только через счёт. Но помни: один игрок — это наблюдение, а не вывод. Проверь на соседе: почувствует ли он то же самое? (Демо-режим: здесь будет отзыв Qwen.)`;
}

function lanUrls() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(`http://${a.address}:${PORT}`);
  return out.length ? out : [`http://localhost:${PORT}`];
}

const server = http.createServer((req, res) => {
  route(req, res).catch(e => { console.error(e); try { send(res, 500, { error: e.message || 'Ошибка сервера' }); } catch (_) {} });
});
server.requestTimeout = 0;
server.listen(PORT, '0.0.0.0', () => {
  console.log('\n  «Лаборатория игр» запущена');
  console.log('  ────────────────────────────────────────');
  console.log('  Ученики открывают в браузере:');
  lanUrls().forEach(u => console.log('     ' + u));
  console.log(`  Код класса:        ${db.classCode}`);
  console.log(`  Панель учителя:    http://localhost:${PORT}/teacher`);
  console.log(`  Пароль учителя:    ${config.teacherPassword}  (меняется в config.json)`);
  console.log(`  Режим ИИ:          ${MOCK ? 'ДЕМО (ключ Qwen не задан — ответы подставные)' : 'Qwen, модель ' + Q.codeModel}`);
  console.log('  ────────────────────────────────────────');
  console.log('  Остановить сервер: Ctrl+C\n');
});
