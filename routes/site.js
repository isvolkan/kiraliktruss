// Ziyaretçiye açık sayfalar: ana sayfa, çalışmalar, hakkımızda, iletişim, teklif formu, proje fotoğrafları.
// Her rota kendi sorgusunu yapar ve görünümünü doğrudan çizer (görünümler views/, varlıklar public/).
const express = require('express');
const rateLimit = require('express-rate-limit');
const { validationResult, matchedData } = require('express-validator');
const pool = require('../db/pool');
const { teklifKurallari, ETKINLIK_TURLERI, TELEFON_HTML_DESENI } = require('../validators');
const bildirim = require('../lib/bildirim');
const istemciIp = require('../lib/istemci-ip');
const { kucukUret } = require('../lib/gorsel-uret');
const onbellek = require('../lib/gorsel-onbellek');

const router = express.Router();
const SAYFA_BOYU = 24;
const ENFAZLA_ID = 2147483647; // PostgreSQL integer sınırı; fazlası sorguyu patlatır

// ---------- Sorgu parametresi yardımcıları ----------
// ?q=a&q=b gibi tekrarlanan parametreler dizi olarak gelir; boş bayt (\0) PostgreSQL'i patlatır.
// Bu iki yardımcı sayesinde hiçbir sorgu bileşimi 500 vermez.

// İlk değeri düz metin olarak döner; yoksa / geçersizse ''
function tek(v) {
  if (Array.isArray(v)) v = v[0];
  return typeof v === 'string' ? v.replace(/\0/g, '') : '';
}
// Geçerli pozitif tam sayı ya da null
function sayi(v, enFazla = ENFAZLA_ID) {
  const n = /^\d{1,10}$/.test(tek(v)) ? Number(tek(v)) : 0;
  return n >= 1 && n <= enFazla ? n : null;
}

// Görsel sürümü: projenin güncelleme anı (epoch ms). Adreste ?v= olarak taşınır; fotoğraf değişince adres de değişir,
// böylece tarayıcı yıllarca önbellekte tutabilir (bkz. /gorsel/:id). Sorgulara bu sütun eklenir.
const SURUM = 'floor(extract(epoch FROM guncelleme) * 1000)::bigint AS v';

