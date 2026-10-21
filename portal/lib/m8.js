// Модуль 8 «Своя игра: от питча до Фестиваля» (уроки 29–36): итоговый проект ученика или команды из 2–3 человек.
//   Команды проекта — те же механизмы, что у джема (lib/m7.js), своя группа teamGroup: 'proekt': команда и её игра живут через все восемь уроков.
//   Перенос ответов (поле carry сценария): диздок урока 29 (Фабрика, решения, портрет игрока) появляется в уроке 30, где по нему собирают серый прототип.
//   Питчи (урок 29): питч-карта команды, сцена питча на проекторе с таймером 60 секунд, «❤ хочу сыграть» (у каждого три сердца), утверждение диздока учителем.
//   Дорога к Фестивалю: вехи команды по урокам (поле milestone сценария — шаг, который закрывает этап), на проекторе фишки команд едут по дороге.
//   Фестиваль (урок 36): стенд игры на компьютере автора считает партии гостей, «ещё раз» и реакции; учитель ведёт программу и считает жетоны;
//   номинации «Выбор зрителей» и «Ещё раз!» считаются сами.
// Подключается из server.js: require('./lib/m8')({ route, needStudent, needDayClass, broadcast, store, saveStudentField, lessons, M7 }).
'use strict';

const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });
const str = (v, n = 200) => String(v == null ? '' : v).trim().replace(/\s+/g, ' ').slice(0, n);
const HEARTS = 3; // «хочу сыграть»: сердец у каждого ученика
const PITCH_SEC = 60;
const LIKES = ['wow', 'ok', 'meh'];
const PHASES = [
  { id: 'trailer', label: 'Трейлер-нарезка всех игр', min: 2 },
  { id: 'arcade', label: 'Аркадный час: гости играют', min: 50 },
  { id: 'turnir', label: 'Турнир и Арена класса с гостями', min: 20 },
  { id: 'pitch', label: 'Питчи финалистов на сцене', min: 15 },
  { id: 'awards', label: 'Награждение', min: 10 },
];

