// Sayfa çizilmeden önce, <head> içinde senkron çalışır: kayıtlı temayı uygular (ilk boyamada yanıp sönme olmasın)
// ve "js" sınıfını ekler (hareketler bu sınıfa bağlı; JS kapalıyken içerik düz okunur).
(function () {
  var kok = document.documentElement;
  kok.classList.add('js');
  try {
    if (localStorage.getItem('v2-tema') === 'koyu') kok.dataset.tema = 'koyu';
  } catch (e) { /* gizli sekmede localStorage kapalı olabilir */ }
  // Ana betik 3 sn içinde yüklenmezse gizlenmiş başlıklar yine de görünsün
  setTimeout(function () { kok.classList.add('js-gec'); }, 3000);
})();
