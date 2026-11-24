// Tabloları oluşturur, yönetici hesabını açar ve eski siteden alınan 96 projeyi içeri aktarır.
// Kullanım: npm run seed   (tekrar çalıştırmak güvenli: proje tablosu boşsa doldurur)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('./pool');
const { basliktanProje } = require('./baslik');
const gocCalistir = require('./goc');

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  // Eski şemalı veritabanında (sütunlar sonradan eklendi) göçler seed'den önce uygulanır; her biri tekrar çalıştırılabilir.
  await gocCalistir();
  console.log('Tablolar hazır.');

  // Yönetici hesabı: e-posta ve parola .env'den okunur, parola bcrypt ile saklanır.
  // Yalnız hesap yoksa oluşturulur; varsa dokunulmaz (panelden değiştirilen şifre yeniden başlatmada geri yazılmasın).
  // E-posta giriş rotasıyla aynı biçimde normalize edilir (trim + küçük harf).
  // ADMIN_SIFRE_SIFIRLA=true (tam olarak "true") ise şifre bilinçli olarak ADMIN_PASSWORD'e sıfırlanır.
  const { ADMIN_PASSWORD, ADMIN_SIFRE_SIFIRLA } = process.env;
  const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const sifirla = ADMIN_SIFRE_SIFIRLA === 'true';
    if (sifirla && ADMIN_PASSWORD.length < 10) {
      console.warn('ADMIN_SIFRE_SIFIRLA atlandı: ADMIN_PASSWORD en az 10 karakter olmalı.');
    }
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    if (sifirla && ADMIN_PASSWORD.length >= 10) {
      const var_ = await pool.query('SELECT id FROM kullanicilar WHERE lower(eposta) = $1', [ADMIN_EMAIL]);
      if (var_.rowCount) {
        await pool.query('UPDATE kullanicilar SET sifre_hash = $2 WHERE id = $1', [var_.rows[0].id, hash]);
        await pool.query(`DELETE FROM oturumlar WHERE sess->'kullanici'->>'id' = $1`, [String(var_.rows[0].id)]);
      } else {
        await pool.query('INSERT INTO kullanicilar (eposta, sifre_hash) VALUES ($1, $2)', [ADMIN_EMAIL, hash]);
      }
      console.log('Yönetici şifresi ADMIN_SIFRE_SIFIRLA ile sıfırlandı — bu değişkeni şimdi kaldırın.');
    } else {
      const eklendi = await pool.query(
        `INSERT INTO kullanicilar (eposta, sifre_hash) VALUES ($1, $2) ON CONFLICT (eposta) DO NOTHING`,
        [ADMIN_EMAIL, hash]
      );
      console.log(eklendi.rowCount ? 'Yönetici hesabı oluşturuldu:' : 'Yönetici hesabı zaten var, şifre değiştirilmedi:', ADMIN_EMAIL);
    }
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
