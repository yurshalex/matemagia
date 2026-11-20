"""AuthService: регистрация, проверка учётных данных, завершение сессии."""
import logging

from django.contrib.auth import authenticate, get_user_model
from django.db import DatabaseError, IntegrityError, transaction
from django.db.models import Q

from core.results import ResultCode, ServiceResult

from .forms import RegistrationForm

logger = logging.getLogger(__name__)


class AuthService:
    """Использует Django Authentication; пароли хешируются PBKDF2."""

    @property
    def User(self):
        return get_user_model()

    def register(self, post_data) -> ServiceResult:
        """post_data: email, password, full_name, phone (+ username, first_name, grade)."""
        form = RegistrationForm(post_data)
        if not form.is_valid():
            errors = {field: " ".join(msgs) for field, msgs in form.errors.items()}
            return ServiceResult.fail(ResultCode.VALIDATION_ERROR, errors)

        data = form.cleaned_data
        login = data["login"]
        email = data.get("email") or (login if "@" in login else "")

        exists = Q(username__iexact=login)
        if email:
            exists |= Q(email__iexact=email)
        taken = {("email" if "email" in post_data else "username"): "Пользователь с такими данными уже зарегистрирован"}
        if self.User.objects.filter(exists).exists():
            return ServiceResult.fail(ResultCode.USER_EXISTS, taken)

        try:
            with transaction.atomic():
                # телефон проверяется, но не сохраняется: в таблице users_user такого поля нет
                user = self.User.objects.create_user(
                    username=login,
                    email=email,
                    password=data["password"],
                    first_name=data["name"],
                    grade=data["grade"],
                )  # ранг и опыт — по умолчанию («Янтарный маг», 0 XP)
        except IntegrityError:
            return ServiceResult.fail(ResultCode.USER_EXISTS, taken)
        except DatabaseError:
            logger.exception("Ошибка записи в БД при регистрации")
            return ServiceResult.fail(ResultCode.INTERNAL_ERROR, {"__all__": "Внутренняя ошибка"})
        return ServiceResult.success(user)

    def login(self, post_data) -> ServiceResult:
        """post_data: username (email) и password. Сессию создаёт представление."""
        identifier = (post_data.get("username") or post_data.get("email") or "").strip()
        password = post_data.get("password") or ""

        errors = {}
        if not identifier:
            errors["username"] = "Введите логин"
        if not password:
            errors["password"] = "Введите пароль"
        if errors:
            return ServiceResult.fail(ResultCode.VALIDATION_ERROR, errors)

        candidate = self.User.objects.filter(Q(username__iexact=identifier) | Q(email__iexact=identifier)).first()
        if candidate is None:
            return ServiceResult.fail(ResultCode.INVALID_CREDENTIALS, {"__all__": "Неверные данные"})

        user = authenticate(username=candidate.username, password=password)
        if user is not None:
            return ServiceResult.success(user)

        if not candidate.is_active and candidate.check_password(password):
            return ServiceResult.fail(
                ResultCode.USER_INACTIVE, {"__all__": "Учётная запись заблокирована администратором"}
            )
        return ServiceResult.fail(ResultCode.INVALID_CREDENTIALS, {"__all__": "Неверные данные"})

    def logout(self, user) -> ServiceResult:
        """Фиксирует выход в журнале; саму сессию сбрасывает представление."""
        if user is not None and getattr(user, "is_authenticated", False):
            logger.info("Выход пользователя id=%s", user.pk)
        return ServiceResult.success(None)
