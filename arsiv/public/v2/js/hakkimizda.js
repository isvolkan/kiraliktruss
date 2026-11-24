// Kiralık Truss v2 — hakkımızda hareketleri: M-15 koyulaşan yazı, K-20 patlatılmış görünüm, G-11 çizim köprüsü.
// temel.js'ten sonra yüklenir (window.V2). Hareket kapalıysa / JS yoksa son haller görünür.
(function () {
  'use strict';
  var V2 = window.V2;
  if (!V2) return;
  var az = V2.azHareket, $ = V2.$, $$ = V2.$$, kis = V2.kis;
  var ara = function (p, a, b) { return kis((p - a) / (b - a)); };
  var yum = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

  // ================= 01 · M-15 kelime kelime koyulaşan paragraf =================
  var hak = $('#hakYazi');
  if (hak && !az) {
    hak.setAttribute('aria-label', hak.textContent);
    hak.innerHTML = hak.textContent.split(/(\s+)/).map(function (k) {
      if (!k) return '';
      if (/^\s+$/.test(k)) return ' ';
      return '<span aria-hidden="true">' + k.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>';
    }).join('');
    hak.classList.add('kelimeli');
    var kel = $$('span', hak);
    V2.kaydir(function () {
      var r = hak.getBoundingClientRect();
      var a = kis((V2.ekranH() * .88 - r.top) / (V2.ekranH() * .42));
      var n = Math.round(a * kel.length);
      kel.forEach(function (s, i) { s.classList.toggle('dolu', i < n); });
    });
  }

  // ================= 03 · K-20 patlatılmış görünüm =================
  var k20 = $('.k20');
  if (k20 && !az) {
    var sabit = $('.k20-sabit', k20), parcalar = $$('.k20-p', k20), liste = $$('.k20-liste li', k20), yuzde = $('#k20Yuzde');
    k20.classList.add('k20-js');
    var son20 = -1;
    var o20 = V2.sabitOlc(sabit);
    V2.kaydir(function () {
      var r = k20.getBoundingClientRect();
      var p = kis((o20.ust - r.top) / Math.max(1, r.height - o20.yuk));
      var toplam = 0;
      parcalar.forEach(function (g, i) {
        var t = yum(ara(p, .1 + i * .04, .52 + i * .04));            // parçalar düşey eksende ayrılır
        var e = ara(p, .58 + i * .07, .70 + i * .07);                 // etiket çizgisi çizilir
        var te = ara(p, .64 + i * .07, .76 + i * .07);                // etiket yazısı belirir
        g.style.setProperty('--t', t.toFixed(3));
        g.style.setProperty('--e', e.toFixed(3));
        g.style.setProperty('--te', te.toFixed(3));
        toplam += t;
        if (liste[i]) liste[i].classList.toggle('var', e > 0);
      });
      var yz = Math.round(toplam / parcalar.length * 100);
      if (yz !== son20 && yuzde) { son20 = yz; yuzde.textContent = 'Açılım %' + yz; }
    });
  }

  // ================= 04 · G-11 çizim köprülü geçiş =================
  var g11 = $('.g11');
  var sahne = g11 && $('#g11', g11);
  if (g11 && sahne && !az) {
    var A = $('.g11-a', sahne), B = $('.g11-b', sahne), Cz = $('.g11-c', sahne);
    var etiket = $('#g11Etiket'), adimlar = $$('.g11-adimlar li', g11), sb = $('.g11-sabit', g11);
    var metin = ['01 / 03 · Boş salon', '02 / 03 · Truss çizimi', '03 / 03 · Kurulmuş sahne'];
    var cizgiler = $$('[data-g]', Cz).map(function (el) {
      var L = Math.ceil(el.getTotalLength ? el.getTotalLength() : 2000);
      el.style.strokeDasharray = L;
      el.style.strokeDashoffset = L;
      return { el: el, L: L, g: parseFloat(el.getAttribute('data-g')) || 0 };
    });
    sahne.classList.add('g11-js');
    g11.classList.add('g11-js-bolum');
    var son11 = -1;
    var o11 = V2.sabitOlc(sb);
    V2.kaydir(function () {
      var r = g11.getBoundingClientRect();
      var p = kis((o11.ust - r.top) / Math.max(1, r.height - o11.yuk));
      A.style.opacity = (1 - ara(p, .2, .3)).toFixed(3);
      Cz.style.opacity = (ara(p, .22, .28) * (1 - ara(p, .8, .92))).toFixed(3);
      B.style.opacity = ara(p, .72, .84).toFixed(3);
      cizgiler.forEach(function (c) {
        var t = ara(p, .28 + c.g * .38, .28 + c.g * .38 + .22);
        c.el.style.strokeDashoffset = (c.L * (1 - t)).toFixed(1);
      });
      var n = p < .3 ? 0 : p < .72 ? 1 : 2;
      if (n !== son11) {
        son11 = n;
        etiket.textContent = metin[n];
        adimlar.forEach(function (li, i) { li.classList.toggle('etkin', i === n); });
      }
    });
  }
})();
