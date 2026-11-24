// Ziyaretçi sitesinin arka uç testleri: sorgu parametreleri, görsel hattı, SEO dosyaları, KVKK rotası, teklif bildirimi.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { test, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const sharp = require('sharp');
const bildirim = require('../lib/bildirim');
const { hazirla, imzaKontrol } = require('../lib/gorsel');
const app = require('../app');
const pool = require('../db/pool');
const onbellek = require('../lib/gorsel-onbellek');

const ETIKET = 'TEST-backend-' + Date.now();

after(async () => {
  await pool.query('DELETE FROM teklifler WHERE ad_soyad LIKE $1', [ETIKET + '%']);
  await pool.end();
});

async function fotografliProje() {
  return (await pool.query('SELECT id FROM projeler WHERE gorsel IS NOT NULL ORDER BY id LIMIT 1')).rows[0];
}

test('sorgu parametreleri: dizi / bozuk değerler 500 vermez', async () => {
  const p = await fotografliProje();
  const yollar = [
    '/calismalar?q=a&q=b', '/calismalar?tur=fuar&tur=etkinlik', '/calismalar?yil=2020&yil=2021',
    '/calismalar?sehir=Konya&sehir=Bursa', '/calismalar?sayfa=2&sayfa=3', '/calismalar?gorunum=liste&gorunum=x',
    '/calismalar?sayfa=99999999999999999999', '/calismalar?sayfa=-5', '/calismalar?q=%00', '/calismalar?yil=%00',
    '/calismalar?q[x]=1', '/calismalar?q=' + 'a'.repeat(5000),
    '/teklif?ref=1&ref=2', '/teklif?ref=99999999999', '/teklif?metretul=5&metretul=6', '/teklif?tarih=a&tarih=b',
    '/teklif?etkinlik_turu=Diğer&etkinlik_turu=x', '/teklif?sehir=a&sehir=b&ref=%00',
    '/calismalar/99999999999', '/calismalar/' + p.id + '?x=1&x=2', '/gorsel/99999999999',
    '/gorsel/' + p.id + '?boy=kucuk&boy=tam',
  ];
  for (const yol of yollar) {
    const r = await request(app).get(yol);
    assert.ok(r.status < 500, `${yol} → ${r.status}`);
  }
  assert.strictEqual((await request(app).get('/calismalar?q=a&q=b')).status, 200);
});

test('teklif POST: tekrarlanan form alanları 500 vermez', async () => {
  const r = await request(app).post('/teklif').set('X-Forwarded-For', '10.9.6.' + (Date.now() % 250))
    .type('form').send('ad_soyad=a&ad_soyad=b&telefon=1&telefon=2&sehir=x&sehir=y');
  assert.strictEqual(r.status, 422);
});

