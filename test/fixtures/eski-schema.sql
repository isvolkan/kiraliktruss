-- Kiralık Truss veritabanı şeması (PostgreSQL)
-- Çalıştırma: npm run seed  (tablolar yoksa oluşturur)

-- Yönetim paneline giren kullanıcılar
CREATE TABLE IF NOT EXISTS kullanicilar (
  id          SERIAL PRIMARY KEY,
  eposta      TEXT NOT NULL UNIQUE,
  sifre_hash  TEXT NOT NULL,             -- bcrypt ile şifrelenmiş parola, düz metin asla saklanmaz
  olusturma   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Örnek çalışmalar (CRUD 1: yönetim panelinden eklenir, listelenir, güncellenir, silinir)
CREATE TABLE IF NOT EXISTS projeler (
  id          SERIAL PRIMARY KEY,
  musteri     TEXT NOT NULL,             -- ör. "Maschio Gaspardo"
  etkinlik    TEXT NOT NULL,             -- ör. "Konya Tarım Fuarı"
  sehir       TEXT,                      -- ör. "Konya"
  yil         INTEGER CHECK (yil BETWEEN 2000 AND 2100),
  tur         TEXT NOT NULL DEFAULT 'fuar' CHECK (tur IN ('fuar', 'etkinlik', 'kurumsal')),
  aciklama    TEXT,
  one_cikan   BOOLEAN NOT NULL DEFAULT false,   -- ana sayfada gösterilsin mi
  gorsel      BYTEA,                     -- fotoğraf veritabanında (ücretsiz sunucunun diski kalıcı değil)
  gorsel_tip  TEXT,                      -- ör. image/jpeg
  olusturma   TIMESTAMPTZ NOT NULL DEFAULT now(),
  guncelleme  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS projeler_yil_idx ON projeler (yil DESC);

-- Teklif talepleri (CRUD 2: ziyaretçi formdan ekler, yönetici listeler, durumunu günceller, siler)
CREATE TABLE IF NOT EXISTS teklifler (
  id             SERIAL PRIMARY KEY,
  ad_soyad       TEXT NOT NULL,
  firma          TEXT,
  telefon        TEXT NOT NULL,
  eposta         TEXT NOT NULL,
  etkinlik_turu  TEXT NOT NULL,
  sehir          TEXT NOT NULL,
  tarih          DATE NOT NULL,
  gun_sayisi     INTEGER NOT NULL DEFAULT 1,
  metretul       INTEGER,               -- tahmini truss uzunluğu (hesaplayıcıdan gelebilir)
  kurulum        BOOLEAN NOT NULL DEFAULT true,
  mesaj          TEXT,
  kvkk_onay      BOOLEAN NOT NULL,
  durum          TEXT NOT NULL DEFAULT 'yeni' CHECK (durum IN ('yeni', 'arandi', 'teklif_verildi', 'kapandi')),
  yonetici_notu  TEXT,
  olusturma      TIMESTAMPTZ NOT NULL DEFAULT now()
);
