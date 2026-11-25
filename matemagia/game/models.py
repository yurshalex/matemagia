from django.conf import settings
from django.db import models


class Achievement(models.Model):
    """Справочник достижений (§3.1.7). Таблица game_achievement."""

    code = models.CharField("Код", max_length=50, unique=True)
    title = models.CharField("Название", max_length=100)
    description = models.TextField("Условие получения")
    icon_code = models.CharField("Код иконки", max_length=50)
    xp_reward = models.PositiveIntegerField("Награда, XP", default=0)

    class Meta:
        verbose_name = "Достижение"
        verbose_name_plural = "Достижения"
        ordering = ["id"]

    def __str__(self):
        return f"{self.title} ({self.code})"


class UserAchievement(models.Model):
    """Полученные достижения (§3.1.8). Таблица game_userachievement."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="achievements", verbose_name="Пользователь",
    )
    achievement = models.ForeignKey(
        Achievement, on_delete=models.CASCADE,
        related_name="holders", verbose_name="Достижение",
    )
    unlocked_at = models.DateTimeField("Получено", auto_now_add=True)

    class Meta:
        verbose_name = "Достижение пользователя"
        verbose_name_plural = "Достижения пользователей"
        ordering = ["-unlocked_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "achievement"], name="uniq_user_achievement"),
        ]

    def __str__(self):
        return f"{self.user} · {self.achievement.code}"


class ChallengeResult(models.Model):
    """Итог пройденного испытания. Нужен для count_passed_challenges
    (достижение three_challenges) и для списка пройденных уровней."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="challenge_results", verbose_name="Пользователь",
    )
    topic = models.ForeignKey(
        "learning.Topic", on_delete=models.CASCADE,
        related_name="challenge_results", verbose_name="Тема",
    )
    correct = models.PositiveSmallIntegerField("Верных ответов")
    total = models.PositiveSmallIntegerField("Всего заданий")
    score = models.PositiveIntegerField("Очки", default=0)
    success = models.BooleanField("Пройдено", default=False)
    bonus_xp = models.PositiveIntegerField("Бонус XP", default=0)
    created_at = models.DateTimeField("Дата", auto_now_add=True)

    class Meta:
        verbose_name = "Результат испытания"
        verbose_name_plural = "Результаты испытаний"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} · {self.topic} · {self.correct}/{self.total}"
