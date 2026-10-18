#!/usr/bin/env node
// Собирает системный промпт для Qwen из portal/ai/game-prompt.md:
// подставляет версию Babylon и код образцов. Так же делает портал.
// Второй образец зависит от урока: поле sample сценария ({ file, about }), без него — «Камни мудреца».
// Для моделей Claude — свой короткий промпт portal/ai/claude-prompt.md и один образец: каркаса связки (игра класса) или донора урока.
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

// сценарий урока по id (portal/lessons/<id>.js); уроки-проверки из LAB_LESSONS — null
function lessonModule(lessonId) {
  if (!lessonId || !/^[\w-]+$/.test(lessonId)) return null;
  try { return require(path.join(PORTAL, 'lessons', lessonId + '.js')); } catch (e) { return null; }
}
// образец урока по id сценария; уроки-проверки и уроки без sample — образец по умолчанию
function lessonSample(lessonId) {
  const les = lessonModule(lessonId);
  return les && les.sample && les.sample.file ? les.sample : null;
}

// Игра класса для Claude: один образец того же каркаса, что выбрала связка (поле frame), вместо двух образцов урока.
// Разбор «Козла Фишта» (17.10.2026): два образца на неподвижном поле занимали 73 % промпта, и модель копировала их устройство.
const FRAMES = [
  { re: /арен/i, name: 'арена', file: 'games/nochnoy-labirint.js', about: '«Ночной лабиринт» — арена: герой бегает по полю, угрозы гонятся за ним, бонус меняет роли' },
  { re: /лов/i, name: 'ловля', file: 'games/ledolom.js', about: '«Ледолом» — герой ходит вдоль края поля и отбивает летящее, цели и бонусы по всему полю' },
  { re: /бег/i, name: 'бег навстречу', file: 'games/shag-v-takt.js', about: '«Шаг в такт» — герой бежит, камера едет за ним, препятствия выезжают навстречу и создаются впереди' },
  { re: /сбоку|платформ|прыж/i, name: 'вид сбоку', file: 'games/tur-nad-hadzhohom.js', about: '«Тур над Хаджохом» — вид сбоку: прыжки по скалам, камера едет за героем, уровень строится впереди' },
  { re: /тир|оборон|мишен/i, name: 'тир', file: 'games/nlo-v-stanice.js', about: '«НЛО в станице» — тир и оборона: герой почти на месте, цели наступают, сочный выстрел по восьми шагам' },
];
const frameOf = text => FRAMES.find(f => f.re.test(text || '')) || FRAMES[FRAMES.length - 1];

// Claude: короткий промпт без повторов (claude-prompt.md) и один образец в конце
const isClaude = model => /claude|anthropic/i.test(model || '');
function claudePrompt(opts) {
  const text = between(read('ai/claude-prompt.md'), '<!-- prompt:start -->', '<!-- prompt:end -->', 'claude-prompt.md').split('{{BABYLON}}').join(babylonVersion());
  let file, about;
  if (opts.frame != null) { const f = frameOf(opts.frame); file = f.file; about = `каркас этой игры — ${f.name}, поэтому образец того же каркаса: ${f.about}. Бери из него устройство (камера, создание мира, рост сложности, сочность), а не героя, мир и механику`; }
  else { const s = opts.sample || lessonSample(opts.lesson); file = s ? s.file : SAMPLES['{{ПРИМЕР}}']; about = (s ? s.about : 'ремейк-донор урока 1 по мотивам Space Invaders') + '. Бери из него устройство кода, сочность и уровень детали; механику — только ту, что есть в замысле'; }
  return `${text}\n\n# Образец\nТак выглядит готовая игра по контракту: ${about}. Длина образца — не норма.\n\`\`\`js\n${read(file).trim()}\n\`\`\``;
}

// opts: { lesson } — id урока, { sample } — { file, about }, { model } — модель программиста (Claude — свой промпт),
// { short } — тот же короткий промпт с одним образцом для другой модели (прежнее задание для chat.qwen.ai, урок 1 версии 2),
// { frame } — каркас из связки игры класса (строка, можно пустую): для Claude образец этого каркаса; строка — старый вызов: файл образца 1
function systemPrompt(opts = {}) {
  if (typeof opts === 'string') opts = { example: opts };
  if (isClaude(opts.model) || opts.short) return claudePrompt(opts);
  const second = opts.sample || lessonSample(opts.lesson) || SAMPLE2;
  let text = between(read('ai/game-prompt.md'), '<!-- prompt:start -->', '<!-- prompt:end -->').split('{{BABYLON}}').join(babylonVersion());
  text = text.split('{{ПРИМЕР2_ЧТО}}').join(second.about || 'ремейк-донор урока');
  const files = { '{{ПРИМЕР}}': opts.example || SAMPLES['{{ПРИМЕР}}'], '{{ПРИМЕР2}}': second.file };
  for (const [mark, file] of Object.entries(files)) text = text.split(mark).join(read(file).trim());
  return text;
}

function userTemplate(name) {
  return between(read('ai/game-prompt.md'), `<!-- user:${name}:start -->`, `<!-- user:${name}:end -->`);
}

// размер промпта для каждого урока из portal/lessons/: для Qwen и для Claude (со стандартом геймдизайна)
function sizes() {
  return fs.readdirSync(path.join(PORTAL, 'lessons')).filter(f => /^urok-\d+(-v\d+)?\.js$/.test(f)).sort().map(f => {
    const id = f.replace(/\.js$/, ''), s = lessonSample(id), text = systemPrompt({ lesson: id }), claude = systemPrompt({ lesson: id, model: 'claude' });
    return { lesson: id, sample: (s || SAMPLE2).file, chars: text.length, tokens: tokens(text), claudeTokens: tokens(claude) };
  });
}

module.exports = { FRAMES, frameOf, systemPrompt, userTemplate, babylonVersion, lessonSample, lessonModule, sizes, tokens, isClaude, SAMPLES, LIMIT };

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
    for (const f of FRAMES) console.log(`  игра класса для Claude, каркас «${f.name}» (${f.file}): примерно ${tokens(systemPrompt({ model: 'claude', frame: f.name }))} токенов`);
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
