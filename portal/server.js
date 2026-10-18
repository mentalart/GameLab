#!/usr/bin/env node
// Портал «Лаборатория игр». Запуск: node portal/server.js  →  http://localhost:8080/
// Без зависимостей, Node.js 18+. Ключ ИИ и пароль учителя — в portal/config.json (создаётся при первом запуске).
'use strict';
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
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
// LAB_LESSONS — дополнительная папка сценариев (e2e-portal.js кладёт туда урок-проверку новых типов шагов).
// Версия урока — файл urok-NN-vK.js (поле version в сценарии): в меню учителя рядом с первой версией того же урока.
const MODULES = require('./lessons/moduli');
const answers = require('./lib/answers');
const lessonEdit = require('./lib/lesson-edit');
const LESSON_DIRS = [path.join(PORTAL, 'lessons')].concat(process.env.LAB_LESSONS ? [path.resolve(process.env.LAB_LESSONS)] : []);
const lessonFiles = new Map(); // id урока → его файл: туда пишется правка «Сценария учителя» из панели
function loadLesson(file) {
  delete require.cache[require.resolve(file)];
  if (/-v\d+\.js$/.test(file)) delete require.cache[require.resolve(file.replace(/-v\d+\.js$/, '.js'))]; // версия урока собирается из первой
  return require(file);
}
function lessons() {
  return LESSON_DIRS.flatMap(dir => { try { return fs.readdirSync(dir).filter(f => /^urok-\d+(-v\d+)?\.js$/.test(f)).map(f => path.join(dir, f)); } catch (e) { return []; } })
    .map(file => { const l = loadLesson(file); lessonFiles.set(l.id, file); return l; }).sort((a, b) => a.number - b.number || (a.version || 1) - (b.version || 1) || a.id.localeCompare(b.id));
}
// ученику — урок без колоды секретов: какой секрет в игре класса, он узнаёт только после своей догадки
// и без ответа шага «Найди секрет» с hunt в сценарии: правильный вариант, ловушка и раскрытие приходят после догадки
const publicHunt = h => ({ question: h.question, options: h.options, compare: h.compare, after: h.after });
// Поле Фабрики с secrets: true — карта секрета своей игры: колода — названия секретов урока (без fallbackOnly, со звуком — только при наушниках).
// Сценарий учителя у чекпоинта (teacher) ученику не нужен.
function studentLesson(les, cls) {
  const step = s => {
    if (s.hunt) return Object.assign({}, s, { hunt: publicHunt(s.hunt) });
    if (s.type === 'factory' && les.wow && s.fields.some(f => f.secrets)) return Object.assign({}, s, { fields: s.fields.map(f => (f.secrets ? Object.assign({}, f, { deck: diceSecrets(cls, les).map(x => x.title) }) : f)) });
    return s;
  };
  const out = Object.assign({}, les, { checkpoints: les.checkpoints.map(cp => { const c = Object.assign({}, cp, { steps: cp.steps.map(step) }); delete c.teacher; return c; }) });
  if (les.wow) out.wow = { formula: les.wow.formula, cards: les.wow.cards.map(c => ({ id: c.id, label: c.label, parts: !!c.parts })) };
  return out;
}
function lesson(id) { return lessons().find(l => l.id === id) || null; }
function stepOf(les, stepId) { for (const cp of les.checkpoints) for (const s of cp.steps) if (s.id === stepId) return { cp, step: s }; return null; }

/* ---------------- задания ИИ (идут долго, клиент опрашивает) ---------------- */
const jobs = new Map();
// Программист в chat.qwen.ai (урок с programmer: 'chat'): задание ждёт человека в состоянии waiting — progress.ask выдаёт
// текст для чата, страница показывает окно «скопируй → вставь ответ», ответ приходит в /api/job/answer, и задание идёт дальше.
function startJob(owner, kind, fn) {
  const job = { id: store.id(12), owner, kind, state: 'running', started: Date.now(), chars: 0, phase: '', result: null, error: null };
  jobs.set(job.id, job);
  const progress = (chars, phase) => { job.chars = chars; if (phase) job.phase = phase; };
  progress.ask = q => new Promise((resolve, reject) => {
    job.state = 'waiting';
    job.manual = Object.assign({ step: ((job.manual && job.manual.step) || 0) + 1, answer: '', parts: 0, since: Date.now() }, q);
    job.answer = text => { job.state = 'running'; job.manual.done = true; resolve(text); };
    job.cancel = () => { job.state = 'running'; reject(new Error('Отменено: ответ из чата не вставлен')); };
  });
  Promise.resolve().then(() => fn(progress))
    .then(r => { job.state = 'done'; job.result = r; }, e => { job.state = 'error'; job.error = e.message; })
    .then(() => { job.answer = job.cancel = null; })
    .finally(() => { job.ended = Date.now(); setTimeout(() => jobs.delete(job.id), 3600e3); });
  return job;
}

/* ---------------- живые обновления (SSE) ---------------- */
const listeners = new Map(); // код класса → Set(res)
// кто из учеников сейчас на связи (открыта страница урока или аркады)
function online(code) { return new Set([...(listeners.get(code) || [])].map(r => r.labNick).filter(Boolean)); }
function broadcast(code, event, data) {
  for (const res of listeners.get(code) || []) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
setInterval(() => { for (const set of listeners.values()) for (const res of set) res.write(': пульс\n\n'); }, 25000).unref();

/* ---------------- замысел ученика ---------------- */
const fieldText = f => (f && typeof f === 'object' ? f.text : f) || '';
function buildPlan(les, st) {
  const A = id => (st.answers[id] || {}).value || {};
  const P = les.plan;
  if (!P || !stepOf(les, P.factory)) return { title: 'Моя игра', donor: les.donor || '', twist: '', world: '', level: '', details: [], decisions: { feeling: '', honesty: '', choice: '' }, igra: { i: '', g: '', r: '', a: '' }, forks: [], secret: null, diceCount: 0, fieldCount: 0 };
  const fac = A(P.factory), facFields = fac.fields || {};
  const facStep = stepOf(les, P.factory).step;
  const level = (facStep.levels || []).find(l => l.id === fac.level) || (facStep.levels || [])[0] || { label: 'Базовый', hint: '' };
  // донор на выбор (шаг factory с donors): в замысел идёт выбранная классика, а не донор урока
  const chosen = facStep.donors ? (facStep.donors.find(d => d.id === fac.donor) || facStep.donors[0]) : null;
  const details = facStep.fields.filter(f => !['title', 'twist', 'world', 'secret'].includes(f.id) && fieldText(facFields[f.id]))
    .map(f => `${f.label}: ${fieldText(facFields[f.id])}`);
  const dec = (A(P.decisions).fields) || {}, igra = (A(P.igra).fields) || {};
  const prod = A(P.producer);
  const forks = ((prod.result && prod.result.forks) || []).map((f, i) => ({ question: f.question, answer: (prod.choices || {})[i] })).filter(f => f.answer);
  const all = [facFields, dec, igra].flatMap(o => Object.values(o));
  // карта секрета (поле secret Фабрики): секрет из колоды урока — его задание программисту, свои слова — как есть
  const secText = fieldText(facFields.secret), secDef = secText && les.wow ? les.wow.secrets.find(x => x.title === secText) : null;
  return {
    title: fieldText(facFields.title) || 'Моя игра',
    donor: chosen ? `${chosen.title} — ${chosen.text} ${chosen.rules || ''}`.trim() : `${les.donor} — ${facStep.donorCard ? facStep.donorCard.text : ''}`,
    donorTitle: chosen ? chosen.title : les.donor,
    twist: fieldText(facFields.twist), world: fieldText(facFields.world),
    secret: secText ? { title: secText, prompt: secDef ? secDef.prompt : secText } : null,
    level: `${level.label} (${level.hint})`, details,
    decisions: { feeling: fieldText(dec.feeling), honesty: fieldText(dec.honesty), choice: fieldText(dec.choice) },
    igra: { i: fieldText(igra.i), g: fieldText(igra.g), r: fieldText(igra.r), a: fieldText(igra.a) },
    forks,
    // находки продюсера идут программисту, пока ученик не принял правку продюсера: тогда они уже в полях ИГРА
    frame: (prod.result && prod.result.frame) || '',
    findings: prod.fixed ? [] : ((prod.result && prod.result.findings) || []).map(f => `${f.kind}: ${f.text}`).slice(0, 5),
    diceCount: all.filter(f => f && f.dice).length,
    fieldCount: all.filter(f => fieldText(f)).length,
  };
}

// «Собрать в любой момент» (урок 1): пустые поля Фабрики и решений дописывает кубик, пустые буквы ИГРА — черновик из Фабрики
// (как prefill у ученика). Дописанное сохраняется в ответах с пометкой [кубик] / «черновик Фабрики» и возвращается ученику.
const fillTpl = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] || '…');
function fillGaps(les, st, cls) {
  const P = les.plan, filled = {};
  let count = 0;
  if (!P || !stepOf(les, P.factory)) return { filled, count };
  const ans = id => (st.answers[id] = Object.assign({ value: {}, done: false }, st.answers[id]));
  const pick = deck => deck[crypto.randomInt(deck.length)];
  const fac = stepOf(les, P.factory).step, fa = ans(P.factory);
  fa.value = Object.assign({ level: fac.levels[0].id }, fa.value, { fields: Object.assign({}, (fa.value || {}).fields) });
  const donor = fac.donors ? (fac.donors.find(d => d.id === fa.value.donor) || fac.donors[0]) : null;
  if (donor && !fa.value.donor) fa.value.donor = donor.id;
  const fillFields = (a, fields, deckOf) => {
    let n = 0;
    for (const f of fields) {
      if (fieldText(a.value.fields[f.id])) continue;
      const deck = deckOf(f);
      if (deck && deck.length) { a.value.fields[f.id] = { text: pick(deck), dice: true }; n++; }
    }
    return n;
  };
  const nf = fillFields(fa, fac.fields.filter(f => !f.levels || f.levels.includes(fa.value.level)),
    f => (donor && donor.decks && donor.decks[f.id]) || (f.secrets && les.wow ? diceSecrets(cls, les).map(x => x.title) : f.deck));
  if (nf) { fa.at = store.now(); filled[P.factory] = fa; count += nf; }
  const decStep = stepOf(les, P.decisions);
  if (decStep) {
    const da = ans(P.decisions);
    da.value = Object.assign({}, da.value, { fields: Object.assign({}, (da.value || {}).fields) });
    const nd = fillFields(da, decStep.step.fields, f => f.deck);
    if (nd) { da.at = store.now(); filled[P.decisions] = da; count += nd; }
  }
  const igStep = stepOf(les, P.igra);
  if (igStep) {
    const vars = {};
    for (const id of [P.factory, P.decisions]) for (const [k, f] of Object.entries(((st.answers[id] || {}).value || {}).fields || {})) vars[k] = fieldText(f);
    if (donor) Object.assign(vars, { donor: donor.title, donorRules: donor.rules || '', donorKeys: donor.keys || '' });
    if (P.melody) vars.melody = ((st.answers[P.melody] || {}).value || {}).line || '';
    const ia = ans(P.igra);
    ia.value = Object.assign({}, ia.value, { fields: Object.assign({}, (ia.value || {}).fields) });
    let ni = 0;
    for (const f of igStep.step.fields) if (f.prefill && !fieldText(ia.value.fields[f.id])) { ia.value.fields[f.id] = { text: fillTpl(f.prefill, vars), auto: true }; ni++; }
    if (ni) { ia.at = store.now(); filled[P.igra] = ia; count += ni; }
  }
  return { filled, count };
}

