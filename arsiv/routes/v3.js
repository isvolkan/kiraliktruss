// Üçüncü sürüm (v3): v2 ile aynı yöntem. Aynı rotalar (routes/site.js) ve veritabanı; görünümler views/v3,
// varlıklar public/v3. Yalnız ana sayfa burada ayrıca tanımlı: "son kurduklarımız" listesinde aynı proje adı
// iki kez çıkmasın diye öne çıkanlar ada göre tekilleştirilerek çekilir (v1/v2 sorgusuna dokunulmaz).
const express = require('express');
const pool = require('../db/pool');
const izo = require('../public/v3/js/izo');

const v3 = express.Router();

v3.use((req, res, next) => {
  const ciz = res.render.bind(res);
  res.render = (gorunum, ...geri) => ciz('v3/' + gorunum, ...geri);
  res.locals.kok = '/v3';
  res.locals.yol = req.path;
  res.locals.izo = izo; // izometrik çizimler: sunucuda ilk çizim, tarayıcıda aynı dosya canlı çizim
  next();
});

v3.get('/', async (req, res) => {
  const [oneCikan, sayilar, fuarlar] = await Promise.all([
    // Aynı ada sahip öne çıkan projelerden yalnız en yenisi (DISTINCT ON), sonra yeniden eskiye 8 proje
    pool.query(`SELECT id, musteri, etkinlik, sehir, yil, tur FROM (
                SELECT DISTINCT ON (lower(trim(musteri))) id, musteri, etkinlik, sehir, yil, tur FROM projeler
                WHERE one_cikan ORDER BY lower(trim(musteri)), yil DESC NULLS LAST, id DESC
              ) t ORDER BY yil DESC NULLS LAST, id DESC LIMIT 8`),
    pool.query(`SELECT count(*)::int AS proje,
                     count(DISTINCT etkinlik) FILTER (WHERE tur = 'fuar' AND etkinlik <> '')::int AS fuar FROM projeler`),
    pool.query(`SELECT etkinlik, count(*)::int AS n FROM projeler WHERE tur = 'fuar' AND etkinlik <> ''
              GROUP BY etkinlik ORDER BY n DESC LIMIT 14`),
  ]);
  res.render('anasayfa', {
    baslik: 'Truss kiralama',
    projeler: oneCikan.rows,
    sayilar: sayilar.rows[0],
    fuarlar: fuarlar.rows.map(r => r.etkinlik),
  });
});

v3.use(require('./site'));
v3.use((req, res) => res.status(404).render('404', { baslik: 'Sayfa bulunamadı' }));
v3.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).render('hata', { baslik: 'Bir sorun oluştu' });
});

module.exports = v3;
