from django.conf import settings
from django.db import models


class SolutionAttempt(models.Model):
    """История решений (§3.1.5). Таблица progress_solutionattempt."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="attempts", verbose_name="Пользователь",
    )
    task = models.ForeignKey(
        "tests.Task", on_delete=models.CASCADE,
        related_name="attempts", verbose_name="Задание",
    )
    user_answer = models.TextField("Ответ пользователя")
    is_correct = models.BooleanField("Верно")
    xp_earned = models.IntegerField("Начислено опыта", default=0)
    created_at = models.DateTimeField("Дата попытки", auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        verbose_name = "Попытка решения"
        verbose_name_plural = "Попытки решения"
        indexes = [models.Index(fields=["user", "task", "-created_at"])]

    def __str__(self):
        return f"{self.user} · задание {self.task_id} · {'верно' if self.is_correct else 'неверно'}"


class UserProgress(models.Model):
    """Агрегированный прогресс по темам (§3.1.6). Таблица progress_userprogress."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="topic_progress", verbose_name="Пользователь",
    )
    topic = models.ForeignKey(
        "learning.Topic", on_delete=models.CASCADE,
        related_name="user_progress", verbose_name="Тема",
    )
    tasks_solved = models.IntegerField("Решено заданий", default=0)
    tasks_correct = models.IntegerField("Верных ответов", default=0)
    error_rate = models.FloatField("Процент ошибок", default=0.0)
    # Для AdaptiveService (Ярослав): текущий уровень сложности по теме, 1–3.
    difficulty_level = models.PositiveSmallIntegerField("Уровень сложности", default=1)

    class Meta:
        verbose_name = "Прогресс по теме"
        verbose_name_plural = "Прогресс по темам"
        constraints = [
            models.UniqueConstraint(fields=["user", "topic"], name="uniq_user_topic_progress"),
        ]

    @property
    def percent_correct(self):
        if not self.tasks_solved:
            return 0.0
        return round(self.tasks_correct / self.tasks_solved * 100, 1)

    def __str__(self):
        return f"{self.user} · {self.topic} · {self.tasks_correct}/{self.tasks_solved}"
