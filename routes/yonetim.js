// Yönetim paneli: giriş, pano, projeler (CRUD), teklif talepleri (listele, gör, güncelle, sil, CSV), işlem günlüğü, hesap (şifre).
// Giriş yapmayan kullanıcı /yonetim/giris'e yönlenir. Her POST formu CSRF jetonu taşır (lib/csrf.js).
const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { validationResult, matchedData } = require('express-validator');
const pool = require('../db/pool');
const csrf = require('../lib/csrf');
const { imzaKontrol, hazirla } = require('../lib/gorsel');
const onbellek = require('../lib/gorsel-onbellek');
const kayit = require('../lib/kayit'); // işlem günlüğü
const istemciIp = require('../lib/istemci-ip');
const { projeKurallari, TEKLIF_DURUMLARI: DURUMLAR, teklifGuncelleKurallari, sifreKurallari } = require('../validators');

const router = express.Router();

const TURLER = { fuar: 'Fuar', etkinlik: 'Etkinlik', kurumsal: 'Kurumsal' };
const SAYFA_BOYU = 20;

// ---- Küçük yardımcılar ----

// Sorgu parametresini güvenle metne çevirir (?q=a&q=b gibi dizi gelirse boş sayılır)
const metin = (v) => (typeof v === 'string' ? v.trim().slice(0, 100) : '');
const sayi = (v) => { const n = parseInt(v, 10); return n > 0 ? n : 0; };
// ILIKE aramasında % ve _ joker sayılmasın
const benzer = (q) => `%${q.replace(/[\\%_]/g, '\\$&')}%`;
// express-validator hatalarını { alan: ilk mesaj } nesnesine çevirir
function hataNesnesi(req) {
  const hatalar = {};
  for (const h of validationResult(req).array()) if (!hatalar[h.path]) hatalar[h.path] = h.msg;
  return hatalar;
}
const bildir = (req, mesaj) => { req.session.bildirim = mesaj; };

// ---- Fotoğraf yükleme ----
// Bellekte tutulur, işlenip veritabanına yazılır. En fazla 3 MB. İstemcinin söylediği tür ilk eleme;
// asıl denetim dosyanın ilk baytlarına bakan imzaKontrol (lib/gorsel.js).
const yukle = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024, files: 1, fields: 20 },
  fileFilter: (req, file, cb) => {
    const uygun = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    if (!uygun) req.dosyaHatasi = 'Yalnız JPEG, PNG ya da WebP fotoğraf yüklenebilir.';
    cb(null, uygun);
  },
});

// Fotoğraflı formlar multipart gelir; gövdeyi CSRF denetiminden önce çözeriz. Yalnız giriş yapmış kullanıcı için:
// girişsiz biri 3 MB'lık dosyayı belleğe yükletemesin. multer hataları (ör. 3 MB'ı aşan dosya) form hatasına çevrilir.
function cokParcaliyiCoz(req, res, next) {
  if (req.method !== 'POST' || !req.is('multipart/form-data') || !req.session.kullanici) return next();
  yukle.single('gorsel')(req, res, (err) => {
    if (err) req.dosyaHatasi = err.code === 'LIMIT_FILE_SIZE' ? 'Fotoğraf en fazla 3 MB olabilir.' : 'Fotoğraf yüklenemedi.';
    next();
  });
}

// Yüklenen dosyayı denetler. Dönüş: { hata } ya da { dosya: Buffer } ya da {} (dosya seçilmemiş)
async function dosyayiDenetle(req) {
  if (req.dosyaHatasi) return { hata: req.dosyaHatasi };
  if (!req.file) return {};
  if (!(await imzaKontrol(req.file.buffer))) {
    return { hata: 'Yalnız JPEG, PNG ya da WebP fotoğraf yüklenebilir; dosyanın içeriği fotoğraf değil.' };
  }
  return { dosya: req.file.buffer };
}

// Fotoğrafı tam + küçük boy WebP'ye çevirir; bozuk dosyada { hata } döner
async function fotografiHazirla(dosya) {
  try { return await hazirla(dosya); } catch { return { hata: 'Fotoğraf okunamadı; dosya bozuk olabilir.' }; }
}

