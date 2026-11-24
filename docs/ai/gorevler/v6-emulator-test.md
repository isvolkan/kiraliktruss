AMAÇ: Kiralık Truss v6 sitesini Android emülatörde (Chrome) test et: telefonda kasma/titreme var mı ölç, görsel kontrol yap. KOD DEĞİŞTİRME.

BAĞLAM:
- Proje C:\Users\Serkan\ProjeWEB. Sunucu bilgisayarda http://localhost:3001 (çalışıyor; kapatma, yeniden başlatma). Emülatörden adres: http://10.0.2.2:3001/v6
- Emülatör açık: `adb devices` → emulator-5554 (AVD Gunce_Pixel_7). adb yolu: C:\Users\Serkan\AppData\Local\Android\Sdk\platform-tools\adb. Chrome paketi com.android.chrome. Chrome ilk açılışta karşılama ekranları çıkarabilir: geç (hesap ekleme yok, "No thanks"/"Use without an account"; çerez/izin varsa en kısıtlayıcıyı seç). Şifre girme, hesap açma.
- Sayfayı açmak: `adb shell am start -a android.intent.action.VIEW -d "http://10.0.2.2:3001/v6" com.android.chrome`
- Kaydırma: `adb shell input swipe 540 1700 540 600 400` (aşağı), tersi yukarı. Ekran görüntüsü: `adb exec-out screencap -p > dev/emu/<ad>.png`.
- Kare ölçümü: her senaryodan önce `adb shell dumpsys gfxinfo com.android.chrome reset`, senaryoyu yap, sonra `adb shell dumpsys gfxinfo com.android.chrome` çıktısından "Total frames rendered", "Janky frames" (yüzde), "50th/90th/99th percentile" satırlarını al. (Chrome'da bu sayılar kısmi olabilir; yine de karşılaştırma için topla.) Mümkünse ek olarak Chrome DevTools uzaktan hata ayıklama ile performans ölç: `adb forward tcp:9222 localabstract:chrome_devtools_remote` sonra http://localhost:9222/json ile sayfayı bul; Node ile CDP'ye bağlanıp (Node 26 global WebSocket var) `Runtime.evaluate` ile sayfada requestAnimationFrame aralıklarını ölçen küçük bir kod çalıştırabilirsin (kaydırma sırasında 25 ms'yi aşan kare sayısı). Konsol hatalarını da CDP'den topla (Runtime.consoleAPICalled / Log.entryAdded).

TEST SENARYOLARI (her biri için kare ölçümü + 1-2 ekran görüntüsü):
1. /v6 anasayfa: açılış; "Son kurulumlardan" şeridi ekrandayken 5 sn bekle (kendiliğinden akar) — akıyor mu?
2. /v6 sayfanın en altına kadar kaydır: footer (koyu, dev "kiralık truss" harfleri) açılırken harfler aşağıdan yükseliyor mu? Ekranın altında SABİT "Ara / Teklif iste" çubuğu OLMAMALI.
3. Bir ekran boyundan fazla aşağı inince sağ altta yuvarlak "↑" düğmesi kayarak gelmeli; basınca en üste dönmeli; üstte iken kaybolmalı.
4. /v6/calismalar, /v6/hakkimizda, /v6/iletisim: açılışta büyük başlık harf harf geliyor mu; aşağı kaydırınca büyük başlık küçülüp sönüyor ve sol üstte (üst çubuğun hemen altında) küçük sayfa adı etiketi (ör. "Çalışmalar") soldan kayarak geliyor mu; yukarı çıkınca kayboluyor mu. Titreme/geride kalma var mı (kaydırma sırasında art arda birkaç ekran görüntüsü al).
5. Tema düğmesi (üst çubukta "Menü" düğmesinin solundaki güneş/ay simgesi): bas, karanlık moda geçiş (daire olarak açılır) kare ölçümüyle; tekrar bas, açığa dön.
6. /v6/calismalar sayfa 2 bağlantısına bas: yeni sayfa en üstten değil süzgeç bölümünden açılmalı.
7. Yatay taşma: her sayfada CDP ile `document.documentElement.scrollWidth > innerWidth` kontrol et.

KAPSAM: Yalnız okuma/test. Proje dosyalarına dokunma; ekran görüntülerini ve ölçüm notlarını C:\Users\Serkan\ProjeWEB\dev\emu\ altına koy (rapor: dev/emu/rapor.md). Git işlemi yok.

KABUL ÖLÇÜTÜ: 7 senaryonun her biri için geçti/kaldı + ölçüm sayıları dev/emu/rapor.md'de.

DÖNÜŞ: En fazla 10 satırlık özet ver: her senaryo geçti/kaldı, en kötü jank yüzdesi hangi senaryoda, görülen hata/titreme, emin olmadığın şey. Kod dökümü yapıştırma.
