// Аудит уроков, сессия 8: карта курса «36 комнат лаборатории» (Д1) и лучший момент игры (Д4).
// karta — главная ученика: 8 этажей-модулей, 36 комнат-уроков. Комната светится, когда ученик её прошёл (работал в уроке, и это не
//   сегодняшний урок класса — или в сегодняшнем готовы все шаги), в ней лежат его игра этого урока, донор, линза и формулы понятий.
//   Последний этаж — «Дорога к Фестивалю» (уроки 29–36). GET /api/karta.
// moment — ролик последних 5 секунд игры (GIF): мост игры держит кольцо кадров (engine/moment.js), страница портала собирает GIF
//   после личного рекорда в чужой или своей игре или по кнопке «🎬 Момент» (public/games.js) и шлёт сюда.
//   На игру не больше MAX роликов: рекорд — один на игрока (новый рекорд заменяет прежний), кнопка — последние; автор закрепляет лучший
//   (📌) или убирает лишний. Лучший момент игры — закреплённый, иначе рекорд с самым большим счётом, иначе последний.
//   Файлы — data/games/<id>/moments/<id>.gif, адрес /moment/<игра>/<ролик>.gif (как обложка /poster/: без входа, имя случайное).
//   POST /api/game/moment, GET /api/game/moments?game=, POST /api/game/moment/pick, POST /api/game/moment/remove.
// Подключается из server.js: require('./lib/karta')({ route, needStudent, broadcast, store, lessons, classGame }).
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const MODULI = require('../lessons/moduli');

const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });
const MAX = 8, MAX_B64 = 2800000;
const KINDS = { record: 'рекорд', button: 'кнопка' };

