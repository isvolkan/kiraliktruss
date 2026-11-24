// CSRF koruması (kütüphanesiz). Başka bir site, girişli yöneticinin tarayıcısına form gönderterek işlem yaptıramasın diye:
// her oturuma rastgele bir jeton verilir, yönetimdeki her POST formu bu jetonu gizli alanda (_csrf) geri gönderir,
// sunucu ikisini karşılaştırır. Saldırgan sitesi jetonu okuyamadığı için doğru değeri gönderemez.
const crypto = require('crypto');

// Oturumdaki jetonu verir; yoksa 32 rastgele bayttan üretip oturuma yazar
function jeton(req) {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(32).toString('hex');
  return req.session.csrf;
}

// Görünümler formlara koysun diye jetonu res.locals.csrf'e koyar
function hazirla(req, res, next) {
  res.locals.csrf = jeton(req);
  next();
}

// İki jeton aynı mı? timingSafeEqual: karşılaştırma süresi, kaç karakterin tuttuğunu ele vermez.
function esit(gelen, beklenen) {
  if (typeof gelen !== 'string' || typeof beklenen !== 'string') return false;
  const a = Buffer.from(gelen);
  const b = Buffer.from(beklenen);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// GET/HEAD/OPTIONS dışındaki her istekte jetonu denetler; tutmazsa 403 sayfası.
// Gövde bu noktada çözülmüş olmalı (urlencoded ya da multer); bu yüzden yönetimde multer'dan sonra çalışır.
function dogrula(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const gelen = (req.body && req.body._csrf) || req.get('x-csrf-token');
  if (esit(gelen, req.session.csrf)) return next();
  res.status(403).render('yonetim/yasak', { baslik: 'İşlem reddedildi' });
}

module.exports = { jeton, hazirla, dogrula };
