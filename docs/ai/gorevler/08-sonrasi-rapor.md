AMAÇ: Düzeltme SONRASI durumu, öncesiyle birebir aynı yöntemle kayda geçir ve öncesi/sonrası karşılaştırma raporunu (HTML) üret.

BAĞLAM:
- Proje: C:\Users\Serkan\ProjeWEB. Sunucu http://localhost:3000'de çalışıyor (başlatma/durdurma). v6 artık kökte (/v6/* → 301 öneksiz). Yönetim /yonetim (giriş bilgisi seed/.env'de; rapora yazma). Yönetim formlarında artık CSRF jetonu var.
- ÖNCESİ kaydı: docs/karsilastirma/oncesi/ (26 PNG, olcumler.md, olcumler.json, komut-ciktilari.txt). Yöntem: Chrome headless (CDP, Node betiği; --headless=new --remote-debugging-port, Emulation.setDeviceMetricsOverride, Page.captureScreenshot), 1280×800 ve 375×812; koyu tema localStorage['v6-tema']='koyu'. Öncesi dosya adlarını ve olcumler.md'deki 13 maddeyi oku, AYNI adlarla ve AYNI ölçümle sonrasını al (adresler artık öneksiz: /v6/x yerine /x; yönetim yeni tasarım).
- Bulgu listesi: docs/ai/review-v6-bulgular.md (H1-H18). Yapılan işler: docs/ai/gorevler/02..07 (görev metinleri) ve README.md.

YAPILACAKLAR:
1. docs/karsilastirma/sonrasi/: öncesiyle aynı ekran görüntüleri + olcumler.md + olcumler.json + komut-ciktilari.txt. Ek olarak: /kvkk (1280, 375), 375 px mobil eylem çubuğu görünür, koyu tema teklif hata görüntüsü, yönetim: giriş, pano, projeler listesi, proje düzenleme, teklifler listesi, teklif detayı, hesap (1280 ve 375). Ölçümler: 13 maddenin sonrası değerleri (500 → ?, kontrast oranı, KVKK URL kodu, /, /calismalar görsel bayt ve istek sayısı — yalnız ilk yüklemede istenen eager görseller ile tüm görseller ayrı ayrı, meta description benzersizliği, canonical/og/ld+json var mı, robots.txt ve sitemap.xml kodu ve içeriği özeti, CSRF jetonu formlarda var mı, CSRF'siz POST → 403, sahte .jpg → 422, npm test sonucu). Test DB: geçerli teklif gönderme yalnız test içinde.
2. docs/karsilastirma/index.html — tek dosya, kendi içinde (harici kaynak yok; görseller göreli yol ile oncesi/ ve sonrasi/ klasörlerinden), Türkçe, v6 tasarım diline yakın sade stil, açık/koyu uyumlu, mobilde okunur:
   - Başlık: "Kiralık Truss — düzeltme öncesi / sonrası", tarih, kısa özet (kaç bulgu, kaçı çözüldü, kaçı müşteri kararı bekliyor).
   - Özet tablosu: H1-H18 (+ inceleme turunda bulunup düzeltilen D1-D11'i ayrı küçük tablo) — Bulgu | Önce | Sonra | Durum (Çözüldü / Kısmen / Müşteri kararı / Bilerek bırakıldı). Ölçülebilenlerde sayı (ör. "HTTP 500 → 200", "2,67:1 → 6,92:1", "4,5 MB → x MB").
   - Her ölçülebilir/görsel bulgu için yan yana öncesi/sonrası ekran görüntüsü (tıklayınca büyük açılsın, kütüphanesiz).
   - Yönetim paneli bölümü: eski / yeni ekran görüntüleri ve yeni özellik listesi; yönergenin opsiyonel artılarından hangilerini karşıladığı (authentication, gelişmiş yönetim paneli, arama/filtreleme, otomatik e-posta).
   - "Açık kalanlar" bölümü: H3 (müşteri teyidi), H18 (SITE_DEMO), SMTP canlı denenmedi, hesaplayıcı bilerek kaldırıldı, Render env anahtarları.
   - Dürüst ol: çözülmeyeni çözüldü yazma; ölçmediğini "ölçülmedi" yaz.
3. Sayfayı Chrome headless ile 1280 ve 375'te açıp görsellerin yüklendiğini (kırık img yok) kontrol et.

KAPSAM: Yalnız docs/karsilastirma/ altına yaz. Başka dosya değiştirme. Betikleri proje dışında (geçici klasörde) tut. git commit/push yapma.

KABUL ÖLÇÜTÜ: sonrasi/ öncesiyle eşleşen adlarla dolu; index.html açılıyor, kırık görsel yok; tablo her H maddesini içeriyor.

DÖNÜŞ: En fazla 12 satır: kaç görüntü alındı, 13 maddenin sonrası değerleri (kısa), özet sayılar (çözüldü / kısmen / açık), test sonucu, rapor yolu. Dosya dökümü yapıştırma.
