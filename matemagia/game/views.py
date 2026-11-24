"""GameViews: режим «Испытание», результат, ранги и достижения."""
import json

from django.contrib.auth.decorators import login_required
from django.http import Http404, HttpResponseBadRequest, JsonResponse
from django.shortcuts import redirect, render
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from core.results import ResultCode
from learning.models import Topic

from .services import ChallengeService, RewardService

challenge_service = ChallengeService()
reward_service = RewardService()

LEVELS_TOTAL = 4  # карта уровней в макете: «Уровень 1…4»


def _wants_json(request) -> bool:
    return (
        request.headers.get("x-requested-with") == "XMLHttpRequest"
        or "application/json" in request.headers.get("accept", "")
        or request.content_type == "application/json"
    )


def _read_answer(request):
    if request.content_type == "application/json":
        try:
            body = json.loads(request.body or b"{}")
        except ValueError:
            return None
        return body.get("answer") if isinstance(body, dict) else None
    return request.POST.get("answer")


def _levels(user) -> dict:
    """Пройденные уровни = число успешно пройденных испытаний (вместо localStorage в прототипе)."""
    passed = reward_service.count_passed_challenges(user)
    levels = []
    for n in range(1, LEVELS_TOTAL + 1):
        status = "passed" if n <= passed else "open" if n == passed + 1 else "locked"
        levels.append({"level": n, "status": status})
    return {"levels": levels, "levels_passed": passed}


@login_required
@require_POST
def game_start_view(request):
    """POST /game/start/ — сбрасывает старое испытание, создаёт новое, редирект на /game/."""
    raw = (request.POST.get("topic_id") or request.POST.get("topic") or "").strip()
    if not raw.isdigit():
        return HttpResponseBadRequest("Не выбрана тема")
    result = challenge_service.start_challenge(request.session, request.user, int(raw))
    if result.code in (ResultCode.NOT_FOUND, ResultCode.NO_TASKS_AVAILABLE):
        raise Http404("Тема или задания не найдены")
    if not result.ok:
        return HttpResponseBadRequest("Не удалось начать испытание")
    return redirect("game")


@login_required
@require_http_methods(["GET", "POST"])
def game_session_view(request):
    """GET — стартовый экран или текущее задание; POST — ответ на задание."""
    if request.method == "POST":
        return _submit(request)

    context = {
        "topics": Topic.objects.all(),
        "rank_info": reward_service.get_rank_info(request.user).data,
        **_levels(request.user),
        "active": False,
    }
    current = challenge_service.get_current_task(request.session, request.user)
    if current.ok:
        context.update(active=True, **current.data)
    return render(request, "game/challenge_game.html", context)


def _submit(request):
    result = challenge_service.submit_answer(request.session, request.user, _read_answer(request))
    ajax = _wants_json(request)

    if result.ok:
        data = dict(result.data)
        if ajax:
            if not data["finished"]:
                current = challenge_service.get_current_task(request.session, request.user)
                if current.ok:
                    data["task"] = current.data["task"]
            return JsonResponse(data)
        return redirect("game_result" if data["finished"] else "game")

    if result.code == ResultCode.CHALLENGE_NOT_ACTIVE:
        if ajax:
            return JsonResponse({"code": result.code, "errors": result.errors}, status=409)
        return redirect("game")
    status = 400 if result.code == ResultCode.INVALID_ANSWER_FORMAT else 404 if result.code == ResultCode.NO_TASKS_AVAILABLE else 500
    if ajax:
        return JsonResponse({"code": result.code, "errors": result.errors}, status=status)
    if status == 400:
        current = challenge_service.get_current_task(request.session, request.user)
        context = {"errors": result.errors, "active": current.ok, "topics": Topic.objects.all(),
                   "rank_info": reward_service.get_rank_info(request.user).data, **_levels(request.user)}
        if current.ok:
            context.update(current.data)
        return render(request, "game/challenge_game.html", context)
    if status == 404:
        raise Http404("Не удалось подобрать задание")
    return render(request, "500.html", status=500)


@login_required
@require_GET
def game_result_view(request):
    result = challenge_service.get_result(request.session)
    if not result.ok:
        return redirect("game")
    return render(request, "game/game_result.html", {"result": result.data})


@login_required
@require_GET
def achievements_view(request):
    """/achievements/ — ранги и достижения."""
    user = request.user
    context = {
        "rank_info": reward_service.get_rank_info(user).data,
        "achievements": reward_service.get_achievements(user).data,
        "challenges_passed": reward_service.count_passed_challenges(user),
    }
    return render(request, "game/achievements_list.html", context)
