// Ön yüz düzeltmeleri testleri (H1, H4, H5, H8, H9, H10, H11):
// KVKK, görsel srcset/lazy, sayfaya özel SEO + JSON-LD, mobil eylem, koyu tema kontrastı, erişilebilirlik.
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { test, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../app');
const pool = require('../db/pool');
const firma = require('../config/firma');

after(async () => {
  await pool.end();
});

async function birProje() {
  return (await pool.query('SELECT id, musteri, etkinlik FROM projeler ORDER BY id LIMIT 1')).rows[0];
}

function kontrast(hexA, hexB) {
  const lum = (hex) => {
    const k = [1, 3, 5].map(i => {
      const v = parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2];
  };
  const l1 = lum(hexA), l2 = lum(hexB);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

test('H1: /kvkk 200 döner, teklif formu ve alt bilgi /kvkk bağlantısı içerir', async () => {
  const k = await request(app).get('/kvkk');
  assert.strictEqual(k.status, 200, '/kvkk 200');
  assert.strictEqual((k.text.match(/<h1[\s>]/g) || []).length, 1, '/kvkk tek h1');
  assert.match(k.text, /<!-- Bu metin müşteri tarafından gözden geçirilmelidir -->/);
  assert.match(k.text, /6698 sayılı/);
  assert.ok(k.text.includes(firma.eposta), 'veri sorumlusu e-posta');

  const t = await request(app).get('/teklif');
  assert.strictEqual(t.status, 200);
  assert.match(t.text, /<a href="\/kvkk" target="_blank" rel="noopener">KVKK Aydınlatma Metni<\/a>'ni okudum/);

  const ana = await request(app).get('/');
  const footer = ana.text.match(/<footer[\s\S]*?<\/footer>/)[0];
  assert.match(footer, /href="\/kvkk"/, 'alt bilgide KVKK bağlantısı');
});

test('H5: her sayfanın meta description değeri birbirinden farklı, süzgeç yansır', async () => {
  const p = await birProje();
  const yollar = ['/', '/calismalar', '/calismalar?tur=fuar', '/calismalar/' + p.id, '/hakkimizda', '/iletisim', '/teklif', '/kvkk'];
  const aciklamalar = new Map();
  for (const yol of yollar) {
    const r = await request(app).get(yol);
    assert.strictEqual(r.status, 200, yol);
    const m = r.text.match(/<meta name="description" content="([^"]+)">/);
    assert.ok(m && m[1].length > 20, yol + ' description');
    aciklamalar.set(yol, m[1]);
  }
  assert.strictEqual(new Set(aciklamalar.values()).size, yollar.length, 'tüm sayfaların description değeri benzersiz');
  assert.match(aciklamalar.get('/calismalar?tur=fuar'), /Fuar/, 'süzgeç description içine yansır');
  assert.ok(aciklamalar.get('/calismalar/' + p.id).includes(p.musteri), 'çalışma detayı projeye özel');
});

test('H5: Open Graph, Twitter Card ve siteUrl varsa canonical / og:url basılır', async () => {
  const p = await birProje();
  const ana = await request(app).get('/');
  assert.match(ana.text, /<meta property="og:title" content="[^"]+">/);
  assert.match(ana.text, /<meta property="og:description" content="[^"]+">/);
  assert.match(ana.text, /<meta property="og:image" content="[^"]+">/);
  assert.match(ana.text, /<meta name="twitter:card" content="(summary|summary_large_image)">/);
  // siteUrl varsa canonical ve og:url birlikte bulunur
  if (ana.text.includes('rel="canonical"')) {
    assert.match(ana.text, /<link rel="canonical" href="https?:\/\/[^"]+">/);
    assert.match(ana.text, /<meta property="og:url" content="https?:\/\/[^"]+">/);
  }
  // Detay sayfasında og:image proje görseli
  const detay = await request(app).get('/calismalar/' + p.id);
  assert.match(detay.text, new RegExp(`<meta property="og:image" content="[^"]*/gorsel/${p.id}\\?v=\\d+">`));
});

test('H5: ana sayfada ve iletişimde geçerli LocalBusiness JSON-LD var', async () => {
  for (const yol of ['/', '/iletisim']) {
    const r = await request(app).get(yol);
    const m = r.text.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    assert.ok(m, yol + ' JSON-LD');
    assert.doesNotMatch(m[1], /</, yol + ' JSON-LD içinde ham < olmamalı');
    const veri = JSON.parse(m[1]);
    assert.strictEqual(veri['@type'], 'LocalBusiness');
    assert.strictEqual(veri.name, firma.ad);
    assert.strictEqual(veri.telephone, firma.telefon);
    assert.strictEqual(veri.email, firma.eposta);
    assert.ok(veri.address && veri.address.streetAddress === firma.adres);
  }
  const t = await request(app).get('/teklif');
  assert.doesNotMatch(t.text, /application\/ld\+json/, 'teklif sayfasında LocalBusiness JSON-LD gerekmez');
});

test('H10: teklif formunda legend içinde h2 yok', async () => {
  const r = await request(app).get('/teklif');
  assert.strictEqual(r.status, 200);
  const legendler = [...r.text.matchAll(/<legend>([\s\S]*?)<\/legend>/g)];
  assert.strictEqual(legendler.length, 3);
  for (const l of legendler) assert.doesNotMatch(l[1], /<h[1-6][\s>]/i, 'legend içinde başlık etiketi yok');
});

test('H11: hakkımızda otomatik slaytta aria-live yok ve görünür Duraklat düğmesi var', async () => {
  const r = await request(app).get('/hakkimizda');
  assert.strictEqual(r.status, 200);
  const fig = r.text.match(/<figure class="hakkinda-foto gosteri"[\s\S]*?<\/figure>/)[0];
  assert.doesNotMatch(fig, /aria-live=/, 'otomatik slaytta başlangıçta aria-live yok');
  assert.match(fig, /data-duraklat[^>]*aria-pressed="false"/, 'duraklat düğmesi aria-pressed ile tanımlı');
  assert.match(fig, /Duraklat/, 'görünür Duraklat etiketi');
});

test('H4: kartlarda küçük boy + srcset + sizes, şeritte yalnız ilk 4 eager, detay tam boy', async () => {
  const ana = await request(app).get('/');
  const serit = ana.text.match(/<ul class="serit-ray">[\s\S]*?<\/ul>/)[0];
  const imgler = [...serit.matchAll(/<img [^>]+>/g)].map(m => m[0]);
  assert.ok(imgler.length >= 5, 'şeritte en az 5 görsel');
  for (const im of imgler) {
    assert.match(im, /src="\/gorsel\/\d+\?boy=kucuk&amp;v=\d+"/);
    assert.match(im, /srcset="\/gorsel\/\d+\?boy=kucuk&amp;v=\d+ 600w, \/gorsel\/\d+\?v=\d+ 1600w"/);
    assert.match(im, /sizes="[^"]+"/);
    assert.match(im, /width="\d+"/);
    assert.match(im, /height="\d+"/);
  }
  assert.strictEqual((serit.match(/loading="eager"/g) || []).length, 4, 'şeritte yalnız ilk 4 görsel eager');
  assert.strictEqual((serit.match(/loading="lazy"/g) || []).length, imgler.length - 4, 'şeritte kalan görseller lazy');

  const hero = ana.text.match(/<div class="hero-zemin"[\s\S]*?<\/div>/)[0];
  assert.match(hero, /fetchpriority="high"/, 'hero ilk görseli fetchpriority=high');

  const p = await birProje();
  const detay = await request(app).get('/calismalar/' + p.id);
  const buyuk = detay.text.match(/<a class="foto-ac"[\s\S]*?<\/a>/)[0];
  assert.match(buyuk, new RegExp(`src="/gorsel/${p.id}\\?v=\\d+"`), 'detay büyük görselde tam boy');
  assert.doesNotMatch(buyuk, /boy=kucuk/, 'detay büyük görsel küçük boy değil');
});

test('H9: koyu temada --hata ve --basari zemin ve yüzey üstünde WCAG AA (>=4.5:1) sağlar', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'site.css'), 'utf8');
  const koyu = css.match(/html\[data-tema="koyu"\]\s*\{([\s\S]*?)\}/);
  assert.ok(koyu, 'koyu tema bloğu var');
  const oku = (ad) => {
    const m = koyu[1].match(new RegExp(ad + ':\\s*(#[0-9a-f]{6})', 'i'));
    assert.ok(m, ad + ' koyu temada tanımlı');
    return m[1];
  };
  const zemin = oku('--zemin'), yuzey = oku('--yuzey'), hata = oku('--hata'), basari = oku('--basari');
  assert.ok(kontrast(hata, zemin) >= 4.5, '--hata/zemin ' + kontrast(hata, zemin).toFixed(2));
  assert.ok(kontrast(hata, yuzey) >= 4.5, '--hata/yuzey ' + kontrast(hata, yuzey).toFixed(2));
  assert.ok(kontrast(basari, zemin) >= 4.5, '--basari/zemin ' + kontrast(basari, zemin).toFixed(2));
  assert.ok(kontrast(basari, yuzey) >= 4.5, '--basari/yuzey ' + kontrast(basari, yuzey).toFixed(2));
});
