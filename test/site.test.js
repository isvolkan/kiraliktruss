// Ziyaretçi sitesi ("yön tabelası" tasarımı, v6 olarak geliştirildi) duman testleri:
// sayfalar, eski adres yönlendirmeleri, ön doldurma, form doğrulama ve gönderim.
require('dotenv').config();
const { test, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../app');
const pool = require('../db/pool');

const ETIKET = 'TEST-site-' + Date.now();

after(async () => {
  await pool.query('DELETE FROM teklifler WHERE ad_soyad LIKE $1', [ETIKET + '%']);
  await pool.end();
});

function yarin() { return new Date(Date.now() + 86400000).toISOString().slice(0, 10); }
async function birProje() { return (await pool.query('SELECT id, musteri, etkinlik FROM projeler ORDER BY id LIMIT 1')).rows[0]; }

test('site: tüm sayfalar açılıyor, bilinmeyen sayfa 404', async () => {
  const p = await birProje();
  for (const yol of ['/', '/calismalar', '/calismalar?gorunum=liste', '/calismalar?tur=fuar&sayfa=2',
    '/calismalar/' + p.id, '/hakkimizda', '/iletisim', '/teklif', '/teklif/tesekkurler']) {
    const r = await request(app).get(yol);
    assert.strictEqual(r.status, 200, yol);
    assert.strictEqual((r.text.match(/<h1[\s>]/g) || []).length, 1, yol + ' tek h1');
  }
  const y = await request(app).get('/yok');
  assert.strictEqual(y.status, 404);
  assert.match(y.text, /Bu sayfayı bulamadık\./);
});

test('site: sayfalarda eski sürüm öneki (/v2 … /v6) yok', async () => {
  const p = await birProje();
  for (const yol of ['/', '/calismalar', '/calismalar/' + p.id, '/hakkimizda', '/iletisim', '/teklif', '/teklif/tesekkurler', '/yok']) {
    const r = await request(app).get(yol);
    assert.doesNotMatch(r.text, /\/v[2-6](?=[/"?#])/, yol);
  }
});

test('site: eski sürüm adresleri kalıcı olarak öneksiz adrese yönlenir', async () => {
  const beklenen = {
    '/v6/calismalar?x=1': '/calismalar?x=1',
    '/v6/teklif': '/teklif',
    '/v6': '/',
    '/v6?tur=fuar': '/?tur=fuar',
    '/v3': '/',
    '/v2/hakkimizda': '/hakkimizda',
    '/v6//baska-site.example': '/baska-site.example', // başka siteye açık yönlendirme olmasın
    '/ornek-calismalar': '/calismalar',
    '/ornek-calismalar/page/2/': '/calismalar',
  };
  for (const [eski, yeni] of Object.entries(beklenen)) {
    const r = await request(app).get(eski);
    assert.strictEqual(r.status, 301, eski);
    assert.strictEqual(r.headers.location, yeni, eski);
  }
  assert.strictEqual((await request(app).get('/v7')).status, 404); // yalnız v2–v6
  assert.strictEqual((await request(app).get('/v6x')).status, 404);
});

test('site: ana sayfada mini form var, hesaplayıcı (şimdilik) yok', async () => {
  const r = await request(app).get('/');
  assert.match(r.text, /<form[^>]*method="get"[^>]*action="\/teklif"/);
  for (const ad of ['etkinlik_turu', 'tarih', 'sehir']) assert.match(r.text, new RegExp(`name="${ad}"`), ad);
  assert.doesNotMatch(r.text, /id="hesapla"|#hesapla/);
  assert.match(r.text, /class="tema-dugme"/);
  const ad = (r.text.match(/class="m-isim"/g) || []).length;
  assert.ok(ad > 0 && ad <= 12, 'işler ızgarasında 1–12 ad: ' + ad);
  assert.match(r.text, /Truss kiralıyoruz\./);
});

test('site: çalışmalar liste görünümü tablo çizer, süzgeç daraltır', async () => {
  const r = await request(app).get('/calismalar?tur=fuar&gorunum=liste');
  assert.strictEqual(r.status, 200);
  assert.match(r.text, /<table class="liste-tablo"/);
  const say = (html) => Number(html.match(/class="sonuc-sayisi">(\d+) /)[1]);
  const hepsi = await request(app).get('/calismalar');
  const etkinlik = await request(app).get('/calismalar?tur=etkinlik');
  assert.ok(say(etkinlik.text) < say(hepsi.text));
  const bos = await request(app).get('/calismalar?q=' + encodeURIComponent('olmayan-bir-ad-' + ETIKET));
  assert.match(bos.text, /Bu filtreyle çalışma bulunamadı\./);
});

test('site: teklif formu sorgu parametreleriyle dolu açılır', async () => {
  const r = await request(app).get('/teklif?metretul=120&etkinlik_turu=' + encodeURIComponent('Fuar standı') + '&tarih=2030-05-01&sehir=Ankara');
  assert.strictEqual(r.status, 200);
  assert.match(r.text, /name="metretul"[^>]*value="120"/);
  assert.match(r.text, /<option selected>Fuar standı<\/option>/);
  assert.match(r.text, /name="tarih"[^>]*value="2030-05-01"/);
  assert.match(r.text, /name="sehir" value="Ankara"/);
});

test('site: geçersiz ön doldurma yok sayılır, şehir kaçışlı basılır', async () => {
  const r = await request(app).get('/teklif?etkinlik_turu=Uydurma&tarih=yarin&metretul=99999&sehir=' + encodeURIComponent('<script>alert(1)</script>'));
  assert.strictEqual(r.status, 200);
  assert.doesNotMatch(r.text, /<option selected>/);
  assert.match(r.text, /name="tarih"[^>]*value=""/);
  assert.match(r.text, /name="metretul"[^>]*value=""/);
  assert.ok(!r.text.includes('<script>alert(1)</script>'));
  assert.ok(r.text.includes('&lt;script&gt;'));
});

test('site: ?ref ile örnek iş mesaja yazılır, olmayan ref sessizce yok sayılır', async () => {
  const p = await birProje();
  const r = await request(app).get('/teklif?ref=' + p.id);
  assert.strictEqual(r.status, 200);
  assert.ok(r.text.includes('Örnek gösterdiğiniz iş:'));
  assert.match(r.text, /<textarea[^>]*>Örnek gösterdiğim iş: /);
  const yok = await request(app).get('/teklif?ref=999999');
  assert.strictEqual(yok.status, 200);
  assert.ok(!yok.text.includes('Örnek gösterdiğiniz iş:'));
});

test('site: teklif formunda tüm alan adları var', async () => {
  const r = await request(app).get('/teklif');
  for (const ad of ['etkinlik_turu', 'sehir', 'tarih', 'gun_sayisi', 'metretul', 'kurulum', 'mesaj', 'ad_soyad', 'firma', 'telefon', 'eposta', 'kvkk', 'web_sitesi']) {
    assert.match(r.text, new RegExp(`name="${ad}"`), ad);
  }
  assert.match(r.text, /<form[^>]*method="post"[^>]*action="\/teklif"/);
  assert.doesNotMatch(r.text, /novalidate/);
  assert.doesNotMatch(r.text, /class="alt-cubuk"/); // teklif sayfasında alt çubuk yok
});

test('site: boş gönderim 422, hatalar alanların altında (üst özet kutusu yok); değerler korunur', async () => {
  const r = await request(app).post('/teklif').type('form').send({ sehir: 'İzmir', kurulum: 'on' });
  assert.strictEqual(r.status, 422);
  // Görünür özet kutusu yok; yalnız görünmez tek cümlelik uyarı
  assert.doesNotMatch(r.text, /class="hata-ozet"|data-hata-ozet|<h2[^>]*>Formda/);
  assert.match(r.text, /<p class="gizli" role="alert">Formda \d+ alan düzeltilmeli\.<\/p>/);
  assert.doesNotMatch(r.text, /href="#(etkinlik_turu|telefon|kvkk)"/);
  for (const ad of ['etkinlik_turu', 'tarih', 'ad_soyad', 'telefon', 'eposta', 'kvkk']) {
    // Alan, hata metnine bağlı; hata metni alanın kendi kabında, alandan sonra
    assert.match(r.text, new RegExp(`id="${ad}"[^>]*aria-invalid="true" aria-describedby="${ad}-hata"`), ad);
    const kap = r.text.match(new RegExp(`<div class="alan[^"]*hatali">(?:(?!<div class="alan)[\\s\\S])*?id="${ad}"[\\s\\S]*?</div>`));
    assert.ok(kap, ad + ' hatalı alan kabı');
    assert.match(kap[0], new RegExp(`id="${ad}-hata"`), ad + ' hata metni kendi kabında');
    assert.ok(kap[0].indexOf(`id="${ad}"`) < kap[0].indexOf(`id="${ad}-hata"`), ad + ' hata alanın altında');
  }
  // KVKK hatası onay kutusunun hemen altında (etiketten sonra)
  assert.match(r.text, /id="kvkk"[\s\S]*?<\/label>\s*<p class="alan-hata" id="kvkk-hata">/);
  // Hatasız alanda hata metni yok
  assert.doesNotMatch(r.text, /id="sehir-hata"/);
  assert.match(r.text, /name="sehir" value="İzmir"/);
  assert.match(r.text, /name="kurulum" value="on" checked/);
});

test('site: geçerli gönderim kaydedilir ve teşekkür sayfasına yönlenir', async () => {
  const r = await request(app).post('/teklif').type('form').send({
    ad_soyad: ETIKET + ' Deneme', telefon: '0532 123 45 67', eposta: 'test@example.com',
    etkinlik_turu: 'Fuar standı', sehir: 'Ankara', tarih: yarin(), gun_sayisi: '2', metretul: '64', kurulum: 'on', kvkk: 'on',
  });
  assert.strictEqual(r.status, 302);
  assert.strictEqual(r.headers.location, '/teklif/tesekkurler');
  const { rows } = await pool.query('SELECT metretul FROM teklifler WHERE ad_soyad = $1', [ETIKET + ' Deneme']);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].metretul, 64);
});

test('site: gerçek logo ve hero arka plan fotoğrafları', async () => {
  const r = await request(app).get('/');
  assert.match(r.text, /<img src="\/img\/logo\.png" alt="Kiralık Truss"/);
  const zemin = r.text.match(/<div class="hero-zemin"[\s\S]*?<\/div>/)[0];
  const fotolar = zemin.match(/<img /g) || [];
  assert.ok(fotolar.length >= 2 && fotolar.length <= 6, 'hero fotoğraf sayısı: ' + fotolar.length);
  assert.strictEqual((zemin.match(/class="aktif" src="\/gorsel\/\d+\?v=\d+"/g) || []).length, 1); // yalnız ilki sayfayla yüklenir
  assert.strictEqual((zemin.match(/data-src="\/gorsel\/\d+\?v=\d+"/g) || []).length, fotolar.length - 1);
  const logo = await request(app).get('/img/logo.png');
  assert.strictEqual(logo.status, 200);
});

test('site: ana sayfadaki sonsuz şerit açılıştaki işleri yinelemiyor; taslak kaldırıldı', async () => {
  const r = await request(app).get('/');
  assert.match(r.text, /<div class="serit" id="serit" data-oto="\d+">\s*<ul class="serit-ray">/);
  const serit = r.text.match(/<ul class="serit-ray">[\s\S]*?<\/ul>/)[0];
  const seritIdler = [...serit.matchAll(/href="\/calismalar\/(\d+)"/g)].map(m => m[1]);
  assert.ok(seritIdler.length >= 2, 'şeritteki kart sayısı: ' + seritIdler.length);
  const heroIdler = [...r.text.match(/<div class="hero-zemin"[\s\S]*?<\/div>/)[0].matchAll(/\/gorsel\/(\d+)/g)].map(m => m[1]);
  assert.ok(heroIdler.length >= 1);
  for (const id of heroIdler) assert.ok(!seritIdler.includes(id), 'açılıştaki iş şeritte yinelenmemeli: ' + id);
  assert.strictEqual(new Set(seritIdler).size, seritIdler.length, 'şeritte aynı iş iki kez');
  assert.strictEqual((await request(app).get('/taslak/serit')).status, 404);
});

test('site: sayfa başlıkları, çalışmalarda #suzgec çapası, iletişimde Google Maps', async () => {
  for (const yol of ['/calismalar', '/hakkimizda', '/iletisim']) {
    const r = await request(app).get(yol);
    assert.match(r.text, /<h1 class="sayfa-baslik" data-sayfa-baslik>/, yol + ' ortak başlık');
    assert.ok(!r.text.includes('#hesapla'), yol + ' hesaplayıcı bağlantısı yok');
  }
  const c = await request(app).get('/calismalar?tur=fuar&sayfa=1');
  assert.match(c.text, /<form class="suzgec" id="suzgec"[^>]*action="[^"]*\/calismalar#suzgec"/);
  for (const m of c.text.matchAll(/<a class="tur-levha" href="([^"]*)"/g)) assert.ok(m[1].endsWith('#suzgec'), 'tür levhası #suzgec: ' + m[1]);
  const i = await request(app).get('/iletisim');
  // Harita: eski sitedeki gömmenin aynısı (pin Beysan Sanayi Sitesi, 40.9936654 / 28.6865015); "yaklaşıktır" notu yok
  assert.match(i.text, /<iframe class="harita" src="https:\/\/www\.google\.com\/maps\/embed\?pb=[^"]*!2d28\.6865015!3d40\.9936654[^"]*Beysan/);
  assert.ok(!i.text.includes('yaklaşıktır'), 'yaklaşık konum notu kaldırıldı');
  assert.match(i.text, /query=40\.9936654,28\.6865015"/);
  assert.match(i.text, /https:\/\/www\.google\.com\/maps\/search\/\?api=1&amp;query=[\d.]+,[\d.]+" target="_blank" rel="noopener"/);
  assert.ok(!i.text.includes('openstreetmap'));
});

test('site: sayfalarda emoji ya da emojiye dönebilen ok karakteri yok (oklar SVG)', async () => {
  const p = await birProje();
  // Ok blokları (←→↗...), çeşitli semboller/dingbat ve emoji blokları, emoji seçici (U+FE0F)
  const yasak = /[←-⇿⌀-⏿☀-➿⬀-⯿️]|[\u{1F000}-\u{1FAFF}]/u;
  for (const yol of ['/', '/calismalar', '/calismalar?gorunum=liste', '/calismalar/' + p.id,
    '/hakkimizda', '/iletisim', '/teklif', '/teklif/tesekkurler', '/yok']) {
    const r = await request(app).get(yol);
    const m = r.text.match(yasak);
    assert.ok(!m, `${yol}: "${m && m[0]}" (U+${m && m[0].codePointAt(0).toString(16).toUpperCase()})`);
  }
});

test('site: çalışmalar süzgeci kapalı gelir, süzülünce açık gelir', async () => {
  const k = await request(app).get('/calismalar');
  assert.match(k.text, /<details class="suzgec-ac">/);
  const a = await request(app).get('/calismalar?tur=fuar');
  assert.match(a.text, /<details class="suzgec-ac" open>/);
  assert.match(a.text, /1 etkin/);
  assert.match(k.text, /<summary class="suzgec-dugme">\s*<span>Filtre<\/span>/);
  assert.match(a.text, /Filtreleri temizle/);
  assert.doesNotMatch(a.text, /Süzgeç|>Süz </);
});

test('site: Yönetim bağlantısı sitede yok, /yonetim rotası duruyor', async () => {
  for (const yol of ['/', '/calismalar', '/hakkimizda', '/iletisim', '/teklif']) {
    const r = await request(app).get(yol);
    assert.doesNotMatch(r.text, /href="\/yonetim/, yol);
  }
  const y = await request(app).get('/yonetim');
  assert.strictEqual(y.status, 302);
  assert.strictEqual(y.headers.location, '/yonetim/giris');
});

test('site: çalışma detayında tam boy bağlantısı ve dialog işaretlemesi var', async () => {
  const { rows } = await pool.query("SELECT id FROM projeler WHERE gorsel IS NOT NULL AND musteri <> '' LIMIT 1");
  if (!rows[0]) return;
  const id = rows[0].id;
  const r = await request(app).get('/calismalar/' + id);
  assert.strictEqual(r.status, 200);
  assert.match(r.text, new RegExp('<a class="foto-ac" href="/gorsel/' + id + '\\?v=\\d+"'));
  assert.match(r.text, /Fotoğrafı tam boy aç/);
  assert.match(r.text, /<dialog class="foto-kutu"/);
  assert.match(r.text, /class="foto-kapat"[^>]*aria-label="Fotoğrafı kapat"/);
  assert.doesNotMatch(r.text, /<a class="foto-ac"[^>]*>\s*<img[^>]*width=/);
});

test('site: Hakkımızda dönen fotoğrafı: 12 kare, Maschio Gaspardo aralarında, her karede bağlantı = fotoğraf, ileri/geri düğmeleri', async () => {
  const r = await request(app).get('/hakkimizda');
  assert.strictEqual(r.status, 200);
  assert.match(r.text, /<figure class="hakkinda-foto gosteri" data-gosteri/);
  const kareler = [...r.text.matchAll(/<a class="gosteri-kare[^"]*" href="\/calismalar\/(\d+)" data-isim="([^"]*)"[^>]*><img (src|data-src)="\/gorsel\/(\d+)\?boy=kucuk&amp;v=\d+"/g)];
  assert.strictEqual(kareler.length, 12);
  for (const k of kareler) assert.strictEqual(k[1], k[4]);
  assert.deepStrictEqual(kareler.map(k => k[3]), ['src', 'src', ...Array(10).fill('data-src')]); // ilk ikisi hemen, kalanı sırası gelince
  assert.strictEqual(new Set(kareler.map(k => k[2])).size, 12); // müşteri başına bir fotoğraf
  assert.ok(kareler.some(k => k[2] === 'Maschio Gaspardo'));
  assert.strictEqual((r.text.match(/class="gosteri-kare aktif"/g) || []).length, 1);
  assert.match(r.text, /aria-label="Önceki fotoğraf"/);
  assert.match(r.text, /aria-label="Sonraki fotoğraf"/);
  assert.match(r.text, /<span class="gosteri-sayac" aria-hidden="true">1 \/ 12<\/span>/);
  assert.match(r.text, /<script src="\/js\/gosteri\.js" defer><\/script>/);
  const g = await request(app).get('/gorsel/' + kareler[0][4]);
  assert.strictEqual(g.status, 200);
});

test('site: Hakkımızda gösterisinin sırası açılıştan açılışa değişir', async () => {
  const sira = async () => [...(await request(app).get('/hakkimizda')).text.matchAll(/gosteri-kare[^"]*" href="\/calismalar\/(\d+)"/g)].map(m => m[1]).join(',');
  const ilk = await sira();
  let farkli = false;
  for (let i = 0; i < 5 && !farkli; i++) farkli = (await sira()) !== ilk;
  assert.ok(farkli, '6 açılışta da aynı sıra geldi');
});

test('site: telefonda sabit mobil eylem çubuğu var, teklif sayfasında yalnız Ara görünür', async () => {
  for (const yol of ['/', '/calismalar', '/hakkimizda', '/iletisim']) {
    const r = await request(app).get(yol);
    const cubuk = r.text.match(/<nav class="mobil-eylem"[\s\S]*?<\/nav>/);
    assert.ok(cubuk, yol + ' mobil eylem çubuğu');
    assert.match(cubuk[0], /href="tel:/, yol + ' Ara bağlantısı');
    assert.match(cubuk[0], /href="\/teklif"/, yol + ' Teklif iste bağlantısı');
    assert.doesNotMatch(r.text, /class="alt-cubuk"/);
  }
  const t = await request(app).get('/teklif');
  const tCubuk = t.text.match(/<nav class="mobil-eylem"[\s\S]*?<\/nav>/);
  assert.ok(tCubuk, '/teklif mobil eylem çubuğu');
  assert.match(tCubuk[0], /href="tel:/, '/teklif Ara bağlantısı');
  assert.doesNotMatch(tCubuk[0], /href="\/teklif"/, '/teklif sayfasında Teklif iste gizli');
});

test('site: hero fotoğraf boyası beyaz yazıya WCAG AA kontrast bırakır, düz mavi katman yok', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'site.css'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'site.js'), 'utf8');
  const isik = css.match(/--hero-isik:\s*#([0-9a-f]{6})/i);
  assert.ok(isik, '--hero-isik tanımlı');
  // Fotoğrafın en açık noktası --hero-isik olur (gri ton × renk): bağıl parlaklığı beyaz yazıya en az 4,5:1 bırakmalı
  const kanal = (i) => { const v = parseInt(isik[1].slice(i, i + 2), 16) / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * kanal(0) + 0.7152 * kanal(2) + 0.0722 * kanal(4);
  const kontrast = 1.05 / (L + 0.05);
  assert.ok(kontrast >= 4.5, 'beyaz yazı kontrastı ' + kontrast.toFixed(2));
  // Hero'daki küçük yazılar beyaz (açık mavi bu zeminde 4,5:1'in altında kalır)
  for (const s of ['.hero .etiket', '.hero-ara', '.hero-kunye']) {
    const kural = css.split('\n').find(l => l.startsWith(s + ' {'));
    assert.ok(kural && /color: var\(--beyaz\)/.test(kural), s + ' beyaz');
  }
  // Tuval yolu aynı renkleri kullanır; eski %45 düz mavi katman kalktı
  assert.match(js, /--hero-isik/);
  assert.match(js, /globalCompositeOperation = 'lighten'/);
  assert.ok(!/globalAlpha = 0\.45/.test(js), 'düz mavi katman yok');
  assert.ok(!/\.hero-zemin img\.aktif \{ opacity: \.55/.test(css));
});

// ---------- Kullanıcı testi düzeltmeleri (K1–K6) ----------

function gecerliForm(ad, uzat = {}) {
  return {
    ad_soyad: ETIKET + ' ' + ad, telefon: '0532 123 45 67', eposta: 'test@example.com', etkinlik_turu: 'Fuar standı',
    sehir: 'Ankara', tarih: yarin(), gun_sayisi: '2', kvkk: 'on', ...uzat,
  };
}
const gonder = (xff, form) => request(app).post('/teklif').set('X-Forwarded-For', xff).type('form').send(form);

test('K1 hız sınırı: doğrulama hataları (422) sayaca girmez; 6. başarılı gönderim 429 ve mesajda dakika + telefon var', async () => {
  const ip = '203.0.113.11';
  for (let i = 0; i < 5; i++) assert.strictEqual((await gonder(ip, { sehir: 'İzmir' })).status, 422, 'hatalı gönderim ' + i);
  for (let i = 0; i < 5; i++) assert.strictEqual((await gonder(ip, gecerliForm('K1-' + i))).status, 302, 'başarılı gönderim ' + i);
  const r = await gonder(ip, gecerliForm('K1-6', { telefon: '0500 000 00 05', sehir: 'Konya' }));
  assert.strictEqual(r.status, 429);
  assert.match(r.text, /Çok fazla teklif gönderildi\. Yaklaşık (\d+) dakika sonra tekrar deneyebilir ya da bizi hemen arayabilirsiniz:/);
  const dk = Number(r.text.match(/Yaklaşık (\d+) dakika/)[1]);
  assert.ok(dk >= 1 && dk <= 15, 'kalan süre 1–15 dk: ' + dk);
  assert.match(r.text, /<p class="alan-hata genel-hata" id="genel-hata" tabindex="-1">[\s\S]*?<a class="satir-tel" href="tel:\+902122229695">/);
  assert.match(r.text, /name="sehir" value="Konya"/, 'girdiler korunur');
  assert.match(r.text, /name="telefon" value="0500 000 00 05"/);
  assert.ok(r.headers['ratelimit'] || r.headers['ratelimit-policy'], 'standart hız sınırı başlıkları var');
});

const gonderCf = (cf, xff, form) => {
  const r = request(app).post('/teklif').set('CF-Connecting-IP', cf);
  return (xff ? r.set('X-Forwarded-For', xff) : r).type('form').send(form);
};

test('R1 sayaç anahtarı: farklı CF-Connecting-IP ayrı sayaçta; aynı CF-Connecting-IP sahte X-Forwarded-For ile bölünmez', async () => {
  const a = '203.0.113.21', b = '203.0.113.22';
  // Zincir: istemci → Cloudflare (CF-Connecting-IP'yi yazar) → Render (xff'ye Cloudflare uç adresini ekler; her istekte değişir)
  for (let i = 0; i < 5; i++) assert.strictEqual((await gonderCf(a, `10.0.${i}.1, 172.69.${i}.9`, gecerliForm('R1a-' + i))).status, 302);
  assert.strictEqual((await gonderCf(a, '198.51.100.7, 104.16.77.3', gecerliForm('R1a-6'))).status, 429, 'aynı CF adresi, başka sahte xff: yine sınırda');
  assert.strictEqual((await gonderCf(a, null, gecerliForm('R1a-7'))).status, 429, 'xff hiç yok: yine aynı sayaç');
  // Başka bir CF adresi (başka istemci) etkilenmez
  assert.strictEqual((await gonderCf(b, '172.69.0.1', gecerliForm('R1b'))).status, 302);
  // Geçersiz CF başlığı yok sayılır (req.ip'ye düşer); 429 alan istemciyi etkilemez
  assert.strictEqual((await gonderCf('bu-bir-ip-degil', '203.0.113.23', gecerliForm('R1c'))).status, 302);
});

test('K3 doğrulama hatasında girdiler olduğu gibi geri basılır (telefon sadeleştirilmez)', async () => {
  const r = await gonder('203.0.113.31', gecerliForm('K3', { telefon: '0500 000 00 05', eposta: 'Büyük@Örnek', ad_soyad: '  Ali Veli  ' }));
  assert.strictEqual(r.status, 422);
  assert.match(r.text, /id="telefon" type="tel" name="telefon" value="0500 000 00 05"/);
  assert.match(r.text, /name="ad_soyad" value="Ali Veli"/);
  assert.match(r.text, /id="eposta-hata"/);
  // E-posta küçültülmeden yazıldığı gibi (geçerli ama başka alan hatalı)
  const r2 = await gonder('203.0.113.31', gecerliForm('K3b', { eposta: 'Test@EXAMPLE.com', sehir: '' }));
  assert.strictEqual(r2.status, 422);
  assert.match(r2.text, /name="eposta" value="Test@EXAMPLE.com"/);
  // Boşluktan ibaret telefon hata verir
  const r3 = await gonder('203.0.113.31', gecerliForm('K3c', { telefon: '   ' }));
  assert.strictEqual(r3.status, 422);
  assert.match(r3.text, /id="telefon-hata"/);
  // DB'ye yine sadeleşmiş değer yazılır
  const ok = await gonder('203.0.113.32', gecerliForm('K3d', { telefon: '0500 000 00 05' }));
  assert.strictEqual(ok.status, 302);
  const { rows } = await pool.query('SELECT telefon FROM teklifler WHERE ad_soyad = $1', [ETIKET + ' K3d']);
  assert.strictEqual(rows[0].telefon, '05000000005');
});

test('K4 telefon alanında pattern + title, sunucu kuralıyla aynı karar; Kaç gün? sayısal klavye; son alan "send"', async () => {
  const r = await request(app).get('/teklif');
  const tel = r.text.match(/<input id="telefon"[^>]*>/)[0];
  assert.match(tel, /pattern="[^"]+"/);
  assert.match(tel, /title="Geçerli bir telefon numarası girin/);
  assert.match(tel, /inputmode="tel"/);
  assert.match(r.text, /<input id="gun_sayisi"[^>]*inputmode="numeric"/);
  assert.match(r.text, /<input id="eposta"[^>]*enterkeyhint="send"/);
  assert.match(r.text, /<input id="ad_soyad"[^>]*enterkeyhint="next"/);
  // HTML pattern'i (v bayrağı, tüm değere uygulanır) sunucudaki kuralla aynı sonucu vermeli
  const { TELEFON_DESENI, TELEFON_HTML_DESENI } = require('../validators');
  const html = new RegExp('^(?:' + TELEFON_HTML_DESENI + ')$', 'v');
  const ayikla = (v) => v.trim().replace(/[\s()-]/g, '');
  for (const v of ['0532 123 45 67', '05321234567', '5321234567', '+90 532 123 45 67', '+905321234567', '0 (532) 123-45-67',
    '(0212) 222 96 95', '0212 222 96 95', '0500 000 00 05', '532-123-4567', ' 0532 123 45 67 ',
    '0632 123 45 67', '053212345', '053212345678', 'abc', '0532 123 45 6a', '+91 532 123 45 67', '90 532 123 45 67', '', '++905321234567']) {
    assert.strictEqual(html.test(v.trim()), TELEFON_DESENI.test(ayikla(v)), `"${v}"`);
  }
});

test('K5 ?ref ile etkinlik türü ve şehir projeden ön seçilir; adreste verilen değer önceliklidir', async () => {
  const p = (await pool.query(`SELECT id, sehir FROM projeler WHERE tur = 'fuar' AND sehir IS NOT NULL AND sehir <> '' ORDER BY id LIMIT 1`)).rows[0];
  assert.ok(p, 'şehri olan fuar projesi var');
  const r = await request(app).get('/teklif?ref=' + p.id);
  assert.match(r.text, /<option selected>Fuar standı<\/option>/);
  assert.ok(r.text.includes(`name="sehir" value="${p.sehir}"`), 'şehir projeden');
  assert.match(r.text, /<textarea[^>]*>Örnek gösterdiğim iş: /);
  const o = await request(app).get(`/teklif?ref=${p.id}&etkinlik_turu=${encodeURIComponent('Konser / sahne')}&sehir=Mersin`);
  assert.match(o.text, /<option selected>Konser \/ sahne<\/option>/);
  assert.match(o.text, /name="sehir" value="Mersin"/);
  // Eşleşmeyen tür boş bırakılır
  const e = (await pool.query(`SELECT id FROM projeler WHERE tur <> 'fuar' ORDER BY id LIMIT 1`)).rows[0];
  if (e) assert.doesNotMatch((await request(app).get('/teklif?ref=' + e.id)).text, /<option selected>/);
});

test('K6 teşekkür sayfası: dönüş süresi, talep özeti (oturumdan, bir kez), acil telefon; başlık görünür; adreste kişisel veri yok', async () => {
  const ajan = request.agent(app);
  const form = gecerliForm('K6', { sehir: 'Eskişehir' });
  const r = await ajan.post('/teklif').set('X-Forwarded-For', '203.0.113.61').type('form').send(form);
  assert.strictEqual(r.status, 302);
  assert.strictEqual(r.headers.location, '/teklif/tesekkurler', 'adreste hiçbir bilgi yok');
  const t = await ajan.get('/teklif/tesekkurler');
  assert.match(t.text, /En geç 1 iş günü içinde sizi arayacağız\./);
  assert.match(t.text, /<dt>Etkinlik<\/dt><dd>Fuar standı<\/dd>/);
  assert.match(t.text, /<dt>Şehir<\/dt><dd>Eskişehir<\/dd>/);
  const gun = new Date(form.tarih + 'T00:00:00Z').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  assert.ok(t.text.includes(`<dd>${gun}</dd>`), 'tarih: ' + gun);
  assert.match(t.text, /Acil mi\? Hemen arayın: <a class="satir-tel" href="tel:\+902122229695">/);
  assert.ok(!t.text.includes(ETIKET) && !t.text.includes('0532') && !t.text.includes('test@example.com'), 'kişisel veri yok');
  assert.doesNotMatch(t.text, /<h1[^>]*class="[^"]*yukselen/, 'başlık maskeyle gizlenmez');
  assert.match(t.text, /<h1 class="tesekkur-baslik">İsteğiniz bize ulaştı\.<\/h1>/);
  // Özet bir kez gösterilir; doğrudan açılışta özet olmaz ama söz yine var
  const yine = await ajan.get('/teklif/tesekkurler');
  assert.doesNotMatch(yine.text, /tesekkur-ozet/);
  assert.match(yine.text, /En geç 1 iş günü içinde/);
  // Animasyon yalnız hareket tercihi yokken
  const css = require('fs').readFileSync(require('path').join(__dirname, '..', 'public', 'css', 'site.css'), 'utf8');
  assert.match(css, /prefers-reduced-motion: no-preference\) \{ \.tesekkur-baslik \{ animation/);
  assert.ok(!/\.tesekkur-baslik[^{]*\{[^}]*opacity: 0/.test(css), 'başlık opaklıkla gizlenmez');
});
