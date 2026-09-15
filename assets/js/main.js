(function () {
  "use strict";

  var STORAGE_KEY = "rubipic-lang";
  var SUPPORTED = ["pl", "en"];

  function detectLang() {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.indexOf(stored) !== -1) return stored;
    var nav = (navigator.language || "en").toLowerCase();
    return nav.indexOf("pl") === 0 ? "pl" : "en";
  }

  function applyLang(lang) {
    var play = window.RUBIPIC_PLAY_HEADLINES && window.RUBIPIC_PLAY_HEADLINES[lang];
    var baseLang = play && play.htmlLang
      ? (window.RUBIPIC_I18N[play.htmlLang] ? play.htmlLang : (play.htmlLang.indexOf("pl") === 0 ? "pl" : "en"))
      : lang;
    if (!window.RUBIPIC_I18N[baseLang]) baseLang = "en";
    var dict = Object.assign(
      {},
      window.RUBIPIC_I18N.en,
      window.RUBIPIC_I18N[baseLang] || {},
      play && play.titles ? play.titles : {}
    );
    var htmlLang = play && play.htmlLang ? play.htmlLang : lang;
    var dir = play && play.dir ? play.dir : "ltr";
    document.documentElement.setAttribute("lang", htmlLang);
    document.documentElement.setAttribute("dir", dir);

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (dict[key] !== undefined) el.innerHTML = dict[key];
    });

    document.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
      try {
        var map = JSON.parse(el.getAttribute("data-i18n-attr"));
        Object.keys(map).forEach(function (attr) {
          var key = map[attr];
          if (dict[key] !== undefined) el.setAttribute(attr, dict[key]);
        });
      } catch (e) { /* ignore malformed attr map */ }
    });

    var titleKey = document.body.getAttribute("data-title-key") || "meta.title";
    var descKey = document.body.getAttribute("data-desc-key") || "meta.description";
    if (dict[titleKey]) document.title = dict[titleKey];
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && dict[descKey]) metaDesc.setAttribute("content", dict[descKey]);

    document.querySelectorAll(".lang-toggle button").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-lang") === lang);
    });

    localStorage.setItem(STORAGE_KEY, lang);
  }

  window.RUBIPIC_APPLY_LANG = applyLang;

  function initLangToggle() {
    document.querySelectorAll(".lang-toggle button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        applyLang(btn.getAttribute("data-lang"));
      });
    });
  }

  function initNavToggle() {
    var toggle = document.querySelector(".nav-toggle");
    var links = document.querySelector(".nav-links");
    if (!toggle || !links) return;
    toggle.addEventListener("click", function () {
      links.classList.toggle("open");
    });
    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { links.classList.remove("open"); });
    });
  }

  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window) || items.length === 0) {
      items.forEach(function (el) { el.classList.add("in"); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    items.forEach(function (el) { observer.observe(el); });
  }

  function initYear() {
    var el = document.getElementById("year");
    if (el) el.textContent = new Date().getFullYear();
  }

  document.addEventListener("DOMContentLoaded", function () {
    applyLang(detectLang());
    initLangToggle();
    initNavToggle();
    initReveal();
    initYear();
  });
})();
