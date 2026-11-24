// İşlem günlüğü testleri: kayıt üretimi (durum, okundu, giriş, silme), kişisel veri, kaydet'in hata vermemesi, pano / liste sayfaları.
// Çalıştırma: npm test   (yerel veritabanı çalışıyor ve göçler uygulanmış olmalı)
require('dotenv').config();
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const bcrypt = require('bcryptjs');
const request = require('supertest');
const app = require('../app');
const pool = require('../db/pool');
const kayit = require('../lib/kayit');
const izle = require('./kayit-temizle');

const ETIKET = 'TEST-gunluk-' + Date.now();
const EPOSTA = `${ETIKET.toLowerCase()}@gunluk-test.invalid`; // testin geçici yöneticisi
const SIFRE = 'gecici-sifre-4321';
const FOTO = path.join(__dirname, '..', 'veri', 'eski-gorseller', '1543314354_ari-makina-foteg-2013.jpg');
let temizle;
let yonId;

before(async () => {
  temizle = await izle(pool);
  const ozet = await bcrypt.hash(SIFRE, 4);
  yonId = (await pool.query('INSERT INTO kullanicilar (eposta, sifre_hash) VALUES ($1, $2) RETURNING id', [EPOSTA, ozet])).rows[0].id;
});

after(async () => {
  await temizle();
  await pool.query('DELETE FROM teklifler WHERE ad_soyad LIKE $1', [ETIKET + '%']);
  await pool.query('DELETE FROM projeler WHERE musteri LIKE $1', [ETIKET + '%']);
  await pool.query('DELETE FROM kullanicilar WHERE id = $1', [yonId]);
  await pool.query(`DELETE FROM oturumlar WHERE sess->'kullanici'->>'eposta' = $1`, [EPOSTA]);
  await pool.end();
});

const jetonu = (html) => html.match(/name="_csrf" value="([0-9a-f]{64})"/)[1];
// Günlükten kayıt okur: kosul içinde $1 değer parametresidir
const kayitlar = async (kosul, deger) => (await pool.query(`SELECT * FROM islem_kayitlari WHERE ${kosul} ORDER BY id`, [deger])).rows;

// Geçici yönetici ile giriş (giriş hız sınırı 15 dakikada 10 deneme: bu dosyada birkaç giriş var)
let oturum;
async function yonetici() {
  if (oturum) return oturum;
  const ajan = request.agent(app);
  const sayfa = await ajan.get('/yonetim/giris');
  const r = await ajan.post('/yonetim/giris').type('form').send({ _csrf: jetonu(sayfa.text), eposta: EPOSTA, sifre: SIFRE });
  assert.strictEqual(r.status, 302);
  const pano = await ajan.get('/yonetim');
  oturum = { ajan, jeton: jetonu(pano.text), pano };
  return oturum;
}

async function teklifEkle(ek) {
  const { rows } = await pool.query(
    `INSERT INTO teklifler (ad_soyad, telefon, eposta, etkinlik_turu, sehir, tarih, kvkk_onay)
     VALUES ($1, '05329998877', 'gizli-ziyaretci@ornek.com', 'Fuar standı', 'İzmir', now() + interval '7 days', true) RETURNING id`,
    [ETIKET + ek]);
  return rows[0].id;
}

test('kayıt: giriş kaydı yazılır (kullanıcı bağlı), başarısız girişte e-posta maskelenir, şifre yazılmaz', async () => {
  await yonetici();
  const g = await kayitlar('tur = $1 AND kullanici_id = ' + yonId, 'giris');
  assert.strictEqual(g.length, 1);

  const ajan = request.agent(app);
  const sayfa = await ajan.get('/yonetim/giris');
  const yanlis = 'yanlis-parola-GIZLI-77';
  const r = await ajan.post('/yonetim/giris').type('form')
    .send({ _csrf: jetonu(sayfa.text), eposta: 'kemal.' + ETIKET + '@gunluk-test.invalid', sifre: yanlis });
  assert.strictEqual(r.status, 401);
  const b = await kayitlar(`tur = $1 AND mesaj LIKE '%gunluk-test.invalid%'`, 'giris_basarisiz');
  assert.strictEqual(b.length, 1);
  assert.match(b[0].mesaj, /^k\*\*\*@gunluk-test\.invalid/);
  assert.ok(!b[0].mesaj.includes('emal'), 'e-postanın tamamı yazılmamalı');
  assert.ok(!b[0].mesaj.includes(yanlis) && !b[0].mesaj.includes('GIZLI'), 'şifre günlüğe girmemeli');
  assert.strictEqual(b[0].kullanici_id, null);
});

