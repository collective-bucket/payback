(function () {
  "use strict";

  var nav = document.querySelector(".nav");
  var toggle = document.querySelector(".nav-toggle");
  if (!nav || !toggle) return;

  function closeMenu() {
    nav.classList.remove("nav-menu-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Menüyü aç");
  }

  toggle.addEventListener("click", function () {
    var isOpen = nav.classList.toggle("nav-menu-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute("aria-label", isOpen ? "Menüyü kapat" : "Menüyü aç");
  });

  document.addEventListener("click", function (event) {
    if (!nav.contains(event.target)) closeMenu();
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth > 820) closeMenu();
  });
})();
