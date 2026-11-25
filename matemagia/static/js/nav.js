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
})();
