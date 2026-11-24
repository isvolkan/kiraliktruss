// Ziyaretçiye açık sayfalar: ana sayfa, hakkımızda, çalışmalar, teklif formu, iletişim.
const express = require('express');
const rateLimit = require('express-rate-limit');
const { validationResult, matchedData } = require('express-validator');
const pool = require('../db/pool');
const { teklifKurallari, ETKINLIK_TURLERI } = require('../validators');

const router = express.Router();
const SAYFA_BOYU = 24;

// Ana sayfa: öne çıkan projeler + sayılar + fuar adları bandı
router.get('/', async (req, res) => {
  const [oneCikan, sayilar, fuarlar] = await Promise.all([
    pool.query(`SELECT id, musteri, etkinlik, sehir, yil, tur FROM projeler
                WHERE one_cikan ORDER BY yil DESC NULLS LAST, id DESC LIMIT 8`),
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

router.get('/hakkimizda', (req, res) => res.render('hakkimizda', { baslik: 'Hakkımızda' }));
router.get('/iletisim', (req, res) => res.render('iletisim', { baslik: 'İletişim' }));

// Örnek çalışmalar: yıl / şehir / tür süzgeci, arama, ızgara-liste görünümü, sayfalama
router.get('/calismalar', async (req, res) => {
  const { tur = '', sehir = '', yil = '', q = '' } = req.query;
  const gorunum = req.query.gorunum === 'liste' ? 'liste' : 'izgara';
  const sayfa = Math.max(1, parseInt(req.query.sayfa, 10) || 1);

  // Parametreli sorgu: kullanıcı girdisi SQL'e doğrudan eklenmez (SQL injection koruması)
  const kosullar = [];
  const degerler = [];
  if (['fuar', 'etkinlik', 'kurumsal'].includes(tur)) { degerler.push(tur); kosullar.push(`tur = $${degerler.length}`); }
  if (sehir) { degerler.push(sehir); kosullar.push(`sehir = $${degerler.length}`); }
  if (/^\d{4}$/.test(yil)) { degerler.push(+yil); kosullar.push(`yil = $${degerler.length}`); }
  if (q.trim()) { degerler.push(`%${q.trim()}%`); kosullar.push(`(musteri ILIKE $${degerler.length} OR etkinlik ILIKE $${degerler.length})`); }
  const where = kosullar.length ? 'WHERE ' + kosullar.join(' AND ') : '';

  const [liste, toplam, secenekler] = await Promise.all([
    pool.query(`SELECT id, musteri, etkinlik, sehir, yil, tur FROM projeler ${where}
                ORDER BY yil DESC NULLS LAST, id DESC LIMIT ${SAYFA_BOYU} OFFSET ${(sayfa - 1) * SAYFA_BOYU}`, degerler),
    pool.query(`SELECT count(*)::int AS n FROM projeler ${where}`, degerler),
    pool.query(`SELECT array_agg(DISTINCT sehir) FILTER (WHERE sehir IS NOT NULL) AS sehirler,
                       array_agg(DISTINCT yil) FILTER (WHERE yil IS NOT NULL) AS yillar FROM projeler`),
  ]);
  const s = secenekler.rows[0];
  res.render('calismalar', {
    baslik: 'Örnek çalışmalar',
    projeler: liste.rows,
    toplam: toplam.rows[0].n,
    sayfa,
    sayfaSayisi: Math.max(1, Math.ceil(toplam.rows[0].n / SAYFA_BOYU)),
    filtre: { tur, sehir, yil, q, gorunum },
    sehirler: (s.sehirler || []).sort((a, b) => a.localeCompare(b, 'tr')),
    yillar: (s.yillar || []).sort((a, b) => b - a),
  });
});

router.get('/calismalar/:id', async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return next();
  const { rows } = await pool.query('SELECT id, musteri, etkinlik, sehir, yil, tur, aciklama FROM projeler WHERE id = $1', [id]);
  if (!rows[0]) return next();
  const benzer = await pool.query(
    `SELECT id, musteri, etkinlik, sehir, yil, tur FROM projeler WHERE id <> $1 AND (tur = $2 OR sehir = $3)
     ORDER BY yil DESC NULLS LAST LIMIT 4`, [id, rows[0].tur, rows[0].sehir]);
  res.render('calisma', { baslik: rows[0].etkinlik ? `${rows[0].musteri} — ${rows[0].etkinlik}` : rows[0].musteri, p: rows[0], benzer: benzer.rows });
});

// Proje fotoğrafını veritabanından verir
router.get('/gorsel/:id', async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return next();
  const { rows } = await pool.query('SELECT gorsel, gorsel_tip, guncelleme FROM projeler WHERE id = $1', [id]);
  if (!rows[0] || !rows[0].gorsel) return res.redirect('/img/gorsel-yok.svg');
  res.set('Content-Type', rows[0].gorsel_tip || 'image/jpeg');
  res.set('Cache-Control', 'public, max-age=86400');
  res.set('Last-Modified', rows[0].guncelleme.toUTCString());
  res.send(rows[0].gorsel);
});

// Teklif formu
router.get('/teklif', (req, res) => {
  const metretul = parseInt(req.query.metretul, 10);
  res.render('teklif', {
    baslik: 'Teklif iste',
    turler: ETKINLIK_TURLERI,
    hatalar: {},
    deger: { metretul: metretul > 0 && metretul <= 5000 ? metretul : '', gun_sayisi: 1, kurulum: 'on' },
  });
});

// Aynı IP'den 15 dakikada en fazla 5 teklif (sahte/otomatik gönderime karşı)
const teklifSiniri = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false,
  handler: (req, res) => res.status(429).render('teklif', {
    baslik: 'Teklif iste', turler: ETKINLIK_TURLERI, deger: req.body,
    hatalar: { genel: 'Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin ya da bizi arayın.' },
  }),
});

router.post('/teklif', teklifSiniri, teklifKurallari, async (req, res) => {
  // Bal küpü (honeypot): insanlar bu gizli alanı görmez; doluysa gönderen bir bottur.
  if (req.body.web_sitesi) return res.redirect(req.baseUrl + '/teklif/tesekkurler');

  const sonuc = validationResult(req);
  if (!sonuc.isEmpty()) {
    const hatalar = {};
    for (const h of sonuc.array()) if (!hatalar[h.path]) hatalar[h.path] = h.msg;
    return res.status(422).render('teklif', { baslik: 'Teklif iste', turler: ETKINLIK_TURLERI, hatalar, deger: req.body });
  }
  const v = matchedData(req);
  await pool.query(
    `INSERT INTO teklifler (ad_soyad, firma, telefon, eposta, etkinlik_turu, sehir, tarih, gun_sayisi, metretul, kurulum, mesaj, kvkk_onay)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)`,
    [v.ad_soyad, v.firma || null, v.telefon, v.eposta, v.etkinlik_turu, v.sehir, v.tarih,
     v.gun_sayisi || 1, v.metretul || null, req.body.kurulum === 'on', v.mesaj || null]
  );
  res.redirect(req.baseUrl + '/teklif/tesekkurler');
});

router.get('/teklif/tesekkurler', (req, res) => res.render('tesekkurler', { baslik: 'Talebiniz alındı' }));

module.exports = router;
