from unittest.mock import Mock
from django.contrib.auth import get_user_model
from django.test import TestCase
from core.results import ResultCode, ServiceResult
from learning.models import Topic
from .models import Task
from .services import TaskService


class TaskApiTests(TestCase):
    fixtures = ['initial_data.json', 'initial_tasks.json']

    def setUp(self):
        self.user = get_user_model().objects.create_user(username='student', password='test-password')
        self.client.force_login(self.user)

    def test_series_without_duplicates(self):
        topic = Topic.objects.first()
        self.assertEqual(self.client.get('/tasks/', {'topic': topic.pk}, HTTP_ACCEPT='application/json').status_code, 200)
        ids = []
        for number in range(1, 11):
            response = self.client.get('/tasks/next/')
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(data['number'], number)
            self.assertEqual(data['topic_id'], topic.pk)
            self.assertNotIn('correct_answer', data)
            self.assertNotIn('explanation', data)
            ids.append(data['id'])
        self.assertEqual(len(set(ids)), 10)
        self.assertTrue(self.client.get('/tasks/next/').json()['finished'])

    def test_check_and_errors(self):
        task = Task.objects.filter(task_type='input').first()
        url = f'/tasks/{task.pk}/check/'
        response = self.client.post(url, {'answer': task.correct_answer}, content_type='application/json')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['is_correct'])
        response = self.client.post(url, {'answer': 'abc'}, content_type='application/json')
        self.assertEqual(response.json()['code'], 3001)
        self.assertEqual(response.status_code, 400)
        response = self.client.get('/tasks/999999/', HTTP_ACCEPT='application/json')
        self.assertEqual(response.json()['code'], 2001)
        self.assertEqual(response.status_code, 404)

    def test_service_integration_order_and_rollback(self):
        task = Task.objects.filter(task_type='input').first()
        calls = []
        progress, reward = Mock(), Mock()
        attempt = object()
        def record(**kwargs):
            calls.append('progress')
            get_user_model().objects.filter(pk=self.user.pk).update(current_xp=50)
            return ServiceResult.success(attempt)
        def award(**kwargs):
            calls.append('reward')
            self.assertIs(kwargs['attempt'], attempt)
            return ServiceResult.fail(ResultCode.INTERNAL_ERROR)
        progress.record_attempt.side_effect = record
        reward.process_attempt.side_effect = award
        result = TaskService(progress, reward).check_answer(self.user, task.pk, task.correct_answer)
        self.assertEqual(calls, ['progress', 'reward'])
        self.assertEqual(result.code, ResultCode.INTERNAL_ERROR)
        self.user.refresh_from_db()
        self.assertEqual(self.user.current_xp, 0)
