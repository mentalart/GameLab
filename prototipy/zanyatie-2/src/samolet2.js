const RULES = ['Без цены (версия 1)', 'Перегрев тормоза', 'Множитель только на газу', 'Растущая минимальная скорость', 'Награда за смелость'];
const CHANNELS = [
  { name: 'Синтвейв', sky: ['#1a0533', '#5b1a6e'], grid: '#ff4fd8', sun: '#ffb547', wall: '#00e5ff' },
  { name: 'Ночные новости', sky: ['#05122b', '#123a6b'], grid: '#4fa3ff', sun: '#e9f0ff', wall: '#ffd23f' },
  { name: 'Мультики', sky: ['#0b2a1a', '#1f6b45'], grid: '#7cf5a8', sun: '#fff27a', wall: '#ff6b8b' },
  { name: 'Помехи', sky: ['#141414', '#3a3a46'], grid: '#c8c8d8', sun: '#ff5d6e', wall: '#b6ff3b' },
];
const PY = 270, PX = 220, PR = 13;

const GAME = {
  title: 'Самолётик в телевизоре 2',
  subtitle: 'Только газ и тормоз. Каждые 10 секунд телевизор переключает канал. Версия 2: у тормоза появилась цена.',
  author: 'версия 2',
  controls: [
    { input: 'a', text: 'газ' },
    { input: 'b', text: 'тормоз' },
  ],
  decisions: [
    'Чувство: азарт «проскочу в щель или нет» и встряска при смене канала.',
    'Честность: стена помех бьёт ровно там, где нарисована; смену канала объявляет отсчёт.',
    'Выбор: газ или тормоз. В версии 2 тормоз стоит денег, поэтому выбор настоящий.',
  ],
  palette: { bg: '#1a0533', accent: '#ff4fd8' },
  config: {
    rule: { value: 1, min: 0, max: 4, step: 1, names: RULES, label: 'Цена тормоза (правило версии 2)' },
    cruise: { value: 260, min: 120, max: 450, step: 10, label: 'Скорость без кнопок' },
    maxSpeed: { value: 540, min: 300, max: 800, step: 10, label: 'Максимальная скорость' },
    minSpeed: { value: 110, min: 40, max: 300, step: 10, label: 'Минимальная скорость' },
    accel: { value: 420, min: 100, max: 900, step: 10, label: 'Газ, разгон' },
    brake: { value: 520, min: 100, max: 1000, step: 10, label: 'Тормоз, замедление' },
    gateEvery: { value: 430, min: 250, max: 800, step: 10, label: 'Расстояние между стенами' },
    gapSize: { value: 150, min: 90, max: 260, step: 5, label: 'Щель в стене, высота' },
    swing: { value: 150, min: 0, max: 220, step: 5, label: 'Щель гуляет вверх-вниз на' },
    swingSpeed: { value: 1.4, min: 0.2, max: 3.5, step: 0.05, label: 'Скорость щели' },
    channelTime: { value: 10, min: 4, max: 30, step: 1, label: 'Смена канала раз в, с' },
    heatRate: { value: 45, min: 10, max: 120, step: 1, label: 'Перегрев: нагрев за секунду, %' },
    coolRate: { value: 30, min: 5, max: 100, step: 1, label: 'Перегрев: остывание за секунду, %' },
    lockTime: { value: 1.6, min: 0.3, max: 4, step: 0.1, label: 'Перегрев: тормоз отключён, с' },
    mulGrow: { value: 0.45, min: 0.1, max: 2, step: 0.05, label: 'Множитель: рост на газу за секунду' },
    maxMul: { value: 5, min: 2, max: 10, step: 1, label: 'Множитель: потолок' },
    minGrow: { value: 5, min: 1, max: 20, step: 0.5, label: 'Мин. скорость растёт за секунду на' },
    braveSpeed: { value: 400, min: 250, max: 700, step: 10, label: 'Смелость: скорость пролёта от' },
    braveBonus: { value: 60, min: 10, max: 200, step: 5, label: 'Смелость: бонус за пролёт' },
  },
  presets: {
    'Версия 1': { rule: 0 },
    'Перегрев': { rule: 1 },
    'Множитель': { rule: 2 },
    'Мин. скорость': { rule: 3 },
    'Смелость': { rule: 4 },
    'Новичок': { gapSize: 190, swingSpeed: 1.0, cruise: 230 },
  },

  start(g) {
    const s = g.state;
    s.v = g.cfg.cruise; s.gates = []; s.ch = 0; s.chT = 0; s.heat = 0; s.lock = 0;
    s.mul = 1; s.brave = 0; s.passed = 0; s.gridOff = 0; s.bob = 0; s.trail = [];
    s.nextGateX = 760; g.palette.bg = CHANNELS[0].sky[0]; g.palette.accent = CHANNELS[0].grid;
  },

  minNow(g) {
    const c = g.cfg;
    if (Math.round(c.rule) !== 3) return c.minSpeed;
    return Math.min(c.maxSpeed - 60, c.minSpeed + c.minGrow * g.t);
  },
  gap(g, gt) {
    const c = g.cfg, s = g.state;
    const chMul = 1 + 0.12 * s.ch;
    const size = Math.max(90, c.gapSize - 6 * s.ch);
    const cy = PY + c.swing * Math.sin(gt.phase + g.t * c.swingSpeed * chMul);
    return { top: cy - size / 2, bot: cy + size / 2 };
  },

  update(g, dt) {
    const c = g.cfg, s = g.state, rule = Math.round(c.rule);
    const gas = g.input.a, brakeHeld = g.input.b;
    // цена тормоза
    let brake = brakeHeld;
    if (rule === 1) {
      if (s.lock > 0) { brake = false; s.lock -= dt; if (s.lock <= 0) s.heat = 55; }
      else if (brakeHeld) {
        s.heat += c.heatRate * dt;
        if (s.heat >= 100) { s.heat = 100; s.lock = c.lockTime; g.sfx.explode(); g.shake(8); g.popup(PX, PY - 40, 'ПЕРЕГРЕВ', '#ff5d6e', 22); g.count('перегревов'); }
      } else s.heat = Math.max(0, s.heat - c.coolRate * dt);
    } else { s.heat = 0; s.lock = 0; }
    if (rule === 2) {
      if (gas && !brakeHeld) s.mul = Math.min(c.maxMul, s.mul + c.mulGrow * dt);
      if (g.pressed.b && s.mul > 1.05) { g.popup(PX, PY - 40, 'множитель ×1', '#9aa3c7', 16); g.sfx.beep(); }
      if (brakeHeld) s.mul = 1;
    } else s.mul = 1;
    // скорость
    const minV = this.minNow(g);
    if (gas) s.v += c.accel * dt;
    else if (brake) s.v -= c.brake * dt;
    else s.v += Math.sign(c.cruise - s.v) * Math.min(Math.abs(c.cruise - s.v), 160 * dt);
    s.v = g.clamp(s.v, minV, c.maxSpeed);
    // канал
    s.chT += dt;
    if (s.chT >= c.channelTime) {
      s.chT = 0; s.ch++;
      g.flash('#ffffff', 0.35); g.sfx.whoosh(); g.rumble(120, 0.4);
      g.palette.bg = CHANNELS[s.ch % 4].sky[0]; g.palette.accent = CHANNELS[s.ch % 4].grid;
    }
    // мир
    const dx = s.v * dt;
    s.gridOff = (s.gridOff + dx) % 60;
    s.nextGateX -= dx;
    if (s.nextGateX <= g.W + 60) {
      s.gates.push({ x: s.nextGateX, w: 46, phase: g.rand(0, 6.28), passed: false });
      s.nextGateX += c.gateEvery;
    }
    for (const gt of s.gates) {
      gt.x -= dx;
      const gp = this.gap(g, gt);
      // видно = правда: проверяем те же прямоугольники, что рисуем
      const inX = PX + PR > gt.x && PX - PR < gt.x + gt.w;
      if (inX && (PY - PR < gp.top || PY + PR > gp.bot)) {
        if (g.hurt(PX, PY)) { s.v = Math.max(minV, s.v * 0.6); }
      }
      if (!gt.passed && gt.x + gt.w < PX - PR) {
        gt.passed = true; s.passed++;
        g.addScore(Math.round(10 * s.mul), PX, PY - 26);
        g.sfx.coin();
        if (rule === 4 && s.v >= c.braveSpeed) {
          s.brave++; g.count('смелых пролётов');
          g.addScore(Math.round(c.braveBonus), PX + 30, PY - 50);
          g.popup(PX + 30, PY - 74, 'СМЕЛО!', '#ffb547', 22); g.burst(PX, PY, { count: 20, colors: ['#ffb547', '#ffffff'] });
        }
      }
    }
    s.gates = s.gates.filter(gt => gt.x > -80);
    g.score += dx / 25 * s.mul;
    // след
    s.trail.push({ x: PX - 14, y: PY, a: 1 });
    for (const p of s.trail) { p.x -= dx; p.a -= dt * 2.5; }
    s.trail = s.trail.filter(p => p.a > 0 && p.x > -10);
  },

  draw(g, ctx) {
    const s = g.state, c = g.cfg, rule = Math.round(c.rule);
    const ch = CHANNELS[(s.ch || 0) % 4];
    // небо
    const gr = ctx.createLinearGradient(0, 0, 0, g.H);
    gr.addColorStop(0, ch.sky[0]); gr.addColorStop(1, ch.sky[1]);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, g.W, g.H);
    // солнце
    ctx.save(); ctx.beginPath(); ctx.arc(700, 360, 120, Math.PI, 0); ctx.closePath(); ctx.clip();
    ctx.fillStyle = ch.sun; ctx.globalAlpha = 0.85; ctx.fillRect(560, 230, 280, 140);
    ctx.globalAlpha = 1; ctx.fillStyle = ch.sky[1];
    for (let i = 0; i < 6; i++) ctx.fillRect(560, 300 + i * 11, 280, 2 + i * 1.2);
    ctx.restore();
    // сетка пола (декор, без урона)
    ctx.strokeStyle = ch.grid; ctx.globalAlpha = 0.35; ctx.lineWidth = 1.5;
    const hz = 360;
    for (let i = -12; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(g.W / 2 + i * 30, hz); ctx.lineTo(g.W / 2 + i * 160, g.H); ctx.stroke(); }
    for (let k = 0; k < 8; k++) {
      const z = ((k * 60 + 60 - (s.gridOff || 0)) % 480) / 480, y = hz + (g.H - hz) * z * z;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(g.W, y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (!s.gates) return;
    // стены помех: рисуем ровно зону урона
    for (const gt of s.gates) {
      const gp = this.gap(g, gt);
      for (const [y0, y1] of [[-10, gp.top], [gp.bot, g.H + 10]]) {
        if (y1 <= y0) continue;
        ctx.fillStyle = 'rgba(10,10,20,.85)'; ctx.fillRect(gt.x, y0, gt.w, y1 - y0);
        ctx.fillStyle = ch.wall;
        for (let yy = y0; yy < y1; yy += 6) { ctx.globalAlpha = 0.25 + Math.random() * 0.5; ctx.fillRect(gt.x + Math.random() * 10, yy, gt.w - Math.random() * 20, 2); }
        ctx.globalAlpha = 1; ctx.strokeStyle = ch.wall; ctx.lineWidth = 2; ctx.strokeRect(gt.x + 1, y0, gt.w - 2, y1 - y0);
      }
    }
    // след и самолётик
    for (const p of s.trail) { ctx.globalAlpha = p.a * 0.5; ctx.fillStyle = ch.grid; ctx.fillRect(p.x - 3, p.y - 2, 6, 4); }
    ctx.globalAlpha = 1;
    if (!g.blink()) {
      ctx.save(); ctx.translate(PX, PY); ctx.scale(1.25, 1.25);
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = ch.grid; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-11, -12); ctx.lineTo(-5, 0); ctx.lineTo(-11, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (g.input.a) { ctx.fillStyle = '#ffb547'; ctx.fillRect(-16 - Math.random() * 8, -3, 10, 6); }
      if (g.input.b && !(rule === 1 && s.lock > 0)) { ctx.fillStyle = '#4fa3ff'; ctx.fillRect(10, -14, 4, 6); ctx.fillRect(10, 8, 4, 6); }
      ctx.restore();
    }
    // приборы
    const bx = 16, by = g.H - 40, bw = 260;
    ctx.fillStyle = 'rgba(4,6,13,.7)'; ctx.fillRect(bx - 8, by - 26, bw + 16, 52);
    g.text('СКОРОСТЬ', bx, by - 10, { size: 11, color: '#9aa3c7' });
    ctx.fillStyle = '#2a3560'; ctx.fillRect(bx, by, bw, 10);
    const k = v => bx + bw * g.clamp(v / c.maxSpeed, 0, 1);
    ctx.fillStyle = ch.grid; ctx.fillRect(bx, by, k(s.v) - bx, 10);
    const mn = this.minNow(g);
    ctx.fillStyle = '#ff5d6e'; ctx.fillRect(k(mn) - 1, by - 4, 3, 18);
    if (rule === 4) { ctx.fillStyle = '#ffb547'; ctx.fillRect(k(c.braveSpeed) - 1, by - 4, 3, 18); g.text('смело →', k(c.braveSpeed) + 4, by - 10, { size: 11, color: '#ffb547' }); }
    if (rule === 1) {
      const hx = bx + bw + 24;
      ctx.fillStyle = 'rgba(4,6,13,.7)'; ctx.fillRect(hx - 8, by - 26, 150, 52);
      g.text(s.lock > 0 ? 'ТОРМОЗ ОТКЛЮЧЁН' : 'НАГРЕВ ТОРМОЗА', hx, by - 10, { size: 11, color: s.lock > 0 ? '#ff5d6e' : '#9aa3c7' });
      ctx.fillStyle = '#2a3560'; ctx.fillRect(hx, by, 134, 10);
      ctx.fillStyle = s.heat > 75 ? '#ff5d6e' : '#ffb547'; ctx.fillRect(hx, by, 134 * s.heat / 100, 10);
    }
    if (rule === 2) g.text('×' + s.mul.toFixed(1), bx + bw + 24, by + 10, { size: 30, color: s.mul > 1.05 ? '#ffb547' : '#9aa3c7', weight: 900 });
    // канал и отсчёт
    g.text('КАНАЛ ' + ((s.ch || 0) + 1) + ' · ' + ch.name.toUpperCase(), g.W / 2, 30, { size: 14, color: '#ffffff', align: 'center' });
    const left = c.channelTime - s.chT;
    if (left < 1.5) g.text('смена канала через ' + Math.ceil(left * 2) / 2, g.W / 2, 56, { size: 18, color: '#ffb547', align: 'center' });
    g.text('Цена тормоза: ' + RULES[rule], g.W - 16, g.H - 14, { size: 12, color: '#9aa3c7', align: 'right' });
  },

  overNote(g, tele) {
    const s = g.state, rule = Math.round(g.cfg.rule);
    let t = `Правило: <b>${RULES[rule]}</b>. Стен пройдено: ${s.passed}, каналов: ${(s.ch || 0) + 1}.`;
    if (rule === 1) t += ` Перегревов: ${tele.custom['перегревов'] || 0}.`;
    if (rule === 4) t += ` Смелых пролётов: ${s.brave}.`;
    return t;
  },
};
