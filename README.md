# Kiralık Truss — web sitesi yenileme

BİLP2135 Web ve İnternet Programcılığı II, gerçek müşteri projesi.
Müşteri: **Kiralık Truss** (Hakan Bey, Beylikdüzü / İstanbul). Eski site: kiraliktruss.com (2013 tarzı jQuery, ana sayfa kaydırıcısı boş).

## Ne yapıldı

| Eski site | Yeni site |
|---|---|
| 4 statik sayfa, çalışmayan kaydırıcı | Node.js + Express dinamik site, PostgreSQL veritabanı |
| 96 proje 8 sayfaya dağılmış, arama yok | Yıl / şehir / tür süzgeci, arama, ızgara ve liste görünümü |
| Teklif için yalnız e-posta adresi | Doğrulamalı teklif formu, talepler veritabanında, yönetim panelinde takip, yeni tekliflerde e-posta bildirimi |
| İçeriği güncellemek için geliştirici gerekir | Yönetim paneli: proje ekle / düzenle / sil (fotoğraflı), teklif takibi, şifre değiştirme |
| Mobilde bozuk | Telefon, tablet ve masaüstü uyumlu; açık / koyu tema |
| Fotoğraflar ham, ağır | Yüklenen fotoğraf tam (≤1600 px) ve küçük (≤600 px) WebP'ye çevrilir; listelerde küçük boy + srcset |
| KVKK metni yok | KVKK aydınlatma metni (`/kvkk`), teklif formunda onay kutusu |
| Arama motoru ayarı yok | canonical, Open Graph, JSON-LD (yerel işletme), `robots.txt`, `sitemap.xml` |
| — | Metretül hesaplayıcı: **v6'da şimdilik kaldırıldı** (kod `views/parca/hesaplayici.ejs`'te duruyor, sayfalara bağlı değil) |

## Yönergedeki şartlar nerede

- **Dinamik backend:** Express 5 (`app.js`, `routes/`)
- **Veritabanı:** PostgreSQL (`db/schema.sql` + göçler `db/goc/`), yerelde ayrı küme, canlıda Neon
- **CRUD 1 — Projeler:** `routes/yonetim.js` → `/yonetim/projeler` (ekle, listele, güncelle, sil; fotoğraf yükleme ve işleme `lib/gorsel.js`)
- **CRUD 2 — Teklifler:** ziyaretçi `/teklif` ile ekler; yönetici `/yonetim/teklifler`'de listeler, ayrıntısını açar (okundu işareti), durum ve not günceller, CSV indirir, siler
- **Form + doğrulama:** `validators/index.js` (express-validator, sunucu tarafında); hata mesajları alanın altında
- **Responsive:** `public/css/site.css` ve `public/css/sayfa.css` (mobil öncelikli); yönetim için `public/css/yonetim.css`
- **Ek değer:** oturum açma (bcrypt + oturum veritabanında), yönetim panosu, CSRF koruması (`lib/csrf.js`), arama / süzgeç, harita, istek sınırı, bal küpü (spam koruması), güvenlik başlıkları (helmet), e-posta bildirimi, SEO dosyaları

## Yönetim paneli (`/yonetim`)

- **Pano:** özet sayılar, yan menüde okunmamış teklif rozeti
- **Projeler:** ekle / düzenle / sil, fotoğraf yükleme (JPEG, PNG, WebP; dosya içeriği kontrol edilir), sayfalama
- **Teklifler:** liste (okunmamış önce), ayrıntı, durum (yeni / arandı / teklif verildi / kapandı), yönetici notu, "okunmadı" işareti, silme, **CSV dışa aktarma**
- **Hesap:** şifre değiştirme. Panelden değiştirilen şifre yeniden başlatmada korunur; `ADMIN_PASSWORD` yalnız hesap yokken ilk kurulumda kullanılır.
- **CSRF:** her POST formunda gizli `_csrf` jetonu; eksik / yanlışsa 403
- Yönetim sayfaları önbelleğe yazılmaz ve arama motorlarına kapalıdır.

## E-posta bildirimi

