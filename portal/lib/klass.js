// Проектор и класс (аудит уроков 21.10.2026, сессия 2): театр сцены, цель класса, живые реакции, галерея провалов.
//   Театр сцены (В5) — учитель ведёт сцену шага motion на проекторе. Перед переключателем класс голосует с ноутбуков «что изменится?»
//     (поле vote у переключателя: q, options, right, why), учитель включает — все видят ответ и итог голосования. Состояние — cls.theater.
//   Цель класса (Д2) — счётчик партий в игры друг друга (своя игра и игра своей команды не считаются). Цель и награду задаёт учитель:
//     секретный донор «Звездопад над Фиштом», режим арены или свой приз словами. Состояние — cls.goal.
//   Живые реакции (Д3) — эмодзи с ноутбуков всплывают поверх игры на проекторе. Проектор сам говорит, какая игра у него в рамке (live),
//     и пишет реакции в телеметрию игры (тип партии react: секунда партии и эмодзи) — у автора «где смеялись». Частота ограничена.
//   Галерея провалов (Д5) — показанные «Провалы дня» класса (cls.fails, А5) стеной: голос «самый смешной» (один на ученика),
//     автор может убрать свой провал; на проекторе — галерея и нарезка лучших к Фестивалю.
// Подключается из server.js: require('./lib/klass')({ route, needStudent, needTeacher, broadcast, store, lesson, stepOf, failMembers }).
'use strict';
const crypto = require('crypto');

const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });
const REACTIONS = ['😂', '😮', '🔥', '👏', '😱', '❤️'];
// награды цели класса: секретный донор — образец оболочки, которого нет ни в одном уроке; арена — забег урока 26 с ботами
const REWARDS = {
  zvezdopad: { icon: '🌠', label: 'Секретный донор: «Звездопад над Фиштом»', game: 'games/zvezdopad.js', hint: 'Донора нет ни в одном уроке: метеориты над Фиштом и очки за пролёт впритык.' },
  arena: { icon: '🏟', label: 'Режим арены: «Арена класса»', game: 'games/arena-klassa.js', hint: 'Забег урока 26 — для всех раньше времени.' },
  text: { icon: '🎁', label: 'Свой приз', game: null, hint: '' },
};

