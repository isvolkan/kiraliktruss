# v6 review bulguları (2026-11-23, 5 model: Opus 5.5, 2× Sonnet 5.5, Gemini 4 Neon, Argon)

Ortalama not ~7,2/10, ortak hüküm: şartlı yayına hazır. Doğrulanan bulgular (H = numara, sonraki görevler bu numaraları kullanır):

## Yayın engelleri
- H1 KVKK aydınlatma metni sayfası yok; teklif formu onay kutusu ve validators/index.js:152 "aydınlatma metni" diyor.
- H2 Yeni teklif bildirilmiyor: routes/site.js ~121 yalnız DB'ye yazıyor (e-posta yok, panelde "yeni" uyarısı yok).
- H3 Teyitsiz içerik iddiaları (TÜV/TSE/CE, ~1000 metretül, "Avrupa standartları") — config/firma.js:1 teyit bekliyor. KOD İLE ÇÖZÜLMEZ, müşteriye sorulacak; iddialar tek yerden (config/firma.js) yönetilsin.
- H4 Görseller ağır: /gorsel/:id DB BYTEA'dan tam boy JPEG (130-290 KB), küçük boy/WebP/srcset yok, Cache-Control 1 gün, ETag/304 yok; /v6/calismalar ~4,5 MB; ana sayfa şeridinde 12 görsel loading=eager (anasayfa.ejs:71 hemen:true).
- H5 SEO: her sayfada aynı meta description (parca/bas.ejs:16); canonical, Open Graph, LocalBusiness JSON-LD, robots.txt, sitemap.xml yok. v6 /v6 altında, kök / eski tasarım.

## Hatalar
- H6 GET /v6/calismalar?q=a&q=b → 500 (routes/site.js:44 q.trim(), dizi gelince patlıyor). Diğer sorgu parametreleri de aynı riskte.
- H7 routes/yonetim.js:50 session.regenerate geri çağrısında `throw err` → süreç çöker; next(err) olmalı.
- H8 Mobil: v6.css:183-191 .ust-teklif <768px, .ust-tel <1024px gizli; mobilde teklif/arama düğmesi yok.
- H9 Koyu temada --hata (#B3261E) yeniden tanımlanmıyor → ~2,7:1 kontrast (AA altı).
- H10 views/v6/teklif.ejs:38,65,84 <legend> içinde <h2> (geçersiz içerik modeli).
- H11 views/v6/hakkimizda.ejs:25 otomatik dönen slaytta aria-live="polite" (ekran okuyucuyu 5 sn'de bir bölüyor), duraklatma yok.
- H12 Yönetimde CSRF jetonu yok (yalnız sameSite=lax); yüklemede yalnız istemci mimetype'ı (yonetim.js:16-20), dosya imzası (magic bytes) kontrolü yok.
- H13 v6 ana sayfası routes/site.js'e next() ile düşüp kullanılmayan 2 sorgu (oneCikan, fuarlar) çalıştırıyor.
- H14 Yönetim paneli eski kök tasarımda (views/yonetim/_ust.ejs), çıkış / (eski siteye) yönlendiriyor.
- H15 Ölü kod: views/v6/parca/hesaplayici.ejs + public/v6/js/v6.js ~424-490 hiçbir sayfada kullanılmıyor (README ise hesaplayıcıyı özellik olarak sayıyor).
- H16 Testler geliştirme DB'sine yazıyor; yönetim CRUD/yetki, 429, 500 ve CSRF için v6'ya özel test yok.
- H17 db/pool.js:8 rejectUnauthorized:false (Neon için), SESSION_SECRET yalnız canlıda zorunlu.
- H18 SITE_DEMO=true (render.yaml) → X-Robots-Tag noindex. Müşteri alan adına taşınana dek açık kalabilir; karar kullanıcıda.
