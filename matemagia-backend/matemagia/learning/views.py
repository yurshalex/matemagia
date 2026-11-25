"""LearningViews: каталог тем, страница темы, теория."""
from django.contrib.auth.decorators import login_required
from django.http import Http404
from django.shortcuts import render
from django.views.decorators.http import require_GET

from core.results import ResultCode

from .services import LearningService

learning_service = LearningService()


@login_required
@require_GET
def topic_list_view(request):
    result = learning_service.get_topics_with_status(request.user)
    # фильтрация карточек по статусу выполняется на клиенте
    return render(request, "learning/topic_catalog.html", {"topics": result.data})


@login_required
@require_GET
def topic_detail_view(request, topic_id):
    result = learning_service.get_topic(topic_id)
    if result.code == ResultCode.NOT_FOUND:
        raise Http404("Тема не найдена")
    return render(request, "learning/topic_detail.html", result.data)


@login_required
@require_GET
def theory_view(request, lesson_id):
    result = learning_service.get_lesson(lesson_id)
    if result.code == ResultCode.NOT_FOUND:
        raise Http404("Урок не найден")
    return render(request, "learning/theory_view.html", result.data)
