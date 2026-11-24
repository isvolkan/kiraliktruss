-- İşlem günlüğü (yönetim panosundaki "Son işlemler" akışı). Tekrar çalıştırmak güvenli (IF NOT EXISTS).
-- Teklif / proje / kullanıcı silinince kayıt kalır: bağlantı sütunu boşalır (ON DELETE SET NULL), mesajda ad zaten yazılıdır.
CREATE TABLE IF NOT EXISTS islem_kayitlari (
  id            SERIAL PRIMARY KEY,
  tur           TEXT NOT NULL,                                      -- ör. teklif_durum, giris (lib/kayit.js TURLER)
  mesaj         TEXT NOT NULL,                                      -- okunur özet; telefon / e-posta / şifre içermez
  kullanici_id  INTEGER REFERENCES kullanicilar (id) ON DELETE SET NULL,
  teklif_id     INTEGER REFERENCES teklifler (id) ON DELETE SET NULL,
  proje_id      INTEGER REFERENCES projeler (id) ON DELETE SET NULL,
  olusturuldu   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS islem_kayitlari_zaman_idx ON islem_kayitlari (olusturuldu DESC);
CREATE INDEX IF NOT EXISTS islem_kayitlari_tur_idx ON islem_kayitlari (tur, olusturuldu DESC);
CREATE INDEX IF NOT EXISTS islem_kayitlari_teklif_idx ON islem_kayitlari (teklif_id) WHERE teklif_id IS NOT NULL;
