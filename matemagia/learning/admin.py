from django.contrib import admin

from .models import Lesson, Topic


class LessonInline(admin.TabularInline):
    model = Lesson
    extra = 0


@admin.register(Topic)
class TopicAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "order")
    prepopulated_fields = {"slug": ("title",)}
    inlines = [LessonInline]


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ("title", "topic", "order")
    list_filter = ("topic",)
