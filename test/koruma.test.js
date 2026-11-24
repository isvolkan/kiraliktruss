// Test koruması (lib/test-koruma.js) ve sayaç anahtarı yardımcıları (lib/istemci-ip.js): saf işlevler, bağlantı açılmaz.
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { spawnSync } = require('child_process');
const { kontrol, zorunlu } = require('../lib/test-koruma');
const { anahtar, maskele, icIstek, maskeliListe } = require('../lib/istemci-ip');

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
  assert.strictEqual(maskele('2001:db8::1'), '2001:db8:0:0:x:x:x:x');
  assert.strictEqual(maskele(undefined), '-');
});

test('R1 teşhis: IPv6/eşlemeli maskeleme, XFF girdileri tek tek maskelenir, iç sağlık kontrolü ayıklanır', () => {
  assert.strictEqual(maskele('2001:db8:1:2:3:4:5:6'), '2001:db8:1:2:x:x:x:x');
  assert.strictEqual(maskele('::ffff:1.2.3.4'), '::ffff:1.2.3.x');
  assert.strictEqual(maskele('bozuk'), 'gecersiz');
  assert.strictEqual(maskele(''), '-');
  assert.strictEqual(maskeliListe('203.0.113.5, 10.1.2.3'), '203.0.113.x,10.1.2.x (n=2)');
  assert.strictEqual(maskeliListe(undefined), '-');
  const istek = (soket, headers = {}) => ({ socket: { remoteAddress: soket }, headers });
  for (const s of ['10.20.30.40', '172.16.0.1', '172.31.9.9', '192.168.1.1', '100.64.0.7', '127.0.0.1', '::1', '::ffff:10.0.0.5']) {
    assert.strictEqual(icIstek(istek(s)), true, s);
  }
  assert.strictEqual(icIstek(istek('10.0.0.5', { 'x-forwarded-for': '203.0.113.5' })), false, 'XFF varsa iç değil');
  assert.strictEqual(icIstek(istek('10.0.0.5', { 'cf-connecting-ip': '203.0.113.5' })), false);
  assert.strictEqual(icIstek(istek('10.0.0.5', { 'true-client-ip': '203.0.113.5' })), false);
  assert.strictEqual(icIstek(istek('172.32.0.1')), false, '172.32 özel değil');
  assert.strictEqual(icIstek(istek('203.0.113.9')), false);
});
