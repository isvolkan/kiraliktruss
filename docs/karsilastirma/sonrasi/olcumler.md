# Kiralık Truss — düzeltme SONRASI ölçümler (2026-11-24)

Araç: Chrome headless (`--headless=new`, CDP, Node betiği) + fetch/curl + `npm test`; öncesiyle aynı yöntem. Sunucu: http://localhost:3000. Makinece okunur karşılığı: `olcumler.json`. Ekran görüntüsü: 39 PNG. Adresler artık öneksiz (`/v6/x` yerine `/x`); çalışma detayı `/calismalar/96`.
Öncesi: `../oncesi/olcumler.md`.

| # | Ölçüm | ÖNCE | SONRA | Kanıt |
|---|---|---|---|---|
| 1 | `GET /calismalar?q=a&q=b` | HTTP 500 | **HTTP 200**. Ayrıca `?tur=a&tur=b`, `?sayfa=1&sayfa=2`, `?q[]=a`, `?q[x]=1` hepsi 200 | komut-ciktilari.txt |
| 2 | 375 px üst çubuk Teklif/Tel | ikisi `display:none`, mobilde eylem yok | Üst çubuktaki ikisi **hâlâ gizli** (bilerek); alta sabit **mobil eylem çubuğu** geldi: "Ara" ve "Teklif iste" görünür (y=751, 375×61; düğmeler 44 px yüksek). `/` ve `/calismalar` ikisinde de | m02-eylem-cubugu-375.png, m02-ilk-ekran-375-*.png |
| 3 | Koyu tema hata rengi kontrastı | #B3261E: zemin 2,91:1, yüzey **2,67:1** | #FF7B72: zemin **7.56:1**, yüzey **6.92:1** (AA 4,5). 7 hata satırı. Açık tema 6,54:1 (değişmedi, yeniden ölçülmedi) | m03-koyu-bos-post-*.png |
| 4 | KVKK aydınlatma | sayfa yok (8 URL 404); onay metninde bağlantı 0 | `/kvkk` **HTTP 200** ("KVKK Aydınlatma Metni"); onay metninde bağlantı 1 (/kvkk); eski `/v6/kvkk` → 301 → `/kvkk`; `/gizlilik`, `/aydinlatma` hâlâ 404 (gerek yok) | m04-*.png, g13-kvkk-*.png |
| 5a | **/** görsel yükü | 19 istek, **3,42 MB** (3 583 371 B) | ilk yükleme 16 istek, **0,79 MB** (830063 B); tümü kaydırınca aynı (16 istek, 830063 B). 375 px: aynı sayı. `<img>` etiketi 44 (12 eager, 32 lazy; 36 srcset'li; tekrarlar aynı URL) | agirlik (json 5) |
| 5b | **/calismalar** görsel yükü | 25 istek, **4,52 MB** (4 741 019 B) | 1280 px ilk yükleme: 21 istek **0,77 MB**; 375 px ilk yükleme: 6 istek **0,21 MB**; tüm görseller (kaydırınca) 25 istek **0,92 MB** (966670 B); en büyük tek görsel 61237 B | json 5 |
| 5c | Tek görsel #96 | JPEG 1200×800, 286 885 B | `/gorsel/96` WebP 196042 B; `?boy=kucuk` WebP 60206 B. Önbellek: sürümsüz `no-cache` + ETag (koşullu istek curl ile 304); `?v=` ile `public, max-age=31536000, immutable` | komut-ciktilari.txt |
| 6 | SEO | 7 sayfada aynı description; canonical/og/ld+json yok; robots.txt ve sitemap.xml 404 | description benzersiz: **7 / 7 (200 donen sayfa)**. 200 dönen sayfalarda canonical var, og 7 etiket; ld+json (LocalBusiness) yalnız `/` ve `/iletisim`'de; 404 sayfasında canonical yok, `noindex`. `/robots.txt` **200** (`User-agent: *` + `Disallow: /`, çünkü SITE_DEMO=true); `/sitemap.xml` **200** (102 URL). `X-Robots-Tag: noindex, nofollow` ve `<meta robots noindex>` hâlâ var (SITE_DEMO) | json 6 |
| 7 | Kök / | eski tasarım (site.css, Big Shoulders) | kök = v6 tasarımı (/css/site.css, /css/sayfa.css); `/v6/*` → 301 öneksiz | m07-kok-eski-tasarim-1280.png (ad aynı, içerik yeni) |
| 8 | Yönetim CSRF | form 1/1/98/2/1, gizli alan **0** | Her POST formunda `_csrf` var: giriş 1/1, pano 1/1, projeler 21/21, düzenle 3/3, teklifler 1/1, teklif detayı 4/4, hesap 2/2 (jetonlu/POST formu). **CSRF'siz POST → 403** (girişli, `/yonetim/projeler/96`); CSRF'siz giriş POST → 403; yanlış jetonla silme → 403. Tasarım: yeni (yonetim.css) | m08-*.png |
| 9 | Yükleme doğrulaması | yalnız istemci mimetype'ı | içeriği düz metin olan **sahte .jpg (image/jpeg) → HTTP 422**, "Yalnız JPEG, PNG ya da WebP fotoğraf yüklenebilir; dosyanın içeriği fotoğraf değil."; proje sayısı değişmedi (20 → 20) | komut-ciktilari.txt |
| 10 | `throw err` | routes/yonetim.js:50 | yönetim.js ve lib/ içinde `throw err` **yok** (grep) | komut-ciktilari.txt |
| 11 | Teklif bildirimi | yok | routes/site.js:286 `bildirim.yeniTeklif`; yönetimde okunmamış rozeti. **SMTP ile gerçek e-posta canlı denenmedi (ölçülmedi)** | kod satırı |
| 12 | Erişilebilirlik | legend içinde h2 ×3; slayt `aria-live=polite` her zaman | legend içinde `<span>` (h2 yok); `aria-live` yalnız elle gezinirken; Duraklat düğmesi var | kod satırı |
| 13 | `npm test` | 84 test, 84 geçti | **73 test, 73 geçti, 0 kaldı**, 0 atlanan, 2847 ms. Sayı düşük: test dosyaları baştan yazıldı (eski testler arsiv'e), 84 ile 73 doğrudan karşılaştırılamaz. TEST_DATABASE_URL .env'de tanımlı değil → geliştirme DB'sinde koştu | test-cikti (komut-ciktilari.txt) |

## Ek görüntüler (öncesinde yok)
`g13-kvkk-1280/375`, `m02-eylem-cubugu-375`, `m08-yonetim-6-teklif-detay-*`, `m08-yonetim-7-hesap-*`, `m08-yonetim-2-pano-koyu-1280`, yönetim 375 px takımı (`m08-yonetim-*-375`).

## Notlar
- Görsel baytları ağdaki sıkıştırılmış yük (encodedDataLength); önbellek kapalı, tek koşu. Ana sayfada 5 `<img>` kırık görünür ama bunlar `src`'siz gizli önizleme öğeleridir (istek yok, 4xx yok).
- Sayfa görüntüleri en çok 6000 px yükseklikte kesilir; lazy görseller yüklensin diye önce sayfa kaydırılır.
- Yönetim görüntüleri geliştirme veritabanındaki örnek verilerle alındı (teklif #150 test kaydı).
