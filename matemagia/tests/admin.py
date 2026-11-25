from django.contrib import admin
from .models import Task


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('id', 'condition', 'topic', 'task_type', 'difficulty_level', 'is_ai_generated')
    list_filter = ('topic', 'task_type', 'difficulty_level', 'is_ai_generated')
    search_fields = ('condition', 'correct_answer', 'explanation')
    list_select_related = ('topic',)