// ---- Ortak ara katmanlar ----
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store'); // yönetim sayfaları tarayıcı/vekil önbelleğine yazılmasın
  res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
});
// Menüde etkin sayfa: alt router'da req.path öneksizdir; tam yol baseUrl ile birleşir (/yonetim/projeler)
router.use((req, res, next) => { res.locals.yol = req.baseUrl + req.path; next(); });
router.use((req, res, next) => { res.locals.kayit = kayit; next(); });
router.use(csrf.hazirla);      // res.locals.csrf: formlardaki gizli alan
router.use(cokParcaliyiCoz);   // multipart gövdeyi çöz (yalnız girişliyken)
router.use(csrf.dogrula);      // her POST: gövdedeki _csrf oturumdakiyle aynı mı? değilse 403

// ---- Giriş ----
const girisSiniri = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, keyGenerator: istemciIp.anahtar });
// Kullanıcı yoksa da bcrypt çalışsın diye sahte özet: yanıt süresinden "bu e-posta kayıtlı mı" anlaşılmasın
const SAHTE_OZET = '$2b$12$.Y2GGOtG4FjMxXZv2JwjSeYCOB2wj6gN/MtVLjAnK06kjeN9pNTxK';

router.get('/giris', (req, res) => {
  if (req.session.kullanici) return res.redirect('/yonetim');
  res.render('yonetim/giris', { baslik: 'Yönetim girişi', hata: null, eposta: '' });
});

router.post('/giris', girisSiniri, async (req, res, next) => {
  const eposta = metin(req.body.eposta).toLowerCase();
  const sifre = typeof req.body.sifre === 'string' ? req.body.sifre : '';
  const { rows } = await pool.query('SELECT id, eposta, sifre_hash FROM kullanicilar WHERE eposta = $1', [eposta]);
  const dogru = await bcrypt.compare(sifre, rows[0] ? rows[0].sifre_hash : SAHTE_OZET);
  if (!rows[0] || !dogru) {
    // Günlüğe yalnız maskeli e-posta yazılır (k***@admin.com); şifre asla
    await kayit.kaydet({ tur: 'giris_basarisiz', mesaj: `${kayit.epostaMaskele(eposta)} ile giriş denendi` });
    return res.status(401).render('yonetim/giris', { baslik: 'Yönetim girişi', hata: 'E-posta ya da şifre hatalı.', eposta });
  }
  // Giriş öncesi istenen yönetim sayfasına dön (yalnız /yonetim altı: başka siteye yönlendirme olmasın)
  const donus = /^\/yonetim(\/[\w\-/.?=&%]*)?$/.test(req.session.donus || '') ? req.session.donus : '/yonetim';
  // Oturum sabitleme saldırısına karşı oturum kimliği yenilenir (H7: hata süreci çökertmesin, hata sayfasına gitsin)
  req.session.regenerate(async (err) => {
    if (err) return next(err);
    req.session.kullanici = { id: rows[0].id, eposta: rows[0].eposta };
    await kayit.kaydet({ tur: 'giris', mesaj: 'Yönetim paneline giriş yapıldı', kullanici_id: rows[0].id });
    res.redirect(donus);
  });
});

// Buradan sonraki her sayfa giriş ister. GET isteğinde adres saklanır, girişten sonra oraya dönülür.
router.use((req, res, next) => {
  if (req.session.kullanici) return next();
  if (req.method === 'GET') req.session.donus = req.originalUrl;
  res.redirect('/yonetim/giris');
});

// Yan menüdeki "okunmamış teklif" rozeti (H2: yeni teklif panelde fark edilsin)
router.use(async (req, res, next) => {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM teklifler WHERE NOT okundu');
  res.locals.okunmamis = rows[0].n;
  next();
});

router.post('/cikis', async (req, res, next) => {
  await kayit.kaydet({ tur: 'cikis', mesaj: 'Çıkış yapıldı', kullanici_id: req.session.kullanici.id });
  req.session.destroy((err) => (err ? next(err) : res.redirect('/')));
});

