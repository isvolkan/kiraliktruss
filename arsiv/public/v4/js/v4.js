// Kiralık Truss v4 — ziyaretçi arayüzünün tüm betikleri (kütüphane yok).
// Her parça kendi öğesi sayfada varsa çalışır. JS kapalıyken site eksiksiz çalışır; bunlar yalnız kolaylıktır.
(function () {
  'use strict';
  var hareketAz = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1) Telefonda menü aç/kapa
  function menu() {
    var dugme = document.querySelector('.menu-dugme');
    var ust = document.getElementById('ust');
    if (!dugme || !ust) return;
    function ayarla(acik) {
      dugme.setAttribute('aria-expanded', String(acik));
      ust.classList.toggle('acik', acik);
    }
    dugme.addEventListener('click', function () { ayarla(dugme.getAttribute('aria-expanded') !== 'true'); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && ust.classList.contains('acik')) { ayarla(false); dugme.focus(); }
    });
  }

  // 2) Kaydırınca bölümleri belirgin yap (IntersectionObserver; hareket azaltılmışsa hiç gizlenmez)
  function belir() {
    var bolumler = document.querySelectorAll('[data-belir]');
    if (!bolumler.length || hareketAz || !('IntersectionObserver' in window)) return;
    var gozcu = new IntersectionObserver(function (girisler) {
      girisler.forEach(function (g) {
        if (g.isIntersecting) { g.target.classList.add('gorundu'); gozcu.unobserve(g.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    bolumler.forEach(function (b) {
      // Zaten ekranda olan bölüm hiç gizlenmesin (ilk boyamada titreme olmaz)
      if (b.getBoundingClientRect().top < window.innerHeight) b.classList.add('gorundu');
      gozcu.observe(b);
    });
    document.documentElement.classList.add('belir-acik');
  }

  // 3) Çalışmalar süzgeci: tür ya da seçim değişince form kendiliğinden gönderilir
  function suzgec() {
    var form = document.querySelector('[data-suzgec]');
    if (!form) return;
    form.addEventListener('change', function (e) {
      if (e.target.matches('input[type="radio"], select')) form.requestSubmit ? form.requestSubmit() : form.submit();
    });
  }

  // 4) Metretül hesaplayıcı (formüller: veri/duzeltmeler.md)
  function hesaplayici() {
    var form = document.querySelector('[data-hesap]');
    if (!form) return;
    var svg = form.querySelector('[data-hesap-cizim]');
    var cikti = form.querySelector('[data-hesap-sonuc]');
    var formulYazi = form.querySelector('[data-hesap-formul]');
    var metretulAlan = form.querySelector('[data-hesap-metretul]');
    var NS = 'http://www.w3.org/2000/svg';

    function sayi(ad, varsayilan) {
      var v = parseFloat(String(form.elements[ad].value).replace(',', '.'));
      return isFinite(v) && v > 0 ? v : varsayilan;
    }
    function bicim(n) { return String(Math.round(n * 10) / 10).replace('.', ','); }

    // Ölçülere göre metretül ve formül metni
    function hesapla(sekil, en, boy, h, adet) {
      var tek, formul;
      if (sekil === 'kule') { tek = h; formul = bicim(h); }
      else if (sekil === 'kemer') { tek = 2 * h + en; formul = '2 × ' + bicim(h) + ' + ' + bicim(en); }
      else {
        tek = 4 * h + 2 * (en + boy);
        formul = '4 × ' + bicim(h) + ' + 2 × (' + bicim(en) + ' + ' + bicim(boy) + ')';
        if (sekil === 'tavan') {
          var ara = Math.max(0, Math.ceil(en / 3) - 1); // her 3 m'de bir ara kiriş
          tek += ara * boy;
          formul += ' + ' + ara + ' × ' + bicim(boy);
        }
      }
      var toplam = Math.ceil(tek * adet);
      return { toplam: toplam, formul: formul + ' = ' + bicim(tek) + ' mt' + (adet > 1 ? ' × ' + adet + ' adet' : '') };
    }

    // Eğik izdüşüm: x sağa, y yukarı, z (derinlik) yarı boyda sağ-yukarı
    function ciz(sekil, en, boy, h) {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var dz = sekil === 'kemer' || sekil === 'kule' ? 0 : boy;
      var genis = (sekil === 'kule' ? 0 : en) + dz * 0.6;
      var yuksek = h + dz * 0.35;
      var olcek = Math.min(190 / Math.max(genis, 1), 150 / Math.max(yuksek, 1)) // yanlarda etiket payı;
      var ox = 160 - (genis * olcek) / 2, oy = 105 + (yuksek * olcek) / 2; // dikeyde ortala
      function p(x, y, z) { return [ox + (x + z * 0.6) * olcek, oy - (y + z * 0.35) * olcek]; }
      function cizgi(a, b, sinif) {
        var l = document.createElementNS(NS, 'line');
        l.setAttribute('x1', a[0]); l.setAttribute('y1', a[1]); l.setAttribute('x2', b[0]); l.setAttribute('y2', b[1]);
        l.setAttribute('class', sinif || 'kiris');
        svg.appendChild(l);
      }
      function yazi(xy, metin, hiza) {
        var t = document.createElementNS(NS, 'text');
        if (hiza) t.setAttribute('text-anchor', hiza);
        t.setAttribute('x', xy[0]); t.setAttribute('y', xy[1]);
        t.textContent = metin;
        svg.appendChild(t);
      }
      if (sekil === 'kule') {
        cizgi(p(0, 0, 0), p(0, h, 0));
        yazi([p(0, h / 2, 0)[0] + 10, p(0, h / 2, 0)[1]], 'h ' + bicim(h) + ' m');
        return;
      }
      // Zemin gölgesi (kesikli)
      cizgi(p(0, 0, 0), p(en, 0, 0), 'golge');
      if (dz) { cizgi(p(en, 0, 0), p(en, 0, dz), 'golge'); cizgi(p(0, 0, 0), p(0, 0, dz), 'golge'); cizgi(p(0, 0, dz), p(en, 0, dz), 'golge'); }
      // Dikmeler ve üst kuşak
      cizgi(p(0, 0, 0), p(0, h, 0)); cizgi(p(en, 0, 0), p(en, h, 0)); cizgi(p(0, h, 0), p(en, h, 0));
      if (dz) {
        cizgi(p(0, 0, dz), p(0, h, dz)); cizgi(p(en, 0, dz), p(en, h, dz));
        cizgi(p(0, h, dz), p(en, h, dz)); cizgi(p(0, h, 0), p(0, h, dz)); cizgi(p(en, h, 0), p(en, h, dz));
      }
      if (sekil === 'tavan') {
        for (var x = 3; x < en; x += 3) cizgi(p(x, h, 0), p(x, h, dz), 'kiris ara');
      }
      yazi([p(en / 2, 0, 0)[0], oy + 18], 'en ' + bicim(en) + ' m', 'middle');
      var hy = p(0, h / 2, 0); yazi([hy[0] - 8, hy[1]], 'h ' + bicim(h) + ' m', 'end');
      if (dz) { var dy = p(en, h, dz / 2); yazi([dy[0] + 14, dy[1] + 4], 'd ' + bicim(dz) + ' m'); }
    }

    function guncelle() {
      var sekil = (form.querySelector('input[name="sekil"]:checked') || {}).value || 'cerceve';
      // Biçime göre gereksiz ölçüleri gizle
      form.querySelector('[data-olcu="en"]').hidden = sekil === 'kule';
      form.querySelector('[data-olcu="boy"]').hidden = sekil === 'kemer' || sekil === 'kule';
      var en = Math.min(sayi('en', 6), 100), boy = Math.min(sayi('boy', 3), 100);
      var h = Math.min(sayi('yukseklik', 3), 30), adet = Math.min(Math.round(sayi('adet', 1)), 50);
      var s = hesapla(sekil, en, boy, h, adet);
      var sinirli = Math.min(s.toplam, 5000);
      cikti.textContent = s.toplam;
      formulYazi.textContent = s.formul + (s.toplam > 5000 ? ' — formda en fazla 5000 yazılabilir' : '');
      metretulAlan.value = sinirli;
      ciz(sekil, en, boy, h);
    }
    form.addEventListener('input', guncelle);
    form.addEventListener('change', guncelle);
    // Teklif sayfasına yalnız metretül gitsin (diğer ölçüler adres çubuğunu kalabalıklaştırmasın)
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      window.location.href = form.getAttribute('action') + '?metretul=' + encodeURIComponent(metretulAlan.value);
    });
    guncelle();
  }

  // 5) Teklif formu: hata özetine odaklan, mesaj sayacı, gönderirken düğmeyi kilitle
  function teklifFormu() {
    var form = document.querySelector('[data-form]');
    if (!form) return;
    var ozet = form.querySelector('[data-hata-ozeti]');
    if (ozet) ozet.focus();

    var mesaj = form.querySelector('[data-sayac]');
    var yazi = form.querySelector('[data-sayac-yazi]');
    if (mesaj && yazi) {
      var say = function () { yazi.textContent = ' · ' + mesaj.value.length + '/2000'; };
      mesaj.addEventListener('input', say); say();
    }

    form.addEventListener('submit', function () {
      var dugme = form.querySelector('button[type="submit"]');
      // Çift tıklamayla iki talep gitmesin
      setTimeout(function () { dugme.disabled = true; dugme.textContent = 'Gönderiliyor…'; }, 0);
    });
  }

  function basla() { menu(); belir(); suzgec(); hesaplayici(); teklifFormu(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', basla); else basla();
})();
