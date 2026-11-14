// Kiralık Truss — tarayıcı tarafı etkileşimler (kütüphane yok, düz JavaScript).
(function () {
  'use strict';
  var azHareket = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1) Açık / koyu tema: View Transition destekleniyorsa tıklanan yerden daire yayılır
  var temaDugme = document.getElementById('temaDugme');
  if (temaDugme) {
    temaDugme.addEventListener('click', function (e) {
      var kok = document.documentElement;
      var simdiAcik = kok.dataset.tema === 'acik' ||
        (!kok.dataset.tema && window.matchMedia('(prefers-color-scheme: light)').matches);
      var yeni = simdiAcik ? 'koyu' : 'acik';
      var uygula = function () {
        kok.dataset.tema = yeni;
        try { localStorage.setItem('tema', yeni); } catch (err) { /* yoksay */ }
      };
      kok.style.setProperty('--x', e.clientX + 'px');
      kok.style.setProperty('--y', e.clientY + 'px');
      if (document.startViewTransition && !azHareket) document.startViewTransition(uygula);
      else uygula();
    });
  }

  // 2) Telefon menüsü
  var menuDugme = document.getElementById('menuDugme');
  var menu = document.getElementById('menu');
  if (menuDugme && menu) {
    menuDugme.addEventListener('click', function () {
      var acik = menu.classList.toggle('acik');
      menuDugme.setAttribute('aria-expanded', String(acik));
      menuDugme.textContent = acik ? 'Kapat' : 'Menü';
    });
  }

  // 3) Başlıkları kelimelere böl (kelime kelime belirme için)
  document.querySelectorAll('.kelime-kelime').forEach(function (el) {
    var kelimeler = el.textContent.trim().split(/\s+/);
    el.setAttribute('aria-label', el.textContent.trim());
    el.innerHTML = kelimeler.map(function (k, i) {
      return '<span class="k" aria-hidden="true"><span style="--i:' + i + '">' + k.replace(/</g, '&lt;') + '</span></span>';
    }).join(' ');
  });

  // 4) Ekrana girince görün: .ortaya-cik ve .kelime-kelime öğelerine "gorundu" sınıfı eklenir
  var gozcu = 'IntersectionObserver' in window ? new IntersectionObserver(function (girdiler) {
    girdiler.forEach(function (g) {
      if (!g.isIntersecting) return;
      g.target.classList.add('gorundu');
      if (g.target.matches('[data-say]')) say(g.target);
      gozcu.unobserve(g.target);
    });
  }, { rootMargin: '0px 0px -10% 0px' }) : null;
  document.querySelectorAll('.ortaya-cik, .kelime-kelime, [data-say]').forEach(function (el) {
    if (gozcu && !azHareket) gozcu.observe(el);
    else { el.classList.add('gorundu'); if (el.matches('[data-say]')) say(el, true); }
  });

  // 5) Sayaç: 0'dan hedef sayıya yumuşak artış
  function say(el, hemen) {
    var hedef = parseInt(el.dataset.say, 10) || 0;
    var on = el.dataset.on || '', son = el.dataset.son || '';
    if (hemen) { el.textContent = on + hedef.toLocaleString('tr-TR') + son; return; }
    var bas = performance.now(), sure = 1400;
    (function adim(t) {
      var o = Math.min(1, (t - bas) / sure);
      var yumusak = 1 - Math.pow(1 - o, 3);
      el.textContent = on + Math.round(hedef * yumusak).toLocaleString('tr-TR') + son;
      if (o < 1) requestAnimationFrame(adim);
    })(bas);
  }

  // 6) Sayfanın tek büyük anı: truss kafesi kaydırdıkça kendini çizer (stroke-dashoffset 1 → 0)
  var kafes = document.getElementById('kafes');
  if (kafes && !azHareket) {
    var bekliyor = false;
    var guncelle = function () {
      bekliyor = false;
      var r = kafes.getBoundingClientRect();
      var h = window.innerHeight;
      // Kafes ekranın altından girdiğinde 0, ekranın ortasına geldiğinde 1
      var ilerleme = Math.min(1, Math.max(0, (h - r.top) / (h * 0.6)));
      kafes.style.setProperty('--cizim', String(1 - ilerleme));
    };
    window.addEventListener('scroll', function () {
      if (!bekliyor) { bekliyor = true; requestAnimationFrame(guncelle); }
    }, { passive: true });
    guncelle();
  }

  // 7) Metretül hesaplayıcı (tahmini). Truss parçaları metre metre kiralandığı için yukarı yuvarlanır.
  var hesap = document.getElementById('hesap');
  if (hesap) {
    var al = function (id) { return Math.max(0, parseFloat(document.getElementById(id).value.replace(',', '.')) || 0); };
    var hesapla = function () {
      var yapi = document.getElementById('hYapi').value;
      var en = al('hEn'), boy = al('hBoy'), yuk = al('hYuk'), adet = Math.max(1, Math.round(al('hAdet')));
      var m = 0;
      if (yapi === 'cerceve') m = 4 * yuk + 2 * (en + boy);              // 4 ayak + üst kuşak
      else if (yapi === 'tavan') m = 4 * yuk + 2 * (en + boy) + Math.max(0, Math.ceil(en / 3) - 1) * boy; // + 3 m'de bir ara kiriş
      else if (yapi === 'kemer') m = 2 * yuk + en;                       // 2 ayak + üst kiriş
      else if (yapi === 'kule') m = yuk;                                 // tek dikey
      var toplam = Math.ceil(m * adet);
      document.querySelector('#hSonuc b').textContent = toplam.toLocaleString('tr-TR');
      document.getElementById('hMetretul').value = toplam || '';
      document.getElementById('hBoy').closest('label').hidden = (yapi === 'kemer' || yapi === 'kule');
      document.getElementById('hEn').closest('label').hidden = (yapi === 'kule');
    };
    hesap.addEventListener('input', hesapla);
    hesapla();
    // Sadece metretül forma geçsin (yapi alanını adrese ekleme)
    hesap.addEventListener('submit', function (e) {
      e.preventDefault();
      window.location.href = '/teklif?metretul=' + encodeURIComponent(document.getElementById('hMetretul').value);
    });
  }

  // 8) Liste görünümü: satırın üstüne gelince fotoğraf imleci izler (yalnız fareyle)
  var liste = document.getElementById('liste');
  var onizleme = document.getElementById('listeOnizleme');
  if (liste && onizleme && window.matchMedia('(hover: hover)').matches) {
    liste.addEventListener('mouseover', function (e) {
      var a = e.target.closest('a[data-gorsel]');
      if (!a) return;
      if (onizleme.getAttribute('src') !== a.dataset.gorsel) onizleme.src = a.dataset.gorsel;
      onizleme.classList.add('gorunur');
    });
    liste.addEventListener('mouseleave', function () { onizleme.classList.remove('gorunur'); });
    liste.addEventListener('mousemove', function (e) {
      var x = Math.min(e.clientX + 24, window.innerWidth - 300);
      var y = Math.min(e.clientY - 90, window.innerHeight - 200);
      onizleme.style.transform = 'translate(' + x + 'px,' + Math.max(70, y) + 'px)';
    });
  }

  // 9) Silme gibi geri alınamaz işlemlerde onay sor
  document.querySelectorAll('form[data-onay]').forEach(function (f) {
    f.addEventListener('submit', function (e) { if (!window.confirm(f.dataset.onay)) e.preventDefault(); });
  });
})();
