"""Тесты интеграционного контракта AdaptiveService (не требуют сетевых запросов)."""

from unittest.mock import Mock

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from core.results import ResultCode, ServiceResult
from learning.models import Topic
from progress.models import SolutionAttempt, UserProgress
from tests.models import Task
from .gigachat import GigaChatClient
from .services import AdaptiveService


class GigaChatClientTests(TestCase):
    @override_settings(GIGACHAT_AUTH_KEY="")
    def test_without_key_makes_no_http_calls(self):
        session = Mock()
        client = GigaChatClient(session=session)
        result = client.request_generation({
            "topic_id": 1, "topic_title": "Дроби", "grade": 5,
            "difficulty_level": 1, "task_type": "input",
        })
        self.assertEqual(result.code, ResultCode.AI_UNAVAILABLE)
        session.post.assert_not_called()

    def test_parse_json_and_invalid_response(self):
        self.assertTrue(GigaChatClient.parse_response('```json\n{"task_type": "input"}\n```').ok)
        self.assertEqual(GigaChatClient.parse_response("не JSON").code, ResultCode.AI_INVALID_RESPONSE)


class AdaptiveServiceTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="test-adaptive", password="test-password")
        self.topic = Topic.objects.create(title="Дроби", slug="test-adaptive-fractions")
        self.task = Task.objects.create(
            topic=self.topic, task_type="input", condition="1+1", content_payload={},
            correct_answer="2", explanation="Два", difficulty_level=1,
            is_ai_generated=False,
        )
        self.client = Mock()
        self.client.auth_key = "not-a-real-secret"
        self.service = AdaptiveService(gigachat_client=self.client)

    def test_generated_task_saved_without_leaking_correct_answer(self):
        self.client.request_generation.return_value = ServiceResult.success({
            "task_type": "choice", "condition": "Сколько будет 2+2?",
            "content_payload": {"options": ["3", "4", "5"]},
            "correct_answer": "4", "explanation": "Два и два — четыре",
            "difficulty_level": 1,
        })
        result = self.service.pick_next_task(self.user, self.topic.pk, "choice", 1)
        self.assertTrue(result.ok)
        self.assertTrue(result.data.is_ai_generated)
        self.assertNotIn("correct_answer", __import__("tests.services", fromlist=["TaskService"]).TaskService.serialize_task(result.data))

    def test_invalid_generation_does_not_mix_formats(self):
        self.client.request_generation.return_value = ServiceResult.success({
            "task_type": "choice",
            "condition": "Сколько будет 2+2?",
            "content_payload": {"options": ["3", "4"]},
            "correct_answer": "5",
            "explanation": "Ошибка",
            "difficulty_level": 1,
        })

        result = self.service.pick_next_task(
            self.user, self.topic.pk, "choice", 1
        )

        self.assertFalse(result.ok)
        self.assertEqual(
            result.code,
            ResultCode.NO_TASKS_AVAILABLE
        )

    def test_fallback_does_not_repeat_task(self):
        result = self.service.get_fallback_task(self.topic.pk, "input", 1, [self.task.pk])
        self.assertEqual(result.code, ResultCode.NO_TASKS_AVAILABLE)

    def test_difficulty_after_each_five_answers_is_idempotent(self):
        progress = UserProgress.objects.create(user=self.user, topic=self.topic, tasks_solved=10, tasks_correct=9)
        for is_correct in [True, True, True, True, True, True, True, True, True, False]:
            SolutionAttempt.objects.create(user=self.user, task=self.task, user_answer="2", is_correct=is_correct)
        self.assertEqual(self.service.determine_difficulty(self.user, self.topic.pk).data, 3)
        self.assertEqual(self.service.determine_difficulty(self.user, self.topic.pk).data, 3)
        progress.refresh_from_db()
        self.assertEqual(progress.difficulty_level, 3)
