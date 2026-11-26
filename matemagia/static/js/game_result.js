// Итоги испытания: опыт и достижения за всё испытание, кольцо процента
(function () {
  // Данные о старте пишет task_check.js. Считаем один раз и сохраняем,
  // чтобы при обновлении страницы цифры не менялись.
  var KEY = "mm-challenge-run", run = null;
  try { run = JSON.parse(sessionStorage.getItem(KEY)); } catch (e) { run = null; }
  var xpEl = document.getElementById("challenge-xp"), note = document.getElementById("challenge-xp-note");
  var finals = [];
  try { finals = JSON.parse(document.getElementById("final-achievements").textContent) || []; } catch (e) { finals = []; }
  var fresh = !!run && !run.done;
  if (run && xpEl) {
    if (fresh) {
      var gained = +xpEl.dataset.currentXp - (+run.startXp || 0);
      run.gained = gained >= 0 ? gained : null;
      run.finalCodes = finals.map(function (a) { return a.code; });
      finals.forEach(function (a) {
        var info = window.mmAchievementInfo(a);
        if (!run.achievements.some(function (x) { return x.code === info.code; })) run.achievements.push(info);
      });
      run.done = true;
      try { sessionStorage.setItem(KEY, JSON.stringify(run)); } catch (e) { /* приватный режим */ }
    }
    if (run.gained != null) {
      xpEl.textContent = run.gained ? "+" + run.gained + " опыта" : "Опыт не начислен";
      xpEl.classList.toggle("is-zero", !run.gained);
      var bonus = +xpEl.dataset.bonus;
      note.textContent = run.gained ? "За задания и награды" + (bonus ? ", включая бонус +" + bonus + " за испытание" : "") : "";
    }
    // Список достижений: полученные во время испытания + выданные при завершении
    var box = document.getElementById("result-achievements"), list = document.getElementById("result-achievements-list");
    if (run.achievements.length && list) {
      list.innerHTML = "";
      run.achievements.forEach(function (a) {
        var li = document.createElement("li");
        li.innerHTML = '<span class="hex hex-gold hex-sm" aria-hidden="true"></span><span><b></b><small></small></span>';
        li.querySelector(".hex").textContent = a.icon;
        li.querySelector("b").textContent = a.title;
        li.querySelector("small").textContent = a.description || "";
        list.appendChild(li);
      });
      box.hidden = false;
    }
  }
  // Достижения, выданные при завершении, ещё не показывались всплывающими карточками
  if (fresh || !run) finals.forEach(function (a, i) { setTimeout(function () { window.mmAchievement(a); }, 700 + i * 450); });

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
