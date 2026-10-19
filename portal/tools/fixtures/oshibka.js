// Проверочная игра для автопроверки оболочки «Лаб3D»: через секунду игры падает с ошибкой.
// Проверяет, что оболочка ловит ошибку, показывает строку из кода игры (а не из three.js) и не виснет.
const GAME = {
  engine: 'three',
  title: 'Проверка ошибки',
  controls: [{ input: 'move', text: 'ничего' }],
  start(lab) {
    lab.ground({ w: 20, h: 20 });
    lab.state.box = lab.box(2, 2, 2, '#ffaa33', { at: [0, 1, 0] });
  },
  update(lab, dt) {
    lab.state.box.rotation.y += dt;
    if (lab.t > 1) lab.state.nothing.position.x = 1; // намеренная ошибка: такого объекта нет (строка 13)
  },
};
