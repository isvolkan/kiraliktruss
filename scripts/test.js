// Testleri çalıştırır (npm test). TEST_DATABASE_URL tanımlıysa testler o veritabanına bağlanır,
// geliştirme veritabanına dokunmaz; tanımlı değilse DATABASE_URL (bugünkü davranış) kullanılır.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// Koruma: testler tablo satırı siler; uzak (canlı) veritabanında hiç başlamasın. Bağlantı açılmadan önce denetlenir.
const koruma = require('../lib/test-koruma').kontrol();
if (!koruma.ok) {
  console.error('HATA: ' + koruma.neden);
  process.exit(1);
}

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL; // alt süreç de bunu miras alır (dotenv var olanı ezmez)
  console.log('Testler TEST_DATABASE_URL veritabanında çalışıyor.');
}

async function main() {
  // Test veritabanında göçler güncel olsun (sunucu açılışı bunu zaten yapar; testler sunucusuz çalışır)
  const pool = require('../db/pool');
  await require('../db/goc')();
  // Testler işlem günlüğüne kayıt düşer (ör. POST /teklif → teklif_geldi); bitince panoda test artığı kalmasın
  const gunlukIlk = (await pool.query('SELECT coalesce(max(id), 0)::int AS n FROM islem_kayitlari')).rows[0].n;

  const klasor = path.join(__dirname, '..', 'test');
  const dosyalar = fs.readdirSync(klasor).filter((d) => d.endsWith('.test.js')).map((d) => path.join('test', d));
  const sonuc = spawnSync(process.execPath, ['--test', ...process.argv.slice(2), ...dosyalar],
    { stdio: 'inherit', cwd: path.join(__dirname, '..'), env: process.env });
  await pool.query('DELETE FROM islem_kayitlari WHERE id > $1', [gunlukIlk]);
  await pool.end();
  process.exit(sonuc.status ?? 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
