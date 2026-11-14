// Yönetim paneli: giriş, projeler CRUD, teklif talepleri CRUD. Giriş yapmayan kullanıcı /yonetim/giris'e yönlenir.
const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { validationResult, matchedData } = require('express-validator');
const pool = require('../db/pool');
const { projeKurallari } = require('../validators');

const router = express.Router();

// Fotoğraf yükleme: bellekte tutulur, veritabanına yazılır. En fazla 3 MB, yalnız JPEG/PNG/WebP.
const yukle = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const uygun = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    if (!uygun) req.dosyaHatasi = 'Yalnız JPEG, PNG ya da WebP fotoğraf yüklenebilir.';
    cb(null, uygun);
  },
});

// multer hatalarını (ör. dosya 3 MB'tan büyük) 500 sayfası yerine form hatasına çevirir
function fotografAl(req, res, next) {
  yukle.single('gorsel')(req, res, (err) => {
    if (err) req.dosyaHatasi = err.code === 'LIMIT_FILE_SIZE' ? 'Fotoğraf en fazla 3 MB olabilir.' : 'Fotoğraf yüklenemedi.';
    next();
  });
}

const DURUMLAR = { yeni: 'Yeni', arandi: 'Arandı', teklif_verildi: 'Teklif verildi', kapandi: 'Kapandı' };

function bildir(req, mesaj) { req.session.bildirim = mesaj; }

// ---- Giriş / çıkış ----
const girisSiniri = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });

router.get('/giris', (req, res) => res.render('yonetim/giris', { baslik: 'Yönetim girişi', hata: null, eposta: '' }));

router.post('/giris', girisSiniri, async (req, res) => {
  const eposta = String(req.body.eposta || '').trim().toLowerCase();
  const sifre = String(req.body.sifre || '');
  const { rows } = await pool.query('SELECT id, eposta, sifre_hash FROM kullanicilar WHERE eposta = $1', [eposta]);
  const dogru = rows[0] && await bcrypt.compare(sifre, rows[0].sifre_hash);
  if (!dogru) {
    return res.status(401).render('yonetim/giris', { baslik: 'Yönetim girişi', hata: 'E-posta ya da parola hatalı.', eposta });
  }
  // Oturum sabitleme saldırısına karşı oturum kimliği yenilenir
  req.session.regenerate(err => {
    if (err) throw err;
    req.session.kullanici = { id: rows[0].id, eposta: rows[0].eposta };
    res.redirect('/yonetim');
  });
});

router.post('/cikis', (req, res) => req.session.destroy(() => res.redirect('/')));

// Buradan sonraki her sayfa giriş ister
router.use((req, res, next) => (req.session.kullanici ? next() : res.redirect('/yonetim/giris')));

// ---- Pano ----
router.get('/', async (req, res) => {
  const { rows } = await pool.query(`SELECT
      (SELECT count(*)::int FROM projeler) AS proje,
      (SELECT count(*)::int FROM teklifler) AS teklif,
      (SELECT count(*)::int FROM teklifler WHERE durum = 'yeni') AS yeni`);
  const sonTeklifler = await pool.query('SELECT id, ad_soyad, firma, sehir, tarih, durum, olusturma FROM teklifler ORDER BY olusturma DESC LIMIT 5');
  res.render('yonetim/pano', { baslik: 'Pano', s: rows[0], teklifler: sonTeklifler.rows, DURUMLAR });
});

// ---- Projeler (CRUD) ----
router.get('/projeler', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const { rows } = q
    ? await pool.query(`SELECT id, musteri, etkinlik, sehir, yil, tur, one_cikan FROM projeler
                        WHERE musteri ILIKE $1 OR etkinlik ILIKE $1 ORDER BY id DESC`, [`%${q}%`])
    : await pool.query('SELECT id, musteri, etkinlik, sehir, yil, tur, one_cikan FROM projeler ORDER BY id DESC');
  res.render('yonetim/projeler', { baslik: 'Projeler', projeler: rows, q });
});

router.get('/projeler/yeni', (req, res) =>
  res.render('yonetim/proje-form', { baslik: 'Yeni proje', p: { tur: 'fuar' }, hatalar: {}, yeni: true }));

