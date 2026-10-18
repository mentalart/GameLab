// ИИ портала: продюсер, программист (сборка, общая игра урока, правка, починка), демо-режим без ключа.
// Модели — через OpenAI-совместимый API (provod.ai). Ключ живёт только в config.json на сервере.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const store = require('./store');
const { systemPrompt, userTemplate, lessonSample, lessonModule } = require('../tools/build-prompt');

const PORTAL = path.resolve(__dirname, '..');
const CONFIG_FILE = process.env.LAB_CONFIG ? path.resolve(process.env.LAB_CONFIG) : path.join(PORTAL, 'config.json');

/* ---------------- настройки ---------------- */
let configCache = null;
function loadConfig() {
  if (configCache) return configCache;
  if (!fs.existsSync(CONFIG_FILE)) {
    const example = JSON.parse(fs.readFileSync(path.join(PORTAL, 'config.example.json'), 'utf8'));
    example.teacherPassword = crypto.randomBytes(4).toString('hex');
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(example, null, 2));
    console.log(`Создан ${path.relative(process.cwd(), CONFIG_FILE)}. Пароль учителя: ${example.teacherPassword}`);
  }
  configCache = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  configCache.ai = Object.assign({ baseUrl: 'https://api.provod.ai/v1', apiKey: '', codeModel: '', textModel: '', stream: true, timeoutSec: 240, maxSec: 1200, temperature: 0.4, cache: 'auto', cacheTtl: '' }, configCache.ai || {});
  configCache.limits = Object.assign({ aiCallsPerStudentPerLesson: 40, rublesPerLesson: 0 }, configCache.limits || {});
  configCache.models = configCache.models || [];
  return configCache;
}
function reloadConfig() { configCache = null; return loadConfig(); }
const demo = () => !loadConfig().ai.apiKey;
function models() {
  const c = loadConfig(), s = store.settings();
  const code = s.codeModel || c.ai.codeModel;
  // связка карт — замысел для программиста: без отдельной linkModel её пишет модель программиста, а не быстрая текстовая
  // продюсер без своей textModel — тоже модель программиста (по умолчанию Claude Sonnet, решение автора 17.10.2026)
  return { code, text: s.textModel || c.ai.textModel || code, link: s.linkModel || c.ai.linkModel || code };
}
// лимиты: config.json, поверх — то, что учитель поменял в панели (data/settings.json)
function limits() { return Object.assign({}, loadConfig().limits, store.settings().limits || {}); }
function price(model) { return loadConfig().models.find(m => m.id === model) || {}; }
// inT — все входящие токены вместе с кэшем; cached — прочитанные из кэша, written — записанные в кэш.
// Цены кэша — rubPer1MCacheRead и rubPer1MCacheWrite; если их нет, кэш считается по цене обычного входа.
function rubles(model, inT, outT, cached = 0, written = 0) {
  const p = price(model);
  if (p.rubPer1MIn == null || p.rubPer1MOut == null) return null;
  const fresh = Math.max(0, (inT || 0) - cached - written);
  const read = p.rubPer1MCacheRead == null ? p.rubPer1MIn : p.rubPer1MCacheRead;
  const write = p.rubPer1MCacheWrite == null ? p.rubPer1MIn : p.rubPer1MCacheWrite;
  return Math.round((fresh * p.rubPer1MIn + cached * read + written * write + (outT || 0) * p.rubPer1MOut) / 1e4) / 100;
}

/* ---------------- кэш промпта ---------------- */
// Системный промпт программиста (около 25–28 тысяч токенов) одинаков для всего класса на уроке, поэтому провайдер может
// держать его в кэше: повторное чтение у Claude стоит в 10 раз дешевле обычного входа. OpenAI, Gemini, DeepSeek и Qwen
// кэшируют одинаковое начало запроса сами. Claude кэширует только по явной метке cache_control в системном сообщении.
// ai.cache: "auto" — метка для моделей claude-*, "on" — для всех, "off" — без метки; поле cache у модели в models важнее.
function explicitCache(model) {
  const p = price(model);
  if (typeof p.cache === 'boolean') return p.cache;
  const mode = loadConfig().ai.cache;
  if (mode === 'off' || mode === false) return false;
  if (mode === 'on' || mode === true) return true;
  return /claude|anthropic/i.test(model);
}
function withCache(model, messages) {
  if (!explicitCache(model)) return messages;
  const ttl = loadConfig().ai.cacheTtl;
  const mark = Object.assign({ type: 'ephemeral' }, ttl ? { ttl } : {});
  return messages.map(m => m.role === 'system' && typeof m.content === 'string'
    ? { role: 'system', content: [{ type: 'text', text: m.content, cache_control: mark }] } : m);
}
const textLength = c => typeof c === 'string' ? c.length : (c || []).reduce((n, p) => n + String(p.text || '').length, 0);
// Кэш в ответе: OpenAI-формат (prompt_tokens_details) или формат Anthropic (cache_read/cache_creation_input_tokens).
function cacheUsage(u) {
  const d = u.prompt_tokens_details || {};
  const cached = d.cached_tokens || u.cache_read_input_tokens || 0;
  const written = d.cache_write_tokens || d.cache_creation_tokens || u.cache_creation_input_tokens || 0;
  // У Anthropic prompt_tokens может не включать кэш — тогда вход целиком = обычный + кэш
  const inT = (u.prompt_tokens || 0) < cached + written ? (u.prompt_tokens || 0) + cached + written : (u.prompt_tokens || 0);
  return { inT, cached, written };
}

