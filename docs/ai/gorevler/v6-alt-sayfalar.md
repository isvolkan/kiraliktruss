AMAÇ: Kiralık Truss sitesinin v6 tasarımında Çalışmalar, Hakkımızda ve İletişim sayfalarını kullanıcı isteklerine göre değiştir.

BAĞLAM:
- Proje: C:\Users\Serkan\ProjeWEB (Express + EJS + PostgreSQL). v6 görünümleri views/v6, varlıklar public/v6, rota routes/v6.js. Sunucu çalışıyor olabilir: http://localhost:3000/v6 (node --watch server.js). Çalışmıyorsa `node server.js` ile kendin başlatabilirsin, işin bitince kapat.
- Ortak CSS public/v6/css/v6.css ve ortak JS public/v6/js/v6.js ŞEF tarafından eşzamanlı düzenleniyor: ONLARA DOKUNMA. Senin yazacağın stiller yeni dosya public/v6/css/sayfa.css'e, JS yeni dosya public/v6/js/sayfa.js'e gidecek. Şef bu iki dosyayı views/v6/parca/bas.ejs'e zaten bağladı (sayfa.css v6.css'ten sonra, sayfa.js defer). Dosyalar boş olarak mevcut.
- Şef aynı anda şunları yapıyor: üst çubuk (header.ust) artık position: sticky; top:0 — yüksekliği CSS değişkeni --ust-h (v6.css :root). Karanlık mod: html[data-tema="koyu"] altında renk değişkenleri (--alu, --beyaz, --murekkep, --gri, --cizgi, --mavi ...) yeniden tanımlanıyor. Bu yüzden sayfa.css'te SABİT RENK YAZMA, yalnız bu değişkenleri kullan. Hesaplayıcı siteden kaldırılıyor: senin dosyalarındaki "#hesapla" bağlantılarını kaldır (iletisim.ejs yonler listesindeki "Kaç metretül gerektiğini bilmiyorum" satırı, hakkimizda.ejs'deki "Kaç metretül gerekir?" düğmesi).
- Mevcut animasyon dili: v6.css'teki --egri (cubic-bezier(.2,.7,.2,1)), "yukselen" sınıfı (maskeden yükselen satır), başlık fontu var(--baslik) Barlow Condensed. html.js sınıfı JS varsa ekleniyor (erken.js). prefers-reduced-motion'a saygı göster.
- Erişilebilirlik ve JS'siz çalışma korunmalı (JS yoksa başlık normal görünsün).

İSTENENLER:
1) Çalışmalar (views/v6/calismalar.ejs), Hakkımızda (hakkimizda.ejs), İletişim (iletisim.ejs) sayfalarında bizi karşılayan büyük h1 başlık:
   a) Açılışta yazı animasyonuyla gelsin (ör. harf harf / kelime kelime maskeden yükselme; ekran okuyucu bütün metni tek parça okusun: aria-label ya da gizli metin + aria-hidden harfler).
   b) Aşağı kaydırdıkça bu başlık küçülerek ekranın EN SOLUNA gitsin ve sayfada hangi bölümde olduğumuzu gösteren küçük bir etiket olarak yapışık (sticky) kalsın; header'ın hemen altında (top: var(--ust-h)). Geçiş kaydırmaya bağlı ve akıcı olsun (scroll'a bağlı transform/scale; layout tetikleyen özellikleri her karede değiştirme; requestAnimationFrame ile, passive scroll dinleyici). Yukarı çıkınca geri büyüsün.
   Bunu üç sayfada ortak yap: bir sınıf/attribute (ör. <h1 class="sayfa-baslik" data-sayfa-baslik>) + sayfa.js/sayfa.css.
2) Çalışmalar sayfasında sayfalama (Önceki/Sonraki), tür levhaları, ızgara/liste bağlantıları ve süzgeç formu gönderilince sayfa en üste atmasın; filtre bölümünden (tür levhaları + süzgeç + ızgara) devam etsin. En basit sağlam yol: süzgeç formuna id (ör. id="suzgec") ver, adres() fonksiyonunun ürettiği bağlantılara ve form action'ına "#suzgec" ekle; scroll-margin-top ile sticky header (ve yapışık küçük başlık) altında kalmasın. Sayfanın tepesinde açılış animasyonu tekrar oynamasın gerekmez ama hash'li gelişte başlık zaten küçük durumda olmalı (scroll konumundan hesaplandığı için kendiliğinden olur).
   Şehir/yıl select değişince form kendiliğinden gönderiliyor (v6.js suzgec(), form.requestSubmit) — action'a hash eklemen yeterli.
3) İletişim sayfası çok uzun/büyük: tüm sayfa masaüstünde TEK EKRANDA (100svh - header) karşılasın: başlık + telefon + adres/eposta künyesi + yönler (teklif / çalışmalar / e-posta) + harita yan yana sığacak sade bir yerleşim. Telefonda alt alta akabilir.
   Harita OpenStreetMap yerine Google Maps gömme olsun (API anahtarı gerektirmeyen biçim): https://www.google.com/maps?q=<lat>,<lon>&z=16&output=embed  — lat/lon config/firma.js'te firma.harita. "Haritadaki konum yaklaşıktır" notu kalabilir. Google Maps'te açmak için ayrıca bir bağlantı ekle (https://www.google.com/maps/search/?api=1&query=lat,lon), target=_blank rel=noopener.
   Eğer app.js / bir middleware'de Content-Security-Policy (helmet) varsa frame-src'ye https://www.google.com eklenmesi gerekir: şef app.js frame-src.ye google.com.u zaten ekledi.

KAPSAM: Yalnız views/v6/calismalar.ejs, views/v6/hakkimizda.ejs, views/v6/iletisim.ejs, public/v6/css/sayfa.css, public/v6/js/sayfa.js. Gerekirse test/v6.test.js'e yeni test EKLEyebilirsin (mevcut testleri silme). Diğer dosyalara dokunma, git commit yapma.

KABUL ÖLÇÜTÜ: Üç sayfada başlık animasyonla gelir, kaydırınca küçülüp sola yapışır, geri çıkınca büyür; Çalışmalar'da sayfa 2'ye geçince ya da süzgeç uygulanınca ekran süzgeç bölümünden açılır; İletişim 1440x900 masaüstünde kaydırmadan bütünüyle görünür ve Google Maps haritası yüklenir; konsolda hata yok; testler geçer.
TEST: cd C:\Users\Serkan\ProjeWEB && npm test   (DB gerekiyorsa .env hazır). Ayrıca tarayıcı yoksa en azından curl ile sayfaların 200 döndüğünü kontrol et.

DÖNÜŞ: En fazla 10 satırlık özet ver: ne yaptın, hangi dosyalar değişti, test sonucu, açık kalan/emin olmadığın şey (özellikle CSP). Kod veya dosya dökümü yapıştırma.
