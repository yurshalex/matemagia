import json
from django.db import transaction, DatabaseError
from django.apps import apps
from django.contrib.auth import get_user_model
from core.results import ResultCode, ServiceResult
from core.optional import optional_class
from .models import Task
from .checker import AnswerChecker


class _IntegrationFailure(Exception):
    def __init__(self, result):
        self.result = result


class TaskService:
    def __init__(self, progress_service=None, reward_service=None, adaptive_service=None):
        self.progressService = progress_service
        self.rewardService = reward_service
        self.adaptiveService = adaptive_service

    def _service(self, supplied, module, name):
        if supplied is not None:
            return supplied
        if not apps.is_installed(module.split(".")[0]):
            return None
        cls = optional_class(module, name)
        return cls() if cls else None

    def _get_model(self, task_id):
        task = Task.objects.filter(pk=task_id).first()
        if task is None:
            return ServiceResult.fail(ResultCode.NOT_FOUND, {'task': 'Задание не найдено'})
        return ServiceResult.success(task)

    def get_task(self, task_id):
        result = self._get_model(task_id)
        return ServiceResult.success(self.serialize_task(result.data)) if result.ok else result

    def validate_answer_format(self, task, raw_answer):
        try:
            AnswerChecker.normalize(task, raw_answer)
        except (ValueError, TypeError, ZeroDivisionError, OverflowError):
            return ServiceResult.fail(ResultCode.INVALID_ANSWER_FORMAT, {'answer': 'Некорректный формат ответа'})
        return ServiceResult.success(raw_answer)

    @staticmethod
    def serialize_task(task):
        keys = {'choice': ('options',), 'ordering': ('items',), 'matching': ('left', 'right')}.get(task.task_type, ())
        payload = {k: (task.content_payload or {})[k] for k in keys if k in (task.content_payload or {})}
        return {'id': task.pk, 'topic_id': task.topic_id, 'task_type': task.task_type,
                'condition': task.condition, 'question': task.condition, 'type': task.task_type, 'content_payload': payload,
                'difficulty_level': task.difficulty_level, **payload}

    def get_next_task(self, user, topic_id=None, task_type=None, difficulty=None, exclude_ids=()):
        adaptive = self._service(self.adaptiveService, 'adaptive.services', 'AdaptiveService')
        if adaptive and hasattr(adaptive, "pick_next_task"):
            result = adaptive.pick_next_task(user, topic_id, task_type, difficulty, exclude_ids=exclude_ids)
            if result.ok and isinstance(result.data, Task) and result.data.pk not in exclude_ids:
                task = result.data
                return ServiceResult.success(self.serialize_task(task))
        qs = Task.objects.exclude(pk__in=exclude_ids)
        if topic_id is not None:
            qs = qs.filter(topic_id=topic_id)
        if task_type:
            qs = qs.filter(task_type=task_type)
        if difficulty is not None:
            qs = qs.filter(difficulty_level=difficulty)
        task = qs.order_by('?').first()
        return ServiceResult.success(self.serialize_task(task)) if task else ServiceResult.fail(ResultCode.NO_TASKS_AVAILABLE, {'task': 'Нет доступных заданий'})

    def check_answer(self, user, task_id, raw_answer, record_xp=True):
        result = self._get_model(task_id)
        if not result.ok:
            return result
        task = result.data
        validation = self.validate_answer_format(task, raw_answer)
        if not validation.ok:
            return validation
        progress = self._service(self.progressService, 'progress.services', 'ProgressService')
        reward = self._service(self.rewardService, 'game.services', 'RewardService')
        data = {'xp_earned': 0, 'attempt_recorded': False, 'correct_answer': task.correct_answer, 'total_xp': user.current_xp, 'rank': user.current_rank, 'rank_changed': False, 'new_achievements': []}
        try:
            with transaction.atomic():
                try:
                    correct = AnswerChecker.check(task, raw_answer)
                except (ValueError, TypeError, ZeroDivisionError, OverflowError):
                    return ServiceResult.fail(ResultCode.INTERNAL_ERROR, {"task": "Некорректный эталон ответа"})
                data.update(is_correct=correct, explanation=AnswerChecker.build_explanation(task, correct))
                if progress:
                    locked_user = get_user_model().objects.select_for_update().get(pk=user.pk)
                    answer_text = raw_answer if isinstance(raw_answer, str) else json.dumps(raw_answer, ensure_ascii=False)
                    attempt = progress.record_attempt(user=locked_user, task=task, user_answer=answer_text, is_correct=correct)
                    if not attempt.ok:
                        raise _IntegrationFailure(attempt)
                    data['attempt_recorded'] = True
                    if reward and record_xp:
                        awarded = reward.process_attempt(user=locked_user, task=task, is_correct=correct, attempt=attempt.data)
                        if not awarded.ok:
                            raise _IntegrationFailure(awarded)
                        if isinstance(awarded.data, dict):
                            data.update(awarded.data)
        except DatabaseError:
            return ServiceResult.fail(ResultCode.INTERNAL_ERROR, {"__all__": "Ошибка сохранения результата"})
        except _IntegrationFailure as exc:
            return exc.result
        if progress:
            user.refresh_from_db(fields=["current_xp", "current_rank"])
            data["total_xp"] = user.current_xp
            data["rank"] = user.current_rank
        return ServiceResult.success(data)
