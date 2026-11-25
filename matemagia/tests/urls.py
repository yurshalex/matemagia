from django.urls import path
from . import views

urlpatterns = [
    path('tasks/', views.task_list_view, name='task_list'),
    path('tasks/next/', views.task_next_view, name='task_next'),
    path('tasks/<int:task_id>/', views.task_detail_view, name='task_detail'),
    path('tasks/<int:task_id>/check/', views.check_answer_view, name='check_answer'),
]
