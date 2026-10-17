// Проверочная игра для автопроверки: через секунду игры падает с ошибкой.
// Проверяет, что оболочка ловит ошибку, показывает строку и не виснет.
const GAME = {
  title: 'Проверка ошибки',
  controls: [{ input: 'move', text: 'ничего' }],
  start(lab, scene) {
    lab.ground({ w: 20, h: 20 });
    lab.state.box = BABYLON.MeshBuilder.CreateBox('ящик', { size: 2 }, scene);
  },
  update(lab, dt) {
    lab.state.box.rotation.y += dt;
    if (lab.t > 1) lab.state.nothing.position.x = 1; // намеренная ошибка: такого объекта нет
  },
};
