/* Kiralık Truss — sayfa başlığı (Çalışmalar, Hakkımızda, İletişim):
   1) açılışta harf harf maskeden yükselir (ekran okuyucu bütün metni tek parça okur),
   2) kaydırdıkça küçülüp ekranın soluna, üst çubuğun hemen altına yapışan etiket olur; yukarı çıkınca geri büyür.
   Kaydırma: yalnız transform/opacity, passive dinleyici, requestAnimationFrame; ölçüm yalnız yükleme/yeniden boyutlandırmada. */
(function () {
  'use strict';
  const h1 = document.querySelector('[data-sayfa-baslik]');
  if (!h1) return;
  const azHareket = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- 1) Harf harf açılış ----
  (function bol() {
    const metin = h1.textContent.replace(/\s+/g, ' ').trim();
    const okuyucu = document.createElement('span');
    okuyucu.className = 'gizli';
    okuyucu.textContent = metin;
    const gorsel = document.createElement('span');
    gorsel.setAttribute('aria-hidden', 'true');
    let sira = 0;
    metin.split(' ').forEach((kelime, k) => {
      if (k) gorsel.appendChild(document.createTextNode(' '));
      const kap = document.createElement('span');
      kap.className = 'sb-kelime';
      for (const harf of kelime) {
        const s = document.createElement('span');
        s.className = 'sb-harf';
        s.style.setProperty('--i', Math.min(sira++, 28));
        s.textContent = harf;
        kap.appendChild(s);
      }
      gorsel.appendChild(kap);
    });
    h1.textContent = '';
    h1.append(okuyucu, gorsel);
    h1.classList.add('hazir');
    // setTimeout: sekme arka plandayken requestAnimationFrame çalışmaz, başlık gizli kalmasın
    if (azHareket) h1.classList.add('acildi');
    else setTimeout(() => h1.classList.add('acildi'), 80);
  })();

  // ---- 1b) Çapa (#suzgec gibi) ile gelişte: yazı tipi ve görseller yüklenince düzen değişir, tarayıcının ilk kaydırması
  // hedefi kaçırır. Kullanıcı kendisi kaydırmadıysa yükleme bitince hedefe yeniden hizala.
  (function capa() {
    const id = decodeURIComponent(location.hash.slice(1));
    const hedef = id && document.getElementById(id);
    if (!hedef) return;
    let elle = false;
    const dur = () => { elle = true; };
    ['wheel', 'touchstart', 'keydown'].forEach(o => addEventListener(o, dur, { once: true, passive: true }));
    const hizala = () => { if (!elle) hedef.scrollIntoView({ block: 'start' }); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(hizala);
    addEventListener('load', () => { hizala(); setTimeout(hizala, 120); }, { once: true });
  })();

  // ---- 2) Sol üstteki küçük sayfa etiketi ----
  // Büyük başlık sayfayla birlikte doğal olarak kayar; desteklenen tarayıcıda CSS kaydırma zaman çizelgesiyle
  // (animation-timeline: view()) küçülüp sola kayarak söner — bu, kaydırmayla aynı karede compositor'da çizilir, geride kalmaz.
  // Başlık üst çubuğun altına girince ayrı, sabit (position: fixed) küçük etiket soldan kayarak gelir. Her karede JS yok:
  // IntersectionObserver yalnız eşik geçilince bir sınıf değiştirir.
  const etiket = document.createElement('div');
  etiket.className = 'sayfa-etiket';
  etiket.setAttribute('aria-hidden', 'true');
  etiket.textContent = h1.querySelector('.gizli') ? h1.querySelector('.gizli').textContent : h1.textContent;
  document.body.appendChild(etiket);
  if (!('IntersectionObserver' in window)) return;
  const ust = document.querySelector('header.ust');
  const ustH = ust ? Math.round(ust.getBoundingClientRect().height) : 76;
  new IntersectionObserver((g) => {
    const e = g[g.length - 1];
    // Başlık üst çubuğun altında kaybolduysa (yukarıda kaldıysa) etiket görünür
    etiket.classList.toggle('goster', !e.isIntersecting && e.boundingClientRect.top < ustH);
  }, { rootMargin: '-' + ustH + 'px 0px 0px 0px', threshold: 0 }).observe(h1);
})();