test('kayıt: e-posta maskeleme ve göreli zaman yazımı', () => {
  assert.strictEqual(kayit.epostaMaskele('kemal@admin.com'), 'k***@admin.com');
  assert.strictEqual(kayit.epostaMaskele('x'), 'x***');
  assert.strictEqual(kayit.epostaMaskele(''), '(boş)');
  const simdi = Date.now();
  assert.strictEqual(kayit.goreli(simdi - 5 * 1000, simdi), 'az önce');
  assert.strictEqual(kayit.goreli(simdi - 3 * 60 * 1000, simdi), '3 dk önce');
  assert.strictEqual(kayit.goreli(simdi - 2 * 3600 * 1000, simdi), '2 sa önce');
  assert.strictEqual(kayit.goreli(simdi - 30 * 3600 * 1000, simdi), 'dün');
  assert.strictEqual(kayit.goreli(simdi - 5 * 86400 * 1000, simdi), '5 gün önce');
});

test('kayıt: kaydet hata fırlatmaz (veritabanı hatası, bilinmeyen tür, boş çağrı)', async () => {
  const eskiLog = console.error;
  console.error = () => {}; // beklenen hata mesajı test çıktısını kirletmesin
  try {
    assert.strictEqual(await kayit.kaydet({ tur: 'giris', mesaj: 'x', teklif_id: 2147483000 }), false, 'var olmayan teklife bağlı kayıt (FK hatası)');
    assert.strictEqual(await kayit.kaydet({ tur: 'uydurma', mesaj: 'x' }), false);
    assert.strictEqual(await kayit.kaydet(), false);
  } finally { console.error = eskiLog; }
  assert.strictEqual(await kayit.kaydet({ tur: 'giris', mesaj: ETIKET + ' deneme' }), true);
  assert.strictEqual((await kayitlar('mesaj = $1', ETIKET + ' deneme')).length, 1);
});