Yeni teklif gelince `lib/bildirim.js` yöneticiye e-posta atar. `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `BILDIRIM_EPOSTA` ve `SITE_URL` altısı da doluysa gider
(`SITE_URL` e-postadaki panel bağlantısı için gerekir); biri boşsa yalnız konsola tek satır yazılır. Gönderim hatası ziyaretçiyi etkilemez.

**Not:** Render ücretsiz planda giden SMTP portları (25 / 465 / 587) kapalı olabilir; o durumda e-posta gitmez, yönetim panelindeki okunmamış teklif rozeti yine çalışır.

## Fotoğraf hattı

Fotoğraflar veritabanında tutulur (ücretsiz sunucunun diski kalıcı değil). Yüklemede `sharp` ile tam boy (≤1600 px) ve küçük boy (≤600 px) WebP üretilir.
`/gorsel/:id` tam boyu, `/gorsel/:id?boy=kucuk` küçük boyu verir; ETag ile 304 döner. Ziyaretçi sayfaları adrese `v=<güncelleme zamanı>` ekler:
sürümlü adres bir yıl önbellekte kalır, fotoğraf değişince adres de değişir. Sürümsüz adres her seferinde ETag ile sorulur (`no-cache`).
Eski kayıtların küçük boyu ilk istekte üretilip kaydedilir; toplu işlem için `npm run gorseller`.
Yanıtlar ayrıca sunucu belleğinde önbelleğe alınır (`lib/gorsel-onbellek.js`, LRU, varsayılan 64 MB, `GORSEL_ONBELLEK_MB`); sürüm değişince ya da panelde fotoğraf güncellenip silinince kayıt geçersiz olur,
sürümsüz adreslerde en fazla 60 sn yaşlı olabilir. Veritabanı havuzu 10 bağlantıdır (`DB_HAVUZ_MAX`).

## Hız

Sunucu açılınca (dinlemeye başladıktan sonra, arka planda) görsel bellek önbelleği doldurulur: önce küçük boylar, sonra tam boylar, 10'arlı gruplarla; sınır aşılmaz, küçük boyu DB'de olmayan kayıtlar atlanır (rota ilk istekte üretir). Bitince tek satır log yazılır (`Görsel ısıtma: N görsel, X MB, Y ms`); `ISIT_GORSEL=false` kapatır, `NODE_ENV=test`'te çalışmaz. Isıtmadan sonra küçük boyu DB'de eksik kayıtlar arka planda tek tek (aralarda 50 ms nefesle) üretilip DB'ye ve önbelleğe yazılır, böylece hiçbir ziyaretçi anında üretimi beklemez.
Render ücretsiz servis 15 dk trafik yoksa uyur (uyanış ~50 sn). `.github/workflows/uyandir.yml` her 10 dakikada `/saglik` (DB'ye dokunmaz, `ok` döner) adresini çağırır; site adresi repo değişkeni `SITE_URL`, yoksa `https://kiraliktruss.onrender.com`. GitHub cron gecikebilir; daha güvenilir olsun istenirse cron-job.org ya da UptimeRobot ile `/saglik`'e 10 dk'da bir istek atılır.
Not: sürekli açık tutmak ücretsiz planın aylık 750 saatini tüketir (tek servis için ayı karşılar; ikinci bir servis açılırsa yetmez).

## KVKK, SEO

- `/kvkk` aydınlatma metni; teklif formu onay kutusu olmadan gönderilmez (`kvkk_onay` sütunu).
- Her sayfada canonical ve Open Graph; çalışma detayında paylaşım görseli proje fotoğrafı; JSON-LD `LocalBusiness`.
- `/robots.txt` ve `/sitemap.xml` dinamik üretilir (sitemap tüm çalışma detaylarını içerir). Hata sayfaları (404 / 500) `noindex`'tir.
- `SITE_DEMO=true` iken (önizleme) tüm site arama motorlarına kapalıdır; gerçek yayında `SITE_DEMO` kaldırılır ya da `false` yapılır.

## Klasörler

```
app.js              Express uygulaması (ara katmanlar, oturum, rotalar)
server.js           Sunucuyu başlatır (önce göçler, sonra dinleme)
config/firma.js     Firma bilgileri (tek yerde)
db/                 Bağlantı havuzu, şema (schema.sql), göç çalıştırıcı (goc.js) ve göçler (goc/*.sql), seed betiği, eski başlık ayrıştırıcı
lib/                bildirim.js (teklif e-postası), csrf.js (CSRF jetonu), gorsel.js (fotoğraf doğrulama ve WebP üretimi)
routes/site.js      Ziyaretçi sayfaları, teklif formu, görsel, robots / sitemap, eski adres yönlendirmeleri, 404 / hata
routes/yonetim.js   Yönetim paneli (giriş, pano, projeler, teklifler, hesap)
validators/         Form doğrulama kuralları
views/              EJS şablonları; views/parca: ortak parçalar (baş, son, kart, ok, hesaplayıcı…), views/yonetim: panel
public/             CSS, JavaScript (kütüphanesiz), logo ve simgeler
scripts/            test.js (npm test), test-db.js (yerel test veritabanı), gorselleri-isle.js (toplu fotoğraf işleme)
test/               node:test + supertest: site, site-backend, akislar, onyuz, yonetim, seed (eski şemalı veritabanı denemesi dahil)
dev/                Yalnız geliştirme yardımcıları (canlı yenileme, emülatör betikleri); canlıda kullanılmaz
veri/               Eski siteden alınan proje listesi ve fotoğraflar, düzeltme notları
belgeler/           Brief formu, yapay zekâ kullanım kaydı
docs/               Tasarım karşılaştırmaları, ekran görüntüleri, inceleme notları
arsiv/              Tasarım sürecindeki eski sürümler (çalışmaz, servis edilmez; bkz. arsiv/README.md)
```

