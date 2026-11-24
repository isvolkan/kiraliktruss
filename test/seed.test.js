// Seed ve açılış testleri: yönetici şifresi korunur (D1), eski şemalı veritabanında seed + göç çalışır (D2).
// Çalıştırma: npm test   (yerel PostgreSQL gerekir; D2 testi geçici bir veritabanı kurup sonunda siler)
require('dotenv').config();
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const request = require('supertest');
const pool = require('../db/pool');
const kayitIzle = require('./kayit-temizle'); // işlem günlüğüne yazılan test kayıtları sonunda silinir
let kayitTemizle = async () => {};
const app = require('../app');

const KOK = path.join(__dirname, '..');
const EPOSTA = `test-seed-${Date.now()}@ornek.invalid`;

before(async () => { kayitTemizle = await kayitIzle(pool); });

after(async () => {
  await kayitTemizle();
  await pool.query('DELETE FROM kullanicilar WHERE eposta = $1', [EPOSTA]);
  await pool.end();
});

// db/seed.js'yi ayrı süreçte, verilen ortamla çalıştırır
function seedCalistir(env) {
  const s = spawnSync(process.execPath, ['db/seed.js'], { cwd: KOK, env: { ...process.env, ...env }, encoding: 'utf8' });
  assert.strictEqual(s.status, 0, 'seed başarısız:\n' + s.stdout + s.stderr);
  return s.stdout;
}

test('D1 seed: panelden değiştirilen yönetici şifresi ikinci seed çalışmasında korunur', async () => {
  const env = { ADMIN_EMAIL: EPOSTA, ADMIN_PASSWORD: 'ilk-sifre-123' };
  seedCalistir(env);
  const ilk = (await pool.query('SELECT sifre_hash FROM kullanicilar WHERE eposta = $1', [EPOSTA])).rows[0];
  assert.ok(ilk && await bcrypt.compare('ilk-sifre-123', ilk.sifre_hash), 'hesap .env şifresiyle oluşmalı');

  // Panelden şifre değişti
  const yeni = await bcrypt.hash('panelden-yeni-456', 4);
  await pool.query('UPDATE kullanicilar SET sifre_hash = $2 WHERE eposta = $1', [EPOSTA, yeni]);

  seedCalistir(env); // yeniden başlatma
  const son = (await pool.query('SELECT sifre_hash FROM kullanicilar WHERE eposta = $1', [EPOSTA])).rows[0];
  assert.strictEqual(son.sifre_hash, yeni, 'seed şifreyi .env değerine geri yazmamalı');
});

test('D3 seed: ADMIN_SIFRE_SIFIRLA=true şifreyi günceller, oturumları siler; kısa şifrede ve bayraksız sıfırlamaz', async () => {
  const eposta = `test-sifirla-${Date.now()}@ornek.invalid`;
  try {
    seedCalistir({ ADMIN_EMAIL: eposta, ADMIN_PASSWORD: 'eski-sifre-1234' });
    const id = String((await pool.query('SELECT id FROM kullanicilar WHERE eposta = $1', [eposta])).rows[0].id);
    const hashAl = async () => (await pool.query('SELECT sifre_hash FROM kullanicilar WHERE eposta = $1', [eposta])).rows[0].sifre_hash;
    const sid = 'test-sifirla-' + Date.now();
    await pool.query(`INSERT INTO oturumlar (sid, sess, expire) VALUES ($1, $2, now() + interval '1 hour')`,
      [sid, JSON.stringify({ cookie: {}, kullanici: { id: Number(id), eposta } })]);

    // Kısa şifre: sıfırlama yapılmaz
    const kisa = seedCalistir({ ADMIN_EMAIL: eposta, ADMIN_PASSWORD: 'kisa', ADMIN_SIFRE_SIFIRLA: 'true' });
    assert.ok(await bcrypt.compare('eski-sifre-1234', await hashAl()), 'kısa şifrede değişmemeli');
    assert.ok(!kisa.includes('sıfırlandı'));
    // "TRUE" ya da "1": tam olarak "true" değil, sıfırlama yok
    seedCalistir({ ADMIN_EMAIL: eposta, ADMIN_PASSWORD: 'baska-sifre-9999', ADMIN_SIFRE_SIFIRLA: 'TRUE' });
    assert.ok(await bcrypt.compare('eski-sifre-1234', await hashAl()));
    assert.strictEqual((await pool.query('SELECT 1 FROM oturumlar WHERE sid = $1', [sid])).rowCount, 1);

    // Bayraklı: şifre güncellenir (e-posta büyük harf/boşluklu da olsa), eski şifre geçmez, oturum silinir
    const cikti = seedCalistir({ ADMIN_EMAIL: '  ' + eposta.toUpperCase() + ' ', ADMIN_PASSWORD: 'yeni-sifre-5678', ADMIN_SIFRE_SIFIRLA: 'true' });
    assert.ok(cikti.includes('Yönetici şifresi ADMIN_SIFRE_SIFIRLA ile sıfırlandı — bu değişkeni şimdi kaldırın.'));
    assert.ok(!cikti.includes('yeni-sifre-5678'));
    const h = await hashAl();
    assert.ok(await bcrypt.compare('yeni-sifre-5678', h));
    assert.ok(!(await bcrypt.compare('eski-sifre-1234', h)), 'eski şifre geçmemeli');
    assert.strictEqual((await pool.query('SELECT 1 FROM oturumlar WHERE sid = $1', [sid])).rowCount, 0, 'oturumlar silinmeli');
    assert.strictEqual((await pool.query('SELECT 1 FROM kullanicilar WHERE lower(eposta) = $1', [eposta])).rowCount, 1, 'çift hesap oluşmamalı');

    // Giriş: büyük harf + baş/son boşluklu e-posta çalışır
    const ajan = request.agent(app);
    const sayfa = await ajan.get('/yonetim/giris');
    const jeton = sayfa.text.match(/name="_csrf" value="([0-9a-f]{64})"/)[1];
    const r = await ajan.post('/yonetim/giris').type('form').send({ _csrf: jeton, eposta: '  ' + eposta.toUpperCase() + '  ', sifre: 'yeni-sifre-5678' });
    assert.strictEqual(r.status, 302, 'büyük harf/boşluklu e-posta ile giriş çalışmalı');
  } finally {
    await pool.query('DELETE FROM kullanicilar WHERE eposta = $1', [eposta]);
  }
});

