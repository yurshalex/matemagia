from django.contrib import admin

from .models import SolutionAttempt, UserProgress


@admin.register(SolutionAttempt)
class SolutionAttemptAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "task", "is_correct", "xp_earned", "created_at")
    list_filter = ("is_correct", "task__topic", "created_at")
    search_fields = ("user__username", "user_answer")
    date_hierarchy = "created_at"


@admin.register(UserProgress)
class UserProgressAdmin(admin.ModelAdmin):
    list_display = ("user", "topic", "tasks_solved", "tasks_correct", "error_rate", "difficulty_level")
    list_filter = ("topic", "difficulty_level")
    search_fields = ("user__username",)
