# Yapay zekâ kullanım kaydı (sunum 06. bölüm için)

Araç: **Claude Code** (Anthropic, Claude Opus 5.5 modeli), masaüstü uygulaması. Tarih: 2026-11-14'ten itibaren.

| Ne için | Nasıl kullanıldı | Benim kararım / kontrolüm |
|---|---|---|
| Tasarım araştırması | Awwwards, Siteinspire ve Codrops'tan ~2500 site taranıp role göre (açılış, menü, galeri, form…) bir referans kütüphanesi çıkarıldı; 52 site tek tek açılıp incelendi | Referanslardan Kiralık Truss'a uyanlar seçildi (`secim-ornegi-kiraliktruss.md`); sıcak/yemek sitesi öğeleri bu müşteri için elendi |
| Eski site verisi | Eski sitedeki 96 proje başlığı ve fotoğrafı toplandı, başlıklar alanlara ayrıldı | Şüpheli 8 satır `veri/duzeltmeler.md`'de listelendi, Hakan Bey'e sorulacak |
| Kod iskeleti | Express rotaları, EJS şablonları, SQL şeması, doğrulama kuralları, testler üretildi | Teknoloji seçimi (Node + PostgreSQL + Render/Neon) benim; kodu bölüm bölüm okuyup açıklayabilecek düzeyde tuttuk (Türkçe yorumlar, kütüphanesiz JS) |
| İçerik | Metinler eski sitedeki bilgilerden yazıldı | Eski sitede olmayan iddialar (kurulum hizmeti, truss ölçüleri, dönüş süresi) bilerek yazılmadı; brief formunda soruluyor |
| Test | Duman testleri (9 test) yazıldı ve her değişiklikten sonra çalıştırıldı | |

Sunumda açıklanacak örnek bölümler: `routes/site.js` içindeki parametreli süzgeç sorgusu, `routes/yonetim.js` içindeki giriş ve proje güncelleme (COALESCE ile fotoğrafı koruma), `validators/index.js`, `public/js/site.js` içindeki kafes çizimi.
