// v5 ("yön tabelası") duman testleri: sayfalar, bağlantı öneki, ön doldurma, form doğrulama ve gönderim.
require('dotenv').config();
const { test, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../app');
const pool = require('../db/pool');

const ETIKET = 'TEST-v5-' + Date.now();

after(async () => {
  await pool.query('DELETE FROM teklifler WHERE ad_soyad LIKE $1', [ETIKET + '%']);
  await pool.end();
});

function yarin() { return new Date(Date.now() + 86400000).toISOString().slice(0, 10); }
async function birProje() { return (await pool.query('SELECT id, musteri, etkinlik FROM projeler ORDER BY id LIMIT 1')).rows[0]; }

test('v5: tüm sayfalar açılıyor, bilinmeyen sayfa 404', async () => {
  const p = await birProje();
  for (const yol of ['/v5', '/v5/calismalar', '/v5/calismalar?gorunum=liste', '/v5/calismalar?tur=fuar&sayfa=2',
    '/v5/calismalar/' + p.id, '/v5/hakkimizda', '/v5/iletisim', '/v5/teklif', '/v5/teklif/tesekkurler']) {
    const r = await request(app).get(yol);
    assert.strictEqual(r.status, 200, yol);
    assert.strictEqual((r.text.match(/<h1[\s>]/g) || []).length, 1, yol + ' tek h1');
  }
  const y = await request(app).get('/v5/yok');
  assert.strictEqual(y.status, 404);
  assert.match(y.text, /Bu sayfayı bulamadık\./);
});

test('v5: iç bağlantılar /v5 önekli', async () => {
  for (const yol of ['/v5', '/v5/calismalar', '/v5/hakkimizda', '/v5/iletisim', '/v5/teklif']) {
    const r = await request(app).get(yol);
    const hrefler = [...r.text.matchAll(/(?:href|action)="(\/[^"]*)"/g)].map(m => m[1]);
    for (const h of hrefler) {
      const izinli = h.startsWith('/v5') || h === '/yonetim' || h.startsWith('/img/') || h.startsWith('/gorsel/');
      assert.ok(izinli, `${yol}: ${h}`);
    }
  }
});

test('v5: ana sayfada mini form ve hesaplayıcı', async () => {
  const r = await request(app).get('/v5');
  assert.match(r.text, /<form[^>]*method="get"[^>]*action="\/v5\/teklif"/);
  for (const ad of ['etkinlik_turu', 'tarih', 'sehir']) assert.match(r.text, new RegExp(`name="${ad}"`), ad);
  assert.match(r.text, /id="hesapla"/);
  assert.match(r.text, /Truss kiralıyoruz\./);
});

test('v5: çalışmalar liste görünümü tablo çizer, süzgeç daraltır', async () => {
  const r = await request(app).get('/v5/calismalar?tur=fuar&gorunum=liste');
  assert.strictEqual(r.status, 200);
  assert.match(r.text, /<table class="liste-tablo"/);
  const say = (html) => Number(html.match(/class="sonuc-sayisi">(\d+) /)[1]);
  const hepsi = await request(app).get('/v5/calismalar');
  const etkinlik = await request(app).get('/v5/calismalar?tur=etkinlik');
  assert.ok(say(etkinlik.text) < say(hepsi.text));
  const bos = await request(app).get('/v5/calismalar?q=' + encodeURIComponent('olmayan-bir-ad-' + ETIKET));
  assert.match(bos.text, /Bu süzgeçle çalışma bulunamadı\./);
});

test('v5: teklif formu sorgu parametreleriyle dolu açılır', async () => {
  const r = await request(app).get('/v5/teklif?metretul=120&etkinlik_turu=' + encodeURIComponent('Fuar standı') + '&tarih=2030-05-01&sehir=Ankara');
  assert.strictEqual(r.status, 200);
  assert.match(r.text, /name="metretul"[^>]*value="120"/);
  assert.match(r.text, /<option selected>Fuar standı<\/option>/);
  assert.match(r.text, /name="tarih"[^>]*value="2030-05-01"/);
  assert.match(r.text, /name="sehir" value="Ankara"/);
});

test('v5: geçersiz ön doldurma yok sayılır, şehir kaçışlı basılır', async () => {
  const r = await request(app).get('/v5/teklif?etkinlik_turu=Uydurma&tarih=yarin&metretul=99999&sehir=' + encodeURIComponent('<script>alert(1)</script>'));
  assert.strictEqual(r.status, 200);
  assert.doesNotMatch(r.text, /<option selected>/);
  assert.match(r.text, /name="tarih"[^>]*value=""/);
  assert.match(r.text, /name="metretul"[^>]*value=""/);
  assert.ok(!r.text.includes('<script>alert(1)</script>'));
  assert.ok(r.text.includes('&lt;script&gt;'));
});

test('v5: ?ref ile örnek iş mesaja yazılır, olmayan ref sessizce yok sayılır', async () => {
  const p = await birProje();
  const r = await request(app).get('/v5/teklif?ref=' + p.id);
  assert.strictEqual(r.status, 200);
  assert.ok(r.text.includes('Örnek gösterdiğiniz iş:'));
  assert.match(r.text, /<textarea[^>]*>Örnek gösterdiğim iş: /);
  const yok = await request(app).get('/v5/teklif?ref=999999');
  assert.strictEqual(yok.status, 200);
  assert.ok(!yok.text.includes('Örnek gösterdiğiniz iş:'));
});

test('v5: teklif formunda tüm alan adları var', async () => {
  const r = await request(app).get('/v5/teklif');
  for (const ad of ['etkinlik_turu', 'sehir', 'tarih', 'gun_sayisi', 'metretul', 'kurulum', 'mesaj', 'ad_soyad', 'firma', 'telefon', 'eposta', 'kvkk', 'web_sitesi']) {
    assert.match(r.text, new RegExp(`name="${ad}"`), ad);
  }
  assert.match(r.text, /<form[^>]*method="post"[^>]*action="\/v5\/teklif"/);
  assert.doesNotMatch(r.text, /novalidate/);
  assert.doesNotMatch(r.text, /class="alt-cubuk"/); // teklif sayfasında alt çubuk yok
});

test('v5: boş gönderim 422, özet ve alan hataları; değerler korunur', async () => {
  const r = await request(app).post('/v5/teklif').type('form').send({ sehir: 'İzmir', kurulum: 'on' });
  assert.strictEqual(r.status, 422);
  assert.match(r.text, /role="alert"/);
  assert.match(r.text, /Formda \d+ alan düzeltilmeli/);
  for (const ad of ['etkinlik_turu', 'tarih', 'ad_soyad', 'telefon', 'eposta', 'kvkk']) {
    assert.match(r.text, new RegExp(`id="${ad}-hata"`), ad);
    assert.match(r.text, new RegExp(`href="#${ad}"`), ad);
  }
  assert.match(r.text, /name="sehir" value="İzmir"/);
  assert.match(r.text, /name="kurulum" value="on" checked/);
});

test('v5: geçerli gönderim kaydedilir ve teşekkür sayfasına yönlenir', async () => {
  const r = await request(app).post('/v5/teklif').type('form').send({
    ad_soyad: ETIKET + ' Deneme', telefon: '0532 123 45 67', eposta: 'test@example.com',
    etkinlik_turu: 'Fuar standı', sehir: 'Ankara', tarih: yarin(), gun_sayisi: '2', metretul: '64', kurulum: 'on', kvkk: 'on',
  });
  assert.strictEqual(r.status, 302);
  assert.strictEqual(r.headers.location, '/v5/teklif/tesekkurler');
  const { rows } = await pool.query('SELECT metretul FROM teklifler WHERE ad_soyad = $1', [ETIKET + ' Deneme']);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].metretul, 64);
});
