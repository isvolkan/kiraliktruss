// Tabloları oluşturur, yönetici hesabını açar ve eski siteden alınan 96 projeyi içeri aktarır.
// Kullanım: npm run seed   (tekrar çalıştırmak güvenli: proje tablosu boşsa doldurur)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('./pool');
const { basliktanProje } = require('./baslik');

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('Tablolar hazır.');

  // Yönetici hesabı: e-posta ve parola .env'den okunur, parola bcrypt ile saklanır.
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await pool.query(
      `INSERT INTO kullanicilar (eposta, sifre_hash) VALUES ($1, $2)
       ON CONFLICT (eposta) DO UPDATE SET sifre_hash = EXCLUDED.sifre_hash`,
      [ADMIN_EMAIL.toLowerCase(), hash]
    );
    console.log('Yönetici hesabı hazır:', ADMIN_EMAIL);
  }

  const { rows } = await pool.query('SELECT count(*)::int AS n FROM projeler');
  if (rows[0].n > 0) {
    console.log(`Projeler zaten dolu (${rows[0].n}); aktarım atlandı.`);
    return pool.end();
  }

  const veriKlasoru = path.join(__dirname, '..', 'veri');
  const satirlar = fs.readFileSync(path.join(veriKlasoru, 'eski-site-projeler.txt'), 'utf8')
    .split('\n').filter(s => s.includes(' | ') && !s.startsWith('#'));

  let n = 0;
  // Eski sitede en yeni proje en üstte; sırayı korumak için tersten ekliyoruz.
  for (const satir of satirlar.reverse()) {
    const [baslik, yol] = satir.split(' | ').map(s => s.trim());
    const p = basliktanProje(baslik, yol);
    const dosya = path.join(veriKlasoru, 'eski-gorseller', path.basename(yol));
    const gorsel = fs.existsSync(dosya) ? fs.readFileSync(dosya) : null;
    await pool.query(
      `INSERT INTO projeler (musteri, etkinlik, sehir, yil, tur, aciklama, one_cikan, gorsel, gorsel_tip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [p.musteri, p.etkinlik, p.sehir, p.yil, p.tur, p.aciklama, p.yil >= 2018, gorsel, gorsel ? 'image/jpeg' : null]
    );
    n++;
  }
  console.log(`${n} proje aktarıldı.`);
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
