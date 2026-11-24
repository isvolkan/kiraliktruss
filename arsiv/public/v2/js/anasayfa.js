// Kiralık Truss v2 — ana sayfa hareketleri. temel.js'ten sonra yüklenir (window.V2).
(function () {
  'use strict';
  var V2 = window.V2;
  if (!V2) return;
  var az = V2.azHareket, $ = V2.$, $$ = V2.$$, kis = V2.kis;
  var NS = 'http://www.w3.org/2000/svg';

  // ================= 02 · K-17 kurulan izometrik sahne =================
  var k17 = $('.k17');
  var model = k17 && $('.k17-model', k17);
  if (k17 && model) {
    var C = Math.cos(Math.PI / 6), S = Math.sin(Math.PI / 6);
    var iz = function (x, y, z) { return [(x - y) * C, (x + y) * S - z]; };
    var nok = function (a) { return a.map(function (p) { return iz(p[0], p[1], p[2]).map(function (v) { return v.toFixed(1); }).join(','); }).join(' '); };
    // Kutu: üst (u), sağ (s), sol (l) yüzler; renkler CSS'te (.kt-<tip>)
    var kutu = function (x, y, z, w, d, h, tip) {
      return '<g class="kt-' + tip + '">' +
        '<polygon class="u" points="' + nok([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]]) + '"/>' +
        '<polygon class="s" points="' + nok([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]]) + '"/>' +
        '<polygon class="l" points="' + nok([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]]) + '"/></g>';
    };
    var cizgi = function (a, b, sinif, k) {
      var p = iz(a[0], a[1], a[2]), q = iz(b[0], b[1], b[2]);
      return '<line class="' + sinif + '" x1="' + p[0].toFixed(1) + '" y1="' + p[1].toFixed(1) + '" x2="' + q[0].toFixed(1) + '" y2="' + q[1].toFixed(1) + '" stroke-width="' + k + '"/>';
    };
    var kule = function (x, y, h) {
      var s = 16, g = '';
      [[0, 0], [s, 0], [s, s], [0, s]].forEach(function (c) { g += cizgi([x + c[0], y + c[1], 0], [x + c[0], y + c[1], h], 'tr-ana', 2.6); });
      for (var z = 0; z < h; z += 24) {
        g += cizgi([x + s, y, z], [x + s, y + s, z + 24], 'tr-ic', 1.3) + cizgi([x, y + s, z], [x + s, y + s, z + 24], 'tr-ic', 1.3);
      }
      return g + kutu(x - 4, y - 4, -4, s + 8, s + 8, 4, 'plaka');
    };
    var kiris = function (a, b, z) {
      var s = 14, g = '', dx = Math.sign(b[0] - a[0]), dy = Math.sign(b[1] - a[1]);
      var L = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = dy ? s : 0, ny = dx ? s : 0;
      [[0, 0, 0], [nx, ny, 0], [0, 0, s], [nx, ny, s]].forEach(function (o) {
        g += cizgi([a[0] + o[0], a[1] + o[1], z + o[2]], [b[0] + o[0], b[1] + o[1], z + o[2]], 'tr-ana', 2.4);
      });
      for (var t = 0; t < L; t += 22) {
        var u = Math.min(L, t + 22);
        g += cizgi([a[0] + dx * t, a[1] + dy * t, z], [a[0] + dx * u, a[1] + dy * u, z + s], 'tr-ic', 1.2) +
             cizgi([a[0] + dx * t + nx, a[1] + dy * t + ny, z], [a[0] + dx * u + nx, a[1] + dy * u + ny, z + s], 'tr-ic', 1.2);
      }
      return g;
    };
    var K = 300, H = 230;
    var parcalar = [
      kutu(-20, -20, 0, K + 40, K + 40, 0, 'zemin') + kutu(10, 10, 0, K - 20, K - 20, 26, 'podyum'),
      kule(0, 0, H) + kule(K - 16, 0, H) + kule(0, K - 16, H) + kule(K - 16, K - 16, H),
      kiris([0, 0], [K, 0], H) + kiris([0, 0], [0, K], H) + kiris([K - 14, 0], [K - 14, K], H) + kiris([0, K - 14], [K, K - 14], H),
      [60, 120, 180, 240].map(function (x) {
        return kutu(x, 40, H - 26, 18, 18, 22, 'siyah') +
          '<polygon class="isik" points="' + nok([[x + 5, 48, H - 26], [x + 13, 48, H - 26], [x + 40, 70, 26], [x - 20, 70, 26]]) + '"/>';
      }).join('') + kutu(-6, 120, H - 120, 20, 20, 110, 'siyah') + kutu(K - 10, 120, H - 120, 20, 20, 110, 'siyah'),
      kutu(40, 18, 40, K - 80, 6, 150, 'led') + '<polygon class="led-yuz" points="' + nok([[40, 24, 60], [K - 40, 24, 60], [K - 40, 24, 180], [40, 24, 180]]) + '"/>'
    ];
    var g0 = iz(K / 2, K / 2, H / 2);
    model.innerHTML = '<svg viewBox="-430 -330 860 640" preserveAspectRatio="xMidYMid meet"><g transform="translate(' + (-g0[0]).toFixed(1) + ',' + (-g0[1]).toFixed(1) + ')">' +
      parcalar.map(function (p) { return '<g class="parca">' + p + '</g>'; }).join('') + '</g></svg>';
    var pg = $$('.parca', model), adm = $$('.k17-adimlar li', k17);
    k17.classList.add('k17-js');
    if (az) {
      pg.forEach(function (p) { p.classList.add('var'); });
    } else {
      var cz = document.createElement('div');
      cz.className = 'k17-cizgi'; cz.setAttribute('aria-hidden', 'true');
      cz.innerHTML = adm.map(function () { return '<i></i>'; }).join('');
      $('.k17-sol', k17).appendChild(cz);
      var ticks = $$('i', cz), stage = $('.k17-sabit', k17), son17 = -2;
      var ust17 = 0, yuk17 = 0;
      var olc17 = function () { ust17 = parseFloat(getComputedStyle(stage).top) || 0; yuk17 = stage.offsetHeight; };
      olc17(); window.addEventListener('resize', olc17); window.addEventListener('load', olc17);
      V2.kaydir(function () {
        var r = k17.getBoundingClientRect();
        var p = kis((ust17 - r.top) / Math.max(1, r.height - yuk17), 0, .999);
        var n = r.top > V2.ekranH() * .35 ? -1 : Math.floor(p * adm.length);
        if (n === son17) return;
        son17 = n;
        pg.forEach(function (g, i) { g.classList.toggle('var', i <= n); });
        adm.forEach(function (li, i) { li.classList.toggle('etkin', i === Math.max(0, n)); li.classList.toggle('gecti', i < n); });
        ticks.forEach(function (t, i) { t.classList.toggle('dolu', i <= n); });
      });
    }
  }

  // ================= 03 · K-19 geriye yatan kart yığını =================
  var kartlar = $$('.k19-kart');
  if (kartlar.length && !az) {
    var ustler = [], dar = window.matchMedia('(max-width: 760px)');
    var olc19 = function () { ustler = kartlar.map(function (k) { return parseFloat(getComputedStyle(k).top) || 0; }); };
    olc19(); window.addEventListener('resize', olc19); window.addEventListener('load', olc19);
    V2.kaydir(function () {
      var Hh = V2.ekranH();
      kartlar.forEach(function (k, i) {
        var sonraki = kartlar[i + 1];
        if (!sonraki) { k.style.transform = ''; k.style.setProperty('--o', 0); return; }
        var o = kis((Hh - sonraki.getBoundingClientRect().top) / Math.max(1, Hh - ustler[i]));
        k.style.transform = 'translateY(' + (-o * 26).toFixed(1) + 'px) scale(' + (1 - o * .1).toFixed(3) + ')' + (dar.matches ? '' : ' rotateX(' + (o * 16).toFixed(2) + 'deg)');
        k.style.setProperty('--o', o.toFixed(3));
      });
    });
  }

  // ================= 04 · K-21 kurulum gecesi =================
  var k21 = $('.k21');
  if (k21 && !az) {
    var liste = $$('.k21-liste li', k21), sabit = $('.k21-sabit', k21);
    var sahne = document.createElement('div');
    sahne.className = 'k21-sahne'; sahne.setAttribute('aria-hidden', 'true');
    var fonlar = [
      'linear-gradient(180deg,#0e0e0d,#1b1a18 60%,#262320)',
      'linear-gradient(170deg,#121211,#222120 60%,#33291f)',
      'linear-gradient(160deg,#121211,#242220 55%,#3a2a1c)',
      'linear-gradient(150deg,#131312,#272422 50%,#47301d)',
      'linear-gradient(180deg,#1a1815,#3a2a1c 55%,#7a3f1c)',
      'linear-gradient(180deg,#2e1d12,#74381a 55%,#b9632a)'
    ];
    // Çizim: zemin çizgisi, podyum, kuleler, grid, ışık huzmeleri, LED (sahne sahne görünür)
    var zig = function (x0, x1, y0, y1, adet) { // iki çizgi arasında zikzak
      var d = 'M' + x0 + ' ' + y1, dx = (x1 - x0) / adet;
      for (var i = 0; i < adet; i++) d += 'L' + (x0 + dx * (i + 1)).toFixed(1) + ' ' + (i % 2 === 0 ? y0 : y1);
      return d;
    };
    var kuleZ = function (x) { // dikey zikzak (kule kesiti)
      var d = 'M' + x + ' 440';
      for (var i = 0; i < 10; i++) d += 'L' + (x + (i % 2 === 0 ? 32 : 0)) + ' ' + (440 - 29 * (i + 1));
      return d;
    };
    var sv = '<svg viewBox="250 90 700 400" preserveAspectRatio="xMidYMax meet">' +
      '<line class="kc" x1="260" y1="470" x2="940" y2="470"/>' +
      '<g class="kc-grup"><rect class="kc-dolgu" x="300" y="440" width="600" height="30"/><path class="kc kc-ince" d="M300 440H900M300 470H900"/></g>' +
      '<g class="kc-grup"><path class="kc" d="M330 440V150M362 440V150M838 440V150M870 440V150"/><path class="kc kc-ince" d="' + kuleZ(330) + kuleZ(838) + '"/></g>' +
      '<g class="kc-grup"><path class="kc" d="M330 150H870M330 120H870"/><path class="kc kc-ince" d="' + zig(330, 870, 120, 150, 18) + '"/></g>' +
      '<g class="kc-grup"><polygon class="kc-isik" points="430,150 450,150 560,470 330,470"/><polygon class="kc-isik" points="590,150 610,150 720,470 480,470"/><polygon class="kc-isik" points="750,150 770,150 880,470 640,470"/></g>' +
      '<g class="kc-grup"><rect class="kc-ledg" x="470" y="300" width="260" height="140"/></g></svg>';
    sahne.innerHTML = fonlar.map(function (f) { return '<div class="k21-bg" style="background:' + f + '"></div>'; }).join('') +
      '<div class="k21-cizim">' + sv + '</div>' +
      '<div class="k21-saat"><div class="rulo" id="k21Saat"></div><small class="mono" id="k21Vakit"></small></div>' +
      '<div class="k21-olcu"><div class="rulo" id="k21Olcu"></div><small class="mono" id="k21OlcuAd"></small></div>' +
      '<div class="k21-adim mono" id="k21Adim"><b></b><span></span></div>' +
      '<div class="k21-baslik" id="k21Baslik"><h3></h3><p></p></div>' +
      '<div class="k21-cizgi">' + liste.map(function () { return '<i></i>'; }).join('') + '</div>';
    sabit.appendChild(sahne);
    k21.classList.add('k21-js');
    var bgler = $$('.k21-bg', sahne), gruplar = $$('.kc-grup', sahne), cizK = $$('.k21-cizgi i', sahne);
    var adimK = $('#k21Adim'), baslikK = $('#k21Baslik'), su = -1, zaman;
    var goster = function (i) {
      var d = liste[i].dataset;
      bgler.forEach(function (b, k) { b.classList.toggle('acik', k === i); });
      gruplar.forEach(function (g, k) { g.classList.toggle('var', i >= k + 1); });
      cizK.forEach(function (c, k) { c.classList.toggle('dolu', k <= i); });
      V2.rulo($('#k21Saat'), d.saat); $('#k21Vakit').textContent = d.vakit;
      V2.rulo($('#k21Olcu'), d.olcu); $('#k21OlcuAd').textContent = d.olcuad;
      clearTimeout(zaman);
      if (d.no) {
        $('b', adimK).textContent = d.no; $('span', adimK).textContent = d.is;
        adimK.classList.add('var'); baslikK.classList.add('degis');
      } else {
        adimK.classList.remove('var'); baslikK.classList.add('degis');
        zaman = setTimeout(function () {
          var h = $('h3', baslikK);
          h.textContent = d.baslik;
          var nokta = document.createElement('b'); nokta.textContent = '.'; h.appendChild(nokta);
          $('p', baslikK).textContent = d.alt;
          baslikK.classList.remove('degis');
        }, 250);
      }
    };
    var o21 = V2.sabitOlc(sabit);
    V2.kaydir(function () {
      var r = k21.getBoundingClientRect();
      var p = kis((o21.ust - r.top) / Math.max(1, r.height - o21.yuk), 0, .999);
      var n = Math.min(liste.length - 1, Math.floor(p * liste.length));
      if (n !== su) { su = n; goster(n); }
    });
  }

  // ================= 07 · M-15 kelime kelime koyulaşan paragraf =================
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

  // ================= 06 · Metretül hesaplayıcı (v1'deki formül) =================
  var hesap = $('#hesap');
  if (hesap) {
    var al = function (id) { return Math.max(0, parseFloat(String($('#' + id).value).replace(',', '.')) || 0); };
    var hesapla = function () {
      var yapi = $('#hYapi').value;
      var en = al('hEn'), boy = al('hBoy'), yuk = al('hYuk'), adet = Math.max(1, Math.round(al('hAdet')));
      var m = 0;
      if (yapi === 'cerceve') m = 4 * yuk + 2 * (en + boy);                                            // 4 ayak + üst kuşak
      else if (yapi === 'tavan') m = 4 * yuk + 2 * (en + boy) + Math.max(0, Math.ceil(en / 3) - 1) * boy; // + 3 m'de bir ara kiriş
      else if (yapi === 'kemer') m = 2 * yuk + en;                                                      // 2 ayak + üst kiriş
      else if (yapi === 'kule') m = yuk;                                                                // tek dikey
      var toplam = Math.ceil(m * adet);
      $('#hSonuc b').textContent = toplam.toLocaleString('tr-TR');
      $('#hMetretul').value = toplam || '';
      $('#hBoy').closest('label').hidden = (yapi === 'kemer' || yapi === 'kule');
      $('#hEn').closest('label').hidden = (yapi === 'kule');
    };
    hesap.addEventListener('input', hesapla);
    hesapla();
    // Yalnız metretül forma geçsin (yapı alanı adrese eklenmesin)
    hesap.addEventListener('submit', function (e) {
      e.preventDefault();
      window.location.href = hesap.getAttribute('action') + '?metretul=' + encodeURIComponent($('#hMetretul').value);
    });
  }
})();
