// Testleri çalıştırır (npm test). TEST_DATABASE_URL tanımlıysa testler o veritabanına bağlanır,
// geliştirme veritabanına dokunmaz; tanımlı değilse DATABASE_URL (bugünkü davranış) kullanılır.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL; // alt süreç de bunu miras alır (dotenv var olanı ezmez)
  console.log('Testler TEST_DATABASE_URL veritabanında çalışıyor.');
}

async function main() {
  // Test veritabanında göçler güncel olsun (sunucu açılışı bunu zaten yapar; testler sunucusuz çalışır)
  const pool = require('../db/pool');
  await require('../db/goc')();
  await pool.end();

  const klasor = path.join(__dirname, '..', 'test');
  const dosyalar = fs.readdirSync(klasor).filter((d) => d.endsWith('.test.js')).map((d) => path.join('test', d));
  const sonuc = spawnSync(process.execPath, ['--test', ...process.argv.slice(2), ...dosyalar],
    { stdio: 'inherit', cwd: path.join(__dirname, '..'), env: process.env });
  process.exit(sonuc.status ?? 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
