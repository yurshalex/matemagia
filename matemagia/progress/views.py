"""ProgressViews: общая статистика, история решений, слабые темы и работа над ошибками."""
from django.contrib.auth.decorators import login_required
from django.http import Http404, HttpResponseBadRequest
from django.shortcuts import render
from django.views.decorators.http import require_GET

from core.optional import optional_class
from core.results import ResultCode

from .services import ProgressService

progress_service = ProgressService()
_RewardService = optional_class("game.services", "RewardService")
reward_service = _RewardService() if _RewardService else None


def _data(result, default=None):
    return result.data if result.ok else default


@login_required
@require_GET
def progress_view(request):
    """/progress/ — общая успеваемость и прогресс по темам."""
    user = request.user
    context = {
        "stats": _data(progress_service.get_user_stats(user)),
        "topic_progress": _data(progress_service.get_topic_progress(user), []),
        "weak_topics": _data(progress_service.get_weak_topics(user), []),
        "rank_info": _data(reward_service.get_rank_info(user)) if reward_service else None,
    }
    return render(request, "progress/progress.html", context)


@login_required
@require_GET
def history_view(request):
    """/progress/history/?page=N — история решений по 20 записей."""
    result = progress_service.get_history(request.user, request.GET.get("page", 1))
    if result.code == ResultCode.VALIDATION_ERROR:
        return HttpResponseBadRequest("Некорректный номер страницы")
    if result.code == ResultCode.NOT_FOUND:
        raise Http404("Страница не найдена")
    return render(request, "progress/history.html", {"history": result.data})


@login_required
@require_GET
def error_analysis_view(request):
    """/progress/errors/ — слабые темы и задания для повторения."""
    user = request.user
    context = {
        "weak_topics": _data(progress_service.get_weak_topics(user), []),
        "error_tasks": _data(progress_service.get_error_tasks(user), []),
    }
    return render(request, "progress/weak_topics.html", context)
