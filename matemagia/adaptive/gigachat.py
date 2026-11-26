"""Прямое обращение к GigaChat API через requests; токены только на сервере."""

import json
import logging
import time
from uuid import uuid4

import requests
from django.conf import settings

from core.results import ResultCode, ServiceResult

logger = logging.getLogger(__name__)


class GigaChatClient:
    AUTH_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
    CHAT_URL = "https://api.giga.chat/v1/chat/completions"

    def __init__(self, session=None):
        self.session = session or requests.Session()
        self.auth_key = getattr(settings, "GIGACHAT_AUTH_KEY", "").strip()
        self.scope = getattr(settings, "GIGACHAT_SCOPE", "GIGACHAT_API_PERS")
        self.model = getattr(settings, "GIGACHAT_MODEL", "GigaChat")
        self.timeout = getattr(settings, "GIGACHAT_TIMEOUT", 10)
        # True: системные доверенные CA; строка: путь к проверенному PEM-файлу.
        self.verify = getattr(settings, "GIGACHAT_CA_BUNDLE_FILE", "") or True
        self._token = None
        self._expires_at = 0.0

    def get_access_token(self):
        """Возвращает ServiceResult с Bearer-токеном, кэшированным до истечения."""
        if not self.auth_key:
            return ServiceResult.fail(ResultCode.AI_UNAVAILABLE, {"gigachat": "Ключ доступа не задан"})
        if self._token and time.time() < self._expires_at - 60:
            return ServiceResult.success(self._token)
        try:
            response = self.session.post(
                self.AUTH_URL,
                headers={
                    "Authorization": f"Basic {self.auth_key}",
                    "RqUID": str(uuid4()),
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json",
                },
                data={"scope": self.scope},
                timeout=self.timeout,
                verify=self.verify,
            )
            response.raise_for_status()
            payload = response.json()
            token = payload["access_token"]
            if not isinstance(token, str) or not token:
                raise ValueError("Отсутствует access_token")
            expires = payload.get("expires_at")
            if expires is None:
                expiry_time = time.time() + 1800
            else:
                expiry_time = float(expires)
                if expiry_time > 10**12:  # GigaChat возвращает Unix timestamp в мс.
                    expiry_time /= 1000
            self._token, self._expires_at = token, expiry_time
            return ServiceResult.success(token)
        except (requests.RequestException, ValueError, KeyError, TypeError) as exc:
            logger.warning("GigaChat OAuth недоступен: %s", type(exc).__name__)
            self._token, self._expires_at = None, 0.0
            return ServiceResult.fail(ResultCode.AI_UNAVAILABLE, {"gigachat": "Ошибка авторизации GigaChat"})

    @staticmethod
    def build_prompt(params):
        formats = {
            "choice": "content_payload: {\"options\": [строки, минимум 3]}; correct_answer — точная строка одного из options",
                        "input": (
                "content_payload: {}; correct_answer — числовая строка "
                "(целое, десятичное число или дробь a/b). "
                "Создавай задания на математические вычисления строго по указанной теме. "
                "Не создавай задания на запись чисел словами или перевод слов в цифры. "
                "Не требуй текстового ответа. "
                "Перед отправкой проверь все вычисления и убедись, что "
                "correct_answer математически соответствует условию."
            ),
            "boolean": "content_payload: {}; correct_answer — строка true или false",
            "ordering": "content_payload: {\"items\": [уникальные строки]}; correct_answer — массив этих строк в правильном порядке",
            "matching": (
                "content_payload: {\"left\": [уникальные строки], "
                "\"right\": [уникальные строки]}; "
                "correct_answer — JSON-объект с соответствиями. "
                "Создай 4 математических выражения слева и 4 разных "
                "числовых результата справа. "
                "Каждому выражению должен соответствовать ровно один результат. "
                "Каждый результат справа должен использоваться ровно один раз. "
                "Не используй классификацию чисел на простые, составные, "
                "четные и нечетные. "
                                "Проверь правильность каждого вычисления и всех пар. "
                "Ключи correct_answer должны в точности совпадать "
                "со строками из left, включая все пробелы и знаки. "
                "Значения correct_answer должны в точности совпадать "
                "со строками из right. "
                "Например, для left ['8 + 9', '3 × 4'] "
                "и right ['12', '17'] правильный correct_answer: "
                "{\"8 + 9\": \"17\", \"3 × 4\": \"12\"}. "
                "Каждое выражение должно быть математически верным, "
                "а все четыре результата — разными."
            ),
        }
        kind = params["task_type"]
        if kind not in formats:
            raise ValueError("Неизвестный тип задания")
        return (
            f"Ты составляешь ровно ОДНО корректное задание по математике для {params['grade']} класса. "
            f"Тема: {params['topic_title']}. Сложность: {params['difficulty_level']} из 3. "
            f"Формат: {kind}. {formats[kind]}. "
            "Ответь ТОЛЬКО валидным JSON-объектом без Markdown и пояснений вне JSON. "
            "Обязательные поля: task_type, condition, content_payload, correct_answer, explanation, difficulty_level. "
            f"task_type строго {kind}; difficulty_level строго {params['difficulty_level']}. "
            "condition и explanation должны быть понятны пятикласснику, а ответ математически верным. "
            "Не добавляй вопросы, которые требуют изображения или внешних материалов."
        )

    @staticmethod
    def parse_response(response_text):
        """Разбирает содержимое choices[0].message.content, не HTTP-обёртку."""
        if not isinstance(response_text, str) or not response_text.strip():
            return ServiceResult.fail(ResultCode.AI_INVALID_RESPONSE, {"gigachat": "Пустой ответ"})
        body = response_text.strip()
        if body.startswith("```"):
            lines = body.splitlines()
            if len(lines) >= 3 and lines[-1].strip() == "```":
                body = "\n".join(lines[1:-1]).strip()
        try:
            parsed = json.loads(body)
            if not isinstance(parsed, dict):
                raise ValueError("Ответ не является JSON-объектом")
            return ServiceResult.success(parsed)
        except (json.JSONDecodeError, ValueError):
            return ServiceResult.fail(ResultCode.AI_INVALID_RESPONSE, {"gigachat": "Некорректный JSON"})

    def request_generation(self, params):
        """Возвращает ServiceResult с внутренним словарём задания или кодом 5001/5002."""
        try:
            prompt = self.build_prompt(params)
        except (KeyError, ValueError, TypeError):
            return ServiceResult.fail(ResultCode.AI_INVALID_RESPONSE, {"gigachat": "Некорректные параметры генерации"})
        token_result = self.get_access_token()
        if not token_result.ok:
            return token_result
        try:
            response = self.session.post(
                self.CHAT_URL,
                headers={
                    "Authorization": f"Bearer {token_result.data}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": [{"role": "user", "content": prompt}],
                    "stream": False,
                },
                timeout=self.timeout,
                verify=self.verify,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            logger.warning("GigaChat запрос недоступен: %s", type(exc).__name__)
            return ServiceResult.fail(ResultCode.AI_UNAVAILABLE, {"gigachat": "Ошибка обращения к GigaChat"})
        try:
            content = response.json()["choices"][0]["message"]["content"]
        except (ValueError, KeyError, TypeError, IndexError):
            return ServiceResult.fail(ResultCode.AI_INVALID_RESPONSE, {"gigachat": "Неожиданный формат HTTP-ответа"})
        return self.parse_response(content)