module.exports = function m8({ route, needStudent, needDayClass, broadcast, store, saveStudentField, lessons, M7 }) {
  const P = cls => {
    if (!cls.proekt) cls.proekt = {};
    const p = cls.proekt;
    p.pitches = p.pitches || {}; p.approved = p.approved || {}; p.docs = p.docs || {};
    p.fest = p.fest || { open: false, phase: null, phaseAt: 0, games: {}, tokens: {}, awards: false };
    return p;
  };
  // ключ проекта: команда (по группе открытого урока) или сам ученик, если он ещё не в команде
  const keyOf = (cls, nick) => { const t = M7.teamOf(cls.code, nick); return t ? 't:' + t.id : 'n:' + nick; };
  const teamOfKey = (cls, key) => { if (!key.startsWith('t:')) return null; const t = M7.teamOf(cls.code, null, key.slice(2)); return t; };
  const membersOf = (cls, key) => { const t = teamOfKey(cls, key); return t ? t.members.slice() : [key.slice(2)]; };
  const changed = (code, what) => broadcast(code, 'proekt', { what });
  const modLessons = () => lessons().filter(l => l.teamGroup === 'proekt').sort((a, b) => a.number - b.number);

  /* ---------- перенос ответов из прошлых уроков (carry) ---------- */
  // carry: { шаг этого урока: ['урок-источник' или 'урок:шаг', …] } — первый найденный ответ копируется, если своего ещё нет
  function carry(s, les, st) {
    if (!les.carry) return false;
    let moved = false;
    for (const [id, from] of Object.entries(les.carry)) {
      if (st.answers[id] && st.answers[id].value != null) continue;
      for (const src of from) {
        const [lid, sid] = src.includes(':') ? src.split(':') : [src, id];
        const a = ((s.lessons || {})[lid] || {}).answers && s.lessons[lid].answers[sid];
        if (a && a.value != null) { st.answers[id] = Object.assign({}, JSON.parse(JSON.stringify(a)), { carried: lid }); moved = true; break; }
      }
    }
    return moved;
  }

  /* ---------- вехи команды: дорога к Фестивалю ---------- */
  function roadOf(cls) {
    const L = modLessons(), studs = new Map(store.students(cls.code).map(s => [s.nick, s]));
    const done = (nick, les) => { const s = studs.get(nick); const a = s && s.lessons && s.lessons[les.id] && s.lessons[les.id].answers[les.milestone]; return !!(a && a.done); };
    const p = P(cls), seen = new Set(), rows = [];
    const teams = (cls.teamsBy && cls.teamsBy.proekt ? cls.teamsBy.proekt.list : []).filter(t => t.members.length);
    for (const t of teams) { t.members.forEach(n => seen.add(n)); rows.push({ key: 't:' + t.id, name: t.name, emblem: t.emblem || '', members: t.members, gameId: t.gameId || null }); }
    for (const s of studs.values()) if (!seen.has(s.nick) && L.some(l => s.lessons && s.lessons[l.id])) rows.push({ key: 'n:' + s.nick, name: s.nick, emblem: s.emblem || '', members: [s.nick], gameId: null });
    return rows.map(r => {
      const steps = L.filter(l => l.milestone).map(l => ({ lesson: l.number, label: l.road || l.title, done: r.members.some(n => done(n, l)) }));
      const g = r.gameId ? store.getGame(r.gameId) : null;
      const pitch = p.pitches[r.key] || r.members.map(n => p.pitches['n:' + n]).find(Boolean); // питч мог уйти на стену до команды
      return Object.assign(r, { steps, at: steps.filter(x => x.done).length, pitch: !!pitch, approved: !!p.approved[r.key], title: g ? g.title : ((pitch || {}).title || ''), versions: g ? g.versions.length : 0, release: !!(g && g.release) });
    });
  }

  /* ---------- питчи ---------- */
  function pitchPublic(cls, viewer) {
    const p = P(cls), list = Object.values(p.pitches).sort((a, b) => a.at - b.at);
    const mine = viewer ? keyOf(cls, viewer) : null;
    const given = viewer ? list.filter(x => x.hearts.includes(viewer)).length : 0;
    return {
      me: mine, heartsLeft: HEARTS - given, sec: PITCH_SEC,
      pitches: list.map(x => Object.assign({}, x, { hearts: x.hearts.length, mineHeart: !!viewer && x.hearts.includes(viewer), mine: x.key === mine || x.key === 'n:' + viewer, approved: !!p.approved[x.key], members: membersOf(cls, x.key) })),
      stage: p.stage && p.pitches[p.stage.key] ? Object.assign({}, p.stage, { left: Math.max(0, PITCH_SEC - (Date.now() - p.stage.at) / 1000) }) : null,
      approved: mine ? p.approved[mine] || null : null,
      doc: mine ? p.docs[mine] || null : null,
      now: Date.now(),
    };
  }
  route('GET', '/api/proekt', (ctx) => {
    const w = ctx.who;
    if (w && w.role === 'student') { const cls = store.getClass(w.class); return pitchPublic(cls, w.nick); }
    const { cls } = needDayClass(ctx);
    return Object.assign(pitchPublic(cls), { road: roadOf(cls), docs: P(cls).docs, fest: festPublic(cls) });
  });
  route('POST', '/api/proekt/pitch', (ctx) => {
    const { w, cls } = needStudent(ctx), p = P(cls), key = keyOf(cls, w.nick), c = ctx.body.card || {};
    const card = { key, by: w.nick, title: str(c.title, 60), phrase: str(c.phrase, 200), donor: str(c.donor, 120), twist: str(c.twist, 200), world: str(c.world, 120), feeling: str(c.feeling, 80), who: str(c.who, 120) };
    if (card.title.length < 2) throw bad('Назови игру: название на питч-карте');
    if (card.phrase.length < 8) throw bad('Одна фраза об игре — хотя бы несколько слов');
    const t = teamOfKey(cls, key);
    card.team = t ? t.name : null; card.emblem = t ? t.emblem || '' : '';
    const solo = p.pitches['n:' + w.nick];
    if (key !== 'n:' + w.nick && solo) { delete p.pitches['n:' + w.nick]; if (!p.pitches[key]) p.pitches[key] = { hearts: solo.hearts, at: solo.at }; } // питч до команды стал питчем команды, сердца с ним
    p.pitches[key] = Object.assign({ hearts: [], at: Date.now() }, p.pitches[key], card, { updated: Date.now() });
    store.saveClass(cls); changed(cls.code, 'pitch');
    return pitchPublic(cls, w.nick);
  });
  route('POST', '/api/proekt/heart', (ctx) => {
    const { w, cls } = needStudent(ctx), p = P(cls), x = p.pitches[String(ctx.body.key || '')];
    if (!x) throw bad('Нет такого питча', 404);
    if (x.key === keyOf(cls, w.nick) || x.key === 'n:' + w.nick) throw bad('За свою игру сердце не ставят');
    if (x.hearts.includes(w.nick)) x.hearts = x.hearts.filter(n => n !== w.nick);
    else {
      const given = Object.values(p.pitches).filter(y => y.hearts.includes(w.nick)).length;
      if (given >= HEARTS) throw bad(`Сердец всего ${HEARTS}: сними одно, чтобы поставить сюда`);
      x.hearts.push(w.nick);
    }
    store.saveClass(cls); changed(cls.code, 'heart');
    return pitchPublic(cls, w.nick);
  });
  // диздок на утверждение: короткий текст страницы диздока (собирает шаг dizdok из ответов команды)
  route('POST', '/api/proekt/doc', (ctx) => {
    const { w, cls } = needStudent(ctx), p = P(cls), key = keyOf(cls, w.nick);
    const doc = ctx.body.doc || {};
    p.docs[key] = { by: w.nick, at: Date.now(), title: str(doc.title, 60), lines: (Array.isArray(doc.lines) ? doc.lines : []).slice(0, 16).map(l => ({ k: str(l.k, 40), v: str(l.v, 300) })) };
    if (p.approved[key] && ctx.body.changed) delete p.approved[key]; // диздок поменяли после печати — утвердить заново
    store.saveClass(cls); changed(cls.code, 'doc');
    return pitchPublic(cls, w.nick);
  });
  // колода доноров: выбранный донор (и второй — для скрещивания) уходит в Фабрику ученика и всей команды
  route('POST', '/api/proekt/donor', (ctx) => {
    const { w, cls, les } = needStudent(ctx);
    const fac = les.plan && les.plan.factory, step = fac && les.checkpoints.flatMap(c => c.steps).find(s => s.id === fac);
    if (!step || !step.donors) throw bad('В этом уроке нет Фабрики с колодой доноров');
    const a = step.donors.find(d => d.id === ctx.body.donor), b = ctx.body.cross ? step.donors.find(d => d.id === ctx.body.cross) : null;
    if (!a) throw bad('Нет такого донора');
    if (b && b.id === a.id) throw bad('Скрещивают двух разных доноров');
    const t = M7.teamOf(cls.code, w.nick), who = t ? t.members : [w.nick];
    for (const nick of who) saveStudentField(cls.code, nick, les.id, st => {
      const x = st.answers[fac] = Object.assign({ value: {}, done: false }, st.answers[fac]);
      const fields = Object.assign({}, (x.value || {}).fields);
      if (b) fields.cross = { text: `${b.title}: ${b.text} ${b.rules || ''}`.trim(), card: true }; else delete fields.cross;
      x.value = Object.assign({}, x.value, { donor: a.id, fields }, b ? { level: 'adv' } : {}); x.at = new Date().toISOString(); // скрещённые доноры — уровень «Продвинутый»
    });
    if (t) broadcast(cls.code, 'team', { team: t.id, step: fac, from: w.nick });
    return { donor: a.id, cross: b ? b.id : null };
  });
  // учитель: stage — питч на сцену (60 секунд на проекторе), unstage, approve / unapprove — диздок команды
  route('POST', '/api/teacher/proekt', (ctx) => {
    const { cls } = needDayClass(ctx), p = P(cls), act = ctx.body.action, key = String(ctx.body.key || '');
    if (act === 'stage') { if (!p.pitches[key]) throw bad('Нет такого питча'); p.stage = { key, at: Date.now() + 1500 }; }
    else if (act === 'unstage') p.stage = null;
    else if (act === 'approve') p.approved[key] = { at: Date.now() };
    else if (act === 'unapprove') delete p.approved[key];
    else if (act === 'fest') { p.fest.open = !!ctx.body.open; if (p.fest.open && !p.fest.openedAt) p.fest.openedAt = Date.now(); }
    else if (act === 'phase') { const ph = PHASES.find(x => x.id === ctx.body.phase); p.fest.phase = ph ? ph.id : null; p.fest.phaseAt = Date.now(); if (ph && ph.id === 'awards') p.fest.awards = true; }
    else if (act === 'token') { const g = String(ctx.body.game || ''); if (!store.getGame(g)) throw bad('Нет такой игры'); p.fest.tokens[g] = Math.max(0, (p.fest.tokens[g] || 0) + Math.round(Number(ctx.body.delta) || 0)); }
    else if (act === 'reset-fest') p.fest = { open: false, phase: null, phaseAt: 0, games: {}, tokens: {}, awards: false };
    else throw bad('Нет такого действия');
    store.saveClass(cls); changed(cls.code, act);
    return Object.assign(pitchPublic(cls), { road: roadOf(cls), docs: p.docs, fest: festPublic(cls) });
  });

  /* ---------- Фестиваль ---------- */
  function festPublic(cls) {
    const p = P(cls), F = p.fest;
    const teams = cls.teamsBy && cls.teamsBy.proekt ? cls.teamsBy.proekt.list : [];
    const ids = new Set([...teams.map(t => t.gameId).filter(Boolean), ...Object.keys(F.games)]);
    const stands = [...ids].map(id => {
      const g = store.getGame(id); if (!g) return null;
      const t = teams.find(x => x.gameId === id), s = F.games[id] || {};
      const sc = Object.entries(store.scores(cls.code + ':game:' + id)).map(([nick, v]) => ({ nick, score: v.score })).sort((a, b) => b.score - a.score);
      return {
        game: id, title: g.title || 'Игра', authors: t ? t.members : [g.nick], team: t ? t.name : null, donor: g.donor || '', release: !!g.release, version: g.current,
        guests: s.guests || 0, plays: s.plays || 0, again: s.again || 0, likes: Object.fromEntries(LIKES.map(k => [k, (s.likes || {})[k] || 0])), tokens: F.tokens[id] || 0,
        record: sc[0] || null, top: sc.slice(0, 5), last: s.last || 0,
      };
    }).filter(Boolean);
    const lead = (fn, min = 1) => { const best = stands.slice().sort((a, b) => fn(b) - fn(a))[0]; return best && fn(best) >= min ? { game: best.game, title: best.title, authors: best.authors, value: fn(best) } : null; };
    return {
      open: F.open, phase: F.phase, phaseAt: F.phaseAt, phases: PHASES, awards: F.awards, now: Date.now(), stands,
      totals: { guests: stands.reduce((a, s) => a + s.guests, 0), plays: stands.reduce((a, s) => a + s.plays, 0), again: stands.reduce((a, s) => a + s.again, 0) },
      nominations: [
        { id: 'zriteli', label: 'Выбор зрителей', how: 'жетоны гостей и 🤩', win: lead(s => s.tokens * 2 + s.likes.wow) },
        { id: 'eshche', label: 'Ещё раз!', how: 'больше всего повторных партий', win: lead(s => s.again) },
        { id: 'gosti', label: 'Самый живой стенд', how: 'больше всего гостей', win: lead(s => s.guests) },
      ],
    };
  }
  route('GET', '/api/fest', (ctx) => {
    const w = ctx.who;
    if (w && w.role === 'student') { const cls = store.getClass(w.class); const f = festPublic(cls); const me = needStudent(ctx).st.gameId; return Object.assign(f, { mine: f.stands.find(s => s.game === me) || null }); }
    return festPublic(needDayClass(ctx).cls);
  });
  // стенд на компьютере автора: guest — подошёл новый гость, over — партия гостя, again — гость нажал «ещё раз», like — реакция гостя после партии
  route('POST', '/api/fest/event', (ctx) => {
    const { cls, st } = needStudent(ctx), p = P(cls);
    const id = st.gameId; if (!id || !store.getGame(id)) throw bad('У стенда нет игры: возьми игру проекта в этом уроке');
    const s = p.fest.games[id] = Object.assign({ guests: 0, plays: 0, again: 0, likes: {} }, p.fest.games[id]);
    const k = ctx.body.kind;
    if (k === 'guest') s.guests++;
    else if (k === 'over') s.plays++;
    else if (k === 'again') s.again++;
    else if (k === 'like') { const l = LIKES.includes(ctx.body.like) ? ctx.body.like : null; if (!l) throw bad('Нет такой реакции'); s.likes[l] = (s.likes[l] || 0) + 1; }
    else throw bad('Нет такого события');
    s.last = Date.now();
    store.saveClass(cls); changed(cls.code, 'fest');
    return { stand: festPublic(cls).stands.find(x => x.game === id) };
  });

  return { carry, roadOf, festPublic, PHASES };
};
