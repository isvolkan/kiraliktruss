// Express uygulaması. Sunucuyu başlatmaz (server.js başlatır); testler bu dosyayı doğrudan kullanır.
require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const helmet = require('helmet');
const pool = require('./db/pool');

const app = express();
const uretim = process.env.NODE_ENV === 'production';

// Canlıda oturum anahtarı zorunlu: yoksa uygulama hiç başlamasın (tahmin edilebilir anahtarla çalışmasın)
if (uretim && !process.env.SESSION_SECRET) throw new Error('SESSION_SECRET tanımlı değil');
// Geliştirmede anahtar yoksa her açılışta rastgele üretilir (sabit, tahmin edilebilir anahtar olmasın);
// bedeli: sunucu yeniden başlayınca oturumlar düşer. Kalıcı olsun istiyorsanız .env'e SESSION_SECRET yazın.
let oturumAnahtari = process.env.SESSION_SECRET;
if (!oturumAnahtari) {
  oturumAnahtari = require('crypto').randomBytes(32).toString('hex');
  console.warn('UYARI: SESSION_SECRET tanımlı değil; geçici rastgele anahtar kullanılıyor (.env dosyasına ekleyin).');
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1); // Render gibi sunucular HTTPS'i önden karşılar

// Güvenlik başlıkları. Harita için OpenStreetMap iframe'ine, yazı tipi için Google Fonts'a izin veriyoruz.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      'default-src': ["'self'"],
      'img-src': ["'self'", 'data:'],
      'style-src': ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'script-src': ["'self'"],
      'frame-src': ['https://www.openstreetmap.org', 'https://www.google.com', 'https://maps.google.com'],
      'form-action': ["'self'"],
      'upgrade-insecure-requests': uretim ? [] : null,
    },
  },
}));

// Geliştirmede dosya değişince sayfayı kendiliğinden yenile (yalnız CANLI_YENILE=1 iken)
if (!uretim && process.env.CANLI_YENILE === '1') require('./dev/canli-yenile')(app, __dirname);

app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: uretim ? '7d' : 0, redirect: false }));

// Oturum: yönetici girişi için. Oturumlar veritabanında tutulur (sunucu yeniden başlasa da düşmez).
app.use(session({
  store: new PgSession({ pool, tableName: 'oturumlar', createTableIfMissing: true }),
  secret: oturumAnahtari,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: uretim, maxAge: 1000 * 60 * 60 * 8 },
}));

// Her görünümde kullanılan ortak değişkenler
app.use((req, res, next) => {
  res.locals.yol = req.path;
  res.locals.yonetici = req.session.kullanici || null;
  res.locals.bildirim = req.session.bildirim || null;
  delete req.session.bildirim;
  res.locals.firma = require('./config/firma');
  // Ders projesi önizlemesi: arama motorlarına kapalı + sayfada not (Hakan Bey alan adına taşımaya karar verene kadar)
  res.locals.demo = process.env.SITE_DEMO === 'true';
  if (res.locals.demo) res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
});

// Rotalar. Yönetim önce bağlanır: ziyaretçi router'ı en sonda 404 ve hata sayfasını da çizer (routes/site.js).
app.use('/yonetim', require('./routes/yonetim'));
app.use('/', require('./routes/site'));

module.exports = app;