module.exports = function klass({ route, needStudent, needTeacher, broadcast, store, lesson, stepOf, failMembers }) {
  const classOf = code => { const cls = store.getClass(String(code || '')); if (!cls) throw bad('Нет класса', 404); return cls; };

  /* ================= театр сцены (В5) ================= */
  const sceneOf = (les, t) => {
    const f = t && les && stepOf(les, t.step), sc = f && f.step.type === 'motion' && f.step.scenes[t.scene];
    return sc ? { step: f.step, sc } : null;
  };
  const togglesOn = sc => Object.fromEntries((sc.toggles || []).map(x => [x.id, !!x.on]));
  // view: 'teacher' — всё, включая ответ и голоса; иначе — ученику: ответ и итог только после «Включить» (phase reveal)
  function theaterView(cls, viewer) {
    const t = cls.theater, les = t && lesson(cls.lesson), f = t && t.lesson === cls.lesson && sceneOf(les, t);
    if (!f) return null;
    const ask = t.ask, tog = ask && (f.sc.toggles || []).find(x => x.id === ask.toggle), v = tog && tog.vote;
    const out = { step: t.step, stepTitle: f.step.title || '', scene: t.scene, scenes: f.step.scenes.length, anim: f.sc.anim, title: f.sc.title, phase: t.phase, on: t.on || {}, at: t.at };
    if (v) {
      const votes = Object.values(ask.votes || {});
      Object.assign(out, { ask: ask.id, toggle: { id: tog.id, label: tog.label }, turnOn: !(t.phase === 'reveal' ? !t.on[tog.id] : t.on[tog.id]), q: v.q, options: v.options, n: votes.length });
      if (t.phase === 'reveal' || viewer === 'teacher') Object.assign(out, { right: v.right, why: v.why || '', counts: v.options.map((_, i) => votes.filter(x => x === i).length) });
      if (viewer && viewer !== 'teacher' && ask.votes && ask.votes[viewer] != null) out.mine = ask.votes[viewer];
    }
    if (viewer === 'teacher') out.log = (t.log || []).slice(-12);
    return out;
  }
  const theaterEvent = cls => broadcast(cls.code, 'theater', theaterView(cls, null) || { phase: null });
  route('GET', '/api/teacher/theater', (ctx) => { needTeacher(ctx); return { theater: theaterView(classOf(ctx.url.searchParams.get('code')), 'teacher') }; });
  route('POST', '/api/teacher/theater', (ctx) => {
    needTeacher(ctx);
    const cls = classOf(ctx.body.code), les = lesson(cls.lesson), b = ctx.body, act = b.action;
    let t = cls.theater && cls.theater.lesson === cls.lesson ? cls.theater : null;
    if (act === 'end') cls.theater = null;
    else if (act === 'show') {
      const f = stepOf(les, b.step);
      if (!f || f.step.type !== 'motion') throw bad('Это не сцена урока');
      const scene = Math.max(0, Math.min(f.step.scenes.length - 1, Number(b.scene) || 0));
      cls.theater = { lesson: les.id, step: f.step.id, scene, phase: 'show', on: togglesOn(f.step.scenes[scene]), ask: null, at: store.now(), log: t && t.step === f.step.id ? t.log || [] : [] };
    } else {
      if (!t) throw bad('Сначала «🎭 Показать сцену классу»');
      const f = sceneOf(les, t);
      if (!f) throw bad('Сцены больше нет в уроке');
      if (act === 'scene') {
        const scene = Math.max(0, Math.min(f.step.scenes.length - 1, Number(b.scene) || 0));
        Object.assign(t, { scene, phase: 'show', on: togglesOn(f.step.scenes[scene]), ask: null, at: store.now() });
      } else {
        const tog = (f.sc.toggles || []).find(x => x.id === (act === 'reveal' && t.ask ? t.ask.toggle : b.toggle));
        if (!tog) throw bad('Нет такого переключателя');
        if (act === 'ask') {
          if (!tog.vote) throw bad('У переключателя нет вопроса классу');
          Object.assign(t, { phase: 'ask', ask: { id: store.id(6), toggle: tog.id, votes: {} }, at: store.now() });
        } else if (act === 'reveal') {
          if (t.phase !== 'ask') throw bad('Голосование не идёт');
          t.on = Object.assign({}, t.on, { [tog.id]: !t.on[tog.id] });
          const votes = Object.values(t.ask.votes || {});
          t.log = (t.log || []).concat({ scene: t.scene, toggle: tog.id, label: tog.label, n: votes.length, right: votes.filter(x => x === tog.vote.right).length, at: store.now() }).slice(-40);
          Object.assign(t, { phase: 'reveal', at: store.now() });
        } else if (act === 'flip') { // переключатель без голосования: учитель просто включает
          t.on = Object.assign({}, t.on, { [tog.id]: !t.on[tog.id] });
          Object.assign(t, { phase: 'show', ask: null, at: store.now() });
        } else throw bad('Нет такого действия');
      }
    }
    store.saveClass(cls); theaterEvent(cls);
    return { theater: theaterView(cls, 'teacher') };
  });
  route('POST', '/api/theater/vote', (ctx) => {
    const { w, cls } = needStudent(ctx);
    const t = cls.theater;
    if (!t || t.lesson !== cls.lesson || t.phase !== 'ask' || !t.ask || t.ask.id !== ctx.body.ask) throw bad('Голосование уже закрыто', 409);
    const f = sceneOf(lesson(cls.lesson), t), tog = f && (f.sc.toggles || []).find(x => x.id === t.ask.toggle);
    const i = Number(ctx.body.option);
    if (!tog || !tog.vote || !Number.isInteger(i) || i < 0 || i >= tog.vote.options.length) throw bad('Нет такого ответа');
    t.ask.votes[w.nick] = i;
    store.saveClass(cls); theaterEvent(cls);
    return { theater: theaterView(cls, w.nick) };
  });

  /* ================= цель класса (Д2) ================= */
  function goalView(cls) {
    const g = cls.goal;
    if (!g) return null;
    const r = REWARDS[g.reward] || REWARDS.text;
    return { target: g.target, count: g.count || 0, reached: g.reached || null, since: g.since, reward: { id: g.reward, icon: r.icon, label: g.reward === 'text' ? g.text || 'Приз от учителя' : r.label, hint: g.reward === 'text' ? '' : r.hint, game: g.reached ? r.game : null } };
  }
  route('GET', '/api/goal', (ctx) => { const { cls } = needStudent(ctx); return { goal: goalView(cls) }; });
  route('POST', '/api/teacher/goal', (ctx) => {
    needTeacher(ctx);
    const cls = classOf(ctx.body.code), b = ctx.body;
    if (b.off) cls.goal = null;
    else {
      const target = Math.round(Number(b.target));
      if (!(target >= 5 && target <= 100000)) throw bad('Цель — от 5 до 100 000 партий');
      const reward = REWARDS[b.reward] ? b.reward : 'text';
      const text = String(b.text || '').replace(/\s+/g, ' ').trim().slice(0, 80);
      if (reward === 'text' && !text) throw bad('Напишите приз: например, «10 минут свободной аркады»');
      const old = cls.goal, keep = old && !b.reset;
      cls.goal = { target, reward, text, count: keep ? old.count || 0 : 0, since: keep ? old.since : store.now(), reached: null };
      if (cls.goal.count >= target) cls.goal.reached = keep && old.reached ? old.reached : store.now();
    }
    store.saveClass(cls);
    broadcast(cls.code, 'goal', goalView(cls) || { off: true });
    return { goal: goalView(cls) };
  });
  // партия в игре одноклассника (из /api/score): своя игра и игра своей команды цель не двигают
  function countPlay(code, nick, g) {
    if (!g || failMembers(g).includes(nick)) return;
    const cls = store.getClass(code);
    if (!cls || !cls.goal) return;
    const goal = cls.goal, was = !!goal.reached;
    goal.count = (goal.count || 0) + 1;
    if (!was && goal.count >= goal.target) goal.reached = store.now();
    store.saveClass(cls);
    broadcast(code, 'goal', Object.assign(goalView(cls), { justReached: !was && !!goal.reached }));
  }

  /* ================= живые реакции (Д3) ================= */
  const lives = new Map(); // код класса → что сейчас в рамке на проекторе: { src, game, version, label, since }
  const rate = new Map(); // ник → отметки времени реакций за последние 10 секунд
  const classRate = new Map(); // код класса → { sec, n }
  // проектор подтверждает игру в рамке каждые 15 секунд: закрыли проектор — через 40 секунд реакции выключаются сами
  const liveOf = code => { const l = lives.get(code); if (l && Date.now() - l.seen > 40000) { lives.delete(code); return null; } return l || null; };
  const liveView = code => { const l = liveOf(code); return l ? { on: true, label: l.label, game: l.game, since: l.since } : { on: false }; };
  route('POST', '/api/teacher/live', (ctx) => {
    needTeacher(ctx);
    const cls = classOf(ctx.body.code), src = String(ctx.body.src || '').slice(0, 300);
    const m = /^\/play\/([\w-]{6,20})\/(\d+)/.exec(src), prev = liveOf(cls.code);
    if (!src) lives.delete(cls.code);
    else if (prev && prev.src === src) prev.seen = Date.now();
    else {
      const g = m && store.getGame(m[1]);
      lives.set(cls.code, { src, game: m ? m[1] : null, version: m ? Number(m[2]) : null, label: g ? g.title || 'Игра' : 'Игра урока', since: store.now(), seen: Date.now() });
    }
    const now = liveView(cls.code);
    if ((prev ? prev.src : '') !== (src || '')) broadcast(cls.code, 'live', now);
    return { live: now };
  });
  route('POST', '/api/react', (ctx) => {
    const { w, cls } = needStudent(ctx);
    const emoji = String(ctx.body.emoji || '');
    if (!REACTIONS.includes(emoji)) throw bad('Нет такой реакции');
    if (!liveOf(cls.code)) throw bad('Сейчас на проекторе нет игры', 409);
    const now = Date.now(), key = cls.code + ':' + w.nick, mine = (rate.get(key) || []).filter(x => now - x < 10000);
    if ((mine.length && now - mine[mine.length - 1] < 700) || mine.length >= 12) throw bad('Не так часто: реакция раз в секунду', 429);
    const sec = Math.floor(now / 1000), c = classRate.get(cls.code);
    if (c && c.sec === sec && c.n >= 20) throw bad('Экран и так весь в реакциях', 429); // весь класс — не больше 20 в секунду
    classRate.set(cls.code, c && c.sec === sec ? { sec, n: c.n + 1 } : { sec, n: 1 });
    mine.push(now); rate.set(key, mine);
    broadcast(cls.code, 'react', { emoji, id: crypto.randomBytes(4).toString('hex') }); // без ника: на проекторе реакции анонимные
    return { ok: true };
  });
  // проектор пачкой пишет реакции в телеметрию игры: секунда партии в рамке и эмодзи — у автора «где смеялись»
  route('POST', '/api/teacher/react/log', (ctx) => {
    needTeacher(ctx);
    const cls = classOf(ctx.body.code), g = store.getGame(String(ctx.body.game || ''));
    if (!g || g.class !== cls.code) return { ok: false };
    const items = (Array.isArray(ctx.body.items) ? ctx.body.items : []).slice(0, 200).filter(x => x && REACTIONS.includes(x.emoji))
      .map(x => ({ sec: Math.max(0, Math.min(3600, Math.round(Number(x.sec) || 0))), emoji: x.emoji }));
    if (items.length) store.addPlay(g.id, { type: 'react', version: Number(ctx.body.version) || g.current, items });
    return { ok: true, n: items.length };
  });

  /* ================= галерея провалов (Д5) ================= */
  const failKey = f => f.game + ':' + f.lesson;
  function failList(cls, viewer) {
    const votes = cls.failVotes || {}, tally = {};
    Object.values(votes).forEach(k => { tally[k] = (tally[k] || 0) + 1; });
    return (cls.fails || []).filter(f => !f.hidden || (viewer && viewer !== 'teacher' && f.nick === viewer)).map(f => {
      const les = lesson(f.lesson), g = store.getGame(f.game);
      return { key: failKey(f), game: f.game, version: f.version, title: f.title, nick: f.nick, lesson: les ? les.number : null, lessonTitle: les ? les.title : '',
        note: f.note || '', why: f.why || [], moral: f.moral || '', at: f.at, votes: tally[failKey(f)] || 0, hidden: !!f.hidden,
        mine: viewer && viewer !== 'teacher' ? votes[viewer] === failKey(f) : false, own: viewer && viewer !== 'teacher' && g ? failMembers(g).includes(viewer) : false };
    }).sort((a, b) => b.votes - a.votes || String(b.at).localeCompare(String(a.at)));
  }
  route('GET', '/api/fails', (ctx) => { const { w, cls } = needStudent(ctx); return { fails: failList(cls, w.nick) }; });
  route('GET', '/api/teacher/fails', (ctx) => { needTeacher(ctx); return { fails: failList(classOf(ctx.url.searchParams.get('code')), 'teacher') }; });
  route('POST', '/api/fails/vote', (ctx) => {
    const { w, cls } = needStudent(ctx);
    const f = (cls.fails || []).find(x => failKey(x) === ctx.body.key && !x.hidden), g = f && store.getGame(f.game);
    if (!f) throw bad('Нет такого провала', 404);
    if (g && failMembers(g).includes(w.nick)) throw bad('За свой провал голосовать нельзя');
    cls.failVotes = cls.failVotes || {};
    if (cls.failVotes[w.nick] === ctx.body.key) delete cls.failVotes[w.nick]; else cls.failVotes[w.nick] = ctx.body.key;
    store.saveClass(cls);
    broadcast(cls.code, 'fails', { key: ctx.body.key });
    return { fails: failList(cls, w.nick) };
  });
  route('POST', '/api/fails/hide', (ctx) => {
    const { w, cls } = needStudent(ctx);
    const f = (cls.fails || []).find(x => failKey(x) === ctx.body.key), g = f && store.getGame(f.game);
    if (!f || !g || !failMembers(g).includes(w.nick)) throw bad('Убрать из галереи может только автор', 403);
    f.hidden = !!ctx.body.hidden;
    store.saveClass(cls);
    broadcast(cls.code, 'fails', { key: ctx.body.key });
    return { fails: failList(cls, w.nick) };
  });

  return {
    REACTIONS,
    theaterFor: (cls, nick) => theaterView(cls, nick),
    goal: goalView, countPlay,
    live: liveView,
  };
};