test('D2 açılış: eski şemalı veritabanında seed + göç + yeniden seed başarılı (indeks/sütun çökmesi yok)', async () => {
  const adres = new URL(process.env.DATABASE_URL);
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(adres.hostname)) return; // yalnız yerel sunucuda geçici veritabanı kurulur
  const ad = 'kiraliktruss_eski_' + Date.now();
  const bakim = new URL(adres); bakim.pathname = '/postgres';
  const c = new Client({ connectionString: bakim.toString() });
  await c.connect();
  await c.query(`CREATE DATABASE ${ad}`);
  try {
    const gecici = new URL(adres); gecici.pathname = '/' + ad;
    // 1) Yalnız ESKİ şema (okundu, gorsel_kucuk yok) kurulur
    const t = new Client({ connectionString: gecici.toString() });
    await t.connect();
    await t.query(fs.readFileSync(path.join(__dirname, 'fixtures', 'eski-schema.sql'), 'utf8'));
    const once = await t.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'teklifler' AND column_name = 'okundu'`);
    assert.strictEqual(once.rowCount, 0, 'deneme eski şemayla başlamalı');
    await t.end();

    // 2) Açılış sırası: seed (şema + göç + veri), sonra sunucunun yaptığı göç — iki kez
    const env = { DATABASE_URL: gecici.toString(), DATABASE_SSL: 'false', ADMIN_EMAIL: 'eski@ornek.invalid', ADMIN_PASSWORD: 'deneme-sifre-1' };
    seedCalistir(env);
    seedCalistir(env);
    const g = spawnSync(process.execPath, ['-e', "require('./db/goc')().then(()=>require('./db/pool').end())"],
      { cwd: KOK, env: { ...process.env, ...env }, encoding: 'utf8' });
    assert.strictEqual(g.status, 0, 'göç başarısız:\n' + g.stdout + g.stderr);

    // 3) Yeni sütunlar ve indeks yerinde
    const k = new Client({ connectionString: gecici.toString() });
    await k.connect();
    const sut = await k.query(`SELECT column_name FROM information_schema.columns WHERE
      (table_name = 'teklifler' AND column_name IN ('okundu', 'guncellendi')) OR (table_name = 'projeler' AND column_name = 'gorsel_kucuk')`);
    assert.strictEqual(sut.rowCount, 3);
    const idx = await k.query(`SELECT 1 FROM pg_indexes WHERE indexname = 'teklifler_okundu_idx'`);
    assert.strictEqual(idx.rowCount, 1);
    await k.end();
  } finally {
    await c.query(`DROP DATABASE IF EXISTS ${ad} WITH (FORCE)`);
    await c.end();
  }
});