// ---- Pano ----
router.get('/', async (req, res) => {
  const [sayilar, durumlar, teklifler, projeler, sonKayitlar] = await Promise.all([
    pool.query(`SELECT
        (SELECT count(*)::int FROM projeler) AS proje,
        (SELECT count(*)::int FROM projeler WHERE one_cikan) AS one_cikan,
        (SELECT count(*)::int FROM teklifler) AS teklif,
        (SELECT count(*)::int FROM teklifler WHERE olusturma > now() - interval '30 days') AS son30`),
    pool.query('SELECT durum, count(*)::int AS n FROM teklifler GROUP BY durum'),
    pool.query(`SELECT id, ad_soyad, firma, sehir, tarih, durum, okundu, olusturma
                FROM teklifler ORDER BY olusturma DESC LIMIT 5`),
    pool.query(`SELECT id, musteri, etkinlik, sehir, yil, guncelleme, gorsel IS NOT NULL AS foto
                FROM projeler ORDER BY olusturma DESC, id DESC LIMIT 5`),
    kayit.son(15), // sağdaki "Son işlemler" akışı
  ]);
  const durumSayisi = Object.fromEntries(Object.keys(DURUMLAR).map((k) => [k, 0]));
  for (const r of durumlar.rows) durumSayisi[r.durum] = r.n;
  res.render('yonetim/pano', {
    genis: true, // iki sütunlu geniş yerleşim (yonetim.css: y-icerik-genis)
    baslik: 'Pano', s: sayilar.rows[0], durumSayisi, teklifler: teklifler.rows, projeler: projeler.rows, DURUMLAR, sonKayitlar,
  });
});

// ---- Projeler (CRUD) ----

// Günlük mesajı için proje özeti: "No. 5 · Müşteri · Etkinlik"
const projeOzeti = (id, p) => ['No. ' + id, p.musteri, p.etkinlik].filter(Boolean).join(' · ');
router.get('/projeler', async (req, res) => {
  const q = metin(req.query.q);
  const yil = sayi(req.query.yil);
  const tur = TURLER[req.query.tur] ? req.query.tur : '';

  // Süzgeçlerden WHERE koşulu kurulur; değerler her zaman parametre ($1, $2...) olarak gider
  const kosullar = [];
  const degerler = [];
  if (q) { degerler.push(benzer(q)); kosullar.push(`(musteri ILIKE $${degerler.length} OR etkinlik ILIKE $${degerler.length} OR sehir ILIKE $${degerler.length})`); }
  if (yil) { degerler.push(yil); kosullar.push(`yil = $${degerler.length}`); }
  if (tur) { degerler.push(tur); kosullar.push(`tur = $${degerler.length}`); }
  const where = kosullar.length ? 'WHERE ' + kosullar.join(' AND ') : '';

  const toplam = (await pool.query(`SELECT count(*)::int AS n FROM projeler ${where}`, degerler)).rows[0].n;
  const sayfaSayisi = Math.max(1, Math.ceil(toplam / SAYFA_BOYU));
  const sayfa = Math.min(sayi(req.query.sayfa) || 1, sayfaSayisi);
  const { rows } = await pool.query(
    `SELECT id, musteri, etkinlik, sehir, yil, tur, one_cikan, guncelleme, gorsel IS NOT NULL AS foto
     FROM projeler ${where} ORDER BY id DESC LIMIT ${SAYFA_BOYU} OFFSET ${(sayfa - 1) * SAYFA_BOYU}`, degerler);
  const yillar = (await pool.query('SELECT DISTINCT yil FROM projeler WHERE yil IS NOT NULL ORDER BY yil DESC')).rows.map((r) => r.yil);

  res.render('yonetim/projeler', {
    baslik: 'Projeler', projeler: rows, toplam, sayfa, sayfaSayisi, yillar, TURLER, suzgec: { q, yil: yil || '', tur },
  });
});

router.get('/projeler/yeni', (req, res) =>
  res.render('yonetim/proje-form', { baslik: 'Yeni proje', p: { tur: 'fuar' }, hatalar: {}, yeni: true, TURLER }));

