const DESIGN = {
  name: 'Башня из облаков', hero: 'старый горный пастух', look: 'Горный пастух', world: 'станция на Луне', item: 'осколки метеоритов',
  pal: 'Луна', music: 'Космический эмбиент', camera: 'Сверху под углом',
  goal: 'Построить', verb: 'Телепорт', threat: 'Патрули', twist: 'Без поворота', aim: 'Открытие',
  sub: 'Старый горный пастух попал на лунную станцию и хочет домой, на Землю. Из осколков метеоритов он строит башню из облаков: каждый осколок, донесённый до площадки, превращается в облако. По станции ходят дроны-обходчики, а их путь подсвечен красной линией.',
  decisions: ['Игрок переживает за героя: старый горный пастух кажется живым', 'Всё, что может ранить, видно на экране заранее', 'Потратить телепорт сейчас или приберечь'],
  predict: ['turns', 'greedy', 'dodge'],
  hyp: 'Игрок будет уворачиваться в последний момент, потому что угроза «Патрули»: ходят по маршрутам, путь можно прочитать [кубик]',
  mission: { target: 'Открытие' },
  cpLabel: 'чекпоинт 3 · моя 3D-игра «Башня из облаков»',
  // слой этой игры: модели по словам ученика
  makeCargo() {
    const g = new THREE.Group(), p = P();
    [[0, 0, 0, 0.42, 1.6], [0.28, -0.1, 0.12, 0.26, 1.3], [-0.24, -0.12, -0.1, 0.24, 1.2]].forEach(([x, y, z, r, sy], i) => g.add(M(jitter(G.oct(r), 0.08), i ? '#9a5cff' : p.item, x, y, z, { s: [1, sy, 1], r: [0.3 * i, i, 0.2], emissive: p.item, ei: 0.7 })));
    g.add(M(jitter(G.dod(0.3), 0.12), '#3a3040', 0, -0.3, 0, { s: [1.3, 0.6, 1.2] }));
    g.add(glow(p.item, 2.6)); return g;
  },
  makeBlock(n) {
    const g = new THREE.Group(), white = n % 2 ? '#ffffff' : '#eef4ff';
    [[0, 0, 0, 0.62], [0.5, -0.08, 0.15, 0.45], [-0.48, -0.06, -0.1, 0.47], [0.1, 0.12, 0.45, 0.4], [-0.1, 0.1, -0.45, 0.42]].forEach(([x, y, z, r], i) => g.add(M(jitter(G.ico(r, 1), 0.07), white, x, y, z, { s: [1, 0.72, 1], emissive: '#cfe4ff', ei: 0.25 })));
    g.add(M(G.oct(0.22), '#c77dff', 0, 0, 0, { emissive: '#c77dff', ei: 1.2, shadow: false }));
    return g;
  },
  makePatrol() {
    const p = P(), g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    body.add(M(G.cyl(0.85, 0.55, 0.32, 10), '#e4e8f2', 0, 1.0, 0)); body.add(M(G.sph(0.42, 9, 6), '#c8ccd8', 0, 1.25, 0, { s: [1, 0.7, 1] }));
    body.add(M(G.box(0.38, 0.18, 0.12), p.foe, 0, 1.12, 0.56, { emissive: p.foe, ei: 1.6 }));
    const ring = new THREE.Group(); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; ring.add(M(G.box(0.18, 0.08, 0.18), i % 2 ? p.foe : '#ffcf3a', Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9, { emissive: i % 2 ? p.foe : '#ffcf3a', ei: 1.2, shadow: false })); } ring.position.y = 0.86; body.add(ring);
    const beam = M(G.cone(0.9, 0.85, 10), p.foe, 0, 0.43, 0, { opacity: 0.18, emissive: p.foe, ei: 0.8, shadow: false }); body.add(beam);
    g.userData.ball = ring; return g;
  },
  decor(world, p) {
    // стартовая площадка башни подсвечена, а у края арены стоит домик пастуха-модуль с огоньком
    const hut = new THREE.Group(); hut.add(M(G.cyl(1.4, 1.6, 1.4, 8), '#e8ecf4', 0, 0.7, 0)); hut.add(M(G.cone(1.6, 1.1, 8), '#b8402e', 0, 1.95, 0)); hut.add(M(G.box(0.5, 0.8, 0.05), '#ffcf3a', 0, 0.45, 1.5, { emissive: '#ffb347', ei: 1.3 }));
    hut.position.set(-AX - 6, 0, -6); world.add(hut);
    const rover = new THREE.Group(); rover.add(M(G.box(2.2, 0.6, 1.3), '#e4e8f2', 0, 0.8, 0)); [[-0.8, 0.6], [0.8, 0.6], [-0.8, -0.6], [0.8, -0.6]].forEach(([x, z]) => rover.add(M(G.cyl(0.35, 0.35, 0.25, 8), '#3a3a48', x, 0.35, z, { r: [Math.PI / 2, 0, 0] }))); rover.add(M(G.box(0.6, 0.4, 0.05), '#5fe0ff', 0.5, 1.2, 0.66, { emissive: '#5fe0ff', ei: 1 }));
    rover.position.set(AX + 7, 0, 5); rover.rotation.y = 0.6; world.add(rover);
  },
};
