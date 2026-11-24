// Altıncı sürüm (v6): v5 "yön tabelası" tasarımının devamı: aynı rotalar ve veritabanı; görünümler views/v6, varlıklar public/v6.
// Burada yalnız v6'in fazladan istediği veriler eklenir; asıl sayfalar routes/site.js'ten gelir.
const express = require('express');
const pool = require('../db/pool');
const { ETKINLIK_TURLERI } = require('../validators');

const v6 = express.Router();

v6.use((req, res, next) => {
  const ciz = res.render.bind(res);
  res.render = (gorunum, ...geri) => ciz('v6/' + gorunum, ...geri); // görünümler views/v6 altından
  res.locals.kok = '/v6';
  res.locals.yol = req.path;
  res.locals.turler = ETKINLIK_TURLERI; // ana sayfadaki mini form için
  next();
});

// Ana sayfa "Kurulum yaptığımız işlerden" ızgarası: fotoğrafı olan projelerden ayrı müşteri adları, en yeni 12
v6.get('/', async (req, res, next) => {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (musteri) musteri, id, yil FROM projeler
     WHERE musteri <> '' AND gorsel IS NOT NULL
     ORDER BY musteri, yil DESC NULLS LAST, id DESC`);
  rows.sort((a, b) => (b.yil || 0) - (a.yil || 0) || b.id - a.id); // en yeni üstte
  res.locals.musteriler = rows.slice(0, 12).map(r => ({ ad: r.musteri, id: r.id, yil: r.yil }));

  // Hero arka planı ve "Son kurulumlardan" şeridi tek sorgudan: en yeni kurulumdan geriye doğru (yıl, sonra eklenme sırası),
  // aynı müşteriden yalnız en yeni iş. İlk 6'sı hero'da döner; şerit onları yinelemez, sonraki 12'yi gösterir.
  // Yönetim panelinden eklenen yeni proje kendiliğinden başa geçer.
  const yeni = await pool.query(
    `SELECT id, musteri, etkinlik, sehir, yil FROM (
       SELECT DISTINCT ON (musteri) id, musteri, etkinlik, sehir, yil, olusturma FROM projeler
       WHERE gorsel IS NOT NULL ORDER BY musteri, yil DESC NULLS LAST, olusturma DESC, id DESC) tekil
     ORDER BY yil DESC NULLS LAST, olusturma DESC, id DESC LIMIT 18`);
  res.locals.heroFotolar = yeni.rows.slice(0, 6);
  res.locals.seritProjeler = yeni.rows.slice(6);
  next();
});

// Çalışmalar sayfasındaki tür levhalarının sayıları
v6.get('/calismalar', async (req, res, next) => {
  const { rows } = await pool.query('SELECT tur, count(*)::int AS n FROM projeler GROUP BY tur');
  const sayi = { tumu: 0, fuar: 0, etkinlik: 0, kurumsal: 0 };
  for (const r of rows) { sayi[r.tur] = r.n; sayi.tumu += r.n; }
  res.locals.turSayilari = sayi;
  next();
});

// Hakkımızda dönen fotoğrafı: fotoğrafı olan işlerden müşteri başına bir tane, 12 kare, her açılışta karışık sıra
// (sunucu karıştırır: ilk kare de her seferinde farklı olur, JS kapalıyken de rastgele bir fotoğraf görünür).
// Eski sitenin kendi Hakkımızda bölümündeki iş (Maschio Gaspardo, Bursa Tarım) her zaman aralarında; ada bağlı, numaraya değil.
// Hiç fotoğraf yoksa sayfa fotoğrafsız çizilir.
const GOSTERI_SAYI = 12;
v6.get('/hakkimizda', async (req, res, next) => {
  const sabit = await pool.query(
    `SELECT id, musteri, etkinlik, sehir, yil FROM projeler
     WHERE musteri = 'Maschio Gaspardo' AND etkinlik = 'Bursa Tarım' AND gorsel IS NOT NULL ORDER BY id LIMIT 1`);
  const digerleri = await pool.query(
    `SELECT * FROM (
       SELECT DISTINCT ON (musteri) id, musteri, etkinlik, sehir, yil FROM projeler
       WHERE gorsel IS NOT NULL AND musteri <> '' AND musteri <> 'Maschio Gaspardo'
       ORDER BY musteri, yil DESC NULLS LAST, id DESC) tekil
     ORDER BY random() LIMIT $1`, [GOSTERI_SAYI - sabit.rows.length]);
  const kareler = [...sabit.rows, ...digerleri.rows];
  for (let i = kareler.length - 1; i > 0; i--) { // karıştır (Fisher–Yates)
    const j = Math.floor(Math.random() * (i + 1));
    [kareler[i], kareler[j]] = [kareler[j], kareler[i]];
  }
  // künyenin ikinci satırı: etkinlik adı şehirle aynıysa yinelenmez
  res.locals.gosteri = kareler.map(k => ({
    id: k.id, musteri: k.musteri,
    alt: [k.etkinlik && k.etkinlik !== k.sehir ? k.etkinlik : k.sehir, k.yil].filter(Boolean).join(' · '),
  }));
  next();
});

// Teklif formu: ana sayfadaki mini formdan, hesaplayıcıdan ya da bir çalışmadan (ref) gelen değerlerle ön doldurulur.
// Yalnız geçerli görünen değerler alınır; geri kalanı sessizce yok sayılır.
v6.get('/teklif', async (req, res) => {
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

v6.use(require('./site')); // aynı rotalar ve veritabanı
v6.use((req, res) => res.status(404).render('404', { baslik: 'Sayfa bulunamadı' }));
v6.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).render('hata', { baslik: 'Bir sorun oluştu' });
});

module.exports = v6;
