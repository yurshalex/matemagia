// Тренажёр и режим «Испытание».
// В прототипе задания лежат в массиве TASKS; на сервере их выдаёт /tasks/next/, а проверку делает /tasks/<id>/check/.
(function () {
  function F(a, b) { return '<span class="frac"><span>' + a + "</span><span>" + b + "</span></span>"; }

  var TASKS = [
    { type: "choice", question: "Найди значение выражения:", expr: F(3, 8) + " + " + F(1, 4),
      options: [F(5, 8), F(4, 8), F(3, 12), F(5, 12)], correct: 0,
      hint: "Приведи дроби к общему знаменателю. Здесь удобнее всего — 8.",
      wrong: "Числители и знаменатели нельзя складывать по отдельности. Сначала приведи дроби к общему знаменателю.",
      solution: F(1, 4) + " = " + F(2, 8) + ", значит " + F(3, 8) + " + " + F(2, 8) + " = " + F(5, 8) + "." },
    { type: "input", question: "Вычисли и запиши ответ дробью:", expr: F(7, 9) + " − " + F(4, 9) + " =",
      accept: ["3/9", "1/3"], placeholder: "Например, 2/9",
      hint: "Знаменатели одинаковые — вычитай только числители.",
      wrong: "Знаменатель остаётся тем же, вычитаются только числители.",
      solution: F(7, 9) + " − " + F(4, 9) + " = " + F(3, 9) + " = " + F(1, 3) + "." },
    { type: "choice", question: "Какая дробь больше " + F(1, 2) + "?", expr: "",
      options: [F(2, 5), F(3, 8), F(4, 7), F(1, 3)], correct: 2,
      hint: "Дробь больше половины, если числитель больше половины знаменателя.",
      wrong: "Сравни числитель с половиной знаменателя.",
      solution: "У " + F(4, 7) + " числитель 4 больше половины от 7 (3,5), значит " + F(4, 7) + " > " + F(1, 2) + "." },
    { type: "ordering", question: "Расставь дроби по возрастанию:", expr: "",
      items: [F(3, 4), F(1, 6), F(1, 2), F(1, 3)], order: [1, 3, 2, 0],
      hint: "У дробей с числителем 1 больше та, у которой знаменатель меньше.",
      wrong: "Проверь порядок: сначала самая маленькая дробь.",
      solution: F(1, 6) + " < " + F(1, 3) + " < " + F(1, 2) + " < " + F(3, 4) + "." },
    { type: "matching", question: "Сопоставь дробь и десятичную запись:", expr: "",
      left: [F(1, 2), F(1, 4), F(3, 4), F(1, 5)], right: ["0,25", "0,2", "0,5", "0,75"], pairs: [2, 0, 3, 1],
      hint: "Раздели числитель на знаменатель.",
      wrong: "Не все пары верны. Раздели числитель на знаменатель.",
      solution: F(1, 2) + " = 0,5; " + F(1, 4) + " = 0,25; " + F(3, 4) + " = 0,75; " + F(1, 5) + " = 0,2." },
    { type: "input", question: "Сократи дробь:", expr: F(6, 8) + " =",
      accept: ["3/4"], placeholder: "Например, 1/2",
      hint: "Раздели числитель и знаменатель на одно и то же число.",
      wrong: "Найди общий делитель числителя и знаменателя и раздели на него.",
      solution: "6 и 8 делятся на 2: " + F(6, 8) + " = " + F(3, 4) + "." },
    { type: "choice", question: "Какая дробь правильная?", expr: "",
      options: [F(7, 5), F(9, 9), F(3, 7), F(11, 4)], correct: 2,
      hint: "У правильной дроби числитель меньше знаменателя.",
      wrong: "У правильной дроби числитель меньше знаменателя.",
      solution: "Только у " + F(3, 7) + " числитель меньше знаменателя." },
    { type: "input", question: "Найди " + F(2, 3) + " от числа 12:", expr: "",
      accept: ["8"], placeholder: "Число",
      hint: "Сначала найди одну треть, потом умножь на 2.",
      wrong: "Раздели 12 на знаменатель и умножь на числитель.",
      solution: "12 : 3 = 4, 4 · 2 = 8." },
    { type: "choice", question: "Найди значение выражения:", expr: "1 − " + F(3, 10),
      options: [F(2, 10), F(7, 10), F(3, 10), F(4, 10)], correct: 1,
      hint: "Представь 1 как дробь со знаменателем 10.",
      wrong: "Единица — это " + F(10, 10) + ". Вычти из неё " + F(3, 10) + ".",
      solution: "1 = " + F(10, 10) + ", " + F(10, 10) + " − " + F(3, 10) + " = " + F(7, 10) + "." },
    { type: "ordering", question: "Расставь дроби по убыванию:", expr: "",
      items: [F(2, 9), F(7, 9), F(4, 9), F(5, 9)], order: [1, 3, 2, 0],
      hint: "Знаменатели одинаковые — сравни числители.",
      wrong: "При одинаковых знаменателях больше дробь с большим числителем.",
      solution: F(7, 9) + " > " + F(5, 9) + " > " + F(4, 9) + " > " + F(2, 9) + "." }
  ];
  var CHIP = { choice: "Выбор ответа", input: "Ввод ответа", ordering: "Упорядочивание", matching: "Сопоставление" };
  var BASE_XP = 10, STREAK_MIN = 3, STREAK_BONUS_XP = 5, CHALLENGE_SUCCESS_PERCENT = 60, CHALLENGE_BONUS_XP = 30;

  var params = new URLSearchParams(location.search);
  var challenge = params.get("mode") === "challenge";
  var level = +(params.get("level") || 1);
  var topic = params.get("topic") || "Дроби";

  var $ = function (id) { return document.getElementById(id); };
  var form = $("task-form"), zone = $("answer-zone"), feedback = $("feedback-panel");
  var btn = { check: $("btn-check"), retry: $("btn-retry-task"), next: $("btn-next-task"),
              skip: $("btn-skip-task"), solution: $("btn-show-solution") };
  var starsBar = $("rating-stars-bar"), counter = $("task-counter");

  var idx = 0, results = [], tried = false, xp = 0, streak = 0;

  // ---------- Режим ----------
  if (challenge) {
    $("task-header").textContent = "Испытание · " + topic + " · уровень " + level;
    $("trainer-card").classList.add("is-challenge");
    $("owl-hint-box").hidden = true;
    btn.solution.hidden = true;
    $("link-back").href = $("trainer-card").dataset.challengeUrl;
    $("link-back").textContent = "← К испытанию";
    $("btn-result-back").href = $("trainer-card").dataset.challengeUrl;
    $("btn-result-back").textContent = "К испытанию";
    $("btn-again").href = location.href;
  }

  TASKS.forEach(function () {
    var s = document.createElement("span");
    s.className = "star";
    starsBar.appendChild(s);
  });
  var stars = starsBar.querySelectorAll(".star");

  // Продолжение начатой серии: task_trainer.html?task=3 (предыдущие задания уже решены)
  var startAt = Math.min(Math.max(+(params.get("task") || 1), 1), TASKS.length);
  if (!challenge && startAt > 1) {
    for (var k = 0; k < startAt - 1; k++) { results[k] = "correct"; stars[k].classList.add("is-correct"); }
    idx = startAt - 1;
  }

  // ---------- Отрисовка ----------
  function render() {
    var t = TASKS[idx];
    tried = false;
    counter.textContent = (idx + 1) + " / " + TASKS.length;
    stars.forEach(function (s, i) { s.classList.toggle("is-current", i === idx && !results[i]); });
    $("task-chip").textContent = (challenge ? "Испытание · " : "Заклинание · ") + CHIP[t.type];
    $("task-question").innerHTML = t.question;
    $("task-expression").innerHTML = t.expr;
    $("task-expression").hidden = !t.expr;
    $("hint-text").textContent = t.hint;
    $("owl-hint-box").classList.add("is-hidden");
    $("btn-hint").hidden = false;
    feedback.hidden = true;
    zone.innerHTML = "";
    zone.appendChild(build(t));
    setButtons("answer");
    form.classList.remove("task-area"); void form.offsetWidth; form.classList.add("task-area");
  }

  function build(t) {
    var box = document.createElement("div");
    if (t.type === "choice") {
      box.className = "options";
      box.setAttribute("role", "radiogroup");
      t.options.forEach(function (html, i) {
        var label = document.createElement("label");
        label.className = "option-item";
        label.innerHTML = '<input class="answer-option-input" type="radio" name="answer" value="' + i + '">' +
          '<span class="option-mark" aria-hidden="true"></span>' + html;
        box.appendChild(label);
      });
    } else if (t.type === "input") {
      box.innerHTML = '<input class="input answer-input" id="answer-input" name="answer" autocomplete="off" inputmode="numeric" ' +
        'aria-label="Ответ" placeholder="' + t.placeholder + '">';
      setTimeout(function () { var el = $("answer-input"); if (el) el.focus(); }, 50);
    } else if (t.type === "ordering") {
      var list = document.createElement("ol");
      list.className = "order-list";
      list.setAttribute("aria-label", "Перетащи или переставь стрелками");
      t.items.forEach(function (html, i) {
        var li = document.createElement("li");
        li.className = "order-item";
        li.draggable = true;
        li.dataset.idx = i;
        li.innerHTML = '<span class="grip" aria-hidden="true">⋮⋮</span>' + html +
          '<span class="order-btns"><button type="button" data-move="-1" aria-label="Выше">↑</button>' +
          '<button type="button" data-move="1" aria-label="Ниже">↓</button></span>';
        list.appendChild(li);
      });
      enableOrdering(list);
      box.appendChild(list);
    } else if (t.type === "matching") {
      box.className = "match-list";
      t.left.forEach(function (html, i) {
        var row = document.createElement("div");
        row.className = "match-row";
        var opts = '<option value="">Выбери…</option>' + t.right.map(function (r, j) {
          return '<option value="' + j + '">' + r + "</option>";
        }).join("");
        row.innerHTML = html + '<span aria-hidden="true">=</span><select class="input" aria-label="Пара для дроби ' + (i + 1) + '">' + opts + "</select>";
        box.appendChild(row);
      });
    }
    return box;
  }

  // Перестановка с анимацией (FLIP): запоминаем положения, меняем порядок,
  // затем плавно «довозим» каждый пункт со старого места на новое
  function animateReorder(list, change, moved) {
    var items = Array.prototype.slice.call(list.children);
    var before = items.map(function (li) { return li.getBoundingClientRect().top; });
    change();
    items.forEach(function (li, i) {
      var dy = before[i] - li.getBoundingClientRect().top;
      if (!dy) return;
      li.style.transition = "none";
      li.style.transform = "translateY(" + dy + "px)";
      li.style.zIndex = li === moved ? 2 : 1;
      void li.offsetWidth;
      li.style.transition = "transform .38s cubic-bezier(.2,.8,.2,1)";
      li.style.transform = "";
      li.classList.remove("is-moved-up", "is-moved-down", "is-shifted");
      void li.offsetWidth;
      li.classList.add(li === moved ? (dy > 0 ? "is-moved-up" : "is-moved-down") : "is-shifted");
      clearTimeout(li._t);
      li._t = setTimeout(function () {
        li.classList.remove("is-moved-up", "is-moved-down", "is-shifted");
        li.style.zIndex = "";
      }, 700);
    });
    updateEdges(list);
  }

  // Крайние стрелки неактивны: первый пункт выше не поднять, последний — ниже не опустить
  function updateEdges(list) {
    var items = list.children, locked = list.classList.contains("is-locked");
    Array.prototype.forEach.call(items, function (li, i) {
      li.querySelector('[data-move="-1"]').disabled = locked || i === 0;
      li.querySelector('[data-move="1"]').disabled = locked || i === items.length - 1;
    });
  }

  function enableOrdering(list) {
    var dragged = null;
    updateEdges(list);
    list.addEventListener("click", function (e) {
      var b = e.target.closest("[data-move]");
      if (!b || b.disabled || list.classList.contains("is-locked")) return;
      var li = b.closest("li"), up = +b.dataset.move < 0;
      var sibling = up ? li.previousElementSibling : li.nextElementSibling;
      if (!sibling) return;
      animateReorder(list, function () {
        if (up) list.insertBefore(li, sibling); else list.insertBefore(sibling, li);
      }, li);
      if (!b.disabled) b.focus(); else li.querySelector("[data-move]:not(:disabled)").focus();
    });
    list.addEventListener("dragstart", function (e) { dragged = e.target.closest("li"); dragged.classList.add("is-dragging"); });
    list.addEventListener("dragend", function () {
      if (dragged) dragged.classList.remove("is-dragging");
      dragged = null;
      updateEdges(list);
    });
    list.addEventListener("dragover", function (e) {
      e.preventDefault();
      var over = e.target.closest("li");
      if (!dragged || !over || over === dragged || over.style.transform) return;
      var r = over.getBoundingClientRect();
      var ref = e.clientY > r.top + r.height / 2 ? over.nextSibling : over;
      if (ref === dragged || ref === dragged.nextSibling) return;
      animateReorder(list, function () { list.insertBefore(dragged, ref); }, null);
    });
  }

  // ---------- Ответ ----------
  function readAnswer(t) {
    if (t.type === "choice") {
      var c = form.querySelector(".answer-option-input:checked");
      return c ? +c.value : null;
    }
    if (t.type === "input") {
      var v = $("answer-input").value.replace(/\s/g, "");
      return v || null;
    }
    if (t.type === "ordering") {
      return Array.prototype.map.call(zone.querySelectorAll(".order-item"), function (li) { return +li.dataset.idx; });
    }
    var sel = zone.querySelectorAll("select");
    var vals = Array.prototype.map.call(sel, function (s) { return s.value === "" ? null : +s.value; });
    return vals.indexOf(null) === -1 ? vals : null;
  }

  function isCorrect(t, a) {
    if (t.type === "choice") return a === t.correct;
    if (t.type === "input") return t.accept.indexOf(a) !== -1;
    if (t.type === "ordering") return a.join() === t.order.join();
    return a.join() === t.pairs.join();
  }

  function mark(t, a, ok, reveal) {
    if (t.type === "choice") {
      zone.querySelectorAll(".option-item").forEach(function (el, i) {
        el.classList.remove("is-wrong", "is-correct");
        if (i === a) { el.classList.add(ok ? "is-correct" : "is-wrong"); el.querySelector(".option-mark").textContent = ok ? "✓" : "×"; }
        if (reveal && i === t.correct) { el.classList.add("is-correct"); el.querySelector(".option-mark").textContent = "✓"; }
      });
    } else if (t.type === "input") {
      var inp = $("answer-input");
      inp.classList.remove("is-wrong", "is-correct");
      void inp.offsetWidth;
      inp.classList.add(ok ? "is-correct" : "is-wrong");
      if (reveal) { inp.value = t.accept[t.accept.length - 1]; inp.classList.replace("is-wrong", "is-correct"); }
    } else if (t.type === "ordering") {
      var list = zone.querySelector(".order-list");
      if (reveal) animateReorder(list, function () {
        t.order.forEach(function (i) { list.appendChild(list.querySelector('[data-idx="' + i + '"]')); });
      }, null);
      list.classList.remove("is-wrong", "is-correct");
      void list.offsetWidth;
      list.classList.add(ok || reveal ? "is-correct" : "is-wrong");
      // Подсветка каждого пункта: зелёный — стоит на своём месте, красный — нет
      Array.prototype.forEach.call(list.children, function (li, k) {
        li.classList.remove("is-wrong", "is-correct");
        li.classList.add(+li.dataset.idx === t.order[k] ? "is-correct" : "is-wrong");
      });
    } else {
      zone.querySelectorAll(".match-row").forEach(function (row, i) {
        var s = row.querySelector("select");
        if (reveal) s.value = t.pairs[i];
        var good = +s.value === t.pairs[i];
        row.classList.remove("is-wrong", "is-correct");
        row.classList.add(good ? "is-correct" : "is-wrong");
      });
    }
  }

  function lock(on) {
    zone.querySelectorAll("input, select, button").forEach(function (el) { el.disabled = on; });
    var list = zone.querySelector(".order-list");
    if (list) {
      list.classList.toggle("is-locked", on);
      list.querySelectorAll("li").forEach(function (li) { li.draggable = !on; });
      updateEdges(list);
    }
  }

  function say(kind, title, html) {
    feedback.className = "feedback-panel is-" + kind;
    feedback.innerHTML = "<strong>" + title + "</strong>" + html;
    feedback.hidden = false;
  }

  function setButtons(state) {
    btn.check.hidden = state !== "answer";
    btn.retry.hidden = state !== "retry" || challenge;
    btn.next.hidden = !(state === "done" || (state === "retry" && challenge));
    btn.skip.hidden = state === "done" || (state === "retry" && challenge);
    btn.solution.hidden = challenge || state === "done";
    btn.next.textContent = idx === TASKS.length - 1 ? "Завершить" : "Дальше →";
  }

  function floatXP(amount) {
    var r = btn.next.getBoundingClientRect();
    var el = document.createElement("div");
    el.className = "xp-float";
    el.textContent = "+" + amount + " опыта";
    el.style.left = (r.left + r.width / 2) + "px";
    el.style.top = (r.top - 10) + "px";
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 1400);
  }

  function setResult(value) {
    if (results[idx]) return;
    results[idx] = value;
    stars[idx].classList.remove("is-current");
    stars[idx].classList.add("is-" + value);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var t = TASKS[idx], a = readAnswer(t);
    if (a === null) { window.mmToast(t.type === "matching" ? "Выбери пару для каждой дроби" : "Сначала дай ответ"); return; }
    var ok = isCorrect(t, a);
    mark(t, a, ok, false);
    lock(true);
    if (ok) {
      var first = !tried;
      setResult(first ? "correct" : "wrong");
      var earned = 0;
      if (first) {
        streak++;
        earned = BASE_XP + (streak >= STREAK_MIN ? STREAK_BONUS_XP : 0);
        xp += earned;
      }
      say("correct", "Заклинание сработало!", earned ? " +" + earned + " опыта" + (streak >= STREAK_MIN ? " (серия " + streak + " подряд)" : "") : " Опыт начисляется за ответ с первой попытки.");
      setButtons("done");
      if (earned) floatXP(earned);
    } else {
      tried = true;
      streak = 0;
      if (challenge) setResult("wrong");
      say("wrong", "Заклинание не сработало.", " " + t.wrong);
      setButtons("retry");
    }
  });

  btn.retry.addEventListener("click", function () {
    lock(false);
    zone.querySelectorAll(".is-wrong, .is-correct").forEach(function (el) { el.classList.remove("is-wrong", "is-correct"); });
    zone.querySelectorAll(".option-mark").forEach(function (m) { m.textContent = ""; });
    feedback.hidden = true;
    setButtons("answer");
  });

  btn.solution.addEventListener("click", function () {
    var t = TASKS[idx];
    streak = 0;
    setResult("wrong");
    mark(t, null, false, true);
    lock(true);
    say("solution", "Решение", " " + t.solution);
    setButtons("done");
  });

  btn.skip.addEventListener("click", function () { streak = 0; setResult("skip"); go(); });
  btn.next.addEventListener("click", go);
  $("btn-hint").addEventListener("click", function () {
    $("owl-hint-box").classList.remove("is-hidden");
    this.hidden = true;
  });

  function go() {
    if (idx < TASKS.length - 1) { idx++; render(); return; }
    finish();
  }

  // ---------- Итог ----------
  function finish() {
    var correct = results.filter(function (r) { return r === "correct"; }).length;
    var percent = Math.round(correct / TASKS.length * 100);
    $("trainer-card").hidden = true;
    var card = $("result-card");
    card.hidden = false;
    $("result-stars").innerHTML = results.map(function (r, i) {
      return '<span class="star is-' + (r || "skip") + '" style="--n:' + i + '"></span>';
    }).join("");
    var text = "Верно " + correct + " из " + TASKS.length + " (" + percent + "%)";
    if (challenge) {
      var passed = percent >= CHALLENGE_SUCCESS_PERCENT;
      $("result-title").textContent = passed ? "Испытание пройдено!" : "Почти получилось!";
      if (passed) {
        xp += CHALLENGE_BONUS_XP;
        text += " · бонус +" + CHALLENGE_BONUS_XP + " опыта";
        try {
          var done = +(localStorage.getItem("mm_levels_passed") || 0);
          localStorage.setItem("mm_levels_passed", Math.max(done, level));
        } catch (err) {}
        if (level < 4) text += " · открыт уровень " + (level + 1);
      } else {
        text += " · нужно от " + CHALLENGE_SUCCESS_PERCENT + "%";
      }
    } else {
      $("result-title").textContent = correct >= 7 ? "Отличная серия!" : "Серия пройдена!";
    }
    $("result-text").textContent = text;
    $("result-xp").textContent = "+" + xp + " опыта";
    stars.forEach(function (s) { s.classList.remove("is-current"); });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  render();
})();