// Sitenin tam adresi (canonical, sitemap, paylaşım): SITE_URL varsa o, yoksa isteğin protokol + adresi; sonda / olmaz.
function siteAdresi(req) {
  return (process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
}

// ---------- Eski adresler (kalıcı yönlendirme) ----------

// Geliştirme sürümleri /v2 … /v6 altında yayındaydı: /v6/teklif?x=1 → /teklif?x=1
router.use((req, res, next) => {
  const m = req.url.match(/^\/v[2-6](?=[/?]|$)(.*)$/);
  if (!m) return next();
  // Baştaki fazla / ve \ atılır: "/v6//baska-site.com" başka siteye yönlenmesin
  res.redirect(301, '/' + m[1].replace(/^[/\\]+/, ''));
});

// Her ziyaretçi sayfasında kullanılabilen ortak değişkenler
router.use((req, res, next) => {
  res.locals.siteUrl = siteAdresi(req);
  res.locals.yol = req.path;
  // Görsel adresi: gorselUrl(proje) tam boy, gorselUrl(proje, true) küçük boy; proje.v varsa sürüm parametresi eklenir
  res.locals.gorselUrl = (p, kucuk) => {
    const oz = [];
    if (kucuk) oz.push('boy=kucuk');
    if (p.v) oz.push('v=' + p.v);
    return '/gorsel/' + p.id + (oz.length ? '?' + oz.join('&') : '');
  };
  next();
});

// Eski sitenin çalışmalar sayfası (kiraliktruss.com/ornek-calismalar, sayfalı alt adresleriyle)
router.get('/ornek-calismalar{/*kalan}', (req, res) => res.redirect(301, '/calismalar'));

// ---------- Sayfalar ----------

// Ana sayfa: hero fotoğrafları, son kurulumlar şeridi, sayılar, müşteri adları ızgarası, mini teklif formu
router.get('/', async (req, res) => {
  const [sayilar, isler, musteriler] = await Promise.all([
    pool.query(`SELECT count(*)::int AS proje,
                       count(DISTINCT etkinlik) FILTER (WHERE tur = 'fuar' AND etkinlik <> '')::int AS fuar FROM projeler`),
    // Fotoğraflı işler, en yeni kurulumdan geriye; aynı müşteriden yalnız en yeni iş.
    // İlk 6'sı hero'da döner, sonraki 12'si şeritte (şerit hero'yu yinelemez). Panelden eklenen yeni iş kendiliğinden başa geçer.
    pool.query(`SELECT id, musteri, etkinlik, sehir, yil, v FROM (
                  SELECT DISTINCT ON (musteri) id, musteri, etkinlik, sehir, yil, olusturma, ${SURUM} FROM projeler
                  WHERE gorsel IS NOT NULL ORDER BY musteri, yil DESC NULLS LAST, olusturma DESC, id DESC) tekil
                ORDER BY yil DESC NULLS LAST, olusturma DESC, id DESC LIMIT 18`),
    // "Kurulum yaptığımız işlerden": fotoğraflı işlerden ayrı müşteri adları, en yeni 12
    pool.query(`SELECT musteri AS ad, id, yil, v FROM (
                  SELECT DISTINCT ON (musteri) musteri, id, yil, ${SURUM} FROM projeler
                  WHERE musteri <> '' AND gorsel IS NOT NULL ORDER BY musteri, yil DESC NULLS LAST, id DESC) tekil
                ORDER BY yil DESC NULLS LAST, id DESC LIMIT 12`),
  ]);
  res.render('anasayfa', {
    baslik: 'Truss kiralama',
    sayilar: sayilar.rows[0],
    heroFotolar: isler.rows.slice(0, 6),
    seritProjeler: isler.rows.slice(6),
    musteriler: musteriler.rows,
    turler: ETKINLIK_TURLERI, // mini form
  });
});

router.get('/hakkimizda', async (req, res) => {
  // Dönen fotoğraf: müşteri başına bir fotoğraf, 12 kare, her açılışta karışık sıra (JS kapalıyken de ilk kare değişir).
  // Eski sitenin Hakkımızda'sındaki iş (Maschio Gaspardo, Bursa Tarım) her zaman aralarında. Fotoğraf yoksa sayfa fotoğrafsız çizilir.
  const GOSTERI_SAYI = 12;
  const sabit = await pool.query(
    `SELECT id, musteri, etkinlik, sehir, yil, ${SURUM} FROM projeler
     WHERE musteri = 'Maschio Gaspardo' AND etkinlik = 'Bursa Tarım' AND gorsel IS NOT NULL ORDER BY id LIMIT 1`);
  const digerleri = await pool.query(
    `SELECT * FROM (
       SELECT DISTINCT ON (musteri) id, musteri, etkinlik, sehir, yil, ${SURUM} FROM projeler
       WHERE gorsel IS NOT NULL AND musteri <> '' AND musteri <> 'Maschio Gaspardo'
       ORDER BY musteri, yil DESC NULLS LAST, id DESC) tekil
     ORDER BY random() LIMIT $1`, [GOSTERI_SAYI - sabit.rows.length]);
  const kareler = [...sabit.rows, ...digerleri.rows];
  for (let i = kareler.length - 1; i > 0; i--) { // karıştır (Fisher–Yates)
    const j = Math.floor(Math.random() * (i + 1));
    [kareler[i], kareler[j]] = [kareler[j], kareler[i]];
  }
  res.render('hakkimizda', {
    baslik: 'Hakkımızda',
    // künyenin ikinci satırı: etkinlik adı şehirle aynıysa yinelenmez
    gosteri: kareler.map(k => ({
      id: k.id, v: k.v, musteri: k.musteri,
      alt: [k.etkinlik && k.etkinlik !== k.sehir ? k.etkinlik : k.sehir, k.yil].filter(Boolean).join(' · '),
    })),
  });
});

router.get('/iletisim', (req, res) => res.render('iletisim', { baslik: 'İletişim' }));

// Örnek çalışmalar: tür / şehir / yıl süzgeci, arama, ızgara-liste görünümü, sayfalama
router.get('/calismalar', async (req, res) => {
  const tur = tek(req.query.tur), sehir = tek(req.query.sehir).slice(0, 60), yil = tek(req.query.yil);
  const q = tek(req.query.q).slice(0, 100);
  const gorunum = tek(req.query.gorunum) === 'liste' ? 'liste' : 'izgara';
  const sayfa = sayi(req.query.sayfa, 100000) || 1;

  // Parametreli sorgu: kullanıcı girdisi SQL'e doğrudan eklenmez (SQL injection koruması)
  const kosullar = [];
  const degerler = [];
  if (['fuar', 'etkinlik', 'kurumsal'].includes(tur)) { degerler.push(tur); kosullar.push(`tur = $${degerler.length}`); }
  if (sehir) { degerler.push(sehir); kosullar.push(`sehir = $${degerler.length}`); }
  if (/^\d{4}$/.test(yil)) { degerler.push(+yil); kosullar.push(`yil = $${degerler.length}`); }
  if (q.trim()) { degerler.push(`%${q.trim()}%`); kosullar.push(`(musteri ILIKE $${degerler.length} OR etkinlik ILIKE $${degerler.length})`); }
  const where = kosullar.length ? 'WHERE ' + kosullar.join(' AND ') : '';

  const [liste, toplam, secenekler, turler] = await Promise.all([
    pool.query(`SELECT id, musteri, etkinlik, sehir, yil, tur, ${SURUM} FROM projeler ${where}
                ORDER BY yil DESC NULLS LAST, id DESC LIMIT ${SAYFA_BOYU} OFFSET ${(sayfa - 1) * SAYFA_BOYU}`, degerler),
    pool.query(`SELECT count(*)::int AS n FROM projeler ${where}`, degerler),
    pool.query(`SELECT array_agg(DISTINCT sehir) FILTER (WHERE sehir IS NOT NULL) AS sehirler,
                       array_agg(DISTINCT yil) FILTER (WHERE yil IS NOT NULL) AS yillar FROM projeler`),
    pool.query('SELECT tur, count(*)::int AS n FROM projeler GROUP BY tur'), // tür levhalarındaki sayılar
  ]);
  const s = secenekler.rows[0];
  const turSayilari = { tumu: 0, fuar: 0, etkinlik: 0, kurumsal: 0 };
  for (const r of turler.rows) { turSayilari[r.tur] = r.n; turSayilari.tumu += r.n; }
  res.render('calismalar', {
    baslik: 'Örnek çalışmalar',
    projeler: liste.rows,
    toplam: toplam.rows[0].n,
    sayfa,
    sayfaSayisi: Math.max(1, Math.ceil(toplam.rows[0].n / SAYFA_BOYU)),
    filtre: { tur, sehir, yil, q, gorunum },
    sehirler: (s.sehirler || []).sort((a, b) => a.localeCompare(b, 'tr')),
    yillar: (s.yillar || []).sort((a, b) => b - a),
    turSayilari,
  });
});

router.get('/calismalar/:id', async (req, res, next) => {
  const id = sayi(req.params.id);
  if (!id) return next(); // 404
  const { rows } = await pool.query(`SELECT id, musteri, etkinlik, sehir, yil, tur, aciklama, ${SURUM} FROM projeler WHERE id = $1`, [id]);
  if (!rows[0]) return next();
  const benzer = await pool.query(
    `SELECT id, musteri, etkinlik, sehir, yil, tur, ${SURUM} FROM projeler WHERE id <> $1 AND (tur = $2 OR sehir = $3)
     ORDER BY yil DESC NULLS LAST LIMIT 4`, [id, rows[0].tur, rows[0].sehir]);
  res.render('calisma', { baslik: rows[0].etkinlik ? `${rows[0].musteri} — ${rows[0].etkinlik}` : rows[0].musteri, p: rows[0], benzer: benzer.rows });
});

// Proje fotoğrafını veritabanından verir. /gorsel/:id tam boy, /gorsel/:id?boy=kucuk küçük boy (≤600 px).
// Tarayıcı önbelleği: ETag eşleşirse fotoğraf baytları hiç okunmadan 304 döner.
// Adreste ?v=<güncelleme anı> varsa adres fotoğrafa özeldir: bir yıl, değişmez (immutable). v yoksa her seferinde ETag ile
// sorulur (no-cache): fotoğraf değişince eski adres de en geç sonraki istekte yenilenir.
router.get('/gorsel/:id', async (req, res, next) => {
  const id = sayi(req.params.id);
  if (!id) return next();
  const kucuk = tek(req.query.boy) === 'kucuk';
  const surum = tek(req.query.v);
  const surumlu = /^\d{1,16}$/.test(surum);
  const cc = surumlu ? 'public, max-age=31536000, immutable' : 'no-cache';

  // Bellek önbelleği: veritabanına hiç gitmeden aynı başlıklarla (ETag, 304, Cache-Control) yanıt verir
  const onceki = onbellek.al(id, kucuk, surumlu ? surum : '');
  if (onceki) {
    res.set('ETag', onceki.etag);
    res.set('Cache-Control', cc);
    if (req.fresh) return res.status(304).end();
    res.type(onceki.tur);
    return res.send(onceki.veri);
  }

  // Önce yalnız üst bilgi (baytlar değil): fotoğraf var mı, ne zaman / ne kadar değişti
  const bilgi = await pool.query(
    'SELECT gorsel IS NOT NULL AS var, octet_length(gorsel) AS boyut, guncelleme FROM projeler WHERE id = $1', [id]);
  const b = bilgi.rows[0];
  if (!b || !b.var) return res.redirect('/img/gorsel-yok.svg');

  // Küçük boy tam boydan türediği için ikisinin ETag'i de tam boyun boyutundan ve güncelleme anından oluşur
  const etag = onbellek.etagUret(id, kucuk, b.guncelleme.getTime(), b.boyut);
  res.set('ETag', etag);
  res.set('Cache-Control', cc);
  if (req.fresh) return res.status(304).end();

  // Aynı anda gelen aynı görsel istekleri tek okumayı (ve tek sharp işlemini) paylaşır
  const ak = `${id}:${kucuk}:${b.guncelleme.getTime()}`;
  let is = yuklemeler.get(ak);
  if (!is) {
    const nesil = onbellek.mevcutNesil(id);
    is = gorselYukle(id, kucuk).then((s) => {
      if (s && !s.gecici) onbellek.yaz(id, kucuk, { guncelleme: b.guncelleme.getTime(), etag, tur: s.tur, veri: s.veri }, nesil);
      return s;
    }).finally(() => yuklemeler.delete(ak));
    yuklemeler.set(ak, is);
  }
  const s = await is;
  if (!s) return res.redirect('/img/gorsel-yok.svg');
  if (s.gecici) { // geçici çözüm: tam boyu ver, kalıcı önbelleğe yazdırma
    res.removeHeader('ETag');
    res.set('Cache-Control', 'no-cache');
  }
  res.type(s.tur);
  return res.send(s.veri);
});

const yuklemeler = new Map(); // devam eden görsel okumaları

// Baytları okur; küçük boy yoksa üretip kaydeder. Dönüş: { tur, veri, gecici? } ya da null (fotoğraf yok)
async function gorselYukle(id, kucuk) {
  const { rows } = await pool.query('SELECT gorsel, gorsel_tip, gorsel_kucuk FROM projeler WHERE id = $1', [id]);
  const r = rows[0];
  if (!r || !r.gorsel) return null;
  if (!kucuk) return { tur: r.gorsel_tip || 'image/jpeg', veri: r.gorsel };
  if (r.gorsel_kucuk) return { tur: 'image/webp', veri: r.gorsel_kucuk };
  // Eski kayıt: küçük boy henüz yok. Şimdi üretip kaydederiz; sonraki istekler hazırını alır.
  try {
    const uretilen = await kucukUret(id, r.gorsel);
    return { tur: 'image/webp', veri: uretilen };
  } catch (err) {
    console.error(`Küçük boy üretilemedi (proje ${id}):`, err.message);
    return { tur: r.gorsel_tip || 'image/jpeg', veri: r.gorsel, gecici: true };
  }
}

// ---------- Teklif formu ----------

// Projenin türü (projeler.tur) → formdaki etkinlik türü; eşleşmeyen tür boş kalır
const PROJE_TURU_ESLEMESI = { fuar: 'Fuar standı' };

// Form; ana sayfadaki mini formdan ya da bir çalışmadan (?ref=id) gelen değerlerle ön doldurulur.
// Yalnız geçerli görünen değerler alınır, geri kalanı sessizce yok sayılır.
router.get('/teklif', async (req, res) => {
  const q = req.query;
  const tur = tek(q.etkinlik_turu), tarih = tek(q.tarih);
  const deger = {
    metretul: sayi(q.metretul, 5000) || '',
    gun_sayisi: 1,
    kurulum: 'on',
    etkinlik_turu: ETKINLIK_TURLERI.includes(tur) ? tur : '',
    tarih: /^\d{4}-\d{2}-\d{2}$/.test(tarih) ? tarih : '',
    sehir: tek(q.sehir).trim().slice(0, 60),
    mesaj: '',
  };
  let ornek = null;
  const ref = sayi(q.ref);
  if (ref) {
    const { rows } = await pool.query('SELECT musteri, etkinlik, sehir, tur FROM projeler WHERE id = $1', [ref]);
    if (rows[0]) {
      ornek = rows[0];
      deger.mesaj = 'Örnek gösterdiğim iş: ' + ornek.musteri + (ornek.etkinlik ? ' — ' + ornek.etkinlik : '');
      // Projeden ön seçim; adreste açıkça verilen etkinlik_turu / sehir (yukarıda dolduruldu) her zaman önceliklidir.
      // Yalnız kesin eşleşme: proje türü 'fuar' → "Fuar standı". 'etkinlik' / 'kurumsal' birden çok seçeneğe düşer, boş kalır.
      if (!deger.etkinlik_turu && PROJE_TURU_ESLEMESI[rows[0].tur]) deger.etkinlik_turu = PROJE_TURU_ESLEMESI[rows[0].tur];
      if (!deger.sehir && rows[0].sehir) deger.sehir = String(rows[0].sehir).trim().slice(0, 60);
    }
  }
  res.render('teklif', { baslik: 'Teklif iste', turler: ETKINLIK_TURLERI, hatalar: {}, deger, ornek, telefonDeseni: TELEFON_HTML_DESENI });
});

// Hız sınırı: aynı istemciden 15 dakikada en fazla 5 GEÇERLİ teklif. Sayaç anahtarı lib/istemci-ip.js'ten gelir
// (Cloudflare'in CF-Connecting-IP başlığı; yoksa req.ip). Limiter yalnız doğrulamayı geçen gönderime uygulanır: doğrulama hatası (422)
// ve bal küpü yanıtı limiter'dan ÖNCE döner, sayaca girmez; hatasını düzeltip yeniden gönderen gerçek kullanıcı cezalandırılmaz.
// skipFailedRequests KULLANILMAZ: geçerli gönderim, istemci bağlantıyı kessin ya da yanıt hata olsun, her zaman sayılır.
const SINIR_PENCERE_MS = 15 * 60 * 1000;
const teklifSiniri = rateLimit({
  windowMs: SINIR_PENCERE_MS, limit: 5, standardHeaders: true, legacyHeaders: false, keyGenerator: istemciIp.anahtar,
  handler: (req, res) => {
    const reset = req.rateLimit && req.rateLimit.resetTime ? req.rateLimit.resetTime.getTime() : Date.now() + SINIR_PENCERE_MS;
    const dakika = Math.max(1, Math.ceil((reset - Date.now()) / 60000));
    res.status(429).render('teklif', {
      baslik: 'Teklif iste', turler: ETKINLIK_TURLERI, deger: req.girdi || {}, telefonDeseni: TELEFON_HTML_DESENI,
      hatalar: { genel: `Çok fazla teklif gönderildi. Yaklaşık ${dakika} dakika sonra tekrar deneyebilir ya da bizi hemen arayabilirsiniz:` },
      aramaLinki: true,
    });
  },
});

// Form alanı tekrarlanırsa (a=1&a=2) ilk değer alınır; doğrulayıcılar düz metin bekler.
// Kullanıcının yazdığı değerler ayrıca req.girdi'ye kopyalanır: express-validator sadeleştiricileri (telefondan boşluk atma,
// e-posta küçültme…) req.body'yi yerinde değiştirir; hata sayfasında alanlar kullanıcının yazdığı hâliyle (kırpılmış) geri basılır.
function formuDuzlestir(req, res, next) {
  req.body = req.body || {}; // form dışı gövde (text/plain, JSON) ayrıştırılmaz; boş nesne say
  for (const k of Object.keys(req.body)) if (Array.isArray(req.body[k])) req.body[k] = tek(req.body[k]);
  req.girdi = {};
  for (const [k, v] of Object.entries(req.body)) req.girdi[k] = typeof v === 'string' ? v.trim() : v;
  next();
}

// Sıra: düzleştir → doğrula → (bal küpü / 422 burada döner) → hız sınırı → kaydet
function teklifiDogrula(req, res, next) {
  // Bal küpü (honeypot): insanlar bu gizli alanı görmez; doluysa gönderen bir bottur (veritabanına yazılmaz).
  if (req.body.web_sitesi) return res.redirect('/teklif/tesekkurler');

  const sonuc = validationResult(req);
  if (!sonuc.isEmpty()) {
    const hatalar = {};
    for (const h of sonuc.array()) if (!hatalar[h.path]) hatalar[h.path] = h.msg;
    return res.status(422).render('teklif', {
      baslik: 'Teklif iste', turler: ETKINLIK_TURLERI, hatalar, deger: req.girdi, telefonDeseni: TELEFON_HTML_DESENI,
    });
  }
  next();
}

router.post('/teklif', formuDuzlestir, teklifKurallari, teklifiDogrula, teklifSiniri, async (req, res) => {
  const v = matchedData(req);
  const kayit = await pool.query(
    `INSERT INTO teklifler (ad_soyad, firma, telefon, eposta, etkinlik_turu, sehir, tarih, gun_sayisi, metretul, kurulum, mesaj, kvkk_onay)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true) RETURNING *`,
    [v.ad_soyad, v.firma || null, v.telefon, v.eposta, v.etkinlik_turu, v.sehir, v.tarih,
     v.gun_sayisi || 1, v.metretul || null, req.body.kurulum === 'on', v.mesaj || null]
  );
  const t = kayit.rows[0];
  // Yöneticiye e-posta: beklenmez (ziyaretçi hemen yönlenir); hata olursa yalnız loglanır
  bildirim.yeniTeklif(t).catch((err) => console.error('Teklif bildirimi gönderilemedi:', err.message));
  islemGunlugunaYaz(t);
  // Teşekkür sayfası özeti: kişisel veri (ad, telefon, e-posta) yok; yalnız bu oturumda tutulur, adreste taşınmaz, bir kez gösterilir
  req.session.teklifOzet = { tur: t.etkinlik_turu, tarih: v.tarih, sehir: t.sehir };
  res.redirect('/teklif/tesekkurler');
});

// İşlem günlüğü (lib/kayit.js, yönetim paneli): modül yoksa ya da hata verirse teklif akışı etkilenmez
function islemGunlugunaYaz(t) {
  let kayit;
  try { kayit = require('../lib/kayit'); } catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND') console.error('İşlem günlüğü yüklenemedi:', err.message);
    return;
  }
  Promise.resolve()
    .then(() => kayit.kaydet({ tur: 'teklif_geldi', teklif_id: t.id, mesaj: `${t.ad_soyad} — ${t.etkinlik_turu}, ${t.sehir}` }))
    .catch((err) => console.error('İşlem günlüğüne yazılamadı:', err.message));
}