test('kayıt: teklif açılınca bir kez "okundu", durum değişince "eski → yeni", aynı durumda kayıt yok, silinince ona ait kayıtlar silinir, silme kaydı adsızdır', async () => {
  const { ajan, jeton } = await yonetici();
  const id = await teklifEkle(' Ali Veli');

  await ajan.get('/yonetim/teklifler/' + id).expect(200);
  await ajan.get('/yonetim/teklifler/' + id).expect(200); // ikinci açılış kayıt üretmez
  const okundu = await kayitlar(`teklif_id = $1 AND tur = 'teklif_okundu'`, id);
  assert.strictEqual(okundu.length, 1);
  assert.strictEqual(okundu[0].kullanici_id, yonId);

  const gonder = (durum, not = '') => ajan.post('/yonetim/teklifler/' + id).type('form').send({ _csrf: jeton, durum, yonetici_notu: not }).expect(302);
  await gonder('arandi');
  const d1 = await kayitlar(`teklif_id = $1 AND tur = 'teklif_durum'`, id);
  assert.strictEqual(d1.length, 1);
  assert.match(d1[0].mesaj, /Yeni → Arandı/);
  assert.match(d1[0].mesaj, new RegExp(ETIKET + ' Ali Veli'));

  await gonder('arandi'); // aynı durum: yeni kayıt yok
  assert.strictEqual((await kayitlar(`teklif_id = $1 AND tur = 'teklif_durum'`, id)).length, 1);
  assert.strictEqual((await kayitlar(`teklif_id = $1 AND tur = 'teklif_not'`, id)).length, 0);

  await gonder('teklif_verildi', 'Gizli not metni: 0532 111 22 33'); // durum + not değişti
  const d2 = await kayitlar(`teklif_id = $1 AND tur = 'teklif_durum'`, id);
  assert.strictEqual(d2.length, 2);
  assert.match(d2[1].mesaj, /Arandı → Teklif verildi/);
  assert.strictEqual((await kayitlar(`teklif_id = $1 AND tur = 'teklif_not'`, id)).length, 1);

  // Kişisel veri: ziyaretçinin telefonu / e-postası ve not metni günlükte yok
  const hepsi = (await kayitlar('teklif_id = $1', id)).map((k) => k.mesaj).join('\n');
  assert.doesNotMatch(hepsi, /05329998877|gizli-ziyaretci|Gizli not metni|0532/);

  // Ayrıntı sayfasında geçmiş çizelgesi
  const sayfa = await ajan.get('/yonetim/teklifler/' + id);
  assert.match(sayfa.text, /id="gecmis-baslik"/);
  assert.match(sayfa.text, /Arandı → Teklif verildi/);

  // KVKK: silinince o teklife ait tüm günlük satırları da silinir; silme kaydı adsızdır
  const once = (await pool.query('SELECT count(*)::int AS n FROM islem_kayitlari WHERE teklif_id = $1', [id])).rows[0].n;
  assert.ok(once >= 4, 'silmeden önce kayıtlar vardı: ' + once);
  await ajan.post(`/yonetim/teklifler/${id}/sil`).type('form').send({ _csrf: jeton }).expect(302);
  assert.strictEqual((await pool.query('SELECT count(*)::int AS n FROM islem_kayitlari WHERE teklif_id = $1', [id])).rows[0].n, 0, 'o teklif_id ile kayıt kalmamalı');
  assert.strictEqual((await pool.query('SELECT count(*)::int AS n FROM islem_kayitlari WHERE mesaj LIKE $1', [`%${ETIKET} Ali Veli%`])).rows[0].n, 0, 'günlükte ad kalmamalı');
  const silme = (await pool.query("SELECT mesaj FROM islem_kayitlari WHERE tur = 'teklif_silindi' AND mesaj = $1", [`Teklif No. ${id} silindi`])).rows;
  assert.strictEqual(silme.length, 1, 'adsız silme kaydı yazılmalı');
});

test('kayıt: proje eklenince / güncellenince / silinince kayıt yazılır; proje silinse de kayıt kalır', async () => {
  const { ajan, jeton } = await yonetici();
  await ajan.post('/yonetim/projeler').field('_csrf', jeton).field('musteri', ETIKET + ' Firma').field('etkinlik', 'Günlük Fuarı')
    .field('yil', '2026').field('tur', 'fuar').attach('gorsel', FOTO).expect(302);
  const { id } = (await pool.query('SELECT id FROM projeler WHERE musteri = $1', [ETIKET + ' Firma'])).rows[0];
  const ek = await kayitlar(`proje_id = $1 AND tur = 'proje_eklendi'`, id);
  assert.strictEqual(ek.length, 1);
  assert.match(ek[0].mesaj, /Günlük Fuarı/);

  await ajan.post('/yonetim/projeler/' + id).field('_csrf', jeton).field('musteri', ETIKET + ' Firma').field('etkinlik', 'Yeni Ad').field('tur', 'fuar').expect(302);
  assert.strictEqual((await kayitlar(`proje_id = $1 AND tur = 'proje_guncellendi'`, id)).length, 1);

  await ajan.post(`/yonetim/projeler/${id}/sil`).type('form').send({ _csrf: jeton }).expect(302);
  assert.strictEqual((await pool.query('SELECT 1 FROM projeler WHERE id = $1', [id])).rowCount, 0);
  const kalan = (await pool.query('SELECT tur, proje_id FROM islem_kayitlari WHERE mesaj LIKE $1 ORDER BY id', [`%${ETIKET} Firma%`])).rows;
  assert.deepStrictEqual(kalan.map((k) => k.tur), ['proje_eklendi', 'proje_guncellendi', 'proje_silindi']);
  assert.ok(kalan.every((k) => k.proje_id === null), 'silinen projeye bağlantı kalmamalı, kayıt kalmalı');
});

