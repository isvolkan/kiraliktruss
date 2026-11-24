// v3 iç sayfalar: çalışmalar, proje detayı, hakkımızda, iletişim, teklif, teşekkürler, 404. Çalıştırma: npm test
require('dotenv').config();
const { test, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../app');
const pool = require('../db/pool');

const ETIKET = 'TEST-V3-' + Date.now();
after(async () => {
  await pool.query('DELETE FROM teklifler WHERE ad_soyad LIKE $1', [ETIKET + '%']);
  await pool.end();
});

const yarin = () => { const d = new Date(Date.now() + 86400000); return d.toISOString().slice(0, 10); };

test('v3 iç sayfalar açılıyor, v3 tasarımını ve /v3 bağlantılarını kullanıyor', async () => {
  const { rows } = await pool.query('SELECT id FROM projeler ORDER BY id LIMIT 1');
  const sayfalar = ['/v3/calismalar', '/v3/calismalar?tur=fuar', '/v3/calismalar?gorunum=liste', '/v3/calismalar/' + rows[0].id,
    '/v3/hakkimizda', '/v3/iletisim', '/v3/teklif', '/v3/teklif?metretul=120', '/v3/teklif/tesekkurler'];
  for (const yol of sayfalar) {
    const r = await request(app).get(yol);
    assert.strictEqual(r.status, 200, yol);
    assert.match(r.text, /\/v3\/css\/temel\.css/, yol);
    assert.match(r.text, /href="\/v3\/teklif"/, yol);
    assert.doesNotMatch(r.text, /\/css\/site\.css|\/v2\/(css|js)\//, yol);
    assert.doesNotMatch(r.text, /<h1[^>]*data-/, yol); // başlıklar ilk boyamada görünür
  }
});

test('v3 çalışmalar: türe göre süzgeç bağlantıları var ve süzgeç çalışıyor', async () => {
  const r = await request(app).get('/v3/calismalar');
  for (const t of ['fuar', 'etkinlik', 'kurumsal']) assert.match(r.text, new RegExp('href="/v3/calismalar\\?tur=' + t + '"'), t);
  const e = await request(app).get('/v3/calismalar?tur=kurumsal');
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM projeler WHERE tur = 'kurumsal'");
  assert.match(e.text, new RegExp('<b>' + rows[0].n + '</b> sonuç'));
  assert.match(e.text, /href="\/v3\/calismalar\?tur=kurumsal" class="aktif" aria-current="true"/);
  // Eski süzgeçler korunur
  for (const ad of ['q', 'tur', 'sehir', 'yil', 'gorunum']) assert.match(r.text, new RegExp('name="' + ad + '"'), ad);
});

test('v3 proje detayı: etkinlik şehirle aynıysa künyede bir kez yazılır', async () => {
  const { rows } = await pool.query(`SELECT id, sehir FROM projeler WHERE etkinlik <> '' AND lower(etkinlik) = lower(sehir) LIMIT 1`);
  if (!rows[0]) return; // böyle kayıt yoksa denetlenecek bir şey yok
  const r = await request(app).get('/v3/calismalar/' + rows[0].id);
  assert.strictEqual(r.status, 200);
  assert.doesNotMatch(r.text, /<small>Etkinlik<\/small>/);
  assert.match(r.text, new RegExp('<small>Şehir</small><b>' + rows[0].sehir + '</b>'));
});

test('v3 hakkımızda: kurulum gecesi burada, durağan; belgeler ve onaylı metin var', async () => {
  const r = await request(app).get('/v3/hakkimizda');
  assert.match(r.text, /Bir kurulum gecesi/);
  assert.match(r.text, /22:00/);
  assert.match(r.text, /TÜV/);
  assert.match(r.text, /Nasıl çalışıyoruz/);
  assert.doesNotMatch(r.text, /g11|hakkimizda\.js/);
});

test('v3 iletişim: harita ve niyet satırları', async () => {
  const r = await request(app).get('/v3/iletisim');
  assert.match(r.text, /openstreetmap\.org\/export\/embed\.html/);
  assert.match(r.text, /Ne için yazıyorsunuz/);
});

test('v3 teklif formu: v1/v2 ile aynı alan adları, bal küpü ve /v3/teklif adresine gönderim', async () => {
  const r = await request(app).get('/v3/teklif');
  assert.match(r.text, /<form[^>]*method="post"[^>]*action="\/v3\/teklif"/);
  for (const ad of ['ad_soyad', 'firma', 'telefon', 'eposta', 'etkinlik_turu', 'sehir', 'tarih', 'gun_sayisi', 'metretul', 'kurulum', 'mesaj', 'web_sitesi', 'kvkk']) {
    assert.match(r.text, new RegExp('name="' + ad + '"'), ad);
  }
  const m = await request(app).get('/v3/teklif?metretul=120');
  assert.match(m.text, /name="metretul"[^>]*value="120"/);
});

test('v3 teklif: boş gönderim 422 döner, hatalar v3 tasarımında gösterilir', async () => {
  const r = await request(app).post('/v3/teklif').type('form').send({});
  assert.strictEqual(r.status, 422);
  assert.match(r.text, /\/v3\/css\/sayfalar\.css/);
  assert.match(r.text, /class="alan-hata" id="h-ad_soyad"/);
});

test('v3 teklif: geçerli gönderim kaydedilir ve /v3/teklif/tesekkurler adresine yönlenir', async () => {
  const r = await request(app).post('/v3/teklif').type('form').send({
    ad_soyad: ETIKET + ' Deneme', telefon: '0532 123 45 67', eposta: 'test@example.com',
    etkinlik_turu: 'Fuar standı', sehir: 'İstanbul', tarih: yarin(), gun_sayisi: '2', metretul: '32', kurulum: 'on', kvkk: 'on',
  });
  assert.strictEqual(r.status, 302);
  assert.strictEqual(r.headers.location, '/v3/teklif/tesekkurler');
  const { rows } = await pool.query('SELECT metretul FROM teklifler WHERE ad_soyad = $1', [ETIKET + ' Deneme']);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].metretul, 32);
});

test('v3 teklif: bal küpü dolu gönderim kaydedilmez', async () => {
  const r = await request(app).post('/v3/teklif').type('form').send({ ad_soyad: ETIKET + ' Bot', web_sitesi: 'http://spam.example' });
  assert.strictEqual(r.status, 302);
  assert.strictEqual(r.headers.location, '/v3/teklif/tesekkurler');
  const { rowCount } = await pool.query('SELECT 1 FROM teklifler WHERE ad_soyad = $1', [ETIKET + ' Bot']);
  assert.strictEqual(rowCount, 0);
});

test('v3 404: olmayan sayfa ve olmayan proje 404, v3 tasarımıyla döner', async () => {
  for (const yol of ['/v3/yok-boyle-sayfa', '/v3/calismalar/999999']) {
    const r = await request(app).get(yol);
    assert.strictEqual(r.status, 404, yol);
    assert.match(r.text, /Bu truss burada kurulmadı/);
    assert.match(r.text, /\/v3\/css\/sayfalar\.css/);
    assert.match(r.text, /href="\/v3\/"/);
  }
});
