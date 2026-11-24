// PostgreSQL bağlantı havuzu. Bağlantı adresi .env içindeki DATABASE_URL'den gelir.
require('dotenv').config();
const { Pool } = require('pg');

// Neon gibi bulut veritabanları SSL ister; yerelde kapalı. Sertifika doğrulanır (Neon herkese açık CA kullanır).
// DATABASE_SSL_GEVSEK=true doğrulamayı kapatır. pg, adresteki ?sslmode=... ayarını bu koddaki ssl ayarından ÖNCE
// uygular; bu yüzden gevşek mod istenince adresteki sslmode atılır, yoksa bayrak etkisiz kalırdı.
const sslAcik = process.env.DATABASE_SSL === 'true';
const gevsek = sslAcik && process.env.DATABASE_SSL_GEVSEK === 'true';

let adres = process.env.DATABASE_URL;
if (gevsek && adres) {
  try {
    const u = new URL(adres);
    u.searchParams.delete('sslmode');
    adres = u.toString();
  } catch { /* adres ayrıştırılamazsa olduğu gibi bırakılır */ }
}

const pool = new Pool({
  connectionString: adres,
  ssl: sslAcik ? { rejectUnauthorized: !gevsek } : false,
  max: 5,
});

module.exports = pool;
