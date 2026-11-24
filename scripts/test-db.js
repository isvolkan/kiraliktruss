// Yerelde ayrı bir test veritabanı kurar: kiraliktruss_test (yoksa oluşturur), şema + yönetici + örnek veri + göçler.
// Kullanım: npm run test:db   → sonra .env'e şu satırı ekleyin (betik adresi yazdırır):
//   TEST_DATABASE_URL=postgres://kullanici:sifre@localhost:5433/kiraliktruss_test
// Yalnız DATABASE_URL'deki sunucuya bağlanır; sunucu adı yerel (localhost / 127.0.0.1) değilse çalışmayı reddeder.
require('dotenv').config();
const path = require('path');
const { spawnSync } = require('child_process');
const { Client } = require('pg');

const TEST_AD = 'kiraliktruss_test';

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL tanımlı değil (.env)');
  const adres = new URL(process.env.DATABASE_URL);
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(adres.hostname)) {
    throw new Error('Güvenlik: test veritabanı yalnız yerel sunucuda kurulur (host: ' + adres.hostname + ')');
  }

  // Sunucunun bakım veritabanından (postgres) bağlanıp test veritabanını yoksa oluştur
  const bakim = new URL(adres); bakim.pathname = '/postgres';
  const c = new Client({ connectionString: bakim.toString() });
  await c.connect();
  const var_ = await c.query('SELECT 1 FROM pg_database WHERE datname = $1', [TEST_AD]);
  if (!var_.rowCount) { await c.query(`CREATE DATABASE ${TEST_AD}`); console.log('Veritabanı oluşturuldu:', TEST_AD); }
  else console.log('Veritabanı zaten var:', TEST_AD);
  await c.end();

  const testAdresi = new URL(adres); testAdresi.pathname = '/' + TEST_AD;
  const env = { ...process.env, DATABASE_URL: testAdresi.toString(), DATABASE_SSL: 'false' };
  // Şema + yönetici + örnek projeler (db/seed.js), sonra göçler (scripts/test.js da her koşuda göçleri uygular)
  const kok = path.join(__dirname, '..');
  for (const betik of ['db/seed.js', '-e']) {
    const arg = betik === '-e' ? ['-e', "require('./db/goc')().then(()=>require('./db/pool').end())"] : [betik];
    const s = spawnSync(process.execPath, arg, { stdio: 'inherit', cwd: kok, env });
    if (s.status !== 0) throw new Error('Kurulum adımı başarısız: ' + betik);
  }
  // Parola yazdırılmaz: .env'deki DATABASE_URL'nin aynısı, yalnız veritabanı adı farklı olmalı
  console.log(`\nHazır. .env dosyasına TEST_DATABASE_URL ekleyin: DATABASE_URL ile aynı, yalnız sonu /${TEST_AD} olsun.`);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
