-- Küçük boy fotoğraf (genişlik ≤600 px WebP). Liste sayfaları bunu kullanır; tam boy gorsel sütununda kalır.
ALTER TABLE projeler ADD COLUMN IF NOT EXISTS gorsel_kucuk BYTEA;
