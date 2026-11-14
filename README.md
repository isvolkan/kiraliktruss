# Kiralık Truss — web sitesi yenileme

BİLP2135 Web ve İnternet Programcılığı II, gerçek müşteri projesi.
Müşteri: **Kiralık Truss** (Hakan Bey, Beylikdüzü / İstanbul). Eski site: kiraliktruss.com (2013 tarzı jQuery, ana sayfa kaydırıcısı boş).

## Ne yapıldı

| Eski site | Yeni site |
|---|---|
| 4 statik sayfa, çalışmayan kaydırıcı | Node.js + Express dinamik site, PostgreSQL veritabanı |
| 96 proje 8 sayfaya dağılmış, arama yok | Yıl / şehir / tür süzgeci, arama, ızgara ve liste görünümü |
| Teklif için yalnız e-posta adresi | Doğrulamalı teklif formu, talepler veritabanında, yönetim panelinde takip |
| İçeriği güncellemek için geliştirici gerekir | Yönetim paneli: proje ekle / düzenle / sil (fotoğraflı) |
| Mobilde bozuk | Telefon, tablet ve masaüstü uyumlu; açık / koyu tema |
| — | Metretül hesaplayıcı: stand ölçüsünden tahmini truss uzunluğu, sonucu teklif formuna taşır |

## Yönergedeki şartlar nerede

- **Dinamik backend:** Express 5 (`app.js`, `routes/`)
- **Veritabanı:** PostgreSQL (`db/schema.sql`), yerelde ayrı küme, canlıda Neon
- **CRUD 1 — Projeler:** `routes/yonetim.js` → `/yonetim/projeler` (ekle, listele, güncelle, sil)
- **CRUD 2 — Teklifler:** ziyaretçi `/teklif` ile ekler; yönetici `/yonetim/teklifler`'de listeler, durumunu günceller, siler
- **Form + doğrulama:** `validators/index.js` (express-validator, sunucu tarafında); hata mesajları alanın altında
- **Responsive:** `public/css/site.css` (900 px ve 600 px kırılımları)
- **Ek değer:** oturum açma (bcrypt + oturum veritabanında), arama / süzgeç, harita, istek sınırı, bal küpü (spam koruması), güvenlik başlıkları (helmet)

## Klasörler

```
app.js              Express uygulaması (ara katmanlar, oturum, rotalar)
server.js           Sunucuyu başlatır
config/firma.js     Firma bilgileri (tek yerde)
db/                 Bağlantı havuzu, şema, seed betiği, eski başlık ayrıştırıcı
routes/site.js      Ziyaretçi sayfaları ve teklif formu
routes/yonetim.js   Yönetim paneli (giriş, projeler, teklifler)
validators/         Form doğrulama kuralları
views/              EJS şablonları (partials: üst, alt, kart)
public/             CSS, JavaScript (kütüphanesiz), simgeler
test/               Duman testleri (node:test + supertest)
veri/               Eski siteden alınan proje listesi ve fotoğraflar, düzeltme notları
belgeler/           Brief formu, yapay zekâ kullanım kaydı
```

## Yerelde çalıştırma

1. `npm install`
2. `.env.example` dosyasını `.env` olarak kopyalayıp doldurun (`DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`).
3. `npm run seed` (tabloları kurar, yönetici hesabını açar, 96 projeyi yükler)
4. `npm start` → http://localhost:3000, yönetim: http://localhost:3000/yonetim
5. `npm test`

Bu bilgisayarda geliştirme veritabanı proje klasöründeki `.pgdata` kümesidir (port 5433, repoya girmez):
`"C:\Program Files\PostgreSQL\18\bin\pg_ctl" -D .pgdata -o "-p 5433" -l .pgdata\log.txt start`

## Canlıya alma (Render + Neon, ikisi de ücretsiz)

1. **Neon** (neon.tech): GitHub ile giriş → yeni proje → bağlantı adresini (`postgresql://...`) kopyala.
2. **GitHub:** bu klasörü bir repoya gönder. `.env` repoya girmez.
3. **Render** (render.com): GitHub ile giriş → New → Blueprint → repoyu seç (`render.yaml` okunur).
   Panelde `DATABASE_URL` (Neon adresi), `ADMIN_EMAIL`, `ADMIN_PASSWORD` gir. `SESSION_SECRET` otomatik üretilir.
4. İlk açılışta seed betiği tabloları kurar ve 96 projeyi yükler.
5. Ücretsiz Render 15 dk hareketsizlikte uyur; sunumdan önce siteyi bir kez açın.

## Güvenlik notları

- Parolalar bcrypt ile saklanır; oturum kimliği girişte yenilenir.
- Tüm SQL sorguları parametrelidir (`$1, $2…`), kullanıcı girdisi sorguya eklenmez.
- Gizli bilgiler `.env`'de; repoda yalnız `.env.example` var.
- Çerez `httpOnly`, `sameSite=lax`, canlıda `secure`.
