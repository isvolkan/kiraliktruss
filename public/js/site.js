// Kiralık Truss — sayfa davranışları. Çerçeve yok; her bölüm kendi küçük işlevinde.
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

  // 4b) Hero arka planı: en yeni kurulumdan geriye doğru fotoğraflar, 6 sn'de bir yavaşça geçer.
  // Diğer fotoğraflar sayfa yüklendikten sonra indirilir; hareket azaltma açıksa yalnız ilk fotoğraf kalır.
  (function heroFotolar() {
    //
    // Hız: CSS'teki gri ton + multiply karışımı tarayıcıya her karede bütün hero'yu yeniden hesaplatıyordu
    // (dönen kelime ve kaydırma sırasında takılma). Burada her fotoğraf bir kez tuvale (canvas) mavi boyalı
    // çizilir; ekranda yalnız hazır resimlerin saydamlığı değişir, bu işi ekran kartı yapar.
    const zemin = document.querySelector('.hero-zemin');
    const fotolar = hepsi('.hero-zemin img');
    if (!zemin || azHareket || fotolar.length < 2) return;
    const no = document.querySelector('.hero-kunye-no');
    const ad = document.querySelector('.hero-kunye-isim');
    const stil = getComputedStyle(zemin);
    const isik = stil.getPropertyValue('--hero-isik').trim() || '#2F5BFF';   // fotoğrafın en açık noktası bu renge iner
    const golge = stil.getPropertyValue('--hero-golge').trim() || '#071247'; // en koyu noktası bu renge çıkar
    const tuvaller = [];   // hazır tuvaller (sıra numarasına göre)
    const istenen = [];    // boyaması başlamış olanlar
    let sira = 0;

    // Fotoğrafı indir, çöz ve mavi boyalı tuvale çevir: gri ton → açık maviyle çarp → gölgeler laciverte (CSS'teki görünümün aynısı).
    // Üstüne düz mavi katman binmez: fotoğrafın kendi açık-koyu farkı korunur, ama hiçbir nokta --hero-isik'tan açık olamaz.
    function boya(i) {
      if (istenen[i]) return istenen[i];
      const f = fotolar[i];
      if (!f.getAttribute('src') && f.dataset.src) f.src = f.dataset.src;
      istenen[i] = f.decode().then(() => {
        const olcek = Math.min(1, 1280 / f.naturalWidth);
        const t = document.createElement('canvas');
        t.width = Math.round(f.naturalWidth * olcek);
        // Eski site fotoğraflarının sağ üstünde "www.kiraliktruss.com" filigranı var: üstten %8 kırpılır
        const ust = Math.round(f.naturalHeight * 0.08);
        t.height = Math.round((f.naturalHeight - ust) * olcek);
        const c = t.getContext('2d');
        c.drawImage(f, 0, ust, f.naturalWidth, f.naturalHeight - ust, 0, 0, t.width, t.height);
        c.globalCompositeOperation = 'saturation'; c.fillStyle = '#808080'; c.fillRect(0, 0, t.width, t.height);
        c.globalCompositeOperation = 'multiply'; c.fillStyle = isik; c.fillRect(0, 0, t.width, t.height);
        c.globalCompositeOperation = 'lighten'; c.fillStyle = golge; c.fillRect(0, 0, t.width, t.height);
        zemin.appendChild(t);
        tuvaller[i] = t;
        return t;
      }).catch(() => null); // fotoğraf inmezse o tur atlanır
      return istenen[i];
    }

    function basla() {
      boya(0).then((ilk) => {
        if (!ilk) return;
        ilk.style.transition = 'none'; // ilk tuval geçişsiz gelir, sonra CSS'li ilk fotoğraf gizlenir
        ilk.classList.add('aktif');
        zemin.classList.add('hazir');
        setTimeout(() => { ilk.style.transition = ''; }, 100);
        setTimeout(() => boya(1), 1500);
        setInterval(() => {
          const sonraki = (sira + 1) % fotolar.length;
          if (!tuvaller[sonraki]) { boya(sonraki); return; } // henüz hazır değilse bu turu atla
          tuvaller[sira].classList.remove('aktif');
          tuvaller[sonraki].classList.add('aktif');
          sira = sonraki;
          if (no) no.textContent = (sira + 1) + ' / ' + fotolar.length;
          if (ad) ad.textContent = fotolar[sira].dataset.kunye;
          setTimeout(() => boya((sira + 1) % fotolar.length), 2500); // sıradakini geçiş bitince, boştayken hazırla
        }, 6000);
      });
    }
    if (document.readyState === 'complete') basla(); else window.addEventListener('load', basla);
  })();

  // 5) Son kurulumlar şeridi: kendiliğinden akan sonsuz şerit. Ray, kartların önüne ve arkasına eklenen birer kopyayla
  // transform ile kayar; bir tur dolunca konum bir tur geri sarılır, göz fark etmez. Üstüne gelince akış durur; fareyle /
  // parmakla sürüklenir, bırakınca kayarak yavaşlar; ← → bir kart ilerletir; yatay tekerlek çalışır.
  // Faresi olan cihazda üstüne gelinen (ya da klavyeyle odaklanılan) kart büyür, diğerleri küçülüp solar (CSS: ray.secili,
  // li.one). Yalnız .kart'ın transform ve opacity'si değişir; li'lerin yeri ve ölçüleri, dolayısıyla ölçümler hiç değişmez.
  // Başa sarmada sınıf, farenin altına gelen kopyaya geçişsiz taşınır (nabız olmasın).
  (function serit() {
    const kap = document.querySelector('.serit');
    const ray = kap && kap.querySelector('.serit-ray');
    if (!ray) return;
    const asil = Array.from(ray.children);
    const n = asil.length;
    if (n < 2) return;

    // Kopyalar ekran okuyucudan ve klavyeden gizli
    function kopya() {
      const parca = document.createDocumentFragment();
      asil.forEach((li) => {
        const k = li.cloneNode(true);
        k.setAttribute('aria-hidden', 'true');
        k.querySelectorAll('a').forEach(a => { a.tabIndex = -1; });
        k.querySelectorAll('img').forEach(im => { im.loading = 'lazy'; });
        parca.appendChild(k);
      });
      return parca;
    }
    ray.insertBefore(kopya(), ray.firstChild);
    ray.appendChild(kopya());
    const kartlar = Array.from(ray.children);
    const fare = window.matchMedia('(hover: hover) and (pointer: fine)');
    const oto = azHareket ? 0 : Number(kap.dataset.oto || 0);

    // Ray içindeki konum (transform'dan bağımsız, kesirli piksel)
    const rayKonum = () => ray.getBoundingClientRect().left;
    const sol = (el) => el.getBoundingClientRect().left - rayKonum();

    let tur = 0;       // bir tam turun genişliği (durağan hâlde ölçülür)
    let adim = 0;      // bir kartın kapladığı yer (kart + boşluk)
    let kapW = 0;
    let pencere = 0;   // durağan hâlde x, [pencere, pencere + tur) aralığında tutulur: görünenin ortası asıl kartlar
    let olcBekle = false;
    function olc() {
      tur = sol(kartlar[2 * n]) - sol(kartlar[n]);
      adim = sol(kartlar[n + 1]) - sol(kartlar[n]);
      kapW = kap.clientWidth;
      pencere = tur - kapW / 2;
      olcBekle = false;
    }
    olc();
    // Başlangıç: ilk asıl kart başlıkla aynı hizada
    const bas = kap.closest('section').querySelector('.bolum-bas');
    const ilkX = () => sol(kartlar[n]) - (bas ? bas.getBoundingClientRect().left - kap.getBoundingClientRect().left : 0);
    const sar = (v) => pencere + ((((v - pencere) % tur) + tur) % tur); // konumu [pencere, pencere + tur) aralığına sarar
    let x = ilkX();
    // Yalnız genişlik değişince yeniden ölç: iOS Safari dikey kaydırırken adres çubuğu küçülüp büyüdükçe resize gönderir
    // (yükseklik değişir); her seferinde yeniden kurulan şerit yana sıçrıyordu.
    let sonGen = kap.clientWidth;
    window.addEventListener('resize', () => { const g = kap.clientWidth; if (g !== sonGen) { sonGen = g; olcBekle = true; } });

    let hiz = 0;          // bırakıldıktan sonraki savrulma hızı (piksel/sn)
    let kalan = 0;        // oklarla / odakla istenen, henüz gidilmemiş yol
    let tutuluyor = false, suruklenen = 0, ustunde = false, odakta = false, odakKart = null;
    let px = -1, py = -1, sonTekerlek = -1e9;
    let gorunur = true;
    let son = performance.now();

    // Öne çıkan kart
    let acik = null, sonIsabet = -1e9;
    function ac(li) {
      if (li === acik) return;
      if (acik) acik.classList.remove('one');
      if (li) li.classList.add('one');
      ray.classList.toggle('secili', !!li);
      acik = li;
    }
    // Başa sarma: ray k tur kaydı, farenin altına açık kartın kopyası geldi. Sınıfı ona geçişsiz taşı.
    function tasi(k) {
      const yeni = kartlar[kartlar.indexOf(acik) - k * n];
      if (!yeni) { ac(null); return; }
      const a = acik.firstElementChild, b = yeni.firstElementChild;
      a.style.transition = b.style.transition = 'none';
      acik.classList.remove('one'); yeni.classList.add('one'); acik = yeni;
      void ray.offsetWidth;
      a.style.transition = b.style.transition = '';
    }

    // Öne çıkacak kart: farenin altındaki (sürüklerken, savrulurken ve tekerlekten hemen sonra yok) ya da klavye odağındaki.
    // Fare iki kart arasındaki boşluktaysa son kart kısa süre korunur: komşuya geçerken şerit bir an normale dönüp titremesin.
    function hedefKart(simdi) {
      if (!fare.matches || (tutuluyor && suruklenen > 6) || hiz || simdi - sonTekerlek < 300) return null;
      if (ustunde) {
        const el = document.elementFromPoint(px, py);
        const li = el && ray.contains(el) ? el.closest('.serit-ray > li') : null;
        if (li) { sonIsabet = simdi; return li; }
        if (acik && acik !== odakKart && simdi - sonIsabet < 220) return acik;
      }
      return odakKart;
    }

    // Kendiliğinden akış: tarayıcının compositor'ında çalışan sonsuz bir Web Animation. Ana iş parçacığı meşgulken
    // (hero fotoğraf geçişi, görsel çözme, rakam rulosu) bile akış takılmaz; JS her karede transform yazmaz.
    // Etkileşim (üstüne gelme, sürükleme, ok, tekerlek, odak) başlayınca animasyon durdurulur ve konum JS'e geçer;
    // etkileşim bitince kaldığı yerden yeniden oynar. Animasyon yoksa (eski tarayıcı) eski yol: JS her karede kaydırır.
    // Ray değil, her kart ayrı ayrı (aynı animasyon, aynı başlangıç zamanı) kayar: ray binlerce piksel genişliğinde tek bir
    // katman olurdu; iOS Safari onu karolar hâlinde çizerken yetişemiyor, kayarken titriyordu. Kart başına küçük katman sorunsuz.
    let akisAnim = null, akisSure = 0;
    function grup(animler) {
      return {
        get playState() { return animler[0].playState; },
        get currentTime() { return animler[0].currentTime; },
        set currentTime(t) { animler.forEach(a => { a.currentTime = t; }); },
        // Hepsi aynı başlangıç zamanıyla oynar: kartlar arasında bir kare bile kayma olmaz
        play() { const t = Number(animler[0].currentTime) || 0; const bas = document.timeline.currentTime - t; animler.forEach(a => { a.startTime = bas; }); },
        pause() { animler.forEach(a => a.pause()); },
        cancel() { animler.forEach(a => a.cancel()); },
      };
    }
    function akisKur() {
      if (akisAnim) { akisAnim.cancel(); akisAnim = null; }
      if (!oto || !tur || typeof ray.animate !== 'function' || !document.timeline) return;
      akisSure = tur / oto * 1000;
      const kf = [{ transform: 'translate3d(' + (-pencere) + 'px,0,0)' }, { transform: 'translate3d(' + (-(pencere + tur)) + 'px,0,0)' }];
      akisAnim = grup(kartlar.map(li => li.animate(kf, { duration: akisSure, iterations: Infinity })));
      akisAnim.pause();
      akisAnim.currentTime = (x - pencere) / tur * akisSure;
      ray.style.transform = '';
    }
    const akisX = () => pencere + ((Number(akisAnim.currentTime) || 0) % akisSure) / akisSure * tur;
    // Kullanıcı x'i doğrudan değiştirmeden önce: akış oynuyorsa konumu ondan al ve durdur
    function akisDurdur() { if (akisAnim && akisAnim.playState === 'running') { x = akisX(); akisAnim.pause(); } }

    function kare(simdi) {
      const dt = Math.min(0.05, (simdi - son) / 1000);
      son = simdi;
      if (gorunur && !document.documentElement.classList.contains('tema-anlik')) {
        // WebKit (iOS Safari) betik çalıştığında yerleşimi henüz bitirmemiş olabiliyor: ilk ölçüm 0 çıkarsa burada yeniden ölç
        if (olcBekle || !tur) {
          akisDurdur(); // akış oynuyorsa x eskidir: önce gerçek konumu animasyondan al
          const ilk = !tur, oran = tur ? (x - pencere) / tur : 0;
          olc();
          if (tur) { x = ilk ? sar(ilkX()) : pencere + oran * tur; akisKur(); }
        }
        ac(hedefKart(simdi));
        const serbest = !((tutuluyor && !yonBekle) || ustunde || odakta || kalan || hiz);
        if (akisAnim && serbest) {
          if (akisAnim.playState !== 'running') { akisAnim.currentTime = (x - pencere) / tur * akisSure; akisAnim.play(); }
        } else {
          if (akisAnim && akisAnim.playState === 'running') { x = akisX(); akisAnim.pause(); }
          if (!tutuluyor) {
            const git = kalan * Math.min(1, dt * 7);
            kalan -= git;
            if (Math.abs(kalan) < 0.5) kalan = 0;
            const akis = (!serbest || akisAnim) ? 0 : oto;
            x += git + hiz * dt + akis * dt;
            hiz *= Math.pow(0.04, dt);
            if (Math.abs(hiz) < 4) hiz = 0;
          }
          if (tur) {
            const sarilmis = pencere + ((((x - pencere) % tur) + tur) % tur);
            const k = Math.round((x - sarilmis) / tur);
            x = sarilmis;
            if (k && acik && acik !== odakKart) tasi(k);
          }
          if (akisAnim) akisAnim.currentTime = (x - pencere) / tur * akisSure;
          else ray.style.transform = 'translate3d(' + (-x).toFixed(2) + 'px,0,0)';
        }
      } else if (!gorunur && akisAnim && akisAnim.playState === 'running') {
        x = akisX(); akisAnim.pause(); // ekran dışındayken akış dursun (pil ve GPU)
      }
      requestAnimationFrame(kare);
    }
    if (tur) { const sarilmis = pencere + ((((x - pencere) % tur) + tur) % tur); x = sarilmis; }
    ray.style.transform = 'translate3d(' + (-x).toFixed(2) + 'px,0,0)';
    akisKur();
    requestAnimationFrame(kare);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((g) => { gorunur = g[g.length - 1].isIntersecting; }).observe(kap);
    }

    // Sürükleme (fare ve parmak). 6 pikselden fazla sürüklendiyse karta tıklama sayılmaz ve büyüme kapanır.
    // Dokunmatikte parmak şeridin üstündeyken sayfa dikey kaydırılabilir: yön belli olana dek (ilk 8 px) şerit kıpırdamaz;
    // hareket dikeyse sürükleme hiç başlamaz, akış kaldığı yerden sürer.
    let basX = 0, basY = 0, sonPX = 0, sonPT = 0, yonBekle = false;
    kap.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      tutuluyor = true; suruklenen = 0; hiz = 0; kalan = 0;
      yonBekle = e.pointerType !== 'mouse';
      if (!yonBekle) akisDurdur();
      basX = sonPX = e.clientX; basY = e.clientY; sonPT = performance.now();
    });
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') { px = e.clientX; py = e.clientY; }
      if (!tutuluyor) return;
      if (yonBekle) {
        const dx = Math.abs(e.clientX - basX), dy = Math.abs(e.clientY - basY);
        if (dx < 8 && dy < 8) return;
        if (dy >= dx) { tutuluyor = false; yonBekle = false; return; } // dikey kaydırma: şeride dokunma
        yonBekle = false; akisDurdur(); sonPX = e.clientX; sonPT = performance.now();
      }
      suruklenen = Math.max(suruklenen, Math.abs(e.clientX - basX));
      if (suruklenen > 6) kap.classList.add('tutuluyor');
      x -= e.clientX - sonPX;
      const t = performance.now();
      if (t > sonPT) hiz = hiz * 0.6 + (-(e.clientX - sonPX) / ((t - sonPT) / 1000)) * 0.4;
      sonPX = e.clientX; sonPT = t;
    });
    function birak() {
      if (!tutuluyor) return;
      if (yonBekle) { tutuluyor = false; yonBekle = false; return; } // yalnız dokunup bıraktı
      tutuluyor = false;
      kap.classList.remove('tutuluyor');
      if (suruklenen <= 6 || performance.now() - sonPT > 120) hiz = 0; // tıklama ya da durup bırakma: savrulma yok
      hiz = Math.max(-3500, Math.min(3500, hiz));
    }
    window.addEventListener('pointerup', birak);
    window.addEventListener('pointercancel', birak);
    kap.addEventListener('click', (e) => { if (suruklenen > 6) { e.preventDefault(); e.stopPropagation(); } }, true);
    kap.addEventListener('dragstart', (e) => e.preventDefault());

    // Yatay tekerlek / dokunmatik yüzey
    kap.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      akisDurdur(); x += e.deltaX; hiz = 0; kalan = 0;
      sonTekerlek = performance.now();
    }, { passive: false });

    kap.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { ustunde = true; px = e.clientX; py = e.clientY; } });
    kap.addEventListener('pointerleave', () => { ustunde = false; });

    // Oklar: bir kart ileri / geri
    hepsi('[data-serit]').forEach(d => d.addEventListener('click', () => {
      hiz = 0; kalan += Number(d.dataset.serit) * adim;
    }));

    // Klavye: tarayıcı kabı kaydırmasın; odaklanılan kartı biz ortaya getiririz (asıl kartlar hep görünenin ortasında)
    kap.addEventListener('focusin', (e) => {
      kap.scrollLeft = 0;
      const li = e.target.closest('.serit-ray > li');
      if (!li) return;
      let klavye = true;
      try { klavye = e.target.matches(':focus-visible'); } catch (_) { /* eski tarayıcı: klavye say */ }
      odakta = true; odakKart = klavye ? li : null;
      const k = li.getBoundingClientRect(), c = kap.getBoundingClientRect();
      hiz = 0; kalan = (k.left + k.width / 2) - (c.left + c.width / 2);
    });
    kap.addEventListener('focusout', () => { odakta = false; odakKart = null; });
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
      dugme.href = '/teklif' + (gecerli ? '?metretul=' + sonuc : '');
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

  // 10) Teklif formu hatalıysa (422) ilk hatalı alana, hız sınırında (429) uyarı metnine odaklan ve görünür alana kaydır
  (function hataliAlan() {
    const form = document.querySelector('form[data-hatali]');
    const ilk = (form && form.querySelector('[aria-invalid="true"]')) || document.querySelector('.genel-hata[tabindex="-1"]');
    if (!ilk) return;
    try { ilk.focus({ preventScroll: true }); } catch (e) { ilk.focus(); }
    const kucult = matchMedia('(prefers-reduced-motion: reduce)').matches;
    ilk.scrollIntoView({ block: 'center', behavior: kucult ? 'auto' : 'smooth' });
  })();

  // 11) Yapışık üst çubuk: sayfa biraz kayınca altına çizgi/gölge gelir (html.kaydi)
  (function ustCubuk() {
    const k = document.documentElement;
    let kayik = null;
    const bak = () => { const v = scrollY > 8; if (v !== kayik) { kayik = v; k.classList.toggle('kaydi', v); } };
    addEventListener('scroll', bak, { passive: true });
    bak();
  })();

  // 12) Açık / karanlık mod. Seçim localStorage'da; ilk açılışta sistem tercihi (erken.js). View Transitions varsa
  // yeni tema düğmeden büyüyen bir daireyle açılır; yoksa renkler yumuşakça geçer.
  (function tema() {
    const k = document.documentElement;
    const dugme = document.querySelector('.tema-dugme');
    if (!dugme) return;
    const yaz = () => {
      const koyu = k.dataset.tema === 'koyu';
      dugme.setAttribute('aria-pressed', String(koyu));
      dugme.setAttribute('aria-label', koyu ? 'Açık moda geç' : 'Karanlık moda geç');
    };
    yaz();
    function uygula(t) {
      k.dataset.tema = t;
      try { localStorage.setItem('v6-tema', t); } catch (_) { /* kayıt yoksa yalnız bu sayfa */ }
      yaz();
    }
    dugme.addEventListener('click', () => {
      const yeni = k.dataset.tema === 'koyu' ? 'acik' : 'koyu';
      if (azHareket) { uygula(yeni); return; }
      if (!document.startViewTransition) {
        k.classList.add('tema-gecis');
        uygula(yeni);
        setTimeout(() => k.classList.remove('tema-gecis'), 450);
        return;
      }
      const r = dugme.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const yari = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy));
      // Geçiş sürerken sayfadaki öteki animasyonlar (şerit, hero) durur: yeni görünüm canlı bir katman olduğundan
      // her karede yeniden çizilmesinler. Tema değişimi sırasında CSS geçişleri de kapalı (html.tema-anlik).
      // Dönen kelime (fuar için / stand için...) hariç: o an değişiyorsa animasyonu yarıda kesilmesin
      const duranlar = document.getAnimations().filter(a => a.playState === 'running' && !(a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.donen')));
      duranlar.forEach(a => a.pause());
      k.classList.add('tema-anlik');
      const gecis = document.startViewTransition(() => uygula(yeni));
      gecis.ready.then(() => {
        k.animate({ clipPath: ['circle(0px at ' + cx + 'px ' + cy + 'px)', 'circle(' + yari + 'px at ' + cx + 'px ' + cy + 'px)'] },
          { duration: 520, easing: 'cubic-bezier(.3,.6,.2,1)', pseudoElement: '::view-transition-new(root)' });
      }).catch(() => {});
      gecis.finished.finally(() => { k.classList.remove('tema-anlik'); duranlar.forEach(a => { try { a.play(); } catch (_) {} }); });
    });
    // Kullanıcı hiç seçmediyse sistem teması değişince izle
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const izle = (e) => { let kayitli = null; try { kayitli = localStorage.getItem('v6-tema'); } catch (_) {} if (!kayitli) { k.dataset.tema = e.matches ? 'koyu' : 'acik'; yaz(); } };
    if (mq.addEventListener) mq.addEventListener('change', izle);
  })();

  // 13) Footer perdesi: sayfa içeriği bir perde gibi yukarı kalkar, altındaki footer açılır; dev imzanın harfleri açıldıkça
  // sırayla aşağıdan yükselir. Hareketin kendisi CSS'te (kaydırma zaman çizelgesi, compositor): JS yalnız ölçer ve perdeyi
  // açıp kapatır (yükleme ve yeniden boyutlandırmada). Footer ekrana sığmıyorsa (telefon, kısa pencere) perde yok; harfler yine yükselir.
  (function footerPerde() {
    const alt = document.querySelector('footer.alt');
    if (!alt || azHareket) return;
    const k = document.documentElement;
    // Kaydırma animasyonları (perde-ic, perde-harf): --alt-h ya da perde değişince Chrome aralığı eski değerle tutabiliyor.
    // Sayfa en alttayken yenilenince (F5) harfler yarı yolda kalıp aşağı kayık görünüyordu; ölçü değişince yeniden kurulur.
    const hareketliler = alt.querySelectorAll('.ic, .dev-imza .harf');
    function yenidenKur() {
      hareketliler.forEach((e) => { e.style.animation = 'none'; });
      void alt.offsetWidth;
      hareketliler.forEach((e) => { e.style.animation = ''; });
    }
    let sonH = -1, sonPerde = null;
    function olc() {
      // Footer sabitken de yüksekliği aynıdır; ölçmek için perdeyi kaldırmaya gerek yok (kaldırmak sayfayı kısaltıp
      // kaydırma konumunu yukarı itiyordu)
      const altH = alt.offsetHeight;
      const perde = altH <= innerHeight - 40 && innerWidth >= 768;
      k.style.setProperty('--alt-h', altH + 'px');
      k.classList.toggle('perde', perde);
      if (altH !== sonH || perde !== sonPerde) { yenidenKur(); sonH = altH; sonPerde = perde; }
    }
    // Telefon/dokunmatik için tek seferlik açılış (CSS .alt-acildi): footer'ın %15'i görünür olunca
    if ('IntersectionObserver' in window) {
      const g = new IntersectionObserver((e) => { if (e.some(x => x.isIntersecting)) { alt.classList.add('alt-acildi'); g.disconnect(); } }, { threshold: 0.15 });
      g.observe(alt);
    } else alt.classList.add('alt-acildi');
    let bekle = 0;
    addEventListener('resize', () => { clearTimeout(bekle); bekle = setTimeout(olc, 150); });
    addEventListener('load', olc);
    olc();
  })();

  // 13b) Çalışma fotoğrafı ışık kutusu: bağlantı JS yokken resmi doğrudan açar; burada yerel dialog ile tam boy gösterilir
  (function fotoKutu() {
    const t = document.querySelector('[data-foto-ac]');
    const kutu = document.querySelector('dialog.foto-kutu');
    if (!t || !kutu || typeof kutu.showModal !== 'function') return;
    const img = kutu.querySelector('img');
    const kapat = kutu.querySelector('.foto-kapat');
    t.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return; // yeni sekmede açma isteği bozulmasın
      e.preventDefault();
      if (!img.getAttribute('src')) img.src = img.dataset.src;
      kutu.showModal();
      kapat.focus();
    });
    kapat.addEventListener('click', () => kutu.close());
    // Arka plana (dialog'un kendisine) ya da resme tıklayınca kapanır
    kutu.addEventListener('click', (e) => { if (e.target === kutu || e.target === img) kutu.close(); });
    kutu.addEventListener('close', () => t.focus());
  })();

  // 14) Yukarı çık düğmesi: bir ekran boyu aşağı inince belirir; basınca başa yumuşakça kayar
  (function yukari() {
    const d = document.querySelector('.yukari');
    if (!d) return;
    const k = document.documentElement;
    let acik = null;
    const bak = () => {
      const v = scrollY > innerHeight * 0.9;
      if (v === acik) return;
      acik = v; k.classList.toggle('yukari-var', v); d.tabIndex = v ? 0 : -1;
    };
    addEventListener('scroll', bak, { passive: true });
    bak();
    d.addEventListener('click', () => {
      scrollTo({ top: 0, behavior: azHareket ? 'auto' : 'smooth' });
      d.blur(); // düğme kaybolurken odak onda kalmasın
    });
  })();
})();
