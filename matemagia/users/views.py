"""AuthViews: регистрация, вход, выход, личный кабинет."""
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from core.results import ServiceResult
from core.optional import optional_class

from .services import AuthService

auth_service = AuthService()
_ProgressService = optional_class("progress.services", "ProgressService")
progress_service = _ProgressService() if _ProgressService else None
_RewardService = optional_class("game.services", "RewardService")
reward_service = _RewardService() if _RewardService else None
_BACKEND = "django.contrib.auth.backends.ModelBackend"


def _safe_next(request) -> str:
    target = request.POST.get("next") or request.GET.get("next") or ""
    if target and url_has_allowed_host_and_scheme(
        target, allowed_hosts={request.get_host()}, require_https=request.is_secure()
    ):
        return target
    return "/"


@require_http_methods(["GET", "POST"])
def register_view(request):
    if request.user.is_authenticated:
        return redirect("/profile/")

    if request.method == "POST":
        result = auth_service.register(request.POST)
        if result.ok:
            login(request, result.data, backend=_BACKEND)
            return redirect("/profile/")
        keys = ("email", "username", "full_name", "first_name", "phone", "grade")
        values = {k: request.POST.get(k, "") for k in keys}  # без пароля
        return render(request, "users/register.html", {"errors": result.errors, "values": values})

    return render(request, "users/register.html", {"errors": {}, "values": {}})


@require_http_methods(["GET", "POST"])
def login_view(request):
    if request.user.is_authenticated:
        return redirect("/")

    if request.method == "POST":
        result = auth_service.login(request.POST)
        if result.ok:
            login(request, result.data, backend=_BACKEND)
            return redirect(_safe_next(request))
        context = {
            "errors": result.errors,
            "values": {"username": request.POST.get("username", "")},
            "next": request.POST.get("next", ""),
        }
        return render(request, "users/auth_login.html", context)

    return render(
        request, "users/auth_login.html", {"errors": {}, "values": {}, "next": request.GET.get("next", "")}
    )


@require_POST
def logout_view(request):
    auth_service.logout(request.user)
    logout(request)
    return redirect("/")


def _data(result: ServiceResult, default=None):
    return result.data if result.ok else default


@login_required
@require_GET
def profile_view(request):
    """Личный кабинет: статистика, ранг, достижения, последние попытки."""
    user = request.user
    context = {
        "profile_user": user,
        "stats": _data(progress_service.get_user_stats(user)) if progress_service else None,
        "topic_progress": _data(progress_service.get_topic_progress(user), []) if progress_service else [],
        "weak_topics": _data(progress_service.get_weak_topics(user), []) if progress_service else [],
        "recent_attempts": _data(progress_service.get_recent_attempts(user), []) if progress_service else [],
        "rank_info": _data(reward_service.get_rank_info(user)) if reward_service else None,
        "achievements": _data(reward_service.get_achievements(user)) if reward_service else None,
        "challenges_passed": reward_service.count_passed_challenges(user) if reward_service else 0,
    }
    return render(request, "progress/profile_stats.html", context)
