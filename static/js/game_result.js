// Итоги испытания. В прототипе результат приходит из тренажёра в адресе:
// game_result.html?correct=7&total=10&xp=100&level=1 (на сервере — из ChallengeService.get_result).
(function () {
  var q = new URLSearchParams(location.search);
  var total = +(q.get("total") || 10);
  var correct = Math.min(+(q.get("correct") || 7), total);
  var xp = +(q.get("xp") || 100);
  var level = +(q.get("level") || 1);
  var percent = Math.round(correct / total * 100);
  var passed = percent >= 60;
  var $ = function (id) { return document.getElementById(id); };

  $("gr-title").textContent = passed ? "Испытание пройдено!" : "Почти получилось!";
  $("gr-sub").textContent = "Дроби · уровень " + level;
  $("gr-percent").textContent = percent + "%";
  $("gr-score").textContent = correct + " из " + total;
  $("gr-ring").setAttribute("aria-label", percent + "% верных ответов");
  $("gr-ring").classList.toggle("is-fail", !passed);
  $("gr-xp").textContent = "+" + xp;
  $("gr-unlock").textContent = passed ? (level < 4 ? "Уровень " + (level + 1) + " открыт" : "Все уровни пройдены") : "Нужно от 60%";
  $("gr-next").textContent = passed ? (level < 4 ? "К следующему уровню" : "К испытаниям") : "Попробовать снова";
  $("game-result").classList.toggle("is-fail", !passed);

  var stars = "";
  for (var i = 0; i < total; i++) stars += '<span class="star ' + (i < correct ? "is-correct" : "is-wrong") + '" style="--n:' + i + '"></span>';
  $("gr-stars").innerHTML = stars;

  // Кольцо заполняется от 0 до процента
  var ring = $("gr-ring"), reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) { ring.style.setProperty("--p", percent); return; }
  var start = null;
  ring.style.setProperty("--p", 0);
  requestAnimationFrame(function step(t) {
    if (!start) start = t;
    var k = Math.min((t - start) / 1000, 1);
    ring.style.setProperty("--p", Math.round(percent * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(step);
  });
})();
