// ИИ портала: продюсер, программист (сборка, правка, починка), демо-режим без ключа.
// Модели — через OpenAI-совместимый API (provod.ai). Ключ живёт только в config.json на сервере.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const store = require('./store');
const { systemPrompt, userTemplate } = require('../tools/build-prompt');

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
  configCache.ai = Object.assign({ baseUrl: 'https://api.provod.ai/v1', apiKey: '', codeModel: '', textModel: '', stream: true, timeoutSec: 240, temperature: 0.4 }, configCache.ai || {});
  configCache.limits = Object.assign({ aiCallsPerStudentPerLesson: 40, rublesPerLesson: 0 }, configCache.limits || {});
  configCache.models = configCache.models || [];
  return configCache;
}
function reloadConfig() { configCache = null; return loadConfig(); }
const demo = () => !loadConfig().ai.apiKey;
function models() {
  const c = loadConfig(), s = store.settings();
  return { code: s.codeModel || c.ai.codeModel, text: s.textModel || c.ai.textModel };
}
function price(model) { return loadConfig().models.find(m => m.id === model) || {}; }
function rubles(model, inT, outT) {
  const p = price(model);
  if (p.rubPer1MIn == null || p.rubPer1MOut == null) return null;
  return Math.round(((inT || 0) * p.rubPer1MIn + (outT || 0) * p.rubPer1MOut) / 1e4) / 100;
}

