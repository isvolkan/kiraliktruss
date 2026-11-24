// Yönetim paneli testleri: giriş koruması, CSRF, proje CRUD (fotoğraf işleme dahil), teklif takibi, CSV, şifre değiştirme.
// Çalıştırma: npm test   (yerel veritabanı çalışıyor, npm run seed yapılmış ve göçler uygulanmış olmalı)
require('dotenv').config();
const { test, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const bcrypt = require('bcryptjs');
const request = require('supertest');
const app = require('../app');
const pool = require('../db/pool');

const ETIKET = 'TEST-yonetim-' + Date.now(); // testin oluşturduğu kayıtları bulup silmek için
const GECICI_EPOSTA = `test-${Date.now()}@ornek.invalid`; // şifre testi için geçici hesap (asıl yönetici hesabına dokunulmaz)
const FOTO = path.join(__dirname, '..', 'veri', 'eski-gorseller', '1543314354_ari-makina-foteg-2013.jpg');

after(async () => {
  await pool.query('DELETE FROM teklifler WHERE ad_soyad LIKE $1', [ETIKET + '%']);
  await pool.query('DELETE FROM projeler WHERE musteri LIKE $1', [ETIKET + '%']);
  await pool.query('DELETE FROM kullanicilar WHERE eposta = $1', [GECICI_EPOSTA]);
  await pool.query(`DELETE FROM oturumlar WHERE sess->'kullanici'->>'eposta' = $1`, [GECICI_EPOSTA]);
  await pool.end();
});

// Sayfadaki gizli CSRF jetonunu okur
function jetonu(html) {
  const m = html.match(/name="_csrf" value="([0-9a-f]{64})"/);
  assert.ok(m, 'sayfada CSRF jetonu yok');
  return m[1];
}

// Giriş yapar; ajan (çerezli istemci) ve girişten sonraki jetonu döner
async function girisYap(eposta = process.env.ADMIN_EMAIL, sifre = process.env.ADMIN_PASSWORD) {
  const ajan = request.agent(app);
  const sayfa = await ajan.get('/yonetim/giris');
  const r = await ajan.post('/yonetim/giris').type('form').send({ _csrf: jetonu(sayfa.text), eposta, sifre });
  assert.strictEqual(r.status, 302);
  // Oturum kimliği girişte yenilendiği için jeton da yenidir; panodan okunur
  const pano = await ajan.get('/yonetim');
  assert.strictEqual(pano.status, 200);
  return { ajan, jeton: jetonu(pano.text) };
}

// Giriş hız sınırı (15 dakikada 10 deneme) aşılmasın diye testlerin çoğu tek oturumu paylaşır
let ortak;
async function yonetici() { if (!ortak) ortak = await girisYap(); return ortak; }

async function teklifEkle(ek = '') {
  const { rows } = await pool.query(
    `INSERT INTO teklifler (ad_soyad, firma, telefon, eposta, etkinlik_turu, sehir, tarih, kvkk_onay)
     VALUES ($1, 'Deneme; "Tırnak" A.Ş.', '05321234567', 'a@ornek.com', 'Fuar standı', 'İzmir', now() + interval '7 days', true)
     RETURNING id`, [ETIKET + ek]);
  return rows[0].id;
}

test('yönetim: girişsiz erişim giriş sayfasına yönlenir, girişten sonra istenen sayfaya dönülür', async () => {
  for (const yol of ['/yonetim', '/yonetim/projeler', '/yonetim/teklifler', '/yonetim/teklifler.csv', '/yonetim/hesap']) {
    const r = await request(app).get(yol);
    assert.strictEqual(r.status, 302, yol);
    assert.strictEqual(r.headers.location, '/yonetim/giris', yol);
  }
  const ajan = request.agent(app);
  await ajan.get('/yonetim/teklifler?durum=yeni').expect(302);
  const sayfa = await ajan.get('/yonetim/giris');
  const r = await ajan.post('/yonetim/giris').type('form')
    .send({ _csrf: jetonu(sayfa.text), eposta: process.env.ADMIN_EMAIL, sifre: process.env.ADMIN_PASSWORD });
  assert.strictEqual(r.headers.location, '/yonetim/teklifler?durum=yeni');
});

test('yönetim: yanlış şifre 401, jetonsuz POST 403', async () => {
  const ajan = request.agent(app);
  const sayfa = await ajan.get('/yonetim/giris');
  const y = await ajan.post('/yonetim/giris').type('form')
    .send({ _csrf: jetonu(sayfa.text), eposta: process.env.ADMIN_EMAIL, sifre: 'yanlis-sifre' });
  assert.strictEqual(y.status, 401);
  assert.match(y.text, /E-posta ya da şifre hatalı/);

  // Jetonsuz ya da yanlış jetonlu giriş denemesi
  const j = await ajan.post('/yonetim/giris').type('form').send({ eposta: process.env.ADMIN_EMAIL, sifre: process.env.ADMIN_PASSWORD });
  assert.strictEqual(j.status, 403);
  assert.match(j.text, /İşlem reddedildi/);

  // Girişliyken jetonsuz silme / güncelleme / fotoğraflı form reddedilir, kayıt değişmez
  const { ajan: yon } = await yonetici();
  const id = await teklifEkle(' CSRF');
  await yon.post(`/yonetim/teklifler/${id}/sil`).type('form').send({}).expect(403);
  await yon.post(`/yonetim/teklifler/${id}`).type('form').send({ durum: 'kapandi', _csrf: 'a'.repeat(64) }).expect(403);
  await yon.post('/yonetim/projeler').field('musteri', ETIKET + ' CSRF').field('tur', 'fuar').attach('gorsel', FOTO).expect(403);
  await yon.post('/yonetim/cikis').expect(403);
  const { rows } = await pool.query('SELECT durum FROM teklifler WHERE id = $1', [id]);
  assert.strictEqual(rows[0].durum, 'yeni');
  const p = await pool.query('SELECT 1 FROM projeler WHERE musteri = $1', [ETIKET + ' CSRF']);
  assert.strictEqual(p.rowCount, 0);
});

test('yönetim: proje ekle (fotoğraf WebP + küçük boy), süz, düzenle, sil', async () => {
  const { ajan, jeton } = await yonetici();

  // Doğrulama: hatalar alan altında, girilen değer korunur
  const eksik = await ajan.post('/yonetim/projeler')
    .field('_csrf', jeton).field('musteri', ETIKET + ' Firma').field('yil', '1990').field('tur', 'fuar');
  assert.strictEqual(eksik.status, 422);
  assert.match(eksik.text, /Yıl 2000–2100 arası olmalı/);
  assert.match(eksik.text, /Bir fotoğraf seçin/);
  assert.match(eksik.text, new RegExp(`value="${ETIKET} Firma"`));

  await ajan.post('/yonetim/projeler')
    .field('_csrf', jeton).field('musteri', ETIKET + ' Firma').field('etkinlik', 'Deneme Fuarı').field('sehir', 'İstanbul')
    .field('yil', '2026').field('tur', 'fuar').attach('gorsel', FOTO).expect(302);
  const { rows } = await pool.query(
    `SELECT id, gorsel_tip, octet_length(gorsel_kucuk) AS kucuk, substring(gorsel from 9 for 4) AS imza
     FROM projeler WHERE musteri = $1`, [ETIKET + ' Firma']);
  assert.strictEqual(rows.length, 1);
  const { id } = rows[0];
  // lib/gorsel.js: tam boy WebP'ye çevrildi, küçük boy üretildi
  assert.strictEqual(rows[0].gorsel_tip, 'image/webp');
  assert.strictEqual(rows[0].imza.toString('latin1'), 'WEBP');
  assert.ok(rows[0].kucuk > 0);

  // Arama + yıl + tür süzgeci
  const bulunan = await ajan.get(`/yonetim/projeler?q=${encodeURIComponent(ETIKET)}&yil=2026&tur=fuar`);
  assert.match(bulunan.text, /<b>1<\/b> proje bulundu/);
  const bos = await ajan.get(`/yonetim/projeler?q=${encodeURIComponent(ETIKET)}&tur=kurumsal`);
  assert.match(bos.text, /<b>0<\/b> proje bulundu/);
  // Dizi gelen sorgu parametresi 500 vermez
  await ajan.get('/yonetim/projeler?q=a&q=b&sayfa=x').expect(200);

  // Düzenleme sayfasında mevcut fotoğraf önizlemesi
  const duzen = await ajan.get(`/yonetim/projeler/${id}/duzenle`);
  assert.match(duzen.text, new RegExp(`/gorsel/${id}\\?boy=kucuk`));

  // Fotoğrafsız güncelleme: eski fotoğraf korunur
  await ajan.post('/yonetim/projeler/' + id)
    .field('_csrf', jeton).field('musteri', ETIKET + ' Firma').field('etkinlik', 'Güncel Fuar').field('yil', '2025')
    .field('tur', 'etkinlik').field('one_cikan', 'on').expect(302);
  const g = await pool.query('SELECT etkinlik, yil, tur, one_cikan, gorsel IS NOT NULL AS foto FROM projeler WHERE id = $1', [id]);
  assert.deepStrictEqual(g.rows[0], { etkinlik: 'Güncel Fuar', yil: 2025, tur: 'etkinlik', one_cikan: true, foto: true });

  await ajan.post(`/yonetim/projeler/${id}/sil`).type('form').send({ _csrf: jeton }).expect(302);
  const s = await pool.query('SELECT 1 FROM projeler WHERE id = $1', [id]);
  assert.strictEqual(s.rowCount, 0);
});

test('yönetim: içeriği fotoğraf olmayan .jpg reddedilir (dosya imzası)', async () => {
  const { ajan, jeton } = await yonetici();
  const r = await ajan.post('/yonetim/projeler')
    .field('_csrf', jeton).field('musteri', ETIKET + ' Sahte').field('tur', 'fuar')
    .attach('gorsel', Buffer.from('Bu bir metin dosyası, fotoğraf değil.'), { filename: 'tatil.jpg', contentType: 'image/jpeg' });
  assert.strictEqual(r.status, 422);
  assert.match(r.text, /dosyanın içeriği fotoğraf değil/);
  const { rowCount } = await pool.query('SELECT 1 FROM projeler WHERE musteri = $1', [ETIKET + ' Sahte']);
  assert.strictEqual(rowCount, 0);
});

test('yönetim: teklif açılınca okundu olur; durum ve not güncellenir; okunmamış rozeti', async () => {
  const { ajan, jeton } = await yonetici();
  const id = await teklifEkle(' Takip');

  const liste = await ajan.get('/yonetim/teklifler?q=' + encodeURIComponent(ETIKET + ' Takip'));
  assert.match(liste.text, /y-okunmamis/);
  assert.match(liste.text, /class="y-rozet"/);

  const detay = await ajan.get('/yonetim/teklifler/' + id);
  assert.strictEqual(detay.status, 200);
  assert.match(detay.text, /İzmir/);
  let { rows } = await pool.query('SELECT okundu FROM teklifler WHERE id = $1', [id]);
  assert.strictEqual(rows[0].okundu, true);

  // Geçersiz durum reddedilir
  const kotu = await ajan.post('/yonetim/teklifler/' + id).type('form').send({ _csrf: jeton, durum: 'uydurma' });
  assert.strictEqual(kotu.status, 422);
  assert.match(kotu.text, /Geçerli bir durum seçin/);

  await ajan.post('/yonetim/teklifler/' + id).type('form')
    .send({ _csrf: jeton, durum: 'teklif_verildi', yonetici_notu: 'Fiyat gönderildi, cuma aranacak' }).expect(302);
  ({ rows } = await pool.query('SELECT durum, yonetici_notu, guncellendi FROM teklifler WHERE id = $1', [id]));
  assert.strictEqual(rows[0].durum, 'teklif_verildi');
  assert.strictEqual(rows[0].yonetici_notu, 'Fiyat gönderildi, cuma aranacak');
  assert.ok(rows[0].guncellendi);

  await ajan.post(`/yonetim/teklifler/${id}/okunmadi`).type('form').send({ _csrf: jeton }).expect(302);
  ({ rows } = await pool.query('SELECT okundu FROM teklifler WHERE id = $1', [id]));
  assert.strictEqual(rows[0].okundu, false);

  await ajan.post(`/yonetim/teklifler/${id}/sil`).type('form').send({ _csrf: jeton }).expect(302);
  const s = await pool.query('SELECT 1 FROM teklifler WHERE id = $1', [id]);
  assert.strictEqual(s.rowCount, 0);
});

test('yönetim: teklifler CSV (UTF-8 BOM, ; ayırıcı, Türkçe karakter, tırnak kaçışı)', async () => {
  const { ajan } = await yonetici();
  await teklifEkle(' CSV Şükrü');
  const r = await ajan.get('/yonetim/teklifler.csv?q=' + encodeURIComponent(ETIKET + ' CSV')).buffer(true).parse((res, cb) => {
    const parcalar = [];
    res.on('data', (p) => parcalar.push(p));
    res.on('end', () => cb(null, Buffer.concat(parcalar)));
  });
  assert.strictEqual(r.status, 200);
  assert.match(r.headers['content-type'], /^text\/csv; charset=utf-8/);
  assert.match(r.headers['content-disposition'], /attachment; filename="teklifler-\d{4}-\d{2}-\d{2}\.csv"/);
  const govde = r.body;
  assert.deepStrictEqual([...govde.subarray(0, 3)], [0xef, 0xbb, 0xbf]); // BOM
  const metin = govde.toString('utf8').slice(1);
  const satirlar = metin.trim().split('\r\n');
  assert.match(satirlar[0], /^No;Geliş;Ad soyad;Firma;Telefon/);
  assert.strictEqual(satirlar.length, 2);
  assert.ok(satirlar[1].includes(ETIKET + ' CSV Şükrü'));
  assert.ok(satirlar[1].includes('"Deneme; ""Tırnak"" A.Ş."'));
  assert.ok(satirlar[1].includes('0532 123 45 67'));
});

test('yönetim: şifre değiştirme (mevcut şifre, en az 10 karakter, eski şifre artık geçmez)', async () => {
  const eski = 'gecici-sifre-123';
  const yeni = 'yepyeni-sifre-456';
  await pool.query('INSERT INTO kullanicilar (eposta, sifre_hash) VALUES ($1, $2)', [GECICI_EPOSTA, await bcrypt.hash(eski, 10)]);
  const { ajan, jeton } = await girisYap(GECICI_EPOSTA, eski);

  const kisa = await ajan.post('/yonetim/hesap/sifre').type('form').send({ _csrf: jeton, mevcut: eski, yeni: 'kisa', yeni_tekrar: 'kisa' });
  assert.strictEqual(kisa.status, 422);
  assert.match(kisa.text, /10–72 karakter/);
  const yanlis = await ajan.post('/yonetim/hesap/sifre').type('form').send({ _csrf: jeton, mevcut: 'yanlis-sifre-0', yeni, yeni_tekrar: yeni });
  assert.strictEqual(yanlis.status, 422);
  assert.match(yanlis.text, /Mevcut şifre yanlış/);

  const r = await ajan.post('/yonetim/hesap/sifre').type('form').send({ _csrf: jeton, mevcut: eski, yeni, yeni_tekrar: yeni });
  assert.strictEqual(r.status, 302);
  // Oturum kimliği yenilendi ama giriş sürüyor
  const hesap = await ajan.get('/yonetim/hesap');
  assert.strictEqual(hesap.status, 200);
  assert.match(hesap.text, /Şifreniz değiştirildi/);

  // Eski şifreyle giriş artık olmaz, yenisiyle olur
  const deneme = request.agent(app);
  const sayfa = await deneme.get('/yonetim/giris');
  await deneme.post('/yonetim/giris').type('form').send({ _csrf: jetonu(sayfa.text), eposta: GECICI_EPOSTA, sifre: eski }).expect(401);
  await girisYap(GECICI_EPOSTA, yeni);
});

test('yönetim: tüm sayfalar açılıyor, tek h1, çıkış ana siteye döner', async () => {
  const { ajan, jeton } = await girisYap();
  const { rows } = await pool.query('SELECT id FROM projeler LIMIT 1');
  for (const yol of ['/yonetim', '/yonetim/projeler', '/yonetim/projeler?sayfa=2', '/yonetim/projeler/yeni',
    `/yonetim/projeler/${rows[0].id}/duzenle`, '/yonetim/teklifler', '/yonetim/teklifler?durum=yeni', '/yonetim/hesap']) {
    const r = await ajan.get(yol);
    assert.strictEqual(r.status, 200, yol);
    assert.strictEqual((r.text.match(/<h1[\s>]/g) || []).length, 1, yol + ' tek h1');
    assert.doesNotMatch(r.text, /yonetim-eski|partials\//, yol + ' eski tasarım bağlantısı');
    assert.match(r.text, /\/css\/yonetim\.css/, yol);
  }
  await ajan.get('/yonetim/yok-boyle').expect(404);
  const c = await ajan.post('/yonetim/cikis').type('form').send({ _csrf: jeton });
  assert.strictEqual(c.headers.location, '/');
  await ajan.get('/yonetim').expect(302);
});

test('D7 yönetim menüsü: bulunulan sayfanın bağlantısı aria-current="page" taşır', async () => {
  const { ajan } = await yonetici();
  const etkinler = (html) => [...new Set([...html.matchAll(/<a href="([^"]+)" aria-current="page">/g)].map((m) => m[1]))];
  assert.deepStrictEqual(etkinler((await ajan.get('/yonetim/projeler')).text), ['/yonetim/projeler']);
  assert.deepStrictEqual(etkinler((await ajan.get('/yonetim')).text), ['/yonetim']);
  assert.deepStrictEqual(etkinler((await ajan.get('/yonetim/hesap')).text), ['/yonetim/hesap']);
  const id = await teklifEkle(' menu');
  assert.deepStrictEqual(etkinler((await ajan.get('/yonetim/teklifler/' + id)).text), ['/yonetim/teklifler']);
});

test('D9 yönetim 403 sayfası: "İçeriğe geç" bağlantısı var', async () => {
  const r = await request(app).post('/yonetim/giris').type('form').send({ eposta: 'a@b.c', sifre: 'x' }); // jetonsuz → 403
  assert.strictEqual(r.status, 403);
  assert.match(r.text, /<a class="atla" href="#icerik">İçeriğe geç<\/a>/);
  assert.match(r.text, /id="icerik"/);
});
