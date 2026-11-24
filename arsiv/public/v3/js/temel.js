// Kiralık Truss v3 — ortak etkileşimler (kütüphane yok): tema, mobil menü, kısa belirme.
// Sayfa betikleri window.V3 yardımcılarını kullanır. Rakam rulosu, harf karıştırma, imleç yok:
// sayılar ve başlıklar HTML'de gerçek değeriyle yazılır, JS onlara dokunmaz.
(function () {
  'use strict';
  var kok = document.documentElement;
  var az = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, k) { return (k || document).querySelector(s); };
  var $$ = function (s, k) { return Array.prototype.slice.call((k || document).querySelectorAll(s)); };
  var kis = function (v, a, b) { return Math.min(b === undefined ? 1 : b, Math.max(a === undefined ? 0 : a, v)); };

  // Sabit ekran yüksekliği: telefonda adres çubuğu gidip geldikçe innerHeight değişir; yalnız genişlik değişince yenilenir
  var ekranGen = window.innerWidth, ekranYuk = window.innerHeight;
  function ekranH() { return ekranYuk; }
  window.addEventListener('resize', function () {
    if (window.innerWidth !== ekranGen) { ekranGen = window.innerWidth; ekranYuk = window.innerHeight; }
  });
  // Yapışkan sahnenin üst değeri ve yüksekliği (her karede okumak telefonda titretiyordu)
  function sabitOlc(el) {
    var o = { ust: 0, yuk: 0 };
    var olc = function () { o.ust = parseFloat(getComputedStyle(el).top) || 0; o.yuk = el.offsetHeight; };
    olc(); window.addEventListener('resize', olc); window.addEventListener('load', olc);
    return o;
  }
  // Kaydırma güncellemeleri tek rAF'ta
  var isler = [], bekliyor = false;
  function kaydir(fn) { isler.push(fn); fn(); }
  function tikla() { bekliyor = false; isler.forEach(function (f) { f(); }); }
  function iste() { if (!bekliyor) { bekliyor = true; requestAnimationFrame(tikla); } }
  window.addEventListener('scroll', iste, { passive: true });
  window.addEventListener('resize', iste);
  window.addEventListener('load', iste);
  window.V3 = { azHareket: az, kaydir: kaydir, kis: kis, ekranH: ekranH, sabitOlc: sabitOlc, $: $, $$: $$ };

  // ---- 1) Tema: varsayılan açık (gündüz), düğmeyle gece ----
  var temaDugme = $('#temaDugme');
  if (temaDugme) {
    var meta = $('meta[name="theme-color"]');
    var temaUygula = function (koyu) {
      if (koyu) kok.dataset.tema = 'koyu'; else delete kok.dataset.tema;
      temaDugme.setAttribute('aria-pressed', String(koyu));
      if (meta) meta.setAttribute('content', koyu ? '#0B111D' : '#EDEBE4');
    };
    temaUygula(kok.dataset.tema === 'koyu');
    temaDugme.addEventListener('click', function () {
      var koyu = kok.dataset.tema !== 'koyu';
      temaUygula(koyu);
      try { localStorage.setItem('v3-tema', koyu ? 'koyu' : 'acik'); } catch (e) { /* yoksay */ }
    });
  }

  // ---- 2) Mobil menü ----
  var menuDugme = $('#menuDugme'), ust = $('#ust');
  if (menuDugme && ust) {
    var menuAyarla = function (ac) {
      ust.classList.toggle('menu-acik', ac);
      kok.classList.toggle('menu-acik-kok', ac);
      menuDugme.setAttribute('aria-expanded', String(ac));
      menuDugme.textContent = ac ? 'Kapat' : 'Menü';
    };
    menuDugme.addEventListener('click', function () { menuAyarla(!ust.classList.contains('menu-acik')); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') menuAyarla(false); });
    $$('#menu a').forEach(function (a) { a.addEventListener('click', function () { menuAyarla(false); }); });
  }

  // ---- 3) Kısa belirme [data-belir]: yalnız ekranın altında kalan ögeler hazırlanır (görünen hiçbir şey gizlenmez) ----
  if (!az && 'IntersectionObserver' in window) {
    var gozcu = new IntersectionObserver(function (g) {
      g.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('belir-ac'); gozcu.unobserve(x.target); } });
    }, { rootMargin: '0px 0px -6% 0px' });
    var altSinir = window.innerHeight;
    $$('[data-belir]').forEach(function (el) {
      if (el.getBoundingClientRect().top < altSinir) return; // ilk ekranda görünen olduğu gibi kalır
      el.classList.add('belir-hazir');
      gozcu.observe(el);
    });
  }
})();
