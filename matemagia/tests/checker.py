import json
import re
from fractions import Fraction
from collections import Counter


class AnswerChecker:
    @staticmethod
    def normalize_number(value):
        if isinstance(value, bool) or not isinstance(value, (str, int, float)):
            raise ValueError('Введите число или дробь')
        text = str(value).strip().replace(',', '.').replace('−', '-')
        if len(text) > 128 or not re.fullmatch(r'[+-]?(?:\d+(?:\.\d+)?|\.\d+|\d+\s*/\s*\d+)', text):
            raise ValueError('Введите число или дробь')
        return Fraction(re.sub(r'\s+', '', text))

    @staticmethod
    def _json(value):
        return json.loads(value) if isinstance(value, str) else value

    @classmethod
    def normalize(cls, task, value):
        kind = task.task_type
        payload = task.content_payload or {}
        if kind == 'input':
            return cls.normalize_number(value)
        if kind == 'choice':
            if not isinstance(value, (str, int, float)) or isinstance(value, bool):
                raise ValueError('Выберите вариант ответа')
            value = str(value).strip()
            if value not in [str(x) for x in payload.get('options', [])]:
                raise ValueError('Неизвестный вариант ответа')
            return value
        if kind == 'boolean':
            if isinstance(value, bool):
                return value
            if isinstance(value, str) and value.strip().lower() in ('true', 'false'):
                return value.strip().lower() == 'true'
            raise ValueError('Ожидается true или false')
        if kind == 'ordering':
            value = cls._json(value)
            if not isinstance(value, list) or not all(isinstance(x, str) for x in value):
                raise ValueError('Ожидается список элементов')
            if Counter(value) != Counter(payload.get('items', [])):
                raise ValueError('Используйте каждый элемент задания')
            return value
        if kind == 'matching':
            value = cls._json(value)
            if isinstance(value, list):
                if not all(isinstance(p, list) and len(p) == 2 and all(isinstance(x, str) for x in p) for p in value):
                    raise ValueError('Ожидаются пары строк')
                if len({p[0] for p in value}) != len(value):
                    raise ValueError('Повтор левого элемента')
                value = dict(value)
            if not isinstance(value, dict) or not all(isinstance(k, str) and isinstance(v, str) for k,v in value.items()):
                raise ValueError('Ожидается объект соответствий')
            if set(value) != set(payload.get('left', [])) or not set(value.values()) <= set(payload.get('right', [])):
                raise ValueError('Заполните все соответствия')
            return value
        raise ValueError('Неизвестный формат задания')

    @classmethod
    def check(cls, task, answer):
        return cls.normalize(task, answer) == cls.normalize(task, task.correct_answer)

    @staticmethod
    def build_explanation(task, is_correct):
        return '' if is_correct else (task.explanation or 'Попробуйте решить задание ещё раз.')
