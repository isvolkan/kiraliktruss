// Form doğrulama kuralları (express-validator). Hem teklif formu hem proje formu burada.
const { body } = require('express-validator');

const ETKINLIK_TURLERI = ['Fuar standı', 'Konser / sahne', 'Kongre / toplantı', 'Lansman / tanıtım', 'Düğün / özel gün', 'Diğer'];

// Telefon kuralı: boşluk / tire / parantez atıldıktan sonra Türkiye cep (5xx) ya da sabit (2xx–4xx) numarası, +90 ya da 0 önekli/öneksiz.
// Sunucu ayıklanmış değeri bu desenle sınar; tarayıcı için aynı mantığın ayıklamasız karşılığı TELEFON_HTML_DESENI
// (input pattern; ayraçlar rakamlar arasında her yerde serbest). İkisi test/site.test.js'te örneklerle karşılaştırılır.
const TELEFON_DESENI = /^(\+90|0)?5\d{9}$|^(\+90|0)?[2-4]\d{9}$/;
const AYRAC = '[\\s\\(\\)\\-]*'; // `v` bayraklı pattern'de ( ) - sınıf içinde kaçışlı olmalı
const TELEFON_HTML_DESENI = `${AYRAC}(?:(?:\\+${AYRAC}90|0)${AYRAC})?[2-5](?:${AYRAC}\\d){9}${AYRAC}`;

const teklifKurallari = [
  body('ad_soyad').trim().isLength({ min: 3, max: 80 }).withMessage('Ad soyad 3–80 karakter olmalı.'),
  body('firma').optional({ values: 'falsy' }).trim().isLength({ max: 100 }).withMessage('Firma adı en fazla 100 karakter.'),
  body('telefon').trim()
    .customSanitizer(v => v.replace(/[\s()-]/g, ''))
    .matches(TELEFON_DESENI).withMessage('Geçerli bir telefon numarası girin (ör. 0532 123 45 67).'),
  body('eposta').trim().isEmail().withMessage('Geçerli bir e-posta adresi girin.').normalizeEmail({ gmail_remove_dots: false }),
  body('etkinlik_turu').isIn(ETKINLIK_TURLERI).withMessage('Etkinlik türünü seçin.'),
  body('sehir').trim().isLength({ min: 2, max: 60 }).withMessage('Şehir girin.'),
  body('tarih').isISO8601().withMessage('Geçerli bir tarih seçin.').bail()
    .custom(v => new Date(v) >= new Date(new Date().toDateString())).withMessage('Tarih bugünden önce olamaz.'),
  body('gun_sayisi').optional({ values: 'falsy' }).isInt({ min: 1, max: 60 }).withMessage('Gün sayısı 1–60 arası olmalı.').toInt(),
  body('metretul').optional({ values: 'falsy' }).isInt({ min: 1, max: 5000 }).withMessage('Metretül 1–5000 arası olmalı.').toInt(),
  body('mesaj').optional({ values: 'falsy' }).trim().isLength({ max: 2000 }).withMessage('Mesaj en fazla 2000 karakter.'),
  body('kvkk').equals('on').withMessage('Devam etmek için aydınlatma metnini onaylayın.'),
];

const projeKurallari = [
  body('musteri').trim().isLength({ min: 2, max: 100 }).withMessage('Müşteri adı 2–100 karakter olmalı.'),
  body('etkinlik').optional({ values: 'falsy' }).trim().isLength({ max: 120 }).withMessage('Etkinlik adı en fazla 120 karakter.'),
  body('sehir').optional({ values: 'falsy' }).trim().isLength({ max: 60 }).withMessage('Şehir en fazla 60 karakter.'),
  body('yil').optional({ values: 'falsy' }).isInt({ min: 2000, max: 2100 }).withMessage('Yıl 2000–2100 arası olmalı.').toInt(),
  body('tur').isIn(['fuar', 'etkinlik', 'kurumsal']).withMessage('Tür seçin.'),
  body('aciklama').optional({ values: 'falsy' }).trim().isLength({ max: 1000 }).withMessage('Açıklama en fazla 1000 karakter.'),
];

// ---- Yönetim paneli ----
const TEKLIF_DURUMLARI = { yeni: 'Yeni', arandi: 'Arandı', teklif_verildi: 'Teklif verildi', kapandi: 'Kapandı' };

// Teklifin durumu ve yönetici notu
const teklifGuncelleKurallari = [
  body('durum').isIn(Object.keys(TEKLIF_DURUMLARI)).withMessage('Geçerli bir durum seçin.'),
  body('yonetici_notu').optional({ values: 'falsy' }).trim().isLength({ max: 2000 }).withMessage('Not en fazla 2000 karakter.'),
];

// Şifre değiştirme. bcrypt yalnız ilk 72 baytı kullandığı için üst sınır 72.
const sifreKurallari = [
  body('mevcut').notEmpty().withMessage('Mevcut şifrenizi girin.'),
  body('yeni').isLength({ min: 10, max: 72 }).withMessage('Yeni şifre 10–72 karakter olmalı.').bail()
    .custom((v, { req }) => v !== req.body.mevcut).withMessage('Yeni şifre mevcut şifreden farklı olmalı.'),
  body('yeni_tekrar').custom((v, { req }) => v === req.body.yeni).withMessage('Yeni şifre ile tekrarı aynı değil.'),
];

module.exports = { TELEFON_DESENI, TELEFON_HTML_DESENI, teklifKurallari,projeKurallari, ETKINLIK_TURLERI, TEKLIF_DURUMLARI, teklifGuncelleKurallari, sifreKurallari };
