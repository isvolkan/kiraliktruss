// Kiralık Truss v2 — ortak etkileşimler (kütüphane yok). Sayfa betikleri window.V2 yardımcılarını kullanır.
(function () {
  'use strict';
  var kok = document.documentElement;
  var az = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, k) { return (k || document).querySelector(s); };
  var $$ = function (s, k) { return Array.prototype.slice.call((k || document).querySelectorAll(s)); };
  var kis = function (v, a, b) { return Math.min(b === undefined ? 1 : b, Math.max(a === undefined ? 0 : a, v)); };

  // ---- Yardımcılar (sayfa betikleri için) ----
  // Rakam rulosu: metindeki her rakam 0–9 dikey şerit; aynı kalıpta şeritler yerinde kayar, değişirse yeniden kurulur.
  function rulo(el, metin, gecikme) {
    var kalip = function (m) { return m.replace(/\d/g, '9'); };
    if (el.dataset.m && kalip(el.dataset.m) === kalip(metin)) {
      var h = 0;
      Array.prototype.forEach.call(el.children, function (c, k) {
        if (c.className === 'rulo-h') {
          c.firstChild.style.transitionDelay = ((gecikme || 0) * h++) + 'ms';
          c.firstChild.style.transform = 'translateY(' + (-metin.charAt(k)) + 'em)';
        }
      });
    } else {
      el.innerHTML = metin.split('').map(function (c) {
        if (/\d/.test(c)) {
          var seritler = '';
          for (var d = 0; d < 10; d++) seritler += '<span>' + d + '</span>';
          return '<span class="rulo-h"><i style="transform:translateY(' + (-c) + 'em)">' + seritler + '</i></span>';
        }
        return '<span>' + (c === ' ' ? '&nbsp;' : c) + '</span>';
      }).join('');
    }
    el.dataset.m = metin;
  }
  // Sabit ekran yüksekliği: telefonda adres çubuğu gizlenip göründükçe innerHeight her karede değişir ve
  // kaydırmaya bağlı hesaplar zıplar (titreme). Değer yalnız genişlik değişince (döndürme vb.) yenilenir.
  var ekranGen = window.innerWidth, ekranYuk = window.innerHeight;
  function ekranH() { return ekranYuk; }
  window.addEventListener('resize', function () {
    if (window.innerWidth !== ekranGen) { ekranGen = window.innerWidth; ekranYuk = window.innerHeight; }
  });
  // Sabit (sticky) sahnenin üst değeri ve yüksekliği: her kaydırma karesinde okumak telefonda titretiyordu
  function sabitOlc(el) {
    var o = { ust: 0, yuk: 0 };
    var olc = function () { o.ust = parseFloat(getComputedStyle(el).top) || 0; o.yuk = el.offsetHeight; };
    olc(); window.addEventListener('resize', olc); window.addEventListener('load', olc);
    return o;
  }
  // Kaydırma güncellemelerini tek rAF'ta toplar
  var isler = [], bekliyor = false;
  function kaydir(fn) { isler.push(fn); fn(); }
  function tikla() { bekliyor = false; isler.forEach(function (f) { f(); }); }
  function iste() { if (!bekliyor) { bekliyor = true; requestAnimationFrame(tikla); } }
  window.addEventListener('scroll', iste, { passive: true });
  window.addEventListener('resize', iste);
  window.addEventListener('load', iste);
  window.V2 = { azHareket: az, rulo: rulo, kaydir: kaydir, kis: kis, ekranH: ekranH, sabitOlc: sabitOlc, $: $, $$: $$ };

  // ---- 1) Tema ----
  var temaDugme = $('#temaDugme');
  if (temaDugme) {
    var meta = $('meta[name="theme-color"]');
    var temaUygula = function (koyu) {
      if (koyu) kok.dataset.tema = 'koyu'; else delete kok.dataset.tema;
      temaDugme.setAttribute('aria-pressed', String(koyu));
      if (meta) meta.setAttribute('content', koyu ? '#141413' : '#EDEBE4');
    };
    temaUygula(kok.dataset.tema === 'koyu');
    temaDugme.addEventListener('click', function () {
      var koyu = kok.dataset.tema !== 'koyu';
      temaUygula(koyu);
      try { localStorage.setItem('v2-tema', koyu ? 'koyu' : 'acik'); } catch (e) { /* yoksay */ }
    });
  }

  // ---- 2) Mobil menü ----
  var menuDugme = $('#menuDugme'), ust = $('#ust');
  if (menuDugme && ust) {
    var menuAyarla = function (ac) {
      ust.classList.toggle('menu-acik', ac);
      menuDugme.setAttribute('aria-expanded', String(ac));
      menuDugme.textContent = ac ? 'Kapat' : 'Menü';
    };
    menuDugme.addEventListener('click', function () { menuAyarla(!ust.classList.contains('menu-acik')); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') menuAyarla(false); });
    $$('#menu a').forEach(function (a) { a.addEventListener('click', function () { menuAyarla(false); }); });
  }

  // ---- 3) Başlık maske yükselişi [data-yuksel] ----
  function bol(el) {
    var sira = 0;
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    (function gez(n) {
      Array.prototype.slice.call(n.childNodes).forEach(function (c) {
        if (c.nodeType === 3) {
          var f = document.createDocumentFragment();
          c.nodeValue.split(/(\s+)/).forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { f.appendChild(document.createTextNode(' ')); return; }
            var k = document.createElement('span'), i = document.createElement('span');
            k.className = 'y-k'; k.setAttribute('aria-hidden', 'true');
            i.className = 'y-i'; i.style.setProperty('--i', sira++); i.textContent = p;
            k.appendChild(i); f.appendChild(k);
          });
          c.parentNode.replaceChild(f, c);
        } else if (c.nodeType === 1 && c.tagName !== 'BR') gez(c);
      });
    })(el);
    el.classList.add('y-hazir');
  }
  var yuksel = $$('[data-yuksel]');
  if (!az && 'IntersectionObserver' in window) {
    var yg = new IntersectionObserver(function (g) {
      g.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('y-ac'); yg.unobserve(x.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    yuksel.forEach(function (el) { bol(el); yg.observe(el); });
  }

  // ---- 4) Mono etiket karıştırma [data-karistir] (açılışta) ve [data-karistir="hover"] ----
  var HAVUZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&/+*';
  function karistir(el) {
    var asil = el.dataset.asil || (el.dataset.asil = el.textContent);
    var harfler = asil.split(''), k = 0;
    if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', asil);
    clearInterval(el._t);
    el._t = setInterval(function () {
      el.textContent = harfler.map(function (h, i) {
        return (!/[\p{L}\p{N}]/u.test(h) || i < k) ? h : HAVUZ.charAt(Math.floor(Math.random() * HAVUZ.length));
      }).join('');
      if (k++ > harfler.length) { clearInterval(el._t); el.textContent = asil; }
    }, 32);
  }
  if (!az) {
    var kg = 'IntersectionObserver' in window ? new IntersectionObserver(function (g) {
      g.forEach(function (x) { if (x.isIntersecting) { karistir(x.target); kg.unobserve(x.target); } });
    }, { threshold: .6 }) : null;
    $$('[data-karistir]').forEach(function (el) {
      if (el.dataset.karistir === 'hover') {
        el.addEventListener('pointerenter', function () { karistir(el); });
        el.addEventListener('focus', function () { karistir(el); });
      } else if (kg) kg.observe(el);
    });
  }

  // ---- 5) Rakam rulosu [data-sayac="N"] (data-on, data-son, data-grupsuz) ----
  if (!az && 'IntersectionObserver' in window) {
    var sg = new IntersectionObserver(function (g) {
      g.forEach(function (x) {
        if (!x.isIntersecting) return;
        sg.unobserve(x.target);
        var el = x.target, son = el.dataset.hedef;
        requestAnimationFrame(function () { requestAnimationFrame(function () { rulo(el.querySelector('.rulo'), son, 90); }); });
      });
    }, { threshold: .5 });
    $$('[data-sayac]').forEach(function (el) {
      var hedef = parseInt(el.dataset.sayac, 10) || 0;
      var sayi = el.hasAttribute('data-grupsuz') ? String(hedef) : hedef.toLocaleString('tr-TR');
      var metin = (el.dataset.on || '') + sayi + (el.dataset.son || '');
      el.dataset.hedef = metin;
      el.innerHTML = '<span class="sr-only">' + metin + '</span><span class="rulo" aria-hidden="true"></span>';
      rulo(el.querySelector('.rulo'), metin.replace(/\d/g, '0'));
      sg.observe(el);
    });
  }

  // ---- 6) Koordinat imleci (yalnız fareli cihaz) ----
  if (!az && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var koor = document.createElement('div');
    koor.className = 'koor'; koor.setAttribute('aria-hidden', 'true');
    document.body.appendChild(koor);
    var mx = 0, my = 0, px = 0, py = 0, bek = false;
    document.addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY; px = e.pageX; py = e.pageY;
      if (bek) return; bek = true;
      requestAnimationFrame(function () {
        bek = false;
        koor.textContent = 'X: ' + Math.round(px) + '  Y: ' + Math.round(py);
        koor.style.transform = 'translate(' + Math.min(mx + 16, window.innerWidth - 150) + 'px,' + Math.min(my + 18, window.innerHeight - 30) + 'px)';
        koor.classList.add('var');
      });
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', function () { koor.classList.remove('var'); });
  }

  // ---- 7) Alt katman (N-07): alt bilgi sayfanın altında sabit durur, sayfa bitince açılır ----
  var alt = $('#alt');
  if (alt) {
    // Telefonda / dokunmatikte sabit alt katman yok: adres çubuğu yüksekliği değiştirdikçe sayfa zıplıyordu.
    var dokunmatik = window.matchMedia('(hover: none), (max-width: 760px)');
    var olcGen = -1;
    var olc = function (zorla) {
      if (zorla !== true && window.innerWidth === olcGen) return; // yalnız genişlik değişince ölç
      olcGen = window.innerWidth;
      if (dokunmatik.matches) { kok.classList.remove('alt-katman'); return; }
      var h = alt.offsetHeight; // sabitken de aynı genişlikte; sınıfı kaldırıp sayfayı oynatmaya gerek yok
      kok.style.setProperty('--alt-yuk', h + 'px');
      kok.classList.toggle('alt-katman', h <= ekranYuk * 0.9);
    };
    olc(true);
    window.addEventListener('resize', olc);
    window.addEventListener('load', function () { olc(true); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { olc(true); });
    // Klavye alt bilgiye geldiyse sayfa sonuna in (yoksa bağlantı kapağın altında kalır)
    alt.addEventListener('focusin', function () {
      if (kok.classList.contains('alt-katman')) window.scrollTo(0, document.documentElement.scrollHeight);
    });
  }
})();
