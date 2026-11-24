// Test koruması: testler ve test temizliği (DELETE ...) yanlışlıkla canlı / uzak veritabanında çalışmasın.
// Kural: kullanılacak bağlantının hostu localhost / 127.0.0.1 / ::1 olmalı; uzak host yalnız TEST_DATABASE_URL açıkça
// verilmişse (kullanıcı o veritabanını test için ayırmıştır) kabul edilir. Saf işlevler: bağlantı açmaz.
const YEREL = new Set(['localhost', '127.0.0.1', '::1']);

function hostCikar(adres) {
  if (!adres) return process.env.PGHOST || 'localhost'; // adres yoksa pg ortam değişkenlerine / yerel varsayılana düşer
  try { return new URL(adres).hostname.replace(/^\[|\]$/g, '').toLowerCase(); } catch { return null; }
}

// env: { DATABASE_URL, TEST_DATABASE_URL }. Dönüş: { ok, host, neden }
function kontrol(env = process.env) {
  if (env.TEST_DATABASE_URL) return { ok: true, host: hostCikar(env.TEST_DATABASE_URL), neden: 'TEST_DATABASE_URL tanımlı' };
  const host = hostCikar(env.DATABASE_URL);
  if (host && YEREL.has(host)) return { ok: true, host, neden: 'yerel veritabanı' };
  return {
    ok: false, host,
    neden: `Testler uzak veritabanında çalıştırılmaz (host: ${host || 'okunamadı'}). Testler tablo satırlarını siler. `
      + 'Yerel bir veritabanı kullanın ya da ayrı bir test veritabanını TEST_DATABASE_URL ile belirtin.',
  };
}

// Güvenli değilse hata fırlatır
function zorunlu(env = process.env) {
  const s = kontrol(env);
  if (!s.ok) throw new Error(s.neden);
  return s;
}

module.exports = { kontrol, zorunlu };
