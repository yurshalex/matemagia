// Фильтр каталога тем: Все / В процессе / Новые / Пройденные
(function () {
  var buttons = document.querySelectorAll(".filter-btn");
  var cards = document.querySelectorAll(".topic-card");
  var empty = document.getElementById("topics-empty");

  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var filter = btn.dataset.filter;
      buttons.forEach(function (b) {
        b.classList.toggle("is-active", b === btn);
        b.setAttribute("aria-pressed", String(b === btn));
      });
      var shown = 0;
      cards.forEach(function (card) {
        var match = filter === "all" || card.dataset.status === filter;
        if (match) {
          shown++;
          card.hidden = false;
          card.style.animation = "none"; void card.offsetWidth;
          card.style.animation = "rise .4s cubic-bezier(.2,.8,.2,1) both";
          card.style.animationDelay = (shown * 50) + "ms";
        } else {
          card.hidden = true;
        }
      });
      if (empty) empty.hidden = shown > 0;
    });
  });
})();
