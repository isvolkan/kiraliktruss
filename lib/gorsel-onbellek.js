// /gorsel/:id yanıtları için sunucu belleğinde LRU önbellek (kütüphanesiz).
// Her (proje, boy) için tek kayıt tutulur: { guncelleme, etag, tur, veri, zaman }.
// Sürüm (guncelleme) kayıtta saklanır; istekteki ?v ile eşleşmezse kayıt geçersiz sayılır (panel değişikliği kendiliğinden yansır).
// Sürümsüz isteklerde kayıt en fazla SURUMSUZ_OMUR_MS yaşlı olabilir.
const SINIR_BAYT = (Number(process.env.GORSEL_ONBELLEK_MB) || 64) * 1024 * 1024;
const SURUMSUZ_OMUR_MS = 60 * 1000;

const harita = new Map(); // Map ekleme sırasını korur: ilk anahtar en eski kullanılan
const nesil = new Map(); // id → sil() sayısı; yükleme sürerken silindiyse eski veri önbelleğe yazılmasın
let toplam = 0;
const sayac = { isabet: 0, iska: 0 };

const anahtar = (id, kucuk) => `${id}:${kucuk ? 'k' : 't'}`;

function cikar(k) {
  const e = harita.get(k);
  if (!e) return;
  toplam -= e.veri.length;
  harita.delete(k);
}

// Geçerli kayıt ya da null. surum: istekteki ?v (string) ya da ''.
function al(id, kucuk, surum) {
  const k = anahtar(id, kucuk);
  const e = harita.get(k);
  const gecerli = e && (surum ? String(e.guncelleme) === surum : Date.now() - e.zaman < SURUMSUZ_OMUR_MS);
  if (!gecerli) { sayac.iska++; return null; }
  harita.delete(k); harita.set(k, e); // en son kullanılana taşı
  sayac.isabet++;
  return e;
}

function yaz(id, kucuk, kayit, baslangicNesli) {
  if ((nesil.get(id) || 0) !== (baslangicNesli || 0)) return; // yükleme sırasında silindi
  if (kayit.veri.length > SINIR_BAYT) return;
  const k = anahtar(id, kucuk);
  cikar(k);
  harita.set(k, { ...kayit, zaman: Date.now() });
  toplam += kayit.veri.length;
  while (toplam > SINIR_BAYT && harita.size) cikar(harita.keys().next().value); // en eski çıkar
}

// Fotoğraf güncellenince / silinince projenin tüm boyları atılır
function sil(id) {
  nesil.set(id, (nesil.get(id) || 0) + 1);
  cikar(anahtar(id, false));
  cikar(anahtar(id, true));
}

const mevcutNesil = (id) => nesil.get(id) || 0;
const bilgi = () => ({ ...sayac, kayit: harita.size, bayt: toplam, sinir: SINIR_BAYT });
function temizle() { harita.clear(); nesil.clear(); toplam = 0; sayac.isabet = 0; sayac.iska = 0; }

// ETag'i rota ve ısıtma ORTAK üretir: küçük boy tam boydan türediği için ikisi de tam boyun boyutundan ve güncelleme anından oluşur.
const etagUret = (id, kucuk, guncellemeMs, tamBoyut) => `"${id}-${kucuk ? 'k' : 't'}-${guncellemeMs}-${tamBoyut}"`;

// Açılışta önbelleği doldurur: önce küçük boylar, sonra tam boylar; DB'den küçük gruplar hâlinde okur.
// Küçük boyu DB'de olmayan kayıtlar atlanır (sharp ile üretmek ücretsiz planın 0.1 CPU'sunu boğar; rota ilk istekte üretir).
// Bayt sınırı aşılmaz: sığmayan kayıt atlanır. Dönüş: { adet, bayt, ms } ya da kapalıysa null.
async function isit({ grup = 10, log = true } = {}) {
  if (process.env.ISIT_GORSEL === 'false') return null;
  const pool = require('../db/pool');
  const t0 = Date.now();
  let adet = 0, bayt = 0;
  const idler = (await pool.query('SELECT id FROM projeler WHERE gorsel IS NOT NULL ORDER BY id')).rows.map((r) => r.id);
  for (const kucuk of [true, false]) {
    const sutun = kucuk ? 'gorsel_kucuk' : 'gorsel';
    for (let i = 0; i < idler.length; i += grup) {
      const dilim = idler.slice(i, i + grup);
      const nesiller = new Map(dilim.map((id) => [id, mevcutNesil(id)]));
      const { rows } = await pool.query(
        `SELECT id, ${sutun} AS veri, gorsel_tip, guncelleme, octet_length(gorsel) AS boyut
           FROM projeler WHERE id = ANY($1::int[]) AND ${sutun} IS NOT NULL ORDER BY id`, [dilim]);
      for (const r of rows) {
        if (toplam + r.veri.length > SINIR_BAYT) continue; // sınırı aşma
        const ms = r.guncelleme.getTime();
        yaz(r.id, kucuk, {
          guncelleme: ms, etag: etagUret(r.id, kucuk, ms, r.boyut),
          tur: kucuk ? 'image/webp' : (r.gorsel_tip || 'image/jpeg'), veri: r.veri,
        }, nesiller.get(r.id));
        if (harita.has(anahtar(r.id, kucuk))) { adet++; bayt += r.veri.length; }
      }
    }
  }
  const sonuc = { adet, bayt, ms: Date.now() - t0 };
  if (log) console.log(`Görsel ısıtma: ${adet} görsel, ${(bayt / 1048576).toFixed(1)} MB, ${sonuc.ms} ms`);
  return sonuc;
}

module.exports = { al, yaz, sil, mevcutNesil, bilgi, temizle, etagUret, isit, SINIR_BAYT };