test('günlük sayfaları: pano akışı ve /yonetim/islemler 200, girişsiz yönlenir, tür süzgeci çalışır, menüde aria-current', async () => {
  for (const yol of ['/yonetim/islemler', '/yonetim/islemler?tur=giris']) {
    const r = await request(app).get(yol);
    assert.strictEqual(r.status, 302, yol);
    assert.strictEqual(r.headers.location, '/yonetim/giris');
  }
  const { ajan, pano } = await yonetici();
  assert.match(pano.text, /id="islem-baslik"/);
  assert.match(pano.text, /Son işlemler/);
  assert.match(pano.text, /okunmamış teklif/, 'mevcut özet kutuları yerinde');

  const tum = await ajan.get('/yonetim/islemler');
  assert.strictEqual(tum.status, 200);
  assert.strictEqual((tum.text.match(/<h1[\s>]/g) || []).length, 1);
  assert.match(tum.text, /<a href="\/yonetim\/islemler" aria-current="page">/);
  assert.match(tum.text, /Başarısız giriş/);

  // Süzgeç: yalnız seçilen türde satır (açılır listedeki <option> etiketleri hariç tutulur)
  const suz = await ajan.get('/yonetim/islemler?tur=giris_basarisiz');
  const govde = suz.text.replace(/<form[\s\S]*?<\/form>/, '');
  assert.match(govde, /<b>Başarısız giriş<\/b>/);
  assert.doesNotMatch(govde, /<b>Giriş<\/b>|<b>Teklif silindi<\/b>/);
  const sonuc = await kayit.liste({ tur: 'giris_basarisiz' });
  assert.ok(sonuc.satirlar.length > 0 && sonuc.satirlar.every((k) => k.tur === 'giris_basarisiz'));
  assert.strictEqual(sonuc.toplam, (await pool.query(`SELECT count(*)::int AS n FROM islem_kayitlari WHERE tur = 'giris_basarisiz'`)).rows[0].n);

  // Geçersiz tür yok sayılır, taşan sayfa ve dizi parametre 500 vermez
  await ajan.get('/yonetim/islemler?tur=uydurma&sayfa=999').expect(200);
  await ajan.get('/yonetim/islemler?tur=a&tur=b&sayfa=x').expect(200);
});

test('günlük: son(n) en yeniyi başa koyar, sayfalama çalışır', async () => {
  await kayit.kaydet({ tur: 'cikis', mesaj: ETIKET + ' ilk' });
  await kayit.kaydet({ tur: 'cikis', mesaj: ETIKET + ' ikinci' });
  const s = await kayit.son(1);
  assert.strictEqual(s[0].mesaj, ETIKET + ' ikinci');
  const l = await kayit.liste({ tur: 'cikis', sayfa: 2, sayfaBoyu: 1 });
  assert.strictEqual(l.sayfa, 2);
  assert.strictEqual(l.satirlar.length, 1);
  assert.ok(l.sayfaSayisi >= 2);
});

test('günlük: şifre değişikliği ve çıkış kaydedilir (şifre yazılmaz)', async () => {
  const ajan = request.agent(app);
  const sayfa = await ajan.get('/yonetim/giris');
  await ajan.post('/yonetim/giris').type('form').send({ _csrf: jetonu(sayfa.text), eposta: EPOSTA, sifre: SIFRE }).expect(302);
  const yeni = 'baska-yeni-sifre-9876';
  const jeton = jetonu((await ajan.get('/yonetim/hesap')).text);
  await ajan.post('/yonetim/hesap/sifre').type('form').send({ _csrf: jeton, mevcut: SIFRE, yeni, yeni_tekrar: yeni }).expect(302);
  const s = await kayitlar('tur = $1 AND kullanici_id = ' + yonId, 'sifre_degisti');
  assert.strictEqual(s.length, 1);
  assert.ok(!s[0].mesaj.includes(yeni) && !s[0].mesaj.includes(SIFRE));

  // Şifre değişince oturum kimliği yenilenir; çıkış jetonu yeni sayfadan alınır
  const jeton2 = jetonu((await ajan.get('/yonetim/hesap')).text);
  await ajan.post('/yonetim/cikis').type('form').send({ _csrf: jeton2 }).expect(302);
  assert.strictEqual((await kayitlar('tur = $1 AND kullanici_id = ' + yonId, 'cikis')).length, 1);
});