/* ---------------- вызов модели ---------------- */
// Модели без параметра temperature (Claude Sonnet 5 и новее): провайдер отвечает 400 unsupported_parameter.
// Такую модель портал запоминает и повторяет запрос без temperature; Claude — сразу без него.
const noTemperature = new Set();
const skipsTemperature = model => noTemperature.has(model) || /claude|anthropic/i.test(model || '');
async function chat(opts) {
  try { return await chatOnce(opts); } catch (e) {
    if (e.status === 400 && /temperature/.test(e.body || '') && /unsupported|not support/i.test(e.body || '') && !skipsTemperature(opts.model)) {
      noTemperature.add(opts.model);
      return chatOnce(opts);
    }
    throw e;
  }
}
async function chatOnce({ model, messages, onProgress, temperature }) {
  const c = loadConfig().ai;
  // timeoutSec — сколько модель может молчать (до первого знака и между кусками потока), maxSec — предел на весь ответ.
  // Игра целиком — 10–20 тысяч токенов, и живой поток идёт дольше 240 с, поэтому общий предел отдельный и больше.
  const ctrl = new AbortController();
  let why = '', timer = null;
  const abort = w => { why = w; ctrl.abort(); };
  const idle = () => { clearTimeout(timer); timer = setTimeout(() => abort('idle'), (c.timeoutSec || 240) * 1000); };
  const hard = setTimeout(() => abort('max'), (c.maxSec || 1200) * 1000);
  if (c.stream) idle();
  const t0 = Date.now();
  try {
    const body = { model, messages: withCache(model, messages) };
    if (!skipsTemperature(model)) body.temperature = temperature == null ? c.temperature : temperature;
    if (c.stream) { body.stream = true; body.stream_options = { include_usage: true }; }
    const res = await fetch(c.baseUrl.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + c.apiKey },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw Object.assign(new Error(`Модель ответила ${res.status}: ${t.slice(0, 300)}`), { status: res.status, body: t });
    }
    let text = '', usage = null;
    const type = res.headers.get('content-type') || '';
    if (c.stream && type.includes('event-stream')) {
      const dec = new TextDecoder();
      let buf = '';
      for await (const chunk of res.body) {
        idle();
        buf += dec.decode(chunk, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') continue;
          try {
            const j = JSON.parse(data);
            const d = j.choices && j.choices[0] && (j.choices[0].delta || j.choices[0].message);
            if (d && d.content) { text += d.content; if (onProgress) onProgress(text.length); }
            if (j.usage) usage = j.usage;
          } catch (e) { /* служебная строка */ }
        }
      }
    } else {
      const j = await res.json();
      text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
      usage = j.usage || null;
      if (onProgress) onProgress(text.length);
    }
    const cu = usage ? cacheUsage(usage) : { inT: Math.round(messages.reduce((n, m) => n + textLength(m.content), 0) / 3), cached: 0, written: 0 };
    const outT = usage ? usage.completion_tokens : Math.round(text.length / 3);
    return { text, ms: Date.now() - t0, tokensIn: cu.inT, tokensOut: outT, tokensCached: cu.cached, tokensCacheWrite: cu.written, estimated: !usage };
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(why === 'max' ? `Модель писала ответ дольше ${c.maxSec || 1200} с` : `Модель молчала дольше ${c.timeoutSec || 240} с`);
    throw e;
  } finally { clearTimeout(timer); clearTimeout(hard); }
}

