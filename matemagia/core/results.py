"""ServiceResult и коды результата сервисов (раздел 5.1.2 документа)."""
from dataclasses import dataclass, field
from typing import Any


class ResultCode:
    OK = 0
    VALIDATION_ERROR = 1001
    USER_EXISTS = 1002
    INVALID_CREDENTIALS = 1003
    USER_INACTIVE = 1004
    NOT_FOUND = 2001
    INVALID_ANSWER_FORMAT = 3001
    NO_TASKS_AVAILABLE = 3002
    CHALLENGE_NOT_ACTIVE = 4001
    CHALLENGE_NOT_FINISHED = 4002
    AI_UNAVAILABLE = 5001
    AI_INVALID_RESPONSE = 5002
    INTERNAL_ERROR = 9000


@dataclass
class ServiceResult:
    """Результат любого метода бизнес-логики: code, data, errors."""

    code: int = ResultCode.OK
    data: Any = None
    errors: dict[str, str] = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return self.code == ResultCode.OK

    @classmethod
    def success(cls, data: Any = None) -> "ServiceResult":
        return cls(code=ResultCode.OK, data=data)

    @classmethod
    def fail(cls, code: int, errors: dict[str, str] | None = None) -> "ServiceResult":
        return cls(code=code, data=None, errors=errors or {})