## Tasarım sürümleri

Tasarım altı turda geliştirildi. İlk tasarım kökte, sonrakiler `/v2` … `/v6` altında aynı veritabanıyla yan yana
yayınlandı ve karşılaştırıldı. Seçilen **v6 ("yön tabelası")** artık sitenin tek sürümüdür ve kökte (`/`) çalışır.
Eski sürümlerin kodu `arsiv/` klasöründedir. Eski adresler kalıcı (301) yönlenir: `/v2` … `/v6` altındaki her adres
öneksiz karşılığına (`/v6/teklif?x=1` → `/teklif?x=1`), eski sitenin `/ornek-calismalar` sayfası `/calismalar`'a.

## Yerelde çalıştırma

1. `npm install`
2. `.env.example` dosyasını `.env` olarak kopyalayıp doldurun (`DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`).
3. `npm run seed` (tabloları kurar, göçleri uygular, yönetici hesabını — yalnız yoksa — açar, proje tablosu boşsa 96 projeyi yükler; tekrar çalıştırmak güvenli)
4. `npm start` → http://localhost:3000, yönetim: http://localhost:3000/yonetim
5. `npm test`

Testleri geliştirme verilerinden ayırmak için `npm run test:db` yerelde `kiraliktruss_test` veritabanını kurar (şema, yönetici, örnek projeler); çıktıdaki yönergeyle `.env`'e `TEST_DATABASE_URL` ekleyin, `npm test` o zaman yalnız o veritabanında çalışır. Veritabanı değişiklikleri `db/goc/*.sql` dosyalarında tutulur ve sunucu her açılışında ad sırasıyla uygulanır (dosyalar tekrar çalıştırılabilir yazılır). Fotoğrafları küçültmek için önce `npm run gorseller -- --kuru` (yazmadan rapor), sonra `npm run gorseller`.

Bu bilgisayarda geliştirme veritabanı proje klasöründeki `.pgdata` kümesidir (port 5433, repoya girmez):
`"C:\Program Files\PostgreSQL\18\bin\pg_ctl" -D .pgdata -o "-p 5433" -l .pgdata\log.txt start`

## Canlıya alma (Render + Neon, ikisi de ücretsiz)

1. **Neon** (neon.tech): GitHub ile giriş → yeni proje → bağlantı adresini (`postgresql://...`) kopyala.
2. **GitHub:** bu klasörü bir repoya gönder. `.env` repoya girmez.
3. **Render** (render.com): GitHub ile giriş → New → Blueprint → repoyu seç (`render.yaml` okunur).
   Panelde `DATABASE_URL` (Neon adresi), `ADMIN_EMAIL`, `ADMIN_PASSWORD` gir. `SESSION_SECRET` otomatik üretilir.
4. Her açılış `npm run seed && npm start` çalıştırır: tablolar / göçler uygulanır, yönetici hesabı yalnız yoksa açılır (panelden değiştirilen şifre ezilmez), projeler yalnız tablo boşken yüklenir. Eski şemalı bir veritabanında da çalışır.
5. Render'da ayarlanacak ortam değişkenleri (`render.yaml` anahtarları tanımlar, değerler panelden girilir):
   - `DATABASE_URL` (Neon adresi), `ADMIN_EMAIL`, `ADMIN_PASSWORD` (yalnız ilk kurulumda kullanılır)
   - `SESSION_SECRET` (otomatik üretilir; canlıda zorunlu)
   - `SITE_URL` (sitenin tam adresi: canonical, sitemap, e-posta bağlantısı)
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `BILDIRIM_EPOSTA` (e-posta bildirimi; isteğe bağlı)
   - `SITE_DEMO` (`true` = önizleme, arama motorlarına kapalı; gerçek yayında `false`)
   - İsteğe bağlı: `DATABASE_SSL_GEVSEK=true` (yalnız `DATABASE_SSL=true` iken sertifika doğrulamasını kapatır; adresteki `sslmode` bu durumda yok sayılır)
6. Ücretsiz Render 15 dk hareketsizlikte uyur; sunumdan önce siteyi bir kez açın.

## Güvenlik notları

- Parolalar bcrypt ile saklanır; oturum kimliği girişte yenilenir.
- Tüm SQL sorguları parametrelidir (`$1, $2…`), kullanıcı girdisi sorguya eklenmez.
- Gizli bilgiler `.env`'de; repoda yalnız `.env.example` var.
- Çerez `httpOnly`, `sameSite=lax`, canlıda `secure`.
- Yönetimdeki her POST formu CSRF jetonu ister; giriş ve teklif formunda istek sınırı vardır.
