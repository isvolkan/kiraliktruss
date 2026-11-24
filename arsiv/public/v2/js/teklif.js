// Kiralık Truss v2 — teklif formu: metretül künyeye yansır; hata varsa ilk hatalı alana odaklanır.
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };

  var giris = $('input[name="metretul"]');
  var kunye = $('#tkMt'), olcu = $('#tkOlcu'), yazi = $('#tkOlcuYazi');
  if (giris && kunye) {
    var yansit = function () {
      var m = parseInt(giris.value, 10);
      var var_ = m > 0;
      var s = var_ ? m.toLocaleString('tr-TR') : '';
      kunye.textContent = var_ ? s + ' mt' : '—';
      if (olcu) olcu.hidden = !var_;
      if (yazi) yazi.textContent = var_ ? s + ' mt truss' : '';
    };
    giris.addEventListener('input', yansit);
  }

  var hata = $('[aria-invalid="true"]');
  var kutu = $('.tk-hata-kutu');
  if (hata) {
    try { hata.focus({ preventScroll: true }); } catch (e) { /* eski tarayıcı */ }
    var hedef = kutu || hata;
    hedef.scrollIntoView({ block: 'center' });
  } else if (kutu) {
    kutu.focus();
  }
})();
