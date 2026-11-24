// Beşinci sürüm (v5, "yön tabelası" tasarımı): aynı rotalar ve veritabanı; görünümler views/v5, varlıklar public/v5.
// Burada yalnız v5'in fazladan istediği veriler eklenir; asıl sayfalar routes/site.js'ten gelir.
const express = require('express');
const pool = require('../db/pool');
const { ETKINLIK_TURLERI } = require('../validators');

const v5 = express.Router();

v5.use((req, res, next) => {
  const ciz = res.render.bind(res);
  res.render = (gorunum, ...geri) => ciz('v5/' + gorunum, ...geri); // görünümler views/v5 altından
  res.locals.kok = '/v5';
  res.locals.yol = req.path;
  res.locals.turler = ETKINLIK_TURLERI; // ana sayfadaki mini form için
  next();
});

// Ana sayfa "Kimler için kurduk?" listesi: fotoğrafı olan projelerden ayrı müşteri adları, en yeni 36
v5.get('/', async (req, res, next) => {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (musteri) musteri, id, yil FROM projeler
     WHERE musteri <> '' AND gorsel IS NOT NULL
     ORDER BY musteri, yil DESC NULLS LAST, id DESC`);
  rows.sort((a, b) => (b.yil || 0) - (a.yil || 0) || b.id - a.id); // en yeni üstte
  res.locals.musteriler = rows.slice(0, 36).map(r => ({ ad: r.musteri, id: r.id }));
  next();
});

// Çalışmalar sayfasındaki tür levhalarının sayıları
v5.get('/calismalar', async (req, res, next) => {
  const { rows } = await pool.query('SELECT tur, count(*)::int AS n FROM projeler GROUP BY tur');
  const sayi = { tumu: 0, fuar: 0, etkinlik: 0, kurumsal: 0 };
  for (const r of rows) { sayi[r.tur] = r.n; sayi.tumu += r.n; }
  res.locals.turSayilari = sayi;
  next();
});

// Teklif formu: ana sayfadaki mini formdan, hesaplayıcıdan ya da bir çalışmadan (ref) gelen değerlerle ön doldurulur.
// Yalnız geçerli görünen değerler alınır; geri kalanı sessizce yok sayılır.
v5.get('/teklif', async (req, res) => {
  const q = req.query;
  const metretul = parseInt(q.metretul, 10);
  const tek = (v) => (typeof v === 'string' ? v : ''); // ?a=1&a=2 gibi dizileri yok say
  const deger = {
    metretul: metretul >= 1 && metretul <= 5000 ? metretul : '',
    gun_sayisi: 1,
    kurulum: 'on',
    etkinlik_turu: ETKINLIK_TURLERI.includes(tek(q.etkinlik_turu)) ? q.etkinlik_turu : '',
    tarih: /^\d{4}-\d{2}-\d{2}$/.test(tek(q.tarih)) ? q.tarih : '',
    sehir: tek(q.sehir).trim().slice(0, 60),
    mesaj: '',
  };
  const ref = Number(q.ref);
  if (Number.isInteger(ref) && ref > 0 && ref < 2147483647) {
    const { rows } = await pool.query('SELECT musteri, etkinlik FROM projeler WHERE id = $1', [ref]);
    if (rows[0]) {
      res.locals.ornek = { musteri: rows[0].musteri, etkinlik: rows[0].etkinlik };
      deger.mesaj = 'Örnek gösterdiğim iş: ' + rows[0].musteri + (rows[0].etkinlik ? ' — ' + rows[0].etkinlik : '');
    }
  }
  res.render('teklif', { baslik: 'Teklif iste', turler: ETKINLIK_TURLERI, hatalar: {}, deger });
});

v5.use(require('./site')); // aynı rotalar ve veritabanı
v5.use((req, res) => res.status(404).render('404', { baslik: 'Sayfa bulunamadı' }));
v5.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).render('hata', { baslik: 'Bir sorun oluştu' });
});

module.exports = v5;
