// «Шаг в такт» — ремейк-донор урока 7 по мотивам Geometry Dash и ритм-баттлов, оболочка «Лаб3D 1.0» (three.js).
// План.
// Фраза: танцор в черкеске бежит по улице аула на празднике джэгу, кувшины стоят ровно на долях мелодии — прыгай в долю.
// Ядро на 3 секунды: щелчок → доля → прыжок → кувшин звенит нотой мелодии, серия «идеально» поднимает звон по ладу.
// Риск — награда: серия разжигает «Жар» (бас и хлопки в музыке, очки ×2, аул пляшет), промах гасит его и глушит мелодию до конца такта.
// Кривая партии: отсчёт «раз-два-три-четыре» → такт вступления → три круга мелодии, каждый быстрее, круг меняет цвет праздника.
// Сочность: мир живёт в долю (фонари, плита под ногами, зрители, шаги танцора), сальто на «идеально», «рано / поздно» на «хорошо»,
// кувшин звенит и подпрыгивает, на промахе падает и бьётся. Стоп-кадр и замедление не используются: они сбили бы часы музыки.
// Палитра: ночная синь и сирень неба, тёплый песчаник улицы, золотые фонари, пять цветов нот.
// Разбор лучших игр жанра (Geometry Dash, Rhythm Heaven, Crypt of the NecroDancer, Patapon, Guitar Hero, osu!, Hi-Fi Rush, Thumper) —
// в docs/01_Журнал_курса.md, раздел урока 7.
// Спрятанная механика донора — игра и музыка на одних часах: кувшин на доле, звук планируется заранее и звучит точно в долю, щелчок за долю
// до кувшина предупреждает раньше картинки (ручка secret, пресет «Без спрятанной механики» — музыка на своих часах, кувшины сдвинуты, щелчка нет).
// Уровень строится из мелодии: своя мелодия приходит из секвенсора портала в lab.data.melody. Вдвоём — дуэль «повтори за мной».
// Вид сбоку: X — вправо (туда бежит танцор), Y — вверх, дальше от зрителя — меньше Z.
const GAME = {
  engine: 'three',
  title: 'Шаг в такт',
  subtitle: 'Танцор бежит по аулу на джэгу. Прыгай через кувшины ровно в долю — музыка подскажет когда!',
  donor: 'Geometry Dash и ритм-баттлов',
  players: 1,
  duo: 'duel', // ручка duel = 1 — дуэль «повтори за мной»
  controls: [
    { input: 'a', text: 'прыжок в долю' },
  ],
  camera: { type: 'side', tilt: 1.36 },
  field: { w: 22, h: 10 },
  sky: ['#120f3a', '#b2507a'],
  fog: 0.011,
  accent: '#ffd23f',
  decisions: [
    'Чувство: попал в долю — и музыка будто играет от твоего прыжка',
    'Честность: кувшин стоит ровно на доле, щелчок звучит за долю до него',
    'Выбор: прыгать по звуку или по картинке',
  ],
  notes: [
    'Кувшин стоит чуть дальше доли: жмёшь точно в долю — и танцор пролетает над ним в верхней точке прыжка.',
    'Стоп-кадр и замедление в игре не используются: музыка идёт по часам звуковой карты, и пауза картинки сдвинула бы доли.',
    'Нажатие судится по ближнему кувшину в пределах полудоли: жать без остановки не выгодно — ранний прыжок тоже промах.',
  ],
  config: {
    bpm: { value: 112, min: 70, max: 170, step: 2, label: 'Темп, ударов в минуту', restart: true },
    ramp: { value: 8, min: 0, max: 30, step: 2, label: 'Темп быстрее с каждым кругом', restart: true },
    laps: { value: 3, min: 1, max: 6, step: 1, label: 'Кругов мелодии', restart: true },
    perfect: { value: 0.06, min: 0.02, max: 0.15, step: 0.01, label: 'Окно «идеально», с' },
    good: { value: 0.15, min: 0.06, max: 0.3, step: 0.01, label: 'Окно «хорошо», с' },
    cue: { value: 1, min: 0, max: 2, step: 0.5, label: 'Щелчок-подсказка за … долей до кувшина', hint: '0 — без подсказки', restart: true },
    offset: { value: 0, min: -0.15, max: 0.15, step: 0.01, label: 'Поправка на задержку звука, с', hint: 'если «идеально» не выходит, а жмёшь точно' },
    fever: { value: 8, min: 0, max: 20, step: 1, label: 'Жар: серия, после которой музыка разгорается', hint: '0 — без жара; в жару бас, хлопки и очки ×2' },
    drop: { value: 1, min: 0, max: 1, step: 1, label: 'Промах глушит мелодию до конца такта', hint: 'как в Guitar Hero: ошибку слышно' },
    lives: { value: 5, min: 1, max: 9, step: 1, label: 'Жизни', restart: true },
    secret: { value: 1, min: 0, max: 1, step: 1, label: 'Спрятанная механика: игра и музыка на одних часах', hint: '0 — кувшины не на долях, музыка на своих часах, без щелчка', restart: true },
    duel: { value: 0, min: 0, max: 1, step: 1, label: 'Вдвоём: дуэль «повтори за мной»', restart: true },
  },
  presets: {
    'Новичок': { bpm: 92, ramp: 4, perfect: 0.09, good: 0.22, lives: 7, fever: 6 },
    'Без спрятанной механики': { secret: 0 },
    'Дуэль': { duel: 1 },
    'Шторм': { bpm: 150, ramp: 14, perfect: 0.04, good: 0.1 },
    'Тишина после ошибки': { drop: 1, fever: 0 },
  },

  U: 3, // метров на долю: одна плита улицы — одна доля
  AIR: 0.8, // прыжок длится … доли, верхняя точка — на середине
  NOTES: [220, 261.6, 293.7, 329.6, 392], // ля-минорная пентатоника: строки секвенсора снизу вверх
  NOTE_COLORS: ['#ff7a3d', '#ffbd3b', '#c4ea4a', '#3fd8c9', '#c77dff'],
  MELODY: [-1, -1, -1, -1, 0, -1, 2, -1, 3, -1, 3, 2, 4, -1, -1, -1, 0, -1, 2, -1, 3, 2, 3, -1, 4, 3, 2, -1, 0, -1, -1, -1],

  start(lab, scene) {
    const st = lab.state, duel = lab.players === 2;
    Object.assign(st, { evts: [], ei: 0, obs: [], combo: 0, best: 0, hits: { perfect: 0, good: 0, miss: 0 }, devs: [], extra: 0,
      fever: false, fevers: 0, muteTill: -1e9, lap: 0, lastBeat: -99, early: 0, late: 0 });
    st.M = new lab.THREE.Matrix4(); st.Q = new lab.THREE.Quaternion(); st.E = new lab.THREE.Euler(); st.S = new lab.THREE.Vector3(); st.P = new lab.THREE.Vector3(); st.C = new lab.THREE.Color();
    lab.lives = lab.cfg.lives;
    lab.setCamera({ type: 'side', tilt: 1.38, target: [0, 2.4, 0], distance: duel ? 14 : 14.5 });
    if (duel) {
      st.duelBeat = 60 / lab.cfg.bpm;
      this.world(lab, scene, 40);
      st.hero = this.dancer(lab, '#b8323a');
      lab.hero(st.hero.node);
      return this.duelStart(lab);
    }
    this.timeline(lab);
    this.world(lab, scene, st.len);
    st.hero = this.dancer(lab, '#b8323a');
    lab.hero(st.hero.node);
    this.buildJugs(lab);
    st.time = -8 * st.laps[0].beat - 0.4; // отсчёт музыканта перед мелодией: «раз — два — раз, два, три, четыре»
    this.COUNT.forEach((w, i) => { if (w) st.evts.push({ t: (i - 8) * st.laps[0].beat, kind: 'count', hi: i === 0 || i === 4 }); });
    st.evts.sort((a, b) => a.t - b.t);
    st.hero.x = this.xAt(st, st.time); st.hero.node.position.x = st.hero.x; lab.view.target.x = st.hero.x + 3.6;
    lab.hud('acc', 'Слушай отсчёт и щелчок: кувшин будет через долю');
  },

  update(lab, dt) {
    const st = lab.state;
    st.time += dt;
    this.schedule(lab);
    if (st.duel) return this.duelUpdate(lab, dt);
    const c = lab.cfg, h = st.hero, t = st.time + c.offset, L = this.lapAt(st, st.time);
    h.x = this.xAt(st, st.time);
    if (lab.p1.pressed.a) this.press(lab, t);
    for (const o of st.obs) if (!o.done && t > o.t + c.good) this.judge(lab, o, 'miss', 0);
    this.countIn(lab);
    this.lapChange(lab, L);
    this.animate(lab, h, dt, this.beatsAt(st, st.time));
    this.animateJugs(lab, dt);
    this.pulseBeat(lab, dt, L);
    lab.view.target.x = lab.damp(lab.view.target.x, h.x + 3.6, 7, dt);
    lab.view.target.y = 2.4;
    if (st.time > st.end + 1) lab.win(`${this.grade(st)[1]}: идеально ${st.hits.perfect}, хорошо ${st.hits.good}, мимо ${st.hits.miss}`);
    const prog = Math.max(0, Math.min(100, Math.round(100 * st.time / st.end)));
    lab.hud('lap', `Круг ${st.lap + 1} из ${st.laps.length} · ${Math.round(60 / L.beat)} ударов в минуту · ${prog}%`);
    lab.hud('acc', `идеально ${st.hits.perfect} · хорошо ${st.hits.good} · мимо ${st.hits.miss} · серия ${st.combo}` + (st.fever ? ' · 🔥 ЖАР ×2' : ''));
  },

  overNote(lab) {
    const st = lab.state, d = st.devs, avg = d.length ? d.reduce((a, b) => a + b, 0) / d.length : 0;
    if (st.duel) return [`Дуэль: ${st.pts[0]} : ${st.pts[1]}`, 'Кто точнее повторил чужой ритм, тот и сильнее слышит долю'];
    const [g, name] = this.grade(st);
    return [`Оценка ${g} — ${name}. Идеально ${st.hits.perfect}, хорошо ${st.hits.good}, мимо ${st.hits.miss}, лучшая серия ${st.best}`,
      d.length ? `В среднем ты жмёшь ${Math.abs(avg) < 0.01 ? 'ровно в долю' : (avg < 0 ? 'раньше' : 'позже') + ' на ' + Math.round(Math.abs(avg) * 1000) + ' мс'} (рано ${st.early}, поздно ${st.late})` : 'Ни одного попадания в окно — попробуй слушать щелчок',
      lab.cfg.fever ? `Жар разгорался ${st.fevers} раз · лишних прыжков без кувшина: ${st.extra}` : `Лишних прыжков без кувшина: ${st.extra}`];
  },
  // оценка как в ритм-играх: точность = идеально + половина «хорошо»
  grade(st) {
    const n = st.hits.perfect + st.hits.good + st.hits.miss, acc = n ? (st.hits.perfect + st.hits.good * 0.5) / n : 0;
    return acc >= 0.95 ? ['S', 'мастер джэгу'] : acc >= 0.85 ? ['A', 'лучший танцор аула'] : acc >= 0.7 ? ['B', 'держишь ритм'] : acc >= 0.5 ? ['C', 'ритм просыпается'] : ['D', 'слушай щелчок'];
  },

  /* ---------- часы: доли, ноты, кувшины ---------- */
  // круги мелодии подряд, темп растёт; x(t) — путь танцора: ровно U метров за долю
  timeline(lab) {
    const st = lab.state, c = lab.cfg, own = lab.data && lab.data.melody,
      mel = Array.isArray(own) && own.some(n => n >= 0) ? own.slice(0, 64).map(n => (Number.isInteger(n) && n >= 0 && n < 5 ? n : -1)) : this.MELODY;
    st.laps = [];
    let T = 0, X = 0;
    for (let L = 0; L < c.laps; L++) {
      const beat = 60 / (c.bpm + c.ramp * L);
      st.laps.push({ T, X, beat, n: mel.length });
      mel.forEach((n, i) => {
        const tb = T + i * beat, drift = c.secret ? 1 : 1.035; // без спрятанной механики музыка идёт на своих часах
        st.evts.push({ t: tb * drift, tb, kind: i % 4 ? 'kick' : 'bar' }, { t: (tb + beat / 2) * drift, tb, kind: 'hat' });
        if (i % 4 === 0 || i % 4 === 2) st.evts.push({ t: tb * drift, tb, kind: 'bass', n: i % 8 < 4 ? 0 : 3 });
        if (i % 2 === 1) st.evts.push({ t: tb * drift, tb, kind: 'clap' });
        if (n < 0) return;
        st.evts.push({ t: tb * drift, tb, kind: 'note', n });
        if (L === 0 && i < 4) return; // первый такт — вступление
        const to = c.secret ? tb : tb + lab.rand(-0.4, 0.4) * beat; // без спрятанной механики кувшин не на доле
        st.obs.push({ t: to, n, done: false });
        if (c.secret && c.cue > 0) st.evts.push({ t: to - c.cue * beat, kind: 'cue' });
      });
      T += mel.length * beat; X += mel.length * this.U;
    }
    st.end = T; st.len = X;
    st.evts.sort((a, b) => a.t - b.t);
    st.obs.forEach(o => { o.x = this.xAt(st, o.t) + this.U * this.AIR / 2; }); // верхняя точка прыжка в долю — над кувшином
  },
  lapAt(st, t) {
    let L = st.laps[0];
    for (const l of st.laps) if (t >= l.T) L = l;
    return L;
  },
  xAt(st, t) { const L = this.lapAt(st, t); return L.X + (t - L.T) / L.beat * this.U; },
  beatsAt(st, t) { const L = this.lapAt(st, t); return L.X / this.U + (t - L.T) / L.beat; }, // сколько долей пройдено с начала
  // звук планируется заранее по часам игры: lab.tone(…, задержка) звучит точно в долю
  schedule(lab) {
    const st = lab.state, N = this.NOTES;
    while (st.ei < st.evts.length && st.evts[st.ei].t < st.time + 0.1) {
      const e = st.evts[st.ei++], d = Math.max(0, e.t - st.time);
      if (e.t < st.time - 0.05) continue;
      if (e.kind === 'kick' || e.kind === 'bar') { lab.tone(e.kind === 'bar' ? 150 : 130, 0.16, 'sine', 0.34, 42, d); lab.noise(0.02, 0.07, 3200, d); }
      if (e.kind === 'hat') lab.noise(0.03, 0.035, 9000, d);
      if (e.kind === 'note' && !(lab.cfg.drop && e.tb < st.muteTill)) { // пшине — адыгская гармоника: треугольник и два расстроенных язычка
        const f = N[e.n] * 2;
        lab.tone(f, 0.24, 'triangle', 0.1, 0, d); lab.tone(f * 0.998, 0.26, 'sawtooth', 0.022, 0, d); lab.tone(f * 1.004, 0.26, 'sawtooth', 0.022, 0, d); lab.tone(N[e.n], 0.3, 'sine', 0.05, 0, d);
      }
      if (e.kind === 'bass' && st.fever) { lab.tone(N[e.n] / 2, 0.32, 'triangle', 0.16, 0, d); lab.tone(N[e.n] / 4, 0.3, 'sine', 0.14, 0, d); }
      if (e.kind === 'clap' && st.fever) { lab.noise(0.07, 0.12, 2200, d); lab.noise(0.05, 0.08, 1600, d + 0.012); }
      if (e.kind === 'cue') { lab.tone(1760, 0.03, 'square', 0.05, 0, d); if (lab.cfg.secret) lab.count('_secret'); }
      if (e.kind === 'count') lab.tone(e.hi ? 1320 : 990, 0.06, 'square', 0.06, 0, d);
      if (e.kind === 'beat') lab.tone(e.hi ? 1320 : 880, 0.05, 'square', 0.06, 0, d);
    }
  },
  // отсчёт перед мелодией в долю, как у музыкантов: два медленных счёта и четыре быстрых
  COUNT: ['Раз', '', 'Два', '', 'Раз', 'Два', 'Три', 'Четыре!'],
  countIn(lab) {
    const st = lab.state, b = st.laps[0].beat;
    if (st.time >= 0) return;
    const k = Math.floor((st.time + 8 * b) / b);
    if (k >= 0 && k < 8 && k !== st.countK) {
      st.countK = k;
      if (!this.COUNT[k]) return;
      lab.popup([st.hero.x + 3, 4.2, 0], this.COUNT[k], k === 7 ? '#ffd23f' : '#ffffff', k === 7 ? 30 : 24);
      lab.pulse(st.hero.rig, 1.12, 0.12);
    }
  },
  // новый круг: темп выше, праздник меняет цвет
  lapChange(lab, L) {
    const st = lab.state, i = st.laps.indexOf(L);
    if (i === st.lap) return;
    st.lap = i;
    const col = ['#ffd23f', '#ff6fb0', '#59e0ff', '#a8ff6a', '#ff9a3c', '#c77dff'][i % 6];
    lab.popup([st.hero.x + 3, 4.6, 0], `Круг ${i + 1} · быстрее!`, col, 30);
    lab.flash(col, 0.18);
    lab.ring([st.hero.x, 0.05, 0], { color: col, radius: 6 });
    this.NOTES.forEach((f, k) => lab.tone(f * 2, 0.16, 'triangle', 0.08, 0, k * 0.06));
    st.lampCol = col;
    lab.light.hemi.color.set(col).lerp(lab.color('#8f9cff'), 0.6);
  },
  press(lab, t) {
    const st = lab.state, c = lab.cfg, L = this.lapAt(st, t), win = Math.max(c.good * 1.4, L.beat * 0.5);
    const o = st.obs.filter(x => !x.done && Math.abs(x.t - t) <= win).sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t))[0];
    this.jump(lab, st.hero, L.beat);
    lab.count('прыжки');
    if (!o) { st.extra++; lab.count('лишние нажатия'); return; }
    const dev = t - o.t;
    if (Math.abs(dev) > c.good) return this.judge(lab, o, 'miss', dev); // ранний или поздний прыжок — тоже промах: мять кнопку не выгодно
    this.judge(lab, o, Math.abs(dev) <= c.perfect ? 'perfect' : 'good', dev);
  },
  judge(lab, o, kind, dev) {
    const st = lab.state, at = [o.x, 1.6, 0];
    o.done = true; o.kind = kind; o.t0 = lab.t; st.hits[kind]++;
    if (kind === 'miss') {
      st.combo = 0; lab.count('мимо');
      if (st.fever) { st.fever = false; lab.popup([o.x, 4.4, 0], 'Жар погас', '#9aa6ff', 20); if (st.trail) { st.trail.dispose(); st.trail = null; } }
      const L = this.lapAt(st, o.t), bar = 4 * L.beat;
      st.muteTill = L.T + (Math.floor((st.time - L.T) / bar) + 1) * bar; // мелодия молчит до конца такта: ошибку слышно
      lab.tone(98, 0.25, 'sawtooth', 0.12, 70); lab.tone(104, 0.22, 'sawtooth', 0.06, 74); // фальшивая нота
      lab.popup(at, dev < 0 ? 'Рано!' : dev > 0 ? 'Поздно!' : 'Мимо', '#ff6b6b', 20);
      lab.burst([o.x, 0.6, 0], { count: 16, colors: ['#8a4a2a', '#c96a3a', '#e8c49a'], speed: 5, up: 3, gravity: 14 });
      st.hero.trip = 1;
      if (o.t < st.laps[0].T + 8 * st.laps[0].beat) { if (!st.warm) lab.popup([st.hero.x + 2, 3.6, 0], 'Разминка: жизнь цела', '#ffffff', 20); st.warm = true; return; } // первый такт с кувшинами жизни не отнимает
      lab.hurt([st.hero.x, 1.2, 0], 'Сбился с ритма');
      return;
    }
    if (dev < 0) st.early++; else st.late++;
    st.devs.push(dev); st.combo++; st.best = Math.max(st.best, st.combo);
    lab.count(kind === 'perfect' ? 'идеально' : 'хорошо');
    // нота в тон мелодии: серия поднимает звон по ладу пентатоники, а не по полутонам
    const step = lab.juicy('pitch') ? o.n + Math.min(st.combo - 1, 9) : o.n, f = this.NOTES[step % 5] * 4 * Math.pow(2, Math.floor(step / 5));
    lab.tone(f, 0.14, 'triangle', 0.08); lab.tone(f * 1.5, 0.1, 'sine', 0.03, 0, 0.02);
    const col = this.NOTE_COLORS[o.n % 5];
    lab.burst(at, { count: kind === 'perfect' ? 26 : 12, colors: kind === 'perfect' ? [col, '#ffffff', '#ffd23f'] : [col, '#ffffff'], speed: kind === 'perfect' ? 7 : 5, up: 2.5 });
    lab.ring([o.x, 0.05, 0], { color: col, radius: kind === 'perfect' ? 2.6 : 1.6 });
    const mult = st.fever ? 2 : 1;
    lab.addScore((kind === 'perfect' ? 100 + 10 * Math.min(st.combo, 30) : 50) * mult, null);
    const side = dev < 0 ? ' · рано' : ' · поздно';
    lab.popup(at, kind === 'perfect' ? `Идеально! ×${st.combo}` : 'Хорошо' + side, kind === 'perfect' ? '#ffd23f' : '#7cf5a8', kind === 'perfect' ? 24 : 18);
    if (kind === 'perfect') { lab.shake(0.1); st.hero.flip = 1; }
    if (st.combo % 10 === 0) { lab.popup([o.x, 4.6, 0], `Серия ${st.combo}!`, '#ffffff', 28); lab.vibrate(60, 0.3); }
    if (lab.cfg.fever && !st.fever && st.combo >= lab.cfg.fever) this.feverOn(lab, o);
  },
  // «Жар» по мотивам Patapon: серия разжигает музыку — бас, хлопки, аул пляшет, очки ×2
  feverOn(lab, o) {
    const st = lab.state;
    st.fever = true; st.fevers++; lab.count('жар');
    lab.popup([o.x, 4.8, 0], '🔥 ЖАР! Очки ×2', '#ff9a3c', 32);
    lab.flash('#ff9a3c', 0.25); lab.shake(0.25);
    lab.ring([st.hero.x, 0.05, 0], { color: '#ff9a3c', radius: 8 });
    [0, 2, 4, 2, 4].forEach((n, k) => lab.tone(this.NOTES[n] * 4, 0.14, 'triangle', 0.07, 0, k * 0.05));
    if (st.trail) st.trail.dispose();
    st.trail = lab.trail(st.hero.belt, { color: '#ff9a3c', width: 0.5, length: 18 });
  },

  /* ---------- танцор в черкеске и папахе ---------- */
  dancer(lab, coat) {
    const node = lab.group(), turn = lab.group({ parent: node, rot: Math.PI / 2, scale: 1.15 }), rig = lab.group({ parent: turn });
    lab.cyl(0.28, 0.46, 1.25, coat, { parent: rig, at: [0, 1.17, 0], sides: 8 });
    const belt = lab.cyl(0.31, 0.31, 0.1, '#ffd23f', { parent: rig, at: [0, 1.28, 0], glow: 0.5, sides: 8 });
    lab.box(0.06, 0.3, 0.05, '#c9ccd6', { parent: rig, at: [0.1, 1.12, 0.3], shiny: true, rot: [0, 0, 0.3] }); // кинжал
    for (const s of [-1, 1]) lab.box(0.16, 0.3, 0.05, '#ece7da', { parent: rig, at: [s * 0.12, 1.56, 0.25] }); // газыри
    lab.ball(0.25, '#f2c9a0', { parent: rig, at: [0, 2.03, 0] });
    lab.cyl(0.3, 0.27, 0.32, '#f4f0e6', { parent: rig, at: [0, 2.34, 0], sides: 9 });
    for (const s of [-1, 1]) lab.ball(0.045, '#1a1a22', { parent: rig, at: [s * 0.09, 2.07, 0.22], detail: 0 });
    lab.box(0.2, 0.04, 0.04, '#3a2418', { parent: rig, at: [0, 1.95, 0.24] }); // усы
    const legs = [-1, 1].map(s => { const p = lab.group({ parent: rig, at: [s * 0.13, 0.62, 0] }); lab.box(0.17, 0.62, 0.2, '#1a1a22', { parent: p, at: [0, -0.31, 0.02] }); return p; });
    const arms = [-1, 1].map(s => { const p = lab.group({ parent: rig, at: [s * 0.34, 1.68, 0] }); lab.box(0.15, 0.72, 0.15, coat, { parent: p, at: [0, -0.34, 0] }); lab.box(0.17, 0.12, 0.17, '#ece7da', { parent: p, at: [0, -0.7, 0] }); return p; });
    return { node, rig, belt, legs, arms, x: 0, jump: 0, air: 1, flip: 0, trip: 0 };
  },
  jump(lab, h, beat) {
    h.jump = 0.0001; h.air = beat * this.AIR; h.flip = 0;
    lab.pulse(h.rig, 0.82, 0.08); // присел перед толчком
    lab.tone(520, 0.05, 'triangle', 0.03, 760);
  },
  // b — сколько долей пройдено: шаг танцора приходится ровно на долю
  animate(lab, h, dt, b) {
    if (h.jump > 0) {
      h.jump += dt / h.air;
      if (h.flip > 0 && h.flip < 2) h.flip = 1 + Math.min(1, h.jump); // сальто на «идеально»
      if (h.jump >= 1) { h.jump = 0; h.flip = 0; lab.pulse(h.rig, 0.86, 0.1); lab.burst([h.x, 0.05, 0], { count: 5, color: '#e8d2a8', speed: 2, up: 1, life: 0.35 }); }
    }
    const air = h.jump > 0, y = air ? Math.sin(Math.PI * h.jump) * 2.1 : Math.abs(Math.sin(Math.PI * b)) * 0.12;
    h.node.position.set(h.x, y, 0);
    h.rig.rotation.x = h.flip > 1 && lab.juicy('squash') ? (h.flip - 1) * Math.PI * 2 : 0;
    if (h.trip > 0) { h.trip = Math.max(0, h.trip - dt * 2.5); h.rig.rotation.x = -Math.sin(h.trip * Math.PI) * 0.6; }
    h.legs.forEach((l, i) => { l.rotation.x = air ? (i ? 0.9 : -0.4) : Math.sin(Math.PI * b + i * Math.PI) * 0.75; });
    // руки в стороны, как в удже; на сильной доле взлетают
    const bar = (b % 4 + 4) % 4 < 1 ? 1 - ((b % 1) + 1) % 1 : 0;
    h.arms.forEach((a, i) => { a.rotation.z = (i ? 1 : -1) * (air ? 2.5 : 1.2 + bar * 0.6 + Math.sin(Math.PI * b) * 0.15); });
    h.node.visible = !lab.blink();
  },

  /* ---------- кувшины: одна пачка копий, цвет — высота ноты ---------- */
  buildJugs(lab) {
    const T = lab.THREE, st = lab.state, U = lab.addons.BufferGeometryUtils, n = st.obs.length;
    const body = U.mergeGeometries([new T.IcosahedronGeometry(0.5, 1).scale(1, 0.95, 1).translate(0, 0.5, 0), new T.CylinderGeometry(0.22, 0.17, 0.42, 8).translate(0, 1.12, 0), new T.CylinderGeometry(0.3, 0.26, 0.1, 8).translate(0, 1.36, 0)].map(g => g.toNonIndexed()));
    const band = U.mergeGeometries([new T.CylinderGeometry(0.51, 0.51, 0.1, 10).translate(0, 0.6, 0), new T.TorusGeometry(0.2, 0.05, 5, 8, Math.PI).rotateZ(-Math.PI / 2).translate(0.4, 0.95, 0)].map(g => g.toNonIndexed()));
    st.jugBody = lab.instances(body, lab.mat('#ffffff', { shiny: true }), Math.max(1, n));
    st.jugBand = lab.instances(band, lab.mat('#5a2e18'), Math.max(1, n));
    st.jugBody.frustumCulled = st.jugBand.frustumCulled = false;
    st.obs.forEach((o, i) => { o.i = i; st.jugBody.setColorAt(i, lab.color(this.NOTE_COLORS[o.n % 5])); });
    if (st.jugBody.instanceColor) st.jugBody.instanceColor.needsUpdate = true;
    this.animateJugs(lab, 0);
  },
  putJug(lab, o, x, y, rz, s) {
    const st = lab.state;
    st.E.set(0, 0, rz); st.Q.setFromEuler(st.E); st.P.set(x, y, 0); st.S.set(s, s, s);
    st.M.compose(st.P, st.Q, st.S);
    st.jugBody.setMatrixAt(o.i, st.M); st.jugBand.setMatrixAt(o.i, st.M);
  },
  animateJugs(lab) {
    const st = lab.state, cx = lab.view.target.x;
    for (const o of st.obs) {
      if (Math.abs(o.x - cx) > 40 && o.drawn) continue;
      o.drawn = true;
      const age = o.done ? lab.t - o.t0 : 0;
      if (!o.done) { const wob = Math.max(0, 1 - Math.abs(st.time - o.t) * 3); this.putJug(lab, o, o.x, 0, Math.sin(lab.t * 18) * 0.06 * wob, 1); }
      else if (o.kind === 'miss') this.putJug(lab, o, o.x + Math.min(age, 0.4) * 2, Math.max(-0.5, -age * 0.6), -Math.min(1.5, age * 6), Math.max(0, 1 - Math.max(0, age - 0.8))); // упал и раскололся
      else { const k = Math.min(1, age / 0.5); this.putJug(lab, o, o.x, Math.sin(k * Math.PI) * 0.6, Math.sin(k * Math.PI * 4) * 0.2 * (1 - k), 1 + Math.sin(k * Math.PI) * 0.15); } // звенит и подпрыгивает
    }
    st.jugBody.instanceMatrix.needsUpdate = st.jugBand.instanceMatrix.needsUpdate = true;
  },

  /* ---------- мир: улица аула на празднике ---------- */
  world(lab, scene, len) {
    const T = lab.THREE, st = lab.state, U = this.U, X0 = -40, X1 = len + 50, put = (m, i, x, y, z, ry, s, col) => lab.place(m, i, [x, y, z], { rot: ry, scale: s, color: col });
    lab.light.hemi.intensity = 0.95; lab.light.hemi.color.set('#9aa6ff'); lab.light.hemi.groundColor.set('#2a1a30');
    lab.light.sun.color.set('#ffc9a8'); lab.light.sun.intensity = 1.1;
    lab.ground({ w: X1 - X0 + 200, h: 140, color: '#2f6a46', y: -0.32 }).position.x = (X0 + X1) / 2;
    // улица: плита на каждую долю, сильная доля такта — красный камень
    const nT = Math.ceil((X1 - X0) / U), road = lab.instances(new T.BoxGeometry(U - 0.08, 0.3, 3.2), '#ffffff', nT);
    for (let i = 0; i < nT; i++) { const k = Math.floor(X0 / U) + i; put(road, i, k * U + U / 2, -0.15, 0, 0, 1, k % 4 === 0 ? '#b0644a' : k % 2 ? '#c9a36b' : '#b8915c'); }
    lab.box(X1 - X0, 0.18, 0.3, '#7a5a3a', { at: [(X0 + X1) / 2, -0.05, 1.75], shadow: false }); // бордюр
    lab.box(X1 - X0, 0.18, 0.3, '#7a5a3a', { at: [(X0 + X1) / 2, -0.05, -1.75], shadow: false });
    // плита доли под ногами вспыхивает в долю — пол тоже играет музыку
    st.beatTile = lab.box(U - 0.1, 0.04, 3.1, lab.mat('#ffd23f', { unlit: true, glow: 1, add: true }), { at: [0, 0.02, 0], shadow: false });
    st.beatTile.material = st.beatTile.material.clone(); st.beatTile.material.transparent = true; st.beatTile.material.opacity = 0;
    // фонари на каждой сильной доле, между ними гирлянды флажков
    const nL = Math.ceil((X1 - X0) / (U * 4)) + 1, poles = lab.instances(new T.CylinderGeometry(0.07, 0.1, 3.4, 6), '#2a2440', nL);
    st.flames = lab.instances(new T.IcosahedronGeometry(0.3, 1), lab.mat('#ffffff', { unlit: true, glow: 1 }), nL, { shadow: false });
    st.flames.frustumCulled = false; st.lamps = [];
    const flags = lab.instances(new T.ConeGeometry(0.22, 0.42, 3).rotateX(Math.PI), '#ffffff', nL * 6, { shadow: false, side: 'double' });
    const pal = ['#ff4d6d', '#ffd23f', '#3fd8c9', '#ffffff', '#7cf5a8', '#c77dff'];
    for (let i = 0; i < nL; i++) {
      const x = Math.floor(X0 / (U * 4)) * U * 4 + i * U * 4;
      put(poles, i, x, 1.7, -2.4, 0, 1); put(st.flames, i, x, 3.5, -2.4, 0, 1, '#ffcf6a');
      st.lamps.push(x);
      for (let k = 0; k < 6; k++) { const f = (k + 0.5) / 6; put(flags, i * 6 + k, x + f * U * 4, 3.25 - Math.sin(f * Math.PI) * 0.7, -2.4, 0, 1, pal[(i + k) % 6]); }
    }
    // плетень, зрители и сакли
    const nF = Math.ceil((X1 - X0) / 3), fence = lab.instances(new T.BoxGeometry(2.9, 0.9, 0.14), '#8a5a33', nF);
    for (let i = 0; i < nF; i++) put(fence, i, X0 + i * 3, 0.45, -4.2, 0, 1);
    const nV = Math.ceil((X1 - X0) / 2.6), coats = ['#3a4a8a', '#7a2a3a', '#2a6a5a', '#5a3a7a', '#8a6a2a', '#2a2a3a'];
    st.vBody = lab.instances(new T.CylinderGeometry(0.22, 0.36, 1.05, 7).translate(0, 0.52, 0), '#ffffff', nV);
    st.vHead = lab.instances(new T.IcosahedronGeometry(0.2, 1).translate(0, 1.27, 0), '#f0c49a', nV);
    st.vHat = lab.instances(new T.CylinderGeometry(0.22, 0.2, 0.22, 7).translate(0, 1.52, 0), '#ffffff', nV);
    st.vBody.frustumCulled = st.vHead.frustumCulled = st.vHat.frustumCulled = false;
    st.vill = [];
    for (let i = 0; i < nV; i++) {
      const v = { x: X0 + i * 2.6 + lab.rand(-0.6, 0.6), z: -5.4 - lab.rand(0, 1.2), ph: lab.rand(0, 1), s: lab.rand(0.85, 1.1) };
      st.vill.push(v);
      lab.place(st.vBody, i, [v.x, 0, v.z], { scale: v.s, color: lab.pick(coats) });
      lab.place(st.vHat, i, [v.x, 0, v.z], { scale: v.s, color: lab.chance(0.5) ? '#f4f0e6' : '#2a2226' });
      lab.place(st.vHead, i, [v.x, 0, v.z], { scale: v.s });
    }
    const nH = Math.ceil((X1 - X0) / 9), wall = lab.instances(new T.BoxGeometry(4, 2.6, 3).translate(0, 1.3, 0), '#f1e3c8', nH);
    const roof = lab.instances(new T.CylinderGeometry(1.7, 1.7, 4.6, 3).rotateZ(Math.PI / 2).translate(0, 3.2, 0), '#ffffff', nH);
    const win = lab.instances(lab.addons.BufferGeometryUtils.mergeGeometries([new T.BoxGeometry(0.8, 0.7, 0.1).translate(-0.9, 1.4, 1.52), new T.BoxGeometry(0.8, 0.7, 0.1).translate(0.9, 1.4, 1.52)]), lab.mat('#ffcf5a', { unlit: true, glow: 0.9 }), nH, { shadow: false });
    for (let i = 0; i < nH; i++) { const x = X0 + i * 9 + lab.rand(-1, 1), z = -lab.rand(8.5, 10.5); put(wall, i, x, 0, z, 0, 1); put(roof, i, x, 0, z, 0, 1, lab.pick(['#b5523b', '#8a3b2b', '#6a4a3a'])); put(win, i, x, 0, z, 0, 1); }
    // камешки и трава у края — передний план для глубины
    const nS = Math.ceil((X1 - X0) / 2), stones = lab.instances(new T.IcosahedronGeometry(0.35, 0), '#4a5a4a', nS);
    for (let i = 0; i < nS; i++) put(stones, i, X0 + i * 2 + lab.rand(-0.8, 0.8), 0, lab.rand(2.4, 4.5), lab.rand(0, 6), [lab.rand(0.6, 1.4), lab.rand(0.4, 0.9), lab.rand(0.6, 1.2)]);
    // горы, луна и звёзды едут медленнее улицы: параллакс
    st.far = lab.group();
    const nM = Math.ceil((X1 - X0) * 0.35 / 26) + 8, mount = lab.instances(new T.ConeGeometry(1, 1, 5), '#2c2766', nM, { parent: st.far }), snow = lab.instances(new T.ConeGeometry(1, 1, 5), '#d9d4f7', nM, { parent: st.far });
    mount.material.fog = snow.material.fog = false; // силуэты гор на закате, без тумана
    for (let i = 0; i < nM; i++) { const x = -110 + i * 26 + lab.rand(-6, 6), h = lab.rand(16, 30), w = lab.rand(24, 36), z = -110 - lab.rand(0, 14); put(mount, i, x, h / 2 - 6, z, lab.rand(0, 3), [w, h, 14]); put(snow, i, x, h - 6 - h * 0.13, z + 1, lab.rand(0, 3), [w * 0.26, h * 0.27, 4]); }
    lab.noShadow(st.far);
    st.moon = lab.ball(6, '#fff4c2', { at: [30, 34, -95], unlit: true, glow: 0.9, detail: 2, shadow: false });
    st.moon.material.fog = false;
    const pts = [];
    for (let i = 0; i < 260; i++) pts.push(lab.rand(-140, 140), lab.rand(14, 80), -120 - lab.rand(0, 20));
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
    st.stars = new T.Points(g, new T.PointsMaterial({ color: '#ffffff', size: 0.7, fog: false }));
    scene.add(st.stars);
    st.lampCol = '#ffd23f';
  },
  setInst(lab, m, i, x, y, z, s) { const st = lab.state; st.Q.identity(); st.P.set(x, y, z); st.S.set(s, s, s); st.M.compose(st.P, st.Q, st.S); m.setMatrixAt(i, st.M); },
  // свет в долю: фонари, плита под ногами и зрители живут в долю — картинка тоже играет музыку (только на одних часах)
  pulseBeat(lab, dt, L) {
    const st = lab.state, cx = lab.view.target.x, b = this.beatsAt(st, st.time), ph = ((b % 1) + 1) % 1, k = Math.max(0, 1 - Math.min(ph, 1 - ph) * 5);
    const on = lab.cfg.secret === 1, jump = st.fever ? 0.55 : 0.2;
    st.far.position.x = cx * 0.65; st.stars.position.x = cx * 0.9; st.moon.position.x = cx * 0.85 + 30;
    st.beatTile.position.x = Math.floor(b) * this.U + this.U / 2;
    st.beatTile.material.opacity = on ? k * 0.55 : 0;
    st.beatTile.material.color.set(st.fever ? '#ff9a3c' : st.lampCol);
    // фонари рядом с камерой
    st.lamps.forEach((x, i) => {
      if (Math.abs(x - cx) > 30) return;
      const s = 1 + (on ? k : 0) * 0.35 * (lab.juicy('squash') ? 1 : 0);
      this.setInst(lab, st.flames, i, x, 3.5, -2.4, s);
      st.flames.setColorAt(i, st.C.set(st.fever ? '#ff9a3c' : st.lampCol).multiplyScalar(1 + (on ? k : 0) * 1.2));
    });
    st.flames.instanceMatrix.needsUpdate = true; if (st.flames.instanceColor) st.flames.instanceColor.needsUpdate = true;
    // зрители подпрыгивают в долю, в жару пляшут выше
    st.vill.forEach((v, i) => {
      if (Math.abs(v.x - cx) > 28) return;
      const y = on ? Math.abs(Math.sin(Math.PI * (b + (st.fever ? 0 : v.ph * 0.15)))) * jump : Math.abs(Math.sin(lab.t * 2 + v.ph * 6)) * 0.08;
      this.setInst(lab, st.vBody, i, v.x, y, v.z, v.s); this.setInst(lab, st.vHead, i, v.x, y, v.z, v.s); this.setInst(lab, st.vHat, i, v.x, y, v.z, v.s);
    });
    st.vBody.instanceMatrix.needsUpdate = st.vHead.instanceMatrix.needsUpdate = st.vHat.instanceMatrix.needsUpdate = true;
    st.moon.scale.setScalar(1 + (on ? k : 0) * 0.04);
  },

  /* ---------- дуэль «повтори за мной» ---------- */
  // такт ведущего: 8 восьмых, он стучит свой ритм; такт повтора: второй игрок повторяет. Шесть раундов, ведущий меняется.
  duelStart(lab) {
    const st = lab.state, beat = st.duelBeat;
    st.duel = { beat, bar: 0, taps: [], lead: [] }; st.pts = [0, 0];
    st.hero.x = -3; st.hero.node.position.set(-3, 0, 0);
    st.hero2 = this.dancer(lab, '#2e6ede'); st.hero2.x = 3; st.hero2.node.position.set(3, 0, 0); st.hero2.node.rotation.y = Math.PI;
    st.tiles = [];
    for (let i = 0; i < 8; i++) {
      const m = lab.box(1, 1, 0.2, new lab.THREE.MeshStandardMaterial({ color: '#3a3f8f', flatShading: true }), { at: [-4.2 + i * 1.2, 5.6, -0.4], round: 0.12, shadow: false });
      st.tiles.push(m);
    }
    st.head = lab.cone(0.22, 0.4, lab.mat('#ffffff', { unlit: true, glow: 1.2 }), { at: [-4.2, 4.85, -0.4], rot: [Math.PI, 0, 0], shadow: false });
    lab.box(10.6, 1.6, 0.1, '#1a1640', { at: [0, 5.6, -0.6], shadow: false });
    for (let i = 0; i < 4 * 13; i++) st.evts.push({ t: i * beat, kind: 'beat', hi: i % 4 === 0 });
    st.evts.push(...[0, 1, 2, 3].map(i => ({ t: i * beat, kind: 'count', hi: i === 0 })));
    st.evts.sort((a, b) => a.t - b.t);
    st.end = 4 * 13 * beat; // метроном: такт отсчёта и 6 раундов по два такта
    st.time = -0.4;
    lab.view.target.set(0, 3.2, 0);
    lab.hud('acc', 'Такт 1 — отсчёт. Потом ведёт игрок 1 (F), игрок 2 (K) повторяет');
  },
  tile(lab, m, color, glow) { m.material.color.set(color); m.material.emissive.set(glow ? color : '#000000'); m.material.emissiveIntensity = glow ? glow * 1.6 : 0; },
  duelUpdate(lab, dt) {
    const st = lab.state, D = st.duel, barLen = 4 * D.beat, t = st.time;
    [st.hero, st.hero2].forEach(h => this.animate(lab, h, dt, Math.max(0, t) / D.beat));
    st.hero2.node.position.x = 3;
    if (t < 0) return;
    const bar = Math.floor(t / barLen), round = Math.floor((bar - 1) / 2), lead = round % 2, echo = (bar - 1) % 2 === 1;
    const who = echo ? 1 - lead : lead, p = who ? lab.p2 : lab.p1, step = Math.round((t - bar * barLen) / (D.beat / 2)) % 8;
    const cur = Math.floor((t - bar * barLen) / (D.beat / 2)) % 8;
    st.head.position.x = lab.damp(st.head.position.x, -4.2 + cur * 1.2, 30, dt);
    if (bar !== D.bar) { // новый такт
      if (D.bar >= 1 && (D.bar - 1) % 2 === 1) this.duelScore(lab, D);
      D.bar = bar; D.taps = [];
      if (bar >= 1 && !echo) D.lead = [];
      st.tiles.forEach((m, i) => this.tile(lab, m, echo && D.lead.includes(i) ? '#ffd23f' : '#3a3f8f', echo && D.lead.includes(i) ? 0.35 : 0));
      if (bar > 12) return lab.win(st.pts[0] === st.pts[1] ? 'Ничья!' : `Победил игрок ${st.pts[0] > st.pts[1] ? 1 : 2}`);
      if (bar >= 1) lab.popup([who ? 3 : -3, 3.4, 0], echo ? 'Повторяй!' : 'Веди!', who ? '#59a8ff' : '#ff6b6b', 22);
      lab.hud('acc', bar === 0 ? 'Отсчёт' : `Раунд ${round + 1} из 6 · ${echo ? 'повторяет' : 'ведёт'} игрок ${who + 1} · счёт ${st.pts[0]} : ${st.pts[1]}`);
    }
    if (bar >= 1 && p.pressed.a && !D.taps.includes(step)) {
      D.taps.push(step); if (!echo) D.lead.push(step);
      const ok = !echo || D.lead.includes(step), m = st.tiles[step];
      this.tile(lab, m, ok ? (echo ? '#7cf5a8' : '#ffd23f') : '#ff4d5e', 0.9);
      lab.pulse(m, 1.25, 0.12);
      lab.tone(this.NOTES[step % 5] * 2, 0.15, 'triangle', 0.12);
      lab.burst(m, { count: 10, colors: [ok ? '#ffd23f' : '#ff4d5e', '#ffffff'], speed: 4 });
      const h = who ? st.hero2 : st.hero;
      this.jump(lab, h, D.beat);
      if (ok && echo) h.flip = 1;
    }
  },
  duelScore(lab, D) {
    const st = lab.state, round = Math.floor((D.bar - 1) / 2), echoer = 1 - (round % 2);
    const hit = D.taps.filter(s => D.lead.includes(s)).length, extra = D.taps.length - hit, missed = D.lead.length - hit;
    const pts = Math.max(0, hit - extra - missed), clean = pts === D.lead.length && D.lead.length > 0;
    st.pts[echoer] += pts; lab.count(clean ? 'идеально' : 'мимо');
    lab.popup([echoer ? 3 : -3, 3.8, 0], clean ? 'Точно!' : `+${pts}`, '#ffd23f', 24);
    if (clean) { lab.burst([echoer ? 3 : -3, 2, 0], { count: 20, colors: ['#ffd23f', '#ffffff'], speed: 6, up: 2 }); lab.sfx.coin(); }
  },
};
