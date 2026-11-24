// Hız sınırı sayaç anahtarı: aynı istemci hep aynı anahtara düşsün, sahte başlıkla anahtar değiştirilemesin.
// Canlıda zincir: istemci → Cloudflare → Render yük dengeleyici → uygulama. Cloudflare her isteğe CF-Connecting-IP'yi
// KENDİSİ yazar (istemcinin gönderdiğini ezer); anahtar bu yüzden o başlıktan alınır ve X-Forwarded-For / "trust proxy"
// sayısı sayaç için kritik değildir. Başlık yoksa (yerel geliştirme, testler, Cloudflare'siz erişim) req.ip kullanılır.
// Not: Render adresine Cloudflare'i atlayarak doğrudan gelen biri CF-Connecting-IP'yi kendisi yazabilir; bu kabul edilmiş bir
// sınırdır (en kötü ihtimal sayacı kendi lehine bölmek; alan adı Cloudflare'in arkasında olduğu sürece olağan kullanıcı etkilenmez).
const net = require('net');
const { ipKeyGenerator } = require('express-rate-limit');

// express-rate-limit 8: IPv6 adresleri /56 alt ağa indirgenir (tek kişi 2^64 adres kullanıp sınırı aşamasın)
function anahtar(req) {
  const cf = req.headers['cf-connecting-ip'];
  const ip = typeof cf === 'string' && net.isIP(cf.trim()) ? cf.trim() : req.ip;
  return ipKeyGenerator(ip || '0.0.0.0');
}

// Teşhis günlüğündeki adres maskesi: IPv4 1.2.3.4 → 1.2.3.x; IPv6'da son 4 grup gizlenir (2001:db8::1 → 2001:db8:0:0:x:x:x:x).
// Boş/yok → '-', geçerli IP olmayan değer → 'gecersiz' (ham değer loga yazılmaz).
function maskele(ip) {
  if (typeof ip !== 'string' || !ip.trim()) return '-';
  const a = ip.trim();
  const tur = net.isIP(a);
  if (tur === 4) return a.replace(/\d+$/, 'x');
  if (tur === 6) {
    const m = a.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/); // IPv4-eşlemeli (::ffff:1.2.3.4): IPv4 kısmını maskele
    if (m) return m[1] + m[2].replace(/\d+$/, 'x');
    const [bas, son] = a.split('::');
    const g = (t) => (t ? t.split(':') : []);
    const sol = g(bas);
    const sag = son === undefined ? [] : g(son);
    const tam = son === undefined ? sol : [...sol, ...Array(8 - sol.length - sag.length).fill('0'), ...sag];
    return [...tam.slice(0, 4), 'x', 'x', 'x', 'x'].join(':');
  }
  return 'gecersiz';
}

const ozel = (ip) => {
  const a = String(ip || '').replace(/^::ffff:/i, '');
  if (net.isIP(a) === 4) {
    const [o1, o2] = a.split('.').map(Number);
    return o1 === 10 || o1 === 127 || (o1 === 172 && o2 >= 16 && o2 <= 31) || (o1 === 192 && o2 === 168) || (o1 === 100 && o2 >= 64 && o2 <= 127);
  }
  if (net.isIP(a) === 6) return a === '::1' || /^f[cd]/i.test(a);
  return false;
};

// Render'ın iç sağlık kontrolü: özel ağ adresinden gelir ve hiçbir vekil başlığı taşımaz → teşhise sayılmaz.
const VEKIL_BASLIKLARI = ['x-forwarded-for', 'cf-connecting-ip', 'true-client-ip'];
function icIstek(req) {
  return ozel(req.socket && req.socket.remoteAddress) && !VEKIL_BASLIKLARI.some((b) => req.headers[b]);
}

const maskeliListe = (v) => {
  if (!v) return '-';
  const l = String(v).split(',').map((a) => maskele(a));
  return `${l.join(',')} (n=${l.length})`;
};

// Geçici canlı doğrulama: IP_TESHIS=true iken ilk 20 uygun isteği (POST /teklif, /saglik, GET /) tek satır loglar.
// İç sağlık kontrolü loglanmaz ve sayaçtan düşmez. Varsayılan kapalı; değişken her istekte okunur.
const TESHIS_SINIRI = 20;
let sayac = 0;
function uygun(req) {
  return (req.path === '/teklif' && req.method === 'POST') || req.path === '/saglik' || (req.path === '/' && req.method === 'GET');
}
function teshis(req, res, next) {
  if (process.env.IP_TESHIS === 'true' && sayac < TESHIS_SINIRI && uygun(req) && !icIstek(req)) {
    sayac++;
    const h = req.headers;
    console.log(`[IP_TESHIS] ${req.method} ${req.path} socket=${maskele(req.socket && req.socket.remoteAddress)} xff=${maskeliListe(h['x-forwarded-for'])} `
      + `cf=${maskele(h['cf-connecting-ip'])} true-client=${maskele(h['true-client-ip'])} x-real-ip=${maskele(h['x-real-ip'])} `
      + `cf-ray=${h['cf-ray'] ? 'evet' : 'hayir'} req.ip=${maskele(req.ip)} anahtar=${maskele(anahtar(req))}`);
  }
  next();
}

module.exports = { anahtar, maskele, teshis, icIstek, maskeliListe };
