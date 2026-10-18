#!/usr/bin/env node
// Подставной OpenAI-совместимый ИИ для проверки портала без ключа и без денег.
// По API — продюсер (JSON с развилкой), правка продюсера, связка карт и черновик отзыва; поддерживает потоковый ответ (stream).
// Программиста — Qwen в чате — подменяет chatAnswer ниже.
// Запуск: node portal/tools/mock-ai.js [порт]  →  в config.json: "baseUrl": "http://localhost:порт/v1", "apiKey": "mock"
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const SAMPLE = fs.readFileSync(path.join(__dirname, '..', 'games', 'nlo-v-stanice.js'), 'utf8');
const BROKEN = SAMPLE.replace('  update(lab, dt) {', '  update(lab, dt) {\n    if (lab.t > 1.2) lab.state.nothing.position.x = 1; // подставная ошибка для проверки автопочинки');

// last.chat — задания, которые портал выдал подставному Qwen; last.wowUser, newUser, playtestUser — последние из них по виду;
// last.marked — модели, чей системный промпт пришёл с меткой кэша cache_control
const last = { marked: new Set(), changeTries: [], chat: [] };
const flat = c => typeof c === 'string' ? c : (c || []).map(p => p.text || '').join('');
function answer(messages, model) {
  const sys = flat((messages.find(m => m.role === 'system') || {}).content);
  const user = flat((messages.filter(m => m.role === 'user').pop() || {}).content);
  if (/геймдизайнер-сводчик/.test(sys)) { // связка карт вау-старта
    last.linkUser = user;
    return JSON.stringify({ phrase: 'Ты — герой с карты, и каждое действие толкает тебя через всё поле. Цель — продержаться две минуты и собрать рекорд.', frame: 'Арена, изометрия: всё поле видно целиком.', controls: 'Движение — бегать, A — действие, B — рывок.', loop: 'Каждые три секунды выбираешь, куда действовать: отдача уносит тебя от опасности или прямо в неё.', risk: 'Действие вплотную к угрозе — очки ×2.', threats: 'Одни идут прямо, другие заходят сбоку; касание отнимает жизнь.', curve: 'К 30-й секунде — второй вид угроз, к 60-й — быстрее, к 90-й — вожак.', twist: 'Поворот усиливает главное действие, но им же можно себе навредить.', funny: 'Герой улетает от собственного выстрела в стог сена.' });
  }
  if (/черновик отзыва учителя/i.test(sys)) { // черновик отзыва: понятие и вопрос из колод урока
    last.draftUser = user;
    return JSON.stringify({ concept: 'Доминирующая стратегия: одна кнопка решает почти всё', question: 'Какой кнопке в твоей игре нужна цена?', why: 'Соседи почти всю партию держали одну кнопку.' });
  }
  if (/Перепиши промпт ИГРА/.test(user)) { // правка продюсера: поля ИГРА заново
    return JSON.stringify({ igra: { i: 'Пасечник защищает пасеку от шершней, напряжение растёт с каждым сбитым.', g: 'Стрелки — двигаться, пробел — стрелять, на геймпаде крестовина и A.', r: 'Шершни спускаются строем всё быстрее. Соревнуемся рекордом класса. Три жизни.', a: 'Закат над пасекой, золотые искры, гул роя.' }, changes: ['Вписал рекорд класса — так есть чем соревноваться.', 'Назвал кнопки на геймпаде.'] });
  }
  if (/продюсер/i.test(sys)) {
    return JSON.stringify({ praise: 'Понятная идея и честное предупреждение перед выстрелом.', findings: [{ kind: 'нет крючка', text: 'Непонятно, как соревноваться с друзьями.' }], forks: [{ question: 'Как соревноваться?', options: ['Рекорд класса', 'Вдвоём на одном экране'] }], frame: 'Как у донора, изометрия' });
  }
  return '{}';
}