router.post('/projeler', projeKurallari, async (req, res) => {
  const hatalar = hataNesnesi(req);
  const { hata, dosya } = await dosyayiDenetle(req);
  if (hata) hatalar.gorsel = hata;
  else if (!dosya) hatalar.gorsel = 'Bir fotoğraf seçin (JPEG, PNG ya da WebP, en fazla 3 MB).';
  // Fotoğraf yalnız diğer alanlar doğruysa işlenir (işleme birkaç yüz ms sürer)
  const foto = Object.keys(hatalar).length ? null : await fotografiHazirla(dosya);
  if (foto && foto.hata) hatalar.gorsel = foto.hata;
  if (Object.keys(hatalar).length) {
    return res.status(422).render('yonetim/proje-form', { baslik: 'Yeni proje', p: req.body, hatalar, yeni: true, TURLER });
  }
  const v = matchedData(req);
  const { rows } = await pool.query(
    `INSERT INTO projeler (musteri, etkinlik, sehir, yil, tur, aciklama, one_cikan, gorsel, gorsel_kucuk, gorsel_tip)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [v.musteri, v.etkinlik || '', v.sehir || null, v.yil || null, v.tur, v.aciklama || null,
      req.body.one_cikan === 'on', foto.tam, foto.kucuk, foto.tur]
  );
  await kayit.kaydet({ tur: 'proje_eklendi', mesaj: projeOzeti(rows[0].id, v), kullanici_id: req.session.kullanici.id, proje_id: rows[0].id });
  bildir(req, `Proje eklendi (No. ${rows[0].id}).`);
  res.redirect('/yonetim/projeler');
});

router.get('/projeler/:id/duzenle', async (req, res, next) => {
  const { rows } = await pool.query(
    `SELECT id, musteri, etkinlik, sehir, yil, tur, aciklama, one_cikan, guncelleme, gorsel IS NOT NULL AS foto
     FROM projeler WHERE id = $1`, [sayi(req.params.id)]);
  if (!rows[0]) return next();
  res.render('yonetim/proje-form', { baslik: 'Projeyi düzenle', p: rows[0], hatalar: {}, yeni: false, TURLER });
});

router.post('/projeler/:id', projeKurallari, async (req, res, next) => {
  const id = sayi(req.params.id);
  const mevcut = (await pool.query('SELECT guncelleme, gorsel IS NOT NULL AS foto FROM projeler WHERE id = $1', [id])).rows[0];
  if (!mevcut) return next();
  const hatalar = hataNesnesi(req);
  const { hata, dosya } = await dosyayiDenetle(req);
  if (hata) hatalar.gorsel = hata;
  const foto = dosya && !Object.keys(hatalar).length ? await fotografiHazirla(dosya) : null;
  if (foto && foto.hata) hatalar.gorsel = foto.hata;
  if (Object.keys(hatalar).length) {
    return res.status(422).render('yonetim/proje-form', {
      baslik: 'Projeyi düzenle', p: { ...req.body, id, ...mevcut }, hatalar, yeni: false, TURLER,
    });
  }
  const v = matchedData(req);
  // Yeni fotoğraf seçilmediyse eskisi korunur (COALESCE: boş gelen değer yerine sütunun kendisi)
  await pool.query(
    `UPDATE projeler SET musteri = $1, etkinlik = $2, sehir = $3, yil = $4, tur = $5, aciklama = $6, one_cikan = $7,
       gorsel = COALESCE($8, gorsel), gorsel_kucuk = COALESCE($9, gorsel_kucuk), gorsel_tip = COALESCE($10, gorsel_tip),
       guncelleme = now()
     WHERE id = $11`,
    [v.musteri, v.etkinlik || '', v.sehir || null, v.yil || null, v.tur, v.aciklama || null, req.body.one_cikan === 'on',
      foto ? foto.tam : null, foto ? foto.kucuk : null, foto ? foto.tur : null, id]
  );
  onbellek.sil(id);
  await kayit.kaydet({ tur: 'proje_guncellendi', mesaj: projeOzeti(id, v), kullanici_id: req.session.kullanici.id, proje_id: id });
  bildir(req, 'Proje güncellendi.');
  res.redirect('/yonetim/projeler');
});

router.post('/projeler/:id/sil', async (req, res) => {
  const silId = sayi(req.params.id);
  const { rowCount, rows } = await pool.query('DELETE FROM projeler WHERE id = $1 RETURNING musteri, etkinlik', [silId]);
  onbellek.sil(silId);
  // Satır silindiği için proje_id yazılmaz; ad mesajda kalır
  if (rowCount) await kayit.kaydet({ tur: 'proje_silindi', mesaj: projeOzeti(silId, rows[0]), kullanici_id: req.session.kullanici.id });
  bildir(req, rowCount ? 'Proje silindi.' : 'Proje bulunamadı (zaten silinmiş olabilir).');
  res.redirect('/yonetim/projeler');
});

// ---- Teklif talepleri ----

// Liste ve CSV aynı süzgeçleri kullanır: durum, arama (kişi, firma, e-posta, telefon, şehir)
function teklifSuzgeci(sorgu) {
  const q = metin(sorgu.q);
  const durum = DURUMLAR[sorgu.durum] ? sorgu.durum : '';
  const kosullar = [];
  const degerler = [];
  if (durum) { degerler.push(durum); kosullar.push(`durum = $${degerler.length}`); }
  if (q) {
    degerler.push(benzer(q));
    const n = degerler.length;
    kosullar.push(`(ad_soyad ILIKE $${n} OR firma ILIKE $${n} OR eposta ILIKE $${n} OR telefon ILIKE $${n} OR sehir ILIKE $${n})`);
  }
  return { q, durum, degerler, where: kosullar.length ? 'WHERE ' + kosullar.join(' AND ') : '' };
}

router.get('/teklifler', async (req, res) => {
  const { q, durum, degerler, where } = teklifSuzgeci(req.query);
  const toplam = (await pool.query(`SELECT count(*)::int AS n FROM teklifler ${where}`, degerler)).rows[0].n;
  const sayfaSayisi = Math.max(1, Math.ceil(toplam / SAYFA_BOYU));
  const sayfa = Math.min(sayi(req.query.sayfa) || 1, sayfaSayisi);
  // Okunmamışlar en üstte, sonra en yeni
  const { rows } = await pool.query(
    `SELECT id, ad_soyad, firma, etkinlik_turu, sehir, tarih, metretul, durum, okundu, olusturma
     FROM teklifler ${where} ORDER BY okundu, olusturma DESC LIMIT ${SAYFA_BOYU} OFFSET ${(sayfa - 1) * SAYFA_BOYU}`, degerler);
  const sayimlar = await pool.query('SELECT durum, count(*)::int AS n FROM teklifler GROUP BY durum');
  const durumSayisi = Object.fromEntries(sayimlar.rows.map((r) => [r.durum, r.n]));
  res.render('yonetim/teklifler', {
    baslik: 'Teklif talepleri', teklifler: rows, DURUMLAR, durumSayisi, toplam, sayfa, sayfaSayisi, suzgec: { q, durum },
  });
});

// CSV: Excel'in Türkçe ayarı ';' ayırıcı bekler; baştaki BOM (﻿) Excel'e dosyanın UTF-8 olduğunu söyler (ş, ğ, İ bozulmaz)
function csvHucre(deger) {
  let s = deger === null || deger === undefined ? '' : String(deger);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // formül enjeksiyonu: Excel "=..." ile başlayan hücreyi çalıştırmasın
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
// Telefonu Excel'in sayıya çevirmeyeceği biçimde yazar: 0532 123 45 67 (baştaki 0 kaybolmaz)
function telefonBicim(t) {
  const r = String(t || '').replace(/\D/g, '').replace(/^90(?=\d{10}$)/, '').replace(/^(?=\d{10}$)/, '0');
  return /^0\d{10}$/.test(r) ? `${r.slice(0, 4)} ${r.slice(4, 7)} ${r.slice(7, 9)} ${r.slice(9)}` : t;
}

router.get('/teklifler.csv', async (req, res) => {
  const { degerler, where } = teklifSuzgeci(req.query);
  const { rows } = await pool.query(`SELECT * FROM teklifler ${where} ORDER BY olusturma DESC`, degerler);
  const tarih = (d) => (d ? d.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' }) : '');
  const basliklar = ['No', 'Geliş', 'Ad soyad', 'Firma', 'Telefon', 'E-posta', 'Etkinlik türü', 'Şehir', 'Etkinlik tarihi',
    'Gün', 'Metretül', 'Ekip desteği', 'Durum', 'Okundu', 'Mesaj', 'Yönetici notu'];
  const satirlar = rows.map((t) => [t.id, tarih(t.olusturma), t.ad_soyad, t.firma, telefonBicim(t.telefon), t.eposta,
    t.etkinlik_turu, t.sehir, tarih(t.tarih), t.gun_sayisi, t.metretul, t.kurulum ? 'İstiyor' : 'İstemiyor',
    DURUMLAR[t.durum], t.okundu ? 'Evet' : 'Hayır', t.mesaj, t.yonetici_notu]);
  const csv = '﻿' + [basliklar, ...satirlar].map((s) => s.map(csvHucre).join(';')).join('\r\n') + '\r\n';
  const gun = new Date().toISOString().slice(0, 10);
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="teklifler-${gun}.csv"`);
  res.send(csv);
});

