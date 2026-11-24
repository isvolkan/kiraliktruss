// Yalnız geliştirmede: views/ ya da public/ altında bir dosya değişince açık sayfalar kendini yeniler.
// Açmak için: CANLI_YENILE=1 node --watch server.js   (canlıda ve testlerde kapalı kalır)
// CSS değişince sayfa yeniden yüklenmez, yalnız stil dosyaları tazelenir.
//
// Neden sürekli açık bağlantı (EventSource) değil de kısa sorgu: tarayıcı aynı adrese en fazla 6 bağlantı
// açar. Her sekme bir bağlantıyı sürekli tutunca 7. sekme hiç yüklenmiyor, site "donmuş" gibi görünüyordu
// (2026-11-15'te ölçüldü). Kısa sorgu bağlantıyı hemen bırakır; gizli sekmeler hiç sormaz.
const fs = require('fs');
const path = require('path');

module.exports = function canliYenile(app, kok) {
  // Sunucu her açılışta yeni bir kimlik alır: node --watch yeniden başlatınca sayfalar da yenilenir.
  const acilis = Date.now().toString(36);
  let surum = 0;
  let sonTur = 'sayfa';
  let zamanlayici = null;

  for (const klasor of ['views', 'public']) {
    fs.watch(path.join(kok, klasor), { recursive: true }, (olay, dosya) => {
      if (!dosya || dosya.includes('uploads')) return;
      clearTimeout(zamanlayici); // bir kayıtta gelen birden çok olayı tek yenilemeye indir
      zamanlayici = setTimeout(() => {
        sonTur = dosya.endsWith('.css') ? 'css' : 'sayfa';
        surum++;
      }, 120);
    });
  }

  app.get('/__canli', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ k: `${acilis}-${surum}`, tur: sonTur });
  });

  app.get('/__canli.js', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.type('application/javascript').send(`(() => {
  let ilk = null;
  const sor = async () => {
    if (document.hidden) return;
    try {
      const r = await fetch('/__canli', { cache: 'no-store' });
      const { k, tur } = await r.json();
      if (ilk === null) { ilk = k; return; }
      if (k === ilk) return;
      const ayniAcilis = k.split('-')[0] === ilk.split('-')[0];
      ilk = k;
      if (ayniAcilis && tur === 'css') {
        document.querySelectorAll('link[rel=stylesheet]').forEach((l) => {
          if (l.href.startsWith(location.origin)) l.href = l.href.replace(/[?&]_c=\\d+/, '') + (l.href.includes('?') ? '&' : '?') + '_c=' + Date.now();
        });
      } else location.reload();
    } catch (e) { /* sunucu yeniden başlıyor; bir sonraki sorguda dener */ }
  };
  sor();
  setInterval(sor, 1000);
  document.addEventListener('visibilitychange', sor);
})();`);
  });

  // HTML cevaplarının sonuna istemci betiğini ekle (CSP 'self' olduğu için ayrı dosya olarak)
  app.use((req, res, next) => {
    const gonder = res.send.bind(res);
    res.send = (govde) => {
      if (typeof govde === 'string' && govde.includes('</body>')) {
        govde = govde.replace('</body>', '<script src="/__canli.js"></script></body>');
      }
      return gonder(govde);
    };
    next();
  });

  console.log('Canlı yenileme açık (views/ ve public/ izleniyor)');
};
