// v4 arayüzü: sayfalar çiziliyor mu, iç bağlantılar /v4 önekli mi, teklif formu sözleşmeye uyuyor mu.
// Çalıştırma: npm test   (yerel veritabanı çalışıyor ve npm run seed yapılmış olmalı)
require('dotenv').config();
const { test, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../app');
const pool = require('../db/pool');

const ETIKET = 'TEST-v4-' + Date.now(); // testin oluşturduğu teklifleri bulup silmek için

after(async () => {
  await pool.query('DELETE FROM teklifler WHERE ad_soyad LIKE $1', [ETIKET + '%']);
  await pool.end();
});

function yarin() { return new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10); }
const say = (html) => Number(html.match(/Arşiv · (\d+) proje/)[1]);

// Sayfadaki tüm href/action değerlerinden site içi olanları döndürür
function icBaglantilar(html) {
  return [...html.matchAll(/\s(?:href|action)="([^"]*)"/g)].map((m) => m[1])
    .filter((u) => u.startsWith('/') && !u.startsWith('//'));
}

const SAYFALAR = ['/v4', '/v4/calismalar', '/v4/calismalar?gorunum=liste', '/v4/hakkimizda', '/v4/iletisim', '/v4/teklif'];

test('v4 sayfaları açılıyor ve v4 görünümleriyle çiziliyor', async () => {
  for (const yol of SAYFALAR) {
    const r = await request(app).get(yol);
    assert.strictEqual(r.status, 200, yol);
    assert.match(r.text, /<html lang="tr">/, yol);
    assert.match(r.text, /\/v4\/css\/v4\.css/, yol + ' v4 stilini yüklemeli');
    assert.match(r.text, /href="\/v4\/teklif"/, yol + ' teklif çağrısı olmalı'); // her sayfada teklif çağrısı
    assert.match(r.text, /href="tel:\+90/, yol + ' telefon çağrısı olmalı');
    assert.strictEqual((r.text.match(/<h1[\s>]/g) || []).length, 1, yol + ' tek h1 olmalı');
  }
  const ana = await request(app).get('/v4');
  assert.match(ana.text, /taşıyıcı iskeleti/);
  assert.match(ana.text, /data-hesap/, 'ana sayfada metretül hesaplayıcı olmalı');
});

test('iç bağlantıların hepsi /v4 önekli (yönetim, fotoğraf ve statik dosyalar hariç)', async () => {
  const izinli = /^\/(v4(\/|$|\?|#)|yonetim|gorsel\/|img\/)/;
  for (const yol of SAYFALAR) {
    const r = await request(app).get(yol);
    for (const u of icBaglantilar(r.text)) assert.match(u, izinli, `${yol} içinde önek dışı bağlantı: ${u}`);
  }
});

test('çalışmalar: süzme, arama, liste görünümü ve sayfalama', async () => {
  const hepsi = await request(app).get('/v4/calismalar');
  const etkinlik = await request(app).get('/v4/calismalar?tur=etkinlik');
  assert.ok(say(etkinlik.text) > 0 && say(etkinlik.text) < say(hepsi.text));
  assert.match(etkinlik.text, /value="etkinlik" checked/);

  const liste = await request(app).get('/v4/calismalar?gorunum=liste');
  assert.match(liste.text, /<table class="liste">/);
  assert.match(liste.text, /href="\/v4\/calismalar\?gorunum=liste&amp;sayfa=2"|href="\/v4\/calismalar\?gorunum=liste&sayfa=2"/, 'sayfalama görünümü korumalı');

  const ikinci = await request(app).get('/v4/calismalar?sayfa=2');
  assert.strictEqual(ikinci.status, 200);
  assert.match(ikinci.text, /aria-current="page">2</);

  const kotu = await request(app).get("/v4/calismalar?q=' OR 1=1 --");
  assert.strictEqual(kotu.status, 200);
  assert.strictEqual(say(kotu.text), 0);
  assert.match(kotu.text, /Bu süzgece uyan proje yok/);
});

test('proje ayrıntısı, benzer işler ve teklife referans taşıma', async () => {
  const { rows } = await pool.query('SELECT id, musteri FROM projeler ORDER BY id LIMIT 1');
  const r = await request(app).get('/v4/calismalar/' + rows[0].id);
  assert.strictEqual(r.status, 200);
  assert.match(r.text, new RegExp(`src="/gorsel/${rows[0].id}"`));
  assert.match(r.text, new RegExp(`href="/v4/teklif\\?ref=${rows[0].id}"`));

  const teklif = await request(app).get('/v4/teklif?ref=' + rows[0].id);
  assert.match(teklif.text, /projesine benzer bir kurulum/);

  const yok = await request(app).get('/v4/calismalar/99999999');
  assert.strictEqual(yok.status, 404);
});

test('bilinmeyen v4 sayfası 404 ve v4 görünümüyle döner', async () => {
  const r = await request(app).get('/v4/yok');
  assert.strictEqual(r.status, 404);
  assert.match(r.text, /Bu ölçü çizimde yok/);
  assert.match(r.text, /\/v4\/css\/v4\.css/);
});

test('teklif formu sözleşmedeki alan adlarını taşır', async () => {
  const r = await request(app).get('/v4/teklif?metretul=120');
  assert.match(r.text, /action="\/v4\/teklif" method="post"/);
  for (const ad of ['ad_soyad', 'firma', 'telefon', 'eposta', 'etkinlik_turu', 'sehir', 'tarih', 'gun_sayisi', 'metretul', 'kurulum', 'mesaj', 'kvkk', 'web_sitesi']) {
    assert.match(r.text, new RegExp(`name="${ad}"`), ad);
  }
  assert.match(r.text, /name="metretul"[^>]*value="120"/, 'metretül ön dolu açılmalı');
  assert.match(r.text, /name="web_sitesi" type="text" tabindex="-1" autocomplete="off"/);
  // Her görünür alanın etiketi var
  for (const id of ['ad_soyad', 'telefon', 'eposta', 'etkinlik_turu', 'sehir', 'tarih']) assert.match(r.text, new RegExp(`for="${id}"`), id);
});

test('hatalı teklif 422 döner, hatalar alanın yanında, girilenler korunur', async () => {
  const r = await request(app).post('/v4/teklif').type('form')
    .send({ ad_soyad: 'A', telefon: '123', eposta: 'olmaz', sehir: 'İstanbul', tarih: '2000-01-01', firma: 'Deneme Fuarcılık' });
  assert.strictEqual(r.status, 422);
  assert.match(r.text, /role="alert"/);
  assert.match(r.text, /id="ad_soyad-hata"/);
  assert.match(r.text, /aria-describedby="telefon-hata" aria-invalid="true"/);
  assert.match(r.text, /id="kvkk-hata"/);
  assert.match(r.text, /Tarih bugünden önce olamaz/);
  assert.match(r.text, /value="Deneme Fuarcılık"/, 'girilen değer korunmalı');
});

test('geçerli teklif kaydedilir ve /v4 teşekkür sayfasına yönlenir', async () => {
  const r = await request(app).post('/v4/teklif').type('form').send({
    ad_soyad: ETIKET + ' Ayşe', telefon: '0532 123 45 67', eposta: 'ayse@example.com', etkinlik_turu: 'Fuar standı',
    sehir: 'İstanbul', tarih: yarin(), gun_sayisi: '3', metretul: '120', kurulum: 'on', kvkk: 'on', web_sitesi: '',
  });
  assert.strictEqual(r.status, 302);
  assert.strictEqual(r.headers.location, '/v4/teklif/tesekkurler');
  const { rows } = await pool.query('SELECT metretul, kurulum FROM teklifler WHERE ad_soyad = $1', [ETIKET + ' Ayşe']);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].metretul, 120);

  const tesekkur = await request(app).get('/v4/teklif/tesekkurler');
  assert.strictEqual(tesekkur.status, 200);
  assert.match(tesekkur.text, /Talebiniz alındı/);
});

test('rehbere ekle: vCard firma bilgisini verir', async () => {
  const r = await request(app).get('/v4/kartvizit.vcf');
  assert.strictEqual(r.status, 200);
  assert.match(r.headers['content-type'], /text\/vcard/);
  assert.match(r.text, /BEGIN:VCARD/);
  assert.match(r.text, /TEL;TYPE=WORK,VOICE:\+90 212 222 96 95/);
});

test('v4 varlıkları sunuluyor', async () => {
  for (const yol of ['/v4/css/v4.css', '/v4/js/v4.js', '/v4/js/erken.js']) {
    const r = await request(app).get(yol);
    assert.strictEqual(r.status, 200, yol);
  }
});
