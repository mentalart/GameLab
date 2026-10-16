const GAME = {
  title: 'Звездолов',
  subtitle: 'Лови звёзды, уворачивайся от метеоритов. Рывок спасает в последний момент.',
  controls: [
    { input: 'move', text: 'бег' },
    { input: 'a', text: 'рывок' },
  ],
  decisions: [
    'Чувство: азарт «успею или нет».',
    'Честность: метеорит виден заранее и падает по прямой.',
    'Выбор: потратить рывок на звезду или сберечь на спасение.',
  ],
  palette: { bg: '#0b1030', accent: '#ffd166' },
  config: {
    speed: { value: 320, min: 100, max: 700, step: 10, label: 'Скорость героя' },
    dashPower: { value: 900, min: 300, max: 1800, step: 50, label: 'Сила рывка' },
    dashCooldown: { value: 1.5, min: 0.3, max: 5, step: 0.1, label: 'Перезарядка рывка, с' },
    starEvery: { value: 0.7, min: 0.2, max: 2, step: 0.05, label: 'Звезда раз в, с' },
    rockEvery: { value: 1.1, min: 0.3, max: 3, step: 0.05, label: 'Метеорит раз в, с' },
    fallSpeed: { value: 260, min: 100, max: 700, step: 10, label: 'Скорость падения' },
  },
  start(g) {
    g.lives = 3;
    g.state = { p: { x: g.W / 2, y: g.H - 70, r: 20, vx: 0 }, items: [], starT: 0, rockT: 1, dashCd: 0, stars: [] };
    for (let i = 0; i < 60; i++) g.state.stars.push({ x: g.rand(0, g.W), y: g.rand(0, g.H - 60), s: g.rand(1, 2.5) });
  },
  update(g, dt) {
    const s = g.state, p = s.p, c = g.cfg;
    const dir = (g.input.right ? 1 : 0) - (g.input.left ? 1 : 0);
    p.vx = g.lerp(p.vx, dir * c.speed, Math.min(1, dt * 12));
    s.dashCd -= dt;
    if (g.pressed.a && s.dashCd <= 0) {
      p.vx = (dir || 1) * c.dashPower; s.dashCd = c.dashCooldown;
      g.sfx.whoosh(); g.burst(p.x, p.y, { count: 14, colors: ['#ffffff', g.palette.accent], speed: 200, life: 0.3 });
    }
    p.x = g.clamp(p.x + p.vx * dt, p.r, g.W - p.r);
    const speedUp = 1 + g.t * 0.01;
    s.starT -= dt; s.rockT -= dt;
    if (s.starT <= 0) { s.items.push({ kind: 'star', x: g.rand(30, g.W - 30), y: -20, r: 14 }); s.starT = c.starEvery; }
    if (s.rockT <= 0) { s.items.push({ kind: 'rock', x: g.rand(30, g.W - 30), y: -30, r: 18, warn: 0.5 }); s.rockT = c.rockEvery / speedUp; }
    for (const it of s.items) {
      if (it.warn > 0) { it.warn -= dt; continue; }
      it.y += c.fallSpeed * speedUp * dt;
      if (g.circleHit(p, it)) {
        it.dead = true;
        if (it.kind === 'star') { g.addScore(10, it.x, it.y - 20); g.sfx.coin(); g.burst(it.x, it.y, { colors: ['#ffd166', '#ffffff'], count: 12 }); }
        else g.hurt(it.x, it.y);
      }
      if (it.y > g.H - 50) {
        it.dead = true;
        if (it.kind === 'rock') { g.burst(it.x, g.H - 50, { colors: ['#ff8a3d', '#ffd29a'], count: 18, angle: -Math.PI / 2, spread: 2, gravity: 600 }); g.shake(4); g.sfx.explode(); }
      }
    }
    s.items = s.items.filter(i => !i.dead);
    g.addScore(dt * 2);
  },
  draw(g, ctx) {
    const s = g.state, p = s.p;
    for (const st of s.stars) { ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(st.x, st.y, st.s, st.s); }
    ctx.fillStyle = '#1b2a4a'; ctx.fillRect(0, g.H - 50, g.W, 50);
    for (const it of s.items) {
      if (it.kind === 'rock' && it.warn > 0) { ctx.strokeStyle = '#ff4d5e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(it.x, 0); ctx.lineTo(it.x, g.H - 50); ctx.stroke(); continue; }
      if (it.kind === 'star') {
        ctx.fillStyle = '#ffd166'; ctx.beginPath();
        for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? it.r * 0.45 : it.r; ctx.lineTo(it.x + Math.cos(a) * rr, it.y + Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill();
      } else { ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.arc(it.x, it.y, it.r, 0, 7); ctx.fill(); }
    }
    if (!g.blink()) { ctx.fillStyle = '#7cf5a8'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); ctx.fillStyle = '#0b1030'; ctx.fillRect(p.x - 8, p.y - 6, 5, 5); ctx.fillRect(p.x + 3, p.y - 6, 5, 5); }
    g.text(s.dashCd <= 0 ? 'РЫВОК ГОТОВ' : 'рывок...', g.W - 20, 30, { align: 'right', size: 14, color: s.dashCd <= 0 ? '#ffd166' : '#8890b0' });
  },
};
