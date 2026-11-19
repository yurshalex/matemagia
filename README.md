# МатеМагия

Тренажер по математике для 5 класса

<img src="docs/images/МатеМагия.png" alt="Логотип" width="500">

Доля в компании:
Юршейс Александр: 50%
Щетинин Андрей: 50%

## Фронтенд (кликабельный прототип)

Вёрстка всех экранов лежит по структуре кода из `docs/PR.md`: страницы — в `templates/`, стили, скрипты и картинки — в `static/`.
Python и сервер не нужны: откройте `templates/home.html` в браузере, дальше всё кликается. Вёрстка пока только для компьютера.

| Экран | Файл | JS |
| :--- | :--- | :--- |
| Главная гостя | `templates/home.html` | — |
| Вход | `templates/users/auth_login.html` | `auth.js` |
| Регистрация | `templates/users/register.html` | `auth.js` |
| Главная ученика | `templates/dashboard_main.html` | — |
| Книги заклинаний | `templates/learning/topic_catalog.html` | `topic_filter.js` |
| Урок теории | `templates/learning/theory_view.html` | `theory.js` |
| Тренажёр | `templates/tests/task_trainer.html` | `task_check.js` |
| Испытание | `templates/game/challenge_game.html` (серия — `task_trainer.html?mode=challenge`) | `challenge.js` |
| Личный кабинет | `templates/progress/profile_stats.html` | — |
| Ранги и достижения | `templates/game/achievements_list.html` | `achievements.js` |

`static/js/nav.js` подключён на всех страницах: меню профиля, анимации появления, цвет полос, счётчики, всплывающие сообщения.

### Для бэкенда

- Все данные на страницах — примеры с макетов. Над каждым блоком в HTML есть комментарий, откуда брать данные.
- Пути `../../static/...` заменить на `{% static '...' %}`, ссылки между страницами — на `{% url '...' %}`, общий `<head>` и шапку вынести в `base.html`.
- Формы: `method="post"`, свой `action` и `{% csrf_token %}`; в `auth.js` убрать переход в конце. Имена полей — как в Django: `username`, `password`, `first_name`, `grade`, `password1`, `password2`.
- Ошибки сервера: `<p class="field-error">` под полем (у `.field` — класс `has-error`) или `#form-alert`.
- Полосы процента верных: `<div class="progress-bar" data-percent="38">` — цвет ставит `nav.js` (< 50 % красный, 50–80 % жёлтый, > 80 % зелёный).
- `task_check.js`: массив `TASKS` заменить на запросы `/tasks/next/` и `POST /tasks/<id>/check/`.
- Сохранение в `localStorage` (имя, пройденные уровни испытания) — только для прототипа.
