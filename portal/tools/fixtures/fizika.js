// Проверочная игра для автопроверки: физика Havok включена (physics: true).
// Шар катится от стрелок и сбивает башню ящиков с площадки. Не образец для учеников.
const GAME = {
  title: 'Проверка физики',
  subtitle: 'Скати шар и сбей все ящики с площадки.',
  players: 1,
  controls: [{ input: 'move4', text: 'катить шар' }, { input: 'a', text: 'прыжок' }],
  camera: 'iso',
  field: { w: 22, h: 22 },
  physics: true,
  gravity: 9.81,
  config: {
    push: { value: 14, min: 2, max: 40, step: 1, label: 'Сила толчка' },
    jump: { value: 6, min: 0, max: 15, step: 0.5, label: 'Прыжок' },
    tower: { value: 4, min: 1, max: 8, step: 1, label: 'Этажей башни', restart: true },
  },
  presets: { 'Новичок': { push: 22, tower: 2 } },
  start(lab, scene) {
    const B = BABYLON, st = lab.state;
    lab.ground({ w: 80, h: 80, color: '#24324f', y: -6 });
    const deck = B.MeshBuilder.CreateBox('площадка', { width: 18, height: 1, depth: 18 }, scene);
    deck.position.y = -0.5; deck.material = lab.mat('#3f7d4a');
    new B.PhysicsAggregate(deck, B.PhysicsShapeType.BOX, { mass: 0, friction: 0.8 }, scene);
    const ball = B.MeshBuilder.CreateSphere('шар', { diameter: 1.2, segments: 12 }, scene);
    ball.position.set(0, 1, -6); ball.material = lab.mat('#ff6ad5', { shiny: true });
    st.ball = new B.PhysicsAggregate(ball, B.PhysicsShapeType.SPHERE, { mass: 2, restitution: 0.3, friction: 0.6 }, scene);
    st.boxes = [];
    const n = Math.round(lab.cfg.tower);
    for (let y = 0; y < n; y++) for (let x = -1; x <= 1; x++) {
      const b = B.MeshBuilder.CreateBox('ящик', { size: 0.9 }, scene);
      b.position.set(x * 0.95, 0.45 + y * 0.92, 3);
      b.material = lab.mat(lab.pick(['#ffd23f', '#5fe0ff', '#7cf5a8']));
      new B.PhysicsAggregate(b, B.PhysicsShapeType.BOX, { mass: 0.4, friction: 0.7 }, scene);
      st.boxes.push({ mesh: b, out: false });
    }
    st.total = st.boxes.length;
  },
  update(lab, dt) {
    const B = BABYLON, st = lab.state, p = lab.p1, body = st.ball.body;
    body.applyImpulse(new B.Vector3(p.x, 0, p.y).scale(lab.cfg.push * dt), st.ball.transformNode.getAbsolutePosition());
    if (p.pressed.a && st.ball.transformNode.position.y < 0.8) { body.applyImpulse(new B.Vector3(0, lab.cfg.jump, 0), st.ball.transformNode.getAbsolutePosition()); lab.sfx.jump(); }
    for (const b of st.boxes) {
      if (!b.out && b.mesh.position.y < -1) { b.out = true; lab.addScore(10, b.mesh); lab.burst(b.mesh, { color: '#ffd23f' }); lab.sfx.coin(); }
    }
    const left = st.boxes.filter(b => !b.out).length;
    lab.hud('left', 'Ящиков на площадке: ' + left);
    if (!left) lab.win('Площадка чиста');
    if (st.ball.transformNode.position.y < -4) lab.gameOver('Шар упал');
  },
};
