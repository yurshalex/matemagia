// Карта уровней испытания и запуск серии
(function () {
  var nodes = document.querySelectorAll(".challenge-node-level");
  var map = document.getElementById("challenge-map");
  var levelInput = document.getElementById("challenge-level");
  var form = document.getElementById("challenge-form");
  var LOCK = nodes[nodes.length - 1].querySelector(".node-circle").innerHTML;

  // Прототип: сколько уровней пройдено (на сервере — из прогресса ученика)
  var passed = 0;
  try { passed = +(localStorage.getItem("mm_levels_passed") || 0); } catch (err) {}

  nodes.forEach(function (node) {
    var level = +node.dataset.level;
    var circle = node.querySelector(".node-circle");
    var label = node.querySelector("small");
    node.classList.remove("is-open", "is-passed", "is-selected");
    if (level <= passed) { node.classList.add("is-passed"); circle.textContent = "✓"; label.textContent = "Пройден"; }
    else if (level === passed + 1) { node.classList.add("is-open"); circle.textContent = "★"; label.textContent = "Доступен"; }
    else { circle.innerHTML = LOCK; label.textContent = "Закрыт"; }
  });
  map.style.setProperty("--progress", Math.min(passed, 3) / 3);

  function select(node) {
    nodes.forEach(function (n) { n.classList.toggle("is-selected", n === node); });
    levelInput.value = node.dataset.level;
  }
  var firstOpen = document.querySelector(".challenge-node-level.is-open") || nodes[nodes.length - 1];
  select(firstOpen);

  nodes.forEach(function (node) {
    node.addEventListener("click", function () {
      if (node.classList.contains("is-open") || node.classList.contains("is-passed")) select(node);
      else window.mmToast("Уровень " + node.dataset.level + " откроется после уровня " + (+node.dataset.level - 1));
    });
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var topic = document.getElementById("challenge-topic-select").value;
    // Прототип: задания есть только по дробям
    if (topic !== "Дроби") { window.mmToast("В прототипе задания есть только по теме «Дроби»"); return; }
    location.href = form.getAttribute("action") + "?mode=challenge&level=" + levelInput.value + "&topic=" + encodeURIComponent(topic);
  });
})();
