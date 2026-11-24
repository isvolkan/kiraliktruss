// Seed ve açılış testleri: yönetici şifresi korunur (D1), eski şemalı veritabanında seed + göç çalışır (D2).
// Çalıştırma: npm test   (yerel PostgreSQL gerekir; D2 testi geçici bir veritabanı kurup sonunda siler)
require('dotenv').config();
const { test, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const pool = require('../db/pool');

const KOK = path.join(__dirname, '..');
const EPOSTA = `test-seed-${Date.now()}@ornek.invalid`;

after(async () => {
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
