AMAÇ: Ana sitenin (v6 tasarımı, artık kök "/") ön yüz hatalarını düzelt: KVKK sayfası, mobil teklif/arama düğmesi, koyu tema kontrastı, erişilebilirlik hataları, sayfaya özel SEO etiketleri, görsel yükleme davranışı.

BAĞLAM:
- Proje: C:\Users\Serkan\ProjeWEB (Express 5 + EJS). Sunucu 3000'de çalışıyor (node --watch); başlatma/durdurma. Ziyaretçi görünümleri views/*.ejs ve views/parca/*, stil public/css/ altındaki v6 ana CSS'i, JS public/js/. Bulgular: docs/ai/review-v6-bulgular.md — senin işin H1 (görünüm), H4 (ön yüz), H5 (ön yüz), H8, H9, H10, H11.
- Ders projesi, teslim 25 Kasım 2026. Mevcut tasarım dilini (renkler, yazı tipi, "yön tabelası" dili) koru; yeni görsel stil icat etme. Kütüphane ekleme. Kısa Türkçe yorum.
- PARALEL İŞÇİLER VAR. Sözleşmeler (başka işçi sağlıyor):
  * GET /kvkk rotası `res.render('kvkk', { baslik: 'KVKK Aydınlatma Metni' })` — sen views/kvkk.ejs yaz.
  * res.locals.siteUrl (sonda / yok) ve res.locals.yol (req.path) her ziyaretçi sayfasında tanımlı. Tanımsız olabileceğini varsay (typeof kontrolü) ve o zaman canonical/og:url basma.
  * Görsel adresleri: `/gorsel/:id` (tam, ≤1600 px WebP) ve `/gorsel/:id?boy=kucuk` (≤600 px).
  * routes/, lib/, db/, app.js, views/yonetim/, public/css/yonetim.css başka işçilerde — DOKUNMA. config/firma.js'i yalnız oku.

YAPILACAKLAR:
1. H1: views/kvkk.ejs — 6698 sayılı KVKK'ya uygun aydınlatma metni: veri sorumlusu (config/firma.js'teki firma adı, adres, e-posta), işlenen veriler (teklif formundaki alanlar), amaç (teklif hazırlama ve iletişim), hukuki sebep (sözleşmenin kurulması, açık rıza gereken yerde rıza), aktarım (yurt dışı barındırma/veritabanı hizmeti — genel ifade), saklama süresi (makul, ör. 2 yıl), ilgili kişinin hakları (KVKK m.11), başvuru yolu. Üstte "Bu metin müşteri tarafından gözden geçirilmelidir" diye görünür olmayan bir yorum (HTML yorumu) bırak. Teklif formundaki onay kutusu metnini "<a href="/kvkk">KVKK Aydınlatma Metni</a>'ni okudum, kişisel verilerimin teklif hazırlanması amacıyla işlenmesini kabul ediyorum." biçimine getir (yeni sekmede açılsın, rel="noopener"). Alt bilgiye (footer) KVKK bağlantısı ekle.
2. H8: 768 px altında kalıcı, erişilebilir bir eylem: ekranın altında sabit ince çubuk ya da üst çubukta ikon düğmeler — "Ara" (tel:) ve "Teklif iste". Teklif sayfasındayken teklif düğmesi gizlensin. İçeriği örtmesin (body alt boşluğu), iOS güvenli alan (env(safe-area-inset-bottom)). Daha önce kaldırılmış bir "alt-cubuk" vardı ve "Etkinlik" yazısını kesiyordu — o hatayı tekrarlama; test/site.test.js'te alt-cubuk ile ilgili bir yasak testi varsa testi yeni çözüme göre mantıklı biçimde güncelle ve dönüşte belirt.
3. H9: koyu temada --hata rengini AA (≥4.5:1, hem zemin hem yüzey rengi üstünde) sağlayan bir tonla yeniden tanımla; aynı kontrolü --basari/uyarı gibi durum renkleri varsa onlar için de yap. Oranları hesapla ve dönüşte yaz.
4. H10: teklif.ejs'te legend içindeki h2'leri kaldır: legend'ı başlık görünümünde stillendir (görsel değişmesin).
5. H11: hakkimizda.ejs otomatik slayt: aria-live kaldır (ya da yalnız kullanıcı etkileşiminde polite), görünür Duraklat/Oynat düğmesi (aria-pressed), odak/hover'da dur, prefers-reduced-motion'da otomatik dönme yok.
6. H5 ön yüz: her sayfa kendi meta description'ını versin (anasayfa, çalışmalar — süzgeçliyse süzgeci yansıtsın, çalışma detayı — projeye özel, hakkımızda, iletişim, teklif, kvkk). Ortak baş parçasında (views/parca/ içindeki head) canonical, Open Graph (og:title, og:description, og:url, og:image — detayda proje görseli, diğerlerinde logo/hero), twitter:card; ana sayfada ve iletişimde LocalBusiness JSON-LD (config/firma.js'ten ad, telefon, adres, e-posta, url). JSON-LD'yi `<%- JSON.stringify(...) %>` ile bas ama `<` karakterini \u003c'ye çevir (XSS).
7. H4 ön yüz: kartlarda ve şeritte küçük boyu kullan: `src="/gorsel/ID?boy=kucuk"` + `srcset="/gorsel/ID?boy=kucuk 600w, /gorsel/ID 1600w"` + uygun `sizes`; width/height öznitelikleri (CLS); ana sayfa şeridinde yalnız ilk 4 görsel eager, gerisi lazy; hero'nun ilk görseli fetchpriority=high kalsın. Çalışma detayı büyük görselde tam boy.
8. Testleri güncelle/ekle (test/site.test.js ya da test/onyuz.test.js): /kvkk 200 ve teklif formunda /kvkk bağlantısı; sayfa description'ları birbirinden farklı; canonical ve og etiketleri (siteUrl tanımlıysa); JSON-LD ana sayfada ve JSON.parse ile ayrışıyor; legend içinde h2 yok; hakkımızda'da aria-live otomatik slaytta yok ve duraklat düğmesi var; mobil eylem çubuğu işaretlemesi var.

KAPSAM: views/*.ejs ve views/parca/* (yonetim hariç), public/css/ (yonetim.css hariç), public/js/ (yonetim.js hariç), test/site.test.js veya yeni test/onyuz.test.js. git commit/push yapma. Paket kurma.

KABUL ÖLÇÜTÜ: `npm test` geçiyor (başka işçinin testi kırıksa hangisi olduğunu yaz); 375 px'te teklif/ara düğmesi görünür; koyu tema hata rengi ≥4.5:1.

DÖNÜŞ: En fazla 12 satır: her H maddesi için ne yapıldı, kontrast oranları, değişen dosyalar, test sonucu, emin olmadığın şey. Kod dökümü yapıştırma.

NOT (Faz 1 sonrası gerçek yollar): ana CSS = public/css/site.css, ana JS = public/js/site.js, ortak parçalar views/parca/. Yönetim geçici olarak views/partials/ust.ejs, alt.ejs ve public/css/yonetim-eski.css, public/js/yonetim-eski.js, public/js/yonetim-tema.js kullanıyor (yönetim işçisi bunları yenisiyle değiştirip arsiv/e taşır). Teşekkür sayfası /teklif/tesekkurler. Ziyaretçi testleri test/site.test.js.
