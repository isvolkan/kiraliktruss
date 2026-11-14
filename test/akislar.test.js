// Duman testleri: yönergedeki zorunlu akışlar (sayfalar, form doğrulama, CRUD, giriş koruması).
// Çalıştırma: npm test   (yerel veritabanı çalışıyor ve npm run seed yapılmış olmalı)
require('dotenv').config();
const { test, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const request = require('supertest');
const app = require('../app');
const pool = require('../db/pool');

const ETIKET = 'TEST-' + Date.now(); // testin oluşturduğu kayıtları bulup silmek için

after(async () => {
  await pool.query('DELETE FROM teklifler WHERE ad_soyad LIKE $1', [ETIKET + '%']);
  await pool.query('DELETE FROM projeler WHERE musteri LIKE $1', [ETIKET + '%']);
  await pool.end();
});

function yarin() { return new Date(Date.now() + 86400000).toISOString().slice(0, 10); }

async function girisYap() {
  const ajan = request.agent(app);
  const r = await ajan.post('/yonetim/giris').type('form')
    .send({ eposta: process.env.ADMIN_EMAIL, sifre: process.env.ADMIN_PASSWORD });
  assert.strictEqual(r.status, 302);
  assert.strictEqual(r.headers.location, '/yonetim');
  return ajan;
}

test('halka açık sayfalar açılıyor', async () => {
  for (const yol of ['/', '/calismalar', '/calismalar?gorunum=liste', '/hakkimizda', '/iletisim', '/teklif']) {
    const r = await request(app).get(yol);
    assert.strictEqual(r.status, 200, yol);
  }
  const ana = await request(app).get('/');
  assert.match(ana.text, /TRUSS/);
});

test('bilinmeyen sayfa 404 döner', async () => {
  const r = await request(app).get('/yok-boyle-bir-sayfa');
  assert.strictEqual(r.status, 404);
  assert.match(r.text, /Bu truss burada kurulmadı/);
});

test('çalışmalar süzgeci sonuçları daraltır ve SQL enjeksiyonuna dayanır', async () => {
  const hepsi = await request(app).get('/calismalar');
  const etkinlik = await request(app).get('/calismalar?tur=etkinlik');
  const say = (html) => Number(html.match(/Arşiv · (\d+) proje/)[1]);
  assert.ok(say(etkinlik.text) < say(hepsi.text));
  const kotu = await request(app).get("/calismalar?q=' OR 1=1 --");
  assert.strictEqual(kotu.status, 200);
  assert.strictEqual(say(kotu.text), 0);
});

test('proje fotoğrafı veritabanından gelir', async () => {
  const { rows } = await pool.query('SELECT id FROM projeler WHERE gorsel IS NOT NULL LIMIT 1');
  const r = await request(app).get('/gorsel/' + rows[0].id);
  assert.strictEqual(r.status, 200);
  assert.match(r.headers['content-type'], /^image\//);
});

test('teklif formu: eksik/hatalı alanlar reddedilir', async () => {
  const r = await request(app).post('/teklif').type('form')
    .send({ ad_soyad: 'A', telefon: '123', eposta: 'yanlis', etkinlik_turu: 'Yok', sehir: '', tarih: '2000-01-01' });
  assert.strictEqual(r.status, 422);
  for (const mesaj of ['Ad soyad 3–80', 'Geçerli bir telefon', 'Geçerli bir e-posta', 'Etkinlik türünü seçin', 'Tarih bugünden önce', 'aydınlatma metnini onaylayın']) {
    assert.ok(r.text.includes(mesaj), mesaj);
  }
});

test('teklif CRUD: ziyaretçi ekler, yönetici listeler, günceller, siler', async () => {
  const r = await request(app).post('/teklif').type('form').send({
    ad_soyad: ETIKET + ' Deneme', firma: 'Test A.Ş.', telefon: '0532 123 45 67', eposta: 'test@example.com',
    etkinlik_turu: 'Fuar standı', sehir: 'İstanbul', tarih: yarin(), gun_sayisi: '3', metretul: '48', kurulum: 'on', kvkk: 'on',
  });
  assert.strictEqual(r.status, 302);
  const { rows } = await pool.query('SELECT id, durum, metretul FROM teklifler WHERE ad_soyad = $1', [ETIKET + ' Deneme']);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].metretul, 48);
  const id = rows[0].id;

  const ajan = await girisYap();
  const liste = await ajan.get('/yonetim/teklifler');
  assert.match(liste.text, new RegExp(ETIKET));
  await ajan.post('/yonetim/teklifler/' + id).type('form').send({ durum: 'arandi', yonetici_notu: 'Arandı, çizim bekleniyor' }).expect(302);
  const g = await pool.query('SELECT durum, yonetici_notu FROM teklifler WHERE id = $1', [id]);
  assert.strictEqual(g.rows[0].durum, 'arandi');
  await ajan.post('/yonetim/teklifler/' + id + '/sil').expect(302);
  const s = await pool.query('SELECT 1 FROM teklifler WHERE id = $1', [id]);
  assert.strictEqual(s.rowCount, 0);
});

