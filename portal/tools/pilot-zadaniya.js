#!/usr/bin/env node
// Прогон колоды урока 1 до урока (пилот «рецепт + слоты», 19.10.2026): готовые задания Qwen для жанров с рецептом.
// На каждый такой жанр — по N случайных наборов карт (N = --po=2), задание то же, что портал даёт учителю в окне Qwen,
// только без гейм дизайн документа: прогон проверяет сам рецепт. Спрятанная механика — игры класса (--secret=id — другая, --secret=net — без неё).
// Автор вставляет задания в chat.qwen.ai, играет по минуте и отвечает на пять вопросов из шапки файла.
// Запуск: node portal/tools/pilot-zadaniya.js [--po=2] [--seed=1] [--secret=id|net] [--out=файл.md]
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
// ai.js читает настройки при загрузке: временный config.json без ключа, чтобы не трогать настоящий
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-pilot-'));
process.env.LAB_DATA = path.join(TMP, 'data');
process.env.LAB_CONFIG = path.join(TMP, 'config.json');
fs.writeFileSync(process.env.LAB_CONFIG, JSON.stringify({ ai: { apiKey: '' } }));
const ai = require('../lib/ai');
const les = require('../lessons/urok-01');

let seed = Number(arg('seed', 1)) || 1;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = list => list[Math.floor(rnd() * list.length)];
const deckOf = (id, action) => { const c = les.wow.cards.find(x => x.id === id); return (c.by && c.decks && c.decks[action]) || c.deck; };

const sid = arg('secret', les.wow.classSecret);
const sec = sid === 'net' ? null : les.wow.secrets.find(x => x.id === sid);
if (sid !== 'net' && !sec) { console.error(`Нет спрятанной механики «${sid}»: ${les.wow.secrets.map(x => x.id).join(', ')}`); process.exit(1); }
const per = Number(arg('po', 2)) || 2;

const out = ['# Прогон колоды урока 1: задания для Qwen', '',
  `Собрано ${new Date().toISOString().slice(0, 10)} скриптом \`portal/tools/pilot-zadaniya.js\`. Спрятанная механика: ${sec ? `«${sec.title}»` : 'нет'}. Гейм дизайн документа в заданиях нет: проверяем рецепт жанра.`, '',
  'Каждое задание вставьте в новый чат chat.qwen.ai, ответ — в «Свою игру» портала или просто откройте файл HTML. Сыграйте минуту и ответьте на пять вопросов:', '',
  '1. За 10 секунд понятно, что делать?', '2. Жанр узнаётся с первого экрана?', '3. Есть проигрыш, и он честный?', '4. Угрозу видно заранее?', '5. Поворот работает и заметен?', ''];
let n = 0;
for (const g of les.wow.genres.filter(x => x.recipe)) {
  for (let i = 0; i < per; i++) {
    const cards = { action: g.card };
    for (const id of ['hero', 'place', 'threat', 'twist']) cards[id] = pick(deckOf(id, g.card));
    const text = ai.chatSharedText({ cards, genre: g, secret: sec && sec.prompt, base: sec && sec.base, howto: sec && sec.howto, link: null });
    n++;
    out.push(`## ${n}. ${g.name}: ${cards.hero.split(' — ')[0]} ${cards.place.split(' — ')[0]}`, '',
      `Карты: ${cards.hero} · ${cards.place} · ${cards.threat} · ${cards.twist}`, '',
      'Ответы: 1 — · 2 — · 3 — · 4 — · 5 —', '', '````text', text, '````', '');
  }
}
const file = arg('out', null);
if (file) { fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true }); fs.writeFileSync(file, out.join('\n')); console.log(`Заданий: ${n} → ${file}`); }
else console.log(out.join('\n'));
fs.rmSync(TMP, { recursive: true, force: true });
