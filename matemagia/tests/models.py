from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator


class Task(models.Model):
    class Type(models.TextChoices):
        CHOICE = 'choice', 'Выбор ответа'
        INPUT = 'input', 'Ввод числа'
        MATCHING = 'matching', 'Сопоставление'
        BOOLEAN = 'boolean', 'Верно / неверно'
        ORDERING = 'ordering', 'Упорядочивание'

    topic = models.ForeignKey('learning.Topic', on_delete=models.CASCADE, related_name='tasks')
    task_type = models.CharField(max_length=30, choices=Type.choices)
    condition = models.TextField()
    content_payload = models.JSONField(null=True, blank=True)
    correct_answer = models.TextField()
    explanation = models.TextField(null=True, blank=True)
    difficulty_level = models.IntegerField(default=1, validators=[MinValueValidator(1), MaxValueValidator(3)])
    is_ai_generated = models.BooleanField(default=False)

    class Meta:
        db_table = 'tasks_task'
        constraints = [models.CheckConstraint(condition=models.Q(difficulty_level__gte=1, difficulty_level__lte=3), name='task_difficulty_1_3')]

    def __str__(self):
        return self.condition[:80]