/* ---------------- вызов модели ---------------- */
async function chat({ model, messages, onProgress, temperature }) {
  const c = loadConfig().ai;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), (c.timeoutSec || 240) * 1000);
  const t0 = Date.now();
  try {
    const body = { model, messages, temperature: temperature == null ? c.temperature : temperature };
    if (c.stream) { body.stream = true; body.stream_options = { include_usage: true }; }
    const res = await fetch(c.baseUrl.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + c.apiKey },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`Модель ответила ${res.status}: ${t.slice(0, 300)}`);
    }
    let text = '', usage = null;
    const type = res.headers.get('content-type') || '';
    if (c.stream && type.includes('event-stream')) {
      const dec = new TextDecoder();
      let buf = '';
      for await (const chunk of res.body) {
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
    const inT = usage ? usage.prompt_tokens : Math.round(messages.reduce((n, m) => n + m.content.length, 0) / 3);
    const outT = usage ? usage.completion_tokens : Math.round(text.length / 3);
    return { text, ms: Date.now() - t0, tokensIn: inT, tokensOut: outT, estimated: !usage };
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`Модель не ответила за ${c.timeoutSec} с`);
    throw e;
  } finally { clearTimeout(timer); }
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
  let code = blocks.find(b => /\bGAME\b/.test(b)) || (/const\s+GAME\s*=/.test(text) ? text : '');
  code = code.trim();
  if (!code) throw new Error('В ответе модели нет кода игры');
  return code + '\n';
}
function syntaxError(code) {
  try { new vm.Script(code, { filename: 'game.js' }); return null; } catch (e) {
    const m = /game\.js:(\d+)/.exec(e.stack || '');
    return { message: e.message, line: m ? Number(m[1]) : null };
  }
}
const FORBIDDEN = [/\bdocument\./, /\bwindow\./, /\blocalStorage\b/, /\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\beval\s*\(/, /new\s+Function\b/, /\bimport\s*\(/, /^\s*import\s/m, /\bsetInterval\s*\(/, /\bMath\.random\s*\(/];
function lint(code) { return FORBIDDEN.filter(r => r.test(code)).map(r => String(r).replace(/\\b|\\s\*|\\|\/|\^|\$/g, '').replace(/m$/, '')); }

const fill = (tpl, map) => Object.entries(map).reduce((s, [k, v]) => s.split('[' + k + ']').join(v == null || v === '' ? '—' : String(v)), tpl);

/* ---------------- журнал ---------------- */
function log(entry) { store.logGen(entry); return entry; }

async function call(kind, who, model, messages, onProgress) {
  const r = await chat({ model, messages, onProgress });
  const entry = { kind, model, ms: r.ms, tokensIn: r.tokensIn, tokensOut: r.tokensOut, estimated: r.estimated, rub: rubles(model, r.tokensIn, r.tokensOut), class: who.class, nick: who.nick, lesson: who.lesson };
  return { text: r.text, entry };
}

/* ---------------- продюсер ---------------- */
function producerSystem(lessonTitle) {
  const t = fs.readFileSync(path.join(PORTAL, 'ai', 'producer-prompt.md'), 'utf8');
  const a = t.indexOf('<!-- prompt:start -->'), b = t.indexOf('<!-- prompt:end -->');
  return t.slice(a + 21, b).trim().split('{{УРОК}}').join(lessonTitle);
}
function planText(plan) {
  return [
    `Название: ${plan.title}`, `Донор: ${plan.donor}`, `Твист: ${plan.twist}`, `Мир: ${plan.world}`, `Уровень: ${plan.level}`,
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
  };
}
async function producer(plan, lesson, who) {
  if (demo()) return demoProducer(plan, who);
  const model = models().text;
  const t0 = Date.now();
  try {
    const { text, entry } = await call('продюсер', who, model, [
      { role: 'system', content: producerSystem(`${lesson.title} (донор: ${lesson.donor})`) },
      { role: 'user', content: 'Замысел ученика:\n' + planText(plan) },
    ]);
    let result;
    try { result = parseProducer(text); entry.ok = true; } catch (e) { entry.ok = false; entry.error = 'продюсер вернул не JSON'; result = { praise: '', findings: [], forks: [], raw: text.slice(0, 1500) }; }
    log(entry);
    return result;
  } catch (e) { log({ kind: 'продюсер', model, ms: Date.now() - t0, ok: false, error: e.message, class: who.class, nick: who.nick, lesson: who.lesson }); throw e; }
}
function demoProducer(plan, who) {
  const findings = [], forks = [];
  const all = [plan.igra.i, plan.igra.g, plan.igra.r, plan.igra.a].join(' ');
  if (plan.diceCount >= 3) findings.push({ kind: 'кубик', text: `Кубику оставлено полей: ${plan.diceCount}. Скажи хотя бы одно из них своими словами — так игра станет твоей.` });
  if (!/кнопк|пробел|стрелк|\bA\b|\bB\b|←|→|клавиш/i.test(plan.igra.g)) findings.push({ kind: 'без кнопки', text: 'В «Глаголе и кнопках» не видно, какой кнопкой игрок действует. Назови кнопку для каждого действия.' });
  if (!/рекорд|вдвоём|второй игрок|вызов|зерн|соревн/i.test(all)) forks.push({ question: 'Как с этой игрой соревноваться?', options: ['Рекорд класса: побей рекорд автора', 'Вдвоём на одном экране', 'Вызов на зерне: у всех одна и та же волна'] });
  forks.push({ question: 'Как растёт напряжение к концу волны?', options: ['Волна ускоряется с каждым сбитым, как в доноре', 'Чем меньше врагов, тем чаще они стреляют', 'Каждая новая волна начинается ниже'] });
  log({ kind: 'продюсер', model: 'демо', ms: 0, ok: true, demo: true, class: who.class, nick: who.nick, lesson: who.lesson });
  return { praise: 'Демо-режим: продюсер без модели проверяет только кнопки, кубики и крючок.', findings, forks };
}

/* ---------------- программист ---------------- */
function newGameMessage(plan) {
  return fill(userTemplate('new'), {
    'донор': plan.donor, 'твист': plan.twist, 'мир': plan.world, 'уровень': plan.level,
    'детали': [`Название: ${plan.title}`].concat(plan.details).join('\n'),
    'чувство': plan.decisions.feeling, 'честность': plan.decisions.honesty, 'выбор': plan.decisions.choice,
    'идея': plan.igra.i, 'глагол': plan.igra.g, 'правила': plan.igra.r, 'атмосфера': plan.igra.a,
    'развилки': plan.forks.length ? plan.forks.map(f => `- ${f.question} → ${f.answer}`).join('\n') : 'развилок не было',
  });
}

// Программист: один вызов модели + проверка синтаксиса. При синтаксической ошибке — до 2 починок сразу на сервере.
async function program(kind, firstUser, who, onProgress) {
  const model = models().code;
  const system = systemPrompt();
  let messages = [{ role: 'system', content: system }, { role: 'user', content: firstUser }];
  const attempts = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const t0 = Date.now();
    let res;
    try { res = await call(attempt ? 'починка синтаксиса' : kind, who, model, messages, onProgress); } catch (e) {
      log({ kind: attempt ? 'починка синтаксиса' : kind, model, ms: Date.now() - t0, ok: false, error: e.message, class: who.class, nick: who.nick, lesson: who.lesson });
      throw e;
    }
    let code, err;
    try { code = extractCode(res.text); err = syntaxError(code); } catch (e) { err = { message: e.message, line: null }; }
    res.entry.ok = !err; if (err) res.entry.error = err.message;
    attempts.push(log(res.entry));
    if (!err) return { code, model, attempts: attempts.length, warnings: lint(code) };
    if (onProgress) onProgress(0, 'синтаксис');
    messages = [{ role: 'system', content: system }, { role: 'user', content: fill(userTemplate('fix'), {
      'фаза: загрузка | start | update | отрисовка': 'загрузка (синтаксис)', 'текст ошибки': err.message, 'номер': err.line || '?', 'код': code || res.text,
    }) }];
  }
  throw new Error('Программист трижды вернул код с ошибкой синтаксиса');
}

async function build(plan, who, onProgress) {
  if (demo()) return demoGame(plan, who);
  return program('сборка', newGameMessage(plan), who, onProgress);
}
async function change(code, request, who, onProgress) {
  if (demo()) { log({ kind: 'правка', model: 'демо', ms: 0, ok: true, demo: true, class: who.class, nick: who.nick, lesson: who.lesson }); return { code, model: 'демо', attempts: 1, warnings: [], demo: true }; }
  return program('правка', fill(userTemplate('change'), { 'код': code.trim(), 'просьба': request }), who, onProgress);
}
async function fix(code, error, who, onProgress) {
  if (demo()) { log({ kind: 'починка', model: 'демо', ms: 0, ok: false, demo: true, class: who.class, nick: who.nick, lesson: who.lesson }); throw new Error('Демо-режим: без ключа программист не чинит ошибки'); }
  return program('починка', fill(userTemplate('fix'), {
    'фаза: загрузка | start | update | отрисовка': error.phase || 'update', 'текст ошибки': error.message || '?', 'номер': error.line || '?', 'код': code.trim(),
  }), who, onProgress);
}

// Демо: вместо модели — образец урока с названием и решениями ученика.
function demoGame(plan, who) {
  let code = fs.readFileSync(path.join(PORTAL, 'games', 'tarelki-nad-aulom.js'), 'utf8');
  const q = s => JSON.stringify(String(s || ''));
  code = code.replace(/title: '[^']*'/, 'title: ' + q(plan.title || 'Моя игра'))
    .replace(/subtitle: '[^']*'/, 'subtitle: ' + q('Демо-режим: вместо Qwen — образец урока с твоим названием. ' + (plan.igra.i || '')))
    .replace(/decisions: \[[\s\S]*?\],\n/, 'decisions: ' + JSON.stringify([`Чувство: ${plan.decisions.feeling}`, `Честность: ${plan.decisions.honesty}`, `Выбор: ${plan.decisions.choice}`]) + ',\n  notes: ["Демо-режим: игру не писала модель, это образец урока"],\n');
  log({ kind: 'сборка', model: 'демо', ms: 0, ok: true, demo: true, class: who.class, nick: who.nick, lesson: who.lesson });
  return { code, model: 'демо', attempts: 1, warnings: [], demo: true };
}

module.exports = { loadConfig, reloadConfig, demo, models, listModels, producer, build, change, fix, planText, extractCode, syntaxError };
