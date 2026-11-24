from django.urls import path

from . import views

urlpatterns = [
    path("game/start/", views.game_start_view, name="game_start"),
    path("game/result/", views.game_result_view, name="game_result"),
    path("game/", views.game_session_view, name="game"),
    path("achievements/", views.achievements_view, name="achievements"),
]