router.post('/projeler', fotografAl, projeKurallari, async (req, res) => {
  const sonuc = validationResult(req);
  const hatalar = {};
  for (const h of sonuc.array()) if (!hatalar[h.path]) hatalar[h.path] = h.msg;
  if (req.dosyaHatasi) hatalar.gorsel = req.dosyaHatasi;
  else if (!req.file) hatalar.gorsel = 'Bir fotoğraf seçin (JPEG, PNG ya da WebP, en fazla 3 MB).';
  if (Object.keys(hatalar).length) {
    return res.status(422).render('yonetim/proje-form', { baslik: 'Yeni proje', p: req.body, hatalar, yeni: true });
  }
  const v = matchedData(req);
  const { rows } = await pool.query(
    `INSERT INTO projeler (musteri, etkinlik, sehir, yil, tur, aciklama, one_cikan, gorsel, gorsel_tip)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [v.musteri, v.etkinlik || '', v.sehir || null, v.yil || null, v.tur, v.aciklama || null,
     req.body.one_cikan === 'on', req.file.buffer, req.file.mimetype]
  );
  bildir(req, `Proje eklendi (No. ${rows[0].id}).`);
  res.redirect('/yonetim/projeler');
});

router.get('/projeler/:id/duzenle', async (req, res, next) => {
  const { rows } = await pool.query('SELECT id, musteri, etkinlik, sehir, yil, tur, aciklama, one_cikan FROM projeler WHERE id = $1', [parseInt(req.params.id, 10) || 0]);
  if (!rows[0]) return next();
  res.render('yonetim/proje-form', { baslik: 'Projeyi düzenle', p: rows[0], hatalar: {}, yeni: false });
});

router.post('/projeler/:id', fotografAl, projeKurallari, async (req, res, next) => {
  const id = parseInt(req.params.id, 10) || 0;
  const sonuc = validationResult(req);
  if (!sonuc.isEmpty() || req.dosyaHatasi) {
    const hatalar = {};
    for (const h of sonuc.array()) if (!hatalar[h.path]) hatalar[h.path] = h.msg;
    if (req.dosyaHatasi) hatalar.gorsel = req.dosyaHatasi;
    return res.status(422).render('yonetim/proje-form', { baslik: 'Projeyi düzenle', p: { ...req.body, id }, hatalar, yeni: false });
  }
  const v = matchedData(req);
  // Yeni fotoğraf seçilmediyse eskisi korunur (COALESCE)
  const { rowCount } = await pool.query(
    `UPDATE projeler SET musteri = $1, etkinlik = $2, sehir = $3, yil = $4, tur = $5, aciklama = $6, one_cikan = $7,
       gorsel = COALESCE($8, gorsel), gorsel_tip = COALESCE($9, gorsel_tip), guncelleme = now()
     WHERE id = $10`,
    [v.musteri, v.etkinlik || '', v.sehir || null, v.yil || null, v.tur, v.aciklama || null, req.body.one_cikan === 'on',
     req.file ? req.file.buffer : null, req.file ? req.file.mimetype : null, id]
  );
  if (!rowCount) return next();
  bildir(req, 'Proje güncellendi.');
  res.redirect('/yonetim/projeler');
});

router.post('/projeler/:id/sil', async (req, res) => {
  await pool.query('DELETE FROM projeler WHERE id = $1', [parseInt(req.params.id, 10) || 0]);
  bildir(req, 'Proje silindi.');
  res.redirect('/yonetim/projeler');
});

// ---- Teklif talepleri (listele, gör, durum güncelle, sil) ----
router.get('/teklifler', async (req, res) => {
  const durum = DURUMLAR[req.query.durum] ? req.query.durum : '';
  const { rows } = durum
    ? await pool.query('SELECT * FROM teklifler WHERE durum = $1 ORDER BY olusturma DESC', [durum])
    : await pool.query('SELECT * FROM teklifler ORDER BY olusturma DESC');
  res.render('yonetim/teklifler', { baslik: 'Teklif talepleri', teklifler: rows, DURUMLAR, durum });
});

router.get('/teklifler/:id', async (req, res, next) => {
  const { rows } = await pool.query('SELECT * FROM teklifler WHERE id = $1', [parseInt(req.params.id, 10) || 0]);
  if (!rows[0]) return next();
  res.render('yonetim/teklif', { baslik: `Teklif No. ${rows[0].id}`, t: rows[0], DURUMLAR });
});

router.post('/teklifler/:id', async (req, res) => {
  const durum = DURUMLAR[req.body.durum] ? req.body.durum : 'yeni';
  const not = String(req.body.yonetici_notu || '').slice(0, 2000);
  await pool.query('UPDATE teklifler SET durum = $1, yonetici_notu = $2 WHERE id = $3', [durum, not, parseInt(req.params.id, 10) || 0]);
  bildir(req, 'Teklif güncellendi.');
  res.redirect(`/yonetim/teklifler/${req.params.id}`);
});

router.post('/teklifler/:id/sil', async (req, res) => {
  await pool.query('DELETE FROM teklifler WHERE id = $1', [parseInt(req.params.id, 10) || 0]);
  bildir(req, 'Teklif silindi.');
  res.redirect('/yonetim/teklifler');
});

module.exports = router;
