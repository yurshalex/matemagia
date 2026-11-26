// Карточки теории: интерактивные модели, шаги решения, карточки-перевёртыши и мини-проверки.
// Разметка карточек — templates/learning/cards/<slug темы>.html. Модель задаётся атрибутом
// data-widget="<имя>", начальные значения — data-* атрибутами того же элемента.
(function () {
  var deck = document.querySelector(".tc-deck");
  if (!deck) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- Помощники ----------
  function h(tag, cls, html) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (html != null) el.innerHTML = html;
    return el;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }
  function num(n) { return Number(n).toLocaleString("ru-RU").replace(/ /g, " "); }
  function frac(a, b) { return '<span class="frac"><span>' + a + "</span><span>" + b + "</span></span>"; }
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = b; b = a % b; a = t; } return a; }
  function lcm(a, b) { return a / gcd(a, b) * b; }

  // Ползунок: <label><span>Подпись <b>значение</b></span><input type=range></label>
  function slider(label, min, max, value, onInput, unit) {
    var wrap = h("label", "tc-ctl");
    wrap.innerHTML = "<span>" + label + " <b></b></span>";
    var input = h("input");
    input.type = "range"; input.min = min; input.max = max; input.value = value;
    var out = wrap.querySelector("b");
    var sync = function () { out.textContent = input.value + (unit || ""); };
    input.addEventListener("input", function () { sync(); onInput(+input.value); });
    sync();
    wrap.appendChild(input);
    wrap.set = function (v) { input.value = v; sync(); };
    wrap.input = input;
    return wrap;
  }
  function field(label, value, onInput, attrs) {
    var wrap = h("label", "tc-ctl tc-ctl-input");
    wrap.innerHTML = "<span>" + label + "</span>";
    var input = h("input", "tc-input");
    input.value = value; input.autocomplete = "off"; input.inputMode = (attrs && attrs.inputMode) || "numeric";
    input.addEventListener("input", function () { onInput(input.value); });
    wrap.appendChild(input);
    wrap.input = input;
    return wrap;
  }
  function select(label, options, value, onChange) {
    var wrap = h("label", "tc-ctl tc-ctl-input");
    wrap.innerHTML = "<span>" + label + "</span>";
    var sel = h("select", "tc-input");
    options.forEach(function (o) {
      var opt = h("option", null, esc(o[1]));
      opt.value = o[0];
      if (String(o[0]) === String(value)) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", function () { onChange(sel.value); });
    wrap.appendChild(sel);
    wrap.input = sel;
    return wrap;
  }
  function button(text, cls, onClick) {
    var b = h("button", "tc-btn " + (cls || ""), text);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }
  function controls(root) { var c = h("div", "tc-controls"); root.appendChild(c); return c; }
  function stage(root) { var s = h("div", "tc-stage"); root.appendChild(s); return s; }
  function note(root) { var n = h("p", "tc-note"); n.setAttribute("aria-live", "polite"); root.appendChild(n); return n; }
  function bump(el) { el.classList.remove("tc-bump"); void el.offsetWidth; el.classList.add("tc-bump"); }

  var W = {};

  // ---------- 1. Натуральные числа ----------
  var PLACE = ["единиц", "десятков", "сотен"];
  var CLASS = ["единиц", "тысяч", "миллионов"];
  var PLACE_SHORT = ["ед.", "дес.", "сот."];

  W["place-value"] = function (root, o) {
    var value = o.value || "4507239", picked = null;
    var c = controls(root), s = stage(root), n = note(root);
    c.appendChild(field("Введи число (до 9 цифр)", value, function (v) {
      value = v.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 9); picked = null; draw();
    }));
    function draw() {
      if (!value) { s.innerHTML = ""; n.textContent = "Введи число."; return; }
      var digits = value.split(""), len = digits.length;
      var classes = Math.ceil(len / 3), html = '<div class="tc-place" style="--cols:' + classes * 3 + '">';
      for (var k = classes - 1; k >= 0; k--) html += '<div class="tc-place-class" style="grid-column: span 3">' + CLASS[k] + "</div>";
      for (var p = classes * 3 - 1; p >= 0; p--) html += '<div class="tc-place-name">' + PLACE_SHORT[p % 3] + "</div>";
      for (var q = classes * 3 - 1; q >= 0; q--) {
        var d = q < len ? digits[len - 1 - q] : "";
        html += d === "" ? '<div class="tc-place-digit is-empty"></div>'
          : '<button type="button" class="tc-place-digit' + (picked === q ? " is-picked" : "") +
            '" data-pos="' + q + '">' + d + "</button>";
      }
      html += "</div>";
      var parts = [];
      digits.forEach(function (d, i) { if (d !== "0") parts.push(num(+d * Math.pow(10, len - 1 - i))); });
      html += '<p class="tc-expanded"><b>' + num(+value) + "</b> = " + (parts.join(" + ") || "0") + "</p>";
      s.innerHTML = html;
      if (picked === null) { n.textContent = "Нажми на цифру — узнаешь её разряд и класс."; return; }
      var digit = digits[len - 1 - picked];
      n.innerHTML = "Цифра <b>" + digit + "</b> стоит в разряде <b>" + PLACE[picked % 3] + "</b> класса <b>" + CLASS[Math.floor(picked / 3)] +
        "</b> и означает <b>" + num(+digit * Math.pow(10, picked)) + "</b>.";
    }
    s.addEventListener("click", function (e) {
      var b = e.target.closest("[data-pos]");
      if (b) { picked = +b.dataset.pos; draw(); }
    });
    draw();
  };

  // Сравнение натуральных и десятичных чисел: поразрядно слева направо
  W["compare"] = function (root, o) {
    var dec = "decimal" in o;
    var a = o.a || (dec ? "3,47" : "52 381"), b = o.b || (dec ? "3,5" : "52 318");
    var c = controls(root), s = stage(root), n = note(root);
    var clean = function (v) {
      v = v.replace(/\s/g, "").replace(".", ",");
      return dec ? v.replace(/[^\d,]/g, "").replace(/,(?=.*,)/g, "") : v.replace(/\D/g, "");
    };
    c.appendChild(field("Первое число", a, function (v) { a = v; draw(); }, { inputMode: dec ? "decimal" : "numeric" }));
    c.appendChild(field("Второе число", b, function (v) { b = v; draw(); }, { inputMode: dec ? "decimal" : "numeric" }));
    function split(v) {
      var p = clean(v).split(",");
      return { i: (p[0] || "0").replace(/^0+(?=\d)/, ""), f: p[1] || "" };
    }
    function draw() {
      var x = split(a), y = split(b);
      if (!clean(a) || !clean(b)) { s.innerHTML = ""; n.textContent = "Введи оба числа."; return; }
      var il = Math.max(x.i.length, y.i.length), fl = Math.max(x.f.length, y.f.length);
      var rowX = [], rowY = [], diff = -1, sign = "=", reason = "";
      if (x.i.length !== y.i.length) {
        sign = x.i.length > y.i.length ? ">" : "<";
        reason = dec ? "Целые части: у " + (sign === ">" ? "первого" : "второго") + " числа больше цифр."
                     : "У " + (sign === ">" ? "первого" : "второго") + " числа больше цифр — оно больше.";
      }
      var fx = x.f + "0".repeat(fl - x.f.length), fy = y.f + "0".repeat(fl - y.f.length);
      var sx = " ".repeat(il - x.i.length) + x.i + fx, sy = " ".repeat(il - y.i.length) + y.i + fy;
      if (sign === "=") {
        for (var k = 0; k < sx.length; k++) {
          if (sx[k] !== sy[k]) { diff = k; sign = sx[k] > sy[k] ? ">" : "<"; break; }
        }
        if (diff >= 0) {
          var INT = ["единиц", "десятков", "сотен", "единиц тысяч", "десятков тысяч", "сотен тысяч", "единиц миллионов", "десятков миллионов", "сотен миллионов"];
          var FR = ["десятых", "сотых", "тысячных", "десятитысячных", "стотысячных"];
          var place = diff < il ? INT[il - 1 - diff] : FR[diff - il];
          reason = "Первая отличающаяся цифра — в разряде " + (place || "") + ": " + sx[diff] + " " + sign + " " + sy[diff] + ".";
        } else reason = "Все цифры совпадают — числа равны.";
      }
      function row(str, own) {
        var out = "";
        for (var k = 0; k < str.length; k++) {
          if (dec && k === il) out += '<span class="tc-cmp-comma">,</span>';
          var ch = str[k], padded = k >= il && (k - il) >= own;
          out += '<span class="tc-cmp-d' + (k === diff ? " is-diff" : "") + (ch === " " ? " is-empty" : "") + (padded ? " is-pad" : "") + '">' + (ch === " " ? "" : ch) + "</span>";
        }
        return out;
      }
      s.innerHTML = '<div class="tc-cmp"><div class="tc-cmp-row">' + row(sx, x.f.length) + '</div><div class="tc-cmp-sign">' + sign +
        '</div><div class="tc-cmp-row">' + row(sy, y.f.length) + "</div></div>";
      n.innerHTML = (dec && fl && (x.f.length !== y.f.length) ? "Дописали нули в конце, чтобы после запятой было поровну цифр. " : "") + reason;
      bump(s.querySelector(".tc-cmp-sign"));
    }
    draw();
  };

  W["round"] = function (root, o) {
    var value = +(o.value || 4638), step = +(o.step || 100);
    var c = controls(root), s = stage(root), n = note(root);
    c.appendChild(field("Число", String(value), function (v) { value = +v.replace(/\D/g, "") || 0; draw(); }));
    c.appendChild(select("Округлить до", [[10, "десятков"], [100, "сотен"], [1000, "тысяч"]], step, function (v) { step = +v; draw(); }));
    function draw() {
      var low = Math.floor(value / step) * step, high = low + step;
      var check = Math.floor(value / (step / 10)) % 10, up = check >= 5, res = up ? high : low;
      var pos = (value - low) / step * 100;
      var ticks = "";
      for (var i = 0; i <= 10; i++) ticks += '<i style="left:' + i * 10 + '%"' + (i === 5 ? ' class="is-mid"' : "") + "></i>";
      s.innerHTML = '<div class="tc-line">' + ticks +
        '<span class="tc-line-end' + (!up ? " is-target" : "") + '" style="left:0">' + num(low) + "</span>" +
        '<span class="tc-line-end' + (up ? " is-target" : "") + '" style="left:100%">' + num(high) + "</span>" +
        '<span class="tc-line-mark ' + (up ? "is-up" : "is-down") + '" style="left:' + pos + '%"><b>' + num(value) + "</b></span></div>";
      var digits = String(value), place = { 10: "единиц", 100: "десятков", 1000: "сотен" }[step];
      n.innerHTML = "Смотрим на цифру разряда " + place + ": <b>" + check + "</b>. " +
        (up ? check + " ≥ 5 — увеличиваем" : check + " < 5 — оставляем") + ": <b>" + num(value) + " ≈ " + num(res) + "</b>" +
        (digits.length < String(step).length ? "" : "");
    }
    draw();
  };

  // ---------- 2. Столбик (натуральные и десятичные) ----------
  W["column"] = function (root, o) {
    var dec = "decimal" in o, op = o.op || "+";
    var a = o.a || (dec ? "12,75" : "4587"), b = o.b || (dec ? "3,6" : "2765");
    var shown = 0, steps = [];
    var c = controls(root), s = stage(root), n = note(root);
    c.appendChild(field("Первое число", a, function (v) { a = v; reset(); }, { inputMode: dec ? "decimal" : "numeric" }));
    c.appendChild(select("Действие", [["+", "сложение"], ["-", "вычитание"]], op, function (v) { op = v; reset(); }));
    c.appendChild(field("Второе число", b, function (v) { b = v; reset(); }, { inputMode: dec ? "decimal" : "numeric" }));
    var actions = h("div", "tc-actions");
    var next = button("Следующий разряд →", "tc-btn-main", function () { if (shown < steps.length) { shown++; draw(); } });
    actions.appendChild(next);
    actions.appendChild(button("Заново", "", function () { shown = 0; draw(); }));
    actions.appendChild(button("Ответ сразу", "", function () { shown = steps.length; draw(); }));
    root.insertBefore(actions, n);

    function parse(v) {
      v = v.replace(/\s/g, "").replace(".", ",");
      if (!/^\d+(,\d+)?$/.test(v)) return null;
      var p = v.split(",");
      return { i: p[0].replace(/^0+(?=\d)/, ""), f: dec ? (p[1] || "") : "" };
    }
    var model = null;
    function reset() { shown = 0; build(); draw(); }
    function build() {
      model = null; steps = [];
      var x = parse(a), y = parse(b);
      if (!x || !y) return;
      if (!dec && (x.f || y.f)) return;
      var fl = Math.max(x.f.length, y.f.length);
      var X = x.i + x.f + "0".repeat(fl - x.f.length), Y = y.i + y.f + "0".repeat(fl - y.f.length);
      var big = BigInt(X), small = BigInt(Y);
      if (op === "-" && big < small) { model = { error: "Уменьшаемое меньше вычитаемого — в 5 классе так не вычитают. Поменяй числа местами." }; return; }
      var res = op === "+" ? big + small : big - small;
      var R = res.toString(), width = Math.max(X.length, Y.length, R.length);
      var pa = X.padStart(width, " "), pb = Y.padStart(width, " "), pr = R.padStart(width, " ");
      var carry = 0, marks = new Array(width).fill("");
      for (var k = width - 1; k >= 0; k--) {
        var da = pa[k] === " " ? 0 : +pa[k], db = pb[k] === " " ? 0 : +pb[k], text;
        if (pa[k] === " " && pb[k] === " " && !carry) break;
        if (op === "+") {
          var sum = da + db + carry;
          text = da + " + " + db + (carry ? " + 1" : "") + " = " + sum + (sum > 9 ? " — пишем " + (sum % 10) + ", 1 в уме" : " — пишем " + sum);
          carry = sum > 9 ? 1 : 0;
          if (carry && k > 0) marks[k - 1] = "1";
        } else {
          var top = da - carry;
          if (top < db) {
            text = (carry ? da + " − 1 = " + top + "; " : "") + top + " − " + db + " нельзя — занимаем 1 у соседа: " + (top + 10) + " − " + db + " = " + (top + 10 - db);
            carry = 1;
            if (k > 0) marks[k - 1] = "•";
          } else {
            text = (carry ? da + " − 1 = " + top + "; " : "") + top + " − " + db + " = " + (top - db);
            carry = 0;
          }
        }
        steps.push({ col: k, text: text });
      }
      model = { pa: pa, pb: pb, pr: pr, width: width, fl: fl, marks: marks };
    }
    function draw() {
      if (!model) { s.innerHTML = ""; n.textContent = dec ? "Введи два числа, например 12,75 и 3,6." : "Введи два натуральных числа."; next.disabled = true; return; }
      if (model.error) { s.innerHTML = ""; n.textContent = model.error; next.disabled = true; return; }
      var done = {}, current = shown ? steps[shown - 1].col : -1;
      steps.slice(0, shown).forEach(function (st) { done[st.col] = true; });
      var allDone = shown === steps.length;
      function cells(str, kind) {
        var out = "";
        for (var k = 0; k < model.width; k++) {
          if (dec && model.fl && k === model.width - model.fl) out += '<span class="tc-col-comma">,</span>';
          var ch = str[k];
          if (kind === "r") ch = done[k] || (allDone && ch !== " ") ? ch : " ";
          if (kind === "m") ch = done[k + 1] && model.marks[k] ? model.marks[k] : " ";
          var pad = dec && kind !== "m" && kind !== "r" && k >= model.width - model.fl && ch === "0" && isPad(str, k, kind);
          out += '<span class="tc-col-d' + (k === current ? " is-current" : "") + (pad ? " is-pad" : "") + '">' + (ch === " " ? "" : ch) + "</span>";
        }
        return out;
      }
      s.innerHTML = '<div class="tc-col">' +
        '<div class="tc-col-row tc-col-marks"><span class="tc-col-op"></span>' + cells("", "m") + "</div>" +
        '<div class="tc-col-row"><span class="tc-col-op"></span>' + cells(model.pa, "a") + "</div>" +
        '<div class="tc-col-row"><span class="tc-col-op">' + (op === "+" ? "+" : "−") + "</span>" + cells(model.pb, "b") + "</div>" +
        '<div class="tc-col-row tc-col-result"><span class="tc-col-op"></span>' + cells(model.pr, "r") + "</div></div>";
      next.disabled = allDone;
      if (!shown) n.innerHTML = dec ? "Запятая стоит под запятой. Недостающие знаки после запятой заменяем нулями. Нажми «Следующий разряд»." : "Пишем разряд под разрядом и считаем справа налево. Нажми «Следующий разряд».";
      else n.innerHTML = allDone ? "Готово! Ответ: <b>" + answer() + "</b>" : steps[shown - 1].text;
    }
    function isPad(str, k, kind) {
      var src = parse(kind === "a" ? a : b);
      return src && (k - (model.width - model.fl)) >= src.f.length;
    }
    function answer() {
      var r = model.pr.trim();
      if (dec && model.fl) { r = r.padStart(model.fl + 1, "0"); r = r.slice(0, -model.fl) + "," + r.slice(-model.fl); r = r.replace(/,?0+$/, ""); }
      return r;
    }
    reset();
  };

  W["swap"] = function (root, o) {
    var a = +(o.a || 3), b = +(o.b || 5), swapped = false;
    var c = controls(root), s = stage(root), n = note(root);
    c.appendChild(slider("Первое слагаемое", 1, 9, a, function (v) { a = v; draw(); }));
    c.appendChild(slider("Второе слагаемое", 1, 9, b, function (v) { b = v; draw(); }));
    var act = h("div", "tc-actions");
    act.appendChild(button("Поменять местами ⇄", "tc-btn-main", function () { swapped = !swapped; draw(true); }));
    root.insertBefore(act, n);
    function dots(k, cls) { var out = ""; for (var i = 0; i < k; i++) out += '<i class="' + cls + '" style="--n:' + i + '"></i>'; return out; }
    function draw(anim) {
      var first = swapped ? [b, "is-gold"] : [a, "is-violet"], second = swapped ? [a, "is-violet"] : [b, "is-gold"];
      s.innerHTML = '<div class="tc-dots' + (anim ? " is-swapping" : "") + '"><span class="tc-dot-group">' + dots(first[0], first[1]) +
        '</span><b>+</b><span class="tc-dot-group">' + dots(second[0], second[1]) + "</span><b>=</b><span class=\"tc-dot-sum\">" + (a + b) + "</span></div>";
      n.innerHTML = "<b>" + first[0] + " + " + second[0] + " = " + (a + b) + "</b>. Сумма та же: от перестановки слагаемых она не меняется.";
    }
    draw();
  };

  // Весы: x + a = c → убираем a с обеих чаш
  W["balance"] = function (root, o) {
    var a = +(o.a || 15), c0 = +(o.c || 42), stepN = 0;
    var s = stage(root), n = note(root);
    var act = h("div", "tc-actions");
    var go = button("", "tc-btn-main", function () { stepN = Math.min(stepN + 1, 2); draw(); });
    act.appendChild(go);
    act.appendChild(button("Новый пример", "", function () {
      a = 5 + Math.floor(Math.random() * 40); c0 = a + 5 + Math.floor(Math.random() * 50); stepN = 0; draw();
    }));
    root.insertBefore(act, n);
    function weight(t, cls) { return '<span class="tc-weight ' + (cls || "") + '">' + t + "</span>"; }
    function draw() {
      var left = stepN === 0 ? weight("x", "is-x") + weight(a) : stepN === 1 ? weight("x", "is-x") + weight(a, "is-leaving") : weight("x", "is-x");
      var right = stepN === 0 ? weight(c0) : stepN === 1 ? weight(c0) + weight("−" + a, "is-leaving") : weight(c0 - a, "is-new");
      s.innerHTML = '<div class="tc-balance"><div class="tc-pan">' + left + '</div><div class="tc-pan">' + right + '</div><div class="tc-beam"></div><div class="tc-stand"></div></div>';
      go.textContent = stepN === 0 ? "Убрать " + a + " с обеих чаш" : stepN === 1 ? "Посчитать" : "Готово ✓";
      go.disabled = stepN === 2;
      n.innerHTML = stepN === 0 ? "Уравнение <b>x + " + a + " = " + c0 + "</b>. Весы в равновесии. Что будет, если с обеих чаш снять по " + a + "?"
        : stepN === 1 ? "Снимаем одинаковый груз с обеих чаш — равновесие сохраняется: <b>x = " + c0 + " − " + a + "</b>"
        : "Неизвестное слагаемое = сумма − известное слагаемое: <b>x = " + (c0 - a) + "</b>. Проверка: " + (c0 - a) + " + " + a + " = " + c0 + " ✓";
    }
    draw();
  };

  // ---------- 3. Деление с остатком ----------
  W["remainder"] = function (root, o) {
    var a = +(o.a || 23), d = +(o.d || 5);
    var c = controls(root), s = stage(root), n = note(root);
    c.appendChild(slider("Конфет (делимое)", 1, 40, a, function (v) { a = v; draw(); }));
    c.appendChild(slider("Детей (делитель)", 2, 9, d, function (v) { d = v; draw(); }));
    function draw() {
      var q = Math.floor(a / d), r = a % d, html = '<div class="tc-boxes">';
      for (var i = 0; i < d; i++) {
        html += '<div class="tc-box"><small>' + (i + 1) + "</small>";
        for (var j = 0; j < q; j++) html += '<i style="--n:' + (j * d + i) + '"></i>';
        html += "</div>";
      }
      html += '</div><div class="tc-rest"><small>Остаток</small>';
      for (var k = 0; k < r; k++) html += '<i class="is-rest" style="--n:' + (q * d + k) + '"></i>';
      if (!r) html += "<span>нет</span>";
      html += "</div>";
      s.innerHTML = html;
      n.innerHTML = "<b>" + a + " : " + d + " = " + q + (r ? " (ост. " + r + ")" : "") + "</b>. Проверка: " + d + " × " + q + " + " + r + " = " + a +
        ". Остаток " + r + " &lt; " + d + " — всегда меньше делителя.";
    }
    draw();
  };

  // ---------- 4. Дроби ----------
  function pieSvg(den, filled, size) {
    size = size || 110;
    var r = size / 2 - 4, cx = size / 2, cy = size / 2, out = '<svg class="tc-pie" viewBox="0 0 ' + size + " " + size + '" width="' + size + '" height="' + size + '" aria-hidden="true">';
    if (den === 1) return out + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" class="' + (filled ? "is-on" : "") + '"/></svg>';
    for (var i = 0; i < den; i++) {
      var a0 = (i / den) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 1) / den) * 2 * Math.PI - Math.PI / 2;
      var x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      var large = a1 - a0 > Math.PI ? 1 : 0;
      out += '<path class="' + (i < filled ? "is-on" : "") + '" style="--n:' + i + '" d="M' + cx + " " + cy + " L" + x0.toFixed(2) + " " + y0.toFixed(2) +
        " A" + r + " " + r + " 0 " + large + " 1 " + x1.toFixed(2) + " " + y1.toFixed(2) + ' Z"/>';
    }
    return out + "</svg>";
  }
  function bar(den, filled, cls, extra) {
    var out = '<div class="tc-bar' + (cls ? " " + cls : "") + '" style="--den:' + den + '">';
    for (var i = 0; i < den; i++) {
      var k = extra ? extra(i) : (i < filled ? "is-on" : "");
      out += '<i class="' + k + '" style="--n:' + i + '"></i>';
    }
    return out + "</div>";
  }

  W["fraction"] = function (root, o) {
    var classify = "classify" in o, maxNum = classify ? 16 : 12;
    var m = +(o.num || 3), d = +(o.den || 8);
    var c = controls(root), s = stage(root), n = note(root);
    var mSl = slider("Числитель — сколько частей взяли", 0, maxNum, m, function (v) { m = v; draw(); });
    var dSl = slider("Знаменатель — на сколько частей делим", 1, 12, d, function (v) {
      d = v;
      if (!classify && m > d) { m = d; mSl.set(m); }
      draw();
    });
    c.appendChild(mSl); c.appendChild(dSl);
    if (!classify) mSl.input.addEventListener("input", function () { if (m > d) { m = d; mSl.set(m); draw(); } });
    function draw() {
      var wholes = Math.max(1, Math.ceil(m / d)), html = '<div class="tc-frac-view"><div class="tc-frac-big">' + frac(m, d) + '</div><div class="tc-pies">';
      for (var i = 0; i < wholes; i++) html += pieSvg(d, Math.min(Math.max(m - i * d, 0), d));
      html += "</div></div>";
      s.innerHTML = html;
      var text = "Целое разделили на <b>" + d + "</b> " + plural(d, "равную часть", "равные части", "равных частей") + " и взяли <b>" + m + "</b>.";
      if (classify) {
        text += m < d ? " Числитель меньше знаменателя — дробь <b>правильная</b>, она меньше 1."
          : m === d ? " Числитель равен знаменателю — дробь <b>неправильная</b> и равна 1."
          : " Числитель больше знаменателя — дробь <b>неправильная</b>, она больше 1" + (m % d === 0 ? " и равна " + m / d : ": " + Math.floor(m / d) + " цел. и " + (m % d) + "/" + d) + ".";
      }
      n.innerHTML = text;
      bump(s.querySelector(".tc-frac-big"));
    }
    draw();
  };

  W["frac-compare"] = function (root, o) {
    var a = +(o.a || 3), b = +(o.b || 4), x = +(o.x || 2), y = +(o.y || 3);
    var c = controls(root), s = stage(root), n = note(root);
    var g1 = h("div", "tc-ctl-group"), g2 = h("div", "tc-ctl-group");
    g1.innerHTML = "<p>Первая дробь</p>"; g2.innerHTML = "<p>Вторая дробь</p>";
    var sa = slider("Числитель", 1, 12, a, function (v) { a = v; fix(); });
    var sb = slider("Знаменатель", 2, 12, b, function (v) { b = v; fix(); });
    var sx = slider("Числитель", 1, 12, x, function (v) { x = v; fix(); });
    var sy = slider("Знаменатель", 2, 12, y, function (v) { y = v; fix(); });
    g1.appendChild(sa); g1.appendChild(sb); g2.appendChild(sx); g2.appendChild(sy);
    c.appendChild(g1); c.appendChild(g2);
    function fix() { if (a > b) { a = b; sa.set(a); } if (x > y) { x = y; sx.set(x); } draw(); }
    function draw() {
      var l = a * y, r = x * b, sign = l > r ? ">" : l < r ? "<" : "=";
      s.innerHTML = '<div class="tc-frac-cmp"><div>' + frac(a, b) + bar(b, a) + '</div><b class="tc-cmp-sign">' + sign + "</b><div>" + frac(x, y) + bar(y, x, "is-gold") + "</div></div>";
      if (b === y) n.innerHTML = "Знаменатели равны — сравниваем числители: " + a + " " + sign + " " + x + ".";
      else {
        var k = lcm(b, y);
        n.innerHTML = "Общий знаменатель — " + k + ": " + frac(a, b) + " = " + frac(a * k / b, k) + ", " + frac(x, y) + " = " + frac(x * k / y, k) +
          ". Сравниваем числители: " + a * k / b + " " + sign + " " + x * k / y + ".";
      }
      bump(s.querySelector(".tc-cmp-sign"));
    }
    draw();
  };

  W["frac-add"] = function (root, o) {
    var minus = o.op === "-", d = +(o.den || 8), a = +(o.a || (minus ? 6 : 3)), b = +(o.b || (minus ? 2 : 4));
    var c = controls(root), s = stage(root), n = note(root);
    var sd = slider("Знаменатель", 2, 12, d, function (v) { d = v; fix(); });
    var sa = slider(minus ? "Уменьшаемое (числитель)" : "Первое слагаемое (числитель)", 1, 12, a, function (v) { a = v; fix(); });
    var sb = slider(minus ? "Вычитаемое (числитель)" : "Второе слагаемое (числитель)", 1, 12, b, function (v) { b = v; fix(); });
    c.appendChild(sd); c.appendChild(sa); c.appendChild(sb);
    function fix() {
      if (a > d) { a = d; sa.set(a); }
      if (minus ? b > a : a + b > d) { b = minus ? a : d - a; if (b < 1) { b = 1; a = minus ? Math.max(a, 1) : d - 1; sa.set(a); } sb.set(b); }
      draw();
    }
    function draw() {
      var res = minus ? a - b : a + b, g = gcd(res, d);
      var view = minus
        ? bar(d, 0, "", function (i) { return i < a - b ? "is-on" : i < a ? "is-out" : ""; })
        : bar(d, 0, "", function (i) { return i < a ? "is-on" : i < a + b ? "is-gold-on" : ""; });
      s.innerHTML = '<div class="tc-frac-sum"><div class="tc-frac-eq">' + frac(a, d) + "<b>" + (minus ? "−" : "+") + "</b>" + frac(b, d) + "<b>=</b>" + frac(res, d) + "</div>" + view + "</div>";
      n.innerHTML = "Знаменатель не меняется — " + (minus ? "вычитаем" : "складываем") + " числители: " + a + (minus ? " − " : " + ") + b + " = " + res + "." +
        (g > 1 && res ? " Дробь можно сократить на " + g + ": " + frac(res, d) + " = " + frac(res / g, d / g) + "." : "") +
        (res === d ? " Получилось целое: " + frac(d, d) + " = 1." : "");
    }
    fix();
  };

  // ---------- 5. Десятичные дроби ----------
  W["decimal-grid"] = function (root, o) {
    var v = +(o.value || 37);
    var c = controls(root), s = stage(root), n = note(root);
    c.appendChild(slider("Закрашено клеток из 100", 0, 100, v, function (x) { v = x; draw(); }));
    var grid = h("div", "tc-hundred");
    for (var i = 0; i < 100; i++) grid.appendChild(h("i"));
    var big = h("div", "tc-dec-big");
    var wrap = h("div", "tc-dec-view"); wrap.appendChild(grid); wrap.appendChild(big); s.appendChild(wrap);
    function draw() {
      var tenths = Math.floor(v / 10), hund = v % 10;
      Array.prototype.forEach.call(grid.children, function (cell, i) {
        var col = i % 10, row = Math.floor(i / 10), idx = col * 10 + row; // закрашиваем по столбцам: столбец = десятая
        cell.className = idx < tenths * 10 ? "is-tenth" : idx < v ? "is-hundredth" : "";
      });
      var str = v === 100 ? "1" : v === 0 ? "0" : "0," + String(v).padStart(2, "0").replace(/0$/, "");
      big.innerHTML = "<b>" + str + "</b>" + (v && v < 100 ? "<small>= " + frac(v, 100) + "</small>" : "");
      n.innerHTML = v === 100 ? "Закрашен весь квадрат — это одно целое: <b>1</b>." :
        "<span class=\"tc-key is-tenth\"></span>Столбец — одна десятая (" + frac(1, 10) + "), <span class=\"tc-key is-hundredth\"></span>клетка — одна сотая (" + frac(1, 100) + "). " +
        "Здесь " + tenths + " " + plural(tenths, "десятая", "десятых", "десятых") + " и " + hund + " " + plural(hund, "сотая", "сотых", "сотых") + ".";
    }
    draw();
  };

  // ---------- 6. Текстовые задачи: движение навстречу ----------
  W["motion"] = function (root, o) {
    var v1 = +(o.v1 || 60), v2 = +(o.v2 || 40), t = +(o.t || 3);
    var c = controls(root), s = stage(root), n = note(root);
    c.appendChild(slider("Скорость машины", 10, 90, v1, function (x) { v1 = x; draw(); }, " км/ч"));
    c.appendChild(slider("Скорость автобуса", 10, 90, v2, function (x) { v2 = x; draw(); }, " км/ч"));
    c.appendChild(slider("Время до встречи", 1, 5, t, function (x) { t = x; draw(); }, " ч"));
    var act = h("div", "tc-actions");
    act.appendChild(button("▶ Поехали", "tc-btn-main", function () { run(); }));
    root.insertBefore(act, n);
    s.innerHTML = '<div class="tc-road"><span class="tc-car is-a" aria-hidden="true">🚗</span><span class="tc-car is-b" aria-hidden="true">🚌</span>' +
      '<span class="tc-road-meet"></span><div class="tc-road-labels"><span class="is-a"></span><span class="is-b"></span></div><span class="tc-road-total"></span></div>';
    var carA = s.querySelector(".tc-car.is-a"), carB = s.querySelector(".tc-car.is-b"), meet = s.querySelector(".tc-road-meet");
    var la = s.querySelector(".tc-road-labels .is-a"), lb = s.querySelector(".tc-road-labels .is-b"), total = s.querySelector(".tc-road-total");
    var raf;
    function place(k) {
      var share = v1 / (v1 + v2) * 100;
      carA.style.left = share * k + "%";
      carB.style.left = 100 - (100 - share) * k + "%";
    }
    function draw() {
      cancelAnimationFrame(raf);
      var S = (v1 + v2) * t, share = v1 / (v1 + v2) * 100;
      meet.style.left = share + "%";
      la.style.width = share + "%"; lb.style.width = 100 - share + "%";
      la.textContent = v1 + " × " + t + " = " + v1 * t + " км";
      lb.textContent = v2 + " × " + t + " = " + v2 * t + " км";
      total.textContent = "Всё расстояние: " + num(S) + " км";
      place(0);
      n.innerHTML = "Путь = скорость × время. Навстречу друг другу расстояние сокращается на " + v1 + " + " + v2 + " = <b>" + (v1 + v2) + " км/ч</b> (скорость сближения). " +
        "За " + t + " ч: S = " + (v1 + v2) + " × " + t + " = <b>" + num(S) + " км</b>.";
    }
    function run() {
      cancelAnimationFrame(raf);
      if (reduce) { place(1); return; }
      var start = null;
      raf = requestAnimationFrame(function step(ts) {
        if (!start) start = ts;
        var k = Math.min((ts - start) / 2200, 1);
        place(k);
        if (k < 1) raf = requestAnimationFrame(step);
      });
    }
    draw();
  };

  // ---------- 7. Геометрия ----------
  W["angle"] = function (root, o) {
    var a = +(o.value || 60);
    var c = controls(root), s = stage(root), n = note(root);
    c.appendChild(slider("Градусная мера угла", 1, 180, a, function (v) { a = v; draw(); }, "°"));
    function draw() {
      var rad = a * Math.PI / 180, cx = 120, cy = 120, L = 100, r = 34;
      var x = cx + L * Math.cos(rad), y = cy - L * Math.sin(rad);
      var ax = cx + r * Math.cos(rad), ay = cy - r * Math.sin(rad);
      var kind = a < 90 ? ["острый", "is-acute", "меньше 90°"] : a === 90 ? ["прямой", "is-right", "ровно 90°"] : a < 180 ? ["тупой", "is-obtuse", "больше 90°, но меньше 180°"] : ["развёрнутый", "is-straight", "180° — стороны на одной прямой"];
      var arc = a === 90 ? '<path class="tc-ang-arc" d="M' + (cx + 18) + " " + cy + " V" + (cy - 18) + " H" + cx + '"/>'
        : '<path class="tc-ang-arc" d="M' + (cx + r) + " " + cy + " A" + r + " " + r + " 0 0 0 " + ax.toFixed(1) + " " + ay.toFixed(1) + '"/>';
      s.innerHTML = '<div class="tc-angle ' + kind[1] + '"><svg viewBox="0 0 240 140" role="img" aria-label="Угол ' + a + ' градусов">' +
        '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + L) + '" y2="' + cy + '"/><line x1="' + cx + '" y1="' + cy + '" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '"/>' +
        arc + '<circle cx="' + cx + '" cy="' + cy + '" r="4"/></svg><div class="tc-angle-label"><b>' + a + "°</b><span>" + kind[0] + "</span></div></div>";
      n.innerHTML = "Угол <b>" + kind[0] + "</b>: " + kind[2] + ".";
    }
    draw();
  };

  W["triangle"] = function (root, o) {
    var A = +(o.a || 60), B = +(o.b || 70);
    var c = controls(root), s = stage(root), n = note(root);
    var sa = slider("Угол A", 10, 150, A, function (v) { A = v; fix("a"); }, "°");
    var sb = slider("Угол B", 10, 150, B, function (v) { B = v; fix("b"); }, "°");
    c.appendChild(sa); c.appendChild(sb);
    function fix(who) {
      if (A + B > 170) { if (who === "a") { B = 170 - A; sb.set(B); } else { A = 170 - B; sa.set(A); } }
      draw();
    }
    function draw() {
      var C = 180 - A - B, ra = A * Math.PI / 180, rb = B * Math.PI / 180, rc = C * Math.PI / 180;
      var side = Math.sin(rb) / Math.sin(rc); // сторона AC при AB = 1
      var px = side * Math.cos(ra), py = side * Math.sin(ra);
      var minX = Math.min(0, px), maxX = Math.max(1, px), k = Math.min(220 / (maxX - minX), 120 / Math.max(py, .01));
      var X = function (v) { return 20 + (v - minX) * k; }, Y = function (v) { return 140 - v * k; };
      var pts = [[X(0), Y(0)], [X(1), Y(0)], [X(px), Y(py)]];
      var type = A === 90 || B === 90 || C === 90 ? "прямоугольный" : A > 90 || B > 90 || C > 90 ? "тупоугольный" : "остроугольный";
      var sides = A === B && B === C ? "Все углы равны — он ещё и <b>равносторонний</b>." : A === B || B === C || A === C ? "Два угла равны — он ещё и <b>равнобедренный</b>." : "";
      s.innerHTML = '<div class="tc-tri"><svg viewBox="0 0 260 160" role="img" aria-label="Треугольник с углами ' + A + ", " + B + " и " + C + ' градусов">' +
        '<polygon points="' + pts.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ") + '"/>' +
        '<text x="' + (pts[0][0] - 4) + '" y="' + (pts[0][1] + 16) + '" text-anchor="end">A ' + A + "°</text>" +
        '<text x="' + (pts[1][0] + 4) + '" y="' + (pts[1][1] + 16) + '">B ' + B + "°</text>" +
        '<text x="' + pts[2][0].toFixed(1) + '" y="' + (pts[2][1] - 8).toFixed(1) + '" text-anchor="middle" class="is-c">C ' + C + "°</text></svg>" +
        '<p class="tc-tri-sum"><span>' + A + "°</span> + <span>" + B + "°</span> + <span class=\"is-c\">" + C + "°</span> = <b>180°</b></p></div>";
      n.innerHTML = "Третий угол всегда дополняет сумму до 180°: C = 180° − " + A + "° − " + B + "° = <b>" + C + "°</b>. Треугольник <b>" + type + "</b>. " + sides;
    }
    draw();
  };

  W["perimeter"] = function (root, o) {
    var a = +(o.a || 6), b = +(o.b || 4), square = false;
    var c = controls(root), s = stage(root), n = note(root);
    var sa = slider("Длина a", 1, 12, a, function (v) { a = v; if (square) { b = a; sb.set(b); } draw(); }, " см");
    var sb = slider("Ширина b", 1, 12, b, function (v) { b = v; if (square) { a = b; sa.set(a); } draw(); }, " см");
    var sq = h("label", "tc-check", '<input type="checkbox"> Квадрат (все стороны равны)');
    sq.querySelector("input").addEventListener("change", function (e) { square = e.target.checked; if (square) { b = a; sb.set(b); } draw(); });
    c.appendChild(sa); c.appendChild(sb); c.appendChild(sq);
    function draw() {
      var k = Math.min(200 / a, 110 / b, 22), w = a * k, hh = b * k, x0 = (260 - w) / 2, y0 = (150 - hh) / 2;
      var path = "M" + x0 + " " + y0 + " h" + w + " v" + hh + " h" + (-w) + " Z";
      s.innerHTML = '<div class="tc-shape"><svg viewBox="0 0 260 150" role="img" aria-label="Прямоугольник ' + a + " на " + b + '">' +
        '<path class="tc-rect" d="' + path + '"/>' +
        (reduce ? "" : '<circle r="6" class="tc-ant"><animateMotion dur="5s" repeatCount="indefinite" path="' + path + '"/></circle>') +
        '<text x="' + (x0 + w / 2) + '" y="' + (y0 - 6) + '" text-anchor="middle">' + a + " см</text>" +
        '<text x="' + (x0 + w + 6) + '" y="' + (y0 + hh / 2 + 4) + '">' + b + " см</text></svg></div>";
      n.innerHTML = square ? "У квадрата 4 равные стороны: P = 4 × a = 4 × " + a + " = <b>" + 4 * a + " см</b>."
        : "Обходим все стороны: " + a + " + " + b + " + " + a + " + " + b + ". Короче: P = 2 × (a + b) = 2 × (" + a + " + " + b + ") = <b>" + 2 * (a + b) + " см</b>.";
    }
    draw();
  };

  // ---------- 8. Площади и объёмы ----------
  W["area"] = function (root, o) {
    var a = +(o.a || 5), b = +(o.b || 3);
    var c = controls(root), s = stage(root), n = note(root);
    c.appendChild(slider("Длина a", 1, 10, a, function (v) { a = v; draw(); }, " см"));
    c.appendChild(slider("Ширина b", 1, 10, b, function (v) { b = v; draw(); }, " см"));
    function draw() {
      var html = '<div class="tc-area" style="--a:' + a + ";--b:" + b + '">';
      for (var i = 0; i < a * b; i++) html += '<i style="--n:' + i + '"></i>';
      s.innerHTML = html + "</div>";
      n.innerHTML = "В ряду " + a + " " + plural(a, "квадратик", "квадратика", "квадратиков") + " по 1 см², рядов " + b + ". S = a × b = " + a + " × " + b + " = <b>" + a * b + " см²</b>" +
        (a === b ? " (квадрат: S = a × a)." : ".");
    }
    draw();
  };

  W["volume"] = function (root, o) {
    var a = +(o.a || 4), b = +(o.b || 3), cc = +(o.c || 2);
    var c = controls(root), s = stage(root), n = note(root);
    c.appendChild(slider("Длина a", 1, 5, a, function (v) { a = v; draw(); }, " см"));
    c.appendChild(slider("Ширина b", 1, 5, b, function (v) { b = v; draw(); }, " см"));
    c.appendChild(slider("Высота c", 1, 5, cc, function (v) { cc = v; draw(); }, " см"));
    function draw() {
      var u = 18, cos = Math.cos(Math.PI / 6) * u, sin = Math.sin(Math.PI / 6) * u;
      var P = function (x, y, z) { return [(x - y) * cos, (x + y) * sin - z * u]; };
      var cubes = [];
      for (var z = 0; z < cc; z++) for (var y = 0; y < b; y++) for (var x = 0; x < a; x++) cubes.push([x, y, z]);
      cubes.sort(function (p, q) { return (p[0] + p[1] + p[2]) - (q[0] + q[1] + q[2]) || p[2] - q[2]; });
      var polys = "", minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
      function poly(pts, cls, i) {
        pts.forEach(function (p) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); });
        return '<polygon class="' + cls + '" style="--n:' + i + '" points="' + pts.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ") + '"/>';
      }
      cubes.forEach(function (q, i) {
        var x = q[0], y = q[1], z = q[2];
        polys += '<g class="tc-cube" style="--n:' + (z * a * b + y * a + x) + '">' +
          poly([P(x, y, z + 1), P(x + 1, y, z + 1), P(x + 1, y + 1, z + 1), P(x, y + 1, z + 1)], "is-top", i) +
          poly([P(x + 1, y, z), P(x + 1, y + 1, z), P(x + 1, y + 1, z + 1), P(x + 1, y, z + 1)], "is-right", i) +
          poly([P(x, y + 1, z), P(x + 1, y + 1, z), P(x + 1, y + 1, z + 1), P(x, y + 1, z + 1)], "is-left", i) + "</g>";
      });
      var pad = 6;
      s.innerHTML = '<div class="tc-iso"><svg viewBox="' + (minX - pad) + " " + (minY - pad) + " " + (maxX - minX + 2 * pad) + " " + (maxY - minY + 2 * pad) +
        '" role="img" aria-label="Параллелепипед из ' + a * b * cc + ' кубиков">' + polys + "</svg></div>";
      n.innerHTML = "В одном слое " + a + " × " + b + " = " + a * b + " " + plural(a * b, "кубик", "кубика", "кубиков") + " по 1 см³, слоёв " + cc +
        ". V = a × b × c = " + a + " × " + b + " × " + cc + " = <b>" + a * b * cc + " см³</b>" + (a === b && b === cc ? " — это куб: V = a × a × a." : ".");
    }
    draw();
  };

  var UNITS = {
    length: { name: "Длина", list: [["мм", 1], ["см", 10], ["дм", 100], ["м", 1000], ["км", 1e6]] },
    area: { name: "Площадь", list: [["мм²", 1], ["см²", 100], ["дм²", 1e4], ["м²", 1e6], ["а (сотка)", 1e8], ["га", 1e10]] },
    volume: { name: "Объём", list: [["мм³", 1], ["см³", 1e3], ["дм³ (литр)", 1e6], ["м³", 1e9]] }
  };
  W["units"] = function (root, o) {
    var kind = o.kind || "length", value = o.value || "3", from = 3, to = 1;
    var c = controls(root), s = stage(root), n = note(root);
    var kindSel = select("Величина", Object.keys(UNITS).map(function (k) { return [k, UNITS[k].name]; }), kind, function (v) { kind = v; from = UNITS[kind].list.length - 1; to = 1; fill(); draw(); });
    var val = field("Значение", value, function (v) { value = v; draw(); }, { inputMode: "decimal" });
    var fromSel = select("Из", [], 0, function (v) { from = +v; draw(); });
    var toSel = select("В", [], 0, function (v) { to = +v; draw(); });
    [kindSel, val, fromSel, toSel].forEach(function (x) { c.appendChild(x); });
    function fill() {
      [[fromSel, from], [toSel, to]].forEach(function (pair) {
        var sel = pair[0].input;
        sel.innerHTML = "";
        UNITS[kind].list.forEach(function (u, i) { var opt = h("option", null, esc(u[0])); opt.value = i; if (i === pair[1]) opt.selected = true; sel.appendChild(opt); });
      });
    }
    function fmt(x) { return Number(x.toPrecision(12)).toLocaleString("ru-RU", { maximumFractionDigits: 6 }).replace(/ /g, " "); }
    function draw() {
      var x = parseFloat(String(value).replace(",", "."));
      var U = UNITS[kind].list, f = U[from], t = U[to];
      if (isNaN(x)) { s.innerHTML = ""; n.textContent = "Введи число."; return; }
      var ratio = f[1] / t[1], res = x * ratio;
      s.innerHTML = '<div class="tc-units"><span>' + fmt(x) + " " + esc(f[0]) + '</span><b>=</b><span class="is-res">' + fmt(res) + " " + esc(t[0]) + "</span></div>";
      if (from === to) n.textContent = "Единицы одинаковые — переводить нечего.";
      else if (ratio >= 1) n.innerHTML = "1 " + esc(f[0]) + " = " + fmt(ratio) + " " + esc(t[0]) + ". Переходим к более мелкой единице — <b>умножаем</b>: " + fmt(x) + " × " + fmt(ratio) + " = " + fmt(res) + ".";
      else n.innerHTML = "1 " + esc(t[0]) + " = " + fmt(1 / ratio) + " " + esc(f[0]) + ". Переходим к более крупной единице — <b>делим</b>: " + fmt(x) + " : " + fmt(1 / ratio) + " = " + fmt(res) + ".";
    }
    fill(); draw();
  };

  function plural(k, one, few, many) {
    var m10 = k % 10, m100 = k % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  // ---------- Запуск моделей ----------
  deck.querySelectorAll("[data-widget]").forEach(function (root) {
    var fn = W[root.dataset.widget];
    if (fn) { root.classList.add("tc-widget"); fn(root, Object.assign({}, root.dataset)); }
  });

  // ---------- Шаги решения: открываются по одному ----------
  deck.querySelectorAll(".tc-steps").forEach(function (list) {
    var items = list.querySelectorAll("li"), shown = 1;
    var bar = h("div", "tc-actions");
    var next = button("Следующий шаг →", "tc-btn-main", function () { shown++; sync(true); });
    var again = button("Сначала", "", function () { shown = 1; sync(); });
    bar.appendChild(next); bar.appendChild(again);
    list.after(bar);
    function sync(focus) {
      items.forEach(function (li, i) { li.hidden = i >= shown; li.classList.toggle("is-last", i === shown - 1); });
      next.disabled = shown >= items.length;
      next.textContent = shown >= items.length ? "Готово ✓" : "Следующий шаг →";
      again.hidden = shown === 1;
      if (focus) items[shown - 1].setAttribute("tabindex", "-1");
    }
    sync();
  });

  // ---------- Карточки-перевёртыши ----------
  deck.addEventListener("click", function (e) {
    var card = e.target.closest(".tc-flip");
    if (card) {
      var on = card.classList.toggle("is-flipped");
      card.setAttribute("aria-pressed", String(on));
    }
  });

  // ---------- Мини-проверка ----------
  deck.querySelectorAll(".tc-quiz").forEach(function (quiz) {
    var answer = quiz.dataset.answer, noteEl = quiz.querySelector(".tc-quiz-note");
    quiz.addEventListener("click", function (e) {
      var opt = e.target.closest(".tc-quiz-opt");
      if (!opt || quiz.classList.contains("is-done")) return;
      var ok = opt.dataset.value === answer;
      opt.classList.add(ok ? "is-correct" : "is-wrong");
      if (ok) {
        quiz.classList.add("is-done");
        quiz.querySelectorAll(".tc-quiz-opt").forEach(function (b) { b.disabled = true; });
      }
      if (noteEl) {
        noteEl.hidden = false;
        noteEl.className = "tc-quiz-note " + (ok ? "is-correct" : "is-wrong");
        noteEl.innerHTML = ok ? "Верно! " + (quiz.dataset.explain || "") : "Не совсем. Подумай ещё — " + (quiz.dataset.hint || "попробуй другой вариант.");
      }
    });
  });

  // ---------- Подсветка «что известно / что найти» в задаче ----------
  deck.querySelectorAll("[data-highlight]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var box = btn.closest(".tc-problem"), kind = btn.dataset.highlight;
      var on = box.classList.toggle("show-" + kind);
      btn.setAttribute("aria-pressed", String(on));
    });
  });
})();
