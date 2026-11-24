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

// Teşhis günlüğündeki adreste son bölümü gizle: 1.2.3.4 → 1.2.3.x, 2001:db8::1 → 2001:db8::x
const maskele = (ip) => (typeof ip === 'string' && ip ? ip.replace(/[^.:]+$/, 'x') : '-');

// Geçici canlı doğrulama: IP_TESHIS=true iken yalnız ilk 5 POST /teklif ve ilk 5 /saglik isteğinde tek satır log yazar.
// Varsayılan kapalı; değişken her istekte okunur (yeniden başlatmadan açılıp kapanabilir).
const sayac = { '/teklif': 0, '/saglik': 0 };
function teshis(req, res, next) {
  if (process.env.IP_TESHIS === 'true') {
    const uygun = (req.path === '/teklif' && req.method === 'POST') || req.path === '/saglik';
    if (uygun && sayac[req.path] < 5) {
      sayac[req.path]++;
      const h = req.headers;
      console.log(`[IP_TESHIS] ${req.method} ${req.path} socket=${maskele(req.socket.remoteAddress)} xff=${String(h['x-forwarded-for'] || '-').split(',').map((a) => maskele(a.trim())).join(', ')} `
        + `cf=${maskele(h['cf-connecting-ip'])} req.ip=${maskele(req.ip)} anahtar=${maskele(anahtar(req))}`);
    }
  }
  next();
}

module.exports = { anahtar, maskele, teshis };
