# Arşiv: eski tasarım sürümleri

Tasarım süreci altı turda ilerledi. Her tur aynı veritabanı ve aynı rotalarla, ayrı görünüm ve varlıklarla
yan yana yayınlandı (ilk sürüm kökte, sonrakiler `/v2` … `/v6` altında) ve karşılaştırıldı.
Seçilen sürüm (v6, "yön tabelası") 23 Kasım 2026'da sitenin tek sürümü olarak köke taşındı;
geri kalanlar sunumda süreci anlatabilmek için burada saklanıyor.

| Klasör | İçerik |
|---|---|
| `views/kok/` | İlk tasarımın görünümleri (eski kök site) |
| `views/partials/`, `views/yonetim/` | İlk tasarımın üst/alt parçaları ve eski yönetim paneli görünümleri (panel 23 Kasım 2026'da v6 diliyle yenilendi) |
| `public/css/yonetim-eski.css`, `public/js/yonetim-eski.js`, `public/js/yonetim-tema.js` | İlk tasarımın CSS / JS dosyaları (son olarak eski yönetim paneli kullanıyordu) |
| `views/v2` … `views/v5` | 2.–5. tur görünümleri |
| `public/v2` … `public/v5` | 2.–5. tur CSS / JS / görselleri |
| `routes/site-eski.js` | Köke taşınmadan önceki ortak ziyaretçi rotaları (tüm sürümler bunu kullanıyordu) |
| `routes/v3.js` … `routes/v6.js` | Sürümlere özel ek rotalar (`res.render`'ı sürüm klasörüne yönlendiren yama ile); v2'nin yaması `app.js` içindeydi |
| `test/` | Eski sürümlerin testleri ve eski kök görünüme göre yazılmış `akislar` testinin önceki hâli |

Notlar:
- Bu klasör **çalışmaz ve servis edilmez**: `express.static` yalnız `public/`'i sunar, `app.js` buradan hiçbir şey yüklemez,
  `npm test` yalnız `test/*.test.js`'i çalıştırır. Dosyalardaki yollar (`../db/pool`, `v2/...`) eski yerlerine göredir.
- Eski adresler kalıcı olarak yönlendirilir (`routes/site.js`): `/v2` … `/v6` altındaki her adres öneksiz karşılığına.
