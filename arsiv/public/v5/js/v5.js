// Kiralık Truss v5 — sayfa davranışları. Çerçeve yok; her bölüm kendi küçük işlevinde.
// Not: id'li öğeler tarayıcıda global değişken olur; değişken adları id'lerle çakışmasın diye her şey bu işlevin içinde.
(function () {
  'use strict';
  const azHareket = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hepsi = (secici, kap) => Array.from((kap || document).querySelectorAll(secici));

  // 1) Bölüm başlıkları (h2) görünüme girince bir kez yükselir
  (function basliklar() {
    const h2ler = hepsi('main h2').filter(h => !h.closest('legend'));
    if (azHareket || !('IntersectionObserver' in window)) { h2ler.forEach(h => h.classList.add('goruldu')); return; }
    const gozcu = new IntersectionObserver((girdiler) => {
      for (const g of girdiler) if (g.isIntersecting) { g.target.classList.add('goruldu'); gozcu.unobserve(g.target); }
    }, { threshold: 0.1 });
    h2ler.forEach(h => gozcu.observe(h));
  })();

  // 2) Telefon/tablet menüsü: tam ekran mavi panel; Esc kapatır, odak panelde kalır, arka plan kaymaz
  (function mobilMenu() {
    const acDugme = document.querySelector('.menu-ac');
    const panel = document.getElementById('mobil-menu');
    if (!acDugme || !panel) return;
    const kapatDugme = panel.querySelector('.menu-kapat');
    const odaklanabilir = () => hepsi('a[href], button', panel);

    function ac() {
      panel.classList.add('acik');
      acDugme.setAttribute('aria-expanded', 'true');
      document.documentElement.classList.add('menu-acik');
      kapatDugme.focus();
    }
    function kapat(odakGeri) {
      if (!panel.classList.contains('acik')) return;
      panel.classList.remove('acik');
      acDugme.setAttribute('aria-expanded', 'false');
      document.documentElement.classList.remove('menu-acik');
      if (odakGeri) acDugme.focus();
    }
    acDugme.addEventListener('click', ac);
    kapatDugme.addEventListener('click', () => kapat(true));
    panel.addEventListener('click', (e) => { if (e.target.closest('a')) kapat(false); }); // aynı sayfadaki #hesapla için
    document.addEventListener('keydown', (e) => {
      if (!panel.classList.contains('acik')) return;
      if (e.key === 'Escape') { kapat(true); return; }
      if (e.key !== 'Tab') return;
      // Odak tuzağı: sondan başa, baştan sona döner
      const ogeler = odaklanabilir();
      const ilk = ogeler[0], son = ogeler[ogeler.length - 1];
      if (e.shiftKey && document.activeElement === ilk) { e.preventDefault(); son.focus(); }
      else if (!e.shiftKey && document.activeElement === son) { e.preventDefault(); ilk.focus(); }
    });
    // Ekran genişleyip masaüstü menüsü görünürse paneli kapat
    window.matchMedia('(min-width: 1024px)').addEventListener('change', (m) => { if (m.matches) kapat(false); });
  })();

  // 3) Maskeden yükselen satırlar (hero etiketi ve başlığı, teşekkür başlığı): açılışta bir kez
  (function yukselenler() {
    const satirlar = hepsi('.yukselen');
    // setTimeout: sekme arka plandayken requestAnimationFrame çalışmaz, başlık gizli kalmasın
    setTimeout(() => satirlar.forEach(s => s.classList.add('acildi')), 40);
  })();

  // 4) Hero dönen kelime: her 2,4 sn'de eskisi yukarı çıkar, yenisi alttan gelir
  (function donenKelime() {
    const kelimeler = hepsi('.donen-k');
    if (azHareket || kelimeler.length < 2) return;
    let sira = 0;
    setInterval(() => {
      const eski = kelimeler[sira];
      sira = (sira + 1) % kelimeler.length;
      eski.classList.remove('aktif');
      eski.classList.add('cikan');
      kelimeler[sira].classList.add('aktif');
      // Çıkan kelimeyi geçişsiz alta geri koy (bir sonraki turda yine alttan gelsin)
      setTimeout(() => {
        eski.style.transition = 'none';
        eski.classList.remove('cikan');
        void eski.offsetWidth;
        eski.style.transition = '';
      }, 500);
    }, 2400);
  })();

  // 5) Son kurulumlar şeridi: ← → düğmeleri bir kart kaydırır
  (function serit() {
    const liste = document.querySelector('.serit');
    if (!liste) return;
    hepsi('[data-serit]').forEach(d => d.addEventListener('click', () => {
      const kart = liste.querySelector('li');
      if (!kart) return;
      const aralik = parseFloat(getComputedStyle(liste).columnGap) || 0;
      liste.scrollBy({ left: Number(d.dataset.serit) * (kart.getBoundingClientRect().width + aralik) });
    }));
  })();

  // 6) Üç sayı: görünüme girince her basamak 0–9 sütununda aşağıdan dönerek yerine oturur (bir kez)
  (function rakamRulosu() {
    const sayilar = hepsi('[data-rulo]');
    if (azHareket || !sayilar.length || !('IntersectionObserver' in window)) return;
    function kur(el) {
      const metin = el.textContent.trim();
      const ruloHtml = Array.from(metin).map(ch => /\d/.test(ch)
        ? '<span class="basamak"><span class="rulo">' + '0123456789'.split('').map(n => '<span>' + n + '</span>').join('') + '</span></span>'
        : '<span>' + ch + '</span>').join('');
      // Ekran okuyucu gerçek sayıyı okur; dönen sütunlar gizli
      el.innerHTML = '<span class="gizli">' + metin + '</span><span class="rulo-kap" aria-hidden="true">' + ruloHtml + '</span>';
      const rulolar = hepsi('.rulo', el);
      const rakamlar = Array.from(metin).filter(ch => /\d/.test(ch));
      setTimeout(() => rulolar.forEach((r, i) => {
        r.style.transitionDelay = (i * 60) + 'ms';
        r.style.transform = 'translateY(' + (-Number(rakamlar[i])) + 'em)';
      }), 40);
    }
    const gozcu = new IntersectionObserver((girdiler) => {
      for (const g of girdiler) if (g.isIntersecting) { kur(g.target); gozcu.unobserve(g.target); }
    }, { threshold: 0.4 });
    sayilar.forEach(s => gozcu.observe(s));
  })();

  // 7) Metretül hesaplayıcı (formüller veri/duzeltmeler.md ile aynı)
  (function hesaplayici() {
    const kap = document.querySelector('.hesap-js');
    if (!kap) return;
    const alanlar = { en: kap.querySelector('#h-en'), boy: kap.querySelector('#h-boy'), yukseklik: kap.querySelector('#h-yukseklik'), adet: kap.querySelector('#h-adet') };
    const gerekli = { cerceve: ['en', 'boy', 'yukseklik'], tavan: ['en', 'boy', 'yukseklik'], kemer: ['en', 'yukseklik'], kule: ['yukseklik'] };
    const rakam = kap.querySelector('[data-sonuc]');
    const uyari = kap.querySelector('[data-sonuc-uyari]');
    const dugme = kap.querySelector('[data-sonuc-dugme]');
    const kok = dugme.dataset.kok;
    // Ekran okuyucu ara değerleri değil, son sonucu duysun
    rakam.setAttribute('aria-hidden', 'true');
    const okunan = document.createElement('span');
    okunan.className = 'gizli';
    rakam.after(okunan);
    let gosterilen = 0, animasyon = 0;

    // "2,5" ya da "2.5" kabul edilir; boş, sıfır ya da geçersizse null
    const oku = (ad) => {
      const v = parseFloat(String(alanlar[ad].value).replace(',', '.'));
      return Number.isFinite(v) && v > 0 ? v : null;
    };

    function metretul(bicim) {
      const d = {};
      for (const ad of gerekli[bicim]) { d[ad] = oku(ad); if (d[ad] === null) return null; }
      const adet = oku('adet');
      if (adet === null) return null;
      let m;
      if (bicim === 'cerceve' || bicim === 'tavan') {
        m = 4 * d.yukseklik + 2 * (d.en + d.boy);
        if (bicim === 'tavan') m += Math.max(0, Math.ceil(d.en / 3) - 1) * d.boy; // ara kirişler, her biri boy uzunluğunda
      } else if (bicim === 'kemer') m = 2 * d.yukseklik + d.en;
      else m = d.yukseklik; // kule
      return Math.ceil(Math.round(m * adet * 100) / 100); // kayan nokta artığı yüzünden fazladan yuvarlanmasın
    }

    // Rakam eski değerden yenisine 300 ms'de sayar
    function say(hedef) {
      cancelAnimationFrame(animasyon);
      const bas = gosterilen, t0 = performance.now();
      if (azHareket) { gosterilen = hedef; rakam.textContent = hedef; return; }
      (function kare(t) {
        const o = Math.min(1, (t - t0) / 300);
        gosterilen = Math.round(bas + (hedef - bas) * o);
        rakam.textContent = gosterilen;
        if (o < 1) animasyon = requestAnimationFrame(kare);
      })(t0);
    }

    function guncelle() {
      const bicim = kap.querySelector('input[name="bicim"]:checked').value;
      // Biçime göre gereksiz ölçü alanlarını gizle
      for (const ad of ['en', 'boy', 'yukseklik']) {
        alanlar[ad].closest('.olcu').hidden = !gerekli[bicim].includes(ad);
      }
      const sonuc = metretul(bicim);
      say(sonuc || 0);
      okunan.textContent = String(sonuc || 0);
      const gecerli = sonuc && sonuc <= 5000;
      uyari.hidden = !(sonuc > 5000);
      dugme.href = kok + '/teklif' + (gecerli ? '?metretul=' + sonuc : '');
      dugme.firstChild.nodeValue = gecerli ? 'Bu ölçüyle teklif iste ' : 'Teklif iste ';
    }
    kap.addEventListener('input', guncelle);
    kap.addEventListener('change', guncelle);
    guncelle();
  })();

  // 8) "Kimler için kurduk": masaüstünde adın üstüne gelince imleci izleyen fotoğraf önizlemesi
  (function musteriOnizleme() {
    const liste = document.querySelector('.musteriler');
    if (!liste || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const resim = document.createElement('img');
    resim.className = 'onizleme';
    resim.alt = '';
    resim.setAttribute('aria-hidden', 'true');
    document.body.appendChild(resim);
    const G = 280, Y = 210, PAY = 20;
    liste.addEventListener('pointerover', (e) => {
      const a = e.target.closest('a[data-onizleme]');
      if (!a) return;
      if (resim.getAttribute('src') !== a.dataset.onizleme) resim.src = a.dataset.onizleme; // yalnız üstüne gelince yüklenir
      resim.classList.add('gorunur');
    });
    liste.addEventListener('pointerout', (e) => {
      const a = e.target.closest('a[data-onizleme]');
      if (a && !a.contains(e.relatedTarget)) resim.classList.remove('gorunur');
    });
    liste.addEventListener('pointermove', (e) => {
      // Ekranın dışına taşmasın: sağda/altta yer yoksa imlecin öbür yanına geç
      const x = e.clientX + PAY + G > innerWidth ? e.clientX - PAY - G : e.clientX + PAY;
      const y = e.clientY + PAY + Y > innerHeight ? e.clientY - PAY - Y : e.clientY + PAY;
      resim.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    });
  })();

  // 9) Çalışmalar süzgeci: şehir ya da yıl seçilince form kendiliğinden gönderilir
  (function suzgec() {
    const form = document.querySelector('[data-suzgec]');
    if (!form) return;
    hepsi('select', form).forEach(s => s.addEventListener('change', () => form.submit()));
  })();

  // 10) Teklif formu hatalıysa odak hata özetine
  (function hataOzeti() {
    const ozet = document.querySelector('[data-hata-ozet]');
    if (ozet) ozet.focus();
  })();
})();