test('görsel: tam ve küçük boy, ETag, 304, sürümsüz no-cache', async () => {
  const p = await fotografliProje();
  const tamYol = '/gorsel/' + p.id, kucukYol = tamYol + '?boy=kucuk';
  const tam = await request(app).get(tamYol);
  assert.strictEqual(tam.status, 200);
  assert.match(tam.headers['content-type'], /^image\//);
  assert.ok(tam.headers.etag);
  assert.strictEqual(tam.headers['cache-control'], 'no-cache', 'sürüm yoksa her seferinde ETag ile sorulur');

  const kucuk = await request(app).get(kucukYol);
  assert.strictEqual(kucuk.status, 200);
  assert.match(kucuk.headers['content-type'], /^image\/webp/);
  assert.notStrictEqual(kucuk.headers.etag, tam.headers.etag);
  assert.ok(kucuk.body.length < tam.body.length, 'küçük boy daha küçük');
  assert.ok((await sharp(kucuk.body).metadata()).width <= 600);

  assert.strictEqual((await request(app).get(tamYol).set('If-None-Match', tam.headers.etag)).status, 304);
  assert.strictEqual((await request(app).get(kucukYol).set('If-None-Match', kucuk.headers.etag)).status, 304);
  assert.strictEqual((await request(app).get(kucukYol).set('If-None-Match', '"baska"')).status, 200);
});

test('görsel: küçük boyu olmayan eski kayıt için anında üretilir ve kaydedilir', async () => {
  const p = await fotografliProje();
  const eski = (await pool.query('SELECT gorsel_kucuk FROM projeler WHERE id = $1', [p.id])).rows[0].gorsel_kucuk;
  await pool.query('UPDATE projeler SET gorsel_kucuk = NULL WHERE id = $1', [p.id]);
  onbellek.sil(p.id); // önceki testlerden kalan bellek kaydı yok sayılsın
  try {
    const r = await request(app).get('/gorsel/' + p.id + '?boy=kucuk');
    assert.strictEqual(r.status, 200);
    assert.match(r.headers['content-type'], /^image\/webp/);
    const kayit = (await pool.query('SELECT gorsel_kucuk IS NOT NULL AS var FROM projeler WHERE id = $1', [p.id])).rows[0];
    assert.ok(kayit.var, 'veritabanına yazıldı');
  } finally {
    await pool.query('UPDATE projeler SET gorsel_kucuk = $2 WHERE id = $1', [p.id, eski]);
  }
});

// pool.query çağrılarını sayar
async function sorguSay(fn) {
  const orijinal = pool.query;
  let n = 0;
  pool.query = function (...a) { n++; return orijinal.apply(this, a); };
  try { await fn(); } finally { pool.query = orijinal; }
  return n;
}

test('görsel önbelleği: ikinci istek DB olmadan gelir, içerik ve başlıklar aynı, 304 çalışır', async () => {
  const p = await fotografliProje();
  const yol = '/gorsel/' + p.id + '?boy=kucuk';
  onbellek.sil(p.id);
  const ilk = await request(app).get(yol);
  assert.strictEqual(ilk.status, 200);
  let ikinci, uc;
  const n = await sorguSay(async () => {
    ikinci = await request(app).get(yol);
    uc = await request(app).get(yol).set('If-None-Match', ilk.headers.etag);
  });
  assert.strictEqual(n, 0, 'önbellekten yanıt: veritabanı sorgusu yok');
  assert.strictEqual(uc.status, 304);
  assert.strictEqual(ikinci.status, 200);
  assert.deepStrictEqual(ikinci.body, ilk.body);
  for (const b of ['etag', 'cache-control', 'content-type']) assert.strictEqual(ikinci.headers[b], ilk.headers[b]);
});

test('görsel önbelleği: v uyuşmazsa taze okunur, v eşleşirse immutable ve DB olmadan', async () => {
  const p = await fotografliProje();
  const g = (await pool.query('SELECT floor(extract(epoch FROM guncelleme) * 1000)::bigint AS v FROM projeler WHERE id = $1', [p.id])).rows[0].v;
  const yol = '/gorsel/' + p.id + '?boy=kucuk&v=';
  onbellek.sil(p.id);
  await request(app).get(yol + g);
  let r;
  assert.strictEqual(await sorguSay(async () => { r = await request(app).get(yol + g); }), 0);
  assert.match(r.headers['cache-control'], /immutable/);
  assert.ok(await sorguSay(async () => { await request(app).get(yol + (Number(g) + 1)); }) > 0, 'farklı v taze okuma yapar');
});

test('görsel önbelleği: sil(id) sonrası taze okuma', async () => {
  const p = await fotografliProje();
  const yol = '/gorsel/' + p.id;
  await request(app).get(yol);
  assert.strictEqual(await sorguSay(() => request(app).get(yol)), 0);
  onbellek.sil(p.id);
  assert.ok(await sorguSay(() => request(app).get(yol)) > 0);
});

test('görsel önbelleği: bayt sınırı aşılınca en eski kayıt çıkar', () => {
  const sinir = onbellek.SINIR_BAYT;
  onbellek.temizle();
  const parca = Buffer.alloc(Math.floor(sinir / 2) + 1);
  const kayit = { guncelleme: 1, etag: '"x"', tur: 'image/webp', veri: parca };
  onbellek.yaz(900001, false, kayit, 0);
  onbellek.yaz(900002, false, kayit, 0);
  assert.strictEqual(onbellek.al(900001, false, ''), null, 'en eski çıktı');
  assert.ok(onbellek.al(900002, false, ''));
  assert.ok(onbellek.bilgi().bayt <= sinir);
  onbellek.temizle();
});

test('görsel: olmayan proje yer tutucuya yönlenir', async () => {
  const r = await request(app).get('/gorsel/2147483647');
  assert.strictEqual(r.status, 302);
  assert.strictEqual(r.headers.location, '/img/gorsel-yok.svg');
});

test('robots.txt: önizlemede kapalı, gerçek yayında açık + sitemap satırı', async () => {
  const onceki = process.env.SITE_DEMO;
  try {
    process.env.SITE_DEMO = 'true';
    let r = await request(app).get('/robots.txt');
    assert.strictEqual(r.status, 200);
    assert.match(r.headers['content-type'], /text\/plain/);
    assert.match(r.text, /Disallow: \/\n/);
    assert.doesNotMatch(r.text, /Sitemap/);

    process.env.SITE_DEMO = 'false';
    r = await request(app).get('/robots.txt').set('Host', 'ornek.test');
    assert.match(r.text, /Allow: \//);
    assert.match(r.text, /Sitemap: http:\/\/ornek\.test\/sitemap\.xml/);
  } finally {
    if (onceki === undefined) delete process.env.SITE_DEMO; else process.env.SITE_DEMO = onceki;
  }
});

test('sitemap.xml: sabit sayfalar + tüm çalışma detayları, lastmod', async () => {
  const r = await request(app).get('/sitemap.xml').set('Host', 'ornek.test');
  assert.strictEqual(r.status, 200);
  assert.match(r.headers['content-type'], /application\/xml/);
  assert.match(r.text, /<loc>http:\/\/ornek\.test\/<\/loc>/);
  for (const yol of ['/calismalar', '/hakkimizda', '/iletisim', '/teklif', '/kvkk']) {
    assert.ok(r.text.includes(`<loc>http://ornek.test${yol}</loc>`), yol);
  }
  const n = (await pool.query('SELECT count(*)::int AS n FROM projeler')).rows[0].n;
  assert.strictEqual((r.text.match(/\/calismalar\/\d+<\/loc>/g) || []).length, n);
  assert.match(r.text, /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
});

test('kvkk: rota var (views/kvkk.ejs yazılınca 200 döner)', async (t) => {
  if (!fs.existsSync(path.join(__dirname, '..', 'views', 'kvkk.ejs'))) return t.skip('views/kvkk.ejs henüz yok (ön yüz işçisi yazacak)');
  const r = await request(app).get('/kvkk');
  assert.strictEqual(r.status, 200);
  assert.match(r.text, /KVKK/);
});

test('teklif POST: kayıttan sonra bildirim modülü çağrılır, hatası akışı bozmaz', async () => {
  const asil = bildirim.yeniTeklif;
  const cagrilar = [];
  bildirim.yeniTeklif = async (teklif) => { cagrilar.push(teklif); };
  const yarin = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const form = (ad) => ({
    ad_soyad: ETIKET + ad, telefon: '05321234567', eposta: 'test@ornek.com', etkinlik_turu: 'Fuar standı',
    sehir: 'Konya', tarih: yarin, gun_sayisi: '2', kvkk: 'on',
  });
  try {
    // Hız sınırı (15 dakikada 5) başka testlerle çakışmasın diye her istek ayrı IP'den
    const r = await request(app).post('/teklif').set('X-Forwarded-For', '10.9.8.' + (Date.now() % 250)).type('form').send(form(' Bildirim'));
    assert.strictEqual(r.status, 302);
    assert.strictEqual(r.headers.location, '/teklif/tesekkurler');
    assert.strictEqual(cagrilar.length, 1);
    assert.strictEqual(cagrilar[0].ad_soyad, ETIKET + ' Bildirim');
    assert.ok(cagrilar[0].id, 'kayıt id ile verildi');

    bildirim.yeniTeklif = async () => { throw new Error('smtp çöktü'); };
    const log = console.error; console.error = () => {};
    try {
      const r2 = await request(app).post('/teklif').set('X-Forwarded-For', '10.9.7.' + (Date.now() % 250)).type('form').send(form(' Hata'));
      assert.strictEqual(r2.status, 302);
    } finally { console.error = log; }
  } finally {
    bildirim.yeniTeklif = asil;
  }
});

test('bildirim: SMTP ayarı yokken gönderim yapmaz, hata fırlatmaz', async () => {
  const kaydet = { ...process.env };
  for (const k of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'BILDIRIM_EPOSTA']) delete process.env[k];
  const log = console.log; console.log = () => {};
  try {
    assert.strictEqual(await bildirim.yeniTeklif({ ad_soyad: 'A', etkinlik_turu: 'B', sehir: 'C', tarih: new Date() }), false);
  } finally { console.log = log; Object.assign(process.env, kaydet); }
});

test('lib/gorsel: imzaKontrol doğru ve yanlış örnekler', async () => {
  const yap = (bicim) => sharp({ create: { width: 8, height: 8, channels: 3, background: '#f00' } })[bicim]().toBuffer();
  assert.strictEqual(await imzaKontrol(await yap('jpeg')), true);
  assert.strictEqual(await imzaKontrol(await yap('png')), true);
  assert.strictEqual(await imzaKontrol(await yap('webp')), true);
  assert.strictEqual(await imzaKontrol(Buffer.from('<?php echo 1; ?> merhaba dunya')), false);
  assert.strictEqual(await imzaKontrol(Buffer.from('GIF89a......')), false);
  assert.strictEqual(await imzaKontrol(Buffer.from('RIFF....WAVEfmt ')), false);
  assert.strictEqual(await imzaKontrol(Buffer.alloc(0)), false);
  assert.strictEqual(await imzaKontrol('metin'), false);
});

test('lib/gorsel: hazirla — WebP, tam ≤1600, küçük ≤600, büyütme yok', async () => {
  const buyuk = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#888' } }).jpeg().toBuffer();
  const { tam, kucuk, tur } = await hazirla(buyuk);
  assert.strictEqual(tur, 'image/webp');
  const t = await sharp(tam).metadata(), k = await sharp(kucuk).metadata();
  assert.strictEqual(t.format, 'webp');
  assert.strictEqual(Math.max(t.width, t.height), 1600);
  assert.strictEqual(k.width, 600);

  const ufak = await sharp({ create: { width: 200, height: 100, channels: 3, background: '#888' } }).png().toBuffer();
  assert.strictEqual((await sharp((await hazirla(ufak)).tam).metadata()).width, 200);
});

// ---------- Düzeltme turu testleri (D3–D6, D10, D11) ----------

test('D3 görsel: ?v= varsa bir yıl immutable, yoksa / geçersizse no-cache; 304 ikisinde de çalışır', async () => {
  const p = await fotografliProje();
  for (const yol of [`/gorsel/${p.id}?v=1700000000000`, `/gorsel/${p.id}?boy=kucuk&v=1700000000000`]) {
    const r = await request(app).get(yol);
    assert.strictEqual(r.status, 200, yol);
    assert.strictEqual(r.headers['cache-control'], 'public, max-age=31536000, immutable', yol);
    assert.strictEqual((await request(app).get(yol).set('If-None-Match', r.headers.etag)).status, 304, yol);
  }
  for (const yol of [`/gorsel/${p.id}`, `/gorsel/${p.id}?v=abc`, `/gorsel/${p.id}?v=`, `/gorsel/${p.id}?boy=kucuk&v=1x`]) {
    assert.strictEqual((await request(app).get(yol)).headers['cache-control'], 'no-cache', yol);
  }
});

test('D3 görsel: ziyaretçi sayfalarındaki her /gorsel/ adresi ?v= taşır; fotoğraf değişince adres de değişir', async () => {
  const p = await fotografliProje();
  const gorselAdresleri = (html) => [...html.matchAll(/\/gorsel\/\d+[^"\s,]*/g)].map((m) => m[0]);
  for (const yol of ['/', '/calismalar', '/calismalar/' + p.id, '/hakkimizda']) {
    const adresler = gorselAdresleri((await request(app).get(yol)).text);
    assert.ok(adresler.length > 0, yol + ': görsel adresi bulunamadı');
    for (const a of adresler) assert.match(a, /[?&;]v=\d+/, `${yol}: sürümsüz adres ${a}`);
  }
  const surum = async () => (await request(app).get('/calismalar/' + p.id)).text.match(new RegExp(`/gorsel/${p.id}\\?v=(\\d+)`))[1];
  const once = await surum();
  await pool.query(`UPDATE projeler SET guncelleme = guncelleme + interval '2 seconds' WHERE id = $1`, [p.id]);
  try {
    assert.notStrictEqual(await surum(), once, 'güncelleme sonrası v değişmeli');
  } finally {
    await pool.query(`UPDATE projeler SET guncelleme = guncelleme - interval '2 seconds' WHERE id = $1`, [p.id]);
  }
});

test('D4 teklif POST: form dışı gövde (text/plain) 500 vermez, doğrulama hatası döner', async () => {
  const r = await request(app).post('/teklif').set('X-Forwarded-For', '10.7.6.' + (Date.now() % 250))
    .set('Content-Type', 'text/plain').send('merhaba');
  assert.strictEqual(r.status, 422);
  assert.match(r.text, /Teklif iste/);
});

test('D5 pool: DATABASE_SSL_GEVSEK adresteki sslmode=require varken de etkili, varsayılan davranış değişmez', () => {
  const { spawnSync } = require('child_process');
  const oku = (env) => {
    const s = spawnSync(process.execPath, ['-e', "const p=require('./db/pool');console.log(JSON.stringify({a:p.options.connectionString,s:p.options.ssl}));process.exit(0)"],
      { cwd: path.join(__dirname, '..'), encoding: 'utf8', env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...env } });
    assert.strictEqual(s.status, 0, s.stderr);
    return JSON.parse(s.stdout.trim().split('\n').pop());
  };
  const adres = 'postgres://k:s@sunucu.ornek.invalid/db?sslmode=require';
  const gevsek = oku({ DATABASE_URL: adres, DATABASE_SSL: 'true', DATABASE_SSL_GEVSEK: 'true' });
  assert.deepStrictEqual(gevsek.s, { rejectUnauthorized: false });
  assert.doesNotMatch(gevsek.a, /sslmode/, 'gevşek modda adresteki sslmode atılır (pg onu öne alırdı)');
  assert.match(gevsek.a, /^postgres:\/\/k:s@sunucu\.ornek\.invalid\/db$/);
  const siki = oku({ DATABASE_URL: adres, DATABASE_SSL: 'true' });
  assert.deepStrictEqual(siki.s, { rejectUnauthorized: true });
  assert.strictEqual(siki.a, adres, 'varsayılanda adres olduğu gibi kalır');
  assert.strictEqual(oku({ DATABASE_URL: adres }).s, false);
});

test('D6 bildirim: SITE_URL de olmadan e-posta ayarı tamam sayılmaz', () => {
  const kaydet = { ...process.env };
  Object.assign(process.env, { SMTP_HOST: 'h', SMTP_PORT: '587', SMTP_USER: 'u', SMTP_PASS: 'p', BILDIRIM_EPOSTA: 'a@b.c', SITE_URL: 'https://ornek.test' });
  try {
    assert.strictEqual(bildirim.ayarVarMi(), true);
    delete process.env.SITE_URL;
    assert.strictEqual(bildirim.ayarVarMi(), false);
  } finally {
    for (const k of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'BILDIRIM_EPOSTA', 'SITE_URL']) {
      if (kaydet[k] === undefined) delete process.env[k]; else process.env[k] = kaydet[k];
    }
  }
});

test('D10 hata sayfaları: canonical / og:url yok, her zaman noindex', async () => {
  const kaydet = process.env.SITE_URL;
  process.env.SITE_URL = 'https://ornek.test'; // canonical üretilebilecek durum
  try {
    const olumlu = await request(app).get('/iletisim');
    assert.match(olumlu.text, /rel="canonical"/, 'normal sayfada canonical var');
    const bulunamadi = await request(app).get('/olmayan-sayfa-xyz');
    assert.strictEqual(bulunamadi.status, 404);
    const hata = await new Promise((coz, red) => app.render('hata', {
      baslik: 'Bir sorun oluştu', firma: require('../config/firma'), demo: false, yol: '/herhangi', siteUrl: 'https://ornek.test',
    }, (e, html) => (e ? red(e) : coz(html))));
    for (const [ad, html] of [['404', bulunamadi.text], ['hata', hata]]) {
      assert.doesNotMatch(html, /rel="canonical"/, ad);
      assert.doesNotMatch(html, /property="og:url"/, ad);
      assert.match(html, /<meta name="robots" content="noindex">/, ad);
    }
  } finally {
    if (kaydet === undefined) delete process.env.SITE_URL; else process.env.SITE_URL = kaydet;
  }
});

test('D11 hakkımızda gösterisi: küçük boy + srcset (sürümlü), gosteri.js srcset yükler', async () => {
  const r = await request(app).get('/hakkimizda');
  const imgler = [...r.text.matchAll(/<img [^>]*>/g)].map((m) => m[0]).filter((s) => s.includes('width="520"'));
  assert.strictEqual(imgler.length, 12);
  for (const im of imgler) {
    assert.match(im, /(?:src|data-src)="\/gorsel\/\d+\?boy=kucuk&amp;v=\d+"/);
    assert.match(im, /(?:srcset|data-srcset)="\/gorsel\/\d+\?boy=kucuk&amp;v=\d+ 600w, \/gorsel\/\d+\?v=\d+ 1600w"/);
    assert.match(im, /sizes="[^"]+"/);
  }
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'gosteri.js'), 'utf8'), /dataset\.srcset/);
});

