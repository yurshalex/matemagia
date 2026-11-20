# МатеМагия — бэкенд, часть 1 из 3 (Django)

В этой части: настройки проекта (`config`), основа (`core`), пользователи (`users`), темы и теория (`learning`).
Следующие части (`tests`, `progress`, `game`, `adaptive`) добавляются отдельными папками.
Фронтенд кладётся в `templates/` и `static/`.

## Запуск
```bash
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                               # Windows: copy .env.example .env
python manage.py makemigrations users learning
python manage.py migrate
python manage.py loaddata initial_data.json        # 8 тем и 26 уроков
python manage.py createsuperuser
python manage.py runserver
```
Откройте http://127.0.0.1:8000/admin/ — там пользователи, темы и уроки.

## Что реализовано
- **core:** `ServiceResult` и коды результата (раздел 5.1.2 документа), главная страница `/`
  (`home.html` для гостя, `dashboard_main.html` для ученика).
- **users:** модель `User` (класс, опыт, ранг), `AuthService` (`register`, `login`, `logout`), представления
  `/register/`, `/login/`, `/logout/`, `/profile/`.
- **learning:** модели `Topic` и `Lesson`, `LearningService` (`get_topics_with_status`, `get_topic`, `get_lesson`),
  представления `/topics/`, `/topics/<id>/`, `/theory/<id>/`; админка с уроками внутри темы.

Пока нет приложения `progress`, все темы имеют статус «Новая», а в кабинете нет статистики. Когда добавите
следующие части, всё подхватится автоматически (см. комментарии в `config/settings.py` и `config/urls.py`).

## Контракт для фронтенда (шаблон → контекст)
В формах `{% csrf_token %}`; выход — только POST на `/logout/`. Нужны также `404.html` и `500.html`.

| Шаблон | Контекст |
|---|---|
| `home.html` | — |
| `dashboard_main.html` | `rank_info`, `weak_topics` |
| `users/auth_login.html` | `errors` (`__all__` — общая), `values`, `next`; поля `username`, `password` |
| `users/register.html` | `errors`, `values`; поля `first_name`, `grade`, `username`, `password1`, `password2` |
| `progress/profile_stats.html` | `profile_user`, `stats`, `topic_progress`, `weak_topics`, `recent_attempts`, `rank_info`, `achievements`, `challenges_passed` |
| `learning/topic_catalog.html` | `topics`: `topic`, `status`, `status_code`, `tasks_done`, `tasks_total`, `progress_percent` |
| `learning/topic_detail.html` | `topic`, `lessons` |
| `learning/theory_view.html` | `lesson`, `topic`, `lessons`, `number`, `total`, `prev_id`, `next_id` |
