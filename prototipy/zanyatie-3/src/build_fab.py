import sys, re, pathlib
T = pathlib.Path('/tmp/claude-0/x/zip/laboratoriya-igr/engine/template.html').read_text()
def rep(a, b):
    global T
    assert a in T, a[:60]
    T = T.replace(a, b, 1)
# presets + choice knobs + over note
rep('.knob.changed label::after', '.presets{display:flex;flex-wrap:wrap;gap:6px}\n.overnote{font-size:13.5px;color:var(--muted);margin:0}\n.overnote b{color:var(--text)}\n.knob.changed label::after')
rep('<div id="knobs"', '<div class="presets" id="presets"></div>\n    <div id="knobs"')
rep('<div class="row"><button type="button" class="btn" id="againBtn">', '<p class="overnote" id="overNote"></p>\n      <div class="row"><button type="button" class="btn" id="againBtn">')
rep("function fmt(v, st) {", "function fmtK(k, v) { const m = META[k]; return m && m.names ? (m.names[Math.round(v)] || String(v)) : fmt(v, m ? m.step : 1); }\n  function fmt(v, st) {")
rep("w.querySelector('output').textContent = fmt(g.cfg[k], m.step);", "w.querySelector('output').textContent = fmtK(k, g.cfg[k]);")
rep("function syncKnobs() {", """function buildPresets() {
    const pr = $('#presets'); pr.innerHTML = '';
    const P = Object.assign({ 'Как задумано': {} }, (G && G.presets) || {});
    for (const name of Object.keys(P)) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'ghost'; b.textContent = name;
      b.addEventListener('click', () => { Object.assign(g.cfg, DEFAULTS, P[name]); syncKnobs(); call('onPreset', g, name); b.blur(); });
      pr.appendChild(b);
    }
  }
  function syncKnobs() {""")
rep("META[k] = { label: c.label || k,", "META[k] = { names: Array.isArray(c.names) ? c.names : null, label: c.label || k,")
rep("buildKnobs(); buildTouch();", "buildKnobs(); buildPresets(); buildTouch();")
rep("    setTimeout(() => { $('#overScreen').hidden = false; overReady = true; }, 700);", """    let note = '';
    const tm = Math.max(0.1, tele.time), pct = k => Math.round(tele.held[k] / tm * 100);
    const lab = { a: 'A', b: 'B' };
    const parts = (G.controls || []).filter(c => lab[c.input]).map(c => `<b>${escapeHtml(c.text || lab[c.input])}</b> (${lab[c.input]}) — ${pct(c.input)}% времени`);
    if (parts.length && tele.time > 2) note = 'Телеметрия, сколько кнопка была зажата: ' + parts.join(', ') + '.';
    if (G && typeof G.overNote === 'function') { try { const x = G.overNote(g, tele); if (x) note += (note ? '<br>' : '') + x; } catch (e) {} }
    $('#overNote').innerHTML = note; $('#overNote').hidden = !note;
    setTimeout(() => { $('#overScreen').hidden = false; overReady = true; }, 700);""")
# strip skeleton
T = re.sub(r'<!doctype html>\s*<html lang="ru">\s*<head>\s*<meta charset="utf-8">\s*<meta name="viewport"[^>]*>\s*', '', T)
T = T.replace('</head>\n<body>\n', '').replace('</body>\n</html>', '')
assert '<html' not in T and '<body' not in T
rep("if (code === 'KeyR' && state !== 'menu') startGame();", "if (code === 'KeyR' && state !== 'menu' && state !== 'build') startGame();")
rep("if (e.target && e.target.tagName === 'TEXTAREA') return;", "if (e.target && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT')) return;")
rep("const down = i => b[i] && !padPrev[i];", "const down = i => b[i] && !padPrev[i];\n    if (G && typeof G.padHook === 'function' && G.padHook(b, padPrev, state)) { padPrev = b; return; }")
rep("$('#againBtn').textContent = on ? 'Ещё раз · A' : 'Ещё раз · пробел';", "$('#againBtn').textContent = on ? 'Ещё раз · Start' : 'Ещё раз · пробел';")
rep("$('#overNote').innerHTML = note; $('#overNote').hidden = !note;", "$('#overNote').innerHTML = note; $('#overNote').hidden = !note;\n    call('onOver', g, tele);")
rep('<p class="overnote" id="overNote"></p>', '<p class="overnote" id="overNote"></p>\n      <div id="mda"></div>')
rep("  window.__labBoot = function () {", "  window.__lab = { g, startGame, confirmAction, togglePanel, syncKnobs, renderControls, buildPresets, defaults: () => DEFAULTS, meta: () => META, getState: () => state, setState: v => { state = v; }, pad: () => padMode, audio, sfx, tone };\n  window.__labBoot = function () {")
rep("    post({ type: 'ready', title: G.title, decisions: dec });", "    call('boot', g);\n    post({ type: 'ready', title: G.title, decisions: dec });")
name = sys.argv[1]
code = pathlib.Path(f'/tmp/claude-0/x/build/games/{name}.js').read_text()
title = re.search(r"title:\s*'([^']+)'", code).group(1)
out = T.replace('__TITLE__', title).replace('/*__GAME_CODE__*/', code)
pathlib.Path(f'/tmp/claude-0/x/build/out/{name}.html').write_text(out)
print('ok', name, len(out))