test('/saglik: 200 ok, no-store, veritabanı sorgusu yok', async () => {
  let r;
  const n = await sorguSay(async () => { r = await request(app).get('/saglik'); });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.text, 'ok');
  assert.match(r.headers['cache-control'], /no-store/);
  assert.strictEqual(n, 0);
});

test('görsel ısıtma: küçük ve tam boylar önbelleğe girer, etag/tür rotayla aynı; ISIT_GORSEL=false iken çalışmaz', async () => {
  const p = await fotografliProje();
  onbellek.temizle();
  process.env.ISIT_GORSEL = 'false';
  try { assert.strictEqual(await onbellek.isit({ log: false }), null); } finally { delete process.env.ISIT_GORSEL; }
  assert.strictEqual(onbellek.bilgi().kayit, 0, 'kapalıyken önbellek boş');

  const s = await onbellek.isit({ log: false });
  assert.ok(s.adet > 0 && s.bayt > 0);
  assert.ok(onbellek.bilgi().bayt <= onbellek.SINIR_BAYT);
  const kucukVar = (await pool.query('SELECT gorsel_kucuk IS NOT NULL AS v FROM projeler WHERE id = $1', [p.id])).rows[0].v;
  const isitilan = new Map();
  for (const k of kucukVar ? [true, false] : [false]) {
    const e = onbellek.al(p.id, k, '');
    assert.ok(e, (k ? 'küçük' : 'tam') + ' boy önbellekte');
    isitilan.set(k, e);
  }
  // Rota aynı kaydı üretsin: önbelleği boşaltıp rotadan al, etag/tür/veri karşılaştır
  for (const [kucuk, e] of isitilan) {
    onbellek.sil(p.id);
    const r = await request(app).get('/gorsel/' + p.id + (kucuk ? '?boy=kucuk' : ''));
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.headers.etag, e.etag);
    assert.strictEqual(r.headers['content-type'].split(';')[0], e.tur);
    assert.ok(Buffer.compare(r.body, e.veri) === 0);
  }
  onbellek.temizle();
});
