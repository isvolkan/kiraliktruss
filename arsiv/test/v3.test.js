// v3 (üçüncü sürüm) ana sayfa testleri. Çalıştırma: npm test
require('dotenv').config();
const { test, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../app');
const pool = require('../db/pool');
const firma = require('../config/firma');
const izo = require('../public/v3/js/izo');

after(async () => { await pool.end(); });

// HTML etiketlerini atıp düz metni verir (ekran okuyucu / arama motoru gibi)
const duzMetin = (html) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');

test('v3 ana sayfa /v3 ve /v3/ adresinde açılıyor, v3 varlıklarını ve /v3 bağlantılarını kullanıyor', async () => {
  for (const yol of ['/v3', '/v3/']) {
    const r = await request(app).get(yol);
    assert.strictEqual(r.status, 200, yol);
  }
  const r = await request(app).get('/v3/');
  assert.match(r.text, /href="\/v3\/calismalar"/);
  assert.match(r.text, /href="\/v3\/teklif"/);
  assert.match(r.text, /\/v3\/css\/temel\.css/);
  assert.match(r.text, /\/v3\/css\/anasayfa\.css/);
  assert.match(r.text, /\/v3\/js\/izo\.js/);
  assert.match(r.text, /\/v3\/js\/anasayfa\.js/);
  assert.doesNotMatch(r.text, /\/v2\/(css|js)\//);
  assert.doesNotMatch(r.text, /\/css\/site\.css/);
});

test('v3 ana sayfa: başlık ve gerçek sayılar düz metin olarak HTML\'de', async () => {
  const r = await request(app).get('/v3/');
  const metin = duzMetin(r.text);
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM projeler');
  assert.match(r.text, /<h1[^>]*>Fuar, sahne ve etkinlikler için orijinal alüminyum truss\.<\/h1>/);
  assert.ok(metin.includes('~' + firma.stokMetretul.toLocaleString('tr-TR') + ' mt'), 'stok metretül');
  assert.ok(metin.includes(String(firma.kurulus)), 'kuruluş yılı');
  assert.ok(metin.includes(rows[0].n.toLocaleString('tr-TR') + ' proje'), 'arşivdeki proje sayısı');
  // Rakam şeridi ("0 1 2 … 9") ve "0" sayaç sızmaz; sayaç öznitelikleri yok
  assert.doesNotMatch(metin, /0 1 2 3 4 5 6 7 8 9/);
  assert.doesNotMatch(r.text, /data-sayac|data-say=|class="rulo/);
  // Başlık gizlenmez: animasyon özniteliği yok
  assert.doesNotMatch(r.text, /<h1[^>]*data-(yuksel|belir)/);
});

test('v3 ana sayfa: "son kurduklarımız" listesinde aynı proje adı iki kez çıkmıyor', async () => {
  const r = await request(app).get('/v3/');
  const adlar = [...r.text.matchAll(/class="kart-baslik">([^<]*)</g)].map((m) => m[1].trim().toLocaleLowerCase('tr'));
  assert.ok(adlar.length > 0, 'kart var');
  assert.strictEqual(new Set(adlar).size, adlar.length, 'yinelenen ad: ' + adlar.join(', '));
});

test('v3 kartlar: etkinlik şehirle aynıysa iki kez yazılmıyor', async () => {
  const r = await request(app).get('/v3/');
  for (const m of r.text.matchAll(/<a class="kart"[\s\S]*?<\/a>/g)) {
    const kunye = (m[0].match(/class="kart-kunye mono">([^<]*)</) || [])[1] || '';
    const alt = (m[0].match(/class="kart-alt">([^<]*)</) || [])[1];
    if (alt) assert.ok(!kunye.split(' · ').map((s) => s.toLocaleLowerCase('tr')).includes(alt.toLocaleLowerCase('tr')), kunye + ' / ' + alt);
  }
  assert.doesNotMatch(duzMetin(r.text), /İstanbul \/ İstanbul/);
});

test('v3 hesaplayıcı: üst yarıda, formül v1/v2 ile aynı, ilk çizim ve sonuç sunucuda', async () => {
  const r = await request(app).get('/v3/');
  const hesap = r.text.indexOf('id="hesapla"'), proje = r.text.indexOf('id="proje-b"'), sahne = r.text.indexOf('id="kurulum"');
  assert.ok(hesap > 0 && hesap < proje && hesap < sahne, 'hesaplayıcı projelerden ve sahneden önce');
  assert.match(r.text, /<form class="hesap[^"]*" id="hesap" action="\/v3\/teklif" method="get">/);
  assert.match(r.text, /id="hSonuc"[^>]*><b>32<\/b>/); // 6 × 4 × 3 çerçeve: 4·3 + 2·(6+4) = 32
  assert.match(r.text, /<figure class="cizim[^"]*" id="cizim" role="img" aria-label="Şematik çizim: 6 × 4 m, 3 m yükseklikte çerçeve">\s*<svg/);
  // v1/v2 formülü
  assert.strictEqual(izo.metretul({ yapi: 'cerceve', en: 6, boy: 4, yuk: 3, adet: 1 }), 32);
  assert.strictEqual(izo.metretul({ yapi: 'tavan', en: 12, boy: 6, yuk: 4, adet: 1 }), 70);
  assert.strictEqual(izo.metretul({ yapi: 'kemer', en: 8, boy: 4, yuk: 5, adet: 2 }), 36);
  assert.strictEqual(izo.metretul({ yapi: 'kule', en: 1, boy: 1, yuk: 6, adet: 3 }), 18);
  // Çizim ölçüye göre değişir
  assert.notStrictEqual(izo.cerceve({ yapi: 'cerceve', en: 6, boy: 4, yuk: 3 }), izo.cerceve({ yapi: 'cerceve', en: 10, boy: 4, yuk: 3 }));
  assert.match(izo.cerceve({ yapi: 'tavan', en: 12, boy: 6, yuk: 4 }), /ck-ara/);
});

test('v3 ana sayfa: kurulum gecesi yok, hizmetler tek ızgarada, izometrik sahne sunucuda çizilmiş', async () => {
  const r = await request(app).get('/v3/');
  assert.doesNotMatch(r.text, /Bir kurulum gecesi/);
  assert.doesNotMatch(r.text, /k19-yigin|k21/);
  assert.strictEqual((r.text.match(/<li class="hizmet"/g) || []).length, 4);
  assert.strictEqual((r.text.match(/<g class="parca">/g) || []).length, 5);
  assert.match(r.text, /<nav class="hizli" aria-label="Hızlı iletişim">[\s\S]*href="tel:[^"]+"[\s\S]*href="\/v3\/teklif"/);
});

test('v3 varlıkları sunuluyor', async () => {
  for (const yol of ['/v3/css/temel.css', '/v3/css/anasayfa.css', '/v3/css/sayfalar.css', '/v3/css/calismalar.css',
    '/v3/js/temel.js', '/v3/js/tema-erken.js', '/v3/js/izo.js', '/v3/js/anasayfa.js', '/v3/js/teklif.js']) {
    const r = await request(app).get(yol);
    assert.strictEqual(r.status, 200, yol);
  }
});

test('v1 ve v2 ana sayfaları değişmedi', async () => {
  const v1 = await request(app).get('/');
  assert.strictEqual(v1.status, 200);
  assert.match(v1.text, /\/css\/site\.css/);
  assert.doesNotMatch(v1.text, /\/v3\//);
  const v2 = await request(app).get('/v2/');
  assert.strictEqual(v2.status, 200);
  assert.match(v2.text, /\/v2\/css\/anasayfa\.css/);
  assert.doesNotMatch(v2.text, /\/v3\//);
});
