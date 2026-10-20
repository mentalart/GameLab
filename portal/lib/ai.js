// ИИ портала: продюсер, связка и черновик отзыва — по API (без ключа — демо-режим); программист — Qwen в чате chat.qwen.ai.
// Модели — через OpenAI-совместимый API (provod.ai). Ключ живёт только в config.json на сервере.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const store = require('./store');

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
  if (m) return /\bconst\s+GAME\s*=/.test(m[1]) ? '' : m[1];
  // блок ```html без <html>: только <canvas>, <style> и <script> — оборачиваем в страницу
  const b = /```html\s*\n([\s\S]*?)```/i.exec(String(text));
  return b && /<script/i.test(b[1]) ? `<!DOCTYPE html>\n<html lang="ru"><head><meta charset="utf-8"></head><body>\n${b[1].trim()}\n</body></html>` : '';
}
function syntaxError(code) {
  if (isHtml(code)) return pageError(code);
  return jsError(code, false);
}
// разбор кода без запуска; module — скрипт type="module": импорты и export убираются, тело — в async-функции (await на верхнем уровне)
function jsError(code, module) {
  let src = code;
  if (module) {
    src = src.replace(/^[ \t]*import\b(?!\s*\(|\.)[^;]*?(?:from\s*)?['"][^'"\n]+['"][ \t]*;?/gm, m => m.replace(/[^\n]/g, ' '))
      .replace(/^([ \t]*)export\s+(default\s+)?/gm, '$1').replace(/\bimport\.meta\b/g, '({})');
    src = '(async function(){"use strict";' + src + '\n})';
  }
  try { new vm.Script(src, { filename: 'game.js' }); return null; } catch (e) {
    const m = /game\.js:(\d+)/.exec(e.stack || '');
    const line = m ? Number(m[1]) : null;
    return { message: e.message, line, text: line ? (code.split('\n')[line - 1] || '').trim().slice(0, 160) : '' };
  }
}
// скрипты страницы, которые браузер выполнит как JavaScript: без src, без type или type module / text/javascript
// (шейдеры x-shader и importmap не трогаем); start — номер строки страницы, с которой начинается код скрипта
function pageScripts(html) {
  const out = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1], type = (/\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs) || [])[1] || '';
    if (/\bsrc\s*=/i.test(attrs) || (type && !/^(module|text\/javascript|application\/javascript)$/i.test(type))) continue;
    const at = m.index + m[0].indexOf('>') + 1;
    out.push({ code: m[2], at, module: /^module$/i.test(type), start: html.slice(0, at).split('\n').length });
  }
  return out;
}
// первая синтаксическая ошибка страницы: строка — в файле страницы, как её видит Qwen
function pageError(html) {
  for (const sc of pageScripts(html)) {
    const e = jsError(sc.code, sc.module);
    if (e) return Object.assign(e, { line: e.line ? sc.start + e.line - 1 : null });
  }
  return null;
}
// Qwen переносит в код типографику из задания: минус «−», неразрывный пробел, невидимые символы — «Invalid or unexpected token».
// Чиним только скрипт, который без этого не разбирается, и только если после замены он разбирается.
// Замены идут ступенями: сначала безопасные (минус, пробелы), потом кавычки “ ” ‘ ’, потом «×» между числами и именами — каждая следующая, только если без неё скрипт не разбирается.
const TYPO = [
  [[/−/g, '-'], [/[   ]/g, ' '], [/[​-‍⁠﻿]/g, '']],
  [[/[“”„]/g, '"'], [/[‘’]/g, "'"]],
  [[/([\w)\]])[ \t]*×[ \t]*(?=[\w(])/g, '$1 * ']],
];
function fixScript(code, module) {
  if (!jsError(code, module)) return code;
  let f = code;
  for (const stage of TYPO) {
    f = stage.reduce((x, [re, to]) => x.replace(re, to), f);
    if (!jsError(f, module)) return f;
  }
  return code;
}
function fixTypography(code) {
  if (!isHtml(code)) return fixScript(code, false);
  let out = code;
  for (const sc of pageScripts(code).reverse()) {
    const f = fixScript(sc.code, sc.module);
    if (f !== sc.code) out = out.slice(0, sc.at) + f + out.slice(sc.at + sc.code.length);
  }
  return out;
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

/* ---------------- программист: Qwen в чате chat.qwen.ai ---------------- */
// Программист во всех уроках — Qwen в бесплатном веб-чате, а не API (решение автора 18.10.2026): портал не зовёт модель,
// а выдаёт текст для чата и ждёт, пока человек вставит ответ (задание ждёт в состоянии waiting — startJob и /api/job/answer
// в server.js). Дальше код достаётся из ответа, синтаксис проверяется, куски правки вставляются; если не вышло —
// портал выдаёт следующее сообщение в тот же чат. Продюсер, связка и черновик отзыва остаются на API.
// Задание на новую игру — четыре части (portal/ai/chat-prompt.md): просьба автора, гейм дизайн документ или замысел ученика,
// картинка (раздел look) и что нужно порталу. Ответ — страница HTML, связь с порталом — мост engine/portal.js.
// Правка и починка идут в формате той игры, что есть: страница HTML — разделы change, fix, move; объект GAME для оболочки
// «Лаб3D» на three.js (так отвечает подставной Qwen в проверках) — разделы change-game, fix-game, move-game того же файла.
const CHAT = {
  model: 'chat.qwen.ai', url: 'https://chat.qwen.ai/',
  phrase: 'собери яркую lowpoly 3d игру для школьников на html', // просьба автора курса (18.10.2026) в каждом задании на новую игру
};
const chatTpl = name => promptSection('chat-prompt.md', `<!-- chat:${name}:start -->`, `<!-- chat:${name}:end -->`);
// формат кусками: у объекта GAME большая правка — объект целиком блоком ```js
const chatPatch = code => (isHtml(code) ? chatTpl('patch') : chatTpl('patch').replace(/```html/g, '```js'));
// пустое поле замысла fill превращает в «—»: такие строки в задании для чата не нужны
// раздел «Картинка» (look) — что значит «ярко» по пунктам: во всех заданиях на новую игру и в переносе в новый чат (решение автора 18.10.2026)
// look = false — раздел «Картинка» уже внутри middle (игра класса: картинка сразу после ответов класса, до рецепта — 19.10.2026)
const chatTask = (middle, look = true) => [CHAT.phrase, middle.replace(/^—\r?\n/gm, '').replace(/\n—\s*$/, '').trim(), look ? chatTpl('look') : '', chatTpl('portal')].filter(Boolean).join('\n\n');
// спрятанная механика в задании Clear: без API оболочки Лаб3D (звук спрятанной механики «ритм» игра пишет сама)
// [база] — что из обычных правил игры делает только спрятанная механика (поле base колоды спрятанных механик урока): без неё копия «Без спрятанной механики» содержит тот же эффект
const SECRET_BASE = 'всё, что в остальных правилах похоже на эту спрятанную механику.';
// [как] — пошаговый геймплей спрятанной механики (поле howto колоды): Qwen по одному эффекту собирал спрятанную механику невнятно
const chatSecret = (prompt, base, howto) => (prompt ? '\n' + fill(chatTpl('secret'), { 'секрет': prompt.replace(/\s*\(lab\.tone[^)]*\)/, ' (низкий тон через Web Audio)').replace(/lab\.count/g, 'portal.count'), 'база': base || SECRET_BASE, 'как': howto || '' }).replace(/\n{3,}/g, '\n\n') : '');
// замечания проверки к игре из чата: то, без чего портал работает хуже
function chatWarnings(code, secret) {
  if (!isHtml(code)) return lint(code);
  const w = [];
  if (!/portal\.over\s*\(/.test(code)) w.push('нет portal.over: рекорды не запишутся');
  if (!/portal\.knobs\s*\(/.test(code)) w.push('нет portal.knobs: нет ручек');
  if (!/getGamepads/.test(code)) w.push('нет геймпада');
  if (/\b(localStorage|sessionStorage|alert\s*\(|confirm\s*\(|prompt\s*\()/.test(code)) w.push('localStorage или alert: в песочнице не работают');
  if (secret && !/_secret/.test(code)) w.push('спрятанная механика не считается в portal.count');
  return w;
}
// Один круг с чатом: портал выдаёт текст, человек вставляет ответ (progress.ask, см. startJob в server.js), портал проверяет код.
// Не подошло — следующее сообщение в тот же чат, до трёх ответов. base — код, к которому прикладываются куски правки.
async function chatProgram(kind, prompt, who, onProgress, base, secret) {
  if (!onProgress || !onProgress.ask) throw new Error('Программист работает через chat.qwen.ai: ответ некуда вставить');
  const attempts = [];
  let ask = prompt;
  for (let attempt = 0; attempt < 3; attempt++) {
    const t0 = Date.now();
    const text = await onProgress.ask({ kind, url: CHAT.url, prompt: ask, followUp: attempt > 0, lesson: who && who.lesson });
    const entry = Object.assign({ kind: attempt ? kind + ': повтор' : kind, model: CHAT.model, ms: Date.now() - t0, chars: text.length, manual: true, rub: 0 }, meta(who));
    let code = '', problem = '';
    PATCH_RE.lastIndex = 0;
    if (base && PATCH_RE.test(text)) {
      const p = applyPatches(base, text);
      code = p.code;
      if (p.failed.length) problem = 'Эти куски не легли в код: ' + p.failed.join('; ') + '. Пришли куски заново: в «НАЙТИ» — дословная копия строк из текущего кода, которая встречается в нём один раз. Или пришли игру целиком одним блоком ```html.';
    } else {
      try { code = extractCode(text); } catch (e) { problem = 'В ответе нет кода игры. Пришли игру целиком: один файл HTML одним блоком ```html, без пояснений.'; }
    }
    if (!problem) code = fixTypography(code);
    const err = !problem && syntaxError(code);
    // ошибку разбора портал ловит сам и сразу пишет в тот же чат: игра не открывается ученику сломанной
    if (err) problem = `Код не запускается: ${err.message}${err.line ? `, строка ${err.line}` : ''}${err.text ? ` («${err.text}»)` : ''}. Частая причина — символы из текста задания в коде: «−» вместо минуса, «×» вместо *, кавычки « » или “ ” вокруг строк, дробь с запятой, строка в кавычках, разорванная переносом. Исправь и пришли игру целиком одним блоком \`\`\`html.`;
    entry.ok = !problem; if (problem) entry.error = problem;
    attempts.push(log(entry));
    if (!problem) return { code, model: CHAT.model, attempts: attempts.length, warnings: chatWarnings(code, secret), ms: attempts.reduce((n, e) => n + e.ms, 0), rub: 0 };
    ask = problem;
  }
  throw new Error('Три ответа из чата не подошли — начните задание заново в новом чате');
}
function chatBuild(plan, who, onProgress, kind) {
  const text = fill(chatTpl('new'), {
    'название': plan.title, 'донор': plan.donor, 'твист': plan.twist, 'мир': plan.world, 'детали': plan.details.join('\n'),
    'идея': plan.igra.i, 'глагол': plan.igra.g, 'правила': plan.igra.r, 'атмосфера': plan.igra.a,
    'чувство': plan.decisions.feeling, 'честность': plan.decisions.honesty, 'выбор': plan.decisions.choice,
    'развилки': plan.forks.length ? plan.forks.map(f => `- ${f.question} → ${f.answer}`).join('\n') : 'развилок не было',
    'находки': plan.findings && plan.findings.length ? 'Продюсер заметил:\n' + plan.findings.map(f => '- ' + f).join('\n') : '',
  }) + chatSecret(plan.secret && plan.secret.prompt, plan.secret && plan.secret.base, plan.secret && plan.secret.howto) + chatLevels(plan.levels);
  return chatProgram(kind || 'сборка', chatTask(text), who, onProgress, null, !!plan.secret).then(r => {
    if (plan.levels && isHtml(r.code) && !/portal\.levels\s*\(/.test(r.code)) r.warnings.push('нет portal.levels: редактор уровней и тепловая карта не увидят уровни');
    return r;
  });
}
// уровни как данные (модуль 4): поле levels сценария урока — какие уровни у этой игры и её легенда
const chatLevels = levels => (levels ? '\n\n' + fill(chatTpl('levels'), { 'уровни': String(levels).trim() }) : '');
// задание Qwen для игры класса целиком (tools/pilot-zadaniya.js собирает им задания для прогона колоды)
// wow.world — мир с карты «Мир» (цвета, что собираем, декор), wow.move — ход угрозы мира: по нему рецепт выбирает тип врага (вау-старт 2.0)
const chatSharedText = wow => chatTask(fill(chatTpl('wow'), {
    'герой': wow.cards.hero, 'действие': wow.cards.action, 'место': wow.cards.place, 'угроза': wow.cards.threat || 'нет карты — придумай по месту', 'поворот': wow.cards.twist,
    'картинка': wowLook(wow), 'рецепт': recipeText(wow.genre, wow.cards, wow.move, wow.world), 'лучшие': bestText(wow.genre), 'проверь': checksText(wow.genre),
    'сочность': wow.genre && wow.genre.juice ? `Сочность жанра — без неё игра выглядит картонной, сделай всё: ${wow.genre.juice}.` : '',
    'связка': wow.link ? `Гейм дизайн документ (класс принял его${wow.genre && wow.genre.recipe ? '; правила, кнопки и числа — из рецепта, документ задаёт фразу игры и подачу' : ', строй игру по нему'}):\n` + LINK_FIELDS.filter(([k]) => wow.link[k]).map(([k, label]) => `- ${label}: ${wow.link[k]}`).join('\n') : '',
  }) + chatSecret(wow.secret, wow.base, wow.howto), false);
async function chatShared(wow, who, onProgress) {
  return Object.assign(await chatProgram('общая игра', chatSharedText(wow), who, onProgress, null, true), { knob: 'secret' });
}
// правка идёт в тот же чат, где Qwen писал игру: код он уже видел, поэтому сообщение — только просьба и формат (решение автора 18.10.2026);
// игру в новый чат переносит сообщение chatMove
function chatChange(code, request, who, onProgress, kind) {
  const text = fill(chatTpl(isHtml(code) ? 'change' : 'change-game'), { 'просьба': request, 'формат': chatPatch(code) });
  return chatProgram(kind || 'правка', text, who, onProgress, code);
}

/* ---------------- правка своими словами в чате (урок 1, чекпоинт 5, 18.10.2026) ---------------- */
// Ученик пишет просьбу сам в том чате, где Qwen собирал игру, и вставляет ответ в портал в любой момент.
// Договор — один раз за чат: формат ответа, который портал примет; перенос — игра в новый чат с правилами портала и договором.
const chatPact = code => chatTpl(isHtml(code) ? 'pact' : 'pact-game');
function chatMove(code, who) {
  return fill(chatTpl(isHtml(code) ? 'move' : 'move-game'), { 'картинка': chatTpl('look'), 'портал': chatTpl('portal'), 'код': code.trim(), 'договор': chatPact(code) });
}
// сообщение из конструктора просьбы: что не так, ради какого чувства, что не трогать
// code — первая просьба в чате (простая правка урока 1): договор и просьба одним сообщением, без ответа «Договорились»
function chatAsk({ what, why, keep }, code = null) {
  const ask = fill(chatTpl('ask'), { 'что': cleanLine(what), 'зачем': why ? 'Зачем: ' + cleanLine(why) : '', 'не трогай': keep ? 'Не трогай: ' + cleanLine(keep) : '' })
    .replace(/^—\r?\n/gm, '').replace(/\n{2,}/g, '\n');
  return code == null ? ask : chatPact(code).replace(/\n?Если понял[^\n]*$/, '').trim() + '\n\n' + ask;
}
const cleanLine = t => String(t || '').replace(/\s+/g, ' ').trim().slice(0, 600);
// замечания проверки, которые ученик чинит сообщением в тот же чат (без них портал работает хуже)
const REPAIRABLE = [
  [/нет portal\.knobs/, 'ручки геймдизайнера (portal.knobs с пресетом «Новичок»)'],
  [/нет portal\.over/, 'конец партии portal.over(очки) — без него не пишутся рекорды'],
  [/нет геймпада/, 'управление с джойстика (navigator.getGamepads каждый кадр)'],
  [/спрятанная механика не считается/, "portal.count('_secret') каждый раз, когда срабатывает спрятанная механика"],
];
function chatRepair(warnings) {
  const lost = REPAIRABLE.filter(([re]) => (warnings || []).some(w => re.test(w))).map(([, t]) => t);
  return lost.length ? fill(chatTpl('repair'), { 'что пропало': lost.join('; ') }) : '';
}
// вставленный ответ из чата — новая версия своей игры: тот же разбор, что у задания (код, куски, синтаксис, замечания);
// оборванный ответ или ответ, который не подошёл, — окно Qwen с сообщением для того же чата (onProgress.ask)
function chatPaste(code, text, who, onProgress, secret) {
  let first = true;
  const ask = q => {
    if (!first) return onProgress.ask(q);
    first = false;
    // оборванный ответ: окно сразу просит «Продолжи» и склеивает части (/api/job/answer)
    if (truncated(text)) return onProgress.ask(Object.assign({}, q, { followUp: true, answer: text, parts: 1 }));
    return Promise.resolve(text);
  };
  const progress = Object.assign((...a) => onProgress(...a), { ask });
  return chatProgram('правка из чата', '(ответ вставлен учеником)', who, progress, code, secret).then(r => Object.assign(r, { repair: chatRepair(r.warnings) }));
}
function chatFix(code, error, who, onProgress) {
  const text = fill(chatTpl(isHtml(code) ? 'fix' : 'fix-game'), { 'ошибка': error.message || '?', 'строка': error.line || '?', 'код': code.trim(), 'формат': chatPatch(code) });
  return chatProgram('починка', text, who, onProgress, code);
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
    `Название: ${plan.title}`, `Донор: ${plan.donor}`, `Твист: ${plan.twist}`, `Мир: ${plan.world}`, plan.secret ? `Спрятанная механика (карта спрятанной механики): ${plan.secret.title}` : '', `Уровень: ${plan.level}`,
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

/* ---------------- связка карт вау-старта (на экране — «Гейм дизайн документ»): геймдизайнер сводит пять карт в одну игру ---------------- */
// поля связки: ключ и подпись — в таком порядке их видит учитель и получает программист
const LINK_FIELDS = [['phrase', 'Фраза игры'], ['frame', 'Жанр и камера'], ['controls', 'Что делает герой и кнопки контроллера'], ['loop', 'Главный цикл'], ['risk', 'Риск и очки'],
  ['threats', 'Угрозы'], ['curve', 'Нарастание'], ['twist', 'Твист × действие'], ['funny', 'Главный смешной момент']];
function parseLink(text) {
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  const j = JSON.parse(text.slice(a, b + 1));
  const link = {};
  for (const [k] of LINK_FIELDS) link[k] = cleanText(j[k], 400);
  if (!link.phrase || !link.loop) throw new Error('нет фразы игры');
  return link;
}
// genre — жанр карты действия из сценария урока ({ name, frame }): каркас жанра — подсказка связке
const genreLine = genre => (genre ? `Жанр игры — ${genre.name}, каркас жанра — ${genre.frame}. Поворот взят из колоды этого жанра, герой и угроза — из мира на карте места.` : '');
// рецепт жанра (пилот «рецепт + слоты», 19.10.2026): готовая мини-игра строками и как в неё встают карты — в связку и в задание Qwen слово в слово
const recipeOf = (genre, start) => ((genre && genre.recipe) || []).find(l => l.startsWith(start + ':')) || '';
function recipeText(genre, cards, move, world) {
  if (!genre || !genre.recipe) return '';
  const type = (genre.types || {})[cards.threat] || (move && (genre.moves || {})[move]), rule = (genre.rules || {})[cards.twist];
  return [`Рецепт жанра «${genre.name}» — основа игры. Цикл, очки, проигрыш, нарастание и числа бери из него как есть; новых механик сверх рецепта и карт не добавляй.`,
    ...genre.recipe.map(l => '- ' + l),
    // механика героя числами (19.10.2026): Qwen собирал прыжок без запаса края и буфера — нажатия терялись
    ...(genre.controls ? ['Механика героя — точно так, здесь игры ломаются чаще всего. Шаг физики — dt не больше 1/30 с; нажатие ловится по фронту (в прошлом кадре кнопка отпущена, в этом нажата) и на клавиатуре, и на геймпаде. Если поворот меняет кнопку или движение, прав поворот.',
      ...genre.controls.map(l => '- ' + l)] : []),
    'Как карты встают в рецепт:',
    '- Герой: облик, характер и звук — с карты; своей механики у героя нет, все кнопки — из рецепта.',
    world ? '' : '- Место: мир игры — цвета, небо, декор и звуки с карты.',
    type ? `- Угроза: враг типа «${type}» из рецепта; облик, цвет и звук — с карты угрозы. Остальные типы врагов рецепта — тоже жители этого мира.` : '- Угроза: облик — с карты, поведение подгони под один из типов врагов рецепта.',
    rule ? `- Поворот меняет в рецепте одно: ${rule}.` : '',
    genre.luck ? `- Удача в этой игре — каждое начисление очков: ${genre.luck}.` : ''].filter(Boolean).join('\n');
}
// как у лучших в жанре (19.10.2026): игры выходили играбельными, но бедными — зрелище и события раз в 8–10 с по образцам жанра.
// Бонусы событий меняют умение, не очки: множители и золотые бонусы спорили бы со спрятанной механикой «Каждый десятый — золотой».
const bestText = g => (g && g.best ? [`Как у лучших в жанре — ${g.best}. Это тоже часть рецепта, сделай всё; упрощай, но не выбрасывай.`,
  'Зрелище:', ...g.show.map(l => '- ' + l),
  'События — ритм лучших игр: каждые 1–2 с мелочь рецепта (монетка, враг), с 12-й секунды каждые 8–10 с новое событие из списка (подряд одно и то же не повторяй), примерно раз в 30 с большое событие. Бонусы событий меняют умение, а не очки: множителей очков, комбо и золотых бонусов нет. Если событие спорит с поворотом, прав поворот: такое событие пропусти.',
  ...g.beats.map(l => '- ' + l),
  `- большое событие: ${g.boss}`].join('\n') : '');
// мир с карты «Мир» данными (вау-старт 2.0): Qwen по одной строке карты рисовал мир наугад
// пол — словами и двумя тонами, ориентиры — внутри кадра: Qwen ставил 38 предметов декора за краем поля, а пол делал одноцветным (19.10.2026)
const worldText = w => (w ? [`Мир «${w.name}»:`,
  `- цвета: небо — градиент от ${w.sky[0]} сверху к ${w.sky[1]} у горизонта, туман в цвет горизонта; дальний план ${w.far}; акцент для бонусов и вспышек ${w.acc}`,
  w.floor ? `- пол: ${w.floor[0]}, тона ${w.floor[1]} и ${w.floor[2]} — узором на CanvasTexture` : `- земля ${w.ground}`,
  w.landmarks ? `- крупные ориентиры, по которым мир узнают с одного кадра, — внутри игрового поля или прямо за ним, в кадре: ${w.landmarks}` : '',
  `- декор — в кадре, на поле и вокруг него, лоуполи из примитивов: ${w.decorNames}`,
  `- что собираем: ${w.itemName} ${w.item} — монетки, кристаллы, мишени и бонусы рецепта в этой игре выглядят так (лоуполи, крутятся и светятся)`,
  '- герой — самый яркий в кадре и не сливается с полом; угроза тёмная или красная, с подсветкой, её видно издалека'].filter(Boolean).join('\n') : '');
// раздел «Картинка» игры класса: общие правила, мир данными и кадр жанра
const wowLook = wow => [chatTpl('look'), worldText(wow.world), wow.genre && wow.genre.shot ? `Кадр в этой игре: ${wow.genre.shot}.` : ''].filter(Boolean).join('\n');
// что проверить перед ответом: проверки рецепта и две общие — Qwen-Flash чаще ошибается в порядке объявлений и в конце партии
const checksText = genre => (genre && genre.checks ? ['Проверь перед ответом — всё это работает в первой же партии:', ...genre.checks.map(c => '- ' + c),
  genre.beats ? '- с 12-й секунды каждые 8–10 с случается новое событие из «Как у лучших в жанре», к 30-й секунде — первое большое событие' : '',
  genre.shot ? '- картинка: пол с узором, в кадре ориентир мира и не меньше 8 предметов декора; у героя и врагов глаза и тёмная обводка' : '',
  '- код без ошибок: three.js подключён через importmap, каждая переменная и функция объявлена до первого кадра, в консоли нет ошибок',
  '- партия заканчивается экраном конца, новая партия начинается по Enter, R или Start'].filter(Boolean).join('\n') : '');
async function wowLink(cards, prev, who, genre, move) {
  if (demo()) return demoLink(cards, who, genre);
  const model = models().link;
  const t0 = Date.now();
  const user = ['Карты:', `- Герой: ${cards.hero}`, `- Действие: ${cards.action}`, `- Место: ${cards.place}`, `- Угроза: ${cards.threat || 'нет карты — придумай сам по месту'}`, `- Поворот: ${cards.twist}`, genreLine(genre), recipeText(genre, cards, move),
    prev ? `\nУчитель попросил другую связку. Прошлая была: «${prev.phrase}»${prev.frame ? ` (${prev.frame})` : ''} — найди другое чтение карт: другой цикл, риск или смешной момент в том же жанре.` : ''].filter(Boolean).join('\n');
  try {
    const { text, entry } = await call('связка карт', who, model, [
      { role: 'system', content: promptSection('link-prompt.md', '<!-- prompt:start -->', '<!-- prompt:end -->') },
      { role: 'user', content: user },
    ]);
    let link;
    try { link = parseLink(text); entry.ok = true; } catch (e) { entry.ok = false; entry.error = 'связка: ' + e.message; log(entry); throw new Error('Геймдизайнер ответил не по форме — попросите другой документ'); }
    log(entry);
    return Object.assign(link, { model });
  } catch (e) { if (!/не по форме/.test(e.message)) log(Object.assign({ kind: 'связка карт', model, ms: Date.now() - t0, ok: false, error: e.message }, meta(who))); throw e; }
}
// демо-документ жанра с рецептом: поля берутся из строк рецепта
function demoRecipe(genre, cards) {
  const tail = start => recipeOf(genre, start).replace(/^[^:]+:\s*/, '');
  const type = (genre.types || {})[cards.threat], rule = (genre.rules || {})[cards.twist];
  return { frame: `${genre.name}: ${tail('Камера и поле')}`, controls: tail('Кнопки'), risk: tail('Цель и очки'), curve: tail('Нарастание'),
    threats: `${cards.threat}${type ? ` — враг типа «${type}»` : ''}. ${tail('Проигрыш')}`, twist: rule ? `Поворот меняет одно: ${rule}.` : `Поворот «${cards.twist}».` };
}
function demoLink(cards, who, genre) {
  log(Object.assign({ kind: 'связка карт', model: 'демо', ms: 0, ok: true, demo: true }, meta(who)));
  return {
    phrase: `Ты — ${cards.hero}. Главное действие: ${cards.action}. Место: «${cards.place}». Мешает: ${cards.threat || 'всё вокруг'}. Поворот: ${cards.twist}. Цель — продержаться и набрать рекорд класса.`,
    frame: genre ? `${genre.name}: ${genre.frame}.` : 'Арена, изометрия: всё поле видно целиком, герой бегает по нему.',
    ...(genre && genre.recipe ? demoRecipe(genre, cards) : {}),
    controls: `Движение — бегать, A — ${String(cards.action).split(' — ').pop()}, B не нужна.`,
    loop: `Каждые несколько секунд: ${cards.action} — и сразу видно, попал ли ты; промах стоит времени.`,
    risk: 'Действие рядом с опасностью даёт очки ×2.',
    threats: cards.threat ? `Главная угроза с карты: ${cards.threat}. К ней — мелкие помехи места; касание отнимает жизнь.` : 'Одни угрозы идут прямо, другие заходят сбоку; касание отнимает жизнь.',
    curve: 'К 30-й секунде — второй вид угроз, к 60-й — быстрее, к 90-й — всё вместе.',
    twist: `Поворот «${cards.twist}» меняет то, как работает главное действие: им можно и помешать себе, и выиграть.`,
    funny: 'Демо-режим: без ключа ИИ документ собран по шаблону из карт.', model: 'демо', demo: true,
  };
}

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
    `Урок: ${d.lesson}`, `Игра: «${d.title}»`, `Ученик задумал чувство: ${d.feeling || '—'}`, d.secret ? `Его спрятанная механика: ${d.secret}` : '',
    `Партий соседей: ${x.rounds || 0}, игроков: ${x.players || 0}, нажали «ещё раз»: ${x.again || 0}`,
    x.dominant ? `Дольше всего держали: ${x.dominant.name} — ${Math.round(x.dominant.share * 100)}% времени партии` : '',
    Object.keys(x.emotions || {}).length ? 'Эмоции соседей: ' + Object.entries(x.emotions).map(([e, n]) => `${e} ×${n}`).join(', ') : '',
    ...(x.cards || []).slice(0, 6).map(c => `Карточка соседа: нравится — ${c.like && c.like.text || '—'}; хочется — ${c.want && c.want.text || '—'}; а что если — ${c.whatif && c.whatif.text || '—'}`),
    d.blind && d.blind.voted ? `Слепая пара: спрятанную механику почувствовали ${d.blind.felt} из ${d.blind.voted}` : '',
    'Колода понятий урока:', ...d.concepts.map(c => '- ' + c), 'Колода вопросов урока:', ...d.questions.map(q => '- ' + q),
  ].filter(Boolean).join('\n');
}
function ruleDraft(d) {
  const x = d.discovery || {}, em = x.emotions || {};
  const find = (deck, re, fallback) => deck.find(t => re.test(t)) || fallback || deck[0] || '';
  const C = d.concepts, Q = d.questions;
  let concept, question, why;
  if (x.dominant && x.dominant.share >= 0.6) { concept = find(C, /доминир/i); question = find(Q, /цена/i); why = `соседи ${Math.round(x.dominant.share * 100)}% партии держали ${x.dominant.name}`; }
  else if (d.blind && d.blind.voted && d.blind.felt * 2 < d.blind.voted) { concept = find(C, /спрятанн/i); question = find(Q, /ручка|чувство/i); why = `спрятанную механику почувствовали только ${d.blind.felt} из ${d.blind.voted}`; }
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
// программист: сборка своей игры, игра класса (вау-старт), правка, починка и правка по отчёту бота — всё через чат
const build = (plan, who, onProgress, opts = {}) => chatBuild(plan, who, onProgress, opts.kind);
const buildShared = (wow, who, onProgress) => chatShared(wow, who, onProgress);
const change = (code, request, who, onProgress) => chatChange(code, request, who, onProgress);
const fix = (code, error, who, onProgress) => chatFix(code, error, who, onProgress);
async function playtestFix(code, report, wow, who, onProgress) {
  return Object.assign(await chatChange(code, 'исправь игру по отчёту бота-плейтестера:\n' + report.findings.map(f => '- ' + f).join('\n'), who, onProgress, 'правка по плейтесту'), { knob: 'secret' });
}

module.exports = { chatSharedText, chatPact, chatMove, chatAsk, chatRepair, chatPaste, CHAT, truncated, joinParts, isHtml, LINK_FIELDS, playtestFix, feedbackDraft, applyPatches, loadConfig, reloadConfig, demo, models, limits, listModels, producer, producerFix, wowLink, build, buildShared, change, fix, planText, extractCode, syntaxError, fixTypography };
