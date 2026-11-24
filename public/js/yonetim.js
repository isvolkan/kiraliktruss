// Yönetim paneli — tarayıcı tarafı küçük davranışlar (kütüphane yok). JS kapalıyken de panel çalışır;
// bunlar yalnız kolaylık: tema, telefon menüsü, silme onayı, hata özetine odak, fotoğraf önizlemesi.
(function () {
  'use strict';
  var k = document.documentElement;

  // 1) Açık / karanlık mod: ana siteyle aynı kayıt (localStorage 'v6-tema'), ilk açılışta erken.js uygular
  var temaDugme = document.querySelector('.tema-dugme');
  if (temaDugme) {
    var yaz = function () {
      var koyu = k.dataset.tema === 'koyu';
      temaDugme.setAttribute('aria-pressed', String(koyu));
      temaDugme.setAttribute('aria-label', koyu ? 'Açık moda geç' : 'Karanlık moda geç');
    };
    yaz();
    temaDugme.addEventListener('click', function () {
      var yeni = k.dataset.tema === 'koyu' ? 'acik' : 'koyu';
      k.classList.add('tema-gecis'); // renkler yumuşakça geçsin (site.css)
      k.dataset.tema = yeni;
      try { localStorage.setItem('v6-tema', yeni); } catch (e) { /* gizli pencere: yalnız bu sayfa */ }
      yaz();
      setTimeout(function () { k.classList.remove('tema-gecis'); }, 450);
    });
  }

  // 2) Telefon menüsü: "Menü" düğmesi yönetim menüsünü açar/kapatır; Esc kapatır
  var menuAc = document.querySelector('.y-menu-ac');
  if (menuAc) {
    var ayarla = function (acik) {
      k.classList.toggle('y-menu-acik', acik);
      menuAc.setAttribute('aria-expanded', String(acik));
      menuAc.textContent = acik ? 'Kapat' : 'Menü';
    };
    menuAc.addEventListener('click', function () { ayarla(!k.classList.contains('y-menu-acik')); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && k.classList.contains('y-menu-acik')) { ayarla(false); menuAc.focus(); }
    });
  }

  // 3) Silme gibi geri alınamaz işlemlerde onay sor (form[data-onay])
  document.querySelectorAll('form[data-onay]').forEach(function (f) {
    f.addEventListener('submit', function (e) { if (!window.confirm(f.dataset.onay)) e.preventDefault(); });
  });

  // 4) Form hatalıysa odak hata özetine: ekran okuyucu hataları hemen okur, bağlantılar alana götürür
  var ozet = document.querySelector('[data-hata-ozet]');
  if (ozet) ozet.focus();

  // 5) Fotoğraf seçilince önizleme (data: adresi; güvenlik politikası blob: adresine izin vermiyor)
  var dosya = document.getElementById('gorsel');
  var onizleme = document.querySelector('[data-onizleme]');
  if (dosya && onizleme && window.FileReader) {
    var resim = onizleme.querySelector('img');
    var yazi = onizleme.querySelector('[data-onizleme-yazi]');
    var ilkAdres = resim.getAttribute('src');
    var ilkYazi = yazi.textContent;
    dosya.addEventListener('change', function () {
      var f = dosya.files && dosya.files[0];
      if (!f || !/^image\/(jpeg|png|webp)$/.test(f.type)) {
        // Seçim kaldırıldı ya da desteklenmeyen tür: mevcut fotoğrafa dön
        resim.src = ilkAdres || '';
        yazi.textContent = ilkYazi;
        onizleme.hidden = !ilkAdres;
        return;
      }
      var okuyucu = new FileReader();
      okuyucu.onload = function () {
        resim.src = okuyucu.result;
        yazi.textContent = 'Yeni fotoğraf (kaydedince yüklenir)';
        onizleme.hidden = false;
      };
      okuyucu.readAsDataURL(f);
    });
  }

  // 6) Panodaki "3 dk önce" yazıları sayfa açıkken de güncel kalsın (dakikada bir; tam tarih title'da duruyor)
  var zamanlar = document.querySelectorAll('.y-pano-yan time[datetime]');
  if (zamanlar.length) {
    var goreli = function (iso) {
      var sn = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
      if (sn < 60) return 'az önce';
      if (sn < 3600) return Math.floor(sn / 60) + ' dk önce';
      if (sn < 86400) return Math.floor(sn / 3600) + ' sa önce';
      var gun = Math.floor(sn / 86400);
      if (gun === 1) return 'dün';
      return gun <= 30 ? gun + ' gün önce' : null; // eski kayıtta sunucunun yazdığı tarih kalır
    };
    setInterval(function () {
      zamanlar.forEach(function (t) { var y = goreli(t.getAttribute('datetime')); if (y) t.textContent = y; });
    }, 60000);
  }
})();
