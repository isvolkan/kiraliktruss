// Kiralık Truss — Hakkımızda dönen fotoğraf. Sırayı sunucu karıştırır; 5 sn'de bir kendiliğinden geçer; ileri/geri
// düğmeleri, klavye okları, telefonda kaydırma. Fare üstündeyken, klavye odağı içindeyken, sayfa gizliyken ya da ekran dışındayken durur.
(function () {
  var fig = document.querySelector('[data-gosteri]');
  if (!fig) return;
  var sahne = fig.querySelector('.gosteri-sahne');
  var kareler = Array.prototype.slice.call(sahne.querySelectorAll('.gosteri-kare'));
  var yazi = fig.querySelector('figcaption'), sayac = fig.querySelector('.gosteri-sayac');
  var duraklatDugme = fig.querySelector('[data-duraklat]');
  var duraklatYazi = duraklatDugme && duraklatDugme.querySelector('.duraklat-yazi');
  var SURE = 5000, hareketAz = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (kareler.length < 2) return;
  var n = 0;
  // Fotoğraflar sırası gelmeden yüklenir: gösterilen karenin bir önü ve bir arkası hazır tutulur
  function yukle(i) { var im = kareler[(i + kareler.length) % kareler.length].querySelector('img[data-src]'); if (im) { if (im.dataset.srcset) { im.srcset = im.dataset.srcset; im.removeAttribute('data-srcset'); } im.src = im.dataset.src; im.removeAttribute('data-src'); } }
  function isaretle(ilk, elle) {
    kareler.forEach(function (k, i) { var a = i === n; k.setAttribute('aria-hidden', a ? 'false' : 'true'); k.tabIndex = a ? 0 : -1; });
    sayac.textContent = (n + 1) + ' / ' + kareler.length;
    yukle(n + 1); yukle(n - 1);
    if (ilk) return; // ilk künyeyi sunucu yazdı
    // Ekran okuyucuyu otomatik geçişte bölme; yalnız kullanıcı etkileşiminde duyur
    if (elle) yazi.setAttribute('aria-live', 'polite');
    else yazi.removeAttribute('aria-live');
    var k = kareler[n];
    yazi.classList.add('degisiyor');
    setTimeout(function () { yazi.innerHTML = '<b></b><span></span>'; yazi.firstChild.textContent = k.dataset.isim; yazi.lastChild.textContent = k.dataset.alt; yazi.classList.remove('degisiyor'); }, hareketAz ? 0 : 200);
  }
  isaretle(true, false);

  function git(yon, elle) {
    var eski = kareler[n];
    n = (n + yon + kareler.length) % kareler.length;
    var yeni = kareler[n];
    fig.style.setProperty('--yon', yon);
    // yeni kare başlangıç konumuna (ok yönünde) geçişsiz alınır, sonra yerine kayar
    yeni.style.transition = 'none'; yeni.classList.remove('cikan', 'aktif'); void yeni.offsetWidth; yeni.style.transition = '';
    eski.classList.remove('aktif'); eski.classList.add('cikan');
    yeni.classList.add('aktif');
    setTimeout(function () { eski.classList.remove('cikan'); }, 900);
    isaretle(false, !!elle); kur();
  }

  // Kendiliğinden geçiş (prefers-reduced-motion açıksa otomatik dönmez)
  var zaman = null, kalan = SURE, basla = 0, elleDurdu = hareketAz, gorunur = true, fareUstte = false, odakIcinde = false;
  function oynasinMi() { return !hareketAz && !elleDurdu && gorunur && !fareUstte && !odakIcinde && !document.hidden; }
  function duraklatGuncelle() {
    if (!duraklatDugme) return;
    duraklatDugme.setAttribute('aria-pressed', String(elleDurdu));
    duraklatDugme.setAttribute('aria-label', elleDurdu ? 'Gösteriyi oynat' : 'Gösteriyi duraklat');
    if (duraklatYazi) duraklatYazi.textContent = elleDurdu ? 'Oynat' : 'Duraklat';
  }
  function cizgiBastan() { fig.classList.remove('oynuyor'); void fig.offsetWidth; fig.classList.add('oynuyor'); }
  function kur() { clearTimeout(zaman); kalan = SURE; cizgiBastan(); devam(); }
  function devam() {
    clearTimeout(zaman);
    if (!oynasinMi()) { fig.classList.add('durdu'); return; }
    fig.classList.remove('durdu'); basla = Date.now();
    zaman = setTimeout(function () { git(1, false); }, kalan);
  }
  function dur() { if (zaman) { clearTimeout(zaman); zaman = null; kalan = Math.max(0, kalan - (Date.now() - basla)); } fig.classList.add('durdu'); }
  fig.style.setProperty('--sure', SURE + 'ms');
  duraklatGuncelle();

  if (duraklatDugme) {
    duraklatDugme.addEventListener('click', function () {
      if (hareketAz) return; // hareket azaltma açıkken otomatik dönme başlatılmaz
      elleDurdu = !elleDurdu;
      duraklatGuncelle();
      elleDurdu ? dur() : devam();
    });
  }

  fig.addEventListener('mouseenter', function () { fareUstte = true; dur(); });
  fig.addEventListener('mouseleave', function () { fareUstte = false; devam(); });
  // Yalnız klavyeyle gelen odak durdurur (fareyle düğmeye tıklamak gösteriyi kalıcı olarak durdurmasın)
  fig.addEventListener('focusin', function (e) {
    var klavye = true;
    try { klavye = e.target.matches(':focus-visible'); } catch (_) {}
    if (klavye) { odakIcinde = true; dur(); }
  });
  fig.addEventListener('focusout', function (e) { if (!fig.contains(e.relatedTarget)) { odakIcinde = false; devam(); } });
  document.addEventListener('visibilitychange', function () { document.hidden ? dur() : devam(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (g) { gorunur = g[0].isIntersecting; gorunur ? devam() : dur(); }).observe(fig);

  // Düğmeler ve klavye
  fig.querySelectorAll('[data-yon]').forEach(function (d) { d.addEventListener('click', function () { git(+d.dataset.yon, true); }); });
  fig.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { git(1, true); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { git(-1, true); e.preventDefault(); }
  });

  // Telefonda yatay kaydırma (dikey kaydırma sayfaya kalır)
  var x0 = null, y0 = 0, kaydi = false;
  sahne.addEventListener('pointerdown', function (e) { if (e.pointerType === 'mouse') return; x0 = e.clientX; y0 = e.clientY; kaydi = false; });
  sahne.addEventListener('pointerup', function (e) {
    if (x0 === null) return;
    var dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { kaydi = true; git(dx < 0 ? 1 : -1, true); }
  });
  sahne.addEventListener('click', function (e) { if (kaydi) { e.preventDefault(); kaydi = false; } }, true);

  kur();
})();
