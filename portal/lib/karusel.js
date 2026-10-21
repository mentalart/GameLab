// Карусель (Г5 аудита уроков, сессия 5): обмен игр по кругу. Учитель на проекторе запускает круг: в него встают авторы игр этого урока
// в случайном порядке. Каждые sec секунд (по умолчанию 4 минуты) игра уходит следующему: в круге k игрок с местом i играет игру места i + k + 1,
// свою — никогда. Кругов — rounds шага (5), но не больше, чем игроков минус один. Ученик без своей игры тоже играет — игру по хешу ника.
// На каждой игре — короткий отзыв: чувство, что поправить, строка своими словами. Отзыв уходит автору и карточкой плейтеста (для «Правки 2»).
// Автор видит сводку: что совпало у всех или у большинства, а что заметил один. Состояние — cls.karusel.
// Подключается из server.js: require('./lib/karusel')({ route, needStudent, needTeacher, broadcast, store, lesson, stepOf, classGames }).
'use strict';
const crypto = require('crypto');

const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });
const hash = t => [...String(t)].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0, 7);
const clean = (t, n) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, n);

module.exports = function karusel({ route, needStudent, needTeacher, broadcast, store, lesson, stepOf, classGames }) {
  const classOf = code => { const cls = store.getClass(String(code || '')); if (!cls) throw bad('Нет класса', 404); return cls; };
  const stepIn = (les, id) => { const f = les && id && stepOf(les, id); return f && f.step.type === 'karusel' ? f.step : null; };
  const firstStep = les => (les ? les.checkpoints.flatMap(c => c.steps).find(s => s.type === 'karusel') : null);
  const now = () => Date.now();
  // текущий круг по часам: -1 — ещё не начали, rounds — все круги сыграны
  function roundOf(k, t = now()) {
    if (!k) return -1;
    if (k.phase === 'end') return k.rounds;
    return Math.min(k.rounds, Math.floor((t - k.at) / (k.sec * 1000)));
  }
  const live = cls => { const k = cls.karusel; return k && k.lesson === cls.lesson ? k : null; };
  // чью игру играет ник в круге r: место в круге или место по хешу ника для тех, у кого игры нет
  function targetOf(k, nick, r) {
    const n = k.ring.length, i = k.ring.findIndex(x => x.nick === nick);
    if (r < 0 || r >= k.rounds || n < 2) return null;
    return i >= 0 ? k.ring[(i + r + 1) % n] : k.ring[(hash(nick) + r) % n];
  }
  // сводка отзывов на игру автора: чувства и «что поправить» по числу голосов; совпало у большинства или у одного
  function summaryOf(k, game) {
    const notes = k.notes.filter(x => x.game === game);
    const count = key => {
      const m = new Map(); notes.forEach(x => { if (x[key]) m.set(x[key], (m.get(x[key]) || 0) + 1); });
      return [...m.entries()].map(([label, c]) => ({ label, n: c, all: notes.length >= 2 && c === notes.length, most: notes.length >= 2 && c * 2 > notes.length, one: c === 1 })).sort((a, b) => b.n - a.n);
    };
    return { n: notes.length, feel: count('feel'), fix: count('fix'), texts: notes.filter(x => x.text).map(x => ({ text: x.text, round: x.round + 1 })) };
  }
  // вид для ученика (viewer — ник) или учителя ('teacher'); now — часы сервера, чтобы таймер шёл одинаково у всех
  function view(cls, viewer) {
    const k = live(cls);
    if (!k) return { phase: null, now: now() };
    const r = roundOf(k), done = r >= k.rounds;
    const out = { step: k.step, phase: done ? 'end' : 'run', round: r, rounds: k.rounds, sec: k.sec, at: k.at, now: now(), size: k.ring.length,
      ends: done ? null : k.at + (r + 1) * k.sec * 1000 };
    if (viewer === 'teacher') {
      out.ring = k.ring.map(x => ({ nick: x.nick, title: x.title }));
      out.notes = k.notes.length;
      out.sent = done ? null : k.ring.filter(x => k.notes.some(n => n.from === x.nick && n.round === r)).length;
      return out;
    }
    const me = k.ring.find(x => x.nick === viewer);
    out.inRing = !!me;
    if (!done) {
      const tg = targetOf(k, viewer, r);
      if (tg) { const g = store.getGame(tg.game); out.target = g && g.current ? { id: g.id, version: g.current, title: g.title || tg.title, nick: g.nick } : null; }
      const sent = k.notes.find(x => x.from === viewer && x.round === r);
      if (sent) out.sent = { feel: sent.feel, fix: sent.fix, text: sent.text };
    }
    out.given = k.notes.filter(x => x.from === viewer).length;
    if (me) out.mine = Object.assign({ title: me.title }, summaryOf(k, me.game));
    return out;
  }
  const event = cls => broadcast(cls.code, 'karusel', { at: now() });

  // учитель: start — собрать круг из игр урока и начать первый круг; next — следующий круг сейчас; end — закончить; reset — убрать
  route('GET', '/api/teacher/karusel', (ctx) => { needTeacher(ctx); return { karusel: view(classOf(ctx.url.searchParams.get('code')), 'teacher') }; });
  route('POST', '/api/teacher/karusel', (ctx) => {
    needTeacher(ctx);
    const cls = classOf(ctx.body.code), les = lesson(cls.lesson), b = ctx.body, k = live(cls);
    if (b.action === 'start') {
      const st = stepIn(les, b.step) || firstStep(les);
      if (!st) throw bad('В этом уроке нет карусели');
      const games = classGames(cls.code).filter(g => g.lesson === les.id && !g.hidden && g.current);
      const seen = new Set(), ring = [];
      for (const g of games) if (!seen.has(g.nick)) { seen.add(g.nick); ring.push({ nick: g.nick, game: g.id, title: g.title || 'Игра' }); }
      if (ring.length < 2) throw bad('Для карусели нужны хотя бы две собранные игры этого урока');
      for (let i = ring.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [ring[i], ring[j]] = [ring[j], ring[i]]; }
      const sec = Math.max(30, Math.min(900, Number(b.sec) || (st.minutes || 4) * 60));
      cls.karusel = { lesson: les.id, step: st.id, ring, rounds: Math.min(st.rounds || 5, ring.length - 1), sec, at: now(), phase: 'run', notes: [] };
    } else if (b.action === 'next') {
      if (!k) throw bad('Карусель ещё не началась');
      const r = roundOf(k);
      if (r >= k.rounds) throw bad('Все круги уже сыграны');
      k.at = now() - (r + 1) * k.sec * 1000; // следующий круг начинается сейчас
    } else if (b.action === 'end') { if (!k) throw bad('Карусель ещё не началась'); k.phase = 'end'; }
    else if (b.action === 'reset') cls.karusel = null;
    else throw bad('Нет такого действия');
    store.saveClass(cls); event(cls);
    return { karusel: view(cls, 'teacher') };
  });
  // ученик: где карусель сейчас, чья игра у меня в этом круге, сводка отзывов на мою игру
  route('GET', '/api/karusel', (ctx) => { const { w, cls } = needStudent(ctx); return { karusel: view(cls, w.nick) }; });
  // отзыв на игру этого круга: одно чувство, одно «что поправить» и строка своими словами; повторный — заменяет прошлый
  route('POST', '/api/karusel/note', (ctx) => {
    const { w, cls, les } = needStudent(ctx), k = live(cls), b = ctx.body;
    if (!k) throw bad('Карусель ещё не началась', 409);
    const r = roundOf(k);
    if (r >= k.rounds) throw bad('Карусель закончилась', 409);
    if (Number(b.round) !== r) throw bad('Круг уже сменился: игра ушла дальше', 409);
    const tg = targetOf(k, w.nick, r), g = tg && store.getGame(tg.game);
    if (!g || g.id !== b.game) throw bad('Это не твоя игра в этом круге', 409);
    const st = stepIn(les, k.step) || {};
    const feel = (st.feelings || []).includes(b.feel) ? b.feel : null, fix = (st.fixes || []).includes(b.fix) ? b.fix : null, text = clean(b.text, 160);
    if (!feel && !fix && !text) throw bad('Выбери чувство или напиши строку');
    k.notes = k.notes.filter(x => !(x.from === w.nick && x.round === r));
    k.notes.push({ from: w.nick, game: g.id, author: g.nick, round: r, feel, fix, text, at: store.now() });
    // карточка плейтеста автору: чувство — эмоция, «что поправить» — «Хочется», строка — «Нравится»
    if (g.nick !== w.nick) store.addPlay(g.id, { type: 'card', nick: w.nick, card: { emotions: feel ? [feel] : [], like: { text, dice: false }, want: { text: fix || '', dice: false }, whatif: { text: '', dice: false }, karusel: true } });
    store.saveClass(cls); event(cls);
    broadcast(cls.code, 'arcade', { game: g.id, author: g.nick });
    return { karusel: view(cls, w.nick) };
  });

  return { view };
};
