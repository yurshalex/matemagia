"""RewardService: опыт, серия, ранги, достижения. (ChallengeService — отдельным шагом.)"""
import logging
from datetime import timedelta

from django.conf import settings
from django.db import DatabaseError, transaction
from django.utils import timezone

from core.results import ResultCode, ServiceResult
from progress.models import SolutionAttempt

from .models import Achievement, ChallengeResult, UserAchievement

logger = logging.getLogger(__name__)


class RewardService:
    """Конструктор без аргументов: его вызывают core.views и users.views."""

    def __init__(self):
        self._thresholds = None
        # код достижения -> функция (user, context) -> bool
        self.achievement_rules = {
            "first_task": lambda u, c: self._solved(u) >= 1,
            "ten_tasks": lambda u, c: self._solved(u) >= 10,
            "fifty_tasks": lambda u, c: self._solved(u) >= 50,
            "century": lambda u, c: self._solved(u) >= 100,
            "no_errors": self._rule_no_errors,
            "three_challenges": lambda u, c: self.count_passed_challenges(u) >= 3,
            "week_streak": self._rule_week_streak,
            "fix_errors": lambda u, c: bool(c.get("fixed_error")),
        }

    # ---------- пороги рангов (можно переопределить в тесте) ----------
    @property
    def rank_thresholds(self):
        return self._thresholds or sorted(settings.RANK_THRESHOLDS, key=lambda t: t[0])

    @rank_thresholds.setter
    def rank_thresholds(self, value):
        self._thresholds = sorted(value, key=lambda t: t[0]) if value else None

    def _rank_for_xp(self, xp: int) -> str:
        name = self.rank_thresholds[0][1]
        for threshold, title in self.rank_thresholds:
            if threshold <= xp:
                name = title
        return name

    # ---------- опыт ----------
    def calculate_xp(self, difficulty, streak) -> ServiceResult:
        coef = settings.DIFFICULTY_COEF.get(difficulty)
        if coef is None:
            return ServiceResult.fail(ResultCode.VALIDATION_ERROR, {"difficulty": "Недопустимая сложность"})
        xp = round(settings.BASE_XP * coef)
        if streak >= settings.STREAK_MIN:
            xp += settings.STREAK_BONUS_XP
        return ServiceResult.success(xp)

    def get_streak(self, user) -> ServiceResult:
        streak = 0
        flags = SolutionAttempt.objects.filter(user=user).order_by("-created_at", "-id").values_list("is_correct", flat=True)
        for is_correct in flags:
            if not is_correct:
                break
            streak += 1
        return ServiceResult.success(streak)

    def award_xp(self, user, xp, context=None) -> ServiceResult:
        if xp < 0:
            return ServiceResult.fail(ResultCode.VALIDATION_ERROR, {"xp": "Опыт не может быть отрицательным"})
        try:
            with transaction.atomic():
                old_rank = user.current_rank
                user.current_xp += xp
                user.save(update_fields=["current_xp"])
                self.update_rank(user)
                unlocked = self._unlock(user, context or {})
        except DatabaseError:
            logger.exception("Ошибка начисления опыта")
            return ServiceResult.fail(ResultCode.INTERNAL_ERROR, {"__all__": "Внутренняя ошибка"})
        return ServiceResult.success(
            {
                "total_xp": user.current_xp,
                "rank": user.current_rank,
                "rank_changed": user.current_rank != old_rank,
                "new_achievements": [a.code for a in unlocked],
                "new_achievements_info": self._info(unlocked),
            }
        )

    # ---------- ранги ----------
    def update_rank(self, user) -> ServiceResult:
        new_rank = self._rank_for_xp(user.current_xp)
        changed = new_rank != user.current_rank
        if changed:
            user.current_rank = new_rank
            user.save(update_fields=["current_rank"])
        return ServiceResult.success({"rank": new_rank, "changed": changed})

    def get_rank_info(self, user) -> ServiceResult:
        xp = user.current_xp
        thresholds = self.rank_thresholds
        current_threshold = max(t for t, _ in thresholds if t <= xp) if xp >= thresholds[0][0] else thresholds[0][0]
        upcoming = next(((t, n) for t, n in thresholds if t > xp), None)
        ranks = [{"name": n, "threshold": t, "reached": t <= xp} for t, n in thresholds]
        if upcoming is None:
            data = {"rank": user.current_rank, "xp": xp, "next_rank": None, "xp_to_next": 0, "progress_percent": 100}
        else:
            span = upcoming[0] - current_threshold
            data = {
                "rank": user.current_rank,
                "xp": xp,
                "next_rank": upcoming[1],
                "xp_to_next": upcoming[0] - xp,
                "progress_percent": round((xp - current_threshold) / span * 100) if span else 0,
            }
        data["ranks"] = ranks  # для страницы «Ранги и достижения»
        return ServiceResult.success(data)

    # ---------- достижения ----------
    def check_achievements(self, user, context=None) -> ServiceResult:
        """Возвращает коды вновь полученных достижений."""
        try:
            with transaction.atomic():
                unlocked = self._unlock(user, context or {})
        except DatabaseError:
            logger.exception("Ошибка выдачи достижений")
            return ServiceResult.fail(ResultCode.INTERNAL_ERROR, {"__all__": "Внутренняя ошибка"})
        return ServiceResult.success([a.code for a in unlocked])

    def achievements_info(self, codes) -> list:
        return self._info(Achievement.objects.filter(code__in=codes))

    def get_achievements(self, user) -> ServiceResult:
        got = {ua.achievement_id: ua.unlocked_at for ua in UserAchievement.objects.filter(user=user)}
        items = [
            {
                "code": a.code, "title": a.title, "description": a.description,
                "icon_code": a.icon_code, "xp_reward": a.xp_reward,
                "unlocked": a.pk in got, "unlocked_at": got.get(a.pk),
            }
            for a in Achievement.objects.all()
        ]
        return ServiceResult.success({"items": items, "unlocked_count": len(got), "total": len(items)})

    def count_passed_challenges(self, user) -> int:
        """Число успешно пройденных испытаний (обычное число, не ServiceResult)."""
        return ChallengeResult.objects.filter(user=user, success=True).count()

    # ---------- главный вход для тренажёра ----------
    def process_attempt(self, user, task, is_correct, attempt=None) -> ServiceResult:
        """Вызывается ПОСЛЕ ProgressService.record_attempt.

        Опыт — только за первую попытку по заданию. Если передан attempt (только что
        записанная SolutionAttempt), в неё дописывается xp_earned.
        """
        previous = SolutionAttempt.objects.filter(user=user, task=task)
        if attempt is not None:
            previous = previous.exclude(pk=attempt.pk).filter(pk__lt=attempt.pk)
        first = not previous.exists()
        fixed = bool(is_correct) and not previous.filter(is_correct=True).exists() and previous.filter(is_correct=False).exists()

        xp = 0
        if is_correct and first:
            streak = self.get_streak(user).data  # попытка уже записана, серия включает её
            calc = self.calculate_xp(task.difficulty_level, streak)
            if not calc.ok:
                return calc
            xp = calc.data
            if attempt is not None and xp:
                SolutionAttempt.objects.filter(pk=attempt.pk).update(xp_earned=xp)

        result = self.award_xp(user, xp, {"fixed_error": fixed})
        if not result.ok:
            return result
        data = dict(result.data)
        data["xp_earned"] = xp
        return ServiceResult.success(data)

    # ---------- внутреннее ----------
    @staticmethod
    def _info(achievements) -> list:
        return [{"code": a.code, "title": a.title, "icon_code": a.icon_code, "xp_reward": a.xp_reward} for a in achievements]

    def _unlock(self, user, context) -> list:
        have = set(UserAchievement.objects.filter(user=user).values_list("achievement__code", flat=True))
        unlocked, bonus = [], 0
        for ach in Achievement.objects.exclude(code__in=have):
            rule = self.achievement_rules.get(ach.code)
            if rule and rule(user, context):
                UserAchievement.objects.get_or_create(user=user, achievement=ach)
                unlocked.append(ach)
                bonus += ach.xp_reward
        if bonus:
            user.current_xp += bonus
            user.save(update_fields=["current_xp"])
            self.update_rank(user)
        return unlocked

    @staticmethod
    def _solved(user) -> int:
        return SolutionAttempt.objects.filter(user=user, is_correct=True).values("task").distinct().count()

    @staticmethod
    def _rule_no_errors(user, context) -> bool:
        ch = context.get("challenge") or {}
        return bool(ch.get("total")) and ch.get("correct") == ch.get("total")

    @staticmethod
    def _rule_week_streak(user, context) -> bool:
        since = timezone.now() - timedelta(days=8)
        stamps = SolutionAttempt.objects.filter(user=user, created_at__gte=since).values_list("created_at", flat=True)
        days = {timezone.localtime(s).date() for s in stamps}
        today = timezone.localdate()
        return all(today - timedelta(days=i) in days for i in range(7))


