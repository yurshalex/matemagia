# МатеМагия — модуль tests (бэкенд)

Скопировать каталог `tests` в каталог проекта, где расположен `manage.py`, с заменой старой версии `tests`. Код фронтенда, progress, game, adaptive, learning и users не входит в этот пакет и не меняется. В итоговом backend-архиве `tests` подключён в `config/settings.py` и `config/urls.py`. При переносе в другую ветку проверить наличие `"tests"` в INSTALLED_APPS и `path("", include("tests.urls"))` в urlpatterns.

## Запуск (из каталога manage.py)

```sh
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py loaddata initial_data
python manage.py loaddata initial_tasks
python manage.py test tests
python manage.py runserver
```

`loaddata` предназначен для исходной/тестовой базы: фиксированные PK могут перезаписать записи в существующей БД. Перед загрузкой в рабочую базу сделайте резервную копию. Миграции и загрузка в присланную SQLite не выполнялись (Django недоступен в среде проверки).

Фикстура содержит 96 заданий из оригинального генератора: 44 input, 24 choice, 15 boolean, 7 ordering, 6 matching. Для повторной выгрузки: `python manage.py export_tasks` (использует существующий `tools/generate_initial_data.py`, не изменяя его).

## API для фронтенда

Все маршруты требуют авторизации. Для JSON передавать `Accept: application/json`. Для POST передавать `Content-Type: application/json`, CSRF-токен в `X-CSRFToken` и cookie сессии.

- GET `/tasks/?topic=1&type=input` — новая серия, доступные темы/форматы. `topic`, `type`, `difficulty` необязательны.
- GET `/tasks/next/` — следующее случайное задание без повторов, `number`, `total`, `finished`. После 10 выданных заданий — `finished: true`. `restart=1` начинает новую серию. При исчерпании банка по узкому фильтру — HTTP 404, код 3002, finished=true; фильтр не снимается автоматически. Для гарантированных 10 уникальных заданий каждого формата в каждой теме нужно расширить банк.
- GET `/tasks/1/` — данные задания, без correct_answer и explanation. При отсутствии — 2001 (JSON, HTTP 404).
- POST `/tasks/1/check/` — тело `{"answer": ...}`. Ответ включает is_correct, explanation, correct_answer, xp_earned, total_xp, rank, rank_changed, new_achievements, attempt_recorded. Некорректный формат — 3001 / HTTP 400. Неизвестное задание — 2001 / HTTP 404.

Форматы поля answer: input — строка числа/дроби; choice — текст выбранного варианта из options (не индекс); boolean — true/false или соответствующая строка; ordering — массив строк в выбранном порядке; matching — объект вида {"левый элемент":"правый элемент"} или массив пар. В обычной HTML-форме сложные ответы передаются как JSON-строки. Не следует отправлять локально рассчитанный is_correct: проверка выполняется сервером.

При наличии шаблонов tests/task_trainer.html и tests/result.html обычные GET/POST используют их; без шаблонов возвращается JSON. Фронтенд должен подключить API вместо локальной проверки JavaScript самостоятельно.

## Интеграция

TaskService использует существующий ServiceResult и опционально подключает ProgressService, RewardService, AdaptiveService, если соответствующие приложения установлены. ProgressService.record_attempt вызывается раньше RewardService.process_attempt в одной transaction.atomic; при ошибке сервиса транзакция откатывается. Формы вызовов соответствуют присланному progress-game архиву. Если progress отсутствует, проверка работает, но attempt_recorded=false, XP не начисляется. Правила повторного начисления XP принадлежат RewardService. До появления adaptive используется случайная выборка из БД; адаптивная интеграция ожидает ServiceResult с объектом Task, иначе используется БД.

## Проверка

`python -m unittest tests.test_checker -v` — 8 тестов, прошли в среде подготовки, включая проверку формата всех 96 эталонов. `python manage.py test tests` — дополнительно тесты HTTP, серии и отката транзакции; их необходимо запустить локально, поскольку в среде подготовки Django не установлен. Полная совместная проверка с фронтендом и сервисами команды не проводилась.
