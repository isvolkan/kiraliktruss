// Yeni teklif geldiğinde yöneticiye e-posta atar.
// SMTP_*, BILDIRIM_EPOSTA ve SITE_URL tanımlı değilse yalnız konsola tek satır yazar (yerelde ve testlerde mail gitmez).
const nodemailer = require('nodemailer');

function ayarVarMi() {
  const e = process.env;
  // SITE_URL de şart: yoksa e-postadaki panel bağlantısı göreli (/yonetim/...) kalır, mailde tıklanamaz
  return Boolean(e.SMTP_HOST && e.SMTP_PORT && e.SMTP_USER && e.SMTP_PASS && e.BILDIRIM_EPOSTA && e.SITE_URL);
}

// HTML e-postaya yazılan kullanıcı metinleri kaçırılır (HTML enjeksiyonunu önlemek için)
function kacir(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function tarihYaz(t) {
  // pg DATE sütununu yerel gece yarısı olarak verir; toISOString UTC'ye çevirip günü kaydırırdı
  if (!(t instanceof Date)) return String(t || '');
  const iki = (n) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${iki(t.getMonth() + 1)}-${iki(t.getDate())}`;
}

async function yeniTeklif(teklif) {
  const tarih = tarihYaz(teklif.tarih);
  const ozet = `${teklif.ad_soyad} · ${teklif.etkinlik_turu} · ${teklif.sehir} · ${tarih}`;
  if (!ayarVarMi()) {
    console.log('[bildirim] Yeni teklif (e-posta ayarlı değil):', ozet);
    return false;
  }

  const taban = (process.env.SITE_URL || '').replace(/\/+$/, '');
  const panel = `${taban}/yonetim/teklifler${teklif.id ? "/" + teklif.id : ""}`;
  const satirlar = [
    ['Müşteri', teklif.ad_soyad], ['Firma', teklif.firma], ['Telefon', teklif.telefon], ['E-posta', teklif.eposta],
    ['Etkinlik', teklif.etkinlik_turu], ['Tarih', tarih], ['Şehir', teklif.sehir],
  ].filter(([, d]) => d);

  const metin = ['Yeni teklif talebi geldi.', '', ...satirlar.map(([a, d]) => `${a}: ${d}`), '', `Yönetim paneli: ${panel}`].join('\n');
  const html = `<h2>Yeni teklif talebi</h2><table>${satirlar.map(([a, d]) =>
    `<tr><td><b>${a}</b></td><td>${kacir(d)}</td></tr>`).join('')}</table><p><a href="${kacir(panel)}">Yönetim panelinde aç</a></p>`;

  const port = Number(process.env.SMTP_PORT);
  const tasiyici = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port, secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await tasiyici.sendMail({
    from: process.env.SMTP_USER, to: process.env.BILDIRIM_EPOSTA,
    subject: `Yeni teklif: ${teklif.ad_soyad} (${teklif.sehir})`, text: metin, html,
  });
  return true;
}

module.exports = { yeniTeklif, ayarVarMi };
