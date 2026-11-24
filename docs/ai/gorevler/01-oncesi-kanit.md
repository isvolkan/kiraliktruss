AMAÇ: Kiralık Truss sitesinin v6 sürümünün düzeltme ÖNCESİ durumunu kanıtlarıyla kayda geçir (sonra "öncesi / sonrası" karşılaştırması yapılacak).

BAĞLAM:
- Proje: C:\Users\Serkan\ProjeWEB (Express 5 + EJS + PostgreSQL). Sunucu zaten çalışıyor: http://localhost:3000 (v6 = /v6, yönetim = /yonetim). Sunucuyu durdurma/yeniden başlatma; yeni sunucu açma.
- Yönetim girişi için test hesabı: .env ve db/ altındaki seed betiğinde (ADMIN_EMAIL) tanımlı; şifreyi seed/örnek ayar dosyasından bul. Şifreyi hiçbir rapora yazma.
- Daha önce ekran görüntüsü alınmış: docs/ekran-v6-tur4/ — hangi araçla alındıysa (dev/ klasörüne, package.json'a bak; yoksa Edge/Chrome headless `--screenshot --window-size=...` kullan) aynısını kullan.
- Kayda geçirilecek bulgular (her biri için kanıt: ekran görüntüsü ya da komut çıktısı):
  1. GET /v6/calismalar?q=a&q=b → HTTP 500
  2. Mobil (375 px) üst çubukta "Teklif iste" ve telefon görünmüyor (/v6 ve /v6/calismalar, 375x812 ekran görüntüsü)
  3. Koyu temada teklif formu hata mesajlarının düşük kontrastı (/v6/teklif'e boş POST at, koyu temada ekran görüntüsü; koyu tema nasıl açılıyorsa — çerez/localStorage/data-tema — ona göre. Kontrast oranını CSS renklerinden hesapla)
  4. KVKK aydınlatma metni sayfasının olmaması (teklif formundaki onay kutusunun ekran görüntüsü + ilgili URL denemelerinin 404'ü)
  5. Sayfa ağırlığı: /v6 ve /v6/calismalar için toplam görsel bayt sayısı ve görsel isteği adedi (HTML'deki img/data-src URL'lerini curl ile çekip topla), tek görsel boyutları
  6. SEO: her v6 sayfasının <title> ve meta description'ı (aynı mı?), canonical/og:/application/ld+json var mı, /robots.txt ve /sitemap.xml HTTP kodu, X-Robots-Tag başlığı
  7. Kök "/" adresinin eski tasarımı açtığı (1280 ekran görüntüsü) ve /v6'nın yeni tasarım olduğu
  8. Yönetim paneli: giriş sayfası, panel ana sayfası, proje listesi, proje düzenleme, teklif listesi ekran görüntüleri (1280 px) — eski kök tasarımda olduğunu göster; formlarda CSRF jetonu olmadığını HTML'den göster
  9. Yüklemede yalnız mimetype kontrolü: routes/yonetim.js ilgili satırlar (dosya:satır yaz, kodu kopyalama)
  10. routes/yonetim.js'deki `throw err` (dosya:satır)
  11. Teklif gelince bildirim olmaması (routes/site.js ilgili satır)
  12. views/v6/teklif.ejs legend içinde h2; views/v6/hakkimizda.ejs aria-live slayt (dosya:satır)
  13. `npm test` sonucu (geçen/kalan sayısı). Testler geliştirme veritabanına yazıp siliyor; bu kabul edildi, çalıştırabilirsin.
- Ayrıca 1280 ve 375 px'te şu sayfaların genel ekran görüntüsü: /v6, /v6/calismalar, /v6/calisma/<ilk id>, /v6/hakkimizda, /v6/iletisim, /v6/teklif.

KAPSAM: Yalnız docs/karsilastirma/oncesi/ klasörüne yaz (ekran görüntüleri PNG/JPG + olcumler.md + olcumler.json). Başka hiçbir dosyayı değiştirme. Veritabanına test dışında yazma (teklif formunu geçerli değerle gönderme; boş/geçersiz POST serbest).

KABUL ÖLÇÜTÜ: docs/karsilastirma/oncesi/olcumler.md içinde 13 maddenin her biri numarasıyla, ölçülen değer ve kanıt dosyası adıyla yer alıyor; olcumler.json aynı ölçümleri makinece okunur biçimde (madde no → değer) tutuyor; ekran görüntüleri açılabiliyor.

DÖNÜŞ: En fazla 12 satır: kaç ekran görüntüsü alındı, hangi araçla (sonra aynı araçla "sonrası" alınacak — komutu tek satırda yaz), 13 maddenin kısa ölçüm değerleri, test sonucu. Dosya dökümü yapıştırma.
