// Проектор и класс (аудит уроков 21.10.2026, сессия 2) — части проектора. Подключается до сцен steps-m*.js: сцены шага motion берутся из window.LabMotion.
//   teatr  — вкладка «🎭 Сцена» (В5): учитель ведёт сцену motion крупно; «❓ Спросить класс» перед переключателем — ученики голосуют «что изменится?»
//            (vote у переключателя в сценарии), «▶ Включить» — сцена меняется, у всех ответ и итог голосования.
//   goal   — вкладка «🎯 Цель» (Д2): счётчик партий в игры друг друга, цель и награда учителя; goalStrip — та же цель строкой на вкладке «Урок».
//   reacts — живые реакции (Д3): эмодзи с ноутбуков всплывают поверх игры, которая видна на проекторе.
//   sabotazh — вкладка «🕵 Саботаж» (Г2, сессия 4): учитель тайно поворачивает ручку донора, класс угадывает с ноутбуков, «Раскрыть» — ответ всем.
//   fails  — галерея провалов класса и нарезка лучших к Фестивалю (Д5) на вкладке «🤡 Провал дня».
'use strict';
window.STEPS = window.STEPS || {}; // сцены steps-m8.js и steps-m6.js рядом с ними объявляют шаги ученика — на проекторе они просто не используются
(function () {
  const { el, api, toast, beep } = Lab;
  const calm = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = n => Number(n || 0).toLocaleString('ru-RU');

  /* =================== театр сцены (В5) =================== */
  function teatr(host, { code, lesson }) {
    const S = { step: null, scene: 0, on: {}, t: null, t0: performance.now(), ctlT0: performance.now(), ctlId: null, raf: 0, key: '' };
    const motionSteps = () => (lesson() ? lesson().checkpoints.flatMap(cp => cp.steps.filter(s => s.type === 'motion').map(s => Object.assign({ cp: cp.id }, s))) : []);
    const stepNow = () => motionSteps().find(s => s.id === S.step) || null;
    const sceneNow = () => { const st = stepNow(); return st ? st.scenes[S.scene] : null; };
    const live = () => S.t && S.t.step === S.step;
    const cv = el('canvas', { width: 640, height: 300, class: 'm4-cv kp-cv', 'aria-label': 'Сцена на проекторе' });
    const g = cv.getContext('2d');
    const head = el('div', { class: 'row kp-head' }), cap = el('div', { class: 'kp-cap' }), nav = el('div', { class: 'row' }), togs = el('div', { class: 'kp-togs' }), log = el('div', { class: 'kp-log' });
    host.append(head, el('div', { class: 'kp-stagebox' }, el('div', { class: 'm4-stage' }, cv), cap), nav, togs, log);

    function pick(id, scene = 0) {
      S.step = id; S.scene = scene; S.t0 = performance.now(); S.ctlId = null;
      const sc = sceneNow(); S.on = sc ? Object.fromEntries((sc.toggles || []).map(x => [x.id, !!x.on])) : {};
    }
    async function act(body) {
      try { const r = await api('/api/teacher/theater', Object.assign({ code: code() }, body)); setState(r.theater); return true; } catch (e) { toast(e.message, 'err'); return false; }
    }
    function setState(t) {
      const prev = S.t;
      S.t = t;
      if (t && (!prev || prev.step !== t.step || prev.scene !== t.scene)) { pick(t.step, t.scene); }
      if (t && t.step === S.step) {
        const changed = Object.keys(t.on || {}).find(k => !!(S.on || {})[k] !== !!t.on[k]);
        if (changed) { S.ctlId = changed; S.ctlT0 = performance.now(); beep(t.on[changed] ? 'good' : 'tick'); }
        S.on = Object.assign({}, t.on);
      }
      draw();
    }
    async function load() { try { setState((await api('/api/teacher/theater?code=' + encodeURIComponent(code()))).theater); } catch (e) { toast(e.message, 'err'); } }
    function go(d) {
      const st = stepNow(); if (!st) return;
      const n = Math.max(0, Math.min(st.scenes.length - 1, S.scene + d)); if (n === S.scene) return;
      if (live()) act({ action: 'scene', scene: n }); else { pick(S.step, n); beep('tick'); draw(); }
    }
    function flipLocal(id) { S.on = Object.assign({}, S.on, { [id]: !S.on[id] }); S.ctlId = id; S.ctlT0 = performance.now(); beep(S.on[id] ? 'good' : 'tick'); draw(); }
    function draw() {
      const list = motionSteps();
      if (!list.length) { host.replaceChildren(el('div', { class: 'card stack' }, el('h2', {}, 'В этом уроке нет сцен'), el('p', { class: 'pj-sub' }, 'Театр сцены работает с шагами-объяснялками motion.'))); return; }
      if (!stepNow()) { const t = S.t; pick(t ? t.step : list[0].id, t ? t.scene : 0); }
      const st = stepNow(), sc = sceneNow(), t = S.t, on = live();
      head.replaceChildren(el('div', { class: 'grow stack', style: 'gap:2px' }, el('div', { class: 'eyebrow' }, '🎭 Театр сцены'),
        el('div', { class: 'row', style: 'gap:6px' }, list.map(s => el('button', { type: 'button', class: 'chipbtn' + (s.id === S.step ? ' on' : ''), 'data-teatr-step': s.id, disabled: (on && s.id !== S.step) || null,
          onclick: () => { pick(s.id, 0); draw(); } }, s.title)))),
      on ? el('span', { class: 'tag ok' }, '● класс смотрит') : null,
      on ? el('button', { class: 'btn ghost small', type: 'button', 'data-teatr': 'end', onclick: () => act({ action: 'end' }) }, '■ Закончить показ')
        : el('button', { class: 'btn warm', type: 'button', 'data-teatr': 'show', onclick: () => act({ action: 'show', step: S.step, scene: S.scene }) }, '🎭 Показать сцену классу'));
      cap.replaceChildren(el('div', { class: 'eyebrow' }, `Сцена ${S.scene + 1} из ${st.scenes.length}`), el('h2', {}, sc.title), el('p', {}, sc.text));
      nav.replaceChildren(el('button', { class: 'btn ghost', type: 'button', disabled: S.scene === 0 || null, onclick: () => go(-1) }, '← Назад'),
        el('div', { class: 'm4-dots' }, st.scenes.map((_, k) => el('i', { class: k === S.scene ? 'on' : k < S.scene ? 'ok' : '' }))), el('span', { class: 'grow' }),
        el('span', { class: 'pj-sub' }, on ? 'Ученики видят: «смотри на проектор»' : 'Пока это предпросмотр: класс не видит'),
        el('button', { class: 'btn', type: 'button', 'data-teatr': 'next', disabled: S.scene === st.scenes.length - 1 || null, onclick: () => go(1) }, 'Дальше →'));
      const tl = sc.toggles || [];
      togs.replaceChildren(...(tl.length ? [el('div', { class: 'eyebrow' }, sc.try || 'Переключатели сцены')] : [el('p', { class: 'pj-sub' }, 'У этой сцены нет переключателей.')]),
        ...tl.map(x => toggleRow(x, t, on)));
      const lg = t && on ? (t.log || []).filter(r => r.n) : [];
      log.replaceChildren(...(lg.length ? [el('span', { class: 'pj-sub' }, 'Класс угадывал: '), ...lg.slice(-6).map(r => el('span', { class: 'tag' }, `${r.label}: ${r.right} из ${r.n}`))] : []));
      S.key = JSON.stringify([S.step, S.scene, S.on]);
    }
    function toggleRow(x, t, on) {
      const isOn = !!S.on[x.id], asking = on && t.ask && t.toggle && t.toggle.id === x.id;
      const sw = el('span', { class: 'kp-sw' + (isOn ? ' on' : '') }, el('span', { class: 'm6-sw' }, el('i')), x.label);
      const row = el('div', { class: 'kp-tog' + (asking ? ' asking' : ''), 'data-toggle': x.id }, el('div', { class: 'row' }, sw, el('span', { class: 'grow' }), ...buttons()));
      function buttons() {
        if (!on) return [el('button', { class: 'btn ghost small', type: 'button', onclick: () => flipLocal(x.id) }, isOn ? 'Выключить' : 'Включить')];
        if (asking && t.phase === 'ask') return [el('button', { class: 'btn warm', type: 'button', 'data-teatr': 'reveal', onclick: () => act({ action: 'reveal' }) }, `▶ ${t.turnOn ? 'Включить' : 'Выключить'} и показать ответ`, el('kbd', {}, 'Enter'))];
        const out = [];
        if (x.vote) out.push(el('button', { class: 'btn small', type: 'button', 'data-teatr': 'ask', onclick: () => act({ action: 'ask', toggle: x.id }) }, '❓ Спросить класс: что изменится?'));
        out.push(el('button', { class: 'btn ghost small', type: 'button', onclick: () => act({ action: 'flip', toggle: x.id }) }, (isOn ? 'Выключить' : 'Включить') + (x.vote ? ' без вопроса' : '')));
        return out;
      }
      if (asking) {
        const reveal = t.phase === 'reveal', total = Math.max(1, (t.counts || []).reduce((a, b) => a + b, 0));
        row.append(el('div', { class: 'kp-ask' }, el('h3', {}, t.q),
          el('div', { class: 'kp-opts' }, t.options.map((o, i) => el('div', { class: 'kp-opt' + (reveal ? (i === t.right ? ' right' : ' wrong') : '') },
            el('span', { class: 'm4-key' }, String(i + 1)), el('span', { class: 'grow' }, o),
            reveal ? el('b', {}, String(t.counts[i])) : null, reveal ? el('i', { class: 'teatr-bar', style: `width:${Math.round(100 * t.counts[i] / total)}%` }) : null))),
          el('p', { class: 'pj-sub', 'data-teatr-n': '' }, reveal ? `Угадали ${t.counts[t.right]} из ${t.counts.reduce((a, b) => a + b, 0)}` + (t.why ? ' · ' + t.why : '') : `Голосуют с ноутбуков · проголосовали: ${t.n}`)));
      }
      return row;
    }
    // сцена рисуется, пока вкладка на экране; в проверке (LAB_LOWRES) — 10 кадров в секунду; при «уменьшить движение» — итоговый кадр
    let last = 0;
    const loop = now => {
      if (!host.isConnected) return;
      S.raf = requestAnimationFrame(loop);
      if (!cv.offsetParent || (window.LAB_LOWRES && now - last < 100) || (calm() && now - last < 400)) return;
      last = now;
      const sc = sceneNow(), f = sc && window.LabMotion && window.LabMotion.MOTION[sc.anim];
      g.save(); g.clearRect(0, 0, 640, 300);
      try {
        const ctl = Object.assign({ _t: calm() ? 99 : (now - S.ctlT0) / 1000, _id: S.ctlId }, S.on);
        if (f) f(g, calm() ? 8 : (now - S.t0) / 1000, 640, 300, ctl); else { g.fillStyle = '#141c36'; g.fillRect(0, 0, 640, 300); }
      } catch (e) { /* сцена не рисуется — подпись остаётся */ }
      g.restore();
    };
    const onKey = e => {
      if (!cv.offsetParent || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) return;
      if (e.code === 'ArrowRight') { e.preventDefault(); go(1); }
      if (e.code === 'ArrowLeft') { e.preventDefault(); go(-1); }
      if (e.code === 'Enter' && S.t && S.t.phase === 'ask') { e.preventDefault(); act({ action: 'reveal' }); }
    };
    addEventListener('keydown', onKey);
    load(); S.raf = requestAnimationFrame(loop);
    return {
      event(t) { if (!t || !t.phase) setState(null); else load(); }, // событие класса без голосов по нику — полное состояние берём у сервера
      refresh() { if (!S.t || S.t.phase === 'ask') load(); else draw(); },
      destroy() { cancelAnimationFrame(S.raf); removeEventListener('keydown', onKey); host.replaceChildren(); },
    };
  }

  /* =================== саботаж (Г2, сессия 4) =================== */
  // Вкладка «🕵 Саботаж»: учитель тайно поворачивает одну ручку донора (шаг secret с hunt.format 'sabotazh'), играет на проекторе,
  // класс угадывает с ноутбуков. Название ручки на экране — только после «Раскрыть»: проектор видит весь класс.
  function sabotazh(host, { code, lesson }) {
    const S = { st: null, x: null, h: null, key: '' };
    const steps = () => (lesson() ? lesson().checkpoints.flatMap(cp => cp.steps.filter(s => s.type === 'secret' && s.hunt && s.hunt.format === 'sabotazh')) : []);
    const stage = el('div', { class: 'stack' }), side = el('div', { class: 'stack kp-sab-side' });
    host.append(el('div', { class: 'kp-stagebox' }, stage, side));
    async function act(body) {
      try { S.x = (await api('/api/teacher/sabotage', Object.assign({ code: code(), step: S.st && S.st.id }, body))).sabotage; beep('tick'); draw(); } catch (e) { toast(e.message, 'err'); }
    }
    async function load() { try { S.x = (await api('/api/teacher/sabotage?code=' + encodeURIComponent(code()))).sabotage; } catch (e) { toast(e.message, 'err'); } draw(); }
    function mount() {
      const x = S.x, key = x && x.phase ? `${x.round}` : 'none';
      if (key === S.key) return;
      S.key = key;
      if (S.h) { S.h.destroy(); S.h = null; }
      if (!x) { stage.replaceChildren(el('div', { class: 'card stack' }, el('h2', {}, '🕵 Саботаж'), el('p', { class: 'pj-sub' }, S.st.hunt.lead || 'Вы тайно выключите одну ручку донора. Класс смотрит игру на проекторе и угадывает с ноутбуков, что изменилось.'))); return; }
      S.h = Games.frame({ src: () => '/engine/game.html?game=../' + (x.game || S.st.game), key: () => 'sabotazh:' + x.round, cfg: x.cfg, score: false, label: `▶ Играть раунд ${x.round}` });
      stage.replaceChildren(S.h.box);
    }
    function draw() {
      const list = steps();
      if (!list.length) { host.replaceChildren(el('div', { class: 'card' }, el('h2', {}, 'В этом уроке нет саботажа'))); return; }
      S.st = list.find(s => S.x && s.id === S.x.step) || list[0];
      mount();
      const x = S.x, H = S.st.hunt, reveal = x && x.phase === 'reveal';
      const parts = [el('div', { class: 'eyebrow' }, '🕵 Саботаж' + (x ? ` · раунд ${x.round}` : '')), el('h2', {}, H.question)];
      if (!x) parts.push(el('p', { class: 'pj-sub' }, 'Сначала все сыграли донора как задумано. Нажмите — портал тайно выберет одну ручку из списка урока. Вы её не увидите до раскрытия.'),
        el('button', { class: 'btn warm', type: 'button', 'data-sab': 'start', onclick: () => act({ action: 'start' }) }, '🎲 Тайно повернуть одну ручку'));
      else if (!reveal) parts.push(el('p', { class: 'pj-sub' }, 'Играйте на проекторе или дайте сыграть ученику. Класс отвечает с ноутбуков.'),
        el('div', { class: 'kp-sab-n', 'data-sab-n': '' }, el('b', {}, String(x.n)), el('span', { class: 'pj-sub' }, ' ответили')),
        el('button', { class: 'btn warm', type: 'button', 'data-sab': 'reveal', onclick: () => act({ action: 'reveal' }) }, '🔓 Раскрыть'));
      else {
        const total = Math.max(1, x.counts.reduce((a, c) => a + c.n, 0)), right = x.counts.find(c => c.right) || { n: 0 };
        parts.push(el('div', { class: 'secret-reveal' }, el('div', { class: 'eyebrow' }, 'Выключено'), el('h3', { 'data-sab-label': '' }, x.label), el('p', {}, x.why)),
          el('div', { class: 'kp-opts' }, x.counts.map(c => el('div', { class: 'kp-opt' + (c.right ? ' right' : ' wrong') }, el('span', { class: 'grow' }, c.label), el('b', {}, String(c.n)),
            el('i', { class: 'teatr-bar', style: `width:${Math.round(100 * c.n / total)}%` })))),
          el('p', { class: 'pj-sub' }, `Раскусили ${right.n} из ${x.n}`),
          el('div', { class: 'row' }, el('button', { class: 'btn', type: 'button', 'data-sab': 'again', onclick: () => act({ action: 'start' }) }, '🎲 Ещё раунд'),
            el('button', { class: 'btn ghost small', type: 'button', 'data-sab': 'end', onclick: () => act({ action: 'end' }) }, '■ Закончить')));
      }
      side.replaceChildren(...parts);
    }
    load();
    return {
      event() { load(); },
      refresh() { load(); },
      destroy() { if (S.h) S.h.destroy(); host.replaceChildren(); },
    };
  }

  /* =================== цель класса (Д2) =================== */
  const REWARD_UI = [['zvezdopad', '🌠 Секретный донор «Звездопад над Фиштом»'], ['arena', '🏟 Режим арены «Арена класса»'], ['text', '🎁 Свой приз']];
  function goalStrip(goal) {
    if (!goal) return null;
    return el('div', { class: 'pj-goalstrip' + (goal.reached ? ' done' : '') }, el('span', {}, goal.reached ? '🎉' : '🎯'),
      el('div', { class: 'grow' }, el('b', {}, `${fmt(goal.count)} из ${fmt(goal.target)}`), el('span', { class: 'pj-sub' }, ' партий в игры друг друга'),
        el('div', { class: 'goal-track' }, el('i', { style: `width:${Math.round(100 * Math.min(1, goal.count / Math.max(1, goal.target)))}%` }))),
      el('span', { class: 'pj-sub' }, `${goal.reward.icon} ${goal.reached ? 'открыто' : 'награда'}`));
  }
  function goal(host, { code, get }) {
    let key = '';
    async function save(body) {
      try { await api('/api/teacher/goal', Object.assign({ code: code() }, body)); beep('done'); key = ''; return true; } catch (e) { toast(e.message, 'err'); return false; }
    }
    function draw(force) {
      const gl = get(), k = JSON.stringify(gl);
      if (!force && k === key) return;
      // поле ввода в фокусе — не перерисовываем форму, только счёт
      if (!force && host.contains(document.activeElement) && /INPUT|SELECT/.test(document.activeElement.tagName)) {
        const b = host.querySelector('[data-goal-big]'); if (b && gl) b.textContent = fmt(gl.count); return;
      }
      key = k;
      const target = el('input', { type: 'number', min: '5', max: '100000', step: '10', value: gl ? gl.target : 300, 'aria-label': 'Сколько партий', id: 'pjGoalTarget' });
      const reward = el('select', { 'aria-label': 'Награда', id: 'pjGoalReward' }, REWARD_UI.map(([id, label]) => el('option', { value: id, selected: gl && gl.reward.id === id ? true : null }, label)));
      const text = el('input', { type: 'text', maxlength: '80', placeholder: 'Например: 10 минут свободной аркады', value: gl && gl.reward.id === 'text' ? gl.reward.label : '', 'aria-label': 'Свой приз', id: 'pjGoalText' });
      const syncText = () => { text.hidden = reward.value !== 'text'; };
      reward.addEventListener('change', syncText); syncText();
      const form = el('div', { class: 'card stack pj-goalform' }, el('div', { class: 'eyebrow' }, gl ? 'Поменять цель' : 'Поставить цель классу'),
        el('div', { class: 'row' }, el('label', { class: 'lbl', for: 'pjGoalTarget', style: 'margin:0' }, 'Партий в игры друг друга'), target,
          ...[100, 300, 1000].map(n => el('button', { type: 'button', class: 'chipbtn', onclick: () => { target.value = n; } }, String(n)))),
        el('div', { class: 'row' }, el('label', { class: 'lbl', for: 'pjGoalReward', style: 'margin:0' }, 'Награда'), reward, text),
        el('div', { class: 'row' }, el('button', { class: 'btn', type: 'button', 'data-goal': 'save', onclick: async () => { if (await save({ target: target.value, reward: reward.value, text: text.value })) draw(true); } }, gl ? 'Сохранить' : '🎯 Поставить цель'),
          gl ? el('button', { class: 'btn ghost small', type: 'button', onclick: async () => { if (await Lab.ask('Начать счёт партий заново с нуля?', { ok: 'С нуля' }) && await save({ target: target.value, reward: reward.value, text: text.value, reset: true })) draw(true); } }, '↺ Счёт с нуля') : null,
          gl ? el('button', { class: 'btn ghost small', type: 'button', onclick: async () => { if (await save({ off: true })) draw(true); } }, '✕ Убрать цель') : null),
        el('p', { class: 'pj-sub' }, 'Считаются только партии в чужие игры: аркада, игра соседа, вызовы. Своя игра и игра своей команды цель не двигают.'));
      const big = gl ? el('div', { class: 'pj-goal' + (gl.reached ? ' done' : '') },
        el('div', { class: 'eyebrow' }, gl.reached ? 'Цель класса взята!' : 'Цель класса'),
        el('div', { class: 'pj-goalnum' }, el('b', { 'data-goal-big': '' }, fmt(gl.count)), el('span', {}, ` / ${fmt(gl.target)}`)),
        el('div', { class: 'pj-sub' }, 'партий в игры друг друга'),
        el('div', { class: 'goal-track big' }, el('i', { style: `width:${Math.round(100 * Math.min(1, gl.count / Math.max(1, gl.target)))}%` })),
        el('div', { class: 'pj-goalprize' }, el('span', { class: 'pj-sub' }, gl.reached ? 'Открыто для всех:' : 'Когда дойдём:'), el('h2', {}, `${gl.reward.icon} ${gl.reward.label}`), gl.reward.hint ? el('p', { class: 'pj-sub' }, gl.reward.hint) : null))
        : el('div', { class: 'stack' }, el('div', { class: 'eyebrow' }, 'Цель класса'), el('h1', {}, 'Сыграем в игры друг друга'), el('p', { class: 'pj-sub' }, 'Общая цель: партии в чужие игры. Дошли — открывается награда для всех.'));
      host.replaceChildren(el('div', { class: 'pj-goalgrid' }, big, form));
    }
    return { draw };
  }

  /* =================== живые реакции поверх игры (Д3) =================== */
  function reacts() {
    const layer = el('div', { class: 'pj-reacts', 'aria-hidden': 'true' });
    const tally = el('div', { class: 'pj-reacttally', hidden: true });
    document.body.append(layer, tally);
    const counts = {};
    let liveKey = null;
    return {
      reset(k) { if (k === liveKey) return; liveKey = k; Object.keys(counts).forEach(x => delete counts[x]); tally.hidden = true; },
      add(emoji) {
        const f = Games.shownFrame();
        if (!f) return null;
        counts[emoji] = (counts[emoji] || 0) + 1;
        tally.hidden = false;
        tally.replaceChildren(...Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([e, n]) => el('span', {}, `${e} ${n}`)));
        if (layer.childElementCount >= 30) return f; // экран не забиваем: лишние реакции только считаются
        const r = f.box.getBoundingClientRect();
        const b = el('span', { class: 'pj-react' + (calm() ? ' calm' : ''), style: `left:${Math.round(r.left + r.width * (0.08 + Math.random() * 0.84))}px;top:${Math.round(r.bottom - 60)}px;--dx:${Math.round((Math.random() - 0.5) * 80)}px;--h:${Math.round(r.height * 0.6)}px` }, emoji);
        layer.append(b); setTimeout(() => b.remove(), 2600);
        return f;
      },
    };
  }

  /* =================== галерея провалов и нарезка (Д5) =================== */
  function fails(host, { code }) {
    const S = { list: [], view: 'wall', i: 0, frame: null, key: '' };
    async function load() { try { S.list = (await api('/api/teacher/fails?code=' + encodeURIComponent(code()))).fails; } catch (e) { toast(e.message, 'err'); } draw(); }
    const stopFrame = () => { if (S.frame) { S.frame.destroy(); S.frame = null; } };
    function show(f, where) {
      stopFrame();
      S.frame = Games.frame({ src: () => `/play/${f.game}/${f.version}`, key: () => 'failgal:' + f.game, score: false, label: 'Показать баг', autostart: true,
        onError: err => S.frame && S.frame.message(el('b', {}, 'Игра упала: ' + (err.message || 'ошибка') + ' — и это тоже провал!')) });
      where.replaceChildren(S.frame.box, Games.bar(S.frame));
    }
    function card(f, i, big) {
      return el('article', { class: 'fail-card' + (big ? ' big' : ''), 'data-fail-key': f.key },
        el('div', { class: 'row', style: 'gap:6px' }, el('span', { class: 'tag' }, f.lesson ? `урок ${f.lesson}` : 'урок'), i < 3 && f.votes ? el('span', { class: 'tag warm' }, `🎬 №${i + 1}`) : null,
          el('span', { class: 'grow' }), el('span', { class: 'pj-sub' }, `😂 ${f.votes}`)),
        el('h3', {}, `«${f.title}» · ${f.nick}`), f.note ? el('p', {}, f.note) : null,
        f.why.length ? el('div', { class: 'row', style: 'gap:6px' }, f.why.map(w => el('span', { class: 'chip' }, w))) : null,
        f.moral ? el('p', { class: 'small' }, el('b', {}, 'Поняли: '), f.moral) : null);
    }
    function draw() {
      const k = JSON.stringify([S.list, S.view, S.i]);
      if (k === S.key) return;
      S.key = k; stopFrame();
      const top = S.list.slice(0, 5);
      const sw = el('div', { class: 'row pj-pollchips' }, [['wall', `🖼 Галерея провалов · ${S.list.length}`], ['reel', `🎬 Нарезка к Фестивалю · ${top.length}`]].map(([id, label]) =>
        el('button', { type: 'button', class: 'chipbtn' + (S.view === id ? ' on' : ''), 'data-fails-view': id, onclick: () => { S.view = id; S.i = 0; draw(); } }, label)));
      if (!S.list.length) { host.replaceChildren(sw, el('p', { class: 'pj-sub' }, 'Галерея пуста: провал попадает сюда, когда автор разрешил показать его в «Провале дня».')); return; }
      if (S.view === 'reel') {
        const i = Math.min(S.i, top.length - 1), f = top[i], stage = el('div', { class: 'pj-reelgame' });
        host.replaceChildren(sw, el('div', { class: 'pj-reel' },
          el('div', { class: 'stack' }, el('div', { class: 'eyebrow' }, `🎬 Нарезка лучших провалов · ${i + 1} из ${top.length}`), card(f, i, true),
            el('div', { class: 'row' }, el('button', { class: 'btn ghost', type: 'button', disabled: i === 0 || null, onclick: () => { S.i = i - 1; draw(); } }, '← Назад'),
              el('button', { class: 'btn', type: 'button', 'data-reel': 'next', disabled: i === top.length - 1 || null, onclick: () => { S.i = i + 1; beep('dice'); draw(); } }, 'Следующий провал →'))),
          stage));
        show(f, stage);
        return;
      }
      const stage = el('div', { class: 'pj-reelgame' });
      host.replaceChildren(sw, el('p', { class: 'pj-sub' }, 'Ученики голосуют за самый смешной в аркаде класса. Три лучших — в нарезку на Фестивале.'),
        stage, el('div', { class: 'fails-wall' }, S.list.map((f, i) => { const c = card(f, i); c.append(el('div', {}, el('button', { class: 'btn ghost small', type: 'button', onclick: () => show(f, stage) }, '▶ Показать ещё раз'))); return c; })));
    }
    load();
    return { load, reel() { S.view = 'reel'; S.i = 0; load(); }, destroy: stopFrame };
  }

  window.LabKlassPult = { teatr, goal, goalStrip, reacts, fails, sabotazh };
})();
