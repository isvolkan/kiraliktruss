// İşlem günlüğü: yönetim panelinde "kim, ne zaman, ne yaptı" kaydı (islem_kayitlari tablosu).
// kaydet() ana işi asla bozmaz: hata olursa fırlatmaz, yalnız konsola yazar.
// Kişisel veri kuralı: mesajlara ziyaretçinin telefonu / e-postası ve şifre yazılmaz (ad soyad + etkinlik özeti yeter).
const pool = require('../db/pool');

// Olay türleri. etiket: ekranda görünen ad; simge: views/yonetim/_simge.ejs'deki çizim adı; renk: yonetim.css'deki y-tur-* sınıfı
const TURLER = {
  teklif_geldi:       { etiket: 'Yeni teklif',            simge: 'zarf',    renk: 'mavi' },
  teklif_okundu:      { etiket: 'Teklif okundu',          simge: 'goz',     renk: 'gri' },
  teklif_durum:       { etiket: 'Teklif durumu',          simge: 'degisim', renk: 'sari' },
  teklif_not:         { etiket: 'Teklif notu',            simge: 'kalem',   renk: 'sari' },
  teklif_silindi:     { etiket: 'Teklif silindi',         simge: 'cop',     renk: 'kirmizi' },
  proje_eklendi:      { etiket: 'Proje eklendi',          simge: 'arti',    renk: 'yesil' },
  proje_guncellendi:  { etiket: 'Proje güncellendi',      simge: 'kalem',   renk: 'yesil' },
  proje_silindi:      { etiket: 'Proje silindi',          simge: 'cop',     renk: 'kirmizi' },
  giris:              { etiket: 'Giriş',                  simge: 'anahtar', renk: 'gri' },
  giris_basarisiz:    { etiket: 'Başarısız giriş',        simge: 'uyari',   renk: 'kirmizi' },
  sifre_degisti:      { etiket: 'Şifre değişti',          simge: 'anahtar', renk: 'sari' },
  cikis:              { etiket: 'Çıkış',                  simge: 'cikis',   renk: 'gri' },
};

// "kemal@admin.com" → "k***@admin.com" (başarısız girişte kimin denendiği anlaşılsın, tamamı saklanmasın)
function epostaMaskele(eposta) {
  const s = String(eposta || '').trim();
  const at = s.lastIndexOf('@');
  if (at < 1) return s ? s[0] + '***' : '(boş)';
  return s[0] + '***' + s.slice(at);
}

// Yeni kayıt ekler. Başarılıysa true, her türlü hatada false döner (fırlatmaz).
async function kaydet({ tur, mesaj, kullanici_id = null, teklif_id = null, proje_id = null } = {}) {
  try {
    if (!TURLER[tur]) throw new Error('bilinmeyen tür: ' + tur);
    await pool.query(
      `INSERT INTO islem_kayitlari (tur, mesaj, kullanici_id, teklif_id, proje_id) VALUES ($1, $2, $3, $4, $5)`,
      [tur, String(mesaj || TURLER[tur].etiket).slice(0, 300), kullanici_id || null, teklif_id || null, proje_id || null]
    );
    return true;
  } catch (err) {
    console.error('İşlem kaydı yazılamadı:', err.message);
    return false;
  }
}

// Ortak SELECT: kullanıcı e-postası (kimin yaptığı) tabloya katılır
const SECIM = `SELECT k.id, k.tur, k.mesaj, k.teklif_id, k.proje_id, k.olusturuldu, u.eposta AS kullanici
               FROM islem_kayitlari k LEFT JOIN kullanicilar u ON u.id = k.kullanici_id`;

// En yeni n kayıt (pano akışı)
async function son(n = 15) {
  const { rows } = await pool.query(`${SECIM} ORDER BY k.olusturuldu DESC, k.id DESC LIMIT $1`, [n]);
  return rows;
}

// Tam liste: isteğe bağlı tür süzgeci + sayfalama. Dönüş: { satirlar, toplam, sayfa, sayfaSayisi }
async function liste({ tur = '', sayfa = 1, sayfaBoyu = 30 } = {}) {
  const degerler = [];
  let where = '';
  if (TURLER[tur]) { degerler.push(tur); where = 'WHERE k.tur = $1'; }
  const toplam = (await pool.query(`SELECT count(*)::int AS n FROM islem_kayitlari k ${where}`, degerler)).rows[0].n;
  const sayfaSayisi = Math.max(1, Math.ceil(toplam / sayfaBoyu));
  sayfa = Math.min(Math.max(parseInt(sayfa, 10) || 1, 1), sayfaSayisi);
  const { rows } = await pool.query(
    `${SECIM} ${where} ORDER BY k.olusturuldu DESC, k.id DESC LIMIT ${sayfaBoyu} OFFSET ${(sayfa - 1) * sayfaBoyu}`, degerler);
  return { satirlar: rows, toplam, sayfa, sayfaSayisi };
}

// Bir teklifin geçmişi (en eski üstte): teklif sayfasındaki zaman çizelgesi
async function teklifGecmisi(teklifId) {
  const { rows } = await pool.query(`${SECIM} WHERE k.teklif_id = $1 ORDER BY k.olusturuldu, k.id`, [teklifId]);
  return rows;
}

// "az önce", "3 dk önce", "2 sa önce", "dün", "5 gün önce"; 30 günden eskisi tarih olarak yazılır
function goreli(tarih, simdi = Date.now()) {
  const sn = Math.max(0, Math.round((simdi - new Date(tarih).getTime()) / 1000));
  if (sn < 60) return 'az önce';
  if (sn < 3600) return Math.floor(sn / 60) + ' dk önce';
  if (sn < 86400) return Math.floor(sn / 3600) + ' sa önce';
  const gun = Math.floor(sn / 86400);
  if (gun === 1) return 'dün';
  if (gun <= 30) return gun + ' gün önce';
  return new Date(tarih).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' });
}

// Kaydın bağlantısı: teklif ya da proje hâlâ varsa ayrıntısına, yoksa bağlantı yok
function adres(k) {
  if (k.teklif_id) return `/yonetim/teklifler/${k.teklif_id}`;
  if (k.proje_id) return `/yonetim/projeler/${k.proje_id}/duzenle`;
  return null;
}

module.exports = { TURLER, kaydet, son, liste, teklifGecmisi, epostaMaskele, goreli, adres };