// "15 Mart 2027" (ISO tarih dizgesinden; saat dilimi kaymasın diye UTC)
function uzunTarih(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  return isNaN(d) ? '' : d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

router.get('/teklif/tesekkurler', (req, res) => {
  const o = req.session.teklifOzet;
  delete req.session.teklifOzet; // bir kez gösterilir
  const ozet = o ? { tur: o.tur, tarih: uzunTarih(o.tarih), sehir: o.sehir } : null;
  res.render('tesekkurler', { baslik: 'Talebiniz alındı', ozet });
});

// ---------- KVKK, arama motoru dosyaları ----------

router.get('/kvkk', (req, res) => res.render('kvkk', { baslik: 'KVKK Aydınlatma Metni' }));

// Önizleme (SITE_DEMO=true) arama motorlarına kapalı; gerçek yayında her şey açık, yönetim hariç
// Uyandırma / sağlık denetimi: veritabanına dokunmaz, önbelleğe alınmaz
router.get('/saglik', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.type('text/plain').send('ok');
});

router.get('/robots.txt', (req, res) => {
  const satirlar = process.env.SITE_DEMO === 'true'
    ? ['User-agent: *', 'Disallow: /']
    : ['User-agent: *', 'Allow: /', 'Disallow: /yonetim', '', `Sitemap: ${siteAdresi(req)}/sitemap.xml`];
  res.type('text/plain').send(satirlar.join('\n') + '\n');
});