// все поля «свои слова или кубик» во всех ответах урока: сколько заполнено и сколько оставлено кубику
function fieldStats(st) {
  let fields = 0, dice = 0;
  const walk = (v, depth) => {
    if (!v || typeof v !== 'object' || depth > 5) return;
    if (typeof v.text === 'string' && !Array.isArray(v)) { if (v.text.trim()) { fields++; if (v.dice) dice++; } return; }
    Object.entries(v).forEach(([k, x]) => { if (k !== 'picks') walk(x, depth + 1); }); // ответы квизов — не поля
  };
  Object.values(st.answers || {}).forEach(a => walk(a && a.value, 0));
  return { fields, dice };
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

// Игра-страница из чата (урок 1, версия 2) — без оболочки Лаб3D: мост engine/portal.js даёт ей объект portal
// (ручки и их панель, конец партии и рекорды, счётчики, ошибки со строкой). Вставляется первым в <head> без перевода строки:
// номера строк ошибок совпадают с кодом из чата. В скачанной игре мост — внутри файла.
const bridgeTag = inline => inline ? inlineScript(fs.readFileSync(path.join(PORTAL, 'engine', 'portal.js'), 'utf8')) : '<script src="/engine/portal.js"></script>';
const htmlGame = (code, inline) => (/<head[^>]*>/i.test(code) ? code.replace(/<head[^>]*>/i, m => m + bridgeTag(inline)) : code.replace(/<html[^>]*>/i, m => m + bridgeTag(inline)));
function playPage(res, gameId, n) {
  const g = store.getGame(gameId);
  const code = g && store.versionCode(gameId, n || g.current);
  if (!code) return send(res, 404, 'Нет такой версии игры', 'text/plain; charset=utf-8');
  // страница HTML из чата Qwen (урок 1, версия 2) — как есть, в той же песочнице
  if (ai.isHtml(code)) return send(res, 200, htmlGame(code), 'text/html; charset=utf-8', Object.assign({ 'Content-Security-Policy': 'sandbox allow-scripts allow-pointer-lock' }, CORS));
  const html = fs.readFileSync(path.join(PORTAL, 'engine', 'game.html'), 'utf8')
    .replace('<head>', '<head>\n<base href="/engine/">')
    .replace('<!--GAME-->', () => '<script>\n' + code.replace(/<\/script/gi, '<\\/script') + '\n</script>'); // функцией: «$&» и «$'» в коде игры — не шаблоны замены
  // CSP sandbox: даже открытая отдельной вкладкой игра не видит данных портала (своё «пустое» происхождение)
  send(res, 200, html, 'text/html; charset=utf-8', Object.assign({ 'Content-Security-Policy': 'sandbox allow-scripts allow-pointer-lock' }, CORS));
}
// игра одним файлом: оболочка, Babylon.js и код версии в одном .html — работает без портала и без интернета (кроме игр с физикой Havok)
let BABYLON_JS = null;
const inlineScript = js => '<script>\n' + js.replace(/<\/script/gi, '<\\/script') + '\n</script>';
function downloadPage(res, gameId, n) {
  const g = store.getGame(gameId);
  const v = g && (Number(n) || g.current), code = g && store.versionCode(gameId, v);
  if (!code) return send(res, 404, 'Нет такой версии игры', 'text/plain; charset=utf-8');
  if (ai.isHtml(code)) return send(res, 200, htmlGame(code, true), 'text/html; charset=utf-8', { 'Content-Security-Policy': 'sandbox allow-scripts allow-pointer-lock', 'Content-Disposition': `attachment; filename="igra.html"; filename*=UTF-8''${encodeURIComponent((g.title || 'igra') + ' v' + v + '.html')}` });
  if (/\bphysics\s*:\s*true/.test(code)) return send(res, 409, 'Эта игра с физикой: одним файлом она не запустится. Играй в неё в аркаде.', 'text/plain; charset=utf-8');
  if (!BABYLON_JS) BABYLON_JS = fs.readFileSync(path.join(PORTAL, 'engine', 'vendor', 'babylon', 'babylon.js'), 'utf8');
  const lab = fs.readFileSync(path.join(PORTAL, 'engine', 'lab.js'), 'utf8');
  const html = fs.readFileSync(path.join(PORTAL, 'engine', 'game.html'), 'utf8')
    .replace('<script src="vendor/babylon/babylon.js"></script>', () => inlineScript(BABYLON_JS))
    .replace('<script src="lab.js"></script>', () => inlineScript(lab))
    .replace('<!--GAME-->', () => inlineScript(code))
    .replace('<title>Лаборатория игр</title>', () => `<title>${String(g.title || 'Моя игра').replace(/[<>&]/g, '')} · Лаборатория игр</title>`);
  const name = `${(g.title || 'igra').replace(/[\\/:*?"<>|]+/g, '').trim() || 'igra'} v${v}.html`;
  send(res, 200, html, 'text/html; charset=utf-8', { 'Content-Security-Policy': 'sandbox allow-scripts allow-pointer-lock', 'Content-Disposition': `attachment; filename="igra.html"; filename*=UTF-8''${encodeURIComponent(name)}` });
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

const plainChoice = t => t.replace(/(^| · )свои слова: /g, '$1'); // ответ шага choice для самого ученика: без служебной пометки
// «План версии 2» с последнего пройденного урока — показывается в начале нового урока
function prevPlan(s, les) {
  const prev = lessons().filter(l => l.number < les.number && s.lessons && s.lessons[l.id]).pop();
  if (!prev) return null;
  const f = stepOf(prev, 'plan-v2'), text = f ? plainChoice(answers.answerText(f.step, answerOf(s.lessons[prev.id], 'plan-v2'))) : '';
  const g = s.lessons[prev.id].gameId ? store.getGame(s.lessons[prev.id].gameId) : null;
  return text ? { lesson: prev.number, title: prev.title, text, game: g ? g.title || '' : '' } : null;
}
// «Нужна помощь»: ученик поднимает руку, учитель видит его первым в очереди и опускает руку кнопкой «Помог»
route('POST', '/api/help', (ctx) => {
  const { w, s, st } = needStudent(ctx);
  s.help = ctx.body.on ? { at: store.now(), where: s.where || null } : null;
  store.saveStudent(w.class, s);
  return { help: s.help };
});
route('POST', '/api/teacher/help', (ctx) => {
  needTeacher(ctx);
  const s = store.getStudent(String(ctx.body.code || ''), String(ctx.body.nick || ''));
  if (!s) throw Object.assign(new Error('Нет такого ученика'), { status: 404 });
  s.help = null; store.saveStudent(ctx.body.code, s);
  broadcast(ctx.body.code, 'help', { nick: s.nick });
  return { ok: true };
});
route('GET', '/api/me', (ctx) => {
  const { w, cls, les, s, st } = needStudent(ctx);
  s.seen = store.now(); store.saveStudent(w.class, s);
  const g = st.gameId ? store.getGame(st.gameId) : null;
  return { nick: w.nick, class: { code: cls.code, name: cls.name, opened: cls.opened, authorMode: cls.authorMode }, lesson: studentLesson(les, cls), answers: st.answers, game: g, wow: les.wow ? publicWow(cls, les) : null, feedback: st.feedback || null, demo: ai.programmerDemo(les.id), chat: ai.manual(les.id), aiCalls: st.aiCalls, aiLimit: aiLimit(st), prevPlan: prevPlan(s, les), help: s.help || null };
});

route('POST', '/api/answer', (ctx) => {
  const { w, les, s, st } = needStudent(ctx);
  const { step, value, done } = ctx.body;
  if (!stepOf(les, step)) throw Object.assign(new Error('Нет такого шага'), { status: 400 });
  const prev = st.answers[step] || {};
  st.answers[step] = { value: value === undefined ? prev.value : value, done: done === undefined ? !!prev.done : !!done, at: store.now() };
  s.where = step; s.seen = store.now(); s.moved = store.now(); // moved — для фильтра «застряли» у учителя
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
  if (ch) {
    const prev = chLeader(ch);
    out.challenge = records(store.addScore(w.class + ':challenge:' + ch.code, w.nick, score), w.nick);
    if (score > prev.score) { // новый лидер: его запись — призрак для остальных, прежнему лидеру — «отыграться»
      ch.leader = { nick: w.nick, score, line: cleanLine((ctx.body.tele || {}).line), at: store.now() };
      store.saveChallenge(w.class, ch);
      const loser = prev.nick !== w.nick && !(ch.day && prev.nick === ch.nick) ? prev.nick : null;
      broadcast(w.class, 'challenge', { kind: 'lead', code: ch.code, title: ch.title, nick: w.nick, score, loser, loserScore: prev.score, day: !!ch.day });
    } else if (ch.day) broadcast(w.class, 'challenge', { kind: 'score', code: ch.code, day: true });
  }
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
  // line — счёт по секундам партии (не больше 120 точек): из него у автора полоска каждой чужой партии
  const line = Array.isArray(t.line) ? t.line.slice(0, 600).map(v => Math.round(Number(v) || 0)) : [];
  const step = Math.max(1, Math.ceil(line.length / 120));
  return { time: Math.max(0, Math.round((Number(t.time) || 0) * 10) / 10), hold: nums(t.hold, btn), presses: nums(t.presses, btn), custom: nums(t.custom),
    hurts: Math.max(0, Math.min(999, Math.round(Number(t.hurts) || 0))), line: line.filter((_, i) => i % step === 0), lineStep: step };
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
    lesson: les ? { id: les.id, number: les.number, title: les.title, module: les.module || 0 } : null,
    decisions: dec || {}, version: g.current, versions: g.versions.length, balanced: g.versions.filter(v => v.kind === 'баланс').length,
    release: g.release ? { version: g.release.version, at: g.release.at, note: g.release.note.text, lesson: g.release.lesson } : null,
    record: rec.record, top: rec.top.slice(0, 5), authorBest: all[g.nick] ? all[g.nick].score : 0, myBest: rec.mine,
    plays: store.plays(g.id).filter(p => p.type === 'over' && p.nick !== g.nick).length,
    again: store.plays(g.id).filter(p => p.type === 'again' && p.nick !== g.nick).length, // «ещё раз» чужих игроков — главный тест курса
    poster: g.poster ? `/poster/${g.id}.jpg?v=${g.poster.version}` : null,
    hidden: !!g.hidden, mine: g.nick === viewer, knob: g.knob || null, emblem: (store.getStudent(code, g.nick) || {}).emblem || '',
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
    // последние чужие партии по секундам: где счёт стоял на месте, там игроку, возможно, было скучно
    runs: overs.slice(-6).reverse().map(p => { const t = p.tele || {}; return { nick: p.nick, score: p.score || 0, time: Math.round(t.time || 0), hurts: t.hurts || 0, line: t.line || [], step: t.lineStep || 1, again: plays.some(q => q.type === 'again' && q.nick === p.nick && q.at >= p.at) }; }),
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
/* ---------- «Моя студия»: всё, что ученик сделал как геймдизайнер, на одной странице ---------- */
// эмблема автора видна рядом с ником в аркаде; только из этого набора — без свободного ввода
const EMBLEMS = ['🐉', '🦊', '🐺', '🦉', '🐝', '🌻', '🏔', '🌊', '🔥', '⚡', '🎲', '🚀', '🛡', '🗝', '🎯', '🍯'];
const answerOf = (st, id) => (st.answers || {})[id] || null;
function studio(w, cls, s) {
  const all = lessons(), plays = new Map();
  const playsOf = id => { if (!plays.has(id)) plays.set(id, store.plays(id)); return plays.get(id); };
  const cards = classGames(w.class).map(g => gameCard(w.class, g, w.nick));
  const mine = cards.filter(c => c.mine).sort((a, b) => ((a.lesson || {}).number || 0) - ((b.lesson || {}).number || 0))
    .map(c => Object.assign(c, { discovery: discovery(store.getGame(c.id)) }));
  const worked = all.filter(l => s.lessons && s.lessons[l.id] && Object.keys(s.lessons[l.id].answers || {}).length);
  // колоды: донор и линза каждого пройденного урока — карты, которые остаются у ученика
  const deck = worked.map(l => ({ lesson: l.number, title: l.title, donor: l.donor || '', lens: l.lens || '', goal: l.goal || '' }));
  // журнал: открытие дня, план версии 2 и решения замысла по каждому уроку
  const journal = worked.map(l => {
    const st = s.lessons[l.id], P = l.plan ? buildPlan(l, st) : null;
    const line = id => { const f = stepOf(l, id); return f ? plainChoice(answers.answerText(f.step, answerOf(st, id))) : ''; };
    const exp = l.checkpoints.flatMap(cp => cp.steps).filter(x => x.type === 'experiment').map(x => answers.answerText(x, answerOf(st, x.id))).filter(Boolean);
    return { lesson: l.number, title: l.title, game: P ? P.title : '', twist: P ? P.twist : '', decisions: P ? P.decisions : {}, discovery: line('otkrytie-den'), plan: line('plan-v2'), experiments: exp };
  }).filter(j => j.discovery || j.plan || j.twist || j.experiments.length);
  // значки — за действия геймдизайнера, а не за очки
  const myGames = mine.map(c => store.getGame(c.id)).filter(Boolean);
  const versions = myGames.flatMap(g => g.versions);
  const stepDone = type => worked.some(l => l.checkpoints.some(cp => cp.steps.some(x => x.type === type && (answerOf(s.lessons[l.id], x.id) || {}).done)));
  const own = worked.reduce((n, l) => { const P = l.plan ? buildPlan(l, s.lessons[l.id]) : null; return n + (P ? P.fieldCount - P.diceCount : 0); }, 0);
  const gaveCards = cards.filter(c => !c.mine).some(c => playsOf(c.id).some(p => p.type === 'card' && p.nick === w.nick));
  const badges = [
    { id: 'build', icon: '🛠', title: 'Первая сборка', how: 'Собрать свою игру', got: myGames.length > 0 },
    { id: 'own', icon: '✍', title: 'Своими словами', how: 'Написать 10 полей замысла без кубика', got: own >= 10 },
    { id: 'balance', icon: '🎚', title: 'Баланс без ИИ', how: 'Сохранить свои числа кнопкой «Сохранить мой баланс»', got: versions.some(v => v.kind === 'баланс') },
    { id: 'experiment', icon: '🧪', title: 'Экспериментатор', how: 'Пройти эксперимент с ручкой до вывода', got: stepDone('experiment') },
    { id: 'fix', icon: '🩹', title: 'Точная правка', how: 'Попросить программиста о правке', got: versions.some(v => v.kind === 'правка') },
    { id: 'tester', icon: '🔍', title: 'Плейтестер', how: 'Оставить карточку плейтеста в чужой игре', got: gaveCards },
    { id: 'again', icon: '🔁', title: '«Ещё раз!»', how: 'Чужой игрок нажал «ещё раз» в твоей игре', got: mine.some(c => c.again > 0) },
    { id: 'release', icon: '🏁', title: 'Релиз 1.0', how: 'Выпустить лучшую игру модуля', got: myGames.some(g => g.release) },
  ];
  // банк идей класса: «а что если» из карточек плейтеста и развилки продюсера, которые никто не выбрал
  const ideas = [], seen = new Set();
  const addIdea = (text, from, extra) => { const t = String(text || '').trim(); if (t.length < 4 || seen.has(t.toLowerCase())) return; seen.add(t.toLowerCase()); ideas.push(Object.assign({ text: t.slice(0, 200), from }, extra)); };
  for (const c of cards.filter(x => !x.hidden)) for (const p of playsOf(c.id)) if (p.type === 'card' && p.card) addIdea(fieldText(p.card.whatif), 'плейтест', { game: c.title });
  for (const st of store.students(w.class)) for (const l of all) {
    const ls = (st.lessons || {})[l.id]; if (!ls || !l.plan) continue;
    const prod = (answerOf(ls, l.plan.producer) || {}).value || {};
    ((prod.result && prod.result.forks) || []).forEach((f, i) => (f.options || []).filter(o => o !== (prod.choices || {})[i]).forEach(o => addIdea(o, 'развилка', { question: f.question })));
  }
  return {
    nick: w.nick, class: { code: cls.code, name: cls.name }, emblem: s.emblem || '', emblems: EMBLEMS,
    games: mine, deck, journal, badges, ideas: ideas.slice(-40).reverse(),
  };
}
route('GET', '/api/studio', (ctx) => { const { w, cls, s } = needStudent(ctx); return studio(w, cls, s); });
route('POST', '/api/studio/emblem', (ctx) => {
  const { w, s } = needStudent(ctx);
  const e = String(ctx.body.emblem || '');
  if (e && !EMBLEMS.includes(e)) throw Object.assign(new Error('Такой эмблемы нет'), { status: 400 });
  s.emblem = e; store.saveStudent(w.class, s);
  broadcast(w.class, 'arcade', { author: w.nick });
  return { emblem: e };
});
route('POST', '/api/arcade/hide', (ctx) => {
  const { w } = needStudent(ctx);
  const g = classGame(w, ctx.body.game);
  if (!g || g.nick !== w.nick) throw Object.assign(new Error('Скрыть можно только свою игру'), { status: 403 });
  g.hidden = !!ctx.body.hidden; store.saveGame(g);
  broadcast(w.class, 'arcade', { game: g.id, author: g.nick });
  return { hidden: g.hidden };
});
// релиз модуля: лучшая игра модуля получает метку «1.0» в аркаде. Одна игра на модуль: новый релиз снимает метку с прежней
route('POST', '/api/release', (ctx) => {
  const { w, les } = needStudent(ctx);
  const g = classGame(w, ctx.body.game);
  if (!g || g.nick !== w.nick) throw Object.assign(new Error('Выпустить можно только свою игру'), { status: 403 });
  const gl = lesson(g.lesson), mod = les.module || 0;
  if (!gl || (gl.module || 0) !== mod) throw Object.assign(new Error('На релиз идёт игра этого модуля'), { status: 400 });
  const note = cleanField(ctx.body.note);
  if (!note.text) throw Object.assign(new Error('Напиши, что изменил после плейтестов'), { status: 400 });
  const checks = Object.fromEntries(Object.entries(ctx.body.checks || {}).slice(0, 12).map(([k, v]) => [String(k).slice(0, 30), !!v]));
  for (const other of classGames(w.class)) {
    if (other.id !== g.id && other.nick === w.nick && other.release && other.release.module === mod) { delete other.release; store.saveGame(other); }
  }
  g.release = { version: g.current, at: store.now(), module: mod, lesson: les.id, note, checks };
  store.saveGame(g);
  broadcast(w.class, 'arcade', { game: g.id, author: g.nick });
  return { release: g.release };
});
// выставка джема (шаг vote): голоса класса по номинациям. Итог виден тому, кто уже проголосовал, и учителю
function voteTally(code, les, step) {
  const games = new Map(classGames(code).map(g => [g.id, g]));
  const voters = store.students(code).map(s => (((s.lessons || {})[les.id] || {}).answers || {})[step.id]).filter(a => a && a.value && a.value.votes);
  const noms = step.nominations.map(n => {
    const count = {};
    voters.forEach(a => { const id = a.value.votes[n.id]; if (games.has(id)) count[id] = (count[id] || 0) + 1; });
    const top = Object.entries(count).sort((x, y) => y[1] - x[1]).map(([id, votes]) => ({ game: id, title: games.get(id).title || 'Моя игра', nick: games.get(id).nick, version: games.get(id).current, votes }));
    return { id: n.id, label: n.label, top: top.slice(0, 5) };
  });
  return { voters: voters.length, noms };
}
route('GET', '/api/votes', (ctx) => {
  const { w, les, st } = needStudent(ctx);
  const step = les.checkpoints.flatMap(c => c.steps).find(x => x.id === ctx.url.searchParams.get('step') && x.type === 'vote');
  if (!step) throw Object.assign(new Error('Нет такого голосования'), { status: 404 });
  if (!((st.answers[step.id] || {}).value || {}).votes) return { hidden: true };
  return voteTally(w.class, les, step);
});
route('POST', '/api/play/again', (ctx) => {
  const { w } = needStudent(ctx);
  const g = classGame(w, ctx.body.game);
  if (g) store.addPlay(g.id, { type: 'again', nick: w.nick });
  return { ok: true };
});
/* ---------- вызов «побей мой мир»: любая игра урока — донор (ремейк шага play), игра класса, игра учителя, игра ученика ---------- */
// Вызов — игра + версия + зерно + ручки. Лидер — лучший счёт в этом мире, его счёт по секундам (tele.line) — призрак для соперников.
// Кого обошли, тому приходит «отыграться». Мир дня — вызов учителя всему классу, таблица живёт на проекторе.
const GAME_FILE = /^games\/[\w-]+\.js$/;
function remakeTitle(file) {
  try { return (/\btitle\s*:\s*(['"`])([^'"`]{1,80})\1/.exec(fs.readFileSync(path.join(PORTAL, file), 'utf8')) || [])[2] || null; } catch (e) { return null; }
}
const notFound = () => Object.assign(new Error('Нет такой игры'), { status: 404 });
function challengeTarget(code, les, body) {
  if (body.step) {
    const st = (stepOf(les, String(body.step)) || {}).step;
    if (!st || st.type !== 'play' || st.shared || !GAME_FILE.test(st.game || '')) throw notFound();
    return { kind: 'remake', step: st.id, file: st.game, version: 1, key: 'remake:' + st.id, title: remakeTitle(st.game) || st.title };
  }
  const g = body.game && store.getGame(String(body.game));
  if (!g || g.class !== code || !g.current) throw notFound();
  const version = Number(body.version) || g.current;
  if (!g.versions[version - 1]) throw notFound();
  return { kind: 'game', game: g.id, version, key: (g.shared ? 'wow:' : g.teacher ? 'demo:' : 'game:') + g.id, title: g.title || 'Игра' };
}
const cleanLine = l => (Array.isArray(l) ? l.slice(0, 600).map(x => Math.round(Number(x) || 0)) : []);
const cleanCfg = c => Object.fromEntries(Object.entries(c && typeof c === 'object' ? c : {}).filter(([, v]) => Number.isFinite(Number(v))).slice(0, 24).map(([k, v]) => [String(k).slice(0, 40), Number(v)]));
const chSrc = ch => (ch.kind === 'remake' ? `/engine/game.html?game=../${ch.file}&seed=${ch.seed}` : `/play/${ch.game}/${ch.version}?seed=${ch.seed}`);
const chLeader = ch => ch.leader || { nick: ch.nick, score: ch.score, line: ch.line || [] };
// вызов глазами ученика nick: где играть, кто лидер, призрак (линия — только для одного вызова), мой лучший и что мне с ним делать
function chPublic(code, ch, nick, withLine) {
  const all = store.scores(code + ':challenge:' + ch.code), rec = records(all, nick), lead = chLeader(ch);
  const played = !!all[nick] || ch.nick === nick;
  const status = ch.day ? 'day' : lead.nick === nick ? 'lead' : played ? 'beaten' : 'new';
  return {
    code: ch.code, nick: ch.nick, title: ch.title, score: ch.score, seed: ch.seed, version: ch.version, day: !!ch.day, at: ch.at,
    src: chSrc(ch), key: ch.key || 'game:' + ch.game, game: ch.kind === 'remake' ? null : ch.game, cfg: ch.cfg || null,
    leader: { nick: lead.nick, score: lead.score },
    ghost: lead.score > 0 ? Object.assign({ nick: lead.nick, score: lead.score }, withLine ? { line: lead.line || [] } : {}) : null,
    top: rec.top, mine: rec.mine, status,
  };
}
// вызовы класса за последние сутки: мир дня первым, потом свежие
function classChallenges(cls, nick) {
  const since = Date.now() - 864e5;
  return Object.values(store.challenges(cls.code)).filter(ch => Date.parse(ch.at) > since && (!ch.day || ch.code === cls.day))
    .sort((a, b) => Number(!!b.day) - Number(!!a.day) || Date.parse(b.at) - Date.parse(a.at)).slice(0, 12)
    .map(ch => chPublic(cls.code, ch, nick));
}
route('POST', '/api/challenge', (ctx) => {
  const { w, les } = needStudent(ctx);
  const t = challengeTarget(w.class, les, ctx.body);
  const seed = seedOf(ctx.body.seed);
  if (seed == null) throw Object.assign(new Error('Нет зерна партии — сыграй партию до конца'), { status: 400 });
  const score = Math.round(Number(ctx.body.score) || 0);
  const ch = store.createChallenge(w.class, Object.assign(t, { seed, score, nick: w.nick, cfg: cleanCfg(ctx.body.cfg), line: cleanLine(ctx.body.line) }));
  store.addScore(w.class + ':challenge:' + ch.code, w.nick, score);
  broadcast(w.class, 'challenge', { kind: 'new', code: ch.code, nick: w.nick, title: ch.title, score });
  return { code: ch.code, url: '/arcade?ch=' + ch.code, seed, version: ch.version, challenge: chPublic(w.class, ch, w.nick) };
});
route('GET', '/api/challenges', (ctx) => {
  const { w, cls } = needStudent(ctx);
  return { list: classChallenges(cls, w.nick), day: cls.day || null };
});
route('GET', '/api/challenge', (ctx) => {
  const { w } = needStudent(ctx);
  const ch = store.getChallenge(w.class, ctx.url.searchParams.get('code'));
  if (!ch) throw Object.assign(new Error('Нет такого вызова в твоём классе. Проверь код.'), { status: 404 });
  const g = ch.kind !== 'remake' && classGame(w, ch.game);
  return { challenge: chPublic(w.class, ch, w.nick, true), game: g && !g.shared && !g.teacher ? gameCard(w.class, g, w.nick) : null, records: records(store.scores(w.class + ':challenge:' + ch.code), w.nick) };
});
// мир дня: учитель даёт всему классу один мир одной из игр урока, таблица — на проекторе
function dayOptions(cls, les) {
  const out = les.checkpoints.flatMap(c => c.steps).filter(st => st.type === 'play' && !st.shared && GAME_FILE.test(st.game || ''))
    .filter((st, i, a) => a.findIndex(x => x.game === st.game) === i)
    .map(st => ({ id: 'step:' + st.id, label: 'Донор: ' + (remakeTitle(st.game) || st.title) }));
  const games = [];
  if (les.wow) { const w = wowState(cls, les); if (w.given && w.gameId) games.push([w.gameId, 'Игра класса']); }
  const d = store.getDemo(cls.code, les.id); if (d && d.gameId) games.push([d.gameId, 'Игра учителя']);
  for (const [id, what] of games) { const g = store.getGame(id); if (g && g.current) out.push({ id: 'game:' + id, label: `${what}: «${g.title || 'Игра'}»` }); }
  return out;
}
function needDayClass(ctx) {
  needTeacher(ctx);
  const cls = store.getClass(ctx.body.code || ctx.url.searchParams.get('code'));
  if (!cls) throw Object.assign(new Error('Нет класса'), { status: 404 });
  return { cls, les: lesson(cls.lesson) };
}
function dayPublic(cls) {
  const ch = cls.day && store.getChallenge(cls.code, cls.day);
  if (!ch) return null;
  const all = Object.entries(store.scores(cls.code + ':challenge:' + ch.code)).filter(([n]) => n !== ch.nick)
    .map(([nick, v]) => ({ nick, score: v.score })).sort((a, b) => b.score - a.score);
  return { code: ch.code, title: ch.title, seed: ch.seed, at: ch.at, players: all.length, top: all.slice(0, 10) };
}
route('GET', '/api/teacher/day', (ctx) => {
  const { cls, les } = needDayClass(ctx);
  return { options: dayOptions(cls, les), day: dayPublic(cls) };
});
route('POST', '/api/teacher/day', (ctx) => {
  const { cls, les } = needDayClass(ctx);
  const [kind, id] = String(ctx.body.option || '').split(':');
  if (!dayOptions(cls, les).some(o => o.id === ctx.body.option)) throw notFound();
  const t = challengeTarget(cls.code, les, kind === 'step' ? { step: id } : { game: id });
  const ch = store.createChallenge(cls.code, Object.assign(t, { seed: crypto.randomInt(1, 2 ** 31), score: 0, nick: 'Учитель', day: true, cfg: {}, line: [] }));
  cls.day = ch.code; store.saveClass(cls);
  broadcast(cls.code, 'challenge', { kind: 'day', code: ch.code, title: ch.title });
  return { day: dayPublic(cls) };
});
route('POST', '/api/teacher/day/end', (ctx) => {
  const { cls, les } = needDayClass(ctx);
  const last = dayPublic(cls);
  cls.day = null; if (last) cls.lastDay = Object.assign({ lesson: les.id }, last); // итог мира дня — на стену финала
  store.saveClass(cls);
  broadcast(cls.code, 'challenge', { kind: 'dayEnd' });
  return { last };
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
// слепая проба (шаг blindpair) по игре автора: сколько соседей захотели вернуться в сочную, в сухую или не почувствовали разницы
function blindVotes(code, g) {
  const out = { juicy: 0, dry: 0, same: 0 };
  for (const s of store.students(code)) for (const st of Object.values(s.lessons || {})) for (const a of Object.values(st.answers || {})) {
    const v = (a && a.value) || {};
    if (v.game === g.id && v.dry && v.vote && !('felt' in v)) out[v.vote === 'same' ? 'same' : v.juicy ? 'juicy' : 'dry']++;
  }
  return out.juicy + out.dry + out.same ? out : null;
}
route('GET', '/api/playtest/mine', (ctx) => {
  const { w, st } = needStudent(ctx);
  const g = st.gameId && store.getGame(st.gameId);
  return { game: g && g.current ? gameCard(w.class, g, w.nick) : null, discovery: g && g.current ? discovery(g) : null, feedback: st.feedback || null, blind: g ? blindSecret(w.class, g) : null, juice: g && g.current ? blindVotes(w.class, g) : null };
});
// слепая пара с секретом (шаг blindpair, mode: 'secret'): сколько соседей проголосовали за мою игру и сколько почувствовали секрет
function blindSecret(code, g) {
  const les = lesson(g.lesson);
  const steps = les ? les.checkpoints.flatMap(c => c.steps).filter(x => x.type === 'blindpair' && x.mode === 'secret') : [];
  let voted = 0, felt = 0;
  if (steps.length) for (const s of store.students(code)) {
    if (s.nick === g.nick) continue;
    const ans = (((s.lessons || {})[les.id] || {}).answers) || {};
    for (const x of steps) { const v = (ans[x.id] || {}).value || {}; if (v.game === g.id && v.vote) { voted++; if (v.felt) felt++; } }
  }
  return { voted, felt };
}

/* ---------- вау-старт: карты безумных идей, секрет, общая игра урока ---------- */
// Состояние живёт в классе (cls.wow) для текущего урока. Секрет и его раскрытие ученики получают только после своей догадки.
const randFrom = (list, not) => { const l = list.filter(x => x !== not); return l.length ? l[Math.floor(Math.random() * l.length)] : not; };
const cap = t => (t ? t[0].toUpperCase() + t.slice(1) : t);
// колода без повторов: карта не выпадает снова, пока класс не вытянет всю колоду; потом колода тасуется заново.
// seen — что уже выпало, по id колоды (хранится в классе, переживает перезапуск сервера)
function drawFresh(seen, id, deck, cur) {
  let used = (seen[id] || []).filter(x => deck.includes(x));
  let pool = deck.filter(x => !used.includes(x) && x !== cur);
  if (!pool.length) { used = []; pool = deck.filter(x => x !== cur); }
  const pick = pool.length ? pool[Math.floor(Math.random() * pool.length)] : cur;
  seen[id] = used.concat(pick);
  return pick;
}
const hashOf = t => [...String(t)].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
function wowState(cls, les) {
  if (!les.wow) return null;
  if (!cls.wow || cls.wow.lesson !== les.id) {
    cls.wow = { lesson: les.id, cards: {}, votes: {}, secret: randFrom(diceSecrets(cls, les).map(x => x.id)), secretBy: 'кубик', status: 'cards', gameId: null, given: false };
    store.saveClass(cls);
  }
  return cls.wow;
}
const aiSecrets = les => les.wow.secrets.filter(x => !x.fallbackOnly); // секреты для игры ИИ; fallbackOnly — только у запасной игры
// секреты для кубика и карты секрета в Фабрике: со звуком (sound) — только если учитель отметил, что в классе наушники
const diceSecrets = (cls, les) => { const all = aiSecrets(les), ok = all.filter(x => !x.sound || (cls && cls.headphones)); return ok.length ? ok : all; };
const secretOf = (les, id) => les.wow.secrets.find(x => x.id === id) || les.wow.secrets[0];
const builtSecret = (les, w) => secretOf(les, w.builtSecret || w.secret); // секрет, который лежит в собранной игре
function publicWow(cls, les) {
  const w = wowState(cls, les);
  if (!w) return null;
  const g = w.given && w.gameId ? store.getGame(w.gameId) : null;
  return {
    formula: les.wow.formula,
    cards: les.wow.cards.map(c => ({ id: c.id, label: c.label, parts: !!c.parts, text: w.cards[c.id] || null, voters: w.votes[c.id] || [] })),
    status: w.given ? 'given' : w.status,
    link: acceptedLink(w) ? { phrase: w.link.phrase, loop: w.link.loop, twist: w.link.twist, funny: w.link.funny } : null,
    game: g && g.current ? { id: g.id, version: g.current, title: g.title, knob: w.knob } : null,
  };
}
const wowChanged = (cls, les) => broadcast(cls.code, 'wow', publicWow(cls, les));
// варианты шага «Найди секрет»: настоящий секрет, два чужих из колоды и ловушка — поворот с карты (он был в замысле, значит, не секрет)
function huntOptions(cls, les, w) {
  const sec = builtSecret(les, w), h = hashOf(cls.code + sec.id);
  const others = aiSecrets(les).filter(x => x.id !== sec.id).sort((a, b) => hashOf(h + a.id) - hashOf(h + b.id)).slice(0, 2);
  const trap = w.cards.twist ? cap(w.cards.twist) : null;
  const options = [sec.title, ...others.map(x => x.title), trap].filter(Boolean).sort((a, b) => hashOf(h + a) - hashOf(h + b));
  return { options, right: sec.title, trap, secret: sec };
}
const wowSteps = les => {
  const all = les.checkpoints.flatMap(c => c.steps);
  return { on: all.find(x => x.type === 'play' && x.shared && !x.secretOff), off: all.find(x => x.type === 'play' && x.shared && x.secretOff), ab: all.find(x => x.type === 'abtest'), hunt: all.find(x => x.type === 'secret' && !x.hunt) };
};
// сводка для учителя: рекорды с секретом и без, сколько раз сработал секрет, кто угадал
function wowSummary(cls, les) {
  const S = wowSteps(les);
  const rows = store.students(cls.code).map(s => {
    const st = (s.lessons || {})[les.id] || { answers: {} };
    const A = step => (step && st.answers[step.id] && st.answers[step.id].value) || {};
    // слепой тест А/Б: «с секретом» — копия, где он работал; иначе — партии шагов play с секретом и без
    const ab = A(S.ab), on = ab.A ? ab[ab.side] : A(S.on), off = ab.A ? ab[ab.side === 'A' ? 'B' : 'A'] : A(S.off), g = A(S.hunt);
    return { nick: s.nick, onRounds: on.rounds || 0, onBest: on.best || 0, hits: on.secret || 0, offRounds: off.rounds || 0, offBest: off.best || 0, guess: g.guess || null, correct: !!g.correct, trap: !!g.trap,
      vote: ab.vote || null, felt: !!ab.vote && ab.vote === ab.side };
  }).filter(r => r.onRounds || r.offRounds || r.guess);
  const avg = (list, k) => { const x = list.filter(r => r[k.replace('Best', 'Rounds')]); return x.length ? Math.round(x.reduce((n, r) => n + r[k], 0) / x.length) : 0; };
  return { rows, onAvg: avg(rows, 'onBest'), offAvg: avg(rows, 'offBest'), hits: rows.reduce((n, r) => n + r.hits, 0), guessed: rows.filter(r => r.guess).length, correct: rows.filter(r => r.correct).length, trap: rows.filter(r => r.trap).length,
    voted: rows.filter(r => r.vote).length, felt: rows.filter(r => r.felt).length };
}
function needWow(ctx) {
  needTeacher(ctx);
  const cls = store.getClass(ctx.body.code || ctx.url.searchParams.get('code'));
  if (!cls) throw Object.assign(new Error('Нет класса'), { status: 404 });
  const les = lesson(cls.lesson);
  if (!les.wow) throw Object.assign(new Error('В этом уроке нет вау-старта'), { status: 400 });
  return { cls, les, w: wowState(cls, les) };
}

route('POST', '/api/wow/vote', (ctx) => { // голос «перетянуть карту»: повторный голос снимает
  const { w: who, cls, les } = needStudent(ctx);
  const w = wowState(cls, les);
  if (!w) throw Object.assign(new Error('В этом уроке нет колоды'), { status: 400 });
  const card = les.wow.cards.find(c => c.id === ctx.body.card);
  if (!card || !w.cards[card.id] || w.status !== 'cards' || w.given) throw Object.assign(new Error('Голосовать можно, пока учитель тянет карты'), { status: 400 });
  const list = w.votes[card.id] || [];
  w.votes[card.id] = list.includes(who.nick) ? list.filter(n => n !== who.nick) : list.concat(who.nick);
  store.saveClass(cls); wowChanged(cls, les);
  return { voters: w.votes[card.id] };
});
// шаг «Найди секрет» с hunt в сценарии: варианты и ответ — из шага, игры класса не нужно
const huntStep = (les, id) => { const f = id && stepOf(les, id); return f && f.step.type === 'secret' && f.step.hunt ? f.step : null; };
route('GET', '/api/wow/hunt', (ctx) => {
  const { cls, les, st } = needStudent(ctx);
  const hs = huntStep(les, ctx.url.searchParams.get('step'));
  if (hs) return { options: hs.hunt.options, answer: (st.answers[hs.id] && st.answers[hs.id].value) || null };
  const w = wowState(cls, les);
  if (!w || !w.gameId) return { options: [] };
  const S = wowSteps(les), sum = wowSummary(cls, les);
  // сколько в классе почувствовали секрет вслепую (слепой тест А/Б) — в раскрытии секрета
  return { options: huntOptions(cls, les, w).options, answer: (S.hunt && st.answers[S.hunt.id] && st.answers[S.hunt.id].value) || null, felt: { felt: sum.felt, voted: sum.voted } };
});
route('POST', '/api/wow/guess', (ctx) => {
  const { w: who, cls, les, s, st } = needStudent(ctx);
  const hs = huntStep(les, ctx.body.step);
  if (hs) {
    const prev = st.answers[hs.id];
    if (prev && prev.value && prev.value.secret) return prev.value;
    const h = hs.hunt, guess = String(ctx.body.guess || '');
    if (!h.options.includes(guess)) throw Object.assign(new Error('Выбери один из вариантов'), { status: 400 });
    const value = { guess, correct: guess === h.right, trap: guess === h.trap, trapText: h.trapText || null, secret: { title: h.title, reveal: h.reveal, effect: h.effect || null } };
    st.answers[hs.id] = { value, done: true, at: store.now() };
    s.where = hs.id; store.saveStudent(who.class, s);
    return value;
  }
  const w = wowState(cls, les), S = wowSteps(les);
  if (!w || !w.gameId || !S.hunt) throw Object.assign(new Error('Общей игры ещё нет'), { status: 400 });
  const prev = st.answers[S.hunt.id];
  if (prev && prev.value && prev.value.secret) return prev.value;
  const H = huntOptions(cls, les, w), guess = String(ctx.body.guess || '');
  if (!H.options.includes(guess)) throw Object.assign(new Error('Выбери один из вариантов'), { status: 400 });
  const value = { guess, correct: guess === H.right, trap: guess === H.trap, secret: { title: H.secret.title, reveal: H.secret.reveal, effect: H.secret.effect } };
  st.answers[S.hunt.id] = { value, done: true, at: store.now() };
  s.where = S.hunt.id; store.saveStudent(who.class, s);
  return value;
});

route('GET', '/api/teacher/wow', (ctx) => {
  const { cls, les, w } = needWow(ctx);
  const g = w.gameId ? store.getGame(w.gameId) : null, v = g && g.versions[g.current - 1];
  return {
    wow: w, demo: ai.programmerDemo(les.id), chat: ai.manual(les.id), formula: les.wow.formula, cards: les.wow.cards.map(c => ({ id: c.id, label: c.label, parts: !!c.parts })),
    secrets: aiSecrets(les).map(x => ({ id: x.id, title: x.title, effect: x.effect, sound: !!x.sound })), secret: secretOf(les, w.secret), headphones: !!cls.headphones, built: w.gameId ? builtSecret(les, w) : null,
    game: g && v ? { id: g.id, version: g.current, title: g.title, model: v.model, warnings: v.warnings || [], fallback: !!v.fallback, attempts: v.attempts, kind: v.kind,
      playtest: v.playtest || null, from: v.from || null, before: v.from && g.versions[v.from - 1] ? g.versions[v.from - 1].playtest || null : null } : null,
    summary: wowSummary(cls, les),
  };
});
route('POST', '/api/teacher/wow/draw', (ctx) => {
  const { cls, les, w } = needWow(ctx);
  const list = ctx.body.card === 'all' ? les.wow.cards : les.wow.cards.filter(c => c.id === ctx.body.card);
  if (!list.length) throw Object.assign(new Error('Нет такой карты'), { status: 400 });
  const seen = ((cls.wowSeen = cls.wowSeen || {})[les.id] = cls.wowSeen[les.id] || {});
  for (const c of list) { w.cards[c.id] = drawFresh(seen, c.id, c.deck, w.cards[c.id]); w.votes[c.id] = []; }
  w.link = null; // новые карты — связка устарела
  if (!w.given && w.status !== 'building') w.status = 'cards';
  store.saveClass(cls); wowChanged(cls, les);
  return { wow: w };
});
route('POST', '/api/teacher/wow/secret', (ctx) => { // без id — кубик, с id — тайный выбор учителя
  const { cls, les, w } = needWow(ctx);
  if (ctx.body.id) { if (!aiSecrets(les).some(x => x.id === ctx.body.id)) throw Object.assign(new Error('Нет такого секрета'), { status: 400 }); w.secret = ctx.body.id; w.secretBy = 'учитель'; }
  else { w.secret = randFrom(diceSecrets(cls, les).map(x => x.id), w.secret); w.secretBy = 'кубик'; }
  store.saveClass(cls);
  return { secret: secretOf(les, w.secret), secretBy: w.secretBy };
});
// наушники в классе: без них секреты со звуком (sound) не выпадают кубиком и не попадают в карту секрета Фабрики.
// Сняли отметку, а кубик уже выбрал звуковой секрет — кубик перебрасывается; выбор учителя остаётся.
route('POST', '/api/teacher/wow/headphones', (ctx) => {
  const { cls, les, w } = needWow(ctx);
  cls.headphones = !!ctx.body.on;
  if (!cls.headphones && secretOf(les, w.secret).sound && w.secretBy === 'кубик') w.secret = randFrom(diceSecrets(cls, les).map(x => x.id), w.secret);
  store.saveClass(cls);
  return { headphones: cls.headphones, secret: secretOf(les, w.secret) };
});
// связка от ИИ: геймдизайнер сводит карты вау-старта в одну игру; принятая связка уходит программисту вместе с картами
const cardsKey = w => JSON.stringify(w.cards);
const acceptedLink = w => (w.link && w.link.accepted && w.link.cards === cardsKey(w) ? w.link : null);
route('POST', '/api/teacher/wow/link', (ctx) => {
  const { cls, les, w } = needWow(ctx);
  const missing = les.wow.cards.filter(c => !w.cards[c.id]);
  if (missing.length) throw Object.assign(new Error('Сначала вытяните карты: ' + missing.map(c => c.label).join(', ')), { status: 400 });
  const key = cardsKey(w), prev = w.link;
  const job = startJob(ctx.who.token, 'link', async () => {
    const link = await ai.wowLink(w.cards, prev, { class: cls.code, nick: 'учитель', lesson: les.id });
    const c2 = store.getClass(cls.code), w2 = wowState(c2, les);
    if (cardsKey(w2) !== key) throw Object.assign(new Error('Пока ИИ сводил карты, их перетянули — попросите связку ещё раз'), { status: 409 });
    w2.link = Object.assign(link, { cards: key, accepted: false, at: store.now() });
    store.saveClass(c2); wowChanged(c2, les);
    return w2.link;
  });
  return { job: job.id };
});
route('POST', '/api/teacher/wow/link/accept', (ctx) => {
  const { cls, les, w } = needWow(ctx);
  if (!w.link) throw Object.assign(new Error('Связки ещё нет'), { status: 400 });
  w.link.accepted = !!ctx.body.accepted;
  store.saveClass(cls); wowChanged(cls, les);
  return { link: w.link };
});
route('POST', '/api/teacher/wow/link/edit', (ctx) => { // учитель правит связку руками или пишет свою; сохранённая — принята
  const { cls, les, w } = needWow(ctx);
  const missing = les.wow.cards.filter(c => !w.cards[c.id]);
  if (missing.length) throw Object.assign(new Error('Сначала вытяните карты: ' + missing.map(c => c.label).join(', ')), { status: 400 });
  if (w.given || w.status === 'building') throw Object.assign(new Error('Игра уже собирается — связку не поменять'), { status: 409 });
  const src = ctx.body.link || {}, text = k => String(src[k] == null ? '' : src[k]).replace(/\s+/g, ' ').trim().slice(0, 400);
  const fields = {}; for (const [k] of ai.LINK_FIELDS) fields[k] = text(k);
  if (!fields.phrase) throw Object.assign(new Error('Нужна хотя бы фраза игры'), { status: 400 });
  const prev = w.link && w.link.cards === cardsKey(w) ? w.link : {};
  w.link = Object.assign({ model: prev.model || 'учитель' }, fields, { edited: true, cards: cardsKey(w), accepted: true, at: store.now() });
  store.saveClass(cls); wowChanged(cls, les);
  return { link: w.link };
});
// общая игра: новая версия той же игры класса; пока учитель проверяет сборку, ученики ждут
function wowGame(cls, les, w) {
  let g = w.gameId && store.getGame(w.gameId);
  if (!g) { g = store.createGame({ class: cls.code, nick: 'учитель', lesson: les.id, shared: true }); w.gameId = g.id; }
  return g;
}
function wowVersion(code, r, secretId, extra) {
  const cls = store.getClass(code), les = lesson(cls.lesson), w = wowState(cls, les);
  const g = wowGame(cls, les, w);
  store.addVersion(g, r.code, Object.assign({ kind: r.fallback ? 'запасная игра' : 'общая игра', model: r.model, attempts: r.attempts, warnings: r.warnings, demo: !!r.demo, fallback: !!r.fallback }, extra));
  const g2 = store.getGame(g.id); g2.title = (/\btitle\s*:\s*(['"`])([^'"`]{1,80})\1/.exec(r.code) || [])[2] || g2.title || 'Игра класса'; store.saveGame(g2);
  w.builtSecret = secretId; w.knob = r.knob; w.status = 'preview'; w.given = false;
  store.saveClass(cls); wowChanged(cls, les);
  return { gameId: g.id, version: g2.current, title: g2.title, warnings: r.warnings || [], fallback: !!r.fallback };
}
// бот-плейтестер: панель учителя прогоняет каждую новую версию игры класса тремя стратегиями и присылает отчёт сюда;
// по отчёту программист один раз правит игру (новая версия), и бот прогоняет её снова — учитель видит «было → стало»
const STRATS = ['idle', 'mash', 'random'];
const cleanStr = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
function cleanReport(r) {
  r = r && typeof r === 'object' ? r : {};
  const num = (v, n = 1e6) => Math.max(0, Math.min(n, Number(v) || 0));
  const results = (Array.isArray(r.results) ? r.results : []).filter(x => x && STRATS.includes(x.strategy)).slice(0, 3).map(x => ({
    strategy: x.strategy, seconds: Math.round(num(x.seconds, 600) * 10) / 10, over: !!x.over, endText: cleanStr(x.endText, 120), score: Math.round(num(x.score, 1e9)), hurts: Math.round(num(x.hurts, 999)),
    hurtsAt: (Array.isArray(x.hurtsAt) ? x.hurtsAt : []).slice(0, 10).map(t => Math.round(num(t, 600) * 10) / 10), offscreen: x.offscreen == null ? null : Math.round(num(x.offscreen, 100)),
    flat: Math.round(num(x.flat, 600)), presses: { a: Math.round(num(x.presses && x.presses.a)), b: Math.round(num(x.presses && x.presses.b)) }, error: x.error ? cleanStr(x.error, 300) : null,
    secret: Math.round(num(x.custom && x.custom._secret) * 10) / 10, // сколько раз сработал секрет (скрытый счётчик _secret)
  }));
  return { at: store.now(), seconds: Math.round(num(r.seconds, 600)), seed: Math.round(num(r.seed, 4294967295)), hero: !!r.hero, results,
    findings: (Array.isArray(r.findings) ? r.findings : []).slice(0, 12).map(f => cleanStr(f, 400)).filter(Boolean) };
}
// Бот проверяет и секрет (разбор геймдизайнера 17.10.2026): если за три партии счётчик _secret ни разу не сработал, класс не почувствует
// разницу копий А и Б. Тогда в отчёте появляется находка, и панель учителя сама отправляет программисту правку по отчёту — один раз на игру.
const SECRET_SILENT = 'Секрет ни разу не сработал за три партии бота: скрытый счётчик _secret молчит, и класс не почувствует разницу копий А и Б. Сделай секрет заметным уже в первой минуте партии при secret: 1 и вызывай lab.count(\'_secret\') каждый раз, когда он срабатывает.';
route('POST', '/api/teacher/wow/playtest', (ctx) => {
  const { les, w } = needWow(ctx);
  const g = w.gameId && store.getGame(w.gameId), n = Number(ctx.body.version), v = g && g.versions[n - 1];
  if (!v) throw Object.assign(new Error('Нет такой версии игры класса'), { status: 400 });
  v.playtest = cleanReport(ctx.body.report);
  const silent = w.knob === 'secret' && v.playtest.results.length > 0 && v.playtest.results.every(x => !x.secret && !x.error);
  if (silent) { v.playtest.secretSilent = true; v.playtest.findings.unshift(SECRET_SILENT); }
  store.saveGame(g);
  // автоправка — только если в этой игре ещё не было автоправки по секрету и ИИ доступен
  const autoFix = silent && !ai.demo() && !ai.manual(les.id) && !w.given && !g.versions.some(x => x.autoFix);
  return { playtest: v.playtest, autoFix };
});
route('POST', '/api/teacher/wow/playtest-fix', (ctx) => {
  const { cls, les, w } = needWow(ctx);
  if (ai.programmerDemo(les.id)) throw Object.assign(new Error('Без ключа ИИ программист не правит игру — попробуйте с ключом'), { status: 400 });
  if (w.status === 'building' && busyJob(w.jobId)) throw Object.assign(new Error('Игра уже собирается'), { status: 409 });
  if (w.given) throw Object.assign(new Error('Игра уже у класса — сначала заберите её'), { status: 409 });
  const g = w.gameId && store.getGame(w.gameId), n = g && g.current, v = g && g.versions[n - 1];
  if (!v || !v.playtest) throw Object.assign(new Error('Сначала дождитесь плейтеста бота'), { status: 400 });
  if (!v.playtest.findings.length) throw Object.assign(new Error('Бот не нашёл, что править'), { status: 400 });
  const code = store.versionCode(g.id, n), report = v.playtest, secretId = w.builtSecret;
  w.status = 'building'; store.saveClass(cls); wowChanged(cls, les);
  const whoAI = { class: cls.code, nick: 'учитель', lesson: les.id };
  const job = startJob(ctx.who.token, 'wow', async (progress) => {
    try {
      const r = await ai.playtestFix(code, report, { cards: w.cards, link: acceptedLink(w) }, whoAI, progress);
      return wowVersion(cls.code, Object.assign(r, { knob: w.knob }), secretId, { kind: 'правка по плейтесту', from: n, autoFix: !!ctx.body.auto });
    } catch (e) {
      const c2 = store.getClass(cls.code), w2 = wowState(c2, les);
      if (w2.jobId === job.id) { w2.status = 'preview'; store.saveClass(c2); wowChanged(c2, les); } // отменённое задание не сбивает новую сборку
      throw e;
    }
  });
  w.jobId = job.id; store.saveClass(cls);
  return { job: job.id };
});
route('POST', '/api/teacher/wow/version', (ctx) => { // вернуть прошлую версию игры класса (правка по плейтесту вышла хуже)
  const { cls, les, w } = needWow(ctx);
  const g = w.gameId && store.getGame(w.gameId), n = Number(ctx.body.version);
  if (!g || !g.versions[n - 1]) throw Object.assign(new Error('Нет такой версии'), { status: 400 });
  if (w.status === 'building') throw Object.assign(new Error('Игра собирается'), { status: 409 });
  g.current = n; store.saveGame(g); wowChanged(cls, les);
  return { version: n };
});
// название игры класса — имена карт без особенностей: «Пельмень-беглец на Луне»
const cardName = t => String(t || '').split(' — ')[0];
const wowTitle = (les, w) => `${cap(cardName(w.cards.hero) || 'Герой')} ${cardName(w.cards.place)}`.trim();
route('POST', '/api/teacher/wow/build', (ctx) => {
  const { cls, les, w } = needWow(ctx);
  const missing = les.wow.cards.filter(c => !w.cards[c.id]);
  if (missing.length) throw Object.assign(new Error('Сначала вытяните карты: ' + missing.map(c => c.label).join(', ')), { status: 400 });
  if (w.status === 'building' && busyJob(w.jobId)) throw Object.assign(new Error('Игра уже собирается'), { status: 409 });
  const fb = Object.assign({}, les.wow.fallback);
  const secretId = ai.programmerDemo(les.id) ? fb.secret : w.secret; // без ключа собирается запасная игра — у неё свой секрет
  const sec = secretOf(les, secretId);
  w.status = 'building'; w.given = false; store.saveClass(cls); wowChanged(cls, les);
  const whoAI = { class: cls.code, nick: 'учитель', lesson: les.id };
  const job = startJob(ctx.who.token, 'wow', async (progress) => {
    try {
      const r = await ai.buildShared({ cards: w.cards, secret: sec.prompt, link: acceptedLink(w), title: wowTitle(les, w), fallback: fb }, whoAI, progress);
      return wowVersion(cls.code, r, secretId);
    } catch (e) {
      const c2 = store.getClass(cls.code), w2 = wowState(c2, les);
      if (w2.jobId === job.id) { w2.status = w2.gameId ? 'preview' : 'cards'; store.saveClass(c2); wowChanged(c2, les); }
      throw e;
    }
  });
  w.jobId = job.id; store.saveClass(cls);
  return { job: job.id };
});
route('POST', '/api/teacher/wow/fallback', (ctx) => {
  const { cls, les, w } = needWow(ctx);
  const fb = les.wow.fallback;
  const r = ai.demoShared({ title: wowTitle(les, w), fallback: fb }, { class: cls.code, nick: 'учитель', lesson: les.id });
  return wowVersion(cls.code, r, fb.secret);
});
route('POST', '/api/teacher/wow/give', (ctx) => {
  const { cls, les, w } = needWow(ctx);
  if (!w.gameId) throw Object.assign(new Error('Сначала соберите игру'), { status: 400 });
  w.given = ctx.body.given !== false; w.status = 'preview';
  store.saveClass(cls); wowChanged(cls, les);
  return { given: w.given };
});

/* ---------- ИИ ---------- */
// запросов на ученика за урок: общий лимит + сколько добавил учитель (aiBonus)
const aiLimit = st => ai.limits().aiCallsPerStudentPerLesson + (st.aiBonus || 0);
// расход класса на урок: рубли и вызовы модели из журнала генераций (вау-старт и сравнения учителя тоже считаются)
function spend(code, lessonId) {
  const list = store.genlog().filter(e => e.class === code && e.lesson === lessonId && !e.demo);
  return { rub: Math.round(list.reduce((n, e) => n + (e.rub || 0), 0) * 100) / 100, calls: list.length, cap: ai.limits().rublesPerLesson || 0 };
}
// programmer — сборка, правка и починка игры: в уроке с программистом в chat.qwen.ai они бесплатны и не считаются в лимит
function aiGuard(ctx, programmer) {
  const c = needStudent(ctx);
  c.whoAI = { class: c.w.class, nick: c.w.nick, lesson: c.les.id, game: c.st.gameId || undefined };
  if (programmer && ai.manual(c.les.id)) return c;
  const lim = ai.limits();
  if (c.st.aiCalls >= aiLimit(c.st)) throw Object.assign(new Error(`Лимит запросов к ИИ на урок исчерпан (${aiLimit(c.st)}). Попроси учителя добавить запросов.`), { status: 429 });
  if (lim.rublesPerLesson > 0 && spend(c.w.class, c.les.id).rub >= lim.rublesPerLesson) throw Object.assign(new Error(`Потолок расходов урока достигнут (${lim.rublesPerLesson} ₽)`), { status: 429 });
  c.st.aiCalls++; c.s.moved = store.now(); store.saveStudent(c.w.class, c.s);
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

// «Пусть поправит продюсер»: по своему разбору продюсер переписывает поля ИГРА; принять правку или нет — решает ученик (шаг igra)
route('POST', '/api/ai/producer-fix', (ctx) => {
  const pre = needStudent(ctx);
  const review = (pre.st.answers[pre.les.plan.producer] || {}).value;
  if (!review || !review.result) throw Object.assign(new Error('Сначала отдай замысел продюсеру'), { status: 400 });
  const c = aiGuard(ctx);
  const plan = buildPlan(c.les, c.st);
  const job = startJob(c.w.token, 'producer-fix', async () => Object.assign(await ai.producerFix(plan, review, c.les, c.whoAI), { before: plan.igra }));
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
// ms и rub — время и рубли всех попыток программиста для этой версии; build — id сборки, к которой относится версия (для отчёта)
function addVersion(gameId, r, info) {
  const g = store.getGame(gameId);
  const n = store.addVersion(g, r.code, Object.assign({ model: r.model, attempts: r.attempts, warnings: r.warnings, demo: !!r.demo, ms: r.ms || 0, rub: r.rub == null ? null : r.rub }, info));
  if (!g.teacher && !g.compareOf) broadcast(g.class, 'arcade', { game: gameId, author: g.nick }); // новая версия — сразу в аркаде класса
  return { gameId, version: n, game: store.getGame(gameId) };
}

route('POST', '/api/ai/build', (ctx) => {
  const c = aiGuard(ctx, true);
  const gaps = fillGaps(c.les, c.st, c.cls);
  if (gaps.count) store.saveStudent(c.w.class, c.s);
  const plan = buildPlan(c.les, c.st);
  if (!plan.igra.i && !plan.igra.r) throw Object.assign(new Error('Сначала заполни промпт ИГРА'), { status: 400 });
  const g = ensureGame(c);
  const build = store.id(8);
  const job = startJob(c.w.token, 'build', async (progress) => {
    const r = await ai.build(plan, Object.assign({}, c.whoAI, { game: g.id, build }), progress);
    // название, донор и три решения — подпись игры в аркаде класса; замысел — для сравнения моделей на том же замысле
    const g2 = store.getGame(g.id); g2.title = plan.title; g2.donor = plan.donorTitle || c.les.donor; g2.decisions = plan.decisions; g2.plan = plan;
    // ручка секрета своей игры (карта секрета): по ней слепая пара выключает секрет; в демо — секрет запасной игры урока
    g2.knob = !plan.secret ? null : r.demo ? ((c.les.wow && c.les.wow.fallback && c.les.wow.fallback.knob) || null) : /\bsecret\s*:\s*\{/.test(r.code) ? 'secret' : null;
    store.saveGame(g2);
    return Object.assign(addVersion(g.id, r, { kind: 'сборка', build }), { filled: gaps.filled, filledCount: gaps.count });
  });
  return { job: job.id };
});

// лимит правок ученика на уроке — сумма полей limit шагов workshop в сценарии (урок 1 — правка 1 и правка 2 по отзывам соседей);
// шаг без limit — правок без счёта; считаются удачные правки
function changeLimit(les) { const list = les.checkpoints.flatMap(cp => cp.steps).filter(s => s.type === 'workshop'); return list.length && list.every(s => s.limit) ? list.reduce((n, s) => n + s.limit, 0) : 0; }
route('POST', '/api/ai/change', (ctx) => {
  const pre = needStudent(ctx);
  const request = String(ctx.body.request || '').trim().slice(0, 1200);
  if (!request) throw Object.assign(new Error('Напиши одну просьбу'), { status: 400 });
  const g = pre.st.gameId && store.getGame(pre.st.gameId);
  if (!g || !g.current) throw Object.assign(new Error('Сначала собери игру'), { status: 400 });
  const limit = changeLimit(pre.les);
  if (limit && g.versions.filter(x => x.kind === 'правка').length >= limit) throw Object.assign(new Error(limit === 1 ? 'На этом уроке одна правка, она уже сделана' : `На этом уроке правок не больше ${limit}`), { status: 429 });
  const c = aiGuard(ctx, true);
  const base = g.current, code = store.versionCode(g.id, base);
  const job = startJob(c.w.token, 'change', async (progress) => addVersion(g.id, await ai.change(code, request, c.whoAI, progress), { kind: 'правка', request, from: base }));
  return { job: job.id };
});

route('POST', '/api/ai/fix', (ctx) => {
  const c = aiGuard(ctx, true);
  const g = c.st.gameId && store.getGame(c.st.gameId);
  const n = Number(ctx.body.version);
  const code = g && store.versionCode(g.id, n);
  if (!code) throw Object.assign(new Error('Нет такой версии'), { status: 400 });
  const err = ctx.body.error || {};
  const v = g.versions[n - 1]; v.error = { phase: err.phase, message: String(err.message || '').slice(0, 500), line: err.line || null }; store.saveGame(g);
  const job = startJob(c.w.token, 'fix', async (progress) => addVersion(g.id, await ai.fix(code, err, Object.assign({}, c.whoAI, { build: v.build }), progress), { kind: 'починка', from: n, fixes: v.error.message, build: v.build || null }));
  return { job: job.id };
});
// игра запустилась в рамке (сообщение ready) — для отчёта «заработала с первой попытки»
function markRan(g, n) { const v = g && g.versions[Number(n) - 1]; if (v && !v.ran) { v.ran = store.now(); store.saveGame(g); } }
route('POST', '/api/game/ran', (ctx) => {
  const c = needStudent(ctx);
  markRan(c.st.gameId && store.getGame(c.st.gameId), ctx.body.version);
  return { ok: true };
});

route('POST', '/api/game/error', (ctx) => { // ошибка без автопочинки (лимит попыток) — для панели учителя
  const c = needStudent(ctx);
  const g = c.st.gameId && store.getGame(c.st.gameId);
  const v = g && g.versions[Number(ctx.body.version) - 1];
  if (v) { v.error = Object.assign({ message: String((ctx.body.error || {}).message || '').slice(0, 500) }, ctx.body.error || {}); store.saveGame(g); }
  return { ok: true };
});

// «Мой баланс»: ручки, которые ученик повернул в игре, становятся новой версией без ИИ.
// В конец кода дописываются числа ручек, оболочка берёт их как «Как задумано» — у соседей, в аркаде, в вызовах и у бота.
const BALANCE_MARK = '/* Лаб3D: баланс автора */';
function withBalance(code, cfg) {
  const i = code.lastIndexOf('\n' + BALANCE_MARK);
  let prev = {};
  if (i >= 0) { const m = /const b = (\{[^\n]*\});/.exec(code.slice(i)); if (m) try { prev = JSON.parse(m[1]); } catch (e) { /* старый баланс не читается — пишем новый */ } }
  const all = Object.assign(prev, cfg);
  return {
    cfg: all,
    code: (i >= 0 ? code.slice(0, i) : code.replace(/\s*$/, '')) + '\n' + BALANCE_MARK +
      '\n;(function () { const b = ' + JSON.stringify(all) + '; try { for (const k in b) if (GAME.config && GAME.config[k]) GAME.config[k].value = b[k]; } catch (e) { /* нет GAME — игра упадёт сама */ } })();\n',
  };
}
route('POST', '/api/game/balance', (ctx) => {
  const c = needStudent(ctx);
  // своя игра: текущего урока или любая своя (релиз модуля выбирает игру прошлых уроков)
  const g = store.getGame(ctx.body.game || c.st.gameId);
  if (!g || !g.current || g.nick !== c.w.nick || g.class !== c.w.class || g.teacher || g.compareOf) throw Object.assign(new Error('Сначала собери свою игру'), { status: 400 });
  const cfg = cleanCfg(ctx.body.cfg);
  if (!Object.keys(cfg).length) throw Object.assign(new Error('Поверни хотя бы одну ручку игры (Tab)'), { status: 400 });
  const base = g.current, b = withBalance(store.versionCode(g.id, base), cfg);
  const request = String(ctx.body.why || '').trim().slice(0, 300);
  return addVersion(g.id, { code: b.code, model: null, attempts: 0, ms: 0, rub: 0 }, { kind: 'баланс', from: base, cfg: b.cfg, request: request || Object.entries(cfg).map(([k, v]) => `${k} = ${v}`).join(', ') });
});

// обложка игры в аркаде — кадр холста, который оболочка присылает из рамки автора после партии; одна на игру, новая версия — новый кадр
route('POST', '/api/game/poster', (ctx) => {
  const c = needStudent(ctx);
  const g = store.getGame(ctx.body.game);
  const data = String(ctx.body.data || '');
  if (!g || g.nick !== c.w.nick || g.class !== c.w.class) throw Object.assign(new Error('Обложку ставит автор игры'), { status: 403 });
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(data);
  if (!m || m[1].length > 600000) throw Object.assign(new Error('Обложка — кадр JPEG до 450 КБ'), { status: 400 });
  fs.writeFileSync(path.join(store.gameDir(g.id), 'poster.jpg'), Buffer.from(m[1], 'base64'));
  g.poster = { version: Number(ctx.body.version) || g.current, at: store.now() }; store.saveGame(g);
  if (!g.teacher && !g.compareOf) broadcast(g.class, 'arcade', { game: g.id, author: g.nick });
  return { ok: true, poster: `/poster/${g.id}.jpg?v=${g.poster.version}` };
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
  const m = job.state === 'waiting' && job.manual;
  return { state: job.state, kind: job.kind, seconds: Math.round((Date.now() - job.started) / 1000), chars: job.chars, phase: job.phase, result: job.result, error: job.error,
    manual: m ? { step: m.step, kind: m.kind, url: m.url, followUp: !!m.followUp, clear: m.clear ? m.clear.length : 0, cont: m.parts > 0, parts: m.parts, chars: m.prompt.length } : null };
});
// программист в chat.qwen.ai: текст для чата (clear=1 — задание Clear из трёх частей), вставленный ответ и отмена
function waitingJob(ctx, id) {
  const job = jobs.get(id);
  if (!job || !ctx.who || job.owner !== ctx.who.token) throw Object.assign(new Error('Задание не найдено (сервер перезапускался?)'), { status: 404 });
  if (job.state !== 'waiting') throw Object.assign(new Error('Задание уже не ждёт ответа'), { status: 409 });
  return job;
}
// Игра учителя «собирается», пока её задание ждёт ответа из чата; если учитель перезагрузил страницу, окно для ответа пропало.
// Новая сборка отменяет такое задание (и задание, потерянное при перезапуске сервера), а не отвечает «уже собирается».
function busyJob(id) {
  const j = id && jobs.get(id);
  if (j && j.state === 'waiting') { j.cancel(); return false; }
  return !!(j && j.state === 'running');
}
const CONTINUE = 'Ответ оборвался. Продолжи ровно с того места, где остановился: без повторов, без пояснений, тем же блоком кода.';
route('GET', '/api/job/prompt', (ctx) => {
  const m = waitingJob(ctx, ctx.url.searchParams.get('id')).manual;
  return { step: m.step, text: m.parts ? CONTINUE : ctx.url.searchParams.get('clear') && m.clear ? m.clear : m.prompt };
});
route('POST', '/api/job/answer', (ctx) => {
  const job = waitingJob(ctx, ctx.body.id), m = job.manual;
  const text = String(ctx.body.text || '').slice(0, 600000);
  if (!text.trim()) throw Object.assign(new Error('Вставь ответ из чата'), { status: 400 });
  const all = m.parts ? ai.joinParts(m.answer, text) : text;
  // оборванный ответ: портал просит «Продолжи» в тот же чат и склеивает части (до 4 продолжений)
  if (ai.truncated(all) && m.parts < 4) { m.answer = all; m.parts++; return { continue: true, parts: m.parts }; }
  job.answer(all);
  return { ok: true };
});
route('POST', '/api/job/cancel', (ctx) => { waitingJob(ctx, ctx.body.id).cancel(); return { ok: true }; });

/* ---------- учитель ---------- */
route('GET', '/api/teacher/classes', (ctx) => {
  needTeacher(ctx);
  const les = lessons().map(l => ({ id: l.id, number: l.number, title: l.title, module: l.module || 0, version: l.version || null, chat: ai.manual(l.id) }));
  // модули курса и, если есть, «Проверочные уроки» (module: 0) — для уроков-проверок из LAB_LESSONS
  const modules = MODULES.concat(les.some(l => !l.module) ? [{ number: 0, title: 'Проверочные уроки' }] : []);
  return { classes: store.classes(), lessons: les, modules };
});
// удаление класса: папка класса уезжает в data/deleted/, вернуть её можно руками
route('POST', '/api/teacher/class/delete', (ctx) => {
  needTeacher(ctx);
  if (!store.deleteClass(ctx.body.code)) throw Object.assign(new Error('Нет класса'), { status: 404 });
  return { ok: true };
});
route('POST', '/api/teacher/class', (ctx) => {
  needTeacher(ctx);
  const les = lesson(ctx.body.lesson) || lessons()[0];
  return store.createClass({ name: String(ctx.body.name || '').slice(0, 60), lesson: les.id });
});
route('POST', '/api/teacher/class/update', (ctx) => {
  needTeacher(ctx);
  const cls = store.getClass(ctx.body.code);
  if (!cls) throw Object.assign(new Error('Нет класса'), { status: 404 });
  if (ctx.body.lesson && lesson(ctx.body.lesson) && ctx.body.lesson !== cls.lesson) { cls.lesson = ctx.body.lesson; cls.opened = []; cls.timer = null; }
  if (Array.isArray(ctx.body.opened)) {
    const before = cls.opened || [];
    cls.opened = ctx.body.opened.map(String);
    // таймер чекпоинта: стартует, когда учитель открывает чекпоинт (из нескольких — первый по уроку), длительность — minutes из сценария
    const fresh = lesson(cls.lesson).checkpoints.find(c => cls.opened.includes(c.id) && !before.includes(c.id));
    if (fresh) cls.timer = { cp: fresh.id, startedAt: store.now(), minutes: fresh.minutes || 0 };
    if (!cls.opened.length) cls.timer = null;
  }
  if (typeof ctx.body.authorMode === 'boolean') cls.authorMode = ctx.body.authorMode;
  store.saveClass(cls);
  broadcast(cls.code, 'class', { opened: cls.opened, lesson: cls.lesson, authorMode: cls.authorMode, timer: cls.timer || null });
  return cls;
});
// таймер чекпоинта: заново, +минуты, другой чекпоинт, стоп
// «Сценарий учителя» правится в режиме автора и пишется в файл урока (lib/lesson-edit.js): правка сразу каноничная и уходит в репозиторий с коммитом
route('POST', '/api/teacher/script', (ctx) => {
  needTeacher(ctx);
  const les = lesson(ctx.body.lesson);
  if (!les) throw Object.assign(new Error('Нет урока'), { status: 404 });
  const file = lessonFiles.get(les.id);
  const r = lessonEdit.saveTeacherScript(file, { cp: ctx.body.cp, fields: ctx.body.fields }, loadLesson);
  return { ok: true, changed: r.changed, file: path.relative(path.join(PORTAL, '..'), file).split(path.sep).join('/') };
});
route('POST', '/api/teacher/timer', (ctx) => {
  needTeacher(ctx);
  const cls = store.getClass(ctx.body.code);
  if (!cls) throw Object.assign(new Error('Нет класса'), { status: 404 });
  const les = lesson(cls.lesson), act = ctx.body.action;
  const cp = les.checkpoints.find(c => c.id === (ctx.body.cp || (cls.timer || {}).cp)) || les.checkpoints.find(c => cls.opened.includes(c.id));
  if (act === 'stop' || !cp) cls.timer = null;
  else if (act === 'add' && cls.timer) cls.timer.minutes = Math.max(1, Math.min(180, cls.timer.minutes + (Number(ctx.body.minutes) || 2)));
  else cls.timer = { cp: cp.id, startedAt: store.now(), minutes: cp.minutes || 0 };
  store.saveClass(cls);
  broadcast(cls.code, 'class', { opened: cls.opened, lesson: cls.lesson, authorMode: cls.authorMode, timer: cls.timer || null });
  return { timer: cls.timer };
});
// стена класса на проекторе: рейтинг «ещё раз», открытия дня и «провал дня» — эксперимент, где предсказание не сбылось
route('GET', '/api/teacher/wall', (ctx) => {
  needTeacher(ctx);
  const cls = store.getClass(ctx.url.searchParams.get('code'));
  if (!cls) throw Object.assign(new Error('Нет класса'), { status: 404 });
  const les = lesson(cls.lesson), students = store.students(cls.code);
  const cards = classGames(cls.code).map(g => gameCard(cls.code, g, '')).filter(c => !c.hidden);
  const again = cards.filter(c => c.again > 0).sort((a, b) => b.again - a.again || b.plays - a.plays).slice(0, 5)
    .map(c => ({ id: c.id, title: c.title, nick: c.nick, emblem: c.emblem, again: c.again, plays: c.plays, poster: c.poster, lesson: c.lesson }));
  const steps = les.checkpoints.flatMap(cp => cp.steps);
  const fails = [];
  for (const s of students) {
    const st = (s.lessons || {})[les.id]; if (!st) continue;
    for (const x of steps.filter(y => y.type === 'experiment')) {
      const v = (answerOf(st, x.id) || {}).value || {};
      if (v.before && v.after && v.result && v.result !== 'Сбылось') fails.push({ nick: s.nick, knob: v.knob, from: v.from, to: v.to, guess: fieldText(v.guess), result: v.result, before: v.before, after: v.after, noticed: fieldText(v.noticed), at: (answerOf(st, x.id) || {}).at || '' });
    }
  }
  return { again, fails: fails.slice(-3).reverse() };
});
const STUCK_SEC = 300; // «застрял»: нет движения 5+ минут, а в открытых чекпоинтах есть недоделанные шаги
route('GET', '/api/teacher/overview', (ctx) => {
  needTeacher(ctx);
  const cls = store.getClass(ctx.url.searchParams.get('code'));
  if (!cls) throw Object.assign(new Error('Нет класса'), { status: 404 });
  const les = lesson(cls.lesson);
  const openSteps = les.checkpoints.filter(c => cls.opened.includes(c.id)).flatMap(c => c.steps.map(s => s.id));
  const on = online(cls.code), nowMs = Date.now();
  const stepsDone = {};
  const students = store.students(cls.code).map(s => {
    const st = (s.lessons || {})[les.id] || { answers: {}, aiCalls: 0 };
    const g = st.gameId ? store.getGame(st.gameId) : null;
    const fs_ = fieldStats(st);
    const last = g && g.versions[g.current - 1];
    for (const [id, a] of Object.entries(st.answers || {})) if (a.done) stepsDone[id] = (stepsDone[id] || 0) + 1;
    const left = openSteps.filter(id => !(st.answers[id] || {}).done).length;
    const idle = Math.round((nowMs - Date.parse(s.moved || s.joined || s.seen)) / 1000);
    return {
      nick: s.nick, seen: s.seen, moved: s.moved || s.joined, idle, online: on.has(s.nick), where: s.where || null,
      done: Object.values(st.answers || {}).filter(a => a.done).length, doneSteps: Object.keys(st.answers || {}).filter(id => st.answers[id].done), left, stuck: idle >= STUCK_SEC && left > 0,
      dice: fs_.dice, fields: fs_.fields, aiCalls: st.aiCalls || 0, aiLimit: aiLimit(st), aiBonus: st.aiBonus || 0,
      game: g ? { id: g.id, title: g.title, versions: g.versions.length, current: g.current, error: last && last.error ? last.error.message : null, errors: g.versions.filter(v => v.error).length, model: last && last.model, hidden: !!g.hidden } : null,
      plays: g ? store.plays(g.id).filter(p => p.type === 'over' && p.nick !== g.nick).length : 0,
      feedback: !!st.feedback, help: s.help || null,
    };
  });
  const votes = Object.fromEntries(les.checkpoints.flatMap(c => c.steps).filter(x => x.type === 'vote').map(x => [x.id, voteTally(cls.code, les, x)])); // выставка джема
  return { class: cls, lesson: les, students, stepsDone, votes, spend: spend(cls.code, les.id), limits: ai.limits(), stuckSec: STUCK_SEC, now: new Date().toISOString() };
});
// живые ответы класса для проектора (вкладка «Ответы класса»): шаги выбора полосками без имён, слепой тест А/Б и слепая пара с секретом —
// сколько почувствовали секрет. Считаются только отправленные ответы (шаг готов).
const valOf = v => (v && typeof v === 'object' ? v.text || '' : v || '');
route('GET', '/api/teacher/poll', (ctx) => {
  needTeacher(ctx);
  const cls = store.getClass(ctx.url.searchParams.get('code'));
  if (!cls) throw Object.assign(new Error('Нет класса'), { status: 404 });
  const les = lesson(cls.lesson);
  const all = store.students(cls.code).map(s => (((s.lessons || {})[les.id] || {}).answers) || {});
  const done = id => all.map(a => a[id]).filter(a => a && a.done).map(a => a.value || {});
  const steps = [];
  for (const cp of les.checkpoints) for (const x of cp.steps) {
    if (x.type === 'choice' && x.options && x.options.length) {
      const list = done(x.id), own = list.map(v => valOf(v.own).trim()).filter(Boolean);
      steps.push({ cp: cp.id, id: x.id, title: x.title, kind: 'choice', n: list.length,
        bars: x.options.map(o => ({ label: o, n: list.filter(v => (v.selected || []).includes(o)).length })).concat(own.length ? [{ label: 'Свои слова', n: own.length }] : []),
        own: own.slice(-6) });
    } else if (x.type === 'abtest' || (x.type === 'blindpair' && x.mode === 'secret')) {
      const list = done(x.id).filter(v => v.vote), felt = x.type === 'abtest' ? list.filter(v => v.vote === v.side).length : list.filter(v => v.felt).length, same = list.filter(v => v.vote === 'same').length;
      steps.push({ cp: cp.id, id: x.id, title: x.title, kind: 'secret', n: list.length,
        bars: [{ label: 'Почувствовали секрет', n: felt }, { label: 'Выбрали копию без секрета', n: list.length - felt - same }, { label: 'Разницы нет', n: same }] });
    }
  }
  return { steps };
});
// финал урока на проекторе: стена игр этого урока с рекордами, игра класса, мир дня и провал дня
route('GET', '/api/teacher/final', (ctx) => {
  needTeacher(ctx);
  const cls = store.getClass(ctx.url.searchParams.get('code'));
  if (!cls) throw Object.assign(new Error('Нет класса'), { status: 404 });
  const les = lesson(cls.lesson);
  const score = c => (c.record ? c.record.score : 0);
  const games = classGames(cls.code).filter(g => g.lesson === les.id).map(g => gameCard(cls.code, g, null)).sort((a, b) => score(b) - score(a));
  const w = les.wow && cls.wow && cls.wow.lesson === les.id ? cls.wow : null, wg = w && w.gameId && store.getGame(w.gameId);
  const fail = cls.fail && cls.fail.lesson === les.id ? cls.fail : null, fg = fail && store.getGame(fail.game);
  return {
    lesson: { id: les.id, number: les.number, title: les.title },
    games, classGame: wg && wg.current ? gameCard(cls.code, wg, null) : null,
    day: dayPublic(cls) || (cls.lastDay && cls.lastDay.lesson === les.id ? cls.lastDay : null),
    fail: fg ? Object.assign({}, fail, { title: fg.title, nick: fg.nick, versions: fg.versions.map(v => ({ n: v.n, kind: v.kind || '', error: v.error ? v.error.message : null })) }) : null,
  };
});
// провал дня: учитель выбирает игру урока (и версию) с самым смешным багом; game: null — убрать
route('POST', '/api/teacher/fail', (ctx) => {
  needTeacher(ctx);
  const cls = store.getClass(ctx.body.code);
  if (!cls) throw Object.assign(new Error('Нет класса'), { status: 404 });
  if (!ctx.body.game) { cls.fail = null; store.saveClass(cls); return { fail: null }; }
  const g = store.getGame(ctx.body.game);
  if (!g || g.class !== cls.code) throw Object.assign(new Error('Нет такой игры'), { status: 404 });
  const n = Number(ctx.body.version) || g.current;
  if (!g.versions[n - 1]) throw Object.assign(new Error('Нет такой версии'), { status: 400 });
  cls.fail = { lesson: cls.lesson, game: g.id, version: n, note: String(ctx.body.note || '').replace(/\s+/g, ' ').trim().slice(0, 200), at: store.now() };
  store.saveClass(cls);
  return { fail: cls.fail };
});
// ответы класса по уроку: таблица «ученик × шаг», разбор квизов по карточкам; выгрузка CSV — на странице учителя
route('GET', '/api/teacher/answers', (ctx) => {
  needTeacher(ctx);
  const cls = store.getClass(ctx.url.searchParams.get('code'));
  if (!cls) throw Object.assign(new Error('Нет класса'), { status: 404 });
  const les = lesson(cls.lesson);
  return Object.assign({ lesson: { id: les.id, number: les.number, title: les.title }, class: { code: cls.code, name: cls.name } },
    answers.classAnswers(les, store.students(cls.code), id => store.getGame(id)));
});
route('GET', '/api/teacher/student', (ctx) => {
  needTeacher(ctx);
  const code = ctx.url.searchParams.get('code'), nick = ctx.url.searchParams.get('nick');
  const cls = store.getClass(code), s = cls && store.getStudent(code, nick);
  if (!s) throw Object.assign(new Error('Нет ученика'), { status: 404 });
  const les = lesson(cls.lesson), st = store.lessonState(s, les.id);
  const g = st.gameId ? store.getGame(st.gameId) : null;
  const compares = g ? (g.compares || []).map(id => store.getGame(id)).filter(Boolean) : [];
  const one = answers.classAnswers(les, [s], id => store.getGame(id));
  const answerList = one.steps.filter(x => one.students[0].answers[x.id]).map(x => Object.assign({ cp: x.cpTitle, step: x.title }, one.students[0].answers[x.id]));
  return { nick, answers: st.answers, answerList, plan: ai.planText(buildPlan(les, st)), game: g, compares, discovery: g && g.current ? discovery(g) : null, feedback: st.feedback || null,
    aiCalls: st.aiCalls || 0, aiLimit: aiLimit(st), aiBonus: st.aiBonus || 0, models: ai.loadConfig().models, codeModel: ai.models().code };
});
// учитель добавляет ученику запросов к ИИ на этот урок
route('POST', '/api/teacher/student/bonus', (ctx) => {
  needTeacher(ctx);
  const cls = store.getClass(ctx.body.code), s = cls && store.getStudent(cls.code, ctx.body.nick);
  if (!s) throw Object.assign(new Error('Нет ученика'), { status: 404 });
  const st = store.lessonState(s, cls.lesson);
  st.aiBonus = Math.max(0, Math.min(500, (st.aiBonus || 0) + Math.round(Number(ctx.body.add) || 0)));
  store.saveStudent(cls.code, s);
  broadcast(cls.code, 'limits', { nick: s.nick, limit: aiLimit(st), calls: st.aiCalls || 0 });
  return { aiBonus: st.aiBonus, aiLimit: aiLimit(st), aiCalls: st.aiCalls || 0 };
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
// черновик отзыва: понятие и вопрос по телеметрии соседей, их карточкам и замыслу ученика (текстовая модель, без ключа — правила)
route('POST', '/api/teacher/feedback/draft', (ctx) => {
  needTeacher(ctx);
  const cls = store.getClass(ctx.body.code), s = cls && store.getStudent(cls.code, ctx.body.nick);
  if (!s) throw Object.assign(new Error('Нет ученика'), { status: 404 });
  const les = lesson(cls.lesson), st = store.lessonState(s, les.id);
  const g = st.gameId && store.getGame(st.gameId);
  if (!g || !g.current) throw Object.assign(new Error('У ученика ещё нет игры'), { status: 400 });
  const plan = buildPlan(les, st), fb = les.feedback || {};
  const input = { lesson: les.title, title: g.title, feeling: plan.decisions.feeling, secret: plan.secret ? plan.secret.title : '', discovery: discovery(g), blind: blindSecret(cls.code, g),
    concepts: fb.concepts || [], questions: fb.questions || [] };
  const job = startJob(ctx.who.token, 'draft', () => ai.feedbackDraft(input, { class: cls.code, nick: 'учитель', lesson: les.id }));
  return { job: job.id };
});
route('GET', '/api/teacher/arcade', (ctx) => {
  needTeacher(ctx);
  const cls = store.getClass(ctx.url.searchParams.get('code'));
  if (!cls) throw Object.assign(new Error('Нет класса'), { status: 404 });
  return { games: classGames(cls.code).map(g => Object.assign(gameCard(cls.code, g, null), { discovery: discovery(g) })) };
});

/* ---------- игры учителя: сравнение моделей и вау-старт (срез 3) ---------- */
// сравнение моделей: тот же замысел ученика (сохранён при сборке) собирает другая модель — отдельная игра, не в аркаде и не у ученика
route('POST', '/api/teacher/compare', (ctx) => {
  needTeacher(ctx);
  const cls = store.getClass(ctx.body.code), s = cls && store.getStudent(cls.code, ctx.body.nick);
  if (!s) throw Object.assign(new Error('Нет ученика'), { status: 404 });
  const les = lesson(cls.lesson), st = store.lessonState(s, les.id);
  if (ai.manual(les.id)) throw Object.assign(new Error('В этой версии урока программист работает только через chat.qwen.ai: сравнивать модели API нечем'), { status: 400 });
  const g = st.gameId && store.getGame(st.gameId);
  if (!g || !g.current) throw Object.assign(new Error('Ученик ещё не собрал игру'), { status: 400 });
  const model = String(ctx.body.model || '').trim().slice(0, 80);
  if (!model) throw Object.assign(new Error('Выберите модель'), { status: 400 });
  const plan = g.plan || buildPlan(les, st);
  const cg = store.createGame({ class: cls.code, nick: s.nick, lesson: les.id, compareOf: g.id, model, title: plan.title, donor: plan.donorTitle || les.donor });
  const g0 = store.getGame(g.id); g0.compares = (g0.compares || []).concat(cg.id); store.saveGame(g0);
  const build = store.id(8);
  const job = startJob(ctx.who.token, 'compare', async (progress) =>
    addVersion(cg.id, await ai.build(plan, { class: cls.code, nick: s.nick, lesson: les.id, game: cg.id, build }, progress, { model, kind: 'сравнение' }), { kind: 'сравнение', build }));
  return { job: job.id, game: cg.id };
});
// игры учителя (вау-старт, сравнение) чинит и отмечает «запустилась» сам учитель — из рамки на проекторе или в карточке ученика
function teacherGame(id) {
  const g = store.getGame(id);
  if (!g || (!g.teacher && !g.compareOf)) throw Object.assign(new Error('Это не игра учителя'), { status: 404 });
  return g;
}
route('POST', '/api/teacher/game/ran', (ctx) => { needTeacher(ctx); markRan(teacherGame(ctx.body.game), ctx.body.version); return { ok: true }; });
route('POST', '/api/teacher/game/fix', (ctx) => {
  needTeacher(ctx);
  const g = teacherGame(ctx.body.game), n = Number(ctx.body.version);
  const code = store.versionCode(g.id, n), v = g.versions[n - 1];
  if (!code || !v) throw Object.assign(new Error('Нет такой версии'), { status: 400 });
  const err = ctx.body.error || {};
  v.error = { phase: err.phase, message: String(err.message || '').slice(0, 500), line: err.line || null }; store.saveGame(g);
  if (ctx.body.report) return { ok: true }; // только записать ошибку (попытки починки кончились)
  const who = { class: g.class, nick: g.nick, lesson: g.lesson, game: g.id, build: v.build };
  const job = startJob(ctx.who.token, 'fix', async (progress) => {
    const r = addVersion(g.id, await ai.fix(code, err, who, progress, g.model || undefined), { kind: 'починка', from: n, fixes: v.error.message, build: v.build || null });
    if (g.teacher) demoChanged(g.class, g.lesson);
    return r;
  });
  return { job: job.id };
});

// вау-старт: учитель тянет карты колоды безумных идей (герой, место, поворот) и при всех собирает игру; через minutes она открывается у всех
const DEMO_CARDS = ['hero', 'place', 'twist'];
function demoStep(les) { for (const cp of les.checkpoints) for (const s of cp.steps) if (s.type === 'teacher-demo') return s; return null; }
function demoOf(code, lessonId) { return store.getDemo(code, lessonId) || { cards: {}, title: '', titleAuto: true, state: 'cards', open: null }; }
function demoPublic(code, lessonId, forStudent) {
  const d = demoOf(code, lessonId);
  const g = d.gameId && store.getGame(d.gameId);
  const ready = !!(g && g.current);
  const due = !!d.deadline && Date.now() >= Date.parse(d.deadline);
  const visible = ready && (d.open === true || (d.open !== false && due));
  const game = ready && (visible || !forStudent) ? { id: g.id, current: g.current, title: g.title, versions: g.versions, model: (g.versions[g.current - 1] || {}).model } : null;
  return { cards: d.cards, title: d.title, state: d.state, error: d.error || null, startedAt: d.startedAt || null, deadline: d.deadline || null, buildStartedAt: d.buildStartedAt || null, open: d.open, visible, ready, game, now: new Date().toISOString() };
}
const demoTimers = new Map();
function demoChanged(code, lessonId) {
  broadcast(code, 'demo', demoPublic(code, lessonId, true));
  const d = demoOf(code, lessonId), key = code + ':' + lessonId;
  clearTimeout(demoTimers.get(key));
  const left = d.deadline ? Date.parse(d.deadline) - Date.now() : -1;
  if (left > 0) { const t = setTimeout(() => broadcast(code, 'demo', demoPublic(code, lessonId, true)), left + 300); t.unref(); demoTimers.set(key, t); }
}
function needDemo(ctx) {
  needTeacher(ctx);
  const cls = store.getClass(ctx.body.code || ctx.url.searchParams.get('code'));
  if (!cls) throw Object.assign(new Error('Нет класса'), { status: 404 });
  const les = lesson(cls.lesson), step = demoStep(les);
  if (!step) throw Object.assign(new Error('В этом уроке нет вау-старта (шага teacher-demo)'), { status: 400 });
  return { cls, les, step, d: demoOf(cls.code, les.id) };
}
route('GET', '/api/teacher/demo', (ctx) => {
  needTeacher(ctx);
  const cls = store.getClass(ctx.url.searchParams.get('code'));
  if (!cls) throw Object.assign(new Error('Нет класса'), { status: 404 });
  const les = lesson(cls.lesson), step = demoStep(les);
  const watching = online(cls.code).size; // на связи сейчас: у них шаг teacher-demo обновится сам
  const played = step ? store.students(cls.code).filter(s => ((((s.lessons || {})[les.id] || { answers: {} }).answers[step.id] || {}).value || {}).rounds > 0).length : 0;
  return { step, demo: step ? demoPublic(cls.code, les.id, false) : null, donor: les.donor, students: store.students(cls.code).length, watching, played };
});
route('POST', '/api/teacher/demo/draw', (ctx) => {
  const { cls, les, step, d } = needDemo(ctx);
  // card: hero | place | twist | all, title — только название с кубика
  const which = ctx.body.card === 'all' ? DEMO_CARDS : DEMO_CARDS.filter(c => c === ctx.body.card);
  if (!which.length && ctx.body.card !== 'title') throw Object.assign(new Error('Какую карту тянуть?'), { status: 400 });
  const seen = d.seen = d.seen || {}, pick = (id, cur) => drawFresh(seen, id, (step.decks || {})[id] || [], cur);
  for (const c of which) d.cards[c] = pick(c, d.cards[c]);
  if (ctx.body.card === 'title') d.titleAuto = true;
  if (d.titleAuto !== false && (ctx.body.card === 'title' || !d.title)) d.title = pick('names', d.title) || d.title;
  if (!d.startedAt) { d.startedAt = store.now(); d.deadline = new Date(Date.now() + (step.minutes || 5) * 60e3).toISOString(); }
  store.saveDemo(cls.code, les.id, d); demoChanged(cls.code, les.id);
  return demoPublic(cls.code, les.id, false);
});
route('POST', '/api/teacher/demo/set', (ctx) => {
  const { cls, les, d } = needDemo(ctx);
  if (typeof ctx.body.title === 'string') { d.title = ctx.body.title.trim().slice(0, 60); d.titleAuto = !d.title; }
  for (const c of DEMO_CARDS) if (ctx.body.cards && typeof ctx.body.cards[c] === 'string') d.cards[c] = ctx.body.cards[c].trim().slice(0, 200);
  if ('open' in ctx.body) d.open = ctx.body.open === true ? true : ctx.body.open === false ? false : null;
  if (ctx.body.restartTimer) { d.startedAt = store.now(); d.deadline = new Date(Date.now() + (ctx.body.minutes || 5) * 60e3).toISOString(); }
  store.saveDemo(cls.code, les.id, d); demoChanged(cls.code, les.id);
  return demoPublic(cls.code, les.id, false);
});
route('POST', '/api/teacher/demo/reset', (ctx) => {
  const { cls, les } = needDemo(ctx);
  store.dropDemo(cls.code, les.id); demoChanged(cls.code, les.id);
  return demoPublic(cls.code, les.id, false);
});
// замысел вау-старта: формула «донор × поворот × мир» и шаблоны ИГРА из шага урока
function demoPlan(les, step, d) {
  const vars = { hero: d.cards.hero, place: d.cards.place, twist: d.cards.twist, title: d.title, donor: les.donor };
  const t = (tpl) => String(tpl || '').replace(/\{(\w+)\}/g, (_, k) => vars[k] || '—');
  const P = step.plan || {};
  return {
    title: d.title || 'Игра класса', donor: `${les.donor} — ${step.donorCard || ''}`, twist: d.cards.twist, world: d.cards.place,
    level: 'Базовый (вау-старт учителя: донор + поворот + мир с карт колоды безумных идей)', details: [`Герой: ${d.cards.hero}`],
    decisions: { feeling: t(P.feeling), honesty: t(P.honesty), choice: t(P.choice) },
    igra: { i: t(P.i), g: t(P.g), r: t(P.r), a: t(P.a) }, forks: [], diceCount: 0, fieldCount: 0,
  };
}
route('POST', '/api/teacher/demo/build', (ctx) => {
  const { cls, les, step, d } = needDemo(ctx);
  if (DEMO_CARDS.some(c => !d.cards[c])) throw Object.assign(new Error('Сначала вытяните все три карты'), { status: 400 });
  if (d.state === 'building' && busyJob(d.jobId)) throw Object.assign(new Error('Игра уже собирается'), { status: 409 });
  let g = d.gameId && store.getGame(d.gameId);
  if (!g) { g = store.createGame({ class: cls.code, nick: 'Учитель', lesson: les.id, teacher: true }); d.gameId = g.id; }
  const plan = demoPlan(les, step, d);
  d.state = 'building'; d.error = null; d.buildStartedAt = store.now();
  if (!d.startedAt) { d.startedAt = store.now(); d.deadline = new Date(Date.now() + (step.minutes || 5) * 60e3).toISOString(); }
  store.saveDemo(cls.code, les.id, d); demoChanged(cls.code, les.id);
  const build = store.id(8);
  const job = startJob(ctx.who.token, 'demo', async (progress) => {
    try {
      const r = await ai.build(plan, { class: cls.code, nick: 'учитель', lesson: les.id, game: g.id, build }, progress);
      const g2 = store.getGame(g.id); g2.title = plan.title; g2.donor = les.donor; g2.decisions = plan.decisions; g2.plan = plan; store.saveGame(g2);
      const out = addVersion(g.id, r, { kind: 'сборка', build });
      const d2 = demoOf(cls.code, les.id); d2.state = 'ready'; store.saveDemo(cls.code, les.id, d2);
      return out;
    } catch (e) {
      const d2 = demoOf(cls.code, les.id);
      if (d2.jobId === job.id) { d2.state = 'error'; d2.error = e.message; store.saveDemo(cls.code, les.id, d2); }
      throw e;
    } finally { demoChanged(cls.code, les.id); }
  });
  d.jobId = job.id; store.saveDemo(cls.code, les.id, d);
  return { job: job.id };
});
// ученик: состояние вау-старта своего урока (игра — только когда учитель её открыл или вышло время)
route('GET', '/api/demo', (ctx) => {
  const { w, les } = needStudent(ctx);
  return demoPublic(w.class, les.id, true);
});

/* ---------- ИИ: настройки, лимиты, журнал генераций и отчёт ---------- */
route('GET', '/api/teacher/settings', (ctx) => {
  needTeacher(ctx);
  const c = ai.loadConfig();
  return { demo: ai.demo(), models: ai.models(), known: c.models, limits: ai.limits(), configLimits: c.limits, baseUrl: c.ai.baseUrl };
});
route('POST', '/api/teacher/settings', (ctx) => {
  needTeacher(ctx);
  const patch = {};
  if (typeof ctx.body.codeModel === 'string') patch.codeModel = ctx.body.codeModel.trim();
  if (typeof ctx.body.textModel === 'string') patch.textModel = ctx.body.textModel.trim();
  if (ctx.body.limits && typeof ctx.body.limits === 'object') { // лимиты из панели — поверх config.json
    const l = Object.assign({}, store.settings().limits || {});
    const calls = Number(ctx.body.limits.aiCallsPerStudentPerLesson), rub = Number(ctx.body.limits.rublesPerLesson);
    if (Number.isFinite(calls) && calls >= 0) l.aiCallsPerStudentPerLesson = Math.round(Math.min(1000, calls));
    if (Number.isFinite(rub) && rub >= 0) l.rublesPerLesson = Math.round(Math.min(1e5, rub) * 100) / 100;
    patch.limits = l;
  }
  store.saveSettings(patch);
  return { models: ai.models(), limits: ai.limits() };
});
route('GET', '/api/teacher/models', async (ctx) => { needTeacher(ctx); return { ids: await ai.listModels() }; });

// Отчёт проверки главного допущения: одна строка — одна собранная игра (сборка, сравнение или вау-старт) вместе с её починками.
// «С первой попытки» — сборка без починки синтаксиса, игра запустилась в рамке и не упала. Сборки, после которых игры нет, — тоже строки.
function report() {
  const rows = [], builds = new Set();
  const lessonsById = Object.fromEntries(lessons().map(l => [l.id, l]));
  for (const g of store.games()) {
    for (const v of g.versions) {
      if (!['сборка', 'сравнение'].includes(v.kind) || v.demo || v.model === 'демо') continue;
      if (v.build) builds.add(v.build);
      const chain = [v];
      for (const w of g.versions) if (w.n > chain[chain.length - 1].n && w.kind === 'починка' && w.from === chain[chain.length - 1].n) chain.push(w);
      const last = chain[chain.length - 1];
      const rubs = chain.map(x => x.rub).filter(x => x != null);
      rows.push({
        at: v.created, class: g.class, nick: g.nick, lesson: g.lesson, lessonNumber: (lessonsById[g.lesson] || {}).number || null,
        game: g.id, title: g.title || '', version: v.n, model: v.model, kind: g.teacher ? 'вау-старт' : g.compareOf ? 'сравнение' : 'сборка', compareOf: g.compareOf || null,
        syntaxFixes: chain.reduce((n, x) => n + Math.max(0, (x.attempts || 1) - 1), 0), runtimeFixes: chain.length - 1,
        ran: !!v.ran, errored: !!v.error, launched: !!v.ran || !!v.error,
        firstTry: (v.attempts || 1) === 1 && !!v.ran && !v.error, works: !!last.ran && !last.error, lastVersion: last.n,
        ms: chain.reduce((n, x) => n + (x.ms || 0), 0), rub: rubs.length ? Math.round(rubs.reduce((n, x) => n + x, 0) * 100) / 100 : null, noGame: false,
      });
    }
  }
  // сборки, которые не дали игры (программист трижды вернул код с ошибкой или модель не ответила)
  const failed = {};
  for (const e of store.genlog()) {
    if (!e.build || builds.has(e.build) || e.demo) continue;
    const f = failed[e.build] = failed[e.build] || { at: e.at, class: e.class, nick: e.nick, lesson: e.lesson, game: e.game || '', model: e.model, kind: e.kind === 'сравнение' ? 'сравнение' : 'сборка', ms: 0, rub: null, calls: 0, error: '' };
    f.ms += e.ms || 0; f.calls++; if (e.rub != null) f.rub = Math.round(((f.rub || 0) + e.rub) * 100) / 100; if (e.error) f.error = e.error;
  }
  for (const f of Object.values(failed)) rows.push(Object.assign(f, { lessonNumber: (lessonsById[f.lesson] || {}).number || null, title: '', version: null, compareOf: null, syntaxFixes: Math.max(0, f.calls - 1), runtimeFixes: 0, ran: false, errored: true, launched: true, firstTry: false, works: false, noGame: true }));
  rows.sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const byModel = {};
  for (const r of rows) {
    const m = byModel[r.model] = byModel[r.model] || { model: r.model, games: 0, launched: 0, firstTry: 0, works: 0, fixes: 0, ms: 0, rub: 0, rubGames: 0, noGame: 0 };
    m.games++; if (r.launched) m.launched++; if (r.firstTry) m.firstTry++; if (r.works) m.works++; if (r.noGame) m.noGame++;
    m.fixes += r.syntaxFixes + r.runtimeFixes; m.ms += r.ms; if (r.rub != null) { m.rub += r.rub; m.rubGames++; }
  }
  const models = Object.values(byModel).map(m => ({
    model: m.model, games: m.games, launched: m.launched, pending: m.games - m.launched, noGame: m.noGame,
    firstTryShare: m.launched ? Math.round(100 * m.firstTry / m.launched) / 100 : null, worksShare: m.launched ? Math.round(100 * m.works / m.launched) / 100 : null,
    avgFixes: Math.round(10 * m.fixes / m.games) / 10, avgSec: Math.round(m.ms / m.games / 1000), avgRub: m.rubGames ? Math.round(100 * m.rub / m.rubGames) / 100 : null,
  }));
  return { rows, models };
}
// сравнения моделей: исходная игра ученика и её пересборки другими моделями — рядом
function comparisons(rows) {
  const out = [];
  for (const r of rows.filter(x => x.compareOf)) {
    let o = out.find(x => x.game === r.compareOf);
    if (!o) { const base = rows.find(x => x.game === r.compareOf && x.kind === 'сборка'); o = { game: r.compareOf, title: r.title, nick: r.nick, base: base || null, others: [] }; out.push(o); }
    o.others.push(r);
  }
  return out;
}
route('GET', '/api/teacher/genlog', (ctx) => {
  needTeacher(ctx);
  const all = store.genlog();
  const real = all.filter(e => !e.demo);
  const sum = (arr, k) => arr.reduce((n, e) => n + (e[k] || 0), 0);
  const byModel = {};
  for (const e of real) {
    const m = byModel[e.model] = byModel[e.model] || { model: e.model, calls: 0, ok: 0, ms: 0, rub: 0, tokensIn: 0, tokensOut: 0, tokensCached: 0 };
    m.calls++; if (e.ok) m.ok++; m.ms += e.ms || 0; m.rub += e.rub || 0; m.tokensIn += e.tokensIn || 0; m.tokensOut += e.tokensOut || 0; m.tokensCached += e.tokensCached || 0;
  }
  const rep = report();
  return { total: { calls: real.length, rub: Math.round(sum(real, 'rub') * 100) / 100, demo: all.length - real.length, games: rep.rows.length }, byModel: Object.values(byModel), report: rep.models, comparisons: comparisons(rep.rows), last: all.slice(-40).reverse() };
});
// CSV для Excel: разделитель «;», UTF-8 с BOM. kind=games — по играм (отчёт), kind=calls — все вызовы модели
const csvCell = v => { const t = v == null ? '' : typeof v === 'boolean' ? (v ? 'да' : 'нет') : String(v); return /[";\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
const csv = (head, rows) => '﻿' + [head.map(h => h[0])].concat(rows.map(r => head.map(h => typeof h[1] === 'function' ? h[1](r) : r[h[1]]))).map(r => r.map(csvCell).join(';')).join('\r\n') + '\r\n';
const num = x => (x == null ? '' : String(x).replace('.', ','));
route('GET', '/api/teacher/report.csv', (ctx) => {
  needTeacher(ctx);
  const kind = ctx.url.searchParams.get('kind') === 'calls' ? 'calls' : 'games';
  const date = new Date().toISOString().slice(0, 10);
  const body = kind === 'games' ? csv([
    ['Дата', r => new Date(r.at).toLocaleString('ru-RU')], ['Класс', 'class'], ['Ученик', 'nick'], ['Урок', 'lessonNumber'], ['Что', 'kind'], ['Игра', 'game'], ['Название', 'title'],
    ['Модель', 'model'], ['С первой попытки', 'firstTry'], ['Починок синтаксиса', 'syntaxFixes'], ['Починок в рамке', 'runtimeFixes'], ['Ошибка в рамке', 'errored'],
    ['Запускалась', 'launched'], ['Работает', 'works'], ['Игры нет', 'noGame'], ['Секунд', r => Math.round(r.ms / 1000)], ['Рублей', r => num(r.rub)], ['Сравнение с игрой', 'compareOf'],
  ], report().rows) : csv([
    ['Дата', r => new Date(r.at).toLocaleString('ru-RU')], ['Класс', 'class'], ['Ученик', 'nick'], ['Урок', 'lesson'], ['Что', 'kind'], ['Модель', 'model'],
    ['Секунд', r => num(Math.round((r.ms || 0) / 100) / 10)], ['Токены вход', 'tokensIn'], ['Токены выход', 'tokensOut'], ['Из кэша', 'tokensCached'], ['В кэш', 'tokensCacheWrite'], ['Токены оценены', 'estimated'], ['Рублей', r => num(r.rub)],
    ['Без ошибки', 'ok'], ['Ошибка', 'error'], ['Демо', 'demo'], ['Игра', 'game'], ['Сборка', 'build'],
  ], store.genlog());
  return { raw: body, type: 'text/csv; charset=utf-8', headers: { 'Content-Disposition': `attachment; filename="genlog-${kind}-${date}.csv"` } };
});

// ответы класса для разбора: по строке на ответ ученика (kind=steps) или на карточку квиза (kind=quiz)
route('GET', '/api/teacher/answers.csv', (ctx) => {
  needTeacher(ctx);
  const cls = store.getClass(ctx.url.searchParams.get('code'));
  if (!cls) throw Object.assign(new Error('Нет класса'), { status: 404 });
  const les = lesson(cls.lesson), students = store.students(cls.code), kind = ctx.url.searchParams.get('kind') === 'quiz' ? 'quiz' : 'steps';
  let body;
  if (kind === 'steps') {
    const r = answers.classAnswers(les, students, id => store.getGame(id));
    const rows = r.students.flatMap(s => r.steps.filter(x => s.answers[x.id]).map(x => ({ nick: s.nick, cp: x.cpTitle, step: x.title, type: x.type, text: s.answers[x.id].text, done: s.answers[x.id].done, at: s.answers[x.id].at })));
    body = csv([['Ученик', 'nick'], ['Чекпоинт', 'cp'], ['Шаг', 'step'], ['Тип шага', 'type'], ['Ответ', 'text'], ['Готово', 'done'], ['Когда', r => r.at ? new Date(r.at).toLocaleString('ru-RU') : '']], rows);
  } else {
    const quiz = les.checkpoints.flatMap(cp => cp.steps).filter(x => ['sort', 'rounds', 'blind', 'listen'].includes(x.type));
    const rows = students.flatMap(s => quiz.flatMap(q => ((((s.lessons || {})[les.id] || {}).answers || {})[q.id] || { value: {} }).value.picks
      ? s.lessons[les.id].answers[q.id].value.picks.map(p => Object.assign({ nick: s.nick, quiz: q.title }, p)) : []));
    body = csv([['Ученик', 'nick'], ['Квиз', 'quiz'], ['Карточка', 'text'], ['Верно', 'ok'], ['Ответил', 'chose'], ['Правильно', 'right'], ['Секунд', r => num(r.sec)]], rows);
  }
  return { raw: body, type: 'text/csv; charset=utf-8', headers: { 'Content-Disposition': `attachment; filename="otvety-${cls.code}-${les.id}-${kind}.csv"` } };
});

/* ---------- заметки автора: статус и выгрузка в Markdown ---------- */
const NOTE_STATUS = { new: 'Новые', work: 'В работе', done: 'Сделано' };
function notesWithStatus() { const st = store.noteStatus(); return store.notes().map(n => Object.assign(n, { status: st[n.id] || 'new' })).reverse(); }
route('GET', '/api/teacher/notes', (ctx) => { needTeacher(ctx); return { notes: notesWithStatus() }; });
route('POST', '/api/teacher/note/status', (ctx) => {
  needTeacher(ctx);
  const status = String(ctx.body.status);
  if (!NOTE_STATUS[status]) throw Object.assign(new Error('Статус: new, work или done'), { status: 400 });
  if (!store.notes().some(n => n.id === ctx.body.id)) throw Object.assign(new Error('Нет такой заметки'), { status: 404 });
  store.setNoteStatus(String(ctx.body.id), status);
  return { id: ctx.body.id, status };
});
function notesMarkdown(list) {
  const where = n => [n.lesson || 'портал', n.checkpoint, n.step].filter(Boolean).join(' / ');
  const out = [`# Заметки автора курса`, '', `Выгружено ${new Date().toLocaleString('ru-RU')}. Всего: ${list.length}.`];
  for (const [k, title] of Object.entries(NOTE_STATUS)) {
    const part = list.filter(n => n.status === k);
    if (!part.length) continue;
    out.push('', `## ${title} (${part.length})`, '');
    part.forEach(n => out.push(`- [${k === 'done' ? 'x' : ' '}] **${where(n)}** — ${n.text.replace(/\s*\n\s*/g, ' ')} _(${n.who}, ${new Date(n.at).toLocaleString('ru-RU')})_`));
  }
  return out.join('\n') + '\n';
}
route('GET', '/api/teacher/notes.md', (ctx) => {
  needTeacher(ctx);
  const status = ctx.url.searchParams.get('status');
  const list = notesWithStatus().filter(n => !status || n.status === status);
  return { raw: notesMarkdown(list), type: 'text/markdown; charset=utf-8', headers: { 'Content-Disposition': `attachment; filename="zametki-avtora-${new Date().toISOString().slice(0, 10)}.md"` } };
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
      const out = await fn(ctx);
      if (out && typeof out.raw === 'string') return send(res, 200, out.raw, out.type, out.headers || {}); // выгрузки CSV и Markdown
      return send(res, 200, out);
    } catch (e) {
      if (!e.status) console.error(e);
      return fail(res, e.status || 500, e.message);
    }
  }
  const dl = /^\/download\/([\w-]{6,20})\/(\d+)\.html$/.exec(p);
  if (dl) return downloadPage(res, dl[1], dl[2]);
  const m = /^\/play\/([\w-]+)\/(\d+)$/.exec(p);
  if (m) { // ?seed= — вызов «побей мой мир»: оболочка читает зерно из адреса и строит тот же мир
    const seed = url.searchParams.get('seed');
    if (seed != null && !/^\d{1,10}$/.test(seed)) return send(res, 400, 'Зерно — число', 'text/plain; charset=utf-8');
    return playPage(res, m[1], Number(m[2]));
  }
  const pm = /^\/poster\/([\w-]{6,20})\.jpg$/.exec(p);
  if (pm) return serveFile(res, path.join(store.gameDir(pm[1]), 'poster.jpg'));
  if (p.startsWith('/engine/') || p.startsWith('/games/')) return staticUnder(PORTAL, p, res, CORS);
  if (p === '/' ) return serveFile(res, path.join(PUBLIC, 'index.html'));
  if (p === '/student' || p === '/teacher' || p === '/arcade' || p === '/projector' || p === '/studio') return serveFile(res, path.join(PUBLIC, p.slice(1) + '.html'));
  return staticUnder(PUBLIC, p, res);
}

function events(req, res, url) {
  const w = who(req, url);
  const code = w && (w.class || url.searchParams.get('code'));
  if (!code || !store.getClass(code)) return fail(res, 401, 'Нужен вход');
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
  res.write('retry: 3000\n\n');
  if (!listeners.has(code)) listeners.set(code, new Set());
  res.labNick = w.role === 'student' ? w.nick : null;
  listeners.get(code).add(res);
  req.on('close', () => listeners.get(code).delete(res));
  // состояние класса сразу при подключении: пока страница грузилась или переподключалась, учитель мог открыть чекпоинт или сменить урок
  const cls = store.getClass(code);
  res.write(`event: class\ndata: ${JSON.stringify({ opened: cls.opened, lesson: cls.lesson, authorMode: cls.authorMode, timer: cls.timer || null })}\n\n`);
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
