
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
            "topic_id": 1,
            "topic_title": "Дроби",
            "grade": 5,
            "difficulty_level": 1,
            "task_type": "input",
        })

        self.assertEqual(result.code, ResultCode.AI_UNAVAILABLE)
        session.post.assert_not_called()

    def test_parse_json_and_invalid_response(self):
        self.assertTrue(
            GigaChatClient.parse_response(
                '```json\n{"task_type": "input"}\n```'
            ).ok
        )

        self.assertEqual(
            GigaChatClient.parse_response("не JSON").code,
            ResultCode.AI_INVALID_RESPONSE,
        )

    @override_settings(GIGACHAT_AUTH_KEY="fake-test-key")
    def test_certificate_error_returns_ai_unavailable(self):
        """Ошибка чтения сертификата не должна приводить к исключению."""
        session = Mock()
        session.post.side_effect = OSError(
            "Не удалось прочитать SSL-сертификат"
        )

        client = GigaChatClient(session=session)
        result = client.get_access_token()

        self.assertFalse(result.ok)
        self.assertEqual(result.code, ResultCode.AI_UNAVAILABLE)
        session.post.assert_called_once()


    def test_generation_certificate_error_returns_ai_unavailable(self):
        """Ошибка сертификата при генерации должна обрабатываться."""
        session = Mock()
        session.post.side_effect = OSError(
            "Не удалось прочитать SSL-сертификат"
        )

        client = GigaChatClient(session=session)

        # Имитируем успешную авторизацию без обращения к сети.
        client.get_access_token = Mock(
            return_value=ServiceResult.success("fake-token")
        )

        result = client.request_generation({
            "topic_id": 1,
            "topic_title": "Дроби",
            "grade": 5,
            "difficulty_level": 1,
            "task_type": "choice",
        })

        self.assertFalse(result.ok)
        self.assertEqual(result.code, ResultCode.AI_UNAVAILABLE)
        session.post.assert_called_once()


class AdaptiveServiceTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="test-adaptive",
            password="test-password",
        )

        self.topic = Topic.objects.create(
            title="Дроби",
            slug="test-adaptive-fractions",
        )

        self.task = Task.objects.create(
            topic=self.topic,
            task_type="input",
            condition="1+1",
            content_payload={},
            correct_answer="2",
            explanation="Два",
            difficulty_level=1,
            is_ai_generated=False,
        )

        self.client = Mock()
        self.client.auth_key = "not-a-real-secret"
        self.service = AdaptiveService(gigachat_client=self.client)

    def test_generated_task_saved_without_leaking_correct_answer(self):
        self.client.request_generation.return_value = ServiceResult.success({
            "task_type": "choice",
            "condition": "Сколько будет 2+2?",
            "content_payload": {
                "options": ["3", "4", "5"],
            },
            "correct_answer": "4",
            "explanation": "Два и два — четыре",
            "difficulty_level": 1,
        })

        result = self.service.pick_next_task(
            self.user,
            self.topic.pk,
            "choice",
            1,
        )

        self.assertTrue(result.ok)
        self.assertTrue(result.data.is_ai_generated)

        self.assertNotIn(
            "correct_answer",
            __import__(
                "tests.services",
                fromlist=["TaskService"],
            ).TaskService.serialize_task(result.data),
        )

    def test_invalid_generation_does_not_mix_formats(self):
        self.client.request_generation.return_value = ServiceResult.success({
            "task_type": "choice",
            "condition": "Сколько будет 2+2?",
            "content_payload": {
                "options": ["3", "4"],
            },
            "correct_answer": "5",
            "explanation": "Ошибка",
            "difficulty_level": 1,
        })

        result = self.service.pick_next_task(
            self.user,
            self.topic.pk,
            "choice",
            1,
        )

        self.assertFalse(result.ok)

        self.assertEqual(
            result.code,
            ResultCode.NO_TASKS_AVAILABLE,
        )

    def test_wrong_ai_math_answer_is_rejected(self):
        """Неверный арифметический ответ ИИ не должен попадать в базу."""
        self.client.request_generation.return_value = ServiceResult.success({
            "task_type": "choice",
            "condition": "Сколько будет 2 + 2?",
            "content_payload": {
                "options": ["3", "4", "5"],
            },
            "correct_answer": "5",
            "explanation": "2 + 2 = 5",
            "difficulty_level": 1,
        })

        result = self.service.generate_task(
            self.topic,
            "choice",
            1,
        )

        self.assertFalse(result.ok)

        self.assertFalse(
            Task.objects.filter(
                topic=self.topic,
                condition="Сколько будет 2 + 2?",
                is_ai_generated=True,
            ).exists()
        )

    def test_wrong_fraction_answer_is_rejected(self):
        """ИИ не должен выдавать 4/10 как дробь, равную числу 4."""
        self.client.request_generation.return_value = ServiceResult.success({
            "task_type": "choice",
            "condition": "Выберите дробь, равную числу 4.",
            "content_payload": {
                "options": ["4/10", "4/1", "2/4"],
            },
            "correct_answer": "4/10",
            "explanation": "4/10 равно 4",
            "difficulty_level": 1,
        })

        result = self.service.generate_task(
            self.topic,
            "choice",
            1,
        )

        self.assertFalse(result.ok)

        self.assertFalse(
            Task.objects.filter(
                topic=self.topic,
                condition="Выберите дробь, равную числу 4.",
                is_ai_generated=True,
            ).exists()
        )

    def test_fallback_does_not_repeat_task(self):
        result = self.service.get_fallback_task(
            self.topic.pk,
            "input",
            1,
            [self.task.pk],
        )

        self.assertEqual(
            result.code,
            ResultCode.NO_TASKS_AVAILABLE,
        )

    def test_difficulty_after_each_five_answers_is_idempotent(self):
        progress = UserProgress.objects.create(
            user=self.user,
            topic=self.topic,
            tasks_solved=10,
            tasks_correct=9,
        )

        for is_correct in [
            True, True, True, True, True,
            True, True, True, True, False,
        ]:
            SolutionAttempt.objects.create(
                user=self.user,
                task=self.task,
                user_answer="2",
                is_correct=is_correct,
            )

        self.assertEqual(
            self.service.determine_difficulty(
                self.user,
                self.topic.pk,
            ).data,
            3,
        )

        self.assertEqual(
            self.service.determine_difficulty(
                self.user,
                self.topic.pk,
            ).data,
            3,
        )

        progress.refresh_from_db()

        self.assertEqual(
            progress.difficulty_level,
            3,
        )

    def test_correct_fraction_answer_is_accepted(self):
        """Правильная дробь должна проходить проверку."""
        self.client.request_generation.return_value = ServiceResult.success({
            "task_type": "choice",
            "condition": "Выберите дробь, равную числу 4.",
            "content_payload": {
                "options": ["4/10", "4/1", "2/4"],
            },
            "correct_answer": "4/1",
            "explanation": "4/1 = 4",
            "difficulty_level": 1,
        })

        result = self.service.generate_task(self.topic, "choice", 1)

        self.assertTrue(result.ok)
        self.assertEqual(result.data.correct_answer, "4/1")
        self.assertTrue(result.data.is_ai_generated)

    def test_multiple_correct_fraction_options_are_rejected(self):
        """Задание с двумя правильными вариантами недопустимо."""
        self.client.request_generation.return_value = ServiceResult.success({
            "task_type": "choice",
            "condition": "Выберите дробь, равную числу 4.",
            "content_payload": {
                "options": ["4/1", "8/2", "2/4"],
            },
            "correct_answer": "4/1",
            "explanation": "4/1 и 8/2 равны 4",
            "difficulty_level": 1,
        })

        result = self.service.generate_task(self.topic, "choice", 1)

        self.assertFalse(result.ok)
        self.assertFalse(
            Task.objects.filter(
                topic=self.topic,
                condition="Выберите дробь, равную числу 4.",
                is_ai_generated=True,
            ).exists()
        )

    def test_wrong_ordering_answer_is_rejected(self):
        """ИИ не должен сохранять неправильный порядок выражений."""
        items = [
            "63 − 9",
            "25 + 32",
            "48 + 17",
            "85 − 40",
        ]

        self.client.request_generation.return_value = ServiceResult.success({
            "task_type": "ordering",
            "condition": "Расположите выражения в порядке возрастания их значений.",
            "content_payload": {
                "items": items,
            },
            "correct_answer": items,
            "explanation": "Выражения расположены по возрастанию.",
            "difficulty_level": 1,
        })

        result = self.service.generate_task(
            self.topic, "ordering", 1
        )

        self.assertFalse(result.ok)
        self.assertFalse(
            Task.objects.filter(
                topic=self.topic,
                task_type="ordering",
                is_ai_generated=True,
            ).exists()
        )

    def test_correct_ordering_answer_is_accepted(self):
        """Правильный порядок выражений должен сохраняться."""
        items = [
            "63 − 9",
            "25 + 32",
            "48 + 17",
            "85 − 40",
        ]

        correct_order = [
            "85 − 40",
            "63 − 9",
            "25 + 32",
            "48 + 17",
        ]

        self.client.request_generation.return_value = ServiceResult.success({
            "task_type": "ordering",
            "condition": "Расположите выражения в порядке возрастания их значений.",
            "content_payload": {
                "items": items,
            },
            "correct_answer": correct_order,
            "explanation": "45 < 54 < 57 < 65",
            "difficulty_level": 1,
        })

        result = self.service.generate_task(
            self.topic, "ordering", 1
        )

        self.assertTrue(result.ok)
        self.assertEqual(result.data.task_type, "ordering")
        self.assertTrue(result.data.is_ai_generated)

    def test_wrong_matching_answer_is_rejected(self):
        """Неправильные соответствия не должны сохраняться."""
        self.client.request_generation.return_value = ServiceResult.success({
            "task_type": "matching",
            "condition": "Сопоставьте выражения с их результатами.",
            "content_payload": {
                "left": ["2 + 3", "8 − 2"],
                "right": ["5", "6"],
            },
            "correct_answer": {
                "2 + 3": "6",
                "8 − 2": "5",
            },
            "explanation": "2 + 3 = 5, 8 − 2 = 6",
            "difficulty_level": 1,
        })

        result = self.service.generate_task(
            self.topic, "matching", 1
        )

        self.assertFalse(result.ok)
        self.assertFalse(
            Task.objects.filter(
                topic=self.topic,
                task_type="matching",
                is_ai_generated=True,
            ).exists()
        )

    def test_correct_matching_answer_is_accepted(self):
        """Правильные соответствия должны сохраняться."""
        self.client.request_generation.return_value = ServiceResult.success({
            "task_type": "matching",
            "condition": "Сопоставьте выражения с их результатами.",
            "content_payload": {
                "left": ["2 + 3", "8 − 2"],
                "right": ["5", "6"],
            },
            "correct_answer": {
                "2 + 3": "5",
                "8 − 2": "6",
            },
            "explanation": "2 + 3 = 5, 8 − 2 = 6",
            "difficulty_level": 1,
        })

        result = self.service.generate_task(
            self.topic, "matching", 1
        )

        self.assertTrue(result.ok)
        self.assertEqual(result.data.task_type, "matching")
        self.assertTrue(result.data.is_ai_generated)
        self.assertEqual(
            result.data.content_payload["left"],
            ["2 + 3", "8 − 2"],
        )
