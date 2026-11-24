"""ProgressService: попытки, статистика, история, слабые темы, работа над ошибками."""
import logging

from django.apps import apps
from django.conf import settings
from django.core.paginator import Paginator
from django.db import DatabaseError, transaction
from django.db.models import OuterRef, Subquery, Sum

from core.results import ResultCode, ServiceResult
from learning.models import Topic

from .models import SolutionAttempt, UserProgress

logger = logging.getLogger(__name__)

WEAK_PERCENT = 60        # тема слабая, если верных строго меньше 60 %
WEAK_MIN_ATTEMPTS = 3    # ... и решено не меньше 3 заданий


def _percent(correct: int, solved: int) -> float:
    return round(correct / solved * 100, 1) if solved else 0.0


class ProgressService:
    @property
    def history_page_size(self) -> int:
        return getattr(settings, "HISTORY_PAGE_SIZE", 20)

    @staticmethod
    def _row(p: UserProgress) -> dict:
        return {
            "topic": p.topic,
            "tasks_solved": p.tasks_solved,
            "tasks_correct": p.tasks_correct,
            "percent_correct": _percent(p.tasks_correct, p.tasks_solved),
        }

    # ---------- запись ----------
    def record_attempt(self, user, task, user_answer, is_correct, xp_earned=0) -> ServiceResult:
        """Создаёт SolutionAttempt и обновляет UserProgress по паре (пользователь, тема)."""
        try:
            with transaction.atomic():
                attempt = SolutionAttempt.objects.create(
                    user=user, task=task, user_answer=str(user_answer),
                    is_correct=bool(is_correct), xp_earned=xp_earned,
                )
                progress, _ = UserProgress.objects.get_or_create(user=user, topic_id=task.topic_id)
                progress.tasks_solved += 1
                if is_correct:
                    progress.tasks_correct += 1
                progress.error_rate = (progress.tasks_solved - progress.tasks_correct) / progress.tasks_solved * 100
                progress.save(update_fields=["tasks_solved", "tasks_correct", "error_rate"])
        except DatabaseError:
            logger.exception("Ошибка записи попытки")
            return ServiceResult.fail(ResultCode.INTERNAL_ERROR, {"__all__": "Внутренняя ошибка"})
        return ServiceResult.success(attempt)

    # ---------- статистика ----------
    def get_user_stats(self, user) -> ServiceResult:
        agg = UserProgress.objects.filter(user=user).aggregate(s=Sum("tasks_solved"), c=Sum("tasks_correct"))
        total, correct = agg["s"] or 0, agg["c"] or 0
        return ServiceResult.success(
            {"total": total, "correct": correct, "wrong": total - correct,
             "percent_correct": _percent(correct, total)}
        )

    def get_topic_progress(self, user, topic_id=None) -> ServiceResult:
        """Список {topic (объект Topic), tasks_solved, tasks_correct, percent_correct}."""
        if topic_id is not None and not Topic.objects.filter(pk=topic_id).exists():
            return ServiceResult.fail(ResultCode.NOT_FOUND, {"topic": "Тема не найдена"})
        qs = UserProgress.objects.filter(user=user).select_related("topic")
        if topic_id is not None:
            qs = qs.filter(topic_id=topic_id)
        return ServiceResult.success([self._row(p) for p in qs.order_by("topic__order", "topic_id")])

    def get_weak_topics(self, user) -> ServiceResult:
        """Меньше 60 % верных при 3 попытках и больше; по возрастанию процента."""
        qs = UserProgress.objects.filter(user=user, tasks_solved__gte=WEAK_MIN_ATTEMPTS).select_related("topic")
        weak = [p for p in qs if p.tasks_correct * 100 < WEAK_PERCENT * p.tasks_solved]
        weak.sort(key=lambda p: p.tasks_correct / p.tasks_solved)
        return ServiceResult.success([self._row(p) for p in weak])

    # ---------- история ----------
    def get_recent_attempts(self, user, limit=5) -> ServiceResult:
        qs = SolutionAttempt.objects.filter(user=user).select_related("task", "task__topic")
        return ServiceResult.success(list(qs.order_by("-created_at", "-id")[:limit]))

    def get_history(self, user, page=1) -> ServiceResult:
        try:
            page = int(page)
            if page < 1:
                raise ValueError
        except (TypeError, ValueError):
            return ServiceResult.fail(ResultCode.VALIDATION_ERROR, {"page": "Номер страницы должен быть положительным числом"})

        qs = SolutionAttempt.objects.filter(user=user).select_related("task", "task__topic").order_by("-created_at", "-id")
        paginator = Paginator(qs, self.history_page_size)
        if page > paginator.num_pages:
            return ServiceResult.fail(ResultCode.NOT_FOUND, {"page": "Страница не найдена"})
        current = paginator.page(page)
        return ServiceResult.success(
            {
                "attempts": list(current.object_list),
                "page": page,
                "num_pages": paginator.num_pages,
                "total": paginator.count,
                "has_previous": current.has_previous(),
                "has_next": current.has_next(),
                "previous_page": page - 1 if current.has_previous() else None,
                "next_page": page + 1 if current.has_next() else None,
            }
        )

    # ---------- работа над ошибками ----------
    def get_error_tasks(self, user) -> ServiceResult:
        """Задания, последняя попытка по которым неверная (верный ответ убирает из списка)."""
        Task = apps.get_model("tests", "Task")
        last = SolutionAttempt.objects.filter(user=user, task=OuterRef("pk")).order_by("-created_at", "-id")
        tasks = (
            Task.objects.filter(attempts__user=user)
            .annotate(last_correct=Subquery(last.values("is_correct")[:1]))
            .filter(last_correct=False)
            .select_related("topic")
            .distinct()
        )
        return ServiceResult.success(list(tasks))

    def get_recent_accuracy(self, user, topic_id, n) -> ServiceResult:
        """По последним n попыткам темы: {attempts, correct} (для Ярослава)."""
        results = list(
            SolutionAttempt.objects.filter(user=user, task__topic_id=topic_id)
            .order_by("-created_at", "-id").values_list("is_correct", flat=True)[:n]
        )
        return ServiceResult.success({"attempts": len(results), "correct": sum(results)})
