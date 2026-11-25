// Итоги испытания: кольцо процента заполняется от 0 (данные — из шаблона, ChallengeService.get_result)
(function () {
  var ring = document.querySelector("[data-percent-ring]");
  if (!ring || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var percent = +ring.dataset.percentRing, start = null;
  ring.style.setProperty("--p", 0);
  requestAnimationFrame(function step(t) {
    if (!start) start = t;
    var k = Math.min((t - start) / 1000, 1);
    ring.style.setProperty("--p", Math.round(percent * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(step);
  });
})();
