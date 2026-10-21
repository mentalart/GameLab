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
const MODULES = require('./lessons/moduli');
const SLOVAR = require('./lessons/slovar'); // словарик по месту (С2)
const OGRANICHENIYA = require('./lessons/ogranicheniya'); // колода ограничений «Усложни мне» (А5)
const answers = require('./lib/answers');
const lessonEdit = require('./lib/lesson-edit');
const LESSON_DIRS = [path.join(PORTAL, 'lessons')].concat(process.env.LAB_LESSONS ? [path.resolve(process.env.LAB_LESSONS)] : []);
const lessonFiles = new Map(); // id урока → его файл: туда пишется правка «Сценария учителя» из панели
function loadLesson(file) { delete require.cache[require.resolve(file)]; return require(file); }
function lessons() {
  return LESSON_DIRS.flatMap(dir => { try { return fs.readdirSync(dir).filter(f => /^urok-\d+\.js$/.test(f)).map(f => path.join(dir, f)); } catch (e) { return []; } })
    .map(file => { const l = loadLesson(file); lessonFiles.set(l.id, file); return l; }).sort((a, b) => a.number - b.number || a.id.localeCompare(b.id));
}
// ученику — урок без колоды спрятанных механик: какая спрятанная механика в игре класса, он узнаёт только после своей догадки
// и без ответа шага «Найди спрятанную механику» с hunt в сценарии: правильный вариант, ловушка и раскрытие приходят после догадки
// format (Г2 аудита): 'detektiv' — два графика партий (graphs), найди разницу; 'recept' — приёмы рецепта, один лишний; lead — строка над вопросом;
// 'petlya' — видео-петля: сцена anim крутит запись партии; 'sabotazh' — учитель тайно поворачивает ручку на проекторе (lib/klass.js), wait — строка до начала
const publicHunt = h => ({ question: h.question, options: h.options, compare: h.compare, after: h.after, format: h.format, graphs: h.graphs, lead: h.lead, anim: h.anim, wait: h.wait });
// Поле Фабрики с secrets: true — карта спрятанной механики своей игры: колода — названия спрятанных механик урока (со звуком — только при наушниках).
// Сценарий учителя у чекпоинта (teacher) ученику не нужен.
// Вопрос слепого теста по эффекту спрятанной механики (questions: { эффект: вопрос }, К4 19.10.2026): у abtest — эффект спрятанной механики игры класса;
// blindpair берёт вопрос по эффекту игры соседа (effect в карточке игры), поэтому получает всю карту questions.
const secretEffect = (les, title) => { const d = les.wow && les.wow.secrets.find(x => x.id === title || x.title === title); return d ? d.effect || '' : ''; };
// словарик урока: слова из lessons/slovar.js с примерами этого урока (С2)
const glossaryOf = les => Object.entries(les.glossary || {}).filter(([id]) => SLOVAR[id]).map(([id, example]) => Object.assign({ id, example }, SLOVAR[id]));
function studentLesson(les, cls) {
  const step = s => {
    if (s.teacher) { s = Object.assign({}, s); delete s.teacher; } // сценарий учителя по шагам ученику не уходит
    if (s.hunt) return Object.assign({}, s, { hunt: publicHunt(s.hunt) });
    // театр сцены (В5): ответ на «что изменится?» ученик увидит только после того, как учитель включит переключатель на проекторе
    if (s.type === 'motion' && s.scenes.some(sc => (sc.toggles || []).some(x => x.vote))) return Object.assign({}, s, { scenes: s.scenes.map(sc => (sc.toggles ? Object.assign({}, sc, { toggles: sc.toggles.map(x => (x.vote ? Object.assign({}, x, { vote: { q: x.vote.q, options: x.vote.options } }) : x)) }) : sc)) });
    if (s.type === 'abtest' && s.questions) { const q = s.questions[secretEffect(les, les.wow && les.wow.classSecret)]; const o = Object.assign({}, s, { question: q || s.question }); delete o.questions; return o; }
    if (s.type === 'factory' && les.wow && s.fields.some(f => f.secrets)) return Object.assign({}, s, { fields: s.fields.map(f => (f.secrets ? Object.assign({}, f, { deck: diceSecrets(cls, les).map(x => x.title) }) : f)) });
    return s;
  };
  const out = Object.assign({}, les, { checkpoints: les.checkpoints.map(cp => { const c = Object.assign({}, cp, { steps: cp.steps.map(step) }); delete c.teacher; return c; }) });
  if (les.wow) out.wow = { formula: les.wow.formula, ask: les.wow.ask || null, look: les.wow.look || null, cards: les.wow.cards.map(cardMeta) };
  if (les.glossary) out.glossary = glossaryOf(les);
  if (les.checkpoints.some(cp => cp.steps.some(s => s.type === 'samootsenka'))) out.rost = { skills: ROST_SKILLS, scale: ROST_SCALE }; // самооценка модуля (А4)
  if (les.checkpoints.some(cp => cp.steps.some(s => s.type === 'factory'))) out.limitDeck = OGRANICHENIYA.map(c => ({ id: c.id, text: c.text })); // «🃏 Усложни мне» в Фабрике
  return out;
}
// urok-01-v2 — прежняя версия 2 урока 1 (Qwen в чате, 18.10.2026): теперь это и есть урок 1, классы с ней открывают его
const LESSON_ALIAS = { 'urok-01-v2': 'urok-01' };
function lesson(id) { id = LESSON_ALIAS[id] || id; return lessons().find(l => l.id === id) || null; }
function stepOf(les, stepId) { for (const cp of les.checkpoints) for (const s of cp.steps) if (s.id === stepId) return { cp, step: s }; return null; }

