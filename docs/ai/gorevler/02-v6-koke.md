AMAÇ: v6 tasarımını sitenin tek ve ana sürümü yap (kök "/"), eski sürümleri (kök eski tasarım + v2..v5) arşive kaldır, v6'nın render-yama mimarisini temiz tek rota dosyasına dönüştür.

BAĞLAM:
- Proje: C:\Users\Serkan\ProjeWEB (Express 5 + EJS + PostgreSQL, yerelde .pgdata kümesi port 5433 çalışıyor). Ders projesi, teslim 25 Kasım 2026; canlı (Render) yayının bozulmaması kritik. Hocam kodun her bölümünü açıklamamı isteyebilir: kod sade, okunur, yorumları Türkçe ve kısa olsun.
- Şu an: app.js kökü eski routes/site.js + views/*.ejs ile, /v2../v6'yı ayrı router'larla bağlıyor. routes/v6.js, res.render'ı 'v6/' önekiyle ezip routes/site.js'i yeniden kullanıyor; res.locals.kok = '/v6' bağlantı öneki. Bkz. docs/ai/review-v6-bulgular.md (H13: v6 ana sayfası site.js'e next() ile düşüp kullanılmayan 2 sorgu çalıştırıyor).
- Sunucu node --watch ile 3000'de çalışıyor; dosya değişince kendi yeniden başlar. Sunucuyu kendin başlatma/durdurma.

YAPILACAKLAR:
1. Ziyaretçi sitesi tek rota dosyası: routes/site.js = v6'nın tüm ziyaretçi rotaları (ana sayfa, çalışmalar, çalışma detayı, hakkımızda, iletişim, teklif GET/POST, teşekkürler, /gorsel/:id, 404/hata). Render yaması (res.render ezme) ve next() zinciri kalksın; her rota kendi sorgusunu yapıp doğrudan render etsin (H13 çözülür). Teklif POST'u, doğrulama, rate limit, honeypot aynen korunsun.
2. Görünümler: views/v6/* → views/ köküne (views/parca dahil). Eski kök görünümler (views/*.ejs, views/partials) ve views/v2..v5 → arsiv/views/... AMA views/yonetim ve yönetimin kullandığı partial/CSS'ler yerinde kalsın ve yönetim paneli çalışmaya devam etsin (yönetim bir sonraki adımda ayrı işçi tarafından yeniden tasarlanacak; sen yönetim dosyalarının içeriğini değiştirme, yalnız yol kırılırsa en küçük düzeltmeyi yap).
3. Varlıklar: public/v6/{css,js,img} → public/{css,js,img} altında v6 dosyaları ana dosyalar olsun (isim çakışması varsa eski kök dosyalar arsiv/public/'e). Yönetimin kullandığı eski CSS'i (ör. public/css/site.css) yönetim yenilenene kadar yerinde bırak ya da public/css/yonetim-eski.css gibi açık bir adla tut ve yönetim şablonlarındaki bağlantıyı ona çevir. public/v2..v5 → arsiv/public/.
4. Bağlantı öneki: res.locals.kok kalksın ya da '' olsun; tüm şablonlarda /v6 öneki kalmasın.
5. Yönlendirmeler (kalıcı 301): /v6 ve /v6/* → öneksiz aynı yol (sorgu dizesi korunarak); /v2, /v3, /v4, /v5 ve alt yolları → aynı yolun kök karşılığı ya da /. veri/ klasöründe eski kiraliktruss.com sayfa adresleri varsa (ör. eski .html/.php sayfaları), onlar için de uygun 301'leri ekle; yoksa ekleme.
6. app.js: yalnız ziyaretçi router'ı ('/') ve yönetim router'ı ('/yonetim') kalsın; v2..v6 bağlantıları ve onlara ait kod silinsin. routes/v3.js..v6.js → arsiv/routes/.
7. Testler: test/v6.test.js → test/site.test.js, tüm yollar kök. Eski sürümlerin testleri (test/v2*.test.js..v5, eski kök görünüm testleri) → arsiv/test/. Yönetim/akış testleri (ör. test/akislar.test.js) çalışmaya devam etsin. Yeni test: /v6/calismalar?x=1 → 301 Location /calismalar?x=1; /v3 → 301.
8. arsiv/ klasörüne kısa bir README.md: içinde ne var, neden arşivlendi (sunumda süreç anlatımı için), express.static ile servis edilmediğini belirt.
9. README.md'deki klasör yapısı ve sürüm anlatımını güncelle (v6 artık ana site; eski sürümler arsiv/).

KAPSAM: app.js, routes/, views/ (yonetim hariç içerik değişikliği yok), public/, test/, arsiv/, README.md. config/, db/, validators/, routes/yonetim.js içeriğine dokunma (yol düzeltmesi zorunluysa tek satır). docs/karsilastirma/ ve docs/ai/ altına dokunma. Paket kurma. git commit/push yapma. Dosya silmek yerine arsiv/'e taşı (git takip etmiyor olabilir, silinen geri gelmez).

KABUL ÖLÇÜTÜ:
- http://localhost:3000/ v6 tasarımını açıyor; /calismalar, /calismalar/<id>, /hakkimizda, /iletisim, /teklif, /tesekkurler 200; /v6/teklif → 301 /teklif; /yonetim/giris ve giriş sonrası panel çalışıyor.
- Sayfa HTML'lerinde "/v6" geçmiyor (grep ile doğrula).
- `npm test` tamamen geçiyor.

TEST: npm test; curl -sI ile yukarıdaki yollar.

DÖNÜŞ: En fazla 12 satır: taşınan/arşivlenen klasörler, routes/site.js'in yeni yapısı (tek cümle), eklenen yönlendirmeler, test sonucu (geçen/kalan), yönetim panelinde kalan geçici çözüm (eski CSS nerede), emin olmadığın şey. Kod dökümü yapıştırma.
