// Kiralık Truss v3 — proje tablosu: satırın üstüne gelince küçük fotoğraf imleci izler (yalnız fareli cihaz).
(function () {
  'use strict';
  var liste = document.getElementById('liste');
  var kutu = document.getElementById('listeOnizleme');
  if (!liste || !kutu || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  var img = kutu.querySelector('img');
  var az = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var W = 260, H = 173;
  var hx = 0, hy = 0, x = 0, y = 0, calisiyor = false, ilk = true;

  function hedefle(cx, cy) {
    hx = Math.max(8, Math.min(cx + 36, window.innerWidth - W - 8));
    hy = Math.max(8, Math.min(cy - H / 2, window.innerHeight - H - 8));
    if (ilk || az) { x = hx; y = hy; ilk = false; yaz(); }
    else if (!calisiyor) { calisiyor = true; requestAnimationFrame(adim); }
  }
  function yaz() { kutu.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)'; }
  function adim() {
    x += (hx - x) * 0.2; y += (hy - y) * 0.2; yaz();
    if (Math.abs(hx - x) > 0.5 || Math.abs(hy - y) > 0.5) requestAnimationFrame(adim); else calisiyor = false;
  }
  function ac(a) {
    if (img.getAttribute('src') !== a.dataset.gorsel) img.setAttribute('src', a.dataset.gorsel);
    kutu.classList.add('gorunur'); document.body.classList.add('liste-uzerinde');
  }
  function kapat() { kutu.classList.remove('gorunur'); document.body.classList.remove('liste-uzerinde'); ilk = true; }

  liste.addEventListener('mouseover', function (e) { var a = e.target.closest('a[data-gorsel]'); if (a) ac(a); });
  liste.addEventListener('mousemove', function (e) { hedefle(e.clientX, e.clientY); });
  liste.addEventListener('mouseleave', kapat);
  // Klavye: odaklanan satırın sağında göster
  liste.addEventListener('focusin', function (e) {
    var a = e.target.closest('a[data-gorsel]'); if (!a) return;
    ac(a); var r = a.getBoundingClientRect(); ilk = true;
    hedefle(r.left + r.width * 0.55, r.top + r.height / 2);
  });
  liste.addEventListener('focusout', kapat);
  window.addEventListener('scroll', function () { if (!liste.matches(':hover') && !liste.contains(document.activeElement)) kapat(); }, { passive: true });
})();
