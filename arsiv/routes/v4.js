// Dördüncü sürüm (v4): aynı rotalar ve veritabanı, yeni ziyaretçi arayüzü (views/v4, public/v4).
// Burada yalnız v4'e özgü iki ek var: projeyi teklife referans olarak taşıma ve rehbere ekleme (vCard).
const express = require('express');
const pool = require('../db/pool');
const firma = require('../config/firma');
const { ETKINLIK_TURLERI } = require('../validators');

const v4 = express.Router();

v4.use((req, res, next) => {
  const ciz = res.render.bind(res);
  res.render = (gorunum, ...geri) => ciz('v4/' + gorunum, ...geri); // görünümler views/v4 altından
  res.locals.kok = '/v4';    // tüm iç bağlantıların öneki
  res.locals.yol = req.path; // etkin menü öğesi için
  // Tarih alanının en küçük değeri (bugün, yerel saat) ve tür adlarının Türkçesi tüm görünümlerde lazım
  const bugun = new Date();
  res.locals.bugun = new Date(bugun.getTime() - bugun.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  res.locals.turAdi = { fuar: 'Fuar', etkinlik: 'Etkinlik', kurumsal: 'Kurumsal' };
  next();
});

// Teklif formu: site.js'teki GET ile aynı, ek olarak ?ref=<proje id> gelirse mesaj kutusu o projeyle dolu açılır.
// ("Buna benzer bir kurulum istiyorum" düğmesi proje sayfasından buraya gelir.)
v4.get('/teklif', async (req, res) => {
  const metretul = parseInt(req.query.metretul, 10);
  const deger = { metretul: metretul > 0 && metretul <= 5000 ? metretul : '', gun_sayisi: 1, kurulum: 'on' };
  const ref = parseInt(req.query.ref, 10);
  let referans = null;
  if (ref > 0) {
    const { rows } = await pool.query('SELECT id, musteri, etkinlik, yil FROM projeler WHERE id = $1', [ref]);
    referans = rows[0] || null;
    if (referans) {
      const ad = [referans.musteri, referans.etkinlik, referans.yil].filter(Boolean).join(' · ');
      deger.mesaj = `Örnek çalışmalarınızdaki "${ad}" projesine benzer bir kurulum düşünüyoruz.`;
    }
  }
  res.render('teklif', { baslik: 'Teklif iste', turler: ETKINLIK_TURLERI, hatalar: {}, deger, referans });
});

// Rehbere ekle: firma bilgilerinden vCard dosyası (telefona tek dokunuşla kaydedilir)
v4.get('/kartvizit.vcf', (req, res) => {
  const satirlar = [
    'BEGIN:VCARD', 'VERSION:3.0',
    `FN:${firma.ad}`, `ORG:${firma.ad}`,
    `TEL;TYPE=WORK,VOICE:${firma.telefon}`,
    `TEL;TYPE=WORK,FAX:${firma.faks}`,
    `EMAIL;TYPE=WORK:${firma.eposta}`,
    `ADR;TYPE=WORK:;;${firma.adres};${firma.ilce};;;Türkiye`,
    'URL:https://www.kiraliktruss.com/',
    'END:VCARD',
  ];
  res.set('Content-Type', 'text/vcard; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename="kiralik-truss.vcf"');
  res.send(satirlar.join('\r\n'));
});

v4.use(require('./site')); // aynı rotalar ve veritabanı
v4.use((req, res) => res.status(404).render('404', { baslik: 'Sayfa bulunamadı' }));
v4.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).render('hata', { baslik: 'Bir sorun oluştu' });
});

module.exports = v4;
