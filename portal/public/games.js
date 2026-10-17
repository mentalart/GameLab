// Общие помощники игр для страниц ученика, аркады и учителя: рамка-песочница, карточка игры аркады,
// вызов «побей мой мир», открытие плейтеста и отзыв учителя.
'use strict';
const Games = (() => {
  const { el, api, toast, copy, beep, valText } = Lab;
  const frames = [];

  /* ---------- рамка игры ---------- */
  // Игра идёт в изолированной рамке (sandbox без allow-same-origin). Одновременно работает только одна рамка: запуск новой ставит остальные на паузу.
  // key — ключ таблицы рекордов в классе (game:<id> — игра ученика, её партии идут в плейтест автора); info() — версия и код вызова для сервера.
  // score: false — партии не записываются (рамки учителя на проекторе и в карточке ученика).
  function frame({ src, key, info, cfg, label, onReady, onOver, onScore, onAgain, onError, autostart, score = true }) {
    const box = el('div', { class: 'gamebox' });
    const veil = el('div', { class: 'veil' });
    let iframe = null, timer = null, ready = false;
    const extra = () => (info ? info() || {} : {});
    const post = m => { try { iframe && iframe.contentWindow.postMessage(Object.assign({ target: 'lab-game' }, m), '*'); } catch (e) { /* рамка закрыта */ } };
    const postRecords = r => { const t = r.challenge || r; post({ type: 'records', record: t.record, best: t.mine }); };
    async function sendRecords() {
      const x = extra();
      try { postRecords(await api('/api/records?game=' + encodeURIComponent(key()) + (x.challenge ? '&challenge=' + encodeURIComponent(x.challenge) : ''))); } catch (e) { /* без рекордов */ }
    }
    function onMsg(e) {
      if (!iframe || e.source !== iframe.contentWindow) return;
      const m = e.data || {};
      if (m.source !== 'lab-game') return;
      if (m.type === 'ready') { ready = true; clearTimeout(timer); if (score) sendRecords(); if (cfg) post({ type: 'setCfg', cfg }); if (onReady) onReady(m.meta || {}); }
      if (m.type === 'over' && score) {
        api('/api/score', Object.assign({ game: key(), score: m.score, seed: m.seed, tele: m.tele }, extra()))
          .then(r => { postRecords(r); if (onScore) onScore(m, r); }).catch(() => {});
      }
      if (m.type === 'over' && onOver) onOver(m);
      if (m.type === 'again' && score) {
        if (/^game:/.test(key())) api('/api/play/again', { game: key().slice(5) }).catch(() => {});
      }
      if (m.type === 'again' && onAgain) onAgain(m);
      if (m.type === 'error') { clearTimeout(timer); if (onError) onError(m); }
    }
    addEventListener('message', onMsg);
    function showVeil(content) { veil.innerHTML = ''; veil.append(content); veil.hidden = false; }
    const h = {
      box,
      start() {
        frames.forEach(f => { if (f !== h) f.stop(); });
        h.stop(true);
        ready = false;
        iframe = el('iframe', { sandbox: 'allow-scripts allow-pointer-lock', allow: 'gamepad; fullscreen; autoplay', title: label || 'Игра', src: src() });
        box.prepend(iframe);
        veil.hidden = true;
        timer = setTimeout(() => { if (!ready && onError) onError({ phase: 'загрузка', message: 'игра не запустилась за 25 секунд' }); }, 25000);
        iframe.addEventListener('load', () => { try { iframe.focus(); } catch (e) { /* фокус по клику */ } });
      },
      stop(silent) {
        clearTimeout(timer);
        if (iframe) { iframe.remove(); iframe = null; }
        if (!silent) showVeil(el('button', { class: 'btn', type: 'button', onclick: () => h.start() }, '▶ ' + (label || 'Играть')));
      },
      message(content) { if (iframe) { iframe.remove(); iframe = null; } clearTimeout(timer); showVeil(content); },
      destroy() { removeEventListener('message', onMsg); h.stop(true); const i = frames.indexOf(h); if (i >= 0) frames.splice(i, 1); },
      fullscreen() { if (box.requestFullscreen) box.requestFullscreen().catch(() => {}); },
    };
    box.append(veil);
    frames.push(h);
    if (autostart) h.start(); else h.stop();
    return h;
  }
  function bar(h, extra) {
    return el('div', { class: 'gamebar' },
      el('span', {}, 'Кликни по игре, чтобы управлять. Tab — ручки, R — заново.'),
      el('span', { class: 'grow' }), extra || null,
      el('button', { class: 'btn ghost small', type: 'button', onclick: () => h.fullscreen() }, '⛶ На весь экран'));
  }
  function stopAll() { frames.slice().forEach(f => f.destroy()); }

  /* ---------- рамка игры учителя: вау-старт на проекторе и сравнение моделей ---------- */
  // get() — игра { id, current, versions }, set(g) — новая версия после починки. Упала — программист чинит сам (до 2 попыток),
  // запуск отмечается для отчёта «с первой попытки». demo() — портал без ключа: тогда не чиним.
  function teacherFrame({ get, set, label, autostart, demo, onOver }) {
    let tries = 0, fixing = false;
    const status = el('div', { class: 'small muted', 'aria-live': 'polite' });
    const g = () => get();
    const h = frame({
      src: () => `/play/${g().id}/${g().current}`, key: () => 'teacher:' + g().id, score: false, label, autostart, onOver,
      onReady: () => { status.textContent = `Версия ${g().current} запущена.`; api('/api/teacher/game/ran', { game: g().id, version: g().current }).catch(() => {}); },
      onError: async err => {
        const n = g().current;
        if (tries >= 2 || (demo && demo())) {
          api('/api/teacher/game/fix', { game: g().id, version: n, error: err, report: true }).catch(() => {});
          h.message(el('div', { class: 'stack', style: 'align-items:center' }, el('b', {}, 'Игра упала: ' + (err.message || 'ошибка')),
            el('p', { class: 'muted small' }, demo && demo() ? 'В демо-режиме программист не чинит ошибки.' : 'Программист не смог починить за 2 попытки.'),
            el('button', { class: 'btn ghost small', type: 'button', onclick: () => { tries = 0; h.start(); } }, '↻ Попробовать ещё раз')));
          return;
        }
        tries++;
        const p = el('p', {}, `Игра упала: ${err.message || 'ошибка'}. Программист чинит — попытка ${tries} из 2…`);
        h.message(el('div', { class: 'progress' }, el('div', { class: 'spinner' }), p));
        fixing = true;
        try {
          const r = await Lab.job('/api/teacher/game/fix', { game: g().id, version: n, error: { phase: err.phase, message: err.message, line: err.line } }, j => { p.textContent = `Программист чинит «${err.message}» — попытка ${tries} из 2… ${j.seconds} с`; });
          set(r.game); status.textContent = `Починил: версия ${r.version}.`; h.start();
        } catch (e) { h.message(el('p', {}, 'Починка не удалась: ' + e.message)); }
        fixing = false;
      },
    });
    // fixing — идёт починка: снаружи рамку не пересоздавать, новую версию она запустит сама
    return { h, status, get fixing() { return fixing; }, reset() { tries = 0; } };
  }

  /* ---------- карточка игры аркады ---------- */
  const hue = id => [...String(id)].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 360, 7);
  function cover(c) {
    const h = hue(c.id);
    return el('div', { class: 'cover', style: `background:linear-gradient(140deg,hsl(${h} 65% 34%),hsl(${(h + 50) % 360} 70% 16%))` },
      el('h3', { class: 'cv-title' }, c.title), el('span', { class: 'cv-ver' }, 'v' + c.version));
  }
  const DEC = [['feeling', 'Чувство'], ['honesty', 'Честность'], ['choice', 'Выбор']];
  function recordLine(c) {
    return c.record && c.record.score > 0
      ? el('div', { class: 'small rec' }, '🏆 Рекорд класса: ', el('b', {}, String(c.record.score)), ` · ${c.record.nick}`)
      : el('div', { class: 'small muted' }, '🏆 Рекорд класса пока не поставлен');
  }
  // карточка: обложка, название, автор, донор, «Что решил я», версия, рекорд класса; actions — кнопки внизу
  function card(c, { actions, compact, extra } = {}) {
    const dec = DEC.filter(([k]) => valText((c.decisions || {})[k]));
    const tags = [c.hidden ? el('span', { class: 'tag' }, 'скрыта автором') : null, c.mine ? el('span', { class: 'tag own' }, 'моя') : null].filter(Boolean);
    return el('article', { class: 'acard' + (compact ? ' compact' : '') + (c.hidden ? ' hidden-game' : ''), 'data-game': c.id },
      compact ? null : cover(c),
      el('div', { class: 'stack', style: 'gap:6px' },
        compact ? el('div', { class: 'row', style: 'gap:6px' }, el('h3', { class: 'grow' }, c.title), tags) : tags.length ? el('div', { class: 'row', style: 'gap:6px' }, tags) : null,
        el('div', { class: 'small muted' }, `автор: ${c.nick}` + (c.lesson ? ` · урок ${c.lesson.number}` : '') + ` · версия ${c.version}`),
        c.donor ? el('div', { class: 'small donor-line' }, `по мотивам механики ${c.donor}`) : null,
        dec.length ? el('div', { class: 'decided' }, el('div', { class: 'eyebrow' }, 'Что решил я'),
          el('ul', {}, dec.map(([k, label]) => el('li', {}, el('b', {}, label + ': '), valText(c.decisions[k]))))) : null,
        recordLine(c), extra || null,
        actions ? el('div', { class: 'row', style: 'gap:8px;margin-top:4px' }, actions) : null));
  }
  // табло: рекорд автора, мой лучший, рекорд класса
  function scores(c) {
    const tile = (label, value, sub) => el('div', { class: 'stat' }, el('b', {}, String(value)), el('span', {}, label), sub ? el('small', {}, sub) : null);
    return el('div', { class: 'scores' },
      tile('рекорд автора', c.authorBest || 0, c.nick),
      tile('твой лучший', c.myBest || 0, c.myBest > (c.authorBest || 0) && c.myBest > 0 ? 'рекорд автора побит!' : null),
      tile('рекорд класса', c.record ? c.record.score : 0, c.record ? c.record.nick : '—'));
  }

  /* ---------- вызов «побей мой мир» ---------- */
  // после партии: игра + версия + зерно → короткий код и ссылка; друг играет в тот же мир и бьёт мой счёт
  function challenge(c, over) {
    const host = el('div', { class: 'challenge' });
    if (!over) return host;
    const btn = el('button', { class: 'btn warm', type: 'button' }, `⚔ Вызов: побей мой мир (${over.score} очков)`);
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const r = await api('/api/challenge', { game: c.id, version: c.version, seed: over.seed, score: over.score });
        const url = location.origin + r.url;
        const text = `Побей мой мир в «${c.title}»: ${over.score} очков. Код вызова ${r.code} — введи его в аркаде класса или открой ${url}`;
        host.innerHTML = '';
        host.append(el('div', { class: 'row' },
          el('div', { class: 'stack', style: 'gap:2px' }, el('div', { class: 'eyebrow' }, 'Код вызова'), el('div', { class: 'chcode' }, r.code)),
          el('div', { class: 'grow small muted' }, `Тот же мир (зерно ${r.seed}), версия ${r.version}. Код работает в аркаде класса, ссылка — на любом компьютере класса.`, el('br'), el('a', { href: r.url, target: '_blank', rel: 'noopener' }, url)),
          el('button', { class: 'btn ghost small', type: 'button', onclick: () => copy(text) }, '⧉ Скопировать вызов')));
        beep('good');
      } catch (e) { toast(e.message, 'err'); btn.disabled = false; }
    });
    host.append(el('div', { class: 'row' }, btn, el('span', { class: 'muted small' }, 'Код и ссылка «побей мой мир»: тот же мир для друга, кто наберёт больше?')));
    return host;
  }

  /* ---------- открытие плейтеста и отзыв учителя ---------- */
  const pct = x => Math.round((x || 0) * 100) + '%';
  function discovery(d, { who = 'Игроки' } = {}) {
    const box = el('div', { class: 'stack discovery' });
    if (!d || (!d.rounds && !d.cards.length)) { box.append(el('p', { class: 'muted' }, 'Пока никто из класса не играл в эту игру. Открытие появится после первых партий соседей.')); return box; }
    const tile = (value, label) => el('div', { class: 'stat' }, el('b', {}, String(value)), el('span', {}, label));
    box.append(el('div', { class: 'scores' }, tile(d.rounds, 'партий сыграли чужие игроки'), tile(d.players, 'игроков'), tile(d.again, 'раз нажали «ещё раз»')));
    if (d.dominant) {
      const strong = d.dominant.share >= 0.5;
      box.append(el('p', { class: 'concept' }, el('b', {}, 'Открытие плейтеста. '),
        `${who} дольше всего держали ${d.dominant.name}: ${pct(d.dominant.share)} времени партии. `,
        strong ? 'Похоже на доминирующую стратегию: одна кнопка решает почти всё. Дай ей цену или противовес.' : 'Явной доминирующей стратегии нет: игроки пробовали разное.'));
      box.append(el('div', { class: 'bars' }, d.holds.slice(0, 4).map(hd => el('div', { class: 'barrow' },
        el('span', { class: 'bl' }, hd.name), el('span', { class: 'bt' }, el('i', { style: `width:${Math.max(2, Math.round(hd.share * 100))}%` })), el('b', {}, pct(hd.share))))));
    } else if (d.rounds) box.append(el('p', { class: 'muted small' }, 'Кнопки почти не держали: партии были короткими.'));
    const extra = [];
    if (d.presses.a || d.presses.b) extra.push(`Нажатий: A — ${d.presses.a}, B — ${d.presses.b}`);
    if (d.custom.length) extra.push(d.custom.map(c => `${c.name}: ${c.value}`).join(' · '));
    if (d.best) extra.push(`Лучший счёт чужого игрока: ${d.best}`);
    if (extra.length) box.append(el('div', { class: 'small muted' }, extra.join('. ')));
    const emo = Object.entries(d.emotions || {}).sort((a, b) => b[1] - a[1]);
    if (emo.length) box.append(el('div', { class: 'row', style: 'gap:6px' }, emo.map(([e, n]) => el('span', { class: 'chip' }, `${e} ×${n}`))));
    d.cards.forEach(c => box.append(el('div', { class: 'ptcard' },
      el('div', { class: 'row small' }, el('b', {}, c.nick), (c.emotions || []).map(e => el('span', { class: 'chip' }, e))),
      [['like', 'Нравится'], ['want', 'Хочется'], ['whatif', 'А что если']].filter(([k]) => valText(c[k])).map(([k, label]) =>
        el('div', { class: 'small' }, el('b', {}, label + ': '), valText(c[k]), c[k].dice ? el('span', { class: 'tag dice', style: 'margin-left:6px' }, '[кубик]') : null)))));
    return box;
  }
  function feedback(fb) {
    if (!fb) return el('p', { class: 'muted small' }, 'Отзыв учителя появится здесь, когда учитель посмотрит твою игру.');
    return el('div', { class: 'feedback' }, el('div', { class: 'eyebrow' }, 'Отзыв учителя'),
      el('div', {}, el('b', {}, 'Понятие: '), valText(fb.concept)),
      el('div', {}, el('b', {}, 'Вопрос: '), valText(fb.question)));
  }

  return { frames, frame, teacherFrame, bar, stopAll, card, scores, challenge, discovery, feedback };
})();
