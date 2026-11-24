// Kiralık Truss v3 — ana sayfa: tek kaydırma sahnesi (izometrik kurulum) ve canlı hesaplayıcı çizimi.
// izo.js ve temel.js'ten sonra yüklenir (window.Izo, window.V3). Çizimler sunucuda üretilmiş hâlde gelir;
// bu betik yalnız sahneyi adım adım oynatır ve hesaplayıcıda çizimi yeniler.
(function () {
  'use strict';
  var V3 = window.V3, Izo = window.Izo;
  if (!V3) return;
  var az = V3.azHareket, $ = V3.$, $$ = V3.$$, kis = V3.kis;

  // ================= Kurulum sahnesi (kısa kaydırma: bölüm 230vh) =================
  var k17 = $('.k17');
  if (k17 && !az) {
    var pg = $$('.parca', k17), adm = $$('.k17-adimlar li', k17), ticks = $$('.k17-cizgi i', k17);
    var o17 = V3.sabitOlc($('.k17-sabit', k17));
    k17.classList.add('k17-js');
    var son = -2;
    V3.kaydir(function () {
      var r = k17.getBoundingClientRect();
      var p = kis((o17.ust - r.top) / Math.max(1, r.height - o17.yuk), 0, .999);
      // Sahne ekrana yaklaşırken ilk parça hazır olsun; son adım bölümün sonuna gelmeden tamamlansın
      var n = r.top > V3.ekranH() * .5 ? -1 : Math.min(adm.length - 1, Math.floor(p * (adm.length + .6)));
      if (n === son) return;
      son = n;
      pg.forEach(function (g, i) { g.classList.toggle('var', i <= n); });
      adm.forEach(function (li, i) { li.classList.toggle('etkin', i === Math.max(0, n)); li.classList.toggle('gecti', i < n); });
      ticks.forEach(function (t, i) { t.classList.toggle('dolu', i <= n); });
    });
  }

  // ================= Metretül hesaplayıcı + canlı izometrik çerçeve =================
  var hesap = $('#hesap');
  if (hesap && Izo) {
    var cizim = $('#cizim');
    var al = function (id) { return Math.max(0, parseFloat(String($('#' + id).value).replace(',', '.')) || 0); };
    var sonCizim = '';
    var hesapla = function () {
      var o = { yapi: $('#hYapi').value, en: al('hEn'), boy: al('hBoy'), yuk: al('hYuk'), adet: Math.max(1, Math.round(al('hAdet'))) };
      var toplam = Izo.metretul(o);
      $('#hSonuc b').textContent = toplam.toLocaleString('tr-TR');
      $('#hMetretul').value = toplam || '';
      $('#hBoy').closest('label').hidden = (o.yapi === 'kemer' || o.yapi === 'kule');
      $('#hEn').closest('label').hidden = (o.yapi === 'kule');
      if (cizim) {
        var svg = Izo.cerceve(o);
        if (svg !== sonCizim) {
          sonCizim = svg;
          var eski = $('svg', cizim);
          var tmp = document.createElement('div');
          tmp.innerHTML = svg;
          cizim.replaceChild(tmp.firstChild, eski);
          cizim.setAttribute('aria-label', Izo.tarif(o));
        }
      }
    };
    hesap.addEventListener('input', hesapla);
    hesap.addEventListener('change', hesapla);
    hesapla();
    // Yalnız metretül forma geçsin (yapı alanı adrese eklenmesin)
    hesap.addEventListener('submit', function (e) {
      e.preventDefault();
      window.location.href = hesap.getAttribute('action') + '?metretul=' + encodeURIComponent($('#hMetretul').value);
    });
  }
})();
