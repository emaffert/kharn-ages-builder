/* Bascule de thème pour les maquettes : câble le sélecteur .mode-toggle et
   persiste le choix. Défaut = sombre. (Uniquement pour les maquettes.) */
(function () {
  var KEY = "ka-mock-theme";
  function apply(theme) {
    document.documentElement.dataset.theme = theme;
    document.querySelectorAll(".mode-toggle").forEach(function (tg) {
      tg.querySelectorAll("button").forEach(function (b) {
        var isLight = b.textContent.trim().toLowerCase().indexOf("clair") === 0;
        b.classList.toggle("on", isLight === (theme === "light"));
      });
    });
  }
  document.querySelectorAll(".mode-toggle button").forEach(function (b) {
    b.addEventListener("click", function () {
      var theme = b.textContent.trim().toLowerCase().indexOf("clair") === 0 ? "light" : "dark";
      localStorage.setItem(KEY, theme);
      apply(theme);
    });
  });
  var forced = new URLSearchParams(location.search).get("theme");
  var initial = forced || localStorage.getItem(KEY);
  apply(initial === "light" ? "light" : "dark");
})();
