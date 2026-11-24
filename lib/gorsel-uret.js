// Küçük boyun üretimi: rota (ilk istekte) ve açılıştaki arka plan işi AYNI fonksiyonu kullanır.
// Güncelleme zamanına dokunulmaz; sayfalardaki ?v adresleri geçerli kalır.
const pool = require('../db/pool');
const { hazirla } = require('./gorsel');

const suruyor = new Map(); // id → bekleyen Promise (aynı id için tek iş)

// kaynak (isteğe bağlı): orijinal baytlar zaten elindeyse DB'den tekrar okunmaz.
// Dönüş: Buffer (küçük boy) ya da null (kayıt/fotoğraf yok). Üretim hatası fırlatılır.
function kucukUret(id, kaynak) {
  let is = suruyor.get(id);
  if (!is) {
    is = (async () => {
      let tam = kaynak;
      if (!tam) {
        const { rows } = await pool.query('SELECT gorsel FROM projeler WHERE id = $1', [id]);
        tam = rows[0] && rows[0].gorsel;
      }
      if (!tam) return null;
      const uretilen = (await hazirla(tam)).kucuk;
      await pool.query('UPDATE projeler SET gorsel_kucuk = $1 WHERE id = $2 AND gorsel_kucuk IS NULL', [uretilen, id]);
      return uretilen;
    })().finally(() => suruyor.delete(id));
    suruyor.set(id, is);
  }
  return is;
}

module.exports = { kucukUret };
