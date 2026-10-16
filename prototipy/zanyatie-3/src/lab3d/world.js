/* ===== Мир: палитры, лоупольные модели, декорации ===== */
const PALS = [
  { sky: ['#7fc8ff', '#e9f6ff'], fog: '#cfe9ff', g: ['#5aa84a', '#6fbd57', '#4f9a43'], hill: '#7c9c62', rock: '#e8e2d0', acc: '#ffd23f', item: '#ffcf3a', foe: '#b8402e', sun: '#fff4dc', si: 1.25, hi: 0.8, props: ['pine', 'tree', 'rock', 'house'], line: '#fff6dc' },
  { sky: ['#07031a', '#2a0c4a'], fog: '#1a0a33', g: ['#1a1238', '#22164a', '#160f30'], hill: '#2c1c5c', rock: '#3b2a7a', acc: '#3dfcff', item: '#3dfcff', foe: '#ff3d8a', sun: '#b9a6ff', si: 0.7, hi: 0.55, props: ['crystal', 'crystal', 'rock', 'lantern'], line: '#ff3df2', glow: 1 },
  { sky: ['#3c1a52', '#ff9a62'], fog: '#e08a6a', g: ['#a0584a', '#b8664e', '#8e4c44'], hill: '#6b3550', rock: '#d8a088', acc: '#ffcf8a', item: '#fff1b8', foe: '#3b1638', sun: '#ffb070', si: 1.1, hi: 0.6, props: ['tree', 'rock', 'pine', 'house'], line: '#ffcf8a' },
  { sky: ['#02040e', '#14224a'], fog: '#0b1430', g: ['#18284a', '#1d3056', '#142240'], hill: '#223a66', rock: '#4a5a88', acc: '#9fc0ff', item: '#e6f0ff', foe: '#9a7bff', sun: '#a9c0ff', si: 0.55, hi: 0.45, props: ['pine', 'rock', 'lantern', 'house'], line: '#9fc0ff', glow: 1 },
  { sky: ['#ffb3d9', '#fff3fa'], fog: '#ffe3f1', g: ['#ffd1e6', '#c9f5e2', '#fff0c9'], hill: '#ffc0dc', rock: '#ffffff', acc: '#ff3d8a', item: '#7a5cff', foe: '#e8245a', sun: '#ffffff', si: 1.1, hi: 0.95, props: ['candy', 'mushroom', 'tree', 'candy'], line: '#ff6aa8' },
  { sky: ['#f2a65a', '#fde7c0'], fog: '#f6d6a6', g: ['#e6b877', '#dcaa66', '#efc488'], hill: '#c9864a', rock: '#b8643c', acc: '#ffef9a', item: '#3fd2c7', foe: '#7a2e1c', sun: '#fff0c8', si: 1.35, hi: 0.7, props: ['cactus', 'rock', 'cactus', 'house'], line: '#fff0c8' },
  { sky: ['#5fb6e6', '#e8fbff'], fog: '#dff6ff', g: ['#f2fbff', '#dff2fb', '#e9f7ff'], hill: '#cfe9f5', rock: '#9cc8e0', acc: '#3fa9ff', item: '#ff5d9e', foe: '#244a8a', sun: '#ffffff', si: 1.1, hi: 0.9, props: ['ice', 'pine', 'ice', 'rock'], line: '#3fa9ff' },
  { sky: ['#0b4a6a', '#3fc6d2'], fog: '#1f8aa0', g: ['#e8d7a6', '#dccb98', '#f0e0b2'], hill: '#2a8f9a', rock: '#6fc2b8', acc: '#ffe066', item: '#ffe066', foe: '#ff6b5b', sun: '#d8fbff', si: 0.95, hi: 0.8, props: ['coral', 'coral', 'rock', 'kelp'], line: '#ffe066' },
  { sky: ['#140606', '#5a1a0a'], fog: '#3a0d06', g: ['#2a201e', '#332624', '#221a19'], hill: '#3a2420', rock: '#4a3430', acc: '#ff8a2a', item: '#ffd23f', foe: '#ff4d2a', sun: '#ff9a5a', si: 0.9, hi: 0.5, props: ['rock', 'rock', 'crystal', 'pine'], line: '#ff8a2a', glow: 1 },
  { sky: ['#c98a5a', '#f6dcb8'], fog: '#e8c39a', g: ['#b8762e', '#a8642a', '#c98a3a'], hill: '#8a5a2a', rock: '#9a8a7a', acc: '#ffe08a', item: '#e83a2a', foe: '#4a2a5a', sun: '#ffe0b0', si: 1.15, hi: 0.7, props: ['tree', 'mushroom', 'pine', 'rock'], line: '#ffe08a' },
  { sky: ['#03040c', '#16193a'], fog: '#10132a', g: ['#6c6a80', '#77758c', '#615f74'], hill: '#4a4860', rock: '#b8b6c8', acc: '#5fe0ff', item: '#d08aff', foe: '#ff5a3c', sun: '#ffe8cc', si: 1.25, hi: 0.55, props: ['crater', 'dome', 'antenna', 'solar', 'crater', 'rock'], line: '#5fe0ff', glow: 1, stars: 1 },
];
const P = () => PALS[ci('pal')] || PALS[0];
const MATS = {};
function mat(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (!MATS[key]) MATS[key] = new THREE.MeshStandardMaterial(Object.assign({ color, flatShading: true, roughness: 0.85, metalness: 0.02 }, o.emissive ? { emissive: o.emissive, emissiveIntensity: o.ei ?? 0.8 } : {}, o.opacity != null ? { transparent: true, opacity: o.opacity } : {}, o.side ? { side: o.side } : {}));
  return MATS[key];
}
const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
function jitter(geo, amt) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); p.setXYZ(i, x + (hash(x, y, z) - 0.5) * amt, y + (hash(y, z, x) - 0.5) * amt, z + (hash(z, x, y) - 0.5) * amt); }
  geo.computeVertexNormals(); return geo;
}
function M(geo, color, x = 0, y = 0, z = 0, o = {}) {
  const m = new THREE.Mesh(geo, o.mat || mat(color, o)); m.position.set(x, y, z);
  if (o.s) Array.isArray(o.s) ? m.scale.set(...o.s) : m.scale.setScalar(o.s);
  if (o.r) m.rotation.set(...o.r);
  m.castShadow = o.shadow !== false; m.receiveShadow = true; return m;
}
const G = {
  ico: (r = 1, d = 0) => new THREE.IcosahedronGeometry(r, d), dod: (r = 1) => new THREE.DodecahedronGeometry(r, 0), oct: (r = 1) => new THREE.OctahedronGeometry(r, 0), tet: (r = 1) => new THREE.TetrahedronGeometry(r, 0),
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d), cone: (r, h, n = 6) => new THREE.ConeGeometry(r, h, n), cyl: (a, b, h, n = 7) => new THREE.CylinderGeometry(a, b, h, n), sph: (r, w = 7, h = 5) => new THREE.SphereGeometry(r, w, h), tor: (r, t, a = 5, b = 10) => new THREE.TorusGeometry(r, t, a, b),
};
let glowTex = null;
function glow(color, size = 2.2) {
  if (!glowTex) { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); glowTex = new THREE.CanvasTexture(c); }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(size); return s;
}

