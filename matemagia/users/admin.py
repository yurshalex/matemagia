from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ("username", "first_name", "grade", "current_rank", "current_xp", "is_staff")
    fieldsets = DjangoUserAdmin.fieldsets + (("МатеМагия", {"fields": ("grade", "current_xp", "current_rank")}),)
    add_fieldsets = DjangoUserAdmin.add_fieldsets + (("МатеМагия", {"fields": ("first_name", "grade")}),)
