AMAÇ: Az önce üç ayrı işçinin yaptığı değişiklikleri bağımsız olarak incele; gerçek hataları bul. Dosya değiştirme.

BAĞLAM:
- Proje: C:\Users\Serkan\ProjeWEB (Express 5 + EJS + PostgreSQL). Sunucu http://localhost:3000'de çalışıyor (yeniden başlatma). Ders projesi (BİLP2135 Web II), teslim 25 Kasım 2026 — yarından sonra; canlıya (Render+Neon) çıkacak.
- Yapılanlar (docs/ai/review-v6-bulgular.md H1-H18 maddelerini çözmek için; görev metinleri docs/ai/gorevler/02..05):
  * v6 kök siteye taşındı (routes/site.js tek dosya, views/, public/css/site.css, eski sürümler arsiv/, /v2../v6 → 301).
  * Backend: sorgu parametresi yardımcıları, lib/gorsel.js (sharp, WebP, küçük boy), /gorsel/:id ETag/304, lib/bildirim.js (nodemailer), db/goc.js + db/goc/*.sql (açılışta göç), robots.txt, sitemap.xml, /kvkk, db/pool.js SSL, scripts/test.js + TEST_DATABASE_URL.
  * Yönetim: routes/yonetim.js + views/yonetim/* baştan, lib/csrf.js, public/css/yonetim.css, public/js/yonetim.js, db/goc/002-yonetim.sql, CSV dışa aktarma, şifre değiştirme.
  * Ön yüz: views/kvkk.ejs, mobil eylem çubuğu, koyu tema renkleri, legend, hakkımızda slaytı, SEO etiketleri/JSON-LD, srcset/lazy.
- `npm test` şu an 62/62 geçiyor. Yönetim giriş bilgisi seed/örnek ayar dosyasında; rapora yazma.

ODAK: {ODAK}

KURALLAR: Yalnız oku ve curl/test çalıştır. Her bulgu somut kanıtla (dosya:satır ya da istek+yanıt) ve "neden gerçek hata" bir cümle. Zevk/üslup önerisi yazma; yalnız hata, güvenlik açığı, kırık akış, canlıda patlayacak şey, yönergeye/erişilebilirliğe aykırılık. Emin olmadığını "olası" diye işaretle.

DÖNÜŞ: En fazla 15 satır: önem sırasıyla bulgular (ciddi / orta / küçük), her biri dosya:satır + tek cümle düzeltme önerisi. Hiç bulgu yoksa açıkça "ciddi bulgu yok" yaz ve neyi kontrol ettiğini 2 satırda say.
