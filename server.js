// Sunucuyu başlatır. Hangi klasörden çalıştırılırsa çalıştırılsın .env bu klasörden okunsun.
process.chdir(__dirname);
const app = require('./app');
const gocCalistir = require('./db/goc');
const port = process.env.PORT || 3000;

// Önce veritabanı göçleri, sonra dinlemeye başla (göç hata verirse sunucu açılmaz, hata görünür kalır)
gocCalistir()
  .then(() => app.listen(port, () => {
    console.log(`Kiralık Truss http://localhost:${port} adresinde çalışıyor`);
    // Görsel önbelleğini arka planda doldur (beklenmez; hata yalnız loglanır)
    if (process.env.NODE_ENV !== 'test') require('./lib/gorsel-onbellek').aciliset().catch((e) => console.error('Görsel ısıtma hatası:', e.message));
  }))
  .catch((err) => { console.error('Göç hatası, sunucu başlatılmadı:', err); process.exit(1); });
