// Test yardımcısı (test dosyası değil): testlerin işlem günlüğüne yazdığı kayıtlar bitince silinsin.
// izle() başlangıçtaki en büyük kayıt numarasını hatırlar; dönen işlev, ondan sonra eklenen her kaydı siler.
const { zorunlu } = require('../lib/test-koruma');
module.exports = async function izle(pool) {
  zorunlu(); // uzak (canlı) veritabanında silme yapılmasın
  const { rows } = await pool.query('SELECT coalesce(max(id), 0)::int AS n FROM islem_kayitlari');
  return () => pool.query('DELETE FROM islem_kayitlari WHERE id > $1', [rows[0].n]);
};
