# Шаблоны геймдизайнера

Короткие русские шаблоны для уроков, которые ещё собираются (модули 5–8), и для разборов после релизов. Их читает Claude при сборке урока, а учитель может раздать ученикам как лист или перенести в шаг портала. Каждый шаблон ужат под нашу задачу: игра на одну партию в 5–15 минут, ученик 14–17 лет, игру пишет Qwen в чате.

| Шаблон | О чём | Где пригодится |
| --- | --- | --- |
| [opory.md](opory.md) | Опоры игры, «чем игра не является», эстетики MDA, три потребности игрока, эмоциональная дуга партии | урок 3 (MDA), урок 23 «Почему люди играют», модуль 8 (замысел своей игры) |
| [pitch.md](pitch.md) | Питч своей игры на одну страницу | модуль 8 (питч), Фестиваль (занятие 36) |
| [pleytest.md](pleytest.md) | Бланк плейтеста и разбор находок по четырём корзинам | ритуал плейтеста в любом уроке, лист урока, Мастерская |
| [kriva-slozhnosti.md](kriva-slozhnosti.md) | Оси сложности, порядок ввода механик, первая неудача, первое «я умею» | уроки 9, 14, 24, модуль 8 |
| [razduvanie.md](razduvanie.md) | Проверка раздувания замысла: что было в плане и что стало | джем «Легенды Адыгеи» (27–28), модуль 8 |
| [dostupnost.md](dostupnost.md) | Чек-лист доступности и приёмы интерфейса для браузерной игры | урок 24 «Онбординг, интерфейс, доступность», доноры |
| [personazh.md](personazh.md) | Карточка персонажа | уроки 19–22 (истории, миры, смыслы), модуль 8 |
| [posle-relaza.md](posle-relaza.md) | Разбор после релиза | релизы модулей, после джема, после Фестиваля |

«Звуковое лицо» донора добавлено в `.claude/skills/lab3d-igra/planka.md`, рядом с лицом картинки.

## Откуда

Шаблоны — пересказ и сокращение шаблонов из [Donchitos/Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios) (`.claude/docs/templates/`, скиллы `playtest-report` и `scope-check`; смотрели 20.10.2026). Сам набор (49 агентов, 74 скилла, хуки, спринты под Godot, Unity и Unreal) в проект не ставили: другой движок и процесс под одну большую игру, а агенты тратят лимит. Решение автора 20.10.2026: взять только шаблоны.

Лицензия источника — MIT:

```text
MIT License

Copyright (c) 2026 Donchitos

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