// Site haritası: sabit sayfalar + her çalışmanın detay sayfası (lastmod = son güncelleme günü)
router.get('/sitemap.xml', async (req, res) => {
  const taban = siteAdresi(req);
  const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const gun = (d) => d.toISOString().slice(0, 10);
  const { rows } = await pool.query('SELECT id, guncelleme FROM projeler ORDER BY id');
  const enYeni = rows.reduce((m, r) => (r.guncelleme > m ? r.guncelleme : m), new Date(0));
  const sayfalar = [
    ['/', null], ['/calismalar', rows.length ? gun(enYeni) : null], ['/hakkimizda', null],
    ['/iletisim', null], ['/teklif', null], ['/kvkk', null],
    ...rows.map((r) => ['/calismalar/' + r.id, gun(r.guncelleme)]),
  ];
  const govde = sayfalar.map(([yol, tarih]) =>
    `  <url><loc>${xml(taban + yol)}</loc>${tarih ? `<lastmod>${tarih}</lastmod>` : ''}</url>`).join('\n');
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${govde}\n</urlset>\n`);
});

// ---------- Bulunamadı / hata (yönetim dahil tüm sitenin son durağı) ----------

router.use((req, res) => res.status(404).render('404', { baslik: 'Sayfa bulunamadı' }));

router.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).render('hata', { baslik: 'Bir sorun oluştu' });
});

module.exports = router;
