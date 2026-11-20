# МатеМагия — бэкенд
В этой части: настройки проекта (`config`), основа (`core`), пользователи (`users`), темы и теория (`learning`).
Следующие части (`tests`, `progress`, `game`, `adaptive`) добавляются отдельными папками.


## Что реализовано
- **core:** `ServiceResult` и коды результата (раздел 5.1.2 документа), главная страница `/`
  (`home.html` для гостя, `dashboard_main.html` для ученика).
- **users:** модель `User` (класс, опыт, ранг), `AuthService` (`register`, `login`, `logout`), представления
  `/register/`, `/login/`, `/logout/`, `/profile/`.
- **learning:** модели `Topic` и `Lesson`, `LearningService` (`get_topics_with_status`, `get_topic`, `get_lesson`),
  представления `/topics/`, `/topics/<id>/`, `/theory/<id>/`; админка с уроками внутри темы.

Пока нет приложения `progress`, все темы имеют статус «Новая», а в кабинете нет статистики.