// Подставной Qwen в чате: server.js с LAB_CHAT_AUTO вставляет этот ответ в окно Qwen сам (q — задание: kind, prompt, followUp).
// Отвечает объектом GAME образца урока — портал принимает и его, поэтому проверки ручек, рекордов и бота-плейтестера те же.
// Первая сборка ученика падает через секунду (проверка починки через тот же чат), игра класса — образец с ручкой secret,
// правка ученика сначала присылает куски, которые не ложатся, и после ответа портала — игру целиком.
const js = code => '```js\n' + code + '```';
const noted = (code, note) => code.replace("  donor: 'Space Invaders',", "  donor: 'Space Invaders',\n  notes: [" + JSON.stringify(note) + '],');
function chatAnswer(q) {
  const t = String(q.prompt || '');
  last.chat.push({ kind: q.kind, followUp: !!q.followUp, prompt: t });
  if (last.demo && !q.followUp) { const d = demoAnswer(q, t); if (d) return d; }
  if (q.followUp) { // портал не принял прошлый ответ — игра целиком
    if (/^правка/.test(q.kind)) last.changeTries.push('целиком');
    return 'Вот игра целиком.\n' + js(noted(SAMPLE, 'Правка ученика выполнена (подставной Qwen)'));
  }
  if (/# Гейм дизайн документ/.test(t)) { // игра класса: спрятанная механика образца переименована в ручку secret
    last.wowUser = t;
    const hero = ((/- Герой: (.+)/.exec(t) || [])[1] || 'Герой').split(' — ')[0];
    const shared = SAMPLE.replace(/speedup/g, 'secret').replace(/label: 'Спрятанная механика: ускорение от числа сбитых', hint: '[^']*'/, "label: 'Спрятанная механика', hint: '0 — выключена, 1 — как задумано'")
      .replace(/\n.*Спрятанная механика выключена: волна не ускорялась.*\n/, '\n');
    return js(shared.replace(/title: '[^']*'/, 'title: ' + JSON.stringify(hero.trim() + ' против волны')));
  }
  if (/# Замысел геймдизайнера/.test(t)) { // своя игра ученика: падает через секунду; карта спрятанной механики — ручка secret
    last.newUser = t;
    const title = (/Название: (.+)/.exec(t) || [])[1];
    let code = /Спрятанная механика — её нет на картах/.test(t) ? BROKEN.replace(/speedup/g, 'secret') : BROKEN;
    if (title) code = code.replace(/title: '[^']*'/, 'title: ' + JSON.stringify(title.trim()));
    return js(code.replace("  donor: 'Space Invaders',", "  donor: 'Space Invaders',\n  notes: ['Решил сам: добавил золотую тарелку-бонус', 'Решил сам: стога-укрытия из сена'],"));
  }
  if (/Игра упала/.test(t)) { // починка: убираем подставную ошибку (кусками, если просят куски)
    const code = (/```(?:js|html)\n([\s\S]*?)```/.exec(t.slice(t.lastIndexOf('Игра упала'))) || [])[1] || SAMPLE; // в задании GAME выше — правила с образцами
    const bad = code.split('\n').find(l => l.includes('подставная ошибка'));
    if (/НАЙТИ/.test(t) && bad) { last.fixPatch = true; return 'Нашёл: обращение к несуществующему объекту.\n<<<<<<< НАЙТИ\n' + bad + '\n=======\n>>>>>>> ЗАМЕНИТЬ\n'; }
    return 'Нашёл: обращение к несуществующему объекту. Исправил.\n' + js(code.split('\n').filter(l => !l.includes('подставная ошибка')).join('\n'));
  }
  if (/отчёту бота-плейтестера/.test(t)) { // правка игры класса по отчёту бота: куски с заметкой о правке
    last.playtestUser = t;
    return "Правлю два места.\n<<<<<<< НАЙТИ\n  players: 1,\n=======\n  notes: ['Правка по плейтесту (подставной Qwen): бездействие теперь наказано'],\n  players: 1,\n>>>>>>> ЗАМЕНИТЬ\n";
  }
  if (/просит одно изменение/.test(t)) { // правка ученика: куски нарочно не ложатся — портал просит прислать заново
    last.changeTries.push('куски');
    return '<<<<<<< НАЙТИ\nтакой строки в игре нет\n=======\nconst x = 1;\n>>>>>>> ЗАМЕНИТЬ\n';
  }
  return js(SAMPLE);
}

// last.demo — прогон «демо-режим» в e2e: своя игра ученика — образец урока с его названием и решениями (ремейк из sample сценария),
// правка оставляет игру как есть; игра класса, починка и правка по плейтесту — как выше
function demoAnswer(q, t) {
  if (/# Замысел геймдизайнера/.test(t)) {
    last.newUser = t;
    let les = null; try { les = require(path.join(__dirname, '..', 'lessons', String(q.lesson || '').replace(/[^\w-]/g, ''))); } catch (e) { /* урок-проверка */ }
    let code = les && les.sample ? fs.readFileSync(path.join(__dirname, '..', les.sample.file), 'utf8') : SAMPLE;
    const f = re => ((re.exec(t) || [])[1] || '').trim(), q2 = v => JSON.stringify(String(v || ''));
    if (/Спрятанная механика — её нет на картах/.test(t)) code = code.replace(/speedup/g, 'secret');
    code = code.replace(/title: '[^']*'/, 'title: ' + q2(f(/Название: (.+)/) || 'Моя игра'))
      .replace(/subtitle: '[^']*'/, 'subtitle: ' + q2('Демо-режим: вместо Qwen — образец урока с твоим названием. ' + f(/- Идея и чувство: (.+)/)))
      .replace(/decisions: \[[\s\S]*?\],\n/, 'decisions: ' + JSON.stringify([`Чувство: ${f(/- Чувство: (.+)/)}`, `Честность: ${f(/- Честность: (.+)/)}`, `Выбор: ${f(/- Выбор: (.+)/)}`]) + ',\n  notes: ["Демо-режим: игру не писала модель, это образец урока"],\n');
    return js(code);
  }
  // правка идёт в тот же чат без кода игры: кусок, который ничего не меняет, ложится в любую игру GAME
  if (/просит одно изменение/.test(t)) return 'Готово.\n<<<<<<< НАЙТИ\nconst GAME = {\n=======\nconst GAME = {\n>>>>>>> ЗАМЕНИТЬ\n';
  return null;
}

const cacheSeen = new Set();
function start(port = 0) {
  const srv = http.createServer((req, res) => {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      if (req.url.endsWith('/models')) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ data: [{ id: 'mock-code' }, { id: 'mock-text' }] })); }
      if (!req.url.endsWith('/chat/completions')) { res.writeHead(404); return res.end(); }
      const j = JSON.parse(body || '{}');
      const text = answer(j.messages || [], j.model);
      const usage = { prompt_tokens: Math.round(JSON.stringify(j.messages).length / 3), completion_tokens: Math.round(text.length / 3) };
      // кэш как у провайдера: системный промпт с меткой cache_control в первый раз записывается в кэш, потом читается из него
      const sm = (j.messages || []).find(m => m.role === 'system');
      if (sm && Array.isArray(sm.content) && sm.content.some(p => p.cache_control)) {
        last.marked.add(j.model);
        const key = j.model + '\n' + flat(sm.content), n = Math.round(flat(sm.content).length / 3);
        usage.prompt_tokens_details = cacheSeen.has(key) ? { cached_tokens: n } : { cache_write_tokens: n };
        cacheSeen.add(key);
      }
      if (j.stream) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        const parts = text.match(/[\s\S]{1,400}/g) || [''];
        let i = 0;
        const tick = () => {
          if (i < parts.length) { res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: parts[i++] } }] }) + '\n\n'); setTimeout(tick, 5); return; }
          res.write('data: ' + JSON.stringify({ choices: [], usage }) + '\n\n');
          res.end('data: [DONE]\n\n');
        };
        tick();
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: text } }], usage }));
      }
    });
  });
  return new Promise(r => srv.listen(port, '127.0.0.1', () => r(srv)));
}
module.exports = { start, last, chatAnswer };
if (require.main === module) start(Number(process.argv[2]) || 8090).then(s => console.log('Подставной ИИ: http://127.0.0.1:' + s.address().port + '/v1'));