test('bal küpü dolu gönderim kaydedilmez', async () => {
  await request(app).post('/teklif').type('form').send({ ad_soyad: ETIKET + ' Bot', web_sitesi: 'http://spam.example' }).expect(302);
  const { rowCount } = await pool.query('SELECT 1 FROM teklifler WHERE ad_soyad = $1', [ETIKET + ' Bot']);
  assert.strictEqual(rowCount, 0);
});

test('yönetim paneli girişsiz açılmaz, yanlış parola reddedilir', async () => {
  const r = await request(app).get('/yonetim/projeler');
  assert.strictEqual(r.status, 302);
  assert.strictEqual(r.headers.location, '/yonetim/giris');
  const y = await request(app).post('/yonetim/giris').type('form').send({ eposta: process.env.ADMIN_EMAIL, sifre: 'yanlis-parola' });
  assert.strictEqual(y.status, 401);
});

test('proje CRUD: ekle (fotoğraflı), listele, güncelle, sil', async () => {
  const ajan = await girisYap();
  const foto = path.join(__dirname, '..', 'veri', 'eski-gorseller', '1543314354_ari-makina-foteg-2013.jpg');

  // Fotoğrafsız ekleme reddedilmeli (doğrulama)
  const eksik = await ajan.post('/yonetim/projeler').field('musteri', ETIKET + ' Firma').field('etkinlik', 'Deneme Fuarı').field('tur', 'fuar');
  assert.strictEqual(eksik.status, 422);

  await ajan.post('/yonetim/projeler')
    .field('musteri', ETIKET + ' Firma').field('etkinlik', 'Deneme Fuarı').field('sehir', 'İstanbul')
    .field('yil', '2026').field('tur', 'fuar').attach('gorsel', foto).expect(302);
  const { rows } = await pool.query('SELECT id FROM projeler WHERE musteri = $1', [ETIKET + ' Firma']);
  assert.strictEqual(rows.length, 1);
  const id = rows[0].id;

  const liste = await ajan.get('/yonetim/projeler?q=' + encodeURIComponent(ETIKET));
  assert.match(liste.text, new RegExp(ETIKET));

  // Fotoğraf göndermeden güncelle: eski fotoğraf korunmalı
  await ajan.post('/yonetim/projeler/' + id)
    .field('musteri', ETIKET + ' Firma').field('etkinlik', 'Güncel Fuar').field('yil', '2025').field('tur', 'etkinlik').expect(302);
  const g = await pool.query('SELECT etkinlik, yil, tur, gorsel IS NOT NULL AS foto FROM projeler WHERE id = $1', [id]);
  assert.deepStrictEqual(g.rows[0], { etkinlik: 'Güncel Fuar', yil: 2025, tur: 'etkinlik', foto: true });

  // Halka açık detay sayfasında görünüyor
  const detay = await request(app).get('/calismalar/' + id);
  assert.match(detay.text, /Güncel Fuar/);

  await ajan.post('/yonetim/projeler/' + id + '/sil').expect(302);
  const s = await pool.query('SELECT 1 FROM projeler WHERE id = $1', [id]);
  assert.strictEqual(s.rowCount, 0);
});
