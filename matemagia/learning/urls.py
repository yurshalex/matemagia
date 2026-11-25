from django.urls import path

from . import views

urlpatterns = [
    path("topics/", views.topic_list_view, name="topic_list"),
    path("topics/<int:topic_id>/", views.topic_detail_view, name="topic_detail"),
    path("theory/<int:lesson_id>/", views.theory_view, name="theory"),
]
