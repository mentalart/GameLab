// Проектор и класс (аудит уроков 21.10.2026, сессия 2) — общее для страницы ученика, аркады и проектора. Ни от чего, кроме Lab и Games, не зависит.
//   splash   — заставка чекпоинта (Д7): «Уровень 3: Фабрика» на секунду со звуком, как переход между уровнями; при «уменьшить движение» — без анимации.
//   goalBar  — цель класса (Д2): «412 из 1000 партий в игры друг друга», награда; цель взята — открытая награда с «▶ Играть».
//   reacts   — живые реакции (Д3): пока на проекторе игра, внизу ряд эмодзи; нажатие летит на проектор (POST /api/react).
//   teatr    — театр сцены (В5): учитель ведёт сцену motion на проекторе, класс голосует «что изменится?». Шаг motion этой сцены
//              показывает только голосование (mount), на других шагах — плашка внизу слева. Ответ и итог — после «Включить».
//   fails    — галерея провалов класса (Д5): стена «Провалов дня», голос «самый смешной» (один на ученика), автор может убрать свой.
'use strict';
(function () {
  const { el, api, toast, beep } = Lab;
  const calm = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = n => Number(n || 0).toLocaleString('ru-RU');

  /* ---------------- заставка чекпоинта (Д7) ---------------- */
  // звук перехода между уровнями: короткое арпеджио вверх и «бум» (WebAudio, без файлов)
  function levelSound() {
    try {
      const AC = levelSound.ac = levelSound.ac || new (window.AudioContext || window.webkitAudioContext)();
      [392, 523, 659, 784, 1046].forEach((f, i) => {
        const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime + i * 0.06;
        o.type = 'square'; o.frequency.value = f;
        g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (i === 4 ? 0.5 : 0.12));
        o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + 0.55);
      });
    } catch (e) { /* без звука */ }
  }
  function splash({ n, title, minutes, ms = 1300 }) {
    document.querySelectorAll('.lvl-splash').forEach(x => x.remove());
    const box = el('div', { class: 'lvl-splash' + (calm() ? ' calm' : ''), role: 'status', 'aria-live': 'assertive' },
      el('div', { class: 'lvl-in' }, el('div', { class: 'lvl-n' }, `Уровень ${n}`), el('div', { class: 'lvl-t' }, title),
        minutes ? el('div', { class: 'lvl-m' }, `${minutes} минут`) : null));
    document.body.append(box);
    levelSound();
    setTimeout(() => { box.classList.add('out'); setTimeout(() => box.remove(), calm() ? 0 : 350); }, window.LAB_FAST ? 500 : ms);
    return box;
  }

  /* ---------------- цель класса (Д2) ---------------- */
  // одна плашка на странице: update(goal) перерисовывает её; цель взята — кнопка «▶ Играть» в награду (рамка под плашкой)
  function goalBar() {
    const box = el('section', { class: 'goal-bar', hidden: true, 'aria-live': 'polite' });
    let goal = null, frame = null, shown = false;
    function draw() {
      box.hidden = !goal;
      if (!goal) { if (frame) { frame.destroy(); frame = null; } box.replaceChildren(); return; }
      const share = Math.min(1, goal.count / Math.max(1, goal.target)), r = goal.reward;
      const parts = [el('div', { class: 'goal-row' },
        el('span', { class: 'goal-ico', 'aria-hidden': 'true' }, goal.reached ? '🎉' : '🎯'),
        el('div', { class: 'goal-main' },
          el('div', { class: 'eyebrow' }, goal.reached ? 'Цель класса взята!' : 'Цель класса'),
          el('div', { class: 'goal-line' }, el('b', { 'data-goal-count': '' }, fmt(goal.count)), ` из ${fmt(goal.target)} партий в игры друг друга`),
          el('div', { class: 'goal-track', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(goal.target), 'aria-valuenow': String(goal.count) }, el('i', { style: `width:${Math.round(share * 100)}%` }))),
        el('div', { class: 'goal-prize' + (goal.reached ? ' open' : '') }, el('span', { class: 'small muted' }, goal.reached ? 'Открыто:' : 'Награда:'), el('b', {}, `${r.icon} ${r.label}`),
          r.game && !frame ? el('button', { class: 'btn warm small', type: 'button', 'data-goal-play': '', onclick: play }, '▶ Играть') : null))];
      if (!goal.reached) parts.push(el('p', { class: 'small muted' }, 'Считаются только партии в чужие игры: в аркаде класса, у соседа, по вызову. Своя игра цель не двигает.'));
      box.replaceChildren(...parts);
      if (frame) box.append(frame.box, Games.bar(frame, el('button', { class: 'btn ghost small', type: 'button', onclick: () => { frame.destroy(); frame = null; draw(); } }, '✕ Закрыть')));
    }
    function play() {
      if (!goal || !goal.reward.game) return;
      frame = Games.frame({ src: () => '/engine/game.html?game=../' + goal.reward.game, key: () => 'reward:' + goal.reward.id, label: 'Играть', autostart: true,
        onError: err => frame && frame.message(el('b', {}, 'Игра упала: ' + (err.message || 'ошибка'))) });
      draw();
    }
    return {
      box,
      update(g, fromEvent) {
        const was = goal;
        goal = g && !g.off ? g : null;
        if (fromEvent && goal && goal.justReached) { beep('done'); toast(`🎉 Цель класса взята: ${fmt(goal.target)} партий! Открыто: ${goal.reward.icon} ${goal.reward.label}`, 'ok', 8000); confettiOn(box); }
        else if (fromEvent && goal && was && goal.count > was.count && !calm()) { const b = box.querySelector('[data-goal-count]'); if (b) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); } }
        if (!shown || !fromEvent || !was !== !goal || (was && goal && (was.reached !== goal.reached || was.target !== goal.target || was.reward.label !== goal.reward.label))) draw();
        else { // счёт растёт часто: только число и полоска, рамка с наградой не трогается
          const b = box.querySelector('[data-goal-count]'), i = box.querySelector('.goal-track i');
          if (b) b.textContent = fmt(goal.count);
          if (i) i.style.width = Math.round(Math.min(1, goal.count / Math.max(1, goal.target)) * 100) + '%';
        }
        shown = true;
      },
    };
  }
  function confettiOn(node) {
    if (calm() || !node.isConnected) return;
    const cols = ['#ffb547', '#7cf5a8', '#b49bff', '#ff5d6e', '#5fe0ff'];
    for (let i = 0; i < 26; i++) {
      const c = el('i', { class: 'goal-conf', style: `left:${Math.random() * 100}%;background:${cols[i % cols.length]};--dx:${Math.round((Math.random() - 0.5) * 160)}px;--d:${Math.round(Math.random() * 300)}ms` });
      node.append(c); setTimeout(() => c.remove(), 1600);
    }
  }

  /* ---------------- живые реакции (Д3) ---------------- */
  const REACTIONS = ['😂', '😮', '🔥', '👏', '😱', '❤️']; // те же, что принимает сервер (lib/klass.js)
  function reacts(list = REACTIONS) {
    const box = el('section', { class: 'react-dock', hidden: true, 'aria-label': 'Реакции на проектор' });
    let live = null, wait = 0;
    const send = async (e, b) => {
      if (Date.now() < wait) return;
      wait = Date.now() + 900;
      b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
      try { await api('/api/react', { emoji: e }); }
      catch (err) { if (err.status === 409) { live = null; draw(); } else if (err.status !== 429) toast(err.message, 'err'); }
    };
    function draw() {
      box.hidden = !live || !live.on;
      if (box.hidden) return;
      box.replaceChildren(el('span', { class: 'small' }, el('b', {}, '📽 На проекторе'), live.label ? ` «${live.label}»` : '', ' — реагируй:'),
        el('div', { class: 'react-row' }, list.map(e => { const b = el('button', { type: 'button', class: 'react-btn', 'data-react': e, 'aria-label': 'Реакция ' + e }, e); b.addEventListener('click', () => send(e, b)); return b; })));
    }
    return { box, update(l) { live = l; draw(); } };
  }

  /* ---------------- театр сцены (В5) ---------------- */
  const teatrMounts = []; // { step, box, t } — шаги motion на странице: в голосовании сцена прячется, на её месте — карточка голоса
  let T = null, dock = null, drawnKey = '';
  function teatrCard(t, inStep) {
    const reveal = t.phase === 'reveal', voted = t.mine != null;
    const total = reveal ? Math.max(1, (t.counts || []).reduce((a, b) => a + b, 0)) : 1;
    const opts = el('div', { class: 'teatr-opts' }, t.options.map((o, i) => {
      const cls = 'teatr-opt' + (t.mine === i ? ' mine' : '') + (reveal ? (i === t.right ? ' right' : ' wrong') : '');
      const b = el('button', { type: 'button', class: cls, 'data-teatr-opt': String(i), disabled: reveal || null, 'aria-pressed': String(t.mine === i) },
        el('span', { class: 'm4-key' }, String(i + 1)), el('span', { class: 'grow' }, o),
        reveal ? el('b', {}, String(t.counts[i])) : null,
        reveal ? el('i', { class: 'teatr-bar', style: `width:${Math.round(100 * t.counts[i] / total)}%` }) : null);
      if (!reveal) b.addEventListener('click', () => vote(i));
      return b;
    }));
    const head = reveal
      ? (voted ? (t.mine === t.right ? '✅ Угадал! Смотри на проектор' : '🤔 Не угадал — смотри на проектор, почему так') : '👀 Смотри на проектор: вот что изменилось')
      : voted ? `Твой ответ принят. Ждём, пока учитель ${t.turnOn ? 'включит' : 'выключит'} «${t.toggle.label}»…` : `Учитель сейчас ${t.turnOn ? 'включит' : 'выключит'} «${t.toggle.label}». Как думаешь?`;
    return el('div', { class: 'teatr-card' + (inStep ? ' in-step' : '') + (reveal ? ' reveal' : ''), 'data-teatr': t.phase },
      el('div', { class: 'eyebrow' }, `🎭 Сцена на проекторе · «${t.title}»`),
      el('h3', {}, t.q), el('p', { class: 'small' }, head), opts,
      reveal && t.why ? el('p', { class: 'concept small' }, t.why) : null,
      el('p', { class: 'small muted' }, reveal ? `Угадали ${t.counts[t.right]} из ${t.counts.reduce((a, b) => a + b, 0)}` : `Проголосовали: ${t.n}`));
  }
  async function vote(i) {
    if (!T || T.phase !== 'ask') return;
    try { const r = await api('/api/theater/vote', { ask: T.ask, option: i }); beep('tick'); teatrUpdate(r.theater); }
    catch (e) { toast(e.message, 'err'); }
  }
  function teatrDraw() {
    for (let k = teatrMounts.length - 1; k >= 0; k--) { const m = teatrMounts[k]; if (!m.box.isConnected && (m.used || Date.now() - m.t > 5000)) teatrMounts.splice(k, 1); } // шаг перерисован — коробка ушла
    const voting = T && (T.phase === 'ask' || T.phase === 'reveal') && T.q;
    const key = T ? [T.ask, T.phase, T.scene].join(':') : '', enter = key !== drawnKey; // новая карточка влетает, обновление голосов — без прыжка
    drawnKey = key;
    let inStep = false;
    teatrMounts.forEach(m => {
      if (!m.box.isConnected) return;
      m.used = true;
      const mine = voting && m.step === T.step;
      m.box.classList.toggle('teatr-on', !!mine);
      m.box.querySelectorAll(':scope > .teatr-card').forEach(x => x.remove());
      if (mine) { const c = teatrCard(T, true); if (enter) c.classList.add('enter'); m.box.prepend(c); inStep = true; }
    });
    if (!dock) { dock = el('section', { class: 'teatr-dock', hidden: true }); document.body.append(dock); }
    dock.hidden = !T || inStep;
    if (dock.hidden) { dock.replaceChildren(); return; }
    const c = voting ? teatrCard(T, false) : el('div', { class: 'teatr-card small-card' }, el('div', { class: 'eyebrow' }, '🎭 Сцена на проекторе'), el('b', {}, `«${T.title}» — смотри на экран класса`));
    if (enter) c.classList.add('enter');
    dock.replaceChildren(c);
  }
  function teatrUpdate(t, fromEvent) {
    const prev = T;
    const keepMine = prev && t && prev.ask === t.ask && prev.mine != null && t.mine == null;
    T = t && t.phase ? Object.assign({}, t, keepMine ? { mine: prev.mine } : {}) : null; // событие класса без моего ответа — свой ответ помню сам
    if (fromEvent && T && T.q && (!prev || prev.ask !== T.ask || prev.phase !== T.phase)) beep(T.phase === 'reveal' ? (T.mine === T.right ? 'good' : 'tick') : 'dice');
    teatrDraw();
  }
  const teatr = {
    update: teatrUpdate,
    // шаг motion регистрирует свою коробку: в голосовании по этой сцене коробка показывает только карточку голоса
    mount(step, box) { teatrMounts.push({ step, box, used: false, t: Date.now() }); if (T) setTimeout(teatrDraw, 0); },
    get state() { return T; },
  };

  /* ---------------- галерея провалов (Д5) ---------------- */
  function fails(host) {
    const box = el('section', { class: 'stack fails-gal' });
    host.append(box);
    let list = [], busy = false;
    const act = async (url, body) => { if (busy) return; busy = true; try { list = (await api(url, body)).fails; beep('tick'); draw(); } catch (e) { toast(e.message, 'err'); } busy = false; };
    function draw() {
      const head = el('div', { class: 'stack', style: 'gap:4px' }, el('div', { class: 'eyebrow' }, 'Галерея провалов класса'), el('h2', {}, '🤡 Стена смешных багов'),
        el('p', { class: 'muted small' }, 'Баги, которые класс разобрал в «Провале дня» с согласия авторов. Один голос — за самый смешной; лучшие попадут в нарезку на Фестивале.'));
      if (!list.length) { box.replaceChildren(head, el('p', { class: 'muted' }, 'Пока пусто: первый провал появится после «Провала дня» на уроке.')); return; }
      const max = Math.max(1, ...list.map(f => f.votes));
      box.replaceChildren(head, el('div', { class: 'fails-wall' }, list.map((f, i) => el('article', { class: 'fail-card' + (f.mine ? ' voted' : '') + (f.hidden ? ' off' : ''), 'data-fail-key': f.key },
        el('div', { class: 'row', style: 'gap:6px' }, el('span', { class: 'tag' }, f.lesson ? `урок ${f.lesson}` : 'урок'), i < 3 && f.votes ? el('span', { class: 'tag warm' }, '🎬 в нарезку') : null, el('span', { class: 'grow' }), el('span', { class: 'small muted' }, f.nick)),
        el('h3', {}, `«${f.title}»`),
        f.note ? el('p', {}, f.note) : null,
        f.why.length ? el('div', { class: 'row', style: 'gap:6px' }, f.why.map(w => el('span', { class: 'chip' }, w))) : null,
        f.moral ? el('p', { class: 'small' }, el('b', {}, 'Поняли: '), f.moral) : null,
        el('i', { class: 'fail-votes' }, el('i', { style: `width:${Math.round(100 * f.votes / max)}%` })),
        el('div', { class: 'row' }, el('span', { class: 'small' }, `😂 ${f.votes}`), el('span', { class: 'grow' }),
          f.own ? el('button', { class: 'btn ghost small', type: 'button', 'data-fail-hide': f.key, onclick: () => act('/api/fails/hide', { key: f.key, hidden: !f.hidden }) }, f.hidden ? '👁 Вернуть в галерею' : '🙈 Убрать мой провал')
            : el('button', { class: 'btn small' + (f.mine ? '' : ' ghost'), type: 'button', 'data-fail-vote': f.key, 'aria-pressed': String(f.mine), onclick: () => act('/api/fails/vote', { key: f.key }) }, f.mine ? '😂 Мой голос' : '😂 Самый смешной'))))));
    }
    async function load() { try { list = (await api('/api/fails')).fails; draw(); } catch (e) { /* без галереи */ } }
    load();
    return { box, load };
  }

  window.LabKlass = { splash, goalBar, reacts, teatr, fails, calm, REACTIONS };
})();
