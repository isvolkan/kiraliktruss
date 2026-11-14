// Sayfa çizilmeden önce çalışır: kayıtlı temayı uygular (ekranın bir an yanlış renkte görünmesini önler)
// ve "js" sınıfını ekler (JavaScript kapalıyken içerik gizli kalmasın diye animasyonlar bu sınıfa bağlı).
(function () {
  var kok = document.documentElement;
  kok.classList.add('js');
  try {
    var t = localStorage.getItem('tema');
    if (t === 'acik' || t === 'koyu') kok.dataset.tema = t;
  } catch (e) { /* gizli sekmede localStorage kapalı olabilir */ }
})();
