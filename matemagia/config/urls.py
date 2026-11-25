"""Корневые маршруты: «/» (home_view) и подключение urls приложений."""
from django.contrib import admin
from django.urls import include, path

from core.views import home_view

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", home_view, name="home"),
    path("", include("users.urls")),
    path("", include("learning.urls")),
    path("", include("tests.urls")),     # следующие части проекта
    # path("", include("progress.urls")),
    # path("", include("game.urls")),  # вторая половина проекта
]
