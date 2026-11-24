from django.contrib import admin

from .models import Achievement, ChallengeResult, UserAchievement


@admin.register(Achievement)
class AchievementAdmin(admin.ModelAdmin):
    list_display = ("code", "title", "icon_code", "xp_reward")
    search_fields = ("code", "title")


@admin.register(UserAchievement)
class UserAchievementAdmin(admin.ModelAdmin):
    list_display = ("user", "achievement", "unlocked_at")
    list_filter = ("achievement",)
    search_fields = ("user__username",)


@admin.register(ChallengeResult)
class ChallengeResultAdmin(admin.ModelAdmin):
    list_display = ("user", "topic", "correct", "total", "score", "success", "bonus_xp", "created_at")
    list_filter = ("success", "topic")
    search_fields = ("user__username",)
