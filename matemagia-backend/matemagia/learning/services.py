"""LearningService: темы, уроки и статусы тем для обучающегося."""
from django.conf import settings

from core.results import ResultCode, ServiceResult
from core.optional import optional_class

from .models import Lesson, Topic

_ProgressService = optional_class("progress.services", "ProgressService")

STATUS_NEW = "Новая"
STATUS_IN_PROGRESS = "В процессе"
STATUS_DONE = "Пройдена"


class LearningService:
    def __init__(self, progress_service=None):
        # без приложения progress все темы получают статус «Новая»
        self.progressService = progress_service or (_ProgressService() if _ProgressService else None)

    def get_topics_with_status(self, user) -> ServiceResult:
        """Темы по полю order; нет решённых заданий -> «Новая»; верно решено
        TOPIC_COMPLETE_TASKS заданий -> «Пройдена»."""
        progress = self.progressService.get_topic_progress(user) if self.progressService else None
        progress_by_topic = {row["topic"].pk: row for row in progress.data} if progress and progress.ok else {}

        target = settings.TOPIC_COMPLETE_TASKS
        items = []
        for topic in Topic.objects.all():
            row = progress_by_topic.get(topic.id)
            solved = row["tasks_solved"] if row else 0
            correct = row["tasks_correct"] if row else 0

            if solved == 0:
                status, code = STATUS_NEW, "new"
            elif correct >= target:
                status, code = STATUS_DONE, "done"
            else:
                status, code = STATUS_IN_PROGRESS, "in_progress"

            done_count = min(correct, target)
            items.append(
                {
                    "topic": topic,
                    "status": status,
                    "status_code": code,
                    "tasks_done": done_count,
                    "tasks_total": target,
                    "progress_percent": round(done_count / target * 100) if target else 0,
                }
            )
        return ServiceResult.success(items)

    def get_topic(self, topic_id: int) -> ServiceResult:
        topic = Topic.objects.filter(pk=topic_id).first()
        if topic is None:
            return ServiceResult.fail(ResultCode.NOT_FOUND, {"topic": "Тема не найдена"})
        return ServiceResult.success({"topic": topic, "lessons": list(topic.lessons.all())})

    def get_lesson(self, lesson_id: int) -> ServiceResult:
        lesson = Lesson.objects.select_related("topic").filter(pk=lesson_id).first()
        if lesson is None:
            return ServiceResult.fail(ResultCode.NOT_FOUND, {"lesson": "Урок не найден"})

        lessons = list(lesson.topic.lessons.all())
        index = next(i for i, item in enumerate(lessons) if item.pk == lesson.pk)
        return ServiceResult.success(
            {
                "lesson": lesson,
                "topic": lesson.topic,
                "lessons": lessons,
                "number": index + 1,
                "total": len(lessons),
                "prev_id": lessons[index - 1].pk if index > 0 else None,
                "next_id": lessons[index + 1].pk if index < len(lessons) - 1 else None,
            }
        )
