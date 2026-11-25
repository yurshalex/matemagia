// Проверка полей входа и регистрации в браузере. Окончательно проверяет сервер (AuthService):
// ошибки сервера приходят в шаблон и показываются под полями и в #form-alert.
(function () {
  var form = document.getElementById("login-form") || document.getElementById("register-form");
  if (!form) return;

  function showError(input, text) {
    var field = input.closest(".field");
    var error = field.querySelector(".field-error");
    var help = field.querySelector(".field-help");
    field.classList.toggle("has-error", !!text);
    error.textContent = text || "";
    error.hidden = !text;
    if (help) help.hidden = !!text;
  }

  function check(input) {
    var v = input.value.trim(), text = "";
    if (input.required && !v) text = "Обязательное поле.";
    else if (input.pattern && !new RegExp("^(?:" + input.pattern + ")$").test(v)) text = "Только латинские буквы, цифры и символы @ . + - _";
    else if (input.id === "id_password1" && v.length < 8) text = "Пароль слишком короткий — нужно не меньше 8 символов.";
    else if (input.id === "id_password1" && /^\d+$/.test(v)) text = "Пароль не может состоять только из цифр.";
    else if (input.id === "id_password2" && v !== document.getElementById("id_password1").value.trim()) text = "Введённые пароли не совпадают.";
    showError(input, text);
    return !text;
  }

  var inputs = Array.prototype.slice.call(form.querySelectorAll(".field input"));
  inputs.forEach(function (input) {
    input.addEventListener("blur", function () { if (input.value) check(input); });
    input.addEventListener("input", function () { if (input.closest(".field").classList.contains("has-error")) check(input); });
  });
  form.addEventListener("submit", function (e) {
    if (!inputs.map(check).every(Boolean)) {
      e.preventDefault();
      var first = form.querySelector(".has-error input");
      if (first) first.focus();
    }
  });
})();
