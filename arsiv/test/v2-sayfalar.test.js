// v2 iç sayfalar: hakkımızda, iletişim, teklif formu, teşekkürler, 404. Çalıştırma: npm test
require('dotenv').config();
const { test, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../app');
const pool = require('../db/pool');

const ETIKET = 'TEST-V2-' + Date.now();
after(async () => {
  await pool.query('DELETE FROM teklifler WHERE ad_soyad LIKE $1', [ETIKET + '%']);
  await pool.end();
});

const yarin = () => { const d = new Date(Date.now() + 86400000); return d.toISOString().slice(0, 10); };

test('v2 iç sayfalar açılıyor, v2 tasarımını ve /v2 bağlantılarını kullanıyor', async () => {
  for (const yol of ['/v2/hakkimizda', '/v2/iletisim', '/v2/teklif', '/v2/teklif?metretul=120', '/v2/teklif/tesekkurler']) {
    const r = await request(app).get(yol);
    assert.strictEqual(r.status, 200, yol);
    assert.match(r.text, /\/v2\/css\/sayfalar\.css/, yol);
    assert.match(r.text, /href="\/v2\/teklif"/, yol);
    assert.doesNotMatch(r.text, /\/css\/site\.css/, yol);
  }
  const h = await request(app).get('/v2/hakkimizda');
  assert.match(h.text, /\/v2\/js\/hakkimizda\.js/);
  assert.match(h.text, /TÜV/);
  const i = await request(app).get('/v2/iletisim');
  assert.match(i.text, /openstreetmap\.org\/export\/embed\.html/);
  assert.match(i.text, /Ne için yazıyorsunuz/);
});

test('v2 teklif formu: v1 ile aynı alan adları, bal küpü ve /v2/teklif adresine gönderim', async () => {
  const r = await request(app).get('/v2/teklif');
  assert.match(r.text, /<form[^>]*method="post"[^>]*action="\/v2\/teklif"|<form[^>]*action="\/v2\/teklif"[^>]*method="post"/);
  for (const ad of ['ad_soyad', 'firma', 'telefon', 'eposta', 'etkinlik_turu', 'sehir', 'tarih', 'gun_sayisi', 'metretul', 'kurulum', 'mesaj', 'web_sitesi', 'kvkk']) {
    assert.match(r.text, new RegExp('name="' + ad + '"'), ad);
  }
  assert.match(r.text, /Fuar standı/);
});

test('v2 teklif: ?metretul= ön doldurması çalışıyor, geçersiz değer yok sayılıyor', async () => {
  const r = await request(app).get('/v2/teklif?metretul=120');
  assert.match(r.text, /name="metretul"[^>]*value="120"/);
  assert.match(r.text, /120 mt/);
  const k = await request(app).get('/v2/teklif?metretul=99999');
  assert.doesNotMatch(k.text, /name="metretul"[^>]*value="99999"/);
});

test('v2 teklif: boş gönderim 422 döner, hatalar v2 tasarımında alanın yanında gösterilir', async () => {
  const r = await request(app).post('/v2/teklif').type('form').send({});
  assert.strictEqual(r.status, 422);
  assert.match(r.text, /\/v2\/css\/sayfalar\.css/);
  assert.match(r.text, /class="alan-hata" id="h-ad_soyad"/);
  assert.match(r.text, /aria-invalid="true"/);
  for (const mesaj of ['Ad soyad 3–80', 'Geçerli bir telefon', 'Geçerli bir e-posta', 'Etkinlik türünü seçin', 'aydınlatma metnini onaylayın']) {
    assert.ok(r.text.includes(mesaj), mesaj);
  }
});

test('v2 teklif: hatalı gönderimde eski değerler korunur ve kaçışlanır', async () => {
  const r = await request(app).post('/v2/teklif').type('form').send({ ad_soyad: ETIKET + ' "<b>x</b>', telefon: '123' });
  assert.strictEqual(r.status, 422);
  assert.ok(r.text.includes(ETIKET));
  assert.doesNotMatch(r.text, /<b>x<\/b>/);
});

test('v2 teklif: geçerli gönderim kaydedilir ve /v2/teklif/tesekkurler adresine yönlenir', async () => {
  const r = await request(app).post('/v2/teklif').type('form').send({
    ad_soyad: ETIKET + ' Deneme', firma: 'Test A.Ş.', telefon: '0532 123 45 67', eposta: 'test@example.com',
    etkinlik_turu: 'Fuar standı', sehir: 'İstanbul', tarih: yarin(), gun_sayisi: '2', metretul: '48', kurulum: 'on', kvkk: 'on',
  });
  assert.strictEqual(r.status, 302);
  assert.strictEqual(r.headers.location, '/v2/teklif/tesekkurler');
  const { rows } = await pool.query('SELECT metretul FROM teklifler WHERE ad_soyad = $1', [ETIKET + ' Deneme']);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].metretul, 48);
});

test('v2 teklif: bal küpü dolu gönderim kaydedilmez, teşekkürler sayfasına yönlenir', async () => {
  const r = await request(app).post('/v2/teklif').type('form').send({ ad_soyad: ETIKET + ' Bot', web_sitesi: 'http://spam.example' });
  assert.strictEqual(r.status, 302);
  assert.strictEqual(r.headers.location, '/v2/teklif/tesekkurler');
  const { rowCount } = await pool.query('SELECT 1 FROM teklifler WHERE ad_soyad = $1', [ETIKET + ' Bot']);
  assert.strictEqual(rowCount, 0);
});

test('v2 teşekkürler sayfasında ana sayfa ve çalışmalara dönüş bağlantıları var', async () => {
  const r = await request(app).get('/v2/teklif/tesekkurler');
  assert.match(r.text, /Teşekkürler/);
  assert.match(r.text, /href="\/v2\/"/);
  assert.match(r.text, /href="\/v2\/calismalar"/);
});

test('v2 404: olmayan sayfa 404 ve v2 tasarımıyla döner', async () => {
  const r = await request(app).get('/v2/yok-boyle-sayfa');
  assert.strictEqual(r.status, 404);
  assert.match(r.text, /Bu truss burada kurulmadı/);
  assert.match(r.text, /\/v2\/css\/sayfalar\.css/);
  assert.match(r.text, /href="\/v2\/"/);
});

test('v1 sayfaları değişmedi', async () => {
  const r = await request(app).get('/hakkimizda');
  assert.strictEqual(r.status, 200);
  assert.match(r.text, /\/css\/site\.css/);
  assert.doesNotMatch(r.text, /\/v2\//);
});
