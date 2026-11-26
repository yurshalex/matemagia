// Общее для всех страниц: меню на телефоне, профиль, анимации появления, счётчики, всплывающее сообщение
(function () {
  // Каскадное появление элементов [data-reveal]
  document.querySelectorAll("[data-reveal]").forEach(function (el, i) {
    el.style.setProperty("--i", Math.min(i, 8));
  });

  // Меню на телефоне (кнопка-бургер)
  var navBtn = document.querySelector(".nav-toggle");
  var nav = document.getElementById("nav-links");
  if (navBtn && nav) {
    var setNav = function (open) {
      nav.classList.toggle("is-open", open);
      navBtn.setAttribute("aria-expanded", String(open));
      navBtn.setAttribute("aria-label", open ? "Закрыть меню" : "Меню");
    };
    navBtn.addEventListener("click", function (e) { e.stopPropagation(); setNav(!nav.classList.contains("is-open")); });
    document.addEventListener("click", function (e) { if (!nav.contains(e.target)) setNav(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") setNav(false); });
  }

  // Меню профиля
  var userBtn = document.querySelector(".user-profile-btn");
  var userMenu = document.getElementById("user-menu");
  if (userBtn && userMenu) {
    var setMenu = function (open) {
      userMenu.hidden = !open;
      userBtn.setAttribute("aria-expanded", String(open));
    };
    userBtn.addEventListener("click", function (e) { e.stopPropagation(); setMenu(userMenu.hidden); });
    document.addEventListener("click", function (e) { if (!userMenu.contains(e.target)) setMenu(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !userMenu.hidden) { setMenu(false); userBtn.focus(); }
    });
  }

  // Полосы процента верных: data-percent → ширина и цвет
  // < 50 % — красная, 50–80 % — жёлтая, > 80 % — зелёная
  document.querySelectorAll(".progress-bar[data-percent]").forEach(function (bar) {
    var p = +bar.dataset.percent;
    var fill = bar.querySelector("span") || bar.appendChild(document.createElement("span"));
    fill.style.width = p + "%";
    bar.classList.toggle("progress-bar-danger", p < 50);
    bar.classList.toggle("progress-bar-success", p > 80);
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", "100");
    bar.setAttribute("aria-valuenow", p);
  });

  // Счётчики, которые «набегают» от 0
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll("[data-count]").forEach(function (el) {
    if (reduce) return;
    var target = +el.dataset.count, suffix = el.dataset.suffix || "", start = null;
    function step(t) {
      if (!start) start = t;
      var k = Math.min((t - start) / 900, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3))) + suffix;
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });

  // Всплывающее сообщение: window.mmToast("текст")
  var toast = document.getElementById("toast"), timer;
  window.mmToast = function (text) {
    if (!toast) return;
    toast.textContent = text;
    toast.hidden = false;
    toast.style.animation = "none"; void toast.offsetWidth; toast.style.animation = "";
    clearTimeout(timer);
    timer = setTimeout(function () { toast.hidden = true; }, 2400);
  };

  // ---------- Уведомления о достижениях ----------
  // Справочник повторяет фикстуру game/fixtures/achievements.json: в ответе испытания
  // сервер присылает только коды (new_achievements), без названий.
  var ACH = {
    first_task: { title: "Первое заклинание", description: "Реши первое задание", icon_code: "star", xp_reward: 10 },
    ten_tasks: { title: "Десятка", description: "Реши 10 заданий", icon_code: "ten", xp_reward: 20 },
    fifty_tasks: { title: "Полсотни", description: "Реши 50 заданий", icon_code: "fifty", xp_reward: 50 },
    century: { title: "Сотня", description: "Реши 100 заданий", icon_code: "hundred", xp_reward: 100 },
    no_errors: { title: "Без единой ошибки", description: "Пройди «Испытание» без ошибок", icon_code: "check", xp_reward: 40 },
    three_challenges: { title: "Три испытания", description: "Пройди «Испытание» три раза", icon_code: "three", xp_reward: 50 },
    week_streak: { title: "Неделя практики", description: "Занимайся семь дней подряд", icon_code: "seven", xp_reward: 40 },
    fix_errors: { title: "Работа над ошибками", description: "Верно реши ранее ошибочное задание", icon_code: "plus", xp_reward: 20 }
  };
  var ICON = { star: "★", ten: "10", fifty: "50", hundred: "100", check: "✓", three: "3", seven: "7", plus: "+" };

  // Приводит код или объект из ответа сервера к {code, title, description, icon}
  window.mmAchievementInfo = function (a) {
    var code = typeof a === "string" ? a : (a && a.code) || "";
    var base = ACH[code] || {};
    var src = typeof a === "object" && a ? a : {};
    var icon = src.icon_code || base.icon_code;
    return {
      code: code,
      title: src.title || base.title || "Новое достижение",
      description: src.description || base.description || "",
      icon: ICON[icon] || "✦",
      xp_reward: src.xp_reward != null ? src.xp_reward : (base.xp_reward || 0)
    };
  };

  // Всплывающая карточка «Новое достижение!»; несколько подряд показываются стопкой
  var stack;
  window.mmAchievement = function (a) {
    var info = window.mmAchievementInfo(a);
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "ach-stack";
      stack.setAttribute("role", "status");
      stack.setAttribute("aria-live", "polite");
      document.body.appendChild(stack);
    }
    var el = document.createElement("div");
    el.className = "ach-toast";
    el.innerHTML = '<span class="ach-toast-icon" aria-hidden="true"></span>' +
      '<span class="ach-toast-body"><small>Новое достижение!</small><strong></strong><span></span></span>' +
      '<button class="ach-toast-close" type="button" aria-label="Закрыть">×</button>';
    el.querySelector(".ach-toast-icon").textContent = info.icon;
    el.querySelector("strong").textContent = info.title;
    el.querySelector(".ach-toast-body > span").textContent = info.description;
    var close = function () {
      if (el.classList.contains("is-leaving")) return;
      el.classList.add("is-leaving");
      setTimeout(function () { el.remove(); }, reduce ? 0 : 300);
    };
    el.querySelector("button").addEventListener("click", close);
    stack.appendChild(el);
    setTimeout(close, 5200);
    return info;
  };
})();
