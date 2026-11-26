"""Адаптивная генерация и резервная выдача заданий через Django ORM."""

import json
import logging
import random
import re
from fractions import Fraction

from django.db import DatabaseError

from core.results import ResultCode, ServiceResult
from learning.models import Topic
from progress.models import SolutionAttempt, UserProgress
from tests.checker import AnswerChecker
from tests.models import Task
from .gigachat import GigaChatClient

logger = logging.getLogger(__name__)


class AdaptiveService:
    def __init__(self, gigachat_client=None):
        self.client = gigachat_client or GigaChatClient()

    def determine_difficulty(self, user, topic_id):
        """Идемпотентный пересчёт по группам из 5 попыток: >=4 выше, <=1 ниже."""
        if not Topic.objects.filter(pk=topic_id).exists():
            return ServiceResult.fail(ResultCode.NOT_FOUND, {"topic": "Тема не найдена"})
        flags = list(
            SolutionAttempt.objects.filter(user=user, task__topic_id=topic_id)
            .order_by("created_at", "id").values_list("is_correct", flat=True)
        )
        difficulty = 1
        for index in range(0, len(flags) // 5 * 5, 5):
            passed = sum(bool(x) for x in flags[index:index + 5])
            if passed >= 4:
                difficulty = min(3, difficulty + 1)
            elif passed <= 1:
                difficulty = max(1, difficulty - 1)
        current = UserProgress.objects.filter(user=user, topic_id=topic_id).first()
        if current is not None and current.difficulty_level != difficulty:
            current.difficulty_level = difficulty
            current.save(update_fields=["difficulty_level"])
        return ServiceResult.success(difficulty)

    def build_generation_params(self, topic, difficulty, task_type):
        return {
            "topic_id": topic.pk,
            "topic_title": topic.title,
            "grade": 5,
            "difficulty_level": difficulty,
            "task_type": task_type,
        }

    @staticmethod
    def _normalize_answer(kind, payload, answer):
        """Проверяет соответствие с AnswerChecker, сериализует составные ответы."""
        class _Candidate:
            task_type = kind
            content_payload = payload

        if kind == "input":
            AnswerChecker.normalize_number(answer)
            return str(answer)
        if kind == "choice":
            options = payload.get("options")
            if not isinstance(options, list) or len(options) < 2 or not all(isinstance(s, str) and s.strip() for s in options):
                raise ValueError("Нужен массив вариантов ответа")
            if len(set(options)) != len(options) or not isinstance(answer, str) or answer not in options:
                raise ValueError("Правильный вариант отсутствует в списке")
            return answer
        if kind == "boolean":
            if isinstance(answer, bool):
                return "true" if answer else "false"
            if isinstance(answer, str) and answer.strip().lower() in ("true", "false"):
                return answer.strip().lower()
            raise ValueError("Ожидается true/false")
        if kind in ("ordering", "matching"):
            parsed = json.loads(answer) if isinstance(answer, str) else answer
            candidate = _Candidate()
            AnswerChecker.normalize(candidate, parsed)
            if kind == "ordering" and (not isinstance(payload.get("items"), list) or len(payload["items"]) < 2):
                raise ValueError("Недостаточно элементов для упорядочивания")
            if kind == "matching":
                left, right = payload.get("left"), payload.get("right")
                if (not isinstance(left, list) or not isinstance(right, list) or
                        len(left) < 2 or len(left) != len(right) or
                        len(set(left)) != len(left) or len(set(right)) != len(right)):
                    raise ValueError("Некорректные элементы для сопоставления")
                mapping = dict(parsed) if isinstance(parsed, list) else parsed
                if len(set(mapping.values())) != len(right):
                    raise ValueError("Соответствие должно быть взаимно однозначным")
            return json.dumps(parsed, ensure_ascii=False)
        raise ValueError("Неизвестный формат")

    def validate_generated_task(self, data, params):
        """Возвращает очищенный словарь полей Task, не сохраняя некорректный ответ."""
        try:
            if not isinstance(data, dict):
                raise ValueError("Не JSON-объект")
            kind = data["task_type"]
            difficulty = data["difficulty_level"]
            condition, explanation = data["condition"], data["explanation"]
            payload = data.get("content_payload") or {}
            if kind != params["task_type"] or kind not in Task.Type.values:
                raise ValueError("Не соответствует формату запроса")
            if type(difficulty) is not int or difficulty != params["difficulty_level"] or not 1 <= difficulty <= 3:
                raise ValueError("Не соответствует сложности запроса")
            if not isinstance(condition, str) or not condition.strip() or len(condition) > 4000:
                raise ValueError("Отсутствует условие")
            if not isinstance(explanation, str) or not explanation.strip():
                raise ValueError("Отсутствует объяснение")

            if not isinstance(payload, dict):
                raise ValueError("Некорректный content_payload")

            if kind == "input" and any(
                phrase in condition.lower()
                for phrase in (
                    "запиши число",
                    "запиши цифрами",
                    "натуральным числом",
                    "словами",
                )
            ):
                raise ValueError("Словесная запись числа требует отдельной проверки")

            answer = self._normalize_answer(
                kind, payload, data["correct_answer"]
            )

            # Независимо проверяем простые арифметические задания.
            if kind in ("choice", "input"):
                match = re.fullmatch(
                    r"\s*Сколько будет\s*"
                    r"([+-]?\d+)\s*([+\-−*×÷:])\s*"
                    r"([+-]?\d+)\s*\?\s*",
                    condition,
                    flags=re.IGNORECASE,
                )

                if match:
                    left = Fraction(int(match.group(1)))
                    operator = match.group(2)
                    right = Fraction(int(match.group(3)))

                    if operator == "+":
                        expected = left + right
                    elif operator in ("-", "−"):
                        expected = left - right
                    elif operator in ("*", "×"):
                        expected = left * right
                    else:
                        expected = left / right

                    actual = AnswerChecker.normalize_number(answer)

                    if actual != expected:
                        raise ValueError(
                            "Математически неверный ответ GigaChat"
                        )

            # Проверяем задания на выбор дроби, равной числу.
            if kind == "choice":
                fraction_match = re.fullmatch(
                    r"\s*Выберите\s+дробь,\s+равную\s+числу\s+"
                    r"([+-]?\d+(?:[.,]\d+)?)\s*[.!?]?\s*",
                    condition,
                    flags=re.IGNORECASE,
                )

                if fraction_match:
                    target = AnswerChecker.normalize_number(
                        fraction_match.group(1)
                    )

                    # Самостоятельно вычисляем значения всех вариантов.
                    correct_options = [
                        option
                        for option in payload["options"]
                        if AnswerChecker.normalize_number(option) == target
                    ]

                    # Правильный вариант должен быть ровно один.
                    if (
                        len(correct_options) != 1
                        or answer != correct_options[0]
                    ):
                        raise ValueError(
                            "Неверный или неоднозначный ответ GigaChat"
                        )


            # Проверяем правильность упорядочивания выражений.
            if kind == "ordering":
                if "возрастан" in condition.lower():
                    reverse = False
                elif "убыван" in condition.lower():
                    reverse = True
                else:
                    raise ValueError(
                        "Неизвестное направление упорядочивания"
                    )

                values = {}

                for item in payload["items"]:
                    # Поддерживаем простые выражения с двумя целыми числами.
                    match = re.fullmatch(
                        r"\s*([+-]?\d+)\s*([+\-−*×÷:])\s*"
                        r"([+-]?\d+)\s*",
                        item,
                    )

                    if not match:
                        raise ValueError(
                            "Не удалось проверить выражение"
                        )

                    left = Fraction(int(match.group(1)))
                    operator = match.group(2)
                    right = Fraction(int(match.group(3)))

                    if operator == "+":
                        value = left + right
                    elif operator in ("-", "−"):
                        value = left - right
                    elif operator in ("*", "×"):
                        value = left * right
                    else:
                        if right == 0:
                            raise ValueError("Деление на ноль")
                        value = left / right

                    values[item] = value

                # Одинаковые результаты делают порядок неоднозначным.
                if len(set(values.values())) != len(values):
                    raise ValueError(
                        "У выражений повторяются результаты"
                    )

                expected_order = sorted(
                    payload["items"],
                    key=lambda item: values[item],
                    reverse=reverse,
                )

                actual_order = json.loads(answer)

                if actual_order != expected_order:
                    raise ValueError(
                        "Неправильный порядок выражений GigaChat"
                    )


            # Проверяем правильность сопоставления выражений и результатов.
            if kind == "matching":
                mapping = json.loads(answer)

                # ИИ может вернуть словарь или список пар.
                if isinstance(mapping, list):
                    mapping = dict(mapping)

                seen_results = set()

                for expression, selected_result in mapping.items():
                    match = re.fullmatch(
                        r"\s*([+-]?\d+)\s*([+\-−*×÷:])\s*"
                        r"([+-]?\d+)\s*",
                        expression,
                    )

                    if not match:
                        raise ValueError(
                            "Не удалось проверить выражение сопоставления"
                        )

                    left = Fraction(int(match.group(1)))
                    operator = match.group(2)
                    right = Fraction(int(match.group(3)))

                    if operator == "+":
                        expected = left + right
                    elif operator in ("-", "−"):
                        expected = left - right
                    elif operator in ("*", "×"):
                        expected = left * right
                    else:
                        if right == 0:
                            raise ValueError("Деление на ноль")
                        expected = left / right

                    actual = AnswerChecker.normalize_number(
                        selected_result
                    )

                    if actual != expected:
                        raise ValueError(
                            "Неправильное соответствие GigaChat"
                        )

                    # Не допускаем неоднозначных соответствий.
                    if expected in seen_results:
                        raise ValueError(
                            "У выражений повторяются результаты"
                        )

                    seen_results.add(expected)


            return ServiceResult.success({
                "topic_id": params["topic_id"],
                "task_type": kind,
                "difficulty_level": difficulty,
                "condition": condition.strip(),
                "content_payload": payload,
                "correct_answer": answer,
                "explanation": explanation.strip(),
                "is_ai_generated": True,
            })
        except (KeyError, ValueError, TypeError, OverflowError, ZeroDivisionError, json.JSONDecodeError):
            return ServiceResult.fail(ResultCode.AI_INVALID_RESPONSE, {"gigachat": "Некорректные поля задания"})

    def generate_task(self, topic, task_type, difficulty):
        params = self.build_generation_params(topic, difficulty, task_type)

        # Получаем последние 20 заданий этой темы и формата.
        params["avoid_conditions"] = list(
            Task.objects.filter(
                topic=topic,
                task_type=task_type,
            )
            .order_by("-id")
            .values_list("condition", flat=True)[:20]
        )

        attempts = 3

        for _ in range(attempts):
            response = self.client.request_generation(params)
            if not response.ok:
                return response

            checked = self.validate_generated_task(response.data, params)
            if not checked.ok:
                continue

            # Не сохраняем задания с одинаковыми условиями.
            duplicate = Task.objects.filter(
                topic=topic,
                condition=checked.data["condition"],
            ).exists()

            if not duplicate:
                break
        else:
            return ServiceResult.fail(
                ResultCode.AI_INVALID_RESPONSE,
                {"gigachat": "Не удалось получить новое корректное задание"},
            )

        try:
            task = Task.objects.create(**checked.data)
            return ServiceResult.success(task)
        except DatabaseError:
            logger.exception("Ошибка сохранения сгенерированного задания")
            return ServiceResult.fail(
                ResultCode.INTERNAL_ERROR,
                {"task": "Ошибка сохранения задания"},
            )
            logger.exception("Ошибка сохранения сгенерированного задания")
            return ServiceResult.fail(ResultCode.INTERNAL_ERROR, {"task": "Ошибка сохранения задания"})

    def get_fallback_task(self, topic_id=None, task_type=None, difficulty=None, exclude_ids=()):
        """Приоритет: тема+формат+сложность -> тема+формат -> тема."""
        base = Task.objects.filter(is_ai_generated=False).exclude(pk__in=exclude_ids)
        if topic_id is not None:
            base = base.filter(topic_id=topic_id)
        levels = []
        if task_type and difficulty is not None:
            levels.append({"task_type": task_type, "difficulty_level": difficulty})
        if task_type:
            levels.append({"task_type": task_type})
        elif difficulty is not None:
            levels.append({"difficulty_level": difficulty})

        if not task_type:
            levels.append({})

        for filters in levels:
            task = base.filter(**filters).order_by("?").first()
            if task:
                return ServiceResult.success(task)
        return ServiceResult.fail(ResultCode.NO_TASKS_AVAILABLE, {"task": "Нет доступных заданий"})

    def pick_next_task(self, user, topic_id=None, task_type=None, difficulty=None, exclude_ids=()):
        """Интерфейс для TaskService.get_next_task(), возвращает объект Task."""
        topic = Topic.objects.filter(pk=topic_id).first() if topic_id is not None else Topic.objects.order_by("?").first()
        if topic is None:
            return ServiceResult.fail(ResultCode.NO_TASKS_AVAILABLE, {"task": "Нет математических тем"})
        if task_type and task_type not in Task.Type.values:
            return ServiceResult.fail(ResultCode.VALIDATION_ERROR, {"type": "Неизвестный тип задания"})
        if difficulty is not None and (type(difficulty) is not int or not 1 <= difficulty <= 3):
            return ServiceResult.fail(ResultCode.VALIDATION_ERROR, {"difficulty": "Уровень должен быть от 1 до 3"})
        if difficulty is None:
            level = self.determine_difficulty(user, topic.pk)
            if not level.ok:
                return level
            difficulty = level.data
        kind = task_type or random.choice(Task.Type.values)
        # Без ключа не делаем сетевых обращений: мгновенно переходим к подготовленным задачам.
        if self.client.auth_key:
            generated = self.generate_task(topic, kind, difficulty)
            if generated.ok:
                return generated
        return self.get_fallback_task(topic.pk, task_type, difficulty, exclude_ids)
