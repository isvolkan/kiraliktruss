// Eski sitedeki proje başlıklarını ("Ermaksan - Konya Metal 2017") alanlara ayırır.
// Başlıkla dosya adı çeliştiğinde düzeltmeler aşağıdaki DUZELTMELER tablosunda; hepsi veri/duzeltmeler.md'de listeli.

const SEHIRLER = ['İstanbul', 'Uludağ', 'Çukurova', 'Bursa', 'Çorlu', 'İzmir', 'Konya', 'Adana', 'Türkmenistan'];

// Başlıkta yılı eksik ya da yanlış olanlar (dosya adındaki yıla göre)
const DUZELTMELER = {
  'Askaynak - Win Metal 20107': { yil: 2017 },
  'Gaspardo - İzmir': { yil: 2016, etkinlik: 'İzmir Tarım Fuarı' },
};

function turBul(metin) {
  if (/Etkinlik|Teknofest|Toplant|Yayın|Tatbikat|Caddesi|Roadshow|Boadshow|Bayim/i.test(metin)) return 'etkinlik';
  if (/Hospital|Konsolosluğu|Enerji/i.test(metin)) return 'kurumsal';
  return 'fuar';
}

function basliktanProje(baslik) {
  const d = DUZELTMELER[baslik] || {};
  const [musteri, ...kalan] = baslik.split(' - ');
  let geri = kalan.join(' - ').replace('&', ' ').replace(/\s+/g, ' ').trim();
  const yilEsles = geri.match(/(19|20)\d{2,3}\s*$/);
  let yil = yilEsles ? parseInt(yilEsles[0], 10) : null;
  if (yil && (yil < 2000 || yil > 2100)) yil = null;
  geri = geri.replace(/(19|20)\d{2,3}\s*$/, '').trim();
  const sehir = SEHIRLER.find(s => geri.includes(s)) || null;
  return {
    musteri: musteri.trim(),
    etkinlik: d.etkinlik || geri || '', // başlıkta etkinlik adı yoksa boş bırakılır (uydurulmaz)
    sehir,
    yil: d.yil || yil,
    tur: turBul(baslik),
    aciklama: null,
  };
}

module.exports = { basliktanProje, turBul };
