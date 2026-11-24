AMAÇ: İki bağımsız incelemenin bulduğu 11 sorunu düzelt (D1-D11), her biri için test ekle ya da mevcut testi güncelle.

BAĞLAM:
- Proje: C:\Users\Serkan\ProjeWEB (Express 5 + EJS + PostgreSQL; yerel DB port 5433; sunucu 3000'de node --watch, başlatma/durdurma). Canlı: Render ücretsiz plan + Neon (render.yaml). Teslim 25 Kasım 2026, canlı yayın bozulmamalı. Kısa Türkçe yorum, sade kod. `npm test` şu an 62/62 geçiyor.

DÜZELTİLECEKLER:
- D1 (ciddi) render.yaml:~48 + db/seed.js:30-34 — açılışta seed çalışıyor ve yönetici şifresini ON CONFLICT DO UPDATE ile .env ADMIN_PASSWORD'a geri yazıyor; panelden değiştirilen şifre yeniden başlatmada kayboluyor. Yönetici satırı için DO NOTHING (yalnız yoksa oluştur). Seed'in proje verisini yeniden yazan kısmı da her açılışta yönetimden yapılan değişiklikleri eziyor mu kontrol et; eziyorsa yalnız tablo boşken eklesin. Test: seed iki kez çalışınca değiştirilmiş şifre korunuyor.
- D2 (orta) db/schema.sql:~51 — teklifler(okundu,...) indeksi schema.sql'de; eski şemalı Neon'da seed schema.sql'i göçlerden önce çalıştırınca "column does not exist" ile açılış çöker. Bu indeksi (ve göçte zaten olan, yeni sütunlara dayanan her şeyi) schema.sql'den çıkar ya da güvenli hâle getir; açılış sırasını (render.yaml start/build komutu, server.js) eski şemalı veritabanında da çalışacak biçimde düzenle. Test: yalnız ESKİ şema (arsiv'deki ya da git HEAD'deki db/schema.sql — `git show HEAD:db/schema.sql`) ile kurulmuş geçici bir yerel veritabanında seed + göç + açılış başarıyla tamamlanıyor (scripts/test-db.js desenini kullan; geçici DB'yi sonunda sil).
- D3 (orta) routes/site.js:~180 — /gorsel/:id 30 gün public önbellek, ama ziyaretçi sayfaları görseli sürüm parametresiz çağırıyor (views/parca/kart.ejs, views/calisma.ejs, views/anasayfa.ejs, hakkımızda); fotoğraf değişince 30 gün eski kalır. Ziyaretçi görsel adreslerine `?v=<güncelleme zamanı epoch>` ekle (boy=kucuk ile birlikte: `/gorsel/ID?boy=kucuk&v=...`); sorgular bu zamanı döndürsün. v yoksa Cache-Control: no-cache (ETag ile 304), v varsa public, max-age=31536000, immutable. Test.
- D4 (küçük) routes/site.js:~242,261 — POST /teklif form dışı gövdeyle (text/plain) 500. `req.body || {}`. Test.
- D5 (küçük) db/pool.js:~109 + .env.example — DATABASE_SSL_GEVSEK, bağlantı adresinde sslmode=require varken etkisiz (pg adresteki ayarı öne alır). Açıklamayı doğru yaz (ya da adresteki sslmode'u ayrıştırıp tutarlı davran); davranışı Neon'u kıracak biçimde değiştirme.
- D6 (küçük) lib/bildirim.js:~133 — ayarVarMi() SITE_URL'yi de istesin (yoksa panel bağlantısı göreli olur). README'ye not: Render ücretsiz planda giden SMTP portları (25/465/587) kapalı olabilir; o durumda e-posta gitmez, panel rozeti yine çalışır. Not "olabilir" diye yazılsın.
- D7 (orta) views/yonetim/_ust.ejs:5-8 — yönetim menüsünde aria-current hiç basılmıyor (alt router'da req.path öneksiz). routes/yonetim.js ara katmanında res.locals.yol = req.baseUrl + req.path ya da şablonda doğru karşılaştırma. Test: /yonetim/projeler'de Projeler bağlantısı aria-current="page".
- D8 (orta) README.md — güncel yapıyla tutarsız: views/partials, yonetim-eski* satırlarını kaldır; lib/, scripts/, db/goc/, test/ dosyalarını, yönetim panelinin yeni özelliklerini (pano, teklif detayı/not/okundu, CSV, şifre değiştirme, CSRF), e-posta bildirimi, görsel hattı, KVKK, SEO, robots/sitemap'i ekle. "Metretül hesaplayıcı" satırını "v6'da şimdilik kaldırıldı (kod views/parca/hesaplayici.ejs'te duruyor)" biçiminde dürüstçe yaz. Render'da ayarlanacak env anahtarlarını (SITE_URL, SMTP_*, BILDIRIM_EPOSTA, SESSION_SECRET, SITE_DEMO) listele. Yönergedeki şartların nerede karşılandığı bölümünü güncelle.
- D9 (küçük) views/yonetim/yasak.ejs — "İçeriğe geç" bağlantısı ekle (diğer yönetim sayfalarındaki desen).
- D10 (küçük) views/404.ejs, views/hata.ejs, views/parca/bas.ejs — hata sayfalarında canonical/og:url basılmasın, her zaman <meta name="robots" content="noindex">. Test.
- D11 (küçük) views/hakkimizda.ejs:~24 + public/js/gosteri.js:~16 — slayt görselleri küçük boy + srcset (D3'teki v parametresiyle).

KAPSAM: Yukarıda adı geçen dosyalar ve test/. Paket kurma. git commit/push yapma. Canlı veritabanına bağlanma. docs/karsilastirma/ ve docs/ai/ altına dokunma.

KABUL ÖLÇÜTÜ: D1-D11 çözülmüş, `npm test` tamamen geçiyor, D2'nin eski şema denemesi başarılı.

DÖNÜŞ: En fazla 12 satır: D1-D11 her biri için tek kısa ifade (yapıldı / nasıl), D2 deneme sonucu, test sonucu (geçen/kalan), açık kalan. Kod dökümü yapıştırma.