// Günlük mesajı için teklif özeti: "No. 12 · Ad Soyad · Fuar standı, İzmir" (telefon / e-posta yazılmaz)
const teklifOzeti = (t) => `No. ${t.id} · ${t.ad_soyad} · ${t.etkinlik_turu}, ${t.sehir}`;

// Ayrıntı: açılınca teklif "okundu" olur
router.get('/teklifler/:id', async (req, res, next) => {
  const id = sayi(req.params.id);
  const { rows } = await pool.query('SELECT * FROM teklifler WHERE id = $1', [id]);
  const t = rows[0];
  if (!t) return next();
  if (!t.okundu) {
    // AND NOT okundu: iki sekme aynı anda açsa bile "okundu" kaydı bir kez yazılır
    const { rowCount } = await pool.query('UPDATE teklifler SET okundu = true WHERE id = $1 AND NOT okundu', [id]);
    res.locals.okunmamis = Math.max(0, res.locals.okunmamis - 1); // rozet bu sayfada da doğru görünsün
    if (rowCount) {
      await kayit.kaydet({ tur: 'teklif_okundu', mesaj: teklifOzeti(t), kullanici_id: req.session.kullanici.id, teklif_id: id });
    }
  }
  const gecmis = await kayit.teklifGecmisi(id); // sayfadaki küçük zaman çizelgesi
  res.render('yonetim/teklif', { baslik: `Teklif No. ${t.id}`, t, DURUMLAR, hatalar: {}, form: t, gecmis });
});

