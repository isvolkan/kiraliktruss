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
      'frame-src': ['https://www.openstreetmap.org'],
      'form-action': ["'self'"],
      'upgrade-insecure-requests': uretim ? [] : null,
    },
  },
}));

app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: uretim ? '7d' : 0 }));

// Oturum: yönetici girişi için. Oturumlar veritabanında tutulur (sunucu yeniden başlasa da düşmez).
app.use(session({
  store: new PgSession({ pool, tableName: 'oturumlar', createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'gelistirme-anahtari',
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
  next();
});

app.use('/', require('./routes/site'));
app.use('/yonetim', require('./routes/yonetim'));

// 404
app.use((req, res) => res.status(404).render('404', { baslik: 'Sayfa bulunamadı' }));

// Beklenmeyen hata
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).render('hata', { baslik: 'Bir sorun oluştu' });
});

module.exports = app;
