from django.db import models


class Topic(models.Model):
    """Математическая тема («Книга заклинаний») — таблица learning_topic."""

    title = models.CharField("Название", max_length=200)
    slug = models.SlugField("ЧПУ-идентификатор", max_length=200, unique=True, allow_unicode=True)
    description = models.TextField("Описание", null=True, blank=True)
    order = models.IntegerField("Порядок", default=0)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self) -> str:
        return self.title


class Lesson(models.Model):
    """Теоретический материал (TheoryMaterial на матрице) — таблица learning_lesson."""

    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name="lessons")
    title = models.CharField("Заголовок", max_length=200)
    content = models.TextField("Текст теории (HTML/Markdown)")
    order = models.IntegerField("Номер урока в теме", default=1)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self) -> str:
        return f"{self.topic.title}: {self.title}"
