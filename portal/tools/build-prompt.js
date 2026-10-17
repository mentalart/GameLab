#!/usr/bin/env node
// Собирает системный промпт для Qwen из portal/ai/game-prompt.md:
// подставляет версию Babylon и код образцов. Так же делает портал.
// Второй образец зависит от урока: поле sample сценария ({ file, about }), без него — «Камни мудреца».
// Для моделей Claude перед «# Образцы» встаёт стандарт геймдизайна из portal/ai/game-design-claude.md.
// Запуск: node portal/tools/build-prompt.js [файл] [--lesson urok-04]  — без файла печатает промпт в консоль.
//         node portal/tools/build-prompt.js [файл] --model anthropic/claude-sonnet-5  — промпт для этой модели.
//         node portal/tools/build-prompt.js --sizes  — оценка размера промпта для каждого урока (потолок 30 тысяч токенов — для Qwen).
//         node portal/tools/build-prompt.js --template new|change|fix  — шаблон сообщения ученика.
'use strict';
const fs = require('fs');
const path = require('path');

const PORTAL = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(PORTAL, p), 'utf8');
const LIMIT = 30000; // токенов: потолок из журнала курса (17.10.2026)
const tokens = text => Math.round(text.length / 3); // грубая оценка, как в журнале: три знака на токен

function between(text, start, end, file = 'game-prompt.md') {
  const a = text.indexOf(start), b = text.indexOf(end);
  if (a < 0 || b < a) throw new Error(`В ${file} нет меток ${start} … ${end}`);
  return text.slice(a + start.length, b).trim();
}

function babylonVersion() {
  const m = /babylonjs\s+([\d.]+)/i.exec(read('engine/vendor/VERSIONS.txt'));
  if (!m) throw new Error('Не нашёл версию Babylon в engine/vendor/VERSIONS.txt');
  return m[1];
}

// образцы механик для ИИ: образец 1 — всегда «НЛО в станице», образец 2 — ремейк урока (sample в сценарии) или «Камни мудреца»
const SAMPLES = { '{{ПРИМЕР}}': 'games/nlo-v-stanice.js', '{{ПРИМЕР2}}': 'games/kamni-mudreca.js' };
const SAMPLE2 = {
  file: SAMPLES['{{ПРИМЕР2}}'],
  about: 'ремейк-донор урока 2 по мотивам крестиков-ноликов — пошаговая игра на сетке\nКурсор по клеткам, ход бота перебором с ограничением глубины, матч из нескольких партий, режим «вдвоём за одним экраном», правило-секрет ручкой.',
};

// образец урока по id сценария (portal/lessons/<id>.js); уроки-проверки и уроки без sample — образец по умолчанию
function lessonSample(lessonId) {
  if (!lessonId || !/^[\w-]+$/.test(lessonId)) return null;
  try {
    const les = require(path.join(PORTAL, 'lessons', lessonId + '.js'));
    return les.sample && les.sample.file ? les.sample : null;
  } catch (e) { return null; }
}

// модели Claude получают стандарт геймдизайна: у них нет потолка Qwen, а текст постоянный и кэшируется вместе с промптом
const isClaude = model => /claude|anthropic/i.test(model || '');
const claudeRules = () => between(read('ai/game-design-claude.md'), '<!-- claude:start -->', '<!-- claude:end -->', 'game-design-claude.md');

// opts: { lesson } — id урока, { sample } — { file, about }, { model } — модель программиста; строка — старый вызов: файл образца 1
function systemPrompt(opts = {}) {
  if (typeof opts === 'string') opts = { example: opts };
  const second = opts.sample || lessonSample(opts.lesson) || SAMPLE2;
  let text = between(read('ai/game-prompt.md'), '<!-- prompt:start -->', '<!-- prompt:end -->').split('{{BABYLON}}').join(babylonVersion());
  text = text.split('{{ПРИМЕР2_ЧТО}}').join(second.about || 'ремейк-донор урока');
  const files = { '{{ПРИМЕР}}': opts.example || SAMPLES['{{ПРИМЕР}}'], '{{ПРИМЕР2}}': second.file };
  for (const [mark, file] of Object.entries(files)) text = text.split(mark).join(read(file).trim());
  if (isClaude(opts.model)) {
    const at = text.indexOf('\n# Образцы');
    if (at < 0) throw new Error('В game-prompt.md нет раздела «# Образцы»');
    text = text.slice(0, at) + '\n' + claudeRules() + '\n' + text.slice(at);
  }
  return text;
}

function userTemplate(name) {
  return between(read('ai/game-prompt.md'), `<!-- user:${name}:start -->`, `<!-- user:${name}:end -->`);
}

// размер промпта для каждого урока из portal/lessons/: для Qwen и для Claude (со стандартом геймдизайна)
function sizes() {
  return fs.readdirSync(path.join(PORTAL, 'lessons')).filter(f => /^urok-\d+\.js$/.test(f)).sort().map(f => {
    const id = f.replace(/\.js$/, ''), s = lessonSample(id), text = systemPrompt({ lesson: id }), claude = systemPrompt({ lesson: id, model: 'claude' });
    return { lesson: id, sample: (s || SAMPLE2).file, chars: text.length, tokens: tokens(text), claudeTokens: tokens(claude) };
  });
}

module.exports = { systemPrompt, userTemplate, babylonVersion, lessonSample, sizes, tokens, isClaude, SAMPLES, LIMIT };

if (require.main === module) {
  const args = process.argv.slice(2);
  const ti = args.indexOf('--template');
  if (ti >= 0) { console.log(userTemplate(args[ti + 1] || 'new')); process.exit(0); }
  if (args.includes('--sizes')) {
    let ok = true;
    for (const r of sizes()) {
      const over = r.tokens > LIMIT; ok = ok && !over;
      console.log(`${over ? '✗' : '✓'} ${r.lesson}: образец 2 — ${r.sample}, ${r.chars} знаков, примерно ${r.tokens} токенов (для Claude — ${r.claudeTokens})`);
    }
    console.log(ok ? `Все промпты не больше ${LIMIT} токенов` : `Есть промпты больше ${LIMIT} токенов`);
    process.exit(ok ? 0 : 1);
  }
  const li = args.indexOf('--lesson'), mi = args.indexOf('--model');
  const lesson = li >= 0 ? args[li + 1] : null, model = mi >= 0 ? args[mi + 1] : null;
  const file = args.find((a, i) => !a.startsWith('--') && !(li >= 0 && i === li + 1) && !(mi >= 0 && i === mi + 1));
  const text = systemPrompt({ lesson, model });
  if (file) {
    fs.writeFileSync(file, text);
    console.error(`Промпт записан в ${file}: ${text.length} символов, примерно ${tokens(text)} токенов`);
  } else {
    console.log(text);
  }
}
