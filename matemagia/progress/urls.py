from django.urls import path

from . import views

urlpatterns = [
    path("progress/", views.progress_view, name="progress"),
    path("progress/history/", views.history_view, name="history"),
    path("progress/errors/", views.error_analysis_view, name="errors"),
]
