AMAÇ: Canlı sitede (https://kiraliktruss.onrender.com) gerçek bir ziyaretçi gibi, gerçek tarayıcıyla 20 teklif talebi oluştur ve yaşadığın olumlu/olumsuz deneyimleri dürüstçe raporla.

BAĞLAM:
- Kiralık Truss: truss/sahne kiralama firması (İstanbul). Site: Express + EJS, Render ücretsiz (Frankfurt) + Neon. Ziyaretçi akışı: ana sayfada 3 soruluk mini form → /teklif (3 adımlı form: Etkinlik / Ölçü / İletişim, KVKK onay kutusu) → /teklif/tesekkurler. Proje detayında (/calismalar/<id>) "Bu işi örnek göstererek teklif iste" bağlantısı formu ön dolduruyor. Mobilde altta sabit "Ara / Teklif iste" çubuğu var. Koyu tema düğmesi var.
- Spam koruması: aynı IP'den 15 dakikada en fazla 5 teklif (sonrası 429). Bu sınıra takılmak beklenen bir şey; ne gördüğünü kaydet (mesaj anlaşılır mı, girilen bilgiler korunuyor mu), sonra pencere açılana kadar bekleyip devam et. 20 teklifi tamamla (toplam ~1 saat sürebilir; uzun bekleme için betik içinde bekle).
- Bu yöntem kullanıcı tarafından istendi; gönderilen veriler TEST verisidir.

TEST VERİSİ KURALI (kesin): Ad soyad "TEST <rastgele Türkçe ad soyad>" (ör. "TEST Ayşe Kaya"), e-posta test+<n>@example.com, telefon 0500 000 00 <iki hane>. Firma adı varsa "TEST Firma <n>". Gerçek kişi/şirket bilgisi KULLANMA. Not alanında "Otomatik kullanıcı testi #<n>" geçsin.

YÖNTEM: Gerçek tarayıcıyı programla sür (Chrome/Edge headless + CDP ya da Puppeteer benzeri; proje dışında geçici klasörde betik — paket kurman gerekiyorsa geçici klasöre kur, projeye kurma). Bir insan gibi: sayfayı aç, alanlara tıkla, yaz (karakter karakter), select'ten seç, tarih gir, onay kutusunu işaretle, düğmeye bas. JS ile form.submit() ya da doğrudan POST YASAK (gerçek deneyim değil). Her teklif için süreleri ölç (sayfa açılışı, gönderme → teşekkür sayfası).

SENARYO DAĞILIMI (20 teklif):
- 12 tanesi telefon ekranında (375×812, mobil kullanıcı ajanı, dokunma), 8 tanesi masaüstü (1366×768).
- 6 tanesi ana sayfadaki mini formdan başlayıp devam etsin; 5 tanesi bir proje detay sayfasından "örnek göstererek teklif iste" ile; 4 tanesi mobil alt çubuktaki "Teklif iste"den; 5 tanesi doğrudan /teklif.
- En az 5 tanesinde önce bir hata yap (yanlış telefon biçimi, eksik e-posta, KVKK işaretsiz, geçmiş tarih, boş şehir), hata gösterimini değerlendir (hata alanın altında mı, anlaşılır mı, ilk hatalı alana odaklanıyor mu, girilen değerler korunuyor mu), sonra düzeltip gönder.
- 3 tanesi koyu temada.
- Etkinlik türlerini, şehirleri, tarihleri (gelecekte), gün sayılarını, ölçüleri çeşitlendir.
- Her teklifin sonunda teşekkür sayfasının ekran görüntüsünü ALMA (yalnız ilk mobil ve ilk masaüstü teklifte al); hata ekranlarından ve 429 ekranından birer görüntü al. Görüntüleri C:\Users\Serkan\ProjeWEB\docs\karsilastirma\kullanici-testi\ altına kaydet.

DEĞERLENDİR (insan gözüyle): formun uzunluğu ve anlaşılırlığı, alan etiketleri, klavye türleri (tel/e-posta/tarih — mobilde inputmode/type doğru mu), dokunma hedeflerinin büyüklüğü, alt çubuğun formu örtüp örtmediği, ön doldurmanın doğruluğu, teşekkür sayfasının içeriği (sonraki adım net mi), hız, çökme/500, konsol hataları, tutarsız metinler, Türkçe hatalar.

KAPSAM: Yalnız canlı site üzerinde ziyaretçi işlemleri + docs/karsilastirma/kullanici-testi/ klasörüne yazma. Kod/dosya değiştirme. Yönetim paneline girme. git yok.

DÖNÜŞ (Türkçe, en fazla 25 satır): kaç teklif başarıyla gönderildi (hedef 20), kaç kez 429'a takıldın ve o deneyim nasıldı, ortalama süreler (mobil / masaüstü), OLUMLU deneyimler (madde madde, somut), OLUMSUZ deneyimler (önem sırasıyla, her biri somut sayfa/adım + önerilen düzeltme tek cümle), hata ekranı değerlendirmesi, görüntü klasörü. Abartma, yumuşatma — dürüst ol.
