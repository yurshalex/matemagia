// Переключение уроков темы в боковом меню и кнопкой «Следующий урок»
(function () {
  var items = document.querySelectorAll(".sidebar-lesson-item[data-lesson]");
  var panels = document.querySelectorAll("[data-lesson-panel]");
  var next = document.getElementById("btn-next-lesson");
  var counter = document.getElementById("lesson-counter");
  var fill = document.getElementById("lesson-progress-fill");
  var total = panels.length;
  var current = 1;

  function show(n) {
    current = Math.min(Math.max(n, 1), total);
    panels.forEach(function (p) { p.hidden = +p.dataset.lessonPanel !== current; });
    items.forEach(function (it) {
      var active = +it.dataset.lesson === current;
      it.classList.toggle("is-active", active);
      if (active) it.setAttribute("aria-current", "step"); else it.removeAttribute("aria-current");
    });
    counter.textContent = "Урок " + current + " из " + total;
    fill.style.width = (current / total * 100) + "%";
    next.hidden = current === total;
    history.replaceState(null, "", "#lesson-" + current);
  }

  items.forEach(function (it) {
    it.addEventListener("click", function () { show(+it.dataset.lesson); });
  });
  next.addEventListener("click", function () {
    show(current + 1);
    document.querySelector(".theory-card").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  var m = location.hash.match(/lesson-(\d)/);
  show(m ? +m[1] : 1);
})();
