// Sayfa çizilmeden önce, <head> içinde senkron çalışır: kayıtlı temayı uygular (ilk boyamada yanıp sönme olmasın)
// ve "js" sınıfını ekler. v3'te hiçbir içerik bu sınıfa bağlı olarak gizlenmez; başlık ilk boyamada görünür.
(function () {
  var kok = document.documentElement;
  kok.classList.add('js');
  try {
    if (localStorage.getItem('v3-tema') === 'koyu') kok.dataset.tema = 'koyu';
  } catch (e) { /* gizli sekmede localStorage kapalı olabilir */ }
})();