/* ---------- декорации ---------- */
const PROPS = {
  crater(p) { const g = new THREE.Group(); for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283; g.add(M(jitter(G.dod(0.55 + hash(i, 1, 1) * 0.3), 0.25), shade(p.g[0], -0.08), Math.cos(a) * 1.7, 0.1, Math.sin(a) * 1.7, { s: [1, 0.45, 1] })); } g.add(M(G.cyl(1.5, 1.2, 0.08, 9), shade(p.g[0], -0.22), 0, 0.02, 0, { shadow: false })); return g; },
  dome(p) { const g = new THREE.Group(); g.add(M(G.cyl(1.9, 2.1, 0.5, 10), '#e8ecf4', 0, 0.25, 0)); g.add(M(new THREE.SphereGeometry(1.75, 10, 6, 0, 6.283, 0, Math.PI / 2), '#8fe8ff', 0, 0.5, 0, { opacity: 0.45, emissive: '#5fe0ff', ei: 0.35 })); g.add(M(G.box(0.7, 0.9, 0.5), '#ffb347', 0, 0.95, 0.2, { emissive: '#ff9a2a', ei: 0.9 })); g.add(M(G.box(0.6, 0.7, 1.4), '#d8dce8', 2.2, 0.45, 0)); g.add(M(G.box(0.3, 0.3, 0.05), '#ffd37a', 2.2, 0.55, 0.72, { emissive: '#ffb84a', ei: 1.3 })); return g; },
  antenna(p) { const g = new THREE.Group(); g.add(M(G.cyl(0.08, 0.12, 3.2, 5), '#d8dce8', 0, 1.6, 0)); const d = M(new THREE.SphereGeometry(0.9, 9, 5, 0, 6.283, 0, 1.1), '#f2f4fa', 0, 3.1, 0.3, { r: [-1.1, 0, 0], side: THREE.DoubleSide }); g.add(d); g.add(M(G.sph(0.12), '#ff4d6e', 0, 3.35, 0, { emissive: '#ff4d6e', ei: 1.5 })); return g; },
  solar(p) { const g = new THREE.Group(); g.add(M(G.cyl(0.08, 0.08, 1.1, 5), '#9aa0b0', 0, 0.55, 0)); [-1, 1].forEach(s => { g.add(M(G.box(1.6, 0.06, 1.1), '#2a4fd8', s * 0.9, 1.15, 0, { r: [0.35, 0, 0], emissive: '#1a3ab8', ei: 0.35 })); g.add(M(G.box(1.62, 0.02, 0.04), '#c8d0e8', s * 0.9, 1.19, 0, { r: [0.35, 0, 0] })); }); return g; },
  pine(p) { const g = new THREE.Group(); g.add(M(G.cyl(0.18, 0.25, 0.8, 5), '#6b4a2e', 0, 0.4, 0)); [[1.3, 1.6, 1.2], [1.0, 1.3, 2.0], [0.7, 1.0, 2.7]].forEach(([r, h, y]) => g.add(M(jitter(G.cone(r, h, 7), 0.12), p.hill === '#7c9c62' ? '#2f7a45' : shade(p.g[0], -0.25), 0, y, 0))); return g; },
  tree(p) { const g = new THREE.Group(); g.add(M(G.cyl(0.18, 0.28, 1.2, 5), '#7a5234', 0, 0.6, 0)); g.add(M(jitter(G.ico(1.1, 0), 0.3), shade(p.g[1], 0.08), 0, 1.9, 0)); g.add(M(jitter(G.ico(0.7, 0), 0.2), shade(p.g[1], 0.2), 0.5, 2.4, 0.2)); return g; },
  rock(p) { return M(jitter(G.dod(0.9), 0.35), p.rock, 0, 0.45, 0, { s: [1.2, 0.8, 1] }); },
  house(p) { const g = new THREE.Group(); g.add(M(G.box(1.8, 1.2, 1.5), '#efe3c8', 0, 0.6, 0)); g.add(M(G.cone(1.5, 1, 4), '#b34a32', 0, 1.7, 0, { r: [0, Math.PI / 4, 0] })); g.add(M(G.box(0.4, 0.6, 0.05), '#5a3a22', 0, 0.3, 0.76)); g.add(M(G.box(0.35, 0.3, 0.05), '#ffd37a', 0.55, 0.75, 0.76, { emissive: '#ffb84a', ei: p.glow ? 1.2 : 0.2 })); return g; },
  crystal(p) { const g = new THREE.Group(); for (let i = 0; i < 3; i++) g.add(M(G.oct(0.5), p.line, (i - 1) * 0.5, 0.9 + i % 2 * 0.3, (i % 2) * 0.3, { s: [0.6, 2.2, 0.6], r: [0, i, (i - 1) * 0.3], emissive: p.line, ei: 0.7 })); return g; },
  lantern(p) { const g = new THREE.Group(); g.add(M(G.cyl(0.08, 0.1, 2.2, 5), '#3a3048', 0, 1.1, 0)); g.add(M(G.oct(0.32), p.acc, 0, 2.35, 0, { emissive: p.acc, ei: 1.4 })); const s = glow(p.acc, 2.4); s.position.y = 2.35; g.add(s); return g; },
  candy(p) { const g = new THREE.Group(); g.add(M(G.cyl(0.08, 0.08, 1.6, 5), '#ffffff', 0, 0.8, 0)); g.add(M(G.cyl(0.8, 0.8, 0.25, 9), pick(['#ff7ab8', '#7ad9ff', '#ffe066', '#a98bff']), 0, 1.7, 0, { r: [Math.PI / 2, 0, 0] })); return g; },
  mushroom(p) { const g = new THREE.Group(); g.add(M(G.cyl(0.25, 0.35, 1, 6), '#f4ead6', 0, 0.5, 0)); g.add(M(G.sph(0.9, 8, 4), pick(['#e8443a', '#ff7ab8', '#ffb347']), 0, 1.1, 0, { s: [1, 0.55, 1] })); return g; },
  cactus(p) { const g = new THREE.Group(), c = '#4f9a54'; g.add(M(G.cyl(0.3, 0.35, 2.2, 7), c, 0, 1.1, 0)); g.add(M(G.cyl(0.18, 0.2, 0.9, 6), c, 0.5, 1.3, 0)); g.add(M(G.cyl(0.18, 0.2, 0.6, 6), c, -0.45, 1.0, 0)); g.add(M(G.cyl(0.16, 0.16, 0.5, 6), c, 0.5, 1.75, 0, { r: [0, 0, 0] })); return g; },
  ice(p) { const g = new THREE.Group(); for (let i = 0; i < 3; i++) g.add(M(G.cone(0.4 + i * 0.1, 2 - i * 0.4, 5), '#bfe8ff', (i - 1) * 0.5, 1 - i * 0.2, i * 0.2, { opacity: 0.85, r: [0, 0, (i - 1) * 0.25] })); return g; },
  coral(p) { const g = new THREE.Group(), c = pick(['#ff6b8a', '#ff9f43', '#c86bff']); g.add(M(G.cyl(0.15, 0.22, 1.4, 5), c, 0, 0.7, 0)); g.add(M(G.cyl(0.12, 0.15, 0.9, 5), c, 0.35, 1.2, 0, { r: [0, 0, -0.6] })); g.add(M(G.cyl(0.12, 0.15, 0.8, 5), c, -0.3, 1.1, 0.1, { r: [0.2, 0, 0.6] })); return g; },
  kelp(p) { const g = new THREE.Group(); for (let i = 0; i < 4; i++) g.add(M(G.box(0.18, 0.7, 0.05), '#2fa86a', Math.sin(i) * 0.1, 0.35 + i * 0.65, 0, { r: [0, 0, Math.sin(i * 1.7) * 0.25] })); return g; },
};
const pick = a => a[Math.floor(Math.random() * a.length)];
function shade(hex, k) { const c = new THREE.Color(hex); const h = {}; c.getHSL(h); c.setHSL(h.h, h.s, Math.max(0, Math.min(1, h.l + k))); return '#' + c.getHexString(); }

