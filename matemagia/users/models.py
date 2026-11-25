from django.contrib.auth.models import AbstractUser
from django.db import models

DEFAULT_RANK = "Янтарный маг"
DEFAULT_GRADE = "5 класс"


class User(AbstractUser):
    """Обучающийся (таблица users_user)."""

    grade = models.CharField("Класс", max_length=20, default=DEFAULT_GRADE)
    current_xp = models.IntegerField("Магический опыт", default=0)
    current_rank = models.CharField("Магический ранг", max_length=50, default=DEFAULT_RANK)

    def __str__(self) -> str:
        return self.username
