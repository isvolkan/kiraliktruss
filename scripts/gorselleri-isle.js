// Mevcut tüm proje fotoğraflarını bir kez işler: tam boy (≤1600 px WebP) ve küçük boy (≤600 px WebP) yazar.
// Kullanım:  npm run gorseller -- --kuru   (hiçbir şey yazmaz, yalnız önce/sonra bayt raporu verir)
//            npm run gorseller             (gerçekten yazar; ORİJİNALİN ÜSTÜNE yazar, önce yedek alın)
// Betik bağlandığı veritabanını DATABASE_URL'den okur (.env); canlı veritabanında dikkatli kullanın.
require('dotenv').config();
const pool = require('../db/pool');
const { hazirla } = require('../lib/gorsel');
const gocCalistir = require('../db/goc');

const kuru = process.argv.includes('--kuru');
const mb = (b) => (b / 1024 / 1024).toFixed(2) + ' MB';
const kb = (b) => Math.round(b / 1024) + ' KB';

async function main() {
  await gocCalistir(); // gorsel_kucuk sütunu yoksa eklenir
  const { rows } = await pool.query('SELECT id FROM projeler WHERE gorsel IS NOT NULL ORDER BY id');
  let once = 0, sonraTam = 0, sonraKucuk = 0, hata = 0;

  for (const { id } of rows) {
    const { rows: [r] } = await pool.query('SELECT gorsel FROM projeler WHERE id = $1', [id]);
    once += r.gorsel.length;
    try {
      const { tam, kucuk, tur } = await hazirla(r.gorsel);
      sonraTam += tam.length;
      sonraKucuk += kucuk.length;
      if (!kuru) {
        await pool.query(
          'UPDATE projeler SET gorsel = $1, gorsel_tip = $2, gorsel_kucuk = $3, guncelleme = now() WHERE id = $4',
          [tam, tur, kucuk, id]);
      }
    } catch (err) {
      hata++;
      sonraTam += r.gorsel.length; // işlenemeyen kayıt olduğu gibi kalır
      console.error(`Proje ${id} işlenemedi:`, err.message);
    }
  }

  const n = rows.length || 1;
  console.log(kuru ? '[KURU ÇALIŞTIRMA: veritabanına yazılmadı]' : 'Veritabanına yazıldı.');
  console.log(`Fotoğraf sayısı: ${rows.length} (hata: ${hata})`);
  console.log(`Önce  (tam, toplam): ${mb(once)}  ortalama ${kb(once / n)}`);
  console.log(`Sonra (tam, toplam): ${mb(sonraTam)}  ortalama ${kb(sonraTam / n)}`);
  console.log(`Sonra (küçük, toplam): ${mb(sonraKucuk)}  ortalama ${kb(sonraKucuk / n)}`);
  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