# ======================================================================
# ChallengeService — режим «Испытание» (состояние хранится в сессии Django)
# ======================================================================
CHALLENGE_KEY = "challenge"
CHALLENGE_RESULT_KEY = "challenge_result"
_FEEDBACK_FIELDS = ("is_correct", "explanation", "correct_answer", "xp_earned", "total_xp", "rank", "rank_changed", "new_achievements")


class ChallengeService:
    """Серия из CHALLENGE_TASKS_COUNT заданий; сложность растёт с номером задания.

    TaskService и RewardService подключаются лениво: так нет циклического импорта
    game.services <-> tests.services.
    """

    def __init__(self, task_service=None, reward_service=None):
        self._task_service = task_service
        self._reward_service = reward_service

    @property
    def taskService(self):
        if self._task_service is None:
            from tests.services import TaskService
            self._task_service = TaskService()
        return self._task_service

    @property
    def rewardService(self):
        if self._reward_service is None:
            self._reward_service = RewardService()
        return self._reward_service

    @staticmethod
    def difficulty_for_position(position: int) -> int:
        """Задания 1–3 — сложность 1, 4–7 — сложность 2, 8–10 — сложность 3."""
        return 1 if position <= 3 else 2 if position <= 7 else 3

    # ---------- запуск ----------
    def start_challenge(self, session, user, topic_id) -> ServiceResult:
        from learning.models import Topic

        if not Topic.objects.filter(pk=topic_id).exists():
            return ServiceResult.fail(ResultCode.NOT_FOUND, {"topic": "Тема не найдена"})
        session.pop(CHALLENGE_KEY, None)
        session.pop(CHALLENGE_RESULT_KEY, None)

        total = settings.CHALLENGE_TASKS_COUNT
        first = self.taskService.get_next_task(user, topic_id, None, difficulty=self.difficulty_for_position(1))
        if not first.ok:
            return first  # 3002 и т.п.
        session[CHALLENGE_KEY] = {
            "topic_id": topic_id, "position": 1, "total": total, "task_id": first.data["id"],
            "issued": [first.data["id"]], "answered": 0, "correct": 0, "score": 0,
        }
        return ServiceResult.success({"position": 1, "total": total})

    # ---------- текущее задание ----------
    def get_current_task(self, session, user=None) -> ServiceResult:
        state = session.get(CHALLENGE_KEY)
        if not state:
            return ServiceResult.fail(ResultCode.CHALLENGE_NOT_ACTIVE, {"challenge": "Испытание не запущено"})
        if state.get("task_id") is None:  # прошлый подбор не удался — пробуем снова
            if user is None:
                return ServiceResult.fail(ResultCode.NO_TASKS_AVAILABLE, {"task": "Задание не подобрано"})
            nxt = self._fetch(user, state)
            if not nxt.ok:
                return nxt
            state["task_id"] = nxt.data["id"]
            state["issued"].append(nxt.data["id"])
            session[CHALLENGE_KEY] = state
        task = self.taskService.get_task(state["task_id"])
        if not task.ok:
            return task
        return ServiceResult.success({"task": task.data, "position": state["position"], "total": state["total"]})

    def _fetch(self, user, state) -> ServiceResult:
        return self.taskService.get_next_task(
            user, state["topic_id"], None,
            difficulty=self.difficulty_for_position(state["position"]), exclude_ids=state["issued"],
        )

    # ---------- ответ ----------
    def submit_answer(self, session, user, raw_answer) -> ServiceResult:
        state = session.get(CHALLENGE_KEY)
        if not state:
            return ServiceResult.fail(ResultCode.CHALLENGE_NOT_ACTIVE, {"challenge": "Испытание не запущено"})
        current = self.get_current_task(session, user)
        if not current.ok:
            return current
        state = session[CHALLENGE_KEY]
        task_id = state["task_id"]

        checked = self.taskService.check_answer(user, task_id, raw_answer, record_xp=True)
        if not checked.ok:
            return checked  # 3001: позиция не меняется

        info = checked.data
        from tests.models import Task
        difficulty = Task.objects.filter(pk=task_id).values_list("difficulty_level", flat=True).first() or 1
        state["answered"] += 1
        if info["is_correct"]:
            state["correct"] += 1
            state["score"] += difficulty
        answered_position = state["position"]
        feedback = {k: info[k] for k in _FEEDBACK_FIELDS}
        feedback["answered_position"] = answered_position

        if state["answered"] >= state["total"]:
            state["task_id"] = None
            session[CHALLENGE_KEY] = state
            finished = self.finish_challenge(session, user)
            if not finished.ok:
                return finished
            return ServiceResult.success({**feedback, "finished": True, "position": state["total"], "result": finished.data})

        state["position"] = answered_position + 1
        state["task_id"] = None
        session[CHALLENGE_KEY] = state  # ответ уже учтён, даже если следующее задание не подберётся
        nxt = self._fetch(user, state)
        if not nxt.ok:
            return nxt  # 3002; get_current_task повторит подбор
        state["task_id"] = nxt.data["id"]
        state["issued"].append(nxt.data["id"])
        session[CHALLENGE_KEY] = state
        return ServiceResult.success({**feedback, "finished": False, "position": state["position"]})

    # ---------- итог ----------
    def finish_challenge(self, session, user) -> ServiceResult:
        from learning.models import Topic

        state = session.get(CHALLENGE_KEY)
        if not state:
            return ServiceResult.fail(ResultCode.CHALLENGE_NOT_ACTIVE, {"challenge": "Испытание не запущено"})
        if state["answered"] < state["total"]:
            return ServiceResult.fail(ResultCode.CHALLENGE_NOT_FINISHED, {"challenge": "Даны ответы не на все задания"})

        correct, total, score = state["correct"], state["total"], state["score"]
        success = correct * 100 >= settings.CHALLENGE_SUCCESS_PERCENT * total
        bonus = settings.CHALLENGE_BONUS_XP if success else 0
        context = {"challenge": {"correct": correct, "total": total, "success": success}}
        topic = Topic.objects.filter(pk=state["topic_id"]).first()
        try:
            with transaction.atomic():
                # запись создаётся до выдачи достижений: «три испытания» считает и её
                ChallengeResult.objects.create(
                    user=user, topic_id=state["topic_id"], correct=correct, total=total,
                    score=score, success=success, bonus_xp=bonus,
                )
                old_rank = user.current_rank
                if success:
                    awarded = self.rewardService.award_xp(user, bonus, context)
                    if not awarded.ok:
                        raise DatabaseError(str(awarded.errors))
                    achievements = awarded.data["new_achievements_info"]
                else:
                    checked = self.rewardService.check_achievements(user, context)
                    if not checked.ok:
                        raise DatabaseError(str(checked.errors))
                    achievements = self.rewardService.achievements_info(checked.data)
        except DatabaseError:
            logger.exception("Ошибка завершения испытания")
            return ServiceResult.fail(ResultCode.INTERNAL_ERROR, {"__all__": "Внутренняя ошибка"})

        result = {
            "correct": correct, "total": total, "score": score, "success": success, "bonus_xp": bonus,
            "percent": round(correct / total * 100) if total else 0,
            "rank": user.current_rank, "rank_changed": user.current_rank != old_rank,
            "new_achievements": achievements,
            "topic_id": state["topic_id"], "topic_title": topic.title if topic else "",
        }
        session[CHALLENGE_RESULT_KEY] = result
        session.pop(CHALLENGE_KEY, None)
        return ServiceResult.success(result)

    def get_result(self, session) -> ServiceResult:
        result = session.get(CHALLENGE_RESULT_KEY)
        if not result:
            return ServiceResult.fail(ResultCode.CHALLENGE_NOT_ACTIVE, {"challenge": "Завершённого испытания нет"})
        return ServiceResult.success(result)
