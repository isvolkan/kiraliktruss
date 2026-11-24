// Veritabanı göçleri: db/goc/*.sql dosyalarını ad sırasına göre çalıştırır.
// Her dosya tekrar çalıştırılabilir yazılmıştır (IF NOT EXISTS ...), bu yüzden kayıt tablosu tutmuyoruz.
// server.js açılışta, listen'dan önce çağırır; böylece yeni sürüm yayına girince sütunlar kendiliğinden eklenir.
const fs = require('fs');
const path = require('path');
const pool = require('./pool');

const KLASOR = path.join(__dirname, 'goc');

async function gocCalistir() {
  const dosyalar = fs.readdirSync(KLASOR).filter((d) => d.endsWith('.sql')).sort();
  for (const dosya of dosyalar) {
    await pool.query(fs.readFileSync(path.join(KLASOR, dosya), 'utf8'));
    console.log('Göç uygulandı:', dosya);
  }
}

module.exports = gocCalistir;
