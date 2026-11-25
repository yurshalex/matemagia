// Подробности о достижении или ранге по клику
(function () {
  var modal = document.getElementById("achievement-modal");
  if (!modal) return;
  var icon = document.getElementById("modal-icon");
  document.querySelectorAll(".achievement-card, .rank-card").forEach(function (card, i) {
    card.style.setProperty("--i", i);
    card.addEventListener("click", function () {
      var d = card.dataset;
      var unlocked = card.classList.contains("unlocked") || card.classList.contains("is-current");
      document.getElementById("modal-title").textContent = d.title;
      document.getElementById("modal-condition").textContent = d.condition;
      var status = document.getElementById("modal-status");
      status.textContent = d.status;
      status.className = "status " + (unlocked ? "status-done" : "status-new");
      document.getElementById("modal-reward").textContent = d.reward ? "Награда: " + d.reward : "";
      icon.textContent = d.icon;
      icon.className = unlocked ? "hex hex-gold" : "hex";
      modal.showModal();
    });
  });
  modal.addEventListener("click", function (e) { if (e.target === modal) modal.close(); });
})();
