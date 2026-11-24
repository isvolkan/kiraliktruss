// v2 (ikinci sürüm) duman testleri. Çalıştırma: npm test
require('dotenv').config();
const { test, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../app');
const pool = require('../db/pool');

after(async () => { await pool.end(); });

test('v2 ana sayfa açılıyor ve v2 varlıklarını kullanıyor', async () => {
  // '/v2' adresini express.static klasör yönlendirmesi '/v2/' adresine götürür (tarayıcı izler); sayfa '/v2/' adresinde 200 döner
  const yon = await request(app).get('/v2');
  assert.ok([200, 301].includes(yon.status), '/v2 → ' + yon.status);
  const r = await request(app).get('/v2/');
  assert.strictEqual(r.status, 200);
  assert.match(r.text, /href="\/v2\/calismalar"/);
  assert.match(r.text, /\/v2\/css\/temel\.css/);
  assert.match(r.text, /\/v2\/css\/anasayfa\.css/);
  assert.match(r.text, /\/v2\/js\/tema-erken\.js/);
  assert.match(r.text, /href="\/yonetim"/);
  assert.doesNotMatch(r.text, /\/css\/site\.css/);
});

test('v2 varlıkları sunuluyor', async () => {
  for (const yol of ['/v2/css/temel.css', '/v2/css/anasayfa.css', '/v2/js/temel.js', '/v2/js/tema-erken.js', '/v2/js/anasayfa.js']) {
    const r = await request(app).get(yol);
    assert.strictEqual(r.status, 200, yol);
  }
});

test('v1 ana sayfa değişmedi: hâlâ eski stil dosyasını kullanıyor', async () => {
  const r = await request(app).get('/');
  assert.strictEqual(r.status, 200);
  assert.match(r.text, /\/css\/site\.css/);
  assert.doesNotMatch(r.text, /\/v2\/css\//);
});
