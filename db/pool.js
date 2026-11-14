// PostgreSQL bağlantı havuzu. Bağlantı adresi .env içindeki DATABASE_URL'den gelir.
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Neon gibi bulut veritabanları SSL ister; yerelde kapalı.
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 5,
});

module.exports = pool;
