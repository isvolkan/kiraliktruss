// Test koruması (lib/test-koruma.js) ve sayaç anahtarı yardımcıları (lib/istemci-ip.js): saf işlevler, bağlantı açılmaz.
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { spawnSync } = require('child_process');
const { kontrol, zorunlu } = require('../lib/test-koruma');
const { anahtar, maskele } = require('../lib/istemci-ip');

test('R5 koruma: yerel hostlar geçer, uzak host reddedilir, TEST_DATABASE_URL uzak olsa da kabul edilir', () => {
  for (const u of ['postgres://u:p@localhost:5432/d', 'postgres://u:p@127.0.0.1/d', 'postgres://u:p@[::1]:5432/d']) {
    assert.strictEqual(kontrol({ DATABASE_URL: u }).ok, true, u);
  }
  const uzak = kontrol({ DATABASE_URL: 'postgres://u:p@ep-canli.eu-central-1.aws.neon.tech/d?sslmode=require' });
  assert.strictEqual(uzak.ok, false);
  assert.match(uzak.neden, /ep-canli\.eu-central-1\.aws\.neon\.tech/);
  assert.match(uzak.neden, /TEST_DATABASE_URL/);
  assert.throws(() => zorunlu({ DATABASE_URL: 'postgres://u:p@db.example.com/d' }), /uzak veritabanında/);
  // Açıkça ayrılmış test veritabanı: DATABASE_URL canlı olsa bile kullanılan adres TEST_DATABASE_URL'dir
  assert.strictEqual(kontrol({ DATABASE_URL: 'postgres://u:p@db.example.com/d', TEST_DATABASE_URL: 'postgres://u:p@test.example.com/t' }).ok, true);
  assert.strictEqual(kontrol({ DATABASE_URL: 'okunamaz adres' }).ok, false);
});

test('R5 scripts/test.js: uzak veritabanı adresinde çıkış kodu ≠ 0 ve bağlantı açılmadan çıkar', () => {
  const env = { ...process.env, DATABASE_URL: 'postgres://u:p@db.example.com:5432/canli', NODE_OPTIONS: '' };
  delete env.TEST_DATABASE_URL;
  // dotenv var olan değişkeni ezmez; DATABASE_URL yukarıda ayarlı olduğu için .env'deki adres kullanılmaz
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'test.js')], { env, encoding: 'utf8', timeout: 20000 });
  assert.notStrictEqual(r.status, 0);
  assert.match(r.stderr, /uzak veritabanında çalıştırılmaz/);
  assert.match(r.stderr, /db\.example\.com/);
});

test('R1 istemci-ip: anahtar CF başlığından; geçersizse req.ip; IPv6 /56 alt ağa indirgenir; maskele son bölümü gizler', () => {
  const istek = (cf, ip) => ({ headers: cf === undefined ? {} : { 'cf-connecting-ip': cf }, ip });
  assert.strictEqual(anahtar(istek('203.0.113.5', '172.69.1.1')), '203.0.113.5');
  assert.strictEqual(anahtar(istek('bozuk', '198.51.100.9')), '198.51.100.9');
  assert.strictEqual(anahtar(istek(undefined, '198.51.100.9')), '198.51.100.9');
  assert.strictEqual(anahtar(istek('2001:db8:1:2:aaaa::1', '1.1.1.1')), anahtar(istek('2001:db8:1:2:bbbb::9', '2.2.2.2')), 'aynı /56');
  assert.notStrictEqual(anahtar(istek('2001:db8:1:2::1', 'x')), anahtar(istek('2001:db8:1:3000::1', 'x')), 'farklı /56');
  assert.strictEqual(maskele('1.2.3.4'), '1.2.3.x');
  assert.strictEqual(maskele('2001:db8::1'), '2001:db8::x');
  assert.strictEqual(maskele(undefined), '-');
});