let world = null, skyMesh = null;
function buildWorld() {
  if (world) scene.remove(world);
  world = new THREE.Group(); scene.add(world);
  const p = P();
  // небо
  if (!skyMesh) { skyMesh = new THREE.Mesh(new THREE.SphereGeometry(180, 16, 8), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { a: { value: new THREE.Color() }, b: { value: new THREE.Color() } }, vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }', fragmentShader: 'uniform vec3 a; uniform vec3 b; varying float h; void main(){ gl_FragColor = vec4(mix(b, a, clamp(h*1.6+0.15,0.0,1.0)),1.0); }' })); scene.add(skyMesh); }
  skyMesh.material.uniforms.a.value.set(p.sky[0]); skyMesh.material.uniforms.b.value.set(p.sky[1]);
  scene.fog = new THREE.Fog(p.fog, 45, 120);
  hemi.color.set(p.sky[1]); hemi.groundColor.set(p.g[0]); hemi.intensity = p.hi; sun.color.set(p.sun); sun.intensity = p.si;
  // земля: арена ровная, вокруг холмы
  const geo = new THREE.PlaneGeometry(130, 90, 52, 36); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), out = Math.max(0, Math.max(Math.abs(x) - AX - 2, (Math.abs(z) - AZ - 2) * 1.4));
    pos.setY(i, (hash(x, 0, z) - 0.5) * 0.18 + Math.pow(out, 1.35) * 0.35 * (0.6 + hash(z, 1, x) * 0.8));
  }
  const ng = geo.toNonIndexed(); ng.computeVertexNormals();
  const cols = [], cA = p.g.map(c => new THREE.Color(c)), np = ng.attributes.position;
  for (let i = 0; i < np.count; i += 3) { const y = (np.getY(i) + np.getY(i + 1) + np.getY(i + 2)) / 3, c = (y > 2.5 ? new THREE.Color(p.hill) : cA[Math.floor(hash(np.getX(i), np.getZ(i), 3) * cA.length)]).clone(); c.offsetHSL(0, 0, (hash(i, 2, 7) - 0.5) * 0.04); for (let k = 0; k < 3; k++) cols.push(c.r, c.g, c.b); }
  ng.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const ground = new THREE.Mesh(ng, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 })); ground.receiveShadow = true; world.add(ground);
  // граница арены: камешки и светящаяся линия
  const lineMat = new THREE.MeshBasicMaterial({ color: p.line, transparent: true, opacity: 0.55 });
  for (const [w, d, x, z] of [[AX * 2, 0.12, 0, -AZ], [AX * 2, 0.12, 0, AZ], [0.12, AZ * 2, -AX, 0], [0.12, AZ * 2, AX, 0]]) { const l = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lineMat); l.rotation.x = -Math.PI / 2; l.position.set(x, 0.04, z); world.add(l); }
  for (let i = 0; i < 70; i++) { const t = i / 70 * 2, side = Math.floor(t * 2) % 4; const per = 2 * (AX * 2 + AZ * 2), d = i / 70 * per; let x, z; if (d < AX * 2) { x = -AX + d; z = -AZ - 0.7; } else if (d < AX * 2 + AZ * 2) { x = AX + 0.7; z = -AZ + d - AX * 2; } else if (d < AX * 4 + AZ * 2) { x = AX - (d - AX * 2 - AZ * 2); z = AZ + 0.7; } else { x = -AX - 0.7; z = AZ - (d - AX * 4 - AZ * 2); } world.add(M(jitter(G.dod(0.35 + hash(i, 1, 1) * 0.25), 0.15), p.rock, x, 0.2, z, { r: [i, i * 2, 0] })); }
  // декорации вокруг
  let n = 0;
  for (let i = 0; i < 260 && n < 120; i++) {
    const x = (hash(i, 9, 1) - 0.5) * 110, z = (hash(i, 3, 5) - 0.5) * 80;
    if (Math.abs(x) < AX + 2.5 && Math.abs(z) < AZ + 2.5) continue;
    if (z > AZ + 10 && Math.abs(x) < 30) continue; // не загораживать камеру
    const kind = p.props[Math.floor(hash(i, 7, 7) * p.props.length)], o = PROPS[kind](p);
    o.position.set(x, groundY(x, z), z); o.rotation.y = hash(i, 4, 4) * 6.28; o.scale.setScalar(0.8 + hash(i, 5, 5) * 0.9); world.add(o); n++;
  }
  if (p.stars) { const n = 900, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const u = hash(i, 1, 9) * 2 - 1, a = hash(i, 8, 2) * 6.283, r = 170, s = Math.sqrt(1 - u * u); pos[i * 3] = Math.cos(a) * s * r; pos[i * 3 + 1] = Math.abs(u) * r * 0.9 + 8; pos[i * 3 + 2] = Math.sin(a) * s * r; } const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); world.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 0.9, fog: false }))); const earth = new THREE.Group(); earth.add(new THREE.Mesh(new THREE.IcosahedronGeometry(9, 2), new THREE.MeshBasicMaterial({ color: '#2f7ae0', fog: false }))); for (let i = 0; i < 7; i++) { const m = new THREE.Mesh(jitter(new THREE.IcosahedronGeometry(3 + hash(i, 3, 3) * 2, 0), 1), new THREE.MeshBasicMaterial({ color: i < 4 ? '#4fbf6a' : '#ffffff', fog: false })); const a = hash(i, 5, 1) * 6.283, b = hash(i, 6, 2) * 2 - 1; m.position.set(Math.cos(a) * 7, b * 6, Math.sin(a) * 7); m.scale.setScalar(0.8); earth.add(m); } const eg = glow('#7ab8ff', 30); eg.material.fog = false; earth.add(eg); earth.position.set(-55, 62, -140); world.add(earth); }
  if (DESIGN.decor) DESIGN.decor(world, p);
  // дальние горы
  for (let i = 0; i < 14; i++) { const a = -Math.PI * 0.95 + i / 13 * Math.PI * 0.9, r = 75 + hash(i, 1, 2) * 15, h = 14 + hash(i, 2, 1) * 16; world.add(M(jitter(G.cone(9 + hash(i, 3, 3) * 6, h, 6), 1.2), shade(p.hill, -0.08), Math.cos(a) * r, h / 2 - 1, Math.sin(a) * r * 0.7, { shadow: false })); }
}
function groundY(x, z) { const out = Math.max(0, Math.max(Math.abs(x) - AX - 2, (Math.abs(z) - AZ - 2) * 1.4)); return Math.pow(out, 1.35) * 0.35 * 0.9; }

