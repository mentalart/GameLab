// Общие помощники игр для страниц ученика, аркады и учителя: рамка-песочница, карточка игры аркады,
// вызов «побей мой мир» (кнопка, игра по вызову с призраком, доска вызовов), связка карт вау-старта, открытие плейтеста и отзыв учителя.
'use strict';
const Games = (() => {
  const { el, api, toast, copy, beep, valText } = Lab;
  const frames = [];

  /* ---------- рамка игры ---------- */
  // Игра идёт в изолированной рамке (sandbox без allow-same-origin). Одновременно работает только одна рамка: запуск новой ставит остальные на паузу.
  // key — ключ таблицы рекордов в классе (game:<id> — игра ученика, её партии идут в плейтест автора); info() — версия и код вызова для сервера.
  // score: false — партии не записываются (рамки учителя на проекторе и в карточке ученика).
  // data — данные для игры (lab.data), например мелодия из секвенсора; уходят до cfg
  // challenge — под игрой есть кнопка вызова (оболочка пишет о ней на экране конца партии), ghost — призрак соперника { nick, score, line }.
  // reveal — название спрятанной механики: оболочка зажигает лупу на каждом срабатывании _secret (урок 1). pair — имя пары рамок, которые идут
  // одновременно (проектор «Спрятанная механика рядом»): запуск одной не останавливает другую. onShow — ход и итог показа бота (botShow).
  // onLevels — игра сообщила свои уровни и легенду (модуль 4, portal.levels / lab.levels), onLevel — начался уровень, onClear — уровень пройден.
  // onNet — игра сообщила положение игрока для сети класса (lab.net.send, урок 26); ответ сервера уходит в игру через post({ type: 'net', ... }).
  function frame({ src, key, info, cfg, data, label, onReady, onOver, onScore, onAgain, onError, onPlaytest, onPlaytestStep, onPoster, onShow, onLevels, onLevel, onClear, onNet, autostart, score = true, challenge, ghost, reveal, pair }) {
    const box = el('div', { class: 'gamebox' });
    const veil = el('div', { class: 'veil' });
    let iframe = null, timer = null, ready = false, roundAt = 0; // roundAt — начало партии: секунда партии для реакций класса на проекторе (Д3)
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
      if (['ready', 'start', 'again', 'over'].includes(m.type)) roundAt = performance.now();
      if (m.type === 'ready') { ready = true; clearTimeout(timer); h.meta = m.meta || {}; h.changed = {}; if (score) sendRecords(); if (data) post({ type: 'data', data }); if (cfg) post({ type: 'setCfg', cfg }); if (reveal) post({ type: 'reveal', title: reveal }); if (challenge) post({ type: 'challengeOn' }); if (ghost) post({ type: 'ghost', ghost }); if (onReady) onReady(m.meta || {}); if (h.onCfg) h.onCfg(h.changed); }
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
      // ручки, повёрнутые в игре (Tab), относительно «Как задумано» — для «Сохранить мой баланс» и эксперимента с ручкой
      if (m.type === 'poster' && onPoster && m.data) onPoster(m.data);
      if (m.type === 'cfg') { h.changed = m.cfg || {}; if (h.onCfg) h.onCfg(h.changed); }
      if (m.type === 'playtestStep' && onPlaytestStep) onPlaytestStep(m);
      if (m.type === 'playtest' && onPlaytest) onPlaytest(m);
      if ((m.type === 'showStep' || m.type === 'showDone') && onShow) onShow(m);
      if (m.type === 'levels') { h.levels = { legend: m.legend || {}, list: Array.isArray(m.list) ? m.list : [], playing: m.playing || [] }; if (onLevels) onLevels(h.levels); }
      if (m.type === 'level' && onLevel) onLevel(m);
      if (m.type === 'clear' && onClear) onClear(m);
      if (m.type === 'net' && onNet) onNet(m); // сеть класса (урок 26): положение игрока для арены
    }
    addEventListener('message', onMsg);
    function showVeil(content) { veil.innerHTML = ''; veil.append(content); veil.hidden = false; }
    const h = {
      box,
      start() {
        frames.forEach(f => { if (f !== h && !(pair && f.pair === pair)) f.stop(); });
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
      post,
      meta: null, changed: {}, onCfg: null, pair: pair || null, levels: null, label: label || '',
      get ready() { return ready; },
      get src() { return iframe ? iframe.getAttribute('src') : null; },
      get shown() { return !!(iframe && iframe.isConnected && iframe.offsetParent); }, // рамка с игрой видна на странице (не на скрытой вкладке)
      sec() { return ready ? Math.max(0, Math.round((performance.now() - roundAt) / 1000)) : 0; },
    };
    box.append(veil);
    frames.push(h);
    if (autostart) h.start(); else h.stop();
    return h;
  }
  // адрес игры с уровнями гостей (модуль 4): mode 'only' — только эти уровни (проба в редакторе, галерея), 'add' — после своих
  function withLevels(src, list, mode = 'only') {
    if (!list || !list.length) return src;
    const json = JSON.stringify({ mode, list: list.map(x => ({ name: x.name, map: x.map, author: x.author || '' })) });
    const b64 = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return src + (src.includes('?') ? '&' : '?') + 'levels=' + b64;
  }
  function bar(h, extra) {
    return el('div', { class: 'gamebar' },
      el('span', {}, 'Кликни по игре, чтобы управлять. Tab — ручки, R — заново.'),
      el('span', { class: 'grow' }), extra || null,
      el('button', { class: 'btn ghost small', type: 'button', onclick: () => h.fullscreen() }, '⛶ На весь экран'));
  }
  function stopAll() { frames.slice().forEach(f => f.destroy()); }
  // игра, которая сейчас видна на странице (проектор: какую игру смотрит класс — для живых реакций, Д3)
  function shownFrame() { return frames.find(f => f.shown) || null; }

  /* ---------- рамка игры учителя: вау-старт на проекторе ---------- */
  // get() — игра { id, current, versions }, set(g) — новая версия после починки. Упала — программист чинит сам (до 2 попыток),
  // починка — сообщение Qwen в тот же чат; запуск отмечается для отчёта «с первой попытки».
  function teacherFrame({ get, set, label, autostart, onOver }) {
    let tries = 0, fixing = false;
    const status = el('div', { class: 'small muted', 'aria-live': 'polite' });
    const g = () => get();
    const h = frame({
      src: () => `/play/${g().id}/${g().current}`, key: () => 'teacher:' + g().id, score: false, label, autostart, onOver,
      onReady: () => { status.textContent = `Версия ${g().current} запущена.`; api('/api/teacher/game/ran', { game: g().id, version: g().current }).catch(() => {}); },
      onError: async err => {
        const n = g().current;
        if (tries >= 2) {
          api('/api/teacher/game/fix', { game: g().id, version: n, error: err, report: true }).catch(() => {});
          h.message(el('div', { class: 'stack', style: 'align-items:center' }, el('b', {}, 'Игра упала: ' + (err.message || 'ошибка')),
            el('p', { class: 'muted small' }, 'Программист не смог починить за 2 попытки.'),
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
    // кадр из игры автора, пока его нет — цветная обложка по id
    const bg = `linear-gradient(140deg,hsl(${h} 65% 34%),hsl(${(h + 50) % 360} 70% 16%))`;
    return el('div', { class: 'cover' + (c.poster ? ' shot' : ''), style: c.poster ? `background:linear-gradient(180deg,transparent 40%,#000a),url("${c.poster}") center/cover,${bg}` : `background:${bg}` },
      el('h3', { class: 'cv-title' }, c.title), el('span', { class: 'cv-ver' }, 'v' + c.version));
  }
  const DEC = [['feeling', 'Чувство'], ['honesty', 'Честность'], ['choice', 'Выбор']];
  const plural = (n, one, few, many) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many; };
  function recordLine(c) {
    return c.record && c.record.score > 0
      ? el('div', { class: 'small rec' }, '🏆 Рекорд класса: ', el('b', {}, String(c.record.score)), ` · ${c.record.nick}`)
      : el('div', { class: 'small muted' }, '🏆 Рекорд класса пока не поставлен');
  }
  // карточка: обложка, название, автор, донор, «Что решил я», версия, рекорд класса; actions — кнопки внизу
  function card(c, { actions, compact, extra } = {}) {
    const dec = DEC.filter(([k]) => valText((c.decisions || {})[k]));
    const tags = [c.release ? el('span', { class: 'tag ok release', title: 'Релиз модуля: ' + (c.release.note || '') }, `версия 1.0 · релиз (v${c.release.version})`) : null,
      c.hidden ? el('span', { class: 'tag' }, 'скрыта автором') : null, c.mine ? el('span', { class: 'tag own' }, 'моя') : null].filter(Boolean);
    return el('article', { class: 'acard' + (compact ? ' compact' : '') + (c.hidden ? ' hidden-game' : ''), 'data-game': c.id },
      compact ? null : cover(c),
      el('div', { class: 'stack', style: 'gap:6px' },
        compact ? el('div', { class: 'row', style: 'gap:6px' }, el('h3', { class: 'grow' }, c.title), tags) : tags.length ? el('div', { class: 'row', style: 'gap:6px' }, tags) : null,
        el('div', { class: 'small muted' }, `автор: ${c.emblem ? c.emblem + ' ' : ''}${c.nick}` + (c.lesson ? ` · урок ${c.lesson.number}` : '') + ` · версия ${c.version}`),
        c.donor ? el('div', { class: 'small donor-line' }, `по мотивам механики ${c.donor}`) : null,
        dec.length ? el('div', { class: 'decided' }, el('div', { class: 'eyebrow' }, 'Что решил я'),
          el('ul', {}, dec.map(([k, label]) => el('li', {}, el('b', {}, label + ': '), valText(c.decisions[k]))))) : null,
        el('div', { class: 'again-line' + (c.again ? '' : ' none'), title: 'Сколько раз чужие игроки сами нажали «ещё раз» — главный тест игры' }, el('b', {}, String(c.again || 0)), c.again ? ` ${plural(c.again, 'раз', 'раза', 'раз')} сыграли ещё` : ' — пока никто не вернулся сыграть ещё'),
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
  // после партии: игра (донор — по шагу step, игра класса, учителя или ученика — по id и версии) + зерно + ручки → код вызова.
  // Вызов сам появляется на доске вызовов у одноклассников, счёт по секундам (tele.line) становится призраком соперника.
  function challenge(t, over) {
    const host = el('div', { class: 'challenge' });
    if (!over) return host;
    const btn = el('button', { class: 'btn warm', type: 'button' }, `⚔ Вызов: побей мой мир (${over.score} очков)`);
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const body = Object.assign(t.step ? { step: t.step } : { game: t.id, version: t.version }, { seed: over.seed, score: over.score, cfg: over.cfg, line: (over.tele || {}).line });
        const r = await api('/api/challenge', body);
        const url = location.origin + r.url;
        const text = `Побей мой мир в «${r.challenge.title}»: ${over.score} очков. Код вызова ${r.code} — введи его в аркаде класса или открой ${url}`;
        host.innerHTML = '';
        host.append(el('div', { class: 'row' },
          el('div', { class: 'stack', style: 'gap:2px' }, el('div', { class: 'eyebrow' }, 'Код вызова'), el('div', { class: 'chcode' }, r.code)),
          el('div', { class: 'grow small muted' }, `Вызов уже на доске вызовов у всего класса: тот же мир (зерно ${r.seed}), кто наберёт больше? Код и ссылка — для аркады и другого компьютера класса.`, el('br'), el('a', { href: r.url, target: '_blank', rel: 'noopener' }, url)),
          el('button', { class: 'btn ghost small', type: 'button', onclick: () => copy(text) }, '⧉ Скопировать вызов'),
          el('button', { class: 'btn ghost small', type: 'button', 'data-postcard': '1', onclick: () => postcard({ title: r.challenge.title, code: r.code, score: over.score, line: (over.tele || {}).line, poster: t.poster }) }, '🖼 Открытка')));
        beep('good');
      } catch (e) { toast(e.message, 'err'); btn.disabled = false; }
    });
    host.append(el('div', { class: 'row' }, btn, el('span', { class: 'muted small' }, 'Тот же мир для всего класса: вызов появится у одноклассников на доске вызовов.')));
    return host;
  }

  // открытка вызова: картинка 1200×630 с обложкой игры, кодом и полоской партии — её можно отправить другу или повесить в чат класса
  async function postcard({ title, code, score, line, poster }) {
    const W = 1200, H = 630, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#1E2447'); g.addColorStop(1, '#0b1020');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (poster) await new Promise(res => { const im = new Image(); im.onload = () => { c.globalAlpha = 0.55; c.drawImage(im, 0, 0, W, H * 0.62); c.globalAlpha = 1; res(); }; im.onerror = res; im.src = poster; });
    const sh = c.createLinearGradient(0, H * 0.3, 0, H); sh.addColorStop(0, 'rgba(11,16,32,0)'); sh.addColorStop(0.5, 'rgba(11,16,32,.95)'); c.fillStyle = sh; c.fillRect(0, 0, W, H);
    c.fillStyle = '#FFC51F'; c.font = '700 30px system-ui, sans-serif'; c.fillText('ПОБЕЙ МОЙ МИР', 60, 330);
    c.fillStyle = '#f2efe6'; c.font = '800 64px system-ui, sans-serif'; c.fillText(String(title || 'Моя игра').slice(0, 30), 60, 405);
    c.font = '700 40px system-ui, sans-serif'; c.fillText(`${score} очков — сможешь больше?`, 60, 470);
    c.fillStyle = '#7cf5a8'; c.font = '900 96px ui-monospace, Consolas, monospace'; c.fillText(code, 60, 580);
    c.fillStyle = '#9aa3c7'; c.font = '26px system-ui, sans-serif'; c.fillText('код вызова · аркада класса · Лаборатория игр', 470, 572);
    if (Array.isArray(line) && line.length > 1) {
      const max = Math.max(1, ...line), x0 = 720, y0 = 300, w = 420, h = 120;
      c.strokeStyle = '#7cf5a8'; c.lineWidth = 5; c.beginPath();
      line.forEach((v, i) => { const x = x0 + i / (line.length - 1) * w, y = y0 + h - v / max * h; if (i) c.lineTo(x, y); else c.moveTo(x, y); });
      c.stroke();
    }
    const a = document.createElement('a'); a.download = `вызов ${code}.png`; a.href = cv.toDataURL('image/png'); document.body.append(a); a.click(); a.remove();
    toast('Открытка сохранена: отправь её тому, кого вызываешь', 'ok');
  }

  // игра по вызову: тот же мир и ручки, призрак лидера сверху в игре, таблица вызова. После партии призрак обновляется (новый лидер — новый призрак).
  function challengeStage(r, { onClose } = {}) {
    let ch = r.challenge;
    const box = el('div', { class: 'stack chstage' });
    const head = el('p', { class: 'concept' }), topHost = el('div', { class: 'small' });
    const ghostOf = c => (c.ghost && c.status === 'lead' ? Object.assign({}, c.ghost, { nick: 'твой рекорд' }) : c.ghost);
    const showHead = () => {
      head.textContent = ch.day ? `🌍 Мир дня: весь класс играет один и тот же мир №${ch.seed}. ` + (ch.ghost ? `Лидер — ${ch.leader.nick}, ${ch.leader.score}. Сверху в игре — его счёт на той же секунде.` : 'Лидера пока нет — стань первым!')
        : ch.status === 'lead' ? `🏆 Ты лидер этого мира: ${ch.leader.score}. Сверху в игре — твой рекорд на той же секунде. Сможешь больше?`
        : `⚔ Лидер мира №${ch.seed} — ${ch.leader.nick}: ${ch.leader.score} очков. У тебя тот же мир — побей!` + (ch.ghost ? ' Сверху в игре — его счёт на той же секунде.' : '');
    };
    const showTop = list => { topHost.innerHTML = ''; if (list && list.length) topHost.append(el('b', {}, 'Таблица вызова: '), list.slice(0, 5).map((x, i) => `${i + 1}. ${x.nick} — ${x.score}`).join(' · ')); };
    const h = frame({
      src: () => ch.src, key: () => ch.key, info: () => ({ version: ch.version, challenge: ch.code }), cfg: ch.cfg && Object.keys(ch.cfg).length ? ch.cfg : null,
      ghost: ghostOf(ch), label: ch.day ? 'Играть в мир дня' : 'Принять вызов', autostart: true,
      onScore: async (m, res) => {
        if (res.challenge) showTop(res.challenge.top);
        if (m.score > ch.leader.score && ch.status !== 'lead') { beep('done'); toast(ch.day ? `Ты лидер мира дня: ${m.score}!` : `Вызов выигран: ${m.score} против ${ch.leader.score}!`, 'ok'); }
        try { ch = (await api('/api/challenge?code=' + encodeURIComponent(ch.code))).challenge; showHead(); h.post({ type: 'ghost', ghost: ghostOf(ch) }); } catch (e) { /* без обновления */ }
      },
      onError: err => h.message(el('b', {}, 'Игра упала: ' + (err.message || 'ошибка') + '. Скажи автору.')),
    });
    showHead(); showTop(r.records ? r.records.top : ch.top);
    box.append(el('div', { class: 'row' }, el('div', { class: 'grow stack', style: 'gap:2px' },
      el('div', { class: 'eyebrow' }, ch.day ? 'Мир дня от учителя' : `Вызов ${ch.code} от ${ch.nick}`), el('h2', {}, ch.title)),
    onClose ? el('button', { class: 'btn ghost small', type: 'button', onclick: () => { h.destroy(); onClose(); } }, '✕ Закрыть') : null),
    head, h.box, bar(h), topHost);
    box.frame = h;
    return box;
  }
  // вызов в окне поверх урока: страница ученика не уходит с шага
  async function openChallenge(code) {
    let r;
    try { r = await api('/api/challenge?code=' + encodeURIComponent(code)); } catch (e) { toast(e.message, 'err'); return; }
    const dlg = el('dialog', { class: 'chdlg', 'aria-label': 'Вызов' });
    const stage = challengeStage(r, { onClose: () => dlg.close() });
    dlg.append(stage);
    dlg.addEventListener('close', () => { stage.frame.destroy(); dlg.remove(); });
    document.body.append(dlg); dlg.showModal();
  }

  /* ---------- доска вызовов класса ---------- */
  // вызовы одноклассников и мир дня: «принять», «отыграться», «ты лидер». Обновляется по событию challenge (challengeEvent).
  const BOARD_ORDER = { day: 0, beaten: 1, new: 2, lead: 3 };
  function board({ open = openChallenge } = {}) {
    const host = el('section', { class: 'chboard', hidden: true, 'aria-label': 'Доска вызовов класса' });
    let all = false, list = [];
    function row(c) {
      const t = `«${c.title}»`;
      const [ico, text, label] = c.status === 'day' ? ['🌍', `Мир дня: ${t} — весь класс играет один мир. ` + (c.ghost ? `Лидер: ${c.leader.nick} — ${c.leader.score}` : 'Лидера пока нет'), '▶ Играть']
        : c.status === 'beaten' ? ['😤', `Тебя обогнали в ${t}: ${c.leader.nick} — ${c.leader.score}, у тебя ${c.mine}`, '↺ Отыграться']
        : c.status === 'lead' ? ['🏆', c.top.length < 2 ? `Твой вызов ${t}: ${c.leader.score} — ждём соперников` : `Ты лидер в ${t}: ${c.leader.score}`, 'Ещё раз']
        : ['⚔', `${c.nick} вызывает: ${c.score} в ${t}` + (c.leader.nick !== c.nick ? ` · лидер ${c.leader.nick} — ${c.leader.score}` : ''), 'Принять'];
      return el('div', { class: 'chrow ' + c.status, 'data-code': c.code },
        el('span', { class: 'ico', 'aria-hidden': 'true' }, ico), el('span', { class: 'grow' }, text),
        el('button', { class: 'btn small' + (c.status === 'lead' ? ' ghost' : ' warm'), type: 'button', onclick: () => open(c.code) }, label));
    }
    function draw() {
      host.innerHTML = '';
      host.hidden = !list.length;
      if (!list.length) return;
      const sorted = list.slice().sort((a, b) => BOARD_ORDER[a.status] - BOARD_ORDER[b.status]);
      host.append(el('div', { class: 'row', style: 'gap:8px' }, el('div', { class: 'eyebrow grow' }, '⚔ Доска вызовов класса'),
        sorted.length > 3 ? el('button', { class: 'btn ghost small', type: 'button', onclick: () => { all = !all; draw(); } }, all ? 'Свернуть' : `Все вызовы (${sorted.length})`) : null),
      ...(all ? sorted : sorted.slice(0, 3)).map(row));
    }
    host.refresh = async () => { try { list = (await api('/api/challenges')).list; } catch (e) { return; } draw(); };
    host.refresh();
    return host;
  }
  // событие challenge: доска обновляется, обойдённому лидеру — «отыграйся», всем — «мир дня»
  function challengeEvent(d, me, b) {
    if (b) b.refresh();
    if (d.kind === 'lead' && d.loser && d.loser === me) { beep('bad'); toast(`Тебя обогнали в «${d.title}»: ${d.nick} — ${d.score}, у тебя ${d.loserScore}. Отыграйся — кнопка на доске вызовов!`, 'err', 7000); }
    if (d.kind === 'day') { beep('done'); toast(`Учитель дал мир дня: «${d.title}». Весь класс играет один мир — кнопка на доске вызовов.`, 'ok', 7000); }
  }

  /* ---------- вау-старт: связка карт от ИИ — «Гейм дизайн документ» (панель учителя и проектор) ---------- */
  // геймдизайнер сводит карты вау-старта в одну игру: фраза, главный цикл, поворот × действие, смешной момент.
  // Учитель принимает связку или просит другую; принятая уходит программисту вместе с картами. onChange — перерисовать вкладку.
  // строки связки под фразой игры (как LINK_FIELDS в lib/ai.js): ключ, подпись, подсказка для правки учителем
  const LINK_ROWS = [['frame', 'Жанр и камера', 'Жанр с карты действия: арена, изометрия / ловля / бег навстречу / вид сбоку / тир'], ['controls', 'Что делает герой и кнопки контроллера', 'Движение — …, A — …, B — …'],
    ['loop', 'Главный цикл', 'Каждые 2–4 секунды игрок …'], ['risk', 'Риск и очки', 'Рискнул — очки ×2: …'], ['threats', 'Угрозы', '2–3 угрозы, разные по поведению; жизнь отнимает …'],
    ['curve', 'Нарастание', 'К 30-й секунде …, к 60-й …, к 90-й …'], ['twist', 'Твист × действие', 'Твист мешает …, но и помогает …'], ['funny', 'Смешной момент', 'Класс смеётся, когда …']];
  function linkBox({ link, ready, editable, code, onChange }) {
    const box = el('div', { class: 'linkbox' + (link && link.accepted ? ' ok' : '') });
    if (!ready || (!link && !editable)) { box.hidden = true; return box; }
    const ask = async btn => {
      btn.disabled = true;
      try { await Lab.job('/api/teacher/wow/link', { code }, j => { btn.textContent = `🧠 Геймдизайнер пишет документ… ${j.seconds} с`; }); beep('good'); } catch (e) { toast(e.message, 'err'); }
      onChange();
    };
    const act = async accepted => { try { await api('/api/teacher/wow/link/accept', { code, accepted }); if (accepted) beep('done'); } catch (e) { toast(e.message, 'err'); } onChange(); };
    const askBtn = label => { const b = el('button', { class: 'btn' + (link ? ' ghost' : ''), type: 'button' }, label); b.addEventListener('click', () => ask(b)); return b; };
    // ручная правка учителем: четыре поля связки; сохранённая связка сразу принята
    const editForm = () => {
      box.innerHTML = ''; box.classList.add('editing');
      const fields = [['phrase', 'Фраза игры', 'Ты — …, ты … в …, но … Цель — …', 3], ...LINK_ROWS.map(([k, label, ph]) => [k, label, ph, 2])];
      const inputs = {};
      box.append(el('div', { class: 'eyebrow' }, 'Гейм дизайн документ · правка учителя'),
        ...fields.map(([k, label, ph, rows]) => el('label', { class: 'stack', style: 'gap:2px' }, el('b', { class: 'small' }, label),
          inputs[k] = el('textarea', { rows, placeholder: ph, maxlength: 400, 'data-link': k }, (link && link[k]) || ''))));
      const save = el('button', { class: 'btn warm', type: 'button' }, '✓ Сохранить и принять');
      save.addEventListener('click', async () => {
        const data = {}; for (const k in inputs) data[k] = inputs[k].value.trim();
        if (!data.phrase) { toast('Нужна хотя бы фраза игры', 'err'); inputs.phrase.focus(); return; }
        save.disabled = true;
        try { await api('/api/teacher/wow/link/edit', { code, link: data }); beep('done'); } catch (e) { toast(e.message, 'err'); save.disabled = false; return; }
        onChange();
      });
      box.append(el('div', { class: 'row' }, save, el('button', { class: 'btn ghost', type: 'button', onclick: () => onChange() }, 'Отмена')));
      inputs.phrase.focus();
    };
    const editBtn = label => el('button', { class: 'btn ghost', type: 'button', onclick: editForm }, label);
    if (!link) {
      box.append(el('div', { class: 'row' }, el('div', { class: 'grow stack', style: 'gap:2px' }, el('b', {}, '🧠 Гейм дизайн документ: как карты становятся одной игрой'),
        el('span', { class: 'muted small' }, 'Геймдизайнер сведёт карты в одну игру: фраза, жанр и камера, что делает герой и кнопки контроллера, цикл, риск, угрозы, нарастание, поворот, смешной момент. Принятый документ уйдёт программисту.')),
      el('div', { class: 'row' }, askBtn('🧠 Документ от ИИ'), editBtn('✎ Написать самому'))));
      return box;
    }
    box.append(el('div', { class: 'row' }, el('div', { class: 'eyebrow grow' }, 'Гейм дизайн документ'),
      link.edited ? el('span', { class: 'tag' }, '✎ учитель') : null,
      link.accepted ? el('span', { class: 'tag ok' }, '✓ принят — уйдёт в сборку') : editable ? el('span', { class: 'tag' }, 'ждёт решения учителя') : null),
    el('p', { class: 'link-phrase' }, link.phrase),
    el('div', { class: 'link-rows' }, LINK_ROWS.filter(([k]) => link[k]).map(([k, label]) => el('div', { 'data-row': k }, el('b', {}, label + ': '), link[k]))));
    if (editable) box.append(el('div', { class: 'row' }, link.accepted ? el('button', { class: 'btn ghost small', type: 'button', onclick: () => act(false) }, 'Снять принятие')
      : el('button', { class: 'btn warm', type: 'button', onclick: () => act(true) }, '✓ Принять документ'), editBtn('✎ Править'), askBtn('↻ Другой документ')));
    return box;
  }

  /* ---------- бот-плейтестер: отчёт о трёх партиях бота ---------- */
  const BOT = { idle: ['🧍', 'Пассивный', 'ничего не жмёт'], mash: ['🔨', 'Торопыга', 'мнёт A'], random: ['🎲', 'Новичок', 'жмёт что попало'] };
  function playtestBox(report, { before } = {}) {
    const box = el('div', { class: 'botbox' + (report.findings.length ? '' : ' ok') });
    const head = report.findings.length ? `🤖 Бот-плейтестер нашёл ${report.findings.length}` : '🤖 Бот-плейтестер не нашёл проблем';
    box.append(el('div', { class: 'row' }, el('b', { class: 'grow' }, head),
      before ? el('span', { class: 'tag' + (report.findings.length < before.findings.length ? ' ok' : '') }, `до правки: ${before.findings.length} → после: ${report.findings.length}`) : null,
      el('span', { class: 'muted small' }, `три партии по ${report.seconds} с в одном мире`)));
    box.append(el('div', { class: 'botrows' }, report.results.map(x => {
      const b = BOT[x.strategy] || ['', x.strategy, ''];
      return el('div', { class: 'botrow', 'data-bot': x.strategy }, el('span', { class: 'bi' }, b[0]), el('b', {}, b[1]), el('span', { class: 'muted small' }, b[2]),
        el('span', { class: 'grow' }), el('span', {}, `${Math.round(x.seconds)} с`), el('span', {}, `очки ${x.score}`), el('span', {}, `урон ${x.hurts}`),
        x.offscreen != null ? el('span', { class: x.offscreen >= 15 ? 'tag err' : 'muted small' }, `за кадром ${x.offscreen}%`) : null,
        report.secretSilent != null || x.secret ? el('span', { class: x.secret ? 'muted small' : 'tag err', title: 'Сколько раз сработала спрятанная механика игры (скрытый счётчик _secret)' }, `спрятанная механика: ${x.secret || 0}`) : null);
    })));
    // копия без спрятанной механики: та же партия новичка с выключенной спрятанной механикой и вывод «спрятанная механика заметная / слабая»
    if (report.off) box.append(el('div', { class: 'botrow', 'data-bot': 'off' }, el('span', { class: 'bi' }, (BOT.random || ['🎲'])[0]), el('b', {}, 'Новичок без спрятанной механики'), el('span', { class: 'muted small' }, 'та же партия, ручка спрятанной механики 0'),
      el('span', { class: 'grow' }), el('span', {}, `${Math.round(report.off.seconds)} с`), el('span', {}, `очки ${report.off.score}`), el('span', {}, `урон ${report.off.hurts}`)));
    if (report.secretWeak != null) box.append(el('p', { class: 'small', 'data-secret': report.secretSilent || report.secretWeak ? 'weak' : 'ok' },
      report.secretSilent ? '🔍 Спрятанная механика молчит: класс не почувствует разницу копий.' : report.secretWeak ? '🔍 Спрятанная механика слабая: её не заметить за одну партию.' : '🔍 Спрятанная механика заметная: срабатывает рано и часто, копии различаются.'));
    if (report.findings.length) box.append(el('ul', { class: 'botfind' }, report.findings.map(f => el('li', {}, f))));
    return box;
  }

  /* ---------- открытие плейтеста и отзыв учителя ---------- */
  const pct = x => Math.round((x || 0) * 100) + '%';
  function discovery(d, { who = 'Игроки' } = {}) {
    const box = el('div', { class: 'stack discovery' });
    if (!d || (!d.rounds && !d.cards.length)) { box.append(el('p', { class: 'muted' }, 'Пока никто из класса не играл в эту игру. Открытие появится после первых партий соседей.')); return box; }
    const tile = (value, label) => el('div', { class: 'stat' }, el('b', {}, String(value)), el('span', {}, label));
    // «ещё раз» — главный тест курса: игрок сам захотел вернуться. Поэтому эта плитка первая и крупная
    const hero = el('div', { class: 'stat hero' }, el('b', {}, String(d.again)), el('span', {}, d.again ? `раз чужие игроки сами нажали «ещё раз»` : 'пока никто не нажал «ещё раз»: в чём игре не хватает крючка?'));
    box.append(el('div', { class: 'scores' }, hero, tile(d.rounds, 'партий сыграли чужие игроки'), tile(d.players, 'игроков')));
    if ((d.runs || []).some(r => r.line.length > 1)) box.append(runs(d.runs));
    if (d.dominant) {
      const strong = d.dominant.share >= 0.5;
      box.append(el('p', { class: 'concept' }, el('b', {}, 'Открытие плейтеста. '),
        `${who} дольше всего держали ${d.dominant.name}: ${pct(d.dominant.share)} времени партии. `,
        strong ? 'Одна кнопка решает почти всё: выбора у игрока нет, и задуманное чувство может не получиться. Дай этой кнопке цену или противовес.' : 'Одной главной кнопки нет: игроки пробовали разное.'));
      box.append(el('div', { class: 'bars' }, d.holds.slice(0, 4).map(hd => el('div', { class: 'barrow' },
        el('span', { class: 'bl' }, hd.name), el('span', { class: 'bt' }, el('i', { style: `width:${Math.max(2, Math.round(hd.share * 100))}%` })), el('b', {}, pct(hd.share))))));
    } else if (d.rounds) box.append(el('p', { class: 'muted small' }, 'Кнопки почти не держали: партии были короткими.'));
    const extra = [];
    if (d.presses.a || d.presses.b) extra.push(`Нажатий: A — ${d.presses.a}, B — ${d.presses.b}`);
    if (d.custom.length) extra.push(d.custom.map(c => `${c.name}: ${c.value}`).join(' · '));
    if (d.best) extra.push(`Лучший счёт чужого игрока: ${d.best}`);
    if (extra.length) box.append(el('div', { class: 'small muted' }, extra.join('. ')));
    if (d.laughs && d.laughs.total) box.append(el('p', { class: 'concept' }, el('b', {}, 'Где смеялись. '), // реакции класса, пока игра шла на проекторе (Д3)
      `Класс прислал ${d.laughs.total} реакций, пока игра шла на проекторе. Громче всего: `, d.laughs.top.map(x => `${Math.floor(x.sec / 60)}:${String(x.sec % 60).padStart(2, '0')} — ${x.emoji.join(' ')}`).join('; '), '. Что в эти секунды делала игра?'));
    const emo = Object.entries(d.emotions || {}).sort((a, b) => b[1] - a[1]);
    if (emo.length) box.append(el('div', { class: 'row', style: 'gap:6px' }, emo.map(([e, n]) => el('span', { class: 'chip' }, `${e} ×${n}`))));
    d.cards.forEach(c => box.append(el('div', { class: 'ptcard' },
      el('div', { class: 'row small' }, el('b', {}, c.nick), (c.emotions || []).map(e => el('span', { class: 'chip' }, e))),
      [['story', 'Понял так'], ['like', 'Нравится'], ['want', 'Хочется'], ['whatif', 'А что если']].filter(([k]) => valText(c[k])).map(([k, label]) =>
        el('div', { class: 'small' }, el('b', {}, label + ': '), valText(c[k]), c[k].dice ? el('span', { class: 'tag dice', style: 'margin-left:6px' }, '[кубик]') : null)))));
    return box;
  }
  // полоска партии: счёт по секундам; участок, где счёт стоял дольше 8 секунд, — подсвечен как «тут, возможно, скучно»
  function runs(list) {
    const wrap = el('div', { class: 'stack runs', style: 'gap:6px' }, el('b', {}, 'Как шли чужие партии'));
    list.filter(r => r.line.length > 1).forEach(r => {
      const W = 220, H = 34, max = Math.max(1, ...r.line), n = r.line.length;
      const x = i => Math.round(i / (n - 1) * W), y = v => Math.round(H - 3 - v / max * (H - 6));
      let flat = null, run = 0, bestRun = 0, end = 0;
      for (let i = 1; i < n; i++) { run = r.line[i] === r.line[i - 1] ? run + 1 : 0; if (run > bestRun) { bestRun = run; end = i; } }
      const flatSec = bestRun * r.step;
      if (flatSec >= 8) flat = `<rect x="${x(end - bestRun)}" y="0" width="${Math.max(2, x(end) - x(end - bestRun))}" height="${H}" class="flat"/>`;
      const pts = r.line.map((v, i) => `${x(i)},${y(v)}`).join(' ');
      wrap.append(el('div', { class: 'runrow' },
        el('span', { class: 'small', style: 'min-width:90px' }, r.nick),
        el('span', { class: 'spark', html: `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="счёт по секундам">${flat || ''}<polyline points="${pts}"/></svg>` }),
        el('span', { class: 'small muted' }, `${r.score} очков за ${r.time} с` + (r.hurts ? `, урон ${r.hurts}` : '') + (flatSec >= 8 ? ` · ${flatSec} с без очков` : '') + (r.again ? ' · 🔁 ещё раз' : ''))));
    });
    wrap.append(el('p', { class: 'small muted' }, 'Розовая полоса — долго без очков. Там игроку могло быть скучно: что можно туда добавить?'));
    return wrap;
  }
  function feedback(fb) {
    if (!fb) return el('p', { class: 'muted small' }, 'Отзыв учителя появится здесь, когда учитель посмотрит твою игру.');
    return el('div', { class: 'feedback' }, el('div', { class: 'eyebrow' }, 'Отзыв учителя'),
      el('div', {}, el('b', {}, 'Понятие: '), valText(fb.concept)),
      el('div', {}, el('b', {}, 'Вопрос: '), valText(fb.question)));
  }

  /* ---------- карта колоды безумных идей ---------- */
  // Карты героя, места и угрозы (parts) — «имя — особенность»: имя крупно, особенность — строкой ниже.
  const cardParts = text => { const t = String(text || ''), i = t.indexOf(' — '); return i > 0 ? [t.slice(0, i), t.slice(i + 3)] : [t, '']; };
  function cardFace(text, parts) {
    if (!text) return ['?'];
    if (!parts) return [text];
    const [name, trait] = cardParts(text);
    return trait ? [el('span', { class: 'cn' }, name), el('span', { class: 'ct' }, trait)] : [text];
  }

  return { cardParts, cardFace, frames, frame, teacherFrame, bar, withLevels, stopAll, shownFrame, card, scores, challenge, challengeStage, openChallenge, board, challengeEvent, linkBox, playtestBox, discovery, feedback };
})();