async function listModels() {
  const c = loadConfig().ai;
  if (!c.apiKey) throw new Error('Ключ не задан: портал в демо-режиме');
  const res = await fetch(c.baseUrl.replace(/\/$/, '') + '/models', { headers: { Authorization: 'Bearer ' + c.apiKey } });
  if (!res.ok) throw new Error(`Провайдер ответил ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return (j.data || []).map(m => m.id).sort();
}

/* ---------------- код игры ---------------- */
function extractCode(text) {
  const blocks = [...String(text).matchAll(/```(?:js|javascript)?\s*\n([\s\S]*?)```/g)].map(m => m[1]);
  let code = blocks.find(b => /\bGAME\b/.test(b)) || (/const\s+GAME\s*=/.test(text) ? text : '') || htmlPage(text);
  code = code.trim();
  if (!code) throw new Error('В ответе модели нет кода игры');
  return code + '\n';
}
// Игра страницей HTML без оболочки Лаб3D: чат Qwen на просьбу «игру на html» может прислать готовую страницу вместо объекта GAME.
// Портал её принимает и показывает как есть в той же песочнице, но без рекордов, ручек и автопочинки.
const isHtml = code => /^\s*(<!doctype html|<html)/i.test(code || '');
function htmlPage(text) {
  const m = /(<!doctype html[\s\S]*?<\/html>|<html[\s\S]*?<\/html>)/i.exec(String(text));
  return m && !/\bconst\s+GAME\s*=/.test(m[1]) ? m[1] : '';
}
function syntaxError(code) {
  if (isHtml(code)) return null;
  try { new vm.Script(code, { filename: 'game.js' }); return null; } catch (e) {
    const m = /game\.js:(\d+)/.exec(e.stack || '');
    return { message: e.message, line: m ? Number(m[1]) : null };
  }
}
const FORBIDDEN = [/\bdocument\./, /\bwindow\./, /\blocalStorage\b/, /\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\beval\s*\(/, /new\s+Function\b/, /\bimport\s*\(/, /^\s*import\s/m, /\bsetInterval\s*\(/, /\bMath\.random\s*\(/];
function lint(code) { if (isHtml(code)) return ['страница HTML без оболочки Лаб3D: нет рекордов, ручек и автопочинки']; return FORBIDDEN.filter(r => r.test(code)).map(r => String(r).replace(/\\b|\\s\*|\\|\/|\^|\$/g, '').replace(/m$/, '')); }

const fill = (tpl, map) => Object.entries(map).reduce((s, [k, v]) => s.split('[' + k + ']').join(v == null || v === '' ? '—' : String(v)), tpl);

/* ---------------- журнал ---------------- */
function log(entry) { store.logGen(entry); return entry; }
// кто и для какой игры: build — id сборки, по нему отчёт связывает сборку, починки синтаксиса и сборки без игры
const meta = who => ({ class: who.class, nick: who.nick, lesson: who.lesson, game: who.game || undefined, build: who.build || undefined });

async function call(kind, who, model, messages, onProgress) {
  const r = await chat({ model, messages, onProgress });
  const entry = Object.assign({ kind, model, ms: r.ms, tokensIn: r.tokensIn, tokensOut: r.tokensOut, tokensCached: r.tokensCached, tokensCacheWrite: r.tokensCacheWrite, estimated: r.estimated,
    rub: rubles(model, r.tokensIn, r.tokensOut, r.tokensCached, r.tokensCacheWrite) }, meta(who));
  return { text: r.text, entry };
}

/* ---------------- программист в chat.qwen.ai (урок 1, версия 2) ---------------- */
// В уроке с programmer: 'chat' программист — Qwen в бесплатном веб-чате, а не API: портал не зовёт модель, а выдаёт текст
// для чата и ждёт, пока человек вставит ответ (задание ждёт в состоянии waiting — startJob и /api/job/answer в server.js).
// Дальше всё как с API: код достаётся из ответа, синтаксис проверяется, куски правки вставляются; если не вышло —
// портал выдаёт следующее сообщение в тот же чат. Продюсер, связка и черновик отзыва остаются на API.
const CHAT = {
  model: 'chat.qwen.ai', url: 'https://chat.qwen.ai/',
  phrase: 'собери яркую lowpoly 3d игру для школьников на html', // просьба автора курса (18.10.2026) в конце каждого задания на новую игру
  // напоминание о том, что нужно порталу (автор курса, 18.10.2026): правила целиком выше, здесь — короткий чек-лист в конце, где чат читает внимательнее
  format: [
    'Формат ответа — как сказано выше: один блок ```js с объектом GAME для оболочки Лаб3D, ни слова до и после. Страница HTML с Babylon.js в портале уже есть: не пиши <html>, <script> и не подключай библиотеки.',
    'Обязательно для портала:',
    '- управление и с клавиатуры, и с джойстика (геймпада): ввод только через lab.p1 / lab.p2 (left right up down a b, оси x и y), кнопки описаны в controls — тогда оболочка сама покажет кнопки геймпада и тача;',
    '- ручки геймдизайнера: каждое важное число — в config (value, min, max, step, label), в коде lab.cfg.имя; пресет «Новичок» и 1–2 своих в presets;',
    '- если в задании есть секрет — отдельная ручка secret (0 — выключен, 1 — включён) и lab.count(\'_secret\') каждый раз, когда секрет срабатывает;',
    '- lab.hero(герой) в start, очки через lab.addScore, урон через lab.hurt, конец партии через оболочку, lab.count для ключевых событий, overNote;',
    '- decisions — три решения ученика, notes — что ты решил сам; своё название, без чужих брендов;',
    '- без document, window, fetch, localStorage, setTimeout, setInterval и Math.random (случайность — lab.rand).',
  ].join('\n'),
};
const manual = lessonId => { const l = lessonModule(lessonId); return !!(l && l.programmer === 'chat'); };
const programmerDemo = lessonId => demo() && !manual(lessonId);
// Первое сообщение задания — правила и задание целиком (prompt, для нового чата) и только задание (short, для чата, где правила уже есть).
// Следующие сообщения того же задания (ответ не подошёл, повтор) — только новый текст в тот же чат.
async function chatCall(kind, who, messages, onProgress, newGame) {
  if (!onProgress || !onProgress.ask) throw new Error('Программист работает через chat.qwen.ai: ответ некуда вставить');
  const system = messages[0].content, user = messages[messages.length - 1].content;
  const tail = newGame ? `\n\n${CHAT.phrase}\n${CHAT.format}` : '';
  const q = onProgress.asked ? { prompt: user, followUp: true } : { prompt: `${system}\n\n# Задание\n${user}${tail}`, short: user + tail };
  onProgress.asked = (onProgress.asked || 0) + 1;
  const t0 = Date.now();
  const text = await onProgress.ask(Object.assign({ kind, url: CHAT.url }, q));
  return { text, entry: Object.assign({ kind, model: CHAT.model, ms: Date.now() - t0, chars: text.length, manual: true, rub: 0 }, meta(who)) };
}
// ответ из чата оборвался: незакрытый блок кода, незакрытый кусок правки, страница без </html> или код игры без конца
function truncated(text) {
  text = String(text || '');
  if ((text.match(/^\s*```/gm) || []).length % 2) return true;
  if ((text.match(/<<<<<<< НАЙТИ/g) || []).length > (text.match(/>>>>>>> ЗАМЕНИТЬ/g) || []).length) return true;
  if (/<html/i.test(text) && !/<\/html>/i.test(text)) return true;
  const i = text.search(/const\s+GAME\s*=/);
  if (i >= 0 && !/```/.test(text)) { const e = syntaxError(text.slice(i)); if (e && /end of input|Unterminated/i.test(e.message)) return true; }
  return false;
}
// склейка оборванного ответа с продолжением: без обёртки ``` в начале продолжения и без повтора конца первой части
function joinParts(a, b) {
  a = String(a); b = String(b);
  if ((a.match(/^\s*```/gm) || []).length % 2) { const m = /^[\s\S]*?```[\w-]*[ \t]*\r?\n/.exec(b); if (m && m[0].split('\n').length <= 4) b = b.slice(m[0].length); }
  const tail = a.slice(a.lastIndexOf('\n') + 1);
  if (tail.trim() && b.trimStart().startsWith(tail.trim())) { a = a.slice(0, a.length - tail.length); b = b.replace(/^[ \t]*\r?\n?/, ''); const ind = /^[ \t]*/.exec(tail)[0]; if (!b.startsWith(ind)) b = ind + b.trimStart(); return a + b; }
  for (let k = Math.min(a.length, b.length, 3000); k >= 20; k--) if (a.endsWith(b.slice(0, k))) return a + b.slice(k);
  return a + b;
}

/* ---------------- продюсер ---------------- */
function producerSystem(lessonTitle) {
  const t = fs.readFileSync(path.join(PORTAL, 'ai', 'producer-prompt.md'), 'utf8');
  const a = t.indexOf('<!-- prompt:start -->'), b = t.indexOf('<!-- prompt:end -->');
  return t.slice(a + 21, b).trim().split('{{УРОК}}').join(lessonTitle);
}
function planText(plan) {
  return [
    `Название: ${plan.title}`, `Донор: ${plan.donor}`, `Твист: ${plan.twist}`, `Мир: ${plan.world}`, plan.secret ? `Секрет (карта секрета): ${plan.secret.title}` : '', `Уровень: ${plan.level}`,
    plan.details.length ? 'Детали:\n' + plan.details.join('\n') : '',
    `Чувство: ${plan.decisions.feeling}`, `Честность: ${plan.decisions.honesty}`, `Выбор: ${plan.decisions.choice}`,
    `И — идея и чувство: ${plan.igra.i}`, `Г — глагол и кнопки: ${plan.igra.g}`, `Р — правила: ${plan.igra.r}`, `А — атмосфера: ${plan.igra.a}`,
  ].filter(Boolean).join('\n');
}
function parseProducer(text) {
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  const j = JSON.parse(text.slice(a, b + 1));
  return {
    praise: String(j.praise || ''),
    findings: (j.findings || []).slice(0, 5).map(f => ({ kind: String(f.kind || 'находка'), text: String(f.text || '') })).filter(f => f.text),
    forks: (j.forks || []).slice(0, 3).map(f => ({ question: String(f.question || ''), options: (f.options || []).slice(0, 3).map(String) })).filter(f => f.question && f.options.length >= 2),
    frame: String(j.frame || '').trim().slice(0, 120), // каркас игры ученика: по нему Claude получает образец того же каркаса
  };
}
// правка промпта ИГРА продюсером: его разбор (находки, развилки и выбор автора) → четыре поля ИГРА заново и что изменено.
// Ученик видит «было → стало» и сам решает, принять ли правку.
function promptSection(file, start, end) {
  const t = fs.readFileSync(path.join(PORTAL, 'ai', file), 'utf8');
  const a = t.indexOf(start), b = t.indexOf(end);
  if (a < 0 || b < a) throw new Error(`В ${file} нет меток ${start} … ${end}`);
  return t.slice(a + start.length, b).trim();
}
const lessonLine = lesson => `${lesson.title} (донор: ${lesson.donor})${lesson.producer && lesson.producer.focus ? '. Особо проверь: ' + lesson.producer.focus : ''}`;
function reviewText(result, choices) {
  return [
    'Твои находки:', ...(result.findings.length ? result.findings.map(f => `- [${f.kind}] ${f.text}`) : ['- находок нет']),
    'Развилки и выбор автора:', ...(result.forks.length ? result.forks.map((f, i) => `- ${f.question} → ${(choices || {})[i] || 'автор не выбрал (варианты: ' + f.options.join(' / ') + ')'}`) : ['- развилок нет']),
  ].join('\n');
}
const cleanText = (v, n = 600) => String(v == null ? '' : v).trim().slice(0, n);
function parseFix(text) {
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  const j = JSON.parse(text.slice(a, b + 1)), g = j.igra || {};
  const igra = { i: cleanText(g.i), g: cleanText(g.g), r: cleanText(g.r), a: cleanText(g.a) };
  if (!igra.i || !igra.g || !igra.r || !igra.a) throw new Error('продюсер вернул не все поля ИГРА');
  return { igra, changes: (Array.isArray(j.changes) ? j.changes : []).slice(0, 8).map(x => cleanText(x, 300)).filter(Boolean) };
}
async function producerFix(plan, review, lesson, who) {
  if (demo()) return demoProducerFix(plan, review, who);
  const model = models().text;
  const t0 = Date.now();
  try {
    const { text, entry } = await call('правка продюсера', who, model, [
      { role: 'system', content: promptSection('producer-prompt.md', '<!-- fix:start -->', '<!-- fix:end -->').split('{{УРОК}}').join(lessonLine(lesson)) },
      { role: 'user', content: 'Замысел ученика:\n' + planText(plan) + '\n\n' + reviewText(review.result, review.choices) + '\n\nПерепиши промпт ИГРА.' },
    ]);
    let r;
    try { r = parseFix(text); entry.ok = true; } catch (e) { entry.ok = false; entry.error = 'правка продюсера: ' + e.message; log(entry); throw new Error('Продюсер ответил не по форме — попробуй ещё раз'); }
    log(entry);
    return keepTwist(plan, r);
  } catch (e) { if (!/не по форме/.test(e.message)) log(Object.assign({ kind: 'правка продюсера', model, ms: Date.now() - t0, ok: false, error: e.message }, meta(who))); throw e; }
}
// твист — сердце замысла: если в промпте ИГРА он был, а после правки продюсера пропал, он возвращается в правила словами автора
const stems = t => [...new Set(String(t || '').toLowerCase().replace(/ё/g, 'е').match(/[а-яa-z]{5,}/g) || [])].map(w => w.slice(0, 5));
function keepTwist(plan, r) {
  const st = stems(plan.twist);
  if (!st.length) return r;
  const has = igra => { const t = stems(Object.values(igra || {}).join(' ')); return st.some(w => t.includes(w)); };
  if (!has(plan.igra) || has(r.igra)) return r;
  return Object.assign({}, r, { igra: Object.assign({}, r.igra, { r: `${r.igra.r} Твист: ${plan.twist}.`.trim() }), changes: r.changes.concat('Вернул твой твист в правила: это сердце игры, его нельзя терять.') });
}
// демо: решения развилок дописываются в правила, кнопки — в глагол, если их не было
function demoProducerFix(plan, review, who) {
  const igra = Object.assign({}, plan.igra), changes = [];
  const picked = review.result.forks.map((f, i) => [f, (review.choices || {})[i] || f.options[0]]);
  if (picked.length) { igra.r = `${igra.r} ${picked.map(([f, c]) => `${f.question.replace(/\?$/, '')}: ${c}.`).join(' ')}`.trim(); changes.push('Вписал в правила решения развилок' + (picked.some(([, c], i) => !(review.choices || {})[i]) ? ' (где ты не выбрал, взял первый вариант)' : '') + '.'); }
  if (!/кнопк|пробел|стрелк|\bA\b|\bB\b|←|→|клавиш/i.test(igra.g)) { igra.g = `${igra.g} Стрелки — двигаться, пробел — главное действие (на геймпаде крестовина и A).`.trim(); changes.push('Назвал кнопки для каждого действия.'); }
  if (!changes.length) changes.push('Демо-режим: продюсер без модели правит только развилки и кнопки — здесь править нечего.');
  log(Object.assign({ kind: 'правка продюсера', model: 'демо', ms: 0, ok: true, demo: true }, meta(who)));
  return { igra, changes, demo: true };
}

/* ---------------- связка карт вау-старта: геймдизайнер сводит четыре карты в одну игру ---------------- */
// поля связки: ключ и подпись — в таком порядке их видит учитель и получает программист
const LINK_FIELDS = [['phrase', 'Фраза игры'], ['frame', 'Каркас и камера'], ['controls', 'Кнопки'], ['loop', 'Главный цикл'], ['risk', 'Риск и очки'],
  ['threats', 'Угрозы'], ['curve', 'Нарастание'], ['twist', 'Поворот × действие'], ['funny', 'Главный смешной момент']];
function parseLink(text) {
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  const j = JSON.parse(text.slice(a, b + 1));
  const link = {};
  for (const [k] of LINK_FIELDS) link[k] = cleanText(j[k], 400);
  if (!link.phrase || !link.loop) throw new Error('нет фразы игры');
  return link;
}
async function wowLink(cards, prev, who) {
  if (demo()) return demoLink(cards, who);
  const model = models().link;
  const t0 = Date.now();
  const user = ['Карты:', `- Герой: ${cards.hero}`, `- Действие: ${cards.action}`, `- Место: ${cards.place}`, `- Поворот: ${cards.twist}`,
    prev ? `\nУчитель попросил другую связку. Прошлая была: «${prev.phrase}»${prev.frame ? ` (${prev.frame})` : ''} — найди другое чтение карт, лучше в другом каркасе.` : ''].filter(Boolean).join('\n');
  try {
    const { text, entry } = await call('связка карт', who, model, [
      { role: 'system', content: promptSection('link-prompt.md', '<!-- prompt:start -->', '<!-- prompt:end -->') },
      { role: 'user', content: user },
    ]);
    let link;
    try { link = parseLink(text); entry.ok = true; } catch (e) { entry.ok = false; entry.error = 'связка: ' + e.message; log(entry); throw new Error('Геймдизайнер ответил не по форме — попросите другую связку'); }
    log(entry);
    return Object.assign(link, { model });
  } catch (e) { if (!/не по форме/.test(e.message)) log(Object.assign({ kind: 'связка карт', model, ms: Date.now() - t0, ok: false, error: e.message }, meta(who))); throw e; }
}
function demoLink(cards, who) {
  log(Object.assign({ kind: 'связка карт', model: 'демо', ms: 0, ok: true, demo: true }, meta(who)));
  return {
    phrase: `Ты — ${cards.hero}. Главное действие: ${cards.action}. Место: «${cards.place}». Поворот: ${cards.twist}. Цель — продержаться и набрать рекорд класса.`,
    frame: 'Арена, изометрия: всё поле видно целиком, герой бегает по нему.',
    controls: `Движение — бегать, A — ${cards.action}, B не нужна.`,
    loop: `Каждые несколько секунд: ${cards.action} — и сразу видно, попал ли ты; промах стоит времени.`,
    risk: 'Действие рядом с опасностью даёт очки ×2.',
    threats: 'Одни угрозы идут прямо, другие заходят сбоку; касание отнимает жизнь.',
    curve: 'К 30-й секунде — второй вид угроз, к 60-й — быстрее, к 90-й — всё вместе.',
    twist: `Поворот «${cards.twist}» меняет то, как работает главное действие: им можно и помешать себе, и выиграть.`,
    funny: 'Демо-режим: без ключа ИИ связка собрана по шаблону из карт.', model: 'демо', demo: true,
  };
}
const linkText = link => (link ? ['Связка геймдизайнера — класс принял её до сборки, строй игру по ней: каркас, камеру, кнопки, риск и угрозы бери отсюда.', ...LINK_FIELDS.filter(([k]) => link[k]).map(([k, label]) => `- ${label}: ${link[k]}`)].join('\n')
  : 'Связки геймдизайнера нет: найди чтение карт сам — одну понятную, напряжённую и смешную игру.');

async function producer(plan, lesson, who) {
  if (demo()) return demoProducer(plan, who, lesson);
  const model = models().text;
  const t0 = Date.now();
  try {
    const { text, entry } = await call('продюсер', who, model, [
      { role: 'system', content: producerSystem(`${lesson.title} (донор: ${lesson.donor})${lesson.producer && lesson.producer.focus ? '. Особо проверь: ' + lesson.producer.focus : ''}`) },
      { role: 'user', content: 'Замысел ученика:\n' + planText(plan) },
    ]);
    let result;
    try { result = parseProducer(text); entry.ok = true; } catch (e) { entry.ok = false; entry.error = 'продюсер вернул не JSON'; result = { praise: '', findings: [], forks: [], raw: text.slice(0, 1500) }; }
    log(entry);
    return result;
  } catch (e) { log(Object.assign({ kind: 'продюсер', model, ms: Date.now() - t0, ok: false, error: e.message }, meta(who))); throw e; }
}
// demoForks в сценарии урока — развилки под донора урока, чтобы демо-продюсер не приносил волну пришельцев в «Тетрис»
function demoProducer(plan, who, lesson) {
  const findings = [], forks = [];
  const all = [plan.igra.i, plan.igra.g, plan.igra.r, plan.igra.a].join(' ');
  if (plan.diceCount >= 3) findings.push({ kind: 'кубик', text: `Кубику оставлено полей: ${plan.diceCount}. Скажи хотя бы одно из них своими словами — так игра станет твоей.` });
  if (!/кнопк|пробел|стрелк|\bA\b|\bB\b|←|→|клавиш/i.test(plan.igra.g)) findings.push({ kind: 'без кнопки', text: 'В «Глаголе и кнопках» не видно, какой кнопкой игрок действует. Назови кнопку для каждого действия.' });
  if (!/рекорд|вдвоём|второй игрок|вызов|зерн|соревн/i.test(all)) forks.push({ question: 'Как с этой игрой соревноваться?', options: ['Рекорд класса: побей рекорд автора', 'Вдвоём на одном экране', 'Вызов на зерне: у всех одна и та же волна'] });
  if (lesson && lesson.demoForks) forks.push(...lesson.demoForks);
  else forks.push({ question: 'Как растёт напряжение к концу волны?', options: ['Волна ускоряется с каждым сбитым, как в доноре', 'Чем меньше врагов, тем чаще они стреляют', 'Каждая новая волна начинается ниже'] });
  log(Object.assign({ kind: 'продюсер', model: 'демо', ms: 0, ok: true, demo: true }, meta(who)));
  return { praise: 'Демо-режим: продюсер без модели проверяет только кнопки, кубики и крючок.', findings, forks };
}

/* ---------------- черновик отзыва учителя: одно понятие + один вопрос ---------------- */
// По телеметрии соседей, их тап-карточкам и замыслу ученика текстовая модель выбирает понятие и вопрос (лучше из колод урока).
// Без ключа или если модель ответила не по форме — правила по телеметрии. Учитель правит черновик и отправляет сам.
function draftInput(d) {
  const x = d.discovery || {};
  return [
    `Урок: ${d.lesson}`, `Игра: «${d.title}»`, `Ученик задумал чувство: ${d.feeling || '—'}`, d.secret ? `Его секрет: ${d.secret}` : '',
    `Партий соседей: ${x.rounds || 0}, игроков: ${x.players || 0}, нажали «ещё раз»: ${x.again || 0}`,
    x.dominant ? `Дольше всего держали: ${x.dominant.name} — ${Math.round(x.dominant.share * 100)}% времени партии` : '',
    Object.keys(x.emotions || {}).length ? 'Эмоции соседей: ' + Object.entries(x.emotions).map(([e, n]) => `${e} ×${n}`).join(', ') : '',
    ...(x.cards || []).slice(0, 6).map(c => `Карточка соседа: нравится — ${c.like && c.like.text || '—'}; хочется — ${c.want && c.want.text || '—'}; а что если — ${c.whatif && c.whatif.text || '—'}`),
    d.blind && d.blind.voted ? `Слепая пара: секрет почувствовали ${d.blind.felt} из ${d.blind.voted}` : '',
    'Колода понятий урока:', ...d.concepts.map(c => '- ' + c), 'Колода вопросов урока:', ...d.questions.map(q => '- ' + q),
  ].filter(Boolean).join('\n');
}
function ruleDraft(d) {
  const x = d.discovery || {}, em = x.emotions || {};
  const find = (deck, re, fallback) => deck.find(t => re.test(t)) || fallback || deck[0] || '';
  const C = d.concepts, Q = d.questions;
  let concept, question, why;
  if (x.dominant && x.dominant.share >= 0.6) { concept = find(C, /доминир/i); question = find(Q, /цена/i); why = `соседи ${Math.round(x.dominant.share * 100)}% партии держали ${x.dominant.name}`; }
  else if (d.blind && d.blind.voted && d.blind.felt * 2 < d.blind.voted) { concept = find(C, /секрет/i); question = find(Q, /ручка|чувство/i); why = `секрет почувствовали только ${d.blind.felt} из ${d.blind.voted}`; }
  else if (em['😴 Скучно']) { concept = find(C, /нараст/i); question = find(Q, /последней секунде|чувство/i); why = 'соседям было скучно'; }
  else if (em['😤 Обидно']) { concept = find(C, /честност/i); question = find(Q, /опасност/i); why = 'соседям было обидно проигрывать'; }
  else if (em['🤔 Непонятно']) { concept = find(C, /цель/i); question = find(Q, /чаще всего|задумал/i); why = 'соседям было непонятно'; }
  else if (x.rounds && !x.again) { concept = find(C, /ещё раз|повод/i); question = find(Q, /ещё раз/i); why = 'никто не нажал «ещё раз»'; }
  else { concept = find(C, /цикл/i); question = find(Q, /чаще всего|задумал/i); why = 'общий вопрос о главном действии'; }
  return { concept, question, why, model: 'правила' };
}
async function feedbackDraft(d, who) {
  if (demo()) return ruleDraft(d);
  const model = models().text;
  const t0 = Date.now();
  try {
    const { text, entry } = await call('черновик отзыва', who, model, [
      { role: 'system', content: promptSection('feedback-prompt.md', '<!-- prompt:start -->', '<!-- prompt:end -->') },
      { role: 'user', content: draftInput(d) },
    ]);
    try {
      const a = text.indexOf('{'), b = text.lastIndexOf('}'), j = JSON.parse(text.slice(a, b + 1));
      const r = { concept: cleanText(j.concept, 300), question: cleanText(j.question, 300), why: cleanText(j.why, 300), model };
      if (!r.concept || !r.question) throw new Error('нет понятия или вопроса');
      entry.ok = true; log(entry);
      return r;
    } catch (e) { entry.ok = false; entry.error = 'черновик отзыва: ' + e.message; log(entry); return ruleDraft(d); }
  } catch (e) { log(Object.assign({ kind: 'черновик отзыва', model, ms: Date.now() - t0, ok: false, error: e.message }, meta(who))); return ruleDraft(d); }
}

/* ---------------- программист ---------------- */
// карта секрета (урок 1): секрет своей игры в ручке secret — правила те же, что у игры класса (шаблон user:secret)
function newGameMessage(plan) {
  const secret = plan.secret ? fill(userTemplate('secret'), { 'секрет': plan.secret.prompt }) + '\n\n' : '';
  return fill(userTemplate('new').replace('[секрет своей игры]\n', secret), {
    'донор': plan.donor, 'твист': plan.twist, 'мир': plan.world, 'уровень': plan.level,
    'название': plan.title, 'каркас': plan.frame || 'как у донора урока', 'детали': plan.details.length ? 'Детали замысла:\n' + plan.details.join('\n') : '',
    'находки': plan.findings && plan.findings.length ? plan.findings.map(f => '- ' + f).join('\n') : 'замечаний нет',
    'чувство': plan.decisions.feeling, 'честность': plan.decisions.honesty, 'выбор': plan.decisions.choice,
    'идея': plan.igra.i, 'глагол': plan.igra.g, 'правила': plan.igra.r, 'атмосфера': plan.igra.a,
    'развилки': plan.forks.length ? plan.forks.map(f => `- ${f.question} → ${f.answer}`).join('\n') : 'развилок не было',
  });
}

// Правка кусками (решение автора 17.10.2026): модель присылает только заменяемые куски, портал вставляет их в код сам —
// ответ в разы короче всей игры. Кусок: «<<<<<<< НАЙТИ / дословные строки / ======= / новые строки / >>>>>>> ЗАМЕНИТЬ».
const PATCH_RE = /<<<<<<< НАЙТИ\r?\n([\s\S]*?)\r?\n=======\r?\n([\s\S]*?)\r?\n?>>>>>>> ЗАМЕНИТЬ/g;
function applyPatches(code, text) {
  const failed = []; let count = 0, m;
  PATCH_RE.lastIndex = 0;
  while ((m = PATCH_RE.exec(text))) {
    count++;
    const find = m[1], repl = m[2], i = find ? code.indexOf(find) : -1;
    if (i < 0 || code.indexOf(find, i + 1) >= 0) { failed.push(`«${(find.trim().split('\n')[0] || '').slice(0, 100)}» — ${i < 0 ? 'нет в коде' : 'встречается не один раз'}`); continue; }
    code = code.slice(0, i) + repl + code.slice(i + find.length);
  }
  return { code, count, failed };
}
async function patchProgram(kind, code, firstUser, who, onProgress, popts, model) {
  const viaChat = manual(who && who.lesson);
  model = viaChat ? CHAT.model : model || models().code;
  const system = systemPrompt(Object.assign({ lesson: who && who.lesson, model, short: viaChat }, popts));
  let messages = [{ role: 'system', content: system }, { role: 'user', content: firstUser }];
  const attempts = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const t0 = Date.now();
    let res;
    try { res = viaChat ? await chatCall(attempt ? kind + ': повтор' : kind, who, messages, onProgress) : await call(attempt ? kind + ': повтор' : kind, who, model, messages, onProgress); } catch (e) {
      log(Object.assign({ kind, model, ms: Date.now() - t0, ok: false, error: e.message }, meta(who)));
      throw e;
    }
    const p = applyPatches(code, res.text);
    let problem = !p.count ? 'в ответе нет ни одного куска «<<<<<<< НАЙТИ … >>>>>>> ЗАМЕНИТЬ»' : p.failed.length ? 'эти куски не легли: ' + p.failed.join('; ') : '';
    const err = problem ? null : syntaxError(p.code);
    if (err) problem = `после правки ошибка синтаксиса: ${err.message}${err.line ? ' (строка ' + err.line + ')' : ''}`;
    res.entry.ok = !problem; if (problem) res.entry.error = problem;
    res.entry.patches = p.count;
    attempts.push(log(res.entry));
    if (!problem) return { code: p.code, model, attempts: attempts.length, patches: p.count, warnings: lint(p.code), ms: attempts.reduce((n, e) => n + (e.ms || 0), 0), rub: attempts.some(e => e.rub != null) ? Math.round(attempts.reduce((n, e) => n + (e.rub || 0), 0) * 100) / 100 : null };
    if (onProgress) onProgress(0, 'повтор правки');
    messages = messages.concat([{ role: 'assistant', content: res.text }, { role: 'user', content: `Правка не применилась: ${problem}. Пришли все куски заново к исходному коду из первого сообщения: в «НАЙТИ» — дословная копия строк, которая встречается в коде один раз.` }]);
  }
  throw Object.assign(new Error('Программист дважды прислал правку, которая не легла в код — попробуйте ещё раз'), { patch: true, attempts: attempts.length, ms: attempts.reduce((n, e) => n + (e.ms || 0), 0), rub: attempts.reduce((n, e) => n + (e.rub || 0), 0) });
}
// правка кусками; если куски дважды не легли — та же просьба, но «верни игру целиком» (дороже, зато правка не теряется)
const WHOLE = 'Верни игру целиком.';
async function patchOrWhole(kind, code, tpl, map, who, onProgress, popts, model) {
  try {
    return await patchProgram(kind, code, fill(tpl, Object.assign({}, map, { 'формат': userTemplate('patch') })), who, onProgress, popts, model);
  } catch (e) {
    if (!e.patch) throw e;
    if (onProgress) onProgress(0, 'игра целиком');
    const r = await program(kind + ': целиком', fill(tpl, Object.assign({}, map, { 'формат': WHOLE })), who, onProgress, model, popts);
    return Object.assign(r, { attempts: r.attempts + e.attempts, ms: r.ms + e.ms, rub: r.rub == null ? null : Math.round((r.rub + e.rub) * 100) / 100, whole: true });
  }
}

// Программист: один вызов модели + проверка синтаксиса. При синтаксической ошибке — до 2 починок сразу на сервере.
// model — другая модель для сравнения на том же замысле (иначе — модель из панели учителя). В ответе — время и рубли всех попыток.
async function program(kind, firstUser, who, onProgress, model, popts) {
  const viaChat = manual(who && who.lesson);
  model = viaChat ? CHAT.model : model || models().code;
  // popts.frame — каркас связки игры класса: для Claude один образец этого каркаса; popts.newGame — задание на новую игру (для чата — с просьбой автора)
  const system = systemPrompt(Object.assign({ lesson: who && who.lesson, model, short: viaChat }, popts)); // второй образец — ремейк урока (sample в сценарии); Claude — со стандартом геймдизайна
  let messages = [{ role: 'system', content: system }, { role: 'user', content: firstUser }];
  const attempts = [];
  const total = () => ({ ms: attempts.reduce((n, e) => n + (e.ms || 0), 0), rub: attempts.some(e => e.rub != null) ? Math.round(attempts.reduce((n, e) => n + (e.rub || 0), 0) * 100) / 100 : null });
  for (let attempt = 0; attempt < 3; attempt++) {
    const t0 = Date.now();
    let res;
    try { res = viaChat ? await chatCall(attempt ? 'починка синтаксиса' : kind, who, messages, onProgress, !attempt && popts && popts.newGame) : await call(attempt ? 'починка синтаксиса' : kind, who, model, messages, onProgress); } catch (e) {
      log(Object.assign({ kind: attempt ? 'починка синтаксиса' : kind, model, ms: Date.now() - t0, ok: false, error: e.message }, meta(who)));
      throw e;
    }
    let code, err;
    try { code = extractCode(res.text); err = syntaxError(code); } catch (e) { err = { message: e.message, line: null }; }
    res.entry.ok = !err; if (err) res.entry.error = err.message;
    attempts.push(log(res.entry));
    if (!err) return Object.assign({ code, model, attempts: attempts.length, warnings: lint(code) }, total());
    if (onProgress) onProgress(0, 'синтаксис');
    messages = [{ role: 'system', content: system }, { role: 'user', content: fill(userTemplate('fix'), {
      'фаза: загрузка | start | update | отрисовка': 'загрузка (синтаксис)', 'текст ошибки': err.message, 'номер': err.line || '?', 'код': code || res.text, 'формат': WHOLE,
    }) }];
  }
  throw new Error('Программист трижды вернул код с ошибкой синтаксиса');
}

// каркас игры ученика выбирает продюсер; «как у донора» или без продюсера — образец-донор урока
const studentFrame = plan => (plan.frame && !/донор/i.test(plan.frame) ? { frame: plan.frame } : undefined);
// opts.model и opts.kind — для сравнения моделей: тот же замысел, другая модель, запись «сравнение» в журнале
async function build(plan, who, onProgress, opts = {}) {
  if (programmerDemo(who && who.lesson)) return demoGame(plan, who, opts.kind);
  const r = await program(opts.kind || 'сборка', newGameMessage(plan), who, onProgress, opts.model, Object.assign({ newGame: true }, studentFrame(plan)));
  if (plan.secret && !/\bsecret\s*:\s*\{/.test(r.code)) r.warnings = r.warnings.concat('нет ручки secret');
  return r;
}
async function change(code, request, who, onProgress) {
  if (programmerDemo(who && who.lesson)) { log(Object.assign({ kind: 'правка', model: 'демо', ms: 0, ok: true, demo: true }, meta(who))); return { code, model: 'демо', attempts: 1, warnings: [], demo: true }; }
  return patchOrWhole('правка', code, userTemplate('change'), { 'код': code.trim(), 'просьба': request }, who, onProgress);
}
// model — чинит та же модель, что собирала (важно для честного сравнения моделей)
async function fix(code, error, who, onProgress, model) {
  if (programmerDemo(who && who.lesson)) { log(Object.assign({ kind: 'починка', model: 'демо', ms: 0, ok: false, demo: true }, meta(who))); throw new Error('Демо-режим: без ключа программист не чинит ошибки'); }
  return patchOrWhole('починка', code, userTemplate('fix'), {
    'фаза: загрузка | start | update | отрисовка': error.phase || 'update', 'текст ошибки': error.message || '?', 'номер': error.line || '?', 'код': code.trim(),
  }, who, onProgress, null, model);
}

// Общая игра урока (вау-старт): своя игра только из четырёх карт колоды безумных идей (без донора урока) + секретная механика из колоды секретов урока.
// Секрет живёт в ручке secret и в скрытом счётчике телеметрии _secret. Без ключа — запасная игра урока.
const wowFrame = wow => (wow.link && wow.link.frame) || ''; // каркас связки: по нему Claude получает один образец
async function buildShared(wow, who, onProgress) {
  if (programmerDemo(who && who.lesson)) return demoShared(wow, who);
  const r = await program('общая игра', fill(userTemplate('wow'), {
    'герой': wow.cards.hero, 'действие': wow.cards.action, 'место': wow.cards.place, 'поворот': wow.cards.twist, 'секрет': wow.secret, 'связка': linkText(wow.link),
  }), who, onProgress, null, { frame: wowFrame(wow), newGame: true });
  if (!/\bsecret\s*:\s*\{/.test(r.code)) r.warnings = r.warnings.concat('нет ручки secret');
  if (!/_secret/.test(r.code)) r.warnings = r.warnings.concat('секрет не считается в телеметрии');
  return Object.assign(r, { knob: 'secret' });
}
// правка игры класса по отчёту бота-плейтестера: та же модель и тот же образец каркаса, что у сборки
const BOT_LABELS = { idle: 'Пассивный (ничего не жмёт)', mash: 'Торопыга (мнёт A без остановки)', random: 'Новичок (бегает и жмёт что попало)' };
function playtestRounds(report) {
  return report.results.map(x => `- ${BOT_LABELS[x.strategy] || x.strategy}: ${x.seconds} с, очки ${x.score}, урон ${x.hurts}` + (x.hurtsAt && x.hurtsAt.length ? ` (на ${x.hurtsAt.slice(0, 4).join(', ')} с)` : '')
    + (x.offscreen != null ? `, герой за кадром ${x.offscreen}% времени` : '') + (x.flat ? `, дольше всего без очков — ${x.flat} с` : '') + (x.over ? `, конец партии: «${x.endText}»` : ', дожил до конца') + (x.error ? `, ошибка: ${x.error}` : '')).join('\n');
}
async function playtestFix(code, report, wow, who, onProgress) {
  const r = await patchOrWhole('правка по плейтесту', code, userTemplate('playtest'), {
    'код': code.trim(), 'связка': linkText(wow.link), 'секунд': String(report.seconds), 'партии': playtestRounds(report), 'выводы': report.findings.map(f => '- ' + f).join('\n'),
  }, who, onProgress, { frame: wowFrame(wow) });
  if (!/\bsecret\s*:\s*\{/.test(r.code)) r.warnings = r.warnings.concat('нет ручки secret');
  if (!/_secret/.test(r.code)) r.warnings = r.warnings.concat('секрет не считается в телеметрии');
  return r;
}
// запасная общая игра: ремейк урока с названием по картам; его секрет — свой (ручка из fallback.knob)
function demoShared(wow, who) {
  const fb = wow.fallback;
  let code = fs.readFileSync(path.join(PORTAL, fb.game), 'utf8');
  if (wow.title) code = code.replace(/title: '[^']*'/, 'title: ' + JSON.stringify(wow.title));
  log({ kind: 'общая игра', model: 'демо', ms: 0, ok: true, demo: true, class: who.class, nick: who.nick, lesson: who.lesson });
  return { code, model: 'демо', attempts: 1, warnings: [], demo: true, knob: fb.knob, fallback: true };
}

// Демо: вместо модели — образец урока с названием и решениями ученика (ремейк из sample сценария, иначе «НЛО в станице»).
function demoGame(plan, who, kind) {
  const sample = lessonSample(who && who.lesson);
  let code = fs.readFileSync(path.join(PORTAL, sample ? sample.file : 'games/nlo-v-stanice.js'), 'utf8');
  const q = s => JSON.stringify(String(s || ''));
  code = code.replace(/title: '[^']*'/, 'title: ' + q(plan.title || 'Моя игра'))
    .replace(/subtitle: '[^']*'/, 'subtitle: ' + q('Демо-режим: вместо Qwen — образец урока с твоим названием. ' + (plan.igra.i || '')))
    .replace(/decisions: \[[\s\S]*?\],\n/, 'decisions: ' + JSON.stringify([`Чувство: ${plan.decisions.feeling}`, `Честность: ${plan.decisions.honesty}`, `Выбор: ${plan.decisions.choice}`]) + ',\n  notes: ["Демо-режим: игру не писала модель, это образец урока"],\n');
  log(Object.assign({ kind: kind || 'сборка', model: 'демо', ms: 0, ok: true, demo: true }, meta(who)));
  return { code, model: 'демо', attempts: 1, warnings: [], demo: true, ms: 0, rub: null };
}

module.exports = { CHAT, manual, programmerDemo, truncated, joinParts, isHtml, LINK_FIELDS, playtestFix, feedbackDraft, applyPatches, loadConfig, reloadConfig, demo, models, limits, listModels, producer, producerFix, wowLink, build, buildShared, demoShared, change, fix, planText, extractCode, syntaxError };
