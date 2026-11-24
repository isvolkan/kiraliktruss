// Kiralık Truss v3 — izometrik çizimler ve metretül formülü (kütüphane yok).
// Aynı dosya iki yerde çalışır: sunucuda (routes/v3.js → res.locals.izo, EJS ilk çizimi üretir; JS kapalıyken de görünür)
// ve tarayıcıda (window.Izo; hesaplayıcı girilen ölçüye göre çerçeveyi yeniden çizer).
(function (kok, fn) {
  if (typeof module === 'object' && module.exports) module.exports = fn();
  else kok.Izo = fn();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var C = Math.cos(Math.PI / 6), S = Math.sin(Math.PI / 6);
  var iz = function (x, y, z) { return [(x - y) * C, (x + y) * S - z]; };
  var f1 = function (v) { return (Math.round(v * 10) / 10).toString(); };
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };

  // ---------------- Metretül (v1 / v2 ile aynı formül) ----------------
  function metretul(o) {
    var en = +o.en || 0, boy = +o.boy || 0, yuk = +o.yuk || 0, adet = Math.max(1, Math.round(+o.adet || 1));
    var m = 0;
    if (o.yapi === 'cerceve') m = 4 * yuk + 2 * (en + boy);                                              // 4 ayak + üst kuşak
    else if (o.yapi === 'tavan') m = 4 * yuk + 2 * (en + boy) + Math.max(0, Math.ceil(en / 3) - 1) * boy; // + 3 m'de bir ara kiriş
    else if (o.yapi === 'kemer') m = 2 * yuk + en;                                                        // 2 ayak + üst kiriş
    else if (o.yapi === 'kule') m = yuk;                                                                  // tek dikey
    return Math.ceil(m * adet);
  }

  // ---------------- Hesaplayıcı çerçevesi ----------------
  // Ölçülere göre truss elemanları (metre, x = en, y = boy, z = yükseklik)
  function elemanlar(o) {
    var en = o.en, boy = o.boy, h = o.yuk, e = [], ayak = [];
    var dik = function (x, y) { e.push([[x, y, 0], [x, y, h]]); ayak.push([x, y]); };
    if (o.yapi === 'kule') { dik(0, 0); return { e: e, ayak: ayak }; }
    if (o.yapi === 'kemer') { dik(0, 0); dik(en, 0); e.push([[0, 0, h], [en, 0, h]]); return { e: e, ayak: ayak }; }
    dik(0, 0); dik(en, 0); dik(en, boy); dik(0, boy);
    e.push([[0, 0, h], [en, 0, h]], [[en, 0, h], [en, boy, h]], [[0, boy, h], [en, boy, h]], [[0, 0, h], [0, boy, h]]);
    if (o.yapi === 'tavan') {
      var n = Math.max(0, Math.ceil(en / 3) - 1);
      for (var i = 1; i <= n; i++) { var x = en * i / (n + 1); e.push([[x, 0, h], [x, boy, h], 'ara']); }
    }
    return { e: e, ayak: ayak };
  }

  // Ekran düzleminde düz bir kafes kiriş: iki kuşak + zikzak (şematik)
  function kafes(p, q, w, sinif) {
    var dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1;
    var ux = dx / L, uy = dy / L, nx = -uy * w, ny = ux * w;
    var a1 = [p[0] + nx, p[1] + ny], b1 = [q[0] + nx, q[1] + ny], a2 = [p[0] - nx, p[1] - ny], b2 = [q[0] - nx, q[1] - ny];
    var adim = Math.max(1, Math.round(L / (w * 2.6))), z = 'M' + f1(a1[0]) + ' ' + f1(a1[1]);
    for (var i = 1; i <= adim; i++) {
      var t = i / adim, k = i % 2 ? -1 : 1;
      z += 'L' + f1(p[0] + dx * t + nx * k) + ' ' + f1(p[1] + dy * t + ny * k);
    }
    var kus = 'M' + f1(a1[0]) + ' ' + f1(a1[1]) + 'L' + f1(b1[0]) + ' ' + f1(b1[1]) + 'M' + f1(a2[0]) + ' ' + f1(a2[1]) + 'L' + f1(b2[0]) + ' ' + f1(b2[1]);
    return '<g class="ck ' + (sinif || '') + '"><path class="ck-alt" d="' + kus + '"/><path class="ck-ana" d="' + kus + '"/><path class="ck-ic" d="' + z + '"/></g>';
  }

  // Ölçü çizgisi: iki nokta arasında, n yönünde kaydırılmış, ortasında yazı
  function olcu(p, q, n, yazi) {
    var a = [p[0] + n[0], p[1] + n[1]], b = [q[0] + n[0], q[1] + n[1]], m = [(a[0] + b[0]) / 2 + n[0] * .9, (a[1] + b[1]) / 2 + n[1] * .9];
    var L = Math.hypot(n[0], n[1]) || 1, tx = n[0] / L * 5, ty = n[1] / L * 5;
    return '<g class="co"><path d="M' + f1(a[0]) + ' ' + f1(a[1]) + 'L' + f1(b[0]) + ' ' + f1(b[1]) +
      'M' + f1(a[0] - tx) + ' ' + f1(a[1] - ty) + 'l' + f1(2 * tx) + ' ' + f1(2 * ty) +
      'M' + f1(b[0] - tx) + ' ' + f1(b[1] - ty) + 'l' + f1(2 * tx) + ' ' + f1(2 * ty) + '"/>' +
      '<text x="' + f1(m[0]) + '" y="' + f1(m[1] + 4) + '" text-anchor="middle">' + esc(yazi) + '</text></g>';
  }

  var sayiYaz = function (v) { return String(Math.round(v * 10) / 10).replace('.', ','); };

  // Hesaplayıcının yanındaki çizim. Döner: <svg> metni
  function cerceve(o) {
    var d = {
      yapi: ['cerceve', 'tavan', 'kemer', 'kule'].indexOf(o.yapi) >= 0 ? o.yapi : 'cerceve',
      en: Math.min(60, Math.max(1, +o.en || 1)), boy: Math.min(60, Math.max(1, +o.boy || 1)),
      yuk: Math.min(12, Math.max(1, +o.yuk || 1)), adet: Math.max(1, Math.round(+o.adet || 1))
    };
    var W = 480, H = 360, PAD = 54, w = 4.2;
    var yapi = elemanlar(d);
    // Ölçek: bütün köşe noktaları kutuya sığsın (çok küçük yapılar aşırı büyümesin)
    var nok = [];
    yapi.e.forEach(function (s) { nok.push(iz.apply(null, s[0]), iz.apply(null, s[1])); });
    nok.push(iz(0, 0, 0), iz(d.en, 0, 0), iz(0, d.boy, 0), iz(d.en, d.boy, 0));
    var x0 = Math.min.apply(null, nok.map(function (p) { return p[0]; })), x1 = Math.max.apply(null, nok.map(function (p) { return p[0]; }));
    var y0 = Math.min.apply(null, nok.map(function (p) { return p[1]; })), y1 = Math.max.apply(null, nok.map(function (p) { return p[1]; }));
    var s = Math.min((W - 2 * PAD) / Math.max(.01, x1 - x0), (H - 2 * PAD) / Math.max(.01, y1 - y0), 46);
    var ox = W / 2 - (x0 + x1) / 2 * s, oy = H / 2 - (y0 + y1) / 2 * s;
    var P = function (x, y, z) { var p = iz(x, y, z); return [ox + p[0] * s, oy + p[1] * s]; };

    var g = '';
    // Zemin izi
    if (d.yapi === 'cerceve' || d.yapi === 'tavan') {
      g += '<polygon class="cz" points="' + [P(0, 0, 0), P(d.en, 0, 0), P(d.en, d.boy, 0), P(0, d.boy, 0)].map(function (p) { return f1(p[0]) + ',' + f1(p[1]); }).join(' ') + '"/>';
    } else if (d.yapi === 'kemer') {
      var k1 = P(0, -.6, 0), k2 = P(d.en, -.6, 0), k3 = P(d.en, .6, 0), k4 = P(0, .6, 0);
      g += '<polygon class="cz" points="' + [k1, k2, k3, k4].map(function (p) { return f1(p[0]) + ',' + f1(p[1]); }).join(' ') + '"/>';
    }
    // Uzaktan yakına sırala (ressam algoritması: önde kalan çizgi arkadakini örter)
    var sirali = yapi.e.slice().sort(function (a, b) {
      return (a[0][0] + a[0][1] + a[1][0] + a[1][1]) - (b[0][0] + b[0][1] + b[1][0] + b[1][1]);
    });
    yapi.ayak.forEach(function (a) {
      var r = .28, pts = [P(a[0] - r, a[1] - r, 0), P(a[0] + r, a[1] - r, 0), P(a[0] + r, a[1] + r, 0), P(a[0] - r, a[1] + r, 0)];
      g += '<polygon class="cp" points="' + pts.map(function (p) { return f1(p[0]) + ',' + f1(p[1]); }).join(' ') + '"/>';
    });
    sirali.forEach(function (e) {
      g += kafes(P.apply(null, e[0]), P.apply(null, e[1]), e[2] === 'ara' ? w * .8 : w, e[2] === 'ara' ? 'ck-ara' : '');
    });
    // Ölçüler
    var o2 = '';
    if (d.yapi === 'kule') {
      o2 += olcu(P(0, 0, 0), P(0, 0, d.yuk), [-30, 0], sayiYaz(d.yuk) + ' m');
    } else {
      var yEn = d.yapi === 'kemer' ? 0 : d.boy;
      o2 += olcu(P(0, yEn, 0), P(d.en, yEn, 0), [-12, 22], sayiYaz(d.en) + ' m');
      if (d.yapi !== 'kemer') o2 += olcu(P(d.en, 0, 0), P(d.en, d.boy, 0), [14, 22], sayiYaz(d.boy) + ' m');
      o2 += olcu(P(0, yEn, 0), P(0, yEn, d.yuk), [-26, 0], sayiYaz(d.yuk) + ' m');
    }
    if (d.adet > 1) o2 += '<text class="cadet" x="' + (W - 14) + '" y="26" text-anchor="end">× ' + d.adet + ' adet</text>';
    return '<svg class="cizim-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">' + g + o2 + '</svg>';
  }

  // Ekran okuyucu için çizimin kısa tarifi
  var YAPI_AD = { cerceve: 'çerçeve', tavan: 'tavan ara kirişli çerçeve', kemer: 'kemer', kule: 'kule' };
  function tarif(o) {
    var olc = o.yapi === 'kule' ? sayiYaz(o.yuk) + ' m yükseklikte' :
      o.yapi === 'kemer' ? sayiYaz(o.en) + ' m genişlik, ' + sayiYaz(o.yuk) + ' m yükseklikte' :
      sayiYaz(o.en) + ' × ' + sayiYaz(o.boy) + ' m, ' + sayiYaz(o.yuk) + ' m yükseklikte';
    return 'Şematik çizim: ' + olc + ' ' + (YAPI_AD[o.yapi] || 'çerçeve') + (o.adet > 1 ? ', ' + o.adet + ' adet' : '');
  }

  // ---------------- Ana sayfa kurulum sahnesi (v2'deki K-17 modeli, sunucuda çizilir) ----------------
  function sahne() {
    var nk = function (a) { return a.map(function (p) { return iz(p[0], p[1], p[2]).map(function (v) { return v.toFixed(1); }).join(','); }).join(' '); };
    var kutu = function (x, y, z, w, d, h, tip) {
      return '<g class="kt-' + tip + '">' +
        '<polygon class="u" points="' + nk([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]]) + '"/>' +
        '<polygon class="s" points="' + nk([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]]) + '"/>' +
        '<polygon class="l" points="' + nk([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]]) + '"/></g>';
    };
    var cizgi = function (a, b, sinif, k) {
      var p = iz(a[0], a[1], a[2]), q = iz(b[0], b[1], b[2]);
      return '<line class="' + sinif + '" x1="' + p[0].toFixed(1) + '" y1="' + p[1].toFixed(1) + '" x2="' + q[0].toFixed(1) + '" y2="' + q[1].toFixed(1) + '" stroke-width="' + k + '"/>';
    };
    var kule = function (x, y, h) {
      var s = 16, g = '';
      [[0, 0], [s, 0], [s, s], [0, s]].forEach(function (c) { g += cizgi([x + c[0], y + c[1], 0], [x + c[0], y + c[1], h], 'tr-ana', 2.6); });
      for (var z = 0; z < h; z += 24) g += cizgi([x + s, y, z], [x + s, y + s, z + 24], 'tr-ic', 1.3) + cizgi([x, y + s, z], [x + s, y + s, z + 24], 'tr-ic', 1.3);
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
          '<polygon class="isik" points="' + nk([[x + 5, 48, H - 26], [x + 13, 48, H - 26], [x + 40, 70, 26], [x - 20, 70, 26]]) + '"/>';
      }).join('') + kutu(-6, 120, H - 120, 20, 20, 110, 'siyah') + kutu(K - 10, 120, H - 120, 20, 20, 110, 'siyah'),
      kutu(40, 18, 40, K - 80, 6, 150, 'led') + '<polygon class="led-yuz" points="' + nk([[40, 24, 60], [K - 40, 24, 60], [K - 40, 24, 180], [40, 24, 180]]) + '"/>'
    ];
    var g0 = iz(K / 2, K / 2, H / 2);
    return '<svg viewBox="-430 -330 860 640" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false"><g transform="translate(' + (-g0[0]).toFixed(1) + ',' + (-g0[1]).toFixed(1) + ')">' +
      parcalar.map(function (p) { return '<g class="parca">' + p + '</g>'; }).join('') + '</g></svg>';
  }

  return { metretul: metretul, cerceve: cerceve, tarif: tarif, sahne: sahne };
});
