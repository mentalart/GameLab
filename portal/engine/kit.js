/* =====================================================================
   Лаборатория игр · «Готовые детали» движка Лаб3D (набор, kit.js)
   ---------------------------------------------------------------------
   Подключается в game.html после lab.js и добавляет в объект lab:
     lab.style   — стиль мира: настроение и свет, палитра ролей, язык формы, детальность, износ, ветер;
     lab.build   — свой лоуполи-предмет из примитивов в несколько строк (главный инструмент против похожести);
     lab.prop    — заготовка из библиотеки (2–4 силуэта у вида, цвета только из палитры стиля);
     lab.scatter — расстановка копий группами по зерну, декор не загораживает поле;
     lab.floor, lab.edge, lab.backdrop — земля, край поля, дальний фон слоями;
     lab.ambient — движение без игрока: облака, птицы, снег, пузыри…;
     lab.creature, lab.creatureKind — существо по схеме тела и параметрам, живое без кода игры.
   Только процедурная геометрия MeshBuilder: никаких файлов моделей и текстур — облик решает модель по картам.
   Описание — portal/engine/README.md, раздел «Готовые детали». Витрина — portal/engine/kit.html.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.BABYLON;
  const TAU = Math.PI * 2;

  /* ---------------- общие помощники (без состояния) ---------------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const arr3 = (v, d = 0) => (Array.isArray(v) ? [v[0] ?? d, v[1] ?? d, v[2] ?? d] : v == null ? [d, d, d] : [v, v, v]);

  // цвета: hex ⇄ HSL, светлее, темнее, сдвиг тона, смесь
  function hexOk(h) { return typeof h === 'string' && /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(h); }
  function toRgb(h) { const n = parseInt(h.slice(1, 7), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
  function toHex(r, g, b) { const f = x => Math.round(clamp(x, 0, 1) * 255).toString(16).padStart(2, '0'); return '#' + f(r) + f(g) + f(b); }
  function toHsl(h) {
    const [r, g, b] = toRgb(h), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (mx === mn) return [0, 0, l];
    const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    let hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [hh * 60, s, l];
  }
  function fromHsl(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360; s = clamp(s, 0, 1); l = clamp(l, 0, 1);
    if (!s) return toHex(l, l, l);
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return toHex(f(h + 1 / 3), f(h), f(h - 1 / 3));
  }
  const C = {
    light: (h, k) => { const [a, s, l] = toHsl(h); return fromHsl(a, s, l + (1 - l) * k); },
    dark: (h, k) => { const [a, s, l] = toHsl(h); return fromHsl(a, s, l * (1 - k)); },
    sat: (h, k) => { const [a, s, l] = toHsl(h); return fromHsl(a, s * k, l); },
    hue: (h, d) => { const [a, s, l] = toHsl(h); return fromHsl(a + d, s, l); },
    mix: (x, y, k) => { const a = toRgb(x), b = toRgb(y); return toHex(lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)); },
    dist: (x, y) => { const a = toRgb(x), b = toRgb(y); return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); },
    lum: h => { const [r, g, b] = toRgb(h); return 0.3 * r + 0.59 * g + 0.11 * b; },
  };

  /* ---------------- настроения: свет, небо, палитра по умолчанию ---------------- */
  // lit — свечение окон и фонарей (ночью 1), snow — снег на крышах, under — всё колышется, stars — звёзды на небе
  const P = (земля, листва, ствол, камень, вода, стена, крыша, дерево, металл, ткань, акцент, огонь, свет) => ({ земля, листва, ствол, камень, вода, стена, крыша, дерево, металл, ткань, акцент, огонь, свет });
  const MOODS = {
    'день': { sky: '#8fd3f0', fog: 0.006, hemi: [0.75, '#ffffff', '#5a5a66'], sun: [0.9, '#fff6e6', [-0.45, -1, 0.4]], lit: 0, pal: P('#5fae4c', '#3f9a45', '#7a5232', '#9a9aa6', '#3fa8d8', '#f1e6cf', '#c0573a', '#b07a45', '#9aa6b8', '#d9534f', '#ffd23f', '#ff7a2a', '#ffe08a') },
    'утро': { sky: '#ffd1dc', fog: 0.008, hemi: [0.68, '#ffe0ea', '#6a5470'], sun: [0.75, '#ffc49a', [-0.8, -0.55, 0.3]], lit: 0.2, pal: P('#7fb86a', '#5aa060', '#8a5a40', '#b4a8b8', '#7ec8e8', '#f6e2d8', '#d9746a', '#c08a60', '#b0b4c8', '#e07a8a', '#ffb3c8', '#ff9a5a', '#fff0b0') },
    'закат': { sky: '#f08a5a', fog: 0.01, hemi: [0.55, '#ffb08a', '#4a3050'], sun: [0.85, '#ff8a4a', [0.85, -0.45, 0.35]], lit: 0.6, pal: P('#a8784a', '#6a7a3a', '#5a3324', '#a07a7a', '#e0805a', '#f0c89a', '#a8402a', '#a0603a', '#a08a8a', '#c0303a', '#ffb13d', '#ff5a2a', '#ffd06a') },
    'ночь': { sky: '#0b1430', fog: 0.008, hemi: [0.66, '#a8bcff', '#30284a'], sun: [0.55, '#c8d4ff', [-0.3, -1, 0.5]], lit: 1, stars: 1, pal: P('#1f3a30', '#163a2a', '#3a2a24', '#4a5068', '#1a3a6a', '#6a7090', '#4a3048', '#5a4030', '#5a6680', '#8a2f35', '#d8ff6a', '#ff9a3c', '#ffd96b') },
    'туман': { sky: '#9aa8a8', fog: 0.03, hemi: [0.8, '#d8e0e0', '#5a6060'], sun: [0.4, '#f0f0e8', [-0.4, -1, 0.3]], lit: 0.5, pal: P('#6a7a68', '#4a6050', '#4a4038', '#8a8e92', '#7a9aa0', '#c8c4b8', '#7a5a50', '#7a6a58', '#8a9098', '#9a5a5a', '#e0c060', '#ff8a4a', '#fff0c0') },
    'зима': { sky: '#bcd8f0', fog: 0.01, hemi: [0.82, '#eef4ff', '#6a7890'], sun: [0.8, '#fff6e8', [-0.5, -0.8, 0.4]], lit: 0.3, snow: 1, pal: P('#e8f0f8', '#2a6a50', '#5a4030', '#8a98b0', '#7fc0e8', '#f0e8e0', '#8a3a3a', '#9a6a48', '#a0b0c8', '#d03a40', '#ff5a5a', '#ff8a3a', '#ffe8a0') },
    'жара': { sky: '#ffe0a0', fog: 0.005, hemi: [0.85, '#fff0c8', '#7a6040'], sun: [1, '#fff0b0', [-0.2, -1, 0.2]], lit: 0, pal: P('#e0b060', '#8aa040', '#8a5a30', '#c8946a', '#3ac0c8', '#f8e0b0', '#c86a30', '#c08a50', '#c0a888', '#e05a30', '#ff6a3a', '#ff5a1a', '#fff0a0') },
    'неон': { sky: '#120a28', fog: 0.012, hemi: [0.42, '#b080ff', '#200838'], sun: [0.3, '#80e0ff', [-0.4, -1, 0.4]], lit: 1, neon: 1, stars: 0.5, pal: P('#1a1030', '#2a1a5a', '#3a2050', '#3a3460', '#1a3a6a', '#2a2048', '#ff3ad0', '#4a3060', '#5a6aa0', '#3af0ff', '#ff3ad0', '#ff6a3a', '#3af0ff') },
    'пастель': { sky: '#d8ecff', fog: 0.006, hemi: [0.9, '#fff4fa', '#8a90b0'], sun: [0.6, '#fff8f0', [-0.4, -1, 0.4]], lit: 0, pal: P('#bfe6c4', '#9fd8b0', '#d8b0a0', '#d0d0e8', '#a8dcf0', '#fff0f0', '#f0a8c0', '#e8c8a8', '#c8d0e8', '#f0b8d8', '#ffd88a', '#ffb08a', '#fff4c0') },
    'подводный': { sky: '#0e5a7a', fog: 0.025, hemi: [0.72, '#8ff0ff', '#0a3048'], sun: [0.6, '#9ff0ff', [-0.1, -1, 0.15]], lit: 0.5, under: 1, pal: P('#d8c890', '#3aa080', '#a06a8a', '#5a8a90', '#1a7aa0', '#4a9aa0', '#e06a8a', '#8a7060', '#7a9aa8', '#ff8a6a', '#ffd23f', '#ff7a5a', '#bff4ff') },
    'космос': { sky: '#05060f', fog: 0.002, hemi: [0.38, '#9aa8ff', '#101018'], sun: [1, '#ffffff', [-0.7, -0.7, 0.3]], lit: 1, stars: 2, pal: P('#6a6870', '#5a8a7a', '#4a4a58', '#8a8890', '#3a6aa0', '#d8dce8', '#e0e4f0', '#7a6a60', '#b8c0d0', '#e05a3a', '#5af0ff', '#ff7a3a', '#9af8ff') },
    'помещение': { sky: '#3a2a2a', fog: 0.004, hemi: [0.78, '#ffe8cc', '#5a4030'], sun: [0.6, '#fff0dc', [-0.3, -1, 0.5]], lit: 0.4, indoor: 1, pal: P('#b08458', '#5a9a50', '#7a5232', '#a8a098', '#5ab0d8', '#f0dcc0', '#c86a4a', '#a0683a', '#a8b0b8', '#c84a5a', '#ffc83a', '#ff7a2a', '#fff0c0') },
    'сон': { sky: '#6a5aa8', fog: 0.012, hemi: [0.72, '#e8d0ff', '#4a3a70'], sun: [0.5, '#ffc8f0', [-0.4, -1, 0.4]], lit: 0.7, stars: 0.6, pal: P('#9a8ac8', '#c0a0e8', '#b08ac0', '#c8c0e8', '#a0c8f0', '#f0e0ff', '#ff9ad8', '#d0a8c8', '#c0c8f0', '#ff8ac8', '#ffe08a', '#ffb08a', '#fff0ff') },
  };
  const ROLES = ['земля', 'земля2', 'листва', 'ствол', 'камень', 'вода', 'стена', 'крыша', 'дерево', 'металл', 'ткань', 'акцент', 'огонь', 'свет'];
  // чего нет в палитре — выводим из заданных цветов: светлее, темнее, сдвиг тона (а не свой серый)
  function derivePalette(given, base) {
    const p = {};
    for (const r of ROLES) if (hexOk(given[r])) p[r] = given[r].slice(0, 7);
    const has = r => !!p[r], any = (...rs) => rs.find(has);
    const from = (r, ...alts) => { for (const [src, fn] of alts) if (has(src)) return (p[r] = fn(p[src])); return (p[r] = base[r] || base.земля); };
    if (!has('земля')) from('земля', ['листва', h => C.dark(C.sat(C.hue(h, -10), 0.8), 0.15)], ['камень', h => C.hue(h, 15)]);
    if (!has('листва')) from('листва', ['земля', h => C.dark(C.sat(C.hue(h, 14), 1.15), 0.18)]);
    if (!has('земля2')) p.земля2 = C.hue(C.light(p.земля, 0.12), 8);
    if (!has('ствол')) from('ствол', ['дерево', h => C.dark(h, 0.35)], ['земля', h => C.dark(C.mix(h, '#6a4028', 0.6), 0.25)]);
    if (!has('дерево')) p.дерево = C.light(C.mix(p.ствол, p.земля2, 0.25), 0.22);
    if (!has('камень')) p.камень = C.light(C.sat(p.земля, 0.25), 0.25);
    if (!has('вода')) from('вода', ['свет', h => C.dark(C.hue(C.sat(h, 1.2), 160), 0.35)], ['земля', h => C.hue(C.sat(h, 1.3), 120)]);
    if (!has('стена')) p.стена = C.light(C.sat(p.земля2, 0.35), 0.62);
    if (!has('крыша')) from('крыша', ['акцент', h => C.dark(h, 0.25)], ['ткань', h => C.dark(h, 0.2)], ['дерево', h => C.dark(C.hue(h, -18), 0.1)]);
    if (!has('металл')) p.металл = C.light(C.sat(p.камень, 0.4), 0.15);
    if (!has('акцент')) p.акцент = C.light(C.sat(C.hue(p.земля, 180), 1.6), 0.25);
    if (!has('ткань')) p.ткань = C.hue(p.акцент, -30);
    if (!has('огонь')) p.огонь = C.mix(base.огонь || '#ff7a2a', p.акцент, 0.2);
    if (!has('свет')) p.свет = C.light(C.mix(base.свет || '#ffe08a', p.акцент, 0.25), 0.2);
    void any;
    // служебные роли: тоже из палитры
    p.снег = C.light(C.mix('#ffffff', p.вода, 0.08), 0.6);
    p.лёд = C.light(p.вода, 0.55);
    p.мох = C.dark(C.sat(p.листва, 1.1), 0.25);
    p.песок = C.light(C.sat(C.hue(p.земля, 20), 0.55), 0.38);
    p.тёмный = C.dark(C.mix(p.земля, p.камень, 0.5), 0.7);
    p.ржавчина = C.mix('#a0522d', p.дерево, 0.3);
    p.стекло = C.dark(C.mix(p.вода, '#9fd0ff', 0.4), 0.15);
    p.светлый = C.light(p.стена, 0.5);
    return p;
  }

  // формы-синонимы для языка формы
  const SHAPES = ['обычный', 'круглый', 'угловатый', 'острый', 'вытянутый', 'приземистый', 'кривой'];

  /* =====================================================================
     Набор для одного объекта lab (в game.html — один, в витрине — по набору на окно)
     ===================================================================== */
  function makeKit(lab) {
    let K = null; // состояние набора на текущей сцене: сцена пересоздаётся на каждую партию
    const warned = new Set();
    const warn = (key, text) => { if (warned.has(key)) return; warned.add(key); console.warn('[набор] ' + text); };
    function game() { try { return GAME; } catch (e) { return null; } } // eslint-disable-line no-undef
    function fresh(scene) {
      K = { scene, style: null, srcs: {}, mats: {}, creatures: [], kinds: [], sways: [], ambients: [], backs: [], marks: [], fx: [], heroColors: [], occupied: [], n: 0, time: 0 };
    }
    function need() { if (!K || K.scene !== lab.scene) fresh(lab.scene); return K; }
    function seedOf(extra) { const g = game(); return (hashStr((g && g.title) || 'игра') ^ (lab.seed || 0) ^ Math.imul(extra + 1, 2654435761)) >>> 0; }
    const posOf = a => (a && a.getAbsolutePosition) ? a.getAbsolutePosition() : (a instanceof B.Vector3 ? a : Array.isArray(a) ? new B.Vector3(a[0] || 0, a[1] || 0, a[2] || 0) : a ? new B.Vector3(a.x || 0, a.y || 0, a.z || 0) : new B.Vector3(0, 0, 0));
    function field() { const g = game(); const f = (g && g.field) || { w: 24, h: 24 }; return { w: f.w || 24, h: f.h || 24 }; }
    function camType() {
      const g = game(), c = g && g.camera, t = typeof c === 'string' ? c : c && c.type;
      if (lab.camera && lab.camera.beta != null && lab.camera.beta > 1.3) return 'side';
      return t || 'iso';
    }

    /* ---------------- стиль ---------------- */
    const DETAIL = { 'просто': 0, 'обычно': 1, 'богато': 2 }, WEAR = { 'новое': 0, 'старое': 1, 'заброшенное': 2 };
    function makeStyle(spec, quiet) {
      const mood = MOODS[spec.mood] ? spec.mood : 'день', M = MOODS[mood];
      let base = M.pal;
      if (quiet) { base = {}; for (const r in M.pal) base[r] = C.sat(M.pal[r], 0.45); }
      const pal = derivePalette(Object.assign({}, quiet ? base : {}, spec.palette || {}), base);
      return {
        mood, M, pal, quiet: !!quiet,
        shape: SHAPES.includes(spec.shape) ? spec.shape : 'обычный',
        detail: DETAIL[spec.detail] ?? (typeof spec.detail === 'number' ? clamp(spec.detail, 0, 2) : 1),
        wear: WEAR[spec.wear] ?? (typeof spec.wear === 'number' ? clamp(spec.wear, 0, 2) : 0),
        wind: clamp(spec.wind == null ? (M.under ? 0.6 : 0.25) : Number(spec.wind) || 0, 0, 1),
        night: M.lit >= 0.9, lit: M.lit, snow: !!M.snow || !!spec.snow, under: !!M.under, neon: !!M.neon, indoor: !!M.indoor,
      };
    }
    function style() {
      need();
      if (!K.style) { warn('style', 'lab.style не вызван: мир собран приглушённым. Вызови lab.style({ mood, palette, shape }) первым в start.'); K.style = makeStyle({}, true); }
      return K.style;
    }
    lab.style = function (spec = {}) {
      need();
      const S = K.style = makeStyle(spec || {}, false);
      if (spec.mood && !MOODS[spec.mood]) warn('mood:' + spec.mood, `Нет настроения «${spec.mood}». Есть: ${Object.keys(MOODS).join(', ')}`);
      const g = game() || {}, M = S.M, sc = K.scene, L = lab.light;
      if (L && L.hemi) {
        L.hemi.intensity = M.hemi[0]; L.hemi.diffuse = B.Color3.FromHexString(M.hemi[1]); L.hemi.groundColor = B.Color3.FromHexString(M.hemi[2]);
        L.sun.intensity = M.sun[0]; L.sun.diffuse = B.Color3.FromHexString(M.sun[1]); L.sun.direction = new B.Vector3(...M.sun[2]).normalize();
      }
      // небо и туман из GAME.sky и GAME.fog важнее настроения
      const sky = g.sky || M.sky;
      if (!g.sky && sc) sc.clearColor = B.Color4.FromHexString(M.sky + 'ff');
      if (g.fog == null && sc && !lab._kitNoFog) { sc.fogMode = B.Scene.FOGMODE_EXP2; sc.fogDensity = M.fog; sc.fogColor = B.Color3.FromHexString(sky.slice(0, 7)); }
      K.sky = sky.slice(0, 7);
      if (M.stars && !spec.noStars) addStars(M.stars);
      if (S.under) addRays();
      return S;
    };
    lab.pal = role => { const p = style().pal; return p[role] || (hexOk(role) ? role : p.акцент); };

    /* ---------------- материалы набора ---------------- */
    function vcMat(kind) {
      const key = 'vc:' + (kind || '');
      if (K.mats[key]) return K.mats[key];
      const m = new B.StandardMaterial('набор:' + key, K.scene);
      m.diffuseColor = new B.Color3(1, 1, 1);
      const shiny = kind === 'shiny' || kind === 'shiny2';
      m.specularColor = shiny ? new B.Color3(0.45, 0.45, 0.45) : new B.Color3(0.035, 0.035, 0.035);
      if (shiny) m.specularPower = 48;
      if (kind === 'two' || kind === 'shiny2') m.backFaceCulling = false;
      return (K.mats[key] = m);
    }
    function fxMat(hex, glow, alpha, unlit) {
      const key = [hex, glow || 0, alpha == null ? 1 : alpha, unlit ? 1 : 0].join('|');
      if (K.mats[key]) return K.mats[key];
      const m = new B.StandardMaterial('набор:' + key, K.scene), c = B.Color3.FromHexString(hex);
      m.diffuseColor = c; m.specularColor = new B.Color3(0.05, 0.05, 0.05);
      if (glow) m.emissiveColor = c.scale(Math.min(1, glow));
      if (alpha != null && alpha < 1) { m.alpha = alpha; m.backFaceCulling = false; }
      if (unlit) { m.disableLighting = true; m.emissiveColor = c; }
      return (K.mats[key] = m);
    }

    /* ---------------- геометрия: примитивы по габариту ---------------- */
    function custom(pos, ind) {
      const m = new B.Mesh('часть', K.scene), vd = new B.VertexData(), nor = [];
      vd.positions = pos; vd.indices = ind; B.VertexData.ComputeNormals(pos, ind, nor); vd.normals = nor;
      vd.applyToMesh(m, true); return m;
    }
    // треугольная призма вдоль X, вершина вверху: крыша, клин, гребень
    const PRISM = [[-0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0, 0.5, 0.5, 0], [0, 1, 2, 0, 2, 3, 0, 4, 1, 1, 4, 5, 3, 2, 5, 3, 5, 4, 0, 3, 4, 1, 5, 2]];
    // пандус: низ, задняя стенка, скат
    const WEDGE = [[-0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5], [0, 1, 2, 0, 2, 3, 3, 2, 5, 3, 5, 4, 0, 4, 1, 1, 4, 5, 0, 3, 4, 1, 5, 2]];
    const OCTA = [[0, 0.5, 0, 0.5, 0, 0, 0, 0, 0.5, -0.5, 0, 0, 0, 0, -0.5, 0, -0.5, 0], [0, 2, 1, 0, 3, 2, 0, 4, 3, 0, 1, 4, 5, 1, 2, 5, 2, 3, 5, 3, 4, 5, 4, 1]];
    function squircle(m, e) {
      const p = m.getVerticesData(B.VertexBuffer.PositionKind);
      for (let i = 0; i < p.length; i++) { const n = p[i] / 0.5; p[i] = Math.sign(n) * Math.pow(Math.abs(n), e) * 0.5; }
      m.setVerticesData(B.VertexBuffer.PositionKind, p); // set, не update: у мешей MeshBuilder буфер не обновляемый
    }
    function taper(m, k) {
      const p = m.getVerticesData(B.VertexBuffer.PositionKind);
      for (let i = 0; i < p.length; i += 3) { const t = clamp(p[i + 1] + 0.5, 0, 1), s = lerp(1, k, t); p[i] *= s; p[i + 2] *= s; }
      m.setVerticesData(B.VertexBuffer.PositionKind, p); // set, не update: у мешей MeshBuilder буфер не обновляемый
    }
    function fitY(m, a, b) {
      const p = m.getVerticesData(B.VertexBuffer.PositionKind);
      let lo = Infinity, hi = -Infinity;
      for (let i = 1; i < p.length; i += 3) { lo = Math.min(lo, p[i]); hi = Math.max(hi, p[i]); }
      for (let i = 1; i < p.length; i += 3) p[i] = a + (p[i] - lo) / Math.max(1e-6, hi - lo) * (b - a);
      m.setVerticesData(B.VertexBuffer.PositionKind, p); // set, не update: у мешей MeshBuilder буфер не обновляемый
    }
    // полубочка вдоль X: круглая крыша, свод
    function barrel(n) {
      const pos = [], ind = [], arc = [];
      for (let i = 0; i <= n; i++) { const a = Math.PI * i / n; arc.push([0.5 * Math.cos(a), -0.5 + Math.sin(a)]); }
      for (const x of [-0.5, 0.5]) for (const [z, y] of arc) pos.push(x, y, z);
      const N = n + 1;
      for (let i = 0; i < n; i++) ind.push(i, N + i, i + 1, i + 1, N + i, N + i + 1);
      for (let i = 1; i < n; i++) { ind.push(0, i, i + 1); ind.push(N, N + i + 1, N + i); }
      ind.push(0, n, N, N, n, N + n);
      return custom(pos, ind);
    }
    // язык формы меняет сам примитив: круглый — скругляет, угловатый — гранит, острый — заостряет
    function subst(form, shape, o) {
      if (o.keep) return { form, tess: o.tess };
      switch (shape) {
        case 'круглый': return ({ box: { form: 'rbox' }, prism: { form: 'rprism' }, ico: { form: 'sphere', seg: 5 }, octa: { form: 'sphere', seg: 4 }, cyl: { form: 'cyl', tess: 11 }, cone: { form: 'cone', tess: 10, top: 0.12 }, torus: { form: 'torus', tess: 14 }, blob: { form: 'sphere', seg: 6 }, pyramid: { form: 'cone', tess: 10 } })[form] || { form, seg: 6, tess: 11 };
        case 'угловатый': return ({ prism: { form: 'hprism' }, sphere: { form: 'box', bevel: 1 }, blob: { form: 'box', bevel: 1 }, ico: { form: 'box' }, capsule: { form: 'box' }, cyl: { form: 'cyl', tess: 4, rot45: 1 }, cone: { form: 'pyramid' }, torus: { form: 'torus', tess: 4 }, disc: { form: 'disc', tess: 4 }, hemi: { form: 'hbox' } })[form] || { form, tess: 5 };
        case 'острый': return ({ prism: { form: 'prism', tall: 1.5 }, sphere: { form: 'octa' }, blob: { form: 'octa' }, ico: { form: 'octa' }, box: { form: 'box', taper: 0.62 }, cyl: { form: 'cyl', tess: 5, top: 0.6 }, cone: { form: 'cone', tess: 4, tall: 1.25 }, capsule: { form: 'octa' }, hemi: { form: 'cone', tess: 5 }, rbox: { form: 'box', taper: 0.62 } })[form] || { form, tess: 5 };
        default: return { form: form === 'blob' ? 'sphere' : form, seg: 4, tess: 7 };
      }
    }
    function prim(form, s, o, sh) {
      const MB = B.MeshBuilder, sc = K.scene;
      let m, sx = s[0], sy = s[1], sz = s[2];
      const seg = o.seg || sh.seg || 4, tess = o.tess || sh.tess || 7;
      switch (sh.form) {
        case 'box': m = MB.CreateBox('часть', { size: 1 }, sc); if (sh.taper) taper(m, sh.taper); if (sh.bevel) { taper(m, 0.86); } break;
        case 'hbox': m = MB.CreateBox('часть', { size: 1 }, sc); taper(m, 0.7); break;
        case 'rbox': m = MB.CreateSphere('часть', { diameter: 1, segments: 3 }, sc); squircle(m, 0.38); break;
        case 'sphere': m = MB.CreateSphere('часть', { diameter: 1, segments: seg }, sc); break;
        case 'hemi': m = MB.CreateSphere('часть', { diameter: 1, segments: seg, slice: 0.5 }, sc); break;
        case 'cyl': m = MB.CreateCylinder('часть', { height: 1, diameterTop: o.top ?? sh.top ?? 1, diameterBottom: 1, tessellation: tess }, sc); if (sh.rot45) { m.rotation.y = Math.PI / 4; sx *= Math.SQRT2; sz *= Math.SQRT2; } break; // квадрат по габариту круга
        case 'cone': m = MB.CreateCylinder('часть', { height: 1, diameterTop: o.top ?? sh.top ?? 0, diameterBottom: 1, tessellation: Math.max(3, tess) }, sc); if (sh.tall) fitY(m, -0.5, sh.tall - 0.5); break;
        case 'pyramid': m = MB.CreateCylinder('часть', { height: 1, diameterTop: o.top || 0, diameterBottom: 1.41, tessellation: 4 }, sc); m.rotation.y = Math.PI / 4; break;
        case 'ico': m = MB.CreateIcoSphere('часть', { radius: 0.5, subdivisions: 1, flat: true }, sc); break;
        case 'octa': m = custom(OCTA[0].slice(), OCTA[1]); break;
        case 'torus': { const t = o.thick || 0.28; m = MB.CreateTorus('часть', { diameter: 1, thickness: t, tessellation: Math.max(4, tess + 4) }, sc); sx /= 1 + t; sz /= 1 + t; sy /= t; break; }
        case 'capsule': { const h0 = Math.max(1.02, sy / Math.max(sx, sz, 0.001)); m = MB.CreateCapsule('часть', { radius: 0.5, height: h0, tessellation: tess, capSubdivisions: 2 }, sc); sy /= h0; break; }
        case 'disc': m = MB.CreateDisc('часть', { radius: 0.5, tessellation: Math.max(3, o.tess || sh.tess || 12), sideOrientation: B.Mesh.DOUBLESIDE }, sc); m.rotation.x = Math.PI / 2; sy = 1; break;
        case 'prism': m = custom(PRISM[0].slice(), PRISM[1]); if (sh.tall) fitY(m, -0.5, sh.tall - 0.5); break; // острая крыша растёт вверх, основание на месте
        case 'rprism': m = barrel(10); break;
        case 'hprism': { const v = PRISM[0].slice(); v[12] = -0.22; v[15] = 0.22; m = custom(v, PRISM[1]); break; }
        case 'wedge': m = custom(WEDGE[0].slice(), WEDGE[1]); break;
        default: m = MB.CreateBox('часть', { size: 1 }, sc);
      }
      if (m.rotation.x || m.rotation.y) m.bakeCurrentTransformIntoVertices();
      if (o.taper && sh.form === 'box' && !sh.taper) taper(m, o.taper < 1 ? o.taper : 0.8);
      if (form === 'hemi' && sh.form !== 'hemi') fitY(m, 0, 0.5); // купол всегда от основания вверх, чем бы его ни заменил язык формы
      m.scaling.set(sx, sy, sz);
      return m;
    }
    // строка части: [форма, размер, где, поворот, цвет, { glow, alpha, shiny, snow, night, wear, d, keep }]
    function partMesh(row, ctx, i) {
      const [form, size, pos, rot, color, o0] = row, o = o0 || {};
      if (o.snow && !ctx.snow) return null;
      if (o.nosnow && ctx.snow) return null;
      if (o.night && !ctx.night) return null;
      if (o.day && ctx.night) return null;
      if (o.wear && ctx.wear < o.wear) return null;
      if (o.d && ctx.detail < o.d) return null;
      if (o.under && !ctx.under) return null;
      const s = arr3(size, 1), sh = subst(form, ctx.shape, o), m = prim(form, s, o, sh);
      const r = Array.isArray(rot) ? rot : [0, rot || 0, 0];
      m.rotation.set(r[0] || 0, r[1] || 0, r[2] || 0);
      if (ctx.shape === 'кривой' && !o.keep) { m.rotation.z += (ctx.rnd() - 0.5) * 0.22; m.rotation.x += (ctx.rnd() - 0.5) * 0.12; }
      if (ctx.wear && o.lean !== 0 && !o.keep && ctx.leanAll) { m.rotation.z += (ctx.rnd() - 0.5) * 0.18 * ctx.wear; }
      const p = arr3(pos, 0);
      m.position.set(p[0], p[1], p[2]);
      m.bakeCurrentTransformIntoVertices();
      m.convertToFlatShadedMesh();
      for (const k of ['uv', 'uv2']) if (m.isVerticesDataPresent(k)) m.removeVerticesData(k);
      const c = ctx.color(color, o);
      const n = m.getTotalVertices(), col = new Float32Array(n * 4);
      const base = c.white ? [1, 1, 1] : toRgb(c.hex);
      for (let v = 0; v < n; v++) {
        const f = Math.floor(v / 3), j = c.white ? 1 : 1 + ((Math.imul(f + 7 * i, 2654435761) >>> 0) / 4294967296 - 0.5) * 0.09;
        col[v * 4] = base[0] * j; col[v * 4 + 1] = base[1] * j; col[v * 4 + 2] = base[2] * j; col[v * 4 + 3] = 1;
      }
      m.setVerticesData(B.VertexBuffer.ColorKind, col);
      m._kitKey = c.key;
      return m;
    }
    // цвет части: роль палитры стиля, роль существа или hex. Роли «свет» и «огонь» светятся всегда, «окно» — ночью
    function colorer(extra) {
      const S = style();
      return (name, o) => {
        let hex = null, glow = o.glow || 0, alpha = o.alpha;
        if (extra && extra[name]) hex = extra[name];
        else if (hexOk(name)) hex = name.slice(0, 7);
        else if (name === 'окно') { if (S.lit > 0.15) { hex = S.pal.свет; glow = Math.max(glow, S.lit * 0.9); } else hex = S.pal.стекло; }
        else if (S.pal[name]) { hex = S.pal[name]; if ((name === 'свет' || name === 'огонь') && !o.noglow) glow = Math.max(glow, 0.85); if (S.neon && (name === 'акцент' || name === 'ткань' || name === 'крыша') && !o.noglow) glow = Math.max(glow, 0.55); }
        else { warn('color:' + name, `Нет цвета «${name}»: это не роль палитры и не #hex. Роли: ${ROLES.join(', ')}`); hex = '#9a9a9a'; }
        if (glow || (alpha != null && alpha < 1) || o.unlit) return { hex, key: `fx|${hex}|${glow}|${alpha ?? 1}|${o.unlit ? 1 : 0}`, white: true, glow, alpha, unlit: o.unlit };
        return { hex, key: o.shiny ? 'shiny' : 'vc' };
      };
    }
    // нормали после деформации всей сборки: у плоских граней вершины не общие — получаются нормали граней
    function renormal(m) {
      const p = m.getVerticesData(B.VertexBuffer.PositionKind), ind = m.getIndices(), nor = new Float32Array(p.length);
      B.VertexData.ComputeNormals(p, ind, nor);
      m.setVerticesData(B.VertexBuffer.NormalKind, nor); // set, не update: у мешей MeshBuilder буфер не обновляемый
    }
    // собрать части в один меш: цвета вершин и плоские грани; светящиеся и прозрачные — своими подмешами
    function assemble(name, rows, ctx) {
      const parts = [];
      rows.forEach((r, i) => { if (r) { const m = partMesh(r, ctx, i); if (m) parts.push(m); } });
      if (!parts.length) { const m = B.MeshBuilder.CreateBox(name, { size: 0.01 }, K.scene); m.isVisible = false; return m; }
      // общий габарит до деформации: по нему язык формы тянет, гнёт и подгоняет высоту
      let mnY = Infinity, mxY = -Infinity, mnX = Infinity, mxX = -Infinity, mnZ = Infinity, mxZ = -Infinity;
      for (const m of parts) {
        const p = m.getVerticesData(B.VertexBuffer.PositionKind);
        for (let i = 0; i < p.length; i += 3) { mnX = Math.min(mnX, p[i]); mxX = Math.max(mxX, p[i]); mnY = Math.min(mnY, p[i + 1]); mxY = Math.max(mxY, p[i + 1]); mnZ = Math.min(mnZ, p[i + 2]); mxZ = Math.max(mxZ, p[i + 2]); }
      }
      const H = Math.max(0.001, mxY - mnY), W = Math.max(mxX - mnX, mxZ - mnZ);
      const w = ctx.warp;
      if (w) {
        let { sx, sy, sz } = w;
        if (ctx.h) { const f = ctx.h / (H * sy); sx *= f; sy *= f; sz *= f; }
        if (ctx.w) { const f = ctx.w / (W * Math.max(sx, sz) || 1); sx *= f; sz *= f; }
        const bend = w.bend || 0, lean = w.lean || 0, twist = w.twist || 0;
        for (const m of parts) {
          const p = m.getVerticesData(B.VertexBuffer.PositionKind);
          for (let i = 0; i < p.length; i += 3) {
            const t = (p[i + 1] - mnY) / H;
            let x = p[i] * sx, z = p[i + 2] * sz;
            if (twist) { const a = twist * t, ca = Math.cos(a), sa = Math.sin(a); const nx = x * ca - z * sa; z = x * sa + z * ca; x = nx; }
            p[i] = x + (bend * t * t + lean * t) * H * sy * 0.12;
            p[i + 1] = p[i + 1] * sy;
            p[i + 2] = z + bend * 0.4 * t * t * H * sy * 0.08;
          }
          m.setVerticesData(B.VertexBuffer.PositionKind, p); // set, не update: у мешей MeshBuilder буфер не обновляемый
          renormal(m);
        }
      }
      // группы по материалу
      const groups = new Map();
      for (const m of parts) groups.set(m._kitKey, (groups.get(m._kitKey) || []).concat(m));
      const meshes = [], mats = [];
      for (const [key, list] of groups) {
        const g = list.length > 1 ? B.Mesh.MergeMeshes(list, true, true) : list[0];
        meshes.push(g);
        if (key === 'vc' || key === 'shiny') mats.push(vcMat(key === 'shiny' ? 'shiny' : ''));
        else { const [, hex, glow, alpha, unlit] = key.split('|'); mats.push(fxMat(hex, Number(glow), Number(alpha), unlit === '1')); }
      }
      let out;
      if (meshes.length === 1) { out = meshes[0]; out.material = mats[0]; }
      else {
        meshes.forEach((m, i) => { m.material = mats[i]; });
        out = B.Mesh.MergeMeshes(meshes, true, true, undefined, false, true);
      }
      out.name = name;
      out.isPickable = false;
      out.refreshBoundingInfo();
      const bb = out.getBoundingInfo().boundingBox;
      out.metadata = Object.assign({}, out.metadata, { kit: true, h: bb.maximum.y - bb.minimum.y, r: Math.max(bb.maximum.x - bb.minimum.x, bb.maximum.z - bb.minimum.z) / 2, top: bb.maximum.y });
      return out;
    }
    function warpOf(shape, rnd, lean) {
      const w = { 'вытянутый': [0.8, 1.34, 0.8], 'приземистый': [1.24, 0.7, 1.24], 'острый': [0.9, 1.12, 0.9], 'круглый': [1.16, 0.86, 1.16], 'угловатый': [1.06, 0.92, 1.06] }[shape] || [1, 1, 1];
      const o = { sx: w[0], sy: w[1], sz: w[2], bend: 0, lean: lean || 0 };
      if (shape === 'кривой') { o.bend = (rnd() < 0.5 ? -1 : 1) * (0.7 + rnd() * 0.6); o.twist = (rnd() - 0.5) * 0.6; o.sy *= 1.04; }
      return o;
    }
    function ctxOf(o = {}, S = style()) {
      const rnd = mulberry32(o.seed != null ? (o.seed >>> 0) : hashStr(o.key || 'часть'));
      return {
        shape: o.shape && SHAPES.includes(o.shape) ? o.shape : o.shape === 'как есть' ? 'обычный' : S.shape,
        detail: o.detail ?? S.detail, wear: o.wear ?? S.wear, snow: o.snow ?? S.snow, night: S.lit > 0.4, under: S.under,
        rnd, color: colorer(o.colors), h: o.h, w: o.w, leanAll: o.leanAll,
        warp: o.warp === false || o.shape === 'как есть' ? null : warpOf(o.shape && SHAPES.includes(o.shape) ? o.shape : S.shape, rnd, o.lean),
      };
    }

    /* ---------------- исходник и копии ---------------- */
    function Source(mesh, info = {}) {
      mesh.isVisible = false;
      if (info.noShadow) lab.noShadow ? lab.noShadow(mesh) : (mesh.metadata = Object.assign({}, mesh.metadata, { noShadow: true }));
      const src = {
        name: mesh.name, mesh, kind: info.kind || mesh.name, k: info.k || [1, 1, 1], lean: info.lean || 0, sway: !!info.sway,
        h: (mesh.metadata && mesh.metadata.h) || 1, r: (mesh.metadata && mesh.metadata.r) || 0.5,
        // копия: где — [x, y, z], Vector3 или меш; поворот — число (вокруг Y) или [x, y, z]; масштаб — число или [x, y, z]; родитель — узел
        copy(where, rot, scale, parent) {
          const me = this && this.mesh === mesh ? this : src;
          const inst = mesh.createInstance(me.kind);
          inst.position.copyFrom(posOf(where));
          const r = Array.isArray(rot) ? rot : [0, rot || 0, 0];
          inst.rotation.set((r[0] || 0), r[1] || 0, (r[2] || 0) + me.lean);
          const s = arr3(scale == null ? 1 : scale, 1);
          inst.scaling.set(s[0] * me.k[0], s[1] * me.k[1], s[2] * me.k[2]);
          if (parent) inst.parent = parent;
          else if (me.h * inst.scaling.y > 0.6) K.occupied.push({ x: inst.position.x, z: inst.position.z, r: me.r * Math.max(inst.scaling.x, inst.scaling.z) + 0.3 }); // россыпь обходит поставленное
          if (me.sway || style().under) addSway(inst, me.h * inst.scaling.y, info.swayK || 1);
          return inst;
        },
        // ещё один исходник того же меша с другим масштабом (вариант по размеру)
        sized(k) { const me = this && this.mesh === mesh ? this : src; return Object.assign(Object.create(me), { k: arr3(k, 1).map((x, i) => x * me.k[i]) }); },
      };
      return src;
    }
    lab.build = function (name, parts, opts = {}) {
      need();
      if (!Array.isArray(parts)) throw new Error('lab.build(имя, части): части — массив строк [форма, размер, где, поворот, цвет]');
      const ctx = ctxOf(Object.assign({ key: name, seed: hashStr(name) }, opts));
      const mesh = assemble(String(name || 'деталь'), parts, ctx);
      return Source(mesh, { kind: name, noShadow: opts.shadow === false, sway: !!opts.sway });
    };
    lab._kitNeed = need;

    /* ---------------- качание: ветер, подводное течение ---------------- */
    function addSway(node, h, k) {
      const S = style();
      if (!(S.wind > 0 || S.under)) return;
      K.sways.push({ node, base: node.rotation.clone(), ph: (node.position.x * 1.7 + node.position.z * 0.9), k: k * (S.under ? 1.6 : 1) / Math.max(0.6, Math.sqrt(h || 1)) });
    }
    function tickSways(dt) {
      if (!K.sways.length) return;
      const S = K.style || {}, w = (S.wind || 0) + (S.under ? 0.5 : 0), t = K.time;
      K.sways = K.sways.filter(s => {
        if (s.thin) { if (s.thin.isDisposed()) return false; tickThinSway(s, t, w); return true; }
        if (s.node.isDisposed()) return false;
        const a = Math.sin(t * 1.6 + s.ph) * 0.06 * w * s.k + Math.sin(t * 3.7 + s.ph * 2) * 0.015 * w * s.k;
        s.node.rotation.z = s.base.z + a; s.node.rotation.x = s.base.x + a * 0.5;
        return true;
      });
    }

    /* ---------------- звёзды и лучи (их добавляет настроение) ---------------- */
    function addStars(level) {
      if (K.stars) return;
      const star = assemble('звёзды', [['octa', 0.5, 0, 0, '#ffffff', { unlit: true, keep: 1 }]], ctxOf({ warp: false }));
      lab.noShadow ? lab.noShadow(star) : 0;
      const rnd = mulberry32(seedOf(77)), n = Math.round(60 + 120 * Math.min(level, 2)), M = new Float32Array(n * 16), mat = new B.Matrix();
      for (let i = 0; i < n; i++) {
        const a = rnd() * TAU, e = 0.12 + rnd() * 1.2, r = 160, s = 0.5 + rnd() * 1.6;
        B.Matrix.ComposeToRef(new B.Vector3(s, s, s), B.Quaternion.Identity(), new B.Vector3(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r * 0.8 + 6, Math.sin(a) * Math.cos(e) * r + 40), mat);
        mat.copyToArray(M, i * 16);
      }
      star.thinInstanceSetBuffer('matrix', M, 16, true);
      star.isVisible = true; star.applyFog = false; star.alwaysSelectAsActiveMesh = true;
      K.stars = star;
    }
    function addRays() {
      if (K.rays) return;
      const ray = assemble('лучи', [['cyl', [1, 1, 1], [0, 0.5, 0], 0, style().pal.свет, { alpha: 0.09, unlit: true, keep: 1, tess: 6, top: 0.4 }]], ctxOf({ warp: false }));
      lab.noShadow ? lab.noShadow(ray) : 0;
      const rnd = mulberry32(seedOf(91)), f = field(), n = 9, M = new Float32Array(n * 16), mat = new B.Matrix();
      for (let i = 0; i < n; i++) {
        const s = new B.Vector3(1.5 + rnd() * 3, 40, 1.5 + rnd() * 3), q = B.Quaternion.FromEulerAngles(0.25, 0, 0.12 * (rnd() - 0.5));
        B.Matrix.ComposeToRef(s, q, new B.Vector3((rnd() - 0.5) * f.w * 1.6, -6, (rnd() - 0.3) * f.h * 1.4), mat);
        mat.copyToArray(M, i * 16);
      }
      ray.thinInstanceSetBuffer('matrix', M, 16, true); ray.isVisible = true;
      K.rays = ray;
    }

    /* =====================================================================
       Библиотека заготовок. Вид = семья, высота по умолчанию и части по варианту силуэта v.
       В частях нет своих цветов: только роли палитры стиля или цвета, выведенные из неё.
       o: d — детальность 0–2, wr — износ 0–2, sn — снег, nt — ночь, r() — случай по зерну вида
       ===================================================================== */
    const ring = (n, r, f) => Array.from({ length: n }, (_, i) => f(Math.cos(i / n * TAU) * r, Math.sin(i / n * TAU) * r, i, i / n * TAU));
    const line = (n, len, f) => Array.from({ length: n }, (_, i) => f(n > 1 ? -len / 2 + len * i / (n - 1) : 0, i));
    const hay = p => C.light(C.mix(p.дерево, p.акцент, 0.45), 0.2);
    const clay = p => C.mix(p.крыша, p.земля2, 0.3);
    const redOf = p => C.hue(C.sat(p.огонь, 1.1), -16);
    const flat = a => [].concat(...a);
    const snowCap = (d, h, x, y, z, form) => [form || 'cone', [d, h, d], [x, y, z], 0, 'снег', { snow: 1 }];
    // сдвинуть и повернуть готовые строки (вариант «лёжа», «на стене»)
    const moved = (rows, f) => rows.map(r => r.slice(0, 2).concat([f(arr3(r[2]))]).concat(r.slice(3)));
    const PROPS = {
      /* ----- растения ----- */
      'ель': { fam: 'растения', h: 4.2, sway: 1, f(v, p, o) {
        const T = [[[2.4, 1.8, 1.5], [1.8, 1.5, 2.5], [1.2, 1.3, 3.4]], [[1.5, 3.2, 2.3], [0.9, 1.3, 3.6]], [[2.6, 1.2, 1.2], [2.1, 1.1, 2.0], [1.6, 1.0, 2.8], [1.0, 1.0, 3.5]], [[3.1, 1.7, 1.3], [2.1, 1.6, 2.4]]][v];
        const D = C.dark(p.листва, 0.16), leaf = o.wr >= 2 ? C.mix(p.листва, p.ствол, 0.45) : 'листва';
        return [['cyl', [0.3, 1, 0.3], [0, 0.5, 0], 0, 'ствол'],
          ...flat(T.map(([d, h, y], i) => { const x = v === 2 ? (i % 2 ? 0.12 : -0.1) : 0; return [['cone', [d, h, d], [x, y, 0], 0, o.d && i % 2 ? D : leaf], snowCap(d * 0.62, h * 0.42, x, y + h * 0.3, 0)]; })),
          ['box', [0.5, 0.08, 0.08], [0.3, 1.0, 0], [0, 0.4, -0.3], 'ствол', { wear: 1 }]];
      } },
      'пихта': { fam: 'растения', h: 4.8, sway: 1, f(v, p) {
        const n = v ? 6 : 5;
        return [['cyl', [0.28, 1, 0.28], [0, 0.5, 0], 0, 'ствол'], ...flat(Array.from({ length: n }, (_, i) => { const k = 1 - i / n, y = 0.9 + i * 0.68, d = 0.6 + k * (v ? 1.2 : 1.7); return [['cone', [d, 1.0, d], [0, y, 0], i * 0.5, i % 2 ? C.dark(p.листва, 0.12) : 'листва'], snowCap(0.4 + k * 0.9, 0.35, 0, y + 0.35, 0)]; })), ['cone', [0.4, 0.9, 0.4], [0, 0.9 + n * 0.68, 0], 0, 'листва']];
      } },
      'сосна': { fam: 'растения', h: 5.5, sway: 1, f(v, p) {
        const lean = v === 3 ? 0.28 : 0, top = v === 1 ? 4.2 : 4.6;
        const crown = [
          [['sphere', [2.2, 0.9, 2], [0, top, 0], 0, 'листва'], ['sphere', [1.6, 0.8, 1.4], [0.8, top - 0.7, 0.2], 0, C.dark(p.листва, 0.12)], ['sphere', [1.3, 0.7, 1.2], [-0.7, top - 1.1, -0.2], 0, 'листва']],
          [['cone', [3.2, 1.0, 3.2], [0, top, 0], 0, 'листва'], ['cone', [2.2, 0.8, 2.2], [0, top + 0.5, 0], 0, C.dark(p.листва, 0.1)]],
          [['sphere', [1.5, 0.8, 1.4], [0.6, top - 1.4, 0], 0, 'листва'], ['sphere', [1.4, 0.8, 1.3], [-0.5, top - 0.5, 0.1], 0, 'листва'], ['sphere', [1.2, 0.7, 1.1], [0.2, top + 0.2, 0], 0, C.dark(p.листва, 0.1)]],
          [['sphere', [2.0, 1.0, 1.8], [1.0, top - 0.2, 0], 0, 'листва'], ['sphere', [1.2, 0.7, 1.1], [0.2, top + 0.4, 0], 0, 'листва']]][v];
        return [['cyl', [0.34, top, 0.34], [lean * 1.8, top / 2, 0], [0, 0, -lean], C.mix(p.ствол, p.огонь, 0.25), { top: 0.7 }], ...crown, snowCap(1.4, 0.3, 0, top + 0.45, 0, 'sphere')];
      } },
      'лиственное': { fam: 'растения', h: 4, sway: 1, f(v, p) {
        const D = C.dark(p.листва, 0.14), L2 = C.light(C.hue(p.листва, 10), 0.08);
        const crown = [
          [['sphere', [2.8, 2.5, 2.8], [0, 2.7, 0], 0, 'листва']],
          [['sphere', [2.0, 1.8, 2.0], [0, 3.0, 0], 0, 'листва'], ['sphere', [1.7, 1.5, 1.7], [0.9, 2.3, 0.3], 0, D], ['sphere', [1.6, 1.5, 1.6], [-0.9, 2.4, -0.2], 0, L2]],
          [['sphere', [1.5, 3.6, 1.5], [0, 2.9, 0], 0, 'листва']],
          [['sphere', [3.8, 1.6, 3.4], [0, 2.6, 0], 0, 'листва'], ['sphere', [2.2, 1.0, 2.0], [0.4, 3.2, 0], 0, D]]][v];
        return [['cyl', [0.36, v === 2 ? 1.6 : 2, 0.36], [0, v === 2 ? 0.8 : 1, 0], 0, 'ствол', { top: 0.7 }], ['cyl', [0.14, 1, 0.14], [0.35, 1.7, 0], [0, 0, -0.7], 'ствол', { d: 1 }], ...crown,
          ['sphere', [0.18, 0.18, 0.18], [0.8, 2.9, 1.1], 0, 'акцент', { d: 2 }], ['sphere', [0.18, 0.18, 0.18], [-0.9, 2.6, 0.9], 0, 'акцент', { d: 2 }], ['sphere', [1.6, 0.35, 1.6], [0, 3.6, 0], 0, 'снег', { snow: 1 }],
          ['sphere', [0.6, 0.3, 0.5], [0.3, 0.1, 0.4], 0, 'мох', { wear: 1 }]];
      } },
      'тополь': { fam: 'растения', h: 6, sway: 1, f(v) {
        return [['cyl', [0.3, 1.2, 0.3], [0, 0.6, 0], 0, 'ствол'], ['capsule', [1.4, v ? 4.8 : 5.4, 1.4], [0, 3.3, 0], 0, 'листва'], ['capsule', [0.9, 2.4, 0.9], [0.45, 2.6, 0.2], 0, 'листва', { d: 1 }]];
      } },
      'берёза': { fam: 'растения', h: 5, sway: 1, f(v, p) {
        return [['cyl', [0.26, 3.4, 0.26], [0, 1.7, 0], [0, 0, v ? 0.12 : 0], C.light(p.стена, 0.5), { top: 0.75 }],
          ...line(4, 2.4, (y, i) => ['box', [0.28, 0.06, 0.12], [0.02 * i, y * 0.5 + 1.9, 0.09], 0, 'тёмный']),
          ['sphere', [1.6, 2.2, 1.5], [v ? 0.4 : 0, 3.8, 0], 0, C.light(p.листва, 0.12)], ['sphere', [1.2, 1.6, 1.2], [0.6, 3.1, 0.3], 0, 'листва']];
      } },
      'пальма': { fam: 'растения', h: 5, sway: 1, f(v, p) {
        const bend = v ? 0.3 : 0.12, tx = bend * 4, ty = 4.6;
        const segs = Array.from({ length: 6 }, (_, i) => ['cyl', [0.36 - i * 0.02, 0.75, 0.36 - i * 0.02], [Math.pow(i / 5, 2) * bend * 4, 0.38 + i * 0.72, 0], [0, 0, -bend * i / 5], i % 2 ? 'ствол' : C.light(p.ствол, 0.15)]);
        return [...segs, ...ring(v ? 7 : 6, 0, (x, z, i, a) => ['box', [2.4, 0.08, 0.6], [tx + Math.cos(a) * 1.1, ty - 0.25, Math.sin(a) * 1.1], [0, -a, 0.38], i % 2 ? 'листва' : C.dark(p.листва, 0.15)]),
          ['sphere', [0.3, 0.3, 0.3], [tx + 0.2, ty - 0.35, 0.1], 0, 'ствол'], ['sphere', [0.3, 0.3, 0.3], [tx - 0.15, ty - 0.4, -0.1], 0, 'ствол']];
      } },
      'сухое дерево': { fam: 'растения', h: 3.5, f(v) {
        if (v === 2) return [['cyl', [1.0, 0.7, 1.0], [0, 0.35, 0], 0, 'ствол', { top: 0.85 }], ['disc', [0.85, 0, 0.85], [0, 0.71, 0], 0, 'дерево'], ['box', [0.5, 0.2, 0.2], [0.55, 0.12, 0], [0, 0, -0.3], 'ствол'], ['sphere', [0.4, 0.2, 0.3], [-0.3, 0.72, 0.2], 0, 'мох', { wear: 1 }]];
        const br = [[['cyl', [0.16, 1.6, 0.16], [0.5, 2.8, 0], [0, 0, -0.55], 'ствол', { top: 0.4 }], ['cyl', [0.14, 1.4, 0.14], [-0.45, 2.9, 0], [0, 0, 0.5], 'ствол', { top: 0.4 }], ['cyl', [0.1, 0.9, 0.1], [0.1, 3.4, 0.3], [0.4, 0, 0], 'ствол', { top: 0.3 }]],
          [['cyl', [0.14, 1.5, 0.14], [0.6, 2.3, 0], [0, 0, -0.9], 'ствол', { top: 0.4 }], ['cyl', [0.12, 1.2, 0.12], [-0.4, 2.8, 0.2], [0.3, 0, 0.8], 'ствол', { top: 0.4 }], ['cyl', [0.1, 1.0, 0.1], [0.3, 3.3, -0.2], [-0.3, 0, -0.3], 'ствол', { top: 0.3 }]],
          null,
          ring(5, 0, (x, z, i, a) => ['cyl', [0.08, 0.6, 0.08], [Math.cos(a) * 0.25, 1.4 + i * 0.5, Math.sin(a) * 0.25], [Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2], 'ствол', { top: 0.3 }])][v];
        return [['cyl', [0.42, v === 3 ? 4 : 2.6, 0.42], [0, v === 3 ? 2 : 1.3, 0], [0, 0, v === 1 ? 0.12 : 0], 'ствол', { top: 0.55 }], ...br, ['box', [0.7, 0.12, 0.3], [0.1, 0.06, 0.3], 0.4, 'ствол', { d: 1 }]];
      } },
      'куст': { fam: 'растения', h: 1.1, sway: 1, f(v, p) {
        const D = C.dark(p.листва, 0.14), blobs = [[[1.2, 1.0, 1.1, 0, 0.5, 0], [0.9, 0.8, 0.9, 0.55, 0.4, 0.2], [0.8, 0.7, 0.8, -0.5, 0.38, -0.1]], [[1.0, 0.6, 0.9, -0.8, 0.3, 0], [1.1, 0.7, 1.0, 0, 0.35, 0.1], [1.0, 0.6, 0.9, 0.85, 0.3, -0.1], [0.7, 0.5, 0.7, 0.3, 0.6, -0.2]], [[1.3, 1.0, 1.2, 0, 0.5, 0], [0.8, 0.7, 0.8, 0.5, 0.75, 0]], [[1.1, 0.9, 1.0, 0, 0.45, 0], [0.9, 0.8, 0.9, -0.5, 0.4, 0.2]]][v];
        const dots = v >= 2 ? ring(7, 0.55, (x, z, i) => ['sphere', [0.14, 0.14, 0.14], [x, 0.55 + (i % 3) * 0.15, z], 0, v === 2 ? 'акцент' : 'ткань']) : [];
        return [...blobs.map(([a, b, c, x, y, z], i) => ['blob', [a, b, c], [x, y, z], 0, i % 2 ? D : 'листва']), ...dots, ['sphere', [1.0, 0.25, 0.9], [0, 0.95, 0], 0, 'снег', { snow: 1 }]];
      } },
      'трава-пучок': { fam: 'растения', h: 0.7, sway: 1, f(v, p) {
        const n = [7, 9, 5, 6][v], G2 = C.light(p.листва, 0.12);
        return [...ring(n, v === 1 ? 0.22 : 0.08, (x, z, i, a) => ['cone', [0.09, (v === 2 ? 1.3 : 0.6) * (0.7 + (i % 3) * 0.2), 0.04], [x, (v === 2 ? 0.6 : 0.3), z], [Math.sin(a) * 0.25, a, -Math.cos(a) * 0.25], i % 2 ? G2 : 'листва', { keep: 1, tess: 3 }]),
          ...(v === 2 ? ring(3, 0.1, (x, z) => ['capsule', [0.07, 0.25, 0.07], [x, 1.25, z], 0, 'ствол']) : []),
          ...(v === 3 ? ring(3, 0.12, (x, z) => ['sphere', [0.09, 0.09, 0.09], [x, 0.45, z], 0, 'акцент']) : [])];
      } },
      'цветы-поляна': { fam: 'растения', h: 0.5, sway: 1, f(v, p, o) {
        const cols = ['акцент', 'ткань', 'свет', C.hue(p.ткань, 40)], n = v === 3 ? 12 : 9;
        const rows = [['disc', [2.2, 0, 1.8], [0, 0.015, 0], 0, C.dark(p.листва, 0.08)]];
        for (let i = 0; i < n; i++) {
          const x = (o.r() - 0.5) * 1.8, z = (o.r() - 0.5) * 1.4, h = 0.25 + o.r() * 0.3, c = cols[(i + v) % (v === 1 ? 2 : 4)];
          if (v !== 3) rows.push(['cyl', [0.03, h, 0.03], [x, h / 2, z], 0, 'листва', { keep: 1, tess: 3 }]);
          if (v === 0) rows.push(['disc', [0.22, 0, 0.22], [x, h, z], [0.3, 0, 0], 'светлый'], ['sphere', [0.09, 0.06, 0.09], [x, h + 0.02, z], 0, 'акцент']);
          else if (v === 1) rows.push(['cone', [0.14, 0.18, 0.14], [x, h + 0.06, z], [Math.PI, 0, 0], c, { top: 0.6 }]);
          else if (v === 2) rows.push(['sphere', [0.15, 0.12, 0.15], [x, h, z], 0, c]);
          else rows.push(['sphere', [0.18, 0.08, 0.18], [x, 0.06, z], 0, i % 3 ? 'листва' : c]);
        }
        return rows;
      } },
      'подсолнух': { fam: 'растения', h: 2, sway: 1, f(v, p) {
        const one = (x, z, h, k, droop) => [['cyl', [0.07, h, 0.07], [x, h / 2, z], 0, 'листва', { keep: 1, tess: 5 }], ['box', [0.4, 0.04, 0.22], [x + 0.18, h * 0.45, z], [0, 0, 0.4], 'листва'], ['box', [0.36, 0.04, 0.2], [x - 0.16, h * 0.62, z], [0, 0, -0.4], 'листва', { d: 1 }],
          ['cyl', [0.7 * k, 0.07, 0.7 * k], [x, h + 0.05, z + 0.12], [Math.PI / 2 - droop, 0, 0], 'акцент', { tess: 12 }], ['cyl', [0.36 * k, 0.1, 0.36 * k], [x, h + 0.05, z + 0.16], [Math.PI / 2 - droop, 0, 0], C.dark(p.ствол, 0.2), { tess: 10 }]];
        return flat([[one(0, 0, 1.8, 1, 0.3)], [one(0, 0, 1.7, 1, 1.0)], [one(0, 0, 1.6, 0.8, 0.2), one(0.5, -0.2, 1.3, 0.7, 0.4), one(-0.45, 0.15, 2.0, 0.85, 0.25)], [one(0, 0, 1.0, 1.3, 0.2)]][v]);
      } },
      'кукуруза': { fam: 'растения', h: 2.2, sway: 1, f(v) {
        const stalk = x => [['cyl', [0.08, 2, 0.08], [x, 1, 0], 0, 'листва', { keep: 1, tess: 5 }], ...[0.5, 0.9, 1.3].map((y, i) => ['box', [0.7, 0.03, 0.12], [x + (i % 2 ? 0.3 : -0.3), y, 0], [0, i, i % 2 ? -0.5 : 0.5], 'листва']), ['capsule', [0.14, 0.4, 0.14], [x + 0.1, 1.2, 0.08], [0, 0, -0.3], 'акцент']];
        return flat(v ? [stalk(-0.4), stalk(0.4)] : [stalk(0)]);
      } },
      'бахча': { fam: 'растения', h: 0.6, f(v, p) {
        const melon = v ? C.light(C.mix(p.огонь, p.акцент, 0.5), 0.1) : C.dark(p.листва, 0.1);
        return [['sphere', [v ? 0.8 : 0.9, v ? 0.55 : 0.6, v ? 0.8 : 0.7], [0, 0.28, 0], 0, melon], ...(v ? [] : line(4, 0.6, x => ['box', [0.06, 0.62, 0.72], [x, 0.29, 0], 0, C.light(p.листва, 0.15)])), ['cyl', [0.06, 0.15, 0.06], [0, 0.6, 0], 0, 'ствол'], ['box', [0.4, 0.03, 0.25], [0.3, 0.05, 0.4], 0.5, 'листва']];
      } },
      'грядка': { fam: 'растения', h: 0.5, f(v, p) {
        const rows = [['box', [2.4, 0.3, 1.2], [0, 0.15, 0], 0, C.dark(p.земля, 0.35)], ['box', [2.5, 0.12, 0.1], [0, 0.22, 0.6], 0, 'дерево', { d: 1 }], ['box', [2.5, 0.12, 0.1], [0, 0.22, -0.6], 0, 'дерево', { d: 1 }]];
        for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) {
          const x = -0.9 + i * 0.45, z = -0.25 + j * 0.5;
          if (v === 0) rows.push(['cone', [0.16, 0.3, 0.16], [x, 0.45, z], 0, 'листва', { tess: 4 }]);
          if (v === 1) rows.push(['sphere', [0.36, 0.3, 0.36], [x, 0.42, z], 0, C.light(p.листва, 0.2)]);
          if (v === 2) rows.push(['cone', [0.1, 0.25, 0.1], [x, 0.42, z], 0, 'листва'], ['cone', [0.12, 0.2, 0.12], [x, 0.32, z], [Math.PI, 0, 0], 'акцент', { d: 1 }]);
          if (v === 3 && (i + j) % 2) rows.push(['sphere', [0.3, 0.25, 0.3], [x, 0.4, z], 0, 'листва'], ['box', [0.03, 0.5, 0.03], [x + 0.15, 0.5, z], 0, 'дерево']);
        }
        return rows;
      } },
      'лиана': { fam: 'растения', h: 3, sway: 1, f(v) {
        return [...Array.from({ length: 7 }, (_, i) => ['capsule', [0.08, 0.5, 0.08], [Math.sin(i * 0.9) * 0.15 * (v + 1), 3 - i * 0.42, 0], [0, 0, Math.cos(i * 0.9) * 0.3], 'листва']), ...Array.from({ length: 5 }, (_, i) => ['box', [0.25, 0.02, 0.16], [0.12, 2.8 - i * 0.55, 0], [0, 0, 0.4], 'листва', { d: 1 }])];
      } },
      'кактус': { fam: 'растения', h: 1.8, f(v, p) {
        const G = 'листва', arms = v === 0 ? [['capsule', [0.3, 0.7, 0.3], [0.38, 1.0, 0], 0, G], ['capsule', [0.26, 0.6, 0.26], [-0.36, 1.25, 0], 0, G], ['capsule', [0.4, 0.2, 0.2], [0.25, 0.75, 0], [0, 0, Math.PI / 2], G], ['capsule', [0.36, 0.18, 0.18], [-0.22, 1.0, 0], [0, 0, Math.PI / 2], G]] : v === 1 ? [] : ring(3, 0.4, (x, z) => ['capsule', [0.35, 0.6, 0.35], [x, 0.3, z], 0, G]);
        return [['capsule', [v === 1 ? 0.8 : 0.45, v === 1 ? 0.9 : 1.7, v === 1 ? 0.8 : 0.45], [0, v === 1 ? 0.45 : 0.85, 0], 0, G], ...arms, ['sphere', [0.2, 0.12, 0.2], [0, v === 1 ? 0.9 : 1.72, 0], 0, 'акцент', { d: 1 }], ...(v === 3 ? [['cyl', [0.9, 0.25, 0.9], [0, 0.12, 0], 0, clay(p)]] : [])];
      } },
      'гриб': { fam: 'растения', h: 1.2, f(v) {
        const cap = v === 1 ? 'акцент' : 'крыша', one = (x, z, k, tall) => [['cyl', [0.32 * k, tall * k, 0.32 * k], [x, tall * k / 2, z], 0, 'светлый', { top: 0.8 }], ['hemi', [1.0 * k, 0.6 * k, 1.0 * k], [x, tall * k * 0.95, z], 0, cap], ...ring(4, 0.28 * k, (a, b) => ['sphere', [0.12 * k, 0.06 * k, 0.12 * k], [x + a, tall * k + 0.28 * k, z + b], 0, 'светлый', { d: 1 }]), ['sphere', [0.7 * k, 0.15 * k, 0.7 * k], [x, tall * k + 0.3 * k, z], 0, 'снег', { snow: 1 }]];
        return flat([[one(0, 0, 1, 0.7)], [one(0, 0, 0.8, 1.4)], [one(0, 0, 0.7, 0.7), one(0.45, 0.2, 0.45, 0.7), one(-0.35, -0.2, 0.5, 0.8)], [one(0, 0, 1.4, 0.35)]][v]);
      } },
      'кувшинка': { fam: 'растения', h: 0.2, f(v, p) {
        return [['disc', [1.0, 0, 1.0], [0, 0.02, 0], 0, 'листва', { tess: 10 }], ['disc', [0.7, 0, 0.7], [0.7, 0.02, 0.4], 0, C.light(p.листва, 0.1), { d: 1 }], ...(v ? [] : [['cone', [0.3, 0.2, 0.3], [0.1, 0.12, 0], 0, 'ткань', { top: 0.6, tess: 6 }], ['sphere', [0.1, 0.08, 0.1], [0.1, 0.2, 0], 0, 'акцент']])];
      } },
      'тростник': { fam: 'растения', h: 2, sway: 1, f(v) {
        return [...ring(v ? 7 : 5, 0.18, (x, z, i) => ['cyl', [0.05, 1.6 + (i % 3) * 0.3, 0.05], [x, 0.8 + (i % 3) * 0.15, z], [0, 0, (i - 2) * 0.05], 'листва', { keep: 1, tess: 4 }]), ...ring(3, 0.15, (x, z, i) => ['capsule', [0.1, 0.35, 0.1], [x, 1.8 + i * 0.12, z], 0, 'ствол'])];
      } },
      'водоросль': { fam: 'растения', h: 3, sway: 1, f(v, p) {
        const D = C.dark(p.листва, 0.15), n = [7, 4, 6, 5][v];
        if (v === 1) return ring(5, 0.2, (x, z, i, a) => ['capsule', [0.2, 1.2, 0.1], [x, 0.6, z], [Math.sin(a) * 0.3, a, -Math.cos(a) * 0.3], i % 2 ? D : 'листва']);
        return flat([0, 1].slice(0, v === 2 ? 2 : 1).map(s => Array.from({ length: n }, (_, i) => ['capsule', [0.32, 0.6, 0.12], [Math.sin(i * 1.1 + s) * 0.2 + s * 0.4, 0.3 + i * 0.5, 0], [0, s, Math.sin(i * 1.1) * 0.25], i % 2 ? D : 'листва']))).concat(v === 3 ? [['sphere', [0.22, 0.22, 0.22], [0, 0.3 + n * 0.5, 0], 0, 'акцент', { glow: 0.4 }]] : []);
      } },
      'коралл ветвистый': { fam: 'растения', h: 1.6, f(v, p) {
        const c1 = 'ткань', c2 = C.light(p.ткань, 0.2);
        if (v === 1) return ring(6, 0.25, (x, z, i) => ['cyl', [0.22, 0.6 + (i % 3) * 0.35, 0.22], [x, 0.3 + (i % 3) * 0.17, z], 0, i % 2 ? c1 : c2, { top: 0.85 }]);
        if (v === 2) return [['cyl', [0.12, 0.4, 0.12], [0, 0.2, 0], 0, c1], ['disc', [1.6, 0, 1.2], [0, 0.9, 0], [Math.PI / 2, 0, 0], c2, { tess: 9 }], ...ring(5, 0.5, (x, z) => ['sphere', [0.14, 0.14, 0.14], [x, 0.9 + z, 0.05], 0, 'акцент', { d: 1 }])];
        const br = (x, y, z, rx, rz, l) => ['cyl', [0.14, l, 0.14], [x, y, z], [rx, 0, rz], c1, { top: 0.6 }];
        const tips = ring(5, 0.5, (x, z) => ['sphere', v === 3 ? [0.22, 0.22, 0.22] : [0.16, 0.16, 0.16], [x, 1.25, z], 0, v === 3 ? 'акцент' : c2, v === 3 ? { glow: 0.3 } : {}]);
        return [br(0, 0.35, 0, 0, 0, 0.7), ...ring(5, 0.25, (x, z, i, a) => br(x, 0.95, z, Math.sin(a) * 0.6, -Math.cos(a) * 0.6, 0.7)), ...tips];
      } },
      'коралл-шар': { fam: 'растения', h: 1, f(v, p) {
        return [['sphere', [1.1, 0.9, 1.1], [0, 0.45, 0], 0, v ? 'акцент' : 'ткань', { seg: 6 }], ...ring(6, 0.35, (x, z) => ['box', [0.5, 0.05, 0.05], [x, 0.85, z], Math.atan2(z, x), C.dark(p.ткань, 0.25), { d: 1 }])];
      } },
      'новогодняя ёлка': { fam: 'праздник', h: 4.6, f(v, p) {
        const base = PROPS['ель'].f(0, p, { d: 1, wr: 0, sn: 0, r: () => 0.5 });
        const balls = [[0.9, 1.2, 0.9], [-0.8, 1.5, 0.7], [0.5, 2.3, 0.7], [-0.4, 2.6, 0.6], [0.3, 3.2, 0.4], [-0.9, 1.1, -0.5], [0.8, 1.6, -0.6]].map(([x, y, z], i) => ['sphere', [0.24, 0.24, 0.24], [x, y, z], 0, ['акцент', 'ткань', 'свет', 'огонь'][i % 4], { glow: 0.5 }]);
        return [...base, ...balls, ['octa', [0.5, 0.6, 0.2], [0, 4.2, 0], 0, 'свет', { glow: 1 }], ...(v ? [['box', [0.5, 0.4, 0.5], [0.9, 0.2, 0.6], 0.3, 'ткань'], ['box', [0.4, 0.35, 0.4], [-0.8, 0.18, 0.8], -0.2, 'акцент']] : [])];
      } },

      /* ----- камень и рельеф ----- */
      'валун': { fam: 'камень', h: 1.2, f(v, p) {
        const D = C.dark(p.камень, 0.12), S = [[['ico', [1.6, 1.2, 1.4], [0, 0.55, 0], 0.4, 'камень']], [['ico', [2.0, 0.7, 1.5], [0, 0.32, 0], 0.2, 'камень']], [['ico', [1.3, 1.0, 1.2], [-0.35, 0.45, 0], 0.4, 'камень'], ['ico', [0.8, 0.7, 0.8], [0.6, 0.32, 0.25], 1, D]], [['ico', [0.9, 1.8, 0.8], [0, 0.85, 0], [0, 0.3, 0.06], 'камень']]][v];
        const top = v === 3 ? 1.72 : v === 1 ? 0.64 : 1.06;
        return [...S, ['sphere', [0.9, 0.18, 0.7], [0, top, 0], 0, 'мох', { wear: 1 }], ['sphere', [1.0, 0.2, 0.8], [0, top + 0.02, 0], 0, 'снег', { snow: 1 }]];
      } },
      'галька': { fam: 'камень', h: 0.25, f(v, p, o) {
        const rows = [];
        for (let i = 0; i < 7; i++) {
          const a = i / 7 * TAU + o.r(), r = v === 1 ? 0 : 0.5 * o.r() + 0.15, x = v === 1 ? -0.9 + i * 0.3 : Math.cos(a) * r, z = v === 1 ? (o.r() - 0.5) * 0.15 : Math.sin(a) * r, s = 0.18 + o.r() * 0.2;
          rows.push(['ico', [s * 1.3, v === 3 ? s * 0.3 : s * 0.7, s], [x, v === 2 ? s * 0.4 + (i < 3 ? 0.15 : 0) : s * 0.3, z], o.r() * 3, i % 2 ? 'камень' : C.light(p.камень, 0.15)]);
        }
        return rows;
      } },
      'плита': { fam: 'камень', h: 0.4, f(v) {
        return [['box', [v ? 1.2 : 2.0, 0.3, v ? 1.6 : 1.2], [0, 0.15, 0], v ? 0.4 : 0, 'камень'], ['box', [0.05, 0.31, 0.8], [0.3, 0.15, 0], 0.3, 'тёмный', { wear: 1 }]];
      } },
      'острый камень': { fam: 'камень', h: 1.8, f(v, p) {
        return [['cone', [1.0, 1.8, 0.8], [0, 0.9, 0], [0, 0.3, 0.08], 'камень', { tess: 4 }], ...(v ? [['cone', [0.6, 1.1, 0.5], [0.55, 0.55, 0.2], [0, 1, -0.2], C.dark(p.камень, 0.1), { tess: 4 }]] : [])];
      } },
      'скала-утёс': { fam: 'камень', h: 6, f(v, p) {
        const D = C.dark(p.камень, 0.14), L = C.light(p.камень, 0.08);
        const S = [
          [['box', [3, 2.4, 2.6], [0, 1.2, 0], 0.1, 'камень'], ['box', [2.6, 2.2, 2.2], [0.2, 3.4, 0.1], -0.15, D], ['box', [2.0, 1.8, 1.8], [-0.1, 5.3, 0], 0.2, L]],
          [['box', [2.4, 4, 2.2], [0, 2, 0], 0, 'камень'], ['box', [3.6, 1.4, 2.4], [0.7, 4.6, 0], 0, D], ['box', [3.2, 0.3, 2.2], [0.7, 5.4, 0], 0, 'листва']],
          [['box', [1.4, 5.6, 1.4], [-0.8, 2.8, 0], 0.2, 'камень'], ['box', [1.2, 4.2, 1.2], [0.9, 2.1, 0.2], -0.3, D], ['cone', [1.4, 1.0, 1.4], [-0.8, 6.0, 0], 0.2, L, { tess: 4 }]],
          [['box', [5, 3.2, 3.8], [0, 1.6, 0], 0, 'камень'], ['box', [4.4, 1.2, 3.4], [0, 3.8, 0], 0.08, D], ['box', [4.5, 0.3, 3.5], [0, 4.5, 0], 0.08, 'листва']]][v];
        return [...S, ['box', [v === 2 ? 1.2 : 3, 0.3, v === 2 ? 1.2 : 2.5], [v === 2 ? -0.8 : 0, [6.3, 5.6, 6.5, 4.7][v], 0], 0.1, 'снег', { snow: 1 }], ['sphere', [1.2, 0.3, 0.8], [0.6, 2.45, 0.9], 0, 'мох', { wear: 1 }]];
      } },
      'гора': { fam: 'камень', h: 22, far: 1, f(v, p) {
        const D = C.dark(p.камень, 0.15);
        if (v === 3) return [['cyl', [26, 9, 20], [0, 4.5, 0], 0, 'камень', { top: 0.7, tess: 7 }], ['cyl', [17, 2, 13], [0, 9.5, 0], 0, D, { top: 0.9, tess: 7 }]];
        const peaks = v === 2 ? [[0, 22, 18], [10, 15, 13]] : [[0, 22, 20]];
        return flat(peaks.map(([x, h, d]) => [['cone', [d, h, d * 0.9], [x, h / 2, 0], 0.3, 'камень', { tess: 6 }], ...(v === 1 ? [['cone', [d * 0.7, h * 0.6, d * 0.6], [x + d * 0.2, h * 0.3, d * 0.15], 1, D, { tess: 5 }]] : [['cone', [d * 0.42, h * 0.32, d * 0.4], [x, h * 0.84, 0], 0.3, 'снег', { tess: 6, nosnow: 0 }]])]));
      } },
      'холм': { fam: 'камень', h: 4, far: 1, f(v, p) {
        const S = [[['sphere', [12, 6, 10], [0, 0, 0], 0, 'земля2', { seg: 6 }]], [['sphere', [18, 5, 8], [0, 0, 0], 0.3, 'земля2', { seg: 6 }]], [['sphere', [10, 6, 9], [-4, 0, 0], 0, 'земля2', { seg: 6 }], ['sphere', [9, 5, 8], [4, 0, 1], 0, C.dark(p.земля2, 0.08), { seg: 6 }]], [['sphere', [11, 5, 10], [0, 0, 0], 0, 'земля2', { seg: 6 }], ['sphere', [2.2, 2.4, 2.2], [0.5, 3.4, 0], 0, 'листва'], ['cyl', [0.3, 1, 0.3], [0.5, 2.4, 0], 0, 'ствол']]][v];
        return [...S, ['sphere', [7, 1.5, 6], [0, 2.2, 0], 0, 'снег', { snow: 1 }]];
      } },
      'карстовая воронка': { fam: 'камень', h: 0.6, f(v, p) {
        return [['torus', [4, 0.6, 4], [0, 0.1, 0], 0, 'земля2', { thick: 0.4 }], ['disc', [3, 0, 3], [0, 0.02, 0], 0, C.dark(p.земля, 0.5)], ...(v ? ring(5, 1.9, (x, z) => ['ico', [0.5, 0.4, 0.5], [x, 0.2, z], 0, 'камень']) : [])];
      } },
      'сталагмит': { fam: 'камень', h: 2.2, f(v, p) {
        const D = C.dark(p.камень, 0.12);
        if (v === 2) return [['cone', [0.8, 1.4, 0.8], [0, 0.7, 0], 0, 'камень', { top: 0.3 }], ['cone', [0.8, 1.4, 0.8], [0, 2.4, 0], [Math.PI, 0, 0], D, { top: 0.3 }], ['cyl', [0.3, 0.5, 0.3], [0, 1.5, 0], 0, 'камень']];
        if (v === 3) return line(3, 0.6, (x, i) => ['capsule', [0.4 - i * 0.08, 1.4 - i * 0.3, 0.4 - i * 0.08], [x, 0.7 - i * 0.15, 0], 0, i % 2 ? D : 'камень']);
        return v ? ring(4, 0.35, (x, z, i) => ['cone', [0.45, 1 + i * 0.35, 0.45], [x, 0.5 + i * 0.18, z], 0, i % 2 ? D : 'камень', { tess: 6 }]).concat([['cone', [0.6, 2.2, 0.6], [0, 1.1, 0], 0, 'камень']]) : [['cone', [0.8, 2.2, 0.8], [0, 1.1, 0], 0, 'камень', { tess: 7 }], ['cone', [0.4, 0.8, 0.4], [0.35, 0.4, 0.1], 0, D]];
      } },
      'сталактит': { fam: 'камень', h: 2, f(v, p) {
        return (v ? ring(4, 0.35, (x, z, i) => ['cone', [0.4, 1 + i * 0.3, 0.4], [x, -(0.5 + i * 0.15), z], [Math.PI, 0, 0], i % 2 ? C.dark(p.камень, 0.12) : 'камень']) : []).concat([['cone', [0.7, 2, 0.7], [0, -1, 0], [Math.PI, 0, 0], 'камень'], ['sphere', [0.12, 0.16, 0.12], [0, -2.1, 0], 0, 'вода', { glow: 0.2, d: 1 }]]);
      } },
      'кристалл': { fam: 'камень', h: 1.6, f(v, p) {
        const g = { glow: 0.45 }, L = C.light(p.акцент, 0.25), one = (x, z, h, w, rx, rz, c) => ['octa', [w, h, w], [x, h / 2, z], [rx, 0, rz], c || 'акцент', g];
        if (v === 2) return ring(6, 0.8, (x, z, i, a) => one(x, z, 0.9 + (i % 2) * 0.5, 0.35, Math.sin(a) * 0.3, -Math.cos(a) * 0.3, i % 2 ? L : 'акцент')).concat([['torus', [1.8, 0.2, 1.8], [0, 0.08, 0], 0, 'камень']]);
        if (v === 3) return [['hemi', [1.4, 0.7, 1.4], [0, 0, 0], 0, 'камень'], ...ring(5, 0.3, (x, z, i) => one(x, z, 0.6, 0.25, 0, 0, i % 2 ? L : 'акцент')), ['disc', [1.1, 0, 1.1], [0, 0.36, 0], 0, C.dark(p.акцент, 0.4)]];
        return [one(0, 0, 1.6, 0.55, 0, 0.05), ...(v ? [one(0.4, 0.15, 1.0, 0.4, 0, -0.45, L), one(-0.35, -0.1, 0.9, 0.35, 0.2, 0.5), one(0.05, 0.4, 0.7, 0.3, 0.5, 0, L)] : []), ['ico', [0.9, 0.3, 0.8], [0, 0.1, 0], 0, 'камень', { d: 1 }]];
      } },
      'лавовая трещина': { fam: 'камень', h: 0.2, f() {
        return [...Array.from({ length: 5 }, (_, i) => ['box', [0.9, 0.06, 0.18 + (i % 2) * 0.08], [-1.6 + i * 0.8, 0.03, Math.sin(i * 1.7) * 0.25], Math.sin(i * 2.1) * 0.5, 'огонь', { glow: 1 }]), ...line(4, 3.2, x => ['ico', [0.5, 0.25, 0.4], [x, 0.1, 0.45], 0, 'тёмный'])];
      } },
      'вулкан': { fam: 'камень', h: 16, far: 1, f(v) {
        return [['cone', [24, 16, 24], [0, 8, 0], 0, 'камень', { top: 0.22, tess: 8 }], ['cyl', [5, 0.6, 5], [0, 16, 0], 0, 'огонь', { glow: 1 }], ...ring(4, 4, (x, z, i) => ['box', [0.8, 6, 0.5], [x * 0.9, 13, z * 0.9], [0, i, Math.atan2(x, 16)], 'огонь', { glow: 0.8, d: v ? 0 : 1 }])];
      } },
      'дюна': { fam: 'камень', h: 3, far: 1, f(v, p) {
        return [['sphere', [16, 6, 7], [0, 0, 0], 0.2, 'земля2', { seg: 5 }], ['sphere', [10, 4.4, 4], [3, 0, 2], 0.2, C.light(p.земля2, 0.1), { seg: 5 }], ...(v ? [['sphere', [8, 3, 5], [-6, 0, -2], 0.5, 'земля2', { seg: 5 }]] : [])];
      } },
      'сугроб': { fam: 'камень', h: 0.9, f(v, p) {
        const W = 'снег', B2 = C.mix(p.снег, p.вода, 0.15);
        if (v === 3) return [['sphere', [0.9, 0.85, 0.9], [0, 0.42, 0], 0, W], ['sphere', [0.65, 0.6, 0.65], [0, 1.1, 0], 0, W], ['sphere', [0.45, 0.44, 0.45], [0, 1.6, 0], 0, W], ['cone', [0.08, 0.25, 0.08], [0, 1.6, 0.3], [Math.PI / 2, 0, 0], 'огонь'], ['sphere', [0.06, 0.06, 0.06], [-0.09, 1.7, 0.2], 0, 'тёмный'], ['sphere', [0.06, 0.06, 0.06], [0.09, 1.7, 0.2], 0, 'тёмный'], ['cyl', [0.35, 0.3, 0.35], [0, 1.88, 0], 0, 'ткань', { d: 1 }]];
        return [['sphere', [v === 1 ? 3.2 : 1.9, 0.9, v === 1 ? 1.2 : 1.6], [0, 0.1, 0], 0.3, W, { seg: 5 }], ['sphere', [1.0, 0.6, 0.9], [0.6, 0.25, 0.3], 0, B2], ...(v === 2 ? [['cyl', [0.06, 1.4, 0.06], [0.2, 0.7, 0], [0, 0, 0.2], 'ствол']] : [])];
      } },
      'льдина': { fam: 'камень', h: 0.5, f(v, p) {
        const I = 'лёд';
        const S = [[['cyl', [2.6, 0.4, 2.2], [0, 0.2, 0], 0, I, { tess: 7, shiny: 1 }]], [['cyl', [2.4, 0.35, 1.8], [0, 0.18, 0], 0.3, I, { tess: 5, shiny: 1 }], ['cyl', [1.2, 0.3, 1], [1.3, 0.15, 0.5], 1, I, { tess: 4, shiny: 1 }]], [['box', [1.6, 0.3, 1.2], [0, 0.4, 0], [0.4, 0.2, 0.2], I, { shiny: 1 }]], [['cyl', [2.2, 0.3, 1.8], [0, 0.15, 0], 0, I, { shiny: 1 }], ['cyl', [1.4, 0.3, 1.2], [0.2, 0.45, 0.1], 0.6, C.light(p.лёд, 0.2), { shiny: 1 }]]][v];
        return [...S, ['disc', [1.3, 0, 1.0], [0, 0.42, 0], 0, 'снег', { d: 1 }]];
      } },
      'торос': { fam: 'камень', h: 1.6, f(v, p) {
        return ring(v ? 6 : 4, 0.5, (x, z, i) => ['box', [1.0, 0.25, 0.8], [x, 0.4 + (i % 2) * 0.4, z], [0.6 * (i % 2 ? 1 : -1), i, 0.4], i % 2 ? 'лёд' : C.light(p.лёд, 0.2), { shiny: 1 }]);
      } },
      'кратер': { fam: 'камень', h: 0.5, f(v, p) {
        const k = [1, 1.8, 1, 1.2][v], rows = [['torus', [3 * k, 0.5 * k, 3 * k], [0, 0.12, 0], 0, 'камень', { thick: 0.3 }], ['disc', [2.4 * k, 0, 2.4 * k], [0, 0.02, 0], 0, C.dark(p.камень, 0.35)]];
        if (v === 2) rows.push(['torus', [1.4, 0.3, 1.4], [2.2, 0.08, 1], 0, 'камень'], ['disc', [1.1, 0, 1.1], [2.2, 0.02, 1], 0, C.dark(p.камень, 0.35)]);
        if (v === 3) rows.push(...ring(6, 1.8 * k, (x, z) => ['ico', [0.4, 0.3, 0.35], [x, 0.18, z], 0, C.light(p.камень, 0.1)]));
        return rows;
      } },
      'астероид': { fam: 'камень', h: 2, f(v, p) {
        return [['ico', [2.2, 1.7, 1.9], [0, 1, 0], 0.5, 'камень'], ['disc', [0.6, 0, 0.6], [0.6, 1.6, 0.4], [0.5, 0, -0.3], C.dark(p.камень, 0.3)], ...(v ? [['ico', [0.8, 0.7, 0.7], [1.3, 1.6, 0.2], 1, C.dark(p.камень, 0.1)]] : [])];
      } },
      'курган': { fam: 'камень', h: 2.5, f(v) {
        return [['sphere', [8, 5, 7], [0, 0, 0], 0, 'земля2', { seg: 6 }], v ? ['box', [0.4, 1.4, 0.3], [0, 2.9, 0], 0.2, 'камень'] : ['ico', [0.8, 0.6, 0.7], [0.3, 2.5, 0], 0, 'камень']];
      } },

      /* ----- вода ----- */
      'вода с рябью': { fam: 'вода', h: 0.1, flat: 1, f(v, p, o) {
        const L = C.light(p.вода, 0.3), ripple = (x, z, r) => ['torus', [r, 0.03, r], [x, 0.06, z], 0, L, { thick: 0.04, tess: 12, keep: 1 }];
        const base = [['disc', [6, 0, 5], [0, 0.03, 0], 0, 'вода', { shiny: 1, tess: 14 }], ['box', [8, 0.06, 5], [0, 0.03, 0], 0, 'вода', { shiny: 1 }], ['disc', [1.6, 0, 1.2], [0, 0.03, 0], 0, 'вода', { shiny: 1, tess: 10 }], ['disc', [5, 0, 3.2], [0, 0.03, 0], 0.4, 'вода', { shiny: 1, tess: 9 }]][v];
        const rows = v === 1 ? [base] : [['disc', [v === 2 ? 1.9 : v === 3 ? 5.4 : 6.6, 0, v === 2 ? 1.5 : v === 3 ? 3.6 : 5.5], [0, 0.02, 0], v === 3 ? 0.4 : 0, 'земля2', { tess: 14 }], base];
        for (let i = 0; i < (v === 2 ? 2 : 5); i++) rows.push(ripple((o.r() - 0.5) * (v === 2 ? 0.8 : 3.4), (o.r() - 0.5) * (v === 2 ? 0.6 : 2.4), 0.4 + o.r() * 0.6));
        return rows;
      } },
      'река-лента': { fam: 'вода', h: 0.1, flat: 1, f(v, p) {
        const w = [3, 3, 5, 1.6][v], len = 10, segs = v === 1 ? 5 : 1, rows = [];
        for (let i = 0; i < segs; i++) {
          const x = -len / 2 + len * (i + 0.5) / segs, z = v === 1 ? Math.sin(i * 1.3) * 1.2 : 0, a = v === 1 ? Math.cos(i * 1.3) * 0.45 : 0;
          rows.push(['box', [len / segs + 0.4, 0.05, w], [x, 0.03, z], a, 'вода', { shiny: 1 }], ['box', [len / segs + 0.4, 0.12, 0.5], [x, 0.04, z + w / 2 + 0.2], a, 'земля2', { d: 1 }], ['box', [len / segs + 0.4, 0.12, 0.5], [x, 0.04, z - w / 2 - 0.2], a, 'земля2', { d: 1 }]);
        }
        for (let i = 0; i < 6; i++) rows.push(['box', [0.7, 0.02, 0.06], [-4 + i * 1.6, 0.07, Math.sin(i * 2) * w * 0.3], 0, C.light(p.вода, 0.5)]);
        if (v === 2) rows.push(...line(4, 7, x => ['ico', [0.6, 0.35, 0.5], [x, 0.12, Math.cos(x) * 1.4], x, 'камень']));
        return rows;
      } },
      'водопад': { fam: 'вода', h: 5, f(v, p) {
        const h = [5, 3.6, 5.5, 4.6][v], w = [1.6, 3.2, 1.4, 0.7][v], W = C.light(p.вода, 0.25);
        const rows = [['box', [w + 2.4, h, 1.6], [0, h / 2, -0.6], 0, 'камень'], ['box', [w, h, 0.25], [0, h / 2, 0.3], 0, W, { alpha: 0.85, glow: 0.15 }], ...ring(5, w * 0.5, (x, z) => ['sphere', [0.7, 0.45, 0.6], [x, 0.2, 0.6 + z * 0.3], 0, 'снег']), ['disc', [w + 2, 0, 2.2], [0, 0.03, 1.4], 0, 'вода', { shiny: 1 }]];
        if (v === 2) rows.push(['box', [w + 1.6, 0.4, 1.0], [0, h * 0.5, 0.4], 0, 'камень']);
        if (v === 3) rows.push(['box', [w, h, 0.25], [1.4, h / 2, 0.3], 0, W, { alpha: 0.85, glow: 0.15 }]);
        return rows;
      } },
      'пена порога': { fam: 'вода', h: 0.4, f(v) {
        return ring(v ? 7 : 5, 0.6, (x, z, i) => ['sphere', [0.5 + (i % 3) * 0.15, 0.25, 0.4], [x, 0.1, z * 0.4], 0, 'снег']);
      } },
      'лужа': { fam: 'вода', h: 0.05, flat: 1, f(v, p) {
        return [['disc', [v ? 1.4 : 2.2, 0, v ? 1.0 : 1.3], [0, 0.02, 0], 0.4, 'вода', { shiny: 1, tess: 9 }], ['torus', [0.6, 0.02, 0.6], [0.3, 0.04, 0], 0, C.light(p.вода, 0.4), { thick: 0.04, d: 1 }]];
      } },
      'мостик': { fam: 'вода', h: 1.2, f(v, p, o) {
        const len = 5, n = 11, rows = [];
        if (v === 3) return [['cyl', [0.7, len + 0.6, 0.7], [0, 0.3, 0], [0, 0, Math.PI / 2], 'ствол', { tess: 7 }], ['disc', [0.6, 0, 0.6], [len / 2 + 0.31, 0.3, 0], [0, 0, Math.PI / 2], 'дерево']];
        for (let i = 0; i < n; i++) {
          const x = -len / 2 + len * i / (n - 1), y = v === 1 ? Math.sin(Math.PI * i / (n - 1)) * 0.7 : 0, miss = o.wr >= 2 && (i === 3 || i === 7);
          if (!miss) rows.push(['box', [0.38, 0.1, 1.6], [x, 0.3 + y, 0], [0, (o.r() - 0.5) * 0.06 * (1 + o.wr * 2), (o.r() - 0.5) * 0.08 * o.wr], i % 2 ? 'дерево' : C.dark(p.дерево, 0.1)]);
        }
        for (const x of [-len / 2, 0, len / 2]) for (const z of [0.75, -0.75]) rows.push(['box', [0.12, 1.0, 0.12], [x, 0.5 + (v === 1 && !x ? 0.6 : 0), z], 0, 'ствол']);
        const rail = v === 2 ? [['cyl', [0.05, len, 0.05], [0, 1.0, 0.75], [0, 0, Math.PI / 2], 'ствол', { tess: 4 }], ['cyl', [0.05, len, 0.05], [0, 1.0, -0.75], [0, 0, Math.PI / 2], 'ствол', { tess: 4 }]] : [['box', [len, 0.1, 0.1], [0, 1.0 + (v === 1 ? 0.5 : 0), 0.75], 0, 'дерево'], ['box', [len, 0.1, 0.1], [0, 1.0 + (v === 1 ? 0.5 : 0), -0.75], 0, 'дерево', { d: 1 }]];
        return rows.concat(rail);
      } },
      'лодка': { fam: 'вода', h: 0.8, f(v, p) {
        return [['cyl', [1.1, 3, 0.7], [0, 0.35, 0], [Math.PI / 2, 0, 0], 'дерево', { top: 0.5, tess: 6 }], ['box', [0.9, 0.05, 2.2], [0, 0.58, 0], 0, C.dark(p.дерево, 0.25)], ['box', [1, 0.08, 0.2], [0, 0.6, 0.3], 0, 'дерево'], ...(v ? [['cyl', [0.06, 2.2, 0.06], [0, 1.6, 0], 0, 'ствол'], ['box', [0.04, 1.4, 1.0], [0, 1.9, 0.3], 0, 'ткань']] : [['box', [0.1, 0.06, 1.8], [0.6, 0.65, 0], 0.3, 'ствол']])];
      } },
      'буй': { fam: 'вода', h: 1.2, f(v) {
        return [['sphere', [0.8, 0.6, 0.8], [0, 0.2, 0], 0, 'огонь', { noglow: 1 }], ['cyl', [0.4, 0.6, 0.4], [0, 0.7, 0], 0, 'светлый', { top: 0.6 }], ['sphere', [0.18, 0.18, 0.18], [0, 1.1, 0], 0, 'свет', { glow: v ? 1 : 0.5 }]];
      } },
      'ракушка': { fam: 'вода', h: 0.4, f(v, p) {
        return v ? [['cone', [0.4, 0.7, 0.4], [0, 0.2, 0], [Math.PI / 2.4, 0, 0], 'ткань', { tess: 6 }], ['torus', [0.35, 0.08, 0.35], [0, 0.15, -0.25], [1.2, 0, 0], C.light(p.ткань, 0.3)]] : [['hemi', [0.7, 0.3, 0.6], [0, 0, 0], 0, C.light(p.ткань, 0.25)], ...line(5, 0.5, x => ['box', [0.04, 0.32, 0.55], [x, 0.05, 0], [0, 0, -x * 0.8], 'ткань'])];
      } },
      'морская звезда': { fam: 'вода', h: 0.15, f(v) {
        const c = v ? 'огонь' : 'ткань', g = { noglow: 1 };
        return [['sphere', [0.28, 0.1, 0.28], [0, 0.05, 0], 0, c, g], ...ring(5, 0.28, (x, z, i, a) => ['capsule', [0.12, 0.42, 0.08], [x, 0.04, z], [Math.PI / 2, -a + Math.PI / 2, 0], c, g])];
      } },
      'якорь': { fam: 'вода', h: 1.6, f(v) {
        return [['cyl', [0.12, 1.4, 0.12], [0, 0.7, 0], 0, 'металл'], ['torus', [0.36, 0.08, 0.36], [0, 1.5, 0], [Math.PI / 2, 0, 0], 'металл'], ['box', [0.7, 0.1, 0.1], [0, 1.2, 0], 0, 'металл'], ['torus', [1.0, 0.1, 1.0], [0, 0.3, 0], [Math.PI / 2, 0, 0], 'металл', { thick: 0.12 }], ...(v ? [['box', [1.2, 0.08, 0.08], [0.3, 1.6, 0], 0.8, 'ткань']] : [])];
      } },

      /* ----- аул, станица, Адыгея ----- */
      'хата': { fam: 'аул', h: 3.4, f(v, p) {
        const w = v === 3 ? 2.0 : 2.6, d = 2.0, h = 1.6, rows = [['box', [w, h, d], [0, h / 2, 0], 0, 'стена'], ['box', [w + 0.1, 0.18, d + 0.1], [0, 0.09, 0], 0, C.dark(p.стена, 0.3)]];
        if (v === 1) rows.push(['prism', [w + 0.6, 1.4, d + 0.5], [0, h + 0.7, 0], 0, 'крыша'], ['prism', [w + 0.66, 0.3, d * 0.3], [0, h + 1.28, 0], 0, 'снег', { snow: 1 }]);
        else rows.push(['pyramid', [w + 0.7, 1.5, d + 0.6], [0, h + 0.75, 0], 0, 'крыша'], ['pyramid', [w * 0.4, 0.5, d * 0.35], [0, h + 1.3, 0], 0, 'снег', { snow: 1 }]);
        if (v === 2) rows.push(['box', [1.8, h, 1.6], [w / 2 + 0.6, h / 2, -0.2], 0, 'стена'], ['pyramid', [2.3, 1.1, 2.1], [w / 2 + 0.6, h + 0.55, -0.2], 0, 'крыша']);
        if (v === 3) rows.push(['box', [w, 0.1, 0.9], [0, 0.05, d / 2 + 0.45], 0, 'дерево'], ['box', [0.1, h, 0.1], [w / 2 - 0.1, h / 2, d / 2 + 0.85], 0, 'ствол'], ['box', [0.1, h, 0.1], [-w / 2 + 0.1, h / 2, d / 2 + 0.85], 0, 'ствол'], ['box', [w, 0.08, 1.0], [0, h, d / 2 + 0.45], [-0.15, 0, 0], 'крыша']);
        for (const x of v === 3 ? [-0.5] : [-0.7, 0.7]) rows.push(['box', [0.5, 0.5, 0.05], [x, 0.95, d / 2 + 0.02], 0, 'окно'], ['box', [0.75, 0.56, 0.03], [x, 0.95, d / 2 + 0.01], 0, 'ткань', { d: 1 }], ['box', [0.62, 0.06, 0.12], [x, 0.66, d / 2 + 0.05], 0, 'дерево', { d: 2 }]);
        rows.push(['box', [0.5, 1.05, 0.05], [v === 3 ? 0.55 : 0, 0.52, d / 2 + 0.02], 0, 'дерево', { d: v === 3 ? 0 : 1 }], ['box', [0.35, 0.9, 0.35], [w * 0.25, h + 1.2, -0.3], 0, 'камень', { d: 1 }]);
        rows.push(['box', [0.5, 0.5, 0.02], [-0.6, 0.4, d / 2 + 0.03], 0, C.dark(p.стена, 0.25), { wear: 1 }], ['box', [0.04, 0.6, 0.02], [0.9, 1.2, d / 2 + 0.03], 0.3, 'тёмный', { wear: 2 }]);
        return rows;
      } },
      'дом с черепицей': { fam: 'аул', h: 5, f(v, p, o) {
        const fl = v === 1 ? 2 : 1, w = v === 3 ? 4.2 : 3.2, d = 2.6, h = 1.8 * fl, rows = [['box', [w, h, d], [0, h / 2, 0], 0, 'стена'], ['box', [w + 0.1, 0.25, d + 0.1], [0, 0.12, 0], 0, 'камень', { d: 1 }], ['prism', [w + 0.5, 1.5, d + 0.6], [0, h + 0.75, 0], 0, 'крыша']];
        if (o.d >= 1) rows.push(['box', [w + 0.7, 0.12, 0.12], [0, h + 1.5, 0], 0, C.dark(p.крыша, 0.25), { keep: 1 }], ['box', [w + 0.2, 0.1, d + 0.2], [0, h + 0.05, 0], 0, 'дерево']);
        rows.push(['prism', [w + 0.55, 0.3, d * 0.5], [0, h + 1.38, 0], 0, 'снег', { snow: 1 }]);
        for (let f = 0; f < fl; f++) for (const x of v === 3 ? [-1.3, 0, 1.3] : [-0.8, 0.8]) rows.push(['box', [0.55, 0.65, 0.05], [x, 1.0 + f * 1.8, d / 2 + 0.02], 0, 'окно'], ['box', [0.66, 0.08, 0.14], [x, 0.64 + f * 1.8, d / 2 + 0.06], 0, 'дерево', { d: 1 }]);
        rows.push(['box', [0.6, 1.2, 0.05], [v === 3 ? 0.65 : 0, 0.6, d / 2 + 0.02], 0, 'дерево']);
        if (v === 2) rows.push(['box', [1.6, 0.1, 0.7], [0, 1.9, d / 2 + 0.35], 0, 'дерево'], ['box', [1.6, 0.5, 0.05], [0, 2.2, d / 2 + 0.68], 0, 'ткань']);
        if (v === 3) rows.push(['box', [0.8, 0.8, 0.8], [0.8, h + 0.75, 0.6], 0, 'стена'], ['prism', [1.0, 0.6, 1.0], [0.8, h + 1.4, 0.6], Math.PI / 2, 'крыша'], ['box', [0.4, 0.4, 0.05], [0.8, h + 0.75, 1.02], 0, 'окно']);
        rows.push(['box', [0.4, 1.0, 0.4], [w * 0.3, h + 1.3, -0.4], 0, C.dark(p.крыша, 0.3), { d: 1 }]);
        return rows;
      } },
      'сарай': { fam: 'аул', h: 3, f(v, p) {
        return [['box', [3, 2, 2.4], [0, 1, 0], 0, 'дерево'], ...line(6, 2.6, x => ['box', [0.05, 2.0, 0.05], [x, 1, 1.22], 0, C.dark(p.дерево, 0.2), { d: 1 }]), [v ? 'prism' : 'wedge', v ? [3.4, 1, 2.8] : [2.8, 0.8, 3.4], [0, 2.45, 0], v ? 0 : Math.PI / 2, 'крыша'], ['box', [1.2, 1.6, 0.06], [0, 0.8, 1.23], 0, C.dark(p.дерево, 0.15)], ['box', [1.3, 0.08, 0.08], [0, 0.8, 1.27], [0, 0, 0.7], 'дерево', { d: 1 }]];
      } },
      'плетень': { fam: 'аул', h: 1.2, f(v, p, o) {
        const len = 3, h = [1.1, 1.2, 0.7, 1.1][v], rows = line(5, len, x => ['cyl', [0.09, h + 0.2, 0.09], [x, (h + 0.2) / 2, 0], [0, 0, o.wr ? (o.r() - 0.5) * 0.2 * o.wr : 0], 'ствол', { top: 0.7, tess: 5 }]);
        const n = v === 1 ? 7 : v === 2 ? 3 : 5;
        for (let i = 0; i < n; i++) for (let s = 0; s < 4; s++) rows.push(['cyl', [0.07, len / 4 + 0.06, 0.07], [-len / 2 + len * (s + 0.5) / 4, 0.18 + i * (h - 0.1) / n, ((s + i) % 2 ? 1 : -1) * 0.05], [0, (s + i) % 2 ? 0.08 : -0.08, Math.PI / 2], i % 2 ? 'дерево' : C.dark(p.дерево, 0.12), { tess: 4 }]);
        if (v === 3) rows.push(...[-len / 2, len / 2].map(x => ['sphere', [0.3, 0.32, 0.3], [x, h + 0.35, 0], 0, clay(p)]));
        return rows;
      } },
      'штакетник': { fam: 'аул', h: 1.1, f(v, p, o) {
        const len = 3, n = 11, rows = [['box', [len, 0.08, 0.05], [0, 0.3, -0.05], 0, 'дерево'], ['box', [len, 0.08, 0.05], [0, 0.8, -0.05], 0, 'дерево']];
        for (let i = 0; i < n; i++) {
          const x = -len / 2 + len * i / (n - 1), hh = v === 2 ? (i % 2 ? 0.8 : 1.05) : 0.95;
          if (v === 3 && (i === 4 || i === 5)) { rows.push(['box', [0.16, 0.5, 0.04], [x, 0.25, 0.02], [0, 0, 0.5], 'стена']); continue; }
          rows.push(['box', [0.16, hh, 0.04], [x, hh / 2, 0.02], [0, 0, o.wr ? (o.r() - 0.5) * 0.12 * o.wr : 0], 'стена']);
          if (v !== 1) rows.push(['prism', [0.04, 0.14, 0.16], [x, hh + 0.07, 0.02], Math.PI / 2, 'стена']);
        }
        return rows;
      } },
      'ворота': { fam: 'аул', h: 2.2, f(v, p) {
        const post = v ? 'камень' : 'ствол';
        return [['box', [0.3, 2.2, 0.3], [-1.6, 1.1, 0], 0, post], ['box', [0.3, 2.2, 0.3], [1.6, 1.1, 0], 0, post], ['box', [1.4, 1.6, 0.08], [-0.75, 0.9, 0], 0, 'дерево'], ['box', [1.4, 1.6, 0.08], [0.75, 0.9, 0], 0, 'дерево'], ['box', [1.4, 0.1, 0.1], [-0.75, 0.9, 0.05], [0, 0, 0.8], C.dark(p.дерево, 0.2)], ['box', [1.4, 0.1, 0.1], [0.75, 0.9, 0.05], [0, 0, -0.8], C.dark(p.дерево, 0.2)], ...(v ? [['prism', [3.8, 0.6, 0.6], [0, 2.5, 0], 0, 'крыша']] : [])];
      } },
      'колодец': { fam: 'аул', h: 2.6, f(v, p) {
        if (v === 1) return [['cyl', [1.1, 0.8, 1.1], [0, 0.4, 0], 0, 'камень'], ['cyl', [0.18, 2.2, 0.18], [1.2, 1.1, 0], 0, 'ствол'], ['cyl', [0.1, 4.5, 0.1], [0.4, 2.2, 0], [0, 0, 1.0], 'дерево'], ['cyl', [0.03, 1.4, 0.03], [-1.1, 1.6, 0], 0, 'тёмный'], ['cyl', [0.3, 0.3, 0.3], [-1.1, 0.95, 0], 0, 'дерево']];
        const rows = [v === 3 ? ['box', [1.3, 0.8, 1.3], [0, 0.4, 0], 0, 'дерево'] : ['cyl', [1.4, 0.8, 1.4], [0, 0.4, 0], 0, 'камень', { tess: 10 }], ['disc', [1.1, 0, 1.1], [0, 0.81, 0], 0, C.dark(p.вода, 0.4)]];
        if (v !== 2) rows.push(['box', [0.12, 1.6, 0.12], [-0.6, 1.4, 0], 0, 'ствол'], ['box', [0.12, 1.6, 0.12], [0.6, 1.4, 0], 0, 'ствол'], ['prism', [1.8, 0.7, 1.4], [0, 2.4, 0], 0, 'крыша'], ['cyl', [0.14, 1.2, 0.14], [0, 1.7, 0], [0, 0, Math.PI / 2], 'дерево'], ['cyl', [0.3, 0.3, 0.3], [0, 1.2, 0], 0, 'дерево', { d: 1 }], ['prism', [1.85, 0.25, 0.5], [0, 2.7, 0], 0, 'снег', { snow: 1 }]);
        return rows;
      } },
      'улей': { fam: 'аул', h: 1.3, f(v, p) {
        const D = C.dark(p.дерево, 0.15);
        if (v === 2) return [['hemi', [1.0, 2.2, 1.0], [0, 0.3, 0], 0, hay(p)], ...line(3, 0.6, y => ['torus', [0.95 - Math.abs(y) * 0.5, 0.06, 0.95 - Math.abs(y) * 0.5], [0, 0.65 + y, 0], 0, C.dark(hay(p), 0.15), { d: 1 }]), ['box', [0.2, 0.08, 0.06], [0, 0.4, 0.48], 0, 'тёмный'], ['cyl', [1.2, 0.3, 1.2], [0, 0.15, 0], 0, 'камень']];
        if (v === 3) return [['cyl', [0.7, 1.2, 0.7], [0, 0.6, 0], 0, 'ствол', { tess: 8 }], ['cyl', [0.8, 0.1, 0.8], [0, 1.25, 0], 0, 'крыша'], ['box', [0.15, 0.08, 0.06], [0, 0.6, 0.35], 0, 'тёмный']];
        const n = v === 1 ? 3 : 1, rows = [['box', [0.8, 0.3, 0.7], [0, 0.15, 0], 0, 'ствол']];
        for (let i = 0; i < n; i++) rows.push(['box', [0.75, 0.38, 0.65], [0, 0.5 + i * 0.4, 0], 0, i % 2 ? D : 'дерево'], ['box', [0.78, 0.05, 0.68], [0, 0.69 + i * 0.4, 0], 0, C.dark(p.дерево, 0.3), { d: 1 }]);
        rows.push(['prism', [0.95, 0.35, 0.85], [0, 0.48 + n * 0.4, 0], Math.PI / 2, 'крыша'], ['box', [0.28, 0.06, 0.05], [0, 0.37, 0.34], 0, 'тёмный'], ['box', [0.35, 0.03, 0.15], [0, 0.32, 0.4], 0, 'дерево', { d: 1 }]);
        return rows;
      } },
      'стог сена': { fam: 'аул', h: 2.6, f(v, p) {
        const H = hay(p), D = C.dark(H, 0.15);
        if (v === 1) return [['cyl', [1.3, 1.1, 1.3], [0, 0.65, 0], [Math.PI / 2, 0, 0], H, { tess: 10 }], ['torus', [1.3, 0.05, 1.3], [0, 0.65, 0.2], [Math.PI / 2, 0, 0], D, { d: 1 }]];
        if (v === 2) return [['box', [1.2, 0.5, 0.6], [-0.35, 0.25, 0], 0, H], ['box', [1.2, 0.5, 0.6], [0.4, 0.25, 0.1], 0.2, D], ['box', [1.2, 0.5, 0.6], [0, 0.75, 0.05], -0.1, H]];
        if (v === 3) return [['sphere', [1.4, 0.6, 1.2], [0, 0.1, 0], 0, H]];
        return [['sphere', [2.0, 2.2, 2.0], [0, 0.9, 0], 0, H], ['cone', [1.6, 1.0, 1.6], [0, 2.2, 0], 0, D], ['cyl', [0.08, 3.2, 0.08], [0, 1.6, 0], 0, 'ствол'], ['sphere', [1.2, 0.5, 1.2], [0, 2.5, 0], 0, 'снег', { snow: 1 }]];
      } },
      'телега': { fam: 'аул', h: 1.4, f(v, p) {
        return [['box', [2.4, 0.15, 1.2], [0, 0.75, 0], 0, 'дерево'], ['box', [2.4, 0.4, 0.06], [0, 0.97, 0.58], 0, 'дерево'], ['box', [2.4, 0.4, 0.06], [0, 0.97, -0.58], 0, 'дерево'], ...[[-0.8, 0.68], [0.8, 0.68], [-0.8, -0.68], [0.8, -0.68]].map(([x, z]) => ['cyl', [0.9, 0.1, 0.9], [x, 0.45, z], [Math.PI / 2, 0, 0], 'ствол', { tess: 8 }]), ['box', [1.6, 0.08, 0.08], [1.9, 0.6, 0.25], 0.1, 'дерево'], ['box', [1.6, 0.08, 0.08], [1.9, 0.6, -0.25], -0.1, 'дерево'], ...(v ? [['sphere', [1.6, 0.6, 1.0], [0, 1.0, 0], 0, hay(p)]] : [])];
      } },
      'скамья': { fam: 'аул', h: 0.9, f(v) {
        if (v === 2) return [['cyl', [0.45, 2, 0.45], [0, 0.42, 0], [0, 0, Math.PI / 2], 'ствол', { tess: 7 }], ['box', [2, 0.06, 0.4], [0, 0.66, 0], 0, 'дерево'], ['cyl', [0.4, 0.4, 0.4], [-0.7, 0.2, 0], 0, 'ствол'], ['cyl', [0.4, 0.4, 0.4], [0.7, 0.2, 0], 0, 'ствол']];
        const mat = v === 3 ? 'камень' : 'дерево', leg = v === 3 ? 'камень' : 'ствол', rows = [['box', [1.8, 0.08, 0.45], [0, 0.45, 0], 0, mat], ['box', [0.1, 0.45, 0.4], [-0.75, 0.22, 0], 0, leg], ['box', [0.1, 0.45, 0.4], [0.75, 0.22, 0], 0, leg]];
        if (v === 1) rows.push(['box', [1.8, 0.4, 0.06], [0, 0.75, -0.22], [-0.15, 0, 0], mat], ['box', [0.08, 0.4, 0.06], [-0.75, 0.6, -0.22], 0, 'ствол']);
        return rows;
      } },
      'прилавок': { fam: 'аул', h: 2.4, f(v, p, o) {
        const rows = [['box', [2.4, 0.9, 0.9], [0, 0.45, 0], 0, 'дерево'], ['box', [2.5, 0.06, 1.0], [0, 0.92, 0], 0, C.light(p.дерево, 0.15)]];
        if (v !== 2) for (const x of [-1.15, 1.15]) for (const z of [-0.4, 0.4]) rows.push(['box', [0.08, 2.2, 0.08], [x, 1.1, z], 0, 'ствол']);
        if (v === 0) for (let i = 0; i < 6; i++) rows.push(['box', [2.6 / 6, 0.06, 1.3], [-1.3 + 2.6 * (i + 0.5) / 6, 2.25, 0.1], [0.25, 0, 0], i % 2 ? 'ткань' : 'светлый']);
        if (v === 1) rows.push(['box', [2.7, 0.12, 1.3], [0, 2.25, 0.1], 0, 'крыша']);
        if (v === 2) rows.push(['cyl', [0.06, 2.4, 0.06], [0, 1.2, -0.2], 0, 'ствол'], ['cone', [2.8, 0.6, 2.8], [0, 2.4, -0.2], 0, 'ткань', { tess: 8 }]);
        if (v === 3) rows.push(...[-0.9, 0.9].map(x => ['cyl', [0.8, 0.1, 0.8], [x, 0.4, 0.5], [Math.PI / 2, 0, 0], 'ствол', { tess: 8 }]), ['box', [2.6, 0.12, 1.2], [0, 2.2, 0], 0, 'ткань']);
        const goods = ['акцент', 'огонь', 'листва', 'светлый', 'ткань'];
        for (let i = 0; i < 7; i++) rows.push([o.r() < 0.5 ? 'sphere' : 'cyl', [0.24, 0.2, 0.24], [-0.9 + i * 0.3, 1.05, (o.r() - 0.5) * 0.4], 0, goods[i % goods.length], { noglow: 1 }]);
        return rows;
      } },
      'головки сыра': { fam: 'аул', h: 0.6, f(v, p) {
        const ch = C.light(C.mix(p.стена, p.акцент, 0.2), 0.3);
        return line(v ? 3 : 2, 0.9, (x, i) => ['cyl', [0.6, 0.28, 0.6], [v && i === 1 ? 0 : x, 0.14 + (v && i === 1 ? 0.28 : 0), v && i === 1 ? 0 : 0.1], 0, i % 2 ? C.dark(ch, 0.06) : ch, { tess: 12 }]);
      } },
      'кувшин': { fam: 'аул', h: 0.8, f(v, p) {
        const c = clay(p);
        return [['sphere', [0.55, 0.5, 0.55], [0, 0.28, 0], 0, c], ['cyl', [0.22, 0.3, 0.22], [0, 0.6, 0], 0, c, { top: 1.3 }], ...(v ? [] : [['torus', [0.3, 0.05, 0.3], [0.25, 0.5, 0], [Math.PI / 2, 0, 0], C.dark(c, 0.1)]]), ['torus', [0.5, 0.04, 0.5], [0, 0.3, 0], 0, 'тёмный', { d: 1 }]];
      } },
      'дольмен': { fam: 'аул', h: 2.2, f(v, p) {
        const S = 'камень', D = C.dark(p.камень, 0.12);
        if (v === 1) return [['box', [2.2, 1.7, 2.0], [0, 0.85, 0], 0, S], ['cyl', [0.6, 0.1, 0.6], [0, 0.75, 1.0], [Math.PI / 2, 0, 0], 'тёмный', { tess: 10 }], ['box', [2.6, 0.3, 2.4], [0, 1.85, -0.1], 0.06, D]];
        const tilt = v === 2 ? 0.25 : 0;
        return [['box', [2.4, 1.6, 0.25], [0, 0.8, 1.0], 0, S], ['box', [2.4, 1.6, 0.25], [0, 0.8, -1.0], [tilt, 0, 0], D], ['box', [0.25, 1.6, 2.0], [1.1, 0.8, 0], [0, 0, -tilt], S], ['box', [0.25, 1.6, 2.0], [-1.1, 0.8, 0], 0, D],
          ['box', [3.0, 0.32, 2.6], [v === 2 ? 0.5 : 0, 1.76, 0], [0, 0.05, v === 2 ? 0.3 : 0.04], S], ['cyl', [0.62, 0.3, 0.62], [0, 0.75, 1.12], [Math.PI / 2, 0, 0], 'тёмный', { tess: 10 }],
          ...(v === 3 ? [['box', [0.4, 1.2, 0.4], [-0.9, 0.6, 1.6], 0, D], ['box', [0.4, 1.2, 0.4], [0.9, 0.6, 1.6], 0, D]] : []), ['sphere', [1.6, 0.3, 1.2], [0, 1.95, 0], 0, 'мох', { wear: 1 }], ['box', [3.0, 0.15, 2.5], [0, 2.0, 0], 0, 'снег', { snow: 1 }]];
      } },
      'башня': { fam: 'аул', h: 9, f(v, p) {
        const S = 'камень', D = C.dark(p.камень, 0.12);
        if (v === 1) return [['cyl', [2.6, 6.5, 2.6], [0, 3.25, 0], 0, S, { top: 0.88, tess: 10 }], ['cone', [3.2, 2.4, 3.2], [0, 7.7, 0], 0, 'крыша', { tess: 10 }], ...ring(4, 1.2, (x, z, i, a) => ['box', [0.25, 0.6, 0.1], [x, 4.6, z], -a + Math.PI / 2, 'окно']), ['cone', [1.8, 1.0, 1.8], [0, 8.3, 0], 0, 'снег', { snow: 1 }]];
        if (v === 3) return [...[[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]].map(([x, z]) => ['box', [0.2, 5, 0.2], [x, 2.5, z], 0, 'ствол']), ['box', [2.2, 1.4, 2.2], [0, 5.6, 0], 0, 'дерево'], ['pyramid', [2.8, 1.4, 2.8], [0, 7, 0], 0, 'крыша'], ['box', [1.6, 0.5, 0.05], [0, 5.7, 1.11], 0, 'окно']];
        const rows = [['box', [2.4, 7, 2.4], [0, 3.5, 0], 0, S, { taper: 0.82 }], ['box', [2.6, 0.3, 2.6], [0, 0.15, 0], 0, D]];
        for (let i = 0; i < 3; i++) rows.push(['box', [0.18, 0.55, 0.05], [0, 2.4 + i * 1.6, 1.15 - i * 0.1], 0, 'окно'], ['box', [0.05, 0.5, 0.18], [1.15 - i * 0.1, 3.2 + i * 1.6, 0], 0, 'тёмный', { d: 1 }]);
        if (v === 2) rows.push(['box', [2.1, 0.8, 2.1], [0, 7.2, 0], 0, D], ['ico', [0.7, 0.5, 0.6], [1.6, 0.2, 0.8], 0, S], ['ico', [0.5, 0.4, 0.5], [-1.5, 0.2, -0.6], 0, S]);
        else { for (let i = 0; i < 4; i++) rows.push(['box', [2.0 - i * 0.45, 0.25, 2.0 - i * 0.45], [0, 7.1 + i * 0.25, 0], 0, i % 2 ? D : S]); rows.push(['cone', [0.6, 0.8, 0.6], [0, 8.5, 0], 0, S, { tess: 4 }]); }
        return rows;
      } },
      'флажки': { fam: 'аул', h: 3, sway: 1, f(v) {
        const len = 6, cols = ['акцент', 'ткань', 'свет', 'листва', 'огонь'], rows = [['cyl', [0.1, 3, 0.1], [-len / 2, 1.5, 0], 0, 'ствол'], ['cyl', [0.1, 3, 0.1], [len / 2, 1.5, 0], 0, 'ствол']];
        const n = 11;
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n, x = -len / 2 + len * t, y = 2.9 - Math.sin(Math.PI * t) * 0.6;
          rows.push(['box', [len / n + 0.05, 0.02, 0.02], [x, y + 0.05, 0], [0, 0, (t - 0.5) * 0.4], 'тёмный', { keep: 1 }]);
          if (v === 2) rows.push(['sphere', [0.22, 0.3, 0.22], [x, y - 0.15, 0], 0, cols[i % 5], { glow: 0.7 }]);
          else if (v === 1) rows.push(['box', [0.3, 0.3, 0.02], [x, y - 0.12, 0], 0, cols[i % 5], { noglow: 1 }]);
          else rows.push(['cone', [0.32, 0.4, 0.04], [x, y - 0.15, 0], [Math.PI, 0, 0], cols[i % (v === 3 ? 2 : 5)], { tess: 3, keep: 1, noglow: 1 }]);
        }
        return rows;
      } },
      'фонарь': { fam: 'аул', h: 3.4, f(v) {
        const post = v === 1 ? 'ствол' : 'металл';
        if (v === 2) return [['cyl', [0.14, 4, 0.14], [0, 2, 0], 0, post], ['box', [1.6, 0.08, 0.08], [0, 3.9, 0], 0, post], ['box', [0.5, 0.15, 0.25], [0.7, 3.8, 0], 0, 'свет', { glow: 1 }], ['box', [0.5, 0.15, 0.25], [-0.7, 3.8, 0], 0, 'свет', { glow: 1 }]];
        if (v === 3) return [['cyl', [0.16, 4.4, 0.16], [0, 2.2, 0], 0, post, { top: 0.6 }], ['torus', [1.2, 0.12, 1.2], [0.6, 4.4, 0], [Math.PI / 2, 0, 0], post, { thick: 0.1 }], ['cone', [0.5, 0.3, 0.5], [1.15, 4.4, 0], 0, post], ['sphere', [0.3, 0.2, 0.3], [1.15, 4.25, 0], 0, 'свет', { glow: 1 }]];
        const rows = [['cyl', [0.14, 3, 0.14], [0, 1.5, 0], 0, post], ['box', [0.3, 0.3, 0.3], [0, 0.15, 0], 0, post, { d: 1 }]];
        if (v === 1) rows.push(['box', [0.4, 0.5, 0.4], [0, 3.25, 0], 0, 'свет', { glow: 1 }], ['pyramid', [0.5, 0.25, 0.5], [0, 3.6, 0], 0, 'крыша']);
        else rows.push(['box', [0.7, 0.06, 0.06], [0.3, 3.0, 0], 0, post], ['sphere', [0.42, 0.42, 0.42], [0.62, 2.85, 0], 0, 'свет', { glow: 1 }]);
        return rows;
      } },
      'опора канатной дороги': { fam: 'аул', h: 8, f(v) {
        return [['box', [0.5, 7.5, 0.5], [0, 3.75, 0], 0, 'металл', { taper: 0.7 }], ['box', [3, 0.25, 0.25], [0, 7.5, 0], 0, 'металл'], ['cyl', [0.05, 14, 0.05], [1.4, 7.4, 0], [Math.PI / 2, 0, 0], 'тёмный', { keep: 1 }], ['cyl', [0.05, 14, 0.05], [-1.4, 7.4, 0], [Math.PI / 2, 0, 0], 'тёмный', { keep: 1 }], ...(v ? [['box', [1.2, 1.0, 1.4], [1.4, 6.0, 2], 0, 'ткань'], ['box', [1.22, 0.4, 1.3], [1.4, 6.1, 2], 0, 'окно'], ['box', [0.06, 1.0, 0.06], [1.4, 6.9, 2], 0, 'тёмный']] : [])];
      } },
      'наковальня': { fam: 'аул', h: 1.2, f(v, p) {
        return [['cyl', [0.7, 0.6, 0.7], [0, 0.3, 0], 0, 'ствол'], ['box', [0.6, 0.3, 0.35], [0, 0.75, 0], 0, 'металл'], ['cone', [0.3, 0.5, 0.25], [0.5, 0.82, 0], [0, 0, -Math.PI / 2], 'металл'], ['box', [0.4, 0.12, 0.3], [0, 0.95, 0], 0, C.light(p.металл, 0.2), { shiny: 1 }], ...(v ? [['box', [1.2, 1.0, 1.0], [1.4, 0.5, 0], 0, 'камень'], ['box', [0.7, 0.3, 0.6], [1.4, 1.1, 0], 0, 'огонь', { glow: 1 }]] : [])];
      } },
      'юрта': { fam: 'аул', h: 3, f(v) {
        return [['cyl', [4, 1.8, 4], [0, 0.9, 0], 0, 'стена', { tess: 12 }], ['cone', [4.4, 1.4, 4.4], [0, 2.5, 0], 0, v ? 'ткань' : 'стена', { top: 0.18, tess: 12 }], ['torus', [4.02, 0.08, 4.02], [0, 1.2, 0], 0, 'акцент', { d: 1 }], ['box', [0.9, 1.4, 0.1], [0, 0.7, 2.0], 0, 'дерево'], ['cyl', [0.8, 0.2, 0.8], [0, 3.25, 0], 0, 'дерево']];
      } },

      /* ----- посёлок и город ----- */
      'школа': { fam: 'город', h: 8, f(v) {
        const fl = v === 1 ? 3 : 2, w = 10, d = 5, h = fl * 2.6, rows = [['box', [w, h, d], [0, h / 2, 0], 0, 'стена'], ['box', [w + 0.2, 0.35, d + 0.2], [0, h + 0.17, 0], 0, 'крыша'], ['box', [w + 0.1, 0.5, d + 0.1], [0, 0.25, 0], 0, 'камень']];
        for (let f = 0; f < fl; f++) for (let i = 0; i < 6; i++) { const x = -w / 2 + 0.9 + i * 1.65; if (f === 0 && (i === 2 || i === 3)) continue; rows.push(['box', [1.0, 1.3, 0.06], [x, 1.4 + f * 2.6, d / 2 + 0.02], 0, 'окно'], ['box', [1.1, 0.08, 0.14], [x, 0.72 + f * 2.6, d / 2 + 0.05], 0, 'светлый', { d: 1 }]); }
        rows.push(['box', [2.0, 2.0, 0.06], [0, 1.0, d / 2 + 0.02], 0, 'дерево'], ['box', [3.4, 0.2, 1.4], [0, 2.4, d / 2 + 0.7], 0, 'крыша'], ['box', [0.12, 2.3, 0.12], [-1.5, 1.15, d / 2 + 1.3], 0, 'металл', { d: 1 }], ['box', [0.12, 2.3, 0.12], [1.5, 1.15, d / 2 + 1.3], 0, 'металл', { d: 1 }]);
        rows.push(['cyl', [0.08, 3.5, 0.08], [w / 2 + 1, 1.75, d / 2 + 1], 0, 'металл'], ['box', [0.9, 0.6, 0.04], [w / 2 + 1.45, 3.1, d / 2 + 1], 0, 'акцент']);
        if (v === 2) rows.push(['cyl', [1.2, 0.12, 1.2], [0, h - 0.8, d / 2 + 0.06], [Math.PI / 2, 0, 0], 'светлый', { tess: 12 }], ['box', [0.06, 0.45, 0.04], [0, h - 0.65, d / 2 + 0.14], 0, 'тёмный']);
        if (v === 3) rows.push(['box', [4, h, 4.5], [w / 2 + 2, h / 2, -2.2], 0, 'стена'], ['box', [4.2, 0.35, 4.7], [w / 2 + 2, h + 0.17, -2.2], 0, 'крыша']);
        return rows;
      } },
      'многоэтажка': { fam: 'город', h: 24, far: 1, f(v, p, o) {
        const fl = [9, 12, 8, 10][v], w = v === 1 ? 5 : 9, d = 5, h = fl * 2.6, rows = [['box', [w, h, d], [0, h / 2, 0], 0, 'стена'], ['box', [w + 0.2, 0.3, d + 0.2], [0, h + 0.15, 0], 0, 'крыша']];
        const cols = Math.round(w / 1.5);
        for (let f = 0; f < fl; f++) for (let i = 0; i < cols; i++) { if (o.r() < 0.15) continue; rows.push(['box', [0.8, 1.2, 0.05], [-w / 2 + (i + 0.5) * w / cols, 1.5 + f * 2.6, d / 2 + 0.02], 0, o.r() < 0.6 ? 'окно' : C.dark(p.стекло, 0.2), { keep: 1 }]); }
        if (v === 1) for (let f = 1; f < fl; f += 2) rows.push(['box', [w * 0.6, 0.1, 0.8], [0, f * 2.6 + 0.4, d / 2 + 0.4], 0, 'светлый', { d: 1 }]);
        if (v === 2) rows.push(['box', [w * 0.6, 6, d * 0.7], [0, h + 3, 0], 0, 'стена'], ['box', [w * 0.62, 0.3, d * 0.72], [0, h + 6.1, 0], 0, 'крыша']);
        if (v === 3) rows.push(['box', [w * 0.5, h * 0.7, d], [w * 0.8, h * 0.35, 1], 0, C.dark(p.стена, 0.08)]);
        rows.push(['box', [1.2, 1.2, 1.2], [w * 0.25, h + 0.75, 0], 0, 'металл', { d: 1 }], ['cyl', [0.06, 2.5, 0.06], [-w * 0.3, h + 1.25, 0], 0, 'металл', { d: 1 }]);
        return rows;
      } },
      'ларёк': { fam: 'город', h: 2.6, f(v) {
        return [['box', [2.2, 2.2, 1.8], [0, 1.1, 0], 0, v ? 'ткань' : 'стена'], ['box', [1.6, 0.9, 0.05], [0, 1.4, 0.92], 0, 'окно'], ['box', [2.4, 0.15, 2.0], [0, 2.28, 0], 0, 'крыша'], ['box', [2.2, 0.4, 0.06], [0, 2.0, 0.93], 0, 'акцент'], ['box', [2.4, 0.06, 0.5], [0, 0.95, 1.1], 0, 'дерево']];
      } },
      'остановка': { fam: 'город', h: 2.6, f(v) {
        if (v === 2) return [['cyl', [0.08, 2.6, 0.08], [0, 1.3, 0], 0, 'металл'], ['box', [0.6, 0.6, 0.06], [0, 2.4, 0], 0, 'акцент'], ['box', [0.4, 0.2, 0.07], [0, 2.4, 0], 0, 'светлый']];
        const rows = [v === 1 ? ['cyl', [1.6, 3.4, 1.6], [0, 2.5, 0], [0, 0, Math.PI / 2], 'крыша', { top: 1, tess: 8 }] : ['box', [3.2, 0.12, 1.4], [0, 2.5, 0], 0, 'крыша'], ['box', [0.1, 2.5, 0.1], [-1.5, 1.25, -0.6], 0, 'металл'], ['box', [0.1, 2.5, 0.1], [1.5, 1.25, -0.6], 0, 'металл']];
        rows.push(['box', [3, 1.8, 0.05], [0, 1.4, -0.65], 0, 'стекло', { alpha: 0.55 }], ['box', [2.2, 0.08, 0.4], [0, 0.5, -0.4], 0, 'дерево'], ['box', [0.06, 0.5, 0.06], [-0.9, 0.25, -0.4], 0, 'металл'], ['box', [0.06, 0.5, 0.06], [0.9, 0.25, -0.4], 0, 'металл']);
        if (v === 3) rows.push(['box', [1.2, 1.8, 0.1], [2.1, 1.3, -0.6], 0, 'акцент', { glow: 0.3 }]);
        return rows;
      } },
      'светофор': { fam: 'город', h: 3.2, f(v, p) {
        const cols = [redOf(p), 'акцент', 'листва'];
        return [['cyl', [0.12, 2.4, 0.12], [0, 1.2, 0], 0, 'металл'], ['box', [0.45, 1.2, 0.35], [0, 2.9, 0], 0, 'тёмный'], ...cols.map((c, i) => ['cyl', [0.26, 0.06, 0.26], [0, 3.3 - i * 0.38, 0.18], [Math.PI / 2, 0, 0], c, { glow: i === (v ? 2 : 0) ? 1 : 0.15 }])];
      } },
      'конус': { fam: 'город', h: 0.8, f(v) {
        const O = 'огонь', g = { noglow: 1 };
        if (v === 3) return [['box', [1.6, 0.6, 0.2], [0, 0.5, 0], 0, 'светлый'], ...line(4, 1.3, x => ['box', [0.25, 0.62, 0.21], [x, 0.5, 0], [0, 0, 0.6], O, g]), ['box', [0.1, 0.4, 0.4], [-0.7, 0.2, 0], 0, 'тёмный'], ['box', [0.1, 0.4, 0.4], [0.7, 0.2, 0], 0, 'тёмный']];
        const h = v === 1 ? 0.5 : 0.8, rows = [['box', [0.55, 0.06, 0.55], [0, 0.03, 0], 0, 'тёмный'], ['cone', [0.45, h, 0.45], [0, h / 2 + 0.05, 0], 0, O, { top: 0.12, noglow: 1 }], ['cyl', [0.33, 0.12, 0.33], [0, h * 0.55, 0], 0, 'светлый', { top: 0.8, d: 1 }]];
        if (v === 2) return rows.map(r => r.slice(0, 2).concat([[r[2][0], r[2][1] * 0.3 + 0.2, r[2][2] + r[2][1] * 0.6], [Math.PI / 2 - 0.2, 0.4, 0]]).concat(r.slice(4)));
        return rows;
      } },
      'урна': { fam: 'город', h: 0.9, f(v) {
        return [['cyl', [0.5, 0.8, 0.5], [0, 0.4, 0], 0, v ? 'листва' : 'металл', { top: 1.1 }], ['torus', [0.55, 0.06, 0.55], [0, 0.8, 0], 0, 'тёмный']];
      } },
      'качели': { fam: 'город', h: 2.4, f(v) {
        return [['cyl', [0.1, 2.6, 0.1], [-1.2, 1.2, 0.5], [0.2, 0, 0], 'металл'], ['cyl', [0.1, 2.6, 0.1], [-1.2, 1.2, -0.5], [-0.2, 0, 0], 'металл'], ['cyl', [0.1, 2.6, 0.1], [1.2, 1.2, 0.5], [0.2, 0, 0], 'металл'], ['cyl', [0.1, 2.6, 0.1], [1.2, 1.2, -0.5], [-0.2, 0, 0], 'металл'], ['cyl', [0.1, 2.5, 0.1], [0, 2.45, 0], [0, 0, Math.PI / 2], 'металл'], ['cyl', [0.03, 1.8, 0.03], [-0.3, 1.5, 0], 0, 'тёмный', { keep: 1 }], ['cyl', [0.03, 1.8, 0.03], [0.3, 1.5, 0], 0, 'тёмный', { keep: 1 }], ['box', [0.8, 0.06, 0.35], [0, 0.6, 0], 0, v ? 'ткань' : 'акцент']];
      } },
      'баскетбольное кольцо': { fam: 'город', h: 3.6, f(v) {
        return [['cyl', [0.14, 3.2, 0.14], [0, 1.6, -0.6], 0, 'металл'], ['box', [1.4, 0.9, 0.06], [0, 3.2, -0.3], 0, 'светлый'], ['box', [0.5, 0.4, 0.07], [0, 3.05, -0.27], 0, 'огонь', { d: 1, noglow: 1 }], ['torus', [0.5, 0.04, 0.5], [0, 2.9, 0], 0, 'огонь', { thick: 0.08, noglow: 1 }], ['cyl', [0.48, 0.35, 0.48], [0, 2.72, 0], 0, 'светлый', { top: 1.3, alpha: v ? 1 : 0.6 }]];
      } },
      'машина': { fam: 'город', h: 1.6, f(v, p) {
        const L = [4.0, 4.6, 5.6, 3.0][v], H = [0.7, 1.4, 1.2, 0.7][v], rows = [['rbox', [1.8, H, L], [0, 0.35 + H / 2, 0], 0, 'ткань']];
        if (v === 0 || v === 3) rows.push(['rbox', [1.6, 0.6, L * 0.5], [0, 0.35 + H + 0.28, -0.1], 0, 'ткань'], ['box', [1.62, 0.42, L * 0.4], [0, 0.35 + H + 0.28, -0.1], 0, 'стекло']);
        if (v === 1) rows.push(['box', [1.82, 0.5, L * 0.85], [0, 1.4, 0], 0, 'стекло']);
        if (v === 2) rows.push(['box', [1.9, 1.4, 1.6], [0, 1.1, L / 2 - 0.8], 0, 'ткань'], ['box', [1.92, 0.6, 0.06], [0, 1.4, L / 2 + 0.02], 0, 'стекло'], ['box', [2, 1.6, L - 1.8], [0, 1.3, -0.9], 0, 'светлый']);
        for (const z of [L * 0.32, -L * 0.32]) for (const x of [0.9, -0.9]) rows.push(['cyl', [0.7, 0.3, 0.7], [x, 0.35, z], [0, 0, Math.PI / 2], 'тёмный', { tess: 10 }]);
        rows.push(['box', [0.3, 0.15, 0.05], [0.6, 0.6 + H * 0.3, L / 2], 0, 'свет', { glow: 0.8 }], ['box', [0.3, 0.15, 0.05], [-0.6, 0.6 + H * 0.3, L / 2], 0, 'свет', { glow: 0.8 }], ['box', [0.3, 0.12, 0.05], [0.6, 0.6 + H * 0.3, -L / 2], 0, redOf(p), { glow: 0.6, d: 1 }], ['box', [0.3, 0.12, 0.05], [-0.6, 0.6 + H * 0.3, -L / 2], 0, redOf(p), { glow: 0.6, d: 1 }]);
        return rows;
      } },
      'вывеска': { fam: 'город', h: 2, f(v) {
        const N = { glow: 1 }, rows = [['box', [v === 1 ? 2 : 3, v === 1 ? 2 : 1.4, 0.15], [0, 1, 0], 0, 'тёмный']];
        if (v === 0) rows.push(['box', [2.8, 0.08, 0.06], [0, 1.65, 0.1], 0, 'акцент', N], ['box', [2.8, 0.08, 0.06], [0, 0.35, 0.1], 0, 'акцент', N], ...line(5, 2.2, x => ['box', [0.25, 0.6, 0.06], [x, 1, 0.1], 0, 'свет', N]));
        if (v === 1) rows.push(['torus', [1.7, 0.1, 1.7], [0, 1, 0.1], [Math.PI / 2, 0, 0], 'акцент', N], ['torus', [0.9, 0.08, 0.9], [0, 1, 0.12], [Math.PI / 2, 0, 0], 'свет', N]);
        if (v === 2) rows.push(['box', [2, 0.25, 0.06], [-0.3, 1, 0.1], 0, 'акцент', N], ['prism', [0.06, 0.9, 0.8], [1.05, 1, 0.1], [0, Math.PI / 2, -Math.PI / 2], 'акцент', N]);
        if (v === 3) rows.push(...ring(5, 0.5, (x, z, i, a) => ['box', [0.1, 0.7, 0.06], [x * 0.7, 1 + z * 0.7, 0.1], [0, 0, a], i % 2 ? 'свет' : 'акцент', N]));
        return rows;
      } },
      'рекламный щит': { fam: 'город', h: 5, f(v) {
        return [['box', [0.3, 3.4, 0.3], [0, 1.7, 0], 0, 'металл'], ['box', [5, 2.4, 0.2], [0, 4.4, 0], 0, 'светлый'], ['box', [4.6, 2.0, 0.05], [0, 4.4, 0.11], 0, v ? 'ткань' : 'акцент'], ['cyl', [1.2, 0.1, 1.2], [-1.2, 4.4, 0.15], [Math.PI / 2, 0, 0], 'свет'], ['box', [2, 0.4, 0.06], [0.9, 4.6, 0.15], 0, 'светлый']];
      } },
      'столб с проводами': { fam: 'город', h: 6, f(v) {
        const pole = v === 1 ? 'металл' : 'ствол', rows = [['cyl', [0.24, 6, 0.24], [0, 3, 0], [0, 0, v === 3 ? 0.08 : 0], pole, { top: 0.75 }], ['box', [1.8, 0.14, 0.14], [0, 5.5, 0], 0, pole]];
        for (const x of [-0.8, 0, 0.8]) rows.push(['cyl', [0.1, 0.2, 0.1], [x, 5.66, 0], 0, 'светлый', { d: 1 }], ['cyl', [0.03, 6, 0.03], [x, 5.5, 3], [Math.PI / 2 - 0.06, 0, 0], 'тёмный', { keep: 1 }]);
        if (v === 2) rows.push(['box', [0.8, 0.08, 0.08], [-0.4, 4.5, 0], 0, pole], ['box', [0.4, 0.12, 0.25], [-0.8, 4.4, 0], 0, 'свет', { glow: 1 }]);
        return rows;
      } },
      'мост': { fam: 'город', h: 3, f(v) {
        return [['box', [10, 0.4, 3], [0, 2.4, 0], 0, v ? 'камень' : 'металл'], ['box', [10, 0.6, 0.15], [0, 2.9, 1.45], 0, 'металл'], ['box', [10, 0.6, 0.15], [0, 2.9, -1.45], 0, 'металл'], ...(v ? [['box', [1.2, 2.4, 3], [-2.6, 1.2, 0], 0, 'камень'], ['box', [1.2, 2.4, 3], [2.6, 1.2, 0], 0, 'камень'], ['cyl', [4, 3, 4], [0, 0.8, 0], [Math.PI / 2, 0, 0], 'камень', { tess: 10 }]] : [['box', [0.5, 2.4, 0.5], [-3, 1.2, 0], 0, 'металл'], ['box', [0.5, 2.4, 0.5], [3, 1.2, 0], 0, 'металл']])];
      } },
      'трибуна': { fam: 'город', h: 3, f(v) {
        return [...Array.from({ length: 4 }, (_, i) => ['box', [8, 0.7, 1], [0, 0.35 + i * 0.7, -i], 0, i % 2 ? 'камень' : 'стена']), ...Array.from({ length: 4 }, (_, i) => ['box', [8, 0.15, 0.4], [0, 0.78 + i * 0.7, -i + 0.2], 0, i % 2 ? 'ткань' : 'акцент']), ...(v ? [['box', [8.4, 0.12, 4.4], [0, 4.0, -1.5], [0.15, 0, 0], 'крыша']] : [])];
      } },
      'ограждение': { fam: 'город', h: 0.9, f(v, p) {
        const len = 3;
        if (v === 1) return flat(line(3, 2.2, x => [['cyl', [0.75, 0.6, 0.75], [x, 0.3, 0], 0, 'тёмный', { tess: 10 }], ['torus', [0.75, 0.22, 0.75], [x, 0.62, 0], 0, 'тёмный']]));
        if (v === 2) return [['box', [len, 0.3, 0.08], [0, 0.6, 0], 0, 'металл', { shiny: 1 }], ...line(3, len - 0.3, x => ['box', [0.12, 0.7, 0.12], [x, 0.35, -0.08], 0, 'металл'])];
        if (v === 3) return [['rbox', [1.4, 0.8, 0.6], [-0.75, 0.4, 0], 0, 'акцент'], ['rbox', [1.4, 0.8, 0.6], [0.75, 0.4, 0], 0, 'светлый']];
        return [['box', [len, 0.5, 0.4], [0, 0.25, 0], 0, 'светлый'], ...line(6, len - 0.25, x => ['box', [0.25, 0.51, 0.41], [x, 0.25, 0], 0, redOf(p)])];
      } },
      'арка финиша': { fam: 'город', h: 5, f(v) {
        if (v === 1) return [['torus', [7, 1.1, 7], [0, 0, 0], [Math.PI / 2, 0, 0], 'акцент', { thick: 0.16 }], ['box', [5, 0.8, 0.3], [0, 3.1, 0], 0, 'светлый'], ...line(8, 4.4, (x, i) => ['box', [0.5, 0.4, 0.32], [x, 3.1 + (i % 2 ? 0.2 : -0.2), 0], 0, 'тёмный'])];
        const rows = [['box', [0.5, 4.6, 0.5], [-3, 2.3, 0], 0, v === 2 ? 'металл' : 'ткань'], ['box', [0.5, 4.6, 0.5], [3, 2.3, 0], 0, v === 2 ? 'металл' : 'ткань'], ['box', [6.5, 1.1, 0.25], [0, 4.4, 0], 0, 'светлый']];
        if (v !== 3) for (let i = 0; i < 12; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2) rows.push(['box', [0.5, 0.5, 0.27], [-3 + (i + 0.5) * 0.5, 4.15 + j * 0.5, 0], 0, 'тёмный']);
        if (v === 2) rows.push(...line(6, 5, x => ['sphere', [0.3, 0.3, 0.3], [x, 3.7, 0.2], 0, 'свет', { glow: 1 }]));
        if (v === 3) rows.push(['box', [4, 0.6, 0.27], [0, 4.4, 0], 0, 'акцент']);
        return rows;
      } },

      /* ----- помещение ----- */
      'стена с окном': { fam: 'помещение', h: 3, f(v, p) {
        const rows = [['box', [4, 3, 0.25], [0, 1.5, 0], 0, 'стена'], ['box', [4, 0.25, 0.3], [0, 0.12, 0.03], 0, 'дерево', { d: 1 }]];
        const win = (x, w, h, round) => round ? [['cyl', [w, 0.1, w], [x, 1.7, 0.1], [Math.PI / 2, 0, 0], 'окно', { tess: 12 }], ['torus', [w, 0.12, w], [x, 1.7, 0.12], [Math.PI / 2, 0, 0], 'дерево', { thick: 0.12 }]] : [['box', [w, h, 0.06], [x, 1.7, 0.12], 0, 'окно'], ['box', [w + 0.2, 0.1, 0.12], [x, 1.7 + h / 2, 0.14], 0, 'дерево'], ['box', [w + 0.3, 0.1, 0.3], [x, 1.7 - h / 2, 0.2], 0, 'дерево'], ['box', [0.06, h, 0.1], [x, 1.7, 0.15], 0, 'дерево', { d: 1 }], ['box', [0.35, h + 0.4, 0.05], [x - w / 2 - 0.15, 1.75, 0.16], 0, 'ткань', { d: 1 }]];
        if (v === 1) rows.push(...win(-1, 1.0, 1.2), ...win(1, 1.0, 1.2)); else rows.push(...win(0, v === 2 ? 1.3 : 1.4, 1.3, v === 2));
        if (v === 3) rows.push(['box', [1.8, 0.08, 0.3], [0, 0.8, 0.25], 0, 'дерево'], ['cyl', [0.25, 0.3, 0.25], [-0.5, 0.97, 0.25], 0, clay(p)], ['sphere', [0.35, 0.35, 0.35], [-0.5, 1.25, 0.25], 0, 'листва']);
        return rows;
      } },
      'дверь': { fam: 'помещение', h: 2.2, f(v, p) {
        return [['box', [1.2, 2.2, 0.12], [0, 1.1, 0], 0, v ? 'ткань' : 'дерево'], ['box', [1.35, 2.3, 0.1], [0, 1.15, -0.04], 0, C.dark(p.дерево, 0.2)], ['sphere', [0.1, 0.1, 0.1], [0.45, 1.05, 0.1], 0, 'металл'], ['box', [0.8, 0.7, 0.03], [0, 1.6, 0.07], 0, v ? 'окно' : C.dark(p.дерево, 0.1), { d: 1 }]];
      } },
      'стол': { fam: 'помещение', h: 0.8, f(v, p) {
        if (v === 1) return [['cyl', [1.4, 0.08, 1.4], [0, 0.78, 0], 0, 'дерево', { tess: 12 }], ['cyl', [0.14, 0.75, 0.14], [0, 0.38, 0], 0, 'ствол'], ['cyl', [0.6, 0.05, 0.6], [0, 0.03, 0], 0, 'ствол']];
        const w = v === 3 ? 1.2 : 1.6, h = v === 3 ? 0.45 : 0.78, rows = [['box', [w, 0.08, 0.9], [0, h, 0], 0, 'дерево']];
        for (const x of [-w / 2 + 0.08, w / 2 - 0.08]) for (const z of [-0.37, 0.37]) rows.push(['box', [0.08, h, 0.08], [x, h / 2, z], 0, 'ствол']);
        if (v === 2) rows.push(['box', [0.5, 0.4, 0.8], [w / 2 - 0.3, h - 0.25, 0], 0, C.dark(p.дерево, 0.1)], ['box', [0.15, 0.04, 0.04], [w / 2 - 0.3, h - 0.25, 0.42], 0, 'металл']);
        return rows;
      } },
      'стул': { fam: 'помещение', h: 1, f(v, p) {
        if (v === 2) return [['rbox', [0.9, 0.4, 0.8], [0, 0.35, 0], 0, 'ткань'], ['rbox', [0.9, 0.7, 0.2], [0, 0.75, -0.32], 0, 'ткань'], ['rbox', [0.2, 0.35, 0.8], [-0.42, 0.62, 0], 0, C.dark(p.ткань, 0.1)], ['rbox', [0.2, 0.35, 0.8], [0.42, 0.62, 0], 0, C.dark(p.ткань, 0.1)]];
        const legs = v === 3 ? 'металл' : 'ствол', rows = [[v === 1 ? 'cyl' : 'box', [0.45, 0.06, 0.45], [0, 0.46, 0], 0, 'дерево']];
        for (const x of [-0.18, 0.18]) for (const z of [-0.18, 0.18]) rows.push(['box', [0.05, 0.46, 0.05], [x, 0.23, z], 0, legs]);
        if (v !== 1) rows.push(['box', [0.45, 0.45, 0.05], [0, 0.75, -0.2], 0, 'дерево'], ['box', [0.05, 0.5, 0.05], [0.18, 0.7, -0.2], 0, legs], ['box', [0.05, 0.5, 0.05], [-0.18, 0.7, -0.2], 0, legs]);
        return rows;
      } },
      'парта': { fam: 'помещение', h: 0.8, f(v, p) {
        return [['box', [1.2, 0.05, 0.55], [0, 0.75, 0], [v ? 0.12 : 0, 0, 0], 'дерево'], ['box', [1.1, 0.25, 0.5], [0, 0.6, -0.02], 0, C.dark(p.дерево, 0.1)], ['box', [0.06, 0.6, 0.5], [-0.55, 0.3, 0], 0, 'металл'], ['box', [0.06, 0.6, 0.5], [0.55, 0.3, 0], 0, 'металл'], ['box', [0.3, 0.04, 0.22], [0.25, 0.79, 0.05], 0.2, 'ткань', { d: 1 }]];
      } },
      'школьная доска': { fam: 'помещение', h: 2, f(v, p) {
        return [['box', [3.2, 1.3, 0.06], [0, 1.4, 0], 0, v ? 'светлый' : C.dark(p.листва, 0.45)], ['box', [3.4, 1.45, 0.05], [0, 1.4, -0.03], 0, 'дерево'], ['box', [3.2, 0.06, 0.15], [0, 0.73, 0.06], 0, 'дерево'], ['box', [0.6, 0.05, 0.03], [-0.8, 1.6, 0.04], [0, 0, 0.2], v ? 'тёмный' : 'светлый', { d: 1 }], ['box', [0.4, 0.05, 0.03], [0.4, 1.3, 0.04], [0, 0, -0.4], v ? 'тёмный' : 'светлый', { d: 1 }]];
      } },
      'шкаф': { fam: 'помещение', h: 2.2, f(v, p) {
        const D = C.dark(p.дерево, 0.15), rows = [];
        if (v === 3) { rows.push(['box', [0.06, 2, 0.5], [-0.7, 1, 0], 0, 'дерево'], ['box', [0.06, 2, 0.5], [0.7, 1, 0], 0, 'дерево']); for (let i = 0; i < 5; i++) rows.push(['box', [1.4, 0.05, 0.5], [0, 0.05 + i * 0.48, 0], 0, 'дерево']); rows.push(['box', [0.3, 0.3, 0.3], [-0.3, 0.68, 0], 0.3, 'ткань'], ['cyl', [0.2, 0.3, 0.2], [0.3, 1.16, 0], 0, clay(p)]); return rows; }
        const h = v === 2 ? 1.0 : 2.1;
        rows.push(['box', [1.4, h, 0.6], [0, h / 2, 0], 0, 'дерево'], ['box', [1.5, 0.08, 0.66], [0, h + 0.04, 0], 0, D]);
        if (v === 2) for (let i = 0; i < 3; i++) rows.push(['box', [1.3, 0.28, 0.03], [0, 0.18 + i * 0.32, 0.31], 0, D], ['box', [0.2, 0.04, 0.04], [0, 0.18 + i * 0.32, 0.34], 0, 'металл']);
        else rows.push(['box', [0.02, h - 0.1, 0.03], [0, h / 2, 0.31], 0, D], ['box', [0.04, 0.2, 0.04], [-0.08, h / 2, 0.34], 0, 'металл'], ['box', [0.04, 0.2, 0.04], [0.08, h / 2, 0.34], 0, 'металл']);
        if (v === 1) rows.push(['box', [0.6, 0.9, 0.03], [-0.35, h * 0.7, 0.32], 0, 'стекло', { alpha: 0.7 }], ['box', [0.6, 0.9, 0.03], [0.35, h * 0.7, 0.32], 0, 'стекло', { alpha: 0.7 }]);
        return rows;
      } },
      'книжная полка': { fam: 'помещение', h: 2, f(v, p, o) {
        const w = [1.4, 2.2, 1.6, 1.0][v], n = [4, 2, 1, 4][v], y0 = v === 2 ? 1.6 : 0, rows = [];
        if (v !== 2) rows.push(['box', [0.06, n * 0.48 + 0.06, 0.35], [-w / 2, n * 0.24, 0], 0, 'дерево'], ['box', [0.06, n * 0.48 + 0.06, 0.35], [w / 2, n * 0.24, 0], 0, 'дерево'], ['box', [w, n * 0.48, 0.03], [0, n * 0.24, -0.16], 0, C.dark(p.дерево, 0.2)]);
        else rows.push(['box', [0.05, 0.25, 0.3], [-w / 2 + 0.1, y0 - 0.1, 0], 0, 'металл'], ['box', [0.05, 0.25, 0.3], [w / 2 - 0.1, y0 - 0.1, 0], 0, 'металл']);
        const cols = ['ткань', 'акцент', 'листва', 'вода', 'крыша', 'светлый'];
        for (let i = 0; i <= n; i++) if (v !== 2 || i === 0) rows.push(['box', [w, 0.04, 0.35], [0, y0 + i * 0.48, 0], 0, 'дерево']);
        for (let i = 0; i < n; i++) { let x = -w / 2 + 0.08; while (x < w / 2 - 0.15) { const bw = 0.06 + o.r() * 0.07, bh = 0.28 + o.r() * 0.14; rows.push(['box', [bw, bh, 0.24], [x + bw / 2, y0 + i * 0.48 + 0.02 + bh / 2, 0], [0, 0, o.r() < 0.1 ? 0.25 : 0], cols[Math.floor(o.r() * cols.length)], { keep: 1, noglow: 1 }]); x += bw + 0.01; } }
        return rows;
      } },
      'стопка книг': { fam: 'помещение', h: 0.6, f(v, p, o) {
        const cols = ['ткань', 'акцент', 'листва', 'вода', 'крыша'], g = { noglow: 1 }, rows = [];
        if (v === 1) return line(6, 0.6, (x, i) => ['box', [0.08, 0.3 + (i % 3) * 0.05, 0.22], [x, 0.17, 0], [0, 0, i === 5 ? 0.4 : 0], cols[i % 5], g]);
        const n = v === 3 ? 9 : 5;
        for (let i = 0; i < n; i++) rows.push(['box', [0.36 + o.r() * 0.08, 0.07, 0.26], [(o.r() - 0.5) * 0.06, 0.035 + i * 0.07, 0], (o.r() - 0.5) * (v === 3 ? 0.6 : 0.2), cols[i % 5], g]);
        if (v === 2) rows.push(['box', [0.45, 0.02, 0.3], [0, n * 0.07 + 0.02, 0], [0, 0, 0.1], 'светлый']);
        return rows;
      } },
      'кухонная плита': { fam: 'помещение', h: 0.9, f(v) {
        return [['box', [0.8, 0.85, 0.65], [0, 0.42, 0], 0, v ? 'металл' : 'светлый'], ['box', [0.6, 0.35, 0.03], [0, 0.4, 0.33], 0, 'тёмный'], ...[[-0.2, -0.15], [0.2, -0.15], [-0.2, 0.15], [0.2, 0.15]].map(([x, z]) => ['torus', [0.24, 0.03, 0.24], [x, 0.86, z], 0, 'тёмный']), ['torus', [0.24, 0.03, 0.24], [0.2, 0.87, 0.15], 0, 'огонь', { glow: 1, d: 1 }]];
      } },
      'холодильник': { fam: 'помещение', h: 1.9, f(v) {
        return [['rbox', [0.8, 1.9, 0.7], [0, 0.95, 0], 0, v ? 'ткань' : 'светлый', { keep: 1 }], ['box', [0.78, 0.03, 0.02], [0, 1.25, 0.36], 0, 'тёмный'], ['box', [0.05, 0.4, 0.05], [0.3, 1.55, 0.38], 0, 'металл'], ['box', [0.05, 0.4, 0.05], [0.3, 0.9, 0.38], 0, 'металл'], ['box', [0.15, 0.15, 0.02], [-0.1, 1.5, 0.36], [0, 0, 0.3], 'акцент', { d: 1 }]];
      } },
      'кастрюля': { fam: 'помещение', h: 0.5, f(v) {
        return [['cyl', [0.6, 0.45, 0.6], [0, 0.23, 0], 0, v ? 'ткань' : 'металл', { tess: 12 }], ['cyl', [0.62, 0.05, 0.62], [0, 0.48, 0], 0, 'металл'], ['sphere', [0.1, 0.06, 0.1], [0, 0.53, 0], 0, 'тёмный'], ['box', [0.15, 0.05, 0.06], [0.36, 0.38, 0], 0, 'тёмный'], ['box', [0.15, 0.05, 0.06], [-0.36, 0.38, 0], 0, 'тёмный']];
      } },
      'сковорода': { fam: 'помещение', h: 0.15, f(v) {
        return [['cyl', [0.6, 0.08, 0.6], [0, 0.05, 0], 0, 'тёмный', { tess: 12 }], ['box', [0.55, 0.05, 0.08], [0.55, 0.08, 0], 0, 'ствол'], ...(v ? [['disc', [0.35, 0, 0.35], [0, 0.1, 0], 0, 'акцент'], ['sphere', [0.15, 0.06, 0.15], [0, 0.11, 0], 0, 'огонь', { noglow: 1 }]] : [])];
      } },
      'тарелки': { fam: 'помещение', h: 0.2, f(v) {
        return Array.from({ length: v ? 3 : 6 }, (_, i) => ['cyl', [0.4, 0.03, 0.4], [i * 0.005, 0.02 + i * 0.03, 0], 0, i % 2 ? 'светлый' : 'стена', { top: 1.2, tess: 12 }]);
      } },
      'ящик': { fam: 'помещение', h: 1, f(v, p) {
        const D = C.dark(p.дерево, 0.2), one = (y, s, a) => [['box', [s, s, s], [0, y + s / 2, 0], a, 'дерево'], ...[-1, 1].map(k => ['box', [s + 0.02, 0.12, 0.12], [0, y + s / 2 + k * s * 0.42, s / 2], a, D]), ['box', [0.12, s + 0.02, 0.12], [s * 0.44, y + s / 2, s / 2], a, D, { d: 1 }], ['box', [0.12, s + 0.02, 0.12], [-s * 0.44, y + s / 2, s / 2], a, D, { d: 1 }]];
        if (v === 1) return [['box', [1, 1, 1], [0, 0.5, 0], 0, C.dark(p.дерево, 0.35)], ...line(4, 0.8, y => ['box', [1.02, 0.16, 1.02], [0, 0.5 + y, 0], 0, 'дерево'])];
        if (v === 2) return [...one(0, 1, 0), ...one(1, 0.8, 0.3)];
        if (v === 3) return [...one(0, 1, 0), ['box', [1.25, 0.12, 0.05], [0, 0.5, 0.52], [0, 0, 0.78], D], ['box', [1.25, 0.12, 0.05], [0, 0.5, 0.52], [0, 0, -0.78], D]];
        return one(0, 1, 0);
      } },
      'коробка': { fam: 'помещение', h: 0.6, f(v, p) {
        const card = C.light(C.mix(p.дерево, p.акцент, 0.2), 0.25), tape = C.light(card, 0.35);
        const one = (y, w, h, d, a) => [['box', [w, h, d], [0, y + h / 2, 0], a, card], ['box', [w + 0.01, 0.01, 0.14], [0, y + h, 0], a, tape]];
        if (v === 1) return [['box', [0.7, 0.55, 0.6], [0, 0.27, 0], 0, card], ['box', [0.7, 0.03, 0.3], [0, 0.6, 0.42], [0.9, 0, 0], card], ['box', [0.7, 0.03, 0.3], [0, 0.6, -0.42], [-0.9, 0, 0], card]];
        if (v === 2) return [...one(0, 0.7, 0.5, 0.6, 0), ...one(0.5, 0.6, 0.4, 0.5, 0.4), ...one(0.9, 0.45, 0.35, 0.4, -0.2)];
        return one(0, v === 3 ? 1.4 : 0.7, v === 3 ? 0.4 : 0.55, 0.6, 0);
      } },
      'бочка': { fam: 'помещение', h: 1.1, f(v, p) {
        const H = v === 2 ? 0.7 : 1.1, D = v === 2 ? 0.6 : 0.85;
        const rows = [['cyl', [D, H, D], [0, H / 2, 0], 0, 'дерево', { tess: 10 }], ['cyl', [D * 1.08, H * 0.4, D * 1.08], [0, H / 2, 0], 0, 'дерево', { tess: 10 }], ...[0.2, 0.8].map(k => ['torus', [D * 1.04, 0.05, D * 1.04], [0, H * k, 0], 0, 'металл', { thick: 0.08 }])];
        if (v === 3) rows.push(['cyl', [D * 1.02, 0.06, D * 1.02], [0, H + 0.03, 0], 0, C.dark(p.дерево, 0.2)]);
        if (v === 1) return rows.map(r => r.slice(0, 2).concat([[0, D / 2 + 0.02, r[2][1] - H / 2], [Math.PI / 2, 0, 0]]).concat(r.slice(4)));
        return rows;
      } },
      'бочка взрывная': { fam: 'помещение', h: 1.1, f(v, p) {
        return [['cyl', [0.85, 1.1, 0.85], [0, 0.55, 0], 0, redOf(p), { tess: 10 }], ...[0.2, 0.9].map(y => ['torus', [0.88, 0.05, 0.88], [0, y, 0], 0, 'тёмный']), ['box', [0.4, 0.4, 0.02], [0, 0.6, 0.43], 0, 'акцент', { glow: v ? 0.6 : 0.2 }]];
      } },
      'сундук': { fam: 'помещение', h: 0.9, f(v, p) {
        const k = v === 2 ? 0.7 : 1, w = 1.1 * k, d = 0.7 * k, h = (v === 3 ? 0.4 : 0.5) * k, rows = [['box', [w, h, d], [0, h / 2, 0], 0, 'дерево']];
        rows.push(v === 1 ? ['box', [w, 0.1, d], [0, h + d / 2, -d / 2], [-1.3, 0, 0], C.dark(p.дерево, 0.1)] : ['cyl', [d, w, d * (v === 3 ? 0.4 : 0.8)], [0, h, 0], [0, 0, Math.PI / 2], C.dark(p.дерево, 0.1), { tess: 8 }]);
        rows.push(...[-0.35, 0.35].map(x => ['box', [0.08 * k, h + 0.05, d + 0.04], [x * w, h / 2, 0], 0, 'металл']), ['box', [0.16 * k, 0.2 * k, 0.05], [0, h * 0.8, d / 2 + 0.02], 0, 'акцент', { glow: 0.3 }]);
        if (v === 1) rows.push(['box', [w * 0.85, 0.1, d * 0.8], [0, h - 0.02, 0], 0, 'свет', { glow: 1 }], ['sphere', [0.25, 0.15, 0.2], [0.2, h + 0.05, 0], 0, 'акцент', { glow: 0.7 }]);
        return rows;
      } },
      'чемодан': { fam: 'помещение', h: 0.8, f(v) {
        return [['rbox', [0.7, 0.6, 0.3], [0, 0.35, 0], 0, v ? 'ткань' : 'акцент', { keep: 1, noglow: 1 }], ['torus', [0.25, 0.04, 0.25], [0, 0.72, 0], [Math.PI / 2, 0, 0], 'тёмный'], ['box', [0.72, 0.04, 0.32], [0, 0.35, 0], 0, 'тёмный', { d: 1 }]];
      } },
      'лампа': { fam: 'помещение', h: 0.7, f(v, p) {
        if (v === 1) return [['cyl', [0.5, 0.05, 0.5], [0, 0.03, 0], 0, 'металл'], ['cyl', [0.05, 1.7, 0.05], [0, 0.85, 0], 0, 'металл'], ['cone', [0.6, 0.45, 0.6], [0, 1.8, 0], 0, 'свет', { top: 0.55, glow: 0.7 }]];
        if (v === 2) return [['cyl', [0.03, 1.2, 0.03], [0, 2.4, 0], 0, 'тёмный'], ['hemi', [0.6, 0.7, 0.6], [0, 1.75, 0], 0, 'ткань'], ['sphere', [0.2, 0.2, 0.2], [0, 1.73, 0], 0, 'свет', { glow: 1 }]];
        if (v === 3) return [['box', [0.3, 0.05, 0.25], [0, 0.03, 0], 0, 'металл'], ['cyl', [0.04, 0.45, 0.04], [0, 0.25, 0], [0, 0, 0.3], 'металл'], ['cyl', [0.04, 0.4, 0.04], [0.15, 0.55, 0], [0, 0, -0.9], 'металл'], ['cone', [0.22, 0.2, 0.22], [0.32, 0.6, 0], [0, 0, -2.2], 'ткань', { top: 0.4 }], ['sphere', [0.1, 0.1, 0.1], [0.36, 0.56, 0], 0, 'свет', { glow: 1 }]];
        return [['sphere', [0.3, 0.2, 0.3], [0, 0.1, 0], 0, clay(p)], ['cyl', [0.04, 0.35, 0.04], [0, 0.35, 0], 0, 'металл'], ['cone', [0.5, 0.32, 0.5], [0, 0.62, 0], 0, 'свет', { top: 0.55, glow: 0.7 }]];
      } },
      'ковёр': { fam: 'помещение', h: 0.03, flat: 1, f(v, p) {
        const f = v ? 'disc' : 'box';
        return [[f, [3, 0.02, 2], [0, 0.01, 0], 0, 'ткань', { tess: 14, noglow: 1 }], [f, [2.3, 0.022, 1.4], [0, 0.015, 0], 0, 'акцент', { tess: 14, noglow: 1 }], [f, [1.2, 0.024, 0.6], [0, 0.02, 0], 0, C.dark(p.ткань, 0.25), { tess: 14 }]];
      } },
      'телевизор': { fam: 'помещение', h: 1.2, f(v) {
        return v ? [['box', [1.6, 0.95, 0.08], [0, 1.0, 0], 0, 'тёмный'], ['box', [1.5, 0.85, 0.02], [0, 1.0, 0.05], 0, 'вода', { glow: 0.5 }], ['box', [0.4, 0.05, 0.25], [0, 0.5, 0], 0, 'тёмный'], ['box', [0.08, 0.45, 0.06], [0, 0.72, 0], 0, 'тёмный']]
          : [['rbox', [1.0, 0.8, 0.8], [0, 0.6, 0], 0, 'дерево', { keep: 1 }], ['box', [0.7, 0.55, 0.05], [-0.08, 0.62, 0.4], 0, 'вода', { glow: 0.4 }], ['cyl', [0.1, 0.06, 0.1], [0.38, 0.75, 0.4], [Math.PI / 2, 0, 0], 'металл'], ['cyl', [0.03, 0.5, 0.03], [0.15, 1.2, 0], [0, 0, 0.5], 'металл', { d: 1 }], ['cyl', [0.03, 0.5, 0.03], [-0.15, 1.2, 0], [0, 0, -0.5], 'металл', { d: 1 }]];
      } },
      'кровать': { fam: 'помещение', h: 1, f(v) {
        return [['box', [1.2, 0.35, 2.1], [0, 0.3, 0], 0, 'дерево'], ['rbox', [1.1, 0.2, 2.0], [0, 0.55, 0], 0, 'светлый', { keep: 1 }], ['rbox', [1.1, 0.12, 1.4], [0, 0.66, 0.3], 0, 'ткань', { keep: 1, noglow: 1 }], ['rbox', [0.7, 0.15, 0.35], [0, 0.7, -0.75], 0, 'стена', { keep: 1 }], ['box', [1.25, v ? 1.3 : 0.9, 0.1], [0, v ? 0.65 : 0.45, -1.05], 0, 'дерево']];
      } },
      'картина': { fam: 'помещение', h: 1, f(v) {
        return [['box', [v ? 0.8 : 1.2, v ? 1.0 : 0.8, 0.06], [0, 0.5, 0], 0, 'дерево'], ['box', [v ? 0.66 : 1.06, v ? 0.86 : 0.66, 0.02], [0, 0.5, 0.03], 0, 'вода'], ['cyl', [0.3, 0.02, 0.3], [0.2, 0.62, 0.05], [Math.PI / 2, 0, 0], 'акцент'], ['prism', [0.6, 0.35, 0.02], [-0.1, 0.36, 0.05], 0, 'листва', { d: 1 }]];
      } },
      'цветок в горшке': { fam: 'помещение', h: 0.9, f(v, p) {
        const pot = [['cyl', [0.4, 0.4, 0.4], [0, 0.2, 0], 0, clay(p), { top: 1.25 }], ['cyl', [0.48, 0.06, 0.48], [0, 0.42, 0], 0, C.dark(clay(p), 0.1)], ['disc', [0.42, 0, 0.42], [0, 0.4, 0], 0, C.dark(p.земля, 0.35)]];
        const plant = [ring(6, 0.15, (x, z, i, a) => ['box', [0.4, 0.04, 0.16], [x, 0.55 + (i % 2) * 0.12, z], [0, -a, 0.5], 'листва']),
          [['capsule', [0.22, 0.55, 0.22], [0, 0.68, 0], 0, 'листва'], ['sphere', [0.08, 0.08, 0.08], [0, 0.97, 0], 0, 'ткань']],
          [['cyl', [0.03, 0.4, 0.03], [0, 0.6, 0], 0, 'листва'], ...ring(5, 0.1, (x, z) => ['sphere', [0.12, 0.08, 0.12], [x, 0.82, z], 0, 'ткань']), ['sphere', [0.08, 0.08, 0.08], [0, 0.84, 0], 0, 'акцент']],
          [['cyl', [0.06, 0.9, 0.06], [0, 0.85, 0], 0, 'ствол'], ...ring(5, 0.25, (x, z, i, a) => ['box', [0.6, 0.03, 0.14], [x, 1.25, z], [0, -a, 0.45], 'листва'])]][v];
        return pot.concat(plant);
      } },
      'игрушки': { fam: 'помещение', h: 0.5, f(v) {
        return [['box', [0.3, 0.3, 0.3], [0, 0.15, 0], 0.3, 'акцент'], ['box', [0.25, 0.25, 0.25], [0.32, 0.12, 0.1], 0.8, 'ткань'], ['box', [0.25, 0.25, 0.25], [0.15, 0.42, 0.05], 0.1, 'листва'], ...(v ? [['cone', [0.4, 0.35, 0.4], [-0.45, 0.33, 0], 0, 'вода'], ['cone', [0.4, 0.15, 0.4], [-0.45, 0.08, 0], [Math.PI, 0, 0], 'вода']] : [['sphere', [0.36, 0.36, 0.36], [-0.4, 0.18, 0.2], 0, 'огонь', { noglow: 1 }]])];
      } },
      'трон': { fam: 'помещение', h: 2.2, f() {
        return [['box', [1.2, 0.5, 1.0], [0, 0.25, 0], 0, 'акцент'], ['rbox', [1.0, 0.2, 0.9], [0, 0.6, 0], 0, 'ткань', { keep: 1 }], ['box', [1.2, 1.8, 0.2], [0, 1.4, -0.45], 0, 'акцент'], ...[-0.5, 0.5].map(x => ['box', [0.2, 0.4, 0.9], [x, 0.85, 0], 0, 'акцент']), ...line(3, 0.9, x => ['cone', [0.2, 0.4, 0.2], [x, 2.45, -0.45], 0, 'свет', { glow: 0.4 }])];
      } },

      /* ----- космос и техника ----- */
      'купол станции': { fam: 'космос', h: 3.4, f(v) {
        const rows = [['hemi', [5, 6, 5], [0, 0.4, 0], 0, v === 2 ? 'стекло' : 'стена', v === 2 ? { alpha: 0.5 } : {}], ['cyl', [5.3, 0.5, 5.3], [0, 0.25, 0], 0, 'металл', { tess: 14 }], ['torus', [4.7, 0.25, 4.7], [0, 1.2, 0], 0, 'окно', { d: 1 }], ['box', [1.2, 1.6, 1.2], [0, 0.8, 2.5], 0, 'металл'], ['box', [0.8, 1.2, 0.05], [0, 0.7, 3.12], 0, 'свет', { glow: 0.6 }]];
        if (v === 1) rows.push(['cyl', [1.4, 5, 1.4], [3.8, 0.9, 0], [0, 0, Math.PI / 2], 'стена'], ...[2.2, 3.4, 4.6].map(x => ['torus', [1.5, 0.1, 1.5], [x, 0.9, 0], [0, 0, Math.PI / 2], 'металл']));
        if (v === 2) rows.push(['sphere', [1.6, 1.4, 1.6], [0, 1.6, 0], 0, 'листва'], ['cyl', [0.25, 0.8, 0.25], [0, 0.8, 0], 0, 'ствол']);
        if (v === 3) rows.push(['hemi', [3, 4, 3], [0, 3.2, 0], 0, 'стена'], ['cyl', [3.2, 0.3, 3.2], [0, 3.2, 0], 0, 'металл']);
        rows.push(['cyl', [0.06, 1.6, 0.06], [1, 3.6, 0], 0, 'металл', { d: 1 }], ['sphere', [0.18, 0.18, 0.18], [1, 4.4, 0], 0, 'акцент', { glow: 1, d: 1 }]);
        return rows;
      } },
      'антенна': { fam: 'космос', h: 4, f(v, p) {
        const dish = (x, z, s, y) => [['cyl', [0.12 * s, y, 0.12 * s], [x, y / 2, z], 0, 'металл'], ['hemi', [2.4 * s, 1.6 * s, 2.4 * s], [x, y + 0.3 * s, z], [2.3, 0, 0], 'светлый'], ['cyl', [0.05 * s, 0.9 * s, 0.05 * s], [x, y + 0.6 * s, z + 0.35 * s], [0.75, 0, 0], 'металл'], ['sphere', [0.18 * s, 0.18 * s, 0.18 * s], [x, y + 0.95 * s, z + 0.7 * s], 0, 'акцент', { glow: 0.8 }]];
        if (v === 2) return flat([dish(-1.2, 0, 0.5, 1), dish(0, 0.3, 0.6, 1.2), dish(1.2, 0, 0.5, 1)]);
        if (v === 3) return [['cyl', [0.15, 6, 0.15], [0, 3, 0], 0, 'металл'], ...[1.5, 3, 4.5].map(y => ['box', [1.2 - y * 0.15, 0.06, 0.06], [0, y, 0], 0, 'металл']), ['sphere', [0.25, 0.25, 0.25], [0, 6.1, 0], 0, redOf(p), { glow: 1 }]];
        const rows = dish(0, 0, v ? 1.6 : 1, v ? 3 : 2.2);
        if (v) rows.push(...[[-0.7, 0], [0.7, 0], [0, 0.7]].map(([x, z]) => ['cyl', [0.08, 3.2, 0.08], [x * 0.6, 1.5, z * 0.6], [z * 0.3, 0, -x * 0.3], 'металл']));
        return rows;
      } },
      'солнечная панель': { fam: 'космос', h: 1.6, f(v, p) {
        const panel = x => [['box', [2.4, 0.06, 1.4], [x, 1.1, 0], [0.5, 0, 0], 'металл'], ...[-0.6, 0.6].map(dx => ['box', [1.05, 0.02, 1.2], [x + dx, 1.13, 0.02], [0.5, 0, 0], C.dark(p.вода, 0.3), { shiny: 1 }])];
        return [['cyl', [0.1, 1, 0.1], [0, 0.5, 0], 0, 'металл'], ...panel(0), ...(v ? [['cyl', [0.1, 1, 0.1], [2.6, 0.5, 0], 0, 'металл'], ...panel(2.6)] : [])];
      } },
      'ракета': { fam: 'космос', h: 7, f(v) {
        const w = [1.4, 1.0, 2.0, 1.4][v], h = [5, 6.5, 4, 5][v], y0 = v === 3 ? 0.8 : 0.4, rows = [['cyl', [w, h, w], [0, y0 + h / 2 + 0.4, 0], 0, 'светлый', { tess: 10 }], ['cone', [w, w * 1.3, w], [0, y0 + h + 0.4 + w * 0.65, 0], 0, 'ткань', { tess: 10 }], ['cyl', [w * 0.45, 0.06, w * 0.45], [0, y0 + h * 0.75, w / 2], [Math.PI / 2, 0, 0], 'окно', { tess: 10 }], ['torus', [w * 0.5, 0.08, w * 0.5], [0, y0 + h * 0.75, w / 2 + 0.02], [Math.PI / 2, 0, 0], 'металл']];
        rows.push(...ring(v === 2 ? 4 : 3, w / 2, (x, z, i, a) => ['box', [0.08, w * 1.1, w * 0.8], [x * 1.25, y0 + w * 0.6, z * 1.25], -a, 'ткань']), ['cone', [w * 0.8, 0.6, w * 0.8], [0, y0 + 0.2, 0], 0, 'металл', { top: 0.7 }], ['box', [w * 1.02, 0.25, w * 1.02], [0, y0 + h * 0.4, 0], 0, 'акцент', { d: 1 }]);
        if (v === 3) rows.push(['cyl', [w * 3, 0.6, w * 3], [0, 0.3, 0], 0, 'камень', { tess: 8 }], ['box', [0.4, h + 1, 0.4], [w * 1.4, (h + 1) / 2, 0], 0, 'металл'], ['box', [w * 1.2, 0.15, 0.3], [w * 0.8, h * 0.8, 0], 0, 'металл']);
        return rows;
      } },
      'спутник': { fam: 'космос', h: 1.5, f(v, p) {
        return [['box', [0.8, 0.8, 0.8], [0, 0.8, 0], 0, 'акцент'], ...[-1.2, 1.2].map(x => ['box', [1.4, 0.04, 0.6], [x, 0.8, 0], 0, C.dark(p.вода, 0.3), { shiny: 1 }]), ['hemi', [0.6, 0.5, 0.6], [0, 1.2, 0], 0, 'светлый'], ['cyl', [0.03, 0.6, 0.03], [0.3, 1.4, 0], 0, 'металл', { d: v ? 0 : 1 }]];
      } },
      'контейнер': { fam: 'космос', h: 2.6, f(v, p) {
        const one = (y, c, a) => [['box', [6, 2.5, 2.4], [0, y + 1.25, 0], a, c], ...line(10, 5.6, x => ['box', [0.08, 2.4, 2.45], [x, y + 1.25, 0], a, C.dark(p[c] || c, 0.15), { d: 1 }])];
        if (v === 3) return [['box', [1.4, 1.0, 1.0], [0, 0.5, 0], 0, 'металл'], ['box', [1.42, 0.12, 1.02], [0, 0.75, 0], 0, 'акцент', { glow: 0.8 }], ['box', [0.3, 0.2, 0.02], [0.4, 0.4, 0.51], 0, 'свет', { glow: 1 }]];
        if (v === 1) return [...one(0, 'ткань', 0), ...one(2.5, 'акцент', 0.15)];
        const rows = one(0, v === 2 ? 'металл' : 'ткань', 0);
        if (v === 2) rows.push(['box', [0.05, 2.3, 1.1], [3.0, 1.25, 0.6], 0.8, 'металл']);
        return rows;
      } },
      'труба': { fam: 'космос', h: 1.2, f(v, p) {
        const M = 'металл', fl = (x, y, z, r) => ['cyl', [0.9, 0.15, 0.9], [x, y, z], r, C.dark(p.металл, 0.15), { tess: 10 }];
        if (v === 1) return [['cyl', [0.7, 3, 0.7], [-1.5, 0.6, 0], [0, 0, Math.PI / 2], M], ['cyl', [0.7, 2, 0.7], [0.3, 1.6, 0], 0, M], ['sphere', [0.8, 0.8, 0.8], [0.3, 0.6, 0], 0, M], fl(-3, 0.6, 0, [0, 0, Math.PI / 2]), fl(0.3, 2.6, 0, 0)];
        if (v === 2) return [['cyl', [0.7, 4, 0.7], [0, 2, 0], 0, M], fl(0, 1, 0, 0), fl(0, 3, 0, 0), ['torus', [0.8, 0.1, 0.8], [0, 2, 0.6], [Math.PI / 2, 0, 0], redOf(p)], ['box', [0.06, 0.06, 0.6], [0, 2, 0.35], 0, 'металл']];
        if (v === 3) return line(3, 1.4, z => ['cyl', [0.5, 6, 0.5], [0, 0.3 + Math.abs(z) * 0.3, z], [0, 0, Math.PI / 2], M]).concat([['box', [0.2, 1.2, 2], [-2, 0.5, 0], 0, 'камень'], ['box', [0.2, 1.2, 2], [2, 0.5, 0], 0, 'камень']]);
        return [['cyl', [0.7, 6, 0.7], [0, 0.6, 0], [0, 0, Math.PI / 2], M], fl(-2, 0.6, 0, [0, 0, Math.PI / 2]), fl(2, 0.6, 0, [0, 0, Math.PI / 2]), ['box', [0.3, 0.6, 0.6], [-2, 0.15, 0], 0, 'камень'], ['box', [0.3, 0.6, 0.6], [2, 0.15, 0], 0, 'камень']];
      } },
      'кабель': { fam: 'космос', h: 0.2, f(v) {
        return Array.from({ length: 8 }, (_, i) => ['cyl', [0.1, 0.7, 0.1], [-2.5 + i * 0.65, 0.05, Math.sin(i * 0.9) * 0.3], [0, Math.cos(i * 0.9) * 0.4, Math.PI / 2], v ? 'акцент' : 'тёмный', { tess: 5 }]);
      } },
      'пульт': { fam: 'космос', h: 1.2, f(v, p) {
        return [['box', [1.6, 0.9, 0.7], [0, 0.45, 0], 0, 'металл'], ['box', [1.6, 0.08, 0.8], [0, 0.95, 0.05], [0.4, 0, 0], C.dark(p.металл, 0.2)], ['box', [1.0, 0.6, 0.06], [0, 1.3, -0.3], [-0.2, 0, 0], 'вода', { glow: 0.6 }], ...line(4, 1.2, (x, i) => ['cyl', [0.12, 0.05, 0.12], [x, 1.0, 0.25], [0.4, 0, 0], ['огонь', 'акцент', 'листва', 'свет'][i], { glow: 0.8 }])];
      } },
      'конвейер': { fam: 'космос', h: 1, f(v) {
        return [['box', [6, 0.15, 1.2], [0, 0.9, 0], 0, 'тёмный'], ...line(8, 5.6, x => ['cyl', [0.25, 1.3, 0.25], [x, 0.78, 0], [Math.PI / 2, 0, 0], 'металл']), ...line(3, 5, x => ['box', [0.1, 0.8, 1.3], [x, 0.4, 0], 0, 'металл']), ['box', [6, 0.3, 0.08], [0, 1.05, 0.64], 0, 'акцент', { d: 1 }], ...(v ? [['box', [0.5, 0.4, 0.5], [-1.5, 1.2, 0], 0.3, 'ткань'], ['box', [0.4, 0.4, 0.4], [1, 1.2, 0], -0.2, 'дерево']] : [])];
      } },
      'шестерня': { fam: 'космос', h: 2, f(v, p) {
        const flatGear = (x, z, R, n) => [['cyl', [R * 2, 0.4, R * 2], [x, 0.2, z], 0, 'металл', { tess: 14 }], ...ring(n, R, (a, b, i, t) => ['box', [0.35, 0.4, R * 0.35], [x + a, 0.2, z + b], -t, 'металл']), ['cyl', [R * 0.5, 0.45, R * 0.5], [x, 0.2, z], 0, C.dark(p.металл, 0.25), { tess: 8 }]];
        if (v === 1) return [...flatGear(0, 0, 1, 10), ...flatGear(1.9, 0.3, 0.7, 7)];
        if (v === 2) return [['cyl', [2.8, 0.4, 2.8], [0, 1.6, 0], [Math.PI / 2, 0, 0], 'металл', { tess: 14 }], ...ring(12, 1.4, (a, b, i, t) => ['box', [0.35, R2(1.4), 0.4], [a, 1.6 + b, 0], [0, 0, t + Math.PI / 2], 'металл']), ['box', [0.6, 1.6, 0.8], [0, 0.4, 0], 0, 'камень']];
        if (v === 3) return [['torus', [2.4, 0.3, 2.4], [0, 0.2, 0], 0, 'металл'], ...ring(12, 1.25, (a, b, i, t) => ['box', [0.3, 0.3, 0.35], [a, 0.2, b], -t, 'металл']), ...ring(4, 0.55, (a, b, i, t) => ['box', [1.1, 0.15, 0.15], [a, 0.2, b], -t, 'металл'])];
        return flatGear(0, 0, 1.2, 10);
      } },
      'планета': { fam: 'космос', h: 20, far: 1, f(v, p) {
        const rows = [['sphere', [20, 20, 20], [0, 10, 0], 0, v === 2 ? 'камень' : 'ткань', { seg: 10, noglow: 1 }]];
        if (v === 0) rows.push(['torus', [34, 1, 34], [0, 10, 0], [0.4, 0, 0.3], 'акцент', { thick: 0.06, tess: 24 }]);
        if (v === 1) rows.push(...[-5, 0, 5].map((y, i) => ['cyl', [20.3 - Math.abs(y) * 0.8, 2, 20.3 - Math.abs(y) * 0.8], [0, 10 + y, 0], 0, i % 2 ? 'акцент' : C.light(p.ткань, 0.2), { tess: 16 }]));
        if (v === 2) rows.push(...ring(5, 7, (x, z) => ['disc', [3, 0, 3], [x, 10 + z, 9.8], [Math.PI / 2, 0, 0], C.dark(p.камень, 0.25)]));
        if (v === 3) rows.push(['sphere', [5, 5, 5], [16, 16, 0], 0, 'камень'], ['sphere', [3, 3, 3], [-14, 4, 3], 0, 'светлый']);
        return rows;
      } },

      /* ----- праздник, парк, сон ----- */
      'торт': { fam: 'праздник', h: 1.2, f(v) {
        const t = (y, d, h, c) => ['cyl', [d, h, d], [0, y + h / 2, 0], 0, c, { tess: 14, noglow: 1 }];
        return [t(0, 1.6, 0.5, 'стена'), ['torus', [1.62, 0.12, 1.62], [0, 0.5, 0], 0, 'ткань', { noglow: 1 }], t(0.5, 1.1, 0.4, v ? 'ткань' : 'светлый'), ['torus', [1.12, 0.1, 1.12], [0, 0.9, 0], 0, 'акцент', { noglow: 1 }], ...ring(5, 0.35, (x, z) => ['cyl', [0.06, 0.3, 0.06], [x, 1.05, z], 0, 'вода']), ...ring(5, 0.35, (x, z) => ['sphere', [0.07, 0.12, 0.07], [x, 1.25, z], 0, 'огонь', { glow: 1 }])];
      } },
      'леденец': { fam: 'праздник', h: 1.6, f(v) {
        return [['cyl', [0.08, 1.2, 0.08], [0, 0.6, 0], 0, 'светлый'], ['cyl', [0.9, 0.15, 0.9], [0, 1.6, 0], [Math.PI / 2, 0, 0], v ? 'акцент' : 'ткань', { tess: 14 }], ['torus', [0.55, 0.12, 0.55], [0, 1.6, 0.04], [Math.PI / 2, 0, 0], 'светлый', { thick: 0.15 }]];
      } },
      'карусель': { fam: 'праздник', h: 3.5, f(v) {
        return [['cyl', [5, 0.4, 5], [0, 0.2, 0], 0, 'стена', { tess: 14 }], ['cyl', [0.3, 3, 0.3], [0, 1.9, 0], 0, 'акцент'], ['cone', [5.4, 1.2, 5.4], [0, 3.6, 0], 0, 'ткань', { tess: v ? 6 : 12 }], ...ring(6, 2, (x, z) => ['cyl', [0.08, 2.6, 0.08], [x, 1.7, z], 0, 'свет', { glow: 0.3 }]), ...ring(6, 2, (x, z, i) => ['rbox', [0.35, 0.5, 0.9], [x, 1.2 + (i % 2) * 0.3, z], Math.atan2(x, z) + Math.PI / 2, i % 2 ? 'акцент' : 'светлый'])];
      } },
      'колесо обозрения': { fam: 'праздник', h: 10, far: 1, f() {
        return [['torus', [9, 0.3, 9], [0, 5.5, 0], [Math.PI / 2, 0, 0], 'металл', { thick: 0.05, tess: 20 }], ...ring(4, 0, (x, z, i, a) => ['box', [0.1, 9, 0.1], [0, 5.5, 0], [0, 0, a / 2], 'металл']), ...ring(8, 4.5, (x, z, i) => ['box', [0.8, 0.7, 0.7], [x, 5.5 + z - 0.5, 0], 0, ['ткань', 'акцент', 'вода', 'листва'][i % 4], { noglow: 1 }]), ['box', [0.3, 5.5, 0.3], [-1.5, 2.75, 0], [0, 0, -0.28], 'металл'], ['box', [0.3, 5.5, 0.3], [1.5, 2.75, 0], [0, 0, 0.28], 'металл']];
      } },
      'воздушный шар': { fam: 'праздник', h: 5, f(v, p) {
        return [['sphere', [3, 3.4, 3], [0, 3.6, 0], 0, v ? 'акцент' : 'ткань', { seg: 7, noglow: 1 }], ...ring(6, 1.52, (x, z, i, a) => ['box', [0.06, 3.0, 0.4], [x, 3.6, z], -a, i % 2 ? 'светлый' : C.dark(p.ткань, 0.15), { d: 1 }]), ['box', [0.7, 0.5, 0.7], [0, 0.25, 0], 0, 'дерево'], ...ring(4, 0.3, (x, z) => ['cyl', [0.02, 1.6, 0.02], [x, 1.2, z], 0, 'тёмный', { keep: 1 }])];
      } },
      'радуга': { fam: 'праздник', h: 6, far: 1, f(v, p) {
        const cols = [redOf(p), 'огонь', 'акцент', 'листва', 'вода', 'ткань'];
        return cols.map((c, i) => ['torus', [12 - i * 0.7, 0.35, 12 - i * 0.7], [0, 0, 0], [Math.PI / 2, 0, 0], c, { thick: 0.03, tess: 24, glow: 0.3, alpha: v ? 0.7 : 1, keep: 1 }]);
      } },
      'облачный остров': { fam: 'праздник', h: 4, f(v) {
        const rows = [['cone', [5, 3, 4.4], [0, -1.5, 0], [Math.PI, 0.4, 0], 'камень', { tess: 6 }], ['cyl', [5.2, 0.5, 4.6], [0, 0.25, 0], 0, 'земля', { tess: 9 }], ['cyl', [4.8, 0.15, 4.2], [0, 0.55, 0], 0, 'листва', { tess: 9 }], ...ring(5, 2.6, (x, z, i) => ['sphere', [1.4, 0.8, 1.2], [x, -0.4 - (i % 2) * 0.5, z], 0, 'снег'])];
        if (v === 0) rows.push(['cyl', [0.3, 1.2, 0.3], [0.6, 1.2, 0], 0, 'ствол'], ['sphere', [1.8, 1.6, 1.8], [0.6, 2.3, 0], 0, 'листва']);
        if (v === 2) return rows.map(r => [r[0], arr3(r[1]).map(x => x * 0.55), arr3(r[2]).map(x => x * 0.55)].concat(r.slice(3)));
        if (v === 3) rows.push(['box', [0.6, 3, 0.2], [2.3, -1.4, 0], 0, 'вода', { alpha: 0.8 }], ['box', [1, 0.3, 1], [1.8, 0.65, 0], 0, 'вода', { shiny: 1 }]);
        return rows;
      } },
      'рельсы': { fam: 'праздник', h: 0.2, f(v) {
        return [...line(9, 7, x => ['box', [0.3, 0.08, 1.4], [x, 0.04, 0], 0, 'дерево']), ['box', [8, 0.1, 0.08], [0, 0.12, 0.5], 0, 'металл'], ['box', [8, 0.1, 0.08], [0, 0.12, -0.5], 0, 'металл'], ...(v ? [['box', [1.6, 0.8, 1.1], [0, 0.65, 0], 0, 'ткань'], ...[-0.5, 0.5].map(x => ['cyl', [0.4, 1.2, 0.4], [x, 0.3, 0], [Math.PI / 2, 0, 0], 'тёмный'])] : [])];
      } },

      /* ----- детали уровня: держат размер точно, язык формы меняет только примитивы ----- */
      'платформа': { fam: 'уровень', h: 0.6, level: 1, f(v, p) {
        const top = [['box', [3, 0.15, 3], [0, 0.53, 0], 0, 'листва'], ['box', [3, 0.12, 3], [0, 0.54, 0], 0, C.light(p.камень, 0.15)], ['box', [3, 0.1, 3], [0, 0.55, 0], 0, 'дерево'], ['box', [3, 0.08, 3], [0, 0.56, 0], 0, 'металл', { shiny: 1 }]][v];
        const body = ['box', [3, 0.5, 3], [0, 0.25, 0], 0, ['земля', 'камень', C.dark(p.дерево, 0.2), C.dark(p.металл, 0.25)][v]];
        const det = v === 1 ? line(3, 2, x => ['box', [0.04, 0.5, 3.02], [x, 0.25, 0], 0, C.dark(p.камень, 0.2)]) : v === 2 ? line(5, 2.6, x => ['box', [0.04, 0.12, 3.02], [x, 0.56, 0], 0, C.dark(p.дерево, 0.3)]) : v === 3 ? [['box', [3.02, 0.1, 0.2], [0, 0.4, 1.5], 0, 'акцент', { glow: 0.5 }], ['box', [3.02, 0.1, 0.2], [0, 0.4, -1.5], 0, 'акцент', { glow: 0.5 }]] : [['sphere', [0.4, 0.3, 0.4], [1.1, 0.62, 1.0], 0, 'листва', { d: 1 }]];
        return [body, top, ...det, ['box', [3.02, 0.06, 3.02], [0, 0.63, 0], 0, 'снег', { snow: 1 }]];
      } },
      'ступени': { fam: 'уровень', h: 1.2, level: 1, f(v, p) {
        const n = v === 1 ? 5 : 3, mat = ['камень', 'дерево', 'камень', 'акцент'][v], rows = [];
        if (v === 3) return line(3, 2, (x, i) => ['box', [0.9, 0.3, 1.2], [x, 0.4 + i * 0.4, 0], 0, i % 2 ? mat : 'светлый', { glow: 0.2 }]);
        for (let i = 0; i < n; i++) { const h = 1.2 * (i + 1) / n; rows.push(v === 2 ? ['box', [1.6, h, 1.2 / n], [0, h / 2, -0.6 + 1.2 * (i + 0.5) / n], 0, i % 2 ? C.dark(p[mat], 0.1) : mat] : ['box', [1.2 / n, h, 1.6], [-0.6 + 1.2 * (i + 0.5) / n, h / 2, 0], 0, i % 2 ? C.dark(p[mat], 0.1) : mat]); }
        return rows;
      } },
      'блок': { fam: 'уровень', h: 1, level: 1, f(v, p) {
        if (v === 0) return [['box', [1, 1, 1], [0, 0.5, 0], 0, 'крыша'], ...line(3, 0.66, y => ['box', [1.01, 0.04, 1.01], [0, 0.5 + y, 0], 0, 'стена']), ['box', [0.04, 0.3, 1.02], [0.15, 0.68, 0], 0, 'стена'], ['box', [0.04, 0.3, 1.02], [-0.2, 0.34, 0], 0, 'стена']];
        if (v === 1) return PROPS['ящик'].f(0, p, {});
        if (v === 2) return [['box', [1, 1, 1], [0, 0.5, 0], 0, 'лёд', { shiny: 1 }], ['box', [0.02, 0.7, 0.04], [0.2, 0.5, 0.51], [0, 0, 0.5], C.light(p.лёд, 0.5)], ['box', [0.02, 0.5, 0.04], [-0.2, 0.6, 0.51], [0, 0, -0.6], C.light(p.лёд, 0.5)]];
        return [['box', [1, 1, 1], [0, 0.5, 0], 0, 'акцент', { glow: 0.35 }], ['box', [0.7, 0.7, 1.02], [0, 0.5, 0], 0, C.light(p.акцент, 0.4), { glow: 0.6 }]];
      } },
      'стена лабиринта': { fam: 'уровень', h: 1, level: 1, f(v) {
        if (v === 1) return [['rbox', [1, 1, 1], [0, 0.5, 0], 0, 'листва', { keep: 1 }], ['sphere', [0.3, 0.3, 0.3], [0.2, 1.0, 0.1], 0, 'акцент', { d: 2 }]];
        if (v === 2) return [['box', [1, 1, 1], [0, 0.5, 0], 0, 'крыша'], ...line(4, 0.75, y => ['box', [1.01, 0.03, 1.01], [0, 0.5 + y, 0], 0, 'стена', { d: 1 }])];
        if (v === 3) return [['box', [1, 1, 1], [0, 0.5, 0], 0, 'тёмный'], ['box', [1.02, 0.06, 1.02], [0, 1.0, 0], 0, 'акцент', { glow: 1 }], ['box', [1.02, 0.06, 1.02], [0, 0.03, 0], 0, 'акцент', { glow: 0.6, d: 1 }]];
        return [['box', [1, 0.9, 1], [0, 0.45, 0], 0, 'камень'], ['box', [0.9, 0.14, 0.9], [0, 0.95, 0], 0, 'мох'], ['box', [0.95, 0.06, 0.95], [0, 1.03, 0], 0, 'снег', { snow: 1 }]];
      } },
      'пандус': { fam: 'уровень', h: 1, level: 1, f(v, p) {
        const mat = ['дерево', 'камень', 'металл', 'земля'][v];
        return [['wedge', [1.6, 1, 2], [0, 0.5, 0], Math.PI / 2, mat], ...(v === 2 ? line(3, 1.2, x => ['box', [1.6, 0.05, 0.15], [0, 0.55 + x * 0.45, -x * 0.9], [0.46, 0, 0], 'акцент', { glow: 0.5 }]) : []), ...(v === 0 ? line(4, 1.6, x => ['box', [1.62, 0.05, 0.04], [0, 0.52 + x * 0.48, -x], [0.46, 0, 0], C.dark(p.дерево, 0.3)]) : [])];
      } },
      'пружина': { fam: 'уровень', h: 0.9, level: 1, f(v) {
        if (v === 1) return [['cyl', [0.4, 0.5, 0.4], [0, 0.25, 0], 0, 'светлый'], ['hemi', [1.6, 1.2, 1.6], [0, 0.45, 0], 0, 'акцент'], ...ring(4, 0.45, (x, z) => ['sphere', [0.18, 0.08, 0.18], [x, 0.85, z], 0, 'светлый'])];
        if (v === 2) return [['cyl', [1.8, 0.08, 1.8], [0, 0.6, 0], 0, 'ткань', { tess: 14 }], ['torus', [1.9, 0.12, 1.9], [0, 0.6, 0], 0, 'акцент'], ...ring(4, 0.85, (x, z) => ['cyl', [0.08, 0.6, 0.08], [x, 0.3, z], 0, 'металл'])];
        if (v === 3) return [['box', [1, 0.15, 1], [0, 0.07, 0], 0, 'металл'], ...line(3, 0.4, (y, i) => ['box', [1 - i * 0.05, 0.18, 1 - i * 0.05], [0, 0.35 + y, 0], 0, i % 2 ? 'ткань' : 'тёмный']), ['box', [1, 0.12, 1], [0, 0.75, 0], 0, 'акцент']];
        return [['cyl', [1, 0.12, 1], [0, 0.06, 0], 0, 'металл', { tess: 10 }], ...Array.from({ length: 4 }, (_, i) => ['torus', [0.7, 0.08, 0.7], [0, 0.2 + i * 0.15, 0], [0.12, 0, 0], 'металл', { thick: 0.12 }]), ['cyl', [1, 0.15, 1], [0, 0.82, 0], 0, 'акцент', { tess: 10, glow: 0.3 }]];
      } },
      'полоса трека': { fam: 'уровень', h: 0.1, level: 1, flat: 1, f(v, p) {
        const road = ['тёмный', C.dark(p.земля2, 0.2), 'тёмный', 'металл'][v], rows = [['box', [4, 0.06, 6], [0, 0.03, 0], 0, road]];
        if (v !== 1) rows.push(...line(3, 4, z => ['box', [0.15, 0.065, 1], [0, 0.033, z], 0, 'светлый']));
        if (v === 0 || v === 1) for (const x of [-2, 2]) rows.push(...line(6, 5, (z, i) => ['box', [0.3, 0.1, 1], [x, 0.05, z], 0, i % 2 ? redOf(p) : 'светлый', { noglow: 1 }]));
        if (v === 2) for (const x of [-2, 2]) rows.push(['box', [0.12, 0.15, 6], [x, 0.08, 0], 0, 'акцент', { glow: 1 }]);
        if (v === 3) for (const x of [-0.7, 0.7]) rows.push(['box', [0.1, 0.12, 6], [x, 0.09, 0], 0, 'светлый', { shiny: 1 }]);
        return rows;
      } },
      'ворота-кольцо': { fam: 'уровень', h: 3, level: 1, f(v) {
        if (v === 1) return [['box', [3, 0.25, 0.25], [0, 3, 0], 0, 'акцент', { glow: 0.7 }], ['box', [0.25, 3, 0.25], [-1.4, 1.5, 0], 0, 'акцент', { glow: 0.7 }], ['box', [0.25, 3, 0.25], [1.4, 1.5, 0], 0, 'акцент', { glow: 0.7 }]];
        if (v === 3) return ring(9, 1.4, (x, z, i) => ['sphere', [0.5, 0.55, 0.5], [x, 1.6 + z, 0], 0, ['акцент', 'ткань', 'свет'][i % 3]]);
        return [['torus', [2.8, 0.3, 2.8], [0, 1.7, 0], [Math.PI / 2, 0, 0], 'акцент', { glow: 0.8, thick: 0.12 }], ['box', [0.15, 0.4, 0.15], [0, 0.2, 0], 0, 'металл'], ...(v === 2 ? ring(8, 1.55, (x, z, i, a) => ['cone', [0.25, 0.5, 0.25], [x, 1.7 + z, 0], [0, 0, a - Math.PI / 2], 'огонь', { glow: 0.4 }]) : [])];
      } },
      'мишень': { fam: 'уровень', h: 1.6, level: 1, f(v, p) {
        const rings = k => [1, 0.75, 0.5, 0.25].map((r, i) => ['cyl', [1.4 * r * k, 0.08 + i * 0.02, 1.4 * r * k], [0, 0, 0], [Math.PI / 2, 0, 0], i % 2 ? 'светлый' : redOf(p), { tess: 16 }]);
        const at = (rows, y, z) => moved(rows, q => [q[0], q[1] + y, q[2] + z]);
        if (v === 1) return [...PROPS['стог сена'].f(1, p, {}), ...at(rings(0.8), 0.65, 0.65)];
        if (v === 2) return [['cyl', [0.03, 1, 0.03], [0, 2.3, 0], 0, 'тёмный'], ...at(rings(1), 1.5, 0)];
        if (v === 3) return [['box', [1.4, 1.4, 0.1], [0, 1.1, 0], 0, 'светлый'], ['box', [1.0, 1.0, 0.12], [0, 1.1, 0], 0, redOf(p)], ['box', [0.5, 0.5, 0.14], [0, 1.1, 0], 0, 'светлый'], ['box', [0.1, 0.5, 0.1], [0, 0.25, 0], 0, 'ствол']];
        return [['box', [0.1, 1.2, 0.1], [0, 0.6, -0.1], 0, 'ствол'], ...at(rings(1), 1.0, 0.05)];
      } },
      'кнопка-плита': { fam: 'уровень', h: 0.25, level: 1, f(v) {
        return [['box', [1.4, 0.1, 1.4], [0, 0.05, 0], 0, 'камень'], [v ? 'box' : 'cyl', [0.9, 0.15, 0.9], [0, 0.15, 0], 0, 'акцент', { glow: 0.5, tess: 12 }]];
      } },
      'шипы': { fam: 'уровень', h: 0.8, level: 1, f(v) {
        const g = { glow: 0.35 };
        if (v === 2) return [['cyl', [1.2, 0.15, 1.2], [0, 0.07, 0], 0, 'тёмный'], ['cone', [0.9, 1.6, 0.9], [0, 0.95, 0], 0, 'огонь', { tess: 6, glow: 0.35 }]];
        if (v === 3) return [['sphere', [0.8, 0.8, 0.8], [0, 0.5, 0], 0, 'тёмный'], ...ring(6, 0.4, (x, z, i, a) => ['cone', [0.2, 0.4, 0.2], [x, 0.5, z], [0, -a, -Math.PI / 2], 'огонь', g]), ['cone', [0.2, 0.4, 0.2], [0, 1.0, 0], 0, 'огонь', g]];
        const rows = [['box', [2, 0.12, 1], [0, 0.06, 0], 0, 'тёмный']];
        if (v === 1) rows.push(...ring(7, 0.3, (x, z, i) => ['cone', [0.28, 0.5 + (i % 3) * 0.2, 0.28], [x, 0.35 + (i % 3) * 0.1, z], 0, 'огонь', g]));
        else for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) rows.push(['cone', [0.3, 0.6, 0.3], [-0.8 + i * 0.4, 0.42, -0.22 + j * 0.44], 0, 'огонь', { tess: 4, glow: 0.35 }]);
        return rows;
      } },
      'пила': { fam: 'уровень', h: 1.6, level: 1, f(v) {
        return [['cyl', [1.6, 0.08, 1.6], [0, 0.9, 0], [Math.PI / 2, 0, 0], 'металл', { tess: 16, shiny: 1 }], ...ring(12, 0.8, (x, z, i, a) => ['cone', [0.18, 0.3, 0.06], [x, 0.9 + z, 0], [0, 0, a - Math.PI / 2], 'огонь', { glow: 0.3 }]), ['cyl', [0.3, 0.12, 0.3], [0, 0.9, 0], [Math.PI / 2, 0, 0], 'тёмный'], ...(v ? [['box', [0.15, 0.9, 0.15], [0, 0.45, -0.1], 0, 'тёмный']] : [])];
      } },
      'портал-кольцо': { fam: 'уровень', h: 3, level: 1, f(v) {
        return [['torus', [2.6, 0.4, 2.6], [0, 1.6, 0], [Math.PI / 2, 0, 0], 'камень', { thick: 0.18 }], ['cyl', [2.3, 0.05, 2.3], [0, 1.6, 0], [Math.PI / 2, 0, 0], v ? 'акцент' : 'ткань', { glow: 1, alpha: 0.75, tess: 18 }], ...ring(6, 1.3, (x, z) => ['octa', [0.3, 0.3, 0.3], [x, 1.6 + z, 0.1], 0, 'свет', { glow: 1, d: 1 }])];
      } },
      'флаг финиша': { fam: 'уровень', h: 2.6, level: 1, sway: 1, f(v) {
        const rows = [['cyl', [0.1, 2.6, 0.1], [0, 1.3, 0], 0, 'металл'], ['sphere', [0.18, 0.18, 0.18], [0, 2.65, 0], 0, 'акцент', { glow: 0.5 }]];
        if (v === 3) return [['ico', [0.9, 0.6, 0.8], [0, 0.3, 0], 0, 'камень'], ['cyl', [0.05, 1.2, 0.05], [0, 1.1, 0], 0, 'металл'], ['box', [0.6, 0.4, 0.03], [0.3, 1.5, 0], 0, 'акцент']];
        if (v === 1) rows.push(['prism', [0.8, 1.2, 0.04], [0.6, 2.2, 0], [0, 0, -Math.PI / 2], 'акцент']);
        else if (v === 2) rows.push(['cyl', [0.1, 2.6, 0.1], [2.4, 1.3, 0], 0, 'металл'], ['box', [2.4, 0.7, 0.04], [1.2, 2.2, 0], 0, 'светлый'], ...line(6, 2, x => ['box', [0.2, 0.35, 0.05], [1.2 + x, 2.2, 0], 0, 'тёмный']));
        else for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) rows.push(['box', [0.3, 0.27, 0.04], [0.15 + i * 0.3, 1.95 + j * 0.27, 0], 0, (i + j) % 2 ? 'тёмный' : 'светлый']);
        return rows;
      } },

      /* ----- предметы игры ----- */
      'монета': { fam: 'предметы', h: 0.8, item: 1, f(v, p) {
        const G = { glow: 0.45 };
        if (v === 3) return line(4, 0.33, (y, i) => ['cyl', [0.7, 0.1, 0.7], [0, 0.25 + i * 0.11, (i % 2) * 0.03], 0, 'акцент', { tess: 12, glow: 0.45 }]);
        const tess = v === 2 ? 6 : 14, rows = [['cyl', [0.8, 0.12, 0.8], [0, 0.45, 0], [Math.PI / 2, 0, 0], 'акцент', { tess, glow: 0.45 }], ['torus', [0.8, 0.08, 0.8], [0, 0.45, 0], [Math.PI / 2, 0, 0], C.dark(p.акцент, 0.15), { thick: 0.1, tess }]];
        rows.push(v === 1 ? ['box', [0.2, 0.2, 0.14], [0, 0.45, 0], 0, 'тёмный'] : ['octa', [0.3, 0.3, 0.14], [0, 0.45, 0], 0, C.light(p.акцент, 0.4), G]);
        return rows;
      } },
      'звезда': { fam: 'предметы', h: 1, item: 1, f(v) {
        const n = [5, 4, 6, 5][v], rows = [['sphere', [0.42, 0.42, 0.24], [0, 0.5, 0], 0, 'свет', { glow: 0.6, seg: v === 3 ? 6 : 3 }]];
        rows.push(...ring(n, 0.32, (x, z, i, a) => [v === 3 ? 'capsule' : 'cone', [0.3, 0.5, 0.18], [Math.cos(a + Math.PI / 2) * 0.32, 0.5 + Math.sin(a + Math.PI / 2) * 0.32, 0], [0, 0, a], 'свет', { glow: 0.6, tess: 4 }]));
        return rows;
      } },
      'кристалл-награда': { fam: 'предметы', h: 1, item: 1, f(v, p) {
        const L = C.light(p.акцент, 0.3);
        if (v === 1) return ring(3, 0.18, (x, z, i) => ['octa', [0.3, 0.6, 0.3], [x, 0.4, z], [0, 0, (i - 1) * 0.3], i % 2 ? L : 'акцент', { glow: 0.7 }]);
        if (v === 3) return [['cone', [0.7, 0.3, 0.7], [0, 0.65, 0], 0, 'акцент', { tess: 8, top: 0.6, glow: 0.7 }], ['cone', [0.7, 0.55, 0.7], [0, 0.22, 0], [Math.PI, 0, 0], L, { tess: 8, glow: 0.7 }]];
        return [['octa', [0.5, 0.9, 0.5], [0, 0.5, 0], 0, 'акцент', { glow: 0.7 }], ...(v === 2 ? [['torus', [0.9, 0.05, 0.9], [0, 0.5, 0], [0.4, 0, 0], 'свет', { glow: 1, thick: 0.08 }]] : [])];
      } },
      'сердце': { fam: 'предметы', h: 0.9, item: 1, f(v, p) {
        const c = C.hue(p.огонь, -22), k = v === 3 ? 0.6 : 1, t = v === 1 ? 0.18 : 0.4;
        const one = dx => [['sphere', [0.42 * k, 0.42 * k, t * k], [dx - 0.18 * k, 0.6 * k, 0], 0, c, { glow: 0.5 }], ['sphere', [0.42 * k, 0.42 * k, t * k], [dx + 0.18 * k, 0.6 * k, 0], 0, c, { glow: 0.5 }], ['cone', [0.68 * k, 0.6 * k, t * k], [dx, 0.33 * k, 0], [Math.PI, 0, 0], c, { tess: 4, glow: 0.5 }]];
        const rows = v === 3 ? [...one(-0.3), ...one(0.3)] : one(0);
        if (v === 2) rows.push(['box', [0.5, 0.04, 0.2], [-0.45, 0.65, 0], [0, 0, 0.4], 'светлый'], ['box', [0.5, 0.04, 0.2], [0.45, 0.65, 0], [0, 0, -0.4], 'светлый']);
        return rows;
      } },
      'бомба': { fam: 'предметы', h: 0.9, item: 1, f(v, p) {
        if (v === 2) return [...line(3, 0.3, x => ['cyl', [0.14, 0.6, 0.14], [x, 0.3, 0], 0, redOf(p)]), ['box', [0.45, 0.06, 0.16], [0, 0.35, 0], 0, 'тёмный'], ['cyl', [0.02, 0.3, 0.02], [0, 0.72, 0], [0, 0, 0.3], 'тёмный'], ['sphere', [0.1, 0.1, 0.1], [0.05, 0.86, 0], 0, 'огонь', { glow: 1 }]];
        const rows = [['sphere', [0.7, 0.7, 0.7], [0, 0.35, 0], 0, 'тёмный'], ['cyl', [0.2, 0.12, 0.2], [0, 0.72, 0], 0, 'металл'], ['cyl', [0.03, 0.25, 0.03], [0.05, 0.88, 0], [0, 0, -0.4], 'дерево'], ['sphere', [0.12, 0.12, 0.12], [0.11, 1.0, 0], 0, 'огонь', { glow: 1 }], ['sphere', [0.14, 0.14, 0.05], [-0.15, 0.48, 0.3], 0, 'светлый', { d: 1 }]];
        if (v === 3) rows.push(...ring(6, 0.35, (x, z, i, a) => ['cone', [0.14, 0.25, 0.14], [x, 0.35, z], [0, -a, -Math.PI / 2], 'металл']));
        if (v === 1) rows.push(['torus', [0.72, 0.06, 0.72], [0, 0.35, 0], 0, 'огонь', { glow: 0.4 }]);
        return rows;
      } },
      'ящик-сюрприз': { fam: 'предметы', h: 1, item: 1, f(v, p) {
        if (v === 1) return [['box', [0.8, 0.8, 0.8], [0, 0.4, 0], 0, 'ткань', { noglow: 1 }], ['box', [0.82, 0.12, 0.82], [0, 0.82, 0], 0, 'ткань', { noglow: 1 }], ['box', [0.15, 0.82, 0.84], [0, 0.42, 0], 0, 'акцент'], ['box', [0.84, 0.82, 0.15], [0, 0.42, 0], 0, 'акцент'], ['torus', [0.3, 0.08, 0.3], [-0.12, 0.98, 0], [Math.PI / 2, 0.5, 0], 'акцент'], ['torus', [0.3, 0.08, 0.3], [0.12, 0.98, 0], [Math.PI / 2, -0.5, 0], 'акцент']];
        if (v === 3) return [['box', [0.9, 0.9, 0.9], [0, 0.45, 0], [0.3, 0.6, 0], 'акцент', { glow: 0.7, alpha: 0.85 }], ['octa', [0.5, 0.5, 0.5], [0, 0.45, 0], 0, 'свет', { glow: 1 }]];
        const rows = [['box', [0.9, 0.9, 0.9], [0, 0.45, 0], 0, v === 2 ? 'дерево' : 'акцент', v === 2 ? {} : { glow: 0.25 }], ...[[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]].map(([x, y]) => ['sphere', [0.08, 0.08, 0.04], [x, 0.45 + y, 0.46], 0, C.dark(p.акцент, 0.3)])];
        if (v === 2) rows.push(...PROPS['звезда'].f(0, p, {}).map(r => [r[0], arr3(r[1]).map(x => x * 0.6), [arr3(r[2])[0] * 0.6, 0.45 + (arr3(r[2])[1] - 0.5) * 0.6, 0.47]].concat(r.slice(3))));
        else rows.push(['torus', [0.32, 0.1, 0.32], [0, 0.58, 0.46], [Math.PI / 2, 0, 0], 'светлый', { thick: 0.25 }], ['box', [0.1, 0.16, 0.06], [0, 0.32, 0.47], 0, 'светлый'], ['box', [0.1, 0.1, 0.06], [0, 0.15, 0.47], 0, 'светлый']);
        return rows;
      } },
      'карта': { fam: 'предметы', h: 1, item: 1, f(v, p) {
        const suit = C.hue(p.огонь, -20);
        if (v === 2) return [['box', [0.1, 1.2, 0.1], [0, 0.6, 0], 0, 'ствол'], ['box', [1.2, 0.7, 0.08], [0, 1.4, 0], 0, 'дерево'], ['box', [1.0, 0.5, 0.02], [0, 1.4, 0.05], 0, 'светлый']];
        if (v === 3) return [['cyl', [0.02, 0.5, 0.02], [-0.4, 1.35, 0], 0, 'тёмный'], ['cyl', [0.02, 0.5, 0.02], [0.4, 1.35, 0], 0, 'тёмный'], ['box', [1.1, 0.6, 0.06], [0, 0.85, 0], 0, 'дерево'], ['box', [0.9, 0.4, 0.02], [0, 0.85, 0.04], 0, 'светлый']];
        const card = [['box', [0.6, 0.86, 0.03], [0, 0.45, 0], 0, 'светлый'], ['box', [0.5, 0.76, 0.032], [0, 0.45, 0], 0, C.light(p.акцент, 0.6)], ['octa', [0.22, 0.3, 0.05], [0, 0.45, 0], 0, suit], ['octa', [0.08, 0.12, 0.05], [-0.2, 0.78, 0], 0, suit], ['octa', [0.08, 0.12, 0.05], [0.2, 0.12, 0], 0, suit]];
        if (v === 1) return card.map(r => r.slice(0, 2).concat([[r[2][0], 0.02, 0.45 - r[2][1]], [Math.PI / 2, 0, 0]]).concat(r.slice(4)));
        return card;
      } },
      'ключ': { fam: 'предметы', h: 0.9, item: 1, f(v) {
        return [['torus', [0.45, 0.1, 0.45], [0, 0.7, 0], [Math.PI / 2, 0, 0], 'акцент', { glow: 0.4 }], ['box', [0.1, 0.6, 0.06], [0, 0.25, 0], 0, 'акцент', { glow: 0.4 }], ['box', [0.2, 0.08, 0.06], [0.1, 0.05, 0], 0, 'акцент'], ['box', [0.16, 0.08, 0.06], [0.08, 0.18, 0], 0, 'акцент', { d: v ? 0 : 1 }]];
      } },
      'фишка': { fam: 'предметы', h: 0.6, item: 1, f(v) {
        return v ? [['cyl', [0.5, 0.2, 0.5], [0, 0.1, 0], 0, 'ткань'], ['cone', [0.3, 0.35, 0.3], [0, 0.35, 0], 0, 'ткань'], ['sphere', [0.22, 0.22, 0.22], [0, 0.55, 0], 0, 'ткань']] : [['cyl', [0.6, 0.15, 0.6], [0, 0.08, 0], 0, 'акцент', { tess: 14 }], ['torus', [0.45, 0.05, 0.45], [0, 0.16, 0], 0, 'светлый']];
      } },
      'кубик': { fam: 'предметы', h: 0.6, item: 1, f(v, p) {
        const pip = (x, y, z) => ['sphere', [0.1, 0.1, 0.03], [x, y, z], 0, v ? 'светлый' : 'тёмный'];
        return [['rbox', [0.6, 0.6, 0.6], [0, 0.3, 0], 0, v ? redOf(p) : 'светлый', { keep: 1 }], pip(0, 0.3, 0.3), pip(-0.15, 0.45, 0.3), pip(0.15, 0.15, 0.3), pip(0.3, 0.3, 0), pip(0, 0.6, 0)];
      } },
    };
    function R2(x) { return x * 0.25; }
    // синонимы: модель может назвать вид иначе
    const ALIAS = { 'дерево лиственное': 'лиственное', 'дуб': 'лиственное', 'дерево': 'лиственное', 'трава': 'трава-пучок', 'цветы': 'цветы-поляна', 'камень': 'валун', 'камни': 'галька', 'скала': 'скала-утёс', 'утёс': 'скала-утёс', 'вода': 'вода с рябью', 'пруд': 'вода с рябью', 'озеро': 'вода с рябью', 'река': 'река-лента', 'дом': 'дом с черепицей', 'сакля': 'хата', 'забор': 'штакетник', 'стог': 'стог сена', 'сено': 'стог сена', 'фонарный столб': 'фонарь', 'гирлянда': 'флажки', 'каменная башня': 'башня', 'дорожный конус': 'конус', 'неоновая вывеска': 'вывеска', 'полка': 'книжная полка', 'книги': 'стопка книг', 'купол': 'купол станции', 'ёлка': 'новогодняя ёлка', 'кольцо': 'ворота-кольцо', 'флаг': 'флаг финиша', 'сюрприз': 'ящик-сюрприз', 'табличка': 'карта', 'горы': 'гора', 'сталактиты': 'сталактит', 'сталагмиты': 'сталагмит', 'сыр': 'головки сыра', 'плита-кнопка': 'кнопка-плита', 'кнопка': 'кнопка-плита', 'плитка': 'платформа', 'дерево сухое': 'сухое дерево', 'пень': 'сухое дерево', 'кристаллы': 'кристалл', 'пузыри': null };
    const KIND_NAMES = Object.keys(PROPS);
    function kindOf(name) {
      const n = String(name || '').trim().toLowerCase().replace(/ё/g, 'ё');
      if (PROPS[n]) return n;
      if (ALIAS[n]) return ALIAS[n];
      return KIND_NAMES.find(k => k.startsWith(n) || n.startsWith(k)) || null;
    }
    // сколько силуэтов у вида: сравниваем строки вариантов, разные — значит отдельный силуэт
    const VARIANTS = {};
    function variantsOf(name) {
      if (VARIANTS[name]) return VARIANTS[name];
      const pal = derivePalette({}, MOODS['день'].pal), seen = new Set();
      let n = 0;
      for (let v = 0; v < 4; v++) {
        let s; try { s = JSON.stringify(PROPS[name].f(v, pal, { d: 2, wr: 0, sn: 0, nt: 0, r: mulberry32(1) })); } catch (e) { break; }
        if (!s || s === '[]' || seen.has(s)) break;
        seen.add(s); n = v + 1;
      }
      return (VARIANTS[name] = Math.max(1, n));
    }
    lab.prop = function (kind, opts = {}) {
      need();
      if (kind && kind.copy && kind.mesh) return kind; // уже исходник lab.build
      const name = kindOf(kind);
      if (!name) { warn('kind:' + kind, `Нет вида «${kind}» в библиотеке. Построй свой через lab.build — так даже лучше: деталь будет только в этой игре.`); return lab.build(String(kind), [['ico', [1, 1, 1], [0, 0.5, 0], 0, 'камень']]); }
      const D = PROPS[name], S = style();
      const nv = variantsOf(name), v = clamp(Math.round(opts.v == null ? 0 : opts.v), 0, nv - 1);
      if (opts.v != null && opts.v >= nv) warn('v:' + name, `У вида «${name}» вариантов ${nv} (v от 0 до ${nv - 1}).`);
      const key = [name, v, S.shape, S.mood, S.detail, S.wear, S.snow ? 1 : 0, JSON.stringify(opts.colors || {}), opts.glow || 0, opts.seed || 0].join('|');
      let src = K.srcs[key];
      if (!src) {
        const seed = (opts.seed != null ? opts.seed : hashStr(name + v)) >>> 0, r = mulberry32(seed);
        const o = { d: S.detail, wr: S.wear, sn: S.snow, nt: S.lit > 0.4, r };
        const pal = Object.assign({}, S.pal); for (const k in opts.colors || {}) if (hexOk(opts.colors[k])) pal[k] = opts.colors[k].slice(0, 7);
        let rows = D.f(v, pal, o);
        if (opts.glow) rows = rows.map(rw => { const oo = Object.assign({}, rw[5] || {}); if (oo.glow) oo.glow = Math.min(1, oo.glow * (1 + opts.glow)); return rw.slice(0, 5).concat([oo]); });
        const exact = D.level || D.item;
        const ctx = ctxOf({ key: name, seed, colors: opts.colors, leanAll: S.wear > 0 && !exact, shape: exact && !['круглый', 'угловатый', 'острый'].includes(S.shape) ? 'обычный' : undefined, warp: exact ? false : undefined });
        const mesh = assemble('набор:' + name, rows, ctx);
        if (D.flat) mesh.metadata.flat = true;
        src = K.srcs[key] = Source(mesh, { kind: name, noShadow: !!D.far || !!D.flat, sway: !!D.sway });
        src.fam = D.fam; src.level = !!D.level; src.item = !!D.item; src.far = !!D.far;
      }
      // размер: h — высота, w — ширина; задано одно — масштаб равный по всем осям
      let ky = 1, kx = 1;
      if (opts.h) ky = kx = opts.h / Math.max(0.01, src.h);
      if (opts.w) { kx = opts.w / Math.max(0.01, src.r * 2); if (!opts.h) ky = kx; }
      const out = Object.assign(Object.create(src), { k: [kx, ky, kx], lean: (opts.lean || 0) + (S.wear >= 2 && !D.level && !D.item ? 0.06 : 0) });
      if (opts.sway != null) out.sway = !!opts.sway;
      return out;
    };
    lab.kinds = () => KIND_NAMES.map(k => ({ name: k, fam: PROPS[k].fam, variants: variantsOf(k), level: !!PROPS[k].level, item: !!PROPS[k].item }));


    /* =====================================================================
       Земля, край поля, дальний фон, россыпь, движение без игрока
       ===================================================================== */
    // прямой сборщик вершин: тысячи плиток пола одним мешем без промежуточных мешей
    function Geo() {
      const P = [], N = [], CC = [], I = [];
      const push = (verts, n, col) => { const i = P.length / 3; for (const v of verts) { P.push(v[0], v[1], v[2]); N.push(n[0], n[1], n[2]); CC.push(col[0], col[1], col[2], 1); } for (let k = 1; k < verts.length - 1; k++) I.push(i, i + k, i + k + 1); };
      const rgb = (hex, j) => { const c = toRgb(hex); return [c[0] * j, c[1] * j, c[2] * j]; };
      return {
        // коробка: низ на y, без нижней грани; j — множитель яркости (разнобой плиток)
        box(x, y, z, w, h, d, hex, j = 1, rot = 0) {
          const c = rgb(hex, j), s = rgb(hex, j * 0.86), ca = Math.cos(rot), sa = Math.sin(rot);
          const at = (dx, yy, dz) => [x + dx * ca - dz * sa, yy, z + dx * sa + dz * ca];
          const nr = (nx, nz) => [nx * ca - nz * sa, 0, nx * sa + nz * ca];
          const a = w / 2, b = d / 2, y1 = y + h;
          push([at(-a, y1, -b), at(-a, y1, b), at(a, y1, b), at(a, y1, -b)], [0, 1, 0], c);
          if (h > 0.001) {
            push([at(-a, y, -b), at(-a, y1, -b), at(a, y1, -b), at(a, y, -b)], nr(0, -1), s);
            push([at(a, y, b), at(a, y1, b), at(-a, y1, b), at(-a, y, b)], nr(0, 1), s);
            push([at(-a, y, b), at(-a, y1, b), at(-a, y1, -b), at(-a, y, -b)], nr(-1, 0), s);
            push([at(a, y, -b), at(a, y1, -b), at(a, y1, b), at(a, y, b)], nr(1, 0), s);
          }
        },
        // плоский многоугольник (диск, пятно) на высоте y
        disc(x, y, z, rx, rz, seg, hex, j = 1, wob = 0, rnd) {
          const c = rgb(hex, j), v = [];
          for (let i = 0; i < seg; i++) { const a = i / seg * TAU, k = 1 + (wob && rnd ? (rnd() - 0.5) * wob : 0); v.push([x + Math.cos(a) * rx * k, y, z + Math.sin(a) * rz * k]); }
          push(v.reverse(), [0, 1, 0], c);
        },
        count: () => P.length / 3,
        mesh(name) {
          const m = new B.Mesh(name, K.scene), vd = new B.VertexData();
          vd.positions = P; vd.indices = I; vd.normals = N; vd.colors = CC; vd.applyToMesh(m);
          m.material = vcMat('two'); m.isPickable = false;
          m.metadata = { kit: true, noShadow: true }; if (lab.noShadow) lab.noShadow(m);
          m.receiveShadows = true;
          return m;
        },
      };
    }
    // гладкий шум для пятен: значения в узлах сетки по зерну, между узлами — плавно
    function noise2(seed) {
      const h = (i, j) => (Math.imul(i * 374761393 + j * 668265263 ^ seed, 1274126177) >>> 0) / 4294967296;
      const s = t => t * t * (3 - 2 * t);
      return (x, z) => { const i = Math.floor(x), j = Math.floor(z), fx = s(x - i), fz = s(z - j); return lerp(lerp(h(i, j), h(i + 1, j), fx), lerp(h(i, j + 1), h(i + 1, j + 1), fx), fz); };
    }
    function fieldRect() {
      const f = field(), side = camType() === 'side';
      return side ? { x0: -f.w / 2, x1: f.w / 2, z0: -1.5, z1: 1.5, w: f.w, h: 3, side } : { x0: -f.w / 2, x1: f.w / 2, z0: -f.h / 2, z1: f.h / 2, w: f.w, h: f.h, side };
    }
    // горизонт: большой круг земли под всем, чтобы дальний фон не висел над пустотой
    function horizon(hex) {
      if (K.horizon) return K.horizon;
      const S = style(), g = Geo(), sky = K.sky || S.M.sky;
      const zc = fieldRect().side ? 428 : 0; // сбоку — только за полем: внизу у игры может быть река или пропасть
      g.disc(0, -0.06, zc, 420, 420, 28, C.mix(hex || C.dark(S.pal.земля, 0.12), sky, 0.18));
      const m = g.mesh('набор:горизонт'); m.receiveShadows = false;
      if (fieldRect().side) K.backs.push({ mesh: m, par: 1 }); // сбоку камера уезжает далеко: горизонт едет с ней
      return (K.horizon = m);
    }

    /* ---------------- пол ---------------- */
    const FLOORS = ['плитки', 'полосы', 'пятна', 'доски', 'брусчатка', 'газон с тропой', 'песок с рябью', 'снег с настом', 'лёд с трещинами', 'металл с панелями', 'клетка', 'дно с песком', 'реголит'];
    lab.floor = function (o = {}) {
      need();
      const S = style(), p = Object.assign({}, S.pal);
      for (const k in o.colors || {}) if (hexOk(o.colors[k])) p[k] = o.colors[k].slice(0, 7);
      let type = o.type || 'плитки';
      if (!FLOORS.includes(type)) { warn('floor:' + type, `Нет пола «${type}». Есть: ${FLOORS.join(', ')}`); type = 'плитки'; }
      const R = fieldRect(), f = field(), w = o.w || f.w, h = o.h || (R.side ? 8 : f.h), cx = o.x || 0, cz = o.z || (R.side ? 2 : 0);
      const rnd = mulberry32(seedOf(301 + FLOORS.indexOf(type))), nz = noise2(seedOf(302)), g = Geo();
      const jit = () => 1 + (rnd() - 0.5) * (0.07 + S.wear * 0.04);
      const sh = S.shape, bumpy = sh === 'кривой' ? 0.05 : 0, gap = sh === 'угловатый' ? 0.1 : sh === 'круглый' ? 0.03 : 0.06;
      const x0 = cx - w / 2, z0 = cz - h / 2, T = -0.12;
      const cells = (step, fn) => { const nx = Math.max(1, Math.round(w / step)), nzc = Math.max(1, Math.round(h / step)), sx = w / nx, sz = h / nzc; for (let i = 0; i < nx; i++) for (let j = 0; j < nzc; j++) fn(x0 + sx * (i + 0.5), z0 + sz * (j + 0.5), sx, sz, i, j); };
      const base = (hex) => g.box(cx, T, cz, w, -T - 0.004, h, hex, 1);
      const a = p.земля, b = p.земля2;
      switch (type) {
        case 'плитки': {
          const t = sh === 'вытянутый' ? 1.4 : sh === 'приземистый' ? 2.2 : 1.6;
          base(C.dark(a, 0.3));
          cells(t, (x, z, sx, sz, i, j) => g.box(x, T, z, sx - gap, -T + (rnd() - 0.5) * bumpy + (S.wear ? (rnd() - 0.5) * 0.02 : 0), sz - gap, (i + j) % 3 === 0 ? b : a, jit(), sh === 'острый' ? 0 : sh === 'кривой' ? (rnd() - 0.5) * 0.12 : 0));
          break;
        }
        case 'полосы': cells(2, (x, z, sx, sz, i, j) => g.box(x, T, z, sx, -T, sz, (j % 2 ? b : a), jit())); break;
        case 'пятна': base(a); cells(1, (x, z, sx, sz) => { const n = nz(x * 0.22, z * 0.22); if (n > 0.55) g.box(x, T, z, sx * 1.02, -T + 0.008, sz * 1.02, n > 0.72 ? p.мох : b, jit()); }); break;
        case 'доски': {
          const pw = 0.55; base(C.dark(p.дерево, 0.45));
          for (let z = z0 + pw / 2; z < z0 + h; z += pw) { let x = x0; while (x < x0 + w - 0.1) { const l = Math.min(x0 + w - x, 2 + rnd() * 3); g.box(x + l / 2, T, z, l - 0.04, -T + (rnd() - 0.5) * bumpy, pw - 0.05, p.дерево, jit() * (rnd() < 0.15 ? 0.85 : 1)); x += l; } }
          break;
        }
        case 'брусчатка': {
          base(p.тёмный); const t = 0.55;
          for (let j = 0; j * t < h; j++) for (let x = x0 + (j % 2 ? t / 2 : 0); x < x0 + w; x += t) g.box(Math.min(x + t / 2, x0 + w - t / 2), T, z0 + j * t + t / 2, t - 0.07, -T + rnd() * 0.03 + bumpy * rnd(), t - 0.07, rnd() < 0.3 ? C.light(p.камень, 0.08) : p.камень, jit(), sh === 'кривой' ? rnd() * 0.3 : 0);
          break;
        }
        case 'газон с тропой': {
          const grass = C.mix(a, p.листва, 0.35), path = p.песок;
          const pz = x => cz + Math.sin((x - x0) / w * Math.PI * 1.6 + rnd() * 0) * h * 0.18;
          cells(1, (x, z, sx, sz) => { const d = Math.abs(z - pz(x)); g.box(x, T, z, sx * 1.01, -T + (d < 1.1 ? -0.015 : 0), sz * 1.01, d < 1.1 ? path : (nz(x * 0.3, z * 0.3) > 0.6 ? C.light(grass, 0.08) : grass), jit()); });
          break;
        }
        case 'песок с рябью': {
          base(p.песок);
          for (let z = z0 + 0.6; z < z0 + h; z += 1.2) for (let x = x0; x < x0 + w; x += 2) g.box(x + 1, -0.006, z + Math.sin(x * 0.4) * 0.2, 2.02, 0.03, 0.18, C.light(p.песок, 0.12), 1, Math.sin(x * 0.4) * 0.12);
          break;
        }
        case 'снег с настом': base(p.снег); cells(1.5, (x, z, sx, sz) => { const n = nz(x * 0.3, z * 0.3); if (n > 0.5) g.box(x, -0.01, z, sx * 0.9, 0.02 + n * 0.05, sz * 0.9, n > 0.7 ? C.mix(p.снег, p.вода, 0.12) : C.light(p.снег, 0.3), 1, rnd()); }); break;
        case 'лёд с трещинами': {
          base(p.лёд);
          for (let i = 0; i < Math.round(w * h / 18); i++) { let x = x0 + rnd() * w, z = z0 + rnd() * h, ang = rnd() * TAU; for (let k = 0; k < 4; k++) { const l = 0.6 + rnd(); g.box(x, -0.004, z, l, 0.008, 0.05, C.dark(p.лёд, 0.3), 1, ang); x += Math.cos(ang) * l * 0.5; z += Math.sin(ang) * l * 0.5; ang += (rnd() - 0.5) * 1.2; } }
          break;
        }
        case 'металл с панелями': {
          base(C.dark(p.металл, 0.5));
          cells(2, (x, z, sx, sz, i, j) => { g.box(x, T, z, sx - 0.08, -T, sz - 0.08, (i + j) % 2 ? p.металл : C.dark(p.металл, 0.08), jit()); for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.box(x + dx * (sx / 2 - 0.2), 0, z + dz * (sz / 2 - 0.2), 0.08, 0.02, 0.08, C.light(p.металл, 0.2)); });
          g.box(cx, 0, z0 + 0.2, w, 0.015, 0.25, p.акцент); g.box(cx, 0, z0 + h - 0.2, w, 0.015, 0.25, p.акцент);
          break;
        }
        case 'клетка': cells(2, (x, z, sx, sz, i, j) => g.box(x, T, z, sx, -T, sz, (i + j) % 2 ? a : C.light(b, 0.35), jit())); break;
        case 'дно с песком': base(p.песок); cells(1, (x, z, sx, sz) => { const n = nz(x * 0.25, z * 0.25); if (n > 0.6) g.box(x, -0.004, z, sx, 0.012, sz, C.mix(p.песок, p.листва, 0.3), jit()); }); for (let z = z0 + 1; z < z0 + h; z += 1.6) g.box(cx, 0, z, w, 0.02, 0.12, C.light(p.песок, 0.15)); break;
        case 'реголит': {
          base(p.камень);
          cells(1, (x, z, sx, sz) => { const n = nz(x * 0.35, z * 0.35); if (n > 0.55) g.box(x, -0.003, z, sx, 0.01, sz, C.dark(p.камень, 0.1 + (n - 0.55)), 1); });
          for (let i = 0; i < Math.round(w * h / 40); i++) { const x = x0 + 1 + rnd() * (w - 2), z = z0 + 1 + rnd() * (h - 2), r = 0.4 + rnd() * 1.2; g.disc(x, 0.012, z, r, r, 10, C.dark(p.камень, 0.3)); g.disc(x, 0.008, z, r * 1.3, r * 1.3, 10, C.light(p.камень, 0.12)); }
          break;
        }
      }
      const m = g.mesh('набор:пол');
      if (o.outer !== false) {
        const og = Geo(), ring = C.dark(type === 'снег с настом' ? p.снег : type === 'песок с рябью' || type === 'дно с песком' ? p.песок : C.mix(p.земля, p.земля2, 0.5), 0.1);
        og.box(cx, -0.13, cz, w + 160, 0.11, h + 160, ring);
        const om = og.mesh('набор:земля вокруг'); om.receiveShadows = true;
        horizon(C.dark(ring, 0.06));
      }
      return m;
    };

    /* ---------------- край поля ---------------- */
    const EDGES = ['забор', 'плетень', 'камни', 'обрыв в туман', 'вода', 'перила', 'неон', 'стена', 'кусты', 'ледяной край'];
    lab.edge = function (o = {}) {
      need();
      let type = o.type || 'забор';
      if (!EDGES.includes(type)) { warn('edge:' + type, `Нет края «${type}». Есть: ${EDGES.join(', ')}`); type = 'забор'; }
      const S = style(), R = fieldRect(), m = o.margin ?? 0.9, rnd = mulberry32(seedOf(401 + EDGES.indexOf(type)));
      const x0 = R.x0 - m, x1 = R.x1 + m, z0 = R.z0 - m, z1 = R.z1 + m + (R.side ? 1.5 : 0);
      // стороны: дальняя (+Z), левая, правая, ближняя (−Z). Ближняя ниже — не загораживает поле
      const sides = o.sides || (R.side ? ['дальняя'] : ['дальняя', 'левая', 'правая', 'ближняя']);
      const segs = [];
      if (sides.includes('дальняя')) segs.push([x0, z1, x1, z1, 1]);
      if (sides.includes('ближняя')) segs.push([x0, z0, x1, z0, 0.45]);
      if (sides.includes('левая')) segs.push([x0, z0, x0, z1, 0.8]);
      if (sides.includes('правая')) segs.push([x1, z0, x1, z1, 0.8]);
      const out = [];
      const along = (src, step, f) => { for (const [ax, az, bx, bz, k] of segs) { const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / step)), rot = Math.atan2(-(bz - az), bx - ax); for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; out.push(f(src, ax + (bx - ax) * t, az + (bz - az) * t, rot, k, len / n)); } } };
      const lowNear = k => (o.h ? o.h : 1) * (k < 0.5 ? 0.5 : 1);
      switch (type) {
        case 'забор': case 'плетень': case 'перила': {
          const src = type === 'перила' ? lab.build('перила', [['box', [3, 0.1, 0.1], [0, 1.0, 0], 0, 'металл'], ['box', [3, 0.06, 0.06], [0, 0.5, 0], 0, 'металл'], ['cyl', [0.1, 1.05, 0.1], [-1.45, 0.52, 0], 0, 'металл'], ['cyl', [0.12, 0.08, 0.12], [-1.45, 1.06, 0], 0, 'акцент', { d: 1 }]], { warp: false }) : lab.prop(type === 'забор' ? 'штакетник' : 'плетень', { v: o.v || 0 });
          along(src, 3, (s, x, z, rot, k, l) => s.copy([x, 0, z], rot, [l / 3, lowNear(k), 1]));
          break;
        }
        case 'камни': along(lab.prop('валун', { v: 1 }), 1.6, (s, x, z, rot, k) => { const sc = (0.5 + rnd() * 0.6) * (k < 0.5 ? 0.6 : 1); return s.copy([x + (rnd() - 0.5) * 0.5, 0, z + (rnd() - 0.5) * 0.5], rnd() * TAU, sc); }); break;
        case 'кусты': along(lab.prop('куст', { v: o.v || 0 }), 1.5, (s, x, z, rot, k) => s.copy([x, 0, z], rnd() * TAU, (0.8 + rnd() * 0.4) * (k < 0.5 ? 0.6 : 1))); break;
        case 'ледяной край': along(lab.prop('торос', { v: 1 }), 1.8, (s, x, z, rot, k) => s.copy([x, 0, z], rnd() * TAU, (0.6 + rnd() * 0.5) * (k < 0.5 ? 0.6 : 1))); break;
        case 'стена': {
          const src = lab.build('стена края', [['box', [2, 2, 0.4], [0, 1, 0], 0, 'стена'], ['box', [2.02, 0.25, 0.44], [0, 0.12, 0], 0, 'дерево'], ['box', [2.04, 0.12, 0.5], [0, 2.02, 0], 0, 'камень', { d: 1 }]], { warp: false });
          along(src, 2, (s, x, z, rot, k, l) => s.copy([x, 0, z], rot, [l / 2, k < 0.5 ? 0.3 : lowNear(k) * 1.2, 1]));
          break;
        }
        case 'неон': {
          const src = lab.build('неон края', [['box', [2, 0.12, 0.12], [0, 0.35, 0], 0, 'акцент', { glow: 1, keep: 1 }], ['box', [0.12, 0.35, 0.12], [-0.94, 0.17, 0], 0, 'тёмный', { keep: 1 }]], { warp: false });
          along(src, 2, (s, x, z, rot, k, l) => s.copy([x, 0, z], rot, [l / 2, 1, 1]));
          break;
        }
        case 'вода': {
          const g = Geo(), W = S.pal.вода, F = C.light(S.pal.вода, 0.45);
          const band = 7, gx0 = x0 - band, gx1 = x1 + band, gz0 = z0 - band, gz1 = z1 + band;
          const water = [[gx0, gz0, gx1, z0], [gx0, z1, gx1, gz1], [gx0, z0, x0, z1], [x1, z0, gx1, z1]];
          for (const [a, b, c, d] of water) g.box((a + c) / 2, -0.35, (b + d) / 2, c - a, 0.3, d - b, W, 1);
          for (const [ax, az, bx, bz] of segs) { const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / 0.8); for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; g.box(ax + (bx - ax) * t, -0.04, az + (bz - az) * t, 0.5 + rnd() * 0.4, 0.05, 0.3 + rnd() * 0.3, F, 1, rnd()); } }
          const wm = g.mesh('набор:вода края'); wm.material = vcMat('shiny2'); out.push(wm);
          break;
        }
        case 'обрыв в туман': {
          const g = Geo(), rock = S.pal.камень, top = C.mix(S.pal.земля, S.pal.земля2, 0.5);
          for (const [ax, az, bx, bz] of segs) {
            const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / 1.2), rot = Math.atan2(-(bz - az), bx - ax), nx = Math.sign((ax + bx) / 2) || 0, nzz = Math.sign((az + bz) / 2) || 0;
            for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, x = ax + (bx - ax) * t + nx * 0.6, z = az + (bz - az) * t + nzz * 0.6, d = 6 + rnd() * 6; g.box(x, -d, z, len / n + 0.3, d - 0.02 + (rnd() - 0.5) * 0.1, 1.2 + rnd() * 0.6, rnd() < 0.5 ? rock : C.dark(rock, 0.12), 1, rot); g.box(x, -0.04, z, len / n + 0.3, 0.06, 1.3, top, 1, rot); }
          }
          const cm = g.mesh('набор:обрыв'); out.push(cm);
          const fog = Geo(), sky = K.sky || S.M.sky; fog.box(0, -14, 0, 500, 0.1, 500, C.mix(sky, '#ffffff', 0.12));
          const fm = fog.mesh('набор:туман внизу'); fm.material = fxMat(C.mix(sky, '#ffffff', 0.12), 0, 1, true); out.push(fm);
          K.cliff = true;
          if (K.horizon) K.horizon.setEnabled(false);
          break;
        }
      }
      return out;
    };

    /* ---------------- дальний фон ---------------- */
    const BACKS = ['горы', 'скалы ущелья', 'холмы', 'лес', 'город', 'дюны', 'льды', 'кораллы', 'облака снизу', 'стены комнаты', 'звёзды и планеты'];
    function backPiece(type, L, rnd, p, S) {
      // одна деталь фона в своих координатах (центр снизу); L — номер слоя (0 — ближний)
      const k = 1 + L * 0.55;
      switch (type) {
        case 'горы': { const h = (14 + rnd() * 16) * k, d = h * (0.9 + rnd() * 0.5); return [['cone', [d, h, d * 0.8], [0, h / 2, 0], rnd() * 3, 'камень', { tess: 5 + Math.floor(rnd() * 3) }], ...(h > 18 || S.snow ? [['cone', [d * 0.36, h * 0.28, d * 0.3], [0, h * 0.86, 0], 0, 'снег', { tess: 5 }]] : []), ['cone', [d * 0.6, h * 0.55, d * 0.5], [d * 0.28, h * 0.27, 1], 1, 'камень2', { tess: 5 }]]; }
        case 'скалы ущелья': { const h = (10 + rnd() * 12) * k; return [['box', [3 + rnd() * 4, h, 4], [0, h / 2, 0], (rnd() - 0.5) * 0.4, 'камень', { taper: 0.75 }], ['box', [2.5 + rnd() * 2, h * 0.7, 3], [2.5, h * 0.35, 1], 0.3, 'камень2'], ['box', [2, 0.4, 2], [0, h, 0], 0, 'листва', { d: 1 }]]; }
        case 'холмы': { const r = (10 + rnd() * 10) * k; return [['sphere', [r * 2, r * (0.5 + rnd() * 0.3), r * 1.6], [0, 0, 0], 0, rnd() < 0.5 ? 'земля2' : 'листва', { seg: 6 }], ...(rnd() < 0.5 ? [['cone', [2, 4, 2], [r * 0.3, r * 0.4 + 1.5, 0], 0, 'листва2']] : [])]; }
        case 'лес': { const rows = []; for (let i = 0; i < 6; i++) { const x = (i - 2.5) * 2.4 + (rnd() - 0.5), h = (5 + rnd() * 4) * (1 + L * 0.3); if (rnd() < 0.6) rows.push(['cone', [h * 0.45, h, h * 0.45], [x, h / 2 + 0.5, (rnd() - 0.5) * 3], 0, i % 2 ? 'листва' : 'листва2', { tess: 6 }]); else rows.push(['sphere', [h * 0.6, h * 0.6, h * 0.6], [x, h * 0.55, (rnd() - 0.5) * 3], 0, 'листва', { seg: 4 }], ['cyl', [0.4, h * 0.3, 0.4], [x, h * 0.15, 0], 0, 'ствол']); } return rows; }
        case 'город': { const rows = []; for (let i = 0; i < 3; i++) { const bw = 4 + rnd() * 5, bh = (6 + rnd() * 18) * k, x = (i - 1) * 6 + (rnd() - 0.5) * 2; rows.push(['box', [bw, bh, 5], [x, bh / 2, 0], 0, rnd() < 0.5 ? 'стена' : 'стена2']); const cols = Math.max(1, Math.floor(bw / 1.6)), fl = Math.floor(bh / 2.6); for (let c = 0; c < cols; c++) rows.push(['box', [0.6, bh * 0.85, 0.05], [x - bw / 2 + (c + 0.5) * bw / cols, bh * 0.47, -2.52], 0, S.lit > 0.4 && rnd() < 0.7 ? 'окно' : 'стекло', { keep: 1, d: fl > 1 ? 0 : 1 }]); if (rnd() < 0.3) rows.push(['cyl', [0.15, 4, 0.15], [x, bh + 2, 0], 0, 'металл'], ['sphere', [0.4, 0.4, 0.4], [x, bh + 4, 0], 0, 'огонь', { glow: 1 }]); } return rows; }
        case 'дюны': { const r = (10 + rnd() * 8) * k; return [['sphere', [r * 2.2, r * 0.6, r], [0, 0, 0], rnd() * 0.5, 'песок', { seg: 5 }], ['sphere', [r * 1.2, r * 0.4, r * 0.6], [r * 0.7, 0, r * 0.3], 0.3, 'песок2', { seg: 5 }]]; }
        case 'льды': { const h = (4 + rnd() * 10) * k; return [['cone', [h, h, h * 0.8], [0, h / 2, 0], rnd() * 3, 'лёд', { tess: 4 + Math.floor(rnd() * 3), shiny: 1 }], ['box', [h * 0.9, h * 0.4, h * 0.7], [h * 0.5, h * 0.2, 1], 0.4, 'снег']]; }
        case 'кораллы': { const h = (4 + rnd() * 8) * k, rows = [['cyl', [h * 0.35, h, h * 0.35], [0, h / 2, 0], 0, rnd() < 0.5 ? 'ткань' : 'акцент', { top: 0.5, noglow: 1 }], ['sphere', [h * 0.6, h * 0.5, h * 0.6], [h * 0.4, h * 0.2, 1], 0, 'ткань2', { noglow: 1 }]]; for (let i = 0; i < 3; i++) rows.push(['capsule', [0.4, h * 0.8, 0.2], [(i - 1) * h * 0.4, h * 0.4, -1], (rnd() - 0.5) * 0.3, 'листва']); return rows; }
        case 'облака снизу': { const r = (6 + rnd() * 6) * k; return [['sphere', [r * 2, r * 0.6, r * 1.4], [0, -6 - L * 2, 0], 0, 'облако', { seg: 5 }], ['sphere', [r * 1.2, r * 0.6, r], [r * 0.8, -5.5 - L * 2, r * 0.3], 0, 'облако', { seg: 5 }]]; }
        case 'звёзды и планеты': { const r = (8 + rnd() * 14) * k; return rnd() < 0.5 ? [['sphere', [r, r, r], [0, r * 0.6 + 15, 0], 0, rnd() < 0.5 ? 'ткань' : 'камень', { seg: 8, noglow: 1 }], ...(rnd() < 0.5 ? [['torus', [r * 1.7, r * 0.05, r * 1.7], [0, r * 0.6 + 15, 0], [0.4, 0, 0.2], 'акцент', { thick: 0.04, tess: 20 }]] : [])] : [['sphere', [r * 0.3, r * 0.3, r * 0.3], [0, 25 + rnd() * 20, 0], 0, 'свет', { glow: 1, unlit: true }]]; }
      }
      return [];
    }
    lab.backdrop = function (o = {}) {
      need();
      let type = o.type || 'горы';
      if (!BACKS.includes(type)) { warn('back:' + type, `Нет фона «${type}». Есть: ${BACKS.join(', ')}`); type = 'горы'; }
      const S = style(), R = fieldRect(), sky = K.sky || S.M.sky, layers = clamp(Math.round(o.layers || 2), 1, 3);
      const rnd = mulberry32(seedOf(501 + BACKS.indexOf(type)));
      if (type === 'звёзды и планеты') addStars(2);
      if (type === 'стены комнаты') {
        const pad = 2.5, W = R.w + pad * 2, D = R.h + pad * 2, H = o.h || 6, rows = [];
        rows.push(['box', [W, H, 0.4], [0, H / 2, D / 2], 0, 'стена'], ['box', [0.4, H, D], [-W / 2, H / 2, 0], 0, 'стена2'], ['box', [0.4, H, D], [W / 2, H / 2, 0], 0, 'стена2']);
        rows.push(['box', [W, 0.35, 0.5], [0, 0.17, D / 2 - 0.05], 0, 'дерево'], ['box', [0.5, 0.35, D], [-W / 2 + 0.05, 0.17, 0], 0, 'дерево'], ['box', [0.5, 0.35, D], [W / 2 - 0.05, 0.17, 0], 0, 'дерево']);
        for (let i = 0; i < 2; i++) { const x = (i ? 1 : -1) * W * 0.25; rows.push(['box', [2.4, 2.2, 0.1], [x, H * 0.55, D / 2 - 0.22], 0, 'окно'], ['box', [2.7, 0.15, 0.3], [x, H * 0.55 - 1.15, D / 2 - 0.3], 0, 'дерево'], ['box', [0.08, 2.2, 0.12], [x, H * 0.55, D / 2 - 0.28], 0, 'дерево']); }
        rows.push(['box', [1.4, 2.6, 0.1], [-W / 2 + 0.22, 1.3, D * 0.15], [0, Math.PI / 2, 0], 'дерево'], ['box', [1.6, 1.1, 0.08], [W / 2 - 0.24, H * 0.55, -D * 0.1], [0, Math.PI / 2, 0], 'акцент'], ['box', [1.3, 0.85, 0.09], [W / 2 - 0.26, H * 0.55, -D * 0.1], [0, Math.PI / 2, 0], 'ткань', { d: 1 }]);
        const pal = { стена2: C.dark(S.pal.стена, 0.08) };
        for (const k in o.colors || {}) if (hexOk(o.colors[k])) pal[k] = o.colors[k];
        const m = assemble('набор:стены', rows, ctxOf({ warp: false, colors: pal }));
        lab.noShadow ? lab.noShadow(m) : 0; m.receiveShadows = true;
        K.backs.push({ mesh: m, par: 0 });
        return [m];
      }
      const out = [], cam = lab.camera, side = R.side;
      let center = Math.PI / 2; // направление «за полем»: от камеры через цель, по умолчанию +Z
      if (cam && cam.alpha != null && !side) center = Math.atan2(-Math.sin(cam.alpha), -Math.cos(cam.alpha));
      const full = camType() === 'behind' || camType() === 'diorama';
      for (let L = 0; L < layers; L++) {
        const fade = 0.12 + L * 0.22, pal = {};
        for (const r of ['камень', 'снег', 'земля2', 'листва', 'ствол', 'стена', 'стекло', 'песок', 'лёд', 'ткань', 'акцент', 'огонь', 'металл', 'свет']) pal[r] = C.mix(S.pal[r] || S.pal.камень, sky, fade);
        pal.камень2 = C.dark(pal.камень, 0.1); pal.листва2 = C.dark(pal.листва, 0.12); pal.стена2 = C.dark(pal.стена, 0.1); pal.песок2 = C.light(pal.песок, 0.1); pal.ткань2 = C.hue(pal.ткань, 25);
        pal.облако = C.mix('#ffffff', sky, 0.15 + fade * 0.3);
        for (const k in o.colors || {}) if (hexOk(o.colors[k])) pal[k] = C.mix(o.colors[k], sky, fade);
        const rows = [];
        const spacing = { 'горы': 14, 'скалы ущелья': 5, 'холмы': 16, 'лес': 13, 'город': 17, 'дюны': 18, 'льды': 10, 'кораллы': 8, 'облака снизу': 14, 'звёзды и планеты': 40 }[type] * (1 + L * 0.4);
        const hk = side && type !== 'облака снизу' && type !== 'звёзды и планеты' ? 0.6 : 1; // сбоку камера смотрит почти горизонтально: ниже фон — больше неба
        const place = (x, z, ang) => { for (const r0 of backPiece(type, L, rnd, pal, S)) { const r = hk === 1 ? r0 : [r0[0], arr3(r0[1]).map((v, i) => i === 1 ? v * hk : v), arr3(r0[2]).map((v, i) => i === 1 ? v * hk : v), ...r0.slice(3)]; const q = arr3(r[2]), ca = Math.cos(ang), sa = Math.sin(ang); const rr = Array.isArray(r[3]) ? r[3].slice() : [0, r[3] || 0, 0]; rr[1] = (rr[1] || 0) - ang; rows.push([r[0], r[1], [x + q[0] * ca - q[2] * sa, q[1], z + q[0] * sa + q[2] * ca], rr, r[4], r[5]]); } };
        if (side) {
          const span = R.w * 2 + 120, z0 = { 'горы': 34, 'скалы ущелья': 14, 'холмы': 24, 'лес': 16, 'город': 22, 'дюны': 26, 'льды': 20, 'кораллы': 14, 'облака снизу': 18, 'звёзды и планеты': 50 }[type], z = z0 * (1 + L * 0.6); // сбоку: дальше на размер детали, чтобы гора не наезжала на улицу
          for (let x = -span / 2; x < span / 2 - spacing * 0.5; x += spacing * (0.7 + rnd() * 0.6)) place(x, z + (rnd() - 0.5) * 4, 0);
          rows.span = span;
        } else {
          const Rr = Math.max(R.w, R.h) * 0.75 + 14 + L * 16 + (type === 'скалы ущелья' ? -6 : 0);
          const arc = full ? TAU : Math.PI * 1.25, n = Math.max(5, Math.round(arc * Rr / spacing));
          for (let i = 0; i < n; i++) {
            const a = center - arc / 2 + arc * (i + 0.5) / n + (rnd() - 0.5) * 0.08, r = Rr + (rnd() - 0.5) * 6;
            // ущелье — две стены по бокам поля, а не дуга
            if (type === 'скалы ущелья' && !full) { const sideX = i % 2 ? 1 : -1; place(sideX * (R.w / 2 + 6 + L * 6 + rnd() * 2), R.z0 - 10 + (R.h + 30) * (i / n), Math.PI / 2); continue; }
            place(Math.cos(a) * r, Math.sin(a) * r, a - Math.PI / 2);
          }
        }
        const m = assemble('набор:фон ' + (L + 1), rows, ctxOf({ warp: false, colors: pal, shape: o.shape, key: type + L, seed: seedOf(510 + L) }));
        lab.noShadow ? lab.noShadow(m) : 0; m.receiveShadows = false;
        if (side) for (const d of [-1, 1]) { const c = m.createInstance(m.name); c.parent = m; c.position.x = d * rows.span; lab.noShadow ? lab.noShadow(c) : 0; }
        out.push(m); K.backs.push({ mesh: m, par: side ? 0.25 + L * 0.25 : 0, wrap: side ? rows.span : 0 });
      }
      if (type !== 'облака снизу' && !K.cliff) horizon();
      return out;
    };

    /* ---------------- россыпь: копии группами по зерну ---------------- */
    function areaOf(area, R) {
      const side = R.side, mg = 1.2;
      if (area && typeof area === 'object' && area.ring) return { ring: area.ring };
      if (Array.isArray(area)) return { x0: Math.min(area[0], area[2]), x1: Math.max(area[0], area[2]), z0: Math.min(area[1], area[3]), z1: Math.max(area[1], area[3]), inside: true }; // [x0, z0, x1, z1]
      if (area && typeof area === 'object') return { x0: (area.x || 0) - (area.w || 4) / 2, x1: (area.x || 0) + (area.w || 4) / 2, z0: (area.z || 0) - (area.h || 4) / 2, z1: (area.z || 0) + (area.h || 4) / 2, inside: true };
      const bw = Math.max(6, Math.max(R.w, R.h) * 0.45);
      if (side) {
        if (area === 'фон') return { x0: R.x0 - 20, x1: R.x1 + 20, z0: 9, z1: 26 };
        if (area === 'край') return { x0: R.x0 - 4, x1: R.x1 + 4, z0: 2, z1: 5 };
        return { x0: R.x0 - 10, x1: R.x1 + 10, z0: 2.5, z1: 10 };
      }
      if (area === 'край') return { x0: R.x0 - 3.5, x1: R.x1 + 3.5, z0: R.z0 - 2.5, z1: R.z1 + 3.5, hole: [R.x0 - mg + 0.6, R.x1 + mg - 0.6, R.z0 - mg + 0.6, R.z1 + mg - 0.6] };
      if (area === 'фон') return { x0: R.x0 - bw * 1.4, x1: R.x1 + bw * 1.4, z0: R.z1 + 6, z1: R.z1 + 6 + bw * 1.6 };
      return { x0: R.x0 - bw, x1: R.x1 + bw, z0: R.z0 - bw * 0.45, z1: R.z1 + bw };
    }
    lab.scatter = function (what, o = {}) {
      need();
      const R = fieldRect(), A = areaOf(o.area || 'вокруг', R), seed = o.seed != null ? o.seed >>> 0 : seedOf(600 + (K.n++)), rnd = mulberry32(seed);
      const list = (Array.isArray(what) && Array.isArray(what[0])) ? what : [[what, 1]];
      const srcs = list.map(([k, wgt]) => ({ src: typeof k === 'string' ? lab.prop(k, { v: o.v }) : k.copy ? k : lab.prop(k), w: wgt == null ? 1 : wgt }));
      const total = srcs.reduce((s, x) => s + x.w, 0), pick = () => { let r = rnd() * total; for (const s of srcs) { if ((r -= s.w) <= 0) return s.src; } return srcs[0].src; };
      const n = clamp(Math.round(o.n || 20), 1, 600);
      const sc = Array.isArray(o.scale) ? o.scale : o.scale != null ? [o.scale, o.scale] : [0.8, 1.25];
      const avoid = (Array.isArray(o.avoid) ? o.avoid : []).map(a => Array.isArray(a) && a.length === 3 ? { x: a[0], z: a[1], r: a[2] } : (a && a.r != null && a.x != null) ? a : Object.assign(posOf(a), { r: 2 })); // [x, z, r], меш или точка
      const keepField = o.avoid !== false && o.inField !== true && !A.inside;
      const ct = camType(), near = (x, z) => !R.side && ct !== 'behind' && (z < R.z0 - 0.8 || (ct === 'diorama' && x < R.x0 - 0.8));
      const nc = Math.max(1, Math.round(n / 7)), centers = [];
      const inArea = (x, z) => {
        if (A.ring) { const d = Math.hypot(x, z); return d >= A.ring[0] && d <= A.ring[1]; }
        if (x < A.x0 || x > A.x1 || z < A.z0 || z > A.z1) return false;
        if (A.hole && x > A.hole[0] && x < A.hole[1] && z > A.hole[2] && z < A.hole[3]) return false;
        return true;
      };
      const randPt = () => { if (A.ring) { const a = rnd() * TAU, r = A.ring[0] + rnd() * (A.ring[1] - A.ring[0]); return [Math.cos(a) * r, Math.sin(a) * r]; } return [A.x0 + rnd() * (A.x1 - A.x0), A.z0 + rnd() * (A.z1 - A.z0)]; };
      for (let i = 0; i < nc; i++) centers.push(randPt());
      const cl = o.cluster == null ? 0.5 : clamp(o.cluster, 0, 1), pts = [];
      for (let tries = 0; pts.length < n && tries < n * 40; tries++) {
        let x, z;
        if (rnd() < cl) { const c = centers[Math.floor(rnd() * nc)], a = rnd() * TAU, r = Math.sqrt(rnd()) * (2 + Math.sqrt(n) * 0.8); x = c[0] + Math.cos(a) * r; z = c[1] + Math.sin(a) * r; } else [x, z] = randPt();
        if (!inArea(x, z)) continue;
        if (keepField && x > R.x0 - 0.8 && x < R.x1 + 0.8 && z > R.z0 - 0.8 && z < R.z1 + 0.8) continue;
        if (avoid.some(a => Math.hypot(x - a.x, z - a.z) < a.r)) continue;
        if (o.avoid !== false && K.occupied.some(a => Math.hypot(x - a.x, z - a.z) < a.r)) continue;
        const src = pick(), s = lerp(sc[0], sc[1], rnd()), r = (src.r || 0.5) * s * (src.k ? src.k[0] : 1) * 0.75;
        // между камерой и полем — только низкое: высокое закрыло бы игру
        if (near(x, z) && !o.near && (src.h || 1) * s * (src.k ? src.k[1] : 1) > 0.7) continue;
        if (pts.some(q => Math.hypot(q.x - x, q.z - z) < r + q.r)) continue;
        pts.push({ x, z, s, r, src, rot: o.rot != null ? o.rot : rnd() * TAU });
      }
      if (pts.length < n * 0.6) warn('scatter:' + n, `lab.scatter: поместилось ${pts.length} из ${n}. Уменьши n или расширь area.`);
      // по исходнику — один меш с тонкими копиями
      const meshes = [], byMesh = new Map();
      for (const q of pts) { const key = q.src; if (!byMesh.has(key)) byMesh.set(key, []); byMesh.get(key).push(q); }
      for (const [src, qs] of byMesh) {
        const host = src.mesh.clone((src.kind || 'россыпь') + ':россыпь');
        host.isVisible = true; host.isPickable = false;
        const big = (src.h * (src.k ? src.k[1] : 1) * sc[1]) >= 1.5 && o.area !== 'фон' && !src.far && !src.flat;
        host.metadata = Object.assign({}, src.mesh.metadata, { noShadow: !big || o.shadow === false });
        if (lab.noShadow && host.metadata.noShadow) lab.noShadow(host);
        host.receiveShadows = true;
        const M = new Float32Array(qs.length * 16), COL = new Float32Array(qs.length * 4), mat = new B.Matrix(), k = src.k || [1, 1, 1];
        qs.forEach((q, i) => {
          const qq = B.Quaternion.FromEulerAngles(0, q.rot, src.lean || 0);
          B.Matrix.ComposeToRef(new B.Vector3(q.s * k[0], q.s * k[1], q.s * k[2]), qq, new B.Vector3(q.x, o.y || 0, q.z), mat);
          mat.copyToArray(M, i * 16);
          const t = 1 + (rnd() - 0.5) * 0.12; COL.set([t, t, t * (1 + (rnd() - 0.5) * 0.04), 1], i * 4);
        });
        host.thinInstanceSetBuffer('matrix', M, 16, !(src.sway && style().wind > 0));
        host.thinInstanceSetBuffer('color', COL, 4, true);
        host.alwaysSelectAsActiveMesh = false; host.thinInstanceRefreshBoundingInfo(false);
        if (!(src.sway && style().wind > 0) && host.freezeWorldMatrix) host.freezeWorldMatrix();
        if (src.sway && (style().wind > 0 || style().under) && qs.length <= 200) K.sways.push({ thin: host, qs: qs.map(q => ({ x: q.x, y: o.y || 0, z: q.z, s: q.s, rot: q.rot, ph: q.x * 1.7 + q.z * 0.9, k: 1 / Math.max(0.6, Math.sqrt(src.h * q.s)) })), kk: k, lean: src.lean || 0, M });
        meshes.push(host);
      }
      return { meshes, points: pts.map(q => new B.Vector3(q.x, o.y || 0, q.z)) };
    };
    function tickThinSway(s, t, w) {
      const mat = tickThinSway.m || (tickThinSway.m = new B.Matrix()), q = new B.Quaternion(), v = new B.Vector3(), sc = new B.Vector3();
      s.qs.forEach((p, i) => {
        const a = (Math.sin(t * 1.6 + p.ph) * 0.06 + Math.sin(t * 3.7 + p.ph * 2) * 0.015) * w * p.k;
        B.Quaternion.FromEulerAnglesToRef(a * 0.5, p.rot, s.lean + a, q); v.set(p.x, p.y, p.z); sc.set(p.s * s.kk[0], p.s * s.kk[1], p.s * s.kk[2]);
        B.Matrix.ComposeToRef(sc, q, v, mat); mat.copyToArray(s.M, i * 16);
      });
      s.thin.thinInstanceBufferUpdated('matrix');
    }

    /* ---------------- движение без игрока ---------------- */
    const AMBIENTS = ['облака', 'птицы', 'бабочки', 'пчёлы', 'светлячки', 'снег', 'листья', 'пыль', 'искры', 'дым из трубы', 'пузыри', 'рыбы стайкой', 'звёзды мерцают', 'туман ползёт', 'флаги на ветру'];
    lab.ambient = function (kind, o = {}) {
      need();
      if (!AMBIENTS.includes(kind)) { warn('amb:' + kind, `Нет движения «${kind}». Есть: ${AMBIENTS.join(', ')}`); return null; }
      const S = style(), p = S.pal, R = fieldRect(), rnd = mulberry32(seedOf(700 + AMBIENTS.indexOf(kind))), ctx = ctxOf({ warp: false, colors: o.colors, key: kind, shape: kind === 'облака' || kind === 'пузыри' || kind === 'дым из трубы' ? 'обычный' : undefined }); // облака и дым круглые при любом языке формы
      const W = R.w + 16, Dp = (R.side ? 20 : R.h + 16), cz = R.side ? 6 : 0;
      const def = {
        'облака': [8, [['sphere', [3, 1.4, 2], [0, 0, 0], 0, 'облако', { glow: 0.25 }], ['sphere', [2, 1.2, 1.6], [1.4, 0.2, 0.2], 0, 'облако', { glow: 0.25 }], ['sphere', [1.8, 1.0, 1.4], [-1.3, -0.1, 0], 0, 'облако', { glow: 0.25 }]]],
        'птицы': [7, [['box', [0.7, 0.05, 0.2], [-0.33, 0.1, 0], [0, 0, 0.35], 'тёмный', { keep: 1 }], ['box', [0.7, 0.05, 0.2], [0.33, 0.1, 0], [0, 0, -0.35], 'тёмный', { keep: 1 }], ['sphere', [0.18, 0.14, 0.4], [0, 0, 0], 0, 'тёмный', { keep: 1 }]]],
        'бабочки': [10, [['box', [0.22, 0.02, 0.18], [-0.12, 0, 0], [0, 0, 0.3], 'ткань', { keep: 1, noglow: 1 }], ['box', [0.22, 0.02, 0.18], [0.12, 0, 0], [0, 0, -0.3], 'акцент', { keep: 1, noglow: 1 }]]],
        'пчёлы': [8, [['sphere', [0.14, 0.12, 0.2], [0, 0, 0], 0, 'акцент', { keep: 1, noglow: 1 }], ['box', [0.15, 0.13, 0.04], [0, 0, 0], 0, 'тёмный', { keep: 1 }], ['box', [0.18, 0.01, 0.1], [0, 0.08, 0], 0, 'светлый', { keep: 1, alpha: 0.7 }]]],
        'светлячки': [30, [['sphere', [0.12, 0.12, 0.12], [0, 0, 0], 0, 'свет', { glow: 1, unlit: true, keep: 1 }]]],
        'снег': [180, [['octa', [0.12, 0.12, 0.12], [0, 0, 0], 0, 'снег', { unlit: true, keep: 1 }]]],
        'листья': [40, [['box', [0.22, 0.02, 0.14], [0, 0, 0], 0, 'листва', { keep: 1 }]]],
        'пыль': [60, [['octa', [0.06, 0.06, 0.06], [0, 0, 0], 0, 'светлый', { unlit: true, alpha: 0.6, keep: 1 }]]],
        'искры': [40, [['octa', [0.08, 0.12, 0.08], [0, 0, 0], 0, 'огонь', { glow: 1, unlit: true, keep: 1 }]]],
        'дым из трубы': [14, [['sphere', [1, 1, 1], [0, 0, 0], 0, 'дым', { alpha: 0.55, seg: 3 }]]],
        'пузыри': [40, [['sphere', [0.18, 0.18, 0.18], [0, 0, 0], 0, 'лёд', { alpha: 0.5, glow: 0.2, keep: 1, seg: 3 }]]],
        'рыбы стайкой': [14, [['sphere', [0.18, 0.2, 0.5], [0, 0, 0], 0, 'ткань', { keep: 1, noglow: 1 }], ['cone', [0.04, 0.24, 0.22], [0, 0, -0.32], [Math.PI / 2, 0, 0], 'акцент', { keep: 1, tess: 3, noglow: 1 }]]],
        'звёзды мерцают': [50, [['octa', [0.5, 0.5, 0.5], [0, 0, 0], 0, 'свет', { glow: 1, unlit: true, keep: 1 }]]],
        'туман ползёт': [10, [['disc', [6, 0, 4], [0, 0, 0], 0, 'туман', { alpha: 0.22, unlit: true, tess: 10 }]]],
        'флаги на ветру': [4, [['cyl', [0.08, 3, 0.08], [0, 1.5, 0], 0, 'металл'], ['box', [1.0, 0.6, 0.03], [0.52, 2.65, 0], 0, 'ткань', { noglow: 1 }]]],
      }[kind];
      const extra = { облако: C.mix('#ffffff', K.sky || S.M.sky, S.lit > 0.6 ? 0.55 : 0.08), дым: C.mix(p.светлый, p.камень, 0.3), туман: C.mix(K.sky || S.M.sky, '#ffffff', 0.4) };
      for (const k in o.colors || {}) if (hexOk(o.colors[k])) extra[k] = o.colors[k];
      ctx.color = colorer(extra);
      const host = assemble('набор:' + kind, def[1], ctx);
      host.isVisible = true; host.alwaysSelectAsActiveMesh = true;
      lab.noShadow ? lab.noShadow(host) : 0;
      const n = clamp(Math.round(o.n || def[0]), 1, 400);
      const at = o.at ? (Array.isArray(o.at) && Array.isArray(o.at[0]) ? o.at : [o.at]).map(posOf) : null;
      const A = o.area ? areaOf(o.area, R) : null;
      const pt = () => { if (A && !A.ring) return [lerp(A.x0, A.x1, rnd()), lerp(A.z0, A.z1, rnd())]; return [(rnd() - 0.5) * W, cz + (rnd() - 0.5) * Dp]; };
      const P = Array.from({ length: n }, (_, i) => { const [x, z] = pt(); return { x, z, y: 0, ph: rnd() * TAU, sp: 0.6 + rnd() * 0.8, s: 0.7 + rnd() * 0.6, i, c: at ? at[i % at.length] : null }; });
      const M = new Float32Array(n * 16);
      host.thinInstanceSetBuffer('matrix', M, 16, false);
      const a = { kind, host, P, M, rnd, W, Dp, cz, side: R.side, t: 0, speed: o.speed || 1, size: o.size || 1 };
      a.mat = new B.Matrix(); a.q = new B.Quaternion(); a.v = new B.Vector3(); a.sv = new B.Vector3();
      tickAmbient(a, 0);
      K.ambients.push(a);
      return { mesh: host, stop() { host.dispose(); } };
    };
    function tickAmbient(a, dt) {
      if (a.host.isDisposed()) return false;
      const S = K.style || {}, wind = (S.wind || 0.25), t = (a.t += dt * a.speed), d = dt * a.speed, cam = lab.camera, ct = cam && cam.target ? cam.target : { x: 0, z: 0 };
      const put = (i, x, y, z, s, ry, rx = 0, rz = 0, sy) => { a.sv.set(s, sy == null ? s : sy, s); B.Quaternion.FromEulerAnglesToRef(rx, ry, rz, a.q); a.v.set(x, y, z); B.Matrix.ComposeToRef(a.sv, a.q, a.v, a.mat); a.mat.copyToArray(a.M, i * 16); };
      const wrap = (v, c, span) => ((v - c + span / 2) % span + span) % span + c - span / 2;
      const k = a.size;
      for (const p of a.P) {
        switch (a.kind) {
          case 'облака': p.x += d * (0.6 + wind * 1.5) * p.sp; if (a.side) put(p.i, wrap(p.x, ct.x || 0, a.W * 3), Math.max(14, (ct.y || 0) + 9) + (p.i % 3) * 3, 26 + (p.z - a.cz + a.Dp / 2) * 1.2, p.s * 2.2 * k, p.ph * 0.2); else put(p.i, wrap(p.x, ct.x || 0, a.W * 2.2), 14 + (p.i % 3) * 3, p.z * 1.4 + 6, p.s * 2.2 * k, p.ph * 0.2); break; // сбоку — всегда за полем и над камерой
          case 'птицы': { const r = 10 + (p.i % 3) * 4, ang = t * 0.25 * p.sp + p.ph; put(p.i, Math.cos(ang) * r + (p.i % 2) * 2, 10 + (p.i % 3) * 1.5 + Math.sin(t + p.ph) * 0.5, a.cz + Math.sin(ang) * r * 0.6 + 6, k * 1.2, -ang, 0, 0, k * (0.4 + Math.abs(Math.sin(t * 7 + p.ph)) * 0.9)); break; }
          case 'бабочки': { const x = p.x + Math.sin(t * 0.7 * p.sp + p.ph) * 1.5, z = p.z + Math.cos(t * 0.5 + p.ph) * 1.5; put(p.i, x, 0.8 + Math.abs(Math.sin(t * 2 + p.ph)) * 0.9, z, k * (0.6 + Math.abs(Math.sin(t * 14 + p.ph)) * 0.6), t * 0.7 + p.ph, 0, 0, k); break; }
          case 'пчёлы': { const c = p.c || { x: p.x, y: 1, z: p.z }; put(p.i, c.x + Math.sin(t * 3.1 * p.sp + p.ph) * 0.8, (c.y || 1) + Math.sin(t * 5.3 + p.ph) * 0.4 + 0.3, c.z + Math.cos(t * 2.7 * p.sp + p.ph) * 0.8, k, t * 3 + p.ph); break; }
          case 'светлячки': put(p.i, p.x + Math.sin(t * 0.4 + p.ph) * 1.2, 0.6 + Math.sin(t * 0.7 + p.ph * 2) * 0.5 + p.s, p.z + Math.cos(t * 0.3 + p.ph) * 1.2, k * Math.max(0.05, Math.sin(t * 1.3 * p.sp + p.ph)), 0); break;
          case 'снег': { p.y -= d * (1.2 + p.sp); if (p.y < 0) p.y += 16; put(p.i, p.x + Math.sin(t + p.ph) * 0.4 + wind * p.y * 0.3, p.y, p.z, k * p.s, t + p.ph); break; }
          case 'листья': { p.y -= d * (0.7 + p.sp * 0.4); if (p.y < 0) p.y += 12; put(p.i, p.x + Math.sin(t * 0.9 + p.ph) * 1.2 + wind * (12 - p.y) * 0.4, p.y, p.z, k * p.s, t * 2 + p.ph, Math.sin(t * 3 + p.ph), Math.cos(t * 2.3 + p.ph)); break; }
          case 'пыль': put(p.i, wrap(p.x + t * wind * p.sp, ct.x || 0, a.W), 0.3 + Math.sin(t * 0.6 + p.ph) * 0.25 + p.s * 0.5, p.z + Math.sin(t * 0.4 + p.ph) * 0.6, k * p.s, t + p.ph); break;
          case 'искры': { const c = p.c || { x: p.x, y: 0, z: p.z }; p.y += d * (1.5 + p.sp); if (p.y > 3) p.y = 0; put(p.i, c.x + Math.sin(p.ph + p.y * 2) * 0.3, (c.y || 0) + p.y, c.z + Math.cos(p.ph + p.y * 1.7) * 0.3, k * Math.max(0.02, 1 - p.y / 3), t * 4); break; }
          case 'дым из трубы': { const c = p.c || { x: 0, y: 4, z: 6 }; const life = ((t * 0.35 * p.sp + p.i / a.P.length) % 1); put(p.i, c.x + life * wind * 3 + Math.sin(p.ph + life * 4) * 0.2, (c.y || 0) + life * 4, c.z, k * (0.25 + life * 1.1), p.ph); break; }
          case 'пузыри': { p.y += d * (0.8 + p.sp * 0.6); if (p.y > 12) p.y = 0; put(p.i, p.x + Math.sin(t * 2 + p.ph) * 0.15, p.y, p.z, k * p.s * (0.6 + p.y / 20), 0); break; }
          case 'рыбы стайкой': { const r = 7, ang = t * 0.35 + (p.i % 7) * 0.12, off = Math.floor(p.i / 7); put(p.i, Math.cos(ang) * (r + off * 2) + Math.sin(p.ph) * 0.8, 2 + off * 1.5 + Math.sin(t + p.ph) * 0.3, a.cz + Math.sin(ang) * (r + off * 2) * 0.7 + Math.cos(p.ph) * 0.8 + 6, k, -ang, 0, Math.sin(t * 8 + p.ph) * 0.2); break; }
          case 'звёзды мерцают': { if (!p.sx) { const aa = a.rnd() * TAU, e = 0.2 + a.rnd() * 1.1; p.sx = Math.cos(aa) * Math.cos(e) * 120; p.sy = Math.sin(e) * 90 + 10; p.sz = Math.sin(aa) * Math.cos(e) * 120 + 40; } put(p.i, p.sx, p.sy, p.sz, k * (0.6 + Math.max(0, Math.sin(t * 2 * p.sp + p.ph)) * 1.4), t * 0.3); break; }
          case 'туман ползёт': put(p.i, wrap(p.x + t * 0.4 * p.sp, ct.x || 0, a.W), 0.25 + p.s * 0.2, p.z, k * p.s * 1.4, p.ph); break;
          case 'флаги на ветру': { if (p.ox == null) { const R = fieldRect(); const sideI = p.i % 4; p.ox = sideI < 2 ? (sideI ? R.x1 + 1.5 : R.x0 - 1.5) : lerp(R.x0, R.x1, (p.i + 1) / (a.P.length + 1)); p.oz = sideI < 2 ? lerp(R.z0, R.z1, 0.5 + (p.i % 3 - 1) * 0.3) : R.z1 + 1.5; } put(p.i, p.c ? p.c.x : p.ox, 0, p.c ? p.c.z : p.oz, k, Math.sin(t * 3 * (0.5 + wind) + p.ph) * 0.35 * (0.3 + wind) - 0.3); break; }
        }
      }
      a.host.thinInstanceBufferUpdated('matrix');
      return true;
    }


    /* =====================================================================
       Существа: схема тела + параметры → живой персонаж. Перёд — +Z, ноги на y = 0
       ===================================================================== */
    const PLANS = ['двуногий', 'четвероногий', 'птица', 'насекомое', 'водный', 'ползун', 'комок', 'предмет с лицом', 'на колёсах', 'летучий', 'робот', 'растение', 'дух', 'каменный'];
    const BODY = { 'худой': 0.75, 'обычный': 1, 'толстый': 1.35 }, LEGS = { 'короткие': 0.6, 'обычные': 1, 'длинные': 1.45 };
    const J = n => !lab.juicy || lab.juicy(n);
    function crPalette(spec, S) {
      const c = spec.colors || {};
      if (!hexOk(c.main)) warn('cr-colors', 'lab.creature без colors.main: существо серое. Задай colors: { main, second, belly, accent }.');
      const main = hexOk(c.main) ? c.main.slice(0, 7) : '#9a9aa2', h = k => hexOk(c[k]) ? c[k].slice(0, 7) : null;
      const p = { main, second: h('second') || C.dark(main, 0.22), belly: h('belly') || C.light(main, 0.42), accent: h('accent') || (hexOk(c.main) ? C.light(C.sat(C.hue(main, 150), 1.3), 0.1) : '#b8b8c0'), eye: h('eye') || '#1b1b24', detail: h('detail') || C.dark(main, 0.55) };
      if (spec.role === 'враг' && !h('accent')) p.accent = C.mix(S.pal.огонь, '#ff3030', 0.4);
      Object.assign(p, { white: '#f8f8f2', pupil: p.eye, blik: '#ffffff', щёки: C.mix(p.belly, '#ff7a8a', 0.55), зубы: '#fbf6e8', рот: C.dark(main, 0.72), тень: '#000000' });
      return p;
    }
    const num = (v, map, d) => typeof v === 'number' ? v : (map && map[v]) || d;
    // строки частей «рога:изогнутые» → { рога: 'изогнутые' }
    function partsOf(list) { if (list && typeof list === 'object' && !Array.isArray(list)) return Object.assign({}, list); const o = {}; for (const s of [].concat(list || [])) { const [k, v] = String(s).split(':'); o[k.trim()] = (v || '').trim() || true; } return o; }
    // язык формы меняет и пропорции: круглый — большая голова и короткие ноги, острый — тонкий и длинноногий
    const SHAPE_K = { 'круглый': [1.2, 1.15, 0.75], 'угловатый': [0.92, 1.12, 0.85], 'острый': [0.88, 0.86, 1.3] };
    function layout(plan, spec, rnd, shape) {
      const SK = SHAPE_K[shape] || [1, 1, 1];
      const b = spec.build || {}, bw = num(b.body, BODY, 1) * SK[1] * (1 + ((rnd() - 0.5) * 2) * (spec.vary || 0)), ll = num(b.legs, LEGS, 1) * SK[2], nk = b.neck == null ? 0.3 : b.neck, Ln = b.length || 1;
      const L = { torso: [], head: null, limbs: [], hover: 0, gait: plan, eyesOn: 'head', a: {} };
      const hd0 = b.head;
      const leg = (x, y, z, len, w, side, ph, col = 'second', foot = true) => L.limbs.push({ kind: 'leg', at: [x, y, z], side, ph, len, rows: [['capsule', [w, len + w * 0.3, w], [0, -len / 2, 0], 0, col], ...(foot ? [['box', [w * 1.35, w * 0.55, w * 1.9], [0, -len + w * 0.27, w * 0.35], 0, 'detail']] : [])] });
      const arm = (x, y, z, len, w, side) => L.limbs.push({ kind: 'arm', at: [x, y, z], side, ph: 0, len, rows: [['capsule', [w, len, w], [0, -len / 2, 0], 0, 'main'], ['sphere', [w * 1.35, w * 1.35, w * 1.35], [0, -len, 0], 0, 'belly']] });
      switch (plan) {
        case 'двуногий': {
          const lg = 0.3 * ll, tw = 0.44 * bw, th = 0.4, hd = hd0 || 0.42;
          L.torso.push(['capsule', [tw, th + 0.08, tw * 0.8], [0, lg + th / 2, 0], 0, 'main'], ['sphere', [tw * 0.72, th * 0.7, tw * 0.3], [0, lg + th * 0.45, tw * 0.3], 0, 'belly']);
          L.head = { at: [0, lg + th + 0.04 + nk * 0.12 + hd * 0.42, 0.02], d: hd };
          leg(-tw * 0.26, lg + 0.02, 0, lg, 0.13, -1, 0); leg(tw * 0.26, lg + 0.02, 0, lg, 0.13, 1, Math.PI);
          arm(-(tw / 2 + 0.04), lg + th * 0.9, 0, 0.3, 0.09, -1); arm(tw / 2 + 0.04, lg + th * 0.9, 0, 0.3, 0.09, 1);
          Object.assign(L.a, { back: [0, lg + th * 0.6, -tw * 0.4], chest: [0, lg + th * 0.65, tw * 0.4], waist: [0, lg + 0.06, 0], tail: [0, lg + 0.05, -tw * 0.38], feet: [0, 0, 0], w: tw, d: tw * 0.8, top: lg + th });
          break;
        }
        case 'четвероногий': {
          const lg = 0.32 * ll, tl = 0.8 * Ln, th = 0.36 * bw, hd = hd0 || 0.36;
          L.torso.push(['capsule', [th, tl, th], [0, lg + th / 2, 0], [Math.PI / 2, 0, 0], 'main'], ['sphere', [th * 0.7, th * 0.4, tl * 0.6], [0, lg + th * 0.18, 0], 0, 'belly']);
          L.head = { at: [0, lg + th + nk * 0.28 + hd * 0.1, tl / 2 + hd * 0.25], d: hd, snout: true };
          if (nk > 0.15) L.torso.push(['capsule', [th * 0.5, nk * 0.5 + 0.1, th * 0.5], [0, lg + th * 0.8 + nk * 0.12, tl / 2 - 0.02], [-0.6, 0, 0], 'main']);
          for (const [x, z, ph] of [[-1, 1, 0], [1, 1, Math.PI], [-1, -1, Math.PI], [1, -1, 0]]) leg(x * th * 0.32, lg + 0.04, z * tl * 0.34, lg, 0.12, x, ph);
          Object.assign(L.a, { back: [0, lg + th, -tl * 0.1], chest: [0, lg + th * 0.6, tl * 0.48], waist: [0, lg + th * 0.5, 0], tail: [0, lg + th * 0.75, -tl / 2], feet: [0, 0, 0], w: th, d: tl, top: lg + th });
          break;
        }
        case 'птица': {
          const lg = 0.22 * ll, bh = 0.5 * bw, hd = hd0 || 0.34;
          L.torso.push(['sphere', [0.5 * bw, bh, 0.55 * bw], [0, lg + bh / 2, 0], 0, 'main'], ['sphere', [0.36 * bw, bh * 0.66, 0.3 * bw], [0, lg + bh * 0.42, 0.13 * bw], 0, 'belly']);
          L.head = { at: [0, lg + bh + hd * 0.25 + nk * 0.1, 0.08], d: hd, mouth: 'клюв' };
          leg(-0.09, lg + 0.04, 0, lg, 0.06, -1, 0, 'accent'); leg(0.09, lg + 0.04, 0, lg, 0.06, 1, Math.PI, 'accent');
          L.wings = 'перья';
          Object.assign(L.a, { back: [0, lg + bh * 0.75, -0.2 * bw], chest: [0, lg + bh * 0.6, 0.25 * bw], waist: [0, lg + bh * 0.3, 0], tail: [0, lg + bh * 0.35, -0.26 * bw], feet: [0, 0, 0], w: 0.5 * bw, d: 0.55 * bw, top: lg + bh, wingY: lg + bh * 0.62, wingX: 0.25 * bw });
          if (!L.tail) L.tail = 'перья';
          break;
        }
        case 'насекомое': {
          const lg = 0.18 * ll, s = 0.3 * bw, hd = hd0 || 0.3;
          L.torso.push(['sphere', [s, s * 0.9, s], [0, lg + s * 0.5, 0], 0, 'second'], ['sphere', [s * 1.3, s * 1.1, s * 1.7 * Ln], [0, lg + s * 0.6, -s * 1.35 * Ln], 0, 'main'], ...[0, 1, 2].map(i => ['torus', [s * (1.1 - i * 0.2), s * 0.12, s * (1.1 - i * 0.2)], [0, lg + s * 0.6, -s * (0.9 + i * 0.45) * Ln], [Math.PI / 2, 0, 0], 'detail', { d: 1 }]));
          L.head = { at: [0, lg + s * 0.6, s * 0.75], d: hd };
          for (const z of [-0.1, 0.05, 0.18]) for (const side of [-1, 1]) L.limbs.push({ kind: 'leg', at: [side * s * 0.4, lg + s * 0.3, z], side, ph: (z * 20 + side) * 1.3, len: lg, rows: [['cyl', [0.03, lg * 0.7, 0.03], [side * lg * 0.3, -lg * 0.2, 0], [0, 0, side * 1.1], 'detail'], ['cyl', [0.03, lg * 0.8, 0.03], [side * lg * 0.6, -lg * 0.62, 0], [0, 0, side * 0.2], 'detail']] });
          L.antennae = true;
          Object.assign(L.a, { back: [0, lg + s, -s * 0.4], chest: [0, lg + s * 0.5, s * 0.5], waist: [0, lg + s * 0.5, 0], tail: [0, lg + s * 0.6, -s * 2.4 * Ln], feet: [0, 0, 0], w: s * 1.3, d: s * 3 * Ln, top: lg + s * 1.2, wingY: lg + s * 1.0, wingX: s * 0.3 });
          break;
        }
        case 'водный': {
          const s = 0.5 * bw, l = 0.9 * Ln, hd = hd0 || 0.4;
          L.torso.push(['sphere', [s, s * 1.1, l], [0, 0.5, 0], 0, 'main'], ['sphere', [s * 0.7, s * 0.5, l * 0.7], [0, 0.38, 0.05], 0, 'belly'], ['prism', [0.03, s * 0.5, l * 0.4], [0, 0.5 + s * 0.6, -0.05], 0, 'accent']);
          L.head = { at: [0, 0.52, l * 0.3], d: hd, inside: true };
          L.hover = 0.35; L.tail = L.tail || 'рыбий';
          L.limbs.push({ kind: 'fin', at: [-s * 0.45, 0.4, l * 0.05], side: -1, ph: 0, rows: [['prism', [0.03, s * 0.3, s * 0.5], [0, 0, -s * 0.2], [0, 0, 0.6], 'accent']] }, { kind: 'fin', at: [s * 0.45, 0.4, l * 0.05], side: 1, ph: Math.PI, rows: [['prism', [0.03, s * 0.3, s * 0.5], [0, 0, -s * 0.2], [0, 0, -0.6], 'accent']] });
          Object.assign(L.a, { back: [0, 0.5 + s * 0.5, -0.1], chest: [0, 0.45, l * 0.45], waist: [0, 0.5, 0], tail: [0, 0.5, -l / 2], feet: [0, 0.5 - s * 0.55, 0], w: s, d: l, top: 0.5 + s * 0.55 });
          break;
        }
        case 'ползун': {
          const s = 0.42 * bw, hd = hd0 || 0.5;
          L.head = { at: [0, s * 0.55, 0], d: hd };
          L.segments = Math.round(clamp(4 + Ln * 3, 3, 10)); L.segS = s;
          Object.assign(L.a, { back: [0, s, -0.1], chest: [0, s * 0.5, s * 0.5], waist: [0, s * 0.5, 0], tail: [0, s * 0.5, -s], feet: [0, 0, 0], w: s, d: s, top: s * 0.55 + hd / 2 });
          break;
        }
        case 'комок': {
          const s = 0.9 * bw, hy = shape === 'круглый' ? 0.7 : shape === 'острый' ? 1.15 : 0.88; // круглый — лепёшка, острый — капля
          L.torso.push(['sphere', [s, s * hy, s * 0.9], [0, s * hy / 2, 0], 0, 'main', { seg: 6 }], ['sphere', [s * 0.6, s * 0.35, s * 0.4], [0, s * 0.22, s * 0.25], 0, 'belly']);
          L.head = { at: [0, s * hy * 0.57, 0], d: s * 0.9, inside: true };
          Object.assign(L.a, { back: [0, s * hy * 0.68, -s * 0.4], chest: [0, s * 0.4, s * 0.42], waist: [0, s * 0.3, 0], tail: [0, s * 0.3, -s * 0.44], feet: [0, 0, 0], w: s, d: s * 0.9, top: s * hy });
          break;
        }
        case 'предмет с лицом': {
          const base = spec.base || 'cylinder', s = 0.8 * bw, h = 1.0 * (b.length || 1), form = { box: 'box', cylinder: 'cyl', sphere: 'sphere', cone: 'cone', capsule: 'capsule', 'коробка': 'box', 'цилиндр': 'cyl', 'шар': 'sphere', 'конус': 'cone', 'капсула': 'capsule' }[base] || 'cyl';
          const lg = ll > 0.7 ? 0.12 * ll : 0;
          L.torso.push([form, [s, h, s * (form === 'box' ? 0.8 : 1)], [0, lg + h / 2, 0], 0, 'main', form === 'cone' ? { top: 0.25 } : {}]);
          const ob = partsOf(spec.object || []);
          if (ob['ручка']) L.torso.push(['torus', [h * 0.55, 0.06, h * 0.55], [-s / 2 - h * 0.15, lg + h * 0.55, 0], [0, 0, Math.PI / 2], 'second', { thick: 0.18 }]);
          if (ob['носик']) L.torso.push(['cone', [0.14, h * 0.5, 0.14], [s / 2 + 0.1, lg + h * 0.65, 0], [0, 0, -0.9], 'main', { top: 0.4 }]);
          if (ob['крышка']) L.torso.push(['cyl', [s * 1.05, 0.08, s * 1.05], [0, lg + h + 0.04, 0], 0, 'second'], ['sphere', [0.12, 0.1, 0.12], [0, lg + h + 0.12, 0], 0, 'accent']);
          if (ob['шнурок']) L.torso.push(['capsule', [0.04, 0.5, 0.04], [0, lg + h * 0.25, -s / 2 - 0.05], [0.9, 0, 0], 'detail'], ['box', [0.16, 0.06, 0.1], [0, lg + 0.04, -s / 2 - 0.35], 0, 'detail']);
          if (ob['этикетка']) L.torso.push(['box', [s * 0.62, h * 0.24, 0.02], [0, lg + h * 0.32, s * (form === 'box' ? 0.41 : 0.5)], 0, 'belly'], ['box', [s * 0.4, h * 0.05, 0.025], [0, lg + h * 0.32, s * (form === 'box' ? 0.415 : 0.505)], 0, 'accent']);
          L.head = { at: [0, lg + h * 0.68, 0], d: s * 0.95, inside: true };
          if (lg) { leg(-s * 0.22, lg + 0.02, 0, lg, 0.08, -1, 0, 'detail'); leg(s * 0.22, lg + 0.02, 0, lg, 0.08, 1, Math.PI, 'detail'); }
          L.gait = 'предмет';
          Object.assign(L.a, { back: [0, lg + h * 0.5, -s * 0.5], chest: [0, lg + h * 0.4, s * 0.5], waist: [0, lg + h * 0.2, 0], tail: [0, lg + h * 0.3, -s * 0.5], feet: [0, 0, 0], w: s, d: s, top: lg + h });
          break;
        }
        case 'на колёсах': {
          const r = 0.22 * ll, w = 0.6 * bw, l = 0.9 * Ln, h = 0.38, hd = hd0 || 0.36;
          L.torso.push(['rbox', [w, h, l], [0, r + h / 2 + 0.04, 0], 0, 'main'], ['box', [w * 1.02, 0.08, l * 0.7], [0, r + 0.1, 0], 0, 'second'], ['box', [w * 0.5, 0.12, 0.04], [0, r + h * 0.5, l / 2], 0, 'accent', { glow: 0.5 }]);
          L.head = { at: [0, r + h + hd * 0.38, l * 0.18], d: hd };
          for (const z of [l * 0.32, -l * 0.32]) for (const side of [-1, 1]) L.limbs.push({ kind: 'wheel', at: [side * (w / 2 + 0.04), r, z], side, r, rows: [['cyl', [r * 2, 0.12, r * 2], [0, 0, 0], [0, 0, Math.PI / 2], 'detail', { tess: 10 }], ['cyl', [r * 0.9, 0.13, r * 0.9], [0, 0, 0], [0, 0, Math.PI / 2], 'accent', { tess: 6 }]] });
          Object.assign(L.a, { back: [0, r + h, -l * 0.45], chest: [0, r + h * 0.5, l / 2], waist: [0, r + h * 0.3, 0], tail: [0, r + h * 0.5, -l / 2], feet: [0, 0, 0], w, d: l, top: r + h });
          break;
        }
        case 'летучий': {
          const s = 0.6 * bw, hd = hd0 || 0.42;
          L.torso.push(['sphere', [s, s * 0.8, s], [0, 0.4, 0], 0, 'main'], ['cyl', [s * 1.7, 0.08, s * 1.7], [0, 0.32, 0], 0, 'second', { tess: 14 }], ['torus', [s * 1.6, 0.05, s * 1.6], [0, 0.32, 0], 0, 'accent', { glow: 0.5, tess: 14 }], ['cone', [s * 0.6, 0.25, s * 0.6], [0, 0.15, 0], [Math.PI, 0, 0], 'detail']);
          L.head = { at: [0, 0.48, 0.02], d: hd, inside: true };
          L.hover = 1.1;
          Object.assign(L.a, { back: [0, 0.5, -s * 0.4], chest: [0, 0.4, s * 0.45], waist: [0, 0.3, 0], tail: [0, 0.4, -s * 0.5], feet: [0, 0.05, 0], w: s * 1.7, d: s * 1.7, top: 0.4 + s * 0.4, wingY: 0.42, wingX: s * 0.45 });
          break;
        }
        case 'робот': {
          const mv = spec.move || 'ноги', lg = mv === 'ноги' ? 0.3 * ll : 0.2, tw = 0.5 * bw, th = 0.42, hd = hd0 || 0.36;
          L.torso.push(['box', [tw, th, tw * 0.75], [0, lg + th / 2 + 0.04, 0], 0, 'main'], ['box', [tw * 0.6, th * 0.4, 0.04], [0, lg + th * 0.6, tw * 0.38], 0, 'second'], ...[-1, 0, 1].map(i => ['sphere', [0.05, 0.05, 0.03], [i * 0.08, lg + th * 0.62, tw * 0.4], 0, ['accent', 'belly', 'accent'][i + 1], { glow: 0.8 }]), ['cyl', [0.1, 0.1, 0.1], [0, lg + th + 0.08, 0], 0, 'detail']);
          L.head = { at: [0, lg + th + 0.1 + hd * 0.48, 0], d: hd, box: true };
          if (mv === 'гусеницы') for (const side of [-1, 1]) L.torso.push(['capsule', [0.16, 0.62, 0.2], [side * tw * 0.42, 0.12, 0], [Math.PI / 2, 0, 0], 'detail'], ['box', [0.17, 0.05, 0.5], [side * tw * 0.42, 0.24, 0], 0, 'second']);
          else if (mv === 'колесо') L.limbs.push({ kind: 'wheel', at: [0, 0.2, 0], side: 0, r: 0.2, rows: [['cyl', [0.4, 0.14, 0.4], [0, 0, 0], [0, 0, Math.PI / 2], 'detail', { tess: 10 }], ['cyl', [0.2, 0.15, 0.2], [0, 0, 0], [0, 0, Math.PI / 2], 'accent', { tess: 6 }]] });
          else { L.limbs.push(...[-1, 1].map(side => ({ kind: 'leg', at: [side * tw * 0.25, lg + 0.04, 0], side, ph: side > 0 ? Math.PI : 0, len: lg, rows: [['box', [0.12, lg, 0.12], [0, -lg / 2, 0], 0, 'second'], ['box', [0.17, 0.08, 0.24], [0, -lg + 0.04, 0.04], 0, 'detail']] }))); }
          L.limbs.push(...[-1, 1].map(side => ({ kind: 'arm', at: [side * (tw / 2 + 0.06), lg + th * 0.9, 0], side, ph: 0, len: 0.32, rows: [['box', [0.09, 0.32, 0.09], [0, -0.16, 0], 0, 'second'], ['box', [0.13, 0.1, 0.13], [0, -0.34, 0], 0, 'accent']] })));
          L.antenna = true; L.gait = mv === 'ноги' ? 'робот' : 'колёса';
          Object.assign(L.a, { back: [0, lg + th * 0.6, -tw * 0.38], chest: [0, lg + th * 0.6, tw * 0.38], waist: [0, lg + 0.08, 0], tail: [0, lg + 0.1, -tw * 0.38], feet: [0, 0, 0], w: tw, d: tw * 0.75, top: lg + th });
          break;
        }
        case 'растение': {
          const h = 0.55 * (b.length || 1) * ll, hd = hd0 || 0.5;
          L.torso.push(['cyl', [0.42 * bw, 0.3, 0.42 * bw], [0, 0.15, 0], 0, 'second', { top: 1.25 }], ['cyl', [0.07, h, 0.07], [0, 0.3 + h / 2, 0], 0, 'main'], ['box', [0.34, 0.03, 0.14], [0.16, 0.3 + h * 0.4, 0], [0, 0, 0.4], 'main'], ['box', [0.3, 0.03, 0.12], [-0.15, 0.3 + h * 0.65, 0], [0, 0, -0.4], 'main']);
          L.head = { at: [0, 0.3 + h + hd * 0.4, 0], d: hd, petals: true };
          L.gait = 'растение';
          Object.assign(L.a, { back: [0, 0.3 + h * 0.5, -0.05], chest: [0, 0.3 + h * 0.5, 0.05], waist: [0, 0.3, 0], tail: [0, 0.2, -0.2], feet: [0, 0, 0], w: 0.42 * bw, d: 0.42 * bw, top: 0.3 + h });
          break;
        }
        case 'дух': {
          const s = 0.7 * bw, h = 0.9 * (b.length || 1), hd = hd0 || 0.6;
          L.torso.push(['cone', [s, h, s], [0, h / 2, 0], [Math.PI, 0, 0], 'main', { top: 0.45, alpha: 0.85, glow: 0.35 }], ...ring(5, s * 0.36, (x, z) => ['sphere', [s * 0.3, s * 0.25, s * 0.3], [x, 0.04, z], 0, 'main', { alpha: 0.85, glow: 0.35 }]));
          L.head = { at: [0, h * 0.82, 0], d: hd, inside: true };
          L.hover = 0.5; L.gait = 'дух';
          Object.assign(L.a, { back: [0, h * 0.6, -s * 0.4], chest: [0, h * 0.5, s * 0.4], waist: [0, h * 0.3, 0], tail: [0, h * 0.2, -s * 0.3], feet: [0, 0, 0], w: s, d: s, top: h });
          break;
        }
        case 'каменный': {
          const lg = 0.22 * ll, tw = 0.62 * bw, th = 0.5, hd = hd0 || 0.32;
          L.torso.push(['ico', [tw, th, tw * 0.8], [0, lg + th / 2, 0], 0, 'main'], ['ico', [tw * 0.7, th * 0.5, tw * 0.5], [0, lg + th * 0.85, -0.05], 0.6, 'second'], ['sphere', [tw * 0.4, 0.12, tw * 0.3], [0.1, lg + th, -0.05], 0, 'accent', { d: 1 }]);
          L.head = { at: [0, lg + th + hd * 0.25, tw * 0.15], d: hd, box: true };
          leg(-tw * 0.25, lg + 0.04, 0, lg, 0.2, -1, 0, 'second', false); leg(tw * 0.25, lg + 0.04, 0, lg, 0.2, 1, Math.PI, 'second', false);
          L.limbs.push(...[-1, 1].map(side => ({ kind: 'arm', at: [side * (tw / 2 + 0.08), lg + th * 0.85, 0], side, ph: 0, len: 0.45, rows: [['ico', [0.2, 0.3, 0.2], [0, -0.15, 0], 0, 'second'], ['ico', [0.26, 0.24, 0.26], [0, -0.42, 0.02], 0.5, 'main']] })));
          L.gait = 'каменный';
          Object.assign(L.a, { back: [0, lg + th * 0.7, -tw * 0.38], chest: [0, lg + th * 0.6, tw * 0.38], waist: [0, lg + 0.06, 0], tail: [0, lg + 0.1, -tw * 0.38], feet: [0, 0, 0], w: tw, d: tw * 0.8, top: lg + th });
          break;
        }
      }
      if (L.head && !L.head.inside && SK[0] !== 1) { L.head.at[1] += L.head.d * (SK[0] - 1) * 0.45; L.head.d *= SK[0]; }
      return L;
    }
    // голова: сфера (или коробка у робота и каменного) и всё, что на ней
    function headRows(L, spec, P) {
      const H = L.head, d = H.d, rows = [], pr = partsOf(spec.parts), f = spec.face || {}, hw = [].concat(spec.wear || []);
      if (!H.inside) rows.push(H.box ? ['box', [d, d * 0.85, d * 0.9], [0, 0, 0], 0, 'main'] : ['sphere', [d, d * 0.95, d], [0, 0, 0], 0, 'main']);
      if (H.snout) rows.push(['sphere', [d * 0.6, d * 0.45, d * 0.55], [0, -d * 0.18, d * 0.4], 0, 'belly']);
      if (H.petals) rows.push(...ring(8, d * 0.58, (x, y, i) => ['sphere', [d * 0.42, d * 0.42, d * 0.12], [x, y, -d * 0.1], 0, i % 2 ? 'accent' : 'second']));
      if (L.antenna) rows.push(['cyl', [0.03, d * 0.5, 0.03], [d * 0.2, d * 0.62, 0], 0, 'detail'], ['sphere', [0.08, 0.08, 0.08], [d * 0.2, d * 0.88, 0], 0, 'accent', { glow: 1 }]);
      if (L.antennae || pr['усики']) for (const s of [-1, 1]) rows.push(['cyl', [0.025, d * 0.6, 0.025], [s * d * 0.18, d * 0.65, d * 0.1], [0.4, 0, -s * 0.35], 'detail'], ['sphere', [0.07, 0.07, 0.07], [s * d * 0.3, d * 0.92, d * 0.22], 0, 'accent']);
      const top = H.inside ? d * 0.42 : d * 0.46;
      if (pr['рога']) {
        const t = pr['рога'];
        for (const s of [-1, 1]) {
          if (t === 'прямые') rows.push(['cone', [d * 0.14, d * 0.5, d * 0.14], [s * d * 0.24, top + d * 0.18, 0], [0, 0, -s * 0.25], 'belly']);
          else if (t === 'спиральные') for (let i = 0; i < 4; i++) rows.push(['torus', [d * (0.26 - i * 0.05), d * 0.07, d * (0.26 - i * 0.05)], [s * (d * 0.3 + i * d * 0.05), top + i * d * 0.09, -d * 0.05], [0.3, 0, -s * 0.5], i % 2 ? 'belly' : 'detail']);
          else for (let i = 0; i < 4; i++) rows.push(['cone', [d * (0.15 - i * 0.025), d * 0.2, d * (0.15 - i * 0.025)], [s * (d * 0.22 + i * d * 0.07), top + d * 0.05 + i * d * 0.1, -i * i * d * 0.03], [-0.25 * i, 0, -s * (0.4 + i * 0.15)], 'belly', { top: 0.7 }]);
        }
      }
      if (pr['уши']) {
        const t = pr['уши'];
        for (const s of [-1, 1]) {
          if (t === 'висячие') rows.push(['capsule', [d * 0.2, d * 0.55, d * 0.1], [s * d * 0.5, d * 0.02, -d * 0.05], [0, 0, s * 0.35], 'second']);
          else if (t === 'длинные') rows.push(['capsule', [d * 0.2, d * 0.8, d * 0.1], [s * d * 0.2, top + d * 0.36, -d * 0.05], [0, 0, -s * 0.15], 'main'], ['capsule', [d * 0.1, d * 0.6, d * 0.05], [s * d * 0.2, top + d * 0.36, -d * 0.01], [0, 0, -s * 0.15], 'щёки']);
          else rows.push(['cone', [d * 0.26, d * 0.32, d * 0.12], [s * d * 0.3, top + d * 0.05, -d * 0.02], [0, 0, -s * 0.3], 'main'], ['cone', [d * 0.14, d * 0.2, d * 0.05], [s * d * 0.3, top + d * 0.03, d * 0.03], [0, 0, -s * 0.3], 'щёки', { d: 1 }]);
        }
      }
      if (pr['гребень']) rows.push(...[0, 1, 2].map(i => ['cone', [d * 0.16, d * (0.3 - i * 0.05), d * 0.06], [0, top + d * 0.08, d * (0.15 - i * 0.18)], [-0.2 * i, 0, 0], 'accent']));
      if (pr['грива']) rows.push(...ring(7, d * 0.42, (x, y, i) => ['sphere', [d * 0.4, d * 0.4, d * 0.3], [x, y + d * 0.05, -d * 0.2], 0, i % 2 ? 'second' : 'detail']).filter((r, i) => i !== 5 && i !== 6 || true));
      // лицо, которое не меняется от настроения
      const fz = H.inside ? d * 0.5 : d * 0.47;
      if (f.nose) rows.push(['sphere', [d * 0.13, d * 0.11, d * 0.1], [0, -d * 0.06, fz + d * 0.03], 0, typeof f.nose === 'string' && hexOk(f.nose) ? f.nose : 'detail']);
      if (f.cheeks || spec.role === 'друг') for (const s of [-1, 1]) rows.push(['sphere', [d * 0.16, d * 0.09, d * 0.04], [s * d * 0.28, -d * 0.12, fz - d * 0.06], 0, 'щёки']);
      if (f.whiskers) for (const s of [-1, 1]) for (const k of [-1, 1]) rows.push(['box', [d * 0.36, 0.012, 0.012], [s * d * 0.3, -d * 0.1 + k * d * 0.03, fz], [0, 0, k * s * 0.15], 'detail', { keep: 1 }]);
      if (f.beard) rows.push(['cone', [d * 0.32, d * 0.4, d * 0.2], [0, -d * 0.5, fz - d * 0.12], [Math.PI, 0, 0], typeof f.beard === 'string' && hexOk(f.beard) ? f.beard : 'belly']);
      if (f.mustache) for (const s of [-1, 1]) rows.push(['capsule', [d * 0.22, d * 0.07, d * 0.07], [s * d * 0.1, -d * 0.16, fz + d * 0.02], [0, 0, s * 0.35], 'detail']);
      // убор на голове
      for (const w0 of hw) {
        const [w, tint] = wearOf(w0), n0 = rows.length;
        switch (w) {
          case 'папаха': rows.push(['cyl', [d * 0.82, d * 0.42, d * 0.82], [0, top + d * 0.12, 0], 0, 'detail', { top: 1.12 }], ['cyl', [d * 0.72, d * 0.06, d * 0.72], [0, top + d * 0.34, 0], 0, 'accent']); break;
          case 'каска': rows.push(['hemi', [d * 1.04, d * 0.62, d * 1.04], [0, top - d * 0.18, 0], 0, 'accent'], ['cyl', [d * 1.22, 0.03, d * 1.22], [0, top - d * 0.17, 0.03], 0, 'accent'], ['box', [d * 0.16, d * 0.06, 0.02], [0, top + d * 0.05, d * 0.5], 0, 'belly']); break;
          case 'корона': rows.push(['cyl', [d * 0.62, d * 0.16, d * 0.62], [0, top + d * 0.05, 0], 0, '#ffd23f', { glow: 0.3 }], ...ring(5, d * 0.28, (x, z) => ['cone', [d * 0.12, d * 0.2, d * 0.12], [x, top + d * 0.22, z], 0, '#ffd23f', { glow: 0.3 }]), ['sphere', [d * 0.08, d * 0.08, d * 0.05], [0, top + d * 0.05, d * 0.31], 0, '#e0304a']); break;
          case 'кепка': rows.push(['hemi', [d * 0.98, d * 0.56, d * 0.98], [0, top - d * 0.16, 0], 0, 'accent'], ['box', [d * 0.6, 0.03, d * 0.4], [0, top - d * 0.14, d * 0.58], [-0.12, 0, 0], 'accent']); break;
          case 'колпак повара': rows.push(['cyl', [d * 0.62, d * 0.4, d * 0.62], [0, top + d * 0.15, 0], 0, '#fbfbf6'], ['sphere', [d * 0.85, d * 0.45, d * 0.85], [0, top + d * 0.42, 0], 0, '#fbfbf6']); break;
          case 'шлем космонавта': rows.push(['sphere', [d * 1.35, d * 1.3, d * 1.35], [0, 0, 0], 0, '#cfe8ff', { alpha: 0.3 }], ['torus', [d * 1.1, d * 0.12, d * 1.1], [0, -d * 0.55, 0], 0, '#e8ecf4']); break;
          case 'бандана': rows.push(['torus', [d * 1.0, d * 0.1, d * 1.0], [0, top - d * 0.2, 0], [0.12, 0, 0], 'accent', { thick: 0.12 }], ['box', [d * 0.14, d * 0.26, d * 0.04], [d * 0.05, top - d * 0.3, -d * 0.5], [0, 0, 0.5], 'accent']); break;
          case 'ковбойская шляпа': rows.push(['cyl', [d * 1.5, 0.04, d * 1.2], [0, top - d * 0.04, 0], 0, 'detail'], ['cyl', [d * 0.66, d * 0.42, d * 0.6], [0, top + d * 0.16, 0], 0, 'detail', { top: 0.85 }], ['cyl', [d * 0.68, d * 0.07, d * 0.62], [0, top + d * 0.02, 0], 0, 'accent']); break;
          case 'наушники': rows.push(['torus', [d * 1.08, d * 0.08, d * 1.08], [0, d * 0.1, 0], [0, 0, Math.PI / 2], 'detail', { thick: 0.07 }], ...[-1, 1].map(s => ['cyl', [d * 0.3, d * 0.14, d * 0.3], [s * d * 0.52, 0, 0], [0, 0, Math.PI / 2], 'accent'])); break;
          case 'очки': rows.push(...[-1, 1].map(s => ['torus', [d * 0.32, d * 0.04, d * 0.32], [s * d * 0.2, d * 0.08, fz + d * 0.06], [Math.PI / 2, 0, 0], 'detail', { thick: 0.12 }]), ['box', [d * 0.1, 0.02, 0.02], [0, d * 0.1, fz + d * 0.06], 0, 'detail']); break;
          case 'маска': rows.push(['box', [d * 0.95, d * 0.2, d * 0.1], [0, d * 0.08, fz - d * 0.03], 0, 'detail']); break;
        }
        tintWear(rows, n0, tint);
      }
      return rows;
    }
    // одежда со своим цветом: 'папаха:#f4f0e6' — главная роль вещи (первая строка) красится в этот цвет
    function wearOf(w) { const [name, c] = String(w).split(':'); return [name, c && hexOk(c) ? c : null]; }
    function tintWear(rows, n0, tint, dry) {
      if (dry || !tint || rows.length <= n0) return;
      const role = rows[n0][4];
      for (let i = n0; i < rows.length; i++) if (rows[i][4] === role) rows[i][4] = tint;
    }
    // туловище: одежда и части на спине
    function bodyWear(L, spec, P) {
      const rows = [], a = L.a, w = a.w, pr = partsOf(spec.parts), wear = [].concat(spec.wear || []);
      const [bx, by, bz] = a.back, [cx, cy, cz] = a.chest, [wx, wy] = a.waist;
      if (pr['панцирь']) rows.push(['hemi', [w * 1.3, w * 0.9, a.d * 1.0], [0, by - w * 0.15, (bz + cz) * 0.25], 0, 'second'], ...ring(5, w * 0.3, (x, z) => ['sphere', [w * 0.18, w * 0.06, w * 0.18], [x, by + w * 0.25, z], 0, 'detail', { d: 1 }]));
      if (pr['иглы']) for (let i = 0; i < 9; i++) rows.push(['cone', [w * 0.08, w * 0.4, w * 0.08], [((i % 3) - 1) * w * 0.22, by + w * 0.08, bz + (Math.floor(i / 3) - 1) * w * 0.25], [-0.6 + (Math.floor(i / 3)) * 0.1, 0, ((i % 3) - 1) * 0.4], 'detail']);
      if (pr['шипы']) for (let i = 0; i < 3; i++) rows.push(['cone', [w * 0.16, w * 0.35, w * 0.16], [0, by + w * 0.12, bz + w * 0.3 - i * w * 0.3], [-0.4, 0, 0], 'accent']);
      if (pr['жало']) rows.push(['cone', [w * 0.12, w * 0.4, w * 0.12], [0, a.tail[1], a.tail[2] - w * 0.15], [-Math.PI / 2 - 0.3, 0, 0], 'detail']);
      if (pr['плавники']) rows.push(['prism', [0.03, w * 0.4, w * 0.5], [0, by + w * 0.18, bz], 0, 'accent']);
      if (pr['клешни']) for (const s of [-1, 1]) rows.push(['capsule', [0.08, 0.3, 0.08], [s * w * 0.45, cy - 0.05, cz + 0.12], [Math.PI / 2 - 0.3, s * 0.4, 0], 'second'], ['cone', [0.12, 0.2, 0.08], [s * (w * 0.45 + 0.08), cy - 0.02, cz + 0.32], [Math.PI / 2, 0, 0.3 * s], 'accent'], ['cone', [0.1, 0.17, 0.07], [s * (w * 0.45 - 0.02), cy - 0.08, cz + 0.32], [Math.PI / 2, 0, -0.3 * s], 'accent']);
      for (const x0 of wear) {
        const [x, tint] = wearOf(x0), n0 = rows.length;
        switch (x) {
          case 'плащ': rows.push(['box', [w * 1.1, (by - 0.02) * 0.95, 0.03], [0, by * 0.52, bz - 0.03], [0.12, 0, 0], 'accent', { taper: 1.4 }]); break;
          case 'шарф': rows.push(['torus', [w * 0.8, 0.07, w * 0.8], [0, a.top - 0.01, 0.01], 0, 'accent', { thick: 0.18 }], ['box', [0.09, 0.26, 0.03], [w * 0.2, a.top - 0.14, cz + 0.02], [0, 0, 0.15], 'accent']); break;
          case 'черкеска': rows.push(['cyl', [w * 1.12, (a.top - wy) * 1.05, a.d * 1.02], [0, (a.top + wy) / 2 - 0.02, 0], 0, 'detail', { top: 0.9 }], ['cyl', [w * 1.3, 0.18, a.d * 1.2], [0, wy - 0.04, 0], 0, 'detail', { top: 0.88 }], ...[-1, 1].flatMap(s => [0, 1, 2, 3].map(i => ['cyl', [0.035, 0.1, 0.035], [s * w * 0.2 + s * i * 0.03, cy + 0.04, cz + 0.02], 0, 'belly']))); break;
          case 'фартук': rows.push(['box', [w * 0.8, (a.top - wy) * 0.95, 0.025], [0, (a.top + wy) / 2 - 0.08, cz + 0.02], 0, '#f6f2ea']); break;
          case 'рюкзак': rows.push(['rbox', [w * 0.7, (a.top - wy) * 0.75, w * 0.36], [0, by, bz - w * 0.15], 0, 'accent'], ['box', [w * 0.5, 0.05, 0.02], [0, by - 0.05, bz - w * 0.34], 0, 'detail']); break;
          case 'сумка почтальона': rows.push(['box', [0.06, w * 0.25, w * 0.4], [w * 0.55, wy + 0.05, 0], 0, 'detail'], ['box', [0.03, (a.top - wy) * 1.4, 0.04], [0, (a.top + wy) / 2, cz + 0.01], [0, 0, 0.7], 'detail']); break;
          case 'пояс': rows.push(['torus', [w * 1.04, 0.05, a.d * 1.04], [0, wy + 0.04, 0], 0, 'detail', { thick: 0.1 }], ['box', [0.08, 0.06, 0.02], [0, wy + 0.04, cz + 0.01], 0, '#ffd23f']); break;
          case 'бронежилет': rows.push(['box', [w * 1.05, (a.top - wy) * 0.8, a.d * 1.05], [0, (a.top + wy) / 2, 0], 0, 'detail']); break;
          case 'жилет курьера': rows.push(['box', [w * 1.05, (a.top - wy) * 0.82, a.d * 1.04], [0, (a.top + wy) / 2, 0], 0, 'accent', { glow: 0.15 }], ['box', [w * 1.07, 0.04, a.d * 1.06], [0, (a.top + wy) / 2 - 0.05, 0], 0, '#f0f0e8', { glow: 0.3 }]); break;
          case 'скейт': rows.push(['rbox', [w * 1.0, 0.04, w * 2.2], [0, 0.07, 0], 0, 'accent'], ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => ['cyl', [0.07, 0.05, 0.07], [x * w * 0.3, 0.035, z * w * 0.75], [0, 0, Math.PI / 2], 'detail'])); break;
        }
        tintWear(rows, n0, tint);
      }
      return rows;
    }
    // предмет в руке: ручка вдоль −Y от кисти, вверх смотрит рабочая часть
    const HOLDS = {
      'молот': [['cyl', [0.05, 0.6, 0.05], [0, 0.1, 0.05], [Math.PI / 2, 0, 0], 'ствол'], ['box', [0.16, 0.16, 0.28], [0, 0.1, 0.38], 0, 'металл']],
      'фонарь': [['cyl', [0.02, 0.15, 0.02], [0, -0.08, 0], 0, 'металл'], ['box', [0.14, 0.18, 0.14], [0, -0.24, 0], 0, 'свет', { glow: 1 }], ['pyramid', [0.16, 0.08, 0.16], [0, -0.12, 0], 0, 'металл']],
      'дымарь': [['cyl', [0.14, 0.24, 0.14], [0, -0.08, 0.1], 0, 'металл'], ['cone', [0.12, 0.1, 0.12], [0, 0.09, 0.1], 0, 'металл'], ['box', [0.08, 0.06, 0.14], [0, -0.06, -0.02], 0, 'ствол']],
      'посох': [['cyl', [0.05, 1.3, 0.05], [0, 0.25, 0.04], 0, 'ствол'], ['sphere', [0.12, 0.12, 0.12], [0, 0.92, 0.04], 0, 'акцент', { glow: 0.6 }]],
      'меч-карандаш': [['cyl', [0.07, 0.62, 0.07], [0, 0.0, 0.32], [Math.PI / 2, 0, 0], 'акцент', { tess: 6 }], ['cone', [0.07, 0.14, 0.07], [0, 0, 0.7], [Math.PI / 2, 0, 0], '#e8c890', { tess: 6 }], ['cone', [0.02, 0.05, 0.02], [0, 0, 0.78], [Math.PI / 2, 0, 0], '#2a2a2a']],
      'поднос': [['cyl', [0.5, 0.03, 0.5], [0, 0.02, 0.2], 0, 'металл', { tess: 12 }], ['cyl', [0.12, 0.12, 0.12], [0.08, 0.1, 0.22], 0, 'ткань']],
      'метла': [['cyl', [0.04, 1.0, 0.04], [0, 0.1, 0], 0, 'ствол'], ['cone', [0.3, 0.35, 0.18], [0, -0.52, 0], 0, 'акцент', { top: 0.4 }]],
      'удочка': [['cyl', [0.03, 1.4, 0.03], [0, 0.45, 0.35], [-0.6, 0, 0], 'ствол'], ['cyl', [0.008, 0.8, 0.008], [0, 0.65, 1.05], 0, 'тёмный', { keep: 1 }], ['sphere', [0.07, 0.07, 0.07], [0, 0.25, 1.05], 0, 'огонь', { noglow: 1 }]],
      'щит': [['cyl', [0.55, 0.06, 0.55], [0.06, 0, 0.05], [0, 0, Math.PI / 2], 'акцент', { tess: 12 }], ['sphere', [0.12, 0.12, 0.08], [0.1, 0, 0.05], 0, 'металл']],
      'пушка': [['cyl', [0.12, 0.45, 0.12], [0, 0, 0.22], [Math.PI / 2, 0, 0], 'металл'], ['box', [0.1, 0.16, 0.12], [0, -0.06, 0], 0, 'тёмный'], ['torus', [0.14, 0.03, 0.14], [0, 0, 0.44], [Math.PI / 2, 0, 0], 'акцент']],
      'катапульта': [['box', [0.2, 0.04, 0.3], [0, -0.05, 0.1], 0, 'дерево'], ['cyl', [0.03, 0.4, 0.03], [0, 0.12, 0.22], [-0.5, 0, 0], 'дерево'], ['hemi', [0.12, 0.1, 0.12], [0, 0.3, 0.32], [Math.PI, 0, 0], 'дерево']],
    };
    function eyeSpec(spec, L) {
      const e = spec.eyes || {}, d = L.head.d, n = clamp(Math.round(e.n || (L.gait === 'робот' ? 2 : 2)), 1, 3), look = e.look || (spec.role === 'враг' ? 'злые' : 'круглые');
      const size = (e.size || 1) * d * (n === 1 ? 0.42 : 0.3), place = e.place || 'спереди', fz = L.head.inside ? d * 0.5 : d * 0.47;
      const xs = n === 1 ? [0] : n === 2 ? [-d * 0.2, d * 0.2] : [-d * 0.26, 0, d * 0.26];
      const pos = xs.map((x, i) => place === 'по бокам' ? [Math.sign(x || (i ? 1 : -1)) * d * 0.44, d * 0.08, d * 0.16] : place === 'на стебельках' ? [x * 1.2, d * 0.95, d * 0.08] : [x, d * 0.08 + (n === 3 && i === 1 ? d * 0.06 : 0), fz - size * 0.12]);
      return { n, look, size, place, pos, pupils: e.pupils !== false, brows: e.brows != null ? !!e.brows : look === 'злые' || look === 'испуганные' || look === 'хитрые' };
    }
    function faceRows(L, spec, E, mood) {
      const d = L.head.d, rows = [], fz = L.head.inside ? d * 0.5 : d * 0.47, f = spec.face || {}, s = E.size;
      let mouth = f.mouth || L.head.mouth || (spec.role === 'враг' ? 'пасть с зубами' : 'улыбка');
      const look = mood === 'устал' ? 'сонные' : mood === 'злой' ? 'злые' : mood === 'испуган' ? 'испуганные' : E.look;
      if (mood === 'рад' && mouth !== 'клюв' && mouth !== 'нет') mouth = 'улыбка';
      if (mood === 'злой' && mouth === 'улыбка') mouth = 'рот-щель';
      if (mood === 'испуган' && mouth !== 'клюв' && mouth !== 'нет') mouth = 'о';
      const my = -d * 0.2, mz = fz - d * 0.02;
      if (E.place === 'на стебельках') for (const p of E.pos) rows.push(['cyl', [0.03, d * 0.5, 0.03], [p[0], d * 0.68, p[2] - 0.02], 0, 'main']);
      if (look !== 'визор') for (const p of E.pos) {
        if (look === 'сонные' || look === 'хитрые') rows.push(['sphere', [s * 1.1, s * 0.62, s * 0.7], [p[0], p[1] + s * 0.26, p[2] + s * 0.04], 0, 'main']);
        if (E.brows || mood === 'злой' || mood === 'испуган') { const side = p[0] < 0 ? -1 : 1, tilt = look === 'злые' ? -0.45 : look === 'испуганные' ? 0.4 : look === 'хитрые' ? -0.2 : 0.1; rows.push(['box', [s * 0.95, s * 0.16, s * 0.14], [p[0], p[1] + s * 0.66 - (look === 'злые' ? s * 0.08 : 0), p[2] + s * 0.12], [0, 0, side * tilt], 'detail', { keep: 1 }]); }
      }
      switch (mouth) {
        case 'улыбка': rows.push(['box', [d * 0.16, d * 0.04, d * 0.04], [0, my - d * 0.02, mz], 0, 'рот', { keep: 1 }], ['box', [d * 0.1, d * 0.04, d * 0.04], [-d * 0.11, my, mz - d * 0.01], [0, 0.3, -0.55], 'рот', { keep: 1 }], ['box', [d * 0.1, d * 0.04, d * 0.04], [d * 0.11, my, mz - d * 0.01], [0, -0.3, 0.55], 'рот', { keep: 1 }]); break;
        case 'клюв': rows.push(['cone', [d * 0.24, d * 0.32, d * 0.18], [0, -d * 0.06, fz + d * 0.1], [Math.PI / 2, 0, 0], 'accent', { tess: 6 }]); break;
        case 'пасть с зубами': rows.push(['box', [d * 0.42, d * 0.12, d * 0.05], [0, my, mz], 0, 'рот', { keep: 1 }], ...line(4, d * 0.32, x => ['cone', [d * 0.07, d * 0.08, d * 0.04], [x, my + d * 0.03, mz + d * 0.03], [Math.PI, 0, 0], 'зубы', { keep: 1, tess: 3 }])); break;
        case 'рот-щель': rows.push(['box', [d * 0.24, d * 0.03, d * 0.04], [0, my, mz], 0, 'рот', { keep: 1 }]); break;
        case 'о': rows.push(['torus', [d * 0.12, d * 0.04, d * 0.12], [0, my - d * 0.02, mz], [Math.PI / 2, 0, 0], 'рот', { keep: 1, thick: 0.3 }]); break;
      }
      return rows;
    }
    lab.creature = function (spec = {}) {
      need();
      const S = style(), plan = PLANS.includes(spec.plan) ? spec.plan : (warn('plan:' + spec.plan, `Нет плана тела «${spec.plan}». Есть: ${PLANS.join(', ')}`), 'двуногий');
      const seed = spec.seed != null ? spec.seed >>> 0 : seedOf(900 + (K.n++)), rnd = mulberry32(seed);
      const shape = ['круглый', 'угловатый', 'острый'].includes(spec.shape) ? spec.shape : ['круглый', 'угловатый', 'острый'].includes(S.shape) ? S.shape : 'обычный';
      const P = crPalette(spec, S), L = layout(plan, spec, rnd, shape), pr = partsOf(spec.parts);
      const boss = spec.role === 'босс', size = (spec.size || (plan === 'комок' ? 1 : plan === 'четвероногий' ? 1.2 : 1.4)) * (boss ? 1.6 : 1);
      const ctx = ctxOf({ warp: false, shape, colors: P, key: 'существо' + seed, seed });
      const mk = (name, rows, parent, at) => { const m = assemble(name, rows, ctx); m.parent = parent; if (at) m.position.set(at[0], at[1], at[2]); m.isPickable = false; return m; };
      const root = new B.TransformNode('существо:' + plan, K.scene);
      if (spec.at) root.position.copyFrom(posOf(spec.at));
      const pose = new B.TransformNode('поза', K.scene); pose.parent = root;
      // общая высота схемы → масштаб под size
      const topY = Math.max(L.a.top || 1, L.head ? L.head.at[1] + L.head.d * 0.5 : 0) + L.hover;
      const k = size / Math.max(0.3, topY), meshes = [];
      pose.scaling.setAll(k);
      const body = new B.TransformNode('тело', K.scene); body.parent = pose; body.position.y = L.hover;
      // тело: туловище + одежда + хвост, если хвост неподвижный
      const tRows = L.torso.concat(bodyWear(L, spec, P));
      if (spec.extra && typeof spec.extra !== 'function') warn('extra', 'extra — функция (lab, node, части) => …');
      if (tRows.length) meshes.push(mk('туловище', tRows, body));
      const c = { root, pose, body, plan, spec, size, k, parts: {}, meshes, alive: true, autoFace: spec.autoFace !== false, ground: spec.ground === undefined ? 0 : spec.ground, t: rnd() * 10, speed: 0, mood_: spec.mood || null, fx: [], pal: P };
      // голова, глаза, лицо
      const H = L.head, E = eyeSpec(spec, L);
      const head = new B.TransformNode('голова', K.scene); head.parent = body; head.position.set(H.at[0], H.at[1], H.at[2]);
      const hr = headRows(L, spec, P); if (hr.length) meshes.push(c.parts.head = mk('голова', hr, head));
      const eyes = new B.TransformNode('глаза', K.scene); eyes.parent = head; eyes.position.y = E.pos[0][1];
      const look = new B.TransformNode('взгляд', K.scene); look.parent = eyes;
      const glowEyes = E.look === 'светятся' || spec.role === 'враг' || spec.role === 'босс';
      if (E.look === 'визор') meshes.push(c.parts.eyes = mk('визор', [['box', [H.d * 0.72, H.d * 0.2, H.d * 0.1], [0, 0, (H.inside ? H.d * 0.5 : H.d * 0.45)], 0, 'accent', { glow: 0.9 }]], eyes));
      else {
        meshes.push(c.parts.eyes = mk('белки', E.pos.map(p => ['sphere', [E.size, E.size * (E.look === 'испуганные' ? 1.15 : 1), E.size * 0.6], [p[0], 0, p[2]], 0, E.look === 'светятся' ? 'detail' : 'white', { keep: 1, seg: 6 }]), eyes));
        if (E.pupils) {
          const ps = E.look === 'испуганные' ? 0.32 : E.look === 'злые' ? 0.42 : 0.5, side = E.place === 'по бокам';
          const prow = E.pos.flatMap(p => { const ox = side ? Math.sign(p[0]) * E.size * 0.24 : 0, oz = side ? 0 : E.size * 0.24; return [['sphere', [E.size * ps, E.size * ps, E.size * 0.3], [p[0] + ox, 0, p[2] + oz], 0, glowEyes ? 'accent' : 'pupil', glowEyes ? { glow: 1, keep: 1, unlit: true } : { keep: 1, seg: 5 }], ['sphere', [E.size * 0.17, E.size * 0.17, E.size * 0.1], [p[0] + ox + E.size * 0.12, E.size * 0.13, p[2] + oz + E.size * 0.1], 0, 'blik', { keep: 1, unlit: true }]]; });
          meshes.push(c.parts.pupils = mk('зрачки', prow, look));
        }
      }
      c.E = E; c.L = L; c.mk = mk; c.headNode = head; c.eyes = eyes; c.lookNode = look;
      c.rebuildFace = mood => { if (c.parts.face) { c.parts.face.dispose(); meshes.splice(meshes.indexOf(c.parts.face), 1); } const fr = faceRows(L, spec, E, mood); c.parts.face = fr.length ? mk('лицо', fr, head) : null; if (c.parts.face) meshes.push(c.parts.face); };
      c.rebuildFace(c.mood_);
      // конечности на шарнирах
      c.limbs = L.limbs.map((l, i) => { const n = new B.TransformNode(l.kind + i, K.scene); n.parent = body; n.position.set(l.at[0], l.at[1], l.at[2]); const m = mk(l.kind, l.rows, n); meshes.push(m); return Object.assign({ node: n, mesh: m }, l); });
      const arms = c.limbs.filter(l => l.kind === 'arm');
      // крылья и хвост
      const wingT = pr['крылья'] || L.wings;
      if (wingT) {
        const wy = L.a.wingY || L.a.back[1], wx = L.a.wingX || L.a.w * 0.45, ws = L.a.w * 1.1;
        for (const s of [-1, 1]) {
          const n = new B.TransformNode('крыло', K.scene); n.parent = body; n.position.set(s * wx, wy, L.a.back[2] * 0.5);
          const rows = wingT === 'прозрачные' ? [['disc', [ws * 1.4, 0, ws * 0.6], [s * ws * 0.7, 0, -ws * 0.1], [0, 0, 0], '#e8f6ff', { alpha: 0.45, glow: 0.2, keep: 1 }]] : wingT === 'кожистые' ? [['prism', [ws * 1.3, 0.03, ws * 0.7], [s * ws * 0.62, 0, 0], [Math.PI / 2, 0, 0], 'second'], ['cyl', [0.03, ws * 1.3, 0.03], [s * ws * 0.62, 0, ws * 0.32], [0, 0, Math.PI / 2], 'detail']] : [0, 1, 2].map(j => ['box', [ws * (1.0 - j * 0.18), 0.03, ws * 0.22], [s * ws * (0.5 - j * 0.06), -j * 0.02, -j * ws * 0.17], [0, s * j * 0.18, 0], j ? 'second' : 'main']);
          const m = mk('крыло', rows, n); meshes.push(m);
          c.limbs.push({ kind: 'wing', node: n, mesh: m, side: s, ph: 0 });
        }
      }
      const tailT = pr['хвост'] || L.tail;
      if (tailT && plan !== 'ползун') {
        const n = new B.TransformNode('хвост', K.scene); n.parent = body; n.position.set(L.a.tail[0], L.a.tail[1], L.a.tail[2]);
        const tw = L.a.w;
        const rows = tailT === 'пушистый' ? [['capsule', [tw * 0.32, tw * 0.75, tw * 0.32], [0, tw * 0.2, -tw * 0.32], [-0.9, 0, 0], 'second'], ['sphere', [tw * 0.3, tw * 0.3, tw * 0.3], [0, tw * 0.42, -tw * 0.55], 0, 'belly']] : tailT === 'рыбий' ? [['prism', [0.04, tw * 0.8, tw * 0.6], [0, 0, -tw * 0.32], [Math.PI / 2, 0, Math.PI / 2], 'accent']] : tailT === 'перья' ? [0, 1, 2].map(j => ['box', [tw * 0.16, 0.03, tw * 0.6], [(j - 1) * tw * 0.12, 0.02 * j, -tw * 0.3], [-0.3, (j - 1) * 0.3, 0], j === 1 ? 'second' : 'main']) : [['cyl', [0.05, tw * 0.9, 0.05], [0, 0, -tw * 0.42], [-1.3, 0, 0], 'second'], ['sphere', [0.12, 0.12, 0.12], [0, tw * 0.1, -tw * 0.86], 0, 'detail']];
        const m = mk('хвост', rows, n); meshes.push(m);
        c.limbs.push({ kind: 'tail', node: n, mesh: m, side: 0, ph: 0 });
      }
      if (pr['щупальца']) for (let i = 0; i < 5; i++) { const a = i / 5 * TAU, n = new B.TransformNode('щупальце', K.scene); n.parent = body; n.position.set(Math.cos(a) * L.a.w * 0.3, (L.a.feet[1] || 0) + 0.12, Math.sin(a) * L.a.w * 0.3); const m = mk('щупальце', [['capsule', [0.07, 0.45, 0.07], [0, -0.2, 0], 0, 'second'], ['sphere', [0.06, 0.06, 0.06], [0, -0.42, 0.03], 0, 'belly']], n); meshes.push(m); c.limbs.push({ kind: 'tent', node: n, mesh: m, side: i, ph: a }); }
      // предмет в руке
      if (spec.holds) {
        const hand = arms.find(a => a.side > 0) || null, n = new B.TransformNode('в руке', K.scene);
        n.parent = hand ? hand.node : body; if (hand) n.position.set(0, -hand.len, 0.02); else n.position.set(L.a.w * 0.55, L.a.chest[1], L.a.chest[2]);
        const rows = typeof spec.holds === 'function' ? null : HOLDS[spec.holds];
        if (typeof spec.holds === 'function') { try { const r = spec.holds(lab, n); if (r && r.copy) r.copy([0, 0, 0], 0, 1 / k, n); } catch (e) { warn('holds', 'holds: ' + e.message); } }
        else if (rows) meshes.push(c.parts.holds = mk('в руке', rows.map(r => r.slice(0, 5).concat([Object.assign({}, r[5] || {})])).map(r => [r[0], r[1], r[2], r[3], r[4] === 'акцент' ? 'accent' : r[4], r[5]]), n));
        else warn('holds:' + spec.holds, `Нет предмета «${spec.holds}». Есть: ${Object.keys(HOLDS).join(', ')} или функция (lab, узел) => меш`);
        c.holdNode = n;
      }
      // сегменты ползуна идут по следу головы
      if (L.segments) {
        c.segs = []; c.trail = [];
        for (let i = 0; i < L.segments; i++) { const sz = L.segS * (1 - i / (L.segments * 1.6)); const m = assemble('сегмент', [['sphere', [sz, sz * 0.85, sz], [0, sz * 0.42, 0], 0, i % 2 ? 'second' : 'main', { seg: 5 }], ...(pr['иглы'] || pr['шипы'] ? [['cone', [sz * 0.25, sz * 0.4, sz * 0.25], [0, sz * 0.9, 0], 0, 'accent']] : []), ['sphere', [sz * 0.5, sz * 0.2, sz * 0.5], [0, sz * 0.12, sz * 0.15], 0, 'belly', { d: 1 }]], ctx); m.scaling.setAll(k); m.isPickable = false; meshes.push(m); c.segs.push(m); }
      }
      // своё: extra(lab, узел, части) — отличительный знак героя по карте
      const anchors = { top: [0, topY - L.hover, 0], head: head, face: [0, H.at[1], H.at[2] + H.d * 0.5], chin: [0, H.at[1] - H.d * 0.45, H.at[2] + H.d * 0.3], back: L.a.back, chest: L.a.chest, belly: L.a.chest, tail: L.a.tail, hand: c.holdNode || (arms[0] && arms[0].node) || null, feet: L.a.feet, side: [L.a.w * 0.5, L.a.waist[1], 0] };
      if (typeof spec.extra === 'function') {
        try { const r = spec.extra(lab, body, anchors); if (r && r.copy) r.copy([0, 0, 0], 0, 1 / k, body); } catch (e) { warn('extra', 'extra: ' + e.message); }
      }
      c.anchors = anchors;
      // тень и кольцо героя — отдельно от root: вспышка попадания их не красит
      const sr = (L.a.w * 0.62 + 0.1) * k * (plan === 'четвероногий' || plan === 'ползун' ? 1.4 : 1);
      const shRows = [['disc', [sr * 2, 0, sr * 2 * (plan === 'четвероногий' ? 1.4 : 1)], [0, 0, 0], 0, 'тень', { alpha: L.hover > 0.5 ? 0.18 : 0.3, unlit: true, keep: 1, tess: 18 }]];
      if (spec.role === 'герой') shRows.push(['torus', [sr * 2.6, 0.05, sr * 2.6], [0, 0.01, 0], 0, C.light(S.pal.свет, 0.2), { glow: 0.7, unlit: true, keep: 1, thick: 0.05, tess: 24 }]);
      if (boss) shRows.push(['torus', [sr * 3.2, 0.1, sr * 3.2], [0, 0.02, 0], 0, S.pal.огонь, { glow: 0.9, alpha: 0.6, unlit: true, keep: 1, thick: 0.08, tess: 24 }]);
      c.shadow = assemble('тень существа', shRows, ctxOf({ warp: false, colors: P }));
      c.shadow.isPickable = false; lab.noShadow ? lab.noShadow(c.shadow) : 0;
      meshes.forEach(m => { m.isVisible = true; });
      // настоящую тень отбрасывают только герой и босс: остальным хватает пятна — так стая не удваивает вызовы отрисовки
      if (spec.role !== 'герой' && !boss && lab.noShadow) meshes.forEach(m => lab.noShadow(m));
      // роли
      if (spec.role === 'герой') { c.hero = true; K.heroColors.push(P.main); } // герой узнаётся по кругу под ногами и своей примете
      // враг обведён по туловищу и голове: силуэт читается, а лишних вызовов отрисовки немного
      if (spec.role === 'враг' || boss) { if (K.heroColors.some(h => C.dist(h, P.main) < 0.2)) warn('enemy-color', 'Враг почти того же цвета, что герой: игрок их спутает. Дай врагу другой main.'); meshes.filter(m => m.name === 'туловище' || m.name === 'голова').forEach(m => { m.renderOutline = true; m.outlineColor = B.Color3.FromHexString(C.dark(S.pal.огонь, 0.4)); m.outlineWidth = 0.024 / k; }); }
      if (spec.role === 'награда') { c.reward = true; c.autoFace = false; }
      c.face0 = Math.PI; root.rotation.y = spec.facing != null ? spec.facing : Math.PI; // по умолчанию смотрит на камеру
      c.last = root.getAbsolutePosition().clone(); c.vel = new B.Vector3(); c.dist = 0; c.ph = 0;
      c.blinkT = 2 + rnd() * 3; c.glanceT = 1 + rnd() * 2; c.glance = new B.Vector3(); c.fxT = 0; c.kick = new B.Vector3(); c.rnd = rnd;
      Object.assign(c, creatureApi(c));
      K.creatures.push(c);
      return c;
    };
    function creatureApi(c) {
      const ease = (t, dur) => clamp(t / dur, 0, 1);
      return {
        squash(k = 0.3) { if (J('squash')) c.fx.push({ kind: 'sq', k, t: 0 }); return c; },
        stretch(k = 0.3) { if (J('squash')) c.fx.push({ kind: 'sq', k: -k, t: 0 }); return c; },
        windup(sec = 0.4) { c.fx.push({ kind: 'wind', dur: sec, t: 0 }); return c; },
        hurt(from) {
          if (!c.alive) return c;
          if (lab.whiten) lab.whiten(c.root, 0.1);
          if (J('squash')) c.fx.push({ kind: 'sq', k: 0.35, t: 0 });
          if (from && J('shake')) { const p = c.root.getAbsolutePosition(), q = posOf(from), d = p.subtract(q); d.y = 0; if (d.length() > 0.01) c.kick.copyFrom(d.normalize().scale(0.35 / c.k)); }
          c.xT = 0.7; c.showX();
          return c;
        },
        showX() {
          if (c.parts.x || !c.E) return;
          const s = c.E.size, rows = c.E.pos.flatMap(p => [['box', [s * 1.1, s * 0.2, s * 0.1], [p[0], 0, p[2] + s * 0.25], [0, 0, 0.78], 'detail', { keep: 1 }], ['box', [s * 1.1, s * 0.2, s * 0.1], [p[0], 0, p[2] + s * 0.25], [0, 0, -0.78], 'detail', { keep: 1 }]]);
          c.parts.x = c.mk('крестики', rows, c.eyes); c.meshes.push(c.parts.x);
          c.lookNode.setEnabled(false); if (c.parts.eyes) c.parts.eyes.setEnabled(false);
        },
        hideX() { if (!c.parts.x) return; c.parts.x.dispose(); c.meshes.splice(c.meshes.indexOf(c.parts.x), 1); c.parts.x = null; c.lookNode.setEnabled(true); if (c.parts.eyes) c.parts.eyes.setEnabled(true); },
        mood(m) { if (m === c.mood_) return c; c.mood_ = m || null; c.rebuildFace(c.mood_); c.lookNode.scaling.setAll(m === 'испуган' ? 0.7 : 1); return c; },
        look(at) { c.lookAt = at ? posOf(at).clone() : null; return c; },
        celebrate() { c.fx.push({ kind: 'jump', t: 0, dur: 0.7 }); c.mood('рад'); if (lab.burst) lab.burst(c.root.getAbsolutePosition().add(new B.Vector3(0, c.size, 0)), { count: 14, colors: [c.pal.accent, c.pal.belly, '#ffffff'], speed: 4 }); return c; },
        die(o = {}) {
          if (!c.alive) return; c.alive = false;
          const p = c.root.getAbsolutePosition().clone();
          if (lab.burst) lab.burst(p.add(new B.Vector3(0, c.size * 0.5, 0)), { count: 26, colors: o.colors || [c.pal.main, c.pal.second, c.pal.accent], speed: 6 });
          groundMark(p, c.size * 0.5, o.mark || C.dark(c.pal.main, 0.5));
          c.dispose();
        },
        dispose() {
          c.alive = false;
          for (const m of c.meshes) if (!m.isDisposed()) m.dispose();
          if (c.shadow && !c.shadow.isDisposed()) c.shadow.dispose();
          if (!c.root.isDisposed()) c.root.dispose();
          K.creatures = K.creatures.filter(x => x !== c);
        },
        getAbsolutePosition() { return c.root.getAbsolutePosition(); },
        get position() { return c.root.position; },
      };
    }
    function groundMark(p, r, hex) {
      const g = Geo(); g.disc(0, 0, 0, r, r, 12, hex, 1, 0.5, mulberry32(K.n++));
      const m = g.mesh('след'); m.material = fxMat(hex, 0, 0.6); m.position.set(p.x, 0.015, p.z);
      K.marks.push({ m, t: 0 }); while (K.marks.length > 12) { const o = K.marks.shift(); o.m.dispose(); }
    }
    const angLerp = (a, b, k) => { let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI; return a + d * k; };
    function tickCreature(c, dt) {
      if (c.root.isDisposed()) { c.alive = false; return false; }
      c.t += dt;
      const p = c.root.getAbsolutePosition(), t = c.t, g = c.L.gait;
      if (dt > 0) { const v = p.subtract(c.last).scale(1 / dt); c.vel = B.Vector3.Lerp(c.vel, v, Math.min(1, dt * 10)); }
      const dx = p.x - c.last.x, dz = p.z - c.last.z, step = Math.hypot(dx, dz); c.last.copyFrom(p);
      const sp = Math.hypot(c.vel.x, c.vel.z) / Math.max(0.3, c.size), moving = sp > 0.25; c.speed = sp;
      c.dist += step;
      // разворот по движению
      if (c.autoFace && moving && step > 1e-4) c.root.rotation.y = angLerp(c.root.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 10));
      // дыхание, сжатие, удар, прыжок радости
      const tired = c.mood_ === 'устал' ? 0.5 : 1, br = 1 + Math.sin(t * 2.4 * tired) * 0.04;
      let sy = br, sxz = 1 / Math.sqrt(br), py = 0, rx = 0, ry = 0, rz = 0;
      c.fx = c.fx.filter(f => {
        f.t += dt;
        if (f.kind === 'sq') { const e = f.k * Math.exp(-f.t * 9) * Math.cos(f.t * 22); sy *= 1 - e; sxz *= 1 + e * 0.5; return f.t < 0.6; }
        if (f.kind === 'wind') { const u = clamp(f.t / f.dur, 0, 1); rx -= 0.28 * u; sy *= 1 - 0.12 * u; c.meshes.forEach(m => { m.overlayColor = B.Color3.FromHexString(style().pal.огонь); m.overlayAlpha = 0.45 * u; m.renderOverlay = u > 0.02; }); if (f.t >= f.dur) { c.meshes.forEach(m => { m.renderOverlay = false; }); c.fx.push({ kind: 'sq', k: -0.35, t: 0 }); return false; } return true; }
        if (f.kind === 'jump') { const u = f.t / f.dur; py += Math.sin(Math.PI * clamp(u, 0, 1)) * 0.6; ry += u * TAU; return u < 1; }
        return false;
      });
      // походка
      const amp = Math.min(1, sp / 2.2);
      c.ph += dt * (moving ? 4 + sp * 3 : 0);
      const bob = moving ? Math.abs(Math.sin(c.ph)) : 0;
      switch (g) {
        case 'двуногий': case 'робот': py += bob * 0.05 * amp; rz += Math.sin(c.ph) * 0.04 * amp; break;
        case 'каменный': py += bob * 0.04 * amp; rz += Math.sin(c.ph) * 0.09 * amp; break;
        case 'четвероногий': py += bob * 0.03 * amp; rx += Math.sin(c.ph * 2) * 0.03 * amp; break;
        case 'птица': py += moving ? Math.abs(Math.sin(c.ph * 1.5)) * 0.12 * amp : 0; break;
        case 'комок': py += moving ? Math.abs(Math.sin(c.ph)) * 0.35 * amp : 0; if (moving) { const s = Math.sin(c.ph); sy *= 1 + s * 0.12; sxz *= 1 - s * 0.06; } break;
        case 'предмет': rz += Math.sin(c.ph) * 0.15 * amp; py += bob * 0.06 * amp; break;
        case 'водный': py += Math.sin(t * 1.6) * 0.06; rz += Math.sin(t * 1.1) * 0.05; break;
        case 'летучий': py += Math.sin(t * 2) * 0.08; rz += -clamp(c.turn || 0, -1, 1) * 0.3; rx += amp * 0.15; break;
        case 'дух': py += Math.sin(t * 1.7) * 0.1; rz += Math.sin(t * 1.3) * 0.06; break;
        case 'растение': rz += Math.sin(t * 1.4) * 0.05 + Math.sin(c.ph) * 0.1 * amp; break;
        case 'насекомое': py += moving ? Math.abs(Math.sin(c.ph * 2)) * 0.02 : 0; break;
      }
      if (c.reward) { py += Math.sin(t * 2.2) * 0.12; ry += t * 1.2; }
      c.kick.scaleInPlace(Math.max(0, 1 - dt * 7));
      c.pose.position.set(c.kick.x, py / c.k * c.k + c.kick.y, c.kick.z);
      c.pose.position.y = py * c.size;
      c.pose.rotation.set(rx, ry, rz);
      c.pose.scaling.set(c.k * sxz, c.k * sy, c.k * sxz);
      // конечности
      const prevYaw = c.yaw0 == null ? c.root.rotation.y : c.yaw0; c.turn = ((c.root.rotation.y - prevYaw) / Math.max(dt, 1e-3)) * 0.2; c.yaw0 = c.root.rotation.y;
      for (const l of c.limbs) {
        const n = l.node, s = l.side;
        switch (l.kind) {
          case 'leg': n.rotation.x = moving ? Math.sin(c.ph + l.ph) * (g === 'насекомое' ? 0.5 : 0.7) * amp : n.rotation.x * Math.max(0, 1 - dt * 8); break;
          case 'arm': { const cel = c.fx.some(f => f.kind === 'jump'); n.rotation.x = cel ? -2.6 : moving ? -Math.sin(c.ph + (s > 0 ? 0 : Math.PI)) * 0.6 * amp : Math.sin(t * 2.4) * 0.05; n.rotation.z = s * (cel ? 0.3 : 0.12 + (c.mood_ === 'рад' ? Math.abs(Math.sin(t * 6)) * 0.4 : 0)); break; }
          case 'wing': { const fast = g === 'насекомое' ? 30 : g === 'птица' ? (moving ? 14 : 3) : 6, a = g === 'насекомое' ? 0.5 : g === 'птица' ? (moving ? 0.9 : 0.12) : 0.35; n.rotation.z = s * (Math.sin(t * fast) * a + (g === 'птица' && !moving ? -0.1 : 0)); break; }
          case 'tail': n.rotation.y = Math.sin(t * (g === 'водный' ? 6 : 3) + sp) * (g === 'водный' ? 0.45 : 0.3) * (0.5 + amp); n.rotation.x = c.mood_ === 'рад' ? -0.3 : c.mood_ === 'испуган' ? 0.4 : 0; break;
          case 'fin': n.rotation.y = s * Math.sin(t * 5 + l.ph) * 0.4; break;
          case 'wheel': n.rotation.x += step / Math.max(0.05, (l.r || 0.2) * c.k) * (c.backward ? -1 : 1); break;
          case 'tent': n.rotation.x = Math.sin(t * 3 + l.ph) * 0.35; n.rotation.z = Math.cos(t * 2.6 + l.ph) * 0.35; break;
        }
      }
      // глаза: моргание, взгляд, крестики после удара
      if (c.xT > 0) { c.xT -= dt; if (c.xT <= 0) c.hideX(); }
      c.blinkT -= dt;
      const blink = c.blinkT < 0.12 && c.blinkT > 0;
      if (c.blinkT <= 0) c.blinkT = 2 + c.rnd() * 3;
      c.eyes.scaling.y = blink ? 0.12 : 1;
      if (c.lookNode && c.E) {
        let tx = 0, ty = 0;
        const target = c.lookAt || (!moving ? null : null);
        if (target) {
          c.headNode.computeWorldMatrix(true);
          const inv = c.headNode.getWorldMatrix().clone().invert(), lp = B.Vector3.TransformCoordinates(target, inv), len = Math.max(0.01, lp.length());
          tx = clamp(lp.x / len, -1, 1); ty = clamp(lp.y / len, -1, 1);
        } else if (!moving) {
          c.glanceT -= dt; if (c.glanceT <= 0) { c.glanceT = 1.5 + c.rnd() * 2.5; c.glance.set((c.rnd() - 0.5) * 2, (c.rnd() - 0.5) * 0.8, 0); }
          tx = c.glance.x; ty = c.glance.y;
        }
        const m = c.E.size * 0.2;
        c.lookNode.position.x = lerp(c.lookNode.position.x, tx * m, Math.min(1, dt * 12));
        c.lookNode.position.y = lerp(c.lookNode.position.y, ty * m, Math.min(1, dt * 12));
        if (c.mood_ === 'испуган') c.pose.position.x += Math.sin(t * 40) * 0.01 * c.size;
      }
      // мигание героя, пока он неуязвим после удара
      if (c.hero) { const on = !(lab.invuln > 0) || Math.floor(lab.invuln * 12) % 2 === 0; if (c.pose.isEnabled() !== on) c.pose.setEnabled(on); }
      // тень на земле под существом
      if (c.shadow) { const gy = c.ground == null ? p.y : c.ground; c.shadow.position.set(p.x, gy + 0.02, p.z); const lift = Math.max(0, p.y + c.pose.position.y - gy); const sc = 1 / (1 + lift * 0.25); c.shadow.scaling.set(sc, 1, sc); c.shadow.rotation.y = c.root.rotation.y; }
      // ползун: сегменты по следу
      if (c.segs) {
        if (!c.trail.length || Math.hypot(p.x - c.trail[0].x, p.z - c.trail[0].z) > 0.05) c.trail.unshift(p.clone());
        const gap = c.L.segS * c.k * 0.75;
        let need = gap, i = 0, acc = 0;
        for (let j = 1; j < c.trail.length && i < c.segs.length; j++) {
          const a = c.trail[j - 1], b = c.trail[j], d = Math.hypot(a.x - b.x, a.z - b.z);
          while (acc + d >= need && i < c.segs.length) { const u = (need - acc) / Math.max(d, 1e-6), x = lerp(a.x, b.x, u), z = lerp(a.z, b.z, u); const s = c.segs[i]; s.position.set(x, p.y + Math.abs(Math.sin(c.ph - i * 0.8)) * 0.05 * amp, z); s.rotation.y = Math.atan2(a.x - b.x, a.z - b.z); i++; need += gap; }
          acc += d;
        }
        for (; i < c.segs.length; i++) { const s = c.segs[i], bk = c.root.rotation.y + Math.PI; s.position.set(p.x + Math.sin(bk) * gap * (i + 1), p.y, p.z + Math.cos(bk) * gap * (i + 1)); }
        if (c.trail.length > 400) c.trail.length = 400;
      }
      return true;
    }

    /* ---------------- стая: много лёгких копий одного существа ---------------- */
    lab.creatureKind = function (spec = {}) {
      need();
      const proto = lab.creature(Object.assign({}, spec, { role: spec.role === 'герой' ? null : spec.role, autoFace: false }));
      // запекаем позу покоя в один меш: копии — тонкие экземпляры
      proto.root.position.set(0, 0, 0); proto.root.rotation.y = 0; proto.root.computeWorldMatrix(true);
      const parts = [];
      for (const m of proto.meshes) { if (m.isDisposed() || !m.isEnabled()) continue; m.computeWorldMatrix(true); const cl = m.clone('стая', null, true); cl.parent = null; cl.makeGeometryUnique(); cl.bakeTransformIntoVertices(m.getWorldMatrix()); cl.position.setAll(0); cl.rotation.setAll(0); cl.scaling.setAll(1); cl.renderOutline = false; parts.push(cl); }
      const sh = proto.shadow.clone('тень стаи'); sh.renderOutline = false;
      proto.dispose(); K.creatures = K.creatures.filter(x => x !== proto);
      const host = parts.length > 1 ? B.Mesh.MergeMeshes(parts, true, true, undefined, false, true) : parts[0];
      host.name = 'стая:' + (spec.plan || ''); host.isPickable = false; host.alwaysSelectAsActiveMesh = true;
      sh.isVisible = true; sh.alwaysSelectAsActiveMesh = true; lab.noShadow ? lab.noShadow(sh) : 0;
      const kind = { host, shadow: sh, copies: [], cap: 0, M: null, MS: null, COL: null, spec, size: proto.size };
      const grow = n => { if (n <= kind.cap) return; kind.cap = Math.max(16, kind.cap * 2, n); kind.M = new Float32Array(kind.cap * 16); kind.MS = new Float32Array(kind.cap * 16); kind.COL = new Float32Array(kind.cap * 4).fill(1); host.thinInstanceSetBuffer('matrix', kind.M, 16, false); host.thinInstanceSetBuffer('color', kind.COL, 4, false); sh.thinInstanceSetBuffer('matrix', kind.MS, 16, false); };
      grow(16); host.thinInstanceCount = 0; sh.thinInstanceCount = 0;
      kind.spawn = (where, opts = {}) => {
        if (opts.full) return lab.creature(Object.assign({}, spec, opts, { at: where }));
        if (kind.copies.length >= 400) { warn('kind-cap', 'creatureKind: больше 400 копий — новых не будет.'); return null; }
        const v = {
          position: posOf(where).clone(), rotation: new B.Vector3(0, opts.facing != null ? opts.facing : Math.PI, 0), scaling: new B.Vector3(1, 1, 1),
          alive: true, autoFace: opts.autoFace !== false, t: (K.n++ * 2.399) % 10, ph: 0, fx: [], white: 0, last: null, kick: new B.Vector3(),
          getAbsolutePosition() { return v.position; },
          whiten(sec = 0.1) { if (J('whiten')) v.white = sec; return v; },
          squash(k = 0.3) { if (J('squash')) v.fx.push({ k, t: 0 }); return v; },
          stretch(k = 0.3) { return v.squash(-k); },
          hurt(from) { v.whiten(); v.squash(0.35); if (from && J('shake')) { const d = v.position.subtract(posOf(from)); d.y = 0; if (d.length() > 0.01) v.kick.copyFrom(d.normalize().scale(0.3 * kind.size)); } return v; },
          die(o = {}) { if (!v.alive) return; if (lab.burst) lab.burst(v.position.add(new B.Vector3(0, kind.size * 0.5, 0)), { count: 18, colors: o.colors || [proto.pal.main, proto.pal.second, proto.pal.accent], speed: 5 }); groundMark(v.position, kind.size * 0.4, o.mark || C.dark(proto.pal.main, 0.5)); v.dispose(); },
          dispose() { v.alive = false; kind.copies = kind.copies.filter(x => x !== v); },
        };
        kind.copies.push(v); grow(kind.copies.length);
        return v;
      };
      kind.each = f => kind.copies.slice().forEach(f);
      kind.clear = () => { kind.copies = []; };
      K.kinds.push(kind);
      return kind;
    };
    function tickKind(kind, dt) {
      if (kind.host.isDisposed()) return false;
      const mat = new B.Matrix(), q = new B.Quaternion(), sc = new B.Vector3(), pos = new B.Vector3(), g = kind.spec.plan;
      kind.copies.forEach((v, i) => {
        v.t += dt;
        if (!v.last) v.last = v.position.clone();
        const dx = v.position.x - v.last.x, dz = v.position.z - v.last.z, step = Math.hypot(dx, dz); v.last.copyFrom(v.position);
        const sp = dt > 0 ? step / dt / kind.size : 0, moving = sp > 0.25;
        if (v.autoFace && moving) v.rotation.y = angLerp(v.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 10));
        v.ph += dt * (moving ? 4 + sp * 3 : 0);
        const br = 1 + Math.sin(v.t * 2.4) * 0.04;
        let sy = br, sxz = 1 / Math.sqrt(br), py = 0;
        v.fx = v.fx.filter(f => { f.t += dt; const e = f.k * Math.exp(-f.t * 9) * Math.cos(f.t * 22); sy *= 1 - e; sxz *= 1 + e * 0.5; return f.t < 0.6; });
        if (moving) py = Math.abs(Math.sin(v.ph)) * (g === 'комок' ? 0.3 : 0.06) * kind.size;
        if (g === 'летучий' || g === 'дух' || g === 'водный') py += Math.sin(v.t * 1.8) * 0.08 * kind.size;
        v.kick.scaleInPlace(Math.max(0, 1 - dt * 7));
        sc.set(v.scaling.x * sxz, v.scaling.y * sy, v.scaling.z * sxz);
        B.Quaternion.FromEulerAnglesToRef(v.rotation.x, v.rotation.y, v.rotation.z + (moving && g !== 'четвероногий' ? Math.sin(v.ph) * 0.05 : 0), q);
        pos.set(v.position.x + v.kick.x, v.position.y + py, v.position.z + v.kick.z);
        B.Matrix.ComposeToRef(sc, q, pos, mat); mat.copyToArray(kind.M, i * 16);
        const s2 = 1 / (1 + py * 0.3);
        B.Matrix.ComposeToRef(new B.Vector3(v.scaling.x * s2, 1, v.scaling.z * s2), B.Quaternion.FromEulerAngles(0, v.rotation.y, 0), new B.Vector3(v.position.x, (kind.spec.ground == null ? 0 : kind.spec.ground) + 0.02, v.position.z), mat); mat.copyToArray(kind.MS, i * 16);
        const w = v.white > 0 ? 3 : 1; if (v.white > 0) v.white -= dt; kind.COL.set([w, w, w, 1], i * 4);
      });
      kind.host.thinInstanceCount = kind.copies.length; kind.shadow.thinInstanceCount = kind.copies.length;
      if (kind.copies.length) { kind.host.thinInstanceBufferUpdated('matrix'); kind.host.thinInstanceBufferUpdated('color'); kind.shadow.thinInstanceBufferUpdated('matrix'); }
      return true;
    }

    /* ---------------- кадр набора: всё живое без кода игры ---------------- */
    function tick(dt) {
      if (!K) return;
      K.time += dt;
      tickSways(dt);
      K.creatures = K.creatures.filter(c => tickCreature(c, dt));
      K.kinds = K.kinds.filter(k => tickKind(k, dt));
      K.ambients = K.ambients.filter(a => tickAmbient(a, dt));
      const cam = lab.camera;
      // вид сбоку: дальние слои отстают от камеры (параллакс), а узор повторяется с периодом wrap — фон не кончается на длинной улице
      for (const b of K.backs) {
        if (!b.par || !cam || !cam.target || b.mesh.isDisposed()) continue;
        let x = cam.target.x * b.par;
        if (b.wrap) x += b.wrap * Math.round((cam.target.x - x) / b.wrap);
        b.mesh.position.x = x;
      }
      K.marks.forEach(o => { o.t += dt; if (o.m.material) o.m.material.alpha = 0.6 * Math.max(0, 1 - o.t / 6); });
    }
    lab._kitScene = s => { fresh(s); };
    lab._kitTick = dt => { if (K && K.scene === lab.scene && lab.scene) tick(dt); };
    return { tick, need, PROPS, MOODS, FLOORS, EDGES, BACKS, AMBIENTS, PLANS, HOLDS, variantsOf };
  }

  window.LabKit = { make: makeKit, MOODS, SHAPES, ROLES, C, derivePalette };
  if (window.__lab && window.__lab.lab) makeKit(window.__lab.lab);
})();