/* ---------- герой: у каждого облика свои детали ---------- */
function eyes(g, y, z, sp = 0.18, r = 0.09) { [-1, 1].forEach(s => { g.add(M(G.sph(r * 1.5, 6, 4), '#ffffff', s * sp, y, z, { shadow: false })); g.add(M(G.sph(r, 6, 4), '#14101e', s * sp, y, z + r * 0.9, { shadow: false })); }); }
function makeHero(look) {
  const g = new THREE.Group(), b = new THREE.Group(); g.add(b); g.userData.body = b;
  const add = (...a) => { const m = M(...a); b.add(m); return m; };
  switch (look) {
    case 0: add(G.ico(0.55), '#f08a2e', 0, 0.6, 0, { s: [0.9, 0.85, 1.1] }); add(G.ico(0.42), '#f08a2e', 0, 1.15, 0.35); add(G.cone(0.2, 0.4, 4), '#ffffff', 0, 1.08, 0.75, { r: [Math.PI / 2, 0, 0] }); add(G.sph(0.06), '#14101e', 0, 1.08, 0.95); [-1, 1].forEach(s => add(G.cone(0.14, 0.38, 4), '#f08a2e', s * 0.22, 1.55, 0.3)); add(G.cone(0.25, 0.9, 5), '#f08a2e', 0, 0.75, -0.75, { r: [-1.1, 0, 0] }); add(G.cone(0.15, 0.3, 5), '#ffffff', 0, 0.98, -1.15, { r: [-1.1, 0, 0] }); eyes(b, 1.25, 0.65, 0.17); break;
    case 1: add(G.ico(0.6), '#4fbf6a', 0, 0.65, 0, { s: [0.9, 0.9, 1.1] }); add(G.ico(0.45), '#4fbf6a', 0, 1.25, 0.35); add(G.box(0.4, 0.2, 0.35), '#4fbf6a', 0, 1.15, 0.75); [-1, 1].forEach(s => { add(G.cone(0.08, 0.35, 4), '#fff1c8', s * 0.2, 1.65, 0.3, { r: [-0.4, 0, s * 0.3] }); const w = add(G.cone(0.5, 0.9, 3), '#ff8a5a', s * 0.6, 1.0, -0.1, { r: [0, 0, s * 1.3], s: [1, 1, 0.2] }); w.userData.wing = s; }); add(G.cone(0.2, 0.9, 5), '#4fbf6a', 0, 0.6, -0.85, { r: [-1.3, 0, 0] }); add(G.ico(0.35), '#ffe39a', 0, 0.55, 0.35, { s: [0.9, 1, 0.5] }); eyes(b, 1.35, 0.7); break;
    case 2: add(G.box(0.9, 0.8, 0.7), '#b8c4d8', 0, 0.7, 0); add(G.box(0.7, 0.55, 0.6), '#d8e0ee', 0, 1.4, 0); add(G.box(0.55, 0.16, 0.05), '#3dfcff', 0, 1.45, 0.31, { emissive: '#3dfcff', ei: 1.2 }); add(G.cyl(0.03, 0.03, 0.4), '#3a3048', 0, 1.85, 0); add(G.sph(0.09), '#ff4d6e', 0, 2.08, 0, { emissive: '#ff4d6e', ei: 1.4 }); [-1, 1].forEach(s => add(G.box(0.2, 0.6, 0.2), '#8a96aa', s * 0.58, 0.7, 0)); add(G.cyl(0.32, 0.36, 0.3, 8), '#5a6478', 0, 0.15, 0); break;
    case 3: add(G.sph(0.6, 8, 6), '#f4f2ff', 0, 1.0, 0, { opacity: 0.88 }); add(G.cone(0.6, 0.9, 8), '#f4f2ff', 0, 0.4, 0, { opacity: 0.88, r: [Math.PI, 0, 0] }); [-1, 1].forEach(s => add(G.sph(0.1, 6, 4), '#14101e', s * 0.2, 1.1, 0.52)); add(G.sph(0.08, 6, 4), '#14101e', 0, 0.85, 0.55, { s: [1, 1.4, 1] }); b.add(glow('#d8d0ff', 2.4)).position && (b.children[b.children.length - 1].position.y = 0.9); break;
    case 4: add(G.sph(0.5, 8, 6), '#ffd23f', 0, 0.85, 0, { s: [0.9, 0.85, 1.2] }); [-0.2, 0.15].forEach(z => add(G.tor(0.47, 0.07, 4, 10), '#1a1420', 0, 0.85, z, { s: [0.92, 0.88, 1] })); add(G.sph(0.32, 7, 5), '#1a1420', 0, 1.0, 0.6); add(G.cone(0.08, 0.3, 4), '#1a1420', 0, 0.8, -0.7, { r: [-Math.PI / 2, 0, 0] }); [-1, 1].forEach(s => { const w = add(G.sph(0.4, 6, 4), '#dff6ff', s * 0.45, 1.35, -0.05, { opacity: 0.6, s: [1, 0.15, 0.6] }); w.userData.wing = s; }); eyes(b, 1.05, 0.85, 0.14, 0.07); break;
    case 5: add(G.cone(0.6, 1.3, 7), '#5a3ad8', 0, 0.65, 0); add(G.sph(0.32, 7, 5), '#f2c7a0', 0, 1.45, 0); add(G.cone(0.4, 0.9, 7), '#5a3ad8', 0, 2.0, -0.05, { r: [-0.15, 0, 0] }); add(G.tor(0.4, 0.06, 4, 10), '#ffd23f', 0, 1.65, 0, { r: [Math.PI / 2, 0, 0] }); add(G.cone(0.2, 0.5, 5), '#ffffff', 0, 1.22, 0.25, { r: [Math.PI, 0, 0] }); add(G.cyl(0.04, 0.04, 1.4), '#7a5234', 0.55, 0.9, 0.2); add(G.oct(0.14), '#3dfcff', 0.55, 1.65, 0.2, { emissive: '#3dfcff', ei: 1.4 }); eyes(b, 1.5, 0.27, 0.11, 0.06); break;
    case 6: add(G.ico(0.5), '#8a8fa6', 0, 0.6, 0, { s: [0.85, 0.85, 1.15] }); add(G.ico(0.42), '#8a8fa6', 0, 1.15, 0.35); [-1, 1].forEach(s => add(G.cone(0.15, 0.32, 4), '#8a8fa6', s * 0.24, 1.55, 0.35)); add(G.cyl(0.07, 0.05, 1, 5), '#8a8fa6', 0, 1.0, -0.8, { r: [-0.6, 0, 0] }); add(G.sph(0.07), '#ff8fb0', 0, 1.1, 0.77); eyes(b, 1.25, 0.66, 0.17); break;
    case 7: add(G.cyl(0.42, 0.42, 1.5, 8), '#f4f2ff', 0, 1.0, 0); add(G.cone(0.42, 0.7, 8), '#ff4d6e', 0, 2.1, 0); add(G.cyl(0.2, 0.2, 0.06, 8), '#3dfcff', 0, 1.35, 0.42, { r: [Math.PI / 2, 0, 0], emissive: '#3dfcff', ei: 1 }); [0, 2.09, 4.19].forEach(a => add(G.box(0.08, 0.6, 0.5), '#ff4d6e', Math.sin(a) * 0.45, 0.45, Math.cos(a) * 0.45, { r: [0, a, 0] })); { const f = glow('#ffb35c', 1.8); f.position.y = 0.1; b.add(f); b.userData.flame = f; } break;
    case 8: { const horse = '#7a4a2a'; add(G.box(0.6, 0.55, 1.3), horse, 0, 0.85, 0); add(G.box(0.35, 0.7, 0.35), horse, 0, 1.25, 0.7, { r: [0.5, 0, 0] }); add(G.box(0.3, 0.3, 0.55), horse, 0, 1.55, 0.95); [[-0.2, 0.45], [0.2, 0.45], [-0.2, -0.45], [0.2, -0.45]].forEach(([x, z]) => { const l = add(G.box(0.15, 0.6, 0.15), '#5a341e', x, 0.3, z); l.userData.leg = z * x > 0 ? 1 : -1; }); add(G.cone(0.12, 0.6, 4), '#2a1a12', 0, 1.0, -0.75, { r: [-2.2, 0, 0] }); add(G.cone(0.3, 0.8, 6), '#2a2a3a', 0, 1.5, -0.05); add(G.sph(0.2, 7, 5), '#f2c7a0', 0, 2.05, 0); add(G.cyl(0.24, 0.2, 0.3, 7), '#ffffff', 0, 2.3, 0); add(G.box(0.46, 0.5, 0.05), '#2a2230', 0, 1.42, -0.3, { r: [0.25, 0, 0] }); break; }
    case 9: add(G.dod(0.6), '#4a8a3a', 0, 0.6, 0, { s: [1.1, 0.6, 1.2] }); add(G.sph(0.25, 6, 4), '#8ac46a', 0, 0.55, 0.8); [[-0.5, 0.5], [0.5, 0.5], [-0.5, -0.5], [0.5, -0.5]].forEach(([x, z]) => add(G.sph(0.18, 5, 4), '#8ac46a', x, 0.2, z)); eyes(b, 0.65, 0.98, 0.1, 0.05); break;
    case 10: add(G.ico(0.6, 1), '#ffffff', 0, 0.6, 0); add(G.ico(0.45, 1), '#ffffff', 0, 1.35, 0); add(G.ico(0.32, 1), '#ffffff', 0, 1.9, 0); add(G.cone(0.07, 0.4, 5), '#ff8a2a', 0, 1.9, 0.45, { r: [Math.PI / 2, 0, 0] }); add(G.cyl(0.25, 0.25, 0.35, 7), '#2a2a3a', 0, 2.25, 0); add(G.cyl(0.35, 0.35, 0.05, 8), '#2a2a3a', 0, 2.08, 0); add(G.tor(0.36, 0.08, 4, 10), '#e8443a', 0, 1.62, 0, { r: [Math.PI / 2, 0, 0] }); eyes(b, 2.0, 0.27, 0.1, 0.05); break;
    case 11: add(G.ico(0.65), '#8a5a3a', 0, 0.7, 0, { s: [1, 0.95, 1.1] }); add(G.ico(0.45), '#8a5a3a', 0, 1.35, 0.3); [-1, 1].forEach(s => add(G.sph(0.15, 6, 4), '#8a5a3a', s * 0.3, 1.72, 0.25)); add(G.sph(0.18, 6, 4), '#d8b08a', 0, 1.25, 0.7); add(G.sph(0.06), '#14101e', 0, 1.32, 0.86); eyes(b, 1.48, 0.62, 0.17); break;
    case 12: add(G.ico(0.6), '#a07a5a', 0, 0.85, 0, { s: [0.9, 1.1, 0.85] }); add(G.ico(0.38), '#e8d2b0', 0, 0.7, 0.35, { s: [1, 1.2, 0.5] }); [-1, 1].forEach(s => { add(G.sph(0.2, 7, 5), '#ffffff', s * 0.22, 1.25, 0.45, { shadow: false }); add(G.sph(0.11, 6, 4), '#ffb32a', s * 0.22, 1.25, 0.6, { shadow: false }); add(G.cone(0.1, 0.35, 4), '#a07a5a', s * 0.35, 1.65, 0.1); const w = add(G.ico(0.35), '#7a5a3a', s * 0.6, 0.85, -0.05, { s: [0.3, 1, 0.8] }); w.userData.wing = s; }); add(G.cone(0.08, 0.2, 4), '#ffb32a', 0, 1.08, 0.62, { r: [Math.PI, 0, 0] }); break;
    case 13: add(G.ico(0.6), '#5ac45a', 0, 0.45, 0, { s: [1.15, 0.65, 1.1] }); [-1, 1].forEach(s => { add(G.sph(0.22, 7, 5), '#5ac45a', s * 0.3, 0.85, 0.35); add(G.sph(0.13, 6, 4), '#ffffff', s * 0.3, 0.92, 0.5, { shadow: false }); add(G.sph(0.07, 6, 4), '#14101e', s * 0.3, 0.92, 0.6, { shadow: false }); add(G.box(0.25, 0.12, 0.5), '#4aa44a', s * 0.55, 0.1, -0.2); }); add(G.box(0.55, 0.04, 0.05), '#c8344a', 0, 0.58, 0.68); break;
    case 14: { const burka = '#3a2c26', fur = '#efe9df'; add(G.cone(0.62, 1.25, 7), burka, 0, 0.72, 0); add(G.box(1.05, 0.12, 0.5), burka, 0, 1.28, -0.02); add(G.cyl(0.13, 0.15, 0.22, 6), '#e6b48c', 0, 1.42, 0); add(G.sph(0.24, 7, 5), '#e6b48c', 0, 1.62, 0.02); add(G.cone(0.2, 0.42, 6), '#dcdcdc', 0, 1.38, 0.17, { r: [Math.PI + 0.25, 0, 0] }); [-1, 1].forEach(s => add(G.box(0.16, 0.05, 0.05), '#dcdcdc', s * 0.09, 1.56, 0.24, { r: [0, 0, s * 0.3] })); eyes(b, 1.68, 0.21, 0.09, 0.035); add(jitter(G.cyl(0.25, 0.27, 0.34, 8), 0.05), fur, 0, 1.92, 0); add(G.cyl(0.2, 0.2, 0.04, 8), '#b8402e', 0, 2.1, 0); add(new THREE.SphereGeometry(0.52, 12, 8), '#bfeaff', 0, 1.78, 0.02, { opacity: 0.22, shadow: false }); add(G.cyl(0.04, 0.04, 2.1, 5), '#8a5a32', 0.55, 1.05, 0.2); add(new THREE.TorusGeometry(0.14, 0.035, 4, 8, Math.PI), '#8a5a32', 0.69, 2.1, 0.2); add(G.box(0.18, 0.28, 0.12), '#d8dce8', 0, 1.0, -0.42); add(G.sph(0.05), '#5fe0ff', 0, 1.06, -0.49, { emissive: '#5fe0ff', ei: 1.5 }); [-1, 1].forEach(s => { const l = add(G.box(0.16, 0.22, 0.2), '#2a201c', s * 0.18, 0.11, 0.04); l.userData.leg = s; }); break; }
    default: add(G.ico(0.6), '#ffffff', 0, 0.7, 0);
  }
  const shadowBlob = new THREE.Mesh(new THREE.CircleGeometry(0.75, 12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false })); shadowBlob.rotation.x = -Math.PI / 2; shadowBlob.position.y = 0.03; g.add(shadowBlob); g.userData.blob = shadowBlob;
  return g;
}
/* ---------- угрозы и цели ---------- */
function makeHunter() { const p = P(), g = new THREE.Group(); g.add(M(jitter(G.ico(0.65, 0), 0.25), p.foe, 0, 0.7, 0)); [-1, 1].forEach(s => g.add(M(G.cone(0.14, 0.45, 4), shade(p.foe, -0.2), s * 0.3, 1.25, 0, { r: [0, 0, -s * 0.4] }))); [-1, 1].forEach(s => g.add(M(G.sph(0.11, 5, 4), '#fff7c8', s * 0.2, 0.85, 0.55, { emissive: '#fff7c8', ei: 1.2, shadow: false }))); return g; }
function makePatrol() { if (DESIGN.makePatrol) return DESIGN.makePatrol(); const p = P(), g = new THREE.Group(), core = M(G.ico(0.55, 0), p.foe, 0, 0, 0); g.add(core); for (const v of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const c = M(G.cone(0.18, 0.5, 4), '#e8e2f0', v[0] * 0.6, v[1] * 0.6, v[2] * 0.6); c.lookAt(v[0] * 2, v[1] * 2, v[2] * 2); c.rotateX(Math.PI / 2); g.add(c); } const w = new THREE.Group(); w.add(g); g.position.y = 0.8; w.userData.ball = g; return w; }
function makeItem() { const p = P(), g = new THREE.Group(); g.add(M(G.oct(0.42), p.item, 0, 0, 0, { emissive: p.item, ei: 0.55, s: [1, 1.4, 1] })); g.add(glow(p.item, 2.4)); return g; }
function makeRunner() { const p = P(), g = new THREE.Group(); g.add(M(G.ico(0.42), p.item, 0, 0.45, 0, { s: [0.9, 0.8, 1.1], emissive: p.item, ei: 0.25 })); [-1, 1].forEach(s => g.add(M(G.cone(0.08, 0.55, 4), p.item, s * 0.14, 0.95, -0.05, { r: [-0.3, 0, s * 0.25] }))); eyes(g, 0.55, 0.38, 0.12, 0.05); return g; }
function makeDoor() { const p = P(), g = new THREE.Group(); g.add(M(G.box(0.4, 2.6, 0.4), p.rock, -0.95, 1.3, 0)); g.add(M(G.box(0.4, 2.6, 0.4), p.rock, 0.95, 1.3, 0)); g.add(M(G.box(2.4, 0.45, 0.5), p.rock, 0, 2.75, 0)); const pt = M(new THREE.PlaneGeometry(1.5, 2.4), p.acc, 0, 1.25, 0, { emissive: p.acc, ei: 1.1, opacity: 0.75, side: THREE.DoubleSide, shadow: false }); g.add(pt); g.userData.portal = pt; const gl = glow(p.acc, 4); gl.position.y = 1.3; g.add(gl); return g; }
function makeTreasure() { const p = P(), g = new THREE.Group(); for (let i = 0; i < 5; i++) g.add(M(G.oct(0.5), p.acc, Math.cos(i * 1.3) * 0.5 * (i > 0), 1 + (i === 0) * 0.6, Math.sin(i * 1.3) * 0.5 * (i > 0), { s: [0.7, i ? 1.6 : 2.6, 0.7], emissive: p.acc, ei: 0.6 })); g.add(M(G.cyl(1.4, 1.6, 0.4, 8), p.rock, 0, 0.2, 0)); const gl = glow(p.acc, 5); gl.position.y = 1.4; g.add(gl); return g; }
function makePad() { const p = P(), g = new THREE.Group(); g.add(M(G.cyl(1.6, 1.8, 0.25, 10), p.rock, 0, 0.12, 0)); g.add(M(G.cyl(1.3, 1.3, 0.05, 10), p.acc, 0, 0.27, 0, { emissive: p.acc, ei: 0.8, shadow: false })); return g; }
function makeGate() { const p = P(), g = new THREE.Group(); const t = M(G.tor(1.7, 0.18, 5, 14), p.acc, 0, 1.9, 0, { emissive: p.acc, ei: 0.6 }); g.add(t); g.userData.ring = t; return g; }
function makeBoss() { const p = P(), g = new THREE.Group(), r = shade(p.rock, -0.42), f = p.foe; const moss = '#4f8a3a'; g.add(M(jitter(G.ico(0.9, 0), 0.3), moss, 0, 4.25, 0.1, { s: [1, 0.35, 1] })); g.add(M(jitter(G.dod(1.4), 0.5), r, 0, 2.1, 0, { s: [1.1, 1, 0.9] })); g.add(M(jitter(G.dod(0.8), 0.3), r, 0, 3.7, 0.2)); [-1, 1].forEach(s => { g.add(M(jitter(G.dod(0.65), 0.3), r, s * 1.75, 2.2, 0.3)); g.add(M(jitter(G.dod(0.6), 0.25), r, s * 0.7, 0.6, 0)); g.add(M(G.sph(0.16, 6, 4), f, s * 0.3, 3.8, 0.85, { emissive: f, ei: 1.6, shadow: false })); }); g.add(M(G.box(1.2, 0.25, 0.1), f, 0, 2.3, 1.2, { emissive: f, ei: 1 })); return g; }
function makeRock() { const p = P(); return M(jitter(G.dod(0.6), 0.25), p.foe, 0, 0, 0, { emissive: '#ff6a2a', ei: 0.35 }); }
function ring(r1, r2, color, op = 0.6) { const m = new THREE.Mesh(new THREE.RingGeometry(r1, r2, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.y = 0.06; return m; }