/* ---------------- задания ИИ (идут долго, клиент опрашивает) ---------------- */
const jobs = new Map();
// Программист — Qwen в чате chat.qwen.ai: задание ждёт человека в состоянии waiting — progress.ask выдаёт
// текст для чата, страница показывает окно «скопируй → вставь ответ», ответ приходит в /api/job/answer, и задание идёт дальше.
// LAB_CHAT_AUTO — модуль подставного Qwen для проверок (tools/mock-ai.js, chatAnswer): ответ вставляется сам.
const autoChat = () => (process.env.LAB_CHAT_AUTO ? require(path.resolve(process.env.LAB_CHAT_AUTO)).chatAnswer : null);
function startJob(owner, kind, fn) {
  const job = { id: store.id(12), owner, kind, state: 'running', started: Date.now(), chars: 0, phase: '', result: null, error: null };
  jobs.set(job.id, job);
  const progress = (chars, phase) => { job.chars = chars; if (phase) job.phase = phase; };
  progress.ask = q => new Promise((resolve, reject) => {
    job.state = 'waiting';
    job.manual = Object.assign({ step: ((job.manual && job.manual.step) || 0) + 1, answer: '', parts: 0, since: Date.now() }, q);
    job.answer = text => { job.state = 'running'; job.manual.done = true; resolve(text); };
    job.cancel = () => { job.state = 'running'; reject(new Error('Отменено: ответ из чата не вставлен')); };
    const auto = autoChat();
    if (auto) setTimeout(() => { if (job.answer) job.answer(String(auto(job.manual))); }, 30);
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
  // карта колоды ограничений («🃏 Усложни мне», А5): действует только на уровне «Босс» — вызов, который автор принял сам
  const limit = fac.level === 'boss' && fac.limit ? OGRANICHENIYA.find(c => c.id === fac.limit.id) : null;
  if (limit) details.push(`Карта ограничения (уровень «Босс», автор принял вызов): «${limit.text}». ${limit.qwen} Соблюдай строго, но механику донора не ломай.`);
  const dec = (A(P.decisions).fields) || {}, igra = (A(P.igra).fields) || {};
  const prod = A(P.producer);
  const forks = ((prod.result && prod.result.forks) || []).map((f, i) => ({ question: f.question, answer: (prod.choices || {})[i] })).filter(f => f.answer);
  const all = [facFields, dec, igra].flatMap(o => Object.values(o));
  // карта спрятанной механики (поле secret Фабрики): спрятанная механика из колоды урока — её задание программисту, свои слова — как есть
  const secText = fieldText(facFields.secret), secDef = secText && les.wow ? les.wow.secrets.find(x => x.title === secText) : null;
  return {
    title: fieldText(facFields.title) || 'Моя игра',
    donor: chosen ? `${chosen.title} — ${chosen.text} ${chosen.rules || ''}`.trim() : `${les.donor} — ${facStep.donorCard ? facStep.donorCard.text : ''}`,
    donorTitle: chosen ? chosen.title : les.donor,
    twist: fieldText(facFields.twist), world: fieldText(facFields.world),
    secret: secText ? { title: secText, prompt: secDef ? secDef.prompt : secText, base: secDef ? secDef.base || null : null, howto: secDef ? secDef.howto || null : null } : null,
    level: `${level.label} (${level.hint})`, details, limit: limit ? limit.text : '',
    levels: les.levels || null, // модуль 4: уровни как данные — раздел levels задания Qwen
    proekt: les.proekt || null, // модуль 8: этап итогового проекта — раздел proekt задания Qwen (серый прототип, вертикальный срез)
    player: les.player || null, // модуль 6: игрок в центре — раздел player задания Qwen (загадка дня, обучение и доступность, пресеты «Злая» и «Честная»)
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
    for (const [k, id] of Object.entries(P.vars || {})) vars[k] = ((st.answers[id] || {}).value || {}).line || ''; // модуль 3: {curve} — кривая сложности, {table} — таблица баланса
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
// игры работают в рамке без своего происхождения (sandbox без allow-same-origin): модулям three.js и оболочки нужен CORS
const CORS = { 'Access-Control-Allow-Origin': '*' };

// Игра-страница из чата (урок 1, версия 2) — без оболочки Лаб3D: мост engine/portal.js даёт ей объект portal
// (ручки и их панель, конец партии и рекорды, счётчики, ошибки со строкой). Вставляется первым в <head> без перевода строки:
// номера строк ошибок совпадают с кодом из чата. В скачанной игре мост — внутри файла.
const bridgeTag = inline => inline ? inlineScript(fs.readFileSync(path.join(PORTAL, 'engine', 'portal.js'), 'utf8')) : '<script src="/engine/portal.js"></script>';
const htmlGame = (code, inline) => (/<head[^>]*>/i.test(code) ? code.replace(/<head[^>]*>/i, m => m + bridgeTag(inline)) : code.replace(/<html[^>]*>/i, m => m + bridgeTag(inline)));
// three.js из чата Qwen берётся с CDN (unpkg, jsdelivr, esm.sh): в портале — своя копия из engine/vendor, иначе без интернета нет 3D.
// Замена внутри строки, переносы не меняются: номера строк ошибок совпадают с кодом из чата.
const CDN_THREE = /https?:\/\/(?:unpkg\.com|cdn\.jsdelivr\.net\/npm|esm\.sh|cdn\.skypack\.dev)\/three(?:@[\w.\-^~]+)?(\/build\/three\.module(?:\.min)?\.js|\/examples\/jsm\/|\/addons\/|(?=["'`]))/g;
const localThree = code => code.replace(CDN_THREE, (all, tail) => tail.startsWith('/build/') || !tail ? '/engine/vendor/three/three.module.min.js' : '/engine/vendor/three/addons/');
// уровни гостей, которые автор принял в игру (урок 18): игра получает их после своих, как будто они в её коде (portal.levels / lab.levels)
const guestScript = g => (g && Array.isArray(g.guestLevels) && g.guestLevels.length
  ? '<script>window.__labGuest=' + JSON.stringify({ mode: 'add', list: g.guestLevels.map(x => ({ name: x.name, map: x.map, author: x.author })) }).replace(/</g, '\\u003c') + '</script>' : '');
function playPage(res, gameId, n) {
  const g = store.getGame(gameId);
  const code = g && store.versionCode(gameId, n || g.current);
  if (!code) return send(res, 404, 'Нет такой версии игры', 'text/plain; charset=utf-8');
  // страница HTML из чата Qwen (урок 1, версия 2) — как есть, в той же песочнице; уровни гостей — в той же строке, что и мост: номера строк не сдвигаются
  if (ai.isHtml(code)) return send(res, 200, htmlGame(localThree(code)).replace('<script src="/engine/portal.js"></script>', m => guestScript(g) + m), 'text/html; charset=utf-8', Object.assign({ 'Content-Security-Policy': 'sandbox allow-scripts allow-pointer-lock' }, CORS));
  // объект GAME — в оболочке «Лаб3D» на three.js (engine/game.html)
  const html = fs.readFileSync(path.join(PORTAL, 'engine', 'game.html'), 'utf8')
    .replace('<head>', () => '<head>\n<base href="/engine/">' + guestScript(g))
    .replace('<!--GAME-->', () => '<script>\n' + code.replace(/<\/script/gi, '<\\/script') + '\n</script>'); // функцией: «$&» и «$'» в коде игры — не шаблоны замены
  // CSP sandbox: даже открытая отдельной вкладкой игра не видит данных портала (своё «пустое» происхождение)
  send(res, 200, html, 'text/html; charset=utf-8', Object.assign({ 'Content-Security-Policy': 'sandbox allow-scripts allow-pointer-lock' }, CORS));
}
// игра одним файлом: оболочка, three.js и код версии в одном .html — работает без портала и без интернета
const inlineScript = js => '<script>\n' + js.replace(/<\/script/gi, '<\\/script') + '\n</script>';
// модули оболочки и three.js для игры одним файлом: исходники с метками @@Mn@@ вместо путей импорта,
// загрузчик в странице превращает каждый модуль в blob: — без файлов, импорт-карты и интернета
let THREE_MODS = null;
function threeModules() {
  if (THREE_MODS) return THREE_MODS;
  const VENDOR = path.join(PORTAL, 'engine', 'vendor', 'three'), mods = [], ids = new Map();
  const resolve = (spec, from) => spec === 'three' ? path.join(VENDOR, 'three.module.min.js')
    : spec.startsWith('three/addons/') ? path.join(VENDOR, 'addons', spec.slice(13))
      : /^\.\.?\//.test(spec) ? path.resolve(path.dirname(from), spec) : null;
  const add = file => {
    if (ids.has(file)) return ids.get(file);
    const id = mods.length, m = { s: '' };
    ids.set(file, id); mods.push(m);
    m.s = fs.readFileSync(file, 'utf8').replace(/(\bfrom\s*|\bimport\s*\(?\s*)(['"])([^'"\n]+)\2/g, (all, pre, q, spec) => {
      const f = resolve(spec, file);
      return f && fs.existsSync(f) ? pre + q + '@@M' + add(f) + '@@' + q : all; // пути из комментариев (адреса примеров) не трогаем
    });
    return id;
  };
  add(path.join(PORTAL, 'engine', 'lab-three.js'));
  THREE_MODS = JSON.stringify(mods).replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
  return THREE_MODS;
}
const threeLoader = () => '<script>(function () { var M = ' + threeModules() + ', U = [];\n' +
  'function url(i) { if (U[i]) return U[i]; var s = M[i].s.replace(/@@M(\\d+)@@/g, function (x, d) { return url(+d); });\n' +
  'return (U[i] = URL.createObjectURL(new Blob([s], { type: \'text/javascript\' }))); }\n' +
  'var t = document.createElement(\'script\'); t.type = \'module\'; t.src = url(0); document.body.appendChild(t); })();</script>';
function downloadPage(res, gameId, n) {
  const g = store.getGame(gameId);
  const v = g && (Number(n) || g.current), code = g && store.versionCode(gameId, v);
  if (!code) return send(res, 404, 'Нет такой версии игры', 'text/plain; charset=utf-8');
  if (ai.isHtml(code)) return send(res, 200, htmlGame(code, true), 'text/html; charset=utf-8', { 'Content-Security-Policy': 'sandbox allow-scripts allow-pointer-lock', 'Content-Disposition': `attachment; filename="igra.html"; filename*=UTF-8''${encodeURIComponent((g.title || 'igra') + ' v' + v + '.html')}` });
  const html = fs.readFileSync(path.join(PORTAL, 'engine', 'game.html'), 'utf8')
    .replace(/<script type="importmap">[^<]*<\/script>\n?/, '')
    .replace('<script type="module" src="lab-three.js"></script>', '')
    .replace('<!--GAME-->', () => inlineScript(code) + '\n' + threeLoader())
    .replace('<title>Лаборатория игр</title>', () => `<title>${String(g.title || 'Моя игра').replace(/[<>&]/g, '')} · Лаборатория игр</title>`);
  const name = `${(g.title || 'igra').replace(/[\\/:*?"<>|]+/g, '').trim() || 'igra'} v${v}.html`;
  send(res, 200, html, 'text/html; charset=utf-8', { 'Content-Security-Policy': 'sandbox allow-scripts allow-pointer-lock', 'Content-Disposition': `attachment; filename="igra.html"; filename*=UTF-8''${encodeURIComponent(name)}` });
}
// решения программиста из поля notes текущей версии — для шага «Найди, где ИИ своевольничал»
// у игры-страницы из чата записи лежат в вызове portal.notes([...]) (урок 1, чекпоинт 5)
function gameNotes(code) {
  const m = /\bportal\.notes\s*\(\s*\[([\s\S]*?)\]/.exec(code || '') || /\bnotes\s*:\s*\[([\s\S]*?)\]/.exec(code || '');
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
  const tg = M7.teamGameId(w.class, w.nick, les.id); // джем: игра команды — и в уроке 28, где ученик ещё ничего не собирал
  if (tg && tg !== st.gameId && store.getGame(tg)) st.gameId = tg;
  M8.carry(s, les, st); // модуль 8: диздок урока 29 — в уроке 30 и дальше
  s.seen = store.now(); store.saveStudent(w.class, s);
  const g = st.gameId ? store.getGame(st.gameId) : null;
  const fp = failPublic(cls), failAsk = fp && fp.lesson === cls.lesson && fp.consent === 'ask' && failMembers(store.getGame(fp.game)).includes(w.nick) ? { game: fp.game, title: fp.title, version: fp.version } : null;
  return { nick: w.nick, class: { code: cls.code, name: cls.name, opened: cls.opened, authorMode: cls.authorMode, current: (cls.timer || {}).cp || null }, lesson: studentLesson(les, cls), answers: st.answers, game: g, failAsk, wow: les.wow ? publicWow(cls, les) : null, feedback: st.feedback || null, demo: ai.demo(), chat: true, aiCalls: st.aiCalls, aiLimit: aiLimit(st), prevPlan: prevPlan(s, les), help: s.help || null,
    theater: K.theaterFor(cls, w.nick), goal: K.goal(cls), live: K.live(cls.code) }; // театр сцены, цель класса, реакции (аудит, сессия 2: lib/klass.js)
});

route('POST', '/api/answer', (ctx) => {
  const { w, les, s, st } = needStudent(ctx);
  const { step, value, done } = ctx.body;
  if (!stepOf(les, step)) throw Object.assign(new Error('Нет такого шага'), { status: 400 });
  const prev = st.answers[step] || {};
  st.answers[step] = { value: value === undefined ? prev.value : value, done: done === undefined ? !!prev.done : !!done, at: store.now() };
  s.where = step; s.seen = store.now(); s.moved = store.now(); // moved — для фильтра «застряли» у учителя
  store.saveStudent(w.class, s);
  M7.fanout(w.class, w.nick, les, stepOf(les, step).step, st.answers[step]); // джем: общий замысел команды
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
    if (w.nick !== g.nick) { broadcast(w.class, 'arcade', { game: g.id, author: g.nick }); K.countPlay(w.class, w.nick, g); } // цель класса (Д2): партии в чужие игры
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
  // spots и maps — точки на картах уровней (модуль 4): где погибли и где ходили чужие игроки, для тепловой карты автора
  const spots = Array.isArray(t.spots) ? t.spots.slice(0, 420).filter(x => Array.isArray(x) && 'dws'.includes(x[0]) && Number.isFinite(Number(x[1])) && Number.isFinite(Number(x[2])))
    .map(x => [x[0], Math.round(Number(x[1]) * 10) / 10, Math.round(Number(x[2]) * 10) / 10, Math.max(0, Math.min(99, Math.round(Number(x[3]) || 0)))]) : [];
  const maps = Object.fromEntries(Object.entries(t.maps && typeof t.maps === 'object' ? t.maps : {}).slice(0, 8)
    .filter(([, m]) => m && typeof m.map === 'string').map(([k, m]) => [String(Math.max(0, Math.min(99, Math.round(Number(k) || 0)))), { name: String(m.name || '').slice(0, 40), map: m.map.slice(0, 4900) }]));
  return { time: Math.max(0, Math.round((Number(t.time) || 0) * 10) / 10), hold: nums(t.hold, btn), presses: nums(t.presses, btn), custom: nums(t.custom),
    hurts: Math.max(0, Math.min(999, Math.round(Number(t.hurts) || 0))), line: line.filter((_, i) => i % step === 0), lineStep: step, spots, maps };
}
// тепловая карта (модуль 4): по каждому уровню — карта и точки чужих партий: смерти, следы, найденные секреты.
// Уровень узнаётся по имени и карте: у сгенерированных уровней (урок 17) карта своя в каждой партии, берём самые частые
function heatOf(overs) {
  const by = new Map();
  for (const p of overs) {
    const t = p.tele || {};
    for (const [i, m] of Object.entries(t.maps || {})) {
      const key = m.name + '\n' + m.map;
      if (!by.has(key)) by.set(key, { name: m.name, map: m.map, deaths: [], trail: [], secrets: [], players: new Set(), runs: 0 });
      const h = by.get(key);
      h.players.add(p.nick); h.runs++;
      for (const sp of t.spots || []) if (String(sp[3]) === String(i)) (sp[0] === 'd' ? h.deaths : sp[0] === 's' ? h.secrets : h.trail).push([sp[1], sp[2], p.nick]);
    }
  }
  return [...by.values()].sort((a, b) => b.runs - a.runs).slice(0, 6)
    .map(h => ({ name: h.name, map: h.map, runs: h.runs, players: h.players.size, deaths: h.deaths.slice(-400), trail: h.trail.slice(-1500), secrets: h.secrets.slice(-200) }));
}
function classGame(w, id) { const g = id && store.getGame(id); return g && g.class === w.class && g.current ? g : null; }
// все собранные игры класса: по одной на ученика и урок
function classGames(code) {
  const out = [], seen = new Set(); // игра команды джема записана у каждого участника — в аркаде она одна
  for (const s of store.students(code)) for (const st of Object.values(s.lessons || {})) {
    const g = st.gameId && !seen.has(st.gameId) && store.getGame(st.gameId);
    if (g && g.current) { seen.add(g.id); out.push(g); }
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
    guests: (g.guestLevels || []).map(x => ({ code: x.code, name: x.name, author: x.author })), // уровни гостей, принятые автором (урок 18)
    team: g.team || null, members: g.members || null, // игра команды джема (модуль 7): моя у каждого участника
    hidden: !!g.hidden, mine: g.nick === viewer || (g.members || []).includes(viewer), knob: g.knob || null, effect: les && g.plan && g.plan.secret ? secretEffect(les, g.plan.secret.title) : '', emblem: (store.getStudent(code, g.nick) || {}).emblem || '',
  };
}
// игра соседа по кругу: следующий по алфавиту автор после after (по умолчанию — после меня); игры этого урока — первыми
function neighbour(cards, me, after, lessonId) {
  const pool = cards.filter(c => !c.hidden && c.nick !== me && !(c.members || []).includes(me));
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
    heat: heatOf(overs),
    laughs: laughsOf(plays), // живые реакции класса на проекторе (Д3): где смеялись
    heatMine: heatOf(store.plays(g.id).filter(p => p.nick === g.nick && p.type === 'over')), // свои партии автора: тепловая карта до первых соседей
  };
}
// «где смеялись» (Д3): реакции класса, пока игра шла в рамке на проекторе, — по 5 секунд партии, самые шумные места первыми
function laughsOf(plays) {
  const bins = new Map();
  for (const p of plays) if (p.type === 'react') for (const x of p.items || []) {
    const k = Math.floor((Number(x.sec) || 0) / 5) * 5, b = bins.get(k) || { sec: k, n: 0, emoji: {} };
    b.n++; b.emoji[x.emoji] = (b.emoji[x.emoji] || 0) + 1; bins.set(k, b);
  }
  const list = [...bins.values()];
  return { total: list.reduce((a, b) => a + b.n, 0), top: list.sort((a, b) => b.n - a.n || a.sec - b.sec).slice(0, 4).map(b => ({ sec: b.sec, n: b.n, emoji: Object.entries(b.emoji).sort((x, y) => y[1] - x[1]).map(([e, n]) => e + '×' + n).slice(0, 3) })) };
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
/* ---------- лесенка роста (А4): самооценка в конце каждого модуля — шаг samootsenka ---------- */
// Общие вопросы одинаковы для всех модулей: что я умею как геймдизайнер, по шкале 1–5. Плюс понятия модуля и одна фраза — в ответе шага.
const ROST_SKILLS = [
  { id: 'zamysel', icon: '💡', label: 'Придумать игру, в которую хочется сыграть ещё раз' },
  { id: 'pochemu', icon: '🔍', label: 'Объяснить, почему игра работает или не работает' },
  { id: 'qwen', icon: '🤖', label: 'Точно попросить ИИ и починить игру' },
  { id: 'pleytest', icon: '👥', label: 'Проверить игру на других и услышать отзыв' },
  { id: 'reliz', icon: '🏁', label: 'Довести игру до версии 1.0' },
];
const ROST_SCALE = ['пока не умею', 'с подсказкой', 'сам, но не всегда', 'уверенно', 'научу другого'];
// ступени лесенки ученика по модулям: средний балл, баллы по вопросам, понятия модуля и фраза (по одной ступени на модуль — последний ответ)
function rostOf(s) {
  const by = {};
  for (const l of lessons()) {
    const st = (s.lessons || {})[l.id]; if (!st) continue;
    for (const x of l.checkpoints.flatMap(cp => cp.steps).filter(x => x.type === 'samootsenka')) {
      const a = answerOf(st, x.id); if (!a || !a.done || !a.value || !a.value.scores) continue;
      const nums = ROST_SKILLS.map(k => Number(a.value.scores[k.id])).filter(n => n >= 1 && n <= 5);
      if (!nums.length) continue;
      const m = x.module || l.module || 0, prev = by[m];
      if (prev && prev.at > a.at) continue;
      by[m] = { module: m, lesson: l.number, title: x.moduleTitle || l.title, scores: a.value.scores, avg: Math.round(10 * nums.reduce((p, q) => p + q, 0) / nums.length) / 10,
        concepts: a.value.concepts || [], phrase: fieldText(a.value.phrase), at: a.at };
    }
  }
  return Object.values(by).sort((a, b) => a.module - b.module);
}
const rostGrowth = ladder => (ladder.length >= 2 ? Math.round(10 * (ladder[ladder.length - 1].avg - ladder[0].avg)) / 10 : null);
// одноклассники в сети — чипы «Кому объясняешь?» в шаге obyasni (Б3)
route('GET', '/api/class/peers', (ctx) => { const { w, cls } = needStudent(ctx); return { nicks: [...online(cls.code)].filter(n => n !== w.nick).sort((a, b) => a.localeCompare(b, 'ru')) }; });
route('GET', '/api/rost', (ctx) => { const { s } = needStudent(ctx); return { skills: ROST_SKILLS, scale: ROST_SCALE, ladder: rostOf(s) }; });

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
    rost: { skills: ROST_SKILLS, scale: ROST_SCALE, ladder: rostOf(s) }, // лесенка роста по модулям (А4)
    // полка открыток (И3): снимки шагов postcard по пройденным урокам
    postcards: worked.flatMap(l => l.checkpoints.flatMap(cp => cp.steps).filter(x => x.type === 'postcard').map(x => ((answerOf(s.lessons[l.id], x.id) || {}).value || {}).card)).filter(Boolean),
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
  if (!g || (g.nick !== w.nick && !(g.members || []).includes(w.nick))) throw Object.assign(new Error('Выпустить можно только свою игру'), { status: 403 });
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
/* ---------- уровни класса (модуль 4): редактор, коды уровней, пар, галерея, уровни гостей ---------- */
// Уровень — текстовая карта для игры: донора урока (ключ remake:games/x.js) или игры одноклассника (game:<id>). Урок 17 — зерно и ручки вместо карты.
// Уровень принимается, только если строитель сам его прошёл (как в Super Mario Maker): клиент присылает ход и время прохождения
// из сообщения игры clear. Пар — ходы автора (или его время, если ходов в игре нет).
const LEVEL_KINDS = { train: 'Обучающий', tricky: 'Коварный', free: 'Свой' };
function cleanMap(map) {
  const lines = String(map || '').replace(/\r/g, '').split('\n');
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  if (!lines.length || lines.length > 40 || lines.some(l => l.length > 60)) return '';
  return lines.join('\n');
}
function levelGame(w, key) {
  key = String(key || '');
  const rm = /^remake:(games\/[\w-]+\.js)$/.exec(key);
  if (rm) { const les = lessons().find(l => l.sample && l.sample.file === rm[1]); return { key, title: les ? les.donor : rm[1], author: 'донор урока', lesson: les ? les.number : null, remake: rm[1] }; }
  const g = classGame(w, (/^game:([\w-]+)$/.exec(key) || [])[1]);
  if (!g) return null;
  const les = lesson(g.lesson);
  return { key, title: g.title || 'Моя игра', author: g.nick, lesson: les ? les.number : null, game: g };
}
function levelView(lv, me) {
  const plays = Object.values(lv.plays || {}), rates = Object.values(lv.rates || {});
  const yes = k => rates.filter(r => r[k] === true).length;
  const mine = (lv.plays || {})[me] || null;
  return {
    code: lv.code, title: lv.title, kind: lv.kind, kindLabel: LEVEL_KINDS[lv.kind] || 'Свой', game: lv.game, gameTitle: lv.gameTitle, gameAuthor: lv.gameAuthor, lesson: lv.lesson,
    author: lv.author, map: lv.map || '', seed: lv.seed == null ? null : lv.seed, cfg: lv.cfg || null, par: lv.par, parTime: lv.parTime, at: lv.at,
    tried: plays.length, cleared: plays.filter(p => p.cleared).length, likes: Object.keys(lv.likes || {}).length, liked: !!(lv.likes || {})[me],
    rates: { n: rates.length, teach: yes('teach'), rhythm: yes('rhythm'), goal: yes('goal') }, myRate: (lv.rates || {})[me] || null,
    mine: lv.author === me, my: mine, accepted: !!lv.accepted,
    top: plays.filter(p => p.cleared).sort((a, b) => (a.moves == null ? 1e9 : a.moves) - (b.moves == null ? 1e9 : b.moves) || a.time - b.time).slice(0, 5).map(p => ({ nick: p.nick, moves: p.moves, time: p.time })),
  };
}
route('GET', '/api/levels', (ctx) => {
  const { w } = needStudent(ctx);
  const game = ctx.url.searchParams.get('game'), code = ctx.url.searchParams.get('code');
  let list = Object.values(store.levels(w.class));
  if (code) list = list.filter(x => x.code === String(code).trim().toUpperCase());
  if (game) list = list.filter(x => x.game === game);
  return { levels: list.sort((a, b) => (b.at > a.at ? 1 : -1)).map(x => levelView(x, w.nick)) };
});
route('POST', '/api/levels', (ctx) => {
  const { w, les } = needStudent(ctx);
  const b = ctx.body, G = levelGame(w, b.game);
  if (!G) throw Object.assign(new Error('Нет такой игры'), { status: 404 });
  const map = b.map ? cleanMap(b.map) : '';
  const seed = b.seed == null || b.seed === '' ? null : seedOf(b.seed);
  if (!map && seed == null) throw Object.assign(new Error('Пустой уровень: нарисуй карту или выбери зерно'), { status: 400 });
  if (b.map && !map) throw Object.assign(new Error('Карта слишком большая: не больше 40 строк по 60 клеток'), { status: 400 });
  const c = b.cleared && typeof b.cleared === 'object' ? b.cleared : null;
  if (!c) throw Object.assign(new Error('Сначала пройди свой уровень сам — как в Super Mario Maker'), { status: 400 });
  const title = String(b.title || '').trim().replace(/\s+/g, ' ').slice(0, 40) || 'Уровень ' + w.nick;
  const kind = LEVEL_KINDS[b.kind] ? b.kind : 'free';
  const cfg = b.cfg && typeof b.cfg === 'object' ? Object.fromEntries(Object.entries(b.cfg).slice(0, 12).filter(([, v]) => Number.isFinite(Number(v))).map(([k, v]) => [String(k).slice(0, 30), Number(v)])) : null;
  const moves = c.moves == null ? null : Math.max(0, Math.round(Number(c.moves) || 0)), time = Math.max(0, Math.round((Number(c.time) || 0) * 10) / 10);
  const lv = store.createLevel(w.class, { title, kind, game: G.key, gameTitle: G.title, gameAuthor: G.author, lesson: les.number, author: w.nick, map, seed, cfg, par: moves, parTime: time });
  lv.plays[w.nick] = { nick: w.nick, tries: 1, cleared: true, moves, time, at: store.now() };
  store.saveLevel(w.class, lv);
  broadcast(w.class, 'levels', { code: lv.code, kind: 'new', author: w.nick, game: G.key, gameAuthor: G.author });
  return { level: levelView(lv, w.nick) };
});
// партия в чужом уровне: попытка и прохождение (ходы и время — для «пройди за пар»)
route('POST', '/api/levels/play', (ctx) => {
  const { w } = needStudent(ctx);
  const lv = store.getLevel(w.class, ctx.body.code);
  if (!lv) throw Object.assign(new Error('Нет уровня с таким кодом'), { status: 404 });
  const p = lv.plays[w.nick] = Object.assign({ nick: w.nick, tries: 0, cleared: false, moves: null, time: null }, lv.plays[w.nick]);
  p.tries++; p.at = store.now();
  if (ctx.body.cleared) {
    const moves = ctx.body.moves == null ? null : Math.max(0, Math.round(Number(ctx.body.moves) || 0)), time = Math.max(0, Math.round((Number(ctx.body.time) || 0) * 10) / 10);
    const better = !p.cleared || (moves != null && (p.moves == null || moves < p.moves)) || (moves == null && time < (p.time || 1e9));
    p.cleared = true;
    if (better) { p.moves = moves; p.time = time; }
  }
  store.saveLevel(w.class, lv);
  broadcast(w.class, 'levels', { code: lv.code, kind: 'play', nick: w.nick, author: lv.author });
  const view = levelView(lv, w.nick);
  return { level: view, underPar: !!(p.cleared && lv.par != null && p.moves != null && p.moves <= lv.par) };
});
// «хочу ещё» и оценка уровня по трём вопросам (урок 18): учит ли без слов, есть ли ритм, ясна ли цель
route('POST', '/api/levels/rate', (ctx) => {
  const { w } = needStudent(ctx);
  const lv = store.getLevel(w.class, ctx.body.code);
  if (!lv) throw Object.assign(new Error('Нет уровня с таким кодом'), { status: 404 });
  if (lv.author === w.nick) throw Object.assign(new Error('Свой уровень оценивают соседи'), { status: 400 });
  if ('like' in ctx.body) { lv.likes = lv.likes || {}; if (ctx.body.like) lv.likes[w.nick] = store.now(); else delete lv.likes[w.nick]; }
  if (ctx.body.rate && typeof ctx.body.rate === 'object') {
    const r = ctx.body.rate, yn = v => (v === true || v === false ? v : null);
    lv.rates = lv.rates || {}; lv.rates[w.nick] = { teach: yn(r.teach), rhythm: yn(r.rhythm), goal: yn(r.goal), at: store.now() };
  }
  store.saveLevel(w.class, lv);
  broadcast(w.class, 'levels', { code: lv.code, kind: 'rate', nick: w.nick, author: lv.author });
  return { level: levelView(lv, w.nick) };
});
// автор игры принимает уровень гостя: он входит в игру после своих уровней (страница игры получает его в window.__labGuest)
route('POST', '/api/levels/accept', (ctx) => {
  const { w } = needStudent(ctx);
  const lv = store.getLevel(w.class, ctx.body.code);
  if (!lv || !lv.map) throw Object.assign(new Error('Нет такого уровня'), { status: 404 });
  const g = classGame(w, (/^game:([\w-]+)$/.exec(lv.game) || [])[1]);
  if (!g || g.nick !== w.nick) throw Object.assign(new Error('Принять уровень в игру может только её автор'), { status: 403 });
  g.guestLevels = (g.guestLevels || []).filter(x => x.code !== lv.code);
  if (ctx.body.on !== false) g.guestLevels.push({ code: lv.code, name: lv.title, map: lv.map, author: lv.author });
  g.guestLevels = g.guestLevels.slice(-8);
  lv.accepted = ctx.body.on !== false;
  store.saveGame(g); store.saveLevel(w.class, lv);
  broadcast(w.class, 'levels', { code: lv.code, kind: 'accept', author: lv.author, gameAuthor: g.nick });
  broadcast(w.class, 'arcade', { game: g.id, author: g.nick });
  return { level: levelView(lv, w.nick), guests: g.guestLevels.length };
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
// вызов класса на одном зерне (шаг pulse, модуль 3): сводка без лишних имён — лучшие пять, где класс разбивался, что выбирает класс.
// Видна тому, кто уже сыграл, и учителю (проектор, «Ответы класса»).
function pulseTally(code, les, step, me) {
  const rows = store.students(code).map(s => ({ nick: s.nick, v: ((((s.lessons || {})[les.id] || {}).answers || {})[step.id] || {}).value })).filter(r => r.v && r.v.rounds);
  const num = x => (typeof x === 'number' && isFinite(x) ? x : null);
  const top = rows.map(r => ({ nick: r.nick, best: Number(r.v.best) || 0, stat: step.stat ? r.v.stat : null, me: r.nick === me }))
    .sort((a, b) => (step.stat && num(b.stat) != null && num(a.stat) != null ? b.stat - a.stat : b.best - a.best)).slice(0, 5);
  let hist = null;
  if (step.series) {
    const bin = step.bin || 10, span = step.span || 120, n = Math.ceil(span / bin);
    hist = Array.from({ length: n }, (_, i) => ({ label: `${i * bin}–${(i + 1) * bin}`, n: 0 }));
    for (const r of rows) for (const t of (r.v.series || []).slice(0, 80)) { const i = Math.floor(Number(t) / bin); if (i >= 0 && i < n) hist[i].n++; else if (i >= n) hist[n - 1].n++; }
  }
  let picks = null;
  if (step.picks) {
    const count = {};
    for (const r of rows) for (const [k, c] of Object.entries(r.v.picks || {}).slice(0, 40)) count[String(k).slice(0, 40)] = (count[String(k).slice(0, 40)] || 0) + (Number(c) || 0);
    const total = Object.values(count).reduce((a, b) => a + b, 0) || 1;
    picks = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, c]) => ({ label, n: c, share: Math.round(100 * c / total) }));
  }
  return { n: rows.length, top, hist, picks };
}
route('GET', '/api/pulse', (ctx) => {
  const { w, les, st } = needStudent(ctx);
  const step = les.checkpoints.flatMap(c => c.steps).find(x => x.id === ctx.url.searchParams.get('step') && x.type === 'pulse');
  if (!step) throw Object.assign(new Error('Нет такого вызова'), { status: 404 });
  if (!((st.answers[step.id] || {}).value || {}).rounds) return { n: 0, top: [], hist: null, picks: null, hidden: true };
  return pulseTally(w.class, les, step, w.nick);
});
/* ---------- модуль 6 «Игрок в центре»: сводки класса, UX-аудит, своя игра прошлых уроков ---------- */
// день загадки (урок 23): ГГГГММДД по часам сервера — одно зерно на весь класс
const dayKey = (d = new Date()) => '' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
const DAY_NAMES = ['Завтра', 'Послезавтра'];
// автор загадки дня — по кругу среди игр урока: каждый день другой автор («Неделя загадок»)
function riddleAuthors(code, lessonId) {
  return classGames(code).filter(g => g.lesson === lessonId && !g.hidden).sort((a, b) => a.nick.localeCompare(b.nick, 'ru'));
}
function m6Tally(code, les, step, me) {
  const rows = store.students(code).map(s => ({ nick: s.nick, v: ((((s.lessons || {})[les.id] || {}).answers || {})[step.id] || {}).value || null })).filter(r => r.v);
  const mine = (rows.find(r => r.nick === me) || {}).v || {};
  if (step.type === 'setka') {
    const day = dayKey(), list = riddleAuthors(code, step.from || les.id), idx = Math.floor(Date.now() / 864e5);
    const pickA = k => { const g = list.length ? list[(idx + k) % list.length] : null; return g ? { game: g.id, version: g.current, title: g.title || 'Моя игра', nick: g.nick } : null; };
    const week = list.length > 1 ? [1, 2, 3, 4].map(k => { const d = new Date(Date.now() + k * 864e5); return { label: DAY_NAMES[k - 1] || `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`, nick: pickA(k).nick }; }) : [];
    const grids = rows.filter(r => r.v.grid && r.v.day === day).map(r => ({ nick: r.nick, grid: String(r.v.grid).slice(0, 400), solved: !!r.v.solved }));
    return { day, author: pickA(0), week, hidden: me != null && !(mine.grid && mine.day === day), grids: me != null && !(mine.grid && mine.day === day) ? [] : grids };
  }
  if (step.type === 'debate') {
    const side = key => { const ps = rows.map(r => r.v[key]).filter(p => typeof p === 'number' && p >= -2 && p <= 2); const sum = ps.reduce((a, b) => a + b, 0); return { n: ps.length, left: ps.filter(p => p < 0).length, right: ps.filter(p => p > 0).length, mid: ps.filter(p => p === 0).length, avg: ps.length ? Math.round(sum / ps.length * 10) / 10 : 0, counts: [-2, -1, 0, 1, 2].map(p => ps.filter(x => x === p).length) }; };
    const count = {};
    rows.forEach(r => ['left', 'right'].forEach(sd => ((r.v.args || {})[sd] || []).slice(0, 2).forEach(t => { if ((step.args[sd] || []).includes(t)) { const k = sd + '\n' + t; count[k] = (count[k] || 0) + 1; } })));
    const top = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => ({ side: k.split('\n')[0], text: k.split('\n')[1], n }));
    return { hidden: me != null && mine.before == null, before: side('before'), after: side('after'), top };
  }
  if (step.type === 'kodeks') {
    const count = {};
    rows.filter(r => r.v.sent).forEach(r => (r.v.picks || []).filter(t => (step.deck || []).includes(t)).concat(r.v.own ? [String(r.v.own).slice(0, 120)] : []).forEach(t => { count[t] = (count[t] || 0) + 1; }));
    const rules = Object.entries(count).sort((a, b) => b[1] - a[1] || (step.deck.indexOf(a[0]) + 1 || 99) - (step.deck.indexOf(b[0]) + 1 || 99)).map(([text, n]) => ({ text, n }));
    return { hidden: me != null && !mine.sent, n: rows.filter(r => r.v.sent).length, rules: rules.slice(0, 12), signed: rows.filter(r => r.v.signed).map(r => r.nick) };
  }
  // входы модуля 1 (Г1 аудита, сессия 3): спор — голоса за партию и причины; загадка, сломанная игра и колода — ответы по вариантам
  if (step.type === 'spor') {
    const voted = rows.filter(r => r.v.voted && r.v.pick), pick = { same: 0 }, count = {};
    step.sides.forEach(x => { pick[x.id] = 0; });
    voted.forEach(r => { if (r.v.pick in pick) pick[r.v.pick]++; (r.v.why || []).slice(0, 2).filter(t => (step.reasons || []).includes(t)).forEach(t => { count[t] = (count[t] || 0) + 1; }); });
    return { hidden: me != null && !mine.voted, n: voted.length, pick, top: Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([text, n]) => ({ text, n })) };
  }
  if (step.type === 'zagadka' || step.type === 'slomano' || step.type === 'koloda' || step.type === 'bumaga') {
    const labels = step.type === 'koloda' ? step.cards.map(c => [c.id, c.name]) : step.options.map(o => [o, o]);
    const voted = rows.filter(r => r.v.pick);
    return { hidden: me != null && !mine.pick, n: voted.length, rows: labels.map(([id, label]) => ({ label, n: voted.filter(r => r.v.pick === id).length })) };
  }
  return { hidden: true };
}
const M6_TALLY = ['setka', 'debate', 'kodeks', 'spor', 'zagadka', 'slomano', 'koloda', 'bumaga'];
route('GET', '/api/m6/tally', (ctx) => {
  const { w, les } = needStudent(ctx);
  const step = les.checkpoints.flatMap(c => c.steps).find(x => x.id === ctx.url.searchParams.get('step') && M6_TALLY.includes(x.type));
  if (!step) throw Object.assign(new Error('Нет такого шага'), { status: 404 });
  return m6Tally(w.class, les, step, w.nick);
});
// UX-аудит (урок 24): чек-лист и «думай вслух» на чужую игру — автору в «Твоя игра глазами соседей»
route('POST', '/api/m6/audit', (ctx) => {
  const { w } = needStudent(ctx);
  const g = classGame(w, ctx.body.game);
  if (!g) throw Object.assign(new Error('Нет такой игры'), { status: 404 });
  if (g.nick === w.nick) throw Object.assign(new Error('Аудит пишут на чужую игру'), { status: 400 });
  const marks = Object.fromEntries(Object.entries(ctx.body.marks && typeof ctx.body.marks === 'object' ? ctx.body.marks : {}).slice(0, 16).filter(([, x]) => typeof x === 'boolean').map(([k, x]) => [String(k).slice(0, 30), x]));
  const think = (Array.isArray(ctx.body.think) ? ctx.body.think : []).slice(0, 40).map(x => ({ e: String((x || {}).e || '').slice(0, 30), t: Math.max(0, Math.min(3600, Number((x || {}).t) || 0)) }));
  store.addPlay(g.id, { type: 'audit', nick: w.nick, marks, think, top: ctx.body.top ? String(ctx.body.top).slice(0, 30) : null, note: String(ctx.body.note || '').trim().slice(0, 200) });
  broadcast(w.class, 'arcade', { game: g.id, author: g.nick });
  return { ok: true };
});
function auditsOf(g) {
  const last = {};
  for (const p of store.plays(g.id)) if (p.type === 'audit' && p.nick !== g.nick) last[p.nick] = p;
  const list = Object.values(last), items = {}, top = {};
  list.forEach(a => { Object.entries(a.marks || {}).forEach(([k, x]) => { items[k] = items[k] || { yes: 0, n: 0 }; items[k].n++; if (x) items[k].yes++; }); if (a.top) top[a.top] = (top[a.top] || 0) + 1; });
  return { n: list.length, items, top: Object.entries(top).sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, n })),
    think: list.flatMap(a => (a.think || []).map(s => Object.assign({ nick: a.nick }, s))).sort((a, b) => a.t - b.t).slice(0, 40), notes: list.filter(a => a.note).map(a => ({ nick: a.nick, note: a.note })) };
}
route('GET', '/api/m6/audit/mine', (ctx) => {
  const { st } = needStudent(ctx);
  const g = st.gameId && store.getGame(st.gameId);
  return g && g.current ? auditsOf(g) : { n: 0, items: {}, top: [], think: [], notes: [] };
});
// своя игра прошлых уроков — в этот урок (урок 25: злая и честная версии релизной игры). Код текущей версии копируется новой версией игры урока,
// с ней работают правка, Qwen в чате, плейтест и релиз модуля. remake: true — основа из донора урока (если своих игр нет)
route('POST', '/api/game/adopt', (ctx) => {
  const c = needStudent(ctx);
  let code, meta;
  if (ctx.body.remake) {
    if (!c.les.sample || !GAME_FILE.test(c.les.sample.file)) throw Object.assign(new Error('У урока нет донора'), { status: 400 });
    code = fs.readFileSync(path.join(PORTAL, c.les.sample.file), 'utf8');
    meta = { title: (remakeTitle(c.les.sample.file) || 'Донор') + ' — моя версия', donor: c.les.donor, decisions: null, plan: null, knob: 'secret' };
  } else {
    const src = store.getGame(String(ctx.body.from || ''));
    if (!src || src.class !== c.w.class || src.nick !== c.w.nick || !src.current) throw Object.assign(new Error('Это не твоя игра'), { status: 403 });
    if (src.lesson === c.les.id) throw Object.assign(new Error('Эта игра уже в этом уроке'), { status: 400 });
    code = store.versionCode(src.id, src.current);
    meta = { title: src.title, donor: src.donor, decisions: src.decisions, plan: src.plan, knob: src.knob || null, from: { game: src.id, version: src.current, lesson: src.lesson } };
  }
  if (!code) throw Object.assign(new Error('Нет кода игры'), { status: 400 });
  const g = ensureGame(c), g2 = store.getGame(g.id);
  Object.assign(g2, meta); store.saveGame(g2);
  return addVersion(g.id, { code, model: 'перенос', attempts: 0 }, { kind: 'перенос', from: meta.from ? meta.from.version : null, chat: true });
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
  if (c.story) card.story = cleanField(c.story); // вопрос шага playtest.ask: «что здесь случилось?», «что ты почувствовал?»
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
// слепая пара со спрятанной механикой (шаг blindpair, mode: 'secret'): сколько соседей проголосовали за мою игру и сколько почувствовали спрятанную механику
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

/* ---------- вау-старт: карты безумных идей, спрятанная механика, общая игра урока ---------- */
// Состояние живёт в классе (cls.wow) для текущего урока. Спрятанная механика и её раскрытие ученики получают только после своей догадки.
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
// карта вау-старта клиенту: вопрос (q), зачем (why) и имя опоры (pillar) — для урока с вопросами (wow.ask)
const cardMeta = c => ({ id: c.id, label: c.label, parts: !!c.parts, q: c.q || null, why: c.why || null, pillar: c.pillar || null });
// голосование вопроса: сколько голосов у каждой карты и сколько осталось секунд; голоса по именам видит только учитель
const offerCounts = o => o.options.map((_, k) => Object.values(o.votes).filter(v => v === k).length);
const publicOffer = w => (w.offer ? { id: w.offer.id, card: w.offer.card, options: w.offer.options, counts: offerCounts(w.offer), voted: Object.keys(w.offer.votes).length, left: Math.max(0, w.offer.until - Date.now()) } : null);
const cardDeck = (c, w) => (c.by && c.decks && c.decks[w.cards[c.by]]) || c.deck; // колода карты; у зависимой — колода жанра
// жанр карты действия: имя и каркас движка (wow.genres в сценарии урока)
const wowGenre = (les, w) => (les.wow.genres || []).find(g => g.card === w.cards.action) || null;
// мир с карты «Мир» и ход угрозы мира — в задание Qwen (вау-старт 2.0, урок 1): цвета и декор мира, тип врага рецепта по ходу угрозы
const wowWorld = (les, w) => ({ world: (les.wow.worlds || {})[w.cards.place] || null, move: (les.wow.moves || {})[w.cards.threat] || null });
const hashOf = t => [...String(t)].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
function wowState(cls, les) {
  if (!les.wow) return null;
  const fixed = fixedSecret(les);
  if (!cls.wow || cls.wow.lesson !== les.id) {
    cls.wow = { lesson: les.id, cards: {}, votes: {}, secret: fixed || randFrom(diceSecrets(cls, les).map(x => x.id)), secretBy: fixed ? 'урок' : 'кубик', status: 'cards', gameId: null, given: false };
    store.saveClass(cls);
  } else if (fixed && cls.wow.secret !== fixed) { // класс начал урок до того, как спрятанная механика стала одной: следующая сборка заложит спрятанную механику урока
    cls.wow.secret = fixed; cls.wow.secretBy = 'урок'; store.saveClass(cls);
  }
  return cls.wow;
}
// одна спрятанная механика игры класса на все классы (wow.classSecret): кубика и тайной замены у учителя нет
const fixedSecret = les => (les.wow && les.wow.classSecret && les.wow.secrets.some(x => x.id === les.wow.classSecret) ? les.wow.classSecret : null);
// спрятанные механики для кубика и карты спрятанной механики в Фабрике: со звуком (sound) — только если учитель отметил, что в классе наушники
const diceSecrets = (cls, les) => { const all = les.wow.secrets, ok = all.filter(x => !x.sound || (cls && cls.headphones)); return ok.length ? ok : all; };
const secretOf = (les, id) => les.wow.secrets.find(x => x.id === id) || les.wow.secrets[0];
const builtSecret = (les, w) => secretOf(les, w.builtSecret || w.secret); // спрятанная механика, которая лежит в собранной игре
function publicWow(cls, les) {
  const w = wowState(cls, les);
  if (!w) return null;
  const g = w.given && w.gameId ? store.getGame(w.gameId) : null;
  return {
    formula: les.wow.formula,
    cards: les.wow.cards.map(c => Object.assign(cardMeta(c), { text: w.cards[c.id] || null, voters: w.votes[c.id] || [] })),
    ask: les.wow.ask || null, look: les.wow.look || null, offer: publicOffer(w), last: w.last || null,
    status: w.given ? 'given' : w.status,
    link: acceptedLink(w) ? { phrase: w.link.phrase, loop: w.link.loop, twist: w.link.twist, funny: w.link.funny } : null,
    frame: (wowGenre(les, w) || {}).frame || '', // камера жанра для наброска игры в сцене «Пять опор» (public/opory.js)
    game: g && g.current ? { id: g.id, version: g.current, title: g.title, knob: w.knob } : null,
  };
}
const wowChanged = (cls, les) => broadcast(cls.code, 'wow', publicWow(cls, les));
// варианты шага «Найди спрятанную механику»: настоящая спрятанная механика, две чужие из колоды и ловушка — поворот с карты (он был в замысле, значит, не спрятанная механика)
function huntOptions(cls, les, w) {
  const sec = builtSecret(les, w), h = hashOf(cls.code + sec.id);
  const others = les.wow.secrets.filter(x => x.id !== sec.id).sort((a, b) => hashOf(h + a.id) - hashOf(h + b.id)).slice(0, 2);
  const trap = w.cards.twist ? cap(w.cards.twist) : null;
  const options = [sec.title, ...others.map(x => x.title), trap].filter(Boolean).sort((a, b) => hashOf(h + a) - hashOf(h + b));
  return { options, right: sec.title, trap, secret: sec };
}
const wowSteps = les => {
  const all = les.checkpoints.flatMap(c => c.steps);
  return { on: all.find(x => x.type === 'play' && x.shared && !x.secretOff && !x.lupa), off: all.find(x => x.type === 'play' && x.shared && x.secretOff), ab: all.find(x => x.type === 'abtest'), hunt: all.find(x => x.type === 'secret' && !x.hunt) };
};
// сводка для учителя: рекорды со спрятанной механикой и без, сколько раз сработала спрятанная механика, кто угадал
function wowSummary(cls, les) {
  const S = wowSteps(les);
  const rows = store.students(cls.code).map(s => {
    const st = (s.lessons || {})[les.id] || { answers: {} };
    const A = step => (step && st.answers[step.id] && st.answers[step.id].value) || {};
    // слепой тест А/Б: «со спрятанной механикой» — копия, где она работала; иначе — партии шагов play со спрятанной механикой и без
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

route('POST', '/api/wow/vote', (ctx) => { // голос «перетянуть карту»: повторный голос снимает; с option — голос за карту в вопросе учителя
  const { w: who, cls, les } = needStudent(ctx);
  const w = wowState(cls, les);
  if (!w) throw Object.assign(new Error('В этом уроке нет колоды'), { status: 400 });
  if (ctx.body.option != null) {
    const o = w.offer, k = Number(ctx.body.option);
    if (!o || o.card !== ctx.body.card || (ctx.body.offer && ctx.body.offer !== o.id)) throw Object.assign(new Error('Голосование уже закончилось'), { status: 400 });
    if (!Number.isInteger(k) || o.options[k] == null) throw Object.assign(new Error('Нет такой карты'), { status: 400 });
    o.votes[who.nick] = k; // голос можно перенести на другую карту, пока учитель не подвёл итог
    store.saveClass(cls); wowChanged(cls, les);
    return { option: k, counts: offerCounts(o) };
  }
  const card = les.wow.cards.find(c => c.id === ctx.body.card);
  if (!card || !w.cards[card.id] || w.status !== 'cards' || w.given) throw Object.assign(new Error('Голосовать можно, пока учитель тянет карты'), { status: 400 });
  const list = w.votes[card.id] || [];
  w.votes[card.id] = list.includes(who.nick) ? list.filter(n => n !== who.nick) : list.concat(who.nick);
  store.saveClass(cls); wowChanged(cls, les);
  return { voters: w.votes[card.id] };
});
// шаг «Найди спрятанную механику» с hunt в сценарии: варианты и ответ — из шага, игры класса не нужно
const huntStep = (les, id) => { const f = id && stepOf(les, id); return f && f.step.type === 'secret' && f.step.hunt ? f.step : null; };
route('GET', '/api/wow/hunt', (ctx) => {
  const me = needStudent(ctx), { cls, les, st } = me;
  const hs = huntStep(les, ctx.url.searchParams.get('step'));
  if (hs && hs.hunt.format === 'sabotazh') return K.sabotageHunt(me, hs);
  if (hs) return { options: hs.hunt.options, answer: (st.answers[hs.id] && st.answers[hs.id].value) || null };
  const w = wowState(cls, les);
  if (!w || !w.gameId) return { options: [] };
  const S = wowSteps(les), sum = wowSummary(cls, les);
  // сколько в классе почувствовали спрятанную механику вслепую (слепой тест А/Б) — в раскрытии спрятанной механики
  return { options: huntOptions(cls, les, w).options, answer: (S.hunt && st.answers[S.hunt.id] && st.answers[S.hunt.id].value) || null, felt: { felt: sum.felt, voted: sum.voted } };
});
route('POST', '/api/wow/guess', (ctx) => {
  const me = needStudent(ctx), { w: who, cls, les, s, st } = me;
  const hs = huntStep(les, ctx.body.step);
  if (hs && hs.hunt.format === 'sabotazh') return K.sabotageGuess(me, hs, String(ctx.body.guess || ''));
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
    wow: w, formula: les.wow.formula, cards: les.wow.cards.map(cardMeta), ask: les.wow.ask || null, look: les.wow.look || null, offer: publicOffer(w),
    secrets: les.wow.secrets.map(x => ({ id: x.id, title: x.title, effect: x.effect, sound: !!x.sound })), secret: secretOf(les, w.secret), fixed: !!fixedSecret(les), headphones: !!cls.headphones, built: w.gameId ? builtSecret(les, w) : null,
    game: g && v ? { id: g.id, version: g.current, knob: w.knob || 'secret', title: g.title, model: v.model, warnings: v.warnings || [], attempts: v.attempts, kind: v.kind,
      playtest: v.playtest || null, from: v.from || null, before: v.from && g.versions[v.from - 1] ? g.versions[v.from - 1].playtest || null : null } : null,
    summary: wowSummary(cls, les), frame: (wowGenre(les, w) || {}).frame || '',
  };
});
route('POST', '/api/teacher/wow/draw', (ctx) => {
  const { cls, les, w } = needWow(ctx);
  const list = ctx.body.card === 'all' ? les.wow.cards : les.wow.cards.filter(c => c.id === ctx.body.card);
  if (!list.length) throw Object.assign(new Error('Нет такой карты'), { status: 400 });
  const seen = ((cls.wowSeen = cls.wowSeen || {})[les.id] = cls.wowSeen[les.id] || {});
  // зависимые карты (by) тянутся из колоды по карте-родителю: в уроке 1 герой и угроза — из мира на карте «Мир», поворот — из жанра на карте «Игра».
  // Без родителя сначала тянется он, а новый родитель перетягивает те зависимые карты, которых нет в его колоде
  const todo = new Set(list.map(c => c.id));
  for (const c of les.wow.cards) if (todo.has(c.id) && c.by && !w.cards[c.by]) todo.add(c.by);
  const draw = c => { w.cards[c.id] = drawFresh(seen, c.id, cardDeck(c, w), w.cards[c.id]); w.votes[c.id] = []; };
  for (const c of les.wow.cards.filter(x => !x.by && todo.has(x.id))) draw(c);
  // карта с тем же именем в колоде нового жанра остаётся собой: герой меняет только ручку жанра
  const sameName = c => { const name = String(w.cards[c.id]).split(' — ')[0]; return cardDeck(c, w).find(x => x.split(' — ')[0] === name); };
  for (const c of les.wow.cards.filter(x => x.by)) {
    if (todo.has(c.id)) draw(c);
    else if (todo.has(c.by) && w.cards[c.id] && !cardDeck(c, w).includes(w.cards[c.id])) { const keep = c.parts && sameName(c); if (keep) w.cards[c.id] = keep; else draw(c); }
  }
  if (w.offer && todo.has(w.offer.card)) w.offer = null; // учитель вытянул карту сам — голосование за неё закрыто
  w.link = null; // новые карты — связка устарела
  if (!w.given && w.status !== 'building') w.status = 'cards';
  store.saveClass(cls); wowChanged(cls, les);
  return { wow: w };
});
// вау-старт вопросами (wow.ask): учитель задаёт вопрос — портал выкладывает ask.offer карт из колоды этой карты, класс голосует с ноутбуков,
// итог (pick) ставит карту-победителя. Без card — следующий вопрос по порядку карт; тот же вопрос ещё раз — новые карты.
route('POST', '/api/teacher/wow/offer', (ctx) => {
  const { cls, les, w } = needWow(ctx);
  if (!les.wow.ask) throw Object.assign(new Error('В этом уроке карты тянут без вопросов'), { status: 400 });
  if (w.given || w.status === 'building') throw Object.assign(new Error('Игра уже собирается — карты не поменять'), { status: 409 });
  const c = ctx.body.card ? les.wow.cards.find(x => x.id === ctx.body.card) : les.wow.cards.find(x => !w.cards[x.id]);
  if (!c) throw Object.assign(new Error(ctx.body.card ? 'Нет такой карты' : 'Все вопросы уже отвечены'), { status: 400 });
  const parent = c.by && les.wow.cards.find(x => x.id === c.by);
  if (parent && !w.cards[parent.id]) throw Object.assign(new Error(`Сначала ответьте на вопрос «${parent.q || parent.label}»`), { status: 400 });
  const seen = ((cls.wowSeen = cls.wowSeen || {})[les.id] = cls.wowSeen[les.id] || {});
  const deck = cardDeck(c, w), options = [];
  while (options.length < Math.min(les.wow.ask.offer || 3, deck.length)) options.push(drawFresh(seen, c.id, deck.filter(x => !options.includes(x)), w.cards[c.id]));
  w.offer = { id: store.id(8), card: c.id, options, votes: {}, until: Date.now() + (les.wow.ask.seconds || 20) * 1000 };
  store.saveClass(cls); wowChanged(cls, les);
  return { offer: publicOffer(w) };
});
// итог голосования: option — выбор учителя, без него — карта с большинством голосов (ничья — жребий). offer — id голосования:
// проектор и панель учителя закрывают его по таймеру одновременно, второй вызов ничего не меняет.
// Новый ответ снимает зависимые карты, которых нет в новой колоде (новый мир — новые герой и угроза): на их вопросы класс ответит заново.
route('POST', '/api/teacher/wow/pick', (ctx) => {
  const { cls, les, w } = needWow(ctx);
  const o = w.offer;
  if (!o || (ctx.body.offer && ctx.body.offer !== o.id)) return { wow: w, last: w.last || null };
  const counts = offerCounts(o), opt = Number(ctx.body.option);
  let i = Number.isInteger(opt) && o.options[opt] != null ? opt : null;
  if (i == null) { const max = Math.max(...counts), top = counts.map((n, k) => (n === max ? k : -1)).filter(k => k >= 0); i = top[Math.floor(Math.random() * top.length)]; }
  w.cards[o.card] = o.options[i]; w.votes[o.card] = [];
  for (const d of les.wow.cards) if (d.by === o.card && w.cards[d.id] && !cardDeck(d, w).includes(w.cards[d.id])) { delete w.cards[d.id]; w.votes[d.id] = []; }
  w.last = { id: o.id, card: o.card, option: i, options: o.options, counts, by: Number.isInteger(opt) && o.options[opt] != null ? 'учитель' : 'класс' };
  w.offer = null; w.link = null;
  if (!w.given && w.status !== 'building') w.status = 'cards';
  store.saveClass(cls); wowChanged(cls, les);
  return { wow: w, last: w.last };
});
route('POST', '/api/teacher/wow/secret', (ctx) => { // без id — кубик, с id — тайный выбор учителя
  const { cls, les, w } = needWow(ctx);
  if (fixedSecret(les)) throw Object.assign(new Error(`В этом уроке у игры класса одна спрятанная механика: «${secretOf(les, fixedSecret(les)).title}»`), { status: 400 });
  if (ctx.body.id) { if (!les.wow.secrets.some(x => x.id === ctx.body.id)) throw Object.assign(new Error('Нет такой спрятанной механики'), { status: 400 }); w.secret = ctx.body.id; w.secretBy = 'учитель'; }
  else { w.secret = randFrom(diceSecrets(cls, les).map(x => x.id), w.secret); w.secretBy = 'кубик'; }
  store.saveClass(cls);
  return { secret: secretOf(les, w.secret), secretBy: w.secretBy };
});
// наушники в классе: без них спрятанные механики со звуком (sound) не выпадают кубиком и не попадают в карту спрятанной механики Фабрики.
// Сняли отметку, а кубик уже выбрал звуковую спрятанную механику — кубик перебрасывается; выбор учителя остаётся.
route('POST', '/api/teacher/wow/headphones', (ctx) => {
  const { cls, les, w } = needWow(ctx);
  cls.headphones = !!ctx.body.on;
  if (!fixedSecret(les) && !cls.headphones && secretOf(les, w.secret).sound && w.secretBy === 'кубик') w.secret = randFrom(diceSecrets(cls, les).map(x => x.id), w.secret);
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
    const link = await ai.wowLink(w.cards, prev, { class: cls.code, nick: 'учитель', lesson: les.id }, wowGenre(les, w), wowWorld(les, w).move);
    const c2 = store.getClass(cls.code), w2 = wowState(c2, les);
    if (cardsKey(w2) !== key) throw Object.assign(new Error('Пока ИИ сводил карты, их перетянули — попросите гейм дизайн документ ещё раз'), { status: 409 });
    w2.link = Object.assign(link, { cards: key, accepted: false, at: store.now() });
    store.saveClass(c2); wowChanged(c2, les);
    return w2.link;
  });
  return { job: job.id };
});
route('POST', '/api/teacher/wow/link/accept', (ctx) => {
  const { cls, les, w } = needWow(ctx);
  if (!w.link) throw Object.assign(new Error('Гейм дизайн документа ещё нет'), { status: 400 });
  w.link.accepted = !!ctx.body.accepted;
  store.saveClass(cls); wowChanged(cls, les);
  return { link: w.link };
});
route('POST', '/api/teacher/wow/link/edit', (ctx) => { // учитель правит связку руками или пишет свою; сохранённая — принята
  const { cls, les, w } = needWow(ctx);
  const missing = les.wow.cards.filter(c => !w.cards[c.id]);
  if (missing.length) throw Object.assign(new Error('Сначала вытяните карты: ' + missing.map(c => c.label).join(', ')), { status: 400 });
  if (w.given || w.status === 'building') throw Object.assign(new Error('Игра уже собирается — гейм дизайн документ не поменять'), { status: 409 });
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
  store.addVersion(g, r.code, Object.assign({ kind: 'общая игра', model: r.model, attempts: r.attempts, warnings: r.warnings }, extra));
  const g2 = store.getGame(g.id); g2.title = (/\btitle\s*:\s*(['"`])([^'"`]{1,80})\1/.exec(r.code) || [])[2] || g2.title || 'Игра класса'; store.saveGame(g2);
  w.builtSecret = secretId; w.knob = r.knob; w.status = 'preview'; w.given = false;
  store.saveClass(cls); wowChanged(cls, les);
  return { gameId: g.id, version: g2.current, title: g2.title, warnings: r.warnings || [] };
}
// бот-плейтестер: панель учителя прогоняет каждую новую версию игры класса тремя стратегиями и присылает отчёт сюда;
// по отчёту программист один раз правит игру (новая версия), и бот прогоняет её снова — учитель видит «было → стало»
const STRATS = ['idle', 'mash', 'random'];
const cleanStr = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
function cleanReport(r) {
  r = r && typeof r === 'object' ? r : {};
  const num = (v, n = 1e6) => Math.max(0, Math.min(n, Number(v) || 0));
  const clean = x => ({
    strategy: x.strategy, seconds: Math.round(num(x.seconds, 600) * 10) / 10, over: !!x.over, endText: cleanStr(x.endText, 120), score: Math.round(num(x.score, 1e9)), hurts: Math.round(num(x.hurts, 999)),
    hurtsAt: (Array.isArray(x.hurtsAt) ? x.hurtsAt : []).slice(0, 10).map(t => Math.round(num(t, 600) * 10) / 10), offscreen: x.offscreen == null ? null : Math.round(num(x.offscreen, 100)),
    flat: Math.round(num(x.flat, 600)), presses: { a: Math.round(num(x.presses && x.presses.a)), b: Math.round(num(x.presses && x.presses.b)) }, error: x.error ? cleanStr(x.error, 300) : null,
    secret: Math.round(num(x.custom && x.custom._secret) * 10) / 10, // сколько раз сработала спрятанная механика (скрытый счётчик _secret)
    // секунды срабатываний спрятанной механики: когда она сработала впервые и сколько раз (отметки не чаще 4 в секунду)
    secretFirst: Array.isArray(x.secretAt) && x.secretAt.length ? Math.round(num(x.secretAt[0], 600) * 10) / 10 : null,
    secretMarks: Array.isArray(x.secretAt) ? Math.min(300, x.secretAt.length) : 0,
  });
  const results = (Array.isArray(r.results) ? r.results : []).filter(x => x && STRATS.includes(x.strategy)).slice(0, 3).map(clean);
  // off — партия новичка в копии «Без спрятанной механики» (ручка спрятанной механики = 0) в том же мире: её сравнивают с партией новичка со спрятанной механикой
  const off = r.off && typeof r.off === 'object' && r.off.strategy === 'random' ? clean(r.off) : null;
  return { at: store.now(), seconds: Math.round(num(r.seconds, 600)), seed: Math.round(num(r.seed, 4294967295)), hero: !!r.hero, results, off,
    findings: (Array.isArray(r.findings) ? r.findings : []).slice(0, 12).map(f => cleanStr(f, 400)).filter(Boolean) };
}
// Бот проверяет и спрятанную механику (разбор геймдизайнера 17.10.2026): если за три партии счётчик _secret ни разу не сработал, класс не почувствует
// разницу копий А и Б. Тогда в отчёте появляется находка, и панель учителя сама отправляет программисту правку по отчёту — один раз на игру.
const SECRET_SILENT = 'Спрятанная механика ни разу не сработала за три партии бота: скрытый счётчик _secret молчит, и класс не почувствует разницу копий А и Б. Спрятанная механика должна впервые сработать до 15-й секунды партии при secret: 1; вызывай lab.count(\'_secret\') каждый раз, когда он срабатывает.';
// Бот проверяет и силу спрятанной механики (решение автора 18.10.2026): когда сработала впервые, как часто срабатывает и различаются ли копии
// со спрятанной механикой и без у новичка — по показателям из поля bot спрятанной механики в колоде урока. Слабая спрятанная механика класс не заметит за одну партию в копию.
const SECRET_FIRST = 15, SECRET_RATE = 4;
const BOT_METRIC = { hurts: 'урон', seconds: 'длина партии, с', score: 'очки' };
function secretWeak(sec, pt) {
  const rs = pt.results.filter(x => !x.error), out = [];
  if (!rs.length || rs.every(x => !x.secret)) return out; // молчащая спрятанная механика — находка SECRET_SILENT
  const firsts = rs.map(x => x.secretFirst).filter(t => t != null), first = firsts.length ? Math.min(...firsts) : null;
  if (first != null && first > SECRET_FIRST) out.push(`Спрятанная механика впервые сработала только на ${Math.round(first)}-й секунде партии бота, а нужно до ${SECRET_FIRST}-й: класс играет по одной партии в каждую копию. Сделай так, чтобы спрятанная механика срабатывала с первых секунд.`);
  const rate = Math.max(...rs.map(x => (x.seconds >= 10 ? x.secretMarks / x.seconds * 60 : 0)));
  if (rate < SECRET_RATE) out.push(`Спрятанная механика срабатывает ${String(Math.round(rate * 10) / 10).replace('.', ',')} раза в минуту, а нужно не меньше ${SECRET_RATE}: за партию его не заметить. Пусть он срабатывает чаще, а эффект будет крупнее.`);
  const spec = (sec && sec.bot) || {}, on = rs.find(x => x.strategy === 'random'), off = pt.off;
  if (spec.differs && on && off && !off.error) {
    const diff = k => { const a = on[k] || 0, b = off[k] || 0, m = Math.max(a, b); return m ? Math.abs(a - b) / m : 0; };
    if (!spec.differs.some(k => diff(k) >= (spec.by || 0.2))) out.push(`Копии со спрятанной механикой и без почти не различаются у новичка: ${spec.differs.map(k => `${BOT_METRIC[k] || k} ${on[k]} и ${off[k]}`).join(', ')}. Нужна разница хотя бы ${Math.round((spec.by || 0.2) * 100)}%: сделай эффект спрятанной механики сильнее и убери из игры без спрятанной механики всё, что на неё похоже.`);
  }
  return out;
}
route('POST', '/api/teacher/wow/playtest', (ctx) => {
  const { les, w } = needWow(ctx);
  const g = w.gameId && store.getGame(w.gameId), n = Number(ctx.body.version), v = g && g.versions[n - 1];
  if (!v) throw Object.assign(new Error('Нет такой версии игры класса'), { status: 400 });
  v.playtest = cleanReport(ctx.body.report);
  const silent = w.knob === 'secret' && v.playtest.results.length > 0 && v.playtest.results.every(x => !x.secret && !x.error);
  if (silent) { v.playtest.secretSilent = true; v.playtest.findings.unshift(SECRET_SILENT); }
  const weak = silent || w.knob !== 'secret' ? [] : secretWeak(builtSecret(les, w), v.playtest); // у запасной игры своя проверенная спрятанная механика
  v.playtest.secretWeak = weak.length > 0; // панель учителя: «спрятанная механика заметная» или «спрятанная механика слабая»
  if (weak.length) v.playtest.findings.unshift(...weak);
  store.saveGame(g);
  // правку по отчёту учитель отправляет в чат сам: сама она не уходит, ответ некому вставить
  return { playtest: v.playtest, autoFix: false };
});
route('POST', '/api/teacher/wow/playtest-fix', (ctx) => {
  const { cls, les, w } = needWow(ctx);
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
      const r = await ai.playtestFix(code, report, { cards: w.cards, genre: wowGenre(les, w), link: acceptedLink(w) }, whoAI, progress);
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
// Проверка спрятанной механики без бота (урок 1, чекпоинт 5, 18.10.2026): в игру-страницу из чата бот не играет, поэтому спрятанную механику проверяют живые партии —
// учителя в предпросмотре и класса в слепом тесте. Молчит — учитель отправляет правку в тот же чат Qwen; игра остаётся у класса.
const SECRET_SILENT_CHAT = 'Спрятанная механика ни разу не сработала в партиях: скрытый счётчик молчит, и класс не почувствует разницу копий А и Б. Сделай спрятанную механику заметной уже в первой минуте партии при ручке secret = 1 и вызывай portal.count(\'_secret\') (в игре GAME — lab.count(\'_secret\')) каждый раз, когда он срабатывает.';
route('POST', '/api/teacher/wow/secret-fix', (ctx) => {
  const { cls, les, w } = needWow(ctx);
  if (w.status === 'building' && busyJob(w.jobId)) throw Object.assign(new Error('Игра уже собирается'), { status: 409 });
  const g = w.gameId && store.getGame(w.gameId), n = g && g.current;
  if (!n) throw Object.assign(new Error('Сначала соберите игру класса'), { status: 400 });
  const code = store.versionCode(g.id, n), secretId = w.builtSecret, given = w.given;
  const whoAI = { class: cls.code, nick: 'учитель', lesson: les.id };
  const job = startJob(ctx.who.token, 'wow', async (progress) => {
    const r = await ai.change(code, SECRET_SILENT_CHAT, whoAI, progress);
    const out = wowVersion(cls.code, Object.assign(r, { knob: w.knob }), secretId, { kind: 'правка: спрятанная механика молчала', from: n, request: SECRET_SILENT_CHAT });
    if (given) { const c2 = store.getClass(cls.code), w2 = wowState(c2, les); w2.given = true; store.saveClass(c2); wowChanged(c2, les); }
    return out;
  });
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
  const secretId = w.secret;
  const sec = secretOf(les, secretId);
  w.status = 'building'; w.given = false; store.saveClass(cls); wowChanged(cls, les);
  const whoAI = { class: cls.code, nick: 'учитель', lesson: les.id };
  const job = startJob(ctx.who.token, 'wow', async (progress) => {
    try {
      const r = await ai.buildShared(Object.assign({ cards: w.cards, genre: wowGenre(les, w), secret: sec.prompt, base: sec.base || null, howto: sec.howto || null, link: acceptedLink(w), title: wowTitle(les, w) }, wowWorld(les, w)), whoAI, progress);
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
// programmer — сборка, правка и починка игры: программист — Qwen в бесплатном чате, они не считаются в лимит
function aiGuard(ctx, programmer) {
  const c = needStudent(ctx);
  c.whoAI = { class: c.w.class, nick: c.w.nick, lesson: c.les.id, game: c.st.gameId || undefined };
  if (programmer) return c;
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

// модуль 7: арена класса, турнирная сетка, команды джема (lib/m7.js)
const M7 = require('./lib/m7')({ route, needStudent, needTeacher, needDayClass, broadcast, store, saveStudentField, lesson });
// модуль 8: команды проекта через уроки 29–36, перенос диздока, питчи, дорога к Фестивалю, стенды Фестиваля (lib/m8.js)
const M8 = require('./lib/m8')({ route, needStudent, needDayClass, broadcast, store, saveStudentField, lessons, M7, rostOf, rostGrowth });
function ensureGame(c) {
  const teamId = M7.teamGameId(c.w.class, c.w.nick, c.les.id); // джем: игра одна на команду
  if (teamId && teamId !== c.st.gameId && store.getGame(teamId)) { c.st.gameId = teamId; saveStudentField(c.w.class, c.w.nick, c.les.id, st => { st.gameId = teamId; }); }
  let g = c.st.gameId ? store.getGame(c.st.gameId) : null;
  if (!g) {
    g = store.createGame({ class: c.w.class, nick: c.w.nick, lesson: c.les.id });
    saveStudentField(c.w.class, c.w.nick, c.les.id, st => { st.gameId = g.id; });
    M7.claimGame(c.w.class, c.w.nick, c.les.id, g.id);
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
    // ручка спрятанной механики своей игры (карта спрятанной механики): по ней слепая пара выключает спрятанную механику
    g2.knob = plan.secret && /\bsecret\s*:\s*\{/.test(r.code) ? 'secret' : null;
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

/* ---------- правка своими словами в чате Qwen (урок 1, чекпоинт 5, 18.10.2026) ---------- */
// договор (один раз за чат) и перенос игры в новый чат — тексты для копирования; формат зависит от игры: страница HTML или объект GAME
function ownGameCode(c) {
  const g = c.st.gameId && store.getGame(c.st.gameId);
  if (!g || !g.current) throw Object.assign(new Error('Сначала собери игру'), { status: 400 });
  return { g, code: store.versionCode(g.id, g.current) };
}
route('GET', '/api/chat/pact', (ctx) => { const c = needStudent(ctx); return { text: ai.chatPact(ownGameCode(c).code) }; });
route('GET', '/api/chat/move', (ctx) => { const c = needStudent(ctx); const { code } = ownGameCode(c); return { text: ai.chatMove(code, { lesson: c.les.id }) }; });
route('POST', '/api/chat/ask', (ctx) => { const c = needStudent(ctx), b = ctx.body || {}; return { text: ai.chatAsk(b, b.pact ? ownGameCode(c).code : null) }; });
// «Вставить новую версию из чата»: в любой момент, без задания портала. Проверка та же, что у задания; не подошло или оборвалось —
// окно Qwen с сообщением для того же чата. request — о чём просил ученик (причина версии для учителя); repair — что дописать в чат.
route('POST', '/api/game/paste', (ctx) => {
  const pre = needStudent(ctx);
  const text = String(ctx.body.text || '').slice(0, 600000);
  if (!text.trim()) throw Object.assign(new Error('Вставь ответ из чата'), { status: 400 });
  const request = String(ctx.body.request || '').replace(/\s+/g, ' ').trim().slice(0, 600) || 'правка своими словами в чате';
  const { g, code } = ownGameCode(pre);
  const c = aiGuard(ctx, true);
  const base = g.current;
  const job = startJob(c.w.token, 'paste', async (progress) => {
    const r = await ai.chatPaste(code, text, c.whoAI, progress, g.knob === 'secret');
    return Object.assign(addVersion(g.id, r, { kind: 'правка', request, from: base, chat: true }), { warnings: r.warnings || [], repair: r.repair || '' });
  });
  return { job: job.id };
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
    manual: m ? { step: m.step, kind: m.kind, url: m.url, followUp: !!m.followUp, cont: m.parts > 0, parts: m.parts, chars: m.prompt.length } : null };
});
// программист в chat.qwen.ai: текст для чата, вставленный ответ и отмена
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
  return { step: m.step, text: m.parts ? CONTINUE : m.prompt };
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
  const les = lessons().map(l => ({ id: l.id, number: l.number, title: l.title, module: l.module || 0, hidden: !!l.hidden }));
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
  const explain = Object.fromEntries(les.checkpoints.flatMap(c => c.steps).filter(x => x.type === 'obyasni').map(x => [x.id, explainTally(cls.code, les, x)]));
  return { class: cls, lesson: les, glossary: glossaryOf(les), students, stepsDone, votes, explain, goal: K.goal(cls), spend: spend(cls.code, les.id), limits: ai.limits(), stuckSec: STUCK_SEC, now: new Date().toISOString() };
});
// «Объясни соседу» (Б3): не проверка — учителю только доля «Понял» и пары, которые застряли (две попытки «Не понял»)
function explainTally(code, les, x) {
  const list = store.students(code).map(s => ({ nick: s.nick, v: ((((s.lessons || {})[les.id] || {}).answers || {})[x.id] || {}).value || {} })).filter(r => (r.v.tries || []).length);
  const got = list.filter(r => r.v.tries.includes('got'));
  return { n: list.length, got: got.length, first: got.filter(r => r.v.tries[0] === 'got').length, share: list.length ? Math.round(100 * got.length / list.length) : 0,
    stuck: list.filter(r => !r.v.tries.includes('got') && r.v.tries.length >= 2).map(r => ({ nick: r.nick, partner: r.v.partner || '' })) };
}
// живые ответы класса для проектора (вкладка «Ответы класса»): шаги выбора полосками без имён, слепой тест А/Б и слепая пара со спрятанной механикой —
// сколько почувствовали спрятанную механику. Считаются только отправленные ответы (шаг готов).
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
      // compare — тот же вопрос или та же шкала раньше в уроке (К5, П2): у полоски ещё before — сколько выбрали это тогда
      const prev = x.compare ? done(x.compare) : null, prevStep = x.compare ? stepOf(les, x.compare) : null;
      steps.push({ cp: cp.id, id: x.id, title: x.title, kind: 'choice', n: list.length,
        bars: x.options.map(o => Object.assign({ label: o, n: list.filter(v => (v.selected || []).includes(o)).length }, prev && { before: prev.filter(v => (v.selected || []).includes(o)).length }))
          .concat(own.length ? [{ label: 'Свои слова', n: own.length }] : []),
        own: own.slice(-6), compare: prev ? { title: prevStep ? prevStep.step.title : '', n: prev.length } : null });
      // questions — ещё вопросы на том же шаге (входная анкета): у каждого своя полоска на проекторе
      for (const q of x.questions || []) {
        const qs = list.map(v => (v.more || {})[q.id] || []).filter(s => s.length);
        steps.push({ cp: cp.id, id: x.id + ':' + q.id, title: q.q, kind: 'choice', n: qs.length, bars: q.options.map(o => ({ label: o, n: qs.filter(s => s.includes(o)).length })), own: [] });
      }
    } else if (x.type === 'abtest' || (x.type === 'blindpair' && x.mode === 'secret')) {
      const list = done(x.id).filter(v => v.vote), felt = x.type === 'abtest' ? list.filter(v => v.vote === v.side).length : list.filter(v => v.felt).length, same = list.filter(v => v.vote === 'same').length;
      steps.push({ cp: cp.id, id: x.id, title: x.title, kind: 'secret', n: list.length,
        bars: [{ label: 'Почувствовали спрятанную механику', n: felt }, { label: 'Выбрали копию без спрятанной механики', n: list.length - felt - same }, { label: 'Разницы нет', n: same }] });    // разбор прототипа (урок 1, чекпоинт 5): «Совпало?», находки разбора (главные — словами), «Ближе к чувству?» — проектор и карточка учителя
    } else if (x.type === 'variety') { // мастерская вариаций: самая интересная вариация и какие детали угадали
      const list = done(x.id).filter(v => v.fav);
      steps.push({ cp: cp.id, id: x.id, title: x.question || 'Самая интересная вариация', kind: 'choice', n: list.length,
        bars: x.variants.map(o => ({ label: `${o.icon} ${o.label}`, n: list.filter(v => v.fav === o.id).length })).filter(b => b.n) });
    } else if (x.type === 'curve') { // урок 9: какие кривые сложности нарисовал класс
      const list = all.map(a => (a[x.id] || {}).value || {}).filter(v => v.shape);
      const names = { pila: '🪚 Пила с передышками', rovnaya: '📈 Ровная горка', stena: '🧱 Стена', skuka: '😴 Скука' };
      steps.push({ cp: cp.id, id: x.id, title: x.title, kind: 'choice', n: list.length, bars: Object.entries(names).map(([k, label]) => ({ label, n: list.filter(v => v.shape === k).length })) });
    } else if (x.type === 'pig') { // урок 10: где класс забирает очки в «Свинье»
      const holds = all.map(a => ((a[x.id] || {}).value || {}).holds || []).flat().map(Number).filter(n => n > 0);
      const bands = [[1, 9, 'меньше 10'], [10, 19, '10–19'], [20, 29, '20–29'], [30, 1e9, '30 и больше']];
      const avg = holds.length ? Math.round(holds.reduce((p, q) => p + q, 0) / holds.length) : 0;
      steps.push({ cp: cp.id, id: x.id, title: 'Свинья: на скольких очках забирали', kind: 'choice', n: done(x.id).length, max: Math.max(1, holds.length),
        bars: bands.map(([a, b, label]) => ({ label, n: holds.filter(h => h >= a && h <= b).length })), note: holds.length ? `Класс забирает в среднем на ${avg}. Ни один вариант не лучший всегда: жадность выигрывает чаще, но и сгорает чаще.` : '' });
    } else if (x.type === 'pulse') { // уроки 9, 10, 13: вызов класса на одном зерне
      const t = pulseTally(cls.code, les, x, null);
      if (t.picks) steps.push({ cp: cp.id, id: x.id, title: x.picksTitle || 'Что выбирает класс', kind: 'choice', n: t.n, max: 100, bars: t.picks.map(p => ({ label: p.label, n: p.share, show: p.share + '%' })),
        note: t.picks.length && x.monopoly ? (t.picks[0].share >= 50 ? `«${t.picks[0].label}» — ${t.picks[0].share}% выборов. Если все берут одно, это не выбор.` : 'Класс выбирает по-разному: выбор настоящий.') : '' });
      if (t.hist) steps.push({ cp: cp.id, id: x.id + ':hist', title: x.seriesTitle || 'Где класс разбивался', kind: 'choice', n: t.n, max: Math.max(1, ...t.hist.map(b => b.n)), bars: t.hist.map(b => ({ label: b.label + ' с', n: b.n })) });
      if (!t.picks && !t.hist) steps.push({ cp: cp.id, id: x.id, title: x.title, kind: 'choice', n: t.n, bars: t.top.map(r => ({ label: r.nick, n: r.best })) });
    } else if (x.type === 'scale') { // урок 12: среднее класса по шкале «случай — мастерство»
      const list = all.map(a => (a[x.id] || {}).value || {}).filter(v => v.pos);
      steps.push({ cp: cp.id, id: x.id, title: x.title, kind: 'choice', n: list.length, max: 10,
        bars: x.items.map(it => { const ps = list.map(v => v.pos[it.id]).filter(p => typeof p === 'number'); const m = ps.length ? ps.reduce((p, q) => p + q, 0) / ps.length : 0; return { label: `${it.icon} ${it.label}`, n: Math.round(m * 10) / 10, show: ps.length ? String(Math.round(m * 10) / 10).replace('.', ',') : '—' }; }),
        note: `0 — всё решает случай, 10 — всё решает мастерство.` });
    } else if (x.type === 'table') { // урок 13: какие юниты класс выпускал чаще всего в дуэлях по своим таблицам
      const count = {};
      all.forEach(a => Object.entries(((a[x.id] || {}).value || {}).played || {}).forEach(([k, c]) => { count[k] = (count[k] || 0) + (Number(c) || 0); }));
      steps.push({ cp: cp.id, id: x.id, title: 'Дуэли по таблицам: кого выпускали', kind: 'choice', n: done(x.id).length, max: Math.max(1, ...Object.values(count)),
        bars: Object.entries(count).sort((p, q) => q[1] - p[1]).slice(0, 8).map(([label, n]) => ({ label, n })) });
    } else if (x.type === 'brosok') { // модуль 6: квиз-бросок — где класс попадает реже всего
      const list = all.map(a => (a[x.id] || {}).value || {}).filter(v => v.by);
      steps.push({ cp: cp.id, id: x.id, title: x.title + ': верно по персонажам', kind: 'choice', n: list.length, max: 100,
        bars: x.targets.map(tg => { let ok = 0, n = 0; list.forEach(v => { const b = v.by[tg.id] || [0, 0]; ok += b[0]; n += b[1]; }); const k = n ? Math.round(100 * ok / n) : 0; return { label: `${tg.icon} ${tg.label}`, n: k, show: n ? k + '%' : '—' }; }) });
    } else if (x.type === 'minuta') { // «Первая минута»: сколько моментов «потерялся» нашёл класс
      const list = done(x.id).filter(v => v.total);
      steps.push({ cp: cp.id, id: x.id, title: x.title, kind: 'choice', n: list.length, max: Math.max(1, ...x.clips.map(c => c.lost.length)),
        bars: x.clips.map(c => { const fs2 = list.map(v => ((v.clips || {})[c.anim] || {}).found || 0); return { label: c.title, n: fs2.length ? Math.round(fs2.reduce((p, q) => p + q, 0) / fs2.length * 10) / 10 : 0, show: fs2.length ? `${String(Math.round(fs2.reduce((p, q) => p + q, 0) / fs2.length * 10) / 10).replace('.', ',')} из ${c.lost.length}` : '—' }; }) });
    } else if (x.type === 'sekundomer') { // «Новичок с улицы»: секунды до понимания цели до и после правки
      const list = all.map(a => ((a[x.id] || {}).value || {}).runs || {}).filter(r => Object.keys(r).length);
      const avg = k => { const xs = list.map(r => r[k]).filter(n => typeof n === 'number'); return xs.length ? Math.round(xs.reduce((p, q) => p + q, 0) / xs.length * 10) / 10 : 0; };
      const runs = x.runs || [{ id: 'before', label: 'До правки' }, { id: 'after', label: 'После правки' }];
      steps.push({ cp: cp.id, id: x.id, title: 'Секунд до понимания цели', kind: 'choice', n: list.length, max: Math.max(1, ...runs.map(r => avg(r.id))), bars: runs.map(r => ({ label: r.label, n: avg(r.id), show: String(avg(r.id)).replace('.', ',') + ' с' })) });
    } else if (x.type === 'audit') { // UX-аудит: какие пункты чек-листа класс чаще отмечает «нет»
      const list = done(x.id).filter(v => v.marks);
      steps.push({ cp: cp.id, id: x.id, title: 'UX-аудит: где игры класса проваливаются', kind: 'choice', n: list.length, max: Math.max(1, list.length),
        bars: x.items.map(it => ({ label: `${it.icon || ''} ${it.label}`, n: list.filter(v => v.marks[it.id] === false).length })).sort((a, b) => b.n - a.n) });
    } else if (x.type === 'darkhunt') {
      const list = all.map(a => (a[x.id] || {}).value || {}).filter(v => v.rounds);
      steps.push({ cp: cp.id, id: x.id, title: 'Тёмные паттерны: кто сколько нашёл', kind: 'choice', n: list.length, max: Math.max(1, list.length), bars: x.patterns.map(p => ({ label: `${p.icon} ${p.name}`, n: list.filter(v => (v.found || []).includes(p.id)).length })) });
    } else if (x.type === 'debate' || x.type === 'kodeks') {
      const t = m6Tally(cls.code, les, x, null);
      if (x.type === 'debate') steps.push({ cp: cp.id, id: x.id, title: x.question, kind: 'choice', n: t.before.n,
        bars: [-2, -1, 0, 1, 2].map((p, i) => ({ label: ['⛔ ' + x.left, '👎 скорее ' + x.left.toLowerCase(), '🤔 не знаю', '👍 скорее ' + x.right.toLowerCase(), '✅ ' + x.right][i], n: t.after.n ? t.after.counts[i] : t.before.counts[i], before: t.after.n ? t.before.counts[i] : undefined })),
        compare: t.after.n ? { title: 'до дебатов', n: t.before.n } : null, own: t.top.slice(0, 6).map(a => `${a.side === 'left' ? '⛔' : '✅'} ${a.text} · ${a.n}`) });
      else steps.push({ cp: cp.id, id: x.id, title: 'Кодекс класса', kind: 'choice', n: t.n, max: Math.max(1, t.n), bars: t.rules.slice(0, x.size || 7).map(r => ({ label: r.text, n: r.n })), note: `Подписали: ${t.signed.length}` });
    } else if (x.type === 'spor') { // вход урока 2: какую партию класс назвал лучше и почему
      const t = m6Tally(cls.code, les, x, null);
      steps.push({ cp: cp.id, id: x.id, title: x.question, kind: 'choice', n: t.n,
        bars: x.sides.map(sd => ({ label: sd.label, n: t.pick[sd.id] || 0 })).concat([{ label: x.sameLabel || 'Одинаково', n: t.pick.same || 0 }]), own: t.top.map(a => `${a.text} · ${a.n}`) });
    } else if (x.type === 'zagadka' || x.type === 'slomano' || x.type === 'koloda' || x.type === 'bumaga') { // загадка-сцена, сломанная игра, колода удовольствий, бумажная игра
      const t = m6Tally(cls.code, les, x, null);
      steps.push({ cp: cp.id, id: x.id, title: x.question || x.title, kind: 'choice', n: t.n, bars: t.rows });
    } else if (x.type === 'ownplay' && x.match) {
      const list = all.map(a => (a[x.id] || {}).value || {}).filter(v => v.match);
      steps.push({ cp: cp.id, id: x.id, title: x.match.question, kind: 'choice', n: list.length, bars: x.match.options.map(o => ({ label: o, n: list.filter(v => v.match === o).length })) });
    } else if (x.type === 'razbor') {
      const list = all.map(a => (a[x.id] || {}).value || {}).filter(v => (v.findings || []).length), count = {};
      list.forEach(v => new Set(v.findings.map(f => f.label || f.key)).forEach(l => { count[l] = (count[l] || 0) + 1; }));
      const main = list.map(v => v.findings.find(f => f.id === v.main)).filter(Boolean).map(f => (f.kind === 'knob' ? '🎛 ' : '') + f.text);
      steps.push({ cp: cp.id, id: x.id, title: x.title + ': находки', kind: 'choice', n: list.length,
        bars: Object.entries(count).sort((p, q) => q[1] - p[1]).slice(0, 8).map(([label, n]) => ({ label, n })), own: main.slice(-6) });
    } else if (x.type === 'obyasni') { // Б3: без имён — сколько объяснений сосед понял
      const t = explainTally(cls.code, les, x);
      steps.push({ cp: cp.id, id: x.id, title: x.title, kind: 'choice', n: t.n,
        bars: [{ label: '👍 Понял с первого раза', n: t.first }, { label: '👍 Понял со второй попытки', n: t.got - t.first }, { label: '🤔 Пока не понял', n: t.stuck.length }] });
    } else if (x.type === 'verify') {
      const list = all.map(a => ((a[x.id] || {}).value || {}).log || []).filter(l => l.length).map(l => l[l.length - 1].verdict);
      steps.push({ cp: cp.id, id: x.id, title: 'Ближе к задуманному чувству?', kind: 'choice', n: list.length,
        bars: [['yes', 'Да, ближе'], ['unknown', 'Не знаю'], ['worse', 'Хуже']].map(([k, label]) => ({ label, n: list.filter(v => v === k).length })) });
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
    fail: fg ? failPublic(cls) : null, failWhy: FAIL_WHY,
    fails: (cls.fails || []).filter(x => x.lesson === les.id).length, // показано провалов в этом уроке
  };
});
// «Провал дня» (А5): постоянная вкладка проектора. Учитель одним нажатием выбирает игру урока с самым смешным или поучительным багом,
// автор на своём экране соглашается (consent: ask → yes | no) — только тогда игра открывается на проекторе. Класс разбирает «почему так вышло»:
// учитель отмечает причины (why) и вывод (moral). Показанные провалы копятся в cls.fails — из них галерея провалов (Д5) и нарезка к Фестивалю.
const FAIL_WHY = ['🤖 ИИ понял просьбу по-своему', '🔢 Число на ручке не то', '🧩 Два правила мешают друг другу', '🚫 Не сказали, чего делать нельзя',
  '🧱 Герой ушёл за край мира', '⏱ Ломается не сразу, а со временем', '🎨 Красиво, но главного не видно', '💥 Игра упала: ошибка в коде'];
const failMembers = g => [g.nick, ...(g.members || [])];
function failPublic(cls) {
  const f = cls.fail, g = f && store.getGame(f.game);
  if (!g) return null;
  return Object.assign({}, f, { title: g.title, nick: g.nick, consent: f.consent || 'yes', why: f.why || [], versions: g.versions.map(v => ({ n: v.n, kind: v.kind || '', error: v.error ? v.error.message : null })) });
}
function failEvent(cls) { const f = failPublic(cls); broadcast(cls.code, 'fail', f ? { game: f.game, title: f.title, version: f.version, nicks: failMembers(store.getGame(f.game)), consent: f.consent } : { game: null }); }
function failRemember(cls) { // показанный провал — в историю класса (одна запись на игру и урок, последняя правка побеждает)
  const f = cls.fail; if (!f || f.consent !== 'yes') return;
  const g = store.getGame(f.game); if (!g) return;
  const old = (cls.fails || []).find(x => x.game === f.game && x.lesson === f.lesson);
  cls.fails = (cls.fails || []).filter(x => x !== old);
  cls.fails.push(Object.assign({ lesson: f.lesson, game: f.game, version: f.version, title: g.title, nick: g.nick, note: f.note || '', why: f.why || [], moral: f.moral || '', at: f.at }, old && old.hidden ? { hidden: true } : {})); // автор убрал из галереи (Д5) — так и остаётся
  if (cls.fails.length > 200) cls.fails = cls.fails.slice(-200);
}
// game: null — убрать; та же игра — правка версии, заметки и причин без нового согласия; другая игра — новый запрос согласия автору
route('POST', '/api/teacher/fail', (ctx) => {
  needTeacher(ctx);
  const cls = store.getClass(ctx.body.code);
  if (!cls) throw Object.assign(new Error('Нет класса'), { status: 404 });
  if (!ctx.body.game) { cls.fail = null; store.saveClass(cls); failEvent(cls); return { fail: null }; }
  const g = store.getGame(ctx.body.game);
  if (!g || g.class !== cls.code) throw Object.assign(new Error('Нет такой игры'), { status: 404 });
  const n = Number(ctx.body.version) || g.current;
  if (!g.versions[n - 1]) throw Object.assign(new Error('Нет такой версии'), { status: 400 });
  const same = cls.fail && cls.fail.game === g.id && cls.fail.lesson === cls.lesson ? cls.fail : null;
  const line = v => String(v || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  cls.fail = {
    lesson: cls.lesson, game: g.id, version: n, at: store.now(),
    note: line(ctx.body.note != null ? ctx.body.note : same && same.note), moral: line(ctx.body.moral != null ? ctx.body.moral : same && same.moral),
    why: (Array.isArray(ctx.body.why) ? ctx.body.why : (same && same.why) || []).filter(x => FAIL_WHY.includes(x)),
    consent: same ? same.consent : 'ask',
  };
  failRemember(cls);
  store.saveClass(cls);
  if (!same || same.consent !== cls.fail.consent) failEvent(cls);
  return { fail: failPublic(cls) };
});
// автор отвечает на «можно показать твой баг классу?»: да — игра открывается на проекторе, нет — учитель выбирает другую
route('POST', '/api/fail/consent', (ctx) => {
  const { w, cls } = needStudent(ctx);
  const f = cls.fail, g = f && store.getGame(f.game);
  if (!g || !failMembers(g).includes(w.nick)) throw Object.assign(new Error('Сейчас учитель не спрашивает про твою игру'), { status: 400 });
  f.consent = ctx.body.yes ? 'yes' : 'no';
  failRemember(cls);
  store.saveClass(cls); failEvent(cls);
  return { consent: f.consent };
});
// проектор и класс (аудит, сессия 2): театр сцены (В5), цель класса (Д2), живые реакции (Д3), галерея провалов (Д5)
const K = require('./lib/klass')({ route, needStudent, needTeacher, broadcast, store, lesson, stepOf, failMembers });
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
  const one = answers.classAnswers(les, [s], id => store.getGame(id));
  const answerList = one.steps.filter(x => one.students[0].answers[x.id]).map(x => Object.assign({ cp: x.cpTitle, step: x.title }, one.students[0].answers[x.id]));
  return { nick, answers: st.answers, answerList, plan: ai.planText(buildPlan(les, st)), game: g, discovery: g && g.current ? discovery(g) : null, feedback: st.feedback || null,
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
    const quiz = les.checkpoints.flatMap(cp => cp.steps).filter(x => ['sort', 'rounds', 'blind', 'listen', 'clues'].includes(x.type));
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
  if (p === '/student' || p === '/teacher' || p === '/arcade' || p === '/projector' || p === '/studio' || p === '/sheet') return serveFile(res, path.join(PUBLIC, p.slice(1) + '.html'));
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
