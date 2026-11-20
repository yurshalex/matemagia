"""MainViews: главная страница (гость / дашборд обучающегося)."""
from django.shortcuts import render
from django.views.decorators.http import require_GET

from .optional import optional_class

_RewardService = optional_class("game.services", "RewardService")
_ProgressService = optional_class("progress.services", "ProgressService")


class MainViews:
    reward_service = _RewardService() if _RewardService else None
    progress_service = _ProgressService() if _ProgressService else None


@require_GET
def home_view(request):
    """GET / — home.html для гостя, dashboard_main.html для авторизованного."""
    if not request.user.is_authenticated:
        return render(request, "home.html")

    rank = MainViews.reward_service.get_rank_info(request.user) if MainViews.reward_service else None
    weak = MainViews.progress_service.get_weak_topics(request.user) if MainViews.progress_service else None
    return render(
        request,
        "dashboard_main.html",
        {"rank_info": rank.data if rank and rank.ok else None, "weak_topics": weak.data if weak and weak.ok else []},
    )