module.exports = function karta({ route, needStudent, broadcast, store, lessons, classGame }) {
  /* ================= лучший момент (Д4) ================= */
  const dirOf = g => path.join(store.gameDir(g.id), 'moments');
  const urlOf = (g, m) => `/moment/${g.id}/${m.id}.gif`;
  const canEdit = (g, nick) => g.nick === nick || (g.members || []).includes(nick);
  function bestOf(g) {
    const list = g.moments || [];
    if (!list.length) return null;
    return list.find(m => m.id === g.momentPick)
      || list.filter(m => m.kind === 'record').sort((a, b) => b.score - a.score || (a.at < b.at ? 1 : -1))[0]
      || list[list.length - 1];
  }
  const view = (g, m) => ({ id: m.id, url: urlOf(g, m), kind: m.kind, kindLabel: KINDS[m.kind] || m.kind, nick: m.nick, score: m.score, version: m.version, at: m.at, pinned: g.momentPick === m.id });
  // для карточки игры (аркада, студия, открытка, раскадровка): адрес лучшего момента и сколько их
  function momentOf(g) { const b = g && bestOf(g); return b ? { url: urlOf(g, b), id: b.id, kind: b.kind, score: b.score, nick: b.nick, count: g.moments.length } : null; }
  function removeFile(g, m) { try { fs.unlinkSync(path.join(dirOf(g), m.id + '.gif')); } catch (e) { /* уже нет */ } }
  const lastPost = new Map(); // ник:игра → время последнего ролика: не чаще раза в 8 секунд
  route('POST', '/api/game/moment', (ctx) => {
    const { w } = needStudent(ctx);
    const g = classGame(w, ctx.body.game);
    if (!g) throw bad('Нет такой игры в классе', 404);
    const m = /^data:image\/gif;base64,([A-Za-z0-9+/=]+)$/.exec(String(ctx.body.data || ''));
    if (!m || m[1].length > MAX_B64) throw bad('Момент — ролик GIF до 2 МБ');
    const buf = Buffer.from(m[1], 'base64');
    if (buf.length < 40 || buf.toString('latin1', 0, 6) !== 'GIF89a') throw bad('Это не GIF');
    const key = w.nick + ':' + g.id, now = Date.now();
    if (now - (lastPost.get(key) || 0) < 8000) throw bad('Момент только что сохранён — подожди пару секунд', 429);
    lastPost.set(key, now);
    const kind = ctx.body.kind === 'record' ? 'record' : 'button';
    const score = Math.max(0, Math.round(Number(ctx.body.score) || 0));
    const list = g.moments = g.moments || [];
    // рекорд — один на игрока: новый рекорд заменяет его прежний ролик (закреплённый не трогаем)
    if (kind === 'record') for (const old of list.filter(x => x.kind === 'record' && x.nick === w.nick && x.id !== g.momentPick)) { list.splice(list.indexOf(old), 1); removeFile(g, old); }
    const item = { id: crypto.randomBytes(6).toString('hex'), nick: w.nick, kind, score, version: Number(ctx.body.version) || g.current, at: store.now(), bytes: buf.length };
    fs.mkdirSync(dirOf(g), { recursive: true });
    fs.writeFileSync(path.join(dirOf(g), item.id + '.gif'), buf);
    list.push(item);
    // лишние — самые старые, кроме закреплённого и лучшего рекорда
    while (list.length > MAX) {
      const best = list.filter(x => x.kind === 'record').sort((a, b) => b.score - a.score)[0];
      const old = list.find(x => x.id !== g.momentPick && x !== best && x !== item) || list.find(x => x.id !== g.momentPick && x !== item);
      if (!old) break;
      list.splice(list.indexOf(old), 1); removeFile(g, old);
    }
    store.saveGame(g);
    if (!g.teacher && !g.compareOf) broadcast(g.class, 'arcade', { game: g.id, author: g.nick, moment: true });
    return { moment: view(g, item), best: momentOf(g) };
  });
  route('GET', '/api/game/moments', (ctx) => {
    const { w } = needStudent(ctx);
    const g = classGame(w, ctx.url.searchParams.get('game'));
    if (!g) throw bad('Нет такой игры в классе', 404);
    return { moments: (g.moments || []).slice().reverse().map(m => view(g, m)), best: momentOf(g), mine: canEdit(g, w.nick) };
  });
  function ownMoment(ctx) {
    const { w } = needStudent(ctx);
    const g = classGame(w, ctx.body.game);
    if (!g || !canEdit(g, w.nick)) throw bad('Это может только автор игры', 403);
    const id = String(ctx.body.id || '');
    const m = (g.moments || []).find(x => x.id === id);
    return { g, m, id };
  }
  route('POST', '/api/game/moment/pick', (ctx) => {
    const { g, m, id } = ownMoment(ctx);
    if (id && !m) throw bad('Нет такого момента', 404);
    if (id && g.momentPick === id) delete g.momentPick; else if (id) g.momentPick = id; else delete g.momentPick;
    store.saveGame(g);
    broadcast(g.class, 'arcade', { game: g.id, author: g.nick, moment: true });
    return { best: momentOf(g), pinned: g.momentPick || null };
  });
  route('POST', '/api/game/moment/remove', (ctx) => {
    const { g, m } = ownMoment(ctx);
    if (!m) throw bad('Нет такого момента', 404);
    g.moments.splice(g.moments.indexOf(m), 1); removeFile(g, m);
    if (g.momentPick === m.id) delete g.momentPick;
    store.saveGame(g);
    broadcast(g.class, 'arcade', { game: g.id, author: g.nick, moment: true });
    return { best: momentOf(g) };
  });
  // файл ролика: /moment/<игра>/<ролик>.gif
  function momentFile(gameId, id) {
    if (!/^[\w-]{6,20}$/.test(gameId) || !/^[0-9a-f]{12}$/.test(id)) return null;
    return path.join(store.gameDir(gameId), 'moments', id + '.gif');
  }

  /* ================= карта курса «36 комнат» (Д1) ================= */
  const answered = st => !!st && Object.keys(st.answers || {}).length > 0;
  const allDone = (l, st) => l.checkpoints.every(cp => cp.steps.every(x => ((st.answers || {})[x.id] || {}).done));
  // уроки 1–36 по номеру (вариант урока с тем же номером не дублирует комнату)
  function rooms() { const seen = new Set(); return lessons().filter(l => l.number >= 1 && l.number <= 36 && !seen.has(l.number) && seen.add(l.number)); }
  function gameCardOf(code, s, l) {
    const st = s.lessons && s.lessons[l.id];
    const g = st && st.gameId ? store.getGame(st.gameId) : null;
    if (!g || !g.current || g.class !== code) return null;
    return { id: g.id, title: g.title || 'Моя игра', version: g.current, poster: g.poster ? `/poster/${g.id}.jpg?v=${g.poster.version}` : null, moment: momentOf(g), release: !!g.release };
  }
  function kartaOf(cls, s, nick) {
    const list = rooms(), now = list.find(l => l.id === cls.lesson) || null;
    const out = list.map(l => {
      const st = s.lessons && s.lessons[l.id], worked = answered(st);
      const state = worked && (l.id !== cls.lesson || allDone(l, st)) ? 'lit' : l.id === cls.lesson ? 'now' : now && l.number < now.number ? 'missed' : 'dark';
      return {
        number: l.number, id: l.id, module: l.module || 0, title: l.title, donor: l.donor || '', lens: l.lens || '', state, today: l.id === cls.lesson,
        concepts: (l.concepts || []).map(c => c.formula || c.title).filter(Boolean).slice(0, 3),
        game: gameCardOf(cls.code, s, l), steps: worked ? Object.values(st.answers).filter(a => a.done).length : 0,
      };
    });
    return {
      nick, class: { code: cls.code, name: cls.name }, emblem: s.emblem || '',
      today: now ? now.number : null, lit: out.filter(r => r.state === 'lit').length, total: out.length,
      floors: MODULI.map(m => ({ number: m.number, title: m.title, rooms: out.filter(r => r.module === m.number) })),
    };
  }
  route('GET', '/api/karta', (ctx) => { const { w, cls, s } = needStudent(ctx); return kartaOf(cls, s, w.nick); });

  const momentsOf = g => (g && g.moments || []).slice().reverse().map(m => view(g, m));
  return { momentOf, momentsOf, momentFile };
};
