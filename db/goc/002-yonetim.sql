-- Yönetim paneli için teklif sütunları. Tekrar çalıştırmak güvenli (IF NOT EXISTS).
-- okundu: yönetici teklifin ayrıntısını açtı mı (panelde "okunmamış" rozeti ve vurgusu buna bakar)
ALTER TABLE teklifler ADD COLUMN IF NOT EXISTS okundu BOOLEAN NOT NULL DEFAULT false;
-- yonetici_notu: yalnız yönetimin gördüğü not (eski kurulumlarda zaten var)
ALTER TABLE teklifler ADD COLUMN IF NOT EXISTS yonetici_notu TEXT;
-- guncellendi: durum ya da not en son ne zaman değişti (hiç değişmediyse boş)
ALTER TABLE teklifler ADD COLUMN IF NOT EXISTS guncellendi TIMESTAMPTZ;
-- Liste "okunmamış önce, en yeni üstte" sıralanır
CREATE INDEX IF NOT EXISTS teklifler_okundu_idx ON teklifler (okundu, olusturma DESC);
