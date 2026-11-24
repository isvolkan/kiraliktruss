# Kiralık Truss v6 — düzeltme ÖNCESİ ölçümler (2026-11-23)

Araç: Chrome headless (`--headless=new`, CDP, Node 26 betiği) + curl/fetch. Sunucu: http://localhost:3000 (var olan). Makinece okunur karşılığı: `olcumler.json` (madde no → değer). Ekran görüntüsü: 26 PNG.
Not: çalışma detayı yolu `/v6/calismalar/<id>` (ilk id = 96); `/v6/calisma/<id>` 404 verir.

| # | Ölçüm | Değer | Kanıt |
|---|---|---|---|
| 1 | `GET /v6/calismalar?q=a&q=b` | **HTTP 500** (`?q=a` tek değer: 200). Neden: `routes/site.js:44` `q` dizi olunca `q.trim` yok | curl çıktısı (bu dosya); `olcumler.json` "1" |
| 2 | 375 px üst çubuk: `.ust-teklif` ve `.ust-tel` | ikisi de `display:none` (/v6 ve /v6/calismalar). CSS: `public/v6/css/v6.css:190-191` (teklif ≥768, tel ≥1024) | `m02-ust-cubuk-375-v6.png`, `m02-ust-cubuk-375-v6-calismalar.png`, `m02-ilk-ekran-375-v6.png`, `m02-ilk-ekran-375-v6-calismalar.png` |
| 3 | Koyu tema, boş POST /v6/teklif, hata rengi `#B3261E` | zemin `#0E1013` üstünde **2.91:1**, yüzey `#171A1F` üstünde **2.67:1** (AA eşiği 4.5). Açık temada 6.54:1. 7 hata satırı. `--hata` koyu temada yeniden tanımlı değil (`v6.css:14,37-47,305-306,656-660`) | `m03-koyu-bos-post-1280.png`, `m03-koyu-bos-post-375.png` |
| 4 | KVKK aydınlatma metni | **yok**. Onay kutusu metninde bağlantı 0, sayfada kvkk/gizlilik/aydınlatma bağlantısı 0. Denenen 8 URL (`/v6/kvkk`, `/v6/gizlilik`, `/v6/aydinlatma`, `/v6/kvkk-aydinlatma`, `/kvkk`, `/gizlilik`, `/v6/aydinlatma-metni`, `/v6/gizlilik-politikasi`) hepsi **404** | `m04-kvkk-onay-kutusu-1280.png`, `m04-kvkk-onay-kutusu-375.png` |
| 5 | Sayfa ağırlığı (HTML'deki img src/data-src) | **/v6**: 19 görsel isteği, toplam **3 583 371 bayt (≈3.42 MB)**, HTML 21 431 B. **/v6/calismalar**: 25 istek, **4 741 019 bayt (≈4.52 MB)**, HTML 22 668 B. Tek görsel: proje fotoğrafları 1200×800 JPEG, örn. #96 = 286 885 B, #95 = 210 792 B; logo 166×72 PNG = 4 157 B. Tüm tekil görsel listesi `olcumler.json` "5" | `olcumler.json` |
| 6 | SEO | Tüm v6 sayfalarında (7 sayfa) **meta description aynı**: "Truss kiralıyoruz. Yaklaşık 1000 metretül…". `<title>` sayfaya özgü ("X · Kiralık Truss"). canonical **yok**, og: **yok**, application/ld+json **yok**. `/robots.txt` **404**, `/sitemap.xml` **404**. `X-Robots-Tag: noindex, nofollow` var (SITE_DEMO=true) | `olcumler.json` "6" (sayfa başına başlık/açıklama) |
| 7 | Kök `/` eski tasarım, `/v6` yeni | `/` → `/css/site.css` (+ Big Shoulders/Inter Tight/IBM Plex Mono); `/v6` → `/v6/css/v6.css`, `sayfa.css` (Barlow) | `m07-kok-eski-tasarim-1280.png`, `g01-v6-1280.png` |
| 8 | Yönetim paneli (1280) | Eski kök tasarımda (site.css, koyu lacivert). **CSRF jetonu yok**: giriş 1 form, pano 1, projeler 98 (97 POST), düzenleme 2, teklifler 1; hiçbirinde gizli alan/`csrf`/`_token` yok | `m08-yonetim-1-giris-1280.png`, `m08-yonetim-2-pano-1280.png`, `m08-yonetim-3-projeler-1280.png`, `m08-yonetim-4-proje-duzenle-1280.png`, `m08-yonetim-5-teklifler-1280.png` |
| 9 | Yükleme yalnız mimetype kontrolü | `routes/yonetim.js:16-17` (fileFilter, `file.mimetype` listesi); mimetype aynen saklanır: `:98`, `:126`. İçerik/imza doğrulaması yok | kod satırları |
| 10 | `throw err` | `routes/yonetim.js:50` (session.regenerate geri çağrısı) | kod satırı |
| 11 | Teklif gelince bildirim | yok: `routes/site.js:122-127` INSERT sonrası yalnız redirect (e-posta/bildirim çağrısı yok) | kod satırı |
| 12 | Erişilebilirlik | `views/v6/teklif.ejs:38, 65, 84` legend içinde `<h2>`; `views/v6/hakkimizda.ejs:25` figcaption `aria-live="polite"` (dönen slayt) | kod satırı |
| 13 | `npm test` | **84 test, 84 geçti, 0 kaldı**, 0 atlanan, 1854 ms | komut çıktısı |

## Genel ekran görüntüleri (açık tema, tam sayfa, en çok 6000 px)
1280: `g01-v6-1280.png`, `g02-v6-calismalar-1280.png`, `g03-v6-calisma-96-1280.png`, `g04-v6-hakkimizda-1280.png`, `g05-v6-iletisim-1280.png`, `g06-v6-teklif-1280.png`
375: `g07-v6-375.png`, `g08-v6-calismalar-375.png`, `g09-v6-calisma-96-375.png`, `g10-v6-hakkimizda-375.png`, `g11-v6-iletisim-375.png`, `g12-v6-teklif-375.png`

## Sonrası için tekrar komutu
Betikler geçici klasördedir; aynı yöntem: Chrome `--headless=new --remote-debugging-port` + CDP `Emulation.setDeviceMetricsOverride` (1280×800 / 375×812 mobil) + `Page.captureScreenshot`; koyu tema `localStorage['v6-tema']='koyu'`; sayılar curl/fetch ile.
