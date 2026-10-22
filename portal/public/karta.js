// Карта курса «36 комнат лаборатории» (Д1 аудита 21.10.2026): главная ученика — страница /karta, и та же карта мельче
// на экране «Ждём учителя» в уроке (student.js). Восемь этажей-модулей снизу вверх, комната — урок. Пройденная комната светится,
// окно показывает кадр твоей игры урока; сегодняшняя комната мигает; пропущенная — с пунктиром. На крыше — «Дорога к Фестивалю»
// (уроки 29–36): дорожные знаки и шатёр Фестиваля. Щелчок по комнате — что в ней лежит: игра (и её лучший момент роликом), донор,
// линза, формулы понятий. Всё рисуется кодом (CSS и эмодзи), без внешних картинок. Данные — GET /api/karta (lib/karta.js).
// При «уменьшить движение» свет не включается по очереди и ничего не мигает.
'use strict';
const LabKarta = (() => {
  const { el } = Lab;
  const calm = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pad2 = n => String(n).padStart(2, '0');
  const STATE = {
    lit: 'Комната светится: урок пройден.',
    now: 'Сегодня весь класс здесь.',
    missed: 'Урок прошёл без тебя. Игры и записи класса — в аркаде, а учитель подскажет, что наверстать.',
    dark: 'Свет ещё не горит: комната откроется, когда класс до неё дойдёт.',
  };
  // окно комнаты: кадр игры урока (обложка аркады), иначе тёплый свет, тёмное стекло или «сегодня»
  function windowOf(r, compact) {
    const g = r.game, img = r.state === 'lit' && g && g.poster ? g.poster : null;
    return el('button', {
      type: 'button', class: `kt-room ${r.state}` + (img ? ' shot' : '') + (r.number >= 29 ? ' road' : ''), 'data-room': r.number,
      style: (img ? `--img:url("${img}");` : '') + `--d:${r.order * 45}ms`,
      'aria-label': `Комната ${r.number}: ${r.title}. ${STATE[r.state]}` + (g ? ` Твоя игра «${g.title}».` : ''),
    },
    el('span', { class: 'kt-no' }, pad2(r.number)),
    compact ? null : el('span', { class: 'kt-t' }, r.title),
    el('span', { class: 'kt-ic', 'aria-hidden': 'true' }, r.today ? '📍' : '', g ? '🎮' : '', g && g.moment ? '🎬' : '', g && g.release ? '🏁' : ''));
  }
  function draw(host, d, { room = null, compact = false, onRoom = null } = {}) {
    host.innerHTML = '';
    let order = 0;
    // свет включается снизу вверх, комната за комнатой
    d.floors.forEach(f => f.rooms.forEach(r => { r.order = r.state === 'lit' ? order++ : 0; }));
    const all = d.floors.flatMap(f => f.rooms), detail = el('aside', { class: 'kt-detail card', 'aria-live': 'polite' });
    const nowFloor = (all.find(r => r.today) || {}).module || 1;
    const tower = el('div', { class: 'kt-tower' + (compact ? ' compact' : '') + (calm() ? ' calm' : ''), style: `--now:${nowFloor}` });
    // крыша: дорога к Фестивалю (последний этаж — модуль 8)
    const top = d.floors[d.floors.length - 1];
    if (top) {
      const fest = top.rooms[top.rooms.length - 1];
      tower.append(el('section', { class: 'kt-floor kt-roof', 'data-floor': top.number },
        el('div', { class: 'kt-plate' }, el('b', {}, 'Крыша · этаж ' + top.number), el('span', {}, 'Дорога к Фестивалю')),
        el('div', { class: 'kt-roadwrap' },
          el('div', { class: 'kt-road', role: 'list' }, top.rooms.map(r => el('div', { role: 'listitem', class: 'kt-stop' + (r === fest ? ' fest' : '') }, windowOf(r, compact)))),
          compact ? null : el('div', { class: 'kt-tent', 'aria-hidden': 'true' }, el('span', { class: 'kt-flags' }), el('span', { class: 'kt-tent-ic' }, '🎪'), el('b', {}, 'Фестиваль игр')))));
    }
    // этажи 7 … 1 сверху вниз
    d.floors.slice(0, -1).reverse().forEach(f => {
      const lit = f.rooms.filter(r => r.state === 'lit').length;
      tower.append(el('section', { class: 'kt-floor' + (f.rooms.some(r => r.today) ? ' here' : ''), 'data-floor': f.number },
        el('div', { class: 'kt-plate' }, el('b', {}, 'Этаж ' + f.number), el('span', {}, f.title), compact ? null : el('span', { class: 'kt-count' }, `${lit} из ${f.rooms.length}`)),
        el('div', { class: 'kt-rooms', role: 'list', style: `--n:${f.rooms.length}` }, f.rooms.map(r => el('div', { role: 'listitem' }, windowOf(r, compact))))));
    });
    tower.append(el('div', { class: 'kt-ground' }, el('span', { class: 'kt-door', 'aria-hidden': 'true' }), el('span', {}, (d.emblem ? d.emblem + ' ' : '') + `Студия ${d.nick}`)));
    // сколько комнат светится — 36 огоньков
    const meter = el('div', { class: 'kt-meter', role: 'img', 'aria-label': `Светится ${d.lit} из ${d.total} комнат` },
      all.map(r => el('i', { class: r.state })));
    const head = el('div', { class: 'kt-head row' },
      el('div', { class: 'stack', style: 'gap:2px' }, el('b', { class: 'kt-big' }, `${d.lit} из ${d.total}`), el('span', { class: 'small muted' }, 'комнат светится')),
      meter, d.today ? el('span', { class: 'tag ok' }, `сегодня — комната ${d.today}`) : null,
      d.today && d.today < 36 ? el('span', { class: 'small muted' }, `до Фестиваля ${36 - d.today} ${plural(36 - d.today)}`) : null);
    function show(n) {
      const r = all.find(x => x.number === n);
      tower.querySelectorAll('.kt-room.sel').forEach(b => b.classList.remove('sel'));
      if (!r) { detail.hidden = true; return; }
      const b = tower.querySelector(`[data-room="${n}"]`); if (b) b.classList.add('sel');
      detail.hidden = false; detail.innerHTML = '';
      const g = r.game;
      detail.append(
        el('div', { class: 'eyebrow' }, `${r.number >= 29 ? 'Крыша' : 'Этаж ' + r.module} · комната ${r.number}`),
        el('h3', {}, r.title),
        el('p', { class: 'small kt-state ' + r.state }, STATE[r.state]),
        g ? el('div', { class: 'kt-game' },
          g.moment || g.poster ? el('img', { class: 'kt-shot', src: g.moment ? g.moment.url : g.poster, alt: g.moment ? 'Лучший момент игры' : 'Кадр игры', loading: 'lazy' }) : null,
          el('div', { class: 'stack', style: 'gap:4px' }, el('span', { class: 'eyebrow' }, 'Моя игра'), el('b', {}, `«${g.title}» · v${g.version}`),
            g.moment ? el('span', { class: 'small muted' }, '🎬 лучший момент' + (g.moment.score ? ` · ${g.moment.score}` : '')) : null,
            el('a', { class: 'btn small', href: '/arcade?game=' + encodeURIComponent(g.id) }, '▶ Играть'))) : null,
        el('div', { class: 'kt-cards' },
          r.donor ? el('div', { class: 'deck-card donor' }, el('div', { class: 'small muted' }, 'Донор'), el('b', {}, r.donor)) : null,
          r.lens ? el('div', { class: 'deck-card lens' }, el('div', { class: 'small muted' }, 'Линза'), el('b', {}, r.lens)) : null),
        r.concepts.length ? el('ul', { class: 'kt-concepts' }, r.concepts.map(c => el('li', {}, c))) : null);
      if (onRoom) onRoom(r);
    }
    tower.addEventListener('click', e => { const b = e.target.closest('[data-room]'); if (!b) return; if (compact) { location.href = '/karta?room=' + b.dataset.room; return; } show(Number(b.dataset.room)); });
    if (compact) { host.append(el('div', { class: 'kt-wrap compact' }, head, tower)); return { show }; }
    detail.hidden = true;
    host.append(el('div', { class: 'kt-wrap' }, head, el('div', { class: 'kt-grid' }, tower, detail)));
    if (room) show(room);
    return { show };
  }
  // шаг karta (урок 36, финал курса): вся карта, ученик выбирает комнату, где вырос сильнее всего, и одной фразой — почему.
  // Поля: question, hint, deck (кубик для «почему»). Ответ — { room, title, why }
  if (typeof STEPS === 'object') STEPS.karta = ctx => {
    const st = ctx.step, v = Object.assign({}, ctx.value);
    const host = el('div', { class: 'stack' }), mapBox = el('div'), pick = el('div', { class: 'row' });
    let chosen = null;
    function drawPick() {
      const mine = chosen && v.room === chosen.number;
      pick.replaceChildren(
        el('b', { class: 'grow' }, chosen ? `Комната ${chosen.number}: ${chosen.title}` : (st.hint || 'Нажми на комнату на карте.')),
        el('button', { class: 'btn' + (mine ? ' ghost' : ''), type: 'button', disabled: !chosen || mine, 'data-karta-pick': '',
          onclick: () => { v.room = chosen.number; v.title = chosen.title; ctx.save(v, true, true); drawPick(); } }, mine ? '✓ Моя комната' : 'Это моя комната'));
    }
    api('/api/karta').then(d => LabKarta.draw(mapBox, d, { room: v.room || null, onRoom: r => { chosen = r; drawPick(); } }))
      .catch(e => mapBox.append(el('p', { class: 'err' }, e.message)));
    drawPick();
    host.append(st.question ? el('div', { class: 'eyebrow' }, st.question) : null, pick,
      st.deck ? Lab.fieldEditor({ id: 'why', label: 'Почему эта комната?', deck: st.deck }, v.why, nv => { v.why = nv; ctx.save(v); }, { idPrefix: st.id }) : null, mapBox);
    return host;
  };
  const plural = n => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? 'урок' : a >= 2 && a <= 4 && (b < 12 || b > 14) ? 'урока' : 'уроков'; };
  return { draw };
})();
