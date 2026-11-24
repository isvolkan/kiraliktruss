// Sayfa çizilmeden önce: JS sınıfı ve tema (kayıtlı seçim, yoksa sistem tercihi). Böylece karanlık modda beyaz parlama olmaz.
(function () {
  var k = document.documentElement;
  k.classList.add('js'); // JS çalışıyor: yalnız JS'le anlamlı gizleme/hareket stilleri devreye girer
  var t = null;
  try { t = localStorage.getItem('v6-tema'); } catch (e) { /* gizli pencere: kayıt yok */ }
  if (t !== 'koyu' && t !== 'acik') t = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'koyu' : 'acik';
  k.setAttribute('data-tema', t);
})();