// Durum ve yönetici notu
router.post('/teklifler/:id', teklifGuncelleKurallari, async (req, res, next) => {
  const id = sayi(req.params.id);
  const hatalar = hataNesnesi(req);
  if (Object.keys(hatalar).length) {
    const { rows } = await pool.query('SELECT * FROM teklifler WHERE id = $1', [id]);
    if (!rows[0]) return next();
    const gecmis = await kayit.teklifGecmisi(id);
    return res.status(422).render('yonetim/teklif', { baslik: `Teklif No. ${id}`, t: rows[0], DURUMLAR, hatalar, form: req.body, gecmis });
  }
  const v = matchedData(req);
  // Değişimi günlüğe yazabilmek için eski durum ve not önce okunur
  const eski = (await pool.query('SELECT * FROM teklifler WHERE id = $1', [id])).rows[0];
  if (!eski) return next();
  const yeniNot = v.yonetici_notu || null;
  await pool.query(
    'UPDATE teklifler SET durum = $1, yonetici_notu = $2, okundu = true, guncellendi = now() WHERE id = $3',
    [v.durum, yeniNot, id]);
  const kim = { kullanici_id: req.session.kullanici.id, teklif_id: id };
  if (eski.durum !== v.durum) { // aynı durum seçildiyse kayıt yok
    await kayit.kaydet({ tur: 'teklif_durum', mesaj: `${teklifOzeti(eski)}: ${DURUMLAR[eski.durum]} → ${DURUMLAR[v.durum]}`, ...kim });
  }
  if ((eski.yonetici_notu || null) !== yeniNot) { // not içeriği günlüğe yazılmaz (kişisel bilgi olabilir)
    await kayit.kaydet({ tur: 'teklif_not', mesaj: `${teklifOzeti(eski)}: yönetici notu ${yeniNot ? 'güncellendi' : 'silindi'}`, ...kim });
  }
  bildir(req, 'Teklif güncellendi.');
  res.redirect(`/yonetim/teklifler/${id}`);
});

