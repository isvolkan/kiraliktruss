// Form doğrulama kuralları (express-validator). Hem teklif formu hem proje formu burada.
const { body } = require('express-validator');

const ETKINLIK_TURLERI = ['Fuar standı', 'Konser / sahne', 'Kongre / toplantı', 'Lansman / tanıtım', 'Düğün / özel gün', 'Diğer'];

const teklifKurallari = [
  body('ad_soyad').trim().isLength({ min: 3, max: 80 }).withMessage('Ad soyad 3–80 karakter olmalı.'),
  body('firma').optional({ values: 'falsy' }).trim().isLength({ max: 100 }).withMessage('Firma adı en fazla 100 karakter.'),
  body('telefon').trim()
    .customSanitizer(v => v.replace(/[\s()-]/g, ''))
    .matches(/^(\+90|0)?5\d{9}$|^(\+90|0)?[2-4]\d{9}$/).withMessage('Geçerli bir telefon numarası girin (ör. 0532 123 45 67).'),
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
  body('etkinlik').trim().isLength({ min: 2, max: 120 }).withMessage('Etkinlik adı 2–120 karakter olmalı.'),
  body('sehir').optional({ values: 'falsy' }).trim().isLength({ max: 60 }),
  body('yil').optional({ values: 'falsy' }).isInt({ min: 2000, max: 2100 }).withMessage('Yıl 2000–2100 arası olmalı.').toInt(),
  body('tur').isIn(['fuar', 'etkinlik', 'kurumsal']).withMessage('Tür seçin.'),
  body('aciklama').optional({ values: 'falsy' }).trim().isLength({ max: 1000 }),
];

module.exports = { teklifKurallari, projeKurallari, ETKINLIK_TURLERI };
