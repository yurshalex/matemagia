from types import SimpleNamespace
from unittest import TestCase
import json
from pathlib import Path
from .checker import AnswerChecker


def task(kind, answer, payload=None):
    return SimpleNamespace(task_type=kind, correct_answer=answer,
                           content_payload=payload, explanation='Объяснение')


class AnswerCheckerTests(TestCase):
    def test_fractions(self):
        for actual, expected in [('3/9', '1/3'), ('0,5', '1/2'), ('-0.50', '-1/2'), (' 6 / 9 ', '2/3')]:
            self.assertTrue(AnswerChecker.check(task('input', expected), actual))
        self.assertFalse(AnswerChecker.check(task('input', '1/3'), '0,33'))

    def test_invalid_number(self):
        for answer in ['1/0', 'abc', True, '', '1+2', None]:
            with self.subTest(answer=answer), self.assertRaises((ValueError, ZeroDivisionError)):
                AnswerChecker.check(task('input', '1'), answer)

    def test_choice(self):
        t = task('choice', '2', {'options': ['1', '2']})
        self.assertTrue(AnswerChecker.check(t, '2'))
        self.assertFalse(AnswerChecker.check(t, '1'))
        with self.assertRaises(ValueError):
            AnswerChecker.check(t, '3')

    def test_boolean(self):
        t = task('boolean', 'false')
        self.assertTrue(AnswerChecker.check(t, False))
        self.assertFalse(AnswerChecker.check(t, 'true'))
        with self.assertRaises(ValueError):
            AnswerChecker.check(t, 'maybe')

    def test_ordering(self):
        t = task('ordering', '["a", "b"]', {'items': ['b', 'a']})
        self.assertTrue(AnswerChecker.check(t, ['a', 'b']))
        self.assertFalse(AnswerChecker.check(t, ['b', 'a']))
        with self.assertRaises(ValueError):
            AnswerChecker.check(t, ['a', 'a'])

    def test_matching(self):
        t = task('matching', '{"a":"1","b":"2"}', {'left': ['a','b'], 'right': ['1','2']})
        self.assertTrue(AnswerChecker.check(t, [['b','2'], ['a','1']]))
        self.assertFalse(AnswerChecker.check(t, {'a':'2','b':'1'}))
        with self.assertRaises(ValueError):
            AnswerChecker.check(t, {'a':'1'})

    def test_explanation(self):
        t = task('input', '1')
        self.assertEqual(AnswerChecker.build_explanation(t, False), 'Объяснение')
        self.assertEqual(AnswerChecker.build_explanation(t, True), '')

    def test_all_fixture_answers(self):
        rows = json.loads((Path(__file__).parent / 'fixtures/initial_tasks.json').read_text(encoding='utf-8'))
        self.assertEqual(len(rows), 96)
        self.assertEqual(len({r['pk'] for r in rows}), 96)
        self.assertEqual({r['fields']['task_type'] for r in rows}, {'input','choice','boolean','ordering','matching'})
        for row in rows:
            t = SimpleNamespace(**row['fields'])
            with self.subTest(pk=row['pk']):
                self.assertTrue(AnswerChecker.check(t, t.correct_answer))