// Sonra bakmak için yeniden "okunmamış" yap
router.post('/teklifler/:id/okunmadi', async (req, res) => {
  await pool.query('UPDATE teklifler SET okundu = false WHERE id = $1', [sayi(req.params.id)]);
  bildir(req, 'Teklif okunmamış olarak işaretlendi.');
  res.redirect('/yonetim/teklifler');
});

router.post('/teklifler/:id/sil', async (req, res) => {
  const silId = sayi(req.params.id);
  // KVKK: teklifin kişisel verisi (ad vb.) günlükte de kalmasın. Günlük satırları teklifi silmeden ÖNCE silinir
  // (teklif silinince teklif_id ON DELETE SET NULL ile boşalır, sonradan bulunamazdı). Silme olayı adsız yazılır, teklif_id taşımaz.
  await pool.query('DELETE FROM islem_kayitlari WHERE teklif_id = $1', [silId]);
  const { rowCount } = await pool.query('DELETE FROM teklifler WHERE id = $1', [silId]);
  if (rowCount) {
    await kayit.kaydet({ tur: 'teklif_silindi', mesaj: `Teklif No. ${silId} silindi`, kullanici_id: req.session.kullanici.id });
  }
  bildir(req, rowCount ? 'Teklif silindi.' : 'Teklif bulunamadı (zaten silinmiş olabilir).');
  res.redirect('/yonetim/teklifler');
});

// ---- İşlem günlüğü ----
router.get('/islemler', async (req, res) => {
  const tur = kayit.TURLER[req.query.tur] ? req.query.tur : '';
  const { satirlar, toplam, sayfa, sayfaSayisi } = await kayit.liste({ tur, sayfa: sayi(req.query.sayfa) || 1, sayfaBoyu: 30 });
  res.render('yonetim/islemler', { baslik: 'İşlem günlüğü', satirlar, toplam, sayfa, sayfaSayisi, suzgec: { tur } });
});

// ---- Hesap: şifre değiştir ----
const sifreSiniri = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, keyGenerator: istemciIp.anahtar });

router.get('/hesap', (req, res) => res.render('yonetim/hesap', { baslik: 'Hesap', hatalar: {} }));

router.post('/hesap/sifre', sifreSiniri, sifreKurallari, async (req, res, next) => {
  const hatalar = hataNesnesi(req);
  const kullanici = req.session.kullanici;
  if (!hatalar.mevcut) {
    const { rows } = await pool.query('SELECT sifre_hash FROM kullanicilar WHERE id = $1', [kullanici.id]);
    if (!rows[0] || !(await bcrypt.compare(String(req.body.mevcut), rows[0].sifre_hash))) hatalar.mevcut = 'Mevcut şifre yanlış.';
  }
  if (Object.keys(hatalar).length) return res.status(422).render('yonetim/hesap', { baslik: 'Hesap', hatalar });

  const ozet = await bcrypt.hash(req.body.yeni, 12);
  await pool.query('UPDATE kullanicilar SET sifre_hash = $1 WHERE id = $2', [ozet, kullanici.id]);
  await kayit.kaydet({ tur: 'sifre_degisti', mesaj: 'Yönetici şifresi değiştirildi', kullanici_id: kullanici.id });
  // Bu kullanıcının başka cihazlardaki oturumları kapanır (şifre çalındıysa eski oturum da düşsün)
  await pool.query(`DELETE FROM oturumlar WHERE sid <> $1 AND sess->'kullanici'->>'id' = $2`, [req.sessionID, String(kullanici.id)]);
  // Bu oturumun kimliği de yenilenir
  req.session.regenerate((err) => {
    if (err) return next(err);
    req.session.kullanici = kullanici;
    bildir(req, 'Şifreniz değiştirildi. Diğer cihazlardaki oturumlar kapatıldı.');
    res.redirect('/yonetim/hesap');
  });
});

// Yönetimde bulunamayan sayfa: yönetim görünümüyle 404
router.use((req, res) => res.status(404).render('yonetim/bulunamadi', { baslik: 'Sayfa bulunamadı' }));

module.exports = router;
