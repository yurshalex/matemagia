// Проверка полей входа и регистрации в браузере.
// Окончательную проверку (логин занят, неверный пароль) делает сервер.
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
    var v = input.value.trim();
    var text = "";
    if (input.required && !v) text = "Обязательное поле.";
    else if (input.id === "id_username" && input.pattern && !new RegExp("^" + input.pattern + "$").test(v))
      text = "Только латинские буквы, цифры и символы @ . + - _";
    else if (input.id === "id_password1" && v.length < 6) text = "Пароль слишком короткий — нужно не меньше 6 символов.";
    else if (input.id === "id_password1" && /^\d+$/.test(v)) text = "Пароль не может состоять только из цифр.";
    else if (input.id === "id_password2" && v !== document.getElementById("id_password1").value.trim())
      text = "Введённые пароли не совпадают.";
    showError(input, text);
    return !text;
  }

  var inputs = Array.prototype.slice.call(form.querySelectorAll("input"));
  inputs.forEach(function (input) {
    input.addEventListener("blur", function () { if (input.value) check(input); });
    input.addEventListener("input", function () {
      if (input.closest(".field").classList.contains("has-error")) check(input);
    });
  });

  form.addEventListener("submit", function (e) {
    var ok = inputs.map(check).every(Boolean);
    if (!ok) {
      e.preventDefault();
      var first = form.querySelector(".has-error input");
      if (first) first.focus();
      return;
    }
    // Прототип: запоминаем имя и класс, чтобы показать их на главной
    try {
      var name = document.getElementById("id_first_name");
      var grade = document.getElementById("id_grade");
      if (name) localStorage.setItem("mm_name", name.value.trim());
      if (grade) localStorage.setItem("mm_grade", grade.value);
    } catch (err) { /* хранилище недоступно — не страшно */ }
    // Прототип: просто переходим на главную, не передавая пароль в адресе
    e.preventDefault();
    window.location.href = form.getAttribute("action");
  });
})();
