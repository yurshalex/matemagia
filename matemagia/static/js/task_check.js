// Тренажёр и «Испытание» на данных сервера.
// Режимы (#trainer-card[data-mode]):
//   series    — серия из 10 заданий: GET /tasks/next/ → задание, POST /tasks/<id>/check/ → проверка;
//   single    — одно задание со страницы /tasks/<id>/ (работа над ошибками, история);
//   challenge — испытание: ответ POST /game/ (одна попытка), итоги — /game/result/.
// Форматы ответа: choice — текст варианта, input — строка, boolean — "true"/"false",
// ordering — список элементов, matching — объект {левое: правое}.
(function () {
  var card = document.getElementById("trainer-card");
  if (!card) return;
  var $ = function (id) { return document.getElementById(id); };
  var mode = card.dataset.mode;
  var form = $("task-form"), zone = $("answer-zone"), feedback = $("feedback-panel");
  var btn = { check: $("btn-check"), retry: $("btn-retry-task"), next: $("btn-next-task"),
              skip: $("btn-skip-task"), solution: $("btn-show-solution") };
  var starsBar = $("rating-stars-bar"), counter = $("task-counter");

  var CHIP = { choice: "Выбор ответа", input: "Ввод ответа", boolean: "Верно или неверно",
               ordering: "Упорядочивание", matching: "Сопоставление" };
  var TIP = {
    choice: "Выбери один вариант и нажми «Проверить».",
    input: "Впиши число. Дробь можно записать через косую черту: 3/4, десятичную — через запятую: 0,5.",
    boolean: "Реши, верно ли утверждение, и выбери ответ.",
    ordering: "Переставь элементы стрелками или перетащи мышью, затем нажми «Проверить».",
    matching: "Для каждого элемента слева выбери пару справа."
  };

  var task = null, total = +(card.dataset.total || 10), number = 0, tried = false, lastResponse = null;
  var results = [], busy = false;
  // Опыт показывается только в конце: считаем его как разницу total_xp из последнего ответа сервера
  // и опыта на момент открытия страницы (включает награды за достижения).
  var startXp = +(card.dataset.startXp || 0), lastTotalXp = null, earned = [];

  // ---------- Сервер ----------
  function csrf() {
    var m = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    if (m) return decodeURIComponent(m[1]);
    var input = document.querySelector("input[name=csrfmiddlewaretoken]");
    return input ? input.value : "";
  }
  function request(url, body) {
    var opts = { headers: { "Accept": "application/json", "X-Requested-With": "XMLHttpRequest" }, credentials: "same-origin" };
    if (body !== undefined) {
      opts.method = "POST";
      opts.headers["Content-Type"] = "application/json";
      opts.headers["X-CSRFToken"] = csrf();
      opts.body = JSON.stringify(body);
    }
    return fetch(url, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) { return { status: r.status, data: data }; });
    });
  }
  function setLoading(on) {
    busy = on;
    card.classList.toggle("is-loading", on);
    Object.keys(btn).forEach(function (k) { if (btn[k]) btn[k].disabled = on; });
  }
  function networkError() {
    setLoading(false);
    window.mmToast("Нет связи с сервером. Проверь интернет и попробуй ещё раз.");
  }

  // ---------- Текст и дроби ----------
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }
  function fracs(html) {
    return html.replace(/(^|[^\d\/])(\d+)\/(\d+)(?![\d\/])/g, function (m, pre, a, b) {
      return pre + '<span class="frac"><span>' + a + "</span><span>" + b + "</span></span>";
    });
  }
  function fmt(s) { return fracs(esc(s)); }

  // ---------- Звёзды серии ----------
  function buildStars(n) {
    starsBar.querySelectorAll(".star").forEach(function (s) { s.remove(); });
    for (var i = 0; i < n; i++) {
      var s = document.createElement("span");
      s.className = "star";
      starsBar.appendChild(s);
    }
  }
  function star(i) { return starsBar.querySelectorAll(".star")[i]; }
  function setResult(value) {
    var i = number - 1;
    if (i < 0 || results[i]) return;
    results[i] = value;
    var s = star(i);
    if (s) { s.classList.remove("is-current"); s.classList.add("is-" + value); }
  }

  // ---------- Отрисовка задания ----------
  function render(t, n) {
    task = t; number = n; tried = false; lastResponse = null;
    counter.textContent = number + " / " + total;
    starsBar.querySelectorAll(".star").forEach(function (s, i) { s.classList.toggle("is-current", i === number - 1 && !results[i]); });
    $("task-chip").textContent = (mode === "challenge" ? "Испытание · " : "Заклинание · ") + (CHIP[t.task_type] || t.task_type);
    $("task-question").innerHTML = fmt(t.condition);
    $("hint-text").textContent = TIP[t.task_type] || "";
    feedback.hidden = true;
    zone.innerHTML = "";
    zone.appendChild(build(t));
    setButtons("answer");
    form.classList.remove("task-area"); void form.offsetWidth; form.classList.add("task-area");
    var first = zone.querySelector("input, select, button");
    if (first && t.task_type === "input") first.focus();
  }

  function build(t) {
    var box = document.createElement("div"), opts;
    if (t.task_type === "choice" || t.task_type === "boolean") {
      opts = t.task_type === "boolean" ? [["true", "Верно"], ["false", "Неверно"]]
                                       : (t.options || []).map(function (o) { return [o, fmt(o)]; });
      box.className = t.task_type === "boolean" ? "options options-bool" : "options";
      box.setAttribute("role", "radiogroup");
      opts.forEach(function (o) {
        var label = document.createElement("label");
        label.className = "option-item";
        label.innerHTML = '<input class="answer-option-input" type="radio" name="answer" value="' + esc(o[0]) + '">' +
          '<span class="option-mark" aria-hidden="true"></span><span class="option-text">' + o[1] + "</span>";
        box.appendChild(label);
      });
    } else if (t.task_type === "input") {
      box.innerHTML = '<input class="input answer-input" id="answer-input" name="answer" autocomplete="off" inputmode="decimal" aria-label="Ответ" placeholder="Твой ответ">';
    } else if (t.task_type === "ordering") {
      var list = document.createElement("ol");
      list.className = "order-list";
      list.setAttribute("aria-label", "Перетащи или переставь стрелками");
      (t.items || []).forEach(function (item) {
        var li = document.createElement("li");
        li.className = "order-item";
        li.draggable = true;
        li.dataset.value = item;
        li.innerHTML = '<span class="grip" aria-hidden="true">⋮⋮</span><span class="order-text">' + fmt(item) + "</span>" +
          '<span class="order-btns"><button type="button" data-move="-1" aria-label="Выше">↑</button>' +
          '<button type="button" data-move="1" aria-label="Ниже">↓</button></span>';
        list.appendChild(li);
      });
      enableOrdering(list);
      box.appendChild(list);
    } else if (t.task_type === "matching") {
      box.className = "match-list";
      (t.left || []).forEach(function (left, i) {
        var row = document.createElement("div");
        row.className = "match-row";
        row.dataset.left = left;
        var o = '<option value="">Выбери…</option>' + (t.right || []).map(function (r) {
          return '<option value="' + esc(r) + '">' + esc(r) + "</option>";
        }).join("");
        row.innerHTML = '<span class="match-left">' + fmt(left) + '</span><span aria-hidden="true">→</span>' +
          '<select class="input" aria-label="Пара для «' + esc(left) + '»">' + o + "</select>";
        box.appendChild(row);
      });
    }
    return box;
  }

  // ---------- Упорядочивание: перестановка с анимацией (FLIP) ----------
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
      li._t = setTimeout(function () { li.classList.remove("is-moved-up", "is-moved-down", "is-shifted"); li.style.zIndex = ""; }, 700);
    });
    updateEdges(list);
  }
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
      animateReorder(list, function () { if (up) list.insertBefore(li, sibling); else list.insertBefore(sibling, li); }, li);
      var focusable = b.disabled ? li.querySelector("[data-move]:not(:disabled)") : b;
      if (focusable) focusable.focus();
    });
    list.addEventListener("dragstart", function (e) { dragged = e.target.closest("li"); if (dragged) dragged.classList.add("is-dragging"); });
    list.addEventListener("dragend", function () { if (dragged) dragged.classList.remove("is-dragging"); dragged = null; updateEdges(list); });
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
  function readAnswer() {
    var t = task.task_type;
    if (t === "choice" || t === "boolean") {
      var c = form.querySelector(".answer-option-input:checked");
      return c ? c.value : null;
    }
    if (t === "input") {
      var v = $("answer-input").value.trim();
      return v || null;
    }
    if (t === "ordering") return Array.prototype.map.call(zone.querySelectorAll(".order-item"), function (li) { return li.dataset.value; });
    var pairs = {}, full = true;
    zone.querySelectorAll(".match-row").forEach(function (row) {
      var v = row.querySelector("select").value;
      if (!v) full = false;
      pairs[row.dataset.left] = v;
    });
    return full ? pairs : null;
  }

  function parseCorrect(raw) {
    var t = task.task_type;
    if (t === "ordering" || t === "matching") { try { return JSON.parse(raw); } catch (e) { return null; } }
    if (t === "boolean") return String(raw).toLowerCase();
    return raw;
  }
  function correctText(raw) {
    var c = parseCorrect(raw), t = task.task_type;
    if (c === null || c === undefined) return "";
    if (t === "boolean") return c === "true" ? "Верно" : "Неверно";
    if (t === "ordering") return c.map(fmt).join(" → ");
    if (t === "matching") return Object.keys(c).map(function (k) { return fmt(k) + " → " + fmt(c[k]); }).join("; ");
    return fmt(c);
  }

  // Подсветка: answer — ответ ученика, correctRaw — эталон (после ответа сервера)
  function mark(ok, correctRaw, reveal) {
    var t = task.task_type, correct = parseCorrect(correctRaw);
    if (t === "choice" || t === "boolean") {
      zone.querySelectorAll(".option-item").forEach(function (el) {
        var input = el.querySelector("input"), m = el.querySelector(".option-mark");
        el.classList.remove("is-wrong", "is-correct"); m.textContent = "";
        if (input.checked && !reveal) { el.classList.add(ok ? "is-correct" : "is-wrong"); m.textContent = ok ? "✓" : "×"; }
        if (reveal && correct !== null && String(input.value).toLowerCase() === String(correct).toLowerCase()) {
          el.classList.add("is-correct"); m.textContent = "✓"; input.checked = true;
        }
      });
    } else if (t === "input") {
      var inp = $("answer-input");
      inp.classList.remove("is-wrong", "is-correct"); void inp.offsetWidth;
      if (reveal) { inp.value = correct; inp.classList.add("is-correct"); }
      else inp.classList.add(ok ? "is-correct" : "is-wrong");
    } else if (t === "ordering") {
      var list = zone.querySelector(".order-list");
      if (reveal && Array.isArray(correct)) animateReorder(list, function () {
        correct.forEach(function (v) {
          var li = Array.prototype.find.call(list.children, function (x) { return x.dataset.value === v; });
          if (li) list.appendChild(li);
        });
      }, null);
      list.classList.remove("is-wrong", "is-correct"); void list.offsetWidth;
      list.classList.add(ok || reveal ? "is-correct" : "is-wrong");
      if (Array.isArray(correct)) Array.prototype.forEach.call(list.children, function (li, k) {
        li.classList.remove("is-wrong", "is-correct");
        li.classList.add(li.dataset.value === correct[k] ? "is-correct" : "is-wrong");
      });
    } else if (t === "matching") {
      zone.querySelectorAll(".match-row").forEach(function (row) {
        var s = row.querySelector("select");
        if (reveal && correct) s.value = correct[row.dataset.left];
        row.classList.remove("is-wrong", "is-correct");
        if (correct) row.classList.add(s.value === correct[row.dataset.left] ? "is-correct" : "is-wrong");
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
    feedback.innerHTML = "<strong>" + title + "</strong>" + (html || "");
    feedback.hidden = false;
  }

  // state: answer — ждём ответ; retry — неверно, можно ещё раз; done — задание закрыто
  function setButtons(state) {
    btn.check.hidden = state !== "answer";
    btn.retry.hidden = state !== "retry";
    btn.solution.hidden = state !== "retry";
    btn.next.hidden = state === "answer";
    btn.skip.hidden = !(state === "answer" && mode === "series");
    btn.next.textContent = mode === "single" ? "Готово" : number >= total ? "Завершить" : "Дальше →";
  }

  // ---------- Испытание: данные для страницы итогов (sessionStorage) ----------
  var RUN_KEY = "mm-challenge-run";
  function loadRun() { try { return JSON.parse(sessionStorage.getItem(RUN_KEY)) || null; } catch (e) { return null; } }
  function saveRun(run) { try { sessionStorage.setItem(RUN_KEY, JSON.stringify(run)); } catch (e) { /* приватный режим */ } }

  // Новый ранг — короткое сообщение, достижения — всплывающие карточки (без опыта: он в итогах)
  function celebrate(data) {
    if (data.rank_changed) window.mmToast("Новый ранг: " + data.rank + "!");
    var list = (data.new_achievements_info && data.new_achievements_info.length) ? data.new_achievements_info : (data.new_achievements || []);
    list.forEach(function (a, i) {
      var info = window.mmAchievementInfo(a);
      if (earned.some(function (e) { return e.code === info.code; })) return;
      earned.push(info);
      setTimeout(function () { window.mmAchievement(info); }, i * 450);
    });
    if (mode === "challenge") {
      var run = loadRun() || { startXp: startXp, achievements: [] };
      list.forEach(function (a) {
        var info = window.mmAchievementInfo(a);
        if (!run.achievements.some(function (e) { return e.code === info.code; })) run.achievements.push(info);
      });
      saveRun(run);
    }
  }

  function showEarned() {
    var box = $("result-achievements"), list = $("result-achievements-list");
    if (!box) return;
    box.hidden = !earned.length;
    list.innerHTML = earned.map(function (a) {
      return '<li><span class="hex hex-gold hex-sm" aria-hidden="true">' + esc(a.icon) + "</span><span><b>" + esc(a.title) + "</b>" +
        (a.description ? "<small>" + esc(a.description) + "</small>" : "") + "</span></li>";
    }).join("");
  }
  function gainedXp() { return lastTotalXp === null ? 0 : Math.max(lastTotalXp - startXp, 0); }

  // ---------- Проверка ----------
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (busy || !task) return;
    var answer = readAnswer();
    if (answer === null) {
      window.mmToast(task.task_type === "matching" ? "Выбери пару для каждого элемента" : "Сначала дай ответ");
      return;
    }
    setLoading(true);
    var req = mode === "challenge"
      ? request(card.dataset.answerUrl, { answer: answer })
      : request(card.dataset.checkUrl.replace("/0/", "/" + task.id + "/"), { answer: answer });
    req.then(function (res) {
      setLoading(false);
      var d = res.data;
      if (res.status === 400 && d.code === 3001) { window.mmToast(firstError(d.errors) || "Неверный формат ответа"); return; }
      if (res.status === 409) { location.href = card.dataset.challengeUrl; return; }
      if (res.status >= 400) { window.mmToast(firstError(d.errors) || "Не удалось проверить ответ"); return; }
      onChecked(d, answer);
    }, networkError);
  });

  function firstError(errors) {
    if (!errors) return "";
    var k = Object.keys(errors)[0];
    var v = errors[k];
    return Array.isArray(v) ? v[0] : String(v);
  }

  function onChecked(d, answer) {
    lastResponse = d;
    var ok = !!d.is_correct;
    mark(ok, d.correct_answer, false);
    lock(true);
    if (typeof d.total_xp === "number") lastTotalXp = d.total_xp;
    celebrate(d);
    if (ok) {
      setResult(tried ? "wrong" : "correct");
      say("correct", "Заклинание сработало!", d.explanation ? " " + fmt(d.explanation) : "");
      setButtons("done");
    } else {
      tried = true;
      var expl = d.explanation ? " " + fmt(d.explanation) : "";
      if (mode === "challenge") {
        setResult("wrong");
        say("wrong", "Заклинание не сработало.", expl + (d.correct_answer ? "<br>Верный ответ: <b>" + correctText(d.correct_answer) + "</b>" : ""));
        setButtons("done");
      } else {
        say("wrong", "Заклинание не сработало.", expl);
        setButtons("retry");
      }
    }
    if (mode === "challenge") {
      setResult(ok ? "correct" : "wrong");
      card.dataset.finished = d.finished ? "1" : "";
      nextTask = d.task || null;
      if (d.finished) btn.next.textContent = "К итогам";
    }
  }
  var nextTask = null;

  btn.retry.addEventListener("click", function () {
    lock(false);
    zone.querySelectorAll(".is-wrong, .is-correct").forEach(function (el) { el.classList.remove("is-wrong", "is-correct"); });
    zone.querySelectorAll(".option-mark").forEach(function (m) { m.textContent = ""; });
    feedback.hidden = true;
    setButtons("answer");
  });

  btn.solution.addEventListener("click", function () {
    if (!lastResponse) return;
    setResult("wrong");
    mark(false, lastResponse.correct_answer, true);
    lock(true);
    say("solution", "Решение", " Верный ответ: <b>" + correctText(lastResponse.correct_answer) + "</b>." +
        (lastResponse.explanation ? " " + fmt(lastResponse.explanation) : ""));
    setButtons("done");
  });

  btn.skip.addEventListener("click", function () { setResult("skip"); loadNext(); });
  btn.next.addEventListener("click", function () {
    if (!results[number - 1]) setResult(tried ? "wrong" : "skip");
    if (mode === "single") { finish(); return; }
    if (mode === "challenge") {
      if (card.dataset.finished) { location.href = card.dataset.resultUrl; return; }
      if (nextTask) { render(nextTask, number + 1); return; }
      location.reload();
      return;
    }
    loadNext();
  });

  // ---------- Серия ----------
  function loadNext() {
    if (mode !== "series") return;
    if (number >= total) { finish(); return; }
    setLoading(true);
    request(card.dataset.nextUrl).then(function (res) {
      setLoading(false);
      var d = res.data;
      if (d.finished || res.status === 404) {
        if (number === 0) { emptySeries(); return; }
        finish();
        return;
      }
      if (res.status >= 400) { window.mmToast(firstError(d.errors) || "Не удалось получить задание"); return; }
      if (d.total && d.total !== total) { total = d.total; buildStars(total); }
      render(d, d.number || number + 1);
    }, networkError);
  }

  function emptySeries() {
    card.hidden = true;
    $("result-card").hidden = false;
    $("result-title").textContent = "Заданий пока нет";
    $("result-stars").innerHTML = "";
    $("result-text").textContent = "По этой теме и формату задания ещё не добавлены. Попробуй другой формат или тему.";
    $("result-xp").textContent = "";
  }

  function finish() {
    var done = results.slice(0, number);
    var correct = done.filter(function (r) { return r === "correct"; }).length;
    var n = Math.max(number, 1);
    var percent = Math.round(correct / n * 100);
    card.hidden = true;
    $("result-card").hidden = false;
    var xp = gainedXp();
    $("result-xp").textContent = xp ? "+" + xp + " опыта" : "Опыт не начислен";
    $("result-xp").classList.toggle("is-zero", !xp);
    showEarned();
    if (mode === "single") {
      $("result-stars").innerHTML = "";
      $("result-title").textContent = results[0] === "correct" ? "Ошибка исправлена!" : "Задание закрыто";
      $("result-text").textContent = results[0] === "correct" ? "Верно с первой попытки." : "Опыт начисляется за верный ответ с первой попытки.";
      return;
    }
    $("result-stars").innerHTML = done.map(function (r, i) {
      return '<span class="star is-' + (r || "skip") + '" style="--n:' + i + '"></span>';
    }).join("");
    $("result-title").textContent = percent >= 70 ? "Отличная серия!" : "Серия пройдена!";
    $("result-text").textContent = "С первой попытки верно " + correct + " из " + number + " (" + percent + "%)";
    starsBar.querySelectorAll(".star").forEach(function (s) { s.classList.remove("is-current"); });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---------- Старт ----------
  var initial = $("task-data") ? JSON.parse($("task-data").textContent) : null;
  if (mode === "single") total = 1;
  // Испытание началось заново (задание 1): запоминаем опыт до старта, достижения копим до итогов
  if (mode === "challenge" && +(card.dataset.position || 1) === 1) saveRun({ startXp: startXp, achievements: [] });
  buildStars(total);
  if (mode === "series") loadNext();
  else if (initial) render(initial, +(card.dataset.position || 1));
})();
