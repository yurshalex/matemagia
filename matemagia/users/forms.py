from django import forms
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator

from .models import DEFAULT_GRADE, User


class RegistrationForm(forms.Form):
    """Проверка данных новой учётной записи.

    AuthService.register по документу принимает email, password, full_name, phone;
    поля username, first_name, grade (раздел 5.2 и таблица users_user) тоже поддерживаются.
    """

    email = forms.EmailField(max_length=150, required=False)
    username = forms.CharField(max_length=150, required=False, validators=[UnicodeUsernameValidator()])
    password = forms.CharField(strip=False, required=False)
    password1 = forms.CharField(strip=False, required=False)  # поля формы фронтенда (как в Django)
    password2 = forms.CharField(strip=False, required=False)
    full_name = forms.CharField(max_length=150, required=False)
    first_name = forms.CharField(max_length=150, required=False)
    phone = forms.CharField(
        max_length=20,
        required=False,
        validators=[RegexValidator(r"^\+?[0-9\s\-()]{6,20}$", "Некорректный номер телефона")],
    )
    grade = forms.CharField(max_length=20, required=False)

    def clean(self):
        cleaned = super().clean()
        login = (cleaned.get("email") or cleaned.get("username") or "").strip()
        name = (cleaned.get("full_name") or cleaned.get("first_name") or "").strip()

        if not login and not self.errors.get("email") and not self.errors.get("username"):
            self.add_error("email" if "email" in self.data else "username", "Укажите логин (email)")
        if not name:
            self.add_error("full_name" if "full_name" in self.data else "first_name", "Укажите имя")

        password = cleaned.get("password") or cleaned.get("password1")
        if not password:
            self.add_error("password1" if "password1" in self.data else "password", "Введите пароль")
        elif cleaned.get("password2") not in (None, "") and cleaned["password2"] != password:
            self.add_error("password2", "Пароли не совпадают")
        if password:
            candidate = User(username=login, first_name=name)
            try:
                validate_password(password, user=candidate)
            except ValidationError as exc:
                self.add_error("password", exc)

        cleaned["password"] = password
        cleaned["login"] = login
        cleaned["name"] = name
        cleaned["grade"] = cleaned.get("grade") or DEFAULT_GRADE
        return cleaned


class ProfileForm(forms.ModelForm):
    """Редактирование сведений профиля."""

    class Meta:
        model = User
        fields = ["first_name", "grade"]
